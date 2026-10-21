"use client";
import {useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {useQueryClient} from '@tanstack/react-query';
import {useForm} from 'react-hook-form';
import {Suspense} from 'react';
import {ArrowRight,ShieldCheck} from 'lucide-react';
import {api} from '../../lib/api';
import {PlatformFrame,Failure} from '../platform-frame';
import {Button} from '@mimiz/ui';
function LoginForm(){
 const router=useRouter(),params=useSearchParams(),client=useQueryClient();
 const [challenge,setChallenge]=useState<{challengeId:string;demoCode?:string}|null>(null);
 const [error,setError]=useState<any>(null),[busy,setBusy]=useState(false);
 const form=useForm<{phone:string;name:string;code:string}>({defaultValues:{phone:'',name:'',code:''}});
 async function submit(values:any){setBusy(true);setError(null);try{if(!challenge){setChallenge(await api('/auth/otp',{method:'POST',body:JSON.stringify({phone:values.phone})}));}else{await api('/auth/verify',{method:'POST',body:JSON.stringify({challengeId:challenge.challengeId,code:values.code,name:values.name})});await client.invalidateQueries();const target=params.get('next');router.push(target?.startsWith('/')&&!target.startsWith('//')?target:'/checkout');}}catch(error){setError(error);}finally{setBusy(false);}}
 return <PlatformFrame title="Welcome to the table." description="Sign in with your Ghana phone number to place and follow your orders."><section className="panel auth-panel"><span className="empty-icon"><ShieldCheck/></span><h2>{challenge?'Check your code':'Your next favourite is waiting.'}</h2><form onSubmit={form.handleSubmit(submit)}>{!challenge?<><label>Your name<input {...form.register('name',{required:true,minLength:2})} autoComplete="name" required minLength={2} placeholder="How should we call you?"/></label><label>Phone number<input {...form.register('phone',{required:true})} type="tel" autoComplete="tel" required placeholder="024 123 4567"/></label></>:<><label>Six-digit code<input {...form.register('code',{required:true,pattern:/^\d{6}$/})} inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required placeholder="Enter your code"/></label>{challenge.demoCode&&<p className="demo-note">Demo login code: <b>{challenge.demoCode}</b>. No real SMS is sent.</p>}<button className="text-button" type="button" onClick={()=>setChallenge(null)}>Use another phone number</button></>}{error&&<Failure error={error}/>}<Button className="primary" disabled={busy}>{busy?'Please wait...':challenge?'Sign in':'Send my code'}<ArrowRight size={17}/></Button></form></section></PlatformFrame>;
}
export default function Login(){return <Suspense fallback={<p>Loading sign in...</p>}><LoginForm/></Suspense>;}
