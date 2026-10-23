import {mkdir,writeFile,readFile,unlink} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';
import {S3Client,PutObjectCommand,GetObjectCommand,DeleteObjectCommand} from '@aws-sdk/client-s3';
export interface PhotoStorage {put(key:string,body:Uint8Array):Promise<void>;get(key:string):Promise<Uint8Array>;remove(key:string):Promise<void>;}
export class PhotoNotFound extends Error {constructor(){super('Photo not found.');}}
export function photoKey(key:string){if(!/^(uploads\/[a-f0-9-]{36}\/(320|640|1200)\.webp|chat\/[a-f0-9-]{36}\.webp)$/.test(key))throw new Error('Invalid photo storage key.');return key;}
export class LocalPhotoStorage implements PhotoStorage {
 constructor(private root:string){this.root=resolve(root);}
 private path(key:string){const file=resolve(this.root,photoKey(key));if(!file.startsWith(this.root+sep))throw new Error('Photo path escapes storage root.');return file;}
 async put(key:string,body:Uint8Array){const path=this.path(key);await mkdir(dirname(path),{recursive:true});await writeFile(path,body,{flag:'wx',mode:0o600});}
 async get(key:string){try{return await readFile(this.path(key));}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')throw new PhotoNotFound();throw error;}}
 async remove(key:string){try{await unlink(this.path(key));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}
}
type Transport={send(command:any):Promise<any>};
export class S3PhotoStorage implements PhotoStorage {
 constructor(private bucket:string,private client:Transport,private prefix='mimiz/'){if(!bucket)throw new Error('S3 bucket is required.');if(!/^[a-zA-Z0-9_/-]*$/.test(prefix)||prefix.includes('..'))throw new Error('Invalid S3 prefix.');}
 private key(key:string){return this.prefix+photoKey(key);}
 async put(key:string,body:Uint8Array){await this.client.send(new PutObjectCommand({Bucket:this.bucket,Key:this.key(key),Body:body,ContentType:'image/webp',CacheControl:key.startsWith('uploads/')?'public, max-age=31536000, immutable':'private, no-store',IfNoneMatch:'*'}));}
 async get(key:string){try{const result=await this.client.send(new GetObjectCommand({Bucket:this.bucket,Key:this.key(key)}));if(!result.Body)throw new PhotoNotFound();if(result.ContentLength>10000000)throw new Error('Photo exceeds storage read limit.');const body=await result.Body.transformToByteArray();if(body.length>10000000)throw new Error('Photo exceeds storage read limit.');return body;}catch(error){if((error as any).name==='NoSuchKey'||(error as any).$metadata?.httpStatusCode===404)throw new PhotoNotFound();throw error;}}
 async remove(key:string){await this.client.send(new DeleteObjectCommand({Bucket:this.bucket,Key:this.key(key)}));}
}
export function createPhotoStorage(env:Record<string,string|undefined>,localRoot:string):PhotoStorage{
 if(!env.STORAGE_PROVIDER||env.STORAGE_PROVIDER==='local')return new LocalPhotoStorage(localRoot);
 if(env.STORAGE_PROVIDER!=='s3')throw new Error('Unsupported STORAGE_PROVIDER.');
 const required=(key:string)=>{if(!env[key])throw new Error(key+' is required for S3 storage.');return env[key]!;};
 const endpoint=env.S3_ENDPOINT;if(endpoint){const url=new URL(endpoint);if(url.username||url.password||!['http:','https:'].includes(url.protocol)||(env.NODE_ENV==='production'&&url.protocol!=='https:'))throw new Error('Use an HTTPS S3 endpoint in production.');}
 return new S3PhotoStorage(required('S3_BUCKET'),new S3Client({region:required('S3_REGION'),endpoint,forcePathStyle:env.S3_FORCE_PATH_STYLE==='true',credentials:{accessKeyId:required('S3_ACCESS_KEY_ID'),secretAccessKey:required('S3_SECRET_ACCESS_KEY')},maxAttempts:3}),env.S3_PREFIX||'mimiz/');
}
