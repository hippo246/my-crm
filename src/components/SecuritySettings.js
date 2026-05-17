/* eslint-disable react-hooks/exhaustive-deps, no-unused-vars */
// ═══════════════════════════════════════════════════════════════
//  SECURITY-SETTINGS.JSX — Features 12–15
//  Drop into Settings.js in 3 steps (see bottom of this file).
//  Matches your exact SCard / TogRow / GTogRow / Inp / Btn style.
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect } from "react";
import { Card, Inp, Btn, Hr, Tog } from "../components/ui";
import { useLedger, getLedgerSummary, LEDGER_TYPES } from "../lib/ledger";
import { useExportLogs } from "../lib/exportGuard";
import { useMonitorLog, SEVERITY, MONITOR_EVENTS } from "../lib/monitor";
import { ApprovalQueue } from "../components/ApprovalFlow";

// ── Re-use your TogRow + SCard exactly as in Settings.js ────────
function TogRow({ t, dm, label, desc, on, onChange, indent = false, children }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", justifyContent: "space-between",
      padding: "13px 0", borderBottom: `1px solid ${t.border}`,
      paddingLeft: indent ? 14 : 0, gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: t.text, fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{label}</p>
        {desc && <p style={{ color: t.sub, fontSize: 11, marginTop: 3, lineHeight: 1.5 }}>{desc}</p>}
        {children}
      </div>
      <div style={{ flexShrink: 0, paddingTop: 2 }}>
        <Tog dm={dm} on={on} onChange={onChange} />
      </div>
    </div>
  );
}

