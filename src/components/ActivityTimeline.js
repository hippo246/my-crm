// ============================================================
// components/ActivityTimeline.js  — Universal Activity Timeline
//
/* eslint-disable no-unused-vars */
// Filters actLog (tas9_act) entries by entity ID or name match,
// renders a chronological timeline consistent with DeliveryAuditLog.
//
// Two filter strategies:
//   1. auditEntityId match  — precise, for records logged via auditLog.js
//   2. detail string match  — fuzzy fallback for addLog() entries that
//      embed the entity label (customer name, expense category, etc.)
//
// Usage:
//   <ActivityTimeline
//     actLog={actLog}          // full actLog array from CRM state
//     entityId={c.id}          // optional — exact ID match on auditEntityId
//     entityLabel={c.name}     // optional — fuzzy match on detail/action string
//     entityType="customer"    // used to pick icon/color theme
//     t={t}
//     maxItems={12}            // default 12, pass Infinity for full log
//   />
// ============================================================

import React, { useState } from "react";

// ── Per-action metadata ───────────────────────────────────────
const ACTION_META = {
  // CRUD
  "[CREATE]":      { icon: "✨", color: "#10b981", label: "Created"     },
  "[UPDATE]":      { icon: "✏️",  color: "#3b82f6", label: "Updated"    },
  "[DELETE]":      { icon: "🗑️",  color: "#ef4444", label: "Deleted"    },
  "[SOFT_DELETE]": { icon: "🗑️",  color: "#f97316", label: "Trashed"    },
  "[RESTORE]":     { icon: "♻️",  color: "#10b981", label: "Restored"   },

  // Payments / finance
  payment:         { icon: "💰", color: "#10b981", label: "Payment"      },
  invoice:         { icon: "🧾", color: "#8b5cf6", label: "Invoice"      },
  receipt:         { icon: "📄", color: "#6366f1", label: "Receipt"      },

  // Delivery
  dispatch:        { icon: "🚚", color: "#3b82f6", label: "Dispatched"   },
  delivered:       { icon: "✅", color: "#10b981", label: "Delivered"    },
  cancelled:       { icon: "❌", color: "#ef4444", label: "Cancelled"    },

  // Stock / supply
  stock:           { icon: "📦", color: "#8b5cf6", label: "Stock"        },
  supply:          { icon: "🏭", color: "#8b5cf6", label: "Supply"       },
  ingredient:      { icon: "🧂", color: "#f59e0b", label: "Ingredient"   },

  // People
  staff:           { icon: "👤", color: "#6366f1", label: "Staff"        },
  attendance:      { icon: "📋", color: "#6366f1", label: "Attendance"   },

  // Misc
  note:            { icon: "💬", color: "#f59e0b", label: "Note"         },
  export:          { icon: "⬇️",  color: "#6b7280", label: "Exported"    },
  login:           { icon: "🔐", color: "#6b7280", label: "Login"        },
  default:         { icon: "⚡", color: "#6b7280", label: "Activity"     },
};

