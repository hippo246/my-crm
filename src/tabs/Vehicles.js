/* eslint-disable */
// TAB: Vehicles
// This file contains the Vehicles tab JSX, extracted from App.js

        {tab==="Vehicles"&&(()=>{
          const tStr=today();
          const fLogs=(vehLogs||[]).filter(l=>!vehSearch||l.vehicleName.toLowerCase().includes(vehSearch.toLowerCase())||(l.driver||"").toLowerCase().includes(vehSearch.toLowerCase())||(l.destination||"").toLowerCase().includes(vehSearch.toLowerCase())).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
          const totalFuel=(vehLogs||[]).reduce((s,l)=>s+(l.fuelCost||0),0);
          const totalMaint=(vehLogs||[]).reduce((s,l)=>s+(l.maintenanceCost||0),0);
          const totalKms=(vehLogs||[]).reduce((s,l)=>s+(l.kms||0),0);
          return <>
            <SectionHeader dm={dm} title="Vehicles" sub="Trip logs, fuel tracking and fleet management"
              cta={(isAdmin||isFactory)&&<button onClick={()=>{setVehF({vehicleId:"",vehicleName:"",date:today(),type:(settings?.vehicleLogTypes||["Trip"])[0],kms:"",odometerStart:"",odometerEnd:"",driver:"",destination:"",routeStops:"",fuelCost:"",fuelLiters:"",fuelType:(settings?.vehicleFuelTypes||["Petrol"])[0],tollCost:"",maintenanceCost:"",nextServiceDue:"",priority:"Normal",notes:"",status:(settings?.vehicleStatuses||["OK"])[0]});setVehSh("add");}}
                style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:12,padding:"11px 20px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:7,boxShadow:"0 2px 8px rgba(37,99,235,0.3)"}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Log Trip
              </button>}/>
            <div className="crm-grid-4" style={{marginBottom:8}}>
              {[
                {label:"Vehicles",val:(vehList||[]).length,color:"#3b82f6"},
                {label:"Total Km",val:totalKms.toLocaleString("en-IN"),color:"#8b5cf6"},
                {label:"Fuel Cost",val:inr(totalFuel),color:"#f59e0b"},
                {label:"Maintenance",val:inr(totalMaint),color:"#ef4444"},
              ].map(s=>(
                <div key={s.label} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"14px 16px"}}>
                  <p style={{color:s.color,fontWeight:900,fontSize:s.val.toString().length>6?17:22,lineHeight:1}}>{s.val}</p>
                  <p style={{color:t.sub,fontSize:10,marginTop:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em"}}>{s.label}</p>
                </div>
              ))}
            </div>
            {/* Sub-tabs */}
            <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,display:"flex",overflow:"hidden",marginBottom:4}}>
              {[["log","📋","Trip Log"],["fleet","🚐","Fleet"]].map(([k,icon,lbl])=>(
                <button key={k} onClick={()=>setVehSubTab(k)} style={{flex:1,padding:"11px 8px",fontSize:13,fontWeight:vehSubTab===k?700:500,background:vehSubTab===k?t.accent:"transparent",color:vehSubTab===k?t.accentFg:t.sub,border:"none",cursor:"pointer",transition:"all 0.15s",display:"flex",alignItems:"center",justifyContent:"center",gap:5,overflow:"hidden"}}><span style={{flexShrink:0}}>{icon}</span><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{lbl}</span></button>
              ))}
            </div>
            {vehSubTab==="log"&&<>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <input value={vehSearch} onChange={e=>setVehSearch(e.target.value)} placeholder="Search vehicle, driver…" style={{flex:1,minWidth:160,background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:10,padding:"9px 12px",fontSize:14,outline:"none"}}/>
                
              </div>
              {fLogs.length===0?<div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"36px 20px",textAlign:"center"}}><p style={{fontSize:32,marginBottom:8}}>🚐</p><p style={{color:t.sub,fontSize:14,fontWeight:600}}>No vehicle logs yet</p></div>
              :fLogs.map(l=>{
                const tc=l.type==="Maintenance"?"#f59e0b":l.type==="Breakdown"?"#ef4444":l.type==="Fuel Fill"?"#10b981":"#3b82f6";
                const prioColor=l.priority==="Critical"?"#ef4444":l.priority==="Urgent"?"#f59e0b":null;
                const totalCostL=(l.fuelCost||0)+(l.maintenanceCost||0)+(l.tollCost||0);
                return <div key={l.id} style={{background:t.card,border:`1.5px solid ${prioColor?prioColor+"40":tc+"25"}`,borderRadius:14,padding:"14px 16px"}} className="crm-list-item">
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                    <div style={{flex:1,minWidth:0}}>
                      {/* Row 1: vehicle + badges */}
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                        <p style={{color:t.text,fontWeight:700,fontSize:14}}>{l.vehicleName}</p>
                        <span style={{background:tc+"20",color:tc,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{l.type}</span>
                        {l.status&&l.status!=="OK"&&<span style={{background:"#ef444420",color:"#ef4444",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{l.status}</span>}
                        {prioColor&&<span style={{background:prioColor+"20",color:prioColor,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{l.priority==="Critical"?"🔴":"🟡"} {l.priority}</span>}
                        {l.fuelType&&<span style={{background:"#10b98120",color:"#10b981",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:600}}>⛽ {l.fuelType}</span>}
                      </div>
                      {/* Row 2: date + driver + destination */}
                      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:2}}>
                        <span style={{color:t.sub,fontSize:11}}>📅 {l.date}</span>
                        {l.driver&&<span style={{color:"#3b82f6",fontSize:11,fontWeight:600}}>👤 {l.driver}</span>}
                        {l.destination&&<span style={{color:t.sub,fontSize:11}}>📍 {l.destination}</span>}
                        {l.kms>0&&<span style={{color:"#8b5cf6",fontSize:11,fontWeight:700}}>📏 {l.kms} km</span>}
                      </div>
                      {/* Row 3: odometer + route */}
                      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:2}}>
                        {l.odometerStart>0&&<span style={{color:t.sub,fontSize:11}}>Start: {l.odometerStart} km</span>}
                        {l.odometerEnd>0&&<span style={{color:t.sub,fontSize:11}}>End: {l.odometerEnd} km</span>}
                        {l.routeStops&&<span style={{color:t.sub,fontSize:11}}>🗺 {l.routeStops}</span>}
                      </div>
                      {/* Row 4: costs */}
                      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                        {l.fuelLiters>0&&<span style={{color:"#10b981",fontSize:11,fontWeight:600}}>⛽ {l.fuelLiters}L</span>}
                        {l.fuelCost>0&&<span style={{color:"#f59e0b",fontSize:11,fontWeight:600}}>⛽ {inr(l.fuelCost)}</span>}
                        {l.maintenanceCost>0&&<span style={{color:"#ef4444",fontSize:11,fontWeight:600}}>🔧 {inr(l.maintenanceCost)}</span>}
                        {l.tollCost>0&&<span style={{color:t.sub,fontSize:11}}>🛣 {inr(l.tollCost)}</span>}
                        {totalCostL>0&&<span style={{color:"#ef4444",fontSize:11,fontWeight:700}}>Total: {inr(totalCostL)}</span>}
                        {l.nextServiceDue&&<span style={{color:l.nextServiceDue<tStr?"#ef4444":"#10b981",fontSize:11,fontWeight:600}}>📆 Next: {l.nextServiceDue}</span>}
                      </div>
                      {l.notes&&<p style={{color:t.sub,fontSize:11,marginTop:3}}>📝 {l.notes}</p>}
                    </div>
                    {(isAdmin||isFactory)&&<div style={{display:"flex",gap:8,flexShrink:0}}>
                      <button onClick={()=>{setVehF({...l,fuelCost:l.fuelCost?.toString()||"",maintenanceCost:l.maintenanceCost?.toString()||"",kms:l.kms?.toString()||""});setVehSh(l);}} style={{background:t.inp,border:`1px solid ${t.border}`,color:t.sub,borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Edit</button>
                      <button onClick={()=>delVeh(l)} style={{background:"#ef444410",border:"1px solid #ef444430",color:"#ef4444",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Del</button>
                    </div>}
                  </div>
                </div>;
              })}
            </>}
            {vehSubTab==="fleet"&&<>
              {isAdmin&&<Btn dm={dm} v="primary" size="sm" onClick={()=>{setVehItemF({name:"",regNo:"",type:"Van",notes:""});setVehItemSh("add");}}>+ Add Vehicle</Btn>}
              {(vehList||[]).length===0?<div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"36px 20px",textAlign:"center"}}><p style={{color:t.sub,fontSize:14}}>No vehicles added yet</p></div>
              :(vehList||[]).map(v=>{
                const logs=(vehLogs||[]).filter(l=>l.vehicleName===v.name);
                const totalV=logs.reduce((s,l)=>s+(l.kms||0),0);
                const totalFuelV=logs.reduce((s,l)=>s+(l.fuelCost||0),0);
                const lastLog=logs.sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
                const insuranceExpired=v.insuranceExpiry&&v.insuranceExpiry<tStr;
                const fitnessExpired=v.fitnessExpiry&&v.fitnessExpiry<tStr;
                const anyAlert=insuranceExpired||fitnessExpired;
                return <div key={v.id} style={{background:t.card,border:`1.5px solid ${anyAlert?"#ef444440":t.border}`,borderRadius:14,padding:"14px 16px"}} className="crm-list-item">
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                        <p style={{color:t.text,fontWeight:700,fontSize:14}}>{v.name}</p>
                        {v.type&&<span style={{background:"#3b82f620",color:"#3b82f6",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:600}}>{v.type}</span>}
                        {v.color&&<span style={{background:t.inp,color:t.sub,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:600}}>🎨 {v.color}</span>}
                        {insuranceExpired&&<span style={{background:"#ef444420",color:"#ef4444",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>⚠️ Insurance expired</span>}
                        {fitnessExpired&&<span style={{background:"#f59e0b20",color:"#f59e0b",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>⚠️ Fitness expired</span>}
                      </div>
                      <div style={{display:"flex",gap:10,marginBottom:2,flexWrap:"wrap"}}>
                        {v.regNo&&<span style={{color:t.sub,fontSize:11}}>🔖 {v.regNo}</span>}
                        {v.year&&<span style={{color:t.sub,fontSize:11}}>📅 {v.year}</span>}
                        {v.assignedDriver&&<span style={{color:"#3b82f6",fontSize:11,fontWeight:600}}>👤 {v.assignedDriver}</span>}
                        {v.capacity&&<span style={{color:t.sub,fontSize:11}}>📦 {v.capacity}</span>}
                      </div>
                      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                        <span style={{color:t.sub,fontSize:11}}>Trips: {logs.filter(l=>l.type==="Trip").length}</span>
                        <span style={{color:"#8b5cf6",fontSize:11,fontWeight:600}}>Total km: {totalV.toLocaleString("en-IN")}</span>
                        {totalFuelV>0&&<span style={{color:"#f59e0b",fontSize:11,fontWeight:600}}>⛽ {inr(totalFuelV)}</span>}
                        {lastLog&&<span style={{color:t.sub,fontSize:11}}>Last: {lastLog.date}</span>}
                        {v.insuranceExpiry&&!insuranceExpired&&<span style={{color:"#10b981",fontSize:11}}>🛡 Ins. until {v.insuranceExpiry}</span>}
                        {v.fitnessExpiry&&!fitnessExpired&&<span style={{color:"#10b981",fontSize:11}}>✅ Fit. until {v.fitnessExpiry}</span>}
                      </div>
                      {v.notes&&<p style={{color:t.sub,fontSize:11,marginTop:3}}>📝 {v.notes}</p>}
                    </div>
                    {isAdmin&&<div style={{display:"flex",gap:8,flexShrink:0}}>
                      <button onClick={()=>{setVehItemF({...v});setVehItemSh(v);}} style={{background:t.inp,border:`1px solid ${t.border}`,color:t.sub,borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Edit</button>
                      <button onClick={()=>ask(`Remove "${v.name}"?`,()=>{setVehList(p=>safeArr(p).filter(x=>x.id!==v.id));notify("Removed");})} style={{background:"#ef444410",border:"1px solid #ef444430",color:"#ef4444",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Del</button>
                    </div>}
                  </div>
                </div>;
              })}
            </>}
            {/* Vehicle log sheet */}
            <Sheet dm={dm} open={!!vehSh} onClose={()=>setVehSh(null)} title={vehSh==="add"?"🚐 Log Trip / Event":"✏️ Edit Log"}>
              {/* Vehicle selector */}
              <Sel dm={dm} label="Vehicle *" value={vehF.vehicleName} onChange={e=>setVehF(f=>({...f,vehicleName:e.target.value}))}>
                <option value="">Select vehicle…</option>
                {(vehList||[]).map(v=><option key={v.id}>{v.name}</option>)}
                <option value="__custom__">+ Enter manually</option>
              </Sel>
              {vehF.vehicleName==="__custom__"&&<Inp dm={dm} label="Vehicle Name *" value={vehF._customName||""} onChange={e=>setVehF(f=>({...f,_customName:e.target.value,vehicleName:e.target.value}))}/>}

              {/* Date + Type */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
                <Inp dm={dm} label="Date *" type="date" value={vehF.date} onChange={e=>setVehF(f=>({...f,date:e.target.value}))}/>
                <Sel dm={dm} label="Event Type" value={vehF.type} onChange={e=>setVehF(f=>({...f,type:e.target.value}))}>
                  {(settings?.vehicleLogTypes||["Trip","Maintenance","Breakdown","Fuel Fill","Insurance","Other"]).map(x=><option key={x}>{x}</option>)}
                </Sel>
              </div>

              {/* Priority */}
              {settings?.vehicleShowPriority!==false&&<div>
                <p style={{color:t.sub,fontSize:11,fontWeight:700,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>Priority</p>
                <div style={{display:"flex",gap:8}}>
                  {["Normal","Urgent","Critical"].map(p=>(
                    <button key={p} onClick={()=>setVehF(f=>({...f,priority:p}))}
                      style={{flex:1,padding:"8px 0",borderRadius:10,border:`1.5px solid ${vehF.priority===p?(p==="Critical"?"#ef4444":p==="Urgent"?"#f59e0b":"#10b981"):(t.border)}`,background:vehF.priority===p?(p==="Critical"?"#ef444415":p==="Urgent"?"#f59e0b15":"#10b98115"):"transparent",color:vehF.priority===p?(p==="Critical"?"#ef4444":p==="Urgent"?"#f59e0b":"#10b981"):t.sub,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                      {p==="Critical"?"🔴":p==="Urgent"?"🟡":"🟢"} {p}
                    </button>
                  ))}
                </div>
              </div>}

              {/* Driver + Destination */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
                <Inp dm={dm} label={`Driver${settings?.vehicleRequireDriver?" *":""}`} value={vehF.driver} onChange={e=>setVehF(f=>({...f,driver:e.target.value}))} placeholder="Driver name"/>
                <Inp dm={dm} label="Destination / Route" value={vehF.destination} onChange={e=>setVehF(f=>({...f,destination:e.target.value}))} placeholder="Area / route"/>
              </div>

              {/* Route stops */}
              {settings?.vehicleShowRouteStops&&<Inp dm={dm} label="Route Stops" value={vehF.routeStops} onChange={e=>setVehF(f=>({...f,routeStops:e.target.value}))} placeholder="e.g. Mapusa → Panjim → Vasco"/>}

              {/* Odometer */}
              {settings?.vehicleShowOdometer!==false&&<>
                <p style={{color:t.sub,fontSize:11,fontWeight:700,marginTop:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>Odometer Readings</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                  <Inp dm={dm} label="Start (km)" type="number" value={vehF.odometerStart} onChange={e=>setVehF(f=>({...f,odometerStart:e.target.value}))} placeholder="0"/>
                  <Inp dm={dm} label="End (km)" type="number" value={vehF.odometerEnd} onChange={e=>setVehF(f=>({...f,odometerEnd:e.target.value}))} placeholder="0"/>
                  <div>
                    <p style={{color:t.sub,fontSize:11,fontWeight:700,marginBottom:4}}>KM DRIVEN</p>
                    <div style={{background:t.inp,border:`1.5px solid ${t.inpB}`,borderRadius:10,padding:"9px 12px",fontSize:14,color:t.sub,fontWeight:700}}>
                      {vehF.odometerEnd&&vehF.odometerStart?Math.max(0,(+vehF.odometerEnd||0)-(+vehF.odometerStart||0)):vehF.kms||"—"}
                    </div>
                  </div>
                </div>
                <Inp dm={dm} label="Manual KM Override" type="number" value={vehF.kms} onChange={e=>setVehF(f=>({...f,kms:e.target.value}))} placeholder="Leave blank if using odometer"/>
              </>}

              {/* Fuel section */}
              {(settings?.vehicleShowFuelCost!==false||settings?.vehicleShowFuelLiters!==false||settings?.vehicleShowFuelType!==false)&&<>
                <p style={{color:t.sub,fontSize:11,fontWeight:700,marginTop:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>⛽ Fuel Details</p>
                <div style={{display:"grid",gridTemplateColumns:`${settings?.vehicleShowFuelType!==false?"1fr ":""}${settings?.vehicleShowFuelLiters!==false?"1fr ":""}${settings?.vehicleShowFuelCost!==false?"1fr":""}`.trim(),gap:8}}>
                  {settings?.vehicleShowFuelType!==false&&<Sel dm={dm} label="Fuel Type" value={vehF.fuelType} onChange={e=>setVehF(f=>({...f,fuelType:e.target.value}))}>
                    <option value="">Select…</option>
                    {(settings?.vehicleFuelTypes||["Petrol","Diesel","CNG","Electric","LPG"]).map(x=><option key={x}>{x}</option>)}
                  </Sel>}
                  {settings?.vehicleShowFuelLiters!==false&&<Inp dm={dm} label="Litres" type="number" value={vehF.fuelLiters} onChange={e=>setVehF(f=>({...f,fuelLiters:e.target.value}))} placeholder="0"/>}
                  {settings?.vehicleShowFuelCost!==false&&<Inp dm={dm} label="Fuel Cost ₹" type="number" value={vehF.fuelCost} onChange={e=>setVehF(f=>({...f,fuelCost:e.target.value}))} placeholder="0"/>}
                </div>
              </>}

              {/* Other costs */}
              <div style={{display:"grid",gridTemplateColumns:`${settings?.vehicleShowMaintCost!==false?"1fr ":""}${settings?.vehicleShowTollCost?"1fr":""}`.trim()||"1fr",gap:8}}>
                {settings?.vehicleShowMaintCost!==false&&<Inp dm={dm} label="Maintenance Cost ₹" type="number" value={vehF.maintenanceCost} onChange={e=>setVehF(f=>({...f,maintenanceCost:e.target.value}))} placeholder="0"/>}
                {settings?.vehicleShowTollCost&&<Inp dm={dm} label="Toll / Misc ₹" type="number" value={vehF.tollCost} onChange={e=>setVehF(f=>({...f,tollCost:e.target.value}))} placeholder="0"/>}
              </div>

              {/* Next service */}
              {settings?.vehicleShowNextService!==false&&<Inp dm={dm} label="Next Service Due" type="date" value={vehF.nextServiceDue} onChange={e=>setVehF(f=>({...f,nextServiceDue:e.target.value}))}/>}

              {/* Status */}
              <Sel dm={dm} label="Vehicle Status" value={vehF.status} onChange={e=>setVehF(f=>({...f,status:e.target.value}))}>
                {(settings?.vehicleStatuses||["OK","Needs Service","Offline","Under Repair"]).map(x=><option key={x}>{x}</option>)}
              </Sel>

              <Inp dm={dm} label="Notes" value={vehF.notes} onChange={e=>setVehF(f=>({...f,notes:e.target.value}))} placeholder="Any additional notes"/>
              <div style={{display:"flex",gap:8}}>
                <Btn dm={dm} v="ghost" className="flex-1" onClick={()=>setVehSh(null)}>Cancel</Btn>
                <Btn dm={dm} v="success" className="flex-1" onClick={saveVehFixed}>Save</Btn>
              </div>
            </Sheet>
            {/* Vehicle fleet sheet */}
            <Sheet dm={dm} open={!!vehItemSh} onClose={()=>setVehItemSh(null)} title={vehItemSh==="add"?"➕ Add Vehicle":"✏️ Edit Vehicle"}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
                <Inp dm={dm} label="Vehicle Name *" value={vehItemF.name} onChange={e=>setVehItemF(f=>({...f,name:e.target.value}))} placeholder="e.g. Delivery Van 1"/>
                <Inp dm={dm} label="Reg. Number" value={vehItemF.regNo} onChange={e=>setVehItemF(f=>({...f,regNo:e.target.value}))} placeholder="e.g. GA 01 AB 1234"/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
                <Sel dm={dm} label="Type" value={vehItemF.type} onChange={e=>setVehItemF(f=>({...f,type:e.target.value}))}>
                  {(settings?.vehicleTypes||["Van","Car","Bike","Truck","Auto","Other"]).map(x=><option key={x}>{x}</option>)}
                </Sel>
                <Inp dm={dm} label="Color" value={vehItemF.color} onChange={e=>setVehItemF(f=>({...f,color:e.target.value}))} placeholder="e.g. White"/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
                <Inp dm={dm} label="Year" type="number" value={vehItemF.year} onChange={e=>setVehItemF(f=>({...f,year:e.target.value}))} placeholder="e.g. 2021"/>
                <Inp dm={dm} label="Capacity (kg/seats)" value={vehItemF.capacity} onChange={e=>setVehItemF(f=>({...f,capacity:e.target.value}))} placeholder="e.g. 500kg"/>
              </div>
              <Inp dm={dm} label="Assigned Driver" value={vehItemF.assignedDriver} onChange={e=>setVehItemF(f=>({...f,assignedDriver:e.target.value}))} placeholder="Default driver name"/>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
                <Inp dm={dm} label="Insurance Expiry" type="date" value={vehItemF.insuranceExpiry} onChange={e=>setVehItemF(f=>({...f,insuranceExpiry:e.target.value}))}/>
                <Inp dm={dm} label="Fitness Expiry" type="date" value={vehItemF.fitnessExpiry} onChange={e=>setVehItemF(f=>({...f,fitnessExpiry:e.target.value}))}/>
              </div>
              <Inp dm={dm} label="Notes" value={vehItemF.notes} onChange={e=>setVehItemF(f=>({...f,notes:e.target.value}))} placeholder="Model, year, additional info"/>
              <div style={{display:"flex",gap:8}}>
                <Btn dm={dm} v="ghost" className="flex-1" onClick={()=>setVehItemSh(null)}>Cancel</Btn>
                <Btn dm={dm} v="success" className="flex-1" onClick={saveVehItem}>Save</Btn>
              </div>
            </Sheet>
          </>;
        })()}

        {/* GPS */}
