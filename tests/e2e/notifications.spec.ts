import {test,expect} from './fixtures';
import {readFile} from 'node:fs/promises';
import {randomInt,randomUUID,randomBytes,createECDH} from 'node:crypto';
async function call(context:any,path:string,data?:any,method='POST',portal='customer',extra:any={}){const state=await context.storageState(),prefix=portal==='customer'?'mimiz':'mimiz_'+portal;const csrf=state.cookies.find((cookie:any)=>cookie.name===prefix+'_csrf')?.value||'';const response=await context.fetch('/api/v1'+path,{method,data,headers:{'X-Mimiz-Portal':portal,'X-CSRF-Token':csrf,...extra}});return {response,data:await response.json()};}
async function signIn(context:any){const sent=await call(context,'/auth/otp',{phone:'024'+randomInt(1000000,9999999)});expect(sent.response.status()).toBe(201);expect((await call(context,'/auth/verify',{challengeId:sent.data.challengeId,code:'123456',name:'Notification acceptance'})).response.status()).toBe(201);const [email,password]=(await readFile('.local-admin','utf8')).trim().split(/\r?\n/);expect((await call(context,'/auth/staff-login',{email,password},'POST','admin')).response.status()).toBe(201);}
async function order(context:any){let cart=(await call(context,'/cart',undefined,'GET')).data;cart=(await call(context,'/cart',{version:cart.version,branchId:cart.branch_id,fulfillment:'pickup',selections:[{itemId:'sobolo',optionIds:[],quantity:1,note:''}]},'PUT')).data;const result=await call(context,'/orders',{cartId:cart.id,cartVersion:cart.version,paymentMethod:'cash'},'POST','customer',{'Idempotency-Key':randomUUID()});expect(result.response.status(),JSON.stringify(result.data)).toBe(201);return result.data;}
test('critical SMS is delivered through the durable console provider and respects opt-out',async({request},info)=>{
 test.skip(info.project.name!=='desktop');await signIn(request);const created=await order(request);
 await expect.poll(async()=>{const report=await call(request,'/staff/notification-deliveries?orderId='+created.id,undefined,'GET','admin');return report.data.find((row:any)=>row.channel==='sms'&&row.status==='sent')?.messages||0;},{timeout:30000}).toBe(1);
 const notices=await call(request,'/notifications',undefined,'GET');expect(notices.data.some((item:any)=>item.order_id===created.id)).toBe(true);
 const profile=(await call(request,'/account/profile',undefined,'GET')).data;expect((await call(request,'/account/profile',{name:profile.name,preferences:{push:false,criticalSms:false,promotions:false}},'PATCH')).response.status()).toBe(200);
 const optedOut=await order(request);const report=await call(request,'/staff/notification-deliveries?orderId='+optedOut.id,undefined,'GET','admin');expect(report.data).toEqual([]);
 for(const current of [created,optedOut])expect((await call(request,'/orders/'+current.id+'/cancel',{reason:'Notification acceptance finished'})).response.status()).toBe(201);
});
test('push subscriptions are private, bounded to browser services, and removable',async({request},info)=>{
 test.skip(info.project.name!=='desktop');await signIn(request);const config=await call(request,'/push/config',undefined,'GET');expect(config.data.available).toBe(true);expect(config.data.publicKey).toMatch(/^[A-Za-z0-9_-]+$/);
 const curve=createECDH('prime256v1');curve.generateKeys();const keys={p256dh:curve.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')};
 expect((await call(request,'/push/subscriptions',{endpoint:'https://127.0.0.1/private',keys})).response.status()).toBe(400);
 const endpoint='https://fcm.googleapis.com/fcm/send/local-contract-'+randomUUID();expect((await call(request,'/push/subscriptions',{endpoint,keys})).response.status()).toBe(201);
 expect((await call(request,'/push/subscriptions',{endpoint},'DELETE')).response.status()).toBe(200);
});
test('recommendations are explainable, available and accept bounded event logs',async({request},info)=>{
 test.skip(info.project.name!=='desktop');const branch='019a0700-0000-7000-8000-000000000002';const result=await call(request,'/branches/'+branch+'/recommendations?daypart=lunch',undefined,'GET');expect(result.response.status(),JSON.stringify(result.data)).toBe(200);expect(result.data.groups.length).toBeGreaterThan(0);
 const item=result.data.groups[0].items[0];for(const group of result.data.groups){expect(group.reason).toBeTruthy();expect(group.items.every((item:any)=>item.available)).toBe(true);}
 expect((await call(request,'/recommendations/events',{branchId:branch,events:[{itemId:item.id,kind:'impression',source:result.data.groups[0].source}]})).response.status()).toBe(201);
 expect((await call(request,'/recommendations/events',{branchId:branch,events:[{itemId:'unknown-item',kind:'click',source:'popular'}]})).response.status()).toBe(400);
});
test('OTP requests keep their abuse limits inside an isolated test window',async({request},info)=>{
 test.skip(info.project.name!=='desktop');const phone='024'+randomInt(1000000,9999999);for(let index=0;index<3;index++)expect((await call(request,'/auth/otp',{phone})).response.status()).toBe(201);expect((await call(request,'/auth/otp',{phone})).response.status()).toBe(429);
});
