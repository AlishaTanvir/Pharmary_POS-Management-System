import {Router,Response} from 'express';
import {apiAccess} from './api-access.generated';
import {requireSuper} from './expansion-routes';
import {transaction} from './db';
import {Actor,audit} from './services';
export function securityReviewRoutes(){
 const r=Router(),snapshot=(res:Response)=>({generated_at:new Date().toISOString(),branch_id:(res.locals.actor as Actor).branch_id,inventory:apiAccess,notice:'Declared source access controls. This inventory does not certify deployment security or every business authorization path.'});
 r.get('/security/api-access',requireSuper,(_req,res)=>res.json(snapshot(res)));
 r.post('/security/api-access/export',requireSuper,async(_req,res)=>{const report=snapshot(res);await transaction(db=>audit(db,res.locals.actor as Actor,'API_ACCESS_INVENTORY_EXPORTED',report.branch_id,{routes:apiAccess.routes.length,route_source_sha256:apiAccess.route_source_sha256}));res.json({filename:'api-access-inventory.json',report})});
 return r;
}
