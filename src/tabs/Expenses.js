/* eslint-disable */
// TAB: Expenses
// This file contains the Expenses tab JSX, extracted from App.js

        {tab==="Expenses"&&isAdmin&&(()=>{

          // ── derived data (unchanged from original) ──
          const expCats = (settings?.expenseCategories || ["Gas","Labour","Transport","Packaging","Utilities","Maintenance","Other"]);
          const expBudgets = settings?.expenseBudgets || {};
          const expAlerts = settings?.expenseAlerts || { budgetWarnPct:80, showDailyAvg:true, showTopVendor:true };
          const totalWC = (wastage||[]).reduce((s,w) => s+(w.cost||0), 0);
          const totalReplDed = deliveries.reduce((s,d) => s+(+d.replacement?.amount||0), 0);
          const totalCost = totalExpOp + totalSupC + totalWC;
          const isProfitable = netProfit >= 0;
          const expRatio = totalRev > 0 ? Math.round(totalExpOp/totalRev*100) : 0;
          const avgExpPerDay = expenses.length > 0
            ? (totalExpOp / Math.max(1, new Set(expenses.map(e=>e.date)).size))
            : 0;

          // ── date range filter ──
          const getExpDateRange = () => {
            const t2 = today();
            if (expDateFilter==="today") return { from:t2, to:t2 };
            if (expDateFilter==="week") { const d=new Date(); d.setDate(d.getDate()-6); return { from:d.toISOString().slice(0,10), to:t2 }; }
            if (expDateFilter==="month") return { from:t2.slice(0,7)+"-01", to:t2 };
            if (expDateFilter==="custom") return { from:expCustomFrom||"2000-01-01", to:expCustomTo||t2 };
            return { from:"2000-01-01", to:t2 };
          };
          const { from:eFr, to:eTo } = getExpDateRange();

          // ── filtered expenses ──
          const filteredExp = expenses.filter(e => {
            const inDate = e.date>=eFr && e.date<=eTo;
            const inCat = expCatFilter==="all" || e.category===expCatFilter;
            const q = expSearch.toLowerCase();
            const inSearch = !q
              || (e.category||"").toLowerCase().includes(q)
              || (e.notes||"").toLowerCase().includes(q)
              || (e.vendor||"").toLowerCase().includes(q)
              || (e.tags||"").toLowerCase().includes(q)
              || (e.approvedBy||"").toLowerCase().includes(q);
            return inDate && inCat && inSearch;
          }).sort((a,b) => (b.date||"").localeCompare(a.date||""));
          const filtExpTotal = filteredExp.reduce((s,e) => s+(e.amount||0), 0);

          // ── category breakdown ──
          const PALETTE = ["#ef4444","#f97316","#f59e0b","#10b981","#0ea5e9","#8b5cf6","#ec4899"];
          const catBreakdown = expCats.map((cat,ci) => ({
            cat,
            color: PALETTE[ci%7],
            total: filteredExp.filter(e=>e.category===cat).reduce((s,e)=>s+(e.amount||0),0),
            count: filteredExp.filter(e=>e.category===cat).length,
            budget: expBudgets[cat]||0,
          })).filter(x => x.total>0).sort((a,b) => b.total-a.total);
          const maxCatVal = catBreakdown[0]?.total || 1;

          // ── vendor breakdown ──
          const vendorMap = {};
          filteredExp.forEach(e => { if(e.vendor){ vendorMap[e.vendor]=(vendorMap[e.vendor]||0)+(e.amount||0); }});
          const vendorBreakdown = Object.entries(vendorMap).sort((a,b)=>b[1]-a[1]).slice(0,5);

          // ── payment method breakdown ──
          const pmMap = {};
          filteredExp.forEach(e => { const pm=e.paymentMethod||"Cash"; pmMap[pm]=(pmMap[pm]||0)+(e.amount||0); });
          const topPM = Object.entries(pmMap).sort((a,b)=>b[1]-a[1])[0];

          // ── monthly trend (last 6 months) ──
          const monthlyMap = {};
          expenses.forEach(e => { const m=e.date?.slice(0,7); if(m) monthlyMap[m]=(monthlyMap[m]||0)+(e.amount||0); });
          const monthlyTrend = Object.entries(monthlyMap).sort((a,b)=>a[0].localeCompare(b[0])).slice(-6);
          const maxMonthly = Math.max(...monthlyTrend.map(([,v])=>v), 1);

          // ── all filtered entries (show all, not just 8) ──
          const recentExp = filteredExp;

          // ── budget alerts ──
          const budgetAlerts = Object.entries(expBudgets).filter(([cat,budget]) => {
            const spent = expenses.filter(e=>e.category===cat&&e.date?.startsWith(today().slice(0,7))).reduce((s,e)=>s+(e.amount||0),0);
            return budget>0 && spent/budget>=(expAlerts.budgetWarnPct||80)/100;
          }).map(([cat,budget]) => {
            const spent = expenses.filter(e=>e.category===cat&&e.date?.startsWith(today().slice(0,7))).reduce((s,e)=>s+(e.amount||0),0);
            return { cat, budget, spent, over: spent>budget, pct: Math.round(spent/budget*100) };
          });

          // ── revenue allocation percentages ──
          const pctSupply  = totalRev>0 ? Math.round(totalSupC/totalRev*100) : 0;
          const pctExp     = totalRev>0 ? Math.round(totalExpOp/totalRev*100) : 0;
          const pctWaste   = totalRev>0 ? Math.round(totalWC/totalRev*100) : 0;
          const pctProfit  = totalRev>0 ? Math.max(0, Math.round(netProfit/totalRev*100)) : 0;

          // ── filter label ──
          const filterLabel = expDateFilter==="all" ? "All time"
            : expDateFilter==="today" ? "Today"
            : expDateFilter==="week"  ? "Last 7 days"
            : expDateFilter==="month" ? "This month"
            : (expCustomFrom&&expCustomTo) ? `${expCustomFrom} → ${expCustomTo}`
            : "Custom range (pick dates below)";

          return (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>

              {/* ── EXPENSES TAB HEADER ── */}
              <SectionHeader dm={dm} title="Expenses" sub={`${filterLabel} · ${filteredExp.length} entries`}
                cta={<button onClick={()=>{setEsh("add");setEf(blkE());}}
                    style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:12,padding:"11px 20px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:7,boxShadow:"0 2px 8px rgba(37,99,235,0.3)"}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Expense
                  </button>}/>
              {/* ── DATE FILTER PILLS ── */}
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {[["all","All time"],["month","Month"],["week","7 days"],["today","Today"],["custom","Custom"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setExpDateFilter(v)}
                    style={{border:`1.5px solid ${expDateFilter===v?"#2563eb":t.border}`,borderRadius:99,padding:"6px 16px",fontSize:12,fontWeight:700,cursor:"pointer",background:expDateFilter===v?"#2563eb":t.inp,color:expDateFilter===v?"#fff":t.sub,transition:"all .15s",whiteSpace:"nowrap"}}>
                    {l}
                  </button>
                ))}
              </div>
              <TabStatCards dm={dm} cards={[
                {icon:"💸",label:"Total Expenses",value:inr(totalExpOp),sub:`${expenses.length} entries`,iconBg:t.statIcon5},
                {icon:"📅",label:"This Period",value:inr(filtExpTotal),sub:filterLabel,iconBg:t.statIcon3},
                {icon:"📊",label:"Exp/Revenue",value:`${expRatio}%`,sub:"of total revenue",iconBg:t.statIcon4},
                {icon:"📉",label:"Avg/Day",value:inr(Math.round(avgExpPerDay)),sub:"daily average",iconBg:t.statIcon1},
              ]}/>

              {/* Custom date range pickers — only shown when "custom" is active */}
              {expDateFilter==="custom"&&(
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",background:t.card,border:`1px solid ${t.border}`,borderRadius:12,padding:"10px 14px"}}>
                  <span style={{color:t.sub,fontSize:12,fontWeight:700}}>From</span>
                  <input type="date" value={expCustomFrom} onChange={e=>setExpCustomFrom(e.target.value)}
                    style={{background:t.inp,border:`1px solid ${t.border}`,borderRadius:8,padding:"5px 10px",fontSize:12,color:t.text,outline:"none",cursor:"pointer"}}/>
                  <span style={{color:t.sub,fontSize:12,fontWeight:600}}>→ To</span>
                  <input type="date" value={expCustomTo} onChange={e=>setExpCustomTo(e.target.value)}
                    style={{background:t.inp,border:`1px solid ${t.border}`,borderRadius:8,padding:"5px 10px",fontSize:12,color:t.text,outline:"none",cursor:"pointer"}}/>
                  {expCustomFrom&&expCustomTo&&(
                      <span style={{color:"#ef4444",fontSize:11,fontWeight:700,background:"rgba(239,68,68,0.12)",padding:"3px 10px",borderRadius:20,border:"1px solid rgba(239,68,68,0.3)"}}>
                        {filteredExp.length} entries · {inr(filtExpTotal)}
                      </span>
                    )}
                  </div>
                )}
              

              {/* ── BUDGET ALERTS ── */}
              {budgetAlerts.map(({cat,budget,spent,over,pct})=>(
                <div key={cat} style={{background:over?(dm?"rgba(220,38,38,0.12)":"#fff1f2"):(dm?"rgba(245,158,11,0.12)":"#fffbeb"),border:`1px solid ${over?"#ef4444":"#f59e0b"}`,borderRadius:14,padding:"11px 16px"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:6}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:16}}>{over?"🚨":"⚠️"}</span>
                      <div>
                        <p style={{color:over?"#dc2626":"#d97706",fontWeight:700,fontSize:13}}>
                          {over ? `${cat} budget exceeded!` : `${cat} budget at ${pct}%`}
                        </p>
                        <p style={{color:over?"#dc2626":"#d97706",fontSize:11,opacity:0.8}}>
                          {inr(spent)} spent of {inr(budget)} this month
                        </p>
                      </div>
                    </div>
                    <span style={{background:over?"#ef444420":"#f59e0b20",color:over?"#dc2626":"#d97706",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,border:`1px solid ${over?"#ef444440":"#f59e0b40"}`,whiteSpace:"nowrap"}}>
                      {over?"Over budget":`${pct}%`}
                    </span>
                  </div>
                  <div style={{height:7,borderRadius:7,background:over?"rgba(220,38,38,0.15)":"rgba(245,158,11,0.15)",overflow:"hidden"}}>
                    <div style={{width:`${Math.min(100,pct)}%`,height:"100%",background:over?"#ef4444":"#f59e0b",borderRadius:7,transition:"width .5s"}}/>
                  </div>
                </div>
              ))}

              {/* ── 4 KPI CARDS ── */}
              <div className="crm-grid-4" style={{gap:12}}>
                {[
                  {label:"Op. Expenses",value:inr(totalExpOp),sub:`${expenses.length} entries · ${expRatio}% of rev`,color:"#ef4444",icon:"💸",badge:expRatio>40?"High":"OK",badgeOk:expRatio<=40},
                  {label:"Supply Costs", value:inr(totalSupC), sub:`${pctSupply}% of revenue`,color:"#8b5cf6",icon:"📦",badge:`${supplies.length} entries`,badgeOk:true},
                  {label:"Revenue",      value:inr(totalRev),  sub:`${deliveries.filter(d=>d.status==="Delivered").length} delivered`,color:"#10b981",icon:"💰",badge:`Avg ${inr(Math.round(avgExpPerDay))}/day`,badgeOk:true},
                  {label:"Net Profit",   value:inr(netProfit), sub:isProfitable?"Profitable ✓":"In loss ⚠️",color:isProfitable?"#10b981":"#ef4444",icon:isProfitable?"📈":"📉",badge:`${totalRev>0?Math.round(netProfit/totalRev*100):0}% margin`,badgeOk:isProfitable},
                ].map(k=>(
                  <div key={k.label} style={{background:t.inp,border:`1px solid ${t.border}`,borderRadius:16,padding:"14px 16px"}}>
                    <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>{k.icon} {k.label}</p>
                    <p style={{color:k.color,fontSize:22,fontWeight:900,lineHeight:1,letterSpacing:"-0.02em"}}>{k.value}</p>
                    <p style={{color:t.sub,fontSize:11,marginTop:5}}>{k.sub}</p>
                    <div style={{marginTop:8,height:3,borderRadius:3,background:k.color+"22",overflow:"hidden"}}>
                      <div style={{width:`${k.label==="Op. Expenses"?Math.min(100,expRatio*2):k.label==="Supply Costs"?Math.min(100,pctSupply):k.label==="Net Profit"?Math.max(0,Math.min(100,pctProfit)):60}%`,height:"100%",background:k.color,borderRadius:3}}/>
                    </div>
                    <p style={{color:k.badgeOk?"#10b981":"#f59e0b",fontSize:10,fontWeight:700,marginTop:4}}>{k.badge}</p>
                  </div>
                ))}
              </div>

              {/* ── REVENUE ALLOCATION BAR ── */}
              {totalRev>0&&(
                <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:"12px 16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                    <span style={{color:t.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>Where does revenue go?</span>
                    <span style={{color:t.sub,fontSize:11}}>{inr(totalRev)}</span>
                  </div>
                  <div style={{height:10,borderRadius:10,overflow:"hidden",display:"flex",gap:2}}>
                    <div style={{width:`${pctProfit}%`,background:"#10b981",transition:"width .6s"}} title={`Profit ${pctProfit}%`}/>
                    <div style={{width:`${pctSupply}%`,background:"#8b5cf6"}} title={`Supply ${pctSupply}%`}/>
                    <div style={{width:`${pctExp}%`,background:"#ef4444"}} title={`Expenses ${pctExp}%`}/>
                    <div style={{width:`${pctWaste}%`,background:"#f97316"}} title={`Waste ${pctWaste}%`}/>
                  </div>
                  <div style={{display:"flex",gap:16,marginTop:8,flexWrap:"wrap"}}>
                    {[["#10b981","Profit",pctProfit],["#8b5cf6","Supply",pctSupply],["#ef4444","Expenses",pctExp],["#f97316","Waste",pctWaste]].map(([c,l,p])=>(
                      <span key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:t.sub}}>
                        <span style={{width:8,height:8,borderRadius:2,background:c,display:"inline-block"}}/>
                        {l} <strong style={{color:c}}>{p}%</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ── TWO-COL: CATEGORIES + INSIGHTS ── */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:14}}>

                {/* Category breakdown */}
                <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"14px 16px"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                    <p style={{color:t.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>Spending by category</p>
                    <span style={{color:t.sub,fontSize:11}}>{inr(filtExpTotal)}</span>
                  </div>
                  {catBreakdown.length===0
                    ? <p style={{color:t.sub,fontSize:12,textAlign:"center",padding:"20px 0"}}>No expenses in this period</p>
                    : catBreakdown.map(c=>(
                      <div key={c.cat} style={{marginBottom:10,cursor:"pointer"}}
                        onClick={()=>setDetailModal({type:"expensecat",data:{cat:c.cat,catExpenses:filteredExp.filter(e=>e.category===c.cat),catTotal:c.total}})}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                          <div style={{display:"flex",alignItems:"center",gap:7}}>
                            <span style={{width:8,height:8,borderRadius:2,background:c.color,flexShrink:0,display:"inline-block"}}/>
                            <span style={{color:t.text,fontSize:12,fontWeight:600}}>{c.cat}</span>
                            {c.budget>0&&<span style={{fontSize:10,color:t.sub}}>of {inr(c.budget)}</span>}
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{color:t.sub,fontSize:11}}>{c.count} entries</span>
                            <span style={{color:t.text,fontSize:12,fontWeight:700}}>{inr(c.total)}</span>
                          </div>
                        </div>
                        <div style={{height:6,borderRadius:6,background:t.inp,overflow:"hidden"}}>
                          <div style={{width:`${Math.round(c.total/maxCatVal*100)}%`,height:"100%",background:c.color,borderRadius:6,transition:"width .4s"}}/>
                        </div>
                      </div>
                    ))
                  }
                </div>

                {/* Quick insights */}
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  {[
                    {icon:"📊",label:"Daily avg",value:inr(Math.round(avgExpPerDay)),sub:"per active day",color:"#f59e0b",show:expAlerts.showDailyAvg!==false},
                    {icon:"🏆",label:"Top category",value:catBreakdown[0]?.cat||"—",sub:catBreakdown[0]?inr(catBreakdown[0].total)+"  ·  "+catBreakdown[0].count+" entries":"₹0",color:"#ef4444",show:true},
                    {icon:"💳",label:"Top payment",value:topPM?.[0]||"Cash",sub:topPM?inr(topPM[1]):"₹0",color:"#3b82f6",show:true},
                    {icon:"🏪",label:"Top vendor",value:vendorBreakdown[0]?vendorBreakdown[0][0]:"None",sub:vendorBreakdown[0]?inr(vendorBreakdown[0][1]):"₹0",color:"#8b5cf6",show:expAlerts.showTopVendor!==false},
                    {icon:expRatio>40?"⚠️":"✅",label:"Expense ratio",value:`${expRatio}%`,sub:expRatio>40?"Above 40% — review costs":"Looking healthy",color:expRatio>40?"#ef4444":"#10b981",show:true},
                  ].filter(x=>x.show).map((ins,i)=>(
                    <div key={i} style={{background:t.inp,border:`1px solid ${t.border}`,borderRadius:14,padding:"11px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",flex:1}}>
                      <div>
                        <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:3}}>{ins.icon} {ins.label}</p>
                        <p style={{color:ins.color,fontSize:15,fontWeight:900,lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160}}>{ins.value}</p>
                        <p style={{color:t.sub,fontSize:11,marginTop:2}}>{ins.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── MONTHLY TREND (simple bar chart) ── */}
              {monthlyTrend.length>1&&(
                <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"14px 18px"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                    <p style={{color:t.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>Monthly trend · last {monthlyTrend.length} months</p>
                    <span style={{background:expRatio>40?"rgba(239,68,68,0.12)":"rgba(16,185,129,0.12)",color:expRatio>40?"#ef4444":"#10b981",fontSize:11,fontWeight:700,borderRadius:20,padding:"3px 10px",border:`1px solid ${expRatio>40?"rgba(239,68,68,0.3)":"rgba(16,185,129,0.3)"}`}}>
                      {expRatio}% expense ratio
                    </span>
                  </div>
                  <div style={{display:"flex",alignItems:"flex-end",gap:8,height:100}}>
                    {monthlyTrend.map(([m,v],i)=>{
                      const isLast = i===monthlyTrend.length-1;
                      const barH = Math.round(v/maxMonthly*100);
                      const label = new Date(m+"-01").toLocaleString("en-IN",{month:"short"});
                      return(
                        <div key={m} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                          <span style={{color:isLast?"#ef4444":t.sub,fontSize:10,fontWeight:isLast?700:400}}>{inr(Math.round(v/1000))+"k"}</span>
                          <div style={{width:"100%",height:`${barH}%`,background:isLast?"#ef4444":t.border,borderRadius:"4px 4px 0 0",minHeight:4,transition:"height .4s"}}/>
                          <span style={{color:isLast?t.text:t.sub,fontSize:10,fontWeight:isLast?700:400}}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── ALL ENTRIES ── */}
              <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,overflow:"hidden"}}>
                {/* Header */}
                <div style={{padding:"13px 16px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <p style={{color:t.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>
                    All entries
                  </p>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    {/* Category filter */}
                    <select value={expCatFilter} onChange={e=>setExpCatFilter(e.target.value)}
                      style={{background:t.inp,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 8px",fontSize:11,color:t.sub,outline:"none",cursor:"pointer"}}>
                      <option value="all">All categories</option>
                      {expCats.map(c=><option key={c}>{c}</option>)}
                    </select>
                    <span style={{color:t.sub,fontSize:11}}>{filteredExp.length} total</span>
                  </div>
                </div>

                {/* Entry rows — scrollable, shows ALL entries */}
                <div style={{maxHeight:480,overflowY:"auto"}}>
                {recentExp.length===0
                  ? <p style={{color:t.sub,fontSize:13,textAlign:"center",padding:"24px 0"}}>No expenses found</p>
                  : recentExp.map(e=>{
                      const catColor = PALETTE[expCats.indexOf(e.category)%7] || "#888";
                      return(
                        <div key={e.id}
                          onClick={()=>setDetailModal({type:"expense",data:e})}
                          style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:`1px solid ${t.border}`,cursor:"pointer",transition:"background .1s"}}
                          onMouseEnter={el=>el.currentTarget.style.background=dm?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.02)"}
                          onMouseLeave={el=>el.currentTarget.style.background="transparent"}>
                          <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0,flex:1}}>
                            <div style={{width:36,height:36,borderRadius:10,background:catColor+"22",border:`1px solid ${catColor}44`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                              <span style={{width:10,height:10,borderRadius:3,background:catColor,display:"inline-block"}}/>
                            </div>
                            <div style={{minWidth:0,flex:1}}>
                              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                                <p style={{color:t.text,fontWeight:700,fontSize:13}}>{e.category}</p>
                                {e.tags&&e.tags.split(",").filter(Boolean).map(tag=>(
                                  <span key={tag} style={{background:t.inp,color:t.sub,fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:8,border:`1px solid ${t.border}`}}>{tag.trim()}</span>
                                ))}
                              </div>
                              <p style={{color:t.sub,fontSize:11,marginTop:2}}>
                                {e.date}
                                {e.vendor&&<span> · 🏪 {e.vendor}</span>}
                                {e.approvedBy&&<span> · 👤 {e.approvedBy}</span>}
                                {e.notes&&<span style={{fontStyle:"italic"}}> · {e.notes.slice(0,40)}{e.notes.length>40?"…":""}</span>}
                              </p>
                              {e.receipt&&<p style={{color:t.sub,fontSize:10,marginTop:1}}>📎 {e.receipt.slice(0,40)}{e.receipt.length>40?"…":""}</p>}
                            </div>
                          </div>
                          <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
                            <p style={{color:t.text,fontWeight:800,fontSize:15}}>{inr(e.amount)}</p>
                            <span style={{fontSize:10,color:catColor,background:catColor+"15",padding:"2px 8px",borderRadius:10,fontWeight:700,border:`1px solid ${catColor}30`}}>
                              {e.paymentMethod||"Cash"}
                            </span>
                          </div>
                        </div>
                      );
                    })
                }
                </div>
                {/* Footer: entry count */}
                <div style={{padding:"10px 16px",borderTop:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <p style={{color:t.sub,fontSize:12}}>{filteredExp.length} {filteredExp.length===1?"entry":"entries"} · {inr(filtExpTotal)} total</p>
                </div>
              </div>

              {/* ── VENDOR BREAKDOWN (if any) ── */}
              {vendorBreakdown.length>0&&(
                <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"14px 16px"}}>
                  <p style={{color:t.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12}}>Top vendors</p>
                  {vendorBreakdown.map(([vendor,amt],i)=>(
                    <div key={vendor} style={{display:"flex",alignItems:"center",gap:10,marginBottom:i<vendorBreakdown.length-1?10:0}}>
                      <span style={{color:t.sub,fontSize:11,minWidth:14,textAlign:"right"}}>{i+1}</span>
                      <span style={{color:t.text,fontSize:12,flex:1,fontWeight:600}}>{vendor}</span>
                      <div style={{height:6,borderRadius:6,background:t.inp,overflow:"hidden",width:120}}>
                        <div style={{width:`${Math.round(amt/vendorBreakdown[0][1]*100)}%`,height:"100%",background:"#8b5cf6",borderRadius:6}}/>
                      </div>
                      <span style={{color:t.text,fontSize:12,fontWeight:700,minWidth:70,textAlign:"right"}}>{inr(amt)}</span>
                    </div>
                  ))}
                </div>
              )}

            </div>
          );
        })()}


        {/* WASTAGE */}
