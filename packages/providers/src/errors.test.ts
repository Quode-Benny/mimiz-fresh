import {it,expect} from 'vitest';
import {SentryErrorProvider,ConsoleErrorProvider,safeErrorEvent,createErrorProvider} from './errors';
const context={component:'http',requestId:'req-abc',route:'/api/v1/orders/:id',method:'POST',status:500};
it('excludes messages, customer identifiers, credentials and absolute stack paths',()=>{
 const error=new Error('Customer person@example.com 0241234567 password=secret Bearer token');error.stack='Error: private message\n at work (C:\\Users\\Private Person\\service.ts:42:8)';
 const event=safeErrorEvent(error,{...context,route:'/search?phone=0241234567'}),json=JSON.stringify(event);
 for(const value of ['person@example.com','0241234567','password','Bearer','Private Person','private message'])expect(json).not.toContain(value);
 expect(event.exception.values[0]!.stacktrace.frames[0]).toEqual({filename:'service.ts',lineno:42,colno:8});expect(event.extra.route).toBe('unknown');
});
it('logs metadata through the console provider without raw error content',async()=>{
 const records:any[]=[];await new ConsoleErrorProvider(value=>records.push(value)).capture(new Error('Private body'),context);
 expect(records[0].event).toBe('error.captured');expect(JSON.stringify(records)).not.toContain('Private body');
});
it('sends a correctly framed Sentry event to the configured prefix and project',async()=>{
 let target='',options:any;
 const transport=(async(input:any,init:any)=>{target=String(input);options=init;return new Response(null,{status:200});}) as typeof fetch;
 await new SentryErrorProvider('https://publicKey@errors.example/base/42',transport).capture(new Error('Do not transmit this'),context);
 expect(target).toBe('https://errors.example/base/api/42/envelope/');expect(options.headers['x-sentry-auth']).toContain('sentry_key=publicKey');expect(options.headers['content-type']).toBe('application/x-sentry-envelope');expect(options.signal).toBeInstanceOf(AbortSignal);
 const lines=options.body.split('\n'),header=JSON.parse(lines[0]),item=JSON.parse(lines[1]),event=JSON.parse(lines[2]);
 expect(header.event_id).toBe(event.event_id);expect(item.type).toBe('event');expect(item.length).toBe(Buffer.byteLength(lines[2]));expect(options.body).not.toContain('Do not transmit this');
});
it.each(['http://public@errors.example/42','https://public:secret@errors.example/42','https://public@errors.example/project','https://errors.example/42'])('rejects invalid/insecure DSNs %s',dsn=>{expect(()=>new SentryErrorProvider(dsn)).toThrow();});
it('respects remote retry delay without retrying the failing event',async()=>{
 let now=0,calls=0;const transport=(async()=>{calls++;return new Response(null,{status:429,headers:{'retry-after':'120'}});}) as typeof fetch;
 const provider=new SentryErrorProvider('https://public@errors.example/42',transport,()=>now);
 await provider.capture(new Error(),context);await provider.capture(new Error(),context);expect(calls).toBe(1);now=120001;await provider.capture(new Error(),context);expect(calls).toBe(2);
});
it('honours Sentry rate-limit headers on successful responses',async()=>{
 let now=0,calls=0;const transport=(async()=>{calls++;return new Response(null,{status:200,headers:{'x-sentry-rate-limits':'90:error:organization'}});}) as typeof fetch;
 const provider=new SentryErrorProvider('https://public@errors.example/42',transport,()=>now);await provider.capture(new Error(),context);now=80000;await provider.capture(new Error(),context);expect(calls).toBe(1);now=90001;await provider.capture(new Error(),context);expect(calls).toBe(2);
});
it('caps delivery volume per minute',async()=>{
 let now=0,calls=0;const transport=(async()=>{calls++;return new Response(null,{status:200});}) as typeof fetch;
 const provider=new SentryErrorProvider('https://public@errors.example/42',transport,()=>now);for(let index=0;index<55;index++)await provider.capture(new Error(),context);expect(calls).toBe(50);now=60001;await provider.capture(new Error(),context);expect(calls).toBe(51);
});
it('bounds concurrent sends and restores capacity after completion',async()=>{
 const pending:((value:Response)=>void)[]=[];const transport=(()=>new Promise<Response>(resolve=>pending.push(resolve))) as typeof fetch;
 const provider=new SentryErrorProvider('https://public@errors.example/42',transport),work=Array.from({length:6},()=>provider.capture(new Error(),context));expect(pending).toHaveLength(5);for(const resolve of pending)resolve(new Response(null,{status:200}));await Promise.all(work);
});
it('fails closed on unsupported/missing provider configuration',()=>{
 expect(createErrorProvider({})).toBeInstanceOf(ConsoleErrorProvider);expect(()=>createErrorProvider({ERROR_PROVIDER:'other'})).toThrow('Unsupported');expect(()=>createErrorProvider({ERROR_PROVIDER:'sentry'})).toThrow('SENTRY_DSN');
});
