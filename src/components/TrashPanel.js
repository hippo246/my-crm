// ============================================================
// src/components/TrashPanel.js — Global Trash Panel
//
// Slide-over panel triggered from the top navbar trash icon.
// Shows all soft-deleted records across all entity types,
// filterable by type. Admins can restore or permanently delete.
// Staff can only view.
//
// USAGE (in your Navbar/Header):
//   import { TrashButton, TrashPanel } from "../components/TrashPanel";
//
//   // Trash button (shows badge with count):
//   <TrashButton count={trashCount} dm={dm} onClick={() => setTrashOpen(true)} />
//
//   // Panel (mount at app root level):
//   <TrashPanel
//     open={trashOpen}
//     onClose={() => setTrashOpen(false)}
//     trashedItems={trashedItems}   // flat array of all soft-deleted docs across all collections
//     onRestore={handleRestore}     // (item) => restoreRecord(...)
//     onHardDelete={handleHardDelete} // (item) => hardDelete(...)
//     isAdmin={isAdmin}
//     dm={dm}
//     t={t}
//   />
//
// trashedItems shape:
//   Each item must have: { id, _collection, deletedAtISO, deletedByName, deletedByRole, ...data }
//   Add _collection and _label when you push to the trash array e.g.:
//     { ...invoice, _collection: "invoices", _label: invoice.number || invoice.id }
// ============================================================

import React, { useState, useMemo, useRef, useEffect } from "react";

