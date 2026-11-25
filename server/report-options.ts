import type pg from 'pg';
import {Actor} from './services';
import {listCategories} from './categories';
import {classificationCutoff,classificationSnapshot} from './classification-history';
import type {ReportRequest} from './reporting';
export async function reportOptions(db:pg.PoolClient,a:Actor,input:ReportRequest){
 const historical=input.classification_basis==='AS_OF'?await classificationSnapshot(db,a.branch_id,await classificationCutoff(db,input.to,input.classification_at)):null;
 const category_tree=historical?historical.tree:await listCategories(db,a),categories=historical?[...new Set(historical.medicines.map(m=>m.form).filter(Boolean))].sort().map(form=>({form})):(await db.query('SELECT DISTINCT form FROM medicines WHERE branch_id=$1 ORDER BY form',[a.branch_id])).rows;
 return{category_tree,categories,suppliers:(await db.query('SELECT id,name FROM suppliers WHERE branch_id=$1 ORDER BY name',[a.branch_id])).rows,cashiers:(await db.query('SELECT DISTINCT u.id,u.name FROM users u JOIN branch_grants g ON g.user_id=u.id WHERE g.branch_id=$1 ORDER BY u.name',[a.branch_id])).rows,classification_basis:input.classification_basis,classification_at:historical?.classification_at||null,capture_started_at:historical?.capture_started_at||null,before_capture:historical?.before_capture||false};
}
