"use client";
import {useEffect,useMemo,useState} from 'react';
import {scheduleSlots} from '@mimiz/domain';
import type {Branch} from '../lib/api';
export function ScheduleOptions({branch}:{branch?:Branch}){
 const [now,setNow]=useState<Date|null>(null);useEffect(()=>{setNow(new Date());const timer=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(timer);},[]);
 const slots=useMemo(()=>branch&&now?scheduleSlots(branch,now):[],[branch,now]);
 return <><option value="">As soon as possible</option>{slots.map(value=><option key={value} value={value}>{new Intl.DateTimeFormat('en-GH',{timeZone:'Africa/Accra',weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value))}</option>)}</>;
}
