/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, Cell } from "recharts";
import { db } from "./firebase";
import { ref, onValue, set as fbSet } from "firebase/database";

// ═══════════════════════════════════════════════════════════════
//  SECURITY
//  Passwords use a double-multiply hash. For production deploy
//  use Firebase Auth or a Node/Express backend with bcrypt.
// ═══════════════════════════════════════════════════════════════
function hashPw(pw) {
  if (!pw) return "";
  let a = 0x9e3779b9, b = 0x6c62272e;
  for (let i = 0; i < pw.length; i++) {
    a = (Math.imul(a ^ pw.charCodeAt(i), 0x9e3779b9) | 0) >>> 0;
    b = (Math.imul(b ^ pw.charCodeAt(i), 0x517cc1b7) | 0) >>> 0;
  }
  return `h2_${a.toString(16).padStart(8,"0")}_${b.toString(16).padStart(8,"0")}_${pw.length}`;
}
function checkPw(input, stored) {
  if (!stored || !input) return false;
  if (stored.startsWith("h2_")) return hashPw(input) === stored;
  return input === stored; // legacy plain-text fallback
}
const SESSION_TTL = 8 * 60 * 60 * 1000; // 8 hours

// ═══════════════════════════════════════════════════════════════
//  FIREBASE REALTIME DATABASE
//  Writes every change to Firebase immediately.
//  All devices subscribe and receive updates in real-time.
//  localStorage is NOT used as primary storage anymore.
// ═══════════════════════════════════════════════════════════════
function ls(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }
function lsw(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
function lsdel(k) { try { localStorage.removeItem(k); } catch {} }

// Firebase deletes nodes when arrays/objects are empty, causing re-seed loops.
// Fix: always wrap data as {v: data} before writing — empty arrays become {v:[]}
// which Firebase stores correctly. Unwrap with .v on read.
function fbWrite(key, data) {
  return fbSet(ref(db, key), { v: data });
}

let _writing = {}; // keys currently being written — ignore echoes
let _lastSyncTs = null;
const _syncListeners = new Set();
function _notifySync(){_lastSyncTs=new Date();_syncListeners.forEach(fn=>fn(_lastSyncTs));}

function useStore(key, def) {
  const defRef = useRef(def);
  const [val, setRaw] = useState(() => ls(key, defRef.current));
  const [fbLoaded, setFbLoaded] = useState(false);

  useEffect(() => {
    const r = ref(db, key);
    const unsub = onValue(r, (snap) => {
      // Ignore echo of our own write
      if (_writing[key]) {
        setFbLoaded(true);
        return;
      }
      if (snap.exists()) {
        const raw = snap.val();
        // Unwrap from {v: data} wrapper
        const incoming = (raw && raw.v !== undefined) ? raw.v : raw;
        setRaw(incoming);
        lsw(key, incoming);
      } else {
        // Nothing in Firebase at all — first ever load, seed defaults once
        const d = defRef.current;
        _writing[key] = true;
        fbWrite(key, d)
          .then(() => setTimeout(() => { _writing[key] = false; }, 2000))
          .catch(e => { console.warn("seed error:", e.message); _writing[key] = false; });
        setRaw(d);
        lsw(key, d);
      }
      setFbLoaded(true);
      _notifySync();
    }, (err) => {
      console.warn("Firebase error for", key, err.message);
      setRaw(ls(key, defRef.current));
      setFbLoaded(true);
    });
    return () => unsub();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback((next) => {
    setRaw(prev => {
      const n = typeof next === "function" ? next(prev ?? defRef.current) : next;
      lsw(key, n);
      // Block echo for this key while write is in flight
      _writing[key] = true;
      fbWrite(key, n)
        .then(() => setTimeout(() => { _writing[key] = false; }, 2000))
        .catch(e => { console.warn("Firebase write error:", e.message); _writing[key] = false; });
      return n;
    });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const safeVal = fbLoaded ? val : ls(key, defRef.current);
  return [safeVal ?? defRef.current, set];
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════
const uid   = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const today = () => new Date().toISOString().slice(0,10);
const ts    = () => new Date().toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
const inr   = n  => `₹${Number(n||0).toLocaleString("en-IN")}`;
const cx    = (...a) => a.filter(Boolean).join(" ");
const safeO = x  => (x && typeof x === "object" && !Array.isArray(x)) ? x : {};
const mapU  = (a,lat,lng) => lat&&lng ? `https://maps.google.com/?q=${lat},${lng}` : `https://maps.google.com/?q=${encodeURIComponent(a||"")}`;

function lineTotal(lines) {
  return Object.values(safeO(lines)).reduce((s,l) => s + (l.qty||0)*(l.priceAmount||0), 0);
}
function lineRows(lines, prods) {
  return prods.map(p => ({...p,...(safeO(lines)[p.id]||{qty:0,priceAmount:0})})).filter(l=>l.qty>0);
}

// ═══════════════════════════════════════════════════════════════
//  ROLE SYSTEM
// ═══════════════════════════════════════════════════════════════
const ALL_TABS = ["Dashboard","Customers","Deliveries","Supplies","Expenses","Wastage","P&L","Analytics","Production","Settings"];
const ROLE_DEF = {
  admin:   ALL_TABS,
  factory: ["Customers","Deliveries","Supplies","Wastage","Production"],
  agent:   ["Customers","Deliveries"],
};

// ═══════════════════════════════════════════════════════════════
//  DEFAULT DATA
// ═══════════════════════════════════════════════════════════════
const D_PRODS = [
  {id:"roti",      name:"Roti",                 unit:"pcs",  prices:[5,6,7,8]},
  {id:"paratha5",  name:"Paratha Pack (5 pcs)",  unit:"pack", prices:[70,75,80]},
  {id:"paratha10", name:"Paratha Pack (10 pcs)", unit:"pack", prices:[130,140,150]},
];

const D_CUST = [
  {id:"c1",name:"Hotel Saffron",phone:"9876543210",address:"MG Road, Panaji, Goa",lat:15.4989,lng:73.8278,
   orderLines:{roti:{qty:20,priceAmount:6},paratha5:{qty:4,priceAmount:75},paratha10:{qty:0,priceAmount:140}},
   paid:1200,pending:300,notes:"Prefers crispy",active:true,joinDate:"2026-01-01"},
  {id:"c2",name:"Sharma Tiffin",phone:"9123456789",address:"Panaji Market, Goa",lat:15.5004,lng:73.8212,
   orderLines:{roti:{qty:0,priceAmount:5},paratha5:{qty:0,priceAmount:70},paratha10:{qty:3,priceAmount:130}},
   paid:0,pending:390,notes:"",active:true,joinDate:"2026-02-15"},
];

const D_DELIV = [
  {id:"d1",customerId:"c1",customer:"Hotel Saffron",
   orderLines:{roti:{qty:20,priceAmount:6},paratha5:{qty:4,priceAmount:75},paratha10:{qty:0,priceAmount:140}},
   date:"2026-04-12",deliveryDate:"",status:"Pending",notes:"",address:"MG Road, Panaji, Goa",lat:15.4989,lng:73.8278,createdBy:"Admin",createdAt:"2026-04-12"},
  {id:"d2",customerId:"c2",customer:"Sharma Tiffin",
   orderLines:{roti:{qty:0,priceAmount:5},paratha5:{qty:0,priceAmount:70},paratha10:{qty:3,priceAmount:130}},
   date:"2026-04-12",deliveryDate:"",status:"Delivered",notes:"",address:"Panaji Market, Goa",lat:15.5004,lng:73.8212,createdBy:"Admin",createdAt:"2026-04-12"},
];

const D_SUP = [];

const D_EXP = [];

const D_USERS = [
  {id:"u1",username:"admin",   password:hashPw("TAS@admin2026"),role:"admin",  name:"Admin",         active:true,createdAt:"2026-01-01",permissions:ALL_TABS},
  {id:"u2",username:"factory1",password:hashPw("factory123"),  role:"factory",name:"Factory Staff",  active:true,createdAt:"2026-01-01",permissions:["Customers","Deliveries","Supplies","Wastage"]},
  {id:"u3",username:"agent1",  password:hashPw("deliver123"),  role:"agent",  name:"Delivery Agent", active:true,createdAt:"2026-01-01",permissions:["Customers","Deliveries"]},
];

const D_SETTINGS = {
  appName:"TAS Healthy World",
  appSubtitle:"Paratha Factory · Operations",
  appEmoji:"🫓",
  dashWidgets:["stats","chart","pendingDeliveries","outstanding"],
  showPricesTo:["admin","factory","agent"],
  showFinancialsTo:["admin"],
  expenseCategories:["Gas","Labour","Transport","Packaging","Utilities","Maintenance","Other"],
  deliveryStatuses:["Pending","In Transit","Delivered","Cancelled"],
  supplyUnits:["kg","g","L","mL","pcs","bags","boxes","dozen"],
  companyName:"TAS Healthy World",
  companySubtitle:"Malabar Paratha Factory · Goa, India",
  showWastageTo:["admin","factory"],
  wastageTypes:["Burnt","Broken","Expired","Overproduced","Quality Reject","Other"],
  shifts:["Morning","Afternoon","Evening","Night"],
  staffLoginMode:"picker",
  staffNames:["Zeba","Zoya"],
};

// Default wastage data
const D_WASTE = [];

// Default production targets
const D_PROD_TARGETS = [];
// shifts stored in settings already

// ═══════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════
function exportPDF(record, products, type, settings) {
  const rows   = lineRows(record.orderLines||record.orders||{}, products);
  const total  = lineTotal(record.orderLines||record.orders||{});
  const name   = record.name || record.customer || "—";
  const co     = settings?.companyName    || "TAS Healthy World";
  const cosub  = settings?.companySubtitle|| "Malabar Paratha Factory · Goa, India";
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice — ${name}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;color:#1c1917;padding:32px;max-width:680px;margin:0 auto}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #e7e5e4}
.brand{font-size:19px;font-weight:900;color:#92400e}.bsub{font-size:11px;color:#78716c;margin-top:3px}
.ititle{font-size:26px;font-weight:900;text-align:right}.imeta{font-size:11px;color:#78716c;text-align:right;margin-top:3px}
.slabel{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#a8a29e;margin:18px 0 5px}
.bname{font-size:15px;font-weight:700}.bsub2{font-size:11px;color:#78716c;margin-top:2px}
.badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700;margin-top:5px}
.bg{background:#d1fae5;color:#065f46}.by{background:#fef3c7;color:#92400e}.bb{background:#dbeafe;color:#1e40af}
table{width:100%;border-collapse:collapse;margin-top:6px}
th{font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:#a8a29e;padding:7px 0;border-bottom:2px solid #e7e5e4;text-align:left}
th:last-child,td:last-child{text-align:right}
td{padding:9px 0;border-bottom:1px solid #f5f5f4;font-size:12px}
.trow td{font-weight:800;font-size:14px;border:none;border-top:2px solid #1c1917;padding-top:11px}
.sumbox{display:flex;gap:20px;margin-top:20px;padding:14px;background:#f5f5f4;border-radius:8px}
.sv{font-size:17px;font-weight:900;margin-top:2px}.sl{font-size:10px;color:#78716c}
.footer{margin-top:36px;text-align:center;font-size:10px;color:#a8a29e;padding-top:18px;border-top:1px solid #e7e5e4}
@media print{@page{margin:1cm}body{padding:0}}
</style></head><body>
<div class="hdr">
  <div><div class="brand">🫓 ${co}</div><div class="bsub">${cosub}</div></div>
  <div><div class="ititle">INVOICE</div>
  <div class="imeta">Date: ${record.date||today()}</div>
  <div class="imeta">Ref: #${(record.id||"").slice(-8)}</div>
  ${record.deliveryDate?`<div class="imeta">Deliver by: ${record.deliveryDate}</div>`:""}
  </div>
</div>
<div class="slabel">Bill To</div>
<div class="bname">${name}</div>
${record.phone?`<div class="bsub2">📞 ${record.phone}</div>`:""}
${record.address?`<div class="bsub2">📍 ${record.address}</div>`:""}
${record.joinDate?`<div class="bsub2">Customer since: ${record.joinDate}</div>`:""}
${record.status?`<span class="badge ${record.status==="Delivered"?"bg":record.status==="In Transit"?"bb":"by"}">${record.status}</span>`:""}
<div class="slabel">Items</div>
<table><tr><th>Product</th><th>Unit</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr>
${rows.map(r=>`<tr><td>${r.name}</td><td>${r.unit}</td><td>${r.qty}</td><td>${inr(r.priceAmount)}</td><td>${inr(r.qty*r.priceAmount)}</td></tr>`).join("")}
<tr class="trow"><td colspan="4">Grand Total</td><td>${inr(total)}</td></tr></table>
${type==="customer"?`<div class="sumbox">
<div><div class="sl">Amount Paid</div><div class="sv" style="color:#059669">${inr(record.paid||0)}</div></div>
<div><div class="sl">Amount Pending</div><div class="sv" style="color:${(record.pending||0)>0?"#dc2626":"#059669"}">${inr(record.pending||0)}</div></div>
<div><div class="sl">Payment Status</div><div class="sv" style="color:${(record.pending||0)>0?"#dc2626":"#059669"};font-size:13px">${(record.pending||0)>0?"UNPAID":"✓ PAID"}</div></div>
</div>`:""}
<div class="footer">Thank you for your business · ${co} · Generated ${new Date().toLocaleString("en-IN")}</div>
<script>window.addEventListener("load",function(){window.print();});</script>
</body></html>`;
  // Use blob URL — works without pop-up permission, opens in new tab reliably
  const blob = new Blob([html], {type:"text/html;charset=utf-8"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.target = "_blank"; a.rel = "noopener";
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}

function shareWhatsApp(record, products, type, settings) {
  const rows   = lineRows(record.orderLines||record.orders||{}, products);
  const total  = lineTotal(record.orderLines||record.orders||{});
  const name   = record.name || record.customer || "—";
  const co     = settings?.companyName || "TAS Healthy World";
  const phone  = record.phone ? record.phone.replace(/\D/g,"") : "";
  let msg = `🫓 *${co}*\n`;
  if(type==="delivery") msg += `📦 *Delivery Order*\n📅 Date: ${record.date||""}${record.deliveryDate?" → "+record.deliveryDate:""}\nStatus: ${record.status||"Pending"}\n`;
  else msg += `🧾 *Invoice*\n📅 ${record.date||""}\n`;
  msg += `\n*Customer:* ${name}`;
  if(record.address) msg += `\n📍 ${record.address}`;
  msg += `\n\n*Items:*\n`;
  rows.forEach(r=>{msg+=`• ${r.qty} × ${r.name} @ ₹${r.priceAmount} = ₹${r.qty*r.priceAmount}\n`;});
  msg += `\n*Total: ₹${total.toLocaleString("en-IN")}*`;
  if(type==="customer"&&record.pending>0) msg+=`\n⚠️ Pending: ₹${(record.pending||0).toLocaleString("en-IN")}`;
  msg += `\n\n_${co}_`;
  const encoded = encodeURIComponent(msg);
  const url = phone ? `https://wa.me/91${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  window.open(url,"_blank","noopener");
}

function exportCSV(data, fname, cols) {
  const esc = v => { const s=String(v==null?"":v); return s.includes(",")||s.includes('"')||s.includes("\n")?`"${s.replace(/"/g,'""')}"`:`${s}`; };
  const csv = [cols.map(c=>esc(c.label)).join(","), ...data.map(r=>cols.map(c=>esc(typeof c.val==="function"?c.val(r):r[c.key]??(""))).join(","))].join("\n");
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"})); a.download=`${fname}_${today()}.csv`; a.click(); URL.revokeObjectURL(a.href);
}

function exportWord(record, products, type, settings) {
  const rows = lineRows(record.orderLines||{}, products);
  const total= lineTotal(record.orderLines||{});
  const name = record.name||record.customer||"—";
  const co   = settings?.companyName||"TAS Healthy World";
  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
<head><meta charset='utf-8'><title>Invoice</title>
<style>body{font-family:Arial;font-size:12pt}h1{color:#92400e;font-size:15pt}h2{font-size:9pt;text-transform:uppercase;letter-spacing:2px;color:#a8a29e;margin-top:16pt}table{border-collapse:collapse;width:100%;margin-top:5pt}th{background:#f5f5f4;font-size:9pt;padding:5pt;border:1pt solid #e7e5e4}td{padding:5pt;border:1pt solid #e7e5e4;font-size:11pt}.tot{font-weight:bold;font-size:13pt}.paid{color:#059669;font-weight:bold}.unpaid{color:#dc2626;font-weight:bold}</style>
</head><body>
<h1>🫓 ${co}</h1>
<h1 style="font-size:20pt;float:right;margin-top:-30pt">INVOICE</h1>
<p style="clear:both;font-size:10pt;color:#78716c">Date: ${record.date||today()} | Ref: #${(record.id||"").slice(-8)}${record.deliveryDate?` | Deliver by: ${record.deliveryDate}`:""}</p>
<h2>Bill To</h2>
<p><b style="font-size:13pt">${name}</b>${record.phone?`<br>📞 ${record.phone}`:""}${record.address?`<br>📍 ${record.address}`:""}${record.joinDate?`<br>Since: ${record.joinDate}`:""}</p>
${record.status?`<p><b>Status:</b> ${record.status}</p>`:""}
<h2>Items</h2>
<table><tr><th>Product</th><th>Unit</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr>
${rows.map(r=>`<tr><td>${r.name}</td><td>${r.unit}</td><td>${r.qty}</td><td>${inr(r.priceAmount)}</td><td>${inr(r.qty*r.priceAmount)}</td></tr>`).join("")}
<tr class="tot"><td colspan="4">Total</td><td>${inr(total)}</td></tr></table>
${type==="customer"?`<h2>Payment</h2><table><tr><td>Paid</td><td class="paid">${inr(record.paid||0)}</td><td>Pending</td><td class="${(record.pending||0)>0?"unpaid":"paid"}">${inr(record.pending||0)}</td><td>Status</td><td class="${(record.pending||0)>0?"unpaid":"paid"}">${(record.pending||0)>0?"UNPAID":"PAID"}</td></tr></table>`:""}
<p style="margin-top:32pt;text-align:center;color:#a8a29e;font-size:9pt">Thank you · ${co} · ${new Date().toLocaleString("en-IN")}</p>
</body></html>`;
  const blob2=new Blob([html],{type:"application/msword"});
  const a2=document.createElement("a"); a2.href=URL.createObjectURL(blob2); a2.download=`invoice_${name.replace(/\s+/g,"_")}_${today()}.doc`;
  document.body.appendChild(a2); a2.click(); setTimeout(()=>{document.body.removeChild(a2);URL.revokeObjectURL(a2.href);},1000);
}

// ═══════════════════════════════════════════════════════════════
//  THEME
// ═══════════════════════════════════════════════════════════════
const LT={bg:"#f2f2ed",card:"#ffffff",border:"#e2e1db",text:"#18181b",sub:"#6b7280",inp:"#eeede7",inpB:"#d6d5cf",accent:"#d97706",accentFg:"#fff",sidebar:"#1a1a22",sidebarBorder:"#282832",sidebarText:"#e4e4e7",sidebarSub:"#6b7280",sidebarActive:"#f59e0b",sidebarActiveBg:"rgba(245,158,11,0.14)"};
const DK={bg:"#0c0c10",card:"#17171b",border:"#26262c",text:"#fafafa",sub:"#9ca3af",inp:"#1e1e24",inpB:"#2e2e36",accent:"#f59e0b",accentFg:"#000",sidebar:"#101014",sidebarBorder:"#1e1e26",sidebarText:"#e4e4e7",sidebarSub:"#6b7280",sidebarActive:"#f59e0b",sidebarActiveBg:"rgba(245,158,11,0.12)"};
const T=(dm)=>dm?DK:LT;

// ═══════════════════════════════════════════════════════════════
//  UI ATOMS
// ═══════════════════════════════════════════════════════════════
function Pill({c="stone",dm,children}){
  const m={
    stone:["bg-zinc-100 text-zinc-600 border border-zinc-200","bg-zinc-800 text-zinc-300 border border-zinc-700"],
    amber:["bg-amber-50 text-amber-700 border border-amber-200","bg-amber-900/30 text-amber-300 border border-amber-700/50"],
    green:["bg-emerald-50 text-emerald-700 border border-emerald-200","bg-emerald-900/30 text-emerald-300 border border-emerald-700/50"],
    red:["bg-red-50 text-red-600 border border-red-200","bg-red-900/30 text-red-300 border border-red-700/50"],
    sky:["bg-sky-50 text-sky-700 border border-sky-200","bg-sky-900/30 text-sky-300 border border-sky-700/50"],
    blue:["bg-blue-50 text-blue-700 border border-blue-200","bg-blue-900/30 text-blue-300 border border-blue-700/50"],
    purple:["bg-purple-50 text-purple-700 border border-purple-200","bg-purple-900/30 text-purple-300 border border-purple-700/50"],
  };
  return <span className={cx("inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap select-none",(m[c]||m.stone)[dm?1:0])}>{children}</span>;
}
function Hr({dm}){const t=T(dm);return <div style={{height:1,background:t.border}}/>;}
function Inp({label,dm,className="",...p}){
  const t=T(dm);
  return <div className={className}>
    {label&&<label style={{color:t.sub}} className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 ml-0.5">{label}</label>}
    <input style={{background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,transition:"border-color 0.15s,box-shadow 0.15s"}} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-amber-400 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.15)] placeholder:text-zinc-400/60" {...p}/>
  </div>;
}
function Sel({label,dm,children,className="",...p}){
  const t=T(dm);
  return <div className={className}>
    {label&&<label style={{color:t.sub}} className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 ml-0.5">{label}</label>}
    <select style={{background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text}} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-amber-400 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.15)] transition-all" {...p}>{children}</select>
  </div>;
}
function Btn({children,onClick,v="primary",size="md",className="",disabled=false,dm}){
  const V={
    primary:dm?"bg-amber-500 text-black hover:bg-amber-400 shadow-[0_1px_2px_rgba(0,0,0,0.3)]":"bg-zinc-900 text-white hover:bg-zinc-700 shadow-[0_1px_2px_rgba(0,0,0,0.15)]",
    ghost:dm?"bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700":"bg-white text-zinc-700 hover:bg-zinc-50 border border-zinc-200 shadow-sm",
    danger:"bg-red-600 text-white hover:bg-red-500 shadow-sm",
    success:"bg-emerald-500 text-white hover:bg-emerald-400 shadow-sm",
    amber:"bg-amber-500 text-white hover:bg-amber-400 shadow-sm",
    outline:dm?"border-2 border-zinc-600 text-zinc-200 hover:bg-zinc-800":"border-2 border-zinc-200 text-zinc-700 hover:bg-zinc-50",
    sky:"bg-sky-500 text-white hover:bg-sky-400 shadow-sm",
    purple:"bg-purple-500 text-white hover:bg-purple-400 shadow-sm",
  };
  const S={sm:"px-3 py-1.5 text-xs",md:"px-4 py-2.5 text-sm",lg:"px-6 py-3 text-base"};
  return <button onClick={onClick} disabled={disabled} className={cx("font-semibold rounded-xl transition-all duration-150 active:scale-[0.96] select-none",V[v]||V.primary,S[size]||S.md,disabled&&"opacity-40 cursor-not-allowed pointer-events-none",className)}>{children}</button>;
}
function Card({children,className="",dm}){
  const t=T(dm);
  return <div style={{background:t.card,border:`1px solid ${t.border}`,boxShadow:dm?"0 1px 3px rgba(0,0,0,0.4)":"0 1px 3px rgba(0,0,0,0.06),0 1px 2px rgba(0,0,0,0.04)"}} className={cx("rounded-2xl",className)}>{children}</div>;
}
function StatCard({label,value,sub,accent,dm}){
  const t=T(dm);
  return <div style={{background:t.card,border:`1px solid ${t.border}`,boxShadow:dm?"0 1px 4px rgba(0,0,0,0.4)":"0 1px 3px rgba(0,0,0,0.06)"}} className="rounded-2xl p-4 relative overflow-hidden">
    <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:accent,borderRadius:"8px 8px 0 0"}}/>
    <p style={{color:t.sub}} className="text-[10px] font-bold uppercase tracking-widest mb-2 mt-1">{label}</p>
    <p style={{color:t.text}} className="text-2xl font-black leading-none tracking-tight">{value}</p>
    {sub&&<p style={{color:t.sub}} className="text-[11px] mt-1.5 font-medium">{sub}</p>}
  </div>;
}
function Sheet({open,title,onClose,children,dm}){
  const t=T(dm);
  useEffect(()=>{if(open){document.body.style.overflow="hidden";document.body.style.position="fixed";document.body.style.width="100%";}return()=>{document.body.style.overflow="";document.body.style.position="";document.body.style.width="";};},[open]);
  if(!open)return null;
  return <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{background:"rgba(0,0,0,0.7)",backdropFilter:"blur(10px)"}}>
    <div style={{background:t.card,maxHeight:"93dvh",border:`1px solid ${t.border}`,boxShadow:"0 25px 50px rgba(0,0,0,0.4)"}} className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl flex flex-col" onTouchMove={e=>e.stopPropagation()}>
      <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0">
        <span style={{color:t.text}} className="font-bold text-[15px] tracking-tight">{title}</span>
        <button onClick={onClose} style={{background:t.inp,color:t.sub,border:`1px solid ${t.inpB}`}} className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold hover:opacity-70 transition-opacity">✕</button>
      </div>
      <Hr dm={dm}/>
      <div className="px-6 py-5 flex flex-col gap-4" style={{overflowY:"auto",WebkitOverflowScrolling:"touch",overscrollBehavior:"contain"}}>{children}</div>
    </div>
  </div>;
}
function Toast({msg,onDone}){
  useEffect(()=>{const t=setTimeout(onDone,2800);return()=>clearTimeout(t);});
  return <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] text-sm px-5 py-3 rounded-2xl font-semibold whitespace-nowrap pointer-events-none flex items-center gap-2" style={{background:"rgba(24,24,27,0.95)",color:"#fafafa",border:"1px solid rgba(255,255,255,0.08)",boxShadow:"0 8px 32px rgba(0,0,0,0.4)",backdropFilter:"blur(8px)"}}><span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"/>{msg}</div>;
}
function Confirm({msg,onYes,onNo,dm}){
  const t=T(dm);if(!msg)return null;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center px-6" style={{background:"rgba(0,0,0,0.8)",backdropFilter:"blur(12px)"}}>
    <div style={{background:t.card,border:`1px solid ${t.border}`,boxShadow:"0 25px 50px rgba(0,0,0,0.5)"}} className="w-full max-w-sm rounded-3xl p-6 flex flex-col gap-5">
      <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center text-xl mx-auto">⚠️</div>
      <p style={{color:t.text}} className="text-sm font-semibold text-center leading-relaxed">{msg}</p>
      <div className="flex gap-3"><Btn dm={dm} v="ghost" className="flex-1" onClick={onNo}>Cancel</Btn><Btn v="danger" className="flex-1" onClick={onYes}>Confirm Delete</Btn></div>
    </div>
  </div>;
}
function Search({value,onChange,placeholder,dm}){
  const t=T(dm);
  return <div className="relative">
    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder||"Search…"} style={{background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text}} className="w-full rounded-xl pl-9 pr-9 py-2.5 text-sm outline-none focus:border-amber-400 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.15)] placeholder:text-zinc-400/60 transition-all"/>
    {value&&<button onClick={()=>onChange("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black transition-opacity hover:opacity-70" style={{background:t.inpB,color:t.sub}}>✕</button>}
  </div>;
}

// Toggle switch
function Tog({on,onChange,dm}){
  const t=T(dm);
  return <button onClick={onChange} style={{background:on?"#f59e0b":t.inp,border:`1.5px solid ${on?"#f59e0b":t.inpB}`,width:42,height:24,borderRadius:99,padding:2,display:"flex",alignItems:"center",justifyContent:on?"flex-end":"flex-start",flexShrink:0,transition:"all 0.2s",boxShadow:on?"0 0 0 3px rgba(245,158,11,0.2)":"none"}}>
    <div style={{width:18,height:18,background:"#fff",borderRadius:"50%",boxShadow:"0 1px 3px rgba(0,0,0,0.3)",transition:"all 0.2s"}}/>
  </button>;
}

// Per-product order row with dial + individual price chips
function ProdRow({product,line,onChange,dm,showPrice=true}){
  const t=T(dm);
  const qty=line?.qty||0;
  const price=line?.priceAmount||0;
  const R=22,C=2*Math.PI*R,pct=Math.min(qty,500)/500;
  return (
    <div style={{background:t.inp,border:`1px solid ${t.inpB}`}} className="rounded-2xl p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <p style={{color:t.text}} className="text-sm font-bold">{product.name}</p>
        {showPrice&&qty>0&&price>0&&<p className="text-sm font-black text-amber-500">{inr(qty*price)}</p>}
        {!showPrice&&qty>0&&<p style={{color:t.sub}} className="text-sm font-semibold">{qty} {product.unit}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div className="relative shrink-0" style={{width:50,height:50}}>
          <svg width="50" height="50" style={{transform:"rotate(-90deg)"}}>
            <circle cx="25" cy="25" r={R} fill="none" stroke={t.border} strokeWidth="4"/>
            <circle cx="25" cy="25" r={R} fill="none" stroke="#f59e0b" strokeWidth="4" strokeDasharray={`${pct*C} ${C}`} strokeLinecap="round" style={{transition:"stroke-dasharray 0.1s"}}/>
          </svg>
          <span style={{color:t.text}} className="absolute inset-0 flex items-center justify-center text-xs font-black">{qty}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-1">
          <button onClick={()=>onChange({qty:Math.max(0,qty-1),priceAmount:price})} style={{background:t.card,border:`1px solid ${t.inpB}`,color:t.text}} className="w-8 h-8 rounded-xl font-bold text-base flex items-center justify-center shrink-0">−</button>
          <input type="number" value={qty} min={0} max={9999} onChange={e=>onChange({qty:Math.max(0,Math.min(9999,+e.target.value||0)),priceAmount:price})} style={{background:t.card,border:`1px solid ${t.inpB}`,color:t.text}} className="flex-1 min-w-0 text-center rounded-xl text-sm py-1.5 outline-none focus:ring-2 focus:ring-amber-400"/>
          <button onClick={()=>onChange({qty:qty+1,priceAmount:price})} className="w-8 h-8 rounded-xl font-bold text-base flex items-center justify-center shrink-0 bg-amber-500 text-white">+</button>
        </div>
      </div>
      {showPrice&&(
        <div>
          <p style={{color:t.sub}} className="text-[10px] font-semibold uppercase tracking-wider mb-1.5">Price per {product.unit}</p>
          <div className="flex flex-wrap gap-1.5">
            {(product.prices||[]).map((p,i)=>(
              <button key={i} onClick={()=>onChange({qty,priceAmount:p})}
                style={price===p?{background:"#f59e0b",color:"#000",border:"2px solid #f59e0b"}:{background:t.card,color:t.sub,border:`1.5px solid ${t.inpB}`}}
                className="px-3 py-1 rounded-xl text-xs font-bold transition-all active:scale-95">₹{p}</button>
            ))}
            <div className="flex items-center gap-1">
              <span style={{color:t.sub}} className="text-[10px]">Custom ₹</span>
              <input type="number" placeholder="0"
                value={price&&!(product.prices||[]).includes(price)?price:""}
                onChange={e=>{const v=+e.target.value;if(v>0)onChange({qty,priceAmount:v});}}
                style={{background:t.card,border:`1.5px solid ${price&&!(product.prices||[]).includes(price)?"#f59e0b":t.inpB}`,color:t.text,width:64}}
                className="rounded-xl px-2 py-1 text-xs text-center outline-none focus:ring-1 focus:ring-amber-400"/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderEditor({products,orderLines,onChange,dm,showPrice=true}){
  const t=T(dm);
  const total=lineTotal(orderLines);
  const rows=lineRows(orderLines,products);
  return (
    <>
      {products.map(p=>(
        <ProdRow key={p.id} product={p} dm={dm} showPrice={showPrice}
          line={safeO(orderLines)[p.id]||{qty:0,priceAmount:p.prices?.[0]||0}}
          onChange={next=>onChange({...safeO(orderLines),[p.id]:next})}/>
      ))}
      {showPrice&&total>0&&(
        <div style={{background:t.inp,border:`1px solid ${t.inpB}`}} className="rounded-xl p-3 flex flex-col gap-1">
          <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-0.5">Live Bill</p>
          {rows.map(r=>(
            <div key={r.id} className="flex justify-between text-xs">
              <span style={{color:t.sub}}>{r.qty} × {r.name} @ {inr(r.priceAmount)}</span>
              <span style={{color:t.text}} className="font-semibold">{inr(r.qty*r.priceAmount)}</span>
            </div>
          ))}
          <div style={{borderTop:`1px solid ${t.border}`}} className="mt-1 pt-1.5 flex justify-between text-sm font-black">
            <span style={{color:t.sub}}>Total</span><span className="text-amber-500">{inr(total)}</span>
          </div>
        </div>
      )}
      {!showPrice&&rows.length>0&&(
        <div style={{background:t.inp}} className="rounded-xl p-3">
          <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-1">Order Summary</p>
          {rows.map(r=><div key={r.id} className="flex justify-between text-xs py-0.5"><span style={{color:t.sub}}>{r.qty} × {r.name}</span><span style={{color:t.text}} className="font-semibold">{r.qty} {r.unit}</span></div>)}
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  LOGIN
// ═══════════════════════════════════════════════════════════════
function Login({users,onLogin,dm,settings}){
  const mode=settings?.staffLoginMode||"individual";
  const staffNames=settings?.staffNames||[];
  const [u,setU]=useState(""); const [p,setP]=useState(""); const [err,setErr]=useState(""); const [busy,setBusy]=useState(false);
  const [showAdminForm,setShowAdminForm]=useState(false);
  function go(){
    setBusy(true);setErr("");
    setTimeout(()=>{
      const found=users.find(x=>x.username.toLowerCase()===u.trim().toLowerCase()&&checkPw(p,x.password)&&x.active);
      if(found)onLogin({...found,loginAt:Date.now()});
      else setErr("Invalid username or password.");
      setBusy(false);
    },400);
  }
  function pickStaff(name){
    const shared=users.find(x=>x.active&&x.role!=="admin");
    if(shared)onLogin({...shared,loginAt:Date.now(),displayOverride:name});
    else setErr("No active staff account found. Create one in Settings.");
  }
  // ── STAFF PICKER MODE ──────────────────────────────────────────
  if(mode==="picker"&&!showAdminForm){
    return(
      <div style={{background:dm?"#0c0c10":"#f2f2ed",minHeight:"100dvh",fontFamily:"system-ui,sans-serif"}} className="flex flex-col items-center justify-center px-4 py-10">
        {/* Brand */}
        <div className="text-center mb-10">
          <div style={{background:"rgba(245,158,11,0.12)",border:"2px solid rgba(245,158,11,0.3)"}} className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-5 select-none">{settings?.appEmoji||"🫓"}</div>
          <h1 style={{color:dm?"#fafafa":"#18181b",fontWeight:900,fontSize:28,letterSpacing:-1,marginBottom:4}}>{settings?.appName||"TAS Healthy World"}</h1>
          <p style={{color:dm?"#9ca3af":"#6b7280",fontSize:13,fontWeight:500}}>{settings?.appSubtitle||"Operations"}</p>
        </div>
        {/* Picker */}
        <div style={{width:"100%",maxWidth:420}}>
          <p style={{color:dm?"#9ca3af":"#6b7280",fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",textAlign:"center",marginBottom:16}}>Who's working today?</p>
          {staffNames.length===0&&(
            <div style={{background:dm?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)",border:`1px dashed ${dm?"#333":"#ccc"}`,borderRadius:16,padding:"24px 20px",textAlign:"center"}}>
              <p style={{color:dm?"#9ca3af":"#6b7280",fontSize:13}}>No staff names added yet.</p>
              <p style={{color:dm?"#6b7280":"#9ca3af",fontSize:11,marginTop:4}}>Admin → Settings → Staff Login Mode</p>
            </div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {staffNames.map((name,i)=>{
              const initials=name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
              const colors=["#d97706","#7c3aed","#0284c7","#059669","#dc2626","#db2777"];
              const color=colors[i%colors.length];
              return(
                <button key={name} onClick={()=>pickStaff(name)}
                  style={{background:dm?"rgba(255,255,255,0.05)":"#fff",border:`1.5px solid ${dm?"rgba(255,255,255,0.08)":"#e5e5e0"}`,borderRadius:16,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,textAlign:"left",width:"100%",cursor:"pointer",transition:"all 0.15s",boxShadow:dm?"none":"0 1px 3px rgba(0,0,0,0.06)"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=color;e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow=`0 4px 16px ${color}22`;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=dm?"rgba(255,255,255,0.08)":"#e5e5e0";e.currentTarget.style.transform="";e.currentTarget.style.boxShadow=dm?"none":"0 1px 3px rgba(0,0,0,0.06)";}}>
                  <div style={{width:44,height:44,background:`${color}20`,border:`2px solid ${color}40`,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",color,fontWeight:900,fontSize:16,flexShrink:0}}>{initials}</div>
                  <div style={{flex:1}}>
                    <p style={{color:dm?"#fafafa":"#18181b",fontWeight:700,fontSize:15,lineHeight:1.2}}>{name}</p>
                    <p style={{color:dm?"#6b7280":"#9ca3af",fontSize:11,marginTop:2,fontWeight:500}}>Tap to start session</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dm?"#444":"#ccc"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              );
            })}
          </div>
          {err&&<div style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:12,padding:"10px 14px",marginTop:16,textAlign:"center"}}>
            <p style={{color:"#ef4444",fontSize:12,fontWeight:600}}>{err}</p>
          </div>}
          <button onClick={()=>{setErr("");setShowAdminForm(true);}} style={{color:dm?"#6b7280":"#9ca3af",fontSize:11,fontWeight:600,display:"block",width:"100%",textAlign:"center",marginTop:28,background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>Admin login</button>
        </div>
      </div>
    );
  }
  // ── INDIVIDUAL / ADMIN LOGIN FORM ─────────────────────────────
  return (
    <div style={{background:dm?"#0c0c10":"#f2f2ed",minHeight:"100dvh"}} className="flex flex-col lg:flex-row">
      {/* Left panel on desktop */}
      <div style={{background:dm?"#111115":"#1a1a22",position:"relative",overflow:"hidden"}} className="hidden lg:flex flex-col justify-center items-center flex-1 p-12">
        <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle at 30% 40%, rgba(245,158,11,0.12) 0%, transparent 60%), radial-gradient(circle at 70% 70%, rgba(124,58,237,0.08) 0%, transparent 50%)"}}/>
        <div className="text-center relative z-10">
          <div style={{background:"rgba(245,158,11,0.12)",border:"2px solid rgba(245,158,11,0.25)"}} className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl mx-auto mb-6 select-none">{settings?.appEmoji||"🫓"}</div>
          <h1 style={{color:"#fafafa",fontWeight:900,fontSize:36,letterSpacing:-1.5,lineHeight:1.1}} className="mb-3">{settings?.appName||"TAS Healthy World"}</h1>
          <p style={{color:"rgba(255,255,255,0.45)",fontSize:15,fontWeight:500}}>{settings?.appSubtitle||"Paratha Factory · Operations"}</p>
          <div style={{height:1,background:"rgba(255,255,255,0.08)",margin:"32px 0"}}/>
          <div style={{display:"flex",gap:20,justifyContent:"center"}}>
            {[{label:"Real-time sync",icon:"⚡"},{label:"Multi-role access",icon:"🔐"},{label:"Firebase powered",icon:"🔥"}].map(f=>(
              <div key={f.label} style={{textAlign:"center"}}>
                <div style={{fontSize:20,marginBottom:6}}>{f.icon}</div>
                <p style={{color:"rgba(255,255,255,0.35)",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>{f.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Right panel */}
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-12">
        <div style={{width:"100%",maxWidth:360}}>
          <div className="text-center mb-8 lg:hidden">
            <div style={{background:"rgba(217,119,6,0.1)",border:"2px solid rgba(217,119,6,0.2)"}} className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 select-none">{settings?.appEmoji||"🫓"}</div>
            <h1 style={{color:dm?"#fafafa":"#18181b",fontWeight:900,fontSize:22,letterSpacing:-0.5}}>{settings?.appName||"TAS Healthy World"}</h1>
            <p style={{color:dm?"#9ca3af":"#6b7280",fontSize:12,marginTop:4}}>{settings?.appSubtitle||""}</p>
          </div>
          <p style={{color:dm?"#9ca3af":"#6b7280",fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:20}}>Sign in to your account</p>
          <div style={{background:dm?"#17171b":"#fff",border:`1.5px solid ${dm?"#26262c":"#e2e1db"}`,borderRadius:20,padding:24,boxShadow:dm?"0 4px 24px rgba(0,0,0,0.4)":"0 4px 20px rgba(0,0,0,0.08)"}}>
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <Inp dm={dm} label="Username" value={u} onChange={e=>setU(e.target.value)} placeholder="e.g. admin" autoComplete="username"/>
              <Inp dm={dm} label="Password" type="password" value={p} onChange={e=>setP(e.target.value)} placeholder="••••••••" autoComplete="current-password" onKeyDown={e=>e.key==="Enter"&&go()}/>
              {err&&<div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:10,padding:"10px 12px"}}>
                <p style={{color:"#ef4444",fontSize:12,fontWeight:600}}>{err}</p>
              </div>}
              <button onClick={go} disabled={busy} style={{background:dm?"#f59e0b":"#18181b",color:dm?"#000":"#fff",border:"none",borderRadius:12,padding:"12px 20px",fontSize:14,fontWeight:700,cursor:busy?"not-allowed":"pointer",opacity:busy?0.6:1,transition:"all 0.15s",letterSpacing:0.2}}>
                {busy?"Signing in…":"Sign In →"}
              </button>
            </div>
          </div>
          {mode==="picker"
            ?<button onClick={()=>setShowAdminForm(false)} style={{color:dm?"#6b7280":"#9ca3af",fontSize:11,fontWeight:600,display:"block",width:"100%",textAlign:"center",marginTop:20,background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>← Back to staff picker</button>
            :<p style={{color:dm?"#6b7280":"#9ca3af",textAlign:"center",fontSize:11,marginTop:20,fontWeight:500}}>Accounts managed by Admin → Settings</p>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ROOT
// ═══════════════════════════════════════════════════════════════
export default function Root(){
  const [dm,setDm]=useState(()=>ls("tas_dm",false));
  const [users,setUsers]=useStore("tas9_users",D_USERS);
  const [settings,setSettings]=useStore("tas10_settings",D_SETTINGS);
  const [sess,setSess]=useState(()=>{const s=ls("tas9_sess",null);return s&&Date.now()-s.loginAt<SESSION_TTL?s:null;});
  useEffect(()=>lsw("tas_dm",dm),[dm]);
  useEffect(()=>{if(sess)lsw("tas9_sess",sess);else lsdel("tas9_sess");},[sess]);
  useEffect(()=>{if(!sess)return;const t=setInterval(()=>{if(Date.now()-sess.loginAt>SESSION_TTL)setSess(null);},30000);return()=>clearInterval(t);},[sess]);
  if(!sess)return <Login users={users} onLogin={setSess} dm={dm} settings={settings}/>;
  return <CRM sess={sess} onLogout={()=>setSess(null)} dm={dm} setDm={setDm} users={users} setUsers={setUsers} settings={settings} setSettings={setSettings}/>;
}

// ═══════════════════════════════════════════════════════════════
//  CRM
// ═══════════════════════════════════════════════════════════════
function CRM({sess,onLogout,dm,setDm,users,setUsers,settings,setSettings}){
  const isAdmin=sess.role==="admin";
  const isFactory=sess.role==="factory";
  const isAgent=sess.role==="agent";
  const userPerms=sess.permissions||ROLE_DEF[sess.role]||ROLE_DEF.agent;
  const t=T(dm);

  // Can this user see prices?
  const canSeePrices = isAdmin || (settings?.showPricesTo||["admin"]).includes(sess.role);
  // Can this user see financial summaries (paid/pending/profit)?
  const canSeeFinancials = isAdmin || (settings?.showFinancialsTo||["admin"]).includes(sess.role);

  const [customers, setCust] =useStore("tas9_cust", D_CUST);
  const [deliveries,setDeliv]=useStore("tas9_deliv",D_DELIV);
  const [supplies,  setSup]  =useStore("tas9_sup",  D_SUP);
  const [expenses,  setExp]  =useStore("tas9_exp",  D_EXP);
  const [products,  setProd] =useStore("tas9_prod", D_PRODS);
  const [actLog,    setAct]  =useStore("tas9_act",  []);
  const [wastage,   setWaste] =useStore("tas9_waste", D_WASTE);
  const [prodTargets, setProdTargets]=useStore("tas9_prodtargets", D_PROD_TARGETS);
  // Agent live locations — stored so admin can see all agents
  const [agentLocs, setAgentLocs]=useStore("tas9_locs",{});
  const [notifs, setNotifs]=useStore("tas9_notifs",[]);
  const [notifOpen, setNotifOpen]=useState(false);
  const unreadNotifs=notifs.filter(n=>!n.read).length;
  function addNotif(title,body,type="info"){
    const n={id:uid(),title,body,type,ts:ts(),read:false};
    setNotifs(p=>[n,...p.slice(0,49)]);
  }
  function markAllRead(){setNotifs(p=>p.map(n=>({...n,read:true})));}
  function delNotif(id){setNotifs(p=>p.filter(n=>n.id!==id));}

  // Firebase handles all sync via useStore — no extra sync needed

  const [tab,setTab]=useState(()=>userPerms[0]||"Deliveries");
  const [srch,setSrch]=useState("");
  const [toast,setToast]=useState(null);
  const [conf,setConf]=useState(null);
  const notify=m=>setToast(m);
  const ask=(msg,yes)=>setConf({msg,yes});

  // Sub-staff: moved up before addLog so displayName is defined when addLog captures it
  // Also supports displayOverride from staff picker mode
  const subStaff=sess.subStaff||[];
  const [activeStaff,setActiveStaff]=useState(()=>sess.displayOverride||( subStaff.length>0?subStaff[0]:sess.name));
  const displayName=sess.displayOverride||( subStaff.length>0?activeStaff:sess.name);

  function addLog(action,detail){
    const e={id:uid(),user:displayName,role:sess.role,action,detail,ts:ts()};
    setAct(p=>[e,...p.slice(0,999)]);
  }

  // ── GPS TRACKING ──────────────────────────────────────────────
  // HOW IT WORKS:
  // 1. Agent taps "Track me" → browser asks for location permission
  // 2. watchPosition() fires every few seconds with updated coordinates
  // 3. Coordinates are saved to tas9_locs[sess.id] in localStorage
  // 4. BroadcastChannel pushes the update to all open tabs instantly
  // 5. On same device: admin tab sees agent location immediately
  // 6. On different devices: requires a real backend (Firebase etc.)
  //    The 4-second poll will pick it up IF both devices share storage
  //    (only works on same browser/device — for true cross-device
  //     you need the Firebase integration I can add separately)
  const [loc,setLoc]=useState(null);
  const [trk,setTrk]=useState(false);
  const wRef=useRef(null);
  function startTrk(){
    if(!navigator.geolocation){notify("Geolocation not supported on this device");return;}
    navigator.geolocation.getCurrentPosition(()=>{},{},{}); // warm up
    setTrk(true);
    wRef.current=navigator.geolocation.watchPosition(
      pos=>{
        const l={lat:pos.coords.latitude,lng:pos.coords.longitude,acc:Math.round(pos.coords.accuracy),at:new Date().toLocaleTimeString("en-IN"),name:sess.name,role:sess.role};
        setLoc(l);
        setAgentLocs(prev=>({...prev,[sess.id]:l}));
      },
      err=>{notify(`Location error: ${err.message}`);setTrk(false);},
      {enableHighAccuracy:true,timeout:15000,maximumAge:5000}
    );
    addLog("Started GPS tracking","Agent location sharing enabled");
  }
  function stopTrk(){if(wRef.current)navigator.geolocation.clearWatch(wRef.current);setTrk(false);setLoc(null);setAgentLocs(prev=>{const n={...prev};delete n[sess.id];return n;});addLog("Stopped GPS tracking","Agent location sharing disabled");}
  useEffect(()=>()=>{if(wRef.current)navigator.geolocation.clearWatch(wRef.current);},[]);

  // Stats
  const activeC=customers.filter(c=>c.active);
  const totalRev=customers.reduce((a,c)=>a+(c.paid||0),0);
  const totalDue=customers.reduce((a,c)=>a+(c.pending||0),0);
  const totalExpOp=expenses.reduce((a,e)=>a+(e.amount||0),0);
  const totalSupC=supplies.reduce((a,s)=>a+(s.cost||0),0);
  const netProfit=totalRev-totalExpOp-totalSupC;
  const pendingD=deliveries.filter(d=>d.status==="Pending");

  const chartData=useMemo(()=>{
    const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return d.toISOString().slice(0,10);}).reverse();
    return days.map(date=>({date:date.slice(5),Revenue:deliveries.filter(d=>d.date===date&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0),Expenses:expenses.filter(e=>e.date===date).reduce((s,e)=>s+(e.amount||0),0)}));
  },[deliveries,expenses]);

  const widgets=settings?.dashWidgets||["stats","chart","pendingDeliveries","outstanding"];
  const q=srch.toLowerCase();
  const fCust=customers.filter(c=>!q||c.name.toLowerCase().includes(q)||c.phone?.includes(q)||c.address?.toLowerCase().includes(q));
  const fDeliv=deliveries.filter(d=>!q||d.customer.toLowerCase().includes(q)||d.date.includes(q)||d.status.toLowerCase().includes(q));
  const fSup=supplies.filter(s=>!q||s.item.toLowerCase().includes(q)||s.supplier?.toLowerCase().includes(q));

  const blkOL=()=>products.reduce((a,p)=>({...a,[p.id]:{qty:0,priceAmount:p.prices?.[0]||0}}),{});
  const blkC=()=>({name:"",phone:"",address:"",lat:"",lng:"",orderLines:blkOL(),paid:0,pending:0,notes:"",active:true,joinDate:today()});
  const blkD=()=>({customer:"",customerId:null,orderLines:blkOL(),date:today(),deliveryDate:"",status:"Pending",notes:"",address:"",lat:0,lng:0,createdBy:sess.name,createdAt:ts(),replacement:{done:false,item:"",reason:"",qty:""}});
  const blkS=()=>({item:"",qty:"",unit:"kg",date:today(),supplier:"",cost:"",notes:""});
  const blkE=()=>({category:settings?.expenseCategories?.[0]||"Gas",amount:"",date:today(),notes:"",receipt:""});
  const blkP=()=>({id:"",name:"",unit:"pcs",prices:[5,6]});
  const blkU=()=>({username:"",password:"",name:"",role:"agent",active:true,permissions:[...ROLE_DEF.agent]});
  const blkW=useCallback(()=>({product:"",qty:"",unit:(settings?.supplyUnits||["pcs"])[0]||"pcs",type:(settings?.wastageTypes||["Other"])[0]||"Other",reason:"",cost:"",date:today(),shift:(settings?.shifts||["Morning"])[0]||"Morning",loggedBy:displayName}),[settings,displayName]);

  const [cSh,setCsh]=useState(null); const [cF,setCf]=useState(blkC());
  const [cView,setCView]=useState(null);
  const [dSh,setDsh]=useState(null); const [dF,setDf]=useState(blkD());
  const [sSh,setSsh]=useState(null); const [sF,setSf]=useState(blkS());
  const [eSh,setEsh]=useState(null); const [eF,setEf]=useState(blkE());
  const [pSh,setPsh]=useState(null); const [pF,setPf]=useState(blkP());
  const [uSh,setUsh]=useState(null); const [uF,setUf]=useState(blkU());
  const [paySh,setPaySh]=useState(null); const [payAmt,setPayAmt]=useState("");
  const [wSh,setWSh]=useState(null); const [wF,setWF]=useState(blkW());
  const [delivCalendar,setDelivCalendar]=useState(false);
  const [calOffset,setCalOffset]=useState(0);
  const [lastSync,setLastSync]=useState(null);
  useEffect(()=>{const fn=ts=>{setLastSync(ts);};_syncListeners.add(fn);return()=>_syncListeners.delete(fn);},[]);
  const [ptSh,setPtSh]=useState(null);
  const [ptF,setPtF]=useState(()=>({date:today(),shift:"Morning",product:"",target:0,actual:0,notes:""}));
  const [ptDateFilter,setPtDateFilter]=useState("today");
  const [showMoreNav,setShowMoreNav]=useState(false);
  const [changePwSh,setChangePwSh]=useState(false);
  const [changePwF,setChangePwF]=useState({current:"",next:"",confirm:""});
  const [settingsSection,setSettingsSection]=useState("account");

  // CUSTOMERS
  function saveC(){if(!cF.name.trim()){notify("Name required");return;}const rec={...cF,paid:+cF.paid||0,pending:+cF.pending||0};if(cSh==="add"){setCust(p=>[...p,{...rec,id:uid()}]);addLog("Added customer",rec.name);notify("Customer added ✓");addNotif("Customer Added",`${rec.name} has been added`,"success");}else{setCust(p=>p.map(c=>c.id===cSh.id?{...rec,id:c.id}:c));addLog("Edited customer",rec.name);notify("Updated ✓");}setCsh(null);}
  function delC(c){ask(`Delete "${c.name}"?`,()=>{setCust(p=>p.filter(x=>x.id!==c.id));addLog("Deleted customer",c.name);notify("Deleted");});}
  function togActive(c){setCust(p=>p.map(x=>x.id===c.id?{...x,active:!x.active}:x));addLog(`${c.active?"Deactivated":"Activated"} customer`,c.name);notify("Updated");}
  function recPay(){const a=+payAmt;if(!a||!paySh)return;setCust(p=>p.map(c=>c.id===paySh.id?{...c,paid:c.paid+a,pending:Math.max(0,c.pending-a)}:c));addLog("Payment recorded",`${paySh.name} — ${inr(a)}`);notify(`${inr(a)} recorded`);addNotif("Payment Recorded",`${inr(a)} received from ${paySh.name}`,"success");setPaySh(null);setPayAmt("");}

  // DELIVERIES
  function pickCust(name){const c=customers.find(x=>x.name===name);setDf(f=>({...f,customer:name,customerId:c?.id||null,address:c?.address||"",lat:c?.lat||0,lng:c?.lng||0,orderLines:c?.orderLines?{...c.orderLines}:blkOL()}));}
  function saveD(){
    if(!dF.customer){notify("Select a customer");return;}
    // If replacement has an amount, deduct it from customer's pending balance
    const replAmt = +dF.replacement?.amount||0;
    if(replAmt>0 && dF.customerId){
      setCust(p=>p.map(c=>c.id===dF.customerId?{...c,pending:Math.max(0,c.pending-replAmt)}:c));
      addLog("Replacement deduction",`${dF.customer} — ${inr(replAmt)} off pending`);
    }
    if(dSh==="add"){setDeliv(p=>[...p,{...dF,id:uid()}]);addLog("Added delivery",dF.customer);notify("Delivery added ✓");addNotif("Delivery Added",`New delivery for ${dF.customer}`,"success");}
    else{setDeliv(p=>p.map(d=>d.id===dSh.id?{...dF,id:d.id}:d));addLog("Edited delivery",dF.customer);notify("Updated ✓");}
    setDsh(null);
  }
  function tglD(d){const ns=d.status==="Pending"?"Delivered":"Pending";setDeliv(p=>p.map(x=>x.id===d.id?{...x,status:ns}:x));addLog("Status changed",`${d.customer} → ${ns}`);notify("Updated");if(ns==="Delivered")addNotif("Delivery Completed",`${d.customer} marked as Delivered`,"success");}
  function delD(d){ask(`Delete delivery for "${d.customer}"?`,()=>{setDeliv(p=>p.filter(x=>x.id!==d.id));addLog("Deleted delivery",d.customer);notify("Deleted");});}

  // SUPPLIES
  function saveS(){if(!sF.item.trim()){notify("Item required");return;}const rec={...sF,qty:+sF.qty||0,cost:+sF.cost||0};if(sSh==="add"){setSup(p=>[...p,{...rec,id:uid()}]);addLog("Added supply",sF.item);notify("Supply logged ✓");}else{setSup(p=>p.map(s=>s.id===sSh.id?{...rec,id:s.id}:s));addLog("Edited supply",sF.item);notify("Updated ✓");}setSsh(null);}
  function delS(s){ask(`Delete supply "${s.item}"?`,()=>{setSup(p=>p.filter(x=>x.id!==s.id));addLog("Deleted supply",s.item);notify("Deleted");});}

  // EXPENSES
  function saveE(){if(!eF.amount){notify("Amount required");return;}
    if(eSh==="add"){setExp(p=>[...p,{...eF,id:uid(),amount:+eF.amount}]);addLog("Added expense",`${eF.category} ${inr(eF.amount)}`);notify("Expense logged ✓");}
    else{setExp(p=>p.map(x=>x.id===eSh.id?{...eF,id:x.id,amount:+eF.amount}:x));addLog("Edited expense",`${eF.category} ${inr(eF.amount)}`);notify("Updated ✓");}
    setEsh(null);}
  function delE(e){ask(`Delete "${e.category} ${inr(e.amount)}"?`,()=>{setExp(p=>p.filter(x=>x.id!==e.id));addLog("Deleted expense",`${e.category} ${inr(e.amount)}`);notify("Deleted");});}

  // WASTAGE
  function saveW(){
    if(!wF.product.trim()||!wF.qty){notify("Product and quantity required");return;}
    const rec={...wF,qty:+wF.qty||0,cost:+wF.cost||0,loggedBy:sess.name};
    if(wSh==="add"){setWaste(p=>[{...rec,id:uid(),createdAt:ts()},...p]);addLog("Logged wastage",`${rec.qty} ${rec.unit} ${rec.product} — ${rec.type}`);notify("Wastage logged ✓");}
    else{setWaste(p=>p.map(x=>x.id===wSh.id?{...rec,id:x.id,createdAt:x.createdAt}:x));addLog("Edited wastage",`${rec.product} ${rec.qty} ${rec.unit}`);notify("Updated ✓");}
    setWSh(null);
  }
  function delW(w){ask(`Delete wastage record for "${w.product}"?`,()=>{setWaste(p=>p.filter(x=>x.id!==w.id));addLog("Deleted wastage",`${w.product} ${w.qty} ${w.unit}`);notify("Deleted");});}

  // PRODUCTION TARGETS
  function savePT(){
    if(!ptF.product.trim()){notify("Product required");return;}
    const rec={...ptF,target:+ptF.target||0,actual:+ptF.actual||0};
    if(ptSh==="add"){setProdTargets(p=>[{...rec,id:uid(),createdAt:ts()},...p]);addLog("Production target set",`${rec.product} — ${rec.shift} ${rec.date}`);notify("Target saved ✓");}
    else{setProdTargets(p=>p.map(x=>x.id===ptSh.id?{...rec,id:x.id,createdAt:x.createdAt}:x));addLog("Production target updated",`${rec.product}`);notify("Updated ✓");}
    setPtSh(null);
  }
  function delPT(pt){ask(`Delete production record?`,()=>{setProdTargets(p=>p.filter(x=>x.id!==pt.id));addLog("Deleted production record",`${pt.product} ${pt.date}`);notify("Deleted");});}

  // PRODUCTS
  function saveP(){if(!pF.name.trim()||!pF.id.trim()){notify("Name and ID required");return;}const rec={...pF,id:pF.id.toLowerCase().replace(/\s+/g,""),prices:pF.prices.map(x=>+x||0).filter(x=>x>0)};if(!rec.prices.length){notify("Add at least one price");return;}if(pSh==="add"){if(products.find(p=>p.id===rec.id)){notify("ID exists");return;}setProd(p=>[...p,rec]);addLog("Added product",rec.name);notify("Product added ✓");}else{setProd(p=>p.map(x=>x.id===pSh.id?rec:x));addLog("Edited product",rec.name);notify("Updated ✓");}setPsh(null);}
  function delP(p){ask(`Delete product "${p.name}"?`,()=>{setProd(prev=>prev.filter(x=>x.id!==p.id));addLog("Deleted product",p.name);notify("Deleted");});}

  // USERS
  function saveU(){
    if(!uF.username.trim()){notify("Username required");return;}
    if(uSh==="add"&&uF.password.length<6){notify("Password min 6 chars");return;}
    const isEdit=uSh!=="add";
    const orig=isEdit?users.find(x=>x.id===uSh.id):null;
    const pw=isEdit&&!uF.password?orig.password:hashPw(uF.password);
    const perms=uF.role==="admin"?ROLE_DEF.admin:(uF.permissions||ROLE_DEF[uF.role]||ROLE_DEF.agent);
    const rec={...uF,password:pw,permissions:perms};
    if(uSh==="add"){if(users.find(x=>x.username===rec.username)){notify("Username exists");return;}setUsers(p=>[...p,{...rec,id:uid(),createdAt:today()}]);addLog("Created user",`@${rec.username} (${rec.role})`);notify("User created ✓");}
    else{setUsers(p=>p.map(x=>x.id===uSh.id?{...rec,id:x.id}:x));addLog("Edited user",`@${rec.username}`);notify("Updated ✓");}
    setUsh(null);
  }
  function delU(u){if(u.id===sess.id){notify("Cannot delete your own account");return;}if(u.role==="admin"&&users.filter(x=>x.role==="admin"&&x.active).length<=1){notify("Cannot remove last admin");return;}ask(`Delete user "@${u.username}"?`,()=>{setUsers(p=>p.filter(x=>x.id!==u.id));addLog("Deleted user",`@${u.username}`);notify("Deleted");});}

  // EXPORT/IMPORT
  function exportAll(){const d={customers,deliveries,supplies,expenses,products,users,actLog,wastage,at:new Date().toISOString()};const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:"application/json"}));a.download=`tas_backup_${today()}.json`;a.click();URL.revokeObjectURL(a.href);addLog("Exported backup","Full JSON");notify("Exported ✓");}
  function exportFullReport(){
    const co=settings?.companyName||"TAS Healthy World";
    const now=new Date().toLocaleString("en-IN");
    const totalReplAmt=deliveries.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
    const totalWasteQty=(wastage||[]).reduce((s,w)=>s+(w.qty||0),0);
    const totalWasteCost=(wastage||[]).reduce((s,w)=>s+(w.cost||0),0);
    const delivWithRepl=deliveries.filter(d=>d.replacement?.done);
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Full Report — ${co}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;color:#1c1917;padding:32px;max-width:900px;margin:0 auto}
h1{font-size:22px;font-weight:900;color:#92400e;margin-bottom:4px}
.sub{font-size:11px;color:#78716c;margin-bottom:28px}
h2{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#a8a29e;margin:28px 0 10px;padding-bottom:6px;border-bottom:2px solid #e7e5e4}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:8px}
.stat{background:#f5f5f4;border-radius:10px;padding:14px}.stat .val{font-size:20px;font-weight:900;color:#1c1917}.stat .lbl{font-size:10px;color:#78716c;text-transform:uppercase;letter-spacing:.5px;margin-top:3px}
table{width:100%;border-collapse:collapse;margin-top:4px}th{font-size:9px;text-transform:uppercase;color:#a8a29e;padding:6px 0;border-bottom:2px solid #e7e5e4;text-align:left}td{padding:7px 0;border-bottom:1px solid #f5f5f4;font-size:11px}
.green{color:#059669}.red{color:#dc2626}.amber{color:#d97706}.orange{color:#ea580c}
.badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:9px;font-weight:700}
.bg{background:#d1fae5;color:#065f46}.by{background:#fef3c7;color:#92400e}.bb{background:#dbeafe;color:#1e40af}.bo{background:#ffedd5;color:#9a3412}
.footer{margin-top:36px;text-align:center;font-size:10px;color:#a8a29e;padding-top:16px;border-top:1px solid #e7e5e4}
@media print{@page{margin:1.5cm}}</style></head><body>
<h1>🫓 ${co} — Full Operations Report</h1>
<div class="sub">Generated ${now} · Period: All time</div>

<h2>Financial Summary</h2>
<div class="grid">
  <div class="stat"><div class="val green">₹${totalRev.toLocaleString("en-IN")}</div><div class="lbl">Total Revenue</div></div>
  <div class="stat"><div class="val red">₹${(totalExpOp+totalSupC).toLocaleString("en-IN")}</div><div class="lbl">Total Costs</div></div>
  <div class="stat"><div class="val ${netProfit>=0?"green":"red"}">₹${netProfit.toLocaleString("en-IN")}</div><div class="lbl">Net Profit</div></div>
  <div class="stat"><div class="val red">₹${totalDue.toLocaleString("en-IN")}</div><div class="lbl">Outstanding Dues</div></div>
  <div class="stat"><div class="val amber">₹${totalSupC.toLocaleString("en-IN")}</div><div class="lbl">Supply Costs</div></div>
  <div class="stat"><div class="val red">₹${totalExpOp.toLocaleString("en-IN")}</div><div class="lbl">Operating Expenses</div></div>
</div>

<h2>Customers (${customers.length} total · ${activeC.length} active)</h2>
<table><tr><th>Name</th><th>Phone</th><th>Address</th><th>Paid</th><th>Pending</th><th>Status</th><th>Since</th></tr>
${customers.map(c=>`<tr><td><b>${c.name}</b></td><td>${c.phone||"—"}</td><td>${c.address||"—"}</td><td class="green">₹${(c.paid||0).toLocaleString("en-IN")}</td><td class="${(c.pending||0)>0?"red":"green"}">₹${(c.pending||0).toLocaleString("en-IN")}</td><td><span class="badge ${(c.pending||0)>0?"by":"bg"}">${(c.pending||0)>0?"UNPAID":"PAID"}</span></td><td>${c.joinDate||"—"}</td></tr>`).join("")}
</table>

<h2>Deliveries (${deliveries.length} total · ${deliveries.filter(d=>d.status==="Delivered").length} delivered · ${deliveries.filter(d=>d.status==="Pending").length} pending)</h2>
<table><tr><th>Customer</th><th>Date</th><th>Status</th><th>Amount</th><th>Replacement</th><th>By</th></tr>
${deliveries.map(d=>`<tr><td><b>${d.customer}</b></td><td>${d.date}</td><td><span class="badge ${d.status==="Delivered"?"bg":d.status==="In Transit"?"bb":"by"}">${d.status}</span></td><td>₹${lineTotal(d.orderLines).toLocaleString("en-IN")}</td><td>${d.replacement?.done?`<span class="badge bo">🔄 ${d.replacement.item||"Done"}${d.replacement.amount?` −₹${d.replacement.amount}`:""}</span>`:"—"}</td><td>${d.createdBy||"—"}</td></tr>`).join("")}
</table>

${delivWithRepl.length>0?`<h2>Replacements Summary (${delivWithRepl.length} replacements · ₹${totalReplAmt.toLocaleString("en-IN")} deducted)</h2>
<table><tr><th>Customer</th><th>Date</th><th>Item Replaced</th><th>Qty</th><th>Amount Deducted</th><th>Reason</th></tr>
${delivWithRepl.map(d=>`<tr><td>${d.customer}</td><td>${d.date}</td><td>${d.replacement.item||"—"}</td><td>${d.replacement.qty||"—"}</td><td class="orange">${d.replacement.amount?`₹${d.replacement.amount}`:"—"}</td><td>${d.replacement.reason||"—"}</td></tr>`).join("")}
</table>`:""}

<h2>Supplies (${supplies.length} items · ₹${totalSupC.toLocaleString("en-IN")} total cost)</h2>
<table><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Supplier</th><th>Cost</th><th>Date</th></tr>
${supplies.map(s=>`<tr><td>${s.item}</td><td>${s.qty}</td><td>${s.unit}</td><td>${s.supplier||"—"}</td><td class="red">₹${(s.cost||0).toLocaleString("en-IN")}</td><td>${s.date}</td></tr>`).join("")}
</table>

<h2>Expenses (${expenses.length} entries · ₹${totalExpOp.toLocaleString("en-IN")} total)</h2>
<table><tr><th>Category</th><th>Amount</th><th>Date</th><th>Notes</th></tr>
${expenses.map(e=>`<tr><td>${e.category}</td><td class="red">₹${(e.amount||0).toLocaleString("en-IN")}</td><td>${e.date}</td><td>${e.notes||"—"}</td></tr>`).join("")}
</table>

${(wastage&&wastage.length>0)?`<h2>Wastage (${wastage.length} records · ${totalWasteQty} units · ₹${totalWasteCost.toLocaleString("en-IN")} cost)</h2>
<table><tr><th>Product</th><th>Type</th><th>Qty</th><th>Unit</th><th>Cost Loss</th><th>Shift</th><th>Date</th><th>Logged By</th></tr>
${wastage.map(w=>`<tr><td>${w.product}</td><td>${w.type}</td><td>${w.qty}</td><td>${w.unit}</td><td class="red">${w.cost?`₹${w.cost}`:"—"}</td><td>${w.shift||"—"}</td><td>${w.date}</td><td>${w.loggedBy||"—"}</td></tr>`).join("")}
</table>`:""}

<div class="footer">${co} · Full Operations Report · Generated ${now} · TAS CRM</div>
<script>window.addEventListener("load",function(){window.print();});</script>
</body></html>`;
    const rblob=new Blob([html],{type:"text/html;charset=utf-8"});
    const rurl=URL.createObjectURL(rblob);
    const ra=document.createElement("a"); ra.href=rurl; ra.target="_blank"; ra.rel="noopener";
    document.body.appendChild(ra); ra.click();
    setTimeout(()=>{document.body.removeChild(ra);URL.revokeObjectURL(rurl);},1000);
    addLog("Exported full report","PDF report generated");
    notify("Report opening…");
  }

  function importAll(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{try{const d=JSON.parse(ev.target.result);if(d.customers)setCust(d.customers);if(d.deliveries)setDeliv(d.deliveries);if(d.supplies)setSup(d.supplies);if(d.expenses)setExp(d.expenses);if(d.products)setProd(d.products);if(d.users)setUsers(d.users);if(d.wastage)setWaste(d.wastage);addLog("Imported backup","Full restore");notify("Imported ✓");}catch{notify("Invalid backup file");}};r.readAsText(f);e.target.value="";}

  const TABS=isAdmin?ALL_TABS:ALL_TABS.filter(tb=>userPerms.includes(tb));
  const expCats=settings?.expenseCategories||["Gas","Labour","Transport","Packaging","Utilities","Maintenance","Other"];
  const delivStats=settings?.deliveryStatuses||["Pending","In Transit","Delivered","Cancelled"];
  const supUnits=settings?.supplyUnits||["kg","g","L","mL","pcs","bags","boxes","dozen"];

  // Active agent locations for admin
  const activeAgents=Object.values(safeO(agentLocs)).filter(l=>l&&l.lat);

  // Tab icons for nav
  const TAB_ICONS={"Dashboard":"📊","Customers":"👥","Deliveries":"🚚","Supplies":"📦","Expenses":"💸","Wastage":"🗑️","P&L":"📈","Analytics":"🔍","Production":"🏭","Settings":"⚙️"};

  // ═══════════════════════════════════════════════════════════════
  return (
    <>
    <div style={{background:t.bg,minHeight:"100dvh",fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif"}} className="flex flex-col lg:flex-row">

      {/* ── DESKTOP SIDEBAR (lg+) ─────────────────────────────── */}
      <aside style={{background:t.sidebar,borderRight:`1px solid ${t.sidebarBorder}`,width:236,minHeight:"100vh"}} className="hidden lg:flex flex-col shrink-0 sticky top-0 h-screen overflow-y-auto">
        {/* Logo */}
        <div style={{borderBottom:`1px solid ${t.sidebarBorder}`}} className="px-5 py-5 flex items-center gap-3">
          <div style={{background:"rgba(245,158,11,0.15)",border:"1px solid rgba(245,158,11,0.25)"}} className="w-9 h-9 rounded-xl flex items-center justify-center text-lg select-none shrink-0">{settings?.appEmoji||"🫓"}</div>
          <div className="min-w-0">
            <p style={{color:t.sidebarText}} className="font-black text-sm leading-tight truncate">{settings?.appName||"TAS Healthy World"}</p>
            <p style={{color:t.sidebarSub}} className="text-[10px] truncate mt-0.5">{settings?.appSubtitle||""}</p>
          </div>
        </div>
        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          {TABS.map(tb=>(
            <button key={tb} onClick={()=>{setTab(tb);setSrch("");}}
              style={tab===tb
                ?{background:t.sidebarActiveBg,color:t.sidebarActive,borderLeft:`3px solid ${t.sidebarActive}`}
                :{color:t.sidebarSub,borderLeft:"3px solid transparent"}}
              className="flex items-center gap-3 px-3 py-2.5 rounded-r-xl text-sm transition-all hover:bg-white/5 text-left w-full">
              <span className="text-base w-5 text-center shrink-0 leading-none">{TAB_ICONS[tb]||"•"}</span>
              <span className="truncate font-medium">{tb}</span>
              {tb==="Dashboard"&&pendingD.length>0&&tab!=="Dashboard"&&<span className="ml-auto text-[10px] font-black bg-amber-500 text-black rounded-full w-4 h-4 flex items-center justify-center shrink-0">{pendingD.length}</span>}
            </button>
          ))}
        </nav>
        {/* Sidebar footer */}
        <div style={{borderTop:`1px solid ${t.sidebarBorder}`}} className="px-3 py-4 flex flex-col gap-3">
          {/* Staff picker dropdown in sidebar */}
          {subStaff.length>0&&(
            <select value={activeStaff} onChange={e=>setActiveStaff(e.target.value)}
              style={{background:"rgba(255,255,255,0.06)",border:`1px solid ${t.sidebarBorder}`,color:t.sidebarText,fontSize:12,width:"100%",borderRadius:10,padding:"7px 10px",outline:"none"}}>
              {subStaff.map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          )}
          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:12,padding:"10px 12px"}} className="flex items-center gap-2.5">
            <div style={{background:"rgba(245,158,11,0.2)",border:"1px solid rgba(245,158,11,0.3)",color:"#f59e0b"}} className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shrink-0">{displayName[0]?.toUpperCase()}</div>
            <div className="flex-1 min-w-0">
              <p style={{color:t.sidebarText}} className="text-xs font-bold truncate leading-tight">{displayName}</p>
              <p style={{color:t.sidebarSub}} className="text-[10px] truncate capitalize mt-0.5">{sess.role}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>setDm(d=>!d)} style={{background:"rgba(255,255,255,0.06)",color:t.sidebarSub,border:`1px solid ${t.sidebarBorder}`,flex:1}} className="text-xs py-2 rounded-xl font-semibold hover:bg-white/10 transition-colors">{dm?"☀️ Light":"🌙 Dark"}</button>
            <button onClick={onLogout} style={{background:"rgba(255,255,255,0.06)",color:t.sidebarSub,border:`1px solid ${t.sidebarBorder}`,flex:1}} className="text-xs py-2 rounded-xl font-semibold hover:bg-white/10 transition-colors">↩ Sign out</button>
          </div>
          <div className="flex items-center gap-1.5 px-1">
            <div style={{width:6,height:6,borderRadius:"50%",background:lastSync?"#10b981":"#f59e0b",flexShrink:0,boxShadow:lastSync?"0 0 6px #10b98188":"0 0 6px #f59e0b88"}}/>
            <p style={{color:"rgba(255,255,255,0.3)"}} className="text-[10px]">{lastSync?`Synced ${lastSync.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}`:"Connecting…"}</p>
          </div>
        </div>
      </aside>

      {/* ── MOBILE / TABLET MAIN AREA ─────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-0">

      {/* HEADER — shown on mobile/tablet only (hidden on lg desktop where sidebar takes over) */}
      <header style={{background:t.card,borderBottom:`1px solid ${t.border}`}} className="sticky top-0 z-30">
        <div className="px-4 py-3 flex items-center justify-between lg:px-6">
          <div className="flex items-center gap-2.5 lg:hidden">
            <div style={{background:"rgba(217,119,6,0.1)",border:"1px solid rgba(217,119,6,0.2)"}} className="w-8 h-8 rounded-xl flex items-center justify-center text-base select-none shrink-0">{settings?.appEmoji||"🫓"}</div>
            <div>
              <p style={{color:t.text}} className="font-bold text-sm leading-tight">{settings?.appName||"TAS Healthy World"}</p>
              {subStaff.length>0
                ?<div className="flex items-center gap-1 mt-0.5">
                  <select value={activeStaff} onChange={e=>setActiveStaff(e.target.value)}
                    style={{background:"transparent",color:t.sub,border:"none",outline:"none",fontSize:11,fontWeight:600,padding:0,cursor:"pointer",maxWidth:120}}>
                    {subStaff.map(n=><option key={n} value={n}>{n}</option>)}
                  </select>
                  <span style={{color:t.sub}} className="text-[10px]">· {sess.role}</span>
                </div>
                :<p style={{color:t.sub}} className="text-[11px] font-medium">{sess.name} · <span className="capitalize">{sess.role}</span></p>
              }
            </div>
          </div>
          {/* Desktop header shows page title */}
          <div className="hidden lg:flex items-center gap-2.5">
            <span className="text-xl">{TAB_ICONS[tab]||"•"}</span>
            <h1 style={{color:t.text}} className="font-black text-xl tracking-tight">{tab}</h1>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {isAgent&&(trk
              ?<button onClick={stopTrk} className="text-[11px] px-3 py-1.5 rounded-xl bg-emerald-500 text-white font-semibold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"/>Live</button>
              :<button onClick={startTrk} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`}} className="text-[11px] px-3 py-1.5 rounded-xl font-semibold">📍 Track</button>
            )}
            {isAdmin&&activeAgents.length>0&&(
              <a href={mapU("",activeAgents[0].lat,activeAgents[0].lng)} target="_blank" rel="noopener noreferrer"
                className="text-[11px] px-3 py-1.5 rounded-xl bg-sky-500 text-white font-semibold hidden sm:inline-flex items-center gap-1">🗺 {activeAgents.length} online</a>
            )}
            {/* BELL */}
            <div className="relative">
              <button onClick={()=>{setNotifOpen(o=>!o);if(unreadNotifs>0)markAllRead();}} style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`}} className="w-9 h-9 rounded-xl flex items-center justify-center text-[15px] select-none relative transition-colors hover:opacity-80">
                🔔
                {unreadNotifs>0&&<span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2" style={{borderColor:t.card}}>{unreadNotifs>9?"9+":unreadNotifs}</span>}
              </button>
              {notifOpen&&<div style={{background:t.card,border:`1px solid ${t.border}`,zIndex:200,boxShadow:"0 20px 40px rgba(0,0,0,0.2)"}} className="absolute right-0 top-11 w-80 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3" style={{borderBottom:`1px solid ${t.border}`}}>
                  <span style={{color:t.text}} className="text-sm font-bold tracking-tight">Notifications</span>
                  <div className="flex gap-3">
                    {notifs.length>0&&<button onClick={()=>setNotifs([])} style={{color:t.sub}} className="text-[11px] font-semibold hover:opacity-70">Clear all</button>}
                    <button onClick={()=>setNotifOpen(false)} style={{color:t.sub}} className="text-[11px] font-bold hover:opacity-70">✕</button>
                  </div>
                </div>
                <div style={{maxHeight:320,overflowY:"auto"}}>
                  {notifs.length===0
                    ?<div className="py-8 flex flex-col items-center gap-2"><span className="text-2xl">🔔</span><p style={{color:t.sub}} className="text-xs font-medium">All caught up!</p></div>
                    :notifs.map(n=>(
                    <div key={n.id} style={{background:n.read?t.card:dm?"#1e1a0e":"#fffbeb",borderBottom:`1px solid ${t.border}`}} className="px-4 py-3 flex gap-3">
                      <span className="text-base mt-0.5 shrink-0">{n.type==="success"?"✅":n.type==="warning"?"⚠️":n.type==="error"?"❌":"ℹ️"}</span>
                      <div className="flex-1 min-w-0">
                        <p style={{color:t.text}} className="text-xs font-semibold">{n.title}</p>
                        <p style={{color:t.sub}} className="text-[11px] mt-0.5 leading-relaxed">{n.body}</p>
                        <p style={{color:t.sub}} className="text-[10px] mt-1 font-medium">{n.ts}</p>
                      </div>
                      <button onClick={()=>delNotif(n.id)} style={{color:t.sub}} className="text-xs shrink-0 hover:opacity-70">✕</button>
                    </div>
                  ))}
                </div>
              </div>}
            </div>
            <button onClick={()=>setDm(d=>!d)} style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`}} className="w-9 h-9 rounded-xl flex items-center justify-center text-[15px] select-none lg:hidden hover:opacity-80">{dm?"☀️":"🌙"}</button>
            <button onClick={onLogout} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`}} className="text-[11px] px-3 py-1.5 rounded-xl font-semibold hidden sm:inline-flex hover:opacity-80">↩ Sign out</button>
            <button onClick={()=>setDm(d=>!d)} style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`}} className="w-9 h-9 rounded-xl items-center justify-center text-[15px] select-none hidden lg:flex hover:opacity-80">{dm?"☀️":"🌙"}</button>
          </div>
        </div>
        {/* Mobile tab scrollbar */}
        <div className="px-4 pb-3 flex gap-1.5 overflow-x-auto scrollbar-none lg:hidden" style={{scrollbarWidth:"none"}}>
          {TABS.map(tb=>(
            <button key={tb} onClick={()=>{setTab(tb);setSrch("");}}
              style={tab===tb?{background:t.accent,color:t.accentFg}:{color:t.sub,background:t.inp,border:`1px solid ${t.border}`}}
              className="whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex-shrink-0">{TAB_ICONS[tb]} {tb}</button>
          ))}
        </div>
      </header>

      {/* Agent GPS bar */}
      {isAgent&&trk&&loc&&(
        <div className="max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 lg:px-6 pt-3">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-4 py-2.5 flex justify-between items-center">
            <div>
              <p className="text-xs font-semibold text-emerald-500">📍 Sharing location · {loc.at} · ±{loc.acc}m</p>
              <p className="text-[11px] text-emerald-400">{loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}</p>
            </div>
            <a href={mapU("",loc.lat,loc.lng)} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-500 font-semibold underline">Open Maps</a>
          </div>
        </div>
      )}

      {/* Admin: active agent locations */}
      {isAdmin&&activeAgents.length>0&&(
        <div className="max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 lg:px-6 pt-3">
          <div className="bg-sky-500/10 border border-sky-500/30 rounded-2xl px-4 py-2.5">
            <p className="text-xs font-semibold text-sky-500 mb-1">🗺 Live Agent Locations</p>
            {activeAgents.map((l,i)=>(
              <div key={i} className="flex justify-between items-center py-1">
                <span style={{color:t.sub}} className="text-xs">{l.name} — {l.at} · ±{l.acc}m</span>
                <a href={mapU("",l.lat,l.lng)} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-500 font-semibold underline">Maps</a>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 lg:px-6 py-4 flex flex-col gap-3">

        {/* DASHBOARD */}
        {tab==="Dashboard"&&(<>
          {/* TODAY SUMMARY HERO BANNER */}
          {(()=>{
            const todayStr=today();
            const todayD=deliveries.filter(d=>d.date===todayStr);
            const todayDel=todayD.filter(d=>d.status==="Delivered");
            const todayPend=todayD.filter(d=>d.status==="Pending");
            const todayRev=todayDel.reduce((s,d)=>s+lineTotal(d.orderLines),0);
            const todayRepl=todayD.filter(d=>d.replacement?.done).length;
            const delivRate=todayD.length>0?Math.round(todayDel.length/todayD.length*100):0;
            return <div style={{background:dm?"linear-gradient(135deg,#1c1500,#1a1a22)":"linear-gradient(135deg,#fffbeb,#fef9ef)",border:dm?"1px solid #3a2e00":"1px solid #fde68a",borderRadius:20,padding:"18px 20px"}}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">📅 Today</p>
                  <p style={{color:t.text}} className="font-black text-base">{new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}</p>
                </div>
                {todayD.length>0&&<div className="text-right">
                  <p style={{color:delivRate>=80?"#10b981":delivRate>=50?"#f59e0b":"#ef4444"}} className="text-2xl font-black">{delivRate}%</p>
                  <p style={{color:t.sub}} className="text-[10px] font-semibold">delivery rate</p>
                </div>}
              </div>
              {todayD.length===0
                ?<p style={{color:t.sub}} className="text-sm">No orders scheduled today.</p>
                :<div className="grid grid-cols-4 gap-3">
                  {(canSeeFinancials
                    ?[{label:"Orders",val:todayD.length,color:t.text,icon:"📋"},{label:"Delivered",val:todayDel.length,color:"#10b981",icon:"✅"},{label:"Pending",val:todayPend.length,color:"#f59e0b",icon:"⏳"},{label:"Revenue",val:inr(todayRev),color:"#10b981",icon:"💰"}]
                    :[{label:"Orders",val:todayD.length,color:t.text,icon:"📋"},{label:"Delivered",val:todayDel.length,color:"#10b981",icon:"✅"},{label:"Pending",val:todayPend.length,color:"#f59e0b",icon:"⏳"},{label:"Replaced",val:todayRepl,color:"#f97316",icon:"🔄"}]
                  ).map(x=><div key={x.label} className="text-center">
                    <p style={{color:x.color}} className="font-black text-xl leading-none">{x.val}</p>
                    <p style={{color:t.sub}} className="text-[10px] font-semibold mt-1">{x.label}</p>
                  </div>)}
                </div>}
              {/* Delivery progress bar */}
              {todayD.length>0&&<div className="mt-3">
                <div style={{background:dm?"#2a2a00":"#fde68a",height:6,borderRadius:6,overflow:"hidden"}}>
                  <div style={{width:`${delivRate}%`,background:delivRate>=80?"#10b981":delivRate>=50?"#f59e0b":"#ef4444",height:"100%",borderRadius:6,transition:"width 0.8s ease"}}/>
                </div>
              </div>}
            </div>;
          })()}

          {/* STAT CARDS */}
          {widgets.includes("stats")&&<>
            {canSeeFinancials&&<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard dm={dm} label="Total Revenue" value={inr(totalRev)} sub="From delivered orders" accent="#10b981"/>
              <StatCard dm={dm} label="Amount Due" value={inr(totalDue)} sub={`${customers.filter(c=>c.pending>0).length} customers`} accent="#ef4444"/>
              <StatCard dm={dm} label="Total Costs" value={inr(totalExpOp+totalSupC)} sub="Ops + supplies" accent="#f59e0b"/>
              <StatCard dm={dm} label="Net Profit" value={inr(netProfit)} sub={netProfit>=0?"Profitable ✓":"In loss ⚠️"} accent={netProfit>=0?"#10b981":"#ef4444"}/>
            </div>}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard dm={dm} label="Active Customers" value={activeC.length} sub={`${customers.length - activeC.length} inactive`} accent="#d97706"/>
              <StatCard dm={dm} label="Pending Deliveries" value={pendingD.length} sub={`${deliveries.filter(d=>d.status==="Delivered").length} completed`} accent="#8b5cf6"/>
              {(()=>{const r=deliveries.filter(d=>d.replacement?.done);return r.length>0&&<><StatCard dm={dm} label="Replacements" value={r.length} sub={`${Math.round(r.length/Math.max(deliveries.length,1)*100)}% of deliveries`} accent="#f97316"/><StatCard dm={dm} label="Repl. Deductions" value={inr(r.reduce((s,d)=>s+(+d.replacement?.amount||0),0))} sub="Total deducted" accent="#ef4444"/></>;})()}
            </div>
          </>}

          {/* REVENUE CHART */}
          {widgets.includes("chart")&&canSeeFinancials&&<Card dm={dm} className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p style={{color:t.text}} className="font-bold text-sm">Revenue vs Expenses</p>
                <p style={{color:t.sub}} className="text-[11px]">Last 7 days</p>
              </div>
              <div className="flex gap-3">
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"/><span style={{color:t.sub}} className="text-[11px]">Revenue</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500"/><span style={{color:t.sub}} className="text-[11px]">Expenses</span></div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{top:0,right:0,left:-20,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.border}/>
                <XAxis dataKey="date" tick={{fontSize:10,fill:t.sub}}/>
                <YAxis tick={{fontSize:10,fill:t.sub}}/>
                <Tooltip contentStyle={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,color:t.text,fontSize:12}} formatter={(v)=>inr(v)}/>
                <Bar dataKey="Revenue" fill="#10b981" radius={[5,5,0,0]}/>
                <Bar dataKey="Expenses" fill="#ef4444" radius={[5,5,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </Card>}

          {/* PENDING DELIVERIES */}
          {widgets.includes("pendingDeliveries")&&<Card dm={dm}>
            <div className="px-4 pt-4 pb-3 flex items-center justify-between">
              <div>
                <p style={{color:t.text}} className="font-bold text-sm">Pending Deliveries</p>
                <p style={{color:t.sub}} className="text-[11px]">{pendingD.length} outstanding</p>
              </div>
              {pendingD.length>0&&<Pill dm={dm} c="amber">{pendingD.length}</Pill>}
            </div>
            <Hr dm={dm}/>
            {pendingD.length===0
              ?<div className="py-8 text-center"><p className="text-2xl mb-2">🎉</p><p style={{color:t.sub}} className="text-sm font-semibold">All deliveries done!</p></div>
              :pendingD.map((d,i)=>(
              <div key={d.id}>{i>0&&<Hr dm={dm}/>}
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p style={{color:t.text}} className="text-sm font-semibold truncate">{d.customer}</p>
                    <p style={{color:t.sub}} className="text-xs">📅 {d.date}{d.deliveryDate&&d.deliveryDate!==d.date?` → by ${d.deliveryDate}`:""}{canSeePrices?` · ${inr(lineTotal(d.orderLines))}`:` · ${Object.values(safeO(d.orderLines)).reduce((s,l)=>s+(l.qty||0),0)} items`}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {d.address&&<a href={mapU(d.address,d.lat,d.lng)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-sky-500">📍</a>}
                    <button onClick={()=>tglD(d)} style={{background:"#10b981",color:"#fff"}} className="text-xs font-semibold px-3 py-1.5 rounded-lg">Done ✓</button>
                  </div>
                </div>
              </div>
            ))}
          </Card>}

          {/* OUTSTANDING PAYMENTS */}
          {widgets.includes("outstanding")&&canSeeFinancials&&customers.filter(c=>c.pending>0).length>0&&<Card dm={dm}>
            <div className="px-4 pt-4 pb-3 flex items-center justify-between">
              <div>
                <p style={{color:t.text}} className="font-bold text-sm">Outstanding Payments</p>
                <p style={{color:t.sub}} className="text-[11px]">{inr(customers.reduce((s,c)=>s+(c.pending||0),0))} total due · {inr(customers.reduce((s,c)=>s+(c.paid||0),0))} collected</p>
              </div>
              <Pill dm={dm} c="red">{customers.filter(c=>c.pending>0).length} unpaid</Pill>
            </div>
            <Hr dm={dm}/>
            {customers.filter(c=>c.pending>0).sort((a,b)=>b.pending-a.pending).map((c,i)=>{
              const collPct=c.paid+c.pending>0?Math.round(c.paid/(c.paid+c.pending)*100):0;
              return <div key={c.id}>{i>0&&<Hr dm={dm}/>}
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <div className="flex-1 min-w-0">
                      <p style={{color:t.text}} className="text-sm font-semibold truncate">{c.name}</p>
                      <p style={{color:t.sub}} className="text-xs">{inr(c.paid)} collected · {collPct}% paid</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="text-sm font-black text-red-500">{inr(c.pending)}</p>
                      {isAdmin&&<button onClick={()=>{setPaySh(c);setPayAmt("");}} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500 text-white">+ Pay</button>}
                    </div>
                  </div>
                  <div style={{background:t.border,height:3,borderRadius:3,overflow:"hidden"}}><div style={{width:`${collPct}%`,background:"#10b981",height:"100%",borderRadius:3}}/></div>
                </div>
              </div>;
            })}
          </Card>}

          {/* TODAY'S WASTAGE */}
          {widgets.includes("wastageToday")&&(isAdmin||(settings?.showWastageTo||["admin","factory"]).includes(sess.role))&&(()=>{
            const tw=wastage.filter(w=>w.date===today());
            const twQty=tw.reduce((s,w)=>s+(w.qty||0),0);
            const twCost=tw.reduce((s,w)=>s+(w.cost||0),0);
            return tw.length>0&&<Card dm={dm}>
              <div className="px-4 pt-4 pb-3 flex items-center justify-between">
                <div>
                  <p style={{color:t.text}} className="font-bold text-sm">Today's Wastage</p>
                  <p style={{color:t.sub}} className="text-[11px]">{tw.length} records</p>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{color:"#f97316"}} className="text-sm font-black">{twQty} units</span>
                  {isAdmin&&twCost>0&&<span className="text-sm font-bold text-red-500">{inr(twCost)}</span>}
                </div>
              </div>
              <Hr dm={dm}/>
              {tw.map((w,i)=>(
                <div key={w.id}>{i>0&&<Hr dm={dm}/>}
                  <div className="px-4 py-2.5 flex items-center justify-between">
                    <div>
                      <p style={{color:t.text}} className="text-xs font-semibold">{w.product}</p>
                      <p style={{color:t.sub}} className="text-[11px]">{w.type} · {w.shift} · {w.loggedBy}</p>
                    </div>
                    <span style={{color:t.text}} className="font-bold text-sm">{w.qty} <span style={{color:t.sub}} className="text-xs font-normal">{w.unit}</span></span>
                  </div>
                </div>
              ))}
            </Card>;
          })()}
        </>)}

        {/* CUSTOMERS */}
        {tab==="Customers"&&(<>
          {/* Summary bar */}
          {canSeeFinancials&&<div className="grid grid-cols-3 gap-3">
            <StatCard dm={dm} label="Active Customers" value={activeC.length} sub={`${customers.filter(c=>!c.active).length} inactive`} accent="#d97706"/>
            <StatCard dm={dm} label="Total Collected" value={inr(customers.reduce((s,c)=>s+(c.paid||0),0))} sub="All time" accent="#10b981"/>
            <StatCard dm={dm} label="Outstanding" value={inr(customers.reduce((s,c)=>s+(c.pending||0),0))} sub={`${customers.filter(c=>c.pending>0).length} unpaid`} accent="#ef4444"/>
          </div>}
          <div className="flex gap-2 items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              <Pill dm={dm} c="amber">{activeC.length} active</Pill>
              <Pill dm={dm} c="stone">{customers.filter(c=>!c.active).length} inactive</Pill>
            </div>
            <div className="flex gap-2">
              {isAdmin&&<Btn dm={dm} v="outline" size="sm" onClick={()=>exportCSV(customers,"customers",[{label:"Name",key:"name"},{label:"Phone",key:"phone"},{label:"Address",key:"address"},{label:"Join Date",key:"joinDate"},{label:"Active",val:r=>r.active?"Yes":"No"},{label:"Order Total",val:r=>lineTotal(r.orderLines)},{label:"Paid",key:"paid"},{label:"Pending",key:"pending"},{label:"Status",val:r=>r.pending>0?"UNPAID":"PAID"},{label:"Notes",key:"notes"}])}>CSV</Btn>}
              <Btn dm={dm} size="sm" onClick={()=>{setCf(blkC());setCsh("add");}}>+ Customer</Btn>
            </div>
          </div>
          <Search dm={dm} value={srch} onChange={setSrch} placeholder="Search name, phone, address…"/>
          {fCust.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-8">No customers found.</p>}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {fCust.map(c=>{
            const rows=lineRows(c.orderLines,products);
            const tot=lineTotal(c.orderLines);
            const cDelivs=deliveries.filter(d=>d.customerId===c.id);
            const cDone=cDelivs.filter(d=>d.status==="Delivered");
            const lastDeliv=cDelivs.length>0?[...cDelivs].sort((a,b)=>b.date.localeCompare(a.date))[0]:null;
            const payPct=((c.paid||0)+(c.pending||0))>0?Math.round((c.paid||0)/((c.paid||0)+(c.pending||0))*100):100;
            return (
              <Card key={c.id} dm={dm}><div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div style={{background:c.active?"#f59e0b22":"#6b728022",color:c.active?"#f59e0b":t.sub}} className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-base shrink-0">{c.name.charAt(0).toUpperCase()}</div>
                    <div className="min-w-0">
                      <p style={{color:t.text}} className="font-bold truncate">{c.name}</p>
                      {c.phone&&<p style={{color:t.sub}} className="text-xs">📞 {c.phone}</p>}
                      {c.address&&<p style={{color:t.sub}} className="text-[11px] truncate">📍 {c.address}</p>}
                    </div>
                  </div>
                  <Pill dm={dm} c={c.active?"green":"stone"}>{c.active?"Active":"Inactive"}</Pill>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div style={{background:t.inp}} className="rounded-xl p-2 text-center">
                    <p style={{color:t.text}} className="font-black text-sm">{cDelivs.length}</p>
                    <p style={{color:t.sub}} className="text-[10px]">Orders</p>
                  </div>
                  <div style={{background:t.inp}} className="rounded-xl p-2 text-center">
                    <p style={{color:t.text}} className="font-black text-sm">{cDone.length}</p>
                    <p style={{color:t.sub}} className="text-[10px]">Delivered</p>
                  </div>
                  <div style={{background:t.inp}} className="rounded-xl p-2 text-center">
                    {(()=>{
                      if(!lastDeliv)return<><p style={{color:t.sub}} className="font-bold text-xs">—</p><p style={{color:t.sub}} className="text-[10px]">Last Order</p></>;
                      const diffDays=Math.floor((new Date()-new Date(lastDeliv.date))/(1000*60*60*24));
                      const label=diffDays===0?"Today":diffDays===1?"Yesterday":`${diffDays}d ago`;
                      const col=diffDays>14?"#ef4444":diffDays>7?"#f59e0b":"#10b981";
                      return<><p style={{color:col}} className="font-black text-xs">{label}</p><p style={{color:t.sub}} className="text-[10px]">Last Order</p></>;
                    })()}
                  </div>
                </div>

                {/* Payment status */}
                {canSeeFinancials&&<div className="mb-3">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-emerald-500 font-semibold">Paid {inr(c.paid||0)}</span>
                    <span className={c.pending>0?"text-red-500 font-semibold":"text-emerald-500 font-semibold"}>{c.pending>0?`Due ${inr(c.pending)}`:"✓ Fully Paid"}</span>
                  </div>
                  <div style={{background:t.border,height:5,borderRadius:5,overflow:"hidden"}}>
                    <div style={{width:`${payPct}%`,background:"#10b981",height:"100%",borderRadius:5}}/>
                  </div>
                </div>}

                {/* Regular order */}
                {rows.length>0&&<div style={{background:t.inp,border:`1px solid ${t.inpB}`}} className="rounded-xl px-3 py-2.5 mb-3">
                  <p style={{color:t.sub}} className="text-[10px] font-bold uppercase tracking-wider mb-1.5">Regular Order</p>
                  {rows.map(r=>(
                    <div key={r.id} className="flex justify-between text-xs py-0.5">
                      <span style={{color:t.sub}}>{r.qty} × {r.name}{canSeePrices?` @ ${inr(r.priceAmount)}`:""}</span>
                      {canSeePrices&&<span style={{color:t.text}} className="font-semibold">{inr(r.qty*r.priceAmount)}</span>}
                    </div>
                  ))}
                  {canSeePrices&&tot>0&&<div style={{borderTop:`1px solid ${t.border}`}} className="mt-1.5 pt-1.5 flex justify-between text-xs font-bold"><span style={{color:t.sub}}>Total</span><span className="text-amber-500">{inr(tot)}</span></div>}
                </div>}

                {c.notes&&<p style={{color:t.sub}} className="text-xs italic mb-3">"{c.notes}"</p>}
                {c.joinDate&&<p style={{color:t.sub}} className="text-[11px] mb-3">📅 Customer since {c.joinDate}</p>}

                {/* Actions */}
                <div className="flex gap-1.5 flex-wrap">
                  <button onClick={()=>setCView(c)} style={{background:t.inp,color:t.text}} className="text-xs font-semibold px-3 py-1.5 rounded-lg">Profile</button>
                  <button onClick={()=>{setCf({...c,orderLines:{...safeO(c.orderLines)}});setCsh(c);}} style={{background:t.inp,color:t.text}} className="text-xs font-semibold px-3 py-1.5 rounded-lg">Edit</button>
                  <button onClick={()=>exportPDF(c,products,"customer",settings)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-500 text-white">PDF</button>
                  {isAdmin&&<button onClick={()=>{setPaySh(c);setPayAmt("");}} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500 text-white">+ Pay</button>}
                  {isAdmin&&<button onClick={()=>togActive(c)} style={{background:t.inp,color:"#38bdf8"}} className="text-xs font-semibold px-3 py-1.5 rounded-lg">{c.active?"Deactivate":"Activate"}</button>}
                  {c.address&&<a href={mapU(c.address,c.lat,c.lng)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-sky-500 text-white">📍 Map</a>}
                  {isAdmin&&<button onClick={()=>delC(c)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 text-white">Delete</button>}
                </div>
              </div></Card>
            );
          })}
          </div>
        </>)}

        {/* DELIVERIES */}
        {tab==="Deliveries"&&(<>
          <div className="flex gap-2 items-center justify-between flex-wrap">
            <div className="flex gap-2 flex-wrap">
              <Pill dm={dm} c="amber">{deliveries.filter(d=>d.status==="Pending").length} pending</Pill>
              <Pill dm={dm} c="blue">{deliveries.filter(d=>d.status==="In Transit").length} transit</Pill>
              <Pill dm={dm} c="green">{deliveries.filter(d=>d.status==="Delivered").length} done</Pill>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>setDelivCalendar(v=>!v)} style={{background:delivCalendar?"#f59e0b":t.inp,color:delivCalendar?"#000":t.sub}} className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all">{delivCalendar?"📋 List":"📅 Calendar"}</button>
              {isAdmin&&<Btn v="purple" size="sm" onClick={exportFullReport}>📊 Report</Btn>}
              {isAdmin&&<Btn dm={dm} v="outline" size="sm" onClick={()=>exportCSV(deliveries,"deliveries",[{label:"Customer",key:"customer"},{label:"Date",key:"date"},{label:"Deliver By",key:"deliveryDate"},{label:"Status",key:"status"},{label:"Total",val:r=>lineTotal(r.orderLines)},{label:"Address",key:"address"},{label:"Created By",key:"createdBy"},{label:"Notes",key:"notes"},{label:"Replacement Done",val:r=>r.replacement?.done?"Yes":"No"},{label:"Replacement Item",val:r=>r.replacement?.item||""},{label:"Replacement Qty",val:r=>r.replacement?.qty||""},{label:"Replacement Reason",val:r=>r.replacement?.reason||""}])}>CSV</Btn>}
              <Btn dm={dm} size="sm" onClick={()=>{setDf(blkD());setDsh("add");}}>+ Delivery</Btn>
            </div>
          </div>
          <Search dm={dm} value={srch} onChange={setSrch} placeholder="Search customer, date, status…"/>

          {/* CALENDAR VIEW */}
          {delivCalendar&&(()=>{
            const calDate=new Date();calDate.setMonth(calDate.getMonth()+calOffset);calDate.setDate(1);
            const y=calDate.getFullYear(),m=calDate.getMonth();
            const firstDay=new Date(y,m,1).getDay();
            const daysInMonth=new Date(y,m+1,0).getDate();
            const weeks=[];let week=[];
            for(let i=0;i<firstDay;i++)week.push(null);
            for(let d=1;d<=daysInMonth;d++){
              week.push(d);
              if(week.length===7){weeks.push(week);week=[];}
            }
            if(week.length>0){while(week.length<7)week.push(null);weeks.push(week);}
            const monthStr=`${y}-${String(m+1).padStart(2,"0")}`;
            const mName=calDate.toLocaleString("en-IN",{month:"long",year:"numeric"});
            const statusColor=s=>s==="Delivered"?"#10b981":s==="In Transit"?"#0ea5e9":"#f59e0b";
            return <Card dm={dm} className="overflow-hidden">
              <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider">📅 {mName}</p>
                <div className="flex gap-1">
                  <button onClick={()=>setCalOffset(o=>o-1)} style={{background:t.inp,color:t.text}} className="text-xs font-bold px-2.5 py-1 rounded-lg">‹</button>
                  {calOffset!==0&&<button onClick={()=>setCalOffset(0)} style={{background:t.inp,color:t.sub}} className="text-[10px] font-semibold px-2 py-1 rounded-lg">Today</button>}
                  <button onClick={()=>setCalOffset(o=>o+1)} style={{background:t.inp,color:t.text}} className="text-xs font-bold px-2.5 py-1 rounded-lg">›</button>
                </div>
              </div>
              <div className="px-2 pb-3">
                <div className="grid grid-cols-7 gap-0.5 mb-1">
                  {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=><div key={d} style={{color:t.sub}} className="text-center text-[10px] font-semibold py-1">{d}</div>)}
                </div>
                {weeks.map((week,wi)=>(
                  <div key={wi} className="grid grid-cols-7 gap-0.5 mb-0.5">
                    {week.map((day,di)=>{
                      if(!day)return <div key={di}/>;
                      const dateStr=`${monthStr}-${String(day).padStart(2,"0")}`;
                      const dayDelivs=deliveries.filter(d=>d.date===dateStr&&(!srch||d.customer.toLowerCase().includes(srch.toLowerCase())||d.status.toLowerCase().includes(srch.toLowerCase())));
                      const isToday=dateStr===today();
                      return <div key={di} style={{background:isToday?dm?"#2a1a00":"#fef3c7":t.card,border:`1px solid ${isToday?"#f59e0b":t.border}`,minHeight:52}} className="rounded-lg p-1 relative">
                        <p style={{color:isToday?"#f59e0b":t.sub}} className={`text-[10px] font-bold mb-0.5 ${isToday?"":"opacity-70"}`}>{day}</p>
                        <div className="flex flex-col gap-0.5">
                          {dayDelivs.slice(0,3).map(d=>(
                            <div key={d.id} onClick={()=>{setDf({...d,orderLines:{...safeO(d.orderLines)},replacement:d.replacement||{done:false,item:"",reason:"",qty:""}});setDsh(d);}} style={{background:statusColor(d.status),color:"#fff"}} className="rounded text-[9px] font-semibold px-1 py-0.5 truncate cursor-pointer leading-tight">{d.customer.split(" ")[0]}</div>
                          ))}
                          {dayDelivs.length>3&&<div style={{color:t.sub}} className="text-[9px] text-center">+{dayDelivs.length-3}</div>}
                        </div>
                      </div>;
                    })}
                  </div>
                ))}
                <div className="flex gap-3 mt-2 px-1">
                  {[["Pending","#f59e0b"],["In Transit","#0ea5e9"],["Delivered","#10b981"]].map(([s,c])=>(
                    <div key={s} className="flex items-center gap-1"><div style={{background:c,width:8,height:8,borderRadius:2}}/><span style={{color:t.sub}} className="text-[10px]">{s}</span></div>
                  ))}
                </div>
              </div>
            </Card>;
          })()}

          {fDeliv.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-6">No deliveries found.</p>}
          {!delivCalendar&&fDeliv.map(d=>{
            const rows=lineRows(d.orderLines,products);
            const tot=lineTotal(d.orderLines);
            return (
              <Card key={d.id} dm={dm}><div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p style={{color:t.text}} className="font-semibold">{d.customer}</p>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                      <span style={{color:t.sub}} className="text-xs">📅 {d.date}</span>
                      {d.deliveryDate&&<span style={{color:t.sub}} className="text-xs">→ by {d.deliveryDate}</span>}
                      <span style={{color:t.sub}} className="text-xs">by {d.createdBy||"—"}</span>
                    </div>
                  </div>
                  <button onClick={()=>tglD(d)}><Pill dm={dm} c={d.status==="Delivered"?"green":d.status==="In Transit"?"blue":"amber"}>{d.status}</Pill></button>
                </div>
                <div style={{background:t.inp}} className="rounded-xl px-3 py-2.5 mb-3">
                  {rows.length===0?<p style={{color:t.sub}} className="text-xs">No items</p>
                    :rows.map(r=>(
                    <div key={r.id} className="flex justify-between text-xs py-0.5">
                      <span style={{color:t.sub}}>{r.qty} × {r.name}{canSeePrices?` @ ${inr(r.priceAmount)}`:""}</span>
                      {canSeePrices&&<span style={{color:t.text}} className="font-semibold">{inr(r.qty*r.priceAmount)}</span>}
                    </div>
                  ))}
                  {canSeePrices&&tot>0&&<div style={{borderTop:`1px solid ${t.border}`}} className="mt-1.5 pt-1.5 flex justify-between text-xs font-bold"><span style={{color:t.sub}}>Total</span><span className="text-amber-500">{inr(tot)}</span></div>}
                </div>
                {d.notes&&<p style={{color:t.sub}} className="text-xs italic mb-2">"{d.notes}"</p>}
                {d.replacement?.done&&(
                  <div style={{background:"#f9731620",border:"1px solid #f9741640"}} className="rounded-xl px-3 py-2 mb-2">
                    <p className="text-[11px] font-semibold text-orange-500 mb-0.5">🔄 Replacement Made</p>
                    {d.replacement.item&&<p style={{color:t.sub}} className="text-xs">Item: {d.replacement.item}{d.replacement.qty?` · Qty: ${d.replacement.qty}`:""}{d.replacement.amount?` · ${inr(+d.replacement.amount)} deducted`:""}</p>}
                    {d.replacement.reason&&<p style={{color:t.sub}} className="text-xs">Reason: {d.replacement.reason}</p>}
                  </div>
                )}
                <div className="flex gap-1.5 flex-wrap">
                  {d.address&&<a href={mapU(d.address,d.lat,d.lng)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-sky-500 text-white">📍 Navigate</a>}
                  <button onClick={()=>{setDf({...d,orderLines:{...safeO(d.orderLines)},replacement:d.replacement||{done:false,item:"",reason:"",qty:""}});setDsh(d);}} style={{background:t.inp,color:t.text}} className="text-xs font-semibold px-3 py-1.5 rounded-lg">Edit</button>
                  <button onClick={()=>exportPDF(d,products,"delivery",settings)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-500 text-white">PDF</button>
                  <button onClick={()=>exportWord(d,products,"delivery",settings)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-sky-500 text-white">Word</button>
                  <button onClick={()=>shareWhatsApp(d,products,"delivery",settings)} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{background:"#25D366"}}>WhatsApp</button>
                  {isFactory&&d.status==="Pending"&&<button onClick={()=>{setDeliv(p=>p.map(x=>x.id===d.id?{...x,status:"In Transit"}:x));addLog("Dispatched",d.customer);notify("Marked In Transit");}} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 text-white">Dispatch</button>}
                  {isAdmin&&<button onClick={()=>delD(d)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 text-white">Delete</button>}
                </div>
              </div></Card>
            );
          })}
        </>)}

        {/* SUPPLIES */}
        {tab==="Supplies"&&(<>
          {/* Summary cards */}
          {canSeeFinancials&&<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard dm={dm} label="Total Supply Cost" value={inr(totalSupC)} sub={`${supplies.length} entries`} accent="#8b5cf6"/>
            <StatCard dm={dm} label="This Month" value={inr(supplies.filter(s=>s.date?.startsWith(new Date().toISOString().slice(0,7))).reduce((a,s)=>a+(s.cost||0),0))} sub="Current month spend" accent="#f59e0b"/>
            <StatCard dm={dm} label="Suppliers" value={[...new Set(supplies.map(s=>s.supplier).filter(Boolean))].length} sub="Unique suppliers" accent="#0ea5e9"/>
            <StatCard dm={dm} label="Avg per Entry" value={inr(supplies.length>0?Math.round(totalSupC/supplies.length):0)} sub="Average supply cost" accent="#10b981"/>
          </div>}
          {/* Top suppliers breakdown */}
          {canSeeFinancials&&supplies.length>0&&(()=>{
            const suppByName=[...new Set(supplies.map(s=>s.supplier).filter(Boolean))].map(sup=>({
              name:sup,
              count:supplies.filter(s=>s.supplier===sup).length,
              total:supplies.filter(s=>s.supplier===sup).reduce((a,s)=>a+(s.cost||0),0),
            })).sort((a,b)=>b.total-a.total).slice(0,5);
            const maxSup=suppByName[0]?.total||1;
            return suppByName.length>0&&<Card dm={dm} className="p-4">
              <p style={{color:t.text}} className="font-bold text-sm mb-3">Top Suppliers by Spend</p>
              {suppByName.map((s,i)=>(
                <div key={s.name} className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <p style={{color:t.text}} className="text-sm font-semibold">{s.name}</p>
                    <div className="text-right">
                      <span className="text-purple-500 font-bold text-sm">{inr(s.total)}</span>
                      <span style={{color:t.sub}} className="text-[10px] ml-2">{s.count} orders</span>
                    </div>
                  </div>
                  <div style={{background:t.border,height:5,borderRadius:5,overflow:"hidden"}}><div style={{width:`${Math.round(s.total/maxSup*100)}%`,background:"#8b5cf6",height:"100%",borderRadius:5}}/></div>
                </div>
              ))}
            </Card>;
          })()}
          <div className="flex justify-between items-center">
            <div className="flex gap-2 flex-wrap">
              <Pill dm={dm} c="amber">{supplies.length} items</Pill>
              {canSeeFinancials&&<Pill dm={dm} c="purple">{inr(totalSupC)} total</Pill>}
            </div>
            <div className="flex gap-2">
              {isAdmin&&<Btn dm={dm} v="outline" size="sm" onClick={()=>exportCSV(supplies,"supplies",[{label:"Item",key:"item"},{label:"Qty",key:"qty"},{label:"Unit",key:"unit"},{label:"Supplier",key:"supplier"},{label:"Cost",key:"cost"},{label:"Date",key:"date"},{label:"Notes",key:"notes"}])}>CSV</Btn>}
              <Btn dm={dm} size="sm" onClick={()=>{setSf(blkS());setSsh("add");}}>+ Supply</Btn>
            </div>
          </div>
          <Search dm={dm} value={srch} onChange={setSrch} placeholder="Search item, supplier…"/>
          {fSup.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-6">No supplies found.</p>}
          {fSup.map(s=>(
            <Card key={s.id} dm={dm}><div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p style={{color:t.text}} className="font-semibold">{s.item}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {s.supplier&&<span style={{color:t.sub}} className="text-xs">🏭 {s.supplier}</span>}
                    {s.date&&<span style={{color:t.sub}} className="text-xs">📅 {s.date}</span>}
                  </div>
                  {s.notes&&<p style={{color:t.sub}} className="text-xs italic mt-1">"{s.notes}"</p>}
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p style={{color:t.text}} className="font-bold text-base leading-none">{s.qty}<span style={{color:t.sub}} className="text-xs font-normal ml-1">{s.unit}</span></p>
                  {canSeeFinancials&&s.cost>0&&<p className="text-purple-500 font-bold text-sm mt-0.5">{inr(s.cost)}</p>}
                  <div className="flex gap-1.5 justify-end mt-2">
                    <button onClick={()=>{setSf({...s});setSsh(s);}} style={{background:t.inp,color:t.text}} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg">Edit</button>
                    {isAdmin&&<button onClick={()=>delS(s)} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-red-600 text-white">Delete</button>}
                  </div>
                </div>
              </div>
            </div></Card>
          ))}
        </>)}

        {/* EXPENSES */}
        {tab==="Expenses"&&isAdmin&&(<>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard dm={dm} label="Operating Expenses" value={inr(totalExpOp)} sub={`${expenses.length} entries`} accent="#ef4444"/>
            <StatCard dm={dm} label="Supply Costs" value={inr(totalSupC)} sub="Raw materials" accent="#8b5cf6"/>
            <StatCard dm={dm} label="Total Revenue" value={inr(totalRev)} sub="From delivered orders" accent="#10b981"/>
            <StatCard dm={dm} label="Net Profit" value={inr(netProfit)} sub={netProfit>=0?"Profitable ✓":"In loss ⚠️"} accent={netProfit>=0?"#10b981":"#ef4444"}/>
          </div>
          {/* Financial overview card */}
          <Card dm={dm}><div className="p-4">
            <p style={{color:t.text}} className="font-bold text-sm mb-3">Financial Overview</p>
            {[
              {l:"Total Revenue",v:totalRev,c:"#10b981",icon:"💰",pct:null},
              {l:"Supply Costs",v:totalSupC,c:"#8b5cf6",icon:"📦",pct:totalRev>0?Math.round(totalSupC/totalRev*100):0},
              {l:"Operating Expenses",v:totalExpOp,c:"#ef4444",icon:"💸",pct:totalRev>0?Math.round(totalExpOp/totalRev*100):0},
              {l:"Wastage Losses",v:(wastage||[]).reduce((a,w)=>a+(w.cost||0),0),c:"#f97316",icon:"🗑️",pct:totalRev>0?Math.round((wastage||[]).reduce((a,w)=>a+(w.cost||0),0)/totalRev*100):0},
              {l:"Net Profit",v:netProfit,c:netProfit>=0?"#10b981":"#ef4444",icon:"📈",pct:totalRev>0?Math.round(netProfit/totalRev*100):0},
            ].map((x,i)=><div key={x.l} className="py-2.5" style={{borderBottom:i<4?`1px solid ${t.border}`:"none"}}>
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{x.icon}</span>
                  <span style={{color:t.sub}} className="text-sm font-medium">{x.l}</span>
                </div>
                <div className="flex items-center gap-2">
                  {x.pct!==null&&<span style={{color:t.sub}} className="text-[11px]">{x.pct}%</span>}
                  <span className="font-bold text-sm" style={{color:x.c}}>{inr(x.v)}</span>
                </div>
              </div>
              {x.pct!==null&&totalRev>0&&<div style={{background:t.border,height:3,borderRadius:3,overflow:"hidden"}}><div style={{width:`${Math.min(x.pct,100)}%`,background:x.c,height:"100%",borderRadius:3}}/></div>}
            </div>)}
          </div></Card>
          {/* Expense by category */}
          {expenses.length>0&&(()=>{
            const cats=(settings?.expenseCategories||["Gas","Labour","Transport","Packaging","Utilities","Maintenance","Other"]);
            const catData=cats.map(cat=>({cat,total:expenses.filter(e=>e.category===cat).reduce((s,e)=>s+(e.amount||0),0),count:expenses.filter(e=>e.category===cat).length})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
            const maxCat=catData[0]?.total||1;
            return catData.length>0&&<Card dm={dm} className="p-4">
              <p style={{color:t.text}} className="font-bold text-sm mb-3">Expenses by Category</p>
              {catData.map((c,i)=>(
                <div key={c.cat} className="mb-3 last:mb-0">
                  <div className="flex items-center justify-between mb-1">
                    <span style={{color:t.text}} className="text-sm font-semibold">{c.cat}</span>
                    <div>
                      <span className="text-red-500 font-bold text-sm">{inr(c.total)}</span>
                      <span style={{color:t.sub}} className="text-[11px] ml-2">{c.count} entries</span>
                    </div>
                  </div>
                  <div style={{background:t.border,height:5,borderRadius:5,overflow:"hidden"}}><div style={{width:`${Math.round(c.total/maxCat*100)}%`,background:["#ef4444","#f97316","#f59e0b","#10b981","#0ea5e9","#8b5cf6","#ec4899"][i%7],height:"100%",borderRadius:5}}/></div>
                </div>
              ))}
            </Card>;
          })()}
          <div className="flex justify-between items-center">
            <div className="flex gap-2 flex-wrap">
              <Pill dm={dm} c="red">{inr(totalExpOp)} ops</Pill>
              <Pill dm={dm} c={netProfit>=0?"green":"red"}>Profit {inr(netProfit)}</Pill>
            </div>
            <div className="flex gap-2">
              <Btn dm={dm} v="outline" size="sm" onClick={()=>exportCSV(expenses,"expenses",[{label:"Category",key:"category"},{label:"Amount",key:"amount"},{label:"Date",key:"date"},{label:"Notes",key:"notes"}])}>CSV</Btn>
              <Btn dm={dm} size="sm" onClick={()=>{setEf(blkE());setEsh("add");}}>+ Expense</Btn>
            </div>
          </div>
          {expenses.length===0?<p style={{color:t.sub}} className="text-sm text-center py-6">No expenses logged yet.</p>
          :expenses.map(e=>(
            <Card key={e.id} dm={dm}><div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span style={{background:"#ef444420",color:"#ef4444",borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:700}}>{e.category}</span>
                  </div>
                  <p style={{color:t.sub}} className="text-xs mt-1">📅 {e.date}{e.notes?` · ${e.notes}`:""}</p>
                  {e.receipt&&<div style={{background:t.inp,border:`1px solid ${t.inpB}`}} className="rounded-lg px-2.5 py-1.5 mt-1.5 text-xs inline-flex items-center gap-1.5"><span className="text-amber-500 font-semibold">🧾</span><span style={{color:t.sub}}>{e.receipt}</span></div>}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="font-black text-red-500 text-base">{inr(e.amount)}</span>
                  <button onClick={()=>{setEf({...e,amount:String(e.amount)});setEsh(e);}} style={{background:t.inp,color:t.text}} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg">Edit</button>
                  <button onClick={()=>delE(e)} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-red-600 text-white">Delete</button>
                </div>
              </div>
            </div></Card>
          ))}
        </>)}

        {/* WASTAGE */}
        {tab==="Wastage"&&(<>
          {/* Stats row */}
          {(()=>{
            const canW = isAdmin||(settings?.showWastageTo||["admin","factory"]).includes(sess.role);
            if(!canW)return <p style={{color:t.sub}} className="text-sm text-center py-8">Access restricted by admin.</p>;
            const totalWasteQty = wastage.reduce((s,w)=>s+(w.qty||0),0);
            const totalWasteCost = wastage.reduce((s,w)=>s+(w.cost||0),0);
            const todayWaste = wastage.filter(w=>w.date===today());
            const byType = (settings?.wastageTypes||["Other"]).map(type=>({type,count:wastage.filter(w=>w.type===type).reduce((s,w)=>s+(w.qty||0),0)})).filter(x=>x.count>0);
            const byProduct = [...new Set(wastage.map(w=>w.product))].map(p=>({product:p,qty:wastage.filter(w=>w.product===p).reduce((s,w)=>s+(w.qty||0),0),cost:wastage.filter(w=>w.product===p).reduce((s,w)=>s+(w.cost||0),0)}));
            const fWaste = wastage.filter(w=>!srch||(w.product.toLowerCase().includes(srch.toLowerCase())||w.type.toLowerCase().includes(srch.toLowerCase())||w.reason?.toLowerCase().includes(srch.toLowerCase())||w.loggedBy?.toLowerCase().includes(srch.toLowerCase())));
            return (<>
              {/* Summary tiles */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard dm={dm} label="Total Wastage" value={totalWasteQty} sub={`${wastage.length} records`} accent="#f97316"/>
                <StatCard dm={dm} label="Today's Wastage" value={todayWaste.reduce((s,w)=>s+(w.qty||0),0)} sub={`${todayWaste.length} entries today`} accent="#ef4444"/>
                {isAdmin&&<><StatCard dm={dm} label="Wastage Cost" value={inr(totalWasteCost)} sub="Estimated loss" accent="#8b5cf6"/>
                <StatCard dm={dm} label="This Week" value={wastage.filter(w=>{const d=new Date(w.date||"");const n=new Date();return(n-d)<7*86400000;}).reduce((s,w)=>s+(w.qty||0),0)} sub="Last 7 days qty" accent="#f59e0b"/></>}
              </div>

              {/* By product breakdown */}
              {byProduct.length>0&&<Card dm={dm}><div className="p-4">
                <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-3">By Product</p>
                {byProduct.map(p=>(
                  <div key={p.product} className="flex justify-between py-2" style={{borderBottom:`1px solid ${t.border}`}}>
                    <span style={{color:t.text}} className="text-sm font-semibold">{p.product}</span>
                    <div className="flex gap-3">
                      <span style={{color:t.sub}} className="text-sm">{p.qty} units wasted</span>
                      {isAdmin&&<span className="text-sm font-bold text-red-500">{inr(p.cost)}</span>}
                    </div>
                  </div>
                ))}
              </div></Card>}

              {/* By type */}
              {byType.length>0&&<Card dm={dm}><div className="p-4">
                <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-3">By Type</p>
                <div className="flex flex-wrap gap-2">{byType.map(x=><div key={x.type} style={{background:t.inp}} className="rounded-xl px-3 py-2 text-center"><p style={{color:t.text}} className="text-sm font-bold">{x.count}</p><p style={{color:t.sub}} className="text-[11px]">{x.type}</p></div>)}</div>
              </div></Card>}

              {/* Controls */}
              <div className="flex gap-2 items-center justify-between flex-wrap">
                <Pill dm={dm} c="red">{wastage.length} total records</Pill>
                <div className="flex gap-2">
                  <Btn dm={dm} v="outline" size="sm" onClick={()=>{
                    exportCSV(wastage,"wastage",[
                      {label:"Date",key:"date"},{label:"Shift",key:"shift"},{label:"Product",key:"product"},
                      {label:"Qty",key:"qty"},{label:"Unit",key:"unit"},{label:"Type",key:"type"},
                      {label:"Reason",key:"reason"},{label:"Cost (₹)",key:"cost"},{label:"Logged By",key:"loggedBy"},
                      {label:"Time",key:"createdAt"}
                    ]);addLog("Exported wastage","CSV export");}}>CSV</Btn>
                  <Btn dm={dm} v="purple" size="sm" onClick={()=>{
                    const rows=wastage.slice(0,500);
                    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Wastage Report</title>
<style>*{box-sizing:border-box}body{font-family:Arial;padding:24px;color:#1c1917;max-width:800px;margin:0 auto}
h1{color:#92400e;font-size:18px}h2{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#a8a29e;margin:16px 0 6px}
table{width:100%;border-collapse:collapse}th{font-size:9px;text-transform:uppercase;padding:6px 0;border-bottom:2px solid #e7e5e4;text-align:left;color:#a8a29e}
td{padding:8px 0;border-bottom:1px solid #f5f5f4;font-size:12px}
.tot{font-weight:800;font-size:13px;border-top:2px solid #1c1917;border-bottom:none}
.summary{display:flex;gap:16px;margin-top:16px;padding:12px;background:#f5f5f4;border-radius:8px}
.sv{font-size:16px;font-weight:900}.sl{font-size:10px;color:#78716c}
@media print{@page{margin:1cm}}</style></head><body>
<h1>🗑️ Wastage Report — ${settings?.appName||"TAS Healthy World"}</h1>
<p style="font-size:11px;color:#78716c">Generated: ${new Date().toLocaleString("en-IN")} · ${rows.length} records</p>
<div class="summary">
  <div><div class="sl">Total Qty Wasted</div><div class="sv">${totalWasteQty}</div></div>
  ${isAdmin?`<div><div class="sl">Total Cost Loss</div><div class="sv" style="color:#dc2626">${inr(totalWasteCost)}</div></div>`:""}
  <div><div class="sl">Today</div><div class="sv">${todayWaste.reduce((s,w)=>s+(w.qty||0),0)}</div></div>
</div>
<h2>All Records</h2>
<table><tr><th>Date</th><th>Shift</th><th>Product</th><th>Qty</th><th>Type</th><th>Reason</th>${isAdmin?"<th>Cost</th>":""}<th>Logged By</th></tr>
${rows.map(w=>`<tr><td>${w.date||""}</td><td>${w.shift||""}</td><td>${w.product}</td><td>${w.qty} ${w.unit}</td><td>${w.type}</td><td>${w.reason||"—"}</td>${isAdmin?`<td>${inr(w.cost)}</td>`:""}<td>${w.loggedBy||"—"}</td></tr>`).join("")}
<tr class="tot"><td colspan="${isAdmin?7:6}">Total Wasted</td><td>${totalWasteQty} units${isAdmin?` · ${inr(totalWasteCost)} loss`:""}</td></tr>
</table>
<script>window.addEventListener("load",function(){window.print();});</script>
</body></html>`;
                    const w=window.open("","_blank","width=900,height=900,noopener");
                    if(w){w.document.open();w.document.write(html);w.document.close();}
                    else alert("Allow pop-ups then try again.");
                    addLog("Exported wastage","PDF report");
                  }}>PDF</Btn>
                  <Btn dm={dm} size="sm" onClick={()=>{setWF(blkW());setWSh("add");}}>+ Log Wastage</Btn>
                </div>
              </div>
              <Search dm={dm} value={srch} onChange={setSrch} placeholder="Search product, type, reason, user…"/>

              {/* Records list */}
              {fWaste.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-6">No wastage records found.</p>}
              {fWaste.map(w=>(
                <Card key={w.id} dm={dm}><div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p style={{color:t.text}} className="font-semibold">{w.product}</p>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                        <span style={{color:t.sub}} className="text-xs">📅 {w.date}</span>
                        <span style={{color:t.sub}} className="text-xs">🕐 {w.shift}</span>
                        <span style={{color:t.sub}} className="text-xs">by {w.loggedBy||"—"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Pill dm={dm} c="red">{w.type}</Pill>
                      <span style={{color:t.text}} className="font-black text-base">{w.qty} <span style={{color:t.sub}} className="text-xs font-normal">{w.unit}</span></span>
                    </div>
                  </div>
                  {w.reason&&<p style={{color:t.sub}} className="text-xs italic mb-2">"{w.reason}"</p>}
                  {isAdmin&&w.cost>0&&<p className="text-xs font-semibold text-red-400 mb-2">Estimated cost loss: {inr(w.cost)}</p>}
                  {(isAdmin||(sess.id&&w.loggedBy===sess.name))&&(
                    <div className="flex gap-1.5">
                      <button onClick={()=>{setWF({...w,qty:String(w.qty),cost:String(w.cost||"")});setWSh(w);}} style={{background:t.inp,color:t.text}} className="text-xs font-semibold px-3 py-1.5 rounded-lg">Edit</button>
                      {isAdmin&&<button onClick={()=>delW(w)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 text-white">Delete</button>}
                    </div>
                  )}
                </div></Card>
              ))}
            </>);
          })()}
        </>)}


        {/* P&L TAB */}
        {tab==="P&L"&&isAdmin&&(()=>{
          const months=Array.from({length:6},(_,i)=>{const d=new Date();d.setMonth(d.getMonth()-i);return d.toISOString().slice(0,7);}).reverse();
          const mData=months.map(m=>({
            month:m.slice(5)+"/"+m.slice(2,4),
            monthFull:new Date(m+"-01").toLocaleString("en-IN",{month:"short",year:"numeric"}),
            revenue:deliveries.filter(d=>d.date?.startsWith(m)&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0),
            supplyCost:supplies.filter(s=>s.date?.startsWith(m)).reduce((s,x)=>s+(x.cost||0),0),
            expenses:expenses.filter(e=>e.date?.startsWith(m)).reduce((s,e)=>s+(e.amount||0),0),
            wasteCost:(wastage||[]).filter(w=>w.date?.startsWith(m)).reduce((s,w)=>s+(w.cost||0),0),
            deliveriesCount:deliveries.filter(d=>d.date?.startsWith(m)&&d.status==="Delivered").length,
            pendingCollected:customers.reduce((s,c)=>s+(c.paid||0),0), // approximation
          })).map(m=>({...m,totalCost:m.supplyCost+m.expenses+m.wasteCost,profit:m.revenue-m.supplyCost-m.expenses-m.wasteCost,margin:m.revenue>0?Math.round((m.revenue-m.supplyCost-m.expenses-m.wasteCost)/m.revenue*100):0}));
          const totRev=mData.reduce((s,m)=>s+m.revenue,0);
          const totCost=mData.reduce((s,m)=>s+m.totalCost,0);
          const totProfit=totRev-totCost;
          const totMargin=totRev>0?Math.round(totProfit/totRev*100):0;
          const totDue=customers.reduce((s,c)=>s+(c.pending||0),0);
          const totCollected=customers.reduce((s,c)=>s+(c.paid||0),0);
          const collectionRate=totCollected+totDue>0?Math.round(totCollected/(totCollected+totDue)*100):100;
          const bestMonth=mData.reduce((b,m)=>m.profit>b.profit?m:b,mData[0]||{profit:0,monthFull:"—"});
          const worstMonth=mData.reduce((b,m)=>m.profit<b.profit?m:b,mData[0]||{profit:0,monthFull:"—"});
          const avgMonthlyRev=mData.length>0?Math.round(totRev/mData.filter(m=>m.revenue>0).length||1):0;
          // Cost breakdown for pie-like display
          const totSupC=mData.reduce((s,m)=>s+m.supplyCost,0);
          const totExpC=mData.reduce((s,m)=>s+m.expenses,0);
          const totWasteC=mData.reduce((s,m)=>s+m.wasteCost,0);
          return <>
            {/* Hero KPI banner */}
            <div style={{background:dm?"linear-gradient(135deg,#0d1f12,#0d1219)":"linear-gradient(135deg,#f0fdf4,#eff6ff)",border:dm?"1px solid #1e3a28":"1px solid #bbf7d0",borderRadius:20,padding:"20px 22px"}}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-0.5">📈 Profit & Loss Summary</p>
                  <p style={{color:t.text}} className="font-black text-lg">Last 6 Months Performance</p>
                </div>
                <div className="text-right">
                  <p style={{color:totProfit>=0?"#10b981":"#ef4444"}} className="text-3xl font-black leading-none">{inr(totProfit)}</p>
                  <p style={{color:t.sub}} className="text-[11px] font-semibold mt-0.5">net profit · {totMargin}% margin</p>
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {label:"Total Revenue",val:inr(totRev),color:"#10b981",icon:"💰"},
                  {label:"Total Costs",val:inr(totCost),color:"#ef4444",icon:"💸"},
                  {label:"Collection Rate",val:`${collectionRate}%`,color:collectionRate>=90?"#10b981":collectionRate>=70?"#f59e0b":"#ef4444",icon:"🏦"},
                  {label:"Outstanding Dues",val:inr(totDue),color:totDue>0?"#ef4444":"#10b981",icon:"⚠️"},
                ].map(x=><div key={x.label} style={{background:dm?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.7)",borderRadius:12,padding:"12px 14px"}}>
                  <p className="text-base mb-1">{x.icon}</p>
                  <p style={{color:x.color}} className="font-black text-lg leading-none">{x.val}</p>
                  <p style={{color:t.sub}} className="text-[10px] font-semibold mt-1">{x.label}</p>
                </div>)}
              </div>
            </div>

            {/* Insights row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"14px 16px"}}>
                <p style={{color:t.sub}} className="text-[10px] font-bold uppercase tracking-wider mb-1">🏆 Best Month</p>
                <p style={{color:t.text}} className="font-black text-base">{bestMonth?.monthFull||"—"}</p>
                <p className="text-emerald-500 font-semibold text-sm">{inr(bestMonth?.profit||0)} profit</p>
              </div>
              <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"14px 16px"}}>
                <p style={{color:t.sub}} className="text-[10px] font-bold uppercase tracking-wider mb-1">📉 Weakest Month</p>
                <p style={{color:t.text}} className="font-black text-base">{worstMonth?.monthFull||"—"}</p>
                <p className={`font-semibold text-sm ${(worstMonth?.profit||0)>=0?"text-emerald-500":"text-red-500"}`}>{inr(worstMonth?.profit||0)}</p>
              </div>
              <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"14px 16px"}}>
                <p style={{color:t.sub}} className="text-[10px] font-bold uppercase tracking-wider mb-1">📊 Avg Monthly Revenue</p>
                <p style={{color:t.text}} className="font-black text-base">{inr(avgMonthlyRev)}</p>
                <p style={{color:t.sub}} className="text-sm font-medium">per active month</p>
              </div>
            </div>

            {/* Monthly Revenue vs Cost vs Profit chart */}
            <Card dm={dm} className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p style={{color:t.text}} className="font-bold text-sm">Monthly P&L — Revenue vs Costs vs Profit</p>
                  <p style={{color:t.sub}} className="text-[11px]">Last 6 months breakdown</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={mData} margin={{top:4,right:0,left:-10,bottom:0}} barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false}/>
                  <XAxis dataKey="monthFull" tick={{fontSize:10,fill:t.sub}}/>
                  <YAxis tick={{fontSize:10,fill:t.sub}} tickFormatter={v=>v>=1000?`₹${(v/1000).toFixed(0)}k`:`₹${v}`}/>
                  <Tooltip contentStyle={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,color:t.text,fontSize:11}} formatter={(v)=>inr(v)}/>
                  <Legend wrapperStyle={{fontSize:11,paddingTop:8}}/>
                  <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4,4,0,0]}/>
                  <Bar dataKey="totalCost" name="Total Cost" fill="#ef4444" radius={[4,4,0,0]}/>
                  <Bar dataKey="profit" name="Profit" fill="#f59e0b" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Profit Margin Line Chart */}
            <Card dm={dm} className="p-4">
              <p style={{color:t.text}} className="font-bold text-sm mb-1">Profit Margin Trend</p>
              <p style={{color:t.sub}} className="text-[11px] mb-3">Month-by-month margin % — target: 30%+</p>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={mData} margin={{top:4,right:8,left:-20,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false}/>
                  <XAxis dataKey="monthFull" tick={{fontSize:10,fill:t.sub}}/>
                  <YAxis tick={{fontSize:10,fill:t.sub}} tickFormatter={v=>`${v}%`}/>
                  <Tooltip contentStyle={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,color:t.text,fontSize:11}} formatter={(v)=>`${v}%`}/>
                  <Line type="monotone" dataKey="margin" name="Margin %" stroke="#f59e0b" strokeWidth={2.5} dot={{fill:"#f59e0b",r:4}} activeDot={{r:6}}/>
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Cost Structure breakdown */}
            <Card dm={dm} className="p-4">
              <p style={{color:t.text}} className="font-bold text-sm mb-4">Cost Structure — 6 Month Total</p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  {label:"Supply Costs",val:totSupC,color:"#8b5cf6",pct:totCost>0?Math.round(totSupC/totCost*100):0},
                  {label:"Operating Expenses",val:totExpC,color:"#ef4444",pct:totCost>0?Math.round(totExpC/totCost*100):0},
                  {label:"Wastage Losses",val:totWasteC,color:"#f97316",pct:totCost>0?Math.round(totWasteC/totCost*100):0},
                ].map(x=><div key={x.label} style={{background:t.inp,borderRadius:12,padding:"12px 14px"}}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div style={{width:10,height:10,borderRadius:3,background:x.color,flexShrink:0}}/>
                    <span style={{color:t.sub}} className="text-[10px] font-semibold leading-tight">{x.label}</span>
                  </div>
                  <p style={{color:x.color}} className="font-black text-base leading-none">{inr(x.val)}</p>
                  <p style={{color:t.sub}} className="text-[11px] mt-1">{x.pct}% of costs</p>
                  <div style={{background:t.border,height:3,borderRadius:3,marginTop:8,overflow:"hidden"}}><div style={{width:`${x.pct}%`,background:x.color,height:"100%",borderRadius:3}}/></div>
                </div>)}
              </div>
              {/* Cost split visual bar */}
              {totCost>0&&<div style={{height:10,borderRadius:10,overflow:"hidden",display:"flex",gap:2}}>
                <div style={{width:`${Math.round(totSupC/totCost*100)}%`,background:"#8b5cf6",borderRadius:"10px 0 0 10px"}}/>
                <div style={{width:`${Math.round(totExpC/totCost*100)}%`,background:"#ef4444"}}/>
                <div style={{width:`${Math.round(totWasteC/totCost*100)}%`,background:"#f97316",borderRadius:"0 10px 10px 0"}}/>
              </div>}
            </Card>

            {/* Monthly detailed table */}
            <Card dm={dm} className="overflow-hidden">
              <div className="p-4 pb-2 flex items-center justify-between">
                <div>
                  <p style={{color:t.text}} className="text-sm font-bold">Monthly Detailed Breakdown</p>
                  <p style={{color:t.sub}} className="text-[11px]">All figures in INR · Margin = Profit ÷ Revenue</p>
                </div>
                <Btn dm={dm} v="outline" size="sm" onClick={()=>exportCSV(mData,"pl_report",[{label:"Month",key:"monthFull"},{label:"Revenue",key:"revenue"},{label:"Supply Cost",key:"supplyCost"},{label:"Expenses",key:"expenses"},{label:"Waste Cost",key:"wasteCost"},{label:"Total Cost",key:"totalCost"},{label:"Profit/Loss",key:"profit"},{label:"Margin %",key:"margin"},{label:"Deliveries",key:"deliveriesCount"}])}>📊 CSV</Btn>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr style={{borderBottom:`2px solid ${t.border}`,background:dm?"#111":"#f9f9f8"}}>
                    {["Month","Deliveries","Revenue","Supply Cost","Op Expenses","Waste Loss","Total Cost","Profit/Loss","Margin"].map(h=><th key={h} style={{color:t.sub}} className="px-3 py-2.5 text-left font-bold uppercase tracking-wide text-[10px] whitespace-nowrap">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {mData.map((m,i)=>(
                      <tr key={m.month} style={{borderBottom:`1px solid ${t.border}`,background:i%2===0?"transparent":dm?"#ffffff04":"#00000004"}}>
                        <td style={{color:t.text}} className="px-3 py-2.5 font-bold whitespace-nowrap">{m.monthFull}</td>
                        <td style={{color:t.sub}} className="px-3 py-2.5">{m.deliveriesCount}</td>
                        <td className="px-3 py-2.5 text-emerald-500 font-semibold">{inr(m.revenue)}</td>
                        <td className="px-3 py-2.5 text-purple-500">{inr(m.supplyCost)}</td>
                        <td className="px-3 py-2.5 text-red-400">{inr(m.expenses)}</td>
                        <td className="px-3 py-2.5 text-orange-500">{inr(m.wasteCost)}</td>
                        <td className="px-3 py-2.5 text-red-500 font-semibold">{inr(m.totalCost)}</td>
                        <td className={`px-3 py-2.5 font-bold ${m.profit>=0?"text-emerald-500":"text-red-500"}`}>{inr(m.profit)}</td>
                        <td className="px-3 py-2.5">
                          <span style={{background:m.margin>=30?"#10b98120":m.margin>=10?"#f59e0b20":"#ef444420",color:m.margin>=30?"#10b981":m.margin>=10?"#f59e0b":"#ef4444",borderRadius:6,padding:"2px 6px",fontWeight:700,fontSize:10}}>{m.margin}%</span>
                        </td>
                      </tr>
                    ))}
                    <tr style={{borderTop:`2px solid ${t.border}`,background:dm?"#1a1a1a":"#fafaf8"}}>
                      <td style={{color:t.text}} className="px-3 py-3 font-black text-[11px]">TOTAL</td>
                      <td style={{color:t.sub}} className="px-3 py-3 font-bold">{deliveries.filter(d=>d.status==="Delivered").length}</td>
                      <td className="px-3 py-3 text-emerald-500 font-black">{inr(totRev)}</td>
                      <td className="px-3 py-3 text-purple-500 font-bold">{inr(totSupC)}</td>
                      <td className="px-3 py-3 text-red-400 font-bold">{inr(totExpC)}</td>
                      <td className="px-3 py-3 text-orange-500 font-bold">{inr(totWasteC)}</td>
                      <td className="px-3 py-3 text-red-500 font-black">{inr(totCost)}</td>
                      <td className={`px-3 py-3 font-black ${totProfit>=0?"text-emerald-500":"text-red-500"}`}>{inr(totProfit)}</td>
                      <td className="px-3 py-3"><span style={{background:totMargin>=30?"#10b98120":totMargin>=10?"#f59e0b20":"#ef444420",color:totMargin>=30?"#10b981":totMargin>=10?"#f59e0b":"#ef4444",borderRadius:6,padding:"2px 6px",fontWeight:800,fontSize:10}}>{totMargin}%</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>

            {/* CUSTOMER-WISE P&L */}
            <Card dm={dm} className="overflow-hidden">
              <div className="px-4 pt-4 pb-3 flex items-center justify-between">
                <div>
                  <p style={{color:t.text}} className="text-sm font-bold">Customer-wise Revenue Breakdown</p>
                  <p style={{color:t.sub}} className="text-[11px]">Sorted by total revenue generated</p>
                </div>
                <Btn dm={dm} v="outline" size="sm" onClick={()=>{
                  const custPL=customers.map(c=>{
                    const cd=deliveries.filter(d=>d.customerId===c.id&&d.status==="Delivered");
                    const rev=cd.reduce((s,d)=>s+lineTotal(d.orderLines),0);
                    return {name:c.name,phone:c.phone||"",orders:deliveries.filter(d=>d.customerId===c.id).length,delivered:cd.length,revenue:rev,collected:c.paid||0,pending:c.pending||0,avgOrder:cd.length>0?Math.round(rev/cd.length):0};
                  }).sort((a,b)=>b.revenue-a.revenue);
                  exportCSV(custPL,"customer_pl",[{label:"Customer",key:"name"},{label:"Phone",key:"phone"},{label:"Total Orders",key:"orders"},{label:"Delivered",key:"delivered"},{label:"Revenue",key:"revenue"},{label:"Collected",key:"collected"},{label:"Pending",key:"pending"},{label:"Avg Order",key:"avgOrder"}]);
                }}>📊 CSV</Btn>
              </div>
              <Hr dm={dm}/>
              {customers.length===0?<p style={{color:t.sub}} className="text-sm text-center py-5">No customers yet.</p>
              :[...customers].sort((a,b)=>{
                const ra=deliveries.filter(d=>d.customerId===a.id&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0);
                const rb=deliveries.filter(d=>d.customerId===b.id&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0);
                return rb-ra;
              }).map((c,ci)=>{
                const cDelivs=deliveries.filter(d=>d.customerId===c.id);
                const cDelivered=cDelivs.filter(d=>d.status==="Delivered");
                const cRev=cDelivered.reduce((s,d)=>s+lineTotal(d.orderLines),0);
                const cPending=c.pending||0;
                const cPaid=c.paid||0;
                const avgOrder=cDelivered.length>0?Math.round(cRev/cDelivered.length):0;
                const lastDeliv=cDelivs.length>0?[...cDelivs].sort((a,b)=>b.date.localeCompare(a.date))[0]:null;
                const maxCustRev=deliveries.filter(d=>d.status==="Delivered").length>0?
                  Math.max(...customers.map(cx=>deliveries.filter(d=>d.customerId===cx.id&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0))):1;
                const collPct=cPaid+cPending>0?Math.round(cPaid/(cPaid+cPending)*100):100;
                const pendPct=100-collPct;
                return <div key={c.id} style={{borderBottom:`1px solid ${t.border}`}} className="px-4 py-4 last:border-0">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div style={{background:`${ci===0?"#f59e0b":ci===1?"#9ca3af":ci===2?"#cd7c3f":"#6b7280"}22`,color:ci===0?"#f59e0b":ci===1?"#9ca3af":ci===2?"#cd7c3f":"#6b7280",width:30,height:30,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:13,flexShrink:0}}>{ci+1}</div>
                      <div>
                        <p style={{color:t.text}} className="text-sm font-bold">{c.name}</p>
                        <p style={{color:t.sub}} className="text-[11px]">{cDelivs.length} orders · {cDelivered.length} delivered{lastDeliv?` · Last: ${lastDeliv.date}`:""}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-amber-500 text-base leading-none">{inr(cRev)}</p>
                      <p style={{color:t.sub}} className="text-[10px] mt-0.5">total revenue</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    <div style={{background:"#10b98115",borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
                      <p className="font-bold text-emerald-500 text-xs leading-none">{inr(cPaid)}</p><p style={{color:t.sub}} className="text-[10px] mt-1">Collected</p>
                    </div>
                    <div style={{background:cPending>0?"#ef444415":"#10b98115",borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
                      <p className={`font-bold text-xs leading-none ${cPending>0?"text-red-500":"text-emerald-500"}`}>{inr(cPending)}</p><p style={{color:t.sub}} className="text-[10px] mt-1">Pending</p>
                    </div>
                    <div style={{background:"#f59e0b15",borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
                      <p className="font-bold text-amber-500 text-xs leading-none">{inr(avgOrder)}</p><p style={{color:t.sub}} className="text-[10px] mt-1">Avg Order</p>
                    </div>
                    <div style={{background:"#8b5cf615",borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
                      <p className="font-bold text-purple-500 text-xs leading-none">{collPct}%</p><p style={{color:t.sub}} className="text-[10px] mt-1">Collected</p>
                    </div>
                  </div>
                  {/* Revenue bar vs all customers */}
                  <div className="mb-1">
                    <div className="flex justify-between mb-1"><span style={{color:t.sub}} className="text-[10px]">Revenue share vs top customer</span><span style={{color:t.sub}} className="text-[10px] font-semibold">{maxCustRev>0?Math.round(cRev/maxCustRev*100):0}%</span></div>
                    <div style={{background:t.border,height:5,borderRadius:5,overflow:"hidden"}}><div style={{width:`${maxCustRev>0?Math.round(cRev/maxCustRev*100):0}%`,background:"linear-gradient(90deg,#f59e0b,#10b981)",height:"100%",borderRadius:5,transition:"width 0.6s ease"}}/></div>
                  </div>
                  {/* Collection bar */}
                  {(cPaid+cPending)>0&&<div>
                    <div style={{height:5,borderRadius:5,overflow:"hidden",display:"flex",gap:1,marginTop:4}}>
                      <div style={{width:`${collPct}%`,background:"#10b981",borderRadius:"5px 0 0 5px"}}/>
                      {pendPct>0&&<div style={{width:`${pendPct}%`,background:"#ef4444",borderRadius:"0 5px 5px 0"}}/>}
                    </div>
                    <div className="flex gap-3 mt-1">
                      <div className="flex items-center gap-1"><div style={{width:6,height:6,borderRadius:2,background:"#10b981"}}/><span style={{color:t.sub}} className="text-[9px]">Collected {collPct}%</span></div>
                      {pendPct>0&&<div className="flex items-center gap-1"><div style={{width:6,height:6,borderRadius:2,background:"#ef4444"}}/><span style={{color:t.sub}} className="text-[9px]">Pending {pendPct}%</span></div>}
                    </div>
                  </div>}
                </div>;
              })}
            </Card>
          </>;
        })()}


        {/* ANALYTICS TAB */}
        {tab==="Analytics"&&isAdmin&&(()=>{
          // Best selling products
          const prodSales=products.map(p=>{
            const delivered=deliveries.filter(d=>d.status==="Delivered");
            const qty=delivered.reduce((s,d)=>s+(safeO(d.orderLines)[p.id]?.qty||0),0);
            const rev=delivered.reduce((s,d)=>s+(safeO(d.orderLines)[p.id]?.qty||0)*(safeO(d.orderLines)[p.id]?.priceAmount||0),0);
            return {...p,totalQty:qty,totalRev:rev,deliveryCount:delivered.filter(d=>(safeO(d.orderLines)[p.id]?.qty||0)>0).length};
          }).sort((a,b)=>b.totalQty-a.totalQty);
          // Top customers by revenue
          const custRev=customers.map(c=>({...c,totalOrders:deliveries.filter(d=>d.customerId===c.id).length,totalRev:deliveries.filter(d=>d.customerId===c.id&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0)})).sort((a,b)=>b.totalRev-a.totalRev);
          // Daily delivery trend last 14 days
          const days14=Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return d.toISOString().slice(0,10);}).reverse();
          const dailyData=days14.map(date=>({
            date:date.slice(5),
            scheduled:deliveries.filter(d=>d.date===date).length,
            delivered:deliveries.filter(d=>d.date===date&&d.status==="Delivered").length,
            revenue:deliveries.filter(d=>d.date===date&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0),
            expenses:expenses.filter(e=>e.date===date).reduce((s,e)=>s+(e.amount||0),0),
          }));
          // Revenue by day of week
          const dowData=[0,1,2,3,4,5,6].map(dow=>{
            const label=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dow];
            const filtered=deliveries.filter(d=>d.status==="Delivered"&&new Date(d.date).getDay()===dow);
            return {day:label,deliveries:filtered.length,revenue:filtered.reduce((s,d)=>s+lineTotal(d.orderLines),0)};
          });
          // Expense category breakdown
          const expCatData=(settings?.expenseCategories||["Gas","Labour","Transport","Packaging","Utilities","Maintenance","Other"]).map(cat=>({
            category:cat,
            amount:expenses.filter(e=>e.category===cat).reduce((s,e)=>s+(e.amount||0),0),
            count:expenses.filter(e=>e.category===cat).length,
          })).filter(x=>x.amount>0).sort((a,b)=>b.amount-a.amount);
          // Wastage analytics
          const wastageByType=(settings?.wastageTypes||["Other"]).map(type=>({
            type,qty:wastage.filter(w=>w.type===type).reduce((s,w)=>s+(w.qty||0),0),
            cost:wastage.filter(w=>w.type===type).reduce((s,w)=>s+(w.cost||0),0),
          })).filter(x=>x.qty>0);
          // Delivery fulfillment rate
          const totalScheduled=deliveries.length;
          const totalDelivered=deliveries.filter(d=>d.status==="Delivered").length;
          const fulfillmentRate=totalScheduled>0?Math.round(totalDelivered/totalScheduled*100):0;
          // Replacement rate
          const replCount=deliveries.filter(d=>d.replacement?.done).length;
          const replRate=totalDelivered>0?Math.round(replCount/totalDelivered*100):0;
          // Avg revenue per delivery
          const avgRevPerDeliv=totalDelivered>0?Math.round(deliveries.filter(d=>d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0)/totalDelivered):0;
          // Inactive customers %
          const inactivePct=customers.length>0?Math.round(customers.filter(c=>!c.active).length/customers.length*100):0;

          const PIE_COLORS=["#f59e0b","#10b981","#8b5cf6","#ef4444","#0ea5e9","#f97316","#ec4899"];

          return <>
            {/* KPI Header row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard dm={dm} label="Fulfillment Rate" value={`${fulfillmentRate}%`} sub={`${totalDelivered}/${totalScheduled} orders`} accent={fulfillmentRate>=90?"#10b981":fulfillmentRate>=70?"#f59e0b":"#ef4444"}/>
              <StatCard dm={dm} label="Avg Revenue/Delivery" value={inr(avgRevPerDeliv)} sub="Per completed delivery" accent="#f59e0b"/>
              <StatCard dm={dm} label="Best Seller" value={prodSales[0]?.name||"—"} sub={prodSales[0]?`${prodSales[0].totalQty} units sold`:"No data"} accent="#8b5cf6"/>
              <StatCard dm={dm} label="Top Customer" value={custRev[0]?.name||"—"} sub={custRev[0]?inr(custRev[0].totalRev)+" revenue":"No data"} accent="#0ea5e9"/>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard dm={dm} label="Total Deliveries" value={deliveries.length} sub={`${totalDelivered} delivered`} accent="#10b981"/>
              <StatCard dm={dm} label="Replacement Rate" value={`${replRate}%`} sub={`${replCount} replacements made`} accent={replRate>10?"#ef4444":replRate>5?"#f59e0b":"#10b981"}/>
              <StatCard dm={dm} label="Active Customers" value={customers.filter(c=>c.active).length} sub={`${inactivePct}% inactive`} accent="#d97706"/>
              <StatCard dm={dm} label="Products in Catalogue" value={products.length} sub={`${prodSales.filter(p=>p.totalQty>0).length} selling`} accent="#6366f1"/>
            </div>
            {/* Best & Worst customer */}
            {custRev.length>0&&<div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Card dm={dm} className="p-4 flex items-center gap-4">
                <div style={{background:"#10b98120",color:"#10b981",borderRadius:14,width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>🏆</div>
                <div className="min-w-0">
                  <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-0.5">Best Customer</p>
                  <p style={{color:t.text}} className="font-black text-base truncate">{custRev[0]?.name||"—"}</p>
                  <p style={{color:"#10b981"}} className="text-xs font-bold">{inr(custRev[0]?.totalRev||0)} revenue · {custRev[0]?.totalOrders||0} orders</p>
                </div>
              </Card>
              <Card dm={dm} className="p-4 flex items-center gap-4">
                <div style={{background:"#ef444420",color:"#ef4444",borderRadius:14,width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>📉</div>
                <div className="min-w-0">
                  <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-0.5">Lowest Revenue</p>
                  <p style={{color:t.text}} className="font-black text-base truncate">{custRev[custRev.length-1]?.name||"—"}</p>
                  <p style={{color:"#ef4444"}} className="text-xs font-bold">{inr(custRev[custRev.length-1]?.totalRev||0)} revenue · {custRev[custRev.length-1]?.totalOrders||0} orders</p>
                </div>
              </Card>
            </div>}

            {/* 14-day revenue + delivery trend */}
            <Card dm={dm} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p style={{color:t.text}} className="font-bold text-sm">Daily Trend — Last 14 Days</p>
                  <p style={{color:t.sub}} className="text-[11px]">Revenue (bars) and delivery volume</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyData} margin={{top:4,right:0,left:-10,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false}/>
                  <XAxis dataKey="date" tick={{fontSize:9,fill:t.sub}}/>
                  <YAxis yAxisId="left" tick={{fontSize:9,fill:t.sub}} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:`${v}`}/>
                  <YAxis yAxisId="right" orientation="right" tick={{fontSize:9,fill:t.sub}}/>
                  <Tooltip contentStyle={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,color:t.text,fontSize:11}} formatter={(v,n)=>n==="Revenue"?inr(v):v}/>
                  <Legend wrapperStyle={{fontSize:10,paddingTop:6}}/>
                  <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#10b981" radius={[3,3,0,0]}/>
                  <Bar yAxisId="right" dataKey="delivered" name="Deliveries" fill="#f59e0b" radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Day of week heatmap */}
            <Card dm={dm} className="p-4">
              <p style={{color:t.text}} className="font-bold text-sm mb-1">Revenue by Day of Week</p>
              <p style={{color:t.sub}} className="text-[11px] mb-3">Which days generate the most revenue</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={dowData} margin={{top:4,right:0,left:-20,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false}/>
                  <XAxis dataKey="day" tick={{fontSize:11,fill:t.sub}}/>
                  <YAxis tick={{fontSize:9,fill:t.sub}} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:`${v}`}/>
                  <Tooltip contentStyle={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,color:t.text,fontSize:11}} formatter={(v,n)=>n==="Revenue"?inr(v):v}/>
                  <Bar dataKey="revenue" name="Revenue" radius={[4,4,0,0]}>
                    {dowData.map((entry,index)=><Cell key={index} fill={entry.revenue===Math.max(...dowData.map(d=>d.revenue))?"#f59e0b":dm?"#3a3a44":"#d1d5db"}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Product Sales + Expense breakdown side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Product sales */}
              <Card dm={dm} className="overflow-hidden">
                <div className="p-4 pb-2 flex items-center justify-between">
                  <div>
                    <p style={{color:t.text}} className="font-bold text-sm">Product Performance</p>
                    <p style={{color:t.sub}} className="text-[11px]">By units sold & revenue</p>
                  </div>
                  <Btn dm={dm} v="outline" size="sm" onClick={()=>exportCSV(prodSales,"product_analytics",[{label:"Product",key:"name"},{label:"Unit",key:"unit"},{label:"Total Qty Sold",key:"totalQty"},{label:"Total Revenue",key:"totalRev"},{label:"Delivery Count",key:"deliveryCount"}])}>CSV</Btn>
                </div>
                {prodSales.map((p,i)=>(
                  <div key={p.id} style={{borderTop:`1px solid ${t.border}`}} className="px-4 py-3">
                    <div className="flex items-center gap-3 mb-2">
                      <span style={{color:t.sub,width:22,textAlign:"center"}} className="text-lg font-black">{i+1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <p style={{color:t.text}} className="text-sm font-semibold truncate">{p.name}</p>
                          <p className="text-sm font-black text-amber-500 shrink-0 ml-2">{inr(p.totalRev)}</p>
                        </div>
                        <p style={{color:t.sub}} className="text-[11px]">{p.deliveryCount} deliveries · {p.totalQty} {p.unit} sold</p>
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:t.border}}>
                        <div className="h-full rounded-full" style={{width:`${prodSales[0]?.totalQty>0?Math.round(p.totalQty/prodSales[0].totalQty*100):0}%`,background:PIE_COLORS[i%PIE_COLORS.length]}}/>
                      </div>
                      <span style={{color:t.sub}} className="text-[10px] font-semibold w-8 text-right">{prodSales[0]?.totalQty>0?Math.round(p.totalQty/prodSales[0].totalQty*100):0}%</span>
                    </div>
                  </div>
                ))}
              </Card>

              {/* Expense category breakdown */}
              {expCatData.length>0&&<Card dm={dm} className="overflow-hidden">
                <div className="p-4 pb-2">
                  <p style={{color:t.text}} className="font-bold text-sm">Expense Breakdown by Category</p>
                  <p style={{color:t.sub}} className="text-[11px]">Where money is going</p>
                </div>
                {expCatData.map((e,i)=>{
                  const maxAmt=expCatData[0]?.amount||1;
                  return <div key={e.category} style={{borderTop:`1px solid ${t.border}`}} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div style={{width:8,height:8,borderRadius:2,background:PIE_COLORS[i%PIE_COLORS.length],flexShrink:0}}/>
                        <p style={{color:t.text}} className="text-sm font-semibold">{e.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-red-500">{inr(e.amount)}</p>
                        <p style={{color:t.sub}} className="text-[10px]">{e.count} entries</p>
                      </div>
                    </div>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:t.border}}>
                      <div className="h-full rounded-full" style={{width:`${Math.round(e.amount/maxAmt*100)}%`,background:PIE_COLORS[i%PIE_COLORS.length]}}/>
                    </div>
                  </div>;
                })}
              </Card>}
            </div>

            {/* Top customers table */}
            <Card dm={dm} className="overflow-hidden">
              <div className="p-4 pb-2 flex items-center justify-between">
                <div>
                  <p style={{color:t.text}} className="font-bold text-sm">Top Customers by Revenue</p>
                  <p style={{color:t.sub}} className="text-[11px]">Including collection status</p>
                </div>
                <Btn dm={dm} v="outline" size="sm" onClick={()=>exportCSV(custRev,"customer_analytics",[{label:"Name",key:"name"},{label:"Phone",key:"phone"},{label:"Total Orders",key:"totalOrders"},{label:"Revenue",key:"totalRev"},{label:"Pending",key:"pending"}])}>CSV</Btn>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr style={{borderBottom:`1px solid ${t.border}`,background:dm?"#111":"#f9f9f8"}}>
                    <th style={{color:t.sub}} className="px-4 py-2 text-left font-bold uppercase tracking-wide text-[10px]">#</th>
                    <th style={{color:t.sub}} className="px-4 py-2 text-left font-bold uppercase tracking-wide text-[10px]">Customer</th>
                    <th style={{color:t.sub}} className="px-4 py-2 text-left font-bold uppercase tracking-wide text-[10px]">Orders</th>
                    <th style={{color:t.sub}} className="px-4 py-2 text-left font-bold uppercase tracking-wide text-[10px]">Revenue</th>
                    <th style={{color:t.sub}} className="px-4 py-2 text-left font-bold uppercase tracking-wide text-[10px]">Collected</th>
                    <th style={{color:t.sub}} className="px-4 py-2 text-left font-bold uppercase tracking-wide text-[10px]">Pending</th>
                    <th style={{color:t.sub}} className="px-4 py-2 text-left font-bold uppercase tracking-wide text-[10px]">Status</th>
                  </tr></thead>
                  <tbody>
                    {custRev.map((c,i)=>(
                      <tr key={c.id} style={{borderBottom:`1px solid ${t.border}`}}>
                        <td style={{color:t.sub}} className="px-4 py-2.5 font-black">{i+1}</td>
                        <td className="px-4 py-2.5">
                          <p style={{color:t.text}} className="font-semibold">{c.name}</p>
                          {c.phone&&<p style={{color:t.sub}} className="text-[10px]">{c.phone}</p>}
                        </td>
                        <td style={{color:t.sub}} className="px-4 py-2.5">{c.totalOrders}</td>
                        <td className="px-4 py-2.5 font-bold text-amber-500">{inr(c.totalRev)}</td>
                        <td className="px-4 py-2.5 font-semibold text-emerald-500">{inr(c.paid||0)}</td>
                        <td className={`px-4 py-2.5 font-semibold ${(c.pending||0)>0?"text-red-500":"text-emerald-500"}`}>{inr(c.pending||0)}</td>
                        <td className="px-4 py-2.5">
                          <span style={{background:(c.pending||0)>0?"#ef444420":"#10b98120",color:(c.pending||0)>0?"#ef4444":"#10b981",borderRadius:6,padding:"2px 7px",fontWeight:700,fontSize:10}}>{(c.pending||0)>0?"OWING":"CLEAR"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Wastage analytics */}
            {wastageByType.length>0&&<Card dm={dm} className="p-4">
              <p style={{color:t.text}} className="font-bold text-sm mb-1">Wastage by Type</p>
              <p style={{color:t.sub}} className="text-[11px] mb-3">Total losses by wastage category</p>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {wastageByType.map((w,i)=>(
                  <div key={w.type} style={{background:t.inp,borderRadius:12,padding:"12px 14px",borderLeft:`3px solid ${PIE_COLORS[i%PIE_COLORS.length]}`}}>
                    <p style={{color:t.text}} className="text-sm font-bold">{w.type}</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">{w.qty} units wasted</p>
                    {w.cost>0&&<p className="text-red-500 font-semibold text-xs mt-1">{inr(w.cost)} loss</p>}
                  </div>
                ))}
              </div>
            </Card>}

            {/* Activity log summary */}
            <Card dm={dm} className="overflow-hidden">
              <div className="px-4 pt-4 pb-2"><p style={{color:t.text}} className="font-bold text-sm">Recent Activity Log</p></div>
              <Hr dm={dm}/>
              {actLog.length===0?<p style={{color:t.sub}} className="text-sm text-center py-5">No activity recorded yet.</p>
              :actLog.slice(0,20).map(a=>(
                <div key={a.id} style={{borderBottom:`1px solid ${t.border}`}} className="px-4 py-2.5 flex items-start justify-between gap-3 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p style={{color:t.text}} className="text-xs font-semibold">{a.action}</p>
                    <p style={{color:t.sub}} className="text-[11px] truncate">{a.detail}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p style={{color:t.sub}} className="text-[10px]">{a.user}</p>
                    <p style={{color:t.sub}} className="text-[10px]">{a.ts}</p>
                  </div>
                </div>
              ))}
            </Card>
          </>;
        })()}


        {/* PRODUCTION PLANNING */}
        {tab==="Production"&&(()=>{
          const todayStr=today();
          const yesterdayStr=(()=>{const d=new Date();d.setDate(d.getDate()-1);return d.toISOString().slice(0,10);})();
          const last7=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return d.toISOString().slice(0,10);});
          const last30=Array.from({length:30},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return d.toISOString().slice(0,10);});

          // Filter records based on active date filter
          const filterDates = ptDateFilter==="today"?[todayStr]:ptDateFilter==="yesterday"?[yesterdayStr]:ptDateFilter==="week"?last7:ptDateFilter==="month"?last30:null;
          const filteredPT = filterDates ? prodTargets.filter(x=>filterDates.includes(x.date)) : prodTargets;

          // Get unique dates in filtered set, sorted newest first
          const uniqueDates=[...new Set(filteredPT.map(x=>x.date))].sort((a,b)=>b.localeCompare(a));

          const todayPT=prodTargets.filter(x=>x.date===todayStr);
          const labelFor=d=>d===todayStr?"Today":d===yesterdayStr?"Yesterday":d;

          return <>
            {/* KPI cards for production */}
            {prodTargets.length>0&&(()=>{
              const allTarget=prodTargets.reduce((s,x)=>s+x.target,0);
              const allActual=prodTargets.reduce((s,x)=>s+x.actual,0);
              const overallEff=allTarget>0?Math.round(allActual/allTarget*100):0;
              const hitTarget=prodTargets.filter(x=>x.actual>=x.target).length;
              const hitRate=prodTargets.length>0?Math.round(hitTarget/prodTargets.length*100):0;
              const costPerUnit=allActual>0?Math.round(totalSupC/allActual):0;
              return <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatCard dm={dm} label="Overall Efficiency" value={`${overallEff}%`} sub={`${allActual}/${allTarget} units`} accent={overallEff>=90?"#10b981":overallEff>=75?"#f59e0b":"#ef4444"}/>
                  <StatCard dm={dm} label="Target Hit Rate" value={`${hitRate}%`} sub={`${hitTarget}/${prodTargets.length} sessions`} accent={hitRate>=80?"#10b981":hitRate>=60?"#f59e0b":"#ef4444"}/>
                  <StatCard dm={dm} label="Total Produced" value={allActual.toLocaleString("en-IN")} sub="All time units" accent="#8b5cf6"/>
                  <StatCard dm={dm} label="Total Target" value={allTarget.toLocaleString("en-IN")} sub="All time targets" accent="#6366f1"/>
                </div>
                {allActual>0&&<Card dm={dm} className="p-4 flex items-center gap-4">
                  <div style={{background:"#8b5cf620",color:"#8b5cf6",borderRadius:14,width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>🧮</div>
                  <div>
                    <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-0.5">Cost Per Unit Produced</p>
                    <p style={{color:t.text}} className="font-black text-xl">{inr(costPerUnit)}<span style={{color:t.sub}} className="text-sm font-medium"> / unit</span></p>
                    <p style={{color:t.sub}} className="text-xs mt-0.5">Total supply cost {inr(totalSupC)} ÷ {allActual.toLocaleString("en-IN")} units produced</p>
                  </div>
                </Card>}
              </>;
            })()}
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                <Pill dm={dm} c="amber">{todayPT.length} today</Pill>
                <Pill dm={dm} c={todayPT.length>0&&todayPT.every(x=>x.actual>=x.target)?"green":"red"}>
                  {todayPT.reduce((s,x)=>s+x.actual,0)} / {todayPT.reduce((s,x)=>s+x.target,0)} units
                </Pill>
              </div>
              <Btn dm={dm} size="sm" onClick={()=>{setPtF({date:today(),shift:(settings?.shifts||["Morning"])[0]||"Morning",product:products[0]?.name||"",target:0,actual:0,notes:""});setPtSh("add");}}>+ Log Production</Btn>
            </div>

            {/* Date filter pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {[["today","Today"],["yesterday","Yesterday"],["week","Last 7 Days"],["month","Last 30 Days"],["all","All Time"]].map(([val,label])=>(
                <button key={val} onClick={()=>setPtDateFilter(val)}
                  style={ptDateFilter===val?{background:dm?"#f59e0b":"#1c1917",color:dm?"#000":"#fff"}:{background:t.inp,color:t.sub}}
                  className="whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0">{label}</button>
              ))}
            </div>

            {/* Summary bar for filtered period */}
            {filteredPT.length>0&&(()=>{
              const fTarget=filteredPT.reduce((s,x)=>s+x.target,0);
              const fActual=filteredPT.reduce((s,x)=>s+x.actual,0);
              const fPct=fTarget>0?Math.round(fActual/fTarget*100):0;
              return <div style={{background:t.inp,border:`1px solid ${t.inpB}`}} className="rounded-2xl px-4 py-3">
                <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-2">
                  {ptDateFilter==="today"?"Today":ptDateFilter==="yesterday"?"Yesterday":ptDateFilter==="week"?"Last 7 Days":ptDateFilter==="month"?"Last 30 Days":"All Time"} — Summary
                </p>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="text-center"><p style={{color:t.text}} className="font-black text-lg">{fTarget}</p><p style={{color:t.sub}} className="text-[10px]">Target</p></div>
                  <div className="text-center"><p className={`font-black text-lg ${fActual>=fTarget?"text-emerald-500":"text-amber-500"}`}>{fActual}</p><p style={{color:t.sub}} className="text-[10px]">Actual</p></div>
                  <div className="text-center"><p className={`font-black text-lg ${fPct>=100?"text-emerald-500":fPct>=75?"text-amber-500":"text-red-500"}`}>{fPct}%</p><p style={{color:t.sub}} className="text-[10px]">Efficiency</p></div>
                </div>
                <div style={{background:t.border,height:6,borderRadius:6,overflow:"hidden"}}>
                  <div style={{width:`${Math.min(fPct,100)}%`,background:fPct>=100?"#10b981":fPct>=75?"#f59e0b":"#ef4444",height:"100%",borderRadius:6,transition:"width 0.6s"}}/>
                </div>
              </div>;
            })()}

            {/* Per-product breakdown for filtered period */}
            {filteredPT.length>0&&products.some(p=>filteredPT.find(x=>x.product===p.name))&&<Card dm={dm} className="overflow-hidden">
              <div className="px-4 pt-4 pb-2"><p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider">By Product</p></div>
              <Hr dm={dm}/>
              {products.map(p=>{
                const pRecs=filteredPT.filter(x=>x.product===p.name);
                if(pRecs.length===0)return null;
                const pTarget=pRecs.reduce((s,x)=>s+x.target,0);
                const pActual=pRecs.reduce((s,x)=>s+x.actual,0);
                const pct=pTarget>0?Math.round(pActual/pTarget*100):0;
                return <div key={p.id} style={{borderBottom:`1px solid ${t.border}`}} className="px-4 py-3 last:border-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <p style={{color:t.text}} className="text-sm font-semibold">{p.name}</p>
                    <span className={`text-sm font-black ${pct>=100?"text-emerald-500":pct>=75?"text-amber-500":"text-red-500"}`}>{pct}%</span>
                  </div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span style={{color:t.sub}}>Target: <strong style={{color:t.text}}>{pTarget}</strong></span>
                    <span style={{color:t.sub}}>Actual: <strong style={{color:t.text}}>{pActual}</strong></span>
                    <span style={{color:t.sub}}>Diff: <strong className={pActual>=pTarget?"text-emerald-500":"text-red-500"}>{pActual>=pTarget?"+":""}{pActual-pTarget}</strong></span>
                  </div>
                  <div style={{background:t.border,height:5,borderRadius:5,overflow:"hidden"}}>
                    <div style={{width:`${Math.min(pct,100)}%`,background:pct>=100?"#10b981":pct>=75?"#f59e0b":"#ef4444",height:"100%",borderRadius:5,transition:"width 0.5s"}}/>
                  </div>
                </div>;
              })}
            </Card>}

            {/* Records grouped by date */}
            {uniqueDates.map(dateStr=>{
              const dayRecs=filteredPT.filter(x=>x.date===dateStr);
              const dayTarget=dayRecs.reduce((s,x)=>s+x.target,0);
              const dayActual=dayRecs.reduce((s,x)=>s+x.actual,0);
              const dayPct=dayTarget>0?Math.round(dayActual/dayTarget*100):0;
              return <Card key={dateStr} dm={dm}><div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p style={{color:t.text}} className="font-semibold">{labelFor(dateStr)}</p>
                    <p style={{color:t.sub}} className="text-xs">{dayRecs.length} {dayRecs.length===1?"entry":"entries"} · Target {dayTarget} · Actual {dayActual}</p>
                  </div>
                  <span className={`font-black text-lg ${dayPct>=100?"text-emerald-500":dayPct>=75?"text-amber-500":"text-red-500"}`}>{dayPct}%</span>
                </div>
                {dayRecs.map(r=>(
                  <div key={r.id} style={{borderBottom:`1px solid ${t.border}`}} className="py-2.5 last:border-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span style={{color:t.text}} className="text-sm font-semibold">{r.product}</span>
                          <Pill dm={dm} c="sky">{r.shift}</Pill>
                        </div>
                        {r.notes&&<p style={{color:t.sub}} className="text-[11px] italic mt-0.5">"{r.notes}"</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-black ${r.actual>=r.target?"text-emerald-500":r.actual>=r.target*0.75?"text-amber-500":"text-red-500"}`}>
                          {r.actual}<span style={{color:t.sub}} className="text-xs font-normal">/{r.target}</span>
                        </p>
                        <div className="flex gap-1">
                          <button onClick={()=>{setPtF({...r,target:String(r.target),actual:String(r.actual)});setPtSh(r);}} style={{background:t.inp,color:t.text}} className="text-[11px] font-semibold px-2 py-1 rounded-lg">Edit</button>
                          {isAdmin&&<button onClick={()=>delPT(r)} className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-red-600 text-white">Del</button>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div></Card>;
            })}
            {filteredPT.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-8">{prodTargets.length===0?"No production records yet. Tap + Log Production to start tracking.":"No records for this period."}</p>}
          </>;
        })()}

        {/* SETTINGS */}
        {tab==="Settings"&&isAdmin&&(()=>{
          // Settings section nav
          const SECS=[
            {id:"account",icon:"👤",label:"Account"},
            {id:"staff",icon:"👥",label:"Staff"},
            {id:"products",icon:"📦",label:"Products"},
            {id:"access",icon:"🔒",label:"Access"},
            {id:"app",icon:"🎨",label:"App"},
            {id:"data",icon:"💾",label:"Data"},
          ];
          return <>
          {/* Section pill nav */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-0 scrollbar-hide">
            {SECS.map(s=>(
              <button key={s.id} onClick={()=>setSettingsSection(s.id)}
                style={{background:settingsSection===s.id?t.accent:t.inp,color:settingsSection===s.id?t.accentFg:t.sub,border:`1.5px solid ${settingsSection===s.id?t.accent:t.border}`,whiteSpace:"nowrap"}}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all shrink-0">
                <span>{s.icon}</span>{s.label}
              </button>
            ))}
          </div>

          {/* ── ACCOUNT MANAGEMENT ── */}
          {settingsSection==="account"&&<>
            {/* Admin accounts */}
            {users.filter(u=>u.role==="admin").map(u=>{
              const isMe=u.id===sess.id;
              return <Card dm={dm} key={u.id}><div className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div style={{background:t.accent,color:t.accentFg}} className="w-10 h-10 rounded-2xl flex items-center justify-center text-base font-black shrink-0">{u.name.charAt(0).toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p style={{color:t.text}} className="text-sm font-bold">{u.name}</p>
                      {isMe&&<span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500">YOU</span>}
                    </div>
                    <p style={{color:t.sub}} className="text-[11px]">@{u.username} · Admin</p>
                  </div>
                  <Pill dm={dm} c={u.active?"green":"stone"}>{u.active?"Active":"Inactive"}</Pill>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Btn dm={dm} v="ghost" size="sm" onClick={()=>{setUf({...u,password:""});setUsh(u);}}>✏️ Edit Profile</Btn>
                  {isMe&&<Btn dm={dm} v="ghost" size="sm" onClick={()=>{setChangePwF({current:"",next:"",confirm:""});setChangePwSh(true);}}>🔑 Change Password</Btn>}
                  {!isMe&&<Btn v="danger" size="sm" onClick={()=>delU(u)}>Remove</Btn>}
                </div>
              </div></Card>;
            })}
            {/* Add second admin CTA if only one */}
            {users.filter(u=>u.role==="admin").length<2&&(
              <button onClick={()=>{setUf({...blkU(),role:"admin",permissions:[...ALL_TABS]});setUsh("add");}}
                style={{border:`2px dashed ${t.border}`,color:t.sub}}
                className="w-full rounded-2xl py-4 text-sm font-semibold hover:border-amber-400 hover:text-amber-500 transition-all flex items-center justify-center gap-2">
                <span className="text-lg">+</span> Add Second Admin
              </button>
            )}
            {/* Staff Login Mode — moved here */}
            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text}} className="text-sm font-bold mb-1">Staff Login Mode</p>
              <p style={{color:t.sub}} className="text-[11px] mb-4">Choose how staff identify themselves. Changes take effect immediately.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {[
                  {mode:"individual",icon:"🔐",title:"Individual Login",desc:"Each staff member has their own username & password. Best for accountability."},
                  {mode:"picker",icon:"👆",title:"Staff Picker",desc:"A shared account with a name picker at the top. Best for fast-paced environments."},
                ].map(opt=>{
                  const active=(settings?.staffLoginMode||"individual")===opt.mode;
                  return(
                    <button key={opt.mode} onClick={()=>setSettings(s=>({...s,staffLoginMode:opt.mode}))}
                      style={{background:active?"#16a34a22":t.inp,border:`2px solid ${active?"#16a34a":t.border}`,textAlign:"left"}}
                      className="rounded-2xl p-4 transition-all w-full">
                      <div className="text-2xl mb-2">{opt.icon}</div>
                      <p style={{color:active?"#16a34a":t.text}} className="font-bold text-sm mb-1">{opt.title}</p>
                      <p style={{color:t.sub}} className="text-[11px] leading-relaxed">{opt.desc}</p>
                      {active&&<p className="text-[11px] font-bold text-emerald-500 mt-2">✓ ACTIVE</p>}
                    </button>
                  );
                })}
              </div>
              {(settings?.staffLoginMode||"individual")==="picker"&&(<>
                <Hr dm={dm}/>
                <div className="mt-4">
                  <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-1">Staff Names for Picker</p>
                  <p style={{color:t.sub}} className="text-[11px] mb-3">Names shown in the picker. Usually matches your staff accounts.</p>
                  <div className="flex flex-col gap-2 mb-3">
                    {(settings?.staffNames||[]).map((name,i)=>(
                      <div key={i} className="flex items-center gap-2">
                        <input value={name} placeholder="Staff name"
                          onChange={e=>{const names=[...(settings?.staffNames||[])];names[i]=e.target.value;setSettings(s=>({...s,staffNames:names}));}}
                          style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,flex:1}}
                          className="rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-400 transition-all"/>
                        <button onClick={()=>{const names=(settings?.staffNames||[]).filter((_,j)=>j!==i);setSettings(s=>({...s,staffNames:names}));}} className="w-8 h-8 rounded-lg bg-red-500 text-white font-bold text-sm flex items-center justify-center shrink-0">✕</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={()=>setSettings(s=>({...s,staffNames:[...(s.staffNames||[]),""]}))}
                    style={{border:`1.5px dashed ${t.border}`,color:t.sub}}
                    className="w-full rounded-xl py-2.5 text-sm font-semibold hover:border-amber-400 hover:text-amber-500 transition-all">
                    + Add Name
                  </button>
                </div>
              </>)}
            </div></Card>
          </>}

          {/* ── STAFF / USERS ── */}
          {settingsSection==="staff"&&(()=>{
            // Human-readable permission definitions per role
            const FACTORY_PERMS=[
              {tab:"Customers",  label:"View Customers",        desc:"See customer list and profiles"},
              {tab:"Deliveries", label:"Manage Deliveries",     desc:"Create, update and view delivery orders"},
              {tab:"Supplies",   label:"Log Supplies",          desc:"Record incoming stock and supply costs"},
              {tab:"Wastage",    label:"Log Wastage",           desc:"Record wasted or rejected products"},
              {tab:"Production", label:"Track Production",      desc:"Log shift targets and actual output"},
              {tab:"Dashboard",  label:"View Dashboard",        desc:"See today's summary and stats"},
              {tab:"Analytics",  label:"View Analytics",        desc:"Access charts and performance reports"},
              {tab:"P&L",        label:"View P&L Report",       desc:"See profit & loss breakdown"},
              {tab:"Expenses",   label:"Log Expenses",          desc:"Record operational expenses"},
            ];
            const AGENT_PERMS=[
              {tab:"Customers",  label:"View Customers",        desc:"See customer list and profiles"},
              {tab:"Deliveries", label:"Manage Deliveries",     desc:"Update delivery status and notes"},
              {tab:"Dashboard",  label:"View Dashboard",        desc:"See today's delivery summary"},
              {tab:"Supplies",   label:"View Supplies",         desc:"See stock levels (read-only context)"},
              {tab:"Wastage",    label:"Log Wastage",           desc:"Report damaged or rejected items on route"},
            ];
            const factoryUsers=users.filter(u=>u.role==="factory");
            const agentUsers=users.filter(u=>u.role==="agent");
            // Default permissions per role for display
            const factoryDef=settings?.factoryDefaultPerms||ROLE_DEF.factory;
            const agentDef=settings?.agentDefaultPerms||ROLE_DEF.agent;
            return <>
              {/* ── FACTORY STAFF ── */}
              <Card dm={dm} className="overflow-hidden">
                <div className="p-4 pb-3" style={{borderBottom:`1px solid ${t.border}`}}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div style={{background:"#a855f722",color:"#a855f7"}} className="w-9 h-9 rounded-xl flex items-center justify-center text-lg">🏭</div>
                      <div>
                        <p style={{color:t.text}} className="text-sm font-bold">Factory Staff</p>
                        <p style={{color:t.sub}} className="text-[11px]">{factoryUsers.length} account{factoryUsers.length!==1?"s":""} · Controls what factory workers can access</p>
                      </div>
                    </div>
                    <Btn dm={dm} size="sm" onClick={()=>{setUf({...blkU(),role:"factory",permissions:[...factoryDef]});setUsh("add");}}>+ Add</Btn>
                  </div>
                </div>
                {/* Default permission toggles for this role */}
                <div className="px-4 py-3">
                  <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-3">Default permissions for new factory accounts</p>
                  {FACTORY_PERMS.map(({tab,label,desc})=>{
                    const on=factoryDef.includes(tab);
                    return <div key={tab} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                      <div className="flex-1 min-w-0 pr-3">
                        <p style={{color:t.text}} className="text-sm font-semibold">{label}</p>
                        <p style={{color:t.sub}} className="text-[11px]">{desc}</p>
                      </div>
                      <Tog dm={dm} on={on} onChange={()=>{
                        const next=on?factoryDef.filter(x=>x!==tab):[...factoryDef,tab];
                        setSettings(s=>({...s,factoryDefaultPerms:next}));
                        // Also update all existing factory users that still have the old default set
                        setUsers(p=>p.map(u=>u.role==="factory"?{...u,permissions:on?u.permissions.filter(x=>x!==tab):[...new Set([...u.permissions,tab])]}:u));
                      }}/>
                    </div>;
                  })}
                </div>
                {/* Existing accounts */}
                {factoryUsers.length>0&&<div className="px-4 pb-4">
                  <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mt-3 mb-2">Accounts</p>
                  {factoryUsers.map(u=>(
                    <div key={u.id} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div style={{background:"#a855f722",color:"#a855f7"}} className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black shrink-0">{u.name.charAt(0).toUpperCase()}</div>
                        <div className="min-w-0">
                          <p style={{color:t.text}} className="text-sm font-semibold truncate">{u.name}</p>
                          <p style={{color:t.sub}} className="text-[11px]">@{u.username} · <span className={u.active?"text-emerald-500":"text-red-400"}>{u.active?"Active":"Inactive"}</span></p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={()=>{setUf({...u,password:""});setUsh(u);}} style={{background:t.inp,color:t.text}} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg">Edit</button>
                        <button onClick={()=>delU(u)} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-red-600 text-white">Del</button>
                      </div>
                    </div>
                  ))}
                </div>}
              </Card>

              {/* ── DELIVERY AGENTS ── */}
              <Card dm={dm} className="overflow-hidden">
                <div className="p-4 pb-3" style={{borderBottom:`1px solid ${t.border}`}}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div style={{background:"#0ea5e922",color:"#0ea5e9"}} className="w-9 h-9 rounded-xl flex items-center justify-center text-lg">🚚</div>
                      <div>
                        <p style={{color:t.text}} className="text-sm font-bold">Delivery Agents</p>
                        <p style={{color:t.sub}} className="text-[11px]">{agentUsers.length} account{agentUsers.length!==1?"s":""} · Controls what agents can see on the road</p>
                      </div>
                    </div>
                    <Btn dm={dm} size="sm" onClick={()=>{setUf({...blkU(),role:"agent",permissions:[...agentDef]});setUsh("add");}}>+ Add</Btn>
                  </div>
                </div>
                {/* Default permission toggles for this role */}
                <div className="px-4 py-3">
                  <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-3">Default permissions for new agent accounts</p>
                  {AGENT_PERMS.map(({tab,label,desc})=>{
                    const on=agentDef.includes(tab);
                    return <div key={tab} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                      <div className="flex-1 min-w-0 pr-3">
                        <p style={{color:t.text}} className="text-sm font-semibold">{label}</p>
                        <p style={{color:t.sub}} className="text-[11px]">{desc}</p>
                      </div>
                      <Tog dm={dm} on={on} onChange={()=>{
                        const next=on?agentDef.filter(x=>x!==tab):[...agentDef,tab];
                        setSettings(s=>({...s,agentDefaultPerms:next}));
                        setUsers(p=>p.map(u=>u.role==="agent"?{...u,permissions:on?u.permissions.filter(x=>x!==tab):[...new Set([...u.permissions,tab])]}:u));
                      }}/>
                    </div>;
                  })}
                </div>
                {/* Existing accounts */}
                {agentUsers.length>0&&<div className="px-4 pb-4">
                  <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mt-3 mb-2">Accounts</p>
                  {agentUsers.map(u=>(
                    <div key={u.id} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div style={{background:"#0ea5e922",color:"#0ea5e9"}} className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black shrink-0">{u.name.charAt(0).toUpperCase()}</div>
                        <div className="min-w-0">
                          <p style={{color:t.text}} className="text-sm font-semibold truncate">{u.name}</p>
                          <p style={{color:t.sub}} className="text-[11px]">@{u.username} · <span className={u.active?"text-emerald-500":"text-red-400"}>{u.active?"Active":"Inactive"}</span></p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={()=>{setUf({...u,password:""});setUsh(u);}} style={{background:t.inp,color:t.text}} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg">Edit</button>
                        <button onClick={()=>delU(u)} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-red-600 text-white">Del</button>
                      </div>
                    </div>
                  ))}
                </div>}
              </Card>
            </>;
          })()}

          {/* ── PRODUCTS ── */}
          {settingsSection==="products"&&<>
            <Card dm={dm}><div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div><p style={{color:t.text}} className="text-sm font-bold">Products & Prices</p><p style={{color:t.sub}} className="text-[11px]">{products.length} products</p></div>
                <Btn dm={dm} size="sm" onClick={()=>{setPf(blkP());setPsh("add");}}>+ Product</Btn>
              </div>
              {products.map(p=>(
                <div key={p.id} style={{borderBottom:`1px solid ${t.border}`}} className="py-3 last:border-0">
                  <div className="flex items-start justify-between">
                    <div><p style={{color:t.text}} className="text-sm font-semibold">{p.name}</p><p style={{color:t.sub}} className="text-[11px]">{p.unit} · id: {p.id}</p></div>
                    <div className="flex gap-1.5">
                      <button onClick={()=>{setPf({...p,prices:[...p.prices]});setPsh(p);}} style={{background:t.inp,color:t.text}} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg">Edit</button>
                      <button onClick={()=>delP(p)} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-red-600 text-white">Delete</button>
                    </div>
                  </div>
                  <div className="flex gap-1.5 mt-2 flex-wrap">{p.prices.map((pr,i)=><span key={i} style={{background:t.inp,color:t.text}} className="text-xs font-bold px-2.5 py-1 rounded-lg">{inr(pr)}</span>)}</div>
                </div>
              ))}
            </div></Card>
            {/* Editable Lists */}
            <Card dm={dm}><div className="p-4 flex flex-col gap-4">
              <p style={{color:t.text}} className="text-sm font-bold">System Lists</p>
              {[
                {label:"Expense Categories",key:"expenseCategories",def:["Gas","Labour","Transport","Packaging","Utilities","Maintenance","Other"]},
                {label:"Delivery Statuses",key:"deliveryStatuses",def:["Pending","In Transit","Delivered","Cancelled"]},
                {label:"Supply Units",key:"supplyUnits",def:["kg","g","L","mL","pcs","bags","boxes","dozen"]},
                {label:"Wastage Types",key:"wastageTypes",def:["Burnt","Broken","Expired","Overproduced","Quality Reject","Other"]},
                {label:"Work Shifts",key:"shifts",def:["Morning","Afternoon","Evening","Night"]},
              ].map(({label,key,def})=>{
                const list=settings?.[key]||def;
                return (
                  <div key={key}>
                    <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-2">{label}</p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {list.map((item,i)=>(
                        <div key={i} className="flex items-center gap-1" style={{background:t.inp,border:`1px solid ${t.inpB}`,borderRadius:8,paddingLeft:8,paddingRight:4,paddingTop:3,paddingBottom:3}}>
                          <span style={{color:t.text}} className="text-xs">{item}</span>
                          <button onClick={()=>setSettings(s=>({...s,[key]:list.filter((_,j)=>j!==i)}))} className="text-red-400 font-bold text-sm ml-1 leading-none">✕</button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input id={`new_${key}`} placeholder={`New ${label.toLowerCase().slice(0,-1)}…`}
                        style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text}}
                        className="flex-1 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-amber-400"/>
                      <button onClick={()=>{const el=document.getElementById(`new_${key}`);const v=el.value.trim();if(v&&!list.includes(v)){setSettings(s=>({...s,[key]:[...list,v]}));el.value="";}}} className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-500 text-white">Add</button>
                    </div>
                  </div>
                );
              })}
            </div></Card>
          </>}

          {/* ── ACCESS CONTROL ── */}
          {settingsSection==="access"&&<>
            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text}} className="text-sm font-bold mb-1">Wastage Tab Access</p>
              <p style={{color:t.sub}} className="text-[11px] mb-3">Which roles can log and view wastage records.</p>
              {["admin","factory","agent"].map(role=>{
                const on=(settings?.showWastageTo||["admin","factory"]).includes(role);
                return <div key={role} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                  <div><span style={{color:t.text}} className="text-sm font-medium capitalize">{role}</span>{role==="admin"&&<span style={{color:t.sub}} className="text-[10px] ml-2">always has access</span>}</div>
                <Tog dm={dm} on={role==="admin"?true:on} onChange={()=>{if(role==="admin")return;setSettings(s=>({...s,showWastageTo:on?(s.showWastageTo||[]).filter(r=>r!==role):[...(s.showWastageTo||[]),role]}));}}/>
              </div>;
            })}
            <p style={{color:t.text}} className="text-xs font-semibold mt-4 mb-2">Show cost/loss data in Wastage to:</p>
            {["admin","factory","agent"].map(role=>{
              const key="showWasteCostTo"; const on=(settings?.[key]||["admin"]).includes(role);
              return <div key={role} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                <div><span style={{color:t.text}} className="text-sm font-medium capitalize">{role}</span>{role==="admin"&&<span style={{color:t.sub}} className="text-[10px] ml-2">always visible</span>}</div>
                <Tog dm={dm} on={role==="admin"?true:on} onChange={()=>{if(role==="admin")return;setSettings(s=>({...s,[key]:on?(s[key]||[]).filter(r=>r!==role):[...(s[key]||[]),role]}));}}/>
              </div>;
            })}
            <Hr dm={dm}/>
            <p style={{color:t.text}} className="text-sm font-bold mt-3 mb-1">Price & Financial Visibility</p>
            <p style={{color:t.sub}} className="text-[11px] mb-3">Hidden roles see quantities only — no amounts shown anywhere.</p>
            <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-2">Show prices to:</p>
            {["admin","factory","agent"].map(role=>{
              const on=(settings?.showPricesTo||["admin"]).includes(role);
              return <div key={role} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                <div><span style={{color:t.text}} className="text-sm font-medium capitalize">{role}</span>{role==="admin"&&<span style={{color:t.sub}} className="text-[10px] ml-2">always visible</span>}</div>
                <Tog dm={dm} on={role==="admin"?true:on} onChange={()=>{if(role==="admin")return;setSettings(s=>({...s,showPricesTo:on?(s.showPricesTo||[]).filter(r=>r!==role):[...(s.showPricesTo||[]),role]}));}}/>
              </div>;
            })}
            <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mt-4 mb-2">Show financial summaries to:</p>
            {["admin","factory","agent"].map(role=>{
              const on=(settings?.showFinancialsTo||["admin"]).includes(role);
              return <div key={role} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                <div><span style={{color:t.text}} className="text-sm font-medium capitalize">{role}</span>{role==="admin"&&<span style={{color:t.sub}} className="text-[10px] ml-2">always visible</span>}</div>
                <Tog dm={dm} on={role==="admin"?true:on} onChange={()=>{if(role==="admin")return;setSettings(s=>({...s,showFinancialsTo:on?(s.showFinancialsTo||[]).filter(r=>r!==role):[...(s.showFinancialsTo||[]),role]}));}}/>
              </div>;
            })}
          </div></Card>
          </>}

          {/* ── APP BRANDING ── */}
          {settingsSection==="app"&&<>
            <Card dm={dm}><div className="p-4 flex flex-col gap-3">
              <p style={{color:t.text}} className="text-sm font-bold">App Branding</p>
              <Inp dm={dm} label="App Name" value={settings?.appName||""} onChange={e=>setSettings(s=>({...s,appName:e.target.value}))} placeholder="TAS Healthy World"/>
              <Inp dm={dm} label="Subtitle" value={settings?.appSubtitle||""} onChange={e=>setSettings(s=>({...s,appSubtitle:e.target.value}))} placeholder="Paratha Factory · Operations"/>
              <Inp dm={dm} label="Emoji/Icon" value={settings?.appEmoji||""} onChange={e=>setSettings(s=>({...s,appEmoji:e.target.value}))} placeholder="🫓"/>
              <Inp dm={dm} label="Company Name (invoices)" value={settings?.companyName||""} onChange={e=>setSettings(s=>({...s,companyName:e.target.value}))} placeholder="TAS Healthy World"/>
              <Inp dm={dm} label="Company Subtitle (invoices)" value={settings?.companySubtitle||""} onChange={e=>setSettings(s=>({...s,companySubtitle:e.target.value}))} placeholder="Malabar Paratha Factory · Goa, India"/>
            </div></Card>
            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text}} className="text-sm font-bold mb-3">Dashboard Widgets</p>
              {[{key:"stats",label:"Stat Cards"},{key:"chart",label:"Revenue Chart"},{key:"pendingDeliveries",label:"Pending Deliveries"},{key:"outstanding",label:"Outstanding Payments"},{key:"wastageToday",label:"Today's Wastage"}].map(w=>{
                const on=(settings?.dashWidgets||[]).includes(w.key);
                return <div key={w.key} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                  <span style={{color:t.text}} className="text-sm">{w.label}</span>
                  <Tog dm={dm} on={on} onChange={()=>setSettings(s=>({...s,dashWidgets:on?(s.dashWidgets||[]).filter(k=>k!==w.key):[...(s.dashWidgets||[]),w.key]}))}/>
                </div>;
              })}
            </div></Card>
          </>}

          {/* ── DATA / BACKUP ── */}
          {settingsSection==="data"&&<>
            <Card dm={dm}><div className="p-4 flex flex-col gap-3">
              <p style={{color:t.text}} className="text-sm font-bold">Backup & Restore</p>
              <Btn dm={dm} v="outline" className="w-full" onClick={exportAll}>⬇️ Export Full Backup (JSON)</Btn>
              <Btn v="purple" className="w-full" onClick={exportFullReport}>📊 Export Full Report (PDF — All Data)</Btn>
              <label style={{border:`1px solid ${t.border}`,color:t.text}} className="w-full text-sm font-semibold rounded-xl px-4 py-2.5 text-center cursor-pointer hover:opacity-80 transition-all">
                ⬆️ Import Backup (JSON)<input type="file" accept=".json" className="hidden" onChange={importAll}/>
              </label>
              <Hr dm={dm}/>
              <p style={{color:t.text}} className="text-sm font-bold">Export as CSV</p>
              <div className="flex gap-2 flex-wrap">
                <Btn dm={dm} v="success" size="sm" onClick={()=>exportCSV(customers,"customers",[{label:"Name",key:"name"},{label:"Phone",key:"phone"},{label:"Address",key:"address"},{label:"Paid",key:"paid"},{label:"Pending",key:"pending"},{label:"Status",val:r=>r.pending>0?"UNPAID":"PAID"},{label:"Join Date",key:"joinDate"},{label:"Notes",key:"notes"}])}>Customers</Btn>
                <Btn dm={dm} v="success" size="sm" onClick={()=>exportCSV(deliveries,"deliveries",[{label:"Customer",key:"customer"},{label:"Date",key:"date"},{label:"Deliver By",key:"deliveryDate"},{label:"Status",key:"status"},{label:"Total",val:r=>lineTotal(r.orderLines)},{label:"Replacement",val:r=>r.replacement?.done?"Yes":"No"},{label:"Repl Amount",val:r=>r.replacement?.amount||""},{label:"Address",key:"address"},{label:"By",key:"createdBy"}])}>Deliveries</Btn>
                <Btn dm={dm} v="success" size="sm" onClick={()=>exportCSV(supplies,"supplies",[{label:"Item",key:"item"},{label:"Qty",key:"qty"},{label:"Unit",key:"unit"},{label:"Supplier",key:"supplier"},{label:"Cost",key:"cost"},{label:"Date",key:"date"}])}>Supplies</Btn>
                <Btn dm={dm} v="success" size="sm" onClick={()=>exportCSV(expenses,"expenses",[{label:"Category",key:"category"},{label:"Amount",key:"amount"},{label:"Date",key:"date"},{label:"Notes",key:"notes"}])}>Expenses</Btn>
                <Btn dm={dm} v="success" size="sm" onClick={()=>exportCSV(actLog,"activity",[{label:"Time",key:"ts"},{label:"User",key:"user"},{label:"Role",key:"role"},{label:"Action",key:"action"},{label:"Detail",key:"detail"}])}>Activity Log</Btn>
              </div>
            </div></Card>
            <Card dm={dm}><div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p style={{color:t.text}} className="text-sm font-bold">Activity Log <span style={{color:t.sub}} className="font-normal text-xs">({actLog.length})</span></p>
                <div className="flex gap-3">
                  <button onClick={()=>exportCSV(actLog,"activity",[{label:"Time",key:"ts"},{label:"User",key:"user"},{label:"Role",key:"role"},{label:"Action",key:"action"},{label:"Detail",key:"detail"}])} style={{color:"#10b981"}} className="text-[11px] font-semibold">Export CSV</button>
                  <button onClick={()=>ask("Clear entire activity log?",()=>{setAct([]);notify("Log cleared");})} style={{color:"#ef4444"}} className="text-[11px] font-semibold">Clear</button>
                </div>
              </div>
              {actLog.length===0?<p style={{color:t.sub}} className="text-xs text-center py-3">No activity yet.</p>
                :actLog.slice(0,200).map(l=>(
                <div key={l.id} style={{borderBottom:`1px solid ${t.border}`}} className="py-2 last:border-0">
                  <div className="flex items-start justify-between gap-2"><span style={{color:t.text}} className="text-xs font-semibold flex-1">{l.action}</span><span style={{color:t.sub}} className="text-[10px] shrink-0">{l.user} · {l.role}</span></div>
                  <div className="flex items-start justify-between gap-2 mt-0.5"><span style={{color:t.sub}} className="text-[11px] flex-1">{l.detail}</span><span style={{color:t.sub}} className="text-[10px] shrink-0">{l.ts}</span></div>
                </div>
              ))}
            </div></Card>
            <Card dm={dm}><div className="p-4">
              <p style={{color:"#ef4444"}} className="text-sm font-bold mb-1">⚠️ Danger Zone</p>
              <p style={{color:t.sub}} className="text-[11px] mb-3">This will wipe all data and reset to factory defaults. Cannot be undone.</p>
              <Btn v="danger" className="w-full" onClick={()=>ask("Reset ALL data to factory defaults? Cannot be undone.",()=>{setCust(D_CUST);setDeliv(D_DELIV);setSup(D_SUP);setExp(D_EXP);setProd(D_PRODS);setWaste(D_WASTE);const r=[{id:uid(),user:sess.name,role:sess.role,action:"FULL RESET",detail:"All data reset to defaults",ts:ts()}];setAct(r);notify("Reset complete");})}>Reset All Data to Defaults</Btn>
            </div></Card>
          </>}
          </>;
        })()}
      </div>

      {/* ── MOBILE BOTTOM NAV (visible only below lg) ─────────── */}
      {/* More menu overlay — tapping outside closes it */}
      {showMoreNav&&<div className="fixed inset-0 z-40 lg:hidden" onClick={()=>setShowMoreNav(false)}/>}
      <nav style={{background:t.card,borderTop:`1px solid ${t.border}`,paddingBottom:"env(safe-area-inset-bottom)",boxShadow:"0 -4px 20px rgba(0,0,0,0.08)"}} className="fixed bottom-0 left-0 right-0 z-50 lg:hidden flex">
        {TABS.slice(0,5).map(tb=>(
          <button key={tb} onClick={()=>{setTab(tb);setSrch("");setShowMoreNav(false);}} className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-all relative"
            style={{color:tab===tb?t.accent:t.sub}}>
            {tab===tb&&<span style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:32,height:2,background:t.accent,borderRadius:"0 0 4px 4px"}}/>}
            <span className="text-lg leading-none">{TAB_ICONS[tb]||"•"}</span>
            <span className="text-[9px] font-semibold leading-none mt-0.5">{tb.length>8?tb.slice(0,7)+"…":tb}</span>
          </button>
        ))}
        {TABS.length>5&&(
          <div className="flex-1 relative">
            <button onClick={()=>setShowMoreNav(v=>!v)} style={{color:TABS.slice(5).includes(tab)?t.accent:t.sub}} className="w-full flex flex-col items-center justify-center py-2.5 gap-0.5 transition-all relative">
              {TABS.slice(5).includes(tab)&&<span style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:32,height:2,background:t.accent,borderRadius:"0 0 4px 4px"}}/>}
              <span className="text-lg leading-none">⋯</span>
              <span className="text-[9px] font-semibold leading-none">{TABS.slice(5).includes(tab)?tab:"More"}</span>
            </button>
            {/* More menu popup — only shown when toggled */}
            {showMoreNav&&(
              <div style={{background:t.card,border:`1px solid ${t.border}`,bottom:"100%",right:0,minWidth:160,boxShadow:"0 -8px 32px rgba(0,0,0,0.15)"}} className="absolute flex flex-col rounded-2xl overflow-hidden mb-2 z-50">
                {TABS.slice(5).map(tb=>(
                  <button key={tb} onClick={()=>{setTab(tb);setSrch("");setShowMoreNav(false);}} style={{color:tab===tb?t.accent:t.text,background:tab===tb?dm?"rgba(245,158,11,0.12)":"rgba(245,158,11,0.08)":"transparent"}} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-left active:opacity-70 transition-opacity">
                    <span className="text-base">{TAB_ICONS[tb]||"•"}</span>{tb}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      </div>{/* end desktop flex child */}
    </div>{/* end outer flex */}

      {/* ═══════ SHEETS ═══════ */}

      {/* Customer Sheet */}
      <Sheet dm={dm} open={!!cSh} onClose={()=>setCsh(null)} title={cSh==="add"?"New Customer":"Edit Customer"}>
        <Inp dm={dm} label="Name *" value={cF.name} onChange={e=>setCf({...cF,name:e.target.value})} placeholder="Business or customer name"/>
        <Inp dm={dm} label="Phone" value={cF.phone} onChange={e=>setCf({...cF,phone:e.target.value})} placeholder="Mobile number"/>
        <Inp dm={dm} label="Address" value={cF.address} onChange={e=>setCf({...cF,address:e.target.value})} placeholder="Full delivery address"/>
        <div className="grid grid-cols-2 gap-3">
          <Inp dm={dm} label="GPS Lat" value={cF.lat} onChange={e=>setCf({...cF,lat:e.target.value})} placeholder="15.4989"/>
          <Inp dm={dm} label="GPS Lng" value={cF.lng} onChange={e=>setCf({...cF,lng:e.target.value})} placeholder="73.8278"/>
        </div>
        <Inp dm={dm} label="Customer Since" type="date" value={cF.joinDate} onChange={e=>setCf({...cF,joinDate:e.target.value})}/>
        <p style={{color:t.sub}} className="text-[11px]">💡 Long-press location in Google Maps → copy coordinates.</p>
        <Hr dm={dm}/>
        <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider">Regular Order</p>
        <OrderEditor dm={dm} products={products} orderLines={cF.orderLines||{}} showPrice={canSeePrices} onChange={ol=>setCf(f=>({...f,orderLines:ol}))}/>
        <Hr dm={dm}/>
        {canSeeFinancials&&<div className="grid grid-cols-2 gap-3">
          <Inp dm={dm} label="Amount Paid (₹)" type="number" value={cF.paid} onChange={e=>setCf({...cF,paid:e.target.value})}/>
          <Inp dm={dm} label="Amount Pending (₹)" type="number" value={cF.pending} onChange={e=>setCf({...cF,pending:e.target.value})}/>
        </div>}
        <Inp dm={dm} label="Notes" value={cF.notes} onChange={e=>setCf({...cF,notes:e.target.value})} placeholder="Special instructions…"/>
        <Sel dm={dm} label="Status" value={cF.active?"active":"inactive"} onChange={e=>setCf({...cF,active:e.target.value==="active"})}>
          <option value="active">Active</option><option value="inactive">Inactive</option>
        </Sel>
        <Btn dm={dm} onClick={saveC} className="w-full">Save Customer</Btn>
      </Sheet>

      {/* Customer View */}
      <Sheet dm={dm} open={!!cView} onClose={()=>setCView(null)} title="Customer Profile">
        {cView&&(()=>{
          const rows=lineRows(cView.orderLines,products);const tot=lineTotal(cView.orderLines);
          return (<>
            <div className="flex items-center gap-3">
              <div style={{background:t.inp}} className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black text-amber-500">{cView.name[0]}</div>
              <div><p style={{color:t.text}} className="font-bold">{cView.name}</p><p style={{color:t.sub}} className="text-xs">{cView.phone}</p></div>
            </div>
            <Hr dm={dm}/>
            {[["Address",cView.address||"—"],["Phone",cView.phone||"—"],["Since",cView.joinDate||"—"],["Notes",cView.notes||"—"]].map(([k,v])=>(
              <div key={k} className="flex justify-between text-sm py-1"><span style={{color:t.sub}}>{k}</span><span style={{color:t.text}} className="font-semibold text-right max-w-[65%]">{v}</span></div>
            ))}
            <Hr dm={dm}/>
            <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider">Regular Order</p>
            {rows.length===0?<p style={{color:t.sub}} className="text-xs">No items</p>:rows.map(r=>(
              <div key={r.id} className="flex justify-between text-sm py-0.5">
                <span style={{color:t.sub}}>{r.qty} × {r.name}{canSeePrices?` @ ${inr(r.priceAmount)}`:""}</span>
                {canSeePrices&&<span style={{color:t.text}} className="font-bold">{inr(r.qty*r.priceAmount)}</span>}
              </div>
            ))}
            {canSeePrices&&tot>0&&<div style={{background:t.inp}} className="rounded-xl p-3 flex justify-between text-sm font-bold"><span style={{color:t.sub}}>Order value</span><span className="text-amber-500">{inr(tot)}</span></div>}
            {canSeeFinancials&&<div className="flex gap-2">
              <div style={{background:"#10b98120"}} className="flex-1 rounded-xl p-3 text-center"><p className="font-bold text-emerald-500">{inr(cView.paid)}</p><p style={{color:t.sub}} className="text-[10px]">Paid</p></div>
              <div style={{background:cView.pending>0?"#ef444420":"#10b98120"}} className="flex-1 rounded-xl p-3 text-center"><p className={cx("font-bold",cView.pending>0?"text-red-500":"text-emerald-500")}>{inr(cView.pending)}</p><p style={{color:t.sub}} className="text-[10px]">Due</p></div>
              <div style={{background:cView.pending>0?"#ef444420":"#10b98120"}} className="flex-1 rounded-xl p-3 text-center"><p className={cx("text-xs font-black",cView.pending>0?"text-red-500":"text-emerald-500")}>{cView.pending>0?"UNPAID":"✓ PAID"}</p><p style={{color:t.sub}} className="text-[10px]">Status</p></div>
            </div>}
            <Hr dm={dm}/>
            <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider">Delivery History</p>
            {deliveries.filter(d=>d.customerId===cView.id).length===0?<p style={{color:t.sub}} className="text-xs">No deliveries yet.</p>
              :deliveries.filter(d=>d.customerId===cView.id).map(d=>(
              <div key={d.id} className="flex justify-between text-xs py-1.5" style={{borderBottom:`1px solid ${t.border}`}}>
                <span style={{color:t.sub}}>{d.date}{canSeePrices?` · ${inr(lineTotal(d.orderLines))}`:" · "+Object.values(safeO(d.orderLines)).reduce((s,l)=>s+(l.qty||0),0)+" items"}</span>
                <Pill dm={dm} c={d.status==="Delivered"?"green":d.status==="In Transit"?"blue":"amber"}>{d.status}</Pill>
              </div>
            ))}
            <div className="flex gap-2">
              {cView.address&&<a href={mapU(cView.address,cView.lat,cView.lng)} target="_blank" rel="noopener noreferrer" className="flex-1"><Btn dm={dm} v="outline" className="w-full">📍 Maps</Btn></a>}
              <Btn v="purple" className="flex-1" onClick={()=>exportPDF(cView,products,"customer",settings)}>PDF</Btn>
              <Btn v="sky" className="flex-1" onClick={()=>exportWord(cView,products,"customer",settings)}>Word</Btn>
            </div>
          </>);
        })()}
      </Sheet>

      {/* Delivery Sheet */}
      <Sheet dm={dm} open={!!dSh} onClose={()=>setDsh(null)} title={dSh==="add"?"New Delivery":"Edit Delivery"}>
        <Sel dm={dm} label="Customer *" value={dF.customer} onChange={e=>pickCust(e.target.value)}>
          <option value="">— Select customer —</option>
          {customers.filter(c=>c.active).map(c=><option key={c.id}>{c.name}</option>)}
        </Sel>
        {dF.address&&<div style={{background:"#0ea5e915",border:"1px solid #0ea5e940"}} className="rounded-xl px-3.5 py-2.5 text-xs text-sky-400 flex items-center justify-between"><span>📍 {dF.address}</span><a href={mapU(dF.address,dF.lat,dF.lng)} target="_blank" rel="noopener noreferrer" className="underline font-semibold ml-2 shrink-0">Maps</a></div>}
        <Hr dm={dm}/>
        <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider">Items{canSeePrices?" — Tap price to select":""}</p>
        <OrderEditor dm={dm} products={products} orderLines={dF.orderLines||{}} showPrice={canSeePrices} onChange={ol=>setDf(f=>({...f,orderLines:ol}))}/>
        <Hr dm={dm}/>
        <div className="grid grid-cols-2 gap-3">
          <Inp dm={dm} label="Order Date" type="date" value={dF.date} onChange={e=>setDf({...dF,date:e.target.value})}/>
          <Inp dm={dm} label="Deliver By (optional)" type="date" value={dF.deliveryDate||""} onChange={e=>setDf({...dF,deliveryDate:e.target.value})}/>
        </div>
        <Sel dm={dm} label="Status" value={dF.status} onChange={e=>setDf({...dF,status:e.target.value})}>
          {delivStats.map(s=><option key={s}>{s}</option>)}
        </Sel>
        <Inp dm={dm} label="Notes" value={dF.notes} onChange={e=>setDf({...dF,notes:e.target.value})} placeholder="e.g. Leave at gate, call before"/>
        <Hr dm={dm}/>
        {/* REPLACEMENT SECTION */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider">Replacement</p>
            <button
              onClick={()=>setDf(f=>({...f,replacement:{...(f.replacement||{}),done:!(f.replacement?.done)}}))}
              style={dF.replacement?.done?{background:"#f97316",color:"#fff"}:{background:t.inp,color:t.sub}}
              className="text-xs font-semibold px-3 py-1 rounded-lg transition-all">
              {dF.replacement?.done?"✓ Replacement Done":"Mark as Replaced"}
            </button>
          </div>
          {dF.replacement?.done&&(
            <div className="flex flex-col gap-3">
              <p style={{color:t.sub}} className="text-[11px]">Fill in what was replaced and why — this will show on the delivery card and be exportable.</p>
              <Inp dm={dm} label="Replacement Item" value={dF.replacement?.item||""} onChange={e=>setDf(f=>({...f,replacement:{...(f.replacement||{}),item:e.target.value}}))} placeholder="e.g. Roti replaced with Paratha Pack"/>
              <div className="grid grid-cols-2 gap-3">
                <Inp dm={dm} label="Qty Replaced" value={dF.replacement?.qty||""} onChange={e=>setDf(f=>({...f,replacement:{...(f.replacement||{}),qty:e.target.value}}))} placeholder="e.g. 10 pcs"/>
                <Inp dm={dm} label="Amount Diff (₹)" type="number" value={dF.replacement?.amount||""} onChange={e=>setDf(f=>({...f,replacement:{...(f.replacement||{}),amount:e.target.value}}))} placeholder="e.g. 50"/>
              </div>
              {(+dF.replacement?.amount)>0&&<div style={{background:"#f9731620",border:"1px solid #f9741640"}} className="rounded-xl px-3 py-2"><p className="text-[11px] text-orange-500 font-semibold">💡 {inr(+dF.replacement.amount)} will be deducted from customer pending on save.</p></div>}
              <Inp dm={dm} label="Reason for Replacement" value={dF.replacement?.reason||""} onChange={e=>setDf(f=>({...f,replacement:{...(f.replacement||{}),reason:e.target.value}}))} placeholder="e.g. Customer requested, out of stock…"/>
            </div>
          )}
        </div>
        <Btn dm={dm} onClick={saveD} className="w-full">Save Delivery</Btn>
      </Sheet>

      {/* Supply Sheet */}
      <Sheet dm={dm} open={!!sSh} onClose={()=>setSsh(null)} title={sSh==="add"?"Log Supply":"Edit Supply"}>
        <Inp dm={dm} label="Item *" value={sF.item} onChange={e=>setSf({...sF,item:e.target.value})} placeholder="e.g. Wheat Flour"/>
        <div className="grid grid-cols-2 gap-3">
          <Inp dm={dm} label="Quantity" type="number" value={sF.qty} onChange={e=>setSf({...sF,qty:e.target.value})}/>
          <Sel dm={dm} label="Unit" value={sF.unit} onChange={e=>setSf({...sF,unit:e.target.value})}>
            {supUnits.map(u=><option key={u}>{u}</option>)}
          </Sel>
        </div>
        <Inp dm={dm} label="Supplier" value={sF.supplier} onChange={e=>setSf({...sF,supplier:e.target.value})}/>
        <div className="grid grid-cols-2 gap-3">
          <Inp dm={dm} label="Cost (₹)" type="number" value={sF.cost} onChange={e=>setSf({...sF,cost:e.target.value})}/>
          <Inp dm={dm} label="Date" type="date" value={sF.date} onChange={e=>setSf({...sF,date:e.target.value})}/>
        </div>
        <Inp dm={dm} label="Notes" value={sF.notes} onChange={e=>setSf({...sF,notes:e.target.value})}/>
        <Btn dm={dm} onClick={saveS} className="w-full">Save Supply</Btn>
      </Sheet>

      {/* Expense Sheet */}
      <Sheet dm={dm} open={!!eSh} onClose={()=>setEsh(null)} title={eSh==="add"?"Log Expense":"Edit Expense"}>
        <Sel dm={dm} label="Category" value={eF.category} onChange={e=>setEf({...eF,category:e.target.value})}>
          {expCats.map(c=><option key={c}>{c}</option>)}
        </Sel>
        <Inp dm={dm} label="Amount (₹) *" type="number" value={eF.amount} onChange={e=>setEf({...eF,amount:e.target.value})}/>
        <Inp dm={dm} label="Date" type="date" value={eF.date} onChange={e=>setEf({...eF,date:e.target.value})}/>
        <Inp dm={dm} label="Notes" value={eF.notes} onChange={e=>setEf({...eF,notes:e.target.value})}/>
        <div>
          <label style={{color:t.sub}} className="block text-[11px] font-semibold uppercase tracking-wider mb-1">Receipt / Reference Note</label>
          <input value={eF.receipt||""} onChange={e=>setEf({...eF,receipt:e.target.value})} placeholder="Bill no., vendor name, or short description…" style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text}} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-400 transition-all placeholder:opacity-30"/>
          <p style={{color:t.sub}} className="text-[11px] mt-1">📎 Add bill number, vendor name, or any reference for this expense</p>
        </div>
        <Btn dm={dm} onClick={saveE} className="w-full">Save Expense</Btn>
      </Sheet>

      {/* Product Sheet */}
      <Sheet dm={dm} open={!!pSh} onClose={()=>setPsh(null)} title={pSh==="add"?"Add Product":"Edit Product"}>
        <Inp dm={dm} label="Product Name *" value={pF.name} onChange={e=>setPf({...pF,name:e.target.value})} placeholder="e.g. Paratha Pack 5 pcs"/>
        <Inp dm={dm} label="Product ID *" value={pF.id} onChange={e=>setPf({...pF,id:e.target.value})} placeholder="e.g. paratha5 (no spaces)"/>
        <Sel dm={dm} label="Unit" value={pF.unit} onChange={e=>setPf({...pF,unit:e.target.value})}>
          {["pcs","pack","kg","box","dozen","L"].map(u=><option key={u}>{u}</option>)}
        </Sel>
        <Hr dm={dm}/>
        <div className="flex items-center justify-between">
          <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider">Price Options</p>
          <button onClick={()=>setPf(f=>({...f,prices:[...f.prices,""]}))} className="text-xs font-semibold text-amber-500">+ Add Price</button>
        </div>
        <p style={{color:t.sub}} className="text-[11px]">Enter all prices for this product. When making an order, user taps to pick which applies.</p>
        <div className="flex flex-wrap gap-2">
          {pF.prices.map((pr,i)=>(
            <div key={i} className="flex items-center gap-1">
              <span style={{color:t.sub}} className="text-xs">₹</span>
              <input type="number" value={pr} placeholder="0" onChange={e=>setPf(f=>({...f,prices:f.prices.map((x,j)=>j===i?e.target.value:x)}))}
                style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,width:72}}
                className="rounded-xl px-2 py-1.5 text-sm text-center outline-none focus:ring-2 focus:ring-amber-400"/>
              {pF.prices.length>1&&<button onClick={()=>setPf(f=>({...f,prices:f.prices.filter((_,j)=>j!==i)}))} className="text-red-500 font-bold text-base leading-none">✕</button>}
            </div>
          ))}
        </div>
        <Btn dm={dm} onClick={saveP} className="w-full">Save Product</Btn>
      </Sheet>

      {/* Change Password Sheet */}
      <Sheet dm={dm} open={changePwSh} onClose={()=>setChangePwSh(false)} title="Change Password">
        <Inp dm={dm} label="Current Password" type="password" value={changePwF.current} onChange={e=>setChangePwF(f=>({...f,current:e.target.value}))} placeholder="Enter current password"/>
        <Inp dm={dm} label="New Password" type="password" value={changePwF.next} onChange={e=>setChangePwF(f=>({...f,next:e.target.value}))} placeholder="Min 6 characters"/>
        <Inp dm={dm} label="Confirm New Password" type="password" value={changePwF.confirm} onChange={e=>setChangePwF(f=>({...f,confirm:e.target.value}))} placeholder="Repeat new password"/>
        <Btn dm={dm} onClick={()=>{
          const me=users.find(u=>u.id===sess.id);
          if(!me){notify("User not found");return;}
          if(!checkPw(changePwF.current,me.password)){notify("Current password is incorrect");return;}
          if(changePwF.next.length<6){notify("New password must be at least 6 characters");return;}
          if(changePwF.next!==changePwF.confirm){notify("Passwords don't match");return;}
          setUsers(p=>p.map(u=>u.id===sess.id?{...u,password:hashPw(changePwF.next)}:u));
          addLog("Changed password","Own account");
          notify("Password changed ✓");
          setChangePwSh(false);
          setChangePwF({current:"",next:"",confirm:""});
        }} className="w-full">Update Password</Btn>
      </Sheet>

      {/* User Sheet */}
      <Sheet dm={dm} open={!!uSh} onClose={()=>setUsh(null)} title={uSh==="add"?(uF.role==="factory"?"New Factory Staff Account":uF.role==="agent"?"New Delivery Agent Account":"New User"):(uF.role==="factory"?"Edit Factory Staff":uF.role==="agent"?"Edit Delivery Agent":"Edit User")}>
        {/* Basic info */}
        <div style={{background:t.inp,borderRadius:14,padding:"14px 16px"}} className="flex flex-col gap-3">
          <p style={{color:t.sub}} className="text-[11px] font-bold uppercase tracking-wider">Basic Info</p>
          <Inp dm={dm} label="Full Name *" value={uF.name} onChange={e=>setUf({...uF,name:e.target.value})} placeholder="e.g. Ravi Kumar"/>
          <Inp dm={dm} label="Username *" value={uF.username} onChange={e=>setUf({...uF,username:e.target.value.toLowerCase().replace(/\s/g,"")})} placeholder="lowercase, no spaces"/>
          <Inp dm={dm} label={uSh==="add"?"Password *":"New Password (blank = keep)"} type="password" value={uF.password} onChange={e=>setUf({...uF,password:e.target.value})} placeholder="Min 6 characters"/>
        </div>
        {/* Role selector */}
        <div style={{background:t.inp,borderRadius:14,padding:"14px 16px"}}>
          <p style={{color:t.sub}} className="text-[11px] font-bold uppercase tracking-wider mb-3">Role</p>
          <div className="grid grid-cols-3 gap-2">
            {[{val:"agent",icon:"🚚",label:"Delivery Agent",desc:"On the road"},{val:"factory",icon:"🏭",label:"Factory Staff",desc:"In the kitchen"},{val:"admin",icon:"🔐",label:"Admin",desc:"Full access"}].map(({val,icon,label,desc})=>(
              <button key={val} onClick={()=>setUf({...uF,role:val,permissions:[...(ROLE_DEF[val]||ROLE_DEF.agent)]})}
                style={{background:uF.role===val?(val==="admin"?"#f59e0b":val==="factory"?"#a855f7":"#0ea5e9")+"22":t.card,border:`2px solid ${uF.role===val?(val==="admin"?"#f59e0b":val==="factory"?"#a855f7":"#0ea5e9"):t.border}`,borderRadius:12,padding:"10px 6px",textAlign:"center",transition:"all 0.15s"}}>
                <div className="text-xl mb-1">{icon}</div>
                <p style={{color:uF.role===val?(val==="admin"?"#f59e0b":val==="factory"?"#a855f7":"#0ea5e9"):t.text,fontSize:11,fontWeight:700,lineHeight:1.2}}>{label}</p>
                <p style={{color:t.sub,fontSize:10}}>{desc}</p>
              </button>
            ))}
          </div>
        </div>
        {/* Permissions — plain English for factory/agent, raw tabs for admin */}
        {uF.role!=="admin"&&(()=>{
          const PERM_MAP = uF.role==="factory" ? [
            {tab:"Customers",  label:"View Customers",       desc:"See customer list & profiles",    icon:"👥"},
            {tab:"Deliveries", label:"Manage Deliveries",    desc:"Create & update delivery orders", icon:"🚚"},
            {tab:"Supplies",   label:"Log Supplies",         desc:"Record incoming stock",            icon:"📦"},
            {tab:"Wastage",    label:"Log Wastage",          desc:"Record wasted products",           icon:"🗑️"},
            {tab:"Production", label:"Track Production",     desc:"Log shift targets & output",       icon:"📋"},
            {tab:"Dashboard",  label:"View Dashboard",       desc:"See today's summary",              icon:"📊"},
            {tab:"Expenses",   label:"Log Expenses",         desc:"Record operational expenses",      icon:"💸"},
            {tab:"Analytics",  label:"View Analytics",       desc:"Charts & performance data",        icon:"🔍"},
            {tab:"P&L",        label:"View P&L Report",      desc:"Profit & loss breakdown",          icon:"📈"},
          ] : [
            {tab:"Customers",  label:"View Customers",       desc:"See who they're delivering to",   icon:"👥"},
            {tab:"Deliveries", label:"Manage Deliveries",    desc:"Update delivery status on the go", icon:"🚚"},
            {tab:"Dashboard",  label:"View Dashboard",       desc:"See today's delivery summary",     icon:"📊"},
            {tab:"Wastage",    label:"Report Wastage",       desc:"Log damaged items on route",       icon:"🗑️"},
            {tab:"Supplies",   label:"View Supplies",        desc:"Check stock levels",               icon:"📦"},
          ];
          return <div style={{background:t.inp,borderRadius:14,padding:"14px 16px"}}>
            <p style={{color:t.sub}} className="text-[11px] font-bold uppercase tracking-wider mb-1">What can they do?</p>
            <p style={{color:t.sub}} className="text-[11px] mb-3">Turn off anything this person doesn't need to see.</p>
            {PERM_MAP.map(({tab,label,desc,icon})=>{
              const on=(uF.permissions||[]).includes(tab);
              return <div key={tab} className="flex items-center gap-3 py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                <span className="text-base w-6 text-center shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p style={{color:t.text}} className="text-sm font-semibold">{label}</p>
                  <p style={{color:t.sub}} className="text-[11px]">{desc}</p>
                </div>
                <Tog dm={dm} on={on} onChange={()=>{const p=uF.permissions||[];setUf({...uF,permissions:on?p.filter(x=>x!==tab):[...p,tab]});}}/>
              </div>;
            })}
          </div>;
        })()}
        {uF.role==="admin"&&<div style={{background:"#f59e0b11",border:"1px solid #f59e0b33",borderRadius:14,padding:"12px 16px"}}>
          <p style={{color:"#f59e0b"}} className="text-xs font-bold">🔐 Admin — Full Access</p>
          <p style={{color:t.sub}} className="text-[11px] mt-0.5">Admins always have access to all tabs and features. No restrictions apply.</p>
        </div>}
        {/* Status */}
        <div style={{background:t.inp,borderRadius:14,padding:"14px 16px"}} className="flex items-center justify-between">
          <div>
            <p style={{color:t.text}} className="text-sm font-semibold">Account Active</p>
            <p style={{color:t.sub}} className="text-[11px]">{uF.active?"This person can currently log in":"Account is disabled — cannot log in"}</p>
          </div>
          <Tog dm={dm} on={uF.active} onChange={()=>setUf({...uF,active:!uF.active})}/>
        </div>
        <Hr dm={dm}/>
        {/* Sub-staff names */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div>
              <label style={{color:t.sub}} className="block text-[11px] font-semibold uppercase tracking-wider">Multiple Staff on This Account</label>
              <p style={{color:t.sub}} className="text-[11px] mt-0.5">Add names so staff can pick who's using the device — handy for shared phones.</p>
            </div>
            <button onClick={()=>setUf(f=>({...f,subStaff:[...(f.subStaff||[]),""]}))} className="text-xs font-semibold text-amber-500 shrink-0 ml-2">+ Add</button>
          </div>
          {(uF.subStaff||[]).length===0
            ?<p style={{color:t.sub}} className="text-[11px] italic">No sub-staff — shows as "{uF.name||"user name"}" only.</p>
            :(uF.subStaff||[]).map((name,i)=>(
              <div key={i} className="flex items-center gap-2 mt-2">
                <input value={name} placeholder={`Staff member ${i+1} name`}
                  onChange={e=>setUf(f=>({...f,subStaff:f.subStaff.map((x,j)=>j===i?e.target.value:x)}))}
                  style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,flex:1}}
                  className="rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400"/>
                <button onClick={()=>setUf(f=>({...f,subStaff:f.subStaff.filter((_,j)=>j!==i)}))} className="text-red-500 font-bold text-lg leading-none px-1">✕</button>
              </div>
            ))
          }
        </div>
        <Btn dm={dm} onClick={saveU} className="w-full">Save Account</Btn>
      </Sheet>

      {/* Wastage Sheet */}
      <Sheet dm={dm} open={!!wSh} onClose={()=>setWSh(null)} title={wSh==="add"?"Log Wastage":"Edit Wastage Record"}>
        <Inp dm={dm} label="Product / Item *" value={wF.product} onChange={e=>setWF({...wF,product:e.target.value})} placeholder="e.g. Roti, Paratha Pack…"/>
        <div className="grid grid-cols-2 gap-3">
          <Inp dm={dm} label="Quantity *" type="number" value={wF.qty} onChange={e=>setWF({...wF,qty:e.target.value})} placeholder="e.g. 15"/>
          <Sel dm={dm} label="Unit" value={wF.unit} onChange={e=>setWF({...wF,unit:e.target.value})}>
            {(settings?.supplyUnits||["pcs","kg","pack","L"]).map(u=><option key={u}>{u}</option>)}
          </Sel>
        </div>
        <Sel dm={dm} label="Wastage Type *" value={wF.type} onChange={e=>setWF({...wF,type:e.target.value})}>
          {(settings?.wastageTypes||["Burnt","Broken","Expired","Overproduced","Quality Reject","Other"]).map(t=><option key={t}>{t}</option>)}
        </Sel>
        <Sel dm={dm} label="Shift" value={wF.shift} onChange={e=>setWF({...wF,shift:e.target.value})}>
          {(settings?.shifts||["Morning","Afternoon","Evening","Night"]).map(s=><option key={s}>{s}</option>)}
        </Sel>
        <div className="grid grid-cols-2 gap-3">
          <Inp dm={dm} label="Date" type="date" value={wF.date} onChange={e=>setWF({...wF,date:e.target.value})}/>
          {isAdmin&&<Inp dm={dm} label="Estimated Cost Loss (₹)" type="number" value={wF.cost} onChange={e=>setWF({...wF,cost:e.target.value})} placeholder="0"/>}
        </div>
        <Inp dm={dm} label="Reason / Notes" value={wF.reason} onChange={e=>setWF({...wF,reason:e.target.value})} placeholder="What caused this wastage? e.g. Overcooked, power cut…"/>
        {/* Quick reference: today's wastage so far */}
        {(()=>{const tw=wastage.filter(w=>w.date===wF.date&&w.id!==(wSh?.id));const tq=tw.reduce((s,w)=>s+(w.qty||0),0);return tq>0&&<div style={{background:t.inp,border:`1px solid ${t.inpB}`}} className="rounded-xl px-3.5 py-2.5">
          <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-1">Already logged on {wF.date}</p>
          {tw.slice(0,4).map(w=><div key={w.id} className="flex justify-between text-xs py-0.5"><span style={{color:t.sub}}>{w.product} — {w.type}</span><span style={{color:t.text}} className="font-semibold">{w.qty} {w.unit}</span></div>)}
          <div style={{borderTop:`1px solid ${t.border}`}} className="mt-1 pt-1 flex justify-between text-xs font-bold"><span style={{color:t.sub}}>Total today</span><span style={{color:"#f97316"}}>{tq} units</span></div>
        </div>})()}
        <Btn dm={dm} onClick={saveW} className="w-full">Save Wastage Record</Btn>
      </Sheet>

      {/* Payment Sheet */}
      <Sheet dm={dm} open={!!paySh} onClose={()=>{setPaySh(null);setPayAmt("");}} title="Record Payment">
        {paySh&&<>
          <p style={{color:t.text}} className="text-sm font-semibold">{paySh.name}</p>
          <div className="flex gap-3"><span className="text-sm text-emerald-500 font-bold">Paid: {inr(paySh.paid)}</span><span className="text-sm text-red-500 font-bold">Due: {inr(paySh.pending)}</span></div>
          <div className="flex gap-2 flex-wrap">{[paySh.pending,500,1000,2000].filter((v,i,a)=>v>0&&a.indexOf(v)===i).map(q=><button key={q} onClick={()=>setPayAmt(String(q))} style={payAmt===String(q)?{background:"#f59e0b",color:"#000"}:{background:t.inp,color:t.text}} className="text-xs font-semibold px-3 py-1.5 rounded-lg">₹{q.toLocaleString("en-IN")}</button>)}</div>
          <Inp dm={dm} label="Amount (₹)" type="number" value={payAmt} onChange={e=>setPayAmt(e.target.value)} placeholder="Enter amount"/>
          <div className="flex gap-2"><Btn dm={dm} v="ghost" className="flex-1" onClick={()=>{setPaySh(null);setPayAmt("");}}>Cancel</Btn><Btn v="success" className="flex-1" onClick={recPay} disabled={!payAmt}>Confirm ₹{payAmt||0}</Btn></div>
        </>}
      </Sheet>


      {/* Production Sheet */}
      <Sheet dm={dm} open={!!ptSh} onClose={()=>setPtSh(null)} title={ptSh==="add"?"Log Production":"Edit Production Record"}>
        <Sel dm={dm} label="Product *" value={ptF.product} onChange={e=>setPtF({...ptF,product:e.target.value})}>
          {products.map(p=><option key={p.id}>{p.name}</option>)}
          <option value="__custom__">Other / Custom</option>
        </Sel>
        {ptF.product==="__custom__"&&<Inp dm={dm} label="Custom Product Name" value={ptF.customProduct||""} onChange={e=>setPtF({...ptF,customProduct:e.target.value})} placeholder="e.g. Special Paratha"/>}
        <Sel dm={dm} label="Shift" value={ptF.shift} onChange={e=>setPtF({...ptF,shift:e.target.value})}>
          {(settings?.shifts||["Morning","Afternoon","Evening","Night"]).map(s=><option key={s}>{s}</option>)}
        </Sel>
        <div className="grid grid-cols-2 gap-3">
          <Inp dm={dm} label="Target (units) *" type="number" value={ptF.target} onChange={e=>setPtF({...ptF,target:e.target.value})} placeholder="e.g. 200"/>
          <Inp dm={dm} label="Actual (units)" type="number" value={ptF.actual} onChange={e=>setPtF({...ptF,actual:e.target.value})} placeholder="Fill after shift"/>
        </div>
        <Inp dm={dm} label="Date" type="date" value={ptF.date} onChange={e=>setPtF({...ptF,date:e.target.value})}/>
        <Inp dm={dm} label="Notes" value={ptF.notes} onChange={e=>setPtF({...ptF,notes:e.target.value})} placeholder="e.g. Machine issue, short staff..."/>
        <Btn dm={dm} onClick={savePT} className="w-full">Save Production Record</Btn>
      </Sheet>
      <Confirm dm={dm} msg={conf?.msg} onYes={()=>{conf?.yes();setConf(null);}} onNo={()=>setConf(null)}/>
      {toast&&<Toast msg={toast} onDone={()=>setToast(null)}/>}
    </>
  );
}
