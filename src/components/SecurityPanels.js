/* eslint-disable react-hooks/exhaustive-deps, no-unused-vars */
import React, { useState, useEffect } from "react";
import { T } from "../lib/theme";
import { useStore, fbWrite } from "../lib/store";
import { db } from "../firebase";
import { ref, onValue, set as fbSet, get as fbGet, remove as fbRemove, query, orderByKey, startAt, endAt } from "firebase/database";
import { SESSION_TTL } from "../lib/auth";
/* global PublicKeyCredential */
import { safeArr, ts, uid, today } from "../lib/utils";
import { hashPw, checkPw, DEVICE_ID, getDeviceInfo } from "../lib/auth";
import { Btn, Inp, Card, Hr, Sheet, Tog, Pill } from "./ui";

function PasskeyManager({dm,t,sess,notify,ask,addLog}){
  const storedPk=(()=>{try{return JSON.parse(localStorage.getItem("__crm_pk__")||"null");}catch{return null;}})();
  const [pkStatus,setPkStatus]=useState(storedPk?"registered":"none");
  async function registerPasskey(){
    if(!window.PublicKeyCredential){notify("Passkeys not supported on this browser/device");return;}
    try{
      const available=await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(()=>false);
      if(!available){notify("No biometric authenticator found on this device");return;}
      const challenge=new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const cred=await navigator.credentials.create({publicKey:{challenge,rp:{name:"TAS Healthy World CRM",id:window.location.hostname},user:{id:new TextEncoder().encode(sess.id||"user"),name:sess.username||"user",displayName:sess.name||"User"},pubKeyCredParams:[{type:"public-key",alg:-7},{type:"public-key",alg:-257}],authenticatorSelection:{authenticatorAttachment:"platform",userVerification:"required",requireResidentKey:false},timeout:60000}});
      if(cred){
        const credId=btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
        localStorage.setItem("__crm_pk__",JSON.stringify({credId,userId:sess.id,registeredAt:Date.now()}));
        // Write to Firebase so admin can see all passkey-registered devices
        const dev=getDeviceInfo();
        fbWrite("tas_passkey_devices/"+DEVICE_ID,{credId,userId:sess.id,userName:sess.name||sess.username,deviceId:DEVICE_ID,deviceLabel:`${dev.deviceType} · ${dev.browser} on ${dev.os}`,browser:dev.browser,os:dev.os,deviceType:dev.deviceType,screenRes:dev.screenRes,registeredAt:Date.now()}).catch(()=>{});
        setPkStatus("registered");
        addLog("Passkey registered","Biometric login enabled for this device");
        notify("✓ Passkey registered! You can now use Face ID / fingerprint to sign in.");
      }
    }catch(e){
      if(e.name==="NotAllowedError")notify("Biometric setup was cancelled.");
      else notify("Error: "+e.message);
    }
  }
  function removePasskey(){
    ask("Remove passkey from this device? You will need to use password login.",()=>{
      localStorage.removeItem("__crm_pk__");
      fbRemove(ref(db,"tas_passkey_devices/"+DEVICE_ID)).catch(()=>{});
      setPkStatus("none");
      addLog("Passkey removed","Biometric login disabled for this device");
      notify("Passkey removed");
    });
  }
  return <div>
    <div style={{background:pkStatus==="registered"?"#10b98110":"#3b82f610",border:`1.5px solid ${pkStatus==="registered"?"#10b98130":"#3b82f630"}`,borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
      <span style={{fontSize:24}}>{pkStatus==="registered"?"✅":"🔑"}</span>
      <div style={{flex:1}}>
        <p style={{color:pkStatus==="registered"?"#10b981":"#3b82f6",fontWeight:700,fontSize:13}}>{pkStatus==="registered"?"Passkey registered on this device":"No passkey on this device"}</p>
        <p style={{color:t.sub,fontSize:11,marginTop:2}}>{pkStatus==="registered"?"You can sign in with Face ID, fingerprint, or Windows Hello":"Register a passkey to enable biometric login"}</p>
      </div>
    </div>
    {pkStatus==="registered"
      ?<div style={{display:"flex",gap:8}}>
        <button onClick={registerPasskey} style={{flex:1,background:t.inp,border:`1.5px solid ${t.border}`,color:t.text,borderRadius:10,padding:"10px",fontSize:13,fontWeight:600,cursor:"pointer"}}>🔄 Re-register</button>
        <button onClick={removePasskey} style={{flex:1,background:"#ef444415",border:"1.5px solid #ef444430",color:"#ef4444",borderRadius:10,padding:"10px",fontSize:13,fontWeight:600,cursor:"pointer"}}>🗑 Remove</button>
      </div>
      :<button onClick={registerPasskey} style={{width:"100%",background:"#3b82f6",color:"#fff",border:"none",borderRadius:10,padding:"12px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 10V2"/><path d="M8 6l4-4 4 4"/><rect x="2" y="12" width="20" height="10" rx="2"/></svg>
        Register Passkey for This Device
      </button>}
  </div>;
}

// ─────────────────────────────────────────────────────────────────────────────
//  EXPORTS — consumed by CRM_top.js and CRM_bottom.js
// ─────────────────────────────────────────────────────────────────────────────


// SecuritySessions — proper component so hooks are legal
// ─────────────────────────────────────────────────────────────
function SecuritySessions({dm,t,ask,addLog,notify}){
  const [liveSessions,setLiveSessions]=useState([]);
  const [passkeyDevices,setPasskeyDevices]=useState([]);
  const [locMap,setLocMap]=useState({});

  // Load passkey registrations from Firebase
  useEffect(()=>{
    const r=ref(db,"tas_passkey_devices");
    const unsub=onValue(r,(snap)=>{
      if(!snap.exists()){setPasskeyDevices([]);return;}
      const raw=snap.val()||{};
      const list=Object.values(raw).sort((a,b)=>(b.registeredAt||0)-(a.registeredAt||0));
      setPasskeyDevices(list);
    });
    return()=>unsub();
  },[]);

  // Reverse-geocode a lat/lng to a human readable address
  async function reverseGeocode(lat,lng,key){
    if(!lat||!lng)return;
    try{
      const res=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,{headers:{"Accept-Language":"en"}});
      const j=await res.json();
      const addr=j.address||{};
      const parts=[addr.suburb||addr.neighbourhood||addr.village,addr.city||addr.town||addr.county,addr.state,addr.country].filter(Boolean);
      setLocMap(m=>({...m,[key]:parts.slice(0,3).join(", ")||`${lat.toFixed(4)}, ${lng.toFixed(4)}`}));
    }catch{
      setLocMap(m=>({...m,[key]:`${lat.toFixed(4)}, ${lng.toFixed(4)}`}));
    }
  }

  useEffect(()=>{
    // Scoped query — only reads keys in the "tas9_sess_" namespace instead of the entire DB.
    // Prevents a full-database read on every change, which would grow unbounded with more data.
    const sessQuery=query(ref(db),orderByKey(),startAt("tas9_sess_"),endAt("tas9_sess_"));
    const unsub=onValue(sessQuery,(snap)=>{
      if(!snap.exists())return;
      const val=snap.val()||{};
      const now=Date.now();
      const sessions=Object.entries(val)
        .filter(([k])=>k.startsWith("tas9_sess_"))
        .map(([k,v])=>{
          const s=(v&&v.v!==undefined)?v.v:v;
          if(!s||!s.loginAt)return null;
          const age=now-s.loginAt;
          if(age>SESSION_TTL*1.5)return null;
          return{
            deviceKey:k,
            isMe:k==="tas9_sess_"+DEVICE_ID,
            name:s.displayOverride||s.name||"Unknown",
            username:s.username||"—",
            role:s.role||"—",
            browser:s.browser||"Unknown",
            os:s.os||"Unknown",
            deviceType:s.deviceType||"Desktop",
            screenRes:s.screenRes||"—",
            tz:s.tz||"—",
            lang:s.lang||"—",
            ua:s.ua||"",
            passkeyLogin:s.passkeyLogin||false,
            lat:s.lat||null,
            lng:s.lng||null,
            locationLabel:s.locationLabel||null,
            loginAt:s.loginAt,
            loginAtLabel:new Date(s.loginAt).toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}),
            lastSeen:age<60000?"Just now":age<3600000?`${Math.floor(age/60000)}m ago`:`${Math.floor(age/3600000)}h ago`,
          };
        }).filter(Boolean).sort((a,b)=>b.loginAt-a.loginAt);
      setLiveSessions(sessions);
      // Reverse-geocode any sessions with lat/lng
      sessions.forEach(s=>{
        if(s.lat&&s.lng&&!locMap[s.deviceKey]){
          reverseGeocode(s.lat,s.lng,s.deviceKey);
        }
      });
    });
    return()=>unsub();
  },[]);

  const deviceIcon=(d)=>d==="Mobile"?"📱":d==="Tablet"?"📟":"💻";
  const browserIcon=(b)=>b==="Chrome"?"🟡":b==="Firefox"?"🦊":b==="Safari"?"🧭":b==="Edge"?"🔵":b==="Opera"?"🔴":b==="Brave"?"🦁":"🌐";
  const osIcon=(o)=>o==="Android"?"🤖":o==="iOS"||o==="iPadOS"?"🍎":o==="Windows"?"🪟":o==="macOS"?"🍎":o==="Linux"?"🐧":"💻";

  return<Card dm={dm}><div className="p-4">
    <div className="flex items-center justify-between mb-3">
      <div>
        <p style={{color:t.text,fontWeight:700,fontSize:14}}>🛡️ Active Sessions</p>
        <p style={{color:t.sub,fontSize:11,marginTop:2}}>{liveSessions.length} device{liveSessions.length!==1?"s":""} currently logged in</p>
      </div>
      <button onClick={()=>ask("Force logout all OTHER devices? Your current session will remain active.",async()=>{
        // Scoped fetch — only reads session keys instead of the entire database
        const sessQ=query(ref(db),orderByKey(),startAt("tas9_sess_"),endAt("tas9_sess_"));
        const snap=await fbGet(sessQ).catch(()=>null);
        if(!snap||!snap.exists())return;
        const all=Object.keys(snap.val()||{}).filter(k=>k.startsWith("tas9_sess_")&&k!=="tas9_sess_"+DEVICE_ID);
        for(const k of all) await fbRemove(ref(db,k)).catch(()=>{});
        addLog("Force-logged out all other devices","Security action by admin");
        notify("All other devices logged out ✓");
      })} style={{background:"#ef444415",color:"#ef4444",border:"1px solid #ef444430",borderRadius:9,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
        🔴 Logout All Others
      </button>
    </div>
    {liveSessions.length===0?<p style={{color:t.sub,fontSize:12,textAlign:"center",padding:"20px 0"}}>No active sessions found.</p>
    :liveSessions.map(s=>{
      const locLabel=s.locationLabel||(s.lat&&s.lng?locMap[s.deviceKey]||`${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}`:"Location not available");
      const mapsUrl=s.lat&&s.lng?`https://maps.google.com/?q=${s.lat},${s.lng}`:`https://maps.google.com/?q=${encodeURIComponent(locLabel||"")}`;
      return(
      <div key={s.deviceKey} style={{background:s.isMe?(dm?"rgba(16,185,129,0.08)":"rgba(16,185,129,0.05)"):t.inp,border:`1.5px solid ${s.isMe?"#10b98140":t.border}`,borderRadius:14,padding:"14px 16px",marginBottom:10}}>
        <div className="flex items-start justify-between gap-3">
          <div style={{display:"flex",gap:12,flex:1,minWidth:0}}>
            <div style={{fontSize:32,flexShrink:0,lineHeight:1,marginTop:2}}>{deviceIcon(s.deviceType)}</div>
            <div style={{flex:1,minWidth:0}}>
              {/* Row 1: Name + badges */}
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:4}}>
                <span style={{color:t.text,fontWeight:700,fontSize:14}}>{s.name}</span>
                {s.isMe&&<span style={{background:"#10b98120",color:"#10b981",fontSize:9,fontWeight:800,padding:"2px 8px",borderRadius:99}}>● THIS DEVICE</span>}
                <span style={{background:s.role==="admin"?"#f59e0b20":s.role==="factory"?"#8b5cf620":"#0ea5e920",color:s.role==="admin"?"#f59e0b":s.role==="factory"?"#8b5cf6":"#0ea5e9",fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:99,textTransform:"uppercase"}}>{s.role}</span>
                {s.passkeyLogin&&<span style={{background:"#3b82f620",color:"#3b82f6",fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:99}}>🔑 Passkey</span>}
              </div>
              {/* Row 2: Username */}
              <p style={{color:t.sub,fontSize:11,marginBottom:4}}>@{s.username}</p>
              {/* Row 3: Browser + OS */}
              <div style={{display:"flex",flexWrap:"wrap",gap:"4px 12px",marginBottom:3}}>
                <span style={{color:t.sub,fontSize:11}}>{browserIcon(s.browser)} {s.browser}</span>
                <span style={{color:t.sub,fontSize:11}}>{osIcon(s.os)} {s.os} · {s.deviceType}</span>
                <span style={{color:t.sub,fontSize:11}}>🖥 {s.screenRes}</span>
                <span style={{color:t.sub,fontSize:11}}>🌍 {s.tz}</span>
                {s.lang&&s.lang!=="—"&&<span style={{color:t.sub,fontSize:11}}>🗣 {s.lang}</span>}
              </div>
              {/* Row 4: Login time + last seen */}
              <div style={{display:"flex",flexWrap:"wrap",gap:"4px 12px",marginBottom:4}}>
                <span style={{color:t.sub,fontSize:11}}>🕐 Logged in: {s.loginAtLabel}</span>
                <span style={{color:t.sub,fontSize:11}}>⏱ {s.lastSeen}</span>
              </div>
              {/* Row 5: Location */}
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                <span style={{fontSize:11,color:s.lat?t.text:t.sub}}>📍 {locLabel}</span>
                {s.lat&&s.lng&&<a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                  style={{fontSize:10,color:"#3b82f6",fontWeight:700,background:"#3b82f615",padding:"2px 8px",borderRadius:99,textDecoration:"none"}}>Open Map</a>}
              </div>
              {/* UA string (collapsed) */}
              {s.ua&&<p style={{color:t.sub,fontSize:9,marginTop:4,opacity:0.6,wordBreak:"break-all",fontFamily:"monospace"}}>{s.ua.slice(0,100)}{s.ua.length>100?"…":""}</p>}
            </div>
          </div>
          {!s.isMe&&<button onClick={()=>ask(`Log out ${s.name}'s session on ${s.os}?`,async()=>{
            await fbRemove(ref(db,s.deviceKey)).catch(()=>{});
            addLog("Force-logged out session",`${s.name} (${s.os} ${s.browser})`);
            notify("Session terminated ✓");
          })} style={{background:"#ef444415",color:"#ef4444",border:"1px solid #ef444430",borderRadius:9,padding:"6px 10px",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0,marginTop:4}}>
            Log Out
          </button>}
        </div>
      </div>
    );})}

    {/* Passkey-registered devices */}
    {passkeyDevices.length>0&&<>
      <div style={{borderTop:`1.5px solid ${t.border}`,margin:"16px 0 12px"}}/>
      <p style={{color:t.text,fontWeight:700,fontSize:13,marginBottom:8}}>🔑 Devices with Passkey Registered ({passkeyDevices.length})</p>
      {passkeyDevices.map((pk,i)=>(
        <div key={i} style={{background:t.inp,border:`1.5px solid ${t.border}`,borderRadius:12,padding:"10px 14px",marginBottom:6,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20}}>🔑</span>
          <div style={{flex:1}}>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              <span style={{color:t.text,fontWeight:700,fontSize:12}}>{pk.userName||pk.userId||"Unknown User"}</span>
              {pk.deviceLabel&&<span style={{color:t.sub,fontSize:11}}>{pk.deviceLabel}</span>}
              <span style={{background:"#8b5cf620",color:"#8b5cf6",fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:99}}>Passkey</span>
            </div>
            <p style={{color:t.sub,fontSize:10,marginTop:2}}>
              {pk.browser&&<span>{browserIcon(pk.browser)} {pk.browser} · </span>}
              {pk.os&&<span>{pk.os} · </span>}
              Registered: {pk.registeredAt?new Date(pk.registeredAt).toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}):"Unknown"}
            </p>
          </div>
        </div>
      ))}
    </>}
  </div></Card>;
}


