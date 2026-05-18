// ============================================================
// src/components/AuditLog.js
//
// Full audit log with before/after field diffs, device info,
// user/role, timestamp. Slide-over panel + compact inline section.
//
// USAGE in CRM.js:
//   import { AuditLogButton, AuditLogPanel, useAuditLog } from "./components/AuditLog";
//
//   // Hook — call instead of raw addLog when you have before/after:
//   const { logEdit } = useAuditLog({ addLog, displayName, sess });
//   logEdit("Edited delivery", { before: oldDelivery, after: newDelivery, entityId: d.id, entityType: "delivery" });
//
//   // Button in topbar (admin only):
//   <AuditLogButton dm={dm} t={t} onClick={() => setAuditOpen(true)} />
//
//   // Panel at root:
//   <AuditLogPanel open={auditOpen} onClose={() => setAuditOpen(false)}
//     actLog={actLog} dm={dm} t={t} isAdmin={isAdmin} currentUser={displayName} />
// ============================================================

import React, { useState, useMemo, useEffect } from "react";

// ── Field label prettifier ────────────────────────────────────
const FIELD_LABELS = {
  customer: "Customer", customerId: "Customer ID", status: "Status",
  date: "Date", deliveryDate: "Delivery Date", notes: "Notes",
  address: "Address", orderLines: "Order Lines", amount: "Amount",
  paid: "Paid", pending: "Pending", phone: "Phone", name: "Name",
  category: "Category", vendor: "Vendor", qty: "Quantity", unit: "Unit",
  item: "Item", cost: "Cost", supplier: "Supplier", product: "Product",
  type: "Type", reason: "Reason", shift: "Shift", method: "Method",
  active: "Active", creditLimit: "Credit Limit", partialPay: "Partial Pay",
  batchLabel: "Batch", target: "Target", actual: "Actual",
};

function prettyField(key) {
  return FIELD_LABELS[key] || key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
}

function prettyVal(val) {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "object") return JSON.stringify(val).slice(0, 80);
  return String(val) || "—";
}

// ── Diff two objects, return changed fields ───────────────────
export function diffObjects(before, after) {
  if (!before || !after) return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const SKIP = new Set(["id", "createdAt", "updatedAt", "deletedAt", "deletedAtISO",
    "deletedBy", "deletedByName", "deletedByRole", "restoredAt", "restoredBy",
    "restoredByName", "__v", "_id"]);
  const changes = [];
  for (const key of keys) {
    if (SKIP.has(key)) continue;
    const bv = before[key];
    const av = after[key];
    const bStr = JSON.stringify(bv);
    const aStr = JSON.stringify(av);
    if (bStr !== aStr) {
      changes.push({ field: key, before: bv, after: av });
    }
  }
  return changes;
}

// ── Hook: enhanced addLog with diff support ───────────────────
export function useAuditLog({ addLog, displayName, sess }) {
  const logEdit = ({ action, detail, before, after, entityId, entityType }) => {
    const changes = before && after ? diffObjects(before, after) : [];
    const diffStr = changes.length > 0
      ? changes.map(c => `${prettyField(c.field)}: "${prettyVal(c.before)}" → "${prettyVal(c.after)}"`).join(" · ")
      : detail || "";
    addLog(action, diffStr || detail || "", { entityId, entityType, changes, before, after });
  };
  return { logEdit, diffObjects };
}

