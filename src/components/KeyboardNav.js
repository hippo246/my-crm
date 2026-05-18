// ============================================================
// src/components/KeyboardNav.js
//
// Global keyboard shortcuts + help modal for the CRM.
//
// USAGE in CRM.js:
//   import { useKeyboardNav, KeyboardHelpModal } from "./components/KeyboardNav";
//
//   // Inside CRM component:
//   const { helpOpen, setHelpOpen } = useKeyboardNav({
//     setTab, setDsh, setDf, blkD,
//     setCsh, setCf, blkC,
//     setSsh, setSf, blkS,
//     setEsh, setEf, blkE,
//     setWSh, setWF, blkW,
//     setTrashOpen, setTimelineOpen, setCmdOpen,
//     setSrch,
//     isAdmin, can, tabs,
//   });
//
//   // Mount the modal anywhere at root level:
//   <KeyboardHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} dm={dm} t={t} isAdmin={isAdmin} can={can} />
// ============================================================

import React, { useEffect, useState, useCallback } from "react";

// ── Shortcut definitions ──────────────────────────────────────
// Each shortcut: { key, mod, label, description, group, adminOnly, permKey }
export const SHORTCUTS = [
  // Navigation
  { group: "Navigation", key: "1", label: "Go to Dashboard",   description: "Switch to Dashboard tab" },
  { group: "Navigation", key: "2", label: "Go to Customers",   description: "Switch to Customers tab" },
  { group: "Navigation", key: "3", label: "Go to Deliveries",  description: "Switch to Deliveries tab" },
  { group: "Navigation", key: "4", label: "Go to Payments",    description: "Switch to Payments tab" },
  { group: "Navigation", key: "5", label: "Go to Supplies",    description: "Switch to Supplies tab" },
  { group: "Navigation", key: "6", label: "Go to Expenses",    description: "Switch to Expenses tab" },
  { group: "Navigation", key: "7", label: "Go to Analytics",   description: "Switch to Analytics tab",  adminOnly: true },
  { group: "Navigation", key: "8", label: "Go to Production",  description: "Switch to Production tab" },
  { group: "Navigation", key: "9", label: "Go to Settings",    description: "Switch to Settings tab",   adminOnly: true },

  // Quick create
  { group: "Quick Create", key: "d", mod: "shift", label: "New Delivery",  description: "Open new delivery sheet",  permKey: "deliv_add" },
  { group: "Quick Create", key: "c", mod: "shift", label: "New Customer",  description: "Open new customer sheet",  permKey: "cust_add" },
  { group: "Quick Create", key: "s", mod: "shift", label: "Log Supply",    description: "Open new supply sheet",    permKey: "sup_add" },
  { group: "Quick Create", key: "e", mod: "shift", label: "Log Expense",   description: "Open new expense sheet",   permKey: "exp_add" },
  { group: "Quick Create", key: "w", mod: "shift", label: "Log Wastage",   description: "Open new wastage sheet" },

  // Panels
  { group: "Panels", key: "/",   label: "Search",            description: "Focus the search bar" },
  { group: "Panels", key: "k",   mod: "meta", label: "Command Palette", description: "Open command palette" },
  { group: "Panels", key: "t",   mod: "shift", label: "Trash",          description: "Open trash panel",    adminOnly: true },
  { group: "Panels", key: "a",   mod: "shift", label: "Activity Log",   description: "Open activity timeline" },
  { group: "Panels", key: "b",   mod: "shift", label: "Kanban Board",   description: "Open order pipeline board" },
  { group: "Panels", key: "l",   mod: "shift", label: "Audit Log",      description: "Open full change history", adminOnly: true },
  { group: "Panels", key: "?",   label: "Keyboard Shortcuts", description: "Show this help modal" },
  { group: "Panels", key: "Escape", label: "Close / Cancel",  description: "Close any open panel or modal" },
];

const TAB_KEYS = {
  "1": "Dashboard",
  "2": "Customers",
  "3": "Deliveries",
  "4": "Payments",
  "5": "Supplies",
  "6": "Expenses",
  "7": "Analytics",
  "8": "Production",
  "9": "Settings",
};

