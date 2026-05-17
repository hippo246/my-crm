/* eslint-disable react-hooks/exhaustive-deps, no-unused-vars */
// ============================================================
// components/SmartDashboard.js  — Modular Draggable Dashboard
//
// Drag-and-drop widget grid using native HTML5 drag API.
// Zero external dependencies — drop-in replacement for the
// previous @dnd-kit version.
//
// Widget visibility + order stored per-user via setUserDashWidgets.
// ============================================================

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useSystemHealth } from "./SystemHealthBar";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";

// ── Widget definitions ───────────────────────────────────────
const WIDGET_DEFS = [
  { id: "todayDispatches",  label: "Today's Dispatches",    icon: "🚚", roles: ["admin","agent","factory"] },
  { id: "pendingInvoices",  label: "Pending Invoices",      icon: "🧾", roles: ["admin"] },
  { id: "inventoryAlerts",  label: "Inventory Alerts",      icon: "📦", roles: ["admin","factory"] },
  { id: "delayedDeliveries",label: "Delayed Deliveries",    icon: "⏰", roles: ["admin","agent"] },
  { id: "topCustomers",     label: "Top Customers",         icon: "🏆", roles: ["admin"] },
  { id: "revenueTrend",     label: "Revenue Trend",         icon: "📈", roles: ["admin"] },
  { id: "productionEff",    label: "Production Efficiency", icon: "🏭", roles: ["admin","factory"] },
  { id: "staffActivity",    label: "Staff Activity",        icon: "👤", roles: ["admin"] },
  { id: "recentActions",    label: "Recent Actions",        icon: "⚡", roles: ["admin","agent","factory"] },
  { id: "syncStatus",       label: "Sync Status",           icon: "📡", roles: ["admin"] },
  { id: "quickStats",       label: "Quick Stats",           icon: "📊", roles: ["admin","agent","factory"] },
  { id: "cashFlow",         label: "Cash Flow",             icon: "💰", roles: ["admin"] },
  // ── new widgets ──────────────────────────────────────────────
  { id: "clockWidget",      label: "Clock & Date",          icon: "🕐", roles: ["admin","agent","factory"] },
  { id: "expenseBreakdown", label: "Expense Breakdown",     icon: "🥧", roles: ["admin"] },
  { id: "productSales",     label: "Product Sales",         icon: "🛒", roles: ["admin","agent"] },
  { id: "goalTracker",      label: "Goal Tracker",          icon: "🎯", roles: ["admin"] },
  { id: "miniCalendar",     label: "Mini Calendar",         icon: "📅", roles: ["admin","agent","factory"] },
  { id: "wasteTracker",     label: "Waste Tracker",         icon: "♻️",  roles: ["admin","factory"] },
  { id: "vehicleStatus",    label: "Vehicle Status",        icon: "🚛", roles: ["admin","agent"] },
  { id: "noticeBoard",      label: "Notice Board",          icon: "📌", roles: ["admin","agent","factory"] },
];

const DEFAULT_WIDGET_ORDER = [
  "quickStats","todayDispatches","revenueTrend","pendingInvoices",
  "topCustomers","inventoryAlerts","recentActions","delayedDeliveries","syncStatus",
];

