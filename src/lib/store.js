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

// ─────────────────────────────────────────────────────────────────────────────

// _writing[key] tracks how many writes are in-flight for a given key.
// We use a simple integer counter instead of token Sets + timeouts.
// The counter is incremented before each write and decremented when the
// Firebase promise resolves OR rejects — no timeout needed, so there is
// zero risk of the counter clearing early and letting a stale echo through.
let _writing = {};          // { [key]: number }  (in-flight write count)
let _lastSyncTs = null;
const _syncListeners = new Set();
function _notifySync() { _lastSyncTs = new Date(); _syncListeners.forEach(fn => fn(_lastSyncTs)); }

function useStore(key, def) {
  const defRef = useRef(def);
  const [val, setRaw] = useState(null);
  const [fbLoaded, setFbLoaded] = useState(false);

  useEffect(() => {
    const r = ref(db, key);
    const unsub = onValue(r, (snap) => {
      // If there are any in-flight writes for this key, the incoming snapshot
      // is either our own echo or an outdated server state — skip it.
      // The counter is only cleared after the write promise settles, so it
      // cannot clear prematurely the way a fixed timeout can.
      if ((_writing[key] ?? 0) > 0) { setFbLoaded(true); return; }

      if (snap.exists()) {
        const raw = snap.val();
        let incoming = (raw && raw.v !== undefined) ? raw.v : raw;
        // Firebase turns arrays with deleted elements into objects {0:x,2:z}.
        // If the default value is an array, coerce back to array.
        if (
          Array.isArray(defRef.current) &&
          incoming &&
          typeof incoming === "object" &&
          !Array.isArray(incoming)
        ) {
          incoming = Object.values(incoming);
        }
        setRaw(incoming);
      } else {
        // Key doesn't exist yet — seed Firebase with the default value.
        const d = defRef.current;
        _writing[key] = (_writing[key] ?? 0) + 1;
        fbWrite(key, d)
          .catch(e => console.warn("seed error:", e.message))
          .finally(() => { _writing[key] = Math.max(0, (_writing[key] ?? 1) - 1); });
        setRaw(d);
      }

      setFbLoaded(true);
      _notifySync();
    }, (err) => {
      console.warn("Firebase error for", key, err.message);
      setFbLoaded(true);
      if (typeof window !== "undefined") window.__fbOffline = true;
    });
    return () => unsub();
  }, [key]);

  const set = useCallback((next) => {
    setRaw(prev => {
      const n = typeof next === "function" ? next(prev ?? defRef.current) : next;

      // Increment before the write, decrement when the promise settles.
      // Using .finally() guarantees the counter always comes down — even on
      // network errors — with no fixed timeout that could expire too early.
      _writing[key] = (_writing[key] ?? 0) + 1;
      fbWrite(key, n)
        .catch(e => console.warn("Firebase write error:", e.message))
        .finally(() => { _writing[key] = Math.max(0, (_writing[key] ?? 1) - 1); });

      return n;
    });
  }, [key]);

  return [fbLoaded ? (val ?? defRef.current) : defRef.current, set, fbLoaded];
}


export { fbWrite, atomicInvoiceSeq, useStore, _syncListeners, _lastSyncTs };
