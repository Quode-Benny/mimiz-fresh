"use client";
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Button} from '@mimiz/ui';
import {api} from '../../../lib/api';
import {useSession} from '../../providers';
import {Failure} from '../../platform-frame';
export function OrderOperations({order,refresh}:{order:any;refresh:()=>unknown}){
 const session=useSession();const manager=session.data&&['super_admin','branch_manager'].includes(session.data.role);
 const users=useQuery<any[]>({queryKey:['staff-users'],queryFn:()=>api('/staff/users'),enabled:!!manager});
 const [riderId,setRider]=useState(order.rider_id||''),[amount,setAmount]=useState(''),[reason,setReason]=useState(''),[error,setError]=useState<any>(null),[busy,setBusy]=useState(false);
 const staff=session.data&&['super_admin','branch_manager','support_agent'].includes(session.data.role);
 if(!staff)return null;
 async function act(path:string,body:any,method='POST'){setBusy(true);try{await api(path,{method,body:JSON.stringify(body)});await refresh();}catch(error){setError(error);}finally{setBusy(false);}}
 return <section className="panel"><h2>Order operations</h2>{manager&&order.fulfillment==='delivery'&&<><label>Assigned rider<select value={riderId} onChange={e=>setRider(e.target.value)}><option value="">Choose a rider</option>{users.data?.filter(user=>user.role==='rider'&&user.active&&user.branch_id===order.branch_id).map(user=><option value={user.id} key={user.id}>{user.name}</option>)}</select></label><Button disabled={busy||!riderId} onClick={()=>act('/staff/orders/'+order.id+'/rider',{riderId},'PATCH')}>Assign rider</Button></>}<label>Reason<input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason for cancellation or refund"/></label>{!['completed','cancelled','rejected'].includes(order.status)&&<Button disabled={busy||reason.trim().length<3} onClick={()=>act('/orders/'+order.id+'/cancel',{reason})}>Cancel with reason</Button>}{order.payments.some((payment:any)=>payment.status==='succeeded')&&<><label>Refund amount (GHS)<input value={amount} onChange={e=>setAmount(e.target.value)} type="number" min=".01" step=".01"/></label><Button disabled={busy||reason.trim().length<3||Number(amount)<=0} onClick={()=>act('/staff/orders/'+order.id+'/refund',{amount:Math.round(Number(amount)*100),reason})}>Request refund</Button><p className="small-note">Support refunds are limited to GHS 50.00. Simulated payments receive simulated refunds.</p></>}{error&&<Failure error={error}/>}</section>;
}
