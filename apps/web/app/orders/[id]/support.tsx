"use client";
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {api} from '../../../lib/api';
import {useSession} from '../../providers';
import {Failure} from '../../platform-frame';
import {ChatConversation} from '../../chat-conversation';
export function OrderChat({orderId}:{orderId:string}){
 const session=useSession(),[open,setOpen]=useState(false);
 const allowed=!!session.data&&['customer','super_admin','branch_manager','support_agent'].includes(session.data.role);
 const thread=useQuery<any>({queryKey:['thread',orderId],queryFn:()=>api('/orders/'+orderId+'/thread',{method:'POST'}),enabled:open&&allowed});
 if(!allowed)return null;
 return <section className="panel"><h2>Help with this order</h2>{!open?<><p>Send a private message to this kitchen's support team.</p><button className="button" onClick={()=>setOpen(true)}>Chat with the kitchen</button></>:<>{thread.error&&<Failure error={thread.error}/>} {thread.data?<ChatConversation threadId={thread.data.id}/>:<p role="status">Opening your conversation...</p>}</>}</section>;
}
