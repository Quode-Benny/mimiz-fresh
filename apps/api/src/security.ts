import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { HttpException } from '@nestjs/common';
export const hash = (value:string) => createHash('sha256').update(value).digest('hex');
export const token = () => randomBytes(32).toString('base64url');
export function fail(status:number,message:string,code='REQUEST_FAILED'):never {throw new HttpException({code,message},status);}
export function sameSecret(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export type Actor={id:string;phone:string|null;email:string|null;name:string;role:string;branch_id:string|null};
export const staffRoles=['kitchen_staff','rider','support_agent','branch_manager','super_admin'];
export function branchAllowed(actor:Actor,branchId:string){return actor.role==='super_admin'||(actor.role==='support_agent'&&!actor.branch_id)||actor.branch_id===branchId;}
