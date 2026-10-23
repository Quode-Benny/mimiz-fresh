"use client";
import {useRef,useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import Link from 'next/link';
import type {MenuItem} from '@mimiz/shared';
import {api} from '../lib/api';
import {useBasket} from './use-basket';
import {MealSheet} from './meal-sheet';
export function AssistantMealAction({action}:{action:{itemId:string;branchId:string;quantity:number;name?:string}}){
 const basket=useBasket(),button=useRef<HTMLButtonElement>(null);
 const [item,setItem]=useState<MenuItem|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[added,setAdded]=useState(false);
 return <div className="assistant-meal-action"><button ref={button} type="button" className="button" disabled={loading||!basket.ready||basket.busy} onClick={async()=>{
  setLoading(true);setError('');try{
   if(basket.data?.branch_id!==action.branchId)throw Error('This suggestion is for a different kitchen. Return to the menu and select that kitchen before adding it.');
   const menu=await api<{items:MenuItem[]}>('/branches/'+action.branchId+'/menu'),found=menu.items.find(m=>m.id===action.itemId);
   if(!found?.available)throw Error('This dish is no longer available. Please choose another meal.');
   setItem(found);
  }catch(e){setError(e instanceof Error?e.message:'Could not load this dish.');}finally{setLoading(false);}
 }}>{loading?'Checking meal...':'Review '+action.quantity+' x '+(action.name||action.itemId)}</button>
 {added&&<Link className="text-button" href="/checkout">Review bag and checkout</Link>}{error&&<p role="alert">{error}</p>}
 <Dialog.Root open={!!item} onOpenChange={open=>{if(!open)setItem(null);}}><Dialog.Portal><Dialog.Overlay className="overlay"/>{item&&<MealSheet key={item.id} item={item} initialQuantity={action.quantity} close={()=>setItem(null)} restoreFocus={()=>button.current?.focus()} add={async selection=>{await basket.add(selection);setAdded(true);}}/>}</Dialog.Portal></Dialog.Root></div>;
}
