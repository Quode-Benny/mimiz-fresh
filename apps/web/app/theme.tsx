"use client";
import {createContext,useContext,useEffect,useState} from 'react';
import {Monitor,Sun,Moon} from 'lucide-react';
type Mode='system'|'light'|'dark';
const ThemeContext=createContext<{mode:Mode;setMode:(mode:Mode)=>void}>({mode:'system',setMode:()=>{}});
export function ThemeProvider({children}:{children:React.ReactNode}){
 const [mode,setMode]=useState<Mode>('system'),[ready,setReady]=useState(false);
 useEffect(()=>{try{const saved=localStorage.getItem('mimiz-theme');if(saved==='dark'||saved==='light')setMode(saved);}catch{}setReady(true);},[]);
 useEffect(()=>{if(!ready)return;const media=matchMedia('(prefers-color-scheme: dark)');const apply=()=>{document.documentElement.dataset.theme=mode==='system'?(media.matches?'dark':'light'):mode;document.documentElement.style.colorScheme=document.documentElement.dataset.theme!;};apply();media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply);},[mode,ready]);
 useEffect(()=>{const update=(event:StorageEvent)=>{if(event.key==='mimiz-theme')setMode(event.newValue==='dark'||event.newValue==='light'?event.newValue:'system');};window.addEventListener('storage',update);return()=>window.removeEventListener('storage',update);},[]);
 function change(value:Mode){setMode(value);try{localStorage.setItem('mimiz-theme',value);}catch{}}
 return <ThemeContext.Provider value={{mode,setMode:change}}>{children}</ThemeContext.Provider>;
}
export function ThemeControl(){
 const {mode,setMode}=useContext(ThemeContext),Icon=mode==='system'?Monitor:mode==='dark'?Moon:Sun;
 return <label className="theme-control"><Icon size={16} aria-hidden="true"/><span className="sr-only">Appearance</span><select aria-label="Appearance" value={mode} onChange={event=>setMode(event.target.value as Mode)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>;
}
