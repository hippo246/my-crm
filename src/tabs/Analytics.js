/* eslint-disable */
import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, Cell } from "recharts";
import { SectionHeader, TabStatCards, Card, StatCard, Hr } from "../components/ui";
import { T } from "../lib/theme";
import { inr, today, lineTotal, safeO } from "../lib/utils";
import { exportCSV } from "../lib/exports";

export default function AnalyticsTab({
  // theme
  dm,
  // permissions
  isAdmin, canSeePrices,
  // data
  deliveries, expenses, supplies, wastage, customers, products, prodTargets, qcLogs, actLog,
  settings,
  paymentLedger,
  invRegistry,
  // memoized totals from CRM.js
  totalRev, totalExpOp, totalSupC, netProfit,
  // analytics filter/UI state
  anlPeriod,         setAnlPeriod,
  anlCustomFrom,     setAnlCustomFrom,
  anlCustomTo,       setAnlCustomTo,
  anlSpecificDate,   setAnlSpecificDate,
  anlActiveSection,  setAnlActiveSection,
  anlCustSearch,     setAnlCustSearch,
  anlCustSort,       setAnlCustSort,
  anlCustFilter,     setAnlCustFilter,
  anlCustExpanded,   setAnlCustExpanded,
  anlProdSort,       setAnlProdSort,
  anlProdExpanded,   setAnlProdExpanded,
  anlOpsView,        setAnlOpsView,
  anlFinView,        setAnlFinView,
  anlOverviewMetric, setAnlOverviewMetric,
  anlExportOpen,     setAnlExportOpen,
  anlChartType,      setAnlChartType,
  anlTrendMetric,    setAnlTrendMetric,
  anlShowInsights,   setAnlShowInsights,
  // navigation
  setTab,
}) {
  const t = T(dm);

  // ── Analytics date filter ──
  const ANL_PERIODS=[["1d","Daily"],["1w","Weekly"],["1m","Monthly"],["3m","3 Months"],["6m","6 Months"],["12m","12 Months"],["all","All Time"],["custom","Custom Range"],["date","Specific Date"]];
  const nowD=new Date(); nowD.setHours(23,59,59,999);
  let anlFrom=null,anlTo=nowD;
  if(anlPeriod==="1d"){const d=new Date();d.setHours(0,0,0,0);anlFrom=d;}
  else if(anlPeriod==="1w"){const d=new Date();d.setDate(d.getDate()-6);d.setHours(0,0,0,0);anlFrom=d;}
  else if(anlPeriod==="1m"){const d=new Date();d.setMonth(d.getMonth()-1);d.setHours(0,0,0,0);anlFrom=d;}
  else if(anlPeriod==="3m"){const d=new Date();d.setMonth(d.getMonth()-3);d.setHours(0,0,0,0);anlFrom=d;}
  else if(anlPeriod==="6m"){const d=new Date();d.setMonth(d.getMonth()-6);d.setHours(0,0,0,0);anlFrom=d;}
  else if(anlPeriod==="12m"){const d=new Date();d.setFullYear(d.getFullYear()-1);d.setHours(0,0,0,0);anlFrom=d;}
  else if(anlPeriod==="custom"){anlFrom=anlCustomFrom?new Date(anlCustomFrom):null;anlTo=anlCustomTo?new Date(anlCustomTo):nowD;anlTo.setHours(23,59,59,999);}
  else if(anlPeriod==="date"){if(anlSpecificDate){anlFrom=new Date(anlSpecificDate);anlFrom.setHours(0,0,0,0);anlTo=new Date(anlSpecificDate);anlTo.setHours(23,59,59,999);}}
  const inAnlRange=date=>{if(!anlFrom)return true;const d=new Date(date);return d>=anlFrom&&d<=anlTo;};
  const anlLabel=anlPeriod==="custom"?`${anlCustomFrom||"—"} → ${anlCustomTo}`:anlPeriod==="date"?`${anlSpecificDate||"Pick a date"}`:ANL_PERIODS.find(p=>p[0]===anlPeriod)?.[1]||"All Time";

  // ── Core computations ──
  const delivered=deliveries.filter(d=>d.status==="Delivered"&&inAnlRange(d.date));
  const totalDelivered=delivered.length;
  const totalScheduled=deliveries.filter(d=>inAnlRange(d.date)).length;
  const fulfillmentRate=totalScheduled>0?Math.round(totalDelivered/totalScheduled*100):0;
  const replCount=deliveries.filter(d=>d.replacement?.done&&inAnlRange(d.date)).length;
  const replRate=totalDelivered>0?Math.round(replCount/totalDelivered*100):0;
  const avgRevPerDeliv=totalDelivered>0?Math.round(delivered.reduce((s,d)=>s+lineTotal(d.orderLines),0)/totalDelivered):0;
  const cancelCount=deliveries.filter(d=>d.status==="Cancelled"&&inAnlRange(d.date)).length;
  const cancelRate=totalScheduled>0?Math.round(cancelCount/totalScheduled*100):0;

  // ── Product sales ──
  const prodSales=products.map(p=>{
    const qty=delivered.reduce((s,d)=>s+(safeO(d.orderLines)[p.id]?.qty||0),0);
    const grossRev=delivered.reduce((s,d)=>s+(safeO(d.orderLines)[p.id]?.qty||0)*(safeO(d.orderLines)[p.id]?.priceAmount||0),0);
    const replDeducted=delivered.reduce((s,d)=>{
      const dTotal=lineTotal(d.orderLines);
      const pLineAmt=(safeO(d.orderLines)[p.id]?.qty||0)*(safeO(d.orderLines)[p.id]?.priceAmount||0);
      const replAmt=+(d.replacement?.amount||0);
      if(!replAmt||!dTotal) return s;
      return s+Math.round((pLineAmt/dTotal)*replAmt);
    },0);
    const rev=Math.max(0,grossRev-replDeducted);
    return {...p,totalQty:qty,totalRev:rev,grossRev,replDeducted,deliveryCount:delivered.filter(d=>(safeO(d.orderLines)[p.id]?.qty||0)>0).length};
  }).sort((a,b)=>b.totalRev-a.totalRev);
  const totalProductRev=prodSales.reduce((s,p)=>s+p.totalRev,0);

  // ── Customer revenue ──
  const custRev=customers.map(c=>{
    const cDelivs=deliveries.filter(d=>d.customerId===c.id&&d.status==="Delivered"&&inAnlRange(d.date));
    const grossRev=cDelivs.reduce((s,d)=>s+lineTotal(d.orderLines),0);
    const replDeducted=cDelivs.reduce((s,d)=>s+(+(d.replacement?.amount)||0),0);
    const totalRevC=Math.max(0,grossRev-replDeducted);
    const partialCollected=cDelivs.reduce((s,d)=>s+(d.partialPayment?.enabled?(+(d.partialPayment?.amount)||0):0),0);
    const outstandingBalance=Math.max(0,(c.pending||0));
    return {...c,totalOrders:deliveries.filter(d=>d.customerId===c.id&&inAnlRange(d.date)).length,totalRev:totalRevC,grossRev,replDeducted,partialCollected,outstandingBalance};
  }).sort((a,b)=>b.totalRev-a.totalRev);
  const totalPortfolioRev=custRev.reduce((s,c)=>s+c.totalRev,0);
  const top20pct=Math.max(1,Math.ceil(custRev.length*0.2));
  const top20rev=custRev.slice(0,top20pct).reduce((s,c)=>s+c.totalRev,0);
  const top20share=totalPortfolioRev>0?Math.round(top20rev/totalPortfolioRev*100):0;

  // ── 14-day daily trend ──
  const days14=Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return d.toISOString().slice(0,10);}).reverse();
  const dailyData=days14.map(date=>({
    date:date.slice(5),
    scheduled:deliveries.filter(d=>d.date===date).length,
    delivered:deliveries.filter(d=>d.date===date&&d.status==="Delivered").length,
    revenue:deliveries.filter(d=>d.date===date&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0),
    expenses:expenses.filter(e=>e.date===date).reduce((s,e)=>s+(e.amount||0),0),
  }));
  const recentRevTotal=dailyData.reduce((s,d)=>s+d.revenue,0);
  const recentAvgDaily=Math.round(recentRevTotal/14);

  // ── 30-day vs prior 30-day comparison ──
  const last30days=Array.from({length:30},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return d.toISOString().slice(0,10);});
  const prior30days=Array.from({length:30},(_,i)=>{const d=new Date();d.setDate(d.getDate()-30-i);return d.toISOString().slice(0,10);});
  const last30rev=deliveries.filter(d=>last30days.includes(d.date)&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0);
  const prior30rev=deliveries.filter(d=>prior30days.includes(d.date)&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0);
  const revGrowth=prior30rev>0?Math.round((last30rev-prior30rev)/prior30rev*100):null;
  const last30delivCount=deliveries.filter(d=>last30days.includes(d.date)&&d.status==="Delivered").length;
  const prior30delivCount=deliveries.filter(d=>prior30days.includes(d.date)&&d.status==="Delivered").length;
  const delivGrowth=prior30delivCount>0?Math.round((last30delivCount-prior30delivCount)/prior30delivCount*100):null;

  // ── Day of week ──
  const dowData=[0,1,2,3,4,5,6].map(dow=>{
    const label=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dow];
    const filtered=delivered.filter(d=>new Date(d.date).getDay()===dow);
    return {day:label,deliveries:filtered.length,revenue:filtered.reduce((s,d)=>s+lineTotal(d.orderLines),0)};
  });
  const bestDow=dowData.reduce((b,d)=>d.revenue>b.revenue?d:b,dowData[0]);

  // ── Expense categories ──
  const expCatData=(settings?.expenseCategories||["Gas","Labour","Transport","Packaging","Utilities","Maintenance","Other"]).map(cat=>({
    category:cat,
    amount:expenses.filter(e=>e.category===cat&&inAnlRange(e.date)).reduce((s,e)=>s+(e.amount||0),0),
    count:expenses.filter(e=>e.category===cat&&inAnlRange(e.date)).length,
  })).filter(x=>x.amount>0).sort((a,b)=>b.amount-a.amount);
  const totalExpenses=expCatData.reduce((s,e)=>s+e.amount,0);

  // ── Wastage ──
  const wastageByType=(settings?.wastageTypes||["Other"]).map(type=>({
    type,
    qty:wastage.filter(w=>w.type===type&&inAnlRange(w.date)).reduce((s,w)=>s+(w.qty||0),0),
    cost:wastage.filter(w=>w.type===type&&inAnlRange(w.date)).reduce((s,w)=>s+(w.cost||0),0),
  })).filter(x=>x.qty>0);
  const totalWasteCost=wastageByType.reduce((s,w)=>s+w.cost,0);

  // ── Production analytics ──
  const filtProd=(prodTargets||[]).filter(p=>inAnlRange(p.date));
  const prodTotalActual=filtProd.reduce((s,p)=>s+(+p.actual||0),0);
  const prodTotalTarget=filtProd.reduce((s,p)=>s+(+p.target||0),0);
  const prodEfficiency=prodTotalTarget>0?Math.round(prodTotalActual/prodTotalTarget*100):0;
  const prodByProduct=[...new Set(filtProd.map(p=>p.product).filter(Boolean))].map(prod=>({
    product:prod,
    actual:filtProd.filter(p=>p.product===prod).reduce((s,p)=>s+(+p.actual||0),0),
    target:filtProd.filter(p=>p.product===prod).reduce((s,p)=>s+(+p.target||0),0),
    batches:filtProd.filter(p=>p.product===prod).length,
  })).sort((a,b)=>b.actual-a.actual);
  const filtQC=(qcLogs||[]).filter(q=>inAnlRange(q.date));
  const qcPassRate=filtQC.length>0?Math.round(filtQC.filter(q=>q.grade!=="F").length/filtQC.length*100):0;

  // ── Supply analytics ──
  const filtSup=supplies.filter(s=>inAnlRange(s.date));
  const totalSupplyCost=filtSup.reduce((s,x)=>s+(x.cost||0),0);
  const supByCategory=[...new Set(filtSup.map(s=>s.category||s.item||"Other"))].map(cat=>({
    cat,total:filtSup.filter(s=>(s.category||s.item||"Other")===cat).reduce((s,x)=>s+(x.cost||0),0),count:filtSup.filter(s=>(s.category||s.item||"Other")===cat).length,
  })).sort((a,b)=>b.total-a.total).slice(0,6);

  // ── Replacement analytics ──
  const filtRepl=deliveries.filter(d=>d.replacement?.done&&inAnlRange(d.date));
  const totalReplAmt=filtRepl.reduce((s,d)=>s+(+(d.replacement?.amount)||0),0);
  const replByItem=[...new Set(filtRepl.map(d=>d.replacement?.item).filter(Boolean))].map(item=>({
    item,count:filtRepl.filter(d=>d.replacement?.item===item).length,
    amount:filtRepl.filter(d=>d.replacement?.item===item).reduce((s,d)=>s+(+(d.replacement?.amount)||0),0),
  })).sort((a,b)=>b.count-a.count);

  // ── Customer retention ──
  const now=new Date();
  const activeRecently=customers.filter(c=>{
    const last=deliveries.filter(d=>d.customerId===c.id&&d.status==="Delivered").sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
    if(!last)return false;
    return Math.floor((now-new Date(last.date))/86400000)<=30;
  }).length;
  const retentionRate=customers.filter(c=>c.active).length>0?Math.round(activeRecently/customers.filter(c=>c.active).length*100):0;

  const PIE_COLORS=["#f59e0b","#10b981","#8b5cf6","#ef4444","#0ea5e9","#f97316","#ec4899"];

  // ── Invoicing & payment analytics ──
  const issuedInvoices=Object.keys(invRegistry?.issued||{});
  const totalPartialCollected=delivered.reduce((s,d)=>s+(d.partialPayment?.enabled?(+(d.partialPayment?.amount)||0):0),0);
  const totalGrossRevenue=delivered.reduce((s,d)=>s+lineTotal(d.orderLines),0);
  const totalReplDeductions=delivered.reduce((s,d)=>s+(+(d.replacement?.amount)||0),0);
  const totalNetRevenue=Math.max(0,totalGrossRevenue-totalReplDeductions);
  const totalOutstanding=customers.reduce((s,c)=>s+(c.pending||0),0);
  const totalCustPaid=customers.reduce((s,c)=>s+(c.paid||0),0);
  const deliveriesWithBalance=delivered.filter(d=>{const repl=+(d.replacement?.amount)||0;const net=Math.max(0,lineTotal(d.orderLines)-repl);const coll=d.partialPayment?.enabled?(+(d.partialPayment?.amount)||0):0;return coll>0&&coll<net;});
  const deliveriesFullySettled=delivered.filter(d=>{const repl=+(d.replacement?.amount)||0;const net=Math.max(0,lineTotal(d.orderLines)-repl);const coll=d.partialPayment?.enabled?(+(d.partialPayment?.amount)||0):0;return net>0&&coll>=net;});

  // ── Smart Insights ──
  const analyticsInsights=[];
  if(fulfillmentRate<80) analyticsInsights.push({icon:"⚠️",color:"#f59e0b",text:`Fulfillment rate is only ${fulfillmentRate}% — ${totalScheduled-totalDelivered} orders undelivered. Review capacity.`});
  if(cancelRate>10) analyticsInsights.push({icon:"🚫",color:"#ef4444",text:`Cancellation rate of ${cancelRate}% is high (${cancelCount} orders). Investigate root causes.`});
  if(retentionRate<60) analyticsInsights.push({icon:"👤",color:"#ef4444",text:`Only ${retentionRate}% of active customers ordered in the last 30 days. Churn risk is elevated.`});
  if(revGrowth!==null&&revGrowth>=15) analyticsInsights.push({icon:"🚀",color:"#10b981",text:`Revenue grew ${revGrowth}% vs prior 30 days — strong momentum. Keep it up!`});
  if(revGrowth!==null&&revGrowth<=-10) analyticsInsights.push({icon:"📉",color:"#ef4444",text:`Revenue dropped ${Math.abs(revGrowth)}% vs prior 30 days. Investigate customer activity.`});
  if(top20share>=80) analyticsInsights.push({icon:"🎯",color:"#f59e0b",text:`Top ${top20pct} customers drive ${top20share}% of revenue — high concentration risk. Diversify.`});
  if(prodSales.filter(p=>p.totalQty>0).length<products.length*0.5&&products.length>2) analyticsInsights.push({icon:"📦",color:"#8b5cf6",text:`${products.length-prodSales.filter(p=>p.totalQty>0).length} products have zero sales. Consider rationalising catalogue.`});

  return (<>
    {/* ── ANALYTICS TAB HEADER ── */}
    <SectionHeader dm={dm} title="Analytics" sub={`${anlLabel} · ${totalDelivered} deliveries · ${inr(totalNetRevenue)} net revenue`}
      cta={<>
        <button onClick={()=>setAnlShowInsights(v=>!v)} style={{background:anlShowInsights?"#2563eb":t.card,color:anlShowInsights?"#fff":t.sub,border:`1px solid ${anlShowInsights?"#2563eb":t.border}`,borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>💡 Insights</button>
        <div style={{position:"relative"}}>
          <button onClick={()=>setAnlExportOpen(anlExportOpen==="all"?null:"all")} style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:12,padding:"11px 18px",fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:"0 2px 8px rgba(37,99,235,0.3)"}}>⬇ Export All</button>
          {anlExportOpen==="all"&&<div style={{position:"absolute",right:0,top:"110%",background:t.card,border:`1px solid ${t.border}`,borderRadius:12,zIndex:99,minWidth:220,boxShadow:"0 8px 32px rgba(0,0,0,0.15)"}}>
            <div style={{padding:"8px 14px 6px",borderBottom:`1px solid ${t.border}`}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.07em"}}>Export: {anlLabel}</p>
            </div>
            {[
              ["📊 Overview CSV",()=>exportCSV([{period:anlLabel,revenue:totalNetRevenue,gross:totalGrossRevenue,deliveries:totalDelivered,fulfillment:`${fulfillmentRate}%`,cancellation:`${cancelRate}%`,replacement:`${replRate}%`,avgOrder:avgRevPerDeliv,outstanding:totalOutstanding}],"analytics_overview",[{label:"Period",key:"period"},{label:"Net Revenue",key:"revenue"},{label:"Gross Revenue",key:"gross"},{label:"Deliveries",key:"deliveries"},{label:"Fulfillment",key:"fulfillment"},{label:"Cancellation Rate",key:"cancellation"},{label:"Replacement Rate",key:"replacement"},{label:"Avg Order (₹)",key:"avgOrder"},{label:"Outstanding (₹)",key:"outstanding"}])],
              ["👥 Customers CSV",()=>exportCSV(custRev,"customers_analytics",[{label:"Name",key:"name"},{label:"Phone",key:"phone"},{label:"Orders",key:"totalOrders"},{label:"Revenue (₹)",key:"totalRev"},{label:"Outstanding (₹)",key:"outstandingBalance"},{label:"Partial Collected (₹)",key:"partialCollected"},{label:"Repl Deducted (₹)",key:"replDeducted"}])],
              ["📦 Products CSV",()=>exportCSV(prodSales,"products_analytics",[{label:"Product",key:"name"},{label:"Qty Sold",key:"totalQty"},{label:"Revenue (₹)",key:"totalRev"},{label:"Deliveries",key:"deliveryCount"}])],
              ["💸 Expenses CSV",()=>exportCSV(expCatData,"expenses_breakdown",[{label:"Category",key:"category"},{label:"Amount (₹)",key:"amount"},{label:"Count",key:"count"}])],
              ["📈 14-Day Trend CSV",()=>exportCSV(dailyData,"14day_trend",[{label:"Date",key:"date"},{label:"Scheduled",key:"scheduled"},{label:"Delivered",key:"delivered"},{label:"Revenue (₹)",key:"revenue"},{label:"Expenses (₹)",key:"expenses"}])],
            ].map(([lbl,fn])=>(
              <button key={lbl} onClick={()=>{fn();setAnlExportOpen(null);}} style={{display:"block",width:"100%",padding:"9px 14px",fontSize:12,fontWeight:600,color:t.text,textAlign:"left",cursor:"pointer",background:"transparent",border:"none",borderBottom:`1px solid ${t.border}`}}>{lbl}</button>
            ))}
          </div>}
        </div>
      </>}/>

    <TabStatCards dm={dm} cards={[
      {icon:"💰",label:"Net Revenue",   value:inr(totalNetRevenue), sub:`${totalDelivered} deliveries`,                   iconBg:t.statIcon2},
      {icon:"✅",label:"Fulfillment",   value:`${fulfillmentRate}%`, sub:`${totalDelivered}/${totalScheduled} orders`,     iconBg:t.statIcon2},
      {icon:"❌",label:"Cancellation",  value:`${cancelRate}%`,      sub:`${cancelCount} cancelled`,                       iconBg:cancelRate>5?t.statIcon5:t.statIcon2},
      {icon:"🔄",label:"Replacement",  value:`${replRate}%`,         sub:`${replCount} replacements`,                      iconBg:t.statIcon3},
      {icon:"💵",label:"Avg Order",     value:inr(avgRevPerDeliv),   sub:"per delivery",                                   iconBg:t.statIcon1},
    ]}/>

    {/* ── PERIOD SELECTOR ── */}
    <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:"12px 16px"}}>
      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:anlPeriod==="custom"||anlPeriod==="date"?10:0}}>
        {ANL_PERIODS.map(([v,l])=>(
          <button key={v} onClick={()=>setAnlPeriod(v)}
            style={anlPeriod===v
              ?{background:"#2563eb",color:"#fff",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,border:"none",cursor:"pointer"}
              :{background:t.inp,color:t.sub,borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:600,border:`1px solid ${t.border}`,cursor:"pointer"}}>{l}</button>
        ))}
        <div style={{display:"flex",gap:4,background:t.inp,borderRadius:8,padding:3,border:`1px solid ${t.border}`,marginLeft:"auto"}}>
          {[["bar","▮▮ Bar"],["line","╱ Line"]].map(([v,l])=>(
            <button key={v} onClick={()=>setAnlChartType(v)} style={{background:anlChartType===v?t.card:t.inp,color:anlChartType===v?t.text:t.sub,border:anlChartType===v?`1px solid ${t.border}`:"none",borderRadius:6,padding:"3px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>{l}</button>
          ))}
        </div>
      </div>
      {anlPeriod==="custom"&&<div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <span style={{color:t.sub,fontSize:12,fontWeight:600}}>From</span>
        <input type="date" value={anlCustomFrom} onChange={e=>setAnlCustomFrom(e.target.value)} style={{background:t.inp,border:`1px solid ${t.border}`,color:t.text,fontSize:13,borderRadius:8,padding:"5px 10px",outline:"none"}}/>
        <span style={{color:t.sub,fontSize:12,fontWeight:600}}>To</span>
        <input type="date" value={anlCustomTo} max={today()} onChange={e=>setAnlCustomTo(e.target.value)} style={{background:t.inp,border:`1px solid ${t.border}`,color:t.text,fontSize:13,borderRadius:8,padding:"5px 10px",outline:"none"}}/>
        {anlCustomFrom&&anlCustomTo&&<span style={{color:"#10b981",fontSize:11,fontWeight:700}}>✓ {Math.round((new Date(anlCustomTo)-new Date(anlCustomFrom))/86400000)+1} days</span>}
      </div>}
      {anlPeriod==="date"&&<div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <span style={{color:t.sub,fontSize:12,fontWeight:600}}>Date</span>
        <input type="date" value={anlSpecificDate} max={today()} onChange={e=>setAnlSpecificDate(e.target.value)} style={{background:t.inp,border:`1px solid ${t.border}`,color:t.text,fontSize:13,borderRadius:8,padding:"5px 10px",outline:"none"}}/>
        {anlSpecificDate&&<span style={{color:"#2563eb",fontSize:11,fontWeight:700}}>📅 {new Date(anlSpecificDate).toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"short",year:"numeric"})}</span>}
      </div>}
    </div>

    {/* ── SECTION TABS ── */}
    <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:12,padding:4,display:"flex",flexWrap:"wrap",gap:2}}>
      {[["overview","📊","Overview"],["customers","👥","Customers"],["products","📦","Products"],["operations","🏭","Operations"],["financials","💰","Financials"],["trends","📈","Trends"]].map(([k,icon,label])=>(
        <button key={k} onClick={()=>setAnlActiveSection(k)}
          style={anlActiveSection===k
            ?{background:"#2563eb",color:"#fff",borderRadius:8,padding:"6px 10px",fontSize:12,fontWeight:700,border:"none",cursor:"pointer",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4}
            :{background:"transparent",color:t.sub,borderRadius:8,padding:"6px 10px",fontSize:12,fontWeight:600,border:"none",cursor:"pointer",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4}
          }><span>{icon}</span><span>{label}</span></button>
      ))}
    </div>

    {/* ── SMART ANALYTICS INSIGHTS ── */}
    {anlShowInsights&&analyticsInsights.length>0&&<div style={{background:dm?"linear-gradient(135deg,#0d1628,#140d1f)":"linear-gradient(135deg,#eff6ff,#faf5ff)",border:dm?"1px solid #1e2a5f":"1px solid #c4b5fd",borderRadius:16,padding:"14px 18px"}}>
      <div className="flex items-center justify-between mb-2">
        <p style={{color:t.sub,fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase"}}>💡 Smart Insights ({analyticsInsights.length})</p>
        <button onClick={()=>setAnlShowInsights(false)} style={{color:t.sub,background:"transparent",border:"none",fontSize:12,cursor:"pointer",fontWeight:700}}>✕ Dismiss</button>
      </div>
      <div className="flex flex-col gap-2">
        {analyticsInsights.map((ins,i)=>(
          <div key={i} style={{background:dm?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.7)",borderRadius:10,padding:"8px 12px",display:"flex",alignItems:"flex-start",gap:8}}>
            <span style={{fontSize:16,lineHeight:1.4,flexShrink:0}}>{ins.icon}</span>
            <p style={{color:t.text,fontSize:12,lineHeight:1.5}}>{ins.text}</p>
          </div>
        ))}
      </div>
    </div>}

    {/* ══════════ OVERVIEW SECTION ══════════ */}
    {anlActiveSection==="overview"&&<>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{color:t.sub,fontSize:11,fontWeight:600}}>Highlight:</span>
        {[["revenue","💰 Revenue"],["deliveries","🚚 Deliveries"],["fulfillment","✅ Fulfillment"]].map(([v,lbl])=>
          <button key={v} onClick={()=>setAnlOverviewMetric(v)} style={{background:anlOverviewMetric===v?"#f59e0b":t.inp,color:anlOverviewMetric===v?"#fff":t.sub,border:`1px solid ${anlOverviewMetric===v?"#f59e0b":t.border}`,borderRadius:16,padding:"4px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{lbl}</button>
        )}
      </div>
      <div style={{background:dm?"linear-gradient(135deg,#0d1628,#140d1f)":"linear-gradient(135deg,#eff6ff,#faf5ff)",border:dm?"1px solid #1e2a5f":"1px solid #c4b5fd",borderRadius:20,padding:"18px 20px"}}>
        <p style={{color:t.sub,fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>📊 30-Day Performance vs Prior Period</p>
        <div className="crm-grid-4">
          {[
            {label:"Revenue (30d)",     val:inr(last30rev),     growth:revGrowth,   color:"#10b981"},
            {label:"Deliveries (30d)",  val:last30delivCount,   growth:delivGrowth, color:"#f59e0b"},
            {label:"Daily Avg Rev",     val:inr(recentAvgDaily),growth:null,        color:"#8b5cf6",sub:"last 14 days"},
            {label:"Avg Order Value",   val:inr(avgRevPerDeliv),growth:null,        color:"#0ea5e9",sub:"all time"},
          ].map(x=><div key={x.label} style={{background:dm?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.8)",borderRadius:12,padding:"12px 14px"}}>
            <p style={{color:x.color}} className="font-black text-lg leading-none">{x.val}</p>
            <p style={{color:t.sub,fontSize:10,marginTop:4}}>{x.label}</p>
            {x.growth!==null&&x.growth!==undefined?<p style={{color:x.growth>=0?"#10b981":"#ef4444",fontSize:11,fontWeight:700,marginTop:3}}>{x.growth>=0?"▲":"▼"} {Math.abs(x.growth)}% vs prior 30d</p>
            :x.sub?<p style={{color:t.sub,fontSize:10,marginTop:3}}>{x.sub}</p>:null}
          </div>)}
        </div>
      </div>

      <div className="crm-grid-4">
        <StatCard dm={dm} label="Fulfillment Rate"     value={`${fulfillmentRate}%`} sub={`${totalDelivered}/${totalScheduled} orders`} accent={fulfillmentRate>=90?"#10b981":fulfillmentRate>=70?"#f59e0b":"#ef4444"}/>
        <StatCard dm={dm} label="Cancellation Rate"    value={`${cancelRate}%`}      sub={`${cancelCount} cancelled`}                  accent={cancelRate<=5?"#10b981":cancelRate<=15?"#f59e0b":"#ef4444"}/>
        <StatCard dm={dm} label="Replacement Rate"     value={`${replRate}%`}        sub={`${replCount} replacements`}                 accent={replRate>10?"#ef4444":replRate>5?"#f59e0b":"#10b981"}/>
        <StatCard dm={dm} label="30d Retention"        value={`${retentionRate}%`}   sub={`${activeRecently} of ${customers.filter(c=>c.active).length} active`} accent={retentionRate>=80?"#10b981":retentionRate>=50?"#f59e0b":"#ef4444"}/>
      </div>
      <div className="crm-grid-4">
        <StatCard dm={dm} label="Best Seller"          value={prodSales[0]?.name||"—"}   sub={prodSales[0]?`${inr(prodSales[0].totalRev)} revenue`:"No data"}               accent="#f59e0b"/>
        <StatCard dm={dm} label="Top Customer"         value={custRev[0]?.name||"—"}     sub={custRev[0]?inr(custRev[0].totalRev)+" revenue":"No data"}                      accent="#10b981"/>
        <StatCard dm={dm} label="Production Efficiency" value={prodEfficiency>0?`${prodEfficiency}%`:"—"} sub={prodTotalActual>0?`${prodTotalActual} units produced`:"No production data"} accent={prodEfficiency>=90?"#10b981":prodEfficiency>=70?"#f59e0b":"#8b5cf6"}/>
        <StatCard dm={dm} label="Wastage Cost"         value={inr(totalWasteCost)}       sub={`${wastageByType.reduce((s,w)=>s+w.qty,0)} units wasted`}                      accent={totalWasteCost>0?"#f97316":"#10b981"}/>
      </div>

      {/* Payment Health */}
      {(()=>{
        const allPH=deliveries;
        const totalOV=allPH.reduce((s,d)=>s+lineTotal(d.orderLines),0);
        const totalReplPH=allPH.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
        const totalNetPH=totalOV-totalReplPH;
        const totalCollPH=allPH.reduce((s,d)=>s+(d.partialPayment?.enabled?(+(d.partialPayment?.amount)||0):0),0);
        const manualTotalPH=(paymentLedger||[]).reduce((s,e)=>s+e.amount,0);
        const totalPaidPH=totalCollPH+manualTotalPH;
        const totalPendingPH=Math.max(0,totalNetPH-totalPaidPH);
        const partialDelivs=allPH.filter(d=>d.partialPayment?.enabled&&(+(d.partialPayment?.amount)||0)>0).length;
        const collPct=totalNetPH>0?Math.round(totalPaidPH/totalNetPH*100):100;
        return <div style={{background:dm?"linear-gradient(135deg,#0a1f12,#0c0c16)":"linear-gradient(135deg,#f0fdf4,#eff6ff)",border:`1.5px solid ${dm?"#10b98130":"#86efac"}`,borderRadius:20,padding:"16px 18px"}}>
          <div className="flex items-center justify-between mb-3">
            <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>💳 Payment Health — All Time</p>
            <button onClick={()=>setTab("Payments")} style={{background:"#10b98115",color:"#10b981",border:"none",borderRadius:8,padding:"3px 10px",fontSize:10,fontWeight:700,cursor:"pointer"}}>Full Ledger →</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:10}}>
            <div style={{background:dm?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.8)",borderRadius:12,padding:"10px 14px",gridColumn:"1/-1"}}>
              <div className="flex justify-between mb-2"><span style={{color:"#10b981",fontSize:12,fontWeight:700}}>{inr(totalPaidPH)} collected ({collPct}%)</span><span style={{color:"#ef4444",fontSize:12,fontWeight:700}}>{inr(totalPendingPH)} pending</span></div>
              <div style={{height:8,borderRadius:8,overflow:"hidden",display:"flex",background:t.border}}>
                <div style={{width:`${collPct}%`,background:"linear-gradient(90deg,#10b981,#059669)",borderRadius:"8px 0 0 8px",transition:"width 0.6s"}}/>
                <div style={{width:`${100-collPct}%`,background:"#ef4444",borderRadius:"0 8px 8px 0"}}/>
              </div>
            </div>
          </div>
          <div className="crm-grid-4" style={{gap:8}}>
            {[
              {label:"Repl Deducted",     val:inr(totalReplPH),                                                    color:"#f97316"},
              {label:"Partial Payments",  val:partialDelivs,                                                        color:"#f59e0b",suffix:"deliveries"},
              {label:"Manual Entries",    val:(paymentLedger||[]).length,                                           color:"#3b82f6",suffix:"records"},
              {label:"Customers w/ Dues", val:customers.filter(c=>c.pending>0).length,                             color:customers.filter(c=>c.pending>0).length>0?"#ef4444":"#10b981"},
            ].map(({label,val,color,suffix})=>(
              <div key={label} style={{background:dm?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.8)",borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
                <p style={{color,fontWeight:800,fontSize:13,lineHeight:1}}>{val}{suffix?" "+suffix:""}</p>
                <p style={{color:t.sub,fontSize:9,marginTop:3,textTransform:"uppercase",letterSpacing:"0.05em",lineHeight:1.3}}>{label}</p>
              </div>
            ))}
          </div>
        </div>;
      })()}

      {/* 14-Day Trend Chart */}
      <Card dm={dm} className="p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <p style={{color:t.text}} className="font-bold text-sm">Daily Revenue & Delivery Trend — 14 Days</p>
            <p style={{color:t.sub}} className="text-[11px]">Revenue (left axis) · Deliveries (right axis) · Expenses (purple)</p>
          </div>
          <div className="flex items-center gap-2">
            <span style={{background:"#10b98120",color:"#10b981",borderRadius:8,padding:"3px 10px",fontSize:11,fontWeight:700}}>{inr(recentRevTotal)} total</span>
            <button onClick={()=>exportCSV(dailyData,"14day_trend",[{label:"Date",key:"date"},{label:"Scheduled",key:"scheduled"},{label:"Delivered",key:"delivered"},{label:"Revenue (₹)",key:"revenue"},{label:"Expenses (₹)",key:"expenses"}])} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ CSV</button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          {anlChartType==="line"
            ?<LineChart data={dailyData} margin={{top:4,right:4,left:-10,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false}/>
              <XAxis dataKey="date" tick={{fontSize:9,fill:t.sub}}/>
              <YAxis yAxisId="left" tick={{fontSize:9,fill:t.sub}} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:`${v}`}/>
              <YAxis yAxisId="right" orientation="right" tick={{fontSize:9,fill:t.sub}}/>
              <Tooltip contentStyle={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,color:t.text,fontSize:11}} formatter={(v,n)=>n==="Revenue"?[inr(v),n]:[v,n]}/>
              <Legend wrapperStyle={{fontSize:10,paddingTop:6}}/>
              <Line yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2.5} dot={{r:3}} activeDot={{r:5}}/>
              <Line yAxisId="left" type="monotone" dataKey="expenses" name="Expenses" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="4 2" dot={false}/>
              <Line yAxisId="right" type="monotone" dataKey="delivered" name="Deliveries" stroke="#f59e0b" strokeWidth={2} dot={{r:3}} activeDot={{r:5}}/>
            </LineChart>
            :<BarChart data={dailyData} margin={{top:4,right:4,left:-10,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false}/>
              <XAxis dataKey="date" tick={{fontSize:9,fill:t.sub}}/>
              <YAxis yAxisId="left" tick={{fontSize:9,fill:t.sub}} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:`${v}`}/>
              <YAxis yAxisId="right" orientation="right" tick={{fontSize:9,fill:t.sub}}/>
              <Tooltip contentStyle={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,color:t.text,fontSize:11}} formatter={(v,n)=>n==="Revenue"?[inr(v),n]:[v,n]}/>
              <Legend wrapperStyle={{fontSize:10,paddingTop:6}}/>
              <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#10b981" radius={[3,3,0,0]}/>
              <Bar yAxisId="left" dataKey="expenses" name="Expenses" fill="#8b5cf6" radius={[3,3,0,0]}/>
              <Bar yAxisId="right" dataKey="delivered" name="Deliveries" fill="#f59e0b" radius={[3,3,0,0]}/>
            </BarChart>
          }
        </ResponsiveContainer>
      </Card>

      {/* Day of Week */}
      <Card dm={dm} className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p style={{color:t.text}} className="font-bold text-sm">Revenue by Day of Week</p>
            <p style={{color:t.sub}} className="text-[11px]">Best day: <strong style={{color:"#f59e0b"}}>{bestDow.day}</strong> · {inr(bestDow.revenue)}</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={dowData} margin={{top:4,right:0,left:-20,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false}/>
            <XAxis dataKey="day" tick={{fontSize:11,fill:t.sub}}/>
            <YAxis tick={{fontSize:9,fill:t.sub}} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:`${v}`}/>
            <Tooltip contentStyle={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,color:t.text,fontSize:11}} formatter={(v,n)=>n==="Revenue"?[inr(v),n]:[v,n]}/>
            <Bar dataKey="revenue" name="Revenue" radius={[4,4,0,0]}>
              {dowData.map((entry,index)=><Cell key={index} fill={entry.revenue===Math.max(...dowData.map(d=>d.revenue))?"#f59e0b":dm?"#3a3a44":"#e2e4e8"}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </>}

    {/* ══════════ CUSTOMERS SECTION ══════════ */}
    {anlActiveSection==="customers"&&(()=>{
      const filtCust2=(()=>{
        let fc=[...custRev];
        if(anlCustSearch){const q=anlCustSearch.toLowerCase();fc=fc.filter(c=>c.name?.toLowerCase().includes(q)||c.phone?.toLowerCase().includes(q));}
        if(anlCustFilter==="owing") fc=fc.filter(c=>(c.outstandingBalance||0)>0);
        else if(anlCustFilter==="clear") fc=fc.filter(c=>!((c.outstandingBalance||0)>0));
        else if(anlCustFilter==="partial") fc=fc.filter(c=>(c.partialCollected||0)>0);
        else if(anlCustFilter==="replacements") fc=fc.filter(c=>(c.replDeducted||0)>0);
        const fcSorted=[...fc];
        if(anlCustSort==="revenue") fcSorted.sort((a,b)=>b.totalRev-a.totalRev);
        else if(anlCustSort==="orders") fcSorted.sort((a,b)=>b.totalOrders-a.totalOrders);
        else if(anlCustSort==="outstanding") fcSorted.sort((a,b)=>(b.outstandingBalance||0)-(a.outstandingBalance||0));
        else if(anlCustSort==="name") fcSorted.sort((a,b)=>(a.name||"").localeCompare(b.name||""));
        return fcSorted;
      })();
      return <>
      <div className="crm-grid-4">
        <StatCard dm={dm} label="Total Revenue"       value={inr(totalNetRevenue)}         sub={`${totalDelivered} deliveries`}                                            accent="#10b981"/>
        <StatCard dm={dm} label="Outstanding Balance" value={inr(totalOutstanding)}         sub={`${customers.filter(c=>(c.pending||0)>0).length} customers owing`}          accent="#ef4444"/>
        <StatCard dm={dm} label="Partial Collected"   value={inr(totalPartialCollected)}    sub={`${deliveriesWithBalance.length} deliveries`}                               accent="#f59e0b"/>
        <StatCard dm={dm} label="Fully Settled"       value={deliveriesFullySettled.length} sub="deliveries paid in full"                                                    accent="#8b5cf6"/>
      </div>

      {/* Returns + Replacements + Partials */}
      {(()=>{
        const inPeriodD=deliveries.filter(d=>inAnlRange(d.date));
        const retCount=inPeriodD.filter(d=>d.status==="Cancelled").length;
        const replInPeriod=inPeriodD.filter(d=>d.replacement?.done);
        const replTotal=replInPeriod.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
        const partialInPeriod=inPeriodD.filter(d=>d.partialPayment?.enabled&&(+(d.partialPayment?.amount)||0)>0);
        const partialTotal=partialInPeriod.reduce((s,d)=>s+(+(d.partialPayment?.amount)||0),0);
        return <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:18,padding:"14px 18px"}}>
          <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:12}}>📊 Returns · Replacements · Partial Payments — {anlLabel}</p>
          <div className="crm-grid-3" style={{gap:10,marginBottom:12}}>
            {[
              {label:"Returns / Cancelled",val:retCount,       color:"#ef4444",icon:"↩",sub:`${totalScheduled>0?Math.round(retCount/totalScheduled*100):0}% of orders`},
              {label:"Replacements",        val:replInPeriod.length,color:"#f97316",icon:"🔄",sub:replTotal>0?`${inr(replTotal)} deducted`:"No deductions"},
              {label:"Partial Payments",    val:partialInPeriod.length,color:"#f59e0b",icon:"⚡",sub:partialTotal>0?`${inr(partialTotal)} collected`:"None collected"},
            ].map(({label,val,color,icon,sub})=>(
              <div key={label} style={{background:t.inp,borderRadius:12,padding:"12px 14px",borderTop:`3px solid ${color}`}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                  <span style={{fontSize:16}}>{icon}</span>
                  <p style={{color,fontWeight:900,fontSize:22,lineHeight:1}}>{val}</p>
                </div>
                <p style={{color:t.text,fontSize:11,fontWeight:600}}>{label}</p>
                <p style={{color:t.sub,fontSize:10,marginTop:2}}>{sub}</p>
              </div>
            ))}
          </div>
          {replInPeriod.length>0&&<div style={{marginBottom:10}}>
            <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Recent Replacements</p>
            {[...replInPeriod].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,5).map(d=>(
              <div key={d.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${t.border}`}}>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{color:t.text,fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.customer}</p>
                  <p style={{color:t.sub,fontSize:11}}>{d.date} · {d.replacement?.item||"—"}{d.replacement?.type?` · ${d.replacement.type}`:""}</p>
                </div>
                {canSeePrices&&<span style={{color:"#f97316",fontWeight:700,fontSize:12,flexShrink:0,marginLeft:8}}>{d.replacement?.amount?`−${inr(+d.replacement.amount)}`:"—"}</span>}
              </div>
            ))}
            {replInPeriod.length>5&&<p style={{color:t.sub,fontSize:10,textAlign:"center",marginTop:6}}>+{replInPeriod.length-5} more replacements</p>}
          </div>}
          {partialInPeriod.length>0&&<div>
            <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Partial Payments</p>
            {[...partialInPeriod].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,5).map(d=>(
              <div key={d.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${t.border}`}}>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{color:t.text,fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.customer}</p>
                  <p style={{color:t.sub,fontSize:11}}>{d.date} · {d.partialPayment?.collectedBy||"—"}</p>
                </div>
                {canSeePrices&&<span style={{color:"#f59e0b",fontWeight:700,fontSize:12,flexShrink:0,marginLeft:8}}>{inr(+d.partialPayment.amount)}</span>}
              </div>
            ))}
          </div>}
          <button onClick={()=>{
            const rows=[
              ...replInPeriod.map(d=>({type:"Replacement",customer:d.customer,date:d.date,item:d.replacement?.item||"",qty:d.replacement?.qty||"",amount:+d.replacement?.amount||0,reason:d.replacement?.reason||"",replType:d.replacement?.type||""})),
              ...partialInPeriod.map(d=>({type:"Partial Payment",customer:d.customer,date:d.date,item:"",qty:"",amount:+d.partialPayment?.amount||0,reason:d.partialPayment?.note||"",replType:""})),
              ...retCount>0?inPeriodD.filter(d=>d.status==="Cancelled").map(d=>({type:"Return/Cancel",customer:d.customer,date:d.date,item:"",qty:"",amount:0,reason:d.notes||"",replType:""})):[],
            ];
            exportCSV(rows,`returns_replacements_${anlLabel.replace(/[^a-z0-9]/gi,"_")}`,[{label:"Type",key:"type"},{label:"Customer",key:"customer"},{label:"Date",key:"date"},{label:"Item",key:"item"},{label:"Qty",key:"qty"},{label:"Amount (₹)",key:"amount"},{label:"Notes/Reason",key:"reason"}]);
          }} style={{marginTop:10,width:"100%",background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:10,padding:"8px",fontSize:12,fontWeight:700,cursor:"pointer"}}>⬇ Export Returns, Replacements & Partials CSV</button>
        </div>;
      })()}

      <Card dm={dm} className="overflow-hidden">
        <div className="p-4 pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div>
              <p style={{color:t.text}} className="font-bold text-sm">Customer Analytics</p>
              <p style={{color:t.sub}} className="text-[11px]">Top {top20pct} customers · {top20share}% of revenue{top20share>=80?" — concentration risk":""}</p>
            </div>
            <button onClick={()=>exportCSV(filtCust2,"customer_analytics",[{label:"Name",key:"name"},{label:"Phone",key:"phone"},{label:"Total Orders",key:"totalOrders"},{label:"Revenue",key:"totalRev"},{label:"Gross Revenue",key:"grossRev"},{label:"Repl Deducted",key:"replDeducted"},{label:"Partial Collected",key:"partialCollected"},{label:"Outstanding",key:"outstandingBalance"}])} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ CSV</button>
          </div>
          <div className="crm-btn-group">
            <input value={anlCustSearch} onChange={e=>setAnlCustSearch(e.target.value)} placeholder="Search customer…" style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 10px",fontSize:12,flex:1,minWidth:120,outline:"none"}}/>
            <select value={anlCustSort} onChange={e=>setAnlCustSort(e.target.value)} style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 8px",fontSize:12,cursor:"pointer"}}>
              <option value="revenue">Sort: Revenue ↓</option>
              <option value="orders">Sort: Orders ↓</option>
              <option value="outstanding">Sort: Outstanding ↓</option>
              <option value="name">Sort: Name A–Z</option>
            </select>
            <select value={anlCustFilter} onChange={e=>setAnlCustFilter(e.target.value)} style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 8px",fontSize:12,cursor:"pointer",minHeight:36}}>
              <option value="all">All Customers</option>
              <option value="owing">Owing Only</option>
              <option value="clear">Clear Only</option>
              <option value="partial">Has Partial</option>
              <option value="replacements">Has Replacements</option>
            </select>
          </div>
          <p style={{color:t.sub,fontSize:11,marginTop:6}}>{filtCust2.length} customers shown</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr style={{borderBottom:`1px solid ${t.border}`,background:dm?"#111":"#f9f9f8"}}>
              <th style={{color:t.sub}} className="px-3 py-2 text-left font-bold uppercase tracking-wide text-[10px]">#</th>
              <th style={{color:t.sub,cursor:"pointer"}} className="px-3 py-2 text-left font-bold uppercase tracking-wide text-[10px]" onClick={()=>setAnlCustSort("name")}>Customer{anlCustSort==="name"?" ↑":""}</th>
              <th style={{color:t.sub,cursor:"pointer"}} className="px-3 py-2 text-left font-bold uppercase tracking-wide text-[10px]" onClick={()=>setAnlCustSort("orders")}>Orders{anlCustSort==="orders"?" ↓":""}</th>
              <th style={{color:t.sub,cursor:"pointer"}} className="px-3 py-2 text-right font-bold uppercase tracking-wide text-[10px]" onClick={()=>setAnlCustSort("revenue")}>Revenue{anlCustSort==="revenue"?" ↓":""}</th>
              <th style={{color:t.sub}} className="px-3 py-2 text-right font-bold uppercase tracking-wide text-[10px]">Part.Paid</th>
              <th style={{color:t.sub,cursor:"pointer"}} className="px-3 py-2 text-right font-bold uppercase tracking-wide text-[10px]" onClick={()=>setAnlCustSort("outstanding")}>Outstanding{anlCustSort==="outstanding"?" ↓":""}</th>
              <th style={{color:t.sub}} className="px-3 py-2 text-left font-bold uppercase tracking-wide text-[10px]">Status</th>
            </tr></thead>
            <tbody>
              {filtCust2.map((c,i)=>{
                const share=totalPortfolioRev>0?Math.round(c.totalRev/totalPortfolioRev*100):0;
                const hasOutstanding=(c.outstandingBalance||0)>0;
                const hasPartial=(c.partialCollected||0)>0;
                const isExp=anlCustExpanded===c.id;
                const custDelivs=delivered.filter(d=>d.customerId===c.id||d.customer===c.name);
                return <React.Fragment key={c.id}>
                  <tr onClick={()=>setAnlCustExpanded(isExp?null:c.id)} style={{borderBottom:`1px solid ${t.border}`,background:isExp?(dm?"rgba(99,102,241,0.08)":"rgba(99,102,241,0.04)"):hasOutstanding?(dm?"rgba(239,68,68,0.04)":"rgba(239,68,68,0.02)"):undefined,cursor:"pointer"}}>
                    <td style={{color:t.sub}} className="px-3 py-2.5 font-black">{i+1}</td>
                    <td className="px-3 py-2.5"><p style={{color:t.text}} className="font-semibold">{c.name}</p>{c.phone&&<p style={{color:t.sub}} className="text-[10px]">{c.phone}</p>}</td>
                    <td style={{color:t.sub}} className="px-3 py-2.5">{c.totalOrders}</td>
                    <td className="px-3 py-2.5 font-bold text-amber-500 text-right">{inr(c.totalRev)}</td>
                    <td className="px-3 py-2.5 text-right">{hasPartial?<span style={{color:"#f59e0b",fontWeight:700}}>{inr(c.partialCollected)}</span>:<span style={{color:t.sub}}>—</span>}</td>
                    <td className="px-3 py-2.5 text-right"><span style={{color:hasOutstanding?"#ef4444":"#10b981",fontWeight:700}}>{hasOutstanding?inr(c.outstandingBalance):"✓ Clear"}</span></td>
                    <td className="px-3 py-2.5">
                      <span style={{background:hasOutstanding?"#ef444420":"#10b98120",color:hasOutstanding?"#ef4444":"#10b981",borderRadius:6,padding:"2px 7px",fontWeight:700,fontSize:10}}>{hasOutstanding?"OWING":"CLEAR"}</span>
                      <span style={{color:t.sub,fontSize:10,marginLeft:4}}>{isExp?"▲":"▼"}</span>
                    </td>
                  </tr>
                  {isExp&&<tr style={{background:dm?"rgba(99,102,241,0.06)":"rgba(99,102,241,0.03)"}}>
                    <td colSpan={7} className="px-4 py-3">
                      <p style={{color:t.sub,fontSize:11,fontWeight:700,marginBottom:6}}>Recent deliveries · {c.name}</p>
                      {custDelivs.length===0?<p style={{color:t.sub,fontSize:11}}>No deliveries in this period.</p>
                      :custDelivs.slice(0,5).map(d=>{
                        const net=Math.max(0,lineTotal(d.orderLines)-(+(d.replacement?.amount)||0));
                        const anlInvNo=(invRegistry?.issued||{})[d.id]||d.invNo||null;
                        return <div key={d.id} style={{background:t.inp,borderRadius:8,padding:"6px 10px",marginBottom:4,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div>
                            <p style={{color:t.text,fontSize:11,fontWeight:600}}>{d.date} · <span style={{color:d.status==="Delivered"?"#10b981":"#f59e0b"}}>{d.status}</span></p>
                            {anlInvNo&&<p style={{color:"#8b5cf6",fontSize:9,fontFamily:"monospace",fontWeight:700,marginTop:2}}>📄 {anlInvNo}</p>}
                            {d.orderLines&&Object.values(d.orderLines).filter(l=>l.qty>0).map((l,li)=><span key={li} style={{color:t.sub,fontSize:10,marginRight:6}}>{l.name||l.product||""} ×{l.qty}</span>)}
                          </div>
                          <p style={{color:"#f59e0b",fontWeight:700,fontSize:12}}>{inr(net)}</p>
                        </div>;
                      })}
                    </td>
                  </tr>}
                </React.Fragment>;
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Card dm={dm} className="p-4">
        <p style={{color:t.text}} className="font-bold text-sm mb-3">👤 Customer Retention</p>
        <div className="grid grid-cols-3 gap-3">
          <div style={{background:t.inp,borderRadius:12,padding:"12px 14px",textAlign:"center"}}><p style={{color:"#10b981",fontWeight:900,fontSize:22}}>{activeRecently}</p><p style={{color:t.text,fontSize:11,fontWeight:600,marginTop:4}}>Active (30d)</p></div>
          <div style={{background:t.inp,borderRadius:12,padding:"12px 14px",textAlign:"center"}}><p style={{color:"#f59e0b",fontWeight:900,fontSize:22}}>{customers.filter(c=>c.active).length-activeRecently}</p><p style={{color:t.text,fontSize:11,fontWeight:600,marginTop:4}}>Inactive</p></div>
          <div style={{background:t.inp,borderRadius:12,padding:"12px 14px",textAlign:"center"}}><p style={{color:retentionRate>=80?"#10b981":retentionRate>=50?"#f59e0b":"#ef4444",fontWeight:900,fontSize:22}}>{retentionRate}%</p><p style={{color:t.text,fontSize:11,fontWeight:600,marginTop:4}}>Retention Rate</p></div>
        </div>
      </Card>
      </>;
    })()}

    {/* ══════════ PRODUCTS SECTION ══════════ */}
    {anlActiveSection==="products"&&(()=>{
      const sortedProds=(()=>{
        const spSorted=[...prodSales];
        if(anlProdSort==="qty") spSorted.sort((a,b)=>b.totalQty-a.totalQty);
        else if(anlProdSort==="deliveries") spSorted.sort((a,b)=>b.deliveryCount-a.deliveryCount);
        else spSorted.sort((a,b)=>b.totalRev-a.totalRev);
        return spSorted;
      })();
      return <>
      <Card dm={dm} className="overflow-hidden">
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <div><p style={{color:t.text}} className="font-bold text-sm">Product Performance</p><p style={{color:t.sub}} className="text-[11px]">Click a product to expand delivery breakdown</p></div>
            <div className="flex gap-2 flex-wrap items-center">
              <select value={anlProdSort} onChange={e=>setAnlProdSort(e.target.value)} style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>
                <option value="revenue">Sort: Revenue</option>
                <option value="qty">Sort: Quantity</option>
                <option value="deliveries">Sort: Deliveries</option>
              </select>
              <button onClick={()=>exportCSV(sortedProds,"product_analytics",[{label:"Product",key:"name"},{label:"Unit",key:"unit"},{label:"Total Qty",key:"totalQty"},{label:"Total Revenue",key:"totalRev"},{label:"Gross Revenue",key:"grossRev"},{label:"Repl Deducted",key:"replDeducted"},{label:"Deliveries",key:"deliveryCount"}])} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ CSV</button>
            </div>
          </div>
        </div>
        {sortedProds.map((p,i)=>{
          const revShare=totalProductRev>0?Math.round(p.totalRev/totalProductRev*100):0;
          const isExp=anlProdExpanded===p.id;
          const prodDelivs=delivered.filter(d=>d.orderLines&&Object.values(d.orderLines).some(l=>(l.name===p.name||l.product===p.name)&&l.qty>0));
          return <div key={p.id}>
            <div onClick={()=>setAnlProdExpanded(isExp?null:p.id)} style={{borderTop:`1px solid ${t.border}`,cursor:"pointer",background:isExp?(dm?"rgba(139,92,246,0.07)":"rgba(139,92,246,0.03)"):undefined}} className="px-4 py-3">
              <div className="flex items-start justify-between mb-1.5 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span style={{color:t.sub,width:18,textAlign:"center",fontWeight:800,fontSize:11,flexShrink:0}}>{i+1}</span>
                  <div className="min-w-0">
                    <p style={{color:t.text,fontSize:12,fontWeight:600}} className="truncate">{p.name}</p>
                    <p style={{color:t.sub,fontSize:10}}>{p.totalQty} {p.unit} · {p.deliveryCount} deliveries</p>
                  </div>
                </div>
                <div className="text-right shrink-0 flex items-center gap-2">
                  <div><p className="font-black text-amber-500 text-sm leading-none">{inr(p.totalRev)}</p><p style={{color:t.sub,fontSize:9}}>{revShare}% of sales</p></div>
                  <span style={{color:t.sub,fontSize:10}}>{isExp?"▲":"▼"}</span>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:t.border}}>
                  <div className="h-full rounded-full" style={{width:`${revShare}%`,background:PIE_COLORS[i%7],transition:"width 0.5s ease"}}/>
                </div>
                <span style={{color:t.sub,fontSize:10,fontWeight:700,minWidth:28,textAlign:"right"}}>{revShare}%</span>
              </div>
            </div>
            {isExp&&<div style={{background:dm?"rgba(139,92,246,0.05)":"rgba(139,92,246,0.02)",borderTop:`1px solid ${t.border}`,padding:"10px 16px"}}>
              <p style={{color:t.sub,fontSize:11,fontWeight:700,marginBottom:6}}>Recent deliveries with {p.name}</p>
              {prodDelivs.length===0?<p style={{color:t.sub,fontSize:11}}>No deliveries found.</p>
              :prodDelivs.slice(0,5).map(d=>{
                const qty=d.orderLines?Object.values(d.orderLines).find(l=>(l.name===p.name||l.product===p.name))?.qty||0:0;
                return <div key={d.id} style={{background:t.inp,borderRadius:8,padding:"6px 10px",marginBottom:4,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div><p style={{color:t.text,fontSize:11,fontWeight:600}}>{d.customer} · {d.date}</p><p style={{color:t.sub,fontSize:10}}>{qty} {p.unit} · {d.status}</p></div>
                  <p style={{color:"#8b5cf6",fontWeight:700,fontSize:12}}>{inr(qty*(p.totalRev/Math.max(1,p.totalQty)))}</p>
                </div>;
              })}
            </div>}
          </div>;
        })}
      </Card>

      {expCatData.length>0?<Card dm={dm} className="overflow-hidden">
        <div className="p-4 pb-2 flex items-center justify-between">
          <div><p style={{color:t.text}} className="font-bold text-sm">Expense Breakdown</p><p style={{color:t.sub}} className="text-[11px]">{inr(totalExpenses)} total · {expCatData.length} categories</p></div>
          <button onClick={()=>exportCSV(expCatData,"expense_breakdown",[{label:"Category",key:"category"},{label:"Amount",key:"amount"},{label:"Count",key:"count"}])} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ CSV</button>
        </div>
        {expCatData.map((e,i)=>{
          const pct=totalExpenses>0?Math.round(e.amount/totalExpenses*100):0;
          return <div key={e.category} style={{borderTop:`1px solid ${t.border}`}} className="px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2"><div style={{width:8,height:8,borderRadius:2,background:PIE_COLORS[i%7],flexShrink:0}}/><p style={{color:t.text,fontSize:12,fontWeight:600}}>{e.category}</p></div>
              <div className="text-right"><p className="text-sm font-bold text-red-400">{inr(e.amount)}</p><p style={{color:t.sub,fontSize:9}}>{pct}% · {e.count} entries</p></div>
            </div>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:t.border}}>
              <div className="h-full rounded-full" style={{width:`${pct}%`,background:PIE_COLORS[i%7]}}/>
            </div>
          </div>;
        })}
      </Card>:<Card dm={dm} className="p-4 flex items-center justify-center" style={{minHeight:200}}><p style={{color:t.sub,fontSize:13}}>No expense data recorded yet.</p></Card>}

      {filtRepl.length>0&&<Card dm={dm} className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div><p style={{color:t.text}} className="font-bold text-sm">🔄 Replacement Analytics</p><p style={{color:t.sub}} className="text-[11px]">{filtRepl.length} replacements · {inr(totalReplAmt)} deducted</p></div>
          <button onClick={()=>exportCSV(replByItem,"replacements_by_item",[{label:"Item",key:"item"},{label:"Count",key:"count"},{label:"Amount",key:"amount"}])} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ CSV</button>
        </div>
        {replByItem.length>0&&<div className="flex flex-col gap-2">
          {replByItem.map((r,i)=>(
            <div key={r.item} style={{background:t.inp,borderRadius:10,padding:"10px 14px"}}>
              <div className="flex items-center justify-between mb-1">
                <p style={{color:t.text,fontWeight:600,fontSize:12}}>{r.item}</p>
                <div className="text-right"><p style={{color:"#f97316",fontWeight:700,fontSize:12}}>{r.count}×</p>{r.amount>0&&<p style={{color:t.sub,fontSize:10}}>−{inr(r.amount)}</p>}</div>
              </div>
              <div style={{height:4,borderRadius:4,background:t.border,overflow:"hidden"}}><div style={{width:`${totalReplAmt>0?Math.round(r.amount/totalReplAmt*100):100}%`,height:"100%",background:"#f97316",borderRadius:4}}/></div>
            </div>
          ))}
        </div>}
      </Card>}

      {wastageByType.length>0&&<Card dm={dm} className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div><p style={{color:t.text}} className="font-bold text-sm">Wastage Analysis</p><p style={{color:t.sub}} className="text-[11px]">{inr(totalWasteCost)} in losses · {wastageByType.reduce((s,w)=>s+w.qty,0)} units wasted</p></div>
          <button onClick={()=>exportCSV(wastageByType,"wastage_analysis",[{label:"Type",key:"type"},{label:"Qty",key:"qty"},{label:"Cost",key:"cost"}])} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ CSV</button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {wastageByType.map((w,i)=>{
            const pct=totalWasteCost>0?Math.round(w.cost/totalWasteCost*100):0;
            return <div key={w.type} style={{background:t.inp,borderRadius:12,padding:"12px 14px",borderLeft:`3px solid ${PIE_COLORS[i%7]}`}}>
              <p style={{color:t.text,fontWeight:700,fontSize:13}}>{w.type}</p>
              <p style={{color:t.sub,fontSize:10,marginTop:2}}>{w.qty} units</p>
              {w.cost>0&&<><p className="text-red-400 font-bold text-xs mt-1">{inr(w.cost)}</p><p style={{color:t.sub,fontSize:9}}>{pct}% of waste losses</p></>}
            </div>;
          })}
        </div>
      </Card>}
      </>;
    })()}

    {/* ══════════ OPERATIONS SECTION ══════════ */}
    {anlActiveSection==="operations"&&(()=>{
      const opsViews=[["production","🏭 Production"],["qc","🔬 QC"],["supply","📦 Supply"],["wastage","🗑️ Wastage"]];
      return <>
      <div className="flex gap-2 flex-wrap mb-1">
        {opsViews.map(([v,label])=><button key={v} onClick={()=>setAnlOpsView(v)} style={{background:anlOpsView===v?"#8b5cf6":t.inp,color:anlOpsView===v?"#fff":t.sub,border:`1px solid ${anlOpsView===v?"#8b5cf6":t.border}`,borderRadius:20,padding:"5px 14px",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all 0.2s"}}>{label}</button>)}
      </div>
      <div className="crm-grid-4">
        <StatCard dm={dm} label="Units Produced"         value={prodTotalActual.toLocaleString("en-IN")} sub={`of ${prodTotalTarget} targeted`}    accent="#8b5cf6"/>
        <StatCard dm={dm} label="Production Efficiency"  value={`${prodEfficiency}%`}                    sub="actual vs target"                      accent={prodEfficiency>=90?"#10b981":prodEfficiency>=70?"#f59e0b":"#ef4444"}/>
        <StatCard dm={dm} label="QC Pass Rate"           value={`${qcPassRate}%`}                        sub={`${filtQC.length} checks done`}         accent={qcPassRate>=90?"#10b981":qcPassRate>=75?"#f59e0b":"#ef4444"}/>
        <StatCard dm={dm} label="Supply Cost"            value={inr(totalSupplyCost)}                    sub={`${filtSup.length} supply entries`}     accent="#6366f1"/>
      </div>

      {anlOpsView==="production"&&prodByProduct.length>0&&<Card dm={dm} className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p style={{color:t.text}} className="font-bold text-sm">🏭 Production by Product</p>
          <button onClick={()=>exportCSV(prodByProduct,"production_by_product",[{label:"Product",key:"product"},{label:"Batches",key:"batches"},{label:"Actual",key:"actual"},{label:"Target",key:"target"},{label:"Efficiency %",val:r=>r.target>0?Math.round(r.actual/r.target*100):0}])} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ CSV</button>
        </div>
        <div className="flex flex-col gap-3">
          {prodByProduct.map((p,i)=>{
            const eff=p.target>0?Math.round(p.actual/p.target*100):100;
            return <div key={p.product} style={{background:t.inp,borderRadius:12,padding:"12px 14px"}}>
              <div className="flex items-center justify-between mb-2">
                <div><p style={{color:t.text,fontWeight:700,fontSize:13}}>{p.product}</p><p style={{color:t.sub,fontSize:10}}>{p.batches} batches · {p.actual} units produced</p></div>
                <div className="text-right"><p style={{color:eff>=90?"#10b981":eff>=70?"#f59e0b":"#ef4444",fontWeight:800,fontSize:16}}>{eff}%</p><p style={{color:t.sub,fontSize:9}}>efficiency</p></div>
              </div>
              <div style={{height:6,borderRadius:6,background:t.border,overflow:"hidden"}}><div style={{width:`${Math.min(100,eff)}%`,height:"100%",background:eff>=90?"#10b981":eff>=70?"#f59e0b":"#ef4444",borderRadius:6,transition:"width 0.5s"}}/></div>
            </div>;
          })}
        </div>
      </Card>}

      {anlOpsView==="qc"&&filtQC.length>0&&<Card dm={dm} className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p style={{color:t.text}} className="font-bold text-sm">🔬 QC Grade Distribution</p>
          <button onClick={()=>exportCSV(filtQC,"qc_checks",[{label:"Date",key:"date"},{label:"Product",key:"product"},{label:"Grade",key:"grade"},{label:"Batch",key:"batchLabel"},{label:"Notes",key:"notes"}])} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ CSV</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[{g:"A",c:"#10b981",l:"Grade A — Pass"},{g:"B",c:"#f59e0b",l:"Grade B — Pass"},{g:"C",c:"#f97316",l:"Grade C — Marginal"},{g:"F",c:"#ef4444",l:"Fail — Reject"}].map(({g,c,l})=>{
            const cnt=filtQC.filter(q=>q.grade===g).length;
            const pct=filtQC.length>0?Math.round(cnt/filtQC.length*100):0;
            return <div key={g} style={{background:t.inp,borderRadius:12,padding:"12px 14px",borderTop:`3px solid ${c}`}}>
              <p style={{color:c,fontWeight:900,fontSize:22}}>{cnt}</p>
              <p style={{color:t.text,fontSize:11,fontWeight:600}}>{l}</p>
              <p style={{color:t.sub,fontSize:10}}>{pct}% of checks</p>
            </div>;
          })}
        </div>
      </Card>}

      {anlOpsView==="supply"&&supByCategory.length>0&&<Card dm={dm} className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p style={{color:t.text}} className="font-bold text-sm">📦 Supply Cost by Category</p>
          <button onClick={()=>exportCSV(supByCategory,"supply_by_category",[{label:"Category",key:"cat"},{label:"Total",key:"total"},{label:"Count",key:"count"}])} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ CSV</button>
        </div>
        <div className="flex flex-col gap-2">
          {supByCategory.map((s,i)=>{
            const pct=totalSupplyCost>0?Math.round(s.total/totalSupplyCost*100):0;
            return <div key={s.cat} style={{background:t.inp,borderRadius:10,padding:"10px 14px"}}>
              <div className="flex items-center justify-between mb-1">
                <p style={{color:t.text,fontWeight:600,fontSize:12}}>{s.cat}</p>
                <div className="text-right"><p style={{color:"#8b5cf6",fontWeight:700,fontSize:12}}>{inr(s.total)}</p><p style={{color:t.sub,fontSize:10}}>{s.count} entries · {pct}%</p></div>
              </div>
              <div style={{height:4,borderRadius:4,background:t.border,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:PIE_COLORS[i%7],borderRadius:4}}/></div>
            </div>;
          })}
        </div>
      </Card>}

      {anlOpsView==="wastage"&&wastageByType.length>0&&<Card dm={dm} className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div><p style={{color:t.text}} className="font-bold text-sm">🗑️ Wastage by Type</p><p style={{color:t.sub}} className="text-[11px]">{inr(totalWasteCost)} total loss</p></div>
          <button onClick={()=>exportCSV(wastageByType,"wastage_by_type",[{label:"Type",key:"type"},{label:"Qty",key:"qty"},{label:"Cost",key:"cost"}])} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ CSV</button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          {wastageByType.map((w,i)=>(
            <div key={w.type} style={{background:t.inp,borderRadius:12,padding:"12px 14px",borderLeft:`3px solid ${PIE_COLORS[i%7]}`}}>
              <p style={{color:t.text,fontWeight:700,fontSize:13}}>{w.type}</p>
              <p style={{color:t.sub,fontSize:10,marginTop:2}}>{w.qty} units</p>
              {w.cost>0&&<p className="text-red-400 font-bold text-xs mt-1">{inr(w.cost)}</p>}
            </div>
          ))}
        </div>
      </Card>}
      </>;
    })()}

    {/* ══════════ FINANCIALS SECTION ══════════ */}
    {anlActiveSection==="financials"&&(()=>{
      const finViews=[["summary","📊 Summary"],["chart","📈 Chart"],["expenses","💸 Expenses"]];
      return <>
      <div className="flex gap-2 flex-wrap mb-1">
        {finViews.map(([v,label])=><button key={v} onClick={()=>setAnlFinView(v)} style={{background:anlFinView===v?"#10b981":t.inp,color:anlFinView===v?"#fff":t.sub,border:`1px solid ${anlFinView===v?"#10b981":t.border}`,borderRadius:20,padding:"5px 14px",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all 0.2s"}}>{label}</button>)}
      </div>
      <div className="crm-grid-4">
        <StatCard dm={dm} label="Gross Revenue"      value={inr(totalGrossRevenue)}     sub="before deductions"                                                         accent="#10b981"/>
        <StatCard dm={dm} label="Net Revenue"        value={inr(totalNetRevenue)}        sub={`−${inr(totalReplDeductions)} replacements`}                               accent="#3b82f6"/>
        <StatCard dm={dm} label="Total Outstanding"  value={inr(totalOutstanding)}       sub={`${customers.filter(c=>(c.pending||0)>0).length} customers owing`}          accent="#ef4444"/>
        <StatCard dm={dm} label="Total Collected"    value={inr(totalCustPaid)}          sub="all time"                                                                   accent="#8b5cf6"/>
      </div>
      <div className="crm-grid-4">
        <StatCard dm={dm} label="Supply Cost"        value={inr(totalSupplyCost)}        sub={`${filtSup.length} entries`}                                               accent="#6366f1"/>
        <StatCard dm={dm} label="Total Expenses"     value={inr(totalExpenses)}          sub={`${expCatData.length} categories`}                                         accent="#f97316"/>
        <StatCard dm={dm} label="Wastage Loss"       value={inr(totalWasteCost)}         sub="estimated cost"                                                             accent="#f59e0b"/>
        <StatCard dm={dm} label="Partial Collected"  value={inr(totalPartialCollected)}  sub={`${deliveriesWithBalance.length} pending balance`}                          accent="#0ea5e9"/>
      </div>
      {anlFinView==="summary"&&<Card dm={dm} className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p style={{color:t.text}} className="font-bold text-sm">💰 Financial Summary</p>
          <button onClick={()=>exportCSV([{gross:totalGrossRevenue,net:totalNetRevenue,outstanding:totalOutstanding,collected:totalCustPaid,supply:totalSupplyCost,expenses:totalExpenses,wastage:totalWasteCost,partial:totalPartialCollected}],"financial_summary",[{label:"Gross Revenue",key:"gross"},{label:"Net Revenue",key:"net"},{label:"Outstanding",key:"outstanding"},{label:"Collected",key:"collected"},{label:"Supply Cost",key:"supply"},{label:"Expenses",key:"expenses"},{label:"Wastage",key:"wastage"},{label:"Partial Collected",key:"partial"}])} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ CSV</button>
        </div>
        <div className="flex flex-col gap-2">
          {[{label:"Gross Revenue",val:totalGrossRevenue,c:"#10b981"},{label:"Replacement Deductions",val:-totalReplDeductions,c:"#f97316"},{label:"Net Revenue",val:totalNetRevenue,c:"#3b82f6"},{label:"Supply Cost",val:-totalSupplyCost,c:"#8b5cf6"},{label:"Expenses",val:-totalExpenses,c:"#ef4444"},{label:"Wastage Loss",val:-totalWasteCost,c:"#f59e0b"}].map(row=>(
            <div key={row.label} style={{background:t.inp,borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <p style={{color:t.text,fontSize:12,fontWeight:600}}>{row.label}</p>
              <p style={{color:row.val>=0?"#10b981":"#ef4444",fontWeight:700,fontSize:13}}>{row.val>=0?"+":""}{inr(Math.abs(row.val))}</p>
            </div>
          ))}
          <div style={{background:"rgba(59,130,246,0.1)",borderRadius:10,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",borderLeft:"3px solid #3b82f6"}}>
            <p style={{color:t.text,fontSize:13,fontWeight:800}}>Estimated Profit/Loss</p>
            <p style={{color:totalNetRevenue-totalSupplyCost-totalExpenses-totalWasteCost>=0?"#10b981":"#ef4444",fontWeight:900,fontSize:15}}>{inr(Math.abs(totalNetRevenue-totalSupplyCost-totalExpenses-totalWasteCost))}</p>
          </div>
        </div>
      </Card>}
      {anlFinView==="chart"&&<Card dm={dm} className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p style={{color:t.text}} className="font-bold text-sm">💰 Revenue vs Costs — 14 Days</p>
          <button onClick={()=>exportCSV(dailyData,"revenue_vs_costs_14d",[{label:"Date",key:"date"},{label:"Revenue",key:"revenue"},{label:"Expenses",key:"expenses"}])} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ CSV</button>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dailyData} margin={{top:4,right:4,left:-10,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false}/>
            <XAxis dataKey="date" tick={{fontSize:9,fill:t.sub}}/>
            <YAxis tick={{fontSize:9,fill:t.sub}} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:`${v}`}/>
            <Tooltip contentStyle={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,color:t.text,fontSize:11}} formatter={(v)=>[inr(v)]}/>
            <Legend wrapperStyle={{fontSize:10,paddingTop:6}}/>
            <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[3,3,0,0]}/>
            <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[3,3,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </Card>}
      {anlFinView==="expenses"&&expCatData.length>0&&<Card dm={dm} className="overflow-hidden">
        <div className="p-4 pb-2 flex items-center justify-between">
          <div><p style={{color:t.text}} className="font-bold text-sm">Expense Breakdown</p><p style={{color:t.sub}} className="text-[11px]">{inr(totalExpenses)} total</p></div>
          <button onClick={()=>exportCSV(expCatData,"expense_categories",[{label:"Category",key:"category"},{label:"Amount",key:"amount"},{label:"Count",key:"count"}])} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ CSV</button>
        </div>
        {expCatData.map((e,i)=>{
          const pct=totalExpenses>0?Math.round(e.amount/totalExpenses*100):0;
          return <div key={e.category} style={{borderTop:`1px solid ${t.border}`}} className="px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2"><div style={{width:8,height:8,borderRadius:2,background:PIE_COLORS[i%7]}}/><p style={{color:t.text,fontSize:12,fontWeight:600}}>{e.category}</p></div>
              <div className="text-right"><p className="text-sm font-bold text-red-400">{inr(e.amount)}</p><p style={{color:t.sub,fontSize:9}}>{pct}% · {e.count} entries</p></div>
            </div>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:t.border}}><div className="h-full rounded-full" style={{width:`${pct}%`,background:PIE_COLORS[i%7]}}/></div>
          </div>;
        })}
      </Card>}
      </>;
    })()}

    {/* ══════════ TRENDS SECTION ══════════ */}
    {anlActiveSection==="trends"&&<>
      <div style={{background:t.card,border:`1.5px solid ${t.border}`,borderRadius:14,padding:"14px 16px"}}>
        <p style={{color:t.text,fontWeight:800,fontSize:14,marginBottom:4}}>📈 Trend Explorer</p>
        <p style={{color:t.sub,fontSize:11,marginBottom:12}}>Compare metrics over 30 days broken into weekly buckets, or view the day-of-week distribution to find your best operating patterns.</p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
          {[["revenue","💰 Revenue"],["deliveries","🚚 Deliveries"],["expenses","💸 Expenses"]].map(([v,l])=>(
            <button key={v} onClick={()=>setAnlTrendMetric(v)} style={{background:anlTrendMetric===v?"#8b5cf6":t.inp,color:anlTrendMetric===v?"#fff":t.sub,border:`1px solid ${anlTrendMetric===v?"#8b5cf6":t.border}`,borderRadius:20,padding:"5px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>{l}</button>
          ))}
        </div>
        {(()=>{
          const weeks=Array.from({length:4},(_,wi)=>{
            const wDays=Array.from({length:7},(_,di)=>{const d=new Date();d.setDate(d.getDate()-(wi*7+di));return d.toISOString().slice(0,10);}).reverse();
            const label=`W${4-wi}: ${wDays[0].slice(5)} – ${wDays[6].slice(5)}`;
            const val=anlTrendMetric==="revenue"?deliveries.filter(d=>wDays.includes(d.date)&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0)
              :anlTrendMetric==="deliveries"?deliveries.filter(d=>wDays.includes(d.date)&&d.status==="Delivered").length
              :expenses.filter(e=>wDays.includes(e.date)).reduce((s,e)=>s+(e.amount||0),0);
            return {label,val};
          }).reverse();
          const maxVal=Math.max(...weeks.map(w=>w.val),1);
          const color=anlTrendMetric==="revenue"?"#10b981":anlTrendMetric==="deliveries"?"#f59e0b":"#8b5cf6";
          return <div>
            <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>4-Week Comparison</p>
            <div className="flex flex-col gap-3">
              {weeks.map((w,i)=>{
                const pct=Math.round(w.val/maxVal*100);
                return <div key={i}>
                  <div className="flex justify-between mb-1">
                    <span style={{color:t.text,fontSize:12,fontWeight:600}}>{w.label}</span>
                    <span style={{color,fontSize:12,fontWeight:800}}>{anlTrendMetric==="revenue"?inr(w.val):w.val}</span>
                  </div>
                  <div style={{height:10,borderRadius:6,background:t.inp,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:color,borderRadius:6,transition:"width 0.5s"}}/>
                  </div>
                </div>;
              })}
            </div>
          </div>;
        })()}
      </div>

      <Card dm={dm} className="p-4">
        <p style={{color:t.text,fontWeight:700,fontSize:13,marginBottom:4}}>📅 Revenue by Day of Week</p>
        <p style={{color:t.sub,fontSize:11,marginBottom:12}}>Best day: <strong style={{color:"#f59e0b"}}>{bestDow.day}</strong> · {inr(bestDow.revenue)}</p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={dowData} margin={{top:4,right:0,left:-20,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false}/>
            <XAxis dataKey="day" tick={{fontSize:11,fill:t.sub}}/>
            <YAxis tick={{fontSize:9,fill:t.sub}} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:`${v}`}/>
            <Tooltip contentStyle={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,color:t.text,fontSize:11}} formatter={(v,n)=>n==="Revenue"?[inr(v),n]:[v,n]}/>
            <Bar dataKey="revenue" name="Revenue" radius={[4,4,0,0]}>
              {dowData.map((entry,index)=><Cell key={index} fill={entry.revenue===Math.max(...dowData.map(d=>d.revenue))?"#f59e0b":dm?"#3a3a44":"#e2e4e8"}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card dm={dm} className="p-4">
        <p style={{color:t.text,fontWeight:700,fontSize:13,marginBottom:4}}>📦 Revenue Concentration (Pareto)</p>
        <p style={{color:t.sub,fontSize:11,marginBottom:10}}>Top {top20pct} customers ({Math.round(top20pct/Math.max(1,custRev.length)*100)}% of base) generate <strong style={{color:"#f59e0b"}}>{top20share}%</strong> of revenue</p>
        <div className="flex flex-col gap-2">
          {custRev.slice(0,8).map((c,i)=>{
            const pct=totalPortfolioRev>0?Math.round(c.totalRev/totalPortfolioRev*100):0;
            const colors=["#10b981","#f59e0b","#8b5cf6","#0ea5e9","#f97316","#ec4899","#ef4444","#6b7280"];
            return <div key={c.id}>
              <div className="flex justify-between mb-0.5">
                <span style={{color:t.text,fontSize:11,fontWeight:600}}>#{i+1} {c.name}</span>
                <span style={{color:colors[i],fontSize:11,fontWeight:700}}>{inr(c.totalRev)} · {pct}%</span>
              </div>
              <div style={{height:6,borderRadius:4,background:t.inp,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${pct}%`,background:colors[i],borderRadius:4,transition:"width 0.5s"}}/>
              </div>
            </div>;
          })}
        </div>
      </Card>

      <Card dm={dm} className="p-4">
        <p style={{color:t.text,fontWeight:700,fontSize:13,marginBottom:4}}>🔄 Period Summary Scorecard</p>
        <div className="crm-grid-2" style={{gap:12}}>
          {[
            {label:"Gross Revenue",       val:inr(totalGrossRevenue),  color:"#10b981",icon:"💰"},
            {label:"Net Revenue",         val:inr(totalNetRevenue),    color:"#059669",icon:"✅"},
            {label:"Total Expenses",      val:inr(totalExpenses),      color:"#ef4444",icon:"💸"},
            {label:"Wastage Cost",        val:inr(totalWasteCost),     color:"#f97316",icon:"🗑️"},
            {label:"Supply Cost",         val:inr(totalSupplyCost),    color:"#8b5cf6",icon:"📦"},
            {label:"Outstanding",         val:inr(totalOutstanding),   color:"#f59e0b",icon:"⏳"},
            {label:"Fulfillment Rate",    val:`${fulfillmentRate}%`,   color:fulfillmentRate>=90?"#10b981":"#f59e0b",icon:"🚚"},
            {label:"QC Pass Rate",        val:filtQC.length>0?`${qcPassRate}%`:"—", color:qcPassRate>=90?"#10b981":"#f59e0b",icon:"🧪"},
          ].map(x=>(
            <div key={x.label} style={{background:t.inp,borderRadius:12,padding:"12px 14px"}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>{x.icon} {x.label}</p>
              <p style={{color:x.color,fontWeight:900,fontSize:18,lineHeight:1.2,marginTop:4}}>{x.val}</p>
            </div>
          ))}
        </div>
      </Card>
    </>}

    {/* ── ACTIVITY LOG — always visible ── */}
    <Card dm={dm} className="overflow-hidden">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <p style={{color:t.text}} className="font-bold text-sm">Recent Activity Log</p>
        <span style={{color:t.sub,fontSize:11}}>{actLog.length} entries</span>
      </div>
      <Hr dm={dm}/>
      {actLog.length===0?<p style={{color:t.sub}} className="text-sm text-center py-5">No activity recorded yet.</p>
      :actLog.slice(0,20).map(a=>(
        <div key={a.id} style={{borderBottom:`1px solid ${t.border}`}} className="px-4 py-2.5 flex items-start justify-between gap-3 last:border-0">
          <div className="flex-1 min-w-0">
            <p style={{color:t.text,fontSize:12,fontWeight:600}}>{a.action}</p>
            <p style={{color:t.sub,fontSize:11}} className="truncate">{a.detail}</p>
          </div>
          <div className="text-right shrink-0">
            <p style={{color:t.sub,fontSize:10}}>{a.user}</p>
            <p style={{color:t.sub,fontSize:10}}>{a.ts}</p>
          </div>
        </div>
      ))}
    </Card>
  </>);
}
