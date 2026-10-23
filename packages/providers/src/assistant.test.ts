import {describe,it,expect,vi} from 'vitest';
import {LocalSupportModel,needsHuman} from './assistant';
const answers=[{id:'menu',text:'Jollof from GHS 70.'}];
describe('local support model',()=>{
 it('refuses external endpoints and cloud model names',()=>{expect(()=>new LocalSupportModel('https://example.com','qwen2.5:0.5b')).toThrow();expect(()=>new LocalSupportModel('http://localhost:11434/path','qwen')).toThrow();expect(()=>new LocalSupportModel('http://localhost:11434','model-cloud')).toThrow();});
 it('routes sensitive requests directly to a person',async()=>{const transport=vi.fn();expect(needsHuman('I have a peanut allergy')).toBe(true);expect(await new LocalSupportModel('http://localhost:11434','qwen',transport).choose('Refund my order',answers)).toEqual({answerId:'human',handover:true});expect(transport).not.toHaveBeenCalled();});
 it('accepts only a supplied answer id and disables streaming/tools',async()=>{const transport=vi.fn(async()=>new Response(JSON.stringify({message:{content:JSON.stringify({answerId:'menu',handover:false})}})));const result=await new LocalSupportModel('http://localhost:11434','qwen',transport as typeof fetch).choose('Show menu',answers);expect(result.answerId).toBe('menu');const body=JSON.parse(transport.mock.calls[0]![1]!.body as string);expect(body.stream).toBe(false);expect(body.tools).toBeUndefined();});
 it('hands over invalid and unknown selections',async()=>{const transport=async()=>new Response(JSON.stringify({message:{content:JSON.stringify({answerId:'invented',handover:false})}}));expect((await new LocalSupportModel('http://localhost:11434','qwen',transport as typeof fetch).choose('Hi',answers)).handover).toBe(true);});
 it('refuses malformed output and unavailable runtimes',async()=>{await expect(new LocalSupportModel('http://localhost:11434','qwen',async()=>new Response('{}')).choose('Hi',answers)).rejects.toThrow();await expect(new LocalSupportModel('http://localhost:11434','qwen',async()=>new Response('',{status:503})).choose('Hi',answers)).rejects.toThrow();});
 it('redacts phone numbers before local inference',async()=>{let sent='';const transport=async(_url:any,options:any)=>{sent=options.body;return new Response(JSON.stringify({message:{content:'{"answerId":"menu","handover":false}'}}));};await new LocalSupportModel('http://localhost:11434','qwen',transport as typeof fetch).choose('My number is 0241234567, show menu',answers);expect(sent).not.toContain('0241234567');});

 it('normalizes one selected answer and refuses a contradictory handover flag',async()=>{
  const answer=async()=>new Response(JSON.stringify({message:{content:'{"answerId":"menu"}'}}));
  expect(await new LocalSupportModel('http://localhost:11434','qwen',answer as typeof fetch).choose('Show the menu',answers)).toEqual({answerId:'menu',handover:false});
  const contradictory=async()=>new Response(JSON.stringify({message:{content:'{"answerId":"menu","handover":true}'}}));
  expect((await new LocalSupportModel('http://localhost:11434','qwen',contradictory as typeof fetch).choose('Show the menu',answers)).handover).toBe(true);
 });
});
