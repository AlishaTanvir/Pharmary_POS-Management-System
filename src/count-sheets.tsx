import React,{useEffect,useState} from 'react';
type API=(path:string,method?:string,body?:unknown)=>Promise<any>;
async function printBlindSheet(api:API,id:string){
 const w=window.open('','_blank');if(!w)throw Error('Allow the count-sheet print window.');w.opener=null;
 try{const sheet=await api('/count-sheets/'+id+'/print','POST',{});w.document.title='Blind count - '+sheet.name;const style=w.document.createElement('style');style.textContent='@page{size:A4 landscape;margin:12mm}body{font:12px sans-serif}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:9px;text-align:left}tr{break-inside:avoid}thead{display:table-header-group}';w.document.head.append(style);for(const text of [sheet.name,'Sheet reference: '+sheet.id,'Count physical base units. Expected quantities are intentionally omitted. Stock activity can invalidate this snapshot; separate approval is required.']){const p=w.document.createElement('p');p.textContent=text;w.document.body.append(p)}const table=w.document.createElement('table'),head=table.createTHead().insertRow();for(const name of ['Medicine / form / category','Batch / expiry','Location / status','Base unit','Physical count','Reason / initials']){const th=w.document.createElement('th');th.textContent=name;head.append(th)}const body=table.createTBody();for(const l of sheet.lines){const row=body.insertRow();for(const text of [l.medicine_name+' / '+l.form+' / '+(l.category_path??'Category not captured'),l.batch_code+' / '+l.expiry,l.location+' / '+l.status,l.base_unit,'____________','________________'])row.insertCell().textContent=text}w.document.body.append(table);w.focus();w.print()}catch(e){w.close();throw e}
}
export function CountSheets({api,user,onChanged}:{api:API;user:{id:string;role:string};onChanged:()=>Promise<void>}){
 const[options,setOptions]=useState<any>({locations:[],forms:[],categories:[]});
 const[filters,setFilters]=useState({name:'',location:'',form:'',product:'',category:''});
 const[key,setKey]=useState(crypto.randomUUID()),[items,setItems]=useState<any[]>([]),[offset,setOffset]=useState(0),[selected,setSelected]=useState(''),[sheet,setSheet]=useState<any>(null),[review,setReview]=useState(false),[drafts,setDrafts]=useState<Record<string,{quantity:string;reason:string}>>({}),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const list=async()=>setItems(await api('/count-sheets?offset='+offset));
 const detail=async(id:string)=>{setSheet(await api('/count-sheets/'+id));setSelected(id)};
 useEffect(()=>{api('/count-sheets/options').then(setOptions).catch(e=>setError(e.message))},[]);
 useEffect(()=>{void list().catch(e=>setError(e.message))},[offset]);
 const set=(name:string,value:string)=>{setFilters({...filters,[name]:value});setKey(crypto.randomUUID())};
 async function run(work:()=>Promise<void>){if(busy)return;setBusy(true);setError('');setNotice('');try{await work()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <section className="panel panel-body count-sheets">
  <h2>Blind count sheets</h2>
  <p>Create a fixed batch snapshot by category, shelf/location, medicine form or product. Parent categories include descendants. Counters enter physical base-unit quantities without book quantities on this sheet. No stock is reserved or changed until a different person approves.</p>
  {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="success" role="status">{notice}</p>}
  <form className="form-grid" onSubmit={e=>{e.preventDefault();void run(async()=>{const result=await api('/count-sheets','POST',{...filters,idempotency_key:key});await list();await detail(result.id);setReview(false);setKey(crypto.randomUUID());setNotice('Count sheet created. Enter physical quantities before supervisor review.')})}}>
   <label>Sheet name<input required minLength={3} maxLength={120} value={filters.name} onChange={e=>set('name',e.target.value)}/></label>
   <label>Product filter<input maxLength={150} value={filters.product} onChange={e=>set('product',e.target.value)} placeholder="Name, SKU or barcode"/></label>
   <div><label htmlFor="count-location">Shelf / location</label><select id="count-location" value={filters.location} onChange={e=>set('location',e.target.value)}><option value="">All locations</option>{options.locations.map((s:string)=><option key={s} value={s}>{s}</option>)}</select></div>
   <div><label htmlFor="count-form">Medicine form</label><select id="count-form" value={filters.form} onChange={e=>set('form',e.target.value)}><option value="">All forms</option>{options.forms.map((s:string)=><option key={s} value={s}>{s}</option>)}</select></div>
   <div><label htmlFor="count-category">Count category</label><select id="count-category" value={filters.category} onChange={e=>set('category',e.target.value)}><option value="">All categories</option><option value="UNCATEGORIZED">Uncategorized</option>{options.categories.map((c:any)=><option key={c.id} value={c.id}>{c.path}</option>)}</select></div><button type="button" className="button secondary" disabled={busy} onClick={()=>run(async()=>{setOptions(await api('/count-sheets/options'));setNotice('Count filters refreshed.')})}>Refresh count filters</button><button className="button" disabled={busy}>Create blind count sheet</button>
  </form>
  <div className="toolbar">
   <div><label htmlFor="count-sheet-select">Saved count sheet</label><select id="count-sheet-select" value={selected} onChange={e=>{const id=e.target.value;setReview(false);if(id)void run(()=>detail(id));else{setSelected('');setSheet(null)}}}><option value="">Choose sheet</option>{items.map(s=><option key={s.id} value={s.id}>{s.name} / {s.submitted} of {s.lines} submitted</option>)}</select></div>
   <button className="button secondary" disabled={busy||offset===0} onClick={()=>setOffset(Math.max(0,offset-25))}>Previous sheets</button>
   <button className="button secondary" disabled={busy||items.length<25} onClick={()=>setOffset(offset+25)}>Next sheets</button>
   {selected&&<button className="button secondary" disabled={busy} onClick={()=>run(()=>detail(selected))}>Refresh sheet</button>}
   {selected&&<button className="button secondary" disabled={busy} onClick={()=>run(()=>printBlindSheet(api,selected))}>Print blind count sheet</button>}
  </div>
  {sheet&&<>
   <h3>{sheet.name}</h3><p>Category scope: {sheet.filters.category_path||'All categories'}{sheet.filters.includes_descendants?' (including descendants)':''}</p><p className="note">{sheet.notice}</p>
   {sheet.reviewer&&<><label className="check"><input type="checkbox" checked={review} onChange={e=>setReview(e.target.checked)}/> Show supervisor comparison</label>{review&&<label>Your password to approve sheet counts<input type="password" autoComplete="off" value={password} onChange={e=>setPassword(e.target.value)}/></label>}</>}
   <div className="scroll"><table><thead><tr><th>MEDICINE / BATCH</th><th>LOCATION / SNAPSHOT STATUS</th>{review&&sheet.reviewer&&<th>SNAPSHOT / VARIANCE</th>}<th>COUNT / APPROVAL</th></tr></thead><tbody>
    {sheet.lines.map((line:any)=>{
     const draft=drafts[line.id]||{quantity:'',reason:''};
     const update=(field:'quantity'|'reason',value:string)=>setDrafts({...drafts,[line.id]:{...draft,[field]:value}});
     return <tr key={line.id}><td><strong>{line.medicine_name}</strong><small>{line.batch_code} / expiry {line.expiry}</small><small>Base unit: {line.base_unit} / {line.form}</small><small>Category at snapshot: {line.category_path??'Not captured on this older sheet'}</small></td><td>{line.location}<small>{line.status}</small>{line.offline_reserved&&<span className="badge amber">Finish offline reservations first</span>}{line.stale&&<span className="badge amber">Stale snapshot - create a fresh sheet</span>}</td>
      {review&&sheet.reviewer&&<td>{line.snapshot_quantity}<small>Variance: {line.variance??'Not submitted'}</small>{line.owner_required&&<span className="badge amber">Owner approval required</span>}</td>}
      <td>{line.count_id?<><strong>Counted: {line.counted_quantity}</strong><small>{line.reason}</small>{line.approval_id?<span className="badge">Approved</span>:review&&sheet.reviewer&&line.submitted_by!==user.id?<button className="button secondary" disabled={busy||line.stale||line.offline_reserved||!password||(line.owner_required&&user.role!=='OWNER')} onClick={()=>{const secret=password;setPassword('');void run(async()=>{await api('/stock-counts/'+line.count_id+'/approve','POST',{password:secret});await detail(selected);await onChanged();setNotice('Count approved. Stock movement and audit are recorded.')})}}>Approve sheet count</button>:<small>Awaiting a different authorized approver</small>}</>:<form onSubmit={e=>{e.preventDefault();void run(async()=>{await api('/count-sheets/lines/'+line.id,'POST',{counted_quantity:Number(draft.quantity),reason:draft.reason});await detail(selected);await onChanged();setNotice('Physical count submitted; a different person must approve it.')})}}>
       <label htmlFor={'physical-'+line.id}>Physical quantity (base units)</label><input id={'physical-'+line.id} required type="number" min="0" max="1000000000" step="1" value={draft.quantity} onChange={e=>update('quantity',e.target.value)}/>
       <label htmlFor={'count-reason-'+line.id}>Count reason</label><input id={'count-reason-'+line.id} required minLength={3} maxLength={500} value={draft.reason} onChange={e=>update('reason',e.target.value)}/>
       <button className="button secondary" disabled={busy||line.stale||line.offline_reserved}>Submit physical count</button>
      </form>}</td></tr>
    })}
   </tbody></table></div>
  </>}
 </section>
}
