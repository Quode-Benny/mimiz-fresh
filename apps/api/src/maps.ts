import {z} from 'zod';
import type Redis from 'ioredis';
import type {GeocodingProvider} from '@mimiz/providers';
import {fail,hash} from './security';
export class MapsService{
 constructor(private provider:GeocodingProvider,private redis:Redis){}
 async search(query:unknown){
  const q=z.string().trim().min(3).max(120).parse(query);
  const cache='mimiz-fresh:geocode:'+this.provider.name+':'+hash(q.toLowerCase());
  const saved=await this.redis.get(cache);if(saved)return JSON.parse(saved);
  // A single shared gate covers all users and API replicas. Searches are explicit,
  // never autocomplete. Use another configured provider for production volume.
  if(this.provider.name==='osm'&&!await this.redis.set('mimiz-fresh:geocoder-gate','1','PX',1100,'NX'))fail(429,'Address search is busy. Please try again in a moment.');
  try{const places=await this.provider.search(q);await this.redis.set(cache,JSON.stringify(places),'EX',86400);return places;}catch{fail(503,'Address search is unavailable right now. You can still drop a pin on the map.');}
 }
}
