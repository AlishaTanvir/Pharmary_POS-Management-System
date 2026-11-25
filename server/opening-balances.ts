import {randomUUID} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {Router,RequestHandler,Response} from 'express';
import type pg from 'pg';
import {z} from 'zod';
import {pool,transaction} from './db';
import {Actor,audit,hash} from './services';
import {BusinessError,integer,localDate} from './domain';
import {activeShift} from './production-services';
import {journal,Entry} from './finance';

export const openingDay=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'Invalid calendar date');
const id=z.string().uuid(),reference=z.string().trim().min(1).max(150),reason=z.string().trim().min(3).max(500);
export const openingInput=z.object({idempotency_key:id,kind:z.enum(['customer','supplier']),account_id:id,reference,posting_date:openingDay,due_date:openingDay,amount_paisa:z.number().int().min(-100000000000).max(100000000000).refine(v=>v!==0,'Opening amount cannot be zero'),reason});
export const openingSettlementInput=z.object({idempotency_key:id,posting_date:openingDay,amount_paisa:z.number().int().positive().max(100000000000),method:z.enum(['CASH','CARD','WALLET']),reference,reason});
export const openingCorrectionInput=z.object({idempotency_key:id,posting_date:openingDay,expected_remaining_paisa:z.number().int().min(-100000000000).max(100000000000).refine(v=>v!==0),reason});
type Kind='customer'|'supplier';
export function sortLedgerEntries<T extends {id:string;created_at:Date|string;effective_date?:string}>(entries:T[]){
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit',day:'2-digit'});
 return entries.sort((x,y)=>(x.effective_date||day.format(new Date(x.created_at))).localeCompare(y.effective_date||day.format(new Date(y.created_at)))||new Date(x.created_at).getTime()-new Date(y.created_at).getTime()||x.id.localeCompare(y.id));
}
function dated(day:string){if(day>localDate())throw new BusinessError('Posting date cannot be in the future.');}
export function openingDelta(remaining:number,amount:number){integer(Math.abs(remaining),'Remaining balance',1);integer(amount,'Settlement',1);if(amount>Math.abs(remaining))throw new BusinessError('Settlement exceeds the remaining opening balance.',409);return remaining>0?-amount:amount;}
async function prior(db:pg.PoolClient,a:Actor,table:string,key:string,intent:unknown){await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['opening:'+a.branch_id+':'+table+':'+key]);const old=(await db.query(`SELECT id,request_hash FROM ${table} WHERE branch_id=$1 AND idempotency_key=$2`,[a.branch_id,key])).rows[0];if(old&&old.request_hash!==hash(intent))throw new BusinessError('Opening key was already used for different details.',409);return old?.id as string|undefined;}
async function accountLock(db:pg.PoolClient,a:Actor,kind:Kind,account:string){const entity=(await db.query(`SELECT id FROM ${kind==='customer'?'customers':'suppliers'} WHERE id=$1 AND branch_id=$2 FOR UPDATE`,[account,a.branch_id])).rows[0];if(!entity)throw new BusinessError('Account not found.',404);}
function openingEntries(kind:Kind,delta:number,offset:string):Entry[]{const net=kind==='customer'?delta:-delta;return[{account_code:kind==='customer'?'1100':'2000',debit_paisa:Math.max(0,net),credit_paisa:Math.max(0,-net)},{account_code:offset,debit_paisa:Math.max(0,-net),credit_paisa:Math.max(0,net)}];}
export async function createOpening(db:pg.PoolClient,a:Actor,i:z.infer<typeof openingInput>){
 const old=await prior(db,a,'opening_balances',i.idempotency_key,i);if(old)return old;
 dated(i.posting_date);await activeShift(db,a,false);await accountLock(db,a,i.kind,i.account_id);
 if((await db.query('SELECT 1 FROM opening_balances WHERE branch_id=$1 AND kind=$2 AND account_id=$3 AND reference=$4',[a.branch_id,i.kind,i.account_id,i.reference])).rowCount)throw new BusinessError('This account already has an opening with that reference.',409);
 const opening=randomUUID();await db.query('INSERT INTO opening_balances(id,branch_id,kind,account_id,reference,posting_date,due_date,amount_paisa,reason,actor_id,idempotency_key,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[opening,a.branch_id,i.kind,i.account_id,i.reference,i.posting_date,i.due_date,i.amount_paisa,i.reason,a.id,i.idempotency_key,hash(i)]);
 await journal(db,a,{posting_date:i.posting_date,description:'Opening '+i.kind+': '+i.reference,source_type:'OPENING_BALANCE',source_id:opening,entries:openingEntries(i.kind,i.amount_paisa,'3000')});
 await audit(db,a,'OPENING_BALANCE_POSTED',opening,i);return opening;
}
export async function openingEvent(db:pg.PoolClient,a:Actor,opening:string,type:'SETTLEMENT'|'CORRECTION',i:z.infer<typeof openingSettlementInput>|z.infer<typeof openingCorrectionInput>){
 const intent={opening_id:opening,type,...i},old=await prior(db,a,'opening_balance_events',i.idempotency_key,intent);if(old)return old;
 dated(i.posting_date);const settlement=type==='SETTLEMENT'?openingSettlementInput.parse(i):null,correction=type==='CORRECTION'?openingCorrectionInput.parse(i):null;
 if(settlement?.method==='CASH'&&i.posting_date!==localDate())throw new BusinessError('Cash settlement must use today?s posting date.');
 const shift=await activeShift(db,a,settlement?.method==='CASH');
 const source=(await db.query('SELECT kind,account_id FROM opening_balances WHERE id=$1 AND branch_id=$2',[opening,a.branch_id])).rows[0];if(!source)throw new BusinessError('Opening balance not found.',404);
 await accountLock(db,a,source.kind,source.account_id);
 const o=(await db.query('SELECT * FROM opening_balances WHERE id=$1 AND branch_id=$2 FOR UPDATE',[opening,a.branch_id])).rows[0];
 const state=(await db.query('SELECT $2::bigint+COALESCE(sum(amount_paisa),0) remaining,GREATEST($3::date,COALESCE(max(posting_date),$3::date))::text last_date FROM opening_balance_events WHERE opening_id=$1',[opening,o.amount_paisa,o.posting_date])).rows[0];
 if(i.posting_date<state.last_date)throw new BusinessError('Posting date cannot precede the opening or its latest event.');
 if(correction&&correction.expected_remaining_paisa!==Number(state.remaining))throw new BusinessError('Opening balance changed. Refresh and review the remaining amount before correcting.',409);
 if(Number(state.remaining)===0)throw new BusinessError('Opening balance is already settled or corrected.',409);
 const delta=openingDelta(Number(state.remaining),settlement?.amount_paisa??Math.abs(Number(state.remaining))),event=randomUUID(),ref=settlement?.reference??o.reference,method=settlement?.method??null;
 await db.query('INSERT INTO opening_balance_events(id,opening_id,branch_id,type,amount_paisa,posting_date,method,shift_id,reference,reason,actor_id,idempotency_key,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[event,opening,a.branch_id,type,delta,i.posting_date,method,method==='CASH'?shift?.id:null,ref,i.reason,a.id,i.idempotency_key,hash(intent)]);
 const offset=type==='CORRECTION'?'3000':method==='CASH'?'1000':method==='CARD'?'1010':'1020';
 await journal(db,a,{posting_date:i.posting_date,description:'Opening '+type.toLowerCase()+': '+o.reference,source_type:'OPENING_EVENT',source_id:event,entries:openingEntries(o.kind,delta,offset)});
 await audit(db,a,'OPENING_'+type,event,{opening_id:opening,...i,delta_paisa:delta,remaining_paisa:Number(state.remaining)+delta});return event;
}

export async function openingLedger(db:pg.PoolClient,a:Actor,kind:Kind,account:string){
 const invoices=(await db.query("SELECT id,reference,created_at,posting_date::text posting_date,due_date::text due_date,amount_paisa total_paisa,outstanding_paisa,'OPENING' source_kind,reason FROM opening_balance_positions WHERE branch_id=$1 AND kind=$2 AND account_id=$3 ORDER BY posting_date,created_at,id",[a.branch_id,kind,account])).rows;
 const entries=(await db.query("SELECT id,'OPENING_BALANCE' type,amount_paisa,NULL::text method,reference,created_at,posting_date::text effective_date,reason FROM opening_balances WHERE branch_id=$1 AND kind=$2 AND account_id=$3 UNION ALL SELECT e.id,'OPENING_'||e.type type,e.amount_paisa,e.method,e.reference,e.created_at,e.posting_date::text effective_date,e.reason FROM opening_balance_events e JOIN opening_balances o ON o.id=e.opening_id WHERE o.branch_id=$1 AND o.kind=$2 AND o.account_id=$3 ORDER BY effective_date,created_at,id",[a.branch_id,kind,account])).rows;
 return{invoices,entries};
}
export async function openingReconciliation(db:pg.PoolClient,a:Actor,date:string){
 const rows=(await db.query(`SELECT o.kind,o.account_id,CASE WHEN o.kind='customer' THEN c.name ELSE s.name END name,sum(o.amount_paisa) original_paisa,sum(o.amount_paisa+COALESCE((SELECT sum(e.amount_paisa) FROM opening_balance_events e WHERE e.opening_id=o.id AND e.posting_date<=$2::date),0)) outstanding_paisa FROM opening_balances o LEFT JOIN customers c ON o.kind='customer' AND c.id=o.account_id LEFT JOIN suppliers s ON o.kind='supplier' AND s.id=o.account_id WHERE o.branch_id=$1 AND o.posting_date<=$2::date GROUP BY o.kind,o.account_id,c.name,s.name ORDER BY o.kind,name,o.account_id`,[a.branch_id,date])).rows;
 const controls=(await db.query(`WITH ordinary AS (SELECT 'customer' kind,COALESCE(sum(amount_paisa),0) amount FROM customer_entries WHERE branch_id=$1 AND (created_at AT TIME ZONE 'Asia/Karachi')::date<=$2::date UNION ALL SELECT 'supplier',COALESCE((SELECT sum(amount_paisa) FROM supplier_entries WHERE branch_id=$1 AND (created_at AT TIME ZONE 'Asia/Karachi')::date<=$2::date),0)-COALESCE((SELECT sum(amount_paisa) FROM supplier_payments WHERE branch_id=$1 AND (created_at AT TIME ZONE 'Asia/Karachi')::date<=$2::date),0)-COALESCE((SELECT sum(amount_paisa) FROM supplier_returns WHERE branch_id=$1 AND (created_at AT TIME ZONE 'Asia/Karachi')::date<=$2::date),0)) SELECT v.kind,v.code,v.sign*COALESCE((SELECT sum(l.debit_paisa-l.credit_paisa) FROM journal_lines l JOIN journals j ON j.id=l.journal_id WHERE j.branch_id=$1 AND j.posting_date<=$2::date AND l.account_code=v.code),0) gl_paisa,ordinary.amount operational_paisa,v.sign*COALESCE((SELECT sum(l.debit_paisa-l.credit_paisa) FROM journal_lines l JOIN journals j ON j.id=l.journal_id WHERE j.branch_id=$1 AND j.posting_date<=$2::date AND l.account_code=v.code AND j.source_type IN ('OPENING_BALANCE','OPENING_EVENT')),0) opening_gl_paisa FROM (VALUES('customer','1100',1),('supplier','2000',-1)) v(kind,code,sign) JOIN ordinary ON ordinary.kind=v.kind`,[a.branch_id,date])).rows.map(control=>{const opening=rows.filter(row=>row.kind===control.kind).reduce((sum,row)=>sum+Number(row.outstanding_paisa),0),subledger=Number(control.operational_paisa)+opening;return{...control,opening_paisa:opening,subledger_paisa:subledger,opening_difference_paisa:opening-Number(control.opening_gl_paisa),difference_paisa:subledger-Number(control.gl_paisa)};});
 return{as_of:date,rows,controls,notice:'Opening records post to the general ledger immediately. Ordinary operations still require explicit GL posting. Differences can include unposted operations and manual journals; investigate before signing off. Positive customer balances are receivables; positive supplier balances are payables. Negative balances are account credits. Dates are effective posting dates for openings and recorded local dates for operational movements. Current account names are shown.'};
}

export function openingRoutes(permit:(p:string)=>RequestHandler){const r=Router(),a=(res:Response)=>res.locals.actor as Actor;
 const confirm:RequestHandler=async(req,res,next)=>{const password=z.string().min(1).max(200).parse(req.body.password),user=(await pool.query('SELECT password_hash FROM users WHERE id=$1',[a(res).id])).rows[0];if(!user||!await bcrypt.compare(password,user.password_hash))throw new BusinessError('Re-authentication failed.',403);next();};
 r.get('/opening-balances/reconciliation',permit('ledger:read'),permit('finance:read'),async(req,res)=>{const date=openingDay.parse(req.query.as_of||localDate());dated(date);res.json(await transaction(async db=>{await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');return openingReconciliation(db,a(res),date);}));});
 r.post('/opening-balances',permit('ledger:write'),permit('finance:write'),confirm,async(req,res)=>res.status(201).json({id:await transaction(db=>createOpening(db,a(res),openingInput.parse(req.body)))}));
 r.post('/opening-balances/:id/settlements',permit('ledger:write'),confirm,async(req,res)=>res.status(201).json({id:await transaction(db=>openingEvent(db,a(res),id.parse(req.params.id),'SETTLEMENT',openingSettlementInput.parse(req.body)))}));
 r.post('/opening-balances/:id/correct',permit('ledger:write'),permit('finance:write'),confirm,async(req,res)=>res.status(201).json({id:await transaction(db=>openingEvent(db,a(res),id.parse(req.params.id),'CORRECTION',openingCorrectionInput.parse(req.body)))}));
 return r;
}
