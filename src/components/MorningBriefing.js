/* eslint-disable */
import React from "react";
import { T } from "../lib/theme";

function MorningBriefing({ dm, onDismiss, onUnpin, pinned, data }) {
  const t = T(dm);
  const { pendingCount, todayRev, lowStockCount, overdueCount, churnCount, noticeCount } = data;
  const items = [
    pendingCount > 0 && { icon: "⏳", label: "Pending deliveries today", value: pendingCount, color: "#f59e0b" },
    todayRev > 0 && { icon: "💰", label: "Revenue collected today", value: inr(todayRev), color: "#10b981" },
    lowStockCount > 0 && { icon: "⚠️", label: "Low stock items", value: lowStockCount, color: "#ef4444" },
    overdueCount > 0 && { icon: "🔴", label: "Overdue deliveries", value: overdueCount, color: "#ef4444" },
    churnCount > 0 && { icon: "💤", label: `Inactive ${data.churnDays}+ days`, value: churnCount, color: "#8b5cf6" },
    noticeCount > 0 && { icon: "📌", label: "Unread notices", value: noticeCount, color: "#0ea5e9" },
  ].filter(Boolean);
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 20, overflow: "hidden", marginBottom: 0 }}>
      <div style={{ background: dm ? "linear-gradient(135deg,#0d1421,#111820)" : "linear-gradient(135deg,#f0f4f8,#e8edf5)", padding: "16px 18px", borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ color: "#3b82f6", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>📋 Today's Briefing</p>
            <p style={{ color: t.sub, fontSize: 12 }}>Here's what needs your attention</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onUnpin} style={{ background: t.inp, border: `1px solid ${t.border}`, color: t.sub, borderRadius: 10, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{pinned ? "Unpin" : "Pin"}</button>
            <button onClick={onDismiss} style={{ background: t.inp, border: `1px solid ${t.border}`, color: t.sub, borderRadius: 10, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Dismiss</button>
          </div>
        </div>
      </div>
      <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        {items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <p style={{ fontSize: 22 }}>🎉</p>
            <p style={{ color: t.sub, fontSize: 13, fontWeight: 600, marginTop: 6 }}>All clear — great day ahead!</p>
          </div>
        ) : items.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: t.inp, borderRadius: 12, padding: "10px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ color: t.sub, fontSize: 13 }}>{item.label}</span>
            </div>
            <span style={{ color: item.color, fontWeight: 800, fontSize: 15 }}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  LOGIN
// ═══════════════════════════════════════════════════════════════

export { MorningBriefing };
