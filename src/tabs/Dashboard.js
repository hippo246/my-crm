/* eslint-disable react-hooks/exhaustive-deps, no-unused-vars */
// TAB: Dashboard — Command Center
//
// ⚠️  AUDIT FIX REQUIRED IN CRM.js (parent):
//   Staff portal writes production batches to `tas9_batches`.
//   CRM Analytics/Dashboard read from `tas9_prodtargets` via dashStats.todayPT.
//   To make staff batches visible here, CRM.js must merge both stores:
//
//     const [staffBatches] = useStore("tas9_batches", []);
//     const [prodTargets]  = useStore("tas9_prodtargets", []);
//     const allBatches = [...(prodTargets || []), ...(staffBatches || [])];
//     // then pass allBatches wherever prodTargets / dashStats.todayPT is computed.
//
import React from "react";

export default function DashboardTab({
  dm, t, T, sess, isAdmin, isFactory, can, canSeePrices, canSeeFinancials,
  dashStats, chartData, lowStockItems, churnedCustomers, churnDays,
  customers, deliveries, products, prodTargets, wastage, paymentLedger,
  notices, setNotices, notifs, settings, widgets,
  inr, lineTotal, safeO, safeArr, today, ts, uid,
  notify, addLog, addNotif, captureGPS,
  setTab, setDsh, setDf, blkD, setCsh, setCf, blkC,
  setDeliv, setPaySh, setPayAmt,
  setPayLedgerSh, setPayLedgerCust, setPayLedgerAmt, setPayLedgerNote, setPayLedgerMethod,
  setWSh, setWF, blkW, setEsh, setEf, blkE, setSsh, setSf, blkS,
  tglD, mapU, ask,
  nbSh, setNbSh, nbF, setNbF,
  overdueAlertExpanded, setOverdueAlertExpanded, overdueAlertDays, setOverdueAlertDays,
  WeatherWidget, Btn, Inp, Sel, Card, Sheet, Tog, Pill, SectionHeader, TabStatCards,
}) {
  const {
    todayDelivs=[], todayDone=[], todayPend=[], todayTransit=[], todayCancl=[],
    todayRev=0, weekDelivs=[], monthDelivs=[], weekRev=0, monthRev=0,
    allDue=[], totalDueAmt=0, todayPT=[], totalTarget=0, totalActual=0,
    prodPct=null, overdueD=[], todayWastage=[], todayWasteCost=0
  } = dashStats || {};

  const todayStr = today();
  const greetHour = new Date().getHours();
  const greeting = greetHour < 12 ? "Good morning" : greetHour < 17 ? "Good afternoon" : "Good evening";
  const greetEmoji = greetHour < 12 ? "🌅" : greetHour < 17 ? "☀️" : "🌙";

  const card = (extra={}) => ({
    background: dm
      ? "linear-gradient(145deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0.02) 100%)"
      : t.card,
    border: `1px solid ${t.border}`,
    borderRadius: 20,
    boxShadow: dm
      ? "0 4px 24px rgba(0,0,0,0.4),0 1px 0 rgba(255,255,255,0.06) inset"
      : "0 1px 4px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04)",
    backdropFilter: dm ? "blur(12px)" : "none",
    ...extra
  });

  const glassCard = (color, extra={}) => ({
    ...card(),
    background: dm
      ? `linear-gradient(145deg,${color}12 0%,${color}06 100%)`
      : `linear-gradient(145deg,${color}08 0%,${color}03 100%)`,
    border: `1px solid ${color}25`,
    boxShadow: dm
      ? `0 4px 24px rgba(0,0,0,0.3),0 0 0 1px ${color}15 inset`
      : `0 1px 4px rgba(0,0,0,0.04),0 0 0 1px ${color}10 inset`,
    ...extra
  });

  const sectionLabel = {color:t.sub, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:16};

  // ── Priority queue ──
  const urgentItems = [];
  if(allDue.length>0 && canSeeFinancials) {
    const bigDues = allDue.filter(c=>c.pending>=5000);
    urgentItems.push({
      id:"payments", level:"red", icon:"💳",
      label: bigDues.length>0
        ? `${bigDues.length} overdue payment${bigDues.length!==1?"s":""} over ₹5k — ${inr(bigDues.reduce((s,c)=>s+c.pending,0))}`
        : `${allDue.length} outstanding payment${allDue.length!==1?"s":""} — ${inr(totalDueAmt)}`,
      action: ()=>setTab("Payments"), actionLabel:"Collect →"
    });
  }
  if(overdueD.length>0) urgentItems.push({id:"overdue",level:"red",icon:"🚚",label:`${overdueD.length} deliver${overdueD.length!==1?"ies":"y"} past due date`,action:()=>setTab("Deliveries"),actionLabel:"View →"});
  if(lowStockItems?.length>0) urgentItems.push({id:"stock",level:"amber",icon:"📦",label:`${lowStockItems.length} item${lowStockItems.length!==1?"s":""} running low on stock`,action:()=>setTab("Inventory"),actionLabel:"Restock →"});
  if(prodPct!==null && prodPct<70 && (isAdmin||isFactory)) urgentItems.push({id:"prod",level:"amber",icon:"🏭",label:`Production at ${prodPct}% — ${totalTarget-totalActual} units behind target`,action:()=>setTab("Production"),actionLabel:"View →"});
  const staleCusts = customers.filter(c=>{
    const lastD=deliveries.filter(d=>d.customerId===c.id).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
    if(!lastD) return false;
    return Math.floor((new Date()-new Date(lastD.date))/86400000)>7 && c.active;
  });
  if(staleCusts.length>0) urgentItems.push({id:"stale",level:"blue",icon:"📞",label:`${staleCusts.length} customer${staleCusts.length!==1?"s":""} not ordered in 7+ days`,action:()=>setTab("Customers"),actionLabel:"Follow up →"});
  if(todayPend.length+todayTransit.length>0) urgentItems.push({id:"pending",level:"green",icon:"⏳",label:`${todayPend.length+todayTransit.length} today's order${(todayPend.length+todayTransit.length)!==1?"s":""} need attention`,action:()=>setTab("Deliveries"),actionLabel:"Mark done →"});
  const levelColor = {red:"#ef4444", amber:"#f59e0b", blue:"#3b82f6", green:"#10b981"};

  // ── AI Insights ──
  const aiInsights = [];
  const dayCounts={Mon:0,Tue:0,Wed:0,Thu:0,Fri:0,Sat:0,Sun:0};
  deliveries.forEach(d=>{const day=new Date(d.date).toLocaleDateString("en-US",{weekday:"short"});if(dayCounts[day]!==undefined)dayCounts[day]++;});
  const peakDay=Object.entries(dayCounts).sort(([,a],[,b])=>b-a)[0];
  if(peakDay&&peakDay[1]>0) aiInsights.push({icon:"📈",text:`${peakDay[0]}s are your busiest — ${peakDay[1]} orders on average`});
  const prevWeekRevs=chartData?.slice(-14,-7)?.reduce((s,d)=>s+(d.Revenue||0),0)||0;
  const thisWeekRevs=chartData?.slice(-7)?.reduce((s,d)=>s+(d.Revenue||0),0)||0;
  if(prevWeekRevs>0){const pct=Math.round((thisWeekRevs-prevWeekRevs)/prevWeekRevs*100);aiInsights.push({icon:pct>=0?"📊":"📉",text:`Revenue ${pct>=0?"up":"down"} ${Math.abs(pct)}% vs last week`});}
  if(churnedCustomers?.length>0) aiInsights.push({icon:"⚠️",text:`${churnedCustomers.length} customer${churnedCustomers.length!==1?"s":""} may be churning — last order ${churnDays}+ days ago`});
  const prodCounts={};
  deliveries.forEach(d=>Object.entries(safeO(d.orderLines)).forEach(([pid,l])=>{if(l.qty>0){const name=products.find(p=>p.id===pid)?.name||pid;prodCounts[name]=(prodCounts[name]||0)+l.qty;}}));
  const topProd=Object.entries(prodCounts).sort(([,a],[,b])=>b-a)[0];
  if(topProd) aiInsights.push({icon:"🔥",text:`"${topProd[0]}" is your top seller — ${topProd[1]} units delivered`});
  const totalBilledAll=customers.reduce((s,c)=>s+(c.paid||0)+(c.pending||0),0);
  const collPctAll=totalBilledAll>0?Math.round(customers.reduce((s,c)=>s+(c.paid||0),0)/totalBilledAll*100):100;
  if(collPctAll<85) aiInsights.push({icon:"💡",text:`Collection rate is ${collPctAll}% — consider following up on outstanding invoices`});

  // ── Live activity feed ──
  const feedItems = [];
  [...deliveries].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,4).forEach(d=>{
    if(d.status==="Delivered") feedItems.push({ts:d.deliveryDate||d.date,icon:"✅",text:`${d.customer} delivery marked done`,sub:canSeePrices&&lineTotal(d.orderLines)>0?inr(lineTotal(d.orderLines)):null,color:"#10b981"});
    else if(d.status==="In Transit") feedItems.push({ts:d.date,icon:"🚚",text:`${d.customer} order out for delivery`,color:"#3b82f6"});
  });
  if(paymentLedger?.length>0) [...paymentLedger].sort((a,b)=>(b.ts||b.date||"").localeCompare(a.ts||a.date||"")).slice(0,3).forEach(e=>{feedItems.push({ts:e.date,icon:"💰",text:`Payment collected from ${e.customerName}`,sub:inr(e.amount),color:"#10b981"});});
  [...customers].sort((a,b)=>(b.joinDate||"").localeCompare(a.joinDate||"")).slice(0,2).forEach(c=>{if(c.joinDate) feedItems.push({ts:c.joinDate,icon:"👤",text:`${c.name} added as customer`,color:"#8b5cf6"});});
  feedItems.sort((a,b)=>(b.ts||"").localeCompare(a.ts||""));

  const [kpiHover, setKpiHover] = React.useState(null);

  return (
    <div style={{display:"flex",flexDirection:"column",gap:32}}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.7;transform:scale(1.2)} }
        @keyframes dash-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .dash-fade { animation: dash-in 0.3s ease both; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{display:"flex",flexDirection:"column",gap:28,marginBottom:28}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:30,lineHeight:1,flexShrink:0}}>{greetEmoji}</span>
          <h1 style={{color:t.text,fontWeight:900,fontSize:26,letterSpacing:"-0.03em",lineHeight:1.2,margin:0}}>
            {greeting},<br/>{sess.name.split(" ")[0]}
          </h1>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
          <p style={{color:t.sub,fontSize:13,fontWeight:500,lineHeight:1.4,margin:0}}>
            {new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
          </p>
          <span style={{display:"inline-flex",alignItems:"center",gap:26,background:dm?"rgba(16,185,129,0.12)":"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.25)",borderRadius:99,padding:"16px 24px",fontSize:11,fontWeight:700,color:"#10b981",flexShrink:0}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:"#10b981",display:"inline-block",boxShadow:"0 0 6px #10b981"}}/>Live
          </span>
          {urgentItems.length>0&&<span style={{background:"#ef444418",color:"#ef4444",border:"1px solid #ef444430",borderRadius:99,padding:"16px 24px",fontSize:11,fontWeight:800,flexShrink:0}}>{urgentItems.length} urgent</span>}
        </div>
        {isAdmin&&<button onClick={()=>{setDsh("add");setDf(blkD());}}
          style={{width:"100%",background:"#2563eb",color:"#fff",border:"none",borderRadius:16,padding:"15px 20px",fontSize:15,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:20,boxShadow:"0 2px 16px rgba(37,99,235,0.35)",letterSpacing:"-0.01em"}}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New Order
        </button>}
      </div>

      {/* ── PRIORITY QUEUE ── */}
      {urgentItems.length>0&&<div style={{...card(),overflow:"hidden"}}>
        <div style={{padding:"12px 18px",borderBottom:`1px solid ${t.border}`,background:dm?"rgba(239,68,68,0.06)":"rgba(239,68,68,0.03)"}}>
          <p style={{...sectionLabel,marginBottom:0,color:"#ef4444"}}>🚨 Needs Attention</p>
        </div>
        {urgentItems.map((item,i)=>(
          <div key={item.id} style={{display:"flex",alignItems:"center",gap:24,padding:"12px 18px",borderBottom:i<urgentItems.length-1?`1px solid ${t.border}`:"none"}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:levelColor[item.level],flexShrink:0,boxShadow:`0 0 0 3px ${levelColor[item.level]}25`}}/>
            <span style={{fontSize:16,flexShrink:0}}>{item.icon}</span>
            <p style={{flex:1,color:t.text,fontSize:12,fontWeight:500}}>{item.label}</p>
            <button onClick={item.action} style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:8,padding:"5px 11px",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>{item.actionLabel}</button>
          </div>
        ))}
      </div>}

      {/* ── TODAY AT A GLANCE ── */}
      <div style={{...card(),overflow:"hidden"}}>
        <div style={{padding:"16px 20px 14px",background:dm?"linear-gradient(135deg,rgba(37,99,235,0.2) 0%,rgba(99,102,241,0.12) 100%)":"linear-gradient(135deg,rgba(37,99,235,0.08) 0%,rgba(99,102,241,0.04) 100%)",borderBottom:`1px solid ${t.border}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <div>
              <p style={sectionLabel}>📦 Today's Deliveries</p>
              <div style={{display:"flex",alignItems:"baseline",gap:10}}>
                <p style={{color:t.text,fontWeight:900,fontSize:32,lineHeight:1,letterSpacing:"-0.03em"}}>{todayDelivs.length}</p>
                <p style={{color:t.sub,fontSize:13}}>orders today</p>
                {todayDone.length>0&&<span style={{background:"#10b98120",color:"#10b981",borderRadius:99,padding:"20px 28px",fontSize:10,fontWeight:700}}>{Math.round(todayDone.length/Math.max(todayDelivs.length,1)*100)}% done</span>}
              </div>
            </div>
            <button onClick={()=>setTab("Deliveries")} style={{background:"rgba(255,255,255,0.1)",color:t.sub,border:`1px solid ${t.border}`,borderRadius:12,padding:"16px 24px",fontSize:12,fontWeight:700,cursor:"pointer"}}>View all →</button>
          </div>
        </div>
        <div style={{padding:"14px 20px"}}>
          {(()=>{
            const total=todayDelivs.length;
            const segments=[
              {label:"Delivered",val:todayDone.length,color:"#10b981",bg:dm?"#10b98118":"#f0fdf4"},
              {label:"In Transit",val:todayTransit.length,color:"#3b82f6",bg:dm?"#3b82f618":"#eff6ff"},
              {label:"Pending",val:todayPend.length,color:"#f59e0b",bg:dm?"#f59e0b18":"#fffbeb"},
              {label:"Cancelled",val:todayCancl.length,color:"#ef4444",bg:dm?"#ef444418":"#fef2f2"},
            ];
            if(total===0) return <p style={{color:t.sub,fontSize:13,textAlign:"center",padding:"20px 0"}}>No deliveries scheduled for today.</p>;
            return <div style={{display:"flex",flexDirection:"column",gap:32}}>
              <div style={{height:10,borderRadius:10,overflow:"hidden",display:"flex",gap:2,marginBottom:14,background:t.border}}>
                {segments.map(s=>s.val>0&&<div key={s.label} style={{width:`${Math.round(s.val/total*100)}%`,background:s.color,transition:"width 0.7s ease",borderRadius:10}}/>)}
              </div>
              <div className="crm-grid-4" style={{gap:20}}>
                {segments.map(({label,val,color,bg})=>(
                  <div key={label}
                    style={{background:bg,borderRadius:14,padding:"10px 8px",textAlign:"center",border:`1px solid ${color}22`,cursor:"pointer"}}
                    onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";setKpiHover(label);}}
                    onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";setKpiHover(null);}}>
                    <p style={{color,fontWeight:900,fontSize:22,lineHeight:1}}>{val}</p>
                    <p style={{color,fontSize:9,fontWeight:700,marginTop:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</p>
                  </div>
                ))}
              </div>
            </div>;
          })()}
        </div>
      </div>

      {/* ── OUTSTANDING PAYMENTS ── */}
      {canSeeFinancials&&allDue.length>0&&(()=>{
        const totalBilled=customers.reduce((s,c)=>(s+(c.paid||0)+(c.pending||0)),0);
        const collPct=totalBilled>0?Math.round(customers.reduce((s,c)=>s+(c.paid||0),0)/totalBilled*100):100;
        return <div style={{...glassCard("#ef4444"),padding:"18px 20px"}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
            <div>
              <p style={sectionLabel}>💳 Outstanding Payments</p>
              <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                <p style={{color:"#ef4444",fontWeight:900,fontSize:26,lineHeight:1,letterSpacing:"-0.02em"}}>{inr(totalDueAmt)}</p>
                <p style={{color:t.sub,fontSize:12}}>from {allDue.length} customer{allDue.length!==1?"s":""}</p>
              </div>
            </div>
            {isAdmin&&<button onClick={()=>setTab("Payments")} style={{background:"#ef444412",color:"#ef4444",border:"1px solid #ef444430",borderRadius:12,padding:"13px 22px",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0}}>Full Ledger →</button>}
          </div>
          <div style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:t.sub,marginBottom:5}}>
              <span style={{fontWeight:600}}>Collection Rate</span>
              <span style={{fontWeight:800,color:collPct>=90?"#10b981":collPct>=70?"#f59e0b":"#ef4444"}}>{collPct}%</span>
            </div>
            <div style={{height:7,borderRadius:8,overflow:"hidden",background:t.border}}>
              <div style={{width:`${collPct}%`,background:collPct>=90?"#10b981":collPct>=70?"#f59e0b":"#ef4444",transition:"width 0.7s",height:"100%",borderRadius:8}}/>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:0}}>
            {[...allDue].sort((a,b)=>b.pending-a.pending).slice(0,5).map((c,i,arr)=>{
              const billed=(c.paid||0)+(c.pending||0);
              const pct=billed>0?Math.round((c.paid||0)/billed*100):0;
              const isLast=i>=Math.min(allDue.length,5)-1;
              return <div key={c.id} style={{display:"flex",alignItems:"center",gap:24,padding:"10px 0",borderBottom:!isLast?`1px solid ${t.border}`:"none"}}>
                <div style={{width:26,height:26,borderRadius:8,background:i===0?"#ef444418":t.inp,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{color:i===0?"#ef4444":t.sub,fontWeight:800,fontSize:12}}>{i+1}</span>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <p style={{color:t.text,fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{c.name}</p>
                    <p style={{color:"#ef4444",fontWeight:800,fontSize:13,flexShrink:0,marginLeft:10}}>{inr(c.pending)}</p>
                  </div>
                  <div style={{height:4,borderRadius:4,overflow:"hidden",background:t.border}}>
                    <div style={{width:`${pct}%`,background:"#10b981",height:"100%",transition:"width 0.5s"}}/>
                  </div>
                </div>
                {can("cust_markPaid")&&<button
                  onClick={()=>{if(isAdmin){setPayLedgerCust(c);setPayLedgerAmt(String(c.pending||""));setPayLedgerNote("");setPayLedgerMethod("Cash");setPayLedgerSh(true);}else{setPaySh(c);setPayAmt("");}}}
                  style={{background:"#f59e0b",color:"#000",border:"none",borderRadius:10,padding:"7px 13px",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0,boxShadow:"0 2px 8px rgba(245,158,11,0.3)"}}>
                  Collect
                </button>}
              </div>;
            })}
          </div>
          {allDue.length>5&&<p style={{color:t.sub,fontSize:11,textAlign:"center",paddingTop:8,fontWeight:600}}>+{allDue.length-5} more customers with outstanding dues</p>}
        </div>;
      })()}

      {/* ── TODAY'S PENDING DELIVERY LIST ── */}
      {(todayPend.length>0||todayTransit.length>0)&&<div style={card({overflow:"hidden"})}>
        <div style={{padding:"14px 20px 12px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <p style={sectionLabel}>🚚 Needs Action Today</p>
            <p style={{color:t.text,fontWeight:700,fontSize:15}}>{todayPend.length+todayTransit.length} order{todayPend.length+todayTransit.length!==1?"s":""} pending</p>
          </div>
          <button onClick={()=>setTab("Deliveries")} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:10,padding:"6px 13px",fontSize:11,fontWeight:700,cursor:"pointer"}}>All →</button>
        </div>
        {[...todayTransit,...todayPend].slice(0,8).map((d,i,arr)=>{
          const tot=lineTotal(d.orderLines);
          const items=Object.values(safeO(d.orderLines)).filter(l=>l.qty>0);
          const isTransit=d.status==="In Transit";
          return <div key={d.id} style={{padding:"22px 28px",borderBottom:i<arr.length-1?`1px solid ${t.border}`:"none",display:"flex",alignItems:"center",gap:24,background:isTransit?(dm?"rgba(59,130,246,0.04)":"rgba(59,130,246,0.02)"):"transparent"}}>
            <div style={{width:38,height:38,borderRadius:12,background:isTransit?"#3b82f615":"#f59e0b15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{isTransit?"🚚":"⏳"}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:28,marginBottom:20}}>
                <p style={{color:t.text,fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.customer}</p>
                {isTransit&&<span style={{background:"#3b82f615",color:"#3b82f6",borderRadius:5,padding:"1px 6px",fontSize:9,fontWeight:700,flexShrink:0}}>EN ROUTE</span>}
              </div>
              <p style={{color:t.sub,fontSize:11}}>
                {items.slice(0,2).map(l=>`${l.qty}×${l.name||""}`).join(", ")}{items.length>2?` +${items.length-2} more`:""}
                {canSeePrices&&tot>0?<span style={{color:t.text,fontWeight:600}}> · {inr(tot)}</span>:""}
              </p>
            </div>
            <div style={{display:"flex",gap:28,flexShrink:0}}>
              {d.address&&<a href={mapU(d.address,d.lat,d.lng)} target="_blank" rel="noopener noreferrer" style={{background:"#0ea5e912",color:"#0ea5e9",borderRadius:9,padding:"7px 11px",fontSize:13,fontWeight:700,textDecoration:"none",lineHeight:1}}>📍</a>}
              {can("deliv_markDone")&&<button onClick={()=>tglD(d)} style={{background:"#10b981",color:"#fff",border:"none",borderRadius:10,padding:"7px 13px",fontSize:11,fontWeight:700,cursor:"pointer",boxShadow:"0 2px 6px rgba(16,185,129,0.3)"}}>✓ Done</button>}
            </div>
          </div>;
        })}
        {todayPend.length+todayTransit.length>8&&<div style={{padding:"20px 28px",textAlign:"center",borderTop:`1px solid ${t.border}`,background:t.inp}}>
          <button onClick={()=>setTab("Deliveries")} style={{color:t.accent,background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:700}}>+{todayPend.length+todayTransit.length-8} more — view all →</button>
        </div>}
      </div>}

      {/* ── PRODUCTION STATUS ── */}
      {(isAdmin||isFactory)&&todayPT.length>0&&(()=>{
        const byProduct=products.map(p=>{
          const pts=todayPT.filter(x=>x.product===p.name||x.product===p.id);
          const act=pts.reduce((s,x)=>s+(x.actual||0),0);
          const tgt=pts.reduce((s,x)=>s+(x.target||0),0);
          return {name:p.name,actual:act,target:tgt,pct:tgt>0?Math.round(act/tgt*100):null};
        }).filter(x=>x.actual>0||x.target>0);
        const prodColor=prodPct===null?"#6366f1":prodPct>=100?"#10b981":prodPct>=70?"#f59e0b":"#ef4444";
        return <div style={glassCard("#6366f1",{padding:"18px 20px"})}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div>
              <p style={sectionLabel}>🏭 Today's Production</p>
              <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                <p style={{color:t.text,fontWeight:900,fontSize:26,lineHeight:1,letterSpacing:"-0.02em"}}>{totalActual.toLocaleString("en-IN")}</p>
                {totalTarget>0&&<p style={{color:t.sub,fontSize:13}}>/ {totalTarget.toLocaleString("en-IN")} target</p>}
              </div>
            </div>
            {prodPct!==null&&<div style={{textAlign:"center"}}>
              <div style={{width:56,height:56,borderRadius:"50%",background:`${prodColor}18`,border:`3px solid ${prodColor}`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 0 20px ${prodColor}30`}}>
                <p style={{color:prodColor,fontWeight:900,fontSize:14,lineHeight:1}}>{prodPct}%</p>
              </div>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,marginTop:4,textTransform:"uppercase"}}>Efficiency</p>
            </div>}
          </div>
          {totalTarget>0&&<div style={{height:8,borderRadius:8,overflow:"hidden",background:t.border,marginBottom:14}}>
            <div style={{width:`${Math.min(prodPct||0,100)}%`,background:`linear-gradient(90deg,${prodColor},${prodColor}aa)`,transition:"width 0.8s ease",height:"100%",borderRadius:8}}/>
          </div>}
          {byProduct.length>0&&<div style={{display:"flex",flexDirection:"column",gap:20,marginBottom:12}}>
            {byProduct.map(p=>(
              <div key={p.name} style={{display:"flex",alignItems:"center",gap:10}}>
                <p style={{color:t.sub,fontSize:12,minWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</p>
                <div style={{flex:1,height:6,borderRadius:6,overflow:"hidden",background:t.border}}>
                  <div style={{width:`${Math.min(p.pct||0,100)}%`,background:"#6366f1",height:"100%",transition:"width 0.5s"}}/>
                </div>
                <p style={{color:t.text,fontSize:12,fontWeight:700,minWidth:56,textAlign:"right"}}>{p.actual}{p.target>0&&<span style={{color:t.sub,fontWeight:400}}>/{p.target}</span>}</p>
              </div>
            ))}
          </div>}
          {todayWastage.length>0&&<div style={{marginTop:10,padding:"9px 14px",background:"#f9731610",border:"1px solid #f9731630",borderRadius:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <p style={{color:"#f97316",fontSize:12,fontWeight:700}}>🗑 Wastage today: {todayWastage.length} record{todayWastage.length!==1?"s":""}</p>
            {can("waste_seeCost")&&todayWasteCost>0&&<p style={{color:"#ef4444",fontSize:12,fontWeight:800}}>{inr(todayWasteCost)}</p>}
          </div>}
          <button onClick={()=>setTab("Production")} style={{marginTop:12,width:"100%",background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:12,padding:"9px",fontSize:12,fontWeight:700,cursor:"pointer"}}>View Production Log →</button>
        </div>;
      })()}

      {/* ── OVERDUE DELIVERIES ── */}
      {isAdmin&&overdueD.length>0&&<div style={{...glassCard("#ef4444"),padding:"28px 30px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div>
            <p style={{...sectionLabel,color:"#ef4444"}}>🔴 Overdue Deliveries</p>
            <p style={{color:t.text,fontWeight:700,fontSize:15}}>{overdueD.length} order{overdueD.length!==1?"s":""} past due</p>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {overdueD.slice(0,4).map(d=>{
            const cust=customers.find(c=>c.id===d.customerId);
            const daysAgo=Math.round((new Date()-new Date(d.date))/86400000);
            return <div key={d.id} style={{background:dm?"rgba(239,68,68,0.07)":"rgba(239,68,68,0.05)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:14,padding:"11px 14px",display:"flex",alignItems:"center",gap:10}}>
              <div style={{flex:1,minWidth:0}}>
                <p style={{color:t.text,fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.customer}</p>
                <p style={{color:"#ef4444",fontSize:11,fontWeight:600,marginTop:20}}>{daysAgo} day{daysAgo!==1?"s":""} overdue · {d.date}</p>
              </div>
              <div style={{display:"flex",gap:28,flexShrink:0}}>
                {cust?.phone&&<a href={`tel:${cust.phone}`} style={{background:"#10b98115",color:"#10b981",borderRadius:9,padding:"6px 11px",fontSize:12,fontWeight:700,textDecoration:"none"}}>📞</a>}
                {can("deliv_markDone")&&<button onClick={()=>{setDeliv(p=>safeArr(p).map(x=>x.id===d.id?{...x,status:"Delivered",deliveryDate:today()}:x));addLog("Marked overdue delivered",d.customer);notify(`${d.customer} ✓`);captureGPS("marked_delivered",d.customer);}}
                  style={{background:"#10b98120",color:"#10b981",border:"none",borderRadius:9,padding:"6px 11px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✓ Done</button>}
              </div>
            </div>;
          })}
          {overdueD.length>4&&<div style={{textAlign:"center",paddingTop:2}}>
            <button onClick={()=>setTab("Deliveries")} style={{color:"#f59e0b",background:"none",border:"none",cursor:"pointer",fontWeight:700,fontSize:11}}>+{overdueD.length-4} more →</button>
          </div>}
        </div>
      </div>}

      {/* ── AI INSIGHTS ── */}
      {aiInsights.length>0&&<div style={{...glassCard("#8b5cf6"),overflow:"hidden"}}>
        <div style={{padding:"14px 18px 12px",borderBottom:`1px solid ${t.border}`,background:dm?"linear-gradient(135deg,rgba(139,92,246,0.15) 0%,rgba(99,102,241,0.08) 100%)":"linear-gradient(135deg,rgba(139,92,246,0.07) 0%,rgba(99,102,241,0.03) 100%)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:28,height:28,borderRadius:9,background:"#8b5cf620",border:"1px solid #8b5cf630",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🧠</div>
              <div>
                <p style={{color:t.text,fontWeight:800,fontSize:13,lineHeight:1}}>Smart Insights</p>
                <p style={{color:t.sub,fontSize:10,marginTop:1}}>Patterns detected in your data</p>
              </div>
            </div>
            <span style={{background:"#8b5cf615",color:"#8b5cf6",border:"1px solid #8b5cf625",borderRadius:99,padding:"13px 22px",fontSize:9,fontWeight:800,letterSpacing:"0.05em"}}>AI POWERED</span>
          </div>
        </div>
        <div style={{padding:"6px 0"}}>
          {aiInsights.map((ins,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:24,padding:"10px 18px",borderBottom:i<aiInsights.length-1?`1px solid ${t.border}`:"none"}}>
              <span style={{fontSize:18,flexShrink:0,lineHeight:1}}>{ins.icon}</span>
              <p style={{color:t.text,fontSize:13,lineHeight:1.4,fontWeight:500}}>{ins.text}</p>
            </div>
          ))}
        </div>
      </div>}

      {/* ── LIVE ACTIVITY FEED ── */}
      {feedItems.length>0&&<div style={{...card(),overflow:"hidden"}}>
        <div style={{padding:"14px 18px 12px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:dm?"linear-gradient(135deg,rgba(14,165,233,0.12) 0%,rgba(59,130,246,0.06) 100%)":"linear-gradient(135deg,rgba(14,165,233,0.06) 0%,rgba(59,130,246,0.02) 100%)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:28,height:28,borderRadius:9,background:"#0ea5e920",border:"1px solid #0ea5e930",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>📡</div>
            <div>
              <p style={{color:t.text,fontWeight:800,fontSize:13,lineHeight:1}}>Recent Activity</p>
              <p style={{color:t.sub,fontSize:10,marginTop:1}}>Latest operations log</p>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:"#10b981",boxShadow:"0 0 0 3px rgba(16,185,129,0.25)",animation:"pulse 2s infinite"}}/>
            <span style={{color:"#10b981",fontSize:10,fontWeight:700}}>LIVE</span>
          </div>
        </div>
        <div style={{padding:"6px 0"}}>
          {feedItems.slice(0,6).map((item,i)=>{
            const relTime=(()=>{if(!item.ts)return"";const diff=Math.floor((new Date()-new Date(item.ts))/60000);if(diff<1)return"just now";if(diff<60)return`${diff}m ago`;const hrs=Math.floor(diff/60);if(hrs<24)return`${hrs}h ago`;return`${Math.floor(hrs/24)}d ago`;})();
            return <div key={i} style={{display:"flex",alignItems:"center",gap:24,padding:"10px 18px",borderBottom:i<Math.min(feedItems.length,6)-1?`1px solid ${t.border}`:"none"}}>
              <div style={{width:3,height:28,borderRadius:2,background:item.color,flexShrink:0}}/>
              <span style={{fontSize:16,flexShrink:0,lineHeight:1}}>{item.icon}</span>
              <div style={{flex:1,minWidth:0}}>
                <p style={{color:t.text,fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.text}</p>
                <p style={{color:t.sub,fontSize:10,marginTop:1}}>{relTime||item.ts}</p>
              </div>
              {item.sub&&<span style={{color:item.color,fontWeight:800,fontSize:12,flexShrink:0}}>{item.sub}</span>}
            </div>;
          })}
        </div>
      </div>}

      {/* ── WEATHER ── */}
      {widgets?.includes("weather")&&<WeatherWidget dm={dm} lat={settings?.weatherLat||15.4909} lng={settings?.weatherLng||73.8278} locLabel={settings?.weatherLabel||"Goa"}/>}

      {/* ── QUICK ACTIONS ── */}
      {widgets?.includes("quickActions")&&(settings?.quickActions||[]).length>0&&<div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <p style={sectionLabel}>⚡ Quick Actions</p>
          <span style={{color:t.sub,fontSize:10,fontWeight:600}}>{(settings?.quickActions||[]).length} shortcuts</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(180px,100%),1fr))",gap:8}}>
          {[
            {key:"newDelivery",icon:"🚚",label:"New Delivery",action:()=>{setDsh("add");setDf(blkD());}},
            {key:"newCustomer",icon:"👤",label:"New Customer",action:()=>{setCsh("add");setCf(blkC());}},
            {key:"markDone",icon:"✅",label:"Mark Delivered",action:()=>setTab("Deliveries")},
            {key:"logWastage",icon:"🗑️",label:"Log Wastage",action:()=>{setWSh("add");setWF(blkW());}},
            {key:"addExpense",icon:"💸",label:"Add Expense",action:()=>{setEsh("add");setEf(blkE());}},
            {key:"logSupply",icon:"📦",label:"Log Supply",action:()=>{setSsh("add");setSf(blkS());}},
            {key:"logProduction",icon:"🏭",label:"Log Production",action:()=>setTab("Production")},
            {key:"qcCheck",icon:"🔬",label:"QC Check",action:()=>setTab("Production")},
          ].filter(q=>(settings?.quickActions||[]).includes(q.key)).map(q=>(
            <button key={q.key} onClick={q.action}
              style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"14px 8px",display:"flex",flexDirection:"column",alignItems:"center",gap:7,cursor:"pointer",transition:"all 0.15s",boxShadow:dm?"0 2px 8px rgba(0,0,0,0.2)":"0 1px 4px rgba(0,0,0,0.06)"}}>
              <span style={{fontSize:24}}>{q.icon}</span>
              <span style={{color:t.text,fontSize:10,fontWeight:700,textAlign:"center",lineHeight:1.3}}>{q.label}</span>
            </button>
          ))}
        </div>
      </div>}

      {/* ── TOP CUSTOMERS ── */}
      {canSeeFinancials&&(()=>{
        const topCusts=[...customers].filter(c=>((c.paid||0)+(c.pending||0))>0).sort((a,b)=>((b.paid||0)+(b.pending||0))-((a.paid||0)+(a.pending||0))).slice(0,5);
        if(topCusts.length===0) return null;
        const maxBilled=(topCusts[0].paid||0)+(topCusts[0].pending||0);
        return <div style={{...card(),padding:"18px 20px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div>
              <p style={sectionLabel}>🏆 Top Customers</p>
              <p style={{color:t.text,fontWeight:700,fontSize:14}}>By total order value</p>
            </div>
            <button onClick={()=>setTab("Customers")} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:10,padding:"6px 13px",fontSize:11,fontWeight:700,cursor:"pointer"}}>All →</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:0}}>
            {topCusts.map((c,i)=>{
              const billed=(c.paid||0)+(c.pending||0);
              const paidPct=billed>0?Math.round((c.paid||0)/billed*100):100;
              const widthPct=maxBilled>0?Math.round(billed/maxBilled*100):0;
              const medals=["🥇","🥈","🥉"];
              return <div key={c.id} style={{display:"flex",alignItems:"center",gap:24,padding:"11px 0",borderBottom:i<topCusts.length-1?`1px solid ${t.border}`:"none"}}>
                <span style={{fontSize:16,flexShrink:0,lineHeight:1}}>{medals[i]||`#${i+1}`}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <p style={{color:t.text,fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</p>
                    <p style={{color:t.text,fontWeight:800,fontSize:12,flexShrink:0,marginLeft:8}}>{inr(billed)}</p>
                  </div>
                  <div style={{position:"relative",height:5,borderRadius:4,overflow:"hidden",background:t.border}}>
                    <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${widthPct}%`,background:"#3b82f6",borderRadius:4,transition:"width 0.6s ease"}}/>
                    <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${Math.round(widthPct*paidPct/100)}%`,background:"#10b981",borderRadius:4,transition:"width 0.6s ease"}}/>
                  </div>
                  <p style={{color:t.sub,fontSize:10,marginTop:10}}>{paidPct}% collected · {inr(c.pending||0)} pending</p>
                </div>
              </div>;
            })}
          </div>
        </div>;
      })()}

      {/* ── NOTICE BOARD ── */}
      {(()=>{
        const unreadNotices=(notices||[]).filter(n=>!(n.readBy||[]).includes(sess.id));
        function saveNotice(){
          if(!nbF.title.trim()||!nbF.body.trim()){notify("Title and message required");return;}
          const rec={...nbF,id:uid(),postedBy:sess.name,postedAt:ts(),readBy:[]};
          setNotices(p=>[rec,...p]);
          addLog("Notice posted",rec.title);
          addNotif("📌 Notice: "+rec.title,rec.body,"info","noticeboard");
          notify("Notice posted ✓");
          setNbSh(false);
          setNbF({title:"",body:"",pinned:false});
        }
        function markRead(id){setNotices(p=>safeArr(p).map(n=>n.id===id?{...n,readBy:[...(n.readBy||[]),sess.id]}:n));}
        return (<>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <p style={{color:t.text,fontWeight:700,fontSize:13}}>📌 Notice Board</p>
              {unreadNotices.length>0&&<Pill dm={dm} c="sky">{unreadNotices.length} new</Pill>}
            </div>
            {can("dash_postNotice")&&<Btn dm={dm} size="sm" onClick={()=>{setNbF({title:"",body:"",pinned:false});setNbSh(true);}}>+ Post</Btn>}
          </div>
          {(notices||[]).length===0&&<div style={{background:t.inp,borderRadius:14,padding:"20px",textAlign:"center"}}><p style={{color:t.sub}} className="text-sm">No notices posted yet.</p></div>}
          {[...(notices||[])].sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)).map(n=>{
            const isRead=(n.readBy||[]).includes(sess.id);
            return <div key={n.id} style={{background:n.pinned?(dm?"rgba(245,158,11,0.08)":"rgba(245,158,11,0.06)"):t.card,border:`1.5px solid ${n.pinned?"rgba(245,158,11,0.3)":isRead?t.border:"rgba(14,165,233,0.3)"}`,borderRadius:16,padding:"24px 26px",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:6,gap:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:20,marginBottom:3,flexWrap:"wrap"}}>
                    {n.pinned&&<span style={{background:"#f59e0b20",color:"#f59e0b",borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:700}}>📌 Pinned</span>}
                    {!isRead&&<span style={{background:"#0ea5e920",color:"#0ea5e9",borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:700}}>New</span>}
                    <p style={{color:t.text,fontWeight:700,fontSize:13}}>{n.title}</p>
                  </div>
                  <p style={{color:t.sub,fontSize:11}}>by {n.postedBy} · {n.postedAt}</p>
                </div>
                <div style={{display:"flex",gap:28,flexShrink:0}}>
                  {!isRead&&<button onClick={()=>markRead(n.id)} style={{background:"#0ea5e920",color:"#0ea5e9",border:"none",borderRadius:8,padding:"4px 9px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Mark read</button>}
                  {can("dash_delNotice")&&<button onClick={()=>setNotices(p=>safeArr(p).filter(x=>x.id!==n.id))} style={{background:t.inp,color:t.sub,border:"none",borderRadius:8,padding:"4px 9px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Delete</button>}
                </div>
              </div>
              <p style={{color:t.text,lineHeight:1.6,fontSize:13}}>{n.body}</p>
            </div>;
          })}
          <Sheet dm={dm} open={nbSh} onClose={()=>setNbSh(false)} title="Post Notice">
            <Inp dm={dm} label="Title *" value={nbF.title} onChange={e=>setNbF({...nbF,title:e.target.value})} placeholder="e.g. Holiday schedule update"/>
            <div>
              <label style={{color:T(dm).sub}} className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 ml-0.5">Message *</label>
              <textarea value={nbF.body} onChange={e=>setNbF({...nbF,body:e.target.value})} placeholder="Write your announcement here…" rows={5}
                style={{width:"100%",background:T(dm).inp,border:`1.5px solid ${T(dm).inpB}`,color:T(dm).text,borderRadius:14,padding:"18px 22px",fontSize:13,outline:"none",resize:"vertical",fontFamily:"system-ui"}}/>
            </div>
            <div style={{background:T(dm).inp,borderRadius:14,padding:"22px 26px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <p style={{color:T(dm).text,fontSize:14,fontWeight:600}}>Pin this notice</p>
                <p style={{color:T(dm).sub,fontSize:11}}>Pinned notices appear at the top</p>
              </div>
              <Tog dm={dm} on={nbF.pinned} onChange={()=>setNbF(f=>({...f,pinned:!f.pinned}))}/>
            </div>
            <Btn dm={dm} onClick={saveNotice} className="w-full">Post Notice</Btn>
          </Sheet>
        </>);
      })()}
    </div>
  );
}