function getActionMeta(action = "") {
  const a = action.toLowerCase();

  // Audit-style prefix match first  e.g. "[UPDATE] customer: Raj Bakery"
  for (const [key, meta] of Object.entries(ACTION_META)) {
    if (a.startsWith(key.toLowerCase())) return meta;
  }

  // Keyword scan
  if (a.includes("payment") || a.includes("paid") || a.includes("collect")) return ACTION_META.payment;
  if (a.includes("invoice"))                                                   return ACTION_META.invoice;
  if (a.includes("receipt"))                                                   return ACTION_META.receipt;
  if (a.includes("dispatch"))                                                  return ACTION_META.dispatch;
  if (a.includes("deliver"))                                                   return ACTION_META.delivered;
  if (a.includes("cancel"))                                                    return ACTION_META.cancelled;
  if (a.includes("delete") || a.includes("trash") || a.includes("soft"))      return ACTION_META["[SOFT_DELETE]"];
  if (a.includes("restore"))                                                   return ACTION_META["[RESTORE]"];
  if (a.includes("creat") || a.includes("add") || a.includes("new"))          return ACTION_META["[CREATE]"];
  if (a.includes("edit") || a.includes("updat") || a.includes("save"))        return ACTION_META["[UPDATE]"];
  if (a.includes("stock") || a.includes("inventory"))                         return ACTION_META.stock;
  if (a.includes("supply") || a.includes("suppli"))                           return ACTION_META.supply;
  if (a.includes("ingredient"))                                                return ACTION_META.ingredient;
  if (a.includes("staff") || a.includes("attend"))                            return ACTION_META.staff;
  if (a.includes("export") || a.includes("csv") || a.includes("pdf"))        return ACTION_META.export;
  if (a.includes("login") || a.includes("logout"))                            return ACTION_META.login;

  return ACTION_META.default;
}

