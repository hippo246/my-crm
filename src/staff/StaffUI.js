/* eslint-disable no-unused-vars */
// ============================================================
// staff/StaffUI.js — REVAMPED v3 · Premium factory worker portal shell
// Full sidebar · live header · right context panel · mobile bottom nav
// PATCH: ProductionStart tab wired in
// MOBILE PATCH: Responsive nav — bottom nav drawer, tablet icon sidebar
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from "react";
import { ST, TAB_ACCENT } from "./theme.js";
import { SToast, SLiveBadge, TR } from "./components/ui.js";
import { HomeTab }             from "./tabs/Home.js";
import { ProductionStartTab }  from "./tabs/ProductionStart.js";
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
import { usePresence }        from "../components/CollaborationPresence";

const TABS = [
  { id:"home",       label:"Dashboard",   emoji:"🏠", accent:TAB_ACCENT.home       },
  { id:"production", label:"Production",  emoji:"🏭", accent:TAB_ACCENT.production },
  { id:"packing",    label:"Packing",     emoji:"📦", accent:TAB_ACCENT.packing    },
  { id:"inventory",  label:"Inventory",   emoji:"🗄️",  accent:TAB_ACCENT.inventory  },
  { id:"delivery",   label:"Delivery",    emoji:"🚚", accent:TAB_ACCENT.delivery   },
  { id:"qc",         label:"Quality",     emoji:"✅", accent:TAB_ACCENT.qc         },
  { id:"staff",      label:"Staff",       emoji:"👥", accent:TAB_ACCENT.staff      },
  { id:"management", label:"Manage",      emoji:"🧑‍💼", accent:TAB_ACCENT.management },
  { id:"reports",    label:"Reports",     emoji:"📊", accent:TAB_ACCENT.reports    },
  { id:"settings",   label:"Settings",    emoji:"⚙️", accent:TAB_ACCENT.settings   },
];

// Primary tabs always shown in bottom bar (max 4 + "More" = 5 slots)
const PRIMARY_TAB_IDS = ["home", "production", "packing", "delivery", "qc"];

const AVATAR_COLORS = ["#2563EB","#10B981","#8B5CF6","#F59E0B","#06b6d4","#EF4444","#14B8A6","#EC4899"];

function useClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

