import {test,expect,request as http} from './fixtures';
import {readFile} from 'node:fs/promises';
import {randomInt,randomUUID} from 'node:crypto';
const branch='019a0700-0000-7000-8000-000000000002';
async function call(context:any,path:string,data?:any,method='POST',portal='customer',extra:any={}){const state=await context.storageState(),prefix=portal==='customer'?'mimiz':'mimiz_'+portal;const csrf=state.cookies.find((cookie:any)=>cookie.name===prefix+'_csrf')?.value||'';const response=await context.fetch('/api/v1'+path,{method,data,headers:{'X-Mimiz-Portal':portal,'X-CSRF-Token':csrf,...extra}});return {response,data:await response.json()};}
async function buyer(context:any){const sent=await call(context,'/auth/otp',{phone:'024'+randomInt(1000000,9999999)});expect(sent.response.status()).toBe(201);const verified=await call(context,'/auth/verify',{challengeId:sent.data.challengeId,code:'123456',name:'Account acceptance'});expect(verified.response.status()).toBe(201);return verified.data;}
async function owner(context:any){const [email,password]=(await readFile('.local-admin','utf8')).trim().split(/\r?\n/);const result=await call(context,'/auth/staff-login',{email,password},'POST','admin');expect(result.response.status()).toBe(201);}
test('profile preferences, active-order deletion guard, reorder and anonymisation work',async({request},info)=>{
 test.skip(info.project.name!=='desktop');const customer=await buyer(request);await owner(request);
 const prefs={push:false,criticalSms:true,promotions:false};let result=await call(request,'/account/profile',{name:'Updated account',preferences:prefs},'PATCH');expect(result.response.status()).toBe(200);expect(result.data.notification_preferences).toEqual(prefs);
 let cart=(await call(request,'/cart',undefined,'GET')).data;
 cart=(await call(request,'/cart',{version:cart.version,branchId:branch,fulfillment:'pickup',selections:[{itemId:'sobolo',optionIds:[],quantity:1,note:'Personal note'}]},'PUT')).data;
 let created=await call(request,'/orders',{cartId:cart.id,cartVersion:cart.version,paymentMethod:'cash'},'POST','customer',{'Idempotency-Key':randomUUID()});expect(created.response.status(),JSON.stringify(created.data)).toBe(201);const id=created.data.id;
 expect((await call(request,'/account',{confirmation:'DELETE'},'DELETE')).response.status()).toBe(409);
 expect((await call(request,'/orders/'+id+'/cancel',{reason:'Acceptance test finished'})).response.status()).toBe(201);
 cart=(await call(request,'/cart',undefined,'GET')).data;
 result=await call(request,'/orders/'+id+'/reorder',{cartVersion:cart.version});expect(result.response.status(),JSON.stringify(result.data)).toBe(201);expect(result.data.lines[0].itemId).toBe('sobolo');expect(result.data.lines[0].note).toBe('');
 expect((await call(request,'/orders/'+id+'/reorder',{cartVersion:result.data.version})).response.status()).toBe(409);
 result=await call(request,'/account',{confirmation:'DELETE'},'DELETE');expect(result.response.status()).toBe(200);
 expect((await call(request,'/auth/me',undefined,'GET')).response.status()).toBe(401);
 const customers=await call(request,'/staff/customers?search=Updated%20account',undefined,'GET','admin');expect(customers.response.status()).toBe(200);expect(customers.data.some((row:any)=>row.id===customer.id)).toBe(false);
});
test('branch resolution, catalogue validation and reports are role protected',async({request},info)=>{
 test.skip(info.project.name!=='desktop');await buyer(request);await owner(request);
 const near=await call(request,'/branches/resolve',{latitude:5.556,longitude:-.187});expect(near.response.status()).toBe(201);expect(near.data.find((row:any)=>row.id===branch).delivers).toBe(true);
 const far=await call(request,'/branches/resolve',{latitude:6.689,longitude:-1.624});expect(far.data.find((row:any)=>row.id===branch).delivers).toBe(false);
 const today=new Date().toISOString().slice(0,10),path='/staff/reports?from='+today+'&to='+today+'&branchId='+branch;
 expect((await call(request,path,undefined,'GET')).response.status()).toBe(403);
 const report=await call(request,path,undefined,'GET','admin');expect(report.response.status(),JSON.stringify(report.data)).toBe(200);expect(report.data.summary.orders).toBeGreaterThan(0);expect(Array.isArray(report.data.reconciliation)).toBe(true);
 const copy=await call(request,'/staff/catalogue/sobolo/duplicate',{branchId:branch},'POST','admin');expect(copy.response.status()).toBe(201);const id=copy.data.id;
 try{
 const invalid=await call(request,'/staff/catalogue/'+id,{branchId:branch,optionGroups:[{id:'one',name:'Invalid group',minimum:2,maximum:1,options:[{id:'two',name:'Choice',priceDeltaPesewas:0}]}]},'PATCH','admin');expect(invalid.response.status()).toBe(400);
 const valid=await call(request,'/staff/catalogue/'+id,{branchId:branch,name:'QA sobolo choices',available:true,stock:3,branchPricePesewas:2000,dayparts:['breakfast'],tags:['hibiscus'],optionGroups:[{id:'one',name:'Size',minimum:1,maximum:1,options:[{id:'two',name:'Large',priceDeltaPesewas:500}]}]},'PATCH','admin');expect(valid.response.status(),JSON.stringify(valid.data)).toBe(200);
 const menu=await call(request,'/branches/'+branch+'/menu',undefined,'GET');const item=menu.data.items.find((item:any)=>item.id===id);expect(item.pricePesewas).toBe(2000);expect(item.optionGroups[0].options[0].priceDeltaPesewas).toBe(500);
 const blocked=await call(request,'/staff/catalogue/'+id,{branchId:branch,availabilityWindows:[{days:[0,1,2,3,4,5,6],open:'00:00',close:'00:00'}]},'PATCH','admin');expect(blocked.response.status()).toBe(200);
 const hidden=await call(request,'/branches/'+branch+'/menu',undefined,'GET');expect(hidden.data.items.find((item:any)=>item.id===id).available).toBe(false);
 }finally{await call(request,'/staff/catalogue/'+id,{branchId:branch,archived:true},'PATCH','admin');}
 const audit=await call(request,'/staff/audit?branchId='+branch,undefined,'GET','admin');expect(audit.response.status()).toBe(200);expect(audit.data.some((row:any)=>row.entity_id===id)).toBe(true);
});
test('management reports and menu editor render without customer navigation',async({page},info)=>{
 const [email,password]=(await readFile('.local-admin','utf8')).trim().split(/\r?\n/);
 await page.goto('/admin');await page.getByLabel('Email',{exact:true}).fill(email!);await page.getByLabel('Password',{exact:true}).fill(password!);await page.getByRole('button',{name:'Sign in to administration',exact:true}).click();
 await page.getByRole('button',{name:'Reports',exact:true}).click();await expect(page.getByRole('heading',{name:'Kitchen performance',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Payment reconciliation',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Menu management',exact:true}).click();await expect(page.getByRole('heading',{name:'Your menu, your way.',exact:true})).toBeVisible();await page.getByRole('button',{name:'Edit dish',exact:true}).first().click();await expect(page.getByRole('heading',{name:'Meal choices',exact:true})).toBeVisible();await expect(page.getByLabel('Company price (GHS)',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Close dish editor',exact:true}).click();
 await expect(page.getByRole('link',{name:'Back to the kitchen workspace',exact:true})).toHaveCount(0);
 await page.screenshot({path:'artifacts/screenshots/'+info.project.name+'-menu-management.png',fullPage:true});
});
test('drawn delivery polygons are validated, applied and pausable',async({request},info)=>{
 test.skip(info.project.name!=='desktop');await owner(request);
 const polygon={type:'Polygon',coordinates:[[[-.192,5.695],[-.182,5.695],[-.182,5.705],[-.192,5.705],[-.192,5.695]]]};
 const payload={branchId:branch,name:'QA drawn zone '+randomUUID().slice(0,6),polygon,fee:1500,minimum:3000,etaMinutes:30,active:true};
 const saved=await call(request,'/staff/zones',payload,'POST','admin');expect(saved.response.status(),JSON.stringify(saved.data)).toBe(201);
 try{
 const resolved=await call(request,'/branches/resolve',{latitude:5.7,longitude:-.187});expect(resolved.data.find((row:any)=>row.id===branch).delivers).toBe(true);
 const invalid=await call(request,'/staff/zones',{...payload,polygon:{type:'Polygon',coordinates:[[[-.192,5.695],[-.182,5.705],[-.182,5.695],[-.192,5.705],[-.192,5.695]]]}},'POST','admin');expect(invalid.response.status()).toBe(400);
 }finally{expect((await call(request,'/staff/zones',{...payload,id:saved.data.id,active:false},'POST','admin')).response.status()).toBe(201);}
 const resolved=await call(request,'/branches/resolve',{latitude:5.7,longitude:-.187});expect(resolved.data.find((row:any)=>row.id===branch).delivers).toBe(false);
});