// ── Touch + Mouse drag-and-drop grid ────────────────────────────
function DragGrid({ items, onReorder, editMode, renderItem }) {
  const [draggingId, setDraggingId]   = useState(null);
  const [overId,     setOverId]       = useState(null);
  // ghost position for touch drag
  const [ghostPos,   setGhostPos]     = useState(null);
  const [ghostSize,  setGhostSize]    = useState({ w: 0, h: 0 });

  const dragIdx    = useRef(null);
  const touchTimer = useRef(null);
  const gridRef    = useRef(null);
  const ghostLabel = useRef("");

  // ── helper: find which cell index a touch point is over ──────
  const idxAtPoint = useCallback((x, y) => {
    if (!gridRef.current) return null;
    const cells = gridRef.current.children;
    for (let i = 0; i < cells.length; i++) {
      const r = cells[i].getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
    }
    return null;
  }, []);

  const commitReorder = useCallback((fromIdx, toIdx) => {
    if (fromIdx === null || toIdx === null || fromIdx === toIdx) return;
    const next = [...items];
    const [removed] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, removed);
    onReorder(next);
  }, [items, onReorder]);

  const resetState = useCallback(() => {
    dragIdx.current = null;
    setDraggingId(null);
    setOverId(null);
    setGhostPos(null);
  }, []);

  // ── Mouse / HTML5 drag (desktop) ─────────────────────────────
  const onMouseDragStart = (e, id, idx) => {
    if (!editMode) return;
    dragIdx.current = idx;
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };
  const onMouseDragEnter = (e, id, idx) => {
    e.preventDefault();
    if (dragIdx.current === idx) return;
    setOverId(id);
  };
  const onMouseDragOver  = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const onMouseDrop      = (e, idx) => {
    e.preventDefault();
    commitReorder(dragIdx.current, idx);
    resetState();
  };
  const onMouseDragEnd   = () => resetState();

  // ── Touch drag (mobile / tablet) ─────────────────────────────
  const onTouchStart = (e, id, idx) => {
    if (!editMode) return;
    // long-press not needed — instant drag on touch in edit mode
    const touch = e.touches[0];
    const el    = e.currentTarget;
    const rect  = el.getBoundingClientRect();
    dragIdx.current = idx;
    ghostLabel.current = id;
    setGhostSize({ w: rect.width, h: rect.height });
    setGhostPos({ x: touch.clientX - rect.width / 2, y: touch.clientY - rect.height / 2 });
    setDraggingId(id);
  };

  const onTouchMove = (e) => {
    if (!editMode || dragIdx.current === null) return;
    e.preventDefault(); // stop page scroll while dragging
    const touch = e.touches[0];
    setGhostPos({ x: touch.clientX - ghostSize.w / 2, y: touch.clientY - ghostSize.h / 2 });
    const over = idxAtPoint(touch.clientX, touch.clientY);
    if (over !== null && over !== dragIdx.current) {
      setOverId(items[over]);
    }
  };

  const onTouchEnd = (e) => {
    if (!editMode || dragIdx.current === null) return;
    const touch = e.changedTouches[0];
    const toIdx = idxAtPoint(touch.clientX, touch.clientY);
    commitReorder(dragIdx.current, toIdx);
    resetState();
  };

  return (
    <div style={{ position: "relative" }}>
      {/* ghost card that follows finger */}
      {ghostPos && draggingId && (
        <div style={{
          position: "fixed",
          left: ghostPos.x, top: ghostPos.y,
          width: ghostSize.w, height: ghostSize.h,
          pointerEvents: "none", zIndex: 9999,
          opacity: 0.75, borderRadius: 20,
          background: "rgba(59,130,246,0.18)",
          border: "2px dashed #3b82f6",
          display: "flex", alignItems: "center", justifyContent: "center",
          transform: "rotate(2deg) scale(1.04)",
          transition: "transform 0.08s",
          boxShadow: "0 12px 40px rgba(59,130,246,0.25)",
        }}>
          <span style={{ color: "#3b82f6", fontWeight: 800, fontSize: 13 }}>
            {WIDGET_DEFS.find(w => w.id === draggingId)?.icon} {WIDGET_DEFS.find(w => w.id === draggingId)?.label}
          </span>
        </div>
      )}

      <div
        ref={gridRef}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(min(300px,100%),1fr))",
          gap: 14,
        }}
      >
        {items.map((id, idx) => (
          <div
            key={id}
            draggable={editMode}
            onDragStart={editMode ? (e) => onMouseDragStart(e, id, idx) : undefined}
            onDragEnter={editMode ? (e) => onMouseDragEnter(e, id, idx) : undefined}
            onDragOver={editMode ? onMouseDragOver : undefined}
            onDrop={editMode ? (e) => onMouseDrop(e, idx) : undefined}
            onDragEnd={editMode ? onMouseDragEnd : undefined}
            onTouchStart={editMode ? (e) => onTouchStart(e, id, idx) : undefined}
            onTouchMove={editMode ? onTouchMove : undefined}
            onTouchEnd={editMode ? onTouchEnd : undefined}
            style={{
              opacity: draggingId === id ? 0.35 : 1,
              outline: overId === id && draggingId !== id ? "2px dashed #3b82f6" : "none",
              outlineOffset: 4,
              borderRadius: 20,
              transition: "opacity 0.15s, outline 0.1s, transform 0.15s",
              transform: overId === id && draggingId !== id ? "scale(1.02)" : "scale(1)",
              cursor: editMode ? "grab" : "default",
              touchAction: editMode ? "none" : "auto",
            }}
          >
            {renderItem(id, editMode)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Widget card shell ─────────────────────────────────────────
function WidgetCard({ icon, title, children, t, editMode, onRemove, accent = "#3b82f6", noPad }) {
  const dm = t?._dm;
  return (
    <div style={{
      background: dm
        ? "linear-gradient(145deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0.02) 100%)"
        : "#fff",
      border: `1px solid ${t?.border || "rgba(255,255,255,0.1)"}`,
      borderRadius: 20,
      boxShadow: dm
        ? "0 4px 24px rgba(0,0,0,0.4),0 1px 0 rgba(255,255,255,0.06) inset"
        : "0 1px 4px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04)",
      overflow: "hidden",
      position: "relative",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "13px 16px 11px",
        borderBottom: `1px solid ${t?.border || "rgba(0,0,0,0.06)"}`,
        background: dm ? `linear-gradient(135deg,${accent}12,transparent)` : `${accent}06`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {editMode && (
            <span style={{
              cursor: "grab", color: t?.sub || "#6b7280",
              fontSize: 16, userSelect: "none", lineHeight: 1,
            }} title="Drag to reorder">⠿</span>
          )}
          <span style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>
          <span style={{ color: t?.text || "#f9fafb", fontWeight: 700, fontSize: 12 }}>{title}</span>
        </div>
        {editMode && onRemove && (
          <button onClick={onRemove} style={{
            background: "#ef444420", border: "none", color: "#ef4444",
            width: 22, height: 22, borderRadius: 6, fontSize: 13, fontWeight: 700,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        )}
      </div>
      {/* Body */}
      <div style={{ padding: noPad ? 0 : "14px 16px" }}>
        {children}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// WIDGET IMPLEMENTATIONS
// ══════════════════════════════════════════════════════════════

function QuickStatsWidget({ t, deliveries, customers, expenses, today, inr, lineTotal, editMode, onRemove }) {
  const tStr = today();
  const todayD    = deliveries.filter(d => d.date === tStr);
  const todayDone = todayD.filter(d => d.status === "Delivered");
  const todayRev  = todayDone.reduce((s, d) => s + lineTotal(d.orderLines), 0);
  const totalDue  = customers.reduce((s, c) => s + (c.pending || 0), 0);

  const stats = [
    { label: "Today Orders",  val: todayD.length,    color: "#3b82f6" },
    { label: "Delivered",     val: todayDone.length, color: "#10b981" },
    { label: "Today Revenue", val: inr(todayRev),    color: "#10b981" },
    { label: "Outstanding",   val: inr(totalDue),    color: totalDue > 0 ? "#ef4444" : "#10b981" },
  ];

  return (
    <WidgetCard icon="📊" title="Quick Stats" t={t} accent="#3b82f6" editMode={editMode} onRemove={onRemove}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(120px,100%),1fr))", gap: 8 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: `${s.color}10`, border: `1px solid ${s.color}25`, borderRadius: 12, padding: "10px 12px" }}>
            <p style={{ color: s.color, fontWeight: 900, fontSize: 14, lineHeight: 1 }}>{s.val}</p>
            <p style={{ color: t?.sub, fontSize: 9, marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</p>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}

function TodayDispatchesWidget({ t, deliveries, today, lineTotal, inr, setTab, setDetailModal, editMode, onRemove }) {
  const tStr  = today();
  const items = deliveries.filter(d => d.date === tStr).sort((a, b) => {
    const o = { Pending: 0, "In Transit": 1, Delivered: 2, Cancelled: 3 };
    return (o[a.status] ?? 9) - (o[b.status] ?? 9);
  });
  const sc = s => s === "Delivered" ? "#10b981" : s === "Cancelled" ? "#ef4444" : s === "In Transit" ? "#3b82f6" : "#f59e0b";

  return (
    <WidgetCard icon="🚚" title="Today's Dispatches" t={t} accent="#f59e0b" noPad editMode={editMode} onRemove={onRemove}>
      {items.length === 0
        ? <div style={{ padding: "20px 16px", textAlign: "center", color: t?.sub, fontSize: 12 }}>No dispatches today</div>
        : <div style={{ maxHeight: 280, overflowY: "auto" }}>
            {items.map((d, i) => (
              <div key={d.id}
                onClick={() => setDetailModal?.({ type: "delivery", data: d })}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderTop: i > 0 ? `1px solid ${t?.border}` : "none", cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = (t?.inp || "rgba(255,255,255,0.04)") + "88"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ width: 3, height: 32, borderRadius: 2, background: sc(d.status), flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: t?.text, fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.customer}</p>
                  <span style={{ background: sc(d.status) + "20", color: sc(d.status), borderRadius: 4, padding: "1px 5px", fontSize: 9, fontWeight: 700 }}>{d.status}</span>
                </div>
                <p style={{ color: t?.sub, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{inr(lineTotal(d.orderLines))}</p>
              </div>
            ))}
          </div>
      }
      <div style={{ padding: "8px 16px", borderTop: `1px solid ${t?.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: t?.sub, fontSize: 10 }}>{items.length} total · {items.filter(d => d.status === "Delivered").length} done</span>
        <button onClick={() => setTab?.("Deliveries")} style={{ background: "none", border: "none", color: "#3b82f6", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>View all →</button>
      </div>
    </WidgetCard>
  );
}

function PendingInvoicesWidget({ t, deliveries, inr, lineTotal, setTab, setDetailModal, editMode, onRemove }) {
  const pending  = deliveries.filter(d => d.status !== "Delivered" && d.status !== "Cancelled").sort((a, b) => (a.date || "").localeCompare(b.date || "")).slice(0, 6);
  const totalAmt = pending.reduce((s, d) => s + lineTotal(d.orderLines), 0);

  return (
    <WidgetCard icon="🧾" title="Pending Invoices" t={t} accent="#8b5cf6" noPad editMode={editMode} onRemove={onRemove}>
      {pending.length === 0
        ? <div style={{ padding: "20px 16px", textAlign: "center", color: t?.sub, fontSize: 12 }}>All clear! 🎉</div>
        : <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {pending.map((d, i) => (
              <div key={d.id}
                onClick={() => setDetailModal?.({ type: "delivery", data: d })}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 16px", borderTop: i > 0 ? `1px solid ${t?.border}` : "none", cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = (t?.inp || "rgba(255,255,255,0.04)") + "88"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div>
                  <p style={{ color: t?.text, fontWeight: 600, fontSize: 12 }}>{d.customer}</p>
                  <p style={{ color: t?.sub, fontSize: 10 }}>📅 {d.date} · {d.status}</p>
                </div>
                <p style={{ color: "#8b5cf6", fontWeight: 800, fontSize: 12 }}>{inr(lineTotal(d.orderLines))}</p>
              </div>
            ))}
          </div>
      }
      <div style={{ padding: "8px 16px", borderTop: `1px solid ${t?.border}`, display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: t?.sub, fontSize: 10 }}>{pending.length} pending</span>
        <span style={{ color: "#8b5cf6", fontWeight: 700, fontSize: 11 }}>{inr(totalAmt)}</span>
      </div>
    </WidgetCard>
  );
}

function InventoryAlertsWidget({ t, supplies, setTab, inr, editMode, onRemove }) {
  const alerts = (supplies || []).filter(s => !s.deleted && s.minStock && (s.qty || 0) <= s.minStock).slice(0, 6);

  return (
    <WidgetCard icon="📦" title="Inventory Alerts" t={t} accent="#f97316" noPad editMode={editMode} onRemove={onRemove}>
      {alerts.length === 0
        ? <div style={{ padding: "20px 16px", textAlign: "center", color: t?.sub, fontSize: 12 }}>All stock levels OK ✓</div>
        : <div>
            {alerts.map((s, i) => {
              const pct = s.minStock > 0 ? Math.min(100, Math.round((s.qty || 0) / s.minStock * 100)) : 0;
              const col = pct <= 25 ? "#ef4444" : pct <= 60 ? "#f97316" : "#f59e0b";
              return (
                <div key={s.id} style={{ padding: "10px 16px", borderTop: i > 0 ? `1px solid ${t?.border}` : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <p style={{ color: t?.text, fontWeight: 600, fontSize: 12 }}>{s.item}</p>
                    <span style={{ color: col, fontSize: 11, fontWeight: 800 }}>{s.qty} {s.unit}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 4, background: t?.border, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: col, borderRadius: 4 }} />
                  </div>
                  <p style={{ color: t?.sub, fontSize: 9, marginTop: 2 }}>Min: {s.minStock} {s.unit} · {pct}% of threshold</p>
                </div>
              );
            })}
          </div>
      }
      <div style={{ padding: "8px 16px", borderTop: `1px solid ${t?.border}` }}>
        <button onClick={() => setTab?.("Supplies")} style={{ background: "none", border: "none", color: "#f97316", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>View inventory →</button>
      </div>
    </WidgetCard>
  );
}

function DelayedDeliveriesWidget({ t, deliveries, today, inr, lineTotal, setDetailModal, setTab, editMode, onRemove }) {
  const tStr   = today();
  const delayed = deliveries.filter(d => d.status === "Pending" && d.deliveryDate && d.deliveryDate < tStr)
    .sort((a, b) => (a.deliveryDate || "").localeCompare(b.deliveryDate || "")).slice(0, 6);

  return (
    <WidgetCard icon="⏰" title="Delayed Deliveries" t={t} accent="#ef4444" noPad editMode={editMode} onRemove={onRemove}>
      {delayed.length === 0
        ? <div style={{ padding: "20px 16px", textAlign: "center", color: t?.sub, fontSize: 12 }}>No delays 🎉</div>
        : <div style={{ maxHeight: 260, overflowY: "auto" }}>
            {delayed.map((d, i) => {
              const daysLate = Math.floor((new Date(tStr) - new Date(d.deliveryDate)) / 86400000);
              return (
                <div key={d.id}
                  onClick={() => setDetailModal?.({ type: "delivery", data: d })}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 16px", borderTop: i > 0 ? `1px solid ${t?.border}` : "none", cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = (t?.inp || "rgba(255,255,255,0.04)") + "88"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div>
                    <p style={{ color: t?.text, fontWeight: 600, fontSize: 12 }}>{d.customer}</p>
                    <p style={{ color: "#ef4444", fontSize: 10, fontWeight: 700 }}>Due {d.deliveryDate} · {daysLate}d late</p>
                  </div>
                  <span style={{ background: "#ef444420", color: "#ef4444", borderRadius: 8, padding: "3px 8px", fontSize: 10, fontWeight: 800 }}>+{daysLate}d</span>
                </div>
              );
            })}
          </div>
      }
      <div style={{ padding: "8px 16px", borderTop: `1px solid ${t?.border}` }}>
        <button onClick={() => setTab?.("Deliveries")} style={{ background: "none", border: "none", color: "#ef4444", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{delayed.length} delayed →</button>
      </div>
    </WidgetCard>
  );
}

function TopCustomersWidget({ t, customers, deliveries, lineTotal, inr, setDetailModal, editMode, onRemove }) {
  const top = [...customers]
    .map(c => ({ ...c, total: (c.paid || 0) + (c.pending || 0), orders: deliveries.filter(d => d.customerId === c.id).length }))
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const max = top[0]?.total || 1;
  const medals = ["🥇","🥈","🥉"];

  return (
    <WidgetCard icon="🏆" title="Top Customers" t={t} accent="#f59e0b" editMode={editMode} onRemove={onRemove}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {top.map((c, i) => (
          <div key={c.id} style={{ cursor: "pointer" }} onClick={() => setDetailModal?.({ type: "customer", data: c })}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
              <span style={{ color: t?.text, fontSize: 12, fontWeight: 600 }}>{medals[i] || `#${i + 1}`} {c.name}</span>
              <span style={{ color: "#f59e0b", fontWeight: 800, fontSize: 12 }}>{inr(c.total)}</span>
            </div>
            <div style={{ height: 4, borderRadius: 4, background: t?.border, overflow: "hidden" }}>
              <div style={{ width: `${Math.round(c.total / max * 100)}%`, height: "100%", background: "#f59e0b", borderRadius: 4 }} />
            </div>
          </div>
        ))}
        {top.length === 0 && <p style={{ color: t?.sub, fontSize: 12, textAlign: "center" }}>No customer data yet</p>}
      </div>
    </WidgetCard>
  );
}

function RevenueTrendWidget({ t, chartData, inr, editMode, onRemove }) {
  return (
    <WidgetCard icon="📈" title="Revenue Trend (7d)" t={t} accent="#10b981" editMode={editMode} onRemove={onRemove}>
      <ResponsiveContainer width="100%" height={130}>
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={t?.border || "#333"} />
          <XAxis dataKey="date" tick={{ fill: t?.sub || "#9ca3af", fontSize: 9 }} />
          <YAxis tick={{ fill: t?.sub || "#9ca3af", fontSize: 9 }} tickFormatter={v => `₹${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`} />
          <Tooltip contentStyle={{ background: t?.card, border: `1px solid ${t?.border}`, borderRadius: 10, fontSize: 11 }} labelStyle={{ color: t?.sub }} itemStyle={{ color: "#10b981" }} />
          <Line type="monotone" dataKey="Revenue" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981", r: 3 }} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="Expenses" stroke="#ef4444" strokeWidth={1.5} dot={{ fill: "#ef4444", r: 2 }} strokeDasharray="4 2" />
        </LineChart>
      </ResponsiveContainer>
      <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
        {[{ c: "#10b981", l: "Revenue" }, { c: "#ef4444", l: "Expenses" }].map(({ c, l }) => (
          <span key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: t?.sub }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: "inline-block" }} />{l}
          </span>
        ))}
      </div>
    </WidgetCard>
  );
}

function ProductionEffWidget({ t, allBatches, today, editMode, onRemove }) {
  const tStr        = today();
  const todayBatches = (allBatches || []).filter(b => b.date === tStr);
  const totalTarget  = todayBatches.reduce((s, b) => s + (b.targetQty || 0), 0);
  const totalActual  = todayBatches.reduce((s, b) => s + (b.actualQty || b.completedQty || 0), 0);
  const pct = totalTarget > 0 ? Math.round(totalActual / totalTarget * 100) : null;
  const col = pct === null ? "#6b7280" : pct >= 90 ? "#10b981" : pct >= 70 ? "#f59e0b" : "#ef4444";

  return (
    <WidgetCard icon="🏭" title="Production Efficiency" t={t} accent="#6366f1" editMode={editMode} onRemove={onRemove}>
      {pct === null
        ? <p style={{ color: t?.sub, fontSize: 12, textAlign: "center", padding: "8px 0" }}>No production targets set today</p>
        : <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", flexShrink: 0, background: `conic-gradient(${col} ${pct * 3.6}deg, ${t?.border || "#333"} 0)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", background: t?.card || "#1a2332", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: col, fontWeight: 900, fontSize: 13 }}>{pct}%</span>
                </div>
              </div>
              <div>
                <p style={{ color: t?.text, fontWeight: 700, fontSize: 13 }}>{totalActual} / {totalTarget} units</p>
                <p style={{ color: t?.sub, fontSize: 10, marginTop: 2 }}>{todayBatches.length} batch{todayBatches.length !== 1 ? "es" : ""} today</p>
              </div>
            </div>
            <div style={{ height: 6, borderRadius: 6, background: t?.border, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: col, borderRadius: 6, transition: "width 0.6s ease" }} />
            </div>
          </>
      }
    </WidgetCard>
  );
}

function StaffActivityWidget({ t, actLog, editMode, onRemove }) {
  const recent = [...(actLog || [])]
    .filter(e => e.role && e.role !== "admin")
    .sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0))
    .slice(0, 5);

  return (
    <WidgetCard icon="👤" title="Staff Activity" t={t} accent="#6366f1" noPad editMode={editMode} onRemove={onRemove}>
      {recent.length === 0
        ? <div style={{ padding: "20px 16px", textAlign: "center", color: t?.sub, fontSize: 12 }}>No recent staff activity</div>
        : recent.map((e, i) => (
            <div key={e.id || i} style={{ display: "flex", gap: 10, padding: "9px 16px", borderTop: i > 0 ? `1px solid ${t?.border}` : "none" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#6366f120", border: "1px solid #6366f130", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>
                {e.deviceType === "mobile" ? "📱" : "🖥️"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: t?.text, fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.user || "Unknown"}</p>
                <p style={{ color: t?.sub, fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(e.action || "").replace(/^\[[^\]]+\]\s*/i, "") || e.detail}</p>
              </div>
            </div>
          ))
      }
    </WidgetCard>
  );
}

function RecentActionsWidget({ t, actLog, editMode, onRemove }) {
  const recent = [...(actLog || [])].sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0)).slice(0, 6);
  const getIcon = action => {
    const a = (action || "").toLowerCase();
    if (a.includes("payment") || a.includes("paid")) return { icon: "💰", c: "#10b981" };
    if (a.includes("deliver"))  return { icon: "🚚", c: "#3b82f6" };
    if (a.includes("delete") || a.includes("trash")) return { icon: "🗑️", c: "#ef4444" };
    if (a.includes("creat") || a.includes("add"))    return { icon: "✨", c: "#10b981" };
    if (a.includes("edit") || a.includes("updat"))   return { icon: "✏️", c: "#3b82f6" };
    return { icon: "⚡", c: "#6b7280" };
  };

  return (
    <WidgetCard icon="⚡" title="Recent Actions" t={t} accent="#0ea5e9" noPad editMode={editMode} onRemove={onRemove}>
      {recent.length === 0
        ? <div style={{ padding: "20px 16px", textAlign: "center", color: t?.sub, fontSize: 12 }}>No activity yet</div>
        : recent.map((e, i) => {
            const { icon, c } = getIcon(e.action);
            const clean = (e.action || "").replace(/^\[[^\]]+\]\s*/i, "") || e.detail || "—";
            return (
              <div key={e.id || i} style={{ display: "flex", gap: 10, padding: "9px 16px", borderTop: i > 0 ? `1px solid ${t?.border}` : "none", alignItems: "center" }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: c + "15", border: `1px solid ${c}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>{icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: t?.text, fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{clean}</p>
                  <p style={{ color: t?.sub, fontSize: 9, marginTop: 1 }}>{e.user || "—"} · {e.role}</p>
                </div>
              </div>
            );
          })
      }
    </WidgetCard>
  );
}

function SyncStatusWidget({ t, editMode, onRemove, _syncListeners }) {
  const health = useSystemHealth(_syncListeners);

  const STATUS_META = {
    connecting: { label: "Connecting",  color: "#3b82f6" },
    live:       { label: "Live",        color: "#10b981" },
    syncing:    { label: "Syncing…",    color: "#f59e0b" },
    error:      { label: "Error",       color: "#ef4444" },
    stale:      { label: "Stale data",  color: "#f97316" },
    offline:    { label: "Offline",     color: "#6b7280" },
  };
  const meta = STATUS_META[health.status] || STATUS_META.connecting;

  const muted = t?.sub || "#9ca3af";
  const card  = t?.inp || "rgba(255,255,255,0.04)";
  const text  = t?.text || "#f9fafb";
  const border = t?.border || "rgba(255,255,255,0.08)";

  function fmtAge(s) {
    if (s === null) return null;
    if (s < 5)   return "just now";
    if (s < 60)  return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
  }
  function fmtUptime(s) {
    if (s < 60)   return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  }

  const latColor = ms =>
    ms === null ? muted : ms < 300 ? "#10b981" : ms < 800 ? "#f59e0b" : "#ef4444";

  const freshnessColor = p =>
    p > 60 ? "#10b981" : p > 30 ? "#f59e0b" : "#ef4444";

  return (
    <WidgetCard icon="📡" title="Sync Status" t={t} accent={meta.color} editMode={editMode} onRemove={onRemove}>

      {/* Status row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        {/* Dot */}
        <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, flexShrink: 0 }}>
          <span style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: meta.color, opacity: 0.2,
            animation: health.status !== "live" && health.status !== "offline" ? "sdPing 1.4s ease-in-out infinite" : "none",
          }} />
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: meta.color, display: "block", boxShadow: `0 0 6px ${meta.color}` }} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: meta.color, fontWeight: 800, fontSize: 13 }}>{meta.label}</p>
          <p style={{ color: muted, fontSize: 10 }}>
            {health.lastSync
              ? `Last synced ${health.lastSync.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : "Waiting for first sync…"}
          </p>
        </div>
        {/* Network pill */}
        <span style={{
          background: health.isOnline ? "#10b98115" : "#6b728015",
          border: `1px solid ${health.isOnline ? "#10b98130" : "#6b728030"}`,
          color: health.isOnline ? "#10b981" : "#9ca3af",
          borderRadius: 99, padding: "2px 8px", fontSize: 9, fontWeight: 700, flexShrink: 0,
        }}>{health.isOnline ? "Online" : "Offline"}</span>
      </div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 12 }}>
        {[
          { label: "Syncs",   value: health.syncCount,                          color: "#3b82f6" },
          { label: "Ping",    value: health.latency !== null ? `${health.latency}ms` : "—", color: latColor(health.latency) },
          { label: "Uptime",  value: fmtUptime(health.uptime),                  color: "#8b5cf6" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: card, border: `1px solid ${border}`, borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
            <p style={{ color: muted, fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
            <p style={{ color, fontWeight: 800, fontSize: 12, marginTop: 1 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Freshness bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ color: muted, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Data Freshness</span>
          <span style={{ color: freshnessColor(health.freshnessPercent), fontSize: 9, fontWeight: 800 }}>{health.freshnessPercent}%</span>
        </div>
        <div style={{ height: 4, borderRadius: 99, background: t?._dm ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)", overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${health.freshnessPercent}%`, borderRadius: 99,
            background: freshnessColor(health.freshnessPercent),
            transition: "width 1s ease, background 0.5s ease",
            boxShadow: `0 0 6px ${freshnessColor(health.freshnessPercent)}60`,
          }} />
        </div>
      </div>

      {/* Last sync age + avg latency */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: muted, fontSize: 9 }}>
          {health.timeSinceSync !== null ? `Updated ${fmtAge(health.timeSinceSync)}` : "Not yet synced"}
        </span>
        {health.avgLatency !== null && (
          <span style={{ color: muted, fontSize: 9 }}>avg {health.avgLatency}ms</span>
        )}
      </div>

      {/* Error banner */}
      {health.errorCount > 0 && (
        <div style={{ marginTop: 10, background: "#ef444410", border: "1px solid #ef444430", borderRadius: 8, padding: "6px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ color: "#ef4444", fontSize: 10, fontWeight: 700 }}>{health.errorCount} error{health.errorCount !== 1 ? "s" : ""} detected</p>
          <button onClick={health.clearError} style={{ background: "transparent", border: "none", color: "#ef4444", fontSize: 10, cursor: "pointer", fontWeight: 700 }}>✕</button>
        </div>
      )}

      <style>{`@keyframes sdPing{0%,100%{transform:scale(1);opacity:0.2}50%{transform:scale(1.8);opacity:0}}`}</style>
    </WidgetCard>
  );
}

function CashFlowWidget({ t, customers, expenses, today, inr, editMode, onRemove }) {
  const month       = today().slice(0, 7);
  const collected   = customers.reduce((s, c) => s + (c.paid || 0), 0);
  const outstanding = customers.reduce((s, c) => s + (c.pending || 0), 0);
  const monthExp    = expenses.filter(e => (e.date || "").startsWith(month)).reduce((s, e) => s + (e.amount || 0), 0);
  const total       = collected + outstanding + 0.001;

  return (
    <WidgetCard icon="💰" title="Cash Flow" t={t} accent="#10b981" editMode={editMode} onRemove={onRemove}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
        {[
          { label: "Collected",    val: inr(collected),   color: "#10b981" },
          { label: "Outstanding",  val: inr(outstanding), color: outstanding > 0 ? "#ef4444" : "#10b981" },
          { label: "Month Exp",    val: inr(monthExp),    color: "#ef4444" },
        ].map(s => (
          <div key={s.label} style={{ background: `${s.color}10`, border: `1px solid ${s.color}20`, borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
            <p style={{ color: s.color, fontWeight: 900, fontSize: 12, lineHeight: 1 }}>{s.val}</p>
            <p style={{ color: t?.sub, fontSize: 8, marginTop: 4, fontWeight: 600, textTransform: "uppercase" }}>{s.label}</p>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, height: 6, borderRadius: 6, background: t?.border, overflow: "hidden", display: "flex" }}>
        <div style={{ flex: collected, background: "#10b981" }} />
        <div style={{ flex: outstanding, background: "#ef4444" }} />
      </div>
      <p style={{ color: t?.sub, fontSize: 9, marginTop: 4, textAlign: "center" }}>
        {Math.round(collected / total * 100)}% collection rate
      </p>
    </WidgetCard>
  );
}

// ══════════════════════════════════════════════════════════════
// NEW WIDGETS
// ══════════════════════════════════════════════════════════════

// ── Clock & Date ──────────────────────────────────────────────
function ClockWidget({ t, editMode, onRemove }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const hh = now.getHours(), mm = now.getMinutes(), ss = now.getSeconds();
  const deg = { h: (hh % 12) * 30 + mm * 0.5, m: mm * 6, s: ss * 6 };
  const dateStr = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const cx = 60, cy = 60, r = 52;

  return (
    <WidgetCard icon="🕐" title="Clock & Date" t={t} accent="#6366f1" editMode={editMode} onRemove={onRemove}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        {/* Analog clock */}
        <svg width={120} height={120} viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={t?.border || "rgba(255,255,255,0.1)"} strokeWidth={2} />
          {[...Array(12)].map((_, i) => {
            const a = (i * 30 - 90) * Math.PI / 180;
            const inner = i % 3 === 0 ? r - 10 : r - 6;
            return <line key={i}
              x1={cx + Math.cos(a) * inner} y1={cy + Math.sin(a) * inner}
              x2={cx + Math.cos(a) * r}     y2={cy + Math.sin(a) * r}
              stroke={t?.sub || "#6b7280"} strokeWidth={i % 3 === 0 ? 2 : 1} />;
          })}
          {/* Hour hand */}
          {(() => { const a = (deg.h - 90) * Math.PI / 180; return <line x1={cx} y1={cy} x2={cx + Math.cos(a) * 28} y2={cy + Math.sin(a) * 28} stroke={t?.text || "#f9fafb"} strokeWidth={3} strokeLinecap="round" />; })()}
          {/* Minute hand */}
          {(() => { const a = (deg.m - 90) * Math.PI / 180; return <line x1={cx} y1={cy} x2={cx + Math.cos(a) * 40} y2={cy + Math.sin(a) * 40} stroke={t?.text || "#f9fafb"} strokeWidth={2} strokeLinecap="round" />; })()}
          {/* Second hand */}
          {(() => { const a = (deg.s - 90) * Math.PI / 180; return <line x1={cx} y1={cy} x2={cx + Math.cos(a) * 44} y2={cy + Math.sin(a) * 44} stroke="#ef4444" strokeWidth={1} strokeLinecap="round" />; })()}
          <circle cx={cx} cy={cy} r={3} fill="#6366f1" />
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: t?.text, fontWeight: 900, fontSize: 22, letterSpacing: "-0.5px", fontVariantNumeric: "tabular-nums" }}>{timeStr}</p>
          <p style={{ color: t?.sub, fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>{dateStr}</p>
        </div>
      </div>
    </WidgetCard>
  );
}

// ── Expense Breakdown ─────────────────────────────────────────
function ExpenseBreakdownWidget({ t, expenses, inr, editMode, onRemove }) {
  const cats = {};
  (expenses || []).forEach(e => {
    const k = e.category || e.type || "Other";
    cats[k] = (cats[k] || 0) + (e.amount || 0);
  });
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const total  = sorted.reduce((s, [, v]) => s + v, 0) || 1;
  const COLORS  = ["#6366f1","#f59e0b","#10b981","#ef4444","#3b82f6","#8b5cf6"];

  // simple donut via conic-gradient
  const stops = [];
  let cum = 0;
  sorted.forEach(([, v], i) => {
    const pct = v / total * 100;
    stops.push(`${COLORS[i]} ${cum}% ${cum + pct}%`);
    cum += pct;
  });

  return (
    <WidgetCard icon="🥧" title="Expense Breakdown" t={t} accent="#6366f1" editMode={editMode} onRemove={onRemove}>
      {sorted.length === 0
        ? <p style={{ color: t?.sub, fontSize: 12, textAlign: "center" }}>No expense data</p>
        : <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: `conic-gradient(${stops.join(",")})`, flexShrink: 0, boxShadow: "0 2px 12px rgba(0,0,0,0.2)" }} />
            <div style={{ flex: 1, minWidth: 100 }}>
              {sorted.map(([cat, val], i) => (
                <div key={cat} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i], flexShrink: 0 }} />
                  <span style={{ color: t?.text, fontSize: 10, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat}</span>
                  <span style={{ color: COLORS[i], fontSize: 10, fontWeight: 800 }}>{Math.round(val / total * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
      }
      <p style={{ color: t?.sub, fontSize: 9, marginTop: 8, textAlign: "right" }}>Total: {inr(total)}</p>
    </WidgetCard>
  );
}

// ── Product Sales ─────────────────────────────────────────────
function ProductSalesWidget({ t, deliveries, products, inr, lineTotal, editMode, onRemove }) {
  const salesMap = {};
  (deliveries || []).filter(d => d.status === "Delivered").forEach(d => {
    (d.orderLines || []).forEach(line => {
      const k = line.product || line.item || "Unknown";
      if (!salesMap[k]) salesMap[k] = { qty: 0, rev: 0 };
      salesMap[k].qty += line.qty || 0;
      salesMap[k].rev += (line.qty || 0) * (line.price || 0);
    });
  });
  const sorted = Object.entries(salesMap).sort((a, b) => b[1].rev - a[1].rev).slice(0, 5);
  const maxRev  = sorted[0]?.[1].rev || 1;

  return (
    <WidgetCard icon="🛒" title="Product Sales" t={t} accent="#f59e0b" editMode={editMode} onRemove={onRemove}>
      {sorted.length === 0
        ? <p style={{ color: t?.sub, fontSize: 12, textAlign: "center" }}>No sales data yet</p>
        : sorted.map(([name, { qty, rev }], i) => (
            <div key={name} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ color: t?.text, fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>{name}</span>
                <span style={{ color: "#f59e0b", fontWeight: 800, fontSize: 11 }}>{inr(rev)}</span>
              </div>
              <div style={{ height: 4, borderRadius: 4, background: t?.border, overflow: "hidden" }}>
                <div style={{ width: `${Math.round(rev / maxRev * 100)}%`, height: "100%", background: `hsl(${40 - i * 6},90%,${55 - i * 4}%)`, borderRadius: 4, transition: "width 0.6s ease" }} />
              </div>
              <p style={{ color: t?.sub, fontSize: 9, marginTop: 2 }}>{qty} units sold</p>
            </div>
          ))
      }
    </WidgetCard>
  );
}

// ── Goal Tracker ──────────────────────────────────────────────
function GoalTrackerWidget({ t, deliveries, customers, expenses, inr, today, editMode, onRemove }) {
  const month = today().slice(0, 7);
  const monthDeliveries = (deliveries || []).filter(d => (d.date || "").startsWith(month) && d.status === "Delivered");
  const monthRev = monthDeliveries.reduce((s, d) => {
    return s + (d.orderLines || []).reduce((ss, l) => ss + (l.qty || 0) * (l.price || 0), 0);
  }, 0);
  const monthCust = new Set(monthDeliveries.map(d => d.customerId)).size;
  const monthExp  = (expenses || []).filter(e => (e.date || "").startsWith(month)).reduce((s, e) => s + (e.amount || 0), 0);

  // Hardcoded monthly goals — in a real app these'd come from settings
  const goals = [
    { label: "Monthly Revenue", current: monthRev, target: 500000, color: "#10b981", fmt: inr },
    { label: "Orders Delivered", current: monthDeliveries.length, target: 60,  color: "#3b82f6", fmt: v => v },
    { label: "Active Customers", current: monthCust,  target: 30,  color: "#f59e0b", fmt: v => v },
    { label: "Keep Expenses Under", current: monthExp, target: 100000, color: "#ef4444", fmt: inr, inverse: true },
  ];

  return (
    <WidgetCard icon="🎯" title="Monthly Goals" t={t} accent="#10b981" editMode={editMode} onRemove={onRemove}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {goals.map(g => {
          const raw = Math.min(100, Math.round(g.current / g.target * 100));
          const pct  = g.inverse ? Math.max(0, 100 - raw) : raw;
          const col  = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
          return (
            <div key={g.label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: t?.text, fontSize: 11, fontWeight: 600 }}>{g.label}</span>
                <span style={{ color: col, fontSize: 11, fontWeight: 800 }}>{pct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 6, background: t?.border, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: g.color, borderRadius: 6, transition: "width 0.7s ease", boxShadow: `0 0 6px ${g.color}60` }} />
              </div>
              <p style={{ color: t?.sub, fontSize: 9, marginTop: 2 }}>{g.fmt(g.current)} / {g.fmt(g.target)}</p>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}

// ── Mini Calendar ─────────────────────────────────────────────
function MiniCalendarWidget({ t, deliveries, today, editMode, onRemove }) {
  const [viewDate, setViewDate] = useState(new Date());
  const yr = viewDate.getFullYear(), mo = viewDate.getMonth();
  const firstDay = new Date(yr, mo, 1).getDay();
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  const todayStr = today();
  const monthStr = `${yr}-${String(mo + 1).padStart(2, "0")}`;
  const delivDates = new Set((deliveries || []).filter(d => (d.date || "").startsWith(monthStr)).map(d => d.date));
  const days = ["Su","Mo","Tu","We","Th","Fr","Sa"];

  return (
    <WidgetCard icon="📅" title="Mini Calendar" t={t} accent="#3b82f6" editMode={editMode} onRemove={onRemove}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <button onClick={() => setViewDate(new Date(yr, mo - 1, 1))} style={{ background: "none", border: "none", color: t?.sub, cursor: "pointer", fontSize: 16, padding: "0 4px" }}>‹</button>
        <span style={{ color: t?.text, fontWeight: 700, fontSize: 12 }}>{viewDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</span>
        <button onClick={() => setViewDate(new Date(yr, mo + 1, 1))} style={{ background: "none", border: "none", color: t?.sub, cursor: "pointer", fontSize: 16, padding: "0 4px" }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
        {days.map(d => <div key={d} style={{ textAlign: "center", color: t?.sub, fontSize: 9, fontWeight: 700, padding: "2px 0" }}>{d}</div>)}
        {[...Array(firstDay)].map((_, i) => <div key={`e${i}`} />)}
        {[...Array(daysInMonth)].map((_, i) => {
          const day = i + 1;
          const dateStr = `${monthStr}-${String(day).padStart(2, "0")}`;
          const isToday = dateStr === todayStr;
          const hasDelivery = delivDates.has(dateStr);
          return (
            <div key={day} style={{ textAlign: "center", position: "relative" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 22, height: 22, borderRadius: "50%", fontSize: 10, fontWeight: isToday ? 900 : 500,
                background: isToday ? "#3b82f6" : "transparent",
                color: isToday ? "#fff" : t?.text,
              }}>{day}</span>
              {hasDelivery && !isToday && <span style={{ position: "absolute", bottom: 1, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: "#10b981", display: "block" }} />}
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}

// ── Waste Tracker ─────────────────────────────────────────────
function WasteTrackerWidget({ t, wastage, inr, today, editMode, onRemove }) {
  const month = today().slice(0, 7);
  const monthWaste = (wastage || []).filter(w => (w.date || "").startsWith(month));
  const byType = {};
  monthWaste.forEach(w => {
    const k = w.item || w.product || "Other";
    if (!byType[k]) byType[k] = { qty: 0, cost: 0 };
    byType[k].qty  += w.qty || 0;
    byType[k].cost += w.cost || 0;
  });
  const sorted = Object.entries(byType).sort((a, b) => b[1].cost - a[1].cost).slice(0, 5);
  const totalCost = monthWaste.reduce((s, w) => s + (w.cost || 0), 0);

  return (
    <WidgetCard icon="♻️" title="Waste Tracker" t={t} accent="#f97316" editMode={editMode} onRemove={onRemove}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ color: t?.sub, fontSize: 10 }}>This month</span>
        <span style={{ color: "#ef4444", fontWeight: 900, fontSize: 14 }}>{inr(totalCost)}</span>
      </div>
      {sorted.length === 0
        ? <p style={{ color: t?.sub, fontSize: 12, textAlign: "center" }}>No waste recorded 🎉</p>
        : sorted.map(([item, { qty, cost }]) => (
            <div key={item} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ color: t?.text, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "55%" }}>♻️ {item}</span>
              <span style={{ color: t?.sub, fontSize: 10 }}>{qty} units</span>
              <span style={{ color: "#f97316", fontSize: 11, fontWeight: 700 }}>{inr(cost)}</span>
            </div>
          ))
      }
    </WidgetCard>
  );
}

// ── Vehicle Status ────────────────────────────────────────────
function VehicleStatusWidget({ t, deliveries, today, editMode, onRemove }) {
  const tStr = today();
  // Derive vehicle activity from deliveries that have a vehicle field
  const active = (deliveries || []).filter(d => d.date === tStr && d.vehicle && d.status === "In Transit");
  const done   = (deliveries || []).filter(d => d.date === tStr && d.vehicle && d.status === "Delivered");
  const vehicles = [...new Set((deliveries || []).filter(d => d.vehicle).map(d => d.vehicle))];
  const vehicleStats = vehicles.slice(0, 5).map(v => {
    const vDeliveries = (deliveries || []).filter(d => d.vehicle === v && d.date === tStr);
    return {
      name: v,
      total: vDeliveries.length,
      done: vDeliveries.filter(d => d.status === "Delivered").length,
      active: vDeliveries.filter(d => d.status === "In Transit").length,
    };
  });

  return (
    <WidgetCard icon="🚛" title="Vehicle Status" t={t} accent="#0ea5e9" editMode={editMode} onRemove={onRemove}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
        {[
          { label: "Vehicles",  val: vehicles.length, color: "#0ea5e9" },
          { label: "En Route",  val: active.length,   color: "#f59e0b" },
          { label: "Completed", val: done.length,      color: "#10b981" },
        ].map(s => (
          <div key={s.label} style={{ background: `${s.color}10`, border: `1px solid ${s.color}25`, borderRadius: 10, padding: "8px", textAlign: "center" }}>
            <p style={{ color: s.color, fontWeight: 900, fontSize: 18, lineHeight: 1 }}>{s.val}</p>
            <p style={{ color: t?.sub, fontSize: 8, marginTop: 3, fontWeight: 600, textTransform: "uppercase" }}>{s.label}</p>
          </div>
        ))}
      </div>
      {vehicleStats.length === 0
        ? <p style={{ color: t?.sub, fontSize: 11, textAlign: "center" }}>No vehicle data today</p>
        : vehicleStats.map(v => (
            <div key={v.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 14 }}>🚛</span>
              <span style={{ color: t?.text, fontSize: 11, flex: 1, fontWeight: 600 }}>{v.name}</span>
              <span style={{ background: "#f59e0b20", color: "#f59e0b", borderRadius: 6, padding: "2px 6px", fontSize: 9, fontWeight: 700 }}>{v.active} active</span>
              <span style={{ background: "#10b98120", color: "#10b981", borderRadius: 6, padding: "2px 6px", fontSize: 9, fontWeight: 700 }}>{v.done} done</span>
            </div>
          ))
      }
    </WidgetCard>
  );
}

// ── Notice Board ──────────────────────────────────────────────
function NoticeBoardWidget({ t, notices = [], setNotices, editMode, onRemove }) {
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  const addNotice = () => {
    if (!draft.trim()) return;
    const next = [{ id: Date.now(), text: draft.trim(), ts: new Date().toISOString() }, ...(notices || [])].slice(0, 8);
    setNotices?.(next);
    setDraft(""); setAdding(false);
  };
  const removeNotice = id => setNotices?.((notices || []).filter(n => n.id !== id));

  return (
    <WidgetCard icon="📌" title="Notice Board" t={t} accent="#ec4899" editMode={editMode} onRemove={onRemove}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
        {(notices || []).slice(0, 5).map(n => (
          <div key={n.id} style={{ display: "flex", gap: 8, background: "#ec489910", border: "1px solid #ec489920", borderRadius: 10, padding: "8px 10px" }}>
            <span style={{ fontSize: 12, flexShrink: 0 }}>📌</span>
            <p style={{ color: t?.text, fontSize: 11, flex: 1, lineHeight: 1.4 }}>{n.text}</p>
            <button onClick={() => removeNotice(n.id)} style={{ background: "none", border: "none", color: t?.sub, cursor: "pointer", fontSize: 12, flexShrink: 0, padding: 0 }}>×</button>
          </div>
        ))}
        {(notices || []).length === 0 && !adding && <p style={{ color: t?.sub, fontSize: 11, textAlign: "center" }}>No notices pinned</p>}
      </div>
      {adding
        ? <div style={{ display: "flex", gap: 6 }}>
            <input
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addNotice(); if (e.key === "Escape") setAdding(false); }}
              placeholder="Type notice…"
              style={{ flex: 1, background: t?.inp, border: `1px solid #ec489940`, borderRadius: 8, padding: "6px 10px", color: t?.text, fontSize: 12, outline: "none" }}
            />
            <button onClick={addNotice} style={{ background: "#ec489920", border: "1px solid #ec489940", color: "#ec4899", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Pin</button>
            <button onClick={() => setAdding(false)} style={{ background: "none", border: `1px solid ${t?.border}`, color: t?.sub, borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>✕</button>
          </div>
        : <button onClick={() => setAdding(true)} style={{ width: "100%", background: "#ec489910", border: "1px dashed #ec489940", color: "#ec4899", borderRadius: 8, padding: "7px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Add Notice</button>
      }
    </WidgetCard>
  );
}

// ── Widget renderer ───────────────────────────────────────────
function renderWidget(id, props) {
  const map = {
    quickStats:        QuickStatsWidget,
    todayDispatches:   TodayDispatchesWidget,
    pendingInvoices:   PendingInvoicesWidget,
    inventoryAlerts:   InventoryAlertsWidget,
    delayedDeliveries: DelayedDeliveriesWidget,
    topCustomers:      TopCustomersWidget,
    revenueTrend:      RevenueTrendWidget,
    productionEff:     ProductionEffWidget,
    staffActivity:     StaffActivityWidget,
    recentActions:     RecentActionsWidget,
    syncStatus:        SyncStatusWidget,
    cashFlow:          CashFlowWidget,
    // new
    clockWidget:       ClockWidget,
    expenseBreakdown:  ExpenseBreakdownWidget,
    productSales:      ProductSalesWidget,
    goalTracker:       GoalTrackerWidget,
    miniCalendar:      MiniCalendarWidget,
    wasteTracker:      WasteTrackerWidget,
    vehicleStatus:     VehicleStatusWidget,
    noticeBoard:       NoticeBoardWidget,
  };
  const W = map[id];
  return W ? <W key={id} {...props} /> : null;
}

// ══════════════════════════════════════════════════════════════
// MAIN SmartDashboard
// ══════════════════════════════════════════════════════════════
export function SmartDashboard({
  sess, settings, dm, t, isAdmin, can,
  canSeeFinancials, canSeePrices,
  customers = [], deliveries = [], expenses = [], supplies = [],
  wastage = [], products = [], actLog = [], paymentLedger = [],
  dashStats, chartData = [], lowStockItems = [],
  churnedCustomers = [], churnDays = 30, allBatches = [],
  notices = [], setNotices,
  setTab, setDetailModal,
  setDsh, setDf, blkD,
  setCsh, setCf, blkC,
  setEsh, setEf, blkE,
  setSsh, setSf, blkS,
  setWSh, setWF, blkW,
  setPaySh,
  inr, lineTotal, today,
  userDashWidgets, setUserDashWidgets,
  _syncListeners,
}) {
  const tFull = { ...t, _dm: dm };

  const [widgetOrder, setWidgetOrder] = useState(() =>
    userDashWidgets && Array.isArray(userDashWidgets) ? userDashWidgets : DEFAULT_WIDGET_ORDER
  );
  const [editMode,      setEditMode]      = useState(false);
  const [showAddPanel,  setShowAddPanel]  = useState(false);

  const saveOrder = useCallback(order => {
    setWidgetOrder(order);
    setUserDashWidgets?.(order);
  }, [setUserDashWidgets]);

  const removeWidget = id => saveOrder(widgetOrder.filter(w => w !== id));
  const addWidget    = id => { saveOrder([...widgetOrder, id]); setShowAddPanel(false); };
  const resetLayout  = () => { saveOrder(DEFAULT_WIDGET_ORDER); setShowAddPanel(false); };

  const sharedProps = {
    t: tFull, dm,
    customers, deliveries, expenses, supplies, wastage, products,
    actLog, paymentLedger, allBatches,
    chartData, lowStockItems, dashStats, settings,
    inr, lineTotal, today,
    notices, setNotices,
    setTab, setDetailModal,
    setDsh, setDf, blkD,
    _syncListeners,
  };

  const availableToAdd = WIDGET_DEFS.filter(w =>
    !widgetOrder.includes(w.id) && (w.roles.includes(sess?.role) || isAdmin)
  );

  const greet = (() => {
    const h = new Date().getHours();
    return h < 12 ? "🌅 Good morning" : h < 17 ? "☀️ Good afternoon" : "🌙 Good evening";
  })();

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div>
          <p style={{ color: t?.text, fontWeight: 800, fontSize: 15 }}>{greet}, {sess?.name?.split(" ")[0] || ""}</p>
          <p style={{ color: t?.sub, fontSize: 11, marginTop: 2 }}>
            {widgetOrder.length} widgets · {editMode ? "Drag cards to reorder" : "Click ✏️ Edit to customise"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {editMode && (<>
            <button onClick={() => setShowAddPanel(p => !p)}
              style={{ background: "#3b82f620", border: "1px solid #3b82f640", color: "#3b82f6", borderRadius: 10, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              + Add
            </button>
            <button onClick={resetLayout}
              style={{ background: t?.inp, border: `1px solid ${t?.border}`, color: t?.sub, borderRadius: 10, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              ↺ Reset
            </button>
          </>)}
          <button
            onClick={() => { setEditMode(e => !e); setShowAddPanel(false); }}
            style={{
              background: editMode ? "#10b98120" : t?.inp,
              border: `1px solid ${editMode ? "#10b98140" : t?.border}`,
              color: editMode ? "#10b981" : t?.sub,
              borderRadius: 10, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >{editMode ? "✓ Done" : "✏️ Edit"}</button>
        </div>
      </div>

      {/* Add widget panel */}
      {showAddPanel && availableToAdd.length > 0 && (
        <div style={{ background: t?.card, border: `1px solid ${t?.border}`, borderRadius: 16, padding: 14, marginBottom: 14 }}>
          <p style={{ color: t?.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>Add Widget</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {availableToAdd.map(w => (
              <button key={w.id} onClick={() => addWidget(w.id)}
                style={{ background: t?.inp, border: `1px solid ${t?.border}`, color: t?.text, borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                {w.icon} {w.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Drag grid */}
      <DragGrid
        items={widgetOrder}
        onReorder={saveOrder}
        editMode={editMode}
        renderItem={(id, em) => renderWidget(id, {
          ...sharedProps,
          editMode: em,
          onRemove: em ? () => removeWidget(id) : undefined,
        })}
      />
    </div>
  );
}
