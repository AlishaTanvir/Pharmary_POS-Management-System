import React,{useEffect,useRef,useState} from 'react';
type API=(path:string,method?:string,body?:unknown)=>Promise<any>;
type State={cart:{idempotency_key:string;lines:{medicine_id:string;unit_id:string;quantity:number}[];discount_paisa:number;customer_id:string|null;notes:string;prescription_ref?:string};label:string;saved_cart_id:string|null};
type Context={id:string;storageKey:string;revision:number;last:string;ready:boolean;waiting:boolean;disabled:boolean;latest:string;work:Promise<void>|null};
export const meaningfulDraft=(state:State)=>!!(state.cart.lines.length||state.cart.notes||state.cart.prescription_ref||state.cart.customer_id||state.cart.discount_paisa||state.label||state.saved_cart_id);

export function useOnlineDraft({api,user,state,onRestore,onClear}:{api:API;user:{id:string;branch_id:string;role:string}|null;state:State;onRestore:(data:any)=>void;onClear:()=>void}){
 const context=useRef<Context|null>(null),snapshot=JSON.stringify(state),[pending,setPending]=useState<any>(null),[status,setStatus]=useState(''),[loading,setLoading]=useState(false),[problem,setProblem]=useState(''),[version,setVersion]=useState(0),[checkVersion,setCheckVersion]=useState(0);
 const eligible=!!user&&['OWNER','MANAGER','PHARMACIST','CASHIER'].includes(user.role);
 if(context.current)context.current.latest=snapshot;
 const current=(c:Context)=>context.current===c;
 function rotate(c:Context){c.id=crypto.randomUUID();c.revision=0;c.last='';sessionStorage.setItem(c.storageKey,c.id)}
 useEffect(()=>{
  if(!eligible||!user){context.current=null;setPending(null);setLoading(false);setStatus('');setProblem('');return}
  const c:Context={id:'',storageKey:`pharmacy-online-draft:v1:${user.id}:${user.branch_id}`,revision:0,last:'',ready:false,waiting:true,disabled:false,latest:snapshot,work:null};context.current=c;
  setLoading(true);setPending(null);setProblem('');
  try{const stored=sessionStorage.getItem(c.storageKey);c.id=stored&&/^[0-9a-f-]{36}$/i.test(stored)?stored:crypto.randomUUID();sessionStorage.setItem(c.storageKey,c.id)}catch{c.disabled=true;c.ready=true;c.waiting=false;setLoading(false);setProblem('Automatic recovery is unavailable because this browser blocks session storage. Use Suspend cart before leaving.');return}
  void api('/online-drafts/'+c.id).then(result=>{if(!current(c))return;c.revision=result.draft?.revision||0;c.ready=true;
   if(result.draft){c.waiting=true;setPending(result.draft);setStatus('A recovery draft is available.')}else{c.waiting=false;setStatus('Automatic draft recovery ready.');setVersion(value=>value+1)}
  }).catch(error=>{if(current(c)){setProblem('Recovery check failed: '+error.message);c.ready=false}}).finally(()=>{if(current(c))setLoading(false)});
  return()=>{if(current(c))context.current=null};
 },[user?.id,user?.branch_id,eligible,checkVersion]);
 useEffect(()=>{const forget=()=>{try{for(let index=sessionStorage.length-1;index>=0;index--){const key=sessionStorage.key(index);if(key?.startsWith('pharmacy-online-draft:v1:'))sessionStorage.removeItem(key)}}catch{}context.current=null;setPending(null);setProblem('');setStatus('')};window.addEventListener('session-expired',forget);return()=>window.removeEventListener('session-expired',forget)},[]);

 async function flush(){
  const c=context.current;if(!c||c.disabled)return;
  if(!c.ready||c.waiting)throw Error('Review the recovery draft before continuing. Reload if the recovery check failed.');
  if(c.work)return c.work;
  c.work=(async()=>{
   while(current(c)&&!c.waiting&&c.latest!==c.last){
    const value=c.latest,body=JSON.parse(value) as State;
    setStatus('Saving recovery draft…');setProblem('');
    if(!meaningfulDraft(body)){
     if(c.revision){await api('/online-drafts/'+c.id,'DELETE',{revision:c.revision});if(!current(c))return;rotate(c)}
     c.last=value;setStatus('No unsaved cart.');continue;
    }
    const result=await api('/online-drafts/'+c.id,'PUT',{revision:c.revision,state:body});if(!current(c))return;
    c.revision=result.revision;c.last=value;
    if(result.posted_sale_id||result.suspended_cart_id){c.waiting=true;setPending(result);setStatus('Checkout outcome found.');throw Error(result.posted_sale_id?'This checkout already posted. Open its invoice.':'This cart was suspended. Load it from Saved carts.')}
    setStatus('Recovery draft saved.');
   }
  })().catch(error=>{if(current(c)){setProblem('Draft not saved: '+error.message);setStatus('Automatic recovery needs attention.')}throw error}).finally(()=>{c.work=null});
  return c.work;
 }
 useEffect(()=>{const c=context.current;if(!c?.ready||c.disabled||c.waiting)return;const timer=setTimeout(()=>void flush().catch(()=>{}),600);return()=>clearTimeout(timer)},[snapshot,version]);
 async function clear(){
  const c=context.current;if(!c)return;
  // Finish any in-flight write before clearing and rotating the tab reference.
  await c.work?.catch(()=>{});if(!current(c))return;
  if(c.revision)await api('/online-drafts/'+c.id,'DELETE',{revision:c.revision});
  rotate(c);c.waiting=false;c.ready=true;c.last=c.latest;setPending(null);setProblem('');setStatus('Recovery draft cleared.');onClear();
 }
 async function verifyCheckout(){
  await flush();const c=context.current;if(!c||c.disabled||!c.revision)return;
  const result=await api('/online-drafts/'+c.id);if(!current(c))throw Error('Session changed.');
  if(result.draft?.posted_sale_id||result.draft?.suspended_cart_id){c.waiting=true;setPending(result.draft);throw Error(result.draft.posted_sale_id?'This checkout already posted. Open its invoice.':'This cart was suspended. Load it from Saved carts.')}
  if(result.draft?.revision!==c.revision){const message='Another copy changed or cleared this draft. Keep this cart separately or reload to review the saved version.';setProblem(message);throw Error(message)}
 }
 async function fork(){const c=context.current;if(!c)return;await c.work?.catch(()=>{});if(!current(c))return;rotate(c);c.waiting=false;c.ready=true;setPending(null);setProblem('');setVersion(value=>value+1)}
 async function restore(){
  const c=context.current;if(!c||!pending)return;setLoading(true);setProblem('');
  try{const result=await api('/online-drafts/'+c.id+'/restore','POST',{revision:pending.revision});if(!current(c))return;
   if(result.draft?.posted_sale_id||result.draft?.suspended_cart_id){setPending(result.draft);return}
   c.revision=result.draft.revision;c.last=JSON.stringify(result.draft.state);c.latest=c.last;c.waiting=false;setPending(null);onRestore(result);setStatus('Draft recovered at current prices. Review stock, discounts and payment again.');
  }catch(error){if(current(c))setProblem((error as Error).message)}finally{if(current(c))setLoading(false)}
 }
 return{pending,status,problem,loading,needsCheck:!!context.current&&!context.current.ready,blocked:eligible&&(loading||!!pending||!!context.current&&!context.current.ready),flush,verifyCheckout,clear,restore,fork,retry:()=>{if(context.current&&!context.current.ready)setCheckVersion(value=>value+1);else void flush().catch(()=>{})}};
}

