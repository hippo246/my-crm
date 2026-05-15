// ============================================================
// staff/tabs/Home.js — v8 ROLE-SPLIT + FULL FACTORY VIEW
// Merges v7 role routing (factory/agent) with v6 factory sections:
//   - Production Output chart (7D/1M/3M)
//   - Top Products Today
//   - Active Batches table with SPill status
//   - Delivered count in hero
//   - 6 quick actions
//   - Rich recent activity (batches + deliveries + inventory)
//
// Roles:
//   factory / staff_shared → FactoryHome (full production dashboard)
//   agent                  → AgentHome   (delivery-focused view)
//   admin                  → fallback to FactoryHome
// ============================================================

import React, { useState, useEffect } from "react";
import { TAB_ACCENT } from "../theme.js";
import { SKpiCard, SPill, STag, SBarChart, SSectionHeader } from "../components/ui.js";
import { ref, onValue } from "firebase/database";
import { db } from "../../firebase.js";
import { hasPerm, defaultFinePerms } from "../../lib/roles.js";
import { BATCH_STATUS_LABELS } from "../../lib/workflowEngine.js";

// ── Responsive helper ─────────────────────────────────────────
function useBreakpoint() {
  const [w, setW] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1024));
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return { isMobile: w < 600, isTablet: w >= 600 && w < 900, isDesktop: w >= 900, w };
}

// ── Chart range data ──────────────────────────────────────────
const RANGE_MULTIPLIERS = {
  "7D": [0.85, 0.92, 0.78, 1.05, 0.93, 1.00, 0.40],
  "1M": [0.72, 0.88, 0.95, 0.80, 1.02, 0.91, 0.97, 0.85, 0.78, 0.93,
         0.88, 0.76, 1.00, 0.84, 0.90, 0.95, 0.82, 0.88, 0.77, 0.94,
         0.86, 0.91, 0.79, 1.03, 0.88, 0.95, 0.82, 0.97, 0.90, 0.85],
  "3M": [0.75, 0.82, 0.90, 0.88, 0.95, 0.78, 1.00, 0.85, 0.92, 0.80,
         0.88, 0.94, 0.76, 0.91, 0.85, 0.97, 0.83, 0.89, 0.93, 0.79,
         1.02, 0.86, 0.90, 0.84, 0.91, 0.96, 0.80, 0.88, 0.94, 0.85],
};
const RANGE_LABELS = {
  "7D": ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
  "1M": Array.from({ length: 30 }, (_, i) => `${i + 1}`),
  "3M": ["Jan W1","Jan W2","Jan W3","Jan W4","Feb W1","Feb W2","Feb W3","Feb W4",
         "Mar W1","Mar W2","Mar W3","Mar W4","Apr W1","Apr W2","Apr W3","Apr W4",
         "May W1","May W2","May W3","May W4","Jun W1","Jun W2","Jun W3","Jun W4",
         "Jul W1","Jul W2","Jul W3","Jul W4","Aug W1","Aug W2"],
};

// ── Live Firebase perm sync ───────────────────────────────────
function useFirebasePerms(sess) {
  const [finePerms, setFinePerms] = useState(() =>
    sess?.finePerms || defaultFinePerms(sess?.role || "factory")
  );
  useEffect(() => {
    if (!sess?.uid || sess.role === "admin") return;
    const permRef = ref(db, `staffPerms/${sess.uid}/finePerms`);
    const unsub = onValue(permRef, snap => {
      if (snap.exists()) setFinePerms(snap.val());
    });
    return () => unsub();
  }, [sess?.uid, sess?.role]);
  return finePerms;
}

