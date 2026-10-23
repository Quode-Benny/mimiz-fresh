export type SmsInput={id:string;to:string;body:string;senderId:string};
export type EmailInput={id:string;to:string;subject:string;html:string;from:string};
export type MessageReceipt={id:string;status:'accepted';segments:number};
export interface SmsProvider{readonly name:string;readonly simulated:boolean;send(input:SmsInput):Promise<MessageReceipt>;}
export interface EmailProvider{readonly name:string;readonly simulated:boolean;send(input:EmailInput):Promise<MessageReceipt>;}
export type OutboxRecord={id:string;channel:'sms'|'email';recipient:string;body:string;segments:number};
export interface MessageOutbox{write(record:OutboxRecord):Promise<void>;}
export function smsSegments(body:string){const extended='^{}\\[~]|\u20ac\f';const basic='@\u00a3$\u00a5\u00e8\u00e9\u00f9\u00ec\u00f2\u00c7\n\u00d8\u00f8\r\u00c5\u00e5\u0394_\u03a6\u0393\u039b\u03a9\u03a0\u03a8\u03a3\u0398\u039e\u00c6\u00e6\u00df\u00c9 !\"#\u00a4%&\'()*+,-./0123456789:;<=>?\u00a1ABCDEFGHIJKLMNOPQRSTUVWXYZ\u00c4\u00d6\u00d1\u00dc\u00a7\u00bfabcdefghijklmnopqrstuvwxyz\u00e4\u00f6\u00f1\u00fc\u00e0';let length=0;for(const character of body){if(extended.includes(character))length+=2;else if(basic.includes(character))length++;else return body.length<=70?1:Math.ceil(body.length/67);}return length<=160?1:Math.ceil(length/153);}
function validateSms(input:SmsInput){if(!/^\+233\d{9}$/.test(input.to)||!input.body.trim()||input.body.length>1600||!input.senderId)throw new Error('Invalid SMS message.');}
export class ConsoleSmsProvider implements SmsProvider{
 readonly name='console';readonly simulated=true;
 constructor(private outbox:MessageOutbox,private log:(value:unknown)=>void=()=>{}){}
 async send(input:SmsInput):Promise<MessageReceipt>{validateSms(input);const segments=smsSegments(input.body);await this.outbox.write({id:input.id,channel:'sms',recipient:input.to,body:input.body,segments});this.log({event:'message.accepted',channel:'sms',id:input.id,segments,simulated:true});return {id:input.id,status:'accepted',segments};}
}
export class ConsoleEmailProvider implements EmailProvider{
 readonly name='console';readonly simulated=true;
 constructor(private outbox:MessageOutbox,private log:(value:unknown)=>void=()=>{}){}
 async send(input:EmailInput):Promise<MessageReceipt>{if(!input.to.includes('@')||!input.subject||!input.html)throw new Error('Invalid email.');await this.outbox.write({id:input.id,channel:'email',recipient:input.to,body:input.subject+'\n'+input.html,segments:1});this.log({event:'message.accepted',channel:'email',id:input.id,simulated:true});return {id:input.id,status:'accepted',segments:1};}
}
// UNVERIFIED: complete sandbox delivery checks with an approved Arkesel account.
// https://arkesel.com/developer-api/sms-api/
export class ArkeselSmsProvider implements SmsProvider{
 readonly name='arkesel';readonly simulated=false;
 constructor(private apiKey:string,private fetcher:typeof fetch=fetch){if(!apiKey)throw new Error('ARKESEL_API_KEY is required.');}
 async send(input:SmsInput):Promise<MessageReceipt>{validateSms(input);const response=await this.fetcher('https://sms.arkesel.com/api/v2/sms/send',{method:'POST',headers:{'Content-Type':'application/json','api-key':this.apiKey},body:JSON.stringify({sender:input.senderId,message:input.body,recipients:[input.to]}),signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('SMS provider request failed ('+response.status+').');const data:any=await response.json();if(data.status!=='success')throw new Error('SMS provider did not accept the message.');return {id:String(data.data?.id||input.id),status:'accepted',segments:smsSegments(input.body)};}
}
// UNVERIFIED: endpoint must be supplied from the merchant's current Hubtel account.
// https://github.com/hubtel/hubtel-sms-csharp
export class HubtelSmsProvider implements SmsProvider{
 readonly name='hubtel';readonly simulated=false;
 constructor(private clientId:string,private clientSecret:string,private endpoint:string,private fetcher:typeof fetch=fetch){if(!clientId||!clientSecret||!endpoint.startsWith('https://'))throw new Error('Hubtel credentials and HTTPS SMS endpoint are required.');}
 async send(input:SmsInput):Promise<MessageReceipt>{validateSms(input);const response=await this.fetcher(this.endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Basic '+Buffer.from(this.clientId+':'+this.clientSecret).toString('base64')},body:JSON.stringify({From:input.senderId,To:input.to,Content:input.body,RegisteredDelivery:true,ClientReference:input.id}),signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('SMS provider request failed ('+response.status+').');const data:any=await response.json();const status=String(data.Status??data.status??'').toLowerCase();if(!['0','success','accepted','sent'].includes(status))throw new Error('SMS provider did not accept the message.');return {id:String(data.MessageId??data.messageId??input.id),status:'accepted',segments:smsSegments(input.body)};}
}
// UNVERIFIED: verify sending domain, idempotency, errors and delivery with test credentials.
// https://resend.com/docs/api-reference/emails/send-email
export class ResendEmailProvider implements EmailProvider{
 readonly name='resend';readonly simulated=false;
 constructor(private apiKey:string,private fetcher:typeof fetch=fetch){if(!apiKey)throw new Error('RESEND_API_KEY is required.');}
 async send(input:EmailInput):Promise<MessageReceipt>{const response=await this.fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+this.apiKey,'Content-Type':'application/json','Idempotency-Key':input.id},body:JSON.stringify({from:input.from,to:[input.to],subject:input.subject,html:input.html}),signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('Email provider request failed ('+response.status+').');const data:any=await response.json();if(typeof data.id!=='string')throw new Error('Email provider returned no message ID.');return {id:data.id,status:'accepted',segments:1};}
}
