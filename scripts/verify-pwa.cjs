const {chromium}=require('@playwright/test');
const {spawn}=require('node:child_process');
const {createRequire}=require('node:module');
const {resolve}=require('node:path');
const requireWeb=createRequire(resolve('apps/web/package.json'));
const nextCli=requireWeb.resolve('next/dist/bin/next');
const port=3004,origin='http://localhost:'+port;
const server=spawn(process.execPath,[nextCli,'start','--port',String(port)],{cwd:resolve('apps/web'),windowsHide:true,stdio:'ignore'});
(async()=>{
 let browser;
 try{
  for(let attempt=0;attempt<60;attempt++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,500));}
  browser=await chromium.launch();const context=await browser.newContext({serviceWorkers:'allow'});const page=await context.newPage();
  await page.goto(origin);
  await page.getByRole('button',{name:'Add Smoky Ghana jollof to bag',exact:true}).waitFor({timeout:30000});
  const manifest=await page.evaluate(async()=>fetch(document.querySelector('link[rel="manifest"]').href).then(response=>response.json()));
  if(manifest.icons.length<2)throw new Error('PWA icons missing');
  await page.evaluate(()=>Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Worker registration timed out')),20000))]));
  await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{timeout:20000});
  const cachePaths=await page.evaluate(async()=>{const urls=[];for(const name of await caches.keys()){for(const request of await (await caches.open(name)).keys())urls.push(new URL(request.url).pathname);}return urls;});
  if(cachePaths.some(path=>/^\/api\/v1\/(auth|cart|orders|checkout|mock-pay|account|staff)/.test(path)))throw new Error('Private API data entered a cache');
  const closed=new Promise(resolve=>server.once('exit',resolve));server.kill();await closed;
  await context.setOffline(true);await page.goto(origin+'/orders',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'You are offline.'}).waitFor({timeout:15000});
  await page.screenshot({path:'artifacts/screenshots/production-offline.png'});
  console.log('Production PWA passed: manifest, service worker, private-cache exclusion, and fallback after the owned server stopped.');
 }finally{server.kill();if(browser)await browser.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
