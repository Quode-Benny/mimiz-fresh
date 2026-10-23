import {spawn,spawnSync} from 'node:child_process';
import {createReadStream} from 'node:fs';
import {readFile,readdir} from 'node:fs/promises';
import {resolve,join,basename,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {dockerBinary} from './docker.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
process.loadEnvFile(join(root,'.env'));
if(process.env.NODE_ENV==='production')throw new Error('Restore rehearsal is development-only.');
const dir=resolve(root,'data/backups'),files=(await readdir(dir)).filter(name=>name.endsWith('.json')).sort();
const manifestPath=resolve(dir,process.argv[2]||files.at(-1)||'missing');
const rel=relative(dir,manifestPath);if(rel.startsWith('..')||isAbsolute(rel))throw new Error('Choose a manifest inside data/backups.');
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
if(manifest.version!==1||basename(manifest.database)!==manifest.database)throw new Error('Invalid backup manifest.');
const dump=resolve(dir,manifest.database);
if(createHash('sha256').update(await readFile(dump)).digest('hex')!==manifest.sha256)throw new Error('Backup checksum mismatch.');
const database='mimiz_rehearsal_'+Date.now();if(!/^mimiz_rehearsal_[0-9]+$/.test(database))throw new Error('Invalid rehearsal target.');
function run(args){const result=spawnSync(dockerBinary(),['compose','exec','-T','postgres',...args],{cwd:root,windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','pipe']});if(result.error||result.status)throw new Error('Rehearsal command failed: '+(result.stderr||result.error?.message));return result.stdout;}
try{
 run(['createdb','-U','mimiz',database]);
 const child=spawn(dockerBinary(),['compose','exec','-T','postgres','pg_restore','--no-owner','--exit-on-error','-U','mimiz','-d',database],{cwd:root,windowsHide:true,stdio:['pipe','ignore','pipe']});let error='';child.stderr.on('data',chunk=>error+=chunk);createReadStream(dump).pipe(child.stdin);
 await new Promise((done,reject)=>{child.once('error',reject);child.once('exit',code=>code?reject(new Error('Restore failed: '+error)):done());});
 const verification=run(['psql','-U','mimiz','-d',database,'-Atc',"SELECT count(*) FROM schema_migrations; SELECT count(*) FROM orders; SELECT count(*) FROM users; SELECT PostGIS_Version();"]);
 if(!verification.trim())throw new Error('Restored database did not validate.');
 if(manifest.uploads){if(basename(manifest.uploads)!==manifest.uploads)throw new Error('Invalid upload archive.');if(manifest.uploadsSha256&&createHash('sha256').update(await readFile(join(dir,manifest.uploads))).digest('hex')!==manifest.uploadsSha256)throw new Error('Photo archive checksum mismatch.');const check=spawnSync('tar',['-tzf',join(dir,manifest.uploads)],{windowsHide:true,encoding:'utf8'});if(check.status)throw new Error('Upload archive did not validate.');}
 console.log('Restore rehearsal passed: isolated database restored, schema/orders/users/PostGIS queried, upload archive checked. Live development database was unchanged.');
}finally{run(['dropdb','-U','mimiz','--if-exists',database]);}
