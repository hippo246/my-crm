/* eslint-disable react-hooks/exhaustive-deps, no-unused-vars */
import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { ref, onValue, remove } from "firebase/database";
import { SectionHeader, TabStatCards, StatCard, Card, Sheet, Inp, Sel, Btn, Hr, Tog, Search, Pill, DataTable, FilterBar, StatusPill, AvatarCircle, Pagination, BottomNav, Toast, Confirm, ProdRow, OrderEditor } from "../components/ui";
import { T } from "../lib/theme";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, Cell, ReferenceLine } from "recharts";
import { exportCSV, exportTabPDF, exportTabExcel, exportPDF, exportDeliveryLabel, exportDeliveryInvoice, exportDeliveryReceipt, exportAgentReceipt, shareWhatsApp, exportWord } from "../lib/exports";
import { safeArr, safeO, inr, today, uid, ts, lineTotal, lineTotalWithTax } from "../lib/utils";
import { GPSMap } from "../components/GPSMap";
import { ALL_TABS, ROLE_DEF, FINE_PERM_DEFS, defaultFinePerms, hasPerm } from "../lib/roles";
import { PasskeyManager, SecuritySessions, FailedLoginAttempts } from "../components/SecurityPanels";
import { WeatherWidget } from "../components/WeatherWidget";
import { DetailModal } from "../components/DetailModal";

// ─── Reusable toggle row ─────────────────────────────────────────────────────
function TogRow({ t, dm, label, desc, on, onChange, indent = false, children }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", justifyContent: "space-between",
      padding: "13px 0", borderBottom: `1px solid ${t.border}`,
      paddingLeft: indent ? (indent === 2 ? 28 : 14) : 0, gap: 12,
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

// ─── Section card wrapper ─────────────────────────────────────────────────────
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

// ─── Editable chip list ───────────────────────────────────────────────────────
function ChipList({ t, dm, label, icon, items, onAdd, onRemove, color = "#f59e0b", placeholder }) {
  const [draft, setDraft] = useState("");
  const doAdd = () => { if (draft.trim()) { onAdd(draft.trim()); setDraft(""); } };
  return (
    <SCard t={t} dm={dm} icon={icon} title={label}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {items.map((item, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 5,
            background: color + "18", border: `1.5px solid ${color}44`,
            borderRadius: 20, padding: "5px 12px",
          }}>
            <span style={{ color, fontSize: 12, fontWeight: 700 }}>{item}</span>
            <button onClick={() => onRemove(i)} style={{
              color, background: "none", border: "none", cursor: "pointer",
              fontSize: 14, lineHeight: 1, padding: "0 2px", opacity: 0.7,
            }}>×</button>
          </div>
        ))}
        {items.length === 0 && <p style={{ color: t.sub, fontSize: 12 }}>No items yet.</p>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === "Enter" && doAdd()}
          placeholder={placeholder || `Add ${label.toLowerCase()}…`}
          style={{
            flex: 1, background: t.inp, border: `1.5px solid ${t.border}`,
            color: t.text, borderRadius: 10, padding: "9px 12px",
            fontSize: 13, outline: "none",
          }} />
        <button onClick={doAdd} style={{
          background: color, color: "#fff", border: "none",
          borderRadius: 10, padding: "9px 16px", fontSize: 13,
          fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
        }}>+ Add</button>
      </div>
    </SCard>
  );
}

// ─── Editable string list (inline edit + delete) ──────────────────────────────
function EditableList({ t, dm, items, defaults, onUpdate, onDelete, onAdd }) {
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
        {items.map((v, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input value={v} onChange={e => onUpdate(i, e.target.value)}
              style={{
                flex: 1, background: t.inp, border: `1px solid ${t.border}`,
                color: t.text, borderRadius: 10, padding: "9px 12px", fontSize: 13, outline: "none",
              }} />
            <button onClick={() => onDelete(i)} style={{
              background: "#ef444420", border: "1px solid #ef444430", color: "#ef4444",
              borderRadius: 8, width: 34, height: 34, fontSize: 15, fontWeight: 700,
              cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
            }}>✕</button>
          </div>
        ))}
      </div>
      <button onClick={onAdd} style={{
        border: `1.5px dashed ${t.border}`, color: t.sub, width: "100%",
        borderRadius: 10, padding: "9px", fontSize: 13, fontWeight: 600,
        cursor: "pointer", background: "transparent",
      }}>+ Add</button>
    </div>
  );
}

