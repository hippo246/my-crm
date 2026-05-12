/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from "react";

function GPSMap({dm,logs,actionMeta,fallbackLat,fallbackLng}){
  const mapRef=useRef(null);
  const leafRef=useRef(null);
  const markersRef=useRef([]);
  const [leafReady,setLeafReady]=useState(typeof window!=="undefined"&&!!window.L);

  // Load Leaflet CSS + JS from CDN once
  useEffect(()=>{
    if(typeof window==="undefined") return;
    if(window.L){setLeafReady(true);return;}
    // Script already injected (e.g. hot-reload) — wait for it to finish
    const existing=document.getElementById("leaflet-js");
    if(existing){
      existing.addEventListener("load",()=>setLeafReady(true),{once:true});
      return;
    }
    const css=document.createElement("link");
    css.id="leaflet-css";css.rel="stylesheet";
    css.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const js=document.createElement("script");
    js.id="leaflet-js";
    js.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    js.async=true;
    js.onload=()=>setLeafReady(true);
    js.onerror=()=>console.warn("Leaflet CDN failed to load");
    document.head.appendChild(js);
  },[]);

  // Init map once Leaflet ready — rebuild when dark mode changes so tile layer updates
  useEffect(()=>{
    if(!leafReady||!mapRef.current) return;
    try{
      if(leafRef.current){leafRef.current.remove();leafRef.current=null;}
      const L=window.L; if(!L) return;
      const map=L.map(mapRef.current,{zoomControl:true,attributionControl:false})
        .setView([fallbackLat||15.4909,fallbackLng||73.8278],12);
      L.tileLayer(dm
        ?"https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        :"https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {maxZoom:19}
      ).addTo(map);
      leafRef.current=map;
    }catch(e){console.warn("Leaflet map init failed:",e);}
    return()=>{try{if(leafRef.current){leafRef.current.remove();leafRef.current=null;}}catch{}}
  },[leafReady,dm,fallbackLat,fallbackLng]);// eslint-disable-line

  // Re-render pins whenever logs change
  useEffect(()=>{
    const L=window.L; if(!L||!leafRef.current) return;
    const map=leafRef.current;
    // Clear old markers
    markersRef.current.forEach(m=>m.remove());
    markersRef.current=[];
    if(!logs||logs.length===0) return;
    logs.forEach(log=>{
      const meta=(actionMeta||{})[log.action]||{color:"#6b7280",icon:"📍",label:log.action};
      const icon=L.divIcon({
        className:"",
        html:`<div title="${log.agentName} — ${meta.label}" style="position:relative">
          <div style="width:16px;height:16px;border-radius:50%;background:${meta.color};border:3px solid #fff;box-shadow:0 2px 8px #0005;"></div>
          <div style="position:absolute;top:-1px;left:-1px;width:18px;height:18px;border-radius:50%;border:2px solid ${meta.color};opacity:0.4;"></div>
        </div>`,
        iconSize:[16,16],iconAnchor:[8,8]
      });
      const speedStr=log.speed!=null?`<br/>💨 ${log.speed} km/h`:"";
      const headingStr=log.heading!=null?` · ${log.heading}°`:"";
      const popup=`<div style="font-family:system-ui,sans-serif;min-width:180px">
        <p style="font-weight:800;font-size:13px;margin:0 0 4px">${log.agentName}</p>
        <span style="background:${meta.color}22;color:${meta.color};padding:2px 8px;border-radius:5px;font-weight:700;font-size:11px">${meta.icon} ${meta.label}</span>
        ${log.customer?`<p style="margin:6px 0 0;font-size:12px">📦 ${log.customer}</p>`:""}
        <p style="margin:6px 0 0;font-size:11px;color:#6b7280">📅 ${log.tsDisplay}</p>
        <p style="margin:2px 0 0;font-size:11px;color:#6b7280">📍 ${log.lat.toFixed(5)}, ${log.lng.toFixed(5)}</p>
        <p style="margin:2px 0 0;font-size:11px;color:#6b7280">🎯 ±${log.acc}m accuracy${headingStr}${speedStr}</p>
        <a href="https://maps.google.com/?q=${log.lat},${log.lng}" target="_blank" style="display:inline-block;margin-top:8px;background:#0ea5e9;color:#fff;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700;text-decoration:none">Open in Maps ↗</a>
      </div>`;
      const marker=L.marker([log.lat,log.lng],{icon})
        .bindPopup(popup,{maxWidth:240})
        .addTo(map);
      markersRef.current.push(marker);
    });
    const coords=logs.map(l=>[l.lat,l.lng]);
    // Cap single-pin zoom at 15 — zoom 18 is individual-building level which is too close for one ping.
    const zoomCap=coords.length===1?15:18;
    try{map.fitBounds(L.latLngBounds(coords),{padding:[40,40],maxZoom:zoomCap});}catch{}
  },[logs,actionMeta]);// eslint-disable-line

  return <div ref={mapRef} style={{width:"100%",height:420,borderRadius:12,overflow:"hidden",background:dm?"#1a1a2e":"#e8f4f8"}}>
    {!leafReady&&<div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <p style={{color:"#6b7280",fontSize:13}}>Loading map…</p>
    </div>}
  </div>;
}

// ═══════════════════════════════════════════════════════════════
//  WeatherWidget — extracted so hooks are at component top-level
// ═══════════════════════════════════════════════════════════════

export { GPSMap };