// ── Entity config — labels, icons, filter chips ───────────────────────────────
const ENTITY_META = {
  invoices:   { label: "Invoices",   icon: "🧾", color: "#6366f1" },
  stock:      { label: "Stock",      icon: "📦", color: "#f59e0b" },
  payments:   { label: "Payments",   icon: "💳", color: "#10b981" },
  supplies:   { label: "Supplies",   icon: "🏪", color: "#8b5cf6" },
  expenses:   { label: "Expenses",   icon: "💸", color: "#ef4444" },
  deliveries: { label: "Deliveries", icon: "🚚", color: "#3b82f6" },
  staff:      { label: "Staff",      icon: "👤", color: "#f43f5e" },
  wastage:    { label: "Wastage",    icon: "🗑️", color: "#64748b" },
  vehicles:   { label: "Vehicles",   icon: "🚗", color: "#0ea5e9" },
  machines:   { label: "Machines",   icon: "⚙️", color: "#a855f7" },
  ingredients:{ label: "Ingredients",icon: "🧂", color: "#84cc16" },
  customers:  { label: "Customers",  icon: "👥", color: "#f97316" },
};

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// ── Trash Button (goes in navbar) ─────────────────────────────────────────────
export function TrashButton({ count = 0, dm, onClick, t }) {
  const border = t?.border || (dm ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)");
  const text   = t?.text   || (dm ? "#f1f5f9" : "#0f172a");
  const inp    = t?.inp    || (dm ? "#1e293b" : "#f8fafc");

  return (
    <button
      onClick={onClick}
      title="Trash"
      style={{
        position:    "relative",
        background:  inp,
        border:      `1px solid ${border}`,
        borderRadius: 10,
        padding:     "7px 10px",
        cursor:      "pointer",
        display:     "flex",
        alignItems:  "center",
        gap:         6,
        color:       text,
        fontSize:    13,
        fontWeight:  600,
        transition:  "background 0.15s",
      }}
      onMouseEnter={e => e.currentTarget.style.background = dm ? "#334155" : "#f1f5f9"}
      onMouseLeave={e => e.currentTarget.style.background = inp}
    >
      🗑️
      {count > 0 && (
        <span style={{
          position:   "absolute",
          top:        -6,
          right:      -6,
          background: "#ef4444",
          color:      "#fff",
          fontSize:   9,
          fontWeight: 800,
          borderRadius: 99,
          minWidth:   16,
          height:     16,
          display:    "flex",
          alignItems: "center",
          justifyContent: "center",
          padding:    "0 4px",
          border:     `2px solid ${dm ? "#0f172a" : "#fff"}`,
        }}>
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

// ── Trash Panel ───────────────────────────────────────────────────────────────
export function TrashPanel({ open, onClose, trashedItems = [], onRestore, onHardDelete, isAdmin, dm, t }) {
  const [filter, setFilter]       = useState("all");
  const [confirming, setConfirming] = useState(null); // docId being confirmed for hard delete
  const overlayRef = useRef(null);

  const text   = t?.text   || (dm ? "#f1f5f9" : "#0f172a");
  const sub    = t?.sub    || (dm ? "#94a3b8" : "#64748b");
  const card   = t?.card   || (dm ? "#1e293b" : "#ffffff");
  const inp    = t?.inp    || (dm ? "#0f172a" : "#f8fafc");
  const border = t?.border || (dm ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)");

  // Close on backdrop click
  useEffect(() => {
    if (!open) setConfirming(null);
  }, [open]);

  // Entity types present in trash
  const presentTypes = useMemo(() =>
    [...new Set(trashedItems.map(i => i._collection).filter(Boolean))],
    [trashedItems]
  );

  const filtered = useMemo(() =>
    filter === "all"
      ? trashedItems
      : trashedItems.filter(i => i._collection === filter),
    [trashedItems, filter]
  );

  const sorted = useMemo(() =>
    [...filtered].sort((a, b) =>
      (b.deletedAtISO || "").localeCompare(a.deletedAtISO || "")
    ),
    [filtered]
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 1000,
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Slide-over panel */}
      <div style={{
        position:   "fixed",
        top:        0,
        right:      0,
        bottom:     0,
        width:      "min(520px, 100vw)",
        background: card,
        borderLeft: `1px solid ${border}`,
        zIndex:     1001,
        display:    "flex",
        flexDirection: "column",
        boxShadow:  "-8px 0 40px rgba(0,0,0,0.25)",
      }}>

        {/* ── Header ── */}
        <div style={{
          padding:      "20px 20px 16px",
          borderBottom: `1px solid ${border}`,
          display:      "flex",
          alignItems:   "center",
          justifyContent: "space-between",
          flexShrink:   0,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>🗑️</span>
              <span style={{ color: text, fontSize: 16, fontWeight: 800 }}>Trash</span>
              {trashedItems.length > 0 && (
                <span style={{
                  background: "#ef444420", color: "#ef4444",
                  border: "1px solid #ef444430",
                  borderRadius: 99, fontSize: 11, fontWeight: 700,
                  padding: "2px 8px",
                }}>
                  {trashedItems.length} item{trashedItems.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p style={{ color: sub, fontSize: 11, marginTop: 3 }}>
              {isAdmin
                ? "Restore or permanently delete records"
                : "View deleted records — contact an admin to restore"}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: "transparent", border: "none",
            color: sub, fontSize: 20, cursor: "pointer",
            padding: "4px 8px", borderRadius: 8,
          }}>✕</button>
        </div>

        {/* ── Filter chips ── */}
        {presentTypes.length > 1 && (
          <div style={{
            padding:      "10px 20px",
            borderBottom: `1px solid ${border}`,
            display:      "flex",
            gap:          6,
            flexWrap:     "wrap",
            flexShrink:   0,
          }}>
            {["all", ...presentTypes].map(type => {
              const meta  = ENTITY_META[type] || { label: type, icon: "📁", color: "#6366f1" };
              const count = type === "all" ? trashedItems.length : trashedItems.filter(i => i._collection === type).length;
              const active = filter === type;
              return (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  style={{
                    background:   active ? (meta.color + "20") : inp,
                    color:        active ? meta.color : sub,
                    border:       `1px solid ${active ? meta.color + "50" : border}`,
                    borderRadius: 99,
                    padding:      "4px 10px",
                    fontSize:     11,
                    fontWeight:   700,
                    cursor:       "pointer",
                    display:      "flex",
                    alignItems:   "center",
                    gap:          4,
                  }}>
                  {type !== "all" && <span>{meta.icon}</span>}
                  {type === "all" ? "All" : meta.label}
                  <span style={{
                    background: active ? meta.color + "30" : border,
                    borderRadius: 99,
                    padding: "0 5px",
                    fontSize: 10,
                  }}>{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Items list ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✨</div>
              <p style={{ color: text, fontSize: 15, fontWeight: 700 }}>Trash is empty</p>
              <p style={{ color: sub, fontSize: 12, marginTop: 4 }}>Deleted items will appear here</p>
            </div>
          ) : sorted.map(item => {
            const meta = ENTITY_META[item._collection] || { label: item._collection, icon: "📁", color: "#6366f1" };
            const isConfirming = confirming === item.id;

            return (
              <div key={item.id} style={{
                background:   inp,
                border:       `1px solid ${border}`,
                borderRadius: 12,
                padding:      "12px 14px",
                display:      "flex",
                flexDirection:"column",
                gap:          8,
              }}>
                {/* Row 1: icon + label + entity chip */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: meta.color + "18",
                    border: `1px solid ${meta.color}30`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, flexShrink: 0,
                  }}>{meta.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: text, fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item._label || item.id}
                    </div>
                    <div style={{ color: sub, fontSize: 10, marginTop: 1 }}>
                      Deleted {formatDate(item.deletedAtISO)} by <strong>{item.deletedByName || "—"}</strong>
                      {item.deletedByRole && item.deletedByRole !== "staff" && (
                        <span style={{
                          marginLeft: 5,
                          background: meta.color + "15",
                          color: meta.color,
                          borderRadius: 4, padding: "1px 5px",
                          fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                        }}>{item.deletedByRole}</span>
                      )}
                    </div>
                  </div>
                  <span style={{
                    background: meta.color + "15", color: meta.color,
                    border: `1px solid ${meta.color}30`,
                    borderRadius: 6, padding: "2px 7px",
                    fontSize: 10, fontWeight: 700, flexShrink: 0,
                  }}>{meta.label}</span>
                </div>

                {/* Row 2: admin actions */}
                {isAdmin && (
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    {isConfirming ? (
                      <>
                        <span style={{ color: "#ef4444", fontSize: 11, fontWeight: 600, alignSelf: "center", marginRight: 4 }}>
                          Permanently delete?
                        </span>
                        <button
                          onClick={() => setConfirming(null)}
                          style={{ background: inp, color: sub, border: `1px solid ${border}`, borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          Cancel
                        </button>
                        <button
                          onClick={() => { onHardDelete(item); setConfirming(null); }}
                          style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 7, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          Yes, Delete Forever
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => onRestore(item)}
                          style={{
                            background: "#10b98115", color: "#10b981",
                            border: "1px solid #10b98130",
                            borderRadius: 7, padding: "5px 12px",
                            fontSize: 11, fontWeight: 700, cursor: "pointer",
                            display: "flex", alignItems: "center", gap: 4,
                          }}>
                          ↩ Restore
                        </button>
                        <button
                          onClick={() => setConfirming(item.id)}
                          style={{
                            background: "#ef444415", color: "#ef4444",
                            border: "1px solid #ef444430",
                            borderRadius: 7, padding: "5px 12px",
                            fontSize: 11, fontWeight: 700, cursor: "pointer",
                            display: "flex", alignItems: "center", gap: 4,
                          }}>
                          🗑 Delete Forever
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Staff: read-only notice */}
                {!isAdmin && (
                  <div style={{ color: sub, fontSize: 10, textAlign: "right", fontStyle: "italic" }}>
                    Contact an admin to restore this record
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        {isAdmin && trashedItems.length > 0 && (
          <div style={{
            padding:    "14px 20px",
            borderTop:  `1px solid ${border}`,
            flexShrink: 0,
          }}>
            <p style={{ color: sub, fontSize: 11, textAlign: "center" }}>
              Only admins can restore or permanently delete records
            </p>
          </div>
        )}
      </div>
    </>
  );
}
