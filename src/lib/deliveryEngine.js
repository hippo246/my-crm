/* eslint-disable no-unused-vars */
// ============================================================
// lib/deliveryEngine.js  — Central Delivery Engine  v1
// Shared logic for Staff, Admin, and Delivery Agents
//
// Exports:
//   dispatchDelivery(delivery, actor, setDeliv)
//   advanceDeliveryStatus(delivery, actor, setDeliv)
//   cancelDelivery(delivery, actor, setDeliv)
//   logDeliveryEvent(deliveryId, event)      — fire-and-forget
//   getDeliveryEvents(deliveryId)            — returns promise
//   useDeliveryEvents(deliveryId)            — React hook
// ============================================================

import { db } from "../firebase.js";
import {
  ref,
  push,
  set,
  get,
  onValue,
} from "firebase/database";
import { useEffect, useState } from "react";

// ─── Firebase keys ────────────────────────────────────────────
const EVENTS_KEY = "tas9_deliv_events";
const DELIV_KEY  = "tas9_deliv";

// ─── Helpers ─────────────────────────────────────────────────
function ts() { return new Date().toISOString(); }

/**
 * Safely extract audit events from a Firebase snapshot value.
 * Guards against: non-object values, arrays, null, missing timestamps.
 */
function parseEvents(snapVal) {
  if (!snapVal || typeof snapVal !== "object" || Array.isArray(snapVal)) return [];
  return Object.values(snapVal)
    .filter(ev => ev && typeof ev === "object" && ev.timestamp)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

/** Write one audit event for a delivery (fire-and-forget, never throws) */
export async function logDeliveryEvent(deliveryId, event) {
  if (!deliveryId) return;
  try {
    const eventsRef = ref(db, `${EVENTS_KEY}/${deliveryId}`);
    await push(eventsRef, {
      ...event,
      deliveryId,
      timestamp: ts(),
    });
  } catch (err) {
    console.warn("[deliveryEngine] logDeliveryEvent failed:", err);
  }
}

/** Fetch all audit events for a delivery (one-time read) */
export async function getDeliveryEvents(deliveryId) {
  if (!deliveryId) return [];
  try {
    const snap = await get(ref(db, `${EVENTS_KEY}/${deliveryId}`));
    if (!snap.exists()) return [];
    return parseEvents(snap.val());
  } catch (err) {
    console.warn("[deliveryEngine] getDeliveryEvents failed:", err);
    return [];
  }
}

/** React hook — real-time audit events for a delivery */
export function useDeliveryEvents(deliveryId) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deliveryId) { setEvents([]); setLoading(false); return; }
    const evRef = ref(db, `${EVENTS_KEY}/${deliveryId}`);
    const unsubscribe = onValue(evRef, snap => {
      if (!snap.exists()) { setEvents([]); setLoading(false); return; }
      // parseEvents handles corrupted/unexpected snap values without throwing
      setEvents(parseEvents(snap.val()));
      setLoading(false);
    }, err => {
      console.warn("[deliveryEngine] useDeliveryEvents error:", err);
      setEvents([]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [deliveryId]);

  return { events, loading };
}

// ─── Status machine ───────────────────────────────────────────
const STATUS_FLOW = ["Pending", "In Transit", "Delivered"];

function nextStatus(current) {
  const idx = STATUS_FLOW.indexOf(current);
  if (idx < 0 || idx >= STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[idx + 1];
}

// ─── Core actions ─────────────────────────────────────────────

/**
 * Dispatch a delivery that is currently Pending → In Transit.
 *
 * @param {object}   delivery    Full delivery object
 * @param {object}   actor       { name, role, uid? }
 * @param {function} setDeliv    React state setter from useStore("tas9_deliv")
 * @param {function} [notify]    Optional toast: notify(msg, type)
 */
export async function dispatchDelivery(delivery, actor, setDeliv, notify) {
  if (!delivery?.id) return;
  if (delivery.status !== "Pending") {
    notify?.(`Cannot dispatch — status is ${delivery.status}`, "warning");
    return;
  }

  const updatedAt = ts();
  const update = {
    status:           "In Transit",
    dispatchedAt:     updatedAt,
    dispatchedBy:     actor?.name || "Unknown",
    dispatchedByRole: actor?.role || "staff",
    updatedAt,
  };

  // Optimistic UI update — setDeliv writes the full array back to Firebase
  setDeliv(prev =>
    (Array.isArray(prev) ? prev : []).map(d =>
      d.id === delivery.id ? { ...d, ...update } : d
    )
  );

  notify?.(`🚚 ${delivery.customer} dispatched`, "success");

  await logDeliveryEvent(delivery.id, {
    action:     "dispatched",
    fromStatus: "Pending",
    toStatus:   "In Transit",
    actorName:  actor?.name || "Unknown",
    actorRole:  actor?.role || "staff",
    actorUid:   actor?.uid  || null,
    note:       `Dispatched by ${actor?.name || "Unknown"}`,
  });
}

/**
 * Advance a delivery to its next status (Pending→InTransit or InTransit→Delivered).
 * Prefer dispatchDelivery() for the first transition; this is for generic use.
 */
export async function advanceDeliveryStatus(delivery, actor, setDeliv, notify) {
  if (!delivery?.id) return;
  const next = nextStatus(delivery.status);
  if (!next) {
    notify?.("Delivery already at final status", "info");
    return;
  }

  const updatedAt = ts();
  const update = {
    status:    next,
    updatedAt,
    ...(next === "In Transit" && {
      dispatchedAt:     updatedAt,
      dispatchedBy:     actor?.name || "Unknown",
      dispatchedByRole: actor?.role || "staff",
    }),
    ...(next === "Delivered" && {
      deliveredAt:     updatedAt,
      deliveredBy:     actor?.name || "Unknown",
      deliveredByRole: actor?.role || "staff",
    }),
  };

  setDeliv(prev =>
    (Array.isArray(prev) ? prev : []).map(d =>
      d.id === delivery.id ? { ...d, ...update } : d
    )
  );

  notify?.(`${delivery.customer} → ${next}`, "info");

  await logDeliveryEvent(delivery.id, {
    action:     next === "In Transit" ? "dispatched" : "delivered",
    fromStatus: delivery.status,
    toStatus:   next,
    actorName:  actor?.name || "Unknown",
    actorRole:  actor?.role || "staff",
    actorUid:   actor?.uid  || null,
    note:       `Status advanced to ${next} by ${actor?.name || "Unknown"}`,
  });
}

/**
 * Cancel a delivery.
 */
export async function cancelDelivery(delivery, actor, setDeliv, notify, reason = "") {
  if (!delivery?.id) return;
  if (delivery.status === "Delivered" || delivery.status === "Cancelled") {
    notify?.("Cannot cancel a completed or already-cancelled delivery", "warning");
    return;
  }

  const updatedAt = ts();
  const update = {
    status:          "Cancelled",
    cancelledAt:     updatedAt,
    cancelledBy:     actor?.name || "Unknown",
    cancelledByRole: actor?.role || "staff",
    cancelReason:    reason || "",
    updatedAt,
  };

  setDeliv(prev =>
    (Array.isArray(prev) ? prev : []).map(d =>
      d.id === delivery.id ? { ...d, ...update } : d
    )
  );

  notify?.(`${delivery.customer} cancelled`, "error");

  await logDeliveryEvent(delivery.id, {
    action:     "cancelled",
    fromStatus: delivery.status,
    toStatus:   "Cancelled",
    actorName:  actor?.name || "Unknown",
    actorRole:  actor?.role || "staff",
    actorUid:   actor?.uid  || null,
    note:       reason ? `Cancelled: ${reason}` : `Cancelled by ${actor?.name || "Unknown"}`,
  });
}

/**
 * Log a note/comment on a delivery (without changing status).
 */
export async function addDeliveryNote(deliveryId, actor, note) {
  await logDeliveryEvent(deliveryId, {
    action:    "note",
    actorName: actor?.name || "Unknown",
    actorRole: actor?.role || "staff",
    actorUid:  actor?.uid  || null,
    note,
  });
}
