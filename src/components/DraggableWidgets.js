// ============================================================
// src/components/DraggableWidgets.js
//
// Drag-and-drop widget order manager for the Dashboard.
// Provides:
//   - useDraggableWidgets hook: drag state + handlers
//   - WidgetCustomizer: a settings panel to add/remove/reorder widgets
//   - DraggableWidget: wrapper div that makes any widget draggable
//   - WidgetCustomizerButton: trigger button for the customizer panel
//
// USAGE in SmartDashboard (or wherever DashboardTab is rendered):
//
//   import { useDraggableWidgets, DraggableWidget, WidgetCustomizer, WidgetCustomizerButton } from "./DraggableWidgets";
//
//   const { widgets, dragHandlers, customizerOpen, setCustOpen, reorderWidgets } =
//     useDraggableWidgets({ userDashWidgets, setUserDashWidgets, settings, featureOn });
//
//   // Wrap each dashboard section:
//   <DraggableWidget id="stats" {...dragHandlers}>
//     <StatsSection ... />
//   </DraggableWidget>
//
//   // Place the customizer panel + button somewhere:
//   <WidgetCustomizerButton dm={dm} t={t} onClick={() => setCustOpen(true)} />
//   <WidgetCustomizer
//     open={custOpen}
//     onClose={() => setCustOpen(false)}
//     widgets={widgets}
//     onSave={reorderWidgets}
//     dm={dm} t={t}
//   />
// ============================================================

import React, { useState, useRef, useCallback, useEffect } from "react";

// ── Widget catalogue ──────────────────────────────────────────
export const WIDGET_CATALOGUE = [
  { id: "stats",            label: "Stats Overview",       icon: "📊", description: "Revenue, deliveries, and KPI cards",   alwaysOn: true },
  { id: "chart",            label: "Revenue Chart",        icon: "📈", description: "Weekly revenue bar/line chart" },
  { id: "pendingDeliveries",label: "Pending Deliveries",   icon: "🚚", description: "Today's pending and in-transit orders" },
  { id: "outstanding",      label: "Outstanding Payments", icon: "💳", description: "Customers with unpaid balances" },
  { id: "aiInsights",       label: "AI Insights",          icon: "🤖", description: "Smart patterns detected in your data",  adminOnly: true },
  { id: "activityFeed",     label: "Activity Feed",        icon: "📡", description: "Recent operations live feed" },
  { id: "weather",          label: "Weather",              icon: "🌤️", description: "Local weather widget" },
  { id: "quickActions",     label: "Quick Actions",        icon: "⚡", description: "One-tap shortcuts to common tasks" },
  { id: "topCustomers",     label: "Top Customers",        icon: "🏆", description: "Top customers by spend",               adminOnly: true },
  { id: "production",       label: "Production Status",    icon: "🏭", description: "Today's batch targets and progress" },
  { id: "notices",          label: "Notice Board",         icon: "📌", description: "Pinned announcements" },
  { id: "lowStock",         label: "Low Stock Alert",      icon: "⚠️", description: "Items below minimum stock threshold" },
];

const DEFAULT_WIDGETS = ["stats", "chart", "pendingDeliveries", "outstanding"];

// ── Hook ──────────────────────────────────────────────────────
export function useDraggableWidgets({ userDashWidgets, setUserDashWidgets, settings, featureOn, isAdmin }) {
  const [customizerOpen, setCustOpen] = useState(false);
  const [dragState, setDragState] = useState({ dragging: null, over: null });
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  // Resolve active widget list
  const widgets = featureOn && userDashWidgets != null
    ? userDashWidgets
    : (settings?.dashWidgets || DEFAULT_WIDGETS);

  // Save a new widget order/list
  const reorderWidgets = useCallback((newList) => {
    setUserDashWidgets(newList);
  }, [setUserDashWidgets]);

  // ── HTML5 drag handlers ──
  const onDragStart = useCallback((id) => (e) => {
    dragItem.current = id;
    setDragState(s => ({ ...s, dragging: id }));
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }, []);

  const onDragEnter = useCallback((id) => (e) => {
    e.preventDefault();
    dragOverItem.current = id;
    setDragState(s => ({ ...s, over: id }));
  }, []);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback((id) => (e) => {
    e.preventDefault();
    const from = dragItem.current;
    const to   = id;
    if (!from || from === to) return;
    const next = [...widgets];
    const fi   = next.indexOf(from);
    const ti   = next.indexOf(to);
    if (fi === -1 || ti === -1) return;
    next.splice(fi, 1);
    next.splice(ti, 0, from);
    reorderWidgets(next);
    setDragState({ dragging: null, over: null });
    dragItem.current = null;
    dragOverItem.current = null;
  }, [widgets, reorderWidgets]);

  const onDragEnd = useCallback(() => {
    setDragState({ dragging: null, over: null });
    dragItem.current = null;
    dragOverItem.current = null;
  }, []);

  const dragHandlers = { onDragStart, onDragEnter, onDragOver, onDrop, onDragEnd, dragState };

  return { widgets, dragHandlers, customizerOpen, setCustOpen, reorderWidgets };
}

