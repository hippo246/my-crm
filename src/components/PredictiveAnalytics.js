/* eslint-disable react-hooks/exhaustive-deps */
// ============================================================
// components/PredictiveAnalytics.js  — Feature #19
//
// Client-side ML predictions from your existing CRM data.
// No external APIs. All logic runs in the browser from
// deliveries, supplies, expenses, wastage, and customers.
//
// ── Predictions provided ─────────────────────────────────────
//   1. Demand Forecast     — per-product daily avg, trend, 7/14/30d projection
//   2. Churn Risk          — per-customer risk score + reason labels
//   3. Stock Prediction    — days-until-stockout per supply item
//   4. Revenue Forecast    — next 7d revenue estimate with confidence band
//   5. Overdue Risk        — customers likely to pay late based on history
//
// ── Components ───────────────────────────────────────────────
//   usePredictions(data)                — main computation hook
//   <PredictivePanel />                 — full dashboard panel
//   <DemandForecastCard />              — per-product projection
//   <ChurnRiskTable />                  — sorted risk table
//   <StockOutAlert />                   — "X will run out in N days"
//   <RevenueForecastCard />             — next-7d sparkline
//
// ── Wiring into CRM.js ───────────────────────────────────────
//   1. Import:
//        import { usePredictions, PredictivePanel }
//          from "./components/PredictiveAnalytics";
//
//   2. In CRM body (after data is loaded):
//        const predictions = usePredictions({
//          deliveries, customers, supplies, expenses,
//          wastage, products, paymentLedger, settings,
//        });
//
//   3. In Analytics tab or Dashboard:
//        <PredictivePanel predictions={predictions} dm={dm} t={t}
//          products={products} customers={customers}
//          supplies={supplies} settings={settings} />
//
//   4. Optional — show stockout alert in Supplies tab header:
//        <StockOutAlert predictions={predictions} dm={dm} t={t} />
//
//   5. Optional — show churn warnings in Customers tab:
//        <ChurnRiskTable predictions={predictions} dm={dm} t={t}
//          onSelectCustomer={(c) => { ... }} />
//
// ============================================================

import React, { useMemo, useState } from "react";

// ── Utilities ─────────────────────────────────────────────────
function safeArr(v) { return Array.isArray(v) ? v : []; }

function dateStr(daysOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

/** Simple linear regression — returns { slope, intercept, r2 } */
function linReg(xs, ys) {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] || 0, r2: 0 };
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    num  += (xs[i] - mx) * (ys[i] - my);
    denX += (xs[i] - mx) ** 2;
    denY += (ys[i] - my) ** 2;
  }
  const slope     = denX === 0 ? 0 : num / denX;
  const intercept = my - slope * mx;
  const r2        = (denX === 0 || denY === 0) ? 0 : (num ** 2) / (denX * denY);
  return { slope, intercept, r2 };
}

/** Rolling average over last N days */
function rollingAvg(dailyMap, days) {
  let sum = 0, count = 0;
  for (let i = 1; i <= days; i++) {
    const v = dailyMap[dateStr(-i)];
    if (v != null) { sum += v; count++; }
  }
  return count > 0 ? sum / count : 0;
}

// ── Core computation hook ─────────────────────────────────────
/**
 * usePredictions
 * Memoizes all forecasts — only recomputes when data changes.
 * Returns the full predictions object consumed by all sub-components.
 */
