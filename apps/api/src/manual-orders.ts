import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {Database} from './database/database';
import {OrdersService,addressSchema} from './orders';
import {selectionSchema} from './catalogue';
import {phoneSchema} from './auth';
import {fail,branchAllowed,hash,type Actor} from './security';
const inputSchema=z.object({branchId:z.string().uuid(),customerName:z.string().trim().min(2).max(100),customerPhone:phoneSchema,fulfillment:z.enum(['pickup','delivery']),selections:z.array(selectionSchema).min(1).max(100),address:addressSchema.extend({recipientPhone:phoneSchema}).optional(),scheduledFor:z.iso.datetime().optional(),note:z.string().trim().max(600).default(''),promoCode:z.string().trim().max(40).nullable().default(null)});
export class ManualOrdersService{
 constructor(private db:Database,private orders:OrdersService){}
 private async prepare(actor:Actor,body:unknown,key?:string){
  if(!['super_admin','branch_manager','support_agent'].includes(actor.role))fail(403,'Your role cannot create phone orders.');
  const input=inputSchema.parse(body);if(!branchAllowed(actor,input.branchId))fail(403,'Choose your assigned kitchen.');
  const existing=(await this.db.query('SELECT * FROM users WHERE phone=$1',[input.customerPhone]))[0];if(existing&&(existing.role!=='customer'||!existing.active))fail(403,'This customer account cannot place orders.');
  const customer:Actor=(existing as Actor|undefined)||{id:randomUUID(),name:input.customerName,phone:input.customerPhone,email:null,role:'customer',branch_id:null};
  const digest=key?hash('staff-cart:'+actor.id+':'+key):hash(randomUUID()),cartId=digest.slice(0,8)+'-'+digest.slice(8,12)+'-4'+digest.slice(13,16)+'-8'+digest.slice(17,20)+'-'+digest.slice(20,32);
  const cart={id:cartId,version:1,user_id:customer.id,branch_id:input.branchId,fulfillment:input.fulfillment,selections:input.selections,promo_code:input.promoCode};
  const checkout={cartId,cartVersion:1,paymentMethod:'cash' as const,address:input.address,scheduledFor:input.scheduledFor,note:input.note};
  return {input,existing,customer,cart,checkout};
 }
 async preview(actor:Actor,body:unknown){const prepared=await this.prepare(actor,body);return this.orders.preview(prepared.cart,prepared.checkout,prepared.customer);}
 async create(actor:Actor,body:unknown,key:string){
  if(!/^[a-zA-Z0-9-]{16,100}$/.test(key))fail(400,'A valid idempotency key is required.');
  const prepared=await this.prepare(actor,body,key);
  // Validate before registering a new phone customer. The final shared transaction
  // rechecks prices, stock, hours and coverage and never mutates their saved cart.
  const prior=(await this.db.query('SELECT id,user_id FROM orders WHERE idempotency_key=$1',[key]))[0];
  if(prior&&(!prepared.existing||prior.user_id!==prepared.customer.id))fail(409,'This key already belongs to another order.');
  if(!prior)await this.orders.preview(prepared.cart,prepared.checkout,prepared.customer);
  if(!prepared.existing){const customer=(await this.db.query("INSERT INTO users(id,phone,name,role) VALUES($1,$2,$3,'customer') ON CONFLICT(phone) DO UPDATE SET phone=EXCLUDED.phone RETURNING *",[prepared.customer.id,prepared.input.customerPhone,prepared.input.customerName]))[0];if(customer.role!=='customer'||!customer.active)fail(403,'This customer account cannot place orders.');prepared.customer=customer as Actor;prepared.cart.user_id=customer.id;}
  return this.orders.create(prepared.cart,prepared.checkout,prepared.customer,key,actor);
 }
}
