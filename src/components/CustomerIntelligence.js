/* eslint-disable react-hooks/exhaustive-deps, no-unused-vars */
// ============================================================
// components/CustomerIntelligence.js  — #10
//
// Customer Relationship Intelligence panel.
// Drop into the Customer detail modal or Customers tab as a
// self-contained panel — reads all data from props, no context.
//
// Exports:
//   <CustomerIntelPanel   customer deliveries paymentLedger customers t dm inr />
//   <CustomerHealthBadge  customer deliveries churnDays t />
//   <CustomerIntelligenceTab  customers deliveries paymentLedger settings t dm inr setDetailModal />
//   useCustomerIntel(customer, deliveries, paymentLedger, churnDays)
// ============================================================

import React, { useState, useMemo } from "react";

// ── Scoring weights ───────────────────────────────────────────
const W = {
  recency:   0.30,  // how recently they ordered
  frequency: 0.25,  // how often they order per month
  monetary:  0.25,  // total spend
  payment:   0.20,  // how reliably they pay
};

// ── Core intel hook ───────────────────────────────────────────
export function useCustomerIntel(customer, deliveries = [], paymentLedger = [], churnDays = 14) {
  return useMemo(() => {
    if (!customer) return null;

    const cId    = customer.id;
    const cDelivs = deliveries.filter(d => d.customerId === cId);
    const cDone   = cDelivs.filter(d => d.status === "Delivered");
    const cPayments = paymentLedger.filter(p => p.customerId === cId || p.customerName === customer.name);

    // ── Revenue ──
    const revenue = cDone.reduce((s, d) => {
      return s + Object.values(d.orderLines || {}).reduce((ls, l) => ls + ((l.qty || 0) * (l.price || 0)), 0);
    }, 0);

    const orderCount   = cDelivs.length;
    const doneCount    = cDone.length;
    const avgOrderVal  = doneCount > 0 ? Math.round(revenue / doneCount) : 0;
    const cancelCount  = cDelivs.filter(d => d.status === "Cancelled").length;
    const cancelRate   = orderCount > 0 ? cancelCount / orderCount : 0;

    // ── Recency ──
    const sorted       = [...cDelivs].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const lastDelivery = sorted[0] || null;
    const daysSinceLast = lastDelivery
      ? Math.floor((Date.now() - new Date(lastDelivery.date).getTime()) / 86400000)
      : 999;

    // ── Frequency ──
    const joinDays = customer.joinDate
      ? Math.max(1, Math.floor((Date.now() - new Date(customer.joinDate).getTime()) / 86400000))
      : 90;
    const ordersPerMonth = orderCount > 0 ? (orderCount / (joinDays / 30)) : 0;

    // ── Payment reliability ──
    const totalBilled  = (customer.paid || 0) + (customer.pending || 0);
    const collectPct   = totalBilled > 0 ? (customer.paid || 0) / totalBilled : 1;
    const hasPending   = (customer.pending || 0) > 0;
    const overdueAmt   = customer.pending || 0;

    // ── CLV (3-month projection) ──
    const clv = Math.round(revenue + (avgOrderVal * ordersPerMonth * 3));

    // ── Relationship score (0–100) ──
    const recencyScore   = Math.max(0, 1 - daysSinceLast / (churnDays * 2));
    const freqScore      = Math.min(1, ordersPerMonth / 8);       // 8 orders/mo = perfect
    const monetaryScore  = Math.min(1, revenue / 200000);         // ₹2L = perfect
    const paymentScore   = collectPct;

    const score = Math.round(
      (recencyScore   * W.recency   +
       freqScore      * W.frequency +
       monetaryScore  * W.monetary  +
       paymentScore   * W.payment) * 100
    );

    // ── Health tier ──
    const isChurned = daysSinceLast > churnDays;
    const health =
      score >= 75 ? "champion"  :
      score >= 55 ? "loyal"     :
      score >= 35 ? "at-risk"   :
      isChurned   ? "churned"   : "new";

    // ── Smart suggestions ──
    const suggestions = [];
    if (isChurned)
      suggestions.push({ icon: "📞", text: `No order in ${daysSinceLast} days — follow up now`, level: "red" });
    if (hasPending && overdueAmt >= 1000)
      suggestions.push({ icon: "💳", text: `₹${overdueAmt.toLocaleString("en-IN")} outstanding — collect payment`, level: "amber" });
    if (cancelRate > 0.2)
      suggestions.push({ icon: "⚠️", text: `${Math.round(cancelRate * 100)}% cancellation rate — check preference`, level: "amber" });
    if (ordersPerMonth >= 4 && !hasPending)
      suggestions.push({ icon: "🌟", text: "High-frequency reliable customer — consider loyalty pricing", level: "green" });
    if (avgOrderVal > 5000)
      suggestions.push({ icon: "💎", text: "High-value orders — prioritise for festive/seasonal outreach", level: "blue" });
    if (score >= 75)
      suggestions.push({ icon: "🏆", text: "Champion customer — perfect for referral asks", level: "green" });

    // ── Order trend (last 4 weeks) ──
    const weeks = [0, 1, 2, 3].map(w => {
      const from = new Date(); from.setDate(from.getDate() - (w + 1) * 7);
      const to   = new Date(); to.setDate(to.getDate() - w * 7);
      return cDelivs.filter(d => {
        const dt = new Date(d.date);
        return dt >= from && dt < to;
      }).length;
    }).reverse();

    // ── Product preferences ──
    const prodCount = {};
    cDone.forEach(d => {
      Object.values(d.orderLines || {}).forEach(l => {
        if (l.qty > 0) {
          const name = l.name || "Unknown";
          prodCount[name] = (prodCount[name] || 0) + l.qty;
        }
      });
    });
    const topProducts = Object.entries(prodCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name, qty]) => ({ name, qty }));

    // ── Preferred day ──
    const dayCounts = {};
    cDelivs.forEach(d => {
      const day = new Date(d.date).toLocaleDateString("en-IN", { weekday: "short" });
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    const preferredDay = Object.entries(dayCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || null;

    return {
      revenue, orderCount, doneCount, avgOrderVal, cancelRate, cancelCount,
      daysSinceLast, lastDelivery, ordersPerMonth, joinDays,
      collectPct, hasPending, overdueAmt,
      clv, score, health, suggestions,
      weeks, topProducts, preferredDay,
      recencyScore, freqScore, monetaryScore, paymentScore,
    };
  }, [customer?.id, deliveries.length, paymentLedger.length, churnDays]);
}

// ── Health tier metadata ──────────────────────────────────────
const HEALTH_META = {
  champion: { label: "Champion",  color: "#10b981", bg: "#10b98115", icon: "🏆", desc: "High value, high frequency, pays well" },
  loyal:    { label: "Loyal",     color: "#3b82f6", bg: "#3b82f615", icon: "⭐", desc: "Regular customer, good relationship"  },
  "at-risk":{ label: "At Risk",   color: "#f59e0b", bg: "#f59e0b15", icon: "⚠️", desc: "Slowing down — needs attention"        },
  churned:  { label: "Churned",   color: "#ef4444", bg: "#ef444415", icon: "💤", desc: "No recent orders — follow up urgently" },
  new:      { label: "New",       color: "#8b5cf6", bg: "#8b5cf615", icon: "🌱", desc: "New customer — build the relationship" },
};

// ── Inline badge ─────────────────────────────────────────────
export function CustomerHealthBadge({ customer, deliveries, churnDays = 14, t }) {
  const intel = useCustomerIntel(customer, deliveries, [], churnDays);
  if (!intel) return null;
  const meta = HEALTH_META[intel.health];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: meta.bg, color: meta.color,
      border: `1px solid ${meta.color}30`,
      borderRadius: 99, padding: "3px 10px",
      fontSize: 11, fontWeight: 700,
    }}>
      {meta.icon} {meta.label}
    </span>
  );
}

