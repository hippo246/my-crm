import { useState, useEffect, useRef, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

// ── SECURITY ──────────────────────────────────────────────────
function hashPw(pw) {
  let h = 0;
  for (let i = 0; i < pw.length; i++) h = (Math.imul(31, h) + pw.charCodeAt(i)) | 0;
  return "h_" + Math.abs(h).toString(16) + "_" + pw.length;
}
function checkPw(input, stored) {
  return stored.startsWith("h_") ? hashPw(input) === stored : input === stored;
}
const SESSION_TTL = 8 * 60 * 60 * 1000;

// ── STORAGE + BROADCAST ────────────────────────────────────────
const BC = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("tas7") : null;
function ls(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }
function lsw(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); BC?.postMessage({ k, v }); } catch {} }

function useStore(key, def) {
  const [val, set] = useState(() => ls(key, def));
  const setAndPersist = (next) => {
    const resolved = typeof next === "function" ? next(ls(key, def)) : next;
    set(resolved);
    lsw(key, resolved);
  };
  useEffect(() => {
    if (!BC) return;
    const h = (e) => { if (e.data?.k === key) set(e.data.v); };
    BC.addEventListener("message", h);
    return () => BC.removeEventListener("message", h);
  }, [key]);
  useEffect(() => {
    const t = setInterval(() => {
      const fresh = ls(key, def);
      set(p => JSON.stringify(p) === JSON.stringify(fresh) ? p : fresh);
    }, 3500);
    return () => clearInterval(t);
  }, [key]);
  return [val, setAndPersist];
}

// ── HELPERS ───────────────────────────────────────────────────
const uid  = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const isoD = () => new Date().toISOString().slice(0, 10);
const tStamp = () => new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const inr  = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
function safeObj(x) { return x && typeof x === "object" && !Array.isArray(x) ? x : {}; }
function mapsUrl(a, lat, lng) { return lat && lng ? `https://maps.google.com/?q=${lat},${lng}` : `https://maps.google.com/?q=${encodeURIComponent(a || "")}`; }

// ── ORDER LINES HELPERS ────────────────────────────────────────
function lineTotal(lines) {
  return Object.values(safeObj(lines)).reduce((s, l) => s + (l.qty || 0) * (l.priceAmount || 0), 0);
}
function lineBreakdown(lines, products) {
  return products
    .map(p => ({ ...p, ...(safeObj(lines)[p.id] || { qty: 0, priceAmount: 0, priceLabel: "" }) }))
    .filter(l => l.qty > 0);
}

// ── DEFAULT DATA ──────────────────────────────────────────────
const DEF_PRODS = [
  { id: "roti",      name: "Roti",                 unit: "pcs",  prices: [5, 6, 7, 8] },
  { id: "paratha5",  name: "Paratha Pack (5 pcs)",  unit: "pack", prices: [70, 75, 80] },
  { id: "paratha10", name: "Paratha Pack (10 pcs)", unit: "pack", prices: [130, 140, 150] },
];

const DEF_CUSTOMERS = [
  { id: "c1", name: "Hotel Saffron", phone: "9876543210", address: "MG Road, Panaji, Goa",
    lat: 15.4989, lng: 73.8278,
    orderLines: { roti: { qty: 20, priceAmount: 6, priceLabel: "₹6" }, paratha5: { qty: 4, priceAmount: 75, priceLabel: "₹75" }, paratha10: { qty: 0, priceAmount: 140, priceLabel: "₹140" } },
    paid: 1200, pending: 300, notes: "Prefers crispy", active: true, joinDate: "2026-01-01" },
  { id: "c2", name: "Sharma Tiffin", phone: "9123456789", address: "Panaji Market, Goa",
    lat: 15.5004, lng: 73.8212,
    orderLines: { roti: { qty: 0, priceAmount: 5, priceLabel: "₹5" }, paratha5: { qty: 0, priceAmount: 70, priceLabel: "₹70" }, paratha10: { qty: 3, priceAmount: 130, priceLabel: "₹130" } },
    paid: 0, pending: 390, notes: "", active: true, joinDate: "2026-02-15" },
];

const DEF_DELIVERIES = [
  { id: "d1", customerId: "c1", customer: "Hotel Saffron",
    orderLines: { roti: { qty: 20, priceAmount: 6, priceLabel: "₹6" }, paratha5: { qty: 4, priceAmount: 75, priceLabel: "₹75" }, paratha10: { qty: 0, priceAmount: 140, priceLabel: "₹140" } },
    date: "2026-04-12", status: "Pending", notes: "", address: "MG Road, Panaji, Goa", lat: 15.4989, lng: 73.8278, createdBy: "Admin" },
  { id: "d2", customerId: "c2", customer: "Sharma Tiffin",
    orderLines: { roti: { qty: 0, priceAmount: 5, priceLabel: "₹5" }, paratha5: { qty: 0, priceAmount: 70, priceLabel: "₹70" }, paratha10: { qty: 3, priceAmount: 130, priceLabel: "₹130" } },
    date: "2026-04-12", status: "Delivered", notes: "", address: "Panaji Market, Goa", lat: 15.5004, lng: 73.8212, createdBy: "Admin" },
];

const DEF_SUPPLIES = [
  { id: "s1", item: "Wheat Flour",   qty: 50, unit: "kg", date: "2026-04-10", supplier: "Ram Store", cost: 2000, notes: "" },
  { id: "s2", item: "Oil (Refined)", qty: 20, unit: "L",  date: "2026-04-11", supplier: "Agro Mart", cost: 1600, notes: "" },
];

const DEF_EXPENSES = [
  { id: "e1", category: "Gas", amount: 800, date: "2026-04-10", notes: "Monthly LPG" },
];

const DEF_USERS = [
  { id: "u1", username: "admin",  password: hashPw("TAS@admin2026"), role: "admin", name: "Admin",          active: true, createdAt: "2026-01-01" },
  { id: "u2", username: "agent1", password: hashPw("deliver123"),    role: "agent", name: "Delivery Agent", active: true, createdAt: "2026-01-01" },
];

