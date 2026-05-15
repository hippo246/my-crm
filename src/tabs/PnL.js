/* eslint-disable */
import React, { useState, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, Cell, ReferenceLine } from "recharts";
import { inr, lineTotal, safeO, safeArr, today } from "../lib/utils";
import { Btn, Card, Hr, SectionHeader, TabStatCards } from "../components/ui";

/**
 * PnLTab — fully self-contained P&L tab component.
 * Props: deliveries, supplies, expenses, wastage, customers, products, prodTargets, t, dm, isAdmin, can
 */
export default function PnLTab({ deliveries, supplies, expenses, wastage, customers, products, prodTargets, t, dm, isAdmin, can, paymentLedger, exportCSV, setDetailModal, setTab, invRegistry }) {
  const [plPeriod, setPlPeriod] = useState("6m");
  const [plCustomFrom, setPlCustomFrom] = useState("");
  const [plCustomTo, setPlCustomTo] = useState(today());
  const [plMonthExpanded, setPlMonthExpanded] = useState(null);
  const [plMonthHovered, setPlMonthHovered] = useState(null);
  const [plCustExpanded, setPlCustExpanded] = useState(null);
  const [plCustHovered, setPlCustHovered] = useState(null);

  if (!isAdmin) return null;

  return ((() => {
// ── Compute date window ──────────────────────────────────────
const nowD=new Date();
let dateFrom, dateTo=today();
if(plPeriod==="1d"){const d=new Date(nowD);d.setDate(d.getDate()-1);dateFrom=d.toISOString().slice(0,10);}
else if(plPeriod==="1w"){const d=new Date(nowD);d.setDate(d.getDate()-6);dateFrom=d.toISOString().slice(0,10);}
else if(plPeriod==="1m"){const d=new Date(nowD);d.setMonth(d.getMonth()-1);dateFrom=d.toISOString().slice(0,10);}
else if(plPeriod==="2m"){const d=new Date(nowD);d.setMonth(d.getMonth()-2);dateFrom=d.toISOString().slice(0,10);}
else if(plPeriod==="3m"){const d=new Date(nowD);d.setMonth(d.getMonth()-3);dateFrom=d.toISOString().slice(0,10);}
else if(plPeriod==="6m"){const d=new Date(nowD);d.setMonth(d.getMonth()-6);dateFrom=d.toISOString().slice(0,10);}
else if(plPeriod==="12m"){const d=new Date(nowD);d.setFullYear(d.getFullYear()-1);dateFrom=d.toISOString().slice(0,10);}
else if(plPeriod==="custom"){dateFrom=plCustomFrom||today();dateTo=plCustomTo||today();}
else{const d=new Date(nowD);d.setMonth(d.getMonth()-6);dateFrom=d.toISOString().slice(0,10);}

// ── Build monthly buckets for charts ────────────────────────
const months=[];
const mCur=new Date(dateFrom.slice(0,7)+"-01");
const mEnd=new Date(dateTo.slice(0,7)+"-01");
while(mCur<=mEnd){months.push(mCur.toISOString().slice(0,7));mCur.setMonth(mCur.getMonth()+1);}
if(months.length===0) months.push(today().slice(0,7));

const mData=months.map(m=>({
  month:m.slice(5)+"/"+m.slice(2,4),
  rawMonth:m,
  monthFull:new Date(m+"-01").toLocaleString("en-IN",{month:"short",year:"numeric"}),
  revenue:deliveries.filter(d=>d.date?.startsWith(m)&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines)-(+d.replacement?.amount||0),0),
  supplyCost:supplies.filter(s=>s.date?.startsWith(m)).reduce((s,x)=>s+(x.cost||0),0),
  expenses:expenses.filter(e=>e.date?.startsWith(m)).reduce((s,e)=>s+(e.amount||0),0),
  wasteCost:(wastage||[]).filter(w=>w.date?.startsWith(m)).reduce((s,w)=>s+(w.cost||0),0),
  replDeducted:deliveries.filter(d=>d.date?.startsWith(m)&&d.status==="Delivered").reduce((s,d)=>s+(+d.replacement?.amount||0),0),
  deliveriesCount:deliveries.filter(d=>d.date?.startsWith(m)&&d.status==="Delivered").length,
  prodActual:(prodTargets||[]).filter(p=>p.date?.startsWith(m)).reduce((s,p)=>s+(+p.actual||0),0),
  prodTarget:(prodTargets||[]).filter(p=>p.date?.startsWith(m)).reduce((s,p)=>s+(+p.target||0),0),
  wastageQty:(wastage||[]).filter(w=>w.date?.startsWith(m)).reduce((s,w)=>s+(w.qty||0),0),
})).map(m=>({...m,totalCost:m.supplyCost+m.expenses+m.wasteCost,profit:m.revenue-m.supplyCost-m.expenses-m.wasteCost,margin:m.revenue>0?Math.round((m.revenue-m.supplyCost-m.expenses-m.wasteCost)/m.revenue*100):0,grossMargin:m.revenue>0?Math.round((m.revenue-m.supplyCost)/m.revenue*100):0,prodEfficiency:m.prodTarget>0?Math.round(m.prodActual/m.prodTarget*100):0}));

// ── Period-filtered totals ──────────────────────────────────
const filtD=deliveries.filter(d=>d.date>=dateFrom&&d.date<=dateTo&&d.status==="Delivered");
const filtS=supplies.filter(s=>s.date>=dateFrom&&s.date<=dateTo);
const filtE=expenses.filter(e=>e.date>=dateFrom&&e.date<=dateTo);
const filtW=(wastage||[]).filter(w=>w.date>=dateFrom&&w.date<=dateTo);
const totRev=filtD.reduce((s,d)=>s+lineTotal(d.orderLines)-(+d.replacement?.amount||0),0);
const totReplDeducted=filtD.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
const totSupC=filtS.reduce((s,x)=>s+(x.cost||0),0);
const totExpC=filtE.reduce((s,e)=>s+(e.amount||0),0);
const totWasteC=filtW.reduce((s,w)=>s+(w.cost||0),0);
const totCost=totSupC+totExpC+totWasteC;
const totProfit=totRev-totCost;
const totMargin=totRev>0?Math.round(totProfit/totRev*100):0;
const totDue=customers.reduce((s,c)=>s+(c.pending||0),0);
const totCollected=customers.reduce((s,c)=>s+(c.paid||0),0);
const collectionRate=totCollected+totDue>0?Math.round(totCollected/(totCollected+totDue)*100):100;

// MoM comparison
const lastM=mData[mData.length-1]||{revenue:0,profit:0,margin:0};
const prevM=mData[mData.length-2]||null;
const momRev=prevM&&prevM.revenue>0?Math.round((lastM.revenue-prevM.revenue)/prevM.revenue*100):null;
const momProfit=prevM&&prevM.profit!==0?Math.round((lastM.profit-prevM.profit)/Math.abs(prevM.profit)*100):null;

const activeMonths=mData.filter(m=>m.revenue>0);
const avgMonthlyRev=activeMonths.length>0?Math.round(totRev/activeMonths.length):0;
const avgMonthlyProfit=activeMonths.length>0?Math.round(totProfit/activeMonths.length):0;
const avgMonthlyCost=activeMonths.length>0?Math.round(totCost/activeMonths.length):0;
const bestMonth=mData.reduce((b,m)=>m.profit>b.profit?m:b,mData[0]||{profit:0,monthFull:"—",month:null,rawMonth:null});
const worstMonth=mData.reduce((b,m)=>m.profit<b.profit?m:b,mData[0]||{profit:0,monthFull:"—",month:null,rawMonth:null});

// ── Products sold in period ──────────────────────────────────────
const periodProdMap={};
filtD.forEach(d=>{Object.entries(safeO(d.orderLines)).forEach(([pid,l])=>{if(l.qty>0){if(!periodProdMap[pid])periodProdMap[pid]={name:l.name||products.find(p=>p.id===pid)?.name||pid,qty:0,rev:0};periodProdMap[pid].qty+=l.qty;periodProdMap[pid].rev+=(l.qty||0)*(l.priceAmount||0);}});});
const periodProdArr=Object.values(periodProdMap).sort((a,b)=>b.rev-a.rev);
const recentHalf=mData.slice(Math.floor(mData.length/2));
const olderHalf=mData.slice(0,Math.floor(mData.length/2));
const recentRevAvg=recentHalf.length>0?recentHalf.reduce((s,m)=>s+m.revenue,0)/recentHalf.length:0;
const olderRevAvg=olderHalf.length>0?olderHalf.reduce((s,m)=>s+m.revenue,0)/olderHalf.length:0;
const trendUp=recentRevAvg>=olderRevAvg;

const healthScore=Math.min(100,Math.max(0,
  (totMargin>=30?30:totMargin>=15?20:totMargin>=0?10:0)+
  (collectionRate>=95?25:collectionRate>=80?15:5)+
  (trendUp?20:0)+
  (totWasteC/Math.max(totCost,1)<0.05?15:totWasteC/Math.max(totCost,1)<0.15?10:0)+
  (activeMonths.length>=Math.round(months.length*0.7)?10:5)
));
const healthColor=healthScore>=75?"#10b981":healthScore>=50?"#f59e0b":"#ef4444";
const healthLabel=healthScore>=75?"Healthy":healthScore>=50?"Moderate":"Needs Attention";

const insights=[];
if(totMargin<15&&totRev>0) insights.push({icon:"⚠️",text:`Margin is ${totMargin}% — below the 15% healthy threshold. Review cost structure.`});
if(totMargin>=30) insights.push({icon:"✅",text:`Strong ${totMargin}% margin. Business is performing well above benchmark.`});
if(totDue>totRev*0.15) insights.push({icon:"🔴",text:`Outstanding dues (${inr(totDue)}) are ${Math.round(totDue/Math.max(totRev,1)*100)}% of revenue. Prioritise collection.`});
if(trendUp&&recentRevAvg>olderRevAvg*1.1) insights.push({icon:"📈",text:`Revenue growing — recent avg ${inr(Math.round(recentRevAvg))} vs ${inr(Math.round(olderRevAvg))} prior.`});
if(!trendUp&&olderRevAvg>recentRevAvg*1.1) insights.push({icon:"📉",text:`Revenue declining — recent avg ${inr(Math.round(recentRevAvg))} vs ${inr(Math.round(olderRevAvg))} prior.`});
if(totWasteC>totCost*0.1) insights.push({icon:"🗑️",text:`Wastage (${inr(totWasteC)}) is ${Math.round(totWasteC/Math.max(totCost,1)*100)}% of costs — worth reducing.`});

const cashCollected=customers.reduce((s,c)=>s+(c.paid||0),0);
const cashPending=customers.reduce((s,c)=>s+(c.pending||0),0);
const cashFlowPct=cashCollected+cashPending>0?Math.round(cashCollected/(cashCollected+cashPending)*100):100;
const burnRate=activeMonths.length>0?Math.round(totCost/activeMonths.length):0;
if(burnRate>0&&avgMonthlyRev<burnRate) insights.push({icon:"🔥",text:`Burn rate (${inr(burnRate)}/mo) exceeds avg revenue (${inr(avgMonthlyRev)}). Spending more than earning.`});
if(cashPending>cashCollected*0.3) insights.push({icon:"💸",text:`${inr(cashPending)} in uncollected cash. Accelerate collections.`});

const PL_PERIODS=[["1d","Day"],["1w","Week"],["1m","Month"],["2m","2M"],["3m","3M"],["6m","6M"],["12m","12M"],["custom","Custom ✦"]];
const periodLabel=plPeriod==="custom"?`${plCustomFrom||"—"} → ${plCustomTo}`:PL_PERIODS.find(p=>p[0]===plPeriod)?.[1]||"";

// ── Forecasting: simple linear regression on mData ──────────────
const forecastMonths=[];
if(mData.length>=2){
  const n=mData.length;
  const xMean=(n-1)/2;
  const yRevMean=mData.reduce((s,m)=>s+m.revenue,0)/n;
  const yProfMean=mData.reduce((s,m)=>s+m.profit,0)/n;
  const yCostMean=mData.reduce((s,m)=>s+m.totalCost,0)/n;
  const ssXX=mData.reduce((_s,_,i)=>_s+(i-xMean)**2,0);
  const slopeRev=mData.reduce((_s,m,i)=>_s+(i-xMean)*(m.revenue-yRevMean),0)/ssXX;
  const slopeProf=mData.reduce((_s,m,i)=>_s+(i-xMean)*(m.profit-yProfMean),0)/ssXX;
  const slopeCost=mData.reduce((_s,m,i)=>_s+(i-xMean)*(m.totalCost-yCostMean),0)/ssXX;
  for(let fi=1;fi<=3;fi++){
    const xi=n-1+fi;
    const fDate=new Date(mData[n-1].rawMonth+"-01");
    fDate.setMonth(fDate.getMonth()+fi);
    const fRev=Math.max(0,Math.round(yRevMean+slopeRev*(xi-xMean)));
    const fCost=Math.max(0,Math.round(yCostMean+slopeCost*(xi-xMean)));
    const fProfit=Math.round(yProfMean+slopeProf*(xi-xMean));
    forecastMonths.push({monthFull:fDate.toLocaleString("en-IN",{month:"short",year:"numeric"}),revenue:fRev,totalCost:fCost,profit:fProfit,margin:fRev>0?Math.round(fProfit/fRev*100):0,forecast:true});
  }
}
const chartDataWithForecast=[...mData,...forecastMonths];

// ── Profitability by product ─────────────────────────────────────
const prodProfitMap={};
filtD.forEach(d=>{
  Object.entries(safeO(d.orderLines)).forEach(([pid,l])=>{
    if(l.qty>0){
      if(!prodProfitMap[pid])prodProfitMap[pid]={name:l.name||products.find(p=>p.id===pid)?.name||pid,qty:0,rev:0,supplyCost:0};
      prodProfitMap[pid].qty+=l.qty;
      prodProfitMap[pid].rev+=(l.qty||0)*(l.priceAmount||0);
    }
  });
});
// Distribute supply costs proportionally to revenue
Object.values(prodProfitMap).forEach(p=>{
  p.supplyCost=totRev>0?Math.round(totSupC*(p.rev/totRev)):0;
  p.profit=p.rev-p.supplyCost;
  p.margin=p.rev>0?Math.round(p.profit/p.rev*100):0;
});
const prodProfitArr=Object.values(prodProfitMap).sort((a,b)=>b.profit-a.profit);

return <div style={{display:"flex",flexDirection:"column",gap:28}}>
  {/* ── P&L TAB HEADER ── */}
  <SectionHeader dm={dm} title="Profit & Loss" sub={`${periodLabel} · ${healthLabel} · ${healthScore}/100`}
    cta={null}/>

  {/* ══════════════════════════════════════════════════════
      FEATURE 1: EXECUTIVE SUMMARY PANEL
  ══════════════════════════════════════════════════════ */}
  <div style={{background:dm?"linear-gradient(135deg,#0a1628,#0d1f0d,#1a0a05)":"linear-gradient(135deg,#eff6ff,#f0fdf4,#fff7ed)",border:dm?"1px solid rgba(99,102,241,0.25)":"1px solid #c7d2fe",borderRadius:20,padding:"18px 20px",position:"relative",overflow:"hidden"}}>
    {/* Background glow */}
    <div style={{position:"absolute",top:-40,right:-40,width:160,height:160,borderRadius:"50%",background:totProfit>=0?"rgba(16,185,129,0.08)":"rgba(239,68,68,0.08)",pointerEvents:"none"}}/>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,gap:8,flexWrap:"wrap"}}>
      <div>
        <p style={{color:dm?"#a5b4fc":"#4f46e5",fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:4}}>Executive Summary</p>
        <p style={{color:dm?"#f1f5f9":"#0f172a",fontSize:16,fontWeight:900,lineHeight:1.2}}>{periodLabel} · {healthLabel}</p>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6,background:healthColor+"20",border:`1.5px solid ${healthColor}50`,borderRadius:12,padding:"8px 14px"}}>
        <div style={{width:10,height:10,borderRadius:"50%",background:healthColor,boxShadow:`0 0 8px ${healthColor}`}}/>
        <span style={{color:healthColor,fontWeight:900,fontSize:14}}>{healthScore}/100</span>
      </div>
    </div>
    {/* Signal pills row */}
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
      {[
        {label:"Revenue",val:inr(totRev),change:momRev,icon:"💰",good:true},
        {label:"Profit",val:inr(totProfit),change:momProfit,icon:totProfit>=0?"📈":"📉",good:totProfit>=0},
        {label:"Margin",val:`${totMargin}%`,change:null,icon:"📊",good:totMargin>=15},
        {label:"Collections",val:`${collectionRate}%`,change:null,icon:"💳",good:collectionRate>=85},
        {label:"Wastage",val:inr(totWasteC),change:null,icon:"🗑️",good:totWasteC/Math.max(totCost,1)<0.1},
      ].map(s=>{
        const isGood=s.good;
        const bg=isGood?(dm?"rgba(16,185,129,0.12)":"rgba(16,185,129,0.08)"):(dm?"rgba(239,68,68,0.12)":"rgba(239,68,68,0.08)");
        const border=isGood?"rgba(16,185,129,0.3)":"rgba(239,68,68,0.3)";
        const col=isGood?"#10b981":"#ef4444";
        return(
          <div key={s.label} style={{background:bg,border:`1px solid ${border}`,borderRadius:12,padding:"8px 14px",display:"flex",flexDirection:"column",gap:2,minWidth:90}}>
            <span style={{color:dm?"#94a3b8":"#64748b",fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>{s.icon} {s.label}</span>
            <span style={{color:col,fontSize:15,fontWeight:900,lineHeight:1}}>{s.val}</span>
            {s.change!==null&&<span style={{color:s.change>=0?"#10b981":"#ef4444",fontSize:10,fontWeight:700}}>{s.change>=0?"▲":"▼"}{Math.abs(s.change)}% MoM</span>}
          </div>
        );
      })}
    </div>
    {/* One-line narrative */}
    <div style={{background:dm?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)",borderRadius:10,padding:"10px 14px",borderLeft:`3px solid ${healthColor}`}}>
      <p style={{color:dm?"#cbd5e1":"#334155",fontSize:12,lineHeight:1.7,fontStyle:"italic"}}>
        {(()=>{
          const parts=[];
          if(totProfit>=0) parts.push(`Business is ${trendUp?"growing":"stable"} with ${totMargin}% net margin`);
          else parts.push(`Business is running at a loss — costs exceed revenue by ${inr(Math.abs(totProfit))}`);
          if(momRev!==null) parts.push(`revenue ${momRev>=0?"up":"down"} ${Math.abs(momRev)}% month-over-month`);
          if(collectionRate<85) parts.push(`collections need attention at ${collectionRate}%`);
          else parts.push(`collections healthy at ${collectionRate}%`);
          if(totWasteC>totCost*0.1) parts.push(`wastage is elevated at ${inr(totWasteC)}`);
          return parts.join(", ")+".";
        })()}
      </p>
    </div>
  </div>

  {/* ══════════════════════════════════════════════════════
      FEATURE 2: FORECASTING & PROJECTION
  ══════════════════════════════════════════════════════ */}
  {forecastMonths.length>0&&(
    <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:20,overflow:"hidden"}}>
      <div style={{padding:"14px 18px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
        <div>
          <p style={{color:t.text,fontWeight:800,fontSize:13}}>🔮 3-Month Forecast</p>
          <p style={{color:t.sub,fontSize:11,marginTop:2}}>Linear projection based on {mData.length} months of data · shaded = forecast</p>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {forecastMonths.map(f=>(
            <div key={f.monthFull} style={{background:f.profit>=0?"rgba(16,185,129,0.1)":"rgba(239,68,68,0.1)",border:`1px solid ${f.profit>=0?"rgba(16,185,129,0.3)":"rgba(239,68,68,0.3)"}`,borderRadius:10,padding:"6px 12px",textAlign:"center"}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase"}}>{f.monthFull}</p>
              <p style={{color:"#10b981",fontWeight:800,fontSize:12}}>{inr(f.revenue)}</p>
              <p style={{color:f.profit>=0?"#10b981":"#ef4444",fontWeight:700,fontSize:11}}>{f.profit>=0?"":"−"}{inr(Math.abs(f.profit))} <span style={{color:t.sub,fontWeight:400}}>profit</span></p>
              <p style={{color:t.sub,fontSize:9}}>{f.margin}% margin</p>
            </div>
          ))}
        </div>
      </div>
      <div style={{padding:"16px 18px"}}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartDataWithForecast} margin={{top:4,right:4,left:-10,bottom:0}} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false}/>
            <XAxis dataKey="monthFull" tick={{fontSize:9,fill:t.sub}}/>
            <YAxis tick={{fontSize:9,fill:t.sub}} tickFormatter={v=>v>=1000?`₹${(v/1000).toFixed(0)}k`:`₹${v}`}/>
            <Tooltip contentStyle={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,color:t.text,fontSize:11}}
              formatter={(v,n,p)=>[inr(v),p.payload?.forecast?`${n} (forecast)`:n]}/>
            <Legend wrapperStyle={{fontSize:10,paddingTop:6}}/>
            <Bar dataKey="revenue" name="Revenue" radius={[3,3,0,0]}>
              {chartDataWithForecast.map((entry,index)=>(
                <Cell key={index} fill={entry.forecast?"#10b98155":"#10b981"} stroke={entry.forecast?"#10b981":"none"} strokeDasharray={entry.forecast?"4 2":"0"}/>
              ))}
            </Bar>
            <Bar dataKey="profit" name="Profit" radius={[3,3,0,0]}>
              {chartDataWithForecast.map((entry,index)=>(
                <Cell key={index} fill={entry.forecast?(entry.profit>=0?"#f59e0b55":"#ef444455"):(entry.profit>=0?"#f59e0b":"#ef4444")} stroke={entry.forecast?(entry.profit>=0?"#f59e0b":"#ef4444"):"none"} strokeDasharray={entry.forecast?"4 2":"0"}/>
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p style={{color:t.sub,fontSize:10,textAlign:"center",marginTop:4}}>⚠️ Forecast is based on past trends only — actual results may vary</p>
      </div>
    </div>
  )}

  {/* ══════════════════════════════════════════════════════
      FEATURE 3: SCENARIO SIMULATOR
  ══════════════════════════════════════════════════════ */}
  {(()=>{
    const [simWaste,setSimWaste]=React.useState(0);
    const [simExp,setSimExp]=React.useState(0);
    const [simRev,setSimRev]=React.useState(0);
    const simAdjWaste=totWasteC*(1-simWaste/100);
    const simAdjExp=totExpC*(1+simExp/100);
    const simAdjRev=totRev*(1+simRev/100);
    const simCost=totSupC+simAdjExp+simAdjWaste;
    const simProfit=simAdjRev-simCost;
    const simMargin=simAdjRev>0?Math.round(simProfit/simAdjRev*100):0;
    const profitDelta=simProfit-totProfit;
    return(
      <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:20,overflow:"hidden"}}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${t.border}`}}>
          <p style={{color:t.text,fontWeight:800,fontSize:13}}>🧮 Scenario Simulator</p>
          <p style={{color:t.sub,fontSize:11,marginTop:2}}>Adjust sliders to see how changes affect profit</p>
        </div>
        <div style={{padding:"16px 18px",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(260px,100%),1fr))",gap:16}}>
          {/* Sliders */}
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {[
              {label:"Reduce Wastage",val:simWaste,set:setSimWaste,color:"#f97316",icon:"🗑️",unit:"%",min:0,max:100,hint:`Saves ${inr(Math.round(totWasteC*simWaste/100))}`},
              {label:"Increase Revenue",val:simRev,set:setSimRev,color:"#10b981",icon:"💰",unit:"%",min:0,max:100,hint:`+${inr(Math.round(totRev*simRev/100))}`},
              {label:"Expense Change",val:simExp,set:setSimExp,color:"#ef4444",icon:"💸",unit:"%",min:-50,max:100,hint:simExp>=0?`Costs +${inr(Math.round(totExpC*simExp/100))}`:`Saves ${inr(Math.round(totExpC*Math.abs(simExp)/100))}`},
            ].map(s=>(
              <div key={s.label}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{color:t.text,fontSize:12,fontWeight:700}}>{s.icon} {s.label}</span>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{color:s.color,fontSize:12,fontWeight:900}}>{s.val>=0?"+":""}{s.val}{s.unit}</span>
                    <span style={{color:t.sub,fontSize:10}}>{s.hint}</span>
                  </div>
                </div>
                <input type="range" min={s.min} max={s.max} value={s.val}
                  onChange={e=>s.set(+e.target.value)}
                  style={{width:"100%",accentColor:s.color,cursor:"pointer",height:4}}/>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:2}}>
                  <span style={{color:t.sub,fontSize:9}}>{s.min}{s.unit}</span>
                  <span style={{color:t.sub,fontSize:9}}>{s.max}{s.unit}</span>
                </div>
              </div>
            ))}
            <button onClick={()=>{setSimWaste(0);setSimExp(0);setSimRev(0);}}
              style={{background:t.inp,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 14px",fontSize:11,fontWeight:700,color:t.sub,cursor:"pointer",alignSelf:"flex-start"}}>
              Reset
            </button>
          </div>
          {/* Result panel */}
          <div style={{background:profitDelta>=0?(dm?"rgba(16,185,129,0.08)":"rgba(16,185,129,0.06)"):(dm?"rgba(239,68,68,0.08)":"rgba(239,68,68,0.06)"),border:`1.5px solid ${profitDelta>=0?"rgba(16,185,129,0.3)":"rgba(239,68,68,0.3)"}`,borderRadius:16,padding:"16px"}}>
            <p style={{color:t.sub,fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12}}>Projected Result</p>
            {[
              {label:"Revenue",orig:totRev,sim:simAdjRev,color:"#10b981"},
              {label:"Total Cost",orig:totCost,sim:simCost,color:"#ef4444"},
              {label:"Net Profit",orig:totProfit,sim:simProfit,color:simProfit>=0?"#10b981":"#ef4444",big:true},
              {label:"Margin",orig:`${totMargin}%`,sim:`${simMargin}%`,color:simMargin>=15?"#10b981":"#ef4444"},
            ].map(r=>(
              <div key={r.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${t.border}`}}>
                <span style={{color:t.sub,fontSize:11,fontWeight:r.big?700:400}}>{r.label}</span>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{color:t.sub,fontSize:10,textDecoration:"line-through"}}>{typeof r.orig==="number"?inr(r.orig):r.orig}</span>
                  <span style={{color:r.color,fontSize:r.big?17:13,fontWeight:r.big?900:700}}>→ {typeof r.sim==="number"?inr(r.sim):r.sim}</span>
                </div>
              </div>
            ))}
            <div style={{marginTop:12,padding:"10px 12px",background:profitDelta>=0?"rgba(16,185,129,0.1)":"rgba(239,68,68,0.1)",borderRadius:10,textAlign:"center"}}>
              <p style={{color:profitDelta>=0?"#10b981":"#ef4444",fontSize:14,fontWeight:900}}>{profitDelta>=0?"▲ Profit improves by ":"▼ Profit drops by "}{inr(Math.abs(profitDelta))}</p>
              <p style={{color:t.sub,fontSize:10,marginTop:3}}>vs current {inr(totProfit)} profit</p>
            </div>
          </div>
        </div>
      </div>
    );
  })()}

  {/* ══════════════════════════════════════════════════════
      FEATURE 4: PROFITABILITY BY PRODUCT
  ══════════════════════════════════════════════════════ */}
  {prodProfitArr.length>0&&(
    <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:20,overflow:"hidden"}}>
      <div style={{padding:"14px 18px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
        <div>
          <p style={{color:t.text,fontWeight:800,fontSize:13}}>📦 Profitability by Product</p>
          <p style={{color:t.sub,fontSize:11,marginTop:2}}>Supply cost distributed proportionally · {prodProfitArr.length} SKUs · {periodLabel}</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <span style={{background:"#10b98115",color:"#10b981",borderRadius:8,padding:"3px 10px",fontSize:10,fontWeight:700,border:"1px solid rgba(16,185,129,0.2)"}}>
            Top: {prodProfitArr[0]?.name}
          </span>
          {prodProfitArr[prodProfitArr.length-1]?.margin<0&&(
            <span style={{background:"#ef444415",color:"#ef4444",borderRadius:8,padding:"3px 10px",fontSize:10,fontWeight:700,border:"1px solid rgba(239,68,68,0.2)"}}>
              ⚠️ Loss-makers detected
            </span>
          )}
        </div>
      </div>
      <div style={{padding:"12px 0"}}>
        {prodProfitArr.map((p,pi)=>{
          const isLoss=p.profit<0;
          const barPct=prodProfitArr[0].rev>0?Math.round(p.rev/prodProfitArr[0].rev*100):0;
          const barColor=isLoss?"#ef4444":p.margin>=30?"#10b981":p.margin>=15?"#f59e0b":"#3b82f6";
          return(
            <div key={p.name} style={{padding:"10px 18px",borderBottom:pi<prodProfitArr.length-1?`1px solid ${t.border}`:"none"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
                  <div style={{width:26,height:26,borderRadius:8,background:barColor+"20",color:barColor,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:11,flexShrink:0}}>{pi+1}</div>
                  <div style={{minWidth:0}}>
                    <p style={{color:t.text,fontWeight:700,fontSize:12,lineHeight:1}}>{p.name}</p>
                    <p style={{color:t.sub,fontSize:10,marginTop:2}}>{p.qty} units · {inr(p.rev)} revenue</p>
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <p style={{color:isLoss?"#ef4444":"#10b981",fontWeight:900,fontSize:13,lineHeight:1}}>{isLoss?"−":""}{inr(Math.abs(p.profit))}</p>
                  <p style={{color:t.sub,fontSize:10,marginTop:2}}>
                    <span style={{background:barColor+"20",color:barColor,borderRadius:6,padding:"1px 6px",fontWeight:800}}>{p.margin}%</span>
                  </p>
                </div>
              </div>
              <div style={{height:5,background:t.border,borderRadius:5,overflow:"hidden"}}>
                <div style={{width:`${barPct}%`,background:isLoss?"linear-gradient(90deg,#ef4444,#f87171)":p.margin>=30?"linear-gradient(90deg,#10b981,#34d399)":p.margin>=15?"linear-gradient(90deg,#f59e0b,#fbbf24)":"linear-gradient(90deg,#3b82f6,#60a5fa)",height:"100%",borderRadius:5,transition:"width 0.5s ease"}}/>
              </div>
              {isLoss&&<p style={{color:"#ef4444",fontSize:10,marginTop:4}}>⚠️ This product is costing more than it earns — review pricing or supply costs</p>}
            </div>
          );
        })}
      </div>
    </div>
  )}
  <TabStatCards dm={dm} cards={[
    {icon:totProfit>=0?"📈":"📉",label:"Net Profit",value:inr(totProfit),sub:`${totMargin}% margin`,iconBg:totProfit>=0?t.statIcon2:t.statIcon5},
    {icon:"💰",label:"Revenue",value:inr(totRev),sub:`${filtD.length} deliveries`,iconBg:t.statIcon2},
    {icon:"📦",label:"Supply Cost",value:inr(totSupC),sub:`${filtS.length} entries`,iconBg:t.statIcon4},
    {icon:"💸",label:"Op. Expenses",value:inr(totExpC),sub:`${filtE.length} entries`,iconBg:t.statIcon5},
    {icon:"🗑️",label:"Wastage Cost",value:inr(totWasteC),sub:`${filtW.length} entries`,iconBg:t.statIcon3},
  ]}/>
  {/* ══════════════════════════════════════════════════════
      P&L PERIOD SELECTOR
  ══════════════════════════════════════════════════════ */}
  <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,overflow:"hidden"}}>
    {/* Period pills */}
    <div style={{padding:"12px 16px",display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",borderBottom:plPeriod==="custom"?`1px solid ${t.border}`:"none"}}>
      <span style={{color:t.sub,fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.07em",marginRight:2}}>Period</span>
      {PL_PERIODS.map(([v,l])=>(
        <button key={v} onClick={()=>setPlPeriod(v)}
          style={plPeriod===v
            ?{background:"#2563eb",color:"#fff",borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:800,border:"none",cursor:"pointer"}
            :{background:t.inp,color:t.sub,borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:600,border:`1.5px solid ${t.border}`,cursor:"pointer"}}>{l}
        </button>
      ))}
      <div style={{marginLeft:"auto",display:"flex",gap:8}}>
        <Btn dm={dm} v="outline" size="sm" onClick={()=>exportCSV(mData,"pl_report",[{label:"Month",key:"monthFull"},{label:"Revenue",key:"revenue"},{label:"Supply Cost",key:"supplyCost"},{label:"Expenses",key:"expenses"},{label:"Waste Cost",key:"wasteCost"},{label:"Total Cost",key:"totalCost"},{label:"Profit/Loss",key:"profit"},{label:"Margin %",key:"margin"},{label:"Deliveries",key:"deliveriesCount"}])}>📊 CSV</Btn>
      </div>
    </div>
    {/* Custom date range — inline below pills */}
    {plPeriod==="custom"&&(
      <div style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <span style={{color:t.sub,fontSize:12,fontWeight:700}}>From</span>
        <input type="date" value={plCustomFrom} onChange={e=>setPlCustomFrom(e.target.value)}
          style={{background:t.inp,border:`1.5px solid ${t.border}`,borderRadius:10,padding:"6px 12px",fontSize:13,color:t.text,outline:"none",cursor:"pointer"}}/>
        <span style={{color:t.sub,fontSize:13,fontWeight:700}}>→</span>
        <input type="date" value={plCustomTo} max={today()} onChange={e=>setPlCustomTo(e.target.value)}
          style={{background:t.inp,border:`1.5px solid ${t.border}`,borderRadius:10,padding:"6px 12px",fontSize:13,color:t.text,outline:"none",cursor:"pointer"}}/>
        {plCustomFrom&&plCustomTo&&(
          <span style={{background:t.accentLight,color:t.accent,borderRadius:20,padding:"4px 12px",fontSize:11,fontWeight:800}}>
            ✓ {Math.round((new Date(plCustomTo)-new Date(plCustomFrom))/86400000)+1} days
          </span>
        )}
      </div>
    )}
  </div>

  {/* ══════════════════════════════════════════════════════
      INCOME STATEMENT — Classic P&L layout
  ══════════════════════════════════════════════════════ */}
  <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:20,overflow:"hidden",boxShadow:dm?"0 2px 16px rgba(0,0,0,0.35)":"0 2px 10px rgba(0,0,0,0.05)"}}>
    {/* Statement header */}
    <div style={{padding:"14px 20px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div>
        <p style={{color:t.text,fontWeight:800,fontSize:13}}>📋 Income Statement</p>
        <p style={{color:t.sub,fontSize:11,marginTop:2}}>{periodLabel} · all figures INR</p>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,background:healthColor+"15",border:`1px solid ${healthColor}35`,borderRadius:12,padding:"6px 14px"}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:healthColor}}/>
        <span style={{color:healthColor,fontWeight:800,fontSize:12}}>{healthLabel} · {healthScore}/100</span>
      </div>
    </div>
    <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:0}}>
      {/* Revenue line */}
      {[
        {label:"Gross Revenue",val:totRev+(totReplDeducted||0),color:"#10b981",indent:0,bold:false,border:false},
        ...(totReplDeducted>0?[{label:"(−) Replacement Deductions",val:-totReplDeducted,color:"#f97316",indent:1,bold:false,border:false}]:[]),
        {label:"Net Revenue",val:totRev,color:"#10b981",indent:0,bold:true,border:true},
        {label:"(−) Supply Costs",val:-totSupC,color:"#8b5cf6",indent:1,bold:false,border:false},
        {label:"(−) Operating Expenses",val:-totExpC,color:"#ef4444",indent:1,bold:false,border:false},
        {label:"(−) Wastage Losses",val:-totWasteC,color:"#f97316",indent:1,bold:false,border:false},
        {label:"Total Costs",val:-totCost,color:"#ef4444",indent:0,bold:true,border:true},
        {label:totProfit>=0?"Net Profit":"Net Loss",val:totProfit,color:totProfit>=0?"#10b981":"#ef4444",indent:0,bold:true,border:true,big:true},
      ].map((row,ri)=>(
        <div key={ri} style={{
          display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:`${row.big?"14px":"9px"} 12px`,
          paddingLeft:row.indent?28:12,
          borderTop:row.border?`2px solid ${t.border}`:"none",
          marginTop:row.border?4:0,
          background:row.big?(row.val>=0?"rgba(16,185,129,0.06)":"rgba(239,68,68,0.06)"):"transparent",
          borderRadius:row.big?12:0,
        }}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {row.indent>0&&<span style={{color:t.border,fontSize:10}}>└</span>}
            <span style={{color:row.bold?t.text:t.sub,fontSize:row.big?14:12,fontWeight:row.big?900:row.bold?700:400}}>{row.label}</span>
          </div>
          <span style={{color:row.color,fontSize:row.big?20:13,fontWeight:row.big?900:row.bold?800:500,letterSpacing:row.big?"-0.02em":"0"}}>
            {row.val<0?`(${inr(Math.abs(row.val))})`:inr(Math.abs(row.val))}
          </span>
        </div>
      ))}
      {/* Margin strip */}
      {totRev>0&&(
        <div style={{marginTop:12,padding:"10px 12px",background:t.inp,borderRadius:12,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          {[
            {label:"Net Margin",val:`${totMargin}%`,color:totMargin>=30?"#10b981":totMargin>=15?"#f59e0b":"#ef4444"},
            {label:"Gross Margin",val:`${mData.length>0?Math.round(mData.reduce((s,m)=>s+m.grossMargin,0)/mData.length):0}%`,color:"#8b5cf6"},
            {label:"Cost Ratio",val:`${totRev>0?Math.round(totCost/totRev*100):0}%`,color:"#ef4444"},
            {label:"Expense Ratio",val:`${totRev>0?Math.round(totExpC/totRev*100):0}%`,color:"#f97316"},
          ].map(m=>(
            <div key={m.label} style={{display:"flex",flexDirection:"column",alignItems:"center",flex:1,minWidth:60}}>
              <span style={{color:m.color,fontWeight:900,fontSize:15}}>{m.val}</span>
              <span style={{color:t.sub,fontSize:9,fontWeight:600,marginTop:2,textTransform:"uppercase",letterSpacing:"0.05em"}}>{m.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
    {/* Revenue allocation bar */}
    {totRev>0&&(
      <div style={{padding:"0 20px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
          <span style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>Where revenue goes</span>
          <span style={{color:t.sub,fontSize:10}}>{inr(totRev)}</span>
        </div>
        <div style={{height:14,borderRadius:14,overflow:"hidden",display:"flex",gap:1}}>
          <div title={`Profit ${Math.max(0,totMargin)}%`} style={{width:`${Math.max(0,Math.round(totProfit/totRev*100))}%`,background:"linear-gradient(90deg,#10b981,#34d399)",borderRadius:"14px 0 0 14px",transition:"width .7s ease"}}/>
          <div title={`Supply ${Math.round(totSupC/totRev*100)}%`} style={{width:`${Math.round(totSupC/totRev*100)}%`,background:"#8b5cf6"}}/>
          <div title={`Expenses ${Math.round(totExpC/totRev*100)}%`} style={{width:`${Math.round(totExpC/totRev*100)}%`,background:"#ef4444"}}/>
          <div title={`Waste ${Math.round(totWasteC/totRev*100)}%`} style={{width:`${Math.round(totWasteC/totRev*100)}%`,background:"#f97316",borderRadius:"0 14px 14px 0"}}/>
        </div>
        <div style={{display:"flex",gap:16,marginTop:8,flexWrap:"wrap"}}>
          {[["#10b981","Profit ✓",Math.max(0,totMargin)],["#8b5cf6","Supply",Math.round(totSupC/totRev*100)],["#ef4444","Expenses",Math.round(totExpC/totRev*100)],["#f97316","Waste",Math.round(totWasteC/totRev*100)]].map(([c,l,p])=>(
            <span key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:t.sub}}>
              <span style={{width:9,height:9,borderRadius:2,background:c,display:"inline-block"}}/>
              {l} <strong style={{color:c}}>{p}%</strong>
            </span>
          ))}
        </div>
      </div>
    )}
  </div>

  {/* ══════════════════════════════════════════════════════
      6 KEY METRIC TILES
  ══════════════════════════════════════════════════════ */}
  <div className="crm-grid-3" style={{gap:10}}>
    {[
      {label:"Net Revenue",val:inr(totRev),sub:momRev!==null?`${momRev>=0?"▲":"▼"}${Math.abs(momRev)}% vs last month`:totReplDeducted>0?`After ${inr(totReplDeducted)} replacements`:`${filtD.length} deliveries`,color:"#10b981",icon:"💰"},
      {label:"Total Costs",val:inr(totCost),sub:`avg ${inr(avgMonthlyCost)}/mo`,color:"#ef4444",icon:"💸"},
      {label:"Net Profit",val:inr(totProfit),sub:`${totMargin}% net margin`,color:totProfit>=0?"#10b981":"#ef4444",icon:totProfit>=0?"📈":"📉"},
      {label:"Collection Rate",val:`${collectionRate}%`,sub:`${inr(totDue)} outstanding`,color:collectionRate>=90?"#10b981":collectionRate>=70?"#f59e0b":"#ef4444",icon:"💳"},
      {label:"Avg Monthly Rev",val:inr(avgMonthlyRev),sub:`avg profit ${inr(avgMonthlyProfit)}/mo`,color:"#f59e0b",icon:"📅"},
      {label:"Burn Rate",val:inr(burnRate),sub:burnRate>avgMonthlyRev?"⚠️ Exceeds revenue":"Within revenue",color:burnRate>avgMonthlyRev?"#ef4444":"#10b981",icon:"🔥"},
    ].map(x=>(
      <div key={x.label}
        style={{background:t.inp,border:`1px solid ${t.border}`,borderRadius:16,padding:"13px 14px",cursor:"default",transition:"all .18s"}}
        onMouseEnter={ev=>{ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.boxShadow=`0 6px 20px ${x.color}22`;ev.currentTarget.style.borderColor=x.color+"40";}}
        onMouseLeave={ev=>{ev.currentTarget.style.transform="none";ev.currentTarget.style.boxShadow="none";ev.currentTarget.style.borderColor=t.border;}}>
        <p style={{color:t.sub,fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>{x.icon} {x.label}</p>
        <p style={{color:x.color,fontSize:17,fontWeight:900,lineHeight:1,letterSpacing:"-0.02em"}}>{x.val}</p>
        <p style={{color:t.sub,fontSize:10,marginTop:5,lineHeight:1.3}}>{x.sub}</p>
      </div>
    ))}
  </div>

  {/* ══════════════════════════════════════════════════════
      SMART INSIGHTS — always expanded, colour coded
  ══════════════════════════════════════════════════════ */}
  {insights.length>0&&(
    <div style={{background:t.card,border:`1.5px solid ${t.border}`,borderRadius:18,padding:"16px 18px"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
        <span style={{fontSize:16}}>💡</span>
        <p style={{color:t.text,fontWeight:800,fontSize:13}}>Smart Insights</p>
        <span style={{background:"rgba(59,130,246,0.12)",color:"#3b82f6",borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:800,border:"1px solid rgba(59,130,246,0.25)"}}>{insights.length}</span>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {insights.map((ins,i)=>{
          const isBad=ins.icon==="⚠️"||ins.icon==="🔴"||ins.icon==="📉"||ins.icon==="🔥"||ins.icon==="💸";
          const isGood=ins.icon==="✅"||ins.icon==="📈";
          const bc=isBad?"rgba(239,68,68,0.08)":isGood?"rgba(16,185,129,0.08)":"rgba(245,158,11,0.08)";
          const brd=isBad?"rgba(239,68,68,0.2)":isGood?"rgba(16,185,129,0.2)":"rgba(245,158,11,0.2)";
          return(
            <div key={i} style={{background:bc,border:`1px solid ${brd}`,borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"flex-start",gap:10}}>
              <span style={{fontSize:16,flexShrink:0,lineHeight:1.3}}>{ins.icon}</span>
              <p style={{color:t.text,fontSize:12,lineHeight:1.6}}>{ins.text}</p>
            </div>
          );
        })}
      </div>
      {/* Recommended Actions */}
      <div style={{background:"rgba(59,130,246,0.07)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:12,padding:"10px 14px",marginTop:10}}>
        <p style={{color:"#3b82f6",fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Recommended Actions</p>
        {totProfit<0&&<p style={{color:t.text,fontSize:11,lineHeight:1.6,marginBottom:3}}>• Review highest-cost expense categories and cut where possible.</p>}
        {totDue>totRev*0.1&&<p style={{color:t.text,fontSize:11,lineHeight:1.6,marginBottom:3}}>• {customers.filter(c=>c.pending>0).length} customers owe {inr(totDue)} — follow up on collections.</p>}
        {totWasteC>totCost*0.1&&<p style={{color:t.text,fontSize:11,lineHeight:1.6}}>• Investigate top wastage products to reduce {inr(totWasteC)} in losses.</p>}
        {totProfit>=0&&totWasteC<=totCost*0.1&&totDue<=totRev*0.1&&<p style={{color:"#10b981",fontSize:11,lineHeight:1.6}}>✓ Business is healthy. Keep monitoring margins and collection rates.</p>}
      </div>
    </div>
  )}

  {/* ══════════════════════════════════════════════════════
      CASH FLOW + BURN RATE (side by side)
  ══════════════════════════════════════════════════════ */}
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:12}}>
    {/* Cash Flow */}
    <div style={{background:dm?"linear-gradient(135deg,#041a0a,#04142a)":"linear-gradient(135deg,#f0fdf4,#eff6ff)",border:dm?"1px solid rgba(16,185,129,0.2)":"1px solid #bbf7d0",borderRadius:18,padding:"18px 20px"}}>
      <p style={{color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:12}}>💵 Cash Flow</p>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
        <div>
          <p style={{color:"#10b981",fontSize:22,fontWeight:900,lineHeight:1}}>{inr(cashCollected)}</p>
          <p style={{color:t.sub,fontSize:10,marginTop:3}}>Collected</p>
        </div>
        <div style={{textAlign:"right"}}>
          <p style={{color:cashPending>0?"#ef4444":"#10b981",fontSize:18,fontWeight:900,lineHeight:1}}>{inr(cashPending)}</p>
          <p style={{color:t.sub,fontSize:10,marginTop:3}}>Pending</p>
        </div>
      </div>
      <div style={{height:10,borderRadius:10,overflow:"hidden",display:"flex",marginBottom:8}}>
        <div style={{width:`${cashFlowPct}%`,background:"linear-gradient(90deg,#10b981,#34d399)",borderRadius:"10px 0 0 10px",transition:"width .6s"}}/>
        <div style={{width:`${100-cashFlowPct}%`,background:"linear-gradient(90deg,#f87171,#ef4444)",borderRadius:"0 10px 10px 0"}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between"}}>
        <span style={{color:"#10b981",fontSize:11,fontWeight:700}}>✓ {cashFlowPct}% collected</span>
        <span style={{color:"#ef4444",fontSize:11,fontWeight:700}}>⏳ {100-cashFlowPct}% due</span>
      </div>
    </div>
    {/* Burn Rate */}
    <div style={{background:dm?"linear-gradient(135deg,#1a0505,#15100a)":"linear-gradient(135deg,#fff7ed,#fef2f2)",border:dm?"1px solid rgba(239,68,68,0.2)":"1px solid #fecaca",borderRadius:18,padding:"18px 20px"}}>
      <p style={{color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:12}}>🔥 Burn & Efficiency</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
        {[
          {label:"Monthly burn",val:inr(burnRate),color:burnRate>avgMonthlyRev?"#ef4444":"#f59e0b"},
          {label:"Avg rev/mo",val:inr(avgMonthlyRev),color:"#10b981"},
          {label:"Net margin",val:`${totMargin}%`,color:totMargin>=15?"#10b981":"#ef4444"},
          {label:"Mo. surplus",val:inr(Math.max(0,avgMonthlyRev-burnRate)),color:"#8b5cf6"},
        ].map(x=>(
          <div key={x.label} style={{background:dm?"rgba(0,0,0,0.2)":"rgba(255,255,255,0.65)",borderRadius:10,padding:"9px 11px",border:`1px solid ${x.color}25`}}>
            <p style={{color:x.color,fontSize:16,fontWeight:900,lineHeight:1}}>{x.val}</p>
            <p style={{color:t.sub,fontSize:9,marginTop:3}}>{x.label}</p>
          </div>
        ))}
      </div>
    </div>
  </div>

  {/* ══════════════════════════════════════════════════════
      PAYMENT BREAKDOWN
  ══════════════════════════════════════════════════════ */}
  {(()=>{
    const delivPB=deliveries.filter(d=>dateFrom<=d.date&&d.date<=dateTo);
    const replCount=delivPB.filter(d=>d.replacement?.done).length;
    const replAmtPB=delivPB.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
    const partialCount=delivPB.filter(d=>d.partialPayment?.enabled&&(+(d.partialPayment?.amount)||0)>0).length;
    const partialAmt=delivPB.reduce((s,d)=>s+(d.partialPayment?.enabled?(+(d.partialPayment?.amount)||0):0),0);
    const fullyPaidCount=delivPB.filter(d=>{const net=lineTotal(d.orderLines)-(+d.replacement?.amount||0);const coll=d.partialPayment?.enabled?(+(d.partialPayment?.amount)||0):0;return net>0&&coll>=net;}).length;
    const unpaidCount=delivPB.filter(d=>!(d.partialPayment?.enabled&&(+(d.partialPayment?.amount)||0)>0)).length;
    const totalPBOrders=delivPB.reduce((s,d)=>s+lineTotal(d.orderLines),0);
    const netAfterRepl=totalPBOrders-replAmtPB;
    const pendingAmt=Math.max(0,netAfterRepl-partialAmt);
    const manualLedgerAmt=(paymentLedger||[]).filter(e=>e.date>=dateFrom&&e.date<=dateTo).reduce((s,e)=>s+e.amount,0);
    return <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:18,padding:"16px 18px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <p style={{color:t.text,fontWeight:800,fontSize:13}}>💳 Payment Breakdown</p>
        <button onClick={()=>setTab("Payments")} style={{background:"rgba(59,130,246,0.1)",color:"#3b82f6",border:"none",borderRadius:8,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>Full Ledger →</button>
      </div>
      <div className="crm-grid-3" style={{gap:8,marginBottom:14}}>
        {[
          {label:"Total Orders",val:inr(totalPBOrders),color:t.text},
          {label:"Replacements",val:`−${inr(replAmtPB)}`,color:"#f97316",sub:`${replCount} deductions`},
          {label:"Net Billed",val:inr(netAfterRepl),color:"#10b981"},
          {label:"Collected",val:inr(partialAmt+manualLedgerAmt),color:"#10b981",sub:`${partialCount} deliveries`},
          {label:"Manual Paid",val:inr(manualLedgerAmt),color:"#3b82f6"},
          {label:"Still Pending",val:inr(pendingAmt),color:pendingAmt>0?"#ef4444":"#10b981"},
        ].map(({label,val,color,sub})=>(
          <div key={label} style={{background:t.inp,borderRadius:12,padding:"10px 12px",border:`1px solid ${color}18`}}>
            <p style={{color,fontWeight:900,fontSize:13,lineHeight:1}}>{val}</p>
            <p style={{color:t.sub,fontSize:9,marginTop:4,textTransform:"uppercase",letterSpacing:"0.05em",fontWeight:700}}>{label}</p>
            {sub&&<p style={{color:t.sub,fontSize:9,marginTop:2}}>{sub}</p>}
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {fullyPaidCount>0&&<span style={{background:"#10b98115",color:"#10b981",borderRadius:20,padding:"4px 12px",fontSize:11,fontWeight:700,border:"1px solid rgba(16,185,129,0.2)"}}>✓ {fullyPaidCount} fully paid</span>}
        {partialCount>0&&<span style={{background:"#f59e0b15",color:"#f59e0b",borderRadius:20,padding:"4px 12px",fontSize:11,fontWeight:700,border:"1px solid rgba(245,158,11,0.2)"}}>⚡ {partialCount} partial</span>}
        {unpaidCount>0&&<span style={{background:"#ef444415",color:"#ef4444",borderRadius:20,padding:"4px 12px",fontSize:11,fontWeight:700,border:"1px solid rgba(239,68,68,0.2)"}}>⏳ {unpaidCount} unpaid</span>}
        {replCount>0&&<span style={{background:"#f9731615",color:"#f97316",borderRadius:20,padding:"4px 12px",fontSize:11,fontWeight:700,border:"1px solid rgba(249,115,22,0.2)"}}>🔄 {replCount} replacements · {inr(replAmtPB)}</span>}
      </div>
    </div>;
  })()}

  {/* ══════════════════════════════════════════════════════
      MONTH HIGHLIGHTS (Best / Worst / Trend)
  ══════════════════════════════════════════════════════ */}
  <div className="crm-grid-3" style={{gap:10}}>
    {[
      {label:"🏆 Best Month",name:bestMonth?.monthFull,val:inr(bestMonth?.profit||0),color:"#10b981",sub:"highest profit",month:bestMonth?.month},
      {label:"📉 Weakest Month",name:worstMonth?.monthFull,val:inr(worstMonth?.profit||0),color:(worstMonth?.profit||0)>=0?"#10b981":"#ef4444",sub:"lowest profit",month:worstMonth?.month},
      {label:"📊 Revenue Trend",name:trendUp?"Growing ▲":"Declining ▼",val:inr(Math.round(recentRevAvg)),color:trendUp?"#10b981":"#ef4444",sub:"recent avg/month",month:null},
    ].map(x=>(
      <div key={x.label}
        onMouseEnter={ev=>{ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.boxShadow=`0 6px 20px ${x.color}25`;ev.currentTarget.style.borderColor=x.color+"60";}}
        onMouseLeave={ev=>{ev.currentTarget.style.transform="translateY(0)";ev.currentTarget.style.boxShadow="none";ev.currentTarget.style.borderColor=t.border;}}
        onClick={x.month?()=>setPlMonthExpanded(plMonthExpanded===x.month?null:x.month):undefined}
        style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"14px 16px",cursor:x.month?"pointer":"default",transition:"all .18s ease"}}>
        <p style={{color:t.sub,fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>{x.label}</p>
        <p style={{color:t.text,fontWeight:900,fontSize:14,lineHeight:1.2}}>{x.name||"—"}</p>
        <p style={{color:x.color,fontWeight:700,fontSize:13,marginTop:4}}>{x.val} <span style={{color:t.sub,fontWeight:400,fontSize:10}}>{x.sub}</span></p>
        {x.month&&<p style={{color:x.color,fontSize:9,marginTop:6,fontWeight:600}}>tap to view detail →</p>}
      </div>
    ))}
  </div>



  {/* ── MONTHLY P&L CHART ── */}
  <Card dm={dm} className="p-4">
    <div className="flex items-center justify-between mb-4">
      <div>
        <p style={{color:t.text}} className="font-bold text-sm">Revenue · Cost · Profit — {periodLabel}</p>
        <p style={{color:t.sub}} className="text-[11px]">Stacked monthly breakdown · tap a bar for detail</p>
      </div>
    </div>
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={mData} margin={{top:4,right:4,left:-10,bottom:0}} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false}/>
        <XAxis dataKey="monthFull" tick={{fontSize:10,fill:t.sub}}/>
        <YAxis tick={{fontSize:10,fill:t.sub}} tickFormatter={v=>v>=1000?`₹${(v/1000).toFixed(0)}k`:`₹${v}`}/>
        <Tooltip contentStyle={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,color:t.text,fontSize:11}} formatter={(v,n)=>[inr(v),n]}/>
        <Legend wrapperStyle={{fontSize:11,paddingTop:8}}/>
        <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4,4,0,0]}/>
        <Bar dataKey="totalCost" name="Total Cost" fill="#ef4444" radius={[4,4,0,0]}/>
        <Bar dataKey="profit" name="Profit" fill="#f59e0b" radius={[4,4,0,0]}/>
      </BarChart>
    </ResponsiveContainer>
  </Card>

  {/* ── MARGIN TREND LINE ── */}
  <Card dm={dm} className="p-4">
    <p style={{color:t.text}} className="font-bold text-sm mb-0.5">Profit Margin Trend</p>
    <p style={{color:t.sub}} className="text-[11px] mb-3">Month-by-month · dashed line = 30% healthy target</p>
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={mData} margin={{top:8,right:8,left:-20,bottom:0}}>
        <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false}/>
        <XAxis dataKey="monthFull" tick={{fontSize:10,fill:t.sub}}/>
        <YAxis tick={{fontSize:10,fill:t.sub}} tickFormatter={v=>`${v}%`} domain={['auto','auto']}/>
        <Tooltip contentStyle={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,color:t.text,fontSize:11}} formatter={(v,n)=>[`${v}%`,n]}/>
        <Legend wrapperStyle={{fontSize:11,paddingTop:6}}/>
        <ReferenceLine y={30} stroke="#10b981" strokeDasharray="6 3" strokeWidth={1.5} label={{value:"Target 30%",position:"right",fill:"#10b981",fontSize:9,fontWeight:700}}/>
        <Line type="monotone" dataKey="margin" name="Net Margin %" stroke="#f59e0b" strokeWidth={2.5} dot={{fill:"#f59e0b",r:4}} activeDot={{r:6}}/>
        <Line type="monotone" dataKey="grossMargin" name="Gross Margin %" stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="4 2" dot={false}/>
      </LineChart>
    </ResponsiveContainer>
  </Card>

  {/* ── COST STRUCTURE ── */}
  <Card dm={dm} className="p-4">
    <p style={{color:t.text}} className="font-bold text-sm mb-4">Cost Structure — {periodLabel}</p>
    <div className="grid grid-cols-3 gap-3 mb-4">
      {[
        {label:"Supply Costs",val:totSupC,color:"#8b5cf6",pct:totCost>0?Math.round(totSupC/totCost*100):0,sub:"Raw material"},
        {label:"Operating Expenses",val:totExpC,color:"#ef4444",pct:totCost>0?Math.round(totExpC/totCost*100):0,sub:"Gas, labour, etc."},
        {label:"Wastage Losses",val:totWasteC,color:"#f97316",pct:totCost>0?Math.round(totWasteC/totCost*100):0,sub:"Avoidable losses"},
      ].map(x=><div key={x.label} style={{background:t.inp,borderRadius:12,padding:"12px 14px",borderTop:`3px solid ${x.color}`}}>
        <p style={{color:x.color}} className="font-black text-base leading-none">{inr(x.val)}</p>
        <p style={{color:t.text}} className="text-[11px] font-semibold mt-1">{x.label}</p>
        <p style={{color:t.sub,fontSize:10}}>{x.sub}</p>
        <div className="flex items-center justify-between mt-2">
          <div style={{flex:1,background:t.border,height:3,borderRadius:3,overflow:"hidden",marginRight:6}}><div style={{width:`${x.pct}%`,background:x.color,height:"100%",borderRadius:3}}/></div>
          <span style={{color:x.color,fontSize:11,fontWeight:800}}>{x.pct}%</span>
        </div>
      </div>)}
    </div>
    {totCost>0&&<>
      <div style={{height:10,borderRadius:10,overflow:"hidden",display:"flex",gap:1}}>
        <div style={{width:`${Math.round(totSupC/totCost*100)}%`,background:"#8b5cf6",borderRadius:"10px 0 0 10px"}}/>
        <div style={{width:`${Math.round(totExpC/totCost*100)}%`,background:"#ef4444"}}/>
        <div style={{width:`${Math.round(totWasteC/totCost*100)}%`,background:"#f97316",borderRadius:"0 10px 10px 0"}}/>
      </div>
      <p style={{color:t.sub,fontSize:10,marginTop:6,textAlign:"right"}}>Total costs: {inr(totCost)}</p>
    </>}
  </Card>

  {/* ── MONTHLY DETAILED TABLE ── */}
  <Card dm={dm} className="overflow-hidden">
    <div className="p-4 pb-2 flex items-center justify-between flex-wrap gap-2">
      <div>
        <p style={{color:t.text}} className="text-sm font-bold">Monthly Breakdown Table</p>
        <p style={{color:t.sub}} className="text-[11px]">All figures INR · ▲▼ = change vs prior month</p>
      </div>
      <Btn dm={dm} v="outline" size="sm" onClick={()=>exportCSV(mData,"pl_report",[{label:"Month",key:"monthFull"},{label:"Revenue",key:"revenue"},{label:"Supply Cost",key:"supplyCost"},{label:"Expenses",key:"expenses"},{label:"Waste Cost",key:"wasteCost"},{label:"Total Cost",key:"totalCost"},{label:"Profit/Loss",key:"profit"},{label:"Margin %",key:"margin"},{label:"Deliveries",key:"deliveriesCount"}])}>📊 CSV</Btn>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr style={{borderBottom:`2px solid ${t.border}`,background:dm?"#111":"#f9f9f8"}}>
          {["Month","Deliveries","Revenue","Supply","Expenses","Waste","Total Cost","Profit / Loss","Margin","Prod Actual","Prod Eff."].map(h=><th key={h} style={{color:t.sub}} className="px-3 py-2.5 text-left font-bold uppercase tracking-wide text-[10px] whitespace-nowrap">{h}</th>)}
        </tr></thead>
        <tbody>
          {mData.map((m,i)=>{
            const prev=mData[i-1];
            const isRowHov=plMonthHovered===m.month;
            const isRowEx=plMonthExpanded===m.month;
            const arrow=(curr,p)=>{if(!p||p===0||curr===p)return null;const up=curr>p;const pct=Math.round(Math.abs(curr-p)/Math.max(Math.abs(p),1)*100);return <span style={{color:up?"#10b981":"#ef4444",fontSize:9,marginLeft:3,fontWeight:700}}>{up?"▲":"▼"}{pct}%</span>;};
            return [
            <tr key={m.month}
              onMouseEnter={()=>setPlMonthHovered(m.month)}
              onMouseLeave={()=>setPlMonthHovered(null)}
              onClick={()=>setPlMonthExpanded(isRowEx?null:m.month)}
              style={{borderBottom:isRowEx?"none":`1px solid ${t.border}`,background:isRowEx?(dm?"#1a2a1a":"#f0fff4"):isRowHov?(dm?"#ffffff06":"#00000005"):"transparent",cursor:"pointer",transition:"background .12s"}}>
              <td style={{color:isRowEx?"#10b981":t.text}} className="px-3 py-2.5 font-bold whitespace-nowrap">{m.monthFull} {isRowEx?"▲":"▼"}</td>
              <td style={{color:t.sub}} className="px-3 py-2.5">{m.deliveriesCount}{prev&&arrow(m.deliveriesCount,prev.deliveriesCount)}</td>
              <td className="px-3 py-2.5 text-emerald-500 font-semibold whitespace-nowrap">{inr(m.revenue)}{prev&&arrow(m.revenue,prev.revenue)}</td>
              <td className="px-3 py-2.5 text-purple-400 whitespace-nowrap">{inr(m.supplyCost)}</td>
              <td className="px-3 py-2.5 text-red-400 whitespace-nowrap">{inr(m.expenses)}</td>
              <td className="px-3 py-2.5 text-orange-400 whitespace-nowrap">{inr(m.wasteCost)}</td>
              <td className="px-3 py-2.5 text-red-500 font-semibold whitespace-nowrap">{inr(m.totalCost)}{prev&&arrow(m.totalCost,prev.totalCost)}</td>
              <td className={`px-3 py-2.5 font-bold whitespace-nowrap ${m.profit>=0?"text-emerald-500":"text-red-500"}`}>{inr(m.profit)}{prev&&arrow(m.profit,prev.profit)}</td>
              <td className="px-3 py-2.5 whitespace-nowrap">
                <span style={{background:m.margin>=30?"#10b98122":m.margin>=15?"#f59e0b22":"#ef444422",color:m.margin>=30?"#10b981":m.margin>=15?"#f59e0b":"#ef4444",borderRadius:6,padding:"2px 8px",fontWeight:800,fontSize:10}}>{m.margin}%</span>
              </td>
              <td style={{color:"#8b5cf6"}} className="px-3 py-2.5 whitespace-nowrap">{m.prodActual>0?m.prodActual:"—"}</td>
              <td className="px-3 py-2.5 whitespace-nowrap">
                {m.prodTarget>0?<span style={{background:m.prodEfficiency>=95?"#10b98122":m.prodEfficiency>=80?"#f59e0b22":"#ef444422",color:m.prodEfficiency>=95?"#10b981":m.prodEfficiency>=80?"#f59e0b":"#ef4444",borderRadius:6,padding:"2px 8px",fontWeight:800,fontSize:10}}>{m.prodEfficiency}%</span>:<span style={{color:t.sub}}>—</span>}
              </td>
            </tr>,
            isRowEx&&<tr key={m.month+"_exp"} style={{background:dm?"#0a1f0a":"#f0fff4",borderBottom:`2px solid #10b98140`}}>
              <td colSpan={11} style={{padding:"0 0 0 0"}}>
                {(()=>{
                  const mKey=m.rawMonth||m.month;
                  const mDelivs=deliveries.filter(d=>d.date?.startsWith(mKey)&&d.status==="Delivered");
                  const mExps=expenses.filter(e=>e.date?.startsWith(mKey));
                  const mSups=supplies.filter(s=>s.date?.startsWith(mKey));
                  const mWaste=(wastage||[]).filter(w=>w.date?.startsWith(mKey));
                  return(<div style={{padding:"12px 16px"}}>
                    <p style={{color:"#10b981",fontWeight:800,fontSize:12,marginBottom:10}}>📋 {m.monthFull} — Full Breakdown</p>
                    {/* Mini KPIs */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {[["Revenue","#10b981",inr(m.revenue),`${m.deliveriesCount} orders`],["Supply","#8b5cf6",inr(m.supplyCost),`${mSups.length} entries`],["Expenses","#ef4444",inr(m.expenses),`${mExps.length} entries`],["Wastage","#f97316",inr(m.wasteCost),`${mWaste.length} records`]].map(([l,c,v,sub])=>(
                        <div key={l} style={{background:c+"12",border:`1px solid ${c}30`,borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
                          <p style={{color:c,fontWeight:900,fontSize:12}}>{v}</p>
                          <p style={{color:t.sub,fontSize:9}}>{l}</p>
                          <p style={{color:t.sub,fontSize:8}}>{sub}</p>
                        </div>
                      ))}
                    </div>
                    {/* Gross margin bar */}
                    <div className="mb-3">
                      <div className="flex justify-between mb-1"><span style={{color:t.sub,fontSize:10}}>Revenue allocation</span><span style={{color:m.profit>=0?"#10b981":"#ef4444",fontWeight:700,fontSize:10}}>{m.margin}% margin</span></div>
                      <div style={{height:8,borderRadius:8,overflow:"hidden",display:"flex",background:t.border}}>
                        <div style={{width:`${Math.max(0,m.margin)}%`,background:"#10b981"}}/>
                        <div style={{width:`${m.revenue>0?Math.round(m.supplyCost/m.revenue*100):0}%`,background:"#8b5cf6"}}/>
                        <div style={{width:`${m.revenue>0?Math.round(m.expenses/m.revenue*100):0}%`,background:"#ef4444"}}/>
                        <div style={{width:`${m.revenue>0?Math.round(m.wasteCost/m.revenue*100):0}%`,background:"#f97316"}}/>
                      </div>
                    </div>
                    {/* Products sold this month */}
                    {(()=>{
                      const mProdMap={};
                      mDelivs.forEach(d=>{Object.entries(safeO(d.orderLines)).forEach(([pid,l])=>{if(l.qty>0){if(!mProdMap[pid])mProdMap[pid]={name:l.name||products.find(p=>p.id===pid)?.name||pid,qty:0,rev:0};mProdMap[pid].qty+=l.qty;mProdMap[pid].rev+=(l.qty||0)*(l.priceAmount||0);}});});
                      const mProdArr=Object.values(mProdMap).sort((a,b)=>b.rev-a.rev);
                      if(!mProdArr.length) return null;
                      return <div className="mb-3">
                        <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>🛒 Products Sold ({mProdArr.length} SKUs)</p>
                        <div style={{display:"flex",flexDirection:"column",gap:3}}>
                          {mProdArr.map(p=>(
                            <div key={p.name} className="flex items-center justify-between" style={{background:t.inp,borderRadius:8,padding:"5px 10px"}}>
                              <div className="flex items-center gap-2">
                                <span style={{color:t.text,fontSize:11,fontWeight:600}}>{p.name}</span>
                                <span style={{color:t.sub,fontSize:10}}>{p.qty} units</span>
                              </div>
                              <span style={{color:"#10b981",fontWeight:700,fontSize:11}}>{inr(p.rev)}</span>
                            </div>
                          ))}
                        </div>
                      </div>;
                    })()}
                    {/* Top deliveries with inv/receipt/batch */}
                    {mDelivs.length>0&&<div className="mb-2">
                      <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>📦 Deliveries ({mDelivs.length})</p>
                      <div style={{maxHeight:180,overflowY:"auto"}}>
                        {[...mDelivs].sort((a,b)=>lineTotal(b.orderLines)-lineTotal(a.orderLines)).map((d,di)=>{
                          const plInvNo=(invRegistry?.issued||{})[d.id]||d.invNo||null;
                          const plRcptNo=plInvNo?`RCP-${plInvNo.replace(/^[A-Z]+-/,"")}`:`RCP-${(d.id||"").slice(-6).toUpperCase()}`;
                          const dDate=d.date||"";
                          const linkedBatches=(prodTargets||[]).filter(pt=>pt.date===dDate&&(pt.linkedInvoices||[]).includes(plInvNo));
                          const batchLabels=linkedBatches.length>0?linkedBatches.map(b=>b.batchLabel||"Batch").join(", "):null;
                          const dItems=Object.entries(safeO(d.orderLines)).filter(([,l])=>l.qty>0).map(([pid,l])=>{const pn=products.find(p=>p.id===pid);return `${l.qty}×${pn?pn.name:(l.name||pid)}`;}).join(", ");
                          return (
                          <div key={d.id||di} style={{borderBottom:di<mDelivs.length-1?`1px solid ${t.border+"44"}`:"none",cursor:"pointer",padding:"6px 4px",transition:"background .1s"}}
                            onClick={()=>setDetailModal({type:"delivery",data:d})}
                            onMouseEnter={ev=>{ev.currentTarget.style.background=t.inp+"88";}} onMouseLeave={ev=>{ev.currentTarget.style.background="transparent";}}>
                            <div className="flex justify-between items-start">
                              <div style={{minWidth:0}}>
                                <span style={{color:t.text,fontSize:11,fontWeight:700}}>{d.customer}</span>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {plInvNo&&<span style={{color:"#8b5cf6",fontSize:9,fontFamily:"monospace",background:dm?"rgba(139,92,246,0.12)":"rgba(139,92,246,0.07)",borderRadius:3,padding:"1px 5px"}}>📄 {plInvNo}</span>}
                                  {plInvNo&&<span style={{color:"#0ea5e9",fontSize:9,fontFamily:"monospace",background:dm?"rgba(14,165,233,0.12)":"rgba(14,165,233,0.07)",borderRadius:3,padding:"1px 5px"}}>🧾 {plRcptNo}</span>}
                                  {batchLabels&&<span style={{color:"#7c3aed",fontSize:9,background:dm?"rgba(124,58,237,0.12)":"rgba(124,58,237,0.07)",borderRadius:3,padding:"1px 5px"}}>🏭 {batchLabels}</span>}
                                </div>
                                {dItems&&<p style={{color:t.sub,fontSize:9,marginTop:2}}>{dItems}</p>}
                              </div>
                              <span style={{color:"#10b981",fontWeight:700,fontSize:11,flexShrink:0,marginLeft:8}}>{inr(lineTotal(d.orderLines))}</span>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    </div>}
                    {/* Supplies this month */}
                    {mSups.length>0&&<div className="mb-2">
                      <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>📦 Supplies ({mSups.length})</p>
                      <div style={{maxHeight:80,overflowY:"auto"}}>
                        {[...mSups].sort((a,b)=>(b.cost||0)-(a.cost||0)).map((s,si)=>(
                          <div key={s.id||si} className="flex justify-between items-center py-1" style={{borderBottom:si<mSups.length-1?`1px solid ${t.border+"44"}`:"none"}}>
                            <span style={{color:t.text,fontSize:11}}>{s.item}{s.supplier?` · ${s.supplier}`:""}</span>
                            <span style={{color:"#8b5cf6",fontWeight:700,fontSize:11}}>{inr(s.cost||0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>}
                    {/* Top expenses */}
                    {mExps.length>0&&<div>
                      <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>💸 Expenses ({mExps.length})</p>
                      <div style={{maxHeight:100,overflowY:"auto"}}>
                        {[...mExps].sort((a,b)=>(b.amount||0)-(a.amount||0)).map((e,ei)=>(
                          <div key={e.id||ei} className="flex justify-between items-center py-1" style={{borderBottom:ei<mExps.length-1?`1px solid ${t.border+"44"}`:"none",cursor:"pointer"}}
                            onClick={()=>setDetailModal({type:"expense",data:e})}
                            onMouseEnter={ev=>{ev.currentTarget.style.background=t.inp+"88";}} onMouseLeave={ev=>{ev.currentTarget.style.background="transparent";}}>
                            <span style={{color:t.text,fontSize:11,textDecoration:"underline"}}>{e.category}{e.vendor?` · ${e.vendor}`:""}</span>
                            <span style={{color:"#ef4444",fontWeight:700,fontSize:11}}>{inr(e.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>}
                    {/* Wastage this month */}
                    {mWaste.length>0&&<div className="mt-2">
                      <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>🗑 Wastage ({mWaste.length})</p>
                      <div style={{maxHeight:80,overflowY:"auto"}}>
                        {[...mWaste].sort((a,b)=>(b.cost||0)-(a.cost||0)).map((w,wi)=>(
                          <div key={w.id||wi} className="flex justify-between items-center py-1" style={{borderBottom:wi<mWaste.length-1?`1px solid ${t.border+"44"}`:"none"}}>
                            <span style={{color:t.text,fontSize:11}}>{w.product} · {w.qty} {w.unit}</span>
                            <span style={{color:"#f97316",fontWeight:700,fontSize:11}}>{w.cost>0?inr(w.cost):"—"}</span>
                          </div>
                        ))}
                      </div>
                    </div>}
                  </div>);
                })()}
              </td>
            </tr>
            ];
          })}
          <tr style={{borderTop:`2px solid ${t.border}`,background:dm?"#1a1a1a":"#fafaf8"}}>
            <td style={{color:t.text}} className="px-3 py-3 font-black text-[11px] uppercase tracking-wide">Total</td>
            <td style={{color:t.sub}} className="px-3 py-3 font-bold">{deliveries.filter(d=>d.status==="Delivered").length}</td>
            <td className="px-3 py-3 text-emerald-500 font-black">{inr(totRev)}</td>
            <td className="px-3 py-3 text-purple-400 font-bold">{inr(totSupC)}</td>
            <td className="px-3 py-3 text-red-400 font-bold">{inr(totExpC)}</td>
            <td className="px-3 py-3 text-orange-400 font-bold">{inr(totWasteC)}</td>
            <td className="px-3 py-3 text-red-500 font-black">{inr(totCost)}</td>
            <td className={`px-3 py-3 font-black ${totProfit>=0?"text-emerald-500":"text-red-500"}`}>{inr(totProfit)}</td>
            <td className="px-3 py-3"><span style={{background:totMargin>=30?"#10b98122":totMargin>=15?"#f59e0b22":"#ef444422",color:totMargin>=30?"#10b981":totMargin>=15?"#f59e0b":"#ef4444",borderRadius:6,padding:"2px 8px",fontWeight:900,fontSize:10}}>{totMargin}%</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </Card>

  {/* ── CUSTOMER-WISE P&L ── */}
  <Card dm={dm} className="overflow-hidden">
    <div className="px-4 pt-4 pb-3 flex items-center justify-between flex-wrap gap-2">
      <div>
        <p style={{color:t.text}} className="text-sm font-bold">Customer Revenue Breakdown</p>
        <p style={{color:t.sub}} className="text-[11px]">Ranked by revenue · collection health shown</p>
      </div>
      <Btn dm={dm} v="outline" size="sm" onClick={()=>{
        const custPL=customers.map(c=>{
          const cd=deliveries.filter(d=>d.customerId===c.id&&d.status==="Delivered");
          const rev=cd.reduce((s,d)=>s+lineTotal(d.orderLines),0);
          return {name:c.name,phone:c.phone||"",orders:deliveries.filter(d=>d.customerId===c.id).length,delivered:cd.length,revenue:rev,collected:c.paid||0,pending:c.pending||0,avgOrder:cd.length>0?Math.round(rev/cd.length):0,agents:[...new Set(deliveries.filter(d=>d.customerId===c.id).map(d=>d.createdBy).filter(Boolean))].join(", ")||"—"};
        }).sort((a,b)=>b.revenue-a.revenue);
        exportCSV(custPL,"customer_pl",[{label:"Customer",key:"name"},{label:"Phone",key:"phone"},{label:"Total Orders",key:"orders"},{label:"Delivered",key:"delivered"},{label:"Revenue",key:"revenue"},{label:"Collected",key:"collected"},{label:"Pending",key:"pending"},{label:"Avg Order",key:"avgOrder"},{label:"Agent / Created By",key:"agents"}]);
      }}>📊 CSV</Btn>
    </div>
    <Hr dm={dm}/>
    {customers.length===0?<p style={{color:t.sub}} className="text-sm text-center py-5">No customers yet.</p>
    :(()=>{
      const sorted=[...customers].sort((a,b)=>{
        const ra=deliveries.filter(d=>d.customerId===a.id&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0);
        const rb=deliveries.filter(d=>d.customerId===b.id&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0);
        return rb-ra;
      });
      const maxCustRev=Math.max(...sorted.map(cx=>deliveries.filter(d=>d.customerId===cx.id&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0)),1);
      const totalPortfolioRev=sorted.reduce((s,cx)=>s+deliveries.filter(d=>d.customerId===cx.id&&d.status==="Delivered").reduce((ss,d)=>ss+lineTotal(d.orderLines),0),0);
      return sorted.map((c,ci)=>{
        const cDelivs=deliveries.filter(d=>d.customerId===c.id);
        const cDelivered=cDelivs.filter(d=>d.status==="Delivered");
        const cRev=cDelivered.reduce((s,d)=>s+lineTotal(d.orderLines),0);
        const cPending=c.pending||0;
        const cPaid=c.paid||0;
        const avgOrder=cDelivered.length>0?Math.round(cRev/cDelivered.length):0;
        const lastDeliv=cDelivs.length>0?[...cDelivs].sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0]:null;
        const collPct=cPaid+cPending>0?Math.round(cPaid/(cPaid+cPending)*100):100;
        const revenueSharePct=totalPortfolioRev>0?Math.round(cRev/totalPortfolioRev*100):0;
        const medalColor=ci===0?"#f59e0b":ci===1?"#9ca3af":ci===2?"#cd7c3f":"#6b7280";
        const isCustHov=plCustHovered===c.id;
        const isCustEx=plCustExpanded===c.id;
        const cProducts=products.map(p=>{const qty=cDelivered.reduce((s,d)=>s+(safeO(d.orderLines)[p.id]?.qty||0),0);const rev=cDelivered.reduce((s,d)=>s+(safeO(d.orderLines)[p.id]?.qty||0)*(safeO(d.orderLines)[p.id]?.priceAmount||0),0);return{...p,qty,rev};}).filter(x=>x.qty>0).sort((a,b)=>b.rev-a.rev);
        return <div key={c.id}
          onMouseEnter={()=>setPlCustHovered(c.id)}
          onMouseLeave={()=>setPlCustHovered(null)}
          onClick={()=>setPlCustExpanded(isCustEx?null:c.id)}
          style={{borderBottom:`1px solid ${t.border}`,cursor:"pointer",background:isCustEx?(dm?"#1a1500":"#fffbeb"):isCustHov?(dm?"#ffffff04":"#00000003"):"transparent",transition:"background .15s"}}>
          <div className="px-4 py-4">
          <div className="flex items-start justify-between mb-2 gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div style={{background:`${medalColor}22`,color:medalColor,width:30,height:30,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:13,flexShrink:0}}>{ci+1}</div>
              <div className="min-w-0">
                <p style={{color:t.text}} className="text-sm font-bold truncate" onClick={ev=>{ev.stopPropagation();setDetailModal({type:"customer",data:c});}}><span style={{textDecoration:"underline",cursor:"pointer"}}>{c.name}</span></p>
                <p style={{color:t.sub}} className="text-[11px]">{cDelivs.length} orders · {cDelivered.length} delivered{lastDeliv?` · Last `:""}
                  {lastDeliv&&<span style={{textDecoration:"underline",cursor:"pointer"}} onClick={ev=>{ev.stopPropagation();setDetailModal({type:"date",data:{date:lastDeliv.date}});}}>{lastDeliv.date}</span>}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-black text-amber-500 text-base leading-none">{inr(cRev)}</p>
              <p style={{color:t.sub}} className="text-[10px] mt-0.5">{revenueSharePct}% of portfolio</p>
              <p style={{color:t.sub,fontSize:9}}>{isCustEx?"▲ collapse":"▼ expand"}</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 mb-2">
            {[
              {label:"Collected",val:inr(cPaid),color:"#10b981",bg:"#10b98112"},
              {label:"Pending",val:inr(cPending),color:cPending>0?"#ef4444":"#10b981",bg:cPending>0?"#ef444412":"#10b98112"},
              {label:"Avg Order",val:inr(avgOrder),color:"#f59e0b",bg:"#f59e0b12"},
              {label:"Coll. Rate",val:`${collPct}%`,color:collPct>=90?"#10b981":collPct>=60?"#f59e0b":"#ef4444",bg:collPct>=90?"#10b98112":collPct>=60?"#f59e0b12":"#ef444412"},
            ].map(x=><div key={x.label} style={{background:x.bg,borderRadius:10,padding:"7px 8px",textAlign:"center"}}>
              <p style={{color:x.color}} className="font-bold text-xs leading-none">{x.val}</p>
              <p style={{color:t.sub}} className="text-[9px] mt-1">{x.label}</p>
            </div>)}
          </div>
          {/* Revenue bar */}
          <div style={{background:t.border,height:4,borderRadius:4,overflow:"hidden",marginBottom:3}}>
            <div style={{width:`${Math.round(cRev/maxCustRev*100)}%`,background:`linear-gradient(90deg,${medalColor},${medalColor}99)`,height:"100%",borderRadius:4,transition:"width 0.6s ease"}}/>
          </div>
          {/* Collection bar */}
          {(cPaid+cPending)>0&&<div style={{height:3,borderRadius:3,overflow:"hidden",display:"flex"}}>
            <div style={{width:`${collPct}%`,background:"#10b981"}}/>
            <div style={{width:`${100-collPct}%`,background:"#ef4444"}}/>
          </div>}
          {/* Expanded detail panel */}
          {isCustEx&&<div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${t.border}`}} onClick={e=>e.stopPropagation()}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              {[
                {l:"Total Revenue",v:inr(cRev),c:"#f59e0b"},
                {l:"Total Orders",v:cDelivs.length,c:"#3b82f6"},
                {l:"Delivered",v:cDelivered.length,c:"#10b981"},
                {l:"Cancelled",v:cDelivs.filter(d=>d.status==="Cancelled").length,c:"#ef4444"},
                {l:"Highest Order",v:inr(Math.max(...cDelivered.map(d=>lineTotal(d.orderLines)),0)),c:"#8b5cf6"},
                {l:"First Order",v:cDelivs.length>0?[...cDelivs].sort((a,b)=>(a.date||"").localeCompare(b.date||""))[0]?.date:"—",c:t.text},
              ].map(x=><div key={x.l} style={{background:t.inp,borderRadius:10,padding:"8px 10px"}}>
                <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase"}}>{x.l}</p>
                <p style={{color:x.c,fontWeight:700,fontSize:12}}>{x.v}</p>
              </div>)}
            </div>
            {/* Products ordered */}
            {cProducts.length>0&&<div className="mb-3">
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Products Ordered</p>
              {cProducts.map(p=>(
                <div key={p.id} className="flex items-center justify-between py-1.5" style={{borderBottom:`1px solid ${t.border}`}}>
                  <div><p style={{color:t.text,fontSize:11,fontWeight:600}}>{p.name}</p><p style={{color:t.sub,fontSize:10}}>{p.qty} units</p></div>
                  <span style={{color:"#f59e0b",fontWeight:700,fontSize:11}}>{inr(p.rev)}</span>
                </div>
              ))}
            </div>}
            {/* Recent deliveries */}
            {cDelivered.length>0&&<div>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Recent Deliveries</p>
              <div style={{maxHeight:130,overflowY:"auto"}}>
                {[...cDelivered].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,8).map((d,di)=>(
                  <div key={d.id||di} className="flex justify-between items-center py-1.5" style={{borderBottom:di<Math.min(8,cDelivered.length)-1?`1px solid ${t.border}`:"none",cursor:"pointer"}}
                    onClick={ev=>{ev.stopPropagation();setDetailModal({type:"delivery",data:d});}}
                    onMouseEnter={ev=>{ev.currentTarget.style.background=t.inp+"88";}} onMouseLeave={ev=>{ev.currentTarget.style.background="transparent";}}>
                    <div>
                      <p style={{color:t.sub,fontSize:10,textDecoration:"underline",cursor:"pointer"}} onClick={ev=>{ev.stopPropagation();setDetailModal({type:"date",data:{date:d.date}});}}>📅 {d.date}</p>
                      {d.orderLines&&Object.values(d.orderLines).filter(l=>l.qty>0).length>0&&<p style={{color:t.sub,fontSize:9}}>{Object.values(d.orderLines).filter(l=>l.qty>0).map(l=>`${l.qty}×${l.name||""}`).join(", ")}</p>}
                      {d.createdBy&&<p style={{color:t.sub,fontSize:9,textDecoration:"underline",cursor:"pointer"}} onClick={ev=>{ev.stopPropagation();setDetailModal({type:"agent",data:{name:d.createdBy}});}}>👤 {d.createdBy}</p>}
                    </div>
                    <span style={{color:"#10b981",fontWeight:700,fontSize:11}}>{inr(lineTotal(d.orderLines))}</span>
                  </div>
                ))}
              </div>
            </div>}
            {c.notes&&<div style={{background:t.inp,borderRadius:10,padding:"8px 12px",marginTop:8}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:2}}>Notes</p>
              <p style={{color:t.text,fontSize:11}}>{c.notes}</p>
            </div>}
          </div>}
          </div>
        </div>;
      });
    })()}
  </Card>

  {/* ── INVOICE AGING REPORT ── */}
  {(()=>{
    const now=new Date();
    const aged=customers.filter(c=>c.pending>0).map(c=>{
      const lastD=deliveries.filter(d=>d.customerId===c.id).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
      const refDate=lastD?.date||c.joinDate||"2026-01-01";
      const daysDue=Math.floor((now-new Date(refDate))/86400000);
      const bucket=daysDue<=30?"0–30 days":daysDue<=60?"31–60 days":daysDue<=90?"61–90 days":"90+ days";
      const color=daysDue<=30?"#f59e0b":daysDue<=60?"#f97316":daysDue<=90?"#ef4444":"#991b1b";
      return {...c,daysDue,bucket,color};
    }).sort((a,b)=>b.daysDue-a.daysDue);
    if(aged.length===0)return null;
    const agingTotal=aged.reduce((s,c)=>s+c.pending,0);
    return <Card dm={dm} className="overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div>
          <p style={{color:t.text}} className="font-bold text-sm">📋 Invoice Aging Report</p>
          <p style={{color:t.sub}} className="text-[11px]">{aged.length} customers · {inr(agingTotal)} total outstanding</p>
        </div>
        <span style={{background:"#ef444420",color:"#ef4444",borderRadius:8,padding:"3px 10px",fontSize:12,fontWeight:800}}>{inr(agingTotal)}</span>
      </div>
      <Hr dm={dm}/>
      {aged.map((c)=>(
        <div key={c.id} style={{borderBottom:`1px solid ${t.border}`,cursor:"pointer",transition:"background .12s"}} className="px-4 py-3 last:border-0"
          onClick={()=>setDetailModal({type:"customer",data:c})}
          onMouseEnter={ev=>{ev.currentTarget.style.background=t.inp+"88";}} onMouseLeave={ev=>{ev.currentTarget.style.background="transparent";}}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p style={{color:t.text}} className="text-sm font-semibold truncate">{c.name}</p>
              <p style={{color:t.sub}} className="text-xs">{c.daysDue} days since last activity</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span style={{background:c.color+"18",color:c.color,borderRadius:8,padding:"2px 9px",fontSize:10,fontWeight:700}}>{c.bucket}</span>
              <span style={{color:"#ef4444"}} className="font-black text-sm">{inr(c.pending)}</span>
            </div>
          </div>
        </div>
      ))}
    </Card>;
  })()}

  {/* ── PRODUCTION SUMMARY IN P&L ── */}
  {(prodTargets||[]).length>0&&(()=>{
    const filtProdPL=(prodTargets||[]).filter(p=>p.date>=dateFrom&&p.date<=dateTo);
    const plProdActual=filtProdPL.reduce((s,p)=>s+(+p.actual||0),0);
    const plProdTarget=filtProdPL.reduce((s,p)=>s+(+p.target||0),0);
    const plProdEff=plProdTarget>0?Math.round(plProdActual/plProdTarget*100):0;
    const plWasteQty=filtW.reduce((s,w)=>s+(w.qty||0),0);
    const plWasteCost=filtW.reduce((s,w)=>s+(w.cost||0),0);
    const prodByProdPL=[...new Set(filtProdPL.map(p=>p.product).filter(Boolean))].map(prod=>({
      product:prod,
      actual:filtProdPL.filter(p=>p.product===prod).reduce((s,p)=>s+(+p.actual||0),0),
      target:filtProdPL.filter(p=>p.product===prod).reduce((s,p)=>s+(+p.target||0),0),
    })).sort((a,b)=>b.actual-a.actual);
    return <Card dm={dm} className="overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between flex-wrap gap-2">
        <div>
          <p style={{color:t.text}} className="font-bold text-sm">🏭 Production & Wastage — {periodLabel}</p>
          <p style={{color:t.sub}} className="text-[11px]">Factory output and loss for the period</p>
        </div>
        <button onClick={()=>setTab("Production")} style={{background:"#8b5cf615",color:"#8b5cf6",border:"none",borderRadius:8,padding:"3px 10px",fontSize:10,fontWeight:700,cursor:"pointer"}}>Full Production →</button>
      </div>
      <Hr dm={dm}/>
      <div style={{padding:"12px 16px"}}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            {label:"Units Produced",val:plProdActual,color:"#8b5cf6"},
            {label:"Production Target",val:plProdTarget,color:"#6b7280"},
            {label:"Efficiency",val:`${plProdEff}%`,color:plProdEff>=95?"#10b981":plProdEff>=80?"#f59e0b":"#ef4444"},
            {label:"Wastage Cost",val:inr(plWasteCost),color:"#f97316",sub:`${plWasteQty} units wasted`},
          ].map(x=><div key={x.label} style={{background:t.inp,borderRadius:12,padding:"10px 12px",borderTop:`2px solid ${x.color}`}}>
            <p style={{color:x.color}} className="font-black text-base leading-none">{x.val}</p>
            <p style={{color:t.sub,fontSize:10,marginTop:3}}>{x.label}</p>
            {x.sub&&<p style={{color:t.sub,fontSize:9,marginTop:1}}>{x.sub}</p>}
          </div>)}
        </div>
        {prodByProdPL.length>0&&<>
          <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>By Product</p>
          {prodByProdPL.map(p=>{
            const eff=p.target>0?Math.round(p.actual/p.target*100):0;
            return <div key={p.product} className="flex items-center gap-3 py-2" style={{borderBottom:`1px solid ${t.border}`}}>
              <div style={{flex:1}}>
                <div className="flex justify-between mb-1"><span style={{color:t.text,fontSize:12,fontWeight:600}}>{p.product}</span><span style={{color:"#8b5cf6",fontWeight:700,fontSize:12}}>{p.actual} units</span></div>
                <div style={{height:4,background:t.border,borderRadius:4,overflow:"hidden"}}><div style={{width:`${Math.min(100,eff)}%`,background:eff>=95?"#10b981":eff>=80?"#f59e0b":"#ef4444",height:"100%",borderRadius:4}}/></div>
              </div>
              <span style={{color:eff>=95?"#10b981":eff>=80?"#f59e0b":"#ef4444",fontWeight:700,fontSize:11,minWidth:36,textAlign:"right"}}>{p.target>0?`${eff}%`:"—"}</span>
            </div>;
          })}
        </>}
      </div>
    </Card>;
  })()}
  {/* ══════════════════════════════════════════════════════
      FEATURE 5: DRILL-DOWN — Wastage & Expenses by Product/Day
  ══════════════════════════════════════════════════════ */}
  {(()=>{
    const [drillView,setDrillView]=React.useState(null); // null | "wastage" | "expenses"
    const [drillGroup,setDrillGroup]=React.useState("product"); // "product" | "day"

    // Wastage aggregations
    const wasteByProduct={};
    filtW.forEach(w=>{
      const k=w.product||"Unknown";
      if(!wasteByProduct[k])wasteByProduct[k]={name:k,qty:0,cost:0,entries:[]};
      wasteByProduct[k].qty+=w.qty||0;
      wasteByProduct[k].cost+=w.cost||0;
      wasteByProduct[k].entries.push(w);
    });
    const wasteByDay={};
    filtW.forEach(w=>{
      const k=w.date||"Unknown";
      if(!wasteByDay[k])wasteByDay[k]={name:k,qty:0,cost:0,entries:[]};
      wasteByDay[k].qty+=w.qty||0;
      wasteByDay[k].cost+=w.cost||0;
      wasteByDay[k].entries.push(w);
    });

    // Expense aggregations
    const expByCategory={};
    filtE.forEach(e=>{
      const k=e.category||"Uncategorised";
      if(!expByCategory[k])expByCategory[k]={name:k,cost:0,entries:[]};
      expByCategory[k].cost+=e.amount||0;
      expByCategory[k].entries.push(e);
    });
    const expByDay={};
    filtE.forEach(e=>{
      const k=e.date||"Unknown";
      if(!expByDay[k])expByDay[k]={name:k,cost:0,entries:[]};
      expByDay[k].cost+=e.amount||0;
      expByDay[k].entries.push(e);
    });

    const activeData=drillView==="wastage"
      ?(drillGroup==="product"?Object.values(wasteByProduct).sort((a,b)=>b.cost-a.cost):Object.values(wasteByDay).sort((a,b)=>b.cost-a.cost))
      :(drillGroup==="product"?Object.values(expByCategory).sort((a,b)=>b.cost-a.cost):Object.values(expByDay).sort((a,b)=>b.cost-a.cost));
    const drillTotal=activeData.reduce((s,x)=>s+x.cost,0);
    const drillMax=activeData[0]?.cost||1;

    return(
      <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:20,overflow:"hidden"}}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <div>
            <p style={{color:t.text,fontWeight:800,fontSize:13}}>🔍 Cost Drill-Down</p>
            <p style={{color:t.sub,fontSize:11,marginTop:2}}>Click a category to see what's driving costs</p>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {[["wastage","🗑️ Wastage",totWasteC],["expenses","💸 Expenses",totExpC]].map(([v,l,amt])=>(
              <button key={v} onClick={()=>setDrillView(drillView===v?null:v)}
                style={{background:drillView===v?(v==="wastage"?"#f97316":"#ef4444"):(t.inp),color:drillView===v?"#fff":t.sub,border:`1.5px solid ${drillView===v?(v==="wastage"?"#f97316":"#ef4444"):t.border}`,borderRadius:10,padding:"5px 13px",fontSize:11,fontWeight:700,cursor:"pointer",transition:"all .15s"}}>
                {l} <span style={{fontWeight:900,fontSize:10,opacity:0.9}}>{inr(amt)}</span>
              </button>
            ))}
          </div>
        </div>
        {drillView&&(
          <div style={{padding:"14px 18px"}}>
            {/* Group toggle */}
            <div style={{display:"flex",gap:6,marginBottom:14}}>
              {(drillView==="wastage"?[["product","By Product"],["day","By Day"]]:[ ["product","By Category"],["day","By Day"]]).map(([v,l])=>(
                <button key={v} onClick={()=>setDrillGroup(v)}
                  style={{background:drillGroup===v?"#3b82f6":t.inp,color:drillGroup===v?"#fff":t.sub,border:`1px solid ${drillGroup===v?"#3b82f6":t.border}`,borderRadius:8,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",transition:"all .15s"}}>
                  {l}
                </button>
              ))}
              <span style={{marginLeft:"auto",color:t.sub,fontSize:11,alignSelf:"center"}}>Total: <strong style={{color:drillView==="wastage"?"#f97316":"#ef4444"}}>{inr(drillTotal)}</strong></span>
            </div>
            {activeData.length===0&&<p style={{color:t.sub,fontSize:12,textAlign:"center",padding:"16px 0"}}>No data for this period.</p>}
            {activeData.map((row,ri)=>{
              const pct=Math.round(row.cost/drillMax*100);
              const sharePct=drillTotal>0?Math.round(row.cost/drillTotal*100):0;
              const barColor=drillView==="wastage"?"#f97316":"#ef4444";
              return(
                <div key={row.name} style={{marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
                      <span style={{background:barColor+"18",color:barColor,borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:800,flexShrink:0}}>{sharePct}%</span>
                      <span style={{color:t.text,fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.name}</span>
                      {row.qty!==undefined&&<span style={{color:t.sub,fontSize:10,flexShrink:0}}>{row.qty} units</span>}
                      {row.entries&&<span style={{color:t.sub,fontSize:10,flexShrink:0}}>{row.entries.length} entries</span>}
                    </div>
                    <span style={{color:barColor,fontWeight:900,fontSize:13,flexShrink:0,marginLeft:8}}>{inr(row.cost)}</span>
                  </div>
                  <div style={{height:6,background:t.border,borderRadius:6,overflow:"hidden"}}>
                    <div style={{width:`${pct}%`,background:`linear-gradient(90deg,${barColor},${barColor}99)`,height:"100%",borderRadius:6,transition:"width 0.4s ease"}}/>
                  </div>
                  {/* Inline entry list for top 3 entries */}
                  {row.entries&&row.entries.length>0&&ri<3&&(
                    <div style={{marginTop:5,paddingLeft:12,borderLeft:`2px solid ${barColor}44`}}>
                      {[...row.entries].sort((a,b)=>(b.cost||b.amount||0)-(a.cost||a.amount||0)).slice(0,3).map((e,ei)=>(
                        <div key={ei} style={{display:"flex",justifyContent:"space-between",padding:"2px 0",fontSize:10,color:t.sub}}>
                          <span>{drillView==="wastage"?(e.product||"—"):(e.category||"—")}{e.vendor?` · ${e.vendor}`:""}{e.shift?` · ${e.shift} shift`:""}</span>
                          <span style={{color:t.text,fontWeight:700}}>{inr(e.cost||e.amount||0)}</span>
                        </div>
                      ))}
                      {row.entries.length>3&&<p style={{fontSize:9,color:t.sub,marginTop:2}}>+{row.entries.length-3} more entries</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!drillView&&(
          <div style={{padding:"20px 18px",textAlign:"center"}}>
            <p style={{color:t.sub,fontSize:12}}>Select <strong>Wastage</strong> or <strong>Expenses</strong> above to drill into what's driving costs this period.</p>
          </div>
        )}
      </div>
    );
  })()}

  {/* ══════════════════════════════════════════════════════
      FEATURE 6: BUSINESS HEALTH RADAR CHART (SVG pentagon)
  ══════════════════════════════════════════════════════ */}
  {(()=>{
    // Five axes: Profitability, Collections, Wastage Control, Growth, Efficiency
    const radarScores={
      profitability: Math.min(100,Math.max(0,totMargin>=30?100:totMargin>=20?80:totMargin>=10?55:totMargin>=0?30:0)),
      collections: collectionRate,
      wastage: Math.min(100,Math.max(0,100-Math.round(totWasteC/Math.max(totCost,1)*100)*3)),
      growth: Math.min(100,Math.max(0,trendUp?(50+Math.min(50,Math.round((recentRevAvg-olderRevAvg)/Math.max(olderRevAvg,1)*100))):Math.max(0,50-Math.min(50,Math.round((olderRevAvg-recentRevAvg)/Math.max(olderRevAvg,1)*100))))),
      efficiency: Math.min(100,Math.max(0,mData.length>0?Math.round(mData.reduce((s,m)=>s+m.prodEfficiency,0)/mData.length):healthScore)),
    };
    const axes=["profitability","collections","wastage","growth","efficiency"];
    const axisLabels=["📈 Profit","💳 Collections","🗑️ Wastage\nControl","🚀 Growth","⚙️ Efficiency"];
    const cx=130,cy=130,r=90;
    const angleStep=(2*Math.PI)/5;
    const startAngle=-Math.PI/2;
    const toXY=(i,pct)=>{
      const a=startAngle+i*angleStep;
      const rr=r*pct/100;
      return[cx+rr*Math.cos(a),cy+rr*Math.sin(a)];
    };
    const toXYOuter=(i,pct)=>{
      const a=startAngle+i*angleStep;
      const rr=r*pct/100;
      return[cx+rr*Math.cos(a),cy+rr*Math.sin(a)];
    };
    // Grid rings
    const gridRings=[20,40,60,80,100];
    const dataPoints=axes.map((k,i)=>toXY(i,radarScores[k]));
    const dataPath=dataPoints.map((p,i)=>`${i===0?"M":"L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")+"Z";
    const gridPaths=gridRings.map(pct=>{
      const pts=axes.map((_,i)=>toXYOuter(i,pct));
      return pts.map((p,i)=>`${i===0?"M":"L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")+"Z";
    });
    const avgScore=Math.round(axes.reduce((s,k)=>s+radarScores[k],0)/axes.length);
    const radarColor=avgScore>=70?"#10b981":avgScore>=45?"#f59e0b":"#ef4444";

    return(
      <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:20,overflow:"hidden"}}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <div>
            <p style={{color:t.text,fontWeight:800,fontSize:13}}>🕸️ Business Health Radar</p>
            <p style={{color:t.sub,fontSize:11,marginTop:2}}>5-axis overview · larger area = stronger business</p>
          </div>
          <div style={{background:radarColor+"18",border:`1.5px solid ${radarColor}55`,borderRadius:12,padding:"6px 14px",display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:radarColor,boxShadow:`0 0 6px ${radarColor}`}}/>
            <span style={{color:radarColor,fontWeight:900,fontSize:13}}>Avg {avgScore}/100</span>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(260px,100%),1fr))",gap:0}}>
          {/* SVG radar */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"16px 8px"}}>
            <svg viewBox="0 0 260 260" width="260" height="260" style={{overflow:"visible"}}>
              {/* Grid rings */}
              {gridPaths.map((path,gi)=>(
                <path key={gi} d={path} fill="none" stroke={t.border} strokeWidth={gi===4?1.5:0.8} strokeDasharray={gi===4?"0":"3 3"} opacity={0.6}/>
              ))}
              {/* Axis spokes */}
              {axes.map((_,i)=>{
                const [ox,oy]=toXYOuter(i,100);
                return <line key={i} x1={cx} y1={cy} x2={ox.toFixed(1)} y2={oy.toFixed(1)} stroke={t.border} strokeWidth={0.8} opacity={0.5}/>;
              })}
              {/* Data fill */}
              <path d={dataPath} fill={radarColor} fillOpacity={0.18} stroke={radarColor} strokeWidth={2.5} strokeLinejoin="round"/>
              {/* Data points */}
              {dataPoints.map((p,i)=>(
                <circle key={i} cx={p[0].toFixed(1)} cy={p[1].toFixed(1)} r={4} fill={radarColor} stroke={t.card} strokeWidth={2}/>
              ))}
              {/* Axis labels */}
              {axes.map((_,i)=>{
                const a=startAngle+i*angleStep;
                const lx=cx+(r+22)*Math.cos(a);
                const ly=cy+(r+22)*Math.sin(a);
                const lines=axisLabels[i].split("\n");
                return(
                  <text key={i} x={lx.toFixed(1)} y={ly.toFixed(1)} textAnchor="middle" dominantBaseline="middle" fontSize={9} fontWeight={700} fill={t.sub}>
                    {lines.map((line,li)=>(
                      <tspan key={li} x={lx.toFixed(1)} dy={li===0?0:11}>{line}</tspan>
                    ))}
                  </text>
                );
              })}
              {/* Center score */}
              <text x={cx} y={cy-4} textAnchor="middle" fontSize={18} fontWeight={900} fill={radarColor}>{avgScore}</text>
              <text x={cx} y={cy+11} textAnchor="middle" fontSize={8} fill={t.sub}>overall</text>
            </svg>
          </div>
          {/* Score breakdown */}
          <div style={{padding:"16px 18px",display:"flex",flexDirection:"column",gap:10,justifyContent:"center"}}>
            {axes.map((k,i)=>{
              const sc=radarScores[k];
              const col=sc>=70?"#10b981":sc>=45?"#f59e0b":"#ef4444";
              const label=axisLabels[i].replace("\n"," ");
              return(
                <div key={k}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{color:t.text,fontSize:11,fontWeight:600}}>{label}</span>
                    <span style={{color:col,fontWeight:900,fontSize:11}}>{sc}/100</span>
                  </div>
                  <div style={{height:5,background:t.border,borderRadius:5,overflow:"hidden"}}>
                    <div style={{width:`${sc}%`,background:`linear-gradient(90deg,${col},${col}99)`,height:"100%",borderRadius:5,transition:"width 0.6s ease"}}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  })()}

  {/* ══════════════════════════════════════════════════════
      FEATURE 7: FINANCIAL GOAL TRACKING
  ══════════════════════════════════════════════════════ */}
  {(()=>{
    const [goalsEdit,setGoalsEdit]=React.useState(false);
    // Use last active month as the "current" month for goal tracking
    const currentMonthKey=mData.length>0?mData[mData.length-1].rawMonth:(new Date().toISOString().slice(0,7));
    const currentMonthData=mData.find(m=>m.rawMonth===currentMonthKey)||{revenue:0,profit:0,margin:0};

    // Goals stored in component state seeded from reasonable defaults
    const [goalRevenue,setGoalRevenue]=React.useState(()=>Math.round((avgMonthlyRev||0)*1.2)||50000);
    const [goalProfit,setGoalProfit]=React.useState(()=>Math.round((avgMonthlyProfit||0)*1.2)||10000);
    const [goalMargin,setGoalMargin]=React.useState(30);
    const [goalCollection,setGoalCollection]=React.useState(90);

    const goals=[
      {label:"Monthly Revenue",icon:"💰",current:currentMonthData.revenue,target:goalRevenue,color:"#10b981",format:"inr",setter:setGoalRevenue},
      {label:"Monthly Profit",icon:"📈",current:currentMonthData.profit,target:goalProfit,color:"#f59e0b",format:"inr",setter:setGoalProfit},
      {label:"Net Margin",icon:"📊",current:currentMonthData.margin,target:goalMargin,color:"#8b5cf6",format:"pct",setter:setGoalMargin},
      {label:"Collection Rate",icon:"💳",current:collectionRate,target:goalCollection,color:"#3b82f6",format:"pct",setter:setGoalCollection},
    ];

    return(
      <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:20,overflow:"hidden"}}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <div>
            <p style={{color:t.text,fontWeight:800,fontSize:13}}>🎯 Financial Goal Tracking</p>
            <p style={{color:t.sub,fontSize:11,marginTop:2}}>Latest month vs your targets · tap Edit to adjust</p>
          </div>
          <button onClick={()=>setGoalsEdit(!goalsEdit)}
            style={{background:goalsEdit?"#3b82f6":t.inp,color:goalsEdit?"#fff":t.sub,border:`1px solid ${goalsEdit?"#3b82f6":t.border}`,borderRadius:8,padding:"5px 13px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
            {goalsEdit?"✓ Done":"✏️ Edit Goals"}
          </button>
        </div>
        <div style={{padding:"16px 18px",display:"flex",flexDirection:"column",gap:16}}>
          {goals.map(g=>{
            const raw=g.target>0?g.current/g.target*100:0;
            const pct=Math.min(100,Math.max(0,Math.round(raw)));
            const over=raw>100;
            const col=pct>=100?"#10b981":pct>=70?g.color:pct>=40?"#f59e0b":"#ef4444";
            const fmt=v=>g.format==="inr"?inr(v):`${v}%`;
            const gap=g.target-g.current;
            return(
              <div key={g.label}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6,flexWrap:"wrap",gap:4}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:14}}>{g.icon}</span>
                    <span style={{color:t.text,fontSize:12,fontWeight:700}}>{g.label}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{color:t.sub,fontSize:11}}>{fmt(g.current)} / </span>
                    {goalsEdit?(
                      <input type="number" value={g.target}
                        onChange={e=>g.setter(+e.target.value)}
                        style={{background:t.inp,border:`1.5px solid ${g.color}55`,borderRadius:8,padding:"3px 8px",fontSize:11,color:t.text,width:90,fontWeight:700,outline:"none"}}/>
                    ):(
                      <span style={{color:g.color,fontSize:12,fontWeight:900}}>{fmt(g.target)}</span>
                    )}
                    <span style={{background:col+"20",color:col,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:800,border:`1px solid ${col}40`}}>
                      {pct}%{over?" ✓":""}
                    </span>
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{height:8,background:t.border,borderRadius:8,overflow:"hidden",position:"relative"}}>
                  <div style={{width:`${pct}%`,background:`linear-gradient(90deg,${col},${col}cc)`,height:"100%",borderRadius:8,transition:"width 0.6s ease",boxShadow:pct>=100?`0 0 8px ${col}88`:"none"}}/>
                </div>
                {!goalsEdit&&(
                  <p style={{color:t.sub,fontSize:10,marginTop:3}}>
                    {pct>=100
                      ?<span style={{color:"#10b981",fontWeight:700}}>✓ Target achieved! {over?`(${fmt(Math.abs(g.current-g.target))} above)`:""}` `</span>
                      :<span>{fmt(Math.max(0,gap))} to go — {Math.round(100-pct)}% remaining</span>
                    }
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {/* Monthly trend mini-table */}
        {mData.length>1&&!goalsEdit&&(
          <div style={{padding:"0 18px 16px"}}>
            <p style={{color:t.sub,fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Recent Monthly Progress</p>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",fontSize:10,borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${t.border}`}}>
                    {["Month","Revenue","Profit","Margin"].map(h=><th key={h} style={{color:t.sub,fontWeight:700,textAlign:"left",padding:"4px 8px",whiteSpace:"nowrap"}}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {mData.slice(-4).map(m=>{
                    const revOk=m.revenue>=goalRevenue;
                    const profOk=m.profit>=goalProfit;
                    const marOk=m.margin>=goalMargin;
                    return(
                      <tr key={m.rawMonth} style={{borderBottom:`1px solid ${t.border}44`}}>
                        <td style={{color:t.sub,padding:"5px 8px",fontWeight:600}}>{m.monthFull}</td>
                        <td style={{color:revOk?"#10b981":"#f59e0b",padding:"5px 8px",fontWeight:700}}>{inr(m.revenue)} {revOk?"✓":""}</td>
                        <td style={{color:profOk?"#10b981":m.profit<0?"#ef4444":"#f59e0b",padding:"5px 8px",fontWeight:700}}>{inr(m.profit)} {profOk?"✓":""}</td>
                        <td style={{padding:"5px 8px"}}><span style={{background:marOk?"#10b98120":"#f59e0b20",color:marOk?"#10b981":"#f59e0b",borderRadius:6,padding:"1px 6px",fontWeight:800}}>{m.margin}%{marOk?" ✓":""}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  })()}

  {/* ══════════════════════════════════════════════════════
      FEATURE 8: CUSTOMER PROFITABILITY ANALYSIS
  ══════════════════════════════════════════════════════ */}
  {(()=>{
    const [custProfView,setCustProfView]=React.useState("profitable"); // "profitable" | "dues" | "replacements"

    const custAnalysis=customers.map(c=>{
      const cD=deliveries.filter(d=>d.customerId===c.id&&d.status==="Delivered"&&d.date>=dateFrom&&d.date<=dateTo);
      const rev=cD.reduce((s,d)=>s+lineTotal(d.orderLines)-(+d.replacement?.amount||0),0);
      const grossRev=cD.reduce((s,d)=>s+lineTotal(d.orderLines),0);
      const replLoss=cD.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
      const replCount=cD.filter(d=>d.replacement?.done).length;
      const pending=c.pending||0;
      const paid=c.paid||0;
      const collRate=paid+pending>0?Math.round(paid/(paid+pending)*100):100;
      // Estimated profit: allocate costs proportionally to revenue share
      const revShare=totRev>0?rev/totRev:0;
      const estCost=Math.round((totSupC+totExpC)*revShare);
      const estProfit=rev-estCost-Math.round(totWasteC*revShare);
      const estMargin=rev>0?Math.round(estProfit/rev*100):0;
      return{...c,rev,grossRev,replLoss,replCount,pending,paid,collRate,estProfit,estMargin,orders:cD.length};
    });

    const sortedProfit=[...custAnalysis].sort((a,b)=>b.estProfit-a.estProfit);
    const sortedDues=[...custAnalysis].filter(c=>c.pending>0).sort((a,b)=>b.pending-a.pending);
    const sortedRepl=[...custAnalysis].filter(c=>c.replLoss>0).sort((a,b)=>b.replLoss-a.replLoss);

    const activeList=custProfView==="profitable"?sortedProfit.slice(0,8):custProfView==="dues"?sortedDues.slice(0,8):sortedRepl.slice(0,8);
    const tabs=[
      {key:"profitable",label:"🏆 Most Profitable",count:sortedProfit.length},
      {key:"dues",label:"🔴 Highest Dues",count:sortedDues.length},
      {key:"replacements",label:"🔄 Replacement Losses",count:sortedRepl.length},
    ];

    if(custAnalysis.length===0)return null;

    return(
      <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:20,overflow:"hidden"}}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${t.border}`}}>
          <p style={{color:t.text,fontWeight:800,fontSize:13}}>👥 Customer Profitability Analysis</p>
          <p style={{color:t.sub,fontSize:11,marginTop:2}}>Period-filtered · costs distributed proportionally by revenue share</p>
        </div>
        {/* Tab switcher */}
        <div style={{display:"flex",gap:0,borderBottom:`1px solid ${t.border}`,overflowX:"auto"}}>
          {tabs.map(tab=>(
            <button key={tab.key} onClick={()=>setCustProfView(tab.key)}
              style={{flex:1,minWidth:100,padding:"10px 8px",border:"none",borderBottom:custProfView===tab.key?"2.5px solid #3b82f6":"2.5px solid transparent",background:"transparent",color:custProfView===tab.key?"#3b82f6":t.sub,fontSize:10,fontWeight:700,cursor:"pointer",transition:"all .15s",whiteSpace:"nowrap"}}>
              {tab.label}
              <span style={{marginLeft:4,background:custProfView===tab.key?"#3b82f620":"transparent",color:custProfView===tab.key?"#3b82f6":t.sub,borderRadius:10,padding:"1px 5px",fontSize:9}}>{tab.count}</span>
            </button>
          ))}
        </div>
        {activeList.length===0&&<p style={{color:t.sub,fontSize:12,textAlign:"center",padding:"20px"}}>No data for this period.</p>}
        <div>
          {activeList.map((c,ci)=>{
            const maxVal=custProfView==="profitable"?Math.max(sortedProfit[0]?.estProfit||1,1):custProfView==="dues"?Math.max(sortedDues[0]?.pending||1,1):Math.max(sortedRepl[0]?.replLoss||1,1);
            const val=custProfView==="profitable"?c.estProfit:custProfView==="dues"?c.pending:c.replLoss;
            const barPct=Math.round(Math.abs(val)/maxVal*100);
            const isNeg=val<0;
            const barColor=custProfView==="profitable"?(isNeg?"#ef4444":"#10b981"):custProfView==="dues"?"#ef4444":"#f97316";
            const medalColor=ci===0?"#f59e0b":ci===1?"#9ca3af":ci===2?"#cd7c3f":"#6b7280";
            return(
              <div key={c.id} style={{padding:"12px 18px",borderBottom:ci<activeList.length-1?`1px solid ${t.border}`:"none"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:7}}>
                  <div style={{width:26,height:26,borderRadius:8,background:medalColor+"22",color:medalColor,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:11,flexShrink:0}}>{ci+1}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{color:t.text,fontSize:12,fontWeight:700,lineHeight:1}}>{c.name}</p>
                    <p style={{color:t.sub,fontSize:10,marginTop:1}}>{c.orders} orders · {inr(c.rev)} net revenue · {c.collRate}% collected</p>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <p style={{color:barColor,fontWeight:900,fontSize:14,lineHeight:1}}>{isNeg?"−":""}{inr(Math.abs(val))}</p>
                    {custProfView==="profitable"&&<p style={{color:t.sub,fontSize:9,marginTop:2}}>{c.estMargin}% est. margin</p>}
                    {custProfView==="dues"&&<p style={{color:t.sub,fontSize:9,marginTop:2}}>{100-c.collRate}% uncollected</p>}
                    {custProfView==="replacements"&&<p style={{color:t.sub,fontSize:9,marginTop:2}}>{c.replCount} replacements</p>}
                  </div>
                </div>
                <div style={{height:5,background:t.border,borderRadius:5,overflow:"hidden"}}>
                  <div style={{width:`${barPct}%`,background:`linear-gradient(90deg,${barColor},${barColor}99)`,height:"100%",borderRadius:5,transition:"width 0.5s ease"}}/>
                </div>
                {/* Mini pills row */}
                <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                  {c.pending>0&&<span style={{background:"#ef444412",color:"#ef4444",borderRadius:6,padding:"1px 7px",fontSize:9,fontWeight:700}}>⏳ {inr(c.pending)} due</span>}
                  {c.replLoss>0&&<span style={{background:"#f9731612",color:"#f97316",borderRadius:6,padding:"1px 7px",fontSize:9,fontWeight:700}}>🔄 {inr(c.replLoss)} repl.</span>}
                  {c.collRate>=95&&<span style={{background:"#10b98112",color:"#10b981",borderRadius:6,padding:"1px 7px",fontSize:9,fontWeight:700}}>✓ Excellent payer</span>}
                  {c.collRate<60&&<span style={{background:"#ef444412",color:"#ef4444",borderRadius:6,padding:"1px 7px",fontSize:9,fontWeight:700}}>⚠️ Poor collections</span>}
                  {c.estMargin>=30&&custProfView==="profitable"&&<span style={{background:"#10b98112",color:"#10b981",borderRadius:6,padding:"1px 7px",fontSize:9,fontWeight:700}}>⭐ High margin</span>}
                </div>
              </div>
            );
          })}
        </div>
        {/* Summary footer */}
        <div style={{padding:"12px 18px",borderTop:`1px solid ${t.border}`,display:"flex",gap:16,flexWrap:"wrap"}}>
          {[
            {label:"Total Customer Revenue",val:inr(custAnalysis.reduce((s,c)=>s+c.rev,0)),color:"#10b981"},
            {label:"Total Dues",val:inr(custAnalysis.reduce((s,c)=>s+c.pending,0)),color:"#ef4444"},
            {label:"Total Repl. Losses",val:inr(custAnalysis.reduce((s,c)=>s+c.replLoss,0)),color:"#f97316"},
          ].map(x=>(
            <div key={x.label} style={{flex:1,minWidth:120,textAlign:"center",background:t.inp,borderRadius:10,padding:"8px 10px"}}>
              <p style={{color:x.color,fontWeight:900,fontSize:13,lineHeight:1}}>{x.val}</p>
              <p style={{color:t.sub,fontSize:9,marginTop:3,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>{x.label}</p>
            </div>
          ))}
        </div>
      </div>
    );
  })()}

  {/* ══════════════════════════════════════════════════════
      FEATURE 9: FINANCIAL STORYTELLING NARRATIVE
  ══════════════════════════════════════════════════════ */}
  {(()=>{
    // Build a human-readable paragraph summary of the period
    const narrativeParts=[];
    const periodStr=periodLabel||"this period";
    // Revenue & growth
    if(totRev>0){
      if(momRev!==null&&Math.abs(momRev)>=3){
        narrativeParts.push(`Revenue ${momRev>=0?"grew":"fell"} ${Math.abs(momRev)}% month-on-month, landing at ${inr(totRev)} for ${periodStr}.`);
      } else {
        narrativeParts.push(`Your business generated ${inr(totRev)} in revenue during ${periodStr}.`);
      }
    } else {
      narrativeParts.push(`No revenue was recorded for ${periodStr}.`);
    }
    // Profitability
    if(totRev>0){
      if(totProfit>0){
        narrativeParts.push(`Net profit came in at ${inr(totProfit)} — a ${totMargin}% margin${totMargin>=25?" which is strong":" (aim for 20%+ for a healthy business)"}.`);
      } else {
        narrativeParts.push(`The business ran at a net loss of ${inr(Math.abs(totProfit))} — costs exceeded revenue by ${Math.abs(totMargin)}%.`);
      }
    }
    // Wastage impact
    if(totWasteC>0){
      const wastePct=totRev>0?Math.round(totWasteC/totRev*100):0;
      if(wastePct>=8){
        narrativeParts.push(`Rising wastage (${inr(totWasteC)}) reduced margins by approximately ${wastePct} percentage points — this is the biggest lever to improve profitability.`);
      } else if(wastePct>0){
        narrativeParts.push(`Wastage cost ${inr(totWasteC)} (${wastePct}% of revenue), which is within a manageable range.`);
      }
    }
    // Collections
    if(totDue>0){
      if(collectionRate<80){
        narrativeParts.push(`Collections are a concern — ${inr(totDue)} remains outstanding and only ${collectionRate}% of dues have been collected. Accelerating recovery could significantly improve cash flow.`);
      } else if(collectionRate>=95){
        narrativeParts.push(`Collections are excellent at ${collectionRate}%, with only ${inr(totDue)} outstanding.`);
      } else {
        narrativeParts.push(`${collectionRate}% of dues have been collected; ${inr(totDue)} is still pending.`);
      }
    }
    // Trend
    if(mData.length>=3){
      if(trendUp&&recentRevAvg>olderRevAvg*1.05){
        narrativeParts.push(`The overall trend is positive — revenue has been climbing steadily across the period.`);
      } else if(!trendUp&&olderRevAvg>recentRevAvg*1.05){
        narrativeParts.push(`Revenue has softened recently, declining from an earlier average of ${inr(Math.round(olderRevAvg))} to ${inr(Math.round(recentRevAvg))} — worth investigating the cause.`);
      }
    }
    // Closing
    if(healthScore>=75){
      narrativeParts.push(`Overall, the business is in healthy shape. Keep an eye on wastage and collections to sustain this momentum.`);
    } else if(healthScore>=50){
      narrativeParts.push(`The business is in moderate health. Focus on reducing costs and tightening collection cycles to push into the green zone.`);
    } else {
      narrativeParts.push(`Immediate attention is needed — margins are thin, costs are high, or collections are lagging. Review each cost line and prioritise cash recovery.`);
    }
    const storyColor=healthScore>=75?"#10b981":healthScore>=50?"#f59e0b":"#ef4444";
    return(
      <div style={{background:t.card,border:`1.5px solid ${storyColor}33`,borderRadius:20,overflow:"hidden"}}>
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:12,background:storyColor+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>📖</div>
          <div>
            <p style={{color:t.text,fontWeight:800,fontSize:13}}>Financial Story</p>
            <p style={{color:t.sub,fontSize:11,marginTop:1}}>AI-generated narrative summary for {periodStr}</p>
          </div>
        </div>
        <div style={{padding:"20px 22px",display:"flex",flexDirection:"column",gap:14}}>
          {narrativeParts.map((part,i)=>(
            <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:storyColor,marginTop:7,flexShrink:0,opacity:0.7}}/>
              <p style={{color:t.text,fontSize:13,lineHeight:1.65,margin:0}}>{part}</p>
            </div>
          ))}
        </div>
      </div>
    );
  })()}

  {/* ══════════════════════════════════════════════════════
      FEATURE 10: FINANCIAL ALERTS
  ══════════════════════════════════════════════════════ */}
  {(()=>{
    const alerts=[];
    // Low margin warning
    if(totRev>0&&totMargin<15){
      alerts.push({level:"critical",icon:"🚨",title:"Low Net Margin",detail:`${totMargin}% margin — healthy businesses target 20%+. Your costs (${inr(totCost)}) are eating into revenue.`,color:"#ef4444"});
    } else if(totRev>0&&totMargin<22){
      alerts.push({level:"warning",icon:"⚠️",title:"Margin Below Target",detail:`${totMargin}% margin — you're in acceptable range but below the 20-25% benchmark. Review expenses.`,color:"#f59e0b"});
    }
    // Overdue collections rising
    const overdueRatio=totDue/(Math.max(totRev,1));
    if(overdueRatio>0.2){
      alerts.push({level:"critical",icon:"🔴",title:"High Outstanding Dues",detail:`${inr(totDue)} uncollected (${Math.round(overdueRatio*100)}% of revenue). Collection rate is only ${collectionRate}%.`,color:"#ef4444"});
    } else if(overdueRatio>0.1){
      alerts.push({level:"warning",icon:"⏳",title:"Dues Accumulating",detail:`${inr(totDue)} pending (${Math.round(overdueRatio*100)}% of revenue). Follow up on outstanding invoices.`,color:"#f59e0b"});
    }
    // Expense anomaly — month with unusually high expenses
    const avgExpM=mData.length>0?mData.reduce((s,m)=>s+m.expenses,0)/mData.length:0;
    const spikeExpM=mData.filter(m=>m.expenses>avgExpM*1.5&&avgExpM>0);
    if(spikeExpM.length>0){
      alerts.push({level:"warning",icon:"📈",title:"Expense Spike Detected",detail:`${spikeExpM.map(m=>m.monthFull).join(", ")} had expenses ${spikeExpM.map(m=>Math.round(m.expenses/avgExpM*100)+"% of avg").join(", ")}. Investigate one-off costs.`,color:"#f97316"});
    }
    // Wastage too high
    const wastageRatio=totWasteC/Math.max(totCost,1);
    if(wastageRatio>0.15){
      alerts.push({level:"critical",icon:"🗑️",title:"Wastage Critical",detail:`Wastage is ${Math.round(wastageRatio*100)}% of total costs (${inr(totWasteC)}). This is severely impacting profitability.`,color:"#ef4444"});
    } else if(wastageRatio>0.08){
      alerts.push({level:"warning",icon:"🗑️",title:"Wastage Above Normal",detail:`Wastage (${inr(totWasteC)}) is ${Math.round(wastageRatio*100)}% of costs — above the 5-8% healthy range.`,color:"#f97316"});
    }
    // Revenue declining
    if(!trendUp&&olderRevAvg>recentRevAvg*1.15&&olderRevAvg>0){
      const drop=Math.round((olderRevAvg-recentRevAvg)/olderRevAvg*100);
      alerts.push({level:"critical",icon:"📉",title:"Revenue Declining",detail:`Recent monthly average is ${drop}% lower than earlier months (${inr(Math.round(recentRevAvg))} vs ${inr(Math.round(olderRevAvg))}). Act now.`,color:"#ef4444"});
    }
    // Burn rate
    if(burnRate>avgMonthlyRev&&burnRate>0){
      alerts.push({level:"critical",icon:"🔥",title:"Burn Rate Exceeds Revenue",detail:`Monthly cost run rate (${inr(burnRate)}) exceeds avg revenue (${inr(avgMonthlyRev)}). Business is cash-negative.`,color:"#ef4444"});
    }
    if(alerts.length===0){
      return(
        <div style={{background:t.card,border:`1px solid #10b98133`,borderRadius:20,padding:"20px 22px",display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:40,height:40,borderRadius:14,background:"#10b98120",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>✅</div>
          <div>
            <p style={{color:"#10b981",fontWeight:800,fontSize:13}}>No Active Alerts</p>
            <p style={{color:t.sub,fontSize:11,marginTop:2}}>Business metrics are all within healthy thresholds for {periodLabel}.</p>
          </div>
        </div>
      );
    }
    return(
      <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:20,overflow:"hidden"}}>
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <p style={{color:t.text,fontWeight:800,fontSize:13}}>🚨 Financial Alerts</p>
            <p style={{color:t.sub,fontSize:11,marginTop:1}}>Auto-detected issues requiring attention</p>
          </div>
          <div style={{background:"#ef444420",border:"1.5px solid #ef444440",borderRadius:10,padding:"4px 12px"}}>
            <span style={{color:"#ef4444",fontWeight:900,fontSize:12}}>{alerts.length} alert{alerts.length!==1?"s":""}</span>
          </div>
        </div>
        <div style={{padding:"14px 18px",display:"flex",flexDirection:"column",gap:12}}>
          {alerts.map((al,i)=>(
            <div key={i} style={{background:al.color+"0d",border:`1.5px solid ${al.color}33`,borderRadius:14,padding:"13px 16px",display:"flex",gap:12,alignItems:"flex-start"}}>
              <span style={{fontSize:18,flexShrink:0,marginTop:1}}>{al.icon}</span>
              <div>
                <p style={{color:al.color,fontWeight:800,fontSize:12,marginBottom:4}}>{al.title}</p>
                <p style={{color:t.text,fontSize:11.5,lineHeight:1.55}}>{al.detail}</p>
              </div>
              <div style={{marginLeft:"auto",flexShrink:0,background:al.color+"20",borderRadius:8,padding:"2px 8px",fontSize:9,fontWeight:800,color:al.color,textTransform:"uppercase",whiteSpace:"nowrap"}}>
                {al.level==="critical"?"Critical":"Warning"}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  })()}

  {/* ══════════════════════════════════════════════════════
      FEATURE 11: COMPARATIVE VIEWS (Period vs Period)
  ══════════════════════════════════════════════════════ */}
  {(()=>{
    // Build two halves of the selected period for comparison
    const halfLen=Math.floor(mData.length/2);
    if(halfLen<1||mData.length<2) return null;
    const periodA=mData.slice(0,halfLen);
    const periodB=mData.slice(mData.length-halfLen);
    const labelA=`${periodA[0].monthFull}${halfLen>1?` – ${periodA[periodA.length-1].monthFull}`:""}`;
    const labelB=`${periodB[0].monthFull}${halfLen>1?` – ${periodB[periodB.length-1].monthFull}`:""}`;
    const sum=(arr,key)=>arr.reduce((s,m)=>s+(m[key]||0),0);
    const metrics=[
      {label:"Revenue",key:"revenue",fmt:inr,icon:"💰",color:"#10b981"},
      {label:"Total Cost",key:"totalCost",fmt:inr,icon:"💸",color:"#ef4444"},
      {label:"Net Profit",key:"profit",fmt:inr,icon:"📈",color:"#f59e0b"},
      {label:"Avg Margin",key:"margin",fmt:v=>`${Math.round(v)}%`,icon:"📊",color:"#8b5cf6",avg:true},
      {label:"Wastage Cost",key:"wasteCost",fmt:inr,icon:"🗑️",color:"#f97316"},
      {label:"Deliveries",key:"deliveriesCount",fmt:v=>v,icon:"📦",color:"#3b82f6"},
    ];
    return(
      <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:20,overflow:"hidden"}}>
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${t.border}`}}>
          <p style={{color:t.text,fontWeight:800,fontSize:13}}>⚡ Period Comparison</p>
          <p style={{color:t.sub,fontSize:11,marginTop:1}}>First half vs second half of selected range</p>
        </div>
        {/* Period labels */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",borderBottom:`1px solid ${t.border}`}}>
          <div style={{padding:"10px 16px"}}><p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase"}}>Metric</p></div>
          <div style={{padding:"10px 16px",background:"#3b82f610",borderLeft:`1px solid ${t.border}`}}>
            <p style={{color:"#3b82f6",fontSize:10,fontWeight:800,textTransform:"uppercase"}}>Earlier Period</p>
            <p style={{color:"#3b82f699",fontSize:9,marginTop:2}}>{labelA}</p>
          </div>
          <div style={{padding:"10px 16px",background:"#10b98110",borderLeft:`1px solid ${t.border}`}}>
            <p style={{color:"#10b981",fontSize:10,fontWeight:800,textTransform:"uppercase"}}>Recent Period</p>
            <p style={{color:"#10b98199",fontSize:9,marginTop:2}}>{labelB}</p>
          </div>
        </div>
        {metrics.map((m,mi)=>{
          const valA=m.avg?sum(periodA,m.key)/halfLen:sum(periodA,m.key);
          const valB=m.avg?sum(periodB,m.key)/halfLen:sum(periodB,m.key);
          const delta=valA!==0?Math.round((valB-valA)/Math.abs(valA)*100):0;
          const up=valB>=valA;
          const goodUp=["revenue","profit"].includes(m.key)||(m.key==="margin"&&up);
          const badUp=["totalCost","wasteCost"].includes(m.key)&&up;
          const deltaColor=delta===0?"#6b7280":badUp?"#ef4444":goodUp&&up?"#10b981":!goodUp&&!up?"#10b981":"#ef4444";
          return(
            <div key={m.key} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",borderBottom:mi<metrics.length-1?`1px solid ${t.border}`:"none"}}>
              <div style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:14}}>{m.icon}</span>
                <span style={{color:t.text,fontSize:11,fontWeight:600}}>{m.label}</span>
              </div>
              <div style={{padding:"12px 16px",borderLeft:`1px solid ${t.border}44`,display:"flex",alignItems:"center"}}>
                <span style={{color:t.sub,fontSize:12,fontWeight:700}}>{m.fmt(valA)}</span>
              </div>
              <div style={{padding:"12px 16px",borderLeft:`1px solid ${t.border}44`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                <span style={{color:t.text,fontSize:12,fontWeight:800}}>{m.fmt(valB)}</span>
                {delta!==0&&<span style={{background:deltaColor+"18",color:deltaColor,borderRadius:8,padding:"2px 7px",fontSize:10,fontWeight:800,whiteSpace:"nowrap"}}>
                  {up?"▲":"▼"}{Math.abs(delta)}%
                </span>}
              </div>
            </div>
          );
        })}
      </div>
    );
  })()}

  {/* ══════════════════════════════════════════════════════
      FEATURE 12: EXPENSE ANOMALY DETECTION + SMART TAGS
  ══════════════════════════════════════════════════════ */}
  {filtE.length>0&&(()=>{
    // Compute per-category averages across months
    const catMonthMap={};
    mData.forEach(m=>{
      filtE.filter(e=>e.date?.startsWith(m.rawMonth)).forEach(e=>{
        const cat=e.category||"Uncategorised";
        if(!catMonthMap[cat])catMonthMap[cat]={cat,monthAmounts:[],entries:[]};
        catMonthMap[cat].monthAmounts.push(e.amount||0);
        catMonthMap[cat].entries.push({...e,month:m.rawMonth});
      });
    });
    // Recurring: same category appears in 2+ months
    const taggedCats=Object.values(catMonthMap).map(c=>{
      const total=c.entries.reduce((s,e)=>s+(e.amount||0),0);
      const avg=c.monthAmounts.length>0?total/c.monthAmounts.length:0;
      const max=Math.max(...c.monthAmounts,0);
      const spike=max>avg*1.8&&c.monthAmounts.length>1;
      const recurring=c.monthAmounts.length>=2;
      const tags=[];
      if(recurring) tags.push({label:"Recurring",color:"#3b82f6"});
      if(spike) tags.push({label:"Spike Detected",color:"#f97316"});
      if(total>totExpC*0.3) tags.push({label:"Major Expense",color:"#8b5cf6"});
      if(total<totExpC*0.03&&recurring) tags.push({label:"Low & Steady",color:"#10b981"});
      return{...c,total,avg,max,spike,recurring,tags};
    }).sort((a,b)=>b.total-a.total);

    const hasAnomalies=taggedCats.some(c=>c.tags.length>0);
    return(
      <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:20,overflow:"hidden"}}>
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <p style={{color:t.text,fontWeight:800,fontSize:13}}>🏷️ Expense Anomaly & Smart Tags</p>
            <p style={{color:t.sub,fontSize:11,marginTop:1}}>Recurring patterns, spikes, and flagged categories</p>
          </div>
          {!hasAnomalies&&<span style={{background:"#10b98115",color:"#10b981",border:"1.5px solid #10b98133",borderRadius:10,padding:"4px 10px",fontSize:10,fontWeight:700}}>All Normal</span>}
        </div>
        <div style={{padding:"14px 18px",display:"flex",flexDirection:"column",gap:10}}>
          {taggedCats.map((c,ci)=>{
            const barMax=taggedCats[0]?.total||1;
            const barPct=Math.round(c.total/barMax*100);
            return(
              <div key={c.cat} style={{background:c.spike?`#f9731608`:c.tags.length>0?`${t.inp}`:t.inp,border:c.spike?`1.5px solid #f9731633`:`1.5px solid ${t.border}44`,borderRadius:12,padding:"12px 14px"}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                      <span style={{color:t.text,fontSize:12,fontWeight:700}}>{c.cat}</span>
                      {c.tags.map(tag=>(
                        <span key={tag.label} style={{background:tag.color+"18",color:tag.color,border:`1px solid ${tag.color}33`,borderRadius:6,padding:"1px 8px",fontSize:9,fontWeight:800}}>
                          {tag.label}
                        </span>
                      ))}
                    </div>
                    <div style={{height:4,background:t.border,borderRadius:4,overflow:"hidden"}}>
                      <div style={{width:`${barPct}%`,background:c.spike?"#f97316":c.total>totExpC*0.3?"#8b5cf6":"#3b82f6",height:"100%",borderRadius:4,transition:"width 0.5s"}}/>
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <p style={{color:t.text,fontSize:13,fontWeight:900,lineHeight:1}}>{inr(c.total)}</p>
                    <p style={{color:t.sub,fontSize:9,marginTop:2}}>{c.entries.length} entries · {Math.round(c.total/Math.max(totExpC,1)*100)}% of expenses</p>
                  </div>
                </div>
                {c.spike&&(
                  <div style={{background:"#f9731615",borderRadius:8,padding:"6px 10px",display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:12}}>⚡</span>
                    <p style={{color:"#f97316",fontSize:10,fontWeight:700}}>Peak month was {inr(c.max)} vs avg {inr(Math.round(c.avg))} — {Math.round(c.max/c.avg*100)}% of normal</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  })()}

  {/* ══════════════════════════════════════════════════════
      FEATURE 13: PDF EXPORT (BRANDED REPORT)
  ══════════════════════════════════════════════════════ */}
  {(()=>{
    const [pdfExporting,setPdfExporting]=React.useState(false);
    const [pdfDone,setPdfDone]=React.useState(false);

    const exportPDF=()=>{
      setPdfExporting(true);
      setPdfDone(false);
      // Build HTML report content for print
      const reportDate=new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"long",year:"numeric"});
      const html=`<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>P&L Report — ${periodLabel}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f8fafc;color:#1e293b;padding:0;}
.cover{background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;padding:60px 48px 48px;min-height:180px;}
.cover h1{font-size:28px;font-weight:900;letter-spacing:-0.5px;margin-bottom:6px;}
.cover p{font-size:14px;opacity:0.7;margin-bottom:4px;}
.cover .badge{display:inline-block;background:${healthColor}30;border:1.5px solid ${healthColor}60;color:${healthColor};border-radius:8px;padding:4px 14px;font-size:12px;font-weight:800;margin-top:14px;}
.body{padding:36px 48px;}
.section{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:22px 26px;margin-bottom:22px;}
.section h2{font-size:14px;font-weight:800;color:#334155;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid #f1f5f9;}
.kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:0;}
.kpi{background:#f8fafc;border-radius:10px;padding:14px 16px;border-top:3px solid;}
.kpi .val{font-size:20px;font-weight:900;line-height:1;}
.kpi .lbl{font-size:10px;color:#64748b;margin-top:4px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;}
.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12px;}
.row:last-child{border:none;}
.row .lbl{color:#64748b;font-weight:600;}
.row .val{font-weight:800;color:#1e293b;}
.alert{border-radius:10px;padding:10px 14px;margin-bottom:8px;font-size:11px;font-weight:600;display:flex;gap:10px;}
.footer{text-align:center;padding:24px;color:#94a3b8;font-size:10px;}
@media print{body{background:#fff;}.cover{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
</style></head><body>
<div class="cover">
<p style="font-size:11px;opacity:0.5;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px;">CONFIDENTIAL FINANCIAL REPORT</p>
<h1>Profit &amp; Loss Summary</h1>
<p>Period: ${periodLabel}</p>
<p>Generated: ${reportDate}</p>
<div class="badge">${healthLabel} · ${healthScore}/100</div>
</div>
<div class="body">
<div class="section">
<h2>📊 Executive Summary</h2>
<div class="kpi-grid">
<div class="kpi" style="border-color:#10b981"><div class="val" style="color:#10b981">${inr(totRev)}</div><div class="lbl">Net Revenue</div></div>
<div class="kpi" style="border-color:${totProfit>=0?"#f59e0b":"#ef4444"}"><div class="val" style="color:${totProfit>=0?"#f59e0b":"#ef4444"}">${inr(totProfit)}</div><div class="lbl">Net Profit</div></div>
<div class="kpi" style="border-color:#8b5cf6"><div class="val" style="color:#8b5cf6">${totMargin}%</div><div class="lbl">Net Margin</div></div>
<div class="kpi" style="border-color:#ef4444"><div class="val" style="color:#ef4444">${inr(totCost)}</div><div class="lbl">Total Cost</div></div>
<div class="kpi" style="border-color:#f97316"><div class="val" style="color:#f97316">${inr(totWasteC)}</div><div class="lbl">Wastage</div></div>
<div class="kpi" style="border-color:#3b82f6"><div class="val" style="color:#3b82f6">${collectionRate}%</div><div class="lbl">Collection Rate</div></div>
</div>
</div>
<div class="section">
<h2>💰 Cost Breakdown</h2>
<div class="row"><span class="lbl">Supply Cost</span><span class="val">${inr(totSupC)}</span></div>
<div class="row"><span class="lbl">Operating Expenses</span><span class="val">${inr(totExpC)}</span></div>
<div class="row"><span class="lbl">Wastage</span><span class="val" style="color:#f97316">${inr(totWasteC)}</span></div>
<div class="row"><span class="lbl">Replacement Deductions</span><span class="val" style="color:#ef4444">${inr(totReplDeducted)}</span></div>
<div class="row"><span class="lbl" style="font-weight:800;color:#1e293b">Total Cost</span><span class="val" style="color:#ef4444">${inr(totCost)}</span></div>
</div>
<div class="section">
<h2>📅 Monthly Breakdown</h2>
${mData.slice(-6).map(m=>`<div class="row"><span class="lbl">${m.monthFull}</span><span style="display:flex;gap:20px;"><span style="color:#10b981;font-weight:800;font-size:12px">${inr(m.revenue)}</span><span style="color:${m.profit>=0?"#f59e0b":"#ef4444"};font-weight:800;font-size:12px">${inr(m.profit)}</span><span style="color:#8b5cf6;font-weight:700;font-size:11px">${m.margin}%</span></span></div>`).join("")}
</div>
${insights.length>0?`<div class="section"><h2>🔍 Key Insights</h2>${insights.map(ins=>`<div class="alert" style="background:${ins.icon==="✅"?"#f0fdf4":"#fff7ed"};border:1px solid ${ins.icon==="✅"?"#bbf7d0":"#fed7aa"}"><span>${ins.icon}</span><span>${ins.text}</span></div>`).join("")}</div>`:""}
<div class="footer">Generated by your business dashboard · ${reportDate} · Confidential</div>
</div></body></html>`;
      const blob=new Blob([html],{type:"text/html"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");
      a.href=url;
      a.download=`PnL_Report_${periodLabel.replace(/[^a-z0-9]/gi,"_")}_${new Date().toISOString().slice(0,10)}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setTimeout(()=>{setPdfExporting(false);setPdfDone(true);setTimeout(()=>setPdfDone(false),4000);},600);
    };

    return(
      <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:20,overflow:"hidden"}}>
        <div style={{padding:"18px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:40,height:40,borderRadius:13,background:"#8b5cf620",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>📄</div>
            <div>
              <p style={{color:t.text,fontWeight:800,fontSize:13}}>Export Branded Report</p>
              <p style={{color:t.sub,fontSize:11,marginTop:1}}>Download a formatted HTML report — open in browser &amp; print to PDF</p>
            </div>
          </div>
          <button onClick={exportPDF} disabled={pdfExporting}
            style={{background:pdfDone?"#10b981":pdfExporting?"#6b7280":"#8b5cf6",color:"#fff",border:"none",borderRadius:12,padding:"11px 22px",fontSize:12,fontWeight:800,cursor:pdfExporting?"not-allowed":"pointer",transition:"all .2s",display:"flex",alignItems:"center",gap:8,boxShadow:`0 4px 14px ${pdfDone?"#10b98140":"#8b5cf640"}`}}>
            {pdfExporting?"⏳ Generating...":pdfDone?"✅ Downloaded!":"⬇️ Export Report"}
          </button>
        </div>
        <div style={{padding:"0 22px 16px",display:"flex",gap:10,flexWrap:"wrap"}}>
          {[
            {icon:"📊",label:"KPI summary"},
            {icon:"💰",label:"Cost breakdown"},
            {icon:"📅",label:"Monthly table"},
            {icon:"🔍",label:"Insights"},
          ].map(x=>(
            <span key={x.label} style={{background:t.inp,borderRadius:8,padding:"4px 11px",fontSize:10,fontWeight:700,color:t.sub,display:"flex",alignItems:"center",gap:5}}>
              {x.icon} {x.label}
            </span>
          ))}
        </div>
      </div>
    );
  })()}

</div>;

  })());
}
