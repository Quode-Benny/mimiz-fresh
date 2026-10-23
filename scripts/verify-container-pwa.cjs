const {chromium}=require('@playwright/test');
const {spawnSync}=require('node:child_process');
(async()=>{
 const {dockerBinary}=await import('./docker.mjs'),docker=dockerBinary(),name='mimiz-pwa-'+Date.now(),origin='http://localhost:3004';
 if(!/^mimiz-pwa-[0-9]+$/.test(name))throw Error('Unexpected temporary container name.');
 function run(args){const result=spawnSync(docker,args,{windowsHide:true,encoding:'utf8'});if(result.error||result.status)throw Error('Owned PWA container command failed.');return result.stdout;}
 const config=await fetch('http://127.0.0.1:4000/api/v1/config',{signal:AbortSignal.timeout(5000)});if(!config.ok||(await config.json()).safeAcceptance!==true)throw Error('Container PWA acceptance requires local demo providers.');
 let created=false,browser;
 try{
  run(['compose','-f','docker-compose.yml','-f','docker-compose.app.yml','run','--no-deps','-d','--name',name,'-p','127.0.0.1:3004:3002','web']);created=true;
  let ready=false;for(let attempt=0;attempt<60;attempt++){try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}
  if(!ready)throw Error('Temporary web container did not become ready.');
  browser=await chromium.launch();const context=await browser.newContext({serviceWorkers:'allow'}),page=await context.newPage();await page.goto(origin);
  await page.getByRole('button',{name:'Add Smoky Ghana jollof to bag',exact:true}).waitFor({timeout:30000});
  const manifest=await page.evaluate(async()=>fetch(document.querySelector('link[rel="manifest"]').href).then(response=>response.json()));if(manifest.icons.length<2)throw Error('PWA icons missing.');
  await page.evaluate(()=>Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('Worker registration timed out')),20000))]));
  await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{timeout:20000});
  const paths=await page.evaluate(async()=>{const paths=[];for(const name of await caches.keys())for(const request of await (await caches.open(name)).keys())paths.push(new URL(request.url).pathname);return paths;});
  if(paths.some(path=>path.startsWith('/api/v1/')&&!/^\/api\/v1\/branches(?:\/[^/]+\/menu)?$/.test(path)))throw Error('Private API entered CacheStorage.');
  run(['stop','--time','5',name]);await context.setOffline(true);await page.goto(origin+'/orders',{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'You are offline.'}).waitFor({timeout:15000});
  await page.screenshot({path:'artifacts/screenshots/production-container-offline.png'});
  console.log('Current Docker PWA passed: manifest, worker, strict private-cache exclusion, and offline fallback after the owned container stopped.');
 }finally{if(browser)await browser.close();if(created)run(['rm','-f',name]);}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
