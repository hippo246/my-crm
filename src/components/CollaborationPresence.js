/* eslint-disable react-hooks/exhaustive-deps */
// ============================================================
// components/CollaborationPresence.js  — Feature #18
//
// Real-time presence: shows who's online, which tab they're on,
// and what record they're editing — all synced via Firebase
// (tas9_presence store key). No extra dependencies needed.
//
// ── Architecture ─────────────────────────────────────────────
//   usePresence(sess, tab, editingRecord)
//     → writes own heartbeat to tas9_presence every 20s
//     → reads all presence docs, purges stale (>45s)
//     → returns { peers, selfId }
//
//   <PresenceBar />        — horizontal strip for desktop header
//   <PresenceDot />        — compact dot for mobile nav/header
//   <PresenceAvatars />    — overlapping avatar stack (3-4 shown)
//   <EditingIndicator />   — "John is editing this record" banner
//
// ── Wiring into CRM.js ───────────────────────────────────────
//   1. Import at top:
//        import { usePresence, PresenceBar, PresenceDot,
//                 PresenceAvatars, EditingIndicator }
//          from "./components/CollaborationPresence";
//
//   2. In CRM function body (after tab/displayName are defined):
//        const { peers, selfId } = usePresence(sess, tab, editingRecord);
//        // editingRecord = null | { type: "delivery"|"customer"|..., id, label }
//        // You can wire this to dSh / cSh / sSh etc:
//        const editingRecord = dSh ? { type:"delivery", id:dF.id||"new", label:dF.customer||"New Delivery" }
//          : cSh ? { type:"customer", id:cF.id||"new", label:cF.name||"New Customer" }
//          : null;
//
//   3. In desktop sidebar footer (after the dark mode toggle):
//        <PresenceBar peers={peers} dm={dm} t={t} />
//
//   4. In mobile header (next to notification bell):
//        <PresenceDot peers={peers} dm={dm} t={t} />
//
//   5. When rendering a detail sheet for a record, pass:
//        <EditingIndicator peers={peers} recordType="delivery"
//          recordId={dF.id} dm={dm} t={t} />
//
// ── Firebase key ─────────────────────────────────────────────
//   tas9_presence  →  { [userId]: PresenceDoc }
//   PresenceDoc = { id, name, role, tab, editing, color, ts }
// ============================================================

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useStore } from "../lib/store";

// ── Constants ─────────────────────────────────────────────────
const HEARTBEAT_INTERVAL = 20_000;  // write every 20s
const STALE_THRESHOLD    = 45_000;  // gone if no ping for 45s
const PURGE_INTERVAL     = 30_000;  // clean stale docs every 30s

// Deterministic colour from user id / name (avoids random flicker on re-render)
const PRESENCE_COLORS = [
  "#3b82f6","#10b981","#f59e0b","#8b5cf6","#ef4444",
  "#06b6d4","#ec4899","#84cc16","#f97316","#6366f1",
];
function colorFor(str = "") {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return PRESENCE_COLORS[h % PRESENCE_COLORS.length];
}
function initials(name = "") {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}

// ── Hook ──────────────────────────────────────────────────────
/**
 * usePresence — call once inside CRM.
 *
 * @param {object} sess           — current session (id, name, role)
 * @param {string} tab            — active tab name
 * @param {object|null} editing   — { type, id, label } or null
 * @returns {{ peers: PresenceDoc[], selfId: string }}
 */
export function usePresence(sess, tab, editing = null) {
  const [presenceMap, setPresenceMap] = useStore("tas9_presence", {});
  const selfId   = sess?.id || sess?.username || "unknown";
  const selfName = sess?.name || sess?.username || "User";
  const selfRole = sess?.role || "agent";
  const selfColor = colorFor(selfId);
  const tabRef     = useRef(tab);
  const editingRef = useRef(editing);
  useEffect(() => { tabRef.current = tab; }, [tab]);
  useEffect(() => { editingRef.current = editing; }, [editing]);

  // Write own heartbeat
  const writePresence = useCallback(() => {
    const doc = {
      id:      selfId,
      name:    selfName,
      role:    selfRole,
      color:   selfColor,
      tab:     tabRef.current,
      editing: editingRef.current,
      ts:      Date.now(),
    };
    setPresenceMap(prev => ({ ...(prev || {}), [selfId]: doc }));
  }, [selfId, selfName, selfRole, selfColor]);

  // Heartbeat
  useEffect(() => {
    if (!sess?.id && !sess?.username) return;
    writePresence();
    const iv = setInterval(writePresence, HEARTBEAT_INTERVAL);
    return () => {
      clearInterval(iv);
      // Mark self as offline immediately on unmount
      setPresenceMap(prev => {
        const next = { ...(prev || {}) };
        delete next[selfId];
        return next;
      });
    };
  }, [selfId]);

  // Purge stale peers
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      setPresenceMap(prev => {
        const next = { ...(prev || {}) };
        let changed = false;
        for (const [k, v] of Object.entries(next)) {
          if (k === selfId) continue;
          if (now - (v.ts || 0) > STALE_THRESHOLD) { delete next[k]; changed = true; }
        }
        return changed ? next : prev;
      });
    }, PURGE_INTERVAL);
    return () => clearInterval(iv);
  }, [selfId]);

  // Derived peers list — everyone except self, not stale
  const peers = useMemo(() => {
    const now = Date.now();
    return Object.values(presenceMap || {})
      .filter(p => p.id !== selfId && now - (p.ts || 0) <= STALE_THRESHOLD)
      .sort((a, b) => b.ts - a.ts);
  }, [presenceMap, selfId]);

  return { peers, selfId };
}

