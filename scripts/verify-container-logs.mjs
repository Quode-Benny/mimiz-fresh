import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {dockerBinary} from './docker.mjs';
function run(args){const result=spawnSync(dockerBinary(),args,{encoding:'utf8',windowsHide:true});if(result.error||result.status)throw Error('Container log verification command failed.');return result.stdout+'\n'+result.stderr;}
const id=run(['compose','-f','docker-compose.yml','-f','docker-compose.app.yml','ps','-q','api']).trim();if(!/^[a-f0-9]{12,64}$/.test(id))throw Error('Start the application API container first.');
const marker='privacy-check-'+randomUUID(),response=await fetch('http://127.0.0.1:4000/api/v1/settings?privateQuery='+marker,{headers:{authorization:'Bearer '+marker,cookie:'private_cookie='+marker}});
if(!response.ok)throw Error('Public settings request failed.');const requestId=response.headers.get('x-request-id');if(!requestId)throw Error('Request correlation header is missing.');
let record;for(let index=0;index<10;index++){const logs=run(['logs','--since','30s',id]);if(logs.includes(marker))throw Error('Private query/header sentinel entered the container logs.');record=logs.split('\n').flatMap(line=>{try{return [JSON.parse(line)];}catch{return [];}}).find(value=>value.event==='http.completed'&&value.requestId===requestId);if(record)break;await new Promise(resolve=>setTimeout(resolve,200));}
if(!record||record.route!=='/api/v1/settings'||record.status!==200||typeof record.durationMs!=='number')throw Error('Expected structured request record was not found.');
console.log('Container logging passed: correlation ID, route template, status and timing recorded; query/auth/cookie sentinels excluded.');
