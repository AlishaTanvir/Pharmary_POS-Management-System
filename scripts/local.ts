import {stopPostgres} from './stop-postgres';
import {randomBytes} from 'node:crypto';
import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import dotenv from 'dotenv';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
if(!existsSync('.env')){const password=()=>randomBytes(24).toString('base64url');const dbPassword=password();writeFileSync('.env',`DATABASE_URL=postgres://postgres:${dbPassword}@127.0.0.1:55432/pharmacy_pos\nLOCAL_DB_PASSWORD=${dbPassword}\nADMIN_PASSWORD=${password()}\nCASHIER_PASSWORD=${password()}\nPORT=3001\nSESSION_MINUTES=30\nCOOKIE_SECURE=false\n`,{flag:'wx'});console.log('Created private local credentials in .env. Usernames: owner and cashier.');}
dotenv.config({quiet:true});
if(!process.env.BACKUP_KEY){const key=randomBytes(32).toString('hex');writeFileSync('.env','\nBACKUP_KEY='+key+'\n',{flag:'a'});process.env.BACKUP_KEY=key;}

if(!process.env.LOCAL_DB_PASSWORD)throw Error('LOCAL_DB_PASSWORD is required for the embedded development database. Use npm run server with your own PostgreSQL instead.');
const db=new EmbeddedPostgres({databaseDir:'.postgres/development',user:'postgres',password:process.env.LOCAL_DB_PASSWORD,port:55432,persistent:true,autoRehydrateSymlinks:true,onLog:(message)=>{if(/FATAL|ERROR/.test(message))console.error(message)},onError:console.error});
const fresh=!existsSync('.postgres/development/PG_VERSION');if(fresh)await db.initialise();await db.start();const c=db.getPgClient();await c.connect();if(!(await c.query("SELECT 1 FROM pg_database WHERE datname='pharmacy_pos'")).rowCount)await c.query('CREATE DATABASE pharmacy_pos');await c.end();
const connection=new pg.Client({connectionString:process.env.DATABASE_URL});await connection.connect();await connection.query('CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');for(const file of readdirSync('server/migrations').filter(f=>f.endsWith('.sql')).sort()){await connection.query('BEGIN');try{await connection.query('SELECT pg_advisory_xact_lock(812861)');if(!(await connection.query('SELECT 1 FROM schema_migrations WHERE version=$1',[file])).rowCount){await connection.query(readFileSync('server/migrations/'+file,'utf8'));await connection.query('INSERT INTO schema_migrations(version) VALUES($1)',[file]);console.log('Applied',file)}await connection.query('COMMIT')}catch(e){await connection.query('ROLLBACK');throw e}}

const empty=!(await connection.query('SELECT 1 FROM branches')).rowCount;await connection.end();if(empty){const {seed}=await import('../server/seed');await seed();}
await import('../server/index');const stop=async()=>{const {pool}=await import('../server/db');await pool.end();await stopPostgres(db,'.postgres/development');process.exit(0)};process.on('SIGINT',stop);process.on('SIGTERM',stop);
