/* eslint-disable */
// TAB: GPS
// This file contains the GPS tab JSX, extracted from App.js

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

          // per-agent stats (always from allLogs unfiltered for Overview cards)
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
            // rough active duration today: last today ping - first today ping (minutes)
            const activeMins=firstToday&&lastTodayLog&&todayLogs.length>1?Math.round((lastTodayLog.ts-firstToday.ts)/60000):null;
            return {a,lastLog,firstToday,delivCount,transitCount,sessionCount,delivToday,activeMins,total:aLogs.length,todayTotal:todayLogs.length};
          });

          // daily breakdown for report view
          function getDailyBreakdown(){
            const map={};
            logsWithGps.forEach(l=>{
              // Use local date to avoid UTC vs IST day mismatch (IST = UTC+5:30)
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

          // exports
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

          // sub-nav sections
          const GPS_SECTIONS=[
            {id:"overview",label:"Overview",icon:"📊"},
            {id:"map",label:"Live Map",icon:"🗺"},
            {id:"timeline",label:"Audit Log",icon:"📋"},
            {id:"report",label:"Daily Report",icon:"📄"},
          ];
          const gpsSection = gpsSubSection||"overview";

          return <>
            <SectionHeader dm={dm} title="GPS & Location" sub="Real-time agent tracking · Full audit trail · GPS-verified delivery records"
              cta={isAdmin&&logsWithGps.length>0&&<div style={{display:"flex",gap:8}}>
                <button onClick={exportGpsCSV} style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:9,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>⬇ CSV</button>
                <button onClick={printReport} style={{background:"#2563eb",color:"#fff",borderRadius:9,padding:"8px 14px",fontSize:12,fontWeight:700,border:"none",cursor:"pointer",boxShadow:"0 2px 8px rgba(37,99,235,0.3)"}}>🖨 Print</button>
              </div>}/>
            {isAdmin&&<div className="flex gap-1 overflow-x-auto scrollbar-hide">
              {GPS_SECTIONS.map(s=>(
                <button key={s.id} onClick={()=>setGpsSubSection(s.id)}
                  style={{background:gpsSection===s.id?"#6366f1":t.inp,color:gpsSection===s.id?"#fff":t.sub,border:`1px solid ${gpsSection===s.id?"#6366f1":t.border}`,borderRadius:9,padding:"5px 13px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
                  {s.icon} {s.label}
                </button>
              ))}
            </div>}

            {/* ══ OVERVIEW ══ */}
            {(gpsSection==="overview"||!isAdmin)&&<>
              {/* KPI strip */}
              {isAdmin&&<div className="crm-grid-2" style={{gap:3*4}}>
                {[
                  {label:"Total GPS Pings",val:allLogs.filter(l=>l.lat&&l.lng).length,sub:"all time",color:"#6366f1",icon:"📡"},
                  {label:"Deliveries Confirmed",val:allLogs.filter(l=>l.action==="marked_delivered").length,sub:"GPS-verified",color:"#10b981",icon:"✅"},
                  {label:"Active Today",val:allLogs.filter(l=>l.ts>=startOfToday.getTime()&&l.lat&&l.lng).length,sub:"pings today",color:"#f59e0b",icon:"🔥"},
                  {label:"Agents Tracked",val:agentUsers.length,sub:"with GPS data",color:"#0ea5e9",icon:"👥"},
                ].map(k=>(
                  <div key={k.label} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:"14px 16px"}}>
                    <div className="flex items-center justify-between mb-1">
                      <p style={{color:t.sub}} className="text-[10px] font-bold uppercase tracking-widest">{k.label}</p>
                      <span style={{fontSize:16}}>{k.icon}</span>
                    </div>
                    <p style={{color:k.color}} className="text-2xl font-black">{k.val}</p>
                    <p style={{color:t.sub}} className="text-[10px] mt-0.5">{k.sub}</p>
                  </div>
                ))}
              </div>}

              {/* Agent cards */}
              {isAdmin&&agentSummary.length>0&&<>
                <p style={{color:t.sub}} className="text-[10px] font-bold uppercase tracking-widest mt-1">Agent Status</p>
                <div className="flex flex-col gap-3">
                  {agentSummary.map(({a,lastLog,delivCount,transitCount,sessionCount,delivToday,activeMins,total,todayTotal})=>{
                    const isActiveToday=todayTotal>0;
                    return <Card key={a.id} dm={dm}><div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div style={{background:"#6366f120",color:"#6366f1",width:40,height:40,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,flexShrink:0}}>
                            {a.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                          </div>
                          <div>
                            <p style={{color:t.text}} className="text-sm font-bold">{a.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span style={{width:6,height:6,borderRadius:"50%",background:isActiveToday?"#10b981":"#6b7280",display:"inline-block"}}/>
                              <p style={{color:isActiveToday?"#10b981":t.sub}} className="text-[10px] font-semibold">{isActiveToday?"Active today":"No activity today"}</p>
                            </div>
                          </div>
                        </div>
                        <button onClick={()=>ask(`Clear all GPS logs for ${a.name}?`,()=>{setGpsLogs(p=>safeArr(p).filter(l=>l.agentId!==a.id));notify(`Logs cleared for ${a.name}`);})}
                          style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"3px 10px",fontSize:10,fontWeight:600,cursor:"pointer"}}>Clear</button>
                      </div>
                      {/* stat row */}
                      <div className="crm-grid-4" style={{gap:8,marginBottom:12}}>
                        {[
                          {l:"Total Pings",v:total,c:"#6366f1"},
                          {l:"Delivered",v:delivCount,c:"#10b981"},
                          {l:"In Transit",v:transitCount,c:"#0ea5e9"},
                          {l:"Sessions",v:sessionCount,c:"#f59e0b"},
                        ].map(s=>(
                          <div key={s.l} style={{background:t.inp,borderRadius:10,padding:"8px 6px",textAlign:"center"}}>
                            <p style={{color:s.c}} className="text-base font-black">{s.v}</p>
                            <p style={{color:t.sub}} className="text-[9px] font-semibold">{s.l}</p>
                          </div>
                        ))}
                      </div>
                      {/* today row */}
                      <div style={{background:t.inp,borderRadius:10,padding:"8px 12px",marginBottom:10}} className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p style={{color:t.sub}} className="text-[10px] font-bold uppercase tracking-widest">Today</p>
                          <p style={{color:t.text}} className="text-xs font-semibold mt-0.5">{delivToday} deliveries · {todayTotal} pings{activeMins!==null?` · ~${activeMins}min active`:""}</p>
                        </div>
                        {lastLog&&<a href={mapU("",lastLog.lat,lastLog.lng)} target="_blank" rel="noopener noreferrer"
                          style={{background:"#0ea5e915",color:"#0ea5e9",borderRadius:8,padding:"4px 11px",fontSize:11,fontWeight:700,textDecoration:"none"}}>Last location ↗</a>}
                      </div>
                      {lastLog&&<p style={{color:t.sub}} className="text-[10px]">Last ping: <span style={{color:t.text,fontWeight:600}}>{lastLog.tsDisplay}</span> · ±{lastLog.acc}m accuracy · {lastLog.lat?.toFixed(5)}, {lastLog.lng?.toFixed(5)}</p>}
                    </div></Card>;
                  })}
                </div>
              </>}

              {agentSummary.length===0&&<div className="flex flex-col items-center gap-2 py-14">
                <span className="text-5xl">📡</span>
                <p style={{color:t.sub}} className="text-sm font-semibold">No agent data yet</p>
                <p style={{color:t.sub}} className="text-[11px] text-center max-w-xs">GPS is captured automatically when delivery agents log in and take actions</p>
              </div>}

              {/* agent self-view */}
              {can("gps_track")&&!isAdmin&&(
                <div style={{background:t.inp,border:`1px solid ${t.border}`,borderRadius:14,padding:"14px 16px"}}>
                  <p style={{color:t.text}} className="text-sm font-bold mb-1">📡 Location Tracking Active</p>
                  <p style={{color:t.sub}} className="text-[11px]">Your location is automatically captured when you log in, save deliveries, dispatch or mark delivered. No action needed from your end.</p>
                </div>
              )}
            </>}

            {/* ══ MAP ══ */}
            {gpsSection==="map"&&isAdmin&&<>
              {/* filters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select value={gpsFilter} onChange={e=>setGpsFilter(e.target.value)}
                  style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:12,padding:"10px 14px",fontSize:14,outline:"none",minHeight:48,WebkitAppearance:"none",appearance:"none"}}>
                  <option value="all">All agents</option>
                  {agentUsers.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <select value={gpsActionFilter} onChange={e=>setGpsActionFilter(e.target.value)}
                  style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:12,padding:"10px 14px",fontSize:14,outline:"none",minHeight:48,WebkitAppearance:"none",appearance:"none"}}>
                  <option value="all">All actions</option>
                  {Object.entries(ACTION_META).map(([k,m])=><option key={k} value={k}>{m.icon} {m.label}</option>)}
                </select>
                <select value={gpsDateFilter} onChange={e=>setGpsDateFilter(e.target.value)}
                  style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:12,padding:"10px 14px",fontSize:14,outline:"none",minHeight:48,WebkitAppearance:"none",appearance:"none"}}>
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">Last 7 days</option>
                  <option value="month">This month</option>
                </select>
              </div>
              {/* stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  {label:"Showing",val:logsWithGps.length+" pins",color:t.text},
                  {label:"Delivered",val:logsWithGps.filter(l=>l.action==="marked_delivered").length,color:"#10b981"},
                  {label:"In Transit",val:logsWithGps.filter(l=>l.action==="marked_transit").length,color:"#0ea5e9"},
                  {label:"Sessions",val:logsWithGps.filter(l=>l.action==="session_start").length,color:"#6366f1"},
                ].map(s=>(
                  <div key={s.label} style={{background:t.inp,border:`1px solid ${t.border}`,borderRadius:12,padding:"10px 14px",textAlign:"center"}}>
                    <p style={{color:s.color}} className="text-base font-black">{s.val}</p>
                    <p style={{color:t.sub}} className="text-[10px] font-semibold mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              {/* map + legend */}
              <Card dm={dm}><div className="p-3 sm:p-4">
                <div className="flex items-center justify-between mb-3 gap-2">
                  <p style={{color:t.text}} className="font-bold text-sm">🗺 GPS Trail Map</p>
                  <div className="flex gap-2 overflow-x-auto" style={{scrollbarWidth:"none"}}>
                    {Object.entries(ACTION_META).filter(([k])=>logsWithGps.some(l=>l.action===k)).map(([k,m])=>(
                      <span key={k} className="flex items-center gap-1 shrink-0" style={{fontSize:10,color:t.sub,fontWeight:600}}>
                        <span style={{width:8,height:8,borderRadius:"50%",background:m.color,display:"inline-block"}}/>
                        {m.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{borderRadius:12,overflow:"hidden",height:"min(420px,60vw)",minHeight:260}}>
                  <GPSMap dm={dm} logs={logsWithGps} actionMeta={ACTION_META} fallbackLat={settings?.weatherLat||15.4909} fallbackLng={settings?.weatherLng||73.8278}/>
                </div>
                {logsWithGps.length===0&&<p style={{color:t.sub,textAlign:"center",paddingTop:12,fontSize:12}}>No GPS data matches current filters</p>}
              </div></Card>
            </>}

            {/* ══ AUDIT LOG ══ */}
            {gpsSection==="timeline"&&isAdmin&&<>
              {/* filters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select value={gpsFilter} onChange={e=>setGpsFilter(e.target.value)}
                  style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:12,padding:"10px 14px",fontSize:14,outline:"none",minHeight:48,WebkitAppearance:"none",appearance:"none"}}>
                  <option value="all">All agents</option>
                  {agentUsers.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <select value={gpsActionFilter} onChange={e=>setGpsActionFilter(e.target.value)}
                  style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:12,padding:"10px 14px",fontSize:14,outline:"none",minHeight:48,WebkitAppearance:"none",appearance:"none"}}>
                  <option value="all">All actions</option>
                  {Object.entries(ACTION_META).map(([k,m])=><option key={k} value={k}>{m.icon} {m.label}</option>)}
                </select>
                <select value={gpsDateFilter} onChange={e=>setGpsDateFilter(e.target.value)}
                  style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:12,padding:"10px 14px",fontSize:14,outline:"none",minHeight:48,WebkitAppearance:"none",appearance:"none"}}>
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">Last 7 days</option>
                  <option value="month">This month</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <p style={{color:t.sub}} className="text-[11px] font-semibold">{logsWithGps.length} entries</p>
                {logsWithGps.length>0&&<button onClick={exportGpsCSV} style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:9,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ Export CSV</button>}
              </div>
              {logsWithGps.length===0
                ?<div className="flex flex-col items-center gap-2 py-12">
                  <span className="text-4xl">🔍</span>
                  <p style={{color:t.sub}} className="text-sm">No entries match filters</p>
                </div>
                :logsWithGps.map(l=>{
                  const m=ACTION_META[l.action]||{label:l.action,color:"#6b7280",icon:"📍"};
                  const d=new Date(l.ts);
                  return <Card key={l.id} dm={dm}><div className="p-3.5 flex items-start gap-3">
                    <div style={{background:m.color+"18",color:m.color,width:38,height:38,borderRadius:11,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{m.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p style={{color:t.text}} className="text-sm font-bold">{l.agentName}</p>
                        <span style={{background:m.color+"18",color:m.color,borderRadius:6,padding:"1px 8px",fontSize:10,fontWeight:700}}>{m.label}</span>
                      </div>
                      {l.customer&&<p style={{color:t.text}} className="text-xs font-medium">📦 {l.customer}</p>}
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <p style={{color:t.sub}} className="text-[10px]">📅 {d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</p>
                        <p style={{color:t.sub}} className="text-[10px]">🕐 {d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</p>
                        <p style={{color:t.sub}} className="text-[10px]">📍 {l.lat?.toFixed(5)}, {l.lng?.toFixed(5)}</p>
                        <p style={{color:t.sub}} className="text-[10px]">🎯 ±{l.acc}m</p>
                        {l.speed!=null&&<p style={{color:t.sub}} className="text-[10px]">💨 {l.speed}km/h</p>}
                        {l.heading!=null&&<p style={{color:t.sub}} className="text-[10px]">🧭 {l.heading}°</p>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
                      <a href={mapU("",l.lat,l.lng)} target="_blank" rel="noopener noreferrer"
                        style={{background:"#0ea5e915",color:"#0ea5e9",borderRadius:10,padding:"8px 12px",fontSize:12,fontWeight:700,textDecoration:"none",minHeight:36,display:"flex",alignItems:"center"}}>Maps ↗</a>
                      <button onClick={()=>ask("Delete this entry?",()=>{setGpsLogs(p=>safeArr(p).filter(x=>x.id!==l.id));notify("Deleted");})}
                        style={{background:"none",border:"none",color:t.sub,fontSize:11,cursor:"pointer",padding:"4px 6px",minHeight:28,WebkitTapHighlightColor:"transparent"}}>✕ remove</button>
                    </div>
                  </div></Card>;
                })
              }
            </>}

            {/* ══ DAILY REPORT ══ */}
            {gpsSection==="report"&&isAdmin&&<>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select value={gpsFilter} onChange={e=>setGpsFilter(e.target.value)}
                  style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:12,padding:"10px 14px",fontSize:14,outline:"none",minHeight:48,WebkitAppearance:"none",appearance:"none"}}>
                  <option value="all">All agents</option>
                  {agentUsers.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <select value={gpsDateFilter} onChange={e=>setGpsDateFilter(e.target.value)}
                  style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:12,padding:"10px 14px",fontSize:14,outline:"none",minHeight:48,WebkitAppearance:"none",appearance:"none"}}>
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">Last 7 days</option>
                  <option value="month">This month</option>
                </select>
                {logsWithGps.length>0&&<button onClick={printReport}
                  style={{background:"#6366f1",color:"#fff",border:"none",borderRadius:12,padding:"10px 16px",fontSize:14,fontWeight:700,cursor:"pointer",minHeight:48,WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>🖨 Print / PDF</button>}
              </div>

              {getDailyBreakdown().length===0
                ?<div className="flex flex-col items-center gap-2 py-12"><span className="text-4xl">📄</span><p style={{color:t.sub}} className="text-sm">No data for selected period</p></div>
                :getDailyBreakdown().map(day=>(
                  <Card key={day.date} dm={dm}><div className="p-4">
                    {/* day header */}
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div>
                        <p style={{color:t.text}} className="text-sm font-black">{day.date}</p>
                        <p style={{color:t.sub}} className="text-[10px]">{[...day.agents].join(", ")}</p>
                      </div>
                      <div className="flex gap-2">
                        <span style={{background:"#10b98118",color:"#10b981",borderRadius:7,padding:"2px 9px",fontSize:10,fontWeight:700}}>✅ {day.delivered} delivered</span>
                        <span style={{background:"#0ea5e918",color:"#0ea5e9",borderRadius:7,padding:"2px 9px",fontSize:10,fontWeight:700}}>🚚 {day.transit} transit</span>
                        <span style={{background:"#6366f118",color:"#6366f1",borderRadius:7,padding:"2px 9px",fontSize:10,fontWeight:700}}>🔓 {day.sessions} sessions</span>
                      </div>
                    </div>
                    {/* entries for this day */}
                    <div className="flex flex-col gap-0">
                      {day.entries.map((l,i)=>{
                        const m=ACTION_META[l.action]||{label:l.action,color:"#6b7280",icon:"📍"};
                        const d=new Date(l.ts);
                        const isLast=i===day.entries.length-1;
                        return <div key={l.id} className="flex items-start gap-2.5" style={{paddingBottom:isLast?0:8}}>
                          {/* timeline dot + line */}
                          <div className="flex flex-col items-center" style={{paddingTop:2,flexShrink:0}}>
                            <div style={{width:8,height:8,borderRadius:"50%",background:m.color,flexShrink:0}}/>
                            {!isLast&&<div style={{width:1,flex:1,background:t.border,minHeight:16,marginTop:2}}/>}
                          </div>
                          <div className="flex-1 min-w-0 pb-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p style={{color:t.text}} className="text-xs font-semibold">{l.agentName}</p>
                              <span style={{background:m.color+"18",color:m.color,borderRadius:5,padding:"0px 6px",fontSize:9,fontWeight:700}}>{m.icon} {m.label}</span>
                              {l.customer&&<span style={{color:t.sub}} className="text-[10px]">· {l.customer}</span>}
                            </div>
                            <div className="flex gap-3 mt-0.5 flex-wrap">
                              <p style={{color:t.sub}} className="text-[10px]">{d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</p>
                              <a href={mapU("",l.lat,l.lng)} target="_blank" rel="noopener noreferrer" style={{color:"#0ea5e9",fontSize:10,fontWeight:600,textDecoration:"none"}}>📍 {l.lat?.toFixed(4)}, {l.lng?.toFixed(4)} ↗</a>
                              <p style={{color:t.sub}} className="text-[10px]">±{l.acc}m</p>
                            </div>
                          </div>
                        </div>;
                      })}
                    </div>
                  </div></Card>
                ))
              }
            </>}

            {/* ── Danger zone ── */}
            {isAdmin&&(gpsLogs||[]).length>0&&gpsSection==="overview"&&<div style={{borderTop:`1px solid ${t.border}`,paddingTop:12}}>
              <div className="flex items-center justify-between">
                <p style={{color:t.sub}} className="text-[10px] font-bold uppercase tracking-widest">Danger Zone</p>
                <button onClick={()=>ask("Clear ALL GPS logs permanently? This cannot be undone.",()=>{setGpsLogs([]);notify("All GPS logs cleared");})}
                  style={{background:"#ef444410",color:"#ef4444",border:`1px solid #ef444430`,borderRadius:10,padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                  🗑 Clear all GPS logs
                </button>
              </div>
            </div>}
          </>;
        })()}

        {/* SETTINGS */}
