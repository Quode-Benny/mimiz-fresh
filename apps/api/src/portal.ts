import type {FastifyRequest} from 'fastify';
import {fail} from './security';
export const portalRoles:Record<string,string[]>={customer:['customer'],staff:['super_admin','branch_manager','kitchen_staff','support_agent'],admin:['super_admin','branch_manager'],rider:['rider']};
export function requestPortal(req:Pick<FastifyRequest,'headers'>){const value=req.headers?.['x-mimiz-portal'];if(value===undefined)return null;if(typeof value!=='string'||!portalRoles[value])fail(400,'Unknown workspace.');return value as string;}
export function cookiePrefix(req:Pick<FastifyRequest,'headers'>){const portal=requestPortal(req);return !portal||portal==='customer'?'mimiz':'mimiz_'+portal;}
export function allowedPortal(role:string,portal:string|null){return !portal||portalRoles[portal]!.includes(role);}
