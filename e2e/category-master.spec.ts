import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {csvCategoryMaster} from '../src/csv';

test('Phase 16 unused category CSV preview, atomic import, reusable export and access boundaries',async({page,browser})=>{
 test.setTimeout(90000);
 await page.goto('/');await page.getByLabel('Username',{exact:true}).fill('owner');await page.getByLabel('Password',{exact:true}).fill(process.env.ADMIN_PASSWORD!);await page.getByRole('button',{name:/Sign in/}).click();
 await expect(page.getByRole('heading',{name:'Your pharmacy at a glance'})).toBeVisible();
 const auth=await page.request.get('/api/auth/me').then(r=>r.json()),headers={'X-CSRF-Token':auth.csrf},token=Date.now()+'-'+crypto.randomUUID().slice(0,4),root='Unused master '+token,child='=Child / "quoted", '+token;
 const makeCsv=(paths:string[][])=>'category_path_json\r\n'+paths.map(path=>'"'+JSON.stringify(path).replaceAll('"','""')+'"').join('\r\n');
 await page.getByRole('link',{name:'Medicines',exact:true}).click();const manager=page.locator('.category-manager');await manager.getByText('Manage medicine categories',{exact:true}).click();await manager.getByText('Import category CSV',{exact:true}).click();
 const input=manager.getByLabel('Category master CSV',{exact:true}),confirm=manager.getByRole('button',{name:'Confirm category import',exact:true});
 await input.setInputFiles({name:'invalid.csv',mimeType:'text/csv',buffer:Buffer.from('category_path_json\n[]')});await expect(manager.getByRole('alert')).toContainText('1-8');await expect(confirm).toBeDisabled();
 await input.setInputFiles({name:'category-master.csv',mimeType:'text/csv',buffer:Buffer.from(makeCsv([[root,child]]))});
 await expect(manager.getByRole('heading',{name:'Preview category import'})).toBeVisible();await expect(manager.getByRole('cell',{name:root+' / '+child,exact:true})).toBeVisible();
 const before=await page.request.get('/api/categories').then(r=>r.json());expect(before.some((row:any)=>row.name===root)).toBe(false);
 await confirm.click();await expect(manager.getByRole('status')).toContainText('Created 2 categories');await expect(confirm).toBeDisabled();
 const created=await page.request.get('/api/categories').then(r=>r.json()),rootNode=created.find((row:any)=>row.name===root),childNode=created.find((row:any)=>row.name===child);expect(childNode.parent_id).toBe(rootNode.id);
 const products=await page.request.get('/api/medicines?category='+rootNode.id+'&status=all').then(r=>r.json());expect(products.items).toHaveLength(0);
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export categories CSV',exact:true}).click();const download=await pending;expect(download.suggestedFilename()).toBe('medicine-categories.csv');const exported=csvCategoryMaster(await readFile((await download.path())!,'utf8'));expect(exported).toContainEqual({category_path:[root]});expect(exported).toContainEqual({category_path:[root,child]});
 // A full export includes unused paths. Re-import only the fixture paths to keep this acceptance run bounded.
 await input.setInputFiles({name:'reimport.csv',mimeType:'text/csv',buffer:Buffer.from(makeCsv([[root.toLowerCase(),child],[root]]))});await confirm.click();await expect(manager.getByRole('status')).toContainText('Created 0 categories');
 const reused=await page.request.get('/api/categories').then(r=>r.json());expect(reused.find((row:any)=>row.name===root).id).toBe(rootNode.id);expect(reused.find((row:any)=>row.name===child).id).toBe(childNode.id);
 const missingCsrf=await page.request.post('/api/categories/import',{data:{items:[{category_path:['Forbidden']}]}});expect(missingCsrf.status()).toBe(403);
 const invalid=await page.request.post('/api/categories/import',{headers,data:{items:[{category_path:['Must not create '+token]},{category_path:[]}]}});expect(invalid.status()).toBe(400);expect((await page.request.get('/api/categories').then(r=>r.json())).some((row:any)=>row.name==='Must not create '+token)).toBe(false);
 // A complete category master can exceed the ordinary 100 KB medicine-request limit.
 const longPath=Array.from({length:8},(_,index)=>('Bulk '+token+' level '+index+' ').padEnd(80,'x')),largeBody={items:Array.from({length:200},()=>({category_path:longPath}))};expect(Buffer.byteLength(JSON.stringify(largeBody))).toBeGreaterThan(100*1024);
 const large=await page.request.post('/api/categories/import',{headers,data:largeBody});expect(large.status()).toBe(201);expect(await large.json()).toEqual({paths:200,created:8});
 const cashier=await browser.newContext();try{
  expect((await cashier.request.post('/api/auth/login',{data:{username:'cashier',password:process.env.CASHIER_PASSWORD}})).ok()).toBeTruthy();const session=await cashier.request.get('/api/auth/me').then(r=>r.json());
  for(const path of ['/api/categories/import','/api/categories/export'])expect((await cashier.request.post(path,{headers:{'X-CSRF-Token':session.csrf},data:{items:[{category_path:['Forbidden']}]}})).status()).toBe(403);
  const cashierPage=await cashier.newPage();await cashierPage.goto('/#medicines');await expect(cashierPage.getByRole('heading',{name:'Medicines',exact:true})).toBeVisible();await expect(cashierPage.getByText('Import category CSV',{exact:true})).toHaveCount(0);await expect(cashierPage.getByRole('button',{name:'Export categories CSV',exact:true})).toHaveCount(0);
 }finally{await cashier.close()}
});
