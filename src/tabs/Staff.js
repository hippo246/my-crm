/* eslint-disable */
// TAB: Staff
// This file contains the Staff tab JSX, extracted from App.js

        {tab==="Staff"&&(()=>{
          const shifts=settings?.shifts||["Morning","Afternoon","Night"];
          const tStr=today();
          const wStr=(()=>{const d=new Date(tStr);d.setDate(d.getDate()-6);return d.toISOString().slice(0,10);})();
          const presentToday=(staffLogs||[]).filter(l=>l.date===tStr&&l.status==="Present").length;
          const absentToday=(staffLogs||[]).filter(l=>l.date===tStr&&l.status==="Absent").length;
          const fLogs=(staffLogs||[]).filter(l=>{
            const mS=!staffSearch||l.staffName.toLowerCase().includes(staffSearch.toLowerCase());
            const mD=staffDateFilter==="all"||(staffDateFilter==="today"&&l.date===tStr)||(staffDateFilter==="week"&&l.date>=wStr&&l.date<=tStr);
            return mS&&mD;
          }).sort((a,b)=>(b.date||"").localeCompare(a.date||"")||(b.createdAt||"").localeCompare(a.createdAt||""));
          return <>
            <SectionHeader dm={dm} title="Staff" sub="Attendance tracking and staff roster"
              cta={(isAdmin||isFactory)&&<button onClick={()=>{setStaffF({staffId:"",staffName:"",date:today(),shift:settings?.staffDefaultShift||shifts[0]||"Morning",status:(settings?.staffStatuses||["Present"])[0],inTime:"",outTime:"",breakMins:"",department:"",task:"",overtimeReason:"",notes:"",temperature:"",loggedBy:displayName});setStaffSh("add");}}
                style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:12,padding:"11px 20px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:7,boxShadow:"0 2px 8px rgba(37,99,235,0.3)"}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Log Attendance
              </button>}/>
            <div className="crm-grid-4" style={{marginBottom:8}}>
              {[
                {label:"Total Staff",val:(staffList||[]).length,color:"#3b82f6"},
                {label:"Present Today",val:presentToday,color:"#10b981"},
                {label:"Absent Today",val:absentToday,color:"#ef4444"},
                {label:"Total Logs",val:(staffLogs||[]).length,color:"#8b5cf6"},
              ].map(s=>(
                <div key={s.label} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"14px 16px"}}>
                  <p style={{color:s.color,fontWeight:900,fontSize:22,lineHeight:1}}>{s.val}</p>
                  <p style={{color:t.sub,fontSize:10,marginTop:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em"}}>{s.label}</p>
                </div>
              ))}
            </div>
            {/* Sub-tabs */}
            <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,display:"flex",overflow:"hidden",marginBottom:4}}>
              {[["log","📋","Attendance Log"],["roster","👥","Staff Roster"]].map(([k,icon,lbl])=>(
                <button key={k} onClick={()=>setStaffSubTab(k)} style={{flex:1,padding:"11px 8px",fontSize:13,fontWeight:staffSubTab===k?700:500,background:staffSubTab===k?t.accent:"transparent",color:staffSubTab===k?t.accentFg:t.sub,border:"none",cursor:"pointer",transition:"all 0.15s",display:"flex",alignItems:"center",justifyContent:"center",gap:5,overflow:"hidden"}}><span style={{flexShrink:0}}>{icon}</span><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lbl}</span></button>
              ))}
            </div>
            {staffSubTab==="log"&&<>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <input value={staffSearch} onChange={e=>setStaffSearch(e.target.value)} placeholder="Search staff…" style={{flex:1,minWidth:160,background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:10,padding:"9px 12px",fontSize:14,outline:"none"}}/>
                <select value={staffDateFilter} onChange={e=>setStaffDateFilter(e.target.value)} style={{background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:10,padding:"9px 12px",fontSize:13,outline:"none",WebkitAppearance:"none"}}>
                  {[["all","All time"],["today","Today"],["week","This week"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
                
              </div>
              {fLogs.length===0?<div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"36px 20px",textAlign:"center"}}><p style={{fontSize:32,marginBottom:8}}>🧑‍🍳</p><p style={{color:t.sub,fontSize:14,fontWeight:600}}>No attendance records yet</p></div>
              :fLogs.map(l=>{
                const sc=l.status==="Present"?"#10b981":l.status==="Absent"?"#ef4444":l.status==="Late"?"#f59e0b":l.status==="On Leave"?"#8b5cf6":"#3b82f6";
                const hoursInfo=(()=>{
                  if(!l.inTime||!l.outTime)return null;
                  const _ip=l.inTime.split(":"),_op=l.outTime.split(":");
                  if(_ip.length<2||_op.length<2)return null;
                  const [ih,im]=_ip.map(Number);
                  const [oh,om]=_op.map(Number);
                  if(isNaN(ih)||isNaN(im)||isNaN(oh)||isNaN(om))return null;
                  const totalMins=(oh*60+om)-(ih*60+im)-(+l.breakMins||0);
                  if(totalMins<=0)return null;
                  const hrs=totalMins/60;
                  const threshold=settings?.staffOvertimeThresholdHrs||9;
                  const isOT=hrs>threshold;
                  return {hrs,isOT,otHrs:isOT?(hrs-threshold).toFixed(1):0,display:`${Math.floor(hrs)}h ${Math.round((hrs%1)*60)}m`};
                })();
                return <div key={l.id} style={{background:t.card,border:`1.5px solid ${sc}30`,borderRadius:14,padding:"14px 16px"}} className="crm-list-item">
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                    <div style={{flex:1,minWidth:0}}>
                      {/* Row 1: name + badges */}
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                        <p style={{color:t.text,fontWeight:700,fontSize:14}}>{l.staffName}</p>
                        <span style={{background:sc+"20",color:sc,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{l.status}</span>
                        {l.shift&&<span style={{background:"#3b82f620",color:"#3b82f6",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:600}}>{l.shift}</span>}
                        {hoursInfo?.isOT&&<span style={{background:"#f59e0b20",color:"#f59e0b",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>⚡ OT +{hoursInfo.otHrs}h</span>}
                        {l.department&&<span style={{background:"#6366f120",color:"#6366f1",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:600}}>{l.department}</span>}
                      </div>
                      {/* Row 2: time + hours */}
                      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:2}}>
                        <span style={{color:t.sub,fontSize:11}}>📅 {l.date}</span>
                        {l.inTime&&<span style={{color:"#10b981",fontSize:11,fontWeight:600}}>🕐 {l.inTime}</span>}
                        {l.outTime&&<span style={{color:"#ef4444",fontSize:11,fontWeight:600}}>🕓 {l.outTime}</span>}
                        {hoursInfo&&<span style={{color:hoursInfo.isOT?"#f59e0b":"#10b981",fontSize:11,fontWeight:700}}>⏱ {hoursInfo.display}</span>}
                        {l.breakMins>0&&<span style={{color:t.sub,fontSize:11}}>☕ {l.breakMins}m break</span>}
                      </div>
                      {/* Row 3: extra info */}
                      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                        {l.task&&<span style={{color:t.sub,fontSize:11}}>📋 {l.task}</span>}
                        {l.overtimeReason&&<span style={{color:"#f59e0b",fontSize:11}}>📌 {l.overtimeReason}</span>}
                        {l.loggedBy&&<span style={{color:t.sub,fontSize:11}}>👤 {l.loggedBy}</span>}
                        {l.notes&&<span style={{color:t.sub,fontSize:11}}>📝 {l.notes}</span>}
                        {l.temperature&&<span style={{color:t.sub,fontSize:11}}>🌡 {l.temperature}°C</span>}
                      </div>
                    </div>
                    {(isAdmin||isFactory)&&<div style={{display:"flex",gap:6,flexShrink:0}}>
                      <button onClick={()=>{setStaffF({...l});setStaffSh(l);}} style={{background:t.inp,border:`1px solid ${t.border}`,color:t.sub,borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Edit</button>
                      <button onClick={()=>delStaff(l)} style={{background:"#ef444410",border:"1px solid #ef444430",color:"#ef4444",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Del</button>
                    </div>}
                  </div>
                </div>;
              })}
            </>}
            {staffSubTab==="roster"&&<>
              {isAdmin&&<Btn dm={dm} v="primary" size="sm" onClick={()=>{setStaffMemberF({name:"",role:"",phone:"",department:"",employmentType:"Full-time",salaryType:"",joinDate:"",emergencyContact:"",emergencyPhone:"",notes:""});setStaffMemberSh("add");}}>+ Add Staff</Btn>}
              {(staffList||[]).length===0?<div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"36px 20px",textAlign:"center"}}><p style={{color:t.sub,fontSize:14}}>No staff members added yet</p></div>
              :(staffList||[]).map(m=>{
                const todayLog=(staffLogs||[]).filter(l=>l.staffName===m.name&&l.date===today()).sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""))[0];
                const statusColor=todayLog?.status==="Present"?"#10b981":todayLog?.status==="Absent"?"#ef4444":todayLog?.status==="Late"?"#f59e0b":null;
                const totalLogs=(staffLogs||[]).filter(l=>l.staffName===m.name).length;
                return <div key={m.id} style={{background:t.card,border:`1.5px solid ${statusColor?statusColor+"30":t.border}`,borderRadius:14,padding:"14px 16px"}} className="crm-list-item">
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                        <p style={{color:t.text,fontWeight:700,fontSize:14}}>{m.name}</p>
                        {m.employmentType&&<span style={{background:"#6366f120",color:"#6366f1",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:600}}>{m.employmentType}</span>}
                        {todayLog?<span style={{background:statusColor+"20",color:statusColor,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{todayLog.status} today</span>:<span style={{background:t.inp,color:t.sub,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:600}}>Not logged today</span>}
                      </div>
                      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:2}}>
                        {m.role&&<span style={{color:t.sub,fontSize:11}}>🔧 {m.role}</span>}
                        {m.department&&<span style={{color:"#8b5cf6",fontSize:11,fontWeight:600}}>🏢 {m.department}</span>}
                        {m.phone&&<span style={{color:t.sub,fontSize:11}}>📞 {m.phone}</span>}
                      </div>
                      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                        {m.joinDate&&<span style={{color:t.sub,fontSize:11}}>📅 Joined {m.joinDate}</span>}
                        {todayLog?.inTime&&<span style={{color:"#10b981",fontSize:11,fontWeight:600}}>🕐 In: {todayLog.inTime}</span>}
                        {todayLog?.outTime&&<span style={{color:"#ef4444",fontSize:11,fontWeight:600}}>🕓 Out: {todayLog.outTime}</span>}
                        <span style={{color:t.sub,fontSize:11}}>{totalLogs} log{totalLogs!==1?"s":""}</span>
                        {m.emergencyContact&&<span style={{color:t.sub,fontSize:11}}>🆘 {m.emergencyContact}</span>}
                      </div>
                    </div>
                    {isAdmin&&<div style={{display:"flex",gap:6,flexShrink:0}}>
                      <button onClick={()=>{setStaffMemberF({...m});setStaffMemberSh(m);}} style={{background:t.inp,border:`1px solid ${t.border}`,color:t.sub,borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Edit</button>
                      <button onClick={()=>ask(`Remove "${m.name}" from roster?`,()=>{setStaffList(p=>safeArr(p).filter(x=>x.id!==m.id));notify("Removed");})} style={{background:"#ef444410",border:"1px solid #ef444430",color:"#ef4444",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Del</button>
                    </div>}
                  </div>
                </div>;
              })}
            </>}
            {/* Attendance log sheet */}
            <Sheet dm={dm} open={!!staffSh} onClose={()=>setStaffSh(null)} title={staffSh==="add"?"🧑‍🍳 Log Attendance":"✏️ Edit Attendance"}>
              {/* Staff member selector */}
              <Sel dm={dm} label="Staff Member *" value={staffF.staffName} onChange={e=>{const m=(staffList||[]).find(x=>x.name===e.target.value);setStaffF(f=>({...f,staffName:e.target.value,staffId:m?.id||"",department:m?.department||f.department}));}}>
                <option value="">Select staff…</option>
                {(staffList||[]).map(m=><option key={m.id}>{m.name}</option>)}
                {settings?.staffAllowCustomName!==false&&<option value="__custom__">+ Enter name manually</option>}
              </Sel>
              {staffF.staffName==="__custom__"&&<Inp dm={dm} label="Staff Name *" value={staffF._customName||""} onChange={e=>setStaffF(f=>({...f,_customName:e.target.value,staffName:e.target.value}))} placeholder="Enter name"/>}

              {/* Date + Shift */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
                <Inp dm={dm} label="Date *" type="date" value={staffF.date} onChange={e=>setStaffF(f=>({...f,date:e.target.value}))}/>
                <Sel dm={dm} label="Shift" value={staffF.shift} onChange={e=>setStaffF(f=>({...f,shift:e.target.value}))}>
                  {shifts.map(s=><option key={s}>{s}</option>)}
                </Sel>
              </div>

              {/* Status */}
              <div>
                <p style={{color:t.sub,fontSize:11,fontWeight:700,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>Attendance Status</p>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {(settings?.staffStatuses||["Present","Absent","Half Day","Late","On Leave"]).map(st=>{
                    const sc=st==="Present"?"#10b981":st==="Absent"?"#ef4444":st==="Late"?"#f59e0b":st==="On Leave"?"#8b5cf6":"#3b82f6";
                    return <button key={st} onClick={()=>setStaffF(f=>({...f,status:st}))}
                      style={{padding:"7px 14px",borderRadius:20,border:`1.5px solid ${staffF.status===st?sc:t.border}`,background:staffF.status===st?sc+"20":"transparent",color:staffF.status===st?sc:t.sub,fontSize:12,fontWeight:700,cursor:"pointer",transition:"all 0.12s"}}>
                      {st}
                    </button>;
                  })}
                </div>
              </div>

              {/* In/Out time */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
                <Inp dm={dm} label={`In Time${settings?.staffRequireInOutTime?" *":""}`} type="time" value={staffF.inTime} onChange={e=>setStaffF(f=>({...f,inTime:e.target.value}))}/>
                <Inp dm={dm} label={`Out Time${settings?.staffRequireInOutTime?" *":""}`} type="time" value={staffF.outTime} onChange={e=>setStaffF(f=>({...f,outTime:e.target.value}))}/>
              </div>

              {/* Computed hours display */}
              {staffF.inTime&&staffF.outTime&&(()=>{
                const _inParts=staffF.inTime.split(":");
                const _outParts=staffF.outTime.split(":");
                if(_inParts.length<2||_outParts.length<2) return null;
                const [ih,im]=_inParts.map(Number);
                const [oh,om]=_outParts.map(Number);
                if(isNaN(ih)||isNaN(im)||isNaN(oh)||isNaN(om)) return null;
                const totalMins=(oh*60+om)-(ih*60+im)-(+staffF.breakMins||0);
                const hrs=totalMins/60;
                const threshold=settings?.staffOvertimeThresholdHrs||9;
                if(totalMins<=0) return null;
                return <div style={{background:hrs>threshold?"#f59e0b15":"#10b98115",border:`1px solid ${hrs>threshold?"#f59e0b40":"#10b98140"}`,borderRadius:10,padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{color:t.sub,fontSize:12,fontWeight:600}}>Total Hours</span>
                  <span style={{color:hrs>threshold?"#f59e0b":"#10b981",fontSize:14,fontWeight:800}}>
                    {Math.floor(hrs)}h {Math.round((hrs%1)*60)}m {hrs>threshold?`⚡ +${(hrs-threshold).toFixed(1)}h OT`:""}
                  </span>
                </div>;
              })()}

              {/* Break duration */}
              {settings?.staffShowBreakDuration&&<Inp dm={dm} label="Break Duration (mins)" type="number" value={staffF.breakMins} onChange={e=>setStaffF(f=>({...f,breakMins:e.target.value}))} placeholder="e.g. 30"/>}

              {/* Department */}
              {settings?.staffShowDepartment!==false&&<Sel dm={dm} label="Department" value={staffF.department} onChange={e=>setStaffF(f=>({...f,department:e.target.value}))}>
                <option value="">Select department…</option>
                {(settings?.staffDepartments||["Production","Delivery","Packaging","Cleaning","Admin","Other"]).map(d=><option key={d}>{d}</option>)}
              </Sel>}

              {/* Task */}
              {settings?.staffShowTask&&<Inp dm={dm} label="Task / Assignment" value={staffF.task} onChange={e=>setStaffF(f=>({...f,task:e.target.value}))} placeholder="What were they working on?"/>}

              {/* Overtime reason */}
              {settings?.staffShowOvertimeReason&&<Inp dm={dm} label="Overtime Reason" value={staffF.overtimeReason} onChange={e=>setStaffF(f=>({...f,overtimeReason:e.target.value}))} placeholder="Reason for overtime (if any)"/>}

              <Inp dm={dm} label="Notes" value={staffF.notes} onChange={e=>setStaffF(f=>({...f,notes:e.target.value}))} placeholder="Optional notes"/>
              <div style={{display:"flex",gap:8}}>
                <Btn dm={dm} v="ghost" className="flex-1" onClick={()=>setStaffSh(null)}>Cancel</Btn>
                <Btn dm={dm} v="success" className="flex-1" onClick={saveStaff}>Save</Btn>
              </div>
            </Sheet>
            {/* Staff member sheet */}
            <Sheet dm={dm} open={!!staffMemberSh} onClose={()=>setStaffMemberSh(null)} title={staffMemberSh==="add"?"➕ Add Staff Member":"✏️ Edit Staff Member"}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
                <Inp dm={dm} label="Name *" value={staffMemberF.name} onChange={e=>setStaffMemberF(f=>({...f,name:e.target.value}))} placeholder="Full name"/>
                <Sel dm={dm} label="Role / Designation" value={staffMemberF.role} onChange={e=>setStaffMemberF(f=>({...f,role:e.target.value}))}>
                  <option value="">Select…</option>
                  {(settings?.staffRoles||["Roti Maker","Packer","Delivery","Cleaner","Supervisor","Admin"]).map(r=><option key={r}>{r}</option>)}
                  <option value="__other__">Other (type below)</option>
                </Sel>
              </div>
              {staffMemberF.role==="__other__"&&<Inp dm={dm} label="Custom Role" value={staffMemberF._customRole||""} onChange={e=>setStaffMemberF(f=>({...f,_customRole:e.target.value,role:e.target.value}))} placeholder="Enter role"/>}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
                <Sel dm={dm} label="Department" value={staffMemberF.department||""} onChange={e=>setStaffMemberF(f=>({...f,department:e.target.value}))}>
                  <option value="">Select…</option>
                  {(settings?.staffDepartments||["Production","Delivery","Packaging","Cleaning","Admin","Other"]).map(d=><option key={d}>{d}</option>)}
                </Sel>
                <Sel dm={dm} label="Employment Type" value={staffMemberF.employmentType||"Full-time"} onChange={e=>setStaffMemberF(f=>({...f,employmentType:e.target.value}))}>
                  {(settings?.staffEmploymentTypes||["Full-time","Part-time","Contract","Daily Wage"]).map(x=><option key={x}>{x}</option>)}
                </Sel>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
                <Inp dm={dm} label="Phone" value={staffMemberF.phone} onChange={e=>setStaffMemberF(f=>({...f,phone:e.target.value}))} placeholder="Mobile number"/>
                <Inp dm={dm} label="Join Date" type="date" value={staffMemberF.joinDate} onChange={e=>setStaffMemberF(f=>({...f,joinDate:e.target.value}))}/>
              </div>
              <p style={{color:t.sub,fontSize:11,fontWeight:700,marginTop:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>Emergency Contact</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
                <Inp dm={dm} label="Contact Name" value={staffMemberF.emergencyContact} onChange={e=>setStaffMemberF(f=>({...f,emergencyContact:e.target.value}))} placeholder="e.g. Spouse / Parent"/>
                <Inp dm={dm} label="Contact Phone" value={staffMemberF.emergencyPhone} onChange={e=>setStaffMemberF(f=>({...f,emergencyPhone:e.target.value}))} placeholder="Emergency number"/>
              </div>
              {settings?.staffShowSalaryType&&<Sel dm={dm} label="Salary Type" value={staffMemberF.salaryType||""} onChange={e=>setStaffMemberF(f=>({...f,salaryType:e.target.value}))}>
                <option value="">Select…</option>
                {(settings?.staffSalaryTypes||["Monthly","Weekly","Daily","Per Hour","Per Piece"]).map(x=><option key={x}>{x}</option>)}
              </Sel>}
              <Inp dm={dm} label="Notes" value={staffMemberF.notes||""} onChange={e=>setStaffMemberF(f=>({...f,notes:e.target.value}))} placeholder="Additional notes about this staff member"/>
              <div style={{display:"flex",gap:8}}>
                <Btn dm={dm} v="ghost" className="flex-1" onClick={()=>setStaffMemberSh(null)}>Cancel</Btn>
                <Btn dm={dm} v="success" className="flex-1" onClick={saveStaffMember}>Save</Btn>
              </div>
            </Sheet>
          </>;
        })()}

        {/* ═══════════════════════════════════════════════════════
            MACHINES — Maintenance Log
        ═══════════════════════════════════════════════════════ */}