// ── Hook ──────────────────────────────────────────────────────
export function useKeyboardNav({
  setTab,
  setDsh, setDf, blkD,
  setCsh, setCf, blkC,
  setSsh, setSf, blkS,
  setEsh, setEf, blkE,
  setWSh, setWF, blkW,
  setTrashOpen,
  setTimelineOpen,
  setCmdOpen,
  setKanbanOpen,
  setAuditOpen,
  setSrch,
  isAdmin, can,
  tabs = [],
}) {
  const [helpOpen, setHelpOpen] = useState(false);

  const handleKey = useCallback((e) => {
    // Skip if typing in an input/textarea/select
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (["input", "textarea", "select"].includes(tag) && e.key !== "Escape") return;

    const isShift = e.shiftKey;
    const isMeta  = e.metaKey || e.ctrlKey;
    const key     = e.key;

    // Tab navigation (1–9) — no modifier
    if (!isShift && !isMeta && TAB_KEYS[key]) {
      const targetTab = TAB_KEYS[key];
      if (tabs.length === 0 || tabs.includes(targetTab)) {
        e.preventDefault();
        setTab(targetTab);
      }
      return;
    }

    // ? = help
    if (key === "?" && !isMeta) {
      e.preventDefault();
      setHelpOpen(h => !h);
      return;
    }

    // Escape = close help
    if (key === "Escape") {
      setHelpOpen(false);
      return;
    }

    // / = focus search
    if (key === "/" && !isMeta && !isShift) {
      e.preventDefault();
      const searchEl = document.querySelector("input[placeholder*='earch'], input[placeholder*='search']");
      if (searchEl) searchEl.focus();
      return;
    }

    // Cmd/Ctrl+K = command palette
    if (isMeta && key.toLowerCase() === "k") {
      e.preventDefault();
      setCmdOpen?.(o => !o);
      return;
    }

    // Shift shortcuts — quick create / open panels
    if (isShift && !isMeta) {
      switch (key.toUpperCase()) {
        case "D":
          if (can?.("deliv_add") ?? true) { e.preventDefault(); setDsh?.("add"); setDf?.(blkD?.()); }
          break;
        case "C":
          if (can?.("cust_add") ?? true) { e.preventDefault(); setCsh?.("add"); setCf?.(blkC?.()); }
          break;
        case "S":
          if (can?.("sup_add") ?? true) { e.preventDefault(); setSsh?.("add"); setSf?.(blkS?.()); }
          break;
        case "E":
          if (can?.("exp_add") ?? true) { e.preventDefault(); setEsh?.("add"); setEf?.(blkE?.()); }
          break;
        case "W":
          e.preventDefault(); setWSh?.("add"); setWF?.(blkW?.());
          break;
        case "T":
          if (isAdmin) { e.preventDefault(); setTrashOpen?.(o => !o); }
          break;
        case "A":
          e.preventDefault(); setTimelineOpen?.(o => !o);
          break;
        case "B":
          e.preventDefault(); setKanbanOpen?.(o => !o);
          break;
        case "L":
          if (isAdmin) { e.preventDefault(); setAuditOpen?.(o => !o); }
          break;
        default: break;
      }
    }
  }, [setTab, setDsh, setDf, blkD, setCsh, setCf, blkC, setSsh, setSf, blkS, setEsh, setEf, blkE, setWSh, setWF, blkW, setTrashOpen, setTimelineOpen, setCmdOpen, setKanbanOpen, setAuditOpen, isAdmin, can, tabs, setHelpOpen]);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  return { helpOpen, setHelpOpen };
}

