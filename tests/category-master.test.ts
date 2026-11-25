import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import {stopPostgres} from '../scripts/stop-postgres';
import {Actor} from '../server/services';
import {categoryMasterInput,importCategoryMaster,exportCategoryMaster,listCategories,saveCategory} from '../server/categories';
import {csvCategoryMaster,parseCsv} from '../src/csv';

const csv=(paths:unknown[])=>'category_path_json\r\n'+paths.map(path=>'"'+JSON.stringify(path).replaceAll('"','""')+'"').join('\r\n');
test('category master CSV preserves structured names and validates bounds separately from medicine CSV',()=>{
 const path=[' =Root / "quoted" ','Child, with comma','Line\nbreak'];
 assert.deepEqual(csvCategoryMaster('\uFEFF'+csv([path])),[{category_path:path.map(name=>name.trim())}]);
 assert.deepEqual(csvCategoryMaster('category_path_json\r\n'),[]);
 for(const bad of [[],[' '],[1],{},Array(9).fill('Deep'),['x'.repeat(81)]]){
  assert.throws(()=>csvCategoryMaster(csv([bad])));
  assert.equal(categoryMasterInput.safeParse([{category_path:bad}]).success,false);
 }
 for(const bad of ['name\nRoot','category_path_json,category_path_json\n"[]","[]"','category_path_json\nnot-json','category_path_json\n"[""Root""]",extra'])assert.throws(()=>csvCategoryMaster(bad));
 assert.throws(()=>csvCategoryMaster(csv(Array(501).fill(['Root']))));
 assert.equal(csvCategoryMaster(csv(Array(500).fill(['Root']))).length,500);
 for(const name of ['\u6f22'.repeat(80),'\u0001'.repeat(80)]){const largest=csv(Array(500).fill(Array(8).fill(name))),largestParsed=csvCategoryMaster(largest);assert.equal(largestParsed.length,500);assert.ok(Buffer.byteLength(largest)<2000000);assert.ok(Buffer.byteLength(JSON.stringify({items:largestParsed}))<2*1024*1024);}
 assert.equal(categoryMasterInput.safeParse([]).success,false);
 assert.equal(categoryMasterInput.safeParse([{category_path:['Root'],parent_id:randomUUID()}]).success,false);
 assert.deepEqual(categoryMasterInput.parse([{category_path:[' Root ']}]),[{category_path:['Root']}]);
});

