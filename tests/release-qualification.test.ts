import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {assertSchemaCompatible} from '../server/schema-compatibility';
// @ts-expect-error The native installer module intentionally has no TypeScript dependency.
import {verifyRelease,safeReleasePath} from '../scripts/windows/verify-release.mjs';
test('release paths and schema guard reject ambiguous Windows paths and unsafe downgrades',()=>{
 for(const path of ['../escape','a/../b','/root','C:/root','a\\b','a//b','a./b','a /b','.env','docs/.env.example','counter.sqlite-wal','backup.pgbak','secret.key','data-location.txt','docs/NUL.txt','bad?.js'])assert.equal(safeReleasePath(path),false,path);
 assert.equal(safeReleasePath('node_modules/pg/lib/index.js'),true);assert.doesNotThrow(()=>assertSchemaCompatible(['001.sql','002.sql'],[]));assert.doesNotThrow(()=>assertSchemaCompatible(['001.sql','002.sql'],['001.sql']));assert.throws(()=>assertSchemaCompatible(['001.sql'],['001.sql','002.sql']),/unknown/);assert.throws(()=>assertSchemaCompatible(['001.sql','002.sql'],['002.sql']),/prefix/);
});
test('release verifier checks required files, exact inventory, tampering, private files and migration policy',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pharmacy-release-'));
 const files:Record<string,string>={'package.json':JSON.stringify({version:'test'}),'dist/index.html':'<script src="/assets/main.js"></script>','dist/assets/main.js':'console.log(1)','server/index.js':'','server/migrate.js':'','server/bootstrap.js':'','server/migrations/001.sql':'SELECT 1;','Install.ps1':'','Start.ps1':'','Stop.ps1':'','supervisor.mjs':'','stop.mjs':'','verify-release.mjs':'','THIRD-PARTY.json':'{}'};
 const hash=(s:string)=>createHash('sha256').update(s).digest('hex');files['release-policy.json']=JSON.stringify({version:'test',currency:'PKR',migrations:[{version:'001.sql',sha256:hash(files['server/migrations/001.sql'])}]});
 const manifest={schema:'pharmacy-release/v2',version:'test',unsigned:true,files:Object.entries(files).map(([path,text])=>({path,sha256:hash(text)}))};
 for(const[path,text]of Object.entries(files)){await mkdir(join(root,path,'..'),{recursive:true});await writeFile(join(root,path),text)}await writeFile(join(root,'manifest.json'),JSON.stringify(manifest));
 const success=await verifyRelease(root);assert.equal(success.production_approved,false);assert.equal(success.publisher_authenticated,false);assert.equal(success.migrations,1);
 await writeFile(join(root,'server/index.js'),'tampered');await assert.rejects(()=>verifyRelease(root),/integrity/);await writeFile(join(root,'server/index.js'),'');
 const policyBad=JSON.parse(files['release-policy.json']);policyBad.migrations[0].sha256='a'.repeat(64);const badText=JSON.stringify(policyBad),policyManifest=JSON.parse(JSON.stringify(manifest));policyManifest.files.find((row:any)=>row.path==='release-policy.json').sha256=hash(badText);await writeFile(join(root,'release-policy.json'),badText);await writeFile(join(root,'manifest.json'),JSON.stringify(policyManifest));await assert.rejects(()=>verifyRelease(root),/Migration checksum/);await writeFile(join(root,'release-policy.json'),files['release-policy.json']);await writeFile(join(root,'manifest.json'),JSON.stringify(manifest));
 await writeFile(join(root,'data-location.txt'),'private-location');await assert.rejects(()=>verifyRelease(root),/Unexpected/);await verifyRelease(root,{installed:true});
 await writeFile(join(root,'.env'),'not-a-real-secret');await assert.rejects(()=>verifyRelease(root,{installed:true}),/Unexpected/);
 const malicious=JSON.parse(JSON.stringify(manifest));malicious.files.push({path:'../outside',sha256:'a'.repeat(64)});await writeFile(join(root,'manifest.json'),JSON.stringify(malicious));await assert.rejects(()=>verifyRelease(root),/Unsafe/);
 const duplicate=JSON.parse(JSON.stringify(manifest));duplicate.files.push({...duplicate.files[0],path:'PACKAGE.JSON'});await writeFile(join(root,'manifest.json'),JSON.stringify(duplicate));await assert.rejects(()=>verifyRelease(root),/duplicate/);
});

test('PostgreSQL migration command refuses future schema and applies/repeats the supported prefix',async()=>{
 const {default:EmbeddedPostgres}=await import('embedded-postgres');const {stopPostgres}=await import('../scripts/stop-postgres');const {randomUUID}=await import('node:crypto');const {resolve}=await import('node:path');const {execFile}=await import('node:child_process');
 const directory='.postgres/release-guard-'+randomUUID(),password=randomUUID(),postgres=new EmbeddedPostgres({databaseDir:directory,user:'postgres',password,port:55526,persistent:true,autoRehydrateSymlinks:true,onLog:()=>{},onError:()=>{}});await postgres.initialise();await postgres.start();const db=postgres.getPgClient();
 try{await db.connect();await db.query('CREATE TABLE schema_migrations(version text PRIMARY KEY,applied_at timestamptz DEFAULT now())');await db.query("INSERT INTO schema_migrations(version) VALUES('999_future.sql')");
 const execute=()=>new Promise<{code:number;out:string;err:string}>(yes=>execFile(process.execPath,['--import','tsx',resolve('server/migrate.ts')],{env:{...process.env,DATABASE_URL:'postgres://postgres:'+password+'@127.0.0.1:55526/postgres'},windowsHide:true},(error,out,err)=>yes({code:error?1:0,out,err})));
 const refused=await execute();assert.equal(refused.code,1);assert.match(refused.err,/unknown to this release/);assert.doesNotMatch(refused.out,/Applied/);assert.equal((await db.query("SELECT to_regclass('public.branches') table_name")).rows[0].table_name,null);
 await db.query('DELETE FROM schema_migrations');const first=await execute();assert.equal(first.code,0);const expected=(await readdir('server/migrations')).filter(f=>f.endsWith('.sql')).length;assert.equal((await db.query('SELECT count(*)::int n FROM schema_migrations')).rows[0].n,expected);const repeat=await execute();assert.equal(repeat.code,0);assert.doesNotMatch(repeat.out,/Applied/);
 }finally{await db.end();await stopPostgres(postgres,directory)}
});
