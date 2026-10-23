import {test,expect} from './fixtures';
import {readFile} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
test('staff busy mode and administration settings work on this screen',async({page},info)=>{
 const [email,password]=(await readFile('.local-admin','utf8')).trim().split(/\r?\n/);
 await page.goto('/staff');await page.getByLabel('Email',{exact:true}).fill(email!);await page.getByLabel('Password',{exact:true}).fill(password!);
 await page.getByRole('button',{name:'Sign in to staff workspace'}).click();
 const control=page.getByLabel('Extra preparation time when busy');await expect(control).toBeVisible();const original=await control.inputValue();
 try{
  await control.selectOption('10');await page.getByRole('button',{name:'Update preparation time',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Kitchen operating settings updated.'})).toBeVisible();
  await expect(control).toHaveValue('10');
 }finally{await control.selectOption(original);await page.getByRole('button',{name:'Update preparation time',exact:true}).click();await expect(control).toHaveValue(original);}
 await page.getByRole('button',{name:'All orders',exact:true}).click();await page.getByLabel('Find an order').fill('No such order acceptance');
 await expect(page.locator('.order-card')).toHaveCount(0);
 await page.goto('/admin');await page.getByLabel('Email',{exact:true}).fill(email!);await page.getByLabel('Password',{exact:true}).fill(password!);
 await page.getByRole('button',{name:'Sign in to administration',exact:true}).click();
 await page.getByRole('button',{name:'Company settings',exact:true}).click();await expect(page.getByRole('heading',{name:'Dayparts in Ghana time',exact:true})).toBeVisible();
 const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(scan.violations).toEqual([]);
 await page.getByRole('button',{name:'Categories',exact:true}).click();await expect(page.getByRole('heading',{name:'Menu categories',exact:true})).toBeVisible();
 await page.screenshot({path:'artifacts/screenshots/'+info.project.name+'-categories.png',fullPage:true});
});
