import {randomUUID} from 'node:crypto';
export type ErrorContext={component:string;requestId?:string;route?:string;method?:string;status?:number};
export interface ErrorProvider {capture(error:unknown,context:ErrorContext):Promise<void>;}
const label=(value:unknown,fallback='unknown')=>typeof value==='string'&&/^[A-Za-z0-9_:. /<>$-]{1,120}$/.test(value)?value.replace(/[0-9]{7,}/g,':id'):fallback;
export function safeErrorEvent(error:unknown,context:ErrorContext){
 const name=error instanceof Error&&/^[A-Za-z][A-Za-z0-9_]{0,60}$/.test(error.name)?error.name:'Error';
 const code=error&&typeof error==='object'&&'code' in error?label(String(error.code)):'unknown';
 const frames=(error instanceof Error?error.stack?.split('\n').slice(1,13)||[]:[]).flatMap(line=>{const match=/[\\/]([^\\/():]+):([0-9]+):([0-9]+)\)?$/.exec(line);return match?[{filename:label(match[1]),lineno:Number(match[2]),colno:Number(match[3])}]:[];}).reverse();
 return {event_id:randomUUID().replaceAll('-',''),timestamp:Date.now()/1000,level:'error',platform:'node',logger:'mimiz',exception:{values:[{type:name,value:'Unexpected server error',stacktrace:{frames}}]},fingerprint:[name,code,label(context.component)],tags:{component:label(context.component),code},extra:{requestId:label(context.requestId),route:label(context.route),method:label(context.method),status:context.status}};
}
export class ConsoleErrorProvider implements ErrorProvider {
 constructor(private log:(value:unknown)=>void=value=>console.error(JSON.stringify(value))){}
 async capture(error:unknown,context:ErrorContext){this.log({event:'error.captured',...safeErrorEvent(error,context)});}
}
export class SentryErrorProvider implements ErrorProvider {
 private endpoint:string;private auth:string;private pausedUntil=0;private window=0;private count=0;private inFlight=0;
 constructor(dsn:string,private transport:typeof fetch=fetch,private now=Date.now,private environment='development'){
  let url:URL;try{url=new URL(dsn);}catch{throw new Error('Invalid SENTRY_DSN.');}
  const parts=url.pathname.split('/').filter(Boolean),project=parts.pop(),key=decodeURIComponent(url.username);
  if(url.protocol!=='https:'||url.password||url.search||url.hash||!project||!/^[0-9]+$/.test(project)||!/^[A-Za-z0-9]+$/.test(key))throw new Error('Use a valid HTTPS Sentry DSN without a secret password.');
  this.endpoint=url.origin+'/'+[...parts,'api',project,'envelope',''].join('/');this.auth='Sentry sentry_version=7, sentry_client=mimiz.error-adapter/1.0.0, sentry_key='+key;
 }
 async capture(error:unknown,context:ErrorContext){
  const now=this.now();if(now<this.pausedUntil||this.inFlight>=5)return;if(now-this.window>=60000){this.window=now;this.count=0;}if(this.count>=50)return;this.count++;this.inFlight++;
  try{
   const event={...safeErrorEvent(error,context),environment:label(this.environment)},payload=JSON.stringify(event);
   const body=[JSON.stringify({event_id:event.event_id,sent_at:new Date(now).toISOString()}),JSON.stringify({type:'event',content_type:'application/json',length:Buffer.byteLength(payload)}),payload,''].join('\n');
   const response=await this.transport(this.endpoint,{method:'POST',headers:{'content-type':'application/x-sentry-envelope','x-sentry-auth':this.auth},body,signal:AbortSignal.timeout(3000)});
   const limits=response.headers.get('x-sentry-rate-limits')?.split(',').map(part=>Number(part.split(':')[0])).filter(value=>Number.isFinite(value)&&value>0)||[];
   if(limits.length)this.pausedUntil=now+Math.min(86400,Math.max(...limits))*1000;
   if(response.status===429){const retry=response.headers.get('retry-after'),seconds=retry&&Number.isFinite(Number(retry))?Number(retry):retry?(Date.parse(retry)-now)/1000:60;this.pausedUntil=Math.max(this.pausedUntil,now+Math.min(86400,Number.isFinite(seconds)&&seconds>0?seconds:60)*1000);return;}
   if(!response.ok)throw new Error('Sentry ingestion rejected an event (HTTP '+response.status+').');
  }finally{this.inFlight--;}
 }
}
export function createErrorProvider(env:Record<string,string|undefined>,log?:(value:unknown)=>void):ErrorProvider{
 const local=new ConsoleErrorProvider(log);
 if(!env.ERROR_PROVIDER||env.ERROR_PROVIDER==='console')return local;
 if(env.ERROR_PROVIDER!=='sentry')throw new Error('Unsupported ERROR_PROVIDER.');
 if(!env.SENTRY_DSN)throw new Error('SENTRY_DSN is required.');
 const remote=new SentryErrorProvider(env.SENTRY_DSN,fetch,Date.now,env.NODE_ENV);
 return {async capture(error,context){await local.capture(error,context);await remote.capture(error,context);}};
}
