// ============================================================
// staff/tabs/ProductionStart.js — v5
// Smart Production Tab:
//   - Batch start → auto deducts ingredients, logs activity,
//     updates prod targets, notifies
//   - Weight entry → auto promotes to awaiting_qc
//   - Active batch cards show full pipeline status
//   - On-hold toggle wired to workflowEngine
//   - Ingredient reservation preview in confirm sheet
//   - Manual entry always available
// ============================================================

import React, { useState, useMemo, useEffect } from "react";
import { TAB_ACCENT } from "../theme.js";
import {
  SBtn, SSel,
  SSheet, SHr, SProgress, SDonut,
} from "../components/ui.js";
import { useStore } from "../../lib/store.js";
import {
  onProductionStarted,
  onProductionProgress,
  onBatchHold,
  onInventoryUsage,
} from "../../lib/workflowEngine.js";
import { hasPerm } from "../../lib/roles.js";

const COLOR = TAB_ACCENT.production?.solid || "#f97316";
const GRAD  = TAB_ACCENT.production?.gradient || "linear-gradient(135deg,#c2410c,#f97316)";
const GLOW  = TAB_ACCENT.production?.glow || "0 4px 24px rgba(249,115,22,0.4)";

const D_SETTINGS = {
  prodItems: [
    { id: "p1", name: "Malabar Paratha",   icon: "🫓", color: "#F59E0B", unit: "KG", pcs: 1200 },
    { id: "p2", name: "Lachha Paratha",    icon: "🥙", color: "#10B981", unit: "KG", pcs: 1000 },
    { id: "p3", name: "Plain Paratha",     icon: "🍞", color: "#8B5CF6", unit: "KG", pcs: 1500 },
    { id: "p4", name: "Family Pack 20pcs", icon: "📦", color: "#06b6d4", unit: "KG", pcs: 800  },
    { id: "p5", name: "Mini Paratha",      icon: "🫓", color: "#f97316", unit: "KG", pcs: 1100 },
    { id: "p6", name: "Garlic Paratha",    icon: "🧄", color: "#3b82f6", unit: "KG", pcs: 900  },
  ],
  machines: ["Machine 1", "Machine 2", "Machine 3", "Machine 4"],
  shifts: [
    "Shift A (06:00 AM - 02:00 PM)",
    "Shift B (02:00 PM - 10:00 PM)",
    "Shift C (10:00 PM - 06:00 AM)",
  ],
  batchUnitPresets: [250, 500, 750, 1000],
  workerRequirements: { default: 12 },
};

function genBatchLabel(prefix = "PR") {
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  return `${prefix}-${new Date().getFullYear()}-${ts}`;
}

function useIsMobile(bp = 700) {
  const [mobile, setMobile] = useState(() => window.innerWidth < bp);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < bp);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, [bp]);
  return mobile;
}

// ── Pipeline step indicator ───────────────────────────────────
const PIPELINE = [
  { key: "production",    label: "In Production", icon: "🏭" },
  { key: "awaiting_qc",  label: "Awaiting QC",   icon: "🔬" },
  { key: "ready_to_pack",label: "Ready to Pack",  icon: "📦" },
  { key: "packed",       label: "Packed",         icon: "✅" },
];

