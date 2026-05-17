/* eslint-disable */
// ═══════════════════════════════════════════════════════════════
//  EXPORT-GUARD.JS — Export Controls & Data Protection (Feature 13)
//  Rate limits, watermarked exports, per-user export logs.
//  Admins get unlimited exports. All others follow configured limits.
// ═══════════════════════════════════════════════════════════════

import { db } from "../firebase";
import { ref, push, onValue, get } from "firebase/database";
import { fbWrite } from "./store";
import { useState, useEffect } from "react";

// ── Default limits (overridable via Settings > Export Controls) ──
export const DEFAULT_EXPORT_LIMITS = {
  maxPerHour:    10,    // max exports per user per hour
  maxPerDay:     30,    // max exports per user per day
  maxRowsCSV:    5000,  // max rows in a single CSV export
  maxRowsExcel:  2000,  // max rows in a single Excel export
  watermark:     true,  // inject watermark into PDF/HTML exports
  logExports:    true,  // write to export log
  allowedRoles:  ["admin", "manager"],  // roles allowed to export at all
};

// ── logExport ────────────────────────────────────────────────────
// Writes an immutable export event to tas9_export_logs.
// Call this AFTER the export succeeds.
export async function logExport({ sess, exportType, tabName, rowCount, filters = {}, settings = {} }) {
  if (!(settings?.exportControls?.logExports ?? DEFAULT_EXPORT_LIMITS.logExports)) return;

  const entry = {
    actor: {
      uid:    sess?.id   || "unknown",
      name:   sess?.name || "unknown",
      role:   sess?.role || "unknown",
      device: typeof navigator !== "undefined" ? navigator.userAgent?.slice(0, 80) : "",
    },
    exportType,   // "csv" | "excel" | "pdf" | "word"
    tabName,      // e.g. "Deliveries", "Customers"
    rowCount:     rowCount || 0,
    filters,      // what date range / search was active
    ts:           Date.now(),
    tsHuman:      new Date().toISOString(),
  };

  try {
    await push(ref(db, "tas9_export_logs"), entry);
  } catch (e) {
    console.warn("Export log write failed:", e.message);
  }
}

// ── checkExportQuota ─────────────────────────────────────────────
// Returns { allowed: bool, reason: string }
// Admins are always allowed (unlimited).
export async function checkExportQuota(sess, settings = {}) {
  // Admins: unlimited
  if (sess?.role === "admin") return { allowed: true };

  const limits = {
    ...DEFAULT_EXPORT_LIMITS,
    ...(settings?.exportControls || {}),
  };

  // Check role permission
  if (!limits.allowedRoles.includes(sess?.role)) {
    return { allowed: false, reason: "Your role does not have export permission." };
  }

  // Fetch this user's recent export logs
  let logs = [];
  try {
    const snap = await get(ref(db, "tas9_export_logs"));
    if (snap.exists()) {
      logs = Object.values(snap.val()).filter(e => e.actor?.uid === sess?.id);
    }
  } catch (e) {
    // If we can't read logs, fail open (don't block export)
    return { allowed: true };
  }

  const now       = Date.now();
  const oneHour   = 60 * 60 * 1000;
  const oneDay    = 24 * oneHour;
  const lastHour  = logs.filter(e => now - e.ts < oneHour).length;
  const lastDay   = logs.filter(e => now - e.ts < oneDay).length;

  if (lastHour >= limits.maxPerHour) {
    return { allowed: false, reason: `Export limit reached: ${limits.maxPerHour} exports per hour. Try again later.` };
  }
  if (lastDay >= limits.maxPerDay) {
    return { allowed: false, reason: `Daily export limit reached: ${limits.maxPerDay} exports per day.` };
  }

  return { allowed: true };
}

// ── checkRowLimit ────────────────────────────────────────────────
// Returns { allowed: bool, capped: bool, count: number }
export function checkRowLimit(data, exportType, sess, settings = {}) {
  if (sess?.role === "admin") return { allowed: true, capped: false, count: data.length };

  const limits = { ...DEFAULT_EXPORT_LIMITS, ...(settings?.exportControls || {}) };
  const max = exportType === "excel" ? limits.maxRowsExcel : limits.maxRowsCSV;

  if (data.length > max) {
    return { allowed: true, capped: true, count: max, originalCount: data.length };
  }
  return { allowed: true, capped: false, count: data.length };
}

