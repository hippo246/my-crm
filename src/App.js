/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, Cell } from "recharts";
import { db } from "./firebase";
import { ref, onValue, set as fbSet } from "firebase/database";

// ─────────────────────────────────────────────────────────────────────────────
//  App.js  —  TAS Healthy World · Operations CRM
//  Single-file bundle: utilities · theme · UI atoms · Login · CRM tabs · Sheets
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════
//  SECURITY
//  Passwords use a double-multiply hash. For production deploy
//  use Firebase Auth or a Node/Express backend with bcrypt.
// ═══════════════════════════════════════════════════════════════
// Polyfill Math.imul for old Android browsers (Android 4.x)
if (typeof Math.imul !== "function") {
  Math.imul = function(a, b) {
    const ah = (a >>> 16) & 0xffff, al = a & 0xffff;
    const bh = (b >>> 16) & 0xffff, bl = b & 0xffff;
    return (al * bl + (((ah * bl + al * bh) << 16) >>> 0)) | 0;
  };
}
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
function ls(k, d) { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } }
function lsw(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
function lsdel(k) { try { localStorage.removeItem(k); } catch {} }

// Firebase deletes nodes when arrays/objects are empty, causing re-seed loops.
// Fix: always wrap data as {v: data} before writing — empty arrays become {v:[]}
// which Firebase stores correctly. Unwrap with .v on read.
function fbWrite(key, data) {
  return fbSet(ref(db, key), { v: data });
}

let _writing = {}; // write counters per key — ignore echoes while counter > 0
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
      if (_writing[key] > 0) {
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
        _writing[key] = (_writing[key]||0) + 1;
        fbWrite(key, d)
          .then(() => setTimeout(() => { _writing[key] = Math.max(0,(_writing[key]||1)-1); }, 2000))
          .catch(e => { console.warn("seed error:", e.message); _writing[key] = Math.max(0,(_writing[key]||1)-1); });
        setRaw(d);
        lsw(key, d);
      }
      setFbLoaded(true);
      _notifySync();
    }, (err) => {
      console.warn("Firebase error for", key, err.message);
      setRaw(ls(key, defRef.current));
      setFbLoaded(true);
      // Surface offline state to consumers via a global flag they can read
      if(typeof window!=="undefined") window.__fbOffline=true;
    });
    return () => unsub();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback((next) => {
    setRaw(prev => {
      const n = typeof next === "function" ? next(prev ?? defRef.current) : next;
      lsw(key, n);
      // Block echo for this key while write is in flight
      _writing[key] = (_writing[key]||0) + 1;
      fbWrite(key, n)
        .then(() => setTimeout(() => { _writing[key] = Math.max(0,(_writing[key]||1)-1); }, 2000))
        .catch(e => { console.warn("Firebase write error:", e.message); _writing[key] = Math.max(0,(_writing[key]||1)-1); });
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
const ALL_TABS = ["Dashboard","Customers","Deliveries","Supplies","Expenses","Wastage","P&L","Analytics","Production","QC","GPS","Settings"];
const ROLE_DEF = {
  admin:   ALL_TABS,
  factory: ["Dashboard","Customers","Deliveries","Supplies","Wastage","Production"],
  agent:   ["Dashboard","Customers","Deliveries","GPS"],
};

// Fine-grained permission keys — stored as finePerms:{key:bool} on each user
// admin always gets all; non-admins use their stored finePerms (falling back to role defaults)
const FINE_PERM_DEFS = [
  // ── Customers ──────────────────────────────────────────────
  {key:"cust_add",        section:"Customers",  label:"Add customers",           desc:"Create new customer profiles",                  icon:"➕", agentDef:false, factoryDef:false},
  {key:"cust_edit",       section:"Customers",  label:"Edit customers",           desc:"Modify customer details & order templates",      icon:"✏️", agentDef:false, factoryDef:false},
  {key:"cust_delete",     section:"Customers",  label:"Delete customers",         desc:"Permanently remove customer records",            icon:"🗑️", agentDef:false, factoryDef:false},
  {key:"cust_seePrices",  section:"Customers",  label:"See prices",               desc:"View item prices and order totals",              icon:"💰", agentDef:false, factoryDef:true},
  {key:"cust_seeFinance", section:"Customers",  label:"See paid/pending amounts", desc:"View money owed and payment history",            icon:"💳", agentDef:false, factoryDef:false},
  {key:"cust_markPaid",   section:"Customers",  label:"Mark payments",            desc:"Record customer payments",                      icon:"✅", agentDef:false, factoryDef:false},
  {key:"cust_export",     section:"Customers",  label:"Export customer data",     desc:"Download CSV of all customers",                  icon:"📤", agentDef:false, factoryDef:false},
  {key:"cust_deactivate", section:"Customers",  label:"Activate/deactivate",      desc:"Enable or disable customer accounts",            icon:"🔒", agentDef:false, factoryDef:false},
  // ── Deliveries ─────────────────────────────────────────────
  {key:"deliv_add",       section:"Deliveries", label:"Create deliveries",        desc:"Add new delivery orders",                        icon:"➕", agentDef:false, factoryDef:true},
  {key:"deliv_edit",      section:"Deliveries", label:"Edit deliveries",          desc:"Modify existing delivery orders",                icon:"✏️", agentDef:false, factoryDef:true},
  {key:"deliv_delete",    section:"Deliveries", label:"Delete deliveries",        desc:"Permanently remove delivery records",            icon:"🗑️", agentDef:false, factoryDef:false},
  {key:"deliv_markDone",  section:"Deliveries", label:"Mark as Delivered",        desc:"Update delivery status to Delivered",            icon:"📦", agentDef:true,  factoryDef:true},
  {key:"deliv_dispatch",  section:"Deliveries", label:"Dispatch (In Transit)",    desc:"Mark orders as In Transit / dispatched",         icon:"🚚", agentDef:true,  factoryDef:true},
  {key:"deliv_seePrices", section:"Deliveries", label:"See order prices",         desc:"View item prices on delivery orders",            icon:"💰", agentDef:false, factoryDef:true},
  {key:"deliv_export",    section:"Deliveries", label:"Export deliveries",        desc:"Download CSV & PDF reports",                    icon:"📤", agentDef:false, factoryDef:false},
  {key:"deliv_report",    section:"Deliveries", label:"Generate full report",     desc:"Create PDF delivery reports",                   icon:"📊", agentDef:false, factoryDef:false},
  {key:"deliv_replacement",section:"Deliveries",label:"Log replacements",         desc:"Record replaced/returned items",                icon:"🔄", agentDef:true,  factoryDef:true},
  // ── Supplies ───────────────────────────────────────────────
  {key:"sup_add",         section:"Supplies",   label:"Add supply entries",       desc:"Record new incoming stock",                     icon:"➕", agentDef:false, factoryDef:true},
  {key:"sup_edit",        section:"Supplies",   label:"Edit supplies",            desc:"Modify supply records",                         icon:"✏️", agentDef:false, factoryDef:true},
  {key:"sup_delete",      section:"Supplies",   label:"Delete supplies",          desc:"Remove supply records",                         icon:"🗑️", agentDef:false, factoryDef:false},
  {key:"sup_seeCost",     section:"Supplies",   label:"See supply costs",         desc:"View cost per supply entry",                    icon:"💰", agentDef:false, factoryDef:true},
  {key:"sup_export",      section:"Supplies",   label:"Export supplies",          desc:"Download supply CSV",                           icon:"📤", agentDef:false, factoryDef:false},
  // ── Wastage ────────────────────────────────────────────────
  {key:"waste_add",       section:"Wastage",    label:"Log wastage",              desc:"Record wasted or damaged products",              icon:"➕", agentDef:true,  factoryDef:true},
  {key:"waste_edit",      section:"Wastage",    label:"Edit wastage",             desc:"Modify wastage records",                        icon:"✏️", agentDef:false, factoryDef:true},
  {key:"waste_delete",    section:"Wastage",    label:"Delete wastage",           desc:"Remove wastage records",                        icon:"🗑️", agentDef:false, factoryDef:false},
  {key:"waste_seeCost",   section:"Wastage",    label:"See cost impact",          desc:"View estimated cost loss per entry",             icon:"💰", agentDef:false, factoryDef:false},
  {key:"waste_logCost",   section:"Wastage",    label:"Enter cost values",        desc:"Fill in the estimated cost loss field",          icon:"✏️", agentDef:false, factoryDef:false},
  // ── Production ─────────────────────────────────────────────
  {key:"prod_add",        section:"Production", label:"Log production",           desc:"Record shift targets and actual output",         icon:"➕", agentDef:false, factoryDef:true},
  {key:"prod_edit",       section:"Production", label:"Edit production",          desc:"Modify production records",                     icon:"✏️", agentDef:false, factoryDef:true},
  {key:"prod_delete",     section:"Production", label:"Delete production",        desc:"Remove production entries",                     icon:"🗑️", agentDef:false, factoryDef:false},
  {key:"prod_handover",   section:"Production", label:"Log shift handover",       desc:"Record end-of-shift notes and handovers",        icon:"🤝", agentDef:false, factoryDef:true},
  // ── QC ─────────────────────────────────────────────────────
  {key:"qc_add",          section:"QC",         label:"Log QC checks",            desc:"Record quality checks for products",             icon:"➕", agentDef:false, factoryDef:true},
  {key:"qc_edit",         section:"QC",         label:"Edit QC records",          desc:"Modify quality check entries",                  icon:"✏️", agentDef:false, factoryDef:true},
  {key:"qc_delete",       section:"QC",         label:"Delete QC records",        desc:"Remove QC entries",                             icon:"🗑️", agentDef:false, factoryDef:false},
  {key:"qc_export",       section:"QC",         label:"Export QC data",           desc:"Download QC CSV",                               icon:"📤", agentDef:false, factoryDef:false},
  // ── Dashboard & Notices ────────────────────────────────────
  {key:"dash_seeBriefing",section:"Dashboard",  label:"See morning briefing",     desc:"View the daily summary and AI briefing",        icon:"☀️", agentDef:true,  factoryDef:true},
  {key:"dash_postNotice", section:"Dashboard",  label:"Post notices",             desc:"Create and pin notices on the dashboard",       icon:"📌", agentDef:false, factoryDef:false},
  {key:"dash_delNotice",  section:"Dashboard",  label:"Delete notices",           desc:"Remove notices from the dashboard",             icon:"🗑️", agentDef:false, factoryDef:false},
  {key:"dash_seeWastage", section:"Dashboard",  label:"See today's wastage widget",desc:"View wastage summary on dashboard",            icon:"🗑️", agentDef:false, factoryDef:true},
  // ── GPS & Location ─────────────────────────────────────────
  {key:"gps_track",       section:"GPS",        label:"Share live location",      desc:"Allow this person to broadcast their GPS",       icon:"📍", agentDef:true,  factoryDef:false},
  {key:"gps_seeAgents",   section:"GPS",        label:"See agent locations",      desc:"View live map of all active agents",             icon:"🗺", agentDef:false, factoryDef:false},
  // ── Data & Export ──────────────────────────────────────────
  {key:"data_exportBackup",section:"Data",      label:"Export full backup",       desc:"Download complete JSON backup of all data",      icon:"📤", agentDef:false, factoryDef:false},
  {key:"data_importBackup",section:"Data",      label:"Import backup",            desc:"Restore data from a JSON backup file",           icon:"📥", agentDef:false, factoryDef:false},
];

// Build default finePerms for a role
function defaultFinePerms(role){
  if(role==="admin") return Object.fromEntries(FINE_PERM_DEFS.map(d=>[d.key,true]));
  return Object.fromEntries(FINE_PERM_DEFS.map(d=>[d.key, role==="factory"?d.factoryDef:d.agentDef]));
}

// Check if a user (sess object) has a fine-grained permission
// Admin always returns true
function hasPerm(sess, key){
  if(!sess) return false;
  if(sess.role==="admin") return true;
  const fp = sess.finePerms || defaultFinePerms(sess.role);
  return fp[key] === true;
}

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
  companyGST:"",
  companyPhone:"",
  showWastageTo:["admin","factory"],
  wastageTypes:["Burnt","Broken","Expired","Overproduced","Quality Reject","Other"],
  shifts:["Morning","Afternoon","Evening","Night"],
  staffLoginMode:"individual",
  staffNames:[],
  lowStockThreshold: 5,
  churnDays: 14,
  qcMode: "detailed",
  notifTargets: {
    payment:   ["admin"],
    delivery:  ["admin","agent"],
    lowstock:  ["admin","factory"],
    newentry:  ["admin"],
    noticeboard: ["admin","factory","agent"],
  },
  noticeBoard: [],
  briefingDismissedDate: "",
  pinMode: false,
  quickActions: ["newDelivery","markDone","logWastage","addExpense"],
  weatherLat: 15.4909,
  weatherLng: 73.8278,
  weatherLabel: "Goa",
  ablyKey: "",
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
  const gst    = settings?.companyGST     || "";
  const coPhone= settings?.companyPhone   || "";
  const invoiceNo=`INV-${(record.date||today()).replace(/-/g,"")}-${(record.id||uid()).slice(-4).toUpperCase()}`;
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
  <div><div class="brand">🫓 ${co}</div><div class="bsub">${cosub}</div>${coPhone?`<div class="bsub">📞 ${coPhone}</div>`:""}${gst?`<div class="bsub">GST: ${gst}</div>`:""}</div>
  <div><div class="ititle">INVOICE</div>
  <div class="imeta">${invoiceNo}</div>
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
</div>`:type==="delivery"?`<div class="sumbox">
<div><div class="sl">Order Total</div><div class="sv">${inr(total)}</div></div>
<div><div class="sl">Status</div><div class="sv" style="color:${record.status==="Delivered"?"#059669":record.status==="In Transit"?"#2563eb":"#d97706"}">${record.status||"Pending"}</div></div>
${record.deliveryDate?`<div><div class="sl">Deliver By</div><div class="sv">${record.deliveryDate}</div></div>`:""}
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
// ── Corporate Design System ──────────────────────────────────────
// Light: crisp white + cool slate, accent: deep navy blue #1e3a5f
// Dark:  rich charcoal + steel, accent: electric sapphire #3b82f6
const LT={
  bg:"#f0f2f5",card:"#ffffff",border:"#dde1e8",
  text:"#0f1923",sub:"#5a6478",inp:"#f4f6f9",inpB:"#cdd2dc",
  accent:"#1e3a5f",accentFg:"#ffffff",accentHover:"#16304f",
  accentLight:"rgba(30,58,95,0.08)",accentMid:"rgba(30,58,95,0.15)",
  sidebar:"#0f1923",sidebarBorder:"#1c2638",
  sidebarText:"#e8edf5",sidebarSub:"#94a3b8",
  sidebarActive:"#60a5fa",sidebarActiveBg:"rgba(96,165,250,0.12)",
  success:"#059669",warning:"#d97706",danger:"#dc2626",
  successBg:"#ecfdf5",warningBg:"#fffbeb",dangerBg:"#fef2f2",
};
const DK={
  bg:"#0d1117",card:"#161b22",border:"#21262d",
  text:"#e6edf3",sub:"#8b949e",inp:"#1c2128",inpB:"#30363d",
  accent:"#3b82f6",accentFg:"#ffffff",accentHover:"#2563eb",
  accentLight:"rgba(59,130,246,0.1)",accentMid:"rgba(59,130,246,0.18)",
  sidebar:"#0d1117",sidebarBorder:"#21262d",
  sidebarText:"#e6edf3",sidebarSub:"#8b949e",
  sidebarActive:"#60a5fa",sidebarActiveBg:"rgba(96,165,250,0.1)",
  success:"#10b981",warning:"#f59e0b",danger:"#f87171",
  successBg:"rgba(16,185,129,0.1)",warningBg:"rgba(245,158,11,0.1)",dangerBg:"rgba(248,113,113,0.1)",
};
const T=(dm)=>dm?DK:LT;

// ═══════════════════════════════════════════════════════════════
//  UI ATOMS
// ═══════════════════════════════════════════════════════════════
function Pill({c="stone",dm,children}){
  const m={
    stone:["bg-slate-100 text-slate-600 border border-slate-200","bg-slate-800 text-slate-300 border border-slate-700"],
    amber:["bg-amber-50 text-amber-700 border border-amber-200","bg-amber-900/20 text-amber-400 border border-amber-700/40"],
    green:["bg-emerald-50 text-emerald-700 border border-emerald-200","bg-emerald-900/20 text-emerald-400 border border-emerald-700/40"],
    red:["bg-red-50 text-red-700 border border-red-200","bg-red-900/20 text-red-400 border border-red-700/40"],
    sky:["bg-sky-50 text-sky-700 border border-sky-200","bg-sky-900/20 text-sky-400 border border-sky-700/40"],
    blue:["bg-blue-50 text-blue-700 border border-blue-200","bg-blue-900/20 text-blue-400 border border-blue-700/40"],
    purple:["bg-violet-50 text-violet-700 border border-violet-200","bg-violet-900/20 text-violet-400 border border-violet-700/40"],
  };
  return <span className={cx("inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded tracking-wide uppercase whitespace-nowrap select-none",(m[c]||m.stone)[dm?1:0])}>{children}</span>;
}
function Hr({dm}){const t=T(dm);return <div style={{height:1,background:t.border}}/>;}
function Inp({label,dm,className="",...p}){
  const t=T(dm);
  return <div className={className}>
    {label&&<label style={{color:t.sub,letterSpacing:"0.06em"}} className="block text-[10px] font-semibold uppercase mb-1.5 ml-0.5">{label}</label>}
    <input style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,fontSize:15,WebkitAppearance:"none",borderRadius:6,touchAction:"manipulation",transition:"border-color 0.15s,box-shadow 0.15s"}} className="w-full px-3 py-2.5 outline-none placeholder:text-slate-400/50" onFocus={e=>{e.target.style.borderColor=dm?"#3b82f6":"#1e3a5f";e.target.style.boxShadow=dm?"0 0 0 3px rgba(59,130,246,0.15)":"0 0 0 3px rgba(30,58,95,0.1)";}} onBlur={e=>{e.target.style.borderColor=t.inpB;e.target.style.boxShadow="none";}} {...p}/>
  </div>;
}
function Sel({label,dm,children,className="",...p}){
  const t=T(dm);
  return <div className={className}>
    {label&&<label style={{color:t.sub,letterSpacing:"0.06em"}} className="block text-[10px] font-semibold uppercase mb-1.5 ml-0.5">{label}</label>}
    <select style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,fontSize:15,WebkitAppearance:"none",appearance:"none",borderRadius:6,touchAction:"manipulation",transition:"border-color 0.15s,box-shadow 0.15s"}} className="w-full px-3 py-2.5 outline-none" onFocus={e=>{e.target.style.borderColor=dm?"#3b82f6":"#1e3a5f";e.target.style.boxShadow=dm?"0 0 0 3px rgba(59,130,246,0.15)":"0 0 0 3px rgba(30,58,95,0.1)";}} onBlur={e=>{e.target.style.borderColor=t.inpB;e.target.style.boxShadow="none";}} {...p}>{children}</select>
  </div>;
}
function Btn({children,onClick,v="primary",size="md",className="",disabled=false,dm}){
  const t=T(dm);
  const V={
    primary:`background:${t.accent};color:${t.accentFg};border:1px solid ${t.accent};`,
    ghost:dm?"background:#1c2128;color:#e6edf3;border:1px solid #30363d;":"background:#ffffff;color:#1e3a5f;border:1px solid #dde1e8;",
    danger:"background:#dc2626;color:#fff;border:1px solid #dc2626;",
    success:"background:#059669;color:#fff;border:1px solid #059669;",
    amber:"background:#d97706;color:#fff;border:1px solid #d97706;",
    outline:dm?"background:transparent;color:#60a5fa;border:1px solid #60a5fa;":"background:transparent;color:#1e3a5f;border:1px solid #1e3a5f;",
    sky:"background:#0ea5e9;color:#fff;border:1px solid #0ea5e9;",
    purple:"background:#7c3aed;color:#fff;border:1px solid #7c3aed;",
  };
  const S={sm:"padding:6px 12px;font-size:12px;min-height:32px;",md:"padding:9px 16px;font-size:13px;min-height:40px;",lg:"padding:11px 24px;font-size:14px;min-height:46px;"};
  const base={fontWeight:600,borderRadius:6,letterSpacing:"0.01em",cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.45:1,transition:"all 0.15s",WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6};
  const styleStr=(V[v]||V.primary)+(S[size]||S.md);
  const styleObj={...base,...Object.fromEntries(styleStr.split(";").filter(Boolean).map(s=>{const[k,...vs]=s.split(":");const key=k.trim().replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return[key,vs.join(":").trim()];}))};
  return <button onClick={onClick} disabled={disabled} style={styleObj} className={cx("select-none active:scale-[0.97]",className)}>{children}</button>;
}
function Card({children,className="",dm}){
  const t=T(dm);
  return <div style={{background:t.card,border:`1px solid ${t.border}`,boxShadow:dm?"0 1px 4px rgba(0,0,0,0.4)":"0 1px 3px rgba(0,0,0,0.05),0 1px 2px rgba(0,0,0,0.03)",borderRadius:8}} className={className}>{children}</div>;
}
function StatCard({label,value,sub,accent,dm}){
  const t=T(dm);
  return <div style={{background:t.card,border:`1px solid ${t.border}`,boxShadow:dm?"0 1px 4px rgba(0,0,0,0.4)":"0 1px 3px rgba(0,0,0,0.05)",borderRadius:8,borderLeft:`3px solid ${accent}`}} className="p-4 relative">
    <p style={{color:t.sub,letterSpacing:"0.07em"}} className="text-[10px] font-semibold uppercase mb-2">{label}</p>
    <p style={{color:t.text}} className="text-2xl font-bold leading-none tracking-tight">{value}</p>
    {sub&&<p style={{color:t.sub}} className="text-[11px] mt-1.5 font-medium">{sub}</p>}
  </div>;
}
function Sheet({open,title,onClose,children,dm}){
  const t=T(dm);
  const scrollYRef=useRef(0);
  useEffect(()=>{
    if(open){
      scrollYRef.current=window.scrollY;
      document.body.style.overflow="hidden";
      document.body.style.position="fixed";
      document.body.style.top=`-${scrollYRef.current}px`;
      document.body.style.width="100%";
    }
    return()=>{
      document.body.style.overflow="";
      document.body.style.position="";
      document.body.style.top="";
      document.body.style.width="";
      if(open) window.scrollTo(0,scrollYRef.current);
    };
  },[open]);
  if(!open)return null;
  return <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{background:"rgba(0,0,0,0.6)",WebkitBackdropFilter:"blur(4px)",backdropFilter:"blur(4px)"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div style={{background:t.card,maxHeight:"92svh",border:`1px solid ${t.border}`,boxShadow:"0 20px 60px rgba(0,0,0,0.35)",borderRadius:"8px 8px 0 0"}} className="w-full max-w-lg sm:rounded-lg flex flex-col" onClick={e=>e.stopPropagation()}>
      <div style={{borderBottom:`1px solid ${t.border}`,background:dm?"#1c2128":"#f8fafc"}} className="flex items-center justify-between px-5 py-4 shrink-0 rounded-t-lg">
        <span style={{color:t.text,letterSpacing:"-0.01em"}} className="font-semibold text-sm">{title}</span>
        <button onClick={onClose} style={{background:"transparent",color:t.sub,border:`1px solid ${t.inpB}`,width:28,height:28,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",cursor:"pointer"}}>✕</button>
      </div>
      <div className="px-5 py-5 flex flex-col gap-4" style={{overflowY:"auto",WebkitOverflowScrolling:"touch",overscrollBehavior:"contain",paddingBottom:"calc(1.25rem + env(safe-area-inset-bottom))"}}>{children}</div>
    </div>
  </div>;
}
function Toast({msg,onDone}){
  useEffect(()=>{const t=setTimeout(onDone,2800);return()=>clearTimeout(t);});
  return <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] text-sm px-4 py-3 font-medium whitespace-nowrap pointer-events-none flex items-center gap-2.5" style={{background:"#0f1923",color:"#e6edf3",border:"1px solid #21262d",boxShadow:"0 4px 16px rgba(0,0,0,0.4)",WebkitBackdropFilter:"blur(8px)",backdropFilter:"blur(8px)",borderRadius:6}}><span style={{width:6,height:6,borderRadius:"50%",background:"#3b82f6",flexShrink:0,display:"inline-block"}}/>{msg}</div>;
}
function Confirm({msg,onYes,onNo,dm}){
  const t=T(dm);if(!msg)return null;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center px-6" style={{background:"rgba(0,0,0,0.6)",WebkitBackdropFilter:"blur(4px)",backdropFilter:"blur(4px)"}}>
    <div style={{background:t.card,border:`1px solid ${t.border}`,boxShadow:"0 20px 50px rgba(0,0,0,0.4)",borderRadius:8}} className="w-full max-w-sm p-6 flex flex-col gap-5">
      <div style={{width:36,height:36,borderRadius:6,background:"rgba(220,38,38,0.1)",border:"1px solid rgba(220,38,38,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>⚠️</div>
      <div>
        <p style={{color:t.text,fontWeight:600,fontSize:14,marginBottom:4}}>Confirm Action</p>
        <p style={{color:t.sub,fontSize:13,lineHeight:1.6}}>{msg}</p>
      </div>
      <div className="flex gap-3 justify-end"><Btn dm={dm} v="ghost" size="sm" onClick={onNo}>Cancel</Btn><Btn v="danger" size="sm" onClick={onYes}>Delete</Btn></div>
    </div>
  </div>;
}
function Search({value,onChange,placeholder,dm}){
  const t=T(dm);
  return <div className="relative">
    <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder||"Search…"} style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,fontSize:14,WebkitAppearance:"none",touchAction:"manipulation",borderRadius:6,transition:"border-color 0.15s,box-shadow 0.15s"}} className="w-full pl-9 pr-8 py-2 outline-none placeholder:text-slate-400/50" onFocus={e=>{e.target.style.borderColor=dm?"#3b82f6":"#1e3a5f";e.target.style.boxShadow=dm?"0 0 0 3px rgba(59,130,246,0.12)":"0 0 0 3px rgba(30,58,95,0.08)";}} onBlur={e=>{e.target.style.borderColor=t.inpB;e.target.style.boxShadow="none";}}/>
    {value&&<button onClick={()=>onChange("")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:t.inpB,color:t.sub,width:16,height:16,borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,border:"none",cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>✕</button>}
  </div>;
}

// Toggle switch
function Tog({on,onChange,dm}){
  const t=T(dm);
  const ac=dm?"#3b82f6":"#1e3a5f";
  return <button onClick={onChange} style={{background:on?ac:t.inpB,width:38,height:22,borderRadius:99,padding:2,display:"flex",alignItems:"center",justifyContent:on?"flex-end":"flex-start",flexShrink:0,transition:"all 0.2s",border:"none",cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>
    <div style={{width:18,height:18,background:"#fff",borderRadius:"50%",boxShadow:"0 1px 3px rgba(0,0,0,0.25)",transition:"all 0.2s"}}/>
  </button>;
}

// Per-product order row with dial + individual price chips
function ProdRow({product,line,onChange,dm,showPrice=true}){
  const t=T(dm);
  const qty=line?.qty||0;
  const price=line?.priceAmount||0;
  const ac=dm?"#3b82f6":"#1e3a5f";
  return (
    <div style={{background:t.card,border:`1px solid ${qty>0?ac:t.border}`,borderRadius:6,transition:"border-color 0.15s",boxShadow:qty>0?(dm?"0 0 0 1px rgba(59,130,246,0.2)":"0 0 0 1px rgba(30,58,95,0.08)"):"none"}} className="p-3">
      <div className="flex items-center justify-between mb-3">
        <p style={{color:t.text,fontWeight:600,fontSize:13}}>{product.name}</p>
        {showPrice&&qty>0&&price>0&&<p style={{color:ac,fontWeight:700,fontSize:13}}>{inr(qty*price)}</p>}
        {!showPrice&&qty>0&&<p style={{color:t.sub,fontSize:12,fontWeight:500}}>{qty} {product.unit}</p>}
      </div>
      <div className="flex items-center gap-2">
        <div style={{background:dm?"#1c2128":"#f0f2f5",borderRadius:4,padding:"2px 8px",minWidth:40,textAlign:"center"}}>
          <span style={{color:qty>0?ac:t.sub,fontWeight:700,fontSize:15}}>{qty}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-1">
          <button onClick={()=>onChange({qty:Math.max(0,qty-1),priceAmount:price})} style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,width:36,height:36,borderRadius:4,fontWeight:700,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>−</button>
          <input type="number" value={qty} min={0} max={9999} onChange={e=>onChange({qty:Math.max(0,Math.min(9999,+e.target.value||0)),priceAmount:price})} style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,fontSize:14,WebkitAppearance:"none",MozAppearance:"textfield",touchAction:"manipulation",borderRadius:4,textAlign:"center",flex:1,minWidth:0,padding:"8px 4px"}} className="outline-none"/>
          <button onClick={()=>onChange({qty:qty+1,priceAmount:price})} style={{background:ac,color:"#fff",border:"none",width:36,height:36,borderRadius:4,fontWeight:700,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>+</button>
        </div>
      </div>
      {showPrice&&(
        <div className="mt-3">
          <p style={{color:t.sub,fontSize:10,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:6}}>Unit price</p>
          <div className="flex flex-wrap gap-1.5">
            {(product.prices||[]).map((p,i)=>(
              <button key={i} onClick={()=>onChange({qty,priceAmount:p})}
                style={{borderRadius:4,...(price===p?{background:ac,color:"#fff",border:`1px solid ${ac}`}:{background:t.inp,color:t.sub,border:`1px solid ${t.inpB}`}),padding:"6px 10px",fontSize:12,fontWeight:600,cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>₹{p}</button>
            ))}
            <div className="flex items-center gap-1">
              <span style={{color:t.sub,fontSize:10}}>₹</span>
              <input type="number" placeholder="Custom"
                value={price&&!(product.prices||[]).includes(price)?price:""}
                onChange={e=>{const v=+e.target.value;if(v>0)onChange({qty,priceAmount:v});}}
                style={{background:t.inp,border:`1px solid ${price&&!(product.prices||[]).includes(price)?ac:t.inpB}`,color:t.text,width:64,fontSize:13,borderRadius:4,padding:"6px 8px",WebkitAppearance:"none",touchAction:"manipulation"}}
                className="outline-none text-center"/>
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
//  BROWSER PUSH NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════
async function requestPushPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  const perm = await Notification.requestPermission();
  return perm === "granted";
}
function sendBrowserNotif(title, body, icon = "🫓") {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>" + icon + "</text></svg>",
      tag: title,
    });
  } catch (e) { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════
//  MORNING BRIEFING COMPONENT
// ═══════════════════════════════════════════════════════════════
function MorningBriefing({ dm, onDismiss, onUnpin, pinned, data }) {
  const t = T(dm);
  const { pendingCount, todayRev, lowStockCount, overdueCount, churnCount, noticeCount } = data;
  const items = [
    pendingCount > 0 && { icon: "⏳", label: "Pending deliveries today", value: pendingCount, color: "#f59e0b" },
    todayRev > 0 && { icon: "💰", label: "Revenue collected today", value: inr(todayRev), color: "#10b981" },
    lowStockCount > 0 && { icon: "⚠️", label: "Low stock items", value: lowStockCount, color: "#ef4444" },
    overdueCount > 0 && { icon: "🔴", label: "Overdue deliveries", value: overdueCount, color: "#ef4444" },
    churnCount > 0 && { icon: "💤", label: `Inactive ${data.churnDays}+ days`, value: churnCount, color: "#8b5cf6" },
    noticeCount > 0 && { icon: "📌", label: "Unread notices", value: noticeCount, color: "#0ea5e9" },
  ].filter(Boolean);
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 20, overflow: "hidden", marginBottom: 0 }}>
      <div style={{ background: dm ? "linear-gradient(135deg,#0d1421,#111820)" : "linear-gradient(135deg,#f0f4f8,#e8edf5)", padding: "16px 18px", borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ color: "#3b82f6", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>📅 Morning Briefing</p>
            <p style={{ color: t.text, fontWeight: 800, fontSize: 15 }}>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onUnpin} style={{ background: t.inp, border: `1px solid ${t.border}`, color: t.sub, borderRadius: 10, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{pinned ? "Unpin" : "Pin"}</button>
            <button onClick={onDismiss} style={{ background: t.inp, border: `1px solid ${t.border}`, color: t.sub, borderRadius: 10, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Dismiss</button>
          </div>
        </div>
      </div>
      <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        {items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <p style={{ fontSize: 22 }}>🎉</p>
            <p style={{ color: t.sub, fontSize: 13, fontWeight: 600, marginTop: 6 }}>All clear — great day ahead!</p>
          </div>
        ) : items.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: t.inp, borderRadius: 12, padding: "10px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ color: t.sub, fontSize: 13 }}>{item.label}</span>
            </div>
            <span style={{ color: item.color, fontWeight: 800, fontSize: 15 }}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
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
  const [pinMode,setPinMode]=useState(false);
  const [pinTarget,setPinTarget]=useState(null); // user being PIN-authenticated
  const [pinVal,setPinVal]=useState("");
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
  function enterPin(digit){
    if(pinVal.length>=4)return;
    const next=pinVal+digit;
    setPinVal(next);
    if(next.length===4){
      setTimeout(()=>{
        if(pinTarget&&pinTarget.pin===next&&pinTarget.active){onLogin({...pinTarget,loginAt:Date.now()});}
        else{setErr("Incorrect PIN. Try again.");setPinVal("");}
      },200);
    }
  }
  // PIN login screen
  if(pinMode&&pinTarget){
    return(
      <div style={{background:dm?"#0c0c10":"#f2f2ed",minHeight:"100svh",fontFamily:"system-ui,sans-serif"}} className="flex flex-col items-center justify-center px-6">
        <div style={{width:"100%",maxWidth:320,textAlign:"center"}}>
          <div style={{background:"rgba(245,158,11,0.12)",border:"2px solid rgba(245,158,11,0.3)",width:64,height:64,borderRadius:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 16px",userSelect:"none"}}>{settings?.appEmoji||"🫓"}</div>
          <p style={{color:dm?"#fafafa":"#18181b",fontWeight:800,fontSize:18,marginBottom:4}}>{pinTarget.name}</p>
          <p style={{color:dm?"#9ca3af":"#6b7280",fontSize:12,marginBottom:28}}>Enter your 4-digit PIN</p>
          {/* PIN dots */}
          <div className="flex gap-4 justify-center mb-8">
            {[0,1,2,3].map(i=>(
              <div key={i} style={{width:16,height:16,borderRadius:"50%",background:pinVal.length>i?"#f59e0b":dm?"#333":"#e5e5e0",border:`2px solid ${pinVal.length>i?"#f59e0b":dm?"#444":"#d1d1cd"}`,transition:"all 0.15s"}}/>
            ))}
          </div>
          {err&&<p style={{color:"#ef4444",fontSize:12,fontWeight:600,marginBottom:16}}>{err}</p>}
          {/* PIN keypad */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((k,i)=>(
              <button key={i} onClick={()=>{if(k==="⌫"){setPinVal(v=>v.slice(0,-1));setErr("");}else if(k!=="")enterPin(String(k));}}
                disabled={k===""}
                style={{height:64,borderRadius:16,fontSize:k==="⌫"?20:22,fontWeight:700,background:k===""?"transparent":dm?"#1e1e24":"#fff",color:dm?"#fafafa":"#18181b",border:k===""?"none":`1px solid ${dm?"#2e2e36":"#e5e5e0"}`,boxShadow:k===""?"none":dm?"none":"0 1px 4px rgba(0,0,0,0.08)",cursor:k===""?"default":"pointer",transition:"background 0.1s",opacity:k===""?0:1,WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}
              >{k}</button>
            ))}
          </div>
          <button onClick={()=>{setPinMode(false);setPinTarget(null);setPinVal("");setErr("");}} style={{color:dm?"#6b7280":"#9ca3af",fontSize:11,fontWeight:600,background:"none",border:"none",cursor:"pointer",textDecoration:"underline",WebkitTapHighlightColor:"transparent",touchAction:"manipulation",minHeight:44,padding:"8px 0"}}>← Use password instead</button>
        </div>
      </div>
    );
  }
  // ── STAFF PICKER MODE ──────────────────────────────────────────
  if(mode==="picker"&&!showAdminForm){
    // eslint-disable-next-line no-unused-vars
    const ac=dm?"#3b82f6":"#1e3a5f";
    return(
      <div style={{background:dm?"#0d1117":"#f0f2f5",minHeight:"100svh",fontFamily:"system-ui,sans-serif"}} className="flex flex-col items-center justify-center px-4 py-10">
        {/* Brand */}
        <div className="text-center mb-8">
          <div style={{background:dm?"rgba(59,130,246,0.1)":"rgba(30,58,95,0.08)",border:`1px solid ${dm?"rgba(59,130,246,0.25)":"rgba(30,58,95,0.2)"}`,borderRadius:10,width:56,height:56,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 14px",userSelect:"none"}}>{settings?.appEmoji||"🫓"}</div>
          <h1 style={{color:dm?"#e6edf3":"#0f1923",fontWeight:700,fontSize:22,letterSpacing:"-0.02em",marginBottom:3}}>{settings?.appName||"TAS Healthy World"}</h1>
          <p style={{color:dm?"#8b949e":"#5a6478",fontSize:12,fontWeight:500}}>{settings?.appSubtitle||"Operations"}</p>
        </div>
        {/* Picker */}
        <div style={{width:"100%",maxWidth:400}}>
          <p style={{color:dm?"#8b949e":"#5a6478",fontSize:10,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",textAlign:"center",marginBottom:12}}>Select your profile</p>
          {staffNames.length===0&&(
            <div style={{background:dm?"#161b22":"#fff",border:`1px solid ${dm?"#21262d":"#dde1e8"}`,borderRadius:6,padding:"20px",textAlign:"center"}}>
              <p style={{color:dm?"#8b949e":"#5a6478",fontSize:13}}>No staff profiles configured.</p>
              <p style={{color:dm?"#6b7280":"#8b949e",fontSize:11,marginTop:4}}>Admin → Settings → Staff Login Mode</p>
            </div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {staffNames.map((name,i)=>{
              const initials=name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
              const colors=["#1e3a5f","#7c3aed","#0369a1","#059669","#dc2626","#9333ea"];
              const color=colors[i%colors.length];
              return(
                <button key={name} onClick={()=>pickStaff(name)}
                  style={{background:dm?"#161b22":"#fff",border:`1px solid ${dm?"#21262d":"#dde1e8"}`,borderRadius:6,padding:"12px 14px",display:"flex",alignItems:"center",gap:12,textAlign:"left",width:"100%",cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>
                  <div style={{width:36,height:36,background:`${color}18`,border:`1px solid ${color}35`,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",color,fontWeight:700,fontSize:13,flexShrink:0}}>{initials}</div>
                  <div style={{flex:1}}>
                    <p style={{color:dm?"#e6edf3":"#0f1923",fontWeight:600,fontSize:14,lineHeight:1.2}}>{name}</p>
                    <p style={{color:dm?"#8b949e":"#5a6478",fontSize:11,marginTop:1}}>Tap to continue</p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dm?"#8b949e":"#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              );
            })}
          </div>
          {err&&<div style={{background:"rgba(220,38,38,0.08)",border:"1px solid rgba(220,38,38,0.2)",borderRadius:6,padding:"10px 12px",marginTop:12,textAlign:"center"}}>
            <p style={{color:"#dc2626",fontSize:12,fontWeight:600}}>{err}</p>
          </div>}
          <button onClick={()=>{setErr("");setShowAdminForm(true);}} style={{color:dm?"#8b949e":"#5a6478",fontSize:11,fontWeight:500,display:"block",width:"100%",textAlign:"center",marginTop:24,background:"none",border:"none",cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"manipulation",minHeight:40,letterSpacing:"0.02em"}}>Administrator Login →</button>
        </div>
      </div>
    );
  }
  // ── INDIVIDUAL / ADMIN LOGIN FORM ─────────────────────────────
  return (
    <div style={{background:dm?"#0d1117":"#f0f2f5",minHeight:"100svh"}} className="flex flex-col lg:flex-row">
      {/* Left panel on desktop — deep navy corporate brand panel */}
      <div style={{background:"#0f1923",position:"relative",overflow:"hidden"}} className="hidden lg:flex flex-col justify-center items-center flex-1 p-12">
        <div style={{position:"absolute",inset:0,backgroundImage:"radial-gradient(circle at 20% 30%, rgba(30,58,95,0.8) 0%, transparent 55%), radial-gradient(circle at 80% 75%, rgba(15,25,35,0.9) 0%, transparent 50%)"}}/>
        {/* Subtle grid lines */}
        <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",backgroundSize:"48px 48px"}}/>
        <div className="text-center relative z-10" style={{maxWidth:340}}>
          <div style={{background:"rgba(59,130,246,0.12)",border:"1px solid rgba(59,130,246,0.25)",borderRadius:8,width:52,height:52,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto 20px",userSelect:"none"}}>{settings?.appEmoji||"🫓"}</div>
          <h1 style={{color:"#e6edf3",fontWeight:700,fontSize:28,letterSpacing:"-0.02em",lineHeight:1.15,marginBottom:8}}>{settings?.appName||"TAS Healthy World"}</h1>
          <p style={{color:"rgba(255,255,255,0.35)",fontSize:13,fontWeight:400,lineHeight:1.6}}>{settings?.appSubtitle||"Paratha Factory · Operations"}</p>
          <div style={{height:1,background:"rgba(255,255,255,0.06)",margin:"28px 0"}}/>
          <div style={{display:"flex",flexDirection:"column",gap:12,textAlign:"left"}}>
            {[{label:"Real-time synchronisation",icon:"⚡",sub:"Live updates across all devices"},{label:"Role-based access control",icon:"🔐",sub:"Granular permissions per user"},{label:"Firebase cloud backend",icon:"🔥",sub:"Secure, scalable infrastructure"}].map(f=>(
              <div key={f.label} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                <span style={{fontSize:15,marginTop:1,opacity:0.7}}>{f.icon}</span>
                <div>
                  <p style={{color:"rgba(255,255,255,0.6)",fontSize:12,fontWeight:600,marginBottom:1}}>{f.label}</p>
                  <p style={{color:"rgba(255,255,255,0.25)",fontSize:11}}>{f.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{position:"absolute",bottom:24,left:0,right:0,textAlign:"center"}}>
          <p style={{color:"rgba(255,255,255,0.18)",fontSize:10,fontWeight:500,letterSpacing:"0.06em",textTransform:"uppercase"}}>TAS Healthy World · Confidential</p>
        </div>
      </div>
      {/* Right panel */}
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-12">
        {/* Mobile header banner */}
        <div className="lg:hidden w-full mb-8" style={{borderRadius:8,overflow:"hidden",position:"relative",background:"#0f1923"}}>
          <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",backgroundSize:"32px 32px"}}/>
          <div style={{position:"relative",zIndex:1,padding:"24px 20px",textAlign:"center"}}>
            <div style={{background:"rgba(59,130,246,0.12)",border:"1px solid rgba(59,130,246,0.25)",width:48,height:48,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,margin:"0 auto 12px",userSelect:"none"}}>{settings?.appEmoji||"🫓"}</div>
            <h1 style={{color:"#e6edf3",fontWeight:700,fontSize:20,letterSpacing:"-0.015em",lineHeight:1.2,marginBottom:4}}>{settings?.appName||"TAS Healthy World"}</h1>
            <p style={{color:"rgba(255,255,255,0.35)",fontSize:11,fontWeight:400,marginBottom:16}}>{settings?.appSubtitle||"Paratha Factory · Operations"}</p>
            <div style={{height:1,background:"rgba(255,255,255,0.08)",marginBottom:18}}/>
            <div style={{display:"flex",gap:0,justifyContent:"center"}}>
              {[{label:"Real-time sync",icon:"⚡"},{label:"Multi-role",icon:"🔐"},{label:"Firebase",icon:"🔥"}].map((f,i,a)=>(
                <div key={f.label} style={{flex:1,textAlign:"center",borderRight:i<a.length-1?"1px solid rgba(255,255,255,0.08)":"none",padding:"0 8px"}}>
                  <div style={{fontSize:18,marginBottom:4}}>{f.icon}</div>
                  <p style={{color:"rgba(255,255,255,0.35)",fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",lineHeight:1.3}}>{f.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{width:"100%",maxWidth:360}}>
          <p style={{color:dm?"#8b949e":"#5a6478",fontSize:10,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:16}}>Sign in to your account</p>
          <div style={{background:dm?"#161b22":"#fff",border:`1px solid ${dm?"#21262d":"#dde1e8"}`,borderRadius:8,padding:24,boxShadow:dm?"0 4px 24px rgba(0,0,0,0.4)":"0 2px 8px rgba(0,0,0,0.07)"}}>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <Inp dm={dm} label="Username" value={u} onChange={e=>setU(e.target.value)} placeholder="Enter username" autoComplete="username"/>
              <Inp dm={dm} label="Password" type="password" value={p} onChange={e=>setP(e.target.value)} placeholder="••••••••" autoComplete="current-password" onKeyDown={e=>e.key==="Enter"&&go()}/>
              {err&&<div style={{background:"rgba(220,38,38,0.08)",border:"1px solid rgba(220,38,38,0.2)",borderRadius:4,padding:"8px 12px"}}>
                <p style={{color:"#dc2626",fontSize:12,fontWeight:500}}>{err}</p>
              </div>}
              <button onClick={go} disabled={busy} style={{background:dm?"#3b82f6":"#1e3a5f",color:"#fff",border:"none",borderRadius:6,padding:"10px 20px",fontSize:14,fontWeight:600,cursor:busy?"not-allowed":"pointer",opacity:busy?0.6:1,transition:"background 0.15s",letterSpacing:"0.01em",WebkitTapHighlightColor:"transparent",touchAction:"manipulation",minHeight:44,width:"100%"}}>
                {busy?"Authenticating…":"Sign In"}
              </button>
            </div>
          </div>
          {mode==="picker"
            ?<button onClick={()=>setShowAdminForm(false)} style={{color:dm?"#8b949e":"#5a6478",fontSize:11,fontWeight:500,display:"block",width:"100%",textAlign:"center",marginTop:16,background:"none",border:"none",cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"manipulation",minHeight:36}}>← Return to staff selection</button>
            :<p style={{color:dm?"#8b949e":"#5a6478",textAlign:"center",fontSize:11,marginTop:16,fontWeight:400}}>User accounts are managed by your administrator.</p>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ROOT
// ═══════════════════════════════════════════════════════════════
// goldPulse keyframe — injected once at module load, not on every render
if(typeof document!=="undefined"&&!document.getElementById("goldPulseStyle")){
  const _s=document.createElement("style");
  _s.id="goldPulseStyle";
  _s.textContent="@keyframes goldPulse{0%,100%{box-shadow:0 0 0 3px rgba(59,130,246,0.2),0 4px 24px rgba(30,58,95,0.15)}50%{box-shadow:0 0 0 6px rgba(59,130,246,0.3),0 8px 32px rgba(30,58,95,0.25)}}";
  document.head.appendChild(_s);
}
if(typeof document!=="undefined"&&!document.getElementById("mobileOptStyle")){
  const _ms=document.createElement("style");
  _ms.id="mobileOptStyle";
  _ms.textContent=`
    *{-webkit-tap-highlight-color:transparent;tap-highlight-color:transparent;}
    button,a,[role=button]{touch-action:manipulation;}
    input,select,textarea{touch-action:manipulation;}
    html{-webkit-text-size-adjust:100%;text-size-adjust:100%;}
    body{overscroll-behavior-y:none;}
    ::-webkit-scrollbar{width:0;height:0;}
    @media(max-width:1023px){
      .scrollbar-none::-webkit-scrollbar{display:none;}
    }
  `;
  document.head.appendChild(_ms);
}
export default function Root(){
  const [dm,setDm]=useState(()=>ls("tas_dm",false));
  const [users,setUsers]=useStore("tas9_users",D_USERS);
  const [settings,setSettings]=useStore("tas10_settings",D_SETTINGS);
  const [sess,setSess]=useState(()=>{const s=ls("tas9_sess",null);return s&&Date.now()-s.loginAt<SESSION_TTL?s:null;});
  const [fbReady, setFbReady] = useState(false);
  useEffect(()=>{
    // Give Firebase up to 3s to respond before showing login — prevents picker flash
    const t = setTimeout(()=>setFbReady(true), 3000);
    // Also mark ready as soon as settings differ from defaults (Firebase responded)
    if(JSON.stringify(settings)!==JSON.stringify(D_SETTINGS)||JSON.stringify(users)!==JSON.stringify(D_USERS)) setFbReady(true);
    return ()=>clearTimeout(t);
  },[settings,users]);
  useEffect(()=>lsw("tas_dm",dm),[dm]);
  useEffect(()=>{if(sess)lsw("tas9_sess",sess);else lsdel("tas9_sess");},[sess]);
  useEffect(()=>{if(!sess)return;const t=setInterval(()=>{if(Date.now()-sess.loginAt>SESSION_TTL)setSess(null);},30000);return()=>clearInterval(t);},[sess]);
  if(!sess){
    if(!fbReady) return <div style={{background:dm?"#0c0c10":"#f2f2ed",minHeight:"100svh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:40,height:40,border:"3px solid #f59e0b",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>;
    return <Login users={users} onLogin={setSess} dm={dm} settings={settings}/>;
  }  return <CRM sess={sess} onLogout={()=>setSess(null)} dm={dm} setDm={setDm} users={users} setUsers={setUsers} settings={settings} setSettings={setSettings}/>;
}

// ═══════════════════════════════════════════════════════════════
//  GPSMap — Leaflet map showing colour-coded action breadcrumbs
//  Leaflet loaded from CDN once, zero npm install needed
// ═══════════════════════════════════════════════════════════════
function GPSMap({dm,logs,actionMeta,fallbackLat,fallbackLng}){
  const mapRef=useRef(null);
  const leafRef=useRef(null);
  const markersRef=useRef([]);
  const [leafReady,setLeafReady]=useState(!!window.L);

  // Load Leaflet CSS + JS from CDN once
  useEffect(()=>{
    if(window.L){setLeafReady(true);return;}
    if(document.getElementById("leaflet-css")){ return; }
    const css=document.createElement("link");
    css.id="leaflet-css";css.rel="stylesheet";
    css.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const js=document.createElement("script");
    js.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    js.async=true;
    js.onload=()=>setLeafReady(true);
    document.head.appendChild(js);
  },[]);

  // Init map once Leaflet ready
  useEffect(()=>{
    if(!leafReady||!mapRef.current||leafRef.current) return;
    const L=window.L; if(!L) return;
    const map=L.map(mapRef.current,{zoomControl:true,attributionControl:false})
      .setView([fallbackLat||15.4909,fallbackLng||73.8278],12);
    L.tileLayer(dm
      ?"https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      :"https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {maxZoom:19}
    ).addTo(map);
    leafRef.current=map;
    return()=>{if(leafRef.current){leafRef.current.remove();leafRef.current=null;}}
  },[leafReady]);// eslint-disable-line

  // Re-render pins whenever logs change
  useEffect(()=>{
    const L=window.L; if(!L||!leafRef.current) return;
    const map=leafRef.current;
    // Clear old markers
    markersRef.current.forEach(m=>m.remove());
    markersRef.current=[];
    if(!logs||logs.length===0) return;
    logs.forEach(log=>{
      const meta=(actionMeta||{})[log.action]||{color:"#6b7280",icon:"📍",label:log.action};
      const icon=L.divIcon({
        className:"",
        html:`<div title="${log.agentName} — ${meta.label}" style="position:relative">
          <div style="width:16px;height:16px;border-radius:50%;background:${meta.color};border:3px solid #fff;box-shadow:0 2px 8px #0005;"></div>
          <div style="position:absolute;top:-1px;left:-1px;width:18px;height:18px;border-radius:50%;border:2px solid ${meta.color};opacity:0.4;"></div>
        </div>`,
        iconSize:[16,16],iconAnchor:[8,8]
      });
      const speedStr=log.speed!=null?`<br/>💨 ${log.speed} km/h`:"";
      const headingStr=log.heading!=null?` · ${log.heading}°`:"";
      const popup=`<div style="font-family:system-ui,sans-serif;min-width:180px">
        <p style="font-weight:800;font-size:13px;margin:0 0 4px">${log.agentName}</p>
        <span style="background:${meta.color}22;color:${meta.color};padding:2px 8px;border-radius:5px;font-weight:700;font-size:11px">${meta.icon} ${meta.label}</span>
        ${log.customer?`<p style="margin:6px 0 0;font-size:12px">📦 ${log.customer}</p>`:""}
        <p style="margin:6px 0 0;font-size:11px;color:#6b7280">📅 ${log.tsDisplay}</p>
        <p style="margin:2px 0 0;font-size:11px;color:#6b7280">📍 ${log.lat.toFixed(5)}, ${log.lng.toFixed(5)}</p>
        <p style="margin:2px 0 0;font-size:11px;color:#6b7280">🎯 ±${log.acc}m accuracy${headingStr}${speedStr}</p>
        <a href="https://maps.google.com/?q=${log.lat},${log.lng}" target="_blank" style="display:inline-block;margin-top:8px;background:#0ea5e9;color:#fff;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700;text-decoration:none">Open in Maps ↗</a>
      </div>`;
      const marker=L.marker([log.lat,log.lng],{icon})
        .bindPopup(popup,{maxWidth:240})
        .addTo(map);
      markersRef.current.push(marker);
    });
    const coords=logs.map(l=>[l.lat,l.lng]);
    // Cap single-pin zoom at 15 — zoom 18 is individual-building level which is too close for one ping.
    const zoomCap=coords.length===1?15:18;
    try{map.fitBounds(L.latLngBounds(coords),{padding:[40,40],maxZoom:zoomCap});}catch{}
  },[logs,actionMeta]);// eslint-disable-line

  return <div ref={mapRef} style={{width:"100%",height:420,borderRadius:12,overflow:"hidden",background:dm?"#1a1a2e":"#e8f4f8"}}>
    {!leafReady&&<div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <p style={{color:"#6b7280",fontSize:13}}>Loading map…</p>
    </div>}
  </div>;
}

// ═══════════════════════════════════════════════════════════════
//  WeatherWidget — extracted so hooks are at component top-level
// ═══════════════════════════════════════════════════════════════
function WeatherWidget({dm,settings}){
  const t=T(dm);
  const [wx,setWx]=useState(null);
  const [wxLoad,setWxLoad]=useState(true);
  const lat=settings?.weatherLat||15.4909;
  const lng=settings?.weatherLng||73.8278;
  const locLabel=settings?.weatherLabel||"Goa";
  useEffect(()=>{
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weathercode,windspeed_10m,relative_humidity_2m&timezone=Asia%2FKolkata`)
      .then(r=>r.json()).then(d=>{setWx(d.current);setWxLoad(false);}).catch(()=>setWxLoad(false));
  },[lat,lng]);
  const wCode=wx?.weathercode||0;
  const wIcon=wCode===0?"☀️":wCode<=3?"⛅":wCode<=48?"🌫️":wCode<=67?"🌧️":wCode<=77?"❄️":wCode<=82?"🌦️":"⛈️";
  const wDesc=wCode===0?"Clear skies":wCode<=3?"Partly cloudy":wCode<=48?"Foggy / hazy":wCode<=67?"Rain expected":wCode<=77?"Sleet/Snow":wCode<=82?"Showers":wCode<=99?"Thunderstorm":"Stormy";
  const deliveryRisk=wCode>=61?"high":wCode>=45?"moderate":"low";
  const riskColor=deliveryRisk==="high"?"#ef4444":deliveryRisk==="moderate"?"#f59e0b":"#10b981";
  return <div style={{background:dm?"linear-gradient(135deg,#0c1a2e,#111820)":"linear-gradient(135deg,#eff6ff,#f0f9ff)",border:dm?"1px solid #1e3a5f":"1px solid #bfdbfe",borderRadius:20,padding:"16px 20px"}}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[10px] font-bold text-sky-400 uppercase tracking-widest mb-1">🌤 {locLabel} Weather · Now</p>
        {wxLoad?<p style={{color:t.sub}} className="text-sm">Loading…</p>:<>
          <div className="flex items-center gap-3">
            <span style={{fontSize:36,lineHeight:1}}>{wIcon}</span>
            <div>
              <p style={{color:t.text}} className="font-black text-2xl leading-none">{wx?.temperature_2m??'—'}°C</p>
              <p style={{color:t.sub}} className="text-xs mt-0.5">{wDesc} · {wx?.windspeed_10m??'—'} km/h wind · {wx?.relative_humidity_2m??'—'}% humidity</p>
            </div>
          </div>
        </>}
      </div>
      {!wxLoad&&<div className="text-right">
        <p style={{color:riskColor}} className="text-xs font-bold uppercase tracking-wide">Delivery risk</p>
        <p style={{color:riskColor}} className="text-lg font-black capitalize">{deliveryRisk}</p>
        {deliveryRisk==="high"&&<p style={{color:t.sub}} className="text-[10px] mt-0.5">⚠️ Rain may affect routes</p>}
      </div>}
    </div>
  </div>;
}

// ═══════════════════════════════════════════════════════════════
//  CRM

// ─────────────────────────────────────────────────────────────────────────────
//  EXPORTS — consumed by CRM_top.js and CRM_bottom.js
// ─────────────────────────────────────────────────────────────────────────────

function CRM({sess,onLogout,dm,setDm,users,setUsers,settings,setSettings}){
  const isAdmin=sess.role==="admin";
  const isFactory=sess.role==="factory";
  const userPerms=sess.permissions||ROLE_DEF[sess.role]||ROLE_DEF.agent;
  const t=T(dm);

  // Fine-grained permission helper — use this everywhere instead of isAdmin/isAgent/isFactory checks
  const can = (key) => hasPerm(sess, key);

  // Backward-compat derived flags (now driven by finePerms)
  const canSeePrices    = isAdmin || can("cust_seePrices")  || can("deliv_seePrices");
  const canSeeFinancials= isAdmin || can("cust_seeFinance");

  const [customers, setCust] =useStore("tas9_cust", D_CUST);
  const [deliveries,setDeliv]=useStore("tas9_deliv",D_DELIV);
  const [supplies,  setSup]  =useStore("tas9_sup",  D_SUP);
  const [expenses,  setExp]  =useStore("tas9_exp",  D_EXP);
  const [products,  setProd] =useStore("tas9_prod", D_PRODS);
  const [actLog,    setAct]  =useStore("tas9_act",  []);
  const [wastage,   setWaste] =useStore("tas9_waste", D_WASTE);
  const [prodTargets, setProdTargets]=useStore("tas9_prodtargets", D_PROD_TARGETS);
  // Agent live locations — kept in memory only, NOT stored in Firebase/cloud
  // Uses Ably free-tier WebSockets for cross-device real-time relay
  const [notifs, setNotifs]=useStore("tas9_notifs",[]);
  // eslint-disable-next-line no-unused-vars
  const [qcLogs,    setQcLogs]   = useStore("tas9_qclogs", []);
  const [handovers, setHandovers]= useStore("tas9_handovers", []);
  const [notices,   setNotices]  = useStore("tas9_notices", []);
  const [briefingDismissed, setBriefingDismissed] = useState(() => ls("tas_briefing_dismissed",""));
  const [briefingPinned, setBriefingPinned] = useState(() => ls("tas_briefing_pinned", true));
  const [notifOpen, setNotifOpen]=useState(false);
  const unreadNotifs=notifs.filter(n=>!n.read).length;
  function addNotif(title,body,type="info",notifType="newentry"){
    const n={id:uid(),title,body,type,ts:ts(),read:false};
    setNotifs(p=>[n,...p.slice(0,49)]);
    const targets=(settings?.notifTargets||{})[notifType]||["admin"];
    if(targets.includes(sess.role)) sendBrowserNotif(title,body);
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

  // ── GPS LOCATION LOGS — Firebase-stored breadcrumb trail ──────
  // Instead of live broadcasting, we capture a one-shot GPS snapshot
  // each time an agent performs a key delivery action. This tells you
  // exactly WHERE they were when they saved/dispatched/delivered — so
  // you can verify they were actually at the customer's location.
  //
  // Triggers: session start · save delivery edit · mark In Transit · mark Delivered
  // Storage: tas9_gpslogs in Firebase (tiny — one doc per action, ~200 bytes each)
  // Each log: { id, agentId, agentName, action, customer, lat, lng, acc, ts, tsDisplay }
  const [gpsLogs, setGpsLogs] = useStore("tas9_gpslogs", []);
  const [gpsFilter, setGpsFilter] = useState("all"); // "all" | agentId
  const [gpsActionFilter, setGpsActionFilter] = useState("all");
  const [gpsDateFilter, setGpsDateFilter] = useState("all"); // "all"|"today"|"yesterday"|"week"|"month"
  const [gpsSubSection, setGpsSubSection] = useState("overview"); // "overview"|"map"|"timeline"|"report"

  // Silent one-shot location capture — called on delivery actions
  // action = "session_start" | "delivery_saved" | "marked_transit" | "marked_delivered"
  // customer = customer name string (or "" for session start)
  function captureGPS(action, customer=""){
    if(!navigator.geolocation) return;
    if(sess.role!=="agent") return; // delivery agents only — admins/factory never tracked
    if(!can("gps_track")) return;
    let bestPos=null; let attempts=0; let committed=false;
    function commit(pos){
      if(committed) return;
      committed=true;
      const log={
        id:uid(), agentId:sess.id, agentName:sess.name, agentRole:sess.role, action, customer,
        lat:pos.coords.latitude, lng:pos.coords.longitude,
        acc:Math.round(pos.coords.accuracy),
        speed:pos.coords.speed!=null?Math.round(pos.coords.speed*3.6):null,
        heading:pos.coords.heading!=null?Math.round(pos.coords.heading):null,
        ts:Date.now(),
        tsDisplay:new Date().toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}),
      };
      setGpsLogs(prev=>[log,...(prev||[]).slice(0,499)]);
    }
    function tryFix(){
      navigator.geolocation.getCurrentPosition(
        pos=>{
          if(committed) return;
          attempts++;
          if(!bestPos||pos.coords.accuracy<bestPos.coords.accuracy) bestPos=pos;
          if(attempts<3&&pos.coords.accuracy>20) setTimeout(tryFix,2000);
          else commit(bestPos);
        },
        ()=>{ if(bestPos) commit(bestPos); },
        {enableHighAccuracy:true,timeout:10000,maximumAge:0}
      );
    }
    tryFix();
  }

  // Capture session-start location once when agent logs in
  const sessionGpsCaptured = useRef(false);
  useEffect(()=>{
    if(!sessionGpsCaptured.current && sess?.id && navigator.geolocation){
      const doCapture=()=>{ sessionGpsCaptured.current=true; captureGPS("session_start",""); };
      if(navigator.permissions){
        navigator.permissions.query({name:"geolocation"}).then(result=>{
          if(result.state!=="denied") doCapture();
        }).catch(doCapture);
      } else {
        doCapture();
      }
    }
  },[sess?.id]);// eslint-disable-line

  // Offline indicator state
  const [isOffline,setIsOffline]=useState(false);

  // Sync offline flag from Firebase errors
  useEffect(()=>{
    const interval=setInterval(()=>{if(window.__fbOffline){setIsOffline(true);window.__fbOffline=false;}},3000);
    return()=>clearInterval(interval);
  },[]);
  const activeC=customers.filter(c=>c.active);
  const totalRev=customers.reduce((a,c)=>a+(c.paid||0),0);
  const totalDue=customers.reduce((a,c)=>a+(c.pending||0),0);
  const totalExpOp=expenses.reduce((a,e)=>a+(e.amount||0),0);
  const totalSupC=supplies.reduce((a,s)=>a+(s.cost||0),0);
  const netProfit=totalRev-totalExpOp-totalSupC;
  const pendingD=deliveries.filter(d=>d.status==="Pending");

  // ── PUSH PERMISSION ──────────────────────────────────────────
  useEffect(() => { requestPushPermission(); }, []);

  // ── LOW STOCK ALERTS ─────────────────────────────────────────
  const lowStockThreshold = settings?.lowStockThreshold ?? 5;
  const lowStockItems = supplies.filter(s => (s.qty || 0) <= lowStockThreshold && s.item);
  const lowStockNotifiedRef = useRef({});
  useEffect(() => {
    lowStockItems.forEach(s => {
      if (!lowStockNotifiedRef.current[s.id]) {
        lowStockNotifiedRef.current[s.id] = true;
        addNotif(`⚠️ Low Stock: ${s.item}`, `Only ${s.qty} ${s.unit} remaining`, "warning", "lowstock");
      }
    });
  }, [lowStockItems.map(s=>s.id).join(",")]); // eslint-disable-line

  // ── CHURN ALERTS ─────────────────────────────────────────────
  const churnDays = settings?.churnDays ?? 14;
  const churnedCustomers = useMemo(() => {
    const now = new Date();
    return customers.filter(c => {
      if (!c.active) return false;
      const custDelivs = deliveries.filter(d => d.customerId === c.id);
      if (custDelivs.length === 0) return c.joinDate && (now - new Date(c.joinDate)) > churnDays * 86400000;
      const lastDate = [...custDelivs].sort((a,b) => b.date.localeCompare(a.date))[0]?.date;
      return lastDate && (now - new Date(lastDate)) > churnDays * 86400000;
    });
  }, [customers, deliveries, churnDays]);

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
  const blkS=()=>({item:"",qty:"",unit:"kg",date:today(),supplier:"",cost:"",notes:"",minStock:""});
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
  const [nbSh,setNbSh]=useState(false);
  const [nbF,setNbF]=useState({title:"",body:"",pinned:false});
  const [hvSh,setHvSh]=useState(false);
  const [hvF,setHvF]=useState({shift:"Morning",date:today(),note:"",nextShift:"",issues:"",loggedBy:""});
  const [bulkSelect,setBulkSelect]=useState(false);
  const [bulkSelected,setBulkSelected]=useState(new Set());
  const [auditUserFilter,setAuditUserFilter]=useState("all");
  const [auditRoleFilter,setAuditRoleFilter]=useState("all");
  const [auditActionFilter,setAuditActionFilter]=useState("");
  const [qcSh,setQcSh]=useState(null);
  const [qcF,setQcF]=useState({product:"",shift:"Morning",date:today(),grade:"A",notes:"",checker:""});
  const [showMoreNav,setShowMoreNav]=useState(false);
  const [changePwSh,setChangePwSh]=useState(false);
  const [changePwF,setChangePwF]=useState({current:"",next:"",confirm:""});
  const [settingsSection,setSettingsSection]=useState("account");
  const [lastBackupDate,setLastBackupDate]=useState(()=>ls("tas_last_backup",""));
  // Admin Tools modals
  const [adminToolSheet,setAdminToolSheet]=useState(null); // null | tool key string
  const [adminToolData,setAdminToolData]=useState(null);   // computed result data for open tool
  // Reschedule
  const [rescheduleDate,setRescheduleDate]=useState("");
  // Bulk agent reassign
  const [bulkAgentFrom,setBulkAgentFrom]=useState("");
  const [bulkAgentTo,setBulkAgentTo]=useState("");
  const [bulkAgentDateFrom,setBulkAgentDateFrom]=useState(today());
  const [bulkAgentDateTo,setBulkAgentDateTo]=useState(today());
  // Overdue filter
  const [overdueDays,setOverdueDays]=useState("7");
  // Inactive filter
  const [inactiveDays,setInactiveDays]=useState("30");
  // Product sales date range
  const [salesFrom,setSalesFrom]=useState("");
  const [salesTo,setSalesTo]=useState("");
  // Bulk delete cutoff
  const [bulkDelMonths,setBulkDelMonths]=useState("3");
  // Reset password
  const [resetPwUser,setResetPwUser]=useState("");
  const [resetPwVal,setResetPwVal]=useState("");

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
    if(dSh==="add"){setDeliv(p=>[...p,{...dF,id:uid()}]);addLog("Added delivery",dF.customer);notify("Delivery added ✓");addNotif("Delivery Added",`New delivery for ${dF.customer}`,"success");captureGPS("delivery_saved",dF.customer);}
    else{setDeliv(p=>p.map(d=>d.id===dSh.id?{...dF,id:d.id}:d));addLog("Edited delivery",dF.customer);notify("Updated ✓");captureGPS("delivery_saved",dF.customer);}
    setDsh(null);
  }
  function tglD(d){const ns=d.status==="Pending"?"Delivered":"Pending";setDeliv(p=>p.map(x=>x.id===d.id?{...x,status:ns}:x));addLog("Status changed",`${d.customer} → ${ns}`);notify("Updated");if(ns==="Delivered"){addNotif("Delivery Completed",`${d.customer} marked as Delivered`,"success");captureGPS("marked_delivered",d.customer);}}
  function delD(d){ask(`Delete delivery for "${d.customer}"?`,()=>{setDeliv(p=>p.filter(x=>x.id!==d.id));addLog("Deleted delivery",d.customer);notify("Deleted");});}

  // SUPPLIES
  function saveS(){
    if(!sF.item.trim()){notify("Item required");return;}
    const rec={...sF,qty:+sF.qty||0,cost:+sF.cost||0,minStock:sF.minStock?+sF.minStock:""};
    if(sSh==="add"){setSup(p=>[...p,{...rec,id:uid()}]);addLog("Added supply",sF.item);notify("Supply logged ✓");captureGPS("supply_logged",sF.item);}
    else{setSup(p=>p.map(s=>s.id===sSh.id?{...rec,id:s.id}:s));addLog("Edited supply",sF.item);notify("Updated ✓");captureGPS("supply_logged",sF.item);}
    // Low stock push notification on save
    const threshold=+sF.minStock;
    if(threshold>0&&(+sF.qty||0)<=threshold){
      sendBrowserNotif(`⚠️ Low Stock: ${sF.item}`,`Only ${sF.qty} ${sF.unit} left — below threshold of ${threshold}`);
      addNotif(`⚠️ Low Stock: ${sF.item}`,`Only ${sF.qty} ${sF.unit} remaining`,"warning","lowstock");
    }
    setSsh(null);
  }
  function delS(s){ask(`Delete supply "${s.item}"?`,()=>{setSup(p=>p.filter(x=>x.id!==s.id));addLog("Deleted supply",s.item);notify("Deleted");});}

  // EXPENSES
  function saveE(){if(!eF.amount){notify("Amount required");return;}
    if(eSh==="add"){setExp(p=>[...p,{...eF,id:uid(),amount:+eF.amount}]);addLog("Added expense",`${eF.category} ${inr(eF.amount)}`);notify("Expense logged ✓");captureGPS("expense_logged",eF.category);}
    else{setExp(p=>p.map(x=>x.id===eSh.id?{...eF,id:x.id,amount:+eF.amount}:x));addLog("Edited expense",`${eF.category} ${inr(eF.amount)}`);notify("Updated ✓");captureGPS("expense_logged",eF.category);}
    setEsh(null);}
  function delE(e){ask(`Delete "${e.category} ${inr(e.amount)}"?`,()=>{setExp(p=>p.filter(x=>x.id!==e.id));addLog("Deleted expense",`${e.category} ${inr(e.amount)}`);notify("Deleted");});}

  // WASTAGE
  function saveW(){
    if(!wF.product.trim()||!wF.qty){notify("Product and quantity required");return;}
    const rec={...wF,qty:+wF.qty||0,cost:+wF.cost||0,loggedBy:sess.name};
    if(wSh==="add"){setWaste(p=>[{...rec,id:uid(),createdAt:ts()},...p]);addLog("Logged wastage",`${rec.qty} ${rec.unit} ${rec.product} — ${rec.type}`);notify("Wastage logged ✓");captureGPS("wastage_logged",rec.product);}
    else{setWaste(p=>p.map(x=>x.id===wSh.id?{...rec,id:x.id,createdAt:x.createdAt}:x));addLog("Edited wastage",`${rec.product} ${rec.qty} ${rec.unit}`);notify("Updated ✓");captureGPS("wastage_logged",rec.product);}
    setWSh(null);
  }
  function delW(w){ask(`Delete wastage record for "${w.product}"?`,()=>{setWaste(p=>p.filter(x=>x.id!==w.id));addLog("Deleted wastage",`${w.product} ${w.qty} ${w.unit}`);notify("Deleted");});}

  // QC LOGS
  function saveQC(){
    if(!qcF.product.trim()){notify("Product required");return;}
    const rec={...qcF,id:uid(),loggedBy:displayName,createdAt:ts()};
    setQcLogs(p=>[rec,...p]);
    addLog("QC check logged",`${rec.product} — Grade ${rec.grade}`);
    captureGPS("qc_logged",rec.product);
    notify("QC log saved ✓");
    setQcSh(null);
  }
  function delQC(q){ask(`Delete QC record for "${q.product}"?`,()=>{setQcLogs(p=>p.filter(x=>x.id!==q.id));addLog("Deleted QC log",q.product);notify("Deleted");});}
  function savePT(){
    if(!ptF.product.trim()){notify("Product required");return;}
    const rec={...ptF,target:+ptF.target||0,actual:+ptF.actual||0};
    if(ptSh==="add"){setProdTargets(p=>[{...rec,id:uid(),createdAt:ts()},...p]);addLog("Production target set",`${rec.product} — ${rec.shift} ${rec.date}`);notify("Target saved ✓");captureGPS("production_logged",rec.product);}
    else{setProdTargets(p=>p.map(x=>x.id===ptSh.id?{...rec,id:x.id,createdAt:x.createdAt}:x));addLog("Production target updated",`${rec.product}`);notify("Updated ✓");captureGPS("production_logged",rec.product);}
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
    const pin=uF.pin&&uF.pin.length===4?uF.pin:(isEdit?orig.pin||"":"");
    const perms=uF.role==="admin"?ROLE_DEF.admin:(uF.permissions||ROLE_DEF[uF.role]||ROLE_DEF.agent);
    const finePerms=uF.role==="admin"?defaultFinePerms("admin"):(uF.finePerms||defaultFinePerms(uF.role));
    const rec={...uF,password:pw,pin,permissions:perms,finePerms};
    if(uSh==="add"){if(users.find(x=>x.username===rec.username)){notify("Username exists");return;}setUsers(p=>[...p,{...rec,id:uid(),createdAt:today()}]);addLog("Created user",`@${rec.username} (${rec.role})`);notify("User created ✓");}
    else{setUsers(p=>p.map(x=>x.id===uSh.id?{...rec,id:x.id}:x));addLog("Edited user",`@${rec.username}`);notify("Updated ✓");}
    setUsh(null);
  }
  function delU(u){if(u.id===sess.id){notify("Cannot delete your own account");return;}if(u.role==="admin"&&users.filter(x=>x.role==="admin"&&x.active).length<=1){notify("Cannot remove last admin");return;}ask(`Delete user "@${u.username}"?`,()=>{setUsers(p=>p.filter(x=>x.id!==u.id));addLog("Deleted user",`@${u.username}`);notify("Deleted");});}

  // EXPORT/IMPORT
  function exportAll(){const d={customers,deliveries,supplies,expenses,products,users,actLog,wastage,at:new Date().toISOString()};const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:"application/json"}));a.download=`tas_backup_${today()}.json`;a.click();URL.revokeObjectURL(a.href);addLog("Exported backup","Full JSON");notify("Exported ✓");setLastBackupDate(today());lsw("tas_last_backup",today());}
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

  // Tab icons for nav
  const TAB_ICONS={"Dashboard":"📊","Customers":"👥","Deliveries":"🚚","Supplies":"📦","Expenses":"💸","Wastage":"🗑️","P&L":"📈","Analytics":"🔍","Production":"🏭","QC":"✅","GPS":"📍","Settings":"⚙️"};

  // ═══════════════════════════════════════════════════════════════
  return (
    <>
    <div style={{background:t.bg,minHeight:"100svh",fontFamily:"'Helvetica Neue',Helvetica,Arial,sans-serif"}} className="flex flex-col lg:flex-row">

      {/* ── DESKTOP SIDEBAR (lg+) ─────────────────────────────── */}
      <aside style={{background:t.sidebar,borderRight:`1px solid ${t.sidebarBorder}`,width:224,minHeight:"100vh"}} className="hidden lg:flex flex-col shrink-0 sticky top-0 h-screen overflow-y-auto">
        {/* Logo */}
        <div style={{borderBottom:`1px solid ${t.sidebarBorder}`,padding:"16px 16px"}} className="flex items-center gap-3">
          <div style={{background:"rgba(59,130,246,0.12)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:6,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,userSelect:"none",flexShrink:0}}>{settings?.appEmoji||"🫓"}</div>
          <div className="min-w-0">
            <p style={{color:t.sidebarText,fontWeight:700,fontSize:13,letterSpacing:"-0.01em",lineHeight:1.2}} className="truncate">{settings?.appName||"TAS Healthy World"}</p>
            <p style={{color:t.sidebarSub,fontSize:10,letterSpacing:"0.02em"}} className="truncate mt-0.5">{settings?.appSubtitle||""}</p>
          </div>
        </div>
        {/* Nav items */}
        <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5">
          {TABS.map(tb=>(
            <button key={tb} onClick={()=>{setTab(tb);setSrch("");}}
              style={tab===tb
                ?{background:t.sidebarActiveBg,color:t.sidebarActive,borderLeft:`2px solid ${t.sidebarActive}`,paddingLeft:14,borderRadius:"0 4px 4px 0"}
                :{color:"rgba(232,237,245,0.65)",borderLeft:"2px solid transparent",paddingLeft:14,borderRadius:"0 4px 4px 0"}}
              className="flex items-center gap-2.5 py-2 text-left w-full transition-all rounded-r text-sm">
              <span style={{fontSize:13,width:18,textAlign:"center",flexShrink:0,lineHeight:1}}>{TAB_ICONS[tb]||"•"}</span>
              <span style={{fontSize:12,fontWeight:tab===tb?600:500,letterSpacing:"0.005em"}} className="truncate">{tb}</span>
              {tb==="Dashboard"&&pendingD.length>0&&tab!=="Dashboard"&&<span style={{marginLeft:"auto",fontSize:9,fontWeight:700,background:"#3b82f6",color:"#fff",borderRadius:99,width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{pendingD.length}</span>}
            </button>
          ))}
        </nav>
        {/* Sidebar footer */}
        <div style={{borderTop:`1px solid ${t.sidebarBorder}`,padding:"12px 12px"}} className="flex flex-col gap-2.5">
          {/* Staff picker dropdown in sidebar */}
          {subStaff.length>0&&(
            <select value={activeStaff} onChange={e=>setActiveStaff(e.target.value)}
              style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${t.sidebarBorder}`,color:t.sidebarText,fontSize:11,width:"100%",borderRadius:4,padding:"6px 8px",outline:"none",WebkitAppearance:"none",appearance:"none"}}>
              {subStaff.map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          )}
          <div style={{background:"rgba(255,255,255,0.03)",borderRadius:4,padding:"8px 10px",border:`1px solid ${t.sidebarBorder}`}} className="flex items-center gap-2">
            <div style={{background:"rgba(59,130,246,0.15)",border:"1px solid rgba(59,130,246,0.25)",color:"#60a5fa"}} className="w-7 h-7 rounded flex items-center justify-center font-bold text-xs shrink-0">{displayName[0]?.toUpperCase()}</div>
            <div className="flex-1 min-w-0">
              <p style={{color:t.sidebarText,fontSize:11,fontWeight:600,letterSpacing:"0.005em"}} className="truncate">{displayName}</p>
              <p style={{color:t.sidebarSub,fontSize:10,textTransform:"capitalize"}} className="truncate">{sess.role}</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button onClick={()=>setDm(d=>!d)} style={{background:"rgba(255,255,255,0.06)",color:"rgba(232,237,245,0.7)",border:`1px solid ${t.sidebarBorder}`,flex:1,borderRadius:4,padding:"5px 8px",fontSize:10,fontWeight:600,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>{dm?"☀ Light":"⬡ Dark"}</button>
            <button onClick={onLogout} style={{background:"rgba(255,255,255,0.06)",color:"rgba(232,237,245,0.7)",border:`1px solid ${t.sidebarBorder}`,flex:1,borderRadius:4,padding:"5px 8px",fontSize:10,fontWeight:600,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>Sign Out</button>
          </div>
          <div className="flex items-center gap-1.5 px-0.5">
            <div style={{width:5,height:5,borderRadius:"50%",background:lastSync?"#10b981":"#3b82f6",flexShrink:0}}/>
            <p style={{color:"rgba(232,237,245,0.45)",fontSize:9,letterSpacing:"0.02em"}}>{lastSync?`Synced ${lastSync.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}`:"Connecting…"}</p>
          </div>
        </div>
      </aside>

      {/* ── MOBILE / TABLET MAIN AREA ─────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 lg:pb-0" style={{paddingBottom:"calc(4.5rem + env(safe-area-inset-bottom))"}}>

      {/* HEADER — shown on mobile/tablet only (hidden on lg desktop where sidebar takes over) */}
      <header style={{background:t.card,borderBottom:`1px solid ${t.border}`,boxShadow:"0 1px 8px rgba(0,0,0,0.06)"}} className="sticky top-0 z-30">
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
          {/* Tablet: show current tab name in header */}
          <div className="hidden sm:flex lg:hidden items-center gap-2">
            <span className="text-xl">{TAB_ICONS[tab]||"•"}</span>
            <h1 style={{color:t.text}} className="font-black text-lg tracking-tight">{tab}</h1>
          </div>
          {/* Desktop header shows page title */}
          <div className="hidden lg:flex items-center gap-2.5">
            <span className="text-xl">{TAB_ICONS[tab]||"•"}</span>
            <h1 style={{color:t.text}} className="font-black text-xl tracking-tight">{tab}</h1>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {/* BELL */}
            <div className="relative">
              <button onClick={()=>{setNotifOpen(o=>!o);if(unreadNotifs>0)markAllRead();}} style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`}} className="w-9 h-9 rounded-xl flex items-center justify-center text-[15px] select-none relative transition-colors hover:opacity-80">
                🔔
                {unreadNotifs>0&&<span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2" style={{borderColor:t.card}}>{unreadNotifs>9?"9+":unreadNotifs}</span>}
              </button>
              {notifOpen&&<div style={{background:t.card,border:`1px solid ${t.border}`,zIndex:200,boxShadow:"0 20px 40px rgba(0,0,0,0.2)"}} className="absolute right-0 top-11 w-72 sm:w-80 rounded-2xl overflow-hidden">
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
      </header>

      {/* Offline banner */}
      {isOffline&&(
        <div className="max-w-2xl sm:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 lg:px-6 pt-3">
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-base">📡</span>
              <div>
                <p className="text-xs font-semibold text-red-400">You're offline — changes are saved locally</p>
                <p className="text-[11px] text-red-400/70">Data will sync automatically when connection is restored</p>
              </div>
            </div>
            <button onClick={()=>setIsOffline(false)} className="text-xs text-red-400/60 hover:text-red-400 shrink-0">✕</button>
          </div>
        </div>
      )}

      <div className="w-full max-w-2xl sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 lg:px-6 py-4 flex flex-col gap-3">

        {/* DASHBOARD */}
        {tab==="Dashboard"&&(<>
          {/* WEATHER WIDGET */}
          {widgets.includes("weather")&&<WeatherWidget dm={dm} settings={settings}/>}

          {/* QUICK ACTIONS */}
          {widgets.includes("quickActions")&&(()=>{
            const ALL_QA=[
              {key:"newDelivery",  icon:"🚚",label:"New Delivery",   color:"#0ea5e9", action:()=>{setDf(blkD());setDsh("add");setTab("Deliveries");}},
              {key:"newCustomer",  icon:"👤",label:"New Customer",   color:"#d97706", action:()=>{setCf(blkC());setCsh("add");setTab("Customers");}},
              {key:"markDone",     icon:"✅",label:"Mark Delivered", color:"#10b981", action:()=>{setTab("Deliveries");}},
              {key:"logWastage",   icon:"🗑️",label:"Log Wastage",    color:"#f97316", action:()=>{setWF(blkW());setWSh("add");setTab("Wastage");}},
              {key:"addExpense",   icon:"💸",label:"Add Expense",    color:"#ef4444", action:()=>{setEf(blkE());setEsh("add");setTab("Expenses");}},
              {key:"logSupply",    icon:"📦",label:"Log Supply",     color:"#8b5cf6", action:()=>{setSf(blkS());setSsh("add");setTab("Supplies");}},
              {key:"logProduction",icon:"🏭",label:"Log Production", color:"#6366f1", action:()=>{setPtF({date:today(),shift:(settings?.shifts||["Morning"])[0],product:products[0]?.name||"",target:0,actual:0,notes:""});setPtSh("add");setTab("Production");}},
              {key:"qcCheck",      icon:"✅",label:"QC Check",       color:"#14b8a6", action:()=>{setQcF({product:"",shift:"Morning",date:today(),grade:"A",notes:"",checker:displayName});setQcSh("add");setTab("QC");}},
            ];
            const activeKeys=settings?.quickActions||["newDelivery","markDone","logWastage","addExpense"];
            const visibleQA=ALL_QA.filter(q=>activeKeys.includes(q.key));
            if(visibleQA.length===0)return null;
            return <div>
              <p style={{color:t.sub}} className="text-[10px] font-bold uppercase tracking-widest mb-2">⚡ Quick Actions</p>
              <div className="grid grid-cols-4 gap-2">
                {visibleQA.map(q=>(
                  <button key={q.key} onClick={q.action}
                    style={{background:q.color+"15",border:`1.5px solid ${q.color}30`,borderRadius:16,padding:"12px 6px",display:"flex",flexDirection:"column",alignItems:"center",gap:6,transition:"all 0.15s",cursor:"pointer"}}
                    onMouseEnter={e=>{e.currentTarget.style.background=q.color+"25";e.currentTarget.style.transform="translateY(-2px)";}}
                    onMouseLeave={e=>{e.currentTarget.style.background=q.color+"15";e.currentTarget.style.transform="";}}>
                    <span style={{fontSize:22,lineHeight:1}}>{q.icon}</span>
                    <p style={{color:q.color,fontSize:10,fontWeight:700,lineHeight:1.2,textAlign:"center"}}>{q.label}</p>
                  </button>
                ))}
              </div>
            </div>;
          })()}

          {/* DAILY PRODUCTION PROGRESS BAR */}
          {widgets.includes("productionBar")&&(()=>{
            const todayPT=prodTargets.filter(x=>x.date===today());
            if(todayPT.length===0)return null;
            const totalTarget=todayPT.reduce((s,x)=>s+x.target,0);
            const totalActual=todayPT.reduce((s,x)=>s+x.actual,0);
            const pct=totalTarget>0?Math.min(Math.round(totalActual/totalTarget*100),100):0;
            const pctColor=pct>=100?"#10b981":pct>=75?"#f59e0b":"#ef4444";
            return <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"14px 16px"}}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[10px] font-bold text-purple-500 uppercase tracking-widest">🏭 Today's Production</p>
                  <p style={{color:t.text}} className="font-bold text-sm mt-0.5">{totalActual} <span style={{color:t.sub}} className="font-normal text-xs">/ {totalTarget} units target</span></p>
                </div>
                <p style={{color:pctColor}} className="font-black text-2xl">{pct}%</p>
              </div>
              <div style={{background:t.border,height:8,borderRadius:8,overflow:"hidden"}}>
                <div style={{width:`${pct}%`,background:pct>=100?"linear-gradient(90deg,#10b981,#059669)":pct>=75?"linear-gradient(90deg,#f59e0b,#d97706)":"linear-gradient(90deg,#ef4444,#dc2626)",height:"100%",borderRadius:8,transition:"width 1s ease"}}/>
              </div>
              <div className="flex gap-3 mt-2">
                {todayPT.slice(0,3).map(r=>{
                  const rPct=r.target>0?Math.min(Math.round(r.actual/r.target*100),100):0;
                  return <div key={r.id} className="flex-1 min-w-0">
                    <p style={{color:t.sub}} className="text-[10px] truncate">{r.product} · {r.shift}</p>
                    <p style={{color:rPct>=100?"#10b981":rPct>=75?"#f59e0b":"#ef4444"}} className="text-[11px] font-bold">{r.actual}/{r.target}</p>
                  </div>;
                })}
                {todayPT.length>3&&<div className="flex-1 min-w-0 flex items-end"><p style={{color:t.sub}} className="text-[10px]">+{todayPT.length-3} more</p></div>}
              </div>
            </div>;
          })()}
          {can("dash_seeBriefing")&&(briefingPinned||briefingDismissed!==today())&&<MorningBriefing
            dm={dm}
            pinned={briefingPinned}
            onDismiss={()=>{setBriefingDismissed(today());lsw("tas_briefing_dismissed",today());}}
            onUnpin={()=>{const v=!briefingPinned;setBriefingPinned(v);lsw("tas_briefing_pinned",v);}}
            data={{
              pendingCount:pendingD.length,
              todayRev:deliveries.filter(d=>d.date===today()&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0),
              lowStockCount:lowStockItems.length,
              overdueCount:deliveries.filter(d=>d.status==="Pending"&&d.date<today()).length,
              churnCount:churnedCustomers.length,
              churnDays,
              noticeCount:(notices||[]).filter(n=>!(n.readBy||[]).includes(sess.id)).length,
            }}
          />}
          {/* LOW STOCK ALERT CARD */}
          {lowStockItems.filter(s=>s.minStock).length>0&&(isAdmin||isFactory)&&(
            <div style={{background:dm?"#1a0e0e":"#fff7f7",border:"1.5px solid #ef444430",borderRadius:20,padding:"14px 18px"}}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p style={{color:"#ef4444"}} className="text-[10px] font-bold uppercase tracking-widest mb-0.5">⚠️ Low Stock Alert</p>
                  <p style={{color:t.text}} className="font-bold text-sm">{lowStockItems.filter(s=>s.minStock).length} item{lowStockItems.filter(s=>s.minStock).length!==1?"s":""} need restocking</p>
                </div>
                <Btn dm={dm} size="sm" v="ghost" onClick={()=>setTab("Supplies")}>View →</Btn>
              </div>
              {lowStockItems.filter(s=>s.minStock).map(s=>(
                <div key={s.id} className="flex items-center justify-between py-2" style={{borderTop:`1px solid ${t.border}`}}>
                  <div>
                    <p style={{color:t.text}} className="text-sm font-semibold">{s.item}</p>
                    {s.supplier&&<p style={{color:t.sub}} className="text-[11px]">{s.supplier}</p>}
                  </div>
                  <div className="text-right">
                    <p style={{color:"#ef4444"}} className="font-bold text-sm">{s.qty} {s.unit}</p>
                    <p style={{color:t.sub}} className="text-[10px]">min: {s.minStock} {s.unit}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* WHO'S ACTIVE RIGHT NOW — admin only */}
          {isAdmin&&(()=>{
            const now=Date.now();
            const TWO_HOURS=2*60*60*1000;
            const agentUsers2=users.filter(u=>u.role==="agent"&&u.active);
            if(agentUsers2.length===0) return null;
            const agentPulse=agentUsers2.map(u=>{
              const lastPing=(gpsLogs||[]).filter(l=>l.agentId===u.id).sort((a,b)=>b.ts-a.ts)[0];
              const isActive=lastPing&&(now-lastPing.ts)<TWO_HOURS;
              const minsAgo=lastPing?Math.max(0,Math.round((now-lastPing.ts)/60000)):null;
              return {u,isActive,minsAgo,lastPing};
            });
            const activeCount=agentPulse.filter(x=>x.isActive).length;
            return <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"12px 16px"}}>
              <div className="flex items-center justify-between mb-2">
                <p style={{color:t.sub}} className="text-[10px] font-bold uppercase tracking-widest">👥 Agents Live Now</p>
                <span style={{background:activeCount>0?"#10b98120":"#6b728020",color:activeCount>0?"#10b981":"#6b7280",borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700}}>{activeCount}/{agentPulse.length} active</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {agentPulse.map(({u,isActive,minsAgo,lastPing})=>{
                  const initials=u.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
                  return <div key={u.id} className="flex items-center gap-2 py-1.5 px-2.5 rounded-xl" style={{background:isActive?"#10b98110":"#6b728010",border:`1px solid ${isActive?"#10b98130":"#6b728020"}`}}>
                    <div className="relative shrink-0">
                      <div style={{width:28,height:28,borderRadius:"50%",background:isActive?"#10b98125":"#6b728025",color:isActive?"#10b981":"#6b7280",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800}}>{initials}</div>
                      <div style={{position:"absolute",bottom:0,right:0,width:8,height:8,borderRadius:"50%",background:isActive?"#10b981":"#9ca3af",border:"1.5px solid "+t.card,boxShadow:isActive?"0 0 0 2px #10b98140":"none"}}/>
                    </div>
                    <div>
                      <p style={{color:t.text,fontSize:11,fontWeight:700,lineHeight:1.2}}>{u.name.split(" ")[0]}</p>
                      <p style={{color:isActive?"#10b981":"#9ca3af",fontSize:9,fontWeight:600}}>{isActive?(minsAgo<2?"just now":minsAgo<60?`${minsAgo}m ago`:`${Math.round(minsAgo/60)}h ago`):"offline"}</p>
                    </div>
                    {isActive&&lastPing&&<button onClick={()=>setTab("GPS")} style={{background:"#0ea5e910",color:"#0ea5e9",border:"none",borderRadius:6,fontSize:9,fontWeight:700,padding:"2px 6px",cursor:"pointer"}}>📍</button>}
                  </div>;
                })}
              </div>
            </div>;
          })()}

          {/* TODAY SUMMARY HERO BANNER */}
          {(()=>{
            const todayStr=today();
            const todayD=deliveries.filter(d=>d.date===todayStr);
            const todayDel=todayD.filter(d=>d.status==="Delivered");
            const todayPend=todayD.filter(d=>d.status==="Pending");
            const todayRev=todayDel.reduce((s,d)=>s+lineTotal(d.orderLines),0);
            const todayRepl=todayD.filter(d=>d.replacement?.done).length;
            const delivRate=todayD.length>0?Math.round(todayDel.length/todayD.length*100):0;
            const isFullDelivery=todayD.length>0&&delivRate===100;
            return <div style={{background:isFullDelivery?(dm?"linear-gradient(135deg,#0d1f35,#0d1a2e)":"linear-gradient(135deg,#eff6ff,#e8f0fb)"):dm?"linear-gradient(135deg,#0f1923,#111820)":"linear-gradient(135deg,#f0f4f8,#eef2f8)",border:isFullDelivery?"2px solid #3b82f6":dm?"1px solid #1e3a5f":"1px solid #c7d7ee",borderRadius:8,padding:"18px 20px",transition:"all 0.5s ease",boxShadow:isFullDelivery?"0 0 0 3px rgba(59,130,246,0.2),0 4px 24px rgba(30,58,95,0.2)":"none",animation:isFullDelivery?"goldPulse 2s ease-in-out infinite":"none"}}>
              {isFullDelivery&&<p style={{color:"#f59e0b",fontSize:11,fontWeight:800,marginBottom:8,letterSpacing:"0.05em"}}>🏆 100% DELIVERED — PERFECT DAY!</p>}
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

          {/* END-OF-DAY DIGEST + WHATSAPP ORDER SUMMARY — admin only */}
          {isAdmin&&(()=>{
            const todayStr=today();
            const todayD2=deliveries.filter(d=>d.date===todayStr);
            const todayDel2=todayD2.filter(d=>d.status==="Delivered");
            const todayPend2=todayD2.filter(d=>d.status==="Pending");
            const todayRev2=todayDel2.reduce((s,d)=>s+lineTotal(d.orderLines),0);
            const todayWaste2=(wastage||[]).filter(w=>w.date===todayStr);
            const hour=new Date().getHours();
            const isEOD=hour>=18; // show from 6 PM

            const overdueD2=deliveries.filter(d=>d.status==="Pending"&&d.date<todayStr);

            function copyDigest(){
              const lines=[
                `📊 *${settings?.appName||"TAS"} — Daily Summary*`,
                `📅 ${new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}`,
                ``,
                `✅ Delivered: ${todayDel2.length}/${todayD2.length} orders`,
                todayPend2.length>0?`⏳ Pending: ${todayPend2.length} orders`:``,
                canSeeFinancials?`💰 Revenue collected: ${inr(todayRev2)}`:``,
                todayWaste2.length>0?`🗑️ Wastage entries: ${todayWaste2.length} (${todayWaste2.reduce((s,w)=>s+(w.qty||0),0)} units)`:``,
                overdueD2.length>0?`🔴 Still overdue: ${overdueD2.length} orders`:``,
                ``,
                `_Sent from ${settings?.appName||"TAS"} CRM_`,
              ].filter(l=>l!==``).join("\n");
              navigator.clipboard?.writeText(lines).then(()=>notify("Summary copied! Paste in WhatsApp ✓")).catch(()=>notify("Copy failed — try long-pressing the text"));
            }


            const agentUsers3=users.filter(u=>u.role==="agent"&&u.active);
            const pendingByAgent=agentUsers3.map(u=>({
              u,
              count:deliveries.filter(d=>d.status==="Pending"&&(d.agentId===u.id||d.agent===u.name)).length
            })).sort((a,b)=>b.count-a.count);

            function openTool(key){
              setAdminToolData(null);
              if(key==="overdueCustomers"){
                const days=Math.max(1,+overdueDays||7);
                const res=customers.filter(c=>c.pending>0).map(c=>{
                  const lastD=deliveries.filter(d=>d.customerId===c.id&&d.status==="Pending").sort((a,b)=>a.date>b.date?1:-1)[0];
                  return {...c,lastPendingDate:lastD?.date||"",daysOverdue:lastD?.date?Math.round((Date.now()-new Date(lastD.date).getTime())/86400000):null};
                }).filter(c=>c.daysOverdue===null||c.daysOverdue>=days).sort((a,b)=>(b.daysOverdue||0)-(a.daysOverdue||0));
                setAdminToolData(res);
              }
              if(key==="inactiveCustomers"){
                const days=Math.max(1,+inactiveDays||30);
                const res=customers.map(c=>{
                  const lastD=deliveries.filter(d=>d.customerId===c.id).sort((a,b)=>b.date>a.date?1:-1)[0];
                  return {...c,lastOrderDate:lastD?.date||"",daysSince:lastD?.date?Math.round((Date.now()-new Date(lastD.date).getTime())/86400000):null};
                }).filter(c=>!c.lastOrderDate||(c.daysSince!==null&&c.daysSince>=days)).sort((a,b)=>(b.daysSince||9999)-(a.daysSince||9999));
                setAdminToolData(res);
              }
              if(key==="duplicates"){
                const seen={};
                customers.forEach(c=>{
                  const k=c.name.trim().toLowerCase();
                  if(!seen[k]) seen[k]=[];
                  seen[k].push(c);
                });
                const res=Object.values(seen).filter(g=>g.length>1);
                setAdminToolData(res);
              }
              if(key==="productSales"){
                const from=salesFrom||deliveries.reduce((m,d)=>d.date<m?d.date:m,today());
                const to=salesTo||today();
                const filtered=deliveries.filter(d=>d.status==="Delivered"&&d.date>=from&&d.date<=to);
                const res=products.map(p=>{
                  const total=filtered.reduce((s,d)=>{const l=safeO(d.orderLines)[p.id];return s+(l?.qty||0);},0);
                  const revenue=filtered.reduce((s,d)=>{const l=safeO(d.orderLines)[p.id];return s+(l?.qty||0)*(l?.priceAmount||0);},0);
                  return {id:p.id,name:p.name,unit:p.unit,total,revenue};
                }).filter(r=>r.total>0).sort((a,b)=>b.revenue-a.revenue);
                setAdminToolData(res);
              }
              if(key==="wastageByProduct"){
                const wpMap={};
                (wastage||[]).forEach(w=>{
                  if(!wpMap[w.product]) wpMap[w.product]={name:w.product,qty:0,entries:0,cost:0};
                  wpMap[w.product].qty+=(w.qty||0);
                  wpMap[w.product].entries+=1;
                  wpMap[w.product].cost+=(w.costImpact||0);
                });
                const res=Object.values(wpMap).sort((a,b)=>b.qty-a.qty);
                setAdminToolData(res);
              }
              if(key==="weeklyDigest"){
                const days7=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return d.toISOString().slice(0,10);});
                const first=days7[0],last=days7[6];
                const wDel=deliveries.filter(d=>d.date>=first&&d.date<=last);
                const wDelivered=wDel.filter(d=>d.status==="Delivered");
                const wRev=wDelivered.reduce((s,d)=>s+lineTotal(d.orderLines),0);
                const wWaste=(wastage||[]).filter(w=>w.date>=first&&w.date<=last);
                const wExp=(expenses||[]).filter(e=>e.date>=first&&e.date<=last).reduce((s,e)=>s+(+e.amount||0),0);
                const lines=[
                  `📊 *${settings?.appName||"TAS"} — Weekly Summary*`,
                  `📅 ${first} → ${last}`,
                  ``,
                  `📦 Orders: ${wDel.length} | ✅ Delivered: ${wDelivered.length}`,
                  wRev>0?`💰 Revenue: ${inr(wRev)}`:``,
                  wExp>0?`💸 Expenses: ${inr(wExp)}`:``,
                  wRev>0&&wExp>0?`📈 Net: ${inr(wRev-wExp)}`:``,
                  wWaste.length>0?`🗑️ Wastage entries: ${wWaste.length}`:``,
                  ``,
                  `_${settings?.appName||"TAS"} CRM_`,
                ].filter(l=>l!==``).join("\n");
                setAdminToolData(lines);
              }
              if(key==="agentLeaderboard"){
                const now=new Date();
                const mStart=new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10);
                const mEnd=today();
                const res=agentUsers3.map(u=>{
                  const myD=deliveries.filter(d=>(d.agentId===u.id||d.agent===u.name)&&d.date>=mStart&&d.date<=mEnd);
                  const delivered=myD.filter(d=>d.status==="Delivered");
                  const pending=myD.filter(d=>d.status==="Pending").length;
                  const revenue=delivered.reduce((s,d)=>s+lineTotal(d.orderLines),0);
                  return {u,total:myD.length,delivered:delivered.length,pending,revenue,rate:myD.length>0?Math.round(delivered.length/myD.length*100):0};
                }).sort((a,b)=>b.delivered-a.delivered);
                setAdminToolData(res);
              }
              if(key==="orphanDeliveries"){
                const custIds=new Set(customers.map(c=>c.id));
                const res=deliveries.filter(d=>d.customerId&&!custIds.has(d.customerId));
                setAdminToolData(res);
              }
              if(key==="auditLogView"){
                setAdminToolData([...(actLog||[])].slice(0,200));
              }
              setAdminToolSheet(key);
            }

            function doReschedule(){
              if(!rescheduleDate){notify("Pick a date");return;}
              const pending=deliveries.filter(d=>d.date===todayStr&&d.status==="Pending");
              if(pending.length===0){notify("No pending orders today");return;}
              setDeliv(p=>p.map(d=>pending.find(x=>x.id===d.id)?{...d,date:rescheduleDate}:d));
              addLog("Rescheduled pending",`${pending.length} orders → ${rescheduleDate}`);
              notify(`${pending.length} orders moved to ${rescheduleDate} ✓`);
              setAdminToolSheet(null);
            }

            function doBulkAgentReassign(){
              if(!bulkAgentTo){notify("Select target agent");return;}
              const toUser=users.find(u=>u.id===bulkAgentTo);
              if(!toUser){notify("Agent not found");return;}
              let count=0;
              setDeliv(p=>p.map(d=>{
                if(d.date>=bulkAgentDateFrom&&d.date<=bulkAgentDateTo&&d.status==="Pending"&&(!bulkAgentFrom||d.agentId===bulkAgentFrom||d.agent===users.find(u=>u.id===bulkAgentFrom)?.name)){
                  count++;
                  return {...d,agentId:toUser.id,agent:toUser.name};
                }
                return d;
              }));
              addLog("Bulk agent reassign",`→ ${toUser.name} (${bulkAgentDateFrom} – ${bulkAgentDateTo})`);
              notify(`Reassigned ${count} deliveries to ${toUser.name} ✓`);
              setAdminToolSheet(null);
            }

            function doBulkDelete(){
              const months=Math.max(1,+bulkDelMonths||3);
              const cutoff=new Date(Date.now()-months*30*86400000).toISOString().slice(0,10);
              const toDelete=deliveries.filter(d=>d.status==="Delivered"&&d.date<cutoff);
              if(toDelete.length===0){notify("Nothing to delete");return;}
              ask(`Delete ${toDelete.length} delivered orders older than ${months} months?`,()=>{
                const ids=new Set(toDelete.map(d=>d.id));
                setDeliv(p=>p.filter(d=>!ids.has(d.id)));
                addLog("Bulk deleted old orders",`${toDelete.length} records before ${cutoff}`);
                notify(`${toDelete.length} old orders deleted ✓`);
                setAdminToolSheet(null);
              });
            }

            function doResetPassword(){
              if(!resetPwUser){notify("Select a user");return;}
              if(!resetPwVal||resetPwVal.length<6){notify("Password must be at least 6 characters");return;}
              setUsers(p=>p.map(u=>u.id===resetPwUser?{...u,password:hashPw(resetPwVal)}:u));
              addLog("Reset password",`User: ${users.find(u=>u.id===resetPwUser)?.username||"?"}`);
              notify("Password reset ✓");
              setResetPwVal("");
              setAdminToolSheet(null);
            }

            function doExportContacts(){
              exportCSV(customers,"customer_contacts",[
                {label:"Name",key:"name"},{label:"Phone",key:"phone"},{label:"Address",key:"address"},
                {label:"Active",val:r=>r.active?"Yes":"No"},{label:"Join Date",key:"joinDate"},
                {label:"Paid",key:"paid"},{label:"Pending",key:"pending"},{label:"Notes",key:"notes"},
              ]);
              addLog("Exported contacts",`${customers.length} customers`);
              notify("Contacts exported ✓");
            }

            function doPrintRunSheet(){
              const pendingToday=deliveries.filter(d=>d.date===todayStr&&d.status==="Pending");
              if(pendingToday.length===0){notify("No pending deliveries today");return;}
              const co=settings?.companyName||"TAS Healthy World";
              const rows=pendingToday.map((d,i)=>{
                const items=lineRows(d.orderLines||{},products).filter(r=>r.qty>0).map(r=>`${r.qty}× ${r.name}`).join(", ")||"—";
                const agent=d.agent||"Unassigned";
                return `<tr><td style="padding:8px 10px;border-bottom:1px solid #e5e5e5;font-weight:700">${i+1}</td><td style="padding:8px 10px;border-bottom:1px solid #e5e5e5;font-weight:700">${d.customer}</td><td style="padding:8px 10px;border-bottom:1px solid #e5e5e5">${d.address||"—"}</td><td style="padding:8px 10px;border-bottom:1px solid #e5e5e5">${items}</td><td style="padding:8px 10px;border-bottom:1px solid #e5e5e5">${agent}</td><td style="padding:8px 10px;border-bottom:1px solid #e5e5e5">☐</td></tr>`;
              }).join("");
              const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Run Sheet ${todayStr}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{font-size:18px;font-weight:900;color:#92400e}h2{font-size:12px;font-weight:700;color:#78716c;margin-top:4px;margin-bottom:20px}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#f5f5f4;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#a8a29e;border-bottom:2px solid #e5e5e5}.footer{margin-top:24px;text-align:center;font-size:10px;color:#a8a29e}@media print{@page{margin:1cm}body{padding:0}}</style></head><body><h1>🫓 ${co} — Delivery Run Sheet</h1><h2>${new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"})} · ${pendingToday.length} deliveries</h2><table><tr><th>#</th><th>Customer</th><th>Address</th><th>Items</th><th>Agent</th><th>Done ✓</th></tr>${rows}</table><div class="footer">Printed ${new Date().toLocaleString("en-IN")} · ${co}</div><script>window.addEventListener('load',function(){window.print();});</script></body></html>`;
              const blob=new Blob([html],{type:"text/html;charset=utf-8"});
              const url=URL.createObjectURL(blob);
              const a=document.createElement("a");a.href=url;a.target="_blank";a.rel="noopener";
              document.body.appendChild(a);a.click();
              setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},1000);
              addLog("Printed run sheet",`${todayStr} — ${pendingToday.length} stops`);
              notify("Run sheet opened in new tab ✓");
            }

            const toolGroups=[
              {label:"📦 Deliveries",tools:[
                {icon:"🔁",label:"Reschedule Pending",key:"reschedule",color:"#f59e0b"},
                {icon:"👤",label:"Bulk Reassign Agent",key:"bulkReassign",color:"#0ea5e9"},
                {icon:"🖨️",label:"Print Run Sheet",key:"printRunSheet",color:"#10b981"},
                {icon:"📊",label:isEOD?"Copy Day Summary":"Day Summary (after 6 PM)",key:isEOD?"daySummary":null,color:"#6366f1"},
              ]},
              {label:"👥 Customers",tools:[
                {icon:"🔴",label:"Overdue Customers",key:"overdueCustomers",color:"#ef4444"},
                {icon:"😴",label:"Inactive Customers",key:"inactiveCustomers",color:"#f97316"},
                {icon:"🪞",label:"Spot Duplicates",key:"duplicates",color:"#8b5cf6"},
                {icon:"📤",label:"Export Contacts",key:"exportContacts",color:"#10b981"},
              ]},
              {label:"📊 Reports",tools:[
                {icon:"📅",label:"Weekly Digest",key:"weeklyDigest",color:"#6366f1"},
                {icon:"🏆",label:"Agent Leaderboard",key:"agentLeaderboard",color:"#f59e0b"},
                {icon:"📦",label:"Product Sales",key:"productSales",color:"#0ea5e9"},
                {icon:"🗑️",label:"Wastage by Product",key:"wastageByProduct",color:"#ef4444"},
              ]},
              {label:"🗃️ Maintenance",tools:[
                {icon:"💾",label:"Quick Backup",key:"quickBackup",color:"#10b981"},
                {icon:"🧹",label:"Orphan Deliveries",key:"orphanDeliveries",color:"#f97316"},
                {icon:"📜",label:"Audit Log",key:"auditLogView",color:"#6366f1"},
                {icon:"🗑️",label:"Bulk Delete Old Orders",key:"bulkDelete",color:"#ef4444"},
              ]},
              {label:"⚙️ Agent Tools",tools:[
                {icon:"🔑",label:"Reset Password",key:"resetPassword",color:"#8b5cf6"},
                {icon:"🔛",label:"Toggle Agent Active",key:"toggleAgent",color:"#0ea5e9"},
              ]},
            ];

            return <>
              <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,overflow:"hidden"}}>
                {/* Header — always visible, tap to expand/collapse */}
                <button
                  onClick={()=>setAdminToolSheet(adminToolSheet==="__open"?null:"__open")}
                  style={{width:"100%",padding:"13px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"transparent",border:"none",cursor:"pointer",textAlign:"left",WebkitTapHighlightColor:"transparent"}}
                >
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:32,height:32,borderRadius:10,background:"#f59e0b20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🛠️</div>
                    <div>
                      <p style={{color:t.text,fontWeight:800,fontSize:13,lineHeight:1.2}}>Admin Tools</p>
                      <p style={{color:t.sub,fontSize:10,marginTop:1}}>{toolGroups.reduce((s,g)=>s+g.tools.filter(x=>x.key).length,0)} tools across {toolGroups.length} categories</p>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    {pendingByAgent[0]?.count>0&&<span style={{background:"#ef444420",color:"#ef4444",borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700}}>🏃 {pendingByAgent[0].u.name} ({pendingByAgent[0].count})</span>}
                    <div style={{width:24,height:24,borderRadius:"50%",background:t.inp,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:t.sub,fontWeight:700,transition:"transform 0.2s",transform:adminToolSheet==="__open"?"rotate(180deg)":"rotate(0deg)"}}>▾</div>
                  </div>
                </button>

                {/* Dropdown body */}
                {adminToolSheet==="__open"&&<>
                  <div style={{height:1,background:t.border}}/>
                  <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
                    {toolGroups.map((group,gi)=>(
                      <div key={gi}>
                        <p style={{color:t.sub,fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6,paddingLeft:2}}>{group.label}</p>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:6}}>
                          {group.tools.map((tool,ti)=>(
                            <button key={ti}
                              onClick={()=>{
                                if(!tool.key) return;
                                if(tool.key==="daySummary"){copyDigest();return;}
                                if(tool.key==="exportContacts"){doExportContacts();return;}
                                if(tool.key==="printRunSheet"){doPrintRunSheet();return;}
                                if(tool.key==="quickBackup"){exportAll();addLog("Quick backup","From admin tools");notify("Backup downloaded ✓");return;}
                                openTool(tool.key);
                              }}
                              disabled={!tool.key}
                              style={{
                                background:tool.key?tool.color+"12":t.inp,
                                border:`1px solid ${tool.key?tool.color+"35":t.border}`,
                                color:tool.key?tool.color:t.sub,
                                borderRadius:10,
                                padding:"9px 10px",
                                fontSize:11,
                                fontWeight:700,
                                cursor:tool.key?"pointer":"default",
                                display:"flex",
                                alignItems:"center",
                                gap:6,
                                textAlign:"left",
                                lineHeight:1.3,
                                WebkitTapHighlightColor:"transparent",
                                opacity:tool.key?1:0.5,
                                transition:"opacity 0.15s",
                              }}
                            >
                              <span style={{fontSize:14,flexShrink:0}}>{tool.icon}</span>
                              <span>{tool.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>}
              </div>

              {/* ── ADMIN TOOL SHEETS ── */}

              {/* Reschedule pending */}
              <Sheet open={adminToolSheet==="reschedule"} title="🔁 Reschedule Today's Pending" onClose={()=>setAdminToolSheet(null)} dm={dm}>
                <p style={{color:t.sub,fontSize:12}}>Move all of today's pending deliveries ({deliveries.filter(d=>d.date===todayStr&&d.status==="Pending").length} orders) to a new date.</p>
                <Inp dm={dm} label="New Date" type="date" value={rescheduleDate} onChange={e=>setRescheduleDate(e.target.value)} min={todayStr}/>
                <Btn dm={dm} v="amber" onClick={doReschedule}>Reschedule {deliveries.filter(d=>d.date===todayStr&&d.status==="Pending").length} Orders</Btn>
              </Sheet>

              {/* Bulk reassign agent */}
              <Sheet open={adminToolSheet==="bulkReassign"} title="👤 Bulk Reassign Agent" onClose={()=>setAdminToolSheet(null)} dm={dm}>
                <p style={{color:t.sub,fontSize:12}}>Reassign all pending deliveries in a date range to a different agent.</p>
                <div className="grid grid-cols-2 gap-3">
                  <Inp dm={dm} label="From Date" type="date" value={bulkAgentDateFrom} onChange={e=>setBulkAgentDateFrom(e.target.value)}/>
                  <Inp dm={dm} label="To Date" type="date" value={bulkAgentDateTo} onChange={e=>setBulkAgentDateTo(e.target.value)}/>
                </div>
                <Sel dm={dm} label="From Agent (optional — leave blank for all)" value={bulkAgentFrom} onChange={e=>setBulkAgentFrom(e.target.value)}>
                  <option value="">Any / Unassigned</option>
                  {agentUsers3.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                </Sel>
                <Sel dm={dm} label="Reassign To" value={bulkAgentTo} onChange={e=>setBulkAgentTo(e.target.value)}>
                  <option value="">— select agent —</option>
                  {agentUsers3.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                </Sel>
                <Btn dm={dm} v="sky" onClick={doBulkAgentReassign}>Reassign Deliveries</Btn>
              </Sheet>

              {/* Print run sheet */}
              <Sheet open={adminToolSheet==="printRunSheet"} title="🖨️ Print Run Sheet" onClose={()=>setAdminToolSheet(null)} dm={dm}>
                <p style={{color:t.sub,fontSize:12}}>Generates a printable PDF run sheet for today's {deliveries.filter(d=>d.date===todayStr&&d.status==="Pending").length} pending deliveries with a checkbox column.</p>
                <Btn dm={dm} v="success" onClick={()=>{doPrintRunSheet();setAdminToolSheet(null);}}>Open Print Preview</Btn>
              </Sheet>

              {/* Overdue customers */}
              <Sheet open={adminToolSheet==="overdueCustomers"} title="🔴 Overdue Customers" onClose={()=>setAdminToolSheet(null)} dm={dm}>
                <div className="flex gap-2 items-end">
                  <Inp dm={dm} label="Overdue by at least (days)" type="number" min="1" value={overdueDays} onChange={e=>setOverdueDays(e.target.value)} className="flex-1"/>
                  <Btn dm={dm} v="danger" onClick={()=>openTool("overdueCustomers")}>Search</Btn>
                </div>
                {adminToolData&&(adminToolData.length===0
                  ?<p style={{color:t.sub,fontSize:13,textAlign:"center"}}>No overdue customers found ✓</p>
                  :<div className="flex flex-col gap-2">
                    {adminToolData.map(c=>(
                      <div key={c.id} style={{background:t.inp,borderRadius:10,padding:"10px 12px"}}>
                        <div className="flex justify-between items-start">
                          <div>
                            <p style={{color:t.text,fontWeight:700,fontSize:13}}>{c.name}</p>
                            <p style={{color:t.sub,fontSize:11}}>{c.phone||"No phone"}</p>
                          </div>
                          <div className="text-right">
                            <p style={{color:"#ef4444",fontWeight:800,fontSize:13}}>{inr(c.pending)}</p>
                            <p style={{color:t.sub,fontSize:10}}>{c.daysOverdue!==null?`${c.daysOverdue}d overdue`:"no date"}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    <Btn dm={dm} v="outline" onClick={()=>exportCSV(adminToolData,"overdue_customers",[{label:"Name",key:"name"},{label:"Phone",key:"phone"},{label:"Pending",key:"pending"},{label:"Days Overdue",key:"daysOverdue"}])}>Export CSV</Btn>
                  </div>
                )}
              </Sheet>

              {/* Inactive customers */}
              <Sheet open={adminToolSheet==="inactiveCustomers"} title="😴 Inactive Customers" onClose={()=>setAdminToolSheet(null)} dm={dm}>
                <div className="flex gap-2 items-end">
                  <Sel dm={dm} label="Inactive for" value={inactiveDays} onChange={e=>{setInactiveDays(e.target.value);}} className="flex-1">
                    <option value="30">30 days</option>
                    <option value="60">60 days</option>
                    <option value="90">90 days</option>
                  </Sel>
                  <Btn dm={dm} v="amber" onClick={()=>openTool("inactiveCustomers")}>Search</Btn>
                </div>
                {adminToolData&&(adminToolData.length===0
                  ?<p style={{color:t.sub,fontSize:13,textAlign:"center"}}>No inactive customers found ✓</p>
                  :<div className="flex flex-col gap-2">
                    {adminToolData.map(c=>(
                      <div key={c.id} style={{background:t.inp,borderRadius:10,padding:"10px 12px"}} className="flex justify-between items-center">
                        <div>
                          <p style={{color:t.text,fontWeight:700,fontSize:13}}>{c.name}</p>
                          <p style={{color:t.sub,fontSize:11}}>{c.lastOrderDate?`Last order: ${c.lastOrderDate}`:"No orders ever"}</p>
                        </div>
                        <p style={{color:"#f97316",fontWeight:700,fontSize:12}}>{c.daysSince!==null?`${c.daysSince}d ago`:"—"}</p>
                      </div>
                    ))}
                    <Btn dm={dm} v="outline" onClick={()=>exportCSV(adminToolData,"inactive_customers",[{label:"Name",key:"name"},{label:"Phone",key:"phone"},{label:"Last Order",key:"lastOrderDate"},{label:"Days Since",key:"daysSince"}])}>Export CSV</Btn>
                  </div>
                )}
              </Sheet>

              {/* Duplicates */}
              <Sheet open={adminToolSheet==="duplicates"} title="🪞 Duplicate Customer Names" onClose={()=>setAdminToolSheet(null)} dm={dm}>
                {!adminToolData?<p style={{color:t.sub,fontSize:12}}>Loading…</p>
                  :adminToolData.length===0
                    ?<p style={{color:"#10b981",fontSize:13,textAlign:"center"}}>No duplicate names found ✓</p>
                    :<div className="flex flex-col gap-3">
                      {adminToolData.map((group,gi)=>(
                        <div key={gi} style={{background:t.inp,borderRadius:10,padding:"10px 12px"}}>
                          <p style={{color:"#f97316",fontWeight:700,fontSize:11,marginBottom:6}}>⚠️ {group.length} entries with same name</p>
                          {group.map(c=>(
                            <div key={c.id} className="flex justify-between items-center py-1">
                              <div>
                                <p style={{color:t.text,fontWeight:700,fontSize:13}}>{c.name}</p>
                                <p style={{color:t.sub,fontSize:11}}>{c.phone||"No phone"} · {c.address||"No address"}</p>
                              </div>
                              <p style={{color:t.sub,fontSize:10}}>ID: {c.id.slice(-6)}</p>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                }
              </Sheet>

              {/* Export contacts */}
              <Sheet open={adminToolSheet==="exportContacts"} title="📤 Export Customer Contacts" onClose={()=>setAdminToolSheet(null)} dm={dm}>
                <p style={{color:t.sub,fontSize:12}}>Exports all {customers.length} customers as a CSV with name, phone, address, join date, and balance.</p>
                <Btn dm={dm} v="success" onClick={()=>{doExportContacts();setAdminToolSheet(null);}}>Download CSV</Btn>
              </Sheet>

              {/* Weekly digest */}
              <Sheet open={adminToolSheet==="weeklyDigest"} title="📅 Weekly Digest" onClose={()=>setAdminToolSheet(null)} dm={dm}>
                {adminToolData&&typeof adminToolData==="string"&&<>
                  <pre style={{background:t.inp,borderRadius:10,padding:12,fontSize:11,color:t.text,whiteSpace:"pre-wrap",lineHeight:1.7}}>{adminToolData}</pre>
                  <Btn dm={dm} v="primary" onClick={()=>navigator.clipboard?.writeText(adminToolData).then(()=>notify("Copied ✓")).catch(()=>notify("Copy failed"))}>Copy to Clipboard</Btn>
                </>}
              </Sheet>

              {/* Agent leaderboard */}
              <Sheet open={adminToolSheet==="agentLeaderboard"} title="🏆 Agent Leaderboard — This Month" onClose={()=>setAdminToolSheet(null)} dm={dm}>
                {adminToolData&&<div className="flex flex-col gap-2">
                  {adminToolData.length===0?<p style={{color:t.sub,fontSize:13,textAlign:"center"}}>No delivery data this month</p>
                    :adminToolData.map((row,i)=>(
                    <div key={row.u.id} style={{background:i===0?"#f59e0b10":t.inp,border:i===0?"1px solid #f59e0b30":"none",borderRadius:10,padding:"10px 12px"}} className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span style={{fontSize:18}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":"👤"}</span>
                        <div>
                          <p style={{color:t.text,fontWeight:700,fontSize:13}}>{row.u.name}</p>
                          <p style={{color:t.sub,fontSize:11}}>{row.delivered}/{row.total} delivered · {row.rate}%</p>
                        </div>
                      </div>
                      <p style={{color:"#10b981",fontWeight:800,fontSize:13}}>{inr(row.revenue)}</p>
                    </div>
                  ))}
                </div>}
              </Sheet>

              {/* Product sales */}
              <Sheet open={adminToolSheet==="productSales"} title="📦 Product Sales Breakdown" onClose={()=>setAdminToolSheet(null)} dm={dm}>
                <div className="grid grid-cols-2 gap-3">
                  <Inp dm={dm} label="From" type="date" value={salesFrom} onChange={e=>setSalesFrom(e.target.value)}/>
                  <Inp dm={dm} label="To" type="date" value={salesTo} onChange={e=>setSalesTo(e.target.value)}/>
                </div>
                <Btn dm={dm} v="sky" onClick={()=>openTool("productSales")}>Calculate</Btn>
                {adminToolData&&<div className="flex flex-col gap-2">
                  {adminToolData.length===0?<p style={{color:t.sub,fontSize:13,textAlign:"center"}}>No delivered orders in range</p>
                    :adminToolData.map(r=>(
                    <div key={r.id} style={{background:t.inp,borderRadius:10,padding:"10px 12px"}} className="flex justify-between items-center">
                      <div>
                        <p style={{color:t.text,fontWeight:700,fontSize:13}}>{r.name}</p>
                        <p style={{color:t.sub,fontSize:11}}>{r.total} {r.unit} sold</p>
                      </div>
                      <p style={{color:"#10b981",fontWeight:800,fontSize:13}}>{inr(r.revenue)}</p>
                    </div>
                  ))}
                </div>}
              </Sheet>

              {/* Wastage by product */}
              <Sheet open={adminToolSheet==="wastageByProduct"} title="🗑️ Wastage by Product" onClose={()=>setAdminToolSheet(null)} dm={dm}>
                {adminToolData&&<div className="flex flex-col gap-2">
                  {adminToolData.length===0?<p style={{color:t.sub,fontSize:13,textAlign:"center"}}>No wastage logged yet</p>
                    :adminToolData.map((r,i)=>(
                    <div key={i} style={{background:t.inp,borderRadius:10,padding:"10px 12px"}} className="flex justify-between items-center">
                      <div>
                        <p style={{color:t.text,fontWeight:700,fontSize:13}}>{r.name}</p>
                        <p style={{color:t.sub,fontSize:11}}>{r.entries} entries</p>
                      </div>
                      <div className="text-right">
                        <p style={{color:"#ef4444",fontWeight:800,fontSize:13}}>{r.qty} units</p>
                        {r.cost>0&&<p style={{color:t.sub,fontSize:10}}>{inr(r.cost)} lost</p>}
                      </div>
                    </div>
                  ))}
                </div>}
              </Sheet>

              {/* Quick backup */}
              <Sheet open={adminToolSheet==="quickBackup"} title="💾 Quick Backup" onClose={()=>setAdminToolSheet(null)} dm={dm}>
                <p style={{color:t.sub,fontSize:12}}>Downloads a full JSON backup of all your data — customers, deliveries, products, expenses, wastage, and logs.</p>
                {lastBackupDate&&<p style={{color:"#10b981",fontSize:12}}>Last backup: {lastBackupDate}</p>}
                <Btn dm={dm} v="success" onClick={()=>{exportAll();setAdminToolSheet(null);}}>Download Backup Now</Btn>
              </Sheet>

              {/* Orphan deliveries */}
              <Sheet open={adminToolSheet==="orphanDeliveries"} title="🧹 Orphan Deliveries" onClose={()=>setAdminToolSheet(null)} dm={dm}>
                <p style={{color:t.sub,fontSize:12}}>Deliveries linked to customers that no longer exist in the system.</p>
                {adminToolData&&(adminToolData.length===0
                  ?<p style={{color:"#10b981",fontSize:13,textAlign:"center"}}>No orphaned records found ✓</p>
                  :<div className="flex flex-col gap-2">
                    {adminToolData.map(d=>(
                      <div key={d.id} style={{background:t.inp,borderRadius:10,padding:"10px 12px"}} className="flex justify-between items-center">
                        <div>
                          <p style={{color:t.text,fontWeight:700,fontSize:13}}>{d.customer}</p>
                          <p style={{color:t.sub,fontSize:11}}>{d.date} · {d.status}</p>
                        </div>
                        <Btn dm={dm} v="danger" size="sm" onClick={()=>{ask(`Delete orphan delivery for "${d.customer}"?`,()=>{setDeliv(p=>p.filter(x=>x.id!==d.id));addLog("Deleted orphan delivery",d.customer);notify("Deleted");setAdminToolData(p=>p.filter(x=>x.id!==d.id));});}}>Delete</Btn>
                      </div>
                    ))}
                  </div>
                )}
              </Sheet>

              {/* Audit log viewer */}
              <Sheet open={adminToolSheet==="auditLogView"} title="📜 Audit Log" onClose={()=>setAdminToolSheet(null)} dm={dm}>
                {adminToolData&&<div className="flex flex-col gap-1.5" style={{maxHeight:400,overflowY:"auto"}}>
                  {adminToolData.length===0?<p style={{color:t.sub,fontSize:13,textAlign:"center"}}>No log entries yet</p>
                    :adminToolData.map(e=>(
                    <div key={e.id} style={{background:t.inp,borderRadius:8,padding:"8px 10px"}}>
                      <div className="flex justify-between items-start">
                        <p style={{color:t.text,fontWeight:700,fontSize:12}}>{e.action}</p>
                        <p style={{color:t.sub,fontSize:10}}>{e.user}</p>
                      </div>
                      <p style={{color:t.sub,fontSize:11}}>{e.detail}</p>
                      <p style={{color:t.sub,fontSize:10}}>{e.ts}</p>
                    </div>
                  ))}
                </div>}
              </Sheet>

              {/* Bulk delete old orders */}
              <Sheet open={adminToolSheet==="bulkDelete"} title="🗑️ Bulk Delete Old Orders" onClose={()=>setAdminToolSheet(null)} dm={dm}>
                <p style={{color:"#ef4444",fontSize:12,fontWeight:600}}>⚠️ This permanently deletes old delivered orders. Back up first!</p>
                <Sel dm={dm} label="Delete delivered orders older than" value={bulkDelMonths} onChange={e=>setBulkDelMonths(e.target.value)}>
                  <option value="3">3 months</option>
                  <option value="6">6 months</option>
                  <option value="12">12 months</option>
                </Sel>
                <p style={{color:t.sub,fontSize:12}}>
                  {(()=>{
                    const months=Math.max(1,+bulkDelMonths||3);
                    const cutoff=new Date(Date.now()-months*30*86400000).toISOString().slice(0,10);
                    const count=deliveries.filter(d=>d.status==="Delivered"&&d.date<cutoff).length;
                    return `${count} delivered orders will be deleted (before ${cutoff})`;
                  })()}
                </p>
                <Btn dm={dm} v="danger" onClick={doBulkDelete}>Delete Old Orders</Btn>
              </Sheet>

              {/* Reset password */}
              <Sheet open={adminToolSheet==="resetPassword"} title="🔑 Reset User Password" onClose={()=>setAdminToolSheet(null)} dm={dm}>
                <Sel dm={dm} label="Select User" value={resetPwUser} onChange={e=>setResetPwUser(e.target.value)}>
                  <option value="">— select user —</option>
                  {users.filter(u=>u.id!==sess.id).map(u=><option key={u.id} value={u.id}>{u.name} (@{u.username}) · {u.role}</option>)}
                </Sel>
                <Inp dm={dm} label="New Password (min 6 chars)" type="password" value={resetPwVal} onChange={e=>setResetPwVal(e.target.value)} placeholder="Enter new password"/>
                <Btn dm={dm} v="purple" onClick={doResetPassword}>Reset Password</Btn>
              </Sheet>

              {/* Toggle agent active */}
              <Sheet open={adminToolSheet==="toggleAgent"} title="🔛 Toggle Agent Active" onClose={()=>setAdminToolSheet(null)} dm={dm}>
                <div className="flex flex-col gap-2">
                  {users.filter(u=>u.role==="agent").map(u=>(
                    <div key={u.id} style={{background:t.inp,borderRadius:10,padding:"10px 12px"}} className="flex justify-between items-center">
                      <div>
                        <p style={{color:t.text,fontWeight:700,fontSize:13}}>{u.name}</p>
                        <p style={{color:t.sub,fontSize:11}}>@{u.username}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span style={{color:u.active?"#10b981":"#9ca3af",fontSize:11,fontWeight:700}}>{u.active?"Active":"Inactive"}</span>
                        <Tog dm={dm} on={u.active} onChange={()=>{setUsers(p=>p.map(x=>x.id===u.id?{...x,active:!x.active}:x));addLog(`${u.active?"Deactivated":"Activated"} agent`,u.name);notify(`${u.name} ${u.active?"deactivated":"activated"} ✓`);}}/>
                      </div>
                    </div>
                  ))}
                  {users.filter(u=>u.role==="agent").length===0&&<p style={{color:t.sub,fontSize:13,textAlign:"center"}}>No agents found</p>}
                </div>
              </Sheet>
            </>;
          })()}

          {/* STAT CARDS */}
          {widgets.includes("stats")&&<>
            {canSeeFinancials&&<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard dm={dm} label="Total Revenue" value={inr(totalRev)} sub="From delivered orders" accent="#10b981"/>
              <StatCard dm={dm} label="Amount Due" value={inr(totalDue)} sub={`${customers.filter(c=>c.pending>0).length} customers`} accent="#ef4444"/>
              <StatCard dm={dm} label="Total Costs" value={inr(totalExpOp+totalSupC)} sub="Ops + supplies" accent="#f59e0b"/>
              <StatCard dm={dm} label="Net Profit" value={inr(netProfit)} sub={netProfit>=0?"Profitable ✓":"In loss ⚠️"} accent={netProfit>=0?"#10b981":"#ef4444"}/>
            </div>}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                    <button onClick={()=>tglD(d)} style={{background:"#10b981",color:"#fff"}} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px]">Done ✓</button>
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
                      {can("cust_markPaid")&& <button onClick={()=>{setPaySh(c);setPayAmt("");}} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px] bg-emerald-500 text-white">+ Pay</button>}
                    </div>
                  </div>
                  <div style={{background:t.border,height:3,borderRadius:3,overflow:"hidden"}}><div style={{width:`${collPct}%`,background:"#10b981",height:"100%",borderRadius:3}}/></div>
                </div>
              </div>;
            })}
          </Card>}

          {/* TODAY'S WASTAGE */}
          {widgets.includes("wastageToday")&&can("dash_seeWastage")&&(()=>{
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
                  {can("waste_seeCost")&&twCost>0&&<span className="text-sm font-bold text-red-500">{inr(twCost)}</span>}
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

          {/* OVERDUE DELIVERY FOLLOW-UP — admin only */}
          {isAdmin&&(()=>{
            const overdueD=deliveries.filter(d=>d.status==="Pending"&&d.date<today()).sort((a,b)=>a.date.localeCompare(b.date));
            if(overdueD.length===0) return null;
            return <div style={{background:dm?"#1a0808":"#fff8f8",border:"1.5px solid #ef444440",borderRadius:20,padding:"14px 18px"}}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-0.5">🔴 Overdue Deliveries</p>
                  <p style={{color:t.text}} className="font-bold text-sm">{overdueD.length} order{overdueD.length!==1?"s":""} past due date</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {overdueD.slice(0,5).map(d=>{
                  const cust=customers.find(c=>c.id===d.customerId);
                  const daysAgo=Math.round((new Date(today())-new Date(d.date))/(86400000));
                  return <div key={d.id} style={{background:dm?"rgba(239,68,68,0.07)":"rgba(239,68,68,0.05)",border:"1px solid #ef444425",borderRadius:12,padding:"10px 12px"}} className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p style={{color:t.text}} className="text-sm font-bold truncate">{d.customer}</p>
                      <p style={{color:"#ef4444"}} className="text-[11px] font-semibold">{daysAgo}d overdue · {d.date}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {cust?.phone&&<a href={`tel:${cust.phone}`} style={{background:"#10b98120",color:"#10b981",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:700,textDecoration:"none",display:"inline-flex",alignItems:"center",gap:4}}>📞 Call</a>}
                      {can("deliv_markDone")&&<button onClick={()=>{setDeliv(p=>p.map(x=>x.id===d.id?{...x,status:"Delivered",deliveryDate:today()}:x));addLog("Marked overdue delivered",d.customer);notify(`${d.customer} marked delivered ✓`);captureGPS("marked_delivered",d.customer);addNotif("Delivery Completed",`${d.customer} (overdue) marked Delivered`,"success");}} style={{background:"#10b98120",color:"#10b981",border:"none",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✓ Done</button>}
                    </div>
                  </div>;
                })}
                {overdueD.length>5&&<p style={{color:t.sub}} className="text-[11px] text-center mt-1">+{overdueD.length-5} more — <button onClick={()=>setTab("Deliveries")} style={{color:"#f59e0b",background:"none",border:"none",cursor:"pointer",fontWeight:700,fontSize:11}}>view all →</button></p>}
              </div>
            </div>;
          })()}

          {/* NOTICE BOARD */}
          {(()=>{
            const unreadNotices=(notices||[]).filter(n=>!(n.readBy||[]).includes(sess.id));
            function saveNotice(){
              if(!nbF.title.trim()||!nbF.body.trim()){notify("Title and message required");return;}
              const rec={...nbF,id:uid(),postedBy:sess.name,postedAt:ts(),readBy:[]};
              setNotices(p=>[rec,...p]);
              addLog("Notice posted",rec.title);
              addNotif("📌 Notice: "+rec.title,rec.body,"info","noticeboard");
              notify("Notice posted ✓");
              setNbSh(false);
              setNbF({title:"",body:"",pinned:false});
            }
            function markRead(id){setNotices(p=>p.map(n=>n.id===id?{...n,readBy:[...(n.readBy||[]),sess.id]}:n));}
            return (<>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <p style={{color:t.text}} className="font-bold text-sm">📌 Notice Board</p>
                  {unreadNotices.length>0&&<Pill dm={dm} c="sky">{unreadNotices.length} new</Pill>}
                </div>
                {can("dash_postNotice")&& <Btn dm={dm} size="sm" onClick={()=>{setNbF({title:"",body:"",pinned:false});setNbSh(true);}}>+ Post Notice</Btn>}
              </div>
              {(notices||[]).length===0&&<div style={{background:t.inp,borderRadius:14,padding:"20px",textAlign:"center"}}><p style={{color:t.sub}} className="text-sm">No notices posted yet.</p></div>}
              {[...(notices||[])].sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)).map(n=>{
                const isRead=(n.readBy||[]).includes(sess.id);
                return <div key={n.id} style={{background:n.pinned?(dm?"rgba(245,158,11,0.08)":"rgba(245,158,11,0.06)"):t.card,border:`1.5px solid ${n.pinned?"rgba(245,158,11,0.3)":isRead?t.border:"rgba(14,165,233,0.3)"}`,borderRadius:16,padding:"14px 16px"}}>
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {n.pinned&&<span style={{background:"#f59e0b20",color:"#f59e0b",borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:700}}>📌 Pinned</span>}
                        {!isRead&&<span style={{background:"#0ea5e920",color:"#0ea5e9",borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:700}}>New</span>}
                        <p style={{color:t.text}} className="font-bold text-sm">{n.title}</p>
                      </div>
                      <p style={{color:t.sub}} className="text-[11px]">by {n.postedBy} · {n.postedAt}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {!isRead&&<button onClick={()=>markRead(n.id)} style={{background:"#0ea5e920",color:"#0ea5e9",border:"none",borderRadius:8,padding:"4px 9px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Mark read</button>}
                      {can("dash_delNotice")&& <button onClick={()=>setNotices(p=>p.filter(x=>x.id!==n.id))} style={{background:t.inp,color:t.sub,border:"none",borderRadius:8,padding:"4px 9px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Delete</button>}
                    </div>
                  </div>
                  <p style={{color:t.text,lineHeight:1.6}} className="text-sm">{n.body}</p>
                </div>;
              })}
              <Sheet dm={dm} open={nbSh} onClose={()=>setNbSh(false)} title="Post Notice">
                <Inp dm={dm} label="Title *" value={nbF.title} onChange={e=>setNbF({...nbF,title:e.target.value})} placeholder="e.g. Holiday schedule update"/>
                <div>
                  <label style={{color:T(dm).sub}} className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 ml-0.5">Message *</label>
                  <textarea value={nbF.body} onChange={e=>setNbF({...nbF,body:e.target.value})} placeholder="Write your announcement here…" rows={5}
                    style={{width:"100%",background:T(dm).inp,border:`1.5px solid ${T(dm).inpB}`,color:T(dm).text,borderRadius:14,padding:"10px 14px",fontSize:13,outline:"none",resize:"vertical",fontFamily:"system-ui"}}/>
                </div>
                <div style={{background:T(dm).inp,borderRadius:14,padding:"12px 16px"}} className="flex items-center justify-between">
                  <div>
                    <p style={{color:T(dm).text}} className="text-sm font-semibold">Pin this notice</p>
                    <p style={{color:T(dm).sub}} className="text-[11px]">Pinned notices appear at the top</p>
                  </div>
                  <Tog dm={dm} on={nbF.pinned} onChange={()=>setNbF(f=>({...f,pinned:!f.pinned}))}/>
                </div>
                <Btn dm={dm} onClick={saveNotice} className="w-full">Post Notice</Btn>
              </Sheet>
            </>);
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
              {can("cust_export")&& <Btn dm={dm} v="outline" size="sm" onClick={()=>exportCSV(customers,"customers",[{label:"Name",key:"name"},{label:"Phone",key:"phone"},{label:"Address",key:"address"},{label:"Join Date",key:"joinDate"},{label:"Active",val:r=>r.active?"Yes":"No"},{label:"Order Total",val:r=>lineTotal(r.orderLines)},{label:"Paid",key:"paid"},{label:"Pending",key:"pending"},{label:"Status",val:r=>r.pending>0?"UNPAID":"PAID"},{label:"Notes",key:"notes"}])}>CSV</Btn>}
              <Btn dm={dm} size="sm" onClick={()=>{setCf(blkC());setCsh("add");}}>+ Customer</Btn>
            </div>
          </div>
          <Search dm={dm} value={srch} onChange={setSrch} placeholder="Search name, phone, address…"/>
          {fCust.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-8">No customers found.</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  <button onClick={()=>setCView(c)} style={{background:t.inp,color:t.text}} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px]">Profile</button>
                  <button onClick={()=>{setCf({...c,orderLines:{...safeO(c.orderLines)}});setCsh(c);}} style={{background:t.inp,color:t.text}} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px]">Edit</button>
                  <button onClick={()=>exportPDF(c,products,"customer",settings)} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px] bg-purple-500 text-white">PDF</button>
                  {isAdmin&&<button onClick={()=>{setPaySh(c);setPayAmt("");}} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px] bg-emerald-500 text-white">+ Pay</button>}
                  {can("cust_deactivate")&& <button onClick={()=>togActive(c)} style={{background:t.inp,color:"#38bdf8"}} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px]">{c.active?"Deactivate":"Activate"}</button>}
                  {c.address&&<a href={mapU(c.address,c.lat,c.lng)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px] bg-sky-500 text-white">📍 Map</a>}
                  {can("cust_delete")&& <button onClick={()=>delC(c)} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px] bg-red-600 text-white">Delete</button>}
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
              <button onClick={()=>{setBulkSelect(v=>{if(v){setBulkSelected(new Set());}return !v;});}} style={{background:bulkSelect?"#f59e0b":t.inp,color:bulkSelect?"#000":t.sub,border:`1px solid ${bulkSelect?"#f59e0b":t.border}`}} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px] transition-all">{bulkSelect?"✕ Cancel":"☑ Bulk"}</button>
              <button onClick={()=>setDelivCalendar(v=>!v)} style={{background:delivCalendar?"#f59e0b":t.inp,color:delivCalendar?"#000":t.sub}} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px] transition-all">{delivCalendar?"📋 List":"📅 Calendar"}</button>
              {can("deliv_report")&& <Btn v="purple" size="sm" onClick={exportFullReport}>📊 Report</Btn>}
              {can("deliv_export")&& <Btn dm={dm} v="outline" size="sm" onClick={()=>exportCSV(deliveries,"deliveries",[{label:"Customer",key:"customer"},{label:"Date",key:"date"},{label:"Deliver By",key:"deliveryDate"},{label:"Status",key:"status"},{label:"Total",val:r=>lineTotal(r.orderLines)},{label:"Address",key:"address"},{label:"Created By",key:"createdBy"},{label:"Notes",key:"notes"},{label:"Replacement Done",val:r=>r.replacement?.done?"Yes":"No"},{label:"Replacement Item",val:r=>r.replacement?.item||""},{label:"Replacement Qty",val:r=>r.replacement?.qty||""},{label:"Replacement Reason",val:r=>r.replacement?.reason||""}])}>CSV</Btn>}
              <Btn dm={dm} size="sm" onClick={()=>{setDf(blkD());setDsh("add");}}>+ Delivery</Btn>
            </div>
          </div>
          {/* BULK ACTION BAR */}
          {bulkSelect&&<div style={{background:"#f59e0b15",border:"1.5px solid #f59e0b40",borderRadius:16,padding:"12px 16px"}} className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <button onClick={()=>{const pending=fDeliv.filter(d=>d.status==="Pending").map(d=>d.id);setBulkSelected(new Set(pending));}} style={{color:"#f59e0b"}} className="text-xs font-semibold">Select all pending</button>
              <span style={{color:t.sub}} className="text-xs">|</span>
              <button onClick={()=>setBulkSelected(new Set())} style={{color:t.sub}} className="text-xs font-semibold">Clear</button>
              <span style={{color:t.text}} className="text-xs font-bold">{bulkSelected.size} selected</span>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>{if(bulkSelected.size===0){notify("Select at least one delivery");return;}setDeliv(p=>p.map(d=>bulkSelected.has(d.id)?{...d,status:"Delivered"}:d));addLog("Bulk status update",`${bulkSelected.size} deliveries marked Delivered`);notify(`${bulkSelected.size} marked Delivered ✓`);captureGPS("marked_delivered",`Bulk (${bulkSelected.size})`);setBulkSelected(new Set());setBulkSelect(false);}} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px] bg-emerald-500 text-white">✓ Mark Delivered</button>
              <button onClick={()=>{if(bulkSelected.size===0){notify("Select at least one delivery");return;}setDeliv(p=>p.map(d=>bulkSelected.has(d.id)?{...d,status:"In Transit"}:d));addLog("Bulk status update",`${bulkSelected.size} deliveries set In Transit`);notify(`${bulkSelected.size} set In Transit ✓`);captureGPS("marked_transit",`Bulk (${bulkSelected.size})`);setBulkSelected(new Set());setBulkSelect(false);}} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px] bg-sky-500 text-white">🚚 Set In Transit</button>
            </div>
          </div>}
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
                <div className="flex items-center justify-between mt-2 px-1 flex-wrap gap-2">
                  <div className="flex gap-3">
                    {[["Pending","#f59e0b"],["In Transit","#0ea5e9"],["Delivered","#10b981"]].map(([s,c])=>(
                      <div key={s} className="flex items-center gap-1"><div style={{background:c,width:8,height:8,borderRadius:2}}/><span style={{color:t.sub}} className="text-[10px]">{s}</span></div>
                    ))}
                  </div>
                  {isAdmin&&can("deliv_markDone")&&calOffset===0&&(()=>{
                    // Bulk mark all pending for today — only shown when viewing the current month
                    const highlightDate=today();
                    const pendingToday2=deliveries.filter(d=>d.date===highlightDate&&d.status==="Pending");
                    if(pendingToday2.length===0) return null;
                    return <button onClick={()=>{
                      setDeliv(p=>p.map(d=>d.date===highlightDate&&d.status==="Pending"?{...d,status:"Delivered",deliveryDate:today()}:d));
                      addLog("Bulk delivered",`All pending on ${highlightDate} (${pendingToday2.length})`);
                      notify(`${pendingToday2.length} deliveries marked done ✓`);
                      captureGPS("marked_delivered",`Bulk day (${highlightDate})`);
                    }} style={{background:"#10b98120",color:"#10b981",border:"1px solid #10b98140",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                      ✓ Mark all today done ({pendingToday2.length})
                    </button>;
                  })()}
                </div>
              </div>
            </Card>;
          })()}

          {fDeliv.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-6">No deliveries found.</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {!delivCalendar&&fDeliv.map(d=>{
            const rows=lineRows(d.orderLines,products);
            const tot=lineTotal(d.orderLines);
            const isBulkChecked=bulkSelected.has(d.id);
            return (
              <Card key={d.id} dm={dm} style={isBulkChecked?{border:`2px solid #f59e0b`}:{}}><div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    {bulkSelect&&<button onClick={()=>{const s=new Set(bulkSelected);if(s.has(d.id))s.delete(d.id);else s.add(d.id);setBulkSelected(s);}} style={{width:22,height:22,borderRadius:6,border:`2px solid ${isBulkChecked?"#f59e0b":t.inpB}`,background:isBulkChecked?"#f59e0b":t.inp,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2,cursor:"pointer"}}>
                      {isBulkChecked&&<span style={{color:"#000",fontSize:12,fontWeight:900,lineHeight:1}}>✓</span>}
                    </button>}
                    <div className="min-w-0">
                      <p style={{color:t.text}} className="font-semibold">{d.customer}</p>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                        <span style={{color:t.sub}} className="text-xs">📅 {d.date}</span>
                        {d.deliveryDate&&<span style={{color:t.sub}} className="text-xs">→ by {d.deliveryDate}</span>}
                        <span style={{color:t.sub}} className="text-xs">by {d.createdBy||"—"}</span>
                      </div>
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
                  {d.address&&<a href={mapU(d.address,d.lat,d.lng)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px] bg-sky-500 text-white">📍 Navigate</a>}
                  <button onClick={()=>{setDf({...d,orderLines:{...safeO(d.orderLines)},replacement:d.replacement||{done:false,item:"",reason:"",qty:""}});setDsh(d);}} style={{background:t.inp,color:t.text}} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px]">Edit</button>
                  <button onClick={()=>exportPDF(d,products,"delivery",settings)} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px] bg-purple-500 text-white">PDF</button>
                  <button onClick={()=>exportWord(d,products,"delivery",settings)} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px] bg-sky-500 text-white">Word</button>
                  <button onClick={()=>shareWhatsApp(d,products,"delivery",settings)} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px] text-white" style={{background:"#25D366"}}>WhatsApp</button>
                  {can("deliv_dispatch")&&d.status==="Pending"&&<button onClick={()=>{setDeliv(p=>p.map(x=>x.id===d.id?{...x,status:"In Transit"}:x));addLog("Dispatched",d.customer);notify("Marked In Transit");captureGPS("marked_transit",d.customer);}} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px] bg-amber-500 text-white">Dispatch</button>}
                  {can("deliv_delete")&& <button onClick={()=>delD(d)} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px] bg-red-600 text-white">Delete</button>}
                </div>
              </div></Card>
            );
          })}
          </div>
        </>)}

        {/* SUPPLIES */}
        {tab==="Supplies"&&(<>
          {/* Summary cards */}
          {canSeeFinancials&&<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
              {can("sup_export")&& <Btn dm={dm} v="outline" size="sm" onClick={()=>exportCSV(supplies,"supplies",[{label:"Item",key:"item"},{label:"Qty",key:"qty"},{label:"Unit",key:"unit"},{label:"Supplier",key:"supplier"},{label:"Cost",key:"cost"},{label:"Date",key:"date"},{label:"Notes",key:"notes"}])}>CSV</Btn>}
              <Btn dm={dm} size="sm" onClick={()=>{setSf(blkS());setSsh("add");}}>+ Supply</Btn>
            </div>
          </div>
          <Search dm={dm} value={srch} onChange={setSrch} placeholder="Search item, supplier…"/>
          {fSup.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-6">No supplies found.</p>}
          {fSup.map(s=>(
            <Card key={s.id} dm={dm}><div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p style={{color:t.text}} className="font-semibold">{s.item}</p>
                    {s.minStock&&(+s.qty||0)<=(+s.minStock)&&<span style={{background:"#ef444420",color:"#ef4444",borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:700}}>⚠️ Low Stock</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {s.supplier&&<span style={{color:t.sub}} className="text-xs">🏭 {s.supplier}</span>}
                    {s.date&&<span style={{color:t.sub}} className="text-xs">📅 {s.date}</span>}
                  </div>
                  {s.notes&&<p style={{color:t.sub}} className="text-xs italic mt-1">"{s.notes}"</p>}
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p style={{color:t.text}} className="font-bold text-base leading-none">{s.qty}<span style={{color:t.sub}} className="text-xs font-normal ml-1">{s.unit}</span></p>
                  {can("sup_seeCost")&&s.cost>0&&<p className="text-purple-500 font-bold text-sm mt-0.5">{inr(s.cost)}</p>}
                  <div className="flex gap-1.5 justify-end mt-2">
                    <button onClick={()=>{setSf({...s});setSsh(s);}} style={{background:t.inp,color:t.text}} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg">Edit</button>
                    {can("sup_delete")&& <button onClick={()=>delS(s)} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-red-600 text-white">Delete</button>}
                  </div>
                </div>
              </div>
            </div></Card>
          ))}
        </>)}

        {/* EXPENSES */}
        {tab==="Expenses"&&isAdmin&&(<>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard dm={dm} label="Total Wastage" value={totalWasteQty} sub={`${wastage.length} records`} accent="#f97316"/>
                <StatCard dm={dm} label="Today's Wastage" value={todayWaste.reduce((s,w)=>s+(w.qty||0),0)} sub={`${todayWaste.length} entries today`} accent="#ef4444"/>
                {can("waste_seeCost")&& <><StatCard dm={dm} label="Wastage Cost" value={inr(totalWasteCost)} sub="Estimated loss" accent="#8b5cf6"/>
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
                  {can("waste_seeCost")&&w.cost>0&&<p className="text-xs font-semibold text-red-400 mb-2">Estimated cost loss: {inr(w.cost)}</p>}
                  {(isAdmin||(sess.id&&w.loggedBy===sess.name))&&(
                    <div className="flex gap-1.5">
                      <button onClick={()=>{setWF({...w,qty:String(w.qty),cost:String(w.cost||"")});setWSh(w);}} style={{background:t.inp,color:t.text}} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px]">Edit</button>
                      {can("waste_delete")&& <button onClick={()=>delW(w)} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px] bg-red-600 text-white">Delete</button>}
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                    {mData.map((m,i)=>{
                      const prev=mData[i-1];
                      function arrow(curr,p){if(!p||p===0)return null;const up=curr>p;const pct=Math.round(Math.abs(curr-p)/Math.max(p,1)*100);return <span style={{color:up?"#10b981":"#ef4444",fontSize:9,marginLeft:3,fontWeight:700}}>{up?"▲":"▼"}{pct}%</span>;}
                      return <tr key={m.month} style={{borderBottom:`1px solid ${t.border}`,background:i%2===0?"transparent":dm?"#ffffff04":"#00000004"}}>
                        <td style={{color:t.text}} className="px-3 py-2.5 font-bold whitespace-nowrap">{m.monthFull}</td>
                        <td style={{color:t.sub}} className="px-3 py-2.5">{m.deliveriesCount}{prev&&arrow(m.deliveriesCount,prev.deliveriesCount)}</td>
                        <td className="px-3 py-2.5 text-emerald-500 font-semibold">{inr(m.revenue)}{prev&&arrow(m.revenue,prev.revenue)}</td>
                        <td className="px-3 py-2.5 text-purple-500">{inr(m.supplyCost)}</td>
                        <td className="px-3 py-2.5 text-red-400">{inr(m.expenses)}</td>
                        <td className="px-3 py-2.5 text-orange-500">{inr(m.wasteCost)}</td>
                        <td className="px-3 py-2.5 text-red-500 font-semibold">{inr(m.totalCost)}{prev&&arrow(m.totalCost,prev.totalCost)}</td>
                        <td className={`px-3 py-2.5 font-bold ${m.profit>=0?"text-emerald-500":"text-red-500"}`}>{inr(m.profit)}{prev&&arrow(m.profit,prev.profit)}</td>
                        <td className="px-3 py-2.5">
                          <span style={{background:m.margin>=30?"#10b98120":m.margin>=10?"#f59e0b20":"#ef444420",color:m.margin>=30?"#10b981":m.margin>=10?"#f59e0b":"#ef4444",borderRadius:6,padding:"2px 6px",fontWeight:700,fontSize:10}}>{m.margin}%</span>
                        </td>
                      </tr>;
                    })}
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
            {/* INVOICE AGING REPORT */}
            {(()=>{
              const now=new Date();
              const aged=customers.filter(c=>c.pending>0).map(c=>{
                const daysDue=Math.floor((now-new Date(c.joinDate||"2026-01-01"))/86400000);
                const bucket=daysDue<=30?"0-30 days":daysDue<=60?"31-60 days":daysDue<=90?"61-90 days":"90+ days";
                const color=daysDue<=30?"#f59e0b":daysDue<=60?"#f97316":daysDue<=90?"#ef4444":"#7f1d1d";
                return {...c,daysDue,bucket,color};
              }).sort((a,b)=>b.daysDue-a.daysDue);
              if(aged.length===0)return null;
              return <Card dm={dm} className="overflow-hidden">
                <div className="px-4 pt-4 pb-3"><p style={{color:t.text}} className="font-bold text-sm">📋 Invoice Aging Report</p><p style={{color:t.sub}} className="text-[11px]">Customers with outstanding balances by age</p></div>
                <Hr dm={dm}/>
                {aged.map((c)=>(
                  <div key={c.id} style={{borderBottom:`1px solid ${t.border}`}} className="px-4 py-3 last:border-0">
                    <div className="flex items-center justify-between">
                      <div><p style={{color:t.text}} className="text-sm font-semibold">{c.name}</p><p style={{color:t.sub}} className="text-xs">{c.daysDue} days since joining</p></div>
                      <div className="flex items-center gap-3">
                        <span style={{background:c.color+"15",color:c.color,borderRadius:8,padding:"2px 8px",fontSize:11,fontWeight:700}}>{c.bucket}</span>
                        <span style={{color:"#ef4444"}} className="font-black text-sm">{inr(c.pending)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </Card>;
            })()}
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard dm={dm} label="Fulfillment Rate" value={`${fulfillmentRate}%`} sub={`${totalDelivered}/${totalScheduled} orders`} accent={fulfillmentRate>=90?"#10b981":fulfillmentRate>=70?"#f59e0b":"#ef4444"}/>
              <StatCard dm={dm} label="Avg Revenue/Delivery" value={inr(avgRevPerDeliv)} sub="Per completed delivery" accent="#f59e0b"/>
              <StatCard dm={dm} label="Best Seller" value={prodSales[0]?.name||"—"} sub={prodSales[0]?`${prodSales[0].totalQty} units sold`:"No data"} accent="#8b5cf6"/>
              <StatCard dm={dm} label="Top Customer" value={custRev[0]?.name||"—"} sub={custRev[0]?inr(custRev[0].totalRev)+" revenue":"No data"} accent="#0ea5e9"/>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard dm={dm} label="Total Deliveries" value={deliveries.length} sub={`${totalDelivered} delivered`} accent="#10b981"/>
              <StatCard dm={dm} label="Replacement Rate" value={`${replRate}%`} sub={`${replCount} replacements made`} accent={replRate>10?"#ef4444":replRate>5?"#f59e0b":"#10b981"}/>
              <StatCard dm={dm} label="Active Customers" value={customers.filter(c=>c.active).length} sub={`${inactivePct}% inactive`} accent="#d97706"/>
              <StatCard dm={dm} label="Products in Catalogue" value={products.length} sub={`${prodSales.filter(p=>p.totalQty>0).length} selling`} accent="#6366f1"/>
            </div>
            {/* Best & Worst customer */}
            {custRev.length>0&&<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                          {can("prod_delete")&& <button onClick={()=>delPT(r)} className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-red-600 text-white">Del</button>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div></Card>;
            })}
            {filteredPT.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-8">{prodTargets.length===0?"No production records yet. Tap + Log Production to start tracking.":"No records for this period."}</p>}

            {/* ── SHIFT HANDOVER NOTES ── */}
            {(isAdmin||isFactory)&&(()=>{
              function saveHandover(){
                if(!hvF.note.trim()){notify("Note is required");return;}
                const rec={...hvF,id:uid(),createdAt:ts()};
                setHandovers(p=>[rec,...p.slice(0,99)]);
                addLog("Shift handover logged",`${rec.shift} → ${rec.nextShift||"next"}`);
                captureGPS("handover_logged",`${rec.shift} shift`);
                addNotif("Shift Handover",`${rec.shift} handover by ${rec.loggedBy}`,"info","newentry");
                notify("Handover note saved ✓");
                setHvSh(false);
              }
              const fHV=(handovers||[]).filter(h=>!srch||(h.note.toLowerCase().includes(srch.toLowerCase())||h.shift.toLowerCase().includes(srch.toLowerCase())||h.loggedBy?.toLowerCase().includes(srch.toLowerCase())));
              return (<>
                <div className="flex items-center justify-between">
                  <p style={{color:t.sub}} className="text-[11px] font-bold uppercase tracking-wider">📋 Shift Handover Notes</p>
                  <Btn dm={dm} size="sm" onClick={()=>{setHvF({shift:(settings?.shifts||["Morning"])[0],date:today(),note:"",nextShift:"",issues:"",loggedBy:displayName});setHvSh(true);}}>+ Handover</Btn>
                </div>
                {fHV.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-4">No handover notes yet.</p>}
                {fHV.slice(0,10).map(h=>(
                  <Card key={h.id} dm={dm}><div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span style={{background:"#f59e0b20",color:"#f59e0b",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{h.shift}</span>
                          {h.nextShift&&<><span style={{color:t.sub,fontSize:10}}>→</span><span style={{background:t.inp,color:t.sub,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:600}}>{h.nextShift}</span></>}
                        </div>
                        <p style={{color:t.sub}} className="text-xs">📅 {h.date} · by {h.loggedBy}</p>
                      </div>
                      {can("prod_handover")&& <button onClick={()=>setHandovers(p=>p.filter(x=>x.id!==h.id))} style={{background:t.inp,color:t.sub}} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold">Delete</button>}
                    </div>
                    <div style={{background:t.inp,border:`1px solid ${t.inpB}`,borderRadius:12,padding:"10px 14px",color:t.text}} className="text-sm">{h.note}</div>
                    {h.issues&&<div style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:10,padding:"8px 12px",marginTop:8}}>
                      <p style={{color:"#ef4444",fontSize:11,fontWeight:600}}>⚠️ Issues: {h.issues}</p>
                    </div>}
                  </div></Card>
                ))}
                <Sheet dm={dm} open={hvSh} onClose={()=>setHvSh(false)} title="Log Shift Handover">
                  <div className="grid grid-cols-2 gap-3">
                    <Sel dm={dm} label="Current Shift *" value={hvF.shift} onChange={e=>setHvF({...hvF,shift:e.target.value})}>
                      {(settings?.shifts||["Morning","Afternoon","Evening","Night"]).map(s=><option key={s}>{s}</option>)}
                    </Sel>
                    <Sel dm={dm} label="Handing Over To" value={hvF.nextShift||""} onChange={e=>setHvF({...hvF,nextShift:e.target.value})}>
                      <option value="">Select shift</option>
                      {(settings?.shifts||["Morning","Afternoon","Evening","Night"]).map(s=><option key={s}>{s}</option>)}
                    </Sel>
                  </div>
                  <Inp dm={dm} label="Date" type="date" value={hvF.date} onChange={e=>setHvF({...hvF,date:e.target.value})}/>
                  <div>
                    <label style={{color:T(dm).sub}} className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 ml-0.5">Handover Note *</label>
                    <textarea value={hvF.note} onChange={e=>setHvF({...hvF,note:e.target.value})} placeholder="What happened this shift?" rows={4}
                      style={{width:"100%",background:T(dm).inp,border:`1.5px solid ${T(dm).inpB}`,color:T(dm).text,borderRadius:14,padding:"10px 14px",fontSize:13,outline:"none",resize:"vertical",fontFamily:"system-ui"}}/>
                  </div>
                  <Inp dm={dm} label="Issues / Problems" value={hvF.issues} onChange={e=>setHvF({...hvF,issues:e.target.value})} placeholder="Any problems, machine issues…"/>
                  <Btn dm={dm} onClick={saveHandover} className="w-full">Save Handover Note</Btn>
                </Sheet>
              </>);
            })()}
          </>;
        })()}

        {/* QC LOG TAB */}
        {tab==="QC"&&(()=>{
          const canQC=isAdmin||isFactory;
          if(!canQC)return <p style={{color:t.sub}} className="text-sm text-center py-8">Access restricted.</p>;
          const GRADES=[{g:"A",color:"#10b981",label:"Pass — Grade A"},{g:"B",color:"#f59e0b",label:"Pass — Grade B"},{g:"C",color:"#f97316",label:"Marginal — Grade C"},{g:"F",color:"#ef4444",label:"Fail — Reject"}];
          const gradeColor=g=>GRADES.find(x=>x.g===g)?.color||"#6b7280";
          const fQC=qcLogs.filter(q=>!srch||(q.product.toLowerCase().includes(srch.toLowerCase())||q.grade.toLowerCase().includes(srch.toLowerCase())||q.checker?.toLowerCase().includes(srch.toLowerCase())));
          const totalChecks=qcLogs.length;
          const passRate=totalChecks>0?Math.round(qcLogs.filter(q=>q.grade!=="F").length/totalChecks*100):0;
          const todayQC=qcLogs.filter(q=>q.date===today());
          const gradeBreakdown=GRADES.map(({g,color,label})=>({g,color,label,count:qcLogs.filter(q=>q.grade===g).length}));
          return <>
            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard dm={dm} label="Total QC Checks" value={totalChecks} sub={`${todayQC.length} today`} accent="#14b8a6"/>
              <StatCard dm={dm} label="Pass Rate" value={`${passRate}%`} sub="Grade A, B & C" accent={passRate>=90?"#10b981":passRate>=70?"#f59e0b":"#ef4444"}/>
              <StatCard dm={dm} label="Rejections" value={qcLogs.filter(q=>q.grade==="F").length} sub="Grade F failures" accent="#ef4444"/>
              <StatCard dm={dm} label="Grade A" value={qcLogs.filter(q=>q.grade==="A").length} sub={`${totalChecks>0?Math.round(qcLogs.filter(q=>q.grade==="A").length/totalChecks*100):0}% of checks`} accent="#10b981"/>
            </div>
            {/* Grade breakdown bar */}
            {totalChecks>0&&<Card dm={dm} className="p-4">
              <p style={{color:t.text}} className="font-bold text-sm mb-3">Grade Distribution</p>
              <div className="flex h-4 rounded-lg overflow-hidden gap-0.5 mb-3">
                {gradeBreakdown.filter(x=>x.count>0).map(x=>(
                  <div key={x.g} style={{flex:x.count,background:x.color,minWidth:4}} title={`${x.g}: ${x.count}`}/>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {gradeBreakdown.map(x=>(
                  <div key={x.g} className="text-center">
                    <p style={{color:x.color}} className="font-black text-lg">{x.count}</p>
                    <p style={{color:t.sub}} className="text-[10px] font-semibold">Grade {x.g}</p>
                  </div>
                ))}
              </div>
            </Card>}
            {/* Controls */}
            <div className="flex items-center justify-between">
              <Pill dm={dm} c="sky">{fQC.length} records</Pill>
              <div className="flex gap-2">
                {can("qc_export")&& <Btn dm={dm} v="outline" size="sm" onClick={()=>exportCSV(qcLogs,"qc_logs",[{label:"Product",key:"product"},{label:"Grade",key:"grade"},{label:"Shift",key:"shift"},{label:"Date",key:"date"},{label:"Checker",key:"checker"},{label:"Notes",key:"notes"}])}>CSV</Btn>}
                <Btn dm={dm} size="sm" onClick={()=>{setQcF({product:"",shift:(settings?.shifts||["Morning"])[0],date:today(),grade:"A",notes:"",checker:displayName});setQcSh("add");}}>+ QC Check</Btn>
              </div>
            </div>
            <Search dm={dm} value={srch} onChange={setSrch} placeholder="Search product, grade, checker…"/>
            {fQC.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-8">No QC logs yet. Tap + QC Check to start.</p>}
            {fQC.map(q=>(
              <Card key={q.id} dm={dm}><div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div style={{background:gradeColor(q.grade)+"20",color:gradeColor(q.grade),width:40,height:40,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:18,flexShrink:0}}>{q.grade}</div>
                    <div>
                      <p style={{color:t.text}} className="font-bold text-sm">{q.product}</p>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                        <span style={{color:t.sub}} className="text-xs">📅 {q.date}</span>
                        <span style={{color:t.sub}} className="text-xs">🕐 {q.shift}</span>
                        {q.checker&&<span style={{color:t.sub}} className="text-xs">👤 {q.checker}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span style={{background:gradeColor(q.grade)+"20",color:gradeColor(q.grade),borderRadius:8,padding:"2px 8px",fontSize:10,fontWeight:700}}>{GRADES.find(x=>x.g===q.grade)?.label||q.grade}</span>
                    {can("qc_delete")&& <button onClick={()=>delQC(q)} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-red-600 text-white">Del</button>}
                  </div>
                </div>
                {q.notes&&<p style={{color:t.sub,background:t.inp,borderRadius:10,padding:"8px 12px",marginTop:10}} className="text-xs">"{q.notes}"</p>}
              </div></Card>
            ))}
          </>;
        })()}

        {/* GPS TAB */}
        {tab==="GPS"&&(()=>{
          const ACTION_META={
            session_start:    {label:"Session Start",    color:"#6366f1", icon:"🔓"},
            delivery_saved:   {label:"Delivery Saved",   color:"#f59e0b", icon:"💾"},
            marked_transit:   {label:"In Transit",       color:"#0ea5e9", icon:"🚚"},
            marked_delivered: {label:"Delivered",        color:"#10b981", icon:"✅"},
            wastage_logged:   {label:"Wastage Logged",   color:"#f97316", icon:"🗑️"},
            supply_logged:    {label:"Supply Logged",    color:"#8b5cf6", icon:"📦"},
            expense_logged:   {label:"Expense Logged",   color:"#ec4899", icon:"💸"},
            qc_logged:        {label:"QC Check",         color:"#14b8a6", icon:"🔬"},
            production_logged:{label:"Production Log",   color:"#6366f1", icon:"🏭"},
            handover_logged:  {label:"Shift Handover",   color:"#64748b", icon:"🔄"},
          };

          // ── helpers ──────────────────────────────────────────────
          const allLogs = gpsLogs||[];
          const agentUsers=[...new Set(allLogs.map(l=>l.agentId))].map(id=>{
            const l=allLogs.find(x=>x.agentId===id);
            return {id,name:l?.agentName||id};
          });
          const startOfToday=new Date(); startOfToday.setHours(0,0,0,0);
          const startOfYesterday=new Date(startOfToday); startOfYesterday.setDate(startOfYesterday.getDate()-1);
          const startOfWeek=new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate()-7);
          const startOfMonth=new Date(startOfToday); startOfMonth.setDate(1);
          function passesDate(l){
            if(gpsDateFilter==="all") return true;
            if(gpsDateFilter==="today") return l.ts>=startOfToday.getTime();
            if(gpsDateFilter==="yesterday") return l.ts>=startOfYesterday.getTime()&&l.ts<startOfToday.getTime();
            if(gpsDateFilter==="week") return l.ts>=startOfWeek.getTime();
            if(gpsDateFilter==="month") return l.ts>=startOfMonth.getTime();
            return true;
          }
          const filtered=allLogs
            .filter(l=>gpsFilter==="all"||l.agentId===gpsFilter)
            .filter(l=>gpsActionFilter==="all"||l.action===gpsActionFilter)
            .filter(passesDate);
          const logsWithGps=filtered.filter(l=>l.lat&&l.lng);

          // per-agent stats (always from allLogs unfiltered for Overview cards)
          const agentSummary=agentUsers.map(a=>{
            const aLogs=allLogs.filter(l=>l.agentId===a.id&&l.lat&&l.lng);
            const todayLogs=aLogs.filter(l=>l.ts>=startOfToday.getTime());
            const lastLog=aLogs[0];
            const lastTodayLog=todayLogs[0];
            const firstToday=todayLogs[todayLogs.length-1];
            const delivCount=aLogs.filter(l=>l.action==="marked_delivered").length;
            const transitCount=aLogs.filter(l=>l.action==="marked_transit").length;
            const sessionCount=aLogs.filter(l=>l.action==="session_start").length;
            const delivToday=todayLogs.filter(l=>l.action==="marked_delivered").length;
            // rough active duration today: last today ping - first today ping (minutes)
            const activeMins=firstToday&&lastTodayLog&&todayLogs.length>1?Math.round((lastTodayLog.ts-firstToday.ts)/60000):null;
            return {a,lastLog,firstToday,delivCount,transitCount,sessionCount,delivToday,activeMins,total:aLogs.length,todayTotal:todayLogs.length};
          });

          // daily breakdown for report view
          function getDailyBreakdown(){
            const map={};
            logsWithGps.forEach(l=>{
              // Use ISO date string (YYYY-MM-DD) as key to avoid toLocaleDateString
              // locale inconsistencies across devices splitting same day into multiple groups.
              const isoKey=new Date(l.ts).toISOString().slice(0,10);
              const displayDate=new Date(l.ts).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric",timeZone:"Asia/Kolkata"});
              if(!map[isoKey]) map[isoKey]={date:displayDate,isoKey,ts:l.ts,entries:[],agents:new Set(),delivered:0,transit:0,sessions:0};
              map[isoKey].entries.push(l);
              map[isoKey].agents.add(l.agentName);
              if(l.action==="marked_delivered") map[isoKey].delivered++;
              if(l.action==="marked_transit") map[isoKey].transit++;
              if(l.action==="session_start") map[isoKey].sessions++;
            });
            return Object.values(map).sort((a,b)=>b.isoKey.localeCompare(a.isoKey));
          }

          // exports
          function exportGpsCSV(){
            const rows=[["#","Agent","Role","Action","Detail / Customer","Date","Time","Latitude","Longitude","Accuracy (m)","Speed (km/h)","Heading (°)","Google Maps"]];
            logsWithGps.forEach((l,i)=>{
              const m=ACTION_META[l.action]||{label:l.action};
              const d=new Date(l.ts);
              rows.push([i+1,l.agentName,l.agentRole||"agent",m.label,l.customer||"—",
                d.toLocaleDateString("en-IN"),d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),
                l.lat,l.lng,l.acc,l.speed!=null?l.speed:"",l.heading!=null?l.heading:"",`https://maps.google.com/?q=${l.lat},${l.lng}`]);
            });
            const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
            const blob=new Blob([csv],{type:"text/csv"});
            const url=URL.createObjectURL(blob);
            const a=document.createElement("a"); a.href=url; a.download=`gps_trail_${today()}.csv`; a.click();
            URL.revokeObjectURL(url);
            notify("Exported ✓");
          }

          function printReport(){
            const dateLabel=gpsDateFilter==="today"?"Today":gpsDateFilter==="yesterday"?"Yesterday":gpsDateFilter==="week"?"Last 7 Days":gpsDateFilter==="month"?"This Month":"All Time";
            const agentLabel=gpsFilter==="all"?"All Agents":(agentUsers.find(a=>a.id===gpsFilter)?.name||"");
            const rows=logsWithGps.map((l,i)=>{
              const m=ACTION_META[l.action]||{label:l.action};
              const d=new Date(l.ts);
              return `<tr style="border-bottom:1px solid #e5e7eb">
                <td style="padding:6px 10px;font-size:12px;color:#6b7280">${i+1}</td>
                <td style="padding:6px 10px;font-size:12px;font-weight:600">${l.agentName}</td>
                <td style="padding:6px 10px;font-size:12px"><span style="background:${m.color}20;color:${m.color};padding:2px 8px;border-radius:5px;font-weight:700;font-size:11px">${m.icon} ${m.label}</span></td>
                <td style="padding:6px 10px;font-size:12px">${l.customer||"—"}</td>
                <td style="padding:6px 10px;font-size:12px">${d.toLocaleDateString("en-IN")}</td>
                <td style="padding:6px 10px;font-size:12px">${d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</td>
                <td style="padding:6px 10px;font-size:12px;color:#6b7280">${l.lat.toFixed(5)}, ${l.lng.toFixed(5)}</td>
                <td style="padding:6px 10px;font-size:12px;color:#6b7280">±${l.acc}m</td>
                <td style="padding:6px 10px;font-size:12px;color:#6b7280">${l.speed!=null?l.speed+" km/h":"—"}</td>
                <td style="padding:6px 10px;font-size:12px;color:#6b7280">${l.heading!=null?l.heading+"°":"—"}</td>
                <td style="padding:6px 10px;font-size:12px"><a href="https://maps.google.com/?q=${l.lat},${l.lng}" style="color:#0ea5e9;font-weight:600">View ↗</a></td>
              </tr>`;
            }).join("");
            const html=`<!DOCTYPE html><html><head><title>GPS Location Report — ${settings?.appName||"TAS"}</title>
            <style>body{font-family:system-ui,sans-serif;padding:32px;color:#111}h1{font-size:20px;font-weight:800;margin:0}h2{font-size:13px;color:#6b7280;font-weight:500;margin:4px 0 24px}table{width:100%;border-collapse:collapse}th{background:#f9fafb;padding:8px 10px;font-size:11px;font-weight:700;text-align:left;color:#374151;border-bottom:2px solid #e5e7eb}@media print{a{color:#0ea5e9}}</style>
            </head><body>
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
              <div><h1>📍 GPS Location Report</h1><h2>${settings?.appName||"TAS Healthy World"} · ${settings?.companySubtitle||""} · Generated ${ts()}</h2></div>
              <div style="text-align:right;font-size:12px;color:#6b7280"><b>Period:</b> ${dateLabel}<br/><b>Agent:</b> ${agentLabel}<br/><b>Total entries:</b> ${logsWithGps.length}</div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
              ${[
                {l:"Total Pings",v:logsWithGps.length,c:"#6366f1"},
                {l:"Delivered",v:logsWithGps.filter(x=>x.action==="marked_delivered").length,c:"#10b981"},
                {l:"In Transit",v:logsWithGps.filter(x=>x.action==="marked_transit").length,c:"#0ea5e9"},
                {l:"Sessions",v:logsWithGps.filter(x=>x.action==="session_start").length,c:"#f59e0b"},
              ].map(s=>`<div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px 16px"><p style="color:${s.c};font-size:22px;font-weight:800;margin:0">${s.v}</p><p style="color:#6b7280;font-size:11px;margin:2px 0 0;font-weight:600">${s.l}</p></div>`).join("")}
            </div>
            <table><thead><tr><th>#</th><th>Agent</th><th>Action</th><th>Detail</th><th>Date</th><th>Time</th><th>Coordinates</th><th>Accuracy</th><th>Speed</th><th>Heading</th><th>Map</th></tr></thead>
            <tbody>${rows}</tbody></table>
            <p style="margin-top:24px;font-size:11px;color:#9ca3af">Confidential · ${settings?.companyName||"TAS Healthy World"} · This report was auto-generated from the Operations CRM</p>
            </body></html>`;
            const w=window.open("","_blank"); w.document.write(html); w.document.close(); w.print();
          }

          // sub-nav sections
          const GPS_SECTIONS=[
            {id:"overview",label:"Overview",icon:"📊"},
            {id:"map",label:"Live Map",icon:"🗺"},
            {id:"timeline",label:"Audit Log",icon:"📋"},
            {id:"report",label:"Daily Report",icon:"📄"},
          ];
          const gpsSection = gpsSubSection||"overview";

          return <>
            {/* ── Page header ── */}
            <div style={{borderBottom:`1px solid ${t.border}`,paddingBottom:12,marginBottom:4}}>
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <p style={{color:t.text}} className="font-black text-lg tracking-tight">📍 Location Intelligence</p>
                  <p style={{color:t.sub}} className="text-[11px] mt-0.5">Real-time agent tracking · Full audit trail · GPS-verified delivery records</p>
                </div>
                {isAdmin&&logsWithGps.length>0&&<div className="flex gap-2">
                  <button onClick={exportGpsCSV} style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:9,padding:"6px 13px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ CSV</button>
                  <button onClick={printReport} style={{background:"#6366f1",color:"#fff",borderRadius:9,padding:"6px 13px",fontSize:11,fontWeight:700,border:"none",cursor:"pointer"}}>🖨 Print Report</button>
                </div>}
              </div>
              {/* sub-nav */}
              {isAdmin&&<div className="flex gap-1 mt-3 overflow-x-auto scrollbar-hide">
                {GPS_SECTIONS.map(s=>(
                  <button key={s.id} onClick={()=>setGpsSubSection(s.id)}
                    style={{background:gpsSection===s.id?"#6366f1":t.inp,color:gpsSection===s.id?"#fff":t.sub,border:`1px solid ${gpsSection===s.id?"#6366f1":t.border}`,borderRadius:9,padding:"5px 13px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
                    {s.icon} {s.label}
                  </button>
                ))}
              </div>}
            </div>

            {/* ══ OVERVIEW ══ */}
            {(gpsSection==="overview"||!isAdmin)&&<>
              {/* KPI strip */}
              {isAdmin&&<div className="grid grid-cols-2 gap-3">
                {[
                  {label:"Total GPS Pings",val:allLogs.filter(l=>l.lat&&l.lng).length,sub:"all time",color:"#6366f1",icon:"📡"},
                  {label:"Deliveries Confirmed",val:allLogs.filter(l=>l.action==="marked_delivered").length,sub:"GPS-verified",color:"#10b981",icon:"✅"},
                  {label:"Active Today",val:allLogs.filter(l=>l.ts>=startOfToday.getTime()&&l.lat&&l.lng).length,sub:"pings today",color:"#f59e0b",icon:"🔥"},
                  {label:"Agents Tracked",val:agentUsers.length,sub:"with GPS data",color:"#0ea5e9",icon:"👥"},
                ].map(k=>(
                  <div key={k.label} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:"14px 16px"}}>
                    <div className="flex items-center justify-between mb-1">
                      <p style={{color:t.sub}} className="text-[10px] font-bold uppercase tracking-widest">{k.label}</p>
                      <span style={{fontSize:16}}>{k.icon}</span>
                    </div>
                    <p style={{color:k.color}} className="text-2xl font-black">{k.val}</p>
                    <p style={{color:t.sub}} className="text-[10px] mt-0.5">{k.sub}</p>
                  </div>
                ))}
              </div>}

              {/* Agent cards */}
              {isAdmin&&agentSummary.length>0&&<>
                <p style={{color:t.sub}} className="text-[10px] font-bold uppercase tracking-widest mt-1">Agent Status</p>
                <div className="flex flex-col gap-3">
                  {agentSummary.map(({a,lastLog,delivCount,transitCount,sessionCount,delivToday,activeMins,total,todayTotal})=>{
                    const isActiveToday=todayTotal>0;
                    return <Card key={a.id} dm={dm}><div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div style={{background:"#6366f120",color:"#6366f1",width:40,height:40,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,flexShrink:0}}>
                            {a.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                          </div>
                          <div>
                            <p style={{color:t.text}} className="text-sm font-bold">{a.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span style={{width:6,height:6,borderRadius:"50%",background:isActiveToday?"#10b981":"#6b7280",display:"inline-block"}}/>
                              <p style={{color:isActiveToday?"#10b981":t.sub}} className="text-[10px] font-semibold">{isActiveToday?"Active today":"No activity today"}</p>
                            </div>
                          </div>
                        </div>
                        <button onClick={()=>ask(`Clear all GPS logs for ${a.name}?`,()=>{setGpsLogs(p=>p.filter(l=>l.agentId!==a.id));notify(`Logs cleared for ${a.name}`);})}
                          style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"3px 10px",fontSize:10,fontWeight:600,cursor:"pointer"}}>Clear</button>
                      </div>
                      {/* stat row */}
                      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
                        {[
                          {l:"Total Pings",v:total,c:"#6366f1"},
                          {l:"Delivered",v:delivCount,c:"#10b981"},
                          {l:"In Transit",v:transitCount,c:"#0ea5e9"},
                          {l:"Sessions",v:sessionCount,c:"#f59e0b"},
                        ].map(s=>(
                          <div key={s.l} style={{background:t.inp,borderRadius:10,padding:"8px 6px",textAlign:"center"}}>
                            <p style={{color:s.c}} className="text-base font-black">{s.v}</p>
                            <p style={{color:t.sub}} className="text-[9px] font-semibold">{s.l}</p>
                          </div>
                        ))}
                      </div>
                      {/* today row */}
                      <div style={{background:t.inp,borderRadius:10,padding:"8px 12px",marginBottom:10}} className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p style={{color:t.sub}} className="text-[10px] font-bold uppercase tracking-widest">Today</p>
                          <p style={{color:t.text}} className="text-xs font-semibold mt-0.5">{delivToday} deliveries · {todayTotal} pings{activeMins!==null?` · ~${activeMins}min active`:""}</p>
                        </div>
                        {lastLog&&<a href={mapU("",lastLog.lat,lastLog.lng)} target="_blank" rel="noopener noreferrer"
                          style={{background:"#0ea5e915",color:"#0ea5e9",borderRadius:8,padding:"4px 11px",fontSize:11,fontWeight:700,textDecoration:"none"}}>Last location ↗</a>}
                      </div>
                      {lastLog&&<p style={{color:t.sub}} className="text-[10px]">Last ping: <span style={{color:t.text,fontWeight:600}}>{lastLog.tsDisplay}</span> · ±{lastLog.acc}m accuracy · {lastLog.lat?.toFixed(5)}, {lastLog.lng?.toFixed(5)}</p>}
                    </div></Card>;
                  })}
                </div>
              </>}

              {agentSummary.length===0&&<div className="flex flex-col items-center gap-2 py-14">
                <span className="text-5xl">📡</span>
                <p style={{color:t.sub}} className="text-sm font-semibold">No agent data yet</p>
                <p style={{color:t.sub}} className="text-[11px] text-center max-w-xs">GPS is captured automatically when delivery agents log in and take actions</p>
              </div>}

              {/* agent self-view */}
              {can("gps_track")&&!isAdmin&&(
                <div style={{background:t.inp,border:`1px solid ${t.border}`,borderRadius:14,padding:"14px 16px"}}>
                  <p style={{color:t.text}} className="text-sm font-bold mb-1">📡 Location Tracking Active</p>
                  <p style={{color:t.sub}} className="text-[11px]">Your location is automatically captured when you log in, save deliveries, dispatch or mark delivered. No action needed from your end.</p>
                </div>
              )}
            </>}

            {/* ══ MAP ══ */}
            {gpsSection==="map"&&isAdmin&&<>
              {/* filters */}
              <div className="flex gap-2 flex-wrap">
                <select value={gpsFilter} onChange={e=>setGpsFilter(e.target.value)}
                  style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:10,padding:"6px 12px",fontSize:12,outline:"none",flex:1,minWidth:100}}>
                  <option value="all">All agents</option>
                  {agentUsers.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <select value={gpsActionFilter} onChange={e=>setGpsActionFilter(e.target.value)}
                  style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:10,padding:"6px 12px",fontSize:12,outline:"none",flex:1,minWidth:100}}>
                  <option value="all">All actions</option>
                  {Object.entries(ACTION_META).map(([k,m])=><option key={k} value={k}>{m.icon} {m.label}</option>)}
                </select>
                <select value={gpsDateFilter} onChange={e=>setGpsDateFilter(e.target.value)}
                  style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:10,padding:"6px 12px",fontSize:12,outline:"none",flex:1,minWidth:100}}>
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">Last 7 days</option>
                  <option value="month">This month</option>
                </select>
              </div>
              {/* stats */}
              <div className="flex gap-2 flex-wrap">
                {[
                  {label:"Showing",val:logsWithGps.length+" pins",color:t.text},
                  {label:"Delivered",val:logsWithGps.filter(l=>l.action==="marked_delivered").length,color:"#10b981"},
                  {label:"In Transit",val:logsWithGps.filter(l=>l.action==="marked_transit").length,color:"#0ea5e9"},
                  {label:"Sessions",val:logsWithGps.filter(l=>l.action==="session_start").length,color:"#6366f1"},
                ].map(s=>(
                  <div key={s.label} style={{background:t.inp,border:`1px solid ${t.border}`,borderRadius:10,padding:"6px 14px",flex:1,minWidth:60,textAlign:"center"}}>
                    <p style={{color:s.color}} className="text-sm font-black">{s.val}</p>
                    <p style={{color:t.sub}} className="text-[10px] font-semibold">{s.label}</p>
                  </div>
                ))}
              </div>
              {/* map + legend */}
              <Card dm={dm}><div className="p-4">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <p style={{color:t.text}} className="font-bold text-sm">🗺 GPS Trail Map</p>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(ACTION_META).filter(([k])=>logsWithGps.some(l=>l.action===k)).map(([k,m])=>(
                      <span key={k} className="flex items-center gap-1" style={{fontSize:10,color:t.sub,fontWeight:600}}>
                        <span style={{width:8,height:8,borderRadius:"50%",background:m.color,display:"inline-block"}}/>
                        {m.label}
                      </span>
                    ))}
                  </div>
                </div>
                <GPSMap dm={dm} logs={logsWithGps} actionMeta={ACTION_META} fallbackLat={settings?.weatherLat||15.4909} fallbackLng={settings?.weatherLng||73.8278}/>
                {logsWithGps.length===0&&<p style={{color:t.sub,textAlign:"center",paddingTop:12,fontSize:12}}>No GPS data matches current filters</p>}
              </div></Card>
            </>}

            {/* ══ AUDIT LOG ══ */}
            {gpsSection==="timeline"&&isAdmin&&<>
              {/* filters */}
              <div className="flex gap-2 flex-wrap">
                <select value={gpsFilter} onChange={e=>setGpsFilter(e.target.value)}
                  style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:10,padding:"6px 12px",fontSize:12,outline:"none",flex:1,minWidth:100}}>
                  <option value="all">All agents</option>
                  {agentUsers.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <select value={gpsActionFilter} onChange={e=>setGpsActionFilter(e.target.value)}
                  style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:10,padding:"6px 12px",fontSize:12,outline:"none",flex:1,minWidth:100}}>
                  <option value="all">All actions</option>
                  {Object.entries(ACTION_META).map(([k,m])=><option key={k} value={k}>{m.icon} {m.label}</option>)}
                </select>
                <select value={gpsDateFilter} onChange={e=>setGpsDateFilter(e.target.value)}
                  style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:10,padding:"6px 12px",fontSize:12,outline:"none",flex:1,minWidth:100}}>
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">Last 7 days</option>
                  <option value="month">This month</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <p style={{color:t.sub}} className="text-[11px] font-semibold">{logsWithGps.length} entries</p>
                {logsWithGps.length>0&&<button onClick={exportGpsCSV} style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:9,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ Export CSV</button>}
              </div>
              {logsWithGps.length===0
                ?<div className="flex flex-col items-center gap-2 py-12">
                  <span className="text-4xl">🔍</span>
                  <p style={{color:t.sub}} className="text-sm">No entries match filters</p>
                </div>
                :logsWithGps.map(l=>{
                  const m=ACTION_META[l.action]||{label:l.action,color:"#6b7280",icon:"📍"};
                  const d=new Date(l.ts);
                  return <Card key={l.id} dm={dm}><div className="p-3.5 flex items-start gap-3">
                    <div style={{background:m.color+"18",color:m.color,width:38,height:38,borderRadius:11,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{m.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p style={{color:t.text}} className="text-sm font-bold">{l.agentName}</p>
                        <span style={{background:m.color+"18",color:m.color,borderRadius:6,padding:"1px 8px",fontSize:10,fontWeight:700}}>{m.label}</span>
                      </div>
                      {l.customer&&<p style={{color:t.text}} className="text-xs font-medium">📦 {l.customer}</p>}
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <p style={{color:t.sub}} className="text-[10px]">📅 {d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</p>
                        <p style={{color:t.sub}} className="text-[10px]">🕐 {d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</p>
                        <p style={{color:t.sub}} className="text-[10px]">📍 {l.lat?.toFixed(5)}, {l.lng?.toFixed(5)}</p>
                        <p style={{color:t.sub}} className="text-[10px]">🎯 ±{l.acc}m</p>
                        {l.speed!=null&&<p style={{color:t.sub}} className="text-[10px]">💨 {l.speed}km/h</p>}
                        {l.heading!=null&&<p style={{color:t.sub}} className="text-[10px]">🧭 {l.heading}°</p>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 items-end flex-shrink-0">
                      <a href={mapU("",l.lat,l.lng)} target="_blank" rel="noopener noreferrer"
                        style={{background:"#0ea5e915",color:"#0ea5e9",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,textDecoration:"none"}}>Maps ↗</a>
                      <button onClick={()=>ask("Delete this entry?",()=>{setGpsLogs(p=>p.filter(x=>x.id!==l.id));notify("Deleted");})}
                        style={{background:"none",border:"none",color:t.sub,fontSize:10,cursor:"pointer",padding:"2px 4px"}}>✕ remove</button>
                    </div>
                  </div></Card>;
                })
              }
            </>}

            {/* ══ DAILY REPORT ══ */}
            {gpsSection==="report"&&isAdmin&&<>
              <div className="flex gap-2 flex-wrap">
                <select value={gpsFilter} onChange={e=>setGpsFilter(e.target.value)}
                  style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:10,padding:"6px 12px",fontSize:12,outline:"none",flex:1,minWidth:100}}>
                  <option value="all">All agents</option>
                  {agentUsers.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <select value={gpsDateFilter} onChange={e=>setGpsDateFilter(e.target.value)}
                  style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:10,padding:"6px 12px",fontSize:12,outline:"none",flex:1,minWidth:120}}>
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">Last 7 days</option>
                  <option value="month">This month</option>
                </select>
                {logsWithGps.length>0&&<button onClick={printReport}
                  style={{background:"#6366f1",color:"#fff",border:"none",borderRadius:10,padding:"6px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}}>🖨 Print / PDF</button>}
              </div>

              {getDailyBreakdown().length===0
                ?<div className="flex flex-col items-center gap-2 py-12"><span className="text-4xl">📄</span><p style={{color:t.sub}} className="text-sm">No data for selected period</p></div>
                :getDailyBreakdown().map(day=>(
                  <Card key={day.date} dm={dm}><div className="p-4">
                    {/* day header */}
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div>
                        <p style={{color:t.text}} className="text-sm font-black">{day.date}</p>
                        <p style={{color:t.sub}} className="text-[10px]">{[...day.agents].join(", ")}</p>
                      </div>
                      <div className="flex gap-2">
                        <span style={{background:"#10b98118",color:"#10b981",borderRadius:7,padding:"2px 9px",fontSize:10,fontWeight:700}}>✅ {day.delivered} delivered</span>
                        <span style={{background:"#0ea5e918",color:"#0ea5e9",borderRadius:7,padding:"2px 9px",fontSize:10,fontWeight:700}}>🚚 {day.transit} transit</span>
                        <span style={{background:"#6366f118",color:"#6366f1",borderRadius:7,padding:"2px 9px",fontSize:10,fontWeight:700}}>🔓 {day.sessions} sessions</span>
                      </div>
                    </div>
                    {/* entries for this day */}
                    <div className="flex flex-col gap-0">
                      {day.entries.map((l,i)=>{
                        const m=ACTION_META[l.action]||{label:l.action,color:"#6b7280",icon:"📍"};
                        const d=new Date(l.ts);
                        const isLast=i===day.entries.length-1;
                        return <div key={l.id} className="flex items-start gap-2.5" style={{paddingBottom:isLast?0:8}}>
                          {/* timeline dot + line */}
                          <div className="flex flex-col items-center" style={{paddingTop:2,flexShrink:0}}>
                            <div style={{width:8,height:8,borderRadius:"50%",background:m.color,flexShrink:0}}/>
                            {!isLast&&<div style={{width:1,flex:1,background:t.border,minHeight:16,marginTop:2}}/>}
                          </div>
                          <div className="flex-1 min-w-0 pb-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p style={{color:t.text}} className="text-xs font-semibold">{l.agentName}</p>
                              <span style={{background:m.color+"18",color:m.color,borderRadius:5,padding:"0px 6px",fontSize:9,fontWeight:700}}>{m.icon} {m.label}</span>
                              {l.customer&&<span style={{color:t.sub}} className="text-[10px]">· {l.customer}</span>}
                            </div>
                            <div className="flex gap-3 mt-0.5 flex-wrap">
                              <p style={{color:t.sub}} className="text-[10px]">{d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</p>
                              <a href={mapU("",l.lat,l.lng)} target="_blank" rel="noopener noreferrer" style={{color:"#0ea5e9",fontSize:10,fontWeight:600,textDecoration:"none"}}>📍 {l.lat?.toFixed(4)}, {l.lng?.toFixed(4)} ↗</a>
                              <p style={{color:t.sub}} className="text-[10px]">±{l.acc}m</p>
                            </div>
                          </div>
                        </div>;
                      })}
                    </div>
                  </div></Card>
                ))
              }
            </>}

            {/* ── Danger zone ── */}
            {isAdmin&&(gpsLogs||[]).length>0&&gpsSection==="overview"&&<div style={{borderTop:`1px solid ${t.border}`,paddingTop:12}}>
              <div className="flex items-center justify-between">
                <p style={{color:t.sub}} className="text-[10px] font-bold uppercase tracking-widest">Danger Zone</p>
                <button onClick={()=>ask("Clear ALL GPS logs permanently? This cannot be undone.",()=>{setGpsLogs([]);notify("All GPS logs cleared");})}
                  style={{background:"#ef444410",color:"#ef4444",border:`1px solid #ef444430`,borderRadius:10,padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                  🗑 Clear all GPS logs
                </button>
              </div>
            </div>}
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
            {id:"notifications",icon:"🔔",label:"Notifications"},
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
            const factoryUsers=users.filter(u=>u.role==="factory");
            const agentUsers=users.filter(u=>u.role==="agent");
            const sectionColors={Customers:"#0ea5e9",Deliveries:"#f59e0b",Supplies:"#8b5cf6",Wastage:"#f97316",Production:"#6366f1",QC:"#14b8a6",Dashboard:"#10b981",GPS:"#22c55e",Data:"#64748b"};
            // Role default finePerms stored in settings
            const factoryFpDef = settings?.factoryFinePermsDef || defaultFinePerms("factory");
            const agentFpDef   = settings?.agentFinePermsDef   || defaultFinePerms("agent");
            const factoryTabDef= settings?.factoryDefaultPerms || ROLE_DEF.factory;
            const agentTabDef  = settings?.agentDefaultPerms   || ROLE_DEF.agent;

            function RoleDefaultsCard({role,color,emoji,title,subtitle,tabDef,fpDef,tabDefKey,fpDefKey,accounts}){
              const [openSec,setOpenSec]=useState(null);
              return <Card dm={dm} className="overflow-hidden">
                <div className="p-4 pb-3" style={{borderBottom:`1px solid ${t.border}`}}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div style={{background:color+"22",color}} className="w-9 h-9 rounded-xl flex items-center justify-center text-lg">{emoji}</div>
                      <div>
                        <p style={{color:t.text}} className="text-sm font-bold">{title}</p>
                        <p style={{color:t.sub}} className="text-[11px]">{accounts.length} account{accounts.length!==1?"s":""} · {subtitle}</p>
                      </div>
                    </div>
                    <Btn dm={dm} size="sm" onClick={()=>{setUf({...blkU(),role,permissions:[...tabDef],finePerms:{...fpDef}});setUsh("add");}}>+ Add</Btn>
                  </div>
                </div>
                {/* Existing accounts */}
                {accounts.length>0&&<div className="px-4 pt-3 pb-1">
                  <p style={{color:t.sub}} className="text-[11px] font-bold uppercase tracking-wider mb-2">Accounts</p>
                  {accounts.map(u=>(
                    <div key={u.id} className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`}}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div style={{background:color+"22",color}} className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black shrink-0">{u.name.charAt(0).toUpperCase()}</div>
                        <div className="min-w-0">
                          <p style={{color:t.text}} className="text-xs font-semibold truncate">{u.name}</p>
                          <p style={{color:t.sub}} className="text-[10px]">@{u.username} · <span className={u.active?"text-emerald-500":"text-red-400"}>{u.active?"Active":"Inactive"}</span></p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={()=>{setUf({...u,password:""});setUsh(u);}} style={{background:t.inp,color:t.text}} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg">Edit</button>
                        <button onClick={()=>delU(u)} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-red-600 text-white">Del</button>
                      </div>
                    </div>
                  ))}
                </div>}
                {/* Default tab access */}
                <div className="px-4 py-3" style={{borderTop:`1px solid ${t.border}`}}>
                  <p style={{color:t.sub}} className="text-[11px] font-bold uppercase tracking-wider mb-2">Default accessible sections (for new accounts)</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ALL_TABS.filter(tb=>tb!=="Settings").map(tb=>{
                      const on=tabDef.includes(tb);
                      const icons={"Dashboard":"📊","Customers":"👥","Deliveries":"🚚","Supplies":"📦","Expenses":"💸","Wastage":"🗑️","P&L":"📈","Analytics":"🔍","Production":"🏭","QC":"✅"};
                      return <button key={tb} onClick={()=>{
                          const next=on?tabDef.filter(x=>x!==tb):[...tabDef,tb];
                          setSettings(s=>({...s,[tabDefKey]:next}));
                        }}
                        style={{background:on?color+"18":t.card,border:`1.5px solid ${on?color:t.border}`,borderRadius:10,padding:"7px 10px",display:"flex",alignItems:"center",gap:7,textAlign:"left",transition:"all 0.15s"}}>
                        <span style={{fontSize:14}}>{icons[tb]||"•"}</span>
                        <span style={{color:on?color:t.sub,fontSize:11,fontWeight:700,flex:1}}>{tb}</span>
                        <span style={{width:7,height:7,borderRadius:"50%",background:on?color:"transparent",border:`2px solid ${on?color:t.border}`,flexShrink:0}}/>
                      </button>;
                    })}
                  </div>
                </div>
                {/* Default fine perms by section */}
                <div className="px-4 pb-3" style={{borderTop:`1px solid ${t.border}`}}>
                  <p style={{color:t.sub}} className="text-[11px] font-bold uppercase tracking-wider mt-3 mb-2">Default action permissions (for new accounts)</p>
                  <p style={{color:t.sub}} className="text-[10px] mb-3">These apply when creating a new account of this role. Existing accounts keep their own settings.</p>
                  {[...new Set(FINE_PERM_DEFS.map(d=>d.section))].map(sec=>{
                    const perms=FINE_PERM_DEFS.filter(d=>d.section===sec);
                    const sc=sectionColors[sec]||"#6b7280";
                    const allOn=perms.every(d=>fpDef[d.key]);
                    const anyOn=perms.some(d=>fpDef[d.key]);
                    const isOpen=openSec===sec;
                    return <div key={sec} style={{border:`1px solid ${t.border}`,borderRadius:12,marginBottom:6,overflow:"hidden"}}>
                      <button onClick={()=>setOpenSec(isOpen?null:sec)} style={{width:"100%",padding:"9px 12px",display:"flex",alignItems:"center",gap:8,background:"transparent",border:"none",cursor:"pointer",textAlign:"left"}}>
                        <div style={{width:7,height:7,borderRadius:"50%",background:allOn?sc:anyOn?sc+"88":"transparent",border:`2px solid ${allOn?sc:sc+"44"}`,flexShrink:0}}/>
                        <p style={{color:t.text,fontWeight:700,fontSize:12,flex:1}}>{sec}</p>
                        <span style={{color:t.sub,fontSize:10}}>{perms.filter(d=>fpDef[d.key]).length}/{perms.length} on</span>
                        <span style={{color:t.sub,fontSize:11}}>{isOpen?"▲":"▼"}</span>
                      </button>
                      {isOpen&&<div style={{borderTop:`1px solid ${t.border}`}}>
                        <div style={{padding:"6px 12px",display:"flex",justifyContent:"flex-end",gap:8,borderBottom:`1px solid ${t.border}`}}>
                          <button onClick={()=>{const upd={...fpDef};perms.forEach(d=>{upd[d.key]=true;});setSettings(s=>({...s,[fpDefKey]:upd}));}} style={{fontSize:10,fontWeight:700,color:sc,background:sc+"18",border:`1px solid ${sc+"44"}`,borderRadius:6,padding:"3px 8px",cursor:"pointer"}}>Grant all</button>
                          <button onClick={()=>{const upd={...fpDef};perms.forEach(d=>{upd[d.key]=false;});setSettings(s=>({...s,[fpDefKey]:upd}));}} style={{fontSize:10,fontWeight:700,color:t.sub,background:"transparent",border:`1px solid ${t.border}`,borderRadius:6,padding:"3px 8px",cursor:"pointer"}}>Revoke all</button>
                        </div>
                        {perms.map(({key,label,desc,icon})=>{
                          const on=fpDef[key]===true;
                          return <div key={key} style={{padding:"9px 12px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontSize:14,width:20,textAlign:"center",flexShrink:0}}>{icon}</span>
                            <div style={{flex:1,minWidth:0}}>
                              <p style={{color:on?t.text:t.sub,fontSize:11,fontWeight:600}}>{label}</p>
                              <p style={{color:t.sub,fontSize:10}}>{desc}</p>
                            </div>
                            <Tog dm={dm} on={on} onChange={()=>{setSettings(s=>({...s,[fpDefKey]:{...(s[fpDefKey]||defaultFinePerms(role)),[key]:!on}}));}}/>
                          </div>;
                        })}
                      </div>}
                    </div>;
                  })}
                </div>
              </Card>;
            }
            return <>
              <RoleDefaultsCard role="factory" color="#a855f7" emoji="🏭" title="Factory Staff" subtitle="Manages production, supplies & QC"
                tabDef={factoryTabDef} fpDef={factoryFpDef} tabDefKey="factoryDefaultPerms" fpDefKey="factoryFinePermsDef" accounts={factoryUsers}/>
              <RoleDefaultsCard role="agent" color="#0ea5e9" emoji="🚚" title="Delivery Agents" subtitle="On the road, delivering orders"
                tabDef={agentTabDef} fpDef={agentFpDef} tabDefKey="agentDefaultPerms" fpDefKey="agentFinePermsDef" accounts={agentUsers}/>
            </>;
          })()}

          {/* ── PRODUCTS ── */}

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
            <Card dm={dm}><div className="p-4 flex flex-col gap-3">
              <p style={{color:t.text}} className="text-sm font-bold">🌤 Weather Widget Location</p>
              <p style={{color:t.sub}} className="text-[11px]">Set the location for the weather widget on the Dashboard. Latitude and longitude can be found via Google Maps.</p>
              <Inp dm={dm} label="Location Label" value={settings?.weatherLabel||"Goa"} onChange={e=>setSettings(s=>({...s,weatherLabel:e.target.value}))} placeholder="Goa"/>
              <div className="grid grid-cols-2 gap-3">
                <Inp dm={dm} label="Latitude" value={settings?.weatherLat??15.4909} onChange={e=>setSettings(s=>({...s,weatherLat:+e.target.value||15.4909}))} placeholder="15.4909"/>
                <Inp dm={dm} label="Longitude" value={settings?.weatherLng??73.8278} onChange={e=>setSettings(s=>({...s,weatherLng:+e.target.value||73.8278}))} placeholder="73.8278"/>
              </div>
            </div></Card>
            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text}} className="text-sm font-bold mb-3">Dashboard Widgets</p>
              {[{key:"stats",label:"Stat Cards"},{key:"chart",label:"Revenue Chart"},{key:"pendingDeliveries",label:"Pending Deliveries"},{key:"outstanding",label:"Outstanding Payments"},{key:"wastageToday",label:"Today's Wastage"},{key:"weather",label:"🌤 Weather Widget (Goa)"},{key:"quickActions",label:"⚡ Quick Actions"},{key:"productionBar",label:"🏭 Daily Production Progress"}].map(w=>{
                const on=(settings?.dashWidgets||[]).includes(w.key);
                return <div key={w.key} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                  <span style={{color:t.text}} className="text-sm">{w.label}</span>
                  <Tog dm={dm} on={on} onChange={()=>setSettings(s=>({...s,dashWidgets:on?(s.dashWidgets||[]).filter(k=>k!==w.key):[...(s.dashWidgets||[]),w.key]}))}/>
                </div>;
              })}
            </div></Card>
            {/* Quick Actions configuration */}
            {(settings?.dashWidgets||[]).includes("quickActions")&&<Card dm={dm}><div className="p-4">
              <p style={{color:t.text}} className="text-sm font-bold mb-1">Quick Action Buttons</p>
              <p style={{color:t.sub}} className="text-[11px] mb-3">Choose which actions appear on the dashboard. Up to 8 buttons.</p>
              {[{key:"newDelivery",icon:"🚚",label:"New Delivery"},{key:"newCustomer",icon:"👤",label:"New Customer"},{key:"markDone",icon:"✅",label:"Mark Delivered"},{key:"logWastage",icon:"🗑️",label:"Log Wastage"},{key:"addExpense",icon:"💸",label:"Add Expense"},{key:"logSupply",icon:"📦",label:"Log Supply"},{key:"logProduction",icon:"🏭",label:"Log Production"},{key:"qcCheck",icon:"✅",label:"QC Check"}].map(q=>{
                const on=(settings?.quickActions||[]).includes(q.key);
                return <div key={q.key} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                  <span style={{color:t.text}} className="text-sm">{q.icon} {q.label}</span>
                  <Tog dm={dm} on={on} onChange={()=>setSettings(s=>({...s,quickActions:on?(s.quickActions||[]).filter(k=>k!==q.key):[...(s.quickActions||[]),q.key]}))}/>
                </div>;
              })}
            </div></Card>}
            {/* PIN Mode */}
            <Card dm={dm}><div className="p-4">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <p style={{color:t.text}} className="text-sm font-bold">PIN Login Mode</p>
                  <p style={{color:t.sub}} className="text-[11px] mt-0.5">Staff can log in with a 4-digit PIN instead of their password. PINs are set per user account.</p>
                </div>
                <Tog dm={dm} on={settings?.pinMode||false} onChange={()=>setSettings(s=>({...s,pinMode:!s.pinMode}))}/>
              </div>
              {settings?.pinMode&&<div style={{background:"#f59e0b10",border:"1px solid #f59e0b30",borderRadius:10,padding:"10px 12px",marginTop:12}}>
                <p style={{color:"#f59e0b"}} className="text-[11px] font-semibold">✓ PIN mode active — set PINs per user in Staff → Edit account</p>
              </div>}
            </div></Card>
          </>}

          {/* ── DATA / BACKUP ── */}
          {settingsSection==="data"&&<>
            <Card dm={dm}><div className="p-4 flex flex-col gap-3">
              <p style={{color:t.text}} className="text-sm font-bold">Backup & Restore</p>
              {(()=>{
                const daysSince=lastBackupDate?Math.round((Date.now()-new Date(lastBackupDate).getTime())/86400000):null;
                const noBackup=!lastBackupDate;
                const stale=daysSince!==null&&daysSince>=7;
                if(noBackup||stale) return <div style={{background:noBackup?"#ef444415":"#f59e0b15",border:`1px solid ${noBackup?"#ef444430":"#f59e0b30"}`,borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:16}}>{noBackup?"⚠️":"🕐"}</span>
                  <div>
                    <p style={{color:noBackup?"#ef4444":"#f59e0b",fontWeight:700,fontSize:12}}>{noBackup?"No backup recorded yet":"Last backup was "+daysSince+" days ago"}</p>
                    <p style={{color:t.sub,fontSize:11,marginTop:2}}>Export a backup below to protect your data.</p>
                  </div>
                </div>;
                return <div style={{background:"#10b98115",border:"1px solid #10b98130",borderRadius:10,padding:"8px 14px"}}>
                  <p style={{color:"#10b981",fontWeight:700,fontSize:12}}>✓ Last backup: {lastBackupDate} ({daysSince===0?"today":daysSince+"d ago"})</p>
                </div>;
              })()}
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
              {/* Audit Filters */}
              <div className="flex flex-wrap gap-2 mb-3">
                <select value={auditUserFilter} onChange={e=>setAuditUserFilter(e.target.value)}
                  style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,fontSize:11,borderRadius:8,padding:"4px 8px",outline:"none"}}>
                  <option value="all">All users</option>
                  {[...new Set(actLog.map(l=>l.user).filter(Boolean))].map(u=><option key={u}>{u}</option>)}
                </select>
                <select value={auditRoleFilter} onChange={e=>setAuditRoleFilter(e.target.value)}
                  style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,fontSize:11,borderRadius:8,padding:"4px 8px",outline:"none"}}>
                  <option value="all">All roles</option>
                  {["admin","factory","agent"].map(r=><option key={r} value={r} style={{textTransform:"capitalize"}}>{r}</option>)}
                </select>
                <input value={auditActionFilter} onChange={e=>setAuditActionFilter(e.target.value)} placeholder="Filter action…"
                  style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,fontSize:11,borderRadius:8,padding:"4px 8px",outline:"none",minWidth:100,flex:1}}/>
                {(auditUserFilter!=="all"||auditRoleFilter!=="all"||auditActionFilter)&&<button onClick={()=>{setAuditUserFilter("all");setAuditRoleFilter("all");setAuditActionFilter("");}} style={{color:"#f59e0b"}} className="text-[11px] font-semibold">Clear filters</button>}
              </div>
              {(()=>{
                const filtered=actLog.filter(l=>
                  (auditUserFilter==="all"||l.user===auditUserFilter)&&
                  (auditRoleFilter==="all"||l.role===auditRoleFilter)&&
                  (!auditActionFilter||l.action?.toLowerCase().includes(auditActionFilter.toLowerCase())||l.detail?.toLowerCase().includes(auditActionFilter.toLowerCase()))
                );
                return filtered.length===0
                  ?<p style={{color:t.sub}} className="text-xs text-center py-3">{actLog.length===0?"No activity yet.":"No entries match the filters."}</p>
                  :filtered.slice(0,200).map(l=>(
                  <div key={l.id} style={{borderBottom:`1px solid ${t.border}`}} className="py-2 last:border-0">
                    <div className="flex items-start justify-between gap-2"><span style={{color:t.text}} className="text-xs font-semibold flex-1">{l.action}</span><span style={{color:t.sub}} className="text-[10px] shrink-0">{l.user} · {l.role}</span></div>
                    <div className="flex items-start justify-between gap-2 mt-0.5"><span style={{color:t.sub}} className="text-[11px] flex-1">{l.detail}</span><span style={{color:t.sub}} className="text-[10px] shrink-0">{l.ts}</span></div>
                  </div>
                ));
              })()}
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
      <nav style={{background:t.card,borderTop:`1px solid ${t.border}`,paddingBottom:"env(safe-area-inset-bottom)",boxShadow:"0 -4px 20px rgba(0,0,0,0.08)"}} className="fixed bottom-0 left-0 right-0 z-50 flex lg:hidden">
        {TABS.slice(0,5).map(tb=>(
          <button key={tb} onClick={()=>{setTab(tb);setSrch("");setShowMoreNav(false);}} className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-all relative"
            style={{color:tab===tb?t.accent:t.sub,minHeight:56,WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>
            {tab===tb&&<span style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:32,height:2,background:t.accent,borderRadius:"0 0 4px 4px"}}/>}
            <span className="text-xl leading-none">{TAB_ICONS[tb]||"•"}</span>
            <span className="text-[10px] font-semibold leading-none mt-0.5">{tb.length>8?tb.slice(0,7)+"…":tb}</span>
          </button>
        ))}
        {TABS.length>5&&(
          <div className="flex-1 relative">
            <button onClick={()=>setShowMoreNav(v=>!v)} style={{color:TABS.slice(5).includes(tab)?t.accent:t.sub,minHeight:56,WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}} className="w-full flex flex-col items-center justify-center py-3 gap-1 transition-all relative">
              {TABS.slice(5).includes(tab)&&<span style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:32,height:2,background:t.accent,borderRadius:"0 0 4px 4px"}}/>}
              <span className="text-lg leading-none">⋯</span>
              <span className="text-[9px] font-semibold leading-none">{TABS.slice(5).includes(tab)?tab:"More"}</span>
            </button>
            {/* More menu popup — only shown when toggled */}
            {showMoreNav&&(
              <div style={{background:t.card,border:`1px solid ${t.border}`,bottom:"100%",right:0,minWidth:160,boxShadow:"0 -8px 32px rgba(0,0,0,0.15)"}} className="absolute flex flex-col rounded-2xl overflow-hidden mb-2 z-50">
                {TABS.slice(5).map(tb=>(
                  <button key={tb} onClick={()=>{setTab(tb);setSrch("");setShowMoreNav(false);}} style={{color:tab===tb?t.accent:t.text,background:tab===tb?dm?"rgba(245,158,11,0.12)":"rgba(245,158,11,0.08)":"transparent",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}} className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-left active:opacity-70 transition-opacity">
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
        <div className="flex gap-2">
          {dSh!=="add"&&can("deliv_report")&&<Btn dm={dm} v="outline" onClick={()=>exportPDF(dSh,products,"delivery",settings)} className="flex-1">🧾 Invoice</Btn>}
          <Btn dm={dm} onClick={saveD} className="flex-1">Save Delivery</Btn>
        </div>
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
        <div style={{background:t.inp,borderRadius:14,padding:"12px 14px"}}>
          <p style={{color:t.sub}} className="text-[11px] font-bold uppercase tracking-wider mb-1">Low Stock Alert</p>
          <p style={{color:t.sub}} className="text-[11px] mb-2">Get notified when stock drops to or below this level. Leave blank to disable.</p>
          <Inp dm={dm} label="Min Stock Threshold" type="number" value={sF.minStock||""} onChange={e=>setSf({...sF,minStock:e.target.value})} placeholder="e.g. 10"/>
        </div>
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
          {settings?.pinMode&&<Inp dm={dm} label="4-Digit PIN (optional)" type="number" value={uF.pin||""} onChange={e=>setUf({...uF,pin:e.target.value.slice(0,4)})} placeholder="e.g. 1234 — leave blank to disable PIN"/>}
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
        {/* ── TABS: what sections they can access ── */}
        {uF.role!=="admin"&&<div style={{background:t.inp,borderRadius:14,padding:"14px 16px"}}>
          <p style={{color:t.sub}} className="text-[11px] font-bold uppercase tracking-wider mb-1">📱 Accessible Sections</p>
          <p style={{color:t.sub}} className="text-[11px] mb-3">Which tabs/screens this person can open.</p>
          <div className="grid grid-cols-2 gap-1.5">
            {ALL_TABS.filter(tb=>tb!=="Settings").map(tb=>{
              const on=(uF.permissions||[]).includes(tb);
              const icons={"Dashboard":"📊","Customers":"👥","Deliveries":"🚚","Supplies":"📦","Expenses":"💸","Wastage":"🗑️","P&L":"📈","Analytics":"🔍","Production":"🏭","QC":"✅"};
              return <button key={tb} onClick={()=>{const p=uF.permissions||[];setUf({...uF,permissions:on?p.filter(x=>x!==tb):[...p,tb]});}}
                style={{background:on?t.accent+"22":t.card,border:`1.5px solid ${on?t.accent:t.border}`,borderRadius:10,padding:"8px 10px",display:"flex",alignItems:"center",gap:8,textAlign:"left",transition:"all 0.15s"}}>
                <span style={{fontSize:16,lineHeight:1}}>{icons[tb]||"•"}</span>
                <span style={{color:on?t.accent:t.sub,fontSize:12,fontWeight:700,flex:1}}>{tb}</span>
                <span style={{width:8,height:8,borderRadius:"50%",background:on?t.accent:"transparent",border:`2px solid ${on?t.accent:t.border}`,flexShrink:0}}/>
              </button>;
            })}
          </div>
        </div>}
        {/* ── FINE-GRAINED PERMISSIONS ── */}
        {uF.role!=="admin"&&(()=>{
          const fp = uF.finePerms || defaultFinePerms(uF.role);
          const setFp = (key,val) => setUf(f=>({...f,finePerms:{...(f.finePerms||defaultFinePerms(f.role)),[key]:val}}));
          const sections = [...new Set(FINE_PERM_DEFS.map(d=>d.section))];
          const sectionColors = {Customers:"#0ea5e9",Deliveries:"#f59e0b",Supplies:"#8b5cf6",Wastage:"#f97316",Production:"#6366f1",QC:"#14b8a6",Dashboard:"#10b981",GPS:"#22c55e",Data:"#64748b"};
          return <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <p style={{color:t.sub}} className="text-[11px] font-bold uppercase tracking-wider mt-1">⚙️ What they can do — per section</p>
            {sections.map(sec=>{
              const perms = FINE_PERM_DEFS.filter(d=>d.section===sec);
              const color = sectionColors[sec]||"#6b7280";
              const allOn = perms.every(d=>fp[d.key]);
              const anyOn = perms.some(d=>fp[d.key]);
              return <div key={sec} style={{background:t.inp,borderRadius:14,overflow:"hidden"}}>
                {/* Section header with bulk toggle */}
                <div style={{padding:"10px 14px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:allOn?color:anyOn?color+"88":"transparent",border:`2px solid ${allOn?color:color+"44"}`,flexShrink:0}}/>
                  <p style={{color:t.text,fontWeight:700,fontSize:13,flex:1}}>{sec}</p>
                  <button onClick={()=>{perms.forEach(d=>setFp(d.key,!allOn));}}
                    style={{fontSize:10,fontWeight:700,color:allOn?color:t.sub,background:allOn?color+"18":"transparent",border:`1px solid ${allOn?color+"44":t.border}`,borderRadius:6,padding:"3px 8px",cursor:"pointer"}}>
                    {allOn?"Revoke all":"Grant all"}
                  </button>
                </div>
                {/* Individual perms */}
                {perms.map(({key,label,desc,icon})=>{
                  const on=fp[key]===true;
                  return <div key={key} style={{padding:"10px 14px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:15,width:22,textAlign:"center",flexShrink:0}}>{icon}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{color:on?t.text:t.sub,fontSize:12,fontWeight:600,lineHeight:1.2}}>{label}</p>
                      <p style={{color:t.sub,fontSize:10,marginTop:2}}>{desc}</p>
                    </div>
                    <Tog dm={dm} on={on} onChange={()=>setFp(key,!on)}/>
                  </div>;
                })}
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
          {can("waste_logCost")&& <Inp dm={dm} label="Estimated Cost Loss (₹)" type="number" value={wF.cost} onChange={e=>setWF({...wF,cost:e.target.value})} placeholder="0"/>}
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
          <div className="flex gap-2 flex-wrap">{[paySh.pending,500,1000,2000].filter((v,i,a)=>v>0&&a.indexOf(v)===i).map(q=><button key={q} onClick={()=>setPayAmt(String(q))} style={payAmt===String(q)?{background:"#f59e0b",color:"#000"}:{background:t.inp,color:t.text}} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px]">₹{q.toLocaleString("en-IN")}</button>)}</div>
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

      {/* QC Sheet */}
      <Sheet dm={dm} open={!!qcSh} onClose={()=>setQcSh(null)} title="Log QC Check">
        <Sel dm={dm} label="Product *" value={qcF.product} onChange={e=>setQcF({...qcF,product:e.target.value})}>
          <option value="">— Select product —</option>
          {products.map(p=><option key={p.id}>{p.name}</option>)}
          <option value="__custom__">Other / Custom</option>
        </Sel>
        {qcF.product==="__custom__"&&<Inp dm={dm} label="Custom Product" value={qcF.customProduct||""} onChange={e=>setQcF({...qcF,customProduct:e.target.value})} placeholder="e.g. Special Paratha"/>}
        <div className="grid grid-cols-2 gap-3">
          <Sel dm={dm} label="Shift" value={qcF.shift} onChange={e=>setQcF({...qcF,shift:e.target.value})}>
            {(settings?.shifts||["Morning","Afternoon","Evening","Night"]).map(s=><option key={s}>{s}</option>)}
          </Sel>
          <Inp dm={dm} label="Date" type="date" value={qcF.date} onChange={e=>setQcF({...qcF,date:e.target.value})}/>
        </div>
        <div>
          <label style={{color:T(dm).sub}} className="block text-[11px] font-bold uppercase tracking-widest mb-2 ml-0.5">Quality Grade *</label>
          <div className="grid grid-cols-4 gap-2">
            {[{g:"A",color:"#10b981",label:"Pass",sub:"Grade A"},{g:"B",color:"#f59e0b",label:"Pass",sub:"Grade B"},{g:"C",color:"#f97316",label:"Marginal",sub:"Grade C"},{g:"F",color:"#ef4444",label:"Fail",sub:"Reject"}].map(({g,color,label,sub})=>(
              <button key={g} onClick={()=>setQcF({...qcF,grade:g})}
                style={{background:qcF.grade===g?color+"25":T(dm).inp,border:`2px solid ${qcF.grade===g?color:T(dm).inpB}`,borderRadius:14,padding:"12px 6px",textAlign:"center",transition:"all 0.15s"}}>
                <p style={{color,fontWeight:900,fontSize:22,lineHeight:1}}>{g}</p>
                <p style={{color:qcF.grade===g?color:T(dm).text,fontSize:11,fontWeight:700,marginTop:4}}>{label}</p>
                <p style={{color:T(dm).sub,fontSize:9,marginTop:1}}>{sub}</p>
              </button>
            ))}
          </div>
        </div>
        <Inp dm={dm} label="Checked By" value={qcF.checker} onChange={e=>setQcF({...qcF,checker:e.target.value})} placeholder="Inspector name"/>
        <Inp dm={dm} label="Notes / Observations" value={qcF.notes} onChange={e=>setQcF({...qcF,notes:e.target.value})} placeholder="e.g. Slightly overcooked edges, texture good…"/>
        <Btn dm={dm} onClick={saveQC} className="w-full">Save QC Record</Btn>
      </Sheet>

      <Confirm dm={dm} msg={conf?.msg} onYes={()=>{conf?.yes();setConf(null);}} onNo={()=>setConf(null)}/>
      {toast&&<Toast msg={toast} onDone={()=>setToast(null)}/>}
    </>
  );
}
