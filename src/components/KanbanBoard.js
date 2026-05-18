// ============================================================
// src/components/KanbanBoard.js
//
// Factory-focused Kanban board for order pipeline.
// Columns: New Order → Approved → In Production → QC →
//          Packed → Dispatch Ready → Shipped → Delivered
//
// USAGE in CRM.js:
//   import { KanbanBoard, KanbanButton } from "./components/KanbanBoard";
//
//   <KanbanButton dm={dm} t={t} onClick={() => setKanbanOpen(true)} />
//   <KanbanBoard
//     open={kanbanOpen}
//     onClose={() => setKanbanOpen(false)}
//     deliveries={deliveries}
//     setDeliv={setDeliv}
//     customers={customers}
//     products={products}
//     settings={settings}
//     addLog={addLog}
//     notify={notify}
//     inr={inr}
//     lineTotal={lineTotal}
//     canSeePrices={canSeePrices}
//     isAdmin={isAdmin}
//     can={can}
//     dm={dm}
//     t={t}
//     setDsh={setDsh}
//     setDf={setDf}
//     ts={ts}
//   />
// ============================================================

import React, { useState, useMemo, useCallback, useEffect } from "react";

// ── Pipeline stages ───────────────────────────────────────────
export const KANBAN_STAGES = [
  { id: "new",          label: "New Order",      icon: "📋", color: "#64748b", statusMatch: ["Pending"] },
  { id: "approved",     label: "Approved",       icon: "✅", color: "#6366f1", statusMatch: [] },
  { id: "in_prod",      label: "In Production",  icon: "🏭", color: "#f59e0b", statusMatch: [] },
  { id: "qc",           label: "QC",             icon: "🔬", color: "#8b5cf6", statusMatch: [] },
  { id: "packed",       label: "Packed",         icon: "📦", color: "#06b6d4", statusMatch: [] },
  { id: "dispatch_ready", label: "Dispatch Ready", icon: "🚀", color: "#f97316", statusMatch: [] },
  { id: "shipped",      label: "Shipped",        icon: "🚚", color: "#3b82f6", statusMatch: ["In Transit"] },
  { id: "delivered",    label: "Delivered",      icon: "🎉", color: "#10b981", statusMatch: ["Delivered"] },
];

// Map delivery.status → kanban stage (for deliveries that don't have kanbanStage set yet)
function defaultStage(d) {
  if (d.kanbanStage) return d.kanbanStage;
  if (d.status === "Delivered") return "delivered";
  if (d.status === "In Transit") return "shipped";
  return "new";
}

// ── KanbanButton ──────────────────────────────────────────────
// Props:
//   mobileOnly  — hides on screens ≥640px  (use inside the bottom pill nav)
//   desktopOnly — hides on screens <640px  (use inside the top nav bar)
export function KanbanButton({ dm, t, onClick, mobileOnly = false, desktopOnly = false }) {
  const inp    = t?.inp    || (dm ? "#1e293b" : "#f8fafc");
  const border = t?.border || (dm ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)");
  const sub    = t?.sub    || (dm ? "#94a3b8" : "#64748b");

  // Inject responsive CSS once
  useEffect(() => {
    const id = "kanban-btn-responsive-style";
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = [
      "@media (min-width: 640px) { .kanban-btn-mobile-only  { display: none !important; } }",
      "@media (max-width: 639px) { .kanban-btn-desktop-only { display: none !important; } }",
    ].join("\n");
    document.head.appendChild(s);
  }, []);

  const cls = mobileOnly ? "kanban-btn-mobile-only" : desktopOnly ? "kanban-btn-desktop-only" : "";

  return (
    <button
      onClick={onClick}
      title="Kanban Board  (Shift+B)"
      className={cls || undefined}
      style={{
        background: inp, border: `1px solid ${border}`,
        borderRadius: 10, padding: "7px 10px",
        cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        color: sub, fontSize: 13, fontWeight: 600,
        minWidth: 34, minHeight: 34, justifyContent: "center",
        transition: "background 0.15s",
      }}
      onMouseEnter={e => e.currentTarget.style.background = dm ? "#334155" : "#f1f5f9"}
      onMouseLeave={e => e.currentTarget.style.background = inp}
    >
      📌
    </button>
  );
}

