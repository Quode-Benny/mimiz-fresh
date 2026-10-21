import {describe,it,expect} from 'vitest';
import {MockPaymentProvider,type GatewayStore,type PaymentProvider} from './payments';
import {createHmac} from 'node:crypto';
function fixture(){
 const transactions=new Map<string,{amount:number;status:string}>();
 const deliveries:{payload:any;delay:number}[]=[];
 const store:GatewayStore={
  async create(reference,amount){if(!transactions.has(reference))transactions.set(reference,{amount,status:'pending'});},
  async get(reference){const row=transactions.get(reference);if(!row)throw new Error('Unknown reference');return row;},
  async schedule(payload,delay){deliveries.push({payload,delay});},
 };
 const provider=new MockPaymentProvider(store,'unit-test-only-secret-not-a-runtime-credential','http://localhost:3002');
 return {provider,transactions,deliveries};
}
function paymentContract(make:()=>ReturnType<typeof fixture>){
 describe('payment provider contract',()=>{
  it('initialises exact GHS minor units and a stable reference',async()=>{const {provider,transactions}=make();const result=await (provider as PaymentProvider).initialize({reference:'contract-1',amount:6501,phone:'+233241234567',callbackUrl:'http://localhost:3002/orders/1'});expect(result.reference).toBe('contract-1');expect(result.authorizationUrl).toContain('/mock-pay/contract-1');expect(transactions.get('contract-1')?.amount).toBe(6501);expect(await provider.verify('contract-1')).toEqual({amount:6501,status:'pending',currency:'GHS'});});
  it('rejects missing and forged webhook signatures',()=>{const {provider}=make();const raw=Buffer.from(JSON.stringify({event:'charge.success',data:{reference:'r',amount:100,currency:'GHS'}}));expect(()=>provider.parseWebhook(raw,'')).toThrow();expect(()=>provider.parseWebhook(raw,'0'.repeat(128))).toThrow();});
  it('parses a signed provider-shaped event and keeps duplicate identity stable',()=>{const {provider}=make();const raw=Buffer.from(JSON.stringify({event:'charge.success',data:{reference:'r',amount:100,currency:'GHS'}}));const signature=provider.signature(raw.toString());const event=provider.parseWebhook(raw,signature);expect(event.reference).toBe('r');expect(event.amount).toBe(100);expect(event.currency).toBe('GHS');expect(provider.parseWebhook(raw,signature).id).toBe(event.id);});
  it('requests an asynchronous partial refund with correlation',async()=>{const {provider,deliveries}=make();await provider.refund({reference:'r',amount:500,refundId:'refund-1',reason:'Contract test'});expect(deliveries[0]?.payload).toMatchObject({event:'refund.processed',data:{reference:'r',amount:500,refund_id:'refund-1'}});});
 });
}
paymentContract(fixture);
describe('mock failure scenarios',()=>{
 it('emits duplicate success webhooks and preserves delay controls',async()=>{const {provider,deliveries}=fixture();await provider.initialize({reference:'r',amount:100});await provider.scenario('r','duplicate',5000);expect(deliveries).toHaveLength(2);expect(deliveries.map(item=>item.delay)).toEqual([5000,5800]);expect(deliveries[0]?.payload).toEqual(deliveries[1]?.payload);});
 it('declines and abandoned sessions do not emit success',async()=>{const {provider,deliveries}=fixture();await provider.initialize({reference:'r',amount:100});await provider.scenario('r','decline',100);expect(deliveries[0]?.payload.event).toBe('charge.failed');await provider.scenario('r','abandon',100);expect(deliveries).toHaveLength(1);});
});
