"use client";
import {useState} from 'react';
import {usePathname} from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import {MessageCircle,X,Sparkles,ArrowUpRight} from 'lucide-react';
import Link from 'next/link';
import {useQuery} from '@tanstack/react-query';
import {useSession} from './providers';
import {portalForPath} from '../lib/portal';
import {GeneralSupport} from './general-support';
import {api} from '../lib/api';
export function SupportLauncher(){
 const path=usePathname(),session=useSession(),[open,setOpen]=useState(false);
 if(portalForPath(path)!=='customer'||path.startsWith('/mock-pay'))return null;
 return <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Trigger className="support-launcher" aria-label="Open Mimiz help"><MessageCircle size={21}/><span>A little help?</span></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="modern-overlay"/><Dialog.Content className="support-drawer"><div className="support-drawer-heading"><span><Sparkles size={22}/></span><div><Dialog.Title>Akwaaba. How can we help?</Dialog.Title><Dialog.Description>Menu questions, order help and a person when you need one.</Dialog.Description></div><Dialog.Close className="dialog-close" aria-label="Close support"><X size={19}/></Dialog.Close></div>{session.data?<GeneralSupport/>:<div className="profile-empty"><MessageCircle size={32}/><h3>Let's keep your conversation private.</h3><p>Sign in with your phone to talk to the kitchen.</p><Link className="button primary" href={'/login?next='+encodeURIComponent(path)} onClick={()=>setOpen(false)}>Sign in to chat <ArrowUpRight size={16}/></Link></div>}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function CustomerResume(){
 const session=useSession(),orders=useQuery<any[]>({queryKey:['orders'],queryFn:()=>api('/orders'),enabled:session.data?.role==='customer',refetchInterval:10000});
 const active=orders.data?.find(order=>!['completed','cancelled','rejected'].includes(order.status));
 if(!active)return null;
 return <Link className="resume-banner" href={'/orders/'+active.id}><span className="resume-icon"><MessageCircle size={22}/></span><span><b>Your next good meal is in progress.</b><small>{active.number} / {active.status==='placed'?'Waiting for kitchen approval':active.status.replaceAll('_',' ')}</small></span><span className="resume-action">Track order <ArrowUpRight size={18}/></span></Link>;
}
