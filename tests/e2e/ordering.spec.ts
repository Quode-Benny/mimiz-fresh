import {test,expect,request as http} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {randomUUID,randomInt} from 'node:crypto';
test.setTimeout(90000);
const root='http://localhost:3002';
async function client(){return http.newContext({baseURL:root,extraHTTPHeaders:{Origin:root}});}
async function csrf(context:any){const state=await context.storageState();return state.cookies.find((cookie:any)=>cookie.name==='mimiz_csrf')?.value||'';}
async function call(context:any,path:string,body?:any,method='POST',headers:any={}){
 const response=await context.fetch('/api/v1'+path,{method,headers:{'X-CSRF-Token':await csrf(context),...headers},data:body});
 const data=await response.json();return {response,data};
}
async function customer(context:any){
 const phone='024'+String(randomInt(1000000,9999999));
 const sent=await call(context,'/auth/otp',{phone});expect(sent.response.status()).toBe(201);
 const verified=await call(context,'/auth/verify',{challengeId:sent.data.challengeId,code:'123456',name:'Integration customer'});expect(verified.response.status()).toBe(201);
 return verified.data;
}
async function staff(context:any){
 const [email,password]=(await readFile('.local-admin','utf8')).trim().split(/\r?\n/);
 const result=await call(context,'/auth/staff-login',{email,password});expect(result.response.status()).toBe(201);
}
async function fillCart(context:any,fulfillment='pickup'){
 let result=await call(context,'/cart',undefined,'GET');expect(result.response.status()).toBe(200);
 const update=await call(context,'/cart',{version:result.data.version,branchId:result.data.branch_id,fulfillment,selections:[{itemId:'jollof',optionIds:['fish','egg'],quantity:1,note:'Integration order'}]},'PUT');
 expect(update.response.status()).toBe(200);expect(update.data.subtotal).toBe(8000);return update.data;
}
test('real cash order is idempotent, private, fulfilable and rated',async({},info)=>{
 test.skip(info.project.name!=='desktop','API lifecycle runs once; UI is checked on both viewports.');
 const buyer=await client(),owner=await client(),stranger=await client();
 await customer(buyer);await customer(stranger);await staff(owner);
 const cart=await fillCart(buyer);const input={cartId:cart.id,cartVersion:cart.version,paymentMethod:'cash',note:'Integration lifecycle'};const key=randomUUID();
 const quote=await call(buyer,'/checkout/quote',input);expect(quote.response.status()).toBe(201);expect(quote.data.total).toBe(8000);
 const results=await Promise.all([call(buyer,'/orders',input,'POST',{'Idempotency-Key':key}),call(buyer,'/orders',input,'POST',{'Idempotency-Key':key})]);
 for(const result of results)expect(result.response.status(),JSON.stringify(result.data)).toBe(201);
 expect(results[0].data.id).toBe(results[1].data.id);const id=results[0].data.id;
 const forbidden=await call(stranger,'/orders/'+id,undefined,'GET');expect(forbidden.response.status()).toBe(403);
 const csrfRejected=await buyer.post('/api/v1/orders/'+id+'/cancel',{data:{reason:'Test without CSRF'}});expect(csrfRejected.status()).toBe(403);
 for(const status of ['accepted','preparing','ready','completed']){const result=await call(owner,'/orders/'+id+'/transition',{status});expect(result.response.status(),JSON.stringify(result.data)).toBe(201);}
 const history=await call(buyer,'/orders/'+id,undefined,'GET');expect(history.data.status).toBe('completed');expect(history.data.payment_status).toBe('succeeded');expect(history.data.events).toHaveLength(5);
 const rating=await call(buyer,'/orders/'+id+'/rating',{food:5,comment:'Great sample meal'});expect(rating.response.status()).toBe(201);
 const illegal=await call(owner,'/orders/'+id+'/transition',{status:'preparing'});expect(illegal.response.status()).toBe(409);
 await buyer.dispose();await owner.dispose();await stranger.dispose();
});
test('signed duplicate mock webhook confirms once, cancellation refunds',async({},info)=>{
 test.skip(info.project.name!=='desktop');
 const buyer=await client();await customer(buyer);const cart=await fillCart(buyer);
 const result=await call(buyer,'/orders',{cartId:cart.id,cartVersion:cart.version,paymentMethod:'online'},'POST',{'Idempotency-Key':randomUUID()});
 expect(result.response.status(),JSON.stringify(result.data)).toBe(201);const order=result.data;
 expect(order.status).toBe('pending_payment');expect(order.payments[0].authorization_url).toContain('/mock-pay/');
 const unsigned=await buyer.post('/api/v1/webhooks/mock',{data:{event:'charge.success',data:{reference:order.payments[0].reference}}});expect(unsigned.status()).toBe(401);
 const simulate=await call(buyer,'/mock-pay/'+order.payments[0].reference,{scenario:'duplicate'});expect(simulate.response.status()).toBe(201);
 await expect.poll(async()=>{const current=await call(buyer,'/orders/'+order.id,undefined,'GET');return current.data.status;},{timeout:20000}).toBe('placed');
 const details=await call(buyer,'/orders/'+order.id,undefined,'GET');expect(details.data.events.filter((event:any)=>event.to_status==='placed')).toHaveLength(1);
 const cancel=await call(buyer,'/orders/'+order.id+'/cancel',{reason:'Testing automatic refund'});expect(cancel.response.status()).toBe(201);
 await expect.poll(async()=>{const current=await call(buyer,'/orders/'+order.id,undefined,'GET');return current.data.payment_status;},{timeout:20000}).toBe('refunded');
 await buyer.dispose();
});
test('delivery pins use PostGIS and guest carts survive server reads',async({},info)=>{
 test.skip(info.project.name!=='desktop');
 const buyer=await client();await customer(buyer);const cart=await fillCart(buyer,'delivery');
 const input={cartId:cart.id,cartVersion:cart.version,paymentMethod:'cash',address:{latitude:5.556,longitude:-.187,landmark:'Demo landmark',description:'Demo address at Osu',recipientName:'Tester',recipientPhone:'+233241234567'}};
 const valid=await call(buyer,'/checkout/quote',input);expect(valid.response.status(),JSON.stringify(valid.data)).toBe(201);expect(valid.data.deliveryFee).toBe(1500);
 const invalid=await call(buyer,'/checkout/quote',{...input,address:{...input.address,latitude:6.7,longitude:-1.6}});expect(invalid.response.status()).toBe(400);
 const missing=await call(buyer,'/checkout/quote',{...input,address:{...input.address,latitude:undefined,longitude:undefined}});expect(missing.response.status()).toBe(400);
 const stale=await call(buyer,'/cart',{version:cart.version-1,branchId:cart.branch_id,fulfillment:'pickup',selections:[]},'PUT');expect(stale.response.status()).toBe(409);
 await buyer.dispose();
});
test('declined payment can be retried and late success is refunded',async({},info)=>{
 test.skip(info.project.name!=='desktop');
 const buyer=await client();await customer(buyer);let cart=await fillCart(buyer);
 let result=await call(buyer,'/orders',{cartId:cart.id,cartVersion:cart.version,paymentMethod:'online'},'POST',{'Idempotency-Key':randomUUID()});
 expect(result.response.status(),JSON.stringify(result.data)).toBe(201);let order=result.data;
 await call(buyer,'/mock-pay/'+order.payments[0].reference,{scenario:'decline'});
 await expect.poll(async()=>(await call(buyer,'/orders/'+order.id,undefined,'GET')).data.payment_status,{timeout:20000}).toBe('failed');
 result=await call(buyer,'/orders/'+order.id+'/retry-payment');expect(result.response.status()).toBe(201);order=result.data;expect(order.payments).toHaveLength(2);
 await call(buyer,'/mock-pay/'+order.payments[0].reference,{scenario:'approve'});
 await expect.poll(async()=>(await call(buyer,'/orders/'+order.id,undefined,'GET')).data.status,{timeout:20000}).toBe('placed');
 await call(buyer,'/orders/'+order.id+'/cancel',{reason:'Testing retry cleanup'});
 cart=await fillCart(buyer);
 result=await call(buyer,'/orders',{cartId:cart.id,cartVersion:cart.version,paymentMethod:'online'},'POST',{'Idempotency-Key':randomUUID()});order=result.data;
 await call(buyer,'/mock-pay/'+order.payments[0].reference,{scenario:'late'});
 await expect.poll(async()=>(await call(buyer,'/orders/'+order.id,undefined,'GET')).data.payment_status,{timeout:20000}).toBe('refunded');
 expect((await call(buyer,'/orders/'+order.id,undefined,'GET')).data.status).toBe('cancelled');
 await buyer.dispose();
});
test('two customers cannot buy the same last portion',async({},info)=>{
 test.skip(info.project.name!=='desktop');
 const owner=await client();await staff(owner);const a=await client(),b=await client();await customer(a);await customer(b);
 const ca=await fillCart(a),cb=await fillCart(b);
 await call(owner,'/staff/catalogue/jollof',{branchId:ca.branch_id,available:true,stock:1},'PATCH');
 try{
  const payload=(cart:any)=>({cartId:cart.id,cartVersion:cart.version,paymentMethod:'cash'});
  const results=await Promise.all([call(a,'/orders',payload(ca),'POST',{'Idempotency-Key':randomUUID()}),call(b,'/orders',payload(cb),'POST',{'Idempotency-Key':randomUUID()})]);
  expect(results.map(result=>result.response.status()).sort()).toEqual([201,409]);
  const winner=results.find(result=>result.response.status()===201)!.data;
  await call(owner,'/orders/'+winner.id+'/cancel',{reason:'Stock race cleanup'});
 }finally{await call(owner,'/staff/catalogue/jollof',{branchId:ca.branch_id,available:true,stock:null},'PATCH');}
 await owner.dispose();await a.dispose();await b.dispose();
});
test('only the assigned rider can see, locate or complete a delivery',async({},info)=>{
 test.skip(info.project.name!=='desktop');const owner=await client(),buyer=await client(),a=await client(),b=await client();
 await staff(owner);await customer(buyer);const cart=await fillCart(buyer,'delivery');
 const password='qa-'+randomUUID();const emailA='rider-'+randomUUID()+'@example.test',emailB='rider-'+randomUUID()+'@example.test';
 const riders=[];
 for(const email of [emailA,emailB]){const created=await call(owner,'/staff/users',{name:'Integration rider',email,password,role:'rider',branchId:cart.branch_id});expect(created.response.status(),JSON.stringify(created.data)).toBe(201);riders.push(created.data.id);}
 expect((await call(a,'/auth/staff-login',{email:emailA,password})).response.status()).toBe(201);
 expect((await call(b,'/auth/staff-login',{email:emailB,password})).response.status()).toBe(201);
 const result=await call(buyer,'/orders',{cartId:cart.id,cartVersion:cart.version,paymentMethod:'cash',address:{latitude:5.556,longitude:-.187,landmark:'Test landmark',description:'Test delivery address',recipientName:'Tester',recipientPhone:'+233241234567'}},'POST',{'Idempotency-Key':randomUUID()});
 expect(result.response.status(),JSON.stringify(result.data)).toBe(201);const id=result.data.id;
 for(const status of ['accepted','preparing','ready'])expect((await call(owner,'/orders/'+id+'/transition',{status})).response.status()).toBe(201);
 expect((await call(owner,'/staff/orders/'+id+'/rider',{riderId:riders[0]},'PATCH')).response.status()).toBe(200);
 expect((await call(b,'/orders/'+id,undefined,'GET')).response.status()).toBe(403);
 expect((await call(b,'/orders/'+id+'/transition',{status:'out_for_delivery'})).response.status()).toBe(403);
 expect((await call(a,'/orders/'+id+'/transition',{status:'out_for_delivery'})).response.status()).toBe(201);
 expect((await call(a,'/rider/orders/'+id+'/location',{latitude:5.557,longitude:-.188})).response.status()).toBe(201);
 expect((await call(buyer,'/orders/'+id,undefined,'GET')).data.location.lat).toBe(5.557);
 expect((await call(a,'/orders/'+id+'/transition',{status:'completed'})).response.status()).toBe(201);
 const completed=await call(buyer,'/orders/'+id,undefined,'GET');expect(completed.data.status).toBe('completed');expect(completed.data.location).toBeNull();
 expect((await call(a,'/rider/orders/'+id+'/location',{latitude:5.557,longitude:-.188})).response.status()).toBe(403);
 for(const id of riders)await call(owner,'/staff/users/'+id,undefined,'DELETE');
 for(const context of [owner,buyer,a,b])await context.dispose();
});
test('concurrent partial refunds reserve the remaining paid amount',async({},info)=>{
 test.skip(info.project.name!=='desktop');const owner=await client(),buyer=await client();await staff(owner);await customer(buyer);const cart=await fillCart(buyer);
 const created=await call(buyer,'/orders',{cartId:cart.id,cartVersion:cart.version,paymentMethod:'online'},'POST',{'Idempotency-Key':randomUUID()});expect(created.response.status()).toBe(201);const order=created.data;
 await call(buyer,'/mock-pay/'+order.payments[0].reference,{scenario:'approve'});
 await expect.poll(async()=>(await call(buyer,'/orders/'+order.id,undefined,'GET')).data.status,{timeout:20000}).toBe('placed');
 const refunds=await Promise.all([call(owner,'/staff/orders/'+order.id+'/refund',{amount:5000,reason:'Partial refund concurrency test'}),call(owner,'/staff/orders/'+order.id+'/refund',{amount:5000,reason:'Partial refund concurrency test'})]);
 expect(refunds.map(result=>result.response.status()).sort()).toEqual([201,409]);
 await expect.poll(async()=>(await call(buyer,'/orders/'+order.id,undefined,'GET')).data.payment_status,{timeout:20000}).toBe('partially_refunded');
 const remainder=await call(owner,'/staff/orders/'+order.id+'/refund',{amount:3000,reason:'Refund remaining paid amount'});expect(remainder.response.status(),JSON.stringify(remainder.data)).toBe(201);
 await expect.poll(async()=>(await call(buyer,'/orders/'+order.id,undefined,'GET')).data.payment_status,{timeout:20000}).toBe('refunded');
 const final=await call(buyer,'/orders/'+order.id,undefined,'GET');expect(final.data.payments[0].refunded_amount).toBe(8000);
 await call(owner,'/orders/'+order.id+'/cancel',{reason:'Refund test cleanup'});await owner.dispose();await buyer.dispose();
});
