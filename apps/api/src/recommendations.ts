import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import type Redis from 'ioredis';
import {Database} from './database/database';
import {CatalogueRepository} from './catalogue';
import {fail,hash,type Actor} from './security';
export class RecommendationsService{
 constructor(private db:Database,private catalogue:CatalogueRepository,private redis:Redis){}
 async get(branchId:string,daypart:string,actor:Actor|null){
  const company=(await this.db.query('SELECT c.settings,b.active FROM branches b JOIN companies c ON c.id=b.company_id WHERE b.id=$1',[branchId]))[0];
  if(!company?.active||company.settings.flags.recommendations===false)return {groups:[],popularity:{}};
  const definition=company.settings.dayparts.find((part:any)=>part.id===daypart)||company.settings.dayparts[0];
  const menu=(await this.catalogue.menu(branchId)).filter(item=>item.available);
  if(!menu.length)return {groups:[],popularity:{}};
  const cacheKey='mimiz-fresh:recommendations:v3:'+branchId+':'+daypart+':'+hash(JSON.stringify(company.settings.dayparts)).slice(0,10);
  let popular:any[]=[],pairs:any[]=[],daypartPopular:any[]=[];const saved=await this.redis.get(cacheKey);
  if(saved){({popular,pairs,daypartPopular}=JSON.parse(saved));}else{
   popular=await this.db.query("SELECT item->>'itemId' AS id,sum((item->>'quantity')::int)::int AS count FROM orders o CROSS JOIN LATERAL jsonb_array_elements(o.items) item WHERE branch_id=$1 AND created_at>now()-interval '14 days' AND status NOT IN ('pending_payment','cancelled','rejected') GROUP BY 1 ORDER BY count DESC LIMIT 40",[branchId]);
   daypartPopular=await this.db.query("SELECT item->>'itemId' AS id,sum((item->>'quantity')::int)::int AS count FROM orders o CROSS JOIN LATERAL jsonb_array_elements(o.items) item WHERE branch_id=$1 AND created_at>now()-interval '14 days' AND status NOT IN ('pending_payment','cancelled','rejected') AND (($2::text<$3::text AND to_char(created_at AT TIME ZONE 'Africa/Accra','HH24:MI')>=$2 AND to_char(created_at AT TIME ZONE 'Africa/Accra','HH24:MI')<$3) OR ($2::text>$3::text AND (to_char(created_at AT TIME ZONE 'Africa/Accra','HH24:MI')>=$2 OR to_char(created_at AT TIME ZONE 'Africa/Accra','HH24:MI')<$3))) GROUP BY 1 ORDER BY count DESC LIMIT 40",[branchId,definition.start,definition.end]);
   pairs=await this.db.query("SELECT a->>'itemId' AS item,b->>'itemId' AS paired,count(*)::int AS count FROM orders o CROSS JOIN LATERAL jsonb_array_elements(o.items) a CROSS JOIN LATERAL jsonb_array_elements(o.items) b WHERE branch_id=$1 AND created_at>now()-interval '14 days' AND status NOT IN ('pending_payment','cancelled','rejected') AND a->>'itemId'<>b->>'itemId' GROUP BY 1,2 ORDER BY count DESC LIMIT 100",[branchId]);
   await this.redis.set(cacheKey,JSON.stringify({popular,pairs,daypartPopular}),'EX',300);
  }
  const again=actor?.role==='customer'?await this.db.query("SELECT item->>'itemId' AS id,count(*)::int AS count,max(created_at) AS recent FROM orders o CROSS JOIN LATERAL jsonb_array_elements(o.items) item WHERE user_id=$1 AND status NOT IN ('pending_payment','cancelled','rejected') GROUP BY 1 ORDER BY count DESC,recent DESC LIMIT 12",[actor.id]):[];
  const group=(source:string,title:string,reason:string,ids:string[])=>({source,title,reason,items:[...new Set(ids)].flatMap(id=>{const item=menu.find(item=>item.id===id);return item?[item]:[];}).slice(0,8)});
  const now=menu.filter(item=>item.dayparts.includes(daypart as any)).sort((a,b)=>(daypartPopular.find(row=>row.id===b.id)?.count||0)-(daypartPopular.find(row=>row.id===a.id)?.count||0));
  const cart=actor?.role==='customer'?(await this.db.query('SELECT selections FROM carts WHERE user_id=$1',[actor.id]))[0]:null;
  const basketIds=new Set<string>(cart?.selections?.map((item:any)=>item.itemId)||[]);
  const paired=pairs.filter(pair=>basketIds.has(pair.item)&&!basketIds.has(pair.paired)).map(pair=>pair.paired);
  return {popularity:Object.fromEntries(popular.map(row=>[row.id,row.count])),groups:[
   group('daypart','A little something for right now','Chosen for this time of day, with branch favourites first.',now.map(item=>item.id)),
   group('popular','Loved around this kitchen','Most ordered here over the last 14 days.',popular.map(row=>row.id)),
   group('order_again','Your familiar favourites','Based on your recent and most frequent orders.',again.map(row=>row.id)),
   group('together','A good pairing','Often ordered together with meals in your bag.',paired),
   group('featured','Fresh picks from the kitchen','New and featured dishes, chosen by the kitchen.',menu.filter(item=>item.featured).map(item=>item.id))
  ].filter(group=>group.items.length)};
 }
 async log(actor:Actor|null,body:unknown){const input=z.object({branchId:z.string().uuid(),events:z.array(z.object({itemId:z.string().min(1).max(100),kind:z.enum(['impression','click','add']),source:z.enum(['daypart','popular','order_again','together','featured','catalogue'])})).min(1).max(40)}).parse(body);const menu=await this.catalogue.menu(input.branchId);if(input.events.some(event=>!menu.some(item=>item.id===event.itemId)))fail(400,'Unknown recommendation item.');await this.db.transaction(async tx=>{for(const event of input.events)await tx.query('INSERT INTO recommendation_events(id,user_id,branch_id,item_id,kind,source) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),actor?.role==='customer'?actor.id:null,input.branchId,event.itemId,event.kind,event.source]);});return {ok:true};}
}
