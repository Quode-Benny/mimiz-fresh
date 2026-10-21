"use client";
import {MapContainer,TileLayer,Marker,useMapEvents,useMap} from 'react-leaflet';
import {useEffect} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
const pin=L.divIcon({className:'map-pin',html:'<span></span>',iconSize:[28,36],iconAnchor:[14,36]});
function Picker({value,onChange}:{value:[number,number]|null;onChange:(point:[number,number])=>void}){useMapEvents({click:event=>onChange([event.latlng.lat,event.latlng.lng])});const map=useMap();useEffect(()=>{if(value)map.panTo(value);},[value,map]);return value?<Marker position={value} icon={pin}/>:null;}
export default function PinPicker({value,onChange}:{value:[number,number]|null;onChange:(point:[number,number])=>void}){return <MapContainer center={[5.556,-0.187]} zoom={14} className="pin-map"><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'/><Picker value={value} onChange={onChange}/></MapContainer>;}
