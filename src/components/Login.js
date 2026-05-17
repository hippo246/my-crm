import React, { useState } from "react";
import { checkPw, getDeviceInfo, DEVICE_ID } from "../lib/auth";
import { monitor, checkLoginSpike } from "../lib/monitor";
import { safeArr, uid } from "../lib/utils";
import { fbWrite } from "../lib/store";
/* global PublicKeyCredential */

function Login({users,onLogin,dm,settings}){
  const mode=settings?.staffLoginMode||"individual";
  const staffNames=settings?.staffNames||[];
  const [u,setU]=useState(""); const [p,setP]=useState(""); const [err,setErr]=useState(""); const [busy,setBusy]=useState(false);
  const [showAdminForm,setShowAdminForm]=useState(false);
  const [pinMode,setPinMode]=useState(false);
  const [pinTarget,setPinTarget]=useState(null);
  const [pinVal,setPinVal]=useState("");
  const [showPw,setShowPw]=useState(false);
  const [rememberMe,setRememberMe]=useState(true);

  const appName=settings?.appName||"TAS Healthy World";
  const appSub=settings?.appSubtitle||"Paratha Factory \u00b7 Operations";
  const appEmoji=settings?.appEmoji||"\u{1F9AB}";

  const BG="#f0f4f8";
  const BORDER="#c9d8e8";
  const MUTED="#6b8399";
  const TEXT="#0f1f33";
  const BLUE="#3b6ef6";

  const dotsBg={position:"absolute",inset:0,backgroundImage:"radial-gradient(circle, rgba(59,110,246,0.12) 1px, transparent 1px)",backgroundSize:"36px 36px",opacity:0.4};
  const glowBg={position:"absolute",inset:0,backgroundImage:"radial-gradient(ellipse 60% 50% at 30% 40%, rgba(59,110,246,0.07) 0%, transparent 70%), radial-gradient(ellipse 40% 60% at 75% 70%, rgba(180,210,240,0.4) 0%, transparent 70%)"};

  const featurePills=[
    {svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>, label:"Real-time Sync", sub:"Live updates across all operations", color:"#f59e0b"},
    {svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>, label:"Secure Access", sub:"Enterprise-grade security protection", color:"#22c55e"},
    {svg:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b6ef6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>, label:"Cloud Enabled", sub:"Access your data anytime, anywhere", color:"#3b6ef6"},
  ];

  function go(){
    if(!u.trim()||!p){setErr("Please enter your username and password.");return;}
    setBusy(true);setErr("");
    setTimeout(()=>{
      const uname=u.trim();
      const found=safeArr(users).find(x=>x.username.toLowerCase()===uname.toLowerCase()&&checkPw(p,x.password)&&x.active);
      const ctx={username:uname,...getDeviceInfo(),deviceId:DEVICE_ID};
      if(found){
        monitor.loginSuccess(ctx);
        onLogin({...found,loginAt:Date.now(),deviceId:DEVICE_ID,...getDeviceInfo(),rememberMe});
      } else {
        monitor.loginFailed(uname,ctx);
        checkLoginSpike(uname,null,settings);
        if(settings?.secLogFailedLogins!==false){
          try{const dev=getDeviceInfo();fbWrite("tas_failed_logins/"+uid(),{username:uname||"(empty)",ts:new Date().toLocaleString("en-IN"),browser:dev.browser,os:dev.os,deviceType:dev.deviceType,loginAt:Date.now()}).catch(()=>{});}catch{}
        }
        setErr("Incorrect username or password. Please try again.");
      }
      setBusy(false);
    },400);
  }

  function pickStaff(name){
    // Prefer a dedicated shared-staff account; fall back to any active non-admin only
    // if no staff_shared role exists (graceful degradation for older setups).
    const shared=
      safeArr(users).find(x=>x.active&&x.role==="staff_shared") ||
      safeArr(users).find(x=>x.active&&x.role!=="admin");
    if(shared){
      onLogin({...shared,loginAt:Date.now(),displayOverride:name,deviceId:DEVICE_ID,...getDeviceInfo(),rememberMe});
    } else {
      setErr("No active shared staff account found. Create a 'staff_shared' account in Settings.");
    }
  }

  function enterPin(digit){
    if(pinVal.length>=4)return;
    const next=pinVal+digit;
    setPinVal(next);
    if(next.length===4){
      setTimeout(()=>{
        if(pinTarget&&pinTarget.pin!=null&&pinTarget.pin===next&&pinTarget.active){onLogin({...pinTarget,loginAt:Date.now(),deviceId:DEVICE_ID,...getDeviceInfo()});}
        else if(pinTarget&&pinTarget.pin==null){setErr("PIN not configured for this account. Use password instead.");setPinVal("");}
        else{setErr("Incorrect PIN. Try again.");setPinVal("");}
      },200);
    }
  }

  // ── PASSKEY / BIOMETRIC LOGIN ──────────────────────────────────
  async function tryPasskey(){
    if(!window.PublicKeyCredential){setErr("Passkeys not supported on this device.");return;}
    try{
      // Check if platform authenticator available (Face ID / fingerprint / Windows Hello)
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(()=>false);
      if(!available){setErr("No biometric authenticator found on this device.");return;}
      // We store a passkey credential ID in localStorage keyed per device
      const storedCred = (() => { try { return JSON.parse(localStorage.getItem("__crm_pk__")||"null"); } catch { return null; } })();
      if(!storedCred){
        setErr("No passkey registered. Log in with password first, then register a passkey in Settings.");
        return;
      }
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const assertion = await navigator.credentials.get({
        publicKey:{
          challenge,
          allowCredentials:[{id:base64ToBuffer(storedCred.credId),type:"public-key"}],
          userVerification:"required",
          timeout:60000,
        }
      });
      if(assertion){
        // Credential verified — look up linked user
        const linkedUserId = storedCred.userId;
        const found = safeArr(users).find(x=>x.id===linkedUserId&&x.active);
        if(found){
          onLogin({...found,loginAt:Date.now(),deviceId:DEVICE_ID,...getDeviceInfo(),passkeyLogin:true,rememberMe});
        } else {
          setErr("Passkey user no longer exists or is deactivated.");
        }
      }
    } catch(e){
      if(e.name==="NotAllowedError") setErr("Biometric authentication was cancelled.");
      else setErr("Passkey error: "+e.message);
    }
  }

  function base64ToBuffer(b64){
    const bin=atob(b64.replace(/-/g,"+").replace(/_/g,"/"));
    const buf=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) buf[i]=bin.charCodeAt(i);
    return buf.buffer;
  }

  // Passkey state — declared before any computed values or conditional logic (Rules of Hooks)
  const [passkeyChecking, setPasskeyChecking] = useState(false);

  // Check if passkey registered for quick-login display
  const hasPasskey = !!(() => { try { return JSON.parse(localStorage.getItem("__crm_pk__")||"null"); } catch { return null; } })();

  // Shared form card content — rendered inline (NOT as a nested component) to prevent
  // React from unmounting the form on every keystroke (nested function = new component type per render)
  const formCardContent = (
      <div style={{width:"100%",maxWidth:440}}>
        <style>{`
          @keyframes lfadeup{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
          @keyframes lspin{to{transform:rotate(360deg)}}
          .lfa{animation:lfadeup 0.45s ease both}
          .lfa2{animation:lfadeup 0.45s 0.08s ease both}
          .lfa3{animation:lfadeup 0.45s 0.16s ease both}
          .lfa4{animation:lfadeup 0.45s 0.24s ease both}
          .linp{transition:border-color 0.18s!important}
          .linp:focus{border-color:${BLUE}!important;outline:none!important;box-shadow:0 0 0 3px rgba(59,110,246,0.15)!important}
          .lbtn:hover:not(:disabled){filter:brightness(1.1);box-shadow:0 6px 28px rgba(59,110,246,0.5)!important}
          .lbtn:active:not(:disabled){transform:scale(0.98)}
          .lpill:hover{border-color:${BLUE}!important;background:rgba(59,110,246,0.06)!important}
        `}</style>
        <div className="lfa" style={{display:"flex",alignItems:"center",gap:14,marginBottom:28}}>
          <div style={{width:48,height:48,borderRadius:14,background:"rgba(59,110,246,0.15)",border:"1.5px solid rgba(59,110,246,0.3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div>
            <h2 style={{color:TEXT,fontSize:24,fontWeight:800,margin:0,lineHeight:1.2,letterSpacing:"-0.01em"}}>Welcome Back!</h2>
            <p style={{color:MUTED,fontSize:15,margin:"3px 0 0",fontWeight:400}}>Sign in to continue to your account</p>
          </div>
        </div>

        <div className="lfa2" style={{marginBottom:16}}>
          <label style={{display:"block",color:"#7a9cbd",fontSize:12,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>Username</label>
          <div style={{position:"relative"}}>
            <div style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",display:"flex"}}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <input className="linp" value={u} onChange={e=>setU(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()}
              placeholder="Enter your username" autoComplete="username"
              style={{width:"100%",background:"rgba(255,255,255,0.9)",border:`1.5px solid ${BORDER}`,borderRadius:12,padding:"15px 16px 15px 50px",fontSize:17,color:TEXT,outline:"none",boxSizing:"border-box"}}/>
          </div>
        </div>

        <div className="lfa2" style={{marginBottom:16}}>
          <label style={{display:"block",color:"#7a9cbd",fontSize:12,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>Password</label>
          <div style={{position:"relative"}}>
            <div style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",display:"flex"}}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <input className="linp" value={p} onChange={e=>setP(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()}
              type={showPw?"text":"password"} placeholder="Enter your password" autoComplete="current-password"
              style={{width:"100%",background:"rgba(255,255,255,0.9)",border:`1.5px solid ${BORDER}`,borderRadius:12,padding:"15px 52px 15px 50px",fontSize:17,color:TEXT,outline:"none",boxSizing:"border-box"}}/>
            <button onClick={()=>setShowPw(v=>!v)} tabIndex={-1}
              style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",padding:6,color:MUTED,display:"flex",alignItems:"center",WebkitTapHighlightColor:"transparent"}}>
              {showPw
                ?<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                :<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
            </button>
          </div>
        </div>

        <div className="lfa3" style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:err?14:22}}>
          <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",userSelect:"none"}} onClick={()=>setRememberMe(v=>!v)}>
            <div style={{width:24,height:24,borderRadius:7,background:rememberMe?BLUE:"rgba(255,255,255,0.9)",border:`2px solid ${rememberMe?BLUE:BORDER}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>
              {rememberMe&&<svg width="13" height="11" viewBox="0 0 13 11" fill="none"><path d="M1.5 5.5l3.5 3.5 6.5-8" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <span style={{color:"#8ba3c0",fontSize:15,fontWeight:500}}>Remember me</span>
          </label>
          <span style={{color:BLUE,fontSize:15,fontWeight:500,cursor:"pointer"}} onClick={()=>setErr("Password reset is managed by your administrator.")}>Forgot password?</span>
        </div>

        {err&&<div className="lfa3" style={{background:"rgba(239,68,68,0.1)",border:"1.5px solid rgba(239,68,68,0.3)",borderRadius:12,padding:"13px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p style={{color:"#f87171",fontSize:15,fontWeight:500,margin:0}}>{err}</p>
        </div>}

        <button className="lbtn lfa3" onClick={go} disabled={busy}
          style={{width:"100%",background:`linear-gradient(135deg, ${BLUE} 0%, #2953d4 100%)`,color:"#fff",border:"none",borderRadius:14,padding:"17px 24px",fontSize:18,fontWeight:700,cursor:busy?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,transition:"all 0.2s",boxShadow:"0 4px 22px rgba(59,110,246,0.4)",letterSpacing:"0.01em",WebkitTapHighlightColor:"transparent",touchAction:"manipulation",marginBottom:22,opacity:busy?0.75:1}}>
          {busy
            ?<><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" style={{animation:"lspin 0.8s linear infinite"}}><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>Signing in…</>
            :<>Sign In<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></>}
        </button>

        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <div style={{flex:1,height:1,background:BORDER}}/>
          <span style={{color:MUTED,fontSize:13,fontWeight:500,letterSpacing:"0.05em"}}>OR</span>
          <div style={{flex:1,height:1,background:BORDER}}/>
        </div>

        {/* ── PASSKEY / BIOMETRIC BUTTON ── */}
        {(settings?.secBiometricEnabled!==false)&&hasPasskey&&<button className="lbtn lfa4" onClick={async()=>{setPasskeyChecking(true);setErr("");await tryPasskey();setPasskeyChecking(false);}} disabled={passkeyChecking}
          style={{width:"100%",background:"rgba(255,255,255,0.85)",border:`1.5px solid ${passkeyChecking?"#3b6ef6":BORDER}`,borderRadius:14,padding:"15px 18px",color:TEXT,fontSize:16,fontWeight:600,cursor:passkeyChecking?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:12,transition:"all 0.18s",marginBottom:14,WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>
          {passkeyChecking
            ?<><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b6ef6" strokeWidth="2.5" strokeLinecap="round" style={{animation:"lspin 0.8s linear infinite"}}><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg><span style={{color:"#3b6ef6"}}>Verifying…</span></>
            :<><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b6ef6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 10V2"/><path d="M8 6l4-4 4 4"/><rect x="2" y="12" width="20" height="10" rx="2"/><circle cx="12" cy="17" r="1.5" fill="#3b6ef6"/></svg><span>Sign in with Passkey / Face ID / Fingerprint</span></>}
        </button>}

        {(settings?.secBiometricEnabled!==false)&&!hasPasskey&&<div className="lfa4" style={{background:"rgba(59,110,246,0.06)",border:`1.5px solid rgba(59,110,246,0.18)`,borderRadius:14,padding:"13px 18px",display:"flex",alignItems:"center",gap:12,marginBottom:14,cursor:"pointer"}}
          onClick={()=>tryPasskey()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b6ef6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 10V2"/><path d="M8 6l4-4 4 4"/><rect x="2" y="12" width="20" height="10" rx="2"/><circle cx="12" cy="17" r="1.5" fill="#3b6ef6"/></svg>
          <div style={{flex:1}}>
            <p style={{color:TEXT,fontSize:14,fontWeight:600,margin:0}}>Use Passkey / Biometrics</p>
            <p style={{color:MUTED,fontSize:12,margin:"2px 0 0"}}>Face ID, fingerprint, or Windows Hello</p>
          </div>
        </div>}

        {mode==="picker"&&<button onClick={()=>setShowAdminForm(false)}
          style={{width:"100%",background:"rgba(255,255,255,0.6)",border:`1.5px solid ${BORDER}`,borderRadius:14,padding:"14px 18px",color:MUTED,fontSize:15,fontWeight:500,cursor:"pointer",textAlign:"center",WebkitTapHighlightColor:"transparent",marginBottom:14}}>
          ← Back to staff selection
        </button>}

        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:4}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <p style={{color:MUTED,fontSize:13,margin:0}}>Your data is protected with enterprise-grade security</p>
        </div>
      </div>
  );

  // PIN screen
  if(pinMode&&pinTarget){
    return(
      <div style={{background:BG,minHeight:"100svh",position:"relative",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px"}}>
        <div style={glowBg}/><div style={dotsBg}/>
        <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:340,textAlign:"center"}}>
          <div style={{width:76,height:76,borderRadius:22,background:"rgba(59,110,246,0.12)",border:"2px solid rgba(59,110,246,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:34,margin:"0 auto 18px",userSelect:"none"}}>{appEmoji}</div>
          <p style={{color:TEXT,fontWeight:700,fontSize:22,marginBottom:6}}>{pinTarget.name}</p>
          <p style={{color:MUTED,fontSize:16,marginBottom:32}}>Enter your 4-digit PIN</p>
          <div style={{display:"flex",gap:18,justifyContent:"center",marginBottom:32}}>
            {[0,1,2,3].map(i=>(
              <div key={i} style={{width:18,height:18,borderRadius:"50%",background:pinVal.length>i?BLUE:BORDER,border:`2px solid ${pinVal.length>i?BLUE:MUTED}`,transition:"all 0.15s"}}/>
            ))}
          </div>
          {err&&<p style={{color:"#f87171",fontSize:15,fontWeight:500,marginBottom:16}}>{err}</p>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
            {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k,i)=>(
              <button key={i} onClick={()=>{if(k==="⌫"){setPinVal(v=>v.slice(0,-1));setErr("");}else if(k!=="")enterPin(String(k));}}
                disabled={k===""}
                style={{height:72,borderRadius:16,fontSize:k==="⌫"?22:26,fontWeight:700,background:k===""?"transparent":"rgba(255,255,255,0.9)",color:TEXT,border:k===""?"none":`1.5px solid ${BORDER}`,cursor:k===""?"default":"pointer",transition:"background 0.1s",opacity:k===""?0:1,WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>
                {k}
              </button>
            ))}
          </div>
          <button onClick={()=>{setPinMode(false);setPinTarget(null);setPinVal("");setErr("");}}
            style={{color:MUTED,fontSize:15,fontWeight:500,background:"none",border:"none",cursor:"pointer",padding:"12px 0",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>
            ← Use password instead
          </button>
        </div>
      </div>
    );
  }

  // Staff picker mode
  if(mode==="picker"&&!showAdminForm){
    return(
      <div style={{background:BG,minHeight:"100svh",position:"relative",overflow:"hidden",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 20px"}}>
        <div style={glowBg}/><div style={dotsBg}/>
        <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:420}}>
          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{width:80,height:80,borderRadius:22,background:"rgba(59,110,246,0.12)",border:"2px solid rgba(59,110,246,0.22)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:38,margin:"0 auto 18px",userSelect:"none"}}>{appEmoji}</div>
            <h1 style={{color:TEXT,fontWeight:800,fontSize:28,margin:"0 0 8px",letterSpacing:"-0.01em"}}>{appName}</h1>
            <p style={{color:MUTED,fontSize:16,margin:0}}>{appSub}</p>
          </div>
          <p style={{color:MUTED,fontSize:12,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",textAlign:"center",marginBottom:14}}>Select your profile</p>
          {staffNames.length===0&&(
            <div style={{background:"rgba(255,255,255,0.9)",border:`1.5px solid ${BORDER}`,borderRadius:16,padding:"22px",textAlign:"center"}}>
              <p style={{color:TEXT,fontSize:16,marginBottom:8}}>No staff profiles configured.</p>
              <p style={{color:MUTED,fontSize:14}}>Admin → Settings → Staff Login Mode</p>
            </div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
            {staffNames.map((name,i)=>{
              const initials=name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
              const colors=[BLUE,"#8b5cf6","#0ea5e9","#10b981","#f59e0b","#ec4899"];
              const color=colors[i%colors.length];
              return(
                <button key={name} onClick={()=>pickStaff(name)}
                  style={{background:"rgba(255,255,255,0.9)",border:`1.5px solid ${BORDER}`,borderRadius:16,padding:"16px 18px",display:"flex",alignItems:"center",gap:14,textAlign:"left",width:"100%",cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"manipulation",transition:"border-color 0.15s,background 0.15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=color;e.currentTarget.style.background=`${color}08`;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=BORDER;e.currentTarget.style.background="rgba(255,255,255,0.9)";}}>
                  <div style={{width:46,height:46,background:`${color}18`,border:`1.5px solid ${color}35`,borderRadius:13,display:"flex",alignItems:"center",justifyContent:"center",color,fontWeight:800,fontSize:17,flexShrink:0}}>{initials}</div>
                  <div style={{flex:1}}>
                    <p style={{color:TEXT,fontWeight:600,fontSize:17,lineHeight:1.2,margin:0}}>{name}</p>
                    <p style={{color:MUTED,fontSize:13,marginTop:3}}>Tap to continue</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              );
            })}
          </div>
          {err&&<div style={{background:"rgba(239,68,68,0.1)",border:"1.5px solid rgba(239,68,68,0.28)",borderRadius:12,padding:"13px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p style={{color:"#f87171",fontSize:15,fontWeight:500,margin:0}}>{err}</p>
          </div>}
          <button onClick={()=>{setErr("");setShowAdminForm(true);}}
            style={{color:MUTED,fontSize:16,fontWeight:500,display:"block",width:"100%",textAlign:"center",background:"none",border:"none",cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"manipulation",minHeight:48,padding:"12px 0"}}>
            Administrator Login →
          </button>
        </div>
      </div>
    );
  }

  // Main login — responsive: mobile stacked, tablet/desktop split
  return(
    <div style={{background:BG,minHeight:"100svh",fontFamily:"-apple-system,'SF Pro Display','Segoe UI',sans-serif",position:"relative",overflow:"hidden"}}>
      <style>{`
        @keyframes lfadeup{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .lfa{animation:lfadeup 0.45s ease both}
        .lfa2{animation:lfadeup 0.45s 0.08s ease both}
        .lfa3{animation:lfadeup 0.45s 0.16s ease both}
        .lfa4{animation:lfadeup 0.45s 0.24s ease both}
        .linp{transition:border-color 0.18s,box-shadow 0.18s!important}
        .linp:focus{border-color:${BLUE}!important;outline:none!important;box-shadow:0 0 0 3px rgba(59,110,246,0.15)!important}
        .lbtn{transition:all 0.18s!important}
        .lbtn:hover:not(:disabled){filter:brightness(1.1);box-shadow:0 8px 30px rgba(59,110,246,0.55)!important}
        .lbtn:active:not(:disabled){transform:scale(0.985)!important}
        .lpill{transition:border-color 0.18s,background 0.18s!important}
        .lpill:hover{border-color:rgba(59,110,246,0.4)!important;background:rgba(59,110,246,0.05)!important}
      `}</style>
      <div style={glowBg}/><div style={dotsBg}/>

      <div style={{minHeight:"100svh",display:"flex",position:"relative",zIndex:1}}>
        <style>{`
          @media(min-width:860px){
            .lsplit-left{display:flex!important}
            .lright-pad{padding:48px!important;justify-content:center!important}
          }
          @media(max-width:859px){
            .lsplit-left{display:none!important}
          }
        `}</style>

        {/* LEFT BRANDING PANEL — desktop/tablet landscape */}
        <div className="lsplit-left" style={{display:"none",flex:"0 0 50%",maxWidth:580,flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 52px",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 80% 60% at 45% 50%, rgba(59,110,246,0.07) 0%, transparent 70%)"}}/>
          <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:400}}>
            <div className="lfa" style={{marginBottom:36}}>
              <div style={{width:96,height:96,borderRadius:26,background:"rgba(59,110,246,0.1)",border:"2px solid rgba(59,110,246,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:48,userSelect:"none",marginBottom:26,backdropFilter:"blur(8px)"}}>{appEmoji}</div>
              <h1 style={{color:TEXT,fontWeight:800,fontSize:38,lineHeight:1.15,margin:"0 0 12px",letterSpacing:"-0.02em"}}>{appName}</h1>
              <p style={{color:MUTED,fontSize:18,margin:0,fontWeight:400,lineHeight:1.6}}>{appSub}</p>
            </div>
            <div className="lfa2" style={{background:"rgba(255,255,255,0.75)",border:`1.5px solid ${BORDER}`,borderRadius:20,padding:"22px 26px",marginBottom:32,backdropFilter:"blur(10px)"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1px 1fr 1px 1fr"}}>
                {featurePills.map((f,i)=>(
                  <React.Fragment key={f.label}>
                    <div style={{textAlign:"center",padding:"8px 10px"}}>
                      <div style={{width:46,height:46,borderRadius:13,background:`${f.color}12`,border:`1.5px solid ${f.color}28`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px"}}>{f.svg}</div>
                      <p style={{color:TEXT,fontSize:14,fontWeight:700,margin:"0 0 5px",lineHeight:1.2}}>{f.label}</p>
                      <p style={{color:MUTED,fontSize:12,margin:0,lineHeight:1.4}}>{f.sub}</p>
                    </div>
                    {i<2&&<div style={{background:BORDER,width:1,margin:"6px 0"}}/>}
                  </React.Fragment>
                ))}
              </div>
            </div>
            <div className="lfa3" style={{display:"flex",alignItems:"center",gap:10}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <p style={{color:MUTED,fontSize:14,margin:0}}>Your data is protected with enterprise-grade security</p>
            </div>
          </div>
        </div>

        {/* RIGHT — form panel */}
        <div className="lright-pad" style={{flex:1,display:"flex",flexDirection:"column",overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
          <style>{`
            @media(min-width:860px){
              .lright-pad{align-items:center!important;justify-content:center!important;padding:48px!important;}
              .lmobile-hdr-inner{display:none!important;}
            }
            @media(max-width:859px){
              .lright-pad{padding:0!important;align-items:center!important;}
              .lform-scroll{padding:0 20px 40px!important;width:100%!important;max-width:480px!important;margin:0 auto!important;}
            }
            @media(max-width:380px){
              .lform-scroll{padding:0 14px 32px!important;}
            }
          `}</style>

          {/* Mobile branding — inline above the form, scrolls with it */}
          <div className="lmobile-hdr-inner" style={{width:"100%",maxWidth:480,margin:"0 auto",padding:"36px 20px 20px",textAlign:"center"}}>
            <div style={{width:72,height:72,borderRadius:22,background:"rgba(59,110,246,0.12)",border:"2px solid rgba(59,110,246,0.22)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:34,margin:"0 auto 14px",userSelect:"none"}}>{appEmoji}</div>
            <h1 style={{color:TEXT,fontWeight:800,fontSize:26,margin:"0 0 6px",letterSpacing:"-0.01em"}}>{appName}</h1>
            <p style={{color:MUTED,fontSize:15,margin:"0 0 18px"}}>{appSub}</p>
            <div style={{background:"rgba(255,255,255,0.85)",border:`1.5px solid ${BORDER}`,borderRadius:16,padding:"12px 8px",backdropFilter:"blur(10px)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:0}}>
                {featurePills.map((f,i)=>(
                  <React.Fragment key={f.label}>
                    <div style={{flex:1,textAlign:"center",padding:"0 4px"}}>
                      <div style={{width:34,height:34,borderRadius:10,background:`${f.color}12`,border:`1.5px solid ${f.color}28`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 6px"}}>{React.cloneElement(f.svg,{width:16,height:16})}</div>
                      <p style={{color:TEXT,fontSize:11,fontWeight:700,margin:0,lineHeight:1.2}}>{f.label}</p>
                    </div>
                    {i<2&&<div style={{width:1,background:BORDER,alignSelf:"stretch",margin:"4px 0"}}/>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <div className="lform-scroll" style={{width:"100%",maxWidth:450,padding:"24px 0"}}>
            {formCardContent}
          </div>
        </div>
      </div>
    </div>
  );
}


export { Login };
