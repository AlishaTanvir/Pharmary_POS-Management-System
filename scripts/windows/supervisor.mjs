import {verifyRelease} from './verify-release.mjs';
import {spawn,spawnSync} from 'node:child_process';
import {existsSync,writeFileSync,readFileSync,createWriteStream,unlinkSync,mkdirSync,rmdirSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const app=dirname(fileURLToPath(import.meta.url)),data=resolve(process.argv[2]||'');
if(!process.argv[2])throw Error('Supply the private data directory.');
await verifyRelease(app,{installed:true});
const {default:dotenv}=await import('dotenv');
dotenv.config({path:join(data,'.env'),quiet:true,override:true});
const pg=process.env.POSTGRES_BIN_DIRECTORY;if(!pg)throw Error('PostgreSQL binary directory is missing.');
const pgData=join(data,'postgres'),port=process.env.LOCAL_POSTGRES_PORT||'55433';
const databaseUrl=new URL(process.env.DATABASE_URL||'');if(databaseUrl.hostname!=='127.0.0.1'||databaseUrl.port!==port||databaseUrl.pathname!=='/pharmacy_pos')throw Error('The local supervisor requires its configured loopback database. Use the external database workflow for other deployments.');
const log=createWriteStream(join(data,'application.log'),{flags:'a'});await new Promise((resolve,reject)=>{log.once('open',resolve);log.once('error',reject)});
const run=(file,args,env=process.env)=>new Promise((resolve,reject)=>{const child=spawn(file,args,{cwd:data,env,windowsHide:true,stdio:['ignore',log,log]});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('Runtime operation failed. Inspect the private application log.')))});
const status=()=>spawnSync(join(pg,'pg_ctl.exe'),['-D',pgData,'status'],{windowsHide:true,stdio:'ignore'}).status===0;
const guard=join(data,'supervisor-start.lock');mkdirSync(guard);try{if(existsSync(join(data,'supervisor.lock'))){const lock=JSON.parse(readFileSync(join(data,'supervisor.lock'),'utf8'));try{process.kill(lock.pid,0);throw Error('A supervisor already owns this data directory. Stop it before restarting.')}catch(e){if(e.code!=='ESRCH')throw e;unlinkSync(join(data,'supervisor.lock'))}}
writeFileSync(join(data,'supervisor.lock'),JSON.stringify({pid:process.pid}),{flag:'wx'});}finally{rmdirSync(guard)}
let ownsDatabase=false;
try{
 if(!existsSync(join(pgData,'PG_VERSION'))){const pw=join(data,'init-password.tmp');writeFileSync(pw,process.env.LOCAL_DB_PASSWORD,{flag:'wx'});try{await run(join(pg,'initdb.exe'),['-D',pgData,'-U','postgres','--auth=scram-sha-256','--encoding=UTF8','--locale=C','--pwfile='+pw])}finally{unlinkSync(pw)}}
 if(!status()){await run(join(pg,'pg_ctl.exe'),['-D',pgData,'-l',join(data,'postgres.log'),'-o','-h 127.0.0.1 -p '+port,'-w','start']);ownsDatabase=true}
 const pgModule=await import('pg');const admin=new pgModule.default.Client({host:'127.0.0.1',port:Number(port),user:'postgres',password:process.env.LOCAL_DB_PASSWORD,database:'postgres'});await admin.connect();try{if(!(await admin.query("SELECT 1 FROM pg_database WHERE datname='pharmacy_pos'")).rowCount)await admin.query('CREATE DATABASE pharmacy_pos')}finally{await admin.end()}
 await run(process.execPath,[join(app,'server','migrate.js')]);
 if(process.env.BOOTSTRAP_OWNER_PASSWORD){const check=new pgModule.default.Client({connectionString:process.env.DATABASE_URL});await check.connect();const empty=!(await check.query('SELECT 1 FROM branches LIMIT 1')).rowCount;await check.end();if(empty)await run(process.execPath,[join(app,'server','bootstrap.js')]);const envFile=join(data,'.env');writeFileSync(envFile,readFileSync(envFile,'utf8').split(/\r?\n/).filter(l=>!l.startsWith('BOOTSTRAP_OWNER_PASSWORD=')).join('\n'));delete process.env.BOOTSTRAP_OWNER_PASSWORD}
 process.env.STATIC_DIRECTORY=join(app,'dist');await run(process.execPath,[join(app,'server','index.js')]);
}finally{if(ownsDatabase&&status())await run(join(pg,'pg_ctl.exe'),['-D',pgData,'-m','fast','-w','stop']);unlinkSync(join(data,'supervisor.lock'));log.end()}
