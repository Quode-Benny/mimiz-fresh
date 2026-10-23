import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put, Query, Req, Res } from '@nestjs/common';
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
import {randomUUID} from 'node:crypto';
import {cookiePrefix,requestPortal} from './portal';
import {uploadImage} from './uploads';
import {photoStorage} from './storage';
import {PhotoNotFound} from '@mimiz/providers';
import { fail, staffRoles, branchAllowed, type Actor } from './security';
import type {AccountsService} from './accounts';
import type {OperationsService} from './operations';
import type {RecommendationsService} from './recommendations';
import type {MapsService} from './maps';
import type {NotificationsService} from './notifications';
import type {ChatService} from './chat';
import type {TwoFactorService} from './two-factor';
import type {ManualOrdersService} from './manual-orders';
import type {SettingsService} from './settings';
export type Runtime={settings:SettingsService;manualOrders:ManualOrdersService;twoFactor:TwoFactorService;chat:ChatService;notifications:NotificationsService;maps:MapsService;recommendations:RecommendationsService;operations:OperationsService;accounts:AccountsService;db:Database;auth:AuthService;catalogue:CatalogueRepository;cart:CartService;orders:OrdersService;staff:StaffService;admin:AdminService;redis:any;queue:any};
@Controller('api/v1')
@ApiTags('Mimiz')
export class ApiController {
 constructor(@Inject('runtime') private r:Runtime){}
 private id(value:string){return z.string().uuid().parse(value);}
 private async cart(req:FastifyRequest,res:FastifyReply){const actor=await this.r.auth.current(req);if(req.cookies.mimiz_refresh&&!actor)fail(401,'Refresh your session.','UNAUTHENTICATED');return this.r.cart.get(req,res,actor);}
 @Get('health') async health(){await this.r.db.query('SELECT 1');await this.r.redis.ping();return {status:'ok',database:'postgresql-postgis',redis:'connected',queue:'connected',demo:config.demo};}
 @Get('config') async configuration(){const company=await this.r.settings.public();return {safeAcceptance:config.NODE_ENV!=='production'&&config.PAYMENT_PROVIDER==='mock'&&config.SMS_PROVIDER==='console'&&config.EMAIL_PROVIDER==='console'&&config.OTP_DEMO_MODE==='true'&&(!process.env.STORAGE_PROVIDER||process.env.STORAGE_PROVIDER==='local')&&(!process.env.ERROR_PROVIDER||process.env.ERROR_PROVIDER==='console')&&(!process.env.MAPS_PROVIDER||process.env.MAPS_PROVIDER==='osm'),demo:config.demo,demoOtp:config.OTP_DEMO_MODE==='true',onlineAvailable:config.onlinePayments&&company.settings.flags.onlinePayments,flags:company.settings.flags};}
 @Get('maps/search') async searchPlaces(@Query('q')q:string,@Req()req:FastifyRequest){await this.r.auth.limit('geocode:'+req.ip,20,60);return this.r.maps.search(q);}
 @Get('settings') publicSettings(){return this.r.settings.public();}
 @Patch('staff/settings') async saveCompanySettings(@Body()body:unknown,@Req()req:FastifyRequest){return this.r.settings.save(await this.r.auth.require(req,['super_admin']),body);}
 @Get('branches/:id/categories') publicCategories(@Param('id')id:string){return this.r.settings.categories(this.id(id));}
 @Get('staff/categories') async manageCategories(@Query('branchId')id:string,@Req()req:FastifyRequest){await this.r.auth.require(req,['super_admin']);return this.r.settings.categories(this.id(id),true);}
 @Post('staff/categories') async saveCategory(@Body()body:unknown,@Req()req:FastifyRequest){return this.r.settings.saveCategory(await this.r.auth.require(req,['super_admin']),body);}
 @Post('staff/categories/reorder') async sortCategories(@Body()body:unknown,@Req()req:FastifyRequest){return this.r.settings.reorder(await this.r.auth.require(req,['super_admin']),'categories',body);}
 @Post('staff/catalogue/reorder') async sortItems(@Body()body:unknown,@Req()req:FastifyRequest){return this.r.settings.reorder(await this.r.auth.require(req,['super_admin']),'catalogue',body);}
 @Get('staff/branches') async manageBranches(@Req()req:FastifyRequest){const actor=await this.r.auth.require(req,['super_admin','branch_manager']);return (await this.r.catalogue.branches(true)).filter(branch=>branchAllowed(actor,branch.id));}
 @Patch('staff/branches/:id/operating') async operating(@Param('id')id:string,@Body()body:unknown,@Req()req:FastifyRequest){return this.r.settings.operating(await this.r.auth.require(req,['super_admin','branch_manager','kitchen_staff']),this.id(id),body);}
 @Patch('staff/branches/:id/active') async activeBranch(@Param('id')id:string,@Body()body:unknown,@Req()req:FastifyRequest){return this.r.settings.active(await this.r.auth.require(req,['super_admin']),this.id(id),body);}
 @Get('branches') branches(){return this.r.catalogue.branches();}
 @Post('branches/resolve') async resolveBranches(@Body()body:unknown,@Req()req:FastifyRequest){await this.r.auth.limit('branch-resolve:'+req.ip,60,60);return this.r.catalogue.resolve(body);}
 @Get('branches/:id/recommendations') async recommendations(@Param('id')id:string,@Query('daypart')daypart:string,@Req()req:FastifyRequest){const part=z.enum(['breakfast','lunch','afternoon','dinner','late_night']).parse(daypart);return this.r.recommendations.get(this.id(id),part,await this.r.auth.current(req));}
 @Post('recommendations/events') async recommendationEvents(@Body()body:unknown,@Req()req:FastifyRequest){await this.r.auth.limit('recommendations:'+req.ip,60,60);return this.r.recommendations.log(await this.r.auth.current(req),body);}
 @Post('staff/branches') async addBranch(@Body()body:unknown,@Req()req:FastifyRequest){return this.r.admin.createBranch(await this.r.auth.require(req,['super_admin']),body);}
 @Get('branches/:id/menu') async menu(@Param('id')id:string){return {items:await this.r.catalogue.menu(this.id(id))};}
 @Post('auth/otp') otp(@Body()body:unknown,@Req()req:FastifyRequest){return this.r.auth.sendOtp(body,req.ip);}
 @Post('auth/verify') verify(@Body()body:unknown,@Req()req:FastifyRequest,@Res({passthrough:true})res:FastifyReply){if(requestPortal(req)&&requestPortal(req)!=='customer')fail(403,'Customer sign in belongs to the customer site.');return this.r.auth.verifyOtp(body,res);}
 @Post('auth/staff-login') login(@Body()body:unknown,@Req()req:FastifyRequest,@Res({passthrough:true})res:FastifyReply){return this.r.auth.loginStaff(body,req.ip,res,req);}
 @Get('auth/2fa') async factorStatus(@Req()req:FastifyRequest){return this.r.twoFactor.status(await this.r.auth.require(req,staffRoles));}
 @Post('auth/2fa/setup') async factorSetup(@Body()body:unknown,@Req()req:FastifyRequest){const actor=await this.r.auth.require(req,staffRoles);await this.r.auth.limit('2fa:'+actor.id,8,900);return this.r.twoFactor.setup(actor,body);}
 @Post('auth/2fa/confirm') async factorConfirm(@Body()body:unknown,@Req()req:FastifyRequest,@Res({passthrough:true})res:FastifyReply){const actor=await this.r.auth.require(req,staffRoles);await this.r.auth.limit('2fa:'+actor.id,8,900);const result=await this.r.twoFactor.confirm(actor,body);await this.r.auth.issue(actor,res,randomUUID(),cookiePrefix(req));return result;}
 @Post('auth/2fa/disable') async factorDisable(@Body()body:unknown,@Req()req:FastifyRequest,@Res({passthrough:true})res:FastifyReply){const actor=await this.r.auth.require(req,staffRoles);await this.r.auth.limit('2fa:'+actor.id,8,900);const result=await this.r.twoFactor.disable(actor,body);await this.r.auth.issue(actor,res,randomUUID(),cookiePrefix(req));return result;}
 @Get('auth/me') async me(@Req()req:FastifyRequest){return this.r.auth.publicUser(await this.r.auth.require(req));}
 @Post('auth/refresh') refresh(@Req()req:FastifyRequest,@Res({passthrough:true})res:FastifyReply){return this.r.auth.refresh(req,res);}
 @Post('auth/logout') logout(@Req()req:FastifyRequest,@Res({passthrough:true})res:FastifyReply){return this.r.auth.logout(req,res);}
 @Get('cart') async getCart(@Req()req:FastifyRequest,@Res({passthrough:true})res:FastifyReply){return this.r.cart.view(await this.cart(req,res));}
 @Put('cart') async putCart(@Body()body:unknown,@Req()req:FastifyRequest,@Res({passthrough:true})res:FastifyReply){await this.r.auth.limit('cart:'+req.ip,120,60);return this.r.cart.update(await this.cart(req,res),body);}
 @Post('checkout/quote') async quote(@Body()body:unknown,@Req()req:FastifyRequest,@Res({passthrough:true})res:FastifyReply){const actor=await this.r.auth.require(req,['customer']);return this.r.orders.preview(await this.cart(req,res),body,actor);}
 @Post('orders') async create(@Body()body:unknown,@Req()req:FastifyRequest,@Res({passthrough:true})res:FastifyReply){const actor=await this.r.auth.require(req,['customer']);await this.r.auth.limit('checkout:'+actor.id,10,60);return this.r.orders.create(await this.cart(req,res),body,actor,String(req.headers['idempotency-key']||''));}
 @Get('orders') async orders(@Req()req:FastifyRequest){return this.r.orders.list(await this.r.auth.require(req));}
 @Get('orders/:id') async order(@Param('id')id:string,@Req()req:FastifyRequest){return this.r.orders.detail(this.id(id),await this.r.auth.require(req));}
 @Post('orders/:id/reorder') async reorder(@Param('id')id:string,@Body()body:unknown,@Req()req:FastifyRequest,@Res({passthrough:true})res:FastifyReply){
  const actor=await this.r.auth.require(req,['customer']);const order=await this.r.orders.detail(this.id(id),actor);
  const input=z.object({cartVersion:z.number().int(),replace:z.boolean().default(false)}).parse(body);const cart=await this.cart(req,res);
  if(cart.selections.length&&!input.replace)fail(409,'Reordering replaces the meals currently in your bag. Please confirm.','REORDER_CONFIRM');
  const selections=order.items.map((item:any)=>({itemId:item.itemId,quantity:item.quantity,optionIds:item.options.map((option:any)=>option.id),note:''}));
  await this.r.catalogue.price(order.branch_id,selections);
  return this.r.cart.update(cart,{version:input.cartVersion,branchId:order.branch_id,fulfillment:order.fulfillment,promoCode:null,selections});
 }
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
 @Post('orders/:id/thread') async thread(@Param('id')id:string,@Req()req:FastifyRequest){return this.r.chat.forOrder(await this.r.auth.require(req),this.id(id));}
 @Post('orders/:id/rider-thread') async riderThread(@Param('id')id:string,@Req()req:FastifyRequest){return this.r.chat.forRider(await this.r.auth.require(req,['customer','rider']),this.id(id));}
 @Post('support/threads') async generalSupport(@Body()body:unknown,@Req()req:FastifyRequest){return this.r.chat.general(await this.r.auth.require(req,['customer']),body);}
 @Get('threads/:id') async threadInfo(@Param('id')id:string,@Req()req:FastifyRequest){return this.r.chat.info(await this.r.auth.require(req),this.id(id));}
 @Post('threads/:id/claim') async claimThread(@Param('id')id:string,@Body()body:unknown,@Req()req:FastifyRequest){return this.r.chat.claim(await this.r.auth.require(req,['super_admin','branch_manager','support_agent']),this.id(id),body);}
 @Post('threads/:id/handover') async handover(@Param('id')id:string,@Req()req:FastifyRequest){return this.r.chat.handover(await this.r.auth.require(req),this.id(id));}
 @Get('threads/:id/presence') async presence(@Param('id')id:string,@Req()req:FastifyRequest){return this.r.chat.presence(await this.r.auth.require(req),this.id(id));}
 @Post('threads/:id/typing') async typing(@Param('id')id:string,@Req()req:FastifyRequest){const actor=await this.r.auth.require(req);await this.r.auth.limit('typing:'+actor.id,45,60);return this.r.chat.typing(actor,this.id(id));}
 @Post('threads/:id/attachments') async uploadChat(@Param('id')id:string,@Body()body:unknown,@Req()req:FastifyRequest){const actor=await this.r.auth.require(req);await this.r.auth.limit('chat-upload:'+actor.id,20,60);return this.r.chat.upload(actor,this.id(id),body);}
 @Get('threads/:id/attachments/:imageId') async chatImage(@Param('id')id:string,@Param('imageId')imageId:string,@Req()req:FastifyRequest,@Res()res:FastifyReply){const actor=await this.r.auth.require(req);const image=await this.r.chat.image(actor,this.id(id),this.id(imageId));res.type('image/webp').header('Cache-Control','private, no-store');return res.send(image);}
 @Get('threads/:id/messages') async messages(@Param('id')id:string,@Req()req:FastifyRequest){return this.r.chat.messages(await this.r.auth.require(req),this.id(id));}
 @Post('threads/:id/messages') async message(@Param('id')id:string,@Body()body:unknown,@Req()req:FastifyRequest){const actor=await this.r.auth.require(req);await this.r.auth.limit('chat:'+actor.id,30,60);return this.r.chat.send(actor,this.id(id),body);}
 @Post('webhooks/:provider') webhook(@Param('provider')provider:string,@Req()req:FastifyRequest){if(provider!==this.r.orders.gateway.name)fail(404,'Webhook endpoint not found.');const raw=(req as any).rawBody as Buffer;if(!raw)fail(400,'Raw request body required.');return this.r.orders.receiveWebhook(raw,String(req.headers['x-paystack-signature']||''));}
 @Get('mock-pay/:reference') async mockPayment(@Param('reference')reference:string,@Req()req:FastifyRequest){if(!config.demo)fail(404,'Not found.');const actor=await this.r.auth.require(req);const row=(await this.r.db.query('SELECT p.reference,p.amount,p.status,p.order_id,o.number FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.reference=$1 AND o.user_id=$2',[reference,actor.id]))[0];if(!row)fail(404,'Payment not found.');return row;}
 @Post('mock-pay/:reference') async simulate(@Param('reference')reference:string,@Body()body:unknown,@Req()req:FastifyRequest){
  await this.mockPayment(reference,req);const input=z.object({scenario:z.enum(['approve','decline','abandon','delayed','duplicate','late']),delaySeconds:z.number().int().min(1).max(60).default(5)}).parse(body);
  const gateway=this.r.orders.gateway;if(!(gateway instanceof MockPaymentProvider))fail(404,'Not found.');
  if(input.scenario==='late'){const p=(await this.r.db.query('SELECT order_id FROM payments WHERE reference=$1',[reference]))[0];await this.r.orders.expire(p.order_id);}
  await gateway.scenario(reference,input.scenario,input.scenario==='delayed'?input.delaySeconds*1000:input.scenario==='late'?1500:500);
  return {queued:true};
 }
 @Post('staff/orders/quote') async quoteManualOrder(@Body()body:unknown,@Req()req:FastifyRequest){return this.r.manualOrders.preview(await this.r.auth.require(req,['super_admin','branch_manager','support_agent']),body);}
 @Post('staff/orders/manual') async createManualOrder(@Body()body:unknown,@Req()req:FastifyRequest){const actor=await this.r.auth.require(req,['super_admin','branch_manager','support_agent']);await this.r.auth.limit('manual-order:'+actor.id,20,60);return this.r.manualOrders.create(actor,body,String(req.headers['idempotency-key']||''));}
 @Get('staff/queue') async kitchenQueue(@Query()query:any,@Req()req:FastifyRequest){return this.r.orders.kitchenQueue(await this.r.auth.require(req,['super_admin','branch_manager','kitchen_staff','support_agent']),query);}
 @Get('staff/orders') async staffOrders(@Req()req:FastifyRequest){return this.r.orders.list(await this.r.auth.require(req,staffRoles),true);}
 @Get('staff/summary') async summary(@Req()req:FastifyRequest){return this.r.staff.summary(await this.r.auth.require(req,['super_admin','branch_manager','support_agent']));}
 @Get('staff/chats') async chats(@Req()req:FastifyRequest){return this.r.chat.list(await this.r.auth.require(req,['super_admin','branch_manager','support_agent']));}
 @Get('staff/catalogue') async manageCatalogue(@Query('branchId')branchId:string,@Req()req:FastifyRequest){const actor=await this.r.auth.require(req,['super_admin','branch_manager','kitchen_staff']);if(!branchAllowed(actor,this.id(branchId)))fail(403,'Choose your assigned kitchen.');return {items:await this.r.catalogue.menu(branchId,undefined,true)};}
 @Post('staff/catalogue/:id/duplicate') async duplicateDish(@Param('id')id:string,@Body()body:unknown,@Req()req:FastifyRequest){return this.r.admin.duplicateItem(await this.r.auth.require(req,['super_admin']),id,body);}
 @Patch('staff/catalogue/:id') async updateItem(@Param('id')id:string,@Body()body:unknown,@Req()req:FastifyRequest){return this.r.staff.updateItem(await this.r.auth.require(req,['super_admin','branch_manager','kitchen_staff']),id,body);}
 @Patch('staff/orders/:id/rider') async assign(@Param('id')id:string,@Body()body:unknown,@Req()req:FastifyRequest){return this.r.staff.assignRider(await this.r.auth.require(req,['super_admin','branch_manager']),this.id(id),body);}
 @Get('staff/reports') async reports(@Query()query:unknown,@Req()req:FastifyRequest){return this.r.operations.reports(await this.r.auth.require(req,['super_admin','branch_manager']),query);}
 @Get('staff/audit') async auditLog(@Query()query:unknown,@Req()req:FastifyRequest){return this.r.operations.audit(await this.r.auth.require(req,['super_admin','branch_manager']),query);}
 @Get('staff/customers') async customers(@Query()query:unknown,@Req()req:FastifyRequest){return this.r.operations.customers(await this.r.auth.require(req,['super_admin','branch_manager']),query);}
 @Patch('staff/customers/:id') async editCustomer(@Param('id')id:string,@Body()body:unknown,@Req()req:FastifyRequest){return this.r.operations.customer(await this.r.auth.require(req,['super_admin']),this.id(id),body);}
 @Get('staff/integrations') async integrations(@Req()req:FastifyRequest){await this.r.auth.require(req,['super_admin']);return {payment:{provider:this.r.orders.gateway.name,simulated:this.r.orders.gateway.simulated},sms:{provider:config.SMS_PROVIDER,status:config.SMS_PROVIDER==='console'?'simulated':'unverified'},email:{provider:config.EMAIL_PROVIDER,status:config.EMAIL_PROVIDER==='console'?'simulated':'unverified'},storage:{provider:process.env.STORAGE_PROVIDER||'local',status:process.env.STORAGE_PROVIDER==='s3'?'unverified':'active'},assistant:{provider:process.env.AI_CHAT_PROVIDER||'off',status:process.env.AI_CHAT_PROVIDER==='ollama'?'unverified':'disabled'},errors:{provider:process.env.ERROR_PROVIDER||'console',status:process.env.ERROR_PROVIDER==='sentry'?'unverified':'active'},database:'PostgreSQL + PostGIS',redis:'Redis + BullMQ'};}
 @Get('dev/inbox') async inbox(@Req()req:FastifyRequest){await this.r.auth.require(req,['super_admin']);if(!config.demo)fail(404,'Not found.');return this.r.db.query('SELECT * FROM dev_outbox ORDER BY created_at DESC LIMIT 100');}
 @Get('push/config') pushConfiguration(){return {available:this.r.notifications.pushAvailable,publicKey:this.r.notifications.pushAvailable?process.env.VAPID_PUBLIC_KEY:null};}
 @Post('push/subscriptions') async subscribe(@Body()body:unknown,@Req()req:FastifyRequest){return this.r.notifications.subscribe(await this.r.auth.require(req,['customer']),body);}
 @Delete('push/subscriptions') async unsubscribe(@Body()body:unknown,@Req()req:FastifyRequest){return this.r.notifications.unsubscribe(await this.r.auth.require(req,['customer']),body);}
 @Get('staff/notification-deliveries') async deliveryReport(@Query('branchId')branchId:string,@Query('orderId')orderId:string,@Req()req:FastifyRequest){return this.r.notifications.report(await this.r.auth.require(req,['super_admin','branch_manager']),branchId?this.id(branchId):undefined,orderId?this.id(orderId):undefined);}
 @Get('staff/notification-templates') async templates(@Req()req:FastifyRequest){await this.r.auth.require(req,['super_admin']);return this.r.notifications.templates();}
 @Patch('staff/notification-templates/:event') async updateTemplate(@Param('event')event:string,@Body()body:unknown,@Req()req:FastifyRequest){return this.r.notifications.updateTemplate(await this.r.auth.require(req,['super_admin']),event,body);}
 @Get('notifications') async notifications(@Req()req:FastifyRequest){const actor=await this.r.auth.require(req);return this.r.db.query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',[actor.id]);}
 @Get('uploads/:id/:size') async publicPhoto(@Param('id')id:string,@Param('size')size:string,@Res()res:FastifyReply){const key='uploads/'+this.id(id)+'/'+z.enum(['320.webp','640.webp','1200.webp']).parse(size);let image;try{image=Buffer.from(await photoStorage.get(key));}catch(error){if(error instanceof PhotoNotFound)fail(404,'Photo not found.');throw error;}return res.type('image/webp').header('Cache-Control','public, max-age=31536000, immutable').send(image);}
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
 @Get('account/profile') async profile(@Req()req:FastifyRequest){return this.r.accounts.profile(await this.r.auth.require(req,['customer']));}
 @Patch('account/profile') async saveProfile(@Body()body:unknown,@Req()req:FastifyRequest){return this.r.accounts.update(await this.r.auth.require(req,['customer']),body);}
 @Delete('account') async removeAccount(@Body()body:unknown,@Req()req:FastifyRequest,@Res({passthrough:true})res:FastifyReply){const actor=await this.r.auth.require(req,['customer']);await this.r.accounts.remove(actor,body);return this.r.auth.logout(req,res);}
 @Post('notifications/:id/read') async readNotice(@Param('id')id:string,@Req()req:FastifyRequest){return this.r.accounts.readNotice(await this.r.auth.require(req),this.id(id));}
 @Get('account/addresses') async addresses(@Req()req:FastifyRequest){const actor=await this.r.auth.require(req);return this.r.db.query('SELECT id,label,data FROM addresses WHERE user_id=$1',[actor.id]);}
 @Delete('account/addresses/:id') async deleteAddress(@Param('id')id:string,@Req()req:FastifyRequest){const actor=await this.r.auth.require(req);await this.r.db.query('DELETE FROM addresses WHERE id=$1 AND user_id=$2',[this.id(id),actor.id]);return {ok:true};}
 @Post('account/addresses') async saveAddress(@Body()body:unknown,@Req()req:FastifyRequest){const actor=await this.r.auth.require(req);const input=z.object({label:z.string().trim().min(1).max(60),data:addressSchema}).parse(body);const {randomUUID}=await import('node:crypto');return (await this.r.db.query('INSERT INTO addresses(id,user_id,label,data) VALUES($1,$2,$3,$4::jsonb) RETURNING id,label,data',[randomUUID(),actor.id,input.label,JSON.stringify(input.data)]))[0];}
}
