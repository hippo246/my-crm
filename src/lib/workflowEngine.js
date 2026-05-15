// ============================================================
// lib/workflowEngine.js  — Workflow Engine  v2
//
// Central brain that enforces batch status flow and cross-tab
// state mutations. All tabs call into here instead of mutating
// state directly.
//
// Status pipeline:
//   production → awaiting_qc → ready_to_pack → packed → dispatched → delivered
//   (rejected at any QC stage)
//
// Exports:
//   onProductionStarted({ newBatch, sess, setBatches, setProdTargets, setInventory, setActivityLog, settings, notify })
//   onProductionProgress({ batchId, weight, setBatches, setActivityLog, sess, notify })
//   onQCResult({ batch, finalGrade, failCount, notes, checkResults, sess, setBatches, setQcLogs, setActivityLog, notify })
//   onPackingEntry({ batch, qty, damage, sess, setBatches, setActivityLog, notify })
//   onPackingComplete({ batch, sess, setBatches, setActivityLog, notify })
//   onBatchHold({ batch, holdNote, sess, setBatches, setActivityLog, notify })
//   onInventoryUsage({ item, qty, reason, sess, setInventory, setActivityLog, notify }) → boolean
//   onInventoryReceive({ item, qty, source, sess, setInventory, setActivityLog, notify }) → boolean
//   canBatchBePacked(batch) → boolean
//   BATCH_STATUS_LABELS — display map for workflowStatus values
// ============================================================

// ─── Helpers ─────────────────────────────────────────────────
function ts() { return new Date().toISOString(); }

