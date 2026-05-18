// ============================================================
// src/components/ActivityTimeline.js
//
// Slide-over activity timeline panel. Shows all actLog entries
// from every tab (admin + staff side) with filtering, search,
// and relative timestamps.
//
// USAGE in CRM.js:
//   import { ActivityTimelineButton, ActivityTimeline } from "./components/ActivityTimeline";
//
//   // Button in navbar:
//   <ActivityTimelineButton count={unreadActivity} dm={dm} onClick={() => setTimelineOpen(true)} />
//
//   // Panel at app root:
//   <ActivityTimeline
//     open={timelineOpen}
//     onClose={() => setTimelineOpen(false)}
//     actLog={actLog}
//     currentUser={displayName}
//     isAdmin={isAdmin}
//     sess={sess}
//     dm={dm}
//     t={t}
//   />
// ============================================================

import React, { useState, useMemo, useRef, useEffect } from "react";

// ── Action → category + icon + color mapping ─────────────────
const ACTION_META = {
  // Deliveries
  "Added delivery":          { cat: "Deliveries",   icon: "🚚", color: "#3b82f6" },
  "Edited delivery":         { cat: "Deliveries",   icon: "✏️", color: "#3b82f6" },
  "Soft-deleted delivery":   { cat: "Deliveries",   icon: "🗑️", color: "#64748b" },
  "Status changed":          { cat: "Deliveries",   icon: "🔄", color: "#f59e0b" },
  "Dispatched":              { cat: "Deliveries",   icon: "🚛", color: "#f59e0b" },
  "Bulk status update":      { cat: "Deliveries",   icon: "⚡", color: "#3b82f6" },
  "Bulk delivered":          { cat: "Deliveries",   icon: "✅", color: "#10b981" },
  "Bulk orders created":     { cat: "Deliveries",   icon: "📦", color: "#3b82f6" },
  // Customers
  "Added customer":          { cat: "Customers",    icon: "👤", color: "#f97316" },
  "Edited customer":         { cat: "Customers",    icon: "✏️", color: "#f97316" },
  "Soft-deleted customer":   { cat: "Customers",    icon: "🗑️", color: "#64748b" },
  "Activated":               { cat: "Customers",    icon: "🔓", color: "#10b981" },
  "Deactivated":             { cat: "Customers",    icon: "🔒", color: "#ef4444" },
  // Payments
  "Manual payment recorded": { cat: "Payments",     icon: "💳", color: "#10b981" },
  "Soft-deleted payment":    { cat: "Payments",     icon: "🗑️", color: "#64748b" },
  // Supplies
  "Added supply":            { cat: "Supplies",     icon: "📦", color: "#8b5cf6" },
  "Edited supply":           { cat: "Supplies",     icon: "✏️", color: "#8b5cf6" },
  "Soft-deleted supply":     { cat: "Supplies",     icon: "🗑️", color: "#64748b" },
  // Expenses
  "Added expense":           { cat: "Expenses",     icon: "💸", color: "#ef4444" },
  "Edited expense":          { cat: "Expenses",     icon: "✏️", color: "#ef4444" },
  "Soft-deleted expense":    { cat: "Expenses",     icon: "🗑️", color: "#64748b" },
  // Wastage
  "Logged wastage":          { cat: "Wastage",      icon: "🗑️", color: "#64748b" },
  "Edited wastage":          { cat: "Wastage",      icon: "✏️", color: "#64748b" },
  "Soft-deleted wastage":    { cat: "Wastage",      icon: "🗑️", color: "#64748b" },
  // Production
  "Production target set":   { cat: "Production",   icon: "🏭", color: "#06b6d4" },
  "Production logged":       { cat: "Production",   icon: "✅", color: "#06b6d4" },
  "Soft-deleted production record": { cat: "Production", icon: "🗑️", color: "#64748b" },
  "Batch completed":         { cat: "Production",   icon: "🎉", color: "#06b6d4" },
  // Ingredients
  "Ingredient consumed":     { cat: "Ingredients",  icon: "🧂", color: "#84cc16" },
  "Ingredient consumed (auto-deducted)": { cat: "Ingredients", icon: "🧂", color: "#84cc16" },
  "Edited ingredient log":   { cat: "Ingredients",  icon: "✏️", color: "#84cc16" },
  // Staff
  "Staff log added":         { cat: "Staff",        icon: "👤", color: "#f43f5e" },
  "Staff log edited":        { cat: "Staff",        icon: "✏️", color: "#f43f5e" },
  "Soft-deleted staff log":  { cat: "Staff",        icon: "🗑️", color: "#64748b" },
  // Machines
  "Machine log added":       { cat: "Machines",     icon: "⚙️", color: "#a855f7" },
  "Machine log edited":      { cat: "Machines",     icon: "✏️", color: "#a855f7" },
  // Vehicles
  "Vehicle log added":       { cat: "Vehicles",     icon: "🚗", color: "#0ea5e9" },
  "Vehicle log edited":      { cat: "Vehicles",     icon: "✏️", color: "#0ea5e9" },
  // System / Settings
  "Exported backup":         { cat: "System",       icon: "💾", color: "#6366f1" },
  "Imported backup":         { cat: "System",       icon: "📥", color: "#6366f1" },
  "Saved financial snapshot":{ cat: "System",       icon: "📸", color: "#6366f1" },
  "Restored from trash":     { cat: "System",       icon: "↩️", color: "#10b981" },
  "Permanently deleted":     { cat: "System",       icon: "💥", color: "#ef4444" },
  "Login":                   { cat: "System",       icon: "🔐", color: "#6366f1" },
  "Logout":                  { cat: "System",       icon: "🚪", color: "#6366f1" },
};

