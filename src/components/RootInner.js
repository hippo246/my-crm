/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect } from "react";
import { useStore } from "../lib/store";
import { D_USERS, D_SETTINGS } from "../lib/constants";
import { SESSION_TTL, DEVICE_ID } from "../lib/auth";
import { Login } from "./Login";
import StaffRouter from "../StaffRouter";
import { db } from "../firebase";
import { ref, push, set } from "firebase/database";

// ── ERROR LOGGER — writes crash reports to Firebase ─────────────────────────
function logCrashToFirebase(error, info) {
  try {
    const crashRef = push(ref(db, "tas9_crash_logs"));
    set(crashRef, {
      message: error?.message || String(error),
      stack: error?.stack || "",
      componentStack: info?.componentStack || "",
      ts: Date.now(),
      tsISO: new Date().toISOString(),
      deviceId: DEVICE_ID,
      url: window.location.href,
      userAgent: navigator.userAgent,
    });
  } catch (e) {
    console.warn("Failed to log crash to Firebase:", e);
  }
}

// ── GLOBAL ERROR BOUNDARY ────────────────────────────────────────────────────
class AppErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null, errId: null }; }
  static getDerivedStateFromError(e) { return { err: e }; }
  componentDidCatch(e, info) {
    console.error("App crash:", e, info);
    const errId = "ERR-" + Date.now().toString(36).toUpperCase();
    this.setState({ errId });
    logCrashToFirebase(e, info);
  }
  render() {
    if (!this.state.err) return this.props.children;
    const msg = this.state.err?.message || String(this.state.err);
    const errId = this.state.errId;
    return (
      <div style={{minHeight:"100vh",background:"#0b1120",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 20px",fontFamily:"-apple-system,sans-serif"}}>
        <div style={{fontSize:40,marginBottom:16}}>⚠️</div>
        <p style={{color:"#e8edf5",fontWeight:700,fontSize:20,marginBottom:8,textAlign:"center"}}>Something went wrong</p>
        <p style={{color:"#4a6080",fontSize:14,marginBottom:8,textAlign:"center",maxWidth:320}}>The app encountered an error. This crash has been logged automatically.</p>
        {errId&&<p style={{color:"#f59e0b",fontSize:11,fontWeight:700,marginBottom:20,letterSpacing:1}}>Error ID: {errId}</p>}
        <div style={{display:"flex",gap:10,marginBottom:24}}>
          <button onClick={()=>window.location.reload()} style={{background:"#3b6ef6",color:"#fff",border:"none",borderRadius:12,padding:"14px 28px",fontSize:16,fontWeight:600,cursor:"pointer"}}>Refresh Page</button>
          <button onClick={()=>{localStorage.clear();sessionStorage.clear();window.location.reload();}} style={{background:"rgba(239,68,68,0.15)",color:"#f87171",border:"1px solid rgba(239,68,68,0.3)",borderRadius:12,padding:"14px 28px",fontSize:16,fontWeight:600,cursor:"pointer"}}>Clear & Reset</button>
        </div>
        <pre style={{marginTop:8,color:"#4a6080",fontSize:11,maxWidth:"90vw",overflowX:"auto",whiteSpace:"pre-wrap",wordBreak:"break-all"}}>{msg}</pre>
      </div>
    );
  }
}

function RootInner(){
  const [dm,setDm]=useStore("tas_pref_dm",false);
  const [users,setUsers,usersLoaded]=useStore("tas9_users",D_USERS);
  const [settings,setSettings,settingsLoaded]=useStore("tas10_settings",D_SETTINGS);
  const sessKey="tas9_sess_"+DEVICE_ID;
  const [sessRaw,setSessRaw,sessLoaded]=useStore(sessKey,null);
  const sess=(sessRaw&&Date.now()-sessRaw.loginAt<SESSION_TTL)?sessRaw:null;
  const setSess=(s)=>setSessRaw(s||null);
  const fbReady=usersLoaded&&settingsLoaded&&sessLoaded;

  useEffect(()=>{
    const opts={passive:true};
    const noop=()=>{};
    document.addEventListener("touchstart",noop,opts);
    document.addEventListener("touchmove",noop,opts);
    document.addEventListener("wheel",noop,opts);
    return()=>{
      document.removeEventListener("touchstart",noop,opts);
      document.removeEventListener("touchmove",noop,opts);
      document.removeEventListener("wheel",noop,opts);
    };
  },[]);

  useEffect(()=>{if(!sess)return;const t=setInterval(()=>{if(Date.now()-sess.loginAt>SESSION_TTL)setSess(null);},30000);return()=>clearInterval(t);},[sess]);

  const spinner=<div style={{background:dm?"#0c0c10":"#f2f2ed",height:"100svh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
    <div style={{width:40,height:40,border:"3px solid #f59e0b",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
    <p style={{color:"#f59e0b",fontSize:12,fontWeight:600,letterSpacing:1}}>Connecting to cloud…</p>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>;

  if(!fbReady) return spinner;
  if(!sess) return <Login users={users} onLogin={setSess} dm={dm} settings={settings}/>;
  return <StaffRouter sess={sess} onLogout={()=>setSess(null)} onSessUpdate={setSess} dm={dm} setDm={setDm} users={users} setUsers={setUsers} settings={settings} setSettings={setSettings}/>;
}

export default function Root(){
  return <AppErrorBoundary><RootInner/></AppErrorBoundary>;
}
