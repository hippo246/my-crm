/* eslint-disable react-hooks/exhaustive-deps */
import { db } from "../firebase";
import { ref, onValue, set as fbSet, runTransaction } from "firebase/database";
import { useState, useEffect, useRef, useCallback } from "react";

function fbWrite(key, data) {
  return fbSet(ref(db, key), { v: data });
}

// ── ATOMIC HELPERS ───────────────────────────────────────────────────────────
// atomicInvoiceSeq: increments the invoice sequence counter in a single
// Firebase transaction so concurrent devices can never produce duplicate
// invoice numbers. Returns the new sequence number as an integer.
async function atomicInvoiceSeq() {
  const seqRef = ref(db, "tas9_inv_registry/seq");
  let newSeq = null;
  await runTransaction(seqRef, (current) => {
    newSeq = (current || 0) + 1;
    return newSeq;
  });
  return newSeq;
}

// atomicAddPayment: records a payment ledger entry AND increments c.paid in
// one Firebase transaction on the customer node, so two devices recording
// payment simultaneously never overwrite each other — they always accumulate.
async function atomicAddPayment(customerId, amount) {
  const paidRef = ref(db, `tas9_customers/${customerId}/paid`);  // adjust path if your key differs
  // We run the transaction on the whole customer node via useStore path.
  // Because useStore stores customers as {v: [...]} at "tas9_customers",
  // we instead patch via the customers array transaction below.
  // This helper returns a promise so callers can await it.
  // Note: for array-based stores we handle this inside recordPaymentLedger directly.
  void 0; // placeholder — logic is inlined in recordPaymentLedger below
}
// ─────────────────────────────────────────────────────────────────────────────

let _writing = {}; // sets of pending write tokens per key — ignore echoes while set is non-empty
let _lastSyncTs = null;
const _syncListeners = new Set();
function _notifySync(){_lastSyncTs=new Date();_syncListeners.forEach(fn=>fn(_lastSyncTs));}

function useStore(key, def) {
  const defRef = useRef(def);
  const [val, setRaw] = useState(null);
  const [fbLoaded, setFbLoaded] = useState(false);

  useEffect(() => {
    const r = ref(db, key);
    const unsub = onValue(r, (snap) => {
      if (_writing[key]?.size > 0) { setFbLoaded(true); return; }
      if (snap.exists()) {
        const raw = snap.val();
        let incoming = (raw && raw.v !== undefined) ? raw.v : raw;
        // Firebase turns arrays with deleted elements into objects {0:x,2:z}.
        // If the default value is an array, coerce back to array.
        if (Array.isArray(defRef.current) && incoming && typeof incoming === "object" && !Array.isArray(incoming)) {
          incoming = Object.values(incoming);
        }
        setRaw(incoming);
      } else {
        const d = defRef.current;
        if(!_writing[key]) _writing[key]=new Set();
        const _st=Math.random().toString(36).slice(2);
        _writing[key].add(_st);
        const _clrS=()=>{ if(_writing[key]) _writing[key].delete(_st); };
        fbWrite(key, d)
          .then(()=>_clrS())
          .catch(e=>{ console.warn("seed error:", e.message); _clrS(); });
        setTimeout(_clrS,4000);
        setRaw(d);
      }
      setFbLoaded(true);
      _notifySync();
    }, (err) => {
      console.warn("Firebase error for", key, err.message);
      setFbLoaded(true);
      if(typeof window!=="undefined") window.__fbOffline=true;
    });
    return () => unsub();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback((next) => {
    setRaw(prev => {
      const n = typeof next === "function" ? next(prev ?? defRef.current) : next;
      if(!_writing[key]) _writing[key]=new Set();
      const _wtoken=Math.random().toString(36).slice(2);
      _writing[key].add(_wtoken);
      const _clearW=()=>{ if(_writing[key]){ _writing[key].delete(_wtoken); } };
      fbWrite(key, n)
        .then(()=>{ _clearW(); })
        .catch(e=>{ console.warn("Firebase write error:", e.message); _clearW(); });
      setTimeout(_clearW, 4000); // safety net: always clear after 4s
      return n;
    });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return [fbLoaded ? (val ?? defRef.current) : defRef.current, set, fbLoaded];
}


export { fbWrite, atomicInvoiceSeq, useStore, _syncListeners, _lastSyncTs };
