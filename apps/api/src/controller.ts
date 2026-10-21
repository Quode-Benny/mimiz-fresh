import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest,FastifyReply } from 'fastify';
import { z } from 'zod';
import type { Database } from './database/database';
import type { AuthService } from './auth';
import type { CatalogueRepository,CartService } from './catalogue';
import {addressSchema,type OrdersService} from './orders';
import type { StaffService } from './staff';
import type {AdminService} from './admin';
import { MockPaymentProvider } from '@mimiz/providers';
import { config } from './config';
import {uploadImage} from './uploads';
import { fail, staffRoles, branchAllowed, type Actor } from './security';
export type Runtime={db:Database;auth:AuthService;catalogue:CatalogueRepository;cart:CartService;orders:OrdersService;staff:StaffService;admin:AdminService;redis:any;queue:any};
@Controller('api/v1')
@ApiTags('Mimiz')
export class ApiController {
 constructor(@Inject('runtime') private r:Runtime){}
 private id(value:string){return z.string().uuid().parse(value);}
 private async cart(req:FastifyRequest,res:FastifyReply){const actor=await this.r.auth.current(req);if(req.cookies.mimiz_refresh&&!actor)fail(401,'Refresh your session.','UNAUTHENTICATED');return this.r.cart.get(req,res,actor);}
 @Get('health') async health(){await this.r.db.query('SELECT 1');await this.r.redis.ping();return {status:'ok',database:'postgresql-postgis',redis:'connected',queue:'connected',demo:config.demo};}
 @Get('config') configuration(){return {demo:config.demo,demoOtp:config.OTP_DEMO_MODE==='true',onlineAvailable:config.onlinePayments};}
 @Get('branches') branches(){return this.r.catalogue.branches();}
 @Get('branches/:id/menu') async menu(@Param('id')id:string){return {items:await this.r.catalogue.menu(this.id(id))};}
 @Post('auth/otp') otp(@Body()body:unknown,@Req()req:FastifyRequest){return this.r.auth.sendOtp(body,req.ip);}
 @Post('auth/verify') verify(@Body()body:unknown,@Res({passthrough:true})res:FastifyReply){return this.r.auth.verifyOtp(body,res);}
 @Post('auth/staff-login') login(@Body()body:unknown,@Req()req:FastifyRequest,@Res({passthrough:true})res:FastifyReply){return this.r.auth.loginStaff(body,req.ip,res);}
 @Get('auth/me') async me(@Req()req:FastifyRequest){return this.r.auth.publicUser(await this.r.auth.require(req));}
 @Post('auth/refresh') refresh(@Req()req:FastifyRequest,@Res({passthrough:true})res:FastifyReply){return this.r.auth.refresh(req,res);}
 @Post('auth/logout') logout(@Req()req:FastifyRequest,@Res({passthrough:true})res:FastifyReply){return this.r.auth.logout(req,res);}
 @Get('cart') async getCart(@Req()req:FastifyRequest,@Res({passthrough:true})res:FastifyReply){return this.r.cart.view(await this.cart(req,res));}
 @Put('cart') async putCart(@Body()body:unknown,@Req()req:FastifyRequest,@Res({passthrough:true})res:FastifyReply){await this.r.auth.limit('cart:'+req.ip,120,60);return this.r.cart.update(await this.cart(req,res),body);}
 @Post('checkout/quote') async quote(@Body()body:unknown,@Req()req:FastifyRequest,@Res({passthrough:true})res:FastifyReply){const actor=await this.r.auth.require(req,['customer']);return this.r.orders.preview(await this.cart(req,res),body,actor);}
 @Post('orders') async create(@Body()body:unknown,@Req()req:FastifyRequest,@Res({passthrough:true})res:FastifyReply){const actor=await this.r.auth.require(req,['customer']);await this.r.auth.limit('checkout:'+actor.id,10,60);return this.r.orders.create(await this.cart(req,res),body,actor,String(req.headers['idempotency-key']||''));}
 @Get('orders') async orders(@Req()req:FastifyRequest){return this.r.orders.list(await this.r.auth.require(req));}
 @Get('orders/:id') async order(@Param('id')id:string,@Req()req:FastifyRequest){return this.r.orders.detail(this.id(id),await this.r.auth.require(req));}
 @Post('orders/:id/cancel') async cancel(@Param('id')id:string,@Body()body:unknown,@Req()req:FastifyRequest){const input=z.object({reason:z.string().trim().min(3).max(300)}).parse(body);return this.r.orders.transition(this.id(id),'cancelled',await this.r.auth.require(req),input.reason);}
 @Post('orders/:id/transition') async transition(@Param('id')id:string,@Body()body:unknown,@Req()req:FastifyRequest){const input=z.object({status:z.enum(['accepted','rejected','preparing','ready','out_for_delivery','completed','cancelled']),note:z.string().trim().max(300).default('')}).parse(body);return this.r.orders.transition(this.id(id),input.status,await this.r.auth.require(req,staffRoles),input.note);}
 @Post('orders/:id/retry-payment') async retry(@Param('id')id:string,@Req()req:FastifyRequest){
  const actor=await this.r.auth.require(req,['customer']);const order=await this.r.orders.detail(this.id(id),actor);
  if(order.status!=='pending_payment')fail(409,'This order is not waiting for payment.');
  const failed=order.payments[0];if(failed?.status==='failed'){
   const {randomUUID}=await import('node:crypto');await this.r.db.query('INSERT INTO payments(id,order_id,provider,reference,amount,simulated) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),id,this.r.orders.gateway.name,'MZ-'+randomUUID(),order.total,this.r.orders.gateway.simulated]);await this.r.db.query("UPDATE orders SET payment_status='pending' WHERE id=$1",[id]);
  }
  await this.r.orders.initializePayment(order,actor);return this.r.orders.detail(id,actor);
 }
 @Post('orders/:id/rating') async rate(@Param('id')id:string,@Body()body:unknown,@Req()req:FastifyRequest){const actor=await this.r.auth.require(req,['customer']);const order=await this.r.orders.detail(this.id(id),actor);if(order.status!=='completed')fail(409,'Rate your meal after the order is completed.');const input=z.object({food:z.number().int().min(1).max(5),delivery:z.number().int().min(1).max(5).optional(),comment:z.string().trim().max(1000).default('')}).parse(body);const {randomUUID}=await import('node:crypto');await this.r.db.query('INSERT INTO ratings(order_id,food,delivery,comment) VALUES($1,$2,$3,$4) ON CONFLICT(order_id) DO UPDATE SET food=EXCLUDED.food,delivery=EXCLUDED.delivery,comment=EXCLUDED.comment',[id,input.food,input.delivery??null,input.comment]);return {ok:true};}
 @Post('orders/:id/thread') async thread(@Param('id')id:string,@Req()req:FastifyRequest){return this.r.staff.orderThread(await this.r.auth.require(req),this.id(id));}
 @Get('threads/:id/messages') async messages(@Param('id')id:string,@Req()req:FastifyRequest){return this.r.staff.chatMessages(await this.r.auth.require(req),this.id(id));}
 @Post('threads/:id/messages') async message(@Param('id')id:string,@Body()body:unknown,@Req()req:FastifyRequest){const actor=await this.r.auth.require(req);await this.r.auth.limit('chat:'+actor.id,30,60);return this.r.staff.sendMessage(actor,this.id(id),body);}
 @Post('webhooks/:provider') webhook(@Param('provider')provider:string,@Req()req:FastifyRequest){if(provider!==this.r.orders.gateway.name)fail(404,'Webhook endpoint not found.');const raw=(req as any).rawBody as Buffer;if(!raw)fail(400,'Raw request body required.');return this.r.orders.receiveWebhook(raw,String(req.headers['x-paystack-signature']||''));}
 @Get('mock-pay/:reference') async mockPayment(@Param('reference')reference:string,@Req()req:FastifyRequest){if(!config.demo)fail(404,'Not found.');const actor=await this.r.auth.require(req);const row=(await this.r.db.query('SELECT p.reference,p.amount,p.status,p.order_id,o.number FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.reference=$1 AND o.user_id=$2',[reference,actor.id]))[0];if(!row)fail(404,'Payment not found.');return row;}
 @Post('mock-pay/:reference') async simulate(@Param('reference')reference:string,@Body()body:unknown,@Req()req:FastifyRequest){
  await this.mockPayment(reference,req);const input=z.object({scenario:z.enum(['approve','decline','abandon','delayed','duplicate','late']),delaySeconds:z.number().int().min(1).max(60).default(5)}).parse(body);
  const gateway=this.r.orders.gateway;if(!(gateway instanceof MockPaymentProvider))fail(404,'Not found.');
  if(input.scenario==='late'){const p=(await this.r.db.query('SELECT order_id FROM payments WHERE reference=$1',[reference]))[0];await this.r.orders.expire(p.order_id);}
  await gateway.scenario(reference,input.scenario,input.scenario==='delayed'?input.delaySeconds*1000:input.scenario==='late'?1500:500);
  return {queued:true};
 }
 @Get('staff/orders') async staffOrders(@Req()req:FastifyRequest){return this.r.orders.list(await this.r.auth.require(req,staffRoles),true);}
 @Get('staff/summary') async summary(@Req()req:FastifyRequest){return this.r.staff.summary(await this.r.auth.require(req,['super_admin','branch_manager','support_agent']));}
 @Get('staff/chats') async chats(@Req()req:FastifyRequest){return this.r.staff.chats(await this.r.auth.require(req,['super_admin','branch_manager','support_agent']));}
 @Patch('staff/catalogue/:id') async updateItem(@Param('id')id:string,@Body()body:unknown,@Req()req:FastifyRequest){return this.r.staff.updateItem(await this.r.auth.require(req,['super_admin','branch_manager','kitchen_staff']),id,body);}
 @Patch('staff/orders/:id/rider') async assign(@Param('id')id:string,@Body()body:unknown,@Req()req:FastifyRequest){return this.r.staff.assignRider(await this.r.auth.require(req,['super_admin','branch_manager']),this.id(id),body);}
 @Get('staff/integrations') async integrations(@Req()req:FastifyRequest){await this.r.auth.require(req,['super_admin']);return {payment:{provider:this.r.orders.gateway.name,simulated:this.r.orders.gateway.simulated},sms:{provider:config.SMS_PROVIDER},email:{provider:config.EMAIL_PROVIDER},database:'PostgreSQL + PostGIS',redis:'Redis + BullMQ'};}
 @Get('dev/inbox') async inbox(@Req()req:FastifyRequest){await this.r.auth.require(req,['super_admin']);if(!config.demo)fail(404,'Not found.');return this.r.db.query('SELECT * FROM dev_outbox ORDER BY created_at DESC LIMIT 100');}
 @Get('notifications') async notifications(@Req()req:FastifyRequest){const actor=await this.r.auth.require(req);return this.r.db.query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',[actor.id]);}
 @Post('staff/uploads') async upload(@Body()body:unknown,@Req()req:FastifyRequest){const actor=await this.r.auth.require(req,['super_admin']);await this.r.auth.limit('upload:'+actor.id,20,60);return uploadImage(body);}
 @Get('staff/users') async users(@Req()req:FastifyRequest){return this.r.admin.users(await this.r.auth.require(req,['super_admin','branch_manager']));}
 @Post('staff/users') async createUser(@Body()body:unknown,@Req()req:FastifyRequest){return this.r.admin.createUser(await this.r.auth.require(req,['super_admin','branch_manager']),body);}
 @Delete('staff/users/:id') async deactivate(@Param('id')id:string,@Req()req:FastifyRequest){return this.r.admin.deactivate(await this.r.auth.require(req,['super_admin','branch_manager']),this.id(id));}
 @Post('staff/catalogue') async createItem(@Body()body:unknown,@Req()req:FastifyRequest){return this.r.admin.addItem(await this.r.auth.require(req,['super_admin']),body);}
 @Get('staff/branches/:id/zones') async zones(@Param('id')id:string,@Req()req:FastifyRequest){return this.r.admin.zones(await this.r.auth.require(req,['super_admin','branch_manager']),this.id(id));}
 @Post('staff/zones') async saveZone(@Body()body:unknown,@Req()req:FastifyRequest){return this.r.admin.saveZone(await this.r.auth.require(req,['super_admin','branch_manager']),body);}
 @Patch('staff/branches/:id') async saveBranch(@Param('id')id:string,@Body()body:unknown,@Req()req:FastifyRequest){return this.r.admin.branch(await this.r.auth.require(req,['super_admin','branch_manager']),this.id(id),body);}
 @Get('staff/promotions') async promotions(@Req()req:FastifyRequest){return this.r.admin.promotions(await this.r.auth.require(req,['super_admin','branch_manager']));}
 @Post('staff/promotions') async promotion(@Body()body:unknown,@Req()req:FastifyRequest){return this.r.admin.promotion(await this.r.auth.require(req,['super_admin','branch_manager']),body);}
 @Get('rider/orders') async riderOrders(@Req()req:FastifyRequest){return this.r.orders.list(await this.r.auth.require(req,['rider']),true);}
 @Post('rider/orders/:id/location') async location(@Param('id')id:string,@Body()body:unknown,@Req()req:FastifyRequest){const actor=await this.r.auth.require(req,['rider']);await this.r.auth.limit('rider-location:'+actor.id,8,60);return this.r.admin.location(actor,this.id(id),body);}
 @Post('staff/orders/:id/refund') async refund(@Param('id')id:string,@Body()body:unknown,@Req()req:FastifyRequest){const actor=await this.r.auth.require(req,['super_admin','branch_manager','support_agent']);const order=await this.r.orders.detail(this.id(id),actor);const input=z.object({amount:z.number().int().min(1),reason:z.string().trim().min(3).max(300)}).parse(body);if(actor.role==='support_agent'&&input.amount>5000)fail(403,'Support refunds are limited to GHS 50.00.');const payment=order.payments.find((payment:any)=>payment.status==='succeeded');if(!payment||input.amount>payment.amount-payment.refunded_amount)fail(400,'The refund exceeds the remaining paid amount.');await this.r.orders.requestRefund(id,input.amount,input.reason,true);return {queued:true};}
 @Get('account/addresses') async addresses(@Req()req:FastifyRequest){const actor=await this.r.auth.require(req);return this.r.db.query('SELECT id,label,data FROM addresses WHERE user_id=$1',[actor.id]);}
 @Delete('account/addresses/:id') async deleteAddress(@Param('id')id:string,@Req()req:FastifyRequest){const actor=await this.r.auth.require(req);await this.r.db.query('DELETE FROM addresses WHERE id=$1 AND user_id=$2',[this.id(id),actor.id]);return {ok:true};}
 @Post('account/addresses') async saveAddress(@Body()body:unknown,@Req()req:FastifyRequest){const actor=await this.r.auth.require(req);const input=z.object({label:z.string().trim().min(1).max(60),data:addressSchema}).parse(body);const {randomUUID}=await import('node:crypto');return (await this.r.db.query('INSERT INTO addresses(id,user_id,label,data) VALUES($1,$2,$3,$4::jsonb) RETURNING id,label,data',[randomUUID(),actor.id,input.label,JSON.stringify(input.data)]))[0];}
}