const CATEGORIES = ["All", "Deliveries", "Customers", "Payments", "Supplies", "Expenses", "Wastage", "Production", "Ingredients", "Staff", "Machines", "Vehicles", "System"];

const CAT_COLORS = {
  "Deliveries":  "#3b82f6",
  "Customers":   "#f97316",
  "Payments":    "#10b981",
  "Supplies":    "#8b5cf6",
  "Expenses":    "#ef4444",
  "Wastage":     "#64748b",
  "Production":  "#06b6d4",
  "Ingredients": "#84cc16",
  "Staff":       "#f43f5e",
  "Machines":    "#a855f7",
  "Vehicles":    "#0ea5e9",
  "System":      "#6366f1",
};

function getMeta(action) {
  if (!action) return { cat: "System", icon: "📋", color: "#6366f1" };
  // Exact match first
  if (ACTION_META[action]) return ACTION_META[action];
  // Partial match
  const key = Object.keys(ACTION_META).find(k => action.toLowerCase().includes(k.toLowerCase()));
  if (key) return ACTION_META[key];
  // Fallback by keyword
  if (action.includes("eliver")) return { cat: "Deliveries", icon: "🚚", color: "#3b82f6" };
  if (action.includes("ustomer")) return { cat: "Customers", icon: "👤", color: "#f97316" };
  if (action.includes("ayment") || action.includes("paid")) return { cat: "Payments", icon: "💳", color: "#10b981" };
  if (action.includes("upply") || action.includes("upplies")) return { cat: "Supplies", icon: "📦", color: "#8b5cf6" };
  if (action.includes("xpense")) return { cat: "Expenses", icon: "💸", color: "#ef4444" };
  if (action.includes("astage") || action.includes("aste")) return { cat: "Wastage", icon: "🗑️", color: "#64748b" };
  if (action.includes("roduct") || action.includes("atch")) return { cat: "Production", icon: "🏭", color: "#06b6d4" };
  if (action.includes("ngredient")) return { cat: "Ingredients", icon: "🧂", color: "#84cc16" };
  if (action.includes("taff")) return { cat: "Staff", icon: "👤", color: "#f43f5e" };
  if (action.includes("achine")) return { cat: "Machines", icon: "⚙️", color: "#a855f7" };
  if (action.includes("ehicle")) return { cat: "Vehicles", icon: "🚗", color: "#0ea5e9" };
  return { cat: "System", icon: "📋", color: "#6366f1" };
}

