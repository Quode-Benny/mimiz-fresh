import {loadEnvFile} from 'node:process';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPhotoStorage,photoKey,PhotoNotFound} from '@mimiz/providers';
const root=fileURLToPath(new URL('../../../',import.meta.url));
try{loadEnvFile(resolve(root,'.env'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
const apply=process.argv.includes('--apply'),keys:string[]=[];
async function walk(folder:string){let entries;try{entries=await readdir(resolve(root,'data',folder),{withFileTypes:true});}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
 for(const entry of entries){if(entry.isSymbolicLink())throw Error('Storage migration refuses symlinks.');const key=folder+'/'+entry.name;if(entry.isDirectory())await walk(key);else if(entry.isFile())keys.push(photoKey(key));}
}
await walk('uploads');await walk('chat');
if(!apply){console.log('Dry run: '+keys.length+' local photos would be copied. No remote connection or source deletion. Configure S3 and repeat with --apply only after reviewing docs/storage.md.');process.exit(0);}
if(process.env.STORAGE_PROVIDER!=='s3')throw Error('Explicit STORAGE_PROVIDER=s3 is required for migration.');
const storage=createPhotoStorage(process.env,resolve(root,'data')),digest=(value:Uint8Array)=>createHash('sha256').update(value).digest('hex');
let copied=0,unchanged=0;
for(const key of keys){
 const bytes=await readFile(resolve(root,'data',key)),hash=digest(bytes);let existing:Uint8Array|undefined;
 try{existing=await storage.get(key);}catch(error){if(!(error instanceof PhotoNotFound))throw error;}
 if(existing){if(digest(existing)!==hash)throw Error('Destination differs from source. Migration stopped without overwriting.');unchanged++;continue;}
 await storage.put(key,bytes);if(digest(await storage.get(key))!==hash)throw Error('Copied photo checksum did not match.');copied++;
}
const directory=join(root,'data/migrations');await mkdir(directory,{recursive:true});await writeFile(join(directory,'photos-'+Date.now()+'.json'),JSON.stringify({at:new Date().toISOString(),copied,unchanged,total:keys.length,sourceRetained:true},null,2),{mode:0o600});
console.log('Migration verified: '+copied+' copied, '+unchanged+' identical objects retained. Local source files were not deleted.');