function FailedLoginAttempts({dm,t,ask,notify}){
  const [failedLogins,setFailedLogins]=useState([]);
  useEffect(()=>{
    const r=ref(db,"tas_failed_logins");
    const unsub=onValue(r,(snap)=>{
      if(!snap.exists()){setFailedLogins([]);return;}
      const raw=snap.val()||{};
      const list=Object.values(raw).sort((a,b)=>(b.loginAt||0)-(a.loginAt||0)).slice(0,50);
      setFailedLogins(list);
    });
    return()=>unsub();
  },[]);
  if(failedLogins.length===0)return null;
  return <Card dm={dm}><div className="p-4">
    <div className="flex items-center justify-between mb-3">
      <div>
        <p style={{color:"#ef4444",fontWeight:700,fontSize:14}}>⚠️ Failed Login Attempts</p>
        <p style={{color:t.sub,fontSize:11,marginTop:1}}>{failedLogins.length} failed attempt{failedLogins.length!==1?"s":""} recorded</p>
      </div>
      <button onClick={()=>ask("Clear all failed login records?",()=>{fbRemove(ref(db,"tas_failed_logins")).catch(()=>{});setFailedLogins([]);notify("Cleared ✓");})}
        style={{color:"#ef4444",fontSize:11,fontWeight:700,background:"none",border:"none",cursor:"pointer"}}>Clear</button>
    </div>
    {failedLogins.slice(0,20).map((l,i)=>(
      <div key={i} style={{borderBottom:`1px solid ${t.border}`,padding:"7px 0"}} className="last:border-0">
        <div className="flex items-center justify-between gap-2">
          <span style={{color:"#ef4444",fontSize:12,fontWeight:600}}>@{l.username||"(unknown)"}</span>
          <span style={{color:t.sub,fontSize:10}}>{l.ts}</span>
        </div>
        <div className="flex gap-x-3 flex-wrap mt-0.5">
          {l.browser&&<span style={{color:t.sub,fontSize:9}}>🌐 {l.browser}</span>}
          {l.os&&<span style={{color:t.sub,fontSize:9}}>💻 {l.os}</span>}
          {l.deviceType&&<span style={{color:t.sub,fontSize:9}}>📱 {l.deviceType}</span>}
        </div>
      </div>
    ))}
  </div></Card>;
}



export { PasskeyManager, SecuritySessions, FailedLoginAttempts };
