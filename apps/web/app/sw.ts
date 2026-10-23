import {defaultCache} from '@serwist/next/worker';
import {Serwist,NetworkOnly,NetworkFirst,ExpirationPlugin,type PrecacheEntry,type SerwistGlobalConfig} from 'serwist';
declare global {interface WorkerGlobalScope extends SerwistGlobalConfig {__SW_MANIFEST:(PrecacheEntry|string)[]|undefined;}}
declare const self:ServiceWorkerGlobalScope;
const publicMenu=/^\/api\/v1\/branches(?:\/[^/]+\/menu)?$/;
const privatePaths=/^\/(checkout|orders|login|mock-pay|account|staff|admin|rider|kitchen|dev)(\/|$)/;
const worker=new Serwist({
 precacheEntries:self.__SW_MANIFEST,skipWaiting:true,clientsClaim:true,navigationPreload:true,
 runtimeCaching:[
 {matcher:({url,request})=>(url.pathname.startsWith('/api/v1/')&&!(request.method==='GET'&&publicMenu.test(url.pathname)))||privatePaths.test(url.pathname),handler:new NetworkOnly()},
 {matcher:({url,request})=>request.method==='GET'&&publicMenu.test(url.pathname),handler:new NetworkFirst({networkTimeoutSeconds:3,cacheName:'mimiz-public-menu-v1',plugins:[new ExpirationPlugin({maxEntries:12,maxAgeSeconds:3600})]})},
 ...defaultCache,
 ],fallbacks:{entries:[{url:'/offline',matcher:({request})=>request.destination==='document'}]},
});
worker.addEventListeners();

self.addEventListener('push',event=>{
 let payload:any;try{payload=event.data?.json();}catch{return;}
 if(!payload||typeof payload.title!=='string')return;
 event.waitUntil(self.registration.showNotification(payload.title,{body:String(payload.body||''),icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',tag:String(payload.tag||'mimiz'),data:{url:typeof payload.url==='string'?payload.url:'/account'}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const path=String(event.notification.data?.url||'/account');const target=/^\/orders\/[a-f0-9-]+$/.test(path)?path:'/account';
 event.waitUntil((async()=>{for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})){const url=new URL(client.url);if(url.origin===self.location.origin&&!/^\/(staff|admin|rider|kitchen)(\/|$)/.test(url.pathname)){await client.navigate(target);await client.focus();return;}}await self.clients.openWindow(target);})());
});
