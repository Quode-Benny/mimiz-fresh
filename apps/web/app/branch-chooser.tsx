"use client";
import {useState} from 'react';
import dynamic from 'next/dynamic';
import * as Dialog from '@radix-ui/react-dialog';
import {useQuery} from '@tanstack/react-query';
import {MapPin,LocateFixed,X,ArrowRight,Clock3} from 'lucide-react';
import {priceSelection,formatMoney,isOpenAt} from '@mimiz/domain';
import type {MenuItem,BasketSelection} from '@mimiz/shared';
import {api,type Branch} from '../lib/api';
import type {ServerCart} from './use-basket';
import {AddressSearch} from './address-search';
import {Failure} from './platform-frame';
const PinPicker=dynamic(()=>import('./checkout/pin-picker'),{ssr:false,loading:()=> <div className="map-loading">Loading map...</div>});

function openNow(branch:Branch){return branch.accepting&&isOpenAt(branch,new Date());}
export function BranchChooser({open,onOpenChange,branches,cart,update,restoreFocus}:{open:boolean;onOpenChange:(open:boolean)=>void;branches:Branch[];cart?:ServerCart;update:(selections:BasketSelection[],extra:Partial<ServerCart>)=>Promise<unknown>;restoreFocus:()=>void}){
 const [mode,setMode]=useState<'delivery'|'pickup'>(cart?.fulfillment||'delivery'),[point,setPoint]=useState<[number,number]|null>(null),[error,setError]=useState<any>(null),[busy,setBusy]=useState(false);
 const [proposal,setProposal]=useState<{branch:Branch;selections:BasketSelection[];removed:string[];subtotal:number}|null>(null);
 const resolved=useQuery<{id:string;distance_m:number;delivers:boolean}[]>({queryKey:['branch-resolution',point],queryFn:()=>api('/branches/resolve',{method:'POST',body:JSON.stringify({latitude:point![0],longitude:point![1]})}),enabled:open&&!!point});
 const ordered=resolved.data?resolved.data.flatMap(result=>{const branch=branches.find(b=>b.id===result.id);return branch?[{branch,...result}]:[];}):branches.map(branch=>({branch,id:branch.id,distance_m:null,delivers:null}));
 async function choose(branch:Branch){setBusy(true);setError(null);try{if(!cart)throw new Error('Your bag is loading. Try again in a moment.');const {items}=await api<{items:MenuItem[]}>('/branches/'+branch.id+'/menu');const removed:string[]=[],selections:BasketSelection[]=[];let subtotal=0;for(const selection of cart.selections){const item=items.find(item=>item.id===selection.itemId);try{if(!item)throw new Error();const line=priceSelection(item,selection);selections.push(selection);subtotal+=line.unitPricePesewas*line.quantity;}catch{removed.push(cart.lines.find(line=>line.itemId===selection.itemId)?.item.name||'Unavailable meal');}}
 if(cart.selections.length&&branch.id!==cart.branch_id)setProposal({branch,selections,removed,subtotal});else{await update(selections,{branch_id:branch.id,fulfillment:mode,promo_code:null});onOpenChange(false);}
 }catch(error){setError(error);}finally{setBusy(false);}}
 return <Dialog.Root open={open} onOpenChange={value=>{onOpenChange(value);setProposal(null);setError(null);}}><Dialog.Portal><Dialog.Overlay className="overlay"/><Dialog.Content className="kitchen-dialog branch-chooser" onCloseAutoFocus={event=>{event.preventDefault();restoreFocus();}}>
 <div className="sheet-head"><div><p className="eyebrow">YOUR MIMIZ KITCHEN</p><Dialog.Title>A little closer to home.</Dialog.Title></div><Dialog.Close className="icon-button" aria-label="Close kitchen details"><X size={22}/></Dialog.Close></div><Dialog.Description>Choose a kitchen for delivery or pickup. Coverage is checked using your pin.</Dialog.Description>
 <div className="fulfilment">{(['delivery','pickup'] as const).map(value=><button key={value} aria-pressed={mode===value} className={mode===value?'selected':''} onClick={()=>{setMode(value);setProposal(null);}}>{value==='delivery'?'Delivery':'Pickup'}</button>)}</div>
 {error&&<Failure error={error}/>}
 {proposal?<section className="panel branch-confirmation"><h3>Switch to {proposal.branch.name}?</h3><p>Your meals will be checked against this kitchen's current prices. Your promotion will be cleared.</p>{proposal.removed.length>0&&<><b>These meals cannot move to this kitchen:</b><ul>{proposal.removed.map((name,index)=><li key={index}>{name}</li>)}</ul></>}<p>New subtotal: <b>{formatMoney(proposal.subtotal)}</b></p><div className="order-actions"><button className="button primary" disabled={busy} onClick={async()=>{setBusy(true);try{await update(proposal.selections,{branch_id:proposal.branch.id,fulfillment:mode,promo_code:null});setProposal(null);onOpenChange(false);}catch(error){setError(error);}finally{setBusy(false);}}}>Confirm kitchen switch</button><button className="button" onClick={()=>setProposal(null)}>Keep my current kitchen</button></div></section>:<>
 <div className="branch-location panel"><AddressSearch onSelect={place=>setPoint([place.latitude,place.longitude])}/>
 <button className="button location-button" onClick={()=>{if(!navigator.geolocation){setError(new Error('Location is unavailable. Drop a pin on the map.'));return;}navigator.geolocation.getCurrentPosition(position=>{setPoint([position.coords.latitude,position.coords.longitude]);setError(null);},()=>setError(new Error('Location access was unavailable. Drop a pin on the map.')));}}><LocateFixed size={16}/>Use my location</button>
 <PinPicker value={point} onChange={setPoint}/><p className="small-note">{point?'Pin: '+point.map(value=>value.toFixed(5)).join(', '):'Tap the map to check nearby kitchens.'}</p></div>
 {resolved.error&&<Failure error={resolved.error}/>}
 {point&&mode==='delivery'&&resolved.data&&!resolved.data.some(result=>result.delivers)&&<p className="demo-note">We do not deliver to this pin yet. You can still choose a nearby kitchen for pickup.</p>}
 <div className="branch-options">{ordered.map(({branch,distance_m,delivers},index)=><section className="branch-option" key={branch.id}><div><span className="eyebrow">{index===0&&point?'NEAREST KITCHEN':'MIMIZ FRESH'}</span><h3>{branch.name}</h3><p>{branch.address}</p><small><Clock3 size={13}/>{openNow(branch)?'Open now':'Closed or paused'} / {branch.prep_minutes+(branch.extra_prep_minutes||0)} min prep{distance_m!==null?' / '+(distance_m/1000).toFixed(1)+' km away':''}</small>{mode==='delivery'&&delivers===false&&<small>Outside this kitchen's delivery area</small>}</div><button className="button" disabled={busy||(mode==='delivery'&&delivers===false)||(mode==='delivery'&&!branch.supports_delivery)||(mode==='pickup'&&!branch.supports_pickup)} onClick={()=>choose(branch)}>Choose<ArrowRight size={15}/></button></section>)}</div>
 <p className="small-note">Distances are straight-line estimates. Closed kitchens may accept a scheduled order at checkout. Demo branch details are illustrative.</p>
 </>}
 </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