// ── INVOICE ───────────────────────────────────────────────────
function printInvoice(record, products, type) {
  const lines = lineBreakdown(record.orderLines, products);
  const total = lineTotal(record.orderLines);
  const name  = record.name || record.customer || "—";
  const html  = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice — ${name}</title>
<style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;max-width:620px;margin:36px auto;padding:24px;color:#1c1917}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px}
.brand{font-size:19px;font-weight:800;color:#92400e}.sub{color:#78716c;font-size:12px;margin-top:3px}
h4{font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#a8a29e;margin:20px 0 6px}
table{width:100%;border-collapse:collapse}
th{font-size:10px;text-align:left;text-transform:uppercase;color:#a8a29e;padding:5px 0;border-bottom:2px solid #e7e5e4}
td{padding:9px 0;border-bottom:1px solid #f5f5f4;font-size:13px}
.tot td{font-weight:800;font-size:15px;border:none;padding-top:14px}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
.g{background:#d1fae5;color:#065f46}.y{background:#fef3c7;color:#92400e}
.box{display:flex;gap:20px;margin-top:20px;padding:14px;background:#f5f5f4;border-radius:8px}
.bv{font-size:17px;font-weight:800}.bl{font-size:11px;color:#78716c}
@media print{body{margin:0}button{display:none}}</style></head><body>
<div class="hdr">
  <div><div class="brand">🫓 TAS Healthy World</div><div class="sub">Malabar Paratha Factory · Goa</div></div>
  <div style="text-align:right"><b style="font-size:18px">INVOICE</b><div class="sub">Date: ${record.date || isoD()}</div><div class="sub">Ref: ${record.id}</div></div>
</div>
<h4>Bill To</h4>
<div style="font-weight:700;font-size:15px">${name}</div>
${record.phone ? `<div class="sub">${record.phone}</div>` : ""}
${record.address ? `<div class="sub">${record.address}</div>` : ""}
${record.status ? `<div style="margin-top:8px"><span class="badge ${record.status === "Delivered" ? "g" : "y"}">${record.status}</span></div>` : ""}
<h4>Items</h4>
<table><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th style="text-align:right">Total</th></tr>
${lines.map(l => `<tr><td>${l.name}</td><td>${l.qty} ${l.unit}</td><td>${inr(l.priceAmount)}</td><td style="text-align:right">${inr(l.qty * l.priceAmount)}</td></tr>`).join("")}
<tr class="tot"><td colspan="3">Grand Total</td><td style="text-align:right">${inr(total)}</td></tr></table>
${type === "customer" ? `<div class="box">
  <div><div class="bl">Paid</div><div class="bv" style="color:#059669">${inr(record.paid)}</div></div>
  <div><div class="bl">Pending</div><div class="bv" style="color:${record.pending > 0 ? "#dc2626" : "#059669"}">${inr(record.pending)}</div></div>
</div>` : ""}
<div style="margin-top:36px;text-align:center;color:#a8a29e;font-size:11px">
  Thank you · TAS Healthy World · Generated ${new Date().toLocaleString("en-IN")}</div>
</body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 350); }
}

// ─────────────────────────────────────────────────────────────
//  THEME
// ─────────────────────────────────────────────────────────────
const LT = { bg: "#faf9f7", card: "#ffffff", border: "#e7e5e4", text: "#1c1917", sub: "#78716c", inp: "#f5f5f4", inpB: "#e7e5e4", amber: "#f59e0b" };
const DK = { bg: "#0d0d0d", card: "#161616", border: "#272727", text: "#f5f5f4", sub: "#a8a29e", inp: "#1f1f1f", inpB: "#333333", amber: "#f59e0b" };
const useTheme = (dm) => dm ? DK : LT;

// ─────────────────────────────────────────────────────────────
//  UI PRIMITIVES
// ─────────────────────────────────────────────────────────────
function Pill({ c = "stone", dm, children }) {
  const colors = {
    stone:  { bg: dm ? "#292524" : "#f5f5f4", color: dm ? "#d6d3d1" : "#57534e" },
    amber:  { bg: dm ? "#451a0380" : "#fffbeb", color: dm ? "#fcd34d" : "#b45309" },
    green:  { bg: dm ? "#05201580" : "#ecfdf5", color: dm ? "#6ee7b7" : "#065f46" },
    red:    { bg: dm ? "#2d0a0a80" : "#fef2f2", color: dm ? "#fca5a5" : "#dc2626" },
    sky:    { bg: dm ? "#082f4980" : "#f0f9ff", color: dm ? "#7dd3fc" : "#0369a1" },
    purple: { bg: dm ? "#2e1065a0" : "#faf5ff", color: dm ? "#d8b4fe" : "#7e22ce" },
  };
  const col = colors[c] || colors.stone;
  return (
    <span style={{
      background: col.bg, color: col.color,
      fontSize: 11, fontWeight: 700, padding: "3px 10px",
      borderRadius: 999, whiteSpace: "nowrap", display: "inline-block"
    }}>{children}</span>
  );
}

function Hr({ dm }) {
  const t = useTheme(dm);
  return <div style={{ height: 1, background: t.border, flexShrink: 0 }} />;
}

function Inp({ label, dm, style: extraStyle = {}, ...p }) {
  const t = useTheme(dm);
  return (
    <div>
      {label && <label style={{ color: t.sub, display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</label>}
      <input style={{
        background: t.inp, border: `1px solid ${t.inpB}`, color: t.text,
        width: "100%", borderRadius: 12, padding: "10px 14px", fontSize: 14,
        outline: "none", boxSizing: "border-box", fontFamily: "inherit", ...extraStyle
      }} {...p} />
    </div>
  );
}

function Slct({ label, dm, children, ...p }) {
  const t = useTheme(dm);
  return (
    <div>
      {label && <label style={{ color: t.sub, display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</label>}
      <select style={{
        background: t.inp, border: `1px solid ${t.inpB}`, color: t.text,
        width: "100%", borderRadius: 12, padding: "10px 14px", fontSize: 14,
        outline: "none", boxSizing: "border-box", fontFamily: "inherit"
      }} {...p}>{children}</select>
    </div>
  );
}

function Btn({ children, onClick, v = "primary", size = "md", style: extraStyle = {}, disabled = false, dm }) {
  const t = useTheme(dm);
  const variants = {
    primary: { background: dm ? "#f59e0b" : "#1c1917", color: dm ? "#000" : "#fff" },
    ghost:   { background: dm ? "#292524" : "#f5f5f4", color: dm ? "#e7e5e4" : "#44403c" },
    danger:  { background: "#dc2626", color: "#fff" },
    success: { background: "#10b981", color: "#fff" },
    amber:   { background: "#f59e0b", color: "#fff" },
    outline: { background: "transparent", color: dm ? "#e7e5e4" : "#44403c", border: `1px solid ${t.border}` },
    sky:     { background: "#0ea5e9", color: "#fff" },
    purple:  { background: "#a855f7", color: "#fff" },
  };
  const sizes = {
    sm: { padding: "6px 12px", fontSize: 12 },
    md: { padding: "10px 16px", fontSize: 14 },
    lg: { padding: "12px 20px", fontSize: 16 },
  };
  const vStyle = variants[v] || variants.primary;
  const sStyle = sizes[size] || sizes.md;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...vStyle, ...sStyle, fontWeight: 700, borderRadius: 12, border: "none",
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1,
      fontFamily: "inherit", transition: "opacity 0.15s", ...extraStyle
    }}>{children}</button>
  );
}

function Card({ children, dm, style: extraStyle = {} }) {
  const t = useTheme(dm);
  return (
    <div style={{
      background: t.card, border: `1px solid ${t.border}`,
      borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", ...extraStyle
    }}>{children}</div>
  );
}

function StatCard({ label, value, sub, accent, dm }) {
  const t = useTheme(dm);
  return (
    <div style={{
      background: t.card, border: `1px solid ${t.border}`,
      borderTop: `3px solid ${accent}`, borderRadius: 16,
      padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
    }}>
      <p style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</p>
      <p style={{ color: t.text, fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ color: t.sub, fontSize: 11, marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

// ── BOTTOM SHEET ──────────────────────────────────────────────
function Sheet({ open, title, onClose, children, dm }) {
  const t = useTheme(dm);
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
    };
  }, [open]);
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)"
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: t.card, width: "100%", maxWidth: 520,
        borderRadius: "24px 24px 0 0", maxHeight: "93dvh",
        display: "flex", flexDirection: "column", boxShadow: "0 -4px 40px rgba(0,0,0,0.3)"
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 16px", flexShrink: 0 }}>
          <span style={{ color: t.text, fontWeight: 800, fontSize: 16 }}>{title}</span>
          <button onClick={onClose} style={{
            background: t.inp, color: t.sub, width: 32, height: 32,
            borderRadius: "50%", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14
          }}>✕</button>
        </div>
        <Hr dm={dm} />
        <div style={{
          overflowY: "auto", WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain", padding: "16px 20px",
          display: "flex", flexDirection: "column", gap: 14
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); });
  return (
    <div style={{
      position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
      zIndex: 200, background: "#1c1917", color: "#fff", fontSize: 14,
      padding: "10px 20px", borderRadius: 999, boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      fontWeight: 600, border: "1px solid #44403c", whiteSpace: "nowrap"
    }}>{msg}</div>
  );
}

function ConfirmBox({ msg, onYes, onNo, dm }) {
  const t = useTheme(dm);
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px",
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)"
    }}>
      <div style={{
        background: t.card, border: `1px solid ${t.border}`,
        borderRadius: 24, padding: 24, width: "100%", maxWidth: 360,
        boxShadow: "0 8px 40px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column", gap: 16
      }}>
        <p style={{ color: t.text, fontSize: 14, fontWeight: 600, textAlign: "center", lineHeight: 1.5 }}>{msg}</p>
        <div style={{ display: "flex", gap: 12 }}>
          <Btn dm={dm} v="ghost" style={{ flex: 1 }} onClick={onNo}>Cancel</Btn>
          <Btn v="danger" style={{ flex: 1 }} onClick={onYes}>Delete</Btn>
        </div>
      </div>
    </div>
  );
}

function SearchBar({ value, onChange, placeholder, dm }) {
  const t = useTheme(dm);
  return (
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t.sub, fontSize: 14, pointerEvents: "none" }}>🔍</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || "Search…"}
        style={{
          background: t.inp, border: `1px solid ${t.inpB}`, color: t.text,
          width: "100%", borderRadius: 12, padding: "10px 32px 10px 36px",
          fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit"
        }} />
      {value && (
        <button onClick={() => onChange("")} style={{
          position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
          color: t.sub, background: "none", border: "none", cursor: "pointer", fontSize: 12
        }}>✕</button>
      )}
    </div>
  );
}

