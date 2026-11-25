import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import {stopPostgres} from '../scripts/stop-postgres';
import {Actor,postSale,receive} from '../server/services';
import {saleInput,receiptInput} from '../server/schemas';
import {cartInput,saveCart} from '../server/readiness-services';
import {onlineDraftState,onlineDraftWrite,writeOnlineDraft,readOnlineDraft,clearOnlineDraft,restoreOnlineDraft} from '../server/online-drafts';

const state=(medicine:string,unit:string)=>onlineDraftState.parse({cart:{idempotency_key:randomUUID(),lines:[{medicine_id:medicine,unit_id:unit,quantity:2}],discount_paisa:0,customer_id:null,notes:'Private reload fixture',prescription_ref:'RX-reference'},label:'Counter A',saved_cart_id:null});
test('online recovery validates bounded state and excludes payment/approval secrets',()=>{
 const valid=state(randomUUID(),randomUUID());assert.equal(onlineDraftWrite.parse({revision:0,state:valid}).revision,0);
 for(const cart of [{...valid.cart,payments:[]},{...valid.cart,approval_id:randomUUID()},{...valid.cart,notes:'x'.repeat(501)},{...valid.cart,lines:Array(101).fill(valid.cart.lines[0])},{...valid.cart,discount_paisa:-1}])assert.equal(onlineDraftState.safeParse({...valid,cart}).success,false);
 assert.equal(onlineDraftWrite.safeParse({revision:-1,state:valid}).success,false);assert.equal(onlineDraftState.safeParse({...valid,password:'secret'}).success,false);
 assert.equal(onlineDraftState.parse({...valid,cart:{...valid.cart,lines:[]}}).cart.lines.length,0);
});
test('PostgreSQL: recovery scopes revisions, reprices, expires, preserves tombstones and detects posted or suspended checkout',async()=>{
 const directory='.postgres/online-drafts-'+randomUUID(),password=randomUUID(),postgres=new EmbeddedPostgres({databaseDir:directory,user:'postgres',password,port:55455,persistent:true,autoRehydrateSymlinks:true,onLog:()=>{},onError:()=>{}});let pool:pg.Pool|undefined;
 try{
  await postgres.initialise();await postgres.start();pool=new pg.Pool({host:'127.0.0.1',port:55455,user:'postgres',password,database:'postgres'});const p=pool;
  for(const file of (await readdir('server/migrations')).filter(file=>file.endsWith('.sql')).sort())await p.query(await readFile('server/migrations/'+file,'utf8'));
  const tx=async<T>(fn:(db:pg.PoolClient)=>Promise<T>)=>{const db=await p.connect();try{await db.query('BEGIN');const result=await fn(db);await db.query('COMMIT');return result}catch(e){await db.query('ROLLBACK');throw e}finally{db.release()}};
  const branch=randomUUID(),otherBranch=randomUUID(),user=randomUUID(),otherUser=randomUUID(),medicine=randomUUID(),unit=randomUUID(),supplier=randomUUID();
  await p.query("INSERT INTO branches(id,name,tax_confirmed) VALUES($1,'Recovery',true),($2,'Other',true)",[branch,otherBranch]);
  await p.query("INSERT INTO users(id,branch_id,name,username,password_hash,role) VALUES($1,$3,'Owner','draft-owner','fixture','OWNER'),($2,$3,'Other','draft-other','fixture','CASHIER')",[user,otherUser,branch]);
  await p.query("INSERT INTO medicines(id,branch_id,sku,barcode,name,generic,strength,form,base_unit) VALUES($1,$2,'DRAFT','DRAFT','Draft fixture','Ingredient','1mg','Tablet','Tablet')",[medicine,branch]);
  await p.query("INSERT INTO units(id,medicine_id,name,factor,price_paisa) VALUES($1,$2,'Tablet',1,200)",[unit,medicine]);
  await p.query("INSERT INTO suppliers(id,branch_id,name) VALUES($1,$2,'Fixture supplier')",[supplier,branch]);
  await p.query('INSERT INTO shifts(id,branch_id,cashier_id,opening_paisa) VALUES($1,$2,$3,0)',[randomUUID(),branch,user]);
  const a:Actor={id:user,branch_id:branch,name:'Owner',role:'OWNER'},foreign={...a,branch_id:otherBranch},other={...a,id:otherUser,role:'CASHIER'},id=randomUUID(),s=state(medicine,unit);
  assert.deepEqual(await tx(db=>readOnlineDraft(db,a,id)),{draft:null});
  assert.equal((await tx(db=>writeOnlineDraft(db,a,id,{revision:0,state:s}))).revision,1);
  assert.equal((await tx(db=>writeOnlineDraft(db,a,id,{revision:0,state:s}))).revision,1);
  await assert.rejects(tx(db=>writeOnlineDraft(db,a,id,{revision:0,state:{...s,label:'Stale'}})),/Another copy/);
  for(const actor of [foreign,other]){
   await assert.rejects(tx(db=>readOnlineDraft(db,actor,id)),/not found/);
   await assert.rejects(tx(db=>writeOnlineDraft(db,actor,id,{revision:1,state:s})),/not found/);
   await assert.rejects(tx(db=>clearOnlineDraft(db,actor,id,1)),/not found/);
  }
  await p.query('UPDATE units SET price_paisa=350 WHERE id=$1',[unit]);
  const recovered=await tx(db=>restoreOnlineDraft(db,a,id,1));assert.ok('lines' in recovered);assert.equal(Number(recovered.lines![0].unit.price_paisa),350);assert.equal(recovered.draft!.state.cart.notes,s.cart.notes);assert.equal(recovered.lines![0].medicine.available,0);
  assert.equal((await p.query('SELECT count(*) n FROM sales')).rows[0].n,'0');assert.equal((await p.query('SELECT count(*) n FROM movements')).rows[0].n,'0');
  const race=await Promise.allSettled(['A','B'].map(label=>tx(db=>writeOnlineDraft(db,a,id,{revision:1,state:{...s,label}}))));assert.equal(race.filter(result=>result.status==='fulfilled').length,1);
  await assert.rejects(tx(db=>restoreOnlineDraft(db,a,id,1)),/Another copy/);
  await assert.rejects(tx(db=>clearOnlineDraft(db,a,id,1)),/Another copy/);
  await tx(db=>clearOnlineDraft(db,a,id,2));assert.deepEqual(await tx(db=>readOnlineDraft(db,a,id)),{draft:null});
  await assert.rejects(tx(db=>writeOnlineDraft(db,a,id,{revision:2,state:s})),/cleared/);
  assert.deepEqual((await p.query('SELECT state FROM online_cart_drafts WHERE id=$1',[id])).rows[0].state,{});
  const inactive=randomUUID();await tx(db=>writeOnlineDraft(db,a,inactive,{revision:0,state:s}));await p.query('UPDATE medicines SET active=false WHERE id=$1',[medicine]);await assert.rejects(tx(db=>restoreOnlineDraft(db,a,inactive,1)),/inactive/);assert.ok((await tx(db=>readOnlineDraft(db,a,inactive))).draft);await p.query('UPDATE medicines SET active=true WHERE id=$1',[medicine]);
  await p.query("UPDATE online_cart_drafts SET updated_at=now()-interval '25 hours' WHERE id=$1",[inactive]);assert.deepEqual(await tx(db=>readOnlineDraft(db,a,inactive)),{draft:null});
  await tx(db=>receive(db,a,receiptInput.parse({idempotency_key:randomUUID(),supplier_id:supplier,vendor_ref:'DRAFT',lines:[{medicine_id:medicine,unit_id:unit,quantity:10,unit_cost_paisa:100,batch_code:'DRAFT',expiry:'2099-01-01'}]})));
  const postedDraft=randomUUID();await tx(db=>writeOnlineDraft(db,a,postedDraft,{revision:0,state:s}));
  const sale=await tx(db=>postSale(db,a,saleInput.parse({...s.cart,payments:[{method:'CASH',amount_paisa:700,reference:''}]})));
  assert.equal((await tx(db=>readOnlineDraft(db,a,postedDraft))).draft!.posted_sale_id,sale);
  assert.equal((await tx(db=>restoreOnlineDraft(db,a,postedDraft,1))).draft!.posted_sale_id,sale);
  assert.equal((await tx(db=>writeOnlineDraft(db,a,postedDraft,{revision:1,state:s}))).posted_sale_id,sale);
  assert.equal((await p.query('SELECT count(*) n FROM sales')).rows[0].n,'1');assert.equal((await p.query('SELECT quantity FROM batches')).rows[0].quantity,8);
  const held=randomUUID(),heldState=state(medicine,unit);await tx(db=>writeOnlineDraft(db,a,held,{revision:0,state:heldState}));
  await tx(db=>saveCart(db,a,cartInput.parse({id:heldState.cart.idempotency_key,label:'Held',cart:heldState.cart})));
  assert.equal((await tx(db=>readOnlineDraft(db,a,held))).draft!.suspended_cart_id,heldState.cart.idempotency_key);
  assert.equal((await p.query("SELECT count(*) n FROM audit_events WHERE action='ONLINE_DRAFT_RECOVERED'")).rows[0].n,'1');
 }finally{if(pool)await pool.end();await stopPostgres(postgres,directory)}
});
