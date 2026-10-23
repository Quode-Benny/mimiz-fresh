import {test,expect} from './fixtures';
import {readFile} from 'node:fs/promises';
test.describe('same-workspace tabs',()=>{
 test.use({serviceWorkers:'block'});
 test('two tabs renew one expired login without refresh-family reuse',async({page,context})=>{
  const [email,password]=(await readFile('.local-admin','utf8')).trim().split(/\r?\n/);
  await page.goto('/admin');await page.getByLabel('Email',{exact:true}).fill(email!);await page.getByLabel('Password',{exact:true}).fill(password!);
  await page.getByRole('button',{name:'Sign in to administration',exact:true}).click();await expect(page.getByRole('heading',{name:'Set your kitchen up for success.'})).toBeVisible();
  const second=await context.newPage();await second.goto('/admin');await expect(second.getByRole('heading',{name:'Set your kitchen up for success.'})).toBeVisible();
  let refreshes=0,waiting=0,open=false,release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  context.on('request',request=>{if(new URL(request.url()).pathname==='/api/v1/auth/refresh'&&request.method()==='POST')refreshes++;});
  await context.clearCookies({name:'mimiz_admin_access'});
  await context.route('**/api/v1/auth/me',async route=>{
   if(open){await route.continue();return;}
   const response=await route.fetch();
   if(response.status()===401){waiting++;if(waiting===2){open=true;release();}await gate;}
   await route.fulfill({response});
  });
  try{
   await Promise.all([page.reload(),second.reload()]);
   await expect(page.getByRole('heading',{name:'Set your kitchen up for success.'})).toBeVisible();await expect(second.getByRole('heading',{name:'Set your kitchen up for success.'})).toBeVisible();
   expect(refreshes).toBe(1);
   expect((await page.request.get('/api/v1/auth/me',{headers:{'X-Mimiz-Portal':'admin'}})).status()).toBe(200);
  }finally{open=true;release();await second.close();}
 });
 test('a temporary connection error after renewal does not sign the user out',async({page,context})=>{
  const [email,password]=(await readFile('.local-admin','utf8')).trim().split(/\r?\n/);
  await page.goto('/admin');await page.getByLabel('Email',{exact:true}).fill(email!);await page.getByLabel('Password',{exact:true}).fill(password!);await page.getByRole('button',{name:'Sign in to administration',exact:true}).click();await expect(page.getByRole('heading',{name:'Set your kitchen up for success.'})).toBeVisible();
  await page.close();await context.clearCookies({name:'mimiz_admin_access'});const second=await context.newPage();let renewed=false,aborted=false,refreshes=0;
  second.on('response',response=>{if(new URL(response.url()).pathname==='/api/v1/auth/refresh'&&response.status()===201){renewed=true;refreshes++;}});
  await second.route('**/api/v1/auth/me',async route=>{if(renewed&&!aborted){aborted=true;await route.abort('internetdisconnected');return;}await route.continue();});
  try{await second.goto('/admin');await expect(second.getByRole('heading',{name:'Set your kitchen up for success.'})).toBeVisible();expect(aborted).toBe(true);expect(refreshes).toBe(1);expect((await second.request.get('/api/v1/auth/me',{headers:{'X-Mimiz-Portal':'admin'}})).status()).toBe(200);}finally{await second.close();}
 });
});
