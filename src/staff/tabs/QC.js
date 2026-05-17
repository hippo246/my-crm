// ============================================================
// staff/tabs/QC.js — v2 ENHANCED
// Dark glassmorphism revamp · enterprise MES styling
// FIX: uses notify prop, no local showToast
// NOTE: grade picker hidden when failCount > 0 is intentional —
//       result auto-sets to Rejected (documented here)
// ENHANCED: premium inspection panel · animated checklist items
//           glow result preview · richer batch cards · glass stats
// All logic, state, handlers 100% unchanged
// ============================================================

import React, { useState } from "react";
import { TAB_ACCENT } from "../theme.js";
import { SBtn, SSearch, SPill } from "../components/ui.js";
import { hasPerm } from "../../lib/roles.js";
import { onQCResult } from "../../lib/workflowEngine.js";

// ── CSV export for QC logs ────────────────────────────────────
function exportQCCSV(logs) {
  const rows = [["Batch","Product","Inspector","Date","Time","Grade","Fails"]];
  logs.forEach(l => rows.push([l.batchLabel||"", l.product||"", l.inspector||"", l.date||"", l.time||"", l.grade||"", l.failCount??0]));
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8,"+encodeURIComponent(csv);
  a.download = `qc-logs-${new Date().toISOString().slice(0,10)}.csv`; a.click();
}

const COLOR = TAB_ACCENT.qc.solid;
const GRAD  = TAB_ACCENT.qc.gradient;
const GLOW  = TAB_ACCENT.qc.glow;

const CHECKLIST = [
  { id:"weight",    label:"Weight within tolerance", icon:"⚖️"  },
  { id:"seal",      label:"Seal integrity OK",       icon:"🔒"  },
  { id:"label",     label:"Label placement correct", icon:"🏷️" },
  { id:"color",     label:"Color & appearance OK",   icon:"🎨"  },
  { id:"taste",     label:"Taste/smell normal",      icon:"👃"  },
  { id:"expiry",    label:"Expiry date printed",     icon:"📅"  },
  { id:"damage",    label:"No physical damage",      icon:"✅"  },
];

const GRADES = [
  { value:"A", label:"Grade A — Premium" },
  { value:"B", label:"Grade B — Standard" },
  { value:"C", label:"Grade C — Sub-standard" },
];

