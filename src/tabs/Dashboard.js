/* eslint-disable */
// TAB: Dashboard
// This file contains the Dashboard tab JSX, extracted from App.js

        {tab==="Dashboard"&&(<>
          {/* ══════════════════════════════════════════
              PHASE 12 — DASHBOARD (Redesigned)
          ══════════════════════════════════════════ */}
          {(()=>{
            // Values pre-computed in dashStats useMemo — no per-render filtering
            const {todayDelivs=[],todayDone=[],todayPend=[],todayTransit=[],todayCancl=[],todayRev=0,
                   weekDelivs=[],monthDelivs=[],weekRev=0,monthRev=0,allDue=[],totalDueAmt=0,
                   todayPT=[],totalTarget=0,totalActual=0,prodPct=null,overdueD=[],todayWastage=[],todayWasteCost=0} = dashStats||{};
            const todayStr = today();

            const greetHour = new Date().getHours();
            const greeting = greetHour < 12 ? "Good morning" : greetHour < 17 ? "Good afternoon" : "Good evening";
            const greetEmoji = greetHour < 12 ? "🌅" : greetHour < 17 ? "☀️" : "🌙";

            // shared card style helpers
            const card = (extra={}) => ({background:t.card, border:`1px solid ${t.border}`, borderRadius:20, ...extra});
            const sectionLabel = {color:t.sub, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:6};
            const bigNum = (color="#fff") => ({color, fontWeight:900, fontSize:26, lineHeight:1, letterSpacing:"-0.02em"});

            return <>

            {/* ── DASHBOARD HEADER ── */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                  <span style={{fontSize:18,lineHeight:1}}>{greetEmoji}</span>
                  <h1 style={{color:t.text,fontWeight:800,fontSize:24,letterSpacing:"-0.03em",lineHeight:1,margin:0}}>
                    {greeting}, {sess.name.split(" ")[0]}
                  </h1>
                </div>
                <p style={{color:t.sub,fontSize:13,marginLeft:26}}>{new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p>
              </div>
              {isAdmin&&<button onClick={()=>{setDsh("add");setDf(blkD());}}
                style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:12,padding:"11px 20px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:7,boxShadow:"0 2px 8px rgba(37,99,235,0.3)",flexShrink:0}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New Order
              </button>}
            </div>

            {/* ── MORNING BRIEFING ── */}
            {can("dash_seeBriefing")&&(briefingPinned||(!briefingDismissed||(briefingDismissed!==todayStr)))&&(()=>{
              const data={pendingCount:todayPend.length+todayTransit.length,todayRev,lowStockCount:lowStockItems.length,overdueCount:overdueD.length,churnCount:churnedCustomers.length,noticeCount:(notices||[]).filter(n=>!(n.readBy||[]).includes(sess.id)).length,churnDays};
              return <MorningBriefing dm={dm} onDismiss={()=>setBriefingDismissed(todayStr)} onUnpin={()=>setBriefingPinned(p=>!p)} pinned={briefingPinned} data={data}/>;
            })()}

            {/* ── TODAY AT A GLANCE — delivery status card ── */}
            <div style={{...card(),overflow:"hidden"}}>
              <div style={{padding:"18px 20px 14px",background:dm?"linear-gradient(135deg,rgba(37,99,235,0.18) 0%,rgba(99,102,241,0.10) 100%)":"linear-gradient(135deg,rgba(37,99,235,0.08) 0%,rgba(99,102,241,0.04) 100%)",borderBottom:`1px solid ${t.border}`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                <div>
                  <p style={sectionLabel}>📦 Today's Deliveries</p>
                  <div style={{display:"flex",alignItems:"baseline",gap:10}}>
                    <p style={{...bigNum(t.text),fontSize:32}}>{todayDelivs.length}</p>
                    <p style={{color:t.sub,fontSize:13}}>orders today</p>
                  </div>
                </div>
                <button onClick={()=>setTab("Deliveries")}
                  style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:12,padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                  View all →
                </button>
              </div>
              </div>
              <div style={{padding:"14px 20px"}}>
              {todayDelivs.length > 0 ? (()=>{
                const total = todayDelivs.length;
                const segments = [
                  {label:"Delivered", val:todayDone.length,    color:"#10b981", bg: dm?"#10b98118":"#f0fdf4"},
                  {label:"In Transit",val:todayTransit.length, color:"#3b82f6", bg: dm?"#3b82f618":"#eff6ff"},
                  {label:"Pending",   val:todayPend.length,    color:"#f59e0b", bg: dm?"#f59e0b18":"#fffbeb"},
                  {label:"Cancelled", val:todayCancl.length,   color:"#ef4444", bg: dm?"#ef444418":"#fef2f2"},
                ];
                return <>
                  {/* Segmented progress bar */}
                  <div style={{height:10,borderRadius:10,overflow:"hidden",display:"flex",gap:2,marginBottom:14,background:t.border}}>
                    {segments.map(s => s.val > 0 &&
                      <div key={s.label} style={{width:`${Math.round(s.val/total*100)}%`,background:s.color,transition:"width 0.7s ease",borderRadius:10}}/>
                    )}
                  </div>
                  {/* Status tiles */}
                  <div className="crm-grid-4" style={{gap:8}}>
                    {segments.map(({label,val,color,bg})=>(
                      <div key={label} style={{background:bg,borderRadius:14,padding:"10px 8px",textAlign:"center",border:`1px solid ${color}22`}}>
                        <p style={{color,fontWeight:900,fontSize:22,lineHeight:1}}>{val}</p>
                        <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em",marginTop:4,lineHeight:1.3}}>{label}</p>
                      </div>
                    ))}
                  </div>
                </>;
              })() : (
                <div style={{background:t.inp,borderRadius:14,padding:"20px",textAlign:"center"}}>
                  <p style={{fontSize:28,marginBottom:6}}>🗓️</p>
                  <p style={{color:t.sub,fontSize:13}}>No deliveries scheduled for today</p>
                </div>
              )}
              </div>
            </div>

            {/* ── REVENUE STATS — Today / Week / Month ── */}
            {canSeeFinancials&&<div style={{...card(),overflow:"hidden"}}>
              <div style={{padding:"16px 20px 14px",background:dm?"linear-gradient(135deg,rgba(16,185,129,0.15) 0%,rgba(5,150,105,0.08) 100%)":"linear-gradient(135deg,rgba(16,185,129,0.08) 0%,rgba(5,150,105,0.03) 100%)",borderBottom:`1px solid ${t.border}`}}>
              <p style={sectionLabel}>💰 Revenue</p>
              <div className="crm-grid-3" style={{gap:0,marginBottom:16}}>
                {[
                  {label:"Today",     val:todayRev,  sub:`${todayDone.length} orders`,   color:"#10b981", borderR:true},
                  {label:"This Week", val:weekRev,   sub:`${weekDelivs.length} orders`,  color:"#3b82f6", borderR:true},
                  {label:"This Month",val:monthRev,  sub:`${monthDelivs.length} orders`, color:"#8b5cf6", borderR:false},
                ].map(({label,val,sub,color,borderR})=>(
                  <div key={label} style={{textAlign:"center",paddingBottom:4,borderRight:borderR?`1px solid ${t.border}`:"none"}}>
                    <p style={{color,fontWeight:900,fontSize:22,lineHeight:1,letterSpacing:"-0.02em"}}>{inr(val)}</p>
                    <p style={{color:t.text,fontSize:11,fontWeight:700,marginTop:4}}>{label}</p>
                    <p style={{color:t.sub,fontSize:10,marginTop:1}}>{sub}</p>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={chartData} margin={{top:0,right:0,left:-28,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false}/>
                  <XAxis dataKey="date" tick={{fontSize:9,fill:t.sub}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:9,fill:t.sub}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,color:t.text,fontSize:11}} formatter={(v)=>inr(v)}/>
                  <Bar dataKey="Revenue" fill="#10b981" radius={[4,4,0,0]}/>
                  <Bar dataKey="Expenses" fill="#ef4444" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
              <div style={{display:"flex",gap:16,justifyContent:"center",marginTop:6}}>
                {[{c:"#10b981",l:"Revenue"},{c:"#ef4444",l:"Expenses"}].map(({c,l})=>(
                  <span key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:t.sub}}>
                    <span style={{width:8,height:8,borderRadius:2,background:c,display:"inline-block"}}/>{l}
                  </span>
                ))}
              </div>
              </div>
            </div>}

            {/* ── OUTSTANDING PAYMENTS ── */}
            {canSeeFinancials&&allDue.length>0&&(()=>{
              const totalBilled = customers.reduce((s,c)=>(s+(c.paid||0)+(c.pending||0)),0);
              const collPct = totalBilled>0?Math.round(customers.reduce((s,c)=>s+(c.paid||0),0)/totalBilled*100):100;
              return <div style={{...card(), border:`1.5px solid ${dm?"rgba(239,68,68,0.35)":"rgba(239,68,68,0.2)"}`, padding:"18px 20px"}}>
                {/* Header */}
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
                  <div>
                    <p style={sectionLabel}>💳 Outstanding Payments</p>
                    <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                      <p style={{color:"#ef4444",fontWeight:900,fontSize:26,lineHeight:1,letterSpacing:"-0.02em"}}>{inr(totalDueAmt)}</p>
                      <p style={{color:t.sub,fontSize:12}}>from {allDue.length} customer{allDue.length!==1?"s":""}</p>
                    </div>
                  </div>
                  {isAdmin&&<button onClick={()=>setTab("Payments")}
                    style={{background:"#ef444412",color:"#ef4444",border:"1px solid #ef444430",borderRadius:12,padding:"7px 14px",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0}}>
                    Full Ledger →
                  </button>}
                </div>

                {/* Collection rate bar */}
                <div style={{marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:t.sub,marginBottom:5}}>
                    <span style={{fontWeight:600}}>Collection Rate</span>
                    <span style={{fontWeight:800,color:collPct>=90?"#10b981":collPct>=70?"#f59e0b":"#ef4444"}}>{collPct}%</span>
                  </div>
                  <div style={{height:7,borderRadius:8,overflow:"hidden",background:t.border}}>
                    <div style={{width:`${collPct}%`,background:collPct>=90?"#10b981":collPct>=70?"#f59e0b":"#ef4444",transition:"width 0.7s",height:"100%",borderRadius:8}}/>
                  </div>
                </div>

                {/* Debtor rows */}
                <div style={{display:"flex",flexDirection:"column",gap:0}}>
                  {[...allDue].sort((a,b)=>b.pending-a.pending).slice(0,5).map((c,i,arr)=>{
                    const billed=(c.paid||0)+(c.pending||0);
                    const pct=billed>0?Math.round((c.paid||0)/billed*100):0;
                    const isLast = i >= Math.min(allDue.length,5)-1;
                    return <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:!isLast?`1px solid ${t.border}`:"none"}}>
                      {/* Rank badge */}
                      <div style={{width:26,height:26,borderRadius:8,background:i===0?"#ef444418":t.inp,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <span style={{color:i===0?"#ef4444":t.sub,fontWeight:800,fontSize:12}}>{i+1}</span>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                          <p style={{color:t.text,fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{c.name}</p>
                          <p style={{color:"#ef4444",fontWeight:800,fontSize:13,flexShrink:0,marginLeft:10}}>{inr(c.pending)}</p>
                        </div>
                        <div style={{height:4,borderRadius:4,overflow:"hidden",background:t.border}}>
                          <div style={{width:`${pct}%`,background:"#10b981",height:"100%",transition:"width 0.5s"}}/>
                        </div>
                      </div>
                      {can("cust_markPaid")&&<button
                        onClick={()=>{if(isAdmin){setPayLedgerCust(c);setPayLedgerAmt(String(c.pending||""));setPayLedgerNote("");setPayLedgerMethod("Cash");setPayLedgerSh(true);}else{setPaySh(c);setPayAmt("");}}}
                        style={{background:"#f59e0b",color:"#000",border:"none",borderRadius:10,padding:"7px 13px",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0}}>
                        Collect
                      </button>}
                    </div>;
                  })}
                </div>
                {allDue.length>5&&<p style={{color:t.sub,fontSize:11,textAlign:"center",paddingTop:8,fontWeight:600}}>+{allDue.length-5} more customers with outstanding dues</p>}
              </div>;
            })()}

            {/* ── TODAY'S DELIVERY LIST (pending/transit) ── */}
            {(todayPend.length>0||todayTransit.length>0)&&<div style={card({overflow:"hidden"})}>
              <div style={{padding:"14px 20px 12px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <p style={sectionLabel}>🚚 Needs Action Today</p>
                  <p style={{color:t.text,fontWeight:700,fontSize:15}}>
                    {todayPend.length+todayTransit.length} order{todayPend.length+todayTransit.length!==1?"s":""} pending
                  </p>
                </div>
                <button onClick={()=>setTab("Deliveries")}
                  style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:10,padding:"6px 13px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                  All →
                </button>
              </div>
              {[...todayTransit,...todayPend].slice(0,8).map((d,i,arr)=>{
                const tot=lineTotal(d.orderLines);
                const items=Object.values(safeO(d.orderLines)).filter(l=>l.qty>0);
                const isTransit=d.status==="In Transit";
                return <div key={d.id} style={{
                  padding:"12px 20px",
                  borderBottom:i<arr.length-1?`1px solid ${t.border}`:"none",
                  display:"flex",alignItems:"center",gap:12,
                  background:isTransit?(dm?"rgba(59,130,246,0.04)":"rgba(59,130,246,0.02)"):"transparent"
                }}>
                  <div style={{width:38,height:38,borderRadius:12,background:isTransit?"#3b82f615":"#f59e0b15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                    {isTransit?"🚚":"⏳"}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                      <p style={{color:t.text,fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.customer}</p>
                      {isTransit&&<span style={{background:"#3b82f615",color:"#3b82f6",borderRadius:5,padding:"1px 6px",fontSize:9,fontWeight:700,flexShrink:0}}>EN ROUTE</span>}
                    </div>
                    <p style={{color:t.sub,fontSize:11}}>
                      {items.slice(0,2).map(l=>`${l.qty}×${l.name||""}`).join(", ")}{items.length>2?` +${items.length-2} more`:""}
                      {canSeePrices&&tot>0?<span style={{color:t.text,fontWeight:600}}> · {inr(tot)}</span>:""}
                    </p>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    {d.address&&<a href={mapU(d.address,d.lat,d.lng)} target="_blank" rel="noopener noreferrer"
                      style={{background:"#0ea5e912",color:"#0ea5e9",borderRadius:9,padding:"7px 11px",fontSize:13,fontWeight:700,textDecoration:"none",lineHeight:1}}>📍</a>}
                    {can("deliv_markDone")&&<button onClick={()=>tglD(d)}
                      style={{background:"#10b981",color:"#fff",border:"none",borderRadius:10,padding:"7px 13px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✓ Done</button>}
                  </div>
                </div>;
              })}
              {todayPend.length+todayTransit.length>8&&<div style={{padding:"10px 20px",textAlign:"center",borderTop:`1px solid ${t.border}`,background:t.inp}}>
                <button onClick={()=>setTab("Deliveries")} style={{color:t.accent,background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:700}}>
                  +{todayPend.length+todayTransit.length-8} more — view all →
                </button>
              </div>}
            </div>}

            {/* ── PRODUCTION STATUS ── */}
            {(isAdmin||isFactory)&&(()=>{
              if(todayPT.length===0) return null;
              const byProduct = products.map(p=>{
                const pts=todayPT.filter(x=>x.product===p.name||x.product===p.id);
                const act=pts.reduce((s,x)=>s+(x.actual||0),0);
                const tgt=pts.reduce((s,x)=>s+(x.target||0),0);
                return {name:p.name,actual:act,target:tgt,pct:tgt>0?Math.round(act/tgt*100):null};
              }).filter(x=>x.actual>0||x.target>0);
              const prodColor = prodPct===null?"#6366f1":prodPct>=100?"#10b981":prodPct>=70?"#f59e0b":"#ef4444";
              return <div style={card({padding:"18px 20px"})}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                  <div>
                    <p style={sectionLabel}>🏭 Today's Production</p>
                    <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                      <p style={{color:t.text,fontWeight:900,fontSize:26,lineHeight:1,letterSpacing:"-0.02em"}}>{totalActual.toLocaleString("en-IN")}</p>
                      {totalTarget>0&&<p style={{color:t.sub,fontSize:13}}>/ {totalTarget.toLocaleString("en-IN")} target</p>}
                    </div>
                  </div>
                  {prodPct!==null&&(
                    <div style={{textAlign:"center"}}>
                      <div style={{width:56,height:56,borderRadius:"50%",background:`${prodColor}18`,border:`3px solid ${prodColor}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <p style={{color:prodColor,fontWeight:900,fontSize:14,lineHeight:1}}>{prodPct}%</p>
                      </div>
                      <p style={{color:t.sub,fontSize:9,fontWeight:700,marginTop:4,textTransform:"uppercase"}}>Efficiency</p>
                    </div>
                  )}
                </div>

                {totalTarget>0&&<div style={{height:8,borderRadius:8,overflow:"hidden",background:t.border,marginBottom:14}}>
                  <div style={{width:`${Math.min(prodPct||0,100)}%`,background:prodColor,transition:"width 0.8s ease",height:"100%",borderRadius:8}}/>
                </div>}

                {byProduct.length>0&&<div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:4}}>
                  {byProduct.map(p=>(
                    <div key={p.name} style={{display:"flex",alignItems:"center",gap:10}}>
                      <p style={{color:t.sub,fontSize:12,minWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</p>
                      <div style={{flex:1,height:6,borderRadius:6,overflow:"hidden",background:t.border}}>
                        <div style={{width:`${Math.min(p.pct||0,100)}%`,background:"#6366f1",height:"100%",transition:"width 0.5s"}}/>
                      </div>
                      <p style={{color:t.text,fontSize:12,fontWeight:700,minWidth:56,textAlign:"right"}}>
                        {p.actual}{p.target>0&&<span style={{color:t.sub,fontWeight:400}}>/{p.target}</span>}
                      </p>
                    </div>
                  ))}
                </div>}

                {todayWastage.length>0&&<div style={{marginTop:10,padding:"9px 14px",background:"#f9731610",border:"1px solid #f9731630",borderRadius:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <p style={{color:"#f97316",fontSize:12,fontWeight:700}}>🗑 Wastage today: {todayWastage.length} record{todayWastage.length!==1?"s":""}</p>
                  {can("waste_seeCost")&&todayWasteCost>0&&<p style={{color:"#ef4444",fontSize:12,fontWeight:800}}>{inr(todayWasteCost)}</p>}
                </div>}

                <button onClick={()=>setTab("Production")}
                  style={{marginTop:12,width:"100%",background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:12,padding:"9px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                  View Production Log →
                </button>
              </div>;
            })()}

            {/* ── OVERDUE DELIVERIES ── */}
            {isAdmin&&overdueD.length>0&&<div style={{...card(),border:`1.5px solid rgba(239,68,68,0.3)`,background:dm?"rgba(239,68,68,0.04)":"#fff8f8",padding:"16px 20px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <div>
                  <p style={{...sectionLabel,color:"#ef4444"}}>🔴 Overdue Deliveries</p>
                  <p style={{color:t.text,fontWeight:700,fontSize:15}}>{overdueD.length} order{overdueD.length!==1?"s":""} past due</p>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {overdueD.slice(0,4).map(d=>{
                  const cust=customers.find(c=>c.id===d.customerId);
                  const daysAgo=Math.round((new Date()-new Date(d.date))/86400000);
                  return <div key={d.id} style={{background:dm?"rgba(239,68,68,0.07)":"rgba(239,68,68,0.05)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:14,padding:"11px 14px",display:"flex",alignItems:"center",gap:10}}>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{color:t.text,fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.customer}</p>
                      <p style={{color:"#ef4444",fontSize:11,fontWeight:600,marginTop:2}}>{daysAgo} day{daysAgo!==1?"s":""} overdue · {d.date}</p>
                    </div>
                    <div style={{display:"flex",gap:6,flexShrink:0}}>
                      {cust?.phone&&<a href={`tel:${cust.phone}`} style={{background:"#10b98115",color:"#10b981",borderRadius:9,padding:"6px 11px",fontSize:12,fontWeight:700,textDecoration:"none"}}>📞</a>}
                      {can("deliv_markDone")&&<button onClick={()=>{setDeliv(p=>safeArr(p).map(x=>x.id===d.id?{...x,status:"Delivered",deliveryDate:today()}:x));addLog("Marked overdue delivered",d.customer);notify(`${d.customer} ✓`);captureGPS("marked_delivered",d.customer);}}
                        style={{background:"#10b98120",color:"#10b981",border:"none",borderRadius:9,padding:"6px 11px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✓ Done</button>}
                    </div>
                  </div>;
                })}
                {overdueD.length>4&&<div style={{textAlign:"center",paddingTop:2}}>
                  <button onClick={()=>setTab("Deliveries")} style={{color:"#f59e0b",background:"none",border:"none",cursor:"pointer",fontWeight:700,fontSize:11}}>
                    +{overdueD.length-4} more →
                  </button>
                </div>}
              </div>
            </div>}

            {/* ── WEATHER ── */}
            {widgets.includes("weather")&&<WeatherWidget dm={dm} lat={settings?.weatherLat||15.4909} lng={settings?.weatherLng||73.8278} locLabel={settings?.weatherLabel||"Goa"}/>}

            {/* ── TODAY'S WASTAGE (standalone) ── */}
            {widgets.includes("wastageToday")&&can("dash_seeWastage")&&todayWastage.length>0&&!(isAdmin||isFactory)&&<div style={card({padding:"14px 18px"})}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <p style={{color:t.text,fontWeight:700,fontSize:13}}>🗑 Today's Wastage</p>
                <span style={{color:"#f97316",fontWeight:800,fontSize:13}}>{todayWastage.reduce((s,w)=>s+(w.qty||0),0)} units</span>
              </div>
              {todayWastage.slice(0,3).map((w,i)=>(
                <div key={w.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderTop:i>0?`1px solid ${t.border}`:"none"}}>
                  <div><p style={{color:t.text,fontSize:12,fontWeight:600}}>{w.product}</p><p style={{color:t.sub,fontSize:11}}>{w.type} · {w.shift}</p></div>
                  <p style={{color:t.text,fontWeight:700,fontSize:12}}>{w.qty} {w.unit}</p>
                </div>
              ))}
            </div>}

            {/* ── QUICK ACTIONS ── */}
            {widgets.includes("quickActions")&&(settings?.quickActions||[]).length>0&&<div>
              <p style={{...sectionLabel,marginBottom:10}}>⚡ Quick Actions</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(180px,100%),1fr))",gap:8}} className="crm-quick-grid">
                {[
                  {key:"newDelivery",icon:"🚚",label:"New Delivery",action:()=>{setDsh("add");setDf(blkD());}},
                  {key:"newCustomer",icon:"👤",label:"New Customer",action:()=>{setCsh("add");setCf(blkC());}},
                  {key:"markDone",icon:"✅",label:"Mark Delivered",action:()=>setTab("Deliveries")},
                  {key:"logWastage",icon:"🗑️",label:"Log Wastage",action:()=>{setWSh("add");setWF(blkW());}},
                  {key:"addExpense",icon:"💸",label:"Add Expense",action:()=>{setEsh("add");setEf(blkE());}},
                  {key:"logSupply",icon:"📦",label:"Log Supply",action:()=>{setSsh("add");setSf(blkS());}},
                  {key:"logProduction",icon:"🏭",label:"Log Production",action:()=>setTab("Production")},
                  {key:"qcCheck",icon:"🔬",label:"QC Check",action:()=>setTab("Production")},
                ].filter(q=>(settings?.quickActions||[]).includes(q.key)).map(q=>(
                  <button key={q.key} onClick={q.action}
                    style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"14px 8px",display:"flex",flexDirection:"column",alignItems:"center",gap:7,cursor:"pointer",transition:"all 0.15s"}}
                    className="crm-quick-action">
                    <span style={{fontSize:24}}>{q.icon}</span>
                    <span style={{color:t.text,fontSize:10,fontWeight:700,textAlign:"center",lineHeight:1.3}}>{q.label}</span>
                  </button>
                ))}
              </div>
            </div>}

            {/* ── NOTICE BOARD ── */}
            {(()=>{
              const unreadNotices=(notices||[]).filter(n=>!(n.readBy||[]).includes(sess.id));
              function saveNotice(){
                if(!nbF.title.trim()||!nbF.body.trim()){notify("Title and message required");return;}
                const rec={...nbF,id:uid(),postedBy:sess.name,postedAt:ts(),readBy:[]};
                setNotices(p=>[rec,...p]);
                addLog("Notice posted",rec.title);
                addNotif("📌 Notice: "+rec.title,rec.body,"info","noticeboard");
                notify("Notice posted ✓");
                setNbSh(false);
                setNbF({title:"",body:"",pinned:false});
              }
              function markRead(id){setNotices(p=>safeArr(p).map(n=>n.id===id?{...n,readBy:[...(n.readBy||[]),sess.id]}:n));}
              return (<>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <p style={{color:t.text,fontWeight:700,fontSize:13}}>📌 Notice Board</p>
                    {unreadNotices.length>0&&<Pill dm={dm} c="sky">{unreadNotices.length} new</Pill>}
                  </div>
                  {can("dash_postNotice")&&<Btn dm={dm} size="sm" onClick={()=>{setNbF({title:"",body:"",pinned:false});setNbSh(true);}}>+ Post</Btn>}
                </div>
                {(notices||[]).length===0&&<div style={{background:t.inp,borderRadius:14,padding:"20px",textAlign:"center"}}><p style={{color:t.sub}} className="text-sm">No notices posted yet.</p></div>}
                {[...(notices||[])].sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)).map(n=>{
                  const isRead=(n.readBy||[]).includes(sess.id);
                  return <div key={n.id} style={{background:n.pinned?(dm?"rgba(245,158,11,0.08)":"rgba(245,158,11,0.06)"):t.card,border:`1.5px solid ${n.pinned?"rgba(245,158,11,0.3)":isRead?t.border:"rgba(14,165,233,0.3)"}`,borderRadius:16,padding:"14px 16px",marginBottom:8}}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:6,gap:8}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap"}}>
                          {n.pinned&&<span style={{background:"#f59e0b20",color:"#f59e0b",borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:700}}>📌 Pinned</span>}
                          {!isRead&&<span style={{background:"#0ea5e920",color:"#0ea5e9",borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:700}}>New</span>}
                          <p style={{color:t.text,fontWeight:700,fontSize:13}}>{n.title}</p>
                        </div>
                        <p style={{color:t.sub,fontSize:11}}>by {n.postedBy} · {n.postedAt}</p>
                      </div>
                      <div style={{display:"flex",gap:6,flexShrink:0}}>
                        {!isRead&&<button onClick={()=>markRead(n.id)} style={{background:"#0ea5e920",color:"#0ea5e9",border:"none",borderRadius:8,padding:"4px 9px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Mark read</button>}
                        {can("dash_delNotice")&&<button onClick={()=>setNotices(p=>safeArr(p).filter(x=>x.id!==n.id))} style={{background:t.inp,color:t.sub,border:"none",borderRadius:8,padding:"4px 9px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Delete</button>}
                      </div>
                    </div>
                    <p style={{color:t.text,lineHeight:1.6,fontSize:13}}>{n.body}</p>
                  </div>;
                })}
                <Sheet dm={dm} open={nbSh} onClose={()=>setNbSh(false)} title="Post Notice">
                  <Inp dm={dm} label="Title *" value={nbF.title} onChange={e=>setNbF({...nbF,title:e.target.value})} placeholder="e.g. Holiday schedule update"/>
                  <div>
                    <label style={{color:T(dm).sub}} className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 ml-0.5">Message *</label>
                    <textarea value={nbF.body} onChange={e=>setNbF({...nbF,body:e.target.value})} placeholder="Write your announcement here…" rows={5}
                      style={{width:"100%",background:T(dm).inp,border:`1.5px solid ${T(dm).inpB}`,color:T(dm).text,borderRadius:14,padding:"10px 14px",fontSize:13,outline:"none",resize:"vertical",fontFamily:"system-ui"}}/>
                  </div>
                  <div style={{background:T(dm).inp,borderRadius:14,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div>
                      <p style={{color:T(dm).text,fontSize:14,fontWeight:600}}>Pin this notice</p>
                      <p style={{color:T(dm).sub,fontSize:11}}>Pinned notices appear at the top</p>
                    </div>
                    <Tog dm={dm} on={nbF.pinned} onChange={()=>setNbF(f=>({...f,pinned:!f.pinned}))}/>
                  </div>
                  <Btn dm={dm} onClick={saveNotice} className="w-full">Post Notice</Btn>
                </Sheet>
              </>);
            })()}
            </>;
          })()}
        </>)}

        {/* CUSTOMERS */}
