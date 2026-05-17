/* eslint-disable react-hooks/exhaustive-deps */
// ============================================================
// components/SystemHealthBar.js  — #11 (enhanced)
//
// Persistent system health status bar.
// Shows: Firebase sync status, last-sync time, error count,
// data freshness, latency, uptime, session info, sync history.
//
// Exports:
//   <SystemHealthBar dm t _syncListeners dataLoaded collectionsLoaded />
//   <SystemHealthDot  dm _syncListeners />   ← tiny inline indicator
//   useSystemHealth(_syncListeners)           ← hook for custom UI
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from "react";

// ── Status types ──────────────────────────────────────────────
const STATUS = {
  connecting: { label: "Connecting",  color: "#3b82f6", icon: "⟳"  },
  live:       { label: "Live",        color: "#10b981", icon: "●"   },
  syncing:    { label: "Syncing",     color: "#f59e0b", icon: "↻"   },
  error:      { label: "Error",       color: "#ef4444", icon: "⚠"   },
  stale:      { label: "Stale data",  color: "#f97316", icon: "⏱"   },
  offline:    { label: "Offline",     color: "#6b7280", icon: "✕"   },
};

const STALE_MS = 5 * 60 * 1000; // 5 minutes without sync = stale
const MAX_SYNC_HISTORY = 8;      // keep last 8 sync timestamps

