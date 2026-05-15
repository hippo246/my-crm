// ============================================================
// components/DeliveryAuditLog.js  — Delivery Event / Audit Log
//
// Shows a timeline of all events for a delivery:
//   dispatched, delivered, cancelled, notes, etc.
//
// Usage:
//   import { DeliveryAuditLog } from "../../components/DeliveryAuditLog.js";
//   <DeliveryAuditLog deliveryId={del.id} t={t} />
// ============================================================

import React from "react";
import { useDeliveryEvents } from "../lib/deliveryEngine";

const ACTION_META = {
  created:     { icon: "📝", color: "#6366f1", label: "Created" },
  dispatched:  { icon: "🚚", color: "#3b82f6", label: "Dispatched" },
  delivered:   { icon: "✅", color: "#10b981", label: "Delivered" },
  cancelled:   { icon: "❌", color: "#ef4444", label: "Cancelled" },
  note:        { icon: "💬", color: "#f59e0b", label: "Note" },
  updated:     { icon: "✏️", color: "#8b5cf6", label: "Updated" },
};

function formatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

export function DeliveryAuditLog({ deliveryId, t, compact = false }) {
  const { events, loading } = useDeliveryEvents(deliveryId);

  const sub    = t?.sub    || "#9ca3af";
  const muted  = t?.muted  || "#6b7280";
  const border = t?.border || "rgba(255,255,255,0.08)";

  if (loading) {
    return (
      <div style={{ padding: "12px 0", color: muted, fontSize: 12, textAlign: "center" }}>
        Loading activity…
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div style={{ padding: "10px 0", color: muted, fontSize: 12, textAlign: "center" }}>
        No activity logged yet
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {events.map((ev, i) => {
        const meta = ACTION_META[ev.action] || { icon: "⚡", color: sub, label: ev.action };
        const isLast = i === events.length - 1;

        return (
          <div key={i} style={{ display: "flex", gap: 12, position: "relative" }}>
            {/* Timeline line */}
            {!isLast && (
              <div style={{
                position: "absolute",
                left: compact ? 14 : 17,
                top: compact ? 28 : 34,
                bottom: 0,
                width: 1.5,
                background: border,
              }} />
            )}

            {/* Icon bubble */}
            <div style={{
              width:  compact ? 28 : 34,
              height: compact ? 28 : 34,
              borderRadius: "50%",
              background: `${meta.color}18`,
              border: `1.5px solid ${meta.color}40`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: compact ? 12 : 14,
              flexShrink: 0,
              zIndex: 1,
            }}>
              {meta.icon}
            </div>

            {/* Content */}
            <div style={{ flex: 1, paddingBottom: isLast ? 0 : 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ color: meta.color, fontWeight: 700, fontSize: compact ? 11 : 12 }}>
                  {meta.label}
                </span>
                {ev.actorName && (
                  <span style={{ color: sub, fontSize: compact ? 10 : 11 }}>
                    by {ev.actorName}
                    {ev.actorRole && ev.actorRole !== "staff" && (
                      <span style={{
                        marginLeft: 5,
                        background: `${meta.color}15`,
                        color: meta.color,
                        borderRadius: 4,
                        padding: "1px 6px",
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: "uppercase",
                      }}>
                        {ev.actorRole}
                      </span>
                    )}
                  </span>
                )}
              </div>
              {ev.note && (
                <div style={{ color: muted, fontSize: compact ? 10 : 11, marginTop: 2, fontStyle: "italic" }}>
                  {ev.note}
                </div>
              )}
              <div style={{ color: muted, fontSize: compact ? 9 : 10, marginTop: 3 }}>
                {formatTime(ev.timestamp)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Compact inline badge: "Dispatched by Rahul · 10 May 3:42 PM" ───────────
export function DeliveryDispatchBadge({ deliveryId, t }) {
  const { events } = useDeliveryEvents(deliveryId);
  const dispatchEv = events.find(e => e.action === "dispatched");
  if (!dispatchEv) return null;

  const sub = t?.sub || "#9ca3af";
  return (
    <span style={{ color: sub, fontSize: 10 }}>
      🚚 Dispatched by <strong>{dispatchEv.actorName || "—"}</strong>
      {" · "}{formatTime(dispatchEv.timestamp)}
    </span>
  );
}
