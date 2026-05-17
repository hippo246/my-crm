/* eslint-disable react-hooks/exhaustive-deps, no-unused-vars */
import React from "react";
import { SectionHeader, TabStatCards, StatCard, Card, Sheet, Inp, Sel, Btn, Hr, Tog, Search, Pill, DataTable, FilterBar, StatusPill, AvatarCircle, Pagination, BottomNav, Toast, Confirm, ProdRow, OrderEditor } from "../components/ui";
import { T } from "../lib/theme";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, Cell, ReferenceLine } from "recharts";
import { exportCSV, exportTabPDF, exportTabExcel, exportPDF, exportDeliveryLabel, exportDeliveryInvoice, exportDeliveryReceipt, exportAgentReceipt, shareWhatsApp, exportWord } from "../lib/exports";
import { safeArr, safeO, inr, today, uid, ts, lineTotal, lineTotalWithTax } from "../lib/utils";
import { GPSMap } from "../components/GPSMap";
import { PasskeyManager, SecuritySessions, FailedLoginAttempts } from "../components/SecurityPanels";
import { WeatherWidget } from "../components/WeatherWidget";
import { DetailModal } from "../components/DetailModal";

export default function PaymentsTab({ dm, t, isAdmin, today, inr, ts, lineTotalWithTax, deliveries, customers, setDetailModal, taxRtGlobal, invRegistry, paymentLedger, setPayLedgerSh, setPayLedgerCust, setPayLedgerAmt, setPayLedgerNote, setPayLedgerMethod, paymentsSubTab, setPaymentsSubTab, paymentsSearch, setPaymentsSearch, paymentsDateFilter, setPaymentsDateFilter, delPayment }) {
  return (()=>{
          const todayStr=today();
          // ── Build comprehensive payment data ──────────────────────────
          const delivPayments=deliveries.filter(d=>d.status==="Delivered").map(d=>{
            const orderTotal=lineTotalWithTax(d.orderLines,taxRtGlobal);
            const replAmt=+(d.replacement?.amount)||0;
            const netPayable=Math.max(0,orderTotal-replAmt);
            const collected=d.partialPayment?.enabled?(+(d.partialPayment?.amount)||0):0;
            const balance=Math.max(0,netPayable-collected);
            const invNo=(invRegistry?.issued||{})[d.id]||d.invNo||null;
            const rcptNo=invNo?`RCP-${invNo.replace(/^[A-Z0-9]+-/,"")}`:`RCP-${(d.id||"").slice(-6).toUpperCase()}`;
            const payStatus=netPayable===0?"zero":balance===0&&netPayable>0?"settled":collected>0&&balance>0?"partial":"pending";
            return {d,orderTotal,replAmt,netPayable,collected,balance,invNo,rcptNo,payStatus};
          });

          // ── Manual ledger entries ──────────────────────────────────────
          const allLedgerEntries=[
            ...delivPayments.filter(dp=>dp.collected>0).map(dp=>({
              id:`deliv_${dp.d.id}`,type:"delivery",date:dp.d.date,customer:dp.d.customer,customerId:dp.d.customerId,
              amount:dp.collected,balance:dp.balance,invNo:dp.invNo,rcptNo:dp.rcptNo,
              note:dp.d.partialPayment?.note||"",method:"Delivery Collect",by:dp.d.partialPayment?.collectedBy||dp.d.createdBy||"—",
              replAmt:dp.replAmt,orderTotal:dp.orderTotal,netPayable:dp.netPayable,payStatus:dp.payStatus,ts:dp.d.partialPayment?.collectedAt||dp.d.date
            })),
            ...(paymentLedger||[]).filter(e=>!e.deleted).map(e=>({
              id:e.id,type:"manual",date:e.date,customer:e.customerName,customerId:e.customerId,
              amount:e.amount,balance:0,invNo:null,rcptNo:null,
              note:e.note||"",method:e.method||"Cash",by:e.recordedBy||"—",
              replAmt:0,orderTotal:0,netPayable:0,payStatus:"manual",ts:e.ts||e.date
            })),
          ].sort((a,b)=>(b.date||"").localeCompare(a.date||"")||(b.ts||"").localeCompare(a.ts||""));

          // ── Filtered entries ──
          const q2=paymentsSearch.toLowerCase();
          const filteredEntries=allLedgerEntries.filter(e=>{
            const matchQ=!q2||e.customer.toLowerCase().includes(q2)||(e.invNo||"").toLowerCase().includes(q2)||(e.rcptNo||"").toLowerCase().includes(q2)||e.note.toLowerCase().includes(q2);
            const now2=new Date();
            const matchDate=paymentsDateFilter==="all"?true:
              paymentsDateFilter==="today"?e.date===todayStr:
              paymentsDateFilter==="week"?e.date>=(new Date(now2.getTime()-6*86400000).toISOString().slice(0,10)):
              paymentsDateFilter==="month"?e.date>=(new Date(now2.getFullYear(),now2.getMonth(),1).toISOString().slice(0,10)):true;
            return matchQ&&matchDate;
          });

          // ── Outstanding per customer ──
          const custOutstanding=customers.map(c=>{
            const custDelivs=delivPayments.filter(dp=>dp.d.customerId===c.id);
            const totalOrdered=custDelivs.reduce((s,dp)=>s+dp.orderTotal,0);
            const totalRepl=custDelivs.reduce((s,dp)=>s+dp.replAmt,0);
            const totalNet=custDelivs.reduce((s,dp)=>s+dp.netPayable,0);
            const totalCollected=custDelivs.reduce((s,dp)=>s+dp.collected,0);
            const totalBalance=custDelivs.reduce((s,dp)=>s+dp.balance,0);
            const pendingDelivs=custDelivs.filter(dp=>dp.payStatus==="pending");
            const partialDelivs=custDelivs.filter(dp=>dp.payStatus==="partial");
            const settledDelivs=custDelivs.filter(dp=>dp.payStatus==="settled");
            const manualPaid=(paymentLedger||[]).filter(e=>e.customerId===c.id).reduce((s,e)=>s+e.amount,0);
            // manualPaid is not reflected at the delivery level, so we must subtract it here
            // to get the real remaining balance owed by this customer.
            const trueBalance=Math.max(0,totalBalance-manualPaid);
            return {c,totalOrdered,totalRepl,totalNet,totalCollected:totalCollected+manualPaid,totalBalance:trueBalance,pendingDelivs,partialDelivs,settledDelivs,custDelivs};
          }).filter(x=>x.custDelivs.length>0||x.c.pending>0);

          // ── Daily summary ──
          const last30Days=Array.from({length:30},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return d.toISOString().slice(0,10);});
          const dailySummary=last30Days.map(date=>{
            const dayDelivs=delivPayments.filter(dp=>dp.d.date===date);
            const dayOrdered=dayDelivs.reduce((s,dp)=>s+dp.orderTotal,0);
            const dayRepl=dayDelivs.reduce((s,dp)=>s+dp.replAmt,0);
            const dayNet=dayDelivs.reduce((s,dp)=>s+dp.netPayable,0);
            const dayCollected=dayDelivs.reduce((s,dp)=>s+dp.collected,0);
            const dayManual=(paymentLedger||[]).filter(e=>e.date===date).reduce((s,e)=>s+e.amount,0);
            const dayPending=dayNet-dayCollected;
            const dayPartial=dayDelivs.filter(dp=>dp.payStatus==="partial").length;
            const daySettled=dayDelivs.filter(dp=>dp.payStatus==="settled").length;
            const dayUnpaid=dayDelivs.filter(dp=>dp.payStatus==="pending").length;
            return {date,dayOrdered,dayRepl,dayNet,dayCollected,dayManual,totalCash:dayCollected+dayManual,dayPending:Math.max(0,dayPending),dayPartial,daySettled,dayUnpaid,delivCount:dayDelivs.length};
          }).filter(d=>d.delivCount>0||d.dayManual>0);

          // ── Totals ──
          const totalCollectedAll=allLedgerEntries.filter(e=>e.type==="delivery").reduce((s,e)=>s+e.amount,0);
          const totalManualAll=(paymentLedger||[]).reduce((s,e)=>s+e.amount,0);
          const totalReplAll=delivPayments.reduce((s,dp)=>s+dp.replAmt,0);
          const totalBalanceAll=custOutstanding.reduce((s,x)=>s+x.totalBalance,0);
          const partialCustCount=custOutstanding.filter(x=>x.partialDelivs.length>0).length;
          const pendingCustCount=custOutstanding.filter(x=>x.totalBalance>0).length;
          const grandTotal=totalCollectedAll+totalManualAll;

          // ── Colors ──
          const green="#10b981",red="#ef4444",amber="#f59e0b",blue="#3b82f6",orange="#f97316";
          const pillStyle=(color)=>({display:"inline-flex",alignItems:"center",gap:4,background:color+"18",color,borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:700,whiteSpace:"nowrap"});
          const statBox=(label,val,color,sub)=>(
            <div key={label} style={{background:dm?"rgba(255,255,255,0.04)":color+"08",border:`1px solid ${color}20`,borderRadius:14,padding:"14px 16px",display:"flex",flexDirection:"column",gap:4}}>
              <p style={{color,fontWeight:900,fontSize:20,lineHeight:1,letterSpacing:"-0.5px"}}>{val}</p>
              <p style={{color:t.text,fontWeight:700,fontSize:11,lineHeight:1.2}}>{label}</p>
              {sub&&<p style={{color:t.sub,fontSize:10}}>{sub}</p>}
            </div>
          );

          const SUB_TABS=[
            {id:"outstanding",icon:"🔴",label:"Due"},
            {id:"ledger",icon:"📋",label:"Ledger"},
            {id:"daily",icon:"📅",label:"Daily"},
          ];

          return <>
            {/* ── PAYMENTS TAB HEADER ── */}
            <SectionHeader dm={dm} title="Payments" sub="Track collections, dues, and ledger"
              cta={<button onClick={()=>{setPayLedgerCust(null);setPayLedgerAmt("");setPayLedgerNote("");setPayLedgerMethod("Cash");setPayLedgerSh(true);}}
                style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:12,padding:"11px 20px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:7,boxShadow:"0 2px 8px rgba(37,99,235,0.3)"}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Record Payment
              </button>}/>
            <TabStatCards dm={dm} cards={[
              {icon:"💰",label:"Total Collected",value:inr(grandTotal),sub:`${allLedgerEntries.length} transactions`,iconBg:t.statIcon2},
              {icon:"⚠️",label:"Outstanding",value:inr(totalBalanceAll),sub:`${pendingCustCount} customers with dues`,iconBg:totalBalanceAll>0?t.statIcon5:t.statIcon2},
              {icon:"🔄",label:"Replacements",value:inr(totalReplAll),sub:"deducted from orders",iconBg:t.statIcon3},
              {icon:"⚡",label:"Partial Payments",value:partialCustCount,sub:"customers",iconBg:t.statIcon4},
            ]}/>
            {/* ══ OUTSTANDING ALERT BANNER — shown when any customer has dues ══ */}
            {(totalBalanceAll>0||customers.some(c=>(c.pending||0)>0))&&<div style={{background:dm?"#1f0a0a":"#fff1f1",border:`1.5px solid ${red}30`,borderRadius:14,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:22}}>⚠️</span>
                <div>
                  <p style={{color:red,fontWeight:800,fontSize:13}}>{inr(totalBalanceAll)} outstanding</p>
                  <p style={{color:t.sub,fontSize:11}}>{pendingCustCount||customers.filter(c=>(c.pending||0)>0).length} customer{(pendingCustCount||1)!==1?"s":""} haven't fully paid · {partialCustCount} partial</p>
                </div>
              </div>
              <button onClick={()=>setPaymentsSubTab("outstanding")}
                style={{background:red,color:"#fff",borderRadius:10,padding:"8px 16px",fontSize:12,fontWeight:700,border:"none",cursor:"pointer",whiteSpace:"nowrap",WebkitTapHighlightColor:"transparent"}}>
                View All Dues →
              </button>
            </div>}

            {/* ══ SUB-TAB NAV ══ */}
            <div style={{display:"flex",gap:4,background:t.inp,borderRadius:14,padding:4}}>
              {SUB_TABS.map(s=>(
                <button key={s.id} onClick={()=>setPaymentsSubTab(s.id)}
                  style={{flex:1,background:paymentsSubTab===s.id?"#2563eb":"transparent",
                    color:paymentsSubTab===s.id?"#fff":t.sub,
                    borderRadius:10,padding:"10px 6px",fontSize:12,fontWeight:700,border:"none",
                    cursor:"pointer",transition:"all 0.15s",WebkitTapHighlightColor:"transparent",
                    display:"flex",alignItems:"center",justifyContent:"center",gap:4,overflow:"hidden"}}>
                  <span style={{fontSize:14,flexShrink:0}}>{s.icon}</span>
                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.label}</span>
                </button>
              ))}
            </div>

            {/* ══════ OUTSTANDING SUB-TAB ══════ */}
            {paymentsSubTab==="outstanding"&&<>
              {custOutstanding.filter(x=>x.totalBalance>0||(x.c.pending||0)>0).length===0
                ?<div style={{textAlign:"center",padding:"48px 20px"}}>
                    <div style={{fontSize:48,marginBottom:12}}>🎉</div>
                    <p style={{color:t.text,fontWeight:800,fontSize:16}}>All Settled!</p>
                    <p style={{color:t.sub,fontSize:13,marginTop:4}}>No outstanding balances. Every customer is fully paid up.</p>
                  </div>
                :custOutstanding
                    .sort((a,b)=>Math.max(b.totalBalance,b.c.pending||0)-Math.max(a.totalBalance,a.c.pending||0))
                    .map(({c,totalOrdered,totalRepl,totalNet,totalCollected:tc,totalBalance,pendingDelivs,partialDelivs,settledDelivs,custDelivs})=>{
                      const due=Math.max(totalBalance,c.pending||0);
                      const hasDue=due>0;
                      if(!hasDue&&settledDelivs.length===custDelivs.length&&custDelivs.length>0) return null;
                      const pctPaid=totalNet>0?Math.round(tc/totalNet*100):100;
                      const accentColor=hasDue?(pctPaid<30?red:pctPaid<80?amber:orange):green;
                      return <div key={c.id} style={{background:t.card,border:`1.5px solid ${accentColor}25`,borderRadius:18,overflow:"hidden"}}>
                        {/* Card header */}
                        <div style={{background:dm?accentColor+"12":accentColor+"08",padding:"14px 16px",borderBottom:`1px solid ${accentColor}20`}}>
                          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                            <div style={{flex:1,minWidth:0}}>
                              <p style={{color:t.text,fontWeight:800,fontSize:15,lineHeight:1.2}}>{c.name}</p>
                              {c.phone&&<p style={{color:t.sub,fontSize:11,marginTop:2}}>📞 {c.phone}</p>}
                            </div>
                            <div style={{textAlign:"right",flexShrink:0}}>
                              <p style={{color:hasDue?accentColor:green,fontWeight:900,fontSize:20,letterSpacing:"-0.5px"}}>{inr(due)}</p>
                              <p style={{color:t.sub,fontSize:10}}>{hasDue?"outstanding":"all settled"}</p>
                            </div>
                          </div>
                          {/* Progress bar */}
                          {totalNet>0&&<div style={{marginTop:10}}>
                            <div style={{background:dm?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.08)",borderRadius:99,height:6,overflow:"hidden"}}>
                              <div style={{width:`${Math.min(100,pctPaid)}%`,height:"100%",background:pctPaid>=100?green:pctPaid>=60?amber:red,borderRadius:99,transition:"width 0.6s ease"}}/>
                            </div>
                            <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                              <p style={{color:t.sub,fontSize:9}}>{inr(tc)} collected</p>
                              <p style={{color:hasDue?accentColor:green,fontSize:9,fontWeight:700}}>{pctPaid}% paid</p>
                            </div>
                          </div>}
                        </div>
                        {/* Stats row */}
                        <div className="crm-tab-seg crm-tab-seg-3" style={{gap:0,borderBottom:`1px solid ${t.border}`}}>
                          {[["Orders",inr(totalOrdered),t.text],["Replaced",inr(totalRepl),totalRepl>0?orange:t.sub],["Balance",inr(due),hasDue?accentColor:green]].map(([l,v,col],i)=>(
                            <div key={l} style={{padding:"10px 12px",textAlign:"center",borderRight:i<2?`1px solid ${t.border}`:"none"}}>
                              <p style={{color:col,fontWeight:800,fontSize:13,lineHeight:1}}>{v}</p>
                              <p style={{color:t.sub,fontSize:9,marginTop:3,textTransform:"uppercase",letterSpacing:"0.05em"}}>{l}</p>
                            </div>
                          ))}
                        </div>
                        {/* Delivery badges */}
                        {(pendingDelivs.length>0||partialDelivs.length>0||settledDelivs.length>0)&&
                          <div style={{padding:"10px 14px",borderBottom:`1px solid ${t.border}`,display:"flex",gap:8,flexWrap:"wrap"}}>
                            {settledDelivs.length>0&&<span style={pillStyle(green)}>✓ {settledDelivs.length} settled</span>}
                            {partialDelivs.length>0&&<span style={pillStyle(amber)}>⚡ {partialDelivs.length} partial</span>}
                            {pendingDelivs.length>0&&<span style={pillStyle(red)}>⏳ {pendingDelivs.length} unpaid</span>}
                          </div>}
                        {/* Delivery breakdown */}
                        {custDelivs.length>0&&<div style={{padding:"10px 14px",borderBottom:`1px solid ${t.border}`}}>
                          {custDelivs.slice(0,4).map(({d,orderTotal:dOt,replAmt:dRa,netPayable:dNet,collected:dColl,balance:dBal,invNo:dInv,payStatus:dSt})=>{
                            const sc=dSt==="settled"?green:dSt==="partial"?amber:red;
                            return <div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:`1px solid ${t.border}40`}}>
                              <div style={{display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0}}>
                                <span style={{width:6,height:6,borderRadius:"50%",background:sc,flexShrink:0}}/>
                                <span style={{color:t.sub,fontSize:11}}>{d.date}</span>
                                {dInv&&<span style={{color:t.sub,fontSize:9,fontFamily:"monospace",background:t.inp,borderRadius:4,padding:"1px 5px"}}>{dInv}</span>}
                              </div>
                              <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                                <span style={{color:t.text,fontWeight:700,fontSize:12}}>{inr(dNet)}</span>
                                {dBal>0&&<span style={{color:red,fontSize:10,fontWeight:600}}>−{inr(dBal)}</span>}
                              </div>
                            </div>;
                          })}
                          {custDelivs.length>4&&<p style={{color:t.sub,fontSize:10,marginTop:6,textAlign:"center"}}>+{custDelivs.length-4} more</p>}
                        </div>}
                        {/* Action buttons */}
                        <div style={{padding:"12px 14px",display:"flex",gap:8}}>
                          {hasDue&&<button onClick={()=>{setPayLedgerCust(c);setPayLedgerAmt(String(due));setPayLedgerNote("");setPayLedgerMethod("Cash");setPayLedgerSh(true);}}
                            style={{flex:2,background:green,color:"#fff",borderRadius:10,padding:"10px 12px",fontSize:13,fontWeight:800,border:"none",cursor:"pointer",WebkitTapHighlightColor:"transparent",display:"flex",alignItems:"center",justifyContent:"center",gap:6,boxShadow:"0 4px 12px #10b98130"}}>
                            💰 Collect {inr(due)}
                          </button>}
                          <button onClick={()=>setDetailModal({type:"customer",data:c})}
                            style={{flex:1,background:t.inp,color:t.text,borderRadius:10,padding:"10px 12px",fontSize:12,fontWeight:600,border:`1px solid ${t.border}`,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
                            👤 Profile
                          </button>
                        </div>
                      </div>;
                    })}
            </>}

            {/* ══════ LEDGER SUB-TAB ══════ */}
            {paymentsSubTab==="ledger"&&<>
              {/* Search + filter */}
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <Search dm={dm} value={paymentsSearch} onChange={setPaymentsSearch} placeholder="Search customer, invoice, reference…"/>
                <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:2}} className="no-scrollbar">
                  {[["all","All"],["today","Today"],["week","7 Days"],["month","This Month"]].map(([f,label])=>(
                    <button key={f} onClick={()=>setPaymentsDateFilter(f)}
                      style={{background:paymentsDateFilter===f?(dm?"#1e3a5f":"#1e3a5f"):"transparent",
                        color:paymentsDateFilter===f?"#fff":t.sub,
                        borderRadius:20,padding:"6px 14px",fontSize:11,fontWeight:700,
                        border:`1.5px solid ${paymentsDateFilter===f?(dm?"#3b82f6":"#1e3a5f"):t.border}`,
                        cursor:"pointer",flexShrink:0,WebkitTapHighlightColor:"transparent",whiteSpace:"nowrap"}}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {filteredEntries.length===0
                ?<div style={{textAlign:"center",padding:"40px 20px"}}>
                    <p style={{fontSize:32,marginBottom:8}}>📭</p>
                    <p style={{color:t.sub,fontSize:13}}>No payment records found.</p>
                  </div>
                :<div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                    <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
                        <thead>
                          <tr style={{background:dm?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.025)",borderBottom:`1.5px solid ${t.border}`}}>
                            <th style={{padding:"11px 8px 11px 16px",width:28}}></th>
                            <th style={{padding:"11px 12px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Customer</th>
                            <th style={{padding:"11px 12px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Date</th>
                            <th style={{padding:"11px 12px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Invoice / Ref</th>
                            <th style={{padding:"11px 12px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Method</th>
                            <th style={{padding:"11px 12px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Status</th>
                            <th style={{padding:"11px 12px",textAlign:"right",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Amount</th>
                            <th style={{padding:"11px 16px 11px 12px",textAlign:"right",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Balance</th>
                            {isAdmin&&<th style={{padding:"11px 12px",width:40}}></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredEntries.map((entry,ei)=>{
                            const sc=entry.payStatus==="settled"?green:entry.payStatus==="partial"?amber:entry.payStatus==="manual"?blue:red;
                            const slabel=entry.payStatus==="settled"?"Settled":entry.payStatus==="partial"?"Partial":entry.payStatus==="manual"?"Manual":"Pending";
                            const isEven=ei%2===0;
                            return <tr key={entry.id}
                              style={{borderBottom:`1px solid ${t.border}`,background:isEven?(dm?"rgba(255,255,255,0.01)":"rgba(0,0,0,0.007)"):"transparent",transition:"background 0.12s"}}
                              onMouseEnter={e=>{e.currentTarget.style.background=dm?"rgba(255,255,255,0.04)":"rgba(16,185,129,0.04)";}}
                              onMouseLeave={e=>{e.currentTarget.style.background=isEven?(dm?"rgba(255,255,255,0.01)":"rgba(0,0,0,0.007)"):"transparent";}}>
                              {/* Status dot */}
                              <td style={{padding:"14px 4px 14px 16px",verticalAlign:"middle"}}>
                                <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:sc}}/>
                              </td>
                              {/* Customer + note stacked */}
                              <td style={{padding:"14px 12px",verticalAlign:"middle",maxWidth:160}}>
                                <p style={{color:t.text,fontWeight:700,fontSize:13,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{entry.customer}</p>
                                {entry.note&&<p style={{color:t.sub,fontSize:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontStyle:"italic"}}>{entry.note}</p>}
                              </td>
                              {/* Date */}
                              <td style={{padding:"14px 12px",verticalAlign:"middle",whiteSpace:"nowrap"}}>
                                <p style={{color:t.text,fontWeight:600,fontSize:13}}>{entry.date}</p>
                              </td>
                              {/* Invoice / Ref */}
                              <td style={{padding:"14px 12px",verticalAlign:"middle",maxWidth:140}}>
                                {entry.invNo?<span style={{color:t.sub,fontSize:11,fontFamily:"monospace",background:dm?"rgba(139,92,246,0.1)":"rgba(139,92,246,0.07)",border:"1px solid rgba(139,92,246,0.15)",borderRadius:5,padding:"2px 7px"}}>{entry.invNo}</span>:<span style={{color:t.sub,fontSize:11}}>—</span>}
                              </td>
                              {/* Method + by stacked */}
                              <td style={{padding:"14px 12px",verticalAlign:"middle",maxWidth:120}}>
                                <p style={{color:t.text,fontSize:12,fontWeight:600,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{entry.method||"—"}</p>
                                <p style={{color:t.sub,fontSize:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>by {entry.by||"—"}</p>
                              </td>
                              {/* Status pill */}
                              <td style={{padding:"14px 12px",verticalAlign:"middle"}}>
                                <span style={{display:"inline-flex",alignItems:"center",gap:5,background:sc+"18",color:sc,border:`1px solid ${sc}30`,borderRadius:99,padding:"3px 10px",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>
                                  <span style={{width:6,height:6,borderRadius:"50%",background:sc,display:"inline-block"}}/>
                                  {slabel}
                                </span>
                              </td>
                              {/* Amount */}
                              <td style={{padding:"14px 12px",verticalAlign:"middle",textAlign:"right",whiteSpace:"nowrap"}}>
                                <span style={{color:green,fontWeight:800,fontSize:13}}>{inr(entry.amount)}</span>
                              </td>
                              {/* Balance due */}
                              <td style={{padding:"14px 16px 14px 12px",verticalAlign:"middle",textAlign:"right",whiteSpace:"nowrap"}}>
                                <span style={{color:entry.balance>0?red:t.sub,fontWeight:entry.balance>0?800:400,fontSize:13}}>{entry.balance>0?inr(entry.balance):"—"}</span>
                              </td>
                              {/* Delete (admin only, manual entries only) */}
                              {isAdmin&&<td style={{padding:"14px 12px",verticalAlign:"middle",textAlign:"center"}}>
                                {entry.type==="manual"&&delPayment&&<button
                                  onClick={()=>delPayment(entry)}
                                  title="Move to trash"
                                  style={{background:"transparent",border:"none",cursor:"pointer",padding:"4px 6px",borderRadius:6,color:"#ef444480",fontSize:15,lineHeight:1,transition:"color 0.15s"}}
                                  onMouseEnter={e=>e.currentTarget.style.color="#ef4444"}
                                  onMouseLeave={e=>e.currentTarget.style.color="#ef444480"}>
                                  🗑
                                </button>}
                              </td>}
                            </tr>;
                          })}
                        </tbody>
                      </table>
                    </div>
                    {/* Footer */}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 18px",borderTop:`1px solid ${t.border}`,flexWrap:"wrap",gap:10,background:dm?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.015)"}}>
                      <p style={{color:t.sub,fontSize:12}}><b style={{color:t.text}}>{filteredEntries.length}</b> entries</p>
                      <p style={{color:green,fontWeight:700,fontSize:12}}>Total collected: {inr(filteredEntries.reduce((s,e)=>s+e.amount,0))}</p>
                    </div>
                  </div>}
            </>}

            {/* ══════ DAILY SUMMARY SUB-TAB ══════ */}
            {paymentsSubTab==="daily"&&<>
              {dailySummary.length===0
                ?<div style={{textAlign:"center",padding:"40px 20px"}}>
                    <p style={{fontSize:32,marginBottom:8}}>📭</p>
                    <p style={{color:t.sub,fontSize:13}}>No payment data yet.</p>
                  </div>
                :dailySummary.map(day=>{
                    const isToday=day.date===todayStr;
                    const collPct=day.dayNet>0?Math.round((day.dayCollected+day.dayManual)/day.dayNet*100):100;
                    return <div key={day.date} style={{background:isToday?(dm?"#061812":"#f0fdf9"):t.card,border:`1.5px solid ${isToday?green+"50":t.border}`,borderRadius:16,overflow:"hidden"}}>
                      <div style={{padding:"12px 16px",borderBottom:`1px solid ${t.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div>
                          <p style={{color:isToday?green:t.text,fontWeight:800,fontSize:13}}>
                            {isToday&&"🌟 "}{new Date(day.date+"T00:00:00").toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})}
                          </p>
                          <p style={{color:t.sub,fontSize:10,marginTop:2}}>{day.delivCount} order{day.delivCount!==1?"s":""}</p>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <p style={{color:green,fontWeight:900,fontSize:18}}>{inr(day.totalCash)}</p>
                          <p style={{color:t.sub,fontSize:10}}>collected</p>
                        </div>
                      </div>
                      {/* Progress bar */}
                      {day.dayNet>0&&<div style={{padding:"8px 16px",borderBottom:`1px solid ${t.border}`}}>
                        <div style={{background:dm?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)",borderRadius:99,height:5,overflow:"hidden"}}>
                          <div style={{width:`${Math.min(100,collPct)}%`,height:"100%",background:collPct>=100?green:collPct>=60?amber:red,borderRadius:99}}/>
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                          <p style={{color:t.sub,fontSize:9}}>Net billed: {inr(day.dayNet)}</p>
                          <p style={{color:collPct>=100?green:amber,fontSize:9,fontWeight:700}}>{collPct}% collected</p>
                        </div>
                      </div>}
                      <div className="crm-grid-4" style={{gap:0}}>
                        {[["Billed",inr(day.dayOrdered),t.text],["Replaced",inr(day.dayRepl),day.dayRepl>0?orange:t.sub],["Collected",inr(day.totalCash),green],["Still Due",inr(day.dayPending),day.dayPending>0?red:t.sub]].map(([l,v,col],i)=>(
                          <div key={l} style={{padding:"10px 4px",textAlign:"center",borderRight:i<3?`1px solid ${t.border}`:"none"}}>
                            <p style={{color:col,fontWeight:800,fontSize:11,lineHeight:1}}>{v}</p>
                            <p style={{color:t.sub,fontSize:8,marginTop:3,textTransform:"uppercase",letterSpacing:"0.04em"}}>{l}</p>
                          </div>
                        ))}
                      </div>
                      {(day.dayPartial>0||day.daySettled>0||day.dayUnpaid>0||day.dayManual>0)&&
                        <div style={{padding:"8px 14px",display:"flex",gap:8,flexWrap:"wrap",borderTop:`1px solid ${t.border}`}}>
                          {day.daySettled>0&&<span style={pillStyle(green)}>✓ {day.daySettled} settled</span>}
                          {day.dayPartial>0&&<span style={pillStyle(amber)}>⚡ {day.dayPartial} partial</span>}
                          {day.dayUnpaid>0&&<span style={pillStyle(red)}>⏳ {day.dayUnpaid} unpaid</span>}
                          {day.dayManual>0&&<span style={pillStyle(blue)}>💳 {inr(day.dayManual)} manual</span>}
                        </div>}
                    </div>;
                  })}
            </>}
          </>;

  })();
}