// ── Score ring ───────────────────────────────────────────────
function ScoreRing({ score, color, size = 72 }) {
  const r = size / 2 - 6;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`${color}18`} strokeWidth={6} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
    </svg>
  );
}

// ── Mini bar chart ────────────────────────────────────────────
function MiniBarChart({ weeks, color }) {
  const max = Math.max(...weeks, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 28 }}>
      {weeks.map((v, i) => (
        <div key={i} style={{
          flex: 1, borderRadius: 3,
          background: i === weeks.length - 1 ? color : `${color}50`,
          height: `${Math.round((v / max) * 100)}%`,
          minHeight: 3,
          transition: "height 0.4s ease",
        }} />
      ))}
    </div>
  );
}

// ── Main Intel Panel ──────────────────────────────────────────
export function CustomerIntelPanel({ customer, deliveries, paymentLedger, customers, t, dm, inr, churnDays = 14 }) {
  const intel = useCustomerIntel(customer, deliveries, paymentLedger, churnDays);
  const [expanded, setExpanded] = useState(false);

  const sub    = t?.sub    || "#9ca3af";
  const muted  = t?.muted  || "#6b7280";
  const border = t?.border || "rgba(255,255,255,0.08)";
  const text   = t?.text   || "#f9fafb";
  const inp    = t?.inp    || "rgba(255,255,255,0.05)";
  const card   = t?.card   || (dm ? "#1a2332" : "#fff");

  if (!intel) return null;

  const meta      = HEALTH_META[intel.health];
  const inrFmt    = inr || (n => `₹${n.toLocaleString("en-IN")}`);

  // Score breakdown bars
  const breakdown = [
    { label: "Recency",   val: intel.recencyScore,   color: "#10b981" },
    { label: "Frequency", val: intel.freqScore,       color: "#3b82f6" },
    { label: "Spend",     val: intel.monetaryScore,   color: "#8b5cf6" },
    { label: "Payment",   val: intel.paymentScore,    color: "#f59e0b" },
  ];

  return (
    <div style={{ margin: "16px 0 8px" }}>
      {/* Section label */}
      <p style={{ color: sub, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
        Customer Intelligence
      </p>

      {/* Health header card */}
      <div style={{
        background: meta.bg,
        border: `1px solid ${meta.color}25`,
        borderRadius: 16, padding: "14px 16px",
        display: "flex", alignItems: "center", gap: 14,
        marginBottom: 10,
      }}>
        {/* Score ring */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <ScoreRing score={intel.score} color={meta.color} size={68} />
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{meta.icon}</span>
            <span style={{ color: meta.color, fontWeight: 900, fontSize: 15, lineHeight: 1, marginTop: 2 }}>{intel.score}</span>
          </div>
        </div>

        {/* Health info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ color: meta.color, fontWeight: 800, fontSize: 14 }}>{meta.label}</span>
            <span style={{ color: sub, fontSize: 10 }}>· {meta.desc}</span>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
            <div>
              <p style={{ color: muted, fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>CLV (3mo)</p>
              <p style={{ color: text, fontWeight: 800, fontSize: 13 }}>{inrFmt(intel.clv)}</p>
            </div>
            <div>
              <p style={{ color: muted, fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>Orders/mo</p>
              <p style={{ color: text, fontWeight: 800, fontSize: 13 }}>{intel.ordersPerMonth.toFixed(1)}</p>
            </div>
            <div>
              <p style={{ color: muted, fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>Avg value</p>
              <p style={{ color: text, fontWeight: 800, fontSize: 13 }}>{inrFmt(intel.avgOrderVal)}</p>
            </div>
            {intel.daysSinceLast < 999 && (
              <div>
                <p style={{ color: muted, fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>Last order</p>
                <p style={{ color: intel.daysSinceLast > churnDays ? "#ef4444" : text, fontWeight: 800, fontSize: 13 }}>
                  {intel.daysSinceLast === 0 ? "Today" : `${intel.daysSinceLast}d ago`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Score breakdown */}
      <div style={{ background: inp, border: `1px solid ${border}`, borderRadius: 14, padding: "12px 14px", marginBottom: 10 }}>
        <p style={{ color: sub, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
          Score Breakdown
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {breakdown.map(b => (
            <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: muted, fontSize: 10, width: 62, flexShrink: 0 }}>{b.label}</span>
              <div style={{ flex: 1, height: 5, borderRadius: 3, background: border, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 3,
                  background: b.color,
                  width: `${Math.round(b.val * 100)}%`,
                  transition: "width 0.6s ease",
                }} />
              </div>
              <span style={{ color: text, fontSize: 10, fontWeight: 700, width: 26, textAlign: "right", flexShrink: 0 }}>
                {Math.round(b.val * 100)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Suggestions */}
      {intel.suggestions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {intel.suggestions.map((s, i) => {
            const lvlColor = { red: "#ef4444", amber: "#f59e0b", green: "#10b981", blue: "#3b82f6" }[s.level] || "#6b7280";
            return (
              <div key={i} style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                background: `${lvlColor}0d`, border: `1px solid ${lvlColor}25`,
                borderRadius: 10, padding: "8px 12px",
              }}>
                <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
                <span style={{ color: text, fontSize: 11, lineHeight: 1.4 }}>{s.text}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Expand for more stats */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: "100%", background: "transparent", border: `1px solid ${border}`,
          borderRadius: 10, padding: "7px 12px",
          color: sub, fontSize: 11, fontWeight: 600, cursor: "pointer",
          textAlign: "center", marginBottom: expanded ? 10 : 0,
        }}
        onMouseEnter={e => e.currentTarget.style.background = inp}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        {expanded ? "← Less detail" : "More detail →"}
      </button>

      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Order trend */}
          <div style={{ background: inp, border: `1px solid ${border}`, borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <p style={{ color: sub, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Order Trend — last 4 weeks
              </p>
              <span style={{ color: muted, fontSize: 9 }}>{intel.orderCount} total orders</span>
            </div>
            <MiniBarChart weeks={intel.weeks} color={meta.color} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              {["4w ago", "3w ago", "2w ago", "This week"].map(l => (
                <span key={l} style={{ color: muted, fontSize: 8 }}>{l}</span>
              ))}
            </div>
          </div>

          {/* Top products */}
          {intel.topProducts.length > 0 && (
            <div style={{ background: inp, border: `1px solid ${border}`, borderRadius: 14, padding: "12px 14px" }}>
              <p style={{ color: sub, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                Top Products
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {intel.topProducts.map((p, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: text, fontSize: 11 }}>{p.name}</span>
                    <span style={{ color: sub, fontSize: 10, fontWeight: 700 }}>{p.qty} units</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extra stats grid */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}>
            {[
              { label: "Total Revenue", val: inrFmt(intel.revenue) },
              { label: "Cancellation Rate", val: `${Math.round(intel.cancelRate * 100)}%` },
              { label: "Payment Rate", val: `${Math.round(intel.collectPct * 100)}%` },
              { label: "Preferred Day", val: intel.preferredDay || "—" },
              { label: "Customer Since", val: customer.joinDate ? new Date(customer.joinDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—" },
              { label: "Pending Amt", val: inrFmt(intel.overdueAmt), highlight: intel.hasPending },
            ].map(({ label, val, highlight }) => (
              <div key={label} style={{ background: inp, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 12px" }}>
                <p style={{ color: muted, fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>{label}</p>
                <p style={{ color: highlight ? "#ef4444" : text, fontWeight: 800, fontSize: 13, marginTop: 3 }}>{val}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Full Intelligence Tab — drop into Customers tab ───────────
export function CustomerIntelligenceTab({
  customers = [], deliveries = [], paymentLedger = [],
  settings, t, dm, inr, setDetailModal,
}) {
  const [search, setSearch]   = useState("");
  const [sortBy, setSortBy]   = useState("score");
  const [filter, setFilter]   = useState("all");
  const churnDays = settings?.churnDays ?? 14;

  const sub    = t?.sub    || "#9ca3af";
  const muted  = t?.muted  || "#6b7280";
  const border = t?.border || "rgba(255,255,255,0.08)";
  const text   = t?.text   || "#f9fafb";
  const inp    = t?.inp    || "rgba(255,255,255,0.05)";
  const inrFmt = inr || (n => `₹${n.toLocaleString("en-IN")}`);

  const intelData = useMemo(() => {
    return customers
      .filter(c => c.active !== false)
      .map(c => ({
        customer: c,
        intel: (() => {
          // Inline the key stats (avoid calling hook in loop — compute directly)
          const cDelivs = deliveries.filter(d => d.customerId === c.id);
          const cDone   = cDelivs.filter(d => d.status === "Delivered");
          const revenue = cDone.reduce((s, d) =>
            s + Object.values(d.orderLines || {}).reduce((ls, l) => ls + ((l.qty || 0) * (l.price || 0)), 0), 0);
          const orderCount  = cDelivs.length;
          const doneCount   = cDone.length;
          const avgOrderVal = doneCount > 0 ? Math.round(revenue / doneCount) : 0;
          const sorted      = [...cDelivs].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
          const lastD       = sorted[0] || null;
          const daysSinceLast = lastD ? Math.floor((Date.now() - new Date(lastD.date).getTime()) / 86400000) : 999;
          const joinDays    = c.joinDate ? Math.max(1, Math.floor((Date.now() - new Date(c.joinDate).getTime()) / 86400000)) : 90;
          const ordersPerMonth = orderCount > 0 ? orderCount / (joinDays / 30) : 0;
          const totalBilled = (c.paid || 0) + (c.pending || 0);
          const collectPct  = totalBilled > 0 ? (c.paid || 0) / totalBilled : 1;
          const clv         = Math.round(revenue + (avgOrderVal * ordersPerMonth * 3));
          const rScore      = Math.max(0, 1 - daysSinceLast / (churnDays * 2));
          const fScore      = Math.min(1, ordersPerMonth / 8);
          const mScore      = Math.min(1, revenue / 200000);
          const pScore      = collectPct;
          const score       = Math.round((rScore * W.recency + fScore * W.frequency + mScore * W.monetary + pScore * W.payment) * 100);
          const isChurned   = daysSinceLast > churnDays;
          const health      = score >= 75 ? "champion" : score >= 55 ? "loyal" : score >= 35 ? "at-risk" : isChurned ? "churned" : "new";
          return { revenue, orderCount, avgOrderVal, daysSinceLast, ordersPerMonth, clv, score, health, collectPct, pending: c.pending || 0 };
        })(),
      }))
      .filter(({ customer, intel }) => {
        const q = search.toLowerCase();
        const matchSearch = !q || customer.name?.toLowerCase().includes(q) || customer.phone?.includes(q);
        const matchFilter = filter === "all" || intel.health === filter;
        return matchSearch && matchFilter;
      })
      .sort((a, b) => {
        if (sortBy === "score")   return b.intel.score - a.intel.score;
        if (sortBy === "clv")     return b.intel.clv - a.intel.clv;
        if (sortBy === "revenue") return b.intel.revenue - a.intel.revenue;
        if (sortBy === "recent")  return a.intel.daysSinceLast - b.intel.daysSinceLast;
        if (sortBy === "pending") return b.intel.pending - a.intel.pending;
        return 0;
      });
  }, [customers, deliveries, paymentLedger, search, sortBy, filter, churnDays]);

  // ── Aggregate stats ──
  const totals = useMemo(() => {
    const all = intelData.map(d => d.intel);
    return {
      champions:  all.filter(i => i.health === "champion").length,
      loyal:      all.filter(i => i.health === "loyal").length,
      atRisk:     all.filter(i => i.health === "at-risk").length,
      churned:    all.filter(i => i.health === "churned").length,
      avgScore:   all.length > 0 ? Math.round(all.reduce((s, i) => s + i.score, 0) / all.length) : 0,
      totalCLV:   all.reduce((s, i) => s + i.clv, 0),
    };
  }, [intelData]);

  const FILTERS = [
    { id: "all",       label: "All",       count: intelData.length },
    { id: "champion",  label: "🏆 Champions", count: totals.champions },
    { id: "loyal",     label: "⭐ Loyal",    count: totals.loyal     },
    { id: "at-risk",   label: "⚠️ At Risk",  count: totals.atRisk    },
    { id: "churned",   label: "💤 Churned",  count: totals.churned   },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Summary stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
        {[
          { label: "Avg Health Score", val: `${totals.avgScore}/100`,   color: "#10b981" },
          { label: "Champions",        val: totals.champions,            color: "#10b981" },
          { label: "At Risk / Churned",val: totals.atRisk + totals.churned, color: "#ef4444" },
          { label: "Portfolio CLV",    val: inrFmt(totals.totalCLV),    color: "#8b5cf6" },
        ].map(s => (
          <div key={s.label} style={{
            background: `${s.color}0d`, border: `1px solid ${s.color}25`,
            borderRadius: 14, padding: "12px 14px",
          }}>
            <p style={{ color: muted, fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>{s.label}</p>
            <p style={{ color: s.color, fontWeight: 900, fontSize: 20, marginTop: 4 }}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Search + sort */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search customers…"
          style={{
            flex: 1, minWidth: 160, background: inp, border: `1px solid ${border}`,
            borderRadius: 10, padding: "8px 12px", color: text, fontSize: 12,
            outline: "none",
          }}
        />
        <select
          value={sortBy} onChange={e => setSortBy(e.target.value)}
          style={{
            background: inp, border: `1px solid ${border}`, borderRadius: 10,
            padding: "8px 10px", color: text, fontSize: 12, outline: "none",
          }}
        >
          <option value="score">Sort: Score</option>
          <option value="clv">Sort: CLV</option>
          <option value="revenue">Sort: Revenue</option>
          <option value="recent">Sort: Recent</option>
          <option value="pending">Sort: Pending</option>
        </select>
      </div>

      {/* Filter pills */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              background: filter === f.id ? (HEALTH_META[f.id]?.color || "#3b82f6") + "20" : inp,
              border: `1px solid ${filter === f.id ? (HEALTH_META[f.id]?.color || "#3b82f6") + "40" : border}`,
              color: filter === f.id ? (HEALTH_META[f.id]?.color || "#3b82f6") : sub,
              borderRadius: 99, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
            }}
          >
            {f.label} {f.count > 0 && <span style={{ opacity: 0.7 }}>({f.count})</span>}
          </button>
        ))}
      </div>

      {/* Customer rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {intelData.map(({ customer, intel }) => {
          const meta = HEALTH_META[intel.health];
          return (
            <div
              key={customer.id}
              onClick={() => setDetailModal?.({ type: "customer", id: customer.id })}
              style={{
                background: inp, border: `1px solid ${border}`, borderRadius: 14,
                padding: "12px 14px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 12,
                transition: "border-color 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = meta.color + "40"}
              onMouseLeave={e => e.currentTarget.style.borderColor = border}
            >
              {/* Score ring mini */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <ScoreRing score={intel.score} color={meta.color} size={44} />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: meta.color, fontWeight: 900, fontSize: 11 }}>{intel.score}</span>
                </div>
              </div>

              {/* Name + health */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ color: text, fontWeight: 700, fontSize: 13 }}>{customer.name}</span>
                  <span style={{
                    background: meta.bg, color: meta.color,
                    border: `1px solid ${meta.color}25`,
                    borderRadius: 99, padding: "1px 7px", fontSize: 9, fontWeight: 700,
                  }}>{meta.icon} {meta.label}</span>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 3, flexWrap: "wrap" }}>
                  <span style={{ color: muted, fontSize: 10 }}>{intel.orderCount} orders</span>
                  <span style={{ color: muted, fontSize: 10 }}>·</span>
                  <span style={{ color: muted, fontSize: 10 }}>
                    {intel.daysSinceLast < 999
                      ? intel.daysSinceLast === 0 ? "ordered today" : `${intel.daysSinceLast}d ago`
                      : "no orders yet"}
                  </span>
                  {intel.pending > 0 && <>
                    <span style={{ color: muted, fontSize: 10 }}>·</span>
                    <span style={{ color: "#ef4444", fontSize: 10, fontWeight: 700 }}>{inrFmt(intel.pending)} due</span>
                  </>}
                </div>
              </div>

              {/* CLV */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ color: muted, fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>CLV</p>
                <p style={{ color: text, fontWeight: 800, fontSize: 13 }}>{inrFmt(intel.clv)}</p>
              </div>
            </div>
          );
        })}

        {intelData.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 0", color: muted, fontSize: 12 }}>
            No customers match this filter
          </div>
        )}
      </div>
    </div>
  );
}
