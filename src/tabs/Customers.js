/* eslint-disable react-hooks/exhaustive-deps, no-unused-vars */
// TAB: Customers
import React from "react";

export default function CustomersTab({
  dm, t, T, sess, isAdmin, can, canSeePrices, canSeeFinancials,
  customers, activeC, deliveries, products, settings,
  dashStats, dashTotalCollected, totalDue, dashReplacementCount, totalReplDeductions,
  dashPartialCount, dashPartialTotal,
  inr, lineTotal, safeO, safeArr, today, ts, uid,
  notify, addLog, addNotif, captureGPS, ask,
  setTab, setCsh, setCf, blkC,
  csh, cf,
  setDeliv, setPaySh, setPayAmt,
  setPayLedgerSh, setPayLedgerCust, setPayLedgerAmt, setPayLedgerNote, setPayLedgerMethod,
  overdueAlertExpanded, setOverdueAlertExpanded, overdueAlertDays, setOverdueAlertDays,
  clvFilter, setClvFilterP, clvSort, setClvSort,
  invRegistry, paymentLedger, mergeEnabled, recordPaymentLedger,
  setPaymentsSubTab,
  exportTabPDF, exportTabExcel, exportCSV, exportPDF, exportCustomerReports,
  Btn, Inp, Sel, Card, Sheet, Tog, Pill, Hr, SectionHeader, TabStatCards, StatusPill,
}) {
  const [isMobile, setIsMobile] = React.useState(typeof window!=="undefined"&&window.innerWidth<768);
  React.useEffect(()=>{
    const handler=()=>setIsMobile(window.innerWidth<768);
    window.addEventListener("resize",handler);
    return()=>window.removeEventListener("resize",handler);
  },[]);

  // ── All local state (previously missing — caused blank renders) ──
  const [custSearch, setCustSearch] = React.useState("");
  const [custView, setCustView] = React.useState("expanded");
  const [custStatusFilter, setCustStatusFilter] = React.useState("all");
  const [custSortField, setCustSortField] = React.useState("lastOrder");
  const [selectedCustomer, setSelectedCustomer] = React.useState(null);
  const [custDetailDelivFilter, setCustDetailDelivFilter] = React.useState("all");
  const [custDetailPartialAmt, setCustDetailPartialAmt] = React.useState("");

  // ── Filtered customer list (was undefined, causing crash) ──
  const fCust = React.useMemo(() => {
    const q = custSearch.trim().toLowerCase();
    if(!q) return safeArr(customers);
    return safeArr(customers).filter(c =>
      (c.name||"").toLowerCase().includes(q) ||
      (c.phone||"").toLowerCase().includes(q) ||
      (c.address||"").toLowerCase().includes(q)
    );
  }, [customers, custSearch]);
  return (
<div style={{display:"flex",flexDirection:"column",gap:32}}>
          <SectionHeader dm={dm} title="Customers" sub="Manage all your customers in one place"
            cta={can("cust_add")&&<button onClick={()=>{setCsh("add");setCf(blkC());}}
              style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:12,padding:"14px 22px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:7,boxShadow:"0 2px 8px rgba(37,99,235,0.3)"}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Customer
            </button>}/>
          {canSeeFinancials&&<TabStatCards dm={dm} cards={[
            {icon:"👥",label:"Active Customers",value:activeC.length,sub:`${customers.length} total`,iconBg:t.statIcon1},
            {icon:"💰",label:"Total Collected",value:inr(dashTotalCollected),sub:"All time",iconBg:t.statIcon2},
            {icon:"⚠️",label:"Outstanding",value:inr(totalDue),sub:`${dashStats.allDue.length} unpaid`,iconBg:t.statIcon5},
            {icon:"🔄",label:"Replacements",value:dashReplacementCount,sub:inr(totalReplDeductions)+" deducted",iconBg:t.statIcon3},
            {icon:"⚡",label:"Partial Payments",value:dashPartialCount,sub:inr(dashPartialTotal)+" collected",iconBg:t.statIcon4},
          ]}/>}

          {/* OVERDUE PAYMENT ALERT BANNER */}
          {canSeeFinancials&&(()=>{
            const overdueC=customers.filter(c=>c.pending>0&&c.active);
            const totalOverdue=overdueC.reduce((s,c)=>s+(c.pending||0),0);
            const totalReplDeducted=deliveries.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
            const partialCount=deliveries.filter(d=>d.partialPayment?.enabled&&(+(d.partialPayment?.amount)||0)>0&&Math.max(0,lineTotal(d.orderLines)-(+d.replacement?.amount||0))>(+(d.partialPayment?.amount)||0)).length;
            if(!overdueC.length) return null;
            return <div style={{background:dm?"rgba(239,68,68,0.07)":"#fff5f5",border:`1.5px solid ${dm?"rgba(239,68,68,0.25)":"rgba(239,68,68,0.25)"}`,borderRadius:18,overflow:"hidden"}}>
              {/* Header stripe */}
              <div style={{background:dm?"rgba(239,68,68,0.12)":"rgba(239,68,68,0.08)",borderBottom:isMobile?(overdueAlertExpanded?`1px solid ${dm?"rgba(239,68,68,0.2)":"rgba(239,68,68,0.15)"}`:"none"):`1px solid ${dm?"rgba(239,68,68,0.2)":"rgba(239,68,68,0.15)"}`,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:isMobile?"nowrap":"wrap",gap:12,cursor:isMobile?"pointer":"default"}}
                onClick={isMobile?()=>setOverdueAlertExpanded&&setOverdueAlertExpanded(v=>!v):undefined}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:32,height:32,borderRadius:10,background:"#ef444420",border:"1.5px solid #ef444430",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🔴</div>
                  <div>
                    <p style={{color:"#dc2626",fontWeight:800,fontSize:13,lineHeight:1.2}}>{overdueC.length} customer{overdueC.length!==1?"s":""} with overdue payments</p>
                    <p style={{color:dm?"#fca5a5":"#b91c1c",fontSize:11,fontWeight:600,marginTop:2}}>Total outstanding: <span style={{fontWeight:800}}>{inr(totalOverdue)}</span></p>
                  </div>
                </div>
                {isMobile
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" style={{flexShrink:0,transform:overdueAlertExpanded?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}><polyline points="6 9 12 15 18 9"/></svg>
                  : <div style={{display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
                    {totalReplDeducted>0&&<span style={{background:"#f9731612",color:"#f97316",border:"1px solid #f9731625",borderRadius:20,padding:"7px 15px",fontSize:10,fontWeight:700}}>🔄 {inr(totalReplDeducted)} replaced</span>}
                    {partialCount>0&&<span style={{background:"#f59e0b12",color:"#f59e0b",border:"1px solid #f59e0b25",borderRadius:20,padding:"7px 15px",fontSize:10,fontWeight:700}}>⚡ {partialCount} partial</span>}
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <label style={{color:t.sub,fontSize:11}}>Over</label>
                      <select value={overdueAlertDays} onChange={e=>setOverdueAlertDays(+e.target.value)} style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,fontSize:12,borderRadius:8,padding:"4px 8px",outline:"none"}}>
                        {[1,3,7,14,30].map(d=><option key={d} value={d}>{d}d</option>)}
                      </select>
                    </div>
                    <div style={{display:"flex",gap:8,flexWrap:"nowrap",alignItems:"center",flexShrink:0}}>
                    {isAdmin&&<button onClick={()=>{setPaymentsSubTab("outstanding");setTab("Payments");}} style={{background:"#3b82f615",color:"#3b82f6",border:"1px solid #3b82f630",borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>Full Ledger →</button>}
                    <Btn dm={dm} v="danger" size="sm" onClick={()=>{
                      const cols=[{label:"Customer",key:"name"},{label:"Phone",key:"phone"},{label:"Pending (₹)",key:"pending",num:true},{label:"Status",val:r=>r.pending>0?"UNPAID":"PAID"}];
                      exportTabPDF("Overdue Payments",[...overdueC].sort((a,b)=>b.pending-a.pending),cols,settings,`<div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:10px;padding:12px 16px;margin-bottom:20px"><b style="color:#b91c1c">Total Outstanding: ${inr(totalOverdue)}</b> across ${overdueC.length} customers</div>`);
                    }}>PDF</Btn>
                    </div>
                  </div>
                }
              </div>
              {/* Customer rows — always visible on desktop, toggle on mobile */}
              {(!isMobile||overdueAlertExpanded)&&<div style={{padding:"18px 22px",display:"flex",flexDirection:"column",gap:6}}>
                {isMobile&&<div style={{display:"flex",alignItems:"center",gap:20,flexWrap:"wrap",paddingBottom:8,borderBottom:`1px solid rgba(239,68,68,0.15)`,marginBottom:12}}>
                  {totalReplDeducted>0&&<span style={{background:"#f9731612",color:"#f97316",border:"1px solid #f9731625",borderRadius:20,padding:"7px 15px",fontSize:10,fontWeight:700}}>🔄 {inr(totalReplDeducted)} replaced</span>}
                  {partialCount>0&&<span style={{background:"#f59e0b12",color:"#f59e0b",border:"1px solid #f59e0b25",borderRadius:20,padding:"7px 15px",fontSize:10,fontWeight:700}}>⚡ {partialCount} partial</span>}
                  <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:"auto"}}>
                    <label style={{color:t.sub,fontSize:11}}>Over</label>
                    <select value={overdueAlertDays} onChange={e=>setOverdueAlertDays(+e.target.value)} onClick={e=>e.stopPropagation()} style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,fontSize:12,borderRadius:8,padding:"4px 8px",outline:"none"}}>
                      {[1,3,7,14,30].map(d=><option key={d} value={d}>{d}d</option>)}
                    </select>
                  </div>
                </div>}
                {[...overdueC].sort((a,b)=>b.pending-a.pending).slice(0,5).map((c,idx)=>{
                  const cRepl=deliveries.filter(d=>d.customerId===c.id).reduce((s,d)=>s+(+d.replacement?.amount||0),0);
                  const cPartial=deliveries.filter(d=>d.customerId===c.id&&d.partialPayment?.enabled&&(+(d.partialPayment?.amount)||0)>0&&Math.max(0,lineTotal(d.orderLines)-(+d.replacement?.amount||0))>(+(d.partialPayment?.amount)||0)).length;
                  const intensity=Math.min(1,c.pending/Math.max(1,totalOverdue/overdueC.length));
                  return <div key={c.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderRadius:12,background:dm?"rgba(239,68,68,0.06)":"rgba(239,68,68,0.04)",border:"1px solid rgba(239,68,68,0.12)",gap:12,transition:"background 0.15s"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
                      <div style={{width:24,height:24,borderRadius:7,background:idx===0?"#ef444420":"transparent",border:`1px solid ${idx===0?"#ef4444":"rgba(239,68,68,0.2)"}`,color:idx===0?"#dc2626":"#ef4444",fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{idx+1}</div>
                      <div style={{minWidth:0}}>
                        <span style={{color:t.text,fontWeight:700,fontSize:13}}>{c.name}</span>
                        {c.phone&&<span style={{color:t.sub,fontSize:11,marginLeft:8}}>📞 {c.phone}</span>}
                        {(cRepl>0||cPartial>0)&&<div style={{display:"flex",gap:8,marginTop:4}}>
                          {cRepl>0&&<span style={{color:"#f97316",fontSize:9,fontWeight:600}}>🔄 {inr(cRepl)} replaced</span>}
                          {cPartial>0&&<span style={{color:"#f59e0b",fontSize:9,fontWeight:600,marginLeft:2}}>⚡ partial</span>}
                        </div>}
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                      {!isMobile&&<div style={{width:60,height:4,borderRadius:4,background:dm?"rgba(239,68,68,0.15)":"rgba(239,68,68,0.12)",overflow:"hidden"}}>
                        <div style={{width:`${Math.round(intensity*100)}%`,height:"100%",background:"#ef4444",borderRadius:4}}/>
                      </div>}
                      <span style={{color:"#ef4444",fontWeight:800,fontSize:13,minWidth:isMobile?undefined:60,textAlign:"right"}}>{inr(c.pending)}</span>
                      <button onClick={()=>{if(isAdmin){setPayLedgerCust(c);setPayLedgerAmt(String(c.pending||""));setPayLedgerNote("");setPayLedgerMethod("Cash");setPayLedgerSh(true);}else{setPaySh(c);setPayAmt("");}}}
                        style={{background:"#f59e0b",color:"#000",border:"none",borderRadius:9,padding:"6px 13px",fontSize:11,fontWeight:800,cursor:"pointer",whiteSpace:"nowrap"}}>💰 Collect</button>
                    </div>
                  </div>;
                })}
                {overdueC.length>5&&<p style={{color:t.sub,fontSize:11,textAlign:"center",marginTop:12}}>+{overdueC.length-5} more customers with outstanding payments</p>}
                {isMobile&&isAdmin&&<button onClick={()=>{setPaymentsSubTab("outstanding");setTab("Payments");}} style={{background:"#3b82f615",color:"#3b82f6",border:"1px solid #3b82f630",borderRadius:10,padding:"9px 14px",fontSize:12,fontWeight:700,cursor:"pointer",width:"100%",marginTop:12}}>View Full Ledger →</button>}
              </div>}
            </div>;
          })()}

          {/* CLV DASHBOARD — hidden in Old View */}
          {canSeeFinancials&&clvFilter!=="og"&&(()=>{
            const clvData=customers.map(c=>{
              const cDelivs=deliveries.filter(d=>d.customerId===c.id);
              const cDone=cDelivs.filter(d=>d.status==="Delivered");
              const revenue=cDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
              const orderCount=cDelivs.length;
              const avgOrderVal=cDone.length>0?Math.round(revenue/cDone.length):0;
              const lastD=cDelivs.length>0?[...cDelivs].sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0]:null;
              const daysSinceLast=lastD?Math.floor((new Date()-new Date(lastD.date))/86400000):999;
              const joinDays=c.joinDate?Math.max(1,Math.floor((new Date()-new Date(c.joinDate))/86400000)):90;
              const ordersPerMonth=orderCount>0?(orderCount/(joinDays/30)).toFixed(1):0;
              const clvScore=Math.round(revenue+(avgOrderVal*+ordersPerMonth*3));
              return {c,revenue,orderCount,avgOrderVal,daysSinceLast,ordersPerMonth,clvScore};
            });
            const sorted=[...clvData].sort((a,b)=>{
              if(clvSort==="clv") return b.clvScore-a.clvScore;
              if(clvSort==="orders") return b.orderCount-a.orderCount;
              if(clvSort==="pending") return (b.c.pending||0)-(a.c.pending||0);
              if(clvSort==="days") return a.daysSinceLast-b.daysSinceLast;
              return 0;
            });
            const totalCLV=clvData.reduce((s,x)=>s+x.clvScore,0);
            const avgCLV=clvData.length>0?Math.round(totalCLV/clvData.length):0;
            // clvFilter: "standard" = normal card view, "clv" = CLV detail view
            return <Card dm={dm} className="overflow-hidden">
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <p style={{color:t.text}} className="font-bold text-sm">💰 Customer Value</p>
                    <p style={{color:t.sub}} className="text-[11px]">Projected 3-month lifetime value</p>
                  </div>
                  <div className="flex items-center gap-4">
                    {/* Two-option toggle */}
                    <div style={{background:t.inp,border:`1px solid ${t.border}`,borderRadius:10,padding:3,display:"flex",gap:2}}>
                      {[["og","📋 Old View"],["standard","Standard"],["clv","CLV View"]].map(([val,lbl])=>(
                        <button key={val} onClick={()=>setClvFilterP(val)}
                          style={clvFilter===val
                            ?{background:dm?"#3b82f6":"#1e3a5f",color:"#fff",borderRadius:7,padding:"5px 12px",fontSize:11,fontWeight:700,transition:"all 0.15s"}
                            :{background:"transparent",color:t.sub,borderRadius:7,padding:"5px 12px",fontSize:11,fontWeight:600,transition:"all 0.15s"}
                          }>{lbl}</button>
                      ))}
                    </div>
                    <div className="flex gap-5">
                      <Btn dm={dm} v="outline" size="sm" onClick={()=>{
                        const cols=[{label:"Customer",val:x=>x.c.name},{label:"CLV Score (₹)",key:"clvScore",num:true},{label:"Revenue (₹)",key:"revenue",num:true},{label:"Orders",key:"orderCount",num:true},{label:"Avg Order (₹)",key:"avgOrderVal",num:true},{label:"Days Since Last",key:"daysSinceLast",num:true},{label:"Orders/Month",key:"ordersPerMonth"},{label:"Pending (₹)",val:x=>x.c.pending||0,num:true}];
                        exportTabPDF("Customer Value",sorted,cols,settings,`<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:24px"><div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:12px 14px"><div style="font-size:20px;font-weight:900;color:#92400e">${inr(totalCLV)}</div><div style="font-size:9px;text-transform:uppercase;color:#a8a29e;margin-top:3px">Portfolio CLV</div></div><div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:12px 14px"><div style="font-size:20px;font-weight:900;color:#0369a1">${inr(avgCLV)}</div><div style="font-size:9px;text-transform:uppercase;color:#a8a29e;margin-top:3px">Avg per Customer</div></div></div>`);
                      }}>📄</Btn>
                      <Btn dm={dm} v="outline" size="sm" onClick={()=>{
                        const cols=[{label:"Customer",val:x=>x.c.name},{label:"Phone",val:x=>x.c.phone||""},{label:"CLV Score",key:"clvScore",num:true},{label:"Revenue",key:"revenue",num:true},{label:"Orders",key:"orderCount",num:true},{label:"Avg Order",key:"avgOrderVal",num:true},{label:"Days Since Last",key:"daysSinceLast",num:true},{label:"Orders/Mo",key:"ordersPerMonth"},{label:"Pending",val:x=>x.c.pending||0,num:true}];
                        exportTabExcel("Customer Value",sorted,cols,settings);
                      }}>📊</Btn>
                    </div>
                  </div>
                </div>
                {/* Summary strip */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div style={{background:"#fef3c720",border:"1px solid #fde68a40",borderRadius:10,padding:"8px 12px",textAlign:"center"}}>
                    <p className="font-black text-amber-500 text-sm">{inr(totalCLV)}</p>
                    <p style={{color:t.sub}} className="text-[10px] mt-0.5">Portfolio CLV</p>
                  </div>
                  <div style={{background:t.inp,borderRadius:10,padding:"8px 12px",textAlign:"center"}}>
                    <p style={{color:t.text}} className="font-black text-sm">{inr(avgCLV)}</p>
                    <p style={{color:t.sub}} className="text-[10px] mt-0.5">Avg per Customer</p>
                  </div>
                </div>
                {/* Sort (only shown in CLV view) */}
                {clvFilter==="clv"&&<select value={clvSort} onChange={e=>setClvSort(e.target.value)}
                  style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,fontSize:11,borderRadius:8,padding:"5px 10px",outline:"none",width:"100%"}}>
                  <option value="clv">Sort by CLV Score</option>
                  <option value="orders">Sort by Orders</option>
                  <option value="pending">Sort by Pending</option>
                  <option value="days">Sort by Last Active</option>
                </select>}
              </div>
              <Hr dm={dm}/>
              {clvFilter==="standard"
                /* ── STANDARD VIEW: simple ranked list ── */
                ?sorted.map(({c:cust,revenue,orderCount,daysSinceLast},ci)=>(
                  <div key={cust.id} style={{borderBottom:`1px solid ${t.border}`}} className="px-4 py-3 last:border-0 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span style={{color:t.sub,fontWeight:700,fontSize:12,width:20,textAlign:"right",flexShrink:0}}>{ci+1}</span>
                      <div style={{background:t.inp,width:34,height:34,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:13,color:t.text,flexShrink:0}}>{cust.name.charAt(0).toUpperCase()}</div>
                      <div className="min-w-0">
                        <p style={{color:t.text,fontWeight:700,fontSize:13}} className="truncate">{cust.name}</p>
                        <p style={{color:t.sub,fontSize:10}}>{orderCount} orders · {daysSinceLast===999?"no orders yet":daysSinceLast===0?"today":daysSinceLast+"d ago"}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-emerald-500 text-sm leading-none">{inr(revenue)}</p>
                      <p style={{color:t.sub}} className="text-[10px] mt-0.5">revenue</p>
                    </div>
                  </div>
                ))
                /* ── CLV VIEW: full breakdown with score bar ── */
                :sorted.map(({c:cust,revenue,orderCount,avgOrderVal,daysSinceLast,ordersPerMonth,clvScore},ci)=>{
                  const accent=dm?"#3b82f6":"#1e3a5f";
                  const maxScore=Math.max(...sorted.map(x=>x.clvScore),1);
                  return <div key={cust.id} style={{borderBottom:`1px solid ${t.border}`}} className="px-4 py-3 last:border-0">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div style={{background:`${accent}18`,color:accent,width:32,height:32,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:12,flexShrink:0}}>{ci+1}</div>
                        <div className="min-w-0">
                          <p style={{color:t.text,fontWeight:700,fontSize:13}} className="truncate">{cust.name}</p>
                          {cust.phone&&<span style={{color:t.sub,fontSize:10}}>📞 {cust.phone}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p style={{color:accent}} className="font-black text-base leading-none">{inr(clvScore)}</p>
                        <p style={{color:t.sub}} className="text-[10px] mt-0.5">CLV score</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 mb-2">
                      <div style={{background:t.inp,borderRadius:8,padding:"5px 7px",textAlign:"center"}}>
                        <p style={{color:t.text,fontWeight:700,fontSize:11}} className="leading-none">{inr(revenue)}</p>
                        <p style={{color:t.sub,fontSize:9}} className="mt-0.5">Revenue</p>
                      </div>
                      <div style={{background:t.inp,borderRadius:8,padding:"5px 7px",textAlign:"center"}}>
                        <p style={{color:t.text,fontWeight:700,fontSize:11}} className="leading-none">{orderCount}</p>
                        <p style={{color:t.sub,fontSize:9}} className="mt-0.5">Orders</p>
                      </div>
                      <div style={{background:t.inp,borderRadius:8,padding:"5px 7px",textAlign:"center"}}>
                        <p style={{color:t.text,fontWeight:700,fontSize:11}} className="leading-none">{inr(avgOrderVal)}</p>
                        <p style={{color:t.sub,fontSize:9}} className="mt-0.5">Avg Order</p>
                      </div>
                      <div style={{background:daysSinceLast>14?"#ef444415":t.inp,borderRadius:8,padding:"5px 7px",textAlign:"center"}}>
                        <p style={{color:daysSinceLast>14?"#ef4444":t.text,fontWeight:700,fontSize:11}} className="leading-none">{daysSinceLast===999?"—":daysSinceLast+"d"}</p>
                        <p style={{color:t.sub,fontSize:9}} className="mt-0.5">Last Order</p>
                      </div>
                    </div>
                    <div style={{background:t.border,height:4,borderRadius:4,overflow:"hidden"}}>
                      <div style={{width:`${Math.round(clvScore/maxScore*100)}%`,background:`linear-gradient(90deg,${accent},${accent}88)`,height:"100%",borderRadius:4,transition:"width 0.6s ease"}}/>
                    </div>
                  </div>;
                })
              }
            </Card>;
          })()}

          {/* ── UNIFIED TOOLBAR ── */}
          <div style={{display:"flex",flexDirection:"column",gap:20,marginBottom:12}}>
            {/* Row 1 (mobile only): Search full-width */}
            {isMobile&&<Search dm={dm} value={custSearch} onChange={setCustSearch} placeholder="Search customers…"/>}
            {/* Row 2: Sort + actions */}
            <div style={{display:"flex",gap:20,alignItems:"center",flexWrap:"wrap",justifyContent:"space-between"}}>
            <div style={{display:"flex",gap:20,alignItems:"center",flexWrap:"nowrap",flexShrink:0}}>
            {/* Sort select — always visible */}
            <select value={custSortField} onChange={e=>setCustSortField(e.target.value)}
              style={{background:t.inp,color:t.text,border:`1.5px solid ${t.border}`,borderRadius:10,padding:"8px 10px",fontSize:12,fontWeight:600,outline:"none",cursor:"pointer",flexShrink:0,minWidth:isMobile?110:130}}>
              <option value="lastOrder">Last Order</option>
              <option value="name">Name A–Z</option>
              <option value="pending">Most Owing</option>
              <option value="orders">Most Orders</option>
              {!isMobile&&<option value="revenue">Revenue ↓</option>}
            </select>
            <div style={{display:"flex",gap:8,flexShrink:0,flexWrap:"nowrap",alignItems:"center"}}>
            {/* Mobile toolbar: compact export icons + add button */}
            {isMobile&&<>
              {can("cust_export")&&<button
                onClick={()=>{
                  const enriched=customers.map(c=>{
                    const cDelivs=deliveries.filter(d=>d.customerId===c.id);
                    const cDone=cDelivs.filter(d=>d.status==="Delivered");
                    const cPending=cDelivs.filter(d=>d.status==="Pending"||d.status==="In Transit");
                    const cReturns=cDelivs.filter(d=>d.status==="Cancelled").length;
                    const cRepl=cDelivs.filter(d=>d.replacement?.done).length;
                    const cReplAmt=cDelivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
                    const netTotal=Math.max(0,lineTotal(c.orderLines)-cReplAmt);
                    const cRev=cDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
                    const avgOrd=cDelivs.length>0?Math.round(cRev/cDelivs.length):0;
                    const lastD=[...cDelivs].sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
                    const lastDays=lastD?Math.floor((new Date()-new Date(lastD.date))/86400000):null;
                    const createdByList=[...new Set(cDelivs.map(d=>d.createdBy).filter(Boolean))].join(", ")||"—";
                    return {...c,_orders:cDelivs.length,_delivered:cDone.length,_pending:cPending.length,_returns:cReturns,_replacements:cRepl,_replAmt:cReplAmt,_netTotal:netTotal,_revenue:cRev,_avgOrd:avgOrd,_lastDate:lastD?.date||"",_lastDays:lastDays,_cDelivs:cDelivs,_createdBy:createdByList};
                  });
                  const totalColl=customers.reduce((s,c)=>s+(c.paid||0),0);
                  const totalOut=customers.reduce((s,c)=>s+(c.pending||0),0);
                  const totalReplAll=enriched.reduce((s,c)=>s+c._replAmt,0);
                  const custBreakdownHtml=enriched.map(c=>{
                    if(!c._cDelivs||c._cDelivs.length===0)return "";
                    const sorted=[...c._cDelivs].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
                    return `<div style="margin-top:28px;page-break-inside:avoid">
  <div style="background:#f1f5f9;border-left:4px solid #f59e0b;padding:8px 14px;border-radius:4px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
    <span style="font-weight:800;font-size:13px">${c.name}</span>
    <span style="font-size:11px;color:#64748b">${c._orders} orders &nbsp;·&nbsp; Paid: ₹${(c.paid||0).toLocaleString("en-IN")} &nbsp;·&nbsp; Due: <span style="color:${c.pending>0?"#dc2626":"#059669"};font-weight:700">₹${(c.pending||0).toLocaleString("en-IN")}</span></span>
  </div>
  <table><thead><tr>
    <th>Invoice No</th><th>Receipt No</th><th>Date</th><th>Status</th><th>Items</th><th class="r">Order Total</th><th class="r">Repl Deducted</th><th class="r">Net Amount</th><th class="r">Paid</th><th class="r">Remaining</th><th>Agent</th>
  </tr></thead><tbody>
  ${sorted.map((d,i)=>{
    const tot=lineTotal(d.orderLines);
    const repl=+d.replacement?.amount||0;
    const net=tot-repl;
    const dpaid=d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0;
    const rem=Math.max(0,net-dpaid);
    const items=Object.entries(safeO(d.orderLines)).filter(([,l])=>l.qty>0).map(([pid,l])=>{const p=products.find(x=>x.id===pid);return`${l.qty}×${p?p.name:(l.name||pid)}`;}).join(", ")||"—";
    const sc=d.status==="Delivered"?"#059669":d.status==="In Transit"?"#2563eb":"#d97706";
    const dInvNo=d.invNo||`INV-${(d.date||"").replace(/-/g,"")}-${(d.id||"").slice(-4).toUpperCase()}`;
    const dRcptNo=`RCP-${dInvNo.replace(/^[A-Z]+-/,"")}`;
    return`<tr style="background:${i%2===0?"#fff":"#f8fafc"}">
      <td style="white-space:nowrap;font-family:monospace;font-size:10px;color:#7c3aed;font-weight:700">${dInvNo}</td>
      <td style="white-space:nowrap;font-family:monospace;font-size:10px;color:#0ea5e9;font-weight:700">${dRcptNo}</td>
      <td style="white-space:nowrap">${d.date}</td>
      <td><span style="background:${sc}18;color:${sc};padding:2px 7px;border-radius:20px;font-size:10px;font-weight:700">${d.status}</span></td>
      <td style="font-size:11px;color:#475569">${items}${d.replacement?.done?` <span style="color:#f97316;font-weight:600">[🔄 ${d.replacement.item||"repl"}]</span>`:""}</td>
      <td class="r" style="font-weight:700">₹${tot.toLocaleString("en-IN")}</td>
      <td class="r" style="color:#f97316">${repl>0?"−₹"+repl.toLocaleString("en-IN"):"—"}</td>
      <td class="r" style="font-weight:700">₹${net.toLocaleString("en-IN")}</td>
      <td class="r" style="color:#059669">₹${dpaid.toLocaleString("en-IN")}</td>
      <td class="r" style="color:${rem>0?"#dc2626":"#059669"};font-weight:700">₹${rem.toLocaleString("en-IN")}</td>
      <td style="font-size:11px;color:#64748b">${d.createdBy||"—"}</td>
    </tr>`;
  }).join("")}
  </tbody></table></div>`;
                  }).filter(Boolean).join("");
                  exportTabPDF("Customers",enriched,[
                    {label:"Name",key:"name"},
                    {label:"Phone",key:"phone"},
                    {label:"Address",key:"address"},
                    {label:"Orders",key:"_orders",num:true},
                    {label:"Delivered",key:"_delivered",num:true},
                    {label:"Pending",key:"_pending",num:true},
                    {label:"Returns",key:"_returns",num:true},
                    {label:"Replacements",key:"_replacements",num:true},
                    {label:"Repl. Deducted (₹)",key:"_replAmt",num:true},
                    {label:"Revenue (₹)",key:"_revenue",num:true},
                    {label:"Avg Order (₹)",key:"_avgOrd",num:true},
                    {label:"Partial Paid (₹)",val:r=>r.partialPay||0,num:true},
                    {label:"Paid (₹)",key:"paid",num:true},
                    {label:"Pending (₹)",key:"pending",num:true},
                    {label:"Last Order",key:"_lastDate"},
                    {label:"Agent / Created By",key:"_createdBy"},
                    {label:"Status",val:r=>r.pending>0?`<span class="badge badge-r">UNPAID</span>`:`<span class="badge badge-g">PAID</span>`},
                    {label:"Since",key:"joinDate"}
                  ],settings,`<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:20px">
  <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px 12px"><div style="font-size:18px;font-weight:900;color:#92400e">${activeC.length}</div><div style="font-size:9px;text-transform:uppercase;color:#a8a29e;margin-top:2px">Active Customers</div></div>
  <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:10px;padding:10px 12px"><div style="font-size:18px;font-weight:900;color:#059669">₹${totalColl.toLocaleString("en-IN")}</div><div style="font-size:9px;text-transform:uppercase;color:#a8a29e;margin-top:2px">Total Collected</div></div>
  <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:10px 12px"><div style="font-size:18px;font-weight:900;color:#b91c1c">₹${totalOut.toLocaleString("en-IN")}</div><div style="font-size:9px;text-transform:uppercase;color:#a8a29e;margin-top:2px">Outstanding</div></div>
  <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:10px 12px"><div style="font-size:18px;font-weight:900;color:#ea580c">₹${totalReplAll.toLocaleString("en-IN")}</div><div style="font-size:9px;text-transform:uppercase;color:#a8a29e;margin-top:2px">Total Replacements</div></div>
</div>
<div style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;margin:28px 0 8px;padding-bottom:6px;border-bottom:2px solid #e2e8f0">Customer Summary Table</div>
${custBreakdownHtml.length>0?`<div style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;margin:36px 0 8px;padding-bottom:6px;border-bottom:2px solid #e2e8f0">Per-Customer Delivery Breakdown</div>${custBreakdownHtml}`:""}`);
                }}
                style={{width:38,height:38,borderRadius:10,background:t.inp,border:`1.5px solid ${t.border}`,color:t.sub,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </button>}
              {can("cust_export")&&<button
                onClick={()=>{
                  const enriched=customers.map(c=>{
                    const cDelivs=deliveries.filter(d=>d.customerId===c.id);
                    const cDone=cDelivs.filter(d=>d.status==="Delivered");
                    const cPending=cDelivs.filter(d=>d.status==="Pending"||d.status==="In Transit");
                    const cReturns=cDelivs.filter(d=>d.status==="Cancelled").length;
                    const cRepl=cDelivs.filter(d=>d.replacement?.done).length;
                    const cReplAmt=cDelivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
                    const netTotal=Math.max(0,lineTotal(c.orderLines)-cReplAmt);
                    const cRev=cDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
                    const avgOrd=cDelivs.length>0?Math.round(cRev/cDelivs.length):0;
                    const lastD=[...cDelivs].sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
                    const createdByList=[...new Set(cDelivs.map(d=>d.createdBy).filter(Boolean))].join(", ")||"—";
                    return {...c,_orders:cDelivs.length,_delivered:cDone.length,_pending:cPending.length,_returns:cReturns,_replacements:cRepl,_replAmt:cReplAmt,_netTotal:netTotal,_revenue:cRev,_avgOrd:avgOrd,_lastDate:lastD?.date||"",_createdBy:createdByList};
                  });
                  exportTabExcel("Customers",enriched,[
                    {label:"Name",key:"name"},
                    {label:"Phone",key:"phone"},
                    {label:"Address",key:"address"},
                    {label:"Join Date",key:"joinDate"},
                    {label:"Active",val:r=>r.active?"Yes":"No"},
                    {label:"# Orders",key:"_orders",num:true},
                    {label:"# Delivered",key:"_delivered",num:true},
                    {label:"# Pending/Transit",key:"_pending",num:true},
                    {label:"# Returns",key:"_returns",num:true},
                    {label:"# Replacements",key:"_replacements",num:true},
                    {label:"Repl. Deducted (₹)",key:"_replAmt",num:true},
                    {label:"Revenue (₹)",key:"_revenue",num:true},
                    {label:"Avg Order (₹)",key:"_avgOrd",num:true},
                    {label:"Partial Paid (₹)",val:r=>r.partialPay||0,num:true},
                    {label:"Paid (₹)",key:"paid",num:true},
                    {label:"Pending (₹)",key:"pending",num:true},
                    {label:"Net Total (₹)",key:"_netTotal",num:true},
                    {label:"Last Order Date",key:"_lastDate"},
                    {label:"Agent / Created By",key:"_createdBy"},
                    {label:"Status",val:r=>r.pending>0?"UNPAID":"PAID"},
                    {label:"Notes",key:"notes"}
                  ],settings);
                }}
                style={{width:38,height:38,borderRadius:10,background:t.inp,border:`1.5px solid ${t.border}`,color:t.sub,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
              </button>}
              {can("cust_export")&&<button
                onClick={()=>{
                  const enriched=customers.map(c=>{
                    const cDelivs=deliveries.filter(d=>d.customerId===c.id);
                    const cDone=cDelivs.filter(d=>d.status==="Delivered");
                    const cPending=cDelivs.filter(d=>d.status==="Pending"||d.status==="In Transit");
                    const cReturns=cDelivs.filter(d=>d.status==="Cancelled").length;
                    const cRepl=cDelivs.filter(d=>d.replacement?.done).length;
                    const cReplAmt=cDelivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
                    const netTotal=Math.max(0,lineTotal(c.orderLines)-cReplAmt);
                    const cRev=cDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
                    const avgOrd=cDelivs.length>0?Math.round(cRev/cDelivs.length):0;
                    const lastD=[...cDelivs].sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
                    const createdByList=[...new Set(cDelivs.map(d=>d.createdBy).filter(Boolean))].join(", ")||"—";
                    return {...c,_orders:cDelivs.length,_delivered:cDone.length,_pending:cPending.length,_returns:cReturns,_replacements:cRepl,_replAmt:cReplAmt,_netTotal:netTotal,_revenue:cRev,_avgOrd:avgOrd,_lastDate:lastD?.date||"",_createdBy:createdByList};
                  });
                  exportCSV(enriched,"customers",[
                    {label:"Name",key:"name"},
                    {label:"Phone",key:"phone"},
                    {label:"Address",key:"address"},
                    {label:"Join Date",key:"joinDate"},
                    {label:"Active",val:r=>r.active?"Yes":"No"},
                    {label:"# Orders",key:"_orders"},
                    {label:"# Delivered",key:"_delivered"},
                    {label:"# Pending/Transit",key:"_pending"},
                    {label:"# Returns",key:"_returns"},
                    {label:"# Replacements",key:"_replacements"},
                    {label:"Repl. Deducted (₹)",key:"_replAmt"},
                    {label:"Revenue (₹)",key:"_revenue"},
                    {label:"Avg Order (₹)",key:"_avgOrd"},
                    {label:"Partial Paid (₹)",val:r=>r.partialPay||0},
                    {label:"Paid (₹)",key:"paid"},
                    {label:"Pending (₹)",key:"pending"},
                    {label:"Net Total (₹)",key:"_netTotal"},
                    {label:"Last Order Date",key:"_lastDate"},
                    {label:"Agent / Created By",key:"_createdBy"},
                    {label:"Status",val:r=>r.pending>0?"UNPAID":"PAID"},
                    {label:"Notes",key:"notes"}
                  ]);
                }}
                style={{width:38,height:38,borderRadius:10,background:t.inp,border:`1.5px solid ${t.border}`,color:t.sub,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              </button>}
              {/* Mobile view toggle: Cards / Compact */}
              <div style={{display:"flex",borderRadius:9,overflow:"hidden",border:`1.5px solid ${t.border}`,flexShrink:0}}>
                {[
                  {v:"expanded",icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>},
                  {v:"compact",icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>},
                ].map(({v,icon})=>{
                  const active=custView===v||(v==="expanded"&&custView!=="compact");
                  return <button key={v} onClick={()=>{setCustView(v);setSelectedCustomer(null);}}
                    style={{width:34,height:34,display:"inline-flex",alignItems:"center",justifyContent:"center",background:active?"#2563eb":t.inp,color:active?"#fff":t.sub,border:"none",cursor:"pointer",transition:"all 0.15s",WebkitTapHighlightColor:"transparent"}}>
                    {icon}
                  </button>;
                })}
              </div>
              {can("cust_add")&&<button onClick={()=>{setCsh("add");setCf(blkC());}}
                style={{display:"flex",alignItems:"center",gap:7,background:"#2563eb",color:"#fff",border:"none",borderRadius:10,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Customer
              </button>}
            </>}
            {/* Desktop toolbar: full export buttons */}
            {!isMobile&&<div className="crm-btn-group">
              {can("cust_export")&&<Btn dm={dm} v="outline" size="sm" onClick={()=>{
                const enriched=customers.map(c=>{
                  const cDelivs=deliveries.filter(d=>d.customerId===c.id);
                  const cDone=cDelivs.filter(d=>d.status==="Delivered");
                  const cPending=cDelivs.filter(d=>d.status==="Pending"||d.status==="In Transit");
                  const cReturns=cDelivs.filter(d=>d.status==="Cancelled").length;
                  const cRepl=cDelivs.filter(d=>d.replacement?.done).length;
                  const cReplAmt=cDelivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
                  const netTotal=Math.max(0,lineTotal(c.orderLines)-cReplAmt);
                  const cRev=cDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
                  const avgOrd=cDelivs.length>0?Math.round(cRev/cDelivs.length):0;
                  const lastD=[...cDelivs].sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
                  const lastDays=lastD?Math.floor((new Date()-new Date(lastD.date))/86400000):null;
                  const createdByList=[...new Set(cDelivs.map(d=>d.createdBy).filter(Boolean))].join(", ")||"—";
                  return {...c,_orders:cDelivs.length,_delivered:cDone.length,_pending:cPending.length,_returns:cReturns,_replacements:cRepl,_replAmt:cReplAmt,_netTotal:netTotal,_revenue:cRev,_avgOrd:avgOrd,_lastDate:lastD?.date||"",_lastDays:lastDays,_cDelivs:cDelivs,_createdBy:createdByList};
                });
                const totalColl=customers.reduce((s,c)=>s+(c.paid||0),0);
                const totalOut=customers.reduce((s,c)=>s+(c.pending||0),0);
                const totalReplAll=enriched.reduce((s,c)=>s+c._replAmt,0);
                // Build per-customer delivery breakdown HTML
                const custBreakdownHtml=enriched.map(c=>{
                  if(!c._cDelivs||c._cDelivs.length===0)return "";
                  const sorted=[...c._cDelivs].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
                  return `<div style="margin-top:28px;page-break-inside:avoid">
  <div style="background:#f1f5f9;border-left:4px solid #f59e0b;padding:8px 14px;border-radius:4px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
    <span style="font-weight:800;font-size:13px">${c.name}</span>
    <span style="font-size:11px;color:#64748b">${c._orders} orders &nbsp;·&nbsp; Paid: ₹${(c.paid||0).toLocaleString("en-IN")} &nbsp;·&nbsp; Due: <span style="color:${c.pending>0?"#dc2626":"#059669"};font-weight:700">₹${(c.pending||0).toLocaleString("en-IN")}</span></span>
  </div>
  <table><thead><tr>
    <th>Invoice No</th><th>Receipt No</th><th>Date</th><th>Status</th><th>Items</th><th class="r">Order Total</th><th class="r">Repl Deducted</th><th class="r">Net Amount</th><th class="r">Paid</th><th class="r">Remaining</th><th>Agent</th>
  </tr></thead><tbody>
  ${sorted.map((d,i)=>{
    const tot=lineTotal(d.orderLines);
    const repl=+d.replacement?.amount||0;
    const net=tot-repl;
    const dpaid=d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0;
    const rem=Math.max(0,net-dpaid);
    const items=Object.entries(safeO(d.orderLines)).filter(([,l])=>l.qty>0).map(([pid,l])=>{const p=products.find(x=>x.id===pid);return`${l.qty}×${p?p.name:(l.name||pid)}`;}).join(", ")||"—";
    const sc=d.status==="Delivered"?"#059669":d.status==="In Transit"?"#2563eb":"#d97706";
    const dInvNo=d.invNo||`INV-${(d.date||"").replace(/-/g,"")}-${(d.id||"").slice(-4).toUpperCase()}`;
    const dRcptNo=`RCP-${dInvNo.replace(/^[A-Z]+-/,"")}`;
    return`<tr style="background:${i%2===0?"#fff":"#f8fafc"}">
      <td style="white-space:nowrap;font-family:monospace;font-size:10px;color:#7c3aed;font-weight:700">${dInvNo}</td>
      <td style="white-space:nowrap;font-family:monospace;font-size:10px;color:#0ea5e9;font-weight:700">${dRcptNo}</td>
      <td style="white-space:nowrap">${d.date}</td>
      <td><span style="background:${sc}18;color:${sc};padding:2px 7px;border-radius:20px;font-size:10px;font-weight:700">${d.status}</span></td>
      <td style="font-size:11px;color:#475569">${items}${d.replacement?.done?` <span style="color:#f97316;font-weight:600">[🔄 ${d.replacement.item||"repl"}]</span>`:""}</td>
      <td class="r" style="font-weight:700">₹${tot.toLocaleString("en-IN")}</td>
      <td class="r" style="color:#f97316">${repl>0?"−₹"+repl.toLocaleString("en-IN"):"—"}</td>
      <td class="r" style="font-weight:700">₹${net.toLocaleString("en-IN")}</td>
      <td class="r" style="color:#059669">₹${dpaid.toLocaleString("en-IN")}</td>
      <td class="r" style="color:${rem>0?"#dc2626":"#059669"};font-weight:700">₹${rem.toLocaleString("en-IN")}</td>
      <td style="font-size:11px;color:#64748b">${d.createdBy||"—"}</td>
    </tr>`;
  }).join("")}
  </tbody></table></div>`;
                }).filter(Boolean).join("");
                exportTabPDF("Customers",enriched,[
                  {label:"Name",key:"name"},
                  {label:"Phone",key:"phone"},
                  {label:"Address",key:"address"},
                  {label:"Orders",key:"_orders",num:true},
                  {label:"Delivered",key:"_delivered",num:true},
                  {label:"Pending",key:"_pending",num:true},
                  {label:"Returns",key:"_returns",num:true},
                  {label:"Replacements",key:"_replacements",num:true},
                  {label:"Repl. Deducted (₹)",key:"_replAmt",num:true},
                  {label:"Revenue (₹)",key:"_revenue",num:true},
                  {label:"Avg Order (₹)",key:"_avgOrd",num:true},
                  {label:"Partial Paid (₹)",val:r=>r.partialPay||0,num:true},
                  {label:"Paid (₹)",key:"paid",num:true},
                  {label:"Pending (₹)",key:"pending",num:true},
                  {label:"Last Order",key:"_lastDate"},
                  {label:"Agent / Created By",key:"_createdBy"},
                  {label:"Status",val:r=>r.pending>0?`<span class="badge badge-r">UNPAID</span>`:`<span class="badge badge-g">PAID</span>`},
                  {label:"Since",key:"joinDate"}
                ],settings,`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
  <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 14px"><div style="font-size:20px;font-weight:900;color:#92400e">${activeC.length}</div><div style="font-size:9px;text-transform:uppercase;color:#a8a29e;margin-top:3px">Active Customers</div></div>
  <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:10px;padding:12px 14px"><div style="font-size:20px;font-weight:900;color:#059669">₹${totalColl.toLocaleString("en-IN")}</div><div style="font-size:9px;text-transform:uppercase;color:#a8a29e;margin-top:3px">Total Collected</div></div>
  <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:12px 14px"><div style="font-size:20px;font-weight:900;color:#b91c1c">₹${totalOut.toLocaleString("en-IN")}</div><div style="font-size:9px;text-transform:uppercase;color:#a8a29e;margin-top:3px">Outstanding</div></div>
  <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px 14px"><div style="font-size:20px;font-weight:900;color:#ea580c">₹${totalReplAll.toLocaleString("en-IN")}</div><div style="font-size:9px;text-transform:uppercase;color:#a8a29e;margin-top:3px">Total Replacements</div></div>
</div>
<div style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;margin:28px 0 8px;padding-bottom:6px;border-bottom:2px solid #e2e8f0">Customer Summary Table</div>
${custBreakdownHtml.length>0?`<div style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;margin:36px 0 8px;padding-bottom:6px;border-bottom:2px solid #e2e8f0">Per-Customer Delivery Breakdown</div>${custBreakdownHtml}`:""}
`);
              }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:4,verticalAlign:"middle"}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>PDF</Btn>}
              {can("cust_export")&&<Btn dm={dm} v="outline" size="sm" onClick={()=>{
                const enriched=customers.map(c=>{
                  const cDelivs=deliveries.filter(d=>d.customerId===c.id);
                  const cDone=cDelivs.filter(d=>d.status==="Delivered");
                  const cPending=cDelivs.filter(d=>d.status==="Pending"||d.status==="In Transit");
                  const cReturns=cDelivs.filter(d=>d.status==="Cancelled").length;
                  const cRepl=cDelivs.filter(d=>d.replacement?.done).length;
                  const cReplAmt=cDelivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
                  const netTotal=Math.max(0,lineTotal(c.orderLines)-cReplAmt);
                  const cRev=cDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
                  const avgOrd=cDelivs.length>0?Math.round(cRev/cDelivs.length):0;
                  const lastD=[...cDelivs].sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
                  return {...c,_orders:cDelivs.length,_delivered:cDone.length,_pending:cPending.length,_returns:cReturns,_replacements:cRepl,_replAmt:cReplAmt,_netTotal:netTotal,_revenue:cRev,_avgOrd:avgOrd,_lastDate:lastD?.date||""};
                });
                exportTabExcel("Customers",enriched,[
                  {label:"Name",key:"name"},
                  {label:"Phone",key:"phone"},
                  {label:"Address",key:"address"},
                  {label:"Join Date",key:"joinDate"},
                  {label:"Active",val:r=>r.active?"Yes":"No"},
                  {label:"# Orders",key:"_orders",num:true},
                  {label:"# Delivered",key:"_delivered",num:true},
                  {label:"# Pending/Transit",key:"_pending",num:true},
                  {label:"# Returns",key:"_returns",num:true},
                  {label:"# Replacements",key:"_replacements",num:true},
                  {label:"Repl. Deducted (₹)",key:"_replAmt",num:true},
                  {label:"Revenue (₹)",key:"_revenue",num:true},
                  {label:"Avg Order (₹)",key:"_avgOrd",num:true},
                  {label:"Partial Paid (₹)",val:r=>r.partialPay||0,num:true},
                  {label:"Paid (₹)",key:"paid",num:true},
                  {label:"Pending (₹)",key:"pending",num:true},
                  {label:"Net Total (₹)",key:"_netTotal",num:true},
                  {label:"Last Order Date",key:"_lastDate"},
                  {label:"Agent / Created By",key:"_createdBy"},
                  {label:"Status",val:r=>r.pending>0?"UNPAID":"PAID"},
                  {label:"Notes",key:"notes"}
                ],settings);
              }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:4,verticalAlign:"middle"}}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>XLS</Btn>}
              {can("cust_export")&&<Btn dm={dm} v="outline" size="sm" onClick={()=>{
                const enriched=customers.map(c=>{
                  const cDelivs=deliveries.filter(d=>d.customerId===c.id);
                  const cDone=cDelivs.filter(d=>d.status==="Delivered");
                  const cPending=cDelivs.filter(d=>d.status==="Pending"||d.status==="In Transit");
                  const cReturns=cDelivs.filter(d=>d.status==="Cancelled").length;
                  const cRepl=cDelivs.filter(d=>d.replacement?.done).length;
                  const cReplAmt=cDelivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
                  const netTotal=Math.max(0,lineTotal(c.orderLines)-cReplAmt);
                  const cRev=cDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
                  const avgOrd=cDelivs.length>0?Math.round(cRev/cDelivs.length):0;
                  const lastD=[...cDelivs].sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
                  const createdByList=[...new Set(cDelivs.map(d=>d.createdBy).filter(Boolean))].join(", ")||"—";
                  return {...c,_orders:cDelivs.length,_delivered:cDone.length,_pending:cPending.length,_returns:cReturns,_replacements:cRepl,_replAmt:cReplAmt,_netTotal:netTotal,_revenue:cRev,_avgOrd:avgOrd,_lastDate:lastD?.date||"",_createdBy:createdByList};
                });
                exportCSV(enriched,"customers",[
                  {label:"Name",key:"name"},
                  {label:"Phone",key:"phone"},
                  {label:"Address",key:"address"},
                  {label:"Join Date",key:"joinDate"},
                  {label:"Active",val:r=>r.active?"Yes":"No"},
                  {label:"# Orders",key:"_orders"},
                  {label:"# Delivered",key:"_delivered"},
                  {label:"# Pending/Transit",key:"_pending"},
                  {label:"# Returns",key:"_returns"},
                  {label:"# Replacements",key:"_replacements"},
                  {label:"Repl. Deducted (₹)",key:"_replAmt"},
                  {label:"Revenue (₹)",key:"_revenue"},
                  {label:"Avg Order (₹)",key:"_avgOrd"},
                  {label:"Partial Paid (₹)",val:r=>r.partialPay||0},
                  {label:"Paid (₹)",key:"paid"},
                  {label:"Pending (₹)",key:"pending"},
                  {label:"Net Total (₹)",key:"_netTotal"},
                  {label:"Last Order Date",key:"_lastDate"},
                  {label:"Agent / Created By",key:"_createdBy"},
                  {label:"Status",val:r=>r.pending>0?"UNPAID":"PAID"},
                  {label:"Notes",key:"notes"}
                ]);
              }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:4,verticalAlign:"middle"}}><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>CSV</Btn>}
              <Btn dm={dm} size="sm" onClick={()=>{setCf(blkC());setCsh("add");}}>+ Customer</Btn>
            </div>}
            </div>
            </div>
            </div>
          </div>
          {/* ── STATUS FILTER PILLS + VIEW TOGGLE (same row on desktop, pills-only on mobile) ── */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:20,marginBottom:12}}>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{WebkitOverflowScrolling:"touch",scrollbarWidth:"none",msOverflowStyle:"none",minWidth:0}}>
              {[
                {key:"all",    label:`All (${fCust.length})`,         accent:"#2563eb"},
                {key:"active", label:`Active (${fCust.filter(c=>c.active).length})`,   accent:"#10b981"},
                {key:"inactive",label:`Inactive (${fCust.filter(c=>!c.active).length})`,accent:"#6b7280"},
                {key:"owing",  label:`Owing (${fCust.filter(c=>(c.pending||0)>0).length})`, accent:"#ef4444"},
                {key:"clear",  label:`Paid Up (${fCust.filter(c=>!(c.pending||0)).length})`, accent:"#10b981"},
              ].map(({key,label,accent})=>{
                const active=custStatusFilter===key;
                return <button key={key} onClick={()=>setCustStatusFilter(key)}
                  style={{flexShrink:0,background:active?accent:t.inp,color:active?"#fff":t.sub,border:`1.5px solid ${active?accent:t.border}`,borderRadius:99,padding:"6px 16px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",transition:"all 0.15s",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>
                  {label}
                </button>;
              })}
            </div>
            {/* View mode toggle — desktop only (mobile has its own 2-button toggle above) */}
            {!isMobile&&<div style={{display:"flex",gap:24,alignItems:"center",flexShrink:0}}>
              {[
                {v:"recent",lbl:"Recent",icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>},
                {v:"expanded",lbl:"Table",icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>},
                {v:"compact",lbl:"Compact",icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>},
              ].map(({v,lbl,icon})=>{
                const active=custView===v||(v==="recent"&&custSortField==="lastOrder"&&custView==="expanded");
                return <button key={v} onClick={()=>{if(v==="recent"){setCustView("expanded");setCustSortField("lastOrder");}else{setCustView(v);setSelectedCustomer(null);}}}
                  style={{display:"flex",alignItems:"center",gap:6,padding:"7px 13px",borderRadius:9,border:`1px solid ${active?"#2563eb":t.border}`,background:active?"#2563eb":t.inp,color:active?"#fff":t.sub,fontSize:12,fontWeight:700,cursor:"pointer",transition:"all 0.15s"}}>
                  {icon}{lbl}
                </button>;
              })}
            </div>}
          </div>

          {/* ── MOBILE CUSTOMER CARD LIST ── */}
          {isMobile&&clvFilter==="og"&&(()=>{
            let displayCust=[...fCust];
            if(custStatusFilter==="active") displayCust=displayCust.filter(c=>c.active);
            else if(custStatusFilter==="inactive") displayCust=displayCust.filter(c=>!c.active);
            else if(custStatusFilter==="owing") displayCust=displayCust.filter(c=>(c.pending||0)>0);
            else if(custStatusFilter==="clear") displayCust=displayCust.filter(c=>(c.pending||0)===0);
            displayCust=displayCust.map(c=>{
              const cDelivs=deliveries.filter(d=>d.customerId===c.id);
              const cDone=cDelivs.filter(d=>d.status==="Delivered");
              const lastDeliv=cDelivs.length>0?[...cDelivs].sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0]:null;
              const cRev=cDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
              const cReplAmt=cDelivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
              return {...c,_cDelivs:cDelivs,_cDone:cDone,_lastDeliv:lastDeliv,_cRev:cRev,_cReplAmt:cReplAmt};
            });
            if(custSortField==="name") displayCust.sort((a,b)=>a.name.localeCompare(b.name));
            else if(custSortField==="lastOrder") displayCust.sort((a,b)=>(b._lastDeliv?.date||"").localeCompare(a._lastDeliv?.date||""));
            else if(custSortField==="pending") displayCust.sort((a,b)=>(b.pending||0)-(a.pending||0));
            else if(custSortField==="orders") displayCust.sort((a,b)=>b._cDelivs.length-a._cDelivs.length);
            else if(custSortField==="revenue") displayCust.sort((a,b)=>b._cRev-a._cRev);
            if(displayCust.length===0) return <p style={{color:t.sub,textAlign:"center",padding:"40px 0",fontSize:13}}>No customers found.</p>;
            return <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {displayCust.map((c)=>{
                const isExpanded=selectedCustomer?.id===c.id;
                const lastDiffDays=c._lastDeliv?Math.floor((new Date()-new Date(c._lastDeliv.date))/(1000*60*60*24)):null;
                const lastLabel=lastDiffDays===null?"Never":lastDiffDays===0?"Today":lastDiffDays===1?"Yesterday":`${lastDiffDays}d ago`;
                const lastCol=lastDiffDays===null?"#94a3b8":lastDiffDays>14?"#ef4444":lastDiffDays>7?"#f59e0b":"#10b981";
                const avatarPalette=[["#f59e0b","#fffbeb"],["#10b981","#ecfdf5"],["#8b5cf6","#f5f3ff"],["#3b82f6","#eff6ff"],["#ef4444","#fef2f2"],["#f97316","#fff7ed"],["#06b6d4","#ecfeff"],["#ec4899","#fdf2f8"]];
                const [fg,bg]=c.active?avatarPalette[c.name.charCodeAt(0)%avatarPalette.length]:["#9ca3af","rgba(107,114,128,0.1)"];
                return <div key={c.id} style={{background:t.card,border:`1.5px solid ${isExpanded?"#2563eb":t.border}`,borderRadius:16,overflow:"hidden",boxShadow:isExpanded?"0 4px 16px rgba(37,99,235,0.13)":"0 1px 3px rgba(0,0,0,0.06)",transition:"all 0.18s"}}>
                  {/* Card main row */}
                  <div style={{padding:"13px 14px",display:"flex",alignItems:"center",gap:24,cursor:"pointer",background:isExpanded?(dm?"rgba(37,99,235,0.1)":"rgba(37,99,235,0.04)"):"transparent",WebkitTapHighlightColor:"transparent"}}
                    onClick={()=>{setSelectedCustomer(isExpanded?null:c);setCustDetailDelivFilter("all");setCustDetailPartialAmt("");}}>
                    {/* Avatar */}
                    <div style={{width:44,height:44,borderRadius:14,background:bg,color:fg,fontWeight:900,fontSize:17,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,position:"relative",border:`1.5px solid ${fg}30`}}>
                      {c.name.charAt(0).toUpperCase()}
                      <span style={{position:"absolute",bottom:-2,right:-2,width:11,height:11,borderRadius:"50%",background:c.active?"#10b981":"#94a3b8",border:`2px solid ${t.card}`}}/>
                    </div>
                    {/* Name + meta */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                        <p style={{color:t.text,fontWeight:800,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</p>
                        {(c.pending||0)>0&&<span style={{background:"#ef444415",color:"#dc2626",border:"1px solid #ef444425",borderRadius:99,padding:"1px 7px",fontSize:9,fontWeight:800,flexShrink:0,whiteSpace:"nowrap"}}>DUE</span>}
                      </div>
                      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"nowrap"}}>
                        <span style={{color:t.sub,fontSize:11,display:"flex",alignItems:"center",gap:3}}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
                          {c._cDelivs.length} orders
                        </span>
                        <span style={{color:lastCol,fontSize:11,fontWeight:600}}>{lastLabel}</span>
                        {c.phone&&<span style={{color:t.sub,fontSize:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>📞 {c.phone}</span>}
                      </div>
                    </div>
                    {/* Right: amount + chevron */}
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                      {canSeeFinancials&&<span style={{color:(c.pending||0)>0?"#dc2626":"#10b981",fontWeight:900,fontSize:14,lineHeight:1}}>
                        {(c.pending||0)>0?inr(c.pending):"✓ Clear"}
                      </span>}
                      {canSeePrices&&(c.pending||0)===0&&<span style={{color:"#10b981",fontSize:10,fontWeight:600}}>{inr(c.paid||0)} paid</span>}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2.5" strokeLinecap="round" style={{transform:isExpanded?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s",marginTop:0}}><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                  </div>
                  {/* Progress bar */}
                  {c._cDelivs.length>0&&<div style={{height:3,background:t.border,display:"flex",overflow:"hidden"}}>
                    {[{v:c._cDone.length,col:"#10b981"},{v:c._cDelivs.filter(d=>d.status==="In Transit").length,col:"#3b82f6"},{v:c._cDelivs.filter(d=>d.status==="Pending").length,col:"#f59e0b"},{v:c._cDelivs.filter(d=>d.status==="Cancelled").length,col:"#ef4444"}].map(({v,col},i)=>
                      v>0&&<div key={i} style={{width:`${Math.round(v/c._cDelivs.length*100)}%`,background:col}}/>
                    )}
                  </div>}
                  {/* ── EXPANDED DETAIL — full mobile customer detail panel ── */}
                  {isExpanded&&(()=>{
                    const cFull=customers.find(x=>x.id===c.id)||c;
                    const cDue=cFull.pending||0;
                    const cPaid=cFull.paid||0;
                    const allCDelivs=[...deliveries.filter(d=>d.customerId===c.id)].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
                    const cDone=allCDelivs.filter(d=>d.status==="Delivered");
                    const cTransit=allCDelivs.filter(d=>d.status==="In Transit");
                    const cPend=allCDelivs.filter(d=>d.status==="Pending");
                    const cCancelled=allCDelivs.filter(d=>d.status==="Cancelled");
                    const cRepl=allCDelivs.filter(d=>d.replacement?.done);
                    const cReplAmt=allCDelivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
                    const cRev=cDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
                    const delivRate=allCDelivs.length>0?Math.round(cDone.length/allCDelivs.length*100):100;
                    const collPct=(cPaid+cDue)>0?Math.round(cPaid/(cPaid+cDue)*100):100;
                    const tStr=new Date().toISOString().slice(0,10);
                    const yStr=(()=>{const d=new Date(tStr);d.setDate(d.getDate()-1);return d.toISOString().slice(0,10);})();
                    const wStr=(()=>{const d=new Date(tStr);d.setDate(d.getDate()-6);return d.toISOString().slice(0,10);})();
                    const filtDelivs=allCDelivs.filter(d=>{
                      if(custDetailDelivFilter==="today") return d.date===tStr;
                      if(custDetailDelivFilter==="yesterday") return d.date===yStr;
                      if(custDetailDelivFilter==="week") return d.date>=wStr;
                      return true;
                    });
                    return <div style={{borderTop:`1px solid ${t.border}`}}>

                      {/* ══ SECTION 1: PROFILE / FINANCIALS / ORDER STATS ══ */}
                      <div style={{padding:"14px 14px 10px",display:"grid",gridTemplateColumns:"1fr",gap:8,borderBottom:`1px solid ${t.border}`}}>

                        {/* PROFILE */}
                        <div>
                          <p style={{color:t.sub,fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Profile</p>
                          <div style={{display:"flex",flexDirection:"column",gap:6}}>
                            {[
                              {icon:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>, val:cFull.name, bold:true},
                              {icon:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2.2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12"/></svg>, val:cFull.phone||"—", phone:true},
                              {icon:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>, val:cFull.address||"—"},
                              {icon:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, val:cFull.joinDate?`Since ${cFull.joinDate}`:"—"},
                              {icon:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2.2" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/></svg>, val:cFull.id?`ID: ${cFull.id.slice(-8).toUpperCase()}`:"—"},
                            ].map(({icon,val,bold,phone},ii)=>(
                              <div key={ii} style={{display:"flex",gap:8,alignItems:"center"}}>
                                <span style={{flexShrink:0,width:16,display:"flex",alignItems:"center",justifyContent:"center"}}>{icon}</span>
                                {phone&&cFull.phone
                                  ?<a href={`tel:${cFull.phone}`} style={{color:"#2563eb",fontSize:12,fontWeight:600,textDecoration:"none"}}>{val}</a>
                                  :<span style={{color:bold?t.text:t.sub,fontSize:12,fontWeight:bold?700:400,lineHeight:1.4}}>{val}</span>}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* FINANCIALS */}
                        {canSeePrices&&<div>
                          <p style={{color:t.sub,fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Financials</p>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                            {[
                              {label:"TOTAL PAID",val:inr(cPaid),color:"#10b981"},
                              {label:"PENDING DUE",val:cDue>0?inr(cDue):"✓ Clear",color:cDue>0?"#ef4444":"#10b981"},
                              {label:"TOTAL BILLED",val:inr(cRev),color:"#3b82f6"},
                              {label:"REPLACEMENTS",val:cReplAmt>0?inr(cReplAmt):"None",color:"#f97316"},
                            ].map(({label,val,color})=>(
                              <div key={label} style={{background:t.inp,borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
                                <p style={{color,fontWeight:900,fontSize:15,lineHeight:1}}>{val}</p>
                                <p style={{color:t.sub,fontSize:8,fontWeight:700,textTransform:"uppercase",marginTop:4}}>{label}</p>
                              </div>
                            ))}
                          </div>
                          <div style={{marginBottom:12}}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                              <span style={{color:t.sub,fontSize:10,fontWeight:700}}>Collection</span>
                              <span style={{color:collPct>=80?"#10b981":collPct>=50?"#f59e0b":"#ef4444",fontWeight:700,fontSize:10}}>{collPct}%</span>
                            </div>
                            <div style={{height:5,borderRadius:5,background:t.border,overflow:"hidden"}}>
                              <div style={{width:`${collPct}%`,height:"100%",background:collPct>=80?"#10b981":collPct>=50?"#f59e0b":"#ef4444",borderRadius:5}}/>
                            </div>
                          </div>
                        </div>}

                        {/* ORDER STATS */}
                        <div>
                          <p style={{color:t.sub,fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Order Stats</p>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
                            {[
                              {label:"TOTAL",val:allCDelivs.length,color:"#6366f1"},
                              {label:"DELIVERED",val:cDone.length,color:"#10b981"},
                              {label:"IN TRANSIT",val:cTransit.length,color:"#3b82f6"},
                              {label:"PENDING",val:cPend.length,color:"#f59e0b"},
                              {label:"CANCELLED",val:cCancelled.length,color:"#ef4444"},
                              {label:"REPLACED",val:cRepl.length,color:"#f97316"},
                            ].map(({label,val,color})=>(
                              <div key={label} style={{background:t.inp,borderRadius:10,padding:"8px 4px",textAlign:"center"}}>
                                <p style={{color,fontWeight:900,fontSize:16,lineHeight:1}}>{val}</p>
                                <p style={{color:t.sub,fontSize:8,fontWeight:700,textTransform:"uppercase",marginTop:2}}>{label}</p>
                              </div>
                            ))}
                          </div>
                          <div>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                              <span style={{color:t.sub,fontSize:10,fontWeight:700}}>Delivery Rate</span>
                              <span style={{color:delivRate>=90?"#10b981":delivRate>=70?"#f59e0b":"#ef4444",fontWeight:700,fontSize:10}}>{delivRate}%</span>
                            </div>
                            <div style={{height:5,borderRadius:5,background:t.border,overflow:"hidden"}}>
                              <div style={{width:`${delivRate}%`,height:"100%",background:delivRate>=90?"#10b981":delivRate>=70?"#f59e0b":"#ef4444",borderRadius:5}}/>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ══ SECTION 2: ACTIONS ══ */}
                      <div style={{padding:"22px 24px",borderBottom:`1px solid ${t.border}`}}>
                        <p style={{color:t.sub,fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Actions</p>
                        <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
                          {can("cust_edit")&&<button onClick={()=>{setCsh(cFull);setCf(cFull);setSelectedCustomer(null);}}
                            style={{background:t.inp,border:`1px solid ${t.border}`,color:t.text,borderRadius:10,padding:"9px 14px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Edit
                          </button>}
                          {can("cust_export")&&<button onClick={()=>exportPDF(cFull,products,"customer",settings,deliveries)}
                            style={{background:"#7c3aed",color:"#fff",border:"none",borderRadius:10,padding:"9px 14px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            PDF
                          </button>}
                          {can("cust_export")&&<button onClick={()=>exportCustomerReports([cFull.id])}
                            title="Full customer report — all deliveries, batches & activity log"
                            style={{background:"#7c3aed15",color:"#7c3aed",border:"1px solid #7c3aed40",borderRadius:10,padding:"9px 14px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                            Report
                          </button>}
                          {can("cust_export")&&<button onClick={()=>{exportTabExcel("Customer",[{...cFull}],[{label:"Name",key:"name"},{label:"Phone",key:"phone"},{label:"Address",key:"address"},{label:"Paid",key:"paid",num:true},{label:"Pending",key:"pending",num:true}],settings);}}
                            style={{background:"#059669",color:"#fff",border:"none",borderRadius:10,padding:"9px 14px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
                            Excel
                          </button>}
                          {can("cust_deactivate")&&<button onClick={()=>{togActive(cFull);setSelectedCustomer(null);}}
                            style={{background:t.inp,border:`1px solid ${t.border}`,color:t.sub,borderRadius:10,padding:"9px 14px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                            {cFull.active
                              ?<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                              :<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
                            {cFull.active?"Pause":"Activate"}
                          </button>}
                          <button onClick={()=>setDetailModal({type:"customer",data:cFull})}
                            style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:10,padding:"9px 14px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6,marginLeft:"auto"}}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            Full Profile
                          </button>
                          {can("cust_delete")&&<button onClick={()=>delC(cFull)}
                            style={{background:"#ef444415",border:"1px solid #ef444430",color:"#ef4444",borderRadius:10,padding:"9px 14px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                            Delete
                          </button>}
                        </div>
                      </div>

                      {/* ══ SECTION 3: PARTIAL PAYMENT ══ */}
                      {isAdmin&&cDue>0&&<div style={{padding:"22px 24px",borderBottom:`1px solid ${t.border}`,background:dm?"rgba(245,158,11,0.06)":"rgba(245,158,11,0.04)"}}>
                        <p style={{color:"#f59e0b",fontWeight:700,fontSize:11,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                          LOG PARTIAL PAYMENT
                        </p>
                        <div style={{display:"flex",gap:8}}>
                          <input type="number" placeholder="₹ Amount" value={custDetailPartialAmt} onChange={e=>setCustDetailPartialAmt(e.target.value)}
                            style={{flex:1,background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:10,padding:"18px 20px",fontSize:13,outline:"none"}}
                            onFocus={e=>{e.target.style.borderColor="#f59e0b";}} onBlur={e=>{e.target.style.borderColor=t.inpB;}}/>
                          <button onClick={()=>{const amt=+custDetailPartialAmt;if(!amt||amt<=0){notify("Enter a valid amount");return;}recordPaymentLedger(cFull.id,cFull.name,amt,"","Cash");setCustDetailPartialAmt("");setSelectedCustomer(null);}}
                            style={{background:"#f59e0b",color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",fontSize:13,fontWeight:700,cursor:"pointer"}}>Apply</button>
                        </div>
                      </div>}

                      {/* ══ SECTION 4: DELIVERIES ══ */}
                      <div style={{padding:"14px 14px"}}>
                        {/* Header + filter pills */}
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                          <p style={{color:t.text,fontWeight:800,fontSize:13}}>DELIVERIES <span style={{color:t.sub,fontWeight:600}}>({allCDelivs.length})</span></p>
                          <div style={{display:"flex",gap:5}}>
                            {[["all","All"],["today","Today"],["yesterday","Yesterday"],["week","This Week"]].map(([k,l])=>(
                              <button key={k} onClick={()=>setCustDetailDelivFilter(k)}
                                style={{background:custDetailDelivFilter===k?"#2563eb":t.inp,color:custDetailDelivFilter===k?"#fff":t.sub,border:`1px solid ${custDetailDelivFilter===k?"#2563eb":t.border}`,borderRadius:99,padding:"16px 24px",fontSize:10,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>{l}</button>
                            ))}
                          </div>
                        </div>

                        {filtDelivs.length===0&&<p style={{color:t.sub,fontSize:12,textAlign:"center",padding:"20px 0"}}>No deliveries match this filter.</p>}

                        <div style={{display:"flex",flexDirection:"column",gap:10}}>
                          {filtDelivs.map((d,di)=>{
                            const tot=lineTotal(d.orderLines);
                            const dRepl=+d.replacement?.amount||0;
                            const dNet=Math.max(0,tot-dRepl);
                            const isPaid=d.status==="Delivered"&&dNet>0&&(d.partialPayment?.enabled?(+(d.partialPayment?.amount)||0)>=dNet:true);
                            const sc=d.status==="Delivered"?"#10b981":d.status==="Cancelled"?"#ef4444":"#f59e0b";
                            const invNo=(invRegistry?.issued||{})[d.id]||d.invNo||`TAS-${(d.date||"").replace(/-/g,"").slice(2)}-${(d.id||"").slice(-4).toUpperCase()}`;
                            const rows=Object.entries(safeO(d.orderLines)).filter(([,l])=>l.qty>0);
                            const totalQty=rows.reduce((s,[,l])=>s+(+l.qty||0),0);
                            const pricePerUnit=rows.length>0?(+rows[0][1]?.priceAmount||+rows[0][1]?.price||0):0;
                            const deliveredAt=d.deliveredAt||d.completedAt||"";
                            // parse date for block display
                            const dateObj=d.date?new Date(d.date):null;
                            const dayNum=dateObj?String(dateObj.getDate()).padStart(2,"0"):"??";
                            const monthStr=dateObj?dateObj.toLocaleString("en",{month:"short"}).toUpperCase():"???";
                            const yearStr=dateObj?dateObj.getFullYear():"";
                            const paymentStatus=d.partialPayment?.enabled
                              ?(+(d.partialPayment?.amount)||0)>=dNet?"Paid":"Pending"
                              :d.status==="Delivered"?"Paid":"Pending";
                            return <div key={d.id||di} style={{background:t.card,borderRadius:14,border:`1px solid ${t.border}`,overflow:"hidden",cursor:"pointer"}}
                              onClick={()=>setDetailModal({type:"delivery",data:d})}>
                              {/* Top row: date block + main info + TAS no */}
                              <div style={{display:"flex",gap:24,padding:"22px 24px",alignItems:"flex-start"}}>
                                {/* Date block */}
                                <div style={{background:dm?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)",borderRadius:10,padding:"6px 8px",textAlign:"center",flexShrink:0,minWidth:44}}>
                                  <p style={{color:t.text,fontWeight:900,fontSize:18,lineHeight:1}}>{dayNum}</p>
                                  <p style={{color:"#3b82f6",fontWeight:700,fontSize:9,textTransform:"uppercase",marginTop:1}}>{monthStr}</p>
                                  <p style={{color:t.sub,fontWeight:600,fontSize:9}}>{yearStr}</p>
                                </div>
                                {/* Middle: status + product summary + notes */}
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
                                    <span style={{background:`${sc}18`,color:sc,borderRadius:99,padding:"2px 8px",fontSize:10,fontWeight:700}}>{d.status}</span>
                                    {d.replacement?.done&&<span style={{background:"#f9731615",color:"#f97316",borderRadius:99,padding:"5px 12px",fontSize:9,fontWeight:700}}>🔄 Replaced</span>}
                                  </div>
                                  {rows.length>0&&<p style={{color:t.sub,fontSize:12,marginBottom:10}}>
                                    {rows.map(([pid,l])=>{const prod=products.find(p=>p.id===pid);return`${prod?.name||l.name||pid}: ${l.qty}`;}).join(", ")}
                                  </p>}
                                  {d.notes&&<p style={{color:"#f59e0b",fontSize:10,display:"flex",alignItems:"center",gap:4}}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                    {d.notes}
                                  </p>}
                                </div>
                                {/* Right: amount + replaced + TAS */}
                                <div style={{flexShrink:0,textAlign:"right",display:"flex",flexDirection:"column",gap:3}}>
                                  {canSeePrices&&<>
                                    <div>
                                      <p style={{color:t.sub,fontSize:9}}>Amount</p>
                                      <p style={{color:"#10b981",fontWeight:900,fontSize:14,lineHeight:1}}>{inr(tot)}</p>
                                    </div>
                                    {dRepl>0&&<div>
                                      <p style={{color:t.sub,fontSize:9}}>Replaced</p>
                                      <p style={{color:"#f97316",fontWeight:700,fontSize:12}}>+{inr(dRepl)}</p>
                                    </div>}
                                  </>}
                                  <div>
                                    <p style={{color:t.sub,fontSize:9}}>TAS No.</p>
                                    <p style={{color:"#6366f1",fontWeight:700,fontSize:10,fontFamily:"monospace"}}>{invNo}</p>
                                  </div>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2" strokeLinecap="round" style={{alignSelf:"flex-end",marginTop:0}}><polyline points="9 18 15 12 9 6"/></svg>
                                </div>
                              </div>
                              {/* Bottom row: items / qty / price / total / payment / delivery boy / time */}
                              <div style={{borderTop:`1px solid ${t.border}`,background:dm?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.015)",padding:"8px 12px",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>
                                {[
                                  {label:"Items",val:`${rows.length} items`},
                                  {label:"Qty",val:totalQty},
                                  canSeePrices&&{label:"Price/Unit",val:pricePerUnit>0?`₹${pricePerUnit}`:"—"},
                                  canSeePrices&&{label:"Total Amount",val:inr(tot)},
                                  {label:"Payment",val:paymentStatus,color:paymentStatus==="Paid"?"#10b981":"#f59e0b"},
                                  d.deliveryBoy&&{label:"Delivery Boy",val:d.deliveryBoy},
                                  deliveredAt&&{label:"Delivered At",val:deliveredAt},
                                ].filter(Boolean).map(({label,val,color})=>(
                                  <div key={label}>
                                    <p style={{color:t.sub,fontSize:9,fontWeight:600,marginBottom:1}}>{label}</p>
                                    <p style={{color:color||t.text,fontWeight:700,fontSize:11}}>{val}</p>
                                  </div>
                                ))}
                              </div>
                            </div>;
                          })}
                        </div>
                        <p style={{color:t.sub,fontSize:10,textAlign:"center",marginTop:12,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          Click any delivery to open full detail
                        </p>
                      </div>
                    </div>;
                  })()}
                </div>;
              })}
            </div>;
          })()}

          {/* ── DESKTOP VIEWS (compact & expanded) ── */}
          {clvFilter==="og"&&custView==="compact"&&!isMobile&&(()=>{
            // ── COMPACT CUSTOMER CARDS VIEW ──
            let displayCust=[...fCust];
            if(custStatusFilter==="active") displayCust=displayCust.filter(c=>c.active);
            else if(custStatusFilter==="inactive") displayCust=displayCust.filter(c=>!c.active);
            else if(custStatusFilter==="owing") displayCust=displayCust.filter(c=>(c.pending||0)>0);
            else if(custStatusFilter==="clear") displayCust=displayCust.filter(c=>(c.pending||0)===0);
            displayCust=displayCust.map(c=>{
              const cDelivs=deliveries.filter(d=>d.customerId===c.id);
              const cDone=cDelivs.filter(d=>d.status==="Delivered");
              const cTransit=cDelivs.filter(d=>d.status==="In Transit");
              const cPend=cDelivs.filter(d=>d.status==="Pending");
              const cCancelled=cDelivs.filter(d=>d.status==="Cancelled");
              const cRepl=cDelivs.filter(d=>d.replacement?.done);
              const cReplAmt=cDelivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
              const lastDeliv=cDelivs.length>0?[...cDelivs].sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0]:null;
              const cRev=cDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
              const delivRate=cDelivs.length>0?Math.round(cDone.length/cDelivs.length*100):100;
              const collPct=(c.paid||0)+(c.pending||0)>0?Math.round((c.paid||0)/((c.paid||0)+(c.pending||0))*100):100;
              return {...c,_cDelivs:cDelivs,_cDone:cDone,_cTransit:cTransit,_cPend:cPend,_cCancelled:cCancelled,_cRepl:cRepl,_cReplAmt:cReplAmt,_lastDeliv:lastDeliv,_cRev:cRev,_delivRate:delivRate,_collPct:collPct};
            });
            if(custSortField==="name") displayCust.sort((a,b)=>a.name.localeCompare(b.name));
            else if(custSortField==="lastOrder") displayCust.sort((a,b)=>(b._lastDeliv?.date||"").localeCompare(a._lastDeliv?.date||""));
            else if(custSortField==="pending") displayCust.sort((a,b)=>(b.pending||0)-(a.pending||0));
            else if(custSortField==="orders") displayCust.sort((a,b)=>b._cDelivs.length-a._cDelivs.length);
            else if(custSortField==="revenue") displayCust.sort((a,b)=>b._cRev-a._cRev);
            const CPAGE=200; // show all in compact mode — cards are small enough
            const totalCustRows=displayCust.length;
            const pagedCust=displayCust.slice((custPage-1)*CPAGE,custPage*CPAGE);
            const totalPages=Math.ceil(totalCustRows/CPAGE);
            if(displayCust.length===0) return <p style={{color:t.sub,textAlign:"center",padding:"40px 0",fontSize:13}}>{t18n("noCustomers")}</p>;
            return <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {pagedCust.map((c)=>{
                const isExpanded=selectedCustomer?.id===c.id;
                const lastDiffDays=c._lastDeliv?Math.floor((new Date()-new Date(c._lastDeliv.date))/(1000*60*60*24)):null;
                const lastLabel=lastDiffDays===null?"Never":lastDiffDays===0?"Today":lastDiffDays===1?"Yesterday":`${lastDiffDays}d ago`;
                const lastCol=lastDiffDays===null?"#94a3b8":lastDiffDays>14?"#ef4444":lastDiffDays>7?"#f59e0b":"#10b981";
                const accentColor=c._cDelivs.length===0?"#6b7280":c.active?"#f59e0b":"#94a3b8";
                // Get recent deliveries for expanded view
                const recentDelivs=[...c._cDelivs].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,5);
                return <div key={c.id} style={{background:t.card,border:`1.5px solid ${isExpanded?"#2563eb40":t.border}`,borderRadius:18,overflow:"hidden",boxShadow:isExpanded?"0 4px 20px rgba(37,99,235,0.12)":"0 1px 4px rgba(0,0,0,0.05)",transition:"all 0.2s"}}>
                  {/* ── COMPACT ROW (always visible) ── */}
                  <div style={{padding:"24px 26px",display:"flex",alignItems:"center",gap:24,cursor:"pointer",background:isExpanded?(dm?"rgba(37,99,235,0.1)":"rgba(37,99,235,0.04)"):"transparent"}}
                    onClick={()=>{setSelectedCustomer(isExpanded?null:c);setCustDetailDelivFilter("all");setCustDetailPartialAmt("");}}>
                    {/* Avatar */}
                    <div style={{width:42,height:42,borderRadius:13,background:`${accentColor}20`,color:accentColor,fontWeight:900,fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,position:"relative"}}>
                      {c.name.charAt(0).toUpperCase()}
                      <span style={{position:"absolute",bottom:-2,right:-2,width:10,height:10,borderRadius:"50%",background:c.active?"#10b981":"#94a3b8",border:`2px solid ${t.card}`}}/>
                    </div>
                    {/* Name + sub info */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
                        <p style={{color:t.text,fontWeight:800,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</p>
                        <span style={{background:c.active?"#10b98115":"#6b728015",color:c.active?"#059669":"#6b7280",border:`1px solid ${c.active?"#10b98125":"#6b728025"}`,borderRadius:99,padding:"2px 8px",fontSize:9,fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>
                          {c.active?t18n("active").toUpperCase():t18n("inactive").toUpperCase()}
                        </span>
                        {(c.pending||0)>0&&<span style={{background:"#ef444415",color:"#dc2626",border:"1px solid #ef444425",borderRadius:99,padding:"2px 8px",fontSize:9,fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>DUE</span>}
                      </div>
                      <div style={{display:"flex",gap:6,marginTop:3,flexWrap:"wrap",alignItems:"center"}}>
                        {c.phone&&<span style={{color:t.sub,fontSize:11}}>📞 {c.phone}</span>}
                        {c.address&&<span style={{color:t.sub,fontSize:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:130}}>📍 {c.address}</span>}
                      </div>
                    </div>
                    {/* Stats strip */}
                    <div style={{display:"flex",gap:10,alignItems:"center",flexShrink:0}}>
                      <div style={{textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center"}}>
                        <span style={{color:"#3b82f6",fontWeight:800,fontSize:15,lineHeight:1}}>{c._cDelivs.length}</span>
                        <span style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginTop:2}}>{t18n("orders")}</span>
                      </div>
                      <div style={{textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center"}}>
                        <span style={{color:lastCol,fontWeight:700,fontSize:12,lineHeight:1}}>{lastLabel}</span>
                        <span style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginTop:2}}>{t18n("last")}</span>
                      </div>
                      {canSeePrices&&<div style={{textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center"}}>
                        <span style={{color:"#10b981",fontWeight:800,fontSize:13,lineHeight:1}}>{inr(c.paid||0)}</span>
                        <span style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginTop:2}}>{t18n("paid")}</span>
                      </div>}
                      {canSeeFinancials&&<div style={{textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center"}}>
                        <span style={{color:(c.pending||0)>0?"#ef4444":"#10b981",fontWeight:800,fontSize:13,lineHeight:1}}>{(c.pending||0)>0?inr(c.pending):"✓"}</span>
                        <span style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginTop:2}}>{t18n("due")}</span>
                      </div>}
                      {/* Expand chevron */}
                      <div style={{width:28,height:28,borderRadius:8,background:t.inp,border:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:t.sub,fontSize:13,fontWeight:700,transform:isExpanded?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>
                        ∨
                      </div>
                    </div>
                  </div>

                  {/* ── PROGRESS BAR (always visible under row) ── */}
                  {c._cDelivs.length>0&&<div style={{height:3,background:t.border,display:"flex",gap:1,overflow:"hidden"}}>
                    {[{v:c._cDone.length,col:"#10b981"},{v:c._cTransit.length,col:"#3b82f6"},{v:c._cPend.length,col:"#f59e0b"},{v:c._cCancelled.length,col:"#ef4444"}].map(({v,col},i)=>
                      v>0&&<div key={i} style={{width:`${Math.round(v/c._cDelivs.length*100)}%`,background:col,transition:"width 0.5s"}}/>
                    )}
                  </div>}

                  {/* ── EXPANDED DETAIL PANEL ── */}
                  {isExpanded&&(()=>{
                    const cFull=customers.find(x=>x.id===c.id)||c;
                    const allCDelivs=[...deliveries.filter(d=>d.customerId===c.id)].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
                    const cDue=cFull.pending||0;
                    const cPaid=cFull.paid||0;
                    const tStr=new Date().toISOString().slice(0,10);
                    const yStr=(()=>{const d=new Date(tStr);d.setDate(d.getDate()-1);return d.toISOString().slice(0,10);})();
                    const wStr=(()=>{const d=new Date(tStr);d.setDate(d.getDate()-6);return d.toISOString().slice(0,10);})();
                    const filtDelivs=allCDelivs.filter(d=>{
                      if(custDetailDelivFilter==="today") return d.date===tStr;
                      if(custDetailDelivFilter==="yesterday") return d.date===yStr;
                      if(custDetailDelivFilter==="week") return d.date>=wStr;
                      return true;
                    });
                    return <div style={{borderTop:`1px solid ${t.border}`,background:dm?"rgba(255,255,255,0.01)":"rgba(0,0,0,0.008)"}}>
                      {/* ── TOP: full info grid ── */}
                      <div style={{padding:"14px 16px",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12,borderBottom:`1px solid ${t.border}`}}>
                        {/* Profile block */}
                        <div style={{background:t.inp,borderRadius:14,padding:"14px",display:"flex",flexDirection:"column",gap:8}}>
                          <p style={{color:t.sub,fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:20}}>Profile</p>
                          {[
                            {icon:"👤",val:cFull.name,bold:true},
                            {icon:"📞",val:cFull.phone||"—"},
                            {icon:"📍",val:cFull.address||"—"},
                            {icon:"📅",val:cFull.joinDate?`Since ${cFull.joinDate}`:"—"},
                            {icon:"🆔",val:cFull.id?`ID: ${cFull.id.slice(-8).toUpperCase()}`:"—"},
                          ].map(({icon,val,bold})=>
                            <div key={icon} style={{display:"flex",gap:7,alignItems:"flex-start"}}>
                              <span style={{fontSize:12,flexShrink:0,lineHeight:1.5}}>{icon}</span>
                              <span style={{color:bold?t.text:t.sub,fontSize:12,fontWeight:bold?700:400,lineHeight:1.4,wordBreak:"break-word"}}>{val}</span>
                            </div>
                          )}
                        </div>
                        {/* Financial block */}
                        {canSeePrices&&<div style={{background:t.inp,borderRadius:14,padding:"14px"}}>
                          <p style={{color:t.sub,fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Financials</p>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
                            {[
                              {label:"TOTAL PAID",val:inr(cPaid),color:"#10b981"},
                              {label:"PENDING DUE",val:cDue>0?inr(cDue):"✓ Clear",color:cDue>0?"#ef4444":"#10b981"},
                              {label:"TOTAL BILLED",val:inr(c._cRev),color:"#3b82f6"},
                              {label:"REPLACEMENTS",val:c._cReplAmt>0?inr(c._cReplAmt):"None",color:"#f97316"},
                            ].map(({label,val,color})=>(
                              <div key={label} style={{textAlign:"center",background:t.card,borderRadius:10,padding:"10px 6px"}}>
                                <p style={{color,fontWeight:900,fontSize:15,lineHeight:1}}>{val}</p>
                                <p style={{color:t.sub,fontSize:8,fontWeight:700,textTransform:"uppercase",marginTop:10}}>{label}</p>
                              </div>
                            ))}
                          </div>
                          {/* Payment bar */}
                          <div style={{marginTop:10}}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                              <span style={{color:t.sub,fontSize:9,fontWeight:700}}>Collection</span>
                              <span style={{color:c._collPct>=80?"#10b981":c._collPct>=50?"#f59e0b":"#ef4444",fontWeight:700,fontSize:9}}>{c._collPct}%</span>
                            </div>
                            <div style={{height:6,borderRadius:6,background:t.border,overflow:"hidden"}}>
                              <div style={{width:`${c._collPct}%`,height:"100%",background:c._collPct>=80?"#10b981":c._collPct>=50?"#f59e0b":"#ef4444",borderRadius:6,transition:"width 0.5s"}}/>
                            </div>
                          </div>
                        </div>}
                        {/* Delivery stats block */}
                        <div style={{background:t.inp,borderRadius:14,padding:"14px"}}>
                          <p style={{color:t.sub,fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Order Stats</p>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(140px,100%),1fr))",gap:8,marginBottom:10}}>
                            {[
                              {label:"TOTAL",val:c._cDelivs.length,color:"#6366f1"},
                              {label:"DELIVERED",val:c._cDone.length,color:"#10b981"},
                              {label:"IN TRANSIT",val:c._cTransit.length,color:"#3b82f6"},
                              {label:"PENDING",val:c._cPend.length,color:"#f59e0b"},
                              {label:"CANCELLED",val:c._cCancelled.length,color:"#ef4444"},
                              {label:"REPLACED",val:c._cRepl.length,color:"#f97316"},
                            ].map(({label,val,color})=>(
                              <div key={label} style={{textAlign:"center",background:t.card,borderRadius:10,padding:"8px 4px"}}>
                                <p style={{color,fontWeight:900,fontSize:16,lineHeight:1}}>{val}</p>
                                <p style={{color:t.sub,fontSize:8,fontWeight:700,textTransform:"uppercase",marginTop:2}}>{label}</p>
                              </div>
                            ))}
                          </div>
                          {/* Delivery rate bar */}
                          <div>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                              <span style={{color:t.sub,fontSize:9,fontWeight:700}}>Delivery Rate</span>
                              <span style={{color:c._delivRate>=90?"#10b981":c._delivRate>=70?"#f59e0b":"#ef4444",fontWeight:700,fontSize:9}}>{c._delivRate}%</span>
                            </div>
                            <div style={{height:6,borderRadius:6,background:t.border,overflow:"hidden"}}>
                              <div style={{width:`${c._delivRate}%`,height:"100%",background:c._delivRate>=90?"#10b981":c._delivRate>=70?"#f59e0b":"#ef4444",borderRadius:6,transition:"width 0.5s"}}/>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ── ACTIONS ROW ── */}
                      <div style={{padding:"10px 14px",borderBottom:`1px solid ${t.border}`,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                        <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",marginRight:4,flexShrink:0}}>Actions:</p>
                        {can("cust_edit")&&<button onClick={()=>{setCsh(cFull);setCf(cFull);setSelectedCustomer(null);}} style={{background:t.inp,border:`1px solid ${t.border}`,color:t.text,borderRadius:9,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>✏️ Edit</button>}
                        {can("cust_export")&&<button onClick={()=>exportPDF(cFull,products,"customer",settings,deliveries)} style={{background:"#7c3aed",color:"#fff",border:"none",borderRadius:9,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>📄 PDF</button>}
                        {can("cust_export")&&<button onClick={()=>exportCustomerReports([cFull.id])} title="Full customer report — all deliveries, batches & activity log" style={{background:"#7c3aed15",color:"#7c3aed",border:"1px solid #7c3aed40",borderRadius:9,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>📋 Report</button>}
                        {can("cust_export")&&<button onClick={()=>{const rows=[{...cFull}];exportTabExcel("Customer",rows,[{label:"Name",key:"name"},{label:"Phone",key:"phone"},{label:"Address",key:"address"},{label:"Paid",key:"paid",num:true},{label:"Pending",key:"pending",num:true}],settings);}} style={{background:"#059669",color:"#fff",border:"none",borderRadius:9,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>📊 Excel</button>}
                        {isAdmin&&cDue>0&&<button onClick={()=>{setPaySh(cFull);setPayAmt(String(cDue));setSelectedCustomer(null);}} style={{background:"#f59e0b",color:"#fff",border:"none",borderRadius:9,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>💰 Collect</button>}
                        {can("cust_deactivate")&&<button onClick={()=>{togActive(cFull);setSelectedCustomer(null);}} style={{background:t.inp,border:`1px solid ${t.border}`,color:t.sub,borderRadius:9,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>{cFull.active?"⏸ Pause":"▶ Activate"}</button>}
                        {cFull.phone&&<a href={`https://wa.me/${cFull.phone.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" style={{background:"#25D366",color:"#fff",borderRadius:9,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer",textDecoration:"none"}}>💬 WhatsApp</a>}
                        <button onClick={()=>setDetailModal({type:"customer",data:cFull})} style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:9,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer",marginLeft:"auto"}}>🔍 Full Profile</button>
                        {can("cust_delete")&&<button onClick={()=>delC(cFull)} style={{background:"#ef444415",border:"1px solid #ef444430",color:"#ef4444",borderRadius:9,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>🗑 Delete</button>}
                      </div>

                      {/* ── PARTIAL PAYMENT INLINE ── */}
                      {isAdmin&&cDue>0&&<div style={{padding:"10px 14px",borderBottom:`1px solid ${t.border}`,background:"#f59e0b08"}}>
                        <p style={{color:"#f59e0b",fontWeight:700,fontSize:11,marginBottom:20}}>💰 LOG PARTIAL PAYMENT</p>
                        <div style={{display:"flex",gap:8}}>
                          <input type="number" placeholder="₹ Amount" value={custDetailPartialAmt} onChange={e=>setCustDetailPartialAmt(e.target.value)}
                            style={{flex:1,maxWidth:200,background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:9,padding:"9px 12px",fontSize:13,outline:"none"}}
                            onFocus={e=>{e.target.style.borderColor="#f59e0b";}} onBlur={e=>{e.target.style.borderColor=t.inpB;}}/>
                          <button onClick={()=>{
                            const amt=+custDetailPartialAmt;
                            if(!amt||amt<=0){notify("Enter a valid amount");return;}
                            recordPaymentLedger(cFull.id,cFull.name,amt,"","Cash");
                            setCustDetailPartialAmt("");setSelectedCustomer(null);
                          }} style={{background:"#f59e0b",color:"#fff",border:"none",borderRadius:9,padding:"9px 18px",fontSize:13,fontWeight:700,cursor:"pointer"}}>Apply</button>
                        </div>
                      </div>}

                      {/* ── DELIVERIES LIST ── */}
                      <div style={{padding:"10px 14px"}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:10}}>
                          <p style={{color:t.text,fontWeight:700,fontSize:12}}>DELIVERIES ({allCDelivs.length})</p>
                          <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
                            {[["all","All"],["today","Today"],["yesterday","Yesterday"],["week","This Week"]].map(([k,l])=>(
                              <button key={k} onClick={()=>setCustDetailDelivFilter(k)}
                                style={{background:custDetailDelivFilter===k?"#2563eb":t.inp,color:custDetailDelivFilter===k?"#fff":t.sub,border:`1px solid ${custDetailDelivFilter===k?"#2563eb":t.border}`,borderRadius:99,padding:"16px 24px",fontSize:10,fontWeight:700,cursor:"pointer"}}>
                                {l}
                              </button>
                            ))}
                          </div>
                        </div>
                        {filtDelivs.length===0&&<p style={{color:t.sub,fontSize:12,textAlign:"center",padding:"16px 0"}}>No deliveries match this filter.</p>}
                        <div style={{display:"flex",flexDirection:"column",gap:28,maxHeight:320,overflowY:"auto"}}>
                          {filtDelivs.map((d,di)=>{
                            const tot=lineTotal(d.orderLines);
                            const dRepl=+d.replacement?.amount||0;
                            const dNet=Math.max(0,tot-dRepl);
                            const sc=d.status==="Delivered"?"#10b981":d.status==="Cancelled"?"#ef4444":"#f59e0b";
                            const invNo=(invRegistry?.issued||{})[d.id]||d.invNo||`TAS-${(d.date||"").replace(/-/g,"").slice(2)}-${(d.id||"").slice(-4).toUpperCase()}`;
                            const rows=Object.entries(safeO(d.orderLines)).filter(([,l])=>l.qty>0);
                            return <div key={d.id||di} style={{background:t.inp,borderRadius:12,padding:"18px 20px",border:`1px solid ${t.border}`,cursor:"pointer"}}
                              onClick={()=>setDetailModal({type:"delivery",data:d})}>
                              <div style={{display:"flex",alignItems:"center",gap:20,flexWrap:"wrap",marginBottom:12}}>
                                <span style={{color:t.text,fontWeight:700,fontSize:12}}>{d.date}</span>
                                <span style={{display:"inline-flex",alignItems:"center",gap:22,background:`${sc}18`,color:sc,border:`1px solid ${sc}30`,borderRadius:99,padding:"2px 8px",fontSize:10,fontWeight:700}}>{d.status}</span>
                                {canSeePrices&&<span style={{color:"#10b981",fontWeight:800,fontSize:12,marginLeft:"auto"}}>{inr(tot)}</span>}
                                {dRepl>0&&<span style={{color:"#f97316",fontSize:10,fontWeight:700}}>-{inr(dRepl)} repl</span>}
                                <span style={{color:"#6366f1",fontSize:9,fontFamily:"monospace"}}>{invNo}</span>
                              </div>
                              {rows.length>0&&<div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
                                {rows.map(([prod,l])=><span key={prod} style={{background:t.card,borderRadius:6,padding:"2px 6px",fontSize:10,color:t.sub,border:`1px solid ${t.border}`}}>
                                  {prod}: {l.qty} {canSeePrices&&l.price?`× ${inr(l.price)}`:""}
                                </span>)}
                              </div>}
                              {d.notes&&<p style={{color:t.sub,fontSize:10,marginTop:12}}>📝 {d.notes}</p>}
                            </div>;
                          })}
                        </div>
                        {filtDelivs.length>0&&<p style={{color:t.sub,fontSize:10,textAlign:"right",marginTop:8}}>Click any delivery to open full detail</p>}
                      </div>
                    </div>;
                  })()}
                </div>;
              })}
              {/* Pagination */}
              {totalPages>1&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 4px"}}>
                <span style={{color:t.sub,fontSize:11}}>Showing {Math.min((custPage-1)*CPAGE+1,totalCustRows)}–{Math.min(custPage*CPAGE,totalCustRows)} of {totalCustRows}</span>
                <div style={{display:"flex",gap:4}}>
                  <button onClick={()=>{if(custPage>1){setCustPage(custPage-1);window.scrollTo({top:0,behavior:"smooth"});setSelectedCustomer(null);}}} disabled={custPage===1}
                    style={{background:t.inp,border:`1px solid ${t.border}`,color:custPage===1?t.sub:t.text,borderRadius:8,padding:"22px 28px",fontSize:12,fontWeight:700,cursor:custPage===1?"default":"pointer",opacity:custPage===1?0.5:1}}>← Prev</button>
                  <button onClick={()=>{if(custPage<totalPages){setCustPage(custPage+1);window.scrollTo({top:0,behavior:"smooth"});setSelectedCustomer(null);}}} disabled={custPage>=totalPages}
                    style={{background:t.inp,border:`1px solid ${t.border}`,color:custPage>=totalPages?t.sub:t.text,borderRadius:8,padding:"22px 28px",fontSize:12,fontWeight:700,cursor:custPage>=totalPages?"default":"pointer",opacity:custPage>=totalPages?0.5:1}}>Next →</button>
                </div>
              </div>}
            </div>;
          })()}
          {clvFilter==="og"&&custView==="expanded"&&!isMobile&&(()=>{
            // Apply sort + filter on top of existing fCust search filter
            let displayCust=[...fCust];
            if(custStatusFilter==="active") displayCust=displayCust.filter(c=>c.active);
            else if(custStatusFilter==="inactive") displayCust=displayCust.filter(c=>!c.active);
            else if(custStatusFilter==="owing") displayCust=displayCust.filter(c=>(c.pending||0)>0);
            else if(custStatusFilter==="clear") displayCust=displayCust.filter(c=>(c.pending||0)===0);
            displayCust=displayCust.map(c=>{
              const cDelivs=deliveries.filter(d=>d.customerId===c.id);
              const cDone=cDelivs.filter(d=>d.status==="Delivered");
              const lastDeliv=cDelivs.length>0?[...cDelivs].sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0]:null;
              const cRev=cDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
              return {...c,_cDelivs:cDelivs,_cDone:cDone,_lastDeliv:lastDeliv,_cRev:cRev};
            });
            if(custSortField==="name") displayCust.sort((a,b)=>a.name.localeCompare(b.name));
            else if(custSortField==="lastOrder") displayCust.sort((a,b)=>(b._lastDeliv?.date||"").localeCompare(a._lastDeliv?.date||""));
            else if(custSortField==="pending") displayCust.sort((a,b)=>(b.pending||0)-(a.pending||0));
            else if(custSortField==="orders") displayCust.sort((a,b)=>b._cDelivs.length-a._cDelivs.length);
            else if(custSortField==="revenue") displayCust.sort((a,b)=>b._cRev-a._cRev);

            return <div style={{display:"flex",flexDirection:"column",gap:32}}>
            {displayCust.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-8">No customers found.</p>}
            {/* ── CUSTOMERS DATA TABLE ── */}
            {displayCust.length>0&&(()=>{
              const CUST_PAGE_SIZE=50;
              const totalCustRows=displayCust.length;
              const pagedCust=displayCust.slice((custPage-1)*CUST_PAGE_SIZE,custPage*CUST_PAGE_SIZE);
              return <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",borderRadius:"16px 16px 0 0"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
                    <thead>
                      <tr style={{background:dm?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.025)",borderBottom:`1.5px solid ${t.border}`}}>
                        <th style={{padding:"11px 8px 11px 16px",width:32}}>
                          <input type="checkbox" style={{width:14,height:14,borderRadius:3,accentColor:"#2563eb",cursor:"pointer"}} onClick={e=>e.stopPropagation()}/>
                        </th>
                        <th style={{padding:"11px 0px",width:16}}/>
                        <th style={{padding:"11px 10px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Customer</th>
                        <th style={{padding:"11px 10px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Contact</th>
                        <th style={{padding:"11px 10px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Orders</th>
                        <th style={{padding:"11px 10px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Last Order</th>
                        <th style={{padding:"11px 10px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Status</th>
                        {canSeePrices&&<th style={{padding:"11px 10px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Paid</th>}
                        {canSeeFinancials&&<th style={{padding:"11px 10px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Pending</th>}
                        <th style={{padding:"11px 12px 11px 10px",textAlign:"right",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedCust.map((c,ci)=>{
                        const cDelivs=c._cDelivs||[];
                        const lastDeliv=c._lastDeliv||null;
                        const lastDiffDays=lastDeliv?Math.floor((new Date()-new Date(lastDeliv.date))/(1000*60*60*24)):null;
                        const lastLabel=lastDiffDays===null?"Never":lastDiffDays===0?"Today":lastDiffDays===1?"Yesterday":`${lastDiffDays}d ago`;
                        const lastCol=lastDiffDays===null?"#94a3b8":lastDiffDays>14?"#ef4444":lastDiffDays>7?"#f59e0b":"#10b981";
                        const isEven=ci%2===0;
                        return <tr key={c.id}
                          style={{borderBottom:`1px solid ${t.border}`,background:selectedCustomer?.id===c.id?(dm?"rgba(37,99,235,0.15)":"rgba(37,99,235,0.06)"):isEven?(dm?"rgba(255,255,255,0.01)":"rgba(0,0,0,0.007)"):"transparent",transition:"background 0.12s",cursor:"pointer"}}
                          onClick={()=>{setSelectedCustomer(selectedCustomer?.id===c.id?null:c);setCustDetailDelivFilter("all");setCustDetailPartialAmt("");}}
                          onMouseEnter={e=>{e.currentTarget.style.background=dm?"rgba(255,255,255,0.04)":"rgba(37,99,235,0.04)";}}
                          onMouseLeave={e=>{e.currentTarget.style.background=selectedCustomer?.id===c.id?(dm?"rgba(37,99,235,0.15)":"rgba(37,99,235,0.06)"):isEven?(dm?"rgba(255,255,255,0.01)":"rgba(0,0,0,0.007)"):"transparent";}}>
                          {/* Checkbox */}
                          <td style={{padding:"12px 4px 12px 16px",verticalAlign:"middle",width:32}} onClick={e=>e.stopPropagation()}>
                            <input type="checkbox" style={{width:14,height:14,borderRadius:3,accentColor:"#2563eb",cursor:"pointer",display:"block"}} onClick={e=>e.stopPropagation()}/>
                          </td>
                          {/* Active dot — own column */}
                          <td style={{padding:"12px 0px",verticalAlign:"middle",width:16}}>
                            <span style={{display:"block",width:8,height:8,borderRadius:"50%",background:c.active?"#10b981":"#94a3b8"}}/>
                          </td>
                          {/* Customer name + join date stacked */}
                          <td style={{padding:"12px 10px",verticalAlign:"middle",maxWidth:150}}>
                            <div style={{display:"flex",alignItems:"center",gap:10}}>
                              {(()=>{
                                const avatarPalette=[["#f59e0b","#fffbeb"],["#10b981","#ecfdf5"],["#8b5cf6","#f5f3ff"],["#3b82f6","#eff6ff"],["#ef4444","#fef2f2"],["#f97316","#fff7ed"],["#06b6d4","#ecfeff"],["#ec4899","#fdf2f8"],["#84cc16","#f7fee7"],["#a855f7","#faf5ff"]];
                                const idx=c.name.charCodeAt(0)%avatarPalette.length;
                                const [fg,bg]=c.active?avatarPalette[idx]:["#9ca3af","rgba(107,114,128,0.1)"];
                                return <div style={{width:36,height:36,borderRadius:"50%",background:bg,color:fg,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:15,flexShrink:0,border:`1.5px solid ${fg}30`}}>
                                  {c.name.charAt(0).toUpperCase()}
                                </div>;
                              })()}
                              <div style={{minWidth:0}}>
                                <p style={{color:t.text,fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:20}}>{c.name}</p>
                                {c.joinDate&&<p style={{color:t.sub,fontSize:10}}>Since {c.joinDate}</p>}
                              </div>
                            </div>
                          </td>
                          {/* Contact */}
                          <td style={{padding:"12px 10px",verticalAlign:"middle",maxWidth:130}}>
                            <div style={{display:"flex",alignItems:"center",gap:26,marginBottom:10}}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                              <span style={{color:t.text,fontSize:12}}>{c.address||"—"}</span>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:5}}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2.5" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.72a16 16 0 0 0 5.38 5.38l1.52-1.34a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.01z"/></svg>
                              <span style={{color:t.sub,fontSize:12}}>{c.phone||"—"}</span>
                            </div>
                          </td>
                          {/* Orders count */}
                          <td style={{padding:"12px 10px",verticalAlign:"middle",whiteSpace:"nowrap"}}>
                            <p style={{color:t.text,fontWeight:700,fontSize:13,marginBottom:20}}>{cDelivs.length}</p>
                            <p style={{color:t.sub,fontSize:10}}>{(c._cDone||[]).length} delivered</p>
                          </td>
                          {/* Last Order */}
                          <td style={{padding:"12px 10px",verticalAlign:"middle",whiteSpace:"nowrap"}}>
                            <p style={{color:lastCol,fontWeight:700,fontSize:13,marginBottom:20}}>{lastLabel}</p>
                            {lastDeliv&&<p style={{color:t.sub,fontSize:10}}>{lastDeliv.date}</p>}
                          </td>
                          {/* Status pill */}
                          <td style={{padding:"12px 10px",verticalAlign:"middle"}}>
                            <span style={{display:"inline-flex",alignItems:"center",gap:26,background:c.active?"#10b98115":"#6b728015",color:c.active?"#059669":"#6b7280",border:`1px solid ${c.active?"#10b98125":"#6b728025"}`,borderRadius:99,padding:"7px 15px",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>
                              <span style={{width:6,height:6,borderRadius:"50%",background:c.active?"#10b981":"#6b7280",display:"inline-block"}}/>
                              {c.active?"Active":"Inactive"}
                            </span>
                          </td>
                          {/* Paid */}
                          {canSeePrices&&<td style={{padding:"12px 10px",verticalAlign:"middle",textAlign:"left",whiteSpace:"nowrap"}}>
                            <span style={{color:"#059669",fontWeight:800,fontSize:13}}>{inr(c.paid||0)}</span>
                          </td>}
                          {/* Pending */}
                          {canSeeFinancials&&<td style={{padding:"12px 10px",verticalAlign:"middle",textAlign:"left",whiteSpace:"nowrap"}}>
                            {(c.pending||0)>0
                              ? <span style={{color:"#dc2626",fontWeight:800,fontSize:13}}>{inr(c.pending)}</span>
                              : <span style={{display:"inline-flex",alignItems:"center",gap:24,color:"#10b981",fontWeight:700,fontSize:13}}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                  Clear
                                </span>
                            }
                          </td>}
                          {/* Actions */}
                          <td style={{padding:"12px 12px 12px 10px",verticalAlign:"middle",textAlign:"right",whiteSpace:"nowrap"}}>
                            <div style={{display:"inline-flex",alignItems:"center",gap:6}}>
                              <button onClick={e=>{e.stopPropagation();setDetailModal({type:"customer",data:c});}}
                                title="View customer profile"
                                style={{width:32,height:32,borderRadius:8,background:dm?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)",border:`1px solid ${t.border}`,color:t.sub,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",transition:"all 0.12s"}}
                                onMouseEnter={e=>{e.currentTarget.style.background="#2563eb";e.currentTarget.style.color="#fff";e.currentTarget.style.borderColor="#2563eb";}}
                                onMouseLeave={e=>{e.currentTarget.style.background=dm?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)";e.currentTarget.style.color=t.sub;e.currentTarget.style.borderColor=t.border;}}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              </button>
                              <div style={{position:"relative"}}>
                                <button onClick={e=>{e.stopPropagation();const el=document.getElementById(`c3dot_${c.id}`);if(el){el.style.display=el.style.display==="block"?"none":"block";}}}
                                  style={{width:32,height:32,borderRadius:8,background:dm?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)",border:`1px solid ${t.border}`,color:t.sub,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",transition:"all 0.12s"}}
                                  onMouseEnter={e=>{e.currentTarget.style.background=dm?"rgba(255,255,255,0.12)":"rgba(0,0,0,0.09)";}}
                                  onMouseLeave={e=>{e.currentTarget.style.background=dm?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)";}}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                                </button>
                                <div id={`c3dot_${c.id}`} style={{display:"none",position:"absolute",right:0,top:"calc(100% + 6px)",background:t.card,border:`1px solid ${t.border}`,borderRadius:12,boxShadow:"0 8px 32px rgba(0,0,0,0.18)",zIndex:100,minWidth:180,overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
                                  {[
                                    can("cust_edit")&&{label:"✏️  Edit",action:()=>{setCsh(c);setCf(c);(()=>{const _el=document.getElementById(`c3dot_${c.id}`);if(_el)_el.style.display="none";})() ;}},
                                    can("cust_seePrices")&&{label:"🚚  View Deliveries",action:()=>{setTab("Deliveries");setDelivStatusFilter("all");(()=>{const _el=document.getElementById(`c3dot_${c.id}`);if(_el)_el.style.display="none";})() ;}},
                                    can("cust_markPaid")&&c.pending>0&&{label:"💰  Mark Paid",action:()=>{setPaySh(c);setPayAmt(String(c.pending||0));(()=>{const _el=document.getElementById(`c3dot_${c.id}`);if(_el)_el.style.display="none";})() ;}},
                                    can("cust_deactivate")&&{label:c.active?"🔒  Deactivate":"🔓  Activate",action:()=>{setCust(p=>safeArr(p).map(x=>x.id===c.id?{...x,active:!x.active}:x));addLog(c.active?"Deactivated":"Activated",c.name);(()=>{const _el=document.getElementById(`c3dot_${c.id}`);if(_el)_el.style.display="none";})() ;}},
                                    can("cust_delete")&&{label:"🗑️  Delete",color:"#ef4444",action:()=>{(()=>{const _el=document.getElementById(`c3dot_${c.id}`);if(_el)_el.style.display="none";})() ;delC(c);}},
                                  ].filter(Boolean).map((item,ii)=>(
                                    <button key={ii} onClick={item.action}
                                      style={{display:"block",width:"100%",textAlign:"left",background:"none",border:"none",padding:"20px 24px",fontSize:13,fontWeight:600,color:item.color||t.text,cursor:"pointer",transition:"background 0.1s",borderBottom:`1px solid ${t.border}`}}
                                      onMouseEnter={e=>{e.currentTarget.style.background=dm?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)";}}
                                      onMouseLeave={e=>{e.currentTarget.style.background="none";}}>
                                      {item.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Table Pagination Footer */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"22px 28px",borderTop:`1px solid ${t.border}`,flexWrap:"wrap",gap:22,background:dm?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.015)"}}>
                  <p style={{color:t.sub,fontSize:12,fontWeight:500,flexShrink:0}}>
                    Showing <b style={{color:t.text}}>{Math.min((custPage-1)*CUST_PAGE_SIZE+1,totalCustRows)}</b> to <b style={{color:t.text}}>{Math.min(custPage*CUST_PAGE_SIZE,totalCustRows)}</b> of <b style={{color:t.text}}>{totalCustRows}</b> customers
                  </p>
                  {totalCustRows>CUST_PAGE_SIZE&&(()=>{
                    const totalPages=Math.ceil(totalCustRows/CUST_PAGE_SIZE);
                    const pages=[];
                    for(let p=1;p<=totalPages;p++){if(p===1||p===totalPages||Math.abs(p-custPage)<=1)pages.push(p);else if(pages[pages.length-1]!=="…")pages.push("…");}
                    return <div style={{display:"flex",gap:24,alignItems:"center"}}>
                      <button onClick={()=>{if(custPage>1){setCustPage(custPage-1);window.scrollTo({top:0,behavior:"smooth"});}}} disabled={custPage===1}
                        style={{width:32,height:32,borderRadius:8,background:t.inp,border:`1px solid ${t.border}`,color:custPage===1?t.sub:t.text,cursor:custPage===1?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",opacity:custPage===1?0.4:1}}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                      </button>
                      {pages.map((p,pi)=>p==="…"?<span key={`e${pi}`} style={{color:t.sub,fontSize:12,padding:"0 4px"}}>…</span>:
                        <button key={p} onClick={()=>{setCustPage(p);window.scrollTo({top:0,behavior:"smooth"});}}
                          style={{width:32,height:32,borderRadius:8,background:custPage===p?"#2563eb":t.inp,border:`1px solid ${custPage===p?"#2563eb":t.border}`,color:custPage===p?"#fff":t.text,fontWeight:custPage===p?800:500,fontSize:12,cursor:"pointer",transition:"all 0.12s"}}>{p}</button>
                      )}
                      <button onClick={()=>{const tp=Math.ceil(totalCustRows/CUST_PAGE_SIZE);if(custPage<tp){setCustPage(custPage+1);window.scrollTo({top:0,behavior:"smooth"});}}} disabled={custPage===Math.ceil(totalCustRows/CUST_PAGE_SIZE)}
                        style={{width:32,height:32,borderRadius:8,background:t.inp,border:`1px solid ${t.border}`,color:custPage===Math.ceil(totalCustRows/CUST_PAGE_SIZE)?t.sub:t.text,cursor:custPage===Math.ceil(totalCustRows/CUST_PAGE_SIZE)?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",opacity:custPage===Math.ceil(totalCustRows/CUST_PAGE_SIZE)?0.4:1}}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    </div>;
                  })()}
                  <span style={{color:t.sub,fontSize:11,flexShrink:0}}>{totalCustRows} total</span>
                </div>
              </div>;
            })()}

            {/* ── INLINE CUSTOMER DETAIL PANEL (opens below table on row click) ── */}
            {selectedCustomer&&(()=>{
              const c=customers.find(x=>x.id===selectedCustomer.id)||selectedCustomer;
              const allCDelivs=[...deliveries.filter(d=>d.customerId===c.id)].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
              const cDone=allCDelivs.filter(d=>d.status==="Delivered");
              const cPend=allCDelivs.filter(d=>d.status==="Pending"||d.status==="In Transit");
              const cReturns=allCDelivs.filter(d=>d.status==="Cancelled");
              const cRepl=allCDelivs.filter(d=>d.replacement?.done);
              const cReplAmt=allCDelivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
              const cPartialPaid=c.partialPay||0;
              const cPaid=c.paid||0;
              const cDue=c.pending||0;
              const cRev=cDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
              const cNetRev=Math.max(0,cRev-cReplAmt);
              const delivRate=allCDelivs.length>0?Math.round(cDone.length/allCDelivs.length*100):100;
              const collPct=(cPaid+cDue)>0?Math.round(cPaid/(cPaid+cDue)*100):100;
              const lastD=allCDelivs[0]||null;
              // Delivery filter
              const tStr=new Date().toISOString().slice(0,10);
              const yStr=(()=>{const d=new Date(tStr);d.setDate(d.getDate()-1);return d.toISOString().slice(0,10);})();
              const wStr=(()=>{const d=new Date(tStr);d.setDate(d.getDate()-6);return d.toISOString().slice(0,10);})();
              const filtDelivs=allCDelivs.filter(d=>{
                if(custDetailDelivFilter==="today") return d.date===tStr;
                if(custDetailDelivFilter==="yesterday") return d.date===yStr;
                if(custDetailDelivFilter==="week") return d.date>=wStr;
                return true;
              });
              // Merge deliveries to customer account
              const mergeEnabled=settings?.featureMergeDelivToCustomer!==false;
              return <div style={{background:t.card,border:`1.5px solid #2563eb40`,borderRadius:20,overflow:"hidden",boxShadow:dm?"0 8px 40px rgba(0,0,0,0.4)":"0 8px 32px rgba(37,99,235,0.1)",marginTop:20}}>
                {/* Header */}
                <div style={{padding:"28px 30px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:dm?"rgba(37,99,235,0.08)":"rgba(37,99,235,0.04)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:46,height:46,borderRadius:14,background:c.active?"#f59e0b20":"#6b728015",color:c.active?"#f59e0b":"#9ca3af",fontWeight:900,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,position:"relative"}}>
                      {c.name.charAt(0).toUpperCase()}
                      <span style={{position:"absolute",bottom:-2,right:-2,width:10,height:10,borderRadius:"50%",background:c.active?"#10b981":"#94a3b8",border:`2px solid ${t.card}`}}/>
                    </div>
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
                        <p style={{color:t.text,fontWeight:800,fontSize:16,lineHeight:1.2}}>{c.name}</p>
                        <span style={{background:c.active?"#10b98115":"#6b728015",color:c.active?"#059669":"#6b7280",border:`1px solid ${c.active?"#10b98125":"#6b728025"}`,borderRadius:99,padding:"2px 10px",fontSize:10,fontWeight:700}}>● {c.active?"ACTIVE":"INACTIVE"}</span>
                        <span style={{background:cDue>0?"#ef444415":"#10b98115",color:cDue>0?"#dc2626":"#059669",border:`1px solid ${cDue>0?"#ef444425":"#10b98125"}`,borderRadius:99,padding:"2px 10px",fontSize:10,fontWeight:700}}>{cDue>0?"DUE":"✓ Clear"}</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:24,marginTop:4,flexWrap:"wrap"}}>
                        {c.phone&&<span style={{color:t.sub,fontSize:11}}>📞 {c.phone}</span>}
                        {lastD&&<span style={{color:t.sub,fontSize:11}}>🕒 {lastD.date}</span>}
                        {c.address&&<span style={{color:t.sub,fontSize:11}}>📍 {c.address}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    {canSeePrices&&<div style={{textAlign:"right"}}>
                      <p style={{color:"#10b981",fontWeight:900,fontSize:20,lineHeight:1}}>{inr(cPaid)}</p>
                      <p style={{color:t.sub,fontSize:10}}>collected</p>
                    </div>}
                    <button onClick={()=>setSelectedCustomer(null)} style={{width:32,height:32,borderRadius:9,background:t.inp,border:`1px solid ${t.border}`,color:t.sub,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700}}>∧</button>
                  </div>
                </div>

                {/* Body: two-col on desktop */}
                <div style={{display:"flex",flexDirection:"row",gap:0,flexWrap:"wrap"}}>

                  {/* LEFT COLUMN — stats + actions */}
                  <div style={{flex:"0 0 auto",width:"min(320px,100%)",borderRight:`1px solid ${t.border}`,padding:"28px 28px",display:"flex",flexDirection:"column",gap:12}}>
                    {/* Stat boxes */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                      {[
                        {label:"ORDERS",val:allCDelivs.length,color:"#3b82f6"},
                        {label:"DELIVERED",val:cDone.length,color:"#10b981"},
                        {label:"RETURNS",val:cReturns.length,color:"#ef4444"},
                      ].map(({label,val,color})=>(
                        <div key={label} style={{background:t.inp,borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
                          <p style={{color,fontWeight:900,fontSize:18,lineHeight:1}}>{val}</p>
                          <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginTop:4,letterSpacing:"0.05em"}}>{label}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                      {[
                        {label:"REPLACED",val:cRepl.length,color:"#f97316"},
                        {label:"REPL. DEDUCTED",val:inr(cReplAmt),color:"#f97316"},
                        {label:"PARTIAL PAID",val:inr(cPartialPaid),color:"#d97706"},
                      ].map(({label,val,color})=>(
                        <div key={label} style={{background:t.inp,borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
                          <p style={{color,fontWeight:800,fontSize:13,lineHeight:1}}>{val}</p>
                          <p style={{color:t.sub,fontSize:8,fontWeight:700,textTransform:"uppercase",marginTop:4,letterSpacing:"0.04em"}}>{label}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr",gap:8}}>
                      <div style={{background:t.inp,borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
                        <p style={{color:cDue>0?"#ef4444":"#10b981",fontWeight:800,fontSize:13,lineHeight:1}}>{inr(cDue)}</p>
                        <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginTop:12}}>PENDING</p>
                      </div>
                    </div>

                    {/* Delivery rate bar */}
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                        <span style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase"}}>Delivery Rate</span>
                        <span style={{color:delivRate>=90?"#10b981":delivRate>=70?"#f59e0b":"#ef4444",fontWeight:700,fontSize:10}}>{delivRate}%</span>
                      </div>
                      <div style={{height:7,borderRadius:7,background:t.border,overflow:"hidden"}}>
                        <div style={{width:`${delivRate}%`,height:"100%",background:delivRate>=90?"#10b981":delivRate>=70?"#f59e0b":"#ef4444",borderRadius:7,transition:"width 0.5s"}}/>
                      </div>
                    </div>

                    {/* Payment status box */}
                    {canSeePrices&&<div style={{background:t.inp,borderRadius:12,padding:"22px 24px",border:`1px solid ${t.border}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
                        <span style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase"}}>Payment Status</span>
                        <span style={{color:cDue>0?"#f59e0b":"#10b981",fontWeight:700,fontSize:10}}>{cDue>0?"Partial":"✓ Fully Paid"}</span>
                      </div>
                      <div style={{height:6,borderRadius:6,background:t.border,overflow:"hidden",marginBottom:16}}>
                        <div style={{width:`${collPct}%`,height:"100%",background:"#10b981",borderRadius:6}}/>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between"}}>
                        <span style={{color:"#10b981",fontSize:11,fontWeight:700}}>Paid: {inr(cPaid)}</span>
                        <span style={{color:cDue>0?"#ef4444":"#10b981",fontSize:11,fontWeight:700}}>Due: {inr(cDue)}</span>
                      </div>
                    </div>}

                    {/* Location + join date */}
                    <div style={{display:"flex",flexDirection:"column",gap:4}}>
                      {c.address&&<p style={{color:t.sub,fontSize:11}}>📍 {c.address}</p>}
                      {c.joinDate&&<p style={{color:t.sub,fontSize:11}}>📅 Customer since {c.joinDate}</p>}
                    </div>

                    {/* Log Partial Payment */}
                    {isAdmin&&cDue>0&&<div style={{background:"#f59e0b10",border:"1px solid #f59e0b30",borderRadius:12,padding:"22px 24px"}}>
                      <p style={{color:"#f59e0b",fontWeight:700,fontSize:12,marginBottom:20}}>💰 LOG PARTIAL PAYMENT</p>
                      <div style={{display:"flex",gap:8}}>
                        <input type="number" placeholder="₹ Amount" value={custDetailPartialAmt} onChange={e=>setCustDetailPartialAmt(e.target.value)}
                          style={{flex:1,background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:10,padding:"18px 20px",fontSize:14,outline:"none"}}
                          onFocus={e=>{e.target.style.borderColor="#f59e0b";}} onBlur={e=>{e.target.style.borderColor=t.inpB;}}/>
                        <button onClick={()=>{
                          const amt=+custDetailPartialAmt;
                          if(!amt||amt<=0){notify("Enter a valid amount");return;}
                          recordPaymentLedger(c.id,c.name,amt,"Partial payment","Cash");
                          addLog("Partial payment logged",`${c.name} — ${inr(amt)}`);
                          setCustDetailPartialAmt("");
                          setSelectedCustomer(null);
                        }} style={{background:"#f59e0b",color:"#fff",border:"none",borderRadius:10,padding:"20px 24px",fontSize:14,fontWeight:700,cursor:"pointer"}}>Apply</button>
                      </div>
                    </div>}

                    {/* Action buttons */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
                      {can("cust_edit")&&<button onClick={()=>{setCsh(c);setCf(c);setSelectedCustomer(null);}} style={{background:t.inp,border:`1px solid ${t.border}`,color:t.text,borderRadius:10,padding:"10px 8px",fontSize:12,fontWeight:700,cursor:"pointer",textAlign:"center"}}>✏️ Edit</button>}
                      {can("cust_export")&&<button onClick={()=>exportPDF(c,products,"customer",settings,deliveries)} style={{background:"#7c3aed",color:"#fff",border:"none",borderRadius:10,padding:"10px 8px",fontSize:12,fontWeight:700,cursor:"pointer",textAlign:"center"}}>📄 PDF</button>}
                      {can("cust_export")&&<button onClick={()=>exportCustomerReports([c.id])} title="Full customer report" style={{background:"#7c3aed15",color:"#7c3aed",border:"1px solid #7c3aed40",borderRadius:10,padding:"10px 8px",fontSize:12,fontWeight:700,cursor:"pointer",textAlign:"center"}}>📋 Report</button>}
                      {can("cust_export")&&<button onClick={()=>{const rows=[{...c}];exportTabExcel("Customer",rows,[{label:"Name",key:"name"},{label:"Phone",key:"phone"},{label:"Address",key:"address"},{label:"Paid",key:"paid",num:true},{label:"Pending",key:"pending",num:true}],settings);}} style={{background:"#059669",color:"#fff",border:"none",borderRadius:10,padding:"10px 8px",fontSize:12,fontWeight:700,cursor:"pointer",textAlign:"center"}}>📊 XLS</button>}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                      {isAdmin&&cDue>0&&<button onClick={()=>{setPaySh(c);setPayAmt(String(cDue));setSelectedCustomer(null);}} style={{background:"#f59e0b",color:"#fff",border:"none",borderRadius:10,padding:"10px 8px",fontSize:12,fontWeight:700,cursor:"pointer",textAlign:"center"}}>💰 Collect</button>}
                      {can("cust_deactivate")&&<button onClick={()=>{togActive(c);setSelectedCustomer(null);}} style={{background:t.inp,border:`1px solid ${t.border}`,color:t.sub,borderRadius:10,padding:"10px 8px",fontSize:12,fontWeight:700,cursor:"pointer",textAlign:"center"}}>{c.active?"⏸ Pause":"▶ Activate"}</button>}
                      {c.phone&&<a href={`https://wa.me/${c.phone.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" style={{background:"#25D366",color:"#fff",borderRadius:10,padding:"10px 8px",fontSize:12,fontWeight:700,cursor:"pointer",textAlign:"center",textDecoration:"none",display:"block"}}>📍 Map</a>}
                    </div>
                    {can("deliv_add")&&<button onClick={()=>{setDf({...blkD(),customer:c.name,customerId:c.id,address:c.address||"",lat:c.lat||0,lng:c.lng||0,orderLines:c.orderLines?{...c.orderLines}:blkOL()});setDsh("add");setSelectedCustomer(null);}} style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:10,padding:"10px",fontSize:13,fontWeight:700,cursor:"pointer",width:"100%",marginBottom:12}}>+ Add Delivery</button>}
                    {can("cust_delete")&&<button onClick={()=>delC(c)} style={{background:"#ef444415",border:"1px solid #ef444430",color:"#ef4444",borderRadius:10,padding:"10px",fontSize:13,fontWeight:700,cursor:"pointer",width:"100%"}}>🗑 Delete</button>}
                  </div>

                  {/* RIGHT COLUMN — deliveries list */}
                  <div style={{flex:1,minWidth:280,padding:"28px 28px",display:"flex",flexDirection:"column",gap:14}}>
                    <div className="crm-toolbar-split" style={{gap:20}}>
                      <p style={{color:t.text,fontWeight:700,fontSize:13}}>DELIVERIES ({allCDelivs.length} total)</p>
                      <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
                        {[["all","All"],["today","Today"],["yesterday","Yesterday"],["week","This Week"]].map(([k,l])=>(
                          <button key={k} onClick={()=>setCustDetailDelivFilter(k)}
                            style={{background:custDetailDelivFilter===k?"#2563eb":t.inp,color:custDetailDelivFilter===k?"#fff":t.sub,border:`1px solid ${custDetailDelivFilter===k?"#2563eb":t.border}`,borderRadius:99,padding:"9px 18px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>

                    {filtDelivs.length===0&&<p style={{color:t.sub,fontSize:13,textAlign:"center",padding:"24px 0"}}>No deliveries in this period.</p>}
                    <div style={{display:"flex",flexDirection:"column",gap:20,maxHeight:520,overflowY:"auto"}}>
                      {filtDelivs.map(d=>{
                        const dInvNo=(invRegistry?.issued||{})[d.id]||d.invNo||`TAS-${(d.date||"").replace(/-/g,"")}-${(d.id||"").slice(-4).toUpperCase()}`;
                        const dRcptNo=`RCP-${dInvNo.replace(/^[A-Z]+-/,"")}`;
                        const dTot=lineTotal(d.orderLines);
                        const dRepl=+d.replacement?.amount||0;
                        const dNet=Math.max(0,dTot-dRepl);
                        const dCollected=d.partialPayment?.enabled?(+(d.partialPayment?.amount)||0):0;
                        const dBal=Math.max(0,dNet-dCollected);
                        const sc=d.status==="Delivered"?"#10b981":d.status==="Cancelled"?"#ef4444":"#f59e0b";
                        const settled=dBal===0&&dTot>0;
                        const items=Object.entries(safeO(d.orderLines)).filter(([,l])=>l.qty>0);
                        // Auto-merge: if setting on, computed balance contributes to customer paid/pending
                        return <div key={d.id} style={{background:t.inp,borderRadius:14,padding:"14px 16px",border:`1px solid ${settled?"#10b98130":t.border}`}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                              <span style={{color:t.sub,fontSize:11,fontWeight:700}}>{d.date}</span>
                              <span style={{background:sc+"20",color:sc,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{d.status}</span>
                            </div>
                            <div style={{textAlign:"right",flexShrink:0}}>
                              {settled?<span style={{background:"#10b98115",color:"#10b981",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>✓ Settled</span>
                               :<span style={{background:"#f59e0b15",color:"#d97706",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>Due {inr(dBal)}</span>}
                            </div>
                          </div>
                          <div style={{display:"flex",gap:20,flexWrap:"wrap",marginBottom:16}}>
                            <span style={{fontFamily:"monospace",fontSize:9,color:"#7c3aed",background:"#7c3aed10",borderRadius:5,padding:"5px 12px",fontWeight:700}}>{dInvNo}</span>
                            <span style={{fontFamily:"monospace",fontSize:9,color:"#0ea5e9",background:"#0ea5e910",borderRadius:5,padding:"5px 12px",fontWeight:700}}>{dRcptNo}</span>
                          </div>
                          {/* Items */}
                          {items.length>0&&<div style={{marginBottom:16}}>
                            {items.map(([pid,l],ii)=>{
                              const prod=products.find(p=>p.id===pid);
                              return <div key={pid} style={{display:"flex",justifyContent:"space-between",padding:"2px 0",fontSize:12}}>
                                <span style={{color:t.sub}}>{l.qty} × {prod?.name||l.name||pid}</span>
                                {canSeePrices&&<span style={{color:t.text,fontWeight:600}}>{inr(l.qty*(l.priceAmount||0))}</span>}
                              </div>;
                            })}
                          </div>}
                          {canSeePrices&&<div style={{borderTop:`1px solid ${t.border}`,paddingTop:6,display:"flex",flexDirection:"column",gap:2}}>
                            <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                              <span style={{color:t.sub}}>Order total</span>
                              <span style={{color:t.text,fontWeight:700}}>{inr(dTot)}</span>
                            </div>
                            {dRepl>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
                              <span style={{color:"#f97316"}}>🔄 Replacement</span>
                              <span style={{color:"#f97316",fontWeight:600}}>−{inr(dRepl)}</span>
                            </div>}
                            {dCollected>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
                              <span style={{color:"#10b981"}}>💰 Collected</span>
                              <span style={{color:"#10b981",fontWeight:600}}>−{inr(dCollected)}</span>
                            </div>}
                          </div>}
                          {/* Merge button if setting enabled and delivery not yet merged */}
                          {mergeEnabled&&isAdmin&&d.status==="Delivered"&&!d._mergedToCustomer&&dTot>0&&(
                            <button onClick={e=>{
                              e.stopPropagation();
                              const net=Math.max(0,dTot-dRepl);
                              setDeliv(p=>safeArr(p).map(x=>x.id===d.id?{...x,_mergedToCustomer:true}:x));
                              recordPaymentLedger(c.id,c.name,net,"Delivery merged","Cash");
                              addLog("Delivery merged to account",`${c.name} — ${inr(net)}`);
                              notify(`${inr(net)} merged to ${c.name}'s account ✓`);
                            }} style={{marginTop:8,width:"100%",background:"#2563eb",color:"#fff",border:"none",borderRadius:8,padding:"7px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                              ↕ Merge to Account
                            </button>
                          )}
                          {d._mergedToCustomer&&<p style={{marginTop:6,color:"#10b981",fontSize:10,fontWeight:700,textAlign:"center"}}>✓ Merged to account</p>}
                        </div>;
                      })}
                    </div>
                  </div>
                </div>
              </div>;
            })()}
            </div>;
          })()}
  );
}