// ── Help Modal ────────────────────────────────────────────────
export function KeyboardHelpModal({ open, onClose, dm, t, isAdmin, can }) {
  const text   = t?.text   || (dm ? "#f1f5f9" : "#0f172a");
  const sub    = t?.sub    || (dm ? "#94a3b8" : "#64748b");
  const card   = t?.card   || (dm ? "#1e293b" : "#ffffff");
  const inp    = t?.inp    || (dm ? "#0f172a" : "#f8fafc");
  const border = t?.border || (dm ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)");

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, onClose]);

  if (!open) return null;

  // Group shortcuts
  const groups = [...new Set(SHORTCUTS.map(s => s.group))];

  function isVisible(s) {
    if (s.adminOnly && !isAdmin) return false;
    if (s.permKey && can && !can(s.permKey) && !isAdmin) return false;
    return true;
  }

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 2000, backdropFilter: "blur(4px)",
      }} />

      {/* Modal — centered on tablet+, bottom sheet on mobile */}
      <div style={{
        position: "fixed",
        zIndex: 2001,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        background: card,
        border: `1px solid ${border}`,
        boxShadow: isMobile ? "0 -8px 40px rgba(0,0,0,0.3)" : "0 24px 80px rgba(0,0,0,0.4)",
        ...(isMobile ? {
          left: 0, right: 0, bottom: 0,
          top: "auto",
          borderRadius: "20px 20px 0 0",
          maxHeight: "88vh",
        } : {
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(580px, 94vw)",
          maxHeight: "85vh",
          borderRadius: 20,
        }),
      }}>
        {/* Header */}
        <div style={{
          padding: isMobile ? "12px 16px 12px" : "20px 24px 16px",
          borderBottom: `1px solid ${border}`,
          display: "flex", flexDirection: "column",
          background: dm
            ? "linear-gradient(135deg,rgba(99,102,241,0.12) 0%,rgba(0,0,0,0) 100%)"
            : "linear-gradient(135deg,rgba(99,102,241,0.06) 0%,rgba(0,0,0,0) 100%)",
          flexShrink: 0,
        }}>
          {/* Drag handle — mobile only */}
          {isMobile && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <div style={{ width: 36, height: 4, borderRadius: 99, background: border }} />
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>⌨️</span>
                <span style={{ color: text, fontSize: 16, fontWeight: 800 }}>
                  {isMobile ? "App Shortcuts" : "Keyboard Shortcuts"}
                </span>
              </div>
              <p style={{ color: sub, fontSize: 11, marginTop: 3 }}>
                {isMobile ? "Available actions and navigation" : "Navigate and create without lifting your hands from the keyboard"}
              </p>
            </div>
            <button onClick={onClose} style={{
              background: "transparent", border: "none",
              color: sub, fontSize: 20, cursor: "pointer",
              padding: "8px", borderRadius: 10,
              minWidth: 36, minHeight: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>✕</button>
          </div>
        </div>

        {/* Content */}
        <div style={{ overflowY: "auto", padding: isMobile ? "14px 16px 24px" : "16px 24px 24px", WebkitOverflowScrolling: "touch" }}>
          {groups.map(group => {
            const groupShortcuts = SHORTCUTS.filter(s => s.group === group && isVisible(s));
            if (groupShortcuts.length === 0) return null;
            return (
              <div key={group} style={{ marginBottom: 20 }}>
                <p style={{
                  color: sub, fontSize: 10, fontWeight: 800,
                  textTransform: "uppercase", letterSpacing: "0.09em",
                  marginBottom: 8,
                }}>{group}</p>
                <div style={{
                  background: inp,
                  border: `1px solid ${border}`,
                  borderRadius: 14,
                  overflow: "hidden",
                }}>
                  {groupShortcuts.map((s, i) => (
                    <div key={s.key + (s.mod || "")} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: isMobile ? "13px 14px" : "11px 16px",
                      borderBottom: i < groupShortcuts.length - 1 ? `1px solid ${border}` : "none",
                    }}>
                      <div>
                        <span style={{ color: text, fontSize: 13, fontWeight: 600 }}>{s.label}</span>
                        {s.description && (
                          <span style={{ color: sub, fontSize: 11, marginLeft: 8 }}>{s.description}</span>
                        )}
                      </div>
                      {!isMobile && (
                        <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                          {s.mod === "meta" && <Kbd dm={dm} t={t}>⌘</Kbd>}
                          {s.mod === "shift" && <Kbd dm={dm} t={t}>⇧</Kbd>}
                          <Kbd dm={dm} t={t}>{s.key === "Escape" ? "Esc" : s.key === "/" ? "/" : s.key === "?" ? "?" : s.key.toUpperCase()}</Kbd>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {!isMobile && (
            <p style={{ color: sub, fontSize: 11, textAlign: "center", marginTop: 4 }}>
              Press <Kbd inline dm={dm} t={t}>?</Kbd> anywhere to toggle this panel · Shortcuts disabled when typing in fields
            </p>
          )}
        </div>
      </div>
    </>
  );
}

// ── Keyboard key badge ────────────────────────────────────────
function Kbd({ children, dm, t, inline }) {
  const text   = t?.text   || (dm ? "#f1f5f9" : "#0f172a");
  const inp    = t?.inp    || (dm ? "#0f172a" : "#f8fafc");
  const border = t?.border || (dm ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)");

  return (
    <span style={{
      display: inline ? "inline-flex" : "flex",
      alignItems: "center", justifyContent: "center",
      background: inp,
      border: `1px solid ${border}`,
      borderBottom: `2px solid ${border}`,
      borderRadius: 6,
      padding: "2px 7px",
      fontSize: 11, fontWeight: 700,
      fontFamily: "monospace",
      color: text,
      minWidth: 22,
    }}>{children}</span>
  );
}

// ── Keyboard shortcut hint badge (for use in UI) ──────────────
export function ShortcutBadge({ children, dm, t }) {
  return <Kbd dm={dm} t={t}>{children}</Kbd>;
}
