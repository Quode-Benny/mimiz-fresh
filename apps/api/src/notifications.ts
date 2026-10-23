import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import type {SmsProvider} from '@mimiz/providers';
import webpush from 'web-push';
import {Database} from './database/database';
import {fail,branchAllowed,type Actor} from './security';
const subscriptionSchema=z.object({endpoint:z.url().max(2000).refine(value=>{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&(['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(url.hostname)||/\.(push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)$/.test(url.hostname));},'Use a browser-provided push subscription.'),keys:z.object({p256dh:z.string().regex(/^[A-Za-z0-9_-]{87}$/),auth:z.string().regex(/^[A-Za-z0-9_-]{22}$/)})});
export class NotificationsService{
 readonly pushAvailable=!!(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT);
 constructor(private db:Database,private sms:SmsProvider){}
 async record(tx:PoolClient,input:{userId:string;orderId?:string;number?:string;event:string}){
  const template=(await tx.query('SELECT * FROM notification_templates WHERE event=$1',[input.event])).rows[0];if(!template)return;
  const user=(await tx.query('SELECT notification_preferences,active FROM users WHERE id=$1',[input.userId])).rows[0];if(!user?.active)return;
  const id=randomUUID(),render=(text:string)=>text.replaceAll('{{number}}',input.number||'your order');
  await tx.query('INSERT INTO notifications(id,user_id,order_id,title,body) VALUES($1,$2,$3,$4,$5)',[id,input.userId,input.orderId??null,render(template.title),render(template.body)]);
  if(template.sms&&['placed','out_for_delivery','cancelled'].includes(input.event)&&user.notification_preferences.criticalSms!==false)await tx.query("INSERT INTO message_deliveries(id,notification_id,channel) VALUES($1,$2,'sms')",[randomUUID(),id]);
  if(this.pushAvailable&&user.notification_preferences.push!==false)await tx.query("INSERT INTO message_deliveries(id,notification_id,channel,subscription_id) SELECT gen_random_uuid(),$1,'push',id FROM push_subscriptions WHERE user_id=$2 AND active",[id,input.userId]);
 }
 async subscribe(actor:Actor,body:unknown){if(!this.pushAvailable)fail(503,'Push notifications are not configured.');const input=subscriptionSchema.parse(body);if(Buffer.from(input.keys.p256dh,'base64url').length!==65||Buffer.from(input.keys.auth,'base64url').length!==16)fail(400,'Invalid browser push keys.');await this.db.transaction(async tx=>{await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[actor.id]);if(Number((await tx.query('SELECT count(*) FROM push_subscriptions WHERE user_id=$1 AND endpoint<>$2',[actor.id,input.endpoint])).rows[0].count)>=10)fail(409,'Remove an old notification device before adding another.');await tx.query('INSERT INTO push_subscriptions(id,user_id,endpoint,keys) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(endpoint) DO UPDATE SET user_id=EXCLUDED.user_id,keys=EXCLUDED.keys,active=true',[randomUUID(),actor.id,input.endpoint,JSON.stringify(input.keys)]);});return {ok:true};}
 async unsubscribe(actor:Actor,body:unknown){const {endpoint}=z.object({endpoint:z.string().max(2000)}).parse(body);await this.db.query('DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint=$2',[actor.id,endpoint]);return {ok:true};}
 async deliver(id:string){
  await this.db.transaction(async tx=>{
   const delivery=(await tx.query("SELECT d.*,n.title,n.body,n.order_id,n.user_id,u.phone,u.active AS user_active,u.notification_preferences,s.endpoint,s.keys,s.active AS subscription_active,s.user_id AS subscription_user FROM message_deliveries d JOIN notifications n ON n.id=d.notification_id JOIN users u ON u.id=n.user_id LEFT JOIN push_subscriptions s ON s.id=d.subscription_id WHERE d.id=$1 AND d.status='pending' AND d.next_attempt_at<=now() FOR UPDATE OF d SKIP LOCKED",[id])).rows[0];if(!delivery)return;
   if(!delivery.user_active||delivery.channel==='sms'&&(!delivery.phone||delivery.notification_preferences.criticalSms===false)||delivery.channel==='push'&&(!this.pushAvailable||!delivery.subscription_active||delivery.subscription_user!==delivery.user_id||delivery.notification_preferences.push===false)){await tx.query("UPDATE message_deliveries SET status='skipped' WHERE id=$1",[id]);return;}
   try{
    let segments=0;
    if(delivery.channel==='sms'){const result=await this.sms.send({id:delivery.id,to:delivery.phone,body:delivery.title+'. '+delivery.body,senderId:process.env.SMS_SENDER_ID||'Mimiz'});segments=result.segments;}
    else await webpush.sendNotification({endpoint:delivery.endpoint,keys:delivery.keys},JSON.stringify({title:delivery.title,body:delivery.body,url:delivery.order_id?'/orders/'+delivery.order_id:'/account',tag:delivery.order_id||delivery.notification_id}),{vapidDetails:{subject:process.env.VAPID_SUBJECT!,publicKey:process.env.VAPID_PUBLIC_KEY!,privateKey:process.env.VAPID_PRIVATE_KEY!},TTL:3600,timeout:10000});
    await tx.query("UPDATE message_deliveries SET status='sent',sent_at=now(),attempts=attempts+1,segments=$1,last_error=NULL WHERE id=$2",[segments,id]);
   }catch(error:any){
    if(delivery.channel==='push'&&[404,410].includes(error.statusCode)){await tx.query('UPDATE push_subscriptions SET active=false WHERE id=$1',[delivery.subscription_id]);await tx.query("UPDATE message_deliveries SET status='skipped',last_error='Push subscription expired' WHERE id=$1",[id]);return;}
    const attempts=delivery.attempts+1;await tx.query("UPDATE message_deliveries SET attempts=$1,status=$2,next_attempt_at=now()+($3::int*interval '1 second'),last_error='Provider delivery failed; see provider dashboard' WHERE id=$4",[attempts,attempts>=8?'failed':'pending',Math.min(3600,2**attempts*10),id]);
   }
  });
 }
 async report(actor:Actor,branchId?:string,orderId?:string){if(actor.role!=='super_admin'&&(!actor.branch_id||branchId&&branchId!==actor.branch_id))fail(403,'Choose your assigned kitchen.');return this.db.query("SELECT d.channel,d.status,count(*)::int AS messages,coalesce(sum(d.segments),0)::int AS sms_segments FROM message_deliveries d JOIN notifications n ON n.id=d.notification_id LEFT JOIN orders o ON o.id=n.order_id WHERE ($1::uuid IS NULL OR o.branch_id=$1) AND ($2::uuid IS NULL OR o.id=$2) GROUP BY d.channel,d.status ORDER BY d.channel,d.status",[actor.role==='super_admin'?branchId||null:actor.branch_id,orderId||null]);}
 async templates(){return this.db.query('SELECT * FROM notification_templates ORDER BY event');}
 async updateTemplate(actor:Actor,event:string,body:unknown){const input=z.object({title:z.string().trim().min(3).max(120),body:z.string().trim().min(3).max(500),sms:z.boolean()}).parse(body);if(input.sms&&!['placed','out_for_delivery','cancelled'].includes(event))fail(400,'SMS is limited to placed, out for delivery and cancelled updates.');const changed=await this.db.query('UPDATE notification_templates SET title=$1,body=$2,sms=$3 WHERE event=$4 RETURNING event',[input.title,input.body,input.sms,event]);if(!changed.length)fail(404,'Notification template not found.');await this.db.query("INSERT INTO audit_logs(id,actor_id,action,entity_id,after_data) VALUES($1,$2,'notification-template.update',$3,$4::jsonb)",[randomUUID(),actor.id,event,JSON.stringify(input)]);return {ok:true};}
}