function SCard({ t, dm, icon, title, subtitle, children, headerRight }) {
  return (
    <Card dm={dm}>
      <div style={{ padding: "16px 16px 4px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: subtitle ? 2 : 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {icon && <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>}
            <p style={{ color: t.text, fontWeight: 700, fontSize: 14 }}>{title}</p>
          </div>
          {headerRight}
        </div>
        {subtitle && <p style={{ color: t.sub, fontSize: 11, marginBottom: 14, lineHeight: 1.5 }}>{subtitle}</p>}
      </div>
      <div style={{ padding: "0 16px 16px" }}>{children}</div>
    </Card>
  );
}

// ── Small number input (styled to match your inputs) ─────────────
function NumInp({ t, label, value, onChange, min = 0, max = 999999, sub }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>{label}</label>}
      <input
        type="number" min={min} max={max} value={value}
        onChange={e => onChange(Math.max(min, Math.min(max, +e.target.value || 0)))}
        style={{
          background: t.inp, border: `1.5px solid ${t.border}`, color: t.text,
          borderRadius: 10, padding: "9px 12px", fontSize: 14,
          width: "100%", outline: "none", boxSizing: "border-box",
        }}
      />
      {sub && <p style={{ color: t.sub, fontSize: 10, marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

// ── Status chip ──────────────────────────────────────────────────
function Chip({ label, color, bg }) {
  return (
    <span style={{
      background: bg || color + "18",
      color: color,
      border: `1px solid ${color}30`,
      borderRadius: 20, padding: "2px 9px",
      fontSize: 10, fontWeight: 800,
      textTransform: "uppercase", letterSpacing: "0.05em",
    }}>{label}</span>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN EXPORT — renderSecurityControls()
//  Call this inside your SettingsTab as a render function,
//  then wire it to a new SECS entry (see integration guide below).
// ═══════════════════════════════════════════════════════════════
export function renderSecurityControls({ t, dm, sess, settings, setSettings, notify, ask }) {
  // Sub-key helpers — same pattern as your staffPortal helpers
  const ec  = settings?.exportControls  || {};
  const cp  = settings?.chaosProtection || {};
  const mon = settings?.monitoring      || {};

  const setEc  = patch => setSettings(s => ({ ...s, exportControls:  { ...(s.exportControls  || {}), ...patch } }));
  const setCp  = patch => setSettings(s => ({ ...s, chaosProtection: { ...(s.chaosProtection || {}), ...patch } }));
  const setMon = patch => setSettings(s => ({ ...s, monitoring:      { ...(s.monitoring      || {}), ...patch } }));

  return (
    <SecurityControlsPanel
      t={t} dm={dm} sess={sess} settings={settings}
      ec={ec} cp={cp} mon={mon}
      setEc={setEc} setCp={setCp} setMon={setMon}
      notify={notify} ask={ask}
    />
  );
}

// ── Inner panel (needs hooks, so it's its own component) ─────────
function SecurityControlsPanel({ t, dm, sess, settings, ec, cp, mon, setEc, setCp, setMon, notify, ask }) {
  const [activeTab, setActiveTab] = useState("ledger");

  const TABS = [
    { id: "ledger",    icon: "📒", label: "Ledger"    },
    { id: "exports",   icon: "📤", label: "Exports"   },
    { id: "approvals", icon: "🔐", label: "Approvals" },
    { id: "monitor",   icon: "🚨", label: "Monitor"   },
  ];

  return (
    <>
      {/* ── Tab strip ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 6px", marginBottom: 20 }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              background: isActive ? t.accent : t.inp,
              color:      isActive ? t.accentFg : t.sub,
              border:     `1.5px solid ${isActive ? t.accent : t.border}`,
              borderRadius: 20, padding: "7px 14px",
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              transition: "all 0.12s", whiteSpace: "nowrap",
              WebkitTapHighlightColor: "transparent",
            }}>
              <span style={{ fontSize: 14 }}>{tab.icon}</span>{tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "ledger"    && <LedgerSection    t={t} dm={dm} settings={settings} setSettings={setSettings} notify={notify} ask={ask} />}
      {activeTab === "exports"   && <ExportsSection   t={t} dm={dm} ec={ec} setEc={setEc} sess={sess} settings={settings} notify={notify} />}
      {activeTab === "approvals" && <ApprovalsSection t={t} dm={dm} cp={cp} setCp={setCp} sess={sess} notify={notify} ask={ask} />}
      {activeTab === "monitor"   && <MonitorSection   t={t} dm={dm} mon={mon} setMon={setMon} sess={sess} settings={settings} />}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  FEATURE 12 — IMMUTABLE LEDGER
// ═══════════════════════════════════════════════════════════════
function LedgerSection({ t, dm, settings, setSettings, notify, ask }) {
  const { entries, loaded } = useLedger();
  const summary = getLedgerSummary(entries);
  const inr = v => "₹" + Number(v || 0).toLocaleString("en-IN");

  const TYPE_LABELS = {
    [LEDGER_TYPES.INVOICE_CREATED]:    { icon: "🧾", label: "Invoice Created",    color: "#10b981" },
    [LEDGER_TYPES.INVOICE_VOIDED]:     { icon: "🚫", label: "Invoice Voided",     color: "#ef4444" },
    [LEDGER_TYPES.PAYMENT_RECEIVED]:   { icon: "💰", label: "Payment Received",   color: "#6366f1" },
    [LEDGER_TYPES.PAYMENT_REVERSED]:   { icon: "↩️", label: "Payment Reversed",   color: "#f97316" },
    [LEDGER_TYPES.DELIVERY_BILLED]:    { icon: "🚚", label: "Delivery Billed",    color: "#0ea5e9" },
    [LEDGER_TYPES.SUPPLY_PURCHASE]:    { icon: "📦", label: "Supply Purchase",    color: "#8b5cf6" },
    [LEDGER_TYPES.EXPENSE_RECORDED]:   { icon: "💸", label: "Expense Recorded",   color: "#f59e0b" },
    [LEDGER_TYPES.REPLACEMENT_ISSUED]: { icon: "🔄", label: "Replacement Issued", color: "#f97316" },
    [LEDGER_TYPES.CREDIT_NOTE]:        { icon: "📝", label: "Credit Note",        color: "#14b8a6" },
  };

  return (
    <>
      {/* Config toggles */}
      <SCard t={t} dm={dm} icon="📒" title="Immutable Ledger"
        subtitle="Append-only record of every financial event. No edits, no deletes — every entry is permanent.">
        <TogRow t={t} dm={dm}
          label="Auto-record invoice events"
          desc="Automatically write a ledger entry whenever an invoice is created or voided"
          on={settings?.ledgerAutoInvoice !== false}
          onChange={() => setSettings(s => ({ ...s, ledgerAutoInvoice: !(s.ledgerAutoInvoice !== false) }))}
        />
        <TogRow t={t} dm={dm}
          label="Auto-record payment events"
          desc="Automatically write a ledger entry whenever a payment is recorded or reversed"
          on={settings?.ledgerAutoPayment !== false}
          onChange={() => setSettings(s => ({ ...s, ledgerAutoPayment: !(s.ledgerAutoPayment !== false) }))}
        />
        <TogRow t={t} dm={dm}
          label="Auto-record supply & expense events"
          desc="Write ledger entries for every supply purchase and expense logged"
          on={settings?.ledgerAutoSupplyExp !== false}
          onChange={() => setSettings(s => ({ ...s, ledgerAutoSupplyExp: !(s.ledgerAutoSupplyExp !== false) }))}
        />
        <TogRow t={t} dm={dm}
          label="Show ledger summary on P&L tab"
          desc="Display reconciliation totals from the ledger alongside P&L figures"
          on={!!settings?.ledgerShowOnPnL}
          onChange={() => setSettings(s => ({ ...s, ledgerShowOnPnL: !s.ledgerShowOnPnL }))}
        />
      </SCard>

      {/* Running totals */}
      <SCard t={t} dm={dm} icon="🧮" title="Ledger Reconciliation"
        subtitle={loaded ? `${entries.length} entries recorded` : "Loading…"}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { label: "Total Invoiced",    val: inr(summary.totalInvoiced),   color: "#10b981" },
            { label: "Total Paid",        val: inr(summary.totalPaid),       color: "#6366f1" },
            { label: "Total Voided",      val: inr(summary.totalVoided),     color: "#ef4444" },
            { label: "Total Reversed",    val: inr(summary.totalReversed),   color: "#f97316" },
            { label: "Total Expenses",    val: inr(summary.totalExpenses),   color: "#f59e0b" },
            { label: "Net Receivable",    val: inr(summary.netReceivable),   color: summary.netReceivable > 0 ? "#10b981" : "#ef4444" },
          ].map(x => (
            <div key={x.label} style={{ background: t.inp, borderRadius: 10, padding: "10px 12px" }}>
              <p style={{ color: t.sub, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>{x.label}</p>
              <p style={{ color: x.color, fontWeight: 900, fontSize: 17, lineHeight: 1.2, marginTop: 4 }}>{x.val}</p>
            </div>
          ))}
        </div>
      </SCard>

      {/* Recent ledger entries */}
      <SCard t={t} dm={dm} icon="📜" title="Recent Ledger Entries"
        subtitle="Last 20 entries — read-only, append-only">
        {!loaded
          ? <p style={{ color: t.sub, fontSize: 12, textAlign: "center", padding: "16px 0" }}>Loading…</p>
          : entries.length === 0
            ? <p style={{ color: t.sub, fontSize: 12, textAlign: "center", padding: "16px 0" }}>No ledger entries yet.</p>
            : entries.slice(0, 20).map((e, i) => {
                const meta = TYPE_LABELS[e.type] || { icon: "•", label: e.type, color: t.sub };
                return (
                  <div key={e._key} style={{
                    display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                    gap: 10, padding: "10px 0",
                    borderBottom: i < Math.min(19, entries.length - 1) ? `1px solid ${t.border}` : "none",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{meta.icon}</span>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ color: t.text, fontSize: 12, fontWeight: 700 }}>{meta.label}</p>
                        <p style={{ color: t.sub, fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {e.actor?.name} · {new Date(e.ts).toLocaleString("en-IN")}
                        </p>
                        {e.data?.invNo && <p style={{ color: t.sub, fontSize: 10, fontFamily: "monospace" }}>{e.data.invNo}</p>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      {(e.data?.amount || e.data?.cost || e.data?.total) > 0 && (
                        <p style={{ color: meta.color, fontWeight: 800, fontSize: 13 }}>
                          {inr(e.data?.amount || e.data?.cost || e.data?.total)}
                        </p>
                      )}
                      <Chip label={e.type.replace(/_/g, " ")} color={meta.color} />
                    </div>
                  </div>
                );
              })
        }
      </SCard>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  FEATURE 13 — EXPORT CONTROLS
// ═══════════════════════════════════════════════════════════════
function ExportsSection({ t, dm, ec, setEc, sess, settings, notify }) {
  const { logs, loaded } = useExportLogs();
  const isAdmin = sess?.role === "admin";

  const exportTypeColor = { csv: "#10b981", excel: "#0ea5e9", pdf: "#8b5cf6", word: "#f59e0b" };

  return (
    <>
      <SCard t={t} dm={dm} icon="📤" title="Export Controls"
        subtitle="Admins always have unlimited exports. Limits apply to all other roles.">

        <TogRow t={t} dm={dm}
          label="Enable export rate limiting"
          desc="Restrict how many exports non-admin users can perform per hour and per day"
          on={ec.rateLimitEnabled !== false}
          onChange={() => setEc({ rateLimitEnabled: !(ec.rateLimitEnabled !== false) })}
        />

        {ec.rateLimitEnabled !== false && (
          <div style={{ paddingLeft: 14, paddingBottom: 4 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
              <NumInp t={t} label="Max exports / hour" value={ec.maxPerHour ?? 10} min={1} max={999}
                onChange={v => setEc({ maxPerHour: v })} sub="Per non-admin user" />
              <NumInp t={t} label="Max exports / day" value={ec.maxPerDay ?? 30} min={1} max={9999}
                onChange={v => setEc({ maxPerDay: v })} sub="Resets at midnight" />
            </div>
          </div>
        )}

        <TogRow t={t} dm={dm}
          label="Cap maximum rows per export"
          desc="Prevent bulk data dumps by limiting how many rows can be in a single CSV or Excel export"
          on={!!ec.rowLimitEnabled}
          onChange={() => setEc({ rowLimitEnabled: !ec.rowLimitEnabled })}
        />

        {ec.rowLimitEnabled && (
          <div style={{ paddingLeft: 14, paddingBottom: 4 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
              <NumInp t={t} label="Max rows — CSV" value={ec.maxRowsCSV ?? 5000} min={100}
                onChange={v => setEc({ maxRowsCSV: v })} />
              <NumInp t={t} label="Max rows — Excel" value={ec.maxRowsExcel ?? 2000} min={100}
                onChange={v => setEc({ maxRowsExcel: v })} />
            </div>
          </div>
        )}

        <TogRow t={t} dm={dm}
          label="Watermark exported files"
          desc="Inject user name, role, and timestamp into every PDF/HTML export footer"
          on={ec.watermark !== false}
          onChange={() => setEc({ watermark: !(ec.watermark !== false) })}
        />

        <TogRow t={t} dm={dm}
          label="Log all exports"
          desc="Record who exported what, when, and how many rows — visible in the export log below"
          on={ec.logExports !== false}
          onChange={() => setEc({ logExports: !(ec.logExports !== false) })}
        />

        {/* Roles allowed to export */}
        <div style={{ paddingTop: 10 }}>
          <p style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Roles allowed to export
          </p>
          <p style={{ color: t.sub, fontSize: 10, marginBottom: 8 }}>Admins always can. Toggle access for other roles.</p>
          {["manager", "agent", "factory"].map(role => {
            const allowed = (ec.allowedRoles ?? ["admin", "manager"]).includes(role);
            return (
              <TogRow key={role} t={t} dm={dm} indent
                label={role.charAt(0).toUpperCase() + role.slice(1)}
                on={allowed}
                onChange={() => {
                  const current = ec.allowedRoles ?? ["admin", "manager"];
                  setEc({ allowedRoles: allowed ? current.filter(r => r !== role) : [...current, role] });
                }}
              />
            );
          })}
        </div>
      </SCard>

      {/* Export log */}
      {ec.logExports !== false && (
        <SCard t={t} dm={dm} icon="📋" title="Export Log"
          subtitle={loaded ? `${logs.length} exports recorded` : "Loading…"}>

          {/* Summary row */}
          {logs.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              {Object.entries(
                logs.reduce((acc, l) => { acc[l.exportType] = (acc[l.exportType] || 0) + 1; return acc; }, {})
              ).map(([type, count]) => (
                <div key={type} style={{
                  background: (exportTypeColor[type] || "#64748b") + "18",
                  border: `1px solid ${(exportTypeColor[type] || "#64748b")}30`,
                  borderRadius: 10, padding: "6px 12px",
                }}>
                  <span style={{ color: exportTypeColor[type] || t.sub, fontWeight: 800, fontSize: 12 }}>
                    {type.toUpperCase()} ×{count}
                  </span>
                </div>
              ))}
            </div>
          )}

          {!loaded
            ? <p style={{ color: t.sub, fontSize: 12, textAlign: "center", padding: "16px 0" }}>Loading…</p>
            : logs.length === 0
              ? <p style={{ color: t.sub, fontSize: 12, textAlign: "center", padding: "16px 0" }}>No exports logged yet.</p>
              : logs.slice(0, 30).map((log, i) => (
                  <div key={log._key} style={{
                    display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                    gap: 10, padding: "9px 0",
                    borderBottom: i < Math.min(29, logs.length - 1) ? `1px solid ${t.border}` : "none",
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: t.text, fontSize: 12, fontWeight: 700 }}>
                        {log.actor?.name}
                        <span style={{ color: t.sub, fontWeight: 500 }}> · {log.tabName}</span>
                      </p>
                      <p style={{ color: t.sub, fontSize: 10 }}>
                        {log.actor?.role} · {log.rowCount} rows · {new Date(log.ts).toLocaleString("en-IN")}
                      </p>
                    </div>
                    <Chip
                      label={log.exportType?.toUpperCase() || "?"}
                      color={exportTypeColor[log.exportType] || "#64748b"}
                    />
                  </div>
                ))
          }
        </SCard>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  FEATURE 14 — CHAOS PROTECTION
// ═══════════════════════════════════════════════════════════════
function ApprovalsSection({ t, dm, cp, setCp, sess, notify, ask }) {
  const DUAL_ACTIONS = [
    { key: "delete_invoice",  label: "Delete Invoice"    },
    { key: "void_payment",    label: "Void Payment"      },
    { key: "bulk_delete",     label: "Bulk Delete"       },
    { key: "factory_reset",   label: "Factory Reset"     },
    { key: "delete_customer", label: "Delete Customer"   },
    { key: "delete_delivery", label: "Delete Delivery"   },
  ];

  const dualFor = cp.requireDualApprovalFor ?? ["delete_invoice", "void_payment", "bulk_delete", "factory_reset"];

  return (
    <>
      <SCard t={t} dm={dm} icon="🔐" title="Chaos Protection"
        subtitle="Confirmation dialogs, undo windows, and dual-approval flows to prevent accidental or malicious data loss.">

        <TogRow t={t} dm={dm}
          label="Confirm modal on all deletes"
          desc="Show a confirmation dialog before any delete action across the system"
          on={cp.requireConfirmOnDelete !== false}
          onChange={() => setCp({ requireConfirmOnDelete: !(cp.requireConfirmOnDelete !== false) })}
        />

        <TogRow t={t} dm={dm}
          label="Undo window after destructive actions"
          desc="Give a grace period to cancel deletes and status changes before they're committed"
          on={cp.undoEnabled !== false}
          onChange={() => setCp({ undoEnabled: !(cp.undoEnabled !== false) })}
        />

        {cp.undoEnabled !== false && (
          <div style={{ paddingLeft: 14, paddingBottom: 4 }}>
            <NumInp t={t} label="Undo window (seconds)" value={Math.round((cp.undoWindowMs ?? 5000) / 1000)}
              min={2} max={30}
              onChange={v => setCp({ undoWindowMs: v * 1000 })}
              sub="How long before the action actually commits" />
          </div>
        )}

        <TogRow t={t} dm={dm}
          label="Require dual approval for dangerous actions"
          desc="Selected actions below must be approved by an admin before executing"
          on={cp.dualApprovalEnabled !== false}
          onChange={() => setCp({ dualApprovalEnabled: !(cp.dualApprovalEnabled !== false) })}
        />

        {cp.dualApprovalEnabled !== false && (
          <div style={{ paddingLeft: 14, paddingTop: 4, paddingBottom: 4 }}>
            <p style={{ color: t.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Require manager approval for:
            </p>
            {DUAL_ACTIONS.map(action => {
              const on = dualFor.includes(action.key);
              return (
                <TogRow key={action.key} t={t} dm={dm} indent
                  label={action.label}
                  on={on}
                  onChange={() => setCp({
                    requireDualApprovalFor: on
                      ? dualFor.filter(k => k !== action.key)
                      : [...dualFor, action.key],
                  })}
                />
              );
            })}
          </div>
        )}

        <TogRow t={t} dm={dm}
          label="Type-to-confirm on factory reset"
          desc="Force the user to type DELETE to confirm irreversible data wipes"
          on={cp.typeToConfirmReset !== false}
          onChange={() => setCp({ typeToConfirmReset: !(cp.typeToConfirmReset !== false) })}
        />
      </SCard>

      {/* Live approval queue — only visible if dual approval is on */}
      {cp.dualApprovalEnabled !== false && (
        <SCard t={t} dm={dm} icon="⏳" title="Pending Approval Queue"
          subtitle="Actions waiting for admin approval">
          <ApprovalQueue
            dm={dm} sess={sess}
            onApproved={req => notify(`✓ Approved: ${req.label}`)}
            onRejected={req => notify(`✕ Rejected: ${req.label}`)}
          />
          <p style={{ color: t.sub, fontSize: 11, textAlign: "center", marginTop: 8 }}>
            Approve or reject requests from non-admin users above.
          </p>
        </SCard>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  FEATURE 15 — MONITORING & ALERTING
// ═══════════════════════════════════════════════════════════════
function MonitorSection({ t, dm, mon, setMon, sess, settings }) {
  const { events, loaded, summary } = useMonitorLog();
  const [filter, setFilter] = useState("all");
  const [page, setPage]     = useState(0);
  const PAGE = 25;

  const sevColor = { info: "#3b82f6", warn: "#f59e0b", critical: "#ef4444" };
  const sevBg    = { info: "#3b82f618", warn: "#f59e0b18", critical: "#ef444418" };

  const FILTERS = [
    ["all",                              "All"],
    [SEVERITY.CRITICAL,                  "🔴 Critical"],
    [MONITOR_EVENTS.LOGIN_FAILED,        "🔑 Failed Logins"],
    [MONITOR_EVENTS.PERM_DENIED,         "🚫 Perm Denied"],
    [MONITOR_EVENTS.DB_ERROR,            "💾 DB Errors"],
    [MONITOR_EVENTS.EXPORT_BLOCKED,      "📤 Blocked Exports"],
    [MONITOR_EVENTS.SUSPICIOUS_ACTIVITY, "⚠️ Suspicious"],
  ];

  const filtered = events.filter(e => {
    if (filter === "all") return true;
    if (filter === SEVERITY.CRITICAL) return e.severity === SEVERITY.CRITICAL;
    return e.type === filter;
  });

  const paged = filtered.slice(page * PAGE, (page + 1) * PAGE);

  return (
    <>
      {/* Config */}
      <SCard t={t} dm={dm} icon="🚨" title="Monitoring & Alerting"
        subtitle="Track failed logins, permission denials, DB errors, export blocks, and suspicious activity in real time.">

        <TogRow t={t} dm={dm}
          label="Monitor failed login attempts"
          desc="Record every failed login in the security log"
          on={mon.trackFailedLogins !== false}
          onChange={() => setMon({ trackFailedLogins: !(mon.trackFailedLogins !== false) })}
        />

        <TogRow t={t} dm={dm}
          label="Spike alert on repeated failures"
          desc="Flag suspicious activity when multiple login failures occur in 15 minutes"
          on={mon.loginSpikeAlert !== false}
          onChange={() => setMon({ loginSpikeAlert: !(mon.loginSpikeAlert !== false) })}
        />

        {mon.loginSpikeAlert !== false && (
          <div style={{ paddingLeft: 14, paddingBottom: 4 }}>
            <NumInp t={t} label="Failures before spike alert" value={mon.failedLoginThreshold ?? 5}
              min={2} max={20} onChange={v => setMon({ failedLoginThreshold: v })}
              sub="Within a 15-minute window" />
          </div>
        )}

        <TogRow t={t} dm={dm}
          label="Monitor permission denials"
          desc="Log every time a user is blocked from an action they don't have permission for"
          on={mon.trackPermDenials !== false}
          onChange={() => setMon({ trackPermDenials: !(mon.trackPermDenials !== false) })}
        />

        <TogRow t={t} dm={dm}
          label="Monitor Firebase/DB errors"
          desc="Record database read/write failures for debugging and uptime tracking"
          on={mon.trackDbErrors !== false}
          onChange={() => setMon({ trackDbErrors: !(mon.trackDbErrors !== false) })}
        />

        <TogRow t={t} dm={dm}
          label="Monitor function failures"
          desc="Log crashes in critical functions (exports, payments, ledger writes)"
          on={mon.trackFnFailures !== false}
          onChange={() => setMon({ trackFnFailures: !(mon.trackFnFailures !== false) })}
        />

        <div style={{ paddingTop: 8 }}>
          <NumInp t={t} label="Log retention (days)" value={mon.retainDays ?? 30}
            min={7} max={365} onChange={v => setMon({ retainDays: v })}
            sub="Events older than this can be manually purged from Data settings" />
        </div>
      </SCard>

      {/* Summary cards */}
      <SCard t={t} dm={dm} icon="📊" title="Alert Summary">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {[
            { label: "Critical (24h)",     val: summary.criticalLast24h,  color: "#ef4444" },
            { label: "Failed Logins (1h)", val: summary.failedLoginsH1,   color: "#f59e0b" },
            { label: "Perm Denials (1h)",  val: summary.permDenialsH1,    color: "#8b5cf6" },
            { label: "DB Errors (24h)",    val: summary.dbErrorsH24,      color: "#ef4444" },
            { label: "Exports Blocked",    val: summary.exportBlocksH24,  color: "#f97316" },
            { label: "Suspicious (24h)",   val: summary.suspiciousH24,    color: "#dc2626" },
          ].map(x => (
            <div key={x.label} style={{
              background: t.inp,
              border: `1px solid ${x.val > 0 ? x.color + "40" : t.border}`,
              borderRadius: 10, padding: "9px 10px",
            }}>
              <p style={{ color: t.sub, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", lineHeight: 1.4 }}>{x.label}</p>
              <p style={{ color: x.val > 0 ? x.color : t.sub, fontWeight: 900, fontSize: 20, lineHeight: 1.2, marginTop: 3 }}>{x.val}</p>
            </div>
          ))}
        </div>

        {summary.hasAlerts && (
          <div style={{
            marginTop: 12, background: "#ef444412",
            border: "1.5px solid #ef444440", borderRadius: 10,
            padding: "10px 14px", display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 18 }}>🚨</span>
            <p style={{ color: "#ef4444", fontWeight: 700, fontSize: 12 }}>
              Active alerts in the last 24 hours. Review the log below.
            </p>
          </div>
        )}
      </SCard>

      {/* Live log */}
      <SCard t={t} dm={dm} icon="📋" title="Security Event Log"
        subtitle={loaded ? `${events.length} total events` : "Loading…"}>

        {/* Filter pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {FILTERS.map(([val, label]) => (
            <button key={val} onClick={() => { setFilter(val); setPage(0); }} style={{
              background: filter === val ? t.accent : t.inp,
              color:      filter === val ? t.accentFg : t.sub,
              border:     `1px solid ${filter === val ? t.accent : t.border}`,
              borderRadius: 20, padding: "5px 12px",
              fontSize: 11, fontWeight: 700, cursor: "pointer",
            }}>
              {label}
            </button>
          ))}
        </div>

        {!loaded
          ? <p style={{ color: t.sub, fontSize: 12, textAlign: "center", padding: "16px 0" }}>Loading…</p>
          : paged.length === 0
            ? <p style={{ color: t.sub, fontSize: 12, textAlign: "center", padding: "16px 0" }}>No events found.</p>
            : paged.map((e, i) => (
                <div key={e._key} style={{
                  display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 0",
                  borderBottom: i < paged.length - 1 ? `1px solid ${t.border}` : "none",
                }}>
                  {/* Severity dot */}
                  <div style={{
                    width: 7, height: 7, borderRadius: "50%", marginTop: 5, flexShrink: 0,
                    background: sevColor[e.severity] || "#64748b",
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: t.text, fontSize: 12, fontWeight: 600 }}>{e.message}</p>
                    <p style={{ color: t.sub, fontSize: 10 }}>
                      {e.context?.name} ({e.context?.role}) · {new Date(e.ts).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div style={{
                    background: sevBg[e.severity],
                    color: sevColor[e.severity] || "#64748b",
                    borderRadius: 20, padding: "2px 8px",
                    fontSize: 9, fontWeight: 800, textTransform: "uppercase",
                    flexShrink: 0, alignSelf: "flex-start",
                  }}>
                    {e.severity}
                  </div>
                </div>
              ))
        }

        {/* Pagination */}
        {filtered.length > PAGE && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
            <Btn dm={dm} v="ghost" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} style={{ opacity: page === 0 ? 0.4 : 1 }}>← Prev</Btn>
            <span style={{ color: t.sub, fontSize: 12, alignSelf: "center" }}>
              {page + 1} / {Math.ceil(filtered.length / PAGE)}
            </span>
            <Btn dm={dm} v="ghost" size="sm" onClick={() => setPage(p => p + 1)} style={{ opacity: (page + 1) * PAGE >= filtered.length ? 0.4 : 1 }}>Next →</Btn>
          </div>
        )}
      </SCard>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  INTEGRATION GUIDE — 3 steps in Settings.js
// ═══════════════════════════════════════════════════════════════
//
//  STEP 1 — Import at the top of Settings.js:
//    import { renderSecurityControls } from "../components/SecuritySettings";
//
//  STEP 2 — Add to the SECS array (around line 207):
//    { id: "security_controls", icon: "🛡️", label: "Security Controls" },
//
//  STEP 3 — Add to the sectionContent map (around line 1735):
//    security_controls: () => renderSecurityControls({
//      t, dm, sess, settings, setSettings, notify, ask
//    }),
//
//  That's it. The tab will appear in both SectionNav and SidebarNav
//  automatically, and all 4 features are live.
//
//  FIREBASE PATHS USED (all auto-created on first write):
//    tas9_ledger        — immutable financial ledger entries
//    tas9_export_logs   — who exported what and when
//    tas9_approvals     — pending / resolved dual-approval requests
//    tas9_monitor_log   — security events, failed logins, DB errors
//
//  SETTINGS KEYS ADDED (all nested, non-breaking):
//    settings.ledgerAutoInvoice          (bool, default true)
//    settings.ledgerAutoPayment          (bool, default true)
//    settings.ledgerAutoSupplyExp        (bool, default true)
//    settings.ledgerShowOnPnL            (bool, default false)
//    settings.exportControls             (object)
//      .rateLimitEnabled                 (bool, default true)
//      .maxPerHour                       (number, default 10)
//      .maxPerDay                        (number, default 30)
//      .rowLimitEnabled                  (bool, default false)
//      .maxRowsCSV                       (number, default 5000)
//      .maxRowsExcel                     (number, default 2000)
//      .watermark                        (bool, default true)
//      .logExports                       (bool, default true)
//      .allowedRoles                     (string[], default ["admin","manager"])
//    settings.chaosProtection            (object)
//      .requireConfirmOnDelete           (bool, default true)
//      .undoEnabled                      (bool, default true)
//      .undoWindowMs                     (number, default 5000)
//      .dualApprovalEnabled              (bool, default true)
//      .requireDualApprovalFor           (string[])
//      .typeToConfirmReset               (bool, default true)
//    settings.monitoring                 (object)
//      .trackFailedLogins                (bool, default true)
//      .loginSpikeAlert                  (bool, default true)
//      .failedLoginThreshold             (number, default 5)
//      .trackPermDenials                 (bool, default true)
//      .trackDbErrors                    (bool, default true)
//      .trackFnFailures                  (bool, default true)
//      .retainDays                       (number, default 30)
