import {assertLocalRequest} from './http-security';
import {Router,RequestHandler,Response} from 'express';
import bcrypt from 'bcryptjs';
import {z} from 'zod';
import {pool,transaction} from './db';
import {BusinessError} from './domain';
import {Actor} from './services';
import {localStore} from './local-store';
import {offlineCart,offlineEvent} from './offline-domain';
import {authenticateDevice,finishDevice,prepareDevice,prepareInput,syncEvent} from './offline-service';
const localCookie=(value:string,clear=false)=>`offline_session=${value}; HttpOnly; SameSite=Strict; Path=/api/local; Max-Age=${clear?0:1800}${process.env.COOKIE_SECURE==='true'?'; Secure':''}`;
const cookie=(raw:string|undefined)=>raw?.split(';').map(s=>s.trim()).find(s=>s.startsWith('offline_session='))?.slice(16)||'';
let syncing=false;
export async function synchronizeLocal(force=false){if(syncing)return{busy:true};syncing=true;let count=0;try{const store=localStore(),c=store.configuration();if(!c)return{count:0};for(const item of store.pending(force)){try{const result=await transaction(db=>syncEvent(db,c.snapshot.device_id,c.secret,item.event));store.acknowledge(item.event_id,result);count++}catch(e){store.retry(item.event_id,e instanceof BusinessError?e.message:'Server unavailable. The saved invoice will retry without posting twice.');break}}return{count}}finally{syncing=false}}
export function localRoutes(){const r=Router();
 r.use((req,_res,next)=>{assertLocalRequest(req);next()});
 r.get('/status',(_req,res)=>{const c=localStore().configuration();res.json({prepared:!!c,phase:c?localStore().state(c.snapshot.device_id).phase:null})});
 r.post('/unlock',async(req,res)=>{const pin=z.string().min(8).max(80).parse(req.body.pin);const store=localStore(),attempt=store.failures();if(attempt&&attempt.failures>=5&&attempt.until_at>Date.now())throw new BusinessError('Too many PIN attempts. Wait 15 minutes.',429);const c=store.configuration();if(!c)throw new BusinessError('Prepare this counter while online first.',409);const valid=await bcrypt.compare(pin,c.pin_hash);store.recordUnlock(valid);if(!valid)throw new BusinessError('Incorrect offline PIN.',403);res.setHeader('Set-Cookie',localCookie(store.newSession(c.snapshot.device_id)));res.json({ok:true})});
 r.use((req,res,next)=>{const token=cookie(req.headers.cookie);res.locals.offline=localStore().session(token,req.method!=='GET');if(req.method!=='GET')res.setHeader('Set-Cookie',localCookie(token));next()});
 r.post('/lock',(req,res)=>{localStore().lock(cookie(req.headers.cookie));res.setHeader('Set-Cookie',localCookie('',true));res.json({ok:true})});
 r.get('/state',(_req,res)=>{const c=res.locals.offline;res.json({snapshot:c.snapshot,state:localStore().state(c.snapshot.device_id),sales:localStore().sales()})});
 r.post('/quote',(req,res)=>res.json(localStore().quote(offlineCart.parse(req.body))));
 r.post('/sales',(req,res)=>res.status(201).json(localStore().post(offlineCart.parse(req.body))));
 r.post('/sync',async(_req,res)=>res.json(await synchronizeLocal(true)));
 r.post('/recover',async(_req,res)=>{const store=localStore(),c=store.configuration()!;const state=store.state(c.snapshot.device_id);if(state.phase!=='STAGED')throw new BusinessError('Only staged preparation needs recovery.');const found=await transaction(async db=>{if(!(await db.query('SELECT 1 FROM offline_devices WHERE id=$1',[c.snapshot.device_id])).rowCount)return false;const d=await authenticateDevice(db,c.snapshot.device_id,c.secret);if(d.status!=='ACTIVE')throw new BusinessError('The server preparation is not active.');return true});if(found)store.activate(c.snapshot.device_id);else store.finished();res.json({recovered:found})});
 r.post('/finish',async(_req,res)=>{const c=localStore().beginFinish();await transaction(db=>finishDevice(db,c.snapshot.device_id,c.secret));localStore().finished();res.json({ok:true})});
 return r;
}
export function offlineCentralRoutes(permit:(p:string)=>RequestHandler){const r=Router();
 r.post('/offline/prepare',permit('sales:write'),async(req,res)=>{const input=prepareInput.parse(req.body);const pin=z.string().min(8).max(80).parse(req.body.pin);const password=z.string().parse(req.body.password);const a=res.locals.actor as Actor;const user=(await pool.query('SELECT password_hash FROM users WHERE id=$1',[a.id])).rows[0];if(!await bcrypt.compare(password,user.password_hash))throw new BusinessError('Re-authentication failed.',403);const store=localStore();store.assertCanPrepare();const pin_hash=await bcrypt.hash(pin,12);const prepared=await transaction(async db=>{const p=await prepareDevice(db,a,input);store.stage({...p,pin_hash});return p});store.activate(prepared.snapshot.device_id);res.json({device_id:prepared.snapshot.device_id,expires_at:prepared.snapshot.expires_at})});
 r.get('/offline/devices',permit('reports'),async(_req,res)=>res.json((await pool.query("SELECT d.id,d.name,d.user_id,d.status,d.issued_at,d.expires_at,u.name cashier,COALESCE((SELECT sum(remaining) FROM offline_reservations r WHERE r.device_id=d.id),0) reserved_units FROM offline_devices d JOIN users u ON u.id=d.user_id WHERE d.branch_id=$1 ORDER BY d.issued_at DESC LIMIT 100",[res.locals.actor.branch_id])).rows));
 r.get('/offline/conflicts',permit('audit:read'),async(_req,res)=>res.json((await pool.query("SELECT s.*,d.name counter,u.name cashier FROM sync_events s JOIN offline_devices d ON d.id=s.device_id JOIN users u ON u.id=d.user_id WHERE d.branch_id=$1 AND s.status='CONFLICT' ORDER BY s.created_at DESC LIMIT 100",[res.locals.actor.branch_id])).rows));return r;
}
export function syncRoutes(){const r=Router();r.post('/events',async(req,res)=>{const secret=req.headers.authorization?.replace(/^Bearer /,'')||'';if(!/^[a-f0-9]{64}$/.test(secret))throw new BusinessError('Device authentication is required.',401);const input=z.object({device_id:z.string().uuid(),event:offlineEvent}).parse(req.body);res.json(await transaction(db=>syncEvent(db,input.device_id,secret,input.event)))});return r}
export function startOfflineSync(){const timer=setInterval(()=>void synchronizeLocal().catch(()=>{}),15000);timer.unref();return()=>clearInterval(timer)}
