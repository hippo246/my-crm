// ============================================================
// staff/tabs/ProductionStart.js — v4 Responsive
// 3-panel horizontal layout: Product Grid | Batch Details | Today's Summary
// Stacks to single column on mobile
// ============================================================

import React, { useState, useMemo, useEffect } from "react";
import { TAB_ACCENT } from "../theme.js";
import {
  SBtn, SQtyPicker, SSel,
  SSheet, SHr, SProgress, SDonut,
} from "../components/ui.js";
import { useStore } from "../../lib/store.js";
import { onBatchComplete } from "../../lib/workflowEngine.js";

const COLOR = TAB_ACCENT.production?.solid || "#f97316";
const GRAD  = TAB_ACCENT.production?.gradient || "linear-gradient(135deg,#c2410c,#f97316)";
const GLOW  = TAB_ACCENT.production?.glow || "0 4px 24px rgba(249,115,22,0.4)";

const D_SETTINGS = {
  prodItems: [
    { id: "p1", name: "Malabar Paratha",    icon: "🫓", color: "#F59E0B", unit: "KG", pcs: 1200 },
    { id: "p2", name: "Lachha Paratha",     icon: "🥙", color: "#10B981", unit: "KG", pcs: 1000 },
    { id: "p3", name: "Plain Paratha",      icon: "🍞", color: "#8B5CF6", unit: "KG", pcs: 1500 },
    { id: "p4", name: "Family Pack 20pcs",  icon: "📦", color: "#06b6d4", unit: "KG", pcs: 800  },
    { id: "p5", name: "Mini Paratha",       icon: "🫓", color: "#f97316", unit: "KG", pcs: 1100 },
    { id: "p6", name: "Garlic Paratha",     icon: "🧄", color: "#3b82f6", unit: "KG", pcs: 900  },
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

function genBatchLabel() {
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  return `PR-${new Date().getFullYear()}-${ts}`;
}

function estimateRaw(qty) {
  return `${Math.ceil(qty * 1.08).toLocaleString("en-IN")} KG`;
}

function estimateDuration(qty) {
  const totalMins = Math.ceil(qty / 40);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function estimateCompletion(qty) {
  const mins = Math.ceil(qty / 40);
  const d = new Date(Date.now() + mins * 60000);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// ── Responsive hook ──────────────────────────────────────────
function useIsMobile(bp = 700) {
  const [mobile, setMobile] = useState(() => window.innerWidth < bp);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < bp);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [bp]);
  return mobile;
}

// ─────────────────────────────────────────────────────────────
export function ProductionStartTab({ t, batches = [], setBatches, sess, notify }) {
  const [settings] = useStore("tas10_settings", D_SETTINGS);
  const [, setPackingTasks]  = useStore("tas9_pack", []);
  const [, setProdTargets]   = useStore("tas9_prodtargets", []);

  const prodItems   = settings?.prodItems        ?? D_SETTINGS.prodItems;
  const machines    = settings?.machines         ?? D_SETTINGS.machines;
  const shifts      = settings?.shifts           ?? D_SETTINGS.shifts;
  const unitPresets = settings?.batchUnitPresets ?? D_SETTINGS.batchUnitPresets;
  const workerReq   = settings?.workerRequirements ?? D_SETTINGS.workerRequirements;

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity]               = useState(500);
  const [machine, setMachine]                 = useState("");
  const [shift, setShift]                     = useState("");
  const [confirmOpen, setConfirmOpen]         = useState(false);
  const [search, setSearch]                   = useState("");

  const isMobile = useIsMobile();

  const safe = Array.isArray(batches) ? batches : [];
  const filteredProducts = useMemo(() =>
    (prodItems || []).filter(p =>
      !search || (p.name || "").toLowerCase().includes(search.toLowerCase())
    ), [prodItems, search]);

  const activeBatches    = safe.filter(b => (b.actual ?? 0) < (b.target ?? 0) && !b.onHold);
  const completedBatches = safe.filter(b => (b.actual ?? 0) >= (b.target ?? 0));
  const inProgressCount  = safe.filter(b => (b.actual ?? 0) > 0 && (b.actual ?? 0) < (b.target ?? 0)).length;
  const workers  = workerReq?.[selectedProduct?.id] ?? workerReq?.default ?? 12;
  const isReady  = selectedProduct && quantity > 0 && machine && shift;
  const accent   = selectedProduct?.color || COLOR;

  const totalTarget = safe.reduce((s, b) => s + (b.target ?? 0), 0);
  const totalActual = safe.reduce((s, b) => s + (b.actual ?? 0), 0);
  const overallPct  = totalTarget > 0 ? Math.min(100, Math.round((totalActual / totalTarget) * 100)) : 69;

  const panelStyle = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 18, padding: "18px",
    backdropFilter: "blur(20px)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  };

  const handleStart = () => {
    if (!isReady) { notify("Please complete all fields", "warning"); return; }
    const newBatch = {
      id:         `batch_${Date.now()}`,
      batchLabel: genBatchLabel(),
      product:    selectedProduct.name,
      productId:  selectedProduct.id,
      target:     quantity,
      actual:     0,
      damaged:    0,
      machine,
      shift,
      date:       new Date().toLocaleDateString("en-IN"),
      startedAt:  new Date().toISOString(),
      startedBy:  sess?.name || "Staff",
      onHold:     false,
      status:     "active",
    };
    setBatches(prev => [...(Array.isArray(prev) ? prev : []), newBatch]);

    // ── Mirror to tas9_prodtargets so CRM admin Production tab can see this batch ──
    const prodTarget = {
      id:          newBatch.id,
      batchLabel:  newBatch.batchLabel,
      product:     newBatch.product,
      productId:   newBatch.productId,
      target:      newBatch.target,
      actual:      newBatch.actual,
      damaged:     newBatch.damaged,
      machine:     newBatch.machine,
      shift:       newBatch.shift,
      date:        newBatch.date,
      startedAt:   newBatch.startedAt,
      startedBy:   newBatch.startedBy,
      onHold:      newBatch.onHold,
      status:      newBatch.status,
      source:      "staff_portal",
    };
    setProdTargets(prev => [...(Array.isArray(prev) ? prev : []), prodTarget]);
    notify(`✅ ${newBatch.batchLabel} started — ${selectedProduct.name}`, "success");
    if (newBatch.actual >= newBatch.target) {
      onBatchComplete(newBatch, sess, setPackingTasks, notify);
    }
    setConfirmOpen(false);
    setSelectedProduct(null);
    setQuantity(500);
    setMachine("");
    setShift("");
  };

  return (
    <div style={{ background: t.bg, minHeight: "100vh", padding: isMobile ? "14px" : "20px", animation: "fadeIn 0.3s ease" }}>

      {/* ── Page Header ─────────────────────────────────────── */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: GRAD, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 18, fontWeight: 900, color: "#fff",
          boxShadow: GLOW, flexShrink: 0,
        }}>1</div>
        <div>
          <div style={{ color: t.text, fontSize: isMobile ? 17 : 20, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1 }}>
            Start Production
          </div>
          <div style={{ color: t.sub, fontSize: 12, marginTop: 3 }}>
            Create and start a new production batch
          </div>
        </div>
      </div>

      {/* ── 3-Panel Layout — stacked on mobile, side-by-side on desktop ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr",
        gap: 16, alignItems: "start",
      }}>

        {/* ── PANEL 1: Select Product ──────────────────────── */}
        <div style={panelStyle}>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>
            SELECT PRODUCT
          </div>

          {/* Search */}
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

          {/* Product grid — 2 cols always (3 was too tight even on desktop) */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}>
            {filteredProducts.map(p => {
              const isSel = selectedProduct?.id === p.id;
              const pacc  = p.color || COLOR;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProduct(isSel ? null : p)}
                  style={{
                    background:   isSel ? `${pacc}18` : "rgba(255,255,255,0.03)",
                    border:       `1.5px solid ${isSel ? pacc + "55" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 12, padding: "12px 8px",
                    cursor: "pointer", transition: "all 0.18s", textAlign: "center",
                    boxShadow: isSel ? `0 0 20px ${pacc}25` : "none",
                    position: "relative",
                  }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
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

        {/* ── PANEL 2: Batch Details ───────────────────────── */}
        <div style={{
          ...panelStyle,
          border: `1px solid ${selectedProduct ? accent + "30" : "rgba(255,255,255,0.08)"}`,
          boxShadow: selectedProduct ? `0 8px 32px rgba(0,0,0,0.4), 0 0 40px ${accent}10` : "0 8px 32px rgba(0,0,0,0.4)",
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14 }}>
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
                  onClick={() => setQuantity(v)}
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
            <div style={{ display: "flex", justifyContent: "center" }}>
              <SQtyPicker value={quantity} onChange={setQuantity} min={0} t={t} color={accent || COLOR} />
            </div>
          </div>

          <SHr t={t} />

          <div style={{ marginBottom: 12 }}>
            <div style={{ color: t.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>
              ⚙️ Machine
            </div>
            <SSel
              value={machine}
              onChange={setMachine}
              placeholder="Select machine..."
              options={(machines || []).map(m => ({ value: m, label: m }))}
              t={t}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ color: t.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>
              🕐 Shift
            </div>
            <SSel
              value={shift}
              onChange={setShift}
              placeholder="Select shift..."
              options={(shifts || []).map(s => ({ value: s, label: s }))}
              t={t}
            />
          </div>

          {/* Production Preview */}
          {quantity > 0 && (
            <div style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12, padding: "12px", marginBottom: 16,
            }}>
              <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                PRODUCTION PREVIEW
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { label: "Est. Output",    value: `${(quantity * 10).toLocaleString("en-IN")} pcs`, icon: "📦" },
                  { label: "Est. Time",      value: estimateDuration(quantity),                         icon: "⏱" },
                  { label: "Raw Material",   value: estimateRaw(quantity),                              icon: "🌾" },
                  { label: "Labor Required", value: `${workers} Workers`,                               icon: "👷" },
                  { label: "Est. Completion",value: estimateCompletion(quantity),                       icon: "🕐" },
                ].map(s => (
                  <div key={s.label} style={{
                    background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 10px",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}>
                    <div style={{ color: t.muted, fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{s.label}</div>
                    <div style={{ color: t.text, fontSize: 12, fontWeight: 800 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={() => {
              if (isReady) setConfirmOpen(true);
              else notify("Complete all fields to start", "warning");
            }}
            style={{
              width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
              cursor: isReady ? "pointer" : "not-allowed",
              background: isReady ? GRAD : "rgba(255,255,255,0.06)",
              color: isReady ? "#fff" : t.muted,
              fontWeight: 800, fontSize: 14, fontFamily: "inherit",
              boxShadow: isReady ? GLOW : "none",
              transition: "all 0.2s", display: "flex", alignItems: "center",
              justifyContent: "center", gap: 8,
            }}
          >
            ▶ Start Production
          </button>
        </div>

        {/* ── PANEL 3: Today's Summary ─────────────────────── */}
        <div style={panelStyle}>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16 }}>
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
              { label: "Started Batches",   value: safe.length,              color: COLOR,     icon: "🏭" },
              { label: "Completed Batches", value: completedBatches.length,  color: "#10B981", icon: "✅" },
              { label: "In Progress",       value: inProgressCount,          color: "#F59E0B", icon: "⚡" },
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

          {activeBatches.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                ACTIVE BATCHES
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {activeBatches.slice(0, 4).map(b => {
                  const pct = b.target > 0 ? Math.min(100, Math.round((b.actual / b.target) * 100)) : 0;
                  return (
                    <div key={b.id} style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 10, padding: "10px 12px",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ color: t.text, fontSize: 11, fontWeight: 700 }}>{b.product}</span>
                        <span style={{ color: COLOR, fontSize: 11, fontWeight: 800 }}>{pct}%</span>
                      </div>
                      <SProgress value={b.actual} max={b.target || 1} color={COLOR} t={t} showLabel={false} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Confirm sheet ────────────────────────────────────── */}
      <SSheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title="▶ Confirm Start Production" t={t}>
        <div style={{ color: t.sub, fontSize: 13, marginBottom: 18 }}>
          Review batch details before starting:
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 20 }}>
          {[
            { label: "Product",     value: selectedProduct?.name,                    icon: selectedProduct?.icon || "📦" },
            { label: "Quantity",    value: `${quantity.toLocaleString("en-IN")} KG`, icon: "🎯" },
            { label: "Machine",     value: machine || "—",                            icon: "⚙️" },
            { label: "Shift",       value: shift || "—",                              icon: "🕐" },
            { label: "Raw Input",   value: estimateRaw(quantity),                     icon: "🌾" },
            { label: "Workers",     value: `${workers} staff required`,               icon: "👷" },
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
        <SBtn v="primary" color={accent || COLOR} onClick={handleStart} full style={{ fontSize: 14, padding: "14px 0", borderRadius: 12 }}>
          ✅ Confirm & Start Production
        </SBtn>
        <div style={{ height: 10 }} />
        <SBtn v="ghost" color={t.sub} onClick={() => setConfirmOpen(false)} full>Cancel</SBtn>
      </SSheet>
    </div>
  );
}
