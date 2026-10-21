import {randomUUID} from 'node:crypto';
import * as argon2 from 'argon2';
import {z} from 'zod';
import {Database} from './database/database';
import {CatalogueRepository} from './catalogue';
import {fail,branchAllowed,type Actor} from './security';
import {phoneSchema} from './auth';
export class AdminService {
 constructor(private db:Database,private catalogue:CatalogueRepository){}
 private scope(actor:Actor,branchId:string){if(!branchAllowed(actor,branchId))fail(403,'You cannot manage this branch.');}
 private async audit(actor:Actor,action:string,id:string,after:any){await this.db.query('INSERT INTO audit_logs(id,actor_id,action,entity_id,after_data) VALUES($1,$2,$3,$4,$5::jsonb)',[randomUUID(),actor.id,action,id,JSON.stringify(after)]);}
 async users(actor:Actor){if(actor.role!=='super_admin'&&!actor.branch_id)fail(403,'No kitchen is assigned to this account.');return this.db.query("SELECT id,name,email,phone,role,branch_id,active FROM users WHERE role<>'customer' AND ($1::uuid IS NULL OR branch_id=$1) ORDER BY name",[actor.role==='super_admin'?null:actor.branch_id]);}
 async createUser(actor:Actor,body:unknown){
  const input=z.object({name:z.string().trim().min(2).max(100),email:z.email().transform(v=>v.toLowerCase()),phone:phoneSchema.optional(),role:z.enum(['kitchen_staff','rider','support_agent','branch_manager','super_admin']),branchId:z.string().uuid().nullable(),password:z.string().min(12).max(200)}).parse(body);
  if(actor.role!=='super_admin'){if(['super_admin','branch_manager'].includes(input.role))fail(403,'Only the owner can create managers.');if(!input.branchId||input.branchId!==actor.branch_id)fail(403,'Choose your own kitchen.');}
  if(!['super_admin','support_agent'].includes(input.role)&&!input.branchId)fail(400,'A branch is required for this role.');
  const id=randomUUID();await this.db.query('INSERT INTO users(id,name,email,phone,role,branch_id,password_hash) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,input.name,input.email,input.phone??null,input.role,input.branchId,await argon2.hash(input.password)]);
  await this.audit(actor,'staff.create',id,{...input,password:'[REDACTED]'});return {id};
 }
 async deactivate(actor:Actor,id:string){
  if(id===actor.id)fail(400,'You cannot deactivate your own account.');
  const user=(await this.db.query('SELECT id,role,branch_id FROM users WHERE id=$1',[id]))[0];if(!user)fail(404,'Staff member not found.');
  if(actor.role!=='super_admin'&&(!branchAllowed(actor,user.branch_id)||['super_admin','branch_manager'].includes(user.role)))fail(403,'You cannot deactivate this account.');
  await this.db.transaction(async tx=>{await tx.query('UPDATE users SET active=false WHERE id=$1',[id]);await tx.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1',[id]);});
  await this.audit(actor,'staff.deactivate',id,{});return {ok:true};
 }
 async addItem(actor:Actor,body:unknown){
  const input=z.object({branchId:z.string().uuid(),name:z.string().trim().min(2).max(100),description:z.string().trim().min(5).max(400),category:z.string().trim().min(2).max(60),pricePesewas:z.number().int().min(0).max(1000000),image:z.string().regex(/^\/(images|api\/v1\/uploads)\//),vegetarian:z.boolean().default(false),spicy:z.boolean().default(false)}).parse(body);
  const branch=(await this.db.query('SELECT company_id FROM branches WHERE id=$1',[input.branchId]))[0];if(!branch)fail(404,'Kitchen not found.');
  const id=randomUUID();const item={id,...input,available:true,dayparts:['lunch','dinner'],optionGroups:[]};await this.db.transaction(async tx=>{await tx.query('INSERT INTO catalogue(id,company_id,data) VALUES($1,$2,$3::jsonb)',[id,branch.company_id,JSON.stringify(item)]);await tx.query('INSERT INTO branch_menu(branch_id,item_id,available) VALUES($1,$2,true)',[input.branchId,id]);});await this.audit(actor,'catalogue.create',id,item);return item;
 }
 async zones(actor:Actor,branchId:string){this.scope(actor,branchId);return this.db.query('SELECT id,branch_id,name,radius_m,fee,minimum,eta_minutes,active,ST_Y(center::geometry) AS latitude,ST_X(center::geometry) AS longitude,ST_AsGeoJSON(polygon::geometry)::json AS polygon FROM delivery_zones WHERE branch_id=$1 ORDER BY name',[branchId]);}
 async saveZone(actor:Actor,body:unknown){
  const input=z.object({id:z.string().uuid().optional(),branchId:z.string().uuid(),name:z.string().trim().min(2).max(100),latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),radiusM:z.number().int().min(100).max(100000),fee:z.number().int().min(0),minimum:z.number().int().min(0),etaMinutes:z.number().int().min(5).max(300),active:z.boolean().default(true)}).parse(body);this.scope(actor,input.branchId);
  if(input.id){const previous=(await this.db.query('SELECT branch_id FROM delivery_zones WHERE id=$1',[input.id]))[0];if(!previous||previous.branch_id!==input.branchId)fail(403,'This zone does not belong to that branch.');}
  const id=input.id||randomUUID();await this.db.query('INSERT INTO delivery_zones(id,branch_id,name,center,radius_m,fee,minimum,eta_minutes,active) VALUES($1,$2,$3,ST_SetSRID(ST_MakePoint($4,$5),4326)::geography,$6,$7,$8,$9,$10) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,center=EXCLUDED.center,radius_m=EXCLUDED.radius_m,fee=EXCLUDED.fee,minimum=EXCLUDED.minimum,eta_minutes=EXCLUDED.eta_minutes,active=EXCLUDED.active',[id,input.branchId,input.name,input.longitude,input.latitude,input.radiusM,input.fee,input.minimum,input.etaMinutes,input.active]);await this.audit(actor,'zone.save',id,input);return {id};
 }
 async branch(actor:Actor,id:string,body:unknown){
  this.scope(actor,id);
  const input=z.object({name:z.string().trim().min(2).max(100),address:z.string().trim().min(5).max(300),phone:phoneSchema,accepting:z.boolean(),prepMinutes:z.number().int().min(5).max(180),supportsCash:z.boolean(),supportsDelivery:z.boolean(),supportsPickup:z.boolean(),hours:z.array(z.object({open:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),close:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),closed:z.boolean()})).length(7),closures:z.array(z.iso.date()).max(100).default([])}).parse(body);
  await this.db.query('UPDATE branches SET name=$1,address=$2,phone=$3,accepting=$4,prep_minutes=$5,supports_cash=$6,supports_delivery=$7,supports_pickup=$8,hours=$9::jsonb,closures=$10::jsonb WHERE id=$11',[input.name,input.address,input.phone,input.accepting,input.prepMinutes,input.supportsCash,input.supportsDelivery,input.supportsPickup,JSON.stringify(input.hours),JSON.stringify(input.closures),id]);await this.audit(actor,'branch.update',id,input);return {ok:true};
 }
 async promotions(actor:Actor){if(actor.role!=='super_admin'&&!actor.branch_id)fail(403,'No kitchen is assigned to this account.');return this.db.query('SELECT * FROM promotions WHERE ($1::uuid IS NULL OR branch_id=$1) ORDER BY starts_at DESC',[actor.role==='super_admin'?null:actor.branch_id]);}
 async promotion(actor:Actor,body:unknown){
  const input=z.object({code:z.string().trim().min(3).max(30).transform(v=>v.toUpperCase()),type:z.enum(['fixed','percent','free_delivery']),value:z.number().int().min(0),minimum:z.number().int().min(0).default(0),maxDiscount:z.number().int().min(0).optional(),branchId:z.string().uuid().nullable(),endsAt:z.iso.datetime(),totalLimit:z.number().int().min(1).optional(),perUserLimit:z.number().int().min(1).default(1),firstOrderOnly:z.boolean().default(false)}).parse(body);
  if(input.type==='percent'&&input.value>100)fail(400,'Percent discounts must not exceed 100.');
  if(new Date(input.endsAt)<=new Date())fail(400,'Choose a future expiry date.');
  if(actor.role!=='super_admin'&&input.branchId!==actor.branch_id)fail(403,'Choose your own kitchen.');
  const id=randomUUID();await this.db.query('INSERT INTO promotions(id,code,type,value,minimum,max_discount,branch_id,ends_at,total_limit,per_user_limit,first_order_only) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,input.code,input.type,input.value,input.minimum,input.maxDiscount??null,input.branchId,input.endsAt,input.totalLimit??null,input.perUserLimit,input.firstOrderOnly]);await this.audit(actor,'promotion.create',id,input);return {id};
 }
 async location(actor:Actor,orderId:string,body:unknown){
  const input=z.object({latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180)}).parse(body);
  const order=(await this.db.query("SELECT rider_id,status FROM orders WHERE id=$1",[orderId]))[0];if(!order||order.rider_id!==actor.id||order.status!=='out_for_delivery')fail(403,'Location sharing is only available for your active delivery.');
  await this.db.query('INSERT INTO rider_locations(order_id,rider_id,lat,lng) VALUES($1,$2,$3,$4) ON CONFLICT(order_id) DO UPDATE SET lat=EXCLUDED.lat,lng=EXCLUDED.lng,updated_at=now()',[orderId,actor.id,input.latitude,input.longitude]);return {ok:true};
 }
}