// ─── Section pill nav ─────────────────────────────────────────────────────────
function SectionNav({ sections, active, onSelect, t }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 6px", marginBottom: 20 }}>
      {sections.map(s => {
        const isActive = active === s.id;
        return (
          <button key={s.id} onClick={() => onSelect(s.id)} style={{
            background: isActive ? t.accent : t.inp,
            color: isActive ? t.accentFg : t.sub,
            border: `1.5px solid ${isActive ? t.accent : t.border}`,
            borderRadius: 20, padding: "7px 14px",
            display: "flex", alignItems: "center", gap: 5,
            fontSize: 12, fontWeight: 700, cursor: "pointer",
            transition: "all 0.12s", whiteSpace: "nowrap",
            WebkitTapHighlightColor: "transparent",
          }}>
            <span style={{ fontSize: 14 }}>{s.icon}</span>{s.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Sidebar nav (desktop) ────────────────────────────────────────────────────
function SidebarNav({ sections, active, onSelect, t }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 3,
      width: 176, flexShrink: 0, position: "sticky", top: 80,
    }}>
      {sections.map(s => {
        const isActive = active === s.id;
        return (
          <button key={s.id} onClick={() => onSelect(s.id)} style={{
            background: isActive ? t.accent : "transparent",
            color: isActive ? t.accentFg : t.sub,
            border: `1.5px solid ${isActive ? t.accent : "transparent"}`,
            borderRadius: 10, padding: "10px 12px", textAlign: "left",
            cursor: "pointer", transition: "all 0.12s",
            display: "flex", alignItems: "center", gap: 9,
            fontWeight: isActive ? 700 : 500, fontSize: 13,
            WebkitTapHighlightColor: "transparent",
          }}
            onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = t.card; e.currentTarget.style.color = t.text; } }}
            onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = t.sub; } }}
          >
            <span style={{ fontSize: 16, flexShrink: 0 }}>{s.icon}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Section heading ─────────────────────────────────────────────────────────
function SecHeading({ t, title, sub }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <p style={{ color: t.text, fontWeight: 800, fontSize: 15 }}>{title}</p>
      {sub && <p style={{ color: t.sub, fontSize: 12, marginTop: 3, lineHeight: 1.5 }}>{sub}</p>}
    </div>
  );
}


function CrashLogsPanel({ t, dm, ask, notify }) {
    const [crashLogs, setCrashLogs] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
      const r = ref(db, "tas9_crash_logs");
      const unsub = onValue(r, (snap) => {
        if (snap.exists()) {
          const data = snap.val();
          const logs = Object.entries(data)
            .map(([id, v]) => ({ id, ...v }))
            .sort((a, b) => b.ts - a.ts)
            .slice(0, 50);
          setCrashLogs(logs);
        } else {
          setCrashLogs([]);
        }
        setLoading(false);
      });
      return () => unsub();
    }, []);

    const clearAll = () => {
      remove(ref(db, "tas9_crash_logs"));
      notify("Crash logs cleared");
    };

    return (
      <>
        <SCard t={t} dm={dm} icon="🪲" title="Crash Logs" subtitle="Auto-logged errors from the app. Useful for debugging.">
          {loading && <p style={{ color: t.sub, fontSize: 13 }}>Loading logs…</p>}
          {!loading && crashLogs.length === 0 && (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <p style={{ fontSize: 28, marginBottom: 8 }}>✅</p>
              <p style={{ color: t.sub, fontSize: 13 }}>No crashes logged. All good!</p>
            </div>
          )}
          {!loading && crashLogs.length > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p style={{ color: t.sub, fontSize: 12 }}>{crashLogs.length} crash{crashLogs.length !== 1 ? "es" : ""} recorded</p>
                <Btn dm={dm} v="danger" size="sm" onClick={() => ask("Clear all crash logs?", clearAll)}>🗑️ Clear All</Btn>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {crashLogs.map(log => (
                  <div key={log.id} style={{ background: dm ? "#1a1a2e" : "#fff8f8", border: `1px solid ${dm ? "#ef444430" : "#fca5a530"}`, borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                      <p style={{ color: "#ef4444", fontWeight: 700, fontSize: 13, flex: 1 }}>⚠️ {log.message || "Unknown error"}</p>
                      <p style={{ color: t.sub, fontSize: 11, whiteSpace: "nowrap" }}>{log.tsISO ? new Date(log.tsISO).toLocaleString() : "—"}</p>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {log.deviceId && <span style={{ background: dm ? "#ffffff10" : "#00000008", borderRadius: 6, padding: "2px 8px", fontSize: 11, color: t.sub }}>Device: {log.deviceId.slice(0, 8)}…</span>}
                      {log.url && <span style={{ background: dm ? "#ffffff10" : "#00000008", borderRadius: 6, padding: "2px 8px", fontSize: 11, color: t.sub }}>{log.url.replace(window.location.origin, "")}</span>}
                    </div>
                    {log.stack && (
                      <pre style={{ marginTop: 8, color: t.sub, fontSize: 10, whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 80, overflowY: "auto", background: dm ? "#00000030" : "#00000008", borderRadius: 6, padding: "6px 8px" }}>
                        {log.stack.split("\n").slice(0, 5).join("\n")}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </SCard>
      </>
    );
  }

export default function SettingsTab({
  dm, t, isAdmin, sess, can, canSeePrices, canSeeFinancials,
  settings, setSettings, displayName, notify, ask, addLog, today, inr, uid, ts,
  safeArr, safeO, lineTotal, lineTotalWithTax, exportCSV, exportTabExcel, exportPDF,
  deliveries, setDeliv, dF, setDf, dSh, setDsh, saveD, customers, products, users, setUsers,
  onLogout, onSessUpdate, exportAll, importAll, bulkOrderSh, setBulkOrderSh,
  bulkOrderRows, setBulkOrderRows, bulkOrderDate, setBulkOrderDate, bulkOrderStatus, setBulkOrderStatus,
  invRegistry, setInvRegistry, lastReceiptData, setLastReceiptData,
  payLedgerSh, setPayLedgerSh, payLedgerCust, setPayLedgerCust, payLedgerAmt, setPayLedgerAmt,
  payLedgerNote, setPayLedgerNote, payLedgerMethod, setPayLedgerMethod, recordPaymentLedger,
  settingsSection, setSettingsSection, changePwF, setChangePwF, changePwSh, setChangePwSh,
  uF, setUf, uSh, setUsh, blkU, pF, setPf, pSh, setPsh, blkP, piF, setPiF, piSh, setPiSh, lastBackupDate,
}) {
  const [conf, setConf] = useState(null);
  const [toast, setToast] = useState(null);
  const [openRecipe, setOpenRecipe] = useState(null);

  const SECS = [
    { id: "toggles",    icon: "⚡",  label: "Features"     },
    { id: "invoice",    icon: "🧾",  label: "Invoice"      },
    { id: "account",    icon: "👤",  label: "Account"      },
    { id: "staff",      icon: "👥",  label: "Staff"        },
    { id: "machines",   icon: "⚙️",  label: "Machines"     },
    { id: "vehicles",   icon: "🚐",  label: "Vehicles"     },
    { id: "products",   icon: "📦",  label: "Products"     },
    { id: "recipes",    icon: "🧪",  label: "Recipes"      },
    { id: "production", icon: "🏭",  label: "Production"   },
    { id: "access",     icon: "🔒",  label: "Permissions"  },
    { id: "app",        icon: "🎨",  label: "Branding"     },
    { id: "alerts",     icon: "🔔",  label: "Alerts"       },
    { id: "security",   icon: "🛡️",  label: "Security"     },
    { id: "data",       icon: "💾",  label: "Data"         },
    { id: "crashlogs",  icon: "🪲",  label: "Crash Logs"   },
  ];

  // ─── Staff portal helpers ────────────────────────────────────────────────
  const sp = settings?.staffPortal || {};
  const upd = (key, val) => setSettings(s => ({ ...s, staffPortal: { ...(s.staffPortal || {}), [key]: val } }));
  const updArr = (key, arr) => upd(key, arr);
  const spOn = (key, def = false) => sp[key] !== undefined ? sp[key] : def;

  function TRow({ label, desc, settingKey, defOn = false }) {
    const on = sp[settingKey] !== undefined ? sp[settingKey] : defOn;
    return <TogRow t={t} dm={dm} label={label} desc={desc} on={on} onChange={() => upd(settingKey, !on)} />;
  }

  function TField({ label, settingKey, placeholder, sub }) {
    return (
      <div style={{ marginBottom: 14 }}>
        <p style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>{label}</p>
        {sub && <p style={{ color: t.sub, fontSize: 10, marginBottom: 6, lineHeight: 1.5 }}>{sub}</p>}
        <Inp dm={dm} value={sp[settingKey] || ""} onChange={e => upd(settingKey, e.target.value)} placeholder={placeholder} />
      </div>
    );
  }

  function EditList({ label, icon, settingKey, defaults, color }) {
    const items = sp[settingKey] || defaults;
    return (
      <ChipList t={t} dm={dm} label={label} icon={icon} items={items} color={color}
        onAdd={v => updArr(settingKey, [...items, v])}
        onRemove={i => updArr(settingKey, items.filter((_, j) => j !== i))} />
    );
  }

  function QtyPresetAdder() {
    const [draft, setDraft] = useState("");
    const presets = sp.productionQtyPresets || [250, 500, 750, 1000];
    return (
      <div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {presets.map((v, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "#f9731618", border: "1.5px solid #f9731644", borderRadius: 20, padding: "5px 12px",
            }}>
              <span style={{ color: "#f97316", fontSize: 12, fontWeight: 700 }}>{v} KG</span>
              <button onClick={() => upd("productionQtyPresets", presets.filter((_, j) => j !== i))}
                style={{ color: "#f97316", background: "none", border: "none", cursor: "pointer", fontSize: 13, lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && +draft > 0) { upd("productionQtyPresets", [...presets, +draft]); setDraft(""); } }}
            placeholder="e.g. 1500"
            style={{
              flex: 1, background: t.inp, border: `1px solid ${t.border}`,
              color: t.text, borderRadius: 10, padding: "9px 12px", fontSize: 13, outline: "none",
            }} />
          <button onClick={() => { if (+draft > 0) { upd("productionQtyPresets", [...presets, +draft]); setDraft(""); } }}
            style={{ background: "#f97316", color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            + Add
          </button>
        </div>
      </div>
    );
  }

  // ─── Toggle helper for global settings ─────────────────────────────────
  function GTogRow({ label, desc, icon, settingKey, defOn = false }) {
    const on = settings?.[settingKey] !== undefined ? settings[settingKey] : defOn;
    return (
      <TogRow t={t} dm={dm} label={`${icon ? icon + " " : ""}${label}`} desc={desc}
        on={on} onChange={() => setSettings(s => ({ ...s, [settingKey]: !on }))} />
    );
  }

  // ─── RoleDefaultsCard ────────────────────────────────────────────────────
  function RoleDefaultsCard({ role, color, emoji, title, subtitle, tabDef, fpDef, tabDefKey, fpDefKey, accounts }) {
    const [openSec, setOpenSec] = React.useState(null);
    const sectionColors = { Customers: "#0ea5e9", Deliveries: "#f59e0b", Supplies: "#8b5cf6", Wastage: "#f97316", Production: "#6366f1", QC: "#14b8a6", Dashboard: "#10b981", GPS: "#22c55e", Data: "#64748b" };
    return (
      <Card dm={dm} style={{ overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "14px 16px 12px", borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                background: color + "22", color, width: 38, height: 38, borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0,
              }}>{emoji}</div>
              <div>
                <p style={{ color: t.text, fontWeight: 700, fontSize: 14 }}>{title}</p>
                <p style={{ color: t.sub, fontSize: 11, marginTop: 2 }}>{accounts.length} account{accounts.length !== 1 ? "s" : ""} · {subtitle}</p>
              </div>
            </div>
            <Btn dm={dm} size="sm" onClick={() => { setUf({ ...blkU(), role, permissions: [...tabDef], finePerms: { ...fpDef } }); setUsh("add"); }}>+ Add</Btn>
          </div>
        </div>

        {/* Accounts list */}
        {accounts.length > 0 && (
          <div style={{ padding: "12px 16px 4px" }}>
            <p style={{ color: t.sub, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Accounts</p>
            {accounts.map(u => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${t.border}`, gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div style={{
                    background: color + "22", color, width: 32, height: 32, borderRadius: 10,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, flexShrink: 0,
                  }}>{u.name.charAt(0).toUpperCase()}</div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ color: t.text, fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</p>
                    <p style={{ color: t.sub, fontSize: 10 }}>@{u.username} · <span style={{ color: u.active ? "#10b981" : "#ef4444" }}>{u.active ? "Active" : "Inactive"}</span></p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => { setUf({ ...u, password: "" }); setUsh(u); }} style={{ background: t.inp, color: t.text, border: `1px solid ${t.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Edit</button>
                  <button onClick={() => ask(`Remove ${u.name}?`, () => { setUsers(p => p.filter(x => x.id !== u.id)); notify("Account removed"); })} style={{ background: "#ef444420", color: "#ef4444", border: "1px solid #ef444430", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Del</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab access */}
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${t.border}` }}>
          <p style={{ color: t.sub, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Default section access (new accounts)</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6 }}>
            {ALL_TABS.filter(tb => tb !== "Settings").map(tb => {
              const on = tabDef.includes(tb);
              const icons = { Dashboard: "📊", Customers: "👥", Deliveries: "🚚", Supplies: "📦", Expenses: "💸", Wastage: "🗑️", "P&L": "📈", Analytics: "🔍", Production: "🏭" };
              return (
                <button key={tb} onClick={() => {
                  const next = on ? tabDef.filter(x => x !== tb) : [...tabDef, tb];
                  setSettings(s => ({ ...s, [tabDefKey]: next }));
                }} style={{
                  background: on ? color + "18" : t.card,
                  border: `1.5px solid ${on ? color : t.border}`,
                  borderRadius: 10, padding: "8px 10px",
                  display: "flex", alignItems: "center", gap: 7,
                  cursor: "pointer", transition: "all 0.15s",
                }}>
                  <span style={{ fontSize: 14 }}>{icons[tb] || "•"}</span>
                  <span style={{ color: on ? color : t.sub, fontSize: 11, fontWeight: 700, flex: 1, textAlign: "left" }}>{tb}</span>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: on ? color : "transparent", border: `2px solid ${on ? color : t.border}`, flexShrink: 0 }} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Fine permissions */}
        <div style={{ padding: "0 16px 14px", borderTop: `1px solid ${t.border}` }}>
          <p style={{ color: t.sub, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 12, marginBottom: 4 }}>Default action permissions (new accounts)</p>
          <p style={{ color: t.sub, fontSize: 10, marginBottom: 10 }}>Existing accounts keep their own settings.</p>
          {[...new Set(FINE_PERM_DEFS.map(d => d.section))].map(sec => {
            const perms = FINE_PERM_DEFS.filter(d => d.section === sec);
            const sc = sectionColors[sec] || "#6b7280";
            const allOn = perms.every(d => fpDef[d.key]);
            const anyOn = perms.some(d => fpDef[d.key]);
            const isOpen = openSec === sec;
            return (
              <div key={sec} style={{ border: `1px solid ${t.border}`, borderRadius: 12, marginBottom: 6, overflow: "hidden" }}>
                <button onClick={() => setOpenSec(isOpen ? null : sec)} style={{
                  width: "100%", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8,
                  background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: allOn ? sc : anyOn ? sc + "88" : "transparent", border: `2px solid ${allOn ? sc : sc + "44"}`, flexShrink: 0 }} />
                  <p style={{ color: t.text, fontWeight: 700, fontSize: 12, flex: 1 }}>{sec}</p>
                  <span style={{ color: t.sub, fontSize: 10 }}>{perms.filter(d => fpDef[d.key]).length}/{perms.length} on</span>
                  <span style={{ color: t.sub, fontSize: 11, marginLeft: 4 }}>{isOpen ? "▲" : "▼"}</span>
                </button>
                {isOpen && (
                  <div style={{ borderTop: `1px solid ${t.border}` }}>
                    <div style={{ padding: "6px 14px", display: "flex", justifyContent: "flex-end", gap: 8, borderBottom: `1px solid ${t.border}` }}>
                      <button onClick={() => { const upd = { ...fpDef }; perms.forEach(d => { upd[d.key] = true; }); setSettings(s => ({ ...s, [fpDefKey]: upd })); }} style={{ fontSize: 11, fontWeight: 700, color: sc, background: sc + "18", border: `1px solid ${sc + "44"}`, borderRadius: 7, padding: "5px 12px", cursor: "pointer" }}>Grant all</button>
                      <button onClick={() => { const upd = { ...fpDef }; perms.forEach(d => { upd[d.key] = false; }); setSettings(s => ({ ...s, [fpDefKey]: upd })); }} style={{ fontSize: 11, fontWeight: 700, color: t.sub, background: "transparent", border: `1px solid ${t.border}`, borderRadius: 7, padding: "5px 12px", cursor: "pointer" }}>Revoke all</button>
                    </div>
                    {perms.map(({ key, label, desc, icon }) => {
                      const on = fpDef[key] === true;
                      return (
                        <div key={key} style={{ padding: "10px 14px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14, width: 22, textAlign: "center", flexShrink: 0 }}>{icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ color: on ? t.text : t.sub, fontSize: 12, fontWeight: 600 }}>{label}</p>
                            <p style={{ color: t.sub, fontSize: 10, marginTop: 2 }}>{desc}</p>
                          </div>
                          <Tog dm={dm} on={on} onChange={() => { setSettings(s => ({ ...s, [fpDefKey]: { ...(s[fpDefKey] || defaultFinePerms(role)), [key]: !on } })); }} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  // ─── Shared staff data ───────────────────────────────────────────────────
  const allStaff = users.filter(u => u.role === "factory" || u.role === "agent");
  const shiftOpts = settings?.shifts || ["Morning", "Afternoon", "Evening", "Night"];
  const deptOpts = settings?.staffDepartments || ["Production", "Delivery", "Packaging", "Cleaning", "Admin", "Other"];
  const roleOpts = settings?.staffRoles || ["Roti Maker", "Packer", "Delivery", "Cleaner", "Supervisor", "Admin"];
  const sectionColors = { Customers: "#0ea5e9", Deliveries: "#f59e0b", Supplies: "#8b5cf6", Wastage: "#f97316", Production: "#6366f1", QC: "#14b8a6", Dashboard: "#10b981", GPS: "#22c55e", Data: "#64748b" };
  const factoryFpDef = settings?.factoryFinePermsDef || defaultFinePerms("factory");
  const agentFpDef = settings?.agentFinePermsDef || defaultFinePerms("agent");
  const factoryTabDef = settings?.factoryDefaultPerms || ROLE_DEF.factory;
  const agentTabDef = settings?.agentDefaultPerms || ROLE_DEF.agent;

  // ─── numInput helper ─────────────────────────────────────────────────────
  const numInput = (value, onChange, min, max, width = "100%") => (
    <input type="number" min={min} max={max} value={value} onChange={onChange}
      style={{
        background: t.inp, border: `1.5px solid ${t.border}`, color: t.text,
        borderRadius: 10, padding: "9px 12px", fontSize: 14, width, outline: "none",
      }} />
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION RENDERERS
  // ═══════════════════════════════════════════════════════════════════════════

  function renderToggles() {
    return (
      <>
        {/* Orders & Delivery */}
        <SCard t={t} dm={dm} icon="📦" title="Orders & Delivery" subtitle="Core features for the delivery workflow">
          {[
            { key: "bulkOrderEnabled", label: "Bulk Order Entry", desc: "Create orders for multiple customers at once", defOn: true },
            { key: "featureSmartDeduction", label: "Smart Auto-Deduct", desc: "Auto-reduce supply stock when production is logged", defOn: true },
            { key: "featureShiftManagement", label: "Shift Management", desc: "Enable shift-based scheduling and handovers", defOn: true },
            { key: "featureOrderDateOverride", label: "Order Date Override", desc: "Allow agents to backdate or forward-date orders", defOn: false },
            { key: "featureRouteOpt", label: "Route Optimization", desc: "Auto-suggest delivery routes for agents", defOn: false },
          ].map(({ key, label, desc, defOn }) => (
            <GTogRow key={key} settingKey={key} label={label} desc={desc} defOn={defOn} />
          ))}
        </SCard>

        {/* Finance */}
        <SCard t={t} dm={dm} icon="💰" title="Finance" subtitle="Financial controls and calculations">
          {/* Credit Limit */}
          {(() => {
            const isOn = !!settings?.featureCreditLimit;
            return (
              <div style={{ borderBottom: `1px solid ${t.border}` }}>
                <TogRow t={t} dm={dm} label="💳 Credit Limit Enforcement" desc="Block orders when customer exceeds their credit limit" on={isOn} onChange={() => setSettings(s => ({ ...s, featureCreditLimit: !isOn }))}>
                  {isOn && (
                    <div style={{ marginTop: 10 }}>
                      <Inp dm={dm} label="Default Credit Limit (₹)" type="number" inputMode="numeric"
                        value={settings?.creditLimitDefault || ""}
                        onChange={e => setSettings(s => ({ ...s, creditLimitDefault: +e.target.value || 0 }))}
                        placeholder="0 = no default limit" />
                      <p style={{ color: t.sub, fontSize: 10, marginTop: 4 }}>Applied to new customers. Override per customer in their profile.</p>
                    </div>
                  )}
                </TogRow>
              </div>
            );
          })()}
          {/* Tax */}
          {(() => {
            const isOn = !!settings?.featureTaxCalc;
            return (
              <div style={{ borderBottom: `1px solid ${t.border}` }}>
                <TogRow t={t} dm={dm} label="🧾 Tax Calculation (GST/VAT)" desc="Apply tax automatically on invoices and order totals" on={isOn} onChange={() => setSettings(s => ({ ...s, featureTaxCalc: !isOn }))}>
                  {isOn && (
                    <div style={{ marginTop: 10 }}>
                      <Inp dm={dm} label="Tax Rate (%)" type="number" inputMode="decimal"
                        value={settings?.taxRate || ""}
                        onChange={e => setSettings(s => ({ ...s, taxRate: +e.target.value || 0 }))}
                        placeholder="e.g. 5 for 5% GST" />
                    </div>
                  )}
                </TogRow>
              </div>
            );
          })()}
          <GTogRow settingKey="featureMultiCurrency" label="Multi-Currency Support" desc="Accept orders in different currencies" />
        </SCard>

        {/* Reports */}
        <SCard t={t} dm={dm} icon="📊" title="Reports & Analytics" subtitle="Control what appears in reports">
          {[
            { key: "invoiceShowOnReports", label: "Invoice Numbers in Reports", desc: "Display invoice ID on all exported and printed reports", defOn: true },
            { key: "invoiceShowOnPnL", label: "Invoice Numbers in P&L", desc: "Show invoice references on profit & loss statements", defOn: true },
            { key: "invoiceShowOnAnalytics", label: "Invoice Numbers in Analytics", desc: "Include invoice data in analytics breakdowns", defOn: true },
          ].map(({ key, label, desc, defOn }) => (
            <GTogRow key={key} settingKey={key} label={label} desc={desc} defOn={defOn} />
          ))}
        </SCard>

        {/* Agent features */}
        <SCard t={t} dm={dm} icon="🚚" title="Delivery Agent Features" subtitle="Control what agents can see and do">
          {[
            { key: "agentCollectEnabled", label: "Agent Cash Collection", desc: "Show the Collect button so agents can record cash on delivery", defOn: true },
            { key: "agentCollectRequireNote", label: "Require Collection Note", desc: "Agent must enter a note before confirming collection", defOn: false },
            { key: "agentInvoiceEnabled", label: "Delivery Receipts", desc: "Show Receipt button on delivery cards", defOn: true },
            { key: "agentInvoiceShowPrices", label: "Show Prices on Receipt", desc: "Include unit prices and totals on the printed receipt", defOn: true },
            { key: "agentAutoReceipt", label: "Auto-print After Collection", desc: "Auto-trigger print dialog when agent confirms collection", defOn: true },
          ].map(({ key, label, desc, defOn }) => (
            <GTogRow key={key} settingKey={key} label={label} desc={desc} defOn={defOn} />
          ))}
        </SCard>

        {/* App & UX */}
        <SCard t={t} dm={dm} icon="📱" title="App & UX" subtitle="Install experience and interface improvements">
          {[
            { key: "featurePWA", label: "PWA / Install on Home Screen", desc: "Enable install prompt + offline service worker", defOn: false },
            { key: "featureTickRedesign", label: "Redesigned Delivery Tick UI", desc: "Larger, cleaner toggle-style mark-delivered button on delivery cards", defOn: true },
          ].map(({ key, label, desc, defOn }) => (
            <GTogRow key={key} settingKey={key} label={label} desc={desc} defOn={defOn} />
          ))}
        </SCard>

        {/* Operations */}
        <SCard t={t} dm={dm} icon="🏭" title="Operations" subtitle="Factory floor and fleet management features">
          {[
            { key: "featureIngredientTracking", label: "Ingredient Tracking", desc: "Auto-deduct raw ingredients from stock when batches are logged", defOn: false, configSection: null },
            { key: "featureStaffAttendance", label: "Staff Attendance & Shift Log", desc: "Track who clocked in, when, and hours per shift", defOn: false, configSection: "staffatt" },
            { key: "featureMachineMaintenance", label: "Machine Maintenance Log", desc: "Track equipment servicing history and flag overdue maintenance", defOn: false, configSection: "machines" },
            { key: "featureVanManagement", label: "Vehicle / Van Management", desc: "Assign vans to routes, track capacity, and log fuel usage", defOn: false, configSection: "vehicles" },
          ].map(({ key, label, desc, defOn, configSection }) => {
            const isOn = settings?.[key] !== undefined ? settings[key] : defOn;
            return (
              <TogRow key={key} t={t} dm={dm} label={label} desc={desc} on={isOn} onChange={() => setSettings(s => ({ ...s, [key]: !isOn }))}>
                {isOn && configSection && (
                  <button onClick={() => setSettingsSection(configSection)} style={{ background: "none", border: "none", padding: 0, color: t.accent, fontSize: 11, fontWeight: 700, cursor: "pointer", marginTop: 4 }}>
                    Configure →
                  </button>
                )}
              </TogRow>
            );
          })}
        </SCard>

        {/* Advanced */}
        <SCard t={t} dm={dm} icon="🔗" title="Advanced & Integrations" subtitle="Power features and third-party connections">
          {[
            { key: "featureGST", label: "GST Invoice Generation", desc: "GSTIN, HSN codes, CGST/SGST breakdowns on invoices", defOn: false },
            { key: "featureCustomDashboard", label: "Customisable Dashboard per Role", desc: "Each user picks which widgets they see", defOn: false },
            { key: "featureGoogleSheets", label: "Export to Google Sheets", desc: "Push data directly to a Google Sheet", defOn: false },
            { key: "featurePrintLabels", label: "Print Label Generation", desc: "Generate delivery labels with name, address, and QR code", defOn: false },
            { key: "featureMultiLanguage", label: "Multi-Language Support", desc: "Hindi, Malayalam, or Kannada alongside English", defOn: false },
          ].map(({ key, label, desc, defOn }) => (
            <GTogRow key={key} settingKey={key} label={label} desc={desc} defOn={defOn} />
          ))}
          {/* GST config */}
          {settings?.featureGST && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1.5px solid ${t.border}`, display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ color: t.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>GST Configuration</p>
              {[{ key: "gstCompanyGSTIN", label: "Company GSTIN", placeholder: "22AAAAA0000A1Z5" }, { key: "gstDefaultHSN", label: "Default HSN Code", placeholder: "e.g. 1905" }].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <p style={{ color: t.sub, fontSize: 11, marginBottom: 5 }}>{label}</p>
                  <input value={settings?.[key] || ""} onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))} placeholder={placeholder}
                    style={{ background: t.inp, border: `1.5px solid ${t.border}`, color: t.text, borderRadius: 10, padding: "9px 12px", fontSize: 14, width: "100%", outline: "none", boxSizing: "border-box" }} />
                </div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[{ key: "gstCGSTPct", label: "CGST %" }, { key: "gstSGSTPct", label: "SGST %" }].map(({ key, label }) => (
                  <div key={key}>
                    <p style={{ color: t.sub, fontSize: 11, marginBottom: 5 }}>{label}</p>
                    <input type="number" min="0" max="28" value={settings?.[key] ?? 9} onChange={e => setSettings(s => ({ ...s, [key]: Number(e.target.value) }))}
                      style={{ background: t.inp, border: `1.5px solid ${t.border}`, color: t.text, borderRadius: 10, padding: "9px 12px", fontSize: 14, width: "100%", outline: "none" }} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Google Sheets config */}
          {settings?.featureGoogleSheets && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1.5px solid ${t.border}`, display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ color: t.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Google Sheets</p>
              <div style={{ background: dm ? "rgba(59,130,246,0.08)" : "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 12px" }}>
                <p style={{ color: "#1d4ed8", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>📋 Setup Instructions</p>
                <p style={{ color: dm ? "#93c5fd" : "#1e40af", fontSize: 10, lineHeight: 1.7 }}>
                  1. Open your Google Sheet → Extensions → Apps Script<br />
                  2. Create a new script, paste the TAS push handler (doPost), save & deploy<br />
                  3. Set <b>Execute as: Me</b> · <b>Access: Anyone</b><br />
                  4. Copy the <b>/exec URL</b> and paste it below
                </p>
              </div>
              <div>
                <p style={{ color: t.sub, fontSize: 11, marginBottom: 5 }}>Apps Script Web App URL <span style={{ color: "#ef4444", fontWeight: 700 }}>*</span></p>
                <input value={settings?.googleSheetsWebAppUrl || ""} onChange={e => setSettings(s => ({ ...s, googleSheetsWebAppUrl: e.target.value }))} placeholder="https://script.google.com/macros/s/.../exec"
                  style={{ background: t.inp, border: `1.5px solid ${settings?.googleSheetsWebAppUrl ? t.accent : t.border}`, color: t.text, borderRadius: 10, padding: "9px 12px", fontSize: 13, width: "100%", outline: "none", boxSizing: "border-box" }} />
              </div>
              {settings?.googleSheetsWebAppUrl && (
                <div style={{ background: dm ? "rgba(16,185,129,0.08)" : "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "8px 12px" }}>
                  <p style={{ color: "#059669", fontSize: 11, fontWeight: 700 }}>✓ URL configured — Push to Sheets buttons now appear on Deliveries and Expenses tabs</p>
                </div>
              )}
            </div>
          )}
        </SCard>
      </>
    );
  }

  function renderInvoice() {
    const prefix = settings?.invoicePrefix || "TAS";
    const startSeq = settings?.invoiceStartSeq || 1;
    const yearReset = settings?.invoiceYearReset !== false;
    const currentSeq = invRegistry?.seq || 0;
    const year = new Date().getFullYear();
    const previewNo = `${prefix}-${yearReset ? year + "-" : ""}${String(Math.max(currentSeq + 1, startSeq)).padStart(4, "0")}`;
    const previewReceipt = `RCP-${yearReset ? year + "-" : ""}${String(Math.max(currentSeq + 1, startSeq)).padStart(4, "0")}`;
    const totalIssued = Object.keys(invRegistry?.issued || {}).length;
    return (
      <>
        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 4 }}>
          {[
            { label: "Issued", val: totalIssued, color: "#8b5cf6" },
            { label: "Current #", val: `#${currentSeq}`, color: "#f59e0b" },
            { label: "Next", val: previewNo, color: "#10b981" },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ background: t.inp, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
              <p style={{ color, fontWeight: 900, fontSize: 14, fontFamily: "monospace", lineHeight: 1 }}>{val}</p>
              <p style={{ color: t.sub, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 5 }}>{label}</p>
            </div>
          ))}
        </div>

        <SCard t={t} dm={dm} icon="📐" title="Number Format" subtitle="Defines how invoice numbers look system-wide">
          <div style={{ marginBottom: 14 }}>
            <label style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Invoice Prefix</label>
            <input value={settings?.invoicePrefix || "TAS"}
              onChange={e => setSettings(s => ({ ...s, invoicePrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) }))}
              maxLength={8} placeholder="TAS"
              style={{ background: t.inp, border: `1.5px solid ${t.border}`, color: t.text, borderRadius: 12, padding: "10px 14px", fontSize: 16, width: "100%", outline: "none", fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.08em", boxSizing: "border-box" }} />
            <p style={{ color: t.sub, fontSize: 10, marginTop: 4 }}>Letters and numbers only, max 8 chars. e.g. TAS, INV, ORD</p>
          </div>
          <TogRow t={t} dm={dm} label="📅 Year in Number" desc={`Include current year: TAS-${year}-0001 vs TAS-0001`} on={yearReset} onChange={() => setSettings(s => ({ ...s, invoiceYearReset: !yearReset }))} />
          <TogRow t={t} dm={dm} label="🔁 Reset Sequence Yearly" desc="Restart from 0001 at the start of each year" on={settings?.invoiceResetYearly !== false} onChange={() => setSettings(s => ({ ...s, invoiceResetYearly: s?.invoiceResetYearly === false }))} />
        </SCard>

        <SCard t={t} dm={dm} icon="👁" title="Live Preview">
          {[
            { label: "Invoice", val: previewNo, color: "#8b5cf6" },
            { label: "Receipt", val: previewReceipt, color: "#0ea5e9" },
            { label: "Shown in P&L", val: settings?.invoiceShowOnPnL !== false ? "✓ Yes" : "✗ Hidden", color: settings?.invoiceShowOnPnL !== false ? "#10b981" : "#ef4444" },
            { label: "Shown in Analytics", val: settings?.invoiceShowOnAnalytics !== false ? "✓ Yes" : "✗ Hidden", color: settings?.invoiceShowOnAnalytics !== false ? "#10b981" : "#ef4444" },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${t.border}` }}>
              <span style={{ color: t.sub, fontSize: 12 }}>{label}</span>
              <span style={{ color, fontWeight: 800, fontSize: 13, fontFamily: "monospace" }}>{val}</span>
            </div>
          ))}
        </SCard>

        <SCard t={t} dm={dm} icon="📍" title="Where invoice numbers appear" subtitle="System-wide control — applies across all modules">
          {[
            { key: "invoiceShowOnReports", label: "All Printed Reports", desc: "PDF exports, daily sheets, delivery reports" },
            { key: "invoiceShowOnPnL", label: "Profit & Loss Reports", desc: "P&L monthly and yearly statements" },
            { key: "invoiceShowOnAnalytics", label: "Analytics Dashboard", desc: "Analytics tab data tables and exports" },
          ].map(({ key, label, desc }) => (
            <TogRow key={key} t={t} dm={dm} label={label} desc={desc}
              on={settings?.[key] !== false}
              onChange={() => setSettings(s => ({ ...s, [key]: s?.[key] === false ? true : false }))} />
          ))}
        </SCard>

        <SCard t={t} dm={dm} icon="⚠️" title="Sequence Management">
          <p style={{ color: t.sub, fontSize: 12, marginBottom: 12 }}>Total issued: <strong style={{ color: t.text }}>{totalIssued}</strong> invoices. Current counter: <strong style={{ color: t.text }}>{currentSeq}</strong>.</p>
          <Btn dm={dm} v="danger" size="sm" onClick={() => ask(`Reset invoice counter to 0? All ${totalIssued} existing invoice numbers will remain linked to their deliveries.`, () => { setInvRegistry({ seq: 0, issued: invRegistry?.issued || {} }); notify("Invoice counter reset to 0 ✓"); })}>
            Reset Counter (keep existing)
          </Btn>
        </SCard>
      </>
    );
  }

  function renderAccount() {
    return (
      <>
        {users.filter(u => u.role === "admin").map(u => {
          const isMe = u.id === sess.id;
          return (
            <SCard key={u.id} t={t} dm={dm}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{ background: t.accent, color: t.accentFg, width: 44, height: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, flexShrink: 0 }}>
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <p style={{ color: t.text, fontWeight: 700, fontSize: 14 }}>{u.name}</p>
                    {isMe && <span style={{ background: "#f59e0b22", color: "#f59e0b", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 99 }}>YOU</span>}
                  </div>
                  <p style={{ color: t.sub, fontSize: 11, marginTop: 2 }}>@{u.username} · Admin</p>
                </div>
                <Pill dm={dm} c={u.active ? "green" : "stone"}>{u.active ? "Active" : "Inactive"}</Pill>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Btn dm={dm} v="ghost" size="sm" onClick={() => { setUf({ ...u, password: "" }); setUsh(u); }}>✏️ Edit Profile</Btn>
                {isMe && <Btn dm={dm} v="ghost" size="sm" onClick={() => { setChangePwF({ current: "", next: "", confirm: "" }); setChangePwSh(true); }}>🔑 Change Password</Btn>}
                {!isMe && <Btn dm={dm} v="danger" size="sm" onClick={() => ask(`Remove ${u.name}?`, () => { setUsers(p => p.filter(x => x.id !== u.id)); notify("Account removed"); })}>Remove</Btn>}
              </div>
              {isMe && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.border}` }}>
                  <p style={{ color: t.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>🌐 My Language</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[{ code: "en", label: "English" }, { code: "hi", label: "हिंदी" }, { code: "mr", label: "मराठी" }].map(lg => {
                      const active = (u.lang || "en") === lg.code;
                      return (
                        <button key={lg.code} onClick={() => { setUsers(p => safeArr(p).map(x => x.id === u.id ? { ...x, lang: lg.code } : x)); if (isMe) onSessUpdate(s => s ? { ...s, lang: lg.code } : s); notify(`Language set to ${lg.label} ✓`); }}
                          style={{ background: active ? t.accent : t.inp, color: active ? t.accentFg : t.sub, border: `1.5px solid ${active ? t.accent : t.border}`, borderRadius: 10, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                          {lg.label}
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ color: t.sub, fontSize: 10, marginTop: 6 }}>Applies to this account across all devices.</p>
                </div>
              )}
            </SCard>
          );
        })}
        {users.filter(u => u.role === "admin").length < 2 && (
          <button onClick={() => { setUf({ ...blkU(), role: "admin", permissions: [...ALL_TABS] }); setUsh("add"); }}
            style={{ border: `2px dashed ${t.border}`, color: t.sub, width: "100%", borderRadius: 16, padding: "16px", fontSize: 13, fontWeight: 600, cursor: "pointer", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.15s" }}>
            <span style={{ fontSize: 18 }}>+</span> Add Second Admin
          </button>
        )}

        {/* Staff Login Mode */}
        <SCard t={t} dm={dm} title="Staff Login Mode" subtitle="Choose how staff identify themselves. Changes take effect immediately.">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(220px, 100%), 1fr))", gap: 10, marginBottom: 14 }}>
            {[
              { mode: "individual", icon: "🔐", title: "Individual Login", desc: "Each staff member has their own username & password. Best for accountability." },
              { mode: "picker", icon: "👆", title: "Staff Picker", desc: "A shared account with a name picker at the top. Best for fast-paced environments." },
            ].map(opt => {
              const active = (settings?.staffLoginMode || "individual") === opt.mode;
              return (
                <button key={opt.mode} onClick={() => setSettings(s => ({ ...s, staffLoginMode: opt.mode }))}
                  style={{ background: active ? "#16a34a22" : t.inp, border: `2px solid ${active ? "#16a34a" : t.border}`, borderRadius: 16, padding: "16px", textAlign: "left", cursor: "pointer", transition: "all 0.15s" }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{opt.icon}</div>
                  <p style={{ color: active ? "#16a34a" : t.text, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{opt.title}</p>
                  <p style={{ color: t.sub, fontSize: 11, lineHeight: 1.5 }}>{opt.desc}</p>
                  {active && <p style={{ color: "#16a34a", fontSize: 11, fontWeight: 700, marginTop: 8 }}>✓ ACTIVE</p>}
                </button>
              );
            })}
          </div>
          {(settings?.staffLoginMode || "individual") === "picker" && (
            <>
              <Hr dm={dm} />
              <div style={{ marginTop: 12 }}>
                <p style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Staff Names for Picker</p>
                <p style={{ color: t.sub, fontSize: 11, marginBottom: 10 }}>Names shown in the picker. Usually matches your staff accounts.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 8 }}>
                  {(settings?.staffNames || []).map((name, i) => (
                    <div key={i} style={{ display: "flex", gap: 8 }}>
                      <input value={name} placeholder="Staff name"
                        onChange={e => { const names = [...(settings?.staffNames || [])]; names[i] = e.target.value; setSettings(s => ({ ...s, staffNames: names })); }}
                        style={{ flex: 1, background: t.inp, border: `1px solid ${t.border}`, color: t.text, borderRadius: 10, padding: "9px 12px", fontSize: 13, outline: "none" }} />
                      <button onClick={() => { const names = (settings?.staffNames || []).filter((_, j) => j !== i); setSettings(s => ({ ...s, staffNames: names })); }}
                        style={{ width: 36, height: 36, borderRadius: 10, background: "#ef444420", color: "#ef4444", border: "1px solid #ef444430", fontWeight: 700, fontSize: 16, cursor: "pointer", flexShrink: 0 }}>✕</button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setSettings(s => ({ ...s, staffNames: [...(s.staffNames || []), ""] }))}
                  style={{ border: `1.5px dashed ${t.border}`, color: t.sub, width: "100%", borderRadius: 10, padding: "9px", fontSize: 13, fontWeight: 600, cursor: "pointer", background: "transparent" }}>
                  + Add Name
                </button>
              </div>
            </>
          )}
        </SCard>
      </>
    );
  }

  function renderStaff() {
    return (
      <>
        <SecHeading t={t} title="📱 Staff Portal Settings" sub="Control every feature, label, and list visible to staff in their portal. Changes save to cloud and appear immediately." />

        {/* Branding */}
        <SCard t={t} dm={dm} icon="🎨" title="Staff App Branding" subtitle="Customize labels and text shown to staff in their portal.">
          <TRow label="☀️ Light Mode for Staff App" desc="Staff portal uses a light theme instead of dark" settingKey="staffLightMode" />
          <div style={{ height: 12 }} />
          <TField label="Staff Tab Title" settingKey="staffTabTitle" placeholder="e.g. My Shift" sub="Header shown at top of the staff home tab" />
          <TField label="Staff Tab Subtitle" settingKey="staffTabSubtitle" placeholder="e.g. Track your work today" />
          <TField label="Clock-In Button Label" settingKey="clockInLabel" placeholder="Clock In" />
          <TField label="Clock-Out Button Label" settingKey="clockOutLabel" placeholder="Clock Out" />
          <TField label="Break Button Label" settingKey="breakLabel" placeholder="Take Break" />
        </SCard>

        {/* Delivery */}
        <SCard t={t} dm={dm} icon="🚚" title="Delivery Tab" subtitle="Control what delivery staff can see and do.">
          <TRow label="Show Delivery Tab" settingKey="showDeliveryTab" defOn={true} />
          <TRow label="Allow Log Entry" desc="Staff can log new deliveries" settingKey="deliveryCanAdd" defOn={true} />
          <TRow label="Allow Dispatch" desc="Staff can mark orders as dispatched" settingKey="deliveryCanDispatch" defOn={true} />
          <TRow label="Allow Mark Delivered" desc="Staff can advance order to delivered" settingKey="deliveryCanMarkDone" defOn={true} />
          <TRow label="Allow Cancel" desc="Staff can cancel a delivery" settingKey="deliveryCanCancel" defOn={false} />
          <TRow label="Show Customer Phone" desc="Phone number visible on delivery card" settingKey="deliveryShowPhone" defOn={true} />
          <TRow label="Show Prices to Staff" desc="Staff can see order totals and prices" settingKey="deliveryShowPrices" defOn={false} />
          <TRow label="Require GPS on Dispatch" desc="Staff must share location to dispatch" settingKey="deliveryRequireGPS" defOn={false} />
        </SCard>

        {/* QC */}
        <SCard t={t} dm={dm} icon="🔬" title="QC Tab" subtitle="Configure quality control checklist and grading for staff.">
          <TRow label="Show QC Tab" settingKey="showQCTab" defOn={true} />
          <TRow label="Allow Inspect" desc="Staff can start QC inspections" settingKey="qcCanInspect" defOn={true} />
          <TRow label="Allow Export QC Reports" settingKey="qcCanExport" defOn={false} />
          <Hr dm={dm} />
          <EditList label="QC Checklist Items" icon="✅" settingKey="qcChecklist" defaults={["Visual check", "Weight check", "Packaging seal", "Label correct", "Temperature OK"]} color="#14b8a6" />
          <div style={{ height: 10 }} />
          <EditList label="QC Grade Options" icon="🏅" settingKey="qcGrades" defaults={["A", "B", "C", "Reject"]} color="#8b5cf6" />
        </SCard>

        {/* Inventory */}
        <SCard t={t} dm={dm} icon="📦" title="Inventory Tab" subtitle="Control inventory access and actions for staff.">
          <TRow label="Show Inventory Tab" settingKey="showInventoryTab" defOn={true} />
          <TRow label="Allow Add Stock" settingKey="inventoryCanAdd" defOn={true} />
          <TRow label="Allow Edit Stock" settingKey="inventoryCanEdit" defOn={true} />
          <TRow label="Allow Delete Stock" settingKey="inventoryCanDelete" defOn={false} />
          <TRow label="Show Stock Values" desc="Staff can see ₹ cost of inventory" settingKey="inventoryShowValues" defOn={false} />
          <TField label="Inventory Tab Title" settingKey="inventoryTabTitle" placeholder="Inventory" />
        </SCard>

        {/* Packing */}
        <SCard t={t} dm={dm} icon="📦" title="Packing Tab" subtitle="Configure packing slip options and presets for staff.">
          <TRow label="Show Packing Tab" settingKey="showPackingTab" defOn={true} />
          <TRow label="Allow Edit Packing" settingKey="packingCanEdit" defOn={true} />
          <TRow label="Show Price on Packing Slip" settingKey="packingShowPrice" defOn={false} />
          <Hr dm={dm} />
          <EditList label="Packing Presets (qty)" icon="🔢" settingKey="packingPresets" defaults={["50", "100", "200", "500"]} color="#f59e0b" />
        </SCard>

        {/* Production tab settings */}
        <SCard t={t} dm={dm} icon="🏭" title="Production Tab" subtitle="What production staff can log and view.">
          <p style={{ color: t.sub, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Visibility</p>
          <TRow label="Show Production Tab" settingKey="showProductionTab" defOn={true} />
          <p style={{ color: t.sub, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 14, marginBottom: 4 }}>Permissions</p>
          <TRow label="Allow Start Batch" desc="Staff can start new production batches" settingKey="productionCanAdd" defOn={true} />
          <TRow label="Allow Edit Batch" desc="Staff can edit existing batch details" settingKey="productionCanEdit" defOn={false} />
          <TRow label="Allow Delete Batch" desc="Staff can remove batches" settingKey="productionCanDelete" defOn={false} />
          <TRow label="Allow Put on Hold" desc="Staff can pause a batch mid-run" settingKey="productionCanHold" defOn={true} />
          <TRow label="Allow Mark Complete" desc="Staff can mark batch as done" settingKey="productionCanComplete" defOn={true} />
          <p style={{ color: t.sub, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 14, marginBottom: 4 }}>Display</p>
          <TRow label="Show Production Targets" desc="Display daily KG/unit targets to staff" settingKey="productionShowTargets" defOn={true} />
          <TRow label="Show Batch History" desc="Staff can see past batches in summary" settingKey="productionShowHistory" defOn={true} />
          <TRow label="Show Manual Entry Fields" settingKey="productionShowPreview" defOn={true} />
          <TRow label="Show Team Members Field" settingKey="productionShowWorkers" defOn={true} />
          <TRow label="Enable Machine Selection" desc="Staff can pick which machine to use" settingKey="productionShowMachine" defOn={true} />
          <TRow label="Show Shift Selector" desc="Let staff pick their current shift" settingKey="productionShowShift" defOn={true} />
          <TRow label="Show QC Grade on Batch" settingKey="productionShowQCGrade" defOn={true} />
          <Hr dm={dm} />
          <p style={{ color: t.sub, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Batch ID Prefix</p>
          <input value={sp.batchPrefix || "PR"} onChange={e => upd("batchPrefix", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            maxLength={6} placeholder="PR"
            style={{ background: t.inp, border: `1.5px solid ${t.border}`, color: t.text, borderRadius: 10, padding: "9px 12px", fontSize: 14, width: "100%", outline: "none", fontFamily: "monospace", fontWeight: 700, letterSpacing: "0.08em", boxSizing: "border-box" }} />
          <p style={{ color: t.sub, fontSize: 10, marginTop: 4, marginBottom: 14 }}>Labels will look like: {sp.batchPrefix || "PR"}-2026-A3F2. Letters/numbers only, max 6.</p>
          <p style={{ color: t.sub, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Qty Presets (KG)</p>
          <QtyPresetAdder />
        </SCard>

        {/* Staff Portal product/machine lists */}
        <SCard t={t} dm={dm} icon="🫓" title="Production Items (Staff Portal)">
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
            {(settings?.prodItems || []).length === 0 && <p style={{ color: t.sub, fontSize: 12 }}>No items yet — add from Production → Items.</p>}
            {(settings?.prodItems || []).map(item => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: (item.color || "#f97316") + "0d", border: `1px solid ${(item.color || "#f97316")}30`, borderRadius: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: (item.color || "#f97316") + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{item.icon || "📦"}</div>
                <p style={{ color: item.color || t.text, fontWeight: 700, fontSize: 12, flex: 1 }}>{item.name}</p>
                <button onClick={() => { setPiF({ ...item, icon: item.icon || "🫓", color: item.color || "#f97316" }); setPiSh(item); setSettingsSection("production"); }}
                  style={{ background: "none", border: "none", color: t.sub, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Edit</button>
              </div>
            ))}
          </div>
          <Btn dm={dm} v="primary" size="sm" onClick={() => { setPiF({ id: "", name: "", icon: "🫓", color: "#f97316" }); setPiSh("add"); setSettingsSection("production"); }}>+ Add Item</Btn>
        </SCard>

        <EditList label="Machine Options" icon="⚙️" settingKey="productionMachines" defaults={["Machine 1", "Machine 2", "Machine 3", "Machine 4"]} color="#8b5cf6" />
        <EditList label="Shift Options (Production)" icon="🕐" settingKey="productionShifts" defaults={["Shift A (06:00 AM - 02:00 PM)", "Shift B (02:00 PM - 10:00 PM)", "Shift C (10:00 PM - 06:00 AM)"]} color="#3b82f6" />

        {/* Default workers */}
        <SCard t={t} dm={dm} icon="👷" title="Default Team Members Required" subtitle="Default number of team members expected per batch — staff can override">
          {numInput(sp.productionDefaultWorkers ?? 12, e => upd("productionDefaultWorkers", Number(e.target.value)), 1, 200, 120)}
          <p style={{ color: t.sub, fontSize: 10, marginTop: 6 }}>Shown as the default in the Team Members field</p>
        </SCard>

        {/* Reports tab */}
        <SCard t={t} dm={dm} icon="📊" title="Reports Tab" subtitle="Control what staff can see in reports.">
          <TRow label="Show Reports Tab" settingKey="showReportsTab" defOn={true} />
          <TRow label="Allow Export PDF" settingKey="reportsCanExportPDF" defOn={false} />
          <TRow label="Allow Export CSV" settingKey="reportsCanExportCSV" defOn={false} />
          <TRow label="Show Revenue Data" desc="Staff can see revenue and price charts" settingKey="reportsShowRevenue" defOn={false} />
        </SCard>

        {/* Attendance clock */}
        <SCard t={t} dm={dm} icon="🕐" title="Attendance & Clock" subtitle="Fine-tune how staff clock in/out in their portal.">
          <TRow label="Allow Clock In/Out" settingKey="clockEnabled" defOn={true} />
          <TRow label="Allow Break Logging" settingKey="breakEnabled" defOn={true} />
          <TRow label="Require GPS on Clock-In" settingKey="clockRequireGPS" defOn={false} />
          <TRow label="Show Earnings to Staff" desc="Staff can see their daily earnings" settingKey="showEarnings" defOn={false} />
          <TRow label="Show Attendance History" desc="Staff can view their own past attendance" settingKey="showAttHistory" defOn={true} />
        </SCard>

        {/* Editable lists */}
        <EditList label="Shift Options" icon="🌅" settingKey="shifts" defaults={["Morning", "Afternoon", "Evening", "Night"]} color="#3b82f6" />
        <EditList label="Job Role Options" icon="🔧" settingKey="staffRoles" defaults={["Roti Maker", "Packer", "Delivery", "Cleaner", "Supervisor", "Admin"]} color="#a855f7" />
        <EditList label="Department Options" icon="🏢" settingKey="staffDepartments" defaults={["Production", "Delivery", "Packaging", "Cleaning", "Admin", "Other"]} color="#10b981" />
        <EditList label="Attendance Statuses" icon="🔵" settingKey="staffStatuses" defaults={["Present", "Absent", "Half Day", "Late", "On Leave"]} color="#0ea5e9" />
        <EditList label="Employment Types" icon="📄" settingKey="staffEmploymentTypes" defaults={["Full-time", "Part-time", "Contract", "Daily Wage"]} color="#f59e0b" />
        <EditList label="Salary Types" icon="💰" settingKey="staffSalaryTypes" defaults={["Monthly", "Weekly", "Daily", "Per Hour", "Per Piece"]} color="#10b981" />

        {/* Attendance config */}
        <SCard t={t} dm={dm} icon="🕐" title="Staff Attendance & Shift Log" subtitle="Enable attendance tracking and configure the log form"
          headerRight={<Tog dm={dm} on={settings?.featureStaffAttendance === true} onChange={() => setSettings(s => ({ ...s, featureStaffAttendance: !s?.featureStaffAttendance }))} />}>
          {!settings?.featureStaffAttendance && (
            <div style={{ background: "#f59e0b18", border: "1px solid #f59e0b44", borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
              <p style={{ color: "#f59e0b", fontSize: 12, fontWeight: 600 }}>⚠️ Attendance feature is off. Enable above to show it.</p>
            </div>
          )}
          {[
            { key: "staffRequireInOutTime", label: "Require In/Out Time", desc: "Make clock-in and clock-out times mandatory", defOn: false },
            { key: "staffAllowCustomName", label: "Allow Custom (Unlisted) Names", desc: "Let staff log under a name not in the roster", defOn: true },
            { key: "staffShowDepartment", label: "Show Department Field", defOn: true },
            { key: "staffShowBreakDuration", label: "Show Break Duration", defOn: false },
            { key: "staffShowTask", label: "Show Task / Assignment", defOn: false },
            { key: "staffShowOvertimeReason", label: "Show Overtime Reason", defOn: false },
            { key: "staffShowTemperature", label: "Show Temperature Field", desc: "Record body temperature for health compliance logs", defOn: false },
            { key: "staffShowSalaryType", label: "Show Salary Type in Roster", defOn: false },
            { key: "staffShowNotes", label: "Show Notes Field", defOn: true },
          ].map(({ key, label, desc, defOn }) => (
            <GTogRow key={key} settingKey={key} label={label} desc={desc} defOn={defOn} />
          ))}
          <div style={{ marginTop: 14 }}>
            <p style={{ color: t.sub, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>⏱ Overtime Threshold (hrs/day)</p>
            {numInput(settings?.staffOvertimeThresholdHrs ?? 9, e => setSettings(s => ({ ...s, staffOvertimeThresholdHrs: Number(e.target.value) })), 1, 24, 100)}
            <p style={{ color: t.sub, fontSize: 11, marginTop: 4 }}>Shifts exceeding this many hours show an overtime indicator</p>
          </div>
        </SCard>

        {/* Default Shift */}
        <SCard t={t} dm={dm} icon="📅" title="Default Shift" subtitle="Pre-selected shift when logging a new attendance record">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(settings?.shifts || ["Morning", "Afternoon", "Evening", "Night"]).map(sh => (
              <button key={sh} onClick={() => setSettings(s => ({ ...s, staffDefaultShift: sh }))}
                style={{ background: (settings?.staffDefaultShift || "Morning") === sh ? t.accent : t.inp, color: (settings?.staffDefaultShift || "Morning") === sh ? t.accentFg : t.sub, border: `1.5px solid ${(settings?.staffDefaultShift || "Morning") === sh ? t.accent : t.border}`, borderRadius: 20, padding: "7px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {sh}
              </button>
            ))}
          </div>
        </SCard>

        {/* Staff Management */}
        {allStaff.length > 0 && (
          <SCard t={t} dm={dm} icon="👥" title="Staff Management" subtitle="Edit each staff member's shift, job role and department"
            headerRight={<span style={{ background: "#10b98120", color: "#10b981", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>{allStaff.length} staff</span>}>
            {allStaff.map((u, idx) => {
              const roleColor = u.role === "factory" ? "#a855f7" : "#0ea5e9";
              const staffInfo = settings?.staffMgmt?.[u.id] || {};
              const updateStaffMgmt = (key, val) => setSettings(s => ({ ...s, staffMgmt: { ...(s.staffMgmt || {}), [u.id]: { ...(s.staffMgmt?.[u.id] || {}), [key]: val } } }));
              return (
                <div key={u.id} style={{ borderBottom: idx < allStaff.length - 1 ? `1px solid ${t.border}` : "none", paddingBottom: 14, marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ background: roleColor + "22", color: roleColor, width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, flexShrink: 0 }}>{u.name.charAt(0).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: t.text, fontWeight: 700, fontSize: 13 }}>{u.name}</p>
                      <p style={{ color: t.sub, fontSize: 10 }}>@{u.username} · <span style={{ color: roleColor }}>{u.role === "factory" ? "Factory" : "Agent"}</span> · <span style={{ color: u.active ? "#10b981" : "#ef4444" }}>{u.active ? "Active" : "Inactive"}</span></p>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(130px, 100%), 1fr))", gap: 8 }}>
                    <div>
                      <p style={{ color: t.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>🕐 Shift</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {shiftOpts.map(sh => (
                          <button key={sh} onClick={() => updateStaffMgmt("shift", sh)}
                            style={{ background: staffInfo.shift === sh ? t.accent : t.inp, color: staffInfo.shift === sh ? t.accentFg : t.sub, border: `1.5px solid ${staffInfo.shift === sh ? t.accent : t.border}`, borderRadius: 99, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            {sh}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p style={{ color: t.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>🔧 Job Role</p>
                      <select value={staffInfo.jobRole || ""} onChange={e => updateStaffMgmt("jobRole", e.target.value)}
                        style={{ background: t.inp, border: `1.5px solid ${staffInfo.jobRole ? t.accent : t.border}`, color: staffInfo.jobRole ? t.text : t.sub, borderRadius: 10, padding: "7px 10px", fontSize: 12, width: "100%", outline: "none", cursor: "pointer" }}>
                        <option value="">— Select role —</option>
                        {roleOpts.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <p style={{ color: t.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>🏢 Department</p>
                      <select value={staffInfo.dept || ""} onChange={e => updateStaffMgmt("dept", e.target.value)}
                        style={{ background: t.inp, border: `1.5px solid ${staffInfo.dept ? t.accent : t.border}`, color: staffInfo.dept ? t.text : t.sub, borderRadius: 10, padding: "7px 10px", fontSize: 12, width: "100%", outline: "none", cursor: "pointer" }}>
                        <option value="">— Select dept —</option>
                        {deptOpts.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </SCard>
        )}

        <RoleDefaultsCard role="factory" color="#a855f7" emoji="🏭" title="Factory Staff" subtitle="Manages production, supplies & QC"
          tabDef={factoryTabDef} fpDef={factoryFpDef} tabDefKey="factoryDefaultPerms" fpDefKey="factoryFinePermsDef" accounts={users.filter(u => u.role === "factory")} />
        <RoleDefaultsCard role="agent" color="#0ea5e9" emoji="🚚" title="Delivery Agents" subtitle="On the road, delivering orders"
          tabDef={agentTabDef} fpDef={agentFpDef} tabDefKey="agentDefaultPerms" fpDefKey="agentFinePermsDef" accounts={users.filter(u => u.role === "agent")} />
      </>
    );
  }

  function renderMachines() {
    return (
      <>
        <SCard t={t} dm={dm} icon="⚙️" title="Machine Maintenance Log" subtitle="Configure the Machines tab and maintenance tracking"
          headerRight={<Tog dm={dm} on={settings?.featureMachineMaintenance === true} onChange={() => setSettings(s => ({ ...s, featureMachineMaintenance: !s?.featureMachineMaintenance }))} />}>
          {!settings?.featureMachineMaintenance && (
            <div style={{ background: "#f59e0b18", border: "1px solid #f59e0b44", borderRadius: 10, padding: "10px 12px" }}>
              <p style={{ color: "#f59e0b", fontSize: 12, fontWeight: 600 }}>⚠️ Machines tab is hidden. Enable the toggle above to show it.</p>
            </div>
          )}
        </SCard>

        <SCard t={t} dm={dm} icon="🔧" title="Maintenance Options">
          {[
            { key: "machineRequireNextDue", label: "Require Next Due Date", desc: "Force a next-service date when logging maintenance", defOn: true },
            { key: "machineShowTechnician", label: "Show Technician Field", desc: "Record who carried out the maintenance work", defOn: true },
            { key: "machineShowPartsReplaced", label: "Show Parts Replaced", defOn: true },
            { key: "machineShowPartsCost", label: "Show Parts Cost", defOn: true },
            { key: "machineShowLaborCost", label: "Show Labour Cost", defOn: true },
            { key: "machineShowDowntime", label: "Show Downtime (hours)", defOn: true },
            { key: "machineShowSeverity", label: "Show Severity Level", desc: "Classify events as Low/Medium/High/Critical", defOn: true },
            { key: "machineShowWarrantyInfo", label: "Show Warranty Info on Machine Card", defOn: false },
            { key: "machineShowSerialNo", label: "Show Serial Number Field", defOn: true },
            { key: "machineShowPurchaseInfo", label: "Show Purchase Info", desc: "Record purchase date and cost when adding machines", defOn: true },
          ].map(({ key, label, desc, defOn }) => (
            <GTogRow key={key} settingKey={key} label={label} desc={desc} defOn={defOn} />
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
            <div>
              <p style={{ color: t.sub, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>📆 Default Interval (days)</p>
              {numInput(settings?.machineDefaultIntervalDays ?? 30, e => setSettings(s => ({ ...s, machineDefaultIntervalDays: Number(e.target.value) })), 1, 365)}
              <p style={{ color: t.sub, fontSize: 10, marginTop: 3 }}>Days between services</p>
            </div>
            <div>
              <p style={{ color: t.sub, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>🔔 Alert Before (days)</p>
              {numInput(settings?.machineAlertBeforeDays ?? 3, e => setSettings(s => ({ ...s, machineAlertBeforeDays: Number(e.target.value) })), 0, 30)}
              <p style={{ color: t.sub, fontSize: 10, marginTop: 3 }}>Days before due to warn</p>
            </div>
          </div>
        </SCard>

        {[
          { key: "machineCategories", label: "Machine Categories", icon: "🏷️", defaults: ["Mixer", "Oven", "Sealer", "Generator", "Conveyor", "Other"] },
          { key: "machineLogTypes", label: "Log Entry Types", icon: "📋", defaults: ["Servicing", "Breakdown", "Repair", "Inspection", "Oil Change", "Other"] },
          { key: "machineStatuses", label: "Machine Statuses", icon: "🔵", defaults: ["Operational", "Needs Service", "Under Repair", "Retired"] },
          { key: "machineSeverityLevels", label: "Severity Levels", icon: "⚠️", defaults: ["Low", "Medium", "High", "Critical"] },
        ].map(({ key, label, icon, defaults }) => (
          <SCard key={key} t={t} dm={dm} icon={icon} title={label}>
            <EditableList t={t} dm={dm}
              items={settings?.[key] || defaults}
              defaults={defaults}
              onUpdate={(i, v) => { const arr = [...(settings?.[key] || defaults)]; arr[i] = v; setSettings(s => ({ ...s, [key]: arr })); }}
              onDelete={i => { const arr = (settings?.[key] || defaults).filter((_, j) => j !== i); setSettings(s => ({ ...s, [key]: arr })); }}
              onAdd={() => setSettings(s => ({ ...s, [key]: [...(s[key] || defaults), ""] }))} />
          </SCard>
        ))}
      </>
    );
  }

  function renderVehicles() {
    return (
      <>
        <SCard t={t} dm={dm} icon="🚐" title="Vehicle / Van Management" subtitle="Configure the Vehicles tab and fleet tracking"
          headerRight={<Tog dm={dm} on={settings?.featureVanManagement === true} onChange={() => setSettings(s => ({ ...s, featureVanManagement: !s?.featureVanManagement }))} />}>
          {!settings?.featureVanManagement && (
            <div style={{ background: "#f59e0b18", border: "1px solid #f59e0b44", borderRadius: 10, padding: "10px 12px" }}>
              <p style={{ color: "#f59e0b", fontSize: 12, fontWeight: 600 }}>⚠️ Vehicles tab is hidden. Enable the toggle above to show it.</p>
            </div>
          )}
        </SCard>

        <SCard t={t} dm={dm} icon="🔧" title="Log Options">
          {[
            { key: "vehicleRequireDriver", label: "Require Driver Name", defOn: false },
            { key: "vehicleRequireKms", label: "Require KM Reading", defOn: false },
            { key: "vehicleShowFuelCost", label: "Show Fuel Cost Field", defOn: true },
            { key: "vehicleShowMaintCost", label: "Show Maintenance Cost Field", defOn: true },
            { key: "vehicleShowFuelLiters", label: "Show Fuel Litres", defOn: true },
            { key: "vehicleShowFuelType", label: "Show Fuel Type", defOn: true },
            { key: "vehicleShowOdometer", label: "Show Odometer Readings", defOn: true },
            { key: "vehicleShowTollCost", label: "Show Toll / Misc Cost", defOn: false },
            { key: "vehicleShowRouteStops", label: "Show Route Stops", defOn: false },
            { key: "vehicleShowPriority", label: "Show Priority Flag", defOn: false },
            { key: "vehicleShowNextService", label: "Show Next Service Due", defOn: true },
            { key: "vehicleShowInsuranceAlert", label: "Show Insurance Expiry Alert", defOn: true },
          ].map(({ key, label, defOn }) => (
            <GTogRow key={key} settingKey={key} label={label} defOn={defOn} />
          ))}
        </SCard>

        {[
          { key: "vehicleTypes", label: "Vehicle Types", icon: "🚐", defaults: ["Van", "Car", "Bike", "Truck", "Auto", "Other"] },
          { key: "vehicleLogTypes", label: "Log Entry Types", icon: "📋", defaults: ["Trip", "Maintenance", "Breakdown", "Fuel Fill", "Insurance", "Other"] },
          { key: "vehicleStatuses", label: "Vehicle Statuses", icon: "🔵", defaults: ["OK", "Needs Service", "Offline", "Under Repair"] },
          { key: "vehicleFuelTypes", label: "Fuel Types", icon: "⛽", defaults: ["Petrol", "Diesel", "CNG", "Electric", "LPG"] },
        ].map(({ key, label, icon, defaults }) => (
          <SCard key={key} t={t} dm={dm} icon={icon} title={label}>
            <EditableList t={t} dm={dm}
              items={settings?.[key] || defaults}
              defaults={defaults}
              onUpdate={(i, v) => { const arr = [...(settings?.[key] || defaults)]; arr[i] = v; setSettings(s => ({ ...s, [key]: arr })); }}
              onDelete={i => setSettings(s => ({ ...s, [key]: (s[key] || defaults).filter((_, j) => j !== i) }))}
              onAdd={() => setSettings(s => ({ ...s, [key]: [...(s[key] || defaults), ""] }))} />
          </SCard>
        ))}
      </>
    );
  }

  function renderProducts() {
    return (
      <>
        <SCard t={t} dm={dm} icon="📦" title="Products & Prices" subtitle={`${products.length} products`}
          headerRight={<Btn dm={dm} size="sm" onClick={() => { setPf(blkP()); setPsh("add"); }}>+ Product</Btn>}>
          {products.map(p => (
            <div key={p.id} style={{ borderBottom: `1px solid ${t.border}`, padding: "12px 0" }} className="last:border-0">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                <div>
                  <p style={{ color: t.text, fontSize: 13, fontWeight: 700 }}>{p.name}</p>
                  <p style={{ color: t.sub, fontSize: 10, marginTop: 2 }}>{p.unit} · id: {p.id}</p>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button onClick={() => { setPf({ ...p, prices: [...p.prices] }); setPsh(p); }} style={{ background: t.inp, color: t.text, border: `1px solid ${t.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Edit</button>
                  <button onClick={() => ask(`Delete ${p.name}?`, () => { notify("Product deleted"); })} style={{ background: "#ef444420", color: "#ef4444", border: "1px solid #ef444430", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Del</button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {p.prices.map((pr, i) => <span key={i} style={{ background: t.inp, color: t.text, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 8 }}>{inr(pr)}</span>)}
              </div>
            </div>
          ))}
        </SCard>

        {/* System Lists */}
        <SCard t={t} dm={dm} title="System Lists">
          {[
            { label: "Expense Categories", key: "expenseCategories", def: ["Gas", "Labour", "Transport", "Packaging", "Utilities", "Maintenance", "Other"] },
            { label: "Delivery Statuses", key: "deliveryStatuses", def: ["Pending", "In Transit", "Delivered", "Cancelled"] },
            { label: "Supply Units", key: "supplyUnits", def: ["kg", "g", "L", "mL", "pcs", "bags", "boxes", "dozen"] },
            { label: "Wastage Types", key: "wastageTypes", def: ["Burnt", "Broken", "Expired", "Overproduced", "Quality Reject", "Other"] },
            { label: "Work Shifts", key: "shifts", def: ["Morning", "Afternoon", "Evening", "Night"] },
          ].map(({ label, key, def }) => {
            const list = settings?.[key] || def;
            return (
              <div key={key} style={{ marginBottom: 18 }}>
                <p style={{ color: t.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{label}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {list.map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, background: t.inp, border: `1px solid ${t.border}`, borderRadius: 8, paddingLeft: 9, paddingRight: 5, paddingTop: 4, paddingBottom: 4 }}>
                      <span style={{ color: t.text, fontSize: 12 }}>{item}</span>
                      <button onClick={() => setSettings(s => ({ ...s, [key]: list.filter((_, j) => j !== i) }))} style={{ color: "#ef4444", fontWeight: 700, fontSize: 13, background: "none", border: "none", cursor: "pointer", padding: "0 2px", lineHeight: 1 }}>✕</button>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input id={`new_${key}`} placeholder={`New ${label.toLowerCase().slice(0, -1)}…`}
                    style={{ flex: 1, background: t.inp, border: `1px solid ${t.border}`, color: t.text, borderRadius: 10, padding: "8px 12px", fontSize: 12, outline: "none" }} />
                  <button onClick={() => {
                    const el = document.getElementById(`new_${key}`);
                    const v = el.value.trim();
                    if (v && !list.includes(v)) { setSettings(s => ({ ...s, [key]: [...list, v] })); el.value = ""; }
                  }} style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Add</button>
                </div>
              </div>
            );
          })}
        </SCard>

        {/* Delivery features for products section */}
        <SCard t={t} dm={dm} icon="🚚" title="Delivery Agent Features" subtitle="Control what delivery agents can see and do.">
          <TogRow t={t} dm={dm} label="📋 Bulk Order Entry" desc="Allow agents/factory to create orders for multiple customers at once" on={settings?.bulkOrderEnabled !== false} onChange={() => setSettings(s => ({ ...s, bulkOrderEnabled: s?.bulkOrderEnabled === false ? true : false }))} />
          <TogRow t={t} dm={dm} label="💰 Agent Cash Collection" desc="Show the Collect button on delivery cards" on={settings?.agentCollectEnabled !== false} onChange={() => setSettings(s => ({ ...s, agentCollectEnabled: s?.agentCollectEnabled === false ? true : false }))} />
          {settings?.agentCollectEnabled !== false && (
            <TogRow t={t} dm={dm} label="↳ Require collection note" indent={1} desc="Agent must enter a note before confirming collection" on={settings?.agentCollectRequireNote === true} onChange={() => setSettings(s => ({ ...s, agentCollectRequireNote: !s?.agentCollectRequireNote }))} />
          )}
          <TogRow t={t} dm={dm} label="🧾 Delivery Receipts" desc="Show Receipt button on delivery cards" on={settings?.agentInvoiceEnabled !== false} onChange={() => setSettings(s => ({ ...s, agentInvoiceEnabled: s?.agentInvoiceEnabled === false ? true : false }))} />
          {settings?.agentInvoiceEnabled !== false && (
            <>
              <TogRow t={t} dm={dm} label="↳ Show Receipt to Agents" indent={1} on={(settings?.receiptVisibleTo || ["agent"]).includes("agent")} onChange={() => { const cur = settings?.receiptVisibleTo || ["agent"]; setSettings(s => ({ ...s, receiptVisibleTo: cur.includes("agent") ? cur.filter(r => r !== "agent") : [...cur, "agent"] })); }} />
              {(settings?.receiptVisibleTo || ["agent"]).includes("agent") && (
                <TogRow t={t} dm={dm} label="↳ ↳ Allow Agents to Print" indent={2} on={(settings?.receiptPrintAllowed || ["admin", "agent"]).includes("agent")} onChange={() => { const cur = settings?.receiptPrintAllowed || ["admin", "agent"]; setSettings(s => ({ ...s, receiptPrintAllowed: cur.includes("agent") ? cur.filter(r => r !== "agent") : [...cur, "agent"] })); }} />
              )}
              <TogRow t={t} dm={dm} label="↳ Show Receipt to Factory" indent={1} on={(settings?.receiptVisibleTo || ["agent"]).includes("factory")} onChange={() => { const cur = settings?.receiptVisibleTo || ["agent"]; setSettings(s => ({ ...s, receiptVisibleTo: cur.includes("factory") ? cur.filter(r => r !== "factory") : [...cur, "factory"] })); }} />
              {(settings?.receiptVisibleTo || ["agent"]).includes("factory") && (
                <TogRow t={t} dm={dm} label="↳ ↳ Allow Factory to Print" indent={2} on={(settings?.receiptPrintAllowed || ["admin", "agent"]).includes("factory")} onChange={() => { const cur = settings?.receiptPrintAllowed || ["admin", "agent"]; setSettings(s => ({ ...s, receiptPrintAllowed: cur.includes("factory") ? cur.filter(r => r !== "factory") : [...cur, "factory"] })); }} />
              )}
              <TogRow t={t} dm={dm} label="↳ Show prices on receipt" indent={1} on={settings?.agentInvoiceShowPrices !== false} onChange={() => setSettings(s => ({ ...s, agentInvoiceShowPrices: s?.agentInvoiceShowPrices === false ? true : false }))} />
              {settings?.agentCollectEnabled !== false && (
                <TogRow t={t} dm={dm} label="↳ Auto-print receipt after collection" indent={1} on={settings?.agentAutoReceipt !== false} onChange={() => setSettings(s => ({ ...s, agentAutoReceipt: s?.agentAutoReceipt === false ? true : false }))} />
              )}
            </>
          )}
        </SCard>
      </>
    );
  }

  function renderRecipes() {
    const recipes = settings?.recipes || {};
    const autoDeductOn = settings?.autoDeductEnabled !== false;
    return (
      <>
        <SCard t={t} dm={dm} icon="🤖" title="Smart Auto-Deduct" subtitle="When production is logged, automatically reduce matching supply stock.">
          <TogRow t={t} dm={dm} label="Enable Auto-Deduct" on={autoDeductOn} onChange={() => setSettings(s => ({ ...s, autoDeductEnabled: !autoDeductOn }))} />
        </SCard>

        <p style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", margin: "4px 0 6px" }}>Product Recipes</p>
        <p style={{ color: t.sub, fontSize: 11, marginBottom: 12, lineHeight: 1.5 }}>Define which supply items are consumed per unit produced.</p>

        {products.map(prod => {
          const ingrs = ((settings?.recipes || {})[prod.id]?.ingredients) || [];
          const open = openRecipe === prod.id;
          return (
            <Card key={prod.id} dm={dm}>
              <div style={{ padding: "14px 16px" }}>
                <button onClick={() => setOpenRecipe(open ? null : prod.id)} style={{ background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", padding: 0 }}>
                  <div>
                    <p style={{ color: t.text, fontWeight: 700, fontSize: 13 }}>{prod.name}</p>
                    <p style={{ color: t.sub, fontSize: 11, marginTop: 2 }}>{ingrs.length > 0 ? `${ingrs.length} ingredient${ingrs.length !== 1 ? "s" : ""} defined` : "No recipe yet"}</p>
                  </div>
                  <span style={{ color: t.sub, fontSize: 16, flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
                </button>
                {open && (
                  <>
                    <Hr dm={dm} />
                    {ingrs.map((ing, ii) => (
                      <div key={ii} style={{ display: "grid", gridTemplateColumns: "1fr 80px 60px auto", gap: 8, alignItems: "flex-end", marginBottom: 8 }}>
                        <Inp dm={dm} label="Supply item" value={ing.supply} onChange={e => { const n = [...ingrs]; n[ii] = { ...n[ii], supply: e.target.value }; setSettings(s => ({ ...s, recipes: { ...recipes, [prod.id]: { ingredients: n } } })); }} placeholder="e.g. Flour" />
                        <Inp dm={dm} label="Qty/unit" type="number" value={ing.qtyPerUnit} onChange={e => { const n = [...ingrs]; n[ii] = { ...n[ii], qtyPerUnit: e.target.value }; setSettings(s => ({ ...s, recipes: { ...recipes, [prod.id]: { ingredients: n } } })); }} placeholder="0.5" />
                        <Inp dm={dm} label="Unit" value={ing.unit} onChange={e => { const n = [...ingrs]; n[ii] = { ...n[ii], unit: e.target.value }; setSettings(s => ({ ...s, recipes: { ...recipes, [prod.id]: { ingredients: n } } })); }} placeholder="kg" />
                        <button onClick={() => { const n = ingrs.filter((_, i) => i !== ii); setSettings(s => ({ ...s, recipes: { ...recipes, [prod.id]: { ingredients: n } } })); }}
                          style={{ background: "#dc262618", border: "1px solid #dc262640", color: "#dc2626", borderRadius: 8, padding: "0 10px", height: 36, fontWeight: 700, cursor: "pointer", marginTop: 18 }}>×</button>
                      </div>
                    ))}
                    <Btn dm={dm} v="outline" size="sm" onClick={() => { const n = [...ingrs, { supply: "", qtyPerUnit: "", unit: "" }]; setSettings(s => ({ ...s, recipes: { ...recipes, [prod.id]: { ingredients: n } } })); }}>+ Add Ingredient</Btn>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </>
    );
  }

  function renderProduction() {
    return (
      <>
        <SCard t={t} dm={dm} icon="🏭" title="Production Items" subtitle="Items available when logging batches. Separate from your delivery products."
          headerRight={<Btn dm={dm} size="sm" style={{ background: "#8b5cf6", color: "#fff", border: "none" }} onClick={() => { setPiF({ id: "", name: "", icon: "🫓", color: "#f97316" }); setPiSh("add"); }}>+ Add Item</Btn>}>
          {(settings?.prodItems || []).length === 0 && <p style={{ color: t.sub, fontSize: 12, textAlign: "center", padding: "10px 0" }}>No production items yet. Add your first one.</p>}
          {(settings?.prodItems || []).map(item => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${t.border}` }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: (item.color || "#f97316") + "18", border: `1.5px solid ${(item.color || "#f97316")}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                {item.icon || "📦"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: item.color || t.text, fontWeight: 700, fontSize: 13 }}>{item.name}</p>
                <p style={{ color: t.sub, fontSize: 10 }}>{item.unit || "KG"}</p>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => { setPiF({ ...item, icon: item.icon || "🫓", color: item.color || "#f97316" }); setPiSh(item); }} style={{ background: t.inp, color: t.text, border: `1px solid ${t.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Edit</button>
                <button onClick={() => ask(`Delete ${item.name || "item"}?`, () => { setSettings(s => ({ ...s, prodItems: (s.prodItems || []).filter(x => x.id !== item.id) })); notify("Item deleted"); })} style={{ background: "#dc262618", color: "#dc2626", border: "1px solid #dc262640", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Del</button>
              </div>
            </div>
          ))}
        </SCard>

        <SCard t={t} dm={dm} icon="🏭" title="Batch & Production" subtitle="Control how batches are logged and tracked">
          {[
            { key: "featureSmartDeduction", label: "Auto-Deduct Stock on Batch", desc: "Automatically reduce supply inventory when a batch is logged", defOn: true },
            { key: "featureShiftManagement", label: "Shift Management", desc: "Enable shift selection on batches", defOn: true },
            { key: "prodRequireQC", label: "Require QC Grade on Every Batch", defOn: false },
            { key: "prodShowCustomerTraceability", label: "Show Customer Traceability in Batch Form", defOn: true },
            { key: "prodShowRecipeOnBatch", label: "Show Recipe Usage on Batch Card", defOn: true },
            { key: "prodAllowBackdate", label: "Allow Backdated Batch Entry", defOn: true },
          ].map(({ key, label, desc, defOn }) => (
            <GTogRow key={key} settingKey={key} label={label} desc={desc} defOn={defOn} />
          ))}
        </SCard>

        <SCard t={t} dm={dm} icon="🔍" title="Recall & Traceability" subtitle="Settings for product recall readiness and customer-batch linking">
          {[
            { key: "prodAutoLinkDeliveries", label: "Auto-Link Deliveries to Batches", desc: "Automatically link same-date deliveries to a batch when it's saved", defOn: true },
            { key: "prodTraceabilityInPDF", label: "Include Traceability in PDF Trail", defOn: true },
            { key: "prodShowLinkedInvoices", label: "Show Linked Invoices on Batch Card", defOn: true },
          ].map(({ key, label, desc, defOn }) => (
            <GTogRow key={key} settingKey={key} label={label} desc={desc} defOn={defOn} />
          ))}
          <div style={{ marginTop: 14, padding: "12px 14px", background: dm ? "rgba(124,58,237,0.08)" : "rgba(124,58,237,0.05)", border: "1.5px solid rgba(124,58,237,0.25)", borderRadius: 12 }}>
            <p style={{ color: "#8b5cf6", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>🔧 Backfill Batch Assignments</p>
            <p style={{ color: t.sub, fontSize: 11, marginBottom: 10, lineHeight: 1.5 }}>Assign each delivery to the first matching batch on that date. Manually assigned deliveries are skipped.</p>
            {(() => {
              const unlinked = deliveries.filter(d => !d.batchId && d.status !== "Cancelled");
              const prodNamesMatch = (a, b) => a && b && a.toLowerCase().trim() === b.toLowerCase().trim();
              const linkable = unlinked.filter(d => Object.entries(safeO(d.orderLines)).some(([pid, l]) => {
                if (!(l.qty > 0)) return false;
                const p = products.find(x => x.id === pid);
                return (settings?.prodTargets || []).some(pt => pt.date === d.date && prodNamesMatch(p?.name || l.name || "", pt.product));
              }));
              return (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <p style={{ color: t.sub, fontSize: 11 }}>{linkable.length > 0 ? `${linkable.length} deliveries can be backfilled` : "✅ All deliveries already assigned"}</p>
                  {linkable.length > 0 && (
                    <button onClick={() => ask(`Backfill batch assignments for ${linkable.length} existing deliveries? Cannot be undone.`, () => {
                      setDeliv(prev => safeArr(prev).map(d => {
                        if (d.batchId || d.status === "Cancelled") return d;
                        const matchingBatches = (settings?.prodTargets || []).filter(pt => pt.date === d.date && pt.product && Object.entries(safeO(d.orderLines)).some(([pid, l]) => { if (!(l.qty > 0)) return false; const p = products.find(x => x.id === pid); return prodNamesMatch(p?.name || l.name || "", pt.product); }));
                        if (!matchingBatches.length) return d;
                        const sorted = [...matchingBatches].sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
                        return { ...d, batchId: sorted[0].batchId || sorted[0].id };
                      }));
                      notify("Backfilled batch assignments ✓");
                      addLog("Backfilled batch assignments", `${linkable.length} deliveries updated`);
                    })} style={{ background: "#8b5cf6", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 36 }}>
                      🔗 Backfill {linkable.length} Deliveries
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        </SCard>

        <SCard t={t} dm={dm} icon="🗑️" title="Wastage Controls" subtitle="Settings for wastage logging behaviour">
          {[
            { key: "wastageRequireReason", label: "Require Wastage Reason", defOn: false },
            { key: "wastageRequireCost", label: "Require Wastage Cost", defOn: false },
            { key: "wastageAlertThreshold", label: "Wastage Alert in Dashboard", defOn: true },
          ].map(({ key, label, defOn }) => (
            <GTogRow key={key} settingKey={key} label={label} defOn={defOn} />
          ))}
        </SCard>

        <SCard t={t} dm={dm} icon="✅" title="Quality Control (QC)" subtitle="Settings for QC checks and grading">
          {[
            { key: "qcEmbedInBatch", label: "Embed QC in Batch Form", defOn: true },
            { key: "qcRequireChecker", label: "Require Inspector Name", defOn: false },
            { key: "qcAlertOnFail", label: "Alert on QC Fail (Grade F)", defOn: true },
          ].map(({ key, label, defOn }) => (
            <GTogRow key={key} settingKey={key} label={label} defOn={defOn} />
          ))}
        </SCard>

        <SCard t={t} dm={dm} icon="⚡" title="Batch Unit Presets" subtitle="Quick-tap unit presets shown in the Log New Batch form">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
            {(settings?.batchUnitPresets || [50, 100, 150, 200, 250, 300]).map((n, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, background: t.inp, border: `1px solid ${t.border}`, borderRadius: 8, paddingLeft: 9, paddingRight: 5, paddingTop: 4, paddingBottom: 4 }}>
                <span style={{ color: t.text, fontSize: 12, fontWeight: 700 }}>{n}</span>
                <button onClick={() => setSettings(s => ({ ...s, batchUnitPresets: (s.batchUnitPresets || [50, 100, 150, 200, 250, 300]).filter((_, j) => j !== i) }))} style={{ color: "#ef4444", fontWeight: 700, fontSize: 13, background: "none", border: "none", cursor: "pointer", padding: "0 3px", lineHeight: 1 }}>✕</button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input id="new_batchPreset" type="number" placeholder="e.g. 500"
              style={{ flex: 1, background: t.inp, border: `1px solid ${t.border}`, color: t.text, borderRadius: 10, padding: "8px 12px", fontSize: 12, outline: "none" }} />
            <button onClick={() => { const el = document.getElementById("new_batchPreset"); const v = +el.value; if (v > 0) { setSettings(s => ({ ...s, batchUnitPresets: [...(s.batchUnitPresets || [50, 100, 150, 200, 250, 300]), v].sort((a, b) => a - b) })); el.value = ""; } }}
              style={{ background: "#8b5cf6", color: "#fff", borderRadius: 10, padding: "8px 16px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer" }}>Add</button>
          </div>
        </SCard>
      </>
    );
  }

  function renderAccess() {
    return (
      <>
        <SCard t={t} dm={dm} title="Wastage Tab Access" subtitle="Which roles can log and view wastage records.">
          {["admin", "factory", "agent"].map(role => {
            const on = (settings?.showWastageTo || ["admin", "factory"]).includes(role);
            return (
              <TogRow key={role} t={t} dm={dm} label={<span style={{ textTransform: "capitalize" }}>{role}</span>} on={role === "admin" ? true : on}
                onChange={() => { if (role === "admin") return; setSettings(s => ({ ...s, showWastageTo: on ? (s.showWastageTo || []).filter(r => r !== role) : [...(s.showWastageTo || []), role] })); }}>
                {role === "admin" && <span style={{ color: t.sub, fontSize: 10 }}>always has access</span>}
              </TogRow>
            );
          })}
          <p style={{ color: t.text, fontSize: 12, fontWeight: 600, marginTop: 14, marginBottom: 6 }}>Show cost/loss data in Wastage to:</p>
          {["admin", "factory", "agent"].map(role => {
            const key = "showWasteCostTo"; const on = (settings?.[key] || ["admin"]).includes(role);
            return (
              <TogRow key={role} t={t} dm={dm} label={<span style={{ textTransform: "capitalize" }}>{role}</span>} on={role === "admin" ? true : on}
                onChange={() => { if (role === "admin") return; setSettings(s => ({ ...s, [key]: on ? (s[key] || []).filter(r => r !== role) : [...(s[key] || []), role] })); }}>
                {role === "admin" && <span style={{ color: t.sub, fontSize: 10 }}>always visible</span>}
              </TogRow>
            );
          })}
          <Hr dm={dm} />
          <p style={{ color: t.text, fontSize: 13, fontWeight: 700, marginTop: 8, marginBottom: 4 }}>Price & Financial Visibility</p>
          <p style={{ color: t.sub, fontSize: 11, marginBottom: 12 }}>Hidden roles see quantities only — no amounts shown anywhere.</p>
          <p style={{ color: t.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Show prices to:</p>
          {["admin", "factory", "agent"].map(role => {
            const on = (settings?.showPricesTo || ["admin"]).includes(role);
            return (
              <TogRow key={role} t={t} dm={dm} label={<span style={{ textTransform: "capitalize" }}>{role}</span>} on={role === "admin" ? true : on}
                onChange={() => { if (role === "admin") return; setSettings(s => ({ ...s, showPricesTo: on ? (s.showPricesTo || []).filter(r => r !== role) : [...(s.showPricesTo || []), role] })); }}>
                {role === "admin" && <span style={{ color: t.sub, fontSize: 10 }}>always visible</span>}
              </TogRow>
            );
          })}
          <p style={{ color: t.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 14, marginBottom: 6 }}>Show financial summaries to:</p>
          {["admin", "factory", "agent"].map(role => {
            const on = (settings?.showFinancialsTo || ["admin"]).includes(role);
            return (
              <TogRow key={role} t={t} dm={dm} label={<span style={{ textTransform: "capitalize" }}>{role}</span>} on={role === "admin" ? true : on}
                onChange={() => { if (role === "admin") return; setSettings(s => ({ ...s, showFinancialsTo: on ? (s.showFinancialsTo || []).filter(r => r !== role) : [...(s.showFinancialsTo || []), role] })); }}>
                {role === "admin" && <span style={{ color: t.sub, fontSize: 10 }}>always visible</span>}
              </TogRow>
            );
          })}
        </SCard>
      </>
    );
  }

  function renderApp() {
    return (
      <>
        {/* Live preview strip */}
        <div style={{ background: t.accent, borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, marginBottom: 4 }}>
          <span style={{ fontSize: 36, lineHeight: 1 }}>{settings?.appEmoji || "🫓"}</span>
          <div>
            <p style={{ color: "#fff", fontWeight: 900, fontSize: 16, lineHeight: 1.2 }}>{settings?.appName || "TAS Healthy World"}</p>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 3 }}>{settings?.appSubtitle || "Paratha Factory · Operations"}</p>
            {settings?.brandTagline && <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 3, fontStyle: "italic" }}>"{settings.brandTagline}"</p>}
          </div>
        </div>

        {/* Language */}
        <SCard t={t} dm={dm} icon="🌐" title="Language" subtitle="Changes tab labels, status strings, and UI text across the entire app for all users.">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {[{ code: "en", label: "🇬🇧 English" }, { code: "hi", label: "🇮🇳 हिन्दी" }, { code: "mr", label: "🇮🇳 मराठी" }, { code: "ml", label: "🇮🇳 മലയാളം" }].map(lang => (
              <button key={lang.code} onClick={() => { setSettings(s => ({ ...s, defaultLanguage: lang.code, language: lang.code })); }}
                style={{ background: (settings?.defaultLanguage || "en") === lang.code ? t.accent : t.inp, color: (settings?.defaultLanguage || "en") === lang.code ? t.accentFg : t.sub, border: `1.5px solid ${(settings?.defaultLanguage || "en") === lang.code ? t.accent : t.border}`, borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {lang.label}
              </button>
            ))}
          </div>
          <p style={{ color: t.sub, fontSize: 10 }}>Selected: <strong style={{ color: t.text }}>{({ en: "English", hi: "हिन्दी (Hindi)", mr: "मराठी (Marathi)", ml: "മലയാളം (Malayalam)" })[settings?.defaultLanguage || "en"]}</strong></p>
        </SCard>

        {/* Logo */}
        <SCard t={t} dm={dm} icon="🖼️" title="Company Logo" subtitle="Upload your logo to display it on invoices, receipts, and PDF exports. PNG or JPG, square/landscape, under 500KB.">
          {settings?.companyLogo && (
            <div style={{ background: t.inp, borderRadius: 12, padding: 12, display: "flex", alignItems: "center", gap: 12, border: `1.5px solid ${t.border}`, marginBottom: 12 }}>
              <img src={settings.companyLogo} alt="Logo" style={{ maxHeight: 60, maxWidth: 120, objectFit: "contain", borderRadius: 8, background: "#fff", padding: 4, border: `1px solid ${t.border}` }} />
              <div style={{ flex: 1 }}>
                <p style={{ color: t.text, fontSize: 12, fontWeight: 700 }}>Logo uploaded ✓</p>
                <p style={{ color: t.sub, fontSize: 10 }}>Used on invoices, receipts, and PDF exports</p>
              </div>
              <button onClick={() => setSettings(s => ({ ...s, companyLogo: "" }))} style={{ background: "#ef444415", color: "#ef4444", border: "1px solid #ef444430", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Remove</button>
            </div>
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 12, background: t.inp, border: `2px dashed ${t.border}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer" }}>
            <span style={{ fontSize: 28 }}>📁</span>
            <div>
              <p style={{ color: t.text, fontSize: 13, fontWeight: 700 }}>{settings?.companyLogo ? "Replace logo" : "Upload logo"}</p>
              <p style={{ color: t.sub, fontSize: 11 }}>PNG, JPG, SVG · max 500KB</p>
            </div>
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 600000) { alert("File too large. Please use an image under 500KB."); return; }
              const reader = new FileReader();
              reader.onload = ev => setSettings(s => ({ ...s, companyLogo: ev.target.result }));
              reader.readAsDataURL(file);
              e.target.value = "";
            }} />
          </label>
        </SCard>

        {/* App Identity */}
        <SCard t={t} dm={dm} icon="🎨" title="App Identity">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Inp dm={dm} label="App Name" value={settings?.appName || ""} onChange={e => setSettings(s => ({ ...s, appName: e.target.value }))} placeholder="TAS Healthy World" />
            <Inp dm={dm} label="Subtitle" value={settings?.appSubtitle || ""} onChange={e => setSettings(s => ({ ...s, appSubtitle: e.target.value }))} placeholder="Paratha Factory · Operations" />
            <Inp dm={dm} label="Tagline (optional)" value={settings?.brandTagline || ""} onChange={e => setSettings(s => ({ ...s, brandTagline: e.target.value }))} placeholder="Fresh. Local. Delivered." />
            <div>
              <label style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>Emoji / Icon</label>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 8 }}>
                {["🫓", "🍽️", "🏭", "🌿", "🥘", "🍲", "🌾", "🚚", "⚡", "🔥"].map(e => (
                  <button key={e} onClick={() => setSettings(s => ({ ...s, appEmoji: e }))}
                    style={{ fontSize: 22, background: settings?.appEmoji === e ? t.accent + "22" : t.inp, border: `2px solid ${settings?.appEmoji === e ? t.accent : t.border}`, borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}>{e}</button>
                ))}
              </div>
              <Inp dm={dm} label="Custom emoji" value={settings?.appEmoji || ""} onChange={e => setSettings(s => ({ ...s, appEmoji: e.target.value }))} placeholder="🫓" />
            </div>
          </div>
        </SCard>

        {/* Company Details */}
        <SCard t={t} dm={dm} icon="🏢" title="Company Details" subtitle="Used on Invoices & Receipts">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Inp dm={dm} label="Company Name" value={settings?.companyName || ""} onChange={e => setSettings(s => ({ ...s, companyName: e.target.value }))} placeholder="TAS Healthy World" />
            <Inp dm={dm} label="Company Subtitle" value={settings?.companySubtitle || ""} onChange={e => setSettings(s => ({ ...s, companySubtitle: e.target.value }))} placeholder="Malabar Paratha Factory · Goa, India" />
            <Inp dm={dm} label="Address" value={settings?.companyAddress || ""} onChange={e => setSettings(s => ({ ...s, companyAddress: e.target.value }))} placeholder="123 Factory Road, Goa 403001" />
            <Inp dm={dm} label="Phone" value={settings?.companyPhone || ""} onChange={e => setSettings(s => ({ ...s, companyPhone: e.target.value }))} placeholder="+91 98765 43210" />
            <Inp dm={dm} label="GST Number" value={settings?.companyGST || ""} onChange={e => setSettings(s => ({ ...s, companyGST: e.target.value }))} placeholder="22AAAAA0000A1Z5" />
            <Inp dm={dm} label="Email" value={settings?.companyEmail || ""} onChange={e => setSettings(s => ({ ...s, companyEmail: e.target.value }))} placeholder="info@yourbusiness.com" />
            <Inp dm={dm} label="Website" value={settings?.companyWebsite || ""} onChange={e => setSettings(s => ({ ...s, companyWebsite: e.target.value }))} placeholder="www.yourbusiness.com" />
            <Inp dm={dm} label="Invoice Footer Note" value={settings?.invoiceFooterNote || ""} onChange={e => setSettings(s => ({ ...s, invoiceFooterNote: e.target.value }))} placeholder="Thank you for your business! Payment due within 7 days." />
            <div>
              <label style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>Payment Terms</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["Immediate", "Net 7", "Net 15", "Net 30", "COD"].map(pt => (
                  <button key={pt} onClick={() => setSettings(s => ({ ...s, paymentTerms: pt }))}
                    style={{ background: settings?.paymentTerms === pt ? "#10b981" : t.inp, color: settings?.paymentTerms === pt ? "#fff" : t.sub, border: `1.5px solid ${settings?.paymentTerms === pt ? "#10b981" : t.border}`, borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {pt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SCard>

        {/* Weather */}
        <SCard t={t} dm={dm} icon="🌤" title="Weather Widget Location" subtitle="Set the location for the weather widget on the Dashboard.">
          <Inp dm={dm} label="Location Label" value={settings?.weatherLabel || "Goa"} onChange={e => setSettings(s => ({ ...s, weatherLabel: e.target.value }))} placeholder="Goa" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
            <Inp dm={dm} label="Latitude" value={settings?.weatherLat ?? 15.4909} onChange={e => setSettings(s => ({ ...s, weatherLat: +e.target.value || 15.4909 }))} placeholder="15.4909" />
            <Inp dm={dm} label="Longitude" value={settings?.weatherLng ?? 73.8278} onChange={e => setSettings(s => ({ ...s, weatherLng: +e.target.value || 73.8278 }))} placeholder="73.8278" />
          </div>
        </SCard>

        {/* Dashboard Widgets */}
        <SCard t={t} dm={dm} title="Dashboard Widgets">
          {[
            { key: "stats", label: "Stat Cards" }, { key: "chart", label: "Revenue Chart" },
            { key: "pendingDeliveries", label: "Pending Deliveries" }, { key: "outstanding", label: "Outstanding Payments" },
            { key: "wastageToday", label: "Today's Wastage" }, { key: "weather", label: "🌤 Weather Widget" },
            { key: "quickActions", label: "⚡ Quick Actions" }, { key: "productionBar", label: "🏭 Daily Production Progress" },
          ].map(w => {
            const on = (settings?.dashWidgets || []).includes(w.key);
            return <TogRow key={w.key} t={t} dm={dm} label={w.label} on={on} onChange={() => setSettings(s => ({ ...s, dashWidgets: on ? (s.dashWidgets || []).filter(k => k !== w.key) : [...(s.dashWidgets || []), w.key] }))} />;
          })}
        </SCard>

        {(settings?.dashWidgets || []).includes("quickActions") && (
          <SCard t={t} dm={dm} title="Quick Action Buttons" subtitle="Choose which actions appear on the dashboard. Up to 8 buttons.">
            {[
              { key: "newDelivery", icon: "🚚", label: "New Delivery" }, { key: "newCustomer", icon: "👤", label: "New Customer" },
              { key: "markDone", icon: "✅", label: "Mark Delivered" }, { key: "logWastage", icon: "🗑️", label: "Log Wastage" },
              { key: "addExpense", icon: "💸", label: "Add Expense" }, { key: "logSupply", icon: "📦", label: "Log Supply" },
              { key: "logProduction", icon: "🏭", label: "Log Production" }, { key: "qcCheck", icon: "✅", label: "QC Check" },
            ].map(q => {
              const on = (settings?.quickActions || []).includes(q.key);
              return <TogRow key={q.key} t={t} dm={dm} label={`${q.icon} ${q.label}`} on={on} onChange={() => setSettings(s => ({ ...s, quickActions: on ? (s.quickActions || []).filter(k => k !== q.key) : [...(s.quickActions || []), q.key] }))} />;
            })}
          </SCard>
        )}

        {/* PIN Mode */}
        <SCard t={t} dm={dm} title="PIN Login Mode" subtitle="Staff can log in with a 4-digit PIN instead of their password."
          headerRight={<Tog dm={dm} on={settings?.pinMode || false} onChange={() => setSettings(s => ({ ...s, pinMode: !s.pinMode }))} />}>
          {settings?.pinMode && (
            <div style={{ background: "#f59e0b10", border: "1px solid #f59e0b30", borderRadius: 10, padding: "10px 12px" }}>
              <p style={{ color: "#f59e0b", fontSize: 11, fontWeight: 600 }}>✓ PIN mode active — set PINs per user in Staff → Edit account</p>
            </div>
          )}
        </SCard>
      </>
    );
  }

  function renderAlerts() {
    return (
      <>
        <SCard t={t} dm={dm} icon="🔔" title="Alert Toggles" subtitle="Control which alerts fire across the system.">
          {[
            { key: "alertLowStock", label: "Low Stock Alert", desc: "Alert when a supply item falls below the threshold", icon: "⚠️", defOn: true },
            { key: "alertOverdueDelivery", label: "Overdue Delivery Alert", desc: "Alert when a delivery is past its expected date", icon: "🔴", defOn: true },
            { key: "alertChurnRisk", label: "Churn Risk Alert", desc: "Alert when a customer has been inactive for too long", icon: "💤", defOn: true },
            { key: "alertPaymentReceived", label: "Payment Received", desc: "Alert when a payment is recorded for any customer", icon: "💰", defOn: true },
            { key: "alertNewOrder", label: "New Order Created", desc: "Alert when a new delivery order is saved", icon: "📦", defOn: false },
            { key: "alertDailyReport", label: "Daily Summary", desc: "Morning briefing notification", icon: "☀️", defOn: false },
          ].map(({ key, label, desc, icon, defOn }) => (
            <GTogRow key={key} settingKey={key} icon={icon} label={label} desc={desc} defOn={defOn} />
          ))}
        </SCard>

        <SCard t={t} dm={dm} icon="📣" title="Who gets notified" subtitle="Choose which roles receive each type of notification">
          {[
            { key: "payment", label: "Payment events", icon: "💰" },
            { key: "delivery", label: "Delivery events", icon: "📦" },
            { key: "lowstock", label: "Low stock alerts", icon: "⚠️" },
            { key: "newentry", label: "New entries (general)", icon: "📝" },
            { key: "noticeboard", label: "Noticeboard posts", icon: "📌" },
          ].map(({ key, label, icon }) => {
            const cur = settings?.notifTargets?.[key] || [];
            return (
              <div key={key} style={{ borderBottom: `1px solid ${t.border}`, paddingBottom: 12, marginBottom: 12 }}>
                <p style={{ color: t.text, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{icon} {label}</p>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                  {["admin", "factory", "agent"].map(role => {
                    const on = cur.includes(role);
                    return (
                      <button key={role} onClick={() => { const next = on ? cur.filter(r => r !== role) : [...cur, role]; setSettings(s => ({ ...s, notifTargets: { ...(s.notifTargets || {}), [key]: next } })); }}
                        style={{ background: on ? t.accent : t.inp, color: on ? t.accentFg : t.sub, border: `1.5px solid ${on ? t.accent : t.border}`, borderRadius: 20, padding: "5px 16px", fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" }}>
                        {role}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </SCard>

        <SCard t={t} dm={dm} icon="⚙️" title="Alert Thresholds">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { label: "Low Stock Threshold (units)", key: "lowStockThreshold", def: 5, sub: "Alert fires when any supply item qty ≤ this value" },
              { label: "Churn Alert Days", key: "churnDays", def: 14, sub: "Alert fires if a customer has no orders for this many days" },
              { label: "Auto Backup Reminder (days)", key: "autoBackupReminder", def: 7, sub: "Reminder fires if no backup taken in this many days" },
            ].map(({ label, key, def, sub }) => (
              <div key={key}>
                <label style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>{label}</label>
                <input type="number" min={0} value={settings?.[key] ?? def} onChange={e => setSettings(s => ({ ...s, [key]: +e.target.value }))}
                  style={{ background: t.inp, border: `1.5px solid ${t.border}`, color: t.text, borderRadius: 12, padding: "10px 14px", fontSize: 16, width: "100%", outline: "none", boxSizing: "border-box" }} />
                <p style={{ color: t.sub, fontSize: 10, marginTop: 4 }}>{sub}</p>
              </div>
            ))}
          </div>
        </SCard>
      </>
    );
  }

  function renderSecurity() {
    return (
      <>
        <SecuritySessions dm={dm} t={t} ask={ask} addLog={addLog} notify={notify} />

        <SCard t={t} dm={dm} icon="🔑" title="Passkeys & Biometrics" subtitle="Register a passkey for passwordless login using Face ID, fingerprint, or Windows Hello on this device.">
          {(settings?.secBiometricEnabled !== false)
            ? <PasskeyManager dm={dm} t={t} sess={sess} notify={notify} ask={ask} addLog={addLog} />
            : <p style={{ color: "#ef4444", fontSize: 12, fontWeight: 600 }}>⚠️ Biometric login is disabled by the admin. Enable it in Security Settings below.</p>}
        </SCard>

        <SCard t={t} dm={dm} icon="🔐" title="Security Settings" subtitle="Account protection and access controls">
          {[
            { key: "secRequire2FAAdmin", label: "Require PIN Verification for Admin Actions", desc: "Admin must enter their PIN before deleting data or resetting counters", defOn: false },
            { key: "secAutoLogoutIdle", label: "Auto-Logout After Inactivity", desc: "Automatically log out after 30 minutes of no activity", defOn: false },
            { key: "secLogFailedLogins", label: "Log Failed Login Attempts", desc: "Record failed login attempts in the audit log", defOn: true },
            { key: "secShowLastLogin", label: "Show Last Login Info on Login Screen", desc: "Display last login time when signing in", defOn: true },
            { key: "secBiometricEnabled", label: "Enable Biometric / Passkey Login", desc: "Allow users to register Face ID, fingerprint, or Windows Hello for passwordless login.", defOn: true },
          ].map(({ key, label, desc, defOn }) => (
            <GTogRow key={key} settingKey={key} label={label} desc={desc} defOn={defOn} />
          ))}
        </SCard>

        <FailedLoginAttempts dm={dm} t={t} ask={ask} notify={notify} />
      </>
    );
  }



  function renderData() {
    return (
      <>
        <SCard t={t} dm={dm} icon="🗄️" title="Backup & Restore">
          {(() => {
            const daysSince = lastBackupDate ? Math.round((Date.now() - new Date(lastBackupDate).getTime()) / 86400000) : null;
            const noBackup = !lastBackupDate;
            const stale = daysSince !== null && daysSince >= (settings?.autoBackupReminder || 7);
            if (noBackup || stale) return (
              <div style={{ background: noBackup ? "#ef444415" : "#f59e0b15", border: `1px solid ${noBackup ? "#ef444430" : "#f59e0b30"}`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 16 }}>{noBackup ? "⚠️" : "🕐"}</span>
                <div>
                  <p style={{ color: noBackup ? "#ef4444" : "#f59e0b", fontWeight: 700, fontSize: 12 }}>{noBackup ? "No backup recorded yet" : `Last backup was ${daysSince} days ago`}</p>
                  <p style={{ color: t.sub, fontSize: 11, marginTop: 2 }}>Export a backup below to protect your data.</p>
                </div>
              </div>
            );
            return <div style={{ background: "#10b98115", border: "1px solid #10b98130", borderRadius: 10, padding: "8px 14px", marginBottom: 12 }}>
              <p style={{ color: "#10b981", fontWeight: 700, fontSize: 12 }}>✓ Last backup: {lastBackupDate} ({daysSince === 0 ? "today" : daysSince + "d ago"})</p>
            </div>;
          })()}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Btn dm={dm} v="outline" style={{ width: "100%" }} onClick={exportAll}>⬇️ Export Full Backup (JSON)</Btn>
            <Btn dm={dm} v="purple" style={{ width: "100%" }} onClick={() => exportTabPDF(deliveries, customers, products, settings, invRegistry)}>📊 Export Full Report (PDF)</Btn>
            <label style={{ border: `1px solid ${t.border}`, color: t.text, borderRadius: 12, padding: "10px 16px", textAlign: "center", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "block" }}>
              ⬆️ Import Backup (JSON)<input type="file" accept=".json" style={{ display: "none" }} onChange={importAll} />
            </label>
          </div>
          <Hr dm={dm} />
          <p style={{ color: t.text, fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Export as CSV</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn dm={dm} v="success" size="sm" onClick={() => exportCSV(customers, "customers", [{ label: "Name", key: "name" }, { label: "Phone", key: "phone" }, { label: "Address", key: "address" }, { label: "Paid", key: "paid" }, { label: "Pending", key: "pending" }])}>Customers</Btn>
            <Btn dm={dm} v="success" size="sm" onClick={() => exportCSV(deliveries, "deliveries", [{ label: "Customer", key: "customer" }, { label: "Date", key: "date" }, { label: "Status", key: "status" }, { label: "Total", val: r => lineTotal(r.orderLines) }])}>Deliveries</Btn>
          </div>
        </SCard>

        <SCard t={t} dm={dm} title="⚠️ Danger Zone">
          <p style={{ color: t.sub, fontSize: 12, marginBottom: 12 }}>This will wipe all data and reset to factory defaults. Cannot be undone.</p>
          <Btn dm={dm} v="danger" style={{ width: "100%" }} onClick={() => ask("Reset ALL data to factory defaults? Cannot be undone.", () => { setSettings({}); setUsers([]); setDeliv([]); setInvRegistry({ seq: 0, issued: {} }); notify("Reset complete — all data cleared"); addLog("Factory reset", "All data wiped"); })}>
            Reset All Data to Defaults
          </Btn>
        </SCard>
      </>
    );
  }

  const sectionContent = {
    toggles: renderToggles,
    invoice: renderInvoice,
    account: renderAccount,
    staff: renderStaff,
    machines: renderMachines,
    vehicles: renderVehicles,
    products: renderProducts,
    recipes: renderRecipes,
    production: renderProduction,
    access: renderAccess,
    app: renderApp,
    alerts: renderAlerts,
    security: renderSecurity,
    data: renderData,
    crashlogs: () => <CrashLogsPanel t={t} dm={dm} ask={ask} notify={notify} />,
  };

  return (
    <>
      <SectionHeader dm={dm} title="Settings" sub="Configure your CRM, manage users and customize features" />

      {/* ── Desktop layout: sidebar + content ── */}
      <div className="hidden lg:flex" style={{ gap: 24, alignItems: "flex-start" }}>
        <SidebarNav sections={SECS} active={settingsSection} onSelect={setSettingsSection} t={t} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          {(sectionContent[settingsSection] || (() => null))()}
        </div>
      </div>

      {/* ── Mobile/tablet layout: pill nav + content ── */}
      <div className="lg:hidden">
        <SectionNav sections={SECS} active={settingsSection} onSelect={setSettingsSection} t={t} />
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {(sectionContent[settingsSection] || (() => null))()}
        </div>
      </div>

      {/* ═══════ SHEETS ═══════ */}

      {/* Delivery Sheet */}
      <Sheet dm={dm} open={!!dSh} onClose={() => setDsh(null)} title={dSh === "add" ? "New Delivery" : "Edit Delivery"}>
        <Sel dm={dm} label="Customer *" value={dF.customerId || ""} onChange={e => { const c = customers.find(x => x.id === e.target.value); setDf(f => ({ ...f, customerId: e.target.value, customer: c?.name || "", address: c?.address || "", lat: c?.lat || "", lng: c?.lng || "", orderLines: c?.orderLines || {} })); }}>
          <option value="">— Select customer —</option>
          {customers.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Sel>
        {dF.address && (
          <div style={{ background: "#0ea5e915", border: "1px solid #0ea5e940", borderRadius: 12, padding: "10px 14px", fontSize: 12, color: "#38bdf8", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>📍 {dF.address}</span>
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dF.address || "")}${dF.lat && dF.lng ? `&query=${dF.lat},${dF.lng}` : ""}`} target="_blank" rel="noopener noreferrer" style={{ color: "#38bdf8", fontWeight: 700, textDecoration: "underline", marginLeft: 8 }}>Maps</a>
          </div>
        )}
        {/* Credit limit warning */}
        {settings?.featureCreditLimit && dF.customerId && (() => {
          const custRec = customers.find(c => c.id === dF.customerId);
          const limit = +(custRec?.creditLimit || 0);
          if (limit <= 0) return null;
          const orderAmt = lineTotal(dF.orderLines || {});
          const pending = +(custRec?.pending || 0);
          const total = pending + orderAmt;
          const pct = Math.min(100, Math.round((total / limit) * 100));
          const exceeded = total > limit;
          const warning = !exceeded && pct >= 80;
          if (!exceeded && !warning) return null;
          const color = exceeded ? "#ef4444" : "#f59e0b";
          return (
            <div style={{ background: color + "18", border: `1px solid ${color + "40"}`, borderRadius: 12, padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <p style={{ color, fontWeight: 700, fontSize: 12 }}>{exceeded ? "🚫 Credit Limit Exceeded" : "⚠️ Approaching Credit Limit"}</p>
                <span style={{ color, fontWeight: 800, fontSize: 12 }}>{pct}%</span>
              </div>
              <div style={{ background: color + "30", borderRadius: 99, height: 5, overflow: "hidden", marginBottom: 6 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <span style={{ color: t.sub }}>Pending {inr(pending)} + Order {inr(orderAmt)}</span>
                <span style={{ color, fontWeight: 700 }}>Limit {inr(limit)}</span>
              </div>
            </div>
          );
        })()}
        <Hr dm={dm} />
        <p style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Items{canSeePrices ? " — Tap price to select" : ""}</p>
        <OrderEditor dm={dm} products={products} orderLines={dF.orderLines || {}} showPrice={canSeePrices} onChange={ol => setDf(f => ({ ...f, orderLines: ol }))} />
        <Hr dm={dm} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(200px, 100%), 1fr))", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Order Date</label>
              {dSh === "add" && (() => {
                const mode = dF._dateMode || "today";
                return (
                  <div style={{ display: "flex", gap: 2, background: t.inp, borderRadius: 8, padding: 2, border: `1px solid ${t.border}` }}>
                    {[{ key: "today", label: "Today", color: "#10b981" }, { key: "past", label: "📅 Past", color: "#8b5cf6" }, { key: "future", label: "Future", color: "#f59e0b" }].map(m => (
                      <button key={m.key} onClick={() => { setDf(f => ({ ...f, _dateMode: m.key, _futureOrder: m.key === "future", date: m.key === "today" ? today() : f.date })); }}
                        style={{ fontSize: 9, fontWeight: 700, cursor: "pointer", borderRadius: 6, padding: "2px 6px", border: "none", background: mode === m.key ? m.color + "22" : "transparent", color: mode === m.key ? m.color : t.sub }}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
            {(dSh !== "add" || (dF._dateMode === "past" || dF._dateMode === "future" || dF._futureOrder))
              ? <input type="date" value={dF.date} max={dF._dateMode === "past" || (!dF._dateMode && !dF._futureOrder) ? today() : undefined} onChange={e => setDf({ ...dF, date: e.target.value })}
                style={{ background: t.inp, border: `1px solid ${dF._dateMode === "past" ? "#8b5cf680" : dF._dateMode === "future" || dF._futureOrder ? "#f59e0b80" : t.border}`, color: t.text, borderRadius: 12, padding: "10px 14px", fontSize: 14, width: "100%", outline: "none", boxSizing: "border-box" }} />
              : <div style={{ background: t.inp, border: `1px solid ${t.border}`, borderRadius: 12, padding: "10px 14px", fontSize: 13, color: t.sub }}>Today ({today()})</div>
            }
          </div>
          <Inp dm={dm} label="Deliver By (optional)" type="date" value={dF.deliveryDate || ""} onChange={e => setDf({ ...dF, deliveryDate: e.target.value })} />
        </div>
        <Sel dm={dm} label="Status" value={dF.status} onChange={e => setDf({ ...dF, status: e.target.value })}>
          {(settings?.deliveryStatuses || ["Pending", "In Transit", "Delivered", "Cancelled"]).map(s => <option key={s}>{s}</option>)}
        </Sel>
        {/* Batch selector */}
        {(() => {
          const prodNamesMatch = (a, b) => a && b && a.toLowerCase().trim() === b.toLowerCase().trim();
          const delivDate = dF.date || today();
          const delivProductIds = Object.entries(safeO(dF.orderLines)).filter(([, l]) => (l.qty || 0) > 0).map(([pid]) => pid);
          const allBatches = (settings?.prodTargets || []).filter(pt => pt.date === delivDate);
          const matchingBatches = allBatches.filter(pt => pt.product && delivProductIds.some(pid => { const p = products.find(x => x.id === pid); return prodNamesMatch(p?.name || "", pt.product); }));
          const batchList = matchingBatches.length > 0 ? matchingBatches : allBatches;
          return (
            <div>
              <label style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4, display: "block" }}>🏭 Batch</label>
              {batchList.length === 0
                ? <div style={{ background: "rgba(124,58,237,0.07)", border: "1.5px solid rgba(124,58,237,0.2)", borderRadius: 12, padding: "10px 14px" }}>
                  <p style={{ color: t.sub, fontSize: 12 }}>No batches logged for this date yet — save without assigning or log a production batch first.</p>
                </div>
                : <>
                  <select value={dF.batchId || ""} onChange={e => setDf(f => ({ ...f, batchId: e.target.value }))}
                    style={{ width: "100%", background: t.inp, border: `1.5px solid ${dF.batchId ? "#7c3aed60" : t.border}`, color: dF.batchId ? "#8b5cf6" : t.text, borderRadius: 12, padding: "10px 14px", fontSize: 13, outline: "none", cursor: "pointer" }}>
                    <option value="">— No Batch / Unassigned —</option>
                    {batchList.map(b => <option key={b.batchId || b.id} value={b.batchId || b.id}>{b.batchLabel || "Batch"} · {b.product} · {b.actual || 0} units</option>)}
                  </select>
                  {dF.batchId
                    ? <p style={{ color: "#8b5cf6", fontSize: 10, marginTop: 4, fontWeight: 600 }}>📦 Assigned to {batchList.find(b => (b.batchId || b.id) === dF.batchId)?.batchLabel || "batch"} — <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => setDf(f => ({ ...f, batchId: "" }))}>Clear</span></p>
                    : <p style={{ color: t.sub, fontSize: 10, marginTop: 4 }}>Select a batch or leave unassigned</p>
                  }
                </>
              }
            </div>
          );
        })()}
        <Inp dm={dm} label="Notes" value={dF.notes} onChange={e => setDf({ ...dF, notes: e.target.value })} placeholder="e.g. Leave at gate, call before" />
        <Hr dm={dm} />
        {/* Replacement */}
        <div style={{ background: dF.replacement?.done ? (dm ? "rgba(249,115,22,0.08)" : "rgba(249,115,22,0.05)") : (dm ? "rgba(255,255,255,0.03)" : "#fafaf8"), border: `1.5px solid ${dF.replacement?.done ? "#f9731650" : t.border}`, borderRadius: 16, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: dF.replacement?.done ? 14 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: dF.replacement?.done ? "#f9731625" : "#f9731612", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🔄</div>
              <div>
                <p style={{ color: dF.replacement?.done ? "#f97316" : t.text, fontWeight: 700, fontSize: 13 }}>Replacement / Return</p>
                <p style={{ color: t.sub, fontSize: 11 }}>Record items returned or swapped</p>
              </div>
            </div>
            <button onClick={() => setDf(f => ({ ...f, replacement: { ...(f.replacement || {}), done: !(f.replacement?.done) } }))}
              style={{ background: dF.replacement?.done ? "#f97316" : "transparent", color: dF.replacement?.done ? "#fff" : "#f97316", border: "2px solid #f97316", borderRadius: 12, padding: "7px 16px", fontSize: 12, fontWeight: 800, cursor: "pointer", minHeight: 40 }}>
              {dF.replacement?.done ? "✓ Replacement Logged" : "+ Log Replacement"}
            </button>
          </div>
          {dF.replacement?.done && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <p style={{ color: t.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Type</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[["swap", "🔄 Swap / Exchange"], ["return", "↩ Return / Refund"], ["damaged", "⚠️ Damaged"], ["wrong", "❌ Wrong Item"]].map(([v, l]) => (
                    <button key={v} onClick={() => setDf(f => ({ ...f, replacement: { ...(f.replacement || {}), type: v } }))}
                      style={{ background: dF.replacement?.type === v ? "#f9731622" : "transparent", color: dF.replacement?.type === v ? "#f97316" : t.sub, border: `1.5px solid ${dF.replacement?.type === v ? "#f97316" : t.border}`, borderRadius: 99, padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <Inp dm={dm} label="Item Being Replaced / Returned *" value={dF.replacement?.item || ""} onChange={e => setDf(f => ({ ...f, replacement: { ...(f.replacement || {}), item: e.target.value } }))} placeholder="e.g. Roti Pack, Paratha x10…" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(160px, 100%), 1fr))", gap: 10 }}>
                <Inp dm={dm} label="Quantity" value={dF.replacement?.qty || ""} onChange={e => setDf(f => ({ ...f, replacement: { ...(f.replacement || {}), qty: e.target.value } }))} placeholder="e.g. 10 pcs" />
                <Inp dm={dm} label="Amount to Deduct (₹)" type="number" value={dF.replacement?.amount || ""} onChange={e => setDf(f => ({ ...f, replacement: { ...(f.replacement || {}), amount: e.target.value } }))} placeholder="0" />
              </div>
              {(+dF.replacement?.amount) > 0 && (
                <div style={{ background: "#f9731618", border: "1px solid #f9731640", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ color: "#f97316", fontWeight: 700, fontSize: 12 }}>💡 Deduction preview</p>
                    <p style={{ color: t.sub, fontSize: 11, marginTop: 2 }}>{inr(+dF.replacement.amount)} will be deducted from this order's payable amount</p>
                  </div>
                  <span style={{ color: "#f97316", fontWeight: 900, fontSize: 18 }}>−{inr(+dF.replacement.amount)}</span>
                </div>
              )}
              <Inp dm={dm} label="Reason / Notes" value={dF.replacement?.reason || ""} onChange={e => setDf(f => ({ ...f, replacement: { ...(f.replacement || {}), reason: e.target.value } }))} placeholder="e.g. Customer complained quality, item expired, wrong order…" />
            </div>
          )}
        </div>
        <Hr dm={dm} />
        {/* Partial Payment */}
        {canSeePrices && (
          <div style={{ background: dF.partialPayment?.enabled ? (dm ? "rgba(16,185,129,0.08)" : "#f0fdf4") : (dm ? "rgba(255,255,255,0.03)" : "#fafaf8"), border: `1.5px solid ${dF.partialPayment?.enabled ? "#10b981" : t.border}`, borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <div>
                <p style={{ color: dF.partialPayment?.enabled ? "#10b981" : t.text, fontWeight: 700, fontSize: 13 }}>💰 Collect Partial Payment</p>
                <p style={{ color: t.sub, fontSize: 11, marginTop: 2 }}>Agent collects cash on delivery — flows into all reports</p>
              </div>
              <button onClick={() => setDf(f => ({ ...f, partialPayment: { ...f.partialPayment, enabled: !f.partialPayment?.enabled } }))}
                style={{ background: dF.partialPayment?.enabled ? "#10b981" : "transparent", color: dF.partialPayment?.enabled ? "#fff" : "#10b981", border: "2px solid #10b981", borderRadius: 10, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", minHeight: 36 }}>
                {dF.partialPayment?.enabled ? "✓ Enabled" : "+ Enable"}
              </button>
            </div>
          </div>
        )}
        <Hr dm={dm} />
        <div style={{ display: "flex", gap: 8 }}>
          <Btn dm={dm} v="ghost" style={{ flex: 1 }} onClick={() => setDsh(null)}>Cancel</Btn>
          <Btn dm={dm} v="primary" style={{ flex: 2 }} onClick={saveD}>{dSh === "add" ? "✓ Save Delivery" : "✓ Save Changes"}</Btn>
        </div>
      </Sheet>

      {/* Pay Ledger Sheet */}
      <Sheet dm={dm} open={!!payLedgerSh} onClose={() => setPayLedgerSh(false)} title="💳 Record Payment">
        <Sel dm={dm} label="Customer *" value={payLedgerCust?.id || ""} onChange={e => { const c = customers.find(x => x.id === e.target.value); setPayLedgerCust(c || null); }}>
          <option value="">— Select customer —</option>
          {customers.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Sel>
        <Inp dm={dm} label="Amount (₹) *" type="number" inputMode="decimal" value={payLedgerAmt} onChange={e => setPayLedgerAmt(e.target.value)} placeholder="0.00" />
        <Inp dm={dm} label="Note (optional)" value={payLedgerNote} onChange={e => setPayLedgerNote(e.target.value)} placeholder="e.g. Cash, UPI ref#1234…" />
        <Sel dm={dm} label="Method" value={payLedgerMethod} onChange={e => setPayLedgerMethod(e.target.value)}>
          {["Cash", "UPI", "Bank Transfer", "Cheque", "Other"].map(m => <option key={m}>{m}</option>)}
        </Sel>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <Btn dm={dm} v="ghost" style={{ flex: 1 }} onClick={() => setPayLedgerSh(false)}>Cancel</Btn>
          <Btn dm={dm} v="success" style={{ flex: 2 }} onClick={() => {
            if (!payLedgerCust) { notify("Select a customer"); return; }
            const amt = +payLedgerAmt;
            if (!amt || amt <= 0) { notify("Enter a valid amount"); return; }
            recordPaymentLedger(payLedgerCust.id, payLedgerCust.name, amt, payLedgerNote, payLedgerMethod);
            setPayLedgerSh(false); setPayLedgerCust(null); setPayLedgerAmt(""); setPayLedgerNote(""); setPayLedgerMethod("Cash");
          }}>✓ Confirm {payLedgerAmt && +payLedgerAmt > 0 ? inr(+payLedgerAmt) : ""}</Btn>
        </div>
      </Sheet>

      <Confirm dm={dm} msg={conf?.msg} onYes={() => { conf?.yes(); setConf(null); }} onNo={() => setConf(null)} />

      {/* Receipt Sheet */}
      <Sheet dm={dm} open={!!lastReceiptData} onClose={() => setLastReceiptData(null)} title={lastReceiptData?.viewOnly ? "🧾 Delivery Receipt" : "✅ Collection Confirmed"}>
        {lastReceiptData && (() => {
          const { delivery: rd, amt, note, customer, ts: rts, viewOnly } = lastReceiptData;
          const orderTotal = lineTotal(rd.orderLines);
          const replAmt = +(rd.replacement?.amount || 0);
          const netAmt = Math.max(0, orderTotal - replAmt);
          const collected = viewOnly ? (+(rd.partialPayment?.amount || 0)) : amt;
          const balanceDue = Math.max(0, netAmt - collected);
          const rows = Object.entries(rd.orderLines || {}).map(([id, qty]) => { const p = products.find(x => x.id === id) || {}; return { id, qty: +qty, name: p.name || id, priceAmount: +(p.price || 0) }; }).filter(r => r.qty > 0);
          const statusColor = rd.status === "Delivered" ? "#10b981" : rd.status === "In Transit" ? "#3b82f6" : rd.status === "Cancelled" ? "#ef4444" : "#f59e0b";
          const showReceiptPrices = settings?.agentInvoiceShowPrices !== false;
          const rcptInvNo = (invRegistry.issued || {})[rd.id];
          const rcptNo = rcptInvNo ? `RCP-${rcptInvNo.replace(/^[A-Z0-9]+-/, "")}` : `RCP-${(rd.id || "").slice(-8).toUpperCase()}`;
          return (
            <>
              {viewOnly
                ? <div style={{ background: statusColor + "18", border: `1.5px solid ${statusColor + "40"}`, borderRadius: 16, padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ color: statusColor, fontWeight: 900, fontSize: 16 }}>{rd.customer}</p>
                      <p style={{ color: t.sub, fontSize: 11, marginTop: 3 }}>📅 {rd.date}</p>
                      {rd.agent && <p style={{ color: t.sub, fontSize: 11 }}>👤 {rd.agent}</p>}
                      <p style={{ color: t.sub, fontSize: 10, marginTop: 2, fontFamily: "monospace" }}>{rcptInvNo ? `Invoice: ${rcptInvNo} · ` : ""}Receipt: {rcptNo}</p>
                    </div>
                    <span style={{ background: statusColor + "22", color: statusColor, fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 99 }}>{rd.status}</span>
                  </div>
                </div>
                : <div style={{ background: "#10b98120", border: "1.5px solid #10b98140", borderRadius: 16, padding: "14px 16px", textAlign: "center" }}>
                  <p style={{ fontSize: 32, lineHeight: 1, marginBottom: 6 }}>✅</p>
                  <p style={{ color: "#10b981", fontWeight: 900, fontSize: 18 }}>{inr(collected)} Collected</p>
                  <p style={{ color: t.sub, fontSize: 12, marginTop: 4 }}>{customer} · {rts}</p>
                </div>
              }
              {rows.length > 0 && (
                <div style={{ background: t.inp, borderRadius: 14, padding: "12px 14px" }}>
                  <p style={{ color: t.sub, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Items Ordered</p>
                  {rows.map(r => (
                    <div key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderBottom: `1px solid ${t.border}` }}>
                      <span style={{ color: t.sub }}>{r.qty} × {r.name}</span>
                      {showReceiptPrices && <span style={{ color: t.text, fontWeight: 600 }}>{inr(r.qty * r.priceAmount)}</span>}
                    </div>
                  ))}
                  {showReceiptPrices && orderTotal > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 8, fontWeight: 700 }}>
                      <span style={{ color: t.sub }}>Order Total</span>
                      <span style={{ color: t.text }}>{inr(orderTotal)}</span>
                    </div>
                  )}
                </div>
              )}
              {rd.replacement?.done && (
                <div style={{ background: "#f9731615", border: "1px solid #f9731630", borderRadius: 12, padding: "10px 12px" }}>
                  <p style={{ color: "#f97316", fontWeight: 700, fontSize: 12 }}>🔄 Replacement: {rd.replacement.item || "—"}{rd.replacement.qty ? ` (${rd.replacement.qty})` : ""}</p>
                  {showReceiptPrices && replAmt > 0 && <p style={{ color: "#f97316", fontWeight: 700, fontSize: 12, marginTop: 4 }}>Deducted: −{inr(replAmt)}</p>}
                </div>
              )}
              {showReceiptPrices && (
                <div style={{ background: t.inp, borderRadius: 14, padding: "12px 14px" }}>
                  <p style={{ color: t.sub, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Payment Summary</p>
                  {replAmt > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}><span style={{ color: "#f97316" }}>🔄 Replacement</span><span style={{ color: "#f97316", fontWeight: 700 }}>−{inr(replAmt)}</span></div>}
                  {collected > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}><span style={{ color: "#10b981" }}>✓ Collected</span><span style={{ color: "#10b981", fontWeight: 700 }}>{inr(collected)}</span></div>}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 0 0", borderTop: `2px solid ${t.border}`, fontWeight: 700, marginTop: 4 }}>
                    <span style={{ color: balanceDue === 0 ? "#10b981" : "#f59e0b" }}>{balanceDue === 0 ? "✓ Fully Settled" : "Balance Due"}</span>
                    <span style={{ color: balanceDue === 0 ? "#10b981" : "#f59e0b" }}>{inr(balanceDue)}</span>
                  </div>
                </div>
              )}
              {(note || (viewOnly && rd.partialPayment?.note)) && <p style={{ color: t.sub, fontSize: 12, fontStyle: "italic", textAlign: "center" }}>📝 "{note || (rd.partialPayment?.note)}"</p>}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Btn dm={dm} v="ghost" style={{ flex: 1 }} onClick={() => setLastReceiptData(null)}>Close</Btn>
                {(isAdmin || (settings?.receiptPrintAllowed || ["admin", "agent"]).includes(sess?.role)) && <Btn dm={dm} v="sky" style={{ flex: 1 }} onClick={() => exportDeliveryReceipt(rd, products, settings, ((invRegistry?.issued || {})[rd.id] || rd.id))}>🧾 Receipt</Btn>}
                {isAdmin && <Btn dm={dm} v="purple" style={{ flex: 1 }} onClick={() => exportDeliveryInvoice(rd, products, settings, ((invRegistry?.issued || {})[rd.id] || rd.id))}>📄 Invoice</Btn>}
              </div>
            </>
          );
        })()}
      </Sheet>
    </>
  );
}