// ── PER-PRODUCT ORDER ROW ──────────────────────────────────────
function ProductOrderRow({ product, line, onChange, dm }) {
  const t = useTheme(dm);
  const qty   = line?.qty || 0;
  const price = line?.priceAmount || 0;
  const R = 24, CIRC = 2 * Math.PI * R;
  const maxQty = 999;
  const pct = Math.min(qty, maxQty) / maxQty;

  return (
    <div style={{ background: t.inp, border: `1px solid ${t.inpB}`, borderRadius: 16, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ color: t.text, fontSize: 14, fontWeight: 700, margin: 0 }}>{product.name}</p>
        {qty > 0 && price > 0 && <p style={{ color: "#f59e0b", fontSize: 14, fontWeight: 900, margin: 0 }}>{inr(qty * price)}</p>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
          <svg width="56" height="56" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="28" cy="28" r={R} fill="none" stroke={t.border} strokeWidth="4" />
            <circle cx="28" cy="28" r={R} fill="none" stroke="#f59e0b" strokeWidth="4"
              strokeDasharray={`${pct * CIRC} ${CIRC}`} strokeLinecap="round"
              style={{ transition: "stroke-dasharray 0.12s" }} />
          </svg>
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: t.text, fontSize: 14, fontWeight: 900 }}>{qty}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
          <button onClick={() => onChange({ qty: Math.max(0, qty - 1), priceAmount: price, priceLabel: line?.priceLabel || "" })}
            style={{ background: t.card, border: `1px solid ${t.inpB}`, color: t.text, width: 32, height: 32, borderRadius: 10, fontWeight: 700, fontSize: 18, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
          <input type="number" value={qty} min={0} max={maxQty}
            onChange={e => onChange({ qty: Math.max(0, Math.min(maxQty, +e.target.value || 0)), priceAmount: price, priceLabel: line?.priceLabel || "" })}
            style={{ background: t.card, border: `1px solid ${t.inpB}`, color: t.text, flex: 1, minWidth: 0, textAlign: "center", borderRadius: 10, fontSize: 14, padding: "6px", outline: "none", fontFamily: "inherit" }} />
          <button onClick={() => onChange({ qty: qty + 1, priceAmount: price, priceLabel: line?.priceLabel || "" })}
            style={{ background: "#f59e0b", color: "#fff", border: "none", width: 32, height: 32, borderRadius: 10, fontWeight: 700, fontSize: 18, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
        </div>
      </div>
      <div>
        <p style={{ color: t.sub, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Pick price per {product.unit}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          {(product.prices || []).map((p, i) => {
            const selected = price === p;
            return (
              <button key={i} onClick={() => onChange({ qty, priceAmount: p, priceLabel: `₹${p}` })}
                style={{
                  background: selected ? "#f59e0b" : t.card,
                  color: selected ? "#000" : t.sub,
                  border: selected ? "2px solid #f59e0b" : `1.5px solid ${t.inpB}`,
                  padding: "4px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.1s"
                }}>₹{p}</button>
            );
          })}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: t.sub, fontSize: 10 }}>Custom:</span>
            <input type="number" placeholder="0"
              value={price && !(product.prices || []).includes(price) ? price : ""}
              onChange={e => { const v = +e.target.value; if (v > 0) onChange({ qty, priceAmount: v, priceLabel: `₹${v}` }); }}
              style={{
                background: t.card, color: t.text, width: 60,
                border: `1.5px solid ${!(product.prices || []).includes(price) && price > 0 ? "#f59e0b" : t.inpB}`,
                borderRadius: 10, padding: "4px 8px", fontSize: 12, textAlign: "center", outline: "none", fontFamily: "inherit"
              }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ORDER LINES EDITOR ─────────────────────────────────────────
function OrderEditor({ products, orderLines, onChange, dm }) {
  const t = useTheme(dm);
  const total = lineTotal(orderLines);
  const lines = lineBreakdown(orderLines, products);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {products.map(p => (
        <ProductOrderRow key={p.id} product={p} dm={dm}
          line={safeObj(orderLines)[p.id] || { qty: 0, priceAmount: p.prices?.[0] || 0, priceLabel: `₹${p.prices?.[0] || 0}` }}
          onChange={next => onChange({ ...safeObj(orderLines), [p.id]: next })} />
      ))}
      {total > 0 && (
        <div style={{ background: t.inp, border: `1px solid ${t.inpB}`, borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          <p style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>Live Bill</p>
          {lines.map(l => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: t.sub }}>{l.qty} × {l.name} @ {inr(l.priceAmount)}</span>
              <span style={{ color: t.text, fontWeight: 700 }}>{inr(l.qty * l.priceAmount)}</span>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 4, paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 900 }}>
            <span style={{ color: t.sub }}>Total</span>
            <span style={{ color: "#f59e0b" }}>{inr(total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  LOGIN SCREEN
// ─────────────────────────────────────────────────────────────
function Login({ users, onLogin, dm }) {
  const t = useTheme(dm);
  const [u, setU] = useState(""); const [p, setP] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  function go() {
    setBusy(true); setErr("");
    setTimeout(() => {
      const found = users.find(x => x.username.toLowerCase() === u.trim().toLowerCase() && checkPw(p, x.password) && x.active);
      if (found) onLogin({ ...found, loginAt: Date.now() });
      else setErr("Invalid username or password.");
      setBusy(false);
    }, 350);
  }
  return (
    <div style={{ background: t.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🫓</div>
          <h1 style={{ color: t.text, fontSize: 24, fontWeight: 900, letterSpacing: "-0.03em", margin: 0 }}>TAS Healthy World</h1>
          <p style={{ color: t.sub, fontSize: 14, marginTop: 4 }}>Paratha Factory · Operations</p>
        </div>
        <Card dm={dm} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <Inp dm={dm} label="Username" value={u} onChange={e => setU(e.target.value)} placeholder="admin or agent1" autoComplete="username" />
          <Inp dm={dm} label="Password" type="password" value={p} onChange={e => setP(e.target.value)} placeholder="••••••••" autoComplete="current-password" onKeyDown={e => e.key === "Enter" && go()} />
          {err && <p style={{ color: "#ef4444", fontSize: 12, fontWeight: 700 }}>{err}</p>}
          <Btn dm={dm} onClick={go} disabled={busy} style={{ width: "100%" }}>{busy ? "Signing in…" : "Sign In →"}</Btn>
        </Card>
        <p style={{ color: t.sub, textAlign: "center", fontSize: 11, marginTop: 20 }}>Manage users in Admin → Settings</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  ROOT
// ─────────────────────────────────────────────────────────────
export default function Root() {
  const [dm, setDm] = useState(() => ls("tas_dm", false));
  const [users, setUsersR] = useStore("tas7_users", DEF_USERS);
  const [sess, setSess] = useState(() => {
    const s = ls("tas7_sess", null);
    return s && Date.now() - s.loginAt < SESSION_TTL ? s : null;
  });
  useEffect(() => lsw("tas_dm", dm), [dm]);
  useEffect(() => { if (sess) lsw("tas7_sess", sess); else localStorage.removeItem("tas7_sess"); }, [sess]);
  useEffect(() => {
    if (!sess) return;
    const t = setInterval(() => { if (Date.now() - sess.loginAt > SESSION_TTL) setSess(null); }, 60000);
    return () => clearInterval(t);
  }, [sess]);
  if (!sess) return <Login users={users} onLogin={setSess} dm={dm} />;
  return <CRM sess={sess} onLogout={() => setSess(null)} dm={dm} setDm={setDm} users={users} setUsers={setUsersR} />;
}

// ─────────────────────────────────────────────────────────────
//  MAIN CRM
// ─────────────────────────────────────────────────────────────
function CRM({ sess, onLogout, dm, setDm, users, setUsers }) {
  const isAdmin = sess.role === "admin";
  const t = useTheme(dm);

  const [customers,  setCust]  = useStore("tas7_cust",  DEF_CUSTOMERS);
  const [deliveries, setDeliv] = useStore("tas7_deliv", DEF_DELIVERIES);
  const [supplies,   setSup]   = useStore("tas7_sup",   DEF_SUPPLIES);
  const [expenses,   setExp]   = useStore("tas7_exp",   DEF_EXPENSES);
  const [products,   setProd]  = useStore("tas7_prod",  DEF_PRODS);
  const [actLog,     setAct]   = useStore("tas7_act",   []);

  const [tab,   setTab]   = useState(isAdmin ? "Dashboard" : "Deliveries");
  const [srch,  setSrch]  = useState("");
  const [toast, setToast] = useState(null);
  const [conf,  setConf]  = useState(null);

  const notify = m => setToast(m);
  const ask    = (msg, yes) => setConf({ msg, yes });

  function addLog(action, detail) {
    const e = { id: uid(), user: sess.name, role: sess.role, action, detail, ts: tStamp() };
    setAct(p => [e, ...p.slice(0, 499)]);
  }

  const [loc, setLoc] = useState(null);
  const [trk, setTrk] = useState(false);
  const wRef = useRef(null);
  function startTrk() {
    if (!navigator.geolocation) { notify("Geolocation unavailable"); return; }
    setTrk(true);
    wRef.current = navigator.geolocation.watchPosition(
      p => setLoc({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy), t: new Date().toLocaleTimeString("en-IN") }),
      () => notify("Location error"), { enableHighAccuracy: true }
    );
  }
  function stopTrk() { if (wRef.current) navigator.geolocation.clearWatch(wRef.current); setTrk(false); setLoc(null); }
  useEffect(() => () => { if (wRef.current) navigator.geolocation.clearWatch(wRef.current); }, []);

  const activeC    = customers.filter(c => c.active);
  const totalRev   = customers.reduce((a, c) => a + (c.paid || 0), 0);
  const totalDue   = customers.reduce((a, c) => a + (c.pending || 0), 0);
  const totalExpOp = expenses.reduce((a, e) => a + (e.amount || 0), 0);
  const totalSupC  = supplies.reduce((a, s) => a + (s.cost || 0), 0);
  const netProfit  = totalRev - totalExpOp - totalSupC;
  const pendingD   = deliveries.filter(d => d.status === "Pending");

  const chartData = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return d.toISOString().slice(0, 10); }).reverse();
    return days.map(date => ({
      date: date.slice(5),
      Revenue: deliveries.filter(d => d.date === date && d.status === "Delivered").reduce((s, d) => s + lineTotal(d.orderLines), 0),
      Expenses: expenses.filter(e => e.date === date).reduce((s, e) => s + (e.amount || 0), 0),
    }));
  }, [deliveries, expenses]);

  const q      = srch.toLowerCase();
  const fCust  = customers.filter(c => !q || c.name.toLowerCase().includes(q) || c.phone?.includes(q) || c.address?.toLowerCase().includes(q));
  const fDeliv = deliveries.filter(d => !q || d.customer.toLowerCase().includes(q) || d.date.includes(q) || d.status.toLowerCase().includes(q));
  const fSup   = supplies.filter(s => !q || s.item.toLowerCase().includes(q) || s.supplier?.toLowerCase().includes(q));

  const blkOrderLines = () => products.reduce((a, p) => ({ ...a, [p.id]: { qty: 0, priceAmount: p.prices?.[0] || 0, priceLabel: `₹${p.prices?.[0] || 0}` } }), {});
  const blkC = () => ({ name: "", phone: "", address: "", lat: "", lng: "", orderLines: blkOrderLines(), paid: 0, pending: 0, notes: "", active: true, joinDate: isoD() });
  const blkD = () => ({ customer: "", customerId: null, orderLines: blkOrderLines(), date: isoD(), status: "Pending", notes: "", address: "", lat: 0, lng: 0, createdBy: sess.name });
  const blkS = () => ({ item: "", qty: "", unit: "kg", date: isoD(), supplier: "", cost: "", notes: "" });
  const blkE = () => ({ category: "Gas", amount: "", date: isoD(), notes: "" });
  const blkP = () => ({ id: "", name: "", unit: "pcs", prices: [5, 6] });
  const blkU = () => ({ username: "", password: "", name: "", role: "agent", active: true });

  const [cSh,   setCsh]   = useState(null); const [cF,   setCf]   = useState(blkC());
  const [cView, setCView] = useState(null);
  const [dSh,   setDsh]   = useState(null); const [dF,   setDf]   = useState(blkD());
  const [sSh,   setSsh]   = useState(null); const [sF,   setSf]   = useState(blkS());
  const [eSh,   setEsh]   = useState(null); const [eF,   setEf]   = useState(blkE());
  const [pSh,   setPsh]   = useState(null); const [pF,   setPf]   = useState(blkP());
  const [uSh,   setUsh]   = useState(null); const [uF,   setUf]   = useState(blkU());
  const [paySh, setPaySh] = useState(null); const [payAmt, setPayAmt] = useState("");

  function saveC() {
    if (!cF.name.trim()) return;
    const rec = { ...cF, paid: +cF.paid || 0, pending: +cF.pending || 0 };
    if (cSh === "add") { setCust(p => [...p, { ...rec, id: uid() }]); addLog("Added customer", rec.name); notify("Customer added ✓"); }
    else { setCust(p => p.map(c => c.id === cSh.id ? { ...rec, id: c.id } : c)); addLog("Edited customer", rec.name); notify("Updated ✓"); }
    setCsh(null);
  }
  function delC(c) { ask(`Delete "${c.name}"?`, () => { setCust(p => p.filter(x => x.id !== c.id)); addLog("Deleted customer", c.name); notify("Deleted"); }); }
  function togActive(c) { setCust(p => p.map(x => x.id === c.id ? { ...x, active: !x.active } : x)); addLog("Toggled customer", c.name); }
  function recPay() {
    const a = +payAmt; if (!a || !paySh) return;
    setCust(p => p.map(c => c.id === paySh.id ? { ...c, paid: c.paid + a, pending: Math.max(0, c.pending - a) } : c));
    addLog("Payment recorded", `${paySh.name} ₹${a}`); notify(`₹${a} recorded`); setPaySh(null); setPayAmt("");
  }
  function pickCust(name) {
    const c = customers.find(x => x.name === name);
    setDf(f => ({ ...f, customer: name, customerId: c?.id || null, address: c?.address || "", lat: c?.lat || 0, lng: c?.lng || 0, orderLines: c?.orderLines ? { ...c.orderLines } : blkOrderLines() }));
  }
  function saveD() {
    if (!dF.customer) return;
    if (dSh === "add") { setDeliv(p => [...p, { ...dF, id: uid() }]); addLog("Added delivery", dF.customer); notify("Delivery added ✓"); }
    else { setDeliv(p => p.map(d => d.id === dSh.id ? { ...dF, id: d.id } : d)); addLog("Edited delivery", dF.customer); notify("Updated ✓"); }
    setDsh(null);
  }
  function tglD(d) {
    const ns = d.status === "Pending" ? "Delivered" : "Pending";
    setDeliv(p => p.map(x => x.id === d.id ? { ...x, status: ns } : x));
    addLog("Status changed", `${d.customer} → ${ns}`); notify("Updated");
  }
  function delD(d) { ask(`Delete delivery for "${d.customer}"?`, () => { setDeliv(p => p.filter(x => x.id !== d.id)); addLog("Deleted delivery", d.customer); notify("Deleted"); }); }
  function saveS() {
    if (!sF.item.trim()) return;
    const rec = { ...sF, qty: +sF.qty || 0, cost: +sF.cost || 0 };
    if (sSh === "add") { setSup(p => [...p, { ...rec, id: uid() }]); addLog("Added supply", sF.item); notify("Supply logged ✓"); }
    else { setSup(p => p.map(s => s.id === sSh.id ? { ...rec, id: s.id } : s)); addLog("Edited supply", sF.item); notify("Updated ✓"); }
    setSsh(null);
  }
  function delS(s) { ask(`Delete "${s.item}"?`, () => { setSup(p => p.filter(x => x.id !== s.id)); addLog("Deleted supply", s.item); notify("Deleted"); }); }
  function saveE() {
    if (!eF.amount) return;
    setExp(p => [...p, { ...eF, id: uid(), amount: +eF.amount }]);
    addLog("Added expense", `${eF.category} ₹${eF.amount}`); notify("Expense logged ✓"); setEsh(null);
  }
  function delE(e) { ask(`Delete "${e.category} ${inr(e.amount)}"?`, () => { setExp(p => p.filter(x => x.id !== e.id)); addLog("Deleted expense", `${e.category}`); notify("Deleted"); }); }
  function saveP() {
    if (!pF.name.trim() || !pF.id.trim()) return;
    const rec = { ...pF, id: pF.id.toLowerCase().replace(/\s+/g, ""), prices: pF.prices.map(x => +x || 0).filter(x => x > 0) };
    if (!rec.prices.length) { notify("Add at least one price"); return; }
    if (pSh === "add") {
      if (products.find(p => p.id === rec.id)) { notify("Product ID already exists"); return; }
      setProd(p => [...p, rec]); addLog("Added product", rec.name); notify("Product added ✓");
    } else { setProd(p => p.map(x => x.id === pSh.id ? rec : x)); addLog("Edited product", rec.name); notify("Updated ✓"); }
    setPsh(null);
  }
  function delP(p) { ask(`Delete product "${p.name}"?`, () => { setProd(prev => prev.filter(x => x.id !== p.id)); addLog("Deleted product", p.name); notify("Deleted"); }); }
  function saveU() {
    if (!uF.username.trim()) return;
    if (uSh === "add" && uF.password.length < 6) { notify("Password must be 6+ characters"); return; }
    const isEdit = uSh !== "add";
    const orig   = isEdit ? users.find(x => x.id === uSh.id) : null;
    const pw     = isEdit && !uF.password ? orig.password : (uF.password.startsWith("h_") ? uF.password : hashPw(uF.password));
    const rec    = { ...uF, password: pw };
    if (uSh === "add") {
      if (users.find(x => x.username === rec.username)) { notify("Username already exists"); return; }
      setUsers(p => [...p, { ...rec, id: uid(), createdAt: isoD() }]); addLog("Created user", rec.username); notify("User created ✓");
    } else { setUsers(p => p.map(x => x.id === uSh.id ? { ...rec, id: x.id } : x)); addLog("Edited user", rec.username); notify("Updated ✓"); }
    setUsh(null);
  }
  function delU(u) {
    if (u.id === sess.id) { notify("Can't delete your own account"); return; }
    if (u.role === "admin" && users.filter(x => x.role === "admin" && x.active).length <= 1) { notify("Can't remove last admin"); return; }
    ask(`Delete user "${u.username}"?`, () => { setUsers(p => p.filter(x => x.id !== u.id)); addLog("Deleted user", u.username); notify("Deleted"); });
  }
  function exportAll() {
    const d = { customers, deliveries, supplies, expenses, products, users, actLog, at: new Date().toISOString() };
    const b = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `tas_backup_${isoD()}.json`; a.click();
    addLog("Exported", "Full backup"); notify("Exported ✓");
  }
  function importAll(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        const d = JSON.parse(ev.target.result);
        if (d.customers)  setCust(d.customers);
        if (d.deliveries) setDeliv(d.deliveries);
        if (d.supplies)   setSup(d.supplies);
        if (d.expenses)   setExp(d.expenses);
        if (d.products)   setProd(d.products);
        if (d.users)      setUsers(d.users);
        addLog("Imported", "Full restore"); notify("Imported ✓");
      } catch { notify("Invalid backup file"); }
    };
    r.readAsText(f); e.target.value = "";
  }

  const TABS = isAdmin ? ["Dashboard", "Customers", "Deliveries", "Supplies", "Expenses", "Settings"] : ["Deliveries", "Customers"];

  // ── Shared small button style
  const smBtn = (extra = {}) => ({
    fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 10,
    border: "none", cursor: "pointer", fontFamily: "inherit", ...extra
  });

  return (
    <div style={{ background: t.bg, minHeight: "100vh", fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif", overflowX: "hidden" }}>

      {/* HEADER */}
      <header style={{ background: t.card, borderBottom: `1px solid ${t.border}`, position: "sticky", top: 0, zIndex: 30, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>🫓</span>
            <div>
              <p style={{ color: t.text, fontWeight: 800, fontSize: 14, margin: 0, lineHeight: 1.2 }}>TAS Healthy World</p>
              <p style={{ color: t.sub, fontSize: 11, margin: 0 }}>{sess.name} · {sess.role}</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {!isAdmin && (trk
              ? <button onClick={stopTrk} style={smBtn({ background: "#10b981", color: "#fff" })}>📍 Live</button>
              : <button onClick={startTrk} style={smBtn({ background: t.inp, color: t.sub })}>📍 Track</button>
            )}
            <button onClick={() => setDm(d => !d)} style={{ background: t.inp, color: t.text, width: 32, height: 32, borderRadius: "50%", border: "none", cursor: "pointer", fontSize: 16 }}>{dm ? "☀️" : "🌙"}</button>
            <button onClick={onLogout} style={smBtn({ background: t.inp, color: t.sub })}>Sign out</button>
          </div>
        </div>
        {/* Tab bar */}
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px 10px", display: "flex", gap: 4, overflowX: "auto" }}>
          {TABS.map(tb => (
            <button key={tb} onClick={() => { setTab(tb); setSrch(""); }}
              style={{
                whiteSpace: "nowrap", padding: "6px 14px", borderRadius: 999, border: "none",
                fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit",
                background: tab === tb ? (dm ? "#f59e0b" : "#1c1917") : "transparent",
                color: tab === tb ? (dm ? "#000" : "#fff") : t.sub,
              }}>{tb}</button>
          ))}
        </div>
      </header>

      {/* Agent location bar */}
      {!isAdmin && trk && loc && (
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "12px 16px 0" }}>
          <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 16, padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ color: "#10b981", fontSize: 12, fontWeight: 700, margin: 0 }}>📍 {loc.t} · ±{loc.acc}m</p>
              <p style={{ color: "#6ee7b7", fontSize: 11, margin: 0 }}>{loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}</p>
            </div>
            <a href={mapsUrl("", loc.lat, loc.lng)} target="_blank" rel="noopener noreferrer" style={{ color: "#10b981", fontSize: 12, fontWeight: 700 }}>Open Maps</a>
          </div>
        </div>
      )}

      {/* Main content */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* ═══ DASHBOARD ═══ */}
        {tab === "Dashboard" && (<>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <StatCard dm={dm} label="Active Customers"   value={activeC.length}              sub={`${customers.length} total`}    accent="#d97706" />
            <StatCard dm={dm} label="Pending Deliveries" value={pendingD.length}             sub={`${deliveries.filter(d=>d.status==="Delivered").length} done`} accent="#ef4444" />
            <StatCard dm={dm} label="Revenue"            value={inr(totalRev)}               sub="Collected"                      accent="#10b981" />
            <StatCard dm={dm} label="Amount Due"         value={inr(totalDue)}               sub="Outstanding"                    accent="#8b5cf6" />
            <StatCard dm={dm} label="Total Costs"        value={inr(totalExpOp + totalSupC)} sub="Ops + supplies"                 accent="#f59e0b" />
            <StatCard dm={dm} label="Net Profit"         value={inr(netProfit)}              sub="Revenue − costs"                accent={netProfit >= 0 ? "#10b981" : "#ef4444"} />
          </div>

          <Card dm={dm} style={{ padding: 16 }}>
            <p style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Revenue vs Expenses — Last 7 Days</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: t.sub }} />
                <YAxis tick={{ fontSize: 10, fill: t.sub }} />
                <Tooltip contentStyle={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11, color: t.sub }} />
                <Bar dataKey="Revenue"  fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card dm={dm}>
            <div style={{ padding: "16px 16px 8px" }}><p style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Pending Deliveries</p></div>
            <Hr dm={dm} />
            {pendingD.length === 0
              ? <p style={{ color: t.sub, fontSize: 14, textAlign: "center", padding: "20px 0" }}>All deliveries done 🎉</p>
              : pendingD.map((d, i) => (
                <div key={d.id}>
                  {i > 0 && <Hr dm={dm} />}
                  <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ color: t.text, fontSize: 14, fontWeight: 700, margin: 0 }}>{d.customer}</p>
                      <p style={{ color: t.sub, fontSize: 12, margin: 0 }}>{d.date} · {inr(lineTotal(d.orderLines))}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {d.address && <a href={mapsUrl(d.address, d.lat, d.lng)} target="_blank" rel="noopener noreferrer" style={{ color: "#0ea5e9", fontSize: 12, fontWeight: 700 }}>Maps</a>}
                      <button onClick={() => tglD(d)} style={smBtn({ background: t.inp, color: t.text })}>Done ✓</button>
                    </div>
                  </div>
                </div>
              ))}
          </Card>

          {customers.filter(c => c.pending > 0).length > 0 && (
            <Card dm={dm}>
              <div style={{ padding: "16px 16px 8px" }}><p style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Outstanding Payments</p></div>
              <Hr dm={dm} />
              {customers.filter(c => c.pending > 0).map((c, i) => (
                <div key={c.id}>
                  {i > 0 && <Hr dm={dm} />}
                  <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ color: t.text, fontSize: 14, fontWeight: 700, margin: 0 }}>{c.name}</p>
                      <p style={{ color: "#ef4444", fontSize: 12, fontWeight: 700, margin: 0 }}>{inr(c.pending)} due</p>
                    </div>
                    {isAdmin && <button onClick={() => { setPaySh(c); setPayAmt(""); }} style={smBtn({ background: "#10b981", color: "#fff" })}>+ Pay</button>}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>)}

        {/* ═══ CUSTOMERS ═══ */}
        {tab === "Customers" && (<>
          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill dm={dm} c="amber">{activeC.length} active</Pill>
              <Pill dm={dm} c="stone">{customers.filter(c => !c.active).length} inactive</Pill>
            </div>
            <Btn dm={dm} size="sm" onClick={() => { setCf(blkC()); setCsh("add"); }}>+ Customer</Btn>
          </div>
          <SearchBar dm={dm} value={srch} onChange={setSrch} placeholder="Search customers…" />
          {fCust.map(c => {
            const lines = lineBreakdown(c.orderLines, products);
            const tot   = lineTotal(c.orderLines);
            return (
              <Card key={c.id} dm={dm}>
                <div style={{ padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                    <div>
                      <p style={{ color: t.text, fontWeight: 700, fontSize: 15, margin: 0 }}>{c.name}</p>
                      <p style={{ color: t.sub, fontSize: 12, margin: 0 }}>{c.phone}{c.phone && c.address ? " · " : ""}{c.address}</p>
                    </div>
                    <Pill dm={dm} c={c.active ? "green" : "stone"}>{c.active ? "Active" : "Inactive"}</Pill>
                  </div>
                  <div style={{ background: t.inp, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                    <p style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Regular Order</p>
                    {lines.length === 0
                      ? <p style={{ color: t.sub, fontSize: 12 }}>No items set</p>
                      : lines.map(l => (
                        <div key={l.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
                          <span style={{ color: t.sub }}>{l.qty} × {l.name} @ {inr(l.priceAmount)}</span>
                          <span style={{ color: t.text, fontWeight: 700 }}>{inr(l.qty * l.priceAmount)}</span>
                        </div>
                      ))}
                    {tot > 0 && <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800 }}>
                      <span style={{ color: t.sub }}>Order total</span>
                      <span style={{ color: "#f59e0b" }}>{inr(tot)}</span>
                    </div>}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <div style={{ background: "rgba(16,185,129,0.12)", flex: 1, borderRadius: 12, padding: "10px", textAlign: "center" }}>
                      <p style={{ color: "#10b981", fontWeight: 800, fontSize: 14, margin: 0 }}>{inr(c.paid)}</p>
                      <p style={{ color: t.sub, fontSize: 10, margin: 0 }}>Paid</p>
                    </div>
                    <div style={{ background: c.pending > 0 ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.12)", flex: 1, borderRadius: 12, padding: "10px", textAlign: "center" }}>
                      <p style={{ color: c.pending > 0 ? "#ef4444" : "#10b981", fontWeight: 800, fontSize: 14, margin: 0 }}>{inr(c.pending)}</p>
                      <p style={{ color: t.sub, fontSize: 10, margin: 0 }}>Pending</p>
                    </div>
                  </div>
                  {c.notes && <p style={{ color: t.sub, fontSize: 12, fontStyle: "italic", marginBottom: 12 }}>"{c.notes}"</p>}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button onClick={() => setCView(c)} style={smBtn({ background: t.inp, color: t.text })}>View</button>
                    <button onClick={() => { setCf({ ...c, orderLines: { ...safeObj(c.orderLines) } }); setCsh(c); }} style={smBtn({ background: t.inp, color: t.text })}>Edit</button>
                    <button onClick={() => printInvoice(c, products, "customer")} style={smBtn({ background: "#a855f7", color: "#fff" })}>PDF</button>
                    {isAdmin && <>
                      <button onClick={() => { setPaySh(c); setPayAmt(""); }} style={smBtn({ background: "#10b981", color: "#fff" })}>+ Pay</button>
                      <button onClick={() => togActive(c)} style={smBtn({ background: t.inp, color: "#38bdf8" })}>{c.active ? "Deactivate" : "Activate"}</button>
                      <button onClick={() => delC(c)} style={smBtn({ background: "#dc2626", color: "#fff" })}>Delete</button>
                    </>}
                    {c.address && <a href={mapsUrl(c.address, c.lat, c.lng)} target="_blank" rel="noopener noreferrer" style={{ ...smBtn({ background: "#0ea5e9", color: "#fff" }), textDecoration: "none", display: "inline-block" }}>📍</a>}
                  </div>
                </div>
              </Card>
            );
          })}
        </>)}

        {/* ═══ DELIVERIES ═══ */}
        {tab === "Deliveries" && (<>
          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <Pill dm={dm} c="amber">{deliveries.filter(d => d.status === "Pending").length} pending</Pill>
              <Pill dm={dm} c="green">{deliveries.filter(d => d.status === "Delivered").length} done</Pill>
            </div>
            <Btn dm={dm} size="sm" onClick={() => { setDf(blkD()); setDsh("add"); }}>+ Delivery</Btn>
          </div>
          <SearchBar dm={dm} value={srch} onChange={setSrch} placeholder="Search deliveries…" />
          {fDeliv.map(d => {
            const lines = lineBreakdown(d.orderLines, products);
            const tot   = lineTotal(d.orderLines);
            return (
              <Card key={d.id} dm={dm}>
                <div style={{ padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                    <div>
                      <p style={{ color: t.text, fontWeight: 700, fontSize: 15, margin: 0 }}>{d.customer}</p>
                      <p style={{ color: t.sub, fontSize: 12, margin: 0 }}>{d.date} · by {d.createdBy || "—"}</p>
                    </div>
                    <button onClick={() => tglD(d)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      <Pill dm={dm} c={d.status === "Delivered" ? "green" : "amber"}>{d.status}</Pill>
                    </button>
                  </div>
                  <div style={{ background: t.inp, borderRadius: 12, padding: "10px 12px", marginBottom: 12 }}>
                    {lines.length === 0
                      ? <p style={{ color: t.sub, fontSize: 12, margin: 0 }}>No items</p>
                      : lines.map(l => (
                        <div key={l.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
                          <span style={{ color: t.sub }}>{l.qty} × {l.name} @ {inr(l.priceAmount)}</span>
                          <span style={{ color: t.text, fontWeight: 700 }}>{inr(l.qty * l.priceAmount)}</span>
                        </div>
                      ))}
                    {tot > 0 && <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 4, paddingTop: 4, display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800 }}>
                      <span style={{ color: t.sub }}>Total</span><span style={{ color: "#f59e0b" }}>{inr(tot)}</span>
                    </div>}
                  </div>
                  {d.notes && <p style={{ color: t.sub, fontSize: 12, fontStyle: "italic", marginBottom: 8 }}>"{d.notes}"</p>}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {d.address && <a href={mapsUrl(d.address, d.lat, d.lng)} target="_blank" rel="noopener noreferrer" style={{ ...smBtn({ background: "#0ea5e9", color: "#fff" }), textDecoration: "none", display: "inline-block" }}>📍 Navigate</a>}
                    <button onClick={() => { setDf({ ...d, orderLines: { ...safeObj(d.orderLines) } }); setDsh(d); }} style={smBtn({ background: t.inp, color: t.text })}>Edit</button>
                    <button onClick={() => printInvoice(d, products, "delivery")} style={smBtn({ background: "#a855f7", color: "#fff" })}>PDF</button>
                    {isAdmin && <button onClick={() => delD(d)} style={smBtn({ background: "#dc2626", color: "#fff" })}>Delete</button>}
                  </div>
                </div>
              </Card>
            );
          })}
        </>)}

        {/* ═══ SUPPLIES ═══ */}
        {tab === "Supplies" && isAdmin && (<>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <Pill dm={dm} c="amber">{supplies.length} items</Pill>
              <Pill dm={dm} c="purple">{inr(totalSupC)}</Pill>
            </div>
            <Btn dm={dm} size="sm" onClick={() => { setSf(blkS()); setSsh("add"); }}>+ Supply</Btn>
          </div>
          <SearchBar dm={dm} value={srch} onChange={setSrch} placeholder="Search supplies…" />
          {fSup.map(s => (
            <Card key={s.id} dm={dm}>
              <div style={{ padding: 16, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <p style={{ color: t.text, fontWeight: 700, fontSize: 14, margin: 0 }}>{s.item}</p>
                  <p style={{ color: t.sub, fontSize: 12, margin: 0 }}>{s.supplier}{s.supplier && s.date ? " · " : ""}{s.date}</p>
                  {s.notes && <p style={{ color: t.sub, fontSize: 12, fontStyle: "italic", marginTop: 2 }}>"{s.notes}"</p>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ color: t.text, fontWeight: 800, margin: 0 }}>{s.qty}<span style={{ color: t.sub, fontSize: 12, fontWeight: 400, marginLeft: 4 }}>{s.unit}</span></p>
                  {s.cost > 0 && <p style={{ color: t.sub, fontSize: 12, margin: 0 }}>{inr(s.cost)}</p>}
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 8 }}>
                    <button onClick={() => { setSf({ ...s }); setSsh(s); }} style={smBtn({ background: t.inp, color: t.text })}>Edit</button>
                    <button onClick={() => delS(s)} style={smBtn({ background: "#dc2626", color: "#fff" })}>Delete</button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </>)}

        {/* ═══ EXPENSES ═══ */}
        {tab === "Expenses" && isAdmin && (<>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <Pill dm={dm} c="red">{inr(totalExpOp)} ops</Pill>
              <Pill dm={dm} c={netProfit >= 0 ? "green" : "red"}>Profit {inr(netProfit)}</Pill>
            </div>
            <Btn dm={dm} size="sm" onClick={() => { setEf(blkE()); setEsh("add"); }}>+ Expense</Btn>
          </div>
          <Card dm={dm}>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { l: "Supply costs", v: totalSupC,  c: "#8b5cf6" },
                { l: "Op expenses",  v: totalExpOp, c: "#ef4444" },
                { l: "Revenue",      v: totalRev,   c: "#10b981" },
                { l: "Net profit",   v: netProfit,  c: netProfit >= 0 ? "#10b981" : "#ef4444" },
              ].map(x => (
                <div key={x.l} style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, borderBottom: `1px solid ${t.border}` }}>
                  <span style={{ color: t.sub, fontSize: 14 }}>{x.l}</span>
                  <span style={{ color: x.c, fontWeight: 800, fontSize: 14 }}>{inr(x.v)}</span>
                </div>
              ))}
            </div>
          </Card>
          {expenses.map(e => (
            <Card key={e.id} dm={dm}>
              <div style={{ padding: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ color: t.text, fontWeight: 700, fontSize: 14, margin: 0 }}>{e.category}</p>
                  <p style={{ color: t.sub, fontSize: 12, margin: 0 }}>{e.date}{e.notes ? " · " + e.notes : ""}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#ef4444", fontWeight: 800 }}>{inr(e.amount)}</span>
                  <button onClick={() => delE(e)} style={smBtn({ background: "#dc2626", color: "#fff" })}>Delete</button>
                </div>
              </div>
            </Card>
          ))}
        </>)}

        {/* ═══ SETTINGS ═══ */}
        {tab === "Settings" && isAdmin && (<>
          {/* Products */}
          <Card dm={dm}>
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <p style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Products</p>
                <Btn dm={dm} size="sm" onClick={() => { setPf(blkP()); setPsh("add"); }}>+ Product</Btn>
              </div>
              {products.map(p => (
                <div key={p.id} style={{ borderBottom: `1px solid ${t.border}`, padding: "12px 0" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ color: t.text, fontSize: 14, fontWeight: 700, margin: 0 }}>{p.name}</p>
                      <p style={{ color: t.sub, fontSize: 11, margin: 0 }}>{p.unit} · id: {p.id}</p>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => { setPf({ ...p, prices: [...p.prices] }); setPsh(p); }} style={smBtn({ background: t.inp, color: t.text })}>Edit</button>
                      <button onClick={() => delP(p)} style={smBtn({ background: "#dc2626", color: "#fff" })}>Delete</button>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    {p.prices.map((pr, i) => (
                      <span key={i} style={{ background: t.inp, color: t.text, fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 8 }}>{inr(pr)}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Users */}
          <Card dm={dm}>
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <p style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Users</p>
                <Btn dm={dm} size="sm" onClick={() => { setUf(blkU()); setUsh("add"); }}>+ User</Btn>
              </div>
              {users.map(u => (
                <div key={u.id} style={{ borderBottom: `1px solid ${t.border}`, padding: "12px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ color: t.text, fontSize: 14, fontWeight: 700, margin: 0 }}>{u.name} <span style={{ color: t.sub, fontWeight: 400, fontSize: 12 }}>@{u.username}</span></p>
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      <Pill dm={dm} c={u.role === "admin" ? "amber" : "sky"}>{u.role}</Pill>
                      <Pill dm={dm} c={u.active ? "green" : "stone"}>{u.active ? "Active" : "Inactive"}</Pill>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => { setUf({ ...u, password: "" }); setUsh(u); }} style={smBtn({ background: t.inp, color: t.text })}>Edit</button>
                    <button onClick={() => delU(u)} style={smBtn({ background: "#dc2626", color: "#fff" })}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Backup */}
          <Card dm={dm}>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Data Backup</p>
              <Btn dm={dm} v="outline" style={{ width: "100%" }} onClick={exportAll}>⬇️ Export All Data (JSON)</Btn>
              <label style={{ border: `1px solid ${t.border}`, color: t.text, width: "100%", fontSize: 14, fontWeight: 700, borderRadius: 12, padding: "10px 16px", textAlign: "center", cursor: "pointer", boxSizing: "border-box", display: "block" }}>
                ⬆️ Import Data (JSON)
                <input type="file" accept=".json" style={{ display: "none" }} onChange={importAll} />
              </label>
            </div>
          </Card>

          {/* Activity Log */}
          <Card dm={dm}>
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <p style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Activity Log ({actLog.length})</p>
                <button onClick={() => ask("Clear entire activity log?", () => { setAct([]); notify("Log cleared"); })} style={{ color: "#ef4444", fontSize: 11, fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>Clear all</button>
              </div>
              {actLog.length === 0
                ? <p style={{ color: t.sub, fontSize: 12, textAlign: "center", padding: "12px 0" }}>No activity yet.</p>
                : actLog.slice(0, 100).map(l => (
                  <div key={l.id} style={{ borderBottom: `1px solid ${t.border}`, padding: "8px 0" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ color: t.text, fontSize: 12, fontWeight: 700 }}>{l.action}</span>
                      <span style={{ color: t.sub, fontSize: 10 }}>{l.user} · {l.role}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
                      <span style={{ color: t.sub, fontSize: 11 }}>{l.detail}</span>
                      <span style={{ color: t.sub, fontSize: 10 }}>{l.ts}</span>
                    </div>
                  </div>
                ))}
            </div>
          </Card>

          {/* Danger Zone */}
          <Card dm={dm}>
            <div style={{ padding: 16 }}>
              <p style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginBottom: 12 }}>Danger Zone</p>
              <Btn v="danger" style={{ width: "100%" }} onClick={() => ask("Reset ALL data to factory defaults? This cannot be undone.", () => {
                setCust(DEF_CUSTOMERS); setDeliv(DEF_DELIVERIES); setSup(DEF_SUPPLIES);
                setExp(DEF_EXPENSES); setProd(DEF_PRODS);
                const r = [{ id: uid(), user: sess.name, role: sess.role, action: "FULL RESET", detail: "All data reset", ts: tStamp() }];
                setAct(r); notify("Reset complete");
              })}>⚠️ Reset All Data to Defaults</Btn>
            </div>
          </Card>
        </>)}
      </div>

      {/* ═══════════════════ SHEETS ═══════════════════ */}

      {/* Customer Sheet */}
      <Sheet dm={dm} open={!!cSh} onClose={() => setCsh(null)} title={cSh === "add" ? "New Customer" : "Edit Customer"}>
        <Inp dm={dm} label="Name *" value={cF.name} onChange={e => setCf({ ...cF, name: e.target.value })} placeholder="Business or customer name" />
        <Inp dm={dm} label="Phone"   value={cF.phone} onChange={e => setCf({ ...cF, phone: e.target.value })} placeholder="Mobile number" />
        <Inp dm={dm} label="Address" value={cF.address} onChange={e => setCf({ ...cF, address: e.target.value })} placeholder="Full delivery address" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Inp dm={dm} label="GPS Lat" value={cF.lat} onChange={e => setCf({ ...cF, lat: e.target.value })} placeholder="15.4989" />
          <Inp dm={dm} label="GPS Lng" value={cF.lng} onChange={e => setCf({ ...cF, lng: e.target.value })} placeholder="73.8278" />
        </div>
        <p style={{ color: t.sub, fontSize: 11 }}>💡 Long-press in Google Maps to get GPS coordinates.</p>
        <Hr dm={dm} />
        <p style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Regular Order — Set Qty & Pick Price Per Product</p>
        <OrderEditor dm={dm} products={products} orderLines={cF.orderLines || {}} onChange={ol => setCf(f => ({ ...f, orderLines: ol }))} />
        <Hr dm={dm} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Inp dm={dm} label="Paid (₹)"    type="number" value={cF.paid}    onChange={e => setCf({ ...cF, paid: e.target.value })} />
          <Inp dm={dm} label="Pending (₹)" type="number" value={cF.pending} onChange={e => setCf({ ...cF, pending: e.target.value })} />
        </div>
        <Inp dm={dm} label="Notes" value={cF.notes} onChange={e => setCf({ ...cF, notes: e.target.value })} placeholder="Special instructions…" />
        <Slct dm={dm} label="Status" value={cF.active ? "active" : "inactive"} onChange={e => setCf({ ...cF, active: e.target.value === "active" })}>
          <option value="active">Active</option><option value="inactive">Inactive</option>
        </Slct>
        <Btn dm={dm} onClick={saveC} style={{ width: "100%" }}>Save Customer</Btn>
      </Sheet>

      {/* Customer View Sheet */}
      <Sheet dm={dm} open={!!cView} onClose={() => setCView(null)} title="Customer Profile">
        {cView && (() => {
          const lines = lineBreakdown(cView.orderLines, products);
          const tot   = lineTotal(cView.orderLines);
          return (<>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ background: t.inp, width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: "#f59e0b" }}>{cView.name[0]}</div>
              <div>
                <p style={{ color: t.text, fontWeight: 800, margin: 0 }}>{cView.name}</p>
                <p style={{ color: t.sub, fontSize: 12, margin: 0 }}>{cView.phone}</p>
              </div>
            </div>
            <Hr dm={dm} />
            {[["Address", cView.address || "—"], ["Joined", cView.joinDate || "—"], ["Notes", cView.notes || "—"]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "4px 0" }}>
                <span style={{ color: t.sub }}>{k}</span>
                <span style={{ color: t.text, fontWeight: 700, textAlign: "right", maxWidth: "65%" }}>{v}</span>
              </div>
            ))}
            <Hr dm={dm} />
            <p style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Regular Order</p>
            {lines.length === 0
              ? <p style={{ color: t.sub, fontSize: 12 }}>No items set</p>
              : lines.map(l => (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "2px 0" }}>
                  <span style={{ color: t.sub }}>{l.qty} × {l.name} @ {inr(l.priceAmount)}</span>
                  <span style={{ color: t.text, fontWeight: 800 }}>{inr(l.qty * l.priceAmount)}</span>
                </div>
              ))}
            {tot > 0 && <div style={{ background: t.inp, borderRadius: 12, padding: 12, display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 800 }}>
              <span style={{ color: t.sub }}>Order value</span>
              <span style={{ color: "#f59e0b" }}>{inr(tot)}</span>
            </div>}
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ background: "rgba(16,185,129,0.12)", flex: 1, borderRadius: 12, padding: 12, textAlign: "center" }}>
                <p style={{ color: "#10b981", fontWeight: 800, margin: 0 }}>{inr(cView.paid)}</p>
                <p style={{ color: t.sub, fontSize: 10, margin: 0 }}>Paid</p>
              </div>
              <div style={{ background: cView.pending > 0 ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.12)", flex: 1, borderRadius: 12, padding: 12, textAlign: "center" }}>
                <p style={{ color: cView.pending > 0 ? "#ef4444" : "#10b981", fontWeight: 800, margin: 0 }}>{inr(cView.pending)}</p>
                <p style={{ color: t.sub, fontSize: 10, margin: 0 }}>Pending</p>
              </div>
            </div>
            <Hr dm={dm} />
            <p style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Delivery History</p>
            {deliveries.filter(d => d.customerId === cView.id).length === 0
              ? <p style={{ color: t.sub, fontSize: 12 }}>No deliveries yet.</p>
              : deliveries.filter(d => d.customerId === cView.id).map(d => (
                <div key={d.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: `1px solid ${t.border}` }}>
                  <span style={{ color: t.sub }}>{d.date} · {inr(lineTotal(d.orderLines))}</span>
                  <Pill dm={dm} c={d.status === "Delivered" ? "green" : "amber"}>{d.status}</Pill>
                </div>
              ))}
            <div style={{ display: "flex", gap: 8 }}>
              {cView.address && <a href={mapsUrl(cView.address, cView.lat, cView.lng)} target="_blank" rel="noopener noreferrer" style={{ flex: 1 }}><Btn dm={dm} v="outline" style={{ width: "100%" }}>📍 Maps</Btn></a>}
              <Btn v="purple" style={{ flex: 1 }} onClick={() => printInvoice(cView, products, "customer")}>PDF Invoice</Btn>
            </div>
          </>);
        })()}
      </Sheet>

      {/* Delivery Sheet */}
      <Sheet dm={dm} open={!!dSh} onClose={() => setDsh(null)} title={dSh === "add" ? "New Delivery" : "Edit Delivery"}>
        <Slct dm={dm} label="Customer *" value={dF.customer} onChange={e => pickCust(e.target.value)}>
          <option value="">— Select customer —</option>
          {customers.filter(c => c.active).map(c => <option key={c.id}>{c.name}</option>)}
        </Slct>
        {dF.address && (
          <div style={{ background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.25)", borderRadius: 12, padding: "10px 14px", fontSize: 12, color: "#38bdf8", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>📍 {dF.address}</span>
            <a href={mapsUrl(dF.address, dF.lat, dF.lng)} target="_blank" rel="noopener noreferrer" style={{ color: "#38bdf8", fontWeight: 700, marginLeft: 8 }}>Maps</a>
          </div>
        )}
        <Hr dm={dm} />
        <p style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Items — Set Qty & Pick Price Per Product</p>
        <OrderEditor dm={dm} products={products} orderLines={dF.orderLines || {}} onChange={ol => setDf(f => ({ ...f, orderLines: ol }))} />
        <Hr dm={dm} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Inp dm={dm} label="Date" type="date" value={dF.date} onChange={e => setDf({ ...dF, date: e.target.value })} />
          <Slct dm={dm} label="Status" value={dF.status} onChange={e => setDf({ ...dF, status: e.target.value })}>
            <option>Pending</option><option>Delivered</option>
          </Slct>
        </div>
        <Inp dm={dm} label="Notes" value={dF.notes} onChange={e => setDf({ ...dF, notes: e.target.value })} placeholder="e.g. Leave at gate" />
        <Btn dm={dm} onClick={saveD} style={{ width: "100%" }}>Save Delivery</Btn>
      </Sheet>

      {/* Supply Sheet */}
      <Sheet dm={dm} open={!!sSh} onClose={() => setSsh(null)} title={sSh === "add" ? "Log Supply" : "Edit Supply"}>
        <Inp dm={dm} label="Item *" value={sF.item} onChange={e => setSf({ ...sF, item: e.target.value })} placeholder="e.g. Wheat Flour" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Inp dm={dm} label="Qty" type="number" value={sF.qty} onChange={e => setSf({ ...sF, qty: e.target.value })} />
          <Slct dm={dm} label="Unit" value={sF.unit} onChange={e => setSf({ ...sF, unit: e.target.value })}>
            {["kg", "g", "L", "mL", "pcs", "bags", "boxes", "dozen"].map(u => <option key={u}>{u}</option>)}
          </Slct>
        </div>
        <Inp dm={dm} label="Supplier" value={sF.supplier} onChange={e => setSf({ ...sF, supplier: e.target.value })} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Inp dm={dm} label="Cost (₹)" type="number" value={sF.cost} onChange={e => setSf({ ...sF, cost: e.target.value })} />
          <Inp dm={dm} label="Date" type="date" value={sF.date} onChange={e => setSf({ ...sF, date: e.target.value })} />
        </div>
        <Inp dm={dm} label="Notes" value={sF.notes} onChange={e => setSf({ ...sF, notes: e.target.value })} />
        <Btn dm={dm} onClick={saveS} style={{ width: "100%" }}>Save Supply</Btn>
      </Sheet>

      {/* Expense Sheet */}
      <Sheet dm={dm} open={!!eSh} onClose={() => setEsh(null)} title="Log Expense">
        <Slct dm={dm} label="Category" value={eF.category} onChange={e => setEf({ ...eF, category: e.target.value })}>
          {["Gas", "Labour", "Transport", "Packaging", "Utilities", "Maintenance", "Other"].map(c => <option key={c}>{c}</option>)}
        </Slct>
        <Inp dm={dm} label="Amount (₹) *" type="number" value={eF.amount} onChange={e => setEf({ ...eF, amount: e.target.value })} />
        <Inp dm={dm} label="Date" type="date" value={eF.date} onChange={e => setEf({ ...eF, date: e.target.value })} />
        <Inp dm={dm} label="Notes" value={eF.notes} onChange={e => setEf({ ...eF, notes: e.target.value })} />
        <Btn dm={dm} onClick={saveE} style={{ width: "100%" }}>Save Expense</Btn>
      </Sheet>

      {/* Product Sheet */}
      <Sheet dm={dm} open={!!pSh} onClose={() => setPsh(null)} title={pSh === "add" ? "Add Product" : "Edit Product"}>
        <Inp dm={dm} label="Product Name *" value={pF.name} onChange={e => setPf({ ...pF, name: e.target.value })} placeholder="e.g. Paratha Pack 5 pcs" />
        <Inp dm={dm} label="Product ID *"   value={pF.id}   onChange={e => setPf({ ...pF, id: e.target.value })} placeholder="e.g. paratha5 (no spaces)" />
        <Slct dm={dm} label="Unit" value={pF.unit} onChange={e => setPf({ ...pF, unit: e.target.value })}>
          {["pcs", "pack", "kg", "box", "dozen", "L"].map(u => <option key={u}>{u}</option>)}
        </Slct>
        <Hr dm={dm} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ color: t.sub, fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Price Options</p>
          <button onClick={() => setPf(f => ({ ...f, prices: [...f.prices, ""] }))} style={{ color: "#f59e0b", fontSize: 12, fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>+ Add Price</button>
        </div>
        <p style={{ color: t.sub, fontSize: 11 }}>Add all the prices you use for this product (e.g. 34, 37, 45, 60). When making an order you tap to pick which one.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {pF.prices.map((pr, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: t.sub, fontSize: 12 }}>₹</span>
              <input type="number" value={pr} placeholder="0"
                onChange={e => setPf(f => ({ ...f, prices: f.prices.map((x, j) => j === i ? e.target.value : x) }))}
                style={{ background: t.inp, border: `1px solid ${t.inpB}`, color: t.text, width: 68, borderRadius: 10, padding: "6px 8px", fontSize: 14, textAlign: "center", outline: "none", fontFamily: "inherit" }} />
              {pF.prices.length > 1 && (
                <button onClick={() => setPf(f => ({ ...f, prices: f.prices.filter((_, j) => j !== i) }))}
                  style={{ color: "#ef4444", fontWeight: 800, fontSize: 16, background: "none", border: "none", cursor: "pointer" }}>✕</button>
              )}
            </div>
          ))}
        </div>
        <Btn dm={dm} onClick={saveP} style={{ width: "100%" }}>Save Product</Btn>
      </Sheet>

      {/* User Sheet */}
      <Sheet dm={dm} open={!!uSh} onClose={() => setUsh(null)} title={uSh === "add" ? "New User" : "Edit User"}>
        <Inp dm={dm} label="Full Name *"  value={uF.name}     onChange={e => setUf({ ...uF, name: e.target.value })} placeholder="e.g. Ravi Kumar" />
        <Inp dm={dm} label="Username *"   value={uF.username} onChange={e => setUf({ ...uF, username: e.target.value.toLowerCase().replace(/\s/g, "") })} placeholder="e.g. ravi" />
        <Inp dm={dm} label={uSh === "add" ? "Password *" : "New Password (leave blank to keep)"}
          type="password" value={uF.password} onChange={e => setUf({ ...uF, password: e.target.value })} placeholder="Min 6 characters" />
        <Slct dm={dm} label="Role" value={uF.role} onChange={e => setUf({ ...uF, role: e.target.value })}>
          <option value="agent">Delivery Agent</option>
          <option value="admin">Admin</option>
        </Slct>
        <Slct dm={dm} label="Status" value={uF.active ? "active" : "inactive"} onChange={e => setUf({ ...uF, active: e.target.value === "active" })}>
          <option value="active">Active</option><option value="inactive">Inactive</option>
        </Slct>
        <Btn dm={dm} onClick={saveU} style={{ width: "100%" }}>Save User</Btn>
      </Sheet>

      {/* Payment Sheet */}
      <Sheet dm={dm} open={!!paySh} onClose={() => { setPaySh(null); setPayAmt(""); }} title="Record Payment">
        {paySh && <>
          <p style={{ color: t.text, fontSize: 14, fontWeight: 700 }}>{paySh.name}</p>
          <div style={{ display: "flex", gap: 12 }}>
            <span style={{ color: "#10b981", fontSize: 14, fontWeight: 800 }}>Paid: {inr(paySh.paid)}</span>
            <span style={{ color: "#ef4444", fontSize: 14, fontWeight: 800 }}>Due: {inr(paySh.pending)}</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[paySh.pending, 500, 1000, 2000].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map(q => (
              <button key={q} onClick={() => setPayAmt(String(q))}
                style={{ background: payAmt === String(q) ? "#f59e0b" : t.inp, color: payAmt === String(q) ? "#000" : t.text, fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 10, border: "none", cursor: "pointer" }}>₹{q.toLocaleString("en-IN")}</button>
            ))}
          </div>
          <Inp dm={dm} label="Amount (₹)" type="number" value={payAmt} onChange={e => setPayAmt(e.target.value)} placeholder="Enter amount" />
          <div style={{ display: "flex", gap: 8 }}>
            <Btn dm={dm} v="ghost" style={{ flex: 1 }} onClick={() => { setPaySh(null); setPayAmt(""); }}>Cancel</Btn>
            <Btn v="success" style={{ flex: 1 }} onClick={recPay} disabled={!payAmt}>Confirm ₹{payAmt || 0}</Btn>
          </div>
        </>}
      </Sheet>

      {/* Confirm Dialog */}
      <ConfirmBox dm={dm} msg={conf?.msg} onYes={() => { conf?.yes(); setConf(null); }} onNo={() => setConf(null)} />

      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
