import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Database } from './database/database';
import { CatalogueRepository } from './catalogue';
import { AuthService } from './auth';
import { OrdersService } from './orders';
import { branchAllowed, fail, type Actor } from './security';
import {catalogueFields} from './catalogue-schema';
export class StaffService {
 constructor(private db:Database,private catalogue:CatalogueRepository,private orders:OrdersService){}
 async audit(actor:Actor,action:string,id:string,before:any,after:any){await this.db.query('INSERT INTO audit_logs(id,actor_id,action,entity_id,before_data,after_data) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)',[randomUUID(),actor.id,action,id,JSON.stringify(before),JSON.stringify(after)]);}
 async menu(actor:Actor,branchId:string){if(!branchAllowed(actor,branchId))fail(403,'You cannot manage this kitchen.');return this.catalogue.menu(branchId);}
 async updateItem(actor:Actor,id:string,body:unknown){
  const input=z.object({...catalogueFields,branchPricePesewas:z.number().int().min(0).max(1000000).nullable().optional(),branchId:z.string().uuid(),name:z.string().trim().min(2).max(100).optional(),description:z.string().trim().min(5).max(400).optional(),category:z.string().trim().min(2).max(60).optional(),pricePesewas:z.number().int().min(0).max(1000000).optional(),available:z.boolean().optional(),stock:z.number().int().min(0).nullable().optional(),archived:z.boolean().optional()}).parse(body);
  if(!branchAllowed(actor,input.branchId))fail(403,'You cannot manage this kitchen.');
  if(Object.keys(input).some(key=>!['branchId','available','stock'].includes(key))&&actor.role!=='super_admin')fail(403,'Only the owner can change the company catalogue or prices.');
  const result=await this.db.transaction(async tx=>{
   const before=(await tx.query('SELECT * FROM catalogue WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!before)fail(404,'Dish not found.');
   if(input.category)await tx.query('INSERT INTO categories(id,company_id,name) VALUES($1,$2,$3) ON CONFLICT(company_id,name) DO NOTHING',[randomUUID(),before.company_id,input.category]);
   const data={...before.data,...Object.fromEntries(Object.entries(input).filter(([key])=>['name','description','category','pricePesewas',...Object.keys(catalogueFields)].includes(key)))};
   await tx.query('UPDATE catalogue SET data=$1::jsonb,archived=$2,updated_at=now() WHERE id=$3',[JSON.stringify(data),input.archived??before.archived,id]);
   await tx.query('INSERT INTO branch_menu(branch_id,item_id,available) VALUES($1,$2,true) ON CONFLICT DO NOTHING',[input.branchId,id]);
   if(input.available!==undefined)await tx.query('UPDATE branch_menu SET available=$1 WHERE branch_id=$2 AND item_id=$3',[input.available,input.branchId,id]);
   if(input.branchPricePesewas!==undefined)await tx.query('UPDATE branch_menu SET price=$1 WHERE branch_id=$2 AND item_id=$3',[input.branchPricePesewas,input.branchId,id]);
   if(input.stock!==undefined)await tx.query('UPDATE branch_menu SET stock=$1 WHERE branch_id=$2 AND item_id=$3',[input.stock,input.branchId,id]);
   await tx.query('INSERT INTO audit_logs(id,actor_id,action,entity_id,before_data,after_data) VALUES($1,$2,\'catalogue.update\',$3,$4::jsonb,$5::jsonb)',[randomUUID(),actor.id,id,JSON.stringify(before),JSON.stringify(input)]);
   return data;
  });return result;
 }
 async summary(actor:Actor){
  if(!['super_admin','support_agent'].includes(actor.role)&&!actor.branch_id)fail(403,'No kitchen is assigned to this account.');
  const branch=actor.role==='super_admin'?null:actor.branch_id;
  const totals=(await this.db.query("SELECT count(*)::int AS orders,count(*) FILTER(WHERE status NOT IN ('completed','cancelled','rejected','pending_payment'))::int AS active,coalesce(sum(total) FILTER(WHERE status='completed' AND payment_method='cash'),0)::int AS real_revenue,coalesce(sum(total) FILTER(WHERE status='completed'),0)::int AS revenue_including_simulated,count(*) FILTER(WHERE status='cancelled')::int AS cancelled FROM orders WHERE ($1::uuid IS NULL OR branch_id=$1)",[branch]))[0];
  const popular=await this.db.query("SELECT item->>'name' AS name,sum((item->>'quantity')::int)::int AS quantity FROM orders o CROSS JOIN LATERAL jsonb_array_elements(o.items) item WHERE ($1::uuid IS NULL OR branch_id=$1) AND status NOT IN ('cancelled','rejected','pending_payment') GROUP BY item->>'name' ORDER BY quantity DESC LIMIT 10",[branch]);
  return {...totals,popular};
 }
 async chats(actor:Actor){if(!['super_admin','support_agent'].includes(actor.role)&&!actor.branch_id)fail(403,'No kitchen is assigned to this account.');return this.db.query('SELECT t.*,u.name, u.phone, o.number AS order_number,(SELECT body FROM chat_messages m WHERE m.thread_id=t.id ORDER BY created_at DESC LIMIT 1) AS latest_message FROM chat_threads t JOIN users u ON u.id=t.user_id LEFT JOIN orders o ON o.id=t.order_id WHERE ($1::uuid IS NULL OR t.branch_id=$1) ORDER BY t.created_at DESC LIMIT 100',[actor.role==='super_admin'?null:actor.branch_id]);}
 async chatMessages(actor:Actor,threadId:string){
  if(!['customer','super_admin','branch_manager','support_agent'].includes(actor.role))fail(403,'This role cannot access support conversations.');
  const thread=(await this.db.query('SELECT * FROM chat_threads WHERE id=$1',[threadId]))[0];if(!thread)fail(404,'Conversation not found.');
  if(actor.role==='customer'?thread.user_id!==actor.id:!branchAllowed(actor,thread.branch_id))fail(403,'You cannot view this conversation.');
  return this.db.query('SELECT m.id,m.body,m.created_at,m.read_at,u.name,u.role,m.sender_id FROM chat_messages m JOIN users u ON u.id=m.sender_id WHERE thread_id=$1 ORDER BY m.created_at LIMIT 500',[threadId]);
 }
 async sendMessage(actor:Actor,threadId:string,body:unknown){
  await this.chatMessages(actor,threadId);
  const input=z.object({body:z.string().trim().min(1).max(2000)}).parse(body);
  await this.db.query('INSERT INTO chat_messages(id,thread_id,sender_id,body) VALUES($1,$2,$3,$4)',[randomUUID(),threadId,actor.id,input.body]);
  await this.db.query('UPDATE chat_threads SET closed_at=NULL WHERE id=$1',[threadId]);
  return this.chatMessages(actor,threadId);
 }
 async orderThread(actor:Actor,orderId:string){
  if(!['customer','super_admin','branch_manager','support_agent'].includes(actor.role))fail(403,'This role cannot access support conversations.');
  const order=await this.orders.detail(orderId,actor);
  const rows=await this.db.query('SELECT * FROM chat_threads WHERE order_id=$1',[orderId]);if(rows[0])return rows[0];
  return (await this.db.query('INSERT INTO chat_threads(id,order_id,user_id,branch_id) VALUES($1,$2,$3,$4) RETURNING *',[randomUUID(),orderId,order.user_id,order.branch_id]))[0];
 }
 async assignRider(actor:Actor,id:string,body:unknown){
  const order=await this.orders.detail(id,actor);
  const {riderId}=z.object({riderId:z.string().uuid()}).parse(body);
  const rider=(await this.db.query("SELECT id FROM users WHERE id=$1 AND role='rider' AND branch_id=$2 AND active",[riderId,order.branch_id]))[0];if(!rider)fail(400,'Choose an active rider assigned to this branch.');
  if(order.fulfillment!=='delivery')fail(400,'Riders can only be assigned delivery orders.');
  await this.db.query('UPDATE orders SET rider_id=$1 WHERE id=$2',[riderId,id]);await this.audit(actor,'order.assign_rider',id,{riderId:order.rider_id},{riderId});return this.orders.detail(id,actor);
 }
}
