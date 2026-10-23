"use client";
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {api} from '../lib/api';
import {ChatConversation} from './chat-conversation';
import {Failure} from './platform-frame';
export function DeliveryChat({orderId}:{orderId:string}){
 const [open,setOpen]=useState(false);
 const thread=useQuery<any>({queryKey:['rider-thread',orderId],queryFn:()=>api('/orders/'+orderId+'/rider-thread',{method:'POST'}),enabled:open,retry:false});
 return <section className="delivery-chat"><h3>Delivery conversation</h3><p>Private messages between the customer and the assigned rider.</p><button className="button" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'Hide delivery chat':'Chat about delivery'}</button>{open&&<>{thread.error?<Failure error={thread.error} retry={()=>thread.refetch()}/>:thread.data?<ChatConversation threadId={thread.data.id}/>:<p role="status">Opening delivery chat...</p>}</>}</section>;
}
