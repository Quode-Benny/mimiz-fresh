"use client";
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {api} from '../../../lib/api';
import {useSession} from '../../providers';
import {Failure} from '../../platform-frame';
import {Button} from '@mimiz/ui';
export function OrderChat({orderId}:{orderId:string}){
 const session=useSession();const [open,setOpen]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState<any>(null),[busy,setBusy]=useState(false);
 const thread=useQuery<any>({queryKey:['thread',orderId],queryFn:()=>api('/orders/'+orderId+'/thread',{method:'POST'}),enabled:open});
 const messages=useQuery<any[]>({queryKey:['messages',thread.data?.id],queryFn:()=>api('/threads/'+thread.data.id+'/messages'),enabled:!!thread.data,refetchInterval:4000});
 return <section className="panel"><h2>Help with this order</h2>{!open?<><p>Send a message to this kitchen's support inbox.</p><Button onClick={()=>setOpen(true)}>Chat with the kitchen</Button></>:<>{thread.error&&<Failure error={thread.error}/>}<div className="chat-messages">{messages.data?.length?messages.data.map(message=><div className={'chat-message '+(message.sender_id===session.data?.id?'mine':'')} key={message.id}><small>{message.name}</small><p>{message.body}</p><small>{new Date(message.created_at).toLocaleTimeString('en-GH',{hour:'numeric',minute:'2-digit'})}</small></div>):<p className="small-note">Start the conversation. Replies appear here.</p>}</div><form className="chat-form" onSubmit={async event=>{event.preventDefault();setBusy(true);try{await api('/threads/'+thread.data.id+'/messages',{method:'POST',body:JSON.stringify({body:message})});setMessage('');await messages.refetch();}catch(error){setError(error);}finally{setBusy(false);}}}><input aria-label="Message the kitchen" value={message} onChange={e=>setMessage(e.target.value)} required maxLength={2000} placeholder="How can we help?"/><Button disabled={busy||!thread.data||!message.trim()}>Send</Button></form>{error&&<Failure error={error}/>}</>}</section>;
}