function formatTs(ts) {
  if (!ts) return "—";
  // ts can be an ISO string or a formatted string like "14 May 2025, 3:42 PM"
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts; // already formatted — return as-is
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    + " · "
    + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function matchesEntity(entry, entityId, entityLabel) {
  // 1. Precise audit match
  if (entityId && entry.auditEntityId && entry.auditEntityId === entityId) return true;
  // 2. Fuzzy label match in detail or action strings
  if (entityLabel) {
    const label = entityLabel.toLowerCase();
    const detail = (entry.detail || "").toLowerCase();
    const action = (entry.action || "").toLowerCase();
    if (detail.includes(label) || action.includes(label)) return true;
  }
  return false;
}


// ── Main component ────────────────────────────────────────────
export function ActivityTimeline({
  actLog = [],
  entityId,
  entityLabel,
  entityType,
  t,
  maxItems = 12,
  compact = false,
}) {
  const [expanded, setExpanded] = useState(false);

  const sub    = t?.sub    || "#9ca3af";
  const muted  = t?.muted  || "#6b7280";
  const border = t?.border || "rgba(255,255,255,0.08)";
  const text   = t?.text   || "#f9fafb";
  const inp    = t?.inp    || "rgba(255,255,255,0.04)";

  // Filter relevant entries
  const relevant = (Array.isArray(actLog) ? actLog : [])
    .filter(e => matchesEntity(e, entityId, entityLabel))
    .sort((a, b) => {
      // Sort by ts descending — ts can be ISO or formatted string
      const ta = new Date(a.ts || 0).getTime() || 0;
      const tb = new Date(b.ts || 0).getTime() || 0;
      return tb - ta;
    });

  const limit      = expanded ? Infinity : maxItems;
  const visible    = relevant.slice(0, limit);
  const hasMore    = relevant.length > maxItems && !expanded;
  const hasLess    = expanded && relevant.length > maxItems;

  if (relevant.length === 0) {
    return (
      <div style={{ padding: "10px 0", color: muted, fontSize: 12, textAlign: "center" }}>
        No activity recorded yet
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {visible.map((entry, i) => {
        const meta   = getActionMeta(entry.action);
        const isLast = i === visible.length - 1 && !hasMore;
        const iconSz = compact ? 26 : 32;
        const lineLeft = compact ? iconSz / 2 - 0.75 : iconSz / 2 - 0.75;

        // Build a clean label: strip the [VERB] prefix for display
        const cleanAction = (entry.action || "").replace(/^\[[^\]]+\]\s*/i, "");

        return (
          <div key={entry.id || i} style={{ display: "flex", gap: 12, position: "relative" }}>
            {/* Vertical connector line */}
            {!isLast && (
              <div style={{
                position: "absolute",
                left: lineLeft,
                top: iconSz,
                bottom: 0,
                width: 1.5,
                background: border,
              }} />
            )}

            {/* Icon bubble */}
            <div style={{
              width:  iconSz,
              height: iconSz,
              borderRadius: "50%",
              background: `${meta.color}15`,
              border: `1.5px solid ${meta.color}35`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: compact ? 11 : 13,
              flexShrink: 0,
              zIndex: 1,
            }}>
              {meta.icon}
            </div>

            {/* Content */}
            <div style={{ flex: 1, paddingBottom: isLast ? 0 : compact ? 12 : 16 }}>
              {/* Action label + actor */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, flexWrap: "wrap" }}>
                <div>
                  <span style={{ color: meta.color, fontWeight: 700, fontSize: compact ? 11 : 12 }}>
                    {meta.label}
                  </span>
                  {entry.user && (
                    <span style={{ color: sub, fontSize: compact ? 10 : 11, marginLeft: 6 }}>
                      by {entry.user}
                      {entry.role && entry.role !== "staff" && entry.role !== "admin" && (
                        <span style={{
                          marginLeft: 5,
                          background: `${meta.color}15`,
                          color: meta.color,
                          borderRadius: 4,
                          padding: "1px 5px",
                          fontSize: 9,
                          fontWeight: 700,
                          textTransform: "uppercase",
                        }}>{entry.role}</span>
                      )}
                    </span>
                  )}
                </div>
                {/* Device badge */}
                {!compact && (entry.browser || entry.deviceType) && (
                  <span style={{ color: muted, fontSize: 9, background: inp, borderRadius: 4, padding: "2px 6px", flexShrink: 0, whiteSpace: "nowrap" }}>
                    {entry.deviceType === "mobile" ? "📱" : entry.deviceType === "tablet" ? "📟" : "🖥️"}{entry.browser ? ` ${entry.browser}` : ""}
                  </span>
                )}
              </div>

              {/* Detail / changed fields */}
              {cleanAction && (
                <div style={{ color: text, fontSize: compact ? 10 : 11, marginTop: 2, fontWeight: 500, lineHeight: 1.4 }}>
                  {cleanAction}
                </div>
              )}
              {entry.detail && entry.detail !== cleanAction && (
                <div style={{ color: muted, fontSize: compact ? 9 : 10, marginTop: 1, fontStyle: "italic", lineHeight: 1.4 }}>
                  {entry.detail}
                </div>
              )}

              {/* Changed fields (from auditLog.js diff) */}
              {!compact && entry.changedFields?.length > 0 && (
                <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {entry.changedFields.map(f => (
                    <span key={f} style={{
                      background: `${meta.color}12`,
                      color: meta.color,
                      borderRadius: 4,
                      padding: "1px 6px",
                      fontSize: 9,
                      fontWeight: 700,
                    }}>{f}</span>
                  ))}
                </div>
              )}

              {/* Timestamp */}
              <div style={{ color: muted, fontSize: compact ? 9 : 10, marginTop: 3 }}>
                {formatTs(entry.ts)}
              </div>
            </div>
          </div>
        );
      })}

      {/* Show more / less toggle */}
      {(hasMore || hasLess) && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            marginTop: 8,
            background: "transparent",
            border: `1px solid ${border}`,
            borderRadius: 8,
            padding: "6px 12px",
            color: sub,
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            width: "100%",
            textAlign: "center",
          }}
          onMouseEnter={e => e.currentTarget.style.background = inp}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          {hasMore ? `Show ${relevant.length - maxItems} more →` : "← Show less"}
        </button>
      )}
    </div>
  );
}

// ── Section wrapper — drop this directly into DetailModal ─────
export function ActivitySection({ label = "Activity Log", ...props }) {
  const t      = props.t;
  const sub    = t?.sub || "#9ca3af";

  return (
    <div style={{ margin: "16px 0 8px" }}>
      <p style={{
        color: sub,
        fontSize: 9,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        marginBottom: 10,
      }}>
        {label}
      </p>
      <ActivityTimeline {...props} />
    </div>
  );
}
