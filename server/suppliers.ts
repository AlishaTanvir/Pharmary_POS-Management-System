import {randomUUID} from 'node:crypto';
import type pg from 'pg';
import {Router,RequestHandler,Response} from 'express';
import {z} from 'zod';
import {Actor,audit} from './services';
import {BusinessError} from './domain';
import {pool,transaction} from './db';

export const supplierInput=z.object({name:z.string().trim().min(1).max(150),phone:z.string().trim().max(40).default(''),payment_terms_days:z.number().int().min(0).max(365).default(0),contact_name:z.string().trim().max(150).default(''),email:z.union([z.literal(''),z.string().trim().email().max(254)]).default(''),address:z.string().trim().max(500).default(''),registration_number:z.string().trim().max(100).default(''),tax_identifier:z.string().trim().max(100).default(''),notes:z.string().trim().max(1000).default('')});
export const supplierUpdateInput=supplierInput.extend({revision:z.number().int().min(1).max(2147483646),reason:z.string().trim().min(3).max(500)});
const fields=['name','phone','payment_terms_days','contact_name','email','address','registration_number','tax_identifier','notes'] as const;
export async function createSupplier(db:pg.PoolClient,a:Actor,input:z.infer<typeof supplierInput>){const id=randomUUID();await db.query('INSERT INTO suppliers(id,branch_id,name,phone,payment_terms_days,contact_name,email,address,registration_number,tax_identifier,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,a.branch_id,...fields.map(k=>input[k])]);await audit(db,a,'SUPPLIER_CREATED',id,input);return id}
export async function updateSupplier(db:pg.PoolClient,a:Actor,id:string,input:z.infer<typeof supplierUpdateInput>){const old=(await db.query('SELECT * FROM suppliers WHERE id=$1 AND branch_id=$2 FOR UPDATE',[id,a.branch_id])).rows[0];if(!old)throw new BusinessError('Supplier not found in this branch.',404);if(old.revision!==input.revision)throw new BusinessError('Supplier details changed. Reload the current record before editing again.',409);const updated=(await db.query('UPDATE suppliers SET name=$3,phone=$4,payment_terms_days=$5,contact_name=$6,email=$7,address=$8,registration_number=$9,tax_identifier=$10,notes=$11,revision=revision+1 WHERE id=$1 AND branch_id=$2 RETURNING *',[id,a.branch_id,...fields.map(k=>input[k])])).rows[0];await audit(db,a,'SUPPLIER_UPDATED',id,{reason:input.reason,before:old,after:updated,future_invoice_terms_only:true});return updated}
export async function listSuppliers(db:pg.PoolClient,a:Actor,query:string,offset:number){return(await db.query('SELECT * FROM suppliers WHERE branch_id=$1 AND (name ILIKE $2 OR phone ILIKE $2 OR contact_name ILIKE $2 OR email ILIKE $2 OR registration_number ILIKE $2 OR tax_identifier ILIKE $2) ORDER BY name,id LIMIT 25 OFFSET $3',[a.branch_id,'%'+query+'%',offset])).rows}
export function supplierRoutes(permit:(p:string)=>RequestHandler){const r=Router(),actor=(res:Response)=>res.locals.actor as Actor;
 r.get('/supplier-directory',permit('purchase:read'),async(req,res)=>{const query=z.string().max(150).parse(req.query.query||''),offset=z.coerce.number().int().min(0).max(10000000).parse(req.query.offset||0);res.json(await transaction(db=>listSuppliers(db,actor(res),query,offset)))});
 r.post('/suppliers',permit('purchase:write'),async(req,res)=>res.status(201).json({id:await transaction(db=>createSupplier(db,actor(res),supplierInput.parse(req.body)))}));
 r.put('/supplier-directory/:id',permit('purchase:write'),permit('inventory:approve'),async(req,res)=>res.json(await transaction(db=>updateSupplier(db,actor(res),z.string().uuid().parse(req.params.id),supplierUpdateInput.parse(req.body)))));
 return r;
}
