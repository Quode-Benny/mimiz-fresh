import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import type { Queue } from 'bullmq';
import type { PaymentProvider, GatewayEvent } from '@mimiz/providers';
import { Database } from './database/database';
import { CatalogueRepository } from './catalogue';
import { config } from './config';
import { hash, fail, branchAllowed, type Actor } from './security';
import {calculateOrderTotals} from '@mimiz/domain';
import { checkHours, transitionAllowed } from './order-rules';
export const addressSchema=z.object({
 latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),
 landmark:z.string().trim().min(2).max(240),description:z.string().trim().min(5).max(400),
 digitalAddress:z.string().trim().regex(/^$|^[A-Z]{2}-\d{3}-\d{4}$/).optional(),
 recipientName:z.string().trim().min(2).max(100),recipientPhone:z.string().regex(/^\+233\d{9}$/),
});
export const checkoutSchema=z.object({cartId:z.string().uuid(),cartVersion:z.number().int(),paymentMethod:z.enum(['cash','online']),address:addressSchema.optional(),scheduledFor:z.iso.datetime().optional(),note:z.string().trim().max(600).default('')});
import type {NotificationsService} from './notifications';
export class OrdersService {
 constructor(private db:Database,private catalogue:CatalogueRepository,readonly gateway:PaymentProvider,private queue:Queue,private signal:(order:any)=>void,private notifications:NotificationsService){}
 async quote(tx:PoolClient,cart:any,input:z.infer<typeof checkoutSchema>,actor:Actor){
  const branch=(await tx.query('SELECT * FROM branches WHERE id=$1 FOR UPDATE',[cart.branch_id])).rows[0];
  if(!branch?.accepting||!branch.active)fail(409,'This kitchen is not accepting orders right now.');
  if((cart.fulfillment==='delivery'&&!branch.supports_delivery)||(cart.fulfillment==='pickup'&&!branch.supports_pickup))fail(409,'This fulfilment method is unavailable.');
  const company=(await tx.query('SELECT settings FROM companies WHERE id=$1 FOR SHARE',[branch.company_id])).rows[0].settings;
  if(input.paymentMethod==='online'&&(!config.onlinePayments||!company.flags.onlinePayments))fail(400,'Online payment is not available right now.');
  if(input.scheduledFor&&!company.flags.scheduling)fail(400,'Scheduled orders are not available right now.');
  if(cart.promo_code&&!company.flags.promotions)fail(400,'Promotions are unavailable. Clear the code to continue.');
  if(input.paymentMethod==='cash'&&!branch.supports_cash)fail(400,'Cash is unavailable at this kitchen.');
  const at=checkHours(branch,input.scheduledFor);
  if(cart.selections.length===0)fail(400,'Your bag is empty.');
  const priced=await this.catalogue.price(cart.branch_id,cart.selections,tx,false,at);
  let fee=0;let deliveryMinutes=0;let zone=null;
  if(cart.fulfillment==='delivery'){
   if(!input.address)fail(400,'Choose a delivery pin and enter the address and landmark.');
   const a=input.address;
   zone=(await tx.query('SELECT * FROM delivery_zones WHERE branch_id=$1 AND active AND ((center IS NOT NULL AND ST_DWithin(center,ST_SetSRID(ST_MakePoint($2,$3),4326)::geography,radius_m)) OR (polygon IS NOT NULL AND ST_Covers(polygon::geometry,ST_SetSRID(ST_MakePoint($2,$3),4326)))) ORDER BY fee LIMIT 1',[cart.branch_id,a.longitude,a.latitude])).rows[0];
   if(!zone)fail(400,'This pin is outside this kitchen\'s delivery area. Move the pin or choose pickup.');
   if(priced.subtotal<zone.minimum)fail(400,'The minimum order for this area is GHS '+(zone.minimum/100).toFixed(2)+'.');
   fee=zone.fee;deliveryMinutes=zone.eta_minutes;
  }
  let discount=0;let promotion=null;
  if(cart.promo_code){
   promotion=(await tx.query('SELECT * FROM promotions WHERE upper(code)=upper($1) AND active AND starts_at<=now() AND ends_at>now() AND (branch_id IS NULL OR branch_id=$2) FOR UPDATE',[cart.promo_code,cart.branch_id])).rows[0];
   if(!promotion)fail(400,'This promotion is invalid or expired.');
   if(priced.subtotal<promotion.minimum)fail(400,'Your bag does not meet this promotion\'s minimum.');
   const counts=(await tx.query("SELECT count(*)::int AS total,count(*) FILTER (WHERE user_id=$2)::int AS customer FROM orders WHERE promo_id=$1 AND status NOT IN ('cancelled','rejected')",[promotion.id,actor.id])).rows[0];
   if((promotion.total_limit!==null&&counts.total>=promotion.total_limit)||counts.customer>=promotion.per_user_limit)fail(409,'This promotion has reached its usage limit.');
   if(promotion.first_order_only&&(await tx.query("SELECT id FROM orders WHERE user_id=$1 AND status NOT IN ('cancelled','rejected') LIMIT 1",[actor.id])).rowCount)fail(400,'This code is only for your first order.');
   discount=promotion.type==='free_delivery'?fee:promotion.type==='fixed'?promotion.value:Math.floor(priced.subtotal*promotion.value/100);
   discount=Math.min(discount,promotion.max_discount??discount,promotion.type==='free_delivery'?fee:priced.subtotal);
  }
  const totals=calculateOrderTotals({subtotal:priced.subtotal,deliveryFee:fee,discount,discountOnDelivery:promotion?.type==='free_delivery',feeKind:company.serviceFee.kind,feeValue:company.serviceFee.value,taxBps:company.taxBps,taxDelivery:company.taxDelivery});
  return {...priced,...totals,branch,zone,deliveryFee:fee,deliveryMinutes,discount,promoId:promotion?.id??null};
 }
 async preview(cart:any,body:unknown,actor:Actor){const input=checkoutSchema.parse(body);return this.db.transaction(async tx=>{const q=await this.quote(tx,cart,input,actor);return {subtotal:q.subtotal,deliveryFee:q.deliveryFee,serviceFee:q.serviceFee,tax:q.tax,discount:q.discount,total:q.total,zone:q.zone?.name,onlineAvailable:config.onlinePayments,cashAvailable:q.branch.supports_cash,simulated:this.gateway.simulated};});}
 async create(cart:any,body:unknown,actor:Actor,idempotencyKey:string,initiator?:Actor){
  if(initiator&&(!['super_admin','branch_manager','support_agent'].includes(initiator.role)||!branchAllowed(initiator,cart.branch_id)))fail(403,'Your role cannot create an order for this kitchen.');
  const input=checkoutSchema.parse(body);
  if(input.cartId!==cart.id)fail(403,'This bag does not belong to your account.');
  if(!/^[a-zA-Z0-9-]{16,100}$/.test(idempotencyKey))fail(400,'A valid idempotency key is required.');
  if(input.paymentMethod==='online'&&!config.onlinePayments)fail(400,'Online payment is disabled.');
  const requestHash=hash(JSON.stringify(input)+(initiator?JSON.stringify({staffId:initiator.id,selections:cart.selections,branchId:cart.branch_id,fulfillment:cart.fulfillment,promoCode:cart.promo_code}):''));
  const order=await this.db.transaction(async tx=>{
   await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',[actor.id]);
   if(!(await tx.query('SELECT id FROM users WHERE id=$1 AND active FOR SHARE',[actor.id])).rowCount)fail(403,'This account is unavailable.');
   if(initiator){const staff=(await tx.query('SELECT * FROM users WHERE id=$1 AND active FOR SHARE',[initiator.id])).rows[0];if(!staff||!['super_admin','branch_manager','support_agent'].includes(staff.role)||!branchAllowed(staff,cart.branch_id))fail(403,'Your staff access has changed.');}
   const prior=(await tx.query('SELECT * FROM orders WHERE idempotency_key=$1',[idempotencyKey])).rows[0];
   if(prior){if(prior.user_id!==actor.id||prior.request_hash!==requestHash)fail(409,'This checkout key was already used for another request.');return prior;}
   const current=initiator?cart:(await tx.query('SELECT * FROM carts WHERE id=$1 AND user_id=$2 FOR UPDATE',[cart.id,actor.id])).rows[0];
   if(!current||current.version!==input.cartVersion)fail(409,'Your bag changed. Review the current prices before placing the order.');
   const q=await this.quote(tx,current,input,actor);
   if(input.paymentMethod==='cash'&&!q.branch.supports_cash)fail(400,'Cash is unavailable at this kitchen.');
   const quantities=new Map<string,number>();for(const line of q.lines)quantities.set(line.itemId,(quantities.get(line.itemId)||0)+line.quantity);
   for(const [id,quantity]of [...quantities].sort()){
    const row=(await tx.query('SELECT stock,available FROM branch_menu WHERE branch_id=$1 AND item_id=$2 FOR UPDATE',[current.branch_id,id])).rows[0];
    if(row&&(!row.available||(row.stock!==null&&row.stock<quantity)))fail(409,'A dish no longer has enough portions. Refresh your bag.');
    if(row?.stock!==null&&row?.stock!==undefined)await tx.query('UPDATE branch_menu SET stock=stock-$1 WHERE branch_id=$2 AND item_id=$3',[quantity,current.branch_id,id]);
   }
   const sequence=(await tx.query('INSERT INTO branch_day_counters(branch_id,order_day,last_seq) VALUES($1,CURRENT_DATE,1) ON CONFLICT(branch_id,order_day) DO UPDATE SET last_seq=branch_day_counters.last_seq+1 RETURNING last_seq',[current.branch_id])).rows[0].last_seq;
   const number=q.branch.code+'-'+new Date().toISOString().slice(2,10).replaceAll('-','')+'-'+String(sequence).padStart(4,'0');
   const id=randomUUID();const readyAt=new Date((input.scheduledFor?new Date(input.scheduledFor).getTime():Date.now())+(q.branch.prep_minutes+q.branch.extra_prep_minutes)*60000);
   const items=q.lines.map(line=>({itemId:line.itemId,name:line.item.name,image:line.item.image,quantity:line.quantity,unitPricePesewas:line.unitPricePesewas,options:line.options,note:line.note}));
   const status=input.paymentMethod==='online'?'pending_payment':'placed';
   const created=(await tx.query('INSERT INTO orders(id,number,branch_id,user_id,fulfillment,status,payment_status,payment_method,items,subtotal,delivery_fee,discount,total,address,note,promo_id,scheduled_for,estimated_ready_at,estimated_delivery_at,idempotency_key,request_hash,service_fee,tax) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18, $19,$20,$21,$22,$23) RETURNING *',[id,number,current.branch_id,actor.id,current.fulfillment,status,input.paymentMethod==='online'?'pending':'unpaid',input.paymentMethod,JSON.stringify(items),q.subtotal,q.deliveryFee,q.discount,q.total,input.address?JSON.stringify(input.address):null,input.note,q.promoId,input.scheduledFor??null,readyAt,current.fulfillment==='delivery'?new Date(readyAt.getTime()+q.deliveryMinutes*60000):null,idempotencyKey,requestHash,q.serviceFee,q.tax])).rows[0];
   await this.event(tx,created,null,status,initiator?.id||actor.id,initiator?'Phone or walk-in order created by staff':'Order placed');
   if(initiator)await tx.query("INSERT INTO audit_logs(id,actor_id,action,entity_id,after_data) VALUES($1,$2,'order.manual-create',$3,$4::jsonb)",[randomUUID(),initiator.id,id,JSON.stringify({branchId:current.branch_id,customerId:actor.id,total:q.total})]);
   if(input.paymentMethod==='online')await tx.query('INSERT INTO payments(id,order_id,provider,reference,amount,simulated) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),id,this.gateway.name,'MZ-'+id,q.total,this.gateway.simulated]);
   if(!initiator)await tx.query("UPDATE carts SET selections='[]',promo_code=NULL,version=version+1,updated_at=now() WHERE id=$1",[current.id]);
   return created;
  });
  if(order.payment_method==='online'){
   await this.queue.add('expire',{orderId:order.id},{jobId:'expire-'+order.id,delay:15*60000,removeOnComplete:true});
   await this.initializePayment(order,actor);
  }
  this.signal(order);
  return this.detail(order.id,actor);
 }
 async initializePayment(order:any,actor:Actor){
  const payment=(await this.db.query('SELECT * FROM payments WHERE order_id=$1 ORDER BY created_at DESC LIMIT 1',[order.id]))[0];
  if(payment?.authorization_url||order.status!=='pending_payment')return;
  try{const init=await this.gateway.initialize({reference:payment.reference,amount:payment.amount,email:actor.email??undefined,phone:actor.phone??'',callbackUrl:config.WEB_ORIGIN+'/orders/'+order.id});await this.db.query('UPDATE payments SET authorization_url=$1 WHERE id=$2',[init.authorizationUrl,payment.id]);}catch(error){console.error('Payment initialization failed for '+order.id);}
 }
 async list(actor:Actor,staff=false){
  if(staff&&!['super_admin','support_agent'].includes(actor.role)&&!actor.branch_id)return [];
  return this.db.query(staff?"SELECT o.*,b.name AS branch_name FROM orders o JOIN branches b ON b.id=o.branch_id WHERE ($1::uuid IS NULL OR branch_id=$1) AND ($2::text<>'rider' OR rider_id=$3) ORDER BY created_at DESC LIMIT 200":"SELECT o.*,b.name AS branch_name FROM orders o JOIN branches b ON b.id=o.branch_id WHERE user_id=$3 ORDER BY created_at DESC LIMIT 100",[staff&&actor.role!=='super_admin'?actor.branch_id:null,actor.role,actor.id]);
 }
 async kitchenQueue(actor:Actor,raw:unknown){
 const input=z.object({stage:z.enum(['new','preparing','ready']).default('new'),search:z.string().trim().max(100).default(''),fulfillment:z.enum(['all','pickup','delivery']).default('all'),branchId:z.string().uuid().optional(),sort:z.enum(['oldest','newest']).default('oldest'),page:z.coerce.number().int().min(1).max(100000).default(1)}).parse(raw);
 const branch=actor.role==='super_admin'?input.branchId||null:actor.branch_id;
 if(actor.role!=='super_admin'&&actor.role!=='support_agent'&&!branch)fail(403,'No kitchen is assigned.');
 if(input.branchId&&!branchAllowed(actor,input.branchId))fail(403,'This kitchen is not assigned to you.');
 const search=input.search?'%'+input.search.replace(/[\\%_]/g,character=>'\\'+character)+'%':'';
 const where="FROM orders o JOIN users u ON u.id=o.user_id JOIN branches b ON b.id=o.branch_id WHERE ($1::uuid IS NULL OR o.branch_id=$1) AND o.status=ANY($2::text[]) AND ($3='all' OR o.fulfillment=$3) AND ($4='' OR o.number ILIKE $4 OR u.name ILIKE $4 OR u.phone ILIKE $4)";
 const values=[branch,['placed','accepted','preparing','ready','out_for_delivery'],input.fulfillment,search];
 const rows=await this.db.query('SELECT o.status,count(*)::int AS count '+where+' GROUP BY o.status',values);
 const count=(statuses:string[])=>rows.filter(r=>statuses.includes(r.status)).reduce((sum,r)=>sum+r.count,0);
 const counts={new:count(['placed']),preparing:count(['accepted','preparing']),ready:count(['ready','out_for_delivery'])};
 const pageSize=12,total=counts[input.stage],page=Math.max(1,Math.min(input.page,Math.ceil(total/pageSize)||1));
 const statuses={new:['placed'],preparing:['accepted','preparing'],ready:['ready','out_for_delivery']}[input.stage];
 const items=await this.db.query('SELECT o.*,u.name AS customer_name,b.name AS branch_name '+where+' AND o.status=ANY($5::text[]) ORDER BY o.created_at '+(input.sort==='oldest'?'ASC':'DESC')+',o.id LIMIT $6 OFFSET $7',[...values,statuses,pageSize,(page-1)*pageSize]);
 return {items,counts,page,pageSize,total};
 }
 async detail(id:string,actor:Actor):Promise<any>{
  const order=(await this.db.query('SELECT o.*,b.name as branch_name,b.phone as branch_phone FROM orders o JOIN branches b ON b.id=o.branch_id WHERE o.id=$1',[id]))[0];if(!order)fail(404,'Order not found.');
  if(actor.role==='customer'?order.user_id!==actor.id:!branchAllowed(actor,order.branch_id)||(actor.role==='rider'&&order.rider_id!==actor.id))fail(403,'You cannot access this order.');
  const events=await this.db.query('SELECT from_status,to_status,note,created_at FROM order_events WHERE order_id=$1 ORDER BY created_at',[id]);
  const payments=await this.db.query('SELECT reference,amount,status,authorization_url,simulated,refunded_amount FROM payments WHERE order_id=$1 ORDER BY created_at DESC',[id]);
  const rating=(await this.db.query('SELECT food,delivery,comment FROM ratings WHERE order_id=$1',[id]))[0]??null;
  const rider=order.rider_id?(await this.db.query('SELECT name,phone FROM users WHERE id=$1',[order.rider_id]))[0]:null;
  const location=order.status==='out_for_delivery'?(await this.db.query('SELECT lat,lng,updated_at FROM rider_locations WHERE order_id=$1',[id]))[0]??null:null;
  return {...order,events,payments,rating,rider,location};
 }
 async event(tx:PoolClient,order:any,from:string|null,to:string,actorId:string|null,note:string){
  await tx.query('INSERT INTO order_events(id,order_id,from_status,to_status,actor_id,note) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),order.id,from,to,actorId,note]);
  await this.notifications.record(tx,{userId:order.user_id,orderId:order.id,number:order.number,event:to});
 }
 async releaseStock(tx:PoolClient,order:any){
  if(order.stock_released)return;
  for(const item of order.items)await tx.query('UPDATE branch_menu SET stock=stock+$1 WHERE branch_id=$2 AND item_id=$3 AND stock IS NOT NULL',[item.quantity,order.branch_id,item.itemId]);
  await tx.query('UPDATE orders SET stock_released=true WHERE id=$1',[order.id]);
 }
 async transition(id:string,to:string,actor:Actor,note=''){
  const order=await this.db.transaction(async tx=>{
   const order=(await tx.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!order)fail(404,'Order not found.');
   if(actor.role==='customer'?order.user_id!==actor.id:!branchAllowed(actor,order.branch_id)||(actor.role==='rider'&&order.rider_id!==actor.id))fail(403,'You cannot update this order.');
   transitionAllowed(order.status,to as any,order.fulfillment,actor);
   if(['cancelled','rejected'].includes(to)&&note.trim().length<3)fail(400,'Please give a reason.');
   await tx.query("UPDATE orders SET status=$1,updated_at=now(),payment_status=CASE WHEN $1::text='completed' AND payment_method='cash' THEN 'succeeded' ELSE payment_status END WHERE id=$2",[to,id]);
   await this.event(tx,order,order.status,to,actor.id,note);
   await tx.query('INSERT INTO audit_logs(id,actor_id,action,entity_id,before_data,after_data) VALUES($1,$2,\'order.transition\',$3,$4::jsonb,$5::jsonb)',[randomUUID(),actor.id,id,JSON.stringify({status:order.status}),JSON.stringify({status:to,note})]);
   if(['cancelled','rejected'].includes(to))await this.releaseStock(tx,order);
   if(to==='completed')await tx.query('DELETE FROM rider_locations WHERE order_id=$1',[id]);
   return {...order,status:to};
  });
  if(['cancelled','rejected'].includes(to))await this.requestRefund(order.id,order.total,'Order '+to);
  this.signal(order);return this.detail(id,actor);
 }
 async requestRefund(orderId:string,amount:number,reason:string,strict=false){
  const refund=await this.db.transaction(async tx=>{
   const payment=(await tx.query("SELECT * FROM payments WHERE order_id=$1 AND status='succeeded' FOR UPDATE",[orderId])).rows[0];if(!payment){if(strict)fail(409,'No refundable payment is available.');return null;}
   const pending=Number((await tx.query("SELECT coalesce(sum(amount),0) as amount FROM refunds WHERE payment_id=$1 AND status IN ('pending','processed')",[payment.id])).rows[0].amount);
   const remaining=payment.amount-pending;if(strict&&(remaining<=0||amount>remaining))fail(409,'This amount is already refunded or reserved by a pending refund.');if(remaining<=0)return null;const refundAmount=Math.min(amount,remaining);
   const id=randomUUID();await tx.query('INSERT INTO refunds(id,payment_id,amount,reason) VALUES($1,$2,$3,$4)',[id,payment.id,refundAmount,reason]);return {id,reference:payment.reference,amount:refundAmount};
  });
  if(refund)await this.queue.add('refund',{...refund,reason},{jobId:'refund-'+refund.id,attempts:8,backoff:{type:'exponential',delay:1000},removeOnComplete:true});
 }
 async expire(id:string){
  const system:Actor={id:'',name:'System',phone:null,email:null,role:'super_admin',branch_id:null};
  const order=await this.db.transaction(async tx=>{const o=(await tx.query("SELECT * FROM orders WHERE id=$1 AND status='pending_payment' FOR UPDATE",[id])).rows[0];if(!o)return null;await tx.query("UPDATE orders SET status='cancelled',updated_at=now() WHERE id=$1",[id]);await this.releaseStock(tx,o);await this.event(tx,o,o.status,'cancelled',null,'Payment was not confirmed within 15 minutes.');return {...o,status:'cancelled'};});
  if(order)this.signal(order);
 }
 async receiveWebhook(raw:Buffer,signature:string){
  let event:GatewayEvent;try{event=this.gateway.parseWebhook(raw,signature);}catch{fail(401,'Invalid webhook signature.');}
  await this.db.query('INSERT INTO webhook_events(id,provider,payload) VALUES($1,$2,$3::jsonb) ON CONFLICT DO NOTHING',[event.id,this.gateway.name,JSON.stringify(event)]);
  await this.queue.add('webhook',{id:event.id},{jobId:'webhook-'+event.id,attempts:8,backoff:{type:'exponential',delay:1000},removeOnComplete:true});
  return {received:true};
 }
 async processWebhook(id:string){
  const saved=(await this.db.query('SELECT * FROM webhook_events WHERE id=$1',[id]))[0];if(!saved||saved.processed_at)return;
  const event=saved.payload as GatewayEvent;
  const verification=event.type==='charge.success'?await this.gateway.verify(event.reference):null;
  const changed=await this.db.transaction(async tx=>{
   const inbox=(await tx.query('SELECT * FROM webhook_events WHERE id=$1 FOR UPDATE',[id])).rows[0];if(inbox.processed_at)return null;
   const payment=(await tx.query('SELECT * FROM payments WHERE reference=$1 FOR UPDATE',[event.reference])).rows[0];
   if(!payment)throw new Error('Payment reference not found');
   const order=(await tx.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE',[payment.order_id])).rows[0];
   let refund=false;
   if(event.type==='charge.success'&&payment.status!=='succeeded'&&payment.status!=='refunded'){
    if(!verification||verification.status!=='success'||verification.amount!==payment.amount||verification.currency!=='GHS'||event.amount!==payment.amount||event.currency!=='GHS')throw new Error('Verified payment amount or currency mismatch');
    await tx.query("UPDATE payments SET status='succeeded' WHERE id=$1",[payment.id]);
    await tx.query("UPDATE orders SET payment_status='succeeded',updated_at=now() WHERE id=$1",[order.id]);
    if(order.status==='pending_payment'){await tx.query("UPDATE orders SET status='placed' WHERE id=$1",[order.id]);await this.event(tx,order,'pending_payment','placed',null,'Payment confirmed by signed webhook');order.status='placed';}else if(['cancelled','rejected'].includes(order.status))refund=true;
   } else if(event.type==='charge.failed'&&payment.status==='pending'){
    await tx.query("UPDATE payments SET status='failed' WHERE id=$1",[payment.id]);await tx.query("UPDATE orders SET payment_status='failed' WHERE id=$1",[order.id]);
   } else if(event.type==='refund.processed'){
    const r=(await tx.query("UPDATE refunds SET status='processed' WHERE id=$1 AND payment_id=$2 AND status='pending' RETURNING amount",[event.refundId,payment.id])).rows[0];
    if(r){await this.notifications.record(tx,{userId:order.user_id,orderId:order.id,number:order.number,event:'refunded'});const refunded=payment.refunded_amount+r.amount;await tx.query("UPDATE payments SET refunded_amount=$1,status=CASE WHEN $1>=amount THEN 'refunded' ELSE 'succeeded' END WHERE id=$2",[refunded,payment.id]);await tx.query("UPDATE orders SET payment_status=$1 WHERE id=$2",[refunded>=payment.amount?'refunded':'partially_refunded',order.id]);}
   }
   await tx.query('UPDATE webhook_events SET processed_at=now() WHERE id=$1',[id]);return {order,refund};
  });
  if(changed){if(changed.refund)await this.requestRefund(changed.order.id,changed.order.total,'Payment arrived after cancellation');this.signal(changed.order);}
 }
}
