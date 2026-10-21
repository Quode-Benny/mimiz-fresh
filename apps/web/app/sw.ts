import {defaultCache} from '@serwist/next/worker';
import {Serwist,NetworkOnly,StaleWhileRevalidate,ExpirationPlugin,type PrecacheEntry,type SerwistGlobalConfig} from 'serwist';
declare global {interface WorkerGlobalScope extends SerwistGlobalConfig {__SW_MANIFEST:(PrecacheEntry|string)[]|undefined;}}
declare const self:ServiceWorkerGlobalScope;
const privatePaths=/^\/(checkout|orders|login|mock-pay|account|staff|admin|rider|dev)(\/|$)/;
const worker=new Serwist({
 precacheEntries:self.__SW_MANIFEST,skipWaiting:true,clientsClaim:true,navigationPreload:true,
 runtimeCaching:[
 {matcher:({url})=>((url.pathname.startsWith('/api/v1/')&&!url.pathname.startsWith('/api/v1/branches'))||privatePaths.test(url.pathname)),handler:new NetworkOnly()},
 {matcher:({url})=>/^\/api\/v1\/branches(\/|$)/.test(url.pathname),handler:new StaleWhileRevalidate({cacheName:'mimiz-public-menu-v1',plugins:[new ExpirationPlugin({maxEntries:12,maxAgeSeconds:3600})]})},
 ...defaultCache,
 ],fallbacks:{entries:[{url:'/offline',matcher:({request})=>request.destination==='document'}]},
});
worker.addEventListeners();
