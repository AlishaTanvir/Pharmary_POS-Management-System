import type pg from 'pg';
import {Router,RequestHandler,Response} from 'express';
import {z} from 'zod';
import {Actor,audit,hash} from './services';
import {BusinessError} from './domain';
import {saleInput} from './schemas';
import {transaction} from './db';

export const onlineDraftState=z.object({
 cart:saleInput.omit({payments:true,approval_id:true}).extend({lines:z.array(saleInput.shape.lines.element).max(100)}).strict(),
 label:z.string().max(80),saved_cart_id:z.string().uuid().nullable()
}).strict();
export const onlineDraftWrite=z.object({revision:z.number().int().min(0).max(2147483645),state:onlineDraftState}).strict();
const revisionInput=z.object({revision:z.number().int().min(1).max(2147483646)});

async function locked(db:pg.PoolClient,a:Actor,id:string){
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['online-drafts-owner:'+a.branch_id+a.id]);
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['online-draft:'+id]);
 // Expired transient drafts are purged only within the authenticated owner/branch scope.
 await db.query("DELETE FROM online_cart_drafts WHERE branch_id=$1 AND cashier_id=$2 AND updated_at<now()-interval '24 hours'",[a.branch_id,a.id]);
 const row=(await db.query('SELECT * FROM online_cart_drafts WHERE id=$1 FOR UPDATE',[id])).rows[0];
 if(row&&(row.branch_id!==a.branch_id||row.cashier_id!==a.id))throw new BusinessError('Draft not found.',404);
 return row;
}
async function outcome(db:pg.PoolClient,a:Actor,state:z.infer<typeof onlineDraftState>){
 // Shares the checkout lock: a read cannot race an in-flight posting of this key.
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[a.branch_id+state.cart.idempotency_key]);
 const sale=(await db.query('SELECT id FROM sales WHERE branch_id=$1 AND actor_id=$2 AND idempotency_key=$3',[a.branch_id,a.id,state.cart.idempotency_key])).rows[0];
 if(sale)return{posted_sale_id:sale.id};
 const held=(await db.query('SELECT id FROM suspended_carts WHERE id=$1 AND branch_id=$2 AND cashier_id=$3',[state.cart.idempotency_key,a.branch_id,a.id])).rows[0];
 return held?{suspended_cart_id:held.id}:{};
}
export async function writeOnlineDraft(db:pg.PoolClient,a:Actor,id:string,input:z.infer<typeof onlineDraftWrite>){
 const old=await locked(db,a,id),digest=hash(input.state);
 if(old?.discarded)throw new BusinessError('This draft was cleared. Reload before continuing.',409);
 if(old&&old.request_hash===digest)return{revision:old.revision,...await outcome(db,a,input.state)};
 if((old?.revision||0)!==input.revision)throw new BusinessError('Another copy changed this draft. Keep this cart separately or reload to review the saved version.',409);
 // Also serialize the per-owner quota without taking any sale lock in the reverse order.
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['online-drafts-owner:'+a.branch_id+a.id]);
 if(!old&&Number((await db.query('SELECT count(*) n FROM online_cart_drafts WHERE branch_id=$1 AND cashier_id=$2 AND NOT discarded',[a.branch_id,a.id])).rows[0].n)>=20)throw new BusinessError('Too many active recovery drafts. Close or discard old drafts first.',409);
 const result=await outcome(db,a,input.state);
 if(Object.keys(result).length)return{revision:old?.revision||0,...result};
 const revision=(old?.revision||0)+1;
 await db.query('INSERT INTO online_cart_drafts(id,branch_id,cashier_id,revision,state,request_hash) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,state=excluded.state,request_hash=excluded.request_hash,updated_at=now()',[id,a.branch_id,a.id,revision,JSON.stringify(input.state),digest]);
 return{revision};
}
export async function readOnlineDraft(db:pg.PoolClient,a:Actor,id:string){
 const row=await locked(db,a,id);if(!row||row.discarded)return{draft:null};
 return{draft:{revision:row.revision,updated_at:row.updated_at,...await outcome(db,a,row.state),state:row.state}};
}
export async function clearOnlineDraft(db:pg.PoolClient,a:Actor,id:string,revision:number){
 const row=await locked(db,a,id);if(!row||row.discarded)return{ok:true};
 if(row.revision!==revision)throw new BusinessError('Another copy changed this draft. Reload before discarding it.',409);
 // A tombstone rejects a delayed autosave instead of resurrecting a cleared basket.
 await db.query("UPDATE online_cart_drafts SET discarded=true,state='{}',revision=revision+1,updated_at=now() WHERE id=$1",[id]);
 await audit(db,a,'ONLINE_DRAFT_CLEARED',id,{});return{ok:true};
}
export async function restoreOnlineDraft(db:pg.PoolClient,a:Actor,id:string,revision:number){
 const result=await readOnlineDraft(db,a,id),draft=result.draft;if(!draft)throw new BusinessError('Recovery draft expired or was cleared.',404);
 if(draft.revision!==revision)throw new BusinessError('Another copy changed this draft. Reload before recovering it.',409);
 if(draft.posted_sale_id||draft.suspended_cart_id)return result;
 const state=onlineDraftState.parse(draft.state),lines=[];
 for(const line of state.cart.lines){
  const medicine=(await db.query(`SELECT m.*,COALESCE((SELECT json_agg(u ORDER BY factor) FROM units u WHERE u.medicine_id=m.id),'[]') units,COALESCE((SELECT sum(GREATEST(0,b.quantity-COALESCE((SELECT sum(r.remaining) FROM offline_reservations r WHERE r.batch_id=b.id),0))) FROM batches b WHERE b.medicine_id=m.id AND b.branch_id=m.branch_id AND b.status='AVAILABLE' AND b.expiry>=(now() AT TIME ZONE 'Asia/Karachi')::date),0)::int available FROM medicines m WHERE m.id=$1 AND m.branch_id=$2 AND m.active`,[line.medicine_id,a.branch_id])).rows[0];
  const unit=medicine?.units.find((u:any)=>u.id===line.unit_id);
  if(!medicine||!unit)throw new BusinessError('A recovery item is inactive or its unit is unavailable. The draft is retained for review; discard it to start again.',409);
  lines.push({medicine,unit,quantity:line.quantity});
 }
 if(state.cart.customer_id&&!(await db.query('SELECT 1 FROM customers WHERE id=$1 AND branch_id=$2 AND active',[state.cart.customer_id,a.branch_id])).rowCount)throw new BusinessError('The recovery customer is unavailable. The draft is retained; discard it to start again.',409);
 await audit(db,a,'ONLINE_DRAFT_RECOVERED',id,{lines:lines.length,revision});
 return{draft,lines};
}
export function onlineDraftRoutes(permit:(permission:string)=>RequestHandler){
 const r=Router(),actor=(res:Response)=>res.locals.actor as Actor,id=(value:unknown)=>z.string().uuid().parse(value);
 r.get('/online-drafts/:id',permit('sales:write'),async(req,res)=>res.json(await transaction(db=>readOnlineDraft(db,actor(res),id(req.params.id)))));
 r.put('/online-drafts/:id',permit('sales:write'),async(req,res)=>res.json(await transaction(db=>writeOnlineDraft(db,actor(res),id(req.params.id),onlineDraftWrite.parse(req.body)))));
 r.post('/online-drafts/:id/restore',permit('sales:write'),async(req,res)=>res.json(await transaction(db=>restoreOnlineDraft(db,actor(res),id(req.params.id),revisionInput.parse(req.body).revision))));
 r.delete('/online-drafts/:id',permit('sales:write'),async(req,res)=>res.json(await transaction(db=>clearOnlineDraft(db,actor(res),id(req.params.id),revisionInput.parse(req.body).revision))));
 return r;
}