function PipelineSteps({ status, t, accent }) {
  const currentIdx = PIPELINE.findIndex(s => s.key === status);
  const isRejected = status === "qc_rejected";
  const isHold     = status === "on_hold";

  if (isRejected) return (
    <div style={{
      display: "flex", alignItems: "center", gap: 7,
      background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
      borderRadius: 8, padding: "7px 12px",
    }}>
      <span style={{ fontSize: 14 }}>❌</span>
      <span style={{ color: "#ef4444", fontSize: 11, fontWeight: 700 }}>QC Rejected</span>
    </div>
  );

  if (isHold) return (
    <div style={{
      display: "flex", alignItems: "center", gap: 7,
      background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)",
      borderRadius: 8, padding: "7px 12px",
    }}>
      <span style={{ fontSize: 14 }}>⏸</span>
      <span style={{ color: "#F59E0B", fontSize: 11, fontWeight: 700 }}>On Hold</span>
    </div>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
      {PIPELINE.map((step, i) => {
        const done    = i < currentIdx;
        const active  = i === currentIdx;
        const pending = i > currentIdx;
        const sc = active ? (accent || COLOR) : done ? "#10B981" : "rgba(255,255,255,0.15)";
        return (
          <React.Fragment key={step.key}>
            <div style={{
              display: "flex", alignItems: "center", gap: 4,
              background: active ? `${sc}18` : done ? "rgba(16,185,129,0.08)" : "transparent",
              border: `1px solid ${active ? sc + "50" : done ? "#10B98140" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 6, padding: "4px 8px",
              opacity: pending ? 0.4 : 1,
              transition: "all 0.2s",
            }}>
              <span style={{ fontSize: 10 }}>{step.icon}</span>
              <span style={{ color: active ? sc : done ? "#10B981" : t.muted, fontSize: 9, fontWeight: 700 }}>
                {step.label}
              </span>
              {active && (
                <span style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: sc, boxShadow: `0 0 6px ${sc}`,
                  animation: "pulse 1.5s infinite",
                  display: "inline-block", marginLeft: 2,
                }} />
              )}
            </div>
            {i < PIPELINE.length - 1 && (
              <span style={{ color: done ? "#10B98160" : "rgba(255,255,255,0.1)", fontSize: 9 }}>›</span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Ingredient reservation preview ────────────────────────────
function IngredientReservation({ recipe = [], inventory = [], quantity, t }) {
  if (!recipe.length) return null;

  return (
    <div style={{
      background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)",
      borderRadius: 12, padding: "14px 16px", marginBottom: 16,
    }}>
      <div style={{ color: "#f97316", fontSize: 11, fontWeight: 800, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <span>🧪</span> Ingredients to be reserved
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {recipe.map((ing, i) => {
          const needed     = (ing.qtyPer || 0) * quantity;
          const invItem    = inventory.find(iv => iv.id === ing.ingredientId || iv.name === ing.name);
          const available  = invItem?.stock ?? null;
          const sufficient = available === null || available >= needed;
          return (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "7px 10px",
              background: sufficient ? "rgba(255,255,255,0.03)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${sufficient ? "rgba(255,255,255,0.07)" : "rgba(239,68,68,0.25)"}`,
              borderRadius: 8,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12 }}>{sufficient ? "✅" : "⚠️"}</span>
                <span style={{ color: t.text, fontSize: 11, fontWeight: 600 }}>{ing.name}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: sufficient ? t.text : "#ef4444", fontSize: 11, fontWeight: 700 }}>
                  {needed} {ing.unit}
                </div>
                {available !== null && (
                  <div style={{ color: t.muted, fontSize: 9 }}>
                    {available} available
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
export function ProductionStartTab({
  t, batches = [], setBatches, sess, notify,
  settings: settingsProp, logActivity,
  setInventory, setActivityLog,
  inventory = [],
}) {
  const [settingsStore] = useStore("tas10_settings", D_SETTINGS);
  const settings = settingsProp ?? settingsStore;
  const [, setProdTargets]   = useStore("tas9_prodtargets", []);

  const sp    = settings?.staffPortal || {};
  const spOn  = (key, def) => sp[key] !== undefined ? sp[key] : def;

  const prodItems   = sp.prodItems           ?? settings?.prodItems           ?? D_SETTINGS.prodItems;
  const machines    = sp.productionMachines  ?? settings?.machines             ?? D_SETTINGS.machines;
  const shifts      = sp.productionShifts    ?? settings?.shifts               ?? D_SETTINGS.shifts;
  const unitPresets = sp.productionQtyPresets ?? settings?.batchUnitPresets    ?? D_SETTINGS.batchUnitPresets;
  const defaultWorkers = sp.productionDefaultWorkers ?? 12;
  const workerReq   = settings?.workerRequirements ?? D_SETTINGS.workerRequirements;
  const recipes     = settings?.recipes ?? {};

  const showPreview  = spOn("productionShowPreview",  true);
  const showMachine  = spOn("productionShowMachine",  true);
  const showShift    = spOn("productionShowShift",    true);
  const showWorkers  = spOn("productionShowWorkers",  true);
  const showHistory  = spOn("productionShowHistory",  true);
  const showTargets  = spOn("productionShowTargets",  true);
  const lightMode    = spOn("staffLightMode",         false);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity]               = useState(500);
  const [quantityInput, setQuantityInput]     = useState("500");
  const [machine, setMachine]                 = useState("");
  const [shift, setShift]                     = useState("");
  const [estTime, setEstTime]                 = useState("");
  const [estCompletion, setEstCompletion]     = useState("");
  const [workersInput, setWorkersInput]       = useState("");
  const [confirmOpen, setConfirmOpen]         = useState(false);
  const [search, setSearch]                   = useState("");
  const [batchInputs, setBatchInputs]         = useState({});
  const [holdSheetBatch, setHoldSheetBatch]   = useState(null);
  const [holdNote, setHoldNote]               = useState("");

  const isMobile = useIsMobile();

  const safe = Array.isArray(batches) ? batches : [];
  const filteredProducts = useMemo(() =>
    (prodItems || []).filter(p =>
      !search || (p.name || "").toLowerCase().includes(search.toLowerCase())
    ), [prodItems, search]);

  const activeBatches    = safe.filter(b => !["packed","dispatched","delivered","qc_rejected"].includes(b.workflowStatus) && !b.onHold);
  const completedBatches = safe.filter(b => ["packed","dispatched","delivered"].includes(b.workflowStatus) || (b.actual ?? 0) >= (b.target ?? 0));
  const onHoldBatches    = safe.filter(b => b.onHold || b.workflowStatus === "on_hold");
  const inProgressCount  = safe.filter(b => (b.actual ?? 0) > 0 && (b.actual ?? 0) < (b.target ?? 0)).length;

  const canView  = (hasPerm(sess, "prod_add") || hasPerm(sess, "prod_edit")) && spOn("productionCanAdd", true);
  const canStart = hasPerm(sess, "prod_add") && spOn("productionCanAdd", true);
  const canEdit  = hasPerm(sess, "prod_edit") && spOn("productionCanEdit", false);
  const canHold  = hasPerm(sess, "prod_edit");

  const isReady  = selectedProduct && quantity > 0 && (machine || !showMachine) && (shift || !showShift);
  const accent   = selectedProduct?.color || COLOR;
  const workers  = workersInput || (workerReq?.[selectedProduct?.id] ?? defaultWorkers);

  const totalTarget = showTargets ? safe.reduce((s, b) => s + (b.target ?? 0), 0) : 0;
  const totalActual = safe.reduce((s, b) => s + (b.actual ?? 0), 0);
  const overallPct  = totalTarget > 0 ? Math.min(100, Math.round((totalActual / totalTarget) * 100)) : 0;

  // Recipe for selected product
  const selectedProductObj = (prodItems || []).find(p => p.id === selectedProduct?.id);
  const productRecipe = selectedProductObj
    ? (recipes[selectedProductObj.id]?.ingredients || [])
    : [];

  const panelStyle = lightMode ? {
    background: "#ffffff",
    border: "1px solid rgba(15,23,42,0.10)",
    borderRadius: 18, padding: "18px",
    boxShadow: "0 1px 3px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.06)",
  } : {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 18, padding: "18px",
    backdropFilter: "blur(20px)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  };

  // ── Check ingredient sufficiency before starting ──────────
  function checkIngredients() {
    if (!productRecipe.length) return true;
    for (const ing of productRecipe) {
      const needed   = (ing.qtyPer || 0) * quantity;
      const invItem  = inventory.find(iv => iv.id === ing.ingredientId || iv.name === ing.name);
      const available = invItem?.stock ?? Infinity;
      if (available < needed) {
        notify(`⚠️ Insufficient ${ing.name}: need ${needed} ${ing.unit}, have ${invItem?.stock ?? 0}`, "warning");
        return false;
      }
    }
    return true;
  }

  const handleStart = () => {
    if (!isReady) { notify("Please complete all fields", "warning"); return; }
    if (!checkIngredients()) return;

    const newBatch = {
      id:           `batch_${Date.now()}`,
      batchLabel:   genBatchLabel(sp.batchPrefix || "PR"),
      product:      selectedProduct.name,
      productId:    selectedProduct.id,
      target:       quantity,
      actual:       0,
      damaged:      0,
      piecesMade:   0,
      weight:       0,
      machine,
      shift,
      estTime:       estTime || "",
      estCompletion: estCompletion || "",
      workers:       workersInput ? parseInt(workersInput, 10) || 0 : workers,
      date:          new Date().toLocaleDateString("en-IN"),
      startedAt:     new Date().toISOString(),
      startedBy:     sess?.name || "Staff",
      onHold:        false,
      status:        "active",
    };

    // 1. Start batch via workflow engine (sets workflowStatus = "production")
    onProductionStarted({
      newBatch,
      sess,
      setBatches,
      setProdTargets,
      setInventory,
      setActivityLog,
      settings,
      notify,
    });

    // 2. Auto-deduct ingredients from inventory
    if (productRecipe.length && setInventory) {
      for (const ing of productRecipe) {
        const needed  = (ing.qtyPer || 0) * quantity;
        const invItem = inventory.find(iv => iv.id === ing.ingredientId || iv.name === ing.name);
        if (invItem && needed > 0) {
          onInventoryUsage({
            item: invItem,
            qty: needed,
            reason: `Reserved for batch ${newBatch.batchLabel}`,
            sess,
            setInventory,
            setActivityLog,
            notify: () => {}, // silent — batch start notify is enough
          });
        }
      }
    }

    // 3. Log via logActivity if provided
    if (typeof logActivity === "function") {
      logActivity("production_started", {
        batchId:    newBatch.id,
        batchLabel: newBatch.batchLabel,
        product:    newBatch.product,
        target:     newBatch.target,
        shift:      newBatch.shift,
        machine:    newBatch.machine,
      });
    }

    setConfirmOpen(false);
    setSelectedProduct(null);
    setQuantity(500);
    setQuantityInput("500");
    setMachine("");
    setShift("");
    setEstTime("");
    setEstCompletion("");
    setWorkersInput("");
  };

  const handleHoldToggle = (batch) => {
    if (batch.onHold || batch.workflowStatus === "on_hold") {
      // Resume immediately
      onBatchHold({ batch, holdNote: "", sess, setBatches, setActivityLog, notify });
    } else {
      // Show hold sheet for note
      setHoldSheetBatch(batch);
      setHoldNote("");
    }
  };

  const handleHoldConfirm = () => {
    if (!holdSheetBatch) return;
    onBatchHold({ batch: holdSheetBatch, holdNote, sess, setBatches, setActivityLog, notify });
    setHoldSheetBatch(null);
    setHoldNote("");
  };

  // Pulse animation injected once
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById("ps-pulse-style")) return;
    const s = document.createElement("style");
    s.id = "ps-pulse-style";
    s.textContent = `@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.3)} }`;
    document.head.appendChild(s);
  }, []);

  return (
    <div style={{ background: t.bg, minHeight: "100vh", padding: isMobile ? "14px" : "20px", animation: "fadeIn 0.3s ease" }}>

      {/* ── Access Wall ──────────────────────────────────────── */}
      {!canView && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", minHeight: "60vh", gap: 16, textAlign: "center",
        }}>
          <div style={{ fontSize: 48 }}>🔒</div>
          <div style={{ color: t.text, fontSize: 18, fontWeight: 800 }}>Access Restricted</div>
          <div style={{ color: t.sub, fontSize: 13, maxWidth: 280 }}>
            You don't have permission to access Production. Contact your admin to request access.
          </div>
        </div>
      )}

      {canView && <>

        {/* ── Header ───────────────────────────────────────── */}
        <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: GRAD, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 18, fontWeight: 900, color: "#fff",
            boxShadow: GLOW, flexShrink: 0,
          }}>🏭</div>
          <div>
            <div style={{ color: t.text, fontSize: isMobile ? 17 : 20, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1 }}>
              Start Production
            </div>
            <div style={{ color: t.sub, fontSize: 12, marginTop: 3 }}>
              Create a batch — inventory, QC & packing queue update automatically
            </div>
          </div>
        </div>

        {/* ── 3-Panel Layout ───────────────────────────────── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr",
          gap: 16, alignItems: "start",
        }}>

          {/* ── PANEL 1: Select Product ────────────────────── */}
          <div style={panelStyle}>
            <div style={{ color: lightMode ? "#94a3b8" : "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>
              SELECT PRODUCT
            </div>
            <div style={{ position: "relative", marginBottom: 14 }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: t.muted, pointerEvents: "none" }}>🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search products..."
                style={{
                  width: "100%", background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${t.border2}`, color: t.text,
                  borderRadius: 10, padding: "8px 10px 8px 30px",
                  fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                }}
                onFocus={e => { e.target.style.borderColor = COLOR; e.target.style.boxShadow = `0 0 0 3px ${COLOR}15`; }}
                onBlur={e => { e.target.style.borderColor = t.border2; e.target.style.boxShadow = ""; }}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {filteredProducts.map(p => {
                const isSel = selectedProduct?.id === p.id;
                const pacc  = p.color || COLOR;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedProduct(isSel ? null : p)}
                    style={{
                      background:   isSel ? `${pacc}18` : lightMode ? "#f7f8fc" : "rgba(255,255,255,0.03)",
                      border:       `1.5px solid ${isSel ? pacc + "55" : lightMode ? "rgba(15,23,42,0.10)" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: 12, padding: "12px 8px",
                      cursor: "pointer", transition: "all 0.18s", textAlign: "center",
                      boxShadow: isSel ? `0 0 20px ${pacc}25` : "none",
                      position: "relative",
                    }}
                    onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = lightMode ? "#eef0f8" : "rgba(255,255,255,0.06)"; }}
                    onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = lightMode ? "#f7f8fc" : "rgba(255,255,255,0.03)"; }}
                  >
                    {isSel && (
                      <div style={{
                        position: "absolute", top: 5, right: 5,
                        width: 16, height: 16, borderRadius: "50%",
                        background: pacc, color: "#fff", fontSize: 9, fontWeight: 900,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: `0 0 8px ${pacc}80`,
                      }}>✓</div>
                    )}
                    <div style={{ fontSize: 26, marginBottom: 6 }}>{p.icon || "📦"}</div>
                    <div style={{ color: isSel ? pacc : t.text, fontWeight: 700, fontSize: 10, lineHeight: 1.3 }}>{p.name}</div>
                    {p.pcs && (
                      <div style={{ color: t.muted, fontSize: 9, marginTop: 3 }}>{p.pcs.toLocaleString("en-IN")} pcs</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── PANEL 2: Batch Details ─────────────────────── */}
          <div style={{
            ...panelStyle,
            border: `1px solid ${selectedProduct ? accent + "30" : "rgba(255,255,255,0.08)"}`,
            boxShadow: selectedProduct ? `0 8px 32px rgba(0,0,0,0.4), 0 0 40px ${accent}10` : "0 8px 32px rgba(0,0,0,0.4)",
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}>
            <div style={{ color: lightMode ? "#94a3b8" : "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14 }}>
              BATCH DETAILS
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ color: t.sub, fontSize: 11 }}>Batch ID</div>
              <div style={{ color: t.text, fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}>
                PR-{new Date().getFullYear()}-{String(safe.length + 1).padStart(4, "0")}
                <div style={{ color: t.muted, fontSize: 9, textAlign: "right", marginTop: 1 }}>Auto generated</div>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ color: t.sub, fontSize: 11, marginBottom: 8 }}>Planned Quantity (KG)</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {(unitPresets || [250, 500, 750, 1000]).map(v => (
                  <button
                    key={v}
                    onClick={() => { setQuantity(v); setQuantityInput(String(v)); }}
                    style={{
                      padding: "6px 12px", borderRadius: 8, border: "none",
                      cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700,
                      background: quantity === v ? GRAD : "rgba(255,255,255,0.06)",
                      color: quantity === v ? "#fff" : t.sub,
                      boxShadow: quantity === v ? GLOW : "none",
                      transition: "all 0.15s",
                    }}
                  >{v} KG</button>
                ))}
              </div>
              <input
                type="number"
                value={quantityInput}
                onChange={e => { setQuantityInput(e.target.value); const n = parseFloat(e.target.value); if (!isNaN(n) && n >= 0) setQuantity(n); }}
                placeholder="Enter quantity..."
                style={{
                  width: "100%", background: lightMode ? "#fff" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${t.border2}`, color: t.text, borderRadius: 10,
                  padding: "10px 12px", fontSize: 13, fontWeight: 700, outline: "none",
                  boxSizing: "border-box", fontFamily: "inherit",
                }}
                onFocus={e => { e.target.style.borderColor = accent || COLOR; e.target.style.boxShadow = `0 0 0 3px ${accent || COLOR}15`; }}
                onBlur={e => { e.target.style.borderColor = t.border2; e.target.style.boxShadow = ""; }}
              />
            </div>

            {showMachine && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: t.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>⚙️ Machine</div>
                <SSel
                  value={machine}
                  onChange={canEdit ? setMachine : () => {}}
                  placeholder="Select machine..."
                  options={(machines || []).map(m => ({ value: m, label: m }))}
                  t={t}
                  disabled={!canEdit}
                />
                {!canEdit && machine && <div style={{ color: t.muted, fontSize: 10, marginTop: 3 }}>🔒 Locked by admin</div>}
              </div>
            )}

            {showShift && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: t.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>🕐 Shift</div>
                <SSel
                  value={shift}
                  onChange={canEdit ? setShift : () => {}}
                  placeholder="Select shift..."
                  options={(shifts || []).map(s => ({ value: s, label: s }))}
                  t={t}
                  disabled={!canEdit}
                />
                {!canEdit && shift && <div style={{ color: t.muted, fontSize: 10, marginTop: 3 }}>🔒 Locked by admin</div>}
              </div>
            )}

            <SHr t={t} />

            {showPreview && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                <div>
                  <div style={{ color: t.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>⏱ Est. Time</div>
                  <input type="text" value={estTime} onChange={e => setEstTime(e.target.value)} placeholder="e.g. 4h 30m"
                    style={{ width: "100%", background: lightMode ? "#fff" : "rgba(255,255,255,0.06)", border: `1px solid ${t.border2}`, color: t.text, borderRadius: 10, padding: "9px 12px", fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                    onFocus={e => { e.target.style.borderColor = accent || COLOR; e.target.style.boxShadow = `0 0 0 3px ${accent || COLOR}15`; }}
                    onBlur={e => { e.target.style.borderColor = t.border2; e.target.style.boxShadow = ""; }}
                  />
                </div>
                {showWorkers && (
                  <div>
                    <div style={{ color: t.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>👷 Team Members Required</div>
                    <input type="number" value={workersInput} onChange={e => setWorkersInput(e.target.value)} placeholder={`Default: ${defaultWorkers}`} min={0}
                      style={{ width: "100%", background: lightMode ? "#fff" : "rgba(255,255,255,0.06)", border: `1px solid ${t.border2}`, color: t.text, borderRadius: 10, padding: "9px 12px", fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                      onFocus={e => { e.target.style.borderColor = accent || COLOR; e.target.style.boxShadow = `0 0 0 3px ${accent || COLOR}15`; }}
                      onBlur={e => { e.target.style.borderColor = t.border2; e.target.style.boxShadow = ""; }}
                    />
                  </div>
                )}
                <div>
                  <div style={{ color: t.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>🕐 Est. Completion Time</div>
                  <input type="text" value={estCompletion} onChange={e => setEstCompletion(e.target.value)} placeholder="e.g. 06:30 PM"
                    style={{ width: "100%", background: lightMode ? "#fff" : "rgba(255,255,255,0.06)", border: `1px solid ${t.border2}`, color: t.text, borderRadius: 10, padding: "9px 12px", fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                    onFocus={e => { e.target.style.borderColor = accent || COLOR; e.target.style.boxShadow = `0 0 0 3px ${accent || COLOR}15`; }}
                    onBlur={e => { e.target.style.borderColor = t.border2; e.target.style.boxShadow = ""; }}
                  />
                </div>
              </div>
            )}

            {/* CTA */}
            <button
              onClick={() => {
                if (!canStart) { notify("You don't have permission to start production", "warning"); return; }
                if (isReady) setConfirmOpen(true);
                else notify("Complete all fields to start", "warning");
              }}
              style={{
                width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
                cursor: (isReady && canStart) ? "pointer" : "not-allowed",
                background: (isReady && canStart) ? GRAD : "rgba(255,255,255,0.06)",
                color: (isReady && canStart) ? "#fff" : t.muted,
                fontWeight: 800, fontSize: 14, fontFamily: "inherit",
                boxShadow: (isReady && canStart) ? GLOW : "none",
                transition: "all 0.2s", display: "flex", alignItems: "center",
                justifyContent: "center", gap: 8,
              }}
            >
              {canStart ? "▶ Start Production" : spOn("productionCanAdd", true) ? "🔒 No Permission to Start" : "🔒 Disabled by Admin"}
            </button>
          </div>

          {/* ── PANEL 3: Today's Summary ──────────────────── */}
          <div style={panelStyle}>
            <div style={{ color: lightMode ? "#94a3b8" : "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16 }}>
              TODAY'S SUMMARY
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
              <SDonut
                value={totalActual}
                max={totalTarget || 1}
                color={COLOR}
                size={100}
                strokeWidth={10}
                label={`${overallPct}%`}
                t={t}
              />
              <div style={{ color: t.sub, fontSize: 11, marginTop: 10, fontWeight: 600 }}>Production Goal</div>
              <div style={{ color: t.text, fontSize: 13, fontWeight: 800, marginTop: 2 }}>
                {totalActual.toLocaleString("en-IN")} / {(totalTarget || 5000).toLocaleString("en-IN")} KG
              </div>
            </div>

            <SHr t={t} />

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
              {[
                { label: "Started Batches",   value: safe.length,             color: COLOR,     icon: "🏭" },
                { label: "Completed",         value: completedBatches.length, color: "#10B981", icon: "✅" },
                { label: "In Progress",       value: inProgressCount,         color: "#F59E0B", icon: "⚡" },
                { label: "On Hold",           value: onHoldBatches.length,    color: "#F59E0B", icon: "⏸" },
              ].map(s => (
                <div key={s.label} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 12px",
                  background: `${s.color}08`, borderRadius: 10,
                  border: `1px solid ${s.color}20`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14 }}>{s.icon}</span>
                    <span style={{ color: t.sub, fontSize: 12 }}>{s.label}</span>
                  </div>
                  <span style={{ color: s.color, fontSize: 18, fontWeight: 900 }}>{s.value}</span>
                </div>
              ))}
            </div>

            {/* ── Active Batch Cards ─────────────────────── */}
            {showHistory && activeBatches.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ color: lightMode ? "#94a3b8" : "rgba(255,255,255,0.28)", fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                  ACTIVE BATCHES
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {activeBatches.slice(0, 4).map(b => {
                    const pct = b.target > 0 ? Math.min(100, Math.round((b.actual / b.target) * 100)) : 0;
                    const bi  = batchInputs[b.id] || {};
                    const ws  = b.workflowStatus || "production";
                    const bAccent = (prodItems || []).find(p => p.name === b.product)?.color || COLOR;
                    const needsQC = ws === "awaiting_qc";

                    return (
                      <div key={b.id} style={{
                        background: lightMode ? "#f7f8fc" : "rgba(255,255,255,0.03)",
                        border: needsQC
                          ? "1.5px solid rgba(245,158,11,0.4)"
                          : lightMode ? "1px solid rgba(15,23,42,0.08)" : "1px solid rgba(255,255,255,0.07)",
                        borderRadius: 12, padding: "12px",
                        boxShadow: needsQC ? "0 0 16px rgba(245,158,11,0.15)" : "none",
                        transition: "all 0.2s",
                      }}>
                        {/* Batch header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 8 }}>
                          <div>
                            <div style={{ color: t.text, fontSize: 11, fontWeight: 800 }}>{b.product}</div>
                            <div style={{ color: t.muted, fontSize: 9, marginTop: 2 }}>{b.batchLabel}</div>
                          </div>
                          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                            {needsQC && (
                              <div style={{
                                background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.35)",
                                borderRadius: 6, padding: "3px 7px",
                                color: "#F59E0B", fontSize: 9, fontWeight: 800,
                                display: "flex", alignItems: "center", gap: 3,
                              }}>
                                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#F59E0B", display: "inline-block", animation: "pulse 1.5s infinite" }} />
                                QC NEEDED
                              </div>
                            )}
                            {canHold && (
                              <button
                                onClick={() => handleHoldToggle(b)}
                                title="Put on hold"
                                style={{
                                  background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)",
                                  borderRadius: 6, padding: "3px 8px", cursor: "pointer",
                                  color: "#F59E0B", fontSize: 9, fontWeight: 700, fontFamily: "inherit",
                                }}>⏸</button>
                            )}
                          </div>
                        </div>

                        {/* Pipeline steps */}
                        <div style={{ marginBottom: 8 }}>
                          <PipelineSteps status={ws} t={t} accent={bAccent} />
                        </div>

                        {/* Progress bar */}
                        <SProgress value={b.actual} max={b.target || 1} color={bAccent} t={t} showLabel={false} />
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                          <span style={{ color: t.muted, fontSize: 9 }}>{b.actual ?? 0} / {b.target ?? 0} KG</span>
                          <span style={{ color: bAccent, fontSize: 9, fontWeight: 700 }}>{pct}%</span>
                        </div>

                        {/* Manual entry: Pieces Made + Weight */}
                        {ws === "production" && (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10 }}>
                            <div>
                              <div style={{ color: t.muted, fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Pieces Made</div>
                              <input
                                type="number"
                                value={bi.piecesMade ?? ""}
                                onChange={e => setBatchInputs(prev => ({ ...prev, [b.id]: { ...prev[b.id], piecesMade: e.target.value } }))}
                                onBlur={e => {
                                  const val = parseInt(e.target.value, 10) || 0;
                                  setBatches(prev => prev.map(x => x.id === b.id ? { ...x, piecesMade: val } : x));
                                }}
                                placeholder="0" min={0}
                                style={{
                                  width: "100%", background: lightMode ? "#fff" : "rgba(255,255,255,0.06)",
                                  border: `1px solid ${t.border2}`, color: t.text, borderRadius: 7,
                                  padding: "5px 8px", fontSize: 11, outline: "none",
                                  boxSizing: "border-box", fontFamily: "inherit",
                                }}
                              />
                            </div>
                            <div>
                              <div style={{ color: t.muted, fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Weight (KG)</div>
                              <input
                                type="number"
                                value={bi.weight ?? ""}
                                onChange={e => setBatchInputs(prev => ({ ...prev, [b.id]: { ...prev[b.id], weight: e.target.value } }))}
                                onBlur={e => {
                                  const val = parseFloat(e.target.value) || 0;
                                  onProductionProgress({
                                    batchId: b.id,
                                    weight: val,
                                    setBatches,
                                    setActivityLog,
                                    sess,
                                    notify,
                                  });
                                }}
                                placeholder="0" min={0}
                                style={{
                                  width: "100%", background: lightMode ? "#fff" : "rgba(255,255,255,0.06)",
                                  border: `1px solid ${t.border2}`, color: t.text, borderRadius: 7,
                                  padding: "5px 8px", fontSize: 11, outline: "none",
                                  boxSizing: "border-box", fontFamily: "inherit",
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* QC awaiting message */}
                        {needsQC && (
                          <div style={{
                            marginTop: 10, padding: "8px 10px",
                            background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
                            borderRadius: 8, color: "#F59E0B", fontSize: 10, fontWeight: 700,
                            display: "flex", alignItems: "center", gap: 6,
                          }}>
                            <span>🔬</span> Go to QC tab to inspect this batch
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* On-hold batches */}
            {onHoldBatches.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ color: "#F59E0B", fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                  ⏸ ON HOLD ({onHoldBatches.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {onHoldBatches.map(b => (
                    <div key={b.id} style={{
                      background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)",
                      borderRadius: 10, padding: "10px 12px",
                      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                    }}>
                      <div>
                        <div style={{ color: t.text, fontSize: 11, fontWeight: 700 }}>{b.product}</div>
                        <div style={{ color: t.muted, fontSize: 9, marginTop: 2 }}>{b.holdNote || "No reason given"}</div>
                      </div>
                      {canHold && (
                        <button
                          onClick={() => handleHoldToggle(b)}
                          style={{
                            background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)",
                            borderRadius: 7, padding: "5px 10px", cursor: "pointer",
                            color: "#10B981", fontSize: 10, fontWeight: 700, fontFamily: "inherit",
                          }}>▶ Resume</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Confirm Start Sheet ──────────────────────────── */}
        <SSheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title="▶ Confirm Start Production" t={t}>
          <div style={{ color: t.sub, fontSize: 13, marginBottom: 16 }}>
            Review batch details before starting:
          </div>

          {/* Batch details */}
          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 16 }}>
            {[
              { label: "Product",   value: selectedProduct?.name,                    icon: selectedProduct?.icon || "📦" },
              { label: "Quantity",  value: `${quantity.toLocaleString("en-IN")} KG`, icon: "🎯" },
              ...(showMachine ? [{ label: "Machine",    value: machine || "—",     icon: "⚙️" }] : []),
              { label: "Shift",     value: shift || "—",                             icon: "🕐" },
              ...(estTime        ? [{ label: "Est. Time",       value: estTime,        icon: "⏱" }] : []),
              ...(showWorkers && (workersInput || workers) ? [{ label: "Team Members", value: `${workersInput || workers} workers`, icon: "👷" }] : []),
              ...(estCompletion  ? [{ label: "Est. Completion", value: estCompletion,  icon: "🕐" }] : []),
            ].map(r => (
              <div key={r.label} style={{
                display: "flex", alignItems: "center", gap: 12,
                background: t.cardAlt, borderRadius: 10, padding: "11px 14px",
                border: `1px solid ${t.border}`,
              }}>
                <span style={{ fontSize: 16 }}>{r.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: t.muted, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{r.label}</div>
                  <div style={{ color: t.text, fontSize: 13, fontWeight: 700, marginTop: 2 }}>{r.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Ingredient reservation preview */}
          <IngredientReservation
            recipe={productRecipe}
            inventory={inventory}
            quantity={quantity}
            t={t}
          />

          {/* What happens automatically */}
          <div style={{
            background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.18)",
            borderRadius: 12, padding: "12px 14px", marginBottom: 16,
          }}>
            <div style={{ color: "#818cf8", fontSize: 10, fontWeight: 800, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              ⚡ Happens automatically
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                productRecipe.length > 0 && "🧪 Ingredients reserved from inventory",
                "📋 Activity log updated",
                "🏠 Dashboard metrics refresh",
                "📦 Packing tab shows upcoming batch",
                "🔬 QC task created after weight entry",
              ].filter(Boolean).map((item, i) => (
                <div key={i} style={{ color: t.sub, fontSize: 11, display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#818cf8", flexShrink: 0, display: "inline-block" }} />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <SBtn v="primary" color={accent || COLOR} onClick={handleStart} full style={{ fontSize: 14, padding: "14px 0", borderRadius: 12 }}>
            ✅ Confirm & Start Production
          </SBtn>
          <div style={{ height: 10 }} />
          <SBtn v="ghost" color={t.sub} onClick={() => setConfirmOpen(false)} full>Cancel</SBtn>
        </SSheet>

        {/* ── Hold Sheet ───────────────────────────────────── */}
        <SSheet open={!!holdSheetBatch} onClose={() => setHoldSheetBatch(null)} title="⏸ Put Batch On Hold" t={t}>
          <div style={{ color: t.sub, fontSize: 13, marginBottom: 14 }}>
            {holdSheetBatch?.product} · {holdSheetBatch?.batchLabel}
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: t.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
              Reason (optional)
            </div>
            <textarea
              value={holdNote}
              onChange={e => setHoldNote(e.target.value)}
              placeholder="e.g. Machine breakdown, waiting for ingredients…"
              rows={3}
              style={{
                width: "100%", background: lightMode ? "#fff" : "rgba(255,255,255,0.06)",
                border: `1px solid ${t.border2}`, color: t.text,
                borderRadius: 10, padding: "10px 12px", fontSize: 13,
                outline: "none", resize: "vertical", fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
          </div>
          <SBtn v="primary" color="#F59E0B" onClick={handleHoldConfirm} full>⏸ Confirm Hold</SBtn>
          <div style={{ height: 10 }} />
          <SBtn v="ghost" color={t.sub} onClick={() => setHoldSheetBatch(null)} full>Cancel</SBtn>
        </SSheet>

      </>}
    </div>
  );
}
