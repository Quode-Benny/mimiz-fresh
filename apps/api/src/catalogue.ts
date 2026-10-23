import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { MenuItem, BasketSelection, PricedBasketLine } from '@mimiz/shared';
import { priceSelection, basketTotal } from '@mimiz/domain';
import { Database } from './database/database';
import { fail, hash, token, type Actor } from './security';
import { BRANCH_ID } from './database/seed';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
export const selectionSchema=z.object({itemId:z.string().min(1).max(100),optionIds:z.array(z.string()).max(20),quantity:z.number().int().min(1).max(20),note:z.string().trim().max(300)});
export class CatalogueRepository {
 constructor(readonly db:Database){}
 async branches(includeInactive=false){
  return this.db.query('SELECT id,slug,name,address,phone,timezone,accepting,supports_cash,supports_delivery,supports_pickup,prep_minutes,extra_prep_minutes,active,hours,closures,ST_Y(location::geometry) AS latitude,ST_X(location::geometry) AS longitude FROM branches WHERE ($1::boolean OR active) ORDER BY name',[includeInactive]);
 }
 async resolve(body:unknown){
  const input=z.object({latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180)}).parse(body);
  return this.db.query(`SELECT b.id,round(ST_Distance(b.location,ST_SetSRID(ST_MakePoint($1,$2),4326)::geography))::int AS distance_m,EXISTS(SELECT 1 FROM delivery_zones z WHERE z.branch_id=b.id AND z.active AND ((z.center IS NOT NULL AND ST_DWithin(z.center,ST_SetSRID(ST_MakePoint($1,$2),4326)::geography,z.radius_m)) OR (z.polygon IS NOT NULL AND ST_Covers(z.polygon::geometry,ST_SetSRID(ST_MakePoint($1,$2),4326))))) AS delivers FROM branches b WHERE b.active ORDER BY distance_m`,[input.longitude,input.latitude]);
 }
 async menu(branchId:string,tx?:PoolClient,includeArchived=false,at=new Date()):Promise<MenuItem[]>{
  const query=`SELECT c.data,c.archived,cat.active AS category_active,parent.active AS parent_active,bm.available,bm.price,bm.stock FROM catalogue c JOIN branches b ON b.company_id=c.company_id LEFT JOIN categories cat ON cat.company_id=c.company_id AND cat.name=c.data->>'category' LEFT JOIN categories parent ON parent.id=cat.parent_id LEFT JOIN branch_menu bm ON bm.branch_id=b.id AND bm.item_id=c.id WHERE b.id=$1 ${includeArchived?'':'AND c.archived=false'} ORDER BY c.data->>'name'`;
  const rows=tx?(await tx.query(query,[branchId])).rows:await this.db.query(query,[branchId]);
  return rows.map(row=>{const now=at,day=now.getUTCDay(),previous=(day+6)%7,time=now.toISOString().slice(11,16);const windows=row.data.availabilityWindows;const within=!windows?.length||windows.some((window:any)=>(window.days.includes(day)&&(window.open===window.close?false:window.open<window.close?time>=window.open&&time<window.close:time>=window.open))||(window.open>window.close&&window.days.includes(previous)&&time<window.close));return {...row.data,archived:row.archived,stock:row.stock,companyPricePesewas:row.data.pricePesewas,branchPricePesewas:row.price,pricePesewas:row.price??row.data.pricePesewas,available:!row.archived&&(row.category_active??true)&&(row.parent_active??true)&&within&&(row.available??row.data.available)&&(row.stock===null||row.stock===undefined||row.stock>0),unavailableReason:row.category_active===false||row.parent_active===false?'This category is currently unavailable.':!within?"Outside this dish's serving hours. Check back during its availability window.":row.stock===0?'Sold out. Please check back later.':row.data.unavailableReason};}).sort((a,b)=>(a.sortOrder??100)-(b.sortOrder??100)||a.name.localeCompare(b.name));
 }
 async price(branchId:string,selections:BasketSelection[],tx?:PoolClient,allowUnavailable=false,at=new Date()){
  const menu=await this.menu(branchId,tx,false,at);const keys=new Set<string>();const lines:PricedBasketLine[]=[];
  for(const selection of selections){let item=menu.find(item=>item.id===selection.itemId);if(!item&&allowUnavailable)item={id:selection.itemId,name:'Dish no longer on the menu',description:'Remove this dish to continue.',category:'Unavailable',pricePesewas:0,image:'/images/unavailable.svg',dayparts:[],available:false,unavailableReason:'Remove this dish to continue.',optionGroups:selection.optionIds.length?[{id:'old-options',name:'Previous choices',minimum:0,maximum:20,options:selection.optionIds.map(id=>({id,name:'Previous option',priceDeltaPesewas:0}))}]:[]};if(!item)fail(409,'A dish is no longer on this menu. Refresh your bag.');let line:PricedBasketLine;try{line=priceSelection(allowUnavailable?{...item,available:true}:item,selection);}catch(error){if(!allowUnavailable)fail(409,error instanceof Error?error.message:'Check your meal choices.');item={...item,available:false,unavailableReason:'Choices for this dish changed. Remove it and add it again.',optionGroups:selection.optionIds.length?[{id:'previous',name:'Previous choices',minimum:0,maximum:20,options:selection.optionIds.map(id=>({id,name:'Previous option',priceDeltaPesewas:0}))}]:[]};line=priceSelection({...item,available:true},selection);}line.item=item;if(keys.has(line.key))fail(400,'Combine duplicate meals in your bag.');keys.add(line.key);lines.push(line);}
  return {lines,subtotal:basketTotal(lines.map(line=>({pricePesewas:line.unitPricePesewas,quantity:line.quantity}))),count:lines.reduce((sum,line)=>sum+line.quantity,0)};
 }
}
export class CartService {
 constructor(private catalogue:CatalogueRepository){}
 async get(request:FastifyRequest,reply:FastifyReply,actor:Actor|null){
  let identity=request.cookies.mimiz_cart;
  if(!identity||!/^[A-Za-z0-9_-]{43}$/.test(identity)){identity=token();reply.setCookie('mimiz_cart',identity,{httpOnly:true,path:'/',sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:15552000});}
  let ownerHash=hash(identity);
  const rows=await this.catalogue.db.query('SELECT * FROM carts WHERE ($1::uuid IS NOT NULL AND user_id=$1) OR (owner_hash=$2 AND user_id IS NULL) ORDER BY user_id NULLS LAST LIMIT 1',[actor?.id??null,ownerHash]);
  let cart=rows[0];
  if(!cart){identity=token();ownerHash=hash(identity);reply.setCookie('mimiz_cart',identity,{httpOnly:true,path:'/',sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:15552000});}
  if(!cart)cart=(await this.catalogue.db.query('INSERT INTO carts(id,owner_hash,user_id,branch_id,fulfillment) VALUES($1,$2,$3,$4,\'delivery\') ON CONFLICT(owner_hash) DO UPDATE SET updated_at=now() RETURNING *',[randomUUID(),ownerHash,actor?.id??null,BRANCH_ID]))[0];
  else if(actor&&!cart.user_id)cart=(await this.catalogue.db.query('UPDATE carts SET user_id=$1 WHERE id=$2 RETURNING *',[actor.id,cart.id]))[0];
  return cart;
 }
 async view(cart:any){const {owner_hash,...visible}=cart;return {...visible,...await this.catalogue.price(cart.branch_id,cart.selections,undefined,true)};}
 async update(cart:any,body:unknown){
  const input=z.object({version:z.number().int().min(1),selections:z.array(selectionSchema).max(100),fulfillment:z.enum(['delivery','pickup']),branchId:z.string().uuid(),promoCode:z.string().trim().max(40).nullable().optional()}).parse(body);
  const branch=(await this.catalogue.db.query('SELECT id FROM branches WHERE id=$1',[input.branchId]))[0];if(!branch)fail(404,'Kitchen not found.');
  await this.catalogue.price(input.branchId,input.selections,undefined,true);
  const updated=(await this.catalogue.db.query('UPDATE carts SET selections=$1::jsonb,fulfillment=$2,branch_id=$3,promo_code=$4,version=version+1,updated_at=now() WHERE id=$5 AND version=$6 RETURNING *',[JSON.stringify(input.selections),input.fulfillment,input.branchId,input.promoCode??null,cart.id,input.version]))[0];
  if(!updated)fail(409,'Your bag changed in another tab. Refresh it before trying again.','CART_CONFLICT');
  return this.view(updated);
 }
}
