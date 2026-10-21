import {randomBytes} from 'node:crypto';
import {access,writeFile,appendFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('..',import.meta.url));
const envPath=resolve(root,'.env');
if(!existsSync(envPath)){
 const password=randomBytes(32).toString('hex');
 await writeFile(envPath,[
  'NODE_ENV=development','API_PORT=4000','WEB_ORIGIN=http://localhost:3002',
  'POSTGRES_PASSWORD='+password,'DATABASE_URL=postgresql://mimiz:'+password+'@127.0.0.1:5433/mimiz_fresh',
  'REDIS_URL=redis://127.0.0.1:6380','JWT_SECRET='+randomBytes(48).toString('base64url'),
  'MOCK_WEBHOOK_SECRET='+randomBytes(48).toString('base64url'),
  'PAYMENT_PROVIDER=mock','SMS_PROVIDER=console','EMAIL_PROVIDER=console','OTP_DEMO_MODE=true','',
 ].join('\n'),{mode:0o600});
 console.log('Created ignored .env with generated local secrets.');
}else console.log('Kept existing .env.');
let docker=process.env.DOCKER_BIN||'docker';
if(process.platform==='win32'){
 const candidate=join(process.env.LOCALAPPDATA||'','Programs','DockerDesktop','resources','bin','docker.exe');
 if(existsSync(candidate))docker=candidate;
}
const result=spawnSync(docker,['compose','up','-d','--wait','postgres','redis'],{cwd:root,stdio:'inherit',shell:false});
if(result.error){console.error('Docker could not start. Install/start Docker Desktop or set DOCKER_BIN.');process.exit(1);}
if(result.status)process.exit(result.status);
console.log('Infrastructure is ready. Run pnpm dev. The API migrates and seeds once on startup.');
