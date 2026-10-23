"use client";
import {SupportLauncher} from './support-launcher';
import {usePathname} from 'next/navigation';
import {portalForPath} from '../lib/portal';
import { useState,useEffect } from 'react';
import { QueryClient,QueryClientProvider,useQuery,useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { api,refreshSession,type Session } from '../lib/api';
export function useSession(){
 return useQuery<Session|null>({
  queryKey:['session'],
  queryFn:async()=>{
   try{return await api<Session>('/auth/me');}catch(error:any){
    if(error.status!==401)throw error;
    try{await refreshSession();return await api<Session>('/auth/me');}
    catch(renewalError:any){if(renewalError.status===401||renewalError.status===403)return null;throw renewalError;}
   }
  },
  retry:(attempt,error:any)=>error?.status===0&&attempt<2,
  retryDelay:attempt=>Math.min(500*2**attempt,2000),
  staleTime:60000
 });
}
function LiveUpdates(){const {data:session}=useSession();const client=useQueryClient();useEffect(()=>{if(!session)return;const socket=io(process.env.NEXT_PUBLIC_API_ORIGIN||'http://localhost:4000',{withCredentials:true,auth:{portal:portalForPath(window.location.pathname)}});socket.on('chat.updated',()=>{for(const key of ['messages','staff-messages','staff-chats','thread-info','notifications'])client.invalidateQueries({queryKey:[key]});});socket.on('disconnect',reason=>{if(reason==='io server disconnect')client.invalidateQueries({queryKey:['session']});});socket.on('connect_error',()=>client.invalidateQueries({queryKey:['session']}));socket.on('order.updated',()=>{for(const key of ['orders','order','staff-orders','staff-summary','notifications'])client.invalidateQueries({queryKey:[key]});});return()=>{socket.disconnect();};},[session?.id,session?.sessionId,client]);return null;}
function PortalProvider({children}:{children:React.ReactNode}){const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:1,refetchOnWindowFocus:true}}}));useEffect(()=>{const refresh=()=>{void client.invalidateQueries({queryKey:['session']});};window.addEventListener('mimiz:session-updated',refresh);return()=>window.removeEventListener('mimiz:session-updated',refresh);},[client]);return <QueryClientProvider client={client}><LiveUpdates/>{children}<SupportLauncher/></QueryClientProvider>;}

export function Providers({children}:{children:React.ReactNode}){const path=usePathname();return <PortalProvider key={portalForPath(path)}>{children}</PortalProvider>;}