export function usePredictions({
  deliveries = [],
  customers  = [],
  supplies   = [],
  expenses   = [],
  wastage    = [],
  products   = [],
  paymentLedger = [],
  settings   = {},
}) {
  return useMemo(() => {
    const today = dateStr(0);

    // ── 1. DEMAND FORECAST ─────────────────────────────────────
    // For each product: daily qty sold, 7d avg, 14d avg, trend (slope), 7d projection
    const prodMap = {};  // productId → { name, daily: {date: qty}, ... }
    for (const p of safeArr(products)) {
      prodMap[p.id] = { id: p.id, name: p.name, unit: p.unit, daily: {} };
    }

    for (const d of safeArr(deliveries)) {
      if (d.status !== "Delivered") continue;
      const lines = d.orderLines || {};
      for (const [pid, line] of Object.entries(lines)) {
        if (!line || !line.qty || line.qty <= 0) continue;
        if (!prodMap[pid]) prodMap[pid] = { id: pid, name: line.name || pid, unit: "", daily: {} };
        const dt = d.date || today;
        prodMap[pid].daily[dt] = (prodMap[pid].daily[dt] || 0) + line.qty;
      }
    }

    const demandForecasts = Object.values(prodMap).map(p => {
      const daily = p.daily;
      const allDates = Object.keys(daily).sort();
      if (allDates.length < 3) return null;

      const avg7   = rollingAvg(daily, 7);
      const avg14  = rollingAvg(daily, 14);
      const avg30  = rollingAvg(daily, 30);

      // Linear trend over last 30 data points
      const recentDates = allDates.slice(-30);
      const xs = recentDates.map((_, i) => i);
      const ys = recentDates.map(dt => daily[dt] || 0);
      const { slope, r2 } = linReg(xs, ys);

      // 7d projection — use trend if r2 > 0.3, else use avg7
      const baseQty = r2 > 0.3 ? Math.max(0, avg7 + slope * 3.5) : avg7;
      const proj7d  = Math.round(baseQty * 7);
      const proj14d = Math.round((r2 > 0.3 ? Math.max(0, avg7 + slope * 7) : avg7) * 14);

      // Trend direction
      const trendPct = avg14 > 0 ? Math.round((avg7 - avg14) / avg14 * 100) : 0;
      const trend    = trendPct > 5 ? "up" : trendPct < -5 ? "down" : "flat";

      // Last 7 days for sparkline
      const spark = Array.from({ length: 7 }, (_, i) => ({
        date: dateStr(i - 6),
        qty:  daily[dateStr(i - 6)] || 0,
      }));

      return { id: p.id, name: p.name, unit: p.unit, avg7, avg14, avg30, proj7d, proj14d, trend, trendPct, spark, r2 };
    }).filter(Boolean).sort((a, b) => b.avg7 - a.avg7);

    // ── 2. CHURN RISK ──────────────────────────────────────────
    const churnDays = settings?.churnDays ?? 14;
    // Last delivery date per customer
    const lastDelivMap = {};
    const orderCountMap = {};
    const totalSpentMap = {};

    for (const d of safeArr(deliveries)) {
      if (!d.customerId) continue;
      if (!lastDelivMap[d.customerId] || d.date > lastDelivMap[d.customerId]) {
        lastDelivMap[d.customerId] = d.date;
      }
      orderCountMap[d.customerId] = (orderCountMap[d.customerId] || 0) + 1;
      if (d.status === "Delivered") {
        const amt = Object.values(d.orderLines || {}).reduce((s, l) => s + (l.qty || 0) * (l.priceAmount || 0), 0);
        totalSpentMap[d.customerId] = (totalSpentMap[d.customerId] || 0) + amt;
      }
    }

    // Payment delay history per customer
    const payDelay = {}; // customerId → average days late (crude: compare delivery date to payment date)
    for (const pay of safeArr(paymentLedger)) {
      if (!pay.customerId || !pay.date) continue;
      // Approximate: find closest delivery before payment
      const custDelivs = safeArr(deliveries).filter(d => d.customerId === pay.customerId && d.date <= pay.date);
      if (custDelivs.length === 0) continue;
      const closest = custDelivs.sort((a, b) => b.date.localeCompare(a.date))[0];
      const gap = daysBetween(closest.date, pay.date);
      payDelay[pay.customerId] = payDelay[pay.customerId]
        ? (payDelay[pay.customerId] + gap) / 2
        : gap;
    }

    const churnRisks = safeArr(customers)
      .filter(c => c.active)
      .map(c => {
        const last        = lastDelivMap[c.id];
        const daysSince   = last ? daysBetween(last, today) : (c.joinDate ? daysBetween(c.joinDate, today) : 999);
        const orderCount  = orderCountMap[c.id] || 0;
        const totalSpent  = totalSpentMap[c.id] || 0;
        const avgPayDelay = payDelay[c.id] || 0;
        const pendingAmt  = c.pending || 0;

        // Score 0–100: higher = more at risk
        let score = 0;
        const reasons = [];

        // Days since last order (heaviest signal)
        if (daysSince >= churnDays * 2) { score += 40; reasons.push(`No orders in ${daysSince}d`); }
        else if (daysSince >= churnDays) { score += 25; reasons.push(`Inactive ${daysSince}d`); }
        else if (daysSince >= churnDays * 0.7) { score += 10; reasons.push("Order frequency dropping"); }

        // Low order count
        if (orderCount < 3) { score += 15; reasons.push("Few orders ever"); }

        // High pending balance (financial friction = churn signal)
        if (pendingAmt > 0 && totalSpent > 0 && pendingAmt / totalSpent > 0.5) {
          score += 15; reasons.push("High outstanding balance");
        }

        // Late payer
        if (avgPayDelay > 10) { score += 10; reasons.push(`Avg ${Math.round(avgPayDelay)}d payment delay`); }

        // No orders at all
        if (!last) { score += 20; reasons.push("Never ordered"); }

        const risk = score >= 60 ? "high" : score >= 30 ? "medium" : "low";
        return { id: c.id, name: c.name, phone: c.phone, score, risk, reasons, daysSince, orderCount, totalSpent, pendingAmt };
      })
      .sort((a, b) => b.score - a.score);

    const highRisk   = churnRisks.filter(c => c.risk === "high");
    const mediumRisk = churnRisks.filter(c => c.risk === "medium");

    // ── 3. STOCK PREDICTIONS ───────────────────────────────────
    // Daily consumption rate per supply item (from ingredient logs + wastage)
    const consumptionMap = {}; // itemName.lower → { totalQty, days }

    for (const w of safeArr(wastage)) {
      const key = (w.product || "").toLowerCase();
      if (!key) continue;
      consumptionMap[key] = consumptionMap[key] || { total: 0, firstDate: w.date, lastDate: w.date };
      consumptionMap[key].total += w.qty || 0;
      if (w.date < consumptionMap[key].firstDate) consumptionMap[key].firstDate = w.date;
      if (w.date > consumptionMap[key].lastDate)  consumptionMap[key].lastDate  = w.date;
    }

    const stockPredictions = safeArr(supplies)
      .filter(s => !s.deleted && s.item && s.qty != null)
      .map(s => {
        const key  = (s.item || "").toLowerCase();
        const cons = consumptionMap[key];
        const qty  = s.qty || 0;
        const minStock = s.minStock || 0;

        let dailyConsumption = null;
        if (cons && cons.lastDate !== cons.firstDate) {
          const span = daysBetween(cons.firstDate, cons.lastDate) || 1;
          dailyConsumption = cons.total / span;
        }

        const daysLeft = dailyConsumption > 0 ? Math.floor(qty / dailyConsumption) : null;
        const daysToMin = (dailyConsumption > 0 && qty > minStock)
          ? Math.floor((qty - minStock) / dailyConsumption) : null;

        const urgency = daysLeft == null ? "unknown"
          : daysLeft <= 3   ? "critical"
          : daysLeft <= 7   ? "warning"
          : daysLeft <= 14  ? "low"
          : "ok";

        const reorderDate = daysToMin != null ? dateStr(daysToMin) : null;

        return {
          id: s.id, item: s.item, qty, unit: s.unit, minStock,
          dailyConsumption, daysLeft, daysToMin, reorderDate, urgency,
          supplier: s.supplier,
        };
      })
      .sort((a, b) => {
        const order = { critical: 0, warning: 1, low: 2, unknown: 3, ok: 4 };
        return (order[a.urgency] || 5) - (order[b.urgency] || 5);
      });

    const criticalStock = stockPredictions.filter(s => s.urgency === "critical");
    const warningStock  = stockPredictions.filter(s => s.urgency === "warning");

    // ── 4. REVENUE FORECAST ────────────────────────────────────
    // Daily revenue for last 30d → project next 7d
    const revByDay = {};
    for (const d of safeArr(deliveries)) {
      if (d.status !== "Delivered" || !d.date) continue;
      const amt = Object.values(d.orderLines || {}).reduce((s, l) => s + (l.qty || 0) * (l.priceAmount || 0), 0);
      revByDay[d.date] = (revByDay[d.date] || 0) + amt;
    }

    const rev30Days = Array.from({ length: 30 }, (_, i) => dateStr(i - 29));
    const xs30 = rev30Days.map((_, i) => i);
    const ys30 = rev30Days.map(dt => revByDay[dt] || 0);
    const { slope: revSlope, intercept: revInt, r2: revR2 } = linReg(xs30, ys30);

    const rev7Avg = rollingAvg(revByDay, 7);
    const rev14Avg = rollingAvg(revByDay, 14);

    const revForecast = Array.from({ length: 7 }, (_, i) => {
      const dayIdx = 30 + i;
      const trendVal = Math.max(0, revSlope * dayIdx + revInt);
      // Blend trend + recent avg
      const base = revR2 > 0.25 ? trendVal * 0.6 + rev7Avg * 0.4 : rev7Avg;
      const confidence = revR2 > 0.4 ? 0.15 : 0.30; // ±15% or ±30%
      return {
        date:  dateStr(i + 1),
        value: Math.round(base),
        low:   Math.round(base * (1 - confidence)),
        high:  Math.round(base * (1 + confidence)),
      };
    });

    const totalForecast7d = revForecast.reduce((s, d) => s + d.value, 0);
    const forecastVsLast7 = rev7Avg > 0
      ? Math.round((totalForecast7d / (rev7Avg * 7) - 1) * 100) : 0;

    // ── 5. OVERDUE PAYMENT RISK ────────────────────────────────
    const overdueRisk = safeArr(customers)
      .filter(c => c.active && (c.pending || 0) > 0)
      .map(c => {
        const avgDelay  = payDelay[c.id] || 0;
        const pendingAmt = c.pending || 0;
        const orderCount = orderCountMap[c.id] || 1;
        const riskScore  = Math.min(100, avgDelay * 3 + (pendingAmt > 5000 ? 20 : 0));
        return { id: c.id, name: c.name, phone: c.phone, pendingAmt, avgDelay, riskScore };
      })
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 10);

    return {
      demandForecasts,
      churnRisks, highRisk, mediumRisk,
      stockPredictions, criticalStock, warningStock,
      revForecast, totalForecast7d, forecastVsLast7, revR2,
      overdueRisk,
      // Summary counts for dashboard badges
      summary: {
        churnHighCount:    highRisk.length,
        churnMedCount:     mediumRisk.length,
        criticalStockCount: criticalStock.length,
        warningStockCount:  warningStock.length,
        forecastRevenue7d:  totalForecast7d,
        forecastChangeSign: forecastVsLast7 >= 0 ? "+" : "",
        forecastChangePct:  forecastVsLast7,
      },
    };
  }, [deliveries, customers, supplies, expenses, wastage, products, paymentLedger, settings]);
}

