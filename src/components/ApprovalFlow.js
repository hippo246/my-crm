/* eslint-disable */
// ═══════════════════════════════════════════════════════════════
//  APPROVAL-FLOW.JSX — Internal Chaos Protection (Feature 14)
//  Confirmation modals, undo actions, dual-approval for dangerous ops.
//  Drop these components anywhere in CRM.js / tabs.
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import { ref, push, onValue, set as fbSet } from "firebase/database";

// ══════════════════════════════════════════════════════════════
//  1. CONFIRM MODAL  — single-user confirmation for risky actions
// ══════════════════════════════════════════════════════════════
//
//  Usage:
//    const [confirmState, setConfirmState] = useState(null);
//
//    // Trigger:
//    setConfirmState({
//      title: "Delete Invoice",
//      message: "This cannot be undone. The invoice will be voided.",
//      danger: true,
//      confirmLabel: "Yes, Delete",
//      onConfirm: () => doDelete(id),
//    });
//
//    // In JSX:
//    <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} dm={dm} />

export function ConfirmModal({ state, onClose, dm }) {
  if (!state) return null;

  const t = dm
    ? { bg: "#1a1a2e", card: "#16213e", border: "#334155", text: "#f1f5f9", sub: "#94a3b8", inp: "#0f3460" }
    : { bg: "#00000066", card: "#ffffff", border: "#e2e8f0", text: "#0f172a", sub: "#64748b", inp: "#f8fafc" };

  const dangerColor = "#ef4444";
  const safeColor   = "#6366f1";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: t.bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "0 16px",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: t.card,
          border: `1.5px solid ${state.danger ? dangerColor + "40" : t.border}`,
          borderRadius: 20,
          padding: "28px 24px",
          width: "100%",
          maxWidth: 400,
          boxShadow: state.danger
            ? `0 20px 60px ${dangerColor}20`
            : "0 20px 60px rgba(0,0,0,0.15)",
        }}
      >
        {/* Icon */}
        <div style={{
          width: 52, height: 52, borderRadius: 16,
          background: state.danger ? "#ef444418" : "#6366f118",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, marginBottom: 16,
        }}>
          {state.icon || (state.danger ? "⚠️" : "❓")}
        </div>

        <p style={{ color: t.text, fontWeight: 800, fontSize: 17, marginBottom: 8 }}>
          {state.title || "Are you sure?"}
        </p>
        <p style={{ color: t.sub, fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
          {state.message}
        </p>

        {/* Optional: type-to-confirm for extra dangerous actions */}
        {state.typeToConfirm && (
          <TypeToConfirmInput
            expected={state.typeToConfirm}
            dm={dm}
            t={t}
            onMatch={state._setTyped}
          />
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 12,
              background: t.inp, border: `1px solid ${t.border}`,
              color: t.sub, fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => { state.onConfirm?.(); onClose(); }}
            disabled={state.typeToConfirm && !state._typed}
            style={{
              flex: 1.5, padding: "12px 0", borderRadius: 12,
              background: state.danger ? dangerColor : safeColor,
              border: "none", color: "#fff",
              fontWeight: 800, fontSize: 13, cursor: "pointer",
              opacity: (state.typeToConfirm && !state._typed) ? 0.4 : 1,
              transition: "opacity 0.2s",
            }}
          >
            {state.confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TypeToConfirmInput({ expected, dm, t, onMatch }) {
  const [val, setVal] = useState("");
  const matched = val.trim().toLowerCase() === expected.toLowerCase();
  useEffect(() => { onMatch?.(matched); }, [matched]);
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ color: t.sub, fontSize: 11, marginBottom: 6 }}>
        Type <strong style={{ color: "#ef4444" }}>{expected}</strong> to confirm:
      </p>
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        placeholder={expected}
        autoFocus
        style={{
          width: "100%", padding: "10px 12px", borderRadius: 10,
          background: t.inp, border: `1.5px solid ${matched ? "#10b981" : t.border}`,
          color: t.text, fontSize: 13, outline: "none",
        }}
      />
    </div>
  );
}

// ── useConfirm hook ──────────────────────────────────────────────
// Convenience hook that manages confirm modal state for you.
//
//  const { confirmState, ask, closeConfirm } = useConfirm();
//  ask({ title: "Delete?", danger: true, onConfirm: () => del(id) });
//  <ConfirmModal state={confirmState} onClose={closeConfirm} dm={dm} />

export function useConfirm() {
  const [confirmState, setConfirmState] = useState(null);
  const [typed, setTyped] = useState(false);

  const ask = (opts) => {
    setTyped(false);
    setConfirmState({ ...opts, _typed: false, _setTyped: (v) => {
      setConfirmState(prev => prev ? { ...prev, _typed: v } : prev);
    }});
  };

  const closeConfirm = () => setConfirmState(null);

  return { confirmState, ask, closeConfirm };
}


// ══════════════════════════════════════════════════════════════
//  2. UNDO TOAST  — 5-second grace period before action fires
// ══════════════════════════════════════════════════════════════
//
//  Usage:
//    const { undoState, scheduleWithUndo, cancelUndo } = useUndoAction();
//
//    scheduleWithUndo({
//      label: "Invoice deleted",
//      onExecute: () => actuallyDelete(id),
//      delayMs: 5000,
//    });
//
//    <UndoToast state={undoState} onUndo={cancelUndo} dm={dm} />

export function UndoToast({ state, onUndo, dm }) {
  const t = dm
    ? { card: "#1e293b", text: "#f1f5f9", border: "#334155" }
    : { card: "#1e293b", text: "#f1f5f9", border: "#334155" };

  if (!state?.visible) return null;

  const elapsed  = Date.now() - state.startedAt;
  const progress = Math.max(0, 1 - elapsed / (state.delayMs || 5000));

  return (
    <div style={{
      position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
      zIndex: 9500, width: "min(360px, calc(100vw - 32px))",
    }}>
      <div style={{
        background: t.card, border: `1px solid ${t.border}`,
        borderRadius: 16, overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}>
        {/* Progress bar */}
        <div style={{ height: 3, background: "#334155" }}>
          <div style={{
            height: "100%",
            width: `${progress * 100}%`,
            background: "#f59e0b",
            transition: "width 0.1s linear",
          }} />
        </div>
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px", gap: 12,
        }}>
          <span style={{ color: t.text, fontSize: 13, fontWeight: 600 }}>
            {state.label || "Action scheduled"}
          </span>
          <button
            onClick={onUndo}
            style={{
              background: "#f59e0b", border: "none", borderRadius: 8,
              color: "#000", fontWeight: 800, fontSize: 12,
              padding: "6px 14px", cursor: "pointer", whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            ↩ Undo
          </button>
        </div>
      </div>
    </div>
  );
}

// ── useUndoAction hook ───────────────────────────────────────────
export function useUndoAction() {
  const [undoState, setUndoState] = useState(null);
  const timerRef  = useRef(null);
  const frameRef  = useRef(null);

  const cancelUndo = () => {
    clearTimeout(timerRef.current);
    cancelAnimationFrame(frameRef.current);
    setUndoState(null);
  };

  const scheduleWithUndo = ({ label, onExecute, delayMs = 5000 }) => {
    // Cancel any existing pending action
    clearTimeout(timerRef.current);
    cancelAnimationFrame(frameRef.current);

    const startedAt = Date.now();
    setUndoState({ visible: true, label, delayMs, startedAt });

    // Tick the progress bar
    const tick = () => {
      if (Date.now() - startedAt < delayMs) {
        setUndoState(s => s ? { ...s } : s);  // force re-render
        frameRef.current = requestAnimationFrame(tick);
      }
    };
    frameRef.current = requestAnimationFrame(tick);

    timerRef.current = setTimeout(() => {
      onExecute();
      setUndoState(null);
    }, delayMs);
  };

  useEffect(() => () => {
    clearTimeout(timerRef.current);
    cancelAnimationFrame(frameRef.current);
  }, []);

  return { undoState, scheduleWithUndo, cancelUndo };
}


// ══════════════════════════════════════════════════════════════
//  3. DUAL APPROVAL  — manager must separately approve dangerous ops
// ══════════════════════════════════════════════════════════════
//
//  How it works:
//  - User A requests the action → written to tas9_approvals as "pending"
//  - Manager (any admin) sees it in their ApprovalQueue panel
//  - Manager approves/rejects → onApproved callback fires
//
//  Usage:
//    await requestApproval({
//      action: "delete_invoice",
//      label:  "Delete Invoice INV-20250517-A3F2",
//      data:   { invId, customerId },
//      sess,
//    });
//
//    // In admin dashboard:
//    <ApprovalQueue dm={dm} sess={sess} onApproved={(req) => executeApproved(req)} />

export async function requestApproval({ action, label, data, sess }) {
  const entry = {
    action,
    label,
    data,
    requestedBy: { uid: sess?.id, name: sess?.name, role: sess?.role },
    status: "pending",   // "pending" | "approved" | "rejected"
    ts:     Date.now(),
    tsHuman: new Date().toISOString(),
  };
  return push(ref(db, "tas9_approvals"), entry);
}

export function ApprovalQueue({ dm, sess, onApproved, onRejected }) {
  const [queue,   setQueue]   = useState([]);
  const [loading, setLoading] = useState(true);

  const t = dm
    ? { card: "#16213e", border: "#334155", text: "#f1f5f9", sub: "#94a3b8", inp: "#0f3460" }
    : { card: "#ffffff", border: "#e2e8f0", text: "#0f172a", sub: "#64748b", inp: "#f8fafc" };

  useEffect(() => {
    const r = ref(db, "tas9_approvals");
    const unsub = onValue(r, snap => {
      if (!snap.exists()) { setQueue([]); setLoading(false); return; }
      const arr = Object.entries(snap.val())
        .map(([k, v]) => ({ ...v, _key: k }))
        .filter(e => e.status === "pending")
        .sort((a, b) => b.ts - a.ts);
      setQueue(arr);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const resolve = async (item, decision) => {
    const resolved = {
      ...item,
      status:      decision,
      resolvedBy:  { uid: sess?.id, name: sess?.name, role: sess?.role },
      resolvedAt:  Date.now(),
      resolvedHuman: new Date().toISOString(),
    };
    await fbSet(ref(db, `tas9_approvals/${item._key}`), resolved);
    if (decision === "approved") onApproved?.(resolved);
    else onRejected?.(resolved);
  };

  if (loading) return null;
  if (queue.length === 0) return null;

  return (
    <div style={{
      background: t.card, border: `1.5px solid #f59e0b40`,
      borderRadius: 16, overflow: "hidden",
      boxShadow: "0 4px 20px rgba(245,158,11,0.12)",
      marginBottom: 16,
    }}>
      <div style={{
        background: "#f59e0b18", padding: "12px 16px",
        borderBottom: `1px solid #f59e0b30`,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ fontSize: 16 }}>🔐</span>
        <p style={{ color: "#f59e0b", fontWeight: 800, fontSize: 13 }}>
          Pending Approvals ({queue.length})
        </p>
      </div>

      {queue.map(item => (
        <div
          key={item._key}
          style={{
            padding: "14px 16px",
            borderBottom: `1px solid ${t.border}`,
            display: "flex", alignItems: "flex-start",
            justifyContent: "space-between", gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: t.text, fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
              {item.label}
            </p>
            <p style={{ color: t.sub, fontSize: 11 }}>
              Requested by {item.requestedBy?.name} · {new Date(item.ts).toLocaleString("en-IN")}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => resolve(item, "rejected")}
              style={{
                background: "#ef444418", border: "1px solid #ef444440",
                color: "#ef4444", borderRadius: 8, padding: "7px 12px",
                fontSize: 11, fontWeight: 700, cursor: "pointer",
              }}
            >
              ✕ Reject
            </button>
            <button
              onClick={() => resolve(item, "approved")}
              style={{
                background: "#10b98118", border: "1px solid #10b98140",
                color: "#10b981", borderRadius: 8, padding: "7px 12px",
                fontSize: 11, fontWeight: 700, cursor: "pointer",
              }}
            >
              ✓ Approve
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── USAGE GUIDE ──────────────────────────────────────────────────
//
//  SINGLE CONFIRM (for any delete/edit):
//    const { confirmState, ask, closeConfirm } = useConfirm();
//    ask({ title:"Delete Invoice?", danger:true, message:"...", onConfirm:()=>del(id) });
//    <ConfirmModal state={confirmState} onClose={closeConfirm} dm={dm} />
//
//  UNDO (for bulk operations or soft deletes):
//    const { undoState, scheduleWithUndo, cancelUndo } = useUndoAction();
//    scheduleWithUndo({ label:"Invoice deleted", onExecute:()=>del(id) });
//    <UndoToast state={undoState} onUndo={cancelUndo} dm={dm} />
//
//  DUAL APPROVAL (manager must approve):
//    // Non-admin user requests:
//    await requestApproval({ action:"delete_invoice", label:"Delete INV-...", data:{id}, sess });
//
//    // In admin Settings/dashboard:
//    <ApprovalQueue dm={dm} sess={sess}
//      onApproved={(req) => {
//        if (req.action === "delete_invoice") actuallyDelete(req.data.id);
//      }}
//    />
//
//  Settings toggle (in settings.chaosProtection):
//    {
//      requireConfirmOnDelete:   true,
//      requireDualApprovalFor:   ["delete_invoice", "void_payment", "bulk_delete"],
//      undoWindowMs:             5000,
//      undoEnabledFor:           ["delete", "status_change"],
//    }
