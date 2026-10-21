"use client";
import { useState,useEffect } from 'react';
import { QueryClient,QueryClientProvider,useQuery,useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { api,type Session } from '../lib/api';
export function useSession(){return useQuery<Session|null>({queryKey:['session'],queryFn:async()=>{try{return await api<Session>('/auth/me');}catch(error:any){if(error.status===401){try{await api('/auth/refresh',{method:'POST'},false);return await api('/auth/me');}catch{return null;}}throw error;}},retry:false,staleTime:60000});}
function LiveUpdates(){const {data:session}=useSession();const client=useQueryClient();useEffect(()=>{if(!session)return;const socket=io(process.env.NEXT_PUBLIC_API_ORIGIN||'http://localhost:4000',{withCredentials:true});socket.on('order.updated',()=>{for(const key of ['orders','order','staff-orders','staff-summary','notifications'])client.invalidateQueries({queryKey:[key]});});return()=>{socket.disconnect();};},[session?.id,client]);return null;}
export function Providers({children}:{children:React.ReactNode}){const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:1,refetchOnWindowFocus:true}}}));return <QueryClientProvider client={client}><LiveUpdates/>{children}</QueryClientProvider>;}
