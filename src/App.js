/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
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
let _timers = {};

function ls(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }
function lsw(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
function lsdel(k) { try { localStorage.removeItem(k); } catch {} }

function useStore(key, def) {
  const defRef = useRef(def);
  // Start with null so we know Firebase hasnt loaded yet
  const [val, setRaw] = useState(null);
  const [fbLoaded, setFbLoaded] = useState(false);

  // Subscribe to Firebase path — fires on every change from any device
  useEffect(() => {
    const r = ref(db, key);
    const unsub = onValue(r, (snap) => {
      if (snap.exists()) {
        const v = snap.val();
        setRaw(v);
        lsw(key, v);
      } else {
        // Nothing in Firebase yet — write the default data in
        const d = defRef.current;
        setRaw(d);
        fbSet(ref(db, key), d).catch(e => console.warn("Firebase seed error:", e.message));
      }
      setFbLoaded(true);
    }, (err) => {
      console.warn("Firebase read error for", key, err.message);
      // Fall back to localStorage if Firebase fails
      setRaw(ls(key, defRef.current));
      setFbLoaded(true);
    });
    return () => unsub();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback((next) => {
    setRaw(prev => {
      const n = typeof next === "function" ? next(prev ?? defRef.current) : next;
      lsw(key, n);
      // Write to Firebase immediately — debounced 400ms to batch fast changes
      clearTimeout(_timers[key]);
      _timers[key] = setTimeout(() => {
        fbSet(ref(db, key), n).catch(e => console.warn("Firebase write error:", e.message));
      }, 400);
      return n;
    });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // While Firebase hasnt loaded yet, show localStorage cache or default
  const safeVal = fbLoaded ? val : (ls(key, defRef.current));
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
const ALL_TABS = ["Dashboard","Customers","Deliveries","Supplies","Expenses","Wastage","Settings"];
const ROLE_DEF = {
  admin:   ALL_TABS,
  factory: ["Customers","Deliveries","Supplies","Wastage"],
  agent:   ["Customers","Deliveries","Wastage"],
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

const D_SUP = [
  {id:"s1",item:"Wheat Flour",  qty:50,unit:"kg",date:"2026-04-10",supplier:"Ram Store",cost:2000,notes:""},
  {id:"s2",item:"Oil (Refined)",qty:20,unit:"L", date:"2026-04-11",supplier:"Agro Mart",cost:1600,notes:""},
];

const D_EXP = [
  {id:"e1",category:"Gas",amount:800,date:"2026-04-10",notes:"Monthly LPG"},
];

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
  // Price visibility: which roles can see prices in order/delivery views
  showPricesTo:["admin","factory","agent"], // admin can remove roles from this list
  // Whether non-admin can see the financial summary (paid/pending/profit)
  showFinancialsTo:["admin"],
  // Expense categories (admin-editable)
  expenseCategories:["Gas","Labour","Transport","Packaging","Utilities","Maintenance","Other"],
  // Delivery status options (admin-editable)
  deliveryStatuses:["Pending","In Transit","Delivered","Cancelled"],
  // Supply units (admin-editable)
  supplyUnits:["kg","g","L","mL","pcs","bags","boxes","dozen"],
  // Company info for invoices
  companyName:"TAS Healthy World",
  companySubtitle:"Malabar Paratha Factory · Goa, India",
  // Wastage: which roles can see wastage tab
  showWastageTo:["admin","factory"],
  // Wastage types (admin-editable)
  wastageTypes:["Burnt","Broken","Expired","Overproduced","Quality Reject","Other"],
};

// Default wastage data
const D_WASTE = [];

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
  const w = window.open("","_blank","width=820,height=960,noopener");
  if (w) { w.document.open(); w.document.write(html); w.document.close(); }
  else alert("Allow pop-ups for this site, then try again.");
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
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([html],{type:"application/msword"})); a.download=`invoice_${name.replace(/\s+/g,"_")}_${today()}.doc`; a.click(); URL.revokeObjectURL(a.href);
}

// ═══════════════════════════════════════════════════════════════
//  THEME
// ═══════════════════════════════════════════════════════════════
const LT={bg:"#faf9f7",card:"#fff",border:"#e7e5e4",text:"#1c1917",sub:"#78716c",inp:"#f5f5f4",inpB:"#e7e5e4"};
const DK={bg:"#0b0b0b",card:"#161616",border:"#242424",text:"#f5f5f4",sub:"#a8a29e",inp:"#1e1e1e",inpB:"#2e2e2e"};
const T=(dm)=>dm?DK:LT;

// ═══════════════════════════════════════════════════════════════
//  UI ATOMS
// ═══════════════════════════════════════════════════════════════
function Pill({c="stone",dm,children}){
  const m={stone:[" bg-stone-100 text-stone-600"," bg-stone-800 text-stone-300"],amber:[" bg-amber-50 text-amber-700"," bg-amber-900/50 text-amber-300"],green:[" bg-emerald-50 text-emerald-700"," bg-emerald-900/50 text-emerald-300"],red:[" bg-red-50 text-red-600"," bg-red-900/50 text-red-300"],sky:[" bg-sky-50 text-sky-700"," bg-sky-900/50 text-sky-300"],blue:[" bg-blue-50 text-blue-700"," bg-blue-900/50 text-blue-300"],purple:[" bg-purple-50 text-purple-700"," bg-purple-900/50 text-purple-300"]};
  return <span className={cx("text-[11px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap select-none",(m[c]||m.stone)[dm?1:0])}>{children}</span>;
}
function Hr({dm}){const t=T(dm);return <div style={{height:1,background:t.border}}/>;}
function Inp({label,dm,className="",...p}){
  const t=T(dm);
  return <div className={className}>{label&&<label style={{color:t.sub}} className="block text-[11px] font-semibold uppercase tracking-wider mb-1">{label}</label>}<input style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text}} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-400 transition-all placeholder:opacity-30" {...p}/></div>;
}
function Sel({label,dm,children,className="",...p}){
  const t=T(dm);
  return <div className={className}>{label&&<label style={{color:t.sub}} className="block text-[11px] font-semibold uppercase tracking-wider mb-1">{label}</label>}<select style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text}} className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-400 transition-all" {...p}>{children}</select></div>;
}
function Btn({children,onClick,v="primary",size="md",className="",disabled=false,dm}){
  const V={primary:dm?"bg-amber-500 text-black hover:bg-amber-400":"bg-stone-900 text-white hover:bg-stone-700",ghost:dm?"bg-stone-800 text-stone-200 hover:bg-stone-700":"bg-stone-100 text-stone-700 hover:bg-stone-200",danger:"bg-red-600 text-white hover:bg-red-500",success:"bg-emerald-500 text-white hover:bg-emerald-400",amber:"bg-amber-500 text-white hover:bg-amber-400",outline:dm?"border border-stone-600 text-stone-200 hover:bg-stone-800":"border border-stone-300 text-stone-700 hover:bg-stone-50",sky:"bg-sky-500 text-white hover:bg-sky-400",purple:"bg-purple-500 text-white hover:bg-purple-400"};
  const S={sm:"px-3 py-1.5 text-xs",md:"px-4 py-2.5 text-sm",lg:"px-5 py-3 text-base"};
  return <button onClick={onClick} disabled={disabled} className={cx("font-semibold rounded-xl transition-all active:scale-[0.97] select-none",V[v]||V.primary,S[size]||S.md,disabled&&"opacity-40 cursor-not-allowed pointer-events-none",className)}>{children}</button>;
}
function Card({children,className="",dm}){const t=T(dm);return <div style={{background:t.card,border:`1px solid ${t.border}`}} className={cx("rounded-2xl shadow-sm",className)}>{children}</div>;}
function StatCard({label,value,sub,accent,dm}){
  const t=T(dm);
  return <div style={{background:t.card,border:`1px solid ${t.border}`,borderTopColor:accent,borderTopWidth:3}} className="rounded-2xl p-4 shadow-sm"><p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-1">{label}</p><p style={{color:t.text}} className="text-2xl font-bold leading-none">{value}</p>{sub&&<p style={{color:t.sub}} className="text-[11px] mt-1">{sub}</p>}</div>;
}
function Sheet({open,title,onClose,children,dm}){
  const t=T(dm);
  useEffect(()=>{if(open){document.body.style.overflow="hidden";document.body.style.position="fixed";document.body.style.width="100%";}return()=>{document.body.style.overflow="";document.body.style.position="";document.body.style.width="";};},[open]);
  if(!open)return null;
  return <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{background:"rgba(0,0,0,0.65)",backdropFilter:"blur(8px)"}}>
    <div style={{background:t.card,maxHeight:"93dvh"}} className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col" onTouchMove={e=>e.stopPropagation()}>
      <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0"><span style={{color:t.text}} className="font-bold text-base">{title}</span><button onClick={onClose} style={{background:t.inp,color:t.sub}} className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold hover:opacity-80">✕</button></div>
      <Hr dm={dm}/>
      <div className="px-5 py-4 flex flex-col gap-3.5" style={{overflowY:"auto",WebkitOverflowScrolling:"touch",overscrollBehavior:"contain"}}>{children}</div>
    </div>
  </div>;
}
function Toast({msg,onDone}){useEffect(()=>{const t=setTimeout(onDone,2600);return()=>clearTimeout(t);});return <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] bg-stone-900 text-white text-sm px-5 py-2.5 rounded-full shadow-2xl font-medium border border-stone-700 whitespace-nowrap pointer-events-none">{msg}</div>;}
function Confirm({msg,onYes,onNo,dm}){
  const t=T(dm);if(!msg)return null;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center px-6" style={{background:"rgba(0,0,0,0.75)",backdropFilter:"blur(10px)"}}>
    <div style={{background:t.card,border:`1px solid ${t.border}`}} className="w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
      <p style={{color:t.text}} className="text-sm font-semibold text-center leading-relaxed">{msg}</p>
      <div className="flex gap-3"><Btn dm={dm} v="ghost" className="flex-1" onClick={onNo}>Cancel</Btn><Btn v="danger" className="flex-1" onClick={onYes}>Confirm</Btn></div>
    </div>
  </div>;
}
function Search({value,onChange,placeholder,dm}){
  const t=T(dm);
  return <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none" style={{color:t.sub}}>🔍</span><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder||"Search…"} style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text}} className="w-full rounded-xl pl-8 pr-8 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-400 placeholder:opacity-30"/>{value&&<button onClick={()=>onChange("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{color:t.sub}}>✕</button>}</div>;
}

