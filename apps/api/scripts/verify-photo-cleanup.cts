import {Database} from '../src/database/database';
import {drainPhotoDeletions} from '../src/storage';
import {config,projectRoot} from '../src/config';
import {mkdir,rmdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
async function main(){
if(config.NODE_ENV==='production'||(process.env.STORAGE_PROVIDER&&process.env.STORAGE_PROVIDER!=='local'))throw Error('Cleanup rehearsal requires local development storage.');
const target='mimiz_storage_'+Date.now();if(!/^mimiz_storage_[0-9]+$/.test(target))throw Error('Unexpected rehearsal database.');
const admin=new Database(),original=process.env.DATABASE_URL!,url=new URL(original);url.pathname='/'+target;
const id=randomUUID(),key='chat/'+id+'.webp',folder=resolve(projectRoot,'data/chat',id+'.webp');let isolated:Database|undefined,created=false;
try{
 await admin.query('CREATE DATABASE '+target);created=true;
 process.env.DATABASE_URL=url.toString();isolated=new Database();process.env.DATABASE_URL=original;
 await isolated.query(await readFile(resolve(projectRoot,'apps/api/src/database/008_photo_deletions.sql'),'utf8'));
 await mkdir(resolve(projectRoot,'data/chat'),{recursive:true});await mkdir(folder);
 await isolated.query('INSERT INTO photo_deletions(key) VALUES($1)',[key]);
 await drainPhotoDeletions(isolated);
 const pending=(await isolated.query('SELECT attempts,next_attempt_at>now() AS deferred FROM photo_deletions WHERE key=$1',[key]))[0];
 if(pending?.attempts!==1||!pending.deferred)throw Error('Failed file deletion was not retained with backoff.');
 await rmdir(folder);
 await isolated.query('UPDATE photo_deletions SET next_attempt_at=now() WHERE key=$1',[key]);await drainPhotoDeletions(isolated);
 if((await isolated.query('SELECT key FROM photo_deletions')).length)throw Error('Successful idempotent retry did not clear the outbox.');
 console.log('Photo cleanup rehearsal passed: a real filesystem failure was retained, deferred, and retried successfully in an isolated database.');
}finally{
 process.env.DATABASE_URL=original;await rmdir(folder).catch(error=>{if(error.code!=='ENOENT')throw error;});
 if(isolated)await isolated.close();if(created)await admin.query('DROP DATABASE '+target);await admin.close();
}

}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
