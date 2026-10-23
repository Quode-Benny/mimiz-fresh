import {test,expect,request} from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
test.setTimeout(90000);
test('staff can sign in, review the kitchen and open administration',async({page},info)=>{
 const [email,password]=(await readFile('.local-admin','utf8')).trim().split(/\r?\n/);
 await page.goto('/staff');await page.getByLabel('Email',{exact:true}).fill(email!);await page.getByLabel('Password',{exact:true}).fill(password!);
 await page.getByRole('button',{name:'Sign in to staff workspace'}).click();
 await expect(page.getByRole('heading',{name:'The kitchen, in sync.'})).toBeVisible();
 if(info.project.name==='mobile'){
  await expect(page.getByLabel('Search kitchen queue',{exact:true})).toBeVisible();
  for(const width of [320,360,390]){await page.setViewportSize({width,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);}
  for(const theme of ['light','dark']){await page.getByLabel('Appearance',{exact:true}).selectOption(theme);const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(scan.violations).toEqual([]);}
  await page.getByLabel('Appearance',{exact:true}).selectOption('system');await page.setViewportSize({width:360,height:800});
 }
 await page.getByRole('button',{name:'Menu',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Branch menu',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Smoky Ghana jollof',exact:true})).toBeVisible();
 await page.goto('/admin');
 await expect(page.getByLabel('Email',{exact:true})).toBeVisible();
 await page.getByLabel('Email',{exact:true}).fill(email!);await page.getByLabel('Password',{exact:true}).fill(password!);
 await page.getByRole('button',{name:'Sign in to administration',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Set your kitchen up for success.'})).toBeVisible();
 await page.getByRole('button',{name:'Kitchen settings',exact:true}).click();
 await expect(page.getByLabel('Kitchen name')).toHaveValue('Accra kitchen');
 await page.getByRole('button',{name:'Integrations',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Integration status',exact:true})).toBeVisible();
 await page.screenshot({path:'artifacts/screenshots/'+info.project.name+'-administration.png',fullPage:true});
});
test('owner photo uploads validate bytes and create responsive WebP images',async({request},info)=>{
 test.skip(info.project.name!=='desktop');
 const [email,password]=(await readFile('.local-admin','utf8')).trim().split(/\r?\n/);
 expect((await request.post('/api/v1/auth/staff-login',{data:{email,password}})).status()).toBe(201);
 const state=await request.storageState();const csrf=state.cookies.find(cookie=>cookie.name==='mimiz_csrf')!.value;
 const invalid=await request.post('/api/v1/staff/uploads',{headers:{'X-CSRF-Token':csrf},data:{data:'data:image/png;base64,ZmFrZQ=='}});expect(invalid.status()).toBe(400);
 const bytes=await readFile('apps/web/public/icons/icon-192.png');
 const valid=await request.post('/api/v1/staff/uploads',{headers:{'X-CSRF-Token':csrf},data:{data:'data:image/png;base64,'+bytes.toString('base64')}});
 expect(valid.status(),await valid.text()).toBe(201);const body=await valid.json();expect(body.url).toMatch(/640.webp$/);
 const image=await request.get(body.url);expect(image.status()).toBe(200);expect(image.headers()['content-type']).toContain('image/webp');
});
