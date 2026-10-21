import { randomInt, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import * as argon2 from 'argon2';
import { z } from 'zod';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type Redis from 'ioredis';
import { Database } from './database/database';
import { config } from './config';
import { hash, token, fail, type Actor, staffRoles } from './security';
export const phoneSchema=z.string().transform(value=>{const clean=value.replace(/[ ()-]/g,'');return clean.startsWith('0')?'+233'+clean.slice(1):clean.startsWith('233')?'+'+clean:clean;}).pipe(z.string().regex(/^\+233\d{9}$/,'Enter a valid Ghana phone number.'));
const key=new TextEncoder().encode(config.JWT_SECRET);
const cookie={httpOnly:true,secure:config.NODE_ENV==='production',sameSite:'lax' as const,path:'/'};
export class AuthService {
 constructor(private db:Database,private redis:Redis){}
 async limit(keyName:string,max:number,seconds:number){const key='mimiz-fresh:limit:'+keyName;const value=await this.redis.incr(key);if(value===1)await this.redis.expire(key,seconds);if(value>max)fail(429,'Too many attempts. Please try again later.','RATE_LIMITED');}
 async sendOtp(body:unknown,ip:string){
  const {phone}=z.object({phone:phoneSchema}).parse(body);
  await this.limit('otp-ip:'+ip,15,900);await this.limit('otp:'+phone,3,300);
  const code=String(randomInt(100000,1000000));const id=randomUUID();
  await this.db.transaction(async tx=>{
   await tx.query('UPDATE otp_challenges SET consumed_at=now() WHERE phone=$1 AND consumed_at IS NULL',[phone]);
   await tx.query('INSERT INTO otp_challenges(id,phone,hash,expires_at) VALUES($1,$2,$3,now()+interval \'5 minutes\')',[id,phone,hash(id+code+config.JWT_SECRET)]);
   await tx.query('INSERT INTO dev_outbox(id,channel,recipient,body) VALUES($1,\'sms\',$2,$3)',[randomUUID(),phone,'Your Mimiz code is '+code+'. It expires in 5 minutes.']);
  });
  return {challengeId:id,expiresIn:300,demoCode:config.OTP_DEMO_MODE==='true'?'123456':undefined};
 }
 async verifyOtp(body:unknown,reply:FastifyReply){
  const input=z.object({challengeId:z.string().uuid(),code:z.string().regex(/^\d{6}$/),name:z.string().trim().min(2).max(100)}).parse(body);
  // Attempts commit independently, including failed validations.
  const row=(await this.db.query('UPDATE otp_challenges SET attempts=attempts+1 WHERE id=$1 AND consumed_at IS NULL AND expires_at>now() AND attempts<5 RETURNING *',[input.challengeId]))[0];
  if(!row)fail(401,'This code expired or has too many attempts. Request a new one.','OTP_INVALID');
  if(hash(row.id+input.code+config.JWT_SECRET)!==row.hash && !(config.OTP_DEMO_MODE==='true'&&input.code==='123456'))fail(401,'That code is incorrect. Please try again.','OTP_INVALID');
  const user=await this.db.transaction(async tx=>{
   const consumed=await tx.query('UPDATE otp_challenges SET consumed_at=now() WHERE id=$1 AND consumed_at IS NULL RETURNING phone',[row.id]);if(!consumed.rowCount)fail(401,'That code has already been used.');
   const result=await tx.query('INSERT INTO users(id,phone,name,role) VALUES($1,$2,$3,\'customer\') ON CONFLICT(phone) DO UPDATE SET name=CASE WHEN users.role=\'customer\' THEN EXCLUDED.name ELSE users.name END RETURNING *',[randomUUID(),row.phone,input.name]);return result.rows[0];
  });
  if(!user.active)fail(403,'This account is unavailable.');
  if(user.role!=='customer')fail(403,'Staff must sign in with their email and password.');
  await this.issue(user as Actor,reply);return this.publicUser(user as Actor);
 }
 publicUser(user:Actor){return {id:user.id,name:user.name,phone:user.phone,email:user.email,role:user.role,branchId:user.branch_id};}
 async loginStaff(body:unknown,ip:string,reply:FastifyReply){
  const {email,password}=z.object({email:z.email().transform(v=>v.toLowerCase()),password:z.string().min(1).max(200)}).parse(body);
  await this.limit('staff-ip:'+ip,12,900);await this.limit('staff-user:'+email,8,900);
  const user=(await this.db.query('SELECT * FROM users WHERE email=$1 AND active=true',[email]))[0];
  const fallback='$argon2id$v=19$m=65536,t=3,p=4$MDAwMDAwMDAwMDAwMDAwMA$7QqfXW0kLUSc5h1jEf5QQVEMDZ3VxmZNa43DKwwm/EE';
  let valid=false;try{valid=await argon2.verify(user?.password_hash||fallback,password);}catch{}
  if(!user||!valid||!staffRoles.includes(user.role))fail(401,'Email or password is incorrect.');
  await this.issue(user as Actor,reply);return this.publicUser(user as Actor);
 }
 async issue(user:Actor,reply:FastifyReply,familyId=randomUUID()){
  const refresh=token();const id=randomUUID();
  await this.db.query('INSERT INTO sessions(id,user_id,token_hash,family_id,expires_at) VALUES($1,$2,$3,$4,now()+interval \'7 days\')',[id,user.id,hash(refresh),familyId]);
  const access=await new SignJWT({sid:id}).setProtectedHeader({alg:'HS256'}).setSubject(user.id).setIssuedAt().setExpirationTime('15m').sign(key);
  reply.setCookie('mimiz_access',access,{...cookie,maxAge:900});
  reply.setCookie('mimiz_refresh',refresh,{...cookie,maxAge:604800});
  reply.setCookie('mimiz_csrf',token(),{...cookie,httpOnly:false,maxAge:604800});
 }
 async current(request:FastifyRequest):Promise<Actor|null>{
  const access=request.cookies.mimiz_access;if(!access)return null;
  try {const {payload}=await jwtVerify(access,key,{algorithms:['HS256']});return (await this.db.query('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.id=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.id=$2 AND u.active=true',[payload.sid,payload.sub]))[0] as Actor||null;}catch{return null;}
 }
 async require(request:FastifyRequest,roles?:string[]){const user=await this.current(request);if(!user)fail(401,'Sign in to continue.','UNAUTHENTICATED');if(roles&&!roles.includes(user.role))fail(403,'You do not have access to this action.','FORBIDDEN');return user;}
 async refresh(request:FastifyRequest,reply:FastifyReply){
  const refresh=request.cookies.mimiz_refresh;if(!refresh)fail(401,'Sign in again.');
  const result=await this.db.transaction(async tx=>{const row=(await tx.query('SELECT s.*,u.id as uid,u.name,u.phone,u.email,u.role,u.branch_id,u.active FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=$1 FOR UPDATE OF s',[hash(refresh)])).rows[0];if(!row)return null;if(row.revoked_at){await tx.query('UPDATE sessions SET revoked_at=now() WHERE family_id=$1',[row.family_id]);return null;}if(!row.active||new Date(row.expires_at)<new Date())return null;await tx.query('UPDATE sessions SET revoked_at=now() WHERE id=$1',[row.id]);return {...row,id:row.uid};});
  if(!result)fail(401,'Your session expired. Sign in again.');
  await this.issue(result,reply,result.family_id);return this.publicUser(result);
 }
 async logout(request:FastifyRequest,reply:FastifyReply){
  const refresh=request.cookies.mimiz_refresh;if(refresh)await this.db.query('UPDATE sessions SET revoked_at=now() WHERE family_id IN (SELECT family_id FROM sessions WHERE token_hash=$1)',[hash(refresh)]);
  for(const name of ['mimiz_access','mimiz_refresh','mimiz_csrf'])reply.clearCookie(name,cookie);
  return {ok:true};
 }
}
