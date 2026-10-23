"use client";
import {useState} from 'react';
import {Search,MapPin} from 'lucide-react';
import {api} from '../lib/api';
export type SearchPlace={id:string;label:string;latitude:number;longitude:number;attribution:string};
export function AddressSearch({onSelect}:{onSelect:(place:SearchPlace)=>void}){
 const [query,setQuery]=useState(''),[places,setPlaces]=useState<SearchPlace[]|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function search(){if(query.trim().length<3)return;setBusy(true);setError('');try{setPlaces(await api<SearchPlace[]>('/maps/search?q='+encodeURIComponent(query.trim())));}catch(error:any){setError(error.message);}finally{setBusy(false);}}
 return <div className="address-search"><label>Find an area or landmark<input type="search" value={query} minLength={3} maxLength={120} onChange={event=>{setQuery(event.target.value);setPlaces(null);}} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();void search();}}} placeholder="For example, Osu or Accra Mall"/></label><button type="button" className="button" disabled={busy||query.trim().length<3} onClick={search}><Search size={15}/>{busy?'Searching...':'Search area'}</button><p className="small-note">Search only an area or public landmark, then move the pin to your door. Keep personal details in the address form.</p>{error&&<p className="inline-error" role="alert">{error}</p>}{places&&<div className="place-results">{places.length?places.map(place=><button type="button" className="button" key={place.id} onClick={()=>{onSelect(place);setPlaces(null);setQuery('');}}><span>{place.label}</span><MapPin size={16}/></button>):<p className="small-note">No matching areas found. Try another name or place a pin on the map.</p>}<small className="small-note">Search data: {places[0]?.attribution||'OpenStreetMap contributors'}</small></div>}</div>;
}
