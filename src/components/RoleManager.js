/* eslint-disable react-hooks/exhaustive-deps */
// ============================================================
// components/RoleManager.js — Multi-Tenant Roles & Permissions (#17)
//
// Drop-in replacement / enhancement for the user management
// section inside Settings. Provides:
//
//   • RoleTemplateSelector  — pick a role preset (Admin / Agent /
//                             Factory / Custom) with one-click
//   • PermissionMatrix      — visual grid of all fine-grained
//                             permissions, grouped by section,
//                             with bulk grant/revoke
//   • TabAccessEditor       — which tabs/screens this user can see
//   • RoleBadge             — small coloured pill for any role
//   • RoleAuditLog          — last N permission changes for a user
//   • useRoleManager        — hook that wraps all state + helpers
//
// USAGE in CRM.js (replaces the current user sheet permission
// sections — drop in where the fine-grained permission JSX is):
//
//   import { PermissionMatrix, TabAccessEditor, RoleBadge,
//            RoleTemplateSelector, useRoleManager }
//     from "./components/RoleManager";
//
//   // Inside the user sheet, where the role/perm sections live:
//   const rm = useRoleManager({ uF, setUf, ROLE_DEF, FINE_PERM_DEFS,
//                                defaultFinePerms, ALL_TABS });
//   ...
//   <RoleTemplateSelector rm={rm} dm={dm} t={t} />
//   <TabAccessEditor      rm={rm} dm={dm} t={t} />
//   <PermissionMatrix     rm={rm} dm={dm} t={t} />
//
// ============================================================

import React, { useState, useMemo, useCallback } from "react";

// ── Section accent colours ────────────────────────────────────
const SECTION_COLORS = {
  Customers:   "#0ea5e9",
  Deliveries:  "#f59e0b",
  Supplies:    "#8b5cf6",
  Wastage:     "#f97316",
  Production:  "#6366f1",
  QC:          "#14b8a6",
  Dashboard:   "#10b981",
  GPS:         "#22c55e",
  Data:        "#64748b",
  Payments:    "#ec4899",
  Analytics:   "#3b82f6",
  Expenses:    "#ef4444",
};

// ── Role presets metadata ────────────────────────────────────
const ROLE_META = {
  admin:   { icon: "🔐", label: "Admin",          color: "#f59e0b", desc: "Full unrestricted access to everything" },
  agent:   { icon: "🚚", label: "Delivery Agent", color: "#0ea5e9", desc: "On the road — deliveries, collections, GPS" },
  factory: { icon: "🏭", label: "Factory Staff",  color: "#a855f7", desc: "Production, wastage, ingredient tracking" },
  custom:  { icon: "⚙️",  label: "Custom",         color: "#6b7280", desc: "Hand-pick exactly which permissions apply" },
};

// ── RoleBadge ─────────────────────────────────────────────────
export function RoleBadge({ role, size = "sm" }) {
  const meta = ROLE_META[role] || ROLE_META.custom;
  const pad  = size === "lg" ? "6px 14px" : "3px 9px";
  const fs   = size === "lg" ? 13 : 11;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: `${meta.color}18`,
      border: `1.5px solid ${meta.color}40`,
      color: meta.color,
      borderRadius: 99,
      padding: pad, fontSize: fs, fontWeight: 700,
      letterSpacing: "0.01em",
    }}>
      {meta.icon} {meta.label}
    </span>
  );
}

