/* eslint-disable */
// TAB: Production
import React from "react";
import { lineRows } from "../lib/utils";

export function ProductionTab({ dm, t, today, ts, uid, inr, notify, ask, addLog, addNotif, captureGPS, can, canSeePrices, canSeeFinancials, isAdmin, isFactory, sess, displayName, settings, products, prodItems, prodTargets, setProdTargets, wastage, setWaste, qcLogs, setQcLogs, handovers, setHandovers, deliveries, customers, invRegistry, safeO, safeArr, lineTotal, prodNamesMatch, exportTabPDF, blkW, ptSh, setPtSh, ptF, setPtF, ptDateFilter, setPtDateFilter, ptSearch, setPtSearch, ptShiftFilter, setPtShiftFilter, ptCustomFrom, setPtCustomFrom, ptCustomTo, setPtCustomTo, ptProductFilter, setPtProductFilter, ptWasteTypeFilter, setPtWasteTypeFilter, ptQcGradeFilter, setPtQcGradeFilter, ptHandoverFilter, setPtHandoverFilter, ptShowFilters, setPtShowFilters, prodSubTab, setProdSubTab, wSh, setWSh, wF, setWF, hvSh, setHvSh, hvF, setHvF, qcSh, setQcSh, qcF, setQcF, T, SectionHeader, StatCard, Card, Btn, Inp, Sel, Pill, Sheet, Tog }) {
  return (()=>{
          const todayStr=today();
          const yesterdayStr=(()=>{const d=new Date();d.setDate(d.getDate()-1);return d.toISOString().slice(0,10);})();
          const last7=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return d.toISOString().slice(0,10);});
          const last30=Array.from({length:30},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return d.toISOString().slice(0,10);});
          const filterDates=ptDateFilter==="today"?[todayStr]:ptDateFilter==="yesterday"?[yesterdayStr]:ptDateFilter==="week"?last7:ptDateFilter==="month"?last30:ptDateFilter==="custom"&&ptCustomFrom?(()=>{const _from=new Date(ptCustomFrom),_to=new Date(ptCustomTo||todayStr);if(_from>_to)return[];const _days=Math.min(365,Math.ceil((_to-_from)/86400000)+1);return Array.from({length:_days},(_,i)=>{const d=new Date(ptCustomFrom);d.setDate(d.getDate()+i);return d.toISOString().slice(0,10);});})():null;
          const filteredPT=(filterDates?prodTargets.filter(x=>filterDates.includes(x.date)):prodTargets).filter(x=>!ptSearch||x.product?.toLowerCase().includes(ptSearch.toLowerCase())||x.shift?.toLowerCase().includes(ptSearch.toLowerCase())||x.notes?.toLowerCase().includes(ptSearch.toLowerCase())||x.batchLabel?.toLowerCase().includes(ptSearch.toLowerCase())).filter(x=>ptShiftFilter==="all"||(!x.shift&&ptShiftFilter==="none")||(x.shift&&x.shift===ptShiftFilter)).filter(x=>ptProductFilter==="all"||x.product===ptProductFilter).filter(x=>{if(ptHandoverFilter==="all")return true;const hasHV=(handovers||[]).some(h=>h.batchId===x.batchId);return ptHandoverFilter==="with"?hasHV:!hasHV;});
          const todayPT=prodTargets.filter(x=>x.date===todayStr);
          const allQty=prodTargets.reduce((s,x)=>s+(+x.actual||0),0);
          const GRADES=[{g:"A",color:"#10b981",label:"Pass — Grade A"},{g:"B",color:"#f59e0b",label:"Pass — Grade B"},{g:"C",color:"#f97316",label:"Marginal — Grade C"},{g:"F",color:"#ef4444",label:"Fail — Reject"}];
          const gradeColor=g=>GRADES.find(x=>x.g===g)?.color||"#6b7280";
          const uniqueDates=[...new Set(filteredPT.map(x=>x.date))].sort((a,b)=>b.localeCompare(a));
          const filteredWaste=(filterDates?(wastage||[]).filter(w=>filterDates.includes(w.date)):(wastage||[])).filter(w=>!ptSearch||w.product?.toLowerCase().includes(ptSearch.toLowerCase())||w.type?.toLowerCase().includes(ptSearch.toLowerCase())).filter(w=>ptWasteTypeFilter==="all"||w.type===ptWasteTypeFilter).filter(w=>ptShiftFilter==="all"||(!w.shift&&ptShiftFilter==="none")||(w.shift&&w.shift===ptShiftFilter));
          const filteredQC=(filterDates?(qcLogs||[]).filter(q=>filterDates.includes(q.date)):(qcLogs||[])).filter(q=>!ptSearch||q.product?.toLowerCase().includes(ptSearch.toLowerCase())||q.grade?.toLowerCase().includes(ptSearch.toLowerCase())).filter(q=>ptQcGradeFilter==="all"||q.grade===ptQcGradeFilter).filter(q=>ptShiftFilter==="all"||(!q.shift&&ptShiftFilter==="none")||(q.shift&&q.shift===ptShiftFilter));
          // QC: count batches with a qcGrade set + standalone qcLogs entries
          const filteredPeriodLabel=ptDateFilter==="all"?"All time":ptDateFilter==="today"?"Today":ptDateFilter==="yesterday"?"Yesterday":ptDateFilter==="week"?"Last 7 days":ptDateFilter==="month"?"Last 30 days":"Custom range";
          const batchesWithQC=filteredPT.filter(x=>x.qcGrade&&x.qcGrade!=="");
          const totalQCChecks=batchesWithQC.length+filteredQC.length;
          const totalQCPass=batchesWithQC.filter(x=>x.qcGrade!=="F").length+filteredQC.filter(q=>q.grade!=="F").length;
          const qcPassPct=Math.round(totalQCPass/Math.max(totalQCChecks,1)*100);
          return <div style={{display:"flex",flexDirection:"column",gap:32}}>
            <SectionHeader dm={dm} title="Production" sub="Batch logs, QC checks & wastage tracking"
              cta={<div style={{display:"flex",gap:8}}>
                <button onClick={()=>setProdSubTab("schedule")}
                  style={{background:"transparent",color:"#2563eb",border:"1.5px solid #2563eb",borderRadius:12,padding:"10px 18px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:7}}>
                  📅 Schedule
                </button>
                <button onClick={()=>{
                    const batchDate=todayStr;
                    const existingBatchCount=prodTargets.filter(x=>x.date===batchDate).length;
                    const nextNum=existingBatchCount+1;
                    setPtF({date:batchDate,shift:(settings?.shifts||["Morning"])[0]||"",product:(prodItems||[])[0]?.name||"",actual:"",notes:"",batchId:uid(),batchLabel:`Batch ${nextNum}`,qcGrade:"A",qcNotes:"",embWastage:[],embQC:[],embHandover:[]});
                    setPtSh("add");
                  }}
                  style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:12,padding:"11px 20px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:7,boxShadow:"0 2px 8px rgba(37,99,235,0.3)"}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Log Batch
                </button>
              </div>}/>
            {/* KPI strip */}
            <div className="crm-grid-4" style={{gap:14}}>
              <StatCard dm={dm} label="Total Batches" value={filteredPT.length} sub={`${todayPT.length} today`} accent="#8b5cf6"/>
              <StatCard dm={dm} label="Units Produced" value={filteredPT.reduce((s,x)=>s+(+x.actual||0),0).toLocaleString("en-IN")} sub={filteredPeriodLabel} accent="#6366f1"/>
              <StatCard dm={dm} label="QC Checks" value={totalQCChecks} sub={`${qcPassPct}% pass rate`} accent="#14b8a6"/>
              <StatCard dm={dm} label="Wastage Records" value={filteredWaste.length} sub={`${inr(filteredWaste.reduce((s,w)=>s+(+w.cost||0),0))} cost`} accent="#f97316"/>
            </div>

            {/* ── LIVE FACTORY STATUS BOARD ── */}
            {(()=>{
              const activeBatches=todayPT.filter(x=>!x.qcGrade||x.qcGrade==="");
              const qcFails=todayPT.filter(x=>x.qcGrade==="F");
              const todayWaste=(wastage||[]).filter(w=>w.date===todayStr);
              const highWaste=todayWaste.reduce((s,w)=>s+(+w.qty||0),0)>50;
              const pendingHV=(handovers||[]).filter(h=>h.date===todayStr).length;
              const statusItems=[
                {icon:"🟢",label:"Active today",value:`${todayPT.length} batch${todayPT.length!==1?"es":""}`,color:"#10b981",bg:"#10b98112"},
                {icon:"✅",label:"QC pass rate",value:`${qcPassPct}%`,color:qcPassPct>=80?"#10b981":qcPassPct>=60?"#f59e0b":"#ef4444",bg:qcPassPct>=80?"#10b98112":"#ef444412"},
                {icon:"🗑️",label:"Wastage today",value:`${todayWaste.reduce((s,w)=>s+(+w.qty||0),0)} units`,color:highWaste?"#ef4444":"#f97316",bg:highWaste?"#ef444412":"#f9731612"},
                {icon:"📋",label:"Handovers today",value:pendingHV,color:"#6366f1",bg:"#6366f112"},
              ];
              return <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,overflow:"hidden"}}>
                <div style={{padding:"26px 24px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:16}}>🏭</span>
                  <p style={{color:t.text,fontWeight:800,fontSize:13}}>Live Factory Status</p>
                  <span style={{display:"inline-flex",alignItems:"center",gap:20,background:"#10b98112",border:"1px solid #10b98130",borderRadius:99,padding:"5px 12px",fontSize:10,fontWeight:700,color:"#10b981",marginLeft:"auto"}}>
                    <span style={{width:5,height:5,borderRadius:"50%",background:"#10b981",display:"inline-block",boxShadow:"0 0 5px #10b981"}}/>Live
                  </span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:0}}>
                  {statusItems.map((s,i)=>(
                    <div key={i} style={{padding:"28px 28px",borderRight:i<statusItems.length-1?`1px solid ${t.border}`:"none",background:s.bg}}>
                      <div style={{display:"flex",alignItems:"center",gap:24,marginBottom:10}}>
                        <span style={{fontSize:16}}>{s.icon}</span>
                        <p style={{color:t.sub,fontSize:10,fontWeight:600}}>{s.label}</p>
                      </div>
                      <p style={{color:s.color,fontWeight:900,fontSize:20,lineHeight:1}}>{s.value}</p>
                    </div>
                  ))}
                </div>
                {qcFails.length>0&&<div style={{padding:"8px 16px",background:"#ef444410",borderTop:`1px solid #ef444425`}}>
                  <p style={{color:"#ef4444",fontSize:11,fontWeight:700}}>⚠️ {qcFails.length} QC failure{qcFails.length!==1?"s":""} today — {qcFails.map(x=>x.product).join(", ")}</p>
                </div>}
              </div>;
            })()}

            {/* ── PRODUCTION ALERTS CENTER ── */}
            {(()=>{
              const alerts=[];
              const todayWasteAll=(wastage||[]).filter(w=>w.date===todayStr);
              const todayWasteQty=todayWasteAll.reduce((s,w)=>s+(+w.qty||0),0);
              const todayProducedQty=todayPT.reduce((s,x)=>s+(+x.actual||0),0);
              const todayQCFails=todayPT.filter(x=>x.qcGrade==="F");
              const todayQCTotal=todayPT.filter(x=>x.qcGrade);
              const todayQCPassPct=Math.round(todayPT.filter(x=>x.qcGrade&&x.qcGrade!=="F").length/Math.max(todayQCTotal.length,1)*100);
              // Wastage spike
              if(todayProducedQty>0&&todayWasteQty/todayProducedQty>0.08)alerts.push({sev:"red",icon:"🔥",title:"High Wastage Alert",msg:`${Math.round(todayWasteQty/todayProducedQty*100)}% of today's production wasted — threshold is 8%`});
              // QC failures
              if(todayQCFails.length>0)alerts.push({sev:"red",icon:"❌",title:"QC Failures Today",msg:`${todayQCFails.length} batch${todayQCFails.length!==1?"es":""} failed QC: ${todayQCFails.map(x=>x.product).join(", ")}`});
              // Low QC pass rate
              if(todayQCTotal.length>=2&&todayQCPassPct<70)alerts.push({sev:"orange",icon:"⚠️",title:"Low QC Pass Rate",msg:`Today's QC pass rate is ${todayQCPassPct}% — below 70% threshold`});
              // No production today
              if(todayPT.length===0)alerts.push({sev:"yellow",icon:"🏭",title:"No Batches Today",msg:"No production batches logged yet today. Tap + Log Batch to start."});
              // Overdue handovers: batches from yesterday with no handover
              const yesterdayBatches=prodTargets.filter(x=>x.date===yesterdayStr);
              const hvBatchIds=new Set((handovers||[]).map(h=>h.batchId).filter(Boolean));
              const overdueHV=yesterdayBatches.filter(x=>x.batchId&&!hvBatchIds.has(x.batchId));
              if(overdueHV.length>0)alerts.push({sev:"yellow",icon:"📋",title:"Missing Handovers",msg:`${overdueHV.length} yesterday's batch${overdueHV.length!==1?"es":""} have no handover note logged`});
              if(alerts.length===0)return null;
              const sevColors={red:"#ef4444",orange:"#f97316",yellow:"#f59e0b"};
              return <div style={{background:t.card,border:`1.5px solid #ef444425`,borderRadius:16,overflow:"hidden"}}>
                <div style={{padding:"26px 24px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:16}}>🚨</span>
                  <p style={{color:t.text,fontWeight:800,fontSize:13}}>Production Alerts</p>
                  <span style={{marginLeft:"auto",background:"#ef444415",color:"#ef4444",borderRadius:99,padding:"2px 10px",fontSize:11,fontWeight:800}}>{alerts.length}</span>
                </div>
                <div style={{padding:"22px 24px",display:"flex",flexDirection:"column",gap:10}}>
                  {alerts.map((a,i)=>{
                    const c=sevColors[a.sev]||"#6b7280";
                    return <div key={i} style={{display:"flex",alignItems:"flex-start",gap:20,background:c+"12",border:`1px solid ${c}25`,borderRadius:12,padding:"22px 22px"}}>
                      <span style={{fontSize:18,flexShrink:0,marginTop:1}}>{a.icon}</span>
                      <div>
                        <p style={{color:c,fontWeight:800,fontSize:12,marginBottom:14}}>{a.title}</p>
                        <p style={{color:t.text,fontSize:11,lineHeight:1.5}}>{a.msg}</p>
                      </div>
                    </div>;
                  })}
                </div>
              </div>;
            })()}

            {/* ── FACTORY FLOW TIMELINE ── */}
            {(()=>{
              // Build a chronological timeline of today's events across batches, QC, wastage, handovers
              const events=[];
              todayPT.forEach(r=>{
                if(r.createdAt||r.date)events.push({time:r.createdAt||r.date,icon:"🏭",color:"#8b5cf6",label:`${r.batchLabel||"Batch"} started`,sub:`${r.product} · ${r.actual||0} units`});
                if(r.qcGrade)events.push({time:r.createdAt||r.date,icon:r.qcGrade==="F"?"❌":"✅",color:r.qcGrade==="F"?"#ef4444":"#10b981",label:`QC ${r.qcGrade==="F"?"Failed":"Passed"} — ${r.batchLabel||"Batch"}`,sub:`Grade ${r.qcGrade}${r.qcNotes?` · ${r.qcNotes}`:""}`});
              });
              (qcLogs||[]).filter(q=>q.date===todayStr).forEach(q=>{
                events.push({time:q.createdAt||q.date,icon:q.grade==="F"?"❌":"✅",color:q.grade==="F"?"#ef4444":"#10b981",label:`QC check — ${q.product}`,sub:`Grade ${q.grade}${q.checker?` by ${q.checker}`:""}`});
              });
              (wastage||[]).filter(w=>w.date===todayStr).forEach(w=>{
                events.push({time:w.createdAt||w.date,icon:"🗑️",color:"#f97316",label:`Wastage: ${w.qty} ${w.unit} ${w.product}`,sub:`${w.type}${w.reason?` — ${w.reason}`:""}`});
              });
              (handovers||[]).filter(h=>h.date===todayStr).forEach(h=>{
                events.push({time:h.createdAt||h.date,icon:"📋",color:"#6366f1",label:`Shift Handover`,sub:`${h.shift||"—"} → ${h.nextShift||"next"}${h.loggedBy?` · ${h.loggedBy}`:""}`});
              });
              if(events.length===0)return null;
              // Sort by time string (createdAt timestamps sort naturally; date strings all same, preserve order)
              events.sort((a,b)=>(a.time||"").localeCompare(b.time||""));
              return <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,overflow:"hidden"}}>
                <div style={{padding:"26px 24px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:16}}>📈</span>
                  <p style={{color:t.text,fontWeight:800,fontSize:13}}>Today's Factory Flow</p>
                  <span style={{color:t.sub,fontSize:11,marginLeft:"auto"}}>{events.length} events</span>
                </div>
                <div style={{padding:"28px 24px",display:"flex",flexDirection:"column",gap:0}}>
                  {events.map((ev,i)=>(
                    <div key={i} style={{display:"flex",gap:24,position:"relative"}}>
                      {/* Vertical line */}
                      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:0,flexShrink:0}}>
                        <div style={{width:32,height:32,borderRadius:"50%",background:ev.color+"18",border:`2px solid ${ev.color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{ev.icon}</div>
                        {i<events.length-1&&<div style={{width:2,flex:1,minHeight:16,background:`linear-gradient(to bottom,${ev.color}30,transparent)`,margin:"2px 0"}}/>}
                      </div>
                      <div style={{paddingBottom:i<events.length-1?16:0,paddingTop:4,flex:1,minWidth:0}}>
                        <p style={{color:t.text,fontWeight:700,fontSize:12,lineHeight:1.3}}>{ev.label}</p>
                        {ev.sub&&<p style={{color:t.sub,fontSize:10,marginTop:2,lineHeight:1.4}}>{ev.sub}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>;
            })()}

            {/* ── SHIFT PERFORMANCE COMPARISON ── */}
            {(()=>{
              const shifts=(settings?.shifts||["Morning","Afternoon","Evening","Night"]);
              const shiftData=shifts.map(sh=>{
                const recs=filteredPT.filter(x=>x.shift===sh);
                if(recs.length===0)return null;
                const units=recs.reduce((s,x)=>s+(+x.actual||0),0);
                const qcChecks=recs.filter(x=>x.qcGrade);
                const qcPass=qcChecks.filter(x=>x.qcGrade!=="F").length;
                const passPct=Math.round(qcPass/Math.max(qcChecks.length,1)*100);
                const wasteRecs=(wastage||[]).filter(w=>w.shift===sh&&(filterDates?filterDates.includes(w.date):true));
                const wasteQty=wasteRecs.reduce((s,w)=>s+(+w.qty||0),0);
                return {shift:sh,batches:recs.length,units,passPct,wasteQty};
              }).filter(Boolean);
              if(shiftData.length<2)return null;
              const maxUnits=Math.max(...shiftData.map(s=>s.units),1);
              const shiftColors={"Morning":"#f59e0b","Afternoon":"#3b82f6","Evening":"#8b5cf6","Night":"#6366f1"};
              return <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,overflow:"hidden"}}>
                <div style={{padding:"26px 24px",borderBottom:`1px solid ${t.border}`}}>
                  <p style={{color:t.text,fontWeight:800,fontSize:13}}>⚡ Shift Performance</p>
                  <p style={{color:t.sub,fontSize:11,marginTop:14}}>{filteredPeriodLabel}</p>
                </div>
                <div style={{padding:"28px 24px",display:"flex",flexDirection:"column",gap:14}}>
                  {shiftData.map(s=>{
                    const col=shiftColors[s.shift]||"#6b7280";
                    const barPct=Math.round(s.units/maxUnits*100);
                    return <div key={s.shift}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4,flexWrap:"wrap",gap:4}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{background:col+"20",color:col,borderRadius:6,padding:"5px 12px",fontSize:11,fontWeight:700}}>{s.shift}</span>
                          <span style={{color:t.sub,fontSize:11}}>{s.batches} batch{s.batches!==1?"es":""}</span>
                        </div>
                        <div style={{display:"flex",gap:10}}>
                          <span style={{color:t.text,fontSize:11,fontWeight:700}}>{s.units.toLocaleString("en-IN")} units</span>
                          <span style={{color:s.passPct>=80?"#10b981":s.passPct>=60?"#f59e0b":"#ef4444",fontSize:11,fontWeight:700}}>QC {s.passPct}%</span>
                          {s.wasteQty>0&&<span style={{color:"#f97316",fontSize:11,fontWeight:600}}>🗑️ {s.wasteQty}</span>}
                        </div>
                      </div>
                      <div style={{height:7,background:t.border,borderRadius:99,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${barPct}%`,background:col,borderRadius:99,transition:"width 0.5s ease"}}/>
                      </div>
                    </div>;
                  })}
                </div>
              </div>;
            })()}

            {/* ── SMART WASTAGE INSIGHTS ── */}
            {filteredWaste.length>=3&&(()=>{
              const insights=[];
              const byType=(()=>{const m={};filteredWaste.forEach(w=>{if(!m[w.type])m[w.type]=0;m[w.type]+=(+w.qty||0);});return m;})();
              const topType=Object.entries(byType).sort((a,b)=>b[1]-a[1])[0];
              if(topType)insights.push({icon:"🔥",text:`"${topType[0]}" is your biggest wastage type — ${topType[1]} units lost`,color:"#ef4444"});
              const byShift=(()=>{const m={};filteredWaste.forEach(w=>{if(!w.shift)return;if(!m[w.shift])m[w.shift]=0;m[w.shift]+=(+w.qty||0);});return m;})();
              const topShift=Object.entries(byShift).sort((a,b)=>b[1]-a[1])[0];
              if(topShift)insights.push({icon:"🌙",text:`Most wastage happens during ${topShift[0]} shift — ${topShift[1]} units`,color:"#f59e0b"});
              const byProd=(()=>{const m={};filteredWaste.forEach(w=>{const k=w.product||"Unknown";if(!m[k])m[k]=0;m[k]+=(+w.qty||0);});return m;})();
              const topProd=Object.entries(byProd).sort((a,b)=>b[1]-a[1])[0];
              if(topProd)insights.push({icon:"📦",text:`"${topProd[0]}" has the highest reject rate — ${topProd[1]} units wasted`,color:"#8b5cf6"});
              const totalUnitsProduced=filteredPT.reduce((s,x)=>s+(+x.actual||0),0);
              const totalWasteQty=filteredWaste.reduce((s,w)=>s+(+w.qty||0),0);
              const wastePct=totalUnitsProduced>0?Math.round(totalWasteQty/totalUnitsProduced*100):0;
              if(wastePct>5)insights.push({icon:"⚠️",text:`Wastage is ${wastePct}% of total production — above 5% threshold`,color:"#ef4444"});
              if(insights.length===0)return null;
              return <div style={{background:t.card,border:`1.5px solid #8b5cf625`,borderRadius:16,overflow:"hidden"}}>
                <div style={{padding:"22px 24px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:16}}>💡</span>
                  <p style={{color:t.text,fontWeight:800,fontSize:13}}>Smart Wastage Insights</p>
                </div>
                <div style={{padding:"22px 24px",display:"flex",flexDirection:"column",gap:8}}>
                  {insights.map((ins,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"flex-start",gap:20,background:ins.color+"10",borderRadius:10,padding:"18px 20px",border:`1px solid ${ins.color}20`}}>
                      <span style={{fontSize:15,flexShrink:0}}>{ins.icon}</span>
                      <p style={{color:t.text,fontSize:12,fontWeight:600,lineHeight:1.5}}>{ins.text}</p>
                    </div>
                  ))}
                </div>
              </div>;
            })()}

            {/* ── Wastage Summary Widget ── */}
            {filteredWaste.length>0&&(()=>{
              const totalWasteQty=filteredWaste.reduce((s,w)=>s+(+w.qty||0),0);
              const totalWasteCost=filteredWaste.reduce((s,w)=>s+(+w.cost||0),0);
              const byType=(()=>{const m={};filteredWaste.forEach(w=>{if(!m[w.type])m[w.type]={count:0,qty:0,cost:0};m[w.type].count++;m[w.type].qty+=(+w.qty||0);m[w.type].cost+=(+w.cost||0);});return Object.entries(m).sort((a,b)=>b[1].qty-a[1].qty);})();
              const byProduct=(()=>{const m={};filteredWaste.forEach(w=>{const k=w.product||"Unknown";if(!m[k])m[k]={count:0,qty:0,cost:0};m[k].count++;m[k].qty+=(+w.qty||0);m[k].cost+=(+w.cost||0);});return Object.entries(m).sort((a,b)=>b[1].qty-a[1].qty);})();
              const typeColors={"Burnt":"#ef4444","Broken":"#f97316","Expired":"#eab308","Overproduced":"#8b5cf6","Quality Reject":"#ec4899","Other":"#6b7280"};
              const maxQty=Math.max(...byType.map(([,v])=>v.qty),1);
              return <div style={{background:t.card,border:`1.5px solid #f9731630`,borderRadius:16,overflow:"hidden"}}>
                {/* Widget header */}
                <div style={{background:`linear-gradient(135deg,${dm?"#431407":"#fff7ed"},${dm?"#1c1917":"#ffedd5"})`,padding:"22px 24px",borderBottom:`1px solid #f9731620`,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:18}}>🗑️</span>
                    <div>
                      <p style={{color:"#f97316",fontWeight:800,fontSize:13}}>Wastage Overview</p>
                      <p style={{color:t.sub,fontSize:10}}>{filteredPeriodLabel} · {filteredWaste.length} records</p>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:12}}>
                    <div style={{textAlign:"right"}}>
                      <p style={{color:"#f97316",fontWeight:900,fontSize:18,lineHeight:1}}>{totalWasteQty.toLocaleString("en-IN")}</p>
                      <p style={{color:t.sub,fontSize:9,fontWeight:600,textTransform:"uppercase"}}>Total units lost</p>
                    </div>
                    {totalWasteCost>0&&<div style={{textAlign:"right"}}>
                      <p style={{color:"#ef4444",fontWeight:900,fontSize:18,lineHeight:1}}>{inr(totalWasteCost)}</p>
                      <p style={{color:t.sub,fontSize:9,fontWeight:600,textTransform:"uppercase"}}>Cost impact</p>
                    </div>}
                  </div>
                </div>
                <div style={{padding:"26px 24px",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:16}}>
                  {/* By type breakdown with bars */}
                  <div>
                    <p style={{color:t.sub,fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:16}}>By Type</p>
                    <div style={{display:"flex",flexDirection:"column",gap:5}}>
                      {byType.map(([type,v])=>{
                        const c=typeColors[type]||"#6b7280";
                        const pct=Math.round(v.qty/maxQty*100);
                        return <div key={type}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
                            <span style={{color:t.text,fontSize:11,fontWeight:600}}>{type}</span>
                            <span style={{color:c,fontSize:11,fontWeight:700}}>{v.qty} {v.cost>0?`· ${inr(v.cost)}`:""}</span>
                          </div>
                          <div style={{height:5,background:t.border,borderRadius:99,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${pct}%`,background:c,borderRadius:99,transition:"width 0.3s"}}/>
                          </div>
                        </div>;
                      })}
                    </div>
                  </div>
                  {/* By product breakdown */}
                  <div>
                    <p style={{color:t.sub,fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:16}}>By Product</p>
                    <div style={{display:"flex",flexDirection:"column",gap:4}}>
                      {byProduct.map(([prod,v])=>(
                        <div key={prod} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:t.inp,borderRadius:8,padding:"8px 14px"}}>
                          <span style={{color:t.text,fontSize:11,fontWeight:600,flex:1,minWidth:0}} className="truncate">{prod}</span>
                          <div style={{display:"flex",gap:18,flexShrink:0}}>
                            <span style={{color:"#f97316",fontWeight:700,fontSize:11}}>{v.qty} units</span>
                            {v.cost>0&&<span style={{color:"#ef4444",fontWeight:600,fontSize:10}}>{inr(v.cost)}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Recent wastage entries */}
                <div style={{borderTop:`1px solid ${t.border}`,padding:"8px 16px 12px"}}>
                  <p style={{color:t.sub,fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:14}}>Recent Entries</p>
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    {filteredWaste.slice(0,5).map(w=>(
                      <div key={w.id} style={{display:"flex",alignItems:"center",gap:18,padding:"4px 0",borderBottom:`1px solid ${t.border}`}} className="last:border-0">
                        <span style={{background:(typeColors[w.type]||"#6b7280")+"18",color:typeColors[w.type]||"#6b7280",borderRadius:6,padding:"1px 7px",fontSize:9,fontWeight:700,flexShrink:0}}>{w.type}</span>
                        <span style={{color:t.text,fontSize:11,fontWeight:600,flex:1,minWidth:0}} className="truncate">{w.product}</span>
                        <span style={{color:t.sub,fontSize:10,flexShrink:0}}>{w.qty} {w.unit}</span>
                        {w.cost>0&&<span style={{color:"#ef4444",fontSize:10,fontWeight:700,flexShrink:0}}>{inr(w.cost)}</span>}
                        <span style={{color:t.sub,fontSize:9,flexShrink:0}}>{w.date}</span>
                      </div>
                    ))}
                    {filteredWaste.length>5&&<button onClick={()=>setProdSubTab("wastage")} style={{color:"#f97316",fontSize:10,fontWeight:700,background:"none",border:"none",cursor:"pointer",textAlign:"left",padding:"2px 0"}}>View all {filteredWaste.length} records →</button>}
                  </div>
                </div>
              </div>;
            })()}

            {/* ── Sub-Tab Switcher ── */}
            <div style={{display:"flex",gap:20,background:t.inp,borderRadius:14,padding:4,overflowX:"auto"}}>
              {[["batches","🏭","Batches"],["kanban","📌","Kanban"],["schedule","📅","Schedule"],["wastage","🗑️","Wastage"],["qc","✅","QC"],["handover","📋","Handover"]].map(([val,icon,label])=>(
                <button key={val} onClick={()=>setProdSubTab(val)}
                  style={{flex:1,minWidth:56,background:prodSubTab===val?t.card:"transparent",color:prodSubTab===val?t.text:t.sub,border:prodSubTab===val?`1px solid ${t.border}`:"1px solid transparent",borderRadius:10,padding:"9px 6px",fontSize:11,fontWeight:prodSubTab===val?800:600,cursor:"pointer",transition:"all 0.15s",display:"flex",alignItems:"center",justifyContent:"center",gap:20,whiteSpace:"nowrap"}}>
                  <span>{icon}</span><span className="hidden sm:inline">{label}</span>
                  {val==="wastage"&&filteredWaste.length>0&&<span style={{background:"#f97316",color:"#fff",borderRadius:99,padding:"0 5px",fontSize:9,fontWeight:800,minWidth:16,textAlign:"center"}}>{filteredWaste.length}</span>}
                  {val==="qc"&&filteredQC.length>0&&<span style={{background:"#14b8a6",color:"#fff",borderRadius:99,padding:"0 5px",fontSize:9,fontWeight:800,minWidth:16,textAlign:"center"}}>{filteredQC.length}</span>}
                  {val==="handover"&&(handovers||[]).length>0&&<span style={{background:"#6366f1",color:"#fff",borderRadius:99,padding:"0 5px",fontSize:9,fontWeight:800,minWidth:16,textAlign:"center"}}>{(handovers||[]).length}</span>}
                </button>
              ))}
            </div>

            {/* ── Filter Bar ── */}
            <div style={{background:t.card,border:`1.5px solid ${t.inpB}`,borderRadius:14,overflow:"hidden"}}>
              {/* Search row */}
              <div style={{display:"flex",alignItems:"center",gap:18,padding:"0 14px",minHeight:50,borderBottom:ptShowFilters?`1px solid ${t.border}`:"none"}}>
                <span style={{color:t.sub,fontSize:14,flexShrink:0}}>🔍</span>
                <input value={ptSearch} onChange={e=>setPtSearch(e.target.value)} placeholder="Search batch, product, notes…"
                  style={{flex:1,background:"transparent",border:"none",outline:"none",color:t.text,fontSize:14,padding:"10px 0"}}/>
                {ptSearch&&<button onClick={()=>setPtSearch("")} style={{color:t.sub,fontSize:18,background:"none",border:"none",cursor:"pointer",minWidth:28,padding:0}}>×</button>}
                <button onClick={()=>setPtShowFilters(f=>!f)}
                  style={{display:"flex",alignItems:"center",gap:20,background:ptShowFilters?(dm?"#f59e0b":"#1c1917"):t.inp,color:ptShowFilters?(dm?"#000":"#fff"):t.sub,border:"none",borderRadius:9,padding:"7px 14px",fontSize:11,fontWeight:700,cursor:"pointer",transition:"all 0.15s",minHeight:34,flexShrink:0,whiteSpace:"nowrap"}}>
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M4 7h6M6 10h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                  Filters{(ptShiftFilter!=="all"||ptDateFilter!=="all"||ptProductFilter!=="all"||ptWasteTypeFilter!=="all"||ptQcGradeFilter!=="all"||ptHandoverFilter!=="all")&&<span style={{background:"#ef4444",color:"#fff",borderRadius:99,width:16,height:16,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,marginLeft:2}}>{[ptShiftFilter!=="all",ptDateFilter!=="all",ptProductFilter!=="all",ptWasteTypeFilter!=="all",ptQcGradeFilter!=="all",ptHandoverFilter!=="all"].filter(Boolean).length}</span>}
                </button>
              </div>
              {/* Expanded filter panel */}
              {ptShowFilters&&<div style={{padding:"24px 24px",display:"flex",flexDirection:"column",gap:12}}>
                {/* Date range */}
                <div>
                  <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:14}}>Date Range</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {[["today","Today"],["yesterday","Yesterday"],["week","7 Days"],["month","30 Days"],["all","All Time"],["custom","Custom"]].map(([val,label])=>(
                      <button key={val} onClick={()=>setPtDateFilter(val)}
                        style={{background:ptDateFilter===val?(dm?"#f59e0b":"#1c1917"):t.inp,color:ptDateFilter===val?(dm?"#000":"#fff"):t.sub,borderRadius:99,padding:"8px 16px",fontSize:11,fontWeight:700,border:"none",cursor:"pointer",transition:"all 0.15s"}}>{label}</button>
                    ))}
                  </div>
                  {ptDateFilter==="custom"&&<div className="flex gap-2 items-center mt-2 flex-wrap">
                    <div style={{background:t.inp,border:`1px solid ${t.inpB}`,borderRadius:9,padding:"5px 11px",display:"flex",alignItems:"center",gap:6}}>
                      <span style={{color:t.sub,fontSize:10,fontWeight:600}}>From</span>
                      <input type="date" value={ptCustomFrom} onChange={e=>setPtCustomFrom(e.target.value)} style={{background:"transparent",border:"none",outline:"none",color:t.text,fontSize:12}}/>
                    </div>
                    <span style={{color:t.sub}}>→</span>
                    <div style={{background:t.inp,border:`1px solid ${t.inpB}`,borderRadius:9,padding:"5px 11px",display:"flex",alignItems:"center",gap:6}}>
                      <span style={{color:t.sub,fontSize:10,fontWeight:600}}>To</span>
                      <input type="date" value={ptCustomTo} onChange={e=>setPtCustomTo(e.target.value)} style={{background:"transparent",border:"none",outline:"none",color:t.text,fontSize:12}}/>
                    </div>
                  </div>}
                </div>
                {/* Shift */}
                <div>
                  <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:14}}>Shift</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {[["all","All"],["none","No Shift"],...(settings?.shifts||["Morning","Afternoon","Evening","Night"]).map(s=>[s,s])].map(([val,label])=>(
                      <button key={val} onClick={()=>setPtShiftFilter(val)}
                        style={{background:ptShiftFilter===val?"#f59e0b":t.inp,color:ptShiftFilter===val?"#000":t.sub,borderRadius:99,padding:"8px 16px",fontSize:11,fontWeight:700,border:"none",cursor:"pointer",transition:"all 0.15s"}}>{label}</button>
                    ))}
                  </div>
                </div>
                {/* Product */}
                <div>
                  <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:14}}>Product</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {[["all","All Products"],...(prodItems||[]).map(p=>[p.name,p.name])].map(([val,label])=>(
                      <button key={val} onClick={()=>setPtProductFilter(val)}
                        style={{background:ptProductFilter===val?"#8b5cf6":t.inp,color:ptProductFilter===val?"#fff":t.sub,borderRadius:99,padding:"8px 16px",fontSize:11,fontWeight:700,border:"none",cursor:"pointer",transition:"all 0.15s"}}>{label}</button>
                    ))}
                  </div>
                </div>
                {/* Wastage type */}
                <div>
                  <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:14}}>Wastage Type</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {[["all","All"],...(settings?.wastageTypes||["Burnt","Broken","Expired","Overproduced","Quality Reject","Other"]).map(wt=>[wt,wt])].map(([val,label])=>(
                      <button key={val} onClick={()=>setPtWasteTypeFilter(val)}
                        style={{background:ptWasteTypeFilter===val?"#f97316":t.inp,color:ptWasteTypeFilter===val?"#fff":t.sub,borderRadius:99,padding:"8px 16px",fontSize:11,fontWeight:700,border:"none",cursor:"pointer",transition:"all 0.15s"}}>{label}</button>
                    ))}
                  </div>
                </div>
                {/* QC Grade */}
                <div>
                  <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:14}}>QC Grade</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {[["all","All"],["A","A — Pass"],["B","B — Pass"],["C","C — Marginal"],["F","F — Fail"]].map(([val,label])=>(
                      <button key={val} onClick={()=>setPtQcGradeFilter(val)}
                        style={{background:ptQcGradeFilter===val?"#14b8a6":t.inp,color:ptQcGradeFilter===val?"#fff":t.sub,borderRadius:99,padding:"8px 16px",fontSize:11,fontWeight:700,border:"none",cursor:"pointer",transition:"all 0.15s"}}>{label}</button>
                    ))}
                  </div>
                </div>
                {/* Handover */}
                <div>
                  <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:14}}>Handover</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {[["all","All Batches"],["with","Has Handover 🤝"],["without","No Handover"]].map(([val,label])=>(
                      <button key={val} onClick={()=>setPtHandoverFilter(val)}
                        style={{background:ptHandoverFilter===val?"#6366f1":t.inp,color:ptHandoverFilter===val?"#fff":t.sub,borderRadius:99,padding:"8px 16px",fontSize:11,fontWeight:700,border:"none",cursor:"pointer",transition:"all 0.15s"}}>{label}</button>
                    ))}
                  </div>
                </div>
                {/* Reset */}
                {(ptShiftFilter!=="all"||ptDateFilter!=="all"||ptProductFilter!=="all"||ptWasteTypeFilter!=="all"||ptQcGradeFilter!=="all"||ptHandoverFilter!=="all"||ptSearch)&&
                  <button onClick={()=>{setPtShiftFilter("all");setPtDateFilter("all");setPtProductFilter("all");setPtWasteTypeFilter("all");setPtQcGradeFilter("all");setPtHandoverFilter("all");setPtSearch("");}}
                    style={{background:"#ef444415",color:"#ef4444",border:"1px solid #ef444430",borderRadius:9,padding:"7px 0",fontSize:12,fontWeight:700,cursor:"pointer",width:"100%"}}>✕ Clear All Filters</button>}
              </div>}
            </div>

            {/* ── BATCHES ── */}
            {prodSubTab==="batches"&&<div style={{display:"flex",flexDirection:"column",gap:28}}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div style={{display:"flex",gap:18,flexWrap:"wrap",alignItems:"center"}}>
                  <Pill dm={dm} c="purple">{filteredPT.length} runs · {filteredPT.reduce((s,x)=>s+(+x.actual||0),0)} units</Pill>
                  {deliveries.filter(d=>d.date===todayStr&&d.status!=="Cancelled").length>0&&<Pill dm={dm} c="sky">{deliveries.filter(d=>d.date===todayStr&&d.status!=="Cancelled").length} customers today</Pill>}
                </div>
                <div className="crm-btn-group">
                  <Btn dm={dm} v="outline" size="sm" onClick={()=>exportTabPDF("Production",filteredPT,[{label:"Date",key:"date"},{label:"Batch",key:"batchLabel"},{label:"Product",key:"product"},{label:"Shift",key:"shift"},{label:"Qty",key:"actual",num:true},{label:"QC",key:"qcGrade"},{label:"Linked Invoices",val:r=>(r.linkedInvoices||[]).join(", ")},{label:"Notes",key:"notes"}],settings)}>PDF</Btn>
                  <Btn dm={dm} v="outline" size="sm" onClick={()=>exportTabExcel("Production",filteredPT,[{label:"Date",key:"date"},{label:"Batch",key:"batchLabel"},{label:"Product",key:"product"},{label:"Shift",key:"shift"},{label:"Qty Produced",key:"actual",num:true},{label:"QC Grade",key:"qcGrade"},{label:"Linked Invoices",val:r=>(r.linkedInvoices||[]).join(", ")},{label:"Notes",key:"notes"}],settings)}>XLS</Btn>
                  <Btn dm={dm} v="outline" size="sm" onClick={()=>exportCSV(filteredPT,"production",[{label:"Date",key:"date"},{label:"Batch",key:"batchLabel"},{label:"Product",key:"product"},{label:"Shift",key:"shift"},{label:"Qty Produced",key:"actual"},{label:"QC Grade",key:"qcGrade"},{label:"Linked Invoices",val:r=>(r.linkedInvoices||[]).join("; ")},{label:"Notes",key:"notes"}])}>CSV</Btn>
                </div>
              </div>
              {uniqueDates.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-8">{prodTargets.length===0?"No batches yet. Tap + New Batch to start.":ptSearch?"No matches.":"No records for this period."}</p>}
              {uniqueDates.map(date=>{
                const dayRecs=filteredPT.filter(x=>x.date===date).sort((a,b)=>(a.batchLabel||"").localeCompare(b.batchLabel||""));
                const dayQty=dayRecs.reduce((s,x)=>s+(+x.actual||0),0);
                const dayLabel=date===todayStr?"Today":date===yesterdayStr?"Yesterday":new Date(date+"T00:00:00").toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"});
                const dayWaste=(wastage||[]).filter(w=>w.date===date);
                const dayDelivsAll=deliveries.filter(d=>d.date===date&&d.status!=="Cancelled");
                return <Card key={date} dm={dm}><div style={{padding:"28px 28px 12px"}}>
                  {/* Day header */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p style={{color:t.text,fontWeight:900,fontSize:15}}>{dayLabel}</p>
                      <div style={{display:"flex",gap:18,flexWrap:"wrap",marginTop:16}}>
                        <span style={{background:"#8b5cf620",color:"#8b5cf6",borderRadius:6,padding:"8px 16px",fontSize:10,fontWeight:700}}>🏭 {dayRecs.length} batch{dayRecs.length!==1?"es":""}</span>
                        <span style={{background:"#6366f120",color:"#6366f1",borderRadius:6,padding:"8px 16px",fontSize:10,fontWeight:700}}>📦 {dayQty} units</span>
                        {dayDelivsAll.length>0&&<span style={{background:"#7c3aed20",color:"#7c3aed",borderRadius:6,padding:"8px 16px",fontSize:10,fontWeight:700}}>👥 {dayDelivsAll.length} customers</span>}
                        {dayWaste.length>0&&<span style={{background:"#f9731620",color:"#f97316",borderRadius:6,padding:"8px 16px",fontSize:10,fontWeight:700}}>⚠️ {dayWaste.length} wastage</span>}
                      </div>
                    </div>
                  </div>
                  {dayRecs.map((r,ri)=>{
                    const rWaste=(wastage||[]).filter(w=>w.batchId===r.batchId);
                    const rQC=(qcLogs||[]).filter(q=>q.batchId===r.batchId);
                    const rHV=(handovers||[]).filter(h=>h.batchId===r.batchId);
                    const recipeIngrs=(settings?.recipes||{})[products.find(p=>p.name===r.product)?.id||""]?.ingredients||[];
                    const batchIdLinkedDelivs=deliveries.filter(d=>d.batchId===r.batchId&&d.status!=="Cancelled");
                    const unlinkedSameDateDelivs=deliveries.filter(d=>d.date===r.date&&d.status!=="Cancelled"&&!d.batchId)
                      .filter(d=>Object.entries(safeO(d.orderLines)).some(([pid,l])=>{if(!(l.qty>0))return false;const p=products.find(x=>x.id===pid);return prodNamesMatch(p?.name||l.name||"",r.product);}));
                    const batchCustomers=batchIdLinkedDelivs.length>0?batchIdLinkedDelivs:unlinkedSameDateDelivs;
                    // expandable: store expanded state via a data attribute trick (use class toggle via inline state workaround)
                    const batchExpandId=`expand-${r.batchId||r.id}`;
                    return <div key={r.id} style={{borderTop:ri>0?`1px solid ${t.border}`:"none",paddingTop:ri>0?18:0,marginTop:ri>0?18:0}}>
                      <div className="flex items-start justify-between gap-2">
                        <div style={{flex:1}}>
                          {/* Batch identity header */}
                          <div style={{background:dm?"rgba(139,92,246,0.15)":"rgba(139,92,246,0.08)",border:`1px solid rgba(139,92,246,0.3)`,borderRadius:12,padding:"22px 22px",marginBottom:10}}>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:18,flexWrap:"wrap",marginBottom:16}}>
                              <div style={{display:"flex",alignItems:"center",gap:18,flexWrap:"wrap"}}>
                                <span style={{background:"#8b5cf6",color:"#fff",borderRadius:7,padding:"10px 20px",fontSize:12,fontWeight:900}}>{r.batchLabel||"Batch"}</span>
                                <span style={{color:"#8b5cf6",fontWeight:700,fontSize:13}}>{r.product}</span>
                              </div>
                              <div style={{display:"flex",gap:20,flexWrap:"wrap",justifyContent:"flex-end"}}>
                                {r.shift&&<span style={{background:"#f59e0b20",color:"#f59e0b",borderRadius:6,padding:"9px 18px",fontSize:10,fontWeight:700}}>🕐 {r.shift}</span>}
                                {r.qcGrade&&<span style={{background:gradeColor(r.qcGrade)+"20",color:gradeColor(r.qcGrade),borderRadius:6,padding:"9px 18px",fontSize:10,fontWeight:700}}>QC: {r.qcGrade}</span>}
                                {rWaste.length>0&&<span style={{background:"#f9731618",color:"#f97316",borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:700}}>🗑️ {rWaste.length}</span>}
                                {rQC.length>0&&<span style={{background:"#14b8a618",color:"#14b8a6",borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:700}}>✅ {rQC.length}</span>}
                                {rHV.length>0&&<span style={{background:"#6366f118",color:"#6366f1",borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:700}}>📋 {rHV.length}</span>}
                              </div>
                            </div>
                            {/* Units big number + expand toggle */}
                            <div style={{display:"flex",alignItems:"center",gap:10}}>
                              <div style={{display:"flex",alignItems:"baseline",gap:6}}>
                                <p style={{color:"#8b5cf6",fontWeight:900,fontSize:28,lineHeight:1}}>{r.actual||0}</p>
                                <span style={{color:t.sub,fontSize:12}}>units produced</span>
                              </div>
                              {(r.linkedInvoices||[]).length>0&&<div style={{marginLeft:8,display:"flex",gap:3,flexWrap:"wrap"}}>
                                {(r.linkedInvoices||[]).map(inv=><span key={inv} style={{background:dm?"rgba(139,92,246,0.2)":"rgba(139,92,246,0.1)",color:"#7c3aed",borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:700,fontFamily:"monospace"}}>📄 {inv}</span>)}
                              </div>}
                              <button
                                onClick={e=>{const el=e.currentTarget.closest("[data-expand-root]");if(el){const body=el.querySelector("[data-expand-body]");if(body){body.style.display=body.style.display==="none"?"block":"none";e.currentTarget.textContent=body.style.display==="none"?"Show details ▾":"Hide ▴";}}}}
                                style={{marginLeft:"auto",background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 11px",fontSize:10,fontWeight:700,cursor:"pointer",flexShrink:0}}>Show details ▾</button>
                            </div>
                          </div>
                          {/* Expandable body */}
                          <div data-expand-root="">
                            <div data-expand-body="" style={{display:"none"}}>
                          {/* Customer Traceability inline */}
                          {batchCustomers.length>0&&<div style={{background:dm?"rgba(124,58,237,0.08)":"rgba(124,58,237,0.04)",border:`1px solid rgba(124,58,237,0.2)`,borderRadius:12,padding:"20px 20px",marginBottom:10}}>
                            <p style={{color:"#7c3aed",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:16}}>📦 Customers receiving from this batch ({batchCustomers.length})</p>
                            <div style={{display:"flex",flexDirection:"column",gap:5}}>
                              {batchCustomers.slice(0,5).map(d=>{
                                const dInvNo=(invRegistry?.issued||{})[d.id]||d.invNo||null;
                                const sc=d.status==="Delivered"?"#10b981":d.status==="In Transit"?"#3b82f6":"#f59e0b";
                                const prodQty=Object.entries(safeO(d.orderLines)).filter(([pid,l])=>{if(!(l.qty>0))return false;const p=products.find(x=>x.id===pid);const pName=p?.name||l.name||"";return pName===r.product||pName.toLowerCase().includes((r.product||"").toLowerCase())||(r.product||"").toLowerCase().includes(pName.toLowerCase());}).reduce((s,[,l])=>s+(+l.qty||0),0);
                                return <div key={d.id} style={{display:"flex",alignItems:"center",gap:18,padding:"5px 0",borderBottom:`1px solid ${t.border}`}}>
                                  <span style={{width:6,height:6,borderRadius:"50%",background:sc,flexShrink:0}}/>
                                  <span style={{color:t.text,fontSize:11,fontWeight:600,flex:1,minWidth:0}} className="truncate">{d.customer}</span>
                                  {dInvNo&&<span style={{color:"#8b5cf6",fontSize:9,fontWeight:700,fontFamily:"monospace",flexShrink:0}}>📄{dInvNo}</span>}
                                  <span style={{color:"#7c3aed",fontSize:11,fontWeight:700,flexShrink:0}}>{prodQty} u</span>
                                </div>;
                              })}
                              {batchCustomers.length>5&&<p style={{color:t.sub,fontSize:10,textAlign:"center",paddingTop:4}}>+{batchCustomers.length-5} more customers…</p>}
                            </div>
                          </div>}
                          {r.notes&&<p style={{color:t.sub,fontSize:11,fontStyle:"italic",marginBottom:16}}>"{r.notes}"</p>}
                          {r.deduction&&<div style={{background:"#10b98110",border:"1px solid #10b98130",borderRadius:8,padding:"5px 10px",marginBottom:8,display:"inline-flex",alignItems:"center",gap:6}}>
                            <span style={{fontSize:10}}>📦</span>
                            <span style={{color:"#10b981",fontSize:10,fontWeight:700}}>Auto-deducted {r.deduction.deducted} from "{r.deduction.supplyItem}"</span>
                          </div>}
                          {recipeIngrs.length>0&&+r.actual>0&&<div style={{background:t.inp,borderRadius:10,padding:"16px 20px",marginBottom:16}}>
                            <p style={{color:t.sub,fontSize:10,fontWeight:700,marginBottom:10}}>🧪 Recipe used ({r.actual} units):</p>
                            {recipeIngrs.map((ing,ii)=><p key={ii} style={{color:t.text,fontSize:11,marginBottom:14}}>• {(+ing.qtyPerUnit*(+r.actual)).toFixed(2)} {ing.unit} {ing.supply}</p>)}
                          </div>}
                          {rWaste.length>0&&<div className="flex flex-wrap gap-1.5 mb-2">
                            {rWaste.map(w=><span key={w.id} style={{background:"#f9731618",color:"#f97316",borderRadius:6,padding:"9px 18px",fontSize:10,fontWeight:700}}>🗑️ {w.qty} {w.unit} {w.product} — {w.type}</span>)}
                          </div>}
                          {rQC.length>0&&<div className="flex flex-wrap gap-1.5 mb-2">
                            {rQC.map(q=><span key={q.id} style={{background:gradeColor(q.grade)+"18",color:gradeColor(q.grade),borderRadius:6,padding:"9px 18px",fontSize:10,fontWeight:700}}>✅ QC {q.grade} — {q.product}{q.checker?" by "+q.checker:""}</span>)}
                          </div>}
                          {rHV.length>0&&<div className="flex flex-wrap gap-1.5 mb-1">
                            {rHV.map(h=><span key={h.id} style={{background:"#6366f118",color:"#6366f1",borderRadius:6,padding:"9px 18px",fontSize:10,fontWeight:700}}>📋 {h.shift||"Handover"}{h.nextShift?" → "+h.nextShift:""}</span>)}
                          </div>}
                          </div></div>{/* end expandable */}
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={()=>{
                            const existingWaste=(wastage||[]).filter(w=>w.batchId===r.batchId);
                            const existingQC=(qcLogs||[]).filter(q=>q.batchId===r.batchId);
                            const existingHV=(handovers||[]).filter(h=>h.batchId===r.batchId);
                            setPtF({...r,actual:String(r.actual),embWastage:existingWaste.map(w=>({...w})),embQC:existingQC.map(q=>({...q})),embHandover:existingHV.map(h=>({...h}))});
                            setPtSh(r);
                          }} style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,minHeight:40,padding:"0 12px",borderRadius:10,fontSize:12,fontWeight:600,cursor:"pointer"}}>Edit</button>
                          {can("prod_delete")&&<button onClick={()=>delPT(r)} style={{background:"#dc2626",color:"#fff",minHeight:40,padding:"0 12px",borderRadius:10,fontSize:12,fontWeight:700,cursor:"pointer",border:"none"}}>Del</button>}
                        </div>
                      </div>
                    </div>;
                  })}
                  {/* Customer paper trail for this date — full detail */}
                  {(()=>{
                    const dayDelivs=deliveries.filter(d=>d.date===date&&d.status==="Delivered");
                    if(dayDelivs.length===0)return null;
                    const totalUnits=dayRecs.reduce((s,x)=>s+(+x.actual||0),0);
                    const exportTrailPDF=()=>{
                      const co=settings?.companyName||"TAS Healthy World";
                      const cosub=settings?.companySubtitle||"Malabar Paratha Factory · Goa, India";
                      const now=new Date().toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
                      const dateLabel=new Date(date+"T00:00:00").toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
                      const totalOrderVal=dayDelivs.reduce((s,d)=>s+lineTotal(d.orderLines),0);
                      const totalReplAmt=dayDelivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
                      const totalNet=totalOrderVal-totalReplAmt;
                      const totalCollected=dayDelivs.reduce((s,d)=>s+(d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0),0);
                      const totalBalance=Math.max(0,totalNet-totalCollected);
                      const batchRows=dayRecs.map(r=>{
                        const recipeIngrs=(settings?.recipes||{})[products.find(p=>p.name===r.product)?.id||""]?.ingredients||[];
                        const ingredientStr=recipeIngrs.length>0&&+r.actual>0?recipeIngrs.map(ing=>`${(+ing.qtyPerUnit*(+r.actual)).toFixed(2)} ${ing.unit} ${ing.supply}`).join(", "):"—";
                        return `<tr><td><b>${r.batchLabel||"Batch"}</b></td><td>${r.product}</td><td>${r.shift||"—"}</td><td style="text-align:right;font-weight:700;color:#7c3aed">${r.actual||0}</td><td style="background:${r.qcGrade==="A"?"#f0fdf4":r.qcGrade==="B"?"#fefce8":r.qcGrade==="F"?"#fef2f2":"#fff7ed"};color:${r.qcGrade==="A"?"#15803d":r.qcGrade==="B"?"#92400e":r.qcGrade==="F"?"#b91c1c":"#9a3412"};font-weight:700;text-align:center">${r.qcGrade||"—"}</td><td style="font-size:10px;color:#64748b">${ingredientStr}</td><td style="font-size:11px;color:#64748b">${r.qcNotes||r.notes||"—"}</td></tr>`;
                      }).join("");
                      const delivRows=dayDelivs.map((d,i)=>{
                        const items=Object.entries(safeO(d.orderLines)).filter(([,l])=>l.qty>0).map(([pid,l])=>{const p=products.find(x=>x.id===pid);return`${l.qty}× ${p?p.name:(l.name||pid)}`;}).join(", ");
                        const tot=lineTotal(d.orderLines);const repl=+d.replacement?.amount||0;const net=tot-repl;const collected=d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0;const bal=Math.max(0,net-collected);
                        const sc=d.status==="Delivered"?"#059669":d.status==="In Transit"?"#2563eb":d.status==="Cancelled"?"#dc2626":"#d97706";
                        const dInvNo=d.invNo||`INV-${(d.date||"").replace(/-/g,"")}-${(d.id||"").slice(-4).toUpperCase()}`;
                        const dRcptNo=`RCP-${dInvNo.replace(/^[A-Z]+-/,"")}`;
                        return `<tr style="background:${i%2===0?"#fff":"#f8fafc"}">
                          <td style="font-family:monospace;font-size:10px;color:#7c3aed;font-weight:700;white-space:nowrap">${dInvNo}</td>
                          <td style="font-family:monospace;font-size:10px;color:#0ea5e9;font-weight:700;white-space:nowrap">${dRcptNo}</td>
                          <td><b>${d.customer}</b>${d.address?`<br><span style="font-size:10px;color:#94a3b8">📍 ${d.address}</span>`:""}${d.agent?`<br><span style="font-size:10px;color:#94a3b8">👤 ${d.agent}</span>`:""}</td>
                          <td style="font-size:11px;color:#475569">${items||"—"}</td>
                          <td style="text-align:right;font-weight:700">₹${tot.toLocaleString("en-IN")}</td>
                          <td>${d.replacement?.done?`<span style="color:#f97316;font-weight:700;font-size:11px">🔄 ${d.replacement.item||"—"}${d.replacement.qty?" ("+d.replacement.qty+")":""}</span>${d.replacement.reason?`<br><span style="font-size:10px;color:#94a3b8">${d.replacement.reason}</span>`:""}${repl>0?`<br><span style="color:#f97316;font-size:11px">−₹${repl.toLocaleString("en-IN")}</span>`:""}`:`<span style="color:#94a3b8">—</span>`}</td>
                          <td style="text-align:right;font-weight:700">₹${net.toLocaleString("en-IN")}</td>
                          <td style="text-align:right;color:#059669;font-weight:700">${collected>0?"₹"+collected.toLocaleString("en-IN"):"—"}</td>
                          <td style="text-align:right;font-weight:800;color:${bal===0?"#059669":"#d97706"}">${bal===0?"✓ Paid":"₹"+bal.toLocaleString("en-IN")}</td>
                          <td><span style="background:${sc}18;color:${sc};padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700">${d.status}</span></td>
                        </tr>`;
                      }).join("");
                      const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Batch Paper Trail — ${dateLabel}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;color:#1c1917;padding:32px;max-width:900px;margin:0 auto}
.cover{background:linear-gradient(135deg,#0f1923 0%,#1e3a5f 100%);color:#fff;padding:28px 32px;border-radius:12px;margin-bottom:24px}
.co-name{font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;opacity:0.6;margin-bottom:8px}
.title{font-size:28px;font-weight:900;letter-spacing:-0.02em;line-height:1.1}
.meta{font-size:11px;opacity:0.5;margin-top:8px}
.section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin:24px 0 8px;padding-bottom:6px;border-bottom:2px solid #e2e8f0}
.stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:4px}
.stat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px}
.stat-val{font-size:20px;font-weight:900;color:#0f172a;line-height:1}
.stat-lbl{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;color:#94a3b8;margin-top:4px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:4px}
thead tr{background:#f1f5f9}
th{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#64748b;padding:8px 10px;text-align:left;border-bottom:2px solid #e2e8f0}
td{padding:8px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}
.footer{margin-top:32px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}
.print-bar{position:fixed;top:0;left:0;right:0;background:#0f1923;color:#fff;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;z-index:9999;font-family:Arial,sans-serif;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.4);gap:12px}
.print-bar a{background:#3b82f6;color:#fff;padding:7px 16px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;white-space:nowrap}
@media print{@page{size:A4 landscape;margin:1cm}.print-bar{display:none!important}body{padding:0}}
</style></head><body>
<div class="cover">
  <div class="co-name">🫓 ${co} · Production</div>
  <div class="title">Batch Paper Trail</div>
  <div class="title" style="font-size:18px;opacity:0.8;margin-top:4px">${dateLabel}</div>
  <div class="meta">Exported on ${now} · ${dayRecs.length} batch${dayRecs.length!==1?"es":""} · ${totalUnits} units produced · ${dayDelivs.length} customers served</div>
</div>

<div class="section-title">📊 Day Summary</div>
<div class="stats">
  <div class="stat"><div class="stat-val" style="color:#7c3aed">${totalUnits}</div><div class="stat-lbl">Units Produced</div></div>
  <div class="stat"><div class="stat-val">${dayRecs.length}</div><div class="stat-lbl">Batches</div></div>
  <div class="stat"><div class="stat-val">${dayDelivs.length}</div><div class="stat-lbl">Customers Served</div></div>
  <div class="stat"><div class="stat-val" style="color:#059669">₹${totalOrderVal.toLocaleString("en-IN")}</div><div class="stat-lbl">Order Value</div></div>
  ${totalReplAmt>0?`<div class="stat"><div class="stat-val" style="color:#f97316">−₹${totalReplAmt.toLocaleString("en-IN")}</div><div class="stat-lbl">Replacements</div></div>`:""}
  <div class="stat"><div class="stat-val" style="color:#0f172a">₹${totalNet.toLocaleString("en-IN")}</div><div class="stat-lbl">Net Billed</div></div>
  ${totalCollected>0?`<div class="stat"><div class="stat-val" style="color:#059669">₹${totalCollected.toLocaleString("en-IN")}</div><div class="stat-lbl">Collected</div></div>`:""}
  <div class="stat"><div class="stat-val" style="color:${totalBalance===0?"#059669":"#d97706"}">${totalBalance===0?"✓ All Paid":"₹"+totalBalance.toLocaleString("en-IN")}</div><div class="stat-lbl">Balance Due</div></div>
</div>

<div class="section-title">🏭 Batches Produced</div>
<table>
  <thead><tr><th>Batch</th><th>Product</th><th>Shift</th><th style="text-align:right">Qty</th><th style="text-align:center">QC</th><th>Ingredients Used</th><th>Notes</th></tr></thead>
  <tbody>${batchRows}</tbody>
</table>

<div class="section-title" style="margin-top:28px">📦 Customer Delivery Breakdown</div>
<table>
  <thead><tr><th>Invoice No</th><th>Receipt No</th><th>Customer</th><th>Items</th><th style="text-align:right">Order Total</th><th>Replacement</th><th style="text-align:right">Net Payable</th><th style="text-align:right">Collected</th><th style="text-align:right">Balance Due</th><th>Status</th></tr></thead>
  <tbody>${delivRows}</tbody>
  <tr style="background:#f1f5f9;font-weight:800;font-size:13px">
    <td colspan="4">TOTAL (${dayDelivs.length} customers)</td>
    <td style="text-align:right">₹${totalOrderVal.toLocaleString("en-IN")}</td>
    <td style="color:#f97316">${totalReplAmt>0?"−₹"+totalReplAmt.toLocaleString("en-IN"):"—"}</td>
    <td style="text-align:right">₹${totalNet.toLocaleString("en-IN")}</td>
    <td style="text-align:right;color:#059669">${totalCollected>0?"₹"+totalCollected.toLocaleString("en-IN"):"—"}</td>
    <td style="text-align:right;color:${totalBalance===0?"#059669":"#d97706"}">${totalBalance===0?"✓ All Paid":"₹"+totalBalance.toLocaleString("en-IN")}</td>
    <td></td>
  </tr>
</table>

<div class="footer">${co} · ${cosub} · Batch Paper Trail for ${dateLabel} · Exported ${now}</div>
<div class="print-bar"><span>📋 Batch Paper Trail — ${dateLabel}</span><a href="#" onclick="window.print();return false;">🖨 Print / Save PDF</a></div>
<script>window.addEventListener("load",function(){window.print();});</script>
</body></html>`;
                      const blob=new Blob([html],{type:"text/html;charset=utf-8"});
                      const url=URL.createObjectURL(blob);
                      const a=document.createElement("a");a.href=url;a.target="_blank";a.rel="noopener";
                      document.body.appendChild(a);a.click();
                      setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},1000);
                    };
                    const batchLabels=dayRecs.map(r=>r.batchLabel||"Batch").join(", ");
                    const totalDayOrderVal=dayDelivs.reduce((s,d2)=>s+lineTotal(d2.orderLines),0);
                    const totalDayRepl=dayDelivs.reduce((s,d2)=>s+(+d2.replacement?.amount||0),0);
                    const totalDayCollected=dayDelivs.reduce((s,d2)=>s+(d2.partialPayment?.enabled?(+d2.partialPayment?.amount||0):0),0);
                    const totalDayBalance=Math.max(0,totalDayOrderVal-totalDayRepl-totalDayCollected);
                    return <div style={{background:t.inp,borderRadius:12,padding:"22px 22px",marginTop:12,border:`1px solid ${t.border}`}}>
                      {/* Header + summary */}
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,gap:18,flexWrap:"wrap"}}>
                        <div>
                          <p style={{color:t.text,fontSize:12,fontWeight:800}}>📦 {dayDelivs.length} Customer{dayDelivs.length!==1?"s":""} Served</p>
                          <p style={{color:t.sub,fontSize:10}}>Batch{dayRecs.length!==1?"es":""}: {batchLabels}</p>
                        </div>
                        <button onClick={exportTrailPDF} style={{background:"#7c3aed",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0,WebkitTapHighlightColor:"transparent"}}>📄 PDF Trail</button>
                      </div>
                      {canSeePrices&&<div className="crm-grid-4" style={{gap:24,marginBottom:10}}>
                        {[
                          {l:"Billed",v:inr(totalDayOrderVal),c:"#f59e0b"},
                          {l:"Replaced",v:totalDayRepl>0?`−${inr(totalDayRepl)}`:"None",c:totalDayRepl>0?"#f97316":t.sub},
                          {l:"Collected",v:inr(totalDayCollected),c:"#10b981"},
                          {l:"Balance",v:inr(totalDayBalance),c:totalDayBalance>0?"#ef4444":"#10b981"},
                        ].map(x=><div key={x.l} style={{background:t.card,borderRadius:8,padding:"6px 8px",textAlign:"center"}}>
                          <p style={{color:x.c,fontWeight:800,fontSize:11}}>{x.v}</p>
                          <p style={{color:t.sub,fontSize:9,marginTop:1,textTransform:"uppercase"}}>{x.l}</p>
                        </div>)}
                      </div>}
                      {/* Per-customer delivery cards */}
                      <div className="flex flex-col gap-4">
                        {dayDelivs.map((d,di)=>{
                          const dRows=lineRows(d.orderLines,products);
                          const dTot=lineTotal(d.orderLines);
                          const dRepl=+d.replacement?.amount||0;
                          const dNet=Math.max(0,dTot-dRepl);
                          const dCollected=d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0;
                          const dBalance=Math.max(0,dNet-dCollected);
                          const dInvNo=(invRegistry?.issued||{})[d.id]||null;
                          const dRcptNo=dInvNo?`RCP-${dInvNo.replace(/^[A-Z0-9]+-/,"")}`:`RCP-${(d.id||"").slice(-6).toUpperCase()}`;
                          return <div key={d.id} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,padding:"20px 20px",borderLeft:"3px solid #7c3aed"}}>
                            {/* Customer name + invoice/receipt */}
                            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:24,marginBottom:14}}>
                              <div>
                                <p style={{color:t.text,fontWeight:800,fontSize:13}}>{d.customer}</p>
                                <div style={{display:"flex",flexWrap:"wrap",gap:20,marginTop:16}}>
                                  {dInvNo&&<span style={{background:dm?"rgba(139,92,246,0.15)":"rgba(139,92,246,0.08)",color:"#8b5cf6",borderRadius:5,padding:"1px 7px",fontSize:9,fontWeight:700,fontFamily:"monospace"}}>📄 {dInvNo}</span>}
                                  {dInvNo&&<span style={{background:dm?"rgba(14,165,233,0.15)":"rgba(14,165,233,0.08)",color:"#0ea5e9",borderRadius:5,padding:"1px 7px",fontSize:9,fontWeight:700,fontFamily:"monospace"}}>🧾 {dRcptNo}</span>}
                                  <span style={{background:dm?"rgba(124,58,237,0.12)":"rgba(124,58,237,0.06)",color:"#7c3aed",borderRadius:5,padding:"1px 7px",fontSize:9,fontWeight:700}}>🏭 {batchLabels}</span>
                                </div>
                              </div>
                              {canSeePrices&&<div style={{textAlign:"right",flexShrink:0}}>
                                <p style={{color:"#f59e0b",fontWeight:800,fontSize:12}}>{inr(dTot)}</p>
                                {dBalance>0&&<p style={{color:"#ef4444",fontSize:10,fontWeight:700}}>Due: {inr(dBalance)}</p>}
                                {dBalance===0&&dTot>0&&<p style={{color:"#10b981",fontSize:10,fontWeight:700}}>✓ Clear</p>}
                              </div>}
                            </div>
                            {/* Items */}
                            <div style={{marginBottom:14}}>
                              {dRows.map(r=><div key={r.id} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"1px 0"}}>
                                <span style={{color:t.sub}}>{r.qty} × {r.name}{canSeePrices?<span> @ {inr(r.priceAmount)}</span>:""}</span>
                                {canSeePrices&&<span style={{color:t.text,fontWeight:600}}>{inr(r.qty*r.priceAmount)}</span>}
                              </div>)}
                            </div>
                            {/* Replacement */}
                            {d.replacement?.done&&<div style={{background:"#f9731612",border:"1px solid #f9731630",borderRadius:7,padding:"8px 14px",marginBottom:14}}>
                              <p style={{color:"#f97316",fontSize:10,fontWeight:700}}>🔄 {d.replacement.item||"Replacement"}{d.replacement.qty?` ×${d.replacement.qty}`:""}{canSeePrices&&dRepl>0?` · −${inr(dRepl)}`:""}</p>
                              {d.replacement.reason&&<p style={{color:t.sub,fontSize:10}}>{d.replacement.reason}</p>}
                            </div>}
                            {/* Payment summary */}
                            {canSeePrices&&dTot>0&&<div style={{display:"flex",flexWrap:"wrap",gap:18,fontSize:10}}>
                              {dRepl>0&&<span style={{color:t.sub}}>Net: <b style={{color:t.text}}>{inr(dNet)}</b></span>}
                              {dCollected>0&&<span style={{color:"#10b981"}}>Collected: <b>{inr(dCollected)}</b></span>}
                              <span style={{color:dBalance>0?"#ef4444":"#10b981",fontWeight:700}}>{dBalance>0?`Balance: ${inr(dBalance)}`:"✓ Settled"}</span>
                            </div>}
                          </div>;
                        })}
                      </div>
                    </div>;
                  })()}
                </div></Card>;

              })}
            </div>}

            {/* ── KANBAN VIEW ── */}

            {prodSubTab==="kanban"&&(()=>{
              const STAGES=[
                {key:"scheduled",label:"Scheduled",color:"#6b7280",icon:"📅"},
                {key:"in_production",label:"In Production",color:"#3b82f6",icon:"⚙️"},
                {key:"qc",label:"QC",color:"#14b8a6",icon:"✅"},
                {key:"packed",label:"Packed",color:"#8b5cf6",icon:"📦"},
                {key:"handover",label:"Handover",color:"#f59e0b",icon:"📋"},
                {key:"completed",label:"Completed",color:"#10b981",icon:"🏁"},
              ];
              // Derive stage from batch data
              const getBatchStage=(r)=>{
                const hasHV=(handovers||[]).some(h=>h.batchId===r.batchId);
                const hasQC=(qcLogs||[]).some(q=>q.batchId===r.batchId)||r.qcGrade;
                if(hasHV)return "completed";
                if(r.qcGrade==="A"||r.qcGrade==="B")return "packed";
                if(hasQC||r.qcGrade)return "qc";
                if(r.actual&&+r.actual>0)return "in_production";
                return "scheduled";
              };
              const batchesByStage={};
              STAGES.forEach(s=>batchesByStage[s.key]=[]);
              filteredPT.forEach(r=>{ const stage=getBatchStage(r); if(batchesByStage[stage])batchesByStage[stage].push(r); });
              return <div style={{overflowX:"auto",paddingBottom:8}}>
                <div style={{display:"flex",gap:12,minWidth:600}}>
                  {STAGES.map(stage=>(
                    <div key={stage.key} style={{flex:1,minWidth:130,background:t.inp,borderRadius:14,overflow:"hidden"}}>
                      {/* Column header */}
                      <div style={{padding:"20px 20px",borderBottom:`2px solid ${stage.color}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:14}}>{stage.icon}</span>
                          <p style={{color:t.text,fontWeight:800,fontSize:11}}>{stage.label}</p>
                        </div>
                        <span style={{background:stage.color+"20",color:stage.color,borderRadius:99,padding:"1px 7px",fontSize:10,fontWeight:800}}>{batchesByStage[stage.key].length}</span>
                      </div>
                      {/* Cards */}
                      <div style={{padding:"8px 8px",display:"flex",flexDirection:"column",gap:24,minHeight:100}}>
                        {batchesByStage[stage.key].length===0&&<p style={{color:t.sub,fontSize:10,textAlign:"center",padding:"12px 0"}}>Empty</p>}
                        {batchesByStage[stage.key].map(r=>(
                          <div key={r.id} style={{background:t.card,border:`1px solid ${t.border}`,borderLeft:`3px solid ${stage.color}`,borderRadius:10,padding:"18px 16px",cursor:"pointer"}}
                            onClick={()=>{
                              const existingWaste=(wastage||[]).filter(w=>w.batchId===r.batchId);
                              const existingQC=(qcLogs||[]).filter(q=>q.batchId===r.batchId);
                              const existingHV=(handovers||[]).filter(h=>h.batchId===r.batchId);
                              setPtF({...r,actual:String(r.actual),embWastage:existingWaste.map(w=>({...w})),embQC:existingQC.map(q=>({...q})),embHandover:existingHV.map(h=>({...h}))});
                              setPtSh(r);
                            }}>
                            <p style={{color:t.text,fontWeight:700,fontSize:11,marginBottom:14}}>{r.batchLabel||"Batch"}</p>
                            <p style={{color:t.sub,fontSize:10,marginBottom:10}} className="truncate">{r.product}</p>
                            <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                              {r.shift&&<span style={{background:"#f59e0b18",color:"#f59e0b",borderRadius:4,padding:"1px 5px",fontSize:9,fontWeight:700}}>{r.shift}</span>}
                              {r.actual&&<span style={{background:stage.color+"18",color:stage.color,borderRadius:4,padding:"1px 5px",fontSize:9,fontWeight:700}}>{r.actual}u</span>}
                              {r.qcGrade&&<span style={{background:gradeColor(r.qcGrade)+"18",color:gradeColor(r.qcGrade),borderRadius:4,padding:"1px 5px",fontSize:9,fontWeight:700}}>QC:{r.qcGrade}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>;
            })()}

            {/* ── SCHEDULE ── */}
            {prodSubTab==="schedule"&&(()=>{
              // Build a 14-day calendar view: past 2 days + next 12 days
              const today=new Date();
              const days=Array.from({length:14},(_,i)=>{const d=new Date(today);d.setDate(d.getDate()-2+i);return d.toISOString().slice(0,10);});
              const shifts=(settings?.shifts||["Morning","Afternoon","Evening","Night"]);
              // Scheduled batches: prodTargets that have a future date OR today
              const scheduledMap={};
              prodTargets.forEach(r=>{
                if(!scheduledMap[r.date])scheduledMap[r.date]=[];
                scheduledMap[r.date].push(r);
              });
              // Fake "planned" from recurring — not implemented yet so we just show existing + let user add
              const [schForm,setSchForm]=React.useState(null);
              const [schNote,setSchNote]=React.useState({date:"",shift:"",product:"",target:"",notes:""});
              return <>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p style={{color:t.text,fontWeight:800,fontSize:14}}>Production Schedule</p>
                    <p style={{color:t.sub,fontSize:11,marginTop:14}}>Plan and track upcoming batches across shifts</p>
                  </div>
                  <Btn dm={dm} size="sm" style={{background:"#2563eb",color:"#fff",border:"none",fontWeight:800}}
                    onClick={()=>{
                      const batchDate=todayStr;
                      const existingBatchCount=prodTargets.filter(x=>x.date===batchDate).length;
                      const nextNum=existingBatchCount+1;
                      setPtF({date:batchDate,shift:shifts[0]||"",product:(prodItems||[])[0]?.name||"",actual:"",notes:"",batchId:uid(),batchLabel:`Batch ${nextNum}`,qcGrade:"A",qcNotes:"",embWastage:[],embQC:[],embHandover:[]});
                      setPtSh("add");
                    }}>📅 + Schedule Batch</Btn>
                </div>
                {/* Calendar grid */}
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {days.map(date=>{
                    const dayRecs=scheduledMap[date]||[];
                    const isToday=date===todayStr;
                    const isPast=date<todayStr;
                    const isFuture=date>todayStr;
                    const dayObj=new Date(date+"T00:00:00");
                    const dayLabel=isToday?"Today":date===yesterdayStr?"Yesterday":dayObj.toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"});
                    const dayQty=dayRecs.reduce((s,x)=>s+(+x.actual||0),0);
                    const dayQCFails=dayRecs.filter(x=>x.qcGrade==="F").length;
                    const borderColor=isToday?"#2563eb":isFuture?"#6b728040":"transparent";
                    return <div key={date} style={{background:t.card,border:`1.5px solid ${borderColor}`,borderRadius:14,overflow:"hidden",opacity:isPast&&!isToday?0.75:1}}>
                      {/* Day header */}
                      <div style={{padding:"20px 22px",background:isToday?"#2563eb10":isFuture?t.inp:"transparent",borderBottom:dayRecs.length>0?`1px solid ${t.border}`:"none",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          {isToday&&<span style={{background:"#2563eb",color:"#fff",borderRadius:6,padding:"8px 16px",fontSize:10,fontWeight:800}}>TODAY</span>}
                          {isFuture&&<span style={{background:t.inp,color:t.sub,borderRadius:6,padding:"8px 16px",fontSize:10,fontWeight:700}}>UPCOMING</span>}
                          {isPast&&!isToday&&<span style={{background:t.inp,color:t.sub,borderRadius:6,padding:"8px 16px",fontSize:10,fontWeight:600}}>PAST</span>}
                          <p style={{color:isToday?"#2563eb":t.text,fontWeight:isToday?900:700,fontSize:13}}>{dayLabel}</p>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          {dayRecs.length>0&&<>
                            <span style={{background:"#8b5cf620",color:"#8b5cf6",borderRadius:6,padding:"5px 12px",fontSize:10,fontWeight:700}}>{dayRecs.length} batch{dayRecs.length!==1?"es":""}</span>
                            {dayQty>0&&<span style={{background:"#6366f120",color:"#6366f1",borderRadius:6,padding:"5px 12px",fontSize:10,fontWeight:700}}>{dayQty} units</span>}
                            {dayQCFails>0&&<span style={{background:"#ef444420",color:"#ef4444",borderRadius:6,padding:"5px 12px",fontSize:10,fontWeight:700}}>❌ {dayQCFails} fail</span>}
                          </>}
                          {isFuture&&<button onClick={()=>{
                            const existingBatchCount=prodTargets.filter(x=>x.date===date).length;
                            const nextNum=existingBatchCount+1;
                            setPtF({date,shift:shifts[0]||"",product:(prodItems||[])[0]?.name||"",actual:"",notes:"",batchId:uid(),batchLabel:`Batch ${nextNum}`,qcGrade:"A",qcNotes:"",embWastage:[],embQC:[],embHandover:[]});
                            setPtSh("add");
                          }} style={{background:"#2563eb15",color:"#2563eb",border:"1px dashed #2563eb50",borderRadius:8,padding:"10px 20px",fontSize:11,fontWeight:700,cursor:"pointer"}}>+ Add</button>}
                        </div>
                      </div>
                      {/* Batch rows for this day */}
                      {dayRecs.length>0&&<div style={{padding:"20px 22px",display:"flex",flexDirection:"column",gap:8}}>
                        {shifts.map(sh=>{
                          const shRecs=dayRecs.filter(x=>x.shift===sh);
                          const noShiftRecs=sh===shifts[0]?dayRecs.filter(x=>!x.shift):[];
                          const allRecs=[...shRecs,...(sh===shifts[0]?noShiftRecs:[])];
                          if(allRecs.length===0)return null;
                          return <div key={sh}>
                            <p style={{color:t.sub,fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>{sh}</p>
                            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                              {allRecs.map(r=>{
                                const qcColor=r.qcGrade?gradeColor(r.qcGrade):"#6b7280";
                                return <div key={r.id} style={{background:t.inp,border:`1px solid ${t.border}`,borderLeft:`3px solid ${qcColor}`,borderRadius:10,padding:"16px 20px",minWidth:120,flex:"0 0 auto",cursor:"pointer"}}
                                  onClick={()=>{
                                    const existingWaste=(wastage||[]).filter(w=>w.batchId===r.batchId);
                                    const existingQC=(qcLogs||[]).filter(q=>q.batchId===r.batchId);
                                    const existingHV=(handovers||[]).filter(h=>h.batchId===r.batchId);
                                    setPtF({...r,actual:String(r.actual),embWastage:existingWaste.map(w=>({...w})),embQC:existingQC.map(q=>({...q})),embHandover:existingHV.map(h=>({...h}))});
                                    setPtSh(r);
                                  }}>
                                  <p style={{color:t.text,fontWeight:800,fontSize:11,marginBottom:14}}>{r.batchLabel||"Batch"}</p>
                                  <p style={{color:t.sub,fontSize:10,marginBottom:10}} className="truncate">{r.product}</p>
                                  <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
                                    {r.actual>0&&<span style={{background:"#6366f118",color:"#6366f1",borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:700}}>{r.actual}u</span>}
                                    {r.qcGrade&&<span style={{background:qcColor+"18",color:qcColor,borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:700}}>QC:{r.qcGrade}</span>}
                                  </div>
                                </div>;
                              })}
                            </div>
                          </div>;
                        })}
                      </div>}
                      {/* Empty future day placeholder */}
                      {dayRecs.length===0&&isFuture&&<div style={{padding:"22px 24px"}}>
                        <p style={{color:t.sub,fontSize:11,fontStyle:"italic"}}>No batches planned — tap + Add to schedule</p>
                      </div>}
                    </div>;
                  })}
                </div>
              </>;
            })()}

            {/* ── WASTAGE ── */}
            {prodSubTab==="wastage"&&<div style={{display:"flex",flexDirection:"column",gap:28}}>
              <div className="flex items-center justify-between">
                <div className="crm-btn-group">
                  <Pill dm={dm} c="orange">{filteredWaste.length} records</Pill>
                  <Pill dm={dm} c="red">{inr(filteredWaste.reduce((s,w)=>s+(w.cost||0),0))} cost</Pill>
                </div>
                <div className="flex gap-2">
                  <Btn dm={dm} v="outline" size="sm" onClick={()=>exportTabPDF("Wastage",filteredWaste,[{label:"Date",key:"date"},{label:"Product",key:"product"},{label:"Type",key:"type"},{label:"Qty",key:"qty",num:true},{label:"Unit",key:"unit"},{label:"Cost",key:"cost",num:true},{label:"Reason",key:"reason"},{label:"Shift",key:"shift"}],settings)}>PDF</Btn>
                  <Btn dm={dm} size="sm" onClick={()=>{setWSh("add");setWF(blkW());}}>+ Log Wastage</Btn>
                </div>
              </div>
              {filteredWaste.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-8">No wastage records for this period.</p>}
              {filteredWaste.map(w=>(
                <Card key={w.id} dm={dm}><div style={{padding:"28px 24px"}}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span style={{background:"#f9731620",color:"#f97316",borderRadius:6,padding:"9px 18px",fontSize:10,fontWeight:700}}>{w.type}</span>
                        <p style={{color:t.text,fontWeight:700,fontSize:13}}>{w.product}</p>
                        {w.shift&&<span style={{background:"#f59e0b20",color:"#f59e0b",borderRadius:6,padding:"9px 18px",fontSize:10}}>{w.shift}</span>}
                      </div>
                      <p style={{color:t.sub,fontSize:12}}>📅 {w.date} · {w.qty} {w.unit} · by {w.loggedBy}</p>
                      {w.reason&&<p style={{color:t.sub,fontSize:11,marginTop:4,fontStyle:"italic"}}>"{w.reason}"</p>}
                      {w.cost>0&&<p style={{color:"#ef4444",fontSize:12,fontWeight:700,marginTop:14}}>Cost: {inr(w.cost)}</p>}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {can("waste_edit")&&<button onClick={()=>{setWSh(w);setWF({...w});}} style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,minHeight:36,padding:"0 10px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer"}}>Edit</button>}
                      {can("waste_delete")&&<button onClick={()=>delW(w)} style={{background:"#dc2626",color:"#fff",minHeight:36,padding:"0 10px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",border:"none"}}>Del</button>}
                    </div>
                  </div>
                </div></Card>
              ))}
            </div>}

            {/* ── QC ── */}
            {prodSubTab==="qc"&&<div style={{display:"flex",flexDirection:"column",gap:28}}>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Pill dm={dm} c="teal">{filteredQC.length} checks</Pill>
                  <Pill dm={dm} c={filteredQC.filter(q=>q.grade==="F").length>0?"red":"green"}>{Math.round(filteredQC.filter(q=>q.grade!=="F").length/Math.max(filteredQC.length,1)*100)}% pass</Pill>
                </div>
                <div className="flex gap-2">
                  <Btn dm={dm} v="outline" size="sm" onClick={()=>exportTabPDF("QC Logs",filteredQC,[{label:"Date",key:"date"},{label:"Product",key:"product"},{label:"Shift",key:"shift"},{label:"Grade",key:"grade"},{label:"Checker",key:"checker"},{label:"Notes",key:"notes"}],settings)}>PDF</Btn>
                  <Btn dm={dm} size="sm" onClick={()=>{setQcF({product:"",shift:"",date:today(),grade:"A",notes:"",checker:displayName});setQcSh("add");}}>+ QC Check</Btn>
                </div>
              </div>
              {filteredQC.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-8">No QC records for this period.</p>}
              {filteredQC.map(q=>(
                <Card key={q.id} dm={dm}><div style={{padding:"28px 24px"}}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div style={{background:gradeColor(q.grade)+"20",color:gradeColor(q.grade),width:40,height:40,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:18,flexShrink:0}}>{q.grade}</div>
                      <div>
                        <p style={{color:t.text}} className="font-bold text-sm">{q.product}</p>
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                          <span style={{color:t.sub}} className="text-xs">📅 {q.date}</span>
                          {q.shift&&<span style={{color:t.sub}} className="text-xs">🕐 {q.shift}</span>}
                          {q.checker&&<span style={{color:t.sub}} className="text-xs">👤 {q.checker}</span>}
                        </div>
                        {q.notes&&<p style={{color:t.sub,background:t.inp,borderRadius:8,padding:"6px 10px",marginTop:16}} className="text-xs">"{q.notes}"</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span style={{background:gradeColor(q.grade)+"20",color:gradeColor(q.grade),borderRadius:8,padding:"5px 12px",fontSize:10,fontWeight:700}}>{GRADES.find(x=>x.g===q.grade)?.label||q.grade}</span>
                      {can("qc_delete")&&<button onClick={()=>delQC(q)} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-red-600 text-white">Del</button>}
                    </div>
                  </div>
                </div></Card>
              ))}
            </div>}

            {/* ── HANDOVERS ── */}
            {prodSubTab==="handover"&&(()=>{
              function saveHandover(){
                if(!hvF.note.trim()){notify("Note is required");return;}
                const rec={...hvF,id:uid(),createdAt:ts()};
                setHandovers(p=>[rec,...p.slice(0,99)]);
                addLog("Shift handover logged",`${rec.shift||"—"} → ${rec.nextShift||"next"}`);
                captureGPS("handover_logged",`shift`);
                addNotif("Shift Handover",`Handover by ${rec.loggedBy}`,"info","newentry");
                notify("Handover note saved ✓");
                setHvSh(false);
              }
              const fHV=(handovers||[]).filter(h=>!ptSearch||(h.note.toLowerCase().includes(ptSearch.toLowerCase())||h.shift?.toLowerCase().includes(ptSearch.toLowerCase())||h.loggedBy?.toLowerCase().includes(ptSearch.toLowerCase())));
              return <>
                <div className="flex items-center justify-between">
                  <Pill dm={dm} c="amber">{fHV.length} notes</Pill>
                  <Btn dm={dm} size="sm" onClick={()=>{setHvF({shift:"",date:today(),note:"",nextShift:"",issues:"",loggedBy:displayName});setHvSh(true);}}>+ Handover</Btn>
                </div>
                {fHV.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-8">No handover notes yet.</p>}
                {fHV.slice(0,20).map(h=>(
                  <Card key={h.id} dm={dm}><div style={{padding:"28px 24px"}}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          {h.shift&&<span style={{background:"#f59e0b20",color:"#f59e0b",borderRadius:6,padding:"5px 12px",fontSize:10,fontWeight:700}}>{h.shift}</span>}
                          {h.nextShift&&<><span style={{color:t.sub,fontSize:10}}>→</span><span style={{background:t.inp,color:t.sub,borderRadius:6,padding:"5px 12px",fontSize:10,fontWeight:600}}>{h.nextShift}</span></>}
                        </div>
                        <p style={{color:t.sub}} className="text-xs">📅 {h.date} · by {h.loggedBy}</p>
                      </div>
                      {can("prod_handover")&&<button onClick={()=>setHandovers(p=>safeArr(p).filter(x=>x.id!==h.id))} style={{background:t.inp,color:t.sub}} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold">Delete</button>}
                    </div>
                    <div style={{background:t.inp,border:`1px solid ${t.inpB}`,borderRadius:12,padding:"20px 20px",color:t.text}} className="text-sm">{h.note}</div>
                    {h.issues&&<div style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:10,padding:"16px 20px",marginTop:16}}>
                      <p style={{color:"#ef4444",fontSize:11,fontWeight:600}}>⚠️ Issues: {h.issues}</p>
                    </div>}
                  </div></Card>
                ))}
                <Sheet dm={dm} open={hvSh} onClose={()=>setHvSh(false)} title="Log Shift Handover">
                  <div className="crm-grid-2" style={{gap:3*4}}>
                    <Sel dm={dm} label="Current Shift (optional)" value={hvF.shift||""} onChange={e=>setHvF({...hvF,shift:e.target.value})}>
                      <option value="">— None —</option>
                      {(settings?.shifts||["Morning","Afternoon","Evening","Night"]).map(s=><option key={s}>{s}</option>)}
                    </Sel>
                    <Sel dm={dm} label="Handing Over To" value={hvF.nextShift||""} onChange={e=>setHvF({...hvF,nextShift:e.target.value})}>
                      <option value="">Select shift</option>
                      {(settings?.shifts||["Morning","Afternoon","Evening","Night"]).map(s=><option key={s}>{s}</option>)}
                    </Sel>
                  </div>
                  <Inp dm={dm} label="Date" type="date" value={hvF.date} onChange={e=>setHvF({...hvF,date:e.target.value})}/>
                  <div>
                    <label style={{color:T(dm).sub}} className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 ml-0.5">Handover Note *</label>
                    <textarea value={hvF.note} onChange={e=>setHvF({...hvF,note:e.target.value})} placeholder="What happened this shift?" rows={4}
                      style={{width:"100%",background:T(dm).inp,border:`1.5px solid ${T(dm).inpB}`,color:T(dm).text,borderRadius:14,padding:"20px 20px",fontSize:13,outline:"none",resize:"vertical",fontFamily:"system-ui"}}/>
                  </div>
                  <Inp dm={dm} label="Issues / Problems" value={hvF.issues} onChange={e=>setHvF({...hvF,issues:e.target.value})} placeholder="Any problems, machine issues…"/>
                  <Btn dm={dm} onClick={saveHandover} className="w-full">Save Handover Note</Btn>
                </Sheet>
              </>;
            })()}
          </div>;
        })();
}
