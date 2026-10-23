const {chromium}=require('@playwright/test'),AxeBuilder=require('@axe-core/playwright').default;
const {readFile,writeFile,mkdir}=require('node:fs/promises'),{randomUUID,randomInt}=require('node:crypto');
(async()=>{
 await mkdir('artifacts',{recursive:true});const theme=process.env.REVIEW_THEME==='dark'?'dark':'light';
 const safety=await fetch('http://127.0.0.1:4000/api/v1/config');if(!(await safety.json()).safeAcceptance)throw Error('Local demo mode is required.');
 const [email,password]=(await readFile('.local-admin','utf8')).trim().split(/\r?\n/);
 const browser=await chromium.launch(),context=await browser.newContext({baseURL:'http://localhost:3002',serviceWorkers:'block',colorScheme:theme}),page=await context.newPage();page.setDefaultNavigationTimeout(120000);
 let orderId='',riderId='',customerSignedIn=false;const output=[];
 async function call(path,data,method='POST',portal='customer'){
  const prefix=portal==='customer'?'mimiz':'mimiz_'+portal,csrf=(await context.cookies()).find(c=>c.name===prefix+'_csrf')?.value||'';
  const response=await context.request.fetch('/api/v1'+path,{method,data,headers:{'X-Mimiz-Portal':portal,'X-CSRF-Token':csrf}});
  if(!response.ok())throw Error('Review request failed: '+method+' '+path+' '+response.status());return response.json();
 }
 async function scan(name){
  await page.waitForLoadState('networkidle',{timeout:10000});
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  output.push({name,violations:result.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target.map(t=>String(t).replaceAll(email,'[redacted]')))}))});
 }
 try{
  await context.route('**://*.tile.openstreetmap.org/**',route=>route.abort());
  const sent=await call('/auth/otp',{phone:'024'+randomInt(1000000,9999999)});await call('/auth/verify',{challengeId:sent.challengeId,code:'123456',name:'Accessibility review'});customerSignedIn=true;
  await page.setViewportSize({width:360,height:800});
  await page.goto('/account');await page.getByRole('heading',{name:'A little more you.',exact:true}).waitFor();await scan('mobile customer account');
  await page.goto('/orders');await scan('mobile customer orders');
  let cart=await call('/cart',undefined,'GET');
  cart=await call('/cart',{version:cart.version,branchId:cart.branch_id,fulfillment:'delivery',selections:[{itemId:'sobolo',optionIds:[],quantity:3,note:''}]},'PUT');
  await page.goto('/checkout');await scan('mobile delivery checkout');
  cart=await call('/cart',{version:cart.version,branchId:cart.branch_id,fulfillment:'pickup',selections:cart.selections},'PUT');
  const csrf=(await context.cookies()).find(c=>c.name==='mimiz_csrf')?.value||'';
  const placed=await context.request.post('/api/v1/orders',{data:{cartId:cart.id,cartVersion:cart.version,paymentMethod:'cash'},headers:{'X-Mimiz-Portal':'customer','X-CSRF-Token':csrf,'Idempotency-Key':randomUUID()}});
  if(!placed.ok())throw Error('Review pickup order failed.');orderId=(await placed.json()).id;
  await page.goto('/orders/'+orderId);await scan('mobile order tracking');
  await call('/auth/staff-login',{email,password},'POST','staff');await page.goto('/staff');await page.getByRole('heading',{name:'The kitchen, in sync.',exact:true}).waitFor();await scan('mobile kitchen');
  await call('/auth/staff-login',{email,password},'POST','admin');await page.goto('/admin');await page.getByRole('heading',{name:'Set your kitchen up for success.',exact:true}).waitFor();
  for(const tab of ['Reports','Team','Kitchen settings','Customers','Notifications','Delivery zones','Promotions','Company settings','Categories','Integrations']){
   await page.getByRole('button',{name:tab,exact:true}).click();await scan('mobile admin '+tab);
  }
  const riderEmail='qa-a11y-'+randomUUID()+'@example.test',riderPassword='QA-'+randomUUID();
  riderId=(await call('/staff/users',{name:'QA accessibility rider',email:riderEmail,password:riderPassword,role:'rider',branchId:'019a0700-0000-7000-8000-000000000002'},'POST','admin')).id;
  await call('/auth/staff-login',{email:riderEmail,password:riderPassword},'POST','rider');await page.goto('/rider');await page.getByRole('heading',{name:'Your deliveries',exact:true}).waitFor();await scan('mobile rider');
  await writeFile('artifacts/accessibility-review-'+theme+'.json',JSON.stringify(output,null,2));console.log(JSON.stringify(output));if(output.some(result=>result.violations.length))throw Error('Accessibility violations remain; see the private review artifact.');
 }finally{
  if(orderId)await call('/orders/'+orderId+'/cancel',{reason:'Accessibility review finished'}).catch(()=>{});
  if(riderId)await call('/staff/users/'+riderId,undefined,'DELETE','admin').catch(()=>{});
  if(customerSignedIn)await call('/account',{confirmation:'DELETE'},'DELETE').catch(()=>{});
  await context.close();await browser.close();
 }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
