/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from "react";
import { T } from "../lib/theme";

function WeatherWidget({dm,settings}){
  const t=T(dm);
  const [wx,setWx]=useState(null);
  const [wxLoad,setWxLoad]=useState(true);
  const lat=settings?.weatherLat||15.4909;
  const lng=settings?.weatherLng||73.8278;
  const locLabel=settings?.weatherLabel||"Goa";
  useEffect(()=>{
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weathercode,windspeed_10m,relative_humidity_2m&timezone=Asia%2FKolkata`)
      .then(r=>r.json()).then(d=>{setWx(d.current);setWxLoad(false);}).catch(()=>setWxLoad(false));
  },[lat,lng]);
  const wCode=wx?.weathercode||0;
  const wIcon=wCode===0?"☀️":wCode<=3?"⛅":wCode<=48?"🌫️":wCode<=67?"🌧️":wCode<=77?"❄️":wCode<=82?"🌦️":"⛈️";
  const wDesc=wCode===0?"Clear skies":wCode<=3?"Partly cloudy":wCode<=48?"Foggy / hazy":wCode<=67?"Rain expected":wCode<=77?"Sleet/Snow":wCode<=82?"Showers":wCode<=99?"Thunderstorm":"Stormy";
  const deliveryRisk=wCode>=61?"high":wCode>=45?"moderate":"low";
  const riskColor=deliveryRisk==="high"?"#ef4444":deliveryRisk==="moderate"?"#f59e0b":"#10b981";
  return <div style={{background:dm?"linear-gradient(135deg,#0c1a2e,#111820)":"linear-gradient(135deg,#eff6ff,#f0f9ff)",border:dm?"1px solid #1e3a5f":"1px solid #bfdbfe",borderRadius:20,padding:"16px 20px"}}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[10px] font-bold text-sky-400 uppercase tracking-widest mb-1">🌤 {locLabel} Weather · Now</p>
        {wxLoad?<p style={{color:t.sub}} className="text-sm">Loading…</p>:<>
          <div className="flex items-center gap-3">
            <span style={{fontSize:36,lineHeight:1}}>{wIcon}</span>
            <div>
              <p style={{color:t.text}} className="font-black text-2xl leading-none">{wx?.temperature_2m??'—'}°C</p>
              <p style={{color:t.sub}} className="text-xs mt-0.5">{wDesc} · {wx?.windspeed_10m??'—'} km/h wind · {wx?.relative_humidity_2m??'—'}% humidity</p>
            </div>
          </div>
        </>}
      </div>
      {!wxLoad&&<div className="text-right">
        <p style={{color:riskColor}} className="text-xs font-bold uppercase tracking-wide">Delivery risk</p>
        <p style={{color:riskColor}} className="text-lg font-black capitalize">{deliveryRisk}</p>
        {deliveryRisk==="high"&&<p style={{color:t.sub}} className="text-[10px] mt-0.5">⚠️ Rain may affect routes</p>}
      </div>}
    </div>
  </div>;
}

// ═══════════════════════════════════════════════════════════════
//  CRM

// ─────────────────────────────────────────────────────────────────────────────
//  PASSKEY MANAGER — extracted from inline IIFE to fix hooks-in-callback error
// ─────────────────────────────────────────────────────────────────────────────

export { WeatherWidget };
