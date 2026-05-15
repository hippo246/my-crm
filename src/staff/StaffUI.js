/* eslint-disable no-unused-vars */
// ============================================================
// staff/StaffUI.js — REVAMPED v3 · Premium factory worker portal shell
// Full sidebar · live header · right context panel · mobile bottom nav
// PATCH: ProductionStart tab wired in
// ============================================================

import React, { useState, useEffect, useCallback } from "react";
import { ST, TAB_ACCENT } from "./theme.js";
import { SToast, SLiveBadge, TR } from "./components/ui.js";
import { HomeTab }             from "./tabs/Home.js";
import { ProductionStartTab }  from "./tabs/ProductionStart.js";   // ← NEW
import { PackingTab }          from "./tabs/Packing.js";
import { InventoryTab }        from "./tabs/Inventory.js";
import { DeliveryTab }         from "./tabs/Delivery.js";
import { QCTab }               from "./tabs/QC.js";
import { StaffTab }            from "./tabs/StaffTab.js";
import { StaffManagementTab }  from "./tabs/StaffManagement.js";
import { ReportsTab }          from "./tabs/Reports.js";
import { SettingsTab }         from "./tabs/Settings.js";
import { useStore }            from "../lib/store";
import { D_SETTINGS }         from "../lib/constants";

const TABS = [
  { id:"home",       label:"Dashboard",   emoji:"🏠", accent:TAB_ACCENT.home       },
  { id:"production", label:"Production",  emoji:"🏭", accent:TAB_ACCENT.production },
  { id:"packing",    label:"Packing",     emoji:"📦", accent:TAB_ACCENT.packing    },
  { id:"inventory",  label:"Inventory",   emoji:"🗄️",  accent:TAB_ACCENT.inventory  },
  { id:"delivery",   label:"Delivery",    emoji:"🚚", accent:TAB_ACCENT.delivery   },
  { id:"qc",         label:"Quality",     emoji:"✅", accent:TAB_ACCENT.qc         },
  { id:"staff",      label:"Staff",       emoji:"👥", accent:TAB_ACCENT.staff      },
  { id:"management", label:"Management",  emoji:"🧑‍💼", accent:TAB_ACCENT.management },
  { id:"reports",    label:"Reports",     emoji:"📊", accent:TAB_ACCENT.reports    },
  { id:"settings",   label:"Settings",    emoji:"⚙️", accent:TAB_ACCENT.settings   },
];

const AVATAR_COLORS = ["#2563EB","#10B981","#8B5CF6","#F59E0B","#06b6d4","#EF4444","#14B8A6","#EC4899"];

function useClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