// ── KanbanBoard ───────────────────────────────────────────────
export function KanbanBoard({
  open, onClose,
  deliveries = [], setDeliv,
  customers = [], products = [],
  settings, addLog, notify, inr, lineTotal,
  canSeePrices, isAdmin, can,
  dm, t,
  setDsh, setDf, ts,
}) {
  const [search, setSearch]         = useState("");
  const [dateFilter, setDateFilter] = useState("all"); // all | today | week
  const [dragId, setDragId]         = useState(null);
  const [dragOver, setDragOver]     = useState(null);
  const [expandedCard, setExpanded] = useState(null);
  const [mobileHintDismissed, setMobileHintDismissed] = useState(false);
  const [isMobile, setIsMobile]     = useState(
    typeof window !== "undefined" ? (window.visualViewport?.width ?? window.innerWidth) < 640 : false
  );

  // Keep isMobile in sync with actual viewport width
  useEffect(() => {
    const update = () => setIsMobile((window.visualViewport?.width ?? window.innerWidth) < 640);
    const mq = window.matchMedia("(max-width: 639px)");
    mq.addEventListener("change", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      mq.removeEventListener("change", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  const text   = t?.text   || (dm ? "#f1f5f9" : "#0f172a");
  const sub    = t?.sub    || (dm ? "#94a3b8" : "#64748b");
  const card   = t?.card   || (dm ? "#1e293b" : "#ffffff");
  const inp    = t?.inp    || (dm ? "#0f172a" : "#f8fafc");
  const border = t?.border || (dm ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)");

  // Filter active deliveries only
  const activeDelivs = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const q = search.toLowerCase();
    return (deliveries || []).filter(d => {
      if (d.deleted) return false;
      if (q && !(d.customer || "").toLowerCase().includes(q) && !(d.invNo || "").toLowerCase().includes(q)) return false;
      if (dateFilter === "today") return d.date === today;
      if (dateFilter === "week") return d.date >= weekAgo;
      return true;
    });
  }, [deliveries, search, dateFilter]);

  // Group by stage
  const byStage = useMemo(() => {
    const g = {};
    KANBAN_STAGES.forEach(s => { g[s.id] = []; });
    activeDelivs.forEach(d => {
      const stage = defaultStage(d);
      if (g[stage]) g[stage].push(d);
    });
    return g;
  }, [activeDelivs]);

  // Move card to new stage
  const moveCard = useCallback((delivId, toStageId) => {
    const stage = KANBAN_STAGES.find(s => s.id === toStageId);
    if (!stage) return;
    // Also update delivery.status if the stage maps to a canonical status
    const statusMap = {
      shipped:   "In Transit",
      delivered: "Delivered",
      new:       "Pending",
    };
    const newStatus = statusMap[toStageId];
    setDeliv(prev => prev.map(d => {
      if (d.id !== delivId) return d;
      const updated = { ...d, kanbanStage: toStageId };
      if (newStatus) updated.status = newStatus;
      return updated;
    }));
    const d = deliveries.find(x => x.id === delivId);
    addLog("Kanban stage moved", `${d?.customer || delivId} → ${stage.label}`);
    notify(`Moved to ${stage.label} ✓`);
  }, [deliveries, setDeliv, addLog, notify]);

  // Drag handlers
  const onDragStart = (id) => (e) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };
  const onDragEnter = (stageId) => (e) => {
    e.preventDefault();
    setDragOver(stageId);
  };
  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const onDrop = (stageId) => (e) => {
    e.preventDefault();
    if (dragId && stageId !== defaultStage(deliveries.find(d => d.id === dragId) || {})) {
      moveCard(dragId, stageId);
    }
    setDragId(null);
    setDragOver(null);
  };
  const onDragEnd = () => { setDragId(null); setDragOver(null); };

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        zIndex: 1200, backdropFilter: "blur(4px)",
      }} />

      <div style={{
        position: "fixed", zIndex: 1201,
        background: card,
        display: "flex", flexDirection: "column",
        ...(isMobile ? {
          left: 0, right: 0, bottom: 0, top: "auto",
          maxHeight: "96vh", borderRadius: "20px 20px 0 0",
          borderTop: `1px solid ${border}`,
        } : {
          top: 0, left: 0, right: 0, bottom: 0,
          // Full screen
        }),
        boxShadow: "0 -8px 60px rgba(0,0,0,0.4)",
      }}>

        {/* Header */}
        <div style={{
          padding: isMobile ? "14px 14px 10px" : "14px 20px",
          borderBottom: `1px solid ${border}`, flexShrink: 0,
          background: dm
            ? "linear-gradient(135deg,rgba(99,102,241,0.1) 0%,rgba(0,0,0,0) 60%)"
            : "linear-gradient(135deg,rgba(99,102,241,0.04) 0%,rgba(0,0,0,0) 60%)",
        }}>
          {/* Drag handle on mobile */}
          {isMobile && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <div style={{ width: 36, height: 4, borderRadius: 99, background: border }} />
            </div>
          )}

          {/* Row 1: title + close */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: isMobile ? 10 : 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: isMobile ? 18 : 22, flexShrink: 0 }}>📌</span>
              <div style={{ minWidth: 0 }}>
                <p style={{ color: text, fontWeight: 800, fontSize: isMobile ? 14 : 16, lineHeight: 1 }}>Kanban Board</p>
                <p style={{ color: sub, fontSize: 10, marginTop: 2 }}>
                  {activeDelivs.length} order{activeDelivs.length !== 1 ? "s" : ""} · {isMobile ? "tap to expand" : "drag to move through pipeline"}
                </p>
              </div>
            </div>

            {/* Search — inline on desktop, full-width row on mobile */}
            {!isMobile && (
              <div style={{ flex: 1, position: "relative", maxWidth: 260, marginLeft: 8, minWidth: 0 }}>
                <svg style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={sub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search orders…"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: inp, border: `1px solid ${border}`, color: text,
                    borderRadius: 9, padding: "7px 10px 7px 28px",
                    fontSize: 12, outline: "none",
                  }}
                />
              </div>
            )}

            {/* Date filter — inline on desktop */}
            {!isMobile && (
              <div style={{ display: "flex", gap: 4 }}>
                {[["all","All"],["today","Today"],["week","Week"]].map(([id, label]) => (
                  <button key={id} onClick={() => setDateFilter(id)} style={{
                    background: dateFilter === id ? "#6366f120" : inp,
                    color: dateFilter === id ? "#6366f1" : sub,
                    border: `1px solid ${dateFilter === id ? "#6366f150" : border}`,
                    borderRadius: 7, padding: "5px 10px",
                    fontSize: 11, fontWeight: 700, cursor: "pointer",
                  }}>{label}</button>
                ))}
              </div>
            )}

            <button onClick={onClose} style={{
              background: dm ? "#1e293b" : "#f1f5f9",
              border: `1px solid ${border}`,
              color: dm ? "#94a3b8" : "#475569",
              fontSize: isMobile ? 18 : 20,
              cursor: "pointer",
              padding: 0,
              borderRadius: 10,
              width: isMobile ? 40 : 36,
              height: isMobile ? 40 : 36,
              minWidth: isMobile ? 40 : 36,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              WebkitTapHighlightColor: "transparent",
              touchAction: "manipulation",
            }}>✕</button>
          </div>

          {/* Row 2 (mobile only): search + date filters */}
          {isMobile && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ position: "relative" }}>
                <svg style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={sub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search orders…"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: inp, border: `1px solid ${border}`, color: text,
                    borderRadius: 9, padding: "8px 10px 8px 28px",
                    fontSize: 13, outline: "none",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[["all","All"],["today","Today"],["week","This Week"]].map(([id, label]) => (
                  <button key={id} onClick={() => setDateFilter(id)} style={{
                    flex: 1,
                    background: dateFilter === id ? "#6366f120" : inp,
                    color: dateFilter === id ? "#6366f1" : sub,
                    border: `1px solid ${dateFilter === id ? "#6366f150" : border}`,
                    borderRadius: 8, padding: "7px 4px",
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}>{label}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Board */}
        <div style={{
          flex: 1, overflowX: "auto", overflowY: "hidden",
          display: "flex", gap: 10, padding: "16px",
          WebkitOverflowScrolling: "touch",
        }}>
          {KANBAN_STAGES.map(stage => {
            const cards = byStage[stage.id] || [];
            const isOver = dragOver === stage.id;

            return (
              <div
                key={stage.id}
                onDragEnter={onDragEnter(stage.id)}
                onDragOver={onDragOver}
                onDrop={onDrop(stage.id)}
                style={{
                  flexShrink: 0,
                  width: isMobile ? 180 : 280,
                  display: "flex", flexDirection: "column",
                  borderRadius: 14,
                  border: `2px solid ${isOver ? stage.color : "transparent"}`,
                  background: isOver
                    ? stage.color + "12"
                    : dm ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                  transition: "border 0.15s, background 0.15s",
                  maxHeight: "100%",
                }}
              >
                {/* Column header */}
                <div style={{
                  padding: "10px 12px 8px",
                  borderBottom: `1px solid ${border}`,
                  flexShrink: 0,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14 }}>{stage.icon}</span>
                    <span style={{ color: text, fontSize: 12, fontWeight: 800 }}>{stage.label}</span>
                    <span style={{
                      marginLeft: "auto",
                      background: cards.length > 0 ? stage.color + "20" : border,
                      color: cards.length > 0 ? stage.color : sub,
                      borderRadius: 99, padding: "1px 7px",
                      fontSize: 10, fontWeight: 800,
                    }}>{cards.length}</span>
                  </div>
                  {/* Stage color bar */}
                  <div style={{
                    height: 2, background: stage.color,
                    borderRadius: 99, marginTop: 6, opacity: 0.6,
                  }} />
                </div>

                {/* Cards */}
                <div style={{
                  flex: 1, overflowY: "auto", padding: "8px",
                  display: "flex", flexDirection: "column", gap: 6,
                  WebkitOverflowScrolling: "touch",
                }}>
                  {cards.length === 0 && (
                    <div style={{
                      border: `2px dashed ${border}`,
                      borderRadius: 10, padding: "20px 12px",
                      textAlign: "center", color: sub, fontSize: 11,
                      opacity: isOver ? 1 : 0.5,
                    }}>
                      {isOver ? `Drop here` : "Empty"}
                    </div>
                  )}

                  {cards.map(d => {
                    const isDragging = dragId === d.id;
                    const isExpanded = expandedCard === d.id;
                    const total = lineTotal ? lineTotal(d.orderLines || {}) : 0;

                    return (
                      <div
                        key={d.id}
                        draggable
                        onDragStart={onDragStart(d.id)}
                        onDragEnd={onDragEnd}
                        onClick={() => { setExpanded(isExpanded ? null : d.id); setMobileHintDismissed(true); }}
                        style={{
                          background: card,
                          border: `1px solid ${border}`,
                          borderLeft: `3px solid ${stage.color}`,
                          borderRadius: 10,
                          padding: "10px 10px",
                          cursor: "grab",
                          opacity: isDragging ? 0.4 : 1,
                          transition: "opacity 0.15s, box-shadow 0.15s",
                          boxShadow: isDragging ? "none" : dm
                            ? "0 1px 4px rgba(0,0,0,0.3)"
                            : "0 1px 4px rgba(0,0,0,0.06)",
                          userSelect: "none",
                        }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = dm ? "0 4px 16px rgba(0,0,0,0.5)" : "0 4px 16px rgba(0,0,0,0.12)"}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = dm ? "0 1px 4px rgba(0,0,0,0.3)" : "0 1px 4px rgba(0,0,0,0.06)"}
                      >
                        {/* Customer + inv */}
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
                          <p style={{ color: text, fontSize: 12, fontWeight: 700, lineHeight: 1.3, flex: 1 }}>
                            {d.customer}
                          </p>
                          {d.invNo && (
                            <span style={{ color: sub, fontSize: 9, fontWeight: 700, whiteSpace: "nowrap" }}>
                              #{d.invNo}
                            </span>
                          )}
                        </div>

                        {/* Date */}
                        <p style={{ color: sub, fontSize: 10, marginTop: 3 }}>📅 {d.date}</p>

                        {/* Amount if allowed */}
                        {canSeePrices && total > 0 && (
                          <p style={{ color: stage.color, fontSize: 11, fontWeight: 800, marginTop: 4 }}>
                            {inr(total)}
                          </p>
                        )}

                        {/* Mobile tap hint — only shown when not expanded */}
                        {isMobile && !isExpanded && !mobileHintDismissed && (
                          <div style={{
                            marginTop: 7,
                            display: "flex", alignItems: "center", gap: 4,
                            background: stage.color + "12",
                            border: `1px solid ${stage.color}25`,
                            borderRadius: 6, padding: "4px 8px",
                          }}>
                            <span style={{ color: stage.color, fontSize: 10, fontWeight: 700 }}>Tap to move stage →</span>
                          </div>
                        )}

                        {/* Expanded: quick stage move buttons */}
                        {isExpanded && (
                          <div style={{ marginTop: 8, borderTop: `1px solid ${border}`, paddingTop: 8 }}>
                            <p style={{ color: sub, fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                              Move to
                            </p>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {KANBAN_STAGES.filter(s => s.id !== stage.id).map(s => (
                                <button
                                  key={s.id}
                                  onClick={(e) => { e.stopPropagation(); moveCard(d.id, s.id); setExpanded(null); }}
                                  style={{
                                    background: s.color + "15", color: s.color,
                                    border: `1px solid ${s.color}30`,
                                    borderRadius: 6, padding: isMobile ? "5px 9px" : "3px 7px",
                                    fontSize: isMobile ? 11 : 10, fontWeight: 700, cursor: "pointer",
                                    minHeight: isMobile ? 32 : "auto",
                                    WebkitTapHighlightColor: "transparent",
                                  }}
                                >
                                  {s.icon} {s.label}
                                </button>
                              ))}
                            </div>

                            {/* Open delivery */}
                            {(can?.("deliv_edit") || isAdmin) && setDsh && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setDsh(d); setDf && setDf(d); onClose(); }}
                                style={{
                                  marginTop: 6, width: "100%",
                                  background: "#6366f115", color: "#6366f1",
                                  border: "1px solid #6366f130",
                                  borderRadius: 6, padding: "5px",
                                  fontSize: 10, fontWeight: 700, cursor: "pointer",
                                }}
                              >
                                ✏️ Edit delivery
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer legend */}
        <div style={{
          padding: "8px 16px",
          borderTop: `1px solid ${border}`, flexShrink: 0,
          display: "flex", gap: 6, overflowX: "auto",
          WebkitOverflowScrolling: "touch", scrollbarWidth: "none",
        }}>
          {KANBAN_STAGES.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} />
              <span style={{ color: sub, fontSize: 10 }}>{s.label}</span>
            </div>
          ))}
          <span style={{ color: sub, fontSize: 10, marginLeft: "auto", flexShrink: 0 }}>
            {isMobile ? "Tap a card to move between stages" : "Drag cards to move · Click to expand"}
          </span>
        </div>
      </div>
    </>
  );
}
