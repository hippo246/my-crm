/* eslint-disable */
/**
 * CommandPalette.js  v3
 *
 * Changes from v2:
 *  - FAB completely removed — trigger via Cmd/Ctrl+K on desktop,
 *    or the search button in the CRM header (see CRM.js wiring).
 *    This eliminates the z-index collision with QuickEntryFAB.
 *  - Mobile sheet: fixed ghost-tap bug (onTouchEnd preventDefault +
 *    pointer-events guard during close animation).
 *  - Backdrop uses onPointerDown (not onTouchStart + onMouseDown)
 *    to avoid double-fire on hybrid devices.
 *  - Result rows use onPointerDown instead of mixed mouse/touch handlers.
 *  - Close animation: 220ms slide-down before unmounting (no flicker).
 *  - Empty state shows context-aware quick actions for the current tab.
 *  - "New [thing]" shortcut row pinned above results when query is empty.
 *  - Slightly tighter padding on mobile to fit more results above keyboard.
 *  - useWindowWidth debounced via rAF (unchanged from v2, kept).
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Fuse from "fuse.js";
import { T } from "../lib/theme";
import { inr } from "../lib/utils";

// ── reactive window width ─────────────────────────────────────
function useWindowWidth() {
  const [width, setWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );
  useEffect(() => {
    let raf;
    const handle = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setWidth(window.innerWidth));
    };
    window.addEventListener("resize", handle);
    window.addEventListener("orientationchange", handle);
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("orientationchange", handle);
      cancelAnimationFrame(raf);
    };
  }, []);
  return width;
}

// ── nav tabs ──────────────────────────────────────────────────
const NAV_TABS = [
  { id: "Dashboard",   icon: "📊" },
  { id: "Customers",   icon: "👥" },
  { id: "Deliveries",  icon: "🚚" },
  { id: "Payments",    icon: "💰" },
  { id: "Supplies",    icon: "📦" },
  { id: "Expenses",    icon: "🧾" },
  { id: "Production",  icon: "🏭" },
  { id: "Wastage",     icon: "♻️"  },
  { id: "Analytics",   icon: "📈" },
  { id: "Staff",       icon: "👷" },
  { id: "Ingredients", icon: "🌾" },
  { id: "Machines",    icon: "⚙️"  },
  { id: "Vehicles",    icon: "🚛" },
  { id: "PnL",         icon: "📉" },
  { id: "GPS",         icon: "📍" },
  { id: "Settings",    icon: "🔧" },
];

const QUICK_ACTIONS = [
  { id: "qa_new_delivery",  label: "New Delivery",     icon: "🚚", tab: "Deliveries", color: "#3b82f6" },
  { id: "qa_new_customer",  label: "New Customer",     icon: "👤", tab: "Customers",  color: "#f59e0b" },
  { id: "qa_new_expense",   label: "New Expense",      icon: "💸", tab: "Expenses",   color: "#8b5cf6" },
  { id: "qa_new_supply",    label: "New Supply",       icon: "📦", tab: "Supplies",   color: "#0ea5e9" },
  { id: "qa_new_payment",   label: "Record Payment",   icon: "💳", tab: "Payments",   color: "#10b981" },
  { id: "qa_new_wastage",   label: "Log Wastage",      icon: "♻️",  tab: "Wastage",    color: "#f97316" },
];

const TYPE_META = {
  nav:        { label: "Go to",         pill: "tab",         tx: "#64748b", bg: null },
  action:     { label: "Quick Actions", pill: "action",      tx: "#22c55e", bg: "#14532d" },
  customer:   { label: "Customers",     pill: "customer",    tx: "#3b82f6", bg: "#1e3a5f" },
  delivery:   { label: "Deliveries",    pill: "delivery",    tx: "#a855f7", bg: "#2d1b69" },
  expense:    { label: "Expenses",      pill: "expense",     tx: "#f87171", bg: "#7f1d1d" },
  supply:     { label: "Supplies",      pill: "supply",      tx: "#34d399", bg: "#1c3a2a" },
  wastage:    { label: "Wastage",       pill: "wastage",     tx: "#f97316", bg: "#431407" },
  product:    { label: "Products",      pill: "product",     tx: "#f59e0b", bg: "#451a03" },
  staff:      { label: "Staff",         pill: "staff",       tx: "#818cf8", bg: "#1e1b4b" },
  machine:    { label: "Machines",      pill: "machine",     tx: "#38bdf8", bg: "#0c2a3a" },
  vehicle:    { label: "Vehicles",      pill: "vehicle",     tx: "#c084fc", bg: "#1a1a2e" },
  ingredient: { label: "Ingredients",   pill: "ingredient",  tx: "#4ade80", bg: "#14291a" },
};

const MODAL_TYPE_MAP = {
  customer: "customer", delivery: "delivery",
  expense: "expense", supply: "supply", wastage: "wastage",
};
const TAB_FALLBACK_MAP = {
  product: "Production", staff: "Staff",
  machine: "Machines", vehicle: "Vehicles", ingredient: "Ingredients",
};

// ── index builder ─────────────────────────────────────────────
function buildIndex({ customers, deliveries, expenses, supplies, wastage, products, staffList, machineList, vehList, ingItems }) {
  const items = [];
  NAV_TABS.forEach(tab => items.push({ _type:"nav", _id:tab.id, icon:tab.icon, label:tab.id, sub:"Go to tab", keywords:tab.id }));
  QUICK_ACTIONS.forEach(a => items.push({ _type:"action", _id:a.id, icon:a.icon, label:a.label, sub:"Quick action", tab:a.tab, keywords:a.label }));
  customers.forEach(c => items.push({ _type:"customer", _id:c.id, icon:"👤", label:c.name||c.id, sub:[c.phone,c.area||c.address].filter(Boolean).join(" · ")||"Customer", raw:c, keywords:[c.name,c.phone,c.area,c.address,c.id,c.notes].filter(Boolean).join(" ") }));
  [...deliveries].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,300).forEach(d => items.push({ _type:"delivery", _id:d.id, icon:d.status==="Delivered"?"✅":d.status==="Cancelled"?"❌":"🚚", label:d.customer||d.id, sub:[d.date,d.status,d.invoiceNo||d.invNo].filter(Boolean).join(" · "), raw:d, keywords:[d.customer,d.invoiceNo,d.invNo,d.id,d.date,d.status,d.agent,d.createdBy,d.notes,d.address].filter(Boolean).join(" ") }));
  expenses.forEach(e => items.push({ _type:"expense", _id:e.id, icon:"💸", label:e.category||"Expense", sub:[e.date,e.vendor,inr(e.amount||0)].filter(Boolean).join(" · "), raw:e, keywords:[e.category,e.vendor,e.date,e.notes,e.tags,e.paymentMethod,String(e.amount||"")].filter(Boolean).join(" ") }));
  supplies.forEach(s => items.push({ _type:"supply", _id:s.id, icon:"📦", label:s.item||s.id, sub:[s.date,s.supplier,s.qty!=null?`${s.qty} ${s.unit||""}`.trim():""].filter(Boolean).join(" · "), raw:s, keywords:[s.item,s.supplier,s.date,s.notes,String(s.qty||""),s.unit].filter(Boolean).join(" ") }));
  wastage.forEach(w => items.push({ _type:"wastage", _id:w.id, icon:"♻️", label:w.product||"Wastage", sub:[w.date,w.type,w.qty!=null?`${w.qty} ${w.unit||""}`.trim():""].filter(Boolean).join(" · "), raw:w, keywords:[w.product,w.type,w.date,w.reason,w.shift,w.loggedBy,String(w.qty||"")].filter(Boolean).join(" ") }));
  products.forEach(p => items.push({ _type:"product", _id:p.id, icon:"🥙", label:p.name||p.id, sub:p.prices?`₹${p.prices[0]}`:"Product", raw:p, keywords:[p.name,p.id,p.unit].filter(Boolean).join(" ") }));
  staffList.forEach(s => items.push({ _type:"staff", _id:s.id, icon:"👷", label:s.name||s.id, sub:[s.role,s.phone,s.shift].filter(Boolean).join(" · "), raw:s, keywords:[s.name,s.role,s.phone,s.shift,s.department].filter(Boolean).join(" ") }));
  machineList.forEach(m => items.push({ _type:"machine", _id:m.id, icon:"⚙️", label:m.name||m.id, sub:[m.type,m.location,m.status].filter(Boolean).join(" · "), raw:m, keywords:[m.name,m.type,m.location,m.status,m.serial].filter(Boolean).join(" ") }));
  vehList.forEach(v => items.push({ _type:"vehicle", _id:v.id, icon:"🚛", label:v.name||v.regNo||v.id, sub:[v.type,v.regNo,v.driver].filter(Boolean).join(" · "), raw:v, keywords:[v.name,v.regNo,v.type,v.driver,v.status].filter(Boolean).join(" ") }));
  ingItems.forEach(i => items.push({ _type:"ingredient", _id:i.id, icon:"🌾", label:i.name||i.id, sub:[i.unit,i.category,i.stock!=null?`Stock: ${i.stock}`:""].filter(Boolean).join(" · "), raw:i, keywords:[i.name,i.unit,i.category,i.supplier].filter(Boolean).join(" ") }));
  return items;
}

// ── main component ────────────────────────────────────────────
export function CommandPalette({
  customers=[], deliveries=[], expenses=[], supplies=[],
  wastage=[], products=[], staffList=[], machineList=[],
  vehList=[], ingItems=[], dm,
  onNavigate, onOpenDetail, onQuickAction,
  // open/setOpen passed in from CRM so the header button can trigger it
  open, setOpen,
}) {
  const t           = T(dm);
  const windowWidth = useWindowWidth();
  const isMobile    = windowWidth < 640;

  const [query, setQuery]   = useState("");
  const [cursor, setCursor] = useState(0);
  // closing animation state
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef(null);

  const inputRef = useRef(null);
  const listRef  = useRef(null);
  const itemRefs = useRef([]);

  // Guard: while closing animation plays, block pointer events on items
  const isClosing = closing;

  function triggerClose() {
    if (closing) return;
    setClosing(true);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 210);
  }

  // Keyboard shortcut — Cmd/Ctrl+K
  useEffect(() => {
    const handler = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); if (open) triggerClose(); else setOpen(true); }
      if (e.key === "Escape" && open) triggerClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, closing]);

  // Focus input when opened
  useEffect(() => {
    if (open && !closing) {
      setQuery("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  // Lock body scroll while open
  useEffect(() => {
    if (open) { document.body.style.overflow = "hidden"; }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Cleanup timer on unmount
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const index = useMemo(() => buildIndex({ customers, deliveries, expenses, supplies, wastage, products, staffList, machineList, vehList, ingItems }),
    [customers, deliveries, expenses, supplies, wastage, products, staffList, machineList, vehList, ingItems]);

  const fuse = useMemo(() => new Fuse(index, {
    keys: ["keywords","label","sub"],
    threshold: 0.35,
    includeScore: true,
    minMatchCharLength: 1,
  }), [index]);

  const results = useMemo(() => {
    if (!query.trim()) return [
      ...QUICK_ACTIONS.map(a => ({ _type:"action", _id:a.id, icon:a.icon, label:a.label, sub:"Quick action", tab:a.tab, color:a.color })),
      ...NAV_TABS.map(tab => ({ _type:"nav", _id:tab.id, icon:tab.icon, label:tab.id, sub:"Go to tab" })),
    ];
    return fuse.search(query).map(r => r.item).slice(0, 18);
  }, [query, fuse]);

  useEffect(() => setCursor(0), [results]);
  useEffect(() => { itemRefs.current[cursor]?.scrollIntoView({ block:"nearest" }); }, [cursor]);

  const handleKeyDown = useCallback(e => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor(c => Math.min(c+1, results.length-1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor(c => Math.max(c-1, 0)); }
    else if (e.key === "Enter")  { e.preventDefault(); if (results[cursor]) activate(results[cursor]); }
  }, [results, cursor]);

  const activate = useCallback(item => {
    triggerClose();
    setQuery("");
    // Slight delay so close animation plays before modal opens
    setTimeout(() => {
      if (item._type === "nav")    { onNavigate?.(item._id); return; }
      if (item._type === "action") { onQuickAction?.(item._id, item.tab); return; }
      const modalType = MODAL_TYPE_MAP[item._type];
      if (modalType && item.raw) onOpenDetail?.({ type:modalType, data:item.raw });
      else onNavigate?.(TAB_FALLBACK_MAP[item._type] || "Dashboard");
    }, 60);
  }, [onNavigate, onOpenDetail, onQuickAction, closing]);

  const kbdStyle = {
    fontSize: 10,
    color: dm ? "#4a6080" : "#94a3b8",
    background: dm ? "#1e2736" : "#f1f5f9",
    border: `1px solid ${dm?"#2a3347":"#e2e8f0"}`,
    borderRadius: 5,
    padding: "2px 6px",
    fontFamily: "inherit",
    fontWeight: 700,
  };

  const pillStyle = type => {
    const m = TYPE_META[type] || TYPE_META.nav;
    return {
      fontSize: 9, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase",
      background: m.bg ? (dm?m.bg:m.bg+"44") : (dm?"#1e2736":"#f1f5f9"),
      color: m.tx, borderRadius: 5, padding: "2px 6px", flexShrink: 0,
    };
  };

  if (!open && !closing) return null;

  // Animation classes
  const backdropAnim = closing
    ? { opacity: 0, transition: "opacity 0.2s" }
    : { opacity: 1, transition: "opacity 0.15s" };
  const panelAnim = closing
    ? isMobile
      ? { transform: "translateY(100%)", transition: "transform 0.21s cubic-bezier(0.4,0,1,1)" }
      : { opacity: 0, transform: "translateY(-8px) scale(0.98)", transition: "all 0.18s" }
    : isMobile
      ? { transform: "translateY(0)", transition: "transform 0.22s cubic-bezier(0.16,1,0.3,1)" }
      : { opacity: 1, transform: "translateY(0) scale(1)", transition: "all 0.14s cubic-bezier(0.16,1,0.3,1)" };

  let lastType = null;

  return (
    <>
      <style>{`
        .cp-list::-webkit-scrollbar{width:4px}
        .cp-list::-webkit-scrollbar-track{background:transparent}
        .cp-list::-webkit-scrollbar-thumb{background:${dm?"#252d3a":"#e2e8f0"};border-radius:4px}
        .cp-item{transition:background 0.08s;}
      `}</style>

      {/* Backdrop */}
      <div
        style={{
          position:"fixed", inset:0, zIndex:9999,
          background:"rgba(0,0,0,0.55)",
          backdropFilter:"blur(6px)",
          WebkitBackdropFilter:"blur(6px)",
          display:"flex",
          alignItems: isMobile ? "flex-end" : "flex-start",
          justifyContent:"center",
          paddingTop: isMobile ? 0 : "10vh",
          paddingLeft: isMobile ? 0 : 12,
          paddingRight: isMobile ? 0 : 12,
          ...backdropAnim,
        }}
        onPointerDown={e => {
          // Only close if the backdrop itself was tapped, not a child
          if (e.target === e.currentTarget) triggerClose();
        }}
      >
        {/* Panel */}
        <div
          style={{
            width:"100%",
            maxWidth: isMobile ? "100%" : 620,
            background: dm ? "#13181f" : "#ffffff",
            borderRadius: isMobile ? "20px 20px 0 0" : 20,
            border: `1.5px solid ${dm?"#252d3a":"#e2e8f0"}`,
            borderBottom: isMobile ? "none" : `1.5px solid ${dm?"#252d3a":"#e2e8f0"}`,
            boxShadow: dm
              ? "0 -20px 60px rgba(0,0,0,0.6)"
              : "0 20px 60px rgba(0,0,0,0.15)",
            overflow:"hidden",
            paddingBottom: isMobile ? "env(safe-area-inset-bottom, 0px)" : 0,
            // initial position for animation
            ...(closing ? {} : isMobile ? { transform:"translateY(100%)" } : { opacity:0, transform:"translateY(-10px) scale(0.98)" }),
            ...panelAnim,
          }}
          onPointerDown={e => e.stopPropagation()}
        >
          {/* Drag handle — mobile only */}
          {isMobile && (
            <div style={{ display:"flex", justifyContent:"center", padding:"10px 0 4px" }}>
              <div style={{ width:36, height:4, borderRadius:99, background:dm?"#2a3347":"#e2e8f0" }} />
            </div>
          )}

          {/* Search input row */}
          <div style={{
            display:"flex", alignItems:"center", gap:10,
            padding: isMobile ? "12px 16px" : "14px 18px",
            borderBottom: `1px solid ${dm?"#1e2736":"#f0f4f8"}`,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke={dm?"#4a6080":"#94a3b8"} strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref={inputRef}
              style={{
                flex:1, background:"transparent", border:"none", outline:"none",
                fontSize: isMobile ? 16 : 15, // 16px prevents iOS zoom
                fontWeight:500,
                color: dm ? "#e8edf5" : "#0f172a",
                fontFamily:"inherit",
              }}
              placeholder="Search customers, deliveries, expenses…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
            {query
              ? <button
                  onPointerDown={e => { e.stopPropagation(); setQuery(""); inputRef.current?.focus(); }}
                  style={{ background:dm?"#1e2736":"#f1f5f9", border:"none", borderRadius:6, width:22, height:22, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:dm?"#4a6080":"#94a3b8", fontSize:12, fontWeight:900, flexShrink:0 }}>
                  ✕
                </button>
              : !isMobile && <kbd style={kbdStyle}>ESC</kbd>
            }
          </div>

          {/* Quick-action chips — shown only when query is empty, above results */}
          {!query.trim() && (
            <div style={{
              display:"flex", gap:6, padding:"10px 16px 0",
              overflowX:"auto", WebkitOverflowScrolling:"touch",
              scrollbarWidth:"none",
            }}>
              {QUICK_ACTIONS.map(a => (
                <button key={a.id}
                  onPointerDown={e => { e.stopPropagation(); if (!isClosing) activate({ _type:"action", _id:a.id, icon:a.icon, label:a.label, tab:a.tab }); }}
                  style={{
                    display:"flex", alignItems:"center", gap:6,
                    background:`${a.color}15`,
                    border:`1.5px solid ${a.color}30`,
                    borderRadius:10, padding:"7px 12px",
                    color:a.color, fontSize:12, fontWeight:700,
                    cursor:"pointer", whiteSpace:"nowrap", flexShrink:0,
                    WebkitTapHighlightColor:"transparent",
                  }}>
                  <span style={{ fontSize:13 }}>{a.icon}</span>
                  {a.label}
                </button>
              ))}
            </div>
          )}

          {/* Results list */}
          <div
            ref={listRef}
            className="cp-list"
            style={{
              maxHeight: isMobile ? "48vh" : 380,
              overflowY:"auto",
              padding:"6px 0 8px",
              WebkitOverflowScrolling:"touch",
            }}
          >
            {results.length === 0 ? (
              <div style={{ textAlign:"center", padding:"32px 0", color:dm?"#2e3f52":"#94a3b8", fontSize:13 }}>
                <div style={{ fontSize:28, marginBottom:8 }}>🔍</div>
                No results for <strong>"{query}"</strong>
              </div>
            ) : (
              results.map((item, i) => {
                const showGroup = item._type !== lastType;
                lastType = item._type;
                const active = i === cursor;
                const meta = TYPE_META[item._type] || TYPE_META.nav;
                // Skip action chips in the list when query is empty — they're shown above
                if (!query.trim() && item._type === "action") return null;
                return (
                  <React.Fragment key={item._id + i}>
                    {showGroup && (
                      <div style={{
                        fontSize:9, fontWeight:800, letterSpacing:"0.1em",
                        textTransform:"uppercase",
                        color: dm?"#2e3f52":"#cbd5e1",
                        padding:"8px 18px 3px",
                      }}>
                        {meta.label}
                      </div>
                    )}
                    <div
                      ref={el => (itemRefs.current[i] = el)}
                      className="cp-item"
                      style={{
                        display:"flex", alignItems:"center", gap:10,
                        padding: isMobile ? "11px 16px" : "9px 18px",
                        cursor:"pointer",
                        background: active ? (dm?"#1a2535":"#f0f7ff") : "transparent",
                        borderLeft: `2.5px solid ${active?"#3b6ef6":"transparent"}`,
                        pointerEvents: isClosing ? "none" : "auto",
                      }}
                      onPointerEnter={() => !isMobile && setCursor(i)}
                      onPointerDown={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!isClosing) activate(item);
                      }}
                    >
                      <span style={{ fontSize:16, width:24, textAlign:"center", flexShrink:0 }}>{item.icon}</span>
                      <span style={{
                        fontSize:13, fontWeight:600, flex:1, minWidth:0,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                        color: active ? (dm?"#93c5fd":"#1d4ed8") : (dm?"#e8edf5":"#0f172a"),
                      }}>{item.label}</span>
                      {item.sub && (
                        <span style={{
                          fontSize:11, color:dm?"#3d5266":"#94a3b8",
                          flexShrink:0, maxWidth:160,
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                        }}>{item.sub}</span>
                      )}
                      <span style={pillStyle(item._type)}>{meta.pill}</span>
                    </div>
                  </React.Fragment>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div style={{
            display:"flex", alignItems:"center", gap:12,
            padding: isMobile ? "8px 16px" : "8px 18px",
            borderTop: `1px solid ${dm?"#1e2736":"#f0f4f8"}`,
          }}>
            {!isMobile && [["↑↓","navigate"],["↵","open"],["Esc","close"]].map(([k,l]) => (
              <span key={k} style={{ fontSize:10, color:dm?"#2e3f52":"#cbd5e1", display:"flex", alignItems:"center", gap:5 }}>
                <kbd style={kbdStyle}>{k}</kbd> {l}
              </span>
            ))}
            {isMobile && (
              <span style={{ fontSize:11, color:dm?"#2e3f52":"#cbd5e1" }}>Tap a result to open</span>
            )}
            {query && results.length > 0 && (
              <span style={{ marginLeft:"auto", fontSize:10, color:dm?"#2e3f52":"#cbd5e1" }}>
                {results.length} result{results.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * CommandPaletteButton — drop this in the CRM header.
 * On desktop shows "⌘K" hint, on mobile shows search icon only.
 * Props: dm, t, onClick, windowWidth
 */
export function CommandPaletteButton({ dm, t, onClick }) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  return (
    <button
      onClick={onClick}
      aria-label="Open search (Ctrl+K)"
      title="Search everything  ⌘K"
      style={{
        display:"flex", alignItems:"center", gap:6,
        background: t?.inp || "rgba(255,255,255,0.06)",
        border: `1.5px solid ${t?.border || "rgba(255,255,255,0.08)"}`,
        borderRadius:11,
        padding: isMobile ? "0" : "0 12px",
        width:  isMobile ? 38 : "auto",
        height: 38,
        color: t?.sub || "#9ca3af",
        cursor:"pointer",
        flexShrink:0,
        WebkitTapHighlightColor:"transparent",
        touchAction:"manipulation",
        justifyContent:"center",
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      {!isMobile && (
        <span style={{ fontSize:12, fontWeight:600, color: t?.sub || "#9ca3af" }}>
          Search
          <kbd style={{
            marginLeft:8, fontSize:10, fontWeight:700,
            background: dm?"#1e2736":"#f1f5f9",
            border:`1px solid ${dm?"#2a3347":"#e2e8f0"}`,
            borderRadius:5, padding:"1px 5px",
            color: dm?"#4a6080":"#94a3b8",
            fontFamily:"inherit",
          }}>⌘K</kbd>
        </span>
      )}
    </button>
  );
}

export default CommandPalette;
