"use client";
import {useEffect,useRef} from 'react';
import Image from 'next/image';
import {ArrowUpRight} from 'lucide-react';
import type {MenuItem} from '@mimiz/shared';
import {formatMoney} from '@mimiz/domain';
import {api} from '../lib/api';
export type RecommendationGroup={source:string;title:string;reason:string;items:MenuItem[]};
export function RecommendationShelf({group,branchId,onChoose}:{group:RecommendationGroup;branchId:string;onChoose:(item:MenuItem,source:string)=>void}){
 const root=useRef<HTMLElement>(null),seen=useRef(new Set<string>());
 useEffect(()=>{const observer=new IntersectionObserver(entries=>{const events=entries.filter(entry=>entry.isIntersecting).flatMap(entry=>{const id=(entry.target as HTMLElement).dataset.item!;if(seen.current.has(id))return [];seen.current.add(id);return [{itemId:id,kind:'impression',source:group.source}];});if(events.length)void api('/recommendations/events',{method:'POST',body:JSON.stringify({branchId,events})}).catch(()=>{});},{threshold:.5});root.current?.querySelectorAll('[data-item]').forEach(element=>observer.observe(element));return()=>observer.disconnect();},[branchId,group.source,group.items.map(item=>item.id).join(',')]);
 return <section className="recommendation-section" ref={root} aria-label={group.title}><div className="recommendation-heading"><h3>{group.title}</h3><p>{group.reason}</p></div><div className="recommendation-row">{group.items.slice(0,6).map(item=><button className="recommendation-card" key={item.id} data-item={item.id} onClick={()=>{void api('/recommendations/events',{method:'POST',body:JSON.stringify({branchId,events:[{itemId:item.id,kind:'click',source:group.source}]})}).catch(()=>{});onChoose(item,group.source);}}><span className="recommendation-photo"><Image src={item.image} alt="" fill sizes="200px"/></span><span><b>{item.name}</b><small>From {formatMoney(item.pricePesewas)}</small></span><ArrowUpRight size={17}/></button>)}</div></section>;
}
