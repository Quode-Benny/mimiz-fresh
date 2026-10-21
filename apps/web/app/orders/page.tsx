"use client";
import {useQuery} from '@tanstack/react-query';
import Link from 'next/link';
import {ArrowRight,ShoppingBag} from 'lucide-react';
import {formatMoney} from '@mimiz/domain';
import {api} from '../../lib/api';
import {useSession} from '../providers';
import {PlatformFrame,Failure} from '../platform-frame';
export default function Orders(){
 const session=useSession();const query=useQuery<any[]>({queryKey:['orders'],queryFn:()=>api('/orders'),enabled:!!session.data,refetchInterval:10000});
 return <PlatformFrame title="Your orders" description="Follow your meal from our kitchen to your table.">{session.isPending?<p>Loading your account...</p>:!session.data?<section className="panel"><h2>Your orders, all in one place.</h2><Link className="button primary" href="/login?next=/orders">Sign in to see your orders<ArrowRight size={17}/></Link></section>:query.isPending?<p role="status">Loading your orders...</p>:query.error?<Failure error={query.error} retry={()=>query.refetch()}/>:query.data?.length?<div className="order-list">{query.data.map(order=><article className="order-card" key={order.id}><div><h2>{order.number}</h2><span className={'status-badge '+order.status}>{order.status.replaceAll('_',' ')}</span><p>{order.branch_name} / {order.fulfillment}</p><p>{new Date(order.created_at).toLocaleString('en-GH',{timeZone:'Africa/Accra'})}</p></div><div><b>{formatMoney(order.total)}</b><p>{order.items.reduce((sum:number,item:any)=>sum+item.quantity,0)} items</p><Link className="button" href={'/orders/'+order.id}>View order<ArrowRight size={15}/></Link></div></article>)}</div>:<section className="panel empty"><ShoppingBag/><h2>Your first favourite is waiting.</h2><p>When you place an order, it will appear here.</p><Link className="button primary" href="/">Explore the menu</Link></section>}</PlatformFrame>;
}