// ── useRoleManager hook ───────────────────────────────────────
export function useRoleManager({ uF, setUf, ROLE_DEF, FINE_PERM_DEFS, defaultFinePerms, ALL_TABS }) {
  const fp      = uF.finePerms || defaultFinePerms(uF.role);
  const isAdmin = uF.role === "admin";

  const setFp = useCallback((key, val) => {
    setUf(f => ({ ...f, finePerms: { ...(f.finePerms || defaultFinePerms(f.role)), [key]: val } }));
  }, [setUf, defaultFinePerms]);

  const setFpBulk = useCallback((keys, val) => {
    setUf(f => {
      const cur = f.finePerms || defaultFinePerms(f.role);
      const next = { ...cur };
      keys.forEach(k => { next[k] = val; });
      return { ...f, finePerms: next };
    });
  }, [setUf, defaultFinePerms]);

  const applyTemplate = useCallback((role) => {
    setUf(f => ({
      ...f,
      role,
      permissions: [...(ROLE_DEF[role] || ROLE_DEF.agent)],
      finePerms: defaultFinePerms(role),
    }));
  }, [setUf, ROLE_DEF, defaultFinePerms]);

  const toggleTab = useCallback((tb) => {
    setUf(f => {
      const p = f.permissions || [];
      return { ...f, permissions: p.includes(tb) ? p.filter(x => x !== tb) : [...p, tb] };
    });
  }, [setUf]);

  const sections = useMemo(() =>
    [...new Set((FINE_PERM_DEFS || []).map(d => d.section))],
    [FINE_PERM_DEFS]
  );

  const sectionPerms = useCallback((sec) =>
    (FINE_PERM_DEFS || []).filter(d => d.section === sec),
    [FINE_PERM_DEFS]
  );

  return { uF, fp, isAdmin, setFp, setFpBulk, applyTemplate, toggleTab, sections, sectionPerms, ALL_TABS };
}