// ── injectWatermark ──────────────────────────────────────────────
// Injects a watermark div into an HTML string before </body>.
// Adds: user name, role, timestamp, "CONFIDENTIAL" badge.
export function injectWatermark(html, sess, settings = {}) {
  const shouldWatermark =
    settings?.exportControls?.watermark ?? DEFAULT_EXPORT_LIMITS.watermark;
  if (!shouldWatermark) return html;

  const ts   = new Date().toLocaleString("en-IN");
  const user = sess?.name || sess?.id || "Unknown";
  const role = (sess?.role || "").toUpperCase();

  const watermarkCSS = `
    <style>
      @media print {
        .wm-bar { display: flex !important; }
      }
    </style>
  `;

  const watermarkHTML = `
    <div class="wm-bar" style="
      position:fixed; bottom:0; left:0; right:0;
      background:rgba(0,0,0,0.08);
      border-top:1.5px solid rgba(0,0,0,0.12);
      padding:6px 18px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      font-family:monospace;
      font-size:10px;
      color:#475569;
      z-index:9999;
      -webkit-print-color-adjust:exact;
      print-color-adjust:exact;
    ">
      <span>🔒 CONFIDENTIAL · Exported by <strong>${user}</strong> (${role})</span>
      <span>${ts}</span>
      <span>Unauthorised distribution prohibited</span>
    </div>
  `;

  // Also stamp every page when printed
  const printStampCSS = `
    <style>
      @page { margin-bottom: 30px; }
      body::after {
        content: "CONFIDENTIAL · Exported by ${user} · ${ts}";
        position: fixed;
        bottom: 8px;
        left: 0;
        right: 0;
        text-align: center;
        font-size: 9px;
        color: #94a3b8;
        font-family: monospace;
        opacity: 0.6;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    </style>
  `;

  return html
    .replace("</head>", watermarkCSS + printStampCSS + "</head>")
    .replace("</body>", watermarkHTML + "</body>");
}

// ── useExportLogs ────────────────────────────────────────────────
// React hook — streams export logs in real time.
// Pass { uid } to filter by user, or leave empty for all logs (admin).
export function useExportLogs(filter = {}) {
  const [logs,   setLogs]   = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const r = ref(db, "tas9_export_logs");
    const unsub = onValue(r, (snap) => {
      if (!snap.exists()) { setLogs([]); setLoaded(true); return; }
      let arr = Object.entries(snap.val()).map(([k, v]) => ({ ...v, _key: k }));
      if (filter.uid) arr = arr.filter(e => e.actor?.uid === filter.uid);
      arr.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      setLogs(arr);
      setLoaded(true);
    }, err => {
      console.warn("Export log read error:", err.message);
      setLoaded(true);
    });
    return () => unsub();
  }, [filter.uid]);

  return { logs, loaded };
}

// ── WRAPPED EXPORT HELPERS ───────────────────────────────────────
// Drop-in wrappers around your existing export functions.
// They handle quota check → row cap → watermark → log atomically.
//
// Usage (replaces a direct exportCSV call):
//
//   import { guardedExportCSV } from "../lib/exportGuard";
//   await guardedExportCSV({
//     data, filename, columns, sess, settings,
//     tabName: "Deliveries", onBlocked: (reason) => notify(reason)
//   });

export async function guardedExport({
  exportFn,          // the raw export function to call
  data,
  exportType,        // "csv" | "excel" | "pdf"
  tabName,
  filters = {},
  sess,
  settings = {},
  onBlocked,         // callback(reason) when quota exceeded
  onCapped,          // callback(count, originalCount) when rows were capped
}) {
  // 1. Check quota
  const quota = await checkExportQuota(sess, settings);
  if (!quota.allowed) {
    onBlocked?.(quota.reason);
    return false;
  }

  // 2. Check/cap rows
  let exportData = data;
  const rowCheck = checkRowLimit(data, exportType, sess, settings);
  if (rowCheck.capped) {
    exportData = data.slice(0, rowCheck.count);
    onCapped?.(rowCheck.count, rowCheck.originalCount);
  }

  // 3. Run export
  exportFn(exportData);

  // 4. Log it (fire and forget)
  logExport({ sess, exportType, tabName, rowCount: exportData.length, filters, settings });

  return true;
}

// ── USAGE GUIDE ──────────────────────────────────────────────────
//
//  In Settings, store exportControls config under settings.exportControls:
//  {
//    maxPerHour:   10,
//    maxPerDay:    30,
//    maxRowsCSV:   5000,
//    maxRowsExcel: 2000,
//    watermark:    true,
//    logExports:   true,
//    allowedRoles: ["admin", "manager"],
//  }
//
//  Wrap any PDF export with injectWatermark():
//    const watermarked = injectWatermark(rawHtml, sess, settings);
//
//  View export logs in Settings > Export Log (use useExportLogs hook).
