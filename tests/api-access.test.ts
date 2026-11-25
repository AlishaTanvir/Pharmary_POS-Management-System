import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {readFile,readdir,mkdir,mkdtemp,copyFile,writeFile,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {request as httpRequest,type Server} from 'node:http';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import {stopPostgres} from '../scripts/stop-postgres';
import {buildAccessInventory,generatedAccessSource,accessRoles,type AccessRoute} from '../scripts/api-access';
import {apiAccess} from '../server/api-access.generated';
import {assertLocalRequest} from '../server/http-security';

test('API source inventory is current and rejects missing guards, duplicate routes, dynamic paths and middleware ordering mistakes',async()=>{
 assert.equal((await readFile('server/api-access.generated.ts','utf8')).replace(/\r\n/g,'\n'),generatedAccessSource());assert.equal(apiAccess.routes.length,buildAccessInventory().routes.length);
 const parent=resolve('.local');await mkdir(parent,{recursive:true});const fixture=await mkdtemp(join(parent,'access-source-'));
 try{
  await mkdir(join(fixture,'server'));await mkdir(join(fixture,'scripts'));await copyFile('package.json',join(fixture,'package.json'));await copyFile('scripts/api-access.ts',join(fixture,'scripts/api-access.ts'));
  for(const file of (await readdir('server')).filter(file=>file.endsWith('.ts')&&!file.endsWith('.generated.ts')))await copyFile(join('server',file),join(fixture,'server',file));
  const baseline=buildAccessInventory(fixture);for(const file of await readdir(join(fixture,'server'))){const path=join(fixture,'server',file);await writeFile(path,(await readFile(path,'utf8')).replace(/\r\n/g,'\n').replace(/\n/g,'\r\n'))}const scanner=join(fixture,'scripts/api-access.ts');await writeFile(scanner,(await readFile(scanner,'utf8')).replace(/\r\n/g,'\n').replace(/\n/g,'\r\n'));assert.deepEqual(buildAccessInventory(fixture),baseline);
  const original=await readFile('server/index.ts','utf8'),path=join(fixture,'server/index.ts');
  for(const [extra,message] of [
   ["app.get('/api/unreviewed',async(_req,res)=>res.json({ok:true}));",/no reviewed role/],
   ["app.get('/api/medicines',permit('catalog:read'),async(_req,res)=>res.json({}));",/Duplicate/],
   ["app.get('/api/late-guard',async(_req,res)=>res.json({}),permit('catalog:read'));",/follows a route handler/],
   ["app.get(process.env.DYNAMIC_PATH!,permit('catalog:read'),async(_req,res)=>res.json({}));",/Dynamic route/]
  ] as const){await writeFile(path,original+'\n'+extra);assert.throws(()=>buildAccessInventory(fixture),message)}
  const mount="app.use('/api',securityReviewRoutes());";assert.ok(original.includes(mount));await writeFile(path,original.replace(mount,'').replace("app.post('/api/auth/login'",mount+"\napp.post('/api/auth/login'"));assert.throws(()=>buildAccessInventory(fixture),/outside the authentication boundary/);
 }finally{if(!fixture.startsWith(parent+sep))throw Error('Fixture cleanup escaped its workspace');await rm(fixture,{recursive:true,force:true})}
});

test('local-counter boundary rejects malformed authorities/origins and retains same-origin loopback operation',()=>{
 const request=(host:string,origin?:string,method='GET',local?:string)=>({method,protocol:'http',headers:{host,origin,'x-local-request':local}});
 for(const host of ['localhost:3001','127.0.0.1:3001','[::1]:3001'])assert.doesNotThrow(()=>assertLocalRequest(request(host,'http://'+host)));
 assert.doesNotThrow(()=>assertLocalRequest(request('LOCALHOST:3001','http://localhost:3001','POST','1')));
 for(const host of ['attacker.example','localhost@attacker.example','localhost/path','localhost?x=1','localhost#x','localhost:bad','localhost:99999','localhost\\path',' localhost'])assert.throws(()=>assertLocalRequest(request(host)),error=>(error as any).status===403);
 for(const origin of ['null','not a URL','http://attacker.example','https://localhost:3001','http://localhost:3002','http://name@localhost:3001','http://localhost:3001/path'])assert.throws(()=>assertLocalRequest(request('localhost:3001',origin)),error=>(error as any).status===403);
 assert.throws(()=>assertLocalRequest(request('localhost:3001',undefined,'POST')),error=>(error as any).status===403);
});

test('isolated HTTP matrix verifies every declared session route, write CSRF boundary and denied branch role',async()=>{
 const directory='.postgres/api-access-'+randomUUID(),password=randomUUID(),postgres=new EmbeddedPostgres({databaseDir:directory,user:'postgres',password,port:55456,persistent:true,autoRehydrateSymlinks:true,onLog:()=>{},onError:()=>{}});let p:pg.Pool|undefined,server:Server|undefined,applicationPool:pg.Pool|undefined,closeLocal:(()=>void)|undefined;
 try{
  await postgres.initialise();await postgres.start();p=new pg.Pool({host:'127.0.0.1',port:55456,user:'postgres',password,database:'postgres'});
  for(const file of (await readdir('server/migrations')).filter(file=>file.endsWith('.sql')).sort())await p.query(await readFile('server/migrations/'+file,'utf8'));
  const branch=randomUUID();await p.query("INSERT INTO branches(id,name,tax_confirmed) VALUES($1,'Access matrix',true)",[branch]);
  const actors:{id:string;role:typeof accessRoles[number];superAdmin:boolean;cookie:string;csrf:string}[]=[];
  for(const [role,superAdmin] of [...accessRoles.map(role=>[role,false] as const),['OWNER',true] as const]){
   const id=randomUUID(),token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');
   await p.query('INSERT INTO users(id,branch_id,name,username,password_hash,role,is_super_admin) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,branch,role,'access-'+id,'isolated-test-only',role,superAdmin]);
   await p.query("INSERT INTO sessions(token_hash,user_id,csrf,expires_at,branch_id) VALUES($1,$2,$3,now()+interval '30 minutes',$4)",[createHash('sha256').update(token).digest('hex'),id,csrf,branch]);
   actors.push({id,role,superAdmin,cookie:'session='+token,csrf});
  }
  process.env.DATABASE_URL=`postgres://postgres:${password}@127.0.0.1:55456/postgres`;process.env.NODE_ENV='test';process.env.REQUEST_LOGS='false';process.env.OFFLINE_DB_PATH=resolve(directory,'isolated-counter.sqlite');
  const app=(await import('../server/index')).default;applicationPool=(await import('../server/db')).pool;const store=(await import('../server/local-store')).localStore();closeLocal=()=>store.close();
  server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server!.once('listening',resolve));const port=(server.address() as any).port,base='http://127.0.0.1:'+port;
  const routes:readonly AccessRoute[]=apiAccess.routes,central=routes.filter(route=>route.boundary==='SESSION'),owner=actors.find(actor=>actor.superAdmin)!,evidence:any[]=[];let denied=0,csrfChecks=0,anonymous=0;
  const concrete=(path:string)=>path.replace(/:kind/g,'customer').replace(/:number/g,'NO-SUCH-INVOICE').replace(/:[a-z_]+/gi,'11111111-1111-4111-8111-111111111111');
  const call=(route:AccessRoute,headers:Record<string,string>={})=>fetch(base+concrete(route.path),{method:route.method,headers:{'Content-Type':'application/json',...headers},body:['GET','HEAD'].includes(route.method)?undefined:'{}'});
  for(const route of central){
   assert.equal((await call(route)).status,401,'Anonymous '+route.method+' '+route.path);anonymous++;
   if(route.method==='GET')assert.equal((await fetch(base+concrete(route.path),{method:'HEAD'})).status,401,'Anonymous HEAD '+route.path);
   if(!['GET','HEAD'].includes(route.method)){assert.equal((await call(route,{Cookie:owner.cookie})).status,403,'CSRF '+route.method+' '+route.path);csrfChecks++}
   const deniedRoles=[];
   for(const actor of actors){if((!route.organization_admin||actor.superAdmin)&&route.roles.includes(actor.role))continue;
    assert.equal((await call(route,{Cookie:actor.cookie,'X-CSRF-Token':actor.csrf})).status,403,'Role '+actor.role+' '+route.method+' '+route.path);denied++;deniedRoles.push(actor.role+(actor.superAdmin?' (org)':''));
   }
   evidence.push({method:route.method,path:route.path,anonymous_denied:true,csrf_checked:!['GET','HEAD'].includes(route.method),denied_roles:deniedRoles});
  }
  for(const route of routes.filter(route=>route.boundary==='LOCAL_SESSION'))assert.equal((await call(route,{'X-Local-Request':'1'})).status,401,'Local session '+route.path);
  assert.equal((await fetch(base+'/api/local/status',{headers:{Origin:'null'}})).status,403);
  const badHost=await new Promise<number>((resolve,reject)=>{const request=httpRequest(base+'/api/local/status',{headers:{Host:'attacker.example'}},response=>{response.resume();response.on('end',()=>resolve(response.statusCode!))});request.on('error',reject);request.end()});assert.equal(badHost,403);
  assert.equal((await fetch(base+'/api/local/unlock',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
  assert.equal((await fetch(base+'/api/sync/events',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
  const report=await fetch(base+'/api/security/api-access',{headers:{Cookie:owner.cookie}}).then(response=>response.json());assert.equal(report.inventory.route_source_sha256,apiAccess.route_source_sha256);
  const exported=await fetch(base+'/api/security/api-access/export',{method:'POST',headers:{Cookie:owner.cookie,'X-CSRF-Token':owner.csrf,'Content-Type':'application/json'},body:'{}'});assert.equal(exported.status,200);
  for(const table of ['sales','purchases','movements','journals','supplier_entries','customer_entries'])assert.equal((await p.query('SELECT count(*) n FROM '+table)).rows[0].n,'0');
  assert.equal((await p.query("SELECT count(*) n FROM audit_events WHERE action='API_ACCESS_INVENTORY_EXPORTED'")).rows[0].n,'1');
  await mkdir('.local',{recursive:true});await writeFile('.local/phase19-api-access-evidence.json',JSON.stringify({app_version:apiAccess.app_version,route_source_sha256:apiAccess.route_source_sha256,declared_routes:routes.length,session_routes:central.length,anonymous_checks:anonymous,csrf_checks:csrfChecks,denied_role_checks:denied,routes:evidence},null,2));
  console.log(`Access matrix passed: ${anonymous} session routes, ${csrfChecks} CSRF checks, ${denied} denied-role checks.`);
 }finally{
  if(server)await new Promise<void>(resolve=>server!.close(()=>resolve()));closeLocal?.();if(applicationPool)await applicationPool.end();if(p)await p.end();await stopPostgres(postgres,directory);
 }
});
