import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import {stopPostgres} from '../scripts/stop-postgres';
import {fieldInput,fieldSummary} from '../server/field-domain';
import {fieldSnapshot,recordField} from '../server/field-acceptance';
import type {Actor} from '../server/services';
const base=()=>({idempotency_key:randomUUID(),drill_key:'PRINTER_80MM',status:'PENDING',evidence:'Fictional software fixture; no physical acceptance is attested.'});
test('field declarations require observed measurements and refuse missed targets without granting approval',()=>{
 assert.equal(fieldInput.parse(base()).status,'PENDING');assert.equal(fieldInput.safeParse({...base(),status:'ATTESTED'}).success,false);
 const observed={observed_by:'Fictional operator',observed_at:'2026-01-01T00:00:00Z',environment:'Fictional site',release_version:'fixture-version'};
 const printer={...base(),...observed,status:'ATTESTED',metrics:{printer_model:'Fixture only',printer_interface:'USB',paper_width_mm:80,copies_checked:2,legible:true,duplicate_marked:true}};
 assert.equal(fieldInput.safeParse(printer).success,true);assert.equal(fieldInput.safeParse({...printer,metrics:{...printer.metrics,copies_checked:1}}).success,false);assert.equal(fieldInput.safeParse({...printer,metrics:{...printer.metrics,paper_width_mm:58}}).success,false);assert.equal(fieldInput.safeParse({...printer,observed_at:'2999-01-01T00:00:00Z'}).success,false);
 assert.equal(fieldInput.safeParse({...base(),metrics:{password:'must not be accepted as a metric'}}).success,false);
 const recovery={...base(),...observed,drill_key:'OFF_DEVICE_RECOVERY',status:'ATTESTED',metrics:{backup_reference:'Fixture ID',recovery_device:'Different fixture device',custody_reference:'Fixture custody procedure',off_device:true,isolated_restore:true,target_rpo_seconds:10,actual_rpo_seconds:11,target_rto_seconds:60,actual_rto_seconds:30,reconciliation_mismatches:0}};
 assert.equal(fieldInput.safeParse(recovery).success,false);assert.equal(fieldInput.safeParse({...recovery,status:'FAILED'}).success,true);assert.equal(fieldInput.safeParse({...recovery,metrics:{...recovery.metrics,actual_rpo_seconds:10}}).success,true);
 const scanner={...base(),...observed,drill_key:'USB_SCANNER',status:'ATTESTED',metrics:{scanner_model:'Fixture only',scanner_interface:'USB_HID',scans_checked:3,exact_matches:2,leading_zero_preserved:true}};assert.equal(fieldInput.safeParse(scanner).success,false);
 const summary=fieldSummary(['PRINTER_80MM','USB_SCANNER','OUTAGE_REPLAY','OFF_DEVICE_RECOVERY','CASHIER_TRAINING','OWNER_REVIEW'].map(drill_key=>({drill_key,status:'ATTESTED'})));assert.equal(summary.attested_count,6);assert.equal(summary.production_approved,false);assert.equal(summary.open_project_gates.length,1);
});
test('PostgreSQL field evidence is branch scoped, append only, retry safe and preserves named history',async()=>{
 const directory='.postgres/field-'+randomUUID(),password=randomUUID(),postgres=new EmbeddedPostgres({databaseDir:directory,user:'postgres',password,port:55528,persistent:true,autoRehydrateSymlinks:true,onLog:()=>{},onError:()=>{}});let pool:pg.Pool|undefined;
 try{await postgres.initialise();await postgres.start();pool=new pg.Pool({host:'127.0.0.1',port:55528,user:'postgres',password,database:'postgres'});for(const file of(await readdir('server/migrations')).filter(f=>f.endsWith('.sql')).sort())await pool.query(await readFile('server/migrations/'+file,'utf8'));
 const branch=randomUUID(),other=randomUUID(),id=randomUUID();await pool.query("INSERT INTO branches(id,name) VALUES($1,'Field fixture'),($2,'Other fixture')",[branch,other]);await pool.query("INSERT INTO users(id,branch_id,name,username,password_hash,role) VALUES($1,$2,'Recorder before','field-owner','fixture','OWNER')",[id,branch]);const a:Actor={id,branch_id:branch,name:'Recorder before',role:'OWNER'},db=await pool.connect();
 async function record(input:ReturnType<typeof fieldInput.parse>){await db.query('BEGIN');try{const result=await recordField(db,a,input);await db.query('COMMIT');return result}catch(e){await db.query('ROLLBACK');throw e}}
 try{const input=fieldInput.parse(base()),first=await record(input);assert.equal(first.duplicate,false);assert.deepEqual(await record(input),{id:first.id,duplicate:true});await assert.rejects(record({...input,evidence:'Changed content must not reuse the same event key.'}),/different field evidence/);assert.equal((await db.query("SELECT count(*)::int n FROM audit_events WHERE action='FIELD_ACCEPTANCE_RECORDED'")).rows[0].n,1);
 await pool.query("UPDATE users SET name='Recorder after' WHERE id=$1",[id]);await record(fieldInput.parse({...base(),status:'DEFERRED'}));const snapshot=await fieldSnapshot(db,a);assert.equal(snapshot.events.length,2);assert.equal(snapshot.events[1].recorder_name,'Recorder before');assert.equal(snapshot.checks.find(c=>c.key==='PRINTER_80MM')?.latest?.status,'DEFERRED');assert.equal(snapshot.production_approved,false);assert.equal((await fieldSnapshot(db,{...a,branch_id:other})).events.length,0);
 await assert.rejects(db.query("UPDATE field_acceptance_events SET status='ATTESTED'"),/append only/);await assert.rejects(db.query('DELETE FROM field_acceptance_events'),/append only/);
 await db.query('BEGIN');await recordField(db,a,fieldInput.parse({...base(),drill_key:'OWNER_REVIEW'}));await db.query('ROLLBACK');assert.equal((await fieldSnapshot(db,a)).events.length,2);
 const declared=fieldInput.parse({...base(),status:'ATTESTED',observed_by:'Fictional test operator',observed_at:'2026-01-01T00:00:00Z',environment:'Isolated fixture only',release_version:'fixture-only',metrics:{printer_model:'Fictional fixture, no device accepted',printer_interface:'USB',paper_width_mm:80,copies_checked:2,legible:true,duplicate_marked:true}});await record(declared);const attested=await fieldSnapshot(db,a);assert.equal(attested.events.length,3);assert.equal(attested.events[0].metrics.paper_width_mm,80);assert.equal(attested.events[0].observed_by,'Fictional test operator');assert.equal(attested.production_approved,false);assert.equal(attested.pilot.production_approved,false);
 }finally{db.release()}
 }finally{if(pool)await pool.end();await stopPostgres(postgres,directory)}
});
