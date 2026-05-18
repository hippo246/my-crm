/* eslint-disable react-hooks/exhaustive-deps */
// ============================================================
// components/QuickEntry.js — Mobile Fast-Add Mode (#16)
//
// A floating action button (FAB) that opens a bottom sheet
// with one-tap shortcuts for the most common CRM actions:
//   • New Delivery   • Record Payment   • Log Wastage
//   • New Customer   • New Expense      • New Supply
//
// Also exposes a <QuickEntryBar /> for tablet/desktop inline
// use (renders as a horizontal strip of icon-buttons).
//
// USAGE in CRM.js:
//   import { QuickEntryFAB, QuickEntryBar } from "./components/QuickEntry";
//
//   // Inside the render return, after the main layout:
//   <QuickEntryFAB
//     dm={dm} t={t} tab={tab} sess={sess} can={can} isAdmin={isAdmin}
//     customers={customers} products={products} settings={settings}
//     today={today}
//     onNewDelivery={()=>{ setDf(blkD()); setDsh("add"); setTab("Deliveries"); }}
//     onNewCustomer={()=>{ setCf(blkC()); setCsh("add"); setTab("Customers"); }}
//     onNewExpense={()=>{ setEf(blkE()); setEsh("add"); setTab("Expenses"); }}
//     onNewSupply={()=>{ setSf(blkS()); setSsh("add"); setTab("Supplies"); }}
//     onNewWastage={()=>{ setWF(blkW()); setWSh("add"); setTab("Wastage"); }}
//     onRecordPayment={()=>{ setPayLedgerSh(true); }}
//   />
//
//   // Optional: inside the desktop header toolbar
//   <QuickEntryBar dm={dm} t={t} ... (same props) />
//
// ============================================================

import React, { useState, useEffect, useCallback } from "react";

// ── helpers ──────────────────────────────────────────────────
function useWindowWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    let raf;
    const handle = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setW(window.innerWidth)); };
    window.addEventListener("resize", handle);
    window.addEventListener("orientationchange", handle);
    return () => { window.removeEventListener("resize", handle); window.removeEventListener("orientationchange", handle); cancelAnimationFrame(raf); };
  }, []);
  return w;
}

// ── Action definitions ────────────────────────────────────────
function buildActions({ can, isAdmin, sess, tab }) {
  return [
    {
      id: "delivery", icon: "🚚", label: "New Delivery", color: "#3b82f6",
      show: isAdmin || can("deliv_add"),
      handlerKey: "onNewDelivery",
    },
    {
      id: "payment", icon: "💰", label: "Record Payment", color: "#10b981",
      show: isAdmin || can("payment_record"),
      handlerKey: "onRecordPayment",
    },
    {
      id: "customer", icon: "👤", label: "New Customer", color: "#f59e0b",
      show: isAdmin || can("cust_add"),
      handlerKey: "onNewCustomer",
    },
    {
      id: "wastage", icon: "♻️", label: "Log Wastage", color: "#f97316",
      show: isAdmin || can("waste_log"),
      handlerKey: "onNewWastage",
    },
    {
      id: "expense", icon: "💸", label: "New Expense", color: "#8b5cf6",
      show: isAdmin || can("exp_add"),
      handlerKey: "onNewExpense",
    },
    {
      id: "supply", icon: "📦", label: "New Supply", color: "#0ea5e9",
      show: isAdmin || can("sup_add"),
      handlerKey: "onNewSupply",
    },
  ].filter(a => a.show);
}

