import {portalForPath} from './portal';
export class ApiError extends Error { constructor(public status:number, public code:string,message:string,public details?:{path:string;message:string}[]){super(message);} }
const refreshing=new Map<string,Promise<void>>();
export async function refreshSession(){
 const prefix=cookiePrefix();let pending=refreshing.get(prefix);
 if(!pending){
  const renew=async()=>{
   if(cookiePrefix()!==prefix)throw new ApiError(401,'PORTAL_CHANGED','Your workspace changed. Try again.');
   try{await api('/auth/me',{signal:AbortSignal.timeout(10000)},false);if(typeof window!=='undefined')window.dispatchEvent(new Event('mimiz:session-updated'));return;}catch(error){if(!(error instanceof ApiError)||error.status!==401)throw error;}
   if(cookiePrefix()!==prefix)throw new ApiError(401,'PORTAL_CHANGED','Your workspace changed. Try again.');
   await api('/auth/refresh',{method:'POST',signal:AbortSignal.timeout(10000)},false);
  };
  pending=(typeof navigator!=='undefined'&&navigator.locks?navigator.locks.request<void>('mimiz-session-refresh:'+prefix,renew):renew()).finally(()=>{refreshing.delete(prefix);});
  refreshing.set(prefix,pending);
 }
 return pending;
}
function cookiePrefix(){const portal=typeof window==='undefined'?'customer':portalForPath(window.location.pathname);return portal==='customer'?'mimiz':'mimiz_'+portal;}
function csrf(){if(typeof document==='undefined')return '';return document.cookie.split(';').map(value=>value.trim()).find(value=>value.startsWith(cookiePrefix()+'_csrf='))?.split('=').slice(1).join('=')||'';}
export async function api<T=any>(path:string,options:RequestInit={},retry=true):Promise<T>{
 const headers=new Headers(options.headers);headers.set('X-Mimiz-Portal',typeof window==='undefined'?'customer':portalForPath(window.location.pathname));if(options.body)headers.set('Content-Type','application/json');headers.set('X-CSRF-Token',csrf());
 let response:Response;try{response=await fetch('/api/v1'+path,{...options,headers,credentials:'same-origin',cache:'no-store'});}catch{throw new ApiError(0,'OFFLINE','Could not connect. Check your connection and try again.');}
 if(response.status===401&&retry&&!path.startsWith('/auth/')){
  try{await refreshSession();return api<T>(path,options,false);}catch{}
 }
 const body=await response.json().catch(()=>({message:'The server did not return a valid response.'}));
 if(!response.ok)throw new ApiError(response.status,body.code||'REQUEST_FAILED',body.message||'Something went wrong.',body.details);
 if(path==='/auth/refresh'&&typeof window!=='undefined')window.dispatchEvent(new Event('mimiz:session-updated'));
 return body as T;
}
export type Session={sessionId?:string;id:string;name:string;phone:string|null;email:string|null;role:string;branchId:string|null};
export type Branch={id:string;slug:string;name:string;address:string;phone:string;latitude:number;longitude:number;hours:any[];closures:string[];accepting:boolean;supports_cash:boolean;supports_delivery:boolean;supports_pickup:boolean;prep_minutes:number;extra_prep_minutes?:number;active?:boolean};

export async function apiBlob(path:string,retry=true):Promise<Blob>{
 const response=await fetch('/api/v1'+path,{credentials:'same-origin',cache:'no-store',headers:{'X-Mimiz-Portal':portalForPath(window.location.pathname)}});
 if(response.status===401&&retry){await refreshSession();return apiBlob(path,false);}
 if(!response.ok){const error=await response.json().catch(()=>({message:'The image could not be loaded.'}));throw new ApiError(response.status,error.code||'IMAGE_FAILED',error.message);}
 return response.blob();
}

export type CompanyConfiguration={name:string;logo:string;contact:Record<string,string>;version:string|null;settings:{serviceFee:{kind:'fixed'|'percent';value:number};taxBps:number;taxDelivery:boolean;dayparts:import('@mimiz/domain').DaypartDefinition[];flags:{onlinePayments:boolean;recommendations:boolean;promotions:boolean;scheduling:boolean}}};
