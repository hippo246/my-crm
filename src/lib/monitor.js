/* eslint-disable */
// ═══════════════════════════════════════════════════════════════
//  MONITOR.JS + AlertsPanel — Monitoring & Alerting (Feature 15)
//  Tracks: failed logins, rule denials, traffic spikes, DB errors,
//  function failures. Surfaces alerts in the admin Settings panel.
// ═══════════════════════════════════════════════════════════════

import { db } from "../firebase";
import { ref, push, onValue, get, serverTimestamp } from "firebase/database";
import { useState, useEffect, useRef, useCallback } from "react";

// ── Event severity levels ────────────────────────────────────────
export const SEVERITY = {
  INFO:     "info",
  WARN:     "warn",
  CRITICAL: "critical",
};

// ── Event types ──────────────────────────────────────────────────
export const MONITOR_EVENTS = {
  LOGIN_FAILED:       "login_failed",
  LOGIN_SUCCESS:      "login_success",
  PERM_DENIED:        "perm_denied",
  EXPORT_BLOCKED:     "export_blocked",
  EXPORT_DONE:        "export_done",
  DB_ERROR:           "db_error",
  FUNCTION_FAILED:    "function_failed",
  TRAFFIC_SPIKE:      "traffic_spike",
  SUSPICIOUS_ACTIVITY:"suspicious_activity",
  APPROVAL_REQUESTED: "approval_requested",
  APPROVAL_RESOLVED:  "approval_resolved",
  BULK_DELETE:        "bulk_delete",
  DATA_MODIFIED:      "data_modified",
};

// ── trackEvent ───────────────────────────────────────────────────
// Core logging function. Fire-and-forget — never await in hot paths.
// Pass context = { uid, name, role, ip, device } where available.
export async function trackEvent({ type, severity = SEVERITY.INFO, message, context = {}, data = {} }) {
  const entry = {
    type,
    severity,
    message,
    context: {
      uid:    context.uid    || "unknown",
      name:   context.name   || "unknown",
      role:   context.role   || "unknown",
      device: context.device || (typeof navigator !== "undefined" ? navigator.userAgent?.slice(0, 80) : ""),
    },
    data,
    ts:      Date.now(),
    tsHuman: new Date().toISOString(),
  };

  try {
    await push(ref(db, "tas9_monitor_log"), entry);
  } catch (e) {
    // Never let monitoring crash the app
    console.warn("Monitor log write failed:", e.message);
  }
}

// ── Convenience shortcuts ────────────────────────────────────────

export const monitor = {
  loginFailed: (identifier, context) =>
    trackEvent({
      type: MONITOR_EVENTS.LOGIN_FAILED,
      severity: SEVERITY.WARN,
      message: `Failed login attempt for "${identifier}"`,
      context,
      data: { identifier },
    }),

  loginSuccess: (context) =>
    trackEvent({
      type: MONITOR_EVENTS.LOGIN_SUCCESS,
      severity: SEVERITY.INFO,
      message: `Successful login: ${context.name || context.uid}`,
      context,
    }),

  permDenied: (key, context) =>
    trackEvent({
      type: MONITOR_EVENTS.PERM_DENIED,
      severity: SEVERITY.WARN,
      message: `Permission denied: "${key}" for ${context.name || context.uid} (${context.role})`,
      context,
      data: { permKey: key },
    }),

  exportBlocked: (reason, context) =>
    trackEvent({
      type: MONITOR_EVENTS.EXPORT_BLOCKED,
      severity: SEVERITY.WARN,
      message: `Export blocked: ${reason}`,
      context,
      data: { reason },
    }),

  dbError: (key, errorMessage, context) =>
    trackEvent({
      type: MONITOR_EVENTS.DB_ERROR,
      severity: SEVERITY.CRITICAL,
      message: `Firebase error on "${key}": ${errorMessage}`,
      context,
      data: { key, errorMessage },
    }),

  fnFailed: (fnName, errorMessage, context) =>
    trackEvent({
      type: MONITOR_EVENTS.FUNCTION_FAILED,
      severity: SEVERITY.CRITICAL,
      message: `Function "${fnName}" failed: ${errorMessage}`,
      context,
      data: { fnName, errorMessage },
    }),

  suspicious: (reason, context) =>
    trackEvent({
      type: MONITOR_EVENTS.SUSPICIOUS_ACTIVITY,
      severity: SEVERITY.CRITICAL,
      message: `Suspicious activity: ${reason}`,
      context,
      data: { reason },
    }),
};

// ── useMonitorLog ────────────────────────────────────────────────
// React hook — streams monitor log, computes alert summary.
import React from "react";

