import {test,expect} from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import {readFile} from 'node:fs/promises';
import {randomUUID,randomInt} from 'node:crypto';
test('appearance follows the system, persists an override and discovery dialogs work',async({page})=>{
 await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await expect(page.getByRole('heading',{name:'A little taste of home.'})).toBeVisible();
 await page.getByLabel('Appearance',{exact:true}).selectOption('light');await expect(page.locator('html')).toHaveAttribute('data-theme','light');await page.reload();await expect(page.getByLabel('Appearance',{exact:true})).toHaveValue('light');
 const first=await page.locator('.spotlight h2').innerText();await page.getByRole('button',{name:'Next spotlight dish'}).click();await expect(page.locator('.spotlight h2')).not.toHaveText(first);
 await page.getByRole('button',{name:'Help me choose',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Vegetarian',exact:true}).click();await expect(page.locator('.taste-results>button').first()).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Help me choose',exact:true})).toBeFocused();
 await page.getByLabel('Appearance',{exact:true}).selectOption('dark');const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(axe.violations).toEqual([]);
 await page.getByLabel('Appearance',{exact:true}).selectOption('system');await page.emulateMedia({colorScheme:'light'});await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});
test('customer profile sections save preferences and support can request a person',async({page,context})=>{
 async function call(path:string,data?:any,method='POST'){const csrf=(await context.cookies()).find(c=>c.name==='mimiz_csrf')?.value||'';const response=await context.request.fetch('/api/v1'+path,{method,data,headers:{'X-Mimiz-Portal':'customer','X-CSRF-Token':csrf}});expect(response.ok()).toBe(true);return response.json();}
 const sent=await call('/auth/otp',{phone:'024'+randomInt(1000000,9999999)});await call('/auth/verify',{challengeId:sent.challengeId,code:'123456',name:'Sandbox profile'});
 await page.goto('/account');await expect(page.getByRole('heading',{name:'Hello, Sandbox.'})).toBeVisible();await page.getByLabel('Your name',{exact:true}).fill('Sandbox profile saved');await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Your profile and preferences are saved.'})).toBeVisible();
 await page.getByRole('button',{name:'Saved places',exact:true}).click();await expect(page.getByRole('heading',{name:'Your saved places'})).toBeVisible();
 await page.getByRole('button',{name:'Help & support',exact:true}).click();await page.getByRole('button',{name:'Start a conversation',exact:true}).click();
 await page.getByLabel('Message the kitchen',{exact:true}).fill('I need a human to help with a refund.');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByText('Human support queue',{exact:true})).toBeVisible();
 const threadId=(await call('/support/threads',{branchId:'019a0700-0000-7000-8000-000000000002'})).id;const info=await call('/threads/'+threadId,undefined,'GET');expect(info.supportMode).toBe('human');
 await page.getByRole('button',{name:'Your updates',exact:true}).click();await expect(page.getByRole('heading',{name:'Updates for you'})).toBeVisible();await call('/account',{confirmation:'DELETE'},'DELETE');
});
test('kitchen approval waits for confirmation and customer tracking reflects acceptance',async({page,context})=>{
 async function call(path:string,data?:any,method='POST',portal='customer',extra:Record<string,string>={}){const prefix=portal==='customer'?'mimiz':'mimiz_'+portal,csrf=(await context.cookies()).find(c=>c.name===prefix+'_csrf')?.value||'';const response=await context.request.fetch('/api/v1'+path,{method,data,headers:{'X-Mimiz-Portal':portal,'X-CSRF-Token':csrf,...extra}});expect(response.ok()).toBe(true);return response.json();}
 const sent=await call('/auth/otp',{phone:'024'+randomInt(1000000,9999999)});await call('/auth/verify',{challengeId:sent.challengeId,code:'123456',name:'Sandbox approval'});
 let cart=await call('/cart',undefined,'GET');cart=await call('/cart',{version:cart.version,branchId:cart.branch_id,fulfillment:'pickup',selections:[{itemId:'sobolo',optionIds:[],quantity:3,note:'Sandbox approval review'}]},'PUT');
 const order=await call('/orders',{cartId:cart.id,cartVersion:cart.version,paymentMethod:'cash'},'POST','customer',{'Idempotency-Key':randomUUID()});
 const [email,password]=(await readFile('.local-admin','utf8')).trim().split(/\r?\n/);await call('/auth/staff-login',{email,password},'POST','staff');
 await page.goto('/staff');await page.getByLabel('Search kitchen queue',{exact:true}).fill(order.number);const ticket=page.locator('.ticket').filter({hasText:order.number});await ticket.getByRole('button',{name:'Accept order',exact:true}).click();await expect(page.getByRole('dialog',{name:'Approve this order?'})).toBeVisible();expect((await call('/orders/'+order.id,undefined,'GET')).status).toBe('placed');await page.getByRole('button',{name:'Approve order',exact:true}).click();await expect(ticket).toHaveCount(0);await page.getByRole('button',{name:/^Preparing/}).click();await expect(ticket.locator('.status-badge')).toHaveText('accepted');
 await page.goto('/orders/'+order.id);await expect(page.getByRole('heading',{name:'Kitchen approved',exact:true})).toBeVisible();await expect(page.locator('.progress-steps [aria-current=step]')).toContainText('Approved');await expect(page.locator('.tracking-history')).toHaveCount(0);await call('/orders/'+order.id+'/cancel',{reason:'Sandbox acceptance finished'},'POST','staff');await call('/account',{confirmation:'DELETE'},'DELETE');
});
