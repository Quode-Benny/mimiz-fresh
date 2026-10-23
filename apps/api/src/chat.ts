import {LocalSupportModel,needsHuman,mealRequest,type SupportAnswer} from '@mimiz/providers';
import {CatalogueRepository} from './catalogue';
import {formatMoney} from '@mimiz/domain';
import {randomUUID} from 'node:crypto';
import {photoStorage} from './storage';
import {PhotoNotFound} from '@mimiz/providers';
import {resolve} from 'node:path';
import {z} from 'zod';
import sharp from 'sharp';
import type Redis from 'ioredis';
import {Database} from './database/database';
import type {OrdersService} from './orders';
import type {NotificationsService} from './notifications';
import {projectRoot} from './config';
import {checkHours} from './order-rules';
import {fail,branchAllowed,type Actor} from './security';
export const privateChatRoot=resolve(projectRoot,'data/chat');
const staffRoles=['super_admin','branch_manager','support_agent'];
export class ChatService{
 constructor(private db:Database,private orders:OrdersService,private redis:Redis,private notifications:NotificationsService,private signal:(thread:any)=>void,private schedule:(threadId:string,messageId:string)=>Promise<unknown>=async()=>{}){}
 async authorise(actor:Actor,id:string){
 const thread=(await this.db.query('SELECT t.*,b.hours,b.closures,b.name AS branch_name,o.number AS order_number,o.rider_id AS assigned_rider_id,o.status AS order_status,u.name AS claimed_name,r.name AS rider_name FROM chat_threads t JOIN branches b ON b.id=t.branch_id LEFT JOIN orders o ON o.id=t.order_id LEFT JOIN users u ON u.id=t.claimed_by LEFT JOIN users r ON r.id=t.rider_id WHERE t.id=$1',[id]))[0];
 if(!thread)fail(404,'Conversation not found.');
 if(thread.channel==='rider'){
  if(thread.rider_id!==thread.assigned_rider_id||!(actor.role==='customer'&&thread.user_id===actor.id||actor.role==='rider'&&thread.rider_id===actor.id))fail(403,'Only this customer and the currently assigned rider can access delivery chat.');
 }else if(actor.role==='customer'?thread.user_id!==actor.id:!staffRoles.includes(actor.role)||!branchAllowed(actor,thread.branch_id))fail(403,'You cannot access this support conversation.');
 return thread;
 }
 private writable(thread:any){if(thread.channel==='rider'&&['completed','cancelled','rejected'].includes(thread.order_status))fail(409,'This delivery has ended. Its conversation is read-only.');}
 private async lockDelivery(tx:any,thread:any){if(thread.channel!=='rider')return;const order=(await tx.query('SELECT rider_id,status FROM orders WHERE id=$1 FOR SHARE',[thread.order_id])).rows[0];if(order?.rider_id!==thread.rider_id)fail(403,'The assigned rider has changed. Open the current delivery conversation.');this.writable({...thread,order_status:order.status});}
 async forRider(actor:Actor,orderId:string){
 if(!['customer','rider'].includes(actor.role))fail(403,'Customer or assigned rider access required.');
 const order=await this.orders.detail(orderId,actor);
 if(order.fulfillment!=='delivery'||!order.rider_id)fail(409,'A rider has not been assigned to this delivery.');
 return this.db.transaction(async tx=>{
  const current=(await tx.query('SELECT * FROM orders WHERE id=$1 FOR SHARE',[orderId])).rows[0];
  if(current.rider_id!==order.rider_id)fail(409,'The rider assignment changed. Refresh this order.');
  await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',['rider-thread:'+orderId+order.rider_id]);
  const old=(await tx.query("SELECT * FROM chat_threads WHERE order_id=$1 AND rider_id=$2 AND channel='rider'",[orderId,order.rider_id])).rows[0];if(old)return old;
  this.writable({channel:'rider',order_status:current.status});
  return (await tx.query("INSERT INTO chat_threads(id,order_id,user_id,branch_id,support_mode,channel,rider_id) VALUES($1,$2,$3,$4,'human','rider',$5) RETURNING *",[randomUUID(),orderId,order.user_id,order.branch_id,order.rider_id])).rows[0];
 });
 }
 async info(actor:Actor,id:string){const thread=await this.authorise(actor,id);let offline=false;try{checkHours(thread);}catch{offline=true;}return {channel:thread.channel,riderName:thread.rider_name,canWrite:thread.channel!=='rider'||!['completed','cancelled','rejected'].includes(thread.order_status),id:thread.id,orderId:thread.order_id,branchName:thread.branch_name,claimedBy:thread.claimed_by,claimedName:thread.claimed_name,closedAt:thread.closed_at,supportMode:thread.support_mode,handoverReason:thread.handover_reason,assistantAvailable:thread.channel==='support'&&process.env.AI_CHAT_PROVIDER==='ollama',assistantPending:thread.support_mode==='assistant'&&!!(await this.db.query('SELECT id FROM chat_messages WHERE thread_id=$1 AND assistant_requested_at IS NOT NULL AND assistant_processed_at IS NULL LIMIT 1',[id])).length,offline};}
 async list(actor:Actor){if(!staffRoles.includes(actor.role))fail(403,'Support access required.');if(actor.role!=='super_admin'&&actor.role!=='support_agent'&&!actor.branch_id)fail(403,'No kitchen is assigned.');return this.db.query("SELECT t.*,u.name,u.phone,o.number AS order_number,c.name AS claimed_name,(SELECT body FROM chat_messages m WHERE m.thread_id=t.id ORDER BY created_at DESC LIMIT 1) AS latest_message,(SELECT count(*)::int FROM chat_messages m JOIN users sender ON sender.id=m.sender_id WHERE m.thread_id=t.id AND sender.role='customer' AND m.read_at IS NULL) AS unread FROM chat_threads t JOIN users u ON u.id=t.user_id LEFT JOIN orders o ON o.id=t.order_id LEFT JOIN users c ON c.id=t.claimed_by WHERE t.channel='support' AND ($1::uuid IS NULL OR t.branch_id=$1) ORDER BY t.closed_at NULLS FIRST,t.created_at DESC LIMIT 200",[actor.role==='super_admin'?null:actor.branch_id]);}
 async forOrder(actor:Actor,orderId:string){if(actor.role!=='customer'&&!staffRoles.includes(actor.role))fail(403,'Support access required.');const order=await this.orders.detail(orderId,actor);return this.db.transaction(async tx=>{await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',['thread:'+orderId]);const existing=(await tx.query('SELECT * FROM chat_threads WHERE order_id=$1 AND channel=\'support\' ORDER BY created_at LIMIT 1',[orderId])).rows[0];if(existing)return existing;return (await tx.query('INSERT INTO chat_threads(id,order_id,user_id,branch_id,support_mode) VALUES($1,$2,$3,$4,$5) RETURNING *',[randomUUID(),orderId,order.user_id,order.branch_id,actor.role==='customer'&&process.env.AI_CHAT_PROVIDER==='ollama'?'assistant':'human'])).rows[0];});}
 async general(actor:Actor,body:unknown){const {branchId}=z.object({branchId:z.string().uuid()}).parse(body);if(!(await this.db.query('SELECT id FROM branches WHERE id=$1',[branchId])).length)fail(404,'Kitchen not found.');return this.db.transaction(async tx=>{await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',['general:'+actor.id+branchId]);const old=(await tx.query('SELECT * FROM chat_threads WHERE user_id=$1 AND branch_id=$2 AND order_id IS NULL AND closed_at IS NULL LIMIT 1',[actor.id,branchId])).rows[0];if(old)return old;return (await tx.query('INSERT INTO chat_threads(id,user_id,branch_id,support_mode) VALUES($1,$2,$3,$4) RETURNING *',[randomUUID(),actor.id,branchId,process.env.AI_CHAT_PROVIDER==='ollama'?'assistant':'human'])).rows[0];});}
 async messages(actor:Actor,id:string){await this.authorise(actor,id);await this.db.query("UPDATE chat_messages SET read_at=now() WHERE thread_id=$1 AND read_at IS NULL AND sender_id IN (SELECT id FROM users WHERE ($2::text='customer' AND role<>'customer') OR ($2::text<>'customer' AND role='customer'))",[id,actor.role]);return this.db.query("SELECT * FROM (SELECT m.id,m.body,m.attachments,m.flagged,m.created_at,m.read_at,u.name,u.role,m.sender_id,'human'::text AS source,'[]'::jsonb AS actions FROM chat_messages m JOIN users u ON u.id=m.sender_id WHERE thread_id=$1 UNION ALL SELECT id,body,'[]'::jsonb,false,created_at,NULL,CASE WHEN source='assistant' THEN 'Mimiz assistant' ELSE 'Mimiz support' END,source,NULL,source,actions FROM chat_assistant_messages WHERE thread_id=$1) messages ORDER BY created_at DESC,id DESC LIMIT 500",[id]).then(rows=>rows.reverse());}
 async send(actor:Actor,id:string,body:unknown){const thread=await this.authorise(actor,id);this.writable(thread);const input=z.object({body:z.string().trim().max(2000).default(''),attachments:z.array(z.string().uuid()).max(3).default([])}).refine(value=>value.body.length>0||value.attachments.length>0,'Write a message or attach a photo.').parse(body);
 const messageId=randomUUID(),assist=thread.channel==='support'&&actor.role==='customer'&&thread.support_mode==='assistant'&&!thread.claimed_by&&process.env.AI_CHAT_PROVIDER==='ollama';
 await this.db.transaction(async tx=>{await this.lockDelivery(tx,thread);if(!(await tx.query('SELECT id FROM users WHERE id=$1 AND active FOR SHARE',[actor.id])).rowCount)fail(403,'This account is unavailable.');for(const attachment of input.attachments){if(!(await tx.query('SELECT id FROM chat_attachments WHERE id=$1 AND thread_id=$2 AND user_id=$3',[attachment,id,actor.id])).rowCount)fail(403,'This image does not belong to your conversation.');}
 await tx.query('INSERT INTO chat_messages(id,thread_id,sender_id,body,attachments,flagged,assistant_requested_at) VALUES($1,$2,$3,$4,$5::jsonb,$6,CASE WHEN $7 THEN now() ELSE NULL END)',[messageId,id,actor.id,input.body,JSON.stringify(input.attachments),/\b(fuck|shit|bitch)\b/i.test(input.body),assist]);await tx.query("UPDATE chat_threads SET closed_at=NULL,support_mode=CASE WHEN $2 THEN 'human' ELSE support_mode END WHERE id=$1",[id,actor.role!=='customer']);if(thread.channel==='rider'&&actor.role==='customer')await this.notifications.record(tx,{userId:thread.rider_id,orderId:thread.order_id,number:thread.order_number,event:'chat'});if(actor.role!=='customer')await this.notifications.record(tx,{userId:thread.user_id,orderId:thread.order_id||undefined,number:thread.order_number||undefined,event:'chat'});});
 await this.redis.del('mimiz-fresh:typing:'+id+':'+actor.id);this.signal(thread);if(assist){if(needsHuman(input.body)||input.attachments.length)await this.handover(actor,id,input.attachments.length?'A team member will review your photo.':'This request needs the support team.');else await this.schedule(id,messageId).catch(()=>{});}return this.messages(actor,id);}
 async claim(actor:Actor,id:string,body:unknown){if(!staffRoles.includes(actor.role))fail(403,'Support access required.');await this.authorise(actor,id);const {claim}=z.object({claim:z.boolean().default(true)}).parse(body);await this.db.transaction(async tx=>{const thread=(await tx.query('SELECT * FROM chat_threads WHERE id=$1 FOR UPDATE',[id])).rows[0];if(thread.claimed_by&&thread.claimed_by!==actor.id&&!['super_admin','branch_manager'].includes(actor.role))fail(409,'Another team member has claimed this conversation.');await tx.query("UPDATE chat_threads SET claimed_by=$1,support_mode='human' WHERE id=$2",[claim?actor.id:null,id]);await tx.query("INSERT INTO audit_logs(id,actor_id,action,entity_id,after_data) VALUES($1,$2,'chat.claim',$3,$4::jsonb)",[randomUUID(),actor.id,id,JSON.stringify({branchId:thread.branch_id,claimedBy:claim?actor.id:null})]);});return this.info(actor,id);}

 async handover(actor:Actor,id:string,reason='You requested a team member.'){
  const thread=await this.authorise(actor,id);if(thread.channel==='rider')fail(400,'Use kitchen support for a team handover.');
  await this.db.transaction(async tx=>{
   const current=(await tx.query('SELECT support_mode FROM chat_threads WHERE id=$1 FOR UPDATE',[id])).rows[0];
   await tx.query("UPDATE chat_threads SET support_mode='human',handover_reason=$2,handover_at=now(),closed_at=NULL WHERE id=$1",[id,reason]);
   await tx.query('UPDATE chat_messages SET assistant_processed_at=now() WHERE thread_id=$1 AND assistant_requested_at IS NOT NULL AND assistant_processed_at IS NULL',[id]);
   if(current.support_mode!=='human'||!thread.handover_reason)await tx.query("INSERT INTO chat_assistant_messages(id,thread_id,body,source) VALUES($1,$2,$3,'system')",[randomUUID(),id,reason+' Your conversation is in the kitchen support queue. A person will reply when available.']);
  });this.signal(thread);return this.info(actor,id);
 }
 async reconcileAssistant(){for(const row of await this.db.query("SELECT m.id,m.thread_id FROM chat_messages m JOIN chat_threads t ON t.id=m.thread_id WHERE m.assistant_requested_at IS NOT NULL AND m.assistant_processed_at IS NULL AND t.support_mode='assistant' ORDER BY m.created_at LIMIT 25"))await this.schedule(row.thread_id,row.id);}
 async assist(threadId:string,messageId:string){
  const message=(await this.db.query("SELECT m.*,t.user_id,t.branch_id,t.order_id,t.support_mode,t.claimed_by,u.active FROM chat_messages m JOIN chat_threads t ON t.id=m.thread_id JOIN users u ON u.id=t.user_id WHERE m.id=$1 AND t.id=$2",[messageId,threadId]))[0];
  if(!message||message.assistant_processed_at)return;
  const actor={id:message.user_id,role:'customer',name:'Customer',branch_id:null} as Actor;
  const finish=()=>this.db.query('UPDATE chat_messages SET assistant_processed_at=now() WHERE id=$1',[messageId]);
  if(!message.active||message.support_mode!=='assistant'||message.claimed_by){await finish();return;}
  const newest=(await this.db.query('SELECT id FROM chat_messages WHERE thread_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',[threadId]))[0];if(newest?.id!==messageId){await finish();return;}
  try{
   if(process.env.AI_CHAT_PROVIDER!=='ollama')throw Error('Local assistant disabled.');
   const thread=await this.authorise(actor,threadId),menu=await new CatalogueRepository(this.db).menu(thread.branch_id);
   const describe=(items:typeof menu)=>items.filter(item=>item.available).slice(0,8).map(item=>item.name+' from '+formatMoney(item.pricePesewas)).join('; ')||'No matching dishes are available right now.';
   const answers:SupportAnswer[]=[
    {id:'menu',text:'From the current kitchen menu: '+describe(menu)+'. Choose a dish in the menu to check options and add it to your bag.'},
    {id:'vegetarian',text:'Dishes tagged vegetarian on this menu: '+describe(menu.filter(item=>item.vegetarian))+'. These tags are not an allergen or cross-contact guarantee; ask the team about dietary safety.'},
    {id:'spicy',text:'Dishes marked spicy: '+describe(menu.filter(item=>item.spicy))+'. Check each dish for choices before ordering.'},
    {id:'delivery',text:'For delivery, enter your address, a nearby landmark and a map pin at checkout. The server checks kitchen coverage and shows the actual delivery fee before you place an order.'},
    {id:'pickup',text:'Choose Pickup above the menu, then select your dishes. Follow the order tracker after checkout and collect only when the kitchen marks your order ready.'},
    {id:'hours',text:'Kitchen hours today (Ghana time): '+(thread.hours?.[new Date().getUTCDay()]?.closed?'Closed':(thread.hours?.[new Date().getUTCDay()]?.open||'not set')+' to '+(thread.hours?.[new Date().getUTCDay()]?.close||'not set'))+'. Holiday closures and order pauses can affect availability; checkout checks these before accepting an order.'},
    {id:'greeting',text:'Akwaaba! I can help with the current menu, vegetarian or spicy choices, delivery, pickup and kitchen hours. You can request a person at any time.'}
   ];
   if(thread.order_id){const order=await this.orders.detail(thread.order_id,actor);answers.push({id:'tracking',text:'Your order '+order.number+' is currently '+order.status.replaceAll('_',' ')+'. '+(order.status==='placed'?'It is waiting for the kitchen to review and accept it.':'Open your order tracker for recorded progress and the latest estimate.')});}
   if(needsHuman(message.body)){await this.handover(actor,threadId,'This request needs the support team.');return;}
   const previous=await this.db.query('SELECT body FROM chat_messages WHERE thread_id=$1 AND sender_id=$2 AND id<>$3 ORDER BY created_at DESC,id DESC LIMIT 4',[threadId,message.user_id,messageId]);
   const request=mealRequest(message.body,previous.reverse().map(row=>row.body),menu);
   let answerText='',actions:any[]=[];
   if(request){
    const available=request.suggestions.filter(s=>menu.find(item=>item.id===s.itemId)?.available);
    actions=available.map(s=>({kind:'meal',itemId:s.itemId,quantity:s.quantity,name:s.name,branchId:thread.branch_id}));
    answerText=request.error||(!request.suggestions.length?'Which dish would you like? Tell me its menu name and how many, for example: I want Ampesi & kontomire, 2 of that.':!available.length?'That dish is currently unavailable. Choose another meal or ask the team.':'I found '+available.map(s=>s.quantity+' x '+s.name).join('; ')+'. Review the meal options below and confirm Add to bag. Then open checkout to review fulfillment, totals and payment. I have not placed or paid for an order.');
   }else{
    const decision=await new LocalSupportModel(process.env.OLLAMA_URL||'http://127.0.0.1:11438',process.env.OLLAMA_MODEL||'qwen2.5:0.5b').choose(message.body,answers);
    if(decision.handover){await this.handover(actor,threadId,'I am not confident I can resolve this.');return;}
    const answer=answers.find(answer=>answer.id===decision.answerId);if(!answer)throw Error('Unknown answer.');answerText=answer.text;
   }
   await this.db.transaction(async tx=>{
    const current=(await tx.query('SELECT * FROM chat_threads WHERE id=$1 FOR UPDATE',[threadId])).rows[0];
    const latest=(await tx.query('SELECT id FROM chat_messages WHERE thread_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',[threadId])).rows[0];
    const user=(await tx.query('SELECT active FROM users WHERE id=$1 FOR SHARE',[message.user_id])).rows[0];
    if(current.support_mode==='assistant'&&!current.claimed_by&&latest?.id===messageId&&user?.active)await tx.query("INSERT INTO chat_assistant_messages(id,thread_id,reply_to,body,source,actions) VALUES($1,$2,$3,$4,'assistant',$5::jsonb) ON CONFLICT(reply_to) DO NOTHING",[randomUUID(),threadId,messageId,answerText,JSON.stringify(actions)]);
    await tx.query('UPDATE chat_messages SET assistant_processed_at=now() WHERE id=$1',[messageId]);
   });this.signal(thread);
  }catch{await this.handover(actor,threadId,'The local assistant is unavailable.');}
 }

 async typing(actor:Actor,id:string){this.writable(await this.authorise(actor,id));await this.redis.set('mimiz-fresh:typing:'+id+':'+actor.id,JSON.stringify({id:actor.id,name:actor.name}),'EX',6);await this.redis.sadd('mimiz-fresh:typing-members:'+id,actor.id);await this.redis.expire('mimiz-fresh:typing-members:'+id,60);return {ok:true};}
 async presence(actor:Actor,id:string){await this.authorise(actor,id);const ids=(await this.redis.smembers('mimiz-fresh:typing-members:'+id)).filter(value=>value!==actor.id).slice(0,20);if(!ids.length)return [];return (await this.redis.mget(...ids.map(user=>'mimiz-fresh:typing:'+id+':'+user))).flatMap(value=>value?[JSON.parse(value)]:[]);}
 async upload(actor:Actor,id:string,body:unknown){const thread=await this.authorise(actor,id);this.writable(thread);const {data}=z.object({data:z.string().max(2800000)}).parse(body);const match=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(data);if(!match)fail(400,'Use a still JPEG, PNG or WebP photo under 2 MB.');const bytes=Buffer.from(match[2]!,'base64');if(bytes.length>2000000)fail(400,'Use a photo under 2 MB.');let image:Buffer;try{const decoder=sharp(bytes,{limitInputPixels:20000000,failOn:'error'});const meta=await decoder.metadata();if(!['jpeg','png','webp'].includes(meta.format||'')||meta.pages&&meta.pages>1)fail(400,'Use a still photo.');image=await decoder.rotate().resize({width:1200,height:1200,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer();}catch{fail(400,'This photo could not be decoded.');}const attachment=randomUUID();await photoStorage.put('chat/'+attachment+'.webp',image);try{await this.db.transaction(async tx=>{await this.lockDelivery(tx,thread);if(!(await tx.query('SELECT id FROM users WHERE id=$1 AND active FOR SHARE',[actor.id])).rowCount)fail(403,'This account is unavailable.');await tx.query('INSERT INTO chat_attachments(id,thread_id,user_id) VALUES($1,$2,$3)',[attachment,id,actor.id]);});}catch(error){await photoStorage.remove('chat/'+attachment+'.webp').catch(()=>{});throw error;}return {id:attachment};}
 async image(actor:Actor,threadId:string,id:string){await this.authorise(actor,threadId);if(!(await this.db.query('SELECT id FROM chat_attachments WHERE id=$1 AND thread_id=$2',[id,threadId])).length)fail(404,'Image not found.');try{return Buffer.from(await photoStorage.get('chat/'+id+'.webp'));}catch(error){if(error instanceof PhotoNotFound)fail(404,'Image not found.');throw error;}}
 async maintain(){await this.db.query("DELETE FROM chat_assistant_messages WHERE created_at<now()-interval '12 months'");await this.db.query("UPDATE chat_threads t SET closed_at=now() FROM orders o WHERE o.id=t.order_id AND o.status='completed' AND o.updated_at<now()-interval '24 hours' AND t.closed_at IS NULL");await this.db.query("DELETE FROM chat_messages WHERE created_at<now()-interval '12 months'");const old=await this.db.query("SELECT a.id FROM chat_attachments a WHERE a.created_at<now()-interval '12 months' OR (a.created_at<now()-interval '1 day' AND NOT EXISTS(SELECT 1 FROM chat_messages m WHERE m.thread_id=a.thread_id AND m.attachments @> jsonb_build_array(a.id::text))) LIMIT 100");for(const attachment of old){await photoStorage.remove('chat/'+attachment.id+'.webp');await this.db.query('DELETE FROM chat_attachments WHERE id=$1',[attachment.id]);}}
}
