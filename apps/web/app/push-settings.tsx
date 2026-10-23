"use client";
import {useState,useEffect} from 'react';
import {BellRing} from 'lucide-react';
import {useQuery} from '@tanstack/react-query';
import {api} from '../lib/api';
export async function unsubscribeBrowserPush(){
 if(!('serviceWorker' in navigator))return;
 const registration=await navigator.serviceWorker.getRegistration();
 const subscription=await registration?.pushManager.getSubscription();
 if(subscription){await api('/push/subscriptions',{method:'DELETE',body:JSON.stringify({endpoint:subscription.endpoint})});await subscription.unsubscribe();}
}
export function PushSettings(){
 const config=useQuery<{available:boolean;publicKey:string|null}>({queryKey:['push-config'],queryFn:()=>api('/push/config')});
 const [supported,setSupported]=useState(false),[subscribed,setSubscribed]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{setSupported('serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window);if('serviceWorker' in navigator)void navigator.serviceWorker.getRegistration().then(async registration=>setSubscribed(!!await registration?.pushManager.getSubscription()));},[]);
 async function enable(){setBusy(true);setNotice('');try{
  const registration=await navigator.serviceWorker.getRegistration();if(!registration?.active)throw new Error('Install or open the production PWA to enable notifications. The development server does not register a service worker.');
  if(await Notification.requestPermission()!=='granted')throw new Error('Notification permission was not granted. You can keep using in-app updates.');
  const encoded=config.data!.publicKey!,padding='='.repeat((4-encoded.length%4)%4),raw=atob((encoded+padding).replace(/-/g,'+').replace(/_/g,'/')),key=Uint8Array.from(raw,value=>value.charCodeAt(0));
  const subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
  await api('/push/subscriptions',{method:'POST',body:JSON.stringify(subscription.toJSON())});setSubscribed(true);setNotice('Order notifications are enabled on this device.');
 }catch(error:any){setNotice(error.message);}finally{setBusy(false);}}
 return <section className="panel"><BellRing size={23}/><h2>Updates, wherever you are.</h2><p>Enable browser notifications for your order. Your browser will ask for permission.</p><button className="button" disabled={busy||!supported||!config.data?.available} onClick={subscribed?async()=>{setBusy(true);try{await unsubscribeBrowserPush();setSubscribed(false);setNotice('Notifications disabled on this device.');}catch(error:any){setNotice(error.message);}finally{setBusy(false);}}:enable}>{subscribed?'Disable this device':busy?'Please wait...':'Enable order notifications'}</button>{!supported&&<p className="small-note">Push is not supported in this browser. Your in-app updates are still available.</p>}{config.data&&!config.data.available&&<p className="small-note">Push keys have not been configured for this server.</p>}{notice&&<p className="small-note" role="status">{notice}</p>}</section>;
}
