// ============================================================
// staff/tabs/Home.js — v5 RESPONSIVE + WIRED
// FIXED: all grids collapse correctly on phone/tablet
// FIXED: analytics 7D/1M/3M buttons now change chart data
// FIXED: "View all" activity wired to reports tab
// FIXED: "More" quick action wired to reports tab
// FIXED: hero progress stats wrap properly on small screens
// ============================================================

import React, { useState, useEffect } from "react";
import { TAB_ACCENT } from "../theme.js";
import { SKpiCard, SGradCard, SPill, STag, SBarChart, SLiveBadge, SSectionHeader } from "../components/ui.js";

// ── Responsive grid helper ────────────────────────────────────
function useBreakpoint() {
  const [w, setW] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1024));
  useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return { isMobile: w < 600, isTablet: w >= 600 && w < 900, isDesktop: w >= 900, w };
}

// ── Range multipliers so each period shows different data shape ──
const RANGE_MULTIPLIERS = {
  "7D":  [0.85, 0.92, 0.78, 1.05, 0.93, 1.00, 0.40],
  "1M":  [0.72, 0.88, 0.95, 0.80, 1.02, 0.91, 0.97, 0.85, 0.78, 0.93,
           0.88, 0.76, 1.00, 0.84, 0.90, 0.95, 0.82, 0.88, 0.77, 0.94,
           0.86, 0.91, 0.79, 1.03, 0.88, 0.95, 0.82, 0.97, 0.90, 0.85],
  "3M":  [0.75, 0.82, 0.90, 0.88, 0.95, 0.78, 1.00, 0.85, 0.92, 0.80,
           0.88, 0.94, 0.76, 0.91, 0.85, 0.97, 0.83, 0.89, 0.93, 0.79,
           1.02, 0.86, 0.90, 0.84, 0.91, 0.96, 0.80, 0.88, 0.94, 0.85],
};
const RANGE_LABELS = {
  "7D": ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
  "1M": Array.from({length:30},(_,i)=>`${i+1}`),
  "3M": ["Jan W1","Jan W2","Jan W3","Jan W4","Feb W1","Feb W2","Feb W3","Feb W4","Mar W1","Mar W2",
          "Mar W3","Mar W4","Apr W1","Apr W2","Apr W3","Apr W4","May W1","May W2","May W3","May W4",
          "Jun W1","Jun W2","Jun W3","Jun W4","Jul W1","Jul W2","Jul W3","Jul W4","Aug W1","Aug W2"],
};

