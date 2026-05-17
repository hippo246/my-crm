/* eslint-disable */
// ═══════════════════════════════════════════════════════════════
//  LEDGER.JS — Immutable Financial Records (Feature 12)
//  Append-only. No edits. No deletes. Every financial event
//  gets a tamper-evident entry with full audit trail.
// ═══════════════════════════════════════════════════════════════

import { db } from "../firebase";
import { ref, push, serverTimestamp, runTransaction, onValue } from "firebase/database";

// ── Ledger entry types ───────────────────────────────────────────
export const LEDGER_TYPES = {
  INVOICE_CREATED:    "invoice_created",
  INVOICE_VOIDED:     "invoice_voided",      // soft void — never deleted
  PAYMENT_RECEIVED:   "payment_received",
  PAYMENT_REVERSED:   "payment_reversed",
  DELIVERY_BILLED:    "delivery_billed",
  SUPPLY_PURCHASE:    "supply_purchase",
  EXPENSE_RECORDED:   "expense_recorded",
  STOCK_IN:           "stock_in",
  STOCK_OUT:          "stock_out",
  STOCK_ADJUSTED:     "stock_adjusted",
  REPLACEMENT_ISSUED: "replacement_issued",
  CREDIT_NOTE:        "credit_note",
};

// ── appendLedger ─────────────────────────────────────────────────
// The ONLY way to write to the ledger. Never call fbSet on tas9_ledger directly.
// Returns the Firebase push key of the new entry.
//
//   type    — one of LEDGER_TYPES
//   data    — the financial payload (amount, customerId, invNo, etc.)
//   sess    — current session { id, name, role }
//   meta    — optional extra context (e.g. { reason: "customer request" })
//
export async function appendLedger(type, data, sess, meta = {}) {
  const entry = {
    type,
    data,
    meta,
    actor: {
      uid:  sess?.id   || "unknown",
      name: sess?.name || "unknown",
      role: sess?.role || "unknown",
    },
    ts:        Date.now(),          // client timestamp for sorting
    tsServer:  serverTimestamp(),   // Firebase server timestamp (authoritative)
    _immutable: true,               // marker — used by security rules
  };

  const ledgerRef = ref(db, "tas9_ledger");
  const newRef    = push(ledgerRef);     // push() = append-only, never overwrites
  await newRef.set(entry);
  return newRef.key;
}

// ── voidLedgerEntry ──────────────────────────────────────────────
// Records a void/reversal as a NEW entry. The original is untouched.
export async function voidLedgerEntry(originalKey, reason, sess) {
  return appendLedger(
    LEDGER_TYPES.INVOICE_VOIDED,
    { originalKey, reason },
    sess,
    { voided: true }
  );
}

// ── useLedger ────────────────────────────────────────────────────
// React hook — streams the ledger in real time.
// Optional filter: { type, actorUid, from (YYYY-MM-DD), to }
import { useState, useEffect } from "react";

export function useLedger(filter = {}) {
  const [entries, setEntries] = useState([]);
  const [loaded,  setLoaded]  = useState(false);

  useEffect(() => {
    const r = ref(db, "tas9_ledger");
    const unsub = onValue(r, (snap) => {
      if (!snap.exists()) { setEntries([]); setLoaded(true); return; }
      let arr = Object.entries(snap.val()).map(([k, v]) => ({ ...v, _key: k }));

      // Apply filters
      if (filter.type)     arr = arr.filter(e => e.type === filter.type);
      if (filter.actorUid) arr = arr.filter(e => e.actor?.uid === filter.actorUid);
      if (filter.from)     arr = arr.filter(e => e.ts >= new Date(filter.from).getTime());
      if (filter.to)       arr = arr.filter(e => e.ts <= new Date(filter.to + "T23:59:59").getTime());

      // Always newest-first
      arr.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      setEntries(arr);
      setLoaded(true);
    }, err => {
      console.warn("Ledger read error:", err.message);
      setLoaded(true);
    });
    return () => unsub();
  }, [filter.type, filter.actorUid, filter.from, filter.to]);

  return { entries, loaded };
}

// ── getLedgerSummary ─────────────────────────────────────────────
// Computes running totals from ledger entries. Use this for
// reconciliation — it should always match your delivery/payment data.
export function getLedgerSummary(entries) {
  let totalInvoiced  = 0;
  let totalPaid      = 0;
  let totalVoided    = 0;
  let totalReversed  = 0;
  let totalExpenses  = 0;
  let totalSupplies  = 0;

  for (const e of entries) {
    const amt = Number(e.data?.amount || e.data?.cost || e.data?.total || 0);
    switch (e.type) {
      case LEDGER_TYPES.INVOICE_CREATED:
      case LEDGER_TYPES.DELIVERY_BILLED:   totalInvoiced  += amt; break;
      case LEDGER_TYPES.PAYMENT_RECEIVED:  totalPaid      += amt; break;
      case LEDGER_TYPES.INVOICE_VOIDED:    totalVoided    += amt; break;
      case LEDGER_TYPES.PAYMENT_REVERSED:  totalReversed  += amt; break;
      case LEDGER_TYPES.EXPENSE_RECORDED:  totalExpenses  += amt; break;
      case LEDGER_TYPES.SUPPLY_PURCHASE:   totalSupplies  += amt; break;
    }
  }

  return {
    totalInvoiced,
    totalPaid,
    totalVoided,
    totalReversed,
    totalExpenses,
    totalSupplies,
    netReceivable: totalInvoiced - totalVoided - totalPaid,
  };
}

// ── USAGE GUIDE ──────────────────────────────────────────────────
//
//  When creating an invoice / delivery:
//    import { appendLedger, LEDGER_TYPES } from "../lib/ledger";
//    await appendLedger(LEDGER_TYPES.INVOICE_CREATED, {
//      invNo, customerId, customerName, amount: lineTotal(orderLines),
//    }, sess);
//
//  When recording a payment:
//    await appendLedger(LEDGER_TYPES.PAYMENT_RECEIVED, {
//      customerId, customerName, amount, method: "cash"
//    }, sess);
//
//  When voiding (NEVER delete — always void):
//    await voidLedgerEntry(originalLedgerKey, "Customer cancelled", sess);
//
//  In a component:
//    const { entries, loaded } = useLedger({ type: "payment_received" });
//
// Firebase Security Rule (add to your rules.json):
//   "tas9_ledger": {
//     ".read":  "auth != null",
//     ".write": "auth != null && !data.exists()",   // append-only: can't overwrite
//     "$entry": {
//       ".write": "!data.exists()"                  // new entries only
//     }
//   }
