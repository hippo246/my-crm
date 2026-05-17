// ============================================================
// src/lib/softDelete.js — Soft Delete Helpers
//
// No Firebase imports needed — all persistence goes through
// your existing useStore setters in CRM.js.
// ============================================================

// ── Array helpers — use these everywhere ─────────────────────
export const withoutDeleted = (arr = []) => arr.filter(r => !r.deleted);
export const onlyDeleted    = (arr = []) => arr.filter(r =>  r.deleted);
