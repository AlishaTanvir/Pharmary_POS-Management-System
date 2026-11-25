import type {Request} from 'express';
import {BusinessError} from './domain';
export function assertLocalRequest(req:Pick<Request,'method'|'protocol'|'headers'>){
 const raw=req.headers.host;
 let authority:URL;
 try{if(!raw||/[\s/@?#\\]/.test(raw))throw Error();authority=new URL('http://'+raw);if(!['localhost','127.0.0.1','[::1]'].includes(authority.hostname))throw Error()}
 catch{throw new BusinessError('The local counter is available only through a loopback host.',403)}
 if(!['GET','HEAD'].includes(req.method)&&req.headers['x-local-request']!=='1')throw new BusinessError('Local request header missing.',403);
 const origin=req.headers.origin;
 if(origin){
  try{const parsed=new URL(origin);if(parsed.protocol!==req.protocol+':'||parsed.host!==authority.host||parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash)throw Error()}
  catch{throw new BusinessError('Cross-origin local requests are blocked.',403)}
 }
}