// ── PresenceBar — desktop sidebar strip ───────────────────────
/**
 * Renders in the desktop sidebar footer.
 * Shows "N online" with avatar bubbles + dropdown detail on click.
 *
 * Props: peers, dm, t
 */
export function PresenceBar({ peers = [], dm, t }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const count = peers.length;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  const border   = t?.border || "rgba(255,255,255,0.08)";
  const sub      = t?.sub    || "#9ca3af";
  const card     = dm ? "#111827" : "#ffffff";
  const textClr  = t?.text   || "#f9fafb";

  if (count === 0) return (
    <div style={{ display:"flex", alignItems:"center", gap:7, padding:"8px 2px", opacity:0.45 }}>
      <div style={{ width:7, height:7, borderRadius:"50%", background:"#6b7280" }} />
      <span style={{ color:sub, fontSize:11, fontWeight:500 }}>Only you online</span>
    </div>
  );

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display:"flex", alignItems:"center", gap:8, width:"100%",
          background:"rgba(255,255,255,0.04)", border:`1px solid ${border}`,
          borderRadius:10, padding:"8px 10px", cursor:"pointer",
          WebkitTapHighlightColor:"transparent",
        }}
      >
        {/* Live dot */}
        <div style={{ position:"relative", flexShrink:0 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:"#10b981" }} />
          <div style={{
            position:"absolute", inset:-2, borderRadius:"50%",
            background:"#10b981", opacity:0.35,
            animation:"presencePulse 2s ease-in-out infinite",
          }} />
        </div>
        {/* Avatar stack */}
        <div style={{ display:"flex", marginLeft:2 }}>
          {peers.slice(0,3).map((p, i) => (
            <div key={p.id} style={{
              width:22, height:22, borderRadius:"50%",
              background:p.color, color:"#fff",
              fontWeight:800, fontSize:9,
              display:"flex", alignItems:"center", justifyContent:"center",
              border:`2px solid ${dm?"#111827":"#1e293b"}`,
              marginLeft: i > 0 ? -7 : 0,
              zIndex: 10 - i,
              flexShrink: 0,
            }}>{initials(p.name)}</div>
          ))}
          {count > 3 && (
            <div style={{
              width:22, height:22, borderRadius:"50%",
              background:"rgba(255,255,255,0.1)", color:sub,
              fontWeight:800, fontSize:9,
              display:"flex", alignItems:"center", justifyContent:"center",
              border:`2px solid ${dm?"#111827":"#1e293b"}`,
              marginLeft:-7, zIndex:6, flexShrink:0,
            }}>+{count-3}</div>
          )}
        </div>
        <span style={{ color:textClr, fontSize:11, fontWeight:600 }}>
          {count} online
        </span>
        <span style={{ marginLeft:"auto", color:sub, fontSize:10 }}>{open?"▲":"▼"}</span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position:"absolute", bottom:"calc(100% + 6px)", left:0, right:0,
          background:card, border:`1px solid ${border}`,
          borderRadius:12, boxShadow:"0 -8px 32px rgba(0,0,0,0.25)",
          zIndex:500, overflow:"hidden",
          animation:"presenceFadeIn 0.15s ease",
        }}>
          <div style={{ padding:"10px 12px 6px", borderBottom:`1px solid ${border}` }}>
            <p style={{ color:sub, fontSize:9, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.07em" }}>
              🟢 Active users
            </p>
          </div>
          <div style={{ maxHeight:240, overflowY:"auto" }}>
            {peers.map(p => (
              <PresencePeerRow key={p.id} peer={p} sub={sub} textClr={textClr} border={border} />
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes presencePulse{0%,100%{transform:scale(1);opacity:.35}50%{transform:scale(1.8);opacity:0}}
        @keyframes presenceFadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
    </div>
  );
}

function PresencePeerRow({ peer, sub, textClr, border }) {
  const secAgo = Math.round((Date.now() - peer.ts) / 1000);
  const freshness = secAgo < 25 ? "🟢" : "🟡";
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:10,
      padding:"9px 12px", borderBottom:`1px solid ${border}`,
    }}>
      <div style={{
        width:32, height:32, borderRadius:"50%",
        background:peer.color, color:"#fff",
        fontWeight:800, fontSize:11,
        display:"flex", alignItems:"center", justifyContent:"center",
        flexShrink:0,
      }}>{initials(peer.name)}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <span style={{ color:textClr, fontWeight:700, fontSize:12 }} className="truncate">{peer.name}</span>
          <span style={{ fontSize:9 }}>{freshness}</span>
        </div>
        <div style={{ color:sub, fontSize:10, marginTop:1, display:"flex", gap:6, flexWrap:"wrap" }}>
          <span style={{ textTransform:"capitalize" }}>{peer.role}</span>
          {peer.tab && <><span>·</span><span>📍 {peer.tab}</span></>}
          {peer.editing && <><span>·</span><span style={{ color:peer.color }}>✏️ {peer.editing.label}</span></>}
        </div>
      </div>
      <span style={{ color:sub, fontSize:9, flexShrink:0 }}>{secAgo}s ago</span>
    </div>
  );
}

