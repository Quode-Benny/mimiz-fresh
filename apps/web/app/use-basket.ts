"use client";
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useEffect,useRef,useState} from 'react';
import type {BasketSelection,PricedBasketLine,MenuItem} from '@mimiz/shared';
import {restoreBasket,priceSelection} from '@mimiz/domain';
import {api} from '../lib/api';
export type ServerCart={id:string;branch_id:string;user_id:string|null;fulfillment:'delivery'|'pickup';selections:BasketSelection[];version:number;lines:PricedBasketLine[];subtotal:number;count:number;promo_code:string|null};
export function useBasket(){
 const client=useQueryClient();const query=useQuery<ServerCart>({queryKey:['cart'],queryFn:()=>api('/cart'),retry:1});
 const [notice,setNotice]=useState(''),[busy,setBusy]=useState(false);const migrating=useRef(false);
 async function update(selections:BasketSelection[],extra:Partial<ServerCart>={}){
  const cart=client.getQueryData<ServerCart>(['cart']);if(!cart)throw new Error('Your bag is loading. Try again in a moment.');
  setBusy(true);try{const next=await api<ServerCart>('/cart',{method:'PUT',body:JSON.stringify({version:cart.version,branchId:extra.branch_id||cart.branch_id,fulfillment:extra.fulfillment||cart.fulfillment,promoCode:extra.promo_code===undefined?cart.promo_code:extra.promo_code,selections})});client.setQueryData(['cart'],next);return next;}catch(error){await client.invalidateQueries({queryKey:['cart']});throw error;}finally{setBusy(false);}
 }
 useEffect(()=>{
  if(!query.data||migrating.current)return;migrating.current=true;
  (async()=>{try{const saved=localStorage.getItem('mimiz-fresh-basket-v2');if(saved&&query.data!.selections.length===0){const menu=await api<{items:MenuItem[]}>('/branches/'+query.data!.branch_id+'/menu');const selections=restoreBasket(JSON.parse(saved),menu.items);if(selections.length)await update(selections);}localStorage.removeItem('mimiz-fresh-basket-v2');}catch{setNotice('Your saved preview bag could not be imported. Your server bag is still available.');}})();
 },[query.data?.id]);
 async function add(selection:BasketSelection){
  const cart=client.getQueryData<ServerCart>(['cart']);if(!cart)throw new Error('Your bag is loading. Try again.');
  const menu=await api<{items:MenuItem[]}>('/branches/'+cart.branch_id+'/menu');const item=menu.items.find(item=>item.id===selection.itemId);if(!item)throw new Error('This dish is no longer available.');const line=priceSelection(item,selection);
  const index=cart.lines.findIndex(current=>current.key===line.key);if(index>=0&&cart.lines[index]!.quantity+selection.quantity>20)throw new Error('You can add up to 20 of this meal.');
  return update(index<0?[...cart.selections,selection]:cart.selections.map((entry,i)=>i===index?{...entry,quantity:entry.quantity+selection.quantity}:entry));
 }
 async function change(key:string,delta:number){const cart=client.getQueryData<ServerCart>(['cart']);if(!cart)return;try{await update(cart.selections.flatMap((entry,index)=>{if(cart.lines[index]?.key!==key)return [entry];const quantity=Math.min(20,entry.quantity+delta);return quantity>0?[{...entry,quantity}]:[];}));}catch(error:any){setNotice(error.message);}}
 async function remove(key:string){const cart=client.getQueryData<ServerCart>(['cart']);if(!cart)return;try{await update(cart.selections.filter((_,index)=>cart.lines[index]?.key!==key));}catch(error:any){setNotice(error.message);}}
 async function fulfillment(value:'delivery'|'pickup'){const cart=client.getQueryData<ServerCart>(['cart']);if(!cart)return;await update(cart.selections,{fulfillment:value});}
 return {data:query.data,lines:query.data?.lines||[],count:query.data?.count||0,total:query.data?.subtotal||0,add,change,remove,fulfillment,update,busy,ready:query.isSuccess,error:query.error,refresh:query.refetch,notice,dismissNotice:()=>setNotice('')};
}
