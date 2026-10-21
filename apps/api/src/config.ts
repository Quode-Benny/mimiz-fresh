import { loadEnvFile } from 'node:process';
import { resolve,dirname } from 'node:path';
import {existsSync} from 'node:fs';
let candidate=__dirname;while(!existsSync(resolve(candidate,'pnpm-workspace.yaml'))&&dirname(candidate)!==candidate)candidate=dirname(candidate);
export const projectRoot=candidate;
import { z } from 'zod';
try { loadEnvFile(resolve(projectRoot,'.env')); } catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
const env=z.object({
 NODE_ENV:z.enum(['development','test','production']).default('development'),
 DATABASE_URL:z.string().url(), REDIS_URL:z.string().url(),
 API_PORT:z.coerce.number().int().min(1024).max(65535).default(4000),
 WEB_ORIGIN:z.string().url().default('http://localhost:3002'),
 JWT_SECRET:z.string().min(32), MOCK_WEBHOOK_SECRET:z.string().min(32),
 PAYMENT_PROVIDER:z.enum(['mock','paystack']).default('mock'),
 SMS_PROVIDER:z.enum(['console','hubtel']).default('console'),
 EMAIL_PROVIDER:z.enum(['console','resend']).default('console'),
 OTP_DEMO_MODE:z.enum(['true','false']).default('false'),
 ALLOW_MOCK_IN_PRODUCTION:z.enum(['true','false']).default('false'),
}).parse(process.env);
if(env.NODE_ENV==='production' && (env.PAYMENT_PROVIDER==='mock'||env.SMS_PROVIDER==='console'||env.EMAIL_PROVIDER==='console'||env.OTP_DEMO_MODE==='true') && env.ALLOW_MOCK_IN_PRODUCTION!=='true')throw new Error('Production blocked: simulated providers or demo OTP enabled.');
if(env.SMS_PROVIDER!=='console'||env.EMAIL_PROVIDER!=='console')throw new Error('Live SMS/email adapters are not yet implemented. This build supports console messaging only.');
if(env.PAYMENT_PROVIDER==='paystack'&&!process.env.PAYSTACK_SECRET_KEY)throw new Error('PAYSTACK_SECRET_KEY is required for the Paystack adapter.');
export const config={...env,onlinePayments:!(env.NODE_ENV==='production'&&env.ALLOW_MOCK_IN_PRODUCTION==='true'),demo:env.PAYMENT_PROVIDER==='mock'};
