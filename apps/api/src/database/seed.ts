import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { demoMenu } from '@mimiz/shared/demo-menu';
import { config,projectRoot } from '../config';
import { Database } from './database';
import { token } from '../security';
export const BRANCH_ID='019a0700-0000-7000-8000-000000000002';
export async function seed(db:Database){
 const companyId='019a0700-0000-7000-8000-000000000001';
 await db.transaction(async tx=>{
  await tx.query('INSERT INTO companies(id,name) VALUES($1,\'Mimiz\') ON CONFLICT DO NOTHING',[companyId]);
  const hours=Array.from({length:7},()=>({open:'00:00',close:'23:59',closed:false}));
  await tx.query('INSERT INTO branches(id,company_id,slug,name,code,location,address,phone,hours) VALUES($1,$2,\'accra\',\'Accra kitchen\',\'ACC\',ST_SetSRID(ST_MakePoint(-0.1870,5.5560),4326)::geography,\'Fictional Osu demo kitchen, Accra\',\'+233240000000\',$3::jsonb) ON CONFLICT DO NOTHING',[BRANCH_ID,companyId,JSON.stringify(hours)]);
  await tx.query('INSERT INTO delivery_zones(id,branch_id,name,center,radius_m,fee,minimum,eta_minutes) VALUES($1,$2,\'Osu and nearby\',ST_SetSRID(ST_MakePoint(-0.1870,5.5560),4326)::geography,5000,1500,3000,30) ON CONFLICT DO NOTHING',['019a0700-0000-7000-8000-000000000003',BRANCH_ID]);
  for(const item of demoMenu){await tx.query('INSERT INTO catalogue(id,company_id,data) VALUES($1,$2,$3::jsonb) ON CONFLICT DO NOTHING',[item.id,companyId,JSON.stringify(item)]);await tx.query('INSERT INTO branch_menu(branch_id,item_id,available) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[BRANCH_ID,item.id,item.available]);}
 });
 if(!(await db.query("SELECT id FROM users WHERE role='super_admin' LIMIT 1")).length){
  if(config.NODE_ENV==='production')return;
  const password=process.env.STAFF_ADMIN_PASSWORD||token();
  const email=process.env.STAFF_ADMIN_EMAIL||'owner@mimiz.local';
  await db.query('INSERT INTO users(id,email,name,role,password_hash) VALUES($1,$2,\'Demo owner\',\'super_admin\',$3)',[randomUUID(),email,await argon2.hash(password)]);
  console.log('Initial local administrator created. Email: '+email+' . Password is saved in the ignored .local-admin file.');
  const {writeFile}=await import('node:fs/promises');const {resolve}=await import('node:path');
  await writeFile(resolve(projectRoot,'.local-admin'),email+'\n'+password+'\n',{mode:0o600});
 }
}
