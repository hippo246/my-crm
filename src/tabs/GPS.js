/* eslint-disable */
// TAB: GPS — Redesigned
// Matches reference: clean card layout, stat strips, styled sub-nav tabs

        {tab==="GPS"&&(()=>{
          const ACTION_META={
            session_start:    {label:"Session Start",    color:"#6366f1", icon:"🔓"},
            delivery_saved:   {label:"Delivery Saved",   color:"#f59e0b", icon:"💾"},
            marked_transit:   {label:"In Transit",       color:"#0ea5e9", icon:"🚚"},
            marked_delivered: {label:"Delivered",        color:"#10b981", icon:"✅"},
            wastage_logged:   {label:"Wastage Logged",   color:"#f97316", icon:"🗑️"},
            supply_logged:    {label:"Supply Logged",    color:"#8b5cf6", icon:"📦"},
            expense_logged:   {label:"Expense Logged",   color:"#ec4899", icon:"💸"},
            qc_logged:        {label:"QC Check",         color:"#14b8a6", icon:"🔬"},
            production_logged:{label:"Production Log",   color:"#6366f1", icon:"🏭"},
            handover_logged:  {label:"Shift Handover",   color:"#64748b", icon:"🔄"},
          };

          // ── helpers ──────────────────────────────────────────────
          const allLogs = gpsLogs||[];
          const agentUsers=[...new Set(allLogs.map(l=>l.agentId))].map(id=>{
            const l=allLogs.find(x=>x.agentId===id);
            return {id,name:l?.agentName||id};
          });
          const startOfToday=new Date(); startOfToday.setHours(0,0,0,0);
          const startOfYesterday=new Date(startOfToday); startOfYesterday.setDate(startOfYesterday.getDate()-1);
          const startOfWeek=new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate()-7);
          const startOfMonth=new Date(startOfToday); startOfMonth.setDate(1);
          function passesDate(l){
            if(gpsDateFilter==="all") return true;
            if(gpsDateFilter==="today") return l.ts>=startOfToday.getTime();
            if(gpsDateFilter==="yesterday") return l.ts>=startOfYesterday.getTime()&&l.ts<startOfToday.getTime();
            if(gpsDateFilter==="week") return l.ts>=startOfWeek.getTime();
            if(gpsDateFilter==="month") return l.ts>=startOfMonth.getTime();
            return true;
          }
          const filtered=allLogs
            .filter(l=>gpsFilter==="all"||l.agentId===gpsFilter)
            .filter(l=>gpsActionFilter==="all"||l.action===gpsActionFilter)
            .filter(passesDate);
          const logsWithGps=filtered.filter(l=>l.lat&&l.lng);

          const agentSummary=agentUsers.map(a=>{
            const aLogs=allLogs.filter(l=>l.agentId===a.id&&l.lat&&l.lng);
            const todayLogs=aLogs.filter(l=>l.ts>=startOfToday.getTime());
            const lastLog=aLogs[0];
            const lastTodayLog=todayLogs[0];
            const firstToday=todayLogs[todayLogs.length-1];
            const delivCount=aLogs.filter(l=>l.action==="marked_delivered").length;
            const transitCount=aLogs.filter(l=>l.action==="marked_transit").length;
            const sessionCount=aLogs.filter(l=>l.action==="session_start").length;
            const delivToday=todayLogs.filter(l=>l.action==="marked_delivered").length;
            const activeMins=firstToday&&lastTodayLog&&todayLogs.length>1?Math.round((lastTodayLog.ts-firstToday.ts)/60000):null;
            return {a,lastLog,firstToday,delivCount,transitCount,sessionCount,delivToday,activeMins,total:aLogs.length,todayTotal:todayLogs.length};
          });

          function getDailyBreakdown(){
            const map={};
            logsWithGps.forEach(l=>{
              const _d=new Date(l.ts);
              const isoKey=`${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,"0")}-${String(_d.getDate()).padStart(2,"0")}`;
              const displayDate=_d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric",timeZone:"Asia/Kolkata"});
              if(!map[isoKey]) map[isoKey]={date:displayDate,isoKey,ts:l.ts,entries:[],agents:new Set(),delivered:0,transit:0,sessions:0};
              map[isoKey].entries.push(l);
              map[isoKey].agents.add(l.agentName);
              if(l.action==="marked_delivered") map[isoKey].delivered++;
              if(l.action==="marked_transit") map[isoKey].transit++;
              if(l.action==="session_start") map[isoKey].sessions++;
            });
            return Object.values(map).sort((a,b)=>b.isoKey.localeCompare(a.isoKey));
          }

          function exportGpsCSV(){
            const rows=[["#","Agent","Role","Action","Detail / Customer","Date","Time","Latitude","Longitude","Accuracy (m)","Speed (km/h)","Heading (°)","Google Maps"]];
            logsWithGps.forEach((l,i)=>{
              const m=ACTION_META[l.action]||{label:l.action};
              const d=new Date(l.ts);
              rows.push([i+1,l.agentName,l.agentRole||"agent",m.label,l.customer||"—",
                d.toLocaleDateString("en-IN"),d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),
                l.lat,l.lng,l.acc,l.speed!=null?l.speed:"",l.heading!=null?l.heading:"",`https://maps.google.com/?q=${l.lat},${l.lng}`]);
            });
            const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
            const blob=new Blob([csv],{type:"text/csv"});
            const url=URL.createObjectURL(blob);
            const a=document.createElement("a"); a.href=url; a.download=`gps_trail_${today()}.csv`; a.click();
            URL.revokeObjectURL(url);
            notify("Exported ✓");
          }

          function printReport(){
            const dateLabel=gpsDateFilter==="today"?"Today":gpsDateFilter==="yesterday"?"Yesterday":gpsDateFilter==="week"?"Last 7 Days":gpsDateFilter==="month"?"This Month":"All Time";
            const agentLabel=gpsFilter==="all"?"All Agents":(agentUsers.find(a=>a.id===gpsFilter)?.name||"");
            const rows=logsWithGps.map((l,i)=>{
              const m=ACTION_META[l.action]||{label:l.action};
              const d=new Date(l.ts);
              return `<tr style="border-bottom:1px solid #e5e7eb">
                <td style="padding:6px 10px;font-size:12px;color:#6b7280">${i+1}</td>
                <td style="padding:6px 10px;font-size:12px;font-weight:600">${l.agentName}</td>
                <td style="padding:6px 10px;font-size:12px"><span style="background:${m.color}20;color:${m.color};padding:2px 8px;border-radius:5px;font-weight:700;font-size:11px">${m.icon} ${m.label}</span></td>
                <td style="padding:6px 10px;font-size:12px">${l.customer||"—"}</td>
                <td style="padding:6px 10px;font-size:12px">${d.toLocaleDateString("en-IN")}</td>
                <td style="padding:6px 10px;font-size:12px">${d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</td>
                <td style="padding:6px 10px;font-size:12px;color:#6b7280">${l.lat.toFixed(5)}, ${l.lng.toFixed(5)}</td>
                <td style="padding:6px 10px;font-size:12px;color:#6b7280">±${l.acc}m</td>
                <td style="padding:6px 10px;font-size:12px;color:#6b7280">${l.speed!=null?l.speed+" km/h":"—"}</td>
                <td style="padding:6px 10px;font-size:12px;color:#6b7280">${l.heading!=null?l.heading+"°":"—"}</td>
                <td style="padding:6px 10px;font-size:12px"><a href="https://maps.google.com/?q=${l.lat},${l.lng}" style="color:#0ea5e9;font-weight:600">View ↗</a></td>
              </tr>`;
            }).join("");
            const html=`<!DOCTYPE html><html><head><title>GPS Location Report — ${settings?.appName||"TAS"}</title>
            <style>body{font-family:system-ui,sans-serif;padding:32px;color:#111}h1{font-size:20px;font-weight:800;margin:0}h2{font-size:13px;color:#6b7280;font-weight:500;margin:4px 0 24px}table{width:100%;border-collapse:collapse}th{background:#f9fafb;padding:8px 10px;font-size:11px;font-weight:700;text-align:left;color:#374151;border-bottom:2px solid #e5e7eb}@media print{a{color:#0ea5e9}}</style>
            </head><body>
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
              <div><h1>📍 GPS Location Report</h1><h2>${settings?.appName||"TAS Healthy World"} · ${settings?.companySubtitle||""} · Exported on ${ts()}</h2></div>
              <div style="text-align:right;font-size:12px;color:#6b7280"><b>Period:</b> ${dateLabel}<br/><b>Agent:</b> ${agentLabel}<br/><b>Total entries:</b> ${logsWithGps.length}</div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
              ${[
                {l:"Total Pings",v:logsWithGps.length,c:"#6366f1"},
                {l:"Delivered",v:logsWithGps.filter(x=>x.action==="marked_delivered").length,c:"#10b981"},
                {l:"In Transit",v:logsWithGps.filter(x=>x.action==="marked_transit").length,c:"#0ea5e9"},
                {l:"Sessions",v:logsWithGps.filter(x=>x.action==="session_start").length,c:"#f59e0b"},
              ].map(s=>`<div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px 16px"><p style="color:${s.c};font-size:22px;font-weight:800;margin:0">${s.v}</p><p style="color:#6b7280;font-size:11px;margin:2px 0 0;font-weight:600">${s.l}</p></div>`).join("")}
            </div>
            <table><thead><tr><th>#</th><th>Agent</th><th>Action</th><th>Detail</th><th>Date</th><th>Time</th><th>Coordinates</th><th>Accuracy</th><th>Speed</th><th>Heading</th><th>Map</th></tr></thead>
            <tbody>${rows}</tbody></table>
            <p style="margin-top:24px;font-size:11px;color:#9ca3af">Confidential · ${settings?.companyName||"TAS Healthy World"} · This report was auto-generated from the Operations CRM</p>
            </body></html>`;
            const w=window.open("","_blank"); if(!w){notify("Popup blocked — please allow popups to print");return;} w.document.write(html); w.document.close(); w.print();
          }

          const GPS_SECTIONS=[
            {id:"overview", label:"Overview",     icon:"📊"},
            {id:"map",      label:"Live Map",      icon:"🗺"},
            {id:"timeline", label:"Audit Log",     icon:"📋"},
            {id:"report",   label:"Daily Report",  icon:"📄"},
          ];
          const gpsSection = gpsSubSection||"overview";

          // ── shared style helpers ──────────────────────────────────
          const card = {
            background: t.card,
            border: `1px solid ${t.border}`,
            borderRadius: 16,
            overflow: "hidden",
          };
          const selectStyle = {
            background: t.inp,
            color: t.text,
            border: `1px solid ${t.border}`,
            borderRadius: 10,
            padding: "9px 14px",
            fontSize: 13,
            outline: "none",
            minHeight: 40,
            WebkitAppearance: "none",
            appearance: "none",
            cursor: "pointer",
            width: "100%",
          };
          const btnOutline = {
            background: t.inp,
            color: t.text,
            border: `1px solid ${t.border}`,
            borderRadius: 9,
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap",
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
          };
          const btnPrimary = {
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 9,
            padding: "8px 16px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap",
            WebkitTapHighlightColor: "transparent",
            touchAction: "manipulation",
          };

          return <div style={{display:"flex",flexDirection:"column",gap:16}}>
            {/* ══ PAGE HEADER ══ */}
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:-4}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:36,height:36,borderRadius:10,background:"#6366f115",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>📡</div>
                <div>
                  <p style={{color:t.text,fontSize:17,fontWeight:800,lineHeight:1.2,margin:0}}>GPS &amp; Location</p>
                  <p style={{color:t.sub,fontSize:11,margin:0,marginTop:2}}>Real-time agent tracking · Full audit trail · GPS-verified delivery records</p>
                </div>
              </div>
              {isAdmin&&logsWithGps.length>0&&(
                <div style={{display:"flex",gap:8,flexShrink:0}}>
                  <button onClick={exportGpsCSV} style={btnOutline}>⬇ CSV</button>
                  <button onClick={printReport} style={btnPrimary}>🖨 Print</button>
                </div>
              )}
            </div>

            {/* ══ SUB-NAV TABS ══ */}
            {isAdmin&&(
              <div style={{display:"flex",gap:6,overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",paddingBottom:2}}>
                {GPS_SECTIONS.map(s=>{
                  const active=gpsSection===s.id;
                  return (
                    <button key={s.id} onClick={()=>setGpsSubSection(s.id)} style={{
                      background: active?"#2563eb":t.inp,
                      color: active?"#fff":t.sub,
                      border: `1px solid ${active?"#2563eb":t.border}`,
                      borderRadius: 9,
                      padding: "6px 14px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      transition: "all 0.15s",
                      WebkitTapHighlightColor: "transparent",
                      touchAction: "manipulation",
                    }}>
                      <span style={{fontSize:12}}>{s.icon}</span> {s.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════
                OVERVIEW
            ══════════════════════════════════════════════════════ */}
            {(gpsSection==="overview"||!isAdmin)&&<div style={{display:"flex",flexDirection:"column",gap:14}}>

              {/* KPI STRIP */}
              {isAdmin&&(
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}}>
                  {[
                    {label:"TOTAL GPS PINGS",  val:allLogs.filter(l=>l.lat&&l.lng).length, sub:"all time",      color:"#6366f1", icon:"📡", spark:"#6366f1"},
                    {label:"DELIVERIES CONFIRMED", val:allLogs.filter(l=>l.action==="marked_delivered").length, sub:"GPS-verified", color:"#10b981", icon:"✅", spark:"#10b981"},
                    {label:"ACTIVE TODAY",     val:allLogs.filter(l=>l.ts>=startOfToday.getTime()&&l.lat&&l.lng).length, sub:"pings today", color:"#f59e0b", icon:"🔥", spark:"#f59e0b"},
                    {label:"AGENTS TRACKED",   val:agentUsers.length, sub:"with GPS data",  color:"#0ea5e9", icon:"👥", spark:"#0ea5e9"},
                  ].map(k=>(
                    <div key={k.label} style={{...card,padding:"20px 22px",position:"relative",overflow:"hidden"}}>
                      <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:k.color,opacity:0.7,borderRadius:"16px 16px 0 0"}}/>
                      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:8}}>
                        <p style={{color:t.sub,fontSize:9,fontWeight:800,letterSpacing:"0.09em",textTransform:"uppercase",margin:0}}>{k.label}</p>
                        <span style={{fontSize:15}}>{k.icon}</span>
                      </div>
                      <p style={{color:k.color,fontSize:28,fontWeight:900,lineHeight:1,margin:0}}>{k.val}</p>
                      <p style={{color:t.sub,fontSize:10,marginTop:4,margin:0,marginTop:4}}>{k.sub}</p>
                      {/* mini sparkline placeholder */}
                      <svg width="100%" height="28" style={{marginTop:8,opacity:0.5}} viewBox="0 0 100 28" preserveAspectRatio="none">
                        <polyline points="0,24 15,20 28,22 40,14 52,18 65,10 78,15 90,8 100,12" fill="none" stroke={k.spark} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  ))}
                </div>
              )}

              {/* System status bar */}
              {isAdmin&&(
                <div style={{...card,padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{width:7,height:7,borderRadius:"50%",background:"#10b981",display:"inline-block",boxShadow:"0 0 6px #10b981"}}/>
                    <p style={{color:t.sub,fontSize:12,margin:0}}>GPS tracking is active and monitoring agent movements in real-time.</p>
                  </div>
                  <span style={{background:"#10b98115",color:"#10b981",borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:700}}>● System Online</span>
                </div>
              )}

              {/* AGENT STATUS CARDS */}
              {isAdmin&&agentSummary.length>0&&<>
                <p style={{color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.09em",textTransform:"uppercase",margin:0}}>Agent Status</p>
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  {agentSummary.map(({a,lastLog,delivCount,transitCount,sessionCount,delivToday,activeMins,total,todayTotal})=>{
                    const isActiveToday=todayTotal>0;
                    const initials=a.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
                    return (
                      <div key={a.id} style={card}>
                        <div style={{padding:"16px 18px"}}>
                          {/* agent header row */}
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                            <div style={{display:"flex",alignItems:"center",gap:12}}>
                              <div style={{width:42,height:42,borderRadius:12,background:"#6366f115",color:"#6366f1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,flexShrink:0}}>
                                {initials}
                              </div>
                              <div>
                                <p style={{color:t.text,fontSize:14,fontWeight:700,margin:0}}>{a.name}</p>
                                <div style={{display:"flex",alignItems:"center",gap:5,marginTop:3}}>
                                  <span style={{width:6,height:6,borderRadius:"50%",background:isActiveToday?"#10b981":"#94a3b8",display:"inline-block"}}/>
                                  <p style={{color:isActiveToday?"#10b981":t.sub,fontSize:11,fontWeight:600,margin:0}}>
                                    {isActiveToday?"Active today":"No activity today"}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <button onClick={()=>ask(`Clear all GPS logs for ${a.name}?`,()=>{setGpsLogs(p=>safeArr(p).filter(l=>l.agentId!==a.id));notify(`Logs cleared for ${a.name}`);})}
                              style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 10px",fontSize:10,fontWeight:600,cursor:"pointer"}}>
                              Clear
                            </button>
                          </div>

                          {/* stat pills */}
                          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:12}}>
                            {[
                              {l:"Total Pings", v:total,         c:"#6366f1"},
                              {l:"Delivered",   v:delivCount,    c:"#10b981"},
                              {l:"In Transit",  v:transitCount,  c:"#0ea5e9"},
                              {l:"Sessions",    v:sessionCount,  c:"#f59e0b"},
                            ].map(s=>(
                              <div key={s.l} style={{background:t.inp,borderRadius:10,padding:"8px 6px",textAlign:"center"}}>
                                <p style={{color:s.c,fontSize:16,fontWeight:900,margin:0}}>{s.v}</p>
                                <p style={{color:t.sub,fontSize:9,fontWeight:600,margin:0,marginTop:2}}>{s.l}</p>
                              </div>
                            ))}
                          </div>

                          {/* today row */}
                          <div style={{background:t.inp,borderRadius:10,padding:"8px 14px",marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                            <div>
                              <p style={{color:t.sub,fontSize:9,fontWeight:800,letterSpacing:"0.09em",textTransform:"uppercase",margin:0}}>Today</p>
                              <p style={{color:t.text,fontSize:12,fontWeight:600,marginTop:2,margin:0,marginTop:2}}>
                                {delivToday} deliveries · {todayTotal} pings{activeMins!==null?` · ~${activeMins}min active`:""}
                              </p>
                            </div>
                            {lastLog&&(
                              <a href={mapU("",lastLog.lat,lastLog.lng)} target="_blank" rel="noopener noreferrer"
                                style={{background:"#0ea5e910",color:"#0ea5e9",borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,textDecoration:"none"}}>
                                Last location ↗
                              </a>
                            )}
                          </div>

                          {lastLog&&(
                            <p style={{color:t.sub,fontSize:10,margin:0}}>
                              Last ping: <span style={{color:t.text,fontWeight:600}}>{lastLog.tsDisplay}</span>
                              {" · "}±{lastLog.acc}m accuracy · {lastLog.lat?.toFixed(5)}, {lastLog.lng?.toFixed(5)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>}

              {agentSummary.length===0&&isAdmin&&(
                <div style={{...card,padding:"48px 24px",display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
                  <span style={{fontSize:40}}>📡</span>
                  <p style={{color:t.text,fontSize:14,fontWeight:700,margin:0}}>No agent data yet</p>
                  <p style={{color:t.sub,fontSize:11,textAlign:"center",maxWidth:280,margin:0}}>GPS is captured automatically when delivery agents log in and take actions</p>
                </div>
              )}

              {can("gps_track")&&!isAdmin&&(
                <div style={{...card,padding:"16px 18px"}}>
                  <p style={{color:t.text,fontSize:13,fontWeight:700,margin:0,marginBottom:6}}>📡 Location Tracking Active</p>
                  <p style={{color:t.sub,fontSize:11,margin:0,lineHeight:1.6}}>Your location is automatically captured when you log in, save deliveries, dispatch or mark delivered. No action needed from your end.</p>
                </div>
              )}

              {/* Danger zone */}
              {isAdmin&&(gpsLogs||[]).length>0&&(
                <div style={{borderTop:`1px solid ${t.border}`,paddingTop:14}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                    <p style={{color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.09em",textTransform:"uppercase",margin:0}}>Danger Zone</p>
                    <button onClick={()=>ask("Clear ALL GPS logs permanently? This cannot be undone.",()=>{setGpsLogs([]);notify("All GPS logs cleared");})}
                      style={{background:"#ef444410",color:"#ef4444",border:"1px solid #ef444430",borderRadius:10,padding:"7px 14px",fontSize:11,fontWeight:700,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
                      🗑 Clear all GPS logs
                    </button>
                  </div>
                </div>
              )}
            </div>}

            {/* ══════════════════════════════════════════════════════
                LIVE MAP
            ══════════════════════════════════════════════════════ */}
            {gpsSection==="map"&&isAdmin&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
              {/* filter row */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8}}>
                <div style={{position:"relative"}}>
                  <select value={gpsFilter} onChange={e=>setGpsFilter(e.target.value)} style={selectStyle}>
                    <option value="all">All Agents</option>
                    {agentUsers.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:t.sub,fontSize:10}}>▾</span>
                </div>
                <div style={{position:"relative"}}>
                  <select value={gpsActionFilter} onChange={e=>setGpsActionFilter(e.target.value)} style={selectStyle}>
                    <option value="all">All Actions</option>
                    {Object.entries(ACTION_META).map(([k,m])=><option key={k} value={k}>{m.icon} {m.label}</option>)}
                  </select>
                  <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:t.sub,fontSize:10}}>▾</span>
                </div>
                <div style={{position:"relative"}}>
                  <select value={gpsDateFilter} onChange={e=>setGpsDateFilter(e.target.value)} style={selectStyle}>
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="week">Last 7 days</option>
                    <option value="month">This month</option>
                  </select>
                  <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:t.sub,fontSize:10}}>▾</span>
                </div>
              </div>

              {/* map card with live summary panel */}
              <div style={{...card,display:"flex",flexDirection:"column"}}>
                {/* map */}
                <div style={{position:"relative"}}>
                  <div style={{borderRadius:"16px 16px 0 0",overflow:"hidden",height:"min(420px,65vw)",minHeight:260}}>
                    <GPSMap dm={dm} logs={logsWithGps} actionMeta={ACTION_META}
                      fallbackLat={settings?.weatherLat||15.4909}
                      fallbackLng={settings?.weatherLng||73.8278}/>
                  </div>
                  {logsWithGps.length===0&&(
                    <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:dm?"#1a1a2e99":"#e8f4f899",borderRadius:"16px 16px 0 0"}}>
                      <p style={{color:t.sub,fontSize:13,fontWeight:600}}>No GPS data matches current filters</p>
                    </div>
                  )}
                </div>

                {/* bottom info strip */}
                <div style={{padding:"12px 16px",borderTop:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                  {/* live summary */}
                  <div style={{display:"flex",flexDirection:"column",gap:4,minWidth:130}}>
                    <p style={{color:t.text,fontSize:11,fontWeight:700,margin:0}}>Live Summary</p>
                    <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"2px 12px",fontSize:11}}>
                      {[
                        {l:"Active Agents",   v:agentUsers.filter(a=>allLogs.some(l=>l.agentId===a.id&&l.ts>=startOfToday.getTime())).length, c:"#10b981"},
                        {l:"On Route",        v:logsWithGps.filter(l=>l.action==="marked_transit").length,  c:"#0ea5e9"},
                        {l:"Completed Today", v:logsWithGps.filter(l=>l.action==="marked_delivered"&&l.ts>=startOfToday.getTime()).length, c:"#6366f1"},
                      ].map(s=>(
                        <React.Fragment key={s.l}>
                          <span style={{color:t.sub}}>{s.l}</span>
                          <span style={{color:s.v>0?s.c:t.sub,fontWeight:700,textAlign:"right"}}>{s.v}</span>
                        </React.Fragment>
                      ))}
                      <span style={{color:t.sub}}>Last Update</span>
                      <span style={{color:t.sub,textAlign:"right"}}>Just now</span>
                    </div>
                  </div>

                  {/* legend */}
                  <div style={{display:"flex",flexWrap:"wrap",gap:"6px 12px",flex:1,justifyContent:"flex-end"}}>
                    {Object.entries(ACTION_META).filter(([k])=>logsWithGps.some(l=>l.action===k)).map(([k,m])=>(
                      <span key={k} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:t.sub,fontWeight:600}}>
                        <span style={{width:7,height:7,borderRadius:"50%",background:m.color,display:"inline-block"}}/>
                        {m.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>}

            {/* ══════════════════════════════════════════════════════
                AUDIT LOG
            ══════════════════════════════════════════════════════ */}
            {gpsSection==="timeline"&&isAdmin&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
              {/* filter bar */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8}}>
                {[
                  {val:gpsFilter,    set:setGpsFilter,    options:[{v:"all",l:"All Agents"},...agentUsers.map(a=>({v:a.id,l:a.name}))]},
                  {val:gpsActionFilter,set:setGpsActionFilter,options:[{v:"all",l:"All Actions"},...Object.entries(ACTION_META).map(([k,m])=>({v:k,l:`${m.icon} ${m.label}`}))]},
                  {val:gpsDateFilter,set:setGpsDateFilter,options:[{v:"all",l:"All Time"},{v:"today",l:"Today"},{v:"yesterday",l:"Yesterday"},{v:"week",l:"Last 7 days"},{v:"month",l:"This month"}]},
                ].map((sel,i)=>(
                  <div key={i} style={{position:"relative"}}>
                    <select value={sel.val} onChange={e=>sel.set(e.target.value)} style={selectStyle}>
                      {sel.options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                    <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:t.sub,fontSize:10}}>▾</span>
                  </div>
                ))}
              </div>

              {/* count + export row */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                <p style={{color:t.sub,fontSize:11,fontWeight:600,margin:0}}>{logsWithGps.length} {logsWithGps.length===1?"entry":"entries"}</p>
                {logsWithGps.length>0&&(
                  <button onClick={exportGpsCSV} style={btnOutline}>⬇ Export CSV</button>
                )}
              </div>

              {/* log table — desktop */}
              {logsWithGps.length===0?(
                <div style={{...card,padding:"48px 24px",display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
                  <span style={{fontSize:36}}>🔍</span>
                  <p style={{color:t.sub,fontSize:13,margin:0}}>No entries match filters</p>
                </div>
              ):(
                <>
                  {/* desktop table */}
                  <div style={{...card,display:"none"}} className="gps-desktop-table">
                    <div style={{overflowX:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead>
                          <tr style={{background:t.inp,borderBottom:`2px solid ${t.border}`}}>
                            {["TIME","AGENT","ACTION","LOCATION","ACCURACY","STATUS"].map(h=>(
                              <th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:9,fontWeight:800,letterSpacing:"0.09em",color:t.sub,whiteSpace:"nowrap"}}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {logsWithGps.map((l,i)=>{
                            const m=ACTION_META[l.action]||{label:l.action,color:"#6b7280",icon:"📍"};
                            const d=new Date(l.ts);
                            const isVerified=l.acc!=null&&l.acc<=15;
                            return (
                              <tr key={l.id} style={{borderBottom:`1px solid ${t.border}`,background:i%2===0?t.card:t.inp}}>
                                <td style={{padding:"10px 14px",color:t.sub,whiteSpace:"nowrap"}}>
                                  <p style={{margin:0,fontSize:11,fontWeight:600,color:t.text}}>{d.toLocaleDateString("en-IN",{month:"short",day:"2-digit"})}</p>
                                  <p style={{margin:0,fontSize:10,color:t.sub}}>{d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</p>
                                </td>
                                <td style={{padding:"10px 14px",fontWeight:700,color:t.text,fontSize:12}}>{l.agentName}</td>
                                <td style={{padding:"10px 14px"}}>
                                  <span style={{background:m.color+"18",color:m.color,padding:"3px 9px",borderRadius:20,fontSize:10,fontWeight:700}}>
                                    {m.icon} {m.label}
                                  </span>
                                  {l.customer&&<p style={{color:t.sub,fontSize:10,margin:0,marginTop:2}}>📦 {l.customer}</p>}
                                </td>
                                <td style={{padding:"10px 14px"}}>
                                  <a href={mapU("",l.lat,l.lng)} target="_blank" rel="noopener noreferrer"
                                    style={{color:"#0ea5e9",fontSize:11,fontWeight:600,textDecoration:"none"}}>
                                    {l.lat?.toFixed(4)}, {l.lng?.toFixed(4)} ↗
                                  </a>
                                  {l.speed!=null&&<p style={{color:t.sub,fontSize:10,margin:0,marginTop:1}}>💨 {l.speed} km/h</p>}
                                </td>
                                <td style={{padding:"10px 14px",color:t.sub,fontSize:11}}>±{l.acc}m</td>
                                <td style={{padding:"10px 14px"}}>
                                  <span style={{
                                    background: isVerified?"#10b98115":"#f59e0b15",
                                    color: isVerified?"#10b981":"#f59e0b",
                                    padding:"3px 9px",borderRadius:20,fontSize:10,fontWeight:700
                                  }}>
                                    {isVerified?"● Verified":"● Info"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* mobile cards */}
                  <div style={{display:"flex",flexDirection:"column",gap:8}} className="gps-mobile-cards">
                    {logsWithGps.map(l=>{
                      const m=ACTION_META[l.action]||{label:l.action,color:"#6b7280",icon:"📍"};
                      const d=new Date(l.ts);
                      const isVerified=l.acc!=null&&l.acc<=15;
                      return (
                        <div key={l.id} style={card}>
                          <div style={{padding:"14px 16px",display:"flex",alignItems:"flex-start",gap:12}}>
                            <div style={{width:38,height:38,borderRadius:10,background:m.color+"18",color:m.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
                              {m.icon}
                            </div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:2}}>
                                <p style={{color:t.text,fontSize:13,fontWeight:700,margin:0}}>{l.agentName}</p>
                                <span style={{background:m.color+"18",color:m.color,borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:700}}>{m.label}</span>
                                <span style={{background:isVerified?"#10b98115":"#f59e0b15",color:isVerified?"#10b981":"#f59e0b",borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:700}}>
                                  {isVerified?"● Verified":"● Info"}
                                </span>
                              </div>
                              {l.customer&&<p style={{color:t.text,fontSize:11,fontWeight:600,margin:0,marginBottom:3}}>📦 {l.customer}</p>}
                              <div style={{display:"flex",flexWrap:"wrap",gap:"2px 12px"}}>
                                <p style={{color:t.sub,fontSize:10,margin:0}}>{d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</p>
                                <p style={{color:t.sub,fontSize:10,margin:0}}>{d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</p>
                                <a href={mapU("",l.lat,l.lng)} target="_blank" rel="noopener noreferrer"
                                  style={{color:"#0ea5e9",fontSize:10,fontWeight:600,textDecoration:"none"}}>
                                  📍 {l.lat?.toFixed(4)}, {l.lng?.toFixed(4)} ↗
                                </a>
                                <p style={{color:t.sub,fontSize:10,margin:0}}>±{l.acc}m</p>
                                {l.speed!=null&&<p style={{color:t.sub,fontSize:10,margin:0}}>💨 {l.speed}km/h</p>}
                              </div>
                            </div>
                            <button onClick={()=>ask("Delete this entry?",()=>{setGpsLogs(p=>safeArr(p).filter(x=>x.id!==l.id));notify("Deleted");})}
                              style={{background:"none",border:"none",color:t.sub,fontSize:11,cursor:"pointer",padding:"4px 6px",flexShrink:0}}>✕</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>}

            {/* ══════════════════════════════════════════════════════
                DAILY REPORT
            ══════════════════════════════════════════════════════ */}
            {gpsSection==="report"&&isAdmin&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
              {/* filter + print row */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8}}>
                <div style={{position:"relative"}}>
                  <select value={gpsFilter} onChange={e=>setGpsFilter(e.target.value)} style={selectStyle}>
                    <option value="all">All agents</option>
                    {agentUsers.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:t.sub,fontSize:10}}>▾</span>
                </div>
                <div style={{position:"relative"}}>
                  <select value={gpsDateFilter} onChange={e=>setGpsDateFilter(e.target.value)} style={selectStyle}>
                    <option value="all">All time</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="week">Last 7 days</option>
                    <option value="month">This month</option>
                  </select>
                  <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:t.sub,fontSize:10}}>▾</span>
                </div>
                {logsWithGps.length>0&&(
                  <button onClick={printReport} style={{...btnPrimary,justifyContent:"center",minHeight:40}}>
                    🖨 Print / PDF
                  </button>
                )}
              </div>

              {/* Daily stat strip */}
              {logsWithGps.length>0&&(
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr) repeat(2,1fr)",gap:8}}>
                  {[
                    {label:"TOTAL PINGS",        val:logsWithGps.length,                                         color:"#6366f1"},
                    {label:"DELIVERIES CONFIRMED",val:logsWithGps.filter(l=>l.action==="marked_delivered").length, color:"#10b981"},
                    {label:"ACTIVE AGENTS",       val:[...new Set(logsWithGps.map(l=>l.agentId))].length,        color:"#f59e0b"},
                    {label:"DISTANCE COVERED",    val:"0 km",                                                    color:"#0ea5e9"},
                  ].map(k=>(
                    <div key={k.label} style={{...card,padding:"14px 16px",position:"relative",overflow:"hidden"}}>
                      <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:k.color,opacity:0.6,borderRadius:"16px 16px 0 0"}}/>
                      <p style={{color:t.sub,fontSize:9,fontWeight:800,letterSpacing:"0.09em",textTransform:"uppercase",margin:0,marginBottom:4}}>{k.label}</p>
                      <p style={{color:k.color,fontSize:20,fontWeight:900,lineHeight:1,margin:0}}>{k.val}</p>
                      <p style={{color:t.sub,fontSize:9,margin:0,marginTop:4}}>↑ 0% vs yesterday</p>
                      <svg width="100%" height="22" style={{marginTop:6,opacity:0.45}} viewBox="0 0 100 22" preserveAspectRatio="none">
                        <polyline points="0,18 20,14 38,16 55,10 70,13 85,7 100,10" fill="none" stroke={k.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  ))}
                </div>
              )}

              {getDailyBreakdown().length===0?(
                <div style={{...card,padding:"48px 24px",display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
                  <span style={{fontSize:36}}>📄</span>
                  <p style={{color:t.sub,fontSize:13,margin:0}}>No data for selected period</p>
                </div>
              ):(
                <>
                  {/* top agents sidebar strip */}
                  <div style={{...card,padding:"14px 18px"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:8}}>
                      <p style={{color:t.text,fontSize:12,fontWeight:700,margin:0}}>Top Agents</p>
                      <button style={{background:"none",border:"none",color:"#0ea5e9",fontSize:11,fontWeight:700,cursor:"pointer",padding:0}}>View all</button>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {agentSummary.slice(0,3).map(({a,total},i)=>(
                        <div key={a.id} style={{display:"flex",alignItems:"center",gap:10}}>
                          <span style={{color:t.sub,fontSize:11,fontWeight:700,width:14}}>{i+1}</span>
                          <span style={{flex:1,color:t.text,fontSize:12,fontWeight:600}}>{a.name}</span>
                          <span style={{color:t.sub,fontSize:11}}>{total} pings</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {getDailyBreakdown().map(day=>(
                    <div key={day.date} style={card}>
                      <div style={{padding:"14px 18px"}}>
                        {/* day header */}
                        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
                          <div>
                            <p style={{color:t.text,fontSize:13,fontWeight:800,margin:0}}>{day.date}</p>
                            <p style={{color:t.sub,fontSize:10,margin:0,marginTop:2}}>{[...day.agents].join(", ")}</p>
                          </div>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                            <span style={{background:"#10b98115",color:"#10b981",borderRadius:6,padding:"2px 9px",fontSize:10,fontWeight:700}}>✅ {day.delivered} delivered</span>
                            <span style={{background:"#0ea5e915",color:"#0ea5e9",borderRadius:6,padding:"2px 9px",fontSize:10,fontWeight:700}}>🚚 {day.transit} transit</span>
                            <span style={{background:"#6366f115",color:"#6366f1",borderRadius:6,padding:"2px 9px",fontSize:10,fontWeight:700}}>🔓 {day.sessions} sessions</span>
                          </div>
                        </div>

                        {/* timeline entries */}
                        <div style={{display:"flex",flexDirection:"column",gap:0}}>
                          {day.entries.map((l,i)=>{
                            const m=ACTION_META[l.action]||{label:l.action,color:"#6b7280",icon:"📍"};
                            const d=new Date(l.ts);
                            const isLast=i===day.entries.length-1;
                            return (
                              <div key={l.id} style={{display:"flex",alignItems:"flex-start",gap:10,paddingBottom:isLast?0:8}}>
                                <div style={{display:"flex",flexDirection:"column",alignItems:"center",paddingTop:2,flexShrink:0}}>
                                  <div style={{width:8,height:8,borderRadius:"50%",background:m.color}}/>
                                  {!isLast&&<div style={{width:1,flex:1,background:t.border,minHeight:16,marginTop:2}}/>}
                                </div>
                                <div style={{flex:1,minWidth:0,paddingBottom:2}}>
                                  <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                                    <p style={{color:t.text,fontSize:11,fontWeight:600,margin:0}}>{l.agentName}</p>
                                    <span style={{background:m.color+"18",color:m.color,borderRadius:5,padding:"0px 6px",fontSize:9,fontWeight:700}}>{m.icon} {m.label}</span>
                                    {l.customer&&<span style={{color:t.sub,fontSize:10}}>· {l.customer}</span>}
                                  </div>
                                  <div style={{display:"flex",gap:10,marginTop:2,flexWrap:"wrap"}}>
                                    <p style={{color:t.sub,fontSize:10,margin:0}}>{d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</p>
                                    <a href={mapU("",l.lat,l.lng)} target="_blank" rel="noopener noreferrer"
                                      style={{color:"#0ea5e9",fontSize:10,fontWeight:600,textDecoration:"none"}}>
                                      📍 {l.lat?.toFixed(4)}, {l.lng?.toFixed(4)} ↗
                                    </a>
                                    <p style={{color:t.sub,fontSize:10,margin:0}}>±{l.acc}m</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Daily summary notice when empty */}
              {logsWithGps.length===0&&getDailyBreakdown().length===0&&(
                <div style={{...card,padding:"14px 18px",display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:20}}>📅</span>
                  <div>
                    <p style={{color:t.text,fontSize:12,fontWeight:700,margin:0}}>Daily Summary</p>
                    <p style={{color:t.sub,fontSize:11,margin:0,marginTop:2}}>
                      No activity recorded for {new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}. Check back later for updates.
                    </p>
                  </div>
                </div>
              )}
            </div>}

            {/* responsive helpers — injected once */}
            <style>{`
              @media(min-width:640px){
                .gps-desktop-table{display:block!important}
                .gps-mobile-cards{display:none!important}
              }
            `}</style>
          </div>;
        })()}

        {/* SETTINGS */}