function relTime(ts) {
  if (!ts) return "";
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function fullDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Timeline Button ───────────────────────────────────────────
export function ActivityTimelineButton({ dm, onClick, t }) {
  const border = t?.border || (dm ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)");
  const text   = t?.text   || (dm ? "#f1f5f9" : "#0f172a");
  const inp    = t?.inp    || (dm ? "#1e293b" : "#f8fafc");

  return (
    <button
      onClick={onClick}
      title="Activity Timeline"
      style={{
        background: inp,
        border: `1px solid ${border}`,
        borderRadius: 10,
        padding: "7px 10px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 6,
        color: text,
        fontSize: 13,
        fontWeight: 600,
        transition: "background 0.15s",
      }}
      onMouseEnter={e => e.currentTarget.style.background = dm ? "#334155" : "#f1f5f9"}
      onMouseLeave={e => e.currentTarget.style.background = inp}
    >
      📋
    </button>
  );
}

// ── Activity Timeline Panel ───────────────────────────────────
export function ActivityTimeline({ open, onClose, actLog = [], currentUser, isAdmin, sess, dm, t }) {
  const [cat, setCat]       = useState("All");
  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState("all"); // "all" | "mine"
  const searchRef = useRef(null);

  const text   = t?.text   || (dm ? "#f1f5f9" : "#0f172a");
  const sub    = t?.sub    || (dm ? "#94a3b8" : "#64748b");
  const card   = t?.card   || (dm ? "#1e293b" : "#ffffff");
  const inp    = t?.inp    || (dm ? "#0f172a" : "#f8fafc");
  const border = t?.border || (dm ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)");
  const inpB   = t?.inpB   || (dm ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)");

  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
    if (!open) {
      setSearch("");
      setCat("All");
      setUserFilter("all");
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (actLog || []).filter(e => {
      const meta = getMeta(e.action);
      const matchCat = cat === "All" || meta.cat === cat;
      const matchUser = userFilter === "all" || e.user === currentUser;
      const matchSearch = !q ||
        (e.action || "").toLowerCase().includes(q) ||
        (e.detail || "").toLowerCase().includes(q) ||
        (e.user   || "").toLowerCase().includes(q) ||
        (e.role   || "").toLowerCase().includes(q);
      return matchCat && matchUser && matchSearch;
    });
  }, [actLog, cat, search, userFilter, currentUser]);

  // Group by date
  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(e => {
      const day = e.ts ? new Date(e.ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Unknown";
      if (!groups[day]) groups[day] = [];
      groups[day].push(e);
    });
    return groups;
  }, [filtered]);

  const groupKeys = Object.keys(grouped);

  // Present categories that have entries
  const presentCats = useMemo(() => {
    const cats = new Set((actLog || []).map(e => getMeta(e.action).cat));
    return CATEGORIES.filter(c => c === "All" || cats.has(c));
  }, [actLog]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 1000,
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Panel — right drawer on tablet+, bottom sheet on mobile */}
      <div style={{
        position: "fixed",
        // Mobile: bottom sheet
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
          width: "min(560px, 100vw)",
          borderLeft: `1px solid ${border}`,
          borderRadius: 0,
        }),
        background: card,
        zIndex: 1001,
        display: "flex",
        flexDirection: "column",
        boxShadow: window.innerWidth < 640 ? "0 -8px 40px rgba(0,0,0,0.25)" : "-8px 0 40px rgba(0,0,0,0.25)",
      }}>

        {/* Header */}
        <div style={{
          padding: window.innerWidth < 640 ? "12px 16px 12px" : "18px 20px 14px",
          borderBottom: `1px solid ${border}`,
          flexShrink: 0,
          background: dm
            ? "linear-gradient(135deg,rgba(99,102,241,0.12) 0%,rgba(99,102,241,0.04) 100%)"
            : "linear-gradient(135deg,rgba(99,102,241,0.06) 0%,rgba(99,102,241,0.01) 100%)",
        }}>
          {/* Drag handle — mobile only */}
          {window.innerWidth < 640 && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <div style={{ width: 36, height: 4, borderRadius: 99, background: border }} />
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: "#6366f120", border: "1px solid #6366f130",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
              }}>📋</div>
              <div>
                <div style={{ color: text, fontWeight: 800, fontSize: 15 }}>Activity Timeline</div>
                <div style={{ color: sub, fontSize: 11, marginTop: 1 }}>
                  {(actLog || []).length} events across all tabs
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{
              background: "transparent", border: "none",
              color: sub, fontSize: 20, cursor: "pointer",
              padding: "8px", borderRadius: 10,
              minWidth: 36, minHeight: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>✕</button>
          </div>

          {/* Search */}
          <div style={{ position: "relative" }}>
            <span style={{
              position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
              fontSize: 13, color: sub, pointerEvents: "none",
            }}>🔍</span>
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search actions, users, details…"
              style={{
                width: "100%", boxSizing: "border-box",
                background: inp, border: `1.5px solid ${inpB}`,
                color: text, borderRadius: 10,
                padding: "9px 12px 9px 32px",
                fontSize: 13, outline: "none",
              }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", color: sub, cursor: "pointer", fontSize: 14,
              }}>✕</button>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div style={{
          padding: "10px 16px",
          borderBottom: `1px solid ${border}`,
          display: "flex", gap: 6, alignItems: "center",
          flexShrink: 0,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}>
          {/* Mine toggle */}
          <button
            onClick={() => setUserFilter(u => u === "all" ? "mine" : "all")}
            style={{
              background: userFilter === "mine" ? "#6366f120" : inp,
              color: userFilter === "mine" ? "#6366f1" : sub,
              border: `1px solid ${userFilter === "mine" ? "#6366f150" : border}`,
              borderRadius: 99, padding: "6px 12px",
              fontSize: 11, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
              flexShrink: 0, whiteSpace: "nowrap",
            }}
          >
            👤 Mine only
          </button>

          {/* Category chips */}
          {presentCats.map(c => {
            const color = c === "All" ? "#6366f1" : (CAT_COLORS[c] || "#6366f1");
            const active = cat === c;
            const count = c === "All" ? actLog.length : (actLog || []).filter(e => getMeta(e.action).cat === c).length;
            return (
              <button key={c} onClick={() => setCat(c)} style={{
                background: active ? color + "20" : inp,
                color: active ? color : sub,
                border: `1px solid ${active ? color + "50" : border}`,
                borderRadius: 99, padding: "6px 12px",
                fontSize: 11, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4,
                flexShrink: 0, whiteSpace: "nowrap",
              }}>
                {c}
                <span style={{
                  background: active ? color + "30" : border,
                  borderRadius: 99, padding: "0 5px", fontSize: 10,
                }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Results count */}
        <div style={{
          padding: "8px 20px 4px",
          flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ color: sub, fontSize: 11, fontWeight: 600 }}>
            {filtered.length} {filtered.length === 1 ? "event" : "events"}
            {search ? ` matching "${search}"` : ""}
          </span>
          {(search || cat !== "All" || userFilter !== "all") && (
            <button onClick={() => { setSearch(""); setCat("All"); setUserFilter("all"); }}
              style={{ color: "#6366f1", background: "none", border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              Clear filters
            </button>
          )}
        </div>

        {/* Timeline list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 20px", WebkitOverflowScrolling: "touch" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
              <p style={{ color: text, fontSize: 15, fontWeight: 700 }}>No events found</p>
              <p style={{ color: sub, fontSize: 12, marginTop: 4 }}>Try adjusting your filters</p>
            </div>
          ) : (
            groupKeys.map(day => (
              <div key={day}>
                {/* Day header */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  margin: "16px 0 10px",
                }}>
                  <div style={{ height: 1, flex: 1, background: border }} />
                  <span style={{
                    color: sub, fontSize: 10, fontWeight: 800,
                    textTransform: "uppercase", letterSpacing: "0.08em",
                    background: card, padding: "0 6px", flexShrink: 0,
                  }}>{day}</span>
                  <div style={{ height: 1, flex: 1, background: border }} />
                </div>

                {/* Events */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {grouped[day].map((e, i) => {
                    const meta = getMeta(e.action);
                    return (
                      <div key={e.id || i} style={{
                        display: "flex", gap: 10, alignItems: "flex-start",
                        padding: "10px 12px",
                        background: inp,
                        border: `1px solid ${border}`,
                        borderRadius: 12,
                        borderLeft: `3px solid ${meta.color}`,
                        transition: "background 0.1s",
                      }}
                        onMouseEnter={ev => ev.currentTarget.style.background = dm ? "#1e293b" : "#f1f5f9"}
                        onMouseLeave={ev => ev.currentTarget.style.background = inp}
                      >
                        {/* Icon */}
                        <div style={{
                          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                          background: meta.color + "18",
                          border: `1px solid ${meta.color}30`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 13,
                        }}>{meta.icon}</div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ color: text, fontSize: 12, fontWeight: 700 }}>{e.action}</span>
                            <span style={{
                              background: meta.color + "15", color: meta.color,
                              border: `1px solid ${meta.color}30`,
                              borderRadius: 4, padding: "1px 5px",
                              fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                            }}>{meta.cat}</span>
                          </div>
                          {e.detail && (
                            <div style={{
                              color: sub, fontSize: 11, marginTop: 2,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>{e.detail}</div>
                          )}
                          <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                            <span style={{ color: sub, fontSize: 10 }}>
                              👤 <strong style={{ color: e.user === currentUser ? "#6366f1" : text }}>{e.user || "—"}</strong>
                            </span>
                            {e.role && (
                              <span style={{ color: sub, fontSize: 10 }}>
                                · {e.role}
                              </span>
                            )}
                            <span title={fullDate(e.ts)} style={{
                              color: sub, fontSize: 10, marginLeft: "auto",
                            }}>{relTime(e.ts)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ── ActivitySection ───────────────────────────────────────────
// Compact inline activity log for use inside detail modals.
// Filters actLog by entityId (if provided) or entityLabel + entityType.
export function ActivitySection({ label = "Activity Log", actLog = [], entityId, entityLabel, entityType, t, compact }) {
  const text   = t?.text   || "#0f172a";
  const sub    = t?.sub    || "#64748b";
  const inp    = t?.inp    || "#f8fafc";
  const border = t?.border || "rgba(0,0,0,0.08)";

  const entries = React.useMemo(() => {
    let filtered = [...actLog];
    if (entityId) {
      filtered = filtered.filter(e =>
        e.entityId === entityId ||
        (e.detail && e.detail.includes(entityId))
      );
    }
    if (entityLabel && filtered.length === 0) {
      const lbl = entityLabel.toLowerCase();
      filtered = actLog.filter(e =>
        (e.detail && e.detail.toLowerCase().includes(lbl)) ||
        (e.action && e.action.toLowerCase().includes(lbl))
      );
    }
    if (entityType && filtered.length > 20) {
      const typeMap = {
        expense:  ["expense","xpense"],
        customer: ["customer","ustomer"],
        delivery: ["delivery","eliver","dispatch","status"],
        supply:   ["supply","upplies"],
        wastage:  ["wastage","aste"],
        agent:    [],
        category: [],
      };
      const keywords = typeMap[entityType] || [];
      if (keywords.length) {
        const narrow = filtered.filter(e =>
          keywords.some(k => (e.action||"").toLowerCase().includes(k) || (e.detail||"").toLowerCase().includes(k))
        );
        if (narrow.length > 0) filtered = narrow;
      }
    }
    return filtered
      .sort((a, b) => (b.ts || "").localeCompare(a.ts || ""))
      .slice(0, compact ? 5 : 15);
  }, [actLog, entityId, entityLabel, entityType, compact]);

  if (entries.length === 0) return (
    <div style={{ padding: "14px 0", textAlign: "center" }}>
      <p style={{ color: sub, fontSize: 12 }}>No activity recorded yet</p>
    </div>
  );

  return (
    <div>
      {label && (
        <p style={{ color: sub, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 8 }}>
          {label}
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {entries.map((e, i) => {
          const meta = getMeta(e.action);
          const diff = e.ts ? Math.floor((Date.now() - new Date(e.ts)) / 1000) : null;
          const rel = diff === null ? "" : diff < 60 ? "just now" : diff < 3600 ? `${Math.floor(diff/60)}m ago` : diff < 86400 ? `${Math.floor(diff/3600)}h ago` : `${Math.floor(diff/86400)}d ago`;
          return (
            <div key={e.id || i} style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              padding: "8px 10px",
              background: inp,
              border: `1px solid ${border}`,
              borderRadius: 10,
              borderLeft: `3px solid ${meta.color}`,
            }}>
              <span style={{ fontSize: 13, lineHeight: 1, marginTop: 1, flexShrink: 0 }}>{meta.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: text, fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>{e.action}</p>
                {e.detail && <p style={{ color: sub, fontSize: 11, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.detail}</p>}
                <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                  {e.user && <span style={{ color: sub, fontSize: 10 }}>👤 {e.user}</span>}
                  {rel && <span style={{ color: sub, fontSize: 10, marginLeft: "auto" }}>{rel}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