// ── Core hook ─────────────────────────────────────────────────
export function useSystemHealth(syncListeners) {
  const [lastSync,     setLastSync]     = useState(null);
  const [syncCount,    setSyncCount]    = useState(0);
  const [errorCount,   setErrorCount]   = useState(0);
  const [lastError,    setLastError]    = useState(null);
  const [latency,      setLatency]      = useState(null);
  const [latencyHistory, setLatencyHistory] = useState([]);  // for avg
  const [isSyncing,    setIsSyncing]    = useState(false);
  const [isOnline,     setIsOnline]     = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [syncHistory,  setSyncHistory]  = useState([]);      // last N sync times
  const [sessionStart] = useState(() => new Date());         // session start time
  const [uptime,       setUptime]       = useState(0);       // seconds since session start

  const syncStartRef = useRef(null);
  const syncTimerRef = useRef(null);

  // Uptime ticker — updates every 10s
  useEffect(() => {
    const tick = () => setUptime(Math.floor((Date.now() - sessionStart.getTime()) / 1000));
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, [sessionStart]);

  // Online/offline detection
  useEffect(() => {
    const onOnline  = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online",  onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online",  onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Hook into _syncListeners from lib/store
  useEffect(() => {
    if (!syncListeners) return;

    const onSync = (tsValue) => {
      const now = Date.now();

      if (syncStartRef.current) {
        const lat = now - syncStartRef.current;
        setLatency(lat);
        setLatencyHistory(h => [...h.slice(-19), lat]);  // keep last 20
        syncStartRef.current = null;
      }

      const syncTime = tsValue instanceof Date ? tsValue : new Date();
      setLastSync(syncTime);
      setSyncCount(c => c + 1);
      setSyncHistory(h => [...h.slice(-(MAX_SYNC_HISTORY - 1)), syncTime]);
      setIsSyncing(false);

      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };

    const onSyncStart = () => {
      syncStartRef.current = Date.now();
      setIsSyncing(true);
      syncTimerRef.current = setTimeout(() => setIsSyncing(false), 10000);
    };

    syncListeners.add(onSync);
    if (syncListeners._startListeners) {
      syncListeners._startListeners.add(onSyncStart);
    }

    return () => {
      syncListeners.delete(onSync);
      if (syncListeners._startListeners) {
        syncListeners._startListeners.delete(onSyncStart);
      }
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [syncListeners]);

  // Global error catcher
  useEffect(() => {
    const onError = (e) => {
      if (e.message?.toLowerCase().includes("firebase") ||
          e.message?.toLowerCase().includes("firestore") ||
          e.message?.toLowerCase().includes("network")) {
        setErrorCount(c => c + 1);
        setLastError(e.message?.slice(0, 80) || "Unknown error");
      }
    };
    const onUnhandled = (e) => {
      const msg = e.reason?.message || "";
      if (msg.toLowerCase().includes("firebase") || msg.toLowerCase().includes("firestore")) {
        setErrorCount(c => c + 1);
        setLastError(msg.slice(0, 80));
      }
    };
    window.addEventListener("error",              onError);
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => {
      window.removeEventListener("error",              onError);
      window.removeEventListener("unhandledrejection", onUnhandled);
    };
  }, []);

  // Derived status
  const now   = Date.now();
  const stale = lastSync && (now - lastSync.getTime()) > STALE_MS;
  const status =
    !isOnline             ? "offline"    :
    isSyncing             ? "syncing"    :
    lastError && !lastSync ? "error"    :
    stale                 ? "stale"      :
    lastSync              ? "live"       :
    "connecting";

  const timeSinceSync = lastSync ? Math.floor((now - lastSync.getTime()) / 1000) : null;
  const avgLatency    = latencyHistory.length
    ? Math.round(latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length)
    : null;

  // Data freshness 0–100 (100 = just synced, 0 = stale threshold reached)
  const freshnessPercent = lastSync
    ? Math.max(0, Math.min(100, Math.round(100 - ((now - lastSync.getTime()) / STALE_MS) * 100)))
    : 0;

  const clearError = useCallback(() => {
    setErrorCount(0);
    setLastError(null);
  }, []);

  return {
    status, lastSync, syncCount, errorCount, lastError,
    latency, avgLatency, latencyHistory,
    isSyncing, isOnline, timeSinceSync, stale,
    syncHistory, sessionStart, uptime, freshnessPercent,
    clearError,
  };
}

// ── Helpers ───────────────────────────────────────────────────
function formatAge(seconds) {
  if (seconds === null || seconds === undefined) return null;
  if (seconds < 5)    return "just now";
  if (seconds < 60)   return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function formatUptime(seconds) {
  if (seconds < 60)   return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatTime(date) {
  if (!date) return "—";
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function latencyColor(ms) {
  if (ms === null) return "#6b7280";
  if (ms < 300)  return "#10b981";
  if (ms < 800)  return "#f59e0b";
  return "#ef4444";
}

function latencyLabel(ms) {
  if (ms === null) return "—";
  if (ms < 300)  return "Fast";
  if (ms < 800)  return "OK";
  return "Slow";
}

// ── Animated dot ─────────────────────────────────────────────
function StatusDot({ color, animate = true, size = 7 }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: size + 6, height: size + 6 }}>
      {animate && (
        <span style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: color, opacity: 0.25,
          animation: "sys-ping 1.4s ease-in-out infinite",
        }} />
      )}
      <span style={{
        width: size, height: size, borderRadius: "50%",
        background: color, display: "block", flexShrink: 0,
        boxShadow: animate ? `0 0 6px ${color}` : "none",
      }} />
    </span>
  );
}

// ── Mini stat pill ────────────────────────────────────────────
function StatPill({ label, value, color, muted }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: `${color}12`, border: `1px solid ${color}25`,
      borderRadius: 99, padding: "2px 8px",
    }}>
      <span style={{ color: muted, fontSize: 9, fontWeight: 600 }}>{label}</span>
      <span style={{ color, fontSize: 10, fontWeight: 800 }}>{value}</span>
    </span>
  );
}

// ── Freshness bar ─────────────────────────────────────────────
function FreshnessBar({ percent, dm }) {
  const color = percent > 60 ? "#10b981" : percent > 30 ? "#f59e0b" : "#ef4444";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ color: "#9ca3af", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Data Freshness
        </span>
        <span style={{ color, fontSize: 9, fontWeight: 800 }}>{percent}%</span>
      </div>
      <div style={{
        height: 4, borderRadius: 99,
        background: dm ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: `${percent}%`, borderRadius: 99,
          background: color,
          transition: "width 1s ease, background 0.5s ease",
          boxShadow: `0 0 6px ${color}60`,
        }} />
      </div>
    </div>
  );
}