// ── Relative time ─────────────────────────────────────────────
function relTime(ts) {
  if (!ts) return "";
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fullDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Role colors ───────────────────────────────────────────────
const ROLE_COLOR = {
  admin:   { bg: "#6366f120", color: "#6366f1", border: "#6366f130" },
  agent:   { bg: "#f9731620", color: "#f97316", border: "#f9731630" },
  factory: { bg: "#06b6d420", color: "#06b6d4", border: "#06b6d430" },
  staff:   { bg: "#10b98120", color: "#10b981", border: "#10b98130" },
};

// ── Device icon ───────────────────────────────────────────────
function deviceIcon(e) {
  const dt = (e.deviceType || "").toLowerCase();
  if (dt === "mobile") return "📱";
  if (dt === "tablet") return "📱";
  return "💻";
}

// ── AuditLogButton ────────────────────────────────────────────
export function AuditLogButton({ dm, t, onClick }) {
  const inp    = t?.inp    || (dm ? "#1e293b" : "#f8fafc");
  const border = t?.border || (dm ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)");
  const sub    = t?.sub    || (dm ? "#94a3b8" : "#64748b");

  return (
    <button
      onClick={onClick}
      title="Audit Log  (Shift+L)"
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
      🔍
    </button>
  );
}

// ── LogEntry — extracted so useState is legal (hooks can't be called inside .map()) ──
function LogEntry({ e, i, inp, border, sub, text, dm, card }) {
  const roleStyle = ROLE_COLOR[e.role] || ROLE_COLOR.agent;
  const hasDiff = e.changes && e.changes.length > 0;
  const [expanded, setExpanded] = useState(false);

  return (
    <div key={e.id || i} style={{
      background: inp, border: `1px solid ${border}`,
      borderRadius: 12, overflow: "hidden",
    }}>
      {/* Main row */}
      <div style={{ padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          {/* Device icon */}
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: roleStyle.bg, border: `1px solid ${roleStyle.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13,
          }}>{deviceIcon(e)}</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Action + category badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ color: text, fontSize: 12, fontWeight: 700 }}>{e.action}</span>
            </div>

            {/* Detail / diff summary */}
            {e.detail && (
              <div style={{
                color: sub, fontSize: 11, marginTop: 2,
                overflow: "hidden", textOverflow: "ellipsis",
                whiteSpace: expanded ? "normal" : "nowrap",
              }}>{e.detail}</div>
            )}

            {/* Meta row */}
            <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
              {/* User */}
              <span style={{
                background: roleStyle.bg, color: roleStyle.color,
                border: `1px solid ${roleStyle.border}`,
                borderRadius: 4, padding: "1px 6px",
                fontSize: 10, fontWeight: 700,
              }}>
                {e.user || "—"}
                {e.role && <span style={{ opacity: 0.7, fontWeight: 400 }}> · {e.role}</span>}
              </span>

              {/* Device */}
              {(e.browser || e.os) && (
                <span style={{ color: sub, fontSize: 10 }}>
                  {e.browser && e.os ? `${e.browser} / ${e.os}` : e.browser || e.os}
                </span>
              )}

              {/* Timestamp */}
              <span title={fullDate(e.ts)} style={{ color: sub, fontSize: 10, marginLeft: "auto" }}>
                {relTime(e.ts)}
              </span>
            </div>
          </div>

          {/* Expand button if has diff */}
          {hasDiff && (
            <button
              onClick={() => setExpanded(x => !x)}
              style={{
                background: expanded ? "#6366f120" : inp,
                border: `1px solid ${expanded ? "#6366f150" : border}`,
                color: expanded ? "#6366f1" : sub,
                borderRadius: 7, padding: "3px 8px",
                fontSize: 10, fontWeight: 700, cursor: "pointer",
                flexShrink: 0, whiteSpace: "nowrap",
              }}
            >
              {e.changes.length} change{e.changes.length !== 1 ? "s" : ""} {expanded ? "▲" : "▼"}
            </button>
          )}
        </div>
      </div>

      {/* Diff table */}
      {hasDiff && expanded && (
        <div style={{
          borderTop: `1px solid ${border}`,
          background: dm ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.02)",
          padding: "10px 12px",
        }}>
          <p style={{ color: sub, fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 8 }}>
            Field Changes
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {e.changes.map((c, ci) => (
              <div key={ci} style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                gap: 8, alignItems: "center",
                padding: "6px 8px",
                background: inp, border: `1px solid ${border}`,
                borderRadius: 8, fontSize: 11,
              }}>
                <span style={{ color: sub, fontWeight: 700 }}>{prettyField(c.field)}</span>
                <span style={{
                  color: "#ef4444", background: "#ef444412",
                  border: "1px solid #ef444420",
                  borderRadius: 4, padding: "2px 6px",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {prettyVal(c.before)}
                </span>
                <span style={{
                  color: "#10b981", background: "#10b98112",
                  border: "1px solid #10b98120",
                  borderRadius: 4, padding: "2px 6px",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {prettyVal(c.after)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── AuditLogPanel ─────────────────────────────────────────────
// ── Action type filter buckets (module-level so useMemo deps stay clean) ──
const ACTION_TYPES = [
  { id: "all",    label: "All" },
  { id: "edit",   label: "Edits",    test: a => a.includes("Edit") || a.includes("edit") || a.includes("Updated") },
  { id: "create", label: "Creates",  test: a => a.includes("Add") || a.includes("Log") || a.includes("Record") || a.includes("Created") },
  { id: "delete", label: "Deletes",  test: a => a.includes("delet") || a.includes("Delet") || a.includes("Removed") },
  { id: "status", label: "Status",   test: a => a.includes("Status") || a.includes("status") || a.includes("Dispatch") || a.includes("Bulk") },
  { id: "system", label: "System",   test: a => a.includes("Login") || a.includes("Logout") || a.includes("backup") || a.includes("Backup") || a.includes("snapshot") || a.includes("Restore") },
];

export function AuditLogPanel({ open, onClose, actLog = [], dm, t, isAdmin, currentUser }) {
  const [search, setSearch]       = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  const text   = t?.text   || (dm ? "#f1f5f9" : "#0f172a");
  const sub    = t?.sub    || (dm ? "#94a3b8" : "#64748b");
  const card   = t?.card   || (dm ? "#1e293b" : "#ffffff");
  const inp    = t?.inp    || (dm ? "#0f172a" : "#f8fafc");
  const border = t?.border || (dm ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)");

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  useEffect(() => {
    if (!open) { setSearch(""); setUserFilter("all"); setActionFilter("all"); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, onClose]);

  // All users who appear in log
  const allUsers = useMemo(() =>
    [...new Set(actLog.map(e => e.user).filter(Boolean))].sort(),
    [actLog]
  );



  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return actLog.filter(e => {
      const matchSearch = !q ||
        (e.action || "").toLowerCase().includes(q) ||
        (e.detail || "").toLowerCase().includes(q) ||
        (e.user   || "").toLowerCase().includes(q);
      const matchUser = userFilter === "all" || e.user === userFilter;
      const matchAction = actionFilter === "all" ||
        (ACTION_TYPES.find(t => t.id === actionFilter)?.test(e.action || "") ?? true);
      return matchSearch && matchUser && matchAction;
    }).sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actLog, search, userFilter, actionFilter]);

  // Group by day
  const grouped = useMemo(() => {
    const g = {};
    filtered.forEach(e => {
      const day = e.ts ? new Date(e.ts).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "Unknown";
      if (!g[day]) g[day] = [];
      g[day].push(e);
    });
    return g;
  }, [filtered]);
  const groupKeys = Object.keys(grouped);

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        zIndex: 1100, backdropFilter: "blur(3px)",
      }} />

      <div style={{
        position: "fixed", zIndex: 1101,
        display: "flex", flexDirection: "column",
        background: card, border: `1px solid ${border}`,
        ...(isMobile ? {
          left: 0, right: 0, bottom: 0, top: "auto",
          maxHeight: "92vh", borderRadius: "20px 20px 0 0",
          borderTop: `1px solid ${border}`,
        } : {
          top: 0, right: 0, bottom: 0,
          width: "min(620px, 100vw)",
          borderLeft: `1px solid ${border}`,
        }),
        boxShadow: isMobile ? "0 -8px 40px rgba(0,0,0,0.3)" : "-8px 0 40px rgba(0,0,0,0.25)",
      }}>

        {/* Header */}
        <div style={{
          padding: isMobile ? "12px 16px" : "18px 20px 14px",
          borderBottom: `1px solid ${border}`, flexShrink: 0,
          background: dm
            ? "linear-gradient(135deg,rgba(99,102,241,0.12) 0%,rgba(0,0,0,0) 100%)"
            : "linear-gradient(135deg,rgba(99,102,241,0.05) 0%,rgba(0,0,0,0) 100%)",
        }}>
          {isMobile && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <div style={{ width: 36, height: 4, borderRadius: 99, background: border }} />
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: "#6366f120", border: "1px solid #6366f130",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
              }}>🔍</div>
              <div>
                <div style={{ color: text, fontWeight: 800, fontSize: 15 }}>Audit Log</div>
                <div style={{ color: sub, fontSize: 11, marginTop: 1 }}>
                  Full change history · {actLog.length} records
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{
              background: "transparent", border: "none", color: sub,
              fontSize: 20, cursor: "pointer", padding: 8, borderRadius: 10,
              minWidth: 36, minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center",
            }}>✕</button>
          </div>

          {/* Search */}
          <div style={{ position: "relative", marginTop: 12 }}>
            <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
              width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={sub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search actions, details, users…"
              style={{
                width: "100%", boxSizing: "border-box",
                background: inp, border: `1px solid ${border}`, color: text,
                borderRadius: 10, padding: "9px 32px 9px 32px",
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

        {/* Filters */}
        <div style={{
          padding: "10px 16px", borderBottom: `1px solid ${border}`, flexShrink: 0,
          display: "flex", gap: 6, overflowX: "auto", WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}>
          {/* Action type filter */}
          {ACTION_TYPES.map(at => (
            <button key={at.id} onClick={() => setActionFilter(at.id)} style={{
              background: actionFilter === at.id ? "#6366f120" : inp,
              color: actionFilter === at.id ? "#6366f1" : sub,
              border: `1px solid ${actionFilter === at.id ? "#6366f150" : border}`,
              borderRadius: 99, padding: "6px 12px",
              fontSize: 11, fontWeight: 700, cursor: "pointer",
              flexShrink: 0, whiteSpace: "nowrap",
            }}>{at.label}</button>
          ))}

          {/* Divider */}
          <div style={{ width: 1, background: border, flexShrink: 0, margin: "4px 2px" }} />

          {/* User filter */}
          <button onClick={() => setUserFilter(userFilter === "mine" ? "all" : "mine")} style={{
            background: userFilter === "mine" ? "#f9731620" : inp,
            color: userFilter === "mine" ? "#f97316" : sub,
            border: `1px solid ${userFilter === "mine" ? "#f9731650" : border}`,
            borderRadius: 99, padding: "6px 12px",
            fontSize: 11, fontWeight: 700, cursor: "pointer",
            flexShrink: 0, whiteSpace: "nowrap",
          }}>👤 Mine</button>

          {isAdmin && allUsers.filter(u => u !== currentUser).map(u => (
            <button key={u} onClick={() => setUserFilter(userFilter === u ? "all" : u)} style={{
              background: userFilter === u ? "#8b5cf620" : inp,
              color: userFilter === u ? "#8b5cf6" : sub,
              border: `1px solid ${userFilter === u ? "#8b5cf650" : border}`,
              borderRadius: 99, padding: "6px 12px",
              fontSize: 11, fontWeight: 700, cursor: "pointer",
              flexShrink: 0, whiteSpace: "nowrap",
            }}>{u}</button>
          ))}
        </div>

        {/* Count + clear */}
        <div style={{
          padding: "7px 16px 5px", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ color: sub, fontSize: 11, fontWeight: 600 }}>
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}
            {search ? ` matching "${search}"` : ""}
          </span>
          {(search || userFilter !== "all" || actionFilter !== "all") && (
            <button onClick={() => { setSearch(""); setUserFilter("all"); setActionFilter("all"); }}
              style={{ color: "#6366f1", background: "none", border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              Clear
            </button>
          )}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 24px", WebkitOverflowScrolling: "touch" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
              <p style={{ color: text, fontSize: 14, fontWeight: 700 }}>No records found</p>
              <p style={{ color: sub, fontSize: 12, marginTop: 4 }}>Try adjusting your filters</p>
            </div>
          ) : groupKeys.map(day => (
            <div key={day}>
              {/* Day header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0 10px" }}>
                <div style={{ height: 1, flex: 1, background: border }} />
                <span style={{
                  color: sub, fontSize: 10, fontWeight: 800,
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  background: card, padding: "0 6px",
                }}>{day}</span>
                <div style={{ height: 1, flex: 1, background: border }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {grouped[day].map((e, i) => (
                  <LogEntry
                    key={e.id || i}
                    e={e} i={i}
                    inp={inp} border={border} sub={sub} text={text} dm={dm} card={card}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
