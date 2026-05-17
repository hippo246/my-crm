// ============================================================
// src/lib/auditLog.js — Universal Audit Logger
//
// Writes audit entries into the existing tas9_act activity log
// via the setAct setter passed in — no direct Firebase needed.
//
// USAGE in CRM.js (add near addLog definition):
//   import { makeAuditLogger } from "./lib/auditLog";
//   const logAudit = makeAuditLogger(setAct, sess, displayName, uid, ts);
//
//   logAudit({ action: "soft_delete", entity: "supplies", entityLabel: s.item, oldVal: s });
// ============================================================

export function getDeviceInfo() {
  const ua = navigator.userAgent;
  const isMobile = /Mobi|Android/i.test(ua);
  const isTablet = /iPad|Tablet/i.test(ua);
  const platform = isMobile ? "mobile" : isTablet ? "tablet" : "desktop";
  let browser = "unknown";
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua))  browser = "Chrome";
  else if (/Firefox\//.test(ua))                  browser = "Firefox";
  else if (/Safari\//.test(ua))                   browser = "Safari";
  else if (/Edg\//.test(ua))                      browser = "Edge";
  return { platform, browser };
}

export function diffObjects(oldVal, newVal) {
  if (!oldVal || !newVal) return { oldVal, newVal };
  const changedKeys = Object.keys({ ...oldVal, ...newVal }).filter(
    k => JSON.stringify(oldVal[k]) !== JSON.stringify(newVal[k])
  );
  if (changedKeys.length === 0) return null;
  return {
    changedFields: changedKeys,
    oldVal: Object.fromEntries(changedKeys.map(k => [k, oldVal[k] ?? null])),
    newVal: Object.fromEntries(changedKeys.map(k => [k, newVal[k] ?? null])),
  };
}

export function makeAuditLogger(setAct, sess, displayName, uidFn, tsFn) {
  return function logAudit({ action, entity, entityId, entityLabel, oldVal, newVal, note, skipDiff = false }) {
    try {
      const device = getDeviceInfo();
      let payload = { oldVal: oldVal ?? null, newVal: newVal ?? null, changedFields: null };
      if (action === "update" && !skipDiff) {
        const diff = diffObjects(oldVal, newVal);
        if (!diff) return;
        payload = diff;
      }
      const entry = {
        id:               uidFn(),
        user:             displayName || sess?.name || "Unknown",
        role:             sess?.role  || "staff",
        action:           `[${action.toUpperCase()}] ${entity}${entityLabel ? ": " + entityLabel : ""}`,
        detail:           note || entityLabel || entityId || "",
        ts:               tsFn(),
        _audit:           true,
        auditAction:      action,
        auditEntity:      entity,
        auditEntityId:    entityId    || null,
        auditEntityLabel: entityLabel || null,
        ...payload,
        device,
        actor: { uid: sess?.id || "unknown", name: displayName || sess?.name || "Unknown", role: sess?.role || "staff" },
      };
      setAct(p => [entry, ...(Array.isArray(p) ? p : []).slice(0, 999)]);
    } catch (err) {
      console.warn("[auditLog] Failed to write audit entry:", err);
    }
  };
}