// ── Formatting helpers ────────────────────────────────────────
function inr(n) {
  if (n == null || isNaN(n)) return "₹0";
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000)    return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
}

// ── Sparkline (pure SVG, no deps) ────────────────────────────
function Sparkline({ data = [], color = "#3b82f6", width = 80, height = 28 }) {
  const vals = data.map(d => (typeof d === "object" ? d.qty ?? d.value ?? 0 : d));
  const max   = Math.max(...vals, 1);
  const pts   = vals.map((v, i) => {
    const x = vals.length < 2 ? width / 2 : (i / (vals.length - 1)) * width;
    const y = height - (v / max) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  const lastY = height - (vals[vals.length - 1] / max) * (height - 4) - 2;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={lastY} r={2.5} fill={color} />
    </svg>
  );
}

// ── PredictiveSummaryBadges — dashboard row ───────────────────
/**
 * Compact badge row for the SmartDashboard or Dashboard tab.
 * Shows the 3-4 most important signals at a glance.
 */
export function PredictiveSummaryBadges({ predictions, dm, t, onSectionClick }) {
  if (!predictions) return null;
  const { summary } = predictions;
  const sub    = t?.sub    || "#9ca3af";
  const border = t?.border || "rgba(255,255,255,0.08)";
  const inp    = t?.inp    || "rgba(255,255,255,0.04)";

  const badges = [
    {
      icon: "📈",
      label: "7d Revenue Forecast",
      value: inr(summary.forecastRevenue7d),
      sub: `${summary.forecastChangeSign}${summary.forecastChangePct}% vs last week`,
      color: summary.forecastChangePct >= 0 ? "#10b981" : "#ef4444",
      section: "revenue",
    },
    summary.criticalStockCount > 0 && {
      icon: "⚠️",
      label: "Critical Stock",
      value: `${summary.criticalStockCount} item${summary.criticalStockCount > 1 ? "s" : ""}`,
      sub: "running out soon",
      color: "#ef4444",
      section: "stock",
    },
    summary.churnHighCount > 0 && {
      icon: "🔴",
      label: "High Churn Risk",
      value: `${summary.churnHighCount} customer${summary.churnHighCount > 1 ? "s" : ""}`,
      sub: "may stop ordering",
      color: "#f97316",
      section: "churn",
    },
    summary.churnMedCount > 0 && {
      icon: "🟡",
      label: "Medium Churn Risk",
      value: `${summary.churnMedCount} customer${summary.churnMedCount > 1 ? "s" : ""}`,
      sub: "showing inactivity",
      color: "#f59e0b",
      section: "churn",
    },
  ].filter(Boolean);

  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(min(180px,100%),1fr))", gap:10 }}>
      {badges.map(b => (
        <button key={b.label} onClick={() => onSectionClick?.(b.section)}
          style={{
            background:inp, border:`1px solid ${border}`, borderRadius:14,
            padding:"12px 14px", textAlign:"left", cursor:onSectionClick?"pointer":"default",
            WebkitTapHighlightColor:"transparent",
            transition:"background 0.12s",
          }}
          onMouseEnter={e=>{ if(onSectionClick) e.currentTarget.style.background=`${b.color}10`; }}
          onMouseLeave={e=>{ e.currentTarget.style.background=inp; }}
        >
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
            <span style={{ fontSize:16 }}>{b.icon}</span>
            <span style={{ color:sub, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>{b.label}</span>
          </div>
          <div style={{ color:b.color, fontWeight:800, fontSize:18, lineHeight:1.1 }}>{b.value}</div>
          <div style={{ color:sub, fontSize:11, marginTop:3 }}>{b.sub}</div>
        </button>
      ))}
    </div>
  );
}

// ── DemandForecastCard ────────────────────────────────────────
export function DemandForecastCard({ predictions, dm, t, limit = 6 }) {
  const [expanded, setExpanded] = useState(null);
  if (!predictions?.demandForecasts?.length) return null;

  const border  = t?.border || "rgba(255,255,255,0.08)";
  const sub     = t?.sub    || "#9ca3af";
  const muted   = t?.muted  || "#6b7280";
  const textClr = t?.text   || "#f9fafb";
  const inp     = t?.inp    || "rgba(255,255,255,0.04)";

  const shown = predictions.demandForecasts.slice(0, limit);

  const trendIcon  = t => t === "up" ? "↑" : t === "down" ? "↓" : "→";
  const trendColor = t => t === "up" ? "#10b981" : t === "down" ? "#ef4444" : "#6b7280";

  return (
    <div style={{ borderRadius:16, border:`1px solid ${border}`, overflow:"hidden" }}>
      <div style={{ padding:"12px 16px", borderBottom:`1px solid ${border}`, display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:16 }}>📊</span>
        <p style={{ color:textClr, fontWeight:800, fontSize:13, flex:1 }}>Demand Forecast</p>
        <span style={{ color:sub, fontSize:11 }}>next 7 days</span>
      </div>
      {shown.map(p => {
        const isOpen = expanded === p.id;
        const tc = trendColor(p.trend);
        return (
          <div key={p.id}>
            <button onClick={() => setExpanded(isOpen ? null : p.id)}
              style={{
                width:"100%", display:"flex", alignItems:"center", gap:12,
                padding:"12px 16px", background:"transparent", border:"none",
                borderBottom:`1px solid ${border}`, cursor:"pointer",
                WebkitTapHighlightColor:"transparent", textAlign:"left",
              }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:textClr, fontWeight:700, fontSize:13 }} className="truncate">{p.name}</div>
                <div style={{ color:sub, fontSize:11, marginTop:2 }}>
                  Avg {p.avg7.toFixed(1)} {p.unit}/day · Proj: <span style={{ color:"#3b82f6", fontWeight:700 }}>{p.proj7d} {p.unit}</span>
                </div>
              </div>
              <Sparkline data={p.spark} color="#3b82f6" width={64} height={24} />
              <div style={{ color:tc, fontWeight:800, fontSize:13, minWidth:32, textAlign:"right" }}>
                {trendIcon(p.trend)}{Math.abs(p.trendPct)}%
              </div>
              <span style={{ color:sub, fontSize:11 }}>{isOpen ? "▲" : "▼"}</span>
            </button>
            {isOpen && (
              <div style={{ background:inp, padding:"12px 16px", borderBottom:`1px solid ${border}` }}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
                  {[
                    ["7d avg", `${p.avg7.toFixed(1)} ${p.unit}/day`],
                    ["14d avg", `${p.avg14.toFixed(1)} ${p.unit}/day`],
                    ["30d avg", `${p.avg30.toFixed(1)} ${p.unit}/day`],
                    ["7d forecast", `${p.proj7d} ${p.unit}`],
                    ["14d forecast", `${p.proj14d} ${p.unit}`],
                    ["Confidence", p.r2 > 0.5 ? "High" : p.r2 > 0.25 ? "Medium" : "Low"],
                  ].map(([label, val]) => (
                    <div key={label} style={{ background:dm?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.03)", borderRadius:10, padding:"8px 10px" }}>
                      <div style={{ color:muted, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</div>
                      <div style={{ color:textClr, fontWeight:700, fontSize:13, marginTop:3 }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── ChurnRiskTable ────────────────────────────────────────────
export function ChurnRiskTable({ predictions, dm, t, onSelectCustomer, limit = 8 }) {
  const [showAll, setShowAll] = useState(false);
  if (!predictions?.churnRisks?.length) return null;

  const border  = t?.border || "rgba(255,255,255,0.08)";
  const sub     = t?.sub    || "#9ca3af";
  const muted   = t?.muted  || "#6b7280";
  const textClr = t?.text   || "#f9fafb";
  const inp     = t?.inp    || "rgba(255,255,255,0.04)";

  const riskyOnes = predictions.churnRisks.filter(c => c.risk !== "low");
  const shown = showAll ? riskyOnes : riskyOnes.slice(0, limit);
  if (shown.length === 0) return null;

  const riskBadge = risk => ({
    high:   { color:"#ef4444", bg:"#ef444415", label:"High" },
    medium: { color:"#f59e0b", bg:"#f59e0b15", label:"Medium" },
    low:    { color:"#10b981", bg:"#10b98115", label:"Low" },
  }[risk] || { color:"#6b7280", bg:"transparent", label:"?" });

  return (
    <div style={{ borderRadius:16, border:`1px solid ${border}`, overflow:"hidden" }}>
      <div style={{ padding:"12px 16px", borderBottom:`1px solid ${border}`, display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:16 }}>⚠️</span>
        <p style={{ color:textClr, fontWeight:800, fontSize:13, flex:1 }}>Churn Risk</p>
        <span style={{
          background:"#ef444415", color:"#ef4444", borderRadius:99,
          padding:"2px 10px", fontSize:11, fontWeight:700,
        }}>{predictions.highRisk.length} high risk</span>
      </div>
      {shown.map(c => {
        const badge = riskBadge(c.risk);
        return (
          <button key={c.id}
            onClick={() => onSelectCustomer?.(c)}
            style={{
              width:"100%", display:"flex", alignItems:"center", gap:10,
              padding:"11px 16px", background:"transparent", border:"none",
              borderBottom:`1px solid ${border}`, cursor:onSelectCustomer?"pointer":"default",
              textAlign:"left", WebkitTapHighlightColor:"transparent",
            }}
            onMouseEnter={e=>{ if(onSelectCustomer) e.currentTarget.style.background=inp; }}
            onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; }}
          >
            {/* Risk score circle */}
            <div style={{
              width:36, height:36, borderRadius:"50%",
              background:badge.bg, border:`1.5px solid ${badge.color}40`,
              display:"flex", alignItems:"center", justifyContent:"center",
              flexShrink:0,
            }}>
              <span style={{ color:badge.color, fontWeight:800, fontSize:12 }}>{c.score}</span>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ color:textClr, fontWeight:700, fontSize:13 }} className="truncate">{c.name}</span>
                <span style={{
                  background:badge.bg, color:badge.color,
                  borderRadius:4, padding:"1px 6px", fontSize:9, fontWeight:800,
                }}>{badge.label}</span>
              </div>
              <div style={{ color:muted, fontSize:10, marginTop:2 }}>
                {c.reasons.slice(0, 2).join(" · ")}
              </div>
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <div style={{ color:muted, fontSize:10 }}>{c.daysSince < 999 ? `${c.daysSince}d ago` : "Never"}</div>
              {c.pendingAmt > 0 && <div style={{ color:"#f97316", fontWeight:700, fontSize:11 }}>{inr(c.pendingAmt)} due</div>}
            </div>
          </button>
        );
      })}
      {riskyOnes.length > limit && (
        <button onClick={() => setShowAll(s => !s)}
          style={{
            width:"100%", padding:"10px", background:"transparent", border:"none",
            color:sub, fontSize:11, fontWeight:600, cursor:"pointer",
          }}>
          {showAll ? "Show less ▲" : `Show ${riskyOnes.length - limit} more →`}
        </button>
      )}
    </div>
  );
}

// ── StockOutAlert ─────────────────────────────────────────────
export function StockOutAlert({ predictions, dm, t }) {
  if (!predictions?.criticalStock?.length && !predictions?.warningStock?.length) return null;

  const border  = t?.border || "rgba(255,255,255,0.08)";
  const sub     = t?.sub    || "#9ca3af";
  const textClr = t?.text   || "#f9fafb";
  const items   = [
    ...predictions.criticalStock,
    ...predictions.warningStock,
  ].slice(0, 4);

  return (
    <div style={{ borderRadius:14, border:"1.5px solid #ef444440", background:"#ef444408", padding:"12px 16px", marginBottom:12 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
        <span style={{ fontSize:16 }}>🪣</span>
        <p style={{ color:textClr, fontWeight:800, fontSize:13 }}>Stock Running Low</p>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {items.map(s => {
          const color = s.urgency === "critical" ? "#ef4444" : "#f97316";
          return (
            <div key={s.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{
                width:8, height:8, borderRadius:"50%", background:color, flexShrink:0,
              }} />
              <span style={{ color:textClr, fontWeight:600, fontSize:12, flex:1 }}>{s.item}</span>
              <span style={{ color:sub, fontSize:11 }}>{s.qty} {s.unit} left</span>
              {s.daysLeft != null && (
                <span style={{ color, fontWeight:700, fontSize:11 }}>
                  {s.daysLeft === 0 ? "Out now!" : `~${s.daysLeft}d`}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── RevenueForecastCard ───────────────────────────────────────
export function RevenueForecastCard({ predictions, dm, t }) {
  if (!predictions?.revForecast?.length) return null;

  const border  = t?.border || "rgba(255,255,255,0.08)";
  const sub     = t?.sub    || "#9ca3af";
  const muted   = t?.muted  || "#6b7280";
  const textClr = t?.text   || "#f9fafb";
  const inp     = t?.inp    || "rgba(255,255,255,0.04)";

  const { revForecast, totalForecast7d, forecastVsLast7 } = predictions;
  const trendColor = forecastVsLast7 >= 0 ? "#10b981" : "#ef4444";
  const maxVal = Math.max(...revForecast.map(d => d.high), 1);

  return (
    <div style={{ borderRadius:16, border:`1px solid ${border}`, overflow:"hidden" }}>
      <div style={{ padding:"12px 16px", borderBottom:`1px solid ${border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:16 }}>💰</span>
          <p style={{ color:textClr, fontWeight:800, fontSize:13, flex:1 }}>Revenue Forecast</p>
          <span style={{ color:trendColor, fontWeight:800, fontSize:12 }}>
            {forecastVsLast7 >= 0 ? "+" : ""}{forecastVsLast7}%
          </span>
        </div>
        <div style={{ display:"flex", alignItems:"baseline", gap:6, marginTop:8 }}>
          <span style={{ color:textClr, fontWeight:800, fontSize:24 }}>{inr(totalForecast7d)}</span>
          <span style={{ color:sub, fontSize:12 }}>projected next 7 days</span>
        </div>
      </div>

      {/* Bar chart */}
      <div style={{ padding:"16px", display:"flex", gap:6, alignItems:"flex-end", height:100 }}>
        {revForecast.map((day, i) => {
          const barH   = Math.round((day.value / maxVal) * 68);
          const lowH   = Math.round((day.low   / maxVal) * 68);
          const highH  = Math.round((day.high  / maxVal) * 68);
          const label  = day.date.slice(5); // "MM-DD"
          const isWeekend = [0, 6].includes(new Date(day.date).getDay());
          return (
            <div key={day.date} title={`${label}: ${inr(day.low)}–${inr(day.high)}`}
              style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
              <div style={{ position:"relative", height:72, display:"flex", alignItems:"flex-end", width:"100%" }}>
                {/* Confidence band */}
                <div style={{
                  position:"absolute", bottom:0, left:2, right:2,
                  height:highH, background:"rgba(59,130,246,0.12)",
                  borderRadius:"4px 4px 0 0",
                }} />
                {/* Main bar */}
                <div style={{
                  position:"absolute", bottom:0, left:4, right:4,
                  height:barH, background: isWeekend ? "#6366f1" : "#3b82f6",
                  borderRadius:"3px 3px 0 0",
                  transition:"height 0.3s ease",
                }} />
              </div>
              <span style={{ color:muted, fontSize:8, fontWeight:600 }}>{label}</span>
            </div>
          );
        })}
      </div>
      <div style={{ padding:"0 16px 12px" }}>
        <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <div style={{ width:10, height:10, borderRadius:2, background:"#3b82f6" }} />
            <span style={{ color:muted, fontSize:10 }}>Forecast</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <div style={{ width:10, height:10, borderRadius:2, background:"rgba(59,130,246,0.25)" }} />
            <span style={{ color:muted, fontSize:10 }}>Confidence band</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <div style={{ width:10, height:10, borderRadius:2, background:"#6366f1" }} />
            <span style={{ color:muted, fontSize:10 }}>Weekend</span>
          </div>
        </div>
        <p style={{ color:muted, fontSize:10, textAlign:"center", marginTop:6 }}>
          {predictions.revR2 > 0.4 ? "High confidence" : predictions.revR2 > 0.2 ? "Medium confidence" : "Low confidence"} · based on last 30 days
        </p>
      </div>
    </div>
  );
}

// ── OverdueRiskCard ───────────────────────────────────────────
export function OverdueRiskCard({ predictions, dm, t, onSelectCustomer }) {
  if (!predictions?.overdueRisk?.length) return null;
  const border  = t?.border || "rgba(255,255,255,0.08)";
  const sub     = t?.sub    || "#9ca3af";
  const muted   = t?.muted  || "#6b7280";
  const textClr = t?.text   || "#f9fafb";
  const inp     = t?.inp    || "rgba(255,255,255,0.04)";

  return (
    <div style={{ borderRadius:16, border:`1px solid ${border}`, overflow:"hidden" }}>
      <div style={{ padding:"12px 16px", borderBottom:`1px solid ${border}`, display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ fontSize:16 }}>🕐</span>
        <p style={{ color:textClr, fontWeight:800, fontSize:13, flex:1 }}>Likely Late Payers</p>
      </div>
      {predictions.overdueRisk.map(c => {
        const riskPct = Math.min(100, c.riskScore);
        const color = riskPct > 60 ? "#ef4444" : riskPct > 30 ? "#f97316" : "#f59e0b";
        return (
          <button key={c.id} onClick={() => onSelectCustomer?.(c)}
            style={{
              width:"100%", display:"flex", alignItems:"center", gap:10,
              padding:"10px 16px", background:"transparent", border:"none",
              borderBottom:`1px solid ${border}`, cursor:onSelectCustomer?"pointer":"default",
              textAlign:"left", WebkitTapHighlightColor:"transparent",
            }}
            onMouseEnter={e=>{ if(onSelectCustomer) e.currentTarget.style.background=inp; }}
            onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; }}>
            <div style={{ flex:1, minWidth:0 }}>
              <span style={{ color:textClr, fontWeight:700, fontSize:12 }}>{c.name}</span>
              {c.avgDelay > 0 && (
                <div style={{ color:muted, fontSize:10, marginTop:1 }}>
                  Avg {Math.round(c.avgDelay)}d delay
                </div>
              )}
            </div>
            <span style={{ color:"#f97316", fontWeight:700, fontSize:12 }}>{inr(c.pendingAmt)}</span>
            {/* Risk bar */}
            <div style={{ width:50, height:6, background:inp, borderRadius:3, overflow:"hidden", flexShrink:0 }}>
              <div style={{ height:"100%", width:`${riskPct}%`, background:color, borderRadius:3 }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── PredictivePanel — full section ───────────────────────────
/**
 * Drop this in the Analytics tab or as its own panel section.
 * Shows all prediction cards in a responsive grid.
 */
export function PredictivePanel({ predictions, dm, t, products, customers, supplies, settings, onSelectCustomer }) {
  const [section, setSection] = useState("overview");
  if (!predictions) return null;

  const sub     = t?.sub    || "#9ca3af";
  const border  = t?.border || "rgba(255,255,255,0.08)";
  const textClr = t?.text   || "#f9fafb";
  const inp     = t?.inp    || "rgba(255,255,255,0.04)";

  const sections = [
    { id:"overview", label:"Overview",  icon:"🔮" },
    { id:"revenue",  label:"Revenue",   icon:"💰" },
    { id:"demand",   label:"Demand",    icon:"📊" },
    { id:"churn",    label:"Churn",     icon:"⚠️" },
    { id:"stock",    label:"Stock",     icon:"📦" },
  ];

  return (
    <div>
      {/* Section tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
        {sections.map(s => {
          const isActive = section === s.id;
          return (
            <button key={s.id} onClick={() => setSection(s.id)}
              style={{
                background: isActive ? "#3b82f6" : inp,
                border: `1px solid ${isActive ? "#3b82f6" : border}`,
                color: isActive ? "#fff" : sub,
                borderRadius:10, padding:"7px 12px",
                fontSize:12, fontWeight:700, cursor:"pointer",
                display:"flex", alignItems:"center", gap:5,
                WebkitTapHighlightColor:"transparent",
              }}>
              <span>{s.icon}</span>{s.label}
            </button>
          );
        })}
      </div>

      {/* Panels */}
      {section === "overview" && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <PredictiveSummaryBadges predictions={predictions} dm={dm} t={t} onSectionClick={setSection} />
          <StockOutAlert predictions={predictions} dm={dm} t={t} />
          <RevenueForecastCard predictions={predictions} dm={dm} t={t} />
        </div>
      )}
      {section === "revenue" && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <RevenueForecastCard predictions={predictions} dm={dm} t={t} />
          <OverdueRiskCard predictions={predictions} dm={dm} t={t} onSelectCustomer={onSelectCustomer} />
        </div>
      )}
      {section === "demand" && (
        <DemandForecastCard predictions={predictions} dm={dm} t={t} limit={20} />
      )}
      {section === "churn" && (
        <ChurnRiskTable predictions={predictions} dm={dm} t={t} onSelectCustomer={onSelectCustomer} limit={20} />
      )}
      {section === "stock" && (
        <div>
          {predictions.criticalStock.length === 0 && predictions.warningStock.length === 0 ? (
            <div style={{ padding:"32px 16px", textAlign:"center", color:sub, fontSize:13 }}>
              ✅ All stock levels are healthy
            </div>
          ) : (
            <div style={{ borderRadius:16, border:`1px solid ${border}`, overflow:"hidden" }}>
              <div style={{ padding:"12px 16px", borderBottom:`1px solid ${border}` }}>
                <p style={{ color:textClr, fontWeight:800, fontSize:13 }}>Stock Depletion Forecast</p>
                <p style={{ color:sub, fontSize:11, marginTop:2 }}>
                  Estimated runout based on consumption history
                </p>
              </div>
              {predictions.stockPredictions.filter(s => s.urgency !== "ok" && s.urgency !== "unknown").map(s => {
                const color = s.urgency === "critical" ? "#ef4444" : s.urgency === "warning" ? "#f97316" : "#f59e0b";
                return (
                  <div key={s.id} style={{
                    display:"flex", alignItems:"center", gap:12,
                    padding:"12px 16px", borderBottom:`1px solid ${border}`,
                  }}>
                    <div style={{
                      width:8, height:8, borderRadius:"50%", background:color, flexShrink:0,
                      boxShadow:`0 0 6px ${color}60`,
                    }} />
                    <div style={{ flex:1 }}>
                      <span style={{ color:textClr, fontWeight:700, fontSize:13 }}>{s.item}</span>
                      {s.supplier && <span style={{ color:sub, fontSize:11 }}> · {s.supplier}</span>}
                      <div style={{ color:sub, fontSize:11, marginTop:2 }}>
                        {s.qty} {s.unit} in stock
                        {s.dailyConsumption && ` · using ~${s.dailyConsumption.toFixed(1)} ${s.unit}/day`}
                      </div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ color, fontWeight:800, fontSize:13 }}>
                        {s.daysLeft === 0 ? "Out now!" : s.daysLeft != null ? `~${s.daysLeft}d left` : "—"}
                      </div>
                      {s.reorderDate && (
                        <div style={{ color:sub, fontSize:10, marginTop:2 }}>
                          Reorder by {s.reorderDate}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PredictivePanel;
