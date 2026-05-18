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
import { dispatchDelivery, advanceDeliveryStatus, cancelDelivery } from "../lib/deliveryEngine";

export default function DeliveriesTab({ dm, t, isAdmin, sess, can, canSeePrices, settings, notify, addLog, today, inr, ts, safeArr, safeO, lineTotal, exportCSV, exportTabPDF, exportTabExcel, exportPDF, exportDeliveryLabel, exportDeliveryInvoice, shareWhatsApp, exportCustomerReports, deliveries, setDeliv, setDf, setDsh, blkD, delD, delivStatusFilter, setDelivStatusFilter, delivDateFilter, setDelivDateFilter, delivDateFrom, setDelivDateFrom, delivDateTo, setDelivDateTo, delivView, setDelivView, delivCalendar, setDelivCalendar, calOffset, setCalOffset, calExpandedDay, setCalExpandedDay, delivPage, setDelivPage, delivBatchFilter, setDelivBatchFilter, delivExportOpen, setDelivExportOpen, customers, products, prodTargets: prodTargetsProp, setDetailModal, bulkSelect, setBulkSelect, bulkSelected, setBulkSelected, invRegistry, expandedDeliveryCust, setExpandedDeliveryCust, setLastReceiptData }) {
  // ── Computed from props ──
  const _actor = { name: sess?.name || "Admin", role: "admin", uid: sess?.uid || null };
  const delivStatusCounts = {
    Delivered: deliveries.filter(d=>d.status==="Delivered").length,
    "In Transit": deliveries.filter(d=>d.status==="In Transit").length,
    Pending: deliveries.filter(d=>d.status==="Pending").length,
    Cancelled: deliveries.filter(d=>d.status==="Cancelled").length,
  };
  const prodTargets = prodTargetsProp || (settings?.prodTargets) || [];
  const lineRows = (orderLines, prods) => Object.entries(orderLines||{}).map(([id,qty])=>{const p=(prods||[]).find(x=>x.id===id)||{};return{id,qty:+qty,name:p.name||id,priceAmount:+(p.price||0)};}).filter(r=>r.qty>0);
  const mapU = (addr,lat,lng) => lat&&lng ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr||"")}`;
  const captureGPS = () => {};
  const srch = "";
  const fDeliv = deliveries.filter(d => delivStatusFilter==="all" || d.status===delivStatusFilter);
  const initBulkRows = () => {};
  const exportFullReport = () => exportCustomerReports ? exportCustomerReports() : notify("Report not available");
  const delivExportBtnRef = React.useRef(null);
  const [collectSh, setCollectSh] = React.useState(null);
  const [collectAmt, setCollectAmt] = React.useState("");
  const [collectNote, setCollectNote] = React.useState("");

  // ── Responsive mobile detection — hoisted here to satisfy Rules of Hooks ──
  const [_mobileW, _setMobileW] = React.useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  React.useEffect(()=>{
    const _onResize = () => _setMobileW(window.innerWidth);
    window.addEventListener("resize", _onResize, {passive:true});
    return () => window.removeEventListener("resize", _onResize);
  }, []);

  const t_local = T(dm); // fallback if t not passed
  return (
    <>
          {/* ── DELIVERIES TAB HEADER ── */}
          <SectionHeader dm={dm} title="Deliveries" sub="Track and manage all your deliveries"
            cta={can("deliv_add")&&<button onClick={()=>{setDf(blkD());setDsh("add");}}
              style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:12,padding:"14px 22px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:7,boxShadow:"0 2px 8px rgba(37,99,235,0.3)"}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Delivery
            </button>}/>
          <TabStatCards dm={dm} cards={[
            {icon:"🚚",label:"Total Deliveries",value:deliveries.length,sub:`${delivStatusCounts.Delivered} delivered`,iconBg:t.statIcon1},
            {icon:"✅",label:"Delivered",value:delivStatusCounts.Delivered,sub:`${Math.round(delivStatusCounts.Delivered/Math.max(1,deliveries.length)*100)}% rate`,iconBg:t.statIcon2},
            {icon:"🔄",label:"In Transit",value:delivStatusCounts["In Transit"],sub:"Active now",iconBg:t.statIcon3},
            {icon:"⏳",label:"Pending",value:delivStatusCounts.Pending,sub:"Awaiting dispatch",iconBg:t.statIcon4},
            {icon:"❌",label:"Cancelled",value:delivStatusCounts.Cancelled,sub:"This period",iconBg:t.statIcon5},
          ]}/>
          {/* Top summary pills — now tappable as filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              {key:"all",label:`All (${deliveries.length})`,c:"stone"},
              {key:"Pending",label:`${delivStatusCounts.Pending} Pending`,c:"amber"},
              {key:"In Transit",label:`${delivStatusCounts["In Transit"]} Transit`,c:"blue"},
              {key:"Delivered",label:`${delivStatusCounts.Delivered} Done`,c:"green"},
            ].map(({key,label,c})=>(
              <button key={key} onClick={()=>setDelivStatusFilter(key)}
                style={{border:`1.5px solid ${delivStatusFilter===key?(c==="amber"?"#f59e0b":c==="blue"?"#3b82f6":c==="green"?"#10b981":"#6b7280"):"transparent"}`,borderRadius:99,padding:"0",background:"transparent",cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>
                <Pill dm={dm} c={delivStatusFilter===key?c:"stone"}>{label}</Pill>
              </button>
            ))}
          </div>
          {/* ── DATE FILTER ROW ── */}
          <div className="flex gap-2 overflow-x-auto pb-2" style={{WebkitOverflowScrolling:"touch",scrollbarWidth:"none",msOverflowStyle:"none",minWidth:0}}>
            {[
              {key:"all",label:"All Dates"},
              {key:"today",label:"Today"},
              {key:"yesterday",label:"Yesterday"},
              {key:"week",label:"This Week"},
              {key:"custom",label:"Custom"},
            ].map(({key,label})=>(
              <button key={key} onClick={()=>setDelivDateFilter(key)}
                style={{flexShrink:0,background:delivDateFilter===key?"#3b82f620":t.inp,color:delivDateFilter===key?"#3b82f6":t.sub,border:`1.5px solid ${delivDateFilter===key?"#3b82f6":t.border}`,borderRadius:99,padding:"13px 22px",fontSize:11,fontWeight:700,cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"manipulation",whiteSpace:"nowrap",minHeight:36}}>
                {label}
              </button>
            ))}
            {(()=>{
              const batches=[...new Map((prodTargets||[]).map(b=>[b.batchId||b.id,b])).values()].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,10);
              if(batches.length===0)return null;
              return <select value={delivBatchFilter} onChange={e=>setDelivBatchFilter(e.target.value)}
                style={{flexShrink:0,background:delivBatchFilter!=="all"?"#7c3aed18":t.inp,color:delivBatchFilter!=="all"?"#8b5cf6":t.sub,border:`1.5px solid ${delivBatchFilter!=="all"?"#8b5cf6":t.border}`,borderRadius:10,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer",outline:"none",appearance:"none",WebkitAppearance:"none"}}>
                <option value="all">🏭 All Batches</option>
                {batches.map(b=><option key={b.batchId||b.id} value={b.batchId||b.id}>{b.batchLabel||"Batch"} · {b.product} · {b.date}</option>)}
              </select>;
            })()}
          </div>
          {delivDateFilter==="custom"&&<div className="flex gap-2 items-center flex-wrap">
            <input type="date" value={delivDateFrom} onChange={e=>setDelivDateFrom(e.target.value)} style={{background:t.inp,border:`1.5px solid ${t.border}`,color:t.text,borderRadius:10,padding:"7px 10px",fontSize:12,outline:"none",flex:1,minWidth:130}}/>
            <span style={{color:t.sub,fontSize:12}}>→</span>
            <input type="date" value={delivDateTo} onChange={e=>setDelivDateTo(e.target.value)} style={{background:t.inp,border:`1.5px solid ${t.border}`,color:t.text,borderRadius:10,padding:"7px 10px",fontSize:12,outline:"none",flex:1,minWidth:130}}/>
          </div>}
          {/* Secondary actions row — scrollable on mobile */}
          <div className="flex gap-2 overflow-x-auto pb-2" style={{WebkitOverflowScrolling:"touch",scrollbarWidth:"none",msOverflowStyle:"none",minWidth:0}}>
            <button onClick={()=>{setBulkSelect(v=>{if(v){setBulkSelected(new Set());}return !v;});}} style={{background:bulkSelect?"#f59e0b":t.inp,color:bulkSelect?"#000":t.sub,border:`1.5px solid ${bulkSelect?"#f59e0b":t.border}`,minHeight:40,padding:"0 14px",borderRadius:10,fontSize:13,fontWeight:600,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"flex",alignItems:"center",gap:28,cursor:"pointer"}}>{bulkSelect?"✕ Cancel":"☑ Bulk select"}</button>
            <button onClick={()=>setDelivCalendar(v=>!v)} style={{background:delivCalendar?"#f59e0b":t.inp,color:delivCalendar?"#000":t.sub,border:`1.5px solid ${delivCalendar?"#f59e0b":t.border}`,minHeight:40,padding:"0 14px",borderRadius:10,fontSize:13,fontWeight:600,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"flex",alignItems:"center",gap:28,cursor:"pointer"}}>{delivCalendar?"📋 List":"📅 Calendar"}</button>
            {can("deliv_add")&&(settings?.bulkOrderEnabled!==false)&&<button onClick={initBulkRows} style={{background:t.inp,color:t.sub,border:`1.5px solid ${t.border}`,minHeight:40,padding:"0 14px",borderRadius:10,fontSize:13,fontWeight:600,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"flex",alignItems:"center",gap:28,cursor:"pointer"}}>📋 Bulk order</button>}
            {can("deliv_report")&&<button onClick={exportFullReport} style={{background:"#7c3aed15",color:"#7c3aed",border:"1.5px solid #7c3aed40",minHeight:40,padding:"0 14px",borderRadius:10,fontSize:13,fontWeight:600,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"flex",alignItems:"center",gap:28,cursor:"pointer"}}>📊 Report</button>}
            {can("deliv_export")&&<button onClick={()=>exportCSV(fDeliv,`deliveries${delivStatusFilter!=="all"?"_"+delivStatusFilter:""}`,[ {label:"Invoice No",val:r=>(invRegistry?.issued||{})[r.id]||""},{label:"Receipt No",val:r=>{const inv=(invRegistry?.issued||{})[r.id];return inv?`RCP-${inv.replace(/^[A-Z0-9]+-/,"")}`:""}},{label:"Customer",key:"customer"},{label:"Date",key:"date"},{label:"Deliver By",key:"deliveryDate"},{label:"Status",key:"status"},{label:"Total Order (₹)",val:r=>lineTotal(r.orderLines)},{label:"Repl Amount (₹)",val:r=>r.replacement?.amount||0},{label:"Net Amount (₹)",val:r=>lineTotal(r.orderLines)-(+r.replacement?.amount||0)},{label:"Partial Paid (₹)",val:r=>r.partialPayment?.enabled?(+r.partialPayment?.amount||0):0},{label:"Balance Due (₹)",val:r=>Math.max(0,lineTotal(r.orderLines)-(+r.replacement?.amount||0)-(r.partialPayment?.enabled?(+r.partialPayment?.amount||0):0))},{label:"Amount Remaining (₹)",val:r=>Math.max(0,lineTotal(r.orderLines)-(+r.replacement?.amount||0)-(r.partialPayment?.enabled?(+r.partialPayment?.amount||0):0))},{label:"Replacement Done",val:r=>r.replacement?.done?"Yes":"No"},{label:"Replacement Item",val:r=>r.replacement?.item||""},{label:"Replacement Type",val:r=>r.replacement?.type||""},{label:"Replacement Qty",val:r=>r.replacement?.qty||""},{label:"Replacement Reason",val:r=>r.replacement?.reason||""},{label:"Address",key:"address"},{label:"Created By",key:"createdBy"},{label:"Notes",key:"notes"}])} style={{background:t.inp,color:t.sub,border:`1.5px solid ${t.border}`,minHeight:44,padding:"0 14px",borderRadius:10,fontSize:13,fontWeight:600,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"flex",alignItems:"center",gap:28,cursor:"pointer"}}>CSV{delivStatusFilter!=="all"?` (${fDeliv.length})`:""}</button>}
            {can("deliv_export")&&<button onClick={()=>{const cols=[{label:"Invoice No",val:r=>(invRegistry?.issued||{})[r.id]||r.invNo||""},{label:"Receipt No",val:r=>{const inv=(invRegistry?.issued||{})[r.id]||r.invNo;return inv?`RCP-${inv.replace(/^[A-Z]+-/,"")}`:"";}},{label:"Customer",key:"customer"},{label:"Date",key:"date"},{label:"Status",key:"status"},{label:"Total Order (₹)",val:r=>lineTotal(r.orderLines),num:true},{label:"Repl (₹)",val:r=>r.replacement?.amount||0,num:true},{label:"Net Amt (₹)",val:r=>lineTotal(r.orderLines)-(+r.replacement?.amount||0),num:true},{label:"Paid (₹)",val:r=>r.partialPayment?.enabled?(+r.partialPayment?.amount||0):0,num:true},{label:"Remaining (₹)",val:r=>Math.max(0,lineTotal(r.orderLines)-(+r.replacement?.amount||0)-(r.partialPayment?.enabled?(+r.partialPayment?.amount||0):0)),num:true},{label:"Repl Item",val:r=>r.replacement?.done?(r.replacement.item||"Done"):"—"},{label:"Repl Qty",val:r=>r.replacement?.qty||""},{label:"Repl Reason",val:r=>r.replacement?.reason||""},{label:"Address",key:"address"},{label:"By",key:"createdBy"}];const totalOrd=fDeliv.reduce((s,d)=>s+lineTotal(d.orderLines),0);const totalPaid=fDeliv.reduce((s,d)=>s+(d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0),0);const totalRepl=fDeliv.reduce((s,d)=>s+(+d.replacement?.amount||0),0);const totalRem=totalOrd-totalRepl-totalPaid;const filterLabel=delivStatusFilter!=="all"?` — ${delivStatusFilter}`:"";const statsHtml=`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px"><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px"><div style="font-size:20px;font-weight:900;color:#0f172a">${fDeliv.length}</div><div style="font-size:10px;color:#94a3b8;text-transform:uppercase;margin-top:4px">Orders${filterLabel}</div></div><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px"><div style="font-size:20px;font-weight:900;color:#059669">${fDeliv.filter(d=>d.status==="Delivered").length}</div><div style="font-size:10px;color:#94a3b8;text-transform:uppercase;margin-top:4px">Delivered</div></div><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px"><div style="font-size:20px;font-weight:900;color:#f59e0b">${fDeliv.filter(d=>d.status==="Pending").length}</div><div style="font-size:10px;color:#94a3b8;text-transform:uppercase;margin-top:4px">Pending</div></div><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px"><div style="font-size:20px;font-weight:900;color:#0f172a">₹${totalOrd.toLocaleString("en-IN")}</div><div style="font-size:10px;color:#94a3b8;text-transform:uppercase;margin-top:4px">Total Order Value</div></div><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px"><div style="font-size:20px;font-weight:900;color:#059669">₹${totalPaid.toLocaleString("en-IN")}</div><div style="font-size:10px;color:#94a3b8;text-transform:uppercase;margin-top:4px">Amount Paid</div></div><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px"><div style="font-size:20px;font-weight:900;color:#dc2626">₹${totalRem.toLocaleString("en-IN")}</div><div style="font-size:10px;color:#94a3b8;text-transform:uppercase;margin-top:4px">Remaining</div></div></div>`;exportTabPDF(`Deliveries${filterLabel}`,fDeliv,cols,settings,statsHtml);}} style={{background:t.inp,color:t.sub,border:`1.5px solid ${t.border}`,minHeight:44,padding:"0 14px",borderRadius:10,fontSize:13,fontWeight:600,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"flex",alignItems:"center",gap:28,cursor:"pointer"}}>PDF{delivStatusFilter!=="all"?` (${fDeliv.length})`:""}</button>}
            {can("deliv_export")&&<button onClick={()=>{const cols=[{label:"Invoice No",val:r=>(invRegistry?.issued||{})[r.id]||""},{label:"Receipt No",val:r=>{const inv=(invRegistry?.issued||{})[r.id];return inv?`RCP-${inv.replace(/^[A-Z0-9]+-/,"")}`:""}},{label:"Customer",key:"customer"},{label:"Date",key:"date"},{label:"Deliver By",key:"deliveryDate"},{label:"Status",key:"status"},{label:"Total Order",val:r=>lineTotal(r.orderLines),num:true},{label:"Repl Amount",val:r=>r.replacement?.amount||0,num:true},{label:"Net Amount",val:r=>lineTotal(r.orderLines)-(+r.replacement?.amount||0),num:true},{label:"Partial Paid",val:r=>r.partialPayment?.enabled?(+r.partialPayment?.amount||0):0,num:true},{label:"Balance Due",val:r=>Math.max(0,lineTotal(r.orderLines)-(+r.replacement?.amount||0)-(r.partialPayment?.enabled?(+r.partialPayment?.amount||0):0)),num:true},{label:"Repl Item",val:r=>r.replacement?.done?(r.replacement.item||"Done"):"—"},{label:"Repl Qty",val:r=>r.replacement?.qty||""},{label:"Repl Reason",val:r=>r.replacement?.reason||""},{label:"Address",key:"address"},{label:"By",key:"createdBy"},{label:"Notes",key:"notes"}];exportTabExcel(`Deliveries${delivStatusFilter!=="all"?" - "+delivStatusFilter:""}`,fDeliv,cols,settings);}} style={{background:t.inp,color:t.sub,border:`1.5px solid ${t.border}`,minHeight:44,padding:"0 14px",borderRadius:10,fontSize:13,fontWeight:600,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"flex",alignItems:"center",gap:28,cursor:"pointer"}}>XLS{delivStatusFilter!=="all"?` (${fDeliv.length})`:""}</button>}
            {can("deliv_export")&&<button ref={delivExportBtnRef} onClick={()=>setDelivExportOpen(v=>!v)} style={{background:delivExportOpen?"#3b82f625":"#3b82f615",color:"#3b82f6",border:`1.5px solid ${delivExportOpen?"#3b82f680":"#3b82f640"}`,minHeight:40,padding:"0 14px",borderRadius:10,fontSize:13,fontWeight:600,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"flex",alignItems:"center",gap:28,cursor:"pointer",flexShrink:0,position:"relative"}}>📅 Date Export {delivExportOpen?"▴":"▾"}</button>}
          </div>
          {/* BULK ACTION BAR */}
          {bulkSelect&&<div style={{background:"#f59e0b15",border:"1.5px solid #f59e0b40",borderRadius:16,padding:"26px 28px"}} className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-5">
              <button onClick={()=>{const pending=fDeliv.filter(d=>d.status==="Pending").map(d=>d.id);setBulkSelected(new Set(pending));}} style={{color:"#f59e0b"}} className="text-xs font-semibold">Select all pending</button>
              <span style={{color:t.sub}} className="text-xs">|</span>
              <button onClick={()=>setBulkSelected(new Set())} style={{color:t.sub}} className="text-xs font-semibold">Clear</button>
              <span style={{color:t.text}} className="text-xs font-bold">{bulkSelected.size} selected</span>
            </div>
            <div className="flex gap-4">
              <button onClick={()=>{if(bulkSelected.size===0){notify("Select at least one delivery");return;}safeArr(deliveries).filter(d=>bulkSelected.has(d.id)).forEach(d=>advanceDeliveryStatus(d,_actor,setDeliv,notify));addLog("Bulk status update",`${bulkSelected.size} deliveries marked Delivered`);setBulkSelected(new Set());setBulkSelect(false);}} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px] bg-emerald-500 text-white">✓ Mark Delivered</button>
              <button onClick={()=>{if(bulkSelected.size===0){notify("Select at least one delivery");return;}safeArr(deliveries).filter(d=>bulkSelected.has(d.id)).forEach(d=>dispatchDelivery(d,_actor,setDeliv,notify));addLog("Bulk status update",`${bulkSelected.size} deliveries set In Transit`);setBulkSelected(new Set());setBulkSelect(false);}} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px] bg-sky-500 text-white">🚚 Set In Transit</button>
            </div>
          </div>}
          {/* View toggle */}
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12,justifyContent:"space-between",flexWrap:"wrap"}}>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{color:t.sub,fontSize:11,fontWeight:600}}>View:</span>
              {[["expanded","📋 Expanded"],["compact","⚡ Compact"]].map(([v,l])=>(
                <button key={v} onClick={()=>setDelivView(v)}
                  style={{background:delivView===v?"#2563eb":t.inp,color:delivView===v?"#fff":t.sub,border:`1.5px solid ${delivView===v?"#2563eb":t.border}`,borderRadius:99,padding:"9px 16px",fontSize:12,fontWeight:700,cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"manipulation",minHeight:36}}>
                  {l}
                </button>
              ))}
            </div>
            <span style={{color:t.sub,fontSize:11,fontWeight:500}}>{fDeliv.length} deliveries</span>
          </div>

          {/* CALENDAR VIEW */}
          {delivCalendar&&(()=>{
            const calDate=new Date();calDate.setMonth(calDate.getMonth()+calOffset);calDate.setDate(1);
            const y=calDate.getFullYear(),m=calDate.getMonth();
            const firstDay=new Date(y,m,1).getDay();
            const daysInMonth=new Date(y,m+1,0).getDate();
            const weeks=[];let week=[];
            for(let i=0;i<firstDay;i++)week.push(null);
            for(let d=1;d<=daysInMonth;d++){
              week.push(d);
              if(week.length===7){weeks.push(week);week=[];}
            }
            if(week.length>0){while(week.length<7)week.push(null);weeks.push(week);}
            const monthStr=`${y}-${String(m+1).padStart(2,"0")}`;
            const mName=calDate.toLocaleString("en-IN",{month:"long",year:"numeric"});
            const statusColor=s=>s==="Delivered"?"#10b981":s==="In Transit"?"#0ea5e9":"#f59e0b";
            // Month-level stats
            const mDelivs=deliveries.filter(d=>d.date&&d.date.startsWith(monthStr));
            const mPending=mDelivs.filter(d=>d.status==="Pending").length;
            const mTransit=mDelivs.filter(d=>d.status==="In Transit").length;
            const mDone=mDelivs.filter(d=>d.status==="Delivered").length;
            const mRevenue=mDelivs.filter(d=>d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0);
            const mPaid=mDelivs.reduce((s,d)=>s+(d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0),0);
            const todayStr=today();
            return <Card dm={dm} className="overflow-hidden">
              {/* Header */}
              <div style={{background:dm?"#0f1923":"#1e3a5f",padding:"14px 16px 12px"}}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p style={{color:"#fff",fontWeight:900,fontSize:17,lineHeight:1}}>{mName}</p>
                    <p style={{color:"rgba(255,255,255,0.55)",fontSize:11,marginTop:10}}>{mDelivs.length} deliveries this month</p>
                  </div>
                  <div className="flex gap-5">
                    <button onClick={()=>setCalOffset(o=>o-1)} style={{background:"rgba(255,255,255,0.12)",color:"#fff",border:"none",borderRadius:8,width:32,height:32,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"}}>‹</button>
                    {calOffset!==0&&<button onClick={()=>setCalOffset(0)} style={{background:"rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.8)",border:"none",borderRadius:8,padding:"0 10px",fontSize:11,fontWeight:600,cursor:"pointer",height:32,WebkitTapHighlightColor:"transparent"}}>Today</button>}
                    <button onClick={()=>setCalOffset(o=>o+1)} style={{background:"rgba(255,255,255,0.12)",color:"#fff",border:"none",borderRadius:8,width:32,height:32,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"}}>›</button>
                  </div>
                </div>
                {/* Month stats row */}
                <div className="crm-grid-4" style={{gap:28}}>
                  {[
                    {label:"Pending",val:mPending,color:"#f59e0b"},
                    {label:"In Transit",val:mTransit,color:"#0ea5e9"},
                    {label:"Delivered",val:mDone,color:"#10b981"},
                    ...(canSeePrices?[{label:"Revenue",val:inr(mRevenue),color:"#a78bfa"}]:[{label:"Paid",val:inr(mPaid),color:"#a78bfa"}]),
                  ].map(({label,val,color})=>(
                    <div key={label} style={{background:"rgba(255,255,255,0.08)",borderRadius:8,padding:"22px 26px",textAlign:"center"}}>
                      <p style={{color,fontWeight:800,fontSize:14,lineHeight:1}}>{val}</p>
                      <p style={{color:"rgba(255,255,255,0.5)",fontSize:9,marginTop:3,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>
              {/* Day-of-week headers */}
              <div style={{padding:"0 8px"}}>
                <div className="grid grid-cols-7" style={{borderBottom:`1px solid ${t.border}`,marginBottom:4,marginTop:20}}>
                  {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>(
                    <div key={d} style={{color:t.sub,textAlign:"center",fontSize:10,fontWeight:700,padding:"4px 0",textTransform:"uppercase",letterSpacing:"0.06em"}}>{d}</div>
                  ))}
                </div>
                {/* Calendar grid */}
                <div style={{display:"flex",flexDirection:"column",gap:22,paddingBottom:10}}>
                  {weeks.map((week,wi)=>(
                    <div key={wi} className="grid grid-cols-7" style={{gap:22}}>
                      {week.map((day,di)=>{
                        if(!day)return <div key={di} style={{minHeight:62}}/>;
                        const dateStr=`${monthStr}-${String(day).padStart(2,"0")}`;
                        const dayDelivs=deliveries.filter(d=>d.date===dateStr&&(!srch||(d.customer||"").toLowerCase().includes(srch.toLowerCase())||(d.status||"").toLowerCase().includes(srch.toLowerCase())));
                        const isToday=dateStr===todayStr;
                        const isExpanded=calExpandedDay===dateStr;
                        const isPast=dateStr<todayStr;
                        const pendCount=dayDelivs.filter(d=>d.status==="Pending").length;
                        const transitCount=dayDelivs.filter(d=>d.status==="In Transit").length;
                        const doneCount=dayDelivs.filter(d=>d.status==="Delivered").length;
                        return <div key={di}
                          style={{
                            background:isToday?(dm?"#1c2a3a":"#eff6ff"):isExpanded?(dm?"#1e1040":"#f5f3ff"):t.card,
                            border:`1.5px solid ${isToday?"#3b82f6":isExpanded?"#7c3aed":dayDelivs.length>0?(dm?"#30363d":"#e2e8f0"):t.border}`,
                            borderRadius:10,
                            minHeight:62,
                            cursor:dayDelivs.length>0?"pointer":"default",
                            transition:"border-color 0.12s,background 0.12s,transform 0.1s",
                            WebkitTapHighlightColor:"transparent",
                            touchAction:"manipulation",
                            position:"relative",
                            overflow:"hidden",
                          }}
                          className={dayDelivs.length>0?"active:scale-[0.96]":""}
                          onClick={()=>dayDelivs.length>0&&setCalExpandedDay(isExpanded?null:dateStr)}>
                          {/* Today accent bar */}
                          {isToday&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"#3b82f6",borderRadius:"8px 8px 0 0"}}/>}
                          <div style={{padding:"6px 5px 4px"}}>
                            <p style={{
                              color:isToday?"#3b82f6":isPast&&dayDelivs.length===0?t.sub:t.text,
                              fontSize:isToday?13:12,
                              fontWeight:isToday?900:600,
                              lineHeight:1,
                              marginBottom:3,
                              opacity:isPast&&dayDelivs.length===0?0.4:1,
                            }}>{day}</p>
                            {/* Status dots row */}
                            {dayDelivs.length>0&&<div style={{display:"flex",flexDirection:"column",gap:2}}>
                              {pendCount>0&&<div style={{background:"#f59e0b",borderRadius:4,padding:"1.5px 5px",display:"flex",alignItems:"center",gap:3}}>
                                <span style={{color:"#fff",fontSize:9,fontWeight:700,lineHeight:1}}>{pendCount}</span>
                                <span style={{color:"rgba(255,255,255,0.8)",fontSize:8,lineHeight:1}}>pending</span>
                              </div>}
                              {transitCount>0&&<div style={{background:"#0ea5e9",borderRadius:4,padding:"1.5px 5px",display:"flex",alignItems:"center",gap:3}}>
                                <span style={{color:"#fff",fontSize:9,fontWeight:700,lineHeight:1}}>{transitCount}</span>
                                <span style={{color:"rgba(255,255,255,0.8)",fontSize:8,lineHeight:1}}>transit</span>
                              </div>}
                              {doneCount>0&&<div style={{background:"#10b981",borderRadius:4,padding:"1.5px 5px",display:"flex",alignItems:"center",gap:3}}>
                                <span style={{color:"#fff",fontSize:9,fontWeight:700,lineHeight:1}}>{doneCount}</span>
                                <span style={{color:"rgba(255,255,255,0.8)",fontSize:8,lineHeight:1}}>done</span>
                              </div>}
                              {dayDelivs.length>3&&<div style={{color:t.sub,fontSize:8,fontWeight:700,textAlign:"center",marginTop:1}}>+{dayDelivs.length-3} more</div>}
                            </div>}
                          </div>
                        </div>;
                      })}
                    </div>
                  ))}
                </div>
                {/* EXPANDED DAY PANEL */}
                {calExpandedDay&&(()=>{
                  const expandedDelivs=deliveries.filter(d=>d.date===calExpandedDay&&(!srch||(d.customer||"").toLowerCase().includes(srch.toLowerCase())||(d.status||"").toLowerCase().includes(srch.toLowerCase())));
                  if(expandedDelivs.length===0)return null;
                  const dayTotAmt=expandedDelivs.reduce((s,d)=>s+lineTotal(d.orderLines),0);
                  const dayTotPaid=expandedDelivs.reduce((s,d)=>s+(d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0),0);
                  const dayTotReplAmt=expandedDelivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
                  const dayLabel=new Date(calExpandedDay+"T00:00:00").toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"});
                  return <div style={{background:dm?"#1a0a2e":"#f5f3ff",border:"1.5px solid #7c3aed40",borderRadius:14,padding:"22px 24px",marginBottom:10}}>
                    <div className="flex items-center justify-between mb-3" style={{gap:20}}>
                      <div>
                        <p style={{color:"#7c3aed",fontWeight:900,fontSize:14,lineHeight:1.2}}>{dayLabel}</p>
                        <p style={{color:t.sub,fontSize:11,marginTop:20}}>{expandedDelivs.length} {expandedDelivs.length===1?"delivery":"deliveries"}</p>
                      </div>
                      <button onClick={()=>setCalExpandedDay(null)} style={{color:t.sub,background:t.inp,border:`1px solid ${t.border}`,borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:32,WebkitTapHighlightColor:"transparent",flexShrink:0}}>✕ Close</button>
                    </div>
                    {canSeePrices&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(140px,100%),1fr))",gap:28,marginBottom:12}}>
                      <div style={{background:dm?"#ffffff0a":t.card,border:`1px solid ${t.border}`,borderRadius:10,padding:"26px 28px"}}>
                        <p style={{color:"#10b981",fontWeight:800,fontSize:14}}>{inr(dayTotAmt)}</p>
                        <p style={{color:t.sub,fontSize:9,marginTop:2,textTransform:"uppercase",letterSpacing:"0.05em"}}>Total Orders</p>
                      </div>
                      {dayTotReplAmt>0&&<div style={{background:dm?"#ffffff0a":t.card,border:`1px solid ${t.border}`,borderRadius:10,padding:"26px 28px"}}>
                        <p style={{color:"#f97316",fontWeight:800,fontSize:14}}>−{inr(dayTotReplAmt)}</p>
                        <p style={{color:t.sub,fontSize:9,marginTop:2,textTransform:"uppercase",letterSpacing:"0.05em"}}>Replacements</p>
                      </div>}
                      <div style={{background:dm?"#ffffff0a":t.card,border:`1px solid ${t.border}`,borderRadius:10,padding:"26px 28px"}}>
                        <p style={{color:"#0ea5e9",fontWeight:800,fontSize:14}}>{inr(dayTotPaid)}</p>
                        <p style={{color:t.sub,fontSize:9,marginTop:2,textTransform:"uppercase",letterSpacing:"0.05em"}}>Collected</p>
                      </div>
                      <div style={{background:dm?"#ffffff0a":t.card,border:`1px solid ${t.border}`,borderRadius:10,padding:"26px 28px"}}>
                        <p style={{color:(dayTotAmt-dayTotReplAmt-dayTotPaid)>0?"#f59e0b":"#10b981",fontWeight:800,fontSize:14}}>{inr(Math.max(0,dayTotAmt-dayTotReplAmt-dayTotPaid))}</p>
                        <p style={{color:t.sub,fontSize:9,marginTop:2,textTransform:"uppercase",letterSpacing:"0.05em"}}>Outstanding</p>
                      </div>
                    </div>}
                    <div className="flex flex-col gap-5">
                      {expandedDelivs.map(d=>{
                        const rows=lineRows(d.orderLines,products);
                        const tot=lineTotal(d.orderLines);
                        const replAmt=+d.replacement?.amount||0;
                        const netAmt=tot-replAmt;
                        const paid=d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0;
                        const remaining=Math.max(0,netAmt-paid);
                        const sc=statusColor(d.status);
                        return <div key={d.id} style={{background:dm?"#ffffff08":t.card,border:`1px solid ${sc}40`,borderRadius:12,padding:"18px 20px",borderLeft:`3px solid ${sc}`}}>
                          <div className="flex items-start justify-between mb-2" style={{gap:20}}>
                            <div style={{minWidth:0}}>
                              <p style={{color:t.text,fontWeight:800,fontSize:14,lineHeight:1.2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{d.customer}</p>
                              {d.address&&<p style={{color:t.sub,fontSize:10,marginTop:1}}>📍 {d.address}</p>}
                              {d.notes&&<p style={{color:t.sub,fontSize:10,marginTop:1,fontStyle:"italic"}}>"{d.notes}"</p>}
                            </div>
                            <span style={{background:sc+"20",color:sc,borderRadius:8,padding:"13px 22px",fontSize:10,fontWeight:800,flexShrink:0,whiteSpace:"nowrap",border:`1px solid ${sc}40`}}>{d.status}</span>
                          </div>
                          {rows.length>0&&<div style={{background:t.inp,borderRadius:8,padding:"22px 28px",marginBottom:20}}>
                            {rows.map(r=>(
                              <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"2px 0",fontSize:12}}>
                                <span style={{color:t.sub,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginRight:8}}>{r.qty} × {r.name}{canSeePrices?` @ ${inr(r.priceAmount)}`:""}</span>
                                {canSeePrices&&<span style={{color:t.text,fontWeight:700,flexShrink:0}}>{inr(r.qty*r.priceAmount)}</span>}
                              </div>
                            ))}
                          </div>}
                          {d.replacement?.done&&<div style={{background:"#f9731615",border:"1px solid #f9731630",borderRadius:8,padding:"22px 28px",marginBottom:20}}>
                            <p style={{color:"#f97316",fontSize:11,fontWeight:700}}>🔄 {d.replacement.item||"Replacement"}{d.replacement.qty?` × ${d.replacement.qty}`:""}${replAmt>0?` · −${inr(replAmt)}`:""}</p>
                            {d.replacement.reason&&<p style={{color:t.sub,fontSize:10,marginTop:20}}>{d.replacement.reason}</p>}
                          </div>}
                          {canSeePrices&&<div style={{display:"flex",gap:20,flexWrap:"wrap",fontSize:11,marginBottom:20}}>
                            <span style={{background:t.inp,borderRadius:6,padding:"5px 10px",color:t.text}}>Order: <b>{inr(tot)}</b></span>
                            {replAmt>0&&<span style={{background:"#f9731615",borderRadius:6,padding:"5px 10px",color:"#f97316"}}>Net: <b>{inr(netAmt)}</b></span>}
                            <span style={{background:"#10b98115",borderRadius:6,padding:"5px 10px",color:"#10b981"}}>Paid: <b>{inr(paid)}</b></span>
                            <span style={{background:remaining>0?"#f59e0b15":"#10b98115",borderRadius:6,padding:"5px 10px",color:remaining>0?"#f59e0b":"#10b981"}}>Due: <b>{inr(remaining)}</b></span>
                          </div>}
                          <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
                            <button onClick={e=>{e.stopPropagation();const _dateMode=d.date===today()?"today":d.date>today()?"future":"past";setDf({...d,orderLines:{...safeO(d.orderLines)},replacement:d.replacement||{done:false,item:"",reason:"",qty:""},_dateMode});setDsh(d);}} style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:8,padding:"22px 28px",fontSize:12,fontWeight:600,cursor:"pointer",minHeight:36,WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>✏️ Edit</button>
                            <button onClick={e=>{e.stopPropagation();exportPDF(d,products,"delivery",settings);}} style={{background:"#7c3aed",color:"#fff",borderRadius:8,padding:"22px 28px",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:36,WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>📄 PDF</button>
                            {can("deliv_dispatch")&&d.status==="Pending"&&<button onClick={e=>{e.stopPropagation();dispatchDelivery(d,_actor,setDeliv,notify);addLog("Dispatched",d.customer);}} style={{background:"#f59e0b",color:"#000",borderRadius:8,padding:"22px 28px",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:36,WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>🚚 Dispatch</button>}
                            {can("deliv_markDone")&&(settings?.featureTickRedesign!==false?(
  <button onClick={e=>{e.stopPropagation();if(d.status==="Delivered"){setDeliv(p=>safeArr(p).map(x=>x.id===d.id?{...x,status:"Pending",deliveryDate:""}:x));addLog("Status changed",d.customer+" → Pending");notify("Marked Pending");}else{advanceDeliveryStatus(d,_actor,setDeliv,notify);addLog("Status changed",d.customer+" → Delivered");}}}
    style={{minHeight:40,padding:"0 14px",borderRadius:10,fontSize:12,fontWeight:800,cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"inline-flex",alignItems:"center",gap:7,transition:"all 0.15s",flexShrink:0,
      background:d.status==="Delivered"?"#10b98118":"#10b981",
      color:d.status==="Delivered"?"#10b981":"#fff",
      border:`2px solid ${d.status==="Delivered"?"#10b98144":"#10b981"}`}}>
    <span style={{width:18,height:18,borderRadius:5,border:`2px solid ${d.status==="Delivered"?"#10b981":"#fff"}`,background:d.status==="Delivered"?"#10b981":"transparent",display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
      {d.status==="Delivered"&&<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    </span>
    {d.status==="Delivered"?"Done":"Mark Done"}
  </button>
):(
  d.status!=="Delivered"&&<button onClick={e=>{e.stopPropagation();advanceDeliveryStatus(d,_actor,setDeliv,notify);addLog("Status changed",d.customer+" → Delivered");}} style={{background:"#10b981",color:"#fff",borderRadius:8,padding:"22px 28px",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:36,WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>✓ Done</button>
))}
                          </div>
                        </div>;
                      })}
                    </div>
                    {/* Bulk mark today done */}
                    {isAdmin&&can("deliv_markDone")&&calExpandedDay===todayStr&&(()=>{
                      const pendingToday2=expandedDelivs.filter(d=>d.status==="Pending");
                      if(pendingToday2.length===0) return null;
                      return <button onClick={()=>{
                        safeArr(deliveries).filter(d=>d.date===todayStr&&d.status==="Pending").forEach(d=>advanceDeliveryStatus(d,_actor,setDeliv,notify));
                        addLog("Bulk delivered",`All pending on ${todayStr} (${pendingToday2.length})`);
                      }} style={{background:"#10b98120",color:"#10b981",border:"1px solid #10b98140",borderRadius:10,padding:"16px 22px",fontSize:12,fontWeight:700,cursor:"pointer",width:"100%",marginTop:10,WebkitTapHighlightColor:"transparent"}}>
                        ✓ Mark all {pendingToday2.length} pending as Delivered
                      </button>;
                    })()}
                  </div>;
                })()}
              </div>
            </Card>;
          })()}

          {/* ── DELIVERIES DATA TABLE ── */}
          {!delivCalendar&&(()=>{
            const sortedDelivs=[...fDeliv].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
            const totalDelivRows=sortedDelivs.length;
            const DELIV_PAGE_SIZE=30;
            const pagedDelivs=sortedDelivs.slice((delivPage-1)*DELIV_PAGE_SIZE,delivPage*DELIV_PAGE_SIZE);
            const statusDot=(status)=>{
              const m={"Delivered":"#10b981","In Transit":"#3b82f6","Pending":"#f59e0b","Cancelled":"#ef4444"};
              return <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:m[status]||"#94a3b8",flexShrink:0}}/>;
            };
            const statusPill=(status,dm)=>{
              const cfg={"Delivered":{bg:"#10b98118",color:"#059669",border:"#10b98130"},"In Transit":{bg:"#3b82f618",color:"#2563eb",border:"#3b82f630"},"Pending":{bg:"#f59e0b18",color:"#d97706",border:"#f59e0b30"},"Cancelled":{bg:"#ef444418",color:"#dc2626",border:"#ef444430"}};
              const c=cfg[status]||{bg:t.inp,color:t.sub,border:t.border};
              return <span style={{display:"inline-flex",alignItems:"center",gap:26,background:c.bg,color:c.color,border:`1px solid ${c.border}`,borderRadius:99,padding:"7px 15px",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:c.color,display:"inline-block",flexShrink:0}}/>
                {status}
              </span>;
            };
            if(totalDelivRows===0) return <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"48px 24px",textAlign:"center"}}>
              <p style={{fontSize:32,marginBottom:20}}>📭</p>
              <p style={{color:t.sub,fontSize:14,fontWeight:500}}>No deliveries found.{delivStatusFilter!=="all"?` (filter: ${delivStatusFilter})`:""}</p>
            </div>;

            // ── COMPACT CARD VIEW (grouped by customer, like image 2) ──
            if(delivView==="compact"){
              const groups=[];
              const custMap={};
              pagedDelivs.forEach(d=>{
                const key=d.customerId||d.customer;
                if(!custMap[key]){custMap[key]={customerId:d.customerId,name:d.customer,delivs:[]};groups.push(custMap[key]);}
                custMap[key].delivs.push(d);
              });
              return <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {groups.map(group=>{
                  const groupCust=customers.find(c=>c.id===group.customerId);
                  const totalAmt=group.delivs.reduce((s,d)=>s+lineTotal(d.orderLines),0);
                  const totalPaid=groupCust?(groupCust.paid||0):0;
                  const totalDue=groupCust?(groupCust.pending||0):0;
                  const totalRepl=group.delivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
                  const allDone=group.delivs.every(d=>d.status==="Delivered");
                  return <div key={group.customerId||group.name} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                    {/* Customer header */}
                    <div style={{padding:"24px 26px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:dm?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.01)"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:38,height:38,borderRadius:11,background:"#f59e0b20",color:"#f59e0b",fontWeight:900,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,position:"relative"}}>
                          {group.name.charAt(0).toUpperCase()}
                          <span style={{position:"absolute",bottom:-2,right:-2,width:9,height:9,borderRadius:"50%",background:allDone?"#10b981":"#f59e0b",border:`2px solid ${t.card}`}}/>
                        </div>
                        <div>
                          <p style={{color:t.text,fontWeight:800,fontSize:14}}>{group.name}</p>
                          <p style={{color:t.sub,fontSize:11}}>{group.delivs.length} order{group.delivs.length!==1?"s":""} · {group.delivs.filter(d=>d.status==="Delivered").length} delivered</p>
                        </div>
                      </div>
                      {canSeePrices&&<div style={{textAlign:"right"}}>
                        <p style={{color:totalDue>0?"#ef4444":"#10b981",fontWeight:900,fontSize:16}}>{inr(totalAmt)}</p>
                        <p style={{color:totalDue>0?"#ef4444":"#10b981",fontSize:11,fontWeight:600}}>{totalDue>0?`${inr(totalDue)} due`:"✓ All clear"}</p>
                      </div>}
                    </div>
                    {/* Stats row */}
                    {canSeePrices&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",borderBottom:`1px solid ${t.border}`}}>
                      {[["TOTAL BILLED",inr(totalAmt),"#f59e0b"],["REPLACEMENTS",totalRepl>0?inr(totalRepl):"None","#f97316"],["TOTAL PAID",inr(totalPaid),"#10b981"],["ALL CLEAR",totalDue===0?"✓ ALL CLEAR":inr(totalDue),totalDue===0?"#10b981":"#ef4444"]].map(([label,val,color])=>(
                        <div key={label} style={{padding:"18px 22px",borderRight:`1px solid ${t.border}`,textAlign:"center"}}>
                          <p style={{color,fontWeight:800,fontSize:13}}>{val}</p>
                          <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginTop:20}}>{label}</p>
                        </div>
                      ))}
                    </div>}
                    {/* Delivery rows */}
                    <div style={{display:"flex",flexDirection:"column",gap:0}}>
                      {group.delivs.map((d,di)=>{
                        const tot=lineTotal(d.orderLines);
                        const dRepl=+d.replacement?.amount||0;
                        const dNet=Math.max(0,tot-dRepl);
                        const dBal=Math.max(0,dNet-(d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0));
                        const settled=dBal===0&&tot>0;
                        const invNo=(invRegistry?.issued||{})[d.id]||d.invNo||`TAS-${(d.date||"").replace(/-/g,"").slice(2)}-${(d.id||"").slice(-4).toUpperCase()}`;
                        const rcptNo=`RCP-${invNo.replace(/^[A-Z]+-/,"")}`;
                        const sc=d.status==="Delivered"?"#10b981":d.status==="Cancelled"?"#ef4444":"#f59e0b";
                        const rows=Object.entries(safeO(d.orderLines)).filter(([,l])=>l.qty>0);
                        const batchLabel=d.batches?.map(b=>b.name||b).join(", ")||d.batch||"";
                        return <div key={d.id||di} style={{borderTop:di>0?`1px solid ${t.border}`:"none",padding:"24px 26px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:22,marginBottom:8,flexWrap:"wrap"}}>
                            <span style={{color:t.text,fontWeight:700,fontSize:13}}>{d.date}</span>
                            {d.deliveryDate&&d.deliveryDate!==d.date&&<><span style={{color:t.sub,fontSize:11}}>→ deliver by {d.deliveryDate}</span></>}
                            <span style={{display:"inline-flex",alignItems:"center",gap:24,background:d.status==="Delivered"?"#10b98118":d.status==="Cancelled"?"#ef444418":"#f59e0b18",color:sc,border:`1px solid ${sc}30`,borderRadius:99,padding:"2px 10px",fontSize:11,fontWeight:700}}>{d.status}</span>
                            {settled&&<span style={{color:"#10b981",fontSize:11,fontWeight:700}}>✓ Settled</span>}
                          </div>
                          <div style={{display:"flex",gap:20,flexWrap:"wrap",marginBottom:20}}>
                            {d.createdBy&&<span style={{color:t.sub,fontSize:10}}>👤 {d.createdBy}</span>}
                            <span style={{color:"#2563eb",fontSize:10,fontFamily:"monospace",cursor:"pointer"}} onClick={()=>setDetailModal({type:"delivery",data:d})}>{invNo}</span>
                            <span style={{color:"#7c3aed",fontSize:10,fontFamily:"monospace"}}>{rcptNo}</span>
                            {batchLabel&&<span style={{color:"#f59e0b",fontSize:10}}>⚡ {batchLabel}</span>}
                          </div>
                          <div style={{background:t.inp,borderRadius:10,padding:"18px 20px",marginBottom:20}}>
                            <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",marginBottom:16}}>Items Ordered</p>
                            {rows.map(([pid,l])=>(
                              <div key={pid} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                                <span style={{color:t.text,fontSize:12}}>{l.qty} × <b>{l.name||pid}</b> @ ₹{l.priceAmount||0}</span>
                                {canSeePrices&&<span style={{color:t.text,fontWeight:700,fontSize:12}}>{inr((l.qty||0)*(l.priceAmount||0))}</span>}
                              </div>
                            ))}
                            {canSeePrices&&<div style={{borderTop:`1px solid ${t.border}`,marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between"}}>
                              <span style={{color:t.sub,fontSize:12}}>Order Total</span>
                              <span style={{color:"#f59e0b",fontWeight:800,fontSize:13}}>{inr(tot)}</span>
                            </div>}
                          </div>
                          {canSeePrices&&<div style={{background:t.inp,borderRadius:10,padding:"18px 20px",marginBottom:20}}>
                            <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",marginBottom:16}}>Payment Summary</p>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                              <span style={{color:t.sub,fontSize:12}}>Order total</span>
                              <span style={{color:t.text,fontSize:12,fontWeight:600}}>{inr(tot)}</span>
                            </div>
                            {dRepl>0&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                              <span style={{color:"#f97316",fontSize:12}}>Replacement deducted</span>
                              <span style={{color:"#f97316",fontSize:12,fontWeight:700}}>−{inr(dRepl)}</span>
                            </div>}
                            {d.partialPayment?.enabled&&(+d.partialPayment.amount||0)>0&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                              <span style={{color:"#10b981",fontSize:12}}>💰 Collected</span>
                              <span style={{color:"#10b981",fontSize:12,fontWeight:700}}>−{inr(+d.partialPayment.amount)}</span>
                            </div>}
                            <div style={{borderTop:`1px solid ${t.border}`,marginTop:4,paddingTop:6,display:"flex",justifyContent:"space-between"}}>
                              <span style={{color:settled?"#10b981":"#ef4444",fontSize:12,fontWeight:700}}>{settled?"✓ Fully settled":"Balance due"}</span>
                              <span style={{color:settled?"#10b981":"#ef4444",fontSize:12,fontWeight:700}}>{settled?"—":inr(dBal)}</span>
                            </div>
                          </div>}
                          {/* Action buttons */}
                          <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
                            {(d.address||groupCust?.address)&&<button onClick={()=>window.open(mapU(d.address||groupCust?.address,d.lat||groupCust?.lat,d.lng||groupCust?.lng),"_blank")} style={{background:"#3b82f615",color:"#3b82f6",border:"1px solid #3b82f630",borderRadius:8,padding:"22px 28px",fontSize:12,fontWeight:700,cursor:"pointer"}}>📍 Nav</button>}
                            {can("deliv_edit")&&<button onClick={()=>{setDf({...d,orderLines:{...safeO(d.orderLines)},replacement:d.replacement||{done:false,item:"",reason:"",qty:""}});setDsh(d);}} style={{background:t.inp,border:`1px solid ${t.border}`,color:t.text,borderRadius:8,padding:"22px 28px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Edit</button>}
                            <button onClick={()=>exportPDF(d,products,"delivery",settings)} style={{background:"#7c3aed15",color:"#7c3aed",border:"1px solid #7c3aed30",borderRadius:8,padding:"22px 28px",fontSize:12,fontWeight:700,cursor:"pointer"}}>PDF</button>
                            {settings?.receiptEnabled!==false&&<button onClick={()=>exportPDF(d,products,"receipt",settings)} style={{background:"#2563eb15",color:"#2563eb",border:"1px solid #2563eb30",borderRadius:8,padding:"22px 28px",fontSize:12,fontWeight:700,cursor:"pointer"}}>📋 Receipt</button>}
                            {settings?.agentInvoiceEnabled!==false&&<button onClick={()=>exportPDF(d,products,"invoice",settings)} style={{background:"#059669 15",color:"#059669",border:"1px solid #05996930",borderRadius:8,padding:"22px 28px",fontSize:12,fontWeight:700,cursor:"pointer"}}>📄 Invoice</button>}
                            <button onClick={()=>shareWhatsApp(d,products,"delivery",settings)} style={{background:"#25D36615",color:"#25D366",border:"1px solid #25D36630",borderRadius:8,padding:"22px 28px",fontSize:12,fontWeight:700,cursor:"pointer"}}>WA</button>
                            {(can("cust_markPaid")||can("deliv_markDone"))&&settings?.agentCollectEnabled!==false&&d.status!=="Cancelled"&&<button onClick={()=>{setCollectSh(d);const _r=+d.replacement?.amount||0;const _n=Math.max(0,lineTotal(d.orderLines)-_r);setCollectAmt(String(_n>0?_n:lineTotal(d.orderLines)));setCollectNote("");}} style={{background:"#f59e0b",color:"#000",border:"none",borderRadius:8,padding:"22px 28px",fontSize:12,fontWeight:700,cursor:"pointer"}}>💰 Collect</button>}
                            {can("deliv_delete")&&<button onClick={()=>delD(d)} style={{background:"#ef444415",color:"#ef4444",border:"1px solid #ef444430",borderRadius:8,padding:"22px 28px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Delete</button>}
                          </div>
                        </div>;
                      })}
                    </div>
                  </div>;
                })}
                {/* Pagination */}
                {totalDelivRows>DELIV_PAGE_SIZE&&<div style={{display:"flex",justifyContent:"center",gap:28,padding:"8px 0"}}>
                  <button onClick={()=>{if(delivPage>1)setDelivPage(delivPage-1);}} disabled={delivPage===1} style={{width:32,height:32,borderRadius:8,background:t.inp,border:`1px solid ${t.border}`,color:t.text,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",opacity:delivPage===1?0.4:1}}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  {Array.from({length:Math.ceil(totalDelivRows/DELIV_PAGE_SIZE)},(_,i)=>i+1).map(p=>(
                    <button key={p} onClick={()=>setDelivPage(p)} style={{width:32,height:32,borderRadius:8,background:delivPage===p?"#2563eb":t.inp,border:`1px solid ${delivPage===p?"#2563eb":t.border}`,color:delivPage===p?"#fff":t.text,fontWeight:delivPage===p?800:500,fontSize:12,cursor:"pointer"}}>{p}</button>
                  ))}
                  <button onClick={()=>{const tp=Math.ceil(totalDelivRows/DELIV_PAGE_SIZE);if(delivPage<tp)setDelivPage(delivPage+1);}} disabled={delivPage===Math.ceil(totalDelivRows/DELIV_PAGE_SIZE)} style={{width:32,height:32,borderRadius:8,background:t.inp,border:`1px solid ${t.border}`,color:t.text,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",opacity:delivPage===Math.ceil(totalDelivRows/DELIV_PAGE_SIZE)?0.4:1}}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>}
              </div>;
            }

            // ── MOBILE CARD VIEW (< 768px) — replaces horizontal-scroll table ──
            const isMobileView = _mobileW < 768;
            if (isMobileView) {
              return <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {pagedDelivs.map((d, di) => {
                  const tot = lineTotal(d.orderLines);
                  const rows = lineRows(d.orderLines, products);
                  const itemCount = rows.reduce((s,r) => s + (r.qty||0), 0);
                  const itemNames = rows.slice(0,2).map(r=>`${r.qty}× ${r.name||r.id}`).join(", ") + (rows.length > 2 ? ` +${rows.length-2}` : "");
                  const invNo = (invRegistry?.issued||{})[d.id] || d.invNo || `#${(d.id||"").slice(-6).toUpperCase()}`;
                  const dRepl = +d.replacement?.amount || 0;
                  const dNet = Math.max(0, tot - dRepl);
                  const dBal = Math.max(0, dNet - (d.partialPayment?.enabled ? (+d.partialPayment?.amount||0) : 0));
                  const settled = dBal === 0 && tot > 0;
                  const sc = {"Delivered":"#10b981","In Transit":"#3b82f6","Pending":"#f59e0b","Cancelled":"#ef4444"}[d.status] || "#94a3b8";
                  const [cardOpen, setCardOpen] = [
                    expandedDeliveryCust === d.id,
                    (v) => setExpandedDeliveryCust(v ? d.id : null),
                  ];
                  return <div key={d.id||di} style={{background:t.card,border:`1.5px solid ${cardOpen ? sc+"60" : t.border}`,borderRadius:16,overflow:"hidden",transition:"border-color 0.15s"}}>
                    {/* Card header — always visible */}
                    <div onClick={() => setCardOpen(!cardOpen)}
                      style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
                      {/* Status dot */}
                      <div style={{width:10,height:10,borderRadius:"50%",background:sc,flexShrink:0,boxShadow:`0 0 6px ${sc}60`}}/>
                      {/* Main info */}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                          <p style={{color:t.text,fontWeight:800,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.customer}</p>
                          <span style={{color:sc,background:`${sc}18`,border:`1px solid ${sc}30`,borderRadius:99,padding:"1px 8px",fontSize:10,fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>{d.status}</span>
                        </div>
                        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                          <span style={{color:t.sub,fontSize:11}}>{d.date}</span>
                          <span style={{color:t.sub,fontSize:11}}>·</span>
                          <span style={{color:"#8b5cf6",fontSize:11,fontFamily:"monospace"}}>{invNo}</span>
                          {itemCount > 0 && <><span style={{color:t.sub,fontSize:11}}>·</span><span style={{color:t.sub,fontSize:11}}>{itemCount} item{itemCount!==1?"s":""}</span></>}
                        </div>
                      </div>
                      {/* Amount + chevron */}
                      <div style={{textAlign:"right",flexShrink:0}}>
                        {canSeePrices && <p style={{color:settled?"#10b981":tot>0?"#f59e0b":t.sub,fontWeight:800,fontSize:15}}>{inr(tot)}</p>}
                        {canSeePrices && dBal > 0 && <p style={{color:"#ef4444",fontSize:10,fontWeight:600}}>Due {inr(dBal)}</p>}
                        <span style={{color:t.sub,fontSize:12,marginTop:2,display:"block"}}>{cardOpen ? "▲" : "▼"}</span>
                      </div>
                    </div>

                    {/* Expanded detail — shown on tap */}
                    {cardOpen && <div style={{borderTop:`1px solid ${t.border}`}}>
                      {/* Items */}
                      <div style={{padding:"12px 16px",background:dm?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.02)"}}>
                        <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>Items</p>
                        {rows.map((r,ri) => (
                          <div key={ri} style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                            <span style={{color:t.text,fontSize:12}}>{r.qty} × {r.name||r.id}</span>
                            {canSeePrices && <span style={{color:t.text,fontWeight:600,fontSize:12}}>{inr((r.qty||0)*(r.priceAmount||0))}</span>}
                          </div>
                        ))}
                        {canSeePrices && <div style={{borderTop:`1px solid ${t.border}`,marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between"}}>
                          <span style={{color:t.sub,fontSize:12}}>Total</span>
                          <span style={{color:"#f59e0b",fontWeight:800,fontSize:13}}>{inr(tot)}</span>
                        </div>}
                      </div>
                      {/* Payment summary */}
                      {canSeePrices && (dRepl > 0 || dBal > 0) && <div style={{padding:"10px 16px",borderTop:`1px solid ${t.border}`}}>
                        {dRepl > 0 && <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <span style={{color:"#f97316",fontSize:12}}>Replacement deducted</span>
                          <span style={{color:"#f97316",fontSize:12,fontWeight:700}}>−{inr(dRepl)}</span>
                        </div>}
                        <div style={{display:"flex",justifyContent:"space-between"}}>
                          <span style={{color:settled?"#10b981":"#ef4444",fontSize:12,fontWeight:700}}>{settled?"✓ Settled":"Balance due"}</span>
                          <span style={{color:settled?"#10b981":"#ef4444",fontSize:12,fontWeight:700}}>{settled?"—":inr(dBal)}</span>
                        </div>
                      </div>}
                      {/* Action buttons — full width tap targets */}
                      <div style={{padding:"12px 16px",borderTop:`1px solid ${t.border}`,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                        {can("deliv_markDone") && d.status !== "Cancelled" && (
                          <button onClick={e=>{e.stopPropagation();if(d.status==="Delivered"){setDeliv(p=>safeArr(p).map(x=>x.id===d.id?{...x,status:"Pending",deliveryDate:""}:x));addLog("Status changed",d.customer+" → Pending");notify("Marked Pending");}else{advanceDeliveryStatus(d,_actor,setDeliv,notify);addLog("Status changed",d.customer+" → Delivered");}}}
                            style={{gridColumn:"1/-1",padding:"13px",borderRadius:12,border:"none",background:d.status==="Delivered"?"#f59e0b18":"#10b981",color:d.status==="Delivered"?"#d97706":"#fff",fontWeight:800,fontSize:14,cursor:"pointer",WebkitTapHighlightColor:"transparent",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                            {d.status==="Delivered"?"↩ Mark Pending":"✓ Mark Delivered"}
                          </button>
                        )}
                        {can("deliv_dispatch") && d.status==="Pending" && (
                          <button onClick={e=>{e.stopPropagation();dispatchDelivery(d,_actor,setDeliv,notify);addLog("Dispatched",d.customer);}}
                            style={{padding:"13px",borderRadius:12,border:"none",background:"#3b82f6",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
                            🚚 Dispatch
                          </button>
                        )}
                        {can("deliv_edit") && <button onClick={e=>{e.stopPropagation();setDf({...d,orderLines:{...safeO(d.orderLines)},replacement:d.replacement||{done:false,item:"",reason:"",qty:""}});setDsh(d);}}
                          style={{padding:"13px",borderRadius:12,border:`1px solid ${t.border}`,background:t.inp,color:t.text,fontWeight:700,fontSize:13,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
                          ✏️ Edit
                        </button>}
                        <button onClick={e=>{e.stopPropagation();setDetailModal({type:"delivery",data:d});}}
                          style={{padding:"13px",borderRadius:12,border:"1px solid #3b82f630",background:"#3b82f615",color:"#3b82f6",fontWeight:700,fontSize:13,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
                          👁 View
                        </button>
                        <button onClick={e=>{e.stopPropagation();exportPDF(d,products,"delivery",settings);}}
                          style={{padding:"13px",borderRadius:12,border:"1px solid #7c3aed30",background:"#7c3aed15",color:"#7c3aed",fontWeight:700,fontSize:13,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
                          📄 PDF
                        </button>
                        <button onClick={e=>{e.stopPropagation();shareWhatsApp(d,products,"delivery",settings);}}
                          style={{padding:"13px",borderRadius:12,border:"1px solid #25D36630",background:"#25D36615",color:"#25D366",fontWeight:700,fontSize:13,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
                          WhatsApp
                        </button>
                        {(can("cust_markPaid")||can("deliv_markDone")) && settings?.agentCollectEnabled!==false && d.status!=="Cancelled" && (
                          <button onClick={e=>{e.stopPropagation();setCollectSh(d);const _r=+d.replacement?.amount||0;const _n=Math.max(0,lineTotal(d.orderLines)-_r);setCollectAmt(String(_n>0?_n:lineTotal(d.orderLines)));setCollectNote("");}}
                            style={{padding:"13px",borderRadius:12,border:"none",background:"#f59e0b",color:"#000",fontWeight:800,fontSize:13,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
                            💰 Collect
                          </button>
                        )}
                      </div>
                    </div>}
                  </div>;
                })}
                {/* Mobile pagination */}
                {totalDelivRows > DELIV_PAGE_SIZE && <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 4px"}}>
                  <button onClick={()=>{if(delivPage>1)setDelivPage(delivPage-1);}} disabled={delivPage===1}
                    style={{padding:"10px 20px",borderRadius:10,background:t.inp,border:`1px solid ${t.border}`,color:t.text,fontWeight:700,fontSize:13,cursor:"pointer",opacity:delivPage===1?0.4:1}}>← Prev</button>
                  <span style={{color:t.sub,fontSize:12}}>{delivPage} / {Math.ceil(totalDelivRows/DELIV_PAGE_SIZE)}</span>
                  <button onClick={()=>{const tp=Math.ceil(totalDelivRows/DELIV_PAGE_SIZE);if(delivPage<tp)setDelivPage(delivPage+1);}} disabled={delivPage===Math.ceil(totalDelivRows/DELIV_PAGE_SIZE)}
                    style={{padding:"10px 20px",borderRadius:10,background:t.inp,border:`1px solid ${t.border}`,color:t.text,fontWeight:700,fontSize:13,cursor:"pointer",opacity:delivPage===Math.ceil(totalDelivRows/DELIV_PAGE_SIZE)?0.4:1}}>Next →</button>
                </div>}
              </div>;
            }

            return <div className="flex flex-col gap-0">
              {/* Table Card */}
              <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
                    <thead>
                      <tr style={{background:dm?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.025)",borderBottom:`1.5px solid ${t.border}`}}>
                        <th style={{padding:"11px 8px 11px 16px",width:28}}></th>
                        <th style={{padding:"11px 12px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Delivery ID</th>
                        <th style={{padding:"11px 12px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Customer</th>
                        <th style={{padding:"11px 12px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Delivery Date</th>
                        <th style={{padding:"11px 12px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Items</th>
                        <th style={{padding:"11px 12px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Driver</th>
                        <th style={{padding:"11px 12px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Status</th>
                        {canSeePrices&&<th style={{padding:"11px 12px",textAlign:"right",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Amount</th>}
                        <th style={{padding:"11px 16px 11px 12px",textAlign:"right",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedDelivs.map((d,di)=>{
                        const tot=lineTotal(d.orderLines);
                        const rows=lineRows(d.orderLines,products);
                        const itemCount=rows.reduce((s,r)=>s+(r.qty||0),0);
                        const itemNames=rows.slice(0,2).map(r=>`${r.qty}× ${r.name||r.id}`).join(", ")+(rows.length>2?` +${rows.length-2} more`:"");
                        const invNo=(invRegistry?.issued||{})[d.id]||d.invNo||`#${(d.id||"").slice(-6).toUpperCase()}`;
                        const driver=d.driver||d.createdBy||"—";
                        const vehicle=d.vehicle||"";
                        const orderNo=(invRegistry?.issued||{})[d.id]||d.invNo||"";
                        const isEven=di%2===0;
                        return <tr key={d.id||di}
                          style={{borderBottom:`1px solid ${t.border}`,background:isEven?(dm?"rgba(255,255,255,0.01)":"rgba(0,0,0,0.007)"):"transparent",cursor:"pointer",transition:"background 0.12s"}}
                          onMouseEnter={e=>{e.currentTarget.style.background=dm?"rgba(255,255,255,0.04)":"rgba(37,99,235,0.04)";}}
                          onMouseLeave={e=>{e.currentTarget.style.background=isEven?(dm?"rgba(255,255,255,0.01)":"rgba(0,0,0,0.007)"):"transparent";}}>
                          {/* Status dot */}
                          <td style={{padding:"14px 4px 14px 16px",verticalAlign:"middle"}}>
                            {statusDot(d.status)}
                          </td>
                          {/* Delivery ID */}
                          <td style={{padding:"14px 12px",verticalAlign:"middle"}}>
                            <span style={{color:t.sub,fontSize:11,fontFamily:"monospace",background:dm?"rgba(139,92,246,0.1)":"rgba(139,92,246,0.07)",border:"1px solid rgba(139,92,246,0.15)",borderRadius:5,padding:"5px 12px",fontWeight:600,whiteSpace:"nowrap"}}>{invNo}</span>
                          </td>
                          {/* Customer + order number stacked */}
                          <td style={{padding:"14px 12px",verticalAlign:"middle",maxWidth:160}}>
                            <p style={{color:t.text,fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:20}}>{d.customer}</p>
                            {orderNo&&<p style={{color:t.sub,fontSize:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontFamily:"monospace"}}>{orderNo}</p>}
                          </td>
                          {/* Date + time stacked */}
                          <td style={{padding:"14px 12px",verticalAlign:"middle",whiteSpace:"nowrap"}}>
                            <p style={{color:t.text,fontWeight:600,fontSize:13,marginBottom:20}}>{d.date}</p>
                            {d.deliveryDate&&d.deliveryDate!==d.date&&<p style={{color:t.sub,fontSize:10}}>Due {d.deliveryDate}</p>}
                            {!d.deliveryDate&&<p style={{color:t.sub,fontSize:10}}>—</p>}
                          </td>
                          {/* Items count + names stacked */}
                          <td style={{padding:"14px 12px",verticalAlign:"middle",maxWidth:180}}>
                            <p style={{color:t.text,fontWeight:700,fontSize:13,marginBottom:20}}>{itemCount} item{itemCount!==1?"s":""}</p>
                            <p style={{color:t.sub,fontSize:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:170}}>{itemNames||"—"}</p>
                          </td>
                          {/* Driver + vehicle stacked */}
                          <td style={{padding:"14px 12px",verticalAlign:"middle",maxWidth:140}}>
                            <p style={{color:t.text,fontWeight:600,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:20}}>{driver}</p>
                            {vehicle?<p style={{color:t.sub,fontSize:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{vehicle}</p>:<p style={{color:t.sub,fontSize:10}}>—</p>}
                          </td>
                          {/* Status pill */}
                          <td style={{padding:"14px 12px",verticalAlign:"middle"}}>
                            {statusPill(d.status,dm)}
                          </td>
                          {/* Amount */}
                          {canSeePrices&&<td style={{padding:"14px 12px",verticalAlign:"middle",textAlign:"right",whiteSpace:"nowrap"}}>
                            <span style={{color:tot>0?"#059669":t.sub,fontWeight:800,fontSize:13}}>{inr(tot)}</span>
                          </td>}
                          {/* Actions: quick status + eye + 3-dot */}
                          <td style={{padding:"14px 16px 14px 12px",verticalAlign:"middle",textAlign:"right",whiteSpace:"nowrap"}}>
                            <div style={{display:"inline-flex",alignItems:"center",gap:5}}>
                              {/* Quick inline status buttons — most common actions */}
                              {can("deliv_markDone")&&d.status!=="Cancelled"&&(
                                <button onClick={e=>{e.stopPropagation();if(d.status==="Delivered"){setDeliv(p=>safeArr(p).map(x=>x.id===d.id?{...x,status:"Pending",deliveryDate:""}:x));addLog("Status changed",`${d.customer} → Pending`);notify("Marked Pending");}else{advanceDeliveryStatus(d,_actor,setDeliv,notify);addLog("Status changed",`${d.customer} → Delivered`);}}}
                                  title={d.status==="Delivered"?"Mark Pending":"Mark Delivered"}
                                  style={{padding:"20px 24px",borderRadius:7,border:"none",background:d.status==="Delivered"?"#f59e0b18":"#10b98118",color:d.status==="Delivered"?"#d97706":"#059669",cursor:"pointer",fontSize:11,fontWeight:800,WebkitTapHighlightColor:"transparent",minHeight:0}}>
                                  {d.status==="Delivered"?"↩":"✓"}
                                </button>
                              )}
                              {can("deliv_dispatch")&&d.status==="Pending"&&(
                                <button onClick={e=>{e.stopPropagation();dispatchDelivery(d,_actor,setDeliv,notify);addLog("Dispatched",d.customer);}}
                                  title="Dispatch"
                                  style={{padding:"20px 24px",borderRadius:7,border:"none",background:"#3b82f618",color:"#2563eb",cursor:"pointer",fontSize:11,fontWeight:800,WebkitTapHighlightColor:"transparent",minHeight:0}}>
                                  🚚
                                </button>
                              )}
                              {/* Eye / View */}
                              <button onClick={e=>{e.stopPropagation();setDetailModal({type:"delivery",data:d});}}
                                title="View details"
                                style={{width:32,height:32,borderRadius:8,background:dm?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)",border:`1px solid ${t.border}`,color:t.sub,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",transition:"all 0.12s"}}
                                onMouseEnter={e=>{e.currentTarget.style.background="#2563eb";e.currentTarget.style.color="#fff";e.currentTarget.style.borderColor="#2563eb";}}
                                onMouseLeave={e=>{e.currentTarget.style.background=dm?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)";e.currentTarget.style.color=t.sub;e.currentTarget.style.borderColor=t.border;}}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              </button>
                              {/* 3-dot menu — opens a quick-action popover */}
                              <div style={{position:"relative"}}>
                                <button
                                  id={`dot3_${d.id}`}
                                  onClick={e=>{e.stopPropagation();const el=document.getElementById(`dot3menu_${d.id}`);if(el){el.style.display=el.style.display==="block"?"none":"block";}}}
                                  title="More actions"
                                  style={{width:32,height:32,borderRadius:8,background:dm?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)",border:`1px solid ${t.border}`,color:t.sub,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",transition:"all 0.12s"}}
                                  onMouseEnter={e=>{e.currentTarget.style.background=dm?"rgba(255,255,255,0.12)":"rgba(0,0,0,0.09)";}}
                                  onMouseLeave={e=>{e.currentTarget.style.background=dm?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)";}}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                                </button>
                                <div id={`dot3menu_${d.id}`} style={{display:"none",position:"absolute",right:0,top:"calc(100% + 6px)",background:t.card,border:`1px solid ${t.border}`,borderRadius:12,boxShadow:"0 8px 32px rgba(0,0,0,0.18)",zIndex:100,minWidth:180,overflow:"hidden"}}
                                  onClick={e=>e.stopPropagation()}>
                                  {[
                                    can("deliv_edit")&&{label:"✏️  Edit",action:()=>{setDf({...d,orderLines:{...safeO(d.orderLines)},replacement:d.replacement||{done:false,item:"",reason:"",qty:""}});setDsh(d);(()=>{const _el=document.getElementById(`dot3menu_${d.id}`);if(_el)_el.style.display="none";})() ;}},
                                    {label:"📄  PDF Invoice",action:()=>{exportPDF(d,products,"delivery",settings);(()=>{const _el=document.getElementById(`dot3menu_${d.id}`);if(_el)_el.style.display="none";})() ;}},
                                    can("deliv_dispatch")&&d.status==="Pending"&&{label:"🚚  Dispatch",action:()=>{dispatchDelivery(d,_actor,setDeliv,notify);addLog("Dispatched",d.customer);(()=>{const _el=document.getElementById(`dot3menu_${d.id}`);if(_el)_el.style.display="none";})() ;}},
                                    can("deliv_markDone")&&{label:d.status==="Delivered"?"↩️  Mark Pending":"✅  Mark Delivered",action:()=>{if(d.status==="Delivered"){setDeliv(p=>safeArr(p).map(x=>x.id===d.id?{...x,status:"Pending",deliveryDate:""}:x));notify("Marked Pending");}else{advanceDeliveryStatus(d,_actor,setDeliv,notify);}addLog("Status changed",d.customer);(()=>{const _el=document.getElementById(`dot3menu_${d.id}`);if(_el)_el.style.display="none";})() ;}},
                                    (can("cust_markPaid")||can("deliv_markDone"))&&settings?.agentCollectEnabled!==false&&d.status!=="Cancelled"&&{label:"💰  Collect Payment",action:()=>{setCollectSh(d);const _r=+d.replacement?.amount||0;const _n=Math.max(0,lineTotal(d.orderLines)-_r);setCollectAmt(String(_n>0?_n:lineTotal(d.orderLines)));setCollectNote("");(()=>{const _el=document.getElementById(`dot3menu_${d.id}`);if(_el)_el.style.display="none";})() ;}},
                                    {label:"📱  Share WhatsApp",action:()=>{shareWhatsApp(d,products,"delivery",settings);(()=>{const _el=document.getElementById(`dot3menu_${d.id}`);if(_el)_el.style.display="none";})() ;}},
                                    can("deliv_delete")&&{label:"🗑️  Delete",color:"#ef4444",action:()=>{delD(d);(()=>{const _el=document.getElementById(`dot3menu_${d.id}`);if(_el)_el.style.display="none";})() ;}},
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

                {/* ── TABLE PAGINATION FOOTER ── */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"22px 28px",borderTop:`1px solid ${t.border}`,flexWrap:"wrap",gap:22,background:dm?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.015)"}}>
                  {/* Left: showing X to Y of Z */}
                  <p style={{color:t.sub,fontSize:12,fontWeight:500,flexShrink:0}}>
                    Showing <b style={{color:t.text}}>{Math.min((delivPage-1)*DELIV_PAGE_SIZE+1,totalDelivRows)}</b> to <b style={{color:t.text}}>{Math.min(delivPage*DELIV_PAGE_SIZE,totalDelivRows)}</b> of <b style={{color:t.text}}>{totalDelivRows}</b> deliveries
                  </p>
                  {/* Center: page buttons */}
                  {totalDelivRows>DELIV_PAGE_SIZE&&(()=>{
                    const totalPages=Math.ceil(totalDelivRows/DELIV_PAGE_SIZE);
                    const pages=[];
                    for(let p=1;p<=totalPages;p++){
                      if(p===1||p===totalPages||Math.abs(p-delivPage)<=1) pages.push(p);
                      else if(pages[pages.length-1]!=="…") pages.push("…");
                    }
                    return <div style={{display:"flex",gap:24,alignItems:"center"}}>
                      <button onClick={()=>{if(delivPage>1){setDelivPage(delivPage-1);window.scrollTo({top:0,behavior:"smooth"});}}}
                        disabled={delivPage===1}
                        style={{width:32,height:32,borderRadius:8,background:t.inp,border:`1px solid ${t.border}`,color:delivPage===1?t.sub:t.text,cursor:delivPage===1?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",opacity:delivPage===1?0.4:1}}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                      </button>
                      {pages.map((p,pi)=>p==="…"?<span key={`e${pi}`} style={{color:t.sub,fontSize:12,padding:"0 4px"}}>…</span>:
                        <button key={p} onClick={()=>{setDelivPage(p);window.scrollTo({top:0,behavior:"smooth"});}}
                          style={{width:32,height:32,borderRadius:8,background:delivPage===p?"#2563eb":t.inp,border:`1px solid ${delivPage===p?"#2563eb":t.border}`,color:delivPage===p?"#fff":t.text,fontWeight:delivPage===p?800:500,fontSize:12,cursor:"pointer",transition:"all 0.12s"}}>{p}</button>
                      )}
                      <button onClick={()=>{const tp=Math.ceil(totalDelivRows/DELIV_PAGE_SIZE);if(delivPage<tp){setDelivPage(delivPage+1);window.scrollTo({top:0,behavior:"smooth"});}}}
                        disabled={delivPage===Math.ceil(totalDelivRows/DELIV_PAGE_SIZE)}
                        style={{width:32,height:32,borderRadius:8,background:t.inp,border:`1px solid ${t.border}`,color:delivPage===Math.ceil(totalDelivRows/DELIV_PAGE_SIZE)?t.sub:t.text,cursor:delivPage===Math.ceil(totalDelivRows/DELIV_PAGE_SIZE)?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",opacity:delivPage===Math.ceil(totalDelivRows/DELIV_PAGE_SIZE)?0.4:1}}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    </div>;
                  })()}
                  {/* Right: rows per page dropdown */}
                  <div style={{display:"flex",alignItems:"center",gap:28,flexShrink:0}}>
                    <span style={{color:t.sub,fontSize:11}}>Rows</span>
                    <select value={DELIV_PAGE_SIZE} onChange={()=>{}} style={{background:t.inp,border:`1px solid ${t.border}`,color:t.text,borderRadius:8,padding:"16px 22px",fontSize:12,cursor:"pointer",outline:"none"}}>
                      <option value={15}>15</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          })()}
    </>
  );

}
