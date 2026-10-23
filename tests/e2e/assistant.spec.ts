import {test,expect,request as http} from './fixtures';
import {readFile} from 'node:fs/promises';
import {randomInt} from 'node:crypto';
test('local AI answers with current menu facts and hands the same conversation to a person',async({browser},info)=>{
 test.skip(info.project.name!=='desktop');
 const root='http://localhost:3002',buyer=await http.newContext({baseURL:root}),other=await http.newContext({baseURL:root}),staff=await http.newContext({baseURL:root});
 async function call(context:any,path:string,data?:any,method='POST',portal='customer'){const prefix=portal==='customer'?'mimiz':'mimiz_'+portal,csrf=(await context.storageState()).cookies.find((cookie:any)=>cookie.name===prefix+'_csrf')?.value||'';const response=await context.fetch('/api/v1'+path,{method,data,headers:{'X-Mimiz-Portal':portal,'X-CSRF-Token':csrf}});expect(response.ok(),method+' '+path+' '+response.status()).toBe(true);return response.json();}
 async function login(context:any){const sent=await call(context,'/auth/otp',{phone:'024'+randomInt(1000000,9999999)});await call(context,'/auth/verify',{challengeId:sent.challengeId,code:'123456',name:'Local assistant acceptance'});}
 try{
  await login(buyer);await login(other);
  const id=(await call(buyer,'/support/threads',{branchId:'019a0700-0000-7000-8000-000000000002'})).id;
  expect((await call(buyer,'/threads/'+id,undefined,'GET')).supportMode).toBe('assistant');
  expect((await other.get('/api/v1/threads/'+id,{headers:{'X-Mimiz-Portal':'customer'}})).status()).toBe(403);
  await call(buyer,'/threads/'+id+'/messages',{body:'What food is on the menu?'});
  await expect.poll(async()=>{const messages=await call(buyer,'/threads/'+id+'/messages',undefined,'GET');return messages.find((message:any)=>message.source==='assistant')?.body||'';},{timeout:60000,intervals:[1000,2000,4000]}).toContain('current kitchen menu');
  await call(buyer,'/threads/'+id+'/messages',{body:'can you order the sobolo for me?'});
  await expect.poll(async()=>{const m=await call(buyer,'/threads/'+id+'/messages',undefined,'GET');return m.filter((x:any)=>x.source==='assistant').at(-1)?.actions?.[0]?.name||'';},{timeout:30000}).toBe('Chilled sobolo');
  await call(buyer,'/threads/'+id+'/messages',{body:'i want Ampesi & kontomire , 2 of that'});
  await expect.poll(async()=>{const m=await call(buyer,'/threads/'+id+'/messages',undefined,'GET');return m.filter((x:any)=>x.source==='assistant').at(-1)?.actions?.[0]?.quantity||0;},{timeout:30000}).toBe(2);
  expect((await call(buyer,'/cart',undefined,'GET')).selections).toHaveLength(0);
  const ui=await browser.newContext({storageState:await buyer.storageState()}),page=await ui.newPage();
  try{
   await page.goto(root+'/account');await page.getByRole('button',{name:'Help & support',exact:true}).click();await page.getByRole('button',{name:'Start a conversation',exact:true}).click();
   await page.getByRole('button',{name:'Review 2 x Ampesi & kontomire',exact:true}).click();
   const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(dialog.locator('.stepper>span')).toHaveText('2');
   await dialog.getByRole('button',{name:/Add to bag/}).click();await expect(dialog).not.toBeVisible();
   const bag=await call(buyer,'/cart',undefined,'GET');expect(bag.selections).toHaveLength(1);expect(bag.selections[0].quantity).toBe(2);
  }finally{await ui.close();}
  await call(buyer,'/threads/'+id+'/handover',{});expect((await call(buyer,'/threads/'+id,undefined,'GET')).supportMode).toBe('human');
  const [email,password]=(await readFile('.local-admin','utf8')).trim().split(/\r?\n/);await call(staff,'/auth/staff-login',{email,password},'POST','staff');await call(staff,'/threads/'+id+'/claim',{claim:true},'POST','staff');await call(staff,'/threads/'+id+'/messages',{body:'A team member has taken over this conversation.'},'POST','staff');
  const history=await call(buyer,'/threads/'+id+'/messages',undefined,'GET');expect(history.some((message:any)=>message.source==='assistant')).toBe(true);expect(history.at(-1).body).toBe('A team member has taken over this conversation.');
  const sensitive=(await call(other,'/support/threads',{branchId:'019a0700-0000-7000-8000-000000000002'})).id;
  await call(other,'/threads/'+sensitive+'/messages',{body:'I have a peanut allergy. Can someone help?'});expect((await call(other,'/threads/'+sensitive,undefined,'GET')).supportMode).toBe('human');
 }finally{await call(buyer,'/account',{confirmation:'DELETE'},'DELETE').catch(()=>{});await call(other,'/account',{confirmation:'DELETE'},'DELETE').catch(()=>{});await buyer.dispose();await other.dispose();await staff.dispose();}
});
