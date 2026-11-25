import {randomUUID} from 'node:crypto';
import type pg from 'pg';
import {z} from 'zod';
import {medicineInput} from './schemas';
import {Actor,audit} from './services';
import {BusinessError} from './domain';
import {listCategories,saveCategory} from './categories';

export const catalogImportRow=medicineInput.and(z.object({category_path:z.array(z.string().trim().min(1).max(80)).max(8).optional()}));
export const catalogImportInput=z.array(catalogImportRow).min(1).max(100);
export async function importCatalog(db:pg.PoolClient,a:Actor,records:z.infer<typeof catalogImportInput>){
 const sku=new Set<string>(),barcode=new Set<string>();
 for(const [index,m] of records.entries()){if(sku.has(m.sku)||barcode.has(m.barcode))throw new BusinessError(`Row ${index+2}: duplicate SKU or barcode in import.`);sku.add(m.sku);barcode.add(m.barcode);if((await db.query('SELECT id FROM medicines WHERE branch_id=$1 AND (sku=$2 OR barcode=$3)',[a.branch_id,m.sku,m.barcode])).rowCount)throw new BusinessError(`Row ${index+2}: SKU or barcode already exists. No records were imported.`,409)}
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['categories:'+a.branch_id]);
 for(const m of records){let parent:string|null=null;for(const name of m.category_path||[]){const existing:{id:string}|undefined=(await db.query('SELECT id FROM medicine_categories WHERE branch_id=$1 AND parent_id IS NOT DISTINCT FROM $2::uuid AND lower(name)=lower($3)',[a.branch_id,parent,name])).rows[0];parent=existing?.id||await saveCategory(db,a,null,{name,parent_id:parent})}
  const id=randomUUID();await db.query('INSERT INTO medicines(id,branch_id,sku,barcode,name,generic,strength,form,manufacturer,aliases,base_unit,reorder_level,restricted,category_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[id,a.branch_id,m.sku,m.barcode,m.name,m.generic,m.strength,m.form,m.manufacturer,m.aliases,m.base_unit,m.reorder_level,m.restricted,parent]);for(const u of m.units)await db.query('INSERT INTO units(id,medicine_id,name,factor,price_paisa) VALUES($1,$2,$3,$4,$5)',[randomUUID(),id,u.name,u.factor,u.price_paisa]);await audit(db,a,'MEDICINE_IMPORTED',id,{...m,category_id:parent,category_path:m.category_path||[]})
 }
 return{count:records.length};
}
export async function exportCatalog(db:pg.PoolClient,a:Actor){
 const categories=await listCategories(db,a),map=new Map(categories.map(c=>[c.id,c]));const rows=(await db.query("SELECT m.*,COALESCE((SELECT json_agg(json_build_object('name',u.name,'factor',u.factor,'price_paisa',u.price_paisa) ORDER BY factor) FROM units u WHERE u.medicine_id=m.id),'[]') units FROM medicines m WHERE branch_id=$1 ORDER BY m.name,m.id",[a.branch_id])).rows;
 const columns=['sku','barcode','name','generic','strength','form','base_unit','price_pkr','reorder_level','restricted','active','manufacturer','aliases','units_json','category_path_json'];const escape=(v:unknown)=>'"'+String(v??'').replace(/^[\s\uFEFF]*[=+@-]/,"'$&").replaceAll('"','""')+'"';const lines=rows.map(m=>{const values={...m,price_pkr:(Number(m.units.find((u:any)=>u.factor===1)?.price_paisa||0)/100).toFixed(2),units_json:JSON.stringify(m.units),category_path_json:JSON.stringify(m.category_id?map.get(m.category_id)!.segments:[])};return columns.map(c=>escape(values[c])).join(',')});await audit(db,a,'CATALOG_EXPORTED',a.branch_id,{rows:rows.length,category_format:'NAME_SEGMENTS_JSON',category_scope:'ASSIGNED_PATHS'});return[columns.join(','),...lines].join('\r\n');
}
