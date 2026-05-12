/* eslint-disable */
// TAB: Supplies
// This file contains the Supplies tab JSX, extracted from App.js

        {tab==="Supplies"&&(()=>{
          const supThisMonth=supplies.filter(s=>s.date?.startsWith(new Date().toISOString().slice(0,7)));
          const supThisMonthCost=supThisMonth.reduce((a,s)=>a+(s.cost||0),0);
          const uniqueSuppliers=[...new Set(supplies.map(s=>s.supplier).filter(Boolean))];
          // Fix: use the memoized lowStockItems from outer scope (uses lowStockThreshold from settings)
          // Previously re-declared here using a different condition (minStock field vs settings threshold)
          const supLowStockItems=supplies.filter(s=>s.minStock&&(+s.qty||0)<=(+s.minStock));
          const suppByName=uniqueSuppliers.map(sup=>({
            name:sup,
            count:supplies.filter(s=>s.supplier===sup).length,
            total:supplies.filter(s=>s.supplier===sup).reduce((a,s)=>a+(s.cost||0),0),
          })).sort((a,b)=>b.total-a.total).slice(0,5);
          const maxSup=suppByName[0]?.total||1;
          return <>
          {/* ── SUPPLIES TAB HEADER ── */}
          <SectionHeader dm={dm} title="Supplies" sub="Track inventory and supplier costs"
            cta={null}/>
          {canSeeFinancials&&<TabStatCards dm={dm} cards={[
            {icon:"📦",label:"Total Cost",value:inr(totalSupC),sub:`${supplies.length} entries`,iconBg:t.statIcon4},
            {icon:"📅",label:"This Month",value:inr(supThisMonthCost),sub:`${supThisMonth.length} entries`,iconBg:t.statIcon3},
            {icon:"🏪",label:"Suppliers",value:uniqueSuppliers.length,sub:"unique vendors",iconBg:t.statIcon1},
            {icon:"⚠️",label:"Low Stock",value:lowStockItems.length,sub:lowStockItems.length===0?"all good":"need restocking",iconBg:lowStockItems.length>0?t.statIcon5:t.statIcon2},
          ]}/>}
          {/* ── HERO WIDGETS ROW ── */}
          {canSeeFinancials&&<div className="crm-grid-4">
            {/* Total Cost */}
            <div style={{background:dm?"linear-gradient(135deg,#1e1b4b,#2d1b69)":"linear-gradient(135deg,#ede9fe,#ddd6fe)",border:`1px solid ${dm?"#4c1d95":"#c4b5fd"}`,borderRadius:18,padding:"16px 18px",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:-10,right:-10,width:60,height:60,background:dm?"rgba(139,92,246,0.2)":"rgba(139,92,246,0.15)",borderRadius:"50%"}}/>
              <p style={{color:dm?"#a78bfa":"#6d28d9",fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>Total Cost</p>
              <p style={{color:dm?"#ede9fe":"#3b0764",fontSize:22,fontWeight:800,lineHeight:1,letterSpacing:"-0.02em"}}>{inr(totalSupC)}</p>
              <p style={{color:dm?"#7c3aed":"#7c3aed",fontSize:11,marginTop:5,fontWeight:500}}>{supplies.length} entries</p>
            </div>
            {/* This Month */}
            <div style={{background:dm?"linear-gradient(135deg,#1c1506,#2d1f06)":"linear-gradient(135deg,#fffbeb,#fef3c7)",border:`1px solid ${dm?"#78350f":"#fde68a"}`,borderRadius:18,padding:"16px 18px",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:-10,right:-10,width:60,height:60,background:"rgba(245,158,11,0.15)",borderRadius:"50%"}}/>
              <p style={{color:dm?"#fbbf24":"#b45309",fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>This Month</p>
              <p style={{color:dm?"#fef3c7":"#451a03",fontSize:22,fontWeight:800,lineHeight:1,letterSpacing:"-0.02em"}}>{inr(supThisMonthCost)}</p>
              <p style={{color:dm?"#d97706":"#d97706",fontSize:11,marginTop:5,fontWeight:500}}>{supThisMonth.length} entries</p>
            </div>
            {/* Suppliers */}
            <div style={{background:dm?"linear-gradient(135deg,#0c1a2e,#0c2040)":"linear-gradient(135deg,#eff6ff,#dbeafe)",border:`1px solid ${dm?"#1e3a5f":"#bfdbfe"}`,borderRadius:18,padding:"16px 18px",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:-10,right:-10,width:60,height:60,background:"rgba(14,165,233,0.15)",borderRadius:"50%"}}/>
              <p style={{color:dm?"#38bdf8":"#0369a1",fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>Suppliers</p>
              <p style={{color:dm?"#e0f2fe":"#0c4a6e",fontSize:22,fontWeight:800,lineHeight:1,letterSpacing:"-0.02em"}}>{uniqueSuppliers.length}</p>
              <p style={{color:dm?"#0ea5e9":"#0369a1",fontSize:11,marginTop:5,fontWeight:500}}>unique vendors</p>
            </div>
            {/* Low Stock */}
            <div style={{background:dm?lowStockItems.length>0?"linear-gradient(135deg,#2d0a0a,#3f1010)":"linear-gradient(135deg,#0a1f0a,#0f2d0f)":lowStockItems.length>0?"linear-gradient(135deg,#fff1f2,#ffe4e6)":"linear-gradient(135deg,#f0fdf4,#dcfce7)",border:`1px solid ${lowStockItems.length>0?(dm?"#7f1d1d":"#fecdd3"):(dm?"#14532d":"#bbf7d0")}`,borderRadius:18,padding:"16px 18px",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:-10,right:-10,width:60,height:60,background:lowStockItems.length>0?"rgba(239,68,68,0.15)":"rgba(16,185,129,0.15)",borderRadius:"50%"}}/>
              <p style={{color:lowStockItems.length>0?(dm?"#f87171":"#b91c1c"):(dm?"#34d399":"#059669"),fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>Low Stock</p>
              <p style={{color:lowStockItems.length>0?(dm?"#fef2f2":"#450a0a"):(dm?"#d1fae5":"#064e3b"),fontSize:22,fontWeight:800,lineHeight:1,letterSpacing:"-0.02em"}}>{lowStockItems.length}</p>
              <p style={{color:lowStockItems.length>0?(dm?"#ef4444":"#dc2626"):(dm?"#10b981":"#059669"),fontSize:11,marginTop:5,fontWeight:500}}>{lowStockItems.length===0?"all stocked up":"need restocking"}</p>
            </div>
          </div>}

          {/* ── TOP SUPPLIERS BAR CHART ── */}
          {canSeeFinancials&&suppByName.length>0&&<Card dm={dm} className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p style={{color:t.text,fontSize:14,fontWeight:700}}>Top Suppliers by Spend</p>
                <p style={{color:t.sub,fontSize:11,marginTop:2}}>Showing top {suppByName.length} vendors</p>
              </div>
              <span style={{background:dm?"rgba(139,92,246,0.15)":"rgba(139,92,246,0.1)",color:"#8b5cf6",fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:8,border:"1px solid rgba(139,92,246,0.3)"}}>📊 Spend</span>
            </div>
            {suppByName.map((s,i)=>{
              const pct=Math.round(s.total/maxSup*100);
              const colors=["#8b5cf6","#06b6d4","#f59e0b","#10b981","#f43f5e"];
              const c=colors[i%colors.length];
              return <div key={s.name} className="mb-3 last:mb-0">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div style={{width:8,height:8,borderRadius:2,background:c,flexShrink:0}}/>
                    <p style={{color:t.text,fontSize:13,fontWeight:600}}>{s.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{color:c,fontWeight:700,fontSize:13}}>{inr(s.total)}</span>
                    <span style={{color:t.sub,fontSize:11,background:t.inp,padding:"2px 6px",borderRadius:6}}>{s.count}×</span>
                  </div>
                </div>
                <div style={{background:t.border,height:6,borderRadius:6,overflow:"hidden"}}>
                  <div style={{width:`${pct}%`,background:`linear-gradient(90deg,${c},${c}cc)`,height:"100%",borderRadius:6,transition:"width 0.4s ease"}}/>
                </div>
              </div>;
            })}
          </Card>}

          {/* ── TOOLBAR ── */}
          <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"12px 14px"}} className="flex items-center justify-between gap-4 flex-wrap" style={{rowGap:12}}>
            <div className="flex items-center gap-3 flex-wrap">
              <span style={{color:t.text,fontSize:13,fontWeight:700}}>{fSup.length} {fSup.length===1?"entry":"entries"}</span>
              {canSeeFinancials&&supplies.length>0&&<span style={{color:"#8b5cf6",background:dm?"rgba(139,92,246,0.12)":"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.25)",fontSize:12,fontWeight:700,padding:"3px 9px",borderRadius:8}}>{inr(fSup.reduce((a,s)=>a+(s.cost||0),0))}</span>}
              {lowStockItems.length>0&&<span style={{color:"#ef4444",background:dm?"rgba(239,68,68,0.12)":"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.3)",fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:8}}>⚠️ {lowStockItems.length} low</span>}
            </div>
            <div className="flex gap-3 items-center">
              {can("sup_export")&&<div className="flex gap-2">
                <button onClick={()=>exportTabPDF("Supplies",supplies,[{label:"Item",key:"item"},{label:"Qty",key:"qty",num:true},{label:"Unit",key:"unit"},{label:"Supplier",key:"supplier"},{label:"Cost (₹)",key:"cost",num:true},{label:"Date",key:"date"},{label:"Notes",key:"notes"}],settings)} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 10px",fontSize:11,fontWeight:600,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>PDF</button>
                <button onClick={()=>exportTabExcel("Supplies",supplies,[{label:"Item",key:"item"},{label:"Qty",key:"qty",num:true},{label:"Unit",key:"unit"},{label:"Supplier",key:"supplier"},{label:"Cost",key:"cost",num:true},{label:"Min Stock",key:"minStock"},{label:"Date",key:"date"},{label:"Notes",key:"notes"}],settings)} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 10px",fontSize:11,fontWeight:600,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>XLS</button>
              </div>}
              {can("sup_add")&&<button onClick={()=>{setSf(blkS());setSsh("add");}} style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",fontSize:13,fontWeight:700,cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"flex",alignItems:"center",gap:6,minHeight:40,boxShadow:"0 2px 8px rgba(37,99,235,0.35)"}}>
                <span style={{fontSize:16,lineHeight:1}}>+</span> Add Supply
              </button>}
            </div>
          </div>

          {/* ── SEARCH ── */}
          {/* Supplies search is in the desktop header */}

          {/* ── SUPPLIES DATA TABLE ── */}
          {fSup.length===0&&<div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"40px 20px",textAlign:"center"}}>
            <div style={{fontSize:40,marginBottom:12}}>📦</div>
            <p style={{color:t.text,fontSize:15,fontWeight:700,marginBottom:4}}>{srch?"No results found":"No supplies yet"}</p>
            <p style={{color:t.sub,fontSize:13,marginBottom:16}}>{srch?"Try a different search term":"Log your first supply entry to get started"}</p>
            {!srch&&can("sup_add")&&<button onClick={()=>{setSf(blkS());setSsh("add");}} style={{background:"#8b5cf6",color:"#fff",border:"none",borderRadius:12,padding:"12px 24px",fontSize:14,fontWeight:700,cursor:"pointer"}}>+ Log Supply</button>}
          </div>}
          {fSup.length>0&&(()=>{
            const sortedSup=[...fSup].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
            return <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
              <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
                <table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
                  <thead>
                    <tr style={{background:dm?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.025)",borderBottom:`1.5px solid ${t.border}`}}>
                      <th style={{padding:"11px 8px 11px 16px",width:28}}></th>
                      <th style={{padding:"11px 12px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Item</th>
                      <th style={{padding:"11px 12px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Supplier</th>
                      <th style={{padding:"11px 12px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Date</th>
                      <th style={{padding:"11px 12px",textAlign:"right",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Quantity</th>
                      {can("sup_seeCost")&&<th style={{padding:"11px 12px",textAlign:"right",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Cost</th>}
                      <th style={{padding:"11px 12px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Stock</th>
                      <th style={{padding:"11px 16px 11px 12px",textAlign:"right",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSup.map((s,si)=>{
                      const isLow=s.minStock&&(+s.qty||0)<=(+s.minStock);
                      const isEven=si%2===0;
                      return <tr key={s.id||si}
                        style={{borderBottom:`1px solid ${t.border}`,background:isEven?(dm?"rgba(255,255,255,0.01)":"rgba(0,0,0,0.007)"):"transparent",transition:"background 0.12s"}}
                        onMouseEnter={e=>{e.currentTarget.style.background=dm?"rgba(255,255,255,0.04)":"rgba(139,92,246,0.04)";}}
                        onMouseLeave={e=>{e.currentTarget.style.background=isEven?(dm?"rgba(255,255,255,0.01)":"rgba(0,0,0,0.007)"):"transparent";}}>
                        {/* Low stock dot */}
                        <td style={{padding:"14px 4px 14px 16px",verticalAlign:"middle"}}>
                          <span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:isLow?"#ef4444":"#10b981"}}/>
                        </td>
                        {/* Item */}
                        <td style={{padding:"14px 12px",verticalAlign:"middle",maxWidth:180}}>
                          <p style={{color:t.text,fontWeight:700,fontSize:13,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.item}</p>
                          {s.notes&&<p style={{color:t.sub,fontSize:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:170,fontStyle:"italic"}}>{s.notes}</p>}
                          {isLow&&<span style={{background:"#ef444415",color:"#ef4444",border:"1px solid #ef444430",borderRadius:6,padding:"1px 6px",fontSize:10,fontWeight:700}}>LOW</span>}
                        </td>
                        {/* Supplier */}
                        <td style={{padding:"14px 12px",verticalAlign:"middle",maxWidth:140}}>
                          <p style={{color:t.text,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.supplier||"—"}</p>
                        </td>
                        {/* Date */}
                        <td style={{padding:"14px 12px",verticalAlign:"middle",whiteSpace:"nowrap"}}>
                          <p style={{color:t.text,fontWeight:600,fontSize:13}}>{s.date||"—"}</p>
                        </td>
                        {/* Qty */}
                        <td style={{padding:"14px 12px",verticalAlign:"middle",textAlign:"right",whiteSpace:"nowrap"}}>
                          <span style={{color:isLow?"#ef4444":t.text,fontWeight:800,fontSize:13}}>{s.qty}</span>
                          <span style={{color:t.sub,fontSize:11,marginLeft:4}}>{s.unit}</span>
                        </td>
                        {/* Cost */}
                        {can("sup_seeCost")&&<td style={{padding:"14px 12px",verticalAlign:"middle",textAlign:"right",whiteSpace:"nowrap"}}>
                          <span style={{color:"#7c3aed",fontWeight:700,fontSize:13}}>{s.cost>0?inr(s.cost):"—"}</span>
                        </td>}
                        {/* Stock pill */}
                        <td style={{padding:"14px 12px",verticalAlign:"middle"}}>
                          {s.minStock?<span style={{display:"inline-flex",alignItems:"center",gap:5,background:isLow?"#ef444415":"#10b98115",color:isLow?"#dc2626":"#059669",border:`1px solid ${isLow?"#ef444425":"#10b98125"}`,borderRadius:99,padding:"3px 10px",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>
                            {isLow?"⚠️ Low":"✓ OK"}
                          </span>:<span style={{color:t.sub,fontSize:11}}>—</span>}
                        </td>
                        {/* Actions */}
                        <td style={{padding:"14px 16px 14px 12px",verticalAlign:"middle",textAlign:"right",whiteSpace:"nowrap"}}>
                          <div style={{display:"inline-flex",gap:6}}>
                            {can("sup_edit")&&<button onClick={()=>{setSf({...s});setSsh(s);}}
                              style={{width:32,height:32,borderRadius:8,background:dm?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)",border:`1px solid ${t.border}`,color:t.sub,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",transition:"all 0.12s",fontSize:13}}
                              onMouseEnter={e=>{e.currentTarget.style.background="#2563eb";e.currentTarget.style.color="#fff";e.currentTarget.style.borderColor="#2563eb";}}
                              onMouseLeave={e=>{e.currentTarget.style.background=dm?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)";e.currentTarget.style.color=t.sub;e.currentTarget.style.borderColor=t.border;}}>
                              ✏️
                            </button>}
                            {can("sup_delete")&&<button onClick={()=>delS(s)}
                              style={{width:32,height:32,borderRadius:8,background:dm?"rgba(239,68,68,0.1)":"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.2)",color:"#ef4444",cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",transition:"all 0.12s",fontSize:13}}
                              onMouseEnter={e=>{e.currentTarget.style.background="#ef4444";e.currentTarget.style.color="#fff";}}
                              onMouseLeave={e=>{e.currentTarget.style.background=dm?"rgba(239,68,68,0.1)":"rgba(239,68,68,0.06)";e.currentTarget.style.color="#ef4444";}}>
                              🗑️
                            </button>}
                          </div>
                        </td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
              {/* Footer */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 18px",borderTop:`1px solid ${t.border}`,flexWrap:"wrap",gap:10,background:dm?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.015)"}}>
                <p style={{color:t.sub,fontSize:12,fontWeight:500}}>Showing <b style={{color:t.text}}>{fSup.length}</b> of <b style={{color:t.text}}>{fSup.length}</b> supplies</p>
                {can("sup_seeCost")&&<p style={{color:"#7c3aed",fontSize:12,fontWeight:700}}>Total: {inr(fSup.reduce((a,s)=>a+(s.cost||0),0))}</p>}
                <span style={{color:t.sub,fontSize:11}}>{lowStockItems.length>0?`⚠️ ${lowStockItems.length} low stock`:"✓ Stock OK"}</span>
              </div>
            </div>;
          })()}
          </>;
        })()}

        {/* EXPENSES */}