// Breakpoints: mobile < 768, tablet 768–1024, desktop > 1024
function useBreakpoint() {
  const getBreakpoint = () => {
    if (typeof window === "undefined") return "desktop";
    const w = window.innerWidth;
    if (w < 768) return "mobile";
    if (w < 1024) return "tablet";
    return "desktop";
  };
  const [bp, setBp] = useState(getBreakpoint);
  useEffect(() => {
    const handler = () => setBp(getBreakpoint());
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return bp;
}

export function StaffUI({ sess, onLogout }) {
  const time = useClock();
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";
  const isTablet = bp === "tablet";

  const [activeTab, setActiveTab]       = useState("home");
  const [sidebarOpen, setSidebarOpen]   = useState(true);
  // Mobile: show the "More" drawer for secondary tabs
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);
  const [toast, setToast]               = useState({ msg:"", type:"success", visible:false });

  const [batches,    setBatches]    = useStore("tas9_batches",    []);
  const [inventory,  setInventory]  = useStore("tas9_ing_items",  []);
  const [deliveries, setDeliveries] = useStore("tas9_deliv",      []);
  const [staffList,  setStaffList]  = useStore("tas9_staff_list", []);
  const [qcLogs,     setQcLogs]     = useStore("tas9_qclogs",     []);
  const [settings]                  = useStore("tas10_settings",  D_SETTINGS);
  const [activityLog, setActivityLog] = useStore("tas9_act", []); // unified with admin activity log

  // ── PRESENCE (staff → admin oversight) ──────────────────────
  // Heartbeat into tas9_presence so admin PresencePanel sees all staff
  usePresence({
    userId:     sess?.id   || sess?.staffId || "unknown",
    userName:   sess?.name || "Staff",
    userRole:   sess?.role || "worker",
    tab:        activeTab,       // updates live on every tab switch
    appContext: "staff",         // lets admin distinguish staff vs admin users
  });

  // ── THEME ────────────────────────────────────────────────────
  const lightMode = !!(settings?.staffPortal?.staffLightMode);
  const t = ST(lightMode);

  const notify = useCallback((msg, type = "success") => {
    setToast({ msg, type, visible:true });
    setTimeout(() => setToast(s => ({ ...s, visible:false })), 2800);
  }, []);

  // ── ACTIVITY BROADCAST ───────────────────────────────────────
  const logActivity = useCallback((action, detail = {}) => {
    const entry = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      ts: new Date().toISOString(),
      staffId:   sess?.id   || "unknown",
      staffName: sess?.name || "Staff",
      staffRole: sess?.role || "",
      shift:     sess?.shift || "",
      action,
      ...detail,
    };
    setActivityLog(prev => {
      const arr = Array.isArray(prev) ? prev : [];
      return [entry, ...arr].slice(0, 200);
    });
  }, [sess, setActivityLog]);

  // ── TAB VISIBILITY ───────────────────────────────────────────
  const sp = settings?.staffPortal || {};
  const spOn = (key, def) => sp[key] !== undefined ? sp[key] : def;
  const visibleTabs = TABS.filter(tab => {
    switch (tab.id) {
      case "delivery":   return spOn("showDeliveryTab",   true);
      case "qc":         return spOn("showQCTab",         true);
      case "inventory":  return spOn("showInventoryTab",  true);
      case "packing":    return spOn("showPackingTab",    true);
      case "production": return spOn("showProductionTab", true);
      case "reports":    return spOn("showReportsTab",    true);
      default:           return true;
    }
  });

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

  const onShift     = safeStaff.filter(s => s.present);
  const lowStock    = safeInventory.filter(i => typeof i.stock === "number" && typeof i.minStock === "number" && i.stock <= i.minStock);
  const activeBatch = safeBatches.find(b => (b.actual ?? 0) > 0 && (b.actual ?? 0) < (b.target ?? 0));

  // Close more drawer when switching tabs
  const handleTabSwitch = useCallback((id) => {
    setActiveTab(id);
    setMoreDrawerOpen(false);
  }, []);

  // ── DESKTOP SIDEBAR ──────────────────────────────────────────
  const sidebar = (
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
        {visibleTabs.map(tab => {
          const isActive = activeTab === tab.id;
          const badge = badgeCounts[tab.id];
          return (
            <button key={tab.id} onClick={() => handleTabSwitch(tab.id)} style={{
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

  // ── TABLET ICON SIDEBAR (collapsed, always visible) ──────────
  const tabletSidebar = (
    <div style={{
      width:64,
      background: t.sidebar,
      borderRight:`1px solid ${t.border}`,
      display:"flex", flexDirection:"column",
      flexShrink:0,
      height:"100vh", position:"sticky", top:0, zIndex:200,
      overflow:"hidden",
    }}>
      {/* Brand icon */}
      <div style={{
        padding:"18px 0 16px",
        display:"flex", alignItems:"center", justifyContent:"center",
        borderBottom:`1px solid ${t.border}`,
        minHeight:70, flexShrink:0,
      }}>
        <div style={{
          width:36, height:36, borderRadius:11, flexShrink:0,
          background:"linear-gradient(135deg,#1d4ed8,#7c3aed)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:18,
          boxShadow:"0 0 24px rgba(37,99,235,0.5)",
        }}>🫓</div>
      </div>

      {/* Nav items — icon only */}
      <div style={{ flex:1, padding:"12px 7px", display:"flex", flexDirection:"column", gap:2, overflowY:"auto" }}>
        {visibleTabs.map(tab => {
          const isActive = activeTab === tab.id;
          const badge = badgeCounts[tab.id];
          return (
            <button
              key={tab.id}
              onClick={() => handleTabSwitch(tab.id)}
              title={tab.label}
              style={{
                display:"flex", alignItems:"center", justifyContent:"center",
                padding:"13px 0",
                borderRadius:11, border:"none", cursor:"pointer",
                background: isActive
                  ? `linear-gradient(135deg, ${tab.accent.solid}20, ${tab.accent.solid}0d)`
                  : "transparent",
                width:"100%",
                transition:"all 0.15s",
                boxShadow: isActive ? `inset 0 0 0 1px ${tab.accent.solid}25` : "none",
                position:"relative",
                // Ensure 44px min tap target
                minHeight:44,
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = t.cardHov; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ fontSize:18 }}>{tab.emoji}</span>
              {badge && (
                <div style={{
                  position:"absolute", top:5, right:6,
                  width:8, height:8, borderRadius:"50%",
                  background:tab.accent.solid,
                  boxShadow:`0 0 8px ${tab.accent.solid}`,
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Logout */}
      <div style={{ borderTop:`1px solid ${t.border}`, padding:"14px 7px", flexShrink:0 }}>
        <button onClick={onLogout} style={{
          width:"100%", padding:"10px 0", borderRadius:9, border:"none",
          background:`${t.red}10`, color:t.red,
          cursor:"pointer", fontWeight:700, fontSize:16,
          transition:"all 0.15s", fontFamily:"inherit",
          minHeight:44,
        }}
          onMouseEnter={e => e.currentTarget.style.background = `${t.red}20`}
          onMouseLeave={e => e.currentTarget.style.background = `${t.red}10`}
        >→</button>
      </div>
    </div>
  );

  // ── HEADER ───────────────────────────────────────────────────
  const header = (
    <div style={{
      background:t.header, borderBottom:`1px solid ${t.border}`,
      padding:"0 16px", height:58, display:"flex", alignItems:"center",
      gap:12, flexShrink:0, position:"sticky", top:0, zIndex:150,
    }}>
      {/* Sidebar toggle — desktop only */}
      {!isMobile && !isTablet && (
        <button onClick={() => setSidebarOpen(o => !o)} style={{
          background:"none", border:"none", cursor:"pointer", color:t.sub,
          fontSize:18, padding:"6px", borderRadius:8, transition:"all 0.15s", lineHeight:1,
          minWidth:36, minHeight:36, display:"flex", alignItems:"center", justifyContent:"center",
        }}
          onMouseEnter={e => e.currentTarget.style.color = t.text}
          onMouseLeave={e => e.currentTarget.style.color = t.sub}
        >☰</button>
      )}

      {/* Tab breadcrumb */}
      <div style={{ flex:1, display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
        <span style={{ fontSize:18, flexShrink:0 }}>{activeTabObj.emoji}</span>
        <div style={{ minWidth:0 }}>
          <div style={{ color:t.text, fontWeight:800, fontSize:14, lineHeight:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{activeTabObj.label}</div>
          <div style={{ color:t.muted, fontSize:9, marginTop:2 }}>
            {formatDate(time)} · {formatTime(time)}
          </div>
        </div>
      </div>

      {/* Active batch pill — hide on small phones to save space */}
      {activeBatch && !isMobile && (
        <div style={{
          background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.2)",
          borderRadius:"999px", padding:"5px 12px",
          display:"flex", alignItems:"center", gap:6, flexShrink:0,
        }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:"#10B981", boxShadow:"0 0 8px #10B981", animation:"pulse 2s infinite" }} />
          <span style={{ color:"#10B981", fontSize:10, fontWeight:700 }}>
            {activeBatch.product} · {activeBatch.actual ?? 0}/{activeBatch.target ?? 0}
          </span>
        </div>
      )}

      {/* Session info */}
      {sess?.shift && !isMobile && (
        <div style={{
          background:"rgba(37,99,235,0.08)", border:"1px solid rgba(37,99,235,0.18)",
          borderRadius:"999px", padding:"4px 10px", flexShrink:0,
          color:t.blue, fontSize:10, fontWeight:600,
        }}>⏰ {sess.shift}</div>
      )}

      {/* Mobile: active batch dot indicator */}
      {activeBatch && isMobile && (
        <div style={{ width:8, height:8, borderRadius:"50%", background:"#10B981", boxShadow:"0 0 8px #10B981", animation:"pulse 2s infinite", flexShrink:0 }} />
      )}
    </div>
  );

  // ── RIGHT CONTEXT PANEL (desktop only) ───────────────────────
  const rightPanel = (
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
            <div style={{ height:4, background: lightMode ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)", borderRadius:"999px", overflow:"hidden", marginBottom:5 }}>
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

  // ── MOBILE BOTTOM NAV ────────────────────────────────────────
  // Shows 4 primary tabs + "More" button. Secondary tabs live in a drawer.
  const primaryTabs = visibleTabs.filter(t => PRIMARY_TAB_IDS.includes(t.id));
  // Fallback: if fewer than 4 visible primary tabs, fill with whatever's available
  const primaryTabsFilled = primaryTabs.length >= 4
    ? primaryTabs.slice(0, 4)
    : [
        ...primaryTabs,
        ...visibleTabs.filter(t => !PRIMARY_TAB_IDS.includes(t.id)).slice(0, 4 - primaryTabs.length),
      ];
  const secondaryTabs = visibleTabs.filter(t => !primaryTabsFilled.includes(t));
  const hasSecondary = secondaryTabs.length > 0;
  // Is active tab in secondary? Show "More" as active
  const activeInSecondary = secondaryTabs.some(t => t.id === activeTab);

  const bottomNav = (
    <div style={{
      position:"fixed", bottom:0, left:0, right:0,
      background: lightMode ? "rgba(255,255,255,0.97)" : "rgba(8,12,21,0.97)",
      borderTop:`1px solid ${t.border}`,
      backdropFilter:"blur(32px)",
      display:"flex", zIndex:300,
      // Safe area + fixed 68px height for large tap targets
      paddingBottom:"env(safe-area-inset-bottom)",
      height:"calc(68px + env(safe-area-inset-bottom))",
    }}>
      {primaryTabsFilled.map(tab => {
        const isActive = activeTab === tab.id;
        const badge = badgeCounts[tab.id];
        return (
          <button key={tab.id} onClick={() => handleTabSwitch(tab.id)} style={{
            flex:1, display:"flex", flexDirection:"column", alignItems:"center",
            justifyContent:"center", gap:4, border:"none", cursor:"pointer",
            background:"none", padding:"8px 4px 0",
            borderTop: isActive ? `2px solid ${tab.accent.solid}` : "2px solid transparent",
            transition:"all 0.15s", position:"relative",
            // 44px min touch target
            minHeight:44,
          }}>
            <span style={{ fontSize:22 }}>{tab.emoji}</span>
            <span style={{
              fontSize:9, fontWeight: isActive ? 800 : 500,
              color: isActive ? tab.accent.solid : t.sub,
              letterSpacing:"0.04em",
              maxWidth:"100%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
            }}>
              {tab.label.toUpperCase()}
            </span>
            {badge && (
              <div style={{
                position:"absolute", top:6, right:"calc(50% - 20px)",
                background:tab.accent.solid, color:"#fff",
                borderRadius:"999px", fontSize:9, fontWeight:800,
                padding:"1px 5px", minWidth:16, textAlign:"center",
                boxShadow:`0 0 8px ${tab.accent.solid}60`,
              }}>{badge}</div>
            )}
          </button>
        );
      })}

      {/* "More" button — only shown if there are secondary tabs */}
      {hasSecondary && (
        <button onClick={() => setMoreDrawerOpen(o => !o)} style={{
          flex:1, display:"flex", flexDirection:"column", alignItems:"center",
          justifyContent:"center", gap:4, border:"none", cursor:"pointer",
          background:"none", padding:"8px 4px 0",
          borderTop: activeInSecondary ? `2px solid ${activeTabObj.accent.solid}` : "2px solid transparent",
          transition:"all 0.15s", position:"relative",
          minHeight:44,
        }}>
          <span style={{ fontSize:22 }}>
            {activeInSecondary ? activeTabObj.emoji : "⋯"}
          </span>
          <span style={{
            fontSize:9, fontWeight: activeInSecondary ? 800 : 500,
            color: activeInSecondary ? activeTabObj.accent.solid : t.sub,
            letterSpacing:"0.04em",
          }}>
            {activeInSecondary ? activeTabObj.label.toUpperCase() : "MORE"}
          </span>
          {/* Dot if any secondary tab has a badge */}
          {secondaryTabs.some(t => badgeCounts[t.id]) && !activeInSecondary && (
            <div style={{
              position:"absolute", top:6, right:"calc(50% - 20px)",
              width:8, height:8, borderRadius:"50%",
              background:"#ef4444", boxShadow:"0 0 8px #ef4444",
            }} />
          )}
        </button>
      )}
    </div>
  );

  // ── "MORE" DRAWER (mobile secondary tabs) ────────────────────
  const moreDrawer = moreDrawerOpen && (
    <div style={{ position:"fixed", inset:0, zIndex:400, display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
      {/* Backdrop */}
      <div
        onClick={() => setMoreDrawerOpen(false)}
        style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.65)", backdropFilter:"blur(6px)" }}
      />
      {/* Sheet */}
      <div style={{
        position:"relative",
        background: lightMode ? "#ffffff" : "#0c1220",
        border:`1px solid ${t.border}`,
        borderRadius:"20px 20px 0 0",
        padding:"0 0 calc(16px + env(safe-area-inset-bottom))",
        boxShadow:"0 -8px 48px rgba(0,0,0,0.7)",
        animation:"slideUp 0.22s cubic-bezier(0.4,0,0.2,1)",
      }}>
        {/* Handle */}
        <div style={{ width:40, height:4, background:t.border, borderRadius:"999px", margin:"12px auto 4px" }} />

        {/* Header */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"12px 20px 10px",
          borderBottom:`1px solid ${t.border}`,
        }}>
          <div style={{ color:t.text, fontWeight:800, fontSize:15 }}>More</div>
          {/* User info */}
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ textAlign:"right" }}>
              <div style={{ color:t.text, fontWeight:700, fontSize:12 }}>{sess?.name || "Staff"}</div>
              {sess?.shift && <div style={{ color:t.sub, fontSize:10 }}>{sess.shift}</div>}
            </div>
            <div style={{
              width:34, height:34, borderRadius:"50%",
              background:`${t.blue}18`, border:`1.5px solid ${t.blue}28`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:13, fontWeight:800, color:t.blue,
            }}>
              {(sess?.name || "?").split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase()}
            </div>
          </div>
        </div>

        {/* Secondary tab grid */}
        <div style={{
          display:"grid", gridTemplateColumns:"repeat(4, 1fr)",
          gap:4, padding:"12px 12px 4px",
        }}>
          {secondaryTabs.map(tab => {
            const isActive = activeTab === tab.id;
            const badge = badgeCounts[tab.id];
            return (
              <button key={tab.id} onClick={() => handleTabSwitch(tab.id)} style={{
                display:"flex", flexDirection:"column", alignItems:"center",
                justifyContent:"center", gap:6,
                padding:"14px 8px",
                borderRadius:14, border:"none", cursor:"pointer",
                background: isActive
                  ? `linear-gradient(135deg, ${tab.accent.solid}20, ${tab.accent.solid}0d)`
                  : t.card,
                boxShadow: isActive ? `inset 0 0 0 1.5px ${tab.accent.solid}40` : `inset 0 0 0 1px ${t.border}`,
                transition:"all 0.15s",
                position:"relative",
                minHeight:76,
              }}>
                <span style={{ fontSize:28 }}>{tab.emoji}</span>
                <span style={{
                  fontSize:10, fontWeight: isActive ? 800 : 600,
                  color: isActive ? tab.accent.solid : t.text,
                  textAlign:"center", lineHeight:1.2,
                  maxWidth:"100%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                }}>{tab.label}</span>
                {badge && (
                  <div style={{
                    position:"absolute", top:8, right:8,
                    background:tab.accent.solid, color:"#fff",
                    borderRadius:"999px", fontSize:9, fontWeight:800,
                    padding:"1px 5px", minWidth:16, textAlign:"center",
                  }}>{badge}</div>
                )}
              </button>
            );
          })}
        </div>

        {/* Logout */}
        <div style={{ padding:"8px 12px 0" }}>
          <button onClick={onLogout} style={{
            width:"100%", padding:"13px 0", borderRadius:12, border:"none",
            background:`${t.red}10`, color:t.red,
            cursor:"pointer", fontWeight:700, fontSize:14,
            transition:"all 0.15s", fontFamily:"inherit",
          }}
            onMouseEnter={e => e.currentTarget.style.background = `${t.red}20`}
            onMouseLeave={e => e.currentTarget.style.background = `${t.red}10`}
          >← Log Out</button>
        </div>
      </div>
    </div>
  );

  // ── TAB CONTENT ──────────────────────────────────────────────
  const renderTab = () => {
    const shared = { t, sess, notify, settings };
    switch (activeTab) {
      case "home":       return <HomeTab            {...shared} batches={batches} inventory={inventory} deliveries={deliveries} staffList={staffList} qcLogs={qcLogs} setActiveTab={setActiveTab} />;
      case "production": return <ProductionStartTab {...shared} batches={batches} setBatches={setBatches} logActivity={logActivity} setInventory={setInventory} setActivityLog={setActivityLog} />;
      case "packing":    return <PackingTab         {...shared} batches={batches} setBatches={setBatches} setActivityLog={setActivityLog} />;
      case "inventory":  return <InventoryTab       {...shared} inventory={inventory} setInventory={setInventory} setActivityLog={setActivityLog} />;
      case "delivery":   return <DeliveryTab        {...shared} deliveries={deliveries} setDeliveries={setDeliveries} setActivityLog={setActivityLog} />;
      case "qc":         return <QCTab             {...shared} batches={batches} setBatches={setBatches} qcLogs={qcLogs} setQcLogs={setQcLogs} setActivityLog={setActivityLog} />;
      case "staff":      return <StaffTab           {...shared} staffList={staffList} setStaffList={setStaffList} />;
      case "management": return <StaffManagementTab {...shared} staffList={staffList} setStaffList={setStaffList} />;
      case "reports":    return <ReportsTab         {...shared} batches={batches} inventory={inventory} deliveries={deliveries} staffList={staffList} qcLogs={qcLogs} logActivity={logActivity} />;
      case "settings":   return <SettingsTab        {...shared} />;
      default:           return null;
    }
  };

  return (
    <div style={{
      display:"flex", height:"100vh",
      background:t.bg,
      backgroundImage: lightMode ? "none" : [
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
        @keyframes slideUp { from{transform:translateY(16px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:3px; height:3px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:${lightMode ? "#c8d1e8" : "#1e2840"}; border-radius:3px; }
        ::-webkit-scrollbar-thumb:hover { background:${lightMode ? "#b8c4dd" : "#273350"}; }
        button { font-family: inherit; }
        input, textarea, select { font-family: inherit; }
      `}</style>

      {/* Sidebar: desktop = full collapsible, tablet = icon-only, mobile = none */}
      {!isMobile && !isTablet && sidebar}
      {isTablet && tabletSidebar}

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>
        {header}
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
          <div style={{
            flex:1, overflowY:"auto",
            // Bottom padding: mobile gets space for bottom nav, tablet/desktop don't need it
            paddingBottom: isMobile ? "calc(68px + env(safe-area-inset-bottom))" : 0,
          }}>
            {renderTab()}
          </div>
          {/* Right panel: desktop only, and only when sidebar is open */}
          {!isMobile && !isTablet && sidebarOpen && rightPanel}
        </div>
      </div>

      {/* Mobile bottom nav + drawer */}
      {isMobile && bottomNav}
      {isMobile && moreDrawer}

      {/* Toast: positioned above bottom nav on mobile */}
      <SToast msg={toast.msg} type={toast.type} visible={toast.visible} />
    </div>
  );
}
