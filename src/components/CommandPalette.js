/* eslint-disable */
/**
 * CommandPalette.js
 * Cmd+K / Ctrl+K palette for the admin CRM.
 * Searches every store: customers, deliveries, expenses, supplies,
 * wastage, products, staffList, machineList, vehList, ingItems.
 * Opens DetailModal with the correct { type, data } shape.
 *
 * Drop into: src/components/CommandPalette.js
 * Requires:  npm install fuse.js
 *
 * v2 fixes:
 *  - useWindowWidth() hook — palette layout reacts to orientation changes live
 *  - FAB rendered in same tree (no early return), controlled by showFAB flag
 *  - overlay onTouchStart also closes (was missing before)
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Fuse from "fuse.js";
import { T } from "../lib/theme";
import { inr, lineTotal } from "../lib/utils";

// ── reactive window width — safe for orientation changes ──────────────────────
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

// ── static nav tabs ───────────────────────────────────────────────────────────
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

// ── quick actions ─────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { id: "qa_new_delivery",  label: "New Delivery",     icon: "➕", tab: "Deliveries" },
  { id: "qa_new_customer",  label: "New Customer",     icon: "➕", tab: "Customers"  },
  { id: "qa_new_expense",   label: "New Expense",      icon: "➕", tab: "Expenses"   },
  { id: "qa_new_supply",    label: "New Supply Entry", icon: "➕", tab: "Supplies"   },
  { id: "qa_new_payment",   label: "Record Payment",   icon: "💳", tab: "Payments"   },
  { id: "qa_new_wastage",   label: "Log Wastage",      icon: "♻️",  tab: "Wastage"    },
];

// ── type metadata ─────────────────────────────────────────────────────────────
const TYPE_META = {
  nav:        { label: "Navigation",    pill: "tab",         tx: "#64748b", bg: null },
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

// ── searchable index builder ──────────────────────────────────────────────────
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

// ── main component ────────────────────────────────────────────────────────────
export function CommandPalette({
  customers=[], deliveries=[], expenses=[], supplies=[],
  wastage=[], products=[], staffList=[], machineList=[],
  vehList=[], ingItems=[], dm,
  onNavigate, onOpenDetail, onQuickAction,
}) {
  const t = T(dm);
  const windowWidth = useWindowWidth();          // ← live, reacts to rotation
  const isMobile = windowWidth < 640;
  const showFAB  = windowWidth < 1024;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const listRef  = useRef(null);
  const itemRefs = useRef([]);

  // Keyboard shortcut
  useEffect(() => {
    const handler = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen(o => !o); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 50); setQuery(""); setCursor(0); }
  }, [open]);

  const index = useMemo(() => buildIndex({ customers, deliveries, expenses, supplies, wastage, products, staffList, machineList, vehList, ingItems }),
    [customers, deliveries, expenses, supplies, wastage, products, staffList, machineList, vehList, ingItems]);

  const fuse = useMemo(() => new Fuse(index, { keys:["keywords","label","sub"], threshold:0.35, includeScore:true, minMatchCharLength:1 }), [index]);

  const results = useMemo(() => {
    if (!query.trim()) return [
      ...QUICK_ACTIONS.map(a => ({ _type:"action", _id:a.id, icon:a.icon, label:a.label, sub:"Quick action", tab:a.tab })),
      ...NAV_TABS.map(tab => ({ _type:"nav", _id:tab.id, icon:tab.icon, label:tab.id, sub:"Go to tab" })),
    ];
    return fuse.search(query).map(r => r.item).slice(0, 15);
  }, [query, fuse]);

  useEffect(() => setCursor(0), [results]);
  useEffect(() => { itemRefs.current[cursor]?.scrollIntoView({ block:"nearest" }); }, [cursor]);

  const handleKeyDown = useCallback(e => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor(c => Math.min(c+1, results.length-1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor(c => Math.max(c-1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (results[cursor]) activate(results[cursor]); }
  }, [results, cursor]);

  const activate = useCallback(item => {
    setOpen(false); setQuery("");
    if (item._type === "nav")    { onNavigate?.(item._id); return; }
    if (item._type === "action") { onQuickAction?.(item._id, item.tab); return; }
    const modalType = MODAL_TYPE_MAP[item._type];
    if (modalType && item.raw) onOpenDetail?.({ type:modalType, data:item.raw });
    else onNavigate?.(TAB_FALLBACK_MAP[item._type] || "Dashboard");
  }, [onNavigate, onOpenDetail, onQuickAction]);

  const kbdStyle = { fontSize:10, color:dm?"#4a6080":"#94a3b8", background:dm?"#1e2736":"#f1f5f9", border:`1px solid ${dm?"#2a3347":"#e2e8f0"}`, borderRadius:5, padding:"2px 6px", fontFamily:"inherit", fontWeight:700 };
  const pillStyle = type => { const m=TYPE_META[type]||TYPE_META.nav; return { fontSize:9, fontWeight:800, letterSpacing:"0.05em", textTransform:"uppercase", background:m.bg?(dm?m.bg:m.bg+"44"):(dm?"#1e2736":"#f1f5f9"), color:m.tx, borderRadius:5, padding:"2px 6px", flexShrink:0 }; };

  let lastType = null;

  return (
    <>
      <style>{`
        @keyframes cp_in  { from{opacity:0;transform:translateY(-10px) scale(0.98)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes cp_up  { from{transform:translateY(100%)} to{transform:translateY(0)} }
        .cp-list::-webkit-scrollbar{width:4px}
        .cp-list::-webkit-scrollbar-track{background:transparent}
        .cp-list::-webkit-scrollbar-thumb{background:${dm?"#252d3a":"#e2e8f0"};border-radius:4px}
      `}</style>

      {/* FAB — shown on phone/tablet, hidden on desktop, reacts to rotation */}
      {showFAB && !open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open search"
          style={{ position:"fixed", bottom:"calc(72px + env(safe-area-inset-bottom, 0px))", right:16, zIndex:9990, width:46, height:46, borderRadius:"50%", background:dm?"#1e2d45":"#ffffff", border:`1.5px solid ${dm?"#2a3d5a":"#e2e8f0"}`, boxShadow:dm?"0 4px 20px rgba(0,0,0,0.5)":"0 4px 20px rgba(0,0,0,0.12)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", WebkitTapHighlightColor:"transparent", touchAction:"manipulation" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={dm?"#94a3b8":"#64748b"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>
      )}

      {/* Palette */}
      {open && (
        <div
          style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,0.6)", backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)", display:"flex", alignItems:isMobile?"flex-end":"flex-start", justifyContent:"center", paddingTop:isMobile?0:"12vh", paddingLeft:isMobile?0:12, paddingRight:isMobile?0:12 }}
          onMouseDown={() => setOpen(false)}
          onTouchStart={() => setOpen(false)}
        >
          <div
            style={{ width:"100%", maxWidth:isMobile?"100%":620, background:dm?"#13181f":"#ffffff", borderRadius:isMobile?"20px 20px 0 0":20, border:`1.5px solid ${dm?"#252d3a":"#e2e8f0"}`, borderBottom:isMobile?"none":`1.5px solid ${dm?"#252d3a":"#e2e8f0"}`, boxShadow:dm?"0 -20px 60px rgba(0,0,0,0.6)":"0 -10px 40px rgba(0,0,0,0.1)", overflow:"hidden", animation:isMobile?"cp_up 0.22s cubic-bezier(0.16,1,0.3,1)":"cp_in 0.14s cubic-bezier(0.16,1,0.3,1)", paddingBottom:isMobile?"env(safe-area-inset-bottom, 0px)":0 }}
            onMouseDown={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
          >
            {/* Drag handle on mobile */}
            {isMobile && (
              <div style={{ display:"flex", justifyContent:"center", padding:"10px 0 4px" }}>
                <div style={{ width:36, height:4, borderRadius:99, background:dm?"#2a3347":"#e2e8f0" }} />
              </div>
            )}

            {/* Search input */}
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 18px", borderBottom:`1px solid ${dm?"#1e2736":"#f0f4f8"}` }}>
              <span style={{ fontSize:15, color:dm?"#3d5266":"#94a3b8", flexShrink:0 }}>🔍</span>
              <input
                ref={inputRef}
                style={{ flex:1, background:"transparent", border:"none", outline:"none", fontSize:15, fontWeight:500, color:dm?"#e8edf5":"#0f172a", fontFamily:"inherit" }}
                placeholder="Search customers, deliveries, expenses…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                autoComplete="off"
              />
              <kbd style={kbdStyle}>ESC</kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="cp-list" style={{ maxHeight:isMobile?"55vh":400, overflowY:"auto", padding:"4px 0 8px", WebkitOverflowScrolling:"touch" }}>
              {results.length === 0
                ? <div style={{ textAlign:"center", padding:"36px 0", color:dm?"#2e3f52":"#94a3b8", fontSize:13 }}>
                    <div style={{ fontSize:32, marginBottom:8 }}>🔍</div>
                    No results for <strong>"{query}"</strong>
                  </div>
                : results.map((item, i) => {
                    const showGroup = item._type !== lastType;
                    lastType = item._type;
                    const active = i === cursor;
                    const meta = TYPE_META[item._type] || TYPE_META.nav;
                    return (
                      <React.Fragment key={item._id + i}>
                        {showGroup && (
                          <div style={{ fontSize:9, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", color:dm?"#2e3f52":"#cbd5e1", padding:"10px 18px 3px" }}>
                            {meta.label}
                          </div>
                        )}
                        <div
                          ref={el => (itemRefs.current[i] = el)}
                          style={{ display:"flex", alignItems:"center", gap:12, padding:"9px 18px", cursor:"pointer", background:active?(dm?"#1a2535":"#f0f7ff"):"transparent", borderLeft:`2px solid ${active?"#3b6ef6":"transparent"}` }}
                          onMouseEnter={() => setCursor(i)}
                          onMouseDown={() => activate(item)}
                          onTouchEnd={e => { e.preventDefault(); activate(item); }}
                        >
                          <span style={{ fontSize:17, width:26, textAlign:"center", flexShrink:0 }}>{item.icon}</span>
                          <span style={{ fontSize:13, fontWeight:600, flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:active?(dm?"#93c5fd":"#1d4ed8"):(dm?"#e8edf5":"#0f172a") }}>{item.label}</span>
                          {item.sub && <span style={{ fontSize:11, color:dm?"#3d5266":"#94a3b8", flexShrink:0, maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.sub}</span>}
                          <span style={pillStyle(item._type)}>{meta.pill}</span>
                        </div>
                      </React.Fragment>
                    );
                  })
              }
            </div>

            {/* Footer */}
            <div style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 18px", borderTop:`1px solid ${dm?"#1e2736":"#f0f4f8"}` }}>
              {[["↑↓","navigate"],["↵","open"],["Esc","close"]].map(([k,l]) => (
                <span key={k} style={{ fontSize:10, color:dm?"#2e3f52":"#cbd5e1", display:"flex", alignItems:"center", gap:5 }}>
                  <kbd style={kbdStyle}>{k}</kbd> {l}
                </span>
              ))}
              {query && results.length > 0 && (
                <span style={{ marginLeft:"auto", fontSize:10, color:dm?"#2e3f52":"#cbd5e1" }}>
                  {results.length} result{results.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default CommandPalette;
