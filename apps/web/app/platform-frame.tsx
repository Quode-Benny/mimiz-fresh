"use client";
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useQueryClient} from '@tanstack/react-query';
import {ArrowLeft,LogOut,Sparkles,ShoppingBag} from 'lucide-react';
import {useSession} from './providers';
import {api} from '../lib/api';
export function PlatformFrame({children,title,description}:{children:React.ReactNode;title:string;description?:string}){
 const session=useSession();const client=useQueryClient();const router=useRouter();
 return <><div className="preview-bar"><span>Demo kitchen</span><p>Local orders. Online payments are simulated.</p></div><header className="header"><div className="header-inner"><Link href="/" className="wordmark">mimiz<Sparkles/></Link><nav aria-label="Platform navigation"><Link href="/">Menu</Link><Link href="/orders">My orders</Link><Link href="/account">Account</Link>{session.data&&session.data.role!=='customer'&&<Link href="/staff">Staff</Link>}</nav>{session.data?<button className="button" onClick={async()=>{await api('/auth/logout',{method:'POST'});client.clear();router.push('/');}}><LogOut size={16}/><span className="bag-label">Sign out</span></button>:<Link className="button" href="/login">Sign in</Link>}</div></header><main className="platform-page"><Link className="back-link" href="/"><ArrowLeft size={16}/>Back to the menu</Link><div className="page-heading"><p className="eyebrow">MIMIZ KITCHEN</p><h1>{title}</h1>{description&&<p>{description}</p>}</div>{children}</main></>;
}
export function Failure({error,retry}:{error:any;retry?:()=>void}){return <div className="inline-error" role="alert"><strong>{error?.message||'Something went wrong. Please try again.'}</strong>{error?.details?.length>0&&<ul>{error.details.map((detail:any,index:number)=><li key={index}>{detail.path}: {detail.message}</li>)}</ul>}{retry&&<button onClick={retry}>Try again</button>}</div>;}
