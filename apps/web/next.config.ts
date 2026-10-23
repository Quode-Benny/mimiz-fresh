import type {NextConfig} from 'next';
import withSerwistInit from '@serwist/next';
const withSerwist=withSerwistInit({swSrc:'app/sw.ts',swDest:'public/sw.js',disable:process.env.NODE_ENV==='development',additionalPrecacheEntries:[{url:'/offline',revision:'mimiz-offline-v1'}]});
const config:NextConfig={
 output:process.platform==='win32'?undefined:'standalone',distDir:process.env.NODE_ENV==='development'?'.next-dev':'.next',
 transpilePackages:['@mimiz/ui','@mimiz/shared','@mimiz/domain'],devIndicators:false,
 async rewrites(){return [{source:'/api/v1/:path*',destination:(process.env.API_ORIGIN||'http://127.0.0.1:4000')+'/api/v1/:path*'}];},
};
export default withSerwist(config);
