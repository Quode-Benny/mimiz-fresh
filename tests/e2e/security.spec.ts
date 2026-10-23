import {test,expect,request as http} from './fixtures';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {hotp} from '../../packages/security/src/index';
async function call(context:any,path:string,data?:any,method='POST',portal='staff'){const state=await context.storageState(),prefix='mimiz_'+portal;const csrf=state.cookies.find((cookie:any)=>cookie.name===prefix+'_csrf')?.value||'';const response=await context.fetch('/api/v1'+path,{method,data,headers:{'X-Mimiz-Portal':portal,'X-CSRF-Token':csrf}});return {response,data:await response.json()};}
test('staff authenticator enrollment enforces codes, replay protection and one-time recovery',async({},info)=>{
 test.skip(info.project.name!=='desktop');
 const owner=await http.newContext({baseURL:'http://localhost:3002'}),staff=await http.newContext({baseURL:'http://localhost:3002'});
 const [ownerEmail,ownerPassword]=(await readFile('.local-admin','utf8')).trim().split(/\r?\n/);
 expect((await call(owner,'/auth/staff-login',{email:ownerEmail,password:ownerPassword},'POST','admin')).response.status()).toBe(201);
 const email='qa-factor-'+randomUUID()+'@example.test',password='QA-'+randomUUID();
 const created=await call(owner,'/staff/users',{email,password,name:'QA authenticator',role:'kitchen_staff',branchId:'019a0700-0000-7000-8000-000000000002'},'POST','admin');expect(created.response.status()).toBe(201);
 try{
 expect((await call(staff,'/auth/staff-login',{email,password})).response.status()).toBe(201);
 expect((await call(staff,'/auth/2fa/setup',{password:'wrong-password'})).response.status()).toBe(401);
 const setup=await call(staff,'/auth/2fa/setup',{password});expect(setup.response.status()).toBe(201);expect(setup.data.uri).toContain('otpauth://totp/');
 const confirmed=await call(staff,'/auth/2fa/confirm',{code:hotp(setup.data.secret,Math.floor(Date.now()/30000))});expect(confirmed.response.status()).toBe(201);expect(confirmed.data.recoveryCodes).toHaveLength(10);
 expect((await call(staff,'/auth/logout')).response.status()).toBe(201);
 const challenge=await call(staff,'/auth/staff-login',{email,password});expect(challenge.response.status()).toBe(401);expect(challenge.data.code).toBe('SECOND_FACTOR_REQUIRED');
 expect((await call(staff,'/auth/staff-login',{email,password,code:'invalid-code'})).response.status()).toBe(401);
 const code=hotp(setup.data.secret,Math.floor(Date.now()/30000)+1);expect((await call(staff,'/auth/staff-login',{email,password,code})).response.status()).toBe(201);
 await call(staff,'/auth/logout');expect((await call(staff,'/auth/staff-login',{email,password,code})).response.status()).toBe(401);
 expect((await call(staff,'/auth/staff-login',{email,password,code:confirmed.data.recoveryCodes[0]})).response.status()).toBe(201);
 await call(staff,'/auth/logout');expect((await call(staff,'/auth/staff-login',{email,password,code:confirmed.data.recoveryCodes[0]})).response.status()).toBe(401);
 expect((await call(staff,'/auth/staff-login',{email,password,code:confirmed.data.recoveryCodes[1]})).response.status()).toBe(201);
 expect((await call(staff,'/auth/2fa/disable',{password,code:confirmed.data.recoveryCodes[2]})).response.status()).toBe(201);
 const status=await call(staff,'/auth/2fa',undefined,'GET');expect(status.response.status()).toBe(200);expect(status.data.enabled).toBe(false);
 }finally{await call(owner,'/staff/users/'+created.data.id,undefined,'DELETE','admin');await owner.dispose();await staff.dispose();}
});
