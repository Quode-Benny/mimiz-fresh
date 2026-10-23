import {test,expect,request as http} from './fixtures';
import {readFile} from 'node:fs/promises';
import {randomInt,randomUUID} from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
test('kitchen queue paginates a busy shift and updates stage counts after approval',async({browser},info)=>{
 test.skip(info.project.name!=='desktop');test.setTimeout(180000);
 const root='http://localhost:3002',owner=await http.newContext({baseURL:root}),buyers:any[]=[],ids:string[]=[],marker='Queue'+randomUUID().slice(0,8);let ui:any;
 async function call(c:any,path:string,data?:any,method='POST',portal='customer',extra:any={}){
  const prefix=portal==='customer'?'mimiz':'mimiz_'+portal,csrf=(await c.storageState()).cookies.find((x:any)=>x.name===prefix+'_csrf')?.value||'';
  const r=await c.fetch('/api/v1'+path,{method,data,headers:{'X-Mimiz-Portal':portal,'X-CSRF-Token':csrf,...extra}});expect(r.ok(),path+' '+r.status()).toBe(true);return r.json();
 }
 try{
  const [email,password]=(await readFile('.local-admin','utf8')).trim().split(/\r?\n/);await call(owner,'/auth/staff-login',{email,password},'POST','staff');
  for(let i=0;i<3;i++){const c=await http.newContext({baseURL:root});buyers.push(c);const otp=await call(c,'/auth/otp',{phone:'024'+randomInt(1000000,9999999)});await call(c,'/auth/verify',{challengeId:otp.challengeId,code:'123456',name:marker+' '+i});}
  for(let i=0;i<13;i++){
   const c=buyers[i%3];let cart=await call(c,'/cart',undefined,'GET');cart=await call(c,'/cart',{version:cart.version,branchId:cart.branch_id,fulfillment:'pickup',selections:[{itemId:'sobolo',quantity:1,optionIds:[],note:'Queue pagination acceptance'}]},'PUT');
   const order=await call(c,'/orders',{cartId:cart.id,cartVersion:cart.version,paymentMethod:'cash'},'POST','customer',{'Idempotency-Key':randomUUID()});ids.push(order.id);
  }
  const queue=await call(owner,'/staff/queue?stage=new&search='+marker,undefined,'GET','staff');expect(queue.total).toBe(13);expect(queue.items).toHaveLength(12);
  const second=await call(owner,'/staff/queue?stage=new&page=2&search='+marker,undefined,'GET','staff');expect(second.items).toHaveLength(1);expect(new Set([...queue.items,...second.items].map((o:any)=>o.id)).size).toBe(13);
  expect((await buyers[0].get('/api/v1/staff/queue',{headers:{'X-Mimiz-Portal':'customer'}})).status()).toBe(403);
  ui=await browser.newContext({storageState:await owner.storageState()});const page=await ui.newPage();await page.goto(root+'/staff');await page.getByLabel('Search kitchen queue',{exact:true}).fill(marker);
  await expect(page.locator('.queue-grid .ticket')).toHaveCount(12);await expect(page.getByRole('button',{name:/^New\s*13$/})).toBeVisible();
  await page.getByRole('button',{name:'Next page',exact:true}).click();await expect(page.locator('.queue-grid .ticket')).toHaveCount(1);
  await page.getByRole('button',{name:'Accept order',exact:true}).click();await page.getByRole('button',{name:'Approve order',exact:true}).click();
  await expect(page.getByRole('button',{name:/^Preparing\s*1$/})).toBeVisible();await page.getByRole('button',{name:/^Preparing\s*1$/}).click();await expect(page.locator('.queue-grid .ticket')).toHaveCount(1);
  await expect(page.locator('.queue-grid .status-badge')).toHaveText('accepted');
  for(const theme of ['light','dark']){await page.getByLabel('Appearance',{exact:true}).selectOption(theme);const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(scan.violations).toEqual([]);await page.screenshot({path:'artifacts/screenshots/kitchen-queue-'+theme+'.png',fullPage:true});}
 }finally{
  if(ui)await ui.close();
  for(const id of ids)await call(owner,'/orders/'+id+'/cancel',{reason:'Queue acceptance completed'},'POST','staff').catch(()=>{});
  for(const c of buyers){await call(c,'/account',{confirmation:'DELETE'},'DELETE').catch(()=>{});await c.dispose();}await owner.dispose();
 }
});