// ── Sync history timeline ─────────────────────────────────────
function SyncTimeline({ syncHistory, dm, muted, border }) {
  if (!syncHistory.length) return (
    <p style={{ color: muted, fontSize: 10, fontStyle: "italic" }}>No syncs yet this session</p>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {[...syncHistory].reverse().map((t, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 8,
          opacity: 1 - i * 0.1,
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
            background: i === 0 ? "#10b981" : "#10b98155",
          }} />
          <span style={{ color: i === 0 ? "#10b981" : muted, fontSize: 10, fontWeight: i === 0 ? 700 : 400 }}>
            {formatTime(t)}
          </span>
          {i === 0 && (
            <span style={{
              background: "#10b98115", color: "#10b981",
              border: "1px solid #10b98130",
              borderRadius: 99, padding: "0px 6px", fontSize: 8, fontWeight: 700,
            }}>latest</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Latency sparkline ─────────────────────────────────────────
function LatencySparkline({ history, dm }) {
  if (history.length < 2) return null;
  const max = Math.max(...history);
  const min = Math.min(...history);
  const range = max - min || 1;
  const W = 80, H = 24;
  const pts = history.slice(-12).map((v, i, arr) => {
    const x = (i / (arr.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  const last = history[history.length - 1];
  const col  = latencyColor(last);

  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      <polyline
        points={pts}
        fill="none"
        stroke={col}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.8"
      />
      {/* last dot */}
      {(() => {
        const arr = history.slice(-12);
        const lx  = W;
        const ly  = H - ((arr[arr.length - 1] - min) / range) * (H - 4) - 2;
        return <circle cx={lx} cy={ly} r="2.5" fill={col} />;
      })()}
    </svg>
  );
}

// ── Tiny inline dot ───────────────────────────────────────────
export function SystemHealthDot({ dm, _syncListeners }) {
  const health = useSystemHealth(_syncListeners);
  const meta   = STATUS[health.status];
  return (
    <>
      <style>{`@keyframes sys-ping{0%,100%{transform:scale(1);opacity:0.25}50%{transform:scale(1.8);opacity:0}}`}</style>
      <StatusDot color={meta.color} animate={health.status !== "live"} size={6} />
    </>
  );
}

// ── Main status bar ───────────────────────────────────────────
export function SystemHealthBar({
  dm,
  t,
  _syncListeners,
  dataLoaded        = true,
  collectionsLoaded = {},
  position          = "inline",   // "inline" | "sticky-bottom"
  showLatency       = true,       // default on now
}) {
  const health  = useSystemHealth(_syncListeners);
  const [open,  setOpen]  = useState(false);
  const [pulse, setPulse] = useState(false);

  const border = t?.border || "rgba(255,255,255,0.08)";
  const sub    = t?.sub    || "#9ca3af";
  const muted  = t?.muted  || "#6b7280";
  const card   = dm ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";

  const meta   = STATUS[health.status];

  // Pulse on each sync
  useEffect(() => {
    if (health.syncCount === 0) return;
    setPulse(true);
    const tid = setTimeout(() => setPulse(false), 600);
    return () => clearTimeout(tid);
  }, [health.syncCount]);

  const wrapStyle = position === "sticky-bottom" ? {
    position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9998,
    borderTop: `1px solid ${border}`,
  } : {};

  const collKeys    = Object.keys(collectionsLoaded);
  const loadedCount = collKeys.filter(k => collectionsLoaded[k]).length;

  return (
    <>
      <style>{`
        @keyframes sys-ping      { 0%,100%{transform:scale(1);opacity:0.25} 50%{transform:scale(1.8);opacity:0} }
        @keyframes sys-pulse-bar { 0%,100%{opacity:1} 50%{opacity:0.6} }
        @keyframes sys-spin      { to{transform:rotate(360deg)} }
      `}</style>

      <div style={{
        ...wrapStyle,
        background: dm
          ? pulse ? `rgba(${health.status === "live" ? "16,185,129" : "59,130,246"},0.08)` : "rgba(0,0,0,0.6)"
          : pulse ? "rgba(16,185,129,0.04)" : "rgba(255,255,255,0.9)",
        backdropFilter: "blur(12px)",
        transition: "background 0.3s ease",
      }}>

        {/* ── Slim status strip ── */}
        <div
          onClick={() => setOpen(o => !o)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 14px", cursor: "pointer",
            userSelect: "none", flexWrap: "wrap",
          }}
        >
          <StatusDot
            color={meta.color}
            animate={health.status !== "live" && health.status !== "offline"}
            size={6}
          />

          {/* Status label */}
          <span style={{ color: meta.color, fontSize: 10, fontWeight: 700 }}>
            {health.isSyncing ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ display: "inline-block", animation: "sys-spin 0.7s linear infinite", fontSize: 10 }}>↻</span>
                Syncing…
              </span>
            ) : meta.label}
          </span>

          {/* Sync time */}
          {health.timeSinceSync !== null && (
            <span style={{ color: muted, fontSize: 10 }}>
              · {formatAge(health.timeSinceSync)}
            </span>
          )}

          {/* Separator */}
          <span style={{ color: border, fontSize: 10 }}>|</span>

          {/* Network badge */}
          <StatPill
            label="Net"
            value={health.isOnline ? "Online" : "Offline"}
            color={health.isOnline ? "#10b981" : "#6b7280"}
            muted={muted}
          />

          {/* Latency pill */}
          {showLatency && health.latency !== null && (
            <StatPill
              label="Ping"
              value={`${health.latency}ms`}
              color={latencyColor(health.latency)}
              muted={muted}
            />
          )}

          {/* Sync count */}
          {health.syncCount > 0 && (
            <StatPill
              label="Syncs"
              value={health.syncCount}
              color="#3b82f6"
              muted={muted}
            />
          )}

          {/* Uptime */}
          <StatPill
            label="Up"
            value={formatUptime(health.uptime)}
            color="#8b5cf6"
            muted={muted}
          />

          {/* Data not loaded */}
          {!dataLoaded && (
            <span style={{ color: "#f59e0b", fontSize: 9, fontWeight: 700 }}>Loading data…</span>
          )}

          {/* Collections partial load */}
          {collKeys.length > 0 && loadedCount < collKeys.length && (
            <span style={{ color: "#f59e0b", fontSize: 9, fontWeight: 700 }}>
              {loadedCount}/{collKeys.length} collections
            </span>
          )}

          {/* Error badge */}
          {health.errorCount > 0 && (
            <span style={{
              background: "#ef444420", color: "#ef4444",
              border: "1px solid #ef444430",
              borderRadius: 99, padding: "1px 7px", fontSize: 9, fontWeight: 800,
            }}>
              {health.errorCount} error{health.errorCount !== 1 ? "s" : ""}
            </span>
          )}

          {/* Expand caret */}
          <span style={{
            color: muted, fontSize: 10, marginLeft: "auto",
            transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)",
            display: "inline-block",
          }}>▾</span>
        </div>

        {/* ── Expanded detail panel ── */}
        {open && (
          <div style={{
            borderTop: `1px solid ${border}`,
            padding: "14px 14px",
            display: "flex", flexDirection: "column", gap: 14,
          }}>

            {/* Row 1 — status cards */}
            <div style={{ display: "flex", alignItems: "stretch", gap: 8, flexWrap: "wrap" }}>

              {/* Connection status */}
              <div style={{
                background: `${meta.color}12`, border: `1px solid ${meta.color}30`,
                borderRadius: 10, padding: "10px 14px", minWidth: 120,
                display: "flex", alignItems: "center", gap: 8, flex: "1 1 auto",
              }}>
                <StatusDot color={meta.color} animate={false} size={8} />
                <div>
                  <p style={{ color: meta.color, fontWeight: 800, fontSize: 13 }}>{meta.label}</p>
                  <p style={{ color: muted, fontSize: 10, marginTop: 1 }}>
                    {health.lastSync
                      ? `Last synced ${formatTime(health.lastSync)}`
                      : "Waiting for first sync…"}
                  </p>
                </div>
              </div>

              {/* Network */}
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 14px", minWidth: 80 }}>
                <p style={{ color: sub, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Network</p>
                <p style={{ color: health.isOnline ? "#10b981" : "#6b7280", fontWeight: 800, fontSize: 13, marginTop: 2 }}>
                  {health.isOnline ? "Online" : "Offline"}
                </p>
              </div>

              {/* Uptime */}
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 14px", minWidth: 80 }}>
                <p style={{ color: sub, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Session uptime</p>
                <p style={{ color: "#8b5cf6", fontWeight: 800, fontSize: 13, marginTop: 2 }}>{formatUptime(health.uptime)}</p>
                <p style={{ color: muted, fontSize: 9, marginTop: 1 }}>since {formatTime(health.sessionStart)}</p>
              </div>

              {/* Sync count */}
              <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 14px", minWidth: 70 }}>
                <p style={{ color: sub, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Total syncs</p>
                <p style={{ color: "#3b82f6", fontWeight: 800, fontSize: 13, marginTop: 2 }}>{health.syncCount}</p>
              </div>

              {/* Latency */}
              {health.latency !== null && (
                <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 14px", minWidth: 100 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <p style={{ color: sub, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Latency</p>
                    <LatencySparkline history={health.latencyHistory} dm={dm} />
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
                    <p style={{ color: latencyColor(health.latency), fontWeight: 800, fontSize: 13 }}>
                      {health.latency}ms
                    </p>
                    <span style={{ color: latencyColor(health.latency), fontSize: 9, fontWeight: 700 }}>
                      {latencyLabel(health.latency)}
                    </span>
                  </div>
                  {health.avgLatency !== null && (
                    <p style={{ color: muted, fontSize: 9, marginTop: 1 }}>avg {health.avgLatency}ms</p>
                  )}
                </div>
              )}
            </div>

            {/* Row 2 — freshness bar */}
            <FreshnessBar percent={health.freshnessPercent} dm={dm} />

            {/* Row 3 — sync timeline + collections */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>

              {/* Sync history */}
              <div style={{ flex: "1 1 160px" }}>
                <p style={{ color: sub, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                  Recent syncs
                </p>
                <SyncTimeline syncHistory={health.syncHistory} dm={dm} muted={muted} border={border} />
              </div>

              {/* Collections */}
              {collKeys.length > 0 && (
                <div style={{ flex: "1 1 160px" }}>
                  <p style={{ color: sub, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                    Collections — {loadedCount}/{collKeys.length} loaded
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {collKeys.map(k => (
                      <span key={k} style={{
                        background: collectionsLoaded[k] ? "#10b98112" : "#f59e0b12",
                        border: `1px solid ${collectionsLoaded[k] ? "#10b98125" : "#f59e0b25"}`,
                        color: collectionsLoaded[k] ? "#10b981" : "#f59e0b",
                        borderRadius: 99, padding: "3px 10px", fontSize: 9, fontWeight: 700,
                      }}>
                        {collectionsLoaded[k] ? "✓" : "⟳"} {k}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Error detail */}
            {health.lastError && (
              <div style={{
                background: "#ef444410", border: "1px solid #ef444430",
                borderRadius: 10, padding: "10px 14px",
                display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10,
              }}>
                <div>
                  <p style={{ color: "#ef4444", fontWeight: 700, fontSize: 11 }}>
                    {health.errorCount} error{health.errorCount !== 1 ? "s" : ""} detected
                  </p>
                  <p style={{ color: muted, fontSize: 10, marginTop: 2, fontStyle: "italic" }}>{health.lastError}</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); health.clearError(); }}
                  style={{
                    background: "transparent", border: "1px solid #ef444440", borderRadius: 8,
                    color: "#ef4444", fontSize: 10, fontWeight: 700, padding: "4px 10px", cursor: "pointer",
                    flexShrink: 0,
                  }}
                >Dismiss</button>
              </div>
            )}

            {/* Stale warning */}
            {health.stale && (
              <div style={{
                background: "#f59e0b10", border: "1px solid #f59e0b30",
                borderRadius: 10, padding: "8px 14px",
              }}>
                <p style={{ color: "#f59e0b", fontSize: 11, fontWeight: 700 }}>
                  Data may be stale — last synced {formatAge(health.timeSinceSync)}
                </p>
                <p style={{ color: muted, fontSize: 10, marginTop: 2 }}>
                  Check your connection. Firebase may be rate-limiting or temporarily unavailable.
                </p>
              </div>
            )}

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: muted, fontSize: 9 }}>
                Session started {health.sessionStart.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <a
                href="https://status.firebase.google.com"
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ color: muted, fontSize: 9, textDecoration: "none", fontWeight: 600 }}
              >
                Firebase Status ↗
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
