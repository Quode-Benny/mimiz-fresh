import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
export type GatewayEvent={id:string;type:string;reference:string;amount:number;currency:string;refundId?:string;raw:unknown};
export interface PaymentProvider {
 readonly name:string;readonly simulated:boolean;
 initialize(input:{reference:string;amount:number;email?:string;phone:string;callbackUrl:string}):Promise<{reference:string;authorizationUrl:string}>;
 verify(reference:string):Promise<{status:string;amount:number;currency:string}>;
 refund(input:{reference:string;amount:number;refundId:string;reason:string}):Promise<void>;
 parseWebhook(raw:Buffer,signature:string):GatewayEvent;
}
export interface GatewayStore {
 create(reference:string,amount:number):Promise<void>;
 get(reference:string):Promise<{amount:number;status:string}>;
 schedule(payload:unknown,delay:number):Promise<void>;
}
export class MockPaymentProvider implements PaymentProvider {
 readonly name='mock';readonly simulated=true;
 constructor(private store:GatewayStore,private secret:string,private webOrigin:string){}
 async initialize(input:{reference:string;amount:number}){await this.store.create(input.reference,input.amount);return {reference:input.reference,authorizationUrl:this.webOrigin+'/mock-pay/'+input.reference};}
 async verify(reference:string){return {...await this.store.get(reference),currency:'GHS'};}
 async refund(input:{reference:string;amount:number;refundId:string;reason:string}){await this.store.schedule({event:'refund.processed',data:{id:input.refundId,reference:input.reference,amount:input.amount,currency:'GHS',refund_id:input.refundId}},600);}
 parseWebhook(raw:Buffer,signature:string){return parseEvent(raw,signature,this.secret);}
 async scenario(reference:string,scenario:string,delay:number){
  const transaction=await this.store.get(reference);
  if(transaction.status!=='pending'&&scenario!=='duplicate')throw new Error('This simulated payment already resolved.');
  if(scenario==='abandon')return;
  const payload={event:scenario==='decline'?'charge.failed':'charge.success',data:{id:reference,reference,amount:transaction.amount,currency:'GHS'}};
  await this.store.schedule(payload,delay);
  if(scenario==='duplicate')await this.store.schedule(payload,delay+800);
 }
 signature(raw:string){return createHmac('sha512',this.secret).update(raw).digest('hex');}
}
function parseEvent(raw:Buffer,signature:string,secret:string):GatewayEvent{
 const expected=Buffer.from(createHmac('sha512',secret).update(raw).digest('hex'));const actual=Buffer.from(signature);
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new Error('Invalid webhook signature');
 const payload=JSON.parse(raw.toString('utf8'));const data=payload.data||{};
 return {id:createHash('sha256').update(raw).digest('hex'),type:String(payload.event),reference:String(data.reference||data.transaction?.reference||''),amount:Number(data.amount),currency:String(data.currency||''),refundId:data.refund_id?String(data.refund_id):data.id?String(data.id):undefined,raw:payload};
}
/** UNVERIFIED: implemented from official Paystack docs; needs provider sandbox contract testing before live use. */
export class PaystackPaymentProvider implements PaymentProvider {
 readonly name='paystack';readonly simulated=false;
 constructor(private secret:string){}
 private async request(path:string,body?:unknown){const response=await fetch('https://api.paystack.co'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+this.secret,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});const result=await response.json() as any;if(!response.ok||!result.status)throw new Error('Payment provider request failed');return result.data;}
 async initialize(input:{reference:string;amount:number;email?:string;phone:string;callbackUrl:string}){if(!input.email)throw new Error('An email address is required for Paystack checkout.');const data=await this.request('/transaction/initialize',{reference:input.reference,amount:String(input.amount),currency:'GHS',email:input.email,callback_url:input.callbackUrl,channels:['card','mobile_money'],metadata:{phone:input.phone}});return {reference:data.reference,authorizationUrl:data.authorization_url};}
 async verify(reference:string){const data=await this.request('/transaction/verify/'+encodeURIComponent(reference));return {status:data.status,amount:Number(data.amount),currency:data.currency};}
 async refund(input:{reference:string;amount:number;refundId:string;reason:string}){await this.request('/refund',{transaction:input.reference,amount:input.amount,currency:'GHS',merchant_note:input.reason});}
 parseWebhook(raw:Buffer,signature:string){return parseEvent(raw,signature,this.secret);}
}
