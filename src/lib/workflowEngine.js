// ============================================================
// lib/workflowEngine.js  — Workflow Engine  v1
//
// Handles cross-module automation triggered by status changes.
//
// Current workflows:
//   1. onBatchComplete(batch, actor, setPackingTasks, notify)
//      Production batch marked complete
//      → Auto-creates a packing task in tas9_pack
//
// Future workflows can be added here following the same pattern.
// ============================================================



/** Returns ISO timestamp */
function ts() { return new Date().toISOString(); }

/** Unique ID generator */
function uid(prefix = "pk") {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Workflow 1: Batch Complete → Auto-create Packing Task ───

/**
 * Call this when a production batch is marked as completed.
 *
 * What it does:
 *   - Creates a packing task in tas9_pack linked to the batch
 *   - The task status starts as "Pending"
 *   - Shows a notification to the user
 *
 * @param {object}   batch            The completed batch object from tas9_batches
 * @param {object}   actor            { name, role } — who completed the batch
 * @param {function} setPackingTasks  React state setter from useStore("tas9_pack")
 * @param {function} [notify]         Optional toast: notify(msg, type)
 *
 * @returns {object} The created packing task
 *
 * Usage in ProductionStart.js (inside handleComplete):
 *   import { onBatchComplete } from "../../lib/workflowEngine.js";
 *   const [packingTasks, setPackingTasks] = useStore("tas9_pack", []);
 *   // ... after marking batch complete:
 *   onBatchComplete(completedBatch, sess, setPackingTasks, notify);
 */
export function onBatchComplete(batch, actor, setPackingTasks, notify) {
  if (!batch?.id) {
    console.warn("[workflowEngine] onBatchComplete: no batch id");
    return null;
  }

  const packingTask = {
    id:          uid("pk"),
    batchId:     batch.id,
    batchLabel:  batch.batchLabel || batch.id,
    product:     batch.product    || "Unknown Product",
    productId:   batch.productId  || null,
    quantity:    batch.actual     || batch.target || 0,
    unit:        batch.unit       || "pcs",
    status:      "Pending",                     // Pending → In Progress → Packed
    priority:    "normal",
    assignedTo:  null,
    createdAt:   ts(),
    createdBy:   actor?.name || "System",
    createdByRole: actor?.role || "staff",
    autoCreated: true,                          // flag: created by workflow engine
    notes:       `Auto-created from batch ${batch.batchLabel || batch.id}`,
    packedQty:   0,
    rejectedQty: 0,
    completedAt: null,
    completedBy: null,
  };

  // Optimistic UI update
  setPackingTasks(prev =>
    [packingTask, ...(Array.isArray(prev) ? prev : [])]
  );

  notify?.(
    `📦 Packing task created for ${batch.product || "batch"} · ${packingTask.quantity} pcs`,
    "success"
  );

  return packingTask;
}

// ─── Workflow 2: Packing Complete → (future) Inventory update ─
// export function onPackingComplete(packTask, actor, setInventory, notify) { ... }

// ─── Workflow 2: QC Fail → Block Dispatch ─────────────────────
// export function onQCFail(batch, actor, setDeliveries, notify) { ... }