export function OnlineDraftNotice({recovery,onOpenSale}:{recovery:ReturnType<typeof useOnlineDraft>;onOpenSale:(id:string)=>void}){
 const[error,setError]=useState('');
 const perform=async(task:()=>Promise<void>)=>{setError('');try{await task()}catch(e){setError((e as Error).message)}};
 return <section className="panel panel-body online-draft-notice" aria-label="Online cart recovery"><p role="status">{recovery.loading?'Checking recovery draft…':recovery.status}</p>{recovery.problem&&<p role="alert" className="error">{recovery.problem}</p>}{error&&<p role="alert" className="error">{error}</p>}{recovery.pending&&<>
  <p>{recovery.pending.posted_sale_id?'This checkout already posted. Open its invoice instead of restoring the basket.':recovery.pending.suspended_cart_id?'This cart was suspended. Use Saved carts to load it.':'A draft from this tab is available. Recover it at current prices or discard it to start again.'}</p>
  <div className="row-actions">{recovery.pending.posted_sale_id?<button className="button" onClick={()=>onOpenSale(recovery.pending.posted_sale_id)}>Open posted invoice</button>:!recovery.pending.suspended_cart_id&&<button className="button" disabled={recovery.loading} onClick={()=>void perform(recovery.restore)}>Recover online cart</button>}<button className="button secondary" disabled={recovery.loading} onClick={()=>void perform(recovery.clear)}>Discard recovery draft</button></div>
 </>}{!recovery.pending&&recovery.problem&&<div className="row-actions"><button className="button secondary" onClick={()=>void recovery.retry()}>{recovery.needsCheck?'Retry recovery check':'Retry draft save'}</button>{/Another copy|draft was cleared/.test(recovery.problem)&&<button className="button secondary" onClick={()=>void perform(recovery.fork)}>Keep this cart separately</button>}</div>}<p className="note">Online recovery saves after a short pause. Wait for “Recovery draft saved” before reloading. Drafts expire after 24 hours and reserve no stock. Sign-out or idle lock forgets this tab’s recovery reference.</p></section>;
}