export function StaffUI({ sess, onLogout }) {
  const t = ST();
  const time = useClock();
  const isMobile = useIsMobile();

  const [activeTab, setActiveTab]     = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toast, setToast]             = useState({ msg:"", type:"success", visible:false });

  const [batches,    setBatches]    = useStore("tas9_batches",    []);
  const [inventory,  setInventory]  = useStore("tas9_ing_items",  []);
  const [deliveries, setDeliveries] = useStore("tas9_deliv",      []);
  const [staffList,  setStaffList]  = useStore("tas9_staff_list", []);
  const [qcLogs,     setQcLogs]     = useStore("tas9_qclogs",     []);
  const [settings]                  = useStore("tas10_settings",  D_SETTINGS);

  const notify = useCallback((msg, type = "success") => {
    setToast({ msg, type, visible:true });
    setTimeout(() => setToast(s => ({ ...s, visible:false })), 2800);
  }, []);

  const activeTabObj = TABS.find(tab => tab.id === activeTab) || TABS[0];
  const formatTime = d => d.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" });
  const formatDate = d => d.toLocaleDateString("en-IN", { weekday:"short", day:"numeric", month:"short" });

  const safeBatches    = Array.isArray(batches)    ? batches    : [];
  const safeInventory  = Array.isArray(inventory)  ? inventory  : [];
  const safeStaff      = Array.isArray(staffList)  ? staffList  : [];
  const safeDeliveries = Array.isArray(deliveries) ? deliveries : [];

  const badgeCounts = {
    packing:   safeBatches.filter(b => (b.actual ?? 0) < (b.target ?? 0) && !b.onHold).length || null,
    qc:        safeBatches.filter(b => !b.qcGrade && (b.actual ?? 0) > 0).length || null,
    inventory: safeInventory.filter(i => typeof i.stock === "number" && typeof i.minStock === "number" && i.stock <= i.minStock).length || null,
    delivery:  safeDeliveries.filter(d => d.status === "Pending").length || null,
  };

  const onShift    = safeStaff.filter(s => s.present);
  const lowStock   = safeInventory.filter(i => typeof i.stock === "number" && typeof i.minStock === "number" && i.stock <= i.minStock);
  const activeBatch = safeBatches.find(b => (b.actual ?? 0) > 0 && (b.actual ?? 0) < (b.target ?? 0));

  // ── SIDEBAR ─────────────────────────────────────────────────
  function Sidebar() {
    return (
      <div style={{
        width: sidebarOpen ? 224 : 68,
        background: t.sidebar,
        borderRight:`1px solid ${t.border}`,
        display:"flex", flexDirection:"column",
        transition:"width 0.3s cubic-bezier(0.4,0,0.2,1)",
        overflow:"hidden", flexShrink:0,
        height:"100vh", position:"sticky", top:0, zIndex:200,
      }}>
        {/* Brand */}
        <div style={{
          padding: sidebarOpen ? "18px 16px 16px" : "18px 0 16px",
          display:"flex", alignItems:"center", gap:10,
          justifyContent: sidebarOpen ? "flex-start" : "center",
          borderBottom:`1px solid ${t.border}`,
          minHeight:70, flexShrink:0,
        }}>
          <div style={{
            width:36, height:36, borderRadius:11, flexShrink:0,
            background:"linear-gradient(135deg,#1d4ed8,#7c3aed)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:18,
            boxShadow:"0 0 24px rgba(37,99,235,0.5), 0 0 50px rgba(124,58,237,0.2)",
          }}>🫓</div>
          {sidebarOpen && (
            <div>
              <div style={{ color:t.text, fontWeight:900, fontSize:12, lineHeight:1, letterSpacing:"0.08em" }}>PARATHA</div>
              <div style={{ color:t.sub, fontSize:8, fontWeight:700, letterSpacing:"0.14em", marginTop:2 }}>STAFF PORTAL</div>
            </div>
          )}
        </div>

        {/* Shift badge */}
        {sidebarOpen && sess?.shift && (
          <div style={{
            margin:"10px 10px 0", padding:"8px 12px",
            background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.18)",
            borderRadius:10, flexShrink:0,
          }}>
            <div style={{ color:"#10B981", fontSize:9, fontWeight:800, letterSpacing:"0.08em" }}>● ACTIVE SHIFT</div>
            <div style={{ color:t.text, fontWeight:700, fontSize:12, marginTop:2 }}>{sess.shift}</div>
          </div>
        )}

        {/* Nav items */}
        <div style={{ flex:1, padding:"12px 7px", display:"flex", flexDirection:"column", gap:2, overflowY:"auto" }}>
          {sidebarOpen && (
            <div style={{ color:t.muted, fontSize:8, fontWeight:800, letterSpacing:"0.15em", textTransform:"uppercase", padding:"5px 8px 5px", marginBottom:2 }}>
              NAVIGATION
            </div>
          )}
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const badge = badgeCounts[tab.id];
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                display:"flex", alignItems:"center",
                gap: sidebarOpen ? 10 : 0,
                justifyContent: sidebarOpen ? "flex-start" : "center",
                padding: sidebarOpen ? "10px 12px" : "11px 0",
                borderRadius:11, border:"none", cursor:"pointer",
                background: isActive
                  ? `linear-gradient(135deg, ${tab.accent.solid}20, ${tab.accent.solid}0d)`
                  : "transparent",
                color: isActive ? tab.accent.solid : t.sub,
                fontWeight: isActive ? 700 : 500,
                fontSize:12, width:"100%",
                transition:"all 0.15s",
                boxShadow: isActive ? `inset 0 0 0 1px ${tab.accent.solid}25` : "none",
                position:"relative",
              }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = t.cardHov; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                {/* Active indicator */}
                {isActive && sidebarOpen && (
                  <div style={{
                    position:"absolute", left:0, top:"50%", transform:"translateY(-50%)",
                    width:3, height:20, background:tab.accent.solid,
                    borderRadius:"0 4px 4px 0",
                    boxShadow:`0 0 12px ${tab.accent.solid}`,
                  }} />
                )}
                <span style={{ fontSize:16, flexShrink:0 }}>{tab.emoji}</span>
                {sidebarOpen && <span style={{ flex:1, textAlign:"left", letterSpacing:"0.01em" }}>{tab.label}</span>}
                {badge && sidebarOpen && (
                  <div style={{
                    background:tab.accent.solid, color:"#fff",
                    borderRadius:"999px", fontSize:9, fontWeight:800,
                    padding:"2px 6px", minWidth:16, textAlign:"center",
                  }}>{badge}</div>
                )}
                {badge && !sidebarOpen && (
                  <div style={{
                    position:"absolute", top:4, right:4,
                    width:8, height:8, borderRadius:"50%",
                    background:tab.accent.solid,
                    boxShadow:`0 0 8px ${tab.accent.solid}`,
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom: user + logout */}
        <div style={{ borderTop:`1px solid ${t.border}`, padding: sidebarOpen ? "14px 12px" : "14px 7px", flexShrink:0 }}>
          {sidebarOpen ? (
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
              <div style={{
                width:34, height:34, borderRadius:"50%", flexShrink:0,
                background:`${t.blue}18`, border:`1.5px solid ${t.blue}28`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:13, fontWeight:800, color:t.blue,
              }}>
                {(sess?.name || "?").split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:t.text, fontWeight:700, fontSize:11, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{sess?.name || "Staff"}</div>
                <div style={{ color:t.sub, fontSize:9 }}>{sess?.role || "Worker"}</div>
              </div>
            </div>
          ) : null}
          <button onClick={onLogout} style={{
            width:"100%", padding:"8px 0", borderRadius:9, border:"none",
            background:`${t.red}10`, color:t.red,
            cursor:"pointer", fontWeight:700, fontSize:sidebarOpen ? 12 : 16,
            transition:"all 0.15s",
            fontFamily:"inherit",
          }}
            onMouseEnter={e => e.currentTarget.style.background = `${t.red}20`}
            onMouseLeave={e => e.currentTarget.style.background = `${t.red}10`}
          >{sidebarOpen ? "← Log Out" : "→"}</button>
        </div>
      </div>
    );
  }

  // ── HEADER ──────────────────────────────────────────────────
  function Header() {
    return (
      <div style={{
        background:t.header, borderBottom:`1px solid ${t.border}`,
        padding:"0 20px", height:58, display:"flex", alignItems:"center",
        gap:14, flexShrink:0, position:"sticky", top:0, zIndex:150,
      }}>
        {/* Sidebar toggle */}
        {!isMobile && (
          <button onClick={() => setSidebarOpen(o => !o)} style={{
            background:"none", border:"none", cursor:"pointer", color:t.sub,
            fontSize:18, padding:"6px", borderRadius:8, transition:"all 0.15s", lineHeight:1,
          }}
            onMouseEnter={e => e.currentTarget.style.color = t.text}
            onMouseLeave={e => e.currentTarget.style.color = t.sub}
          >☰</button>
        )}

        {/* Tab breadcrumb */}
        <div style={{ flex:1, display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:18 }}>{activeTabObj.emoji}</span>
          <div>
            <div style={{ color:t.text, fontWeight:800, fontSize:14, lineHeight:1 }}>{activeTabObj.label}</div>
            <div style={{ color:t.muted, fontSize:9, marginTop:2 }}>
              {formatDate(time)} · {formatTime(time)}
            </div>
          </div>
        </div>

        {/* Active batch pill */}
        {activeBatch && (
          <div style={{
            background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.2)",
            borderRadius:"999px", padding:"5px 12px",
            display:"flex", alignItems:"center", gap:6,
          }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:"#10B981", boxShadow:"0 0 8px #10B981", animation:"pulse 2s infinite" }} />
            <span style={{ color:"#10B981", fontSize:10, fontWeight:700 }}>
              {activeBatch.product} · {activeBatch.actual ?? 0}/{activeBatch.target ?? 0}
            </span>
          </div>
        )}

        {/* Session info */}
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {sess?.shift && (
            <div style={{
              background:"rgba(37,99,235,0.08)", border:"1px solid rgba(37,99,235,0.18)",
              borderRadius:"999px", padding:"4px 10px",
              color:t.blue, fontSize:10, fontWeight:600,
            }}>⏰ {sess.shift}</div>
          )}
        </div>
      </div>
    );
  }

  // ── RIGHT CONTEXT PANEL ─────────────────────────────────────
  function RightPanel() {
    return (
      <div style={{
        width:220, background:t.sidebar, borderLeft:`1px solid ${t.border}`,
        display:"flex", flexDirection:"column", gap:0,
        overflowY:"auto", padding:"16px 12px", flexShrink:0,
      }}>
        {/* Active batch */}
        {activeBatch && (
          <div style={{ marginBottom:18 }}>
            <div style={{ color:t.muted, fontSize:8, fontWeight:800, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:10 }}>⚡ ACTIVE BATCH</div>
            <div style={{
              background:"rgba(16,185,129,0.06)", border:"1px solid rgba(16,185,129,0.16)",
              borderRadius:12, padding:"12px",
            }}>
              <div style={{ color:t.text, fontWeight:700, fontSize:12, marginBottom:4 }}>{activeBatch.product}</div>
              <div style={{ color:t.sub, fontSize:10, marginBottom:8 }}>{activeBatch.batchLabel || activeBatch.id}</div>
              <div style={{ height:4, background:"rgba(255,255,255,0.07)", borderRadius:"999px", overflow:"hidden", marginBottom:5 }}>
                <div style={{
                  height:"100%",
                  width:`${(activeBatch.target ?? 0) > 0 ? Math.min(100, Math.round(((activeBatch.actual ?? 0)/activeBatch.target)*100)) : 0}%`,
                  background:"#10B981", borderRadius:"999px",
                  boxShadow:"0 0 10px rgba(16,185,129,0.5)",
                  transition:"width 0.4s ease",
                }} />
              </div>
              <div style={{ color:"#10B981", fontSize:10, fontWeight:700 }}>
                {activeBatch.actual ?? 0} / {activeBatch.target ?? 0} pcs
              </div>
            </div>
          </div>
        )}

        {/* Low stock alerts */}
        {lowStock.length > 0 && (
          <div style={{ marginBottom:18 }}>
            <div style={{ color:t.muted, fontSize:8, fontWeight:800, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:10 }}>⚠ LOW STOCK</div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {lowStock.slice(0,4).map(i => (
                <div key={i.id} style={{
                  background:t.card, border:"1px solid rgba(239,68,68,0.18)",
                  borderRadius:9, padding:"7px 10px",
                  display:"flex", justifyContent:"space-between", alignItems:"center",
                }}>
                  <span style={{ color:t.text, fontSize:10, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:100 }}>{i.name}</span>
                  <span style={{ color:t.red, fontSize:10, fontWeight:800, flexShrink:0 }}>{i.stock} {i.unit}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Staff on shift */}
        <div>
          <div style={{ color:t.muted, fontSize:8, fontWeight:800, letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:10 }}>
            ON SHIFT {onShift.length > 0 ? `· ${onShift.length}` : ""}
          </div>
          {onShift.length === 0 ? (
            <div style={{ color:t.muted, fontSize:11 }}>No one clocked in</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {onShift.slice(0,5).map((s, i) => {
                const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                return (
                  <div key={s.id} style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{
                      width:26, height:26, borderRadius:"50%",
                      background:`${color}16`, border:`1px solid ${color}25`,
                      color, display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:9, fontWeight:800, flexShrink:0,
                    }}>
                      {(s.name || "?").split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:t.text, fontSize:10, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.name}</div>
                      <div style={{ color:t.sub, fontSize:9 }}>{s.role || ""}</div>
                    </div>
                    <div style={{ width:5, height:5, borderRadius:"50%", background:"#10B981", boxShadow:"0 0 6px #10B981", flexShrink:0 }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── BOTTOM NAV ──────────────────────────────────────────────
  function BottomNav() {
    return (
      <div style={{
        position:"fixed", bottom:0, left:0, right:0,
        background:"rgba(8,12,21,0.97)",
        borderTop:`1px solid ${t.border}`,
        backdropFilter:"blur(32px)",
        display:"flex", zIndex:200, height:64,
        paddingBottom:"env(safe-area-inset-bottom)",
      }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const badge = badgeCounts[tab.id];
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              flex:1, display:"flex", flexDirection:"column", alignItems:"center",
              justifyContent:"center", gap:3, border:"none", cursor:"pointer",
              background:"none", padding:"8px 0",
              borderTop: isActive ? `2px solid ${tab.accent.solid}` : "2px solid transparent",
              transition:"all 0.15s", position:"relative",
            }}>
              <span style={{ fontSize:18 }}>{tab.emoji}</span>
              <span style={{ fontSize:8, fontWeight: isActive ? 800 : 500, color: isActive ? tab.accent.solid : t.sub, letterSpacing:"0.05em" }}>
                {tab.label.toUpperCase()}
              </span>
              {badge && (
                <div style={{
                  position:"absolute", top:5, right:"calc(50% - 18px)",
                  background:tab.accent.solid, color:"#fff",
                  borderRadius:"999px", fontSize:8, fontWeight:800,
                  padding:"1px 4px", minWidth:14, textAlign:"center",
                }}>{badge}</div>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // ── TAB CONTENT ─────────────────────────────────────────────
  const renderTab = () => {
    const shared = { t, sess, notify, settings };
    switch (activeTab) {
      case "home":       return <HomeTab            {...shared} batches={batches} inventory={inventory} deliveries={deliveries} staffList={staffList} qcLogs={qcLogs} setActiveTab={setActiveTab} />;
      case "production": return <ProductionStartTab {...shared} batches={batches} setBatches={setBatches} />;   // ← NEW
      case "packing":    return <PackingTab         {...shared} batches={batches} setBatches={setBatches} />;
      case "inventory":  return <InventoryTab       {...shared} inventory={inventory} setInventory={setInventory} />;
      case "delivery":   return <DeliveryTab        {...shared} deliveries={deliveries} setDeliveries={setDeliveries} />;
      case "qc":         return <QCTab             {...shared} batches={batches} setBatches={setBatches} qcLogs={qcLogs} setQcLogs={setQcLogs} />;
      case "staff":      return <StaffTab           {...shared} staffList={staffList} setStaffList={setStaffList} />;
      case "management": return <StaffManagementTab {...shared} staffList={staffList} setStaffList={setStaffList} />;
      case "reports":    return <ReportsTab         {...shared} batches={batches} inventory={inventory} deliveries={deliveries} staffList={staffList} qcLogs={qcLogs} />;
      case "settings":   return <SettingsTab        {...shared} />;
      default:           return null;
    }
  };

  return (
    <div style={{
      display:"flex", height:"100vh",
      background:t.bg,
      backgroundImage:[
        "radial-gradient(ellipse 80% 50% at 12% -8%, rgba(29,78,216,0.07) 0%, transparent 55%)",
        "radial-gradient(ellipse 60% 40% at 88% 108%, rgba(109,40,217,0.06) 0%, transparent 55%)",
        "radial-gradient(ellipse 40% 30% at 55% 50%, rgba(16,185,129,0.02) 0%, transparent 60%)",
      ].join(", "),
      overflow:"hidden",
      fontFamily:"'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.9)} }
        @keyframes slideUp { from{transform:translateX(-50%) translateY(16px);opacity:0} to{transform:translateX(-50%) translateY(0);opacity:1} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:3px; height:3px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#1e2840; border-radius:3px; }
        ::-webkit-scrollbar-thumb:hover { background:#273350; }
        button { font-family: inherit; }
        input, textarea, select { font-family: inherit; }
      `}</style>

      {!isMobile && <Sidebar />}

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>
        <Header />
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
          <div style={{ flex:1, overflowY:"auto", paddingBottom: isMobile ? 80 : 0 }}>
            {renderTab()}
          </div>
          {!isMobile && sidebarOpen && <RightPanel />}
        </div>
      </div>

      {isMobile && <BottomNav />}
      <SToast msg={toast.msg} type={toast.type} visible={toast.visible} />
    </div>
  );
}