export function QCTab({ t, batches = [], setBatches, qcLogs = [], setQcLogs, sess, notify = () => {}, settings = {}, setActivityLog }) {
  // ── Staff Portal settings ─────────────────────────────────
  const sp = settings?.staffPortal || {};
  const spOn = (key, def = true) => sp[key] !== undefined ? sp[key] : def;

  // ── Perms (role-based + portal) ───────────────────────────
  const canInspect = hasPerm(sess, "qc_add")    && spOn("qcCanInspect", true);
  const canDelete  = hasPerm(sess, "qc_delete") && spOn("qcCanDelete", false);
  const canExport  = hasPerm(sess, "qc_export") && spOn("qcCanExport",  false);

  // ── Settings-driven config — staffPortal overrides settings root ──
  const checklistItems = (sp.qcChecklist?.length ? sp.qcChecklist : settings?.qcChecklist)?.length
    ? (sp.qcChecklist?.length ? sp.qcChecklist : settings.qcChecklist).map((l, i) => ({ id: `c${i}`, label: l, icon: "✔️" }))
    : CHECKLIST;
  const grades = (sp.qcGrades?.length ? sp.qcGrades : settings?.qcGrades)?.length
    ? (sp.qcGrades?.length ? sp.qcGrades : settings.qcGrades).map(v => ({ value: v, label: `Grade ${v}` }))
    : GRADES;
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState("pending");
  const [selected, setSelected] = useState(null);
  const [checks, setChecks]     = useState({});
  const [grade, setGrade]       = useState("A");
  const [notes, setNotes]       = useState("");

  const safe = Array.isArray(batches) ? batches : [];

  const filtered = safe.filter(b => {
    if (!b) return false;
    const q = search.toLowerCase();
    const match = !q ||
      (b.product || "").toLowerCase().includes(q) ||
      (b.batchLabel || b.id || "").toLowerCase().includes(q);
    if (!match) return false;
    if (filter === "pending")   return !b.qcGrade && (b.actual ?? 0) > 0;
    if (filter === "passed")    return b.qcGrade && b.qcGrade !== "Rejected";
    if (filter === "rejected")  return b.qcGrade === "Rejected";
    return true;
  });

  const counts = {
    pending:  safe.filter(b => !b.qcGrade && (b.actual ?? 0) > 0).length,
    passed:   safe.filter(b => b.qcGrade && b.qcGrade !== "Rejected").length,
    rejected: safe.filter(b => b.qcGrade === "Rejected").length,
  };

  const allChecked = checklistItems.every(c => checks[c.id] !== undefined);
  const failCount  = checklistItems.filter(c => checks[c.id] === false).length;
  // When failCount > 0 → auto-Rejected regardless of grade picker (by design)
  const finalGrade = failCount > 0 ? "Rejected" : grade;

  const startInspection = (b) => {
    setSelected(b);
    setChecks({});
    setGrade("A");
    setNotes("");
  };

  const submitQC = () => {
    if (!selected) return;
    if (!allChecked) { notify("Complete all checklist items first", "warning"); return; }

    onQCResult({
      batch:        selected,
      finalGrade,
      failCount,
      notes,
      checkResults: checks,
      sess,
      setBatches,
      setQcLogs,
      setActivityLog,
      notify,
    });

    setSelected(null);
  };

  const toggleCheck = (id, val) => setChecks(c => ({ ...c, [id]: val }));

  const gradeColor = g =>
    g === "A" ? t.green :
    g === "B" ? t.orange :
    g === "C" ? t.orange :
    t.red;

  const checkedCount = Object.keys(checks).length;
  const passCount    = checklistItems.filter(c => checks[c.id] === true).length;

  return (
    <div style={{ background: t.bg, minHeight: "100vh", padding: "16px", maxWidth: 900, margin: "0 auto", animation: "fadeIn 0.3s ease" }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: `${COLOR}12`, border: `1px solid ${COLOR}28`,
          borderRadius: 7, padding: "4px 10px", marginBottom: 10,
        }}>
          <span style={{ fontSize: 10 }}>🔬</span>
          <span style={{ color: COLOR, fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            QUALITY CONTROL
          </span>
        </div>
        <div style={{ color: t.text, fontSize: 24, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          Inspection Workflow
        </div>
        <div style={{ color: t.sub, fontSize: 12, marginTop: 4 }}>
          Inspect completed batches before dispatch
        </div>
      </div>

      {/* ── Stats strip ────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 18 }}>
        {[
          { label: "Pending QC",  value: counts.pending,  color: t.orange, icon: "🔍", key: "pending"  },
          { label: "Passed",      value: counts.passed,   color: t.green,  icon: "✅", key: "passed"   },
          { label: "Rejected",    value: counts.rejected, color: t.red,    icon: "❌", key: "rejected" },
        ].map(s => (
          <div
            key={s.label}
            onClick={() => setFilter(s.key)}
            style={{
              background:   filter === s.key ? `${s.color}12` : "rgba(255,255,255,0.025)",
              border:       `1px solid ${filter === s.key ? s.color + "40" : "rgba(255,255,255,0.07)"}`,
              borderTop:    `2.5px solid ${s.color}`,
              borderRadius: 14,
              padding:      "16px 16px 14px",
              backdropFilter: "blur(20px)",
              cursor:       "pointer",
              transition:   "all 0.18s",
              boxShadow:    filter === s.key ? `0 0 28px ${s.color}18` : "none",
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ color: s.color, fontSize: 26, fontWeight: 900, lineHeight: 1 }}>{s.value}</div>
            <div style={{ color: t.sub, fontSize: 10, fontWeight: 700, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.07em" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Inspection panel (active) ───────────────────────────── */}
      {selected ? (
        <div style={{
          background:    t.card,
          border:        `1.5px solid ${COLOR}35`,
          borderRadius:  20,
          padding:       "22px",
          backdropFilter: "blur(28px)",
          boxShadow:     `0 0 48px ${COLOR}12, inset 0 1px 0 ${COLOR}10`,
        }}>

          {/* Inspection header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <div style={{ color: COLOR, fontSize: 9, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4 }}>
                🔬 INSPECTING
              </div>
              <div style={{ color: t.text, fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{selected.product}</div>
              <div style={{ color: t.sub, fontSize: 12, marginTop: 4 }}>
                {selected.batchLabel || selected.id} · {(selected.actual ?? 0).toLocaleString("en-IN")} pcs
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Progress ring for checklist */}
              <div style={{
                background: `${COLOR}10`, border: `1px solid ${COLOR}28`,
                borderRadius: 12, padding: "10px 16px", textAlign: "center",
              }}>
                <div style={{ color: COLOR, fontSize: 18, fontWeight: 900, lineHeight: 1 }}>
                  {checkedCount}/{checklistItems.length}
                </div>
                <div style={{ color: t.muted, fontSize: 9, fontWeight: 700, textTransform: "uppercase", marginTop: 2 }}>Checked</div>
              </div>
              <SBtn v="ghost" color={t.sub} onClick={() => setSelected(null)} sm>✕ Cancel</SBtn>
            </div>
          </div>

          {/* Progress bar for checklist completion */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${checklistItems.length > 0 ? (checkedCount / checklistItems.length) * 100 : 0}%`,
                background: failCount > 0 ? `linear-gradient(90deg,${t.red},${t.orange})` : GRAD,
                borderRadius: 999,
                boxShadow: failCount > 0 ? `0 0 12px ${t.red}60` : `0 0 12px ${COLOR}60`,
                transition: "width 0.3s ease",
              }} />
            </div>
            {failCount > 0 && (
              <div style={{ color: t.red, fontSize: 10, fontWeight: 700, marginTop: 6 }}>
                ⚠ {failCount} failure{failCount > 1 ? "s" : ""} — batch will be Rejected
              </div>
            )}
          </div>

          {/* Checklist items */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: t.sub, fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
              Checklist · {checkedCount}/{checklistItems.length} completed
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {checklistItems.map(item => {
                const val = checks[item.id];
                return (
                  <div key={item.id} style={{
                    background:   val === true  ? "rgba(16,185,129,0.08)"  : val === false ? "rgba(239,68,68,0.08)"  : "rgba(255,255,255,0.03)",
                    border:       `1px solid ${val === true ? "rgba(16,185,129,0.28)" : val === false ? "rgba(239,68,68,0.28)" : "rgba(255,255,255,0.07)"}`,
                    borderLeft:   `3px solid ${val === true ? "#10B981" : val === false ? "#ef4444" : "rgba(255,255,255,0.12)"}`,
                    borderRadius: 12, padding: "12px 14px",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    transition: "all 0.18s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <span style={{ fontSize: 18 }}>{item.icon}</span>
                      <span style={{
                        color: val === true ? "#34d399" : val === false ? "#f87171" : t.text,
                        fontSize: 13, fontWeight: val !== undefined ? 700 : 500,
                      }}>{item.label}</span>
                    </div>
                    <div style={{ display: "flex", gap: 7 }}>
                      <button onClick={() => toggleCheck(item.id, true)} style={{
                        padding: "6px 15px", borderRadius: 9, border: "none", cursor: "pointer",
                        background:  val === true ? "linear-gradient(135deg,#10B981,#34d399bb)" : "rgba(255,255,255,0.06)",
                        color:       val === true ? "#fff" : "rgba(255,255,255,0.4)",
                        fontWeight:  700, fontSize: 12, transition: "all 0.15s",
                        boxShadow:   val === true ? "0 0 14px rgba(16,185,129,0.45)" : "none",
                        fontFamily:  "inherit",
                      }}>✓ Pass</button>
                      <button onClick={() => toggleCheck(item.id, false)} style={{
                        padding: "6px 15px", borderRadius: 9, border: "none", cursor: "pointer",
                        background:  val === false ? "linear-gradient(135deg,#EF4444,#f87171bb)" : "rgba(255,255,255,0.06)",
                        color:       val === false ? "#fff" : "rgba(255,255,255,0.4)",
                        fontWeight:  700, fontSize: 12, transition: "all 0.15s",
                        boxShadow:   val === false ? "0 0 14px rgba(239,68,68,0.45)" : "none",
                        fontFamily:  "inherit",
                      }}>✕ Fail</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grade picker — only when no failures */}
          {allChecked && failCount === 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ color: t.sub, fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                Assign Grade
              </div>
              <div style={{ display: "flex", gap: 9 }}>
                {grades.map(g => (
                  <button key={g.value} onClick={() => setGrade(g.value)} style={{
                    flex: 1, padding: "13px 8px", borderRadius: 12, cursor: "pointer",
                    background:  grade === g.value ? `linear-gradient(135deg,${gradeColor(g.value)},${gradeColor(g.value)}bb)` : "rgba(255,255,255,0.05)",
                    color:       grade === g.value ? "#fff" : "rgba(255,255,255,0.4)",
                    fontWeight:  800, fontSize: 14,
                    transition:  "all 0.18s",
                    boxShadow:   grade === g.value ? `0 0 20px ${gradeColor(g.value)}50` : "none",
                    fontFamily:  "inherit",
                    border:      grade === g.value ? "none" : "1px solid rgba(255,255,255,0.07)",
                  }}>{g.value}</button>
                ))}
              </div>
              <div style={{ color: t.muted, fontSize: 10, marginTop: 7 }}>
                {grades.find(g => g.value === grade)?.label}
              </div>
            </div>
          )}

          {/* Inspector notes */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: t.sub, fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
              💬 Inspector Notes
            </div>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Optional observations, defects, or recommendations..."
              style={{
                width: "100%", background: t.cardAlt,
                border: `1.5px solid ${t.border}`,
                color: t.text, borderRadius: 12, padding: "12px 14px",
                fontSize: 13, outline: "none", minHeight: 76, resize: "vertical",
                fontFamily: "inherit", boxSizing: "border-box",
                transition: "all 0.15s",
              }}
              onFocus={e => { e.target.style.borderColor = `${COLOR}55`; e.target.style.boxShadow = `0 0 0 3px ${COLOR}10`; }}
              onBlur={e => { e.target.style.borderColor = t.border; e.target.style.boxShadow = ""; }}
            />
          </div>

          {/* Result preview + submit */}
          {allChecked && (
            <div>
              <div style={{
                background:   finalGrade === "Rejected" ? "rgba(239,68,68,0.09)"  : "rgba(16,185,129,0.09)",
                border:       `1px solid ${finalGrade === "Rejected" ? "rgba(239,68,68,0.28)" : "rgba(16,185,129,0.28)"}`,
                borderRadius: 13, padding: "14px 18px", marginBottom: 14,
                display:      "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div>
                  <div style={{ color: t.sub, fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                    INSPECTION RESULT
                  </div>
                  <div style={{
                    color:     finalGrade === "Rejected" ? "#f87171" : "#34d399",
                    fontSize:  18, fontWeight: 900,
                  }}>
                    {finalGrade === "Rejected" ? "❌ Rejected" : `✅ Grade ${finalGrade} — Approved`}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {failCount > 0 ? (
                    <div style={{ color: t.red, fontSize: 12, fontWeight: 700 }}>{failCount} failure{failCount>1?"s":""}</div>
                  ) : (
                    <div style={{ color: t.green, fontSize: 12, fontWeight: 700 }}>{passCount}/{checklistItems.length} passed</div>
                  )}
                  <SPill status={finalGrade === "Rejected" ? "Rejected" : "pass"} label={finalGrade === "Rejected" ? "Rejected" : `Grade ${finalGrade}`} />
                </div>
              </div>

              <SBtn
                v={finalGrade === "Rejected" ? "danger" : "success"}
                onClick={submitQC} full
                style={{ fontSize: 15, padding: "15px 0", borderRadius: 13 }}
              >
                {finalGrade === "Rejected" ? "❌ Submit — Rejected" : `✅ Submit — Grade ${finalGrade}`}
              </SBtn>
            </div>
          )}
        </div>

      ) : (
        <>
          {/* ── Batch list view ──────────────────────────────── */}
          <SSearch value={search} onChange={setSearch} placeholder="Search product or batch ID..." t={t} />
          <div style={{ height: 10 }} />

          {/* Filter pills */}
          <div style={{ display: "flex", gap: 7, marginBottom: 14, flexWrap: "wrap" }}>
            {[
              { k:"pending",  l:`🔍 Pending (${counts.pending})`    },
              { k:"passed",   l:`✅ Passed (${counts.passed})`      },
              { k:"rejected", l:`❌ Rejected (${counts.rejected})`  },
              { k:"all",      l:"All"                               },
            ].map(f => (
              <button key={f.k} onClick={() => setFilter(f.k)} style={{
                padding:    "7px 14px", borderRadius: "999px",
                border:     filter !== f.k ? "1px solid rgba(255,255,255,0.08)" : "none",
                cursor:     "pointer", fontWeight: 600, fontSize: 12, transition: "all 0.15s",
                background: filter === f.k ? GRAD : "rgba(255,255,255,0.04)",
                color:      filter === f.k ? "#fff" : t.sub,
                boxShadow:  filter === f.k ? GLOW : "none",
                fontFamily: "inherit",
              }}>{f.l}</button>
            ))}
          </div>

          {/* Batch cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {filtered.length === 0 ? (
              <div style={{
                background:    t.card,
                border:        `1px solid ${t.border}`,
                borderRadius:  18, padding: "50px", textAlign: "center",
                backdropFilter: "blur(20px)",
              }}>
                <div style={{ fontSize: 42, marginBottom: 12, opacity: 0.3 }}>🔬</div>
                <div style={{ color: t.text, fontWeight: 800, fontSize: 15, marginBottom: 4 }}>
                  {filter === "pending" ? "No batches awaiting QC" : "No batches found"}
                </div>
                <div style={{ color: t.sub, fontSize: 13 }}>
                  {filter === "pending" ? "Batches reach 100% and appear here for inspection" : "Try a different filter"}
                </div>
              </div>
            ) : (
              filtered.map(b => {
                const gc = b.qcGrade === "Rejected" ? t.red : b.qcGrade ? gradeColor(b.qcGrade) : COLOR;
                const statusLabel = b.qcGrade === "Rejected" ? "Rejected" : b.qcGrade ? `Grade ${b.qcGrade}` : "Pending QC";
                const statusKey   = b.qcGrade === "Rejected" ? "Rejected" : b.qcGrade ? "pass" : "pending";
                return (
                  <div key={b.id} style={{
                    background:     t.card,
                    border:         `1px solid ${t.border}`,
                    borderLeft:     `3px solid ${gc}`,
                    borderRadius:   14,
                    padding:        "15px 16px",
                    backdropFilter: "blur(20px)",
                    display:        "flex", justifyContent: "space-between", alignItems: "center",
                    transition:     "all 0.15s",
                    boxShadow:      `inset 0 0 0 1px rgba(255,255,255,0.02)`,
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = t.cardAlt; e.currentTarget.style.borderColor = t.borderHover || t.border; }}
                    onMouseLeave={e => { e.currentTarget.style.background = t.card; e.currentTarget.style.borderColor = t.border; }}
                  >
                    <div>
                      <div style={{ color: t.text, fontWeight: 800, fontSize: 15 }}>{b.product}</div>
                      <div style={{ color: t.sub, fontSize: 12, marginTop: 3 }}>
                        <span style={{ fontFamily: "monospace" }}>{b.batchLabel || b.id}</span>
                        {" · "}
                        <span style={{ color: gc, fontWeight: 700 }}>{(b.actual ?? 0).toLocaleString("en-IN")} pcs</span>
                        {b.qcNotes ? ` · "${b.qcNotes}"` : ""}
                      </div>
                      {b.qcGrade && b.qcGrade !== "Rejected" && (
                        <div style={{ color: t.muted, fontSize: 10, marginTop: 4 }}>
                          {b.startedBy ? `Started by ${b.startedBy}` : ""} {b.date ? `· ${b.date}` : ""}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
                      <SPill status={statusKey} label={statusLabel} />
                      {!b.qcGrade && (b.actual ?? 0) > 0 && canInspect && (
                        <SBtn
                          v="primary" color={COLOR}
                          onClick={() => startInspection(b)}
                          sm
                          style={{ boxShadow: GLOW }}
                        >
                          🔬 Inspect
                        </SBtn>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ── Recent QC logs ─────────────────────────────────────── */}
      {!selected && Array.isArray(qcLogs) && qcLogs.filter(l => !l.deleted).length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ color: t.sub, fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>Recent Inspections</div>
            {canExport && <SBtn v="ghost" color={COLOR} sm onClick={() => exportQCCSV(qcLogs.filter(l => !l.deleted))}>⬇ Export CSV</SBtn>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {qcLogs.filter(l => !l.deleted).slice(0, 5).map(log => {
              const gc = log.grade === "Rejected" ? t.red : log.grade === "A" ? t.green : t.orange;
              return (
                <div key={log.id} style={{
                  background:     "rgba(255,255,255,0.02)",
                  border:         `1px solid rgba(255,255,255,0.06)`,
                  borderLeft:     `3px solid ${gc}`,
                  borderRadius:   12,
                  padding:        "12px 14px",
                  backdropFilter: "blur(20px)",
                  display:        "flex", justifyContent: "space-between", alignItems: "center",
                  transition:     "all 0.15s",
                }}>
                  <div>
                    <div style={{ color: t.text, fontSize: 13, fontWeight: 700 }}>{log.product}</div>
                    <div style={{ color: t.sub, fontSize: 11, marginTop: 2 }}>
                      {log.inspector} · {log.date} {log.time}
                      {log.failCount > 0 && <span style={{ color: t.red, marginLeft: 6 }}>· {log.failCount} fail{log.failCount > 1 ? "s" : ""}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <SPill status={log.grade === "Rejected" ? "Rejected" : "pass"} label={log.grade === "Rejected" ? "Rejected" : `Grade ${log.grade}`} />
                    {canDelete && (
                      <button onClick={() => {
                        if (!window.confirm(`Move this QC log for "${log.product}" to trash?`)) return;
                        const now = new Date();
                        setQcLogs(prev => prev.map(l => l.id !== log.id ? l : {
                          ...l,
                          deleted: true,
                          deletedAt: now.getTime(),
                          deletedAtISO: now.toISOString(),
                          deletedBy: sess?.id || "unknown",
                          deletedByName: sess?.name || "Staff",
                          deletedByRole: sess?.role || "staff",
                        }));
                        notify("Moved to trash", "warning");
                      }} title="Move to trash"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,80,80,0.5)", fontSize: 14, padding: "2px 4px", lineHeight: 1 }}>🗑</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
