import {createPhotoStorage} from '@mimiz/providers';
import {resolve} from 'node:path';
import {projectRoot} from './config';
export const photoStorage=createPhotoStorage(process.env,resolve(projectRoot,'data'));

import type {Database} from './database/database';
export async function drainPhotoDeletions(db:Database){
 for(const row of await db.query('SELECT key,attempts FROM photo_deletions WHERE next_attempt_at<=now() ORDER BY created_at LIMIT 100')){
  try{await photoStorage.remove(row.key);await db.query('DELETE FROM photo_deletions WHERE key=$1',[row.key]);}
  catch{await db.query("UPDATE photo_deletions SET attempts=attempts+1,next_attempt_at=now()+make_interval(secs=>$2) WHERE key=$1",[row.key,Math.min(86400,30*2**Math.min(row.attempts,12))]);}
 }
}
