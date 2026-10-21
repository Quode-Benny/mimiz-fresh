export class ApiError extends Error { constructor(public status:number, public code:string,message:string,public details?:{path:string;message:string}[]){super(message);} }
let refreshing:Promise<void>|null=null;
function csrf(){if(typeof document==='undefined')return '';return document.cookie.split(';').map(value=>value.trim()).find(value=>value.startsWith('mimiz_csrf='))?.slice(11)||'';}
export async function api<T=any>(path:string,options:RequestInit={},retry=true):Promise<T>{
 const headers=new Headers(options.headers);if(options.body)headers.set('Content-Type','application/json');headers.set('X-CSRF-Token',csrf());
 let response:Response;try{response=await fetch('/api/v1'+path,{...options,headers,credentials:'same-origin',cache:'no-store'});}catch{throw new ApiError(0,'OFFLINE','Could not connect. Check your connection and try again.');}
 if(response.status===401&&retry&&!path.startsWith('/auth/')){
  try{if(!refreshing)refreshing=api('/auth/refresh',{method:'POST'},false).then(()=>{}).finally(()=>{refreshing=null;});await refreshing;return api<T>(path,options,false);}catch{}
 }
 const body=await response.json().catch(()=>({message:'The server did not return a valid response.'}));
 if(!response.ok)throw new ApiError(response.status,body.code||'REQUEST_FAILED',body.message||'Something went wrong.',body.details);
 return body as T;
}
export type Session={id:string;name:string;phone:string|null;email:string|null;role:string;branchId:string|null};
export type Branch={id:string;slug:string;name:string;address:string;phone:string;latitude:number;longitude:number;hours:any[];closures:string[];accepting:boolean;supports_cash:boolean;supports_delivery:boolean;supports_pickup:boolean;prep_minutes:number};
