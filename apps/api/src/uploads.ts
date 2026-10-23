import {randomUUID} from 'node:crypto';
import {photoStorage} from './storage';
import {resolve} from 'node:path';
import sharp from 'sharp';
import {z} from 'zod';
import {projectRoot} from './config';
import {fail} from './security';
export const uploadRoot=resolve(projectRoot,'data/uploads');
export async function uploadImage(body:unknown){
 const {data}=z.object({data:z.string().max(2800000)}).parse(body);
 const match=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(data);if(!match)fail(400,'Choose a JPEG, PNG or WebP photo under 2 MB.');
 const buffer=Buffer.from(match[2]!,'base64');if(buffer.length>2000000)fail(400,'Choose a photo under 2 MB.');
 const decoder=sharp(buffer,{limitInputPixels:20000000,failOn:'error'});let metadata;try{metadata=await decoder.metadata();}catch{fail(400,'This photo could not be decoded. Try a different image.');}
 if(!['jpeg','png','webp'].includes(metadata.format||'')||metadata.pages&&metadata.pages>1)fail(400,'Use a still JPEG, PNG or WebP photo.');
 const id=randomUUID();
 for(const size of [320,640,1200])await photoStorage.put('uploads/'+id+'/'+size+'.webp',await sharp(buffer,{limitInputPixels:20000000}).rotate().resize({width:size,height:size,fit:'inside',withoutEnlargement:true}).webp({quality:82}).toBuffer());
 return {url:'/api/v1/uploads/'+id+'/640.webp',sizes:[320,640,1200]};
}
