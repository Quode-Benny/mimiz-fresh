export type Coordinates={latitude:number;longitude:number};
export type Place={id:string;label:string;latitude:number;longitude:number;attribution:string};
export interface GeocodingProvider{readonly name:string;search(query:string):Promise<Place[]>;reverse(point:Coordinates):Promise<Place|null>;}
export interface RoutingProvider{readonly name:string;estimate(from:Coordinates,to:Coordinates):Promise<{distanceM:number;durationMinutes:number;estimated:boolean}>;}
function coordinates(point:Coordinates){if(!Number.isFinite(point.latitude)||!Number.isFinite(point.longitude)||Math.abs(point.latitude)>90||Math.abs(point.longitude)>180)throw new Error('Invalid map point.');}
export function haversine(from:Coordinates,to:Coordinates){coordinates(from);coordinates(to);const radians=(degrees:number)=>degrees*Math.PI/180;const a=Math.sin(radians(to.latitude-from.latitude)/2)**2+Math.cos(radians(from.latitude))*Math.cos(radians(to.latitude))*Math.sin(radians(to.longitude-from.longitude)/2)**2;return 6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));}
export class HaversineRoutingProvider implements RoutingProvider{
 readonly name='straight-line';
 constructor(private roadFactor=1.4,private speedKmh=20){if(roadFactor<1||speedKmh<=0)throw new Error('Invalid routing settings.');}
 async estimate(from:Coordinates,to:Coordinates){const distanceM=Math.round(haversine(from,to)*this.roadFactor);return {distanceM,durationMinutes:Math.ceil(distanceM/(this.speedKmh*1000)*60),estimated:true};}
}
// Only explicit, user-submitted area searches: no autocomplete or bulk queries.
// The API wrapper must enforce the application-wide limit and cache responses.
// https://operations.osmfoundation.org/policies/nominatim/
export class OsmGeocodingProvider implements GeocodingProvider{
 readonly name='osm';
 constructor(private userAgent:string,private endpoint='https://nominatim.openstreetmap.org',private fetcher:typeof fetch=fetch){if(!userAgent.trim())throw new Error('An identifying geocoder user agent is required.');}
 private async get(path:string){const response=await this.fetcher(this.endpoint.replace(/\/$/,'')+path,{headers:{'User-Agent':this.userAgent,'Accept-Language':'en'},signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('Address search is temporarily unavailable.');return response.json() as Promise<any>;}
 private place(data:any):Place|null{const latitude=Number(data.lat),longitude=Number(data.lon);if(!data.display_name||!Number.isFinite(latitude)||!Number.isFinite(longitude)||data.address?.country_code&&data.address.country_code!=='gh')return null;return {id:String(data.osm_type||'place')+String(data.osm_id||data.place_id),label:String(data.display_name),latitude,longitude,attribution:'OpenStreetMap contributors'};}
 async search(query:string){const params=new URLSearchParams({q:query,format:'jsonv2',countrycodes:'gh',addressdetails:'1',limit:'5'});const rows=await this.get('/search?'+params);if(!Array.isArray(rows))throw new Error('Address search returned an invalid response.');return rows.flatMap(row=>{const place=this.place(row);return place?[place]:[];});}
 async reverse(point:Coordinates){coordinates(point);const data=await this.get('/reverse?'+new URLSearchParams({lat:String(point.latitude),lon:String(point.longitude),format:'jsonv2',addressdetails:'1'}));return this.place(data);}
}
// UNVERIFIED: verify API restrictions and billing with a sandbox Google project.
// https://developers.google.com/maps/documentation/geocoding/requests-geocoding
export class GoogleGeocodingProvider implements GeocodingProvider{
 readonly name='google';
 constructor(private apiKey:string,private fetcher:typeof fetch=fetch){if(!apiKey)throw new Error('GOOGLE_MAPS_API_KEY is required.');}
 private async get(params:Record<string,string>){const response=await this.fetcher('https://maps.googleapis.com/maps/api/geocode/json?'+new URLSearchParams({...params,key:this.apiKey}),{signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('Address search is temporarily unavailable.');const data:any=await response.json();if(data.status==='ZERO_RESULTS')return [];if(data.status!=='OK')throw new Error('Geocoder rejected the request.');return (data.results||[]).filter((row:any)=>row.address_components?.some((part:any)=>part.types?.includes('country')&&part.short_name==='GH')).map((row:any)=>({id:row.place_id,label:row.formatted_address,latitude:row.geometry.location.lat,longitude:row.geometry.location.lng,attribution:'Google Maps'}));}
 search(query:string){return this.get({address:query,components:'country:GH'});}
 async reverse(point:Coordinates){coordinates(point);return (await this.get({latlng:point.latitude+','+point.longitude}))[0]||null;}
}
// UNVERIFIED: Google Routes API adapter. No paid requests occur in default mode.
// https://developers.google.com/maps/documentation/routes/compute_route_directions
export class GoogleRoutingProvider implements RoutingProvider{
 readonly name='google';
 constructor(private apiKey:string,private fetcher:typeof fetch=fetch){if(!apiKey)throw new Error('GOOGLE_MAPS_API_KEY is required.');}
 async estimate(from:Coordinates,to:Coordinates){coordinates(from);coordinates(to);const response=await this.fetcher('https://routes.googleapis.com/directions/v2:computeRoutes',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':this.apiKey,'X-Goog-FieldMask':'routes.duration,routes.distanceMeters'},body:JSON.stringify({origin:{location:{latLng:from}},destination:{location:{latLng:to}},travelMode:'DRIVE',routingPreference:'TRAFFIC_UNAWARE'}),signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('Route estimate is temporarily unavailable.');const data:any=await response.json(),route=data.routes?.[0];if(!route||!Number.isFinite(route.distanceMeters)||!/^\d+(\.\d+)?s$/.test(route.duration))throw new Error('No route estimate was returned.');return {distanceM:route.distanceMeters,durationMinutes:Math.ceil(parseFloat(route.duration)/60),estimated:false};}
}