// ── DraggableWidget wrapper ───────────────────────────────────
export function DraggableWidget({ id, children, dragHandlers, featureOn, dm, t }) {
  if (!featureOn || !dragHandlers) return <>{children}</>;

  const { onDragStart, onDragEnter, onDragOver, onDrop, onDragEnd, dragState } = dragHandlers;
  const isDragging = dragState.dragging === id;
  const isOver     = dragState.over === id && dragState.dragging !== id;

  const border = t?.border || (dm ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)");

  return (
    <div
      draggable
      onDragStart={onDragStart(id)}
      onDragEnter={onDragEnter(id)}
      onDragOver={onDragOver}
      onDrop={onDrop(id)}
      onDragEnd={onDragEnd}
      style={{
        opacity: isDragging ? 0.4 : 1,
        outline: isOver ? `2px dashed #6366f1` : "2px solid transparent",
        outlineOffset: 4,
        borderRadius: 16,
        transition: "opacity 0.15s, outline 0.1s",
        cursor: dragState.dragging ? "grabbing" : "grab",
        position: "relative",
      }}
    >
      {/* Drag handle hint — top right */}
      <div style={{
        position: "absolute", top: 8, right: 8, zIndex: 10,
        opacity: 0, transition: "opacity 0.15s",
        fontSize: 12, color: t?.sub || (dm ? "#94a3b8" : "#64748b"),
        pointerEvents: "none",
        background: dm ? "rgba(15,23,42,0.8)" : "rgba(248,250,252,0.9)",
        borderRadius: 6, padding: "2px 6px",
        border: `1px solid ${border}`,
      }}
        className="drag-handle-hint"
      >⠿ drag</div>
      <style>{`.drag-handle-hint{opacity:0!important} [draggable]:hover .drag-handle-hint{opacity:1!important}`}</style>
      {children}
    </div>
  );
}

// ── Widget Customizer Button ──────────────────────────────────
export function WidgetCustomizerButton({ dm, t, onClick }) {
  const inp    = t?.inp    || (dm ? "#1e293b" : "#f8fafc");
  const border = t?.border || (dm ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)");
  const sub    = t?.sub    || (dm ? "#94a3b8" : "#64748b");

  return (
    <button
      onClick={onClick}
      title="Customise Dashboard"
      style={{
        background: inp, border: `1px solid ${border}`,
        borderRadius: 10, padding: "7px 10px",
        cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        color: sub, fontSize: 13, fontWeight: 600,
        transition: "background 0.15s",
      }}
      onMouseEnter={e => e.currentTarget.style.background = dm ? "#334155" : "#f1f5f9"}
      onMouseLeave={e => e.currentTarget.style.background = inp}
    >
      ⚙️
    </button>
  );
}

