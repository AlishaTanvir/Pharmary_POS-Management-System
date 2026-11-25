import {legacyReceipt} from '../tests/fixtures/legacy-stock';
import {checkTestStorage} from './check-test-storage.mjs';
﻿import EmbeddedPostgres from 'embedded-postgres';
import {stopPostgres} from './stop-postgres';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
await checkTestStorage(process.argv.slice(2).some(arg=>arg.endsWith('.spec.ts'))?1:3);
const browser=process.env.ACCEPTANCE_BROWSER||'chromium';if(!['chromium','firefox'].includes(browser))throw Error('Use chromium or firefox for acceptance.');
const runId=randomUUID().replaceAll('-',''),database='acceptance_'+runId,directory=resolve('.local/acceptance-'+runId);
await mkdir(directory,{recursive:true});
// Operator database and account secrets are never used by acceptance.
const probe=createServer();await new Promise<void>((yes,no)=>{probe.once('error',no);probe.listen(3001,'127.0.0.1',()=>probe.close(()=>yes()))});
const databaseDirectory=resolve('.postgres/acceptance-'+runId),port=55525,password=randomBytes(24).toString('hex');
const postgres=new EmbeddedPostgres({databaseDir:databaseDirectory,user:'postgres',password,port,persistent:true,autoRehydrateSymlinks:true,onLog:()=>{},onError:()=>{}});let started=false;
try{await postgres.initialise();await postgres.start();started=true;
const admin=postgres.getPgClient();await admin.connect();await admin.query('CREATE DATABASE '+database);await admin.end();
process.env.DATABASE_URL='postgres://postgres:'+password+'@127.0.0.1:'+port+'/'+database;
process.env.LOCAL_DB_PASSWORD=password;process.env.ADMIN_PASSWORD=randomBytes(24).toString('hex');process.env.CASHIER_PASSWORD=randomBytes(24).toString('hex');process.env.BACKUP_KEY=randomBytes(32).toString('hex');
process.env.STATIC_DIRECTORY=resolve('dist');process.env.PORT='3001';process.env.NODE_ENV='development';process.env.COOKIE_SECURE='false';process.env.SESSION_MINUTES='30';process.env.OFFLINE_DB_PATH=resolve(directory,'counter.sqlite');process.env.BACKUP_DIRECTORY=resolve(directory,'backups');process.env.BACKUP_OFF_DEVICE='false';process.env.LOCAL_CONTROL_TOKEN=randomUUID();process.env.REQUEST_LOGS='false';
process.env.ACCEPTANCE_PG_DIRECTORY=databaseDirectory;process.env.ACCEPTANCE_PG_CTL=resolve('node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe');
const migrate=new pg.Client({connectionString:process.env.DATABASE_URL});await migrate.connect();await migrate.query('CREATE TABLE schema_migrations(version text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())');const migrations=(await readdir('server/migrations')).filter(f=>f.endsWith('.sql')).sort();async function apply(files:string[]){for(const file of files){await migrate.query('BEGIN');try{await migrate.query(await readFile('server/migrations/'+file,'utf8'));await migrate.query('INSERT INTO schema_migrations(version) VALUES($1)',[file]);await migrate.query('COMMIT')}catch(e){await migrate.query('ROLLBACK');throw e}}}
await apply(migrations.filter(f=>f<'020_'));const {seed}=await import('../server/seed');await seed();const {pool,transaction}=await import('../server/db');const {receive}=await import('../server/services');const fixtureOwner=(await pool.query("SELECT id,branch_id,name,role FROM users WHERE username='owner'")).rows[0],fixtureSupplier=(await pool.query("SELECT id FROM suppliers WHERE branch_id=$1 ORDER BY name LIMIT 1",[fixtureOwner.branch_id])).rows[0].id,fixtureMedicine=randomUUID(),fixtureUnit=randomUUID(),expiry=new Date();expiry.setUTCDate(expiry.getUTCDate()+30);
await transaction(async db=>{await db.query("INSERT INTO medicines(id,branch_id,sku,barcode,name,generic,strength,form,base_unit) VALUES($1,$2,'LEGACY-HIST1','LEGACY-HIST1','Legacy classification acceptance','Ingredient','1mg','Tablet','Tablet')",[fixtureMedicine,fixtureOwner.branch_id]);await db.query("INSERT INTO units(id,medicine_id,name,factor,price_paisa) VALUES($1,$2,'Tablet',1,200)",[fixtureUnit,fixtureMedicine]);await legacyReceipt(db,fixtureOwner,{idempotency_key:randomUUID(),supplier_id:fixtureSupplier,vendor_ref:'LEGACY-HISTORY-ACCEPTANCE',lines:[{medicine_id:fixtureMedicine,unit_id:fixtureUnit,quantity:3,unit_cost_paisa:100,batch_code:'LEGACY-HIST1',expiry:expiry.toISOString().slice(0,10)}]});});
await apply(migrations.filter(f=>f>='020_'));await pool.query("INSERT INTO medicines(id,branch_id,sku,barcode,name,generic,strength,form,base_unit) SELECT gen_random_uuid(),$1,'SCALE-'||n,'SCALE-'||n,'Scale medicine '||lpad(n::text,3,'0'),'Ingredient','1mg','Tablet','Tablet' FROM generate_series(1,105) n",[fixtureOwner.branch_id]);
await pool.query("INSERT INTO units(id,medicine_id,name,factor,price_paisa) SELECT gen_random_uuid(),id,'Tablet',1,200 FROM medicines WHERE sku LIKE 'SCALE-%'");
const scaleLines=(await pool.query("SELECT m.id medicine_id,u.id unit_id FROM medicines m JOIN units u ON u.medicine_id=m.id WHERE m.sku IN ('SCALE-1','SCALE-105') ORDER BY m.sku")).rows;
await transaction(db=>receive(db,fixtureOwner,{idempotency_key:randomUUID(),supplier_id:fixtureSupplier,vendor_ref:'SCALE-STOCK',lines:scaleLines.map((m:any)=>({...m,quantity:10,unit_cost_paisa:100,batch_code:'SCALE',expiry:'2099-01-01'}))}));
await pool.query("INSERT INTO customers(id,branch_id,name,phone,credit_limit_paisa) SELECT gen_random_uuid(),$1,'Scale customer '||lpad(n::text,3,'0'),'PHONE-'||n,100000 FROM generate_series(1,505) n",[fixtureOwner.branch_id]);
await migrate.end();await pool.end();
const metadata={database,directory,offline_store:process.env.OFFLINE_DB_PATH,app_version:JSON.parse(await readFile('package.json','utf8')).version,browser,node:process.versions.node,platform:process.platform,status:'running'};await writeFile('.local/acceptance-evidence.json',JSON.stringify(metadata,null,2));await writeFile('.local/acceptance-evidence-'+browser+'.json',JSON.stringify(metadata,null,2));console.log('Created independent acceptance database and local store; retained development history unchanged.');
const server=spawn(process.execPath,['--import','tsx','server/index.ts'],{env:process.env,windowsHide:true,stdio:['ignore','pipe','pipe']});server.stdout.pipe(process.stdout);server.stderr.pipe(process.stderr);let serverExit:Promise<void>=new Promise(resolve=>server.once('exit',()=>resolve()));
try{let ready=false;for(let n=0;n<60;n++){try{const r=await fetch('http://127.0.0.1:3001/health');if(r.ok){ready=true;break}}catch{}await new Promise(resolve=>setTimeout(resolve,500))}if(!ready)throw Error('Acceptance server did not become ready');
 const tests=spawn(process.execPath,[resolve('node_modules/@playwright/test/cli.js'),'test',...process.argv.slice(2)],{env:process.env,windowsHide:true,stdio:'inherit'});const code=await new Promise<number>(resolve=>tests.once('exit',value=>resolve(value??1)));metadata.status=code===0?'passed':'failed';await writeFile('.local/acceptance-evidence.json',JSON.stringify(metadata,null,2));await writeFile('.local/acceptance-evidence-'+browser+'.json',JSON.stringify(metadata,null,2));

 process.exitCode=code;
}finally{await fetch('http://127.0.0.1:3001/_control/stop',{method:'POST',headers:{'X-Control-Token':process.env.LOCAL_CONTROL_TOKEN!}}).catch(()=>{});await Promise.race([serverExit,new Promise(resolve=>setTimeout(resolve,10000))]);if(server.exitCode===null)server.kill();console.log('Acceptance API stopped; the independently named database and evidence are retained.');}

}finally{if(started)await stopPostgres(postgres,databaseDirectory);console.log('Owned acceptance PostgreSQL stopped; isolated evidence retained.');}
