/* eslint-disable */
// TAB: Production
// This file contains the Production tab JSX, extracted from App.js

        {tab==="Production"&&(()=>{
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
          return <>
            <SectionHeader dm={dm} title="Production" sub="Batch logs, QC checks & wastage tracking"
              cta={<button onClick={()=>{
                    const batchDate=todayStr;
                    const existingBatchCount=prodTargets.filter(x=>x.date===batchDate).length;
                    const nextNum=existingBatchCount+1;
                    setPtF({date:batchDate,shift:(settings?.shifts||["Morning"])[0]||"",product:(prodItems||[])[0]?.name||"",actual:"",notes:"",batchId:uid(),batchLabel:`Batch ${nextNum}`,qcGrade:"A",qcNotes:"",embWastage:[],embQC:[],embHandover:[]});
                    setPtSh("add");
                  }}
                style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:12,padding:"11px 20px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:7,boxShadow:"0 2px 8px rgba(37,99,235,0.3)"}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Log Batch
              </button>}/>
            {/* KPI strip */}
            <div className="crm-grid-4">
              <StatCard dm={dm} label="Total Batches" value={filteredPT.length} sub={`${todayPT.length} today`} accent="#8b5cf6"/>
              <StatCard dm={dm} label="Units Produced" value={filteredPT.reduce((s,x)=>s+(+x.actual||0),0).toLocaleString("en-IN")} sub={filteredPeriodLabel} accent="#6366f1"/>
              <StatCard dm={dm} label="QC Checks" value={totalQCChecks} sub={`${qcPassPct}% pass rate`} accent="#14b8a6"/>
              <StatCard dm={dm} label="Wastage Records" value={filteredWaste.length} sub={`${inr(filteredWaste.reduce((s,w)=>s+(+w.cost||0),0))} cost`} accent="#f97316"/>
            </div>

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
                <div style={{background:`linear-gradient(135deg,${dm?"#431407":"#fff7ed"},${dm?"#1c1917":"#ffedd5"})`,padding:"12px 16px",borderBottom:`1px solid #f9731620`,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
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
                <div style={{padding:"12px 16px",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:12}}>
                  {/* By type breakdown with bars */}
                  <div>
                    <p style={{color:t.sub,fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>By Type</p>
                    <div style={{display:"flex",flexDirection:"column",gap:5}}>
                      {byType.map(([type,v])=>{
                        const c=typeColors[type]||"#6b7280";
                        const pct=Math.round(v.qty/maxQty*100);
                        return <div key={type}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
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
                    <p style={{color:t.sub,fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>By Product</p>
                    <div style={{display:"flex",flexDirection:"column",gap:4}}>
                      {byProduct.map(([prod,v])=>(
                        <div key={prod} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:t.inp,borderRadius:8,padding:"5px 9px"}}>
                          <span style={{color:t.text,fontSize:11,fontWeight:600,flex:1,minWidth:0}} className="truncate">{prod}</span>
                          <div style={{display:"flex",gap:8,flexShrink:0}}>
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
                  <p style={{color:t.sub,fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Recent Entries</p>
                  <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    {filteredWaste.slice(0,5).map(w=>(
                      <div key={w.id} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",borderBottom:`1px solid ${t.border}`}} className="last:border-0">
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
            <div style={{display:"flex",gap:4,background:t.inp,borderRadius:14,padding:4}}>
              {[["batches","🏭","Batches"],["wastage","🗑️","Wastage"],["qc","✅","QC"],["handover","📋","Handover"]].map(([val,icon,label])=>(
                <button key={val} onClick={()=>setProdSubTab(val)}
                  style={{flex:1,background:prodSubTab===val?t.card:"transparent",color:prodSubTab===val?t.text:t.sub,border:prodSubTab===val?`1px solid ${t.border}`:"1px solid transparent",borderRadius:10,padding:"8px 4px",fontSize:11,fontWeight:prodSubTab===val?800:600,cursor:"pointer",transition:"all 0.15s",display:"flex",alignItems:"center",justifyContent:"center",gap:4,whiteSpace:"nowrap"}}>
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
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"0 14px",minHeight:50,borderBottom:ptShowFilters?`1px solid ${t.border}`:"none"}}>
                <span style={{color:t.sub,fontSize:14,flexShrink:0}}>🔍</span>
                <input value={ptSearch} onChange={e=>setPtSearch(e.target.value)} placeholder="Search batch, product, notes…"
                  style={{flex:1,background:"transparent",border:"none",outline:"none",color:t.text,fontSize:14,padding:"10px 0"}}/>
                {ptSearch&&<button onClick={()=>setPtSearch("")} style={{color:t.sub,fontSize:18,background:"none",border:"none",cursor:"pointer",minWidth:28,padding:0}}>×</button>}
                <button onClick={()=>setPtShowFilters(f=>!f)}
                  style={{display:"flex",alignItems:"center",gap:5,background:ptShowFilters?(dm?"#f59e0b":"#1c1917"):t.inp,color:ptShowFilters?(dm?"#000":"#fff"):t.sub,border:"none",borderRadius:9,padding:"7px 14px",fontSize:11,fontWeight:700,cursor:"pointer",transition:"all 0.15s",minHeight:34,flexShrink:0,whiteSpace:"nowrap"}}>
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M4 7h6M6 10h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                  Filters{(ptShiftFilter!=="all"||ptDateFilter!=="all"||ptProductFilter!=="all"||ptWasteTypeFilter!=="all"||ptQcGradeFilter!=="all"||ptHandoverFilter!=="all")&&<span style={{background:"#ef4444",color:"#fff",borderRadius:99,width:16,height:16,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,marginLeft:2}}>{[ptShiftFilter!=="all",ptDateFilter!=="all",ptProductFilter!=="all",ptWasteTypeFilter!=="all",ptQcGradeFilter!=="all",ptHandoverFilter!=="all"].filter(Boolean).length}</span>}
                </button>
              </div>
              {/* Expanded filter panel */}
              {ptShowFilters&&<div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
                {/* Date range */}
                <div>
                  <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Date Range</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {[["today","Today"],["yesterday","Yesterday"],["week","7 Days"],["month","30 Days"],["all","All Time"],["custom","Custom"]].map(([val,label])=>(
                      <button key={val} onClick={()=>setPtDateFilter(val)}
                        style={{background:ptDateFilter===val?(dm?"#f59e0b":"#1c1917"):t.inp,color:ptDateFilter===val?(dm?"#000":"#fff"):t.sub,borderRadius:99,padding:"5px 13px",fontSize:11,fontWeight:700,border:"none",cursor:"pointer",transition:"all 0.15s"}}>{label}</button>
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
                  <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Shift</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {[["all","All"],["none","No Shift"],...(settings?.shifts||["Morning","Afternoon","Evening","Night"]).map(s=>[s,s])].map(([val,label])=>(
                      <button key={val} onClick={()=>setPtShiftFilter(val)}
                        style={{background:ptShiftFilter===val?"#f59e0b":t.inp,color:ptShiftFilter===val?"#000":t.sub,borderRadius:99,padding:"5px 13px",fontSize:11,fontWeight:700,border:"none",cursor:"pointer",transition:"all 0.15s"}}>{label}</button>
                    ))}
                  </div>
                </div>
                {/* Product */}
                <div>
                  <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Product</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {[["all","All Products"],...(prodItems||[]).map(p=>[p.name,p.name])].map(([val,label])=>(
                      <button key={val} onClick={()=>setPtProductFilter(val)}
                        style={{background:ptProductFilter===val?"#8b5cf6":t.inp,color:ptProductFilter===val?"#fff":t.sub,borderRadius:99,padding:"5px 13px",fontSize:11,fontWeight:700,border:"none",cursor:"pointer",transition:"all 0.15s"}}>{label}</button>
                    ))}
                  </div>
                </div>
                {/* Wastage type */}
                <div>
                  <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Wastage Type</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {[["all","All"],...(settings?.wastageTypes||["Burnt","Broken","Expired","Overproduced","Quality Reject","Other"]).map(wt=>[wt,wt])].map(([val,label])=>(
                      <button key={val} onClick={()=>setPtWasteTypeFilter(val)}
                        style={{background:ptWasteTypeFilter===val?"#f97316":t.inp,color:ptWasteTypeFilter===val?"#fff":t.sub,borderRadius:99,padding:"5px 13px",fontSize:11,fontWeight:700,border:"none",cursor:"pointer",transition:"all 0.15s"}}>{label}</button>
                    ))}
                  </div>
                </div>
                {/* QC Grade */}
                <div>
                  <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>QC Grade</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {[["all","All"],["A","A — Pass"],["B","B — Pass"],["C","C — Marginal"],["F","F — Fail"]].map(([val,label])=>(
                      <button key={val} onClick={()=>setPtQcGradeFilter(val)}
                        style={{background:ptQcGradeFilter===val?"#14b8a6":t.inp,color:ptQcGradeFilter===val?"#fff":t.sub,borderRadius:99,padding:"5px 13px",fontSize:11,fontWeight:700,border:"none",cursor:"pointer",transition:"all 0.15s"}}>{label}</button>
                    ))}
                  </div>
                </div>
                {/* Handover */}
                <div>
                  <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Handover</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {[["all","All Batches"],["with","Has Handover 🤝"],["without","No Handover"]].map(([val,label])=>(
                      <button key={val} onClick={()=>setPtHandoverFilter(val)}
                        style={{background:ptHandoverFilter===val?"#6366f1":t.inp,color:ptHandoverFilter===val?"#fff":t.sub,borderRadius:99,padding:"5px 13px",fontSize:11,fontWeight:700,border:"none",cursor:"pointer",transition:"all 0.15s"}}>{label}</button>
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
            {prodSubTab==="batches"&&<>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                  <Pill dm={dm} c="purple">{filteredPT.length} runs · {filteredPT.reduce((s,x)=>s+(+x.actual||0),0)} units</Pill>
                  {deliveries.filter(d=>d.date===todayStr&&d.status!=="Cancelled").length>0&&<Pill dm={dm} c="sky">{deliveries.filter(d=>d.date===todayStr&&d.status!=="Cancelled").length} customers today</Pill>}
                </div>
                <div className="crm-btn-group">
                  <Btn dm={dm} v="outline" size="sm" onClick={()=>exportTabPDF("Production",filteredPT,[{label:"Date",key:"date"},{label:"Batch",key:"batchLabel"},{label:"Product",key:"product"},{label:"Shift",key:"shift"},{label:"Qty",key:"actual",num:true},{label:"QC",key:"qcGrade"},{label:"Linked Invoices",val:r=>(r.linkedInvoices||[]).join(", ")},{label:"Notes",key:"notes"}],settings)}>PDF</Btn>
                  <Btn dm={dm} v="outline" size="sm" onClick={()=>exportTabExcel("Production",filteredPT,[{label:"Date",key:"date"},{label:"Batch",key:"batchLabel"},{label:"Product",key:"product"},{label:"Shift",key:"shift"},{label:"Qty Produced",key:"actual",num:true},{label:"QC Grade",key:"qcGrade"},{label:"Linked Invoices",val:r=>(r.linkedInvoices||[]).join(", ")},{label:"Notes",key:"notes"}],settings)}>XLS</Btn>
                  <Btn dm={dm} v="outline" size="sm" onClick={()=>exportCSV(filteredPT,"production",[{label:"Date",key:"date"},{label:"Batch",key:"batchLabel"},{label:"Product",key:"product"},{label:"Shift",key:"shift"},{label:"Qty Produced",key:"actual"},{label:"QC Grade",key:"qcGrade"},{label:"Linked Invoices",val:r=>(r.linkedInvoices||[]).join("; ")},{label:"Notes",key:"notes"}])}>CSV</Btn>
                  <Btn dm={dm} size="sm" style={{background:"linear-gradient(135deg,#7c3aed,#6366f1)",color:"#fff",border:"none",fontWeight:800,padding:"8px 18px",minHeight:40}} onClick={()=>{
                    // Always create new batches for today; count ALL existing batches for today to get next number
                    const batchDate=todayStr;
                    const existingBatchCount=prodTargets.filter(x=>x.date===batchDate).length;
                    const nextNum=existingBatchCount+1;
                    setPtF({date:batchDate,shift:(settings?.shifts||["Morning"])[0]||"",product:(prodItems||[])[0]?.name||"",actual:"",notes:"",batchId:uid(),batchLabel:`Batch ${nextNum}`,qcGrade:"A",qcNotes:"",embWastage:[],embQC:[],embHandover:[]});
                    setPtSh("add");
                  }}>🏭 + New Batch</Btn>
                </div>
              </div>
              {uniqueDates.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-8">{prodTargets.length===0?"No batches yet. Tap + New Batch to start.":ptSearch?"No matches.":"No records for this period."}</p>}
              {uniqueDates.map(date=>{
                const dayRecs=filteredPT.filter(x=>x.date===date).sort((a,b)=>(a.batchLabel||"").localeCompare(b.batchLabel||""));
                const dayQty=dayRecs.reduce((s,x)=>s+(+x.actual||0),0);
                const dayLabel=date===todayStr?"Today":date===yesterdayStr?"Yesterday":new Date(date+"T00:00:00").toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"});
                const dayWaste=(wastage||[]).filter(w=>w.date===date);
                const dayDelivsAll=deliveries.filter(d=>d.date===date&&d.status!=="Cancelled");
                return <Card key={date} dm={dm}><div className="p-4">
                  {/* Day header */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p style={{color:t.text,fontWeight:900,fontSize:15}}>{dayLabel}</p>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:3}}>
                        <span style={{background:"#8b5cf620",color:"#8b5cf6",borderRadius:6,padding:"2px 9px",fontSize:10,fontWeight:700}}>🏭 {dayRecs.length} batch{dayRecs.length!==1?"es":""}</span>
                        <span style={{background:"#6366f120",color:"#6366f1",borderRadius:6,padding:"2px 9px",fontSize:10,fontWeight:700}}>📦 {dayQty} units</span>
                        {dayDelivsAll.length>0&&<span style={{background:"#7c3aed20",color:"#7c3aed",borderRadius:6,padding:"2px 9px",fontSize:10,fontWeight:700}}>👥 {dayDelivsAll.length} customers</span>}
                        {dayWaste.length>0&&<span style={{background:"#f9731620",color:"#f97316",borderRadius:6,padding:"2px 9px",fontSize:10,fontWeight:700}}>⚠️ {dayWaste.length} wastage</span>}
                      </div>
                    </div>
                  </div>
                  {dayRecs.map((r,ri)=>{
                    const rWaste=(wastage||[]).filter(w=>w.batchId===r.batchId);
                    const rQC=(qcLogs||[]).filter(q=>q.batchId===r.batchId);
                    const rHV=(handovers||[]).filter(h=>h.batchId===r.batchId);
                    const recipeIngrs=(settings?.recipes||{})[products.find(p=>p.name===r.product)?.id||""]?.ingredients||[];
                    // Customer traceability: deliveries on this date that contain this exact product
                    // Use direct batchId match first; fall back to product+date if no deliveries have batchId yet
                    const batchIdLinkedDelivs=deliveries.filter(d=>d.batchId===r.batchId&&d.status!=="Cancelled");
                    // Fallback: same-date deliveries with no batchId that match this product
                    // (covers legacy data or deliveries added before batch was created)
                    const unlinkedSameDateDelivs=deliveries.filter(d=>d.date===r.date&&d.status!=="Cancelled"&&!d.batchId)
                      .filter(d=>Object.entries(safeO(d.orderLines)).some(([pid,l])=>{if(!(l.qty>0))return false;const p=products.find(x=>x.id===pid);return prodNamesMatch(p?.name||l.name||"",r.product);}));
                    const batchCustomers=batchIdLinkedDelivs.length>0?batchIdLinkedDelivs:unlinkedSameDateDelivs;
                    return <div key={r.id} style={{borderTop:ri>0?`1px solid ${t.border}`:"none",paddingTop:ri>0?14:0,marginTop:ri>0?14:0}}>
                      <div className="flex items-start justify-between gap-2">
                        <div style={{flex:1}}>
                          {/* Batch identity header */}
                          <div style={{background:dm?"rgba(139,92,246,0.15)":"rgba(139,92,246,0.08)",border:`1px solid rgba(139,92,246,0.3)`,borderRadius:10,padding:"8px 12px",marginBottom:8}}>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap",marginBottom:6}}>
                              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                                <span style={{background:"#8b5cf6",color:"#fff",borderRadius:6,padding:"3px 10px",fontSize:12,fontWeight:900}}>{r.batchLabel||"Batch"}</span>
                                <span style={{color:"#8b5cf6",fontWeight:700,fontSize:12}}>{r.product}</span>
                              </div>
                              <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end"}}>
                                {r.shift&&<span style={{background:"#f59e0b20",color:"#f59e0b",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>🕐 {r.shift}</span>}
                                {r.qcGrade&&<span style={{background:gradeColor(r.qcGrade)+"20",color:gradeColor(r.qcGrade),borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>QC: {r.qcGrade}</span>}
                                {rWaste.length>0&&<span style={{background:"#f9731618",color:"#f97316",borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:700}}>🗑️ {rWaste.length}</span>}
                                {rQC.length>0&&<span style={{background:"#14b8a618",color:"#14b8a6",borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:700}}>✅ {rQC.length}</span>}
                                {rHV.length>0&&<span style={{background:"#6366f118",color:"#6366f1",borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:700}}>📋 {rHV.length}</span>}
                              </div>
                            </div>
                            {/* Units big number */}
                            <div style={{display:"flex",alignItems:"baseline",gap:6}}>
                              <p style={{color:"#8b5cf6",fontWeight:900,fontSize:26,lineHeight:1}}>{r.actual||0}</p>
                              <span style={{color:t.sub,fontSize:12}}>units produced</span>
                              {(r.linkedInvoices||[]).length>0&&<div style={{marginLeft:"auto",display:"flex",gap:3,flexWrap:"wrap"}}>
                                {(r.linkedInvoices||[]).map(inv=><span key={inv} style={{background:dm?"rgba(139,92,246,0.2)":"rgba(139,92,246,0.1)",color:"#7c3aed",borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:700,fontFamily:"monospace"}}>📄 {inv}</span>)}
                              </div>}
                            </div>
                          </div>
                          {/* Customer Traceability inline */}
                          {batchCustomers.length>0&&<div style={{background:dm?"rgba(124,58,237,0.08)":"rgba(124,58,237,0.04)",border:`1px solid rgba(124,58,237,0.2)`,borderRadius:10,padding:"8px 12px",marginBottom:8}}>
                            <p style={{color:"#7c3aed",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>📦 Customers receiving from this batch ({batchCustomers.length})</p>
                            <div style={{display:"flex",flexDirection:"column",gap:4}}>
                              {batchCustomers.slice(0,5).map(d=>{
                                const dInvNo=(invRegistry?.issued||{})[d.id]||d.invNo||null;
                                const sc=d.status==="Delivered"?"#10b981":d.status==="In Transit"?"#3b82f6":"#f59e0b";
                                const prodQty=Object.entries(safeO(d.orderLines)).filter(([pid,l])=>{if(!(l.qty>0))return false;const p=products.find(x=>x.id===pid);const pName=p?.name||l.name||"";return pName===r.product||pName.toLowerCase().includes((r.product||"").toLowerCase())||(r.product||"").toLowerCase().includes(pName.toLowerCase());}).reduce((s,[,l])=>s+(+l.qty||0),0);
                                return <div key={d.id} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",borderBottom:`1px solid ${t.border}`}}>
                                  <span style={{width:6,height:6,borderRadius:"50%",background:sc,flexShrink:0}}/>
                                  <span style={{color:t.text,fontSize:11,fontWeight:600,flex:1,minWidth:0}} className="truncate">{d.customer}</span>
                                  {dInvNo&&<span style={{color:"#8b5cf6",fontSize:9,fontWeight:700,fontFamily:"monospace",flexShrink:0}}>📄{dInvNo}</span>}
                                  <span style={{color:"#7c3aed",fontSize:11,fontWeight:700,flexShrink:0}}>{prodQty} u</span>
                                </div>;
                              })}
                              {batchCustomers.length>5&&<p style={{color:t.sub,fontSize:10,textAlign:"center",paddingTop:4}}>+{batchCustomers.length-5} more customers…</p>}
                            </div>
                          </div>}
                          {r.notes&&<p style={{color:t.sub,fontSize:11,fontStyle:"italic",marginBottom:6}}>"{r.notes}"</p>}
                          {r.deduction&&<div style={{background:"#10b98110",border:"1px solid #10b98130",borderRadius:8,padding:"4px 8px",marginBottom:6,display:"inline-flex",alignItems:"center",gap:6}}>
                            <span style={{fontSize:10}}>📦</span>
                            <span style={{color:"#10b981",fontSize:10,fontWeight:700}}>Auto-deducted {r.deduction.deducted} from "{r.deduction.supplyItem}"</span>
                          </div>}
                          {recipeIngrs.length>0&&+r.actual>0&&<div style={{background:t.inp,borderRadius:8,padding:"6px 10px",marginBottom:6}}>
                            <p style={{color:t.sub,fontSize:10,fontWeight:700,marginBottom:3}}>🧪 Recipe used ({r.actual} units):</p>
                            {recipeIngrs.map((ing,ii)=><p key={ii} style={{color:t.text,fontSize:11}}>• {(+ing.qtyPerUnit*(+r.actual)).toFixed(2)} {ing.unit} {ing.supply}</p>)}
                          </div>}
                          {rWaste.length>0&&<div className="flex flex-wrap gap-1.5 mb-2">
                            {rWaste.map(w=><span key={w.id} style={{background:"#f9731618",color:"#f97316",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>🗑️ {w.qty} {w.unit} {w.product} — {w.type}</span>)}
                          </div>}
                          {rQC.length>0&&<div className="flex flex-wrap gap-1.5 mb-1">
                            {rQC.map(q=><span key={q.id} style={{background:gradeColor(q.grade)+"18",color:gradeColor(q.grade),borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>✅ QC {q.grade} — {q.product}{q.checker?" by "+q.checker:""}</span>)}
                          </div>}
                          {rHV.length>0&&<div className="flex flex-wrap gap-1.5 mb-1">
                            {rHV.map(h=><span key={h.id} style={{background:"#6366f118",color:"#6366f1",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>📋 {h.shift||"Handover"}{h.nextShift?" → "+h.nextShift:""}</span>)}
                          </div>}
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
                    return <div style={{background:t.inp,borderRadius:12,padding:"12px 14px",marginTop:12,border:`1px solid ${t.border}`}}>
                      {/* Header + summary */}
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,gap:8,flexWrap:"wrap"}}>
                        <div>
                          <p style={{color:t.text,fontSize:12,fontWeight:800}}>📦 {dayDelivs.length} Customer{dayDelivs.length!==1?"s":""} Served</p>
                          <p style={{color:t.sub,fontSize:10}}>Batch{dayRecs.length!==1?"es":""}: {batchLabels}</p>
                        </div>
                        <button onClick={exportTrailPDF} style={{background:"#7c3aed",color:"#fff",border:"none",borderRadius:8,padding:"5px 13px",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0,WebkitTapHighlightColor:"transparent"}}>📄 PDF Trail</button>
                      </div>
                      {canSeePrices&&<div className="crm-grid-4" style={{gap:6,marginBottom:10}}>
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
                      <div className="flex flex-col gap-2">
                        {dayDelivs.map((d,di)=>{
                          const dRows=lineRows(d.orderLines,products);
                          const dTot=lineTotal(d.orderLines);
                          const dRepl=+d.replacement?.amount||0;
                          const dNet=Math.max(0,dTot-dRepl);
                          const dCollected=d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0;
                          const dBalance=Math.max(0,dNet-dCollected);
                          const dInvNo=(invRegistry?.issued||{})[d.id]||null;
                          const dRcptNo=dInvNo?`RCP-${dInvNo.replace(/^[A-Z0-9]+-/,"")}`:`RCP-${(d.id||"").slice(-6).toUpperCase()}`;
                          return <div key={d.id} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,padding:"10px 12px",borderLeft:"3px solid #7c3aed"}}>
                            {/* Customer name + invoice/receipt */}
                            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:6,marginBottom:6}}>
                              <div>
                                <p style={{color:t.text,fontWeight:800,fontSize:13}}>{d.customer}</p>
                                <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:3}}>
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
                            <div style={{marginBottom:6}}>
                              {dRows.map(r=><div key={r.id} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"1px 0"}}>
                                <span style={{color:t.sub}}>{r.qty} × {r.name}{canSeePrices?<span> @ {inr(r.priceAmount)}</span>:""}</span>
                                {canSeePrices&&<span style={{color:t.text,fontWeight:600}}>{inr(r.qty*r.priceAmount)}</span>}
                              </div>)}
                            </div>
                            {/* Replacement */}
                            {d.replacement?.done&&<div style={{background:"#f9731612",border:"1px solid #f9731630",borderRadius:7,padding:"5px 8px",marginBottom:6}}>
                              <p style={{color:"#f97316",fontSize:10,fontWeight:700}}>🔄 {d.replacement.item||"Replacement"}{d.replacement.qty?` ×${d.replacement.qty}`:""}{canSeePrices&&dRepl>0?` · −${inr(dRepl)}`:""}</p>
                              {d.replacement.reason&&<p style={{color:t.sub,fontSize:10}}>{d.replacement.reason}</p>}
                            </div>}
                            {/* Payment summary */}
                            {canSeePrices&&dTot>0&&<div style={{display:"flex",flexWrap:"wrap",gap:8,fontSize:10}}>
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
            </>}

            {/* ── WASTAGE ── */}
            {prodSubTab==="wastage"&&<>
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
                <Card key={w.id} dm={dm}><div className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span style={{background:"#f9731620",color:"#f97316",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{w.type}</span>
                        <p style={{color:t.text,fontWeight:700,fontSize:13}}>{w.product}</p>
                        {w.shift&&<span style={{background:"#f59e0b20",color:"#f59e0b",borderRadius:6,padding:"2px 8px",fontSize:10}}>{w.shift}</span>}
                      </div>
                      <p style={{color:t.sub,fontSize:12}}>📅 {w.date} · {w.qty} {w.unit} · by {w.loggedBy}</p>
                      {w.reason&&<p style={{color:t.sub,fontSize:11,marginTop:3,fontStyle:"italic"}}>"{w.reason}"</p>}
                      {w.cost>0&&<p style={{color:"#ef4444",fontSize:12,fontWeight:700,marginTop:4}}>Cost: {inr(w.cost)}</p>}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {can("waste_edit")&&<button onClick={()=>{setWSh(w);setWF({...w});}} style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,minHeight:36,padding:"0 10px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer"}}>Edit</button>}
                      {can("waste_delete")&&<button onClick={()=>delW(w)} style={{background:"#dc2626",color:"#fff",minHeight:36,padding:"0 10px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",border:"none"}}>Del</button>}
                    </div>
                  </div>
                </div></Card>
              ))}
            </>}

            {/* ── QC ── */}
            {prodSubTab==="qc"&&<>
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
                <Card key={q.id} dm={dm}><div className="p-4">
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
                        {q.notes&&<p style={{color:t.sub,background:t.inp,borderRadius:8,padding:"6px 10px",marginTop:8}} className="text-xs">"{q.notes}"</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span style={{background:gradeColor(q.grade)+"20",color:gradeColor(q.grade),borderRadius:8,padding:"2px 8px",fontSize:10,fontWeight:700}}>{GRADES.find(x=>x.g===q.grade)?.label||q.grade}</span>
                      {can("qc_delete")&&<button onClick={()=>delQC(q)} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-red-600 text-white">Del</button>}
                    </div>
                  </div>
                </div></Card>
              ))}
            </>}

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
                  <Card key={h.id} dm={dm}><div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          {h.shift&&<span style={{background:"#f59e0b20",color:"#f59e0b",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{h.shift}</span>}
                          {h.nextShift&&<><span style={{color:t.sub,fontSize:10}}>→</span><span style={{background:t.inp,color:t.sub,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:600}}>{h.nextShift}</span></>}
                        </div>
                        <p style={{color:t.sub}} className="text-xs">📅 {h.date} · by {h.loggedBy}</p>
                      </div>
                      {can("prod_handover")&&<button onClick={()=>setHandovers(p=>safeArr(p).filter(x=>x.id!==h.id))} style={{background:t.inp,color:t.sub}} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold">Delete</button>}
                    </div>
                    <div style={{background:t.inp,border:`1px solid ${t.inpB}`,borderRadius:12,padding:"10px 14px",color:t.text}} className="text-sm">{h.note}</div>
                    {h.issues&&<div style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:10,padding:"8px 12px",marginTop:8}}>
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
                      style={{width:"100%",background:T(dm).inp,border:`1.5px solid ${T(dm).inpB}`,color:T(dm).text,borderRadius:14,padding:"10px 14px",fontSize:13,outline:"none",resize:"vertical",fontFamily:"system-ui"}}/>
                  </div>
                  <Inp dm={dm} label="Issues / Problems" value={hvF.issues} onChange={e=>setHvF({...hvF,issues:e.target.value})} placeholder="Any problems, machine issues…"/>
                  <Btn dm={dm} onClick={saveHandover} className="w-full">Save Handover Note</Btn>
                </Sheet>
              </>;
            })()}
          </>;
        })()}

        {/* GPS TAB */}
        {/* ═══════════════════════════════════════════════════════
            INGREDIENTS — Consumption Tracking
        ═══════════════════════════════════════════════════════ */}
