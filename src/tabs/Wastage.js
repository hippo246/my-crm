/* eslint-disable */
// TAB: Wastage
// This file contains the Wastage tab JSX, extracted from App.js

        {tab==="Wastage"&&(<>
          <SectionHeader dm={dm} title="Wastage" sub="Track production wastage and losses"
            cta={<button onClick={()=>{setWSh("add");setWF(blkW());}}
              style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:12,padding:"11px 20px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:7,boxShadow:"0 2px 8px rgba(37,99,235,0.3)"}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Log Wastage
            </button>}/>
          {/* Stats row */}
          {(()=>{
            const canW = isAdmin||(settings?.showWastageTo||["admin","factory"]).includes(sess.role);
            if(!canW)return <p style={{color:t.sub}} className="text-sm text-center py-8">Access restricted by admin.</p>;
            const totalWasteQty = wastage.reduce((s,w)=>s+(w.qty||0),0);
            const totalWasteCost = wastage.reduce((s,w)=>s+(w.cost||0),0);
            const todayWaste = wastage.filter(w=>w.date===today());
            const byType = (settings?.wastageTypes||["Other"]).map(type=>({type,count:wastage.filter(w=>w.type===type).reduce((s,w)=>s+(w.qty||0),0)})).filter(x=>x.count>0);
            const byProduct = [...new Set(wastage.map(w=>w.product))].map(p=>({product:p,qty:wastage.filter(w=>w.product===p).reduce((s,w)=>s+(w.qty||0),0),cost:wastage.filter(w=>w.product===p).reduce((s,w)=>s+(w.cost||0),0)}));
            const fWaste = wastage.filter(w=>!srch||(w.product.toLowerCase().includes(srch.toLowerCase())||w.type.toLowerCase().includes(srch.toLowerCase())||w.reason?.toLowerCase().includes(srch.toLowerCase())||w.loggedBy?.toLowerCase().includes(srch.toLowerCase())));
            return (<>
              {/* Summary tiles */}
              <div className={`grid gap-3 ${can("waste_seeCost")?"grid-cols-2 sm:grid-cols-4":"grid-cols-2"}`}>
                <StatCard dm={dm} label="Total Wastage" value={totalWasteQty} sub={`${wastage.length} records`} accent="#f97316"/>
                <StatCard dm={dm} label="Today's Wastage" value={todayWaste.reduce((s,w)=>s+(w.qty||0),0)} sub={`${todayWaste.length} entries today`} accent="#ef4444"/>
                {can("waste_seeCost")&&<><StatCard dm={dm} label="Wastage Cost" value={inr(totalWasteCost)} sub="Estimated loss" accent="#8b5cf6"/>
                <StatCard dm={dm} label="This Week" value={wastage.filter(w=>{const d=new Date((w.date||"")+"T00:00:00");const n=new Date();return(n-d)<7*86400000;}).reduce((s,w)=>s+(w.qty||0),0)} sub="Last 7 days qty" accent="#f59e0b"/></>}
              </div>

              {/* By product breakdown */}
              {byProduct.length>0&&<Card dm={dm}><div className="p-4">
                <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-3">By Product</p>
                {byProduct.map(p=>(
                  <div key={p.product} className="flex justify-between py-2" style={{borderBottom:`1px solid ${t.border}`}}>
                    <span style={{color:t.text}} className="text-sm font-semibold">{p.product}</span>
                    <div className="flex gap-3">
                      <span style={{color:t.sub}} className="text-sm">{p.qty} units wasted</span>
                      {isAdmin&&<span className="text-sm font-bold text-red-500">{inr(p.cost)}</span>}
                    </div>
                  </div>
                ))}
              </div></Card>}

              {/* By type */}
              {byType.length>0&&<Card dm={dm}><div className="p-4">
                <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-3">By Type</p>
                <div className="flex flex-wrap gap-2">{byType.map(x=><div key={x.type} style={{background:t.inp}} className="rounded-xl px-3 py-2 text-center"><p style={{color:t.text}} className="text-sm font-bold">{x.count}</p><p style={{color:t.sub}} className="text-[11px]">{x.type}</p></div>)}</div>
              </div></Card>}

              {/* Controls */}
              <div className="flex gap-3 items-center justify-between flex-wrap" style={{marginTop:4,marginBottom:4}}>
                <Pill dm={dm} c="red">{wastage.length} total records</Pill>
                <div className="crm-btn-group">
                  <Btn dm={dm} v="outline" size="sm" onClick={()=>{
                    const cols=[{label:"Date",key:"date"},{label:"Shift",key:"shift"},{label:"Product",key:"product"},{label:"Qty",key:"qty",num:true},{label:"Unit",key:"unit"},{label:"Type",key:"type"},{label:"Reason",key:"reason"},{label:"Cost (₹)",key:"cost",num:true},{label:"Logged By",key:"loggedBy"}];
                    const statsHtml=`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px"><div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px 14px"><div style="font-size:20px;font-weight:900;color:#c2410c">${totalWasteQty}</div><div style="font-size:9px;text-transform:uppercase;color:#a8a29e;margin-top:3px">Total Qty Wasted</div></div><div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:12px 14px"><div style="font-size:20px;font-weight:900;color:#b91c1c">${inr(totalWasteCost)}</div><div style="font-size:9px;text-transform:uppercase;color:#a8a29e;margin-top:3px">Cost Loss</div></div><div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 14px"><div style="font-size:20px;font-weight:900;color:#92400e">${todayWaste.reduce((s,w)=>s+(w.qty||0),0)}</div><div style="font-size:9px;text-transform:uppercase;color:#a8a29e;margin-top:3px">Today's Wastage</div></div></div>`;
                    exportTabPDF("Wastage",wastage,cols,settings,statsHtml);
                    addLog("Exported wastage","PDF report");
                  }}>📄 PDF</Btn>
                  <Btn dm={dm} v="outline" size="sm" onClick={()=>{
                    exportTabExcel("Wastage",wastage,[{label:"Date",key:"date"},{label:"Shift",key:"shift"},{label:"Product",key:"product"},{label:"Qty",key:"qty",num:true},{label:"Unit",key:"unit"},{label:"Type",key:"type"},{label:"Reason",key:"reason"},{label:"Cost",key:"cost",num:true},{label:"Logged By",key:"loggedBy"},{label:"Created At",key:"createdAt"}],settings);
                    addLog("Exported wastage","XLS export");
                  }}>📊 XLS</Btn>
                  <Btn dm={dm} v="outline" size="sm" onClick={()=>{
                    exportCSV(wastage,"wastage",[
                      {label:"Date",key:"date"},{label:"Shift",key:"shift"},{label:"Product",key:"product"},
                      {label:"Qty",key:"qty"},{label:"Unit",key:"unit"},{label:"Type",key:"type"},
                      {label:"Reason",key:"reason"},{label:"Cost (₹)",key:"cost"},{label:"Logged By",key:"loggedBy"},
                      {label:"Time",key:"createdAt"}
                    ]);addLog("Exported wastage","CSV export");}}>CSV</Btn>
                  <Btn dm={dm} size="sm" onClick={()=>{setWF(blkW());setWSh("add");}}>+ Log Wastage</Btn>
                </div>
              </div>
              {/* Records list */}
              {fWaste.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-6">No wastage records found.</p>}
              {fWaste.map(w=>(
                <Card key={w.id} dm={dm}><div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p style={{color:t.text}} className="font-semibold">{w.product}</p>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                        <span style={{color:t.sub}} className="text-xs">📅 {w.date}</span>
                        <span style={{color:t.sub}} className="text-xs">🕐 {w.shift}</span>
                        <span style={{color:t.sub}} className="text-xs">by {w.loggedBy||"—"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill dm={dm} c="red">{w.type}</Pill>
                      <span style={{color:t.text}} className="font-black text-base">{w.qty} <span style={{color:t.sub}} className="text-xs font-normal">{w.unit}</span></span>
                    </div>
                  </div>
                  {w.reason&&<p style={{color:t.sub}} className="text-xs italic mb-2">"{w.reason}"</p>}
                  {can("waste_seeCost")&&w.cost>0&&<p className="text-xs font-semibold text-red-400 mb-2">Estimated cost loss: {inr(w.cost)}</p>}
                  {(isAdmin||(sess.id&&w.loggedBy===sess.name))&&(
                    <div className="flex gap-1.5">
                      <button onClick={()=>{setWF({...w,qty:String(w.qty),cost:String(w.cost||"")});setWSh(w);}} style={{background:t.inp,color:t.text}} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px]">Edit</button>
                      {can("waste_delete")&& <button onClick={()=>delW(w)} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px] bg-red-600 text-white">Delete</button>}
                    </div>
                  )}
                </div></Card>
              ))}
            </>);
          })()}
        </>)}


        {/* ══════════════════════════════════════════════════════════════
            PAYMENTS TAB — Full ledger, outstanding balances, daily summary
            ══════════════════════════════════════════════════════════════ */}