test('PostgreSQL: category master copies unused hierarchies, reuses existing names, serializes imports and rolls back capacity failures',async()=>{
 const directory='.postgres/category-master-'+randomUUID(),password=randomUUID(),postgres=new EmbeddedPostgres({databaseDir:directory,user:'postgres',password,port:55454,persistent:true,autoRehydrateSymlinks:true,onLog:()=>{},onError:()=>{}});let pool:pg.Pool|undefined;
 try{
  await postgres.initialise();await postgres.start();pool=new pg.Pool({host:'127.0.0.1',port:55454,user:'postgres',password,database:'postgres'});const p=pool;
  for(const file of (await readdir('server/migrations')).filter(x=>x.endsWith('.sql')).sort())await p.query(await readFile('server/migrations/'+file,'utf8'));
  const tx=async<T>(fn:(db:pg.PoolClient)=>Promise<T>)=>{const db=await p.connect();try{await db.query('BEGIN');const result=await fn(db);await db.query('COMMIT');return result}catch(e){await db.query('ROLLBACK');throw e}finally{db.release()}};
  const source=randomUUID(),target=randomUUID(),cap=randomUUID(),concurrent=randomUUID(),user=randomUUID();
  await p.query("INSERT INTO branches(id,name) VALUES($1,'Source'),($2,'Target'),($3,'Capacity'),($4,'Concurrent')",[source,target,cap,concurrent]);
  await p.query("INSERT INTO users(id,branch_id,name,username,password_hash,role) VALUES($1,$2,'Owner','category-owner','fixture','OWNER')",[user,source]);
  const a:Actor={id:user,branch_id:source,name:'Owner',role:'OWNER'},b={...a,branch_id:target},c={...a,branch_id:cap},d={...a,branch_id:concurrent};
  assert.equal(await tx(db=>exportCategoryMaster(db,b)),'category_path_json');
  const root='=Root / "quoted"',child='Child, with comma',leaf='Line\nbreak',deep=Array.from({length:8},(_,index)=>'Level '+(index+1));
  const result=await tx(db=>importCategoryMaster(db,a,categoryMasterInput.parse([{category_path:[root,child,leaf]},{category_path:deep},{category_path:['Unused root']}])));
  assert.deepEqual(result,{paths:3,created:12});
  const exported=await tx(async db=>{await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');return exportCategoryMaster(db,a)}),parsed=csvCategoryMaster(exported);
  assert.equal(parsed.length,12);assert.ok(parsed.some(row=>JSON.stringify(row.category_path)===JSON.stringify([root,child,leaf])));assert.ok(parsed.some(row=>row.category_path[0]==='Unused root'));
  assert.ok(parseCsv(exported).slice(1).every(row=>row[0].startsWith('[')));
  const targetRoot=await tx(db=>saveCategory(db,b,null,{name:root.toLowerCase(),parent_id:null}));
  const medicine=randomUUID();await p.query("INSERT INTO medicines(id,branch_id,sku,barcode,name,generic,strength,form,base_unit,category_id) VALUES($1,$2,'UNCHANGED','UNCHANGED','Unchanged','Ingredient','1mg','Tablet','Tablet',$3)",[medicine,target,targetRoot]);
  const before=(await p.query('SELECT * FROM medicines WHERE id=$1',[medicine])).rows[0];
  assert.deepEqual(await tx(db=>importCategoryMaster(db,b,categoryMasterInput.parse(parsed))),{paths:12,created:11});
  const original=await tx(db=>listCategories(db,a)),copied=await tx(db=>listCategories(db,b));
  assert.equal(copied.length,12);assert.ok(copied.every(node=>!original.some(sourceNode=>sourceNode.id===node.id)));
  assert.equal(copied.find(node=>node.id===targetRoot)?.name,root.toLowerCase());assert.equal(copied.find(node=>node.name===child)?.parent_id,targetRoot);
  assert.deepEqual((await p.query('SELECT * FROM medicines WHERE id=$1',[medicine])).rows[0],before);
  assert.deepEqual(await tx(db=>importCategoryMaster(db,b,categoryMasterInput.parse([...parsed,parsed[0]]))),{paths:13,created:0});
  const parallel=await Promise.all([tx(db=>importCategoryMaster(db,d,[{category_path:['Concurrent','Child']}])),tx(db=>importCategoryMaster(db,d,[{category_path:['Concurrent','Child']}]))]);
  assert.deepEqual(parallel.map(value=>value.created).sort(),[0,2]);assert.equal((await tx(db=>listCategories(db,d))).length,2);
  await p.query("INSERT INTO medicine_categories(id,branch_id,name) SELECT md5('capacity-'||n::text)::uuid,$1,'Existing '||n FROM generate_series(1,499) n",[cap]);
  await assert.rejects(tx(db=>importCategoryMaster(db,c,[{category_path:['Would create']},{category_path:['Exceeds capacity']} ])),/500 categories/);
  assert.equal((await tx(db=>listCategories(db,c))).length,499);
  assert.equal((await p.query('SELECT count(*) n FROM audit_events WHERE branch_id=$1',[cap])).rows[0].n,'0');
  assert.deepEqual(await tx(db=>importCategoryMaster(db,c,[{category_path:['Final slot']} ])),{paths:1,created:1});
  assert.deepEqual(await tx(db=>importCategoryMaster(db,c,[{category_path:['Final slot']} ])),{paths:1,created:0});
  assert.equal((await tx(db=>listCategories(db,c))).length,500);
  for(const table of ['batches','movements','sales','supplier_entries'])assert.equal((await p.query('SELECT count(*) n FROM '+table)).rows[0].n,'0');
  const audits=(await p.query("SELECT action,details FROM audit_events WHERE action IN ('CATEGORY_MASTER_IMPORTED','CATEGORY_MASTER_EXPORTED')")).rows;
  assert.ok(audits.every(row=>row.details.format==='NAME_SEGMENTS_JSON'&&row.details.scope==='ALL_CATEGORIES'));
  assert.equal(audits.filter(row=>row.action==='CATEGORY_MASTER_IMPORTED').length,7);
 }finally{if(pool)await pool.end();await stopPostgres(postgres,directory)}
});
