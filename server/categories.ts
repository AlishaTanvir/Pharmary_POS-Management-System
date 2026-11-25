import {randomUUID} from 'node:crypto';
import type pg from 'pg';
import {Router,RequestHandler,Response} from 'express';
import {z} from 'zod';
import {Actor,audit} from './services';
import {BusinessError} from './domain';
import {pool,transaction} from './db';
export const categoryInput=z.object({name:z.string().trim().min(1).max(80),parent_id:z.string().uuid().nullable().default(null)});
export const categoryEditInput=categoryInput.extend({revision:z.number().int().min(1).max(2147483646),reason:z.string().trim().min(3).max(500)});
export const categoryAssignment=z.object({category_id:z.string().uuid().nullable(),revision:z.number().int().min(1).max(2147483646),reason:z.string().trim().min(3).max(500)});
export const categoryMasterInput=z.array(z.object({category_path:z.array(z.string().trim().min(1).max(80)).min(1).max(8)}).strict()).min(1).max(500);

export async function importCategoryMaster(db:pg.PoolClient,a:Actor,records:z.infer<typeof categoryMasterInput>){
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['categories:'+a.branch_id]);
 let created=0;
 for(const record of records){let parent:string|null=null;for(const name of record.category_path){
  const existing:{id:string}|undefined=(await db.query('SELECT id FROM medicine_categories WHERE branch_id=$1 AND parent_id IS NOT DISTINCT FROM $2::uuid AND lower(name)=lower($3)',[a.branch_id,parent,name])).rows[0];
  if(existing)parent=existing.id;else{parent=await saveCategory(db,a,null,{name,parent_id:parent});created++}
 }}
 const result={paths:records.length,created};
 await audit(db,a,'CATEGORY_MASTER_IMPORTED',a.branch_id,{...result,format:'NAME_SEGMENTS_JSON',scope:'ALL_CATEGORIES'});
 return result;
}
export async function exportCategoryMaster(db:pg.PoolClient,a:Actor){
 const rows=await listCategories(db,a);
 // A JSON array always starts with [, so category names cannot become spreadsheet formulas.
 const csv=['category_path_json',...rows.map(row=>'"'+JSON.stringify(row.segments).replaceAll('"','""')+'"')].join('\r\n');
 await audit(db,a,'CATEGORY_MASTER_EXPORTED',a.branch_id,{rows:rows.length,format:'NAME_SEGMENTS_JSON',scope:'ALL_CATEGORIES'});
 return csv;
}
type Category={id:string;name:string;parent_id:string|null;revision:number};
export function categoryTree(rows:Category[]){const map=new Map(rows.map(r=>[r.id,r]));const path=(id:string,seen=new Set<string>()):string[]=>{if(seen.has(id))throw new BusinessError('A category cannot be placed under itself or its descendants.',409);if(seen.size>=8)throw new BusinessError('Categories support at most eight levels.',409);seen.add(id);const row=map.get(id);if(!row)throw new BusinessError('Parent category not found in this branch.',404);return[...(row.parent_id?path(row.parent_id,seen):[]),row.name]};return rows.map(r=>{const segments=path(r.id);return{...r,path:segments.join(' / '),segments}}).sort((a,b)=>a.path.localeCompare(b.path)||a.id.localeCompare(b.id))}
export async function listCategories(db:pg.PoolClient,a:Actor){return categoryTree((await db.query('SELECT id,name,parent_id,revision FROM medicine_categories WHERE branch_id=$1',[a.branch_id])).rows)}
export async function saveCategory(db:pg.PoolClient,a:Actor,id:string|null,input:z.infer<typeof categoryInput>,revision?:number,reason?:string){await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['categories:'+a.branch_id]);const rows:Category[]=(await db.query('SELECT id,name,parent_id,revision FROM medicine_categories WHERE branch_id=$1',[a.branch_id])).rows,old=id?rows.find(r=>r.id===id):undefined;if(id&&!old)throw new BusinessError('Category not found in this branch.',404);if(old&&old.revision!==revision)throw new BusinessError('Category changed. Reload before editing again.',409);if(!old&&rows.length>=500)throw new BusinessError('This branch already has 500 categories.');if(rows.some(r=>r.id!==id&&r.parent_id===input.parent_id&&r.name.toLowerCase()===input.name.toLowerCase()))throw new BusinessError('A category with this name already exists under that parent.',409);const next={id:id||randomUUID(),...input,revision:old?old.revision+1:1};categoryTree([...rows.filter(r=>r.id!==id),next]);if(old)await db.query('UPDATE medicine_categories SET name=$3,parent_id=$4,revision=revision+1 WHERE id=$1 AND branch_id=$2',[id,a.branch_id,input.name,input.parent_id]);else await db.query('INSERT INTO medicine_categories(id,branch_id,name,parent_id) VALUES($1,$2,$3,$4)',[next.id,a.branch_id,input.name,input.parent_id]);await audit(db,a,old?'CATEGORY_UPDATED':'CATEGORY_CREATED',next.id,{before:old||null,after:next,reason:reason||''});return next.id}
export async function assignCategory(db:pg.PoolClient,a:Actor,id:string,input:z.infer<typeof categoryAssignment>){const medicine=(await db.query('SELECT id,name,category_id,category_revision FROM medicines WHERE id=$1 AND branch_id=$2 FOR UPDATE',[id,a.branch_id])).rows[0];if(!medicine)throw new BusinessError('Medicine not found in this branch.',404);if(medicine.category_revision!==input.revision)throw new BusinessError('Medicine category changed. Reload before editing again.',409);if(input.category_id&&!(await db.query('SELECT 1 FROM medicine_categories WHERE id=$1 AND branch_id=$2',[input.category_id,a.branch_id])).rowCount)throw new BusinessError('Category not found in this branch.',404);await db.query('UPDATE medicines SET category_id=$3,category_revision=category_revision+1 WHERE id=$1 AND branch_id=$2',[id,a.branch_id,input.category_id]);await audit(db,a,'MEDICINE_CATEGORY_CHANGED',id,{before:medicine.category_id,after:input.category_id,revision:medicine.category_revision+1,reason:input.reason});return{ok:true}}
export function categoryRoutes(permit:(p:string)=>RequestHandler){const r=Router(),actor=(res:Response)=>res.locals.actor as Actor;r.post('/categories/import',permit('catalog:write'),async(req,res)=>{const records=categoryMasterInput.parse(req.body.items);res.status(201).json(await transaction(db=>importCategoryMaster(db,actor(res),records)))});r.post('/categories/export',permit('reports'),async(_req,res)=>res.json({csv:await transaction(async db=>{await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');return exportCategoryMaster(db,actor(res))})}));r.get('/categories',permit('catalog:read'),async(_req,res)=>res.json(await transaction(db=>listCategories(db,actor(res)))));r.post('/categories',permit('catalog:write'),async(req,res)=>res.status(201).json({id:await transaction(db=>saveCategory(db,actor(res),null,categoryInput.parse(req.body)))}));r.put('/categories/:id',permit('catalog:write'),async(req,res)=>{const i=categoryEditInput.parse(req.body);res.json({id:await transaction(db=>saveCategory(db,actor(res),z.string().uuid().parse(req.params.id),i,i.revision,i.reason))})});r.put('/medicines/:id/category',permit('catalog:write'),async(req,res)=>res.json(await transaction(db=>assignCategory(db,actor(res),z.string().uuid().parse(req.params.id),categoryAssignment.parse(req.body)))));return r}
