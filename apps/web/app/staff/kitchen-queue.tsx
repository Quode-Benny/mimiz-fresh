"use client";
import {useEffect,useState,type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import {api,type Branch} from '../../lib/api';
import {Failure} from '../platform-frame';
type Stage='new'|'preparing'|'ready';
type Queue={items:any[];counts:Record<Stage,number>;total:number;page:number;pageSize:number};
export function KitchenQueue({branches,owner,renderTicket}:{branches:Branch[];owner:boolean;renderTicket:(order:any)=>ReactNode}){
 const [stage,setStage]=useState<Stage>('new'),[search,setSearch]=useState(''),[fulfillment,setFulfillment]=useState('all'),[sort,setSort]=useState('oldest'),[branch,setBranch]=useState('all'),[page,setPage]=useState(1);
 const parameters=new URLSearchParams({stage,search,fulfillment,sort,page:String(page)});if(owner&&branch!=='all')parameters.set('branchId',branch);
 const query=useQuery<Queue>({queryKey:['kitchen-queue',stage,search,fulfillment,sort,branch,page],queryFn:()=>api('/staff/queue?'+parameters),refetchInterval:5000});
 useEffect(()=>{if(query.data&&query.data.page!==page)setPage(query.data.page);},[query.data?.page,page]);
 const data=query.data,pages=Math.max(1,Math.ceil((data?.total||0)/(data?.pageSize||12)));
 return <div className="dark-kitchen compact-kitchen"><nav className="kitchen-stage-tabs" aria-label="Kitchen stages">{(['new','preparing','ready'] as Stage[]).map(value=><button type="button" key={value} aria-pressed={stage===value} className={stage===value?'selected':''} onClick={()=>{setStage(value);setPage(1);}}><span>{value==='new'?'New':value==='preparing'?'Preparing':'Ready'}</span><b>{data?.counts[value]??'...'}</b></button>)}</nav>
 <div className="queue-filters"><label>Search kitchen queue<input type="search" value={search} maxLength={100} placeholder="Order number or customer" onChange={e=>{setSearch(e.target.value);setPage(1);}}/></label><label>Fulfillment<select value={fulfillment} onChange={e=>{setFulfillment(e.target.value);setPage(1);}}><option value="all">All orders</option><option value="pickup">Pickup</option><option value="delivery">Delivery</option></select></label><label>Queue order<select value={sort} onChange={e=>{setSort(e.target.value);setPage(1);}}><option value="oldest">Oldest first</option><option value="newest">Newest first</option></select></label>{owner&&<label>Queue kitchen<select value={branch} onChange={e=>{setBranch(e.target.value);setPage(1);}}><option value="all">All kitchens</option>{branches.map(b=><option value={b.id} key={b.id}>{b.name}</option>)}</select></label>}</div>
 <p className="queue-description">{stage==='new'?'Waiting for kitchen approval.':stage==='preparing'?'Approved orders waiting to cook, and meals being prepared.':'Packed meals awaiting collection or with a rider.'} Counts follow the current filters.</p>
 {query.error&&<Failure error={query.error} retry={()=>query.refetch()}/>}
 {query.isPending?<p role="status">Loading the kitchen queue...</p>:<><div className="queue-grid" aria-busy={query.isFetching}>{data?.items.map(order=><div className="queue-ticket" key={order.id}>{renderTicket(order)}</div>)}</div>{!data?.items.length&&<p className="queue-empty">No matching orders in this stage.</p>}<div className="queue-pagination"><span aria-live="polite">{data?.total?'Showing '+((data.page-1)*data.pageSize+1)+'-'+Math.min(data.page*data.pageSize,data.total)+' of '+data.total+' orders':'0 orders'}</span><div><button className="button" disabled={page<=1||query.isFetching} onClick={()=>setPage(p=>p-1)}>Previous page</button><span>Page {data?.page||1} of {pages}</span><button className="button" disabled={page>=pages||query.isFetching} onClick={()=>setPage(p=>p+1)}>Next page</button></div></div></>}
 </div>;
}