// ── PresenceDot — compact mobile badge ───────────────────────
/**
 * Tiny badge showing online count. Click opens a popover with peer details.
 * Props: peers, dm, t
 */
export function PresenceDot({ peers = [], dm, t }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const count = peers.length;
  const border  = t?.border || "rgba(0,0,0,0.1)";
  const sub     = t?.sub    || "#9ca3af";
  const textClr = t?.text   || "#111827";
  const card    = dm ? "#1e293b" : "#ffffff";

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    document.addEventListener("touchstart", fn);
    return () => { document.removeEventListener("mousedown", fn); document.removeEventListener("touchstart", fn); };
  }, [open]);

  const dot = count === 0 ? (
    <div style={{ width:8, height:8, borderRadius:"50%", background:"#4b5563" }} />
  ) : (
    <>
      <div style={{ position:"relative", width:8, height:8 }}>
        <div style={{ width:8, height:8, borderRadius:"50%", background:"#10b981" }} />
        <div style={{ position:"absolute", inset:-2, borderRadius:"50%", background:"#10b981", opacity:0.3, animation:"presencePulse 2s ease-in-out infinite" }} />
      </div>
      <span style={{ color:"#10b981", fontSize:11, fontWeight:700 }}>{count}</span>
    </>
  );

  const btnStyle = count === 0
    ? { background:"none", border:"none", padding:"4px", cursor:"pointer", display:"flex", alignItems:"center", gap:4, WebkitTapHighlightColor:"transparent" }
    : { background: open ? "rgba(16,185,129,0.2)" : "rgba(16,185,129,0.12)", border:"1.5px solid rgba(16,185,129,0.3)", borderRadius:20, padding:"4px 8px 4px 6px", display:"flex", alignItems:"center", gap:5, cursor:"pointer", WebkitTapHighlightColor:"transparent" };

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={() => setOpen(o => !o)} title={count === 0 ? "Only you online" : `${count} user${count>1?"s":""} online`} style={btnStyle}>
        {dot}
      </button>

      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 8px)", right:0,
          width:260, background:card,
          border:`1px solid ${border}`,
          borderRadius:16, boxShadow:"0 12px 40px rgba(0,0,0,0.18)",
          zIndex:9999, overflow:"hidden",
          animation:"presenceFadeIn 0.15s ease",
        }}>
          {/* Header */}
          <div style={{ padding:"10px 14px 8px", borderBottom:`1px solid ${border}`, display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ position:"relative", width:8, height:8, flexShrink:0 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background: count > 0 ? "#10b981" : "#4b5563" }} />
              {count > 0 && <div style={{ position:"absolute", inset:-2, borderRadius:"50%", background:"#10b981", opacity:0.3, animation:"presencePulse 2s ease-in-out infinite" }} />}
            </div>
            <span style={{ color:textClr, fontSize:12, fontWeight:800, flex:1 }}>
              {count === 0 ? "Only you online" : `${count} user${count>1?"s":""} online`}
            </span>
            <button onClick={() => setOpen(false)} style={{ background:"none", border:"none", color:sub, fontSize:14, cursor:"pointer", padding:"0 2px", lineHeight:1, fontWeight:700 }}>✕</button>
          </div>

          {/* Peer list */}
          {count === 0 ? (
            <div style={{ padding:"18px 14px", textAlign:"center" }}>
              <p style={{ color:sub, fontSize:12 }}>No other users are online right now.</p>
            </div>
          ) : (
            <div style={{ maxHeight:280, overflowY:"auto", WebkitOverflowScrolling:"touch" }}>
              {peers.map(p => {
                const secAgo = Math.round((Date.now() - p.ts) / 1000);
                return (
                  <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderBottom:`1px solid ${border}` }}>
                    <div style={{ width:34, height:34, borderRadius:"50%", background:p.color, color:"#fff", fontWeight:800, fontSize:12, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:`0 2px 8px ${p.color}40` }}>
                      {initials(p.name)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <span style={{ color:textClr, fontWeight:700, fontSize:12 }} className="truncate">{p.name}</span>
                        <span style={{ background:`${p.color}18`, color:p.color, borderRadius:4, padding:"1px 5px", fontSize:9, fontWeight:800, textTransform:"uppercase", flexShrink:0 }}>{p.role}</span>
                      </div>
                      <div style={{ color:sub, fontSize:10, marginTop:2, display:"flex", gap:5, flexWrap:"wrap" }}>
                        {p.tab && <span>📍 {p.tab}</span>}
                        {p.editing && <span style={{ color:p.color, fontWeight:600 }}>✏️ {p.editing.label}</span>}
                      </div>
                    </div>
                    <span style={{ color:sub, fontSize:9, flexShrink:0 }}>{secAgo < 60 ? `${secAgo}s` : `${Math.round(secAgo/60)}m`}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes presencePulse{0%,100%{transform:scale(1);opacity:.3}50%{transform:scale(1.8);opacity:0}}
        @keyframes presenceFadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
    </div>
  );
}

// ── PresenceAvatars — overlapping stack ───────────────────────
/**
 * Compact overlapping avatars for embedding anywhere (e.g. tab header).
 * Props: peers, max (default 4), size (default 28), dm
 */
export function PresenceAvatars({ peers = [], max = 4, size = 28, dm }) {
  const visible  = peers.slice(0, max);
  const overflow = peers.length - max;
  const bg = dm ? "#0d1b2a" : "#ffffff";

  return (
    <div style={{ display:"flex", alignItems:"center" }}>
      {visible.map((p, i) => (
        <div key={p.id} title={`${p.name} — ${p.tab || "online"}`} style={{
          width:size, height:size, borderRadius:"50%",
          background:p.color, color:"#fff",
          fontWeight:800, fontSize:Math.round(size * 0.36),
          display:"flex", alignItems:"center", justifyContent:"center",
          border:`2px solid ${bg}`,
          marginLeft: i > 0 ? -(size * 0.3) : 0,
          zIndex: max - i,
          flexShrink:0, cursor:"default",
          boxShadow:`0 1px 4px rgba(0,0,0,0.2)`,
        }}>{initials(p.name)}</div>
      ))}
      {overflow > 0 && (
        <div style={{
          width:size, height:size, borderRadius:"50%",
          background:"rgba(255,255,255,0.12)", color:"rgba(255,255,255,0.7)",
          fontWeight:800, fontSize:Math.round(size * 0.32),
          display:"flex", alignItems:"center", justifyContent:"center",
          border:`2px solid ${bg}`,
          marginLeft: -(size * 0.3),
          zIndex:0, flexShrink:0,
        }}>+{overflow}</div>
      )}
    </div>
  );
}

// ── EditingIndicator — "John is editing this" banner ─────────
/**
 * Shows a non-intrusive banner when another user is editing the same record.
 *
 * Props:
 *   peers        — from usePresence
 *   recordType   — "delivery" | "customer" | "expense" | ...
 *   recordId     — the id of the record being viewed/edited
 *   dm, t
 */
export function EditingIndicator({ peers = [], recordType, recordId, dm, t }) {
  const editors = peers.filter(p =>
    p.editing &&
    p.editing.type === recordType &&
    p.editing.id   === recordId
  );

  if (editors.length === 0) return null;

  const names  = editors.map(p => p.name).join(", ");
  const plural = editors.length > 1;
  const color  = editors[0].color;

  return (
    <div style={{
      display:"flex", alignItems:"center", gap:10,
      padding:"10px 14px",
      background:`${color}12`,
      border:`1px solid ${color}35`,
      borderRadius:12, marginBottom:12,
      animation:"presenceFadeIn 0.2s ease",
    }}>
      {/* Pulse dot */}
      <div style={{ position:"relative", width:10, height:10, flexShrink:0 }}>
        <div style={{ width:10, height:10, borderRadius:"50%", background:color }} />
        <div style={{ position:"absolute", inset:-3, borderRadius:"50%", background:color, opacity:0.25, animation:"presencePulse 2s ease-in-out infinite" }} />
      </div>
      <div style={{ flex:1 }}>
        <span style={{ color, fontWeight:700, fontSize:12 }}>{names}</span>
        <span style={{ color: t?.sub || "#9ca3af", fontSize:12 }}>
          {" "}{plural ? "are" : "is"} currently editing this record
        </span>
      </div>
      <style>{`
        @keyframes presencePulse{0%,100%{transform:scale(1);opacity:.25}50%{transform:scale(2);opacity:0}}
        @keyframes presenceFadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
    </div>
  );
}

// ── PresencePanel — full panel for settings / admin ───────────
/**
 * Detailed presence panel for the admin Settings tab.
 * Shows all online users with their current activity, last seen, device, etc.
 * Drop inside Settings tab under a "Active Users" section.
 *
 * Props: peers, dm, t
 */
export function PresencePanel({ peers = [], dm, t }) {
  const border  = t?.border || "rgba(255,255,255,0.08)";
  const sub     = t?.sub    || "#9ca3af";
  const muted   = t?.muted  || "#6b7280";
  const textClr = t?.text   || "#f9fafb";
  const inp     = t?.inp    || "rgba(255,255,255,0.04)";

  return (
    <div style={{ borderRadius:16, overflow:"hidden", border:`1px solid ${border}` }}>
      {/* Header */}
      <div style={{
        padding:"12px 16px", borderBottom:`1px solid ${border}`,
        display:"flex", alignItems:"center", gap:10,
      }}>
        <div style={{ position:"relative", width:10, height:10 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:"#10b981" }} />
          {peers.length > 0 && <div style={{ position:"absolute", inset:-3, borderRadius:"50%", background:"#10b981", opacity:0.25, animation:"presencePulse 2s ease-in-out infinite" }} />}
        </div>
        <p style={{ color:textClr, fontWeight:800, fontSize:13, flex:1 }}>
          Active Users
        </p>
        <span style={{
          background:peers.length > 0 ? "#10b98120" : inp,
          color:peers.length > 0 ? "#10b981" : muted,
          borderRadius:99, padding:"2px 10px", fontSize:11, fontWeight:700,
        }}>
          {peers.length} online
        </span>
      </div>

      {peers.length === 0 ? (
        <div style={{ padding:"24px 16px", textAlign:"center", color:muted, fontSize:12 }}>
          No other users online right now
        </div>
      ) : (
        <div>
          {peers.map(p => {
            const secAgo = Math.round((Date.now() - p.ts) / 1000);
            return (
              <div key={p.id} style={{
                display:"flex", alignItems:"center", gap:12,
                padding:"12px 16px", borderBottom:`1px solid ${border}`,
              }}>
                <div style={{
                  width:40, height:40, borderRadius:"50%",
                  background:p.color, color:"#fff",
                  fontWeight:800, fontSize:14, flexShrink:0,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  boxShadow:`0 2px 8px ${p.color}40`,
                }}>{initials(p.name)}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ color:textClr, fontWeight:700, fontSize:13 }}>{p.name}</span>
                    <span style={{
                      background:`${p.color}18`, color:p.color,
                      borderRadius:4, padding:"1px 6px", fontSize:9, fontWeight:800, textTransform:"uppercase",
                    }}>{p.role}</span>
                  </div>
                  <div style={{ display:"flex", gap:8, marginTop:3, flexWrap:"wrap" }}>
                    {p.tab && (
                      <span style={{ color:sub, fontSize:11 }}>
                        📍 {p.tab}
                      </span>
                    )}
                    {p.editing && (
                      <span style={{ color:p.color, fontSize:11, fontWeight:600 }}>
                        ✏️ {p.editing.label}
                      </span>
                    )}
                  </div>
                </div>
                <span style={{ color:muted, fontSize:10, flexShrink:0 }}>
                  {secAgo < 60 ? `${secAgo}s ago` : `${Math.round(secAgo/60)}m ago`}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <style>{`@keyframes presencePulse{0%,100%{transform:scale(1);opacity:.25}50%{transform:scale(2);opacity:0}}`}</style>
    </div>
  );
}

export default PresenceBar;