export function useMonitorLog(filter = {}) {
  const [events, setEvents] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const r = ref(db, "tas9_monitor_log");
    const unsub = onValue(r, snap => {
      if (!snap.exists()) { setEvents([]); setLoaded(true); return; }

      let arr = Object.entries(snap.val()).map(([k, v]) => ({ ...v, _key: k }));
      if (filter.severity)  arr = arr.filter(e => e.severity === filter.severity);
      if (filter.type)      arr = arr.filter(e => e.type === filter.type);
      if (filter.uid)       arr = arr.filter(e => e.context?.uid === filter.uid);
      if (filter.since)     arr = arr.filter(e => e.ts >= filter.since);

      arr.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      setEvents(arr);
      setLoaded(true);
    }, err => {
      console.warn("Monitor log read error:", err.message);
      setLoaded(true);
    });
    return () => unsub();
  }, [filter.severity, filter.type, filter.uid, filter.since]);

  // Computed alert summary
  const now   = Date.now();
  const h1    = now - 60 * 60 * 1000;
  const h24   = now - 24 * 60 * 60 * 1000;

  const summary = {
    criticalLast24h:  events.filter(e => e.severity === SEVERITY.CRITICAL && e.ts >= h24).length,
    failedLoginsH1:   events.filter(e => e.type === MONITOR_EVENTS.LOGIN_FAILED && e.ts >= h1).length,
    permDenialsH1:    events.filter(e => e.type === MONITOR_EVENTS.PERM_DENIED && e.ts >= h1).length,
    dbErrorsH24:      events.filter(e => e.type === MONITOR_EVENTS.DB_ERROR && e.ts >= h24).length,
    exportBlocksH24:  events.filter(e => e.type === MONITOR_EVENTS.EXPORT_BLOCKED && e.ts >= h24).length,
    suspiciousH24:    events.filter(e => e.type === MONITOR_EVENTS.SUSPICIOUS_ACTIVITY && e.ts >= h24).length,
    hasAlerts:        false,
  };
  summary.hasAlerts = summary.criticalLast24h > 0 || summary.failedLoginsH1 >= 3 || summary.suspiciousH24 > 0;

  return { events, loaded, summary };
}

// ── Failed login spike detector ──────────────────────────────────
// Call after each failed login. Auto-flags suspicious if threshold hit.
export async function checkLoginSpike(identifier, sess, settings = {}) {
  const threshold = settings?.monitoring?.failedLoginThreshold ?? 5;
  const windowMs  = 15 * 60 * 1000; // 15 minutes

  try {
    const snap = await get(ref(db, "tas9_monitor_log"));
    if (!snap.exists()) return;

    const cutoff = Date.now() - windowMs;
    const recentFails = Object.values(snap.val()).filter(e =>
      e.type === MONITOR_EVENTS.LOGIN_FAILED &&
      e.data?.identifier === identifier &&
      e.ts >= cutoff
    );

    if (recentFails.length >= threshold) {
      monitor.suspicious(
        `${recentFails.length} failed login attempts for "${identifier}" in 15 min`,
        sess || {}
      );
    }
  } catch (e) {
    // Fail silently
  }
}


// ══════════════════════════════════════════════════════════════
//  AlertsPanel — Admin UI component for Settings tab
// ══════════════════════════════════════════════════════════════

