/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect } from "react";
import { useStore } from "../lib/store";
import { D_USERS, D_SETTINGS } from "../lib/constants";
import { SESSION_TTL, DEVICE_ID } from "../lib/auth";
import { Login } from "./Login";
import StaffRouter from "../StaffRouter";

// ── GLOBAL ERROR BOUNDARY ────────────────────────────────────────────────────
class AppErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(e) { return { err: e }; }
  componentDidCatch(e, info) { console.error("App crash:", e, info); }
  render() {
    if (!this.state.err) return this.props.children;
    const msg = this.state.err?.message || String(this.state.err);
    return (
      <div style={{minHeight:"100vh",background:"#0b1120",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 20px",fontFamily:"-apple-system,sans-serif"}}>
        <div style={{fontSize:40,marginBottom:16}}>⚠️</div>
        <p style={{color:"#e8edf5",fontWeight:700,fontSize:20,marginBottom:8,textAlign:"center"}}>Something went wrong</p>
        <p style={{color:"#4a6080",fontSize:14,marginBottom:24,textAlign:"center",maxWidth:320}}>The app encountered an error. Try refreshing the page.</p>
        <button onClick={()=>window.location.reload()} style={{background:"#3b6ef6",color:"#fff",border:"none",borderRadius:12,padding:"14px 28px",fontSize:16,fontWeight:600,cursor:"pointer"}}>Refresh Page</button>
        <pre style={{marginTop:24,color:"#4a6080",fontSize:11,maxWidth:"90vw",overflowX:"auto",whiteSpace:"pre-wrap",wordBreak:"break-all"}}>{msg}</pre>
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
