import 'dotenv/config';
import EmbeddedPostgres from 'embedded-postgres';
import {existsSync} from 'node:fs';
if(!process.env.LOCAL_DB_PASSWORD)throw Error('Set LOCAL_DB_PASSWORD before starting the local development database.');
const db=new EmbeddedPostgres({databaseDir:'.postgres/development',user:'postgres',password:process.env.LOCAL_DB_PASSWORD,port:55432,persistent:true,autoRehydrateSymlinks:true,onLog:()=>{},onError:()=>{}});
if(!existsSync('.postgres/development/PG_VERSION'))await db.initialise();await db.start();
const client=db.getPgClient();await client.connect();if(!(await client.query("SELECT 1 FROM pg_database WHERE datname='pharmacy_pos'")).rowCount)await client.query('CREATE DATABASE pharmacy_pos');await client.end();console.log('Development PostgreSQL listening on 127.0.0.1:55432. Stop with Ctrl+C.');
const stop=async()=>{await db.stop();process.exit(0)};process.on('SIGINT',stop);process.on('SIGTERM',stop);setInterval(()=>{},60000);
