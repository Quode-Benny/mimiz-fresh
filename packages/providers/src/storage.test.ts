import {describe,it,expect,afterEach} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,basename,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {LocalPhotoStorage,S3PhotoStorage,PhotoNotFound,photoKey,createPhotoStorage} from './storage';
const roots:string[]=[];
afterEach(async()=>{for(const root of roots.splice(0)){if(dirname(resolve(root))!==resolve(tmpdir())||!basename(root).startsWith('mimiz-storage-test-'))throw Error('Unexpected test directory.');await rm(root,{recursive:true,force:true});}});
const key='uploads/'+randomUUID()+'/640.webp',privateKey='chat/'+randomUUID()+'.webp';
describe('photo storage boundaries',()=>{
 it.each(['../secret','uploads/../../secret','chat/'+randomUUID()+'.svg','uploads/'+randomUUID()+'/999.webp','uploads/'+randomUUID()+'/640.webp?private=true'])('rejects an unsafe key %s',value=>{expect(()=>photoKey(value)).toThrow();});
 it('stores public/private photos, refuses replacement, and deletes idempotently',async()=>{
  const root=await mkdtemp(join(tmpdir(),'mimiz-storage-test-'));roots.push(root);const storage=new LocalPhotoStorage(root),bytes=new Uint8Array([1,2,3]);
  for(const path of [key,privateKey]){await storage.put(path,bytes);expect([...await storage.get(path)]).toEqual([...bytes]);await expect(storage.put(path,new Uint8Array([9]))).rejects.toThrow();await storage.remove(path);await storage.remove(path);await expect(storage.get(path)).rejects.toBeInstanceOf(PhotoNotFound);}
 });
 it('uses private S3 objects and immutable conditional writes without an ACL',async()=>{
  const commands:any[]=[];const storage=new S3PhotoStorage('photos',{send:async command=>{commands.push(command);return {};}});
  await storage.put(privateKey,new Uint8Array([1]));const input=commands[0].input;expect(input.Key).toBe('mimiz/'+privateKey);expect(input.IfNoneMatch).toBe('*');expect(input.ACL).toBeUndefined();expect(input.CacheControl).toBe('private, no-store');
  await storage.put(key,new Uint8Array([1]));expect(commands[1].input.CacheControl).toContain('immutable');
 });
 it('reads and deletes only the selected object',async()=>{
  const commands:any[]=[];const storage=new S3PhotoStorage('photos',{send:async command=>{commands.push(command);return {Body:{transformToByteArray:async()=>new Uint8Array([3,4])},ContentLength:2};}});
  expect([...await storage.get(privateKey)]).toEqual([3,4]);await storage.remove(privateKey);expect(commands.map(command=>command.input.Key)).toEqual(['mimiz/'+privateKey,'mimiz/'+privateKey]);
 });
 it('maps missing objects but preserves outage errors',async()=>{
  const missing=new S3PhotoStorage('photos',{send:async()=>{throw Object.assign(new Error('missing'),{name:'NoSuchKey'});}});await expect(missing.get(key)).rejects.toBeInstanceOf(PhotoNotFound);
  const unavailable=new S3PhotoStorage('photos',{send:async()=>{throw Error('outage');}});await expect(unavailable.get(key)).rejects.toThrow('outage');
 });
 it('rejects oversized reads before consuming a response body',async()=>{
  const storage=new S3PhotoStorage('photos',{send:async()=>({ContentLength:10000001,Body:{transformToByteArray:async()=>{throw Error('Should not consume body');}}})});await expect(storage.get(key)).rejects.toThrow('read limit');
 });
 it('fails closed on missing cloud configuration, unsupported modes and insecure production endpoints',()=>{
  expect(()=>createPhotoStorage({STORAGE_PROVIDER:'s3'},'.')).toThrow('S3_BUCKET');
  expect(()=>createPhotoStorage({STORAGE_PROVIDER:'unknown'},'.')).toThrow('Unsupported');
  expect(()=>createPhotoStorage({STORAGE_PROVIDER:'s3',NODE_ENV:'production',S3_ENDPOINT:'http://storage.example'},'.')).toThrow('HTTPS');
  expect(createPhotoStorage({},'.')).toBeInstanceOf(LocalPhotoStorage);
 });
});