// ── RoleTemplateSelector ──────────────────────────────────────
export function RoleTemplateSelector({ rm, dm, t }) {
  const { uF, applyTemplate } = rm;
  const roles = ["agent", "factory", "admin"];

  return (
    <div style={{
      background: dm ? "rgba(255,255,255,0.03)" : "#f8fafc",
      border: `1px solid ${t?.border || "rgba(0,0,0,0.08)"}`,
      borderRadius: 18, padding: "16px",
    }}>
      <div style={{ marginBottom: 14 }}>
        <p style={{ color: t?.text, fontWeight: 800, fontSize: 14, lineHeight: 1.2 }}>Role Template</p>
        <p style={{ color: t?.sub, fontSize: 12, marginTop: 3 }}>
          Selecting a role applies its default permissions — you can customise below.
        </p>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(min(130px, 100%), 1fr))",
        gap: 10,
      }}>
        {roles.map(role => {
          const meta = ROLE_META[role];
          const active = uF.role === role;
          return (
            <button
              key={role}
              onClick={() => applyTemplate(role)}
              style={{
                background: active ? `${meta.color}18` : dm ? "rgba(255,255,255,0.04)" : "#fff",
                border: `2px solid ${active ? meta.color : t?.border || "rgba(0,0,0,0.1)"}`,
                borderRadius: 14, padding: "14px 10px",
                textAlign: "center", cursor: "pointer",
                transition: "all 0.15s",
                boxShadow: active ? `0 0 0 3px ${meta.color}18` : "none",
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 6, lineHeight: 1 }}>{meta.icon}</div>
              <p style={{ color: active ? meta.color : t?.text, fontWeight: 800, fontSize: 12, lineHeight: 1.2 }}>{meta.label}</p>
              <p style={{ color: t?.sub, fontSize: 10, marginTop: 4, lineHeight: 1.4 }}>{meta.desc}</p>
              {active && (
                <div style={{
                  marginTop: 8, background: meta.color, color: "#fff",
                  borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700,
                  display: "inline-block",
                }}>Active</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── TabAccessEditor ───────────────────────────────────────────
export function TabAccessEditor({ rm, dm, t }) {
  const { uF, isAdmin, toggleTab, ALL_TABS } = rm;
  if (isAdmin) {
    return (
      <div style={{
        background: "#f59e0b11", border: "1px solid #f59e0b33",
        borderRadius: 16, padding: "14px 16px",
      }}>
        <p style={{ color: "#f59e0b", fontWeight: 800, fontSize: 13 }}>🔐 Admin — Full Access</p>
        <p style={{ color: t?.sub, fontSize: 12, marginTop: 4 }}>
          Admins always see all tabs and have full access. No restrictions apply.
        </p>
      </div>
    );
  }

  const TAB_ICONS = {
    Dashboard: "📊", Customers: "👥", Deliveries: "🚚", Payments: "💳",
    Supplies: "📦", Expenses: "💸", Wastage: "🗑️", "P&L": "📈",
    Analytics: "🔍", Production: "🏭", Ingredients: "🧂", Staff: "🧑‍🍳",
    Machines: "⚙️", Vehicles: "🚐", GPS: "📍", Settings: "⚙️",
  };

  const visibleTabs = (ALL_TABS || []).filter(tb => tb !== "Settings");
  const selectedCount = (uF.permissions || []).filter(tb => visibleTabs.includes(tb)).length;

  const allOn  = selectedCount === visibleTabs.length;

  return (
    <div style={{
      background: dm ? "rgba(255,255,255,0.03)" : "#f8fafc",
      border: `1px solid ${t?.border || "rgba(0,0,0,0.08)"}`,
      borderRadius: 18, overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px",
        borderBottom: `1px solid ${t?.border || "rgba(0,0,0,0.07)"}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <p style={{ color: t?.text, fontWeight: 800, fontSize: 13 }}>📱 Accessible Screens</p>
          <p style={{ color: t?.sub, fontSize: 11, marginTop: 2 }}>
            {selectedCount} of {visibleTabs.length} sections enabled
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => { rm.setUf?.(f => ({ ...f, permissions: allOn ? [] : [...visibleTabs] })); }}
            style={{
              background: "transparent", border: `1px solid ${t?.border}`,
              color: t?.sub, borderRadius: 8, padding: "5px 10px",
              fontSize: 10, fontWeight: 700, cursor: "pointer",
            }}
          >
            {allOn ? "Deselect all" : "Select all"}
          </button>
        </div>
      </div>

      {/* Tab grid */}
      <div style={{
        padding: "14px 16px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(min(120px, 100%), 1fr))",
        gap: 8,
      }}>
        {visibleTabs.map(tb => {
          const on = (uF.permissions || []).includes(tb);
          return (
            <button
              key={tb}
              onClick={() => toggleTab(tb)}
              style={{
                background: on
                  ? dm ? "rgba(37,99,235,0.18)" : "rgba(37,99,235,0.08)"
                  : dm ? "rgba(255,255,255,0.04)" : "#fff",
                border: `1.5px solid ${on ? "#2563eb" : t?.border || "rgba(0,0,0,0.1)"}`,
                borderRadius: 12, padding: "10px 10px",
                display: "flex", alignItems: "center", gap: 8,
                cursor: "pointer", transition: "all 0.12s",
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>{TAB_ICONS[tb] || "•"}</span>
              <span style={{
                color: on ? "#2563eb" : t?.sub,
                fontSize: 12, fontWeight: 700, flex: 1, textAlign: "left",
              }}>{tb}</span>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: on ? "#2563eb" : "transparent",
                border: `2px solid ${on ? "#2563eb" : t?.border || "#ccc"}`,
                flexShrink: 0,
              }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── PermissionMatrix ──────────────────────────────────────────
export function PermissionMatrix({ rm, dm, t }) {
  const { fp, isAdmin, setFp, setFpBulk, sections, sectionPerms } = rm;
  const [expandedSections, setExpandedSections] = useState(() => new Set(sections.slice(0, 3)));
  const [search, setSearch] = useState("");

  if (isAdmin) return null;

  const toggleSection = (sec) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(sec) ? next.delete(sec) : next.add(sec);
      return next;
    });
  };

  const q = search.toLowerCase();
  const filteredSections = sections.filter(sec => {
    if (!q) return true;
    const perms = sectionPerms(sec);
    return sec.toLowerCase().includes(q) || perms.some(p => p.label.toLowerCase().includes(q) || (p.desc || "").toLowerCase().includes(q));
  });

  // Overall summary
  const allPerms = sections.flatMap(sec => sectionPerms(sec));
  const enabledCount = allPerms.filter(p => fp[p.key]).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Header + search */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <p style={{ color: t?.text, fontWeight: 800, fontSize: 13 }}>⚙️ Granular Permissions</p>
          <p style={{ color: t?.sub, fontSize: 11, marginTop: 2 }}>
            {enabledCount} of {allPerms.length} permissions enabled
          </p>
        </div>
        <div style={{ position: "relative" }}>
          <svg style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t?.sub} strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter permissions…"
            style={{
              background: dm ? "rgba(255,255,255,0.06)" : "#f1f5f9",
              border: `1px solid ${t?.border || "rgba(0,0,0,0.1)"}`,
              color: t?.text, borderRadius: 10,
              padding: "7px 12px 7px 28px",
              fontSize: 12, outline: "none", width: 180,
            }}
          />
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, borderRadius: 4, background: t?.border || "rgba(0,0,0,0.08)", overflow: "hidden" }}>
        <div style={{
          width: `${Math.round(enabledCount / Math.max(1, allPerms.length) * 100)}%`,
          height: "100%", borderRadius: 4,
          background: "linear-gradient(90deg, #2563eb, #10b981)",
          transition: "width 0.4s ease",
        }} />
      </div>

      {/* Permission sections */}
      {filteredSections.map(sec => {
        const perms  = sectionPerms(sec).filter(p => !q || p.label.toLowerCase().includes(q) || (p.desc||"").toLowerCase().includes(q) || sec.toLowerCase().includes(q));
        if (perms.length === 0) return null;
        const color  = SECTION_COLORS[sec] || "#6b7280";
        const allOn  = perms.every(p => fp[p.key]);
        const anyOn  = perms.some(p => fp[p.key]);
        const open   = expandedSections.has(sec) || !!q;

        return (
          <div
            key={sec}
            style={{
              background: dm ? "rgba(255,255,255,0.03)" : "#fff",
              border: `1.5px solid ${anyOn ? color + "35" : t?.border || "rgba(0,0,0,0.08)"}`,
              borderRadius: 16, overflow: "hidden",
              transition: "border-color 0.2s",
            }}
          >
            {/* Section header */}
            <button
              onClick={() => toggleSection(sec)}
              style={{
                width: "100%", background: "transparent", border: "none",
                padding: "12px 16px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 10,
                borderBottom: open ? `1px solid ${t?.border || "rgba(0,0,0,0.07)"}` : "none",
              }}
            >
              {/* Status dot */}
              <div style={{
                width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                background: allOn ? color : anyOn ? color + "88" : "transparent",
                border: `2px solid ${allOn ? color : anyOn ? color + "66" : t?.border || "#ccc"}`,
                boxShadow: allOn ? `0 0 6px ${color}60` : "none",
              }} />

              {/* Section name + count */}
              <div style={{ flex: 1, textAlign: "left" }}>
                <span style={{ color: t?.text, fontWeight: 700, fontSize: 13 }}>{sec}</span>
                <span style={{
                  marginLeft: 8,
                  background: anyOn ? `${color}18` : dm ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
                  color: anyOn ? color : t?.sub,
                  borderRadius: 6, padding: "1px 7px", fontSize: 10, fontWeight: 700,
                }}>
                  {perms.filter(p => fp[p.key]).length}/{perms.length}
                </span>
              </div>

              {/* Bulk toggle */}
              <button
                onClick={e => { e.stopPropagation(); setFpBulk(perms.map(p => p.key), !allOn); }}
                style={{
                  fontSize: 10, fontWeight: 700,
                  color: allOn ? color : t?.sub,
                  background: allOn ? `${color}18` : "transparent",
                  border: `1px solid ${allOn ? color + "44" : t?.border || "rgba(0,0,0,0.1)"}`,
                  borderRadius: 7, padding: "5px 10px", cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {allOn ? "Revoke all" : "Grant all"}
              </button>

              {/* Chevron */}
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={t?.sub} strokeWidth="2.5" strokeLinecap="round"
                style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s", flexShrink: 0 }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Individual permissions */}
            {open && perms.map(({ key, label, desc, icon }, i) => {
              const on = fp[key] === true;
              return (
                <div
                  key={key}
                  onClick={() => setFp(key, !on)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "11px 16px",
                    borderBottom: i < perms.length - 1 ? `1px solid ${t?.border || "rgba(0,0,0,0.05)"}` : "none",
                    cursor: "pointer",
                    background: on
                      ? dm ? `${color}0a` : `${color}06`
                      : "transparent",
                    transition: "background 0.12s",
                  }}
                >
                  <span style={{ fontSize: 16, width: 22, textAlign: "center", flexShrink: 0 }}>{icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: on ? t?.text : t?.sub, fontSize: 12, fontWeight: on ? 700 : 500, lineHeight: 1.2 }}>{label}</p>
                    {desc && <p style={{ color: t?.sub, fontSize: 10, marginTop: 2, lineHeight: 1.4 }}>{desc}</p>}
                  </div>

                  {/* Toggle pill */}
                  <div style={{
                    width: 40, height: 22, borderRadius: 11, flexShrink: 0,
                    background: on ? color : dm ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)",
                    position: "relative", transition: "background 0.2s",
                    cursor: "pointer",
                  }}>
                    <div style={{
                      position: "absolute", top: 3,
                      left: on ? 21 : 3,
                      width: 16, height: 16, borderRadius: "50%",
                      background: "#fff",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                      transition: "left 0.18s cubic-bezier(0.4,0,0.2,1)",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {filteredSections.length === 0 && (
        <div style={{ textAlign: "center", padding: "24px 0", color: t?.sub, fontSize: 13 }}>
          No permissions match "{search}"
        </div>
      )}
    </div>
  );
}

// ── RoleAuditLog — shows last N permission changes ─────────────
// Pass actLog from CRM, filtered to this user
export function RoleAuditLog({ actLog = [], userId, userName, dm, t, maxItems = 8 }) {
  const entries = useMemo(() =>
    (actLog || [])
      .filter(e => (e.userId === userId || e.user === userName) && (e.action || "").toLowerCase().includes("perm"))
      .slice(0, maxItems),
    [actLog, userId, userName, maxItems]
  );

  if (entries.length === 0) return null;

  return (
    <div style={{
      background: dm ? "rgba(255,255,255,0.03)" : "#f8fafc",
      border: `1px solid ${t?.border || "rgba(0,0,0,0.08)"}`,
      borderRadius: 16, overflow: "hidden",
    }}>
      <div style={{ padding: "10px 14px", borderBottom: `1px solid ${t?.border || "rgba(0,0,0,0.07)"}` }}>
        <p style={{ color: t?.text, fontWeight: 700, fontSize: 12 }}>🕐 Recent Permission Changes</p>
      </div>
      {entries.map((e, i) => (
        <div key={e.id || i} style={{
          display: "flex", gap: 10, padding: "9px 14px",
          borderBottom: i < entries.length - 1 ? `1px solid ${t?.border || "rgba(0,0,0,0.05)"}` : "none",
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, flexShrink: 0,
          }}>🔑</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: t?.text, fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {(e.action || "").replace(/^\[[^\]]+\]\s*/i, "")}
            </p>
            <p style={{ color: t?.sub, fontSize: 10, marginTop: 1 }}>
              {e.user} · {e.ts}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── PermissionSummaryBadges — quick visual overview ───────────
export function PermissionSummaryBadges({ fp = {}, FINE_PERM_DEFS = [], t }) {
  const sections = [...new Set(FINE_PERM_DEFS.map(d => d.section))];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {sections.map(sec => {
        const perms = FINE_PERM_DEFS.filter(d => d.section === sec);
        const count = perms.filter(p => fp[p.key]).length;
        const color = SECTION_COLORS[sec] || "#6b7280";
        if (count === 0) return null;
        return (
          <span key={sec} style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: `${color}14`,
            border: `1px solid ${color}30`,
            color: color,
            borderRadius: 99, padding: "3px 9px",
            fontSize: 10, fontWeight: 700,
          }}>
            {sec} {count}/{perms.length}
          </span>
        );
      })}
    </div>
  );
}

export default PermissionMatrix;
