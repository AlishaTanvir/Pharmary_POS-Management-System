import ts from 'typescript';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {allowed} from '../server/domain';

export const accessRoles=['OWNER','MANAGER','PHARMACIST','CASHIER','CLERK','ACCOUNTANT','AUDITOR'] as const;
export type AccessRoute={method:string;path:string;boundary:'SESSION'|'LOCAL_PUBLIC'|'LOCAL_SESSION'|'DEVICE_SECRET'|'PUBLIC'|'CONTROL_TOKEN';permissions:readonly string[];roles:readonly string[];organization_admin:boolean;confirmation_middleware:boolean;source:string;line:number;conditional:boolean};
const selfService=new Set(['POST /api/auth/activity','GET /api/auth/me','POST /api/auth/logout','POST /api/auth/password','GET /api/branches','POST /api/branches/switch']);
const selectionRoles=['OWNER','MANAGER','PHARMACIST','CASHIER','ACCOUNTANT'];
export function buildAccessInventory(root=process.cwd()){
 const texts=new Map(readdirSync(resolve(root,'server')).filter(file=>file.endsWith('.ts')&&!file.endsWith('.generated.ts')).map(file=>[file,readFileSync(resolve(root,'server',file),'utf8').replace(/\r\n/g,'\n')]));
 const sources=new Map([...texts].map(([file,text])=>[file,ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true)]));
 type Registration={file:string;factory:string;receiver:string;method:string;path:string;node:ts.CallExpression;args:readonly ts.Expression[]};
 const registrations:Registration[]=[],uses:Registration[]=[];
 const enclosing=(node:ts.Node)=>{for(let p=node.parent;p;p=p.parent)if(ts.isFunctionDeclaration(p))return p.name?.text||'?';return'index'};
 for(const [file,sf] of sources){
  const visit=(node:ts.Node)=>{
   if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)){
    const method=node.expression.name.text,first=node.arguments[0];
    if(['get','post','put','patch','delete','head','options','all','route','use'].includes(method)&&first&&ts.isStringLiteral(first)&&first.text.startsWith('/')){
     const receiver=node.expression.expression.getText(sf);
     if(!['app','r'].includes(receiver))throw Error(`Unreviewed route receiver ${file}: ${receiver}`);
     if(['all','route'].includes(method))throw Error(`Use explicit HTTP registrations for access review: ${file} ${first.text}`);
     const item={file,factory:enclosing(node),receiver,method:method.toUpperCase(),path:first.text,node,args:node.arguments.slice(1)};
     (method==='use'?uses:registrations).push(item);
    }else if(['get','post','put','patch','delete','head','options','all','route'].includes(method)&&['app','r'].includes(node.expression.expression.getText(sf)))throw Error(`Dynamic route registration requires access-review support: ${file}`);
   }
   ts.forEachChild(node,visit);
  };visit(sf);
 }
 const index=sources.get('index.ts')!;
 const auth=uses.find(row=>row.file==='index.ts'&&row.path==='/api'&&row.args.some(arg=>(ts.isArrowFunction(arg)||ts.isFunctionExpression(arg))&&arg.getText(index).includes('res.locals.actor=session')));
 if(!auth)throw Error('Central session/CSRF boundary is missing or changed. Review the scanner and authentication tests.');
 const mounts=new Map<string,Registration>();
 for(const use of uses.filter(row=>row.file==='index.ts'))for(const arg of use.args)if(ts.isCallExpression(arg)&&ts.isIdentifier(arg.expression)&&arg.expression.text.endsWith('Routes')||ts.isCallExpression(arg)&&ts.isIdentifier(arg.expression)&&arg.expression.text==='runtimeReadiness'){
  const call=arg as ts.CallExpression,key=call.expression.getText(index);if(mounts.has(key))throw Error('Duplicate router mount: '+key);mounts.set(key,use);
 }
 const rows:AccessRoute[]=[],keys=new Set<string>();
 for(const route of registrations){
  const sf=sources.get(route.file)!,mount=route.receiver==='app'?null:mounts.get(route.factory);
  if(route.receiver!=='app'&&!mount)throw Error(`Unmapped router ${route.file}:${route.factory}`);
  const path=(mount?.path||'')+route.path,key=route.method+' '+path;
  if(keys.has(key))throw Error('Duplicate/shadowed endpoint: '+key);keys.add(key);
  const inherited=uses.filter(use=>use.args.some(arg=>arg.getText(sources.get(use.file)!)==='requireSuper')&&((use.file==='index.ts'&&(path===use.path||path.startsWith(use.path+'/'))&&use.node.pos<(mount?.node.pos||route.node.pos))||(use.file===route.file&&use.factory===route.factory&&(route.path===use.path||route.path.startsWith(use.path+'/'))&&use.node.pos<route.node.pos)));
  const gates=route.args.map(arg=>arg.getText(sf));
  const handler=route.args.findIndex(arg=>ts.isArrowFunction(arg)||ts.isFunctionExpression(arg));
  for(const [position,arg] of route.args.entries()){
   if(ts.isArrowFunction(arg)||ts.isFunctionExpression(arg))continue;
   if(handler>=0&&position>handler)throw Error('Access middleware follows a route handler: '+key);
   if(ts.isIdentifier(arg)&&['confirm','requireSuper'].includes(arg.text))continue;
   if(ts.isCallExpression(arg)&&arg.expression.getText(sf)==='permit'&&arg.arguments.length===1&&ts.isStringLiteral(arg.arguments[0]))continue;
   throw Error('Unreviewed route middleware: '+key+' '+arg.getText(sf));
  }
  const permissions=route.args.flatMap(arg=>ts.isCallExpression(arg)&&arg.expression.getText(sf)==='permit'&&arg.arguments[0]&&ts.isStringLiteral(arg.arguments[0])?[arg.arguments[0].text]:[]);
  const organization_admin=gates.includes('requireSuper')||!!inherited.length;
  let boundary:AccessRoute['boundary']='SESSION',roles:string[]=accessRoles.filter(role=>permissions.every(permission=>allowed(role,permission)));
  if(path==='/health')boundary='PUBLIC';
  else if(path==='/api/auth/login')boundary='PUBLIC';
  else if(path==='/_control/stop')boundary='CONTROL_TOKEN';
  else if(route.factory==='localRoutes')boundary=['/status','/unlock'].includes(route.path)?'LOCAL_PUBLIC':'LOCAL_SESSION';
  else if(route.factory==='syncRoutes')boundary='DEVICE_SECRET';
  else{
   if(!path.startsWith('/api/')||(mount?.node.pos||route.node.pos)<auth.node.pos)throw Error('Session route is outside the authentication boundary: '+key);
   if(key==='GET /api/customers/options')roles=selectionRoles;
   else if(!permissions.length&&!organization_admin&&!selfService.has(key))throw Error('Endpoint has no reviewed role or self-service control: '+key);
  }
  rows.push({method:route.method,path,boundary,permissions,roles:boundary==='SESSION'?roles:[],organization_admin,confirmation_middleware:gates.includes('confirm'),source:'server/'+route.file,line:sf.getLineAndCharacterOfPosition(route.node.getStart(sf)).line+1,conditional:path==='/_control/stop'});
 }
 rows.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:a.method<b.method?-1:a.method>b.method?1:0);
 const routeFiles=[...new Set(registrations.map(row=>row.file).concat(uses.map(row=>row.file)))].sort();
 const digest=createHash('sha256');for(const file of routeFiles)digest.update(file+'\n'+texts.get(file));digest.update(readFileSync(resolve(root,'scripts/api-access.ts'),'utf8').replace(/\r\n/g,'\n'));digest.update(texts.get('domain.ts')!);digest.update(texts.get('http-security.ts')!);digest.update(JSON.stringify(rows));
 return{schema:'pharmacy-api-access/v1',app_version:JSON.parse(readFileSync(resolve(root,'package.json'),'utf8')).version,route_source_sha256:digest.digest('hex'),routes:rows};
}
export function generatedAccessSource(root=process.cwd()){return'// Generated by npm run access:generate; review changes before committing.\nexport const apiAccess = '+JSON.stringify(buildAccessInventory(root),null,2)+' as const;\n'}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const expected=generatedAccessSource(),path=resolve('server/api-access.generated.ts');
 if(process.argv.includes('--write')){writeFileSync(path,expected);console.log('Generated API access inventory.');}
 else{if(readFileSync(path,'utf8').replace(/\r\n/g,'\n')!==expected)throw Error('API access inventory is stale. Review route changes, then run npm run access:generate.');console.log('API access inventory matches source.');}
}
