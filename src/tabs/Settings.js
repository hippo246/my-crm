/* eslint-disable */
// TAB: Settings
// This file contains the Settings tab JSX, extracted from App.js

        {tab==="Settings"&&isAdmin&&(()=>{
          // Settings section nav
          const SECS=[
            {id:"toggles",icon:"⚡",label:"Features"},
            {id:"invoice",icon:"🧾",label:"Invoice"},
            {id:"account",icon:"👤",label:"Account"},
            {id:"staff",icon:"👥",label:"Staff"},
            {id:"staffatt",icon:"🕐",label:"Attendance"},
            {id:"machines",icon:"⚙️",label:"Machines"},
            {id:"vehicles",icon:"🚐",label:"Vehicles"},
            {id:"products",icon:"📦",label:"Products"},
            {id:"recipes",icon:"🧪",label:"Recipes"},
            {id:"production",icon:"🏭",label:"Production"},
            {id:"access",icon:"🔒",label:"Permissions"},
            {id:"app",icon:"🎨",label:"Branding"},
            {id:"alerts",icon:"🔔",label:"Alerts"},
            {id:"security",icon:"🛡️",label:"Security"},
            {id:"data",icon:"💾",label:"Data"},
          ];
          return <>
          <SectionHeader dm={dm} title="Settings" sub="Configure your CRM, manage users and customize features"/>
          {/* Settings layout: sidebar on desktop, wrapped pill grid on mobile/tablet */}
          <div className="lg:flex" style={{display:"flex",flexDirection:"column",gap:12,alignItems:"flex-start"}}>
            {/* ── PILL NAV (mobile/tablet) — wraps to multiple rows, never scrolls ── */}
            <div className="lg:hidden w-full" style={{display:"flex",flexWrap:"wrap",gap:"8px 6px",paddingBottom:4}}>
              {SECS.map(s=>(
                <button key={s.id} onClick={e=>{e.preventDefault();setSettingsSection(s.id);}}
                  style={{background:settingsSection===s.id?t.accent:t.inp,color:settingsSection===s.id?t.accentFg:t.sub,border:`1.5px solid ${settingsSection===s.id?t.accent:t.border}`,borderRadius:20,padding:"7px 13px",whiteSpace:"nowrap",cursor:"pointer",transition:"all 0.12s",display:"flex",alignItems:"center",gap:5,fontSize:12,fontWeight:700,flexShrink:0}}>
                  <span style={{fontSize:13}}>{s.icon}</span>{s.label}
                </button>
              ))}
            </div>
            {/* ── INNER ROW: sidebar + content (desktop) ── */}
            <div className="w-full" style={{display:"flex",gap:20,alignItems:"flex-start"}}>
            {/* ── SIDEBAR NAV (desktop) ── */}
            <div className="hidden lg:flex" style={{flexDirection:"column",gap:4,width:180,flexShrink:0,position:"sticky",top:80}}>
              {SECS.map(s=>(
                <button key={s.id} onClick={e=>{e.preventDefault();setSettingsSection(s.id);}}
                  style={{background:settingsSection===s.id?t.accent:t.inp,color:settingsSection===s.id?t.accentFg:t.sub,border:`1.5px solid ${settingsSection===s.id?t.accent:t.border}`,borderRadius:10,padding:"10px 14px",textAlign:"left",cursor:"pointer",transition:"all 0.12s",display:"flex",alignItems:"center",gap:8,fontWeight:settingsSection===s.id?700:500,fontSize:13}}
                  onMouseEnter={e=>{if(settingsSection!==s.id){e.currentTarget.style.background=t.card;e.currentTarget.style.color=t.text;}}}
                  onMouseLeave={e=>{if(settingsSection!==s.id){e.currentTarget.style.background=t.inp;e.currentTarget.style.color=t.sub;}}}>
                  <span style={{fontSize:16,flexShrink:0}}>{s.icon}</span>
                  <span className="truncate">{s.label}</span>
                </button>
              ))}
            </div>
            {/* ── SETTINGS CONTENT ── */}
            <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:16}}>

          {/* ── FEATURE TOGGLES ── */}
          {settingsSection==="toggles"&&<>
            {/* Orders & Delivery */}
            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text,fontWeight:700,fontSize:14,marginBottom:2}}>📦 Orders & Delivery</p>
              <p style={{color:t.sub,fontSize:11,marginBottom:12}}>Core features for the delivery workflow</p>
              {[
                {key:"bulkOrderEnabled",label:"Bulk Order Entry",desc:"Create orders for multiple customers at once",icon:"📋",defOn:true},
                {key:"featureSmartDeduction",label:"Smart Auto-Deduct",desc:"Auto-reduce supply stock when production is logged",icon:"🤖",defOn:true},
                {key:"featureShiftManagement",label:"Shift Management",desc:"Enable shift-based scheduling and handovers",icon:"🔄",defOn:true},
                {key:"featureOrderDateOverride",label:"Order Date Override",desc:"Allow agents to backdate or forward-date orders",icon:"📅",defOn:false},
                {key:"featureRouteOpt",label:"Route Optimization",desc:"Auto-suggest delivery routes for agents",icon:"🗺",defOn:false},
              ].map(({key,label,desc,icon,defOn})=>(
                <div key={key} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                  <div className="flex-1 min-w-0 pr-4">
                    <p style={{color:t.text}} className="text-sm font-semibold">{icon} {label}</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">{desc}</p>
                  </div>
                  <Tog dm={dm} on={settings?.[key]!==undefined?settings[key]:defOn} onChange={()=>setSettings(s=>({...s,[key]:!(s?.[key]!==undefined?s[key]:defOn)}))}/>
                </div>
              ))}
            </div></Card>

            {/* Finance */}
            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text,fontWeight:700,fontSize:14,marginBottom:2}}>💰 Finance</p>
              <p style={{color:t.sub,fontSize:11,marginBottom:12}}>Financial controls and calculations</p>
              {/* Credit Limit */}
              {(()=>{const isOn=!!settings?.featureCreditLimit;return(
                <div style={{borderBottom:`1px solid ${t.border}`}}>
                  <div className="flex items-center justify-between py-2.5">
                    <div className="flex-1 min-w-0 pr-4">
                      <p style={{color:t.text}} className="text-sm font-semibold">💳 Credit Limit Enforcement</p>
                      <p style={{color:t.sub}} className="text-[11px] mt-0.5">Block orders when customer exceeds their credit limit</p>
                    </div>
                    <Tog dm={dm} on={isOn} onChange={()=>setSettings(s=>({...s,featureCreditLimit:!isOn}))}/>
                  </div>
                  {isOn&&<div style={{paddingBottom:10}}>
                    <Inp dm={dm} label="Default Credit Limit (₹)" type="number" inputMode="numeric"
                      value={settings?.creditLimitDefault||""}
                      onChange={e=>setSettings(s=>({...s,creditLimitDefault:+e.target.value||0}))}
                      placeholder="0 = no default limit"/>
                    <p style={{color:t.sub,fontSize:10,marginTop:4}}>Applied to new customers. Override per customer in their profile.</p>
                  </div>}
                </div>
              );})()}
              {/* Tax Calculation */}
              {(()=>{const isOn=!!settings?.featureTaxCalc;return(
                <div style={{borderBottom:`1px solid ${t.border}`}}>
                  <div className="flex items-center justify-between py-2.5">
                    <div className="flex-1 min-w-0 pr-4">
                      <p style={{color:t.text}} className="text-sm font-semibold">🧾 Tax Calculation (GST/VAT)</p>
                      <p style={{color:t.sub}} className="text-[11px] mt-0.5">Apply tax automatically on invoices and order totals</p>
                    </div>
                    <Tog dm={dm} on={isOn} onChange={()=>setSettings(s=>({...s,featureTaxCalc:!isOn}))}/>
                  </div>
                  {isOn&&<div style={{paddingBottom:10}}>
                    <Inp dm={dm} label="Tax Rate (%)" type="number" inputMode="decimal"
                      value={settings?.taxRate||""}
                      onChange={e=>setSettings(s=>({...s,taxRate:+e.target.value||0}))}
                      placeholder="e.g. 5 for 5% GST"/>
                    <p style={{color:t.sub,fontSize:10,marginTop:4}}>Added on top of order subtotal in invoices and totals.</p>
                  </div>}
                </div>
              );})()}
              {/* Multi-currency */}
              <div className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                <div className="flex-1 min-w-0 pr-4">
                  <p style={{color:t.text}} className="text-sm font-semibold">💱 Multi-Currency Support</p>
                  <p style={{color:t.sub}} className="text-[11px] mt-0.5">Accept orders in different currencies</p>
                </div>
                <Tog dm={dm} on={!!settings?.featureMultiCurrency} onChange={()=>setSettings(s=>({...s,featureMultiCurrency:!s?.featureMultiCurrency}))}/>
              </div>
            </div></Card>

            {/* Reports */}
            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text,fontWeight:700,fontSize:14,marginBottom:2}}>📊 Reports & Analytics</p>
              <p style={{color:t.sub,fontSize:11,marginBottom:12}}>Control what appears in reports</p>
              {[
                {key:"invoiceShowOnReports",label:"Invoice Numbers in Reports",desc:"Display invoice ID on all exported and printed reports",icon:"📄",defOn:true},
                {key:"invoiceShowOnPnL",label:"Invoice Numbers in P&L",desc:"Show invoice references on profit & loss statements",icon:"📈",defOn:true},
                {key:"invoiceShowOnAnalytics",label:"Invoice Numbers in Analytics",desc:"Include invoice data in analytics breakdowns",icon:"🔍",defOn:true},
              ].map(({key,label,desc,icon,defOn})=>(
                <div key={key} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                  <div className="flex-1 min-w-0 pr-4">
                    <p style={{color:t.text}} className="text-sm font-semibold">{icon} {label}</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">{desc}</p>
                  </div>
                  <Tog dm={dm} on={settings?.[key]!==undefined?settings[key]:defOn} onChange={()=>setSettings(s=>({...s,[key]:!(s?.[key]!==undefined?s[key]:defOn)}))}/>
                </div>
              ))}
            </div></Card>

            {/* Agent features */}
            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text,fontWeight:700,fontSize:14,marginBottom:2}}>🚚 Delivery Agent Features</p>
              <p style={{color:t.sub,fontSize:11,marginBottom:12}}>Control what agents can see and do</p>
              {[
                {key:"agentCollectEnabled",label:"Agent Cash Collection",desc:"Show the Collect button so agents can record cash on delivery",icon:"💰",defOn:true},
                {key:"agentCollectRequireNote",label:"Require Collection Note",desc:"Agent must enter a note before confirming collection",icon:"📝",defOn:false},
                {key:"agentInvoiceEnabled",label:"Delivery Receipts",desc:"Show Receipt button on delivery cards",icon:"🧾",defOn:true},
                {key:"agentInvoiceShowPrices",label:"Show Prices on Receipt",desc:"Include unit prices and totals on the printed receipt",icon:"💲",defOn:true},
                {key:"agentAutoReceipt",label:"Auto-print After Collection",desc:"Auto-trigger print dialog when agent confirms collection",icon:"🖨",defOn:true},
              ].map(({key,label,desc,icon,defOn})=>(
                <div key={key} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                  <div className="flex-1 min-w-0 pr-4">
                    <p style={{color:t.text}} className="text-sm font-semibold">{icon} {label}</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">{desc}</p>
                  </div>
                  <Tog dm={dm} on={settings?.[key]!==undefined?settings[key]:defOn} onChange={()=>setSettings(s=>({...s,[key]:!(s?.[key]!==undefined?s[key]:defOn)}))}/>
                </div>
              ))}
            </div></Card>

            {/* ── PHASE 1: App & UX ── */}
            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text,fontWeight:700,fontSize:14,marginBottom:2}}>📱 App & UX</p>
              <p style={{color:t.sub,fontSize:11,marginBottom:12}}>Install experience and interface improvements</p>
              {[
                {key:"featurePWA",label:"PWA / Install on Home Screen",desc:"Enable install prompt + offline service worker so the app can be added to the home screen like a native app",icon:"📲",defOn:false},
                {key:"featureTickRedesign",label:"Redesigned Delivery Tick UI",desc:"Replace the flat Done button with a larger, cleaner toggle-style mark-delivered button on delivery cards",icon:"✅",defOn:true},
              ].map(({key,label,desc,icon,defOn})=>(
                <div key={key} className="flex items-start justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`,gap:12}}>
                  <div className="flex-1 min-w-0">
                    <p style={{color:t.text}} className="text-sm font-semibold">{icon} {label}</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">{desc}</p>
                  </div>
                  <Tog dm={dm} on={settings?.[key]!==undefined?settings[key]:defOn} onChange={()=>setSettings(s=>({...s,[key]:!(s?.[key]!==undefined?s[key]:defOn)}))}/>
                </div>
              ))}
            </div></Card>

            {/* ── PHASE 2: Operations ── */}
            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text,fontWeight:700,fontSize:14,marginBottom:2}}>🏭 Operations</p>
              <p style={{color:t.sub,fontSize:11,marginBottom:12}}>Factory floor and fleet management features</p>
              {[
                {key:"featureIngredientTracking",label:"Ingredient Consumption Tracking",desc:"Auto-deduct raw ingredients (flour, oil, etc.) from stock when production batches are logged",icon:"🧪",defOn:false,configSection:null},
                {key:"featureStaffAttendance",label:"Staff Attendance & Shift Log",desc:"Track who clocked in, when, and how many hours per shift",icon:"🕐",defOn:false,configSection:"staffatt"},
                {key:"featureMachineMaintenance",label:"Machine Maintenance Log",desc:"Track equipment servicing history and flag overdue maintenance",icon:"🔧",defOn:false,configSection:"machines"},
                {key:"featureVanManagement",label:"Vehicle / Van Management",desc:"Assign vans to routes, track capacity, and log fuel usage",icon:"🚐",defOn:false,configSection:"vehicles"},
              ].map(({key,label,desc,icon,defOn,configSection})=>{const isOn=settings?.[key]!==undefined?settings[key]:defOn;return(
                <div key={key} className="flex items-start justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`,gap:12}}>
                  <div className="flex-1 min-w-0">
                    <p style={{color:t.text}} className="text-sm font-semibold">{icon} {label}</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">{desc}</p>
                    {isOn&&configSection&&<button onClick={()=>setSettingsSection(configSection)} style={{background:"none",border:"none",padding:0,color:t.accent,fontSize:11,fontWeight:700,cursor:"pointer",marginTop:3}}>Configure →</button>}
                  </div>
                  <Tog dm={dm} on={isOn} onChange={()=>setSettings(s=>({...s,[key]:!isOn}))}/>
                </div>
              );})}
            </div></Card>

            {/* ── PHASE 3: Advanced & Integrations ── */}
            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text,fontWeight:700,fontSize:14,marginBottom:2}}>🔗 Advanced & Integrations</p>
              <p style={{color:t.sub,fontSize:11,marginBottom:12}}>Power features and third-party connections</p>
              {[
                {key:"featureGST",label:"GST Invoice Generation",desc:"Proper GSTIN, HSN codes, CGST/SGST breakdowns on invoices",icon:"🧾",defOn:false},
                {key:"featureCustomDashboard",label:"Customisable Dashboard per Role",desc:"Each user picks which widgets they see on their dashboard",icon:"🎛️",defOn:false},
                {key:"featureGoogleSheets",label:"Export to Google Sheets",desc:"Push data directly to a Google Sheet instead of downloading XLS",icon:"📊",defOn:false},
                {key:"featurePrintLabels",label:"Print Label Generation",desc:"Generate delivery labels with name, address, and QR code for packing",icon:"🏷️",defOn:false},
                {key:"featureMultiLanguage",label:"Multi-Language Support",desc:"Hindi, Malayalam, or Kannada alongside English",icon:"🌐",defOn:false},
              ].map(({key,label,desc,icon,defOn})=>(
                <div key={key} className="flex items-start justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`,gap:12}}>
                  <div className="flex-1 min-w-0">
                    <p style={{color:t.text}} className="text-sm font-semibold">{icon} {label}</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">{desc}</p>
                  </div>
                  <Tog dm={dm} on={settings?.[key]!==undefined?settings[key]:defOn} onChange={()=>setSettings(s=>({...s,[key]:!(s?.[key]!==undefined?s[key]:defOn)}))}/>
                </div>
              ))}
              {settings?.featureGST&&<div className="flex flex-col gap-3 mt-4 pt-4" style={{borderTop:`1.5px solid ${t.border}`}}>
                <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>GST Configuration</p>
                {[{key:"gstCompanyGSTIN",label:"Company GSTIN",placeholder:"22AAAAA0000A1Z5"},{key:"gstDefaultHSN",label:"Default HSN Code",placeholder:"e.g. 1905"}].map(({key,label,placeholder})=>(
                  <div key={key}>
                    <p style={{color:t.sub,fontSize:11,marginBottom:4}}>{label}</p>
                    <input value={settings?.[key]||""} onChange={e=>setSettings(s=>({...s,[key]:e.target.value}))} placeholder={placeholder}
                      style={{background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:10,padding:"9px 12px",fontSize:14,width:"100%",outline:"none"}}/>
                  </div>
                ))}
                <div className="flex gap-3">
                  {[{key:"gstCGSTPct",label:"CGST %"},{key:"gstSGSTPct",label:"SGST %"}].map(({key,label})=>(
                    <div key={key} style={{flex:1}}>
                      <p style={{color:t.sub,fontSize:11,marginBottom:4}}>{label}</p>
                      <input type="number" min="0" max="28" value={settings?.[key]??9} onChange={e=>setSettings(s=>({...s,[key]:Number(e.target.value)}))}
                        style={{background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:10,padding:"9px 12px",fontSize:14,width:"100%",outline:"none"}}/>
                    </div>
                  ))}
                </div>
              </div>}
              {settings?.featureGoogleSheets&&<div className="flex flex-col gap-3 mt-4 pt-4" style={{borderTop:`1.5px solid ${t.border}`}}>
                <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>Google Sheets Configuration</p>
                <div style={{background:dm?"rgba(59,130,246,0.08)":"#eff6ff",border:"1px solid #bfdbfe",borderRadius:10,padding:"10px 12px"}}>
                  <p style={{color:"#1d4ed8",fontSize:11,fontWeight:700,marginBottom:4}}>📋 Setup Instructions</p>
                  <p style={{color:dm?"#93c5fd":"#1e40af",fontSize:10,lineHeight:1.7}}>
                    1. Open your Google Sheet → Extensions → Apps Script<br/>
                    2. Create a new script, paste the TAS push handler (doPost), save & deploy<br/>
                    3. Set <b>Execute as: Me</b> · <b>Access: Anyone</b><br/>
                    4. Copy the <b>/exec URL</b> and paste it below
                  </p>
                </div>
                <div>
                  <p style={{color:t.sub,fontSize:11,marginBottom:4}}>Apps Script Web App URL <span style={{color:"#ef4444",fontWeight:700}}>*</span></p>
                  <input value={settings?.googleSheetsWebAppUrl||""} onChange={e=>setSettings(s=>({...s,googleSheetsWebAppUrl:e.target.value}))} placeholder="https://script.google.com/macros/s/.../exec"
                    style={{background:t.inp,border:`1.5px solid ${settings?.googleSheetsWebAppUrl?t.accent:t.inpB}`,color:t.text,borderRadius:10,padding:"9px 12px",fontSize:13,width:"100%",outline:"none"}}/>
                  <p style={{color:t.sub,fontSize:10,marginTop:3}}>Primary push method — no API key or OAuth required.</p>
                </div>
                {[{key:"googleSheetsId",label:"Google Sheet ID (optional)",placeholder:"From the Sheet URL — used for display only"},{key:"googleSheetsApiKey",label:"API Key (optional)",placeholder:"Not needed when using Apps Script URL"}].map(({key,label,placeholder})=>(
                  <div key={key}>
                    <p style={{color:t.sub,fontSize:11,marginBottom:4}}>{label}</p>
                    <input value={settings?.[key]||""} onChange={e=>setSettings(s=>({...s,[key]:e.target.value}))} placeholder={placeholder}
                      style={{background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:10,padding:"9px 12px",fontSize:14,width:"100%",outline:"none"}}/>
                  </div>
                ))}
                {settings?.googleSheetsWebAppUrl&&<div style={{background:dm?"rgba(16,185,129,0.08)":"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"8px 12px"}}>
                  <p style={{color:"#059669",fontSize:11,fontWeight:700}}>✓ Web App URL configured — 📊 Push to Sheets buttons now appear on Deliveries and Expenses tabs</p>
                </div>}
              </div>}

            </div></Card>
          </>}

          {/* ── INVOICE NUMBERING ── */}
          {settingsSection==="invoice"&&(()=>{
            const prefix = settings?.invoicePrefix||"TAS";
            const startSeq = settings?.invoiceStartSeq||1;
            const yearReset = settings?.invoiceYearReset!==false;
            const currentSeq = invRegistry?.seq||0;
            const year = new Date().getFullYear();
            const previewNo = `${prefix}-${yearReset?year+"-":""}${String(Math.max(currentSeq+1,startSeq)).padStart(4,"0")}`;
            const previewReceipt = `RCP-${yearReset?year+"-":""}${String(Math.max(currentSeq+1,startSeq)).padStart(4,"0")}`;
            const totalIssued = Object.keys(invRegistry?.issued||{}).length;
            return <>
              {/* Stats */}
              <div className="crm-grid-3" style={{gap:10}}>
                {[
                  {label:"Invoices Issued",val:totalIssued,color:"#8b5cf6"},
                  {label:"Current Sequence",val:`#${currentSeq}`,color:"#f59e0b"},
                  {label:"Next Number",val:previewNo,color:"#10b981"},
                ].map(({label,val,color})=>(
                  <div key={label} style={{background:t.inp,borderRadius:12,padding:"12px 10px",textAlign:"center"}}>
                    <p style={{color,fontWeight:900,fontSize:15,lineHeight:1,fontFamily:"monospace"}}>{val}</p>
                    <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginTop:5}}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Format config */}
              <Card dm={dm}><div className="p-4 flex flex-col gap-3">
                <p style={{color:t.text}} className="text-sm font-bold">📐 Number Format</p>
                <p style={{color:t.sub}} className="text-[11px]">Defines how invoice numbers look system-wide — applied to all invoices, receipts, reports, P&amp;L, and analytics.</p>
                <div>
                  <label style={{color:t.sub,letterSpacing:"0.05em"}} className="crm-form-label block text-[11px] font-semibold uppercase mb-1.5">Invoice Prefix</label>
                  <input value={settings?.invoicePrefix||"TAS"} onChange={e=>setSettings(s=>({...s,invoicePrefix:e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8)}))} maxLength={8} placeholder="TAS" style={{background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:12,padding:"10px 14px",fontSize:16,width:"100%",outline:"none",fontFamily:"monospace",fontWeight:700,letterSpacing:"0.08em"}}/>
                  <p style={{color:t.sub,fontSize:10,marginTop:4}}>Letters and numbers only. Max 8 chars. e.g. TAS, INV, ORD</p>
                </div>

                <div className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`}}>
                  <div>
                    <p style={{color:t.text}} className="text-sm font-semibold">📅 Year in Number</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">Include the current year: TAS-2026-0001 vs TAS-0001</p>
                  </div>
                  <Tog dm={dm} on={yearReset} onChange={()=>setSettings(s=>({...s,invoiceYearReset:!yearReset}))}/>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p style={{color:t.text}} className="text-sm font-semibold">🔁 Reset Sequence Yearly</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">Restart from 0001 at the start of each year</p>
                  </div>
                  <Tog dm={dm} on={yearReset} onChange={()=>setSettings(s=>({...s,invoiceYearReset:!yearReset}))}/>
                </div>
              </div></Card>

              {/* Live preview */}
              <Card dm={dm}><div className="p-4">
                <p style={{color:t.text}} className="text-sm font-bold mb-3">👁 Live Preview</p>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {[
                    {label:"Invoice",val:previewNo,color:"#8b5cf6"},
                    {label:"Receipt",val:previewReceipt,color:"#0ea5e9"},
                    {label:"Shown in P&L",val:settings?.invoiceShowOnPnL!==false?"✓ Yes":"✗ Hidden",color:settings?.invoiceShowOnPnL!==false?"#10b981":"#ef4444"},
                    {label:"Shown in Analytics",val:settings?.invoiceShowOnAnalytics!==false?"✓ Yes":"✗ Hidden",color:settings?.invoiceShowOnAnalytics!==false?"#10b981":"#ef4444"},
                    {label:"Shown in All Reports",val:settings?.invoiceShowOnReports!==false?"✓ Yes":"✗ Hidden",color:settings?.invoiceShowOnReports!==false?"#10b981":"#ef4444"},
                  ].map(({label,val,color})=>(
                    <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${t.border}`}}>
                      <span style={{color:t.sub,fontSize:12}}>{label}</span>
                      <span style={{color,fontWeight:800,fontSize:13,fontFamily:"monospace"}}>{val}</span>
                    </div>
                  ))}
                </div>
              </div></Card>

              {/* Appearance toggles */}
              <Card dm={dm}><div className="p-4">
                <p style={{color:t.text}} className="text-sm font-bold mb-1">📍 Where invoice numbers appear</p>
                <p style={{color:t.sub}} className="text-[11px] mb-3">System-wide control — applies across all modules</p>
                {[
                  {key:"invoiceShowOnReports",label:"All Printed Reports",desc:"PDF exports, daily sheets, delivery reports"},
                  {key:"invoiceShowOnPnL",label:"Profit & Loss Reports",desc:"P&L monthly and yearly statements"},
                  {key:"invoiceShowOnAnalytics",label:"Analytics Dashboard",desc:"Analytics tab data tables and exports"},
                ].map(({key,label,desc})=>(
                  <div key={key} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                    <div>
                      <p style={{color:t.text}} className="text-sm font-semibold">{label}</p>
                      <p style={{color:t.sub}} className="text-[11px] mt-0.5">{desc}</p>
                    </div>
                    <Tog dm={dm} on={settings?.[key]!==false} onChange={()=>setSettings(s=>({...s,[key]:s?.[key]===false?true:false}))}/>
                  </div>
                ))}
              </div></Card>

              {/* Danger: reset sequence */}
              <Card dm={dm}><div className="p-4">
                <p style={{color:"#ef4444"}} className="text-sm font-bold mb-1">⚠️ Sequence Management</p>
                <p style={{color:t.sub}} className="text-[11px] mb-3">Total issued: <strong>{totalIssued}</strong> invoices. Current counter: <strong>{currentSeq}</strong>.</p>
                <Btn dm={dm} v="danger" size="sm" onClick={()=>ask(`Reset invoice counter to 0? All ${totalIssued} existing invoice numbers will remain linked to their deliveries, but new ones will restart from 0001.`,()=>{setInvRegistry({seq:0,issued:invRegistry?.issued||{}});notify("Invoice counter reset to 0 ✓");})}>Reset Counter (keep existing)</Btn>
              </div></Card>
            </>;
          })()}

          {/* ── ACCOUNT MANAGEMENT ── */}
          {settingsSection==="account"&&<>
            {/* Admin accounts */}
            {users.filter(u=>u.role==="admin").map(u=>{
              const isMe=u.id===sess.id;
              return <Card dm={dm} key={u.id}><div className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div style={{background:t.accent,color:t.accentFg}} className="w-10 h-10 rounded-2xl flex items-center justify-center text-base font-black shrink-0">{u.name.charAt(0).toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p style={{color:t.text}} className="text-sm font-bold">{u.name}</p>
                      {isMe&&<span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500">YOU</span>}
                    </div>
                    <p style={{color:t.sub}} className="text-[11px]">@{u.username} · Admin</p>
                  </div>
                  <Pill dm={dm} c={u.active?"green":"stone"}>{u.active?"Active":"Inactive"}</Pill>
                </div>
                <div className="crm-btn-group">
                  <Btn dm={dm} v="ghost" size="sm" onClick={()=>{setUf({...u,password:""});setUsh(u);}}>✏️ Edit Profile</Btn>
                  {isMe&&<Btn dm={dm} v="ghost" size="sm" onClick={()=>{setChangePwF({current:"",next:"",confirm:""});setChangePwSh(true);}}>🔑 Change Password</Btn>}
                  {!isMe&&<Btn dm={dm} v="danger" size="sm" onClick={()=>delU(u)}>Remove</Btn>}
                </div>
                {/* ── Per-user language preference ── */}
                {isMe&&<div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${t.border}`}}>
                  <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>🌐 My Language</p>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {[{code:"en",label:"English"},{code:"hi",label:"हिंदी"},{code:"mr",label:"मराठी"}].map(lg=>{
                      const active=(u.lang||"en")===lg.code;
                      return <button key={lg.code}
                        onClick={()=>{
                          // Save lang on user object in Firebase + update local session
                          setUsers(p=>safeArr(p).map(x=>x.id===u.id?{...x,lang:lg.code}:x));
                          // If changing own language, update the session too so UI switches immediately
                          if(isMe) onSessUpdate(s=>s?{...s,lang:lg.code}:s);
                          notify(`Language set to ${lg.label} ✓`);
                        }}
                        style={{background:active?t.accent:t.inp,color:active?t.accentFg:t.sub,
                          border:`1.5px solid ${active?t.accent:t.border}`,
                          borderRadius:10,padding:"6px 14px",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                        {lg.label}
                      </button>;
                    })}
                  </div>
                  <p style={{color:t.sub,fontSize:10,marginTop:6}}>Applies to this account across all devices. Other users keep their own language.</p>
                </div>}
              </div></Card>;
            })}
            {/* Add second admin CTA if only one */}
            {users.filter(u=>u.role==="admin").length<2&&(
              <button onClick={()=>{setUf({...blkU(),role:"admin",permissions:[...ALL_TABS]});setUsh("add");}}
                style={{border:`2px dashed ${t.border}`,color:t.sub}}
                className="w-full rounded-2xl py-4 text-sm font-semibold hover:border-amber-400 hover:text-amber-500 transition-all flex items-center justify-center gap-2">
                <span className="text-lg">+</span> Add Second Admin
              </button>
            )}
            {/* Staff Login Mode — moved here */}
            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text}} className="text-sm font-bold mb-1">Staff Login Mode</p>
              <p style={{color:t.sub}} className="text-[11px] mb-4">Choose how staff identify themselves. Changes take effect immediately.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {[
                  {mode:"individual",icon:"🔐",title:"Individual Login",desc:"Each staff member has their own username & password. Best for accountability."},
                  {mode:"picker",icon:"👆",title:"Staff Picker",desc:"A shared account with a name picker at the top. Best for fast-paced environments."},
                ].map(opt=>{
                  const active=(settings?.staffLoginMode||"individual")===opt.mode;
                  return(
                    <button key={opt.mode} onClick={()=>setSettings(s=>({...s,staffLoginMode:opt.mode}))}
                      style={{background:active?"#16a34a22":t.inp,border:`2px solid ${active?"#16a34a":t.border}`,textAlign:"left"}}
                      className="rounded-2xl p-4 transition-all w-full">
                      <div className="text-2xl mb-2">{opt.icon}</div>
                      <p style={{color:active?"#16a34a":t.text}} className="font-bold text-sm mb-1">{opt.title}</p>
                      <p style={{color:t.sub}} className="text-[11px] leading-relaxed">{opt.desc}</p>
                      {active&&<p className="text-[11px] font-bold text-emerald-500 mt-2">✓ ACTIVE</p>}
                    </button>
                  );
                })}
              </div>
              {(settings?.staffLoginMode||"individual")==="picker"&&(<>
                <Hr dm={dm}/>
                <div className="mt-4">
                  <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-1">Staff Names for Picker</p>
                  <p style={{color:t.sub}} className="text-[11px] mb-3">Names shown in the picker. Usually matches your staff accounts.</p>
                  <div className="flex flex-col gap-2 mb-3">
                    {(settings?.staffNames||[]).map((name,i)=>(
                      <div key={i} className="flex items-center gap-2">
                        <input value={name} placeholder="Staff name"
                          onChange={e=>{const names=[...(settings?.staffNames||[])];names[i]=e.target.value;setSettings(s=>({...s,staffNames:names}));}}
                          style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,flex:1}}
                          className="rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-400 transition-all"/>
                        <button onClick={()=>{const names=(settings?.staffNames||[]).filter((_,j)=>j!==i);setSettings(s=>({...s,staffNames:names}));}} className="w-8 h-8 rounded-lg bg-red-500 text-white font-bold text-sm flex items-center justify-center shrink-0">✕</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={()=>setSettings(s=>({...s,staffNames:[...(s.staffNames||[]),""]}))}
                    style={{border:`1.5px dashed ${t.border}`,color:t.sub}}
                    className="w-full rounded-xl py-2.5 text-sm font-semibold hover:border-amber-400 hover:text-amber-500 transition-all">
                    + Add Name
                  </button>
                </div>
              </>)}
            </div></Card>
          </>}

          {/* ── STAFF / USERS ── */}
          {settingsSection==="staff"&&(()=>{
            const factoryUsers=users.filter(u=>u.role==="factory");
            const agentUsers=users.filter(u=>u.role==="agent");
            const sectionColors={Customers:"#0ea5e9",Deliveries:"#f59e0b",Supplies:"#8b5cf6",Wastage:"#f97316",Production:"#6366f1",QC:"#14b8a6",Dashboard:"#10b981",GPS:"#22c55e",Data:"#64748b"};
            // Role default finePerms stored in settings
            const factoryFpDef = settings?.factoryFinePermsDef || defaultFinePerms("factory");
            const agentFpDef   = settings?.agentFinePermsDef   || defaultFinePerms("agent");
            const factoryTabDef= settings?.factoryDefaultPerms || ROLE_DEF.factory;
            const agentTabDef  = settings?.agentDefaultPerms   || ROLE_DEF.agent;

            function RoleDefaultsCard({role,color,emoji,title,subtitle,tabDef,fpDef,tabDefKey,fpDefKey,accounts}){
              const [openSec,setOpenSec]=useState(null);
              return <Card dm={dm} className="overflow-hidden">
                <div className="p-4 pb-3" style={{borderBottom:`1px solid ${t.border}`}}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div style={{background:color+"22",color}} className="w-9 h-9 rounded-xl flex items-center justify-center text-lg">{emoji}</div>
                      <div>
                        <p style={{color:t.text}} className="text-sm font-bold">{title}</p>
                        <p style={{color:t.sub}} className="text-[11px]">{accounts.length} account{accounts.length!==1?"s":""} · {subtitle}</p>
                      </div>
                    </div>
                    <Btn dm={dm} size="sm" onClick={()=>{setUf({...blkU(),role,permissions:[...tabDef],finePerms:{...fpDef}});setUsh("add");}}>+ Add</Btn>
                  </div>
                </div>
                {/* Existing accounts */}
                {accounts.length>0&&<div className="px-4 pt-3 pb-1">
                  <p style={{color:t.sub}} className="text-[11px] font-bold uppercase tracking-wider mb-2">Accounts</p>
                  {accounts.map(u=>(
                    <div key={u.id} className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`}}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div style={{background:color+"22",color}} className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black shrink-0">{u.name.charAt(0).toUpperCase()}</div>
                        <div className="min-w-0">
                          <p style={{color:t.text}} className="text-xs font-semibold truncate">{u.name}</p>
                          <p style={{color:t.sub}} className="text-[10px]">@{u.username} · <span className={u.active?"text-emerald-500":"text-red-400"}>{u.active?"Active":"Inactive"}</span></p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={()=>{setUf({...u,password:""});setUsh(u);}} style={{background:t.inp,color:t.text}} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg">Edit</button>
                        <button onClick={()=>delU(u)} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-red-600 text-white">Del</button>
                      </div>
                    </div>
                  ))}
                </div>}
                {/* Default tab access */}
                <div className="px-4 py-3" style={{borderTop:`1px solid ${t.border}`}}>
                  <p style={{color:t.sub}} className="text-[11px] font-bold uppercase tracking-wider mb-2">Default accessible sections (for new accounts)</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ALL_TABS.filter(tb=>tb!=="Settings").map(tb=>{
                      const on=tabDef.includes(tb);
                      const icons={"Dashboard":"📊","Customers":"👥","Deliveries":"🚚","Supplies":"📦","Expenses":"💸","Wastage":"🗑️","P&L":"📈","Analytics":"🔍","Production":"🏭",};
                      return <button key={tb} onClick={()=>{
                          const next=on?tabDef.filter(x=>x!==tb):[...tabDef,tb];
                          setSettings(s=>({...s,[tabDefKey]:next}));
                        }}
                        style={{background:on?color+"18":t.card,border:`1.5px solid ${on?color:t.border}`,borderRadius:10,padding:"7px 10px",display:"flex",alignItems:"center",gap:7,textAlign:"left",transition:"all 0.15s"}}>
                        <span style={{fontSize:14}}>{icons[tb]||"•"}</span>
                        <span style={{color:on?color:t.sub,fontSize:11,fontWeight:700,flex:1}}>{tb}</span>
                        <span style={{width:7,height:7,borderRadius:"50%",background:on?color:"transparent",border:`2px solid ${on?color:t.border}`,flexShrink:0}}/>
                      </button>;
                    })}
                  </div>
                </div>
                {/* Default fine perms by section */}
                <div className="px-4 pb-3" style={{borderTop:`1px solid ${t.border}`}}>
                  <p style={{color:t.sub}} className="text-[11px] font-bold uppercase tracking-wider mt-3 mb-2">Default action permissions (for new accounts)</p>
                  <p style={{color:t.sub}} className="text-[10px] mb-3">These apply when creating a new account of this role. Existing accounts keep their own settings.</p>
                  {[...new Set(FINE_PERM_DEFS.map(d=>d.section))].map(sec=>{
                    const perms=FINE_PERM_DEFS.filter(d=>d.section===sec);
                    const sc=sectionColors[sec]||"#6b7280";
                    const allOn=perms.every(d=>fpDef[d.key]);
                    const anyOn=perms.some(d=>fpDef[d.key]);
                    const isOpen=openSec===sec;
                    return <div key={sec} style={{border:`1px solid ${t.border}`,borderRadius:12,marginBottom:6,overflow:"hidden"}}>
                      <button onClick={()=>setOpenSec(isOpen?null:sec)} style={{width:"100%",padding:"9px 12px",display:"flex",alignItems:"center",gap:8,background:"transparent",border:"none",cursor:"pointer",textAlign:"left"}}>
                        <div style={{width:7,height:7,borderRadius:"50%",background:allOn?sc:anyOn?sc+"88":"transparent",border:`2px solid ${allOn?sc:sc+"44"}`,flexShrink:0}}/>
                        <p style={{color:t.text,fontWeight:700,fontSize:12,flex:1}}>{sec}</p>
                        <span style={{color:t.sub,fontSize:10}}>{perms.filter(d=>fpDef[d.key]).length}/{perms.length} on</span>
                        <span style={{color:t.sub,fontSize:11}}>{isOpen?"▲":"▼"}</span>
                      </button>
                      {isOpen&&<div style={{borderTop:`1px solid ${t.border}`}}>
                        <div style={{padding:"6px 12px",display:"flex",justifyContent:"flex-end",gap:8,borderBottom:`1px solid ${t.border}`}}>
                          <button onClick={()=>{const upd={...fpDef};perms.forEach(d=>{upd[d.key]=true;});setSettings(s=>({...s,[fpDefKey]:upd}));}} style={{fontSize:10,fontWeight:700,color:sc,background:sc+"18",border:`1px solid ${sc+"44"}`,borderRadius:6,padding:"5px 10px",cursor:"pointer"}}>Grant all</button>
                          <button onClick={()=>{const upd={...fpDef};perms.forEach(d=>{upd[d.key]=false;});setSettings(s=>({...s,[fpDefKey]:upd}));}} style={{fontSize:10,fontWeight:700,color:t.sub,background:"transparent",border:`1px solid ${t.border}`,borderRadius:6,padding:"5px 10px",cursor:"pointer"}}>Revoke all</button>
                        </div>
                        {perms.map(({key,label,desc,icon})=>{
                          const on=fpDef[key]===true;
                          return <div key={key} style={{padding:"9px 12px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontSize:14,width:20,textAlign:"center",flexShrink:0}}>{icon}</span>
                            <div style={{flex:1,minWidth:0}}>
                              <p style={{color:on?t.text:t.sub,fontSize:11,fontWeight:600}}>{label}</p>
                              <p style={{color:t.sub,fontSize:10}}>{desc}</p>
                            </div>
                            <Tog dm={dm} on={on} onChange={()=>{setSettings(s=>({...s,[fpDefKey]:{...(s[fpDefKey]||defaultFinePerms(role)),[key]:!on}}));}}/>
                          </div>;
                        })}
                      </div>}
                    </div>;
                  })}
                </div>
              </Card>;
            }
            return <>
              <RoleDefaultsCard role="factory" color="#a855f7" emoji="🏭" title="Factory Staff" subtitle="Manages production, supplies & QC"
                tabDef={factoryTabDef} fpDef={factoryFpDef} tabDefKey="factoryDefaultPerms" fpDefKey="factoryFinePermsDef" accounts={factoryUsers}/>
              <RoleDefaultsCard role="agent" color="#0ea5e9" emoji="🚚" title="Delivery Agents" subtitle="On the road, delivering orders"
                tabDef={agentTabDef} fpDef={agentFpDef} tabDefKey="agentDefaultPerms" fpDefKey="agentFinePermsDef" accounts={agentUsers}/>
            </>;
          })()}

          {/* ── STAFF ATTENDANCE SETTINGS ── */}
          {settingsSection==="staffatt"&&<>
            <Card dm={dm}><div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p style={{color:t.text,fontWeight:700,fontSize:14}}>🕐 Staff Attendance & Shift Log</p>
                  <p style={{color:t.sub,fontSize:11,marginTop:2}}>Configure the Staff tab and attendance tracking</p>
                </div>
                <Tog dm={dm} on={settings?.featureStaffAttendance===true} onChange={()=>setSettings(s=>({...s,featureStaffAttendance:!s?.featureStaffAttendance}))}/>
              </div>
              {!settings?.featureStaffAttendance&&<div style={{background:"#f59e0b18",border:"1px solid #f59e0b44",borderRadius:10,padding:"10px 12px",marginBottom:8}}><p style={{color:"#f59e0b",fontSize:12,fontWeight:600}}>⚠️ Staff tab is hidden. Enable the toggle above to show it.</p></div>}
            </div></Card>

            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text,fontWeight:700,fontSize:13,marginBottom:12}}>📋 Log Form Fields</p>
              {[
                {key:"staffRequireInOutTime",label:"Require In/Out Time",desc:"Make clock-in and clock-out times mandatory",defOn:false},
                {key:"staffAllowCustomName",label:"Allow Custom (Unlisted) Names",desc:"Let staff log under a name not in the roster",defOn:true},
                {key:"staffShowDepartment",label:"Show Department Field",desc:"Display a department selector on the attendance form",defOn:true},
                {key:"staffShowBreakDuration",label:"Show Break Duration",desc:"Allow logging break time in minutes",defOn:false},
                {key:"staffShowTask",label:"Show Task / Assignment",desc:"Let managers note what task the staff member was on",defOn:false},
                {key:"staffShowOvertimeReason",label:"Show Overtime Reason",desc:"Require a reason when overtime hours are detected",defOn:false},
                {key:"staffShowTemperature",label:"Show Temperature Field",desc:"Record body temperature for health compliance logs",defOn:false},
                {key:"staffShowSalaryType",label:"Show Salary Type in Roster",desc:"Display salary type (daily/monthly) on staff cards",defOn:false},
                {key:"staffShowNotes",label:"Show Notes Field",desc:"Allow adding free-text notes to each attendance record",defOn:true},
              ].map(({key,label,desc,defOn})=>(
                <div key={key} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                  <div className="flex-1 pr-4"><p style={{color:t.text}} className="text-sm font-semibold">{label}</p><p style={{color:t.sub}} className="text-[11px] mt-0.5">{desc}</p></div>
                  <Tog dm={dm} on={settings?.[key]!==undefined?settings[key]:defOn} onChange={()=>setSettings(s=>({...s,[key]:!(s?.[key]!==undefined?s[key]:defOn)}))}/>
                </div>
              ))}
              <div className="mt-3">
                <p style={{color:t.sub,fontSize:11,fontWeight:700,marginBottom:6}}>⏱ Overtime Threshold (hrs/day)</p>
                <input type="number" min="1" max="24" value={settings?.staffOvertimeThresholdHrs??9}
                  onChange={e=>setSettings(s=>({...s,staffOvertimeThresholdHrs:Number(e.target.value)}))}
                  style={{background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:10,padding:"8px 12px",fontSize:14,width:100,outline:"none"}}/>
                <p style={{color:t.sub,fontSize:11,marginTop:4}}>Shifts exceeding this many hours will show an overtime indicator</p>
              </div>
            </div></Card>

            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text,fontWeight:700,fontSize:13,marginBottom:4}}>📅 Default Shift</p>
              <p style={{color:t.sub,fontSize:11,marginBottom:10}}>Pre-selected shift when logging a new attendance record</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {(settings?.shifts||["Morning","Afternoon","Evening","Night"]).map(sh=>(
                  <button key={sh} onClick={()=>setSettings(s=>({...s,staffDefaultShift:sh}))}
                    style={{background:(settings?.staffDefaultShift||"Morning")===sh?t.accent:t.inp,color:(settings?.staffDefaultShift||"Morning")===sh?t.accentFg:t.sub,border:`1.5px solid ${(settings?.staffDefaultShift||"Morning")===sh?t.accent:t.border}`,borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                    {sh}
                  </button>
                ))}
              </div>
            </div></Card>

            {[
              {key:"staffStatuses",label:"Attendance Statuses",desc:"Status options shown as pill buttons on the attendance log form",icon:"🔵",defaults:["Present","Absent","Half Day","Late","On Leave"]},
              {key:"staffDepartments",label:"Departments",desc:"Department options available in the log form and staff roster",icon:"🏢",defaults:["Production","Delivery","Packaging","Cleaning","Admin","Other"]},
              {key:"staffEmploymentTypes",label:"Employment Types",desc:"Contract types available when adding a staff member",icon:"📄",defaults:["Full-time","Part-time","Contract","Daily Wage"]},
              {key:"staffSalaryTypes",label:"Salary Types",desc:"Pay-cycle options for staff members",icon:"💰",defaults:["Monthly","Weekly","Daily","Per Hour","Per Piece"]},
              {key:"staffRoles",label:"Roles / Designations",desc:"Job roles available when adding a staff member",icon:"🔧",defaults:["Roti Maker","Packer","Delivery","Cleaner","Supervisor","Admin"]},
            ].map(({key,label,desc,icon,defaults})=>(
              <Card key={key} dm={dm}><div className="p-4">
                <p style={{color:t.text,fontWeight:700,fontSize:13,marginBottom:2}}>{icon} {label}</p>
                <p style={{color:t.sub,fontSize:11,marginBottom:10}}>{desc}</p>
                <div className="flex flex-col gap-2 mb-3">
                  {(settings?.[key]||defaults).map((v,i)=>(
                    <div key={i} className="flex items-center gap-2">
                      <input value={v} onChange={e=>{const arr=[...(settings?.[key]||defaults)];arr[i]=e.target.value;setSettings(s=>({...s,[key]:arr}));}}
                        style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,flex:1,borderRadius:10,padding:"8px 12px",fontSize:13,outline:"none"}}/>
                      <button onClick={()=>{const arr=(settings?.[key]||defaults).filter((_,j)=>j!==i);setSettings(s=>({...s,[key]:arr}));}}
                        style={{background:"#ef444420",border:"1px solid #ef444430",color:"#ef4444",borderRadius:8,width:32,height:32,fontSize:14,fontWeight:700,cursor:"pointer",flexShrink:0}}>✕</button>
                    </div>
                  ))}
                </div>
                <button onClick={()=>setSettings(s=>({...s,[key]:[...(s[key]||defaults),""]}))}
                  style={{border:`1.5px dashed ${t.border}`,color:t.sub,width:"100%",borderRadius:10,padding:"8px",fontSize:13,fontWeight:600,cursor:"pointer",background:"transparent"}}>
                  + Add
                </button>
              </div></Card>
            ))}
          </>}

          {/* ── MACHINE MAINTENANCE SETTINGS ── */}
          {settingsSection==="machines"&&<>
            <Card dm={dm}><div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p style={{color:t.text,fontWeight:700,fontSize:14}}>⚙️ Machine Maintenance Log</p>
                  <p style={{color:t.sub,fontSize:11,marginTop:2}}>Configure the Machines tab and maintenance tracking</p>
                </div>
                <Tog dm={dm} on={settings?.featureMachineMaintenance===true} onChange={()=>setSettings(s=>({...s,featureMachineMaintenance:!s?.featureMachineMaintenance}))}/>
              </div>
              {!settings?.featureMachineMaintenance&&<div style={{background:"#f59e0b18",border:"1px solid #f59e0b44",borderRadius:10,padding:"10px 12px",marginBottom:8}}><p style={{color:"#f59e0b",fontSize:12,fontWeight:600}}>⚠️ Machines tab is hidden. Enable the toggle above to show it.</p></div>}
            </div></Card>

            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text,fontWeight:700,fontSize:13,marginBottom:12}}>🔧 Maintenance Options</p>
              {[
                {key:"machineRequireNextDue",label:"Require Next Due Date",desc:"Force a next-service date when logging maintenance",defOn:true},
                {key:"machineShowTechnician",label:"Show Technician Field",desc:"Record who carried out the maintenance work",defOn:true},
                {key:"machineShowPartsReplaced",label:"Show Parts Replaced",desc:"List parts that were replaced during the job",defOn:true},
                {key:"machineShowPartsCost",label:"Show Parts Cost",desc:"Record the cost of parts separately",defOn:true},
                {key:"machineShowLaborCost",label:"Show Labour Cost",desc:"Record labour cost separately from parts",defOn:true},
                {key:"machineShowDowntime",label:"Show Downtime (hours)",desc:"Log how many hours the machine was offline",defOn:true},
                {key:"machineShowSeverity",label:"Show Severity Level",desc:"Classify maintenance events as Low/Medium/High/Critical",defOn:true},
                {key:"machineShowWarrantyInfo",label:"Show Warranty Info on Machine Card",desc:"Display warranty expiry on machine listing cards",defOn:false},
                {key:"machineShowSerialNo",label:"Show Serial Number Field",desc:"Capture serial/model numbers when adding machines",defOn:true},
                {key:"machineShowPurchaseInfo",label:"Show Purchase Info",desc:"Record purchase date and cost when adding machines",defOn:true},
              ].map(({key,label,desc,defOn})=>(
                <div key={key} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                  <div className="flex-1 pr-4"><p style={{color:t.text}} className="text-sm font-semibold">{label}</p><p style={{color:t.sub}} className="text-[11px] mt-0.5">{desc}</p></div>
                  <Tog dm={dm} on={settings?.[key]!==undefined?settings[key]:defOn} onChange={()=>setSettings(s=>({...s,[key]:!(s?.[key]!==undefined?s[key]:defOn)}))}/>
                </div>
              ))}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p style={{color:t.sub,fontSize:11,fontWeight:700,marginBottom:6}}>📆 Default Interval (days)</p>
                  <input type="number" min="1" max="365" value={settings?.machineDefaultIntervalDays??30}
                    onChange={e=>setSettings(s=>({...s,machineDefaultIntervalDays:Number(e.target.value)}))}
                    style={{background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:10,padding:"8px 12px",fontSize:14,width:"100%",outline:"none"}}/>
                  <p style={{color:t.sub,fontSize:10,marginTop:3}}>Days between services</p>
                </div>
                <div>
                  <p style={{color:t.sub,fontSize:11,fontWeight:700,marginBottom:6}}>🔔 Alert Before (days)</p>
                  <input type="number" min="0" max="30" value={settings?.machineAlertBeforeDays??3}
                    onChange={e=>setSettings(s=>({...s,machineAlertBeforeDays:Number(e.target.value)}))}
                    style={{background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:10,padding:"8px 12px",fontSize:14,width:"100%",outline:"none"}}/>
                  <p style={{color:t.sub,fontSize:10,marginTop:3}}>Days before due to warn</p>
                </div>
              </div>
            </div></Card>

            {[
              {key:"machineCategories",label:"Machine Categories",desc:"Types of machines in your fleet",icon:"🏷️",defaults:["Mixer","Oven","Sealer","Generator","Conveyor","Other"]},
              {key:"machineLogTypes",label:"Log Entry Types",desc:"Categories for maintenance log entries",icon:"📋",defaults:["Servicing","Breakdown","Repair","Inspection","Oil Change","Other"]},
              {key:"machineStatuses",label:"Machine Statuses",desc:"Status options for individual machines",icon:"🔵",defaults:["Operational","Needs Service","Under Repair","Retired"]},
              {key:"machineSeverityLevels",label:"Severity Levels",desc:"Severity classifications for maintenance events",icon:"⚠️",defaults:["Low","Medium","High","Critical"]},
            ].map(({key,label,desc,icon,defaults})=>(
              <Card key={key} dm={dm}><div className="p-4">
                <p style={{color:t.text,fontWeight:700,fontSize:13,marginBottom:2}}>{icon} {label}</p>
                <p style={{color:t.sub,fontSize:11,marginBottom:10}}>{desc}</p>
                <div className="flex flex-col gap-2 mb-3">
                  {(settings?.[key]||defaults).map((v,i)=>(
                    <div key={i} className="flex items-center gap-2">
                      <input value={v} onChange={e=>{const arr=[...(settings?.[key]||defaults)];arr[i]=e.target.value;setSettings(s=>({...s,[key]:arr}));}}
                        style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,flex:1,borderRadius:10,padding:"8px 12px",fontSize:13,outline:"none"}}/>
                      <button onClick={()=>{const arr=(settings?.[key]||defaults).filter((_,j)=>j!==i);setSettings(s=>({...s,[key]:arr}));}}
                        style={{background:"#ef444420",border:"1px solid #ef444430",color:"#ef4444",borderRadius:8,width:32,height:32,fontSize:14,fontWeight:700,cursor:"pointer",flexShrink:0}}>✕</button>
                    </div>
                  ))}
                </div>
                <button onClick={()=>setSettings(s=>({...s,[key]:[...(s[key]||defaults),""]}))}
                  style={{border:`1.5px dashed ${t.border}`,color:t.sub,width:"100%",borderRadius:10,padding:"8px",fontSize:13,fontWeight:600,cursor:"pointer",background:"transparent"}}>
                  + Add
                </button>
              </div></Card>
            ))}
          </>}

          {/* ── VEHICLE / VAN MANAGEMENT SETTINGS ── */}
          {settingsSection==="vehicles"&&<>
            <Card dm={dm}><div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p style={{color:t.text,fontWeight:700,fontSize:14}}>🚐 Vehicle / Van Management</p>
                  <p style={{color:t.sub,fontSize:11,marginTop:2}}>Configure the Vehicles tab and fleet tracking</p>
                </div>
                <Tog dm={dm} on={settings?.featureVanManagement===true} onChange={()=>setSettings(s=>({...s,featureVanManagement:!s?.featureVanManagement}))}/>
              </div>
              {!settings?.featureVanManagement&&<div style={{background:"#f59e0b18",border:"1px solid #f59e0b44",borderRadius:10,padding:"10px 12px",marginBottom:8}}><p style={{color:"#f59e0b",fontSize:12,fontWeight:600}}>⚠️ Vehicles tab is hidden. Enable the toggle above to show it.</p></div>}
            </div></Card>

            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text,fontWeight:700,fontSize:13,marginBottom:12}}>🔧 Log Options</p>
              {[
                {key:"vehicleRequireDriver",label:"Require Driver Name",desc:"Make the Driver field mandatory when logging a trip",defOn:false},
                {key:"vehicleRequireKms",label:"Require KM Reading",desc:"Make the km driven field mandatory on every log entry",defOn:false},
                {key:"vehicleShowFuelCost",label:"Show Fuel Cost Field",desc:"Display the fuel cost input on trip/log entries",defOn:true},
                {key:"vehicleShowMaintCost",label:"Show Maintenance Cost Field",desc:"Display the maintenance cost input on log entries",defOn:true},
                {key:"vehicleShowFuelLiters",label:"Show Fuel Litres",desc:"Log how many litres of fuel were added",defOn:true},
                {key:"vehicleShowFuelType",label:"Show Fuel Type",desc:"Record petrol/diesel/CNG on each fuel entry",defOn:true},
                {key:"vehicleShowOdometer",label:"Show Odometer Readings",desc:"Log start and end odometer for automatic km calculation",defOn:true},
                {key:"vehicleShowTollCost",label:"Show Toll / Misc Cost",desc:"Log toll and other miscellaneous trip costs",defOn:false},
                {key:"vehicleShowRouteStops",label:"Show Route Stops",desc:"List intermediate stops for trip routes",defOn:false},
                {key:"vehicleShowPriority",label:"Show Priority Flag",desc:"Mark trips/events as Normal, Urgent, or Critical",defOn:false},
                {key:"vehicleShowNextService",label:"Show Next Service Due",desc:"Set and track upcoming service dates",defOn:true},
                {key:"vehicleShowInsuranceAlert",label:"Show Insurance Expiry Alert",desc:"Warn when vehicle insurance is expired on fleet cards",defOn:true},
              ].map(({key,label,desc,defOn})=>(
                <div key={key} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                  <div className="flex-1 pr-4"><p style={{color:t.text}} className="text-sm font-semibold">{label}</p><p style={{color:t.sub}} className="text-[11px] mt-0.5">{desc}</p></div>
                  <Tog dm={dm} on={settings?.[key]!==undefined?settings[key]:defOn} onChange={()=>setSettings(s=>({...s,[key]:!(s?.[key]!==undefined?s[key]:defOn)}))}/>
                </div>
              ))}
            </div></Card>

            {[
              {key:"vehicleTypes",label:"Vehicle Types",desc:"Categories used when adding a vehicle to the fleet",icon:"🚐",defaults:["Van","Car","Bike","Truck","Auto","Other"]},
              {key:"vehicleLogTypes",label:"Log Entry Types",desc:"Types of events that can be logged for a vehicle",icon:"📋",defaults:["Trip","Maintenance","Breakdown","Fuel Fill","Insurance","Other"]},
              {key:"vehicleStatuses",label:"Vehicle Statuses",desc:"Status options shown on each vehicle record",icon:"🔵",defaults:["OK","Needs Service","Offline","Under Repair"]},
              {key:"vehicleFuelTypes",label:"Fuel Types",desc:"Fuel options available on the trip log form",icon:"⛽",defaults:["Petrol","Diesel","CNG","Electric","LPG"]},
            ].map(({key,label,desc,icon,defaults})=>(
              <Card key={key} dm={dm}><div className="p-4">
                <p style={{color:t.text,fontWeight:700,fontSize:13,marginBottom:2}}>{icon} {label}</p>
                <p style={{color:t.sub,fontSize:11,marginBottom:10}}>{desc}</p>
                <div className="flex flex-col gap-2 mb-3">
                  {(settings?.[key]||defaults).map((v,i)=>(
                    <div key={i} className="flex items-center gap-2">
                      <input value={v} onChange={e=>{const arr=[...(settings?.[key]||defaults)];arr[i]=e.target.value;setSettings(s=>({...s,[key]:arr}));}}
                        style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,flex:1,borderRadius:10,padding:"8px 12px",fontSize:13,outline:"none"}}/>
                      <button onClick={()=>{const arr=(settings?.[key]||defaults).filter((_,j)=>j!==i);setSettings(s=>({...s,[key]:arr}));}}
                        style={{background:"#ef444420",border:"1px solid #ef444430",color:"#ef4444",borderRadius:8,width:32,height:32,fontSize:14,fontWeight:700,cursor:"pointer",flexShrink:0}}>✕</button>
                    </div>
                  ))}
                </div>
                <button onClick={()=>setSettings(s=>({...s,[key]:[...(s[key]||defaults),""]}))}
                  style={{border:`1.5px dashed ${t.border}`,color:t.sub,width:"100%",borderRadius:10,padding:"8px",fontSize:13,fontWeight:600,cursor:"pointer",background:"transparent"}}>
                  + Add
                </button>
              </div></Card>
            ))}
          </>}

          {/* ── PRODUCTS ── */}

          {/* ── PRODUCTS ── */}
          {settingsSection==="products"&&<>
            <Card dm={dm}><div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div><p style={{color:t.text}} className="text-sm font-bold">Products & Prices</p><p style={{color:t.sub}} className="text-[11px]">{products.length} products</p></div>
                <Btn dm={dm} size="sm" onClick={()=>{setPf(blkP());setPsh("add");}}>+ Product</Btn>
              </div>
              {products.map(p=>(
                <div key={p.id} style={{borderBottom:`1px solid ${t.border}`}} className="py-3 last:border-0">
                  <div className="flex items-start justify-between">
                    <div><p style={{color:t.text}} className="text-sm font-semibold">{p.name}</p><p style={{color:t.sub}} className="text-[11px]">{p.unit} · id: {p.id}</p></div>
                    <div className="flex gap-1.5">
                      <button onClick={()=>{setPf({...p,prices:[...p.prices]});setPsh(p);}} style={{background:t.inp,color:t.text}} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg">Edit</button>
                      <button onClick={()=>delP(p)} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-red-600 text-white">Delete</button>
                    </div>
                  </div>
                  <div className="flex gap-1.5 mt-2 flex-wrap">{p.prices.map((pr,i)=><span key={i} style={{background:t.inp,color:t.text}} className="text-xs font-bold px-2.5 py-1 rounded-lg">{inr(pr)}</span>)}</div>
                </div>
              ))}
            </div></Card>
            {/* Editable Lists */}
            <Card dm={dm}><div className="p-4 flex flex-col gap-4">
              <p style={{color:t.text}} className="text-sm font-bold">System Lists</p>
              {[
                {label:"Expense Categories",key:"expenseCategories",def:["Gas","Labour","Transport","Packaging","Utilities","Maintenance","Other"]},
                {label:"Delivery Statuses",key:"deliveryStatuses",def:["Pending","In Transit","Delivered","Cancelled"]},
                {label:"Supply Units",key:"supplyUnits",def:["kg","g","L","mL","pcs","bags","boxes","dozen"]},
                {label:"Wastage Types",key:"wastageTypes",def:["Burnt","Broken","Expired","Overproduced","Quality Reject","Other"]},
                {label:"Work Shifts",key:"shifts",def:["Morning","Afternoon","Evening","Night"]},
              ].map(({label,key,def})=>{
                const list=settings?.[key]||def;
                return (
                  <div key={key}>
                    <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-2">{label}</p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {list.map((item,i)=>(
                        <div key={i} className="flex items-center gap-1" style={{background:t.inp,border:`1px solid ${t.inpB}`,borderRadius:8,paddingLeft:8,paddingRight:4,paddingTop:3,paddingBottom:3}}>
                          <span style={{color:t.text}} className="text-xs">{item}</span>
                          <button onClick={()=>setSettings(s=>({...s,[key]:list.filter((_,j)=>j!==i)}))} className="text-red-400 font-bold text-sm ml-1 leading-none">✕</button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input id={`new_${key}`} placeholder={`New ${label.toLowerCase().slice(0,-1)}…`}
                        style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text}}
                        className="flex-1 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-amber-400"/>
                      <button onClick={()=>{const el=document.getElementById(`new_${key}`);const v=el.value.trim();if(v&&!list.includes(v)){setSettings(s=>({...s,[key]:[...list,v]}));el.value="";}}} className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-500 text-white">Add</button>
                    </div>
                  </div>
                );
              })}
            </div></Card>
            {/* Delivery Features — admin-controlled */}
            <Card dm={dm}><div className="p-4 flex flex-col gap-3">
              <p style={{color:t.text}} className="text-sm font-bold">🚚 Delivery Agent Features</p>
              <p style={{color:t.sub}} className="text-[11px]">Control what delivery agents can see and do on their Deliveries tab.</p>

              {/* Bulk Order */}
              <div className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`}}>
                <div>
                  <p style={{color:t.text}} className="text-sm font-semibold">📋 Bulk Order Entry</p>
                  <p style={{color:t.sub}} className="text-[11px] mt-0.5">Allow agents/factory to create orders for multiple customers at once.</p>
                </div>
                <Tog dm={dm} on={settings?.bulkOrderEnabled!==false} onChange={()=>setSettings(s=>({...s,bulkOrderEnabled:s?.bulkOrderEnabled===false?true:false}))}/>
              </div>

              {/* Agent Collect Cash */}
              <div className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`}}>
                <div>
                  <p style={{color:t.text}} className="text-sm font-semibold">💰 Agent Cash Collection</p>
                  <p style={{color:t.sub}} className="text-[11px] mt-0.5">Show the "Collect" button on delivery cards so agents can record cash received on delivery.</p>
                </div>
                <Tog dm={dm} on={settings?.agentCollectEnabled!==false} onChange={()=>setSettings(s=>({...s,agentCollectEnabled:s?.agentCollectEnabled===false?true:false}))}/>
              </div>

              {/* Require note on collect */}
              {settings?.agentCollectEnabled!==false&&<div className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`,paddingLeft:16}}>
                <div>
                  <p style={{color:t.sub}} className="text-sm font-semibold">↳ Require collection note</p>
                  <p style={{color:t.sub}} className="text-[11px] mt-0.5">Agent must enter a note (e.g. cash/UPI ref) before confirming collection.</p>
                </div>
                <Tog dm={dm} on={settings?.agentCollectRequireNote===true} onChange={()=>setSettings(s=>({...s,agentCollectRequireNote:!s?.agentCollectRequireNote}))}/>
              </div>}

              {/* Agent Invoice / Receipt */}
              <div className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`}}>
                <div>
                  <p style={{color:t.text}} className="text-sm font-semibold">🧾 Delivery Receipts</p>
                  <p style={{color:t.sub}} className="text-[11px] mt-0.5">Controls who sees the 🧾 Receipt button on delivery cards. Tapping it opens a full receipt card with a Print option. Admin always has access.</p>
                </div>
                <Tog dm={dm} on={settings?.agentInvoiceEnabled!==false} onChange={()=>setSettings(s=>({...s,agentInvoiceEnabled:s?.agentInvoiceEnabled===false?true:false}))}/>
              </div>

              {/* Per-role receipt visibility + print */}
              {settings?.agentInvoiceEnabled!==false&&<>
                {/* Agents */}
                <div className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`,paddingLeft:16}}>
                  <div>
                    <p style={{color:t.sub}} className="text-sm font-semibold">↳ Show Receipt button to Agents</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">Delivery agents can open the receipt card.</p>
                  </div>
                  <Tog dm={dm} on={(settings?.receiptVisibleTo||["agent"]).includes("agent")} onChange={()=>{const cur=settings?.receiptVisibleTo||["agent"];const next=cur.includes("agent")?cur.filter(r=>r!=="agent"):[...cur,"agent"];setSettings(s=>({...s,receiptVisibleTo:next}));}}/>
                </div>
                {(settings?.receiptVisibleTo||["agent"]).includes("agent")&&<div className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`,paddingLeft:32}}>
                  <div>
                    <p style={{color:t.sub}} className="text-sm font-semibold">↳ ↳ Allow Agents to Print</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">Show the 🖨 Print button on the receipt card for agents. Disable to make it view-only.</p>
                  </div>
                  <Tog dm={dm} on={(settings?.receiptPrintAllowed||["admin","agent"]).includes("agent")} onChange={()=>{const cur=settings?.receiptPrintAllowed||["admin","agent"];const next=cur.includes("agent")?cur.filter(r=>r!=="agent"):[...cur,"agent"];setSettings(s=>({...s,receiptPrintAllowed:next}));}}/>
                </div>}
                {/* Factory */}
                <div className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`,paddingLeft:16}}>
                  <div>
                    <p style={{color:t.sub}} className="text-sm font-semibold">↳ Show Receipt button to Factory</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">Factory staff can open the receipt card.</p>
                  </div>
                  <Tog dm={dm} on={(settings?.receiptVisibleTo||["agent"]).includes("factory")} onChange={()=>{const cur=settings?.receiptVisibleTo||["agent"];const next=cur.includes("factory")?cur.filter(r=>r!=="factory"):[...cur,"factory"];setSettings(s=>({...s,receiptVisibleTo:next}));}}/>
                </div>
                {(settings?.receiptVisibleTo||["agent"]).includes("factory")&&<div className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`,paddingLeft:32}}>
                  <div>
                    <p style={{color:t.sub}} className="text-sm font-semibold">↳ ↳ Allow Factory to Print</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">Show the 🖨 Print button on the receipt card for factory staff.</p>
                  </div>
                  <Tog dm={dm} on={(settings?.receiptPrintAllowed||["admin","agent"]).includes("factory")} onChange={()=>{const cur=settings?.receiptPrintAllowed||["admin","agent"];const next=cur.includes("factory")?cur.filter(r=>r!=="factory"):[...cur,"factory"];setSettings(s=>({...s,receiptPrintAllowed:next}));}}/>
                </div>}
              </>}

              {/* Show prices on receipt */}
              {settings?.agentInvoiceEnabled!==false&&<div className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`,paddingLeft:16}}>
                <div>
                  <p style={{color:t.sub}} className="text-sm font-semibold">↳ Show prices on printed receipt</p>
                  <p style={{color:t.sub}} className="text-[11px] mt-0.5">Include unit prices and totals on the printed receipt. Disable to show items only (no amounts).</p>
                </div>
                <Tog dm={dm} on={settings?.agentInvoiceShowPrices!==false} onChange={()=>setSettings(s=>({...s,agentInvoiceShowPrices:s?.agentInvoiceShowPrices===false?true:false}))}/>
              </div>}

              {/* Auto-open receipt after collect */}
              {settings?.agentInvoiceEnabled!==false&&settings?.agentCollectEnabled!==false&&<div className="flex items-center justify-between py-2" style={{paddingLeft:16}}>
                <div>
                  <p style={{color:t.sub}} className="text-sm font-semibold">↳ Auto-print receipt after collection</p>
                  <p style={{color:t.sub}} className="text-[11px] mt-0.5">Automatically trigger the print dialog when agent confirms a cash collection (in addition to the inline receipt card that always appears).</p>
                </div>
                <Tog dm={dm} on={settings?.agentAutoReceipt!==false} onChange={()=>setSettings(s=>({...s,agentAutoReceipt:s?.agentAutoReceipt===false?true:false}))}/>
              </div>}

            </div></Card>
          </>}

          {/* ── RECIPES ── */}
          {settingsSection==="recipes"&&(()=>{
            const recipes=settings?.recipes||{};
            const autoDeductOn=settings?.autoDeductEnabled!==false;
            return <>\
              {/* Global auto-deduct toggle */}
              <Card dm={dm}><div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p style={{color:t.text,fontWeight:700,fontSize:14}}>🤖 Smart Auto-Deduct</p>
                    <p style={{color:t.sub,fontSize:12,marginTop:2}}>When production is logged, automatically reduce matching supply stock. Factory staff inherit this setting.</p>
                  </div>
                  <Tog dm={dm} on={autoDeductOn} onChange={()=>setSettings(s=>({...s,autoDeductEnabled:!autoDeductOn}))}/>
                </div>
              </div></Card>

              {/* Per-product recipes */}
              <p style={{color:t.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginTop:4}}>Product Recipes</p>
              <p style={{color:t.sub,fontSize:11,marginTop:2,marginBottom:4}}>Define which supply items are consumed per unit produced. Used for the recipe preview in each batch.</p>
              {products.map(prod=>{
                const ingrs=(recipes[prod.id]?.ingredients)||[];
                const open=openRecipe===prod.id;
                return <Card key={prod.id} dm={dm}><div className="p-4">
                  <button onClick={()=>setOpenRecipe(open?null:prod.id)} style={{background:"none",border:"none",cursor:"pointer",width:"100%",textAlign:"left",display:"flex",alignItems:"center",justifyContent:"space-between",padding:0}}>
                    <div>
                      <p style={{color:t.text,fontWeight:700,fontSize:13}}>{prod.name}</p>
                      <p style={{color:t.sub,fontSize:11}}>{ingrs.length>0?`${ingrs.length} ingredient${ingrs.length!==1?"s":""}  defined`:"No recipe yet"}</p>
                    </div>
                    <span style={{color:t.sub,fontSize:16}}>{open?"▲":"▼"}</span>
                  </button>
                  {open&&<>
                    <Hr dm={dm}/>
                    {ingrs.map((ing,ii)=>(
                      <div key={ii} className="flex gap-2 items-center mb-2">
                        <Inp dm={dm} label="Supply item" value={ing.supply} onChange={e=>{const n=[...ingrs];n[ii]={...n[ii],supply:e.target.value};setSettings(s=>({...s,recipes:{...recipes,[prod.id]:{ingredients:n}}}));}} placeholder="e.g. Flour"/>
                        <Inp dm={dm} label="Qty/unit" type="number" value={ing.qtyPerUnit} onChange={e=>{const n=[...ingrs];n[ii]={...n[ii],qtyPerUnit:e.target.value};setSettings(s=>({...s,recipes:{...recipes,[prod.id]:{ingredients:n}}}));}} placeholder="0.5"/>
                        <Inp dm={dm} label="Unit" value={ing.unit} onChange={e=>{const n=[...ingrs];n[ii]={...n[ii],unit:e.target.value};setSettings(s=>({...s,recipes:{...recipes,[prod.id]:{ingredients:n}}}));}} placeholder="kg"/>
                        <button onClick={()=>{const n=ingrs.filter((_,i)=>i!==ii);setSettings(s=>({...s,recipes:{...recipes,[prod.id]:{ingredients:n}}}));}} style={{background:"#dc2626",color:"#fff",border:"none",borderRadius:8,padding:"0 10px",minHeight:36,fontWeight:700,cursor:"pointer",flexShrink:0,marginTop:8}}>×</button>
                      </div>
                    ))}
                    <Btn dm={dm} v="outline" size="sm" onClick={()=>{const n=[...ingrs,{supply:"",qtyPerUnit:"",unit:""}];setSettings(s=>({...s,recipes:{...recipes,[prod.id]:{ingredients:n}}}));}}>+ Add Ingredient</Btn>
                  </>}
                </div></Card>;
              })}
            </>;
          })()}

          {/* ── PRODUCTION SETTINGS ── */}
          {settingsSection==="production"&&<>
            {/* Production Items — separate from delivery products */}
            <Card dm={dm}><div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p style={{color:t.text,fontWeight:700,fontSize:14}}>🏭 Production Items</p>
                  <p style={{color:t.sub,fontSize:11,marginTop:2}}>Items available when logging batches. Separate from your delivery products — changes here won't affect orders or invoices.</p>
                </div>
                <Btn dm={dm} size="sm" style={{background:"#8b5cf6",color:"#fff",border:"none"}} onClick={()=>{setPiF({id:"",name:""});setPiSh("add");}}>+ Add</Btn>
              </div>
              {(prodItems||[]).length===0&&<p style={{color:t.sub,fontSize:12,textAlign:"center",padding:"12px 0"}}>No production items yet. Add your first one.</p>}
              {(prodItems||[]).map(item=>(
                <div key={item.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${t.border}`}} className="last:border-0">
                  <div>
                    <p style={{color:t.text,fontWeight:600,fontSize:13}}>{item.name}</p>
                    <p style={{color:t.sub,fontSize:10}}>id: {item.id}</p>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>{setPiF({...item});setPiSh(item);}} style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 12px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Edit</button>
                    <button onClick={()=>delProdItem(item)} style={{background:"#dc2626",color:"#fff",border:"none",borderRadius:8,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>Del</button>
                  </div>
                </div>
              ))}
            </div></Card>

            {/* Batch & Traceability */}
            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text,fontWeight:700,fontSize:14,marginBottom:2}}>🏭 Batch & Production</p>
              <p style={{color:t.sub,fontSize:11,marginBottom:12}}>Control how batches are logged and tracked</p>
              {[
                {key:"featureSmartDeduction",label:"Auto-Deduct Stock on Batch",desc:"Automatically reduce supply inventory when a batch is logged",icon:"🤖",defOn:true},
                {key:"featureShiftManagement",label:"Shift Management",desc:"Enable shift selection (Morning/Afternoon/Evening/Night) on batches",icon:"🕐",defOn:true},
                {key:"prodRequireQC",label:"Require QC Grade on Every Batch",desc:"Factory must select a QC grade before saving a batch",icon:"✅",defOn:false},
                {key:"prodShowCustomerTraceability",label:"Show Customer Traceability in Batch Form",desc:"Show which customers receive this product when logging a batch",icon:"👥",defOn:true},
                {key:"prodShowRecipeOnBatch",label:"Show Recipe Usage on Batch Card",desc:"Display ingredient breakdown on each batch card in the production tab",icon:"🧪",defOn:true},
                {key:"prodAllowBackdate",label:"Allow Backdated Batch Entry",desc:"Let factory staff log batches for past dates",icon:"📅",defOn:true},
              ].map(({key,label,desc,icon,defOn})=>(
                <div key={key} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                  <div className="flex-1 min-w-0 pr-4">
                    <p style={{color:t.text}} className="text-sm font-semibold">{icon} {label}</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">{desc}</p>
                  </div>
                  <Tog dm={dm} on={settings?.[key]!==undefined?settings[key]:defOn} onChange={()=>setSettings(s=>({...s,[key]:!(s?.[key]!==undefined?s[key]:defOn)}))}/>
                </div>
              ))}
            </div></Card>

            {/* Recall & Traceability */}
            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text,fontWeight:700,fontSize:14,marginBottom:2}}>🔍 Recall & Traceability</p>
              <p style={{color:t.sub,fontSize:11,marginBottom:12}}>Settings for product recall readiness and customer-batch linking</p>
              {[
                {key:"prodAutoLinkDeliveries",label:"Auto-Link Deliveries to Batches",desc:"Automatically link same-date deliveries to a batch when it's saved",icon:"🔗",defOn:true},
                {key:"prodTraceabilityInPDF",label:"Include Traceability in PDF Trail",desc:"Show customer breakdown per batch in the Batch Paper Trail PDF export",icon:"📄",defOn:true},
                {key:"prodShowLinkedInvoices",label:"Show Linked Invoices on Batch Card",desc:"Display invoice numbers linked to this batch on the production tab",icon:"🧾",defOn:true},
              ].map(({key,label,desc,icon,defOn})=>(
                <div key={key} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                  <div className="flex-1 min-w-0 pr-4">
                    <p style={{color:t.text}} className="text-sm font-semibold">{icon} {label}</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">{desc}</p>
                  </div>
                  <Tog dm={dm} on={settings?.[key]!==undefined?settings[key]:defOn} onChange={()=>setSettings(s=>({...s,[key]:!(s?.[key]!==undefined?s[key]:defOn)}))}/>
                </div>
              ))}
              {/* One-time migration: stamp batchId onto existing deliveries */}
              <div style={{marginTop:14,padding:"12px 14px",background:dm?"rgba(124,58,237,0.08)":"rgba(124,58,237,0.05)",border:`1.5px solid rgba(124,58,237,0.25)`,borderRadius:12}}>
                <p style={{color:"#8b5cf6",fontWeight:700,fontSize:13,marginBottom:3}}>🔧 Backfill Batch Assignments</p>
                <p style={{color:t.sub,fontSize:11,marginBottom:10}}>Existing deliveries have no batch assigned yet. This will assign each delivery to the first matching batch on that date. Deliveries that already have a manual assignment are skipped.</p>
                {(()=>{
                  const unlinked=deliveries.filter(d=>!d.batchId&&d.status!=="Cancelled");
                  const linkable=unlinked.filter(d=>Object.entries(safeO(d.orderLines)).some(([pid,l])=>{if(!(l.qty>0))return false;const p=products.find(x=>x.id===pid);return (prodTargets||[]).some(pt=>pt.date===d.date&&prodNamesMatch(p?.name||l.name||"",pt.product));}));
                  return <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                    <p style={{color:t.sub,fontSize:11}}>{linkable.length > 0 ? `${linkable.length} deliveries can be backfilled` : "✅ All deliveries already assigned"}</p>
                    {linkable.length>0&&<button onClick={()=>ask(`Backfill batch assignments for ${linkable.length} existing deliveries? Each will be assigned to the first matching batch on its date. This cannot be undone.`,()=>{
                      setDeliv(prev=>safeArr(prev).map(d=>{
                        if(d.batchId||d.status==="Cancelled")return d;
                        // Find all batches on this date matching any product in this delivery
                        const matchingBatches=(prodTargets||[]).filter(pt=>pt.date===d.date&&pt.product&&Object.entries(safeO(d.orderLines)).some(([pid,l])=>{if(!(l.qty>0))return false;const p=products.find(x=>x.id===pid);return prodNamesMatch(p?.name||l.name||"",pt.product);}));
                        if(!matchingBatches.length)return d;
                        // Sort by createdAt ascending — assign to earliest batch
                        const sorted=[...matchingBatches].sort((a,b)=>(a.createdAt||"").localeCompare(b.createdAt||""));
                        return {...d,batchId:sorted[0].batchId||sorted[0].id};
                      }));
                      notify(`Backfilled batch assignments ✓`);
                      addLog("Backfilled batch assignments",`${linkable.length} deliveries updated`);
                    })} style={{background:"#8b5cf6",color:"#fff",border:"none",borderRadius:10,padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"manipulation",minHeight:36}}>
                      🔗 Backfill {linkable.length} Deliveries
                    </button>}
                  </div>;
                })()}
              </div>
            </div></Card>

            {/* Wastage Settings */}
            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text,fontWeight:700,fontSize:14,marginBottom:2}}>🗑️ Wastage Controls</p>
              <p style={{color:t.sub,fontSize:11,marginBottom:12}}>Settings for wastage logging behaviour</p>
              {[
                {key:"wastageRequireReason",label:"Require Wastage Reason",desc:"Factory must fill in a reason before saving a wastage entry",icon:"📝",defOn:false},
                {key:"wastageRequireCost",label:"Require Wastage Cost",desc:"Factory must enter the estimated cost impact for each wastage entry",icon:"💰",defOn:false},
                {key:"wastageAlertThreshold",label:"Wastage Alert in Dashboard",desc:"Show wastage alert on dashboard when today's total exceeds threshold",icon:"⚠️",defOn:true},
              ].map(({key,label,desc,icon,defOn})=>(
                <div key={key} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                  <div className="flex-1 min-w-0 pr-4">
                    <p style={{color:t.text}} className="text-sm font-semibold">{icon} {label}</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">{desc}</p>
                  </div>
                  <Tog dm={dm} on={settings?.[key]!==undefined?settings[key]:defOn} onChange={()=>setSettings(s=>({...s,[key]:!(s?.[key]!==undefined?s[key]:defOn)}))}/>
                </div>
              ))}
            </div></Card>

            {/* QC Settings */}
            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text,fontWeight:700,fontSize:14,marginBottom:2}}>✅ Quality Control (QC)</p>
              <p style={{color:t.sub,fontSize:11,marginBottom:12}}>Settings for QC checks and grading</p>
              {[
                {key:"qcEmbedInBatch",label:"Embed QC in Batch Form",desc:"Show QC checks section directly inside the Log New Batch sheet",icon:"📋",defOn:true},
                {key:"qcRequireChecker",label:"Require Inspector Name",desc:"QC check must have an inspector name before saving",icon:"👤",defOn:false},
                {key:"qcAlertOnFail",label:"Alert on QC Fail (Grade F)",desc:"Show a warning notification when a batch gets a failing QC grade",icon:"🚨",defOn:true},
              ].map(({key,label,desc,icon,defOn})=>(
                <div key={key} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                  <div className="flex-1 min-w-0 pr-4">
                    <p style={{color:t.text}} className="text-sm font-semibold">{icon} {label}</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">{desc}</p>
                  </div>
                  <Tog dm={dm} on={settings?.[key]!==undefined?settings[key]:defOn} onChange={()=>setSettings(s=>({...s,[key]:!(s?.[key]!==undefined?s[key]:defOn)}))}/>
                </div>
              ))}
            </div></Card>

            {/* Default Batch Units Presets */}
            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text,fontWeight:700,fontSize:14,marginBottom:2}}>⚡ Batch Unit Presets</p>
              <p style={{color:t.sub,fontSize:11,marginBottom:12}}>Quick-tap unit presets shown in the Log New Batch form</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {(settings?.batchUnitPresets||[50,100,150,200,250,300]).map((n,i)=>(
                  <div key={i} className="flex items-center gap-1" style={{background:t.inp,border:`1px solid ${t.inpB}`,borderRadius:8,paddingLeft:8,paddingRight:4,paddingTop:3,paddingBottom:3}}>
                    <span style={{color:t.text,fontSize:12,fontWeight:700}}>{n}</span>
                    <button onClick={()=>setSettings(s=>({...s,batchUnitPresets:(s.batchUnitPresets||[50,100,150,200,250,300]).filter((_,j)=>j!==i)}))} style={{color:"#ef4444",fontWeight:700,fontSize:14,background:"none",border:"none",cursor:"pointer",padding:"0 4px",lineHeight:1}}>✕</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input id="new_batchPreset" type="number" placeholder="e.g. 500"
                  style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,flex:1,borderRadius:10,padding:"8px 12px",fontSize:12,outline:"none"}}/>
                <button onClick={()=>{const el=document.getElementById("new_batchPreset");const v=+el.value;if(v>0){setSettings(s=>({...s,batchUnitPresets:[...(s.batchUnitPresets||[50,100,150,200,250,300]),v].sort((a,b)=>a-b)}));el.value="";}}}
                  style={{background:"#8b5cf6",color:"#fff",borderRadius:10,padding:"8px 16px",fontSize:12,fontWeight:700,border:"none",cursor:"pointer"}}>Add</button>
              </div>
            </div></Card>
          </>}

          {/* ── ACCESS CONTROL ── */}
          {settingsSection==="access"&&<>
            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text}} className="text-sm font-bold mb-1">Wastage Tab Access</p>
              <p style={{color:t.sub}} className="text-[11px] mb-3">Which roles can log and view wastage records.</p>
              {["admin","factory","agent"].map(role=>{
                const on=(settings?.showWastageTo||["admin","factory"]).includes(role);
                return <div key={role} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                  <div><span style={{color:t.text}} className="text-sm font-medium capitalize">{role}</span>{role==="admin"&&<span style={{color:t.sub}} className="text-[10px] ml-2">always has access</span>}</div>
                <Tog dm={dm} on={role==="admin"?true:on} onChange={()=>{if(role==="admin")return;setSettings(s=>({...s,showWastageTo:on?(s.showWastageTo||[]).filter(r=>r!==role):[...(s.showWastageTo||[]),role]}));}}/>
              </div>;
            })}
            <p style={{color:t.text}} className="text-xs font-semibold mt-4 mb-2">Show cost/loss data in Wastage to:</p>
            {["admin","factory","agent"].map(role=>{
              const key="showWasteCostTo"; const on=(settings?.[key]||["admin"]).includes(role);
              return <div key={role} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                <div><span style={{color:t.text}} className="text-sm font-medium capitalize">{role}</span>{role==="admin"&&<span style={{color:t.sub}} className="text-[10px] ml-2">always visible</span>}</div>
                <Tog dm={dm} on={role==="admin"?true:on} onChange={()=>{if(role==="admin")return;setSettings(s=>({...s,[key]:on?(s[key]||[]).filter(r=>r!==role):[...(s[key]||[]),role]}));}}/>
              </div>;
            })}
            <Hr dm={dm}/>
            <p style={{color:t.text}} className="text-sm font-bold mt-3 mb-1">Price & Financial Visibility</p>
            <p style={{color:t.sub}} className="text-[11px] mb-3">Hidden roles see quantities only — no amounts shown anywhere.</p>
            <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-2">Show prices to:</p>
            {["admin","factory","agent"].map(role=>{
              const on=(settings?.showPricesTo||["admin"]).includes(role);
              return <div key={role} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                <div><span style={{color:t.text}} className="text-sm font-medium capitalize">{role}</span>{role==="admin"&&<span style={{color:t.sub}} className="text-[10px] ml-2">always visible</span>}</div>
                <Tog dm={dm} on={role==="admin"?true:on} onChange={()=>{if(role==="admin")return;setSettings(s=>({...s,showPricesTo:on?(s.showPricesTo||[]).filter(r=>r!==role):[...(s.showPricesTo||[]),role]}));}}/>
              </div>;
            })}
            <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mt-4 mb-2">Show financial summaries to:</p>
            {["admin","factory","agent"].map(role=>{
              const on=(settings?.showFinancialsTo||["admin"]).includes(role);
              return <div key={role} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                <div><span style={{color:t.text}} className="text-sm font-medium capitalize">{role}</span>{role==="admin"&&<span style={{color:t.sub}} className="text-[10px] ml-2">always visible</span>}</div>
                <Tog dm={dm} on={role==="admin"?true:on} onChange={()=>{if(role==="admin")return;setSettings(s=>({...s,showFinancialsTo:on?(s.showFinancialsTo||[]).filter(r=>r!==role):[...(s.showFinancialsTo||[]),role]}));}}/>
              </div>;
            })}
          </div></Card>
          </>}

          {/* ── APP BRANDING ── */}
          {settingsSection==="app"&&<>
            {/* Live preview strip */}
            <div style={{background:t.accent,borderRadius:16,padding:"16px 20px",display:"flex",alignItems:"center",gap:14}}>
              <span style={{fontSize:36,lineHeight:1}}>{settings?.appEmoji||"🫓"}</span>
              <div>
                <p style={{color:"#fff",fontWeight:900,fontSize:16,lineHeight:1.2}}>{settings?.appName||"TAS Healthy World"}</p>
                <p style={{color:"rgba(255,255,255,0.6)",fontSize:11,marginTop:3}}>{settings?.appSubtitle||"Paratha Factory · Operations"}</p>
                {settings?.brandTagline&&<p style={{color:"rgba(255,255,255,0.5)",fontSize:10,marginTop:3,fontStyle:"italic"}}>"{settings.brandTagline}"</p>}
              </div>
            </div>

            {/* Language selector */}
            <Card dm={dm}><div className="p-4 flex flex-col gap-3">
              <p style={{color:t.text}} className="text-sm font-bold">🌐 Language</p>
              <p style={{color:t.sub,fontSize:11}}>Changes tab labels, status strings, and UI text across the entire app for all users.</p>
              <div className="crm-btn-group">
                {[{code:"en",label:"🇬🇧 English"},{code:"hi",label:"🇮🇳 हिन्दी"},{code:"mr",label:"🇮🇳 मराठी"},{code:"ml",label:"🇮🇳 മലയാളം"}].map(lang=>(
                  <button key={lang.code} onClick={()=>{setSettings(s=>({...s,defaultLanguage:lang.code,language:lang.code}));setAppLang(lang.code);}}
                    style={{background:(settings?.defaultLanguage||"en")===lang.code?t.accent:t.inp,color:(settings?.defaultLanguage||"en")===lang.code?t.accentFg:t.sub,border:`1.5px solid ${(settings?.defaultLanguage||"en")===lang.code?t.accent:t.border}`,borderRadius:10,padding:"8px 16px",fontSize:13,fontWeight:700,cursor:"pointer",transition:"all 0.15s"}}>
                    {lang.label}
                  </button>
                ))}
              </div>
              <p style={{color:t.sub,fontSize:10}}>Selected: <b style={{color:t.text}}>{({en:"English",hi:"हिन्दी (Hindi)",mr:"मराठी (Marathi)",ml:"മലയാളം (Malayalam)"})[settings?.defaultLanguage||"en"]}</b> — applies everywhere immediately</p>
            </div></Card>

            <Card dm={dm}><div className="p-4 flex flex-col gap-3">
              <p style={{color:t.text}} className="text-sm font-bold">🖼️ Company Logo</p>
              <p style={{color:t.sub}} className="text-[11px]">Upload your logo to display it on invoices, receipts, and PDF exports. Recommended: PNG or JPG, square or landscape, under 500KB.</p>
              {settings?.companyLogo&&<div style={{background:t.inp,borderRadius:12,padding:12,display:"flex",alignItems:"center",gap:12,border:`1.5px solid ${t.border}`}}>
                <img src={settings.companyLogo} alt="Logo" style={{maxHeight:60,maxWidth:120,objectFit:"contain",borderRadius:8,background:"#fff",padding:4,border:`1px solid ${t.border}`}}/>
                <div className="flex-1">
                  <p style={{color:t.text,fontSize:12,fontWeight:700}}>Logo uploaded ✓</p>
                  <p style={{color:t.sub,fontSize:10}}>Used on invoices, receipts, and PDF exports</p>
                </div>
                <button onClick={()=>setSettings(s=>({...s,companyLogo:""}))} style={{background:"#ef444415",color:"#ef4444",border:"1px solid #ef444430",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>Remove</button>
              </div>}
              <label style={{display:"flex",alignItems:"center",gap:10,background:t.inp,border:`2px dashed ${t.inpB}`,borderRadius:12,padding:"14px 16px",cursor:"pointer",transition:"border-color 0.15s"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor="#f59e0b"}
                onMouseLeave={e=>e.currentTarget.style.borderColor=t.inpB}>
                <span style={{fontSize:28}}>📁</span>
                <div>
                  <p style={{color:t.text,fontSize:13,fontWeight:700}}>{settings?.companyLogo?"Replace logo":"Upload logo"}</p>
                  <p style={{color:t.sub,fontSize:11}}>PNG, JPG, SVG · max 500KB</p>
                </div>
                <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
                  const file=e.target.files?.[0];
                  if(!file)return;
                  if(file.size>600000){alert("File too large. Please use an image under 500KB.");return;}
                  const reader=new FileReader();
                  reader.onload=ev=>setSettings(s=>({...s,companyLogo:ev.target.result}));
                  reader.readAsDataURL(file);
                  e.target.value="";
                }}/>
              </label>
            </div></Card>

            <Card dm={dm}><div className="p-4 flex flex-col gap-3">
              <p style={{color:t.text}} className="text-sm font-bold">🎨 App Identity</p>
              <Inp dm={dm} label="App Name" value={settings?.appName||""} onChange={e=>setSettings(s=>({...s,appName:e.target.value}))} placeholder="TAS Healthy World"/>
              <Inp dm={dm} label="Subtitle" value={settings?.appSubtitle||""} onChange={e=>setSettings(s=>({...s,appSubtitle:e.target.value}))} placeholder="Paratha Factory · Operations"/>
              <Inp dm={dm} label="Tagline (optional)" value={settings?.brandTagline||""} onChange={e=>setSettings(s=>({...s,brandTagline:e.target.value}))} placeholder="Fresh. Local. Delivered."/>
              <div>
                <label style={{color:t.sub,letterSpacing:"0.05em"}} className="crm-form-label block text-[11px] font-semibold uppercase mb-1.5">Emoji / Icon</label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {["🫓","🍽️","🏭","🌿","🥘","🍲","🌾","🚚","⚡","🔥"].map(e=>(
                    <button key={e} onClick={()=>setSettings(s=>({...s,appEmoji:e}))} style={{fontSize:22,background:settings?.appEmoji===e?t.accent+"22":t.inp,border:`2px solid ${settings?.appEmoji===e?t.accent:t.border}`,borderRadius:10,padding:"6px 10px",cursor:"pointer",transition:"all 0.15s"}}>{e}</button>
                  ))}
                </div>
                <Inp dm={dm} label="Custom emoji" value={settings?.appEmoji||""} onChange={e=>setSettings(s=>({...s,appEmoji:e.target.value}))} placeholder="🫓"/>
              </div>
            </div></Card>

            <Card dm={dm}><div className="p-4 flex flex-col gap-3">
              <p style={{color:t.text}} className="text-sm font-bold">🏢 Company Details (used on Invoices & Receipts)</p>
              <Inp dm={dm} label="Company Name" value={settings?.companyName||""} onChange={e=>setSettings(s=>({...s,companyName:e.target.value}))} placeholder="TAS Healthy World"/>
              <Inp dm={dm} label="Company Subtitle" value={settings?.companySubtitle||""} onChange={e=>setSettings(s=>({...s,companySubtitle:e.target.value}))} placeholder="Malabar Paratha Factory · Goa, India"/>
              <Inp dm={dm} label="Address" value={settings?.companyAddress||""} onChange={e=>setSettings(s=>({...s,companyAddress:e.target.value}))} placeholder="123 Factory Road, Goa 403001"/>
              <Inp dm={dm} label="Phone" value={settings?.companyPhone||""} onChange={e=>setSettings(s=>({...s,companyPhone:e.target.value}))} placeholder="+91 98765 43210"/>
              <Inp dm={dm} label="GST Number" value={settings?.companyGST||""} onChange={e=>setSettings(s=>({...s,companyGST:e.target.value}))} placeholder="22AAAAA0000A1Z5"/>
              <Inp dm={dm} label="Email" value={settings?.companyEmail||""} onChange={e=>setSettings(s=>({...s,companyEmail:e.target.value}))} placeholder="info@yourbusiness.com"/>
              <Inp dm={dm} label="Website" value={settings?.companyWebsite||""} onChange={e=>setSettings(s=>({...s,companyWebsite:e.target.value}))} placeholder="www.yourbusiness.com"/>
              <Inp dm={dm} label="Invoice Footer Note (optional)" value={settings?.invoiceFooterNote||""} onChange={e=>setSettings(s=>({...s,invoiceFooterNote:e.target.value}))} placeholder="Thank you for your business! Payment due within 7 days."/>
              <div>
                <label style={{color:t.sub,letterSpacing:"0.05em"}} className="crm-form-label block text-[11px] font-semibold uppercase mb-1.5">Payment Terms</label>
                <div className="crm-btn-group">
                  {["Immediate","Net 7","Net 15","Net 30","COD"].map(pt=>(
                    <button key={pt} onClick={()=>setSettings(s=>({...s,paymentTerms:pt}))} style={{background:settings?.paymentTerms===pt?"#10b981":t.inp,color:settings?.paymentTerms===pt?"#fff":t.sub,border:`1.5px solid ${settings?.paymentTerms===pt?"#10b981":t.border}`,borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer"}}>{pt}</button>
                  ))}
                </div>
              </div>
            </div></Card>
            <Card dm={dm}><div className="p-4 flex flex-col gap-3">
              <p style={{color:t.text}} className="text-sm font-bold">🌤 Weather Widget Location</p>
              <p style={{color:t.sub}} className="text-[11px]">Set the location for the weather widget on the Dashboard. Latitude and longitude can be found via Google Maps.</p>
              <Inp dm={dm} label="Location Label" value={settings?.weatherLabel||"Goa"} onChange={e=>setSettings(s=>({...s,weatherLabel:e.target.value}))} placeholder="Goa"/>
              <div className="crm-grid-2" style={{gap:3*4}}>
                <Inp dm={dm} label="Latitude" value={settings?.weatherLat??15.4909} onChange={e=>setSettings(s=>({...s,weatherLat:+e.target.value||15.4909}))} placeholder="15.4909"/>
                <Inp dm={dm} label="Longitude" value={settings?.weatherLng??73.8278} onChange={e=>setSettings(s=>({...s,weatherLng:+e.target.value||73.8278}))} placeholder="73.8278"/>
              </div>
            </div></Card>
            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text}} className="text-sm font-bold mb-3">Dashboard Widgets</p>
              {[{key:"stats",label:"Stat Cards"},{key:"chart",label:"Revenue Chart"},{key:"pendingDeliveries",label:"Pending Deliveries"},{key:"outstanding",label:"Outstanding Payments"},{key:"wastageToday",label:"Today's Wastage"},{key:"weather",label:"🌤 Weather Widget (Goa)"},{key:"quickActions",label:"⚡ Quick Actions"},{key:"productionBar",label:"🏭 Daily Production Progress"}].map(w=>{
                const on=(settings?.dashWidgets||[]).includes(w.key);
                return <div key={w.key} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                  <span style={{color:t.text}} className="text-sm">{w.label}</span>
                  <Tog dm={dm} on={on} onChange={()=>setSettings(s=>({...s,dashWidgets:on?(s.dashWidgets||[]).filter(k=>k!==w.key):[...(s.dashWidgets||[]),w.key]}))}/>
                </div>;
              })}
            </div></Card>
            {/* Quick Actions configuration */}
            {(settings?.dashWidgets||[]).includes("quickActions")&&<Card dm={dm}><div className="p-4">
              <p style={{color:t.text}} className="text-sm font-bold mb-1">Quick Action Buttons</p>
              <p style={{color:t.sub}} className="text-[11px] mb-3">Choose which actions appear on the dashboard. Up to 8 buttons.</p>
              {[{key:"newDelivery",icon:"🚚",label:"New Delivery"},{key:"newCustomer",icon:"👤",label:"New Customer"},{key:"markDone",icon:"✅",label:"Mark Delivered"},{key:"logWastage",icon:"🗑️",label:"Log Wastage"},{key:"addExpense",icon:"💸",label:"Add Expense"},{key:"logSupply",icon:"📦",label:"Log Supply"},{key:"logProduction",icon:"🏭",label:"Log Production"},{key:"qcCheck",icon:"✅",label:"QC Check"}].map(q=>{
                const on=(settings?.quickActions||[]).includes(q.key);
                return <div key={q.key} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                  <span style={{color:t.text}} className="text-sm">{q.icon} {q.label}</span>
                  <Tog dm={dm} on={on} onChange={()=>setSettings(s=>({...s,quickActions:on?(s.quickActions||[]).filter(k=>k!==q.key):[...(s.quickActions||[]),q.key]}))}/>
                </div>;
              })}
            </div></Card>}
            {/* PIN Mode */}
            <Card dm={dm}><div className="p-4">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <p style={{color:t.text}} className="text-sm font-bold">PIN Login Mode</p>
                  <p style={{color:t.sub}} className="text-[11px] mt-0.5">Staff can log in with a 4-digit PIN instead of their password. PINs are set per user account.</p>
                </div>
                <Tog dm={dm} on={settings?.pinMode||false} onChange={()=>setSettings(s=>({...s,pinMode:!s.pinMode}))}/>
              </div>
              {settings?.pinMode&&<div style={{background:"#f59e0b10",border:"1px solid #f59e0b30",borderRadius:10,padding:"10px 12px",marginTop:12}}>
                <p style={{color:"#f59e0b"}} className="text-[11px] font-semibold">✓ PIN mode active — set PINs per user in Staff → Edit account</p>
              </div>}
            </div></Card>
          </>}

          {/* ── ALERTS & NOTIFICATIONS ── */}
          {settingsSection==="alerts"&&<>
            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text,fontWeight:700,fontSize:14,marginBottom:2}}>🔔 Alert Toggles</p>
              <p style={{color:t.sub,fontSize:11,marginBottom:12}}>Control which alerts fire across the system. Browser push + in-app notifications both follow these settings.</p>
              {[
                {key:"alertLowStock",label:"Low Stock Alert",desc:"Alert when a supply item falls below the threshold",icon:"⚠️",defOn:true},
                {key:"alertOverdueDelivery",label:"Overdue Delivery Alert",desc:"Alert when a delivery is past its expected date",icon:"🔴",defOn:true},
                {key:"alertChurnRisk",label:"Churn Risk Alert",desc:"Alert when a customer has been inactive for too long",icon:"💤",defOn:true},
                {key:"alertPaymentReceived",label:"Payment Received",desc:"Alert when a payment is recorded for any customer",icon:"💰",defOn:true},
                {key:"alertNewOrder",label:"New Order Created",desc:"Alert when a new delivery order is saved",icon:"📦",defOn:false},
                {key:"alertDailyReport",label:"Daily Summary",desc:"Morning briefing notification",icon:"☀️",defOn:false},
              ].map(({key,label,desc,icon,defOn})=>(
                <div key={key} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                  <div className="flex-1 pr-4">
                    <p style={{color:t.text}} className="text-sm font-semibold">{icon} {label}</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">{desc}</p>
                  </div>
                  <Tog dm={dm} on={settings?.[key]!==undefined?settings[key]:defOn} onChange={()=>setSettings(s=>({...s,[key]:!(s?.[key]!==undefined?s[key]:defOn)}))}/>
                </div>
              ))}
            </div></Card>

            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text,fontWeight:700,fontSize:14,marginBottom:2}}>📣 Who gets notified</p>
              <p style={{color:t.sub,fontSize:11,marginBottom:12}}>Choose which roles receive each type of notification</p>
              {[
                {key:"payment",label:"Payment events",icon:"💰"},
                {key:"delivery",label:"Delivery events",icon:"📦"},
                {key:"lowstock",label:"Low stock alerts",icon:"⚠️"},
                {key:"newentry",label:"New entries (general)",icon:"📝"},
                {key:"noticeboard",label:"Noticeboard posts",icon:"📌"},
              ].map(({key,label,icon})=>{
                const cur=settings?.notifTargets?.[key]||[];
                return <div key={key} style={{borderBottom:`1px solid ${t.border}`,paddingBottom:12,marginBottom:12}}>
                  <p style={{color:t.text,fontSize:12,fontWeight:700,marginBottom:8}}>{icon} {label}</p>
                  <div className="crm-btn-group">
                    {["admin","factory","agent"].map(role=>{
                      const on=cur.includes(role);
                      return <button key={role} onClick={()=>{const next=on?cur.filter(r=>r!==role):[...cur,role];setSettings(s=>({...s,notifTargets:{...(s.notifTargets||{}),[key]:next}}));}}
                        style={{background:on?t.accent:t.inp,color:on?t.accentFg:t.sub,border:`1.5px solid ${on?t.accent:t.border}`,borderRadius:20,padding:"5px 14px",fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"capitalize",transition:"all 0.15s"}}>{role}</button>;
                    })}
                  </div>
                </div>;
              })}
            </div></Card>

            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text,fontWeight:700,fontSize:14,marginBottom:2}}>⚙️ Alert Thresholds</p>
              <div className="flex flex-col gap-3 mt-2">
                <div>
                  <label style={{color:t.sub,letterSpacing:"0.05em"}} className="crm-form-label block text-[11px] font-semibold uppercase mb-1.5">Low Stock Threshold (units)</label>
                  <input type="number" min={0} value={settings?.lowStockThreshold??5} onChange={e=>setSettings(s=>({...s,lowStockThreshold:+e.target.value}))} style={{background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:12,padding:"10px 14px",fontSize:16,width:"100%",outline:"none"}}/>
                  <p style={{color:t.sub,fontSize:10,marginTop:4}}>Alert fires when any supply item qty ≤ this value</p>
                </div>
                <div>
                  <label style={{color:t.sub,letterSpacing:"0.05em"}} className="crm-form-label block text-[11px] font-semibold uppercase mb-1.5">Churn Alert Days</label>
                  <input type="number" min={1} value={settings?.churnDays??14} onChange={e=>setSettings(s=>({...s,churnDays:+e.target.value}))} style={{background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:12,padding:"10px 14px",fontSize:16,width:"100%",outline:"none"}}/>
                  <p style={{color:t.sub,fontSize:10,marginTop:4}}>Alert fires if a customer has no orders for this many days</p>
                </div>
                <div>
                  <label style={{color:t.sub,letterSpacing:"0.05em"}} className="crm-form-label block text-[11px] font-semibold uppercase mb-1.5">Auto Backup Reminder (days)</label>
                  <input type="number" min={1} value={settings?.autoBackupReminder??7} onChange={e=>setSettings(s=>({...s,autoBackupReminder:+e.target.value}))} style={{background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:12,padding:"10px 14px",fontSize:16,width:"100%",outline:"none"}}/>
                  <p style={{color:t.sub,fontSize:10,marginTop:4}}>Reminder fires if no backup taken in this many days</p>
                </div>
              </div>
            </div></Card>
          </>}

          {/* ── SECURITY & ACTIVE SESSIONS ── */}
          {settingsSection==="security"&&<>
            <SecuritySessions dm={dm} t={t} ask={ask} addLog={addLog} notify={notify}/>

              {/* ── PASSKEY / BIOMETRIC MANAGEMENT ── */}
              <Card dm={dm}><div className="p-4">
                <p style={{color:t.text,fontWeight:700,fontSize:14,marginBottom:2}}>🔑 Passkeys & Biometrics</p>
                <p style={{color:t.sub,fontSize:11,marginBottom:14}}>Register a passkey for passwordless login using Face ID, fingerprint, or Windows Hello on this device.</p>
                {(settings?.secBiometricEnabled!==false)
                  ? <PasskeyManager dm={dm} t={t} sess={sess} notify={notify} ask={ask} addLog={addLog}/>
                  : <p style={{color:"#ef4444",fontSize:12,fontWeight:600}}>⚠️ Biometric login is disabled by the admin. Enable it in Security Settings above.</p>}
              </div></Card>

              <Card dm={dm}><div className="p-4">
                <p style={{color:t.text,fontWeight:700,fontSize:14,marginBottom:2}}>🔐 Security Settings</p>
                <p style={{color:t.sub,fontSize:11,marginBottom:12}}>Account protection and access controls</p>
                {[
                  {key:"secRequire2FAAdmin",label:"Require PIN Verification for Admin Actions",desc:"Admin must enter their PIN before deleting data or resetting counters",icon:"🔑",defOn:false},
                  {key:"secAutoLogoutIdle",label:"Auto-Logout After Inactivity",desc:"Automatically log out after 30 minutes of no activity",icon:"⏱",defOn:false},
                  {key:"secLogFailedLogins",label:"Log Failed Login Attempts",desc:"Record failed login attempts in the audit log",icon:"⚠️",defOn:true},
                  {key:"secShowLastLogin",label:"Show Last Login Info on Login Screen",desc:"Display last login time when signing in",icon:"📋",defOn:true},
                  {key:"secBiometricEnabled",label:"Enable Biometric / Passkey Login",desc:"Allow users to register Face ID, fingerprint, or Windows Hello for passwordless login. Admin controls which accounts can use this.",icon:"🫆",defOn:true},
                ].map(({key,label,desc,icon,defOn})=>(
                  <div key={key} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                    <div className="flex-1 min-w-0 pr-4">
                      <p style={{color:t.text}} className="text-sm font-semibold">{icon} {label}</p>
                      <p style={{color:t.sub}} className="text-[11px] mt-0.5">{desc}</p>
                    </div>
                    <Tog dm={dm} on={settings?.[key]!==undefined?settings[key]:defOn} onChange={()=>setSettings(s=>({...s,[key]:!(s?.[key]!==undefined?s[key]:defOn)}))}/>
                  </div>
                ))}
              </div></Card>

              <Card dm={dm}><div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p style={{color:t.text,fontWeight:700,fontSize:14}}>📋 Enhanced Audit Log</p>
                  <button onClick={()=>exportCSV(actLog,"audit_log",[{label:"Time",key:"ts"},{label:"User",key:"user"},{label:"Role",key:"role"},{label:"Action",key:"action"},{label:"Detail",key:"detail"},{label:"Browser",key:"browser"},{label:"OS",key:"os"},{label:"Device",key:"deviceType"}])}
                    style={{color:"#10b981",fontSize:11,fontWeight:700,background:"none",border:"none",cursor:"pointer"}}>Export CSV</button>
                </div>
                <p style={{color:t.sub,fontSize:11,marginBottom:12}}>Full activity trail with device and user context. Shows up to 200 most recent events.</p>
                {actLog.length===0?<p style={{color:t.sub,fontSize:12,textAlign:"center",padding:"16px 0"}}>No activity recorded yet.</p>
                :actLog.slice(0,200).map(l=>(
                  <div key={l.id} style={{borderBottom:`1px solid ${t.border}`,padding:"8px 0"}} className="last:border-0">
                    <div className="flex items-start justify-between gap-2">
                      <span style={{color:t.text,fontSize:12,fontWeight:600,flex:1}}>{l.action}</span>
                      <span style={{color:t.sub,fontSize:10,whiteSpace:"nowrap",flexShrink:0}}>{l.ts}</span>
                    </div>
                    <p style={{color:t.sub,fontSize:11,marginTop:1}}>{l.detail}</p>
                    <div className="flex gap-x-3 flex-wrap mt-1">
                      <span style={{color:t.sub,fontSize:9}}>👤 {l.user||"—"} ({l.role||"—"})</span>
                      {l.browser&&<span style={{color:t.sub,fontSize:9}}>🌐 {l.browser}</span>}
                      {l.os&&<span style={{color:t.sub,fontSize:9}}>💻 {l.os}</span>}
                      {l.deviceType&&<span style={{color:t.sub,fontSize:9}}>📱 {l.deviceType}</span>}
                    </div>
                  </div>
                ))}
              </div></Card>

              <FailedLoginAttempts dm={dm} t={t} ask={ask} notify={notify}/>
          </>}

          {/* ── DATA / BACKUP ── */}
          {settingsSection==="data"&&<>
            <Card dm={dm}><div className="p-4 flex flex-col gap-3">
              <p style={{color:t.text}} className="text-sm font-bold">🗄️ Backup & Restore</p>
              {(()=>{
                const daysSince=lastBackupDate?Math.round((Date.now()-new Date(lastBackupDate).getTime())/86400000):null;
                const noBackup=!lastBackupDate;
                const stale=daysSince!==null&&daysSince>=(settings?.autoBackupReminder||7);
                if(noBackup||stale) return <div style={{background:noBackup?"#ef444415":"#f59e0b15",border:`1px solid ${noBackup?"#ef444430":"#f59e0b30"}`,borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:16}}>{noBackup?"⚠️":"🕐"}</span>
                  <div>
                    <p style={{color:noBackup?"#ef4444":"#f59e0b",fontWeight:700,fontSize:12}}>{noBackup?"No backup recorded yet":"Last backup was "+daysSince+" days ago"}</p>
                    <p style={{color:t.sub,fontSize:11,marginTop:2}}>Export a backup below to protect your data.</p>
                  </div>
                </div>;
                return <div style={{background:"#10b98115",border:"1px solid #10b98130",borderRadius:10,padding:"8px 14px"}}>
                  <p style={{color:"#10b981",fontWeight:700,fontSize:12}}>✓ Last backup: {lastBackupDate} ({daysSince===0?"today":daysSince+"d ago"})</p>
                </div>;
              })()}
              <Btn dm={dm} v="outline" className="w-full" onClick={exportAll}>⬇️ Export Full Backup (JSON)</Btn>
              <Btn dm={dm} v="purple" className="w-full" onClick={exportFullReport}>📊 Export Full Report (PDF — All Data)</Btn>
              <label style={{border:`1px solid ${t.border}`,color:t.text}} className="w-full text-sm font-semibold rounded-xl px-4 py-2.5 text-center cursor-pointer hover:opacity-80 transition-all">
                ⬆️ Import Backup (JSON)<input type="file" accept=".json" className="hidden" onChange={importAll}/>
              </label>
              <Hr dm={dm}/>
              <p style={{color:t.text}} className="text-sm font-bold">Export as CSV</p>
              <div className="crm-btn-group">
                <Btn dm={dm} v="success" size="sm" onClick={()=>exportCSV(customers,"customers",[{label:"Name",key:"name"},{label:"Phone",key:"phone"},{label:"Address",key:"address"},{label:"Paid",key:"paid"},{label:"Pending",key:"pending"},{label:"Status",val:r=>r.pending>0?"UNPAID":"PAID"},{label:"Join Date",key:"joinDate"},{label:"Notes",key:"notes"}])}>Customers</Btn>
                <Btn dm={dm} v="success" size="sm" onClick={()=>exportCSV(deliveries,"deliveries",[{label:"Customer",key:"customer"},{label:"Date",key:"date"},{label:"Deliver By",key:"deliveryDate"},{label:"Status",key:"status"},{label:"Total",val:r=>lineTotal(r.orderLines)},{label:"Invoice No",val:r=>(invRegistry?.issued||{})[r.id]||""},{label:"Replacement",val:r=>r.replacement?.done?"Yes":"No"},{label:"Repl Amount",val:r=>r.replacement?.amount||""},{label:"Address",key:"address"},{label:"By",key:"createdBy"}])}>Deliveries</Btn>
                <Btn dm={dm} v="success" size="sm" onClick={()=>exportCSV(supplies,"supplies",[{label:"Item",key:"item"},{label:"Qty",key:"qty"},{label:"Unit",key:"unit"},{label:"Supplier",key:"supplier"},{label:"Cost",key:"cost"},{label:"Date",key:"date"}])}>Supplies</Btn>
                <Btn dm={dm} v="success" size="sm" onClick={()=>exportCSV(expenses,"expenses",[{label:"Category",key:"category"},{label:"Amount",key:"amount"},{label:"Date",key:"date"},{label:"Notes",key:"notes"}])}>Expenses</Btn>
                <Btn dm={dm} v="success" size="sm" onClick={()=>exportCSV(actLog,"activity",[{label:"Time",key:"ts"},{label:"User",key:"user"},{label:"Role",key:"role"},{label:"Action",key:"action"},{label:"Detail",key:"detail"}])}>Activity Log</Btn>
              </div>
            </div></Card>
            <Card dm={dm}><div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p style={{color:t.text}} className="text-sm font-bold">Activity Log <span style={{color:t.sub}} className="font-normal text-xs">({actLog.length})</span></p>
                <div className="flex gap-3">
                  <button onClick={()=>exportCSV(actLog,"activity",[{label:"Time",key:"ts"},{label:"User",key:"user"},{label:"Role",key:"role"},{label:"Action",key:"action"},{label:"Detail",key:"detail"}])} style={{color:"#10b981"}} className="text-[11px] font-semibold">Export CSV</button>
                  <button onClick={()=>ask("Clear entire activity log?",()=>{setAct([]);notify("Log cleared");})} style={{color:"#ef4444"}} className="text-[11px] font-semibold">Clear</button>
                </div>
              </div>
              {/* Audit Filters */}
              <div className="flex flex-wrap gap-2 mb-3">
                <select value={auditUserFilter} onChange={e=>setAuditUserFilter(e.target.value)}
                  style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,fontSize:11,borderRadius:8,padding:"4px 8px",outline:"none"}}>
                  <option value="all">All users</option>
                  {[...new Set(actLog.map(l=>l.user).filter(Boolean))].map(u=><option key={u}>{u}</option>)}
                </select>
                <select value={auditRoleFilter} onChange={e=>setAuditRoleFilter(e.target.value)}
                  style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,fontSize:11,borderRadius:8,padding:"4px 8px",outline:"none"}}>
                  <option value="all">All roles</option>
                  {["admin","factory","agent"].map(r=><option key={r} value={r} style={{textTransform:"capitalize"}}>{r}</option>)}
                </select>
                <input value={auditActionFilter} onChange={e=>setAuditActionFilter(e.target.value)} placeholder="Filter action…"
                  style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,fontSize:11,borderRadius:8,padding:"4px 8px",outline:"none",minWidth:100,flex:1}}/>
                {(auditUserFilter!=="all"||auditRoleFilter!=="all"||auditActionFilter)&&<button onClick={()=>{setAuditUserFilter("all");setAuditRoleFilter("all");setAuditActionFilter("");}} style={{color:"#f59e0b"}} className="text-[11px] font-semibold">Clear filters</button>}
              </div>
              {(()=>{
                const filtered=actLog.filter(l=>
                  (auditUserFilter==="all"||l.user===auditUserFilter)&&
                  (auditRoleFilter==="all"||l.role===auditRoleFilter)&&
                  (!auditActionFilter||l.action?.toLowerCase().includes(auditActionFilter.toLowerCase())||l.detail?.toLowerCase().includes(auditActionFilter.toLowerCase()))
                );
                return filtered.length===0
                  ?<p style={{color:t.sub}} className="text-xs text-center py-3">{actLog.length===0?"No activity yet.":"No entries match the filters."}</p>
                  :filtered.slice(0,200).map(l=>(
                  <div key={l.id} style={{borderBottom:`1px solid ${t.border}`}} className="py-2 last:border-0">
                    <div className="flex items-start justify-between gap-2"><span style={{color:t.text}} className="text-xs font-semibold flex-1">{l.action}</span><span style={{color:t.sub}} className="text-[10px] shrink-0">{l.user} · {l.role}</span></div>
                    <div className="flex items-start justify-between gap-2 mt-0.5"><span style={{color:t.sub}} className="text-[11px] flex-1">{l.detail}</span><span style={{color:t.sub}} className="text-[10px] shrink-0">{l.ts}</span></div>
                  </div>
                ));
              })()}
            </div></Card>
            <Card dm={dm}><div className="p-4">
              <p style={{color:"#ef4444"}} className="text-sm font-bold mb-1">⚠️ Danger Zone</p>
              <p style={{color:t.sub}} className="text-[11px] mb-3">This will wipe all data and reset to factory defaults. Cannot be undone.</p>
              <Btn dm={dm} v="danger" className="w-full" onClick={()=>ask("Reset ALL data to factory defaults? Cannot be undone.",()=>{setCust(D_CUST);setDeliv(D_DELIV);setSup(D_SUP);setExp(D_EXP);setProd(D_PRODS);setWaste(D_WASTE);const r=[{id:uid(),user:sess.name,role:sess.role,action:"FULL RESET",detail:"All data reset to defaults",ts:ts()}];setAct(r);notify("Reset complete");})}>Reset All Data to Defaults</Btn>
            </div></Card>
          </>}
          </div>{/* end settings content col */}
          </div>{/* end inner desktop row */}
          </div>{/* end settings flex layout */}
          </>;
        })()}
      </div>

      {/* ── MOBILE BOTTOM NAV — Phase 3: fixed 5-tab bar + More drawer ──────── */}
      {(()=>{
        const BN_PRIMARY=["Dashboard","Customers","Deliveries","Payments"];
        const bnTabs=BN_PRIMARY.filter(tb=>TABS.includes(tb));
        const moreTabs=TABS.filter(tb=>!BN_PRIMARY.includes(tb));
        const isMoreActive=moreTabs.includes(tab);
        const moreOpen=showMoreNav; const setMoreOpen=setShowMoreNav;
        return <>
          {/* More drawer backdrop */}
          {moreOpen&&<div onClick={()=>setMoreOpen(false)} style={{position:"fixed",inset:0,zIndex:48,background:"rgba(0,0,0,0.4)",WebkitBackdropFilter:"blur(4px)",backdropFilter:"blur(4px)"}} className="lg:hidden"/>}
          {/* More drawer panel */}
          {moreOpen&&<div style={{position:"fixed",bottom:"calc(68px + env(safe-area-inset-bottom,0px))",left:0,right:0,zIndex:49,background:t.card,borderTop:`1.5px solid ${t.border}`,boxShadow:"0 -8px 32px rgba(0,0,0,0.18)",borderRadius:"20px 20px 0 0",padding:"16px 16px 8px"}} className="lg:hidden">
            <div style={{width:36,height:4,borderRadius:99,background:t.border,margin:"0 auto 16px"}}/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
              {moreTabs.map(tb=>{
                const isA=tab===tb;
                return <button key={tb} onClick={()=>{setTab(tb);setSrch("");setMoreOpen(false);}}
                  style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,padding:"12px 6px",borderRadius:14,background:isA?"#2563eb":"transparent",border:`1.5px solid ${isA?"#2563eb":t.border}`,cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>
                  <span style={{fontSize:22,lineHeight:1}}>{TAB_ICONS[tb]||"•"}</span>
                  <span style={{fontSize:11,fontWeight:isA?700:500,color:isA?"#fff":t.sub,lineHeight:1.2,textAlign:"center"}}>{TAB_LABELS[tb]||tb}</span>
                </button>;
              })}
            </div>
            <div style={{display:"flex",gap:8,marginTop:12,paddingBottom:4}}>
              <button onClick={()=>{setDm(d=>!d);setMoreOpen(false);}} style={{flex:1,padding:"11px",borderRadius:12,border:`1.5px solid ${t.border}`,background:t.inp,color:t.text,fontSize:13,fontWeight:600,cursor:"pointer",WebkitTapHighlightColor:"transparent",display:"flex",alignItems:"center",justifyContent:"center",gap:6,minHeight:46}}>{dm?"☀️ Light":"🌙 Dark"}</button>
              <button onClick={()=>{setMoreOpen(false);onLogout();}} style={{flex:1,padding:"11px",borderRadius:12,border:"1.5px solid rgba(239,68,68,0.3)",background:"rgba(239,68,68,0.08)",color:"#ef4444",fontSize:13,fontWeight:600,cursor:"pointer",WebkitTapHighlightColor:"transparent",display:"flex",alignItems:"center",justifyContent:"center",gap:6,minHeight:46}}>↩ Sign Out</button>
            </div>
          </div>}
          {/* Fixed bottom tab bar */}
          <nav style={{background:t.card,borderTop:`1px solid ${t.border}`,paddingBottom:"env(safe-area-inset-bottom,0px)",boxShadow:"0 -2px 24px rgba(0,0,0,0.13)",zIndex:50,height:"calc(68px + env(safe-area-inset-bottom,0px))",WebkitTransform:"translateZ(0)",transform:"translateZ(0)",willChange:"transform",contain:"layout style",WebkitBackfaceVisibility:"hidden",backfaceVisibility:"hidden"}} className="fixed bottom-0 left-0 right-0 lg:hidden">
            <div style={{display:"flex",alignItems:"stretch",height:68}}>
              {bnTabs.map(tb=>{
                const isA=tab===tb;
                const hasBadge=tb==="Dashboard"&&pendingD.length>0&&!isA;
                return <button key={tb} onClick={()=>{setTab(tb);setSrch("");setMoreOpen(false);}}
                  style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,background:"transparent",border:"none",borderTop:`2.5px solid ${isA?"#2563eb":"transparent"}`,color:isA?"#2563eb":t.sub,cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"manipulation",position:"relative",transition:"all 0.15s",paddingTop:2}}>
                  <span style={{fontSize:22,lineHeight:1}}>{TAB_ICONS[tb]||"•"}</span>
                  <span style={{fontSize:10,fontWeight:isA?700:500,lineHeight:1,letterSpacing:"0.01em"}}>{TAB_LABELS[tb]||tb}</span>
                  {hasBadge&&<span style={{position:"absolute",top:6,right:"calc(50% - 14px)",background:"#ef4444",color:"#fff",fontSize:9,fontWeight:700,borderRadius:99,minWidth:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px",border:`2px solid ${t.card}`}}>{pendingD.length>9?"9+":pendingD.length}</span>}
                </button>;
              })}
              {/* More tab */}
              <button onClick={()=>setMoreOpen(o=>!o)}
                style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,background:"transparent",border:"none",borderTop:`2.5px solid ${isMoreActive||moreOpen?"#2563eb":"transparent"}`,color:isMoreActive||moreOpen?"#2563eb":t.sub,cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"manipulation",position:"relative",transition:"all 0.15s",paddingTop:2}}>
                <span style={{fontSize:22,lineHeight:1}}>⋯</span>
                <span style={{fontSize:10,fontWeight:isMoreActive||moreOpen?700:500,lineHeight:1,letterSpacing:"0.01em"}}>More</span>
                {isMoreActive&&!moreOpen&&<span style={{position:"absolute",top:6,right:"calc(50% - 14px)",background:"#2563eb",width:6,height:6,borderRadius:"50%",border:`2px solid ${t.card}`}}/>}
              </button>
            </div>
          </nav>
        </>;
      })()}

      </div>{/* end desktop flex child */}
    </div>{/* end outer flex */}

      {/* ═══════ SHEETS ═══════ */}

      {/* Customer Sheet */}
      <Sheet dm={dm} open={!!cSh} onClose={()=>setCsh(null)} title={cSh==="add"?"👤 New Customer":"✏️ Edit Customer"}>
        {/* ── IDENTITY SECTION ── */}
        <div style={{background:dm?"rgba(245,158,11,0.06)":"rgba(245,158,11,0.04)",border:`1px solid ${dm?"rgba(245,158,11,0.2)":"rgba(245,158,11,0.15)"}`,borderRadius:16,padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:2}}>
            <div style={{width:36,height:36,borderRadius:10,background:"#f59e0b22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>👤</div>
            <div>
              <p style={{color:t.text,fontWeight:700,fontSize:13,lineHeight:1.2}}>Customer Identity</p>
              <p style={{color:t.sub,fontSize:11}}>Name, contact, and basic info</p>
            </div>
          </div>
          <Inp dm={dm} label="Customer / Business Name *" value={cF.name} onChange={e=>setCf({...cF,name:e.target.value})} placeholder="e.g. Hotel Saffron, Ravi Kumar"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:10}}>
            <Inp dm={dm} label="Phone" value={cF.phone} onChange={e=>setCf({...cF,phone:e.target.value})} placeholder="Mobile number" inputMode="tel" autoComplete="tel"/>
            <Inp dm={dm} label="Customer Since" type="date" value={cF.joinDate} onChange={e=>setCf({...cF,joinDate:e.target.value})}/>
          </div>
          {/* Status toggle inline */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:t.card,borderRadius:12,padding:"10px 14px",border:`1px solid ${t.border}`}}>
            <div>
              <p style={{color:t.text,fontSize:13,fontWeight:600}}>Account Status</p>
              <p style={{color:t.sub,fontSize:11,marginTop:1}}>{cF.active?"This customer is active and will appear in orders":"Inactive — won't appear in new order dropdowns"}</p>
            </div>
            <div style={{display:"flex",gap:4,background:t.inp,borderRadius:10,padding:3,border:`1px solid ${t.border}`}}>
              {[["active","● Active","#10b981"],["inactive","○ Inactive","#6b7280"]].map(([val,lbl,col])=>(
                <button key={val} onClick={()=>setCf({...cF,active:val==="active"})}
                  style={{background:(cF.active?"active":"inactive")===val?col+"22":"transparent",color:(cF.active?"active":"inactive")===val?col:t.sub,border:(cF.active?"active":"inactive")===val?`1.5px solid ${col}40`:"1.5px solid transparent",borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer",transition:"all 0.15s"}}>{lbl}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ── DELIVERY LOCATION ── */}
        <div style={{background:dm?"rgba(14,165,233,0.06)":"rgba(14,165,233,0.04)",border:`1px solid ${dm?"rgba(14,165,233,0.2)":"rgba(14,165,233,0.15)"}`,borderRadius:16,padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:2}}>
            <div style={{width:36,height:36,borderRadius:10,background:"#0ea5e922",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>📍</div>
            <div>
              <p style={{color:t.text,fontWeight:700,fontSize:13,lineHeight:1.2}}>Delivery Location</p>
              <p style={{color:t.sub,fontSize:11}}>Address and GPS coordinates</p>
            </div>
          </div>
          <Inp dm={dm} label="Full Delivery Address" value={cF.address} onChange={e=>setCf({...cF,address:e.target.value})} placeholder="e.g. Shop 4, MG Road, Panaji, Goa"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:10}}>
            <Inp dm={dm} label="GPS Latitude" value={cF.lat} onChange={e=>setCf({...cF,lat:e.target.value})} placeholder="15.4989" inputMode="decimal"/>
            <Inp dm={dm} label="GPS Longitude" value={cF.lng} onChange={e=>setCf({...cF,lng:e.target.value})} placeholder="73.8278" inputMode="decimal"/>
          </div>
          <p style={{color:t.sub,fontSize:11}}>💡 Long-press a location in Google Maps → Share → Copy coordinates to get lat/lng.</p>
          {cF.lat&&cF.lng&&<a href={mapU(cF.address,cF.lat,cF.lng)} target="_blank" rel="noopener noreferrer" style={{background:"#0ea5e915",color:"#0ea5e9",border:"1px solid #0ea5e930",borderRadius:10,padding:"8px 14px",fontSize:12,fontWeight:700,textDecoration:"none",display:"flex",alignItems:"center",gap:6,justifyContent:"center"}}>📍 Preview on Google Maps ↗</a>}
        </div>

        {/* ── REGULAR ORDER TEMPLATE ── */}
        <div style={{background:dm?"rgba(139,92,246,0.06)":"rgba(139,92,246,0.04)",border:`1px solid ${dm?"rgba(139,92,246,0.2)":"rgba(139,92,246,0.15)"}`,borderRadius:16,padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:2}}>
            <div style={{width:36,height:36,borderRadius:10,background:"#8b5cf622",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>📦</div>
            <div>
              <p style={{color:t.text,fontWeight:700,fontSize:13,lineHeight:1.2}}>Regular Order Template</p>
              <p style={{color:t.sub,fontSize:11}}>Default items and quantities for this customer</p>
            </div>
          </div>
          <OrderEditor dm={dm} products={products} orderLines={cF.orderLines||{}} showPrice={canSeePrices} onChange={ol=>setCf(f=>({...f,orderLines:ol}))}/>
        </div>

        {/* ── FINANCIALS ── */}
        {canSeeFinancials&&<div style={{background:dm?"rgba(16,185,129,0.06)":"rgba(16,185,129,0.04)",border:`1px solid ${dm?"rgba(16,185,129,0.2)":"rgba(16,185,129,0.15)"}`,borderRadius:16,padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:2}}>
            <div style={{width:36,height:36,borderRadius:10,background:"#10b98122",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>💰</div>
            <div>
              <p style={{color:t.text,fontWeight:700,fontSize:13,lineHeight:1.2}}>Financial Balances</p>
              <p style={{color:t.sub,fontSize:11}}>Manually set opening balances if needed</p>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:10}}>
            <Inp dm={dm} label="Amount Paid (₹)" type="number" inputMode="numeric" value={cF.paid} onChange={e=>setCf({...cF,paid:e.target.value})}/>
            <Inp dm={dm} label="Amount Pending (₹)" type="number" inputMode="numeric" value={cF.pending} onChange={e=>setCf({...cF,pending:e.target.value})}/>
          </div>
          <Inp dm={dm} label="Partial Payment On Hold (₹)" type="number" inputMode="numeric" value={cF.partialPay||""} onChange={e=>setCf({...cF,partialPay:e.target.value})} placeholder="Amount received but not yet fully applied"/>
          {settings?.featureCreditLimit&&<Inp dm={dm} label="Credit Limit (₹)" type="number" inputMode="numeric" value={cF.creditLimit||""} onChange={e=>setCf({...cF,creditLimit:e.target.value})} placeholder="0 = no limit"/>}
          {(+cF.paid>0||+cF.pending>0)&&<div style={{background:t.card,borderRadius:12,padding:"10px 14px",border:`1px solid ${t.border}`}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
              <span style={{color:"#10b981",fontWeight:600}}>Paid: {inr(+cF.paid||0)}</span>
              <span style={{color:+cF.pending>0?"#ef4444":"#10b981",fontWeight:600}}>{+cF.pending>0?`Pending: ${inr(+cF.pending)}`:"✓ Fully paid"}</span>
            </div>
            {(+cF.paid>0||+cF.pending>0)&&<div style={{height:5,borderRadius:5,overflow:"hidden",background:t.border}}>
              <div style={{width:`${(+cF.paid||0)+( +cF.pending||0)>0?Math.round((+cF.paid||0)/((+cF.paid||0)+(+cF.pending||0))*100):100}%`,height:"100%",background:+cF.pending>0?"#f59e0b":"#10b981",borderRadius:5}}/>
            </div>}
          </div>}
        </div>}

        {/* ── NOTES ── */}
        <div>
          <label style={{color:t.sub,display:"block",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>📝 Notes & Special Instructions</label>
          <textarea value={cF.notes} onChange={e=>setCf({...cF,notes:e.target.value})} placeholder="e.g. Prefers crispy, deliver before 9am, call before arriving…" rows={3}
            style={{width:"100%",background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:14,padding:"10px 14px",fontSize:13,outline:"none",resize:"vertical",fontFamily:"system-ui"}}/>
        </div>

        <Btn dm={dm} onClick={saveC} className="w-full" style={{minHeight:52,fontSize:15,fontWeight:800}}>
          {cSh==="add"?"✓ Add Customer":"✓ Save Changes"}
        </Btn>
      </Sheet>

      {/* Customer View */}
      <Sheet dm={dm} open={!!cView} onClose={()=>setCView(null)} title="Customer Profile">
        {cView&&(()=>{
          const cv=cView;
          const rows=lineRows(cv.orderLines,products);
          const tot=lineTotal(cv.orderLines);
          const cDelivs=[...deliveries.filter(d=>d.customerId===cv.id)].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
          const cDone=cDelivs.filter(d=>d.status==="Delivered");
          const cPending=cDelivs.filter(d=>d.status==="Pending"||d.status==="In Transit");
          const cCancelled=cDelivs.filter(d=>d.status==="Cancelled");
          const cRepls=cDelivs.filter(d=>d.replacement?.done);
          const totalReplAmt=cDelivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
          const totalRevenue=cDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
          const delivRate=cDelivs.length>0?Math.round(cDone.length/cDelivs.length*100):100;
          const lastD=cDelivs[0];
          const lastDays=lastD?Math.floor((new Date()-new Date(lastD.date))/86400000):null;
          const lastLabel=lastDays===null?"Never":lastDays===0?"Today":lastDays===1?"Yesterday":`${lastDays}d ago`;
          const netTot=Math.max(0,tot-totalReplAmt);
          const totalBilled=(cv.paid||0)+(cv.pending||0);
          const payPct=totalBilled>0?Math.round((cv.paid||0)/totalBilled*100):100;
          return (<>
            {/* ── HEADER ── */}
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:4}}>
              <div style={{width:52,height:52,borderRadius:16,background:"#f59e0b22",color:"#f59e0b",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:22,flexShrink:0}}>{cv.name.charAt(0).toUpperCase()}</div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{color:t.text,fontWeight:800,fontSize:17,lineHeight:1.2}}>{cv.name}</p>
                <p style={{color:t.sub,fontSize:12,marginTop:2}}>{cv.phone||"No phone"}</p>
                <span style={{background:cv.active?"#dcfce7":"#f3f4f6",color:cv.active?"#15803d":"#6b7280",fontSize:10,fontWeight:700,padding:"2px 10px",borderRadius:99,display:"inline-block",marginTop:4}}>{cv.active?"● ACTIVE":"○ INACTIVE"}</span>
              </div>
            </div>

            {/* ── CONTACT & INFO ── */}
            <Hr dm={dm}/>
            <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Contact & Info</p>
            {[["📍 Address",cv.address||"—"],["📞 Phone",cv.phone||"—"],["📅 Customer Since",cv.joinDate||"—"],["💬 Notes",cv.notes||"—"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"5px 0",borderBottom:`1px solid ${t.border}`}}>
                <span style={{color:t.sub,fontSize:12,flexShrink:0,marginRight:12}}>{k}</span>
                <span style={{color:t.text,fontWeight:600,fontSize:12,textAlign:"right",wordBreak:"break-word",maxWidth:"60%"}}>{v}</span>
              </div>
            ))}

            {/* ── STATS OVERVIEW ── */}
            <Hr dm={dm}/>
            <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>📊 Overview</p>
            <div className="crm-grid-3" style={{gap:8,marginBottom:10}}>
              {[
                {label:"Total Orders",val:cDelivs.length,color:t.text},
                {label:"Delivered",val:cDone.length,color:"#10b981"},
                {label:"Pending",val:cPending.length,color:"#f59e0b"},
                {label:"Cancelled",val:cCancelled.length,color:"#ef4444"},
                {label:"Replacements",val:cRepls.length,color:"#f97316"},
                {label:"Delivery Rate",val:`${delivRate}%`,color:delivRate>=90?"#10b981":delivRate>=70?"#f59e0b":"#ef4444"},
              ].map(({label,val,color})=>(
                <div key={label} style={{background:t.inp,borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
                  <p style={{color,fontWeight:900,fontSize:18,lineHeight:1}}>{val}</p>
                  <p style={{color:t.sub,fontSize:9,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.04em",marginTop:4}}>{label}</p>
                </div>
              ))}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:t.sub,marginBottom:4}}>
              <span>Delivery rate</span>
              <span style={{fontWeight:700,color:delivRate>=90?"#10b981":delivRate>=70?"#f59e0b":"#ef4444"}}>{delivRate}%</span>
            </div>
            <div style={{background:t.border,height:5,borderRadius:5,overflow:"hidden",marginBottom:2}}>
              <div style={{width:`${delivRate}%`,height:"100%",background:delivRate>=90?"#10b981":delivRate>=70?"#f59e0b":"#ef4444",borderRadius:5}}/>
            </div>
            <p style={{color:t.sub,fontSize:11,marginTop:4}}>🕐 Last order: <span style={{fontWeight:700,color:t.text}}>{lastLabel}</span></p>

            {/* ── PAYMENT STATUS ── */}
            {canSeeFinancials&&<>
              <Hr dm={dm}/>
              <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>💳 Payment Status</p>
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                <div style={{flex:1,background:"#10b98115",borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
                  <p style={{color:"#10b981",fontWeight:900,fontSize:15}}>{inr(cv.paid||0)}</p>
                  <p style={{color:t.sub,fontSize:9,fontWeight:600,textTransform:"uppercase",marginTop:3}}>Paid</p>
                </div>
                <div style={{flex:1,background:cv.pending>0?"#ef444415":"#10b98115",borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
                  <p style={{color:cv.pending>0?"#ef4444":"#10b981",fontWeight:900,fontSize:15}}>{inr(cv.pending||0)}</p>
                  <p style={{color:t.sub,fontSize:9,fontWeight:600,textTransform:"uppercase",marginTop:3}}>Outstanding</p>
                </div>
                {canSeePrices&&totalRevenue>0&&<div style={{flex:1,background:t.inp,borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
                  <p style={{color:"#f59e0b",fontWeight:900,fontSize:15}}>{inr(totalRevenue)}</p>
                  <p style={{color:t.sub,fontSize:9,fontWeight:600,textTransform:"uppercase",marginTop:3}}>Total Revenue</p>
                </div>}
              </div>
              {totalBilled>0&&<>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:t.sub,marginBottom:4}}>
                  <span>Payment progress</span><span style={{fontWeight:700,color:cv.pending>0?"#f59e0b":"#10b981"}}>{payPct}% settled</span>
                </div>
                <div style={{background:t.border,height:5,borderRadius:5,overflow:"hidden",marginBottom:6}}>
                  <div style={{width:`${payPct}%`,height:"100%",background:cv.pending>0?"#f59e0b":"#10b981",borderRadius:5}}/>
                </div>
              </>}
              {(cv.partialPay||0)>0&&<p style={{color:"#d97706",fontSize:12,fontWeight:600,marginTop:4}}>💛 Partial on hold: {inr(cv.partialPay)}</p>}
              {totalReplAmt>0&&<p style={{color:"#f97316",fontSize:12,fontWeight:600,marginTop:4}}>🔄 Replacement deductions: −{inr(totalReplAmt)}</p>}
            </>}

            {/* ── REGULAR ORDER TEMPLATE ── */}
            {rows.length>0&&<>
              <Hr dm={dm}/>
              <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>🛒 Regular Order Template</p>
              {rows.map(r=>(
                <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${t.border}`}}>
                  <span style={{color:t.sub,fontSize:13}}>{r.qty} × {r.name}{canSeePrices?` @ ${inr(r.priceAmount)}`:""}</span>
                  {canSeePrices&&<span style={{color:t.text,fontWeight:700,fontSize:13}}>{inr(r.qty*r.priceAmount)}</span>}
                </div>
              ))}
              {canSeePrices&&tot>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",marginTop:2}}>
                <span style={{color:t.sub,fontSize:13,fontWeight:700}}>Template Total</span>
                <span style={{color:"#f59e0b",fontWeight:800,fontSize:14}}>{inr(netTot)}</span>
              </div>}
            </>}

            {/* ── FULL DELIVERY HISTORY ── */}
            <Hr dm={dm}/>
            <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>📦 Delivery History ({cDelivs.length})</p>
            {cDelivs.length===0
              ?<p style={{color:t.sub,fontSize:13,textAlign:"center",padding:"16px 0"}}>No deliveries yet.</p>
              :cDelivs.map((d,i)=>{
                const dItems=Object.entries(safeO(d.orderLines)).filter(([,l])=>l.qty>0).map(([pid,l])=>{const p=products.find(x=>x.id===pid);return `${l.qty}× ${p?p.name:(l.name||pid)}`;}).join(", ");
                const dTot=lineTotal(d.orderLines);
                const statusColor=d.status==="Delivered"?"#10b981":d.status==="In Transit"?"#3b82f6":d.status==="Cancelled"?"#ef4444":"#f59e0b";
                return <div key={d.id} style={{background:t.inp,borderRadius:12,padding:"10px 12px",marginBottom:8,border:`1px solid ${t.border}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:dItems?6:0}}>
                    <div>
                      <p style={{color:t.text,fontWeight:700,fontSize:13}}>{d.date}</p>
                      {d.deliveryDate&&d.deliveryDate!==d.date&&<p style={{color:t.sub,fontSize:11}}>Delivered: {d.deliveryDate}</p>}
                      {d.createdBy&&<p style={{color:t.sub,fontSize:10}}>By: {d.createdBy}</p>}
                    </div>
                    <span style={{background:statusColor+"20",color:statusColor,fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:99}}>{d.status}</span>
                  </div>
                  {dItems&&<p style={{color:t.sub,fontSize:12,marginBottom:4}}>📦 {dItems}</p>}
                  {canSeePrices&&(()=>{
                    const replAmt=+d.replacement?.amount||0;
                    const netAmt=dTot-replAmt;
                    const collected=d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0;
                    const balanceDue=Math.max(0,netAmt-collected);
                    return <>
                      {dTot>0&&<div style={{marginTop:6,borderTop:`1px solid ${t.border}`,paddingTop:6}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:2}}>
                          <span style={{color:t.sub}}>Order Total</span>
                          <span style={{color:t.text,fontWeight:600}}>{inr(dTot)}</span>
                        </div>
                        {d.replacement?.done&&<>
                          <div style={{background:"#f9731615",borderRadius:8,padding:"5px 8px",margin:"4px 0",border:"1px solid #f9731625"}}>
                            <p style={{color:"#f97316",fontSize:11,fontWeight:700}}>🔄 {d.replacement.item||"Replacement"}{d.replacement.qty?` (${d.replacement.qty})`:""}</p>
                            {d.replacement.reason&&<p style={{color:t.sub,fontSize:10}}>{d.replacement.reason}</p>}
                            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginTop:2}}>
                              <span style={{color:"#f97316"}}>− Replacement</span>
                              <span style={{color:"#f97316",fontWeight:700}}>−{inr(replAmt)}</span>
                            </div>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:2}}>
                            <span style={{color:t.sub}}>= Net Payable</span>
                            <span style={{color:t.text,fontWeight:700}}>{inr(netAmt)}</span>
                          </div>
                        </>}
                        {collected>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:2}}>
                          <span style={{color:"#10b981"}}>− Collected</span>
                          <span style={{color:"#10b981",fontWeight:700}}>{inr(collected)}</span>
                        </div>}
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,fontWeight:800,borderTop:`1.5px solid ${t.border}`,paddingTop:4,marginTop:2}}>
                          <span style={{color:balanceDue===0?"#10b981":"#f59e0b"}}>{balanceDue===0?"✓ Settled":"Balance Due"}</span>
                          <span style={{color:balanceDue===0?"#10b981":"#f59e0b"}}>{inr(balanceDue)}</span>
                        </div>
                      </div>}
                    </>;
                  })()}
                  {!canSeePrices&&d.replacement?.done&&<div style={{background:"#f9731615",borderRadius:8,padding:"5px 8px",marginTop:6,border:"1px solid #f9731625"}}>
                    <p style={{color:"#f97316",fontSize:11,fontWeight:700}}>🔄 Replacement: {d.replacement.item||"—"}{d.replacement.qty?` (${d.replacement.qty})`:""}</p>
                    {d.replacement.reason&&<p style={{color:t.sub,fontSize:10}}>{d.replacement.reason}</p>}
                  </div>}
                  {d.notes&&<p style={{color:t.sub,fontSize:11,fontStyle:"italic",marginTop:4}}>"{d.notes}"</p>}
                </div>;
              })
            }

            {/* ── REPLACEMENT LOG ── */}
            {cRepls.length>0&&<>
              <Hr dm={dm}/>
              <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>🔄 Replacement Log ({cRepls.length})</p>
              {cRepls.map(d=>(
                <div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${t.border}`}}>
                  <div>
                    <p style={{color:t.text,fontSize:12,fontWeight:600}}>{d.date} — {d.replacement?.item||"—"}{d.replacement?.qty?` (${d.replacement.qty})`:""}</p>
                    {d.replacement?.reason&&<p style={{color:t.sub,fontSize:11}}>{d.replacement.reason}</p>}
                  </div>
                  {canSeePrices&&d.replacement?.amount&&<span style={{color:"#f97316",fontWeight:700,fontSize:12}}>−{inr(d.replacement.amount)}</span>}
                </div>
              ))}
              {canSeePrices&&totalReplAmt>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",marginTop:2}}>
                <span style={{color:t.sub,fontWeight:700,fontSize:12}}>Total Deducted</span>
                <span style={{color:"#f97316",fontWeight:800,fontSize:13}}>−{inr(totalReplAmt)}</span>
              </div>}
            </>}

            {/* ── ACTION BUTTONS ── */}
            <Hr dm={dm}/>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {cv.address&&<a href={mapU(cv.address,cv.lat,cv.lng)} target="_blank" rel="noopener noreferrer" style={{flex:"1 1 auto",minWidth:80}}>
                <Btn dm={dm} v="outline" className="w-full">📍 Maps</Btn>
              </a>}
              <div style={{flex:"1 1 auto",minWidth:80}}>
                <Btn dm={dm} v="purple" className="w-full" onClick={()=>exportPDF(cv,products,"customer",settings,deliveries)}>📄 PDF</Btn>
              </div>
              <div style={{flex:"1 1 auto",minWidth:80}}>
                <Btn dm={dm} v="sky" className="w-full" onClick={()=>{
                  const cD=deliveries.filter(d=>d.customerId===cv.id).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
                  const enriched=cD.map(d=>{
                    const items=Object.entries(safeO(d.orderLines)).filter(([,l])=>l.qty>0).map(([pid,l])=>{const p=products.find(x=>x.id===pid);return `${l.qty}x ${p?p.name:(l.name||pid)}`;}).join("; ");
                    return {...d,_items:items,_total:lineTotal(d.orderLines),_replItem:d.replacement?.done?(d.replacement.item||""):"",_replQty:d.replacement?.done?(d.replacement.qty||""):"",_replAmt:d.replacement?.done?(+d.replacement.amount||0):0,_replReason:d.replacement?.done?(d.replacement.reason||""):"",_notes:d.notes||""};
                  });
                  exportTabExcel(cv.name.replace(/[^a-zA-Z0-9 ]/g," ").slice(0,28)+" Deliveries",enriched,[
                    {label:"Date",key:"date"},{label:"Status",key:"status"},{label:"Items Ordered",key:"_items"},{label:"Order Total (Rs)",key:"_total",num:true},
                    {label:"Replacement Item",key:"_replItem"},{label:"Repl. Qty",key:"_replQty"},{label:"Repl. Amount Deducted (Rs)",key:"_replAmt",num:true},{label:"Repl. Reason",key:"_replReason"},
                    {label:"Created By",key:"createdBy"},{label:"Notes",key:"_notes"}
                  ],settings);
                }}>📊 XLS</Btn>
              </div>
            </div>
          </>);
        })()}
      </Sheet>

      {/* Delivery Sheet */}
      <Sheet dm={dm} open={!!dSh} onClose={()=>setDsh(null)} title={dSh==="add"?"New Delivery":"Edit Delivery"}>
        <Sel dm={dm} label="Customer *" value={dF.customerId||""} onChange={e=>pickCust(e.target.value)}>
          <option value="">— Select customer —</option>
          {customers.filter(c=>c.active).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </Sel>
        {dF.address&&<div style={{background:"#0ea5e915",border:"1px solid #0ea5e940"}} className="rounded-xl px-3.5 py-2.5 text-xs text-sky-400 flex items-center justify-between"><span>📍 {dF.address}</span><a href={mapU(dF.address,dF.lat,dF.lng)} target="_blank" rel="noopener noreferrer" className="underline font-semibold ml-2 shrink-0">Maps</a></div>}
        {/* ── Credit limit live warning banner ── */}
        {settings?.featureCreditLimit&&dF.customerId&&(()=>{
          const custRec=customers.find(c=>c.id===dF.customerId);
          const limit=+(custRec?.creditLimit||0);
          if(limit<=0) return null;
          const orderAmt=lineTotal(dF.orderLines||{});
          const pending=+(custRec?.pending||0);
          const total=pending+orderAmt;
          const pct=Math.min(100,Math.round((total/limit)*100));
          const exceeded=total>limit;
          const warning=!exceeded&&pct>=80;
          if(!exceeded&&!warning) return null;
          const bg=exceeded?"#ef444418":"#f59e0b18";
          const border=exceeded?"#ef444440":"#f59e0b40";
          const color=exceeded?"#ef4444":"#f59e0b";
          return <div style={{background:bg,border:`1px solid ${border}`,borderRadius:12,padding:"10px 14px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
              <p style={{color,fontWeight:700,fontSize:12}}>{exceeded?"🚫 Credit Limit Exceeded":"⚠️ Approaching Credit Limit"}</p>
              <span style={{color,fontWeight:800,fontSize:12}}>{pct}%</span>
            </div>
            <div style={{background:exceeded?"#ef444430":"#f59e0b30",borderRadius:99,height:5,overflow:"hidden",marginBottom:6}}>
              <div style={{width:`${pct}%`,height:"100%",background:color,borderRadius:99,transition:"width 0.3s"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
              <span style={{color:dm?"#9ca3af":"#6b7280"}}>Pending {inr(pending)} + Order {inr(orderAmt)}</span>
              <span style={{color,fontWeight:700}}>Limit {inr(limit)}</span>
            </div>
          </div>;
        })()}
        <Hr dm={dm}/>
        <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider">Items{canSeePrices?" — Tap price to select":""}</p>
        <OrderEditor dm={dm} products={products} orderLines={dF.orderLines||{}} showPrice={canSeePrices} onChange={ol=>setDf(f=>({...f,orderLines:ol}))}/>
        <Hr dm={dm}/>
        <div className="crm-grid-2" style={{gap:3*4}}>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label style={{color:t.sub}} className="text-[11px] font-bold uppercase tracking-widest ml-0.5">Order Date</label>
              {dSh==="add"&&(()=>{
                // _dateMode: "today" | "past" | "future"
                const mode = dF._dateMode || "today";
                const modes = [
                  {key:"today",  label:"Today",   color:"#10b981"},
                  {key:"past",   label:"📅 Past",  color:"#8b5cf6"},
                  {key:"future", label:"Future",   color:"#f59e0b"},
                ];
                return (
                  <div style={{display:"flex",gap:2,background:t.inp,borderRadius:8,padding:2,border:`1px solid ${t.border}`}}>
                    {modes.map(m=>(
                      <button key={m.key} onClick={()=>{
                        const next = m.key;
                        setDf(f=>({...f,_dateMode:next,_futureOrder:next==="future",date:next==="today"?today():f.date}));
                      }}
                        style={{fontSize:9,fontWeight:700,cursor:"pointer",borderRadius:6,padding:"2px 6px",border:"none",
                          background:mode===m.key?m.color+"22":"transparent",
                          color:mode===m.key?m.color:t.sub,
                          transition:"all 0.15s",WebkitTapHighlightColor:"transparent"}}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
            {(dSh!=="add"||(dF._dateMode==="past"||dF._dateMode==="future"||dF._futureOrder))
              ?<input type="date"
                  value={dF.date}
                  max={dF._dateMode==="past"||(!dF._dateMode&&!dF._futureOrder) ? today() : undefined}
                  onChange={e=>setDf({...dF,date:e.target.value})}
                  style={{background:t.inp,border:`1px solid ${dF._dateMode==="past"?"#8b5cf680":dF._dateMode==="future"||dF._futureOrder?"#f59e0b80":t.inpB}`,color:t.text,borderRadius:12,padding:"10px 14px",fontSize:14,width:"100%",outline:"none"}}/>
              :<div style={{background:t.inp,border:`1px solid ${t.inpB}`,borderRadius:12,padding:"10px 14px",fontSize:13,color:t.sub}}>Today ({today()})</div>
            }
            {dSh==="add"&&dF._dateMode==="past"&&<p style={{color:"#8b5cf6",fontSize:10,marginTop:4,fontWeight:600}}>📅 Logging a past order — pick the actual date it happened</p>}
            {dSh==="add"&&(dF._dateMode==="future"||dF._futureOrder)&&<p style={{color:"#f59e0b",fontSize:10,marginTop:4,fontWeight:600}}>⏳ Future order — will appear as scheduled</p>}
          </div>
          <Inp dm={dm} label="Deliver By (optional)" type="date" value={dF.deliveryDate||""} onChange={e=>setDf({...dF,deliveryDate:e.target.value})}/>
        </div>
        <Sel dm={dm} label="Status" value={dF.status} onChange={e=>setDf({...dF,status:e.target.value})}>
          {delivStats.map(s=><option key={s}>{s}</option>)}
        </Sel>
        {(()=>{
          // Batch assignment — always shown so user can assign manually
          const delivDate=dF.date||today();
          const delivProductIds=Object.entries(safeO(dF.orderLines)).filter(([,l])=>(l.qty||0)>0).map(([pid])=>pid);
          const allBatches=(prodTargets||[]).filter(pt=>pt.date===delivDate);
          const matchingBatches=allBatches.filter(pt=>pt.product&&delivProductIds.some(pid=>{const p=products.find(x=>x.id===pid);return prodNamesMatch(p?.name||"",pt.product);}));
          const batchList=matchingBatches.length>0?matchingBatches:allBatches;
          return <div>
            <label style={{color:t.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4,display:"block"}}>🏭 Batch</label>
            {batchList.length===0
              ? <div style={{background:dm?"rgba(124,58,237,0.07)":"rgba(124,58,237,0.04)",border:"1.5px solid rgba(124,58,237,0.2)",borderRadius:12,padding:"10px 14px"}}>
                  <p style={{color:t.sub,fontSize:12}}>No batches logged for this date yet — save without assigning or log a production batch first.</p>
                </div>
              : <>
                  <select value={dF.batchId||""} onChange={e=>setDf(f=>({...f,batchId:e.target.value}))}
                    style={{width:"100%",background:t.inp,border:`1.5px solid ${dF.batchId?"#7c3aed60":t.inpB}`,color:dF.batchId?"#8b5cf6":t.text,borderRadius:12,padding:"10px 14px",fontSize:13,outline:"none",appearance:"none",WebkitAppearance:"none",cursor:"pointer"}}>
                    <option value="">— No Batch / Unassigned —</option>
                    {batchList.map(b=><option key={b.batchId||b.id} value={b.batchId||b.id}>{b.batchLabel||"Batch"} · {b.product} · {b.actual||0} units</option>)}
                  </select>
                  {dF.batchId
                    ? <p style={{color:"#8b5cf6",fontSize:10,marginTop:4,fontWeight:600}}>📦 Assigned to {batchList.find(b=>(b.batchId||b.id)===dF.batchId)?.batchLabel||"batch"} — <span style={{cursor:"pointer",textDecoration:"underline"}} onClick={()=>setDf(f=>({...f,batchId:""}))}>Clear</span></p>
                    : <p style={{color:t.sub,fontSize:10,marginTop:4}}>Select a batch or leave unassigned</p>
                  }
                </>
            }
          </div>;
        })()}
        <Inp dm={dm} label="Notes" value={dF.notes} onChange={e=>setDf({...dF,notes:e.target.value})} placeholder="e.g. Leave at gate, call before"/>
        <Hr dm={dm}/>
        {/* ── REPLACEMENT SECTION — Redesigned ── */}
        <div style={{background:dF.replacement?.done?(dm?"rgba(249,115,22,0.08)":"rgba(249,115,22,0.05)"):(dm?"rgba(255,255,255,0.03)":"#fafaf8"),border:`1.5px solid ${dF.replacement?.done?"#f9731650":t.border}`,borderRadius:16,padding:"14px 16px",transition:"all 0.2s"}}>
          {/* Header row */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:dF.replacement?.done?14:0}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:34,height:34,borderRadius:10,background:dF.replacement?.done?"#f9731625":"#f9731612",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,transition:"background 0.2s"}}>🔄</div>
              <div>
                <p style={{color:dF.replacement?.done?"#f97316":t.text,fontWeight:700,fontSize:13,lineHeight:1.2}}>Replacement / Return</p>
                <p style={{color:t.sub,fontSize:11}}>Record items returned or swapped</p>
              </div>
            </div>
            {/* Big toggle button */}
            <button onClick={()=>setDf(f=>({...f,replacement:{...(f.replacement||{}),done:!(f.replacement?.done)}}))}
              style={{background:dF.replacement?.done?"#f97316":"transparent",color:dF.replacement?.done?"#fff":"#f97316",border:`2px solid #f97316`,borderRadius:12,padding:"7px 16px",fontSize:12,fontWeight:800,cursor:"pointer",transition:"all 0.2s",flexShrink:0,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",minHeight:40}}>
              {dF.replacement?.done?"✓ Replacement Logged":"+ Log Replacement"}
            </button>
          </div>
          {dF.replacement?.done&&(
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {/* Replacement type pills */}
              <div>
                <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Type</p>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {[["swap","🔄 Swap / Exchange"],["return","↩ Return / Refund"],["damaged","⚠️ Damaged"],["wrong","❌ Wrong Item"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setDf(f=>({...f,replacement:{...(f.replacement||{}),type:v}}))}
                      style={{background:dF.replacement?.type===v?"#f9731622":"transparent",color:dF.replacement?.type===v?"#f97316":t.sub,border:`1.5px solid ${dF.replacement?.type===v?"#f97316":t.border}`,borderRadius:99,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer",transition:"all 0.15s",WebkitTapHighlightColor:"transparent"}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {/* Item name */}
              <Inp dm={dm} label="Item Being Replaced / Returned *" value={dF.replacement?.item||""} onChange={e=>setDf(f=>({...f,replacement:{...(f.replacement||{}),item:e.target.value}}))} placeholder="e.g. Roti Pack, Paratha x10…"/>
              {/* Qty + Amount row */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:10}}>
                <Inp dm={dm} label="Quantity" value={dF.replacement?.qty||""} onChange={e=>setDf(f=>({...f,replacement:{...(f.replacement||{}),qty:e.target.value}}))} placeholder="e.g. 10 pcs"/>
                <Inp dm={dm} label="Amount to Deduct (₹)" type="number" value={dF.replacement?.amount||""} onChange={e=>setDf(f=>({...f,replacement:{...(f.replacement||{}),amount:e.target.value}}))} placeholder="0"/>
              </div>
              {/* Deduction preview */}
              {(+dF.replacement?.amount)>0&&<div style={{background:"#f9731618",border:"1px solid #f9731640",borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <p style={{color:"#f97316",fontWeight:700,fontSize:12}}>💡 Deduction preview</p>
                  <p style={{color:t.sub,fontSize:11,marginTop:2}}>{inr(+dF.replacement.amount)} will be deducted from this order's payable amount</p>
                </div>
                <span style={{color:"#f97316",fontWeight:900,fontSize:18}}>−{inr(+dF.replacement.amount)}</span>
              </div>}
              {/* Reason */}
              <Inp dm={dm} label="Reason / Notes" value={dF.replacement?.reason||""} onChange={e=>setDf(f=>({...f,replacement:{...(f.replacement||{}),reason:e.target.value}}))} placeholder="e.g. Customer complained quality, item expired, wrong order…"/>
            </div>
          )}
        </div>
        <Hr dm={dm}/>
        {/* PARTIAL PAYMENT SECTION */}
        {canSeePrices&&<div style={{background:dF.partialPayment?.enabled?(dm?"rgba(16,185,129,0.08)":"#f0fdf4"):(dm?"rgba(255,255,255,0.03)":"#fafaf8"),border:`1.5px solid ${dF.partialPayment?.enabled?"#10b981":t.border}`,borderRadius:14,padding:"12px 14px"}}>
          <div className="flex items-center justify-between mb-1">
            <div>
              <p style={{color:dF.partialPayment?.enabled?"#10b981":t.text,fontWeight:700,fontSize:13}}>💰 Collect Partial Payment</p>
              <p style={{color:t.sub,fontSize:11,marginTop:1}}>Agent collects cash on delivery — flows into all reports</p>
            </div>
            <button onClick={()=>setDf(f=>({...f,partialPayment:{...f.partialPayment,enabled:!f.partialPayment?.enabled}}))}
              style={{width:40,height:22,borderRadius:99,background:dF.partialPayment?.enabled?"#10b981":t.border,padding:2,display:"flex",alignItems:"center",justifyContent:dF.partialPayment?.enabled?"flex-end":"flex-start",transition:"all 0.2s",flexShrink:0,border:"none",cursor:"pointer"}}>
              <div style={{width:18,height:18,borderRadius:99,background:"#fff",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
            </button>
          </div>
          {dF.partialPayment?.enabled&&<>
            <Inp dm={dm} label="Amount Collected (₹)" type="number" value={dF.partialPayment?.amount||""} onChange={e=>setDf(f=>({...f,partialPayment:{...f.partialPayment,amount:e.target.value}}))} placeholder="e.g. 200"/>
            {(+dF.partialPayment?.amount)>0&&(()=>{
              const taxRt=settings?.featureTaxCalc?(+(settings?.taxRate||0)):0;
              const tot=lineTotalWithTax(dF.orderLines,taxRt);
              const remaining=tot-(+dF.partialPayment.amount);
              return <div style={{background:"#10b98115",border:"1px solid #10b98130",borderRadius:10,padding:"8px 12px",marginTop:4}}>
                <div className="flex justify-between text-xs"><span style={{color:t.sub}}>Order Total{taxRt>0?` (incl. ${taxRt}% tax)`:""}</span><span style={{color:t.text,fontWeight:700}}>{inr(tot)}</span></div>
                <div className="flex justify-between text-xs mt-1"><span style={{color:"#10b981"}}>Collected Now</span><span style={{color:"#10b981",fontWeight:700}}>−{inr(+dF.partialPayment.amount)}</span></div>
                <div className="flex justify-between text-xs mt-1 pt-1" style={{borderTop:`1px solid #10b98130`}}><span style={{color:t.sub,fontWeight:700}}>Still Due</span><span style={{color:remaining>0?"#f59e0b":"#10b981",fontWeight:800}}>{inr(Math.max(0,remaining))}</span></div>
              </div>;
            })()}
          </>}
        </div>}
        <div className="flex gap-2">
          {dSh!=="add"&&can("deliv_report")&&<Btn dm={dm} v="outline" onClick={()=>exportPDF(dSh,products,"delivery",settings)} className="flex-1">🧾 Invoice</Btn>}
          <Btn dm={dm} onClick={saveD} className="flex-1">Save Delivery</Btn>
        </div>
      </Sheet>

      {/* Supply Sheet */}
      <Sheet dm={dm} open={!!sSh} onClose={()=>setSsh(null)} title={sSh==="add"?"Log Supply":"Edit Supply"}>
        <Inp dm={dm} label="Item *" value={sF.item} onChange={e=>setSf({...sF,item:e.target.value})} placeholder="e.g. Wheat Flour"/>
        <div className="crm-grid-2" style={{gap:3*4}}>
          <Inp dm={dm} label="Quantity" type="number" value={sF.qty} onChange={e=>setSf({...sF,qty:e.target.value})}/>
          <Sel dm={dm} label="Unit" value={sF.unit} onChange={e=>setSf({...sF,unit:e.target.value})}>
            {supUnits.map(u=><option key={u}>{u}</option>)}
          </Sel>
        </div>
        <Inp dm={dm} label="Supplier" value={sF.supplier} onChange={e=>setSf({...sF,supplier:e.target.value})}/>
        <div className="crm-grid-2" style={{gap:3*4}}>
          <Inp dm={dm} label="Cost (₹)" type="number" value={sF.cost} onChange={e=>setSf({...sF,cost:e.target.value})}/>
          <Inp dm={dm} label="Date" type="date" value={sF.date} onChange={e=>setSf({...sF,date:e.target.value})}/>
        </div>
        <Inp dm={dm} label="Notes" value={sF.notes} onChange={e=>setSf({...sF,notes:e.target.value})}/>
        <div style={{background:t.inp,borderRadius:14,padding:"12px 14px"}}>
          <p style={{color:t.sub}} className="text-[11px] font-bold uppercase tracking-wider mb-1">Low Stock Alert</p>
          <p style={{color:t.sub}} className="text-[11px] mb-2">Get notified when stock drops to or below this level. Leave blank to disable.</p>
          <Inp dm={dm} label="Min Stock Threshold" type="number" value={sF.minStock||""} onChange={e=>setSf({...sF,minStock:e.target.value})} placeholder="e.g. 10"/>
        </div>
        <Btn dm={dm} onClick={saveS} className="w-full">Save Supply</Btn>
      </Sheet>

      {/* Expense Sheet */}
      <Sheet dm={dm} open={!!eSh} onClose={()=>setEsh(null)} title={eSh==="add"?"💸 Log Expense":"✏️ Edit Expense"}>
        {/* Category + Amount — most important, top row */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:10}}>
          <Sel dm={dm} label="Category *" value={eF.category} onChange={e=>setEf({...eF,category:e.target.value})}>
            {expCats.map(c=><option key={c}>{c}</option>)}
          </Sel>
          <Inp dm={dm} label="Amount (₹) *" type="number" value={eF.amount} onChange={e=>setEf({...eF,amount:e.target.value})} placeholder="0"/>
        </div>
        {/* Date + Payment Method */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:10}}>
          <Inp dm={dm} label="Date *" type="date" value={eF.date} onChange={e=>setEf({...eF,date:e.target.value})}/>
          <Sel dm={dm} label="Payment Method" value={eF.paymentMethod||"Cash"} onChange={e=>setEf({...eF,paymentMethod:e.target.value})}>
            {["Cash","UPI","Card","Bank Transfer","Credit","Cheque","Other"].map(m=><option key={m}>{m}</option>)}
          </Sel>
        </div>
        {/* Vendor */}
        <Inp dm={dm} label="Vendor / Supplier" value={eF.vendor||""} onChange={e=>setEf({...eF,vendor:e.target.value})} placeholder="e.g. Ramesh Traders, Shell Gas Station…"/>
        {/* Notes */}
        <Inp dm={dm} label="Notes" value={eF.notes||""} onChange={e=>setEf({...eF,notes:e.target.value})} placeholder="Brief description of this expense…"/>
        {/* Receipt / Reference */}
        <div>
          <label style={{color:t.sub,display:"block",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Receipt / Bill Reference</label>
          <input value={eF.receipt||""} onChange={e=>setEf({...eF,receipt:e.target.value})}
            placeholder="Bill no., invoice ref, or short description…"
            style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,width:"100%",borderRadius:12,padding:"10px 14px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
        </div>
        {/* Approved By + Tags in one row */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:10}}>
          <Inp dm={dm} label="Approved By" value={eF.approvedBy||""} onChange={e=>setEf({...eF,approvedBy:e.target.value})} placeholder="Name or role…"/>
          <Inp dm={dm} label="Tags" value={eF.tags||""} onChange={e=>setEf({...eF,tags:e.target.value})} placeholder="e.g. urgent, recurring…"/>
        </div>
        {/* Amount preview chip */}
        {eF.amount&&+eF.amount>0&&(
          <div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{color:t.sub,fontSize:12}}>You're logging</span>
            <span style={{color:"#ef4444",fontWeight:900,fontSize:18}}>{inr(+eF.amount)}</span>
          </div>
        )}
        <Btn dm={dm} onClick={saveE} className="w-full" style={{background:"#ef4444",color:"#fff"}}>
          {eSh==="add"?"✓ Save Expense":"✓ Update Expense"}
        </Btn>
      </Sheet>

      {/* Product Sheet */}
      <Sheet dm={dm} open={!!pSh} onClose={()=>setPsh(null)} title={pSh==="add"?"Add Product":"Edit Product"}>
        <Inp dm={dm} label="Product Name *" value={pF.name} onChange={e=>setPf({...pF,name:e.target.value})} placeholder="e.g. Paratha Pack 5 pcs"/>
        <Inp dm={dm} label="Product ID *" value={pF.id} onChange={e=>setPf({...pF,id:e.target.value})} placeholder="e.g. paratha5 (no spaces)"/>
        <Sel dm={dm} label="Unit" value={pF.unit} onChange={e=>setPf({...pF,unit:e.target.value})}>
          {["pcs","pack","kg","box","dozen","L"].map(u=><option key={u}>{u}</option>)}
        </Sel>
        <Hr dm={dm}/>
        <div className="flex items-center justify-between">
          <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider">Price Options</p>
          <button onClick={()=>setPf(f=>({...f,prices:[...f.prices,""]}))} className="text-xs font-semibold text-amber-500">+ Add Price</button>
        </div>
        <p style={{color:t.sub}} className="text-[11px]">Enter all prices for this product. When making an order, user taps to pick which applies.</p>
        <div className="flex flex-wrap gap-2">
          {pF.prices.map((pr,i)=>(
            <div key={i} className="flex items-center gap-1">
              <span style={{color:t.sub}} className="text-xs">₹</span>
              <input type="number" value={pr} placeholder="0" onChange={e=>setPf(f=>({...f,prices:f.prices.map((x,j)=>j===i?e.target.value:x)}))}
                style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,width:72}}
                className="rounded-xl px-2 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-amber-400"/>
              {pF.prices.length>1&&<button onClick={()=>setPf(f=>({...f,prices:f.prices.filter((_,j)=>j!==i)}))} className="text-red-500 font-bold text-base leading-none">✕</button>}
            </div>
          ))}
        </div>
        <Btn dm={dm} onClick={saveP} className="w-full">Save Product</Btn>
      </Sheet>

      {/* Production Item Sheet */}
      <Sheet dm={dm} open={!!piSh} onClose={()=>{setPiSh(null);setPiF({id:"",name:""});}} title={piSh==="add"?"Add Production Item":"Edit Production Item"}>
        <p style={{color:T(dm).sub,fontSize:12,marginBottom:4}}>Production items are only used in the Production tab (Log Batch). They are completely separate from your delivery products.</p>
        <Inp dm={dm} label="Item Name *" value={piF.name} onChange={e=>setPiF(f=>({...f,name:e.target.value}))} placeholder="e.g. Paratha, Roti, Special Paratha"/>
        <Btn dm={dm} onClick={saveProdItem} className="w-full" style={{background:"#8b5cf6",color:"#fff",border:"none"}}>Save Item</Btn>
      </Sheet>
      <Sheet dm={dm} open={changePwSh} onClose={()=>setChangePwSh(false)} title="Change Password">
        <Inp dm={dm} label="Current Password" type="password" value={changePwF.current} onChange={e=>setChangePwF(f=>({...f,current:e.target.value}))} placeholder="Enter current password"/>
        <Inp dm={dm} label="New Password" type="password" value={changePwF.next} onChange={e=>setChangePwF(f=>({...f,next:e.target.value}))} placeholder="Min 6 characters"/>
        <Inp dm={dm} label="Confirm New Password" type="password" value={changePwF.confirm} onChange={e=>setChangePwF(f=>({...f,confirm:e.target.value}))} placeholder="Repeat new password"/>
        <Btn dm={dm} onClick={()=>{
          const me=users.find(u=>u.id===sess.id);
          if(!me){notify("User not found");return;}
          if(!checkPw(changePwF.current,me.password)){notify("Current password is incorrect");return;}
          if(changePwF.next.length<6){notify("New password must be at least 6 characters");return;}
          if(changePwF.next!==changePwF.confirm){notify("Passwords don't match");return;}
          setUsers(p=>safeArr(p).map(u=>u.id===sess.id?{...u,password:hashPw(changePwF.next)}:u));
          addLog("Changed password","Own account");
          notify("Password changed ✓");
          setChangePwSh(false);
          setChangePwF({current:"",next:"",confirm:""});
        }} className="w-full">Update Password</Btn>
      </Sheet>

      {/* User Sheet */}
      <Sheet dm={dm} open={!!uSh} onClose={()=>setUsh(null)} title={uSh==="add"?(uF.role==="factory"?"New Factory Staff Account":uF.role==="agent"?"New Delivery Agent Account":"New User"):(uF.role==="factory"?"Edit Factory Staff":uF.role==="agent"?"Edit Delivery Agent":"Edit User")}>
        {/* Basic info */}
        <div style={{background:t.inp,borderRadius:14,padding:"14px 16px"}} className="flex flex-col gap-3">
          <p style={{color:t.sub}} className="text-[11px] font-bold uppercase tracking-wider">Basic Info</p>
          <Inp dm={dm} label="Full Name *" value={uF.name} onChange={e=>setUf({...uF,name:e.target.value})} placeholder="e.g. Ravi Kumar"/>
          <Inp dm={dm} label="Username *" value={uF.username} onChange={e=>setUf({...uF,username:e.target.value.toLowerCase().replace(/\s/g,"")})} placeholder="lowercase, no spaces"/>
          <Inp dm={dm} label={uSh==="add"?"Password *":"New Password (blank = keep)"} type="password" value={uF.password} onChange={e=>setUf({...uF,password:e.target.value})} placeholder="Min 6 characters"/>
          {settings?.pinMode&&<Inp dm={dm} label="4-Digit PIN (optional)" type="number" value={uF.pin||""} onChange={e=>setUf({...uF,pin:e.target.value.slice(0,4)})} placeholder="e.g. 1234 — leave blank to disable PIN"/>}
        </div>
        {/* Role selector */}
        <div style={{background:t.inp,borderRadius:14,padding:"14px 16px"}}>
          <p style={{color:t.sub}} className="text-[11px] font-bold uppercase tracking-wider mb-3">Role</p>
          <div className="grid grid-cols-3 gap-2">
            {[{val:"agent",icon:"🚚",label:"Delivery Agent",desc:"On the road"},{val:"factory",icon:"🏭",label:"Factory Staff",desc:"In the kitchen"},{val:"admin",icon:"🔐",label:"Admin",desc:"Full access"}].map(({val,icon,label,desc})=>(
              <button key={val} onClick={()=>setUf({...uF,role:val,permissions:[...(ROLE_DEF[val]||ROLE_DEF.agent)]})}
                style={{background:uF.role===val?(val==="admin"?"#f59e0b":val==="factory"?"#a855f7":"#0ea5e9")+"22":t.card,border:`2px solid ${uF.role===val?(val==="admin"?"#f59e0b":val==="factory"?"#a855f7":"#0ea5e9"):t.border}`,borderRadius:12,padding:"10px 6px",textAlign:"center",transition:"all 0.15s"}}>
                <div className="text-xl mb-1">{icon}</div>
                <p style={{color:uF.role===val?(val==="admin"?"#f59e0b":val==="factory"?"#a855f7":"#0ea5e9"):t.text,fontSize:11,fontWeight:700,lineHeight:1.2}}>{label}</p>
                <p style={{color:t.sub,fontSize:10}}>{desc}</p>
              </button>
            ))}
          </div>
        </div>
        {/* ── TABS: what sections they can access ── */}
        {uF.role!=="admin"&&<div style={{background:t.inp,borderRadius:14,padding:"14px 16px"}}>
          <p style={{color:t.sub}} className="text-[11px] font-bold uppercase tracking-wider mb-1">📱 Accessible Sections</p>
          <p style={{color:t.sub}} className="text-[11px] mb-3">Which tabs/screens this person can open.</p>
          <div className="grid grid-cols-2 gap-1.5">
            {ALL_TABS.filter(tb=>tb!=="Settings").map(tb=>{
              const on=(uF.permissions||[]).includes(tb);
              const icons={"Dashboard":"📊","Customers":"👥","Deliveries":"🚚","Supplies":"📦","Expenses":"💸","Wastage":"🗑️","P&L":"📈","Analytics":"🔍","Production":"🏭",};
              return <button key={tb} onClick={()=>{const p=uF.permissions||[];setUf({...uF,permissions:on?p.filter(x=>x!==tb):[...p,tb]});}}
                style={{background:on?t.accent+"22":t.card,border:`1.5px solid ${on?t.accent:t.border}`,borderRadius:10,padding:"8px 10px",display:"flex",alignItems:"center",gap:8,textAlign:"left",transition:"all 0.15s"}}>
                <span style={{fontSize:16,lineHeight:1}}>{icons[tb]||"•"}</span>
                <span style={{color:on?t.accent:t.sub,fontSize:12,fontWeight:700,flex:1}}>{tb}</span>
                <span style={{width:8,height:8,borderRadius:"50%",background:on?t.accent:"transparent",border:`2px solid ${on?t.accent:t.border}`,flexShrink:0}}/>
              </button>;
            })}
          </div>
        </div>}
        {/* ── FINE-GRAINED PERMISSIONS ── */}
        {uF.role!=="admin"&&(()=>{
          const fp = uF.finePerms || defaultFinePerms(uF.role);
          const setFp = (key,val) => setUf(f=>({...f,finePerms:{...(f.finePerms||defaultFinePerms(f.role)),[key]:val}}));
          const sections = [...new Set(FINE_PERM_DEFS.map(d=>d.section))];
          const sectionColors = {Customers:"#0ea5e9",Deliveries:"#f59e0b",Supplies:"#8b5cf6",Wastage:"#f97316",Production:"#6366f1",QC:"#14b8a6",Dashboard:"#10b981",GPS:"#22c55e",Data:"#64748b"};
          return <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <p style={{color:t.sub}} className="text-[11px] font-bold uppercase tracking-wider mt-1">⚙️ What they can do — per section</p>
            {sections.map(sec=>{
              const perms = FINE_PERM_DEFS.filter(d=>d.section===sec);
              const color = sectionColors[sec]||"#6b7280";
              const allOn = perms.every(d=>fp[d.key]);
              const anyOn = perms.some(d=>fp[d.key]);
              return <div key={sec} style={{background:t.inp,borderRadius:14,overflow:"hidden"}}>
                {/* Section header with bulk toggle */}
                <div style={{padding:"10px 14px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:allOn?color:anyOn?color+"88":"transparent",border:`2px solid ${allOn?color:color+"44"}`,flexShrink:0}}/>
                  <p style={{color:t.text,fontWeight:700,fontSize:13,flex:1}}>{sec}</p>
                  <button onClick={()=>{perms.forEach(d=>setFp(d.key,!allOn));}}
                    style={{fontSize:10,fontWeight:700,color:allOn?color:t.sub,background:allOn?color+"18":"transparent",border:`1px solid ${allOn?color+"44":t.border}`,borderRadius:6,padding:"5px 10px",cursor:"pointer"}}>
                    {allOn?"Revoke all":"Grant all"}
                  </button>
                </div>
                {/* Individual perms */}
                {perms.map(({key,label,desc,icon})=>{
                  const on=fp[key]===true;
                  return <div key={key} style={{padding:"10px 14px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:15,width:22,textAlign:"center",flexShrink:0}}>{icon}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{color:on?t.text:t.sub,fontSize:12,fontWeight:600,lineHeight:1.2}}>{label}</p>
                      <p style={{color:t.sub,fontSize:10,marginTop:2}}>{desc}</p>
                    </div>
                    <Tog dm={dm} on={on} onChange={()=>setFp(key,!on)}/>
                  </div>;
                })}
              </div>;
            })}
          </div>;
        })()}
        {uF.role==="admin"&&<div style={{background:"#f59e0b11",border:"1px solid #f59e0b33",borderRadius:14,padding:"12px 16px"}}>
          <p style={{color:"#f59e0b"}} className="text-xs font-bold">🔐 Admin — Full Access</p>
          <p style={{color:t.sub}} className="text-[11px] mt-0.5">Admins always have access to all tabs and features. No restrictions apply.</p>
        </div>}
        {/* Status */}
        <div style={{background:t.inp,borderRadius:14,padding:"14px 16px"}} className="flex items-center justify-between">
          <div>
            <p style={{color:t.text}} className="text-sm font-semibold">Account Active</p>
            <p style={{color:t.sub}} className="text-[11px]">{uF.active?"This person can currently log in":"Account is disabled — cannot log in"}</p>
          </div>
          <Tog dm={dm} on={uF.active} onChange={()=>setUf({...uF,active:!uF.active})}/>
        </div>
        <Hr dm={dm}/>
        {/* Sub-staff names */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div>
              <label style={{color:t.sub}} className="block text-[11px] font-semibold uppercase tracking-wider">Multiple Staff on This Account</label>
              <p style={{color:t.sub}} className="text-[11px] mt-0.5">Add names so staff can pick who's using the device — handy for shared phones.</p>
            </div>
            <button onClick={()=>setUf(f=>({...f,subStaff:[...(f.subStaff||[]),""]}))} className="text-xs font-semibold text-amber-500 shrink-0 ml-2">+ Add</button>
          </div>
          {(uF.subStaff||[]).length===0
            ?<p style={{color:t.sub}} className="text-[11px] italic">No sub-staff — shows as "{uF.name||"user name"}" only.</p>
            :(uF.subStaff||[]).map((name,i)=>(
              <div key={i} className="flex items-center gap-2 mt-2">
                <input value={name} placeholder={`Staff member ${i+1} name`}
                  onChange={e=>setUf(f=>({...f,subStaff:f.subStaff.map((x,j)=>j===i?e.target.value:x)}))}
                  style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,flex:1}}
                  className="rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400"/>
                <button onClick={()=>setUf(f=>({...f,subStaff:f.subStaff.filter((_,j)=>j!==i)}))} className="text-red-500 font-bold text-lg leading-none px-1">✕</button>
              </div>
            ))
          }
        </div>
        <Btn dm={dm} onClick={saveU} className="w-full">Save Account</Btn>
      </Sheet>

      {/* Wastage Sheet */}
      <Sheet dm={dm} open={!!wSh} onClose={()=>setWSh(null)} title={wSh==="add"?"Log Wastage":"Edit Wastage Record"}>
        <Inp dm={dm} label="Product / Item *" value={wF.product} onChange={e=>setWF({...wF,product:e.target.value})} placeholder="e.g. Roti, Paratha Pack…"/>
        <div className="crm-grid-2" style={{gap:3*4}}>
          <Inp dm={dm} label="Quantity *" type="number" value={wF.qty} onChange={e=>setWF({...wF,qty:e.target.value})} placeholder="e.g. 15"/>
          <Sel dm={dm} label="Unit" value={wF.unit} onChange={e=>setWF({...wF,unit:e.target.value})}>
            {(settings?.supplyUnits||["pcs","kg","pack","L"]).map(u=><option key={u}>{u}</option>)}
          </Sel>
        </div>
        <Sel dm={dm} label="Wastage Type *" value={wF.type} onChange={e=>setWF({...wF,type:e.target.value})}>
          {(settings?.wastageTypes||["Burnt","Broken","Expired","Overproduced","Quality Reject","Other"]).map(t=><option key={t}>{t}</option>)}
        </Sel>
        <Sel dm={dm} label="Shift" value={wF.shift} onChange={e=>setWF({...wF,shift:e.target.value})}>
          {(settings?.shifts||["Morning","Afternoon","Evening","Night"]).map(s=><option key={s}>{s}</option>)}
        </Sel>
        <div className="crm-grid-2" style={{gap:3*4}}>
          <Inp dm={dm} label="Date" type="date" value={wF.date} onChange={e=>setWF({...wF,date:e.target.value})}/>
          {can("waste_logCost")&& <Inp dm={dm} label="Estimated Cost Loss (₹)" type="number" value={wF.cost} onChange={e=>setWF({...wF,cost:e.target.value})} placeholder="0"/>}
        </div>
        <Inp dm={dm} label="Reason / Notes" value={wF.reason} onChange={e=>setWF({...wF,reason:e.target.value})} placeholder="What caused this wastage? e.g. Overcooked, power cut…"/>
        {/* Quick reference: today's wastage so far */}
        {(()=>{const tw=wastage.filter(w=>w.date===wF.date&&w.id!==(wSh?.id));const tq=tw.reduce((s,w)=>s+(w.qty||0),0);return tq>0&&<div style={{background:t.inp,border:`1px solid ${t.inpB}`}} className="rounded-xl px-3.5 py-2.5">
          <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-1">Already logged on {wF.date}</p>
          {tw.slice(0,4).map(w=><div key={w.id} className="flex justify-between text-xs py-0.5"><span style={{color:t.sub}}>{w.product} — {w.type}</span><span style={{color:t.text}} className="font-semibold">{w.qty} {w.unit}</span></div>)}
          <div style={{borderTop:`1px solid ${t.border}`}} className="mt-1 pt-1 flex justify-between text-xs font-bold"><span style={{color:t.sub}}>Total today</span><span style={{color:"#f97316"}}>{tq} units</span></div>
        </div>})()}
        <Btn dm={dm} onClick={saveW} className="w-full">Save Wastage Record</Btn>
      </Sheet>

      {/* Payment Sheet */}
      <Sheet dm={dm} open={!!paySh} onClose={()=>{setPaySh(null);setPayAmt("");}} title="Record Payment">
        {paySh&&<>
          <p style={{color:t.text}} className="text-sm font-semibold">{paySh.name}</p>
          <div className="flex gap-3"><span className="text-sm text-emerald-500 font-bold">Paid: {inr(paySh.paid)}</span><span className="text-sm text-red-500 font-bold">Due: {inr(paySh.pending)}</span></div>
          <div className="crm-btn-group">{[paySh.pending,500,1000,2000].filter((v,i,a)=>v>0&&a.indexOf(v)===i).map(q=><button key={q} onClick={()=>setPayAmt(String(q))} style={payAmt===String(q)?{background:"#f59e0b",color:"#000"}:{background:t.inp,color:t.text}} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px]">₹{q.toLocaleString("en-IN")}</button>)}</div>
          <Inp dm={dm} label="Amount (₹)" type="number" value={payAmt} onChange={e=>setPayAmt(e.target.value)} placeholder="Enter amount"/>
          <div className="flex gap-2"><Btn dm={dm} v="ghost" className="flex-1" onClick={()=>{setPaySh(null);setPayAmt("");}}>Cancel</Btn><Btn dm={dm} v="success" className="flex-1" onClick={recPay} disabled={!payAmt}>Confirm ₹{payAmt||0}</Btn></div>
        </>}
      </Sheet>

      {/* ── PAYMENT LEDGER MANUAL ENTRY SHEET ── */}
      <Sheet dm={dm} open={payLedgerSh} onClose={()=>{setPayLedgerSh(false);setPayLedgerCust(null);setPayLedgerAmt("");setPayLedgerNote("");setPayLedgerMethod("Cash");}} title="💰 Record Payment">
        {/* Customer picker */}
        <Sel dm={dm} label="Customer *" value={payLedgerCust?.id||""} onChange={e=>{const c=customers.find(x=>x.id===e.target.value);setPayLedgerCust(c||null);if(c)setPayLedgerAmt(String(c.pending||""));}}>
          <option value="">— Select customer —</option>
          {customers.filter(c=>c.active).sort((a,b)=>(b.pending||0)-(a.pending||0)).map(c=><option key={c.id} value={c.id}>{c.name}{c.pending>0?` · ₹${c.pending} due`:""}</option>)}
        </Sel>
        {/* Customer status card */}
        {payLedgerCust&&<div style={{background:dm?"rgba(16,185,129,0.08)":"#f0fdf9",border:"1px solid #10b98130",borderRadius:14,padding:"12px 16px"}}>
          <p style={{color:t.text,fontWeight:800,fontSize:14,marginBottom:8}}>{payLedgerCust.name}</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
            <div style={{background:dm?"rgba(16,185,129,0.1)":"#fff",borderRadius:10,padding:"8px 12px",textAlign:"center"}}>
              <p style={{color:"#10b981",fontWeight:800,fontSize:15}}>{inr(payLedgerCust.paid||0)}</p>
              <p style={{color:t.sub,fontSize:9,marginTop:2,textTransform:"uppercase",letterSpacing:"0.06em"}}>Total Paid</p>
            </div>
            <div style={{background:dm?"rgba(239,68,68,0.1)":"#fff",borderRadius:10,padding:"8px 12px",textAlign:"center"}}>
              <p style={{color:(payLedgerCust.pending||0)>0?"#ef4444":"#10b981",fontWeight:800,fontSize:15}}>{inr(payLedgerCust.pending||0)}</p>
              <p style={{color:t.sub,fontSize:9,marginTop:2,textTransform:"uppercase",letterSpacing:"0.06em"}}>Outstanding</p>
            </div>
          </div>
        </div>}
        {/* Quick amount buttons */}
        {payLedgerCust&&(payLedgerCust.pending||0)>0&&(()=>{
          const quickAmts=[payLedgerCust.pending,500,1000,2000].filter((v,i,a)=>v>0&&a.indexOf(v)===i).slice(0,4);
          return <div>
            <p style={{color:t.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Quick Select</p>
            <div style={{display:"grid",gridTemplateColumns:`repeat(${quickAmts.length},1fr)`,gap:6}}>
              {quickAmts.map(q=>{
                const isSelected=payLedgerAmt===String(q);
                const isFull=q===payLedgerCust.pending;
                return <button key={q} onClick={()=>setPayLedgerAmt(String(q))}
                  style={{background:isSelected?"#10b981":t.inp,color:isSelected?"#fff":t.text,
                    border:`1.5px solid ${isSelected?"#10b981":isFull?"#10b98150":t.border}`,
                    borderRadius:10,padding:"8px 4px",fontSize:11,fontWeight:700,cursor:"pointer",
                    WebkitTapHighlightColor:"transparent",textAlign:"center",lineHeight:1.3}}>
                  {inr(q)}{isFull&&<><br/><span style={{fontSize:9,opacity:0.8}}>Full</span></>}
                </button>;
              })}
            </div>
          </div>;
        })()}
        {/* Amount input */}
        <Inp dm={dm} label="Amount Received (₹) *" type="number" value={payLedgerAmt} onChange={e=>setPayLedgerAmt(e.target.value)} placeholder="0"/>
        {/* Payment method — icon grid */}
        <div>
          <p style={{color:t.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Payment Method</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6}}>
            {[["Cash","💵"],["UPI","📲"],["Bank Transfer","🏦"],["Cheque","📋"],["Other","💼"]].map(([m,icon])=>(
              <button key={m} onClick={()=>setPayLedgerMethod(m)}
                style={{background:payLedgerMethod===m?"#3b82f6":t.inp,
                  color:payLedgerMethod===m?"#fff":t.sub,
                  border:`1.5px solid ${payLedgerMethod===m?"#3b82f6":t.border}`,
                  borderRadius:10,padding:"8px 4px",fontSize:10,fontWeight:700,cursor:"pointer",
                  WebkitTapHighlightColor:"transparent",textAlign:"center",lineHeight:1.4}}>
                <div style={{fontSize:18,lineHeight:1,marginBottom:2}}>{icon}</div>
                {m.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>
        <Inp dm={dm} label="Note / Reference (optional)" value={payLedgerNote} onChange={e=>setPayLedgerNote(e.target.value)} placeholder="UPI ref, transaction ID, receipt no…"/>
        {/* Confirm strip */}
        {payLedgerAmt&&+payLedgerAmt>0&&<div style={{background:dm?"rgba(16,185,129,0.1)":"#f0fdf9",border:"1px solid #10b98130",borderRadius:12,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <p style={{color:t.sub,fontSize:10}}>Recording payment via {payLedgerMethod}</p>
            {payLedgerCust&&(payLedgerCust.pending||0)>0&&<p style={{color:t.sub,fontSize:10}}>
              Balance after: {inr(Math.max(0,(payLedgerCust.pending||0)-(+payLedgerAmt||0)))}
            </p>}
          </div>
          <p style={{color:"#10b981",fontWeight:900,fontSize:18}}>{inr(+payLedgerAmt)}</p>
        </div>}
        <div className="flex gap-2">
          <Btn dm={dm} v="ghost" className="flex-1" onClick={()=>{setPayLedgerSh(false);setPayLedgerCust(null);setPayLedgerAmt("");setPayLedgerNote("");setPayLedgerMethod("Cash");}}>Cancel</Btn>
          <Btn dm={dm} v="success" className="flex-1" onClick={()=>{
            if(!payLedgerCust){notify("Select a customer");return;}
            const amt=+payLedgerAmt;
            if(!amt||amt<=0){notify("Enter a valid amount");return;}
            recordPaymentLedger(payLedgerCust.id,payLedgerCust.name,amt,payLedgerNote,payLedgerMethod);
            setPayLedgerSh(false);setPayLedgerCust(null);setPayLedgerAmt("");setPayLedgerNote("");setPayLedgerMethod("Cash");
          }}>✓ Confirm {payLedgerAmt&&+payLedgerAmt>0?inr(+payLedgerAmt):""}</Btn>
        </div>
      </Sheet>


      {/* Production Sheet — Redesigned Log New Batch */}
      <Sheet dm={dm} open={!!ptSh} onClose={()=>setPtSh(null)} title={ptSh==="add"?"🏭 Log New Batch":"✏️ Edit Batch"}>
        {(()=>{
          const tS=T(dm);
          // ── SECTION 1: Batch Identity ──────────────────────────────
          return <>
          {/* Batch Identity Banner */}
          <div style={{background:`linear-gradient(135deg,${dm?"#2d1f5e":"#ede9fe"},${dm?"#1e3a5f":"#dbeafe"})`,borderRadius:16,padding:"14px 16px",marginBottom:4}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:0}}>
                <p style={{color:dm?"#c4b5fd":"#7c3aed",fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>🏭 Batch Identity</p>
                <p style={{color:dm?"#e2d9f3":"#1e1b4b",fontWeight:900,fontSize:22,lineHeight:1,marginBottom:2}}>{ptF.batchLabel||"New Batch"}</p>
                <p style={{color:dm?"#a5b4fc":"#6366f1",fontSize:11,fontWeight:600}}>{ptF.product||"No product selected"}{ptF.shift?` · ${ptF.shift} Shift`:""}</p>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{background:dm?"rgba(139,92,246,0.3)":"rgba(139,92,246,0.15)",border:`2px solid ${dm?"#7c3aed":"#8b5cf6"}`,borderRadius:12,padding:"8px 14px",marginBottom:4}}>
                  <p style={{color:dm?"#c4b5fd":"#7c3aed",fontSize:10,fontWeight:700,textTransform:"uppercase"}}>Units</p>
                  <p style={{color:dm?"#fff":"#1e1b4b",fontWeight:900,fontSize:26,lineHeight:1}}>{ptF.actual||"—"}</p>
                </div>
                <div style={{display:"flex",gap:4,justifyContent:"flex-end"}}>
                  {["A","B","C","F"].map(g=><span key={g} style={{background:ptF.qcGrade===g?({A:"#10b981",B:"#f59e0b",C:"#f97316",F:"#ef4444"}[g]||"#8b5cf6")+"22":"transparent",color:{A:"#10b981",B:"#f59e0b",C:"#f97316",F:"#ef4444"}[g]||"#8b5cf6",border:`1.5px solid ${ptF.qcGrade===g?({A:"#10b981",B:"#f59e0b",C:"#f97316",F:"#ef4444"}[g]||"#8b5cf6"):"transparent"}`,borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:800}}>{g}</span>)}
                </div>
              </div>
            </div>
          </div>

          {/* ── SECTION 1: Core Details ── */}
          <div style={{borderRadius:14,border:`1.5px solid ${tS.border}`,overflow:"visible",marginBottom:4}}>
            <div style={{background:dm?"rgba(139,92,246,0.1)":"rgba(139,92,246,0.05)",padding:"10px 14px",borderBottom:`1px solid ${tS.border}`}}>
              <p style={{color:"#8b5cf6",fontWeight:800,fontSize:12}}>① Batch Details</p>
              <p style={{color:tS.sub,fontSize:10}}>What was produced, when, and by which shift</p>
            </div>
            <div style={{padding:"14px 14px",display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:10}}>
                <Inp dm={dm} label="Batch Label *" value={ptF.batchLabel||""} onChange={e=>{const v=e.target.value;setPtF(f=>({...f,batchLabel:v}));}} placeholder="e.g. Batch 1, Morning Run A"/>
                <Inp dm={dm} label="Date *" type="date" value={ptF.date||today()} onChange={e=>{const v=e.target.value;setPtF(f=>({...f,date:v}));}}/>
              </div>
              <Sel dm={dm} label="Product *" value={ptF.product} onChange={e=>{const v=e.target.value;setPtF(f=>({...f,product:v}));}}>
                <option value="">— Select product —</option>
                {(prodItems||[]).map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
                <option value="__custom__">Other / Custom</option>
              </Sel>
              {ptF.product==="__custom__"&&<Inp dm={dm} label="Custom Product Name *" value={ptF.customProduct||""} onChange={e=>{const v=e.target.value;setPtF(f=>({...f,customProduct:v}));}} placeholder="e.g. Special Paratha"/>}
              {/* Shift pills */}
              <div>
                <p style={{color:tS.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Shift</p>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {[{v:"",l:"No Shift"},...(settings?.shifts||["Morning","Afternoon","Evening","Night"]).map(s=>({v:s,l:s}))].map(({v,l})=>(
                    <button key={v} onClick={()=>setPtF(f=>({...f,shift:v}))}
                      style={{background:ptF.shift===v?"#8b5cf6":tS.inp,color:ptF.shift===v?"#fff":tS.sub,border:`1.5px solid ${ptF.shift===v?"#8b5cf6":tS.border}`,borderRadius:99,padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer",transition:"all 0.15s",WebkitTapHighlightColor:"transparent"}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── SECTION 2: Output & QC ── */}
          <div style={{borderRadius:14,border:`1.5px solid ${tS.border}`,overflow:"visible",marginBottom:4}}>
            <div style={{background:dm?"rgba(16,185,129,0.1)":"rgba(16,185,129,0.05)",padding:"10px 14px",borderBottom:`1px solid ${tS.border}`}}>
              <p style={{color:"#10b981",fontWeight:800,fontSize:12}}>② Output & Quality</p>
              <p style={{color:tS.sub,fontSize:10}}>Units produced and quality grade for recall traceability</p>
            </div>
            <div style={{padding:"14px 14px",display:"flex",flexDirection:"column",gap:12}}>
              {/* Big unit counter */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:10,alignItems:"end"}}>
                <div>
                  <p style={{color:tS.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Units Produced *</p>
                  <div style={{display:"flex",alignItems:"center",gap:8,background:tS.inp,border:`1.5px solid ${tS.inpB}`,borderRadius:12,padding:"8px 12px"}}>
                    <button onClick={()=>setPtF(f=>({...f,actual:String(Math.max(0,(+f.actual||0)-1))}))}
                      style={{width:32,height:32,borderRadius:8,background:tS.card,border:`1px solid ${tS.border}`,color:tS.text,fontWeight:900,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>−</button>
                    <input type="number" value={ptF.actual} onChange={e=>{const v=e.target.value;setPtF(f=>({...f,actual:v}));}} placeholder="0"
                      style={{flex:1,background:"transparent",border:"none",outline:"none",color:tS.text,fontWeight:900,fontSize:24,textAlign:"center",minWidth:0}}/>
                    <button onClick={()=>setPtF(f=>({...f,actual:String((+f.actual||0)+1)}))}
                      style={{width:32,height:32,borderRadius:8,background:"#8b5cf6",border:"none",color:"#fff",fontWeight:900,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>+</button>
                  </div>
                  {/* Quick presets */}
                  <div style={{display:"flex",gap:4,marginTop:6,flexWrap:"wrap"}}>
                    {(settings?.batchUnitPresets||[50,100,150,200,250,300]).map(n=>(
                      <button key={n} onClick={()=>setPtF(f=>({...f,actual:String(n)}))}
                        style={{background:+ptF.actual===n?"#8b5cf6":tS.inp,color:+ptF.actual===n?"#fff":tS.sub,border:`1px solid ${+ptF.actual===n?"#8b5cf6":tS.border}`,borderRadius:6,padding:"5px 10px",fontSize:10,fontWeight:700,cursor:"pointer",transition:"all 0.1s"}}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                {/* QC Grade visual picker */}
                <div>
                  <p style={{color:tS.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>QC Grade *</p>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:6}}>
                    {[{g:"A",color:"#10b981",label:"Pass"},{g:"B",color:"#f59e0b",label:"Pass"},{g:"C",color:"#f97316",label:"Marginal"},{g:"F",color:"#ef4444",label:"Fail"}].map(({g,color,label})=>(
                      <button key={g} onClick={()=>setPtF(f=>({...f,qcGrade:g}))}
                        style={{background:ptF.qcGrade===g?color+"25":tS.card,border:`2px solid ${ptF.qcGrade===g?color:tS.inpB}`,borderRadius:10,padding:"8px 4px",textAlign:"center",cursor:"pointer",transition:"all 0.15s",WebkitTapHighlightColor:"transparent"}}>
                        <p style={{color,fontWeight:900,fontSize:20,lineHeight:1}}>{g}</p>
                        <p style={{color:ptF.qcGrade===g?color:tS.sub,fontSize:9,fontWeight:600,marginTop:2}}>{label}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {/* Auto-deduct preview */}
              {ptAutoDeduct&&+ptF.actual>0&&(()=>{
                const pname=(ptF.product==="__custom__"?ptF.customProduct:ptF.product)||"";
                const pn=pname.toLowerCase();
                const scored=supplies.map(s=>{const sn=(s.item||"").toLowerCase();let score=0;if(sn===pn)score=100;else if(sn.includes(pn)||pn.includes(sn))score=60;else{const pW=pn.split(/\s+/);const sW=sn.split(/\s+/);const h=pW.filter(w=>sW.some(sw=>sw.includes(w)||w.includes(sw)));if(h.length>0)score=30+h.length*10;}return{...s,_score:score};}).filter(s=>s._score>0).sort((a,b)=>b._score-a._score);
                const match=scored[0];
                if(!match)return null;
                const afterQty=Math.max(0,(match.qty||0)-+ptF.actual);
                return <div style={{background:"#10b98110",border:"1px solid #10b98130",borderRadius:10,padding:"10px 12px",display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:16}}>📦</span>
                  <div style={{flex:1}}>
                    <p style={{color:"#10b981",fontSize:11,fontWeight:700}}>Auto-deduct preview</p>
                    <p style={{color:tS.sub,fontSize:10}}>Saves "{match.item}": {match.qty} → {afterQty} {match.unit} after this batch</p>
                  </div>
                </div>;
              })()}
              <Inp dm={dm} label="Batch Notes" value={ptF.notes} onChange={e=>{const v=e.target.value;setPtF(f=>({...f,notes:v}));}} placeholder="e.g. Machine issue, short staff, quality remarks…"/>
            </div>
          </div>

          {/* ── SECTION 3: Customer Traceability ── */}
          {(()=>{
            const batchDate=ptF.date||today();
            const sameDateDelivs=deliveries.filter(d=>d.date===batchDate&&d.status!=="Cancelled");
            const productName=(ptF.product==="__custom__"?ptF.customProduct:ptF.product)||"";
            // Find deliveries that include this product
            const matchingDelivs=productName?sameDateDelivs.filter(d=>Object.entries(safeO(d.orderLines)).some(([pid,l])=>{if(!(l.qty>0))return false;const p=products.find(x=>x.id===pid);const pName=p?.name||l.name||"";return pName===productName||pName.toLowerCase().includes(productName.toLowerCase())||productName.toLowerCase().includes(pName.toLowerCase());})):sameDateDelivs;
            const totalUnitsOrdered=matchingDelivs.reduce((s,d)=>Object.entries(safeO(d.orderLines)).reduce((s2,[pid,l])=>{if(!(l.qty>0))return s2;const p=products.find(x=>x.id===pid);const pName=p?.name||l.name||"";if(!productName||pName===productName||pName.toLowerCase().includes(productName.toLowerCase())||productName.toLowerCase().includes(pName.toLowerCase()))return s2+(+l.qty||0);return s2;},s),0);
            return <div style={{borderRadius:14,border:`1.5px solid ${tS.border}`,overflow:"visible",marginBottom:4}}>
              <div style={{background:dm?"rgba(124,58,237,0.12)":"rgba(124,58,237,0.06)",padding:"10px 14px",borderBottom:`1px solid ${tS.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <p style={{color:"#7c3aed",fontWeight:800,fontSize:12}}>③ Customer Traceability</p>
                  <p style={{color:tS.sub,fontSize:10}}>Who receives products from this batch — for recall tracking</p>
                </div>
                <span style={{background:"#7c3aed22",color:"#7c3aed",borderRadius:8,padding:"3px 10px",fontSize:11,fontWeight:800}}>{matchingDelivs.length} orders</span>
              </div>
              <div style={{padding:"14px 14px"}}>
                {matchingDelivs.length===0
                  ?<div style={{textAlign:"center",padding:"12px 0"}}>
                    <p style={{fontSize:20,marginBottom:6}}>📭</p>
                    <p style={{color:tS.sub,fontSize:12,fontWeight:600}}>No deliveries found for {batchDate}</p>
                    <p style={{color:tS.sub,fontSize:10,marginTop:3}}>{productName?"for "+productName+" — ":""}Deliveries added for this date will appear here automatically</p>
                  </div>
                  :<>
                    {/* Summary row */}
                    <div className="crm-grid-3" style={{gap:8,marginBottom:12}}>
                      {[
                        {l:"Customers",v:matchingDelivs.length,c:"#7c3aed"},
                        {l:"Units Ordered",v:totalUnitsOrdered,c:"#8b5cf6"},
                        {l:"Surplus/Deficit",v:(+ptF.actual||0)-totalUnitsOrdered,c:(+ptF.actual||0)>=totalUnitsOrdered?"#10b981":"#ef4444"},
                      ].map(x=><div key={x.l} style={{background:tS.inp,borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
                        <p style={{color:x.c,fontWeight:900,fontSize:16,lineHeight:1}}>{x.v>=0&&x.l==="Surplus/Deficit"&&x.v>0?"+":""}{x.v}</p>
                        <p style={{color:tS.sub,fontSize:9,marginTop:3,fontWeight:600,textTransform:"uppercase"}}>{x.l}</p>
                      </div>)}
                    </div>
                    {/* Customer list */}
                    <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:200,overflowY:"auto"}}>
                      {matchingDelivs.map((d,di)=>{
                        const dInvNo=(invRegistry?.issued||{})[d.id]||d.invNo||null;
                        const prodQty=Object.entries(safeO(d.orderLines)).filter(([pid,l])=>{if(!(l.qty>0))return false;const p=products.find(x=>x.id===pid);const pName=p?.name||l.name||"";return !productName||pName===productName||pName.toLowerCase().includes(productName.toLowerCase())||productName.toLowerCase().includes(pName.toLowerCase());}).reduce((s,[,l])=>s+(+l.qty||0),0);
                        const statusColor=d.status==="Delivered"?"#10b981":d.status==="In Transit"?"#3b82f6":d.status==="Cancelled"?"#ef4444":"#f59e0b";
                        return <div key={d.id} style={{background:tS.card,border:`1px solid ${tS.border}`,borderRadius:10,padding:"8px 12px",display:"flex",alignItems:"center",gap:10,borderLeft:`3px solid ${statusColor}`}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:2}}>
                              <p style={{color:tS.text,fontWeight:700,fontSize:12}}>{d.customer}</p>
                              <span style={{background:statusColor+"15",color:statusColor,borderRadius:5,padding:"1px 6px",fontSize:9,fontWeight:700}}>{d.status}</span>
                              {dInvNo&&<span style={{background:dm?"rgba(139,92,246,0.15)":"rgba(139,92,246,0.08)",color:"#8b5cf6",borderRadius:5,padding:"1px 6px",fontSize:9,fontWeight:700,fontFamily:"monospace"}}>📄 {dInvNo}</span>}
                            </div>
                            {d.address&&<p style={{color:tS.sub,fontSize:10}}>📍 {d.address}</p>}
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <p style={{color:"#8b5cf6",fontWeight:800,fontSize:14,lineHeight:1}}>{prodQty}</p>
                            <p style={{color:tS.sub,fontSize:9}}>units</p>
                          </div>
                        </div>;
                      })}
                    </div>
                    {matchingDelivs.length>0&&<p style={{color:tS.sub,fontSize:10,marginTop:8,textAlign:"center"}}>💡 This links batch to customers automatically — critical for product recall</p>}
                  </>
                }
              </div>
            </div>;
          })()}

          {/* ── SECTION 4: Wastage ── */}
          <div style={{borderRadius:14,border:`1.5px solid ${tS.border}`,overflow:"visible",marginBottom:4}}>
            <div style={{background:dm?"rgba(249,115,22,0.1)":"rgba(249,115,22,0.05)",padding:"10px 14px",borderBottom:(ptF.embWastage||[]).length>0?`1px solid ${tS.border}`:"none",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <p style={{color:"#f97316",fontWeight:800,fontSize:12}}>④ Wastage <span style={{fontWeight:400,fontSize:10,color:tS.sub}}>(optional)</span></p>
                <p style={{color:tS.sub,fontSize:10}}>Log any wasted or rejected units from this batch</p>
              </div>
              <button onClick={()=>setPtF(f=>({...f,embWastage:[...(f.embWastage||[]),{id:uid(),product:f.product==="__custom__"?(f.customProduct||""):f.product,qty:"",unit:"pcs",type:(settings?.wastageTypes||["Other"])[0],reason:"",cost:"",shift:f.shift||"",date:f.date||today(),loggedBy:sess?.name||displayName}]}))}
                style={{background:"#f9731620",color:"#f97316",border:"1px solid #f9731640",borderRadius:8,padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:14}}>+</span> Add Wastage
              </button>
            </div>
            {(ptF.embWastage||[]).length>0&&<div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:8}}>
              {(ptF.embWastage||[]).map((w,wi)=>(
                <div key={w.id||wi} style={{background:tS.inp,border:`1px solid ${tS.inpB}`,borderRadius:12,padding:"10px 12px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{background:"#f9731620",color:"#f97316",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>🗑️ Entry {wi+1}</span>
                    </div>
                    {isAdmin&&<button onClick={()=>setPtF(f=>({...f,embWastage:(f.embWastage||[]).filter((_,i)=>i!==wi)}))} style={{background:"#dc262615",color:"#dc2626",border:"none",borderRadius:6,padding:"3px 10px",fontSize:10,fontWeight:700,cursor:"pointer"}}>Remove</button>}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr",gap:8}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 80px 80px",gap:8}}>
                      <Inp dm={dm} label="Product" value={w.product} onChange={e=>setPtF(f=>({...f,embWastage:(f.embWastage||[]).map((x,i)=>i===wi?{...x,product:e.target.value}:x)}))} placeholder="Product name"/>
                      <Inp dm={dm} label="Qty" type="number" value={w.qty} onChange={e=>setPtF(f=>({...f,embWastage:(f.embWastage||[]).map((x,i)=>i===wi?{...x,qty:e.target.value}:x)}))} placeholder="0"/>
                      <Sel dm={dm} label="Unit" value={w.unit} onChange={e=>setPtF(f=>({...f,embWastage:(f.embWastage||[]).map((x,i)=>i===wi?{...x,unit:e.target.value}:x)}))}>
                        {(settings?.supplyUnits||["pcs","kg","g","L","mL","bags","boxes","dozen"]).map(u=><option key={u}>{u}</option>)}
                      </Sel>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
                      <Sel dm={dm} label="Type" value={w.type} onChange={e=>setPtF(f=>({...f,embWastage:(f.embWastage||[]).map((x,i)=>i===wi?{...x,type:e.target.value}:x)}))}>
                        {(settings?.wastageTypes||["Burnt","Broken","Expired","Overproduced","Quality Reject","Other"]).map(t2=><option key={t2}>{t2}</option>)}
                      </Sel>
                      {can("waste_logCost")&&<Inp dm={dm} label="Cost (₹)" type="number" value={w.cost||""} onChange={e=>setPtF(f=>({...f,embWastage:(f.embWastage||[]).map((x,i)=>i===wi?{...x,cost:e.target.value}:x)}))} placeholder="0"/>}
                    </div>
                    <Inp dm={dm} label="Reason" value={w.reason||""} onChange={e=>setPtF(f=>({...f,embWastage:(f.embWastage||[]).map((x,i)=>i===wi?{...x,reason:e.target.value}:x)}))} placeholder="e.g. Overcooked, dropped, equipment failure…"/>
                  </div>
                </div>
              ))}
            </div>}
          </div>

          {/* ── SECTION 5: QC Checks ── */}
          <div style={{borderRadius:14,border:`1.5px solid ${tS.border}`,overflow:"visible",marginBottom:4}}>
            <div style={{background:dm?"rgba(20,184,166,0.1)":"rgba(20,184,166,0.05)",padding:"10px 14px",borderBottom:(ptF.embQC||[]).length>0?`1px solid ${tS.border}`:"none",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <p style={{color:"#14b8a6",fontWeight:800,fontSize:12}}>⑤ QC Checks <span style={{fontWeight:400,fontSize:10,color:tS.sub}}>(optional)</span></p>
                <p style={{color:tS.sub,fontSize:10}}>Detailed quality inspection records for this batch</p>
              </div>
              <button onClick={()=>setPtF(f=>({...f,embQC:[...(f.embQC||[]),{id:uid(),product:f.product==="__custom__"?(f.customProduct||""):f.product,grade:"A",checker:sess?.name||displayName,notes:"",shift:f.shift||"",date:f.date||today()}]}))}
                style={{background:"#14b8a620",color:"#14b8a6",border:"1px solid #14b8a640",borderRadius:8,padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:14}}>+</span> Add Check
              </button>
            </div>
            {(ptF.embQC||[]).length>0&&<div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:8}}>
              {(ptF.embQC||[]).map((q,qi)=>(
                <div key={q.id||qi} style={{background:tS.inp,border:`1px solid ${tS.inpB}`,borderRadius:12,padding:"10px 12px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <span style={{background:"#14b8a620",color:"#14b8a6",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>✅ Check {qi+1}</span>
                    {isAdmin&&<button onClick={()=>setPtF(f=>({...f,embQC:(f.embQC||[]).filter((_,i)=>i!==qi)}))} style={{background:"#dc262615",color:"#dc2626",border:"none",borderRadius:6,padding:"3px 10px",fontSize:10,fontWeight:700,cursor:"pointer"}}>Remove</button>}
                  </div>
                  <Inp dm={dm} label="Product Inspected" value={q.product} onChange={e=>setPtF(f=>({...f,embQC:(f.embQC||[]).map((x,i)=>i===qi?{...x,product:e.target.value}:x)}))} placeholder="Product name"/>
                  <div className="crm-grid-4" style={{gap:6,marginTop:8}}>
                    {[{g:"A",color:"#10b981",label:"Pass"},{g:"B",color:"#f59e0b",label:"Pass"},{g:"C",color:"#f97316",label:"Marginal"},{g:"F",color:"#ef4444",label:"Fail"}].map(({g,color,label})=>(
                      <button key={g} onClick={()=>setPtF(f=>({...f,embQC:(f.embQC||[]).map((x,i)=>i===qi?{...x,grade:g}:x)}))}
                        style={{background:q.grade===g?color+"25":tS.card,border:`2px solid ${q.grade===g?color:tS.inpB}`,borderRadius:10,padding:"8px 4px",textAlign:"center",cursor:"pointer",transition:"all 0.15s"}}>
                        <p style={{color,fontWeight:900,fontSize:18,lineHeight:1}}>{g}</p>
                        <p style={{color:q.grade===g?color:tS.sub,fontSize:9,fontWeight:600}}>{label}</p>
                      </button>
                    ))}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8,marginTop:8}}>
                    <Inp dm={dm} label="Inspector Name" value={q.checker||""} onChange={e=>setPtF(f=>({...f,embQC:(f.embQC||[]).map((x,i)=>i===qi?{...x,checker:e.target.value}:x)}))} placeholder="Inspector"/>
                    <Inp dm={dm} label="Observations" value={q.notes||""} onChange={e=>setPtF(f=>({...f,embQC:(f.embQC||[]).map((x,i)=>i===qi?{...x,notes:e.target.value}:x)}))} placeholder="e.g. Colour good, texture ok…"/>
                  </div>
                </div>
              ))}
            </div>}
          </div>

          {/* ── SECTION 6: Handovers ── */}
          <div style={{borderRadius:14,border:`1.5px solid ${tS.border}`,overflow:"visible",marginBottom:4}}>
            <div style={{background:dm?"rgba(99,102,241,0.1)":"rgba(99,102,241,0.05)",padding:"10px 14px",borderBottom:(ptF.embHandover||[]).length>0?`1px solid ${tS.border}`:"none",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <p style={{color:"#6366f1",fontWeight:800,fontSize:12}}>⑥ Shift Handover <span style={{fontWeight:400,fontSize:10,color:tS.sub}}>(optional)</span></p>
                <p style={{color:tS.sub,fontSize:10}}>Notes passed to the next shift</p>
              </div>
              {can("prod_handover")&&<button onClick={()=>setPtF(f=>({...f,embHandover:[...(f.embHandover||[]),{id:uid(),shift:f.shift||"",nextShift:"",note:"",issues:"",loggedBy:sess?.name||displayName,date:f.date||today()}]}))}
                style={{background:"#6366f120",color:"#6366f1",border:"1px solid #6366f140",borderRadius:8,padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:14}}>+</span> Add Note
              </button>}
            </div>
            {(ptF.embHandover||[]).length>0&&<div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:8}}>
              {(ptF.embHandover||[]).map((h,hi)=>(
                <div key={h.id||hi} style={{background:tS.inp,border:`1px solid ${tS.inpB}`,borderRadius:12,padding:"10px 12px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <span style={{background:"#6366f120",color:"#6366f1",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>📋 Handover {hi+1}</span>
                    {isAdmin&&<button onClick={()=>setPtF(f=>({...f,embHandover:(f.embHandover||[]).filter((_,i)=>i!==hi)}))} style={{background:"#dc262615",color:"#dc2626",border:"none",borderRadius:6,padding:"3px 10px",fontSize:10,fontWeight:700,cursor:"pointer"}}>Remove</button>}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
                    <Sel dm={dm} label="Current Shift" value={h.shift||""} onChange={e=>setPtF(f=>({...f,embHandover:(f.embHandover||[]).map((x,i)=>i===hi?{...x,shift:e.target.value}:x)}))}>
                      <option value="">—</option>
                      {(settings?.shifts||["Morning","Afternoon","Evening","Night"]).map(s=><option key={s}>{s}</option>)}
                    </Sel>
                    <Sel dm={dm} label="Next Shift" value={h.nextShift||""} onChange={e=>setPtF(f=>({...f,embHandover:(f.embHandover||[]).map((x,i)=>i===hi?{...x,nextShift:e.target.value}:x)}))}>
                      <option value="">—</option>
                      {(settings?.shifts||["Morning","Afternoon","Evening","Night"]).map(s=><option key={s}>{s}</option>)}
                    </Sel>
                  </div>
                  <Inp dm={dm} label="Handover Note *" value={h.note||""} onChange={e=>setPtF(f=>({...f,embHandover:(f.embHandover||[]).map((x,i)=>i===hi?{...x,note:e.target.value}:x)}))} placeholder="e.g. Machine needs servicing, batch came out well…"/>
                  <Inp dm={dm} label="Issues / Flags" value={h.issues||""} onChange={e=>setPtF(f=>({...f,embHandover:(f.embHandover||[]).map((x,i)=>i===hi?{...x,issues:e.target.value}:x)}))} placeholder="e.g. Low gas, 2 staff absent…"/>
                  <Inp dm={dm} label="Logged By" value={h.loggedBy||""} onChange={e=>setPtF(f=>({...f,embHandover:(f.embHandover||[]).map((x,i)=>i===hi?{...x,loggedBy:e.target.value}:x)}))} placeholder="Name"/>
                </div>
              ))}
            </div>}
          </div>

          {/* ── Save Summary & Button ── */}
          <div style={{background:dm?"rgba(139,92,246,0.1)":"rgba(139,92,246,0.06)",border:`1.5px solid rgba(139,92,246,0.3)`,borderRadius:14,padding:"14px 16px",marginTop:4}}>
            <p style={{color:"#8b5cf6",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Batch Summary</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(140px,100%),1fr))",gap:6,marginBottom:12}}>
              {[
                {l:"Product",v:ptF.product==="__custom__"?(ptF.customProduct||"—"):(ptF.product||"—"),c:tS.text},
                {l:"Units",v:ptF.actual||"0",c:"#8b5cf6"},
                {l:"Date",v:ptF.date||today(),c:tS.text},
                {l:"QC Grade",v:ptF.qcGrade||"A",c:{A:"#10b981",B:"#f59e0b",C:"#f97316",F:"#ef4444"}[ptF.qcGrade]||"#10b981"},
                {l:"Wastage Entries",v:(ptF.embWastage||[]).filter(w=>w.product&&w.qty).length,c:"#f97316"},
                {l:"QC Checks",v:(ptF.embQC||[]).filter(q=>q.product&&q.grade).length,c:"#14b8a6"},
              ].map(x=><div key={x.l} style={{background:tS.card,borderRadius:8,padding:"7px 10px"}}>
                <p style={{color:tS.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>{x.l}</p>
                <p style={{color:x.c,fontWeight:700,fontSize:12,marginTop:2}}>{x.v}</p>
              </div>)}
            </div>
            <Btn dm={dm} onClick={savePT} className="w-full" style={{background:"linear-gradient(135deg,#7c3aed,#6366f1)",color:"#fff",border:"none",fontSize:15,padding:"14px",fontWeight:800,letterSpacing:"0.02em"}}>
              {ptSh==="add"?"🏭 Save Batch":"✓ Update Batch"}
            </Btn>
          </div>
          </>;
        })()}
      </Sheet>

      {/* QC Sheet */}
      <Sheet dm={dm} open={!!qcSh} onClose={()=>setQcSh(null)} title="Log QC Check">
        <Sel dm={dm} label="Product *" value={qcF.product} onChange={e=>setQcF({...qcF,product:e.target.value})}>
          <option value="">— Select product —</option>
          {products.map(p=><option key={p.id}>{p.name}</option>)}
          <option value="__custom__">Other / Custom</option>
        </Sel>
        {qcF.product==="__custom__"&&<Inp dm={dm} label="Custom Product" value={qcF.customProduct||""} onChange={e=>setQcF({...qcF,customProduct:e.target.value})} placeholder="e.g. Special Paratha"/>}
        <div className="crm-grid-2" style={{gap:3*4}}>
          <Sel dm={dm} label="Shift" value={qcF.shift} onChange={e=>setQcF({...qcF,shift:e.target.value})}>
            {(settings?.shifts||["Morning","Afternoon","Evening","Night"]).map(s=><option key={s}>{s}</option>)}
          </Sel>
          <Inp dm={dm} label="Date" type="date" value={qcF.date} onChange={e=>setQcF({...qcF,date:e.target.value})}/>
        </div>
        <div>
          <label style={{color:T(dm).sub}} className="block text-[11px] font-bold uppercase tracking-widest mb-2 ml-0.5">Quality Grade *</label>
          <div className="grid grid-cols-4 gap-2">
            {[{g:"A",color:"#10b981",label:"Pass",sub:"Grade A"},{g:"B",color:"#f59e0b",label:"Pass",sub:"Grade B"},{g:"C",color:"#f97316",label:"Marginal",sub:"Grade C"},{g:"F",color:"#ef4444",label:"Fail",sub:"Reject"}].map(({g,color,label,sub})=>(
              <button key={g} onClick={()=>setQcF({...qcF,grade:g})}
                style={{background:qcF.grade===g?color+"25":T(dm).inp,border:`2px solid ${qcF.grade===g?color:T(dm).inpB}`,borderRadius:14,padding:"12px 6px",textAlign:"center",transition:"all 0.15s"}}>
                <p style={{color,fontWeight:900,fontSize:22,lineHeight:1}}>{g}</p>
                <p style={{color:qcF.grade===g?color:T(dm).text,fontSize:11,fontWeight:700,marginTop:4}}>{label}</p>
                <p style={{color:T(dm).sub,fontSize:9,marginTop:1}}>{sub}</p>
              </button>
            ))}
          </div>
        </div>
        <Inp dm={dm} label="Checked By" value={qcF.checker} onChange={e=>setQcF({...qcF,checker:e.target.value})} placeholder="Inspector name"/>
        <Inp dm={dm} label="Notes / Observations" value={qcF.notes} onChange={e=>setQcF({...qcF,notes:e.target.value})} placeholder="e.g. Slightly overcooked edges, texture good…"/>
        <Btn dm={dm} onClick={saveQC} className="w-full">Save QC Record</Btn>
      </Sheet>

      <Confirm dm={dm} msg={conf?.msg} onYes={()=>{conf?.yes();setConf(null);}} onNo={()=>setConf(null)}/>
      {toast&&<Toast msg={toast} onDone={()=>setToast(null)}/>}

      {/* ═══════════════════════════════════════════════════════════════
          BULK ORDER ENTRY SHEET
      ═══════════════════════════════════════════════════════════════ */}
      {/* ══════════════════════════════════════════════════════════════
          PROFESSIONAL COLLECT PAYMENT SHEET
      ══════════════════════════════════════════════════════════════ */}
      <Sheet dm={dm} open={!!collectSh} onClose={()=>{setCollectSh(null);setCollectAmt("");setCollectNote("");}} title="💰 Record Collection">
        {collectSh&&(()=>{
          const d=collectSh;
          const orderTotal=lineTotal(d.orderLines||{});
          const replAmt=+(d.replacement?.amount)||0;
          const netAmt=orderTotal-replAmt;
          const suggestedAmt=netAmt>0?netAmt:orderTotal;
          return <>
            {/* Customer info strip */}
            <div style={{background:t.inp,borderRadius:14,padding:"12px 14px"}}>
              <p style={{color:t.text,fontWeight:800,fontSize:15,lineHeight:1.2}}>{d.customer}</p>
              {d.address&&<p style={{color:t.sub,fontSize:11,marginTop:3}}>📍 {d.address}</p>}
              <div className="flex gap-2 mt-2 flex-wrap">
                <span style={{background:"#f59e0b20",color:"#f59e0b",borderRadius:6,padding:"2px 9px",fontSize:10,fontWeight:700}}>📅 {d.date}</span>
                <span style={{background:d.status==="Delivered"?"#10b98120":d.status==="In Transit"?"#3b82f620":"#f59e0b20",color:d.status==="Delivered"?"#10b981":d.status==="In Transit"?"#3b82f6":"#f59e0b",borderRadius:6,padding:"2px 9px",fontSize:10,fontWeight:700}}>{d.status}</span>
              </div>
            </div>

            {/* Order breakdown */}
            {canSeePrices&&<div style={{background:t.inp,borderRadius:14,padding:"12px 14px"}}>
              <p style={{color:t.sub,fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Order Breakdown</p>
              {lineRows(d.orderLines||{},products).filter(r=>r.qty>0).map(r=>(
                <div key={r.id} className="flex justify-between text-xs py-1" style={{borderBottom:`1px solid ${t.border}`}}>
                  <span style={{color:t.sub,flex:1}}>{r.qty} × {r.name} @ {inr(r.priceAmount)}</span>
                  <span style={{color:t.text,fontWeight:700}}>{inr(r.qty*r.priceAmount)}</span>
                </div>
              ))}
              <div className="flex justify-between mt-2" style={{fontSize:13,fontWeight:700}}>
                <span style={{color:t.sub}}>Order Total</span>
                <span style={{color:"#f59e0b"}}>{inr(orderTotal)}</span>
              </div>
              {replAmt>0&&<>
                <div className="flex justify-between mt-1" style={{fontSize:12,color:"#f97316"}}>
                  <span>🔄 Replacement deduction ({d.replacement?.item||"—"})</span>
                  <span style={{fontWeight:700}}>−{inr(replAmt)}</span>
                </div>
                <div className="flex justify-between mt-1 pt-1" style={{borderTop:`2px solid ${t.border}`,fontSize:13,fontWeight:800}}>
                  <span style={{color:t.text}}>Net Payable</span>
                  <span style={{color:"#10b981"}}>{inr(netAmt)}</span>
                </div>
              </>}
            </div>}

            {/* Quick amount selector */}
            {canSeePrices&&<div>
              <p style={{color:t.sub,fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Quick Select</p>
              <div className="crm-btn-group">
                {[suggestedAmt,...[500,1000,2000].filter(v=>v!==suggestedAmt&&v>0)].filter((v,i,a)=>a.indexOf(v)===i&&v>0).slice(0,4).map(q=>(
                  <button key={q} onClick={()=>setCollectAmt(String(q))}
                    style={{background:collectAmt===String(q)?"#10b981":t.inp,color:collectAmt===String(q)?"#fff":t.text,border:`1.5px solid ${collectAmt===String(q)?"#10b981":t.border}`,borderRadius:10,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",transition:"all 0.15s",WebkitTapHighlightColor:"transparent"}}>
                    {inr(q)}{q===suggestedAmt?" (Full)":""}
                  </button>
                ))}
              </div>
            </div>}

            {/* Amount input */}
            <Inp dm={dm} label="Amount Collected (₹) *" type="number" value={collectAmt} onChange={e=>setCollectAmt(e.target.value)} placeholder="Enter exact amount received"/>

            {/* Live balance preview */}
            {canSeePrices&&collectAmt&&+collectAmt>0&&<div style={{background:+collectAmt>=(netAmt||orderTotal)?"#10b98115":"#f59e0b15",border:`1px solid ${+collectAmt>=(netAmt||orderTotal)?"#10b98140":"#f59e0b40"}`,borderRadius:12,padding:"10px 14px"}}>
              <div className="flex justify-between text-sm"><span style={{color:t.sub}}>Collecting now</span><span style={{color:"#10b981",fontWeight:700}}>{inr(+collectAmt)}</span></div>
              <div className="flex justify-between text-sm mt-1"><span style={{color:t.sub}}>Balance remaining</span><span style={{color:Math.max(0,(netAmt||orderTotal)-+collectAmt)>0?"#f59e0b":"#10b981",fontWeight:700}}>{inr(Math.max(0,(netAmt||orderTotal)-+collectAmt))}</span></div>
              {+collectAmt>=(netAmt||orderTotal)&&<p style={{color:"#10b981",fontSize:11,marginTop:4,fontWeight:600}}>✓ Full amount — account will be settled</p>}
            </div>}

            {/* Note field (shown always, required only if setting is on) */}
            <Inp dm={dm} label={`Collection Note${settings?.agentCollectRequireNote?" *":""}`} value={collectNote} onChange={e=>setCollectNote(e.target.value)} placeholder="e.g. Paid in cash at gate, UPI ref #12345…"/>

            <div className="flex gap-2">
              <Btn dm={dm} v="ghost" className="flex-1" onClick={()=>{setCollectSh(null);setCollectAmt("");setCollectNote("");}}>Cancel</Btn>
              <Btn dm={dm} v="success" className="flex-1" onClick={(()=>{
                // ── per-delivery collect guard — prevents double-tap recording payment twice ──
                let _collectBusy=false;
                return ()=>{
                  if(_collectBusy){notify("Recording…");return;}
                  _collectBusy=true;
                  setTimeout(()=>{_collectBusy=false;},3000);
                  const amt=+collectAmt;
                  if(!amt||amt<=0){notify("Enter a valid amount");_collectBusy=false;return;}
                  if(settings?.agentCollectRequireNote&&!collectNote.trim()){notify("Collection note is required");_collectBusy=false;return;}
                  const upd={...d,partialPayment:{enabled:true,amount:amt,note:collectNote,collectedBy:displayName,collectedAt:ts()}};
                  setDeliv(p=>safeArr(p).map(x=>x.id===d.id?upd:x));
                  // Only update c.paid — computedPendingMap will re-derive pending from the updated delivery
                  if(d.customerId){setCust(p=>safeArr(p).map(c=>c.id===d.customerId?{...c,paid:(c.paid||0)+amt}:c));}
                  addLog("Payment collected on delivery",`${d.customer} — ${inr(amt)}${collectNote?" · "+collectNote:""}`);
                  addNotif("Payment Collected",`${inr(amt)} collected from ${d.customer}`,"success","payment");
                  notify(`${inr(amt)} collected ✓`);
                  // Show inline receipt card on phone
                  setLastReceiptData({delivery:upd,amt,note:collectNote,customer:d.customer,ts:ts()});
                  // Auto-print receipt only if admin has it enabled
                  if(settings?.agentInvoiceEnabled!==false&&settings?.agentAutoReceipt!==false) exportDeliveryReceipt(upd,products,settings,getOrCreateInvNo(upd.id));
                  setCollectSh(null);setCollectAmt("");setCollectNote("");
                };
              })()}>Confirm Collection</Btn>
            </div>
          </>;
        })()}
      </Sheet>

      {/* ── INLINE RECEIPT CARD — tap 🧾 Receipt button OR shown after collection ── */}
      <Sheet dm={dm} open={!!lastReceiptData} onClose={()=>setLastReceiptData(null)} title={lastReceiptData?.viewOnly?"🧾 Delivery Receipt":"✅ Collection Confirmed"}>
        {lastReceiptData&&(()=>{
          const {delivery:rd,amt,note,customer,ts:rts,viewOnly}=lastReceiptData;
          const orderTotal=lineTotal(rd.orderLines);
          const replAmt=+(rd.replacement?.amount||0);
          const netAmt=Math.max(0,orderTotal-replAmt);
          const collected=viewOnly?(+(rd.partialPayment?.amount||0)):amt;
          const balanceDue=Math.max(0,netAmt-collected);
          const rows=lineRows(rd.orderLines,products).filter(r=>r.qty>0);
          const statusColor=rd.status==="Delivered"?"#10b981":rd.status==="In Transit"?"#3b82f6":rd.status==="Cancelled"?"#ef4444":"#f59e0b";
          const showReceiptPrices=settings?.agentInvoiceShowPrices!==false; // syncs with admin setting
          const rcptInvNo=(invRegistry.issued||{})[rd.id];
          const rcptNo=rcptInvNo?`RCP-${rcptInvNo.replace(/^[A-Z0-9]+-/,"")}`:`RCP-${(rd.id||"").slice(-8).toUpperCase()}`;
          return <>
            {/* Header banner */}
            {viewOnly
              ?<div style={{background:statusColor+"18",border:`1.5px solid ${statusColor}40`,borderRadius:16,padding:"12px 16px"}}>
                <div className="flex items-center justify-between">
                  <div>
                    <p style={{color:statusColor,fontWeight:900,fontSize:16}}>{rd.customer}</p>
                    <p style={{color:t.sub,fontSize:11,marginTop:3}}>📅 {rd.date}{rd.deliveryDate&&rd.deliveryDate!==rd.date?` · Deliver by: ${rd.deliveryDate}`:""}</p>
                    {rd.agent&&<p style={{color:t.sub,fontSize:11}}>👤 {rd.agent}</p>}
                    <p style={{color:t.sub,fontSize:10,marginTop:2,fontFamily:"monospace"}}>{rcptInvNo?`Invoice: ${rcptInvNo} · `:""}Receipt: {rcptNo}</p>
                  </div>
                  <span style={{background:statusColor+"22",color:statusColor,fontSize:11,fontWeight:700,padding:"4px 12px",borderRadius:99}}>{rd.status}</span>
                </div>
              </div>
              :<div style={{background:"#10b98120",border:"1.5px solid #10b98140",borderRadius:16,padding:"14px 16px",textAlign:"center"}}>
                <p style={{fontSize:32,lineHeight:1,marginBottom:6}}>✅</p>
                <p style={{color:"#10b981",fontWeight:900,fontSize:18}}>{inr(collected)} Collected</p>
                <p style={{color:t.sub,fontSize:12,marginTop:4}}>{customer} · {rts}</p>
              </div>
            }

            {/* Items */}
            {rows.length>0&&<div style={{background:t.inp,borderRadius:14,padding:"12px 14px"}}>
              <p style={{color:t.sub,fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Items Ordered</p>
              {rows.map(r=>(
                <div key={r.id} className="flex justify-between text-sm py-1" style={{borderBottom:`1px solid ${t.border}`}}>
                  <span style={{color:t.sub}}>{r.qty} × {r.name}</span>
                  {showReceiptPrices&&<span style={{color:t.text,fontWeight:600}}>{inr(r.qty*r.priceAmount)}</span>}
                </div>
              ))}
              {showReceiptPrices&&orderTotal>0&&<div className="flex justify-between text-sm mt-2 font-bold">
                <span style={{color:t.sub}}>Order Total</span>
                <span style={{color:t.text}}>{inr(orderTotal)}</span>
              </div>}
            </div>}

            {/* Replacement */}
            {rd.replacement?.done&&<div style={{background:"#f9731615",border:"1px solid #f9731630",borderRadius:12,padding:"10px 12px"}}>
              <p style={{color:"#f97316",fontWeight:700,fontSize:12}}>🔄 Replacement: {rd.replacement.item||"—"}{rd.replacement.qty?` (${rd.replacement.qty})`:""}</p>
              {rd.replacement.reason&&<p style={{color:t.sub,fontSize:11,marginTop:2}}>{rd.replacement.reason}</p>}
              {showReceiptPrices&&replAmt>0&&<p style={{color:"#f97316",fontWeight:700,fontSize:12,marginTop:4}}>Deducted: −{inr(replAmt)}</p>}
            </div>}

            {/* Payment summary */}
            {showReceiptPrices&&<div style={{background:t.inp,borderRadius:14,padding:"12px 14px"}}>
              <p style={{color:t.sub,fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Payment Summary</p>
              {orderTotal>0&&<div className="flex justify-between text-sm py-1"><span style={{color:t.sub}}>Order Total</span><span style={{color:t.text,fontWeight:600}}>{inr(orderTotal)}</span></div>}
              {replAmt>0&&<div className="flex justify-between text-sm py-1"><span style={{color:"#f97316"}}>🔄 Replacement</span><span style={{color:"#f97316",fontWeight:700}}>−{inr(replAmt)}</span></div>}
              {replAmt>0&&<div className="flex justify-between text-sm py-1"><span style={{color:t.sub}}>Net Payable</span><span style={{color:t.text,fontWeight:700}}>{inr(netAmt)}</span></div>}
              {collected>0&&<div className="flex justify-between text-sm py-1"><span style={{color:"#10b981"}}>✓ {viewOnly?"Collected":"Collected now"}</span><span style={{color:"#10b981",fontWeight:700}}>{inr(collected)}</span></div>}
              <div className="flex justify-between text-sm pt-2 font-bold" style={{borderTop:`2px solid ${t.border}`}}>
                <span style={{color:balanceDue===0?"#10b981":"#f59e0b"}}>{balanceDue===0?"✓ Fully Settled":"Balance Due"}</span>
                <span style={{color:balanceDue===0?"#10b981":"#f59e0b"}}>{inr(balanceDue)}</span>
              </div>
            </div>}

            {(note||(viewOnly&&rd.partialPayment?.note))&&<p style={{color:t.sub,fontSize:12,fontStyle:"italic",textAlign:"center"}}>📝 "{note||(rd.partialPayment?.note)}"</p>}

            <div className="crm-btn-group">
              <Btn dm={dm} v="ghost" className="flex-1" onClick={()=>setLastReceiptData(null)}>Close</Btn>
              {(isAdmin||(settings?.receiptPrintAllowed||["admin","agent"]).includes(sess?.role))&&<Btn dm={dm} v="sky" className="flex-1" onClick={()=>exportDeliveryReceipt(rd,products,settings,getOrCreateInvNo(rd.id))}>🧾 Receipt</Btn>}
              {isAdmin&&<Btn dm={dm} v="purple" className="flex-1" onClick={()=>exportDeliveryInvoice(rd,products,settings,getOrCreateInvNo(rd.id))}>📄 Invoice</Btn>}
            </div>
          </>;
        })()}
      </Sheet>

      <Sheet dm={dm} open={bulkOrderSh} onClose={()=>setBulkOrderSh(false)} title="📋 Bulk Order Entry">
        <p style={{color:t.sub}} className="text-xs">Create delivery orders for multiple customers at once. Toggle on the customers you want, optionally adjust quantities, then save all at once.</p>
        <div className="crm-grid-2" style={{gap:3*4}}>
          <Inp dm={dm} label="Order Date *" type="date" value={bulkOrderDate} onChange={e=>setBulkOrderDate(e.target.value)}/>
          <Sel dm={dm} label="Status" value={bulkOrderStatus} onChange={e=>setBulkOrderStatus(e.target.value)}>
            {(settings?.deliveryStatuses||["Pending","In Transit","Delivered","Cancelled"]).map(s=><option key={s}>{s}</option>)}
          </Sel>
        </div>
        <div className="flex items-center justify-between">
          <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider">{bulkOrderRows.filter(r=>r.include).length} of {bulkOrderRows.length} selected</p>
          <div className="flex gap-2">
            <button onClick={()=>setBulkOrderRows(r=>r.map(x=>({...x,include:true})))} style={{color:"#f59e0b"}} className="text-xs font-semibold">All</button>
            <button onClick={()=>setBulkOrderRows(r=>r.map(x=>({...x,include:false})))} style={{color:t.sub}} className="text-xs font-semibold">None</button>
          </div>
        </div>
        <Hr dm={dm}/>
        <div className="flex flex-col gap-2" style={{maxHeight:360,overflowY:"auto"}}>
          {bulkOrderRows.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-4">No active customers found.</p>}
          {bulkOrderRows.map((row,ri)=>{
            const tot=lineTotal(row.orderLines);
            return <div key={row.customerId} style={{background:row.include?(dm?"rgba(245,158,11,0.08)":"rgba(245,158,11,0.04)"):t.inp,border:`1.5px solid ${row.include?"#f59e0b40":t.border}`,borderRadius:14,padding:"10px 12px",transition:"all 0.15s"}}>
              <div className="flex items-center justify-between mb-1 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Toggle checkbox */}
                  <button onClick={()=>setBulkOrderRows(rows=>rows.map((x,i)=>i===ri?{...x,include:!x.include}:x))}
                    style={{width:20,height:20,borderRadius:6,border:`2px solid ${row.include?"#f59e0b":t.inpB}`,background:row.include?"#f59e0b":t.card,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",transition:"all 0.15s"}}>
                    {row.include&&<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </button>
                  <div className="min-w-0">
                    <p style={{color:t.text,fontWeight:700,fontSize:13}} className="truncate">{row.customer}</p>
                    {row.address&&<p style={{color:t.sub,fontSize:10}} className="truncate">📍 {row.address}</p>}
                  </div>
                </div>
                {canSeePrices&&tot>0&&<span style={{color:"#f59e0b",fontWeight:800,fontSize:12}} className="shrink-0">{inr(tot)}</span>}
              </div>
              {/* Item qty inline editing */}
              {row.include&&<div className="flex flex-col gap-1 mt-2 pt-2" style={{borderTop:`1px solid ${t.border}`}}>
                {products.map(p=>{
                  const ol=safeO(row.orderLines);
                  const qty=(ol[p.id]?.qty)||0;
                  return <div key={p.id} className="flex items-center justify-between gap-2">
                    <span style={{color:t.sub,fontSize:12,flex:1}} className="truncate">{p.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={()=>setBulkOrderRows(rows=>rows.map((x,i)=>i===ri?{...x,orderLines:{...safeO(x.orderLines),[p.id]:{...(safeO(x.orderLines)[p.id]||{}),qty:Math.max(0,(safeO(x.orderLines)[p.id]?.qty||0)-1),priceAmount:safeO(x.orderLines)[p.id]?.priceAmount||(p.prices?.[0]||0)}}}:x))}
                        style={{width:24,height:24,borderRadius:6,background:t.card,border:`1px solid ${t.border}`,color:t.text,fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                      <span style={{color:t.text,fontWeight:700,fontSize:13,minWidth:20,textAlign:"center"}}>{qty}</span>
                      <button onClick={()=>setBulkOrderRows(rows=>rows.map((x,i)=>i===ri?{...x,orderLines:{...safeO(x.orderLines),[p.id]:{...(safeO(x.orderLines)[p.id]||{}),qty:(safeO(x.orderLines)[p.id]?.qty||0)+1,priceAmount:safeO(x.orderLines)[p.id]?.priceAmount||(p.prices?.[0]||0)}}}:x))}
                        style={{width:24,height:24,borderRadius:6,background:t.card,border:`1px solid ${t.border}`,color:t.text,fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                    </div>
                  </div>;
                })}
              </div>}
            </div>;
          })}
        </div>
        <Hr dm={dm}/>
        <div className="flex gap-2">
          <Btn dm={dm} v="ghost" className="flex-1" onClick={()=>setBulkOrderSh(false)}>Cancel</Btn>
          <Btn dm={dm} v="success" className="flex-1" onClick={saveBulkOrders}>
            ✓ Create {bulkOrderRows.filter(r=>r.include).length} Orders
          </Btn>
        </div>
