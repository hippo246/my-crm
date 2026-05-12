/* eslint-disable react-hooks/exhaustive-deps, no-unused-vars */
import React, { useState, useRef, useCallback } from "react";
import { T } from "../lib/theme";
import { safeArr, safeO, lineTotal, lineRows, inr, today, ts, uid, mapU } from "../lib/utils";
import { exportPDF, exportDeliveryInvoice, exportDeliveryReceipt, exportTabExcel, shareWhatsApp } from "../lib/exports";
import { Btn, Inp, Sel, Hr, Sheet, Pill } from "./ui";

function DetailModal({modal, onClose, dm, customers, deliveries, expenses, supplies, wastage, products, settings, setDetailModal, setEsh, setEf, setDsh, setDf, delE, delD, setPaySh, setPayAmt, isAdmin, sess, invRegistry}) {
  const t = T(dm);
  if (!modal) return null;
  const {type, data} = modal;

  const overlayStyle = {
    position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.72)",
    backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",
    display:"flex",alignItems:"flex-end",justifyContent:"center"
  };
  const panelStyle = {
    background:t.card,border:`1px solid ${t.border}`,borderRadius:"24px 24px 0 0",
    width:"100%",maxWidth:560,height:"auto",maxHeight:"min(92dvh,92svh,92vh)",display:"flex",flexDirection:"column",
    boxShadow:"0 -8px 60px rgba(0,0,0,0.5)",paddingBottom:"env(safe-area-inset-bottom,12px)",overflow:"hidden"
  };
  const Header = ({icon,title,sub,accent})=>(
    <div style={{padding:"20px 22px 16px",borderBottom:`1px solid ${t.border}`,flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:44,height:44,borderRadius:14,background:(accent||"#3b82f6")+"20",border:`1.5px solid ${(accent||"#3b82f6")}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{icon}</div>
          <div>
            <p style={{color:t.text,fontWeight:800,fontSize:15,lineHeight:1.2}}>{title}</p>
            {sub&&<p style={{color:t.sub,fontSize:11,marginTop:2}}>{sub}</p>}
          </div>
        </div>
        <button onClick={onClose} style={{width:36,height:36,borderRadius:10,background:t.inp,border:`1.5px solid ${t.border}`,color:t.sub,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,cursor:"pointer",flexShrink:0}}>✕</button>
      </div>
    </div>
  );
  const Kpi = ({label,val,color,bg})=>(
    <div style={{background:bg||(color+"12"),border:`1px solid ${color}25`,borderRadius:12,padding:"10px 12px",textAlign:"center"}}>
      <p style={{color,fontWeight:900,fontSize:13,lineHeight:1}}>{val}</p>
      <p style={{color:t.sub,fontSize:9,marginTop:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</p>
    </div>
  );
  const Row = ({label,val,color,onClick})=>(
    <div onClick={onClick} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${t.border}`,cursor:onClick?"pointer":"default"}}
      onMouseEnter={ev=>{if(onClick)ev.currentTarget.style.background=t.inp+"88";}} onMouseLeave={ev=>{ev.currentTarget.style.background="transparent";}}>
      <span style={{color:t.sub,fontSize:12}}>{label}</span>
      <span style={{color:color||t.text,fontWeight:700,fontSize:12}}>{val}</span>
    </div>
  );
  const scrollStyle = {overflowY:"auto",WebkitOverflowScrolling:"touch",flex:1,minHeight:0,padding:"0 22px 20px",overscrollBehavior:"contain"};

  // ── EXPENSE DETAIL ──
  if (type === "expense") {
    const e = data;
    return (
      <div style={overlayStyle} onClick={ev=>{if(ev.target===ev.currentTarget)onClose();}}>
        <div style={panelStyle}>
          <Header icon="💸" title={`${e.category} Expense`} sub={`${e.date}${e.vendor?` · ${e.vendor}`:""}`} accent="#ef4444"/>
          <div style={scrollStyle}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,margin:"16px 0"}}>
              <Kpi label="Amount" val={inr(e.amount||0)} color="#ef4444"/>
              <Kpi label="Method" val={e.paymentMethod||"Cash"} color="#8b5cf6"/>
            </div>
            {e.vendor&&<Row label="Vendor / Payee" val={e.vendor}/>}
            {e.approvedBy&&<Row label="Approved By" val={`✅ ${e.approvedBy}`} color="#10b981"/>}
            {e.receipt&&<Row label="Receipt Ref" val={`🧾 ${e.receipt}`}/>}
            {e.tags&&<Row label="Tags" val={e.tags.split(",").map(tg=>`#${tg.trim()}`).join(" ")} color="#8b5cf6"/>}
            {e.notes&&<div style={{background:t.inp,borderRadius:12,padding:"12px 14px",margin:"12px 0"}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:6}}>Notes</p>
              <p style={{color:t.text,fontSize:13,lineHeight:1.5}}>{e.notes}</p>
            </div>}
            {/* Category context */}
            {(()=>{
              const catTotal = expenses.filter(x=>x.category===e.category).reduce((s,x)=>s+(x.amount||0),0);
              const catCount = expenses.filter(x=>x.category===e.category).length;
              const allTotal = expenses.reduce((s,x)=>s+(x.amount||0),0);
              const pct = allTotal>0?Math.round(catTotal/allTotal*100):0;
              return <div style={{background:t.inp,borderRadius:12,padding:"12px 14px",margin:"12px 0"}}>
                <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:10}}>Category Context — {e.category}</p>
                <div className="crm-grid-3" style={{gap:8}}>
                  <Kpi label="Category Total" val={inr(catTotal)} color="#ef4444"/>
                  <Kpi label="# Entries" val={catCount} color="#8b5cf6"/>
                  <Kpi label="% of All Exp" val={`${pct}%`} color="#f59e0b"/>
                </div>
                <div style={{marginTop:10,height:5,borderRadius:5,overflow:"hidden",background:t.border}}>
                  <div style={{width:`${pct}%`,background:"#ef4444",height:"100%",borderRadius:5}}/>
                </div>
              </div>;
            })()}
            {/* Vendor history */}
            {e.vendor&&(()=>{
              const vendorExps = expenses.filter(x=>x.vendor===e.vendor).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
              const vendorTotal = vendorExps.reduce((s,x)=>s+(x.amount||0),0);
              return vendorExps.length>1&&<div style={{margin:"4px 0 12px"}}>
                <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>All Payments to {e.vendor}</p>
                <div style={{border:`1px solid ${t.border}`,borderRadius:10,overflow:"hidden"}}>
                  {vendorExps.map((ve,vi)=>(
                    <div key={ve.id||vi} style={{padding:"8px 12px",display:"grid",gridTemplateColumns:"1fr auto auto",gap:8,borderTop:vi>0?`1px solid ${t.border}`:"none",background:ve.id===e.id?(t.inp+"aa"):"transparent",cursor:"pointer"}}
                      onClick={()=>setDetailModal({type:"expense",data:ve})}>
                      <div>
                        <p style={{color:t.text,fontSize:11,fontWeight:600}}>{ve.category}</p>
                        <p style={{color:t.sub,fontSize:10}}>📅 {ve.date}{ve.paymentMethod?` · ${ve.paymentMethod}`:""}</p>
                      </div>
                      <span style={{color:"#ef4444",fontWeight:800,fontSize:11,alignSelf:"center"}}>{inr(ve.amount)}</span>
                      {ve.id===e.id&&<span style={{color:"#3b82f6",fontSize:9,fontWeight:700,alignSelf:"center"}}>← this</span>}
                    </div>
                  ))}
                  <div style={{padding:"8px 12px",background:t.inp,borderTop:`2px solid ${t.border}`,display:"flex",justifyContent:"space-between"}}>
                    <span style={{color:t.text,fontSize:11,fontWeight:700}}>Total to {e.vendor}</span>
                    <span style={{color:"#ef4444",fontWeight:900,fontSize:12}}>{inr(vendorTotal)}</span>
                  </div>
                </div>
              </div>;
            })()}
            {isAdmin&&<div style={{display:"flex",gap:8,marginTop:12}}>
              <button onClick={()=>{setEf({...e,amount:String(e.amount)});setEsh(e);onClose();}} style={{flex:1,padding:"12px",borderRadius:12,background:t.inp,border:`1.5px solid ${t.border}`,color:t.text,fontWeight:700,fontSize:13,cursor:"pointer"}}>✏️ Edit</button>
              <button onClick={()=>{delE(e);onClose();}} style={{flex:1,padding:"12px",borderRadius:12,background:"#dc2626",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",border:"none"}}>🗑️ Delete</button>
            </div>}
          </div>
        </div>
      </div>
    );
  }

  // ── CUSTOMER DETAIL / HISTORY ──
  if (type === "customer") {
    const c = data;
    const cDelivs = deliveries.filter(d=>d.customerId===c.id);
    const cDelivered = cDelivs.filter(d=>d.status==="Delivered");
    const cPending = cDelivs.filter(d=>d.status==="Pending");
    const cRev = cDelivered.reduce((s,d)=>s+lineTotal(d.orderLines),0);
    const cRepl = cDelivered.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
    const cNetRev = Math.max(0,cRev-cRepl);
    const cAvgOrder = cDelivered.length>0?Math.round(cNetRev/cDelivered.length):0;
    const cPaid = c.paid||0;
    const cDue = c.pending||0;
    const collPct = cPaid+cDue>0?Math.round(cPaid/(cPaid+cDue)*100):100;
    const cProducts = products.map(p=>{
      const qty=cDelivered.reduce((s,d)=>s+(safeO(d.orderLines)[p.id]?.qty||0),0);
      const rev=cDelivered.reduce((s,d)=>s+(safeO(d.orderLines)[p.id]?.qty||0)*(safeO(d.orderLines)[p.id]?.priceAmount||0),0);
      return{...p,qty,rev};
    }).filter(x=>x.qty>0).sort((a,b)=>b.rev-a.rev);
    const lastD = cDelivs.length>0?[...cDelivs].sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0]:null;
    const firstD = cDelivs.length>0?[...cDelivs].sort((a,b)=>(a.date||"").localeCompare(b.date||""))[0]:null;
    return (
      <div style={overlayStyle} onClick={ev=>{if(ev.target===ev.currentTarget)onClose();}}>
        <div style={panelStyle}>
          <Header icon="👤" title={c.name} sub={`${c.phone||"No phone"}${c.address?` · ${c.address}`:""}`} accent="#f59e0b"/>
          <div style={scrollStyle}>
            <div className="crm-grid-3" style={{gap:8,margin:"16px 0"}}>
              <Kpi label="Net Revenue" val={inr(cNetRev)} color="#10b981"/>
              <Kpi label="Collected" val={inr(cPaid)} color="#10b981"/>
              <Kpi label="Pending" val={inr(cDue)} color={cDue>0?"#ef4444":"#10b981"}/>
            </div>
            <div className="crm-grid-4" style={{gap:8,marginBottom:16}}>
              <Kpi label="Orders" val={cDelivs.length} color="#3b82f6"/>
              <Kpi label="Delivered" val={cDelivered.length} color="#10b981"/>
              <Kpi label="Pending" val={cPending.length} color="#f59e0b"/>
              <Kpi label="Coll. Rate" val={`${collPct}%`} color={collPct>=90?"#10b981":collPct>=60?"#f59e0b":"#ef4444"}/>
            </div>
            {/* Collection bar */}
            {(cPaid+cDue)>0&&<div style={{marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{color:"#10b981",fontSize:10,fontWeight:700}}>Collected: {inr(cPaid)}</span>
                <span style={{color:cDue>0?"#ef4444":"#10b981",fontSize:10,fontWeight:700}}>Due: {inr(cDue)}</span>
              </div>
              <div style={{height:8,borderRadius:8,overflow:"hidden",display:"flex",background:t.border}}>
                <div style={{width:`${collPct}%`,background:"#10b981"}}/>
                <div style={{width:`${100-collPct}%`,background:cDue>0?"#ef4444":"transparent"}}/>
              </div>
            </div>}
            {/* Info rows */}
            {c.phone&&<Row label="Phone" val={`📞 ${c.phone}`}/>}
            {c.joinDate&&<Row label="Customer Since" val={c.joinDate}/>}
            {firstD&&<Row label="First Order" val={firstD.date}/>}
            {lastD&&<Row label="Last Activity" val={lastD.date}/>}
            {cAvgOrder>0&&<Row label="Avg Order Value" val={inr(cAvgOrder)} color="#f59e0b"/>}
            {c.notes&&<div style={{background:t.inp,borderRadius:12,padding:"12px 14px",margin:"12px 0"}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>Notes</p>
              <p style={{color:t.text,fontSize:12,lineHeight:1.5}}>{c.notes}</p>
            </div>}
            {/* Products */}
            {cProducts.length>0&&<div style={{margin:"12px 0"}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>Products Ordered</p>
              {cProducts.map(p=>(
                <div key={p.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${t.border}`}}>
                  <div><p style={{color:t.text,fontSize:12,fontWeight:600}}>{p.name}</p><p style={{color:t.sub,fontSize:10}}>{p.qty} units total</p></div>
                  <span style={{color:"#f59e0b",fontWeight:700,fontSize:12,alignSelf:"center"}}>{inr(p.rev)}</span>
                </div>
              ))}
            </div>}
            {/* Delivery history */}
            {cDelivs.length>0&&<div style={{margin:"12px 0"}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>Delivery History ({cDelivs.length})</p>
              <div style={{border:`1px solid ${t.border}`,borderRadius:10,overflow:"hidden"}}>
                <div style={{maxHeight:300,overflowY:"auto"}}>
                  {[...cDelivs].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map((d,di)=>{
                    const st = d.status;
                    const sc = st==="Delivered"?"#10b981":st==="Cancelled"?"#ef4444":"#f59e0b";
                    const tot = lineTotal(d.orderLines);
                    const repl = +d.replacement?.amount||0;
                    const dInvNo2=(invRegistry?.issued||{})[d.id];
                    const dPartial=d.partialPayment?.enabled?(+(d.partialPayment?.amount)||0):0;
                    const dNet=Math.max(0,tot-repl);
                    const dBal=Math.max(0,dNet-dPartial);
                    return <div key={d.id||di} style={{padding:"10px 12px",borderTop:di>0?`1px solid ${t.border}`:"none",cursor:"pointer",transition:"background .12s"}}
                      onClick={()=>setDetailModal({type:"delivery",data:d})}
                      onMouseEnter={ev=>{ev.currentTarget.style.background=t.inp+"88";}} onMouseLeave={ev=>{ev.currentTarget.style.background="transparent";}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div>
                          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2,flexWrap:"wrap"}}>
                            <span style={{background:sc+"20",color:sc,borderRadius:5,padding:"1px 7px",fontSize:9,fontWeight:700}}>{st}</span>
                            <span style={{color:t.sub,fontSize:10}}>📅 {d.date}</span>
                            {dInvNo2&&<span style={{fontFamily:"monospace",fontSize:9,color:t.sub,background:t.inp,borderRadius:4,padding:"1px 5px"}}>{dInvNo2}</span>}
                          </div>
                          {d.createdBy&&<p style={{color:t.sub,fontSize:10}}>👤 {d.createdBy}</p>}
                          {d.orderLines&&<p style={{color:t.sub,fontSize:10,marginTop:2}}>{Object.entries(d.orderLines).filter(([,l])=>l.qty>0).map(([pid,l])=>{const prod=products.find(p=>p.id===pid);return`${l.qty}×${prod?.name||l.name||pid}`;}).join(", ")}</p>}
                          {d.replacement?.done&&<p style={{color:"#f97316",fontSize:10,marginTop:2}}>🔄 Replacement: {d.replacement.item||""}{d.replacement.qty?` (${d.replacement.qty})`:""}{repl>0?` · −${inr(repl)}`:""}</p>}
                        </div>
                        <div style={{textAlign:"right"}}>
                          {st==="Delivered"&&<p style={{color:"#10b981",fontWeight:800,fontSize:12}}>{inr(tot)}</p>}
                          {repl>0&&<p style={{color:"#f97316",fontSize:10}}>Net: {inr(dNet)}</p>}
                          {dPartial>0&&<p style={{color:"#10b981",fontSize:10}}>💰 {inr(dPartial)}</p>}
                          {dPartial>0&&<p style={{color:dBal>0?"#f59e0b":"#10b981",fontSize:10,fontWeight:700}}>{dBal>0?`Due: ${inr(dBal)}`:"✓ Settled"}</p>}
                        </div>
                      </div>
                    </div>;
                  })}
                </div>
              </div>
            </div>}
            {/* Action buttons */}
            {isAdmin&&cDue>0&&<button onClick={()=>{setPaySh(c);setPayAmt("");onClose();}} style={{width:"100%",padding:"13px",borderRadius:12,background:"#10b981",color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",border:"none",marginTop:8}}>💰 Record Payment — {inr(cDue)} due</button>}
          </div>
        </div>
      </div>
    );
  }

  // ── DELIVERY DETAIL ──
  if (type === "delivery") {
    const d = data;
    const tot = lineTotal(d.orderLines);
    const repl = +d.replacement?.amount||0;
    const net = Math.max(0,tot-repl);
    const cust = customers.find(c=>c.id===d.customerId)||{name:d.customer};
    const st = d.status;
    const sc = st==="Delivered"?"#10b981":st==="Cancelled"?"#ef4444":"#f59e0b";
    const items = Object.entries(safeO(d.orderLines)).filter(([,l])=>l.qty>0);
    return (
      <div style={overlayStyle} onClick={ev=>{if(ev.target===ev.currentTarget)onClose();}}>
        <div style={panelStyle}>
          <Header icon="📦" title={d.customer} sub={`${d.date}${d.deliveryDate&&d.deliveryDate!==d.date?` · Deliver by ${d.deliveryDate}`:""}`} accent={sc}/>
          <div style={scrollStyle}>
            <div className="crm-grid-3" style={{gap:8,margin:"16px 0"}}>
              <Kpi label="Status" val={st} color={sc}/>
              <Kpi label="Order Total" val={inr(tot)} color="#10b981"/>
              <Kpi label="Net" val={inr(net)} color={repl>0?"#f97316":"#10b981"}/>
            </div>
            {d.createdBy&&<Row label="Created By" val={`👤 ${d.createdBy}`} onClick={()=>setDetailModal({type:"agent",data:{name:d.createdBy}})}/>}
            {d.createdAt&&<Row label="Created At" val={d.createdAt}/>}
            {d.address&&<Row label="Address" val={`📍 ${d.address}`}/>}
            {d.notes&&<div style={{background:t.inp,borderRadius:12,padding:"12px 14px",margin:"12px 0"}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>Notes</p>
              <p style={{color:t.text,fontSize:12,lineHeight:1.5}}>{d.notes}</p>
            </div>}
            {items.length>0&&<div style={{margin:"12px 0"}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>Items</p>
              <div style={{border:`1px solid ${t.border}`,borderRadius:10,overflow:"hidden"}}>
                {items.map(([pid,l],li)=>{
                  const prod=products.find(p=>p.id===pid);
                  return(
                  <div key={pid} style={{padding:"9px 12px",display:"flex",justifyContent:"space-between",borderTop:li>0?`1px solid ${t.border}`:"none"}}>
                    <span style={{color:t.text,fontSize:12,fontWeight:600}}>{l.qty} × {prod?.name||l.name||pid}</span>
                    <span style={{color:"#10b981",fontWeight:700,fontSize:12}}>{inr(l.qty*(l.priceAmount||0))}</span>
                  </div>
                );})}
                <div style={{padding:"9px 12px",background:t.inp,borderTop:`2px solid ${t.border}`,display:"flex",justifyContent:"space-between"}}>
                  <span style={{color:t.text,fontWeight:800,fontSize:12}}>Order Total</span>
                  <span style={{color:"#10b981",fontWeight:900,fontSize:13}}>{inr(tot)}</span>
                </div>
              </div>
            </div>}
            {d.replacement?.done&&<div style={{background:"#f9731615",border:"1px solid #f9731630",borderRadius:12,padding:"12px 14px",margin:"8px 0"}}>
              <p style={{color:"#f97316",fontWeight:700,fontSize:12,marginBottom:4}}>🔄 Replacement</p>
              {d.replacement.item&&<Row label="Item" val={d.replacement.item}/>}
              {d.replacement.qty&&<Row label="Qty" val={d.replacement.qty}/>}
              {repl>0&&<Row label="Amount Deducted" val={inr(repl)} color="#f97316"/>}
              {d.replacement.reason&&<div style={{marginTop:8}}><p style={{color:t.sub,fontSize:11,lineHeight:1.5}}>{d.replacement.reason}</p></div>}
            </div>}
            {d.partialPayment?.enabled&&(+d.partialPayment?.amount||0)>0&&<div style={{background:"#10b98115",border:"1px solid #10b98130",borderRadius:12,padding:"12px 14px",margin:"8px 0"}}>
              <Row label="Collected" val={inr(+d.partialPayment.amount)} color="#10b981"/>
              {d.partialPayment.note&&<p style={{color:t.sub,fontSize:11,marginTop:6,fontStyle:"italic"}}>"{d.partialPayment.note}"</p>}
            </div>}
            {/* Customer quick-link */}
            {cust.id&&<button onClick={()=>setDetailModal({type:"customer",data:cust})} style={{width:"100%",padding:"12px",borderRadius:12,background:t.inp,border:`1.5px solid ${t.border}`,color:t.text,fontWeight:700,fontSize:13,cursor:"pointer",marginTop:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span>👤 View {cust.name}'s full history</span><span style={{color:t.sub}}>→</span>
            </button>}
          </div>
        </div>
      </div>
    );
  }

  // ── DATE DRILLDOWN ──
  if (type === "date") {
    const dateStr = data.date;
    const dayDelivs = deliveries.filter(d=>d.date===dateStr);
    const dayDone = dayDelivs.filter(d=>d.status==="Delivered");
    const dayExp = expenses.filter(e=>e.date===dateStr);
    const daySup = supplies.filter(s=>s.date===dateStr);
    const dayWaste = (wastage||[]).filter(w=>w.date===dateStr);
    const dayRev = dayDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
    const dayExpTotal = dayExp.reduce((s,e)=>s+(e.amount||0),0);
    const daySupTotal = daySup.reduce((s,s2)=>s+(s2.cost||0),0);
    const dayWasteTotal = dayWaste.reduce((s,w)=>s+(w.cost||0),0);
    const dayProfit = dayRev-dayExpTotal-daySupTotal-dayWasteTotal;
    return (
      <div style={overlayStyle} onClick={ev=>{if(ev.target===ev.currentTarget)onClose();}}>
        <div style={panelStyle}>
          <Header icon="📅" title={`Day Drilldown`} sub={dateStr} accent="#3b82f6"/>
          <div style={scrollStyle}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,margin:"16px 0"}}>
              <Kpi label="Revenue" val={inr(dayRev)} color="#10b981"/>
              <Kpi label="Net P&L" val={inr(dayProfit)} color={dayProfit>=0?"#10b981":"#ef4444"}/>
              <Kpi label="Expenses" val={inr(dayExpTotal)} color="#ef4444"/>
              <Kpi label="Supply Cost" val={inr(daySupTotal)} color="#8b5cf6"/>
            </div>
            {dayDelivs.length>0&&<div style={{margin:"8px 0 16px"}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>Deliveries ({dayDelivs.length})</p>
              {dayDelivs.map((d,di)=>{
                const sc=d.status==="Delivered"?"#10b981":d.status==="Cancelled"?"#ef4444":"#f59e0b";
                return <div key={d.id||di} style={{padding:"10px 12px",background:t.inp,borderRadius:10,marginBottom:6,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}
                  onClick={()=>setDetailModal({type:"delivery",data:d})}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                      <span style={{background:sc+"20",color:sc,borderRadius:5,padding:"1px 6px",fontSize:9,fontWeight:700}}>{d.status}</span>
                      <span style={{color:t.text,fontSize:12,fontWeight:600}}>{d.customer}</span>
                    </div>
                    {d.createdBy&&<p style={{color:t.sub,fontSize:10}}>👤 {d.createdBy}</p>}
                  </div>
                  {d.status==="Delivered"&&<span style={{color:"#10b981",fontWeight:800,fontSize:12}}>{inr(lineTotal(d.orderLines))}</span>}
                </div>;
              })}
            </div>}
            {dayExp.length>0&&<div style={{margin:"8px 0 16px"}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>Expenses ({dayExp.length})</p>
              {dayExp.map((e,ei)=><div key={e.id||ei} style={{padding:"10px 12px",background:"#ef444412",border:"1px solid #ef444430",borderRadius:10,marginBottom:6,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}
                onClick={()=>setDetailModal({type:"expense",data:e})}>
                <div>
                  <p style={{color:t.text,fontSize:12,fontWeight:600}}>{e.category}</p>
                  {e.vendor&&<p style={{color:t.sub,fontSize:10}}>{e.vendor}</p>}
                </div>
                <span style={{color:"#ef4444",fontWeight:800,fontSize:12}}>{inr(e.amount)}</span>
              </div>)}
            </div>}
            {daySup.length>0&&<div style={{margin:"8px 0 16px"}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>Supply Entries ({daySup.length})</p>
              {daySup.map((s,si)=><div key={s.id||si} style={{padding:"10px 12px",background:"#8b5cf612",border:"1px solid #8b5cf630",borderRadius:10,marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><p style={{color:t.text,fontSize:12,fontWeight:600}}>{s.item}</p>{s.supplier&&<p style={{color:t.sub,fontSize:10}}>{s.supplier}</p>}</div>
                <div style={{textAlign:"right"}}><p style={{color:"#8b5cf6",fontWeight:800,fontSize:12}}>{inr(s.cost||0)}</p><p style={{color:t.sub,fontSize:10}}>{s.qty} {s.unit}</p></div>
              </div>)}
            </div>}
            {dayWaste.length>0&&<div style={{margin:"8px 0 16px"}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>Wastage ({dayWaste.length})</p>
              {dayWaste.map((w,wi)=><div key={w.id||wi} style={{padding:"10px 12px",background:"#f9731612",border:"1px solid #f9731630",borderRadius:10,marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><p style={{color:t.text,fontSize:12,fontWeight:600}}>{w.product}</p><p style={{color:t.sub,fontSize:10}}>{w.qty} {w.unit} · {w.type}</p></div>
                <span style={{color:"#f97316",fontWeight:800,fontSize:12}}>{inr(w.cost||0)}</span>
              </div>)}
            </div>}
          </div>
        </div>
      </div>
    );
  }

  // ── AGENT / LOGGED-BY HISTORY ──
  if (type === "agent") {
    const agentName = data.name;
    // Fix: spread before sort to avoid mutating the filtered array in-place
    const agentDelivs = [...deliveries.filter(d=>d.createdBy===agentName||d.agent===agentName)].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    const agentDone = agentDelivs.filter(d=>d.status==="Delivered");
    const agentRev = agentDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
    const agentExps = [...expenses.filter(e=>e.approvedBy===agentName)].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    const u = data.user||null;
    return (
      <div style={overlayStyle} onClick={ev=>{if(ev.target===ev.currentTarget)onClose();}}>
        <div style={panelStyle}>
          <Header icon="👤" title={agentName} sub={u?`@${u.username} · ${u.role}`:"Agent / Staff"} accent="#8b5cf6"/>
          <div style={scrollStyle}>
            <div className="crm-grid-3" style={{gap:8,margin:"16px 0"}}>
              <Kpi label="Deliveries" val={agentDelivs.length} color="#3b82f6"/>
              <Kpi label="Delivered" val={agentDone.length} color="#10b981"/>
              <Kpi label="Revenue" val={inr(agentRev)} color="#f59e0b"/>
            </div>
            {agentDelivs.length>0&&<div style={{margin:"8px 0 16px"}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>Delivery Log ({agentDelivs.length})</p>
              <div style={{border:`1px solid ${t.border}`,borderRadius:10,overflow:"hidden"}}>
                <div style={{maxHeight:320,overflowY:"auto"}}>
                  {agentDelivs.map((d,di)=>{
                    const sc=d.status==="Delivered"?"#10b981":d.status==="Cancelled"?"#ef4444":"#f59e0b";
                    return <div key={d.id||di} style={{padding:"10px 12px",borderTop:di>0?`1px solid ${t.border}`:"none",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}
                      onClick={()=>setDetailModal({type:"delivery",data:d})}
                      onMouseEnter={ev=>{ev.currentTarget.style.background=t.inp+"88";}} onMouseLeave={ev=>{ev.currentTarget.style.background="transparent";}}>
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                          <span style={{background:sc+"20",color:sc,borderRadius:5,padding:"1px 6px",fontSize:9,fontWeight:700}}>{d.status}</span>
                          <span style={{color:t.text,fontSize:12,fontWeight:600}}>{d.customer}</span>
                        </div>
                        <p style={{color:t.sub,fontSize:10}}>📅 {d.date}</p>
                      </div>
                      {d.status==="Delivered"&&<span style={{color:"#10b981",fontWeight:800,fontSize:12}}>{inr(lineTotal(d.orderLines))}</span>}
                    </div>;
                  })}
                </div>
              </div>
            </div>}
            {agentExps.length>0&&<div style={{margin:"8px 0 16px"}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>Approved Expenses ({agentExps.length})</p>
              {agentExps.map((e,ei)=><div key={e.id||ei} style={{padding:"9px 12px",background:"#ef444412",borderRadius:10,marginBottom:6,display:"flex",justifyContent:"space-between",cursor:"pointer"}}
                onClick={()=>setDetailModal({type:"expense",data:e})}>
                <div><p style={{color:t.text,fontSize:12,fontWeight:600}}>{e.category}</p><p style={{color:t.sub,fontSize:10}}>{e.date}</p></div>
                <span style={{color:"#ef4444",fontWeight:800,fontSize:12}}>{inr(e.amount)}</span>
              </div>)}
            </div>}
          </div>
        </div>
      </div>
    );
  }

  // ── CATEGORY DRILLDOWN ──
  if (type === "category") {
    const {cat, catExpenses, catTotal} = data;
    const allTotal = expenses.reduce((s,e)=>s+(e.amount||0),0);
    const pct = allTotal>0?Math.round(catTotal/allTotal*100):0;
    return (
      <div style={overlayStyle} onClick={ev=>{if(ev.target===ev.currentTarget)onClose();}}>
        <div style={panelStyle}>
          <Header icon="📂" title={cat} sub={`${catExpenses.length} entries · ${pct}% of all expenses`} accent="#ef4444"/>
          <div style={scrollStyle}>
            <div className="crm-grid-3" style={{gap:8,margin:"16px 0"}}>
              <Kpi label="Total" val={inr(catTotal)} color="#ef4444"/>
              <Kpi label="Entries" val={catExpenses.length} color="#8b5cf6"/>
              <Kpi label="% of All" val={`${pct}%`} color="#f59e0b"/>
            </div>
            <div style={{height:5,borderRadius:5,overflow:"hidden",background:t.border,marginBottom:16}}>
              <div style={{width:`${pct}%`,background:"#ef4444",height:"100%",borderRadius:5}}/>
            </div>
            <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>All {cat} Entries</p>
            <div style={{border:`1px solid ${t.border}`,borderRadius:10,overflow:"hidden"}}>
              <div style={{maxHeight:400,overflowY:"auto"}}>
                {[...catExpenses].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map((e,ei)=>(
                  <div key={e.id||ei} style={{padding:"10px 12px",borderTop:ei>0?`1px solid ${t.border}`:"none",cursor:"pointer",transition:"background .12s"}}
                    onClick={()=>setDetailModal({type:"expense",data:e})}
                    onMouseEnter={ev=>{ev.currentTarget.style.background=t.inp+"88";}} onMouseLeave={ev=>{ev.currentTarget.style.background="transparent";}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <p style={{color:t.sub,fontSize:10}}>📅 {e.date}{e.vendor?` · 🏪 ${e.vendor}`:""}</p>
                        {e.notes&&<p style={{color:t.sub,fontSize:10,fontStyle:"italic",marginTop:1}}>{e.notes}</p>}
                        {e.paymentMethod&&<p style={{color:t.sub,fontSize:10}}>{e.paymentMethod}</p>}
                      </div>
                      <span style={{color:"#ef4444",fontWeight:800,fontSize:13}}>{inr(e.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{padding:"9px 12px",background:t.inp,borderTop:`2px solid ${t.border}`,display:"flex",justifyContent:"space-between"}}>
                <span style={{color:t.text,fontWeight:800,fontSize:12}}>Total · {catExpenses.length} entries</span>
                <span style={{color:"#ef4444",fontWeight:900,fontSize:13}}>{inr(catTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
//  MORNING BRIEFING COMPONENT
// ═══════════════════════════════════════════════════════════════

export { DetailModal };
