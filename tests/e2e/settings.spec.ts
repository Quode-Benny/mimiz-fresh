import {test,expect} from './fixtures';
import {readFile} from 'node:fs/promises';
import {randomInt,randomUUID} from 'node:crypto';
const branch='019a0700-0000-7000-8000-000000000002';
async function call(context:any,path:string,data?:any,method='POST',portal='admin'){
 const state=await context.storageState(),prefix=portal==='customer'?'mimiz':'mimiz_'+portal;
 const response=await context.fetch('/api/v1'+path,{method,data,headers:{'X-Mimiz-Portal':portal,'X-CSRF-Token':state.cookies.find((cookie:any)=>cookie.name===prefix+'_csrf')?.value||''}});
 return {response,data:await response.json()};
}
test('company fees, feature flags, concurrency and category visibility are enforced',async({request},info)=>{
 test.skip(info.project.name!=='desktop');
 const [email,password]=(await readFile('.local-admin','utf8')).trim().split(/\r?\n/);
 expect((await call(request,'/auth/staff-login',{email,password})).response.status()).toBe(201);
 const original=(await call(request,'/settings',undefined,'GET')).data;
 const payload={name:original.name,logo:original.logo,contact:{phone:original.contact.phone||'',email:original.contact.email||'',address:original.contact.address||''},settings:structuredClone(original.settings),version:original.version};
 const invalid=structuredClone(payload);invalid.settings.dayparts[0].start=invalid.settings.dayparts[0].end;
 expect((await call(request,'/staff/settings',invalid,'PATCH')).response.status()).toBe(400);
 let version=original.version;let categoryId='';
 try{
  const changed=structuredClone(payload);changed.settings.serviceFee={kind:'percent',value:1000};changed.settings.taxBps=500;changed.settings.flags.recommendations=false;
  const saved=await call(request,'/staff/settings',changed,'PATCH');expect(saved.response.status(),JSON.stringify(saved.data)).toBe(200);version=saved.data.version;
  expect((await call(request,'/staff/settings',payload,'PATCH')).response.status()).toBe(409);
  const recommendations=await call(request,'/branches/'+branch+'/recommendations?daypart=lunch',undefined,'GET','customer');expect(recommendations.data.groups).toEqual([]);
  const otp=await call(request,'/auth/otp',{phone:'024'+randomInt(1000000,9999999)},'POST','customer');
  expect((await call(request,'/auth/verify',{challengeId:otp.data.challengeId,code:'123456',name:'Settings acceptance'},'POST','customer')).response.status()).toBe(201);
  let cart=(await call(request,'/cart',undefined,'GET','customer')).data;
  cart=(await call(request,'/cart',{version:cart.version,branchId:branch,fulfillment:'pickup',selections:[{itemId:'sobolo',quantity:1,optionIds:[],note:''}]},'PUT','customer')).data;
  const quote=await call(request,'/checkout/quote',{cartId:cart.id,cartVersion:cart.version,paymentMethod:'cash'},'POST','customer');expect(quote.response.status(),JSON.stringify(quote.data)).toBe(201);
  expect(quote.data.serviceFee).toBe(150);expect(quote.data.tax).toBe(83);expect(quote.data.total).toBe(1733);
  const category={branchId:branch,name:'QA category '+randomUUID().slice(0,8),description:'Acceptance category',active:false,sortOrder:1,parentId:null,image:''};
  const created=await call(request,'/staff/categories',category);expect(created.response.status(),JSON.stringify(created.data)).toBe(201);categoryId=created.data.id;
  expect((await call(request,'/branches/'+branch+'/categories',undefined,'GET','customer')).data.some((row:any)=>row.id===categoryId)).toBe(false);
  expect((await call(request,'/staff/categories',{...category,id:categoryId,active:true})).response.status()).toBe(201);
  expect((await call(request,'/branches/'+branch+'/categories',undefined,'GET','customer')).data.some((row:any)=>row.id===categoryId)).toBe(true);
  expect((await call(request,'/staff/categories/reorder',{branchId:branch,ids:[categoryId]})).response.status()).toBe(201);
 }finally{
  expect((await call(request,'/staff/settings',{...payload,version},'PATCH')).response.status()).toBe(200);
  if(categoryId)await call(request,'/staff/categories',{branchId:branch,id:categoryId,name:'QA category archived '+categoryId.slice(0,8),active:false});
 }
});
