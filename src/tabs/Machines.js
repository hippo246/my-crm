/* eslint-disable */
// TAB: Machines
// This file contains the Machines tab JSX, extracted from App.js

        {tab==="Machines"&&(()=>{
          const tStr=today();
          const wStr=(()=>{const d=new Date(tStr);d.setDate(d.getDate()-6);return d.toISOString().slice(0,10);})();
          const fLogs=(machineLogs||[]).filter(l=>!machSearch||l.machineName.toLowerCase().includes(machSearch.toLowerCase())||(l.issue||"").toLowerCase().includes(machSearch.toLowerCase())).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
          const totalCost=(machineLogs||[]).reduce((s,l)=>s+(l.cost||0),0);
          const overdueMachines=(machineList||[]).filter(m=>{const last=(machineLogs||[]).filter(l=>l.machineName===m.name).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];return last?.nextDue&&last.nextDue<tStr;});
          return <>
            <SectionHeader dm={dm} title="Machines" sub="Maintenance logs and equipment tracker"
              cta={(isAdmin||isFactory)&&<button onClick={()=>{setMachF({machineId:"",machineName:"",date:today(),type:(settings?.machineLogTypes||["Servicing"])[0],severity:"Medium",issue:"",action:"",technician:"",partsReplaced:"",partsCost:"",laborCost:"",cost:"",downtimeHrs:"",nextDue:"",loggedBy:displayName,status:(settings?.machineStatuses||["Operational"])[0]});setMachSh("add");}}
                style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:12,padding:"11px 20px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:7,boxShadow:"0 2px 8px rgba(37,99,235,0.3)"}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Log Maintenance
              </button>}/>
            <div className="crm-grid-4" style={{marginBottom:8}}>
              {[
                {label:"Machines",val:(machineList||[]).length,color:"#3b82f6"},
                {label:"Total Logs",val:(machineLogs||[]).length,color:"#8b5cf6"},
                {label:"Total Cost",val:inr(totalCost),color:"#ef4444"},
                {label:"Overdue",val:overdueMachines.length,color:overdueMachines.length>0?"#ef4444":"#10b981"},
              ].map(s=>(
                <div key={s.label} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"14px 16px"}}>
                  <p style={{color:s.color,fontWeight:900,fontSize:22,lineHeight:1}}>{s.val}</p>
                  <p style={{color:t.sub,fontSize:10,marginTop:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em"}}>{s.label}</p>
                </div>
              ))}
            </div>
            {overdueMachines.length>0&&<div style={{background:"#ef444410",border:"1px solid #ef444430",borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:20}}>⚠️</span>
              <div><p style={{color:"#ef4444",fontWeight:700,fontSize:13}}>Maintenance Overdue</p><p style={{color:"#ef4444",fontSize:11}}>{overdueMachines.map(m=>m.name).join(", ")}</p></div>
            </div>}
            {/* Sub-tabs */}
            <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,display:"flex",overflow:"hidden",marginBottom:4}}>
              {[["log","📋","Maintenance Log"],["machines","⚙️","Machines"]].map(([k,icon,lbl])=>(
                <button key={k} onClick={()=>setMachSubTab(k)} style={{flex:1,padding:"11px 8px",fontSize:13,fontWeight:machSubTab===k?700:500,background:machSubTab===k?t.accent:"transparent",color:machSubTab===k?t.accentFg:t.sub,border:"none",cursor:"pointer",transition:"all 0.15s",display:"flex",alignItems:"center",justifyContent:"center",gap:5,overflow:"hidden"}}><span style={{flexShrink:0}}>{icon}</span><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lbl}</span></button>
              ))}
            </div>
            {machSubTab==="log"&&<>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <input value={machSearch} onChange={e=>setMachSearch(e.target.value)} placeholder="Search machine or issue…" style={{flex:1,minWidth:160,background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:10,padding:"9px 12px",fontSize:14,outline:"none"}}/>
                
              </div>
              {fLogs.length===0?<div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"36px 20px",textAlign:"center"}}><p style={{fontSize:32,marginBottom:8}}>⚙️</p><p style={{color:t.sub,fontSize:14,fontWeight:600}}>No maintenance logs yet</p></div>
              :fLogs.map(l=>{
                const tc=l.type==="Breakdown"?"#ef4444":l.type==="Routine"?"#3b82f6":"#f59e0b";
                const sevColor=l.severity==="Critical"?"#ef4444":l.severity==="High"?"#f97316":l.severity==="Medium"?"#f59e0b":"#10b981";
                return <div key={l.id} style={{background:t.card,border:`1.5px solid ${tc}25`,borderRadius:14,padding:"14px 16px"}} className="crm-list-item">
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                    <div style={{flex:1,minWidth:0}}>
                      {/* Row 1: machine + badges */}
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                        <p style={{color:t.text,fontWeight:700,fontSize:14}}>{l.machineName}</p>
                        <span style={{background:tc+"20",color:tc,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{l.type}</span>
                        {l.severity&&<span style={{background:sevColor+"20",color:sevColor,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{l.severity}</span>}
                        {l.status&&l.status!=="Operational"&&<span style={{background:"#ef444420",color:"#ef4444",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{l.status}</span>}
                        {l.nextDue&&l.nextDue<tStr&&<span style={{background:"#ef444420",color:"#ef4444",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>⚠️ Overdue</span>}
                      </div>
                      {/* Row 2: issue + action */}
                      {l.issue&&<p style={{color:t.text,fontSize:12,marginBottom:2}}>🔍 <span style={{fontWeight:600}}>{l.issue}</span></p>}
                      {l.action&&<p style={{color:t.sub,fontSize:12,marginBottom:4}}>🔧 {l.action}</p>}
                      {/* Row 3: stats */}
                      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:2}}>
                        <span style={{color:t.sub,fontSize:11}}>📅 {l.date}</span>
                        {l.technician&&<span style={{color:"#3b82f6",fontSize:11,fontWeight:600}}>👷 {l.technician}</span>}
                        {l.cost>0&&<span style={{color:"#ef4444",fontSize:11,fontWeight:700}}>💸 {inr(l.cost)}</span>}
                        {l.downtimeHrs>0&&<span style={{color:"#f59e0b",fontSize:11,fontWeight:600}}>⏸ {l.downtimeHrs}h downtime</span>}
                        {l.nextDue&&<span style={{color:l.nextDue<tStr?"#ef4444":"#10b981",fontSize:11,fontWeight:600}}>📆 Next: {l.nextDue}{l.nextDue<tStr?" ⚠️":""}</span>}
                      </div>
                      {/* Row 4: parts + cost breakdown */}
                      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                        {l.partsReplaced&&<span style={{color:t.sub,fontSize:11}}>🔩 {l.partsReplaced}</span>}
                        {l.partsCost>0&&<span style={{color:t.sub,fontSize:11}}>Parts: {inr(l.partsCost)}</span>}
                        {l.laborCost>0&&<span style={{color:t.sub,fontSize:11}}>Labour: {inr(l.laborCost)}</span>}
                        {l.loggedBy&&<span style={{color:t.sub,fontSize:11}}>👤 {l.loggedBy}</span>}
                      </div>
                    </div>
                    {(isAdmin||isFactory)&&<div style={{display:"flex",gap:8,flexShrink:0}}>
                      <button onClick={()=>{setMachF({...l,cost:l.cost?.toString()||""});setMachSh(l);}} style={{background:t.inp,border:`1px solid ${t.border}`,color:t.sub,borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Edit</button>
                      <button onClick={()=>delMach(l)} style={{background:"#ef444410",border:"1px solid #ef444430",color:"#ef4444",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Del</button>
                    </div>}
                  </div>
                </div>;
              })}
            </>}
            {machSubTab==="machines"&&<>
              {isAdmin&&<Btn dm={dm} v="primary" size="sm" onClick={()=>{setMachItemF({name:"",location:"",notes:""});setMachItemSh("add");}}>+ Add Machine</Btn>}
              {(machineList||[]).length===0?<div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"36px 20px",textAlign:"center"}}><p style={{color:t.sub,fontSize:14}}>No machines added yet</p></div>
              :(machineList||[]).map(m=>{
                const lastLog=(machineLogs||[]).filter(l=>l.machineName===m.name).sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
                const isOverdue=lastLog?.nextDue&&lastLog.nextDue<tStr;
                const totalCostM=(machineLogs||[]).filter(l=>l.machineName===m.name).reduce((s,l)=>s+(l.cost||0),0);
                const logCount=(machineLogs||[]).filter(l=>l.machineName===m.name).length;
                return <div key={m.id} style={{background:t.card,border:`1.5px solid ${isOverdue?"#ef444440":t.border}`,borderRadius:14,padding:"14px 16px"}} className="crm-list-item">
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                        <p style={{color:t.text,fontWeight:700,fontSize:14}}>{m.name}</p>
                        {m.category&&<span style={{background:"#3b82f620",color:"#3b82f6",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:600}}>{m.category}</span>}
                        {isOverdue&&<span style={{background:"#ef444420",color:"#ef4444",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>⚠️ Overdue</span>}
                      </div>
                      <div style={{display:"flex",gap:10,marginBottom:2,flexWrap:"wrap"}}>
                        {m.location&&<span style={{color:t.sub,fontSize:11}}>📍 {m.location}</span>}
                        {m.serialNo&&<span style={{color:t.sub,fontSize:11}}>🔖 S/N: {m.serialNo}</span>}
                        {m.purchaseDate&&<span style={{color:t.sub,fontSize:11}}>📅 Bought: {m.purchaseDate}</span>}
                        {m.warrantyExpiry&&<span style={{color:m.warrantyExpiry<tStr?"#ef4444":"#10b981",fontSize:11,fontWeight:600}}>🛡 Warranty: {m.warrantyExpiry}{m.warrantyExpiry<tStr?" (expired)":""}</span>}
                      </div>
                      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                        {lastLog&&<span style={{color:t.sub,fontSize:11}}>🔧 Last: {lastLog.date} ({lastLog.type})</span>}
                        {lastLog?.nextDue&&<span style={{color:isOverdue?"#ef4444":"#10b981",fontSize:11,fontWeight:600}}>📆 Due: {lastLog.nextDue}</span>}
                        {logCount>0&&<span style={{color:t.sub,fontSize:11}}>{logCount} log{logCount!==1?"s":""}</span>}
                        {totalCostM>0&&<span style={{color:"#ef4444",fontSize:11,fontWeight:600}}>💸 {inr(totalCostM)} total</span>}
                        {!lastLog&&<span style={{color:t.sub,fontSize:11}}>No logs yet</span>}
                      </div>
                      {m.notes&&<p style={{color:t.sub,fontSize:11,marginTop:3}}>📝 {m.notes}</p>}
                    </div>
                    {isAdmin&&<div style={{display:"flex",gap:8,flexShrink:0}}>
                      <button onClick={()=>{setMachItemF({...m});setMachItemSh(m);}} style={{background:t.inp,border:`1px solid ${t.border}`,color:t.sub,borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Edit</button>
                      <button onClick={()=>ask(`Remove "${m.name}"?`,()=>{setMachineList(p=>safeArr(p).filter(x=>x.id!==m.id));notify("Removed");})} style={{background:"#ef444410",border:"1px solid #ef444430",color:"#ef4444",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Del</button>
                    </div>}
                  </div>
                </div>;
              })}
            </>}
            {/* Maintenance log sheet */}
            <Sheet dm={dm} open={!!machSh} onClose={()=>setMachSh(null)} title={machSh==="add"?"⚙️ Log Maintenance Event":"✏️ Edit Log"}>
              {/* Machine selector */}
              <Sel dm={dm} label="Machine *" value={machF.machineName} onChange={e=>setMachF(f=>({...f,machineName:e.target.value}))}>
                <option value="">Select machine…</option>
                {(machineList||[]).map(m=><option key={m.id}>{m.name}</option>)}
                <option value="__custom__">+ Enter manually</option>
              </Sel>
              {machF.machineName==="__custom__"&&<Inp dm={dm} label="Machine Name *" value={machF._customName||""} onChange={e=>setMachF(f=>({...f,_customName:e.target.value,machineName:e.target.value}))}/>}

              {/* Date + Type */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
                <Inp dm={dm} label="Date *" type="date" value={machF.date} onChange={e=>setMachF(f=>({...f,date:e.target.value}))}/>
                <Sel dm={dm} label="Event Type" value={machF.type} onChange={e=>setMachF(f=>({...f,type:e.target.value}))}>
                  {(settings?.machineLogTypes||["Servicing","Breakdown","Repair","Inspection","Oil Change","Other"]).map(x=><option key={x}>{x}</option>)}
                </Sel>
              </div>

              {/* Severity */}
              {settings?.machineShowSeverity!==false&&<div>
                <p style={{color:t.sub,fontSize:11,fontWeight:700,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>Severity</p>
                <div style={{display:"flex",gap:8}}>
                  {(settings?.machineSeverityLevels||["Low","Medium","High","Critical"]).map(sv=>{
                    const sc=sv==="Critical"?"#ef4444":sv==="High"?"#f97316":sv==="Medium"?"#f59e0b":"#10b981";
                    return <button key={sv} onClick={()=>setMachF(f=>({...f,severity:sv}))}
                      style={{flex:1,padding:"8px 0",borderRadius:10,border:`1.5px solid ${machF.severity===sv?sc:t.border}`,background:machF.severity===sv?sc+"18":"transparent",color:machF.severity===sv?sc:t.sub,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                      {sv}
                    </button>;
                  })}
                </div>
              </div>}

              {/* Issue + Action */}
              <Inp dm={dm} label="Issue / Description *" value={machF.issue} onChange={e=>setMachF(f=>({...f,issue:e.target.value}))} placeholder="Describe the issue or work done"/>
              <Inp dm={dm} label="Action Taken" value={machF.action} onChange={e=>setMachF(f=>({...f,action:e.target.value}))} placeholder="What was done to fix it"/>

              {/* Technician */}
              {settings?.machineShowTechnician!==false&&<Inp dm={dm} label="Technician / Engineer" value={machF.technician} onChange={e=>setMachF(f=>({...f,technician:e.target.value}))} placeholder="Name of person who did the work"/>}

              {/* Parts replaced */}
              {settings?.machineShowPartsReplaced!==false&&<Inp dm={dm} label="Parts Replaced" value={machF.partsReplaced} onChange={e=>setMachF(f=>({...f,partsReplaced:e.target.value}))} placeholder="e.g. Belt, Motor, Filter (comma separated)"/>}

              {/* Cost breakdown */}
              <p style={{color:t.sub,fontSize:11,fontWeight:700,marginTop:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>💰 Cost Breakdown</p>
              <div style={{display:"grid",gridTemplateColumns:`${settings?.machineShowPartsCost!==false?"1fr ":""}${settings?.machineShowLaborCost!==false?"1fr ":""}1fr`.trim(),gap:8}}>
                {settings?.machineShowPartsCost!==false&&<Inp dm={dm} label="Parts Cost ₹" type="number" value={machF.partsCost} onChange={e=>setMachF(f=>({...f,partsCost:e.target.value}))} placeholder="0"/>}
                {settings?.machineShowLaborCost!==false&&<Inp dm={dm} label="Labour Cost ₹" type="number" value={machF.laborCost} onChange={e=>setMachF(f=>({...f,laborCost:e.target.value}))} placeholder="0"/>}
                <Inp dm={dm} label="Other Cost ₹" type="number" value={machF.cost} onChange={e=>setMachF(f=>({...f,cost:e.target.value}))} placeholder="0"/>
              </div>
              {/* Total cost preview */}
              {((+machF.partsCost||0)+(+machF.laborCost||0)+(+machF.cost||0))>0&&(
                <div style={{background:t.inp,border:`1px solid ${t.border}`,borderRadius:10,padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{color:t.sub,fontSize:12,fontWeight:600}}>Total Cost</span>
                  <span style={{color:"#ef4444",fontSize:14,fontWeight:800}}>{inr((+machF.partsCost||0)+(+machF.laborCost||0)+(+machF.cost||0))}</span>
                </div>
              )}

              {/* Downtime + Next due */}
              <div style={{display:"grid",gridTemplateColumns:`${settings?.machineShowDowntime!==false?"1fr ":""}1fr`.trim(),gap:8}}>
                {settings?.machineShowDowntime!==false&&<Inp dm={dm} label="Downtime (hrs)" type="number" value={machF.downtimeHrs} onChange={e=>setMachF(f=>({...f,downtimeHrs:e.target.value}))} placeholder="0"/>}
                <Inp dm={dm} label={`Next Service Due${settings?.machineRequireNextDue?" *":""}`} type="date" value={machF.nextDue} onChange={e=>setMachF(f=>({...f,nextDue:e.target.value}))}/>
              </div>

              {/* Status after */}
              <Sel dm={dm} label="Machine Status After" value={machF.status} onChange={e=>setMachF(f=>({...f,status:e.target.value}))}>
                {(settings?.machineStatuses||["Operational","Needs Service","Under Repair","Retired"]).map(x=><option key={x}>{x}</option>)}
              </Sel>

              <div style={{display:"flex",gap:8}}>
                <Btn dm={dm} v="ghost" className="flex-1" onClick={()=>setMachSh(null)}>Cancel</Btn>
                <Btn dm={dm} v="success" className="flex-1" onClick={saveMach}>Save</Btn>
              </div>
            </Sheet>
            {/* Machine item sheet */}
            <Sheet dm={dm} open={!!machItemSh} onClose={()=>setMachItemSh(null)} title={machItemSh==="add"?"➕ Add Machine":"✏️ Edit Machine"}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
                <Inp dm={dm} label="Machine Name *" value={machItemF.name} onChange={e=>setMachItemF(f=>({...f,name:e.target.value}))} placeholder="e.g. Roti Press #1"/>
                <Sel dm={dm} label="Category" value={machItemF.category||""} onChange={e=>setMachItemF(f=>({...f,category:e.target.value}))}>
                  <option value="">Select…</option>
                  {(settings?.machineCategories||["Mixer","Oven","Sealer","Generator","Conveyor","Other"]).map(x=><option key={x}>{x}</option>)}
                </Sel>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
                <Inp dm={dm} label="Location / Area" value={machItemF.location} onChange={e=>setMachItemF(f=>({...f,location:e.target.value}))} placeholder="e.g. Production Floor"/>
                <Inp dm={dm} label="Serial Number" value={machItemF.serialNo} onChange={e=>setMachItemF(f=>({...f,serialNo:e.target.value}))} placeholder="Serial / model no."/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
                <Inp dm={dm} label="Purchase Date" type="date" value={machItemF.purchaseDate} onChange={e=>setMachItemF(f=>({...f,purchaseDate:e.target.value}))}/>
                <Inp dm={dm} label="Purchase Cost ₹" type="number" value={machItemF.purchaseCost} onChange={e=>setMachItemF(f=>({...f,purchaseCost:e.target.value}))} placeholder="0"/>
              </div>
              <Inp dm={dm} label="Warranty Expiry" type="date" value={machItemF.warrantyExpiry} onChange={e=>setMachItemF(f=>({...f,warrantyExpiry:e.target.value}))}/>
              <Inp dm={dm} label="Notes" value={machItemF.notes} onChange={e=>setMachItemF(f=>({...f,notes:e.target.value}))} placeholder="Model info, supplier, etc."/>
              <div style={{display:"flex",gap:8}}>
                <Btn dm={dm} v="ghost" className="flex-1" onClick={()=>setMachItemSh(null)}>Cancel</Btn>
                <Btn dm={dm} v="success" className="flex-1" onClick={saveMachItem}>Save</Btn>
              </div>
            </Sheet>
          </>;
        })()}

        {/* ═══════════════════════════════════════════════════════
            VEHICLES — Van / Fleet Management
        ═══════════════════════════════════════════════════════ */}