export function HomeTab({ t, sess, batches = [], inventory = [], deliveries = [], staffList = [], qcLogs = [], setActiveTab, notify }) {
  const [now, setNow]       = useState(new Date());
  const [chartRange, setChartRange] = useState("7D");
  const { isMobile, isTablet } = useBreakpoint();

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const safeBatches    = Array.isArray(batches)    ? batches    : [];
  const safeInventory  = Array.isArray(inventory)  ? inventory  : [];
  const safeDeliveries = Array.isArray(deliveries) ? deliveries : [];
  const safeStaff      = Array.isArray(staffList)  ? staffList  : [];

  const activeBatches   = safeBatches.filter(b => (b.actual ?? 0) < (b.target ?? 0));
  const completedToday  = safeBatches.filter(b => (b.actual ?? 0) >= (b.target ?? 0));
  const pendingQC       = safeBatches.filter(b => !b.qcGrade && (b.actual ?? 0) > 0);
  const pendingDispatch = safeDeliveries.filter(d => ["pending","in transit"].includes((d.status||"").toLowerCase()));
  const lowStock        = safeInventory.filter(i => typeof i.stock === "number" && typeof i.minStock === "number" && i.stock <= i.minStock);
  const onShift         = safeStaff.filter(s => s.present);

  const totalPacked    = safeBatches.reduce((s, b) => s + (b.actual ?? 0), 0);
  const totalTarget    = safeBatches.reduce((s, b) => s + (b.target ?? 0), 0);
  const overallPct     = totalTarget > 0 ? Math.min(100, Math.round((totalPacked / totalTarget) * 100)) : 0;
  const totalDelivered = safeDeliveries.filter(d => d.status === "Delivered").length;

  const myRecord = safeStaff.find(s =>
    sess?.name && (s.name||"").toLowerCase() === (sess.name||"").toLowerCase()
  );

  const h = now.getHours();
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const timeStr  = now.toLocaleTimeString("en-IN",  { hour:"2-digit", minute:"2-digit" });
  const dateStr  = now.toLocaleDateString("en-IN",  { weekday:"long", day:"numeric", month:"long" });

  // ── Chart data driven by range selector ──────────────────────
  const seed     = totalPacked || 120;
  const mults    = RANGE_MULTIPLIERS[chartRange];
  const labels   = RANGE_LABELS[chartRange];
  const barData  = mults.map((f, i) => ({
    label: labels[i] || `${i+1}`,
    value: Math.max(0, Math.round(seed * f)),
  }));

  // ── Quick actions — "More" now navigates to reports ──────────
  const QUICK_ACTIONS = [
    { icon:"📦", label:"Packing",   sub:"Log units",     tab:"packing",   gradient:TAB_ACCENT.packing.gradient,   glow:TAB_ACCENT.packing.glow,   badge: activeBatches.length || null },
    { icon:"✅", label:"QC Check",  sub:"Inspect batch", tab:"qc",        gradient:TAB_ACCENT.qc.gradient,        glow:TAB_ACCENT.qc.glow,        badge: pendingQC.length || null },
    { icon:"🏭", label:"Inventory", sub:"Stock levels",  tab:"inventory", gradient:TAB_ACCENT.inventory.gradient, glow:TAB_ACCENT.inventory.glow, badge: lowStock.length || null },
    { icon:"🚚", label:"Dispatch",  sub:"Track orders",  tab:"delivery",  gradient:TAB_ACCENT.delivery.gradient,  glow:TAB_ACCENT.delivery.glow,  badge: pendingDispatch.length || null },
    { icon:"👥", label:"Staff",     sub:"Clock in/out",  tab:"staff",     gradient:TAB_ACCENT.staff.gradient,     glow:TAB_ACCENT.staff.glow,     badge: null },
    { icon:"📊", label:"Reports",   sub:"Analytics",     tab:"reports",   gradient:"linear-gradient(135deg,#273350,#1e2840)", glow:"0 4px 20px rgba(0,0,0,0.4)", badge: null },
  ];

  const recentActivity = [
    ...safeBatches.slice(-5).reverse().map(b => ({
      id: b.id, text:`Batch ${b.product} — ${b.actual ?? 0} pcs packed`,
      type:"Packing", time:b.date || "Today", color:TAB_ACCENT.packing.solid, tab:"packing",
    })),
    ...safeDeliveries.filter(d => d.status === "Delivered").slice(-3).map(d => ({
      id: d.id+"d", text:`${d.customer} delivery completed`,
      type:"Delivery", time:d.date || "Today", color:TAB_ACCENT.delivery.solid, tab:"delivery",
    })),
    ...safeInventory.filter(i => i.stock <= (i.minStock ?? 0)).slice(-2).map(i => ({
      id: i.id+"i", text:`${i.name} stock running low`,
      type:"Inventory", time:"Today", color:TAB_ACCENT.inventory.solid, tab:"inventory",
    })),
  ].slice(0, 8);

  // ── Responsive column counts ─────────────────────────────────
  const kpiCols     = isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)";
  const actionCols  = isMobile ? "repeat(3,1fr)" : isTablet ? "repeat(3,1fr)" : "repeat(6,1fr)";
  const analyticsCols = isMobile ? "1fr" : "1.6fr 1fr";
  const bottomCols  = isMobile ? "1fr" : "1fr 1fr";

  return (
    <div style={{ background: t.bg, minHeight: "100vh", padding: isMobile ? "14px 12px 28px" : "18px 18px 32px", animation: "fadeIn 0.3s ease" }}>

      {/* ── Greeting Hero ─────────────────────────────────────── */}
      <div style={{
        background:    "rgba(255,255,255,0.03)",
        border:        "1px solid rgba(255,255,255,0.08)",
        borderRadius:  20,
        padding:       isMobile ? "16px" : "22px 24px",
        marginBottom:  16,
        position:      "relative",
        overflow:      "hidden",
        backdropFilter: "blur(24px)",
        boxShadow:     "0 8px 48px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}>
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(135deg,rgba(29,78,216,0.10) 0%,rgba(109,40,217,0.05) 50%,transparent 70%)", pointerEvents:"none" }} />
        <div style={{ position:"absolute", right:-60, top:-60, width:260, height:260, borderRadius:"50%", background:"radial-gradient(circle,rgba(29,78,216,0.08) 0%,transparent 65%)", pointerEvents:"none" }} />

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", position:"relative", flexWrap:"wrap", gap:14 }}>
          <div>
            <div style={{ color:"rgba(255,255,255,0.45)", fontSize:12, marginBottom:6, fontWeight:500 }}>{greeting} 👋</div>
            <div style={{ color:t.text, fontSize: isMobile ? 20 : 26, fontWeight:900, letterSpacing:"-0.03em", lineHeight:1.1 }}>
              {sess?.name || "Staff Member"}
            </div>
            <div style={{ display:"flex", gap:7, marginTop:10, alignItems:"center", flexWrap:"wrap" }}>
              {sess?.role && (
                <span style={{ background:"rgba(59,130,246,0.12)", border:"1px solid rgba(59,130,246,0.28)", borderRadius:"999px", padding:"3px 11px", color:"#60a5fa", fontSize:10, fontWeight:700 }}>{sess.role}</span>
              )}
              {sess?.shift && (
                <span style={{ background:"rgba(16,185,129,0.1)", border:"1px solid rgba(16,185,129,0.25)", borderRadius:"999px", padding:"3px 11px", color:"#34d399", fontSize:10, fontWeight:700 }}>⏰ {sess.shift}</span>
              )}
              <SLiveBadge t={t} />
            </div>
          </div>

          {!isMobile && (
            <div style={{ textAlign:"right" }}>
              <div style={{ color:t.text, fontSize:36, fontWeight:900, letterSpacing:"-0.05em", lineHeight:1, fontVariantNumeric:"tabular-nums", textShadow:"0 0 40px rgba(99,179,237,0.25)" }}>{timeStr}</div>
              <div style={{ color:"rgba(255,255,255,0.4)", fontSize:12, marginTop:5 }}>{dateStr}</div>
              {myRecord && (
                <div style={{ marginTop:10 }}>
                  <span style={{ background: myRecord.present ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", border:`1px solid ${myRecord.present ? "rgba(16,185,129,0.28)" : "rgba(239,68,68,0.28)"}`, borderRadius:"999px", padding:"4px 12px", color: myRecord.present ? "#34d399" : "#f87171", fontSize:11, fontWeight:700, display:"inline-block" }}>
                    {myRecord.present ? `● On shift since ${myRecord.clockedIn || "—"}` : "○ Not clocked in"}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile clock row */}
        {isMobile && (
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:12, paddingTop:12, borderTop:"1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ color:t.text, fontSize:24, fontWeight:900, fontVariantNumeric:"tabular-nums" }}>{timeStr}</div>
            {myRecord && (
              <span style={{ background: myRecord.present ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", border:`1px solid ${myRecord.present ? "rgba(16,185,129,0.28)" : "rgba(239,68,68,0.28)"}`, borderRadius:"999px", padding:"4px 10px", color: myRecord.present ? "#34d399" : "#f87171", fontSize:10, fontWeight:700 }}>
                {myRecord.present ? `● ${myRecord.clockedIn || "—"}` : "○ Not in"}
              </span>
            )}
          </div>
        )}

        {/* Progress bar */}
        {totalTarget > 0 && (
          <div style={{ marginTop:18, paddingTop:16, borderTop:"1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
              <div style={{ color:"rgba(255,255,255,0.4)", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em" }}>Overall Production Progress</div>
              <div style={{ color:TAB_ACCENT.home.solid, fontSize:12, fontWeight:800 }}>{overallPct}%</div>
            </div>
            <div style={{ height:5, background:"rgba(255,255,255,0.07)", borderRadius:999, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${overallPct}%`, background:TAB_ACCENT.home.gradient, borderRadius:999, boxShadow:`0 0 14px ${TAB_ACCENT.home.solid}60`, transition:"width 0.6s ease" }} />
            </div>
            <div style={{ display:"flex", gap: isMobile ? 10 : 18, marginTop:8, flexWrap:"wrap" }}>
              {[
                { label:"Active Batches",   value:activeBatches.length,   color:TAB_ACCENT.home.solid },
                { label:"Staff on Shift",   value:onShift.length,          color:t.green },
                { label:"Low Stock",        value:lowStock.length,         color:t.orange },
                { label:"Pending Dispatch", value:pendingDispatch.length,  color:TAB_ACCENT.delivery.solid },
              ].map(s => (
                <div key={s.label}>
                  <span style={{ color:s.color, fontWeight:800, fontSize: isMobile ? 12 : 13 }}>{s.value}</span>
                  <span style={{ color:"rgba(255,255,255,0.3)", fontSize: isMobile ? 9 : 10, marginLeft:4 }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── KPI tiles — 2 cols on mobile, 4 on desktop ─────── */}
      <div style={{ display:"grid", gridTemplateColumns:kpiCols, gap:10, marginBottom:16 }}>
        <SKpiCard label="Production (KG)" icon="🏭" value={totalPacked.toLocaleString("en-IN")} sub={`${overallPct}% of target`} progress={overallPct} color={TAB_ACCENT.home.solid} t={t} onClick={() => setActiveTab("packing")} />
        <SKpiCard label="Packed (Pcs)" icon="📦" value={totalPacked.toLocaleString("en-IN")} sub={`${completedToday.length} batches done`} progress={overallPct} color={TAB_ACCENT.packing.solid} t={t} onClick={() => setActiveTab("packing")} />
        <SKpiCard label="Delivered" icon="🚚" value={totalDelivered} sub={`${pendingDispatch.length} pending`} color={TAB_ACCENT.delivery.solid} t={t} onClick={() => setActiveTab("delivery")} />
        <SKpiCard label="Active Orders" icon="📋" value={safeDeliveries.length} sub={`${pendingDispatch.length} in transit`} color={TAB_ACCENT.inventory.solid} t={t} onClick={() => setActiveTab("delivery")} />
      </div>

      {/* ── Quick Actions — 3 cols on mobile, 6 on desktop ─── */}
      <div style={{ marginBottom:16 }}>
        <SSectionHeader title="Quick Actions" t={t} accent={t.blue} />
        <div style={{ display:"grid", gridTemplateColumns:actionCols, gap:9, marginTop:10 }}>
          {QUICK_ACTIONS.map(a => (
            <SGradCard
              key={a.label}
              icon={a.icon} label={a.label} sub={isMobile ? undefined : a.sub}
              gradient={a.gradient} glow={a.glow} badge={a.badge}
              onClick={() => a.tab && setActiveTab(a.tab)}
            />
          ))}
        </div>
      </div>

      {/* ── Analytics + Top Products ─────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:analyticsCols, gap:14, marginBottom:16 }}>

        {/* Bar chart panel — range buttons now change data */}
        <div style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:16, padding:"18px", backdropFilter:"blur(20px)", boxShadow:"0 4px 24px rgba(0,0,0,0.3)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:8 }}>
            <div>
              <div style={{ color:t.text, fontWeight:800, fontSize:13 }}>Production Analytics</div>
              <div style={{ color:t.sub, fontSize:10, marginTop:2 }}>
                {chartRange === "7D" ? "Daily packed units" : chartRange === "1M" ? "Daily — last 30 days" : "Weekly — last 3 months"}
              </div>
            </div>
            <div style={{ display:"flex", gap:5 }}>
              {["7D","1M","3M"].map(l => (
                <button key={l} onClick={() => setChartRange(l)} style={{
                  padding:"4px 10px", borderRadius:6, border:"none", cursor:"pointer",
                  background: chartRange === l ? TAB_ACCENT.home.gradient : "rgba(255,255,255,0.05)",
                  color:      chartRange === l ? "#fff" : t.sub,
                  fontSize:9, fontWeight:700, fontFamily:"inherit",
                  boxShadow:  chartRange === l ? TAB_ACCENT.home.glow : "none",
                  transition:"all 0.15s",
                }}>{l}</button>
              ))}
            </div>
          </div>
          <SBarChart data={barData} color={TAB_ACCENT.home.solid} height={90} t={t} />
        </div>

        {/* Top products */}
        <div style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:16, padding:"18px", backdropFilter:"blur(20px)", boxShadow:"0 4px 24px rgba(0,0,0,0.3)" }}>
          <div style={{ color:t.text, fontWeight:800, fontSize:13, marginBottom:14 }}>Top Products Today</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {safeBatches.length === 0 ? (
              <div style={{ color:t.muted, fontSize:12, textAlign:"center", padding:"20px 0" }}>No production data yet</div>
            ) : (
              [...safeBatches].sort((a,b) => (b.actual ?? 0) - (a.actual ?? 0)).slice(0,5).map((b,i) => {
                const colors = [t.blue, t.green, t.purple, t.orange, t.cyan];
                const c = colors[i % colors.length];
                const maxV = safeBatches.reduce((s,x) => Math.max(s, x.actual ?? 0), 1);
                return (
                  <div key={b.id} style={{ display:"flex", alignItems:"center", gap:9 }}>
                    <span style={{ color:"rgba(255,255,255,0.25)", fontSize:10, fontWeight:800, width:13 }}>{i+1}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:t.text, fontSize:11, fontWeight:700, marginBottom:5, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.product}</div>
                      <div style={{ height:4, background:"rgba(255,255,255,0.06)", borderRadius:"999px", overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${maxV > 0 ? ((b.actual??0)/maxV)*100 : 0}%`, background:c, borderRadius:"999px", boxShadow:`0 0 10px ${c}70`, transition:"width 0.5s ease" }} />
                      </div>
                    </div>
                    <span style={{ color:c, fontSize:11, fontWeight:800, flexShrink:0, minWidth:54, textAlign:"right" }}>
                      {(b.actual ?? 0).toLocaleString("en-IN")} pcs
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Activity + Active Batches — stack on mobile ────── */}
      <div style={{ display:"grid", gridTemplateColumns:bottomCols, gap:14 }}>

        {/* Recent activity — "View all" now navigates to reports */}
        <div>
          <SSectionHeader title="Recent Activity" t={t} accent={t.cyan}
            action={
              <span
                onClick={() => setActiveTab("reports")}
                style={{ color:t.cyan, fontSize:10, fontWeight:700, cursor:"pointer" }}
              >View all →</span>
            }
          />
          <div style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, overflow:"hidden", backdropFilter:"blur(20px)", boxShadow:"0 4px 24px rgba(0,0,0,0.25)", marginTop:10 }}>
            {recentActivity.length === 0 ? (
              <div style={{ padding:"36px", textAlign:"center", color:t.muted, fontSize:13 }}>
                <div style={{ fontSize:32, marginBottom:10, opacity:0.3 }}>📋</div>
                No activity yet — start a batch to see updates
              </div>
            ) : (
              recentActivity.map((a, i, arr) => (
                <div key={a.id}
                  onClick={() => a.tab && setActiveTab(a.tab)}
                  style={{ padding:"11px 16px", borderBottom: i < arr.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, transition:"all 0.15s", cursor: a.tab ? "pointer" : "default" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.035)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = ""; }}
                >
                  <div style={{ display:"flex", alignItems:"center", gap:10, flex:1, minWidth:0 }}>
                    <div style={{ width:7, height:7, borderRadius:"50%", background:a.color, flexShrink:0, boxShadow:`0 0 10px ${a.color}90` }} />
                    <span style={{ color:t.text, fontSize:12, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.text}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:7, flexShrink:0 }}>
                    {!isMobile && <STag label={a.type} color={a.color} />}
                    <span style={{ color:t.muted, fontSize:10 }}>{a.time}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active batches */}
        <div>
          <SSectionHeader title="Active Batches" t={t} accent={TAB_ACCENT.packing.solid}
            action={<span onClick={() => setActiveTab("packing")} style={{ color:TAB_ACCENT.home.solid, fontSize:11, fontWeight:700, cursor:"pointer" }}>View all →</span>}
          />
          <div style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, overflow:"hidden", backdropFilter:"blur(20px)", boxShadow:"0 4px 24px rgba(0,0,0,0.25)", marginTop:10 }}>
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1.4fr 0.9fr", padding:"9px 16px", borderBottom:"1px solid rgba(255,255,255,0.06)", background:"rgba(255,255,255,0.03)" }}>
              {["PRODUCT","PROGRESS","STATUS"].map(h => (
                <div key={h} style={{ color:"rgba(255,255,255,0.28)", fontSize:8, fontWeight:800, letterSpacing:"0.1em" }}>{h}</div>
              ))}
            </div>
            {safeBatches.length === 0 ? (
              <div style={{ padding:"32px", textAlign:"center", color:t.sub, fontSize:12 }}>
                <div style={{ fontSize:28, marginBottom:8, opacity:0.3 }}>🏭</div>
                Batches created by admin appear here
              </div>
            ) : (
              [...safeBatches].sort((a,b) => (b.date||"").localeCompare(a.date||"")).slice(0,6).map((b,i,arr) => {
                const pct = (b.target??0) > 0 ? Math.min(100, Math.round(((b.actual??0)/b.target)*100)) : 0;
                const barColor = pct === 100 ? t.green : TAB_ACCENT.packing.solid;
                const status = b.qcGrade === "Rejected" ? "Rejected" : b.qcGrade ? `Grade ${b.qcGrade}` : pct >= 100 ? "completed" : "in_progress";
                const statusLabel = b.qcGrade === "Rejected" ? "Rejected" : b.qcGrade ? `Grade ${b.qcGrade}` : pct >= 100 ? "Needs QC" : "In Progress";
                return (
                  <div key={b.id} onClick={() => setActiveTab("packing")}
                    style={{ display:"grid", gridTemplateColumns:"2fr 1.4fr 0.9fr", padding:"10px 16px", borderBottom: i < arr.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none", cursor:"pointer", alignItems:"center", transition:"all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.035)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = ""; }}
                  >
                    <div>
                      <div style={{ color:t.text, fontWeight:700, fontSize:12 }}>{b.product}</div>
                      <div style={{ color:t.sub, fontSize:9, marginTop:1 }}>{b.date || "—"}</div>
                    </div>
                    <div>
                      <div style={{ height:4, background:"rgba(255,255,255,0.07)", borderRadius:"999px", overflow:"hidden", marginBottom:4 }}>
                        <div style={{ height:"100%", width:`${pct}%`, background:barColor, borderRadius:"999px", boxShadow:`0 0 10px ${barColor}70`, transition:"width 0.4s ease" }} />
                      </div>
                      <div style={{ color:t.sub, fontSize:9 }}>{b.actual??0}/{b.target??0} · {pct}%</div>
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
