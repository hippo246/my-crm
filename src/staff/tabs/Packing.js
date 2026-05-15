// ============================================================
// staff/tabs/Packing.js — v11  Responsive + Print Label wired
// SELECT BATCH | ENTER QUANTITY | PACKING SUMMARY
// ============================================================

import React, { useState, useEffect } from "react";
import { TAB_ACCENT } from "../theme.js";
import { SQtyPicker, SQtyPresets, SSheet, SDonut } from "../components/ui.js";

const COLOR = TAB_ACCENT.packing.solid;
const GRAD  = TAB_ACCENT.packing.gradient;
const GLOW  = TAB_ACCENT.packing.glow;

function batchAge(startedAt) {
  if (!startedAt) return null;
  const ms = Date.now() - new Date(startedAt).getTime();
  const h  = Math.floor(ms / 3600000);
  const m  = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Responsive hook ──────────────────────────────────────────
function useIsMobile(bp = 640) {
  const [mobile, setMobile] = useState(() => window.innerWidth < bp);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < bp);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [bp]);
  return mobile;
}

// ── Print Label helper ───────────────────────────────────────
function printLabel(batch) {
  const now   = new Date();
  const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const pct   = batch.target > 0 ? Math.round(((batch.actual ?? 0) / batch.target) * 100) : 0;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Packing Label — ${batch.product}</title>
  <style>
    @page { size: 100mm 70mm; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', monospace;
      background: #fff;
      color: #000;
      padding: 8px 10px;
      width: 100mm;
      height: 70mm;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .header {
      border-bottom: 2px solid #000;
      padding-bottom: 4px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .product { font-size: 15px; font-weight: bold; max-width: 65mm; word-break: break-word; }
    .batch   { font-size: 9px; color: #555; margin-top: 2px; }
    .logo    { font-size: 11px; font-weight: bold; text-align: right; }
    .row     { display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0; }
    .label   { color: #555; }
    .value   { font-weight: bold; }
    .bar-wrap { background: #eee; border-radius: 3px; height: 7px; width: 100%; margin: 3px 0; }
    .bar-fill { background: #000; height: 100%; border-radius: 3px; }
    .footer  { border-top: 1px dashed #aaa; padding-top: 4px; font-size: 8px; color: #888; display: flex; justify-content: space-between; margin-top: auto; }
    .barcode { font-size: 7px; letter-spacing: 3px; text-align: center; margin-top: 2px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="product">${batch.product || "—"}</div>
      <div class="batch">Batch: ${batch.batchLabel || batch.id || "—"}</div>
    </div>
    <div class="logo">📦<br/>PACKING</div>
  </div>

  <div class="row">
    <span class="label">Packed:</span>
    <span class="value">${(batch.actual ?? 0).toLocaleString("en-IN")} pcs</span>
  </div>
  <div class="row">
    <span class="label">Target:</span>
    <span class="value">${(batch.target ?? 0).toLocaleString("en-IN")} pcs</span>
  </div>
  <div class="row">
    <span class="label">Remaining:</span>
    <span class="value">${Math.max(0, (batch.target ?? 0) - (batch.actual ?? 0)).toLocaleString("en-IN")} pcs</span>
  </div>
  ${(batch.damaged ?? 0) > 0 ? `
  <div class="row">
    <span class="label">Damaged:</span>
    <span class="value">${batch.damaged} pcs</span>
  </div>` : ""}

  <div class="bar-wrap">
    <div class="bar-fill" style="width:${pct}%"></div>
  </div>
  <div style="text-align:right;font-size:9px;color:#555;">${pct}% complete</div>

  <div class="barcode">||| ${(batch.batchLabel || batch.id || "").toUpperCase()} |||</div>

  <div class="footer">
    <span>Printed: ${dateStr} ${timeStr}</span>
    <span>${batch.onHold ? "⚠ ON HOLD" : pct >= 100 ? "✓ COMPLETE" : "IN PROGRESS"}</span>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=420,height=320");
  if (!win) { alert("Pop-up blocked — allow pop-ups to print labels."); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  // Small delay to let the window render before printing
  setTimeout(() => { win.print(); win.close(); }, 400);
}

export function PackingTab({ t, batches = [], setBatches, sess, notify }) {
  const [activeBatchId, setActiveBatchId] = useState(null);
  const [qty, setQty]                     = useState(0);
  const [damage, setDamage]               = useState(0);

  const [logOpen, setLogOpen] = useState(false);

  const [damageOpen, setDamageOpen]     = useState(false);
  const [damageTarget, setDamageTarget] = useState(null);
  const [damageQty, setDamageQty]       = useState(0);
  const [holdOpen, setHoldOpen]         = useState(false);
  const [holdTarget, setHoldTarget]     = useState(null);
  const [holdNote, setHoldNote]         = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("active");

  const isMobile = useIsMobile();

  const safe = Array.isArray(batches) ? batches : [];

  const activeBatches    = safe.filter(b => (b.actual ?? 0) < (b.target ?? 0) && !b.onHold);
  const completedBatches = safe.filter(b => (b.actual ?? 0) >= (b.target ?? 0));
  const holdBatches      = safe.filter(b => !!b.onHold);
  const counts = { active: activeBatches.length, completed: completedBatches.length, hold: holdBatches.length };

  const filtered = safe.filter(b => {
    if (!b) return false;
    const q = search.toLowerCase();
    const match = !q || (b.product || "").toLowerCase().includes(q) || (b.batchLabel || b.id || "").toLowerCase().includes(q);
    if (!match) return false;
    if (filter === "active")    return (b.actual ?? 0) < (b.target ?? 0) && !b.onHold;
    if (filter === "completed") return (b.actual ?? 0) >= (b.target ?? 0);
    if (filter === "hold")      return !!b.onHold;
    return true;
  });

  const activeBatch   = safe.find(b => b.id === activeBatchId) ?? null;
  const remaining     = activeBatch ? Math.max(0, (activeBatch.target ?? 0) - (activeBatch.actual ?? 0)) : 0;
  const pct           = activeBatch && (activeBatch.target ?? 0) > 0
    ? Math.min(100, Math.round(((activeBatch.actual ?? 0) / activeBatch.target) * 100))
    : 0;
  const totalProduced = activeBatch ? (activeBatch.actual ?? 0) : 0;
  const age           = activeBatch ? batchAge(activeBatch.startedAt) : null;

  const selectBatch = (b) => {
    setActiveBatchId(b.id);
    setQty(0);
    setDamage(0);
    setLogOpen(false);
  };

  const handleLogEntry = () => {
    if (!activeBatch)    { notify("Select a batch first", "warning"); return; }
    if (qty <= 0)        { notify("Enter packed quantity", "warning"); return; }
    if (qty > remaining) { notify("Exceeds remaining quantity", "warning"); return; }
    const newActual = (activeBatch.actual ?? 0) + qty;
    setBatches(prev => (Array.isArray(prev) ? prev : []).map(b =>
      b.id === activeBatchId
        ? { ...b, actual: newActual, damaged: (b.damaged ?? 0) + damage }
        : b
    ));
    notify(`✅ Logged ${qty} packed for ${activeBatch.product}`, "success");
    setQty(0);
    setDamage(0);
  };

  const handleComplete = (batch) => {
    setBatches(prev => (Array.isArray(prev) ? prev : []).map(b =>
      b.id === batch.id ? { ...b, actual: b.target, completedAt: new Date().toISOString() } : b
    ));
    notify(`✅ ${batch.product} packing completed`, "success");
    if (activeBatchId === batch.id) { setActiveBatchId(null); setQty(0); setDamage(0); }
  };

  const handleDamage = () => {
    if (!damageTarget || damageQty <= 0) { notify("Enter damage qty", "warning"); return; }
    setBatches(prev => (Array.isArray(prev) ? prev : []).map(b =>
      b.id === damageTarget.id ? { ...b, damaged: (b.damaged ?? 0) + damageQty } : b
    ));
    notify(`⚠ ${damageQty} damaged logged`, "error");
    setDamageQty(0); setDamageOpen(false);
  };

  const handleHold = () => {
    if (!holdTarget) return;
    setBatches(prev => (Array.isArray(prev) ? prev : []).map(b =>
      b.id === holdTarget.id ? { ...b, onHold: !b.onHold, holdNote } : b
    ));
    notify(holdTarget.onHold ? "Batch resumed" : "⏸ Batch on hold", holdTarget.onHold ? "success" : "warning");
    if (activeBatchId === holdTarget.id && !holdTarget.onHold) setActiveBatchId(null);
    setHoldNote(""); setHoldOpen(false);
  };

  const handlePrintLabel = () => {
    if (!activeBatch) { notify("Select a batch first", "warning"); return; }
    try {
      printLabel(activeBatch);
      notify("🖨 Label sent to printer", "success");
    } catch (e) {
      notify("Could not open print window", "error");
    }
  };

  const glassPanel = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16, padding: 18,
    backdropFilter: "blur(20px)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
  };

  const inp = {
    width: "100%", background: "rgba(255,255,255,0.05)",
    border: "1.5px solid rgba(255,255,255,0.1)", color: t.text,
    borderRadius: 9, padding: "9px 12px", fontSize: 13,
    outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  };

  return (
    <div style={{ background: t.bg, minHeight: "100vh", padding: isMobile ? 14 : 20, animation: "fadeIn 0.3s ease" }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: GRAD,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 900, color: "#fff", boxShadow: GLOW,
          }}>2</div>
          <div>
            <div style={{ color: t.text, fontSize: isMobile ? 17 : 20, fontWeight: 900 }}>Packing Entry</div>
            <div style={{ color: t.sub, fontSize: 12, marginTop: 2 }}>Quick packing entry for finished batches</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setLogOpen(true)}
            style={{
              padding: "11px 22px", borderRadius: 12, border: "none",
              background: GRAD, color: "#fff", fontWeight: 800, fontSize: 14,
              cursor: "pointer", fontFamily: "inherit", boxShadow: GLOW,
              display: "flex", alignItems: "center", gap: 8,
            }}
            onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.1)"}
            onMouseLeave={e => e.currentTarget.style.filter = ""}
          >📦 Log Entry</button>
        </div>
      </div>

      {/* ── Summary strip — 2 cols on mobile, 3 on desktop ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(3,1fr)",
        gap: 10, marginBottom: 20,
      }}>
        {[
          { label: "Active Batches",  value: counts.active,    color: COLOR,     icon: "⚡" },
          { label: "Completed Today", value: counts.completed, color: "#10B981", icon: "✅" },
          { label: "On Hold",         value: counts.hold,      color: "#F59E0B", icon: "⏸" },
        ].map((s, idx) => (
          <div key={s.label} style={{
            ...glassPanel, padding: "14px 16px", textAlign: "center",
            border: `1px solid ${s.color}20`,
            // On mobile, make the 3rd card span full width
            ...(isMobile && idx === 2 ? { gridColumn: "1 / -1" } : {}),
          }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ color: s.color, fontSize: 26, fontWeight: 900 }}>{s.value}</div>
            <div style={{ color: t.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ══ ALWAYS-VISIBLE PANELS — stacked on mobile, 3-col on desktop ══ */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr",
        gap: 14, marginBottom: 20,
      }}>

        {/* ── PANEL 1: Select Batch ──────────────────────────── */}
        <div style={glassPanel}>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14 }}>
            SELECT BATCH
          </div>

          {activeBatch ? (
            <div>
              <div style={{
                background: `${COLOR}12`, border: `1.5px solid ${COLOR}40`,
                borderRadius: 12, padding: "14px", marginBottom: 12, cursor: "pointer",
              }} onClick={() => setLogOpen(true)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ color: t.text, fontWeight: 800, fontSize: 15 }}>{activeBatch.product}</div>
                    <div style={{ color: COLOR, fontSize: 11, fontWeight: 700, marginTop: 2 }}>
                      Active {age ? `· Started ${age} ago` : ""}
                    </div>
                  </div>
                  <span style={{ color: t.muted, fontSize: 10, fontFamily: "monospace" }}>
                    {activeBatch.batchLabel || activeBatch.id}
                  </span>
                </div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 999, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: COLOR, borderRadius: 999, boxShadow: `0 0 8px ${COLOR}60`, transition: "width 0.4s" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: t.sub, fontSize: 11 }}>Packed: <strong style={{ color: t.text }}>{totalProduced}</strong></span>
                  <span style={{ color: COLOR, fontSize: 11, fontWeight: 800 }}>{pct}%</span>
                </div>
              </div>

              <button
                onClick={() => setLogOpen(true)}
                style={{
                  width: "100%", padding: "8px", borderRadius: 9,
                  border: `1px solid ${COLOR}30`, background: "transparent",
                  color: COLOR, fontSize: 12, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >Change Batch ↓</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "30px 16px", gap: 12 }}>
              <div style={{ fontSize: 36, opacity: 0.2 }}>📦</div>
              <div style={{ color: t.muted, fontSize: 13, textAlign: "center" }}>No batch selected</div>
              <button
                onClick={() => setLogOpen(true)}
                style={{
                  padding: "10px 20px", borderRadius: 10, border: "none",
                  background: GRAD, color: "#fff", fontWeight: 800, fontSize: 13,
                  cursor: "pointer", fontFamily: "inherit", boxShadow: GLOW,
                }}
              >Select Batch</button>
            </div>
          )}
        </div>

        {/* ── PANEL 2: Enter Quantity ────────────────────────── */}
        <div style={glassPanel}>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14 }}>
            ENTER QUANTITY
          </div>

          {activeBatch ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: t.muted, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Total Produced</div>
                  <div style={{ color: t.text, fontSize: 20, fontWeight: 900, marginTop: 4 }}>{totalProduced.toLocaleString("en-IN")}<span style={{ fontSize: 11, color: t.sub, marginLeft: 4 }}>pcs</span></div>
                </div>
              </div>

              <div style={{ color: t.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Packed Quantity</div>

              <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                <SQtyPicker value={qty} onChange={setQty} min={0} max={remaining} t={t} color={COLOR} />
              </div>

              <div style={{ color: t.sub, fontSize: 11, fontWeight: 600, marginBottom: 8 }}>Quick Add</div>
              <SQtyPresets
                presets={[50, 100, 200, 500]}
                onSelect={v => setQty(q => Math.min(q + v, remaining))}
                color={COLOR} t={t}
              />

              <div style={{ marginTop: 14 }}>
                <div style={{ color: t.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Damage / Short (optional)</div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <SQtyPicker value={damage} onChange={setDamage} min={0} t={t} color="#ef4444" />
                </div>
              </div>

              <button
                onClick={handleLogEntry}
                style={{
                  width: "100%", marginTop: 16, padding: "13px 0", borderRadius: 11, border: "none",
                  background: qty > 0 ? GRAD : "rgba(255,255,255,0.06)",
                  color: qty > 0 ? "#fff" : t.muted,
                  fontWeight: 800, fontSize: 14, fontFamily: "inherit",
                  cursor: qty > 0 ? "pointer" : "not-allowed",
                  boxShadow: qty > 0 ? GLOW : "none",
                  transition: "all 0.2s",
                }}
              >Complete Packing</button>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", opacity: 0.35 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>—</div>
              <div style={{ color: t.muted, fontSize: 12 }}>Select a batch first</div>
            </div>
          )}
        </div>

        {/* ── PANEL 3: Packing Summary ───────────────────────── */}
        <div style={glassPanel}>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14 }}>
            PACKING SUMMARY
          </div>

          {activeBatch ? (
            <>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
                <SDonut pct={pct} color={COLOR} size={90} t={t} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Packed",         value: `${totalProduced.toLocaleString("en-IN")} pcs`, color: t.text },
                  { label: "Remaining",      value: `${remaining.toLocaleString("en-IN")} pcs`,     color: COLOR  },
                  { label: "Damage / Short", value: `${(activeBatch.damaged ?? 0)} pcs`,             color: (activeBatch.damaged ?? 0) > 0 ? "#ef4444" : t.muted },
                ].map(s => (
                  <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ color: t.sub, fontSize: 12 }}>{s.label}</span>
                    <span style={{ color: s.color, fontSize: 14, fontWeight: 800 }}>{s.value}</span>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                <button
                  onClick={handlePrintLabel}
                  style={{
                    flex: 1, padding: "9px 0", borderRadius: 9,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.04)", color: t.sub,
                    fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    minHeight: 38,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; e.currentTarget.style.color = t.text; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = t.sub; }}
                >🖨 Print Label</button>

                <button onClick={() => { setDamageTarget(activeBatch); setDamageQty(0); setDamageOpen(true); }} style={{
                  flex: 1, padding: "9px 0", borderRadius: 9,
                  border: "1px solid rgba(239,68,68,0.25)",
                  background: "rgba(239,68,68,0.07)", color: "#ef4444",
                  fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  minHeight: 38,
                }}>⚠ Damage</button>

                <button onClick={() => { setHoldTarget(activeBatch); setHoldNote(""); setHoldOpen(true); }} style={{
                  flex: 1, padding: "9px 0", borderRadius: 9,
                  border: "1px solid rgba(245,158,11,0.25)",
                  background: "rgba(245,158,11,0.07)", color: "#F59E0B",
                  fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  minHeight: 38,
                }}>{activeBatch.onHold ? "▶ Resume" : "⏸ Hold"}</button>
              </div>

              {remaining === 0 && (
                <button onClick={() => handleComplete(activeBatch)} style={{
                  width: "100%", marginTop: 10, padding: "11px 0", borderRadius: 11, border: "none",
                  background: "linear-gradient(135deg,#047857,#10B981)", color: "#fff",
                  fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                }}>✅ Mark as Complete</button>
              )}
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", opacity: 0.35 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
              <div style={{ color: t.muted, fontSize: 12 }}>No data yet</div>
            </div>
          )}
        </div>
      </div>
      {/* END PANELS */}

      {/* ── Filter + Search ────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: t.muted, pointerEvents: "none" }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search batches..." style={{ ...inp, paddingLeft: 30 }} />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[{ k: "active", l: `Active (${counts.active})` }, { k: "completed", l: `Done (${counts.completed})` }, { k: "hold", l: `Hold (${counts.hold})` }].map(f => (
            <button key={f.k} onClick={() => setFilter(f.k)} style={{
              padding: "8px 14px", borderRadius: 9, border: "none",
              cursor: "pointer", fontFamily: "inherit", fontSize: 11, fontWeight: 700,
              background: filter === f.k ? GRAD : "rgba(255,255,255,0.05)",
              color: filter === f.k ? "#fff" : t.sub,
              minHeight: 36,
            }}>{f.l}</button>
          ))}
        </div>
      </div>

      {/* ── Batch list ─────────────────────────────────────── */}
      {safe.length === 0 ? (
        <div style={{ ...glassPanel, padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 12, opacity: 0.2 }}>📦</div>
          <div style={{ color: t.text, fontWeight: 800, fontSize: 16, marginBottom: 6 }}>No batches yet</div>
          <div style={{ color: t.sub, fontSize: 13 }}>Start a production batch first, then log packing here</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ ...glassPanel, padding: 28, textAlign: "center" }}>
          <div style={{ color: t.muted, fontSize: 13 }}>No batches match your filter</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(b => {
            const bPct    = (b.target ?? 0) > 0 ? Math.min(100, Math.round(((b.actual ?? 0) / b.target) * 100)) : 0;
            const bColor  = bPct >= 100 ? "#10B981" : bPct >= 80 ? "#f97316" : COLOR;
            const rem     = Math.max(0, (b.target ?? 0) - (b.actual ?? 0));
            const bAge    = batchAge(b.startedAt);
            const isActive = activeBatchId === b.id;
            return (
              <div key={b.id} style={{
                ...glassPanel,
                borderLeft: `4px solid ${isActive ? COLOR : bColor}`,
                background: isActive ? `${COLOR}08` : "rgba(255,255,255,0.03)",
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr auto",
                gap: 16, alignItems: "center",
              }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ color: t.text, fontWeight: 800, fontSize: 14 }}>{b.product}</span>
                    <span style={{ color: t.muted, fontSize: 10, fontFamily: "monospace" }}>{b.batchLabel || b.id}</span>
                    {isActive && <span style={{ background: `${COLOR}20`, color: COLOR, border: `1px solid ${COLOR}40`, borderRadius: 6, padding: "2px 7px", fontSize: 9, fontWeight: 700 }}>SELECTED</span>}
                    {b.onHold && <span style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 6, padding: "2px 7px", fontSize: 9, fontWeight: 700 }}>HOLD</span>}
                    {bAge && <span style={{ color: t.muted, fontSize: 10 }}>{bAge} ago</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${bPct}%`, background: bColor, borderRadius: 999, transition: "width 0.4s", boxShadow: `0 0 8px ${bColor}60` }} />
                    </div>
                    <span style={{ color: bColor, fontSize: 12, fontWeight: 800, minWidth: 36 }}>{bPct}%</span>
                  </div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <span style={{ color: t.sub, fontSize: 11 }}>Packed: <strong style={{ color: t.text }}>{(b.actual ?? 0).toLocaleString("en-IN")}</strong></span>
                    <span style={{ color: t.sub, fontSize: 11 }}>Target: <strong style={{ color: t.text }}>{(b.target ?? 0).toLocaleString("en-IN")}</strong></span>
                    <span style={{ color: t.sub, fontSize: 11 }}>Remaining: <strong style={{ color: rem === 0 ? "#10B981" : COLOR }}>{rem.toLocaleString("en-IN")}</strong></span>
                    {(b.damaged ?? 0) > 0 && <span style={{ color: "#ef4444", fontSize: 11 }}>Damage: <strong>{b.damaged}</strong></span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 7, flexShrink: 0, flexWrap: "wrap" }}>
                  <button onClick={() => selectBatch(b)} style={{
                    padding: "8px 14px", borderRadius: 9, border: "none",
                    background: isActive ? "rgba(255,255,255,0.08)" : GRAD,
                    color: "#fff", fontWeight: 700, fontSize: 12,
                    cursor: "pointer", fontFamily: "inherit",
                    boxShadow: isActive ? "none" : GLOW,
                    minHeight: 36,
                  }}>{isActive ? "Selected ✓" : "+ Log"}</button>
                  {rem === 0 && (
                    <button onClick={() => handleComplete(b)} style={{
                      padding: "8px 14px", borderRadius: 9, border: "none",
                      background: "linear-gradient(135deg,#047857,#10B981)", color: "#fff",
                      fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                      minHeight: 36,
                    }}>✅ Complete</button>
                  )}
                  <button onClick={() => { setDamageTarget(b); setDamageQty(0); setDamageOpen(true); }} style={{
                    padding: "8px 12px", borderRadius: 9, border: "1px solid rgba(239,68,68,0.25)",
                    background: "rgba(239,68,68,0.08)", color: "#ef4444",
                    fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                    minHeight: 36, minWidth: 36,
                  }}>⚠</button>
                  <button onClick={() => { setHoldTarget(b); setHoldNote(""); setHoldOpen(true); }} style={{
                    padding: "8px 12px", borderRadius: 9, border: "1px solid rgba(245,158,11,0.25)",
                    background: "rgba(245,158,11,0.08)", color: "#F59E0B",
                    fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                    minHeight: 36, minWidth: 36,
                  }}>{b.onHold ? "▶" : "⏸"}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ LOG ENTRY SHEET — Batch Selector ══════════════════ */}
      <SSheet open={logOpen} onClose={() => setLogOpen(false)} title="📦 Select Batch" t={t}>
        <div style={{ marginBottom: 8 }}>
          {activeBatches.length === 0 ? (
            <div style={{ color: t.muted, fontSize: 13, padding: "20px 0", textAlign: "center" }}>
              No active batches. Start a production batch first.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {activeBatches.map(b => {
                const bPct  = (b.target ?? 0) > 0 ? Math.min(100, Math.round(((b.actual ?? 0) / b.target) * 100)) : 0;
                const isSel = activeBatchId === b.id;
                return (
                  <div key={b.id} onClick={() => selectBatch(b)} style={{
                    padding: "13px 15px", borderRadius: 12,
                    border: `1.5px solid ${isSel ? COLOR + "60" : "rgba(255,255,255,0.08)"}`,
                    background: isSel ? `${COLOR}12` : "rgba(255,255,255,0.03)",
                    cursor: "pointer", transition: "all 0.15s",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                      <span style={{ color: t.text, fontWeight: 700, fontSize: 14 }}>{b.product}</span>
                      <span style={{ color: t.muted, fontSize: 10, fontFamily: "monospace" }}>{b.batchLabel || b.id}</span>
                    </div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 999, overflow: "hidden", marginBottom: 5 }}>
                      <div style={{ height: "100%", width: `${bPct}%`, background: COLOR, borderRadius: 999 }} />
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                      <span style={{ color: t.sub, fontSize: 11 }}>Packed: <strong style={{ color: t.text }}>{b.actual ?? 0}</strong></span>
                      <span style={{ color: t.sub, fontSize: 11 }}>Remaining: <strong style={{ color: COLOR }}>{Math.max(0, (b.target ?? 0) - (b.actual ?? 0))}</strong></span>
                      <span style={{ color: COLOR, fontSize: 11, fontWeight: 700 }}>{bPct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SSheet>

      {/* ── Damage sheet ───────────────────────────────────── */}
      <SSheet open={damageOpen} onClose={() => setDamageOpen(false)} title="⚠ Log Damage" t={t}>
        <div style={{ color: t.sub, fontSize: 13, marginBottom: 16 }}>
          Record damaged units for <strong style={{ color: t.text }}>{damageTarget?.product}</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <SQtyPicker value={damageQty} onChange={setDamageQty} min={0} t={t} color="#ef4444" />
        </div>
        <SQtyPresets presets={[1, 5, 10, 25]} onSelect={v => setDamageQty(q => q + v)} color="#ef4444" t={t} />
        <div style={{ height: 16 }} />
        <button onClick={handleDamage} style={{
          width: "100%", padding: "13px 0", borderRadius: 11, border: "none",
          background: "linear-gradient(135deg,#b91c1c,#ef4444)", color: "#fff",
          fontWeight: 800, fontSize: 14, fontFamily: "inherit", cursor: "pointer",
        }}>Confirm {damageQty} Damaged</button>
      </SSheet>

      {/* ── Hold sheet ─────────────────────────────────────── */}
      <SSheet open={holdOpen} onClose={() => setHoldOpen(false)} title="⏸ Hold Batch" t={t}>
        <div style={{ color: t.sub, fontSize: 13, marginBottom: 14 }}>
          {holdTarget?.onHold ? "Resume" : "Hold"} batch: <strong style={{ color: t.text }}>{holdTarget?.product}</strong>
        </div>
        {!holdTarget?.onHold && (
          <textarea value={holdNote} onChange={e => setHoldNote(e.target.value)} placeholder="Reason for hold..."
            style={{
              width: "100%", background: "rgba(255,255,255,0.04)",
              border: "1.5px solid rgba(255,255,255,0.08)", color: t.text,
              borderRadius: 10, padding: "11px 13px", fontSize: 13,
              outline: "none", minHeight: 80, resize: "vertical",
              fontFamily: "inherit", marginBottom: 14, boxSizing: "border-box",
            }}
          />
        )}
        <button onClick={handleHold} style={{
          width: "100%", padding: "13px 0", borderRadius: 11, border: "none",
          background: "linear-gradient(135deg,#b45309,#F59E0B)", color: "#fff",
          fontWeight: 800, fontSize: 14, fontFamily: "inherit", cursor: "pointer",
        }}>{holdTarget?.onHold ? "▶ Resume Batch" : "⏸ Confirm Hold"}</button>
      </SSheet>
    </div>
  );
}
