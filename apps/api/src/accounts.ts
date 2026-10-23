import {photoStorage} from './storage';
import {resolve} from 'node:path';
import {projectRoot} from './config';
import {z} from 'zod';
import {Database} from './database/database';
import {fail,type Actor} from './security';
export class AccountsService {
 constructor(private db:Database){}
 async profile(actor:Actor){return (await this.db.query('SELECT name,phone,notification_preferences FROM users WHERE id=$1',[actor.id]))[0];}
 async update(actor:Actor,body:unknown){const input=z.object({name:z.string().trim().min(2).max(100),preferences:z.object({push:z.boolean(),criticalSms:z.boolean(),promotions:z.boolean()})}).parse(body);await this.db.query('UPDATE users SET name=$1,notification_preferences=$2::jsonb WHERE id=$3',[input.name,JSON.stringify(input.preferences),actor.id]);return this.profile(actor);}
 async remove(actor:Actor,body:unknown){
  z.object({confirmation:z.literal('DELETE')}).parse(body);
  const images:string[]=[];
  await this.db.transaction(async tx=>{
   await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',[actor.id]);
   await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[actor.id]);
   if((await tx.query("SELECT id FROM orders WHERE user_id=$1 AND status NOT IN ('completed','cancelled','rejected') LIMIT 1",[actor.id])).rowCount)fail(409,'Wait until your active orders are finished before deleting your account.');
   await tx.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1',[actor.id]);
   for(const table of ['addresses','carts','notifications','push_subscriptions'])await tx.query('DELETE FROM '+table+' WHERE user_id=$1',[actor.id]);
   for(const image of (await tx.query('SELECT id FROM chat_attachments WHERE user_id=$1 FOR UPDATE',[actor.id])).rows)images.push(image.id);
   for(const id of images)await tx.query('INSERT INTO photo_deletions(key) VALUES($1) ON CONFLICT DO NOTHING',['chat/'+id+'.webp']);
   await tx.query('DELETE FROM chat_attachments WHERE user_id=$1',[actor.id]);
   await tx.query("UPDATE chat_messages SET body='[Message removed]',attachments='[]' WHERE sender_id=$1",[actor.id]);
   await tx.query("UPDATE orders SET address=NULL,note='',items=(SELECT coalesce(jsonb_agg(item || jsonb_build_object('note','')),'[]'::jsonb) FROM jsonb_array_elements(items) item) WHERE user_id=$1",[actor.id]);
   await tx.query("UPDATE ratings SET comment='' WHERE order_id IN (SELECT id FROM orders WHERE user_id=$1)",[actor.id]);
   await tx.query('DELETE FROM dev_outbox WHERE recipient=$1',[actor.phone]);
   await tx.query('DELETE FROM otp_challenges WHERE phone=$1',[actor.phone]);
   await tx.query('UPDATE recommendation_events SET user_id=NULL WHERE user_id=$1',[actor.id]);
   await tx.query("UPDATE users SET name='Deleted customer',phone=NULL,email=NULL,active=false,notification_preferences='{}',internal_notes='' WHERE id=$1",[actor.id]);
  });for(const id of images){const key='chat/'+id+'.webp';try{await photoStorage.remove(key);await this.db.query('DELETE FROM photo_deletions WHERE key=$1',[key]);}catch{}}return {ok:true};
 }
 async readNotice(actor:Actor,id:string){await this.db.query('UPDATE notifications SET read_at=coalesce(read_at,now()) WHERE id=$1 AND user_id=$2',[id,actor.id]);return {ok:true};}
}