function logEntry({ setActivityLog, icon, title, detail, color, sess }) {
  if (!setActivityLog) return;
  setActivityLog(prev => [
    {
      id:        `act_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      icon,
      title,
      detail,
      color:     color || "#6366f1",
      user:      sess?.name || "Staff",
      role:      sess?.role || "staff",
      timestamp: ts(),
    },
    ...(Array.isArray(prev) ? prev : []),
  ].slice(0, 200)); // keep last 200 entries
}

// ─── Status label map ─────────────────────────────────────────
export const BATCH_STATUS_LABELS = {
  production:   "In Production",
  awaiting_qc:  "Awaiting QC",
  qc_rejected:  "QC Rejected",
  ready_to_pack:"Ready to Pack",
  packed:       "Packed",
  dispatched:   "Dispatched",
  delivered:    "Delivered",
  on_hold:      "On Hold",
};

// ─── Guard: can this batch be packed? ─────────────────────────
export function canBatchBePacked(batch) {
  if (!batch) return false;
  if (batch.workflowStatus === "qc_rejected") return false;
  if (batch.workflowStatus === "awaiting_qc") return false;
  return true;
}

// ─── Workflow 1: Production Started ──────────────────────────
/**
 * Call when a new batch is created in ProductionStart.
 * - Adds the batch to setBatches with workflowStatus = "production"
 * - Pushes a prod target entry
 * - Logs to activity
 */
export function onProductionStarted({
  newBatch,
  sess,
  setBatches,
  setProdTargets,
  setInventory,
  setActivityLog,
  settings,
  notify,
}) {
  if (!newBatch?.id) {
    console.warn("[workflowEngine] onProductionStarted: no batch id");
    return;
  }

  const enriched = {
    ...newBatch,
    workflowStatus: "production",
  };

  setBatches(prev => [enriched, ...(Array.isArray(prev) ? prev : [])]);

  // Push a prod target entry so admin dashboard targets stay in sync
  if (setProdTargets) {
    setProdTargets(prev => [
      {
        id:        `pt_${Date.now().toString(36)}`,
        batchId:   newBatch.id,
        batchLabel:newBatch.batchLabel,
        product:   newBatch.product,
        productId: newBatch.productId,
        target:    newBatch.target,
        date:      newBatch.date,
        shift:     newBatch.shift,
        createdAt: ts(),
        createdBy: sess?.name || "Staff",
      },
      ...(Array.isArray(prev) ? prev : []),
    ]);
  }

  logEntry({
    setActivityLog,
    icon: "🏭",
    title: `Production started — ${newBatch.product}`,
    detail: `Batch ${newBatch.batchLabel} · ${newBatch.target} KG · ${newBatch.shift || ""}`,
    color: "#f97316",
    sess,
  });

  notify?.(`▶ Batch ${newBatch.batchLabel} started`, "success");
}

// ─── Workflow 2: Production Progress (weight entry) ──────────
/**
 * Called on weight onBlur in active batch panel.
 * Updates batch.weight and batch.actual, and if weight > 0 moves
 * workflowStatus to "awaiting_qc" so QC tab picks it up.
 */
export function onProductionProgress({
  batchId,
  weight,
  setBatches,
  setActivityLog,
  sess,
  notify,
}) {
  if (!batchId) return;

  setBatches(prev =>
    (Array.isArray(prev) ? prev : []).map(b => {
      if (b.id !== batchId) return b;
      const next = {
        ...b,
        weight,
        actual: weight, // weight IS the actual KG produced
        updatedAt: ts(),
      };
      // Promote to awaiting_qc once weight is entered
      if (weight > 0 && b.workflowStatus === "production") {
        next.workflowStatus = "awaiting_qc";
      }
      return next;
    })
  );

  if (weight > 0) {
    logEntry({
      setActivityLog,
      icon: "⚖️",
      title: `Production weight entered`,
      detail: `Batch ${batchId} · ${weight} KG → sent to QC`,
      color: "#f97316",
      sess,
    });
  }
}

// ─── Workflow 3: QC Result ────────────────────────────────────
/**
 * Called when inspector submits QC form.
 * - Updates batch.qcGrade, batch.workflowStatus
 * - Appends to qcLogs
 * - Logs to activity
 */
export function onQCResult({
  batch,
  finalGrade,
  failCount,
  notes,
  checkResults,
  sess,
  setBatches,
  setQcLogs,
  setActivityLog,
  notify,
}) {
  if (!batch?.id) return;

  const passed  = finalGrade !== "Rejected";
  const newStatus = passed ? "ready_to_pack" : "qc_rejected";
  const now     = new Date();

  setBatches(prev =>
    (Array.isArray(prev) ? prev : []).map(b =>
      b.id !== batch.id ? b : {
        ...b,
        qcGrade:        finalGrade,
        qcNotes:        notes || "",
        qcChecks:       checkResults,
        qcFailCount:    failCount,
        qcInspectedBy:  sess?.name || "Staff",
        qcInspectedAt:  ts(),
        workflowStatus: newStatus,
        updatedAt:      ts(),
      }
    )
  );

  const logItem = {
    id:          `qc_${Date.now().toString(36)}`,
    batchId:     batch.id,
    batchLabel:  batch.batchLabel || batch.id,
    product:     batch.product    || "",
    grade:       finalGrade,
    failCount:   failCount || 0,
    notes:       notes || "",
    checkResults,
    inspector:   sess?.name || "Staff",
    date:        now.toLocaleDateString("en-IN"),
    time:        now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    createdAt:   ts(),
  };

  setQcLogs?.(prev => [logItem, ...(Array.isArray(prev) ? prev : [])]);

  logEntry({
    setActivityLog,
    icon: passed ? "✅" : "❌",
    title: passed
      ? `QC Passed — Grade ${finalGrade} · ${batch.product}`
      : `QC Rejected — ${batch.product}`,
    detail: passed
      ? `Batch ${batch.batchLabel} cleared for packing`
      : `Batch ${batch.batchLabel} · ${failCount} failure${failCount > 1 ? "s" : ""}${notes ? ` · "${notes}"` : ""}`,
    color: passed ? "#10B981" : "#ef4444",
    sess,
  });

  notify?.(
    passed
      ? `✅ Grade ${finalGrade} — ${batch.product} cleared for packing`
      : `❌ ${batch.product} rejected · ${failCount} failure${failCount > 1 ? "s" : ""}`,
    passed ? "success" : "error"
  );
}

// ─── Workflow 4: Packing Entry ────────────────────────────────
/**
 * Log a packing qty increment for a batch.
 * Blocks if workflowStatus is qc_rejected or awaiting_qc.
 */
export function onPackingEntry({
  batch,
  qty,
  damage,
  sess,
  setBatches,
  setActivityLog,
  notify,
}) {
  if (!batch?.id) return;

  if (!canBatchBePacked(batch)) {
    const reason = batch.workflowStatus === "qc_rejected"
      ? "❌ Batch was QC rejected — cannot pack"
      : "⏳ Batch is awaiting QC — cannot pack yet";
    notify?.(reason, "warning");
    return;
  }

  setBatches(prev =>
    (Array.isArray(prev) ? prev : []).map(b =>
      b.id !== batch.id ? b : {
        ...b,
        actual:    (b.actual ?? 0) + qty,
        damaged:   (b.damaged ?? 0) + (damage || 0),
        updatedAt: ts(),
      }
    )
  );

  logEntry({
    setActivityLog,
    icon: "📦",
    title: `Packing logged — ${batch.product}`,
    detail: `${qty} pcs packed${damage > 0 ? ` · ${damage} damaged` : ""} · Batch ${batch.batchLabel}`,
    color: "#06b6d4",
    sess,
  });
}

// ─── Workflow 5: Packing Complete ─────────────────────────────
/**
 * Mark a batch as fully packed. Sets workflowStatus = "packed".
 */
export function onPackingComplete({
  batch,
  sess,
  setBatches,
  setActivityLog,
  notify,
}) {
  if (!batch?.id) return;

  setBatches(prev =>
    (Array.isArray(prev) ? prev : []).map(b =>
      b.id !== batch.id ? b : {
        ...b,
        workflowStatus: "packed",
        packedAt:       ts(),
        packedBy:       sess?.name || "Staff",
        updatedAt:      ts(),
      }
    )
  );

  logEntry({
    setActivityLog,
    icon: "✅",
    title: `Packing complete — ${batch.product}`,
    detail: `Batch ${batch.batchLabel} · ${batch.actual ?? 0} pcs packed · ready for dispatch`,
    color: "#10B981",
    sess,
  });

  notify?.(`✅ ${batch.product} packed and ready for dispatch`, "success");
}

// ─── Workflow 6: Batch Hold / Resume ─────────────────────────
/**
 * Toggle hold state on a batch.
 */
export function onBatchHold({
  batch,
  holdNote,
  sess,
  setBatches,
  setActivityLog,
  notify,
}) {
  if (!batch?.id) return;

  const releasing = !!batch.onHold;

  setBatches(prev =>
    (Array.isArray(prev) ? prev : []).map(b =>
      b.id !== batch.id ? b : {
        ...b,
        onHold:         !b.onHold,
        holdNote:       releasing ? "" : (holdNote || ""),
        holdAt:         releasing ? null : ts(),
        holdBy:         releasing ? null : (sess?.name || "Staff"),
        workflowStatus: releasing
          ? (b.prevWorkflowStatus || "production")
          : "on_hold",
        prevWorkflowStatus: releasing ? undefined : b.workflowStatus,
        updatedAt: ts(),
      }
    )
  );

  logEntry({
    setActivityLog,
    icon: releasing ? "▶" : "⏸",
    title: releasing
      ? `Batch resumed — ${batch.product}`
      : `Batch on hold — ${batch.product}`,
    detail: releasing
      ? `Batch ${batch.batchLabel} resumed`
      : `Batch ${batch.batchLabel}${holdNote ? ` · "${holdNote}"` : ""}`,
    color: "#F59E0B",
    sess,
  });

  notify?.(
    releasing
      ? `▶ ${batch.product} resumed`
      : `⏸ ${batch.product} on hold`,
    "info"
  );
}

// ─── Workflow 7: Inventory Usage ─────────────────────────────
/**
 * Deduct stock for a usage entry. Returns true on success.
 */
export function onInventoryUsage({
  item,
  qty,
  reason,
  sess,
  setInventory,
  setActivityLog,
  notify,
}) {
  if (!item?.id) { notify?.("No item selected", "warning"); return false; }
  if (!qty || qty <= 0) { notify?.("Enter a valid quantity", "warning"); return false; }
  if (qty > (item.stock ?? 0)) { notify?.("Cannot exceed current stock", "warning"); return false; }

  setInventory(prev =>
    (Array.isArray(prev) ? prev : []).map(i =>
      i.id !== item.id ? i : {
        ...i,
        stock:     (i.stock ?? 0) - qty,
        updatedAt: ts(),
      }
    )
  );

  logEntry({
    setActivityLog,
    icon: "📋",
    title: `Inventory used — ${item.name}`,
    detail: `${qty} ${item.unit || "units"} deducted${reason ? ` · ${reason}` : ""}`,
    color: "#8b5cf6",
    sess,
  });

  notify?.(`${qty} ${item.unit || "units"} deducted — ${item.name}`, "success");
  return true;
}

// ─── Workflow 8: Inventory Receive ───────────────────────────
/**
 * Add incoming stock. Returns true on success.
 */
export function onInventoryReceive({
  item,
  qty,
  source,
  sess,
  setInventory,
  setActivityLog,
  notify,
}) {
  if (!item?.id) { notify?.("No item selected", "warning"); return false; }
  if (!qty || qty <= 0) { notify?.("Enter a valid quantity", "warning"); return false; }

  setInventory(prev =>
    (Array.isArray(prev) ? prev : []).map(i =>
      i.id !== item.id ? i : {
        ...i,
        stock:     (i.stock ?? 0) + qty,
        updatedAt: ts(),
      }
    )
  );

  logEntry({
    setActivityLog,
    icon: "📥",
    title: `Stock received — ${item.name}`,
    detail: `+${qty} ${item.unit || "units"}${source ? ` · from ${source}` : ""}`,
    color: "#10B981",
    sess,
  });

  notify?.(`+${qty} ${item.unit || "units"} added — ${item.name}`, "success");
  return true;
}

// ─── Legacy: kept for any existing callers ────────────────────
export function onBatchComplete(batch, actor, setPackingTasks, notify) {
  if (!batch?.id) return null;
  const packingTask = {
    id:          `pk_${Date.now().toString(36)}`,
    batchId:     batch.id,
    batchLabel:  batch.batchLabel || batch.id,
    product:     batch.product    || "Unknown Product",
    quantity:    batch.actual     || batch.target || 0,
    status:      "Pending",
    createdAt:   new Date().toISOString(),
    createdBy:   actor?.name || "System",
    autoCreated: true,
  };
  setPackingTasks(prev => [packingTask, ...(Array.isArray(prev) ? prev : [])]);
  notify?.(`📦 Packing task created for ${batch.product} · ${packingTask.quantity} pcs`, "success");
  return packingTask;
}
