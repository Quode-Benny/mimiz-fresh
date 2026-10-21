const {createRequire}=require('node:module');
const {resolve}=require('node:path');
process.loadEnvFile(resolve(__dirname,'../.env'));
if(process.env.NODE_ENV==='production')throw new Error('Test reset is disabled in production');
const requireApi=createRequire(resolve(__dirname,'../apps/api/package.json'));
const Redis=requireApi('ioredis');
const redis=new Redis(process.env.REDIS_URL,{maxRetriesPerRequest:1,connectTimeout:5000});
(async()=>{const keys=await redis.keys('mimiz-fresh:limit:*');if(keys.length)await redis.del(...keys);await redis.quit();console.log('Reset only local mimiz-fresh test rate counters.');})().catch(error=>{console.error(error.message);redis.disconnect();process.exitCode=1;});