// ── FAB (floating action button) ─────────────────────────────
export function QuickEntryFAB(props) {
  const {
    dm, t, sess, can, isAdmin, tab,
    onNewDelivery, onNewCustomer, onNewExpense,
    onNewSupply, onNewWastage, onRecordPayment,
    onOpenChange,
  } = props;

  const [open, setOpen] = useState(false);
  const [animIn, setAnimIn] = useState(false);
  const w = useWindowWidth();
  // Only show FAB on mobile/tablet (< 1024px) where the sidebar is hidden
  const isMobile = w < 1024;

  const handlers = {
    onNewDelivery, onNewCustomer, onNewExpense,
    onNewSupply, onNewWastage, onRecordPayment,
  };

  const actions = buildActions({ can, isAdmin, sess, tab });

  const openSheet = useCallback(() => {
    setOpen(true);
    requestAnimationFrame(() => setAnimIn(true));
    onOpenChange?.(true);
  }, [onOpenChange]);

  const closeSheet = useCallback(() => {
    setAnimIn(false);
    setTimeout(() => setOpen(false), 260);
    onOpenChange?.(false);
  }, [onOpenChange]);

  const fire = useCallback((action) => {
    closeSheet();
    setTimeout(() => handlers[action.handlerKey]?.(), 120);
  }, [closeSheet, handlers]);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    const fn = (e) => { if (e.key === "Escape") closeSheet(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, closeSheet]);

  // Lock body scroll while open
  useEffect(() => {
    if (open) { document.body.style.overflow = "hidden"; }
    else { document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!isMobile || actions.length === 0) return null;

  // Context-aware primary action: what's most useful for current tab
  const contextAction =
    tab === "Deliveries" ? actions.find(a => a.id === "delivery") :
    tab === "Customers"  ? actions.find(a => a.id === "customer") :
    tab === "Payments"   ? actions.find(a => a.id === "payment") :
    tab === "Expenses"   ? actions.find(a => a.id === "expense") :
    tab === "Supplies"   ? actions.find(a => a.id === "supply") :
    tab === "Wastage"    ? actions.find(a => a.id === "wastage") :
    actions[0];

  const fabColor = contextAction?.color || "#2563eb";

  return (
    <>
      {/* FAB button — fixed bottom-right, above bottom nav */}
      <button
        onClick={open ? closeSheet : openSheet}
        aria-label="Quick add"
        style={{
          position: "fixed",
          right: 18,
          bottom: "calc(72px + env(safe-area-inset-bottom, 0px))",
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${fabColor}, ${fabColor}cc)`,
          border: "none",
          boxShadow: `0 4px 20px ${fabColor}55, 0 2px 8px rgba(0,0,0,0.25)`,
          color: "#fff",
          fontSize: 26,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 90,
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
        onTouchStart={e => { e.currentTarget.style.transform = open ? "scale(0.93) rotate(45deg)" : "scale(0.93)"; }}
        onTouchEnd={e => { e.currentTarget.style.transform = open ? "rotate(45deg)" : "scale(1)"; }}
      >
        <span style={{ display: "inline-block", transform: open ? "rotate(45deg)" : "rotate(0deg)", transition: "transform 0.2s", lineHeight: 1 }}>+</span>
      </button>

      {/* Bottom sheet overlay */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={closeSheet}
            style={{
              position: "fixed", inset: 0, zIndex: 1200,
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(2px)",
              opacity: animIn ? 1 : 0,
              transition: "opacity 0.25s",
            }}
          />

          {/* Sheet panel */}
          <div
            style={{
              position: "fixed",
              left: 0, right: 0, bottom: 0,
              zIndex: 1201,
              background: dm ? "#111827" : "#ffffff",
              borderRadius: "24px 24px 0 0",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.3)",
              padding: "0 0 env(safe-area-inset-bottom, 16px)",
              transform: animIn ? "translateY(0)" : "translateY(100%)",
              transition: "transform 0.26s cubic-bezier(0.32, 0.72, 0, 1)",
              maxHeight: "85svh",
              overflow: "hidden",
            }}
          >
            {/* Drag handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 6px" }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: dm ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)" }} />
            </div>

            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "4px 20px 14px",
              borderBottom: `1px solid ${dm ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}`,
            }}>
              <div>
                <p style={{ color: t?.text || "#f9fafb", fontWeight: 800, fontSize: 17, lineHeight: 1.2 }}>
                  ⚡ Quick Add
                </p>
                <p style={{ color: t?.sub || "#9ca3af", fontSize: 12, marginTop: 3 }}>
                  Tap to start a new entry
                </p>
              </div>
              <button
                onClick={closeSheet}
                style={{
                  background: dm ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                  border: "none", borderRadius: "50%",
                  width: 34, height: 34,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: t?.sub || "#9ca3af", fontSize: 18, cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >×</button>
            </div>

            {/* Context-aware primary action — big button */}
            {contextAction && (
              <div style={{ padding: "16px 20px 8px" }}>
                <button
                  onClick={() => fire(contextAction)}
                  style={{
                    width: "100%",
                    background: `linear-gradient(135deg, ${contextAction.color}, ${contextAction.color}dd)`,
                    border: "none",
                    borderRadius: 18,
                    padding: "18px 20px",
                    display: "flex", alignItems: "center", gap: 14,
                    cursor: "pointer",
                    boxShadow: `0 4px 20px ${contextAction.color}40`,
                    WebkitTapHighlightColor: "transparent",
                    touchAction: "manipulation",
                  }}
                >
                  <span style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: "rgba(255,255,255,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 24, flexShrink: 0,
                  }}>{contextAction.icon}</span>
                  <div style={{ textAlign: "left" }}>
                    <p style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>{contextAction.label}</p>
                    <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 }}>
                      Tap to create now
                    </p>
                  </div>
                  <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.8)", fontSize: 22 }}>→</span>
                </button>
              </div>
            )}

            {/* Other actions grid */}
            {actions.length > 1 && (
              <div style={{ padding: "8px 20px 16px" }}>
                <p style={{ color: t?.sub || "#9ca3af", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  Other actions
                </p>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(140px, 100%), 1fr))",
                  gap: 10,
                }}>
                  {actions.filter(a => a.id !== contextAction?.id).map(action => (
                    <button
                      key={action.id}
                      onClick={() => fire(action)}
                      style={{
                        background: dm
                          ? `linear-gradient(135deg, ${action.color}14, ${action.color}08)`
                          : `linear-gradient(135deg, ${action.color}0d, ${action.color}06)`,
                        border: `1.5px solid ${action.color}30`,
                        borderRadius: 16,
                        padding: "14px 12px",
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                        cursor: "pointer",
                        WebkitTapHighlightColor: "transparent",
                        touchAction: "manipulation",
                        transition: "transform 0.1s",
                      }}
                      onTouchStart={e => { e.currentTarget.style.transform = "scale(0.95)"; }}
                      onTouchEnd={e => { e.currentTarget.style.transform = "scale(1)"; }}
                    >
                      <div style={{
                        width: 44, height: 44, borderRadius: 13,
                        background: `${action.color}18`,
                        border: `1.5px solid ${action.color}30`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 22,
                      }}>{action.icon}</div>
                      <span style={{ color: t?.text || "#f9fafb", fontWeight: 700, fontSize: 12, textAlign: "center", lineHeight: 1.3 }}>
                        {action.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

// ── QuickEntryBar — horizontal strip for desktop/tablet header ─
export function QuickEntryBar(props) {
  const { sess, can, isAdmin, tab,
    onNewDelivery, onNewCustomer, onNewExpense,
    onNewSupply, onNewWastage, onRecordPayment } = props;

  const handlers = { onNewDelivery, onNewCustomer, onNewExpense, onNewSupply, onNewWastage, onRecordPayment };
  const actions = buildActions({ can, isAdmin, sess, tab });

  if (actions.length === 0) return null;

  return (
    <div style={{
      display: "flex", gap: 6, alignItems: "center", flexWrap: "nowrap",
      overflowX: "auto", padding: "2px 0",
    }}>
      {actions.map(action => (
        <button
          key={action.id}
          onClick={() => handlers[action.handlerKey]?.()}
          title={action.label}
          style={{
            background: `${action.color}18`,
            border: `1.5px solid ${action.color}35`,
            borderRadius: 10,
            padding: "7px 12px",
            display: "flex", alignItems: "center", gap: 6,
            color: action.color,
            fontSize: 12, fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
            transition: "background 0.12s, transform 0.1s",
            WebkitTapHighlightColor: "transparent",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = `${action.color}28`; }}
          onMouseLeave={e => { e.currentTarget.style.background = `${action.color}18`; }}
        >
          <span style={{ fontSize: 14 }}>{action.icon}</span>
          {action.label}
        </button>
      ))}
    </div>
  );
}

export default QuickEntryFAB;
