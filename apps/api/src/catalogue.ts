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
 async branches(){
  return this.db.query('SELECT id,slug,name,address,phone,timezone,accepting,supports_cash,supports_delivery,supports_pickup,prep_minutes,hours,closures,ST_Y(location::geometry) AS latitude,ST_X(location::geometry) AS longitude FROM branches ORDER BY name');
 }
 async menu(branchId:string,tx?:PoolClient):Promise<MenuItem[]>{
  const query=`SELECT c.data, bm.available,bm.price,bm.stock FROM catalogue c JOIN branches b ON b.company_id=c.company_id LEFT JOIN branch_menu bm ON bm.branch_id=b.id AND bm.item_id=c.id WHERE b.id=$1 AND c.archived=false ORDER BY c.data->>'name'`;
  const rows=tx?(await tx.query(query,[branchId])).rows:await this.db.query(query,[branchId]);
  return rows.map(row=>({...row.data,pricePesewas:row.price??row.data.pricePesewas,available:(row.available??row.data.available)&&(row.stock===null||row.stock===undefined||row.stock>0),unavailableReason:row.stock===0?'Sold out. Please check back later.':row.data.unavailableReason}));
 }
 async price(branchId:string,selections:BasketSelection[],tx?:PoolClient,allowUnavailable=false){
  const menu=await this.menu(branchId,tx);const keys=new Set<string>();const lines:PricedBasketLine[]=[];
  for(const selection of selections){let item=menu.find(item=>item.id===selection.itemId);if(!item&&allowUnavailable)item={id:selection.itemId,name:'Dish no longer on the menu',description:'Remove this dish to continue.',category:'Unavailable',pricePesewas:0,image:'/images/unavailable.svg',dayparts:[],available:false,unavailableReason:'Remove this dish to continue.',optionGroups:selection.optionIds.length?[{id:'old-options',name:'Previous choices',minimum:0,maximum:20,options:selection.optionIds.map(id=>({id,name:'Previous option',priceDeltaPesewas:0}))}]:[]};if(!item)fail(409,'A dish is no longer on this menu. Refresh your bag.');let line:PricedBasketLine;try{line=priceSelection(allowUnavailable?{...item,available:true}:item,selection);}catch(error){fail(409,error instanceof Error?error.message:'Check your meal choices.');}line.item=item;if(keys.has(line.key))fail(400,'Combine duplicate meals in your bag.');keys.add(line.key);lines.push(line);}
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
