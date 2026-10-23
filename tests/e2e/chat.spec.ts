import {test,expect,request as http} from './fixtures';
import {readFile} from 'node:fs/promises';
import {randomInt,randomUUID} from 'node:crypto';
async function call(context:any,path:string,data?:any,method='POST',portal='customer'){const state=await context.storageState(),prefix=portal==='customer'?'mimiz':'mimiz_'+portal;const csrf=state.cookies.find((cookie:any)=>cookie.name===prefix+'_csrf')?.value||'';const response=await context.fetch('/api/v1'+path,{method,data,headers:{'X-Mimiz-Portal':portal,'X-CSRF-Token':csrf}});return {response,data:await response.json()};}
async function customer(context:any){const sent=await call(context,'/auth/otp',{phone:'024'+randomInt(1000000,9999999)});expect(sent.response.status()).toBe(201);expect((await call(context,'/auth/verify',{challengeId:sent.data.challengeId,code:'123456',name:'Support acceptance'})).response.status()).toBe(201);}
async function owner(context:any){const [email,password]=(await readFile('.local-admin','utf8')).trim().split(/\r?\n/);expect((await call(context,'/auth/staff-login',{email,password},'POST','admin')).response.status()).toBe(201);}
test('support conversations enforce ownership, photo privacy, claims and read receipts',async({},info)=>{
 test.skip(info.project.name!=='desktop');const buyer=await http.newContext({baseURL:'http://localhost:3002'}),support=await http.newContext({baseURL:'http://localhost:3002'}),stranger=await http.newContext({baseURL:'http://localhost:3002'});
 try{
 await customer(buyer);await customer(stranger);await owner(support);
 const opened=await call(buyer,'/support/threads',{branchId:'019a0700-0000-7000-8000-000000000002'});expect(opened.response.status()).toBe(201);const id=opened.data.id;
 expect((await call(stranger,'/threads/'+id+'/messages',undefined,'GET')).response.status()).toBe(403);
 const sent=await call(buyer,'/threads/'+id+'/messages',{body:'Please confirm the pickup entrance.'});expect(sent.response.status()).toBe(201);expect(sent.data[0].read_at).toBeNull();
 expect((await call(support,'/threads/'+id+'/claim',{claim:true},'POST','admin')).response.status()).toBe(201);
 const read=await call(support,'/threads/'+id+'/messages',undefined,'GET','admin');expect(read.data[0].read_at).toBeTruthy();
 expect((await call(support,'/threads/'+id+'/typing',{},'POST','admin')).response.status()).toBe(201);const typing=await call(buyer,'/threads/'+id+'/presence',undefined,'GET');expect(typing.data.length).toBe(1);
 const png=await readFile('apps/web/public/icons/icon-192.png');const photo=await call(buyer,'/threads/'+id+'/attachments',{data:'data:image/png;base64,'+png.toString('base64')});expect(photo.response.status()).toBe(201);
 const imagePath='/api/v1/threads/'+id+'/attachments/'+photo.data.id;
 expect((await stranger.get(imagePath,{headers:{'X-Mimiz-Portal':'customer'}})).status()).toBe(403);
 const image=await support.get(imagePath,{headers:{'X-Mimiz-Portal':'admin'}});expect(image.status()).toBe(200);expect(image.headers()['content-type']).toContain('image/webp');expect(image.headers()['cache-control']).toContain('no-store');
 expect((await call(buyer,'/threads/'+id+'/messages',{body:'Here is the sign.',attachments:[photo.data.id]})).response.status()).toBe(201);
 const reply=await call(support,'/threads/'+id+'/messages',{body:'We can help you find the entrance.'},'POST','admin');expect(reply.response.status()).toBe(201);expect(reply.data.at(-1).read_at).toBeNull();
 await call(buyer,'/threads/'+id+'/messages',undefined,'GET');const acknowledged=await call(support,'/threads/'+id+'/messages',undefined,'GET','admin');expect(acknowledged.data.at(-1).read_at).toBeTruthy();
 expect((await call(buyer,'/account',{confirmation:'DELETE'},'DELETE')).response.status()).toBe(200);
 expect((await support.get(imagePath,{headers:{'X-Mimiz-Portal':'admin'}})).status()).toBe(404);
 const retained=await call(support,'/threads/'+id+'/messages',undefined,'GET','admin');expect(retained.data.at(-1).body).toBe('We can help you find the entrance.');
 }finally{await buyer.dispose();await support.dispose();await stranger.dispose();}
});
test('kitchen accounts cannot enter private support conversations',async({request},info)=>{
 test.skip(info.project.name!=='desktop');await customer(request);const opened=await call(request,'/support/threads',{branchId:'019a0700-0000-7000-8000-000000000002'});await owner(request);
 const password='QA-'+randomUUID(),email='qa-kitchen-'+randomUUID()+'@example.test';const created=await call(request,'/staff/users',{name:'QA kitchen role',email,password,role:'kitchen_staff',branchId:'019a0700-0000-7000-8000-000000000002'},'POST','admin');expect(created.response.status()).toBe(201);
 try{
 expect((await call(request,'/auth/staff-login',{email,password},'POST','staff')).response.status()).toBe(201);
 expect((await call(request,'/threads/'+opened.data.id+'/messages',undefined,'GET','staff')).response.status()).toBe(403);
 expect((await call(request,'/staff/chats',undefined,'GET','staff')).response.status()).toBe(403);
 }finally{await call(request,'/staff/users/'+created.data.id,undefined,'DELETE','admin');}
});
test('customer and staff can exchange a photo conversation in separate portal tabs',async({page},info)=>{
 const name='Browser support '+randomUUID().slice(0,6);
 await page.goto('/login?next=/account');await page.getByLabel('Your name').fill(name);await page.getByLabel('Phone number').fill('024'+randomInt(1000000,9999999));await page.getByRole('button',{name:'Send my code',exact:true}).click();await page.getByLabel('Six-digit code').fill('123456');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByRole('button',{name:'Help & support',exact:true}).click();await page.getByRole('button',{name:'Start a conversation',exact:true}).click();await page.getByLabel('Message the kitchen',{exact:true}).fill('Browser conversation with a photo.');
 await page.getByLabel('Attach a photo',{exact:true}).setInputFiles('apps/web/public/icons/icon-192.png');await expect(page.locator('.attachment-previews img')).toBeVisible();await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.locator('.chat-message').getByText('Browser conversation with a photo.',{exact:true})).toBeVisible();
 const staffPage=await page.context().newPage();const [email,password]=(await readFile('.local-admin','utf8')).trim().split(/\r?\n/);
 await staffPage.goto('/staff');await staffPage.getByLabel('Email',{exact:true}).fill(email!);await staffPage.getByLabel('Password',{exact:true}).fill(password!);await staffPage.getByRole('button',{name:'Sign in to staff workspace',exact:true}).click();
 await staffPage.getByRole('button',{name:'Support',exact:true}).click();await staffPage.locator('.conversation-choice').filter({hasText:name}).click();await expect(staffPage.locator('.chat-message img')).toBeVisible();
 await staffPage.getByLabel('Message the kitchen',{exact:true}).fill('Your photo came through. The team can help.');await staffPage.getByRole('button',{name:'Send',exact:true}).click();
 await page.bringToFront();await expect(page.getByText('Your photo came through. The team can help.',{exact:true})).toBeVisible();await page.screenshot({path:'artifacts/screenshots/'+info.project.name+'-private-support.png',fullPage:true});await staffPage.close();
});
