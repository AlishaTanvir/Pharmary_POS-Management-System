import {Router,RequestHandler,Response} from 'express';
import {randomUUID,createHash} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {z} from 'zod';
import type pg from 'pg';
import {pool,transaction} from './db';
import {Actor,audit} from './services';
import {BusinessError} from './domain';
import {requireSuper} from './expansion-routes';
import {pilotSnapshot} from './pilot';
import {fieldInput,fieldSummary} from './field-domain';
export async function fieldSnapshot(db:pg.PoolClient,a:Actor){const events=(await db.query('SELECT e.* FROM field_acceptance_events e WHERE e.branch_id=$1 ORDER BY e.sequence DESC',[a.branch_id])).rows;return{schema:'pharmacy-field-acceptance/v1',branch_id:a.branch_id,branch:(await db.query('SELECT name FROM branches WHERE id=$1',[a.branch_id])).rows[0],generated_at:new Date().toISOString(),pilot:await pilotSnapshot(a,db),...fieldSummary(events),events};}
export async function recordField(db:pg.PoolClient,a:Actor,i:z.infer<typeof fieldInput>){const hash=createHash('sha256').update(JSON.stringify({actor:a.id,...i,metrics:Object.fromEntries(Object.entries(i.metrics).sort(([a],[b])=>a.localeCompare(b)))})).digest('hex');const id=randomUUID();const inserted=await db.query('INSERT INTO field_acceptance_events(id,branch_id,actor_id,idempotency_key,request_hash,drill_key,status,evidence,observed_by,observed_at,environment,release_version,metrics,recorder_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT(branch_id,idempotency_key) DO NOTHING RETURNING id',[id,a.branch_id,a.id,i.idempotency_key,hash,i.drill_key,i.status,i.evidence,i.observed_by,i.observed_at||null,i.environment,i.release_version,JSON.stringify(i.metrics),a.name]);if(!inserted.rowCount){const old=(await db.query('SELECT id,request_hash FROM field_acceptance_events WHERE branch_id=$1 AND idempotency_key=$2',[a.branch_id,i.idempotency_key])).rows[0];if(old.request_hash!==hash)throw new BusinessError('This retry key belongs to different field evidence.',409);return{id:old.id,duplicate:true};}await audit(db,a,'FIELD_ACCEPTANCE_RECORDED',id,i);return{id,duplicate:false};}
export function fieldRoutes(permit:(p:string)=>RequestHandler){const r=Router(),actor=(res:Response)=>res.locals.actor as Actor;r.use('/pilot/field',requireSuper);
 r.get('/pilot/field',async(_req,res)=>res.json(await transaction(async db=>{await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');return fieldSnapshot(db,actor(res));})));
 r.post('/pilot/field/events',permit('*'),async(req,res)=>{const a=actor(res),input=fieldInput.parse(req.body),password=z.string().max(200).parse(req.body.password),user=(await pool.query('SELECT password_hash FROM users WHERE id=$1',[a.id])).rows[0];if(!await bcrypt.compare(password,user.password_hash))throw new BusinessError('Re-authentication failed.',403);res.status(201).json(await transaction(db=>recordField(db,a,input)));});
 r.post('/pilot/field/export',async(_req,res)=>{const a=actor(res),result=await transaction(async db=>{await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');const snapshot=await fieldSnapshot(db,a),json=JSON.stringify(snapshot,null,2),sha256=createHash('sha256').update(json).digest('hex');await audit(db,a,'FIELD_HANDOFF_EXPORTED',a.branch_id,{events:snapshot.events.length,sha256});return{filename:'field-handoff-'+a.branch_id+'.json',json,sha256};});res.json(result);});return r;
}
