/* eslint-disable react-hooks/exhaustive-deps, no-unused-vars */
import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { T } from "../lib/theme";
import { cx, inr, lineTotal, lineRows, safeO } from "../lib/utils";

function StatusPill({status,dm}){
  const t=T(dm);
  const map={
    "Delivered":[t.pillGreen,t.pillGreenText],
    "Pending":[t.pillAmber,t.pillAmberText],
    "In Transit":[t.pillBlue,t.pillBlueText],
    "Cancelled":[t.pillRed,t.pillRedText],
    "Active":[t.pillGreen,t.pillGreenText],
    "Inactive":[t.pillGray,t.pillGrayText],
    "Approved":[t.pillGreen,t.pillGreenText],
    "Paid":[t.pillGreen,t.pillGreenText],
    "Unpaid":[t.pillRed,t.pillRedText],
    "Partial":[t.pillAmber,t.pillAmberText],
    "Low Stock":[t.pillRed,t.pillRedText],
  };
  const [bg,color]=(map[status]||[t.pillGray,t.pillGrayText]);
  return <span style={{background:bg,color,fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:99,display:"inline-flex",alignItems:"center",gap:4,whiteSpace:"nowrap"}}>{status}</span>;
}
// AvatarCircle: colored initials circle
function AvatarCircle({name,size=34,dm}){
  const colors=["#2563eb","#059669","#d97706","#7c3aed","#0ea5e9","#dc2626","#0891b2","#65a30d"];
  const idx=(name||"?").charCodeAt(0)%colors.length;
  const initials=(name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  return <div style={{width:size,height:size,borderRadius:size*0.29,background:colors[idx],color:"#fff",fontWeight:800,fontSize:size*0.38,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,userSelect:"none",letterSpacing:"-0.01em"}}>{initials}</div>;
}
// StatIconBox: colored icon in soft square
function StatIconBox({icon,bg,size=40}){
  return <div style={{width:size,height:size,borderRadius:size*0.3,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.48,flexShrink:0}}>{icon}</div>;
}
// SectionHeader: tab section header with optional CTA
function SectionHeader({title,sub,cta,dm}){
  const t=T(dm);
  return <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20,gap:12,flexWrap:"wrap"}}>
    <div>
      <h2 style={{color:t.text,fontWeight:800,fontSize:22,letterSpacing:"-0.03em",lineHeight:1.1,margin:0}}>{title}</h2>
      {sub&&<p style={{color:t.sub,fontSize:13,marginTop:4}}>{sub}</p>}
    </div>
    {cta&&<div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>{cta}</div>}
  </div>;
}
// TabStatCards: row of stat cards at top of each tab — revamped layout
// Large soft-colored icon square on left, big bold number, label + subtitle on right
const STAT_ICON_COLORS=[
  {bg:"rgba(37,99,235,0.10)",border:"rgba(37,99,235,0.18)",color:"#2563eb"},
  {bg:"rgba(16,185,129,0.10)",border:"rgba(16,185,129,0.18)",color:"#059669"},
  {bg:"rgba(245,158,11,0.10)",border:"rgba(245,158,11,0.18)",color:"#d97706"},
  {bg:"rgba(139,92,246,0.10)",border:"rgba(139,92,246,0.18)",color:"#7c3aed"},
  {bg:"rgba(239,68,68,0.10)",border:"rgba(239,68,68,0.18)",color:"#dc2626"},
];
function TabStatCards({cards,dm}){
  const t=T(dm);
  const cols=Math.min(cards.length,5);
  return <div style={{display:"grid",gridTemplateColumns:`repeat(auto-fit,minmax(${cols>=4?"140px":"160px"},1fr))`,gap:10,marginBottom:20}}>
    {cards.map((c,i)=>{
      const ic=STAT_ICON_COLORS[i%STAT_ICON_COLORS.length];
      return (
        <div key={i} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"14px 16px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)",cursor:c.onClick?"pointer":"default",transition:"box-shadow 0.15s,transform 0.15s",display:"flex",alignItems:"center",gap:14,minWidth:0,overflow:"hidden"}}
          onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.09)";e.currentTarget.style.transform="translateY(-1px)";}}
          onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.04)";e.currentTarget.style.transform="none";}}
          onClick={c.onClick}>
          {/* Large soft icon square */}
          <div style={{width:44,height:44,borderRadius:12,background:ic.bg,border:`1.5px solid ${ic.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
            {c.icon}
          </div>
          {/* Right side: number + label + sub */}
          <div style={{minWidth:0,flex:1}}>
            <p style={{color:t.text,fontWeight:900,fontSize:18,letterSpacing:"-0.02em",lineHeight:1,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.value}</p>
            <p style={{color:t.sub,fontSize:11,fontWeight:600,marginBottom:c.sub?2:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.label}</p>
            {c.sub&&<p style={{color:c.subColor||ic.color,fontSize:10,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.sub}</p>}
          </div>
          {c.trend!=null&&<span style={{fontSize:10,fontWeight:700,color:c.trendUp===false?"#ef4444":"#10b981",background:c.trendUp===false?"#fee2e220":"#dcfce720",padding:"2px 7px",borderRadius:99,flexShrink:0}}>{c.trend}</span>}
        </div>
      );
    })}
  </div>;
}
// DataTable: consistent white card table
function DataTable({cols,rows,dm,emptyMsg="No data found",onRowClick}){
  const t=T(dm);
  if(!rows||rows.length===0) return <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"48px 24px",textAlign:"center"}}>
    <p style={{fontSize:32,marginBottom:8}}>📭</p>
    <p style={{color:t.sub,fontSize:14,fontWeight:500}}>{emptyMsg}</p>
  </div>;
  return <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead>
          <tr style={{background:t.tableHeader,borderBottom:`1.5px solid ${t.border}`}}>
            {cols.map((c,i)=><th key={i} style={{padding:"11px 16px",textAlign:c.right?"right":"left",color:t.sub,fontSize:11,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row,ri)=>(
            <tr key={ri} style={{borderBottom:`1px solid ${t.border}`,cursor:onRowClick?"pointer":"default",transition:"background 0.1s"}}
              onMouseEnter={e=>{if(onRowClick)e.currentTarget.style.background=t.inp;}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}
              onClick={()=>onRowClick&&onRowClick(row)}>
              {cols.map((c,ci)=><td key={ci} style={{padding:"13px 16px",color:t.text,fontSize:13,textAlign:c.right?"right":"left",whiteSpace:c.wrap?"normal":"nowrap",maxWidth:c.maxW||"none",overflow:"hidden",textOverflow:"ellipsis"}}>{c.render?c.render(row):row[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>;
}
// FilterBar: search + filter pills — search row on top, filters below
function FilterBar({search,onSearch,placeholder,filters,activeFilter,onFilter,actions,dm}){
  const t=T(dm);
  return <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
    {/* Row 1: search + actions */}
    {(onSearch!==undefined||actions)&&<div style={{display:"flex",alignItems:"center",gap:10}}>
      {onSearch!==undefined&&<div style={{position:"relative",flex:"1",minWidth:200}}>
        <svg style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input value={search||""} onChange={e=>onSearch(e.target.value)} placeholder={placeholder||"Search…"}
          style={{background:t.card,border:`1.5px solid ${t.border}`,color:t.text,borderRadius:10,padding:"10px 12px 10px 38px",fontSize:13,outline:"none",width:"100%",transition:"border-color 0.15s",boxSizing:"border-box"}}
          onFocus={e=>{e.target.style.borderColor="#2563eb";e.target.style.boxShadow="0 0 0 3px rgba(37,99,235,0.1)";}}
          onBlur={e=>{e.target.style.borderColor=t.border;e.target.style.boxShadow="none";}}/>
        {search&&<button onClick={()=>onSearch("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:t.border,color:t.sub,width:18,height:18,borderRadius:4,border:"none",cursor:"pointer",fontSize:9,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>}
      </div>}
      {actions&&<div style={{display:"flex",gap:8,flexShrink:0}}>{actions}</div>}
    </div>}
    {/* Row 2: filter pills */}
    {filters&&<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
      {filters.map(f=><button key={f.value} onClick={()=>onFilter(f.value)}
        style={{padding:"7px 16px",borderRadius:99,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all 0.15s",border:`1.5px solid ${activeFilter===f.value?"#2563eb":t.border}`,background:activeFilter===f.value?"#2563eb":t.card,color:activeFilter===f.value?"#fff":t.sub,whiteSpace:"nowrap"}}>
        {f.label}
      </button>)}
    </div>}
  </div>;
}

// ═══════════════════════════════════════════════════════════════
//  UI ATOMS
// ═══════════════════════════════════════════════════════════════
function Pill({c="stone",dm,children}){
  const m={
    stone:["bg-slate-100 text-slate-600 border border-slate-200","bg-slate-800 text-slate-300 border border-slate-700"],
    amber:["bg-amber-50 text-amber-700 border border-amber-200","bg-amber-900/20 text-amber-400 border border-amber-700/40"],
    green:["bg-emerald-50 text-emerald-700 border border-emerald-200","bg-emerald-900/20 text-emerald-400 border border-emerald-700/40"],
    red:["bg-red-50 text-red-700 border border-red-200","bg-red-900/20 text-red-400 border border-red-700/40"],
    sky:["bg-sky-50 text-sky-700 border border-sky-200","bg-sky-900/20 text-sky-400 border border-sky-700/40"],
    blue:["bg-blue-50 text-blue-700 border border-blue-200","bg-blue-900/20 text-blue-400 border border-blue-700/40"],
    purple:["bg-violet-50 text-violet-700 border border-violet-200","bg-violet-900/20 text-violet-400 border border-violet-700/40"],
  };
  return <span className={cx("inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded tracking-wide uppercase whitespace-nowrap select-none",(m[c]||m.stone)[dm?1:0])}>{children}</span>;
}
function Hr({dm}){const t=T(dm);return <div style={{height:1,background:t.border}}/>;}
function Inp({label,dm,className="",...p}){
  // Phase 4: larger inputs, clear labels above fields
  const t=T(dm);
  return <div className={className}>
    {label&&<label style={{color:t.sub,letterSpacing:"0.04em",fontSize:12,fontWeight:600,display:"block",marginBottom:6,marginLeft:1}}>{label}</label>}
    <input style={{background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,fontSize:16,WebkitAppearance:"none",borderRadius:13,touchAction:"manipulation",transition:"border-color 0.15s,box-shadow 0.15s",minHeight:50,width:"100%",padding:"13px 15px",outline:"none",display:"block"}} onFocus={e=>{e.target.style.borderColor="#2563eb";e.target.style.boxShadow="0 0 0 3px rgba(37,99,235,0.12)";}} onBlur={e=>{e.target.style.borderColor=t.inpB;e.target.style.boxShadow="none";}} {...p}/>
  </div>;
}
function Sel({label,dm,children,className="",...p}){
  // Phase 4: larger selects, clear labels
  const t=T(dm);
  return <div className={className} style={{position:"relative"}}>
    {label&&<label style={{color:t.sub,letterSpacing:"0.04em",fontSize:12,fontWeight:600,display:"block",marginBottom:6,marginLeft:1}}>{label}</label>}
    <select style={{background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,fontSize:16,WebkitAppearance:"none",appearance:"none",borderRadius:13,touchAction:"manipulation",transition:"border-color 0.15s,box-shadow 0.15s",minHeight:50,width:"100%",padding:"13px 40px 13px 15px",outline:"none",display:"block"}} onFocus={e=>{e.target.style.borderColor="#2563eb";e.target.style.boxShadow="0 0 0 3px rgba(37,99,235,0.12)";}} onBlur={e=>{e.target.style.borderColor=t.inpB;e.target.style.boxShadow="none";}} {...p}>{children}</select>
    <span style={{position:"absolute",right:14,top:label?"calc(50% + 14px)":"50%",transform:"translateY(-50%)",pointerEvents:"none",color:t.sub,fontSize:12}}>▾</span>
  </div>;
}
function Btn({children,onClick,v="primary",size="md",className="",disabled=false,dm}){
  const t=T(dm);
  const V={
    primary:`background:#2563eb;color:#ffffff;border:1.5px solid #2563eb;`,
    ghost:dm?"background:#1c2128;color:#e6edf3;border:1.5px solid #30363d;":"background:#ffffff;color:#1e3a5f;border:1.5px solid #dde1e8;",
    danger:"background:#dc2626;color:#fff;border:1.5px solid #dc2626;",
    success:"background:#059669;color:#fff;border:1.5px solid #059669;",
    amber:"background:#d97706;color:#fff;border:1.5px solid #d97706;",
    outline:dm?"background:transparent;color:#60a5fa;border:1.5px solid #60a5fa;":"background:transparent;color:#2563eb;border:1.5px solid #2563eb;",
    sky:"background:#0ea5e9;color:#fff;border:1.5px solid #0ea5e9;",
    purple:"background:#7c3aed;color:#fff;border:1.5px solid #7c3aed;",
  };
  const S={sm:"padding:8px 14px;font-size:13px;min-height:40px;border-radius:10px;",md:"padding:12px 18px;font-size:15px;min-height:50px;border-radius:14px;",lg:"padding:14px 28px;font-size:16px;min-height:54px;border-radius:16px;"};
  const base={fontWeight:600,letterSpacing:"0.01em",cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.45:1,transition:"all 0.15s",WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6};
  const styleStr=(V[v]||V.primary)+(S[size]||S.md);
  const styleObj={...base,...Object.fromEntries(styleStr.split(";").filter(Boolean).map(s=>{const[k,...vs]=s.split(":");const key=k.trim().replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return[key,vs.join(":").trim()];}))};
  return <button onClick={onClick} disabled={disabled} style={styleObj} className={cx("select-none active:scale-[0.96] crm-btn-press",className)}>{children}</button>;
}
function Card({children,className="",dm}){
  const t=T(dm);
  return <div style={{background:t.card,border:`1px solid ${t.border}`,boxShadow:dm?"0 1px 4px rgba(0,0,0,0.4)":"0 1px 3px rgba(0,0,0,0.05),0 1px 2px rgba(0,0,0,0.03)",borderRadius:16}} className={className}>{children}</div>;
}
function StatCard({label,value,sub,accent,dm,animDelay="0.05s",icon,trend,trendUp}){
  const t=T(dm);
  const ac=accent||"#2563eb";
  return (
    <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"14px 16px",display:"flex",alignItems:"center",gap:14,overflow:"hidden",boxShadow:dm?"0 1px 4px rgba(0,0,0,0.4)":"0 1px 3px rgba(0,0,0,0.05)","--delay":animDelay,transition:"transform 0.18s,box-shadow 0.18s",cursor:"default"}} className="crm-stat-card crm-list-item">
      {/* Large soft icon square */}
      {icon&&(
        <div style={{width:52,height:52,borderRadius:14,background:`${ac}15`,border:`1.5px solid ${ac}25`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>
          {icon}
        </div>
      )}
      {/* Right: number + label + sub */}
      <div style={{minWidth:0,flex:1}}>
        <p style={{color:t.text,fontSize:24,fontWeight:900,lineHeight:1,letterSpacing:"-0.03em",marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{value}</p>
        <p style={{color:t.sub,fontSize:11,fontWeight:600,marginBottom:sub?2:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</p>
        {(sub||trend!==undefined)&&(
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            {sub&&<p style={{color:ac,fontSize:10,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sub}</p>}
            {trend!==undefined&&(
              <span style={{fontSize:10,fontWeight:700,color:trendUp?"#10b981":"#ef4444",background:trendUp?"#10b98115":"#ef444415",padding:"2px 7px",borderRadius:99,whiteSpace:"nowrap",flexShrink:0}}>
                {trendUp?"↑":"↓"} {trend}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
function Sheet({open,title,onClose,children,dm}){
  const t=T(dm);
  const scrollYRef=useRef(0);
  useEffect(()=>{
    if(!open) return;
    // Use body position:fixed trick — preserves iOS momentum scroll inside the sheet
    // while preventing background page scroll (documentElement overflow:hidden breaks this)
    const y=window.scrollY;
    document.body.style.cssText=`overflow:hidden;position:fixed;top:-${y}px;left:0;right:0;`;
    return()=>{
      document.body.style.cssText="";
      window.scrollTo(0,y);
    };
  },[open]);
  if(!open)return null;
  return ReactDOM.createPortal(<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center crm-sheet-backdrop" style={{background:"rgba(0,0,0,0.65)",WebkitBackdropFilter:"blur(6px)",backdropFilter:"blur(6px)"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div style={{background:t.card,maxHeight:"min(94dvh,94svh,94vh)",overflow:"hidden",border:`1px solid ${t.border}`,boxShadow:"0 -4px 40px rgba(0,0,0,0.4)",borderRadius:"24px 24px 0 0",width:"100%",paddingBottom:"env(safe-area-inset-bottom,0px)",WebkitTransform:"translateZ(0)",transform:"translateZ(0)"}} className="sm:rounded-2xl sm:max-w-lg sm:w-full sm:mx-4 flex flex-col crm-sheet-panel-mobile sm:crm-sheet-panel-desktop" onClick={e=>e.stopPropagation()}>
      {/* Drag handle — mobile only */}
      <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
        <div style={{width:40,height:4,borderRadius:99,background:t.border}}/>
      </div>
      {/* Header */}
      {/* Phase 4 — larger sheet header */}
      <div style={{borderBottom:`1px solid ${t.border}`,background:dm?"rgba(28,33,40,0.8)":"rgba(248,250,252,0.9)"}} className="flex items-center justify-between px-5 py-4 shrink-0 sm:rounded-t-2xl">
        <span style={{color:t.text,letterSpacing:"-0.01em",fontSize:17,fontWeight:800,lineHeight:1.2}}>{title}</span>
        <button onClick={onClose} style={{background:t.inp,color:t.sub,border:`1.5px solid ${t.inpB}`,width:40,height:40,borderRadius:11,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",cursor:"pointer",transition:"all 0.15s",flexShrink:0}}>✕</button>
      </div>
      {/* Content */}
      <div className="px-5 py-5 flex flex-col gap-4 crm-sheet-scroll" style={{overflowY:"auto",WebkitOverflowScrolling:"touch",overscrollBehavior:"contain",touchAction:"pan-y",flex:1,minHeight:0,paddingBottom:"max(1.5rem, env(safe-area-inset-bottom,0px))"}}>{children}</div>
    </div>
  </div>, document.body);
}
function Toast({msg,onDone}){
  useEffect(()=>{const t=setTimeout(onDone,2800);return()=>clearTimeout(t);},[]);
  return <div className="fixed left-1/2 -translate-x-1/2 z-[200] text-sm px-5 py-3.5 font-medium whitespace-nowrap pointer-events-none flex items-center gap-2.5 crm-toast"
    style={{
      // On mobile: sit above the 64px nav bar + safe area. On desktop (lg+): use a fixed offset from bottom
      bottom:"calc(76px + env(safe-area-inset-bottom,0px))",
      background:"#0f1923",color:"#e6edf3",border:"1px solid #21262d",
      boxShadow:"0 4px 24px rgba(0,0,0,0.5)",WebkitBackdropFilter:"blur(8px)",backdropFilter:"blur(8px)",
      borderRadius:14,fontSize:14
    }}>
    <span style={{width:7,height:7,borderRadius:"50%",background:"#3b82f6",flexShrink:0,display:"inline-block",animation:"pulse-dot 1.5s ease infinite"}}/>
    {msg}
  </div>;
}
function Confirm({msg,onYes,onNo,dm}){
  const t=T(dm);if(!msg)return null;
  return ReactDOM.createPortal(<div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center px-4 crm-sheet-backdrop" style={{background:"rgba(0,0,0,0.65)",WebkitBackdropFilter:"blur(6px)",backdropFilter:"blur(6px)"}}>
    <div style={{background:t.card,border:`1.5px solid ${t.border}`,boxShadow:"0 20px 60px rgba(0,0,0,0.4)",borderRadius:24,paddingBottom:"env(safe-area-inset-bottom,0px)",width:"100%",maxWidth:380}} className="p-6 flex flex-col gap-5 crm-confirm-modal">
      <div style={{width:44,height:44,borderRadius:12,background:"rgba(220,38,38,0.1)",border:"1.5px solid rgba(220,38,38,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>⚠️</div>
      <div>
        <p style={{color:t.text,fontWeight:700,fontSize:16,marginBottom:6}}>Confirm Action</p>
        <p style={{color:t.sub,fontSize:14,lineHeight:1.6}}>{msg}</p>
      </div>
      <div className="flex gap-3"><Btn dm={dm} v="ghost" size="md" className="flex-1" onClick={onNo}>Cancel</Btn><Btn v="danger" size="md" className="flex-1" onClick={onYes}>Delete</Btn></div>
    </div>
  </div>, document.body);
}
function Search({value,onChange,placeholder,dm}){
  // Phase 4 — large, rounded, prominent search bar
  const t=T(dm);
  return <div className="relative">
    <svg className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder||"Search…"} style={{background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,fontSize:15,WebkitAppearance:"none",touchAction:"manipulation",borderRadius:16,transition:"border-color 0.15s,box-shadow 0.15s",width:"100%",padding:"13px 44px 13px 46px",outline:"none",minHeight:52,display:"block",fontWeight:500}} onFocus={e=>{e.target.style.borderColor="#2563eb";e.target.style.boxShadow="0 0 0 3px rgba(37,99,235,0.12)";}} onBlur={e=>{e.target.style.borderColor=t.inpB;e.target.style.boxShadow="none";}}/>
    {value&&<button onClick={()=>onChange("")} style={{position:"absolute",right:13,top:"50%",transform:"translateY(-50%)",background:t.inpB,color:t.sub,width:24,height:24,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,border:"none",cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>✕</button>}
  </div>;
}

// ─── Pagination ─────────────────────────────────────────────────────────────
function Pagination({page,setPage,total,perPage=20,dm}){
  const t=T(dm);
  const pages=Math.ceil(total/perPage);
  if(pages<=1)return null;
  const start=Math.max(1,page-2);
  const end=Math.min(pages,start+4);
  const nums=Array.from({length:end-start+1},(_,i)=>start+i);
  return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"8px 0"}}>
      <button disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))}
        style={{width:34,height:34,borderRadius:9,background:t.inp,border:`1.5px solid ${t.border}`,color:page===1?t.sub:t.text,fontWeight:700,fontSize:13,cursor:page===1?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",opacity:page===1?0.4:1,WebkitTapHighlightColor:"transparent"}}>‹</button>
      {start>1&&<>
        <button onClick={()=>setPage(1)} style={{minWidth:34,height:34,borderRadius:9,background:t.inp,border:`1.5px solid ${t.border}`,color:t.text,fontWeight:600,fontSize:12,cursor:"pointer",padding:"0 8px",WebkitTapHighlightColor:"transparent"}}>1</button>
        {start>2&&<span style={{color:t.sub,fontSize:12}}>…</span>}
      </>}
      {nums.map(n=>(
        <button key={n} onClick={()=>setPage(n)}
          style={{minWidth:34,height:34,borderRadius:9,background:n===page?"#2563eb":t.inp,border:`1.5px solid ${n===page?"#2563eb":t.border}`,color:n===page?"#fff":t.text,fontWeight:n===page?700:500,fontSize:12,cursor:"pointer",padding:"0 8px",WebkitTapHighlightColor:"transparent",boxShadow:n===page?"0 2px 6px rgba(37,99,235,0.35)":"none"}}>
          {n}
        </button>
      ))}
      {end<pages&&<>
        {end<pages-1&&<span style={{color:t.sub,fontSize:12}}>…</span>}
        <button onClick={()=>setPage(pages)} style={{minWidth:34,height:34,borderRadius:9,background:t.inp,border:`1.5px solid ${t.border}`,color:t.text,fontWeight:600,fontSize:12,cursor:"pointer",padding:"0 8px",WebkitTapHighlightColor:"transparent"}}>{pages}</button>
      </>}
      <button disabled={page===pages} onClick={()=>setPage(p=>Math.min(pages,p+1))}
        style={{width:34,height:34,borderRadius:9,background:t.inp,border:`1.5px solid ${t.border}`,color:page===pages?t.sub:t.text,fontWeight:700,fontSize:13,cursor:page===pages?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",opacity:page===pages?0.4:1,WebkitTapHighlightColor:"transparent"}}>›</button>
      <span style={{color:t.sub,fontSize:11,marginLeft:4}}>{total} total</span>
    </div>
  );
}

// Toggle switch
function Tog({on,onChange,dm}){
  const t=T(dm);
  const ac=dm?"#3b82f6":"#1e3a5f";
  return <button onClick={onChange} style={{background:on?ac:t.inpB,width:38,height:22,borderRadius:99,padding:2,display:"flex",alignItems:"center",justifyContent:on?"flex-end":"flex-start",flexShrink:0,transition:"all 0.2s",border:"none",cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>
    <div style={{width:18,height:18,background:"#fff",borderRadius:"50%",boxShadow:"0 1px 3px rgba(0,0,0,0.25)",transition:"all 0.2s"}}/>
  </button>;
}

// Per-product order row with dial + individual price chips
function ProdRow({product,line,onChange,dm,showPrice=true}){
  const t=T(dm);
  const qty=line?.qty||0;
  const price=line?.priceAmount||0;
  const ac=dm?"#3b82f6":"#1e3a5f";
  return (
    <div style={{background:t.card,border:`1px solid ${qty>0?ac:t.border}`,borderRadius:6,transition:"border-color 0.15s",boxShadow:qty>0?(dm?"0 0 0 1px rgba(59,130,246,0.2)":"0 0 0 1px rgba(30,58,95,0.08)"):"none"}} className="p-3">
      <div className="flex items-center justify-between mb-3">
        <p style={{color:t.text,fontWeight:600,fontSize:13}}>{product.name}</p>
        {showPrice&&qty>0&&price>0&&<p style={{color:ac,fontWeight:700,fontSize:13}}>{inr(qty*price)}</p>}
        {!showPrice&&qty>0&&<p style={{color:t.sub,fontSize:12,fontWeight:500}}>{qty} {product.unit}</p>}
      </div>
      <div className="flex items-center gap-2">
        <div style={{background:dm?"#1c2128":"#f0f2f5",borderRadius:4,padding:"2px 8px",minWidth:40,textAlign:"center"}}>
          <span style={{color:qty>0?ac:t.sub,fontWeight:700,fontSize:15}}>{qty}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-1">
          <button onClick={()=>onChange({qty:Math.max(0,qty-1),priceAmount:price})} style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,width:36,height:36,borderRadius:4,fontWeight:700,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>−</button>
          <input type="number" value={qty} min={0} max={9999} onChange={e=>onChange({qty:Math.max(0,Math.min(9999,+e.target.value||0)),priceAmount:price})} style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,fontSize:14,WebkitAppearance:"none",MozAppearance:"textfield",touchAction:"manipulation",borderRadius:4,textAlign:"center",flex:1,minWidth:0,padding:"8px 4px"}} className="outline-none"/>
          <button onClick={()=>onChange({qty:qty+1,priceAmount:price})} style={{background:ac,color:"#fff",border:"none",width:36,height:36,borderRadius:4,fontWeight:700,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>+</button>
        </div>
      </div>
      {showPrice&&(
        <div className="mt-3">
          <p style={{color:t.sub,fontSize:10,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:6}}>Unit price</p>
          <div className="flex flex-wrap gap-1.5">
            {(product.prices||[]).map((p,i)=>(
              <button key={i} onClick={()=>onChange({qty,priceAmount:p})}
                style={{borderRadius:4,...(price===p?{background:ac,color:"#fff",border:`1px solid ${ac}`}:{background:t.inp,color:t.sub,border:`1px solid ${t.inpB}`}),padding:"6px 10px",fontSize:12,fontWeight:600,cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>₹{p}</button>
            ))}
            <div className="flex items-center gap-1">
              <span style={{color:t.sub,fontSize:10}}>₹</span>
              <input type="number" placeholder="Custom"
                value={price&&!(product.prices||[]).includes(price)?price:""}
                onChange={e=>{const v=+e.target.value;if(v>0)onChange({qty,priceAmount:v});}}
                style={{background:t.inp,border:`1px solid ${price&&!(product.prices||[]).includes(price)?ac:t.inpB}`,color:t.text,width:64,fontSize:13,borderRadius:4,padding:"6px 8px",WebkitAppearance:"none",touchAction:"manipulation"}}
                className="outline-none text-center"/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderEditor({products,orderLines,onChange,dm,showPrice=true}){
  const t=T(dm);
  const total=lineTotal(orderLines);
  const rows=lineRows(orderLines,products);
  return (
    <>
      {products.map(p=>(
        <ProdRow key={p.id} product={p} dm={dm} showPrice={showPrice}
          line={safeO(orderLines)[p.id]||{qty:0,priceAmount:p.prices?.[0]||0}}
          onChange={next=>onChange({...safeO(orderLines),[p.id]:next})}/>
      ))}
      {showPrice&&total>0&&(
        <div style={{background:t.inp,border:`1px solid ${t.inpB}`}} className="rounded-xl p-3 flex flex-col gap-1">
          <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-0.5">Live Bill</p>
          {rows.map(r=>(
            <div key={r.id} className="flex justify-between text-xs">
              <span style={{color:t.sub}}>{r.qty} × {r.name} @ {inr(r.priceAmount)}</span>
              <span style={{color:t.text}} className="font-semibold">{inr(r.qty*r.priceAmount)}</span>
            </div>
          ))}
          <div style={{borderTop:`1px solid ${t.border}`}} className="mt-1 pt-1.5 flex justify-between text-sm font-black">
            <span style={{color:t.sub}}>Total</span><span className="text-amber-500">{inr(total)}</span>
          </div>
        </div>
      )}
      {!showPrice&&rows.length>0&&(
        <div style={{background:t.inp}} className="rounded-xl p-3">
          <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-1">Order Summary</p>
          {rows.map(r=><div key={r.id} className="flex justify-between text-xs py-0.5"><span style={{color:t.sub}}>{r.qty} × {r.name}</span><span style={{color:t.text}} className="font-semibold">{r.qty} {r.unit}</span></div>)}
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  BROWSER PUSH NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════
async function requestPushPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  const perm = await Notification.requestPermission();
  return perm === "granted";
}
function sendBrowserNotif(title, body, icon = "🫓") {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>" + icon + "</text></svg>",
      tag: title,
    });
  } catch (e) { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════
//  DETAIL MODAL — Universal deep-dive overlay
//  Renders rich interactive details for any entity clicked
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//  BOTTOM NAV — Mobile phone nav bar with centered FAB
//  Matches reference: 4 tabs + big dark centered + button
//  Usage: <BottomNav tabs={bnTabs} activeTab={tab} onTab={setTab}
//           onFab={()=>setShowQuickAdd(true)} moreOpen={moreOpen}
//           onMore={()=>setMoreOpen(o=>!o)} moreTabs={moreTabs}
//           isMoreActive={isMoreActive} icons={TAB_ICONS}
//           labels={TAB_LABELS} dm={dm} pendingCount={pendingD.length}
//           onLogout={onLogout} onDm={()=>setDm(d=>!d)} />
// ═══════════════════════════════════════════════════════════════
// NavBtn lifted outside BottomNav to prevent re-creation on every render (avoids flicker)
const NavBtn = React.memo(function NavBtn({ tb, activeTab, onTab, icons, labels, dm, pendingCount, BLUE, activeCol, inactiveCol }) {
  const isA = activeTab === tb;
  const hasBadge = tb === "Deliveries" && pendingCount > 0;
  return (
    <button
      onClick={() => onTab(tb)}
      style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 3, background: "transparent", border: "none",
        cursor: "pointer", WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation", position: "relative",
        // minWidth ensures labels don't collapse on 320px phones
        padding: "0 2px", minHeight: 64, minWidth: 44,
        transition: "opacity 0.1s",
      }}
    >
      {isA && (
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
          width: 20, height: 3, borderRadius: "0 0 3px 3px", background: BLUE }} />
      )}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
        width: 28, height: 28 }}>
        <span style={{ fontSize: isA ? 22 : 20, lineHeight: 1, transition: "font-size 0.15s",
          filter: isA ? "none" : `opacity(0.55) ${dm ? "" : "grayscale(0.2)"}` }}>
          {icons[tb] || "•"}
        </span>
        {hasBadge && (
          <span style={{ position: "absolute", top: -3, right: -5, background: "#ef4444",
            color: "#fff", fontSize: 9, fontWeight: 800, borderRadius: 99,
            minWidth: 15, height: 15, display: "flex", alignItems: "center",
            justifyContent: "center", padding: "0 3px",
            border: `2px solid ${dm ? "#0a0b12" : "#fff"}` }}>
            {pendingCount > 9 ? "9+" : pendingCount}
          </span>
        )}
      </div>
      <span style={{ fontSize: 10, fontWeight: isA ? 700 : 500, lineHeight: 1,
        color: isA ? activeCol : inactiveCol,
        letterSpacing: "0.01em", transition: "color 0.15s" }}>
        {labels[tb] || tb}
      </span>
    </button>
  );
});

function BottomNav({ tabs, activeTab, onTab, onFab, moreOpen, onMore, moreTabs=[], isMoreActive, icons={}, labels={}, dm, pendingCount=0, onLogout, onDm }) {
  const t = T(dm);

  const BLUE = "#2563eb";
  const activeCol  = dm ? "#ffffff" : "#0f172a";
  const inactiveCol = dm ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.32)";
  const navBg = dm ? "rgba(10,11,18,0.97)" : "rgba(255,255,255,0.97)";
  const navBorder = dm ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  // Dynamic grid columns: min 3 for aesthetics, max 4 on phone, 5 on tablet
  // Avoids single-column or 2-column layouts on small phones
  const moreGridCols = Math.min(Math.max(moreTabs.length, 3), moreTabs.length <= 6 ? 3 : moreTabs.length <= 10 ? 4 : 5);

  return (
    <>
      {/* ── More drawer backdrop ── */}
      {moreOpen && (
        <div onClick={() => onMore()} className="lg:hidden"
          style={{
            // Explicit position+inset before zIndex avoids Safari stacking context bugs
            // where backdropFilter composites incorrectly when zIndex is the first paint
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 48,
            background: "rgba(0,0,0,0.35)", backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)" }} />
      )}

      {/* ── More drawer panel ── */}
      {moreOpen && (
        <div className="lg:hidden"
          style={{ position: "fixed", bottom: "calc(64px + env(safe-area-inset-bottom,0px))",
            left: 8, right: 8, zIndex: 49,
            background: dm ? "rgba(14,15,22,0.98)" : "rgba(255,255,255,0.98)",
            border: `1px solid ${navBorder}`,
            borderRadius: 24, padding: "6px 10px 12px",
            boxShadow: dm ? "0 -12px 48px rgba(0,0,0,0.7)" : "0 -12px 48px rgba(0,0,0,0.14)",
            backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}>
          {/* drag handle */}
          <div style={{ width: 32, height: 4, borderRadius: 99, background: dm ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)", margin: "8px auto 12px" }} />
          {/* Tab grid — columns scale with tab count */}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${moreGridCols},1fr)`, gap: 6, marginBottom: 10 }}>
            {moreTabs.map(tb => {
              const isA = activeTab === tb;
              return (
                <button key={tb} onClick={() => { onTab(tb); onMore(); }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                    padding: "12px 4px 10px", borderRadius: 16, minHeight: 72,
                    background: isA ? BLUE + "18" : "transparent",
                    border: `1.5px solid ${isA ? BLUE + "40" : navBorder}`,
                    cursor: "pointer", WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}>
                  <span style={{ fontSize: 22, lineHeight: 1 }}>{icons[tb] || "•"}</span>
                  <span style={{ fontSize: 10, fontWeight: isA ? 700 : 500,
                    color: isA ? BLUE : inactiveCol, lineHeight: 1.2, textAlign: "center",
                    wordBreak: "break-word", maxWidth: "100%" }}>
                    {labels[tb] || tb}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Bottom actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { onDm(); onMore(); }}
              style={{ flex: 1, padding: "11px 8px", borderRadius: 14, border: `1.5px solid ${navBorder}`,
                background: dm ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                color: dm ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.6)",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                WebkitTapHighlightColor: "transparent", display: "flex",
                alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44 }}>
              {dm ? "☀️" : "🌙"} {dm ? "Light" : "Dark"}
            </button>
            <button onClick={() => { onMore(); onLogout(); }}
              style={{ flex: 1, padding: "11px 8px", borderRadius: 14,
                border: "1.5px solid rgba(239,68,68,0.25)",
                background: "rgba(239,68,68,0.07)", color: "#ef4444",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                WebkitTapHighlightColor: "transparent", display: "flex",
                alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44 }}>
              ↩ Sign Out
            </button>
          </div>
        </div>
      )}

      {/* ── Floating action button (above nav) — only rendered when onFab is provided ── */}
      {onFab && (
      <button onClick={onFab} className="lg:hidden"
        style={{ position: "fixed",
          // Sit above the nav bar; same calc as nav height (64px) + safe area + 12px breathing room
          bottom: "calc(64px + env(safe-area-inset-bottom,0px) + 12px)", right: 20,
          // zIndex 51: above nav (50) and More drawer (49) so it's always tappable
          zIndex: 51, width: 52, height: 52, borderRadius: 18,
          background: dm ? "linear-gradient(135deg,#2563eb,#1d4ed8)" : "linear-gradient(135deg,#0f172a,#1e293b)",
          border: "none", cursor: "pointer",
          WebkitTapHighlightColor: "transparent", touchAction: "manipulation",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: dm ? "0 4px 20px rgba(37,99,235,0.5)" : "0 4px 20px rgba(0,0,0,0.35)" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
      )}

      {/* ── Fixed bottom nav bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 lg:hidden"
        style={{ background: navBg,
          borderTop: `1px solid ${navBorder}`,
          paddingBottom: "env(safe-area-inset-bottom,0px)",
          boxShadow: dm ? "0 -4px 32px rgba(0,0,0,0.6)" : "0 -1px 0 rgba(0,0,0,0.06), 0 -8px 32px rgba(0,0,0,0.06)",
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          zIndex: 50, WebkitTransform: "translateZ(0)", transform: "translateZ(0)",
          willChange: "transform", contain: "layout style" }}>
        <div style={{ display: "flex", alignItems: "stretch", height: 64 }}>

          {/* All primary tabs */}
          {tabs.map(tb => <NavBtn key={tb} tb={tb} activeTab={activeTab} onTab={onTab} icons={icons} labels={labels} dm={dm} pendingCount={pendingCount} BLUE={BLUE} activeCol={activeCol} inactiveCol={inactiveCol} />)}

          {/* More button */}
          <button onClick={() => onMore()}
            style={{ width: 56, flexShrink: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 3,
              background: "transparent", border: "none",
              cursor: "pointer", WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation", padding: "0 2px", minHeight: 64,
              position: "relative" }}>
            {(isMoreActive || moreOpen) && (
              <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                width: 20, height: 3, borderRadius: "0 0 3px 3px", background: BLUE }} />
            )}
            <div style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {moreOpen
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isMoreActive ? BLUE : inactiveCol} strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                : <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <circle cx="5" cy="12" r="1.8" fill={isMoreActive ? BLUE : inactiveCol}/>
                    <circle cx="12" cy="12" r="1.8" fill={isMoreActive ? BLUE : inactiveCol}/>
                    <circle cx="19" cy="12" r="1.8" fill={isMoreActive ? BLUE : inactiveCol}/>
                  </svg>
              }
            </div>
            <span style={{ fontSize: 10, fontWeight: (isMoreActive || moreOpen) ? 700 : 500,
              color: (isMoreActive || moreOpen) ? activeCol : inactiveCol, lineHeight: 1 }}>
              More
            </span>
          </button>

        </div>
      </nav>
    </>
  );
}


export { StatusPill, AvatarCircle, StatIconBox, SectionHeader, TabStatCards, DataTable, FilterBar, Pill, Hr, Inp, Sel, Btn, Card, StatCard, Sheet, Toast, Confirm, Search, Pagination, Tog, ProdRow, OrderEditor, sendBrowserNotif, requestPushPermission, BottomNav };
