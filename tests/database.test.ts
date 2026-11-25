import {postReturn,settle,shiftSummary,closeShift,approveCount,expireBatches} from '../server/production-services';
import {stopPostgres} from '../scripts/stop-postgres';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import {Actor,postSale,receive} from '../server/services';
test('PostgreSQL: atomic receiving, FEFO, concurrency, rollback, idempotency, immutability and branch permissions',async()=>{
 const directory='.postgres/tests-'+randomUUID(); const embedded=new EmbeddedPostgres({databaseDir:directory,user:'postgres',password:randomUUID(),port:55439,persistent:true,autoRehydrateSymlinks:true,onLog:()=>{},onError:()=>{}});
 let pool:pg.Pool|undefined;try{await embedded.initialise();await embedded.start();const client=embedded.getPgClient();await client.connect();pool=new pg.Pool({host:'127.0.0.1',port:55439,user:'postgres',password:(embedded as any).options?.password,database:'postgres'});await pool.end();pool=undefined;
 // The runtime-provided client supplies its configured credentials without exposing them.
 const settings=(client as any).connectionParameters;pool=new pg.Pool({host:settings.host,port:settings.port,user:settings.user,password:settings.password,database:settings.database});await client.end();
 for(const file of (await readdir(new URL('../server/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await pool.query(await readFile(new URL('../server/migrations/'+file,import.meta.url),'utf8'));
 const dbPool=pool;const tx=async<T>(fn:(db:pg.PoolClient)=>Promise<T>)=>{const db=await dbPool.connect();try{await db.query('BEGIN');const result=await fn(db);await db.query('COMMIT');return result}catch(e){await db.query('ROLLBACK');throw e}finally{db.release()}};
 const branch=randomUUID(),user=randomUUID(),supplier=randomUUID(),medicine=randomUUID(),unit=randomUUID();const actor:Actor={id:user,branch_id:branch,name:'Test owner',role:'OWNER'};
 await pool.query("INSERT INTO branches(id,name,tax_confirmed) VALUES($1,'Test',true)",[branch]);await pool.query("INSERT INTO users(id,branch_id,name,username,password_hash,role) VALUES($1,$2,'Test','test','unused','OWNER')",[user,branch]);await pool.query("INSERT INTO suppliers(id,branch_id,name) VALUES($1,$2,'Test supplier')",[supplier,branch]);await pool.query("INSERT INTO medicines(id,branch_id,sku,barcode,name,generic,strength,form,base_unit) VALUES($1,$2,'T','123','Test medicine','Ingredient','1mg','Tablet','tablet')",[medicine,branch]);await pool.query("INSERT INTO units(id,medicine_id,name,factor,price_paisa) VALUES($1,$2,'Strip',10,1000)",[unit,medicine]);
 await pool.query('INSERT INTO shifts(id,branch_id,cashier_id,opening_paisa) VALUES($1,$2,$3,0)',[randomUUID(),branch,user]);
 const receipt={idempotency_key:randomUUID(),supplier_id:supplier,vendor_ref:'V1',lines:[{medicine_id:medicine,unit_id:unit,quantity:2,unit_cost_paisa:500,batch_code:'EARLY',expiry:'2098-01-01'},{medicine_id:medicine,unit_id:unit,quantity:1,unit_cost_paisa:600,batch_code:'LATE',expiry:'2099-01-01'}]};
 const purchase=await tx(db=>receive(db,actor,receipt));assert.equal(await tx(db=>receive(db,actor,receipt)),purchase);assert.equal(Number((await pool.query('SELECT sum(quantity) n FROM batches')).rows[0].n),30);assert.equal(Number((await pool.query('SELECT sum(amount_paisa) n FROM supplier_entries')).rows[0].n),1600);
 const sale={idempotency_key:randomUUID(),lines:[{medicine_id:medicine,unit_id:unit,quantity:2}],discount_paisa:0,payments:[{method:'CASH' as const,amount_paisa:2000,reference:''}],notes:''};
 const ids=await Promise.all([tx(db=>postSale(db,actor,sale)),tx(db=>postSale(db,actor,sale))]);assert.equal(ids[0],ids[1]);assert.equal(Number((await pool.query('SELECT sum(quantity) n FROM batches')).rows[0].n),10);assert.equal((await pool.query('SELECT batch_code FROM allocations')).rows[0].batch_code,'EARLY');assert.equal((await pool.query('SELECT count(*) n FROM sales')).rows[0].n,'1');
 const last={...sale,lines:[{medicine_id:medicine,unit_id:unit,quantity:1}],payments:[{method:'CASH' as const,amount_paisa:1000,reference:''}]};const races=await Promise.allSettled([tx(db=>postSale(db,actor,{...last,idempotency_key:randomUUID()})),tx(db=>postSale(db,actor,{...last,idempotency_key:randomUUID()}))]);assert.equal(races.filter(r=>r.status==='fulfilled').length,1);assert.equal(Number((await pool.query('SELECT sum(quantity) n FROM batches')).rows[0].n),0);
 await assert.rejects(tx(db=>receive(db,actor,{...receipt,idempotency_key:randomUUID(),vendor_ref:'V2',lines:[receipt.lines[0],{...receipt.lines[1],medicine_id:randomUUID()}]})));assert.equal((await pool.query('SELECT count(*) n FROM purchases')).rows[0].n,'1');
 await tx(db=>receive(db,actor,{...receipt,idempotency_key:randomUUID(),vendor_ref:'V3'}));const before=(await pool.query('SELECT sum(quantity) n FROM batches')).rows[0].n;await assert.rejects(tx(async db=>{await postSale(db,actor,{...last,idempotency_key:randomUUID()});throw Error('Injected process failure before commit')}));assert.equal((await pool.query('SELECT sum(quantity) n FROM batches')).rows[0].n,before);
 await assert.rejects(pool.query("UPDATE sales SET notes='erased'"));await assert.rejects(tx(db=>postSale(db,{...actor,branch_id:randomUUID()},{...last,idempotency_key:randomUUID()})));await assert.rejects(tx(db=>postSale(db,{...actor,role:'CASHIER'},{...last,idempotency_key:randomUUID(),discount_paisa:100})));
 const movement=(await pool.query('SELECT sum(quantity_base) n FROM movements')).rows[0].n;assert.equal(String(before),String(movement));

 // Phase 2: retries, original-quantity cap, quarantine and original paid-value cap.
 const originalLine=(await pool.query('SELECT id FROM sale_lines WHERE sale_id=$1',[ids[0]])).rows[0].id;
 const refund={idempotency_key:randomUUID(),sale_id:ids[0],lines:[{line_id:originalLine,quantity:1}],reason:'Sealed package returned',method:'CASH' as const};
 const returnId=await tx(db=>postReturn(db,actor,refund));assert.equal(await tx(db=>postReturn(db,actor,refund)),returnId);
 assert.equal((await pool.query('SELECT refund_paisa FROM returns WHERE id=$1',[returnId])).rows[0].refund_paisa,'1000');
 assert.equal(Number((await pool.query("SELECT sum(quantity) n FROM batches WHERE status='QUARANTINED'")).rows[0].n),10);
 await assert.rejects(tx(db=>postReturn(db,{...actor,role:'CASHIER'},{...refund,idempotency_key:randomUUID()})));
 await tx(db=>postReturn(db,actor,{...refund,idempotency_key:randomUUID()}));
 await assert.rejects(tx(db=>postReturn(db,actor,{...refund,idempotency_key:randomUUID()})));
 assert.equal((await pool.query('SELECT sum(refund_paisa) n FROM returns WHERE sale_id=$1',[ids[0]])).rows[0].n,'2000');
 // Partial tender posts credit. Collections and return credit cannot exceed outstanding.
 const customer=randomUUID();await pool.query("INSERT INTO customers(id,branch_id,name,credit_limit_paisa) VALUES($1,$2,'Credit customer',2000)",[customer,branch]);
 const creditSale=await tx(db=>postSale(db,actor,{...last,idempotency_key:randomUUID(),customer_id:customer,payments:[{method:'CASH',amount_paisa:400,reference:''}]}));
 assert.equal((await pool.query('SELECT sum(amount_paisa) n FROM customer_entries WHERE customer_id=$1',[customer])).rows[0].n,'600');
 const collection={idempotency_key:randomUUID(),invoice_id:creditSale,amount_paisa:200,method:'CASH' as const,reference:'Receipt-C1'};
 const collectionId=await tx(db=>settle(db,actor,'customer',collection));assert.equal(await tx(db=>settle(db,actor,'customer',collection)),collectionId);
 await assert.rejects(tx(db=>settle(db,actor,'customer',{...collection,idempotency_key:randomUUID(),amount_paisa:401})));
 const creditLine=(await pool.query('SELECT id FROM sale_lines WHERE sale_id=$1',[creditSale])).rows[0].id;
 const creditReturn=await tx(db=>postReturn(db,actor,{...refund,idempotency_key:randomUUID(),sale_id:creditSale,lines:[{line_id:creditLine,quantity:1}]}));
 const amounts=(await pool.query('SELECT refund_paisa,credit_reduction_paisa FROM returns WHERE id=$1',[creditReturn])).rows[0];assert.equal(amounts.refund_paisa,'600');assert.equal(amounts.credit_reduction_paisa,'400');
 assert.equal((await pool.query('SELECT sum(amount_paisa) n FROM customer_entries WHERE customer_id=$1',[customer])).rows[0].n,'0');
 await pool.query('UPDATE customers SET credit_limit_paisa=1 WHERE id=$1',[customer]);await assert.rejects(tx(db=>postSale(db,actor,{...last,idempotency_key:randomUUID(),customer_id:customer,payments:[]})));
 const payment={idempotency_key:randomUUID(),invoice_id:purchase,amount_paisa:100,method:'CASH' as const,reference:'Supplier-P1'};
 const paymentId=await tx(db=>settle(db,actor,'supplier',payment));assert.equal(await tx(db=>settle(db,actor,'supplier',payment)),paymentId);
 await assert.rejects(tx(db=>settle(db,actor,'supplier',{...payment,idempotency_key:randomUUID(),amount_paisa:1501})));
 // Counts preserve snapshots, require another person, and append adjustments.
 const manager=randomUUID();await pool.query("INSERT INTO users(id,branch_id,name,username,password_hash,role) VALUES($1,$2,'Manager','manager','unused','MANAGER')",[manager,branch]);
 const batch=(await pool.query("SELECT * FROM batches WHERE status='AVAILABLE' AND quantity>0 ORDER BY expiry LIMIT 1")).rows[0];const count=randomUUID();await pool.query('INSERT INTO stock_counts(id,branch_id,batch_id,snapshot_quantity,counted_quantity,reason,actor_id,snapshot_movement_count) VALUES($1,$2,$3,$4,$5,$6,$7,(SELECT count(*) FROM movements WHERE batch_id=$3))',[count,branch,batch.id,batch.quantity,batch.quantity-1,'Damaged one tablet',manager]);
 await assert.rejects(tx(db=>approveCount(db,{...actor,id:manager,role:'MANAGER'},count)));await tx(db=>approveCount(db,actor,count));assert.equal((await pool.query('SELECT variance FROM count_approvals WHERE count_id=$1',[count])).rows[0].variance,-1);
 await assert.rejects(tx(db=>approveCount(db,actor,count)));
 const countStale=randomUUID();await pool.query('INSERT INTO stock_counts(id,branch_id,batch_id,snapshot_quantity,counted_quantity,reason,actor_id,snapshot_movement_count) VALUES($1,$2,$3,$4,$5,$6,$7,(SELECT count(*) FROM movements WHERE batch_id=$3))',[countStale,branch,batch.id,batch.quantity,batch.quantity,'Stale count fixture',manager]);await assert.rejects(tx(db=>approveCount(db,actor,countStale)));
 // Cash reconciliation includes all postings, records zero variance, prevents duplicate close.
 const shift=(await pool.query('SELECT id FROM shifts WHERE cashier_id=$1',[user])).rows[0].id;const summary=await tx(db=>shiftSummary(db,actor,shift));assert.equal(summary.expected_paisa,900);await tx(db=>closeShift(db,actor,shift,900,''));await assert.rejects(tx(db=>closeShift(db,actor,shift,900,'')));assert.equal((await pool.query('SELECT variance_paisa FROM shift_closings WHERE shift_id=$1',[shift])).rows[0].variance_paisa,'0');
 await assert.rejects(tx(db=>postSale(db,actor,{...last,idempotency_key:randomUUID()})));
 await pool.query("UPDATE batches SET expiry='2000-01-01' WHERE id=$1",[batch.id]);assert.equal(await tx(db=>expireBatches(db,branch)),1);assert.equal((await pool.query('SELECT status FROM batches WHERE id=$1',[batch.id])).rows[0].status,'EXPIRED');
 const mismatch=(await pool.query('SELECT count(*) n FROM batches b WHERE quantity<>COALESCE((SELECT sum(quantity_base) FROM movements m WHERE m.batch_id=b.id),0)')).rows[0].n;assert.equal(mismatch,'0');
 await assert.rejects(pool.query('DELETE FROM returns'));await assert.rejects(pool.query('UPDATE customer_entries SET amount_paisa=0'));
 }finally{if(pool)await pool.end();await stopPostgres(embedded,directory)}
});
