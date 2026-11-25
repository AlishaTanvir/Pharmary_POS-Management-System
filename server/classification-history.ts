import type pg from 'pg';
import {categoryTree} from './categories';
import {BusinessError} from './domain';
export async function classificationCutoff(db:pg.PoolClient,to:string,requested?:string){
 const now=(await db.query("SELECT date_trunc('milliseconds',clock_timestamp()) instant")).rows[0].instant as Date;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);if(to>today)throw new BusinessError('As-of reports cannot use a future through-date.');
 const end=new Date(to+'T23:59:59.999+05:00');
 if(requested){const cutoff=new Date(requested),localDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit',day:'2-digit'}).format(cutoff);if(localDay!==to||cutoff>now||cutoff>end)throw new BusinessError('The classification instant must be on the report through-date in Pakistan and no later than now.');return cutoff.toISOString();}
 return new Date(Math.min(end.getTime(),now.getTime())).toISOString();
}
export async function classificationSnapshot(db:pg.PoolClient,branch:string,cutoff:string){
 const started=(await db.query('SELECT started_at FROM classification_capture')).rows[0]?.started_at as Date|undefined;
 if(!started)throw new BusinessError('Classification capture baseline is missing.',409);
 const histories=[];for(const query of [
  ['SELECT DISTINCT ON(category_id) category_id id,name,parent_id,revision,event_type,recorded_at,seq FROM category_classification_history WHERE branch_id=$1 AND recorded_at<=$2::timestamptz ORDER BY category_id,recorded_at DESC,seq DESC',[branch,cutoff]],
  ['SELECT DISTINCT ON(medicine_id) * FROM medicine_classification_history WHERE branch_id=$1 AND recorded_at<=$2::timestamptz ORDER BY medicine_id,recorded_at DESC,seq DESC',[branch,cutoff]],
  ['SELECT DISTINCT ON(medicine_id) medicine_id,event_type FROM medicine_classification_history WHERE branch_id=$1 ORDER BY medicine_id,recorded_at,seq',[branch]],
  ['SELECT DISTINCT ON(batch_id) *,expiry::text expiry FROM batch_lifecycle_history WHERE branch_id=$1 AND recorded_at<=$2::timestamptz ORDER BY batch_id,recorded_at DESC,seq DESC',[branch,cutoff]],
  ['SELECT DISTINCT ON(batch_id) batch_id,medicine_id,event_type FROM batch_lifecycle_history WHERE branch_id=$1 ORDER BY batch_id,recorded_at,seq',[branch]]
] as const)histories.push(await db.query(query[0],[...query[1]]));
 const tree=categoryTree(histories[0].rows.filter(r=>r.event_type!=='DELETE')),categoryMap=new Map(tree.map(c=>[c.id,c])),medLatest=new Map(histories[1].rows.map(r=>[r.medicine_id,r])),batchLatest=new Map(histories[3].rows.map(r=>[r.batch_id,r]));
 const medicines=histories[2].rows.flatMap(first=>{const row=medLatest.get(first.medicine_id);if(row?.event_type==='DELETE'||(!row&&first.event_type==='INSERT'))return[];const category=row?.category_id?categoryMap.get(row.category_id):null,state=!row||(row.category_id&&!category)?'UNKNOWN':row.category_id?'CAPTURED':'UNCATEGORIZED';return[{id:first.medicine_id,name:row?.name||'Unknown medicine ['+first.medicine_id+']',generic:row?.generic||'',form:row?.form||'',active:row?.active??null,reorder_level:row?.reorder_level??null,category_id:row?.category_id||null,classification_state:state,category_path:state==='UNKNOWN'?'Unknown before capture':category?.path||'Uncategorized',recorded_at:row?.recorded_at?.toISOString()||null,history_seq:row?.seq||null}];});
 const batches=histories[4].rows.flatMap(first=>{const row=batchLatest.get(first.batch_id);if(row?.event_type==='DELETE'||(!row&&first.event_type==='INSERT'))return[];return[{id:first.batch_id,medicine_id:first.medicine_id,status:row?.status||'UNKNOWN',expiry:row?.expiry||null,recorded_at:row?.recorded_at?.toISOString()||null,history_seq:row?.seq||null}];});
 return{tree,medicines,batches,capture_started_at:started.toISOString(),classification_at:cutoff,before_capture:cutoff<started.toISOString(),basis:'OBSERVED_AS_OF',time_semantics:'Database transaction timestamps, millisecond precision; not exact commit visibility or inferred external effective dates.'};
}
