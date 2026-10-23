"use client";
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {api,type Branch} from '../lib/api';
import {ChatConversation} from './chat-conversation';
import {Failure} from './platform-frame';
export function GeneralSupport(){
 const branches=useQuery<Branch[]>({queryKey:['branches'],queryFn:()=>api('/branches')});
 const [branch,setBranch]=useState(''),[thread,setThread]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<any>(null);
 return <section className="panel"><h2>A little help?</h2><p>Ask about the menu, delivery or an order. When local AI is enabled, it can help with common questions; the kitchen team can take over.</p>{thread?<ChatConversation threadId={thread}/>:<><label>Kitchen<select value={branch||branches.data?.[0]?.id||''} onChange={event=>setBranch(event.target.value)}>{branches.data?.map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><button className="button" style={{marginTop:18}} disabled={busy||!branches.data?.length} onClick={async()=>{setBusy(true);try{const result=await api('/support/threads',{method:'POST',body:JSON.stringify({branchId:branch||branches.data?.[0]?.id})});setThread(result.id);}catch(error){setError(error);}finally{setBusy(false);}}}>Start a conversation</button></>}{error&&<Failure error={error}/>}</section>;
}
