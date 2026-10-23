import {spawn,spawnSync} from 'node:child_process';
import {createReadStream,createWriteStream} from 'node:fs';
import {mkdir,writeFile,readFile,stat,chmod} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dockerBinary} from './docker.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
process.loadEnvFile(join(root,'.env'));
if(process.env.NODE_ENV==='production')throw new Error('Use the production backup service for production data.');
if(process.env.STORAGE_PROVIDER==='s3')throw new Error('This local backup command does not export S3 photos. Use the configured object-store backup service.');
const requestedSource=process.env.BACKUP_PHOTO_SOURCE||'auto';if(!['auto','native','container'].includes(requestedSource))throw new Error('BACKUP_PHOTO_SOURCE must be auto, native, or container.');
const dir=resolve(root,'data/backups');await mkdir(dir,{recursive:true});
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),name='mimiz-'+stamp,file=join(dir,name+'.dump');
const output=createWriteStream(file,{mode:0o600});
const child=spawn(dockerBinary(),['compose','exec','-T','postgres','pg_dump','-Fc','--no-owner','-U','mimiz','-d','mimiz_fresh'],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
let error='';child.stderr.on('data',chunk=>error+=chunk);child.stdout.pipe(output);
await new Promise((done,reject)=>{child.once('error',reject);child.once('exit',code=>{if(code)reject(new Error('Database backup failed: '+error));});output.once('finish',done);output.once('error',reject);});
const hash=createHash('sha256').update(await readFile(file)).digest('hex');
const compose=['compose','-f','docker-compose.yml','-f','docker-compose.app.yml'];
const active=spawnSync(dockerBinary(),[...compose,'ps','--status','running','-q','api'],{cwd:root,windowsHide:true,encoding:'utf8'});
if(active.error||active.status)throw new Error('Could not determine application storage source.');
const existing=spawnSync(dockerBinary(),[...compose,'ps','-a','-q','api'],{cwd:root,windowsHide:true,encoding:'utf8'});if(existing.error||existing.status)throw new Error('Could not inspect application storage ownership.');
if(requestedSource!=='native'&&!active.stdout.trim()&&(requestedSource==='container'||existing.stdout.trim()))throw new Error('Application photo volume exists but its API container is stopped. Start that container for backup, or explicitly select BACKUP_PHOTO_SOURCE=native only if host files are authoritative.');
const container=requestedSource==='native'?'':active.stdout.trim(),source=container?'application-container':'native-host';
let folders=[];
if(container){
 const listed=spawnSync(dockerBinary(),['exec',container,'node','-e',"const f=require('fs');console.log(JSON.stringify(['uploads','chat'].filter(p=>f.existsSync('/app/data/'+p))))"],{cwd:root,windowsHide:true,encoding:'utf8'});
 if(listed.error||listed.status)throw new Error('Could not inspect application photo storage.');folders=JSON.parse(listed.stdout);
}else for(const folder of ['uploads','chat']){try{if((await stat(join(root,'data',folder))).isDirectory())folders.push(folder);}catch(error){if(error.code!=='ENOENT')throw error;}}
let uploads=null,uploadsSha256=null;
if(folders.length){
 uploads=name+'-uploads.tgz';const archive=join(dir,uploads);
 if(container){
  const stream=createWriteStream(archive,{mode:0o600});
  const tar=spawn(dockerBinary(),['exec',container,'tar','-czf','-','-C','/app/data',...folders],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let stderr='';tar.stderr.on('data',chunk=>stderr+=chunk);tar.stdout.pipe(stream);
  await Promise.all([new Promise((done,reject)=>{tar.once('error',reject);tar.once('exit',code=>code?reject(new Error('Container photo archive failed: '+stderr)):done());}),new Promise((done,reject)=>{stream.once('finish',done);stream.once('error',reject);})]);
 }else{const result=spawnSync('tar',['-czf',archive,'-C',join(root,'data'),...folders],{windowsHide:true,stdio:'pipe'});if(result.error||result.status)throw new Error('Photo archive failed.');}
 await chmod(archive,0o600);uploadsSha256=createHash('sha256').update(await readFile(archive)).digest('hex');
}
await writeFile(join(dir,name+'.json'),JSON.stringify({version:1,createdAt:new Date().toISOString(),database:name+'.dump',sha256:hash,uploads,uploadsSha256,folders,scope:'local-development',source},null,2),{mode:0o600});
console.log('Backup created: data/backups/'+name+'.json');