// Toggle switch
function Tog({on,onChange,dm}){
  const t=T(dm);
  return <button onClick={onChange} style={{background:on?"#f59e0b":t.inp,border:`1.5px solid ${on?"#f59e0b":t.inpB}`,width:40,height:24,borderRadius:20,padding:2,display:"flex",alignItems:"center",justifyContent:on?"flex-end":"flex-start",flexShrink:0}} className="transition-all"><div style={{width:18,height:18,background:on?"#fff":t.sub,borderRadius:"50%"}} className="transition-all"/></button>;
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
  const t=T(dm);
  const [u,setU]=useState(""); const [p,setP]=useState(""); const [err,setErr]=useState(""); const [busy,setBusy]=useState(false);
  function go(){
    setBusy(true);setErr("");
    setTimeout(()=>{
      const found=users.find(x=>x.username.toLowerCase()===u.trim().toLowerCase()&&checkPw(p,x.password)&&x.active);
      if(found)onLogin({...found,loginAt:Date.now()});
      else setErr("Invalid username or password.");
      setBusy(false);
    },400);
  }
  return (
    <div style={{background:t.bg,minHeight:"100vh"}} className="flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-5xl mb-4 select-none">{settings?.appEmoji||"🫓"}</div>
          <h1 style={{color:t.text}} className="text-2xl font-black tracking-tight">{settings?.appName||"TAS Healthy World"}</h1>
          <p style={{color:t.sub}} className="text-sm mt-1">{settings?.appSubtitle||"Paratha Factory · Operations"}</p>
        </div>
        <Card dm={dm} className="p-6 flex flex-col gap-4">
          <Inp dm={dm} label="Username" value={u} onChange={e=>setU(e.target.value)} placeholder="admin · factory1 · agent1" autoComplete="username"/>
          <Inp dm={dm} label="Password" type="password" value={p} onChange={e=>setP(e.target.value)} placeholder="••••••••" autoComplete="current-password" onKeyDown={e=>e.key==="Enter"&&go()}/>
          {err&&<p className="text-xs text-red-500 font-semibold bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
          <Btn dm={dm} onClick={go} disabled={busy} className="w-full">{busy?"Signing in…":"Sign In →"}</Btn>
        </Card>
        <p style={{color:t.sub}} className="text-center text-[11px] mt-5">Accounts managed by Admin → Settings</p>
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
  const [settings,setSettings]=useStore("tas9_settings",D_SETTINGS);
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
  // Agent live locations — stored so admin can see all agents
  const [agentLocs, setAgentLocs]=useStore("tas9_locs",{});

  // Firebase handles all sync via useStore — no extra sync needed

  const [tab,setTab]=useState(()=>userPerms[0]||"Deliveries");
  const [srch,setSrch]=useState("");
  const [toast,setToast]=useState(null);
  const [conf,setConf]=useState(null);
  const notify=m=>setToast(m);
  const ask=(msg,yes)=>setConf({msg,yes});

  function addLog(action,detail){
    const e={id:uid(),user:sess.name,role:sess.role,action,detail,ts:ts()};
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
  const blkD=()=>({customer:"",customerId:null,orderLines:blkOL(),date:today(),deliveryDate:"",status:"Pending",notes:"",address:"",lat:0,lng:0,createdBy:sess.name,createdAt:ts()});
  const blkS=()=>({item:"",qty:"",unit:"kg",date:today(),supplier:"",cost:"",notes:""});
  const blkE=()=>({category:settings?.expenseCategories?.[0]||"Gas",amount:"",date:today(),notes:""});
  const blkP=()=>({id:"",name:"",unit:"pcs",prices:[5,6]});
  const blkU=()=>({username:"",password:"",name:"",role:"agent",active:true,permissions:[...ROLE_DEF.agent]});
  const blkW=useCallback(()=>({product:"",qty:"",unit:(settings?.supplyUnits||["pcs"])[0]||"pcs",type:(settings?.wastageTypes||["Other"])[0]||"Other",reason:"",cost:"",date:today(),shift:(settings?.shifts||["Morning"])[0]||"Morning",loggedBy:sess.name}),[settings,sess.name]);

  const [cSh,setCsh]=useState(null); const [cF,setCf]=useState(blkC());
  const [cView,setCView]=useState(null);
  const [dSh,setDsh]=useState(null); const [dF,setDf]=useState(blkD());
  const [sSh,setSsh]=useState(null); const [sF,setSf]=useState(blkS());
  const [eSh,setEsh]=useState(null); const [eF,setEf]=useState(blkE());
  const [pSh,setPsh]=useState(null); const [pF,setPf]=useState(blkP());
  const [uSh,setUsh]=useState(null); const [uF,setUf]=useState(blkU());
  const [paySh,setPaySh]=useState(null); const [payAmt,setPayAmt]=useState("");
  const [wSh,setWSh]=useState(null); const [wF,setWF]=useState(blkW());

  // CUSTOMERS
  function saveC(){if(!cF.name.trim()){notify("Name required");return;}const rec={...cF,paid:+cF.paid||0,pending:+cF.pending||0};if(cSh==="add"){setCust(p=>[...p,{...rec,id:uid()}]);addLog("Added customer",rec.name);notify("Customer added ✓");}else{setCust(p=>p.map(c=>c.id===cSh.id?{...rec,id:c.id}:c));addLog("Edited customer",rec.name);notify("Updated ✓");}setCsh(null);}
  function delC(c){ask(`Delete "${c.name}"?`,()=>{setCust(p=>p.filter(x=>x.id!==c.id));addLog("Deleted customer",c.name);notify("Deleted");});}
  function togActive(c){setCust(p=>p.map(x=>x.id===c.id?{...x,active:!x.active}:x));addLog(`${c.active?"Deactivated":"Activated"} customer`,c.name);notify("Updated");}
  function recPay(){const a=+payAmt;if(!a||!paySh)return;setCust(p=>p.map(c=>c.id===paySh.id?{...c,paid:c.paid+a,pending:Math.max(0,c.pending-a)}:c));addLog("Payment recorded",`${paySh.name} — ${inr(a)}`);notify(`${inr(a)} recorded`);setPaySh(null);setPayAmt("");}

  // DELIVERIES
  function pickCust(name){const c=customers.find(x=>x.name===name);setDf(f=>({...f,customer:name,customerId:c?.id||null,address:c?.address||"",lat:c?.lat||0,lng:c?.lng||0,orderLines:c?.orderLines?{...c.orderLines}:blkOL()}));}
  function saveD(){if(!dF.customer){notify("Select a customer");return;}if(dSh==="add"){setDeliv(p=>[...p,{...dF,id:uid()}]);addLog("Added delivery",dF.customer);notify("Delivery added ✓");}else{setDeliv(p=>p.map(d=>d.id===dSh.id?{...dF,id:d.id}:d));addLog("Edited delivery",dF.customer);notify("Updated ✓");}setDsh(null);}
  function tglD(d){const ns=d.status==="Pending"?"Delivered":"Pending";setDeliv(p=>p.map(x=>x.id===d.id?{...x,status:ns}:x));addLog("Status changed",`${d.customer} → ${ns}`);notify("Updated");}
  function delD(d){ask(`Delete delivery for "${d.customer}"?`,()=>{setDeliv(p=>p.filter(x=>x.id!==d.id));addLog("Deleted delivery",d.customer);notify("Deleted");});}

  // SUPPLIES
  function saveS(){if(!sF.item.trim()){notify("Item required");return;}const rec={...sF,qty:+sF.qty||0,cost:+sF.cost||0};if(sSh==="add"){setSup(p=>[...p,{...rec,id:uid()}]);addLog("Added supply",sF.item);notify("Supply logged ✓");}else{setSup(p=>p.map(s=>s.id===sSh.id?{...rec,id:s.id}:s));addLog("Edited supply",sF.item);notify("Updated ✓");}setSsh(null);}
  function delS(s){ask(`Delete supply "${s.item}"?`,()=>{setSup(p=>p.filter(x=>x.id!==s.id));addLog("Deleted supply",s.item);notify("Deleted");});}

  // EXPENSES
  function saveE(){if(!eF.amount){notify("Amount required");return;}setExp(p=>[...p,{...eF,id:uid(),amount:+eF.amount}]);addLog("Added expense",`${eF.category} ${inr(eF.amount)}`);notify("Expense logged ✓");setEsh(null);}
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
  function importAll(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{try{const d=JSON.parse(ev.target.result);if(d.customers)setCust(d.customers);if(d.deliveries)setDeliv(d.deliveries);if(d.supplies)setSup(d.supplies);if(d.expenses)setExp(d.expenses);if(d.products)setProd(d.products);if(d.users)setUsers(d.users);if(d.wastage)setWaste(d.wastage);addLog("Imported backup","Full restore");notify("Imported ✓");}catch{notify("Invalid backup file");}};r.readAsText(f);e.target.value="";}

  const TABS=isAdmin?ALL_TABS:ALL_TABS.filter(tb=>userPerms.includes(tb));
  const expCats=settings?.expenseCategories||["Gas","Labour","Transport","Packaging","Utilities","Maintenance","Other"];
  const delivStats=settings?.deliveryStatuses||["Pending","In Transit","Delivered","Cancelled"];
  const supUnits=settings?.supplyUnits||["kg","g","L","mL","pcs","bags","boxes","dozen"];

  // Active agent locations for admin
  const activeAgents=Object.values(safeO(agentLocs)).filter(l=>l&&l.lat);

  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={{background:t.bg,minHeight:"100vh",fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif"}} className="pb-28">

      {/* HEADER */}
      <header style={{background:t.card,borderBottom:`1px solid ${t.border}`}} className="sticky top-0 z-30 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl select-none">{settings?.appEmoji||"🫓"}</span>
            <div>
              <p style={{color:t.text}} className="font-bold text-sm leading-tight">{settings?.appName||"TAS Healthy World"}</p>
              <p style={{color:t.sub}} className="text-[11px]">{sess.name} · {sess.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isAgent&&(trk
              ?<button onClick={stopTrk} className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500 text-white font-semibold">📍 Live</button>
              :<button onClick={startTrk} style={{background:t.inp,color:t.sub}} className="text-[11px] px-2.5 py-1 rounded-full font-semibold">📍 Track</button>
            )}
            {isAdmin&&activeAgents.length>0&&(
              <a href={mapU("",activeAgents[0].lat,activeAgents[0].lng)} target="_blank" rel="noopener noreferrer"
                className="text-[11px] px-2.5 py-1 rounded-full bg-sky-500 text-white font-semibold">🗺 {activeAgents.length} Agent{activeAgents.length>1?"s":""}</a>
            )}
            <button onClick={()=>setDm(d=>!d)} style={{background:t.inp,color:t.text}} className="w-8 h-8 rounded-full flex items-center justify-center text-base select-none">{dm?"☀️":"🌙"}</button>
            <button onClick={onLogout} style={{background:t.inp,color:t.sub}} className="text-[11px] px-2.5 py-1 rounded-full font-semibold">Sign out</button>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 pb-2.5 flex gap-1 overflow-x-auto">
          {TABS.map(tb=>(
            <button key={tb} onClick={()=>{setTab(tb);setSrch("");}}
              style={tab===tb?{background:dm?"#f59e0b":"#1c1917",color:dm?"#000":"#fff"}:{color:t.sub}}
              className="whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all hover:opacity-80">{tb}</button>
          ))}
        </div>
      </header>

      {/* Agent GPS bar */}
      {isAgent&&trk&&loc&&(
        <div className="max-w-2xl mx-auto px-4 pt-3">
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
        <div className="max-w-2xl mx-auto px-4 pt-3">
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

      <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-3">

        {/* DASHBOARD */}
        {tab==="Dashboard"&&(<>
          {widgets.includes("stats")&&<div className="grid grid-cols-2 gap-3">
            <StatCard dm={dm} label="Active Customers" value={activeC.length} sub={`${customers.length} total`} accent="#d97706"/>
            <StatCard dm={dm} label="Pending Deliveries" value={pendingD.length} sub={`${deliveries.filter(d=>d.status==="Delivered").length} done`} accent="#ef4444"/>
            {canSeeFinancials&&<><StatCard dm={dm} label="Revenue" value={inr(totalRev)} sub="Collected" accent="#10b981"/>
            <StatCard dm={dm} label="Amount Due" value={inr(totalDue)} sub="Outstanding" accent="#8b5cf6"/>
            <StatCard dm={dm} label="Total Costs" value={inr(totalExpOp+totalSupC)} sub="Ops + supplies" accent="#f59e0b"/>
            <StatCard dm={dm} label="Net Profit" value={inr(netProfit)} sub="Revenue − costs" accent={netProfit>=0?"#10b981":"#ef4444"}/></>}
          </div>}

          {widgets.includes("chart")&&canSeeFinancials&&<Card dm={dm} className="p-4">
            <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-3">Revenue vs Expenses — Last 7 Days</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{top:0,right:0,left:-20,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.border}/>
                <XAxis dataKey="date" tick={{fontSize:10,fill:t.sub}}/>
                <YAxis tick={{fontSize:10,fill:t.sub}}/>
                <Tooltip contentStyle={{background:t.card,border:`1px solid ${t.border}`,borderRadius:8,color:t.text,fontSize:12}}/>
                <Legend wrapperStyle={{fontSize:11,color:t.sub}}/>
                <Bar dataKey="Revenue" fill="#10b981" radius={[4,4,0,0]}/>
                <Bar dataKey="Expenses" fill="#ef4444" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </Card>}

          {widgets.includes("pendingDeliveries")&&<Card dm={dm}>
            <div className="px-4 pt-4 pb-2"><p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider">Pending Deliveries</p></div>
            <Hr dm={dm}/>
            {pendingD.length===0?<p style={{color:t.sub}} className="text-sm text-center py-5">All done 🎉</p>
              :pendingD.map((d,i)=>(
              <div key={d.id}>{i>0&&<Hr dm={dm}/>}
                <div className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p style={{color:t.text}} className="text-sm font-semibold">{d.customer}</p>
                    <p style={{color:t.sub}} className="text-xs">📅 {d.date}{d.deliveryDate&&d.deliveryDate!==d.date?` → ${d.deliveryDate}`:""}{canSeePrices?` · ${inr(lineTotal(d.orderLines))}`:" · qty: "+Object.values(safeO(d.orderLines)).reduce((s,l)=>s+(l.qty||0),0)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.address&&<a href={mapU(d.address,d.lat,d.lng)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-sky-500 underline">Maps</a>}
                    <button onClick={()=>tglD(d)} style={{background:t.inp,color:t.text}} className="text-xs font-semibold px-3 py-1.5 rounded-lg">Done ✓</button>
                  </div>
                </div>
              </div>
            ))}
          </Card>}

          {widgets.includes("outstanding")&&canSeeFinancials&&customers.filter(c=>c.pending>0).length>0&&<Card dm={dm}>
            <div className="px-4 pt-4 pb-2"><p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider">Outstanding Payments</p></div>
            <Hr dm={dm}/>
            {customers.filter(c=>c.pending>0).map((c,i)=>(
              <div key={c.id}>{i>0&&<Hr dm={dm}/>}
                <div className="px-4 py-3 flex items-center justify-between">
                  <div><p style={{color:t.text}} className="text-sm font-semibold">{c.name}</p><p className="text-xs text-red-500 font-semibold">{inr(c.pending)} due</p></div>
                  {isAdmin&&<button onClick={()=>{setPaySh(c);setPayAmt("");}} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500 text-white">+ Pay</button>}
                </div>
              </div>
            ))}
          </Card>}

          {widgets.includes("wastageToday")&&(isAdmin||(settings?.showWastageTo||["admin","factory"]).includes(sess.role))&&(()=>{
            const tw=wastage.filter(w=>w.date===today());
            const twQty=tw.reduce((s,w)=>s+(w.qty||0),0);
            const twCost=tw.reduce((s,w)=>s+(w.cost||0),0);
            return tw.length>0&&<Card dm={dm}>
              <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider">Today's Wastage</p>
                <div className="flex gap-2"><span style={{color:"#f97316"}} className="text-xs font-black">{twQty} units</span>{isAdmin&&<span className="text-xs font-bold text-red-500">{inr(twCost)}</span>}</div>
              </div>
              <Hr dm={dm}/>
              {tw.map((w,i)=>(
                <div key={w.id}>{i>0&&<Hr dm={dm}/>}
                  <div className="px-4 py-2.5 flex items-center justify-between">
                    <div><p style={{color:t.text}} className="text-xs font-semibold">{w.product}</p><p style={{color:t.sub}} className="text-[11px]">{w.type} · {w.shift} · {w.loggedBy}</p></div>
                    <span style={{color:t.text}} className="font-bold text-sm">{w.qty} <span style={{color:t.sub}} className="text-xs font-normal">{w.unit}</span></span>
                  </div>
                </div>
              ))}
            </Card>;
          })()}
        </>)}

        {/* CUSTOMERS */}
        {tab==="Customers"&&(<>
          <div className="flex gap-2 items-center justify-between">
            <div className="flex gap-2 flex-wrap"><Pill dm={dm} c="amber">{activeC.length} active</Pill><Pill dm={dm} c="stone">{customers.filter(c=>!c.active).length} inactive</Pill></div>
            <div className="flex gap-2">
              {isAdmin&&<Btn dm={dm} v="outline" size="sm" onClick={()=>exportCSV(customers,"customers",[{label:"Name",key:"name"},{label:"Phone",key:"phone"},{label:"Address",key:"address"},{label:"Join Date",key:"joinDate"},{label:"Active",val:r=>r.active?"Yes":"No"},{label:"Order Total",val:r=>lineTotal(r.orderLines)},{label:"Paid",key:"paid"},{label:"Pending",key:"pending"},{label:"Status",val:r=>r.pending>0?"UNPAID":"PAID"},{label:"Notes",key:"notes"}])}>CSV</Btn>}
              <Btn dm={dm} size="sm" onClick={()=>{setCf(blkC());setCsh("add");}}>+ Customer</Btn>
            </div>
          </div>
          <Search dm={dm} value={srch} onChange={setSrch} placeholder="Search name, phone, address…"/>
          {fCust.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-6">No customers found.</p>}
          {fCust.map(c=>{
            const rows=lineRows(c.orderLines,products);
            const tot=lineTotal(c.orderLines);
            return (
              <Card key={c.id} dm={dm}><div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p style={{color:t.text}} className="font-semibold">{c.name}</p>
                    <p style={{color:t.sub}} className="text-xs">{c.phone}{c.phone&&c.address?" · ":""}{c.address}</p>
                    {c.joinDate&&<p style={{color:t.sub}} className="text-[11px] mt-0.5">📅 Since {c.joinDate}</p>}
                  </div>
                  <Pill dm={dm} c={c.active?"green":"stone"}>{c.active?"Active":"Inactive"}</Pill>
                </div>
                <div style={{background:t.inp}} className="rounded-xl p-3 mb-3">
                  <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-2">Regular Order</p>
                  {rows.length===0?<p style={{color:t.sub}} className="text-xs">No items set</p>
                    :rows.map(r=>(
                    <div key={r.id} className="flex justify-between text-xs py-0.5">
                      <span style={{color:t.sub}}>{r.qty} × {r.name}{canSeePrices?` @ ${inr(r.priceAmount)}`:""}</span>
                      {canSeePrices&&<span style={{color:t.text}} className="font-semibold">{inr(r.qty*r.priceAmount)}</span>}
                    </div>
                  ))}
                  {canSeePrices&&tot>0&&<div style={{borderTop:`1px solid ${t.border}`}} className="mt-1.5 pt-1.5 flex justify-between text-xs font-bold"><span style={{color:t.sub}}>Total</span><span className="text-amber-500">{inr(tot)}</span></div>}
                </div>
                {canSeeFinancials&&<div className="flex gap-2 mb-3">
                  <div style={{background:"#10b98120"}} className="flex-1 rounded-xl p-2.5 text-center"><p className="font-bold text-emerald-500 text-sm">{inr(c.paid)}</p><p style={{color:t.sub}} className="text-[10px]">Paid</p></div>
                  <div style={{background:c.pending>0?"#ef444420":"#10b98120"}} className="flex-1 rounded-xl p-2.5 text-center"><p className={cx("font-bold text-sm",c.pending>0?"text-red-500":"text-emerald-500")}>{inr(c.pending)}</p><p style={{color:t.sub}} className="text-[10px]">Due</p></div>
                  <div style={{background:c.pending>0?"#ef444420":"#10b98120"}} className="flex-1 rounded-xl p-2.5 text-center"><p className={cx("text-xs font-black",c.pending>0?"text-red-500":"text-emerald-500")}>{c.pending>0?"UNPAID":"✓ PAID"}</p><p style={{color:t.sub}} className="text-[10px]">Status</p></div>
                </div>}
                {c.notes&&<p style={{color:t.sub}} className="text-xs italic mb-2">"{c.notes}"</p>}
                <div className="flex gap-1.5 flex-wrap">
                  <button onClick={()=>setCView(c)} style={{background:t.inp,color:t.text}} className="text-xs font-semibold px-3 py-1.5 rounded-lg">View</button>
                  <button onClick={()=>{setCf({...c,orderLines:{...safeO(c.orderLines)}});setCsh(c);}} style={{background:t.inp,color:t.text}} className="text-xs font-semibold px-3 py-1.5 rounded-lg">Edit</button>
                  <button onClick={()=>exportPDF(c,products,"customer",settings)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-500 text-white">PDF</button>
                  <button onClick={()=>exportWord(c,products,"customer",settings)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-sky-500 text-white">Word</button>
                  {isAdmin&&<>
                    <button onClick={()=>{setPaySh(c);setPayAmt("");}} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500 text-white">+ Pay</button>
                    <button onClick={()=>togActive(c)} style={{background:t.inp,color:"#38bdf8"}} className="text-xs font-semibold px-3 py-1.5 rounded-lg">{c.active?"Deactivate":"Activate"}</button>
                    <button onClick={()=>delC(c)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 text-white">Delete</button>
                  </>}
                  {c.address&&<a href={mapU(c.address,c.lat,c.lng)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-sky-500 text-white">📍</a>}
                </div>
              </div></Card>
            );
          })}
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
              {isAdmin&&<Btn dm={dm} v="outline" size="sm" onClick={()=>exportCSV(deliveries,"deliveries",[{label:"Customer",key:"customer"},{label:"Date",key:"date"},{label:"Deliver By",key:"deliveryDate"},{label:"Status",key:"status"},{label:"Total",val:r=>lineTotal(r.orderLines)},{label:"Address",key:"address"},{label:"Created By",key:"createdBy"},{label:"Notes",key:"notes"}])}>CSV</Btn>}
              <Btn dm={dm} size="sm" onClick={()=>{setDf(blkD());setDsh("add");}}>+ Delivery</Btn>
            </div>
          </div>
          <Search dm={dm} value={srch} onChange={setSrch} placeholder="Search customer, date, status…"/>
          {fDeliv.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-6">No deliveries found.</p>}
          {fDeliv.map(d=>{
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
                <div className="flex gap-1.5 flex-wrap">
                  {d.address&&<a href={mapU(d.address,d.lat,d.lng)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-sky-500 text-white">📍 Navigate</a>}
                  <button onClick={()=>{setDf({...d,orderLines:{...safeO(d.orderLines)}});setDsh(d);}} style={{background:t.inp,color:t.text}} className="text-xs font-semibold px-3 py-1.5 rounded-lg">Edit</button>
                  <button onClick={()=>exportPDF(d,products,"delivery",settings)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-500 text-white">PDF</button>
                  <button onClick={()=>exportWord(d,products,"delivery",settings)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-sky-500 text-white">Word</button>
                  {isFactory&&d.status==="Pending"&&<button onClick={()=>{setDeliv(p=>p.map(x=>x.id===d.id?{...x,status:"In Transit"}:x));addLog("Dispatched",d.customer);notify("Marked In Transit");}} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 text-white">Dispatch</button>}
                  {isAdmin&&<button onClick={()=>delD(d)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 text-white">Delete</button>}
                </div>
              </div></Card>
            );
          })}
        </>)}

        {/* SUPPLIES */}
        {tab==="Supplies"&&(<>
          <div className="flex justify-between items-center">
            <div className="flex gap-2"><Pill dm={dm} c="amber">{supplies.length} items</Pill>{canSeeFinancials&&<Pill dm={dm} c="purple">{inr(totalSupC)}</Pill>}</div>
            <div className="flex gap-2">
              {isAdmin&&<Btn dm={dm} v="outline" size="sm" onClick={()=>exportCSV(supplies,"supplies",[{label:"Item",key:"item"},{label:"Qty",key:"qty"},{label:"Unit",key:"unit"},{label:"Supplier",key:"supplier"},{label:"Cost",key:"cost"},{label:"Date",key:"date"},{label:"Notes",key:"notes"}])}>CSV</Btn>}
              <Btn dm={dm} size="sm" onClick={()=>{setSf(blkS());setSsh("add");}}>+ Supply</Btn>
            </div>
          </div>
          <Search dm={dm} value={srch} onChange={setSrch} placeholder="Search item, supplier…"/>
          {fSup.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-6">No supplies found.</p>}
          {fSup.map(s=>(
            <Card key={s.id} dm={dm}><div className="p-4 flex items-start justify-between">
              <div>
                <p style={{color:t.text}} className="font-semibold">{s.item}</p>
                <p style={{color:t.sub}} className="text-xs">{s.supplier}{s.supplier&&s.date?" · ":""}{s.date}</p>
                {s.notes&&<p style={{color:t.sub}} className="text-xs italic mt-0.5">"{s.notes}"</p>}
              </div>
              <div className="text-right">
                <p style={{color:t.text}} className="font-bold">{s.qty}<span style={{color:t.sub}} className="text-xs font-normal ml-1">{s.unit}</span></p>
                {canSeeFinancials&&s.cost>0&&<p style={{color:t.sub}} className="text-xs">{inr(s.cost)}</p>}
                <div className="flex gap-1.5 justify-end mt-2">
                  <button onClick={()=>{setSf({...s});setSsh(s);}} style={{background:t.inp,color:t.text}} className="text-[11px] font-semibold px-2 py-1 rounded-lg">Edit</button>
                  {isAdmin&&<button onClick={()=>delS(s)} className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-red-600 text-white">Delete</button>}
                </div>
              </div>
            </div></Card>
          ))}
        </>)}

        {/* EXPENSES */}
        {tab==="Expenses"&&isAdmin&&(<>
          <div className="flex justify-between items-center">
            <div className="flex gap-2"><Pill dm={dm} c="red">{inr(totalExpOp)} ops</Pill><Pill dm={dm} c={netProfit>=0?"green":"red"}>Profit {inr(netProfit)}</Pill></div>
            <div className="flex gap-2">
              <Btn dm={dm} v="outline" size="sm" onClick={()=>exportCSV(expenses,"expenses",[{label:"Category",key:"category"},{label:"Amount",key:"amount"},{label:"Date",key:"date"},{label:"Notes",key:"notes"}])}>CSV</Btn>
              <Btn dm={dm} size="sm" onClick={()=>{setEf(blkE());setEsh("add");}}>+ Expense</Btn>
            </div>
          </div>
          <Card dm={dm}><div className="p-4 flex flex-col gap-2">{[{l:"Supply costs",v:totalSupC,c:"#8b5cf6"},{l:"Op expenses",v:totalExpOp,c:"#ef4444"},{l:"Total revenue",v:totalRev,c:"#10b981"},{l:"Net profit",v:netProfit,c:netProfit>=0?"#10b981":"#ef4444"}].map(x=><div key={x.l} className="flex justify-between py-1.5" style={{borderBottom:`1px solid ${t.border}`}}><span style={{color:t.sub}} className="text-sm">{x.l}</span><span className="font-bold text-sm" style={{color:x.c}}>{inr(x.v)}</span></div>)}</div></Card>
          {expenses.map(e=>(
            <Card key={e.id} dm={dm}><div className="p-4 flex items-center justify-between">
              <div><p style={{color:t.text}} className="font-semibold">{e.category}</p><p style={{color:t.sub}} className="text-xs">{e.date}{e.notes?" · "+e.notes:""}</p></div>
              <div className="flex items-center gap-2"><span className="font-bold text-red-500">{inr(e.amount)}</span><button onClick={()=>delE(e)} className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-red-600 text-white">Delete</button></div>
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
              <div className="grid grid-cols-2 gap-3">
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

        {/* SETTINGS */}
        {tab==="Settings"&&isAdmin&&(<>

          {/* Products */}
          <Card dm={dm}><div className="p-4">
            <div className="flex items-center justify-between mb-3"><p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider">Products & Prices</p><Btn dm={dm} size="sm" onClick={()=>{setPf(blkP());setPsh("add");}}>+ Product</Btn></div>
            {products.map(p=>(
              <div key={p.id} style={{borderBottom:`1px solid ${t.border}`}} className="py-3 last:border-0">
                <div className="flex items-start justify-between">
                  <div><p style={{color:t.text}} className="text-sm font-semibold">{p.name}</p><p style={{color:t.sub}} className="text-[11px]">{p.unit} · id: {p.id}</p></div>
                  <div className="flex gap-1.5">
                    <button onClick={()=>{setPf({...p,prices:[...p.prices]});setPsh(p);}} style={{background:t.inp,color:t.text}} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg">Edit</button>
                    <button onClick={()=>delP(p)} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-red-600 text-white">Delete</button>
                  </div>
                </div>
                <div className="flex gap-1.5 mt-2 flex-wrap">{p.prices.map((pr,i)=><span key={i} style={{background:t.inp,color:t.text}} className="text-xs font-bold px-2.5 py-1 rounded-lg">{inr(pr)}</span>)}</div>
              </div>
            ))}
          </div></Card>

          {/* Wastage visibility */}
          <Card dm={dm}><div className="p-4">
            <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-1">Wastage Tab Access</p>
            <p style={{color:t.sub}} className="text-[11px] mb-3">Control which roles can access the Wastage tab. Roles with access can log and view wastage. Only admin can delete records.</p>
            {["admin","factory","agent"].map(role=>{
              const on=(settings?.showWastageTo||["admin","factory"]).includes(role);
              return <div key={role} className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`}}>
                <div><span style={{color:t.text}} className="text-sm font-medium capitalize">{role}</span>{role==="admin"&&<span style={{color:t.sub}} className="text-[10px] ml-2">always has access</span>}</div>
                <Tog dm={dm} on={role==="admin"?true:on} onChange={()=>{if(role==="admin")return;setSettings(s=>({...s,showWastageTo:on?(s.showWastageTo||[]).filter(r=>r!==role):[...(s.showWastageTo||[]),role]}));}}/>
              </div>;
            })}
            <p style={{color:t.text}} className="text-xs font-semibold mt-3 mb-2">Show cost/loss data in Wastage to:</p>
            {["admin","factory","agent"].map(role=>{
              const key="showWasteCostTo"; const on=(settings?.[key]||["admin"]).includes(role);
              return <div key={role} className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`}}>
                <div><span style={{color:t.text}} className="text-sm font-medium capitalize">{role}</span>{role==="admin"&&<span style={{color:t.sub}} className="text-[10px] ml-2">always visible</span>}</div>
                <Tog dm={dm} on={role==="admin"?true:on} onChange={()=>{if(role==="admin")return;setSettings(s=>({...s,[key]:on?(s[key]||[]).filter(r=>r!==role):[...(s[key]||[]),role]}));}}/>
              </div>;
            })}
          </div></Card>

          {/* Price Visibility — the key new feature */}
          <Card dm={dm}><div className="p-4">
            <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-1">Price & Financial Visibility</p>
            <p style={{color:t.sub}} className="text-[11px] mb-3">Control which roles can see prices and financial data. Hidden roles see quantities only — no amounts shown anywhere.</p>
            <p style={{color:t.text}} className="text-xs font-semibold mb-2">Show prices to:</p>
            {["admin","factory","agent"].map(role=>{
              const on=(settings?.showPricesTo||["admin"]).includes(role);
              return <div key={role} className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`}}>
                <div><span style={{color:t.text}} className="text-sm font-medium capitalize">{role}</span>{role==="admin"&&<span style={{color:t.sub}} className="text-[10px] ml-2">always visible</span>}</div>
                <Tog dm={dm} on={role==="admin"?true:on} onChange={()=>{if(role==="admin")return;setSettings(s=>({...s,showPricesTo:on?(s.showPricesTo||[]).filter(r=>r!==role):[...(s.showPricesTo||[]),role]}));}}/>
              </div>;
            })}
            <p style={{color:t.text}} className="text-xs font-semibold mt-3 mb-2">Show financial summaries (paid/due/profit) to:</p>
            {["admin","factory","agent"].map(role=>{
              const on=(settings?.showFinancialsTo||["admin"]).includes(role);
              return <div key={role} className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`}}>
                <div><span style={{color:t.text}} className="text-sm font-medium capitalize">{role}</span>{role==="admin"&&<span style={{color:t.sub}} className="text-[10px] ml-2">always visible</span>}</div>
                <Tog dm={dm} on={role==="admin"?true:on} onChange={()=>{if(role==="admin")return;setSettings(s=>({...s,showFinancialsTo:on?(s.showFinancialsTo||[]).filter(r=>r!==role):[...(s.showFinancialsTo||[]),role]}));}}/>
              </div>;
            })}
          </div></Card>

          {/* Users */}
          <Card dm={dm}><div className="p-4">
            <div className="flex items-center justify-between mb-3"><p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider">Users ({users.length})</p><Btn dm={dm} size="sm" onClick={()=>{setUf(blkU());setUsh("add");}}>+ User</Btn></div>
            {users.map(u=>(
              <div key={u.id} style={{borderBottom:`1px solid ${t.border}`}} className="py-3 last:border-0 flex items-center justify-between">
                <div>
                  <p style={{color:t.text}} className="text-sm font-semibold">{u.name} <span style={{color:t.sub}} className="font-normal text-xs">@{u.username}</span></p>
                  <div className="flex gap-1.5 mt-0.5 flex-wrap">
                    <Pill dm={dm} c={u.role==="admin"?"amber":u.role==="factory"?"purple":"sky"}>{u.role}</Pill>
                    <Pill dm={dm} c={u.active?"green":"stone"}>{u.active?"Active":"Inactive"}</Pill>
                    <span style={{color:t.sub}} className="text-[10px] self-center">{(u.permissions||[]).length} tabs</span>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={()=>{setUf({...u,password:""});setUsh(u);}} style={{background:t.inp,color:t.text}} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg">Edit</button>
                  <button onClick={()=>delU(u)} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-red-600 text-white">Delete</button>
                </div>
              </div>
            ))}
          </div></Card>

          {/* App Branding */}
          <Card dm={dm}><div className="p-4 flex flex-col gap-3">
            <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider">App Branding</p>
            <Inp dm={dm} label="App Name"  value={settings?.appName||""} onChange={e=>setSettings(s=>({...s,appName:e.target.value}))} placeholder="TAS Healthy World"/>
            <Inp dm={dm} label="Subtitle"   value={settings?.appSubtitle||""} onChange={e=>setSettings(s=>({...s,appSubtitle:e.target.value}))} placeholder="Paratha Factory · Operations"/>
            <Inp dm={dm} label="Emoji/Icon" value={settings?.appEmoji||""} onChange={e=>setSettings(s=>({...s,appEmoji:e.target.value}))} placeholder="🫓"/>
            <Inp dm={dm} label="Company Name (invoices)" value={settings?.companyName||""} onChange={e=>setSettings(s=>({...s,companyName:e.target.value}))} placeholder="TAS Healthy World"/>
            <Inp dm={dm} label="Company Subtitle (invoices)" value={settings?.companySubtitle||""} onChange={e=>setSettings(s=>({...s,companySubtitle:e.target.value}))} placeholder="Malabar Paratha Factory · Goa, India"/>
          </div></Card>

          {/* Editable Lists */}
          <Card dm={dm}><div className="p-4 flex flex-col gap-4">
            <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider">Editable Lists</p>
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
                  <p style={{color:t.text}} className="text-xs font-semibold mb-2">{label}</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {list.map((item,i)=>(
                      <div key={i} className="flex items-center gap-1" style={{background:t.inp,border:`1px solid ${t.inpB}`,borderRadius:8,paddingLeft:8,paddingRight:4,paddingTop:3,paddingBottom:3}}>
                        <span style={{color:t.text}} className="text-xs">{item}</span>
                        <button onClick={()=>setSettings(s=>({...s,[key]:list.filter((_,j)=>j!==i)}))} className="text-red-400 font-bold text-sm ml-1 leading-none">✕</button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input id={`new_${key}`} placeholder={`Add new ${label.toLowerCase().slice(0,-1)}…`}
                      style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text}}
                      className="flex-1 rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-amber-400"/>
                    <button onClick={()=>{const el=document.getElementById(`new_${key}`);const v=el.value.trim();if(v&&!list.includes(v)){setSettings(s=>({...s,[key]:[...list,v]}));el.value="";}}} className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-500 text-white">Add</button>
                  </div>
                </div>
              );
            })}
          </div></Card>

          {/* Dashboard Widgets */}
          <Card dm={dm}><div className="p-4">
            <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-3">Dashboard Widgets</p>
            {[{key:"stats",label:"Stat Cards"},{key:"chart",label:"Revenue Chart"},{key:"pendingDeliveries",label:"Pending Deliveries"},{key:"outstanding",label:"Outstanding Payments"},{key:"wastageToday",label:"Today's Wastage"}].map(w=>{
              const on=(settings?.dashWidgets||[]).includes(w.key);
              return <div key={w.key} className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`}}>
                <span style={{color:t.text}} className="text-sm">{w.label}</span>
                <Tog dm={dm} on={on} onChange={()=>setSettings(s=>({...s,dashWidgets:on?(s.dashWidgets||[]).filter(k=>k!==w.key):[...(s.dashWidgets||[]),w.key]}))}/>
              </div>;
            })}
          </div></Card>

          {/* Backup */}
          <Card dm={dm}><div className="p-4 flex flex-col gap-3">
            <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider">Data Backup</p>
            <Btn dm={dm} v="outline" className="w-full" onClick={exportAll}>⬇️ Export Full Backup (JSON)</Btn>
            <label style={{border:`1px solid ${t.border}`,color:t.text}} className="w-full text-sm font-semibold rounded-xl px-4 py-2.5 text-center cursor-pointer hover:opacity-80 transition-all">
              ⬆️ Import Backup (JSON)<input type="file" accept=".json" className="hidden" onChange={importAll}/>
            </label>
            <Hr dm={dm}/>
            <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider">Export as CSV/Excel</p>
            <div className="flex gap-2 flex-wrap">
              <Btn dm={dm} v="success" size="sm" onClick={()=>exportCSV(customers,"customers",[{label:"Name",key:"name"},{label:"Phone",key:"phone"},{label:"Address",key:"address"},{label:"Paid",key:"paid"},{label:"Pending",key:"pending"},{label:"Status",val:r=>r.pending>0?"UNPAID":"PAID"},{label:"Join Date",key:"joinDate"},{label:"Notes",key:"notes"}])}>Customers</Btn>
              <Btn dm={dm} v="success" size="sm" onClick={()=>exportCSV(deliveries,"deliveries",[{label:"Customer",key:"customer"},{label:"Date",key:"date"},{label:"Deliver By",key:"deliveryDate"},{label:"Status",key:"status"},{label:"Total",val:r=>lineTotal(r.orderLines)},{label:"Address",key:"address"},{label:"By",key:"createdBy"}])}>Deliveries</Btn>
              <Btn dm={dm} v="success" size="sm" onClick={()=>exportCSV(supplies,"supplies",[{label:"Item",key:"item"},{label:"Qty",key:"qty"},{label:"Unit",key:"unit"},{label:"Supplier",key:"supplier"},{label:"Cost",key:"cost"},{label:"Date",key:"date"}])}>Supplies</Btn>
              <Btn dm={dm} v="success" size="sm" onClick={()=>exportCSV(expenses,"expenses",[{label:"Category",key:"category"},{label:"Amount",key:"amount"},{label:"Date",key:"date"},{label:"Notes",key:"notes"}])}>Expenses</Btn>
              <Btn dm={dm} v="success" size="sm" onClick={()=>exportCSV(actLog,"activity",[{label:"Time",key:"ts"},{label:"User",key:"user"},{label:"Role",key:"role"},{label:"Action",key:"action"},{label:"Detail",key:"detail"}])}>Activity Log</Btn>
            </div>
          </div></Card>

          {/* Activity Log */}
          <Card dm={dm}><div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider">Activity Log ({actLog.length})</p>
              <div className="flex gap-2">
                <button onClick={()=>exportCSV(actLog,"activity",[{label:"Time",key:"ts"},{label:"User",key:"user"},{label:"Role",key:"role"},{label:"Action",key:"action"},{label:"Detail",key:"detail"}])} style={{color:"#10b981"}} className="text-[11px] font-semibold">CSV</button>
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

          {/* Danger */}
          <Card dm={dm}><div className="p-4">
            <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-3">Danger Zone</p>
            <Btn v="danger" className="w-full" onClick={()=>ask("Reset ALL data to factory defaults? Cannot be undone.",()=>{setCust(D_CUST);setDeliv(D_DELIV);setSup(D_SUP);setExp(D_EXP);setProd(D_PRODS);setWaste(D_WASTE);const r=[{id:uid(),user:sess.name,role:sess.role,action:"FULL RESET",detail:"All data reset to defaults",ts:ts()}];setAct(r);notify("Reset complete");})}>⚠️ Reset All Data to Defaults</Btn>
          </div></Card>
        </>)}
      </div>

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
      <Sheet dm={dm} open={!!eSh} onClose={()=>setEsh(null)} title="Log Expense">
        <Sel dm={dm} label="Category" value={eF.category} onChange={e=>setEf({...eF,category:e.target.value})}>
          {expCats.map(c=><option key={c}>{c}</option>)}
        </Sel>
        <Inp dm={dm} label="Amount (₹) *" type="number" value={eF.amount} onChange={e=>setEf({...eF,amount:e.target.value})}/>
        <Inp dm={dm} label="Date" type="date" value={eF.date} onChange={e=>setEf({...eF,date:e.target.value})}/>
        <Inp dm={dm} label="Notes" value={eF.notes} onChange={e=>setEf({...eF,notes:e.target.value})}/>
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

      {/* User Sheet */}
      <Sheet dm={dm} open={!!uSh} onClose={()=>setUsh(null)} title={uSh==="add"?"New User":"Edit User"}>
        <Inp dm={dm} label="Full Name *" value={uF.name} onChange={e=>setUf({...uF,name:e.target.value})} placeholder="e.g. Ravi Kumar"/>
        <Inp dm={dm} label="Username *" value={uF.username} onChange={e=>setUf({...uF,username:e.target.value.toLowerCase().replace(/\s/g,"")})} placeholder="lowercase, no spaces"/>
        <Inp dm={dm} label={uSh==="add"?"Password *":"New Password (blank = keep)"} type="password" value={uF.password} onChange={e=>setUf({...uF,password:e.target.value})} placeholder="Min 6 characters"/>
        <Sel dm={dm} label="Role" value={uF.role} onChange={e=>{const r=e.target.value;setUf({...uF,role:r,permissions:[...(ROLE_DEF[r]||ROLE_DEF.agent)]});}}>
          <option value="agent">Delivery Agent</option>
          <option value="factory">Factory Staff</option>
          <option value="admin">Admin</option>
        </Sel>
        <div>
          <label style={{color:t.sub}} className="block text-[11px] font-semibold uppercase tracking-wider mb-2">Tab Access</label>
          {ALL_TABS.map(tabName=>{
            const on=(uF.permissions||[]).includes(tabName);
            const locked=tabName==="Settings"&&uF.role!=="admin";
            return <div key={tabName} className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`}}>
              <div><span style={{color:t.text}} className="text-sm font-medium">{tabName}</span>{locked&&<span style={{color:t.sub}} className="text-[10px] ml-2">Admin only</span>}</div>
              <Tog dm={dm} on={locked?false:on} onChange={()=>{if(locked)return;const p=uF.permissions||[];setUf({...uF,permissions:on?p.filter(x=>x!==tabName):[...p,tabName]});}}/>
            </div>;
          })}
        </div>
        <Sel dm={dm} label="Status" value={uF.active?"active":"inactive"} onChange={e=>setUf({...uF,active:e.target.value==="active"})}>
          <option value="active">Active</option><option value="inactive">Inactive</option>
        </Sel>
        <Btn dm={dm} onClick={saveU} className="w-full">Save User</Btn>
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

      <Confirm dm={dm} msg={conf?.msg} onYes={()=>{conf?.yes();setConf(null);}} onNo={()=>setConf(null)}/>
      {toast&&<Toast msg={toast} onDone={()=>setToast(null)}/>}
    </div>
  );
}
