const {spawn}=require('node:child_process');
const {resolve}=require('node:path');
process.loadEnvFile(resolve('.env'));
require('./local-test-mode.cjs').assertLocalTestMode();
(async()=>{
 const entry=resolve('apps/api/dist/main.js');
 const server=spawn(process.execPath,[entry],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'development',API_PORT:'4001'},stdio:'ignore',windowsHide:true});
 try{
  let healthy=false;
  for(let attempt=0;attempt<60;attempt++){try{const response=await fetch('http://127.0.0.1:4001/api/v1/health');const body=await response.json();if(response.ok&&body.database==='postgresql-postgis'){healthy=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}
  if(!healthy)throw new Error('Executable API did not become healthy');console.log('Executable API bundle started and connected to PostgreSQL/PostGIS and Redis.');
 }finally{const closed=new Promise(resolve=>server.once('exit',resolve));server.kill();await closed;}
 const blocked=spawn(process.execPath,[entry],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'production',API_PORT:'4001',ALLOW_MOCK_IN_PRODUCTION:'false',PAYMENT_PROVIDER:'mock'},stdio:['ignore','ignore','pipe'],windowsHide:true});
 let stderr='';blocked.stderr.on('data',chunk=>stderr+=chunk.toString());const code=await new Promise(resolve=>blocked.once('exit',resolve));
 if(!code||!stderr.includes('Production blocked'))throw new Error('Production mock safety guard did not reject startup');
 console.log('Production safety guard correctly rejected mock/console/demo providers.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
