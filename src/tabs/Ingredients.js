/* eslint-disable */
// TAB: Ingredients
// This file contains the Ingredients tab JSX, extracted from App.js

        {tab==="Ingredients"&&(()=>{
          const shifts=settings?.shifts||["Morning","Afternoon","Night"];
          const tStr=today();
          const yStr=(()=>{const d=new Date(tStr);d.setDate(d.getDate()-1);return d.toISOString().slice(0,10);})();
          const wStr=(()=>{const d=new Date(tStr);d.setDate(d.getDate()-6);return d.toISOString().slice(0,10);})();
          const fLogs=(ingLogs||[]).filter(l=>{
            const mS=!ingSearch||l.ingredient.toLowerCase().includes(ingSearch.toLowerCase())||(l.notes||"").toLowerCase().includes(ingSearch.toLowerCase());
            const mD=ingDateFilter==="all"||(ingDateFilter==="today"&&l.date===tStr)||(ingDateFilter==="yesterday"&&l.date===yStr)||(ingDateFilter==="week"&&l.date>=wStr&&l.date<=tStr);
            return mS&&mD;
          }).sort((a,b)=>b.createdAt?.localeCompare(a.createdAt||"")||(b.date||"").localeCompare(a.date||""));
          const totalToday=(ingLogs||[]).filter(l=>l.date===tStr).reduce((s,l)=>s+(l.qty||0),0);
          const uniqueIng=[...new Set((ingLogs||[]).map(l=>l.ingredient))].length;
          // Build stock summary: master list minus consumed
          // Key by name for lookup; but protect against duplicate names by merging
          const stockMap={};
          (ingItems||[]).forEach(it=>{
            const key=it.name;
            if(stockMap[key]){stockMap[key].stock=(+stockMap[key].stock||0)+(+it.stock||0);}
            else{stockMap[key]={...it,consumed:0};}
          });
          (ingLogs||[]).forEach(l=>{
            if(stockMap[l.ingredient])stockMap[l.ingredient].consumed+=(l.qty||0);
            else stockMap[l.ingredient]={name:l.ingredient,unit:l.unit||"kg",stock:0,consumed:l.qty||0};
          });
          return <>
            <SectionHeader dm={dm} title="Ingredients" sub="Stock levels and consumption logs"
              cta={isAdmin&&<button onClick={()=>{setIngF({ingredient:"",qty:"",unit:(settings?.supplyUnits||["kg"])[0]||"kg",date:today(),notes:"",loggedBy:displayName});setIngSh("add");}}
                style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:12,padding:"11px 20px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:7,boxShadow:"0 2px 8px rgba(37,99,235,0.3)"}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Log Usage
              </button>}/>
            {/* Stats */}
            <div className="crm-grid-4" style={{marginBottom:8}}>
              {[
                {label:"Total Logs",val:(ingLogs||[]).length,color:"#3b82f6"},
                {label:"Today Consumed",val:`${totalToday} units`,color:"#f59e0b"},
                {label:"Ingredients",val:uniqueIng,color:"#8b5cf6"},
                {label:"Master List",val:(ingItems||[]).length,color:"#10b981"},
              ].map(s=>(
                <div key={s.label} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"14px 16px"}}>
                  <p style={{color:s.color,fontWeight:900,fontSize:22,lineHeight:1}}>{s.val}</p>
                  <p style={{color:t.sub,fontSize:10,marginTop:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em"}}>{s.label}</p>
                </div>
              ))}
            </div>
            {/* Sub-tabs */}
            <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,display:"flex",overflow:"hidden",marginBottom:4}}>
              {[["log","📋 Log"],["stock","📦 Stock"]].map(([k,lbl])=>(
                <button key={k} onClick={()=>setIngDateFilter(k==="stock"?"all":ingDateFilter)} style={{flex:1,padding:"11px 0",fontSize:13,fontWeight:((ingDateFilter==="stock"&&k==="stock")||(ingDateFilter!=="stock"&&k==="log"))?700:500,background:((ingDateFilter==="stock"&&k==="stock")||(ingDateFilter!=="stock"&&k==="log"))?t.accent:"transparent",color:((ingDateFilter==="stock"&&k==="stock")||(ingDateFilter!=="stock"&&k==="log"))?t.accentFg:t.sub,border:"none",cursor:"pointer",transition:"all 0.15s"}}>{lbl}</button>
              ))}
            </div>
            {ingDateFilter!=="stock"&&<>
              {/* Filters */}
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                <input value={ingSearch} onChange={e=>setIngSearch(e.target.value)} placeholder="Search ingredient…" style={{flex:1,minWidth:160,background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:10,padding:"9px 12px",fontSize:14,outline:"none"}}/>
                <select value={ingDateFilter} onChange={e=>setIngDateFilter(e.target.value)} style={{background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:10,padding:"9px 12px",fontSize:13,outline:"none",WebkitAppearance:"none"}}>
                  {[["all","All time"],["today","Today"],["yesterday","Yesterday"],["week","This week"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
                
              </div>
              {/* Logs */}
              {fLogs.length===0?<div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"36px 20px",textAlign:"center"}}><p style={{fontSize:32,marginBottom:8}}>🧂</p><p style={{color:t.sub,fontSize:14,fontWeight:600}}>No consumption logs yet</p></div>
              :fLogs.map(l=>(
                <div key={l.id} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:"14px 16px"}} className="crm-list-item">
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <p style={{color:t.text,fontWeight:700,fontSize:14}}>{l.ingredient}</p>
                        <span style={{background:"#f59e0b20",color:"#f59e0b",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{l.qty} {l.unit}</span>
                        {l.batchId&&<span style={{background:"#3b82f620",color:"#3b82f6",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>Batch</span>}
                      </div>
                      <div style={{display:"flex",gap:12,marginTop:4,flexWrap:"wrap"}}>
                        <span style={{color:t.sub,fontSize:11}}>📅 {l.date}</span>
                        {l.loggedBy&&<span style={{color:t.sub,fontSize:11}}>👤 {l.loggedBy}</span>}
                        {l.notes&&<span style={{color:t.sub,fontSize:11}}>📝 {l.notes}</span>}
                      </div>
                    </div>
                    {isAdmin&&<div style={{display:"flex",gap:6,flexShrink:0}}>
                      <button onClick={()=>{setIngF({...l});setIngSh(l);}} style={{background:t.inp,border:`1px solid ${t.border}`,color:t.sub,borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Edit</button>
                      <button onClick={()=>delIng(l)} style={{background:"#ef444410",border:"1px solid #ef444430",color:"#ef4444",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Del</button>
                    </div>}
                  </div>
                </div>
              ))}
            </>}
            {ingDateFilter==="stock"&&<>
              {/* Master list + stock */}
              {isAdmin&&<Btn dm={dm} v="primary" size="sm" onClick={()=>{setIngItemF({name:"",unit:"kg",stock:""});setIngItemSh("add");}}>+ Add Ingredient</Btn>}
              {Object.values(stockMap).length===0?<div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"36px 20px",textAlign:"center"}}><p style={{color:t.sub,fontSize:14}}>No ingredients yet</p></div>
              :Object.values(stockMap).map((it,i)=>{
                const net=(+it.stock||0)-(it.consumed||0);
                const isLow=net<5;
                return <div key={i} style={{background:t.card,border:`1.5px solid ${isLow?"#ef444440":t.border}`,borderRadius:14,padding:"14px 16px"}} className="crm-list-item">
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                    <div style={{flex:1}}>
                      <p style={{color:t.text,fontWeight:700,fontSize:14}}>{it.name}</p>
                      <div style={{display:"flex",gap:12,marginTop:4,flexWrap:"wrap"}}>
                        <span style={{color:t.sub,fontSize:11}}>Opening: {it.stock||0} {it.unit}</span>
                        <span style={{color:"#f59e0b",fontSize:11,fontWeight:600}}>Used: {it.consumed||0} {it.unit}</span>
                        <span style={{color:isLow?"#ef4444":"#10b981",fontSize:11,fontWeight:700}}>Balance: {net} {it.unit} {isLow?"⚠️ LOW":""}</span>
                      </div>
                    </div>
                    {isAdmin&&it.id&&<div style={{display:"flex",gap:6,flexShrink:0}}>
                      <button onClick={()=>{setIngItemF({name:it.name,unit:it.unit,stock:it.stock||""});setIngItemSh(it);}} style={{background:t.inp,border:`1px solid ${t.border}`,color:t.sub,borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Edit</button>
                      <button onClick={()=>ask(`Remove "${it.name}" from master list?`,()=>{setIngItems(p=>safeArr(p).filter(x=>x.id!==it.id));notify("Removed");})} style={{background:"#ef444410",border:"1px solid #ef444430",color:"#ef4444",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Del</button>
                    </div>}
                  </div>
                </div>;
              })}
            </>}
            {/* Ingredient log sheet */}
            <Sheet dm={dm} open={!!ingSh} onClose={()=>setIngSh(null)} title={ingSh==="add"?"🧂 Log Consumption":"✏️ Edit Log"}>
              <Inp dm={dm} label="Ingredient *" value={ingF.ingredient} onChange={e=>setIngF(f=>({...f,ingredient:e.target.value}))} placeholder="e.g. Whole Wheat Flour"/>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
                <Inp dm={dm} label="Quantity *" type="number" value={ingF.qty} onChange={e=>setIngF(f=>({...f,qty:e.target.value}))}/>
                <Sel dm={dm} label="Unit" value={ingF.unit} onChange={e=>setIngF(f=>({...f,unit:e.target.value}))}>
                  {(settings?.supplyUnits||["kg","g","L","ml","pcs"]).map(u=><option key={u}>{u}</option>)}
                </Sel>
              </div>
              <Inp dm={dm} label="Date" type="date" value={ingF.date} onChange={e=>setIngF(f=>({...f,date:e.target.value}))}/>
              <Inp dm={dm} label="Notes" value={ingF.notes} onChange={e=>setIngF(f=>({...f,notes:e.target.value}))} placeholder="Optional notes"/>
              <div style={{display:"flex",gap:8}}>
                <Btn dm={dm} v="ghost" className="flex-1" onClick={()=>setIngSh(null)}>Cancel</Btn>
                <Btn dm={dm} v="success" className="flex-1" onClick={saveIng}>Save</Btn>
              </div>
            </Sheet>
            {/* Ingredient item sheet */}
            <Sheet dm={dm} open={!!ingItemSh} onClose={()=>setIngItemSh(null)} title={ingItemSh==="add"?"➕ Add Ingredient":"✏️ Edit Ingredient"}>
              <Inp dm={dm} label="Name *" value={ingItemF.name} onChange={e=>setIngItemF(f=>({...f,name:e.target.value}))} placeholder="e.g. Whole Wheat Flour"/>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
                <Sel dm={dm} label="Unit" value={ingItemF.unit} onChange={e=>setIngItemF(f=>({...f,unit:e.target.value}))}>
                  {(settings?.supplyUnits||["kg","g","L","ml","pcs"]).map(u=><option key={u}>{u}</option>)}
                </Sel>
                <Inp dm={dm} label="Opening Stock" type="number" value={ingItemF.stock} onChange={e=>setIngItemF(f=>({...f,stock:e.target.value}))}/>
              </div>
              <div style={{display:"flex",gap:8}}>
                <Btn dm={dm} v="ghost" className="flex-1" onClick={()=>setIngItemSh(null)}>Cancel</Btn>
                <Btn dm={dm} v="success" className="flex-1" onClick={saveIngItem}>Save</Btn>
              </div>
            </Sheet>
          </>;
        })()}

        {/* ═══════════════════════════════════════════════════════
            STAFF — Attendance & Shift Log
        ═══════════════════════════════════════════════════════ */}