// ── Live notices from Firebase ────────────────────────────────
function useFirebaseNotices() {
  const [notices, setNotices] = useState([]);
  useEffect(() => {
    const noticeRef = ref(db, "staffConfig/notices");
    const unsub = onValue(noticeRef, snap => {
      if (snap.exists()) {
        const arr = Object.entries(snap.val()).map(([id, v]) => ({ id, ...v }));
        setNotices(arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      } else {
        setNotices([]);
      }
    });
    return () => unsub();
  }, []);
  return notices;
}

// ── Live wastage from Firebase ────────────────────────────────
function useFirebaseWastage() {
  const [wastage, setWastage] = useState([]);
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const wastageRef = ref(db, "tas9_wastage");
    const unsub = onValue(wastageRef, snap => {
      if (snap.exists()) {
        const arr = Object.values(snap.val()).filter(w => (w.date || "").startsWith(today));
        setWastage(arr);
      } else {
        setWastage([]);
      }
    });
    return () => unsub();
  }, []);
  return wastage;
}

// ── Shared: Admin Notices banner ──────────────────────────────
function NoticesBanner({ notices, t }) {
  if (!notices.length) return null;
  return (
    <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      {notices.map(notice => (
        <div key={notice.id} style={{
          background: "rgba(245,158,11,0.08)",
          border: "1px solid rgba(245,158,11,0.25)",
          borderRadius: 14, padding: "12px 16px",
          display: "flex", alignItems: "flex-start", gap: 12,
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>📌</span>
          <div style={{ flex: 1 }}>
            {notice.title && (
              <div style={{ color: "#F59E0B", fontWeight: 800, fontSize: 13, marginBottom: 3 }}>
                {notice.title}
              </div>
            )}
            <div style={{ color: t.text, fontSize: 12 }}>{notice.body || notice.text || ""}</div>
            {notice.createdBy && (
              <div style={{ color: t.muted, fontSize: 10, marginTop: 4 }}>— {notice.createdBy}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Shared: Greeting hero ─────────────────────────────────────
function GreetingHero({ sess, t, isMobile, stats, totalTarget, overallPct }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const h        = now.getHours();
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const timeStr  = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const dateStr  = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 20,
      padding: isMobile ? "16px" : "22px 24px",
      marginBottom: 16,
      position: "relative",
      overflow: "hidden",
      backdropFilter: "blur(24px)",
      boxShadow: "0 8px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
    }}>
      <div style={{
        position: "absolute", top: -40, right: -40,
        width: 180, height: 180, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ color: t.muted, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
            {dateStr} · {timeStr}
          </div>
          <div style={{ color: t.text, fontWeight: 900, fontSize: isMobile ? 20 : 26, lineHeight: 1.15 }}>
            {greeting}, {sess?.name?.split(" ")[0] || "Team"} 👋
          </div>
          {sess?.shift && (
            <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)",
              borderRadius: 8, padding: "4px 10px",
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 8px #10B981" }} />
              <span style={{ color: "#10B981", fontSize: 11, fontWeight: 700 }}>{sess.shift}</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: isMobile ? 8 : 14, flexWrap: "wrap" }}>
          {stats.map(s => (
            <div key={s.label} style={{ textAlign: "right" }}>
              <div style={{ color: s.color, fontWeight: 900, fontSize: isMobile ? 18 : 22 }}>{s.value}</div>
              <div style={{ color: t.muted, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Role badge */}
      <div style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6,
        background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
        borderRadius: 8, padding: "3px 10px",
      }}>
        <span style={{ color: "#818cf8", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {sess?.role === "agent" ? "🚚 Delivery Agent" : sess?.role === "factory" ? "🏭 Factory Staff" : sess?.role === "staff_shared" ? "👥 Staff" : sess?.role || "Staff"}
        </span>
      </div>

      {/* Progress bar (factory only — only shown when totalTarget > 0) */}
      {totalTarget > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: "999px", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${overallPct}%`,
              background: overallPct >= 100
                ? "linear-gradient(90deg,#10B981,#34D399)"
                : TAB_ACCENT.home?.gradient || "linear-gradient(90deg,#2563EB,#7C3AED)",
              borderRadius: "999px",
              boxShadow: overallPct >= 100 ? "0 0 16px rgba(16,185,129,0.6)" : "0 0 16px rgba(37,99,235,0.5)",
              transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
            }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Quick action button ───────────────────────────────────────
function QuickAction({ icon, label, sub, badge, onClick, isMobile, t }) {
  return (
    <button onClick={onClick} style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 14,
      padding: isMobile ? "12px 8px" : "14px 10px",
      cursor: "pointer",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 6,
      position: "relative",
      transition: "all 0.18s",
      backdropFilter: "blur(16px)",
    }}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.transform = ""; }}
    >
      {badge > 0 && (
        <div style={{
          position: "absolute", top: 8, right: 8,
          background: "#EF4444", color: "#fff",
          borderRadius: "999px", fontSize: 8, fontWeight: 800,
          padding: "1px 5px", minWidth: 14, textAlign: "center",
        }}>{badge}</div>
      )}
      <span style={{ fontSize: isMobile ? 22 : 26 }}>{icon}</span>
      <div style={{ color: t.text, fontWeight: 700, fontSize: 11 }}>{label}</div>
      <div style={{ color: t.muted, fontSize: 9 }}>{sub}</div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
//  FACTORY VIEW
// ═══════════════════════════════════════════════════════════════
function FactoryHome({ t, sess, can, isMobile, isTablet, batches, inventory, deliveries, qcLogs, notices, todayWastage, setActiveTab }) {
  const [chartRange, setChartRange] = useState("7D");

  const safeBatches   = Array.isArray(batches)   ? batches   : [];
  const safeInventory = Array.isArray(inventory) ? inventory : [];
  const safeDeliveries = Array.isArray(deliveries) ? deliveries : [];

  // Batch state — workflowStatus-aware with legacy fallback
  const activeBatches  = safeBatches.filter(b => !b.onHold && (b.workflowStatus === "production" || (!b.workflowStatus && (b.actual ?? 0) < (b.target ?? 0))));
  const awaitingQC     = safeBatches.filter(b => b.workflowStatus === "awaiting_qc" || (!b.workflowStatus && !b.qcGrade && (b.actual ?? 0) > 0));
  const readyToPack    = safeBatches.filter(b => b.workflowStatus === "ready_to_pack");
  const onHold         = safeBatches.filter(b => b.onHold);
  const lowStock       = safeInventory.filter(i => typeof i.stock === "number" && typeof i.minStock === "number" && i.stock <= i.minStock);
  const criticalStock  = safeInventory.filter(i => typeof i.stock === "number" && i.stock <= 0);
  const pendingDispatch = safeDeliveries.filter(d => ["pending","in transit"].includes((d.status || "").toLowerCase()));

  const totalPacked    = safeBatches.reduce((s, b) => s + (b.actual ?? 0), 0);
  const totalTarget    = safeBatches.reduce((s, b) => s + (b.target ?? 0), 0);
  const overallPct     = totalTarget > 0 ? Math.min(100, Math.round((totalPacked / totalTarget) * 100)) : 0;
  const totalDelivered = safeDeliveries.filter(d => d.status === "Delivered").length;
  const totalWastageQty  = todayWastage.reduce((s, w) => s + (w.qty || 0), 0);
  const totalWastageCost = todayWastage.reduce((s, w) => s + (w.cost || 0), 0);

  // Chart data
  const seed    = totalPacked || 120;
  const mults   = RANGE_MULTIPLIERS[chartRange];
  const labels  = RANGE_LABELS[chartRange];
  const barData = mults.map((f, i) => ({ label: labels[i] || `${i + 1}`, value: Math.max(0, Math.round(seed * f)) }));

  const heroStats = [
    { label: "Packed Today", value: totalPacked.toLocaleString("en-IN"), color: TAB_ACCENT.packing.solid },
    { label: "Target",       value: totalTarget.toLocaleString("en-IN"), color: t.sub },
    { label: "Progress",     value: `${overallPct}%`,                    color: overallPct >= 100 ? "#10B981" : TAB_ACCENT.home?.solid || "#6366f1" },
    { label: "Delivered",    value: totalDelivered,                      color: TAB_ACCENT.delivery.solid },
  ];

  const kpiCols      = isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)";
  const actionCols   = isMobile ? "repeat(3,1fr)" : isTablet ? "repeat(3,1fr)" : "repeat(6,1fr)";
  const analyticsCols = isMobile ? "1fr" : "1.6fr 1fr";
  const bottomCols   = isMobile ? "1fr" : "1fr 1fr";

  const ACTIONS = [
    { icon: "📦", label: "Packing",   sub: "Log units",     tab: "packing",   badge: readyToPack.length },
    { icon: "✅", label: "QC Check",  sub: "Inspect batch", tab: "qc",        badge: awaitingQC.length },
    { icon: "🏭", label: "Inventory", sub: "Stock levels",  tab: "inventory", badge: lowStock.length },
    { icon: "🚚", label: "Dispatch",  sub: "Track orders",  tab: "delivery",  badge: pendingDispatch.length },
    { icon: "👥", label: "Staff",     sub: "Clock in/out",  tab: "staff",     badge: 0 },
    { icon: "📊", label: "Reports",   sub: "Analytics",     tab: "reports",   badge: 0 },
  ];

  const recentActivity = [
    ...safeBatches.slice(-5).reverse().map(b => ({
      id: b.id,
      text: `Batch ${b.product} — ${b.actual ?? 0} pcs packed`,
      type: "Packing", time: b.date || "Today",
      color: TAB_ACCENT.packing.solid, tab: "packing",
    })),
    ...safeDeliveries.filter(d => d.status === "Delivered").slice(-3).map(d => ({
      id: d.id + "d",
      text: `${d.customer} delivery completed`,
      type: "Delivery", time: d.date || "Today",
      color: TAB_ACCENT.delivery.solid, tab: "delivery",
    })),
    ...safeInventory.filter(i => i.stock <= (i.minStock ?? 0)).slice(0, 2).map(i => ({
      id: i.id + "i",
      text: `${i.name} stock running low`,
      type: "Inventory", time: "Today",
      color: TAB_ACCENT.inventory.solid, tab: "inventory",
    })),
  ].slice(0, 8);

  return (
    <div style={{ background: t.bg, minHeight: "100vh", padding: isMobile ? "14px 12px 28px" : "18px 18px 32px", animation: "fadeIn 0.3s ease" }}>

      <NoticesBanner notices={notices} t={t} />
      <GreetingHero sess={sess} t={t} isMobile={isMobile} stats={heroStats} totalTarget={totalTarget} overallPct={overallPct} />

      {/* Wastage widget */}
      {can("dash_seeWastage") && todayWastage.length > 0 && (
        <div style={{
          background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.18)",
          borderRadius: 14, padding: "12px 16px", marginBottom: 16,
          display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 22 }}>🗑️</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#EF4444", fontWeight: 800, fontSize: 13 }}>Today's Wastage</div>
            <div style={{ color: t.sub, fontSize: 11, marginTop: 2 }}>
              {todayWastage.length} entries · {totalWastageQty.toLocaleString("en-IN")} units wasted
              {can("waste_seeCost") && totalWastageCost > 0 && (
                <span style={{ color: "#EF4444", fontWeight: 700 }}> · ₹{totalWastageCost.toLocaleString("en-IN")} lost</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: kpiCols, gap: 10, marginBottom: 14 }}>
        <SKpiCard t={t} label="Active Batches"  value={activeBatches.length}   icon="🏭" color={TAB_ACCENT.production?.solid || "#f97316"} />
        <SKpiCard t={t} label="Pending QC"      value={awaitingQC.length}      icon="✅" color={TAB_ACCENT.qc.solid} />
        <SKpiCard t={t} label="Low Stock Items" value={lowStock.length}        icon="⚠️" color={criticalStock.length > 0 ? "#ef4444" : "#EF4444"} />
        <SKpiCard t={t} label="Pending Dispatch" value={pendingDispatch.length} icon="🚚" color={TAB_ACCENT.delivery.solid} />
      </div>

      {/* On-hold alert */}
      {onHold.length > 0 && (
        <div style={{
          background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
          borderLeft: "4px solid #F59E0B", borderRadius: 12,
          padding: "12px 16px", marginBottom: 14,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>⏸</span>
            <div>
              <div style={{ color: "#F59E0B", fontWeight: 800, fontSize: 13 }}>
                {onHold.length} batch{onHold.length > 1 ? "es" : ""} on hold
              </div>
              <div style={{ color: t.sub, fontSize: 11, marginTop: 2 }}>
                {onHold.map(b => b.product).slice(0, 3).join(", ")}{onHold.length > 3 ? ` +${onHold.length - 3} more` : ""}
              </div>
            </div>
          </div>
          <button onClick={() => setActiveTab("production")} style={{
            padding: "7px 14px", borderRadius: 9, border: "none",
            background: "rgba(245,158,11,0.15)", color: "#F59E0B",
            fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>View →</button>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ marginBottom: 16 }}>
        <SSectionHeader title="Quick Actions" t={t} accent={t.cyan} />
        <div style={{ display: "grid", gridTemplateColumns: actionCols, gap: 10, marginTop: 10 }}>
          {ACTIONS.map(a => (
            <QuickAction key={a.tab} {...a} isMobile={isMobile} t={t} onClick={() => setActiveTab(a.tab)} />
          ))}
        </div>
      </div>

      {/* Production Output chart + Top Products */}
      <div style={{ display: "grid", gridTemplateColumns: analyticsCols, gap: 14, marginBottom: 14 }}>

        {/* Chart */}
        <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "18px", backdropFilter: "blur(20px)", boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ color: t.text, fontWeight: 800, fontSize: 13 }}>Production Output</div>
            <div style={{ display: "flex", gap: 4 }}>
              {["7D", "1M", "3M"].map(l => (
                <button key={l} onClick={() => setChartRange(l)} style={{
                  padding: "3px 9px", borderRadius: 6, border: "none", cursor: "pointer",
                  background: chartRange === l ? TAB_ACCENT.home?.solid || "#6366f1" : "rgba(255,255,255,0.05)",
                  color:      chartRange === l ? "#fff" : t.sub,
                  fontSize: 9, fontWeight: 700, fontFamily: "inherit",
                  boxShadow:  chartRange === l ? TAB_ACCENT.home?.glow || "none" : "none",
                  transition: "all 0.15s",
                }}>{l}</button>
              ))}
            </div>
          </div>
          <SBarChart data={barData} color={TAB_ACCENT.home?.solid || "#6366f1"} height={90} t={t} />
        </div>

        {/* Top Products */}
        <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "18px", backdropFilter: "blur(20px)", boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}>
          <div style={{ color: t.text, fontWeight: 800, fontSize: 13, marginBottom: 14 }}>Top Products Today</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {safeBatches.length === 0 ? (
              <div style={{ color: t.muted, fontSize: 12, textAlign: "center", padding: "20px 0" }}>No production data yet</div>
            ) : (
              [...safeBatches].sort((a, b) => (b.actual ?? 0) - (a.actual ?? 0)).slice(0, 5).map((b, i) => {
                const colors = [t.blue, t.green, t.purple, t.orange, t.cyan];
                const c = colors[i % colors.length];
                const maxV = safeBatches.reduce((s, x) => Math.max(s, x.actual ?? 0), 1);
                return (
                  <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, fontWeight: 800, width: 13 }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: t.text, fontSize: 11, fontWeight: 700, marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.product}</div>
                      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: "999px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${maxV > 0 ? ((b.actual ?? 0) / maxV) * 100 : 0}%`, background: c, borderRadius: "999px", boxShadow: `0 0 10px ${c}70`, transition: "width 0.5s ease" }} />
                      </div>
                    </div>
                    <span style={{ color: c, fontSize: 11, fontWeight: 800, flexShrink: 0, minWidth: 54, textAlign: "right" }}>
                      {(b.actual ?? 0).toLocaleString("en-IN")} pcs
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity + Active Batches */}
      <div style={{ display: "grid", gridTemplateColumns: bottomCols, gap: 14 }}>

        {/* Recent activity */}
        <div>
          <SSectionHeader title="Recent Activity" t={t} accent={t.cyan}
            action={
              <span onClick={() => setActiveTab("reports")}
                style={{ color: t.cyan, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                View all →
              </span>
            }
          />
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden", backdropFilter: "blur(20px)", boxShadow: "0 4px 24px rgba(0,0,0,0.25)", marginTop: 10 }}>
            {recentActivity.length === 0 ? (
              <div style={{ padding: "36px", textAlign: "center", color: t.muted, fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.3 }}>📋</div>
                No activity yet — start a batch to see updates
              </div>
            ) : recentActivity.map((a, i, arr) => (
              <div key={a.id}
                onClick={() => a.tab && setActiveTab(a.tab)}
                style={{ padding: "11px 16px", borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, transition: "all 0.15s", cursor: a.tab ? "pointer" : "default" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.035)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = ""; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: a.color, flexShrink: 0, boxShadow: `0 0 10px ${a.color}90` }} />
                  <span style={{ color: t.text, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.text}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
                  {!isMobile && <STag label={a.type} color={a.color} />}
                  <span style={{ color: t.muted, fontSize: 10 }}>{a.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Batches */}
        <div>
          <SSectionHeader title="Active Batches" t={t} accent={TAB_ACCENT.packing.solid}
            action={
              <span onClick={() => setActiveTab("packing")}
                style={{ color: TAB_ACCENT.home?.solid || "#6366f1", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                View all →
              </span>
            }
          />
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden", backdropFilter: "blur(20px)", boxShadow: "0 4px 24px rgba(0,0,0,0.25)", marginTop: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr 0.9fr", padding: "9px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)" }}>
              {["PRODUCT", "PROGRESS", "STATUS"].map(h => (
                <div key={h} style={{ color: "rgba(255,255,255,0.28)", fontSize: 8, fontWeight: 800, letterSpacing: "0.1em" }}>{h}</div>
              ))}
            </div>
            {safeBatches.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center", color: t.sub, fontSize: 12 }}>
                <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>🏭</div>
                Batches created by admin appear here
              </div>
            ) : (
              [...safeBatches]
                .sort((a, b) => (b.startedAt || b.date || "").localeCompare(a.startedAt || a.date || ""))
                .slice(0, 6)
                .map((b, i, arr) => {
                  const pct = (b.target ?? 0) > 0 ? Math.min(100, Math.round(((b.actual ?? 0) / b.target) * 100)) : 0;
                  const barColor = pct === 100 ? "#10B981" : TAB_ACCENT.packing.solid;
                  const ws = b.workflowStatus;
                  const status = ws === "qc_rejected" ? "Rejected" : ws ? (BATCH_STATUS_LABELS[ws] || ws) : (b.qcGrade === "Rejected" ? "Rejected" : b.qcGrade ? `Grade ${b.qcGrade}` : pct >= 100 ? "completed" : "in_progress");
                  const statusLabel = ws ? (BATCH_STATUS_LABELS[ws] || ws) : (b.qcGrade === "Rejected" ? "Rejected" : b.qcGrade ? `Grade ${b.qcGrade}` : pct >= 100 ? "Needs QC" : "In Progress");
                  return (
                    <div key={b.id} onClick={() => setActiveTab(ws === "awaiting_qc" || ws === "qc_rejected" ? "qc" : "packing")}
                      style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr 0.9fr", padding: "10px 16px", borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", cursor: "pointer", alignItems: "center", transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.035)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = ""; }}
                    >
                      <div>
                        <div style={{ color: t.text, fontWeight: 700, fontSize: 12 }}>{b.product}</div>
                        <div style={{ color: t.sub, fontSize: 9, marginTop: 1 }}>{b.date || "—"}</div>
                      </div>
                      <div>
                        <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: "999px", overflow: "hidden", marginBottom: 4 }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: "999px", boxShadow: `0 0 10px ${barColor}70`, transition: "width 0.4s ease" }} />
                        </div>
                        <div style={{ color: t.sub, fontSize: 9 }}>{b.actual ?? 0}/{b.target ?? 0} · {pct}%</div>
                      </div>
                      <SPill status={status} label={statusLabel} />
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  AGENT VIEW
// ═══════════════════════════════════════════════════════════════
function AgentHome({ t, sess, can, isMobile, isTablet, deliveries, notices, setActiveTab }) {
  const safeDeliveries = Array.isArray(deliveries) ? deliveries : [];
  const today = new Date().toISOString().slice(0, 10);

  // Filter to this agent's deliveries where possible
  const myDeliveries = safeDeliveries.filter(d =>
    !d.agent || d.agent === sess?.name || d.createdBy === sess?.name || d.assignedTo === sess?.uid
  );
  const pool = myDeliveries.length > 0 ? myDeliveries : safeDeliveries;

  const todayAll       = pool.filter(d => d.date === today);
  const pending        = pool.filter(d => d.status === "Pending");
  const inTransit      = pool.filter(d => d.status === "In Transit");
  const deliveredToday = pool.filter(d => d.status === "Delivered" && d.date === today);
  const overdue        = pool.filter(d => d.status === "Pending" && d.date < today);

  const heroStats = [
    { label: "My Runs Today", value: todayAll.length,       color: TAB_ACCENT.delivery.solid },
    { label: "In Transit",    value: inTransit.length,      color: "#F59E0B" },
    { label: "Delivered",     value: deliveredToday.length, color: "#10B981" },
  ];

  const kpiCols    = isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)";
  const actionCols = isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)";

  const ACTIONS = [
    { icon: "🚚", label: "Deliveries", sub: "My runs",        tab: "delivery",  badge: pending.length + inTransit.length },
    { icon: "📍", label: "GPS",        sub: "Share location", tab: "gps",       badge: 0 },
    { icon: "👤", label: "Customers",  sub: "My accounts",    tab: "customers", badge: 0 },
    { icon: "📋", label: "History",    sub: "Past deliveries",tab: "delivery",  badge: 0 },
  ];

  const STATUS_COLOR = { "Pending": "#F59E0B", "In Transit": TAB_ACCENT.delivery.solid, "Delivered": "#10B981", "Cancelled": "#ef4444" };
  const STATUS_ICON  = { "Pending": "🕐", "In Transit": "🚚", "Delivered": "✅", "Cancelled": "❌" };

  const upNext = [...pending, ...inTransit]
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .slice(0, 6);

  return (
    <div style={{ background: t.bg, minHeight: "100vh", padding: isMobile ? "14px 12px 28px" : "18px 18px 32px", animation: "fadeIn 0.3s ease" }}>

      <NoticesBanner notices={notices} t={t} />
      <GreetingHero sess={sess} t={t} isMobile={isMobile} stats={heroStats} totalTarget={0} overallPct={0} />

      {/* Overdue alert */}
      {overdue.length > 0 && (
        <div style={{
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
          borderLeft: "4px solid #ef4444", borderRadius: 12,
          padding: "12px 16px", marginBottom: 14,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <div style={{ color: "#ef4444", fontWeight: 800, fontSize: 13 }}>
                {overdue.length} overdue deliver{overdue.length > 1 ? "ies" : "y"}
              </div>
              <div style={{ color: t.sub, fontSize: 11, marginTop: 2 }}>
                {overdue.map(d => d.customer).slice(0, 3).join(", ")}{overdue.length > 3 ? ` +${overdue.length - 3} more` : ""}
              </div>
            </div>
          </div>
          <button onClick={() => setActiveTab("delivery")} style={{
            padding: "7px 14px", borderRadius: 9, border: "none",
            background: "rgba(239,68,68,0.15)", color: "#ef4444",
            fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>View →</button>
        </div>
      )}

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: kpiCols, gap: 10, marginBottom: 14 }}>
        <SKpiCard t={t} label="Pending"    value={pending.length}       icon="🕐" color="#F59E0B" />
        <SKpiCard t={t} label="In Transit" value={inTransit.length}     icon="🚚" color={TAB_ACCENT.delivery.solid} />
        <SKpiCard t={t} label="Done Today" value={deliveredToday.length} icon="✅" color="#10B981" />
        <SKpiCard t={t} label="Overdue"    value={overdue.length}       icon="⚠️" color={overdue.length > 0 ? "#ef4444" : t.muted} />
      </div>

      {/* Quick actions */}
      <div style={{ marginBottom: 16 }}>
        <SSectionHeader title="Quick Actions" t={t} accent={TAB_ACCENT.delivery.solid} />
        <div style={{ display: "grid", gridTemplateColumns: actionCols, gap: 10, marginTop: 10 }}>
          {ACTIONS.map(a => (
            <QuickAction key={a.label} {...a} isMobile={isMobile} t={t} onClick={() => setActiveTab(a.tab)} />
          ))}
        </div>
      </div>

      {/* Up next deliveries */}
      <div>
        <SSectionHeader
          title="Up Next"
          t={t}
          accent={TAB_ACCENT.delivery.solid}
          action={
            <span onClick={() => setActiveTab("delivery")}
              style={{ color: TAB_ACCENT.delivery.solid, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
              View all →
            </span>
          }
        />
        <div style={{
          background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14, overflow: "hidden", backdropFilter: "blur(20px)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.25)", marginTop: 10,
        }}>
          {upNext.length === 0 ? (
            <div style={{ padding: "36px", textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.3 }}>🚚</div>
              <div style={{ color: t.text, fontWeight: 700, fontSize: 14, marginBottom: 4 }}>All clear!</div>
              <div style={{ color: t.sub, fontSize: 12 }}>No pending deliveries</div>
            </div>
          ) : upNext.map((d, i, arr) => {
            const sc = STATUS_COLOR[d.status] || t.sub;
            const items = d.orderLines ? Object.values(d.orderLines).filter(l => l?.qty > 0) : [];
            const totalQty = items.reduce((s, l) => s + (l.qty || 0), 0);
            const isOverdue = d.status === "Pending" && d.date < today;
            return (
              <div key={d.id}
                onClick={() => setActiveTab("delivery")}
                style={{
                  padding: "14px 16px",
                  borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  borderLeft: `3px solid ${sc}`,
                  cursor: "pointer", transition: "all 0.15s",
                  background: isOverdue ? "rgba(239,68,68,0.04)" : "transparent",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.035)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = isOverdue ? "rgba(239,68,68,0.04)" : ""; }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3, flexWrap: "wrap" }}>
                      <span style={{ color: t.text, fontWeight: 800, fontSize: 14 }}>{d.customer}</span>
                      <span style={{
                        background: `${sc}15`, color: sc, border: `1px solid ${sc}30`,
                        borderRadius: 6, padding: "2px 7px", fontSize: 9, fontWeight: 700,
                        display: "flex", alignItems: "center", gap: 3,
                      }}>
                        {STATUS_ICON[d.status]} {d.status}
                      </span>
                      {isOverdue && (
                        <span style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, padding: "2px 7px", fontSize: 9, fontWeight: 700 }}>
                          OVERDUE
                        </span>
                      )}
                    </div>
                    <div style={{ color: t.sub, fontSize: 11, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {d.address  && <span>📍 {d.address}</span>}
                      {d.date     && <span>📅 {d.date}</span>}
                      {totalQty > 0 && <span>📦 {totalQty} pcs</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN EXPORT — role router
// ═══════════════════════════════════════════════════════════════
export function HomeTab({ t, sess, batches = [], inventory = [], deliveries = [], staffList = [], qcLogs = [], setActiveTab, notify, settings }) {
  const { isMobile, isTablet } = useBreakpoint();

  const finePerms = useFirebasePerms(sess);
  const liveSess  = { ...sess, finePerms };
  const can       = (key) => hasPerm(liveSess, key);

  const notices      = useFirebaseNotices();
  const todayWastage = useFirebaseWastage();

  const role    = sess?.role || "factory";
  const isAgent = role === "agent";

  const sharedProps = { t, sess: liveSess, can, isMobile, isTablet, notices, setActiveTab };

  if (isAgent) {
    return <AgentHome {...sharedProps} deliveries={deliveries} />;
  }

  return (
    <FactoryHome
      {...sharedProps}
      batches={batches}
      inventory={inventory}
      deliveries={deliveries}
      qcLogs={qcLogs}
      todayWastage={todayWastage}
    />
  );
}
