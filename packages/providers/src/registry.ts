import {ConsoleSmsProvider,ConsoleEmailProvider,ArkeselSmsProvider,HubtelSmsProvider,ResendEmailProvider,type MessageOutbox,type SmsProvider,type EmailProvider} from './messaging';
import {OsmGeocodingProvider,GoogleGeocodingProvider,HaversineRoutingProvider,GoogleRoutingProvider,type GeocodingProvider,type RoutingProvider} from './maps';
export function createServiceProviders(env:Record<string,string|undefined>,outbox:MessageOutbox,log:(value:unknown)=>void=()=>{}){
 const required=(key:string)=>{const value=env[key];if(!value)throw new Error(key+' is required for the selected provider.');return value;};
 let sms:SmsProvider,email:EmailProvider,geocoding:GeocodingProvider,routing:RoutingProvider;
 switch(env.SMS_PROVIDER||'console'){case 'console':sms=new ConsoleSmsProvider(outbox,log);break;case 'arkesel':sms=new ArkeselSmsProvider(required('ARKESEL_API_KEY'));break;case 'hubtel':sms=new HubtelSmsProvider(required('HUBTEL_CLIENT_ID'),required('HUBTEL_CLIENT_SECRET'),required('HUBTEL_SMS_URL'));break;default:throw new Error('Unsupported SMS_PROVIDER.');}
 switch(env.EMAIL_PROVIDER||'console'){case 'console':email=new ConsoleEmailProvider(outbox,log);break;case 'resend':email=new ResendEmailProvider(required('RESEND_API_KEY'));break;default:throw new Error('Unsupported EMAIL_PROVIDER.');}
 switch(env.MAPS_PROVIDER||'osm'){case 'osm':geocoding=new OsmGeocodingProvider(env.GEOCODING_USER_AGENT||'MimizFresh-local-demo/1.0 (Ghana restaurant development)',env.NOMINATIM_URL||undefined);routing=new HaversineRoutingProvider(Number(env.ROUTING_ROAD_FACTOR||1.4),Number(env.ROUTING_SPEED_KMH||20));break;case 'google':geocoding=new GoogleGeocodingProvider(required('GOOGLE_MAPS_API_KEY'));routing=new GoogleRoutingProvider(required('GOOGLE_MAPS_API_KEY'));break;default:throw new Error('Unsupported MAPS_PROVIDER.');}
 return {sms,email,geocoding,routing};
}