export function AlertsPanel({ dm, sess }) {
  const t = dm
    ? { card: "#16213e", border: "#334155", text: "#f1f5f9", sub: "#94a3b8", inp: "#0f3460", bg: "#0d1117" }
    : { card: "#ffffff", border: "#e2e8f0", text: "#0f172a", sub: "#64748b", inp: "#f8fafc", bg: "#f1f5f9" };

  const [activeFilter, setActiveFilter] = useState("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const { events, loaded, summary } = useMonitorLog(
    activeFilter === "all" ? {} :
    activeFilter === "critical" ? { severity: SEVERITY.CRITICAL } :
    { type: activeFilter }
  );

  const paged = events.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const FILTERS = [
    ["all",                         "🔍 All"],
    [SEVERITY.CRITICAL,             "🔴 Critical"],
    [MONITOR_EVENTS.LOGIN_FAILED,   "🔑 Failed Logins"],
    [MONITOR_EVENTS.PERM_DENIED,    "🚫 Perm Denied"],
    [MONITOR_EVENTS.DB_ERROR,       "💾 DB Errors"],
    [MONITOR_EVENTS.EXPORT_BLOCKED, "📤 Export Blocked"],
    [MONITOR_EVENTS.SUSPICIOUS_ACTIVITY, "⚠️ Suspicious"],
  ];

  const severityColor = {
    [SEVERITY.INFO]:     "#3b82f6",
    [SEVERITY.WARN]:     "#f59e0b",
    [SEVERITY.CRITICAL]: "#ef4444",
  };

  const severityBg = {
    [SEVERITY.INFO]:     "#3b82f618",
    [SEVERITY.WARN]:     "#f59e0b18",
    [SEVERITY.CRITICAL]: "#ef444418",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ── Summary cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {[
          { label: "Critical (24h)",    val: summary.criticalLast24h,  color: "#ef4444", icon: "🔴" },
          { label: "Failed Logins (1h)",val: summary.failedLoginsH1,   color: "#f59e0b", icon: "🔑" },
          { label: "Perm Denials (1h)", val: summary.permDenialsH1,    color: "#8b5cf6", icon: "🚫" },
          { label: "DB Errors (24h)",   val: summary.dbErrorsH24,      color: "#ef4444", icon: "💾" },
          { label: "Export Blocked",    val: summary.exportBlocksH24,  color: "#f97316", icon: "📤" },
          { label: "Suspicious (24h)",  val: summary.suspiciousH24,    color: "#dc2626", icon: "⚠️" },
        ].map(x => (
          <div key={x.label} style={{
            background: t.inp, border: `1px solid ${x.val > 0 ? x.color + "40" : t.border}`,
            borderRadius: 12, padding: "10px 12px",
          }}>
            <p style={{ color: t.sub, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>
              {x.icon} {x.label}
            </p>
            <p style={{ color: x.val > 0 ? x.color : t.sub, fontWeight: 900, fontSize: 20, lineHeight: 1.2, marginTop: 4 }}>
              {x.val}
            </p>
          </div>
        ))}
      </div>

      {/* ── Alert banner ── */}
      {summary.hasAlerts && (
        <div style={{
          background: "#ef444412", border: "1.5px solid #ef444440",
          borderRadius: 12, padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>🚨</span>
          <p style={{ color: "#ef4444", fontWeight: 700, fontSize: 13 }}>
            Active alerts detected in the last 24 hours. Review the log below.
          </p>
        </div>
      )}

      {/* ── Filter pills ── */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {FILTERS.map(([val, label]) => (
          <button key={val} onClick={() => { setActiveFilter(val); setPage(0); }}
            style={{
              background: activeFilter === val ? "#6366f1" : t.inp,
              color:      activeFilter === val ? "#fff"    : t.sub,
              border:     `1px solid ${activeFilter === val ? "#6366f1" : t.border}`,
              borderRadius: 20, padding: "5px 12px",
              fontSize: 11, fontWeight: 700, cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Event list ── */}
      <div style={{
        background: t.card, border: `1px solid ${t.border}`,
        borderRadius: 14, overflow: "hidden",
      }}>
        {!loaded ? (
          <p style={{ color: t.sub, textAlign: "center", padding: "24px", fontSize: 13 }}>Loading…</p>
        ) : paged.length === 0 ? (
          <p style={{ color: t.sub, textAlign: "center", padding: "24px", fontSize: 13 }}>No events found.</p>
        ) : paged.map((e, i) => (
          <div key={e._key} style={{
            padding: "10px 14px",
            borderBottom: i < paged.length - 1 ? `1px solid ${t.border}` : "none",
            display: "flex", alignItems: "flex-start", gap: 10,
          }}>
            {/* Severity dot */}
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: severityColor[e.severity] || "#94a3b8",
              marginTop: 5, flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: t.text, fontSize: 12, fontWeight: 600, marginBottom: 1 }}>
                {e.message}
              </p>
              <p style={{ color: t.sub, fontSize: 10 }}>
                {e.context?.name} ({e.context?.role}) · {new Date(e.ts).toLocaleString("en-IN")}
              </p>
            </div>
            <span style={{
              background: severityBg[e.severity],
              color: severityColor[e.severity],
              borderRadius: 20, padding: "2px 8px",
              fontSize: 9, fontWeight: 800, textTransform: "uppercase",
              flexShrink: 0,
            }}>
              {e.severity}
            </span>
          </div>
        ))}
      </div>

      {/* ── Pagination ── */}
      {events.length > PAGE_SIZE && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            style={{ padding: "6px 14px", borderRadius: 8, background: t.inp, border: `1px solid ${t.border}`, color: t.text, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
            ← Prev
          </button>
          <span style={{ color: t.sub, fontSize: 12, alignSelf: "center" }}>
            {page + 1} / {Math.ceil(events.length / PAGE_SIZE)}
          </span>
          <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= events.length}
            style={{ padding: "6px 14px", borderRadius: 8, background: t.inp, border: `1px solid ${t.border}`, color: t.text, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ── USAGE GUIDE ──────────────────────────────────────────────────
//
//  In your login function (where you check passwords):
//    import { monitor, checkLoginSpike } from "../lib/monitor";
//    if (!passwordMatch) {
//      monitor.loginFailed(username, { uid: "anon", role: "anon" });
//      checkLoginSpike(username, null, settings);
//    } else {
//      monitor.loginSuccess({ uid: user.id, name: user.name, role: user.role });
//    }
//
//  In hasPerm (roles.js) when denying:
//    monitor.permDenied(key, { uid: sess.id, name: sess.name, role: sess.role });
//
//  In store.js onValue error handler (already has console.warn):
//    monitor.dbError(key, err.message, { uid: "system" });
//
//  In Settings tab, add:
//    <AlertsPanel dm={dm} sess={sess} />
//
//  Settings config (settings.monitoring):
//    {
//      failedLoginThreshold: 5,   // spike alert after N fails in 15min
//      retainDays: 30,            // log retention (manual purge or Cloud Function)
//    }
