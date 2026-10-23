"use client";
import {ThemeControl} from './theme';
import {unsubscribeBrowserPush} from './push-settings';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {ArrowLeft,LogOut,Sparkles,ShieldCheck,ChefHat,Bike,LockKeyhole} from 'lucide-react';
import {useSession} from './providers';
import {api} from '../lib/api';
import {portalForPath,portalRoles} from '../lib/portal';
const portals={
 customer:{name:'Mimiz Fresh',label:'GOOD FOOD. GHANAIAN SOUL.',icon:Sparkles,home:'/',links:[['/','Menu'],['/orders','My orders'],['/account','Account']]},
 staff:{name:'Mimiz Kitchen',label:'SERVICE WORKSPACE',icon:ChefHat,home:'/staff',links:[['/staff','Kitchen workspace']]},
 admin:{name:'Mimiz Management',label:'ADMINISTRATION',icon:ShieldCheck,home:'/admin',links:[['/admin','Management workspace']]},
 rider:{name:'Mimiz Delivery',label:'RIDER WORKSPACE',icon:Bike,home:'/rider',links:[['/rider','My deliveries']]}
};
export function PlatformFrame({children,title,description}:{children:React.ReactNode;title:string;description?:string}){
 const path=usePathname(),portal=portalForPath(path),workspace=portals[portal],Icon=workspace.icon;
 const session=useSession(),client=useQueryClient(),router=useRouter();
 const [error,setError]=useState<any>(null),[busy,setBusy]=useState(false),[twoStep,setTwoStep]=useState(false);
 const internal=portal!=='customer',allowed=!!session.data&&portalRoles[portal].includes(session.data.role);
 async function logout(){setBusy(true);try{if(portal==='customer')await unsubscribeBrowserPush();await api('/auth/logout',{method:'POST'});await client.resetQueries();router.replace(workspace.home);router.refresh();}catch(error){setError(error);}finally{setBusy(false);}}
 return <div className={'experience experience-'+portal}>
 <div className="preview-bar"><span>Demo kitchen</span><p>Local orders. Online payments are simulated.</p></div>
 <header className="header portal-header"><div className="header-inner">
 <Link href={workspace.home} className="wordmark" aria-label={workspace.name}>mimiz<Icon aria-hidden="true"/></Link>
 <span className="portal-label">{workspace.label}</span>
 <nav aria-label={internal?workspace.name+' navigation':'Customer navigation'}>{workspace.links.map(([href,label])=><Link key={href} href={href!} aria-current={path===href?'page':undefined}>{label}</Link>)}</nav>
 <ThemeControl/>{allowed?<button className="button signout-button" aria-label="Sign out" disabled={busy} onClick={logout}><LogOut size={16}/><span>Sign out</span></button>:!internal?<Link className="button" href="/login">Sign in</Link>:<span className="secure-workspace"><LockKeyhole size={15}/>Secure access</span>}
 </div></header><main className="platform-page">
 {internal?<div className="workspace-caption"><span className="workspace-indicator"/>{workspace.name}{allowed&&<><span>{session.data!.name}</span><Link className="workspace-security" href={'/'+portal+'/security'}><ShieldCheck size={14}/>Security</Link>{['super_admin','branch_manager','support_agent'].includes(session.data!.role)&&<Link className="workspace-order" href={'/'+portal+'/new-order'}>New order</Link>}</>}</div>:<Link className="back-link" href="/"><ArrowLeft size={16}/>Back to the menu</Link>}
 {internal&&session.isPending?<section className="panel" role="status">Checking your workspace session...</section>:internal&&session.error&&!session.data?<section className="panel"><h1>Connection interrupted</h1><p>Your workspace session could not be checked. Try again when your connection is ready.</p><Failure error={session.error} retry={()=>session.refetch()}/></section>:internal&&!allowed?
 <section className="portal-login"><div className="portal-login-intro"><span className="portal-emblem"><Icon size={32}/></span><p className="eyebrow">{workspace.label}</p><h1>{portal==='rider'?'A good day, delivered.':portal==='admin'?'Good food starts with good management.':'A great service starts here.'}</h1><p>{portal==='rider'?'Your assigned deliveries, directions and customer details, ready for the road.':portal==='admin'?'Your people, menu and kitchen settings. Everything you need to keep Mimiz running.':'A focused workspace for orders, preparation and customer care.'}</p><span className="login-footnote">Mimiz Fresh / Accra, Ghana</span></div>
 <div className="panel portal-login-form"><p className="eyebrow">WELCOME BACK</p><h2>Sign in to {portal==='admin'?'administration':portal==='rider'?'your rider workspace':'staff workspace'}</h2><p>Use the email and password provided for your role.</p>
 {session.error&&<Failure error={session.error} retry={()=>session.refetch()}/>}
 {session.data?<><p className="inline-error">This account does not have access to this workspace.</p><button className="button" onClick={logout}>Sign out of this workspace</button></>:<form onSubmit={async event=>{event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);setError(null);try{await api('/auth/staff-login',{method:'POST',body:JSON.stringify({email:data.get('email'),password:data.get('password'),code:data.get('code')||undefined})});await client.resetQueries();await client.invalidateQueries();}catch(error:any){if(['SECOND_FACTOR_REQUIRED','SECOND_FACTOR_INVALID'].includes(error.code))setTwoStep(true);setError(error);}finally{setBusy(false);}}}>
 <label>Email<input name="email" type="email" required autoComplete="username"/></label><label>Password<input name="password" type="password" required autoComplete="current-password"/></label>
 {twoStep&&<label>Authenticator or recovery code<input name="code" autoComplete="one-time-code" required maxLength={40}/></label>}{error&&<Failure error={error}/>}<button className="button primary" disabled={busy}>{busy?'Signing in...':portal==='staff'?'Sign in to staff workspace':portal==='admin'?'Sign in to administration':'Sign in to rider workspace'}</button></form>}
 <p className="portal-security"><ShieldCheck size={16}/>Access is limited to your assigned role.</p></div></section>:<><div className="page-heading"><p className="eyebrow">{workspace.label}</p><h1>{title}</h1>{description&&<p>{description}</p>}</div>{error&&<Failure error={error}/>} {children}</>}
 </main>{internal&&<footer className="portal-footer"><span>{workspace.name}</span><span>Focused on a better service.</span></footer>}</div>;
}
export function Failure({error,retry}:{error:any;retry?:()=>void}){return <div className="inline-error" role="alert"><strong>{error?.message||'Something went wrong. Please try again.'}</strong>{error?.details?.length>0&&<ul>{error.details.map((detail:any,index:number)=><li key={index}>{detail.path}: {detail.message}</li>)}</ul>}{retry&&<button onClick={retry}>Try again</button>}</div>;}
