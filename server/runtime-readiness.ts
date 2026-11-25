import {Router} from 'express';
import {existsSync} from 'node:fs';
import {pool} from './db';
import {localStore} from './local-store';
import {requireSuper} from './expansion-routes';
export function runtimeReadiness(){const r=Router();r.get('/readiness',requireSuper,async(_req,res)=>{const migrations=(await pool.query('SELECT version FROM schema_migrations ORDER BY version')).rows.map(r=>r.version);const backup=(await pool.query("SELECT status,started_at,verified_at FROM backup_runs WHERE status='SUCCEEDED' ORDER BY started_at DESC LIMIT 1")).rows[0]||null;const backlog=localStore().sales().filter(s=>s.status!=='SYNCED').length;res.json({migrations,backup,local_backlog:backlog,backup_key_configured:/^[a-fA-F0-9]{64}$/.test(process.env.BACKUP_KEY||''),off_device_declared:process.env.BACKUP_OFF_DEVICE==='true',dump_utility_configured:!!process.env.PG_DUMP_PATH&&existsSync(process.env.PG_DUMP_PATH),restore_utility_configured:!!process.env.PG_RESTORE_PATH&&existsSync(process.env.PG_RESTORE_PATH),hardware_acceptance:'PENDING',production_approval:'PENDING_EXTERNAL_ACCEPTANCE'})});return r}
