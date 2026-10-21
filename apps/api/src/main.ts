import './config';
import 'reflect-metadata';
import { Module, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter,type NestFastifyApplication } from '@nestjs/platform-fastify';
import { SwaggerModule,DocumentBuilder } from '@nestjs/swagger';
import cookie from '@fastify/cookie';
import staticFiles from '@fastify/static';
import {mkdir} from 'node:fs/promises';
import {uploadRoot} from './uploads';
import helmet from '@fastify/helmet';
import { Queue,Worker } from 'bullmq';
import Redis from 'ioredis';
import { Server } from 'socket.io';
import { ZodError } from 'zod';
import { Database } from './database/database';
import { seed } from './database/seed';
import { AuthService } from './auth';
import { CatalogueRepository,CartService } from './catalogue';
import { OrdersService } from './orders';
import { StaffService } from './staff';
import {AdminService} from './admin';
import { ApiController,type Runtime } from './controller';
import { MockPaymentProvider,PaystackPaymentProvider,type GatewayStore } from '@mimiz/providers';
import { config } from './config';
import { fail,sameSecret } from './security';
const db=new Database();
const redis=new Redis(config.REDIS_URL,{maxRetriesPerRequest:null});
const redisUrl=new URL(config.REDIS_URL);
const connection={host:redisUrl.hostname,port:Number(redisUrl.port||6379),password:redisUrl.password||undefined};
const queue=new Queue('mimiz-fresh',{connection});
let orders:OrdersService;
let io:Server;
const store:GatewayStore={
 async create(reference,amount){await db.query('INSERT INTO mock_gateway_transactions(reference,amount) VALUES($1,$2) ON CONFLICT DO NOTHING',[reference,amount]);},
 async get(reference){const row=(await db.query('SELECT amount,status FROM mock_gateway_transactions WHERE reference=$1',[reference]))[0];if(!row)throw new Error('Simulated transaction not found');return row as any;},
 async schedule(payload,delay){await queue.add('gateway',{payload},{delay,attempts:8,backoff:{type:'exponential',delay:1000},removeOnComplete:true});},
};
const gateway=config.PAYMENT_PROVIDER==='mock'?new MockPaymentProvider(store,config.MOCK_WEBHOOK_SECRET,config.WEB_ORIGIN):new PaystackPaymentProvider(process.env.PAYSTACK_SECRET_KEY||'');
const catalogue=new CatalogueRepository(db),auth=new AuthService(db,redis),cart=new CartService(catalogue);
orders=new OrdersService(db,catalogue,gateway,queue,order=>{io?.to('user:'+order.user_id).to('branch:'+order.branch_id).emit('order.updated',{id:order.id,status:order.status});});
const staff=new StaffService(db,catalogue,orders);
const admin=new AdminService(db,catalogue);
const runtime:Runtime={db,redis,queue,auth,catalogue,cart,orders,staff,admin};
@Module({controllers:[ApiController],providers:[{provide:'runtime',useValue:runtime}]}) class AppModule{}
class Errors implements ExceptionFilter {
 catch(error:unknown,host:ArgumentsHost){const res=host.switchToHttp().getResponse();if(error instanceof ZodError){res.status(400).send({code:'VALIDATION_FAILED',message:'Check the highlighted details.',details:error.issues.map(issue=>({path:issue.path.join('.'),message:issue.message}))});return;}if(error instanceof HttpException){res.status(error.getStatus()).send(error.getResponse());return;}console.error('API request failed:',error instanceof Error?error.message:'unknown error');res.status(500).send({code:'INTERNAL_ERROR',message:'Something went wrong. Please try again.'});}
}
async function bootstrap(){
 await db.migrate();await seed(db);
 const app=await NestFactory.create<NestFastifyApplication>(AppModule,new FastifyAdapter({bodyLimit:3000000}),{rawBody:true});
 await app.register(cookie as any);
 await mkdir(uploadRoot,{recursive:true});
 await app.register(staticFiles as any,{root:uploadRoot,prefix:'/api/v1/uploads/',decorateReply:false,maxAge:31536000000,immutable:true});
 await app.register(helmet as any,{contentSecurityPolicy:false});
 app.enableCors({origin:config.WEB_ORIGIN,credentials:true});
 app.useGlobalFilters(new Errors());
 app.getHttpAdapter().getInstance().addHook('onRequest',async(req:any,res:any)=>{
  res.header('Cache-Control','no-store');res.header('X-Request-Id',req.id);
  if(['GET','HEAD','OPTIONS'].includes(req.method))return;
  if(req.url.startsWith('/api/v1/webhooks/'))return;
  if(req.headers.origin&&req.headers.origin!==config.WEB_ORIGIN)fail(403,'This origin is not allowed.');
  if(req.cookies?.mimiz_refresh&&!req.url.startsWith('/api/v1/auth/')){
   if(!sameSecret(String(req.cookies.mimiz_csrf||''),String(req.headers['x-csrf-token']||''))||!req.cookies.mimiz_csrf)fail(403,'Refresh the page and try again.','CSRF_INVALID');
  }
 });
 const document=SwaggerModule.createDocument(app,new DocumentBuilder().setTitle('Mimiz API').setVersion('1.0').addCookieAuth('mimiz_access').build());
 SwaggerModule.setup('docs',app,document);
 io=new Server(app.getHttpServer(),{cors:{origin:config.WEB_ORIGIN,credentials:true}});
 io.use(async(socket,next)=>{const cookies=Object.fromEntries((socket.handshake.headers.cookie||'').split(';').filter(Boolean).map(value=>{const i=value.indexOf('=');return[value.slice(0,i).trim(),decodeURIComponent(value.slice(i+1))];}));const actor=await auth.current({cookies} as any);if(!actor)return next(new Error('Sign in required'));socket.data.actor=actor;next();});
 io.on('connection',async socket=>{const actor=socket.data.actor;await socket.join('user:'+actor.id);if(actor.role==='super_admin'){for(const branch of await catalogue.branches())await socket.join('branch:'+branch.id);}else if(actor.branch_id&&actor.role!=='customer')await socket.join('branch:'+actor.branch_id);socket.on('order.join',async(id:string)=>{try{const order=await orders.detail(id,actor);await socket.join('order:'+order.id);}catch{}});});
 const worker=new Worker('mimiz-fresh',async job=>{
  if(job.name==='expire')return orders.expire(job.data.orderId);
  if(job.name==='webhook')return orders.processWebhook(job.data.id);
  if(job.name==='refund')return gateway.refund({reference:job.data.reference,amount:job.data.amount,refundId:job.data.id,reason:job.data.reason});
  if(job.name==='gateway'&&gateway instanceof MockPaymentProvider){
   const payload=job.data.payload;
   if(payload.event==='charge.success'||payload.event==='charge.failed')await db.query("UPDATE mock_gateway_transactions SET status=$1,updated_at=now() WHERE reference=$2 AND status='pending'",[payload.event==='charge.success'?'success':'failed',payload.data.reference]);
   const raw=JSON.stringify(payload);const response=await fetch('http://127.0.0.1:'+config.API_PORT+'/api/v1/webhooks/mock',{method:'POST',headers:{'content-type':'application/json','x-paystack-signature':gateway.signature(raw)},body:raw,signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('Webhook delivery failed: '+response.status);
  }
 },{connection,concurrency:4});
 worker.on('failed',(job,error)=>console.error('Background job failed:',job?.name,error.message));
 // Reconcile committed outbox records after crashes between SQL commit and queue publish.
 const reconcile=setInterval(async()=>{
  try{
   for(const event of await db.query('SELECT id FROM webhook_events WHERE processed_at IS NULL AND created_at<now()-interval \'10 seconds\' LIMIT 100'))await queue.add('webhook',{id:event.id},{jobId:'webhook-'+event.id,attempts:8,backoff:{type:'exponential',delay:1000},removeOnComplete:true});
   for(const refund of await db.query("SELECT r.id,r.amount,r.reason,p.reference FROM refunds r JOIN payments p ON p.id=r.payment_id WHERE r.status='pending' AND r.created_at<now()-interval '10 seconds' LIMIT 100"))await queue.add('refund',refund,{jobId:'refund-'+refund.id,attempts:8,backoff:{type:'exponential',delay:1000},removeOnComplete:true});
   for(const order of await db.query("SELECT id FROM orders WHERE status='pending_payment' AND created_at<now()-interval '15 minutes'"))await orders.expire(order.id);
  }catch(error){console.error('Reconciliation failed');}
 },10000);
 await app.listen(config.API_PORT,'127.0.0.1');
 console.log('Mimiz API ready on port '+config.API_PORT+'. PostgreSQL, PostGIS and Redis connected.');
 async function shutdown(){clearInterval(reconcile);io.close();await worker.close();await queue.close();await redis.quit();await db.close();await app.close();process.exit(0);}
 process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);
}
bootstrap().catch(error=>{console.error('API startup failed:',error);process.exit(1);});
