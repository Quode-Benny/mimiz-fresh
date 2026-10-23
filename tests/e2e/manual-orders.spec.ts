import {test,expect,request as http} from './fixtures';
import {readFile} from 'node:fs/promises';
import {randomInt,randomUUID} from 'node:crypto';
async function call(context:any,path:string,data?:any,method='POST',portal='customer',extra:any={}){const state=await context.storageState(),prefix=portal==='customer'?'mimiz':'mimiz_'+portal;const csrf=state.cookies.find((cookie:any)=>cookie.name===prefix+'_csrf')?.value||'';const response=await context.fetch('/api/v1'+path,{method,data,headers:{'X-Mimiz-Portal':portal,'X-CSRF-Token':csrf,...extra}});return {response,data:await response.json()};}
test('phone orders reuse checkout rules, preserve customer bags and remain idempotent',async({},info)=>{
 test.skip(info.project.name!=='desktop');const buyer=await http.newContext({baseURL:'http://localhost:3002'}),owner=await http.newContext({baseURL:'http://localhost:3002'});const phone='024'+randomInt(1000000,9999999),branchId='019a0700-0000-7000-8000-000000000002';
 try{
 const sent=await call(buyer,'/auth/otp',{phone});await call(buyer,'/auth/verify',{challengeId:sent.data.challengeId,code:'123456',name:'Phone-order customer'});
 const [email,password]=(await readFile('.local-admin','utf8')).trim().split(/\r?\n/);expect((await call(owner,'/auth/staff-login',{email,password},'POST','admin')).response.status()).toBe(201);
 let cart=(await call(buyer,'/cart',undefined,'GET')).data;const ownBag=await call(buyer,'/cart',{version:cart.version,branchId,fulfillment:'pickup',selections:[{itemId:'jollof',optionIds:['chicken'],quantity:1,note:'Keep my saved meal'}]},'PUT');expect(ownBag.response.status()).toBe(200);
 const input={branchId,customerName:'Phone-order customer',customerPhone:phone,fulfillment:'pickup',selections:[{itemId:'sobolo',optionIds:[],quantity:1,note:'Phone order'}]};
 expect((await call(buyer,'/staff/orders/manual',input)).response.status()).toBe(403);
 const quote=await call(owner,'/staff/orders/quote',input,'POST','admin');expect(quote.response.status()).toBe(201);expect(quote.data.total).toBeGreaterThan(0);
 const headers={'Idempotency-Key':randomUUID()};const results=await Promise.all([call(owner,'/staff/orders/manual',input,'POST','admin',headers),call(owner,'/staff/orders/manual',input,'POST','admin',headers)]);for(const result of results)expect(result.response.status(),JSON.stringify(result.data)).toBe(201);expect(results[0].data.id).toBe(results[1].data.id);
 const id=results[0].data.id;const savedBag=await call(buyer,'/cart',undefined,'GET');expect(savedBag.data.version).toBe(ownBag.data.version);expect(savedBag.data.selections).toEqual(ownBag.data.selections);
 const customerOrder=await call(buyer,'/orders/'+id,undefined,'GET');expect(customerOrder.response.status()).toBe(200);expect(customerOrder.data.events).toHaveLength(1);
 expect((await call(owner,'/staff/orders/manual',{...input,selections:[{...input.selections[0],quantity:2}]},'POST','admin',headers)).response.status()).toBe(409);
 expect((await call(buyer,'/orders/'+id+'/cancel',{reason:'Phone-order acceptance finished'})).response.status()).toBe(201);
 }finally{await buyer.dispose();await owner.dispose();}
});
test('administration can create a cash walk-in order through its own workspace',async({page},info)=>{
 const [email,password]=(await readFile('.local-admin','utf8')).trim().split(/\r?\n/);
 await page.goto('/admin/new-order');await page.getByLabel('Email',{exact:true}).fill(email!);await page.getByLabel('Password',{exact:true}).fill(password!);await page.getByRole('button',{name:'Sign in to administration',exact:true}).click();
 await page.getByLabel('Customer name',{exact:true}).fill('Walk-in acceptance');await page.getByLabel('Customer phone',{exact:true}).fill('024'+randomInt(1000000,9999999));
 await page.getByRole('button',{name:/Chilled sobolo/}).click();await page.getByRole('button',{name:/Add to order/}).click();await page.getByRole('button',{name:'Review phone order',exact:true}).click();await page.getByRole('button',{name:'Place cash order',exact:true}).click();
 await expect(page).toHaveURL(/\/admin\/orders\/[a-f0-9-]+$/);await expect(page.locator('.status-badge').first()).toHaveText('placed');await expect(page.getByRole('button',{name:'Print kitchen ticket',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'My orders',exact:true})).toHaveCount(0);await page.screenshot({path:'artifacts/screenshots/'+info.project.name+'-walk-in-order.png',fullPage:true});
});