// ── Widget Customizer Panel ───────────────────────────────────
export function WidgetCustomizer({ open, onClose, widgets, onSave, dm, t, isAdmin }) {
  const [local, setLocal] = useState([]);
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  const text   = t?.text   || (dm ? "#f1f5f9" : "#0f172a");
  const sub    = t?.sub    || (dm ? "#94a3b8" : "#64748b");
  const card   = t?.card   || (dm ? "#1e293b" : "#ffffff");
  const inp    = t?.inp    || (dm ? "#0f172a" : "#f8fafc");
  const border = t?.border || (dm ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)");

  useEffect(() => {
    if (open) setLocal([...widgets]);
  }, [open, widgets]);

  if (!open) return null;

  const available = isAdmin
    ? WIDGET_CATALOGUE
    : WIDGET_CATALOGUE.filter(w => !w.adminOnly);

  const isActive = (id) => local.includes(id);

  const toggle = (id) => {
    const w = WIDGET_CATALOGUE.find(w => w.id === id);
    if (w?.alwaysOn) return;
    setLocal(l => l.includes(id) ? l.filter(x => x !== id) : [...l, id]);
  };

  // Drag to reorder active widgets list
  const handleDragStart = (i) => setDragIdx(i);
  const handleDragEnter = (i) => setOverIdx(i);
  const handleDrop = () => {
    if (dragIdx === null || overIdx === null || dragIdx === overIdx) {
      setDragIdx(null); setOverIdx(null); return;
    }
    const next = [...local];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(overIdx, 0, moved);
    setLocal(next);
    setDragIdx(null); setOverIdx(null);
  };

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 1000, backdropFilter: "blur(2px)",
      }} />

      <div style={{
        position: "fixed",
        ...(window.innerWidth < 640 ? {
          left: 0, right: 0, bottom: 0,
          top: "auto",
          width: "100%",
          maxHeight: "92vh",
          borderRadius: "20px 20px 0 0",
          borderLeft: "none",
          borderTop: `1px solid ${border}`,
        } : {
          top: 0, right: 0, bottom: 0,
          width: "min(480px, 100vw)",
          borderLeft: `1px solid ${border}`,
          borderRadius: 0,
        }),
        background: card,
        zIndex: 1001,
        display: "flex", flexDirection: "column",
        boxShadow: window.innerWidth < 640 ? "0 -8px 40px rgba(0,0,0,0.25)" : "-8px 0 40px rgba(0,0,0,0.25)",
      }}>
        {/* Header */}
        <div style={{
          padding: window.innerWidth < 640 ? "12px 16px 12px" : "18px 20px 14px",
          borderBottom: `1px solid ${border}`,
          flexShrink: 0,
        }}>
          {/* Drag handle — mobile only */}
          {window.innerWidth < 640 && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <div style={{ width: 36, height: 4, borderRadius: 99, background: border }} />
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>⚙️</span>
                <span style={{ color: text, fontWeight: 800, fontSize: 15 }}>Customise Dashboard</span>
              </div>
              <p style={{ color: sub, fontSize: 11, marginTop: 3 }}>
                Toggle and drag to reorder your dashboard widgets
              </p>
            </div>
            <button onClick={onClose} style={{
              background: "transparent", border: "none",
              color: sub, fontSize: 20, cursor: "pointer",
              padding: "8px", borderRadius: 10,
              minWidth: 36, minHeight: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>✕</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px", WebkitOverflowScrolling: "touch" }}>

          {/* Active widget order */}
          <p style={{ color: sub, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 8 }}>
            Active Widgets (drag to reorder)
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 20 }}>
            {local.map((id, i) => {
              const w = WIDGET_CATALOGUE.find(x => x.id === id);
              if (!w) return null;
              return (
                <div key={id}
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragEnter={() => handleDragEnter(i)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDrop}
                  onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "11px 14px",
                    background: inp,
                    border: `1px solid ${overIdx === i && dragIdx !== i ? "#6366f1" : border}`,
                    borderRadius: 12,
                    cursor: "grab",
                    opacity: dragIdx === i ? 0.4 : 1,
                    transition: "border 0.1s, opacity 0.15s",
                  }}
                >
                  <span style={{ color: sub, fontSize: 14 }}>⠿</span>
                  <span style={{ fontSize: 16 }}>{w.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: text, fontSize: 13, fontWeight: 700 }}>{w.label}</p>
                    <p style={{ color: sub, fontSize: 11 }}>{w.description}</p>
                  </div>
                  {w.alwaysOn
                    ? <span style={{ color: sub, fontSize: 10, fontWeight: 700 }}>Always on</span>
                    : (
                      <button onClick={() => toggle(id)} style={{
                        background: "#ef444415", color: "#ef4444",
                        border: "1px solid #ef444430",
                        borderRadius: 7, padding: "4px 10px",
                        fontSize: 11, fontWeight: 700, cursor: "pointer",
                      }}>Remove</button>
                    )
                  }
                </div>
              );
            })}
          </div>

          {/* Available to add */}
          <p style={{ color: sub, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 8 }}>
            Available Widgets
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {available.filter(w => !isActive(w.id)).map(w => (
              <div key={w.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "11px 14px",
                background: inp,
                border: `1px solid ${border}`,
                borderRadius: 12,
                opacity: 0.7,
              }}>
                <span style={{ fontSize: 16 }}>{w.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ color: text, fontSize: 13, fontWeight: 700 }}>{w.label}</p>
                  <p style={{ color: sub, fontSize: 11 }}>{w.description}</p>
                </div>
                <button onClick={() => toggle(w.id)} style={{
                  background: "#10b98115", color: "#10b981",
                  border: "1px solid #10b98130",
                  borderRadius: 7, padding: "4px 10px",
                  fontSize: 11, fontWeight: 700, cursor: "pointer",
                }}>+ Add</button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 16px",
          borderTop: `1px solid ${border}`,
          flexShrink: 0,
          display: "flex", gap: 10,
          paddingBottom: "max(14px, env(safe-area-inset-bottom, 14px))",
        }}>
          <button onClick={onClose} style={{
            flex: 1, background: inp, color: sub,
            border: `1px solid ${border}`, borderRadius: 12,
            padding: "14px", fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>Cancel</button>
          <button onClick={() => { onSave(local); onClose(); }} style={{
            flex: 2, background: "#6366f1", color: "#fff",
            border: "none", borderRadius: 12,
            padding: "14px", fontSize: 13, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 2px 8px rgba(99,102,241,0.4)",
          }}>Save Layout</button>
        </div>
      </div>
    </>
  );
}
