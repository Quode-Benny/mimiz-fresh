import {test,expect} from './fixtures';
import {readFile} from 'node:fs/promises';
test('portal cookies isolate customer, staff, administration and rider sessions',async({request},info)=>{
 test.skip(info.project.name!=='desktop');
 const [email,password]=(await readFile('.local-admin','utf8')).trim().split(/\r?\n/);
 const staff={'X-Mimiz-Portal':'staff'},admin={'X-Mimiz-Portal':'admin'},customer={'X-Mimiz-Portal':'customer'},rider={'X-Mimiz-Portal':'rider'};
 expect((await request.post('/api/v1/auth/staff-login',{headers:staff,data:{email,password}})).status()).toBe(201);
 expect((await request.get('/api/v1/auth/me',{headers:staff})).status()).toBe(200);
 for(const headers of [admin,customer,rider])expect((await request.get('/api/v1/auth/me',{headers})).status()).toBe(401);
 expect((await request.post('/api/v1/auth/staff-login',{headers:rider,data:{email,password}})).status()).toBe(403);
 expect((await request.post('/api/v1/auth/staff-login',{headers:admin,data:{email,password}})).status()).toBe(201);
 const otp=await request.post('/api/v1/auth/otp',{headers:customer,data:{phone:'0240007801'}});
 const {challengeId}=await otp.json();expect(otp.status()).toBe(201);
 expect((await request.post('/api/v1/auth/verify',{headers:customer,data:{challengeId,code:'123456',name:'Portal isolation'}})).status()).toBe(201);
 const state=await request.storageState();
 const staffCsrf=state.cookies.find(cookie=>cookie.name==='mimiz_staff_csrf')!.value;
 const customerCsrf=state.cookies.find(cookie=>cookie.name==='mimiz_csrf')!.value;
 expect((await request.patch('/api/v1/staff/catalogue/jollof',{headers:{...staff,'X-CSRF-Token':customerCsrf},data:{}})).status()).toBe(403);
 expect((await request.get('/api/v1/staff/users',{headers:customer})).status()).toBe(403);
 expect((await request.post('/api/v1/auth/refresh',{headers:admin})).status()).toBe(201);
 expect((await request.post('/api/v1/auth/logout',{headers:{...staff,'X-CSRF-Token':staffCsrf}})).status()).toBe(201);
 expect((await request.get('/api/v1/auth/me',{headers:staff})).status()).toBe(401);
 expect((await request.get('/api/v1/auth/me',{headers:admin})).status()).toBe(200);
 expect((await request.get('/api/v1/auth/me',{headers:customer})).status()).toBe(200);
});
test('each workspace has its own entrance without cross-role navigation',async({page},info)=>{
 for(const portal of ['staff','admin','rider']){
  await page.goto('/'+portal);
  await expect(page.getByLabel('Email',{exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Menu',exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'My orders',exact:true})).toHaveCount(0);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
  expect(overflow).toBe(false);
  await page.screenshot({path:'artifacts/screenshots/'+info.project.name+'-'+portal+'-entrance.png',fullPage:true});
 }
});
test('an expired administration access cookie renews without signing out other portals',async({page,context})=>{
 const [email,password]=(await readFile('.local-admin','utf8')).trim().split(/\r?\n/);
 await page.goto('/admin');await page.getByLabel('Email',{exact:true}).fill(email!);await page.getByLabel('Password',{exact:true}).fill(password!);
 await page.getByRole('button',{name:'Sign in to administration',exact:true}).click();await expect(page.getByRole('heading',{name:'Set your kitchen up for success.'})).toBeVisible();
 await context.clearCookies({name:'mimiz_admin_access'});await page.reload();
 await expect(page.getByRole('heading',{name:'Set your kitchen up for success.'})).toBeVisible();
 expect((await context.cookies()).some(cookie=>cookie.name==='mimiz_admin_access')).toBe(true);
});
