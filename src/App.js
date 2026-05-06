/* eslint-disable react-hooks/exhaustive-deps, no-unused-vars */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, Cell, ReferenceLine } from "recharts";
import { db } from "./firebase";
import { ref, onValue, set as fbSet, get as fbGet, remove as fbRemove } from "firebase/database";

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
  const [val, setRaw] = useState(null);
  const [fbLoaded, setFbLoaded] = useState(false);

  useEffect(() => {
    const r = ref(db, key);
    const unsub = onValue(r, (snap) => {
      if (_writing[key] > 0) { setFbLoaded(true); return; }
      if (snap.exists()) {
        const raw = snap.val();
        const incoming = (raw && raw.v !== undefined) ? raw.v : raw;
        setRaw(incoming);
      } else {
        const d = defRef.current;
        _writing[key] = (_writing[key]||0) + 1;
        fbWrite(key, d)
          .then(() => setTimeout(() => { _writing[key] = Math.max(0,(_writing[key]||1)-1); }, 2000))
          .catch(e => { console.warn("seed error:", e.message); _writing[key] = Math.max(0,(_writing[key]||1)-1); });
        setRaw(d);
      }
      setFbLoaded(true);
      _notifySync();
    }, (err) => {
      console.warn("Firebase error for", key, err.message);
      setFbLoaded(true);
      if(typeof window!=="undefined") window.__fbOffline=true;
    });
    return () => unsub();
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback((next) => {
    setRaw(prev => {
      const n = typeof next === "function" ? next(prev ?? defRef.current) : next;
      _writing[key] = (_writing[key]||0) + 1;
      fbWrite(key, n)
        .then(() => setTimeout(() => { _writing[key] = Math.max(0,(_writing[key]||1)-1); }, 2000))
        .catch(e => { console.warn("Firebase write error:", e.message); _writing[key] = Math.max(0,(_writing[key]||1)-1); });
      return n;
    });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return [fbLoaded ? (val ?? defRef.current) : defRef.current, set, fbLoaded];
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
const ALL_TABS = ["Dashboard","Customers","Deliveries","Payments","Supplies","Expenses","P&L","Analytics","Production","GPS","Settings"];
const ROLE_DEF = {
  admin:   ALL_TABS,
  factory: ["Dashboard","Customers","Deliveries","Supplies","Production"],
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
  {id:"u2",username:"factory1",password:hashPw("factory123"),  role:"factory",name:"Factory Staff",  active:true,createdAt:"2026-01-01",permissions:["Customers","Deliveries","Supplies","Production"]},
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
  bulkOrderEnabled: true,
  agentInvoiceEnabled: true,
  agentInvoiceShowPrices: true,
  agentCollectEnabled: true,
  agentCollectRequireNote: false,
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
  // ── Invoice Numbering ──
  invoicePrefix: "TAS",
  invoiceStartSeq: 1,
  invoiceYearReset: true,
  invoiceShowOnReports: true,
  invoiceShowOnPnL: true,
  invoiceShowOnAnalytics: true,
  // ── Feature Flags (centralized) ──
  featureSmartDeduction: true,
  featureBulkOrders: true,
  featureShiftManagement: true,
  featureOrderDateOverride: false,
  featureCreditLimit: false,
  featureTaxCalc: false,
  featureRouteOpt: false,
  featureMultiCurrency: false,
  // ── Alerts ──
  alertLowStock: true,
  alertOverdueDelivery: true,
  alertChurnRisk: true,
  alertPaymentReceived: true,
  alertNewOrder: false,
  alertDailyReport: false,
  // ── Branding extended ──
  brandAccentColor: "#1e3a5f",
  brandTagline: "",
  companyAddress: "",
  // ── Backup ──
  autoBackupReminder: 7,
};

// Default wastage data
const D_WASTE = [];

// Default production targets
const D_PROD_TARGETS = [];
// shifts stored in settings already

// ═══════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════
function exportPDF(record, products, type, settings, deliveries) {
  const rows   = lineRows(record.orderLines||record.orders||{}, products);
  const total  = lineTotal(record.orderLines||record.orders||{});
  const name   = record.name || record.customer || "—";
  const co     = settings?.companyName    || "TAS Healthy World";
  const cosub  = settings?.companySubtitle|| "Malabar Paratha Factory · Goa, India";
  const gst    = settings?.companyGST     || "";
  const coPhone= settings?.companyPhone   || "";
  const invoiceNo=record.invNo||`INV-${(record.date||today()).replace(/-/g,"")}-${(record.id||uid()).slice(-4).toUpperCase()}`;

  // ── Customer delivery history (only for customer type) ──
  let historyHtml = "";
  if(type==="customer" && Array.isArray(deliveries)) {
    const cDelivs = [...deliveries.filter(d=>d.customerId===record.id)].sort((a,b)=>b.date.localeCompare(a.date));
    const cDone   = cDelivs.filter(d=>d.status==="Delivered");
    const cPend   = cDelivs.filter(d=>d.status==="Pending"||d.status==="In Transit");
    const cCanc   = cDelivs.filter(d=>d.status==="Cancelled");
    const cRepl   = cDelivs.filter(d=>d.replacement?.done);
    const totalRev= cDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
    const totalReplAmt=cDelivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
    const delivRate=cDelivs.length>0?Math.round(cDone.length/cDelivs.length*100):100;
    const lastD   = cDelivs[0];
    const lastDays= lastD?Math.floor((new Date()-new Date(lastD.date))/86400000):null;
    const joinDays= record.joinDate?Math.max(1,Math.floor((new Date()-new Date(record.joinDate))/86400000)):90;
    const ordersPerMonth= cDelivs.length>0?(cDelivs.length/(joinDays/30)).toFixed(1):0;

    historyHtml = `
    <div class="section-title">📊 Customer Summary</div>
    <div class="stat-grid">
      <div class="stat-box"><div class="stat-val">${cDelivs.length}</div><div class="stat-lbl">Total Orders</div></div>
      <div class="stat-box green-box"><div class="stat-val" style="color:#059669">${cDone.length}</div><div class="stat-lbl">Delivered</div></div>
      <div class="stat-box"><div class="stat-val" style="color:#f59e0b">${cPend.length}</div><div class="stat-lbl">Pending / Transit</div></div>
      <div class="stat-box red-box"><div class="stat-val" style="color:#dc2626">${cCanc.length}</div><div class="stat-lbl">Cancelled / Returned</div></div>
      <div class="stat-box"><div class="stat-val" style="color:#f97316">${cRepl.length}</div><div class="stat-lbl">Replacements</div></div>
      <div class="stat-box"><div class="stat-val">${delivRate}%</div><div class="stat-lbl">Delivery Rate</div></div>
      <div class="stat-box"><div class="stat-val">₹${totalRev.toLocaleString("en-IN")}</div><div class="stat-lbl">Total Revenue</div></div>
      <div class="stat-box"><div class="stat-val">${ordersPerMonth}/mo</div><div class="stat-lbl">Order Frequency</div></div>
    </div>

    <div class="section-title" style="margin-top:24px">💳 Payment Overview</div>
    <div class="stat-grid">
      <div class="stat-box green-box"><div class="stat-val" style="color:#059669">₹${(record.paid||0).toLocaleString("en-IN")}</div><div class="stat-lbl">Amount Paid</div></div>
      <div class="stat-box red-box"><div class="stat-val" style="color:#dc2626">₹${(record.pending||0).toLocaleString("en-IN")}</div><div class="stat-lbl">Amount Pending</div></div>
      ${(record.partialPay||0)>0?`<div class="stat-box"><div class="stat-val" style="color:#d97706">₹${(record.partialPay||0).toLocaleString("en-IN")}</div><div class="stat-lbl">Partial On Hold</div></div>`:""}
      ${totalReplAmt>0?`<div class="stat-box"><div class="stat-val" style="color:#f97316">−₹${totalReplAmt.toLocaleString("en-IN")}</div><div class="stat-lbl">Replacement Deducted</div></div>`:""}
      <div class="stat-box"><div class="stat-val">${lastDays===null?"Never":lastDays===0?"Today":lastDays===1?"Yesterday":lastDays+"d ago"}</div><div class="stat-lbl">Last Order</div></div>
    </div>

    ${cDelivs.length>0?`
    <div class="section-title" style="margin-top:24px">📦 Delivery History (${cDelivs.length} orders)</div>
    <table>
      <thead><tr>
        <th>Invoice No</th><th>Receipt No</th><th>Date</th><th>Status</th><th>Items</th><th>Order Total</th><th>Replacement</th><th>Repl. Amount</th><th>Net Payable</th><th>Collected</th><th>Balance Due</th><th>Notes</th>
      </tr></thead>
      <tbody>
        ${cDelivs.map((d,i)=>{
          const dTotal=lineTotal(d.orderLines);
          const dLineEntries=Object.entries(d.orderLines||{}).filter(([,l])=>l.qty>0);
          const itemsStr=dLineEntries.map(([pid,l])=>{const p=products.find(x=>x.id===pid);return `${l.qty}×${p?p.name:(l.name||pid)}`;}).join(", ");
          const statusColor=d.status==="Delivered"?"#059669":d.status==="In Transit"?"#2563eb":d.status==="Cancelled"?"#dc2626":"#d97706";
          const dReplAmt=+(d.replacement?.amount)||0;
          const dNetAmt=dTotal-dReplAmt;
          const dCollected=d.partialPayment?.enabled?(+(d.partialPayment?.amount)||0):0;
          const dBalance=Math.max(0,dNetAmt-dCollected);
          const dInvNo=d.invNo||`INV-${(d.date||"").replace(/-/g,"")}-${(d.id||"").slice(-4).toUpperCase()}`;
          const dRcptNo=`RCP-${dInvNo.replace(/^[A-Z]+-/,"")}`;
          return `<tr style="background:${i%2===0?"#fff":"#f8fafc"}">
            <td style="white-space:nowrap;font-family:monospace;font-size:10px;color:#7c3aed;font-weight:700">${dInvNo}</td>
            <td style="white-space:nowrap;font-family:monospace;font-size:10px;color:#0ea5e9;font-weight:700">${dRcptNo}</td>
            <td style="white-space:nowrap">${d.date||"—"}</td>
            <td><span style="background:${statusColor}18;color:${statusColor};padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700">${d.status||"Pending"}</span></td>
            <td style="font-size:11px;color:#475569">${itemsStr||"—"}</td>
            <td class="r" style="font-weight:700">₹${dTotal.toLocaleString("en-IN")}</td>
            <td style="font-size:11px">${d.replacement?.done?`<span style="color:#f97316;font-weight:600">🔄 ${d.replacement.item||"Done"}${d.replacement.qty?" ("+d.replacement.qty+")":""}</span>`:"—"}</td>
            <td class="r" style="color:#f97316;font-weight:700">${d.replacement?.done&&dReplAmt?"−₹"+dReplAmt.toLocaleString("en-IN"):"—"}</td>
            <td class="r" style="font-weight:700;color:#0f172a">₹${dNetAmt.toLocaleString("en-IN")}</td>
            <td class="r" style="color:#059669;font-weight:700">${dCollected>0?"₹"+dCollected.toLocaleString("en-IN"):"—"}</td>
            <td class="r" style="color:${dBalance===0?"#059669":"#d97706"};font-weight:800">${dBalance===0?"✓ Paid":"₹"+dBalance.toLocaleString("en-IN")}</td>
            <td style="font-size:11px;color:#94a3b8">${d.notes||"—"}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`:""
    }

    ${cRepl.length>0?`
    <div class="section-title" style="margin-top:28px">🔄 Replacement Log (${cRepl.length})</div>
    <table>
      <thead><tr><th>Date</th><th>Item Replaced</th><th>Qty</th><th>Reason</th><th>Amount Deducted</th></tr></thead>
      <tbody>
        ${cRepl.map((d,i)=>`<tr style="background:${i%2===0?"#fff":"#fef9f0"}">
          <td>${d.date||"—"}</td>
          <td>${d.replacement?.item||"—"}</td>
          <td>${d.replacement?.qty||"—"}</td>
          <td style="font-size:11px;color:#78716c">${d.replacement?.reason||"—"}</td>
          <td class="r" style="color:#f97316;font-weight:700">${d.replacement?.amount?"−₹"+Number(d.replacement.amount).toLocaleString("en-IN"):"—"}</td>
        </tr>`).join("")}
        <tr style="background:#fff7ed;font-weight:800">
          <td colspan="4">Total Deducted</td>
          <td class="r" style="color:#ea580c">−₹${totalReplAmt.toLocaleString("en-IN")}</td>
        </tr>
      </tbody>
    </table>`:""
    }
    `;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${type==="customer"?"Customer Report":"Invoice"} — ${name}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;color:#1c1917;padding:32px;max-width:860px;margin:0 auto}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #e7e5e4}
.brand{font-size:19px;font-weight:900;color:#92400e}.bsub{font-size:11px;color:#78716c;margin-top:3px}
.ititle{font-size:26px;font-weight:900;text-align:right}.imeta{font-size:11px;color:#78716c;text-align:right;margin-top:3px}
.slabel{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#a8a29e;margin:18px 0 5px}
.bname{font-size:15px;font-weight:700}.bsub2{font-size:11px;color:#78716c;margin-top:2px}
.badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700;margin-top:5px}
.bg{background:#d1fae5;color:#065f46}.by{background:#fef3c7;color:#92400e}.bb{background:#dbeafe;color:#1e40af}
.section-title{font-size:13px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:0.06em;margin:20px 0 10px;padding-bottom:6px;border-bottom:2px solid #e2e8f0}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:6px}
.stat-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px}
.green-box{background:#f0fdf4;border-color:#bbf7d0}.red-box{background:#fef2f2;border-color:#fecaca}
.stat-val{font-size:18px;font-weight:900;line-height:1;color:#0f172a}
.stat-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#94a3b8;margin-top:5px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:4px}
th{font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:#64748b;padding:8px 10px;border-bottom:2px solid #e2e8f0;text-align:left;background:#f1f5f9}
td{padding:8px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}
.r{text-align:right}.c{text-align:center}
.trow td{font-weight:800;font-size:14px;border:none;border-top:2px solid #1c1917;padding-top:11px}
.sumbox{display:flex;gap:20px;margin-top:20px;padding:14px;background:#f5f5f4;border-radius:8px;flex-wrap:wrap}
.sv{font-size:17px;font-weight:900;margin-top:2px}.sl{font-size:10px;color:#78716c}
.footer{margin-top:36px;text-align:center;font-size:10px;color:#a8a29e;padding-top:18px;border-top:1px solid #e7e5e4}
@media print{@page{size:A4;margin:1cm}body{padding:0}.no-print{display:none!important}}.print-bar{position:fixed;top:0;left:0;right:0;background:#1e3a5f;color:#fff;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;z-index:9999;font-family:Arial,sans-serif;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.3);gap:12px}.print-bar a{background:#3b82f6;color:#fff;padding:7px 16px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;white-space:nowrap}.print-bar a.dl{background:#059669}
</style></head><body>
<div class="hdr">
  <div><div class="brand">🫓 ${co}</div><div class="bsub">${cosub}</div>${coPhone?`<div class="bsub">📞 ${coPhone}</div>`:""}${gst?`<div class="bsub">GST: ${gst}</div>`:""}</div>
  <div><div class="ititle">${type==="customer"?"CUSTOMER REPORT":"INVOICE"}</div>
  <div class="imeta">${invoiceNo}</div>
  <div class="imeta">Date: ${record.date||today()}</div>
  <div class="imeta">Ref: #${(record.id||"").slice(-8)}</div>
  ${record.deliveryDate?`<div class="imeta">Deliver by: ${record.deliveryDate}</div>`:""}
  </div>
</div>
<div class="slabel">Customer</div>
<div class="bname">${name}</div>
${record.phone?`<div class="bsub2">📞 ${record.phone}</div>`:""}
${record.address?`<div class="bsub2">📍 ${record.address}</div>`:""}
${record.joinDate?`<div class="bsub2">📅 Customer since: ${record.joinDate}</div>`:""}
${record.notes?`<div class="bsub2" style="margin-top:4px;font-style:italic;color:#a8a29e">"${record.notes}"</div>`:""}

${historyHtml}

${rows.length>0?`<div class="section-title" style="margin-top:24px">🛒 Regular Order Template</div>
<table><tr><th>Product</th><th>Unit</th><th>Qty</th><th>Unit Price</th><th class="r">Amount</th></tr>
${rows.map(r=>`<tr><td>${r.name}</td><td>${r.unit||"—"}</td><td>${r.qty}</td><td>₹${r.priceAmount.toLocaleString("en-IN")}</td><td class="r">₹${(r.qty*r.priceAmount).toLocaleString("en-IN")}</td></tr>`).join("")}
<tr class="trow"><td colspan="4">Template Total</td><td class="r">₹${total.toLocaleString("en-IN")}</td></tr></table>`:""}

<div class="footer">Exported on ${new Date().toLocaleString("en-IN")} · ${co} · Confidential</div>
<div class="print-bar no-print"><span>📄 ${type==="customer"?"Customer Report":"Invoice"} — ${name}</span><div style="display:flex;gap:8px"><a href="#" onclick="window.print();return false;">🖨 Print / Save PDF</a><a class="dl" href="#" onclick="var b=document.documentElement.outerHTML;var bl=new Blob([b],{type:'text/html'});var u=URL.createObjectURL(bl);var a=document.createElement('a');a.href=u;a.download='${(name+'_'+(type==="customer"?"report":"invoice")+'_'+(record.date||today())).replace(/[^a-zA-Z0-9_-]/g,'_')}.html';document.body.appendChild(a);a.click();URL.revokeObjectURL(u);return false;">⬇ Download</a></div></div>
<script>window.addEventListener("load",function(){window.print();});</script>
</body></html>`;
  const blob = new Blob([html], {type:"text/html;charset=utf-8"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.target = "_blank"; a.rel = "noopener";
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
//  exportAgentReceipt — kept for backwards compatibility
// eslint-disable-next-line no-unused-vars
function exportAgentReceipt(d, products, settings, invNo) {
  const showPrices = settings?.agentInvoiceShowPrices !== false;
  const co     = settings?.companyName     || "TAS Healthy World";
  const cosub  = settings?.companySubtitle || "Malabar Paratha Factory · Goa, India";
  const gst    = settings?.companyGST      || "";
  const coPhone= settings?.companyPhone    || "";
  const rows   = lineRows(d.orderLines||{}, products).filter(r=>r.qty>0);
  const orderTotal = lineTotal(d.orderLines||{});
  const replAmt    = +(d.replacement?.amount)||0;
  const netAmt     = orderTotal - replAmt;
  const collected  = d.partialPayment?.enabled ? +(d.partialPayment?.amount)||0 : 0;
  const balanceDue = Math.max(0, netAmt - collected);
  const receiptNo  = invNo ? `RCP-${invNo.replace("TAS-","")}` : `RCP-${(d.date||"").replace(/-/g,"")}-${(d.id||"").slice(-5).toUpperCase()}`;
  const now        = new Date().toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
  const statusColor= d.status==="Delivered"?"#059669":d.status==="In Transit"?"#2563eb":"#d97706";

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Delivery Receipt — ${d.customer}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;color:#1c1917;background:#fff;padding:0;max-width:420px;margin:0 auto}
.wrap{padding:24px 20px}
.brand-bar{background:#1e3a5f;color:#fff;padding:14px 20px;text-align:center}
.brand-name{font-size:17px;font-weight:900;letter-spacing:0.02em}
.brand-sub{font-size:10px;opacity:0.75;margin-top:2px}
.receipt-title{text-align:center;padding:14px 20px 0;border-bottom:2px dashed #e5e5e5;padding-bottom:14px;margin-bottom:0}
.receipt-no{font-size:11px;color:#6b7280;font-weight:700;letter-spacing:0.08em;text-transform:uppercase}
.receipt-date{font-size:10px;color:#9ca3af;margin-top:2px}
.section{padding:12px 20px;border-bottom:1px solid #f3f4f6}
.section-label{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;margin-bottom:8px}
.cust-name{font-size:16px;font-weight:800;color:#111827}
.cust-detail{font-size:11px;color:#6b7280;margin-top:3px;line-height:1.5}
.status-badge{display:inline-block;padding:3px 12px;border-radius:20px;font-size:10px;font-weight:800;margin-top:6px}
.line-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f9fafb;font-size:12px}
.line-name{color:#374151;flex:1}
.line-qty{color:#6b7280;width:32px;text-align:center;font-weight:600}
.line-price{color:#6b7280;width:60px;text-align:right;font-size:11px}
.line-amt{color:#111827;width:64px;text-align:right;font-weight:700}
.total-row{display:flex;justify-content:space-between;padding:7px 0;font-size:13px}
.repl-box{background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:10px 12px;margin:0 20px 0}
.repl-title{font-size:11px;font-weight:800;color:#92400e;margin-bottom:6px}
.repl-detail{font-size:11px;color:#78716c;line-height:1.6}
.pay-section{padding:12px 20px}
.pay-row{display:flex;justify-content:space-between;font-size:13px;padding:4px 0}
.balance-box{background:#111827;color:#fff;margin:0 20px;border-radius:10px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center}
.balance-label{font-size:11px;opacity:0.7;font-weight:700;text-transform:uppercase;letter-spacing:0.06em}
.balance-amt{font-size:22px;font-weight:900}
.balance-paid{background:#059669}
.collected-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 14px;margin:8px 20px;display:flex;justify-content:space-between;align-items:center}
.trail{font-size:9.5px;color:#9ca3af;line-height:1.8;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;font-family:monospace}
.footer{text-align:center;font-size:9px;color:#d1d5db;padding:16px 20px 24px;line-height:1.8}
.print-bar{position:fixed;top:0;left:0;right:0;background:#1e3a5f;color:#fff;padding:8px 16px;display:flex;align-items:center;justify-content:space-between;z-index:9999;font-family:Arial,sans-serif;font-size:12px;gap:10px}
.print-bar a{background:#3b82f6;color:#fff;padding:6px 14px;border-radius:7px;text-decoration:none;font-weight:700;font-size:12px;white-space:nowrap}
@media print{@page{size:80mm auto;margin:0}body{max-width:100%}.print-bar{display:none!important}body{padding-top:0}}
</style></head><body>
<div class="brand-bar">
  <div class="brand-name">🫓 ${co}</div>
  <div class="brand-sub">${cosub}</div>
  ${coPhone?`<div class="brand-sub">📞 ${coPhone}</div>`:""}
  ${gst?`<div class="brand-sub">GST: ${gst}</div>`:""}
</div>
<div class="receipt-title">
  <div class="receipt-no">Delivery Receipt · ${receiptNo}</div>
  <div class="receipt-date">Issued: ${now}</div>
</div>
<div class="section">
  <div class="section-label">Customer</div>
  <div class="cust-name">${d.customer||"—"}</div>
  ${d.phone?`<div class="cust-detail">📞 ${d.phone}</div>`:""}
  ${d.address?`<div class="cust-detail">📍 ${d.address}</div>`:""}
  <span class="status-badge" style="background:${statusColor}20;color:${statusColor}">${d.status||"Pending"}</span>
  <div class="cust-detail" style="margin-top:6px">Order date: <b>${d.date||"—"}</b>${d.deliveryDate&&d.deliveryDate!==d.date?` · Deliver by: <b>${d.deliveryDate}</b>`:""}</div>
  <div class="cust-detail">Handled by: <b>${d.agent||d.createdBy||"—"}</b> · Ref: #${(d.id||"").slice(-8)}</div>
</div>
<div class="section">
  <div class="section-label">Items Ordered</div>
  ${rows.length===0?'<div style="font-size:12px;color:#9ca3af">No items</div>':rows.map(r=>`
  <div class="line-row">
    <span class="line-name">${r.name}</span>
    <span class="line-qty">${r.qty}×</span>
    ${showPrices?`<span class="line-price">₹${r.priceAmount.toLocaleString("en-IN")}</span><span class="line-amt">₹${(r.qty*r.priceAmount).toLocaleString("en-IN")}</span>`:`<span class="line-price"></span><span class="line-amt" style="color:#9ca3af">${r.qty} ${r.unit||"pcs"}</span>`}
  </div>`).join("")}
  ${showPrices&&orderTotal>0?`<div class="total-row" style="border-top:2px solid #111827;margin-top:6px;font-weight:700"><span style="color:#374151">Order Total</span><span style="color:#111827">₹${orderTotal.toLocaleString("en-IN")}</span></div>`:""}
</div>
${d.replacement?.done?`
<div style="padding:10px 20px 0">
<div class="repl-box">
  <div class="repl-title">🔄 Replacement Made</div>
  <div class="repl-detail">
    ${d.replacement.item?`<b>Item:</b> ${d.replacement.item}<br>`:""}
    ${d.replacement.qty?`<b>Quantity:</b> ${d.replacement.qty}<br>`:""}
    ${d.replacement.reason?`<b>Reason:</b> ${d.replacement.reason}<br>`:""}
    ${showPrices&&replAmt>0?`<b style="color:#ea580c">Amount deducted: −₹${replAmt.toLocaleString("en-IN")}</b>`:""}
  </div>
</div>
</div>`:""}
${showPrices?`
<div class="pay-section">
  <div class="section-label">Payment Summary</div>
  ${orderTotal>0?`<div class="pay-row"><span style="color:#6b7280">Order Total</span><span style="font-weight:600">₹${orderTotal.toLocaleString("en-IN")}</span></div>`:""}
  ${replAmt>0?`<div class="pay-row"><span style="color:#ea580c">Replacement Deduction</span><span style="color:#ea580c;font-weight:700">−₹${replAmt.toLocaleString("en-IN")}</span></div>`:""}
  ${replAmt>0?`<div class="pay-row" style="border-top:1px solid #e5e7eb;padding-top:6px;font-weight:700"><span>Net Payable</span><span>₹${netAmt.toLocaleString("en-IN")}</span></div>`:""}
</div>
${collected>0?`<div class="collected-box"><div><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#059669">✓ Amount Collected</div><div style="font-size:9px;color:#6b7280;margin-top:1px">Received at time of delivery</div></div><div style="font-size:18px;font-weight:900;color:#059669">₹${collected.toLocaleString("en-IN")}</div></div>`:""}
<div style="padding:8px 20px 12px">
<div class="balance-box ${balanceDue===0?"balance-paid":""}">
  <div>
    <div class="balance-label">${balanceDue===0?"✓ Fully Paid":"Balance Due"}</div>
    ${balanceDue===0?'<div style="font-size:10px;opacity:0.7;margin-top:2px">No amount outstanding</div>':collected>0?`<div style="font-size:9px;opacity:0.6;margin-top:2px">After ₹${collected.toLocaleString("en-IN")} collected</div>`:""}
  </div>
  <div class="balance-amt">₹${balanceDue.toLocaleString("en-IN")}</div>
</div>
</div>`:""}
<div style="padding:8px 20px 0">
<div class="trail">
  <b>PAPER TRAIL</b><br>
  Receipt No:      ${receiptNo}<br>
  Invoice No:      ${invNo||"—"}<br>
  Delivery ID:     ${(d.id||"").slice(-12)}<br>
  Order Date:      ${d.date||"—"}<br>
  Status:          ${d.status||"—"}<br>
  Created by:      ${d.createdBy||"—"}<br>
  ${d.agent?`Agent:           ${d.agent}<br>`:""}
  Issued at:       ${now}<br>
  ${d.replacement?.done?`Replacement:     YES — ${d.replacement.item||"item"} × ${d.replacement.qty||"?"}<br>`:""}
  ${replAmt>0?`Repl. Deducted:  ₹${replAmt.toLocaleString("en-IN")}<br>`:""}
  ${collected>0?`Collected:       ₹${collected.toLocaleString("en-IN")}<br>`:""}
  ${balanceDue>0?`Balance Due:     ₹${balanceDue.toLocaleString("en-IN")}<br>`:"Balance:         SETTLED<br>"}
</div>
</div>
<div class="footer">
  ${co} · ${cosub}<br>
  This is a computer-generated delivery receipt and serves as an official record.<br>
  For queries contact: ${coPhone||"your account manager"}
</div>
<div class="print-bar"><span>🧾 Receipt ${receiptNo} — ${d.customer}</span><div style="display:flex;gap:8px"><a href="#" onclick="window.print();return false;">🖨 Print</a><a style="background:#059669" href="#" onclick="var b=document.documentElement.outerHTML;var bl=new Blob([b],{type:'text/html'});var u=URL.createObjectURL(bl);var a=document.createElement('a');a.href=u;a.download='receipt_${receiptNo}.html';document.body.appendChild(a);a.click();URL.revokeObjectURL(u);return false;">⬇ Save</a></div></div>
<script>window.addEventListener("load",function(){window.print();});</script>
</body></html>`;
  const blob = new Blob([html], {type:"text/html;charset=utf-8"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.target = "_blank"; a.rel = "noopener";
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
//  exportDeliveryInvoice — Full A4 printable invoice for a single delivery.
//  Shows: invoice number, bill-to, itemised order, replacement deduction,
//  net payable, partial payment collected, balance due, paper trail footer.
// ─────────────────────────────────────────────────────────────────────────────
function exportDeliveryInvoice(d, products, settings, invNo) {
  const co      = settings?.companyName     || "TAS Healthy World";
  const cosub   = settings?.companySubtitle || "Malabar Paratha Factory · Goa, India";
  const gst     = settings?.companyGST      || "";
  const coPhone = settings?.companyPhone    || "";
  const coAddr  = settings?.companyAddress  || "";
  const rows    = lineRows(d.orderLines||{}, products).filter(r=>r.qty>0);
  const gross   = lineTotal(d.orderLines||{});
  const replAmt = +(d.replacement?.amount)||0;
  const net     = Math.max(0, gross - replAmt);
  const partial = d.partialPayment?.enabled ? +(d.partialPayment?.amount)||0 : 0;
  const balance = Math.max(0, net - partial);
  const now     = new Date().toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
  const sc      = d.status==="Delivered"?"#059669":d.status==="In Transit"?"#2563eb":d.status==="Cancelled"?"#dc2626":"#d97706";
  const delivId = (d.id||"").slice(-10).toUpperCase();

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Invoice ${invNo} — ${d.customer}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
body{font-family:'Inter',Arial,sans-serif;color:#111827;background:#fff;font-size:13px;line-height:1.5}
.page{max-width:820px;margin:0 auto;padding:48px 56px}
/* Header */
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px;padding-bottom:28px;border-bottom:3px solid #111827}
.brand-name{font-size:22px;font-weight:900;color:#111827;letter-spacing:-0.03em}
.brand-sub{font-size:11px;color:#6b7280;margin-top:4px;line-height:1.6}
.inv-block{text-align:right}
.inv-title{font-size:36px;font-weight:900;color:#111827;letter-spacing:-0.04em;line-height:1}
.inv-num{font-size:14px;font-weight:700;color:#2563eb;margin-top:8px;letter-spacing:0.02em}
.inv-meta{font-size:11px;color:#6b7280;margin-top:3px}
.status-pill{display:inline-block;padding:3px 12px;border-radius:20px;font-size:10px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;margin-top:8px}
/* Addresses */
.addresses{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:32px}
.addr-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;margin-bottom:8px}
.addr-name{font-size:16px;font-weight:700;color:#111827}
.addr-detail{font-size:12px;color:#6b7280;margin-top:3px;line-height:1.6}
/* Items table */
.items-table{width:100%;border-collapse:collapse;margin-bottom:0}
.items-table thead tr{background:#f1f5f9;border-bottom:2px solid #e2e8f0}
.items-table th{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;padding:10px 14px;text-align:left}
.items-table th.r{text-align:right}
.items-table td{padding:11px 14px;border-bottom:1px solid #f1f5f9;color:#111827;font-size:13px;vertical-align:middle}
.items-table td.r{text-align:right;font-variant-numeric:tabular-nums}
.items-table tbody tr:last-child td{border-bottom:2px solid #111827}
.item-name{font-weight:600}
.item-sku{font-size:10px;color:#9ca3af;margin-top:1px}
/* Totals */
.totals-wrap{display:flex;justify-content:flex-end;margin-bottom:28px}
.totals-box{width:320px}
.tot-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px solid #f1f5f9}
.tot-row.gross{color:#374151}
.tot-row.repl{color:#ea580c}
.tot-row.net{font-weight:700;color:#111827;border-bottom:2px solid #111827}
.tot-row.collected{color:#059669;font-weight:600}
.tot-row.balance-due{font-weight:800;font-size:15px;border-bottom:none;padding-top:10px;color:#dc2626}
.tot-row.balance-paid{font-weight:800;font-size:15px;border-bottom:none;padding-top:10px;color:#059669}
/* Replacement box */
.repl-section{background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px 20px;margin-bottom:20px}
.repl-heading{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#92400e;margin-bottom:10px}
.repl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
.repl-field{font-size:11px;color:#78350f}
.repl-val{font-weight:700;color:#111827;font-size:12px;margin-top:2px}
/* Partial pay banner */
.partial-banner{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px 20px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}
.partial-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#059669}
.partial-detail{font-size:11px;color:#6b7280;margin-top:2px}
.partial-amt{font-size:22px;font-weight:900;color:#059669}
/* Balance box */
.balance-banner{border-radius:12px;padding:16px 22px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:center}
.balance-banner.due{background:#111827;color:#fff}
.balance-banner.paid{background:#059669;color:#fff}
.bal-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;opacity:0.7}
.bal-sub{font-size:10px;opacity:0.55;margin-top:3px}
.bal-amt{font-size:28px;font-weight:900;letter-spacing:-0.02em}
/* Paper trail */
.trail-section{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin-bottom:28px}
.trail-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;margin-bottom:10px}
.trail-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px 24px}
.trail-item{font-size:10px;color:#6b7280;font-family:monospace;line-height:1.7}
.trail-item b{color:#374151}
/* Footer */
.footer{border-top:1px solid #e5e7eb;padding-top:16px;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#9ca3af}
.footer-brand{font-weight:700;color:#374151}
/* Print */
.print-bar{position:fixed;top:0;left:0;right:0;background:#111827;color:#fff;padding:10px 24px;display:flex;align-items:center;justify-content:space-between;z-index:9999;font-family:Inter,Arial,sans-serif;font-size:13px;gap:12px;box-shadow:0 2px 12px rgba(0,0,0,0.4)}
.print-bar a{padding:7px 18px;border-radius:8px;text-decoration:none;font-weight:700;font-size:12px;white-space:nowrap;color:#fff}
.print-bar a.print{background:#2563eb}
.print-bar a.save{background:#059669}
.print-bar a.inv{background:#7c3aed}
@media print{
  @page{size:A4;margin:1.2cm 1.4cm}
  body{font-size:12px}
  .print-bar{display:none!important}
  .page{padding:0;max-width:100%}
  .items-table th,.items-table td{padding:8px 10px}
}
</style></head><body>
<div class="page">

<!-- HEADER -->
<div class="header">
  <div>
    <div class="brand-name">🫓 ${co}</div>
    <div class="brand-sub">
      ${cosub}<br>
      ${coAddr?coAddr+"<br>":""}
      ${coPhone?`📞 ${coPhone}<br>`:""}
      ${gst?`GST: ${gst}`:""}
    </div>
  </div>
  <div class="inv-block">
    <div class="inv-title">INVOICE</div>
    <div class="inv-num">${invNo}</div>
    <div class="inv-meta">Date: ${d.date||today()}</div>
    ${d.deliveryDate&&d.deliveryDate!==d.date?`<div class="inv-meta">Deliver by: ${d.deliveryDate}</div>`:""}
    <div class="inv-meta">Issued: ${now}</div>
    <span class="status-pill" style="background:${sc}20;color:${sc}">${d.status||"Pending"}</span>
  </div>
</div>

<!-- BILL TO / FROM -->
<div class="addresses">
  <div>
    <div class="addr-label">Bill To</div>
    <div class="addr-name">${d.customer||"—"}</div>
    ${d.phone?`<div class="addr-detail">📞 ${d.phone}</div>`:""}
    ${d.address?`<div class="addr-detail">📍 ${d.address}</div>`:""}
  </div>
  <div>
    <div class="addr-label">Order Details</div>
    <div class="addr-detail"><b>Order ID:</b> #${delivId}</div>
    <div class="addr-detail"><b>Agent:</b> ${d.agent||d.createdBy||"—"}</div>
    ${d.notes?`<div class="addr-detail"><b>Notes:</b> ${d.notes}</div>`:""}
  </div>
</div>

<!-- ITEMS TABLE -->
<table class="items-table">
  <thead>
    <tr>
      <th style="width:40px">#</th>
      <th>Product</th>
      <th>Unit</th>
      <th class="r">Qty</th>
      <th class="r">Unit Price</th>
      <th class="r">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${rows.map((r,i)=>`
    <tr>
      <td style="color:#9ca3af;font-size:11px">${i+1}</td>
      <td><div class="item-name">${r.name}</div><div class="item-sku">${r.unit}</div></td>
      <td style="color:#6b7280">${r.unit}</td>
      <td class="r">${r.qty}</td>
      <td class="r">₹${r.priceAmount.toLocaleString("en-IN")}</td>
      <td class="r" style="font-weight:700">₹${(r.qty*r.priceAmount).toLocaleString("en-IN")}</td>
    </tr>`).join("")}
    ${rows.length===0?`<tr><td colspan="6" style="color:#9ca3af;text-align:center;padding:20px">No items recorded</td></tr>`:""}
  </tbody>
</table>

<!-- TOTALS -->
<div class="totals-wrap">
  <div class="totals-box">
    <div class="tot-row gross"><span>Subtotal</span><span>₹${gross.toLocaleString("en-IN")}</span></div>
    ${replAmt>0?`<div class="tot-row repl"><span>🔄 Replacement Deduction</span><span>−₹${replAmt.toLocaleString("en-IN")}</span></div>`:""}
    <div class="tot-row net"><span>Net Payable</span><span>₹${net.toLocaleString("en-IN")}</span></div>
    ${partial>0?`<div class="tot-row collected"><span>✓ Amount Collected</span><span>₹${partial.toLocaleString("en-IN")}</span></div>`:""}
  </div>
</div>

${d.replacement?.done?`
<!-- REPLACEMENT DETAILS -->
<div class="repl-section">
  <div class="repl-heading">🔄 Replacement Details</div>
  <div class="repl-grid">
    ${d.replacement.item?`<div><div class="repl-field">Item Replaced</div><div class="repl-val">${d.replacement.item}</div></div>`:""}
    ${d.replacement.qty?`<div><div class="repl-field">Quantity</div><div class="repl-val">${d.replacement.qty}</div></div>`:""}
    ${d.replacement.reason?`<div style="grid-column:1/-1"><div class="repl-field">Reason</div><div class="repl-val">${d.replacement.reason}</div></div>`:""}
    ${replAmt>0?`<div><div class="repl-field">Amount Deducted from Invoice</div><div class="repl-val" style="color:#ea580c">−₹${replAmt.toLocaleString("en-IN")}</div></div>`:""}
  </div>
</div>`:""}

${partial>0?`
<!-- PARTIAL PAYMENT -->
<div class="partial-banner">
  <div>
    <div class="partial-label">✓ Partial Payment Collected</div>
    <div class="partial-detail">Collected at time of delivery${d.partialPayment?.collectedAt?" on "+d.partialPayment.collectedAt:""}</div>
    ${d.partialPayment?.note?`<div class="partial-detail">Note: ${d.partialPayment.note}</div>`:""}
  </div>
  <div class="partial-amt">₹${partial.toLocaleString("en-IN")}</div>
</div>`:""}

<!-- BALANCE BANNER -->
<div class="balance-banner ${balance===0?"paid":"due"}">
  <div>
    <div class="bal-label">${balance===0?"✓ Invoice Fully Settled":"Balance Due"}</div>
    ${balance===0?`<div class="bal-sub">No outstanding amount · Thank you!</div>`
    :partial>0?`<div class="bal-sub">After ₹${partial.toLocaleString("en-IN")} collected · Remaining balance</div>`
    :`<div class="bal-sub">Full amount outstanding · Please arrange payment</div>`}
  </div>
  <div class="bal-amt">₹${balance.toLocaleString("en-IN")}</div>
</div>

<!-- PAPER TRAIL -->
<div class="trail-section">
  <div class="trail-title">📋 Paper Trail</div>
  <div class="trail-grid">
    <div class="trail-item"><b>Invoice No:</b> ${invNo}</div>
    <div class="trail-item"><b>Delivery ID:</b> #${delivId}</div>
    <div class="trail-item"><b>Order Date:</b> ${d.date||"—"}</div>
    <div class="trail-item"><b>Status:</b> ${d.status||"—"}</div>
    <div class="trail-item"><b>Created by:</b> ${d.createdBy||"—"}</div>
    ${d.agent?`<div class="trail-item"><b>Agent:</b> ${d.agent}</div>`:""}
    <div class="trail-item"><b>Gross Amount:</b> ₹${gross.toLocaleString("en-IN")}</div>
    ${replAmt>0?`<div class="trail-item"><b>Replacement Deducted:</b> −₹${replAmt.toLocaleString("en-IN")}</div>`:""}
    <div class="trail-item"><b>Net Payable:</b> ₹${net.toLocaleString("en-IN")}</div>
    ${partial>0?`<div class="trail-item"><b>Collected:</b> ₹${partial.toLocaleString("en-IN")}</div>`:""}
    <div class="trail-item"><b>Balance:</b> ${balance===0?"SETTLED":"₹"+balance.toLocaleString("en-IN")}</div>
    <div class="trail-item"><b>Issued at:</b> ${now}</div>
  </div>
</div>

<!-- FOOTER -->
<div class="footer">
  <div>
    <div class="footer-brand">🫓 ${co}</div>
    <div>${cosub}${coPhone?" · 📞 "+coPhone:""}</div>
    ${gst?`<div>GST: ${gst}</div>`:""}
  </div>
  <div style="text-align:right">
    <div>This is a computer-generated invoice.</div>
    <div>For disputes contact: ${coPhone||"your account manager"}</div>
  </div>
</div>

</div><!-- .page -->
<div class="print-bar">
  <span style="font-weight:700">📄 Invoice ${invNo} — ${d.customer||"—"}</span>
  <div style="display:flex;gap:8px">
    <a class="print" href="#" onclick="window.print();return false;">🖨 Print / PDF</a>
    <a class="save" href="#" onclick="var b=document.documentElement.outerHTML;var bl=new Blob([b],{type:'text/html'});var u=URL.createObjectURL(bl);var a=document.createElement('a');a.href=u;a.download='Invoice_${invNo}_${(d.customer||"").replace(/[^a-zA-Z0-9]/g,"_")}.html';document.body.appendChild(a);a.click();URL.revokeObjectURL(u);return false;">⬇ Save</a>
  </div>
</div>
<script>window.addEventListener("load",function(){window.print();});</script>
</body></html>`;

  const blob = new Blob([html], {type:"text/html;charset=utf-8"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.target = "_blank"; a.rel = "noopener";
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}

// ─── exportDeliveryReceipt — compact thermal-style delivery receipt ───
function exportDeliveryReceipt(d, products, settings, invNo) {
  const showPrices = settings?.agentInvoiceShowPrices !== false;
  const co      = settings?.companyName     || "TAS Healthy World";
  const cosub   = settings?.companySubtitle || "Malabar Paratha Factory · Goa, India";
  const gst     = settings?.companyGST      || "";
  const coPhone = settings?.companyPhone    || "";
  const rows    = lineRows(d.orderLines||{}, products).filter(r=>r.qty>0);
  const orderTotal = lineTotal(d.orderLines||{});
  const replAmt    = +(d.replacement?.amount)||0;
  const netAmt     = orderTotal - replAmt;
  const collected  = d.partialPayment?.enabled ? +(d.partialPayment?.amount)||0 : 0;
  const balanceDue = Math.max(0, netAmt - collected);
  const receiptNo  = invNo ? `RCP-${invNo.replace("TAS-","")}` : `RCP-${(d.date||"").replace(/-/g,"")}-${(d.id||"").slice(-5).toUpperCase()}`;
  const now        = new Date().toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
  const statusColor= d.status==="Delivered"?"#059669":d.status==="In Transit"?"#2563eb":"#d97706";

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Delivery Receipt — ${d.customer}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;color:#1c1917;background:#fff;padding:0;max-width:420px;margin:0 auto}
.wrap{padding:24px 20px}
.brand-bar{background:#1e3a5f;color:#fff;padding:14px 20px;text-align:center}
.brand-name{font-size:17px;font-weight:900;letter-spacing:0.02em}
.brand-sub{font-size:10px;opacity:0.75;margin-top:2px}
.receipt-title{text-align:center;padding:14px 20px 0;border-bottom:2px dashed #e5e5e5;padding-bottom:14px;margin-bottom:0}
.receipt-no{font-size:11px;color:#6b7280;font-weight:700;letter-spacing:0.08em;text-transform:uppercase}
.receipt-date{font-size:10px;color:#9ca3af;margin-top:2px}
.section{padding:12px 20px;border-bottom:1px solid #f3f4f6}
.section-label{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;margin-bottom:8px}
.cust-name{font-size:16px;font-weight:800;color:#111827}
.cust-detail{font-size:11px;color:#6b7280;margin-top:3px;line-height:1.5}
.status-badge{display:inline-block;padding:3px 12px;border-radius:20px;font-size:10px;font-weight:800;margin-top:6px}
.line-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f9fafb;font-size:12px}
.line-name{color:#374151;flex:1}
.line-qty{color:#6b7280;width:32px;text-align:center;font-weight:600}
.line-price{color:#6b7280;width:60px;text-align:right;font-size:11px}
.line-amt{color:#111827;width:64px;text-align:right;font-weight:700}
.total-row{display:flex;justify-content:space-between;padding:7px 0;font-size:13px}
.repl-box{background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:10px 12px;margin:0 20px 0}
.repl-title{font-size:11px;font-weight:800;color:#92400e;margin-bottom:6px}
.repl-detail{font-size:11px;color:#78716c;line-height:1.6}
.pay-section{padding:12px 20px}
.pay-row{display:flex;justify-content:space-between;font-size:13px;padding:4px 0}
.balance-box{background:#111827;color:#fff;margin:0 20px;border-radius:10px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center}
.balance-label{font-size:11px;opacity:0.7;font-weight:700;text-transform:uppercase;letter-spacing:0.06em}
.balance-amt{font-size:22px;font-weight:900}
.balance-paid{background:#059669}
.collected-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 14px;margin:8px 20px;display:flex;justify-content:space-between;align-items:center}
.trail{background:#f8fafc;margin:0 20px;border-radius:8px;padding:10px 12px;font-size:9px;color:#9ca3af;line-height:1.8;border:1px solid #e2e8f0}
.trail b{color:#6b7280}
.footer{text-align:center;padding:14px 20px 20px;font-size:10px;color:#9ca3af;line-height:1.7}
.print-bar{position:fixed;top:0;left:0;right:0;background:#1e3a5f;color:#fff;padding:8px 16px;display:flex;align-items:center;justify-content:space-between;z-index:9999;font-family:Arial,sans-serif;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,0.3);gap:10px}
.print-bar a{background:#3b82f6;color:#fff;padding:5px 14px;border-radius:7px;text-decoration:none;font-weight:700;font-size:12px;white-space:nowrap}
@media print{@page{size:80mm auto;margin:0}.print-bar{display:none!important}body{padding:0;max-width:100%}}
</style></head><body>
<div class="brand-bar">
  <div class="brand-name">${co}</div>
  <div class="brand-sub">${cosub}${coPhone?` · ${coPhone}`:""}${gst?` · GST: ${gst}`:""}</div>
</div>

<div class="receipt-title">
  <div class="receipt-no">Delivery Receipt · ${receiptNo}</div>
  <div class="receipt-date">Issued: ${now}</div>
</div>

<!-- Customer -->
<div class="section">
  <div class="section-label">Deliver To</div>
  <div class="cust-name">${d.customer||"—"}</div>
  ${d.address?`<div class="cust-detail">📍 ${d.address}</div>`:""}
  ${d.notes?`<div class="cust-detail" style="font-style:italic;color:#9ca3af">"${d.notes}"</div>`:""}
  <div><span class="status-badge" style="background:${statusColor}18;color:${statusColor};border:1px solid ${statusColor}40">${d.status||"Pending"}</span></div>
  <div class="cust-detail" style="margin-top:6px">Order date: <b>${d.date||"—"}</b>${d.deliveryDate&&d.deliveryDate!==d.date?` · Deliver by: <b>${d.deliveryDate}</b>`:""}</div>
  <div class="cust-detail">Handled by: <b>${d.agent||d.createdBy||"—"}</b> · Ref: #${(d.id||"").slice(-8)}</div>
</div>

<!-- Items -->
<div class="section">
  <div class="section-label">Items Ordered</div>
  ${rows.length===0?'<div style="font-size:12px;color:#9ca3af">No items</div>':rows.map(r=>`
  <div class="line-row">
    <span class="line-name">${r.name}</span>
    <span class="line-qty">${r.qty}×</span>
    ${showPrices?`<span class="line-price">₹${r.priceAmount.toLocaleString("en-IN")}</span><span class="line-amt">₹${(r.qty*r.priceAmount).toLocaleString("en-IN")}</span>`:`<span class="line-price"></span><span class="line-amt" style="color:#9ca3af">${r.qty} ${r.unit||"pcs"}</span>`}
  </div>`).join("")}
  ${showPrices&&orderTotal>0?`<div class="total-row" style="border-top:2px solid #111827;margin-top:6px;font-weight:700"><span style="color:#374151">Order Total</span><span style="color:#111827">₹${orderTotal.toLocaleString("en-IN")}</span></div>`:""}
</div>

<!-- Replacement (if any) -->
${d.replacement?.done?`
<div style="padding:10px 20px 0">
<div class="repl-box">
  <div class="repl-title">🔄 Replacement Made</div>
  <div class="repl-detail">
    ${d.replacement.item?`<b>Item:</b> ${d.replacement.item}<br>`:""}
    ${d.replacement.qty?`<b>Quantity:</b> ${d.replacement.qty}<br>`:""}
    ${d.replacement.reason?`<b>Reason:</b> ${d.replacement.reason}<br>`:""}
    ${showPrices&&replAmt>0?`<b style="color:#ea580c">Amount deducted: −₹${replAmt.toLocaleString("en-IN")}</b>`:""}
  </div>
</div>
</div>`:""}

<!-- Payment Summary -->
${showPrices?`
<div class="pay-section">
  <div class="section-label">Payment Summary</div>
  ${orderTotal>0?`<div class="pay-row"><span style="color:#6b7280">Order Total</span><span style="font-weight:600">₹${orderTotal.toLocaleString("en-IN")}</span></div>`:""}
  ${replAmt>0?`<div class="pay-row"><span style="color:#ea580c">Replacement Deduction</span><span style="color:#ea580c;font-weight:700">−₹${replAmt.toLocaleString("en-IN")}</span></div>`:""}
  ${replAmt>0?`<div class="pay-row" style="border-top:1px solid #e5e7eb;padding-top:6px;font-weight:700"><span>Net Payable</span><span>₹${netAmt.toLocaleString("en-IN")}</span></div>`:""}
</div>
${collected>0?`<div class="collected-box"><div><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#059669">✓ Amount Collected</div><div style="font-size:9px;color:#6b7280;margin-top:1px">Received at time of delivery</div></div><div style="font-size:18px;font-weight:900;color:#059669">₹${collected.toLocaleString("en-IN")}</div></div>`:""}
<div style="padding:8px 20px 12px">
<div class="balance-box ${balanceDue===0?"balance-paid":""}">
  <div>
    <div class="balance-label">${balanceDue===0?"✓ Fully Paid":"Balance Due"}</div>
    ${balanceDue===0?'<div style="font-size:10px;opacity:0.7;margin-top:2px">No amount outstanding</div>':""}
  </div>
  <div class="balance-amt">₹${balanceDue.toLocaleString("en-IN")}</div>
</div>
</div>`:""}

<!-- Paper Trail -->
<div style="padding:8px 20px 0">
<div class="trail">
  <b>Paper Trail</b><br>
  Receipt No: ${receiptNo}<br>
  Delivery ID: ${(d.id||"").slice(-12)}<br>
  Delivery Date: ${d.date||"—"}<br>
  Status: ${d.status||"—"}<br>
  Created by: ${d.createdBy||"—"}<br>
  ${d.agent?`Assigned Agent: ${d.agent}<br>`:""}
  Issued at: ${now}<br>
  ${d.replacement?.done?`Replacement logged: YES — ${d.replacement.item||"—"}<br>`:""}
  ${collected>0?`Payment collected: ₹${collected.toLocaleString("en-IN")}<br>`:""}
</div>
</div>

<div class="footer">
  ${co} · ${cosub}<br>
  This is a computer-generated delivery receipt and serves as an official record.<br>
  For queries contact: ${coPhone||"your account manager"}
</div>

<div class="print-bar"><span>🧾 Delivery Receipt — ${d.customer}</span><div style="display:flex;gap:8px"><a href="#" onclick="window.print();return false;">🖨 Print</a></div></div>
<script>window.addEventListener("load",function(){window.print();});</script>
</body></html>`;

  const blob = new Blob([html], {type:"text/html;charset=utf-8"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.target = "_blank"; a.rel = "noopener";
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
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
  if(type==="delivery") {
    const replAmt = +(record.replacement?.amount||0);
    const collected = record.partialPayment?.enabled ? +(record.partialPayment?.amount||0) : 0;
    const net = Math.max(0, total - replAmt);
    const balance = Math.max(0, net - collected);
    if(replAmt>0) msg += `\n🔄 Replacement deducted: −₹${replAmt.toLocaleString("en-IN")}\n*Net Payable: ₹${net.toLocaleString("en-IN")}*`;
    if(collected>0) msg += `\n✅ Collected: ₹${collected.toLocaleString("en-IN")}`;
    if(balance>0) msg += `\n⚠️ *Balance Due: ₹${balance.toLocaleString("en-IN")}*`;
    else if(collected>0) msg += `\n✓ Fully settled`;
  }
  if(type==="customer"&&record.pending>0) msg+=`\n⚠️ Pending: ₹${(record.pending||0).toLocaleString("en-IN")}`;
  msg += `\n\n_${co}_`;
  const encoded = encodeURIComponent(msg);
  // Use phone as-is; strip non-digits and let WhatsApp handle routing.
  // If number starts with 0, drop the leading 0 (local format) and prepend nothing —
  // WhatsApp resolves it from the user's own country. For fully international numbers
  // stored with +, pass them directly.
  let waPhone = phone.replace(/\D/g,"");
  if(waPhone.startsWith("0")) waPhone=waPhone.slice(1);
  const url = waPhone ? `https://wa.me/${waPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  window.open(url,"_blank","noopener");
}

function exportCSV(data, fname, cols) {
  const esc = v => { const s=String(v==null?"":v); return s.includes(",")||s.includes('"')||s.includes("\n")?`"${s.replace(/"/g,'""')}"`:`${s}`; };
  const csv = [cols.map(c=>esc(c.label)).join(","), ...data.map(r=>cols.map(c=>esc(typeof c.val==="function"?c.val(r):r[c.key]??(""))).join(","))].join("\n");
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"})); a.download=`${fname}_${today()}.csv`; a.click(); URL.revokeObjectURL(a.href);
}

// eslint-disable-next-line no-unused-vars
function exportWord(record, products, type, settings) {
  const rows = lineRows(record.orderLines||{}, products);
  const total= lineTotal(record.orderLines||{});
  const name = record.name||record.customer||"—";
  const co   = settings?.companyName||"TAS Healthy World";
  const cosub= settings?.companySubtitle||"Malabar Paratha Factory · Goa, India";
  const gst  = settings?.companyGST||"";
  const coPhone=settings?.companyPhone||"";
  const invoiceNo=record.invNo||`INV-${(record.date||today()).replace(/-/g,"")}-${(record.id||uid()).slice(-4).toUpperCase()}`;
  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
<head><meta charset='utf-8'><title>Invoice — ${name}</title>
<style>
  @page{size:A4;margin:2cm 2.2cm}
  body{font-family:'Calibri',Arial,sans-serif;font-size:11pt;color:#1c1917;line-height:1.5}
  .header-table{width:100%;border-collapse:collapse;margin-bottom:20pt}
  .brand{font-size:18pt;font-weight:700;color:#78350f;letter-spacing:-0.3pt}
  .brand-sub{font-size:9pt;color:#78716c;margin-top:2pt}
  .inv-title{font-size:28pt;font-weight:700;color:#1c1917;text-align:right;letter-spacing:-1pt}
  .inv-meta{font-size:9pt;color:#78716c;text-align:right;margin-top:2pt}
  .divider{border:none;border-top:2pt solid #e7e5e4;margin:14pt 0}
  .section-label{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5pt;color:#a8a29e;margin:14pt 0 6pt 0}
  .bill-name{font-size:14pt;font-weight:700;color:#1c1917}
  .bill-detail{font-size:10pt;color:#78716c;margin-top:2pt}
  table.items{width:100%;border-collapse:collapse;margin-top:6pt}
  table.items th{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:0.8pt;color:#a8a29e;padding:7pt 8pt;border-bottom:2pt solid #e7e5e4;text-align:left}
  table.items th.r{text-align:right}
  table.items td{padding:8pt 8pt;border-bottom:1pt solid #f5f5f4;font-size:11pt;color:#1c1917}
  table.items td.r{text-align:right}
  table.items tr.total-row td{font-weight:700;font-size:13pt;border-bottom:none;border-top:2pt solid #1c1917;padding-top:10pt}
  .summary-box{background:#f9f7f5;border:1pt solid #e7e5e4;border-radius:6pt;padding:12pt 16pt;margin-top:16pt}
  .summary-label{font-size:9pt;color:#78716c;text-transform:uppercase;letter-spacing:0.5pt}
  .summary-value{font-size:15pt;font-weight:700;color:#1c1917;margin-top:2pt}
  .paid-val{color:#059669}
  .due-val{color:#dc2626}
  .footer{margin-top:36pt;text-align:center;font-size:8.5pt;color:#a8a29e;border-top:1pt solid #e7e5e4;padding-top:14pt}
</style></head><body>
<table class="header-table"><tr>
  <td style="vertical-align:top;width:55%">
    <div class="brand">🫓 ${co}</div>
    <div class="brand-sub">${cosub}</div>
    ${coPhone?`<div class="brand-sub">📞 ${coPhone}</div>`:""}
    ${gst?`<div class="brand-sub">GST: ${gst}</div>`:""}
  </td>
  <td style="vertical-align:top;width:45%">
    <div class="inv-title">INVOICE</div>
    <div class="inv-meta">${invoiceNo}</div>
    <div class="inv-meta">Date: ${record.date||today()}</div>
    ${record.deliveryDate?`<div class="inv-meta">Deliver by: ${record.deliveryDate}</div>`:""}
    <div class="inv-meta">Ref: #${(record.id||"").slice(-8)}</div>
  </td>
</tr></table>
<hr class="divider"/>
<div class="section-label">Bill To</div>
<div class="bill-name">${name}</div>
${record.phone?`<div class="bill-detail">📞 ${record.phone}</div>`:""}
${record.address?`<div class="bill-detail">📍 ${record.address}</div>`:""}
${record.joinDate?`<div class="bill-detail">Customer since: ${record.joinDate}</div>`:""}
${record.status?`<div class="bill-detail" style="margin-top:6pt"><b>Status:</b> ${record.status}</div>`:""}
<div class="section-label" style="margin-top:18pt">Items</div>
<table class="items">
  <tr><th>Product</th><th>Unit</th><th class="r">Qty</th><th class="r">Unit Price</th><th class="r">Amount</th></tr>
  ${rows.map(r=>`<tr><td><b>${r.name}</b></td><td>${r.unit}</td><td class="r">${r.qty}</td><td class="r">${inr(r.priceAmount)}</td><td class="r">${inr(r.qty*r.priceAmount)}</td></tr>`).join("")}
  <tr class="total-row"><td colspan="4"><b>Total</b></td><td class="r"><b>${inr(total)}</b></td></tr>
</table>
${type==="customer"?`
<div class="section-label" style="margin-top:18pt">Payment Summary</div>
<div class="summary-box">
  <table style="width:100%;border-collapse:collapse">
    <tr>
      <td style="width:33%;text-align:center">
        <div class="summary-label">Paid</div>
        <div class="summary-value paid-val">${inr(record.paid||0)}</div>
      </td>
      <td style="width:33%;text-align:center;border-left:1pt solid #e7e5e4">
        <div class="summary-label">Outstanding</div>
        <div class="summary-value ${(record.pending||0)>0?"due-val":"paid-val"}">${inr(record.pending||0)}</div>
      </td>
      <td style="width:33%;text-align:center;border-left:1pt solid #e7e5e4">
        <div class="summary-label">Status</div>
        <div class="summary-value ${(record.pending||0)>0?"due-val":"paid-val"}">${(record.pending||0)>0?"UNPAID":"✓ PAID"}</div>
      </td>
    </tr>
  </table>
</div>`:``}
<div class="footer">Thank you for your business · ${co} · ${new Date().toLocaleString("en-IN")}</div>
</body></html>`;
  const blob2=new Blob(["\ufeff"+html],{type:"application/msword"});
  const a2=document.createElement("a"); a2.href=URL.createObjectURL(blob2); a2.download=`invoice_${name.replace(/\s+/g,"_")}_${today()}.doc`;
  document.body.appendChild(a2); a2.click(); setTimeout(()=>{document.body.removeChild(a2);URL.revokeObjectURL(a2.href);},1000);
}

// ─── HIGH-QUALITY TAB EXPORT — PDF ──────────────────────────────────────────
function exportTabPDF(tabName, data, columns, settings, extraHtml="") {
  const co     = settings?.companyName||"TAS Healthy World";
  const cosub  = settings?.companySubtitle||"";
  const gst    = settings?.companyGST||"";
  const coPhone= settings?.companyPhone||"";
  const now = new Date().toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
  const rows = data.map(row=>
    `<tr>${columns.map(c=>{
      const v=typeof c.val==="function"?c.val(row):(row[c.key]??(""));
      return `<td class="${c.cls||""}">${v}</td>`;
    }).join("")}</tr>`
  ).join("");
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${tabName} — ${co}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
body{font-family:'Inter',Arial,sans-serif;color:#0f172a;background:#fff;padding:0}
.cover{background:linear-gradient(135deg,#0f1923 0%,#1e3a5f 100%);color:#fff;padding:40px 48px 36px;position:relative;overflow:hidden}
.cover::after{content:'';position:absolute;top:-60px;right:-60px;width:240px;height:240px;border-radius:50%;background:rgba(255,255,255,0.04)}
.co-name{font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;opacity:0.6;margin-bottom:10px}
.report-title{font-size:34px;font-weight:900;letter-spacing:-0.03em;line-height:1.1;margin-bottom:6px}
.report-meta{font-size:12px;opacity:0.5;margin-top:10px}
.content{padding:40px 48px}
.stats-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px;margin-bottom:32px}
.stat-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px}
.stat-val{font-size:22px;font-weight:900;color:#0f172a;line-height:1}
.stat-lbl{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-top:5px}
table{width:100%;border-collapse:collapse;font-size:12.5px}
thead tr{background:#f1f5f9}
th{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#64748b;padding:10px 14px;text-align:left;border-bottom:2px solid #e2e8f0}
td{padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#1e293b;vertical-align:top}
tr:last-child td{border-bottom:none}
tbody tr:nth-child(even) td{background:#f8fafc}
.r{text-align:right}
.c{text-align:center}
.green{color:#059669;font-weight:700}
.red{color:#dc2626;font-weight:700}
.amber{color:#d97706;font-weight:700}
.badge{display:inline-block;padding:2px 9px;border-radius:20px;font-size:9.5px;font-weight:700}
.badge-g{background:#dcfce7;color:#15803d}
.badge-r{background:#fee2e2;color:#b91c1c}
.badge-y{background:#fef9c3;color:#92400e}
.badge-b{background:#dbeafe;color:#1e40af}
.footer{padding:24px 48px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94a3b8;margin-top:32px}
@media print{@page{size:A4 landscape;margin:0}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.cover{padding:28px 36px}.no-print{display:none!important}}
</style></head><body>
<div class="cover">
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <div class="co-name">🫓 ${co}</div>
      ${cosub?`<div style="font-size:11px;opacity:0.5;margin-bottom:4px">${cosub}</div>`:""}
      ${gst?`<div style="font-size:11px;opacity:0.5;margin-bottom:2px">GST: ${gst}</div>`:""}
      ${coPhone?`<div style="font-size:11px;opacity:0.5">📞 ${coPhone}</div>`:""}
    </div>
    <div style="text-align:right;opacity:0.5;font-size:10px;margin-top:4px">
      <div>Exported: ${now}</div>
      <div>${data.length} records</div>
    </div>
  </div>
  <div class="report-title" style="margin-top:16px">${tabName}<br>Report</div>
</div>
<div class="content">
  ${extraHtml}
  <table>
    <thead><tr>${columns.map(c=>`<th class="${c.cls||""}">${c.label}</th>`).join("")}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>
<div class="print-bar no-print" style="position:fixed;top:0;left:0;right:0;background:#0f1923;color:#fff;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;z-index:9999;font-family:Inter,Arial,sans-serif;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.4);gap:12px"><span style="font-weight:700">📊 ${tabName} Report — ${co}</span><div style="display:flex;gap:8px"><a href="#" onclick="window.print();return false;" style="background:#3b82f6;color:#fff;padding:7px 16px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;white-space:nowrap">🖨 Print / Save PDF</a><a href="#" onclick="var b=document.documentElement.outerHTML;var bl=new Blob([b],{type:'text/html'});var u=URL.createObjectURL(bl);var a=document.createElement('a');a.href=u;a.download='${tabName.replace(/\s+/g,'_')}_export.html';document.body.appendChild(a);a.click();URL.revokeObjectURL(u);return false;" style="background:#059669;color:#fff;padding:7px 16px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;white-space:nowrap">⬇ Download</a></div></div>
<div class="footer">
  <span>${co}${gst?` &nbsp;·&nbsp; GST: ${gst}`:""}${coPhone?` &nbsp;·&nbsp; ${coPhone}`:""} &mdash; Confidential</span>
  <span>${tabName} Export &nbsp;·&nbsp; ${today()}</span>
</div>
</body></html>`;
  // Use blob URL — avoids popup-blocker, works reliably across browsers
  const blob=new Blob([html],{type:"text/html;charset=utf-8"});
  const burl=URL.createObjectURL(blob);
  const a2=document.createElement("a");
  a2.href=burl;a2.target="_blank";a2.rel="noopener";
  document.body.appendChild(a2);a2.click();
  setTimeout(()=>{document.body.removeChild(a2);URL.revokeObjectURL(burl);},1000);
}

// ─── P&L FULL REPORT EXPORT ──────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
function exportPnLReport({co,periodLabel,mData,totRev,totSupC,totExpC,totWasteC,totCost,totProfit,totMargin,totReplDeducted,collectionRate,totDue,totCollected,avgMonthlyRev,avgMonthlyProfit,burnRate,healthScore,healthLabel,healthColor,insights,filtD,filtS,filtE,filtW,customers,deliveries,expenses,supplies,wastage,products,lineTotal,inr,today_fn,settings}){
  const now=new Date().toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
  const pct=(a,b)=>b>0?Math.round(a/b*100):0;
  const expCatBreak=(settings?.expenseCategories||["Gas","Labour","Transport","Packaging","Utilities","Maintenance","Other"]).map(cat=>({cat,total:filtE.filter(e=>e.category===cat).reduce((s,e)=>s+(e.amount||0),0),count:filtE.filter(e=>e.category===cat).length})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
  const supCatBreak=(()=>{const m={};filtS.forEach(s=>{const c=s.category||s.item||"Other";m[c]=(m[c]||0)+(s.cost||0);});return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,10);})();
  const vendorBreak=(()=>{const m={};filtE.forEach(e=>{if(e.vendor)m[e.vendor]=(m[e.vendor]||0)+(e.amount||0);});return Object.entries(m).sort((a,b)=>b[1]-a[1]);})();
  const pmBreak=(()=>{const m={};filtE.forEach(e=>{const p=e.paymentMethod||"Cash";m[p]=(m[p]||0)+(e.amount||0);});return Object.entries(m);})();
  const wasteByProd=(()=>{const m={};filtW.forEach(w=>{if(!m[w.product])m[w.product]={qty:0,cost:0};m[w.product].qty+=(w.qty||0);m[w.product].cost+=(w.cost||0);});return Object.entries(m).sort((a,b)=>b[1].cost-a[1].cost);})();
  const custRows=[...customers].map(c=>{const cd=deliveries.filter(d=>d.customerId===c.id&&d.status==="Delivered");const rev=cd.reduce((s,d)=>s+lineTotal(d.orderLines),0);const repl=cd.reduce((s,d)=>s+(+d.replacement?.amount||0),0);return{name:c.name,orders:deliveries.filter(d=>d.customerId===c.id).length,delivered:cd.length,revenue:Math.max(0,rev-repl),collected:c.paid||0,pending:c.pending||0,avgOrder:cd.length>0?Math.round((rev-repl)/cd.length):0};}).sort((a,b)=>b.revenue-a.revenue);
  const topProd=(()=>{return products.map(p=>{const qty=filtD.reduce((s,d)=>s+(d.orderLines?.[p.id]?.qty||0),0);const rev=filtD.reduce((s,d)=>s+(d.orderLines?.[p.id]?.qty||0)*(d.orderLines?.[p.id]?.priceAmount||0),0);return{name:p.name||p.id,qty,rev};}).filter(x=>x.qty>0).sort((a,b)=>b.rev-a.rev);})();
  const statCard=(label,val,color="#0f172a")=>`<div class="sc"><div class="sv" style="color:${color}">${val}</div><div class="sl">${label}</div></div>`;
  const barRow=(label,val,pct2,color,sub="")=>`<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px"><span style="font-weight:600;font-size:12px">${label}</span><div style="text-align:right"><span style="font-weight:800;color:${color};font-size:13px">${val}</span>${sub?`<span style="color:#94a3b8;font-size:10px;margin-left:6px">${sub}</span>`:""}</div></div><div style="height:5px;background:#e2e8f0;border-radius:5px;overflow:hidden"><div style="width:${Math.min(pct2,100)}%;height:100%;background:${color};border-radius:5px"></div></div></div>`;
  const section=(title,content)=>`<div class="sect"><div class="sh">${title}</div>${content}</div>`;
  const tableHtml=(headers,rows2)=>`<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows2}</tbody></table>`;
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>P&L Report — ${co}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;background:#fff;font-size:13px}
.cover{background:linear-gradient(135deg,#0f1923 0%,#1a3a5f 60%,#0a2a1a 100%);color:#fff;padding:44px 52px 40px;position:relative;overflow:hidden}
.cover::before{content:'P&L';position:absolute;right:-20px;top:-40px;font-size:200px;font-weight:900;opacity:0.04;letter-spacing:-10px;color:#fff}
.co{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.5;margin-bottom:12px}
.title{font-size:38px;font-weight:900;letter-spacing:-.03em;line-height:1.1;margin-bottom:8px}
.meta{font-size:11px;opacity:.45;margin-top:8px}
.hero{display:flex;gap:14px;margin-top:22px;flex-wrap:wrap}
.hk{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:14px 18px;min-width:140px}
.hkv{font-size:24px;font-weight:900;line-height:1}
.hkl{font-size:9px;text-transform:uppercase;letter-spacing:.08em;opacity:.5;margin-top:4px}
.content{padding:36px 52px}
.sect{margin-bottom:32px}
.sh{font-size:9px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;color:#94a3b8;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #f1f5f9}
.stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:24px}
.sc{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px}
.sv{font-size:20px;font-weight:900;line-height:1}
.sl{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-top:5px}
table{width:100%;border-collapse:collapse;font-size:11.5px;margin-top:8px}
thead tr{background:#f1f5f9}
th{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:#64748b;padding:9px 12px;text-align:left;border-bottom:2px solid #e2e8f0;white-space:nowrap}
td{padding:9px 12px;border-bottom:1px solid #f1f5f9;color:#1e293b;vertical-align:top}
tr:last-child td{border-bottom:none}
tbody tr:nth-child(even) td{background:#f8fafc}
.r{text-align:right}.c{text-align:center}
.g{color:#059669;font-weight:700}.r2{color:#dc2626;font-weight:700}.a{color:#d97706;font-weight:700}.p{color:#7c3aed;font-weight:700}
.badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:9px;font-weight:800}
.bg{background:#dcfce7;color:#15803d}.br{background:#fee2e2;color:#b91c1c}.by{background:#fef9c3;color:#92400e}.bb{background:#dbeafe;color:#1e40af}
.insight{display:flex;gap:10px;padding:10px 14px;background:#f8fafc;border-left:3px solid #3b82f6;border-radius:0 10px 10px 0;margin-bottom:8px}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:18px 20px}
.footer{padding:20px 52px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94a3b8;margin-top:40px}
.no-print{position:fixed;top:0;left:0;right:0;background:#0f1923;color:#fff;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;z-index:9999;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,.4);gap:12px}
@media print{@page{size:A4;margin:16mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none!important}.cover{padding:32px 40px}.content{padding:24px 40px}}
</style></head><body>
<div class="no-print"><span style="font-weight:700">📈 P&L Report — ${co} · ${periodLabel}</span><div style="display:flex;gap:8px"><a href="#" onclick="window.print();return false;" style="background:#3b82f6;color:#fff;padding:7px 16px;border-radius:8px;text-decoration:none;font-weight:700;font-size:12px">🖨 Print / Save PDF</a><a href="#" onclick="var b=document.documentElement.outerHTML;var bl=new Blob([b],{type:'text/html'});var u=URL.createObjectURL(bl);var a=document.createElement('a');a.href=u;a.download='PnL_${today_fn().replace(/-/g,'')}.html';document.body.appendChild(a);a.click();URL.revokeObjectURL(u);return false;" style="background:#059669;color:#fff;padding:7px 16px;border-radius:8px;text-decoration:none;font-weight:700;font-size:12px">⬇ Download</a></div></div>
<div class="cover">
  <div class="co">🫓 ${co}</div>
  <div class="title">Profit &amp; Loss<br>Report</div>
  <div class="meta">Period: ${periodLabel} &nbsp;·&nbsp; Exported ${now}</div>
  <div class="hero">
    <div class="hk"><div class="hkv" style="color:#10b981">${inr(totRev)}</div><div class="hkl">Net Revenue</div></div>
    <div class="hk"><div class="hkv" style="color:#ef4444">${inr(totCost)}</div><div class="hkl">Total Costs</div></div>
    <div class="hk"><div class="hkv" style="color:${totProfit>=0?"#10b981":"#ef4444"}">${inr(totProfit)}</div><div class="hkl">Net Profit / Loss</div></div>
    <div class="hk"><div class="hkv" style="color:${healthColor}">${healthScore}/100</div><div class="hkl">Health Score · ${healthLabel}</div></div>
    <div class="hk"><div class="hkv">${totMargin}%</div><div class="hkl">Net Margin</div></div>
    <div class="hk"><div class="hkv">${collectionRate}%</div><div class="hkl">Collection Rate</div></div>
  </div>
</div>
<div class="content">

${section("Executive Summary",`
<div class="stats">
  ${statCard("Total Revenue",inr(totRev),"#059669")}
  ${statCard("Supply Costs",inr(totSupC),"#7c3aed")}
  ${statCard("Operating Expenses",inr(totExpC),"#dc2626")}
  ${statCard("Wastage Losses",inr(totWasteC),"#ea580c")}
  ${statCard("Total Costs",inr(totCost),"#dc2626")}
  ${statCard("Net Profit",inr(totProfit),totProfit>=0?"#059669":"#dc2626")}
  ${statCard("Net Margin",totMargin+"%",totMargin>=30?"#059669":totMargin>=15?"#d97706":"#dc2626")}
  ${statCard("Replacement Deductions",inr(totReplDeducted),"#94a3b8")}
  ${statCard("Cash Collected",inr(totCollected),"#059669")}
  ${statCard("Cash Pending",inr(totDue),totDue>0?"#dc2626":"#059669")}
  ${statCard("Avg Monthly Revenue",inr(avgMonthlyRev),"#0ea5e9")}
  ${statCard("Avg Monthly Profit",inr(avgMonthlyProfit),avgMonthlyProfit>=0?"#059669":"#dc2626")}
  ${statCard("Avg Monthly Burn",inr(burnRate),"#f97316")}
</div>`)}

${insights.length>0?section("Smart Insights",insights.map(i=>`<div class="insight"><span style="font-size:16px">${i.icon}</span><p style="font-size:12px;line-height:1.6">${i.text}</p></div>`).join("")):""}

${section("Revenue Breakdown",`
<div class="two-col">
  <div class="card">
    <div class="sh" style="margin-bottom:10px">By Month</div>
    ${mData.map(m=>barRow(m.monthFull,inr(m.revenue),pct(m.revenue,Math.max(...mData.map(x=>x.revenue),1)),"#059669",`${m.deliveriesCount} deliveries`)).join("")}
  </div>
  <div class="card">
    <div class="sh" style="margin-bottom:10px">Top Customers</div>
    ${custRows.slice(0,8).map((c,i)=>barRow(`${i+1}. ${c.name}`,inr(c.revenue),pct(c.revenue,custRows[0]?.revenue||1),"#f59e0b",`${c.delivered} orders · ${Math.round(pct(c.revenue,custRows.reduce((s,x)=>s+x.revenue,0)))}% share`)).join("")}
  </div>
</div>`)}

${section("Cost Structure",`
<div class="two-col">
  <div class="card">
    <div class="sh" style="margin-bottom:10px">Supply Costs — By Item / Category</div>
    ${supCatBreak.map(([cat,v])=>barRow(cat,inr(v),pct(v,totSupC),"#7c3aed")).join("")||"<p style='color:#94a3b8;font-size:12px'>No supplies in period</p>"}
  </div>
  <div class="card">
    <div class="sh" style="margin-bottom:10px">Operating Expenses — By Category</div>
    ${expCatBreak.map(c=>barRow(c.cat,inr(c.total),pct(c.total,totExpC),"#dc2626",`${c.count} entries`)).join("")||"<p style='color:#94a3b8;font-size:12px'>No expenses in period</p>"}
  </div>
</div>
${vendorBreak.length>0?`<div class="two-col" style="margin-top:16px">
  <div class="card">
    <div class="sh" style="margin-bottom:10px">Expenses by Vendor</div>
    ${vendorBreak.map(([vendor,v])=>barRow(vendor,inr(v),pct(v,totExpC),"#ef4444")).join("")}
  </div>
  <div class="card">
    <div class="sh" style="margin-bottom:10px">Expenses by Payment Method</div>
    ${pmBreak.map(([pm,v])=>barRow(pm,inr(v),pct(v,totExpC),"#8b5cf6")).join("")}
  </div>
</div>`:""}
${wasteByProd.length>0?`<div class="card" style="margin-top:16px">
  <div class="sh" style="margin-bottom:10px">Wastage by Product</div>
  ${tableHtml(["Product","Qty Wasted","Cost"],wasteByProd.map(([p,d])=>`<tr><td>${p}</td><td>${d.qty} units</td><td class="r2">${inr(d.cost)}</td></tr>`).join(""))}
</div>`:""}`)}

${section("Monthly P&L Breakdown",tableHtml(
  ["Month","Deliveries","Revenue","Supply","Expenses","Waste","Replacements","Total Cost","Profit / Loss","Margin","Gross Margin"],
  mData.map(m=>`<tr>
    <td style="font-weight:700">${m.monthFull}</td>
    <td class="c">${m.deliveriesCount}</td>
    <td class="g">${inr(m.revenue)}</td>
    <td class="p">${inr(m.supplyCost)}</td>
    <td class="r2">${inr(m.expenses)}</td>
    <td style="color:#ea580c;font-weight:600">${inr(m.wasteCost)}</td>
    <td style="color:#94a3b8">${inr(m.replDeducted||0)}</td>
    <td class="r2">${inr(m.totalCost)}</td>
    <td class="${m.profit>=0?"g":"r2"}">${inr(m.profit)}</td>
    <td class="c"><span class="badge ${m.margin>=30?"bg":m.margin>=15?"by":"br"}">${m.margin}%</span></td>
    <td class="c"><span class="badge bb">${m.grossMargin||0}%</span></td>
  </tr>`).join("")+`
  <tr style="background:#f1f5f9;font-weight:900;border-top:2px solid #e2e8f0">
    <td>TOTAL</td><td class="c">${filtD.length}</td>
    <td class="g">${inr(totRev)}</td><td class="p">${inr(totSupC)}</td>
    <td class="r2">${inr(totExpC)}</td><td style="color:#ea580c;font-weight:700">${inr(totWasteC)}</td>
    <td style="color:#94a3b8">${inr(totReplDeducted)}</td>
    <td class="r2">${inr(totCost)}</td>
    <td class="${totProfit>=0?"g":"r2"}">${inr(totProfit)}</td>
    <td class="c"><span class="badge ${totMargin>=30?"bg":totMargin>=15?"by":"br"}">${totMargin}%</span></td>
    <td></td>
  </tr>`))}

${section("Customer Revenue & Collection", tableHtml(
  ["#","Customer","Orders","Delivered","Revenue","Collected","Pending","Avg Order","Coll. Rate"],
  custRows.map((c,i)=>`<tr>
    <td class="c" style="color:#94a3b8;font-weight:700">${i+1}</td>
    <td style="font-weight:600">${c.name}</td>
    <td class="c">${c.orders}</td><td class="c">${c.delivered}</td>
    <td class="g">${inr(c.revenue)}</td>
    <td class="g">${inr(c.collected)}</td>
    <td class="${c.pending>0?"r2":"g"}">${inr(c.pending)}</td>
    <td>${inr(c.avgOrder)}</td>
    <td class="c"><span class="badge ${(c.collected+c.pending>0?Math.round(c.collected/(c.collected+c.pending)*100):100)>=90?"bg":(c.collected+c.pending>0?Math.round(c.collected/(c.collected+c.pending)*100):100)>=60?"by":"br"}">${c.collected+c.pending>0?Math.round(c.collected/(c.collected+c.pending)*100):100}%</span></td>
  </tr>`).join("")))}

${topProd.length>0?section("Product Sales (Period)", tableHtml(
  ["Product","Qty Sold","Revenue"],
  topProd.map(p=>`<tr><td style="font-weight:600">${p.name}</td><td class="c">${p.qty}</td><td class="g">${inr(p.rev)}</td></tr>`).join(""))):""}

${filtE.length>0?section("Expense Paper Trail — All Entries", tableHtml(
  ["Date","Category","Amount","Vendor","Payment","Approved By","Receipt","Tags","Notes"],
  [...filtE].sort((a,b)=>a.date.localeCompare(b.date)).map(e=>`<tr>
    <td style="white-space:nowrap">${e.date}</td>
    <td><span class="badge br">${e.category}</span></td>
    <td class="r2">${inr(e.amount)}</td>
    <td>${e.vendor||"—"}</td>
    <td>${e.paymentMethod||"Cash"}</td>
    <td>${e.approvedBy||"—"}</td>
    <td>${e.receipt||"—"}</td>
    <td>${e.tags||"—"}</td>
    <td style="color:#64748b">${e.notes||"—"}</td>
  </tr>`).join(""))):""}

${filtS.length>0?section("Supply Paper Trail — All Entries", tableHtml(
  ["Date","Item","Category","Qty","Unit","Cost","Supplier","Notes"],
  [...filtS].sort((a,b)=>a.date.localeCompare(b.date)).map(s=>`<tr>
    <td style="white-space:nowrap">${s.date}</td>
    <td style="font-weight:600">${s.item||"—"}</td>
    <td>${s.category||"—"}</td>
    <td class="c">${s.qty||"—"}</td>
    <td>${s.unit||"—"}</td>
    <td class="p">${inr(s.cost)}</td>
    <td>${s.supplier||"—"}</td>
    <td style="color:#64748b">${s.notes||"—"}</td>
  </tr>`).join(""))):""}

</div>
<div class="footer"><span>${co} &mdash; Confidential. P&L Report.</span><span>Generated ${now} &nbsp;·&nbsp; Period: ${periodLabel}</span></div>
</body></html>`;
  const blob=new Blob([html],{type:"text/html;charset=utf-8"});
  const burl=URL.createObjectURL(blob);
  const a2=document.createElement("a");
  a2.href=burl;a2.target="_blank";a2.rel="noopener";
  document.body.appendChild(a2);a2.click();
  setTimeout(()=>{document.body.removeChild(a2);URL.revokeObjectURL(burl);},1000);
}

// eslint-disable-next-line no-unused-vars
function exportPnLCSV({mData,filtD,filtE,filtS,filtW,customers,deliveries,expenses,supplies,wastage,products,lineTotal,today_fn,periodLabel}){
  const rows=[];
  const esc=v=>typeof v==="string"&&(v.includes(",")||v.includes('"')||v.includes("\n"))?`"${v.replace(/"/g,'""')}"`:(v??"-");
  const row=arr=>arr.map(esc).join(",");
  // Section: Monthly Summary
  rows.push(row(["=== MONTHLY P&L SUMMARY ===","Period: "+periodLabel]));
  rows.push(row(["Month","Deliveries","Revenue","Supply Cost","Op Expenses","Waste Cost","Replacements","Total Cost","Profit/Loss","Net Margin %","Gross Margin %"]));
  mData.forEach(m=>rows.push(row([m.monthFull,m.deliveriesCount,m.revenue,m.supplyCost,m.expenses,m.wasteCost,m.replDeducted||0,m.totalCost,m.profit,m.margin,m.grossMargin||0])));
  const totRevC=mData.reduce((s,m)=>s+m.revenue,0);
  const totSupCC=mData.reduce((s,m)=>s+m.supplyCost,0);
  const totExpCC=mData.reduce((s,m)=>s+m.expenses,0);
  const totWasteCC=mData.reduce((s,m)=>s+m.wasteCost,0);
  const totReplC=mData.reduce((s,m)=>s+(m.replDeducted||0),0);
  const totCostC=mData.reduce((s,m)=>s+m.totalCost,0);
  const totProfC=mData.reduce((s,m)=>s+m.profit,0);
  const totMarC=totRevC>0?Math.round(totProfC/totRevC*100):0;
  rows.push(row(["TOTAL",filtD.length,totRevC,totSupCC,totExpCC,totWasteCC,totReplC,totCostC,totProfC,totMarC,""]));
  rows.push([""]);
  // Section: Customer Revenue
  rows.push(row(["=== CUSTOMER REVENUE & COLLECTION ==="]));
  rows.push(row(["Customer","Total Orders","Delivered","Revenue","Collected","Pending","Avg Order Value","Collection Rate %"]));
  [...customers].map(c=>{const cd=deliveries.filter(d=>d.customerId===c.id&&d.status==="Delivered");const rev=cd.reduce((s,d)=>s+lineTotal(d.orderLines)-(+d.replacement?.amount||0),0);return{name:c.name,orders:deliveries.filter(d=>d.customerId===c.id).length,delivered:cd.length,revenue:Math.max(0,rev),collected:c.paid||0,pending:c.pending||0,avg:cd.length>0?Math.round(Math.max(0,rev)/cd.length):0,rate:c.paid+c.pending>0?Math.round(c.paid/(c.paid+c.pending)*100):100};}).sort((a,b)=>b.revenue-a.revenue).forEach(c=>rows.push(row([c.name,c.orders,c.delivered,c.revenue,c.collected,c.pending,c.avg,c.rate+"%"])));
  rows.push([""]);
  // Section: Delivery paper trail
  rows.push(row(["=== DELIVERY PAPER TRAIL ==="]));
  rows.push(row(["Invoice No","Receipt No","Date","Customer","Status","Order Total","Repl Amount","Net Amount","Collected","Balance Due","Replacement Item","Notes"]));
  [...filtD].sort((a,b)=>a.date.localeCompare(b.date)).forEach(d=>{const inv=d.invNo||`INV-${(d.date||"").replace(/-/g,"")}-${(d.id||"").slice(-4).toUpperCase()}`;const rcp=`RCP-${inv.replace(/^[A-Z]+-/,"")}`;const tot=lineTotal(d.orderLines);const repl=+(d.replacement?.amount)||0;const net=Math.max(0,tot-repl);const coll=d.partialPayment?.enabled?(+(d.partialPayment?.amount)||0):0;const bal=Math.max(0,net-coll);rows.push(row([inv,rcp,d.date,d.customer,d.status,tot,repl,net,coll,bal,d.replacement?.done?(d.replacement.item||""):"",d.notes||""]));});
  rows.push([""]);
  // Section: Expenses paper trail
  rows.push(row(["=== EXPENSE PAPER TRAIL ==="]));
  rows.push(row(["Date","Category","Amount","Vendor","Payment Method","Approved By","Receipt","Tags","Notes","Created At"]));
  [...filtE].sort((a,b)=>a.date.localeCompare(b.date)).forEach(e=>rows.push(row([e.date,e.category,e.amount,e.vendor||"",e.paymentMethod||"Cash",e.approvedBy||"",e.receipt||"",e.tags||"",e.notes||"",e.createdAt||""])));
  rows.push([""]);
  // Section: Supply paper trail
  rows.push(row(["=== SUPPLY PAPER TRAIL ==="]));
  rows.push(row(["Date","Item","Category","Qty","Unit","Cost","Supplier","Notes"]));
  [...filtS].sort((a,b)=>a.date.localeCompare(b.date)).forEach(s=>rows.push(row([s.date,s.item||"",s.category||"",s.qty||"",s.unit||"",s.cost||0,s.supplier||"",s.notes||""])));
  rows.push([""]);
  // Section: Wastage paper trail
  rows.push(row(["=== WASTAGE PAPER TRAIL ==="]));
  rows.push(row(["Date","Product","Qty","Unit","Type","Reason","Cost","Logged By"]));
  [...filtW].sort((a,b)=>a.date.localeCompare(b.date)).forEach(w=>rows.push(row([w.date,w.product||"",w.qty||"",w.unit||"",w.type||"",w.reason||"",w.cost||0,w.loggedBy||""])));
  const csv=rows.map(r=>Array.isArray(r)?r.join(""):r).join("\n");
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
  const burl=URL.createObjectURL(blob);
  const a2=document.createElement("a");
  a2.href=burl;a2.download=`PnL_full_${today_fn().replace(/-/g,"")}.csv`;
  document.body.appendChild(a2);a2.click();
  setTimeout(()=>{document.body.removeChild(a2);URL.revokeObjectURL(burl);},1000);
}

// ─── HIGH-QUALITY TAB EXPORT — EXCEL (XLSX-compatible) ──────────────────────
function exportTabExcel(tabName, data, columns, settings) {
  const co  = settings?.companyName||"TAS Healthy World";
  const now = new Date().toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
  // Build XML for a real .xlsx using SpreadsheetML
  const esc = v=>String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const isNum = v=>v!==null&&v!==undefined&&v!==""&&!isNaN(Number(String(v).replace(/[₹,]/g,"")));
  const numVal= v=>Number(String(v).replace(/[₹,]/g,""));

  // Header row style index 1 = header; 0 = data
  const headerRow=`<Row ss:Index="3" ss:StyleID="s2">
    ${columns.map(c=>`<Cell><Data ss:Type="String">${esc(c.label)}</Data></Cell>`).join("")}
  </Row>`;
  const dataRows=data.map((row,ri)=>{
    const cells=columns.map(c=>{
      const raw=typeof c.val==="function"?c.val(row):(row[c.key]??(""));
      const v=String(raw==null?"":raw);
      if(isNum(v)&&c.num!==false){return `<Cell ss:StyleID="s3"><Data ss:Type="Number">${numVal(v)}</Data></Cell>`;}
      return `<Cell ss:StyleID="${ri%2===0?"s3":"s4"}"><Data ss:Type="String">${esc(v)}</Data></Cell>`;
    });
    return `<Row>${cells.join("")}</Row>`;
  }).join("\n");
  // Build totals row for numeric columns
  const totalsRow=`<Row ss:StyleID="s6">
    ${columns.map((c,ci)=>{
      if(c.num!==false){
        const colTotal=data.reduce((s,row)=>{
          const raw=typeof c.val==="function"?c.val(row):(row[c.key]??(""));
          const v=String(raw==null?"":raw);
          return s+(isNum(v)?numVal(v):0);
        },0);
        if(colTotal!==0){return `<Cell ss:StyleID="s6"><Data ss:Type="Number">${colTotal}</Data></Cell>`;}
      }
      return `<Cell ss:StyleID="s6"><Data ss:Type="String">${ci===0?esc("TOTAL ("+data.length+" records)"):"—"}</Data></Cell>`;
    }).join("")}
  </Row>`;

  const xml=`<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:x="urn:schemas-microsoft-com:office:excel">
<DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>${esc(tabName)} — ${esc(co)}</Title>
  <Author>${esc(co)}</Author>
  <Created>${new Date().toISOString()}</Created>
</DocumentProperties>
<Styles>
  <Style ss:ID="s1"><Font ss:Bold="1" ss:Size="14"/><Alignment ss:Horizontal="Left"/></Style>
  <Style ss:ID="s2"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0F1923" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#3B82F6"/></Borders></Style>
  <Style ss:ID="s3"><Alignment ss:Horizontal="Left" ss:WrapText="1"/></Style>
  <Style ss:ID="s4"><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/><Alignment ss:Horizontal="Left" ss:WrapText="1"/></Style>
  <Style ss:ID="s5"><Font ss:Italic="1" ss:Color="#94A3B8" ss:Size="9"/></Style>
  <Style ss:ID="s6"><Font ss:Bold="1" ss:Color="#0F172A"/><Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#1E3A5F"/></Borders><Alignment ss:Horizontal="Left" ss:WrapText="1"/></Style>
</Styles>
<Worksheet ss:Name="${esc(tabName)}">
<Table>
  <Row ss:StyleID="s1">
    <Cell ss:MergeAcross="${columns.length-1}"><Data ss:Type="String">🫓 ${esc(co)} — ${esc(tabName)} Report</Data></Cell>
  </Row>
  <Row ss:StyleID="s5">
    <Cell ss:MergeAcross="${columns.length-1}"><Data ss:Type="String">Exported on: ${esc(now)} · ${data.length} records</Data></Cell>
  </Row>
  ${headerRow}
  ${dataRows}
  ${totalsRow}
</Table>
<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
  <FreezePanes/><FrozenNoSplit/><SplitHorizontal>3</SplitHorizontal><TopRowBottomPane>3</TopRowBottomPane>
</WorksheetOptions>
</Worksheet>
</Workbook>`;
  const blob=new Blob([xml],{type:"application/vnd.ms-excel;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${tabName.replace(/\s+/g,"_")}_${today()}.xls`;
  document.body.appendChild(a);a.click();setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(a.href);},1000);
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
    {label&&<label style={{color:t.sub,letterSpacing:"0.05em"}} className="crm-form-label block text-[11px] font-semibold uppercase mb-1.5 ml-0.5">{label}</label>}
    <input style={{background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,fontSize:16,WebkitAppearance:"none",borderRadius:12,touchAction:"manipulation",transition:"border-color 0.15s,box-shadow 0.15s",minHeight:48,width:"100%",padding:"12px 14px",outline:"none",display:"block"}} onFocus={e=>{e.target.style.borderColor=dm?"#3b82f6":"#1e3a5f";e.target.style.boxShadow=dm?"0 0 0 3px rgba(59,130,246,0.15)":"0 0 0 3px rgba(30,58,95,0.1)";}} onBlur={e=>{e.target.style.borderColor=t.inpB;e.target.style.boxShadow="none";}} {...p}/>
  </div>;
}
function Sel({label,dm,children,className="",...p}){
  const t=T(dm);
  return <div className={className} style={{position:"relative"}}>
    {label&&<label style={{color:t.sub,letterSpacing:"0.05em"}} className="crm-form-label block text-[11px] font-semibold uppercase mb-1.5 ml-0.5">{label}</label>}
    <select style={{background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,fontSize:16,WebkitAppearance:"none",appearance:"none",borderRadius:12,touchAction:"manipulation",transition:"border-color 0.15s,box-shadow 0.15s",minHeight:48,width:"100%",padding:"12px 38px 12px 14px",outline:"none",display:"block"}} onFocus={e=>{e.target.style.borderColor=dm?"#3b82f6":"#1e3a5f";e.target.style.boxShadow=dm?"0 0 0 3px rgba(59,130,246,0.15)":"0 0 0 3px rgba(30,58,95,0.1)";}} onBlur={e=>{e.target.style.borderColor=t.inpB;e.target.style.boxShadow="none";}} {...p}>{children}</select>
    <span style={{position:"absolute",right:14,top:"50%",transform:`translateY(${label?"-2px":"50%"})`,pointerEvents:"none",color:t.sub,fontSize:11}}>▾</span>
  </div>;
}
function Btn({children,onClick,v="primary",size="md",className="",disabled=false,dm}){
  const t=T(dm);
  const V={
    primary:`background:${t.accent};color:${t.accentFg};border:1.5px solid ${t.accent};`,
    ghost:dm?"background:#1c2128;color:#e6edf3;border:1.5px solid #30363d;":"background:#ffffff;color:#1e3a5f;border:1.5px solid #dde1e8;",
    danger:"background:#dc2626;color:#fff;border:1.5px solid #dc2626;",
    success:"background:#059669;color:#fff;border:1.5px solid #059669;",
    amber:"background:#d97706;color:#fff;border:1.5px solid #d97706;",
    outline:dm?"background:transparent;color:#60a5fa;border:1.5px solid #60a5fa;":"background:transparent;color:#1e3a5f;border:1.5px solid #1e3a5f;",
    sky:"background:#0ea5e9;color:#fff;border:1.5px solid #0ea5e9;",
    purple:"background:#7c3aed;color:#fff;border:1.5px solid #7c3aed;",
  };
  const S={sm:"padding:8px 14px;font-size:13px;min-height:40px;border-radius:10px;",md:"padding:12px 18px;font-size:15px;min-height:50px;border-radius:14px;",lg:"padding:14px 28px;font-size:16px;min-height:54px;border-radius:16px;"};
  const base={fontWeight:600,letterSpacing:"0.01em",cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.45:1,transition:"all 0.15s",WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6};
  const styleStr=(V[v]||V.primary)+(S[size]||S.md);
  const styleObj={...base,...Object.fromEntries(styleStr.split(";").filter(Boolean).map(s=>{const[k,...vs]=s.split(":");const key=k.trim().replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return[key,vs.join(":").trim()];}))};
  return <button onClick={onClick} disabled={disabled} style={styleObj} className={cx("select-none active:scale-[0.96] crm-btn-press",className)}>{children}</button>;
}
function Card({children,className="",dm}){
  const t=T(dm);
  return <div style={{background:t.card,border:`1px solid ${t.border}`,boxShadow:dm?"0 1px 4px rgba(0,0,0,0.4)":"0 1px 3px rgba(0,0,0,0.05),0 1px 2px rgba(0,0,0,0.03)",borderRadius:16}} className={className}>{children}</div>;
}
function StatCard({label,value,sub,accent,dm,animDelay="0.05s"}){
  const t=T(dm);
  return <div style={{background:t.card,border:`1px solid ${t.border}`,boxShadow:dm?"0 1px 4px rgba(0,0,0,0.4)":"0 1px 3px rgba(0,0,0,0.05)",borderRadius:16,borderLeft:`3px solid ${accent}`,"--delay":animDelay,transition:"transform 0.18s,box-shadow 0.18s",cursor:"default"}} className="p-4 relative crm-stat-card crm-list-item">
    <p style={{color:t.sub,letterSpacing:"0.06em",fontSize:10}} className="font-semibold uppercase mb-2">{label}</p>
    <p style={{color:t.text,fontSize:22}} className="font-bold leading-none tracking-tight">{value}</p>
    {sub&&<p style={{color:t.sub,fontSize:12}} className="mt-1.5 font-medium">{sub}</p>}
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
  return <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center crm-sheet-backdrop" style={{background:"rgba(0,0,0,0.65)",WebkitBackdropFilter:"blur(6px)",backdropFilter:"blur(6px)"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div style={{background:t.card,maxHeight:"94svh",border:`1px solid ${t.border}`,boxShadow:"0 -4px 40px rgba(0,0,0,0.4)",borderRadius:"24px 24px 0 0",width:"100%",paddingBottom:"env(safe-area-inset-bottom,0px)"}} className="sm:rounded-2xl sm:max-w-lg sm:w-full sm:mx-4 flex flex-col crm-sheet-panel-mobile sm:crm-sheet-panel-desktop" onClick={e=>e.stopPropagation()}>
      {/* Drag handle — mobile only */}
      <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
        <div style={{width:40,height:4,borderRadius:99,background:t.border}}/>
      </div>
      {/* Header */}
      <div style={{borderBottom:`1px solid ${t.border}`,background:dm?"rgba(28,33,40,0.8)":"rgba(248,250,252,0.9)"}} className="flex items-center justify-between px-5 py-4 shrink-0 sm:rounded-t-2xl">
        <span style={{color:t.text,letterSpacing:"-0.01em",fontSize:16}} className="font-bold">{title}</span>
        <button onClick={onClose} style={{background:t.inp,color:t.sub,border:`1.5px solid ${t.inpB}`,width:36,height:36,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",cursor:"pointer",transition:"all 0.15s",flexShrink:0}}>✕</button>
      </div>
      {/* Content */}
      <div className="px-5 py-5 flex flex-col gap-4 crm-sheet-scroll" style={{overflowY:"auto",WebkitOverflowScrolling:"touch",overscrollBehavior:"contain",paddingBottom:"max(1.5rem, env(safe-area-inset-bottom,0px))"}}>{children}</div>
    </div>
  </div>;
}
function Toast({msg,onDone}){
  useEffect(()=>{const t=setTimeout(onDone,2800);return()=>clearTimeout(t);});
  return <div className="fixed left-1/2 -translate-x-1/2 z-[200] text-sm px-5 py-3.5 font-medium whitespace-nowrap pointer-events-none flex items-center gap-2.5 crm-toast" style={{bottom:"calc(72px + env(safe-area-inset-bottom,0px))",background:"#0f1923",color:"#e6edf3",border:"1px solid #21262d",boxShadow:"0 4px 24px rgba(0,0,0,0.5)",WebkitBackdropFilter:"blur(8px)",backdropFilter:"blur(8px)",borderRadius:14,fontSize:14}}><span style={{width:7,height:7,borderRadius:"50%",background:"#3b82f6",flexShrink:0,display:"inline-block",animation:"pulse-dot 1.5s ease infinite"}}/>{msg}</div>;
}
function Confirm({msg,onYes,onNo,dm}){
  const t=T(dm);if(!msg)return null;
  return <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center px-4 crm-sheet-backdrop" style={{background:"rgba(0,0,0,0.65)",WebkitBackdropFilter:"blur(6px)",backdropFilter:"blur(6px)"}}>
    <div style={{background:t.card,border:`1.5px solid ${t.border}`,boxShadow:"0 20px 60px rgba(0,0,0,0.4)",borderRadius:24,paddingBottom:"env(safe-area-inset-bottom,0px)",width:"100%",maxWidth:380}} className="p-6 flex flex-col gap-5 crm-confirm-modal">
      <div style={{width:44,height:44,borderRadius:12,background:"rgba(220,38,38,0.1)",border:"1.5px solid rgba(220,38,38,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>⚠️</div>
      <div>
        <p style={{color:t.text,fontWeight:700,fontSize:16,marginBottom:6}}>Confirm Action</p>
        <p style={{color:t.sub,fontSize:14,lineHeight:1.6}}>{msg}</p>
      </div>
      <div className="flex gap-3"><Btn dm={dm} v="ghost" size="md" className="flex-1" onClick={onNo}>Cancel</Btn><Btn v="danger" size="md" className="flex-1" onClick={onYes}>Delete</Btn></div>
    </div>
  </div>;
}
function Search({value,onChange,placeholder,dm}){
  const t=T(dm);
  return <div className="relative">
    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder||"Search…"} style={{background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,fontSize:16,WebkitAppearance:"none",touchAction:"manipulation",borderRadius:14,transition:"border-color 0.15s,box-shadow 0.15s",width:"100%",padding:"12px 40px 12px 42px",outline:"none",minHeight:48,display:"block"}} onFocus={e=>{e.target.style.borderColor=dm?"#3b82f6":"#1e3a5f";e.target.style.boxShadow=dm?"0 0 0 3px rgba(59,130,246,0.12)":"0 0 0 3px rgba(30,58,95,0.08)";}} onBlur={e=>{e.target.style.borderColor=t.inpB;e.target.style.boxShadow="none";}}/>
    {value&&<button onClick={()=>onChange("")} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:t.inpB,color:t.sub,width:22,height:22,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,border:"none",cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>✕</button>}
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
//  DETAIL MODAL — Universal deep-dive overlay
//  Renders rich interactive details for any entity clicked
// ═══════════════════════════════════════════════════════════════
function DetailModal({modal, onClose, dm, customers, deliveries, expenses, supplies, wastage, products, settings, setDetailModal, setEsh, setEf, setDsh, setDf, delE, delD, setPaySh, setPayAmt, isAdmin, sess, invRegistry}) {
  const t = T(dm);
  if (!modal) return null;
  const {type, data} = modal;

  const overlayStyle = {
    position:"fixed",inset:0,zIndex:300,background:"rgba(0,0,0,0.72)",
    backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",
    display:"flex",alignItems:"flex-end",justifyContent:"center",overflowY:"auto"
  };
  const panelStyle = {
    background:t.card,border:`1px solid ${t.border}`,borderRadius:"24px 24px 0 0",
    width:"100%",maxWidth:560,maxHeight:"92svh",display:"flex",flexDirection:"column",
    boxShadow:"0 -8px 60px rgba(0,0,0,0.5)",paddingBottom:"env(safe-area-inset-bottom,12px)"
  };
  const Header = ({icon,title,sub,accent})=>(
    <div style={{padding:"20px 22px 16px",borderBottom:`1px solid ${t.border}`,flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:44,height:44,borderRadius:14,background:(accent||"#3b82f6")+"20",border:`1.5px solid ${(accent||"#3b82f6")}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{icon}</div>
          <div>
            <p style={{color:t.text,fontWeight:800,fontSize:15,lineHeight:1.2}}>{title}</p>
            {sub&&<p style={{color:t.sub,fontSize:11,marginTop:2}}>{sub}</p>}
          </div>
        </div>
        <button onClick={onClose} style={{width:36,height:36,borderRadius:10,background:t.inp,border:`1.5px solid ${t.border}`,color:t.sub,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,cursor:"pointer",flexShrink:0}}>✕</button>
      </div>
    </div>
  );
  const Kpi = ({label,val,color,bg})=>(
    <div style={{background:bg||(color+"12"),border:`1px solid ${color}25`,borderRadius:12,padding:"10px 12px",textAlign:"center"}}>
      <p style={{color,fontWeight:900,fontSize:13,lineHeight:1}}>{val}</p>
      <p style={{color:t.sub,fontSize:9,marginTop:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</p>
    </div>
  );
  const Row = ({label,val,color,onClick})=>(
    <div onClick={onClick} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${t.border}`,cursor:onClick?"pointer":"default"}}
      onMouseEnter={ev=>{if(onClick)ev.currentTarget.style.background=t.inp+"88";}} onMouseLeave={ev=>{ev.currentTarget.style.background="transparent";}}>
      <span style={{color:t.sub,fontSize:12}}>{label}</span>
      <span style={{color:color||t.text,fontWeight:700,fontSize:12}}>{val}</span>
    </div>
  );
  const scrollStyle = {overflowY:"auto",WebkitOverflowScrolling:"touch",flex:1,padding:"0 22px 20px"};

  // ── EXPENSE DETAIL ──
  if (type === "expense") {
    const e = data;
    return (
      <div style={overlayStyle} onClick={ev=>{if(ev.target===ev.currentTarget)onClose();}}>
        <div style={panelStyle}>
          <Header icon="💸" title={`${e.category} Expense`} sub={`${e.date}${e.vendor?` · ${e.vendor}`:""}`} accent="#ef4444"/>
          <div style={scrollStyle}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,margin:"16px 0"}}>
              <Kpi label="Amount" val={inr(e.amount||0)} color="#ef4444"/>
              <Kpi label="Method" val={e.paymentMethod||"Cash"} color="#8b5cf6"/>
            </div>
            {e.vendor&&<Row label="Vendor / Payee" val={e.vendor}/>}
            {e.approvedBy&&<Row label="Approved By" val={`✅ ${e.approvedBy}`} color="#10b981"/>}
            {e.receipt&&<Row label="Receipt Ref" val={`🧾 ${e.receipt}`}/>}
            {e.tags&&<Row label="Tags" val={e.tags.split(",").map(tg=>`#${tg.trim()}`).join(" ")} color="#8b5cf6"/>}
            {e.notes&&<div style={{background:t.inp,borderRadius:12,padding:"12px 14px",margin:"12px 0"}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:6}}>Notes</p>
              <p style={{color:t.text,fontSize:13,lineHeight:1.5}}>{e.notes}</p>
            </div>}
            {/* Category context */}
            {(()=>{
              const catTotal = expenses.filter(x=>x.category===e.category).reduce((s,x)=>s+(x.amount||0),0);
              const catCount = expenses.filter(x=>x.category===e.category).length;
              const allTotal = expenses.reduce((s,x)=>s+(x.amount||0),0);
              const pct = allTotal>0?Math.round(catTotal/allTotal*100):0;
              return <div style={{background:t.inp,borderRadius:12,padding:"12px 14px",margin:"12px 0"}}>
                <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:10}}>Category Context — {e.category}</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                  <Kpi label="Category Total" val={inr(catTotal)} color="#ef4444"/>
                  <Kpi label="# Entries" val={catCount} color="#8b5cf6"/>
                  <Kpi label="% of All Exp" val={`${pct}%`} color="#f59e0b"/>
                </div>
                <div style={{marginTop:10,height:5,borderRadius:5,overflow:"hidden",background:t.border}}>
                  <div style={{width:`${pct}%`,background:"#ef4444",height:"100%",borderRadius:5}}/>
                </div>
              </div>;
            })()}
            {/* Vendor history */}
            {e.vendor&&(()=>{
              const vendorExps = expenses.filter(x=>x.vendor===e.vendor).sort((a,b)=>b.date.localeCompare(a.date));
              const vendorTotal = vendorExps.reduce((s,x)=>s+(x.amount||0),0);
              return vendorExps.length>1&&<div style={{margin:"4px 0 12px"}}>
                <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>All Payments to {e.vendor}</p>
                <div style={{border:`1px solid ${t.border}`,borderRadius:10,overflow:"hidden"}}>
                  {vendorExps.map((ve,vi)=>(
                    <div key={ve.id||vi} style={{padding:"8px 12px",display:"grid",gridTemplateColumns:"1fr auto auto",gap:8,borderTop:vi>0?`1px solid ${t.border}`:"none",background:ve.id===e.id?(t.inp+"aa"):"transparent",cursor:"pointer"}}
                      onClick={()=>setDetailModal({type:"expense",data:ve})}>
                      <div>
                        <p style={{color:t.text,fontSize:11,fontWeight:600}}>{ve.category}</p>
                        <p style={{color:t.sub,fontSize:10}}>📅 {ve.date}{ve.paymentMethod?` · ${ve.paymentMethod}`:""}</p>
                      </div>
                      <span style={{color:"#ef4444",fontWeight:800,fontSize:11,alignSelf:"center"}}>{inr(ve.amount)}</span>
                      {ve.id===e.id&&<span style={{color:"#3b82f6",fontSize:9,fontWeight:700,alignSelf:"center"}}>← this</span>}
                    </div>
                  ))}
                  <div style={{padding:"8px 12px",background:t.inp,borderTop:`2px solid ${t.border}`,display:"flex",justifyContent:"space-between"}}>
                    <span style={{color:t.text,fontSize:11,fontWeight:700}}>Total to {e.vendor}</span>
                    <span style={{color:"#ef4444",fontWeight:900,fontSize:12}}>{inr(vendorTotal)}</span>
                  </div>
                </div>
              </div>;
            })()}
            {isAdmin&&<div style={{display:"flex",gap:8,marginTop:12}}>
              <button onClick={()=>{setEf({...e,amount:String(e.amount)});setEsh(e);onClose();}} style={{flex:1,padding:"12px",borderRadius:12,background:t.inp,border:`1.5px solid ${t.border}`,color:t.text,fontWeight:700,fontSize:13,cursor:"pointer"}}>✏️ Edit</button>
              <button onClick={()=>{delE(e);onClose();}} style={{flex:1,padding:"12px",borderRadius:12,background:"#dc2626",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",border:"none"}}>🗑️ Delete</button>
            </div>}
          </div>
        </div>
      </div>
    );
  }

  // ── CUSTOMER DETAIL / HISTORY ──
  if (type === "customer") {
    const c = data;
    const cDelivs = deliveries.filter(d=>d.customerId===c.id);
    const cDelivered = cDelivs.filter(d=>d.status==="Delivered");
    const cPending = cDelivs.filter(d=>d.status==="Pending");
    const cRev = cDelivered.reduce((s,d)=>s+lineTotal(d.orderLines),0);
    const cRepl = cDelivered.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
    const cNetRev = Math.max(0,cRev-cRepl);
    const cAvgOrder = cDelivered.length>0?Math.round(cNetRev/cDelivered.length):0;
    const cPaid = c.paid||0;
    const cDue = c.pending||0;
    const collPct = cPaid+cDue>0?Math.round(cPaid/(cPaid+cDue)*100):100;
    const cProducts = products.map(p=>{
      const qty=cDelivered.reduce((s,d)=>s+(safeO(d.orderLines)[p.id]?.qty||0),0);
      const rev=cDelivered.reduce((s,d)=>s+(safeO(d.orderLines)[p.id]?.qty||0)*(safeO(d.orderLines)[p.id]?.priceAmount||0),0);
      return{...p,qty,rev};
    }).filter(x=>x.qty>0).sort((a,b)=>b.rev-a.rev);
    const lastD = cDelivs.length>0?[...cDelivs].sort((a,b)=>b.date.localeCompare(a.date))[0]:null;
    const firstD = cDelivs.length>0?[...cDelivs].sort((a,b)=>a.date.localeCompare(b.date))[0]:null;
    return (
      <div style={overlayStyle} onClick={ev=>{if(ev.target===ev.currentTarget)onClose();}}>
        <div style={panelStyle}>
          <Header icon="👤" title={c.name} sub={`${c.phone||"No phone"}${c.address?` · ${c.address}`:""}`} accent="#f59e0b"/>
          <div style={scrollStyle}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,margin:"16px 0"}}>
              <Kpi label="Net Revenue" val={inr(cNetRev)} color="#10b981"/>
              <Kpi label="Collected" val={inr(cPaid)} color="#10b981"/>
              <Kpi label="Pending" val={inr(cDue)} color={cDue>0?"#ef4444":"#10b981"}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:16}}>
              <Kpi label="Orders" val={cDelivs.length} color="#3b82f6"/>
              <Kpi label="Delivered" val={cDelivered.length} color="#10b981"/>
              <Kpi label="Pending" val={cPending.length} color="#f59e0b"/>
              <Kpi label="Coll. Rate" val={`${collPct}%`} color={collPct>=90?"#10b981":collPct>=60?"#f59e0b":"#ef4444"}/>
            </div>
            {/* Collection bar */}
            {(cPaid+cDue)>0&&<div style={{marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{color:"#10b981",fontSize:10,fontWeight:700}}>Collected: {inr(cPaid)}</span>
                <span style={{color:cDue>0?"#ef4444":"#10b981",fontSize:10,fontWeight:700}}>Due: {inr(cDue)}</span>
              </div>
              <div style={{height:8,borderRadius:8,overflow:"hidden",display:"flex",background:t.border}}>
                <div style={{width:`${collPct}%`,background:"#10b981"}}/>
                <div style={{width:`${100-collPct}%`,background:cDue>0?"#ef4444":"transparent"}}/>
              </div>
            </div>}
            {/* Info rows */}
            {c.phone&&<Row label="Phone" val={`📞 ${c.phone}`}/>}
            {c.joinDate&&<Row label="Customer Since" val={c.joinDate}/>}
            {firstD&&<Row label="First Order" val={firstD.date}/>}
            {lastD&&<Row label="Last Activity" val={lastD.date}/>}
            {cAvgOrder>0&&<Row label="Avg Order Value" val={inr(cAvgOrder)} color="#f59e0b"/>}
            {c.notes&&<div style={{background:t.inp,borderRadius:12,padding:"12px 14px",margin:"12px 0"}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>Notes</p>
              <p style={{color:t.text,fontSize:12,lineHeight:1.5}}>{c.notes}</p>
            </div>}
            {/* Products */}
            {cProducts.length>0&&<div style={{margin:"12px 0"}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>Products Ordered</p>
              {cProducts.map(p=>(
                <div key={p.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${t.border}`}}>
                  <div><p style={{color:t.text,fontSize:12,fontWeight:600}}>{p.name}</p><p style={{color:t.sub,fontSize:10}}>{p.qty} units total</p></div>
                  <span style={{color:"#f59e0b",fontWeight:700,fontSize:12,alignSelf:"center"}}>{inr(p.rev)}</span>
                </div>
              ))}
            </div>}
            {/* Delivery history */}
            {cDelivs.length>0&&<div style={{margin:"12px 0"}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>Delivery History ({cDelivs.length})</p>
              <div style={{border:`1px solid ${t.border}`,borderRadius:10,overflow:"hidden"}}>
                <div style={{maxHeight:300,overflowY:"auto"}}>
                  {[...cDelivs].sort((a,b)=>b.date.localeCompare(a.date)).map((d,di)=>{
                    const st = d.status;
                    const sc = st==="Delivered"?"#10b981":st==="Cancelled"?"#ef4444":"#f59e0b";
                    const tot = lineTotal(d.orderLines);
                    const repl = +d.replacement?.amount||0;
                    const dInvNo2=(invRegistry?.issued||{})[d.id];
                    const dPartial=d.partialPayment?.enabled?(+(d.partialPayment?.amount)||0):0;
                    const dNet=Math.max(0,tot-repl);
                    const dBal=Math.max(0,dNet-dPartial);
                    return <div key={d.id||di} style={{padding:"10px 12px",borderTop:di>0?`1px solid ${t.border}`:"none",cursor:"pointer",transition:"background .12s"}}
                      onClick={()=>setDetailModal({type:"delivery",data:d})}
                      onMouseEnter={ev=>{ev.currentTarget.style.background=t.inp+"88";}} onMouseLeave={ev=>{ev.currentTarget.style.background="transparent";}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div>
                          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2,flexWrap:"wrap"}}>
                            <span style={{background:sc+"20",color:sc,borderRadius:5,padding:"1px 7px",fontSize:9,fontWeight:700}}>{st}</span>
                            <span style={{color:t.sub,fontSize:10}}>📅 {d.date}</span>
                            {dInvNo2&&<span style={{fontFamily:"monospace",fontSize:9,color:t.sub,background:t.inp,borderRadius:4,padding:"1px 5px"}}>{dInvNo2}</span>}
                          </div>
                          {d.createdBy&&<p style={{color:t.sub,fontSize:10}}>👤 {d.createdBy}</p>}
                          {d.orderLines&&<p style={{color:t.sub,fontSize:10,marginTop:2}}>{Object.values(d.orderLines).filter(l=>l.qty>0).map(l=>`${l.qty}×${l.name||""}`).join(", ")}</p>}
                          {d.replacement?.done&&<p style={{color:"#f97316",fontSize:10,marginTop:2}}>🔄 Replacement: {d.replacement.item||""}{d.replacement.qty?` (${d.replacement.qty})`:""}{repl>0?` · −${inr(repl)}`:""}</p>}
                        </div>
                        <div style={{textAlign:"right"}}>
                          {st==="Delivered"&&<p style={{color:"#10b981",fontWeight:800,fontSize:12}}>{inr(tot)}</p>}
                          {repl>0&&<p style={{color:"#f97316",fontSize:10}}>Net: {inr(dNet)}</p>}
                          {dPartial>0&&<p style={{color:"#10b981",fontSize:10}}>💰 {inr(dPartial)}</p>}
                          {dPartial>0&&<p style={{color:dBal>0?"#f59e0b":"#10b981",fontSize:10,fontWeight:700}}>{dBal>0?`Due: ${inr(dBal)}`:"✓ Settled"}</p>}
                        </div>
                      </div>
                    </div>;
                  })}
                </div>
              </div>
            </div>}
            {/* Action buttons */}
            {isAdmin&&cDue>0&&<button onClick={()=>{setPaySh(c);setPayAmt("");onClose();}} style={{width:"100%",padding:"13px",borderRadius:12,background:"#10b981",color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",border:"none",marginTop:8}}>💰 Record Payment — {inr(cDue)} due</button>}
          </div>
        </div>
      </div>
    );
  }

  // ── DELIVERY DETAIL ──
  if (type === "delivery") {
    const d = data;
    const tot = lineTotal(d.orderLines);
    const repl = +d.replacement?.amount||0;
    const net = Math.max(0,tot-repl);
    const cust = customers.find(c=>c.id===d.customerId)||{name:d.customer};
    const st = d.status;
    const sc = st==="Delivered"?"#10b981":st==="Cancelled"?"#ef4444":"#f59e0b";
    const items = Object.values(safeO(d.orderLines)).filter(l=>l.qty>0);
    return (
      <div style={overlayStyle} onClick={ev=>{if(ev.target===ev.currentTarget)onClose();}}>
        <div style={panelStyle}>
          <Header icon="📦" title={d.customer} sub={`${d.date}${d.deliveryDate&&d.deliveryDate!==d.date?` · Deliver by ${d.deliveryDate}`:""}`} accent={sc}/>
          <div style={scrollStyle}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,margin:"16px 0"}}>
              <Kpi label="Status" val={st} color={sc}/>
              <Kpi label="Order Total" val={inr(tot)} color="#10b981"/>
              <Kpi label="Net" val={inr(net)} color={repl>0?"#f97316":"#10b981"}/>
            </div>
            {d.createdBy&&<Row label="Created By" val={`👤 ${d.createdBy}`} onClick={()=>setDetailModal({type:"agent",data:{name:d.createdBy}})}/>}
            {d.createdAt&&<Row label="Created At" val={d.createdAt}/>}
            {d.address&&<Row label="Address" val={`📍 ${d.address}`}/>}
            {d.notes&&<div style={{background:t.inp,borderRadius:12,padding:"12px 14px",margin:"12px 0"}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>Notes</p>
              <p style={{color:t.text,fontSize:12,lineHeight:1.5}}>{d.notes}</p>
            </div>}
            {items.length>0&&<div style={{margin:"12px 0"}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>Items</p>
              <div style={{border:`1px solid ${t.border}`,borderRadius:10,overflow:"hidden"}}>
                {items.map((l,li)=>(
                  <div key={li} style={{padding:"9px 12px",display:"flex",justifyContent:"space-between",borderTop:li>0?`1px solid ${t.border}`:"none"}}>
                    <span style={{color:t.text,fontSize:12,fontWeight:600}}>{l.qty} × {l.name||""}</span>
                    <span style={{color:"#10b981",fontWeight:700,fontSize:12}}>{inr(l.qty*(l.priceAmount||0))}</span>
                  </div>
                ))}
                <div style={{padding:"9px 12px",background:t.inp,borderTop:`2px solid ${t.border}`,display:"flex",justifyContent:"space-between"}}>
                  <span style={{color:t.text,fontWeight:800,fontSize:12}}>Order Total</span>
                  <span style={{color:"#10b981",fontWeight:900,fontSize:13}}>{inr(tot)}</span>
                </div>
              </div>
            </div>}
            {d.replacement?.done&&<div style={{background:"#f9731615",border:"1px solid #f9731630",borderRadius:12,padding:"12px 14px",margin:"8px 0"}}>
              <p style={{color:"#f97316",fontWeight:700,fontSize:12,marginBottom:4}}>🔄 Replacement</p>
              {d.replacement.item&&<Row label="Item" val={d.replacement.item}/>}
              {d.replacement.qty&&<Row label="Qty" val={d.replacement.qty}/>}
              {repl>0&&<Row label="Amount Deducted" val={inr(repl)} color="#f97316"/>}
              {d.replacement.reason&&<div style={{marginTop:8}}><p style={{color:t.sub,fontSize:11,lineHeight:1.5}}>{d.replacement.reason}</p></div>}
            </div>}
            {d.partialPayment?.enabled&&(+d.partialPayment?.amount||0)>0&&<div style={{background:"#10b98115",border:"1px solid #10b98130",borderRadius:12,padding:"12px 14px",margin:"8px 0"}}>
              <Row label="Collected" val={inr(+d.partialPayment.amount)} color="#10b981"/>
              {d.partialPayment.note&&<p style={{color:t.sub,fontSize:11,marginTop:6,fontStyle:"italic"}}>"{d.partialPayment.note}"</p>}
            </div>}
            {/* Customer quick-link */}
            {cust.id&&<button onClick={()=>setDetailModal({type:"customer",data:cust})} style={{width:"100%",padding:"12px",borderRadius:12,background:t.inp,border:`1.5px solid ${t.border}`,color:t.text,fontWeight:700,fontSize:13,cursor:"pointer",marginTop:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span>👤 View {cust.name}'s full history</span><span style={{color:t.sub}}>→</span>
            </button>}
          </div>
        </div>
      </div>
    );
  }

  // ── DATE DRILLDOWN ──
  if (type === "date") {
    const dateStr = data.date;
    const dayDelivs = deliveries.filter(d=>d.date===dateStr);
    const dayDone = dayDelivs.filter(d=>d.status==="Delivered");
    const dayExp = expenses.filter(e=>e.date===dateStr);
    const daySup = supplies.filter(s=>s.date===dateStr);
    const dayWaste = (wastage||[]).filter(w=>w.date===dateStr);
    const dayRev = dayDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
    const dayExpTotal = dayExp.reduce((s,e)=>s+(e.amount||0),0);
    const daySupTotal = daySup.reduce((s,s2)=>s+(s2.cost||0),0);
    const dayWasteTotal = dayWaste.reduce((s,w)=>s+(w.cost||0),0);
    const dayProfit = dayRev-dayExpTotal-daySupTotal-dayWasteTotal;
    return (
      <div style={overlayStyle} onClick={ev=>{if(ev.target===ev.currentTarget)onClose();}}>
        <div style={panelStyle}>
          <Header icon="📅" title={`Day Drilldown`} sub={dateStr} accent="#3b82f6"/>
          <div style={scrollStyle}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,margin:"16px 0"}}>
              <Kpi label="Revenue" val={inr(dayRev)} color="#10b981"/>
              <Kpi label="Net P&L" val={inr(dayProfit)} color={dayProfit>=0?"#10b981":"#ef4444"}/>
              <Kpi label="Expenses" val={inr(dayExpTotal)} color="#ef4444"/>
              <Kpi label="Supply Cost" val={inr(daySupTotal)} color="#8b5cf6"/>
            </div>
            {dayDelivs.length>0&&<div style={{margin:"8px 0 16px"}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>Deliveries ({dayDelivs.length})</p>
              {dayDelivs.map((d,di)=>{
                const sc=d.status==="Delivered"?"#10b981":d.status==="Cancelled"?"#ef4444":"#f59e0b";
                return <div key={d.id||di} style={{padding:"10px 12px",background:t.inp,borderRadius:10,marginBottom:6,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}
                  onClick={()=>setDetailModal({type:"delivery",data:d})}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                      <span style={{background:sc+"20",color:sc,borderRadius:5,padding:"1px 6px",fontSize:9,fontWeight:700}}>{d.status}</span>
                      <span style={{color:t.text,fontSize:12,fontWeight:600}}>{d.customer}</span>
                    </div>
                    {d.createdBy&&<p style={{color:t.sub,fontSize:10}}>👤 {d.createdBy}</p>}
                  </div>
                  {d.status==="Delivered"&&<span style={{color:"#10b981",fontWeight:800,fontSize:12}}>{inr(lineTotal(d.orderLines))}</span>}
                </div>;
              })}
            </div>}
            {dayExp.length>0&&<div style={{margin:"8px 0 16px"}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>Expenses ({dayExp.length})</p>
              {dayExp.map((e,ei)=><div key={e.id||ei} style={{padding:"10px 12px",background:"#ef444412",border:"1px solid #ef444430",borderRadius:10,marginBottom:6,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}
                onClick={()=>setDetailModal({type:"expense",data:e})}>
                <div>
                  <p style={{color:t.text,fontSize:12,fontWeight:600}}>{e.category}</p>
                  {e.vendor&&<p style={{color:t.sub,fontSize:10}}>{e.vendor}</p>}
                </div>
                <span style={{color:"#ef4444",fontWeight:800,fontSize:12}}>{inr(e.amount)}</span>
              </div>)}
            </div>}
            {daySup.length>0&&<div style={{margin:"8px 0 16px"}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>Supply Entries ({daySup.length})</p>
              {daySup.map((s,si)=><div key={s.id||si} style={{padding:"10px 12px",background:"#8b5cf612",border:"1px solid #8b5cf630",borderRadius:10,marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><p style={{color:t.text,fontSize:12,fontWeight:600}}>{s.item}</p>{s.supplier&&<p style={{color:t.sub,fontSize:10}}>{s.supplier}</p>}</div>
                <div style={{textAlign:"right"}}><p style={{color:"#8b5cf6",fontWeight:800,fontSize:12}}>{inr(s.cost||0)}</p><p style={{color:t.sub,fontSize:10}}>{s.qty} {s.unit}</p></div>
              </div>)}
            </div>}
            {dayWaste.length>0&&<div style={{margin:"8px 0 16px"}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>Wastage ({dayWaste.length})</p>
              {dayWaste.map((w,wi)=><div key={w.id||wi} style={{padding:"10px 12px",background:"#f9731612",border:"1px solid #f9731630",borderRadius:10,marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><p style={{color:t.text,fontSize:12,fontWeight:600}}>{w.product}</p><p style={{color:t.sub,fontSize:10}}>{w.qty} {w.unit} · {w.type}</p></div>
                <span style={{color:"#f97316",fontWeight:800,fontSize:12}}>{inr(w.cost||0)}</span>
              </div>)}
            </div>}
          </div>
        </div>
      </div>
    );
  }

  // ── AGENT / LOGGED-BY HISTORY ──
  if (type === "agent") {
    const agentName = data.name;
    const agentDelivs = deliveries.filter(d=>d.createdBy===agentName||d.agent===agentName).sort((a,b)=>b.date.localeCompare(a.date));
    const agentDone = agentDelivs.filter(d=>d.status==="Delivered");
    const agentRev = agentDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
    const agentExps = expenses.filter(e=>e.approvedBy===agentName).sort((a,b)=>b.date.localeCompare(a.date));
    const u = data.user||null;
    return (
      <div style={overlayStyle} onClick={ev=>{if(ev.target===ev.currentTarget)onClose();}}>
        <div style={panelStyle}>
          <Header icon="👤" title={agentName} sub={u?`@${u.username} · ${u.role}`:"Agent / Staff"} accent="#8b5cf6"/>
          <div style={scrollStyle}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,margin:"16px 0"}}>
              <Kpi label="Deliveries" val={agentDelivs.length} color="#3b82f6"/>
              <Kpi label="Delivered" val={agentDone.length} color="#10b981"/>
              <Kpi label="Revenue" val={inr(agentRev)} color="#f59e0b"/>
            </div>
            {agentDelivs.length>0&&<div style={{margin:"8px 0 16px"}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>Delivery Log ({agentDelivs.length})</p>
              <div style={{border:`1px solid ${t.border}`,borderRadius:10,overflow:"hidden"}}>
                <div style={{maxHeight:320,overflowY:"auto"}}>
                  {agentDelivs.map((d,di)=>{
                    const sc=d.status==="Delivered"?"#10b981":d.status==="Cancelled"?"#ef4444":"#f59e0b";
                    return <div key={d.id||di} style={{padding:"10px 12px",borderTop:di>0?`1px solid ${t.border}`:"none",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}
                      onClick={()=>setDetailModal({type:"delivery",data:d})}
                      onMouseEnter={ev=>{ev.currentTarget.style.background=t.inp+"88";}} onMouseLeave={ev=>{ev.currentTarget.style.background="transparent";}}>
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                          <span style={{background:sc+"20",color:sc,borderRadius:5,padding:"1px 6px",fontSize:9,fontWeight:700}}>{d.status}</span>
                          <span style={{color:t.text,fontSize:12,fontWeight:600}}>{d.customer}</span>
                        </div>
                        <p style={{color:t.sub,fontSize:10}}>📅 {d.date}</p>
                      </div>
                      {d.status==="Delivered"&&<span style={{color:"#10b981",fontWeight:800,fontSize:12}}>{inr(lineTotal(d.orderLines))}</span>}
                    </div>;
                  })}
                </div>
              </div>
            </div>}
            {agentExps.length>0&&<div style={{margin:"8px 0 16px"}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>Approved Expenses ({agentExps.length})</p>
              {agentExps.map((e,ei)=><div key={e.id||ei} style={{padding:"9px 12px",background:"#ef444412",borderRadius:10,marginBottom:6,display:"flex",justifyContent:"space-between",cursor:"pointer"}}
                onClick={()=>setDetailModal({type:"expense",data:e})}>
                <div><p style={{color:t.text,fontSize:12,fontWeight:600}}>{e.category}</p><p style={{color:t.sub,fontSize:10}}>{e.date}</p></div>
                <span style={{color:"#ef4444",fontWeight:800,fontSize:12}}>{inr(e.amount)}</span>
              </div>)}
            </div>}
          </div>
        </div>
      </div>
    );
  }

  // ── CATEGORY DRILLDOWN ──
  if (type === "category") {
    const {cat, catExpenses, catTotal} = data;
    const allTotal = expenses.reduce((s,e)=>s+(e.amount||0),0);
    const pct = allTotal>0?Math.round(catTotal/allTotal*100):0;
    return (
      <div style={overlayStyle} onClick={ev=>{if(ev.target===ev.currentTarget)onClose();}}>
        <div style={panelStyle}>
          <Header icon="📂" title={cat} sub={`${catExpenses.length} entries · ${pct}% of all expenses`} accent="#ef4444"/>
          <div style={scrollStyle}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,margin:"16px 0"}}>
              <Kpi label="Total" val={inr(catTotal)} color="#ef4444"/>
              <Kpi label="Entries" val={catExpenses.length} color="#8b5cf6"/>
              <Kpi label="% of All" val={`${pct}%`} color="#f59e0b"/>
            </div>
            <div style={{height:5,borderRadius:5,overflow:"hidden",background:t.border,marginBottom:16}}>
              <div style={{width:`${pct}%`,background:"#ef4444",height:"100%",borderRadius:5}}/>
            </div>
            <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>All {cat} Entries</p>
            <div style={{border:`1px solid ${t.border}`,borderRadius:10,overflow:"hidden"}}>
              <div style={{maxHeight:400,overflowY:"auto"}}>
                {[...catExpenses].sort((a,b)=>b.date.localeCompare(a.date)).map((e,ei)=>(
                  <div key={e.id||ei} style={{padding:"10px 12px",borderTop:ei>0?`1px solid ${t.border}`:"none",cursor:"pointer",transition:"background .12s"}}
                    onClick={()=>setDetailModal({type:"expense",data:e})}
                    onMouseEnter={ev=>{ev.currentTarget.style.background=t.inp+"88";}} onMouseLeave={ev=>{ev.currentTarget.style.background="transparent";}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <p style={{color:t.sub,fontSize:10}}>📅 {e.date}{e.vendor?` · 🏪 ${e.vendor}`:""}</p>
                        {e.notes&&<p style={{color:t.sub,fontSize:10,fontStyle:"italic",marginTop:1}}>{e.notes}</p>}
                        {e.paymentMethod&&<p style={{color:t.sub,fontSize:10}}>{e.paymentMethod}</p>}
                      </div>
                      <span style={{color:"#ef4444",fontWeight:800,fontSize:13}}>{inr(e.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{padding:"9px 12px",background:t.inp,borderTop:`2px solid ${t.border}`,display:"flex",justifyContent:"space-between"}}>
                <span style={{color:t.text,fontWeight:800,fontSize:12}}>Total · {catExpenses.length} entries</span>
                <span style={{color:"#ef4444",fontWeight:900,fontSize:13}}>{inr(catTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
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
            <p style={{ color: "#3b82f6", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>📋 Today's Briefing</p>
            <p style={{ color: t.sub, fontSize: 12 }}>Here's what needs your attention</p>
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
    /* ── Reset & Base ── */
    *{-webkit-tap-highlight-color:transparent;tap-highlight-color:transparent;box-sizing:border-box;}
    button,a,[role=button]{touch-action:manipulation;cursor:pointer;}
    input,select,textarea{touch-action:manipulation;font-size:16px!important;} /* 16px prevents iOS zoom */
    html{-webkit-text-size-adjust:100%;text-size-adjust:100%;scroll-behavior:smooth;}
    body{overscroll-behavior-y:none;-webkit-overflow-scrolling:touch;}
    ::-webkit-scrollbar{width:0;height:0;background:transparent;}
    scrollbar-width:none;

    /* ── Safe area utilities ── */
    .pb-safe{padding-bottom:env(safe-area-inset-bottom,0px);}
    .pt-safe{padding-top:env(safe-area-inset-top,0px);}
    .pl-safe{padding-left:env(safe-area-inset-left,0px);}
    .pr-safe{padding-right:env(safe-area-inset-right,0px);}

    /* ── Touch target minimum (Apple HIG: 44pt, Android: 48dp) ── */
    .touch-target{min-height:48px;min-width:48px;display:flex;align-items:center;justify-content:center;}

    /* ── Mobile bottom nav safe padding ── */
    .mobile-content-pad{padding-bottom:calc(64px + env(safe-area-inset-bottom,0px));}

    /* ── Inputs: larger, no zoom, clear focus ring ── */
    @media(max-width:1023px){
      input,select,textarea{
        min-height:48px!important;
        padding:12px 14px!important;
        border-radius:12px!important;
        font-size:16px!important;
      }
      input[type="date"],input[type="time"]{min-height:48px!important;}
      select{padding-right:36px!important;}

      /* ── Cards: more breathing room ── */
      .crm-card-mobile{border-radius:16px!important;padding:16px!important;}

      /* ── Bottom nav: full width, safe area ── */
      .crm-bottom-nav{
        height:calc(58px + env(safe-area-inset-bottom,0px));
        padding-bottom:env(safe-area-inset-bottom,0px);
      }

      /* ── Sheets: full width on mobile ── */
      .crm-sheet-mobile{
        border-radius:24px 24px 0 0!important;
        max-height:94svh!important;
        width:100%!important;
        padding-left:env(safe-area-inset-left,0px);
        padding-right:env(safe-area-inset-right,0px);
      }

      /* ── Content area: respect bottom nav ── */
      .crm-tab-content{
        padding-bottom:calc(72px + env(safe-area-inset-bottom,0px))!important;
      }

      /* ── Stat cards: 2-col on small screens ── */
      .crm-stats-grid{
        grid-template-columns:repeat(2,1fr)!important;
        gap:10px!important;
      }

      /* ── Tables: scroll horizontally instead of overflowing ── */
      .crm-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:12px;}
      .crm-table-wrap table{min-width:500px;}

      /* ── Hide desktop-only elements ── */
      .desktop-only{display:none!important;}

      /* ── Increase base font sizes ── */
      .crm-row-text{font-size:14px!important;}
      .crm-row-sub{font-size:12px!important;}

      /* ── Pill / badge: bigger on mobile ── */
      .crm-pill-mobile{padding:3px 8px!important;font-size:11px!important;}

      /* ── Buttons: full-width on mobile sheets ── */
      .crm-sheet-btn{width:100%!important;min-height:52px!important;font-size:15px!important;border-radius:14px!important;}

      /* ── Smoother scrolling in sheets ── */
      .crm-sheet-scroll{overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;}

      /* ── Quick action grid ── */
      .crm-quick-grid{grid-template-columns:repeat(4,1fr)!important;}
      @media(max-width:380px){.crm-quick-grid{grid-template-columns:repeat(2,1fr)!important;}}

      /* ── Header height ── */
      .crm-header{min-height:54px;}

      /* ── Nav item active indicator ── */
      .crm-nav-active-dot{
        position:absolute;
        top:0;left:50%;
        transform:translateX(-50%);
        width:32px;height:3px;
        border-radius:0 0 6px 6px;
      }

      /* ── Form labels ── */
      .crm-form-label{font-size:12px!important;letter-spacing:0.04em!important;margin-bottom:6px!important;}

      /* ── Row card layout on mobile ── */
      .crm-row-card{
        border-radius:16px!important;
        padding:14px 16px!important;
        margin-bottom:8px!important;
      }
    }

    /* ── Tablet (sm-lg) tweaks ── */
    @media(min-width:640px) and (max-width:1023px){
      input,select,textarea{font-size:15px!important;}
      .crm-stats-grid{grid-template-columns:repeat(3,1fr)!important;}
      .crm-quick-grid{grid-template-columns:repeat(4,1fr)!important;}
    }

    /* ── Desktop: restore normal styles ── */
    @media(min-width:1024px){
      input,select,textarea{font-size:14px!important;min-height:40px!important;}
    }

    /* ── Focus: accessible, not ugly ── */
    :focus-visible{outline:2px solid #3b82f6;outline-offset:2px;border-radius:6px;}
    :focus:not(:focus-visible){outline:none;}

    /* ── Hide scrollbars on horizontally scrollable rows ── */
    .no-scrollbar{scrollbar-width:none;-ms-overflow-style:none;}
    .no-scrollbar::-webkit-scrollbar{display:none;}

    /* ── Momentum scroll for all scroll areas ── */
    [style*="overflow-y"]{-webkit-overflow-scrolling:touch;}
    [style*="overflowY"]{-webkit-overflow-scrolling:touch;}
  `;
  document.head.appendChild(_ms);
}
if(typeof document!=="undefined"&&!document.getElementById("crmAnimStyle")){
  const _as=document.createElement("style");
  _as.id="crmAnimStyle";
  _as.textContent=`
    /* ── Entrance animations ── */
    @keyframes fadeSlideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
    @keyframes fadeSlideDown{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes scaleIn{from{opacity:0;transform:scale(0.93)}to{opacity:1;transform:scale(1)}}
    @keyframes slideInRight{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}
    @keyframes slideInLeft{from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:translateX(0)}}
    @keyframes sheetUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
    @keyframes sheetCenter{from{opacity:0;transform:scale(0.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
    @keyframes popIn{from{opacity:0;transform:scale(0.8)}to{opacity:1;transform:scale(1)}}
    @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
    @keyframes toastOut{from{opacity:1;transform:translateX(-50%) translateY(0)}to{opacity:0;transform:translateX(-50%) translateY(8px)}}
    @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
    @keyframes pulse-dot{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:0.7}}
    @keyframes badge-bounce{0%,100%{transform:scale(1)}30%{transform:scale(1.25)}60%{transform:scale(0.9)}}
    @keyframes number-pop{0%{transform:scale(1)}40%{transform:scale(1.18)}100%{transform:scale(1)}}
    @keyframes sidebar-item-in{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}
    @keyframes progress-grow{from{width:0}to{width:var(--target-width)}}
    @keyframes spin-slow{to{transform:rotate(360deg)}}
    @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
    @keyframes glow-pulse{0%,100%{box-shadow:0 0 0 0 rgba(59,130,246,0.3)}50%{box-shadow:0 0 0 6px rgba(59,130,246,0)}}

    /* ── Animated components ── */
    .crm-tab-content{animation:fadeSlideUp 0.22s cubic-bezier(.25,.46,.45,.94) both}
    .crm-card-enter{animation:scaleIn 0.18s cubic-bezier(.25,.46,.45,.94) both}
    .crm-sheet-backdrop{animation:fadeIn 0.18s ease both}
    .crm-sheet-panel-mobile{animation:sheetUp 0.28s cubic-bezier(.32,1,.6,1) both}
    .crm-sheet-panel-desktop{animation:sheetCenter 0.22s cubic-bezier(.32,1,.6,1) both}
    .crm-toast{animation:toastIn 0.22s cubic-bezier(.32,1,.6,1) both}
    .crm-toast-exit{animation:toastOut 0.18s ease both}
    .crm-stat-card{animation:fadeSlideUp var(--delay,0.1s) cubic-bezier(.25,.46,.45,.94) both}
    .crm-notif-badge{animation:badge-bounce 0.35s cubic-bezier(.32,1,.6,1) both}
    .crm-sidebar-item{animation:sidebar-item-in var(--si-delay,0.05s) cubic-bezier(.25,.46,.45,.94) both}
    .crm-row-enter{animation:fadeSlideUp var(--row-delay,0.05s) cubic-bezier(.25,.46,.45,.94) both}
    .crm-fab{animation:scaleIn 0.2s cubic-bezier(.32,1,.6,1) both;transition:transform 0.15s,box-shadow 0.15s,opacity 0.15s}
    .crm-fab:hover{transform:scale(1.06) translateY(-1px)!important;box-shadow:0 8px 24px rgba(0,0,0,0.25)!important}
    .crm-fab:active{transform:scale(0.95)!important}
    .crm-btn-press{transition:transform 0.1s,box-shadow 0.1s}
    .crm-btn-press:active{transform:scale(0.96)!important}
    .crm-sync-dot{animation:pulse-dot 1.8s ease infinite}
    .crm-quick-action{transition:transform 0.15s cubic-bezier(.32,1,.6,1),background 0.15s,box-shadow 0.15s}
    .crm-quick-action:hover{transform:translateY(-3px) scale(1.04)}
    .crm-quick-action:active{transform:scale(0.95)}
    .crm-confirm-modal{animation:popIn 0.2s cubic-bezier(.32,1,.6,1) both}
    .crm-header-enter{animation:fadeSlideDown 0.2s ease both}
    .crm-list-item{transition:background 0.12s,transform 0.12s,box-shadow 0.12s}
    .crm-list-item:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,0.08)}
    .crm-list-item:active{transform:scale(0.99)}
    .crm-progress-bar{transition:width 0.9s cubic-bezier(.25,.46,.45,.94)}
    .crm-number-update{animation:number-pop 0.3s cubic-bezier(.32,1,.6,1)}
    .crm-pill-enter{animation:popIn 0.18s cubic-bezier(.32,1,.6,1) both}
    .crm-glow{animation:glow-pulse 2.5s ease infinite}
    @media(prefers-reduced-motion:reduce){
      *{animation-duration:0.01ms!important;transition-duration:0.01ms!important}
    }
  `;
  document.head.appendChild(_as);
}
// This lets multiple devices have independent sessions in Firebase
function getDeviceId(){
  let id=sessionStorage.getItem("tas_device_id");
  if(!id){id=Date.now().toString(36)+Math.random().toString(36).slice(2,8);sessionStorage.setItem("tas_device_id",id);}
  return id;
}
const DEVICE_ID=getDeviceId();

// Clean up stale session nodes — runs once on app load.
// Firebase accumulates a tas9_sess_* node per device tab indefinitely.
// This scans all sess nodes and deletes those older than 2× SESSION_TTL (16 hours).
async function cleanStaleSessions(){
  try{
    const r=ref(db,"");
    const snap=await fbGet(r);
    if(!snap.exists())return;
    const allKeys=Object.keys(snap.val()||{});
    const sessKeys=allKeys.filter(k=>k.startsWith("tas9_sess_")&&k!=="tas9_sess_"+DEVICE_ID);
    const cutoff=Date.now()-(SESSION_TTL*2);
    for(const k of sessKeys){
      const s=snap.val()[k];
      const loginAt=s?.v?.loginAt||s?.loginAt||0;
      if(!loginAt||loginAt<cutoff){
        await fbRemove(ref(db,k)).catch(()=>{});
      }
    }
  }catch(e){/* non-critical — ignore */}
}
// Run cleanup after a short delay so it doesn't race with initial data load
setTimeout(cleanStaleSessions, 8000);

export default function Root(){
  const [dm,setDm]=useStore("tas_pref_dm",false);
  const [users,setUsers,usersLoaded]=useStore("tas9_users",D_USERS);
  const [settings,setSettings,settingsLoaded]=useStore("tas10_settings",D_SETTINGS);
  // Session stored in Firebase under a device-specific key — zero localStorage
  const sessKey="tas9_sess_"+DEVICE_ID;
  const [sessRaw,setSessRaw,sessLoaded]=useStore(sessKey,null);
  // Treat null or expired session as logged out
  const sess=(sessRaw&&Date.now()-sessRaw.loginAt<SESSION_TTL)?sessRaw:null;
  const setSess=(s)=>setSessRaw(s||null);
  // Show spinner until Firebase has responded for all critical keys
  const fbReady=usersLoaded&&settingsLoaded&&sessLoaded;
  useEffect(()=>{if(!sess)return;const t=setInterval(()=>{if(Date.now()-sess.loginAt>SESSION_TTL)setSess(null);},30000);return()=>clearInterval(t);},[sess]);
  const spinner=<div style={{background:dm?"#0c0c10":"#f2f2ed",minHeight:"100svh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
    <div style={{width:40,height:40,border:"3px solid #f59e0b",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
    <p style={{color:"#f59e0b",fontSize:12,fontWeight:600,letterSpacing:1}}>Connecting to cloud…</p>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>;
  if(!fbReady) return spinner;
  if(!sess) return <Login users={users} onLogin={setSess} dm={dm} settings={settings}/>;
  return <CRM sess={sess} onLogout={()=>setSess(null)} dm={dm} setDm={setDm} users={users} setUsers={setUsers} settings={settings} setSettings={setSettings}/>;
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

  // Init map once Leaflet ready — rebuild when dark mode changes so tile layer updates
  useEffect(()=>{
    if(!leafReady||!mapRef.current) return;
    // Destroy existing map instance before recreating
    if(leafRef.current){leafRef.current.remove();leafRef.current=null;}
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
  },[leafReady,dm,fallbackLat,fallbackLng]);// eslint-disable-line

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

  const [customers, setCust,  custLoaded]    =useStore("tas9_cust", D_CUST);
  const [deliveries,setDeliv, delivLoaded]   =useStore("tas9_deliv",D_DELIV);
  const [supplies,  setSup,   supLoaded]     =useStore("tas9_sup",  D_SUP);
  const [expenses,  setExp,   expLoaded]     =useStore("tas9_exp",  D_EXP);
  const [products,  setProd,  prodLoaded]    =useStore("tas9_prod", D_PRODS);
  const [actLog,    setAct,   actLoaded]     =useStore("tas9_act",  []);
  const [wastage,   setWaste, wastageLoaded] =useStore("tas9_waste", D_WASTE);
  const [prodTargets, setProdTargets, ptLoaded]=useStore("tas9_prodtargets", D_PROD_TARGETS);
  const dataLoaded = custLoaded && delivLoaded && supLoaded && expLoaded && prodLoaded && wastageLoaded && actLoaded && ptLoaded;
  // Agent live locations — kept in memory only, NOT stored in Firebase/cloud
  // Uses Ably free-tier WebSockets for cross-device real-time relay
  const [notifs, setNotifs]=useStore("tas9_notifs",[]);
  const [finSnapshots, setFinSnapshots]=useStore("tas9_fin_snaps",{});
  // eslint-disable-next-line no-unused-vars
  const [qcLogs,    setQcLogs]   = useStore("tas9_qclogs", []);
  const [handovers, setHandovers]= useStore("tas9_handovers", []);
  const [notices,   setNotices]  = useStore("tas9_notices", []);
  const [briefingDismissed, setBriefingDismissed] = useStore("tas_pref_briefing_dismissed_"+sess.id,"");
  const [briefingPinned, setBriefingPinned] = useStore("tas_pref_briefing_pinned_"+sess.id, true);
  // ── INVOICE SEQUENCE COUNTER (persisted in Firebase) ──
  // Format: {seq: N, issued: {deliveryId: "TAS-YYYY-NNNN", ...}}
  const [invRegistry, setInvRegistry] = useStore("tas9_inv_registry", {seq:0, issued:{}});
  // ── PAYMENT LEDGER ── stores manual payment events per customer ──────────
  const [paymentLedger, setPaymentLedger] = useStore("tas9_payment_ledger", []);
  const [payLedgerSh, setPayLedgerSh] = useState(false);   // manual payment entry sheet
  const [payLedgerCust, setPayLedgerCust] = useState(null); // customer being paid
  const [payLedgerAmt, setPayLedgerAmt] = useState("");
  const [payLedgerNote, setPayLedgerNote] = useState("");
  const [payLedgerMethod, setPayLedgerMethod] = useState("Cash");
  // Payments tab state
  const [paymentsSubTab, setPaymentsSubTab] = useState("ledger"); // "ledger" | "outstanding" | "daily"
  const [paymentsSearch, setPaymentsSearch] = useState("");
  const [paymentsDateFilter, setPaymentsDateFilter] = useState("all"); // "all"|"today"|"week"|"month"
  // eslint-disable-next-line no-unused-vars
  const [paymentsStatusFilter, setPaymentsStatusFilter] = useState("all"); // "all"|"partial"|"pending"|"settled"
  function recordPaymentLedger(customerId, customerName, amount, note, method){
    const entry = {id:uid(), customerId, customerName, amount:+amount, note:note||"", method:method||"Cash", recordedBy:displayName, date:today(), ts:ts()};
    setPaymentLedger(p=>[entry,...(p||[])]);
    setCust(p=>p.map(c=>c.id===customerId?{...c,paid:(c.paid||0)+(+amount),pending:Math.max(0,(c.pending||0)-(+amount))}:c));
    addLog("Manual payment recorded",`${customerName} — ${inr(amount)}${note?" · "+note:""}`);
    addNotif("Payment Recorded",`${inr(amount)} from ${customerName}`,"success","payment");
    notify(`${inr(amount)} recorded ✓`);
  }
  function getOrCreateInvNo(deliveryId) {
    const existing = (invRegistry.issued||{})[deliveryId];
    if(existing) return existing;
    const newSeq = (invRegistry.seq||0) + 1;
    const prefix = settings?.invoicePrefix||"TAS";
    const yearReset = settings?.invoiceYearReset!==false;
    const year = new Date().getFullYear();
    const invNo = yearReset
      ? `${prefix}-${year}-${String(newSeq).padStart(4,"0")}`
      : `${prefix}-${String(newSeq).padStart(4,"0")}`;
    setInvRegistry(prev => ({
      seq: newSeq,
      issued: {...(prev.issued||{}), [deliveryId]: invNo}
    }));
    return invNo;
  }
  // eslint-disable-next-line no-unused-vars
  function getReceiptNo(deliveryId) {
    const invNo = (invRegistry.issued||{})[deliveryId];
    const prefix = settings?.invoicePrefix||"TAS";
    if(invNo) return `RCP-${invNo.replace(prefix+"-","")}`;
    return `RCP-${(deliveryId||"").slice(-8).toUpperCase()}`;
  }
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

  const [tab,setTabRaw]=useState(()=>{
    try{
      const saved=sessionStorage.getItem("tas_active_tab");
      const allowed=isAdmin?ALL_TABS:ALL_TABS.filter(tb=>userPerms.includes(tb));
      if(saved&&allowed.includes(saved)) return saved;
    }catch{}
    return (isAdmin?ALL_TABS:ALL_TABS.filter(tb=>userPerms.includes(tb)))[0]||"Dashboard";
  });
  const setTab=useCallback((newTab)=>{
    setTabRaw(newTab);
    try{sessionStorage.setItem("tas_active_tab",newTab);}catch{}
  },[]);
  const [srch,setSrch]=useState("");
  const [toast,setToast]=useState(null);
  const [conf,setConf]=useState(null);
  const notify=m=>setToast(m);
  const ask=(msg,yes)=>setConf({msg,yes});

  // Sub-staff: moved up before addLog so displayName is defined when addLog captures it
  // Also supports displayOverride from staff picker mode
  const subStaff=sess.subStaff||[];
  const [activeStaff,setActiveStaff]=useState(()=>sess.displayOverride||( subStaff.length>0?subStaff[0]:sess.name));
  const displayName=useMemo(()=>sess.displayOverride||( subStaff.length>0?activeStaff:sess.name),[sess.displayOverride,sess.name,subStaff.length,activeStaff]);

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
  const totalReplDeductions=deliveries.reduce((a,d)=>a+(+d.replacement?.amount||0),0);
  const totalRev=customers.reduce((a,c)=>a+(c.paid||0),0)-totalReplDeductions;
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
  const [delivStatusFilter,setDelivStatusFilter]=useState("all");
  const fCust=useMemo(()=>customers.filter(c=>!q||c.name.toLowerCase().includes(q)||c.phone?.includes(q)||c.address?.toLowerCase().includes(q)),[customers,q]);
  const fDeliv=useMemo(()=>deliveries.filter(d=>{
    const invNo=(invRegistry?.issued||{})[d.id]||d.invNo||"";
    const rcptNo=invNo?`RCP-${invNo.replace(/^[A-Z]+-/,"")}`:`RCP-${(d.id||"").slice(-6).toUpperCase()}`;
    const batchLabels=(prodTargets||[]).filter(pt=>pt.date===d.date).map(b=>b.batchLabel||"Batch").join(" ");
    const productNames=Object.values(safeO(d.orderLines)).filter(l=>l.qty>0).map(l=>l.name||"").join(" ");
    const matchSearch=!q||d.customer.toLowerCase().includes(q)||d.date.includes(q)||d.status.toLowerCase().includes(q)||invNo.toLowerCase().includes(q)||rcptNo.toLowerCase().includes(q)||batchLabels.toLowerCase().includes(q)||productNames.toLowerCase().includes(q)||(d.notes||"").toLowerCase().includes(q);
    const matchStatus=delivStatusFilter==="all"||d.status===delivStatusFilter;
    // Agents only see their own deliveries (assigned or created by them)
    const matchAgent=sess.role!=="agent"||(d.agentId===sess.id||d.agent===sess.name||d.createdBy===sess.name||d.agent===displayName||d.createdBy===displayName);
    return matchSearch&&matchStatus&&matchAgent;
  }),[deliveries,invRegistry,prodTargets,q,delivStatusFilter,sess.role,sess.id,sess.name,displayName]);
  const fSup=useMemo(()=>supplies.filter(s=>!q||s.item.toLowerCase().includes(q)||s.supplier?.toLowerCase().includes(q)||s.date?.includes(q)||(s.notes||"").toLowerCase().includes(q)),[supplies,q]);

  const blkOL=()=>products.reduce((a,p)=>({...a,[p.id]:{qty:0,priceAmount:p.prices?.[0]||0}}),{});
  const blkC=()=>({name:"",phone:"",address:"",lat:"",lng:"",orderLines:blkOL(),paid:0,pending:0,partialPay:0,notes:"",active:true,joinDate:today()});
  const blkD=()=>({customer:"",customerId:null,orderLines:blkOL(),date:today(),deliveryDate:"",status:"Pending",notes:"",address:"",lat:0,lng:0,createdBy:sess.name,createdAt:ts(),replacement:{done:false,item:"",reason:"",qty:""},partialPayment:{enabled:false,amount:""}});
  const blkS=()=>({item:"",qty:"",unit:"kg",date:today(),supplier:"",cost:"",notes:"",minStock:""});
  const blkE=()=>({category:settings?.expenseCategories?.[0]||"Gas",amount:"",date:today(),notes:"",receipt:"",vendor:"",paymentMethod:"Cash",approvedBy:"",tags:""});
  const blkP=()=>({id:"",name:"",unit:"pcs",prices:[5,6]});
  const blkU=()=>({username:"",password:"",name:"",role:"agent",active:true,permissions:[...ROLE_DEF.agent]});
  const blkW=useCallback(()=>({product:"",qty:"",unit:(settings?.supplyUnits||["pcs"])[0]||"pcs",type:(settings?.wastageTypes||["Other"])[0]||"Other",reason:"",cost:"",date:today(),shift:(settings?.shifts||["Morning"])[0]||"Morning",loggedBy:displayName}),[settings,displayName]);

  const [cSh,setCsh]=useState(null); const [cF,setCf]=useState(blkC());
  const [cView,setCView]=useState(null);
  const [dSh,setDsh]=useState(null); const [dF,setDf]=useState(blkD());
  const [sSh,setSsh]=useState(null); const [sF,setSf]=useState(blkS());
  const [eSh,setEsh]=useState(null); const [eF,setEf]=useState(blkE());
  const [expSearch,setExpSearch]=useState("");
  const [expCatFilter,setExpCatFilter]=useState("all");
  const [expDateFilter,setExpDateFilter]=useState("all");
  const [expCustomFrom,setExpCustomFrom]=useState("");
  const [expCustomTo,setExpCustomTo]=useState(today());
  const [expShowFilters,setExpShowFilters]=useState(false);
  const [finView,setFinView]=useState("overview"); // "overview"|"daily"|"revenue"|"supply"|"ops"|"wastage"
  const [finDailyDate,setFinDailyDate]=useState(today());
  const [finExpandedDay,setFinExpandedDay]=useState(null);
  const [finOvOpen,setFinOvOpen]=useState(false);
  const [finOvHover,setFinOvHover]=useState(false);
  const [expPTOpen,setExpPTOpen]=useState(false);
  const [expPTSection,setExpPTSection]=useState("revenue");
  const [pSh,setPsh]=useState(null); const [pF,setPf]=useState(blkP());
  const [uSh,setUsh]=useState(null); const [uF,setUf]=useState(blkU());
  const [paySh,setPaySh]=useState(null); const [payAmt,setPayAmt]=useState("");
  const [wSh,setWSh]=useState(null); const [wF,setWF]=useState(blkW());
  const [delivCalendar,setDelivCalendar]=useState(false);
  const [calOffset,setCalOffset]=useState(0);
  const [calExpandedDay,setCalExpandedDay]=useState(null);
  const [lastSync,setLastSync]=useState(null);
  useEffect(()=>{const fn=ts=>{setLastSync(ts);};_syncListeners.add(fn);return()=>_syncListeners.delete(fn);},[]);
  const [ptSh,setPtSh]=useState(null);
  const [ptF,setPtF]=useState(()=>({date:today(),shift:"",product:"",actual:0,notes:"",batchId:"",batchLabel:"Batch 1",qcGrade:"A",qcNotes:"",embWastage:[],embQC:[],embHandover:[]}));
  const [ptDateFilter,setPtDateFilter]=useState("today");
  const [nbSh,setNbSh]=useState(false);
  const [nbF,setNbF]=useState({title:"",body:"",pinned:false});
  const [hvSh,setHvSh]=useState(false);
  const prodSubTab="batches"; // always batches — sub-tabs removed
  const [openRecipe,setOpenRecipe]=useState(null);
  const [hvF,setHvF]=useState({shift:"Morning",date:today(),note:"",nextShift:"",issues:"",loggedBy:""});
  const [bulkSelect,setBulkSelect]=useState(false);
  const [bulkSelected,setBulkSelected]=useState(new Set());
  const [expandedDeliveryCust,setExpandedDeliveryCust]=useState(null);
  const [expandedCustCard,setExpandedCustCard]=useState(null);
  const [custSortField,setCustSortField]=useState("name");
  const [custStatusFilter,setCustStatusFilter]=useState("all");
  const [auditUserFilter,setAuditUserFilter]=useState("all");
  const [auditRoleFilter,setAuditRoleFilter]=useState("all");
  const [auditActionFilter,setAuditActionFilter]=useState("");
  const [qcSh,setQcSh]=useState(null);
  const [qcF,setQcF]=useState({product:"",shift:"Morning",date:today(),grade:"A",notes:"",checker:""});
  const [showMoreNav,setShowMoreNav]=useState(false);
  const [changePwSh,setChangePwSh]=useState(false);
  const [changePwF,setChangePwF]=useState({current:"",next:"",confirm:""});
  const [settingsSection,setSettingsSection]=useState("account");
  const [lastBackupDate,setLastBackupDate]=useStore("tas_pref_last_backup","");
  // Admin Tools modals
  const [adminToolSheet,setAdminToolSheet]=useState(null); // null | tool key string
  const [adminToolData,setAdminToolData]=useState(null);   // computed result data for open tool
  // Reschedule
  const [rescheduleDate,setRescheduleDate]=useState("");
  // CLV Dashboard — Standard and CLV views removed; always use Old View
  const [clvSort,setClvSort]=useState("clv");
  const clvFilter = "og"; // locked to old view per Phase 1 revamp
  const setClvFilterP = ()=>{}; // no-op
  // Delivery status filter state moved above fDeliv useMemo
  // Overdue Payment Alerts
  const [overdueAlertDays,setOverdueAlertDays]=useState(7);
  // Bulk Order Entry
  const [collectSh,setCollectSh]=useState(null); // delivery object for collect modal
  const [collectNote,setCollectNote]=useState("");
  const [collectAmt,setCollectAmt]=useState("");
  const [lastReceiptData,setLastReceiptData]=useState(null); // inline receipt shown after collection
  const [bulkOrderSh,setBulkOrderSh]=useState(false);
  const [bulkOrderDate,setBulkOrderDate]=useState(today());
  const [bulkOrderStatus,setBulkOrderStatus]=useState("Pending");
  const [bulkOrderRows,setBulkOrderRows]=useState([]);
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
  // P&L flexible period selector
  // eslint-disable-next-line no-unused-vars
  const [plRange,setPlRange]=useState(6); // kept for CSV export compat
  const [plPeriod,setPlPeriod]=useState("6m");
  const [plCustomFrom,setPlCustomFrom]=useState("");
  const [plCustomTo,setPlCustomTo]=useState(today());
  // Analytics date filter
  const [anlPeriod,setAnlPeriod]=useState("all");
  const [anlCustomFrom,setAnlCustomFrom]=useState("");
  const [anlCustomTo,setAnlCustomTo]=useState(today());
  const [anlSpecificDate,setAnlSpecificDate]=useState(today());
  const [anlActiveSection,setAnlActiveSection]=useState("overview");
  // Analytics interactive sub-states
  const [anlCustSearch,setAnlCustSearch]=useState("");
  const [anlCustSort,setAnlCustSort]=useState("revenue");
  const [anlCustFilter,setAnlCustFilter]=useState("all");
  const [anlCustExpanded,setAnlCustExpanded]=useState(null);
  const [anlProdSort,setAnlProdSort]=useState("revenue");
  const [anlProdExpanded,setAnlProdExpanded]=useState(null);
  const [anlOpsView,setAnlOpsView]=useState("production");
  const [anlFinView,setAnlFinView]=useState("summary");
  const [anlOverviewMetric,setAnlOverviewMetric]=useState("revenue");
  const [anlExportOpen,setAnlExportOpen]=useState(null);
  // Production search + auto-deduct toggle
  const [ptSearch,setPtSearch]=useState("");
  const [ptShiftFilter,setPtShiftFilter]=useState("all");
  const ptAutoDeduct=settings?.autoDeductEnabled!==false;
  const [ptCustomFrom,setPtCustomFrom]=useState("");
  const [ptCustomTo,setPtCustomTo]=useState(today());
  const [ptProductFilter,setPtProductFilter]=useState("all");
  const [ptWasteTypeFilter,setPtWasteTypeFilter]=useState("all");
  const [ptQcGradeFilter,setPtQcGradeFilter]=useState("all");
  const [ptHandoverFilter,setPtHandoverFilter]=useState("all"); // "all" | "with" | "without"
  const [ptShowFilters,setPtShowFilters]=useState(false);
  // Bulk delete cutoff
  const [bulkDelMonths,setBulkDelMonths]=useState("3");
  // Reset password
  const [resetPwUser,setResetPwUser]=useState("");
  const [resetPwVal,setResetPwVal]=useState("");
  // ── INTERACTIVE EXPENSE / FINANCIAL OVERVIEW / P&L STATE ──
  const [expCardExpanded,setExpCardExpanded]=useState(null);
  const [expHovered,setExpHovered]=useState(null);
  const [expCatModal,setExpCatModal]=useState(null);
  const [expVendorModal,setExpVendorModal]=useState(null);
  const [finOvSubModal,setFinOvSubModal]=useState(null);
  const [plMonthExpanded,setPlMonthExpanded]=useState(null);
  const [plMonthHovered,setPlMonthHovered]=useState(null);
  const [plCustExpanded,setPlCustExpanded]=useState(null);
  const [plCustHovered,setPlCustHovered]=useState(null);
  const [plInsightExpanded,setPlInsightExpanded]=useState(false);
  const [expSortMode,setExpSortMode]=useState("date");
  // ── DEEP INTERACTIVE MODALS ──────────────────────────────────
  const [detailModal,setDetailModal]=useState(null); // {type:"expense"|"delivery"|"customer"|"date"|"agent"|"supply", data:...}
  const closeDetail=()=>setDetailModal(null);

  // CUSTOMERS
  function saveC(){if(!cF.name.trim()){notify("Name required");return;}const rec={...cF,paid:+cF.paid||0,pending:+cF.pending||0,partialPay:+cF.partialPay||0};if(cSh==="add"){setCust(p=>[...p,{...rec,id:uid()}]);addLog("Added customer",rec.name);notify("Customer added ✓");addNotif("Customer Added",`${rec.name} has been added`,"success");}else{setCust(p=>p.map(c=>c.id===cSh.id?{...rec,id:c.id}:c));addLog("Edited customer",rec.name);notify("Updated ✓");}setCsh(null);}
  function delC(c){ask(`Delete "${c.name}"?`,()=>{setCust(p=>p.filter(x=>x.id!==c.id));addLog("Deleted customer",c.name);notify("Deleted");});}
  function togActive(c){setCust(p=>p.map(x=>x.id===c.id?{...x,active:!x.active}:x));addLog(`${c.active?"Deactivated":"Activated"} customer`,c.name);notify("Updated");}
  function recPay(){const a=+payAmt;if(!a||a<=0||!paySh){notify("Enter a valid amount");return;}if(a>paySh.pending*2&&paySh.pending>0){notify(`Amount ${inr(a)} seems too high — pending is only ${inr(paySh.pending)}. Please check.`);return;}setCust(p=>p.map(c=>c.id===paySh.id?{...c,paid:c.paid+a,pending:Math.max(0,c.pending-a)}:c));addLog("Payment recorded",`${paySh.name} — ${inr(a)}`);notify(`${inr(a)} recorded`);addNotif("Payment Recorded",`${inr(a)} received from ${paySh.name}`,"success");setPaySh(null);setPayAmt("");}

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
    // Handle partial payment on delivery creation/edit
    const partialAmt = dF.partialPayment?.enabled ? (+dF.partialPayment?.amount||0) : 0;
    if(partialAmt>0 && dF.customerId){
      setCust(p=>p.map(c=>c.id===dF.customerId?{...c,paid:(c.paid||0)+partialAmt,pending:Math.max(0,(c.pending||0)-partialAmt)}:c));
      addLog("Partial payment on delivery",`${dF.customer} — ${inr(partialAmt)} collected`);
    }
    if(dSh==="add"){
      const newId=uid();
      // ── Auto-assign invoice number immediately on creation ──
      const newSeq=(invRegistry.seq||0)+1;
      const prefix=settings?.invoicePrefix||"TAS";
      const yearReset=settings?.invoiceYearReset!==false;
      const year=new Date().getFullYear();
      const newInvNo=yearReset?`${prefix}-${year}-${String(newSeq).padStart(4,"0")}`:`${prefix}-${String(newSeq).padStart(4,"0")}`;
      setInvRegistry(prev=>({seq:newSeq,issued:{...(prev.issued||{}),[newId]:newInvNo}}));
      // ── Link invoice to any production batch for the same date+product ──
      const delivDate=dF.date||today();
      const delivItems=Object.values(safeO(dF.orderLines)).filter(l=>(l.qty||0)>0).map(l=>l.name||"");
      if(delivItems.length>0){
        setProdTargets(prev=>prev.map(pt=>{
          if(pt.date!==delivDate) return pt;
          const matches=delivItems.some(item=>pt.product&&(pt.product===item||item.toLowerCase().includes(pt.product.toLowerCase())||pt.product.toLowerCase().includes(item.toLowerCase())));
          if(!matches) return pt;
          const existing=pt.linkedInvoices||[];
          if(existing.includes(newInvNo)) return pt;
          return {...pt,linkedInvoices:[...existing,newInvNo]};
        }));
      }
      setDeliv(p=>[...p,{...dF,id:newId,invNo:newInvNo,partialPayment:{...dF.partialPayment,amount:partialAmt}}]);
      addLog("Added delivery",`${dF.customer} [${newInvNo}]`);
      notify(`Delivery added · ${newInvNo} ✓`);
      addNotif("Delivery Added",`${dF.customer} — ${newInvNo}`,"success");
      captureGPS("delivery_saved",dF.customer);
    }
    else{setDeliv(p=>p.map(d=>d.id===dSh.id?{...dF,id:d.id,partialPayment:{...dF.partialPayment,amount:partialAmt}}:d));addLog("Edited delivery",dF.customer);notify("Updated ✓");captureGPS("delivery_saved",dF.customer);}
    setDsh(null);
  }
  function tglD(d){const ns=d.status==="Pending"?"Delivered":"Pending";setDeliv(p=>p.map(x=>x.id===d.id?{...x,status:ns}:x));addLog("Status changed",`${d.customer} → ${ns}`);notify("Updated");if(ns==="Delivered"){addNotif("Delivery Completed",`${d.customer} marked as Delivered`,"success");captureGPS("marked_delivered",d.customer);}}
  function delD(d){ask(`Delete delivery for "${d.customer}"?`,()=>{setDeliv(p=>p.filter(x=>x.id!==d.id));addLog("Deleted delivery",d.customer);notify("Deleted");});}

  // BULK ORDER ENTRY
  function initBulkRows(){
    const rows=customers.filter(c=>c.active).map(c=>({customerId:c.id,customer:c.name,address:c.address||"",lat:c.lat||0,lng:c.lng||0,orderLines:{...safeO(c.orderLines)},include:false}));
    setBulkOrderRows(rows);
    setBulkOrderDate(today());
    setBulkOrderStatus("Pending");
    setBulkOrderSh(true);
  }
  function saveBulkOrders(){
    const toAdd=bulkOrderRows.filter(r=>r.include&&r.customer&&Object.values(safeO(r.orderLines)).some(l=>(l.qty||0)>0));
    if(!toAdd.length){notify("Select at least one customer with items");return;}
    const prefix=settings?.invoicePrefix||"TAS";
    const yearReset=settings?.invoiceYearReset!==false;
    const year=new Date().getFullYear();
    let seq=invRegistry.seq||0;
    const newIssuedMap={...(invRegistry.issued||{})};
    // eslint-disable-next-line no-unused-vars
    const newDelivs=toAdd.map(({include,...r})=>{
      const newId=uid();
      seq+=1;
      const invNo=yearReset?`${prefix}-${year}-${String(seq).padStart(4,"0")}`:`${prefix}-${String(seq).padStart(4,"0")}`;
      newIssuedMap[newId]=invNo;
      return {...r,id:newId,invNo,date:bulkOrderDate,deliveryDate:"",status:bulkOrderStatus,notes:"",createdBy:displayName,createdAt:ts(),partialPayment:{enabled:false,amount:""}};
    });
    setInvRegistry(prev=>({seq,issued:{...(prev.issued||{}),...newIssuedMap}}));
    setDeliv(p=>[...p,...newDelivs]);
    addLog("Bulk orders created",`${newDelivs.length} orders for ${bulkOrderDate} · ${newDelivs[0]?.invNo}…`);
    notify(`${newDelivs.length} orders created ✓`);
    setBulkOrderSh(false);
  }
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
  function saveFinSnapshot(dateStr){
    const dayRevenue=deliveries.filter(d=>d.date===dateStr&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0);
    const daySupply=supplies.filter(s=>s.date===dateStr).reduce((s,x)=>s+(x.cost||0),0);
    const dayExpenses=expenses.filter(e=>e.date===dateStr).reduce((s,e)=>s+(e.amount||0),0);
    const dayWastage=(wastage||[]).filter(w=>w.date===dateStr).reduce((s,w)=>s+(w.cost||0),0);
    const snap={date:dateStr,revenue:dayRevenue,supplyCost:daySupply,opExpenses:dayExpenses,wastageCost:dayWastage,netProfit:dayRevenue-daySupply-dayExpenses-dayWastage,savedBy:sess.name,savedAt:ts()};
    setFinSnapshots(p=>({...(p||{}),["day_"+dateStr.replace(/-/g,"")]:snap}));
    addLog("Saved financial snapshot",dateStr);notify("Snapshot saved ✓");}

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
  // ── Smart Auto-Deduct ─────────────────────────────────────────
  // Returns deduction info object so savePT can store it on the record
  function runAutoDeduct(productName,actualQty,prevActual,currentSupplies){
    if(!ptAutoDeduct||actualQty<=0) return null;
    const deductQty=prevActual!=null?Math.max(0,actualQty-prevActual):actualQty;
    if(deductQty<=0){notify("✓ No additional deduction (qty unchanged)");return null;}
    const pn=productName.toLowerCase();
    // Use currentSupplies if provided (avoids stale closure bug on rapid saves)
    const supList=currentSupplies||supplies;
    const scored=supList.map(s=>{
      const sn=(s.item||"").toLowerCase();
      let score=0;
      if(sn===pn) score=100;
      else if(sn.includes(pn)||pn.includes(sn)) score=60;
      else{const pW=pn.split(/\s+/);const sW=sn.split(/\s+/);const h=pW.filter(w=>sW.some(sw=>sw.includes(w)||w.includes(sw)));if(h.length>0)score=30+h.length*10;}
      return{...s,_score:score};
    }).filter(s=>s._score>0).sort((a,b)=>b._score-a._score);
    if(scored.length===0){
      addNotif("Auto-Deduct","No matching supply for \""+productName+"\"","warning");
      notify("✓ Saved · ⚠️ No matching supply for auto-deduct");
      return null;
    }
    const best=scored[0];
    const qtyBefore=best.qty||0;
    const newQty=Math.max(0,qtyBefore-deductQty);
    // Use functional update to avoid stale state when multiple saves happen quickly
    setSup(p=>p.map(s=>s.id===best.id?{...s,qty:Math.max(0,(s.qty||0)-deductQty)}:s));
    addLog("Auto-deducted supply",`${best.item}: ${qtyBefore}→${newQty} (${productName} ×${deductQty})`);
    const lowWarn=best.minStock>0&&newQty<=best.minStock?" · ⚠️ Low stock!":"";
    if(best.minStock>0&&newQty<=best.minStock) addNotif(`⚠️ Low Stock: ${best.item}`,`Only ${newQty} ${best.unit||""} left after auto-deduct`,"warning","lowstock");
    notify(`✓ ${actualQty} produced · "${best.item}": ${qtyBefore}→${newQty}${lowWarn}`);
    // Return deduction record to be stored on the production entry
    return {supplyItem:best.item,supplyId:best.id,qtyBefore,qtyAfter:newQty,deducted:deductQty,ts:ts()};
  }

  function savePT(){
    if(!ptF.product.trim()){notify("Product required");return;}
    const productName=ptF.product==="__custom__"?(ptF.customProduct||"").trim():ptF.product;
    if(!productName){notify("Product name required");return;}
    const batchIdFinal=ptF.batchId||uid();
    const rec={...ptF,product:productName,actual:+ptF.actual||0,
      batchId:batchIdFinal,
      batchLabel:ptF.batchLabel||"Batch 1",
      qcGrade:ptF.qcGrade||"A",
      qcNotes:ptF.qcNotes||"",
      shift:ptF.shift||"",
    };
    // Remove embedded sub-records from the main batch record
    delete rec.embWastage; delete rec.embQC; delete rec.embHandover;
    // Remove legacy target field
    delete rec.target;

    // Save embedded wastage records
    const embW=(ptF.embWastage||[]).filter(w=>w.product&&w.qty);
    const embQ=(ptF.embQC||[]).filter(q=>q.product&&q.grade);
    const embH=(ptF.embHandover||[]).filter(h=>h.note&&h.note.trim());

    if(ptSh==="add"){
      const deduction=runAutoDeduct(productName,rec.actual,null);
      // ── Link any same-date deliveries for this product to this batch ──
      const matchingInvNos=deliveries
        .filter(d=>d.date===rec.date)
        .filter(d=>Object.values(safeO(d.orderLines)).some(l=>(l.qty||0)>0&&l.name&&(l.name===productName||l.name.toLowerCase().includes(productName.toLowerCase())||productName.toLowerCase().includes(l.name.toLowerCase()))))
        .map(d=>(invRegistry?.issued||{})[d.id]||d.invNo)
        .filter(Boolean);
      const savedRec={...rec,id:uid(),createdAt:ts(),deduction:deduction||null,linkedInvoices:[...new Set(matchingInvNos)]};
      setProdTargets(p=>[savedRec,...p]);
      // Save embedded records linked to this batch
      if(embW.length>0) setWaste(p=>[...embW.map(w=>({...w,batchId:batchIdFinal,id:w.id||uid(),createdAt:w.createdAt||ts()})),...p]);
      if(embQ.length>0) setQcLogs(p=>[...embQ.map(q=>({...q,batchId:batchIdFinal,id:q.id||uid(),createdAt:q.createdAt||ts()})),...p]);
      if(embH.length>0) setHandovers(p=>[...embH.map(h=>({...h,batchId:batchIdFinal,id:h.id||uid(),createdAt:h.createdAt||ts()})),...p]);
      addLog("Production logged",`${rec.batchLabel} — ${rec.product} — ${rec.actual} units${rec.shift?" ("+rec.shift+")":""}${embW.length>0?` · ${embW.length} wastage`:""}${embQ.length>0?` · ${embQ.length} QC`:""}${embH.length>0?` · handover`:""}`);
      captureGPS("production_logged",rec.product);
      if(!ptAutoDeduct) notify("Batch saved ✓");
    } else {
      const prev=prodTargets.find(x=>x.id===ptSh.id);
      const deduction=runAutoDeduct(productName,rec.actual,prev?.actual);
      const mergedDeduction=deduction||(prev?.deduction||null);
      setProdTargets(p=>p.map(x=>x.id===ptSh.id?{...rec,id:x.id,createdAt:x.createdAt,deduction:mergedDeduction}:x));
      // On edit: remove old linked records and re-add from embedded
      setWaste(p=>{const withoutOld=p.filter(w=>w.batchId!==batchIdFinal||!w._embLinked);return embW.length>0?[...embW.map(w=>({...w,batchId:batchIdFinal,_embLinked:true,id:w.id||uid(),createdAt:w.createdAt||ts()})),...withoutOld]:withoutOld;});
      setQcLogs(p=>{const withoutOld=p.filter(q=>q.batchId!==batchIdFinal||!q._embLinked);return embQ.length>0?[...embQ.map(q=>({...q,batchId:batchIdFinal,_embLinked:true,id:q.id||uid(),createdAt:q.createdAt||ts()})),...withoutOld]:withoutOld;});
      setHandovers(p=>{const withoutOld=p.filter(h=>h.batchId!==batchIdFinal||!h._embLinked);return embH.length>0?[...embH.map(h=>({...h,batchId:batchIdFinal,_embLinked:true,id:h.id||uid(),createdAt:h.createdAt||ts()})),...withoutOld]:withoutOld;});
      addLog("Production updated",`${rec.batchLabel} — ${rec.product} — ${rec.actual} units`);
      captureGPS("production_logged",rec.product);
      if(!ptAutoDeduct) notify("Updated ✓");
    }
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
  function exportAll(){const d={customers,deliveries,supplies,expenses,products,users,actLog,wastage,at:new Date().toISOString()};const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:"application/json"}));a.download=`tas_backup_${today()}.json`;a.click();URL.revokeObjectURL(a.href);addLog("Exported backup","Full JSON");notify("Exported ✓");setLastBackupDate(today());}
  function exportFullReport(){
    const co=settings?.companyName||"TAS Healthy World";
    const now=new Date().toLocaleString("en-IN");
    const totalReplAmt=deliveries.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
    const totalWasteQty=(wastage||[]).reduce((s,w)=>s+(w.qty||0),0);
    const totalWasteCost=(wastage||[]).reduce((s,w)=>s+(w.cost||0),0);
    const delivWithRepl=deliveries.filter(d=>d.replacement?.done);
    const totalOrderVal=deliveries.reduce((s,d)=>s+lineTotal(d.orderLines),0);
    const totalPaidAll=deliveries.reduce((s,d)=>s+(d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0),0);
    const totalRemAll=totalOrderVal-totalReplAmt-totalPaidAll;
    // Build per-customer delivery groups
    const custDelivMap={};
    deliveries.forEach(d=>{
      if(!custDelivMap[d.customer])custDelivMap[d.customer]={name:d.customer,delivs:[]};
      custDelivMap[d.customer].delivs.push(d);
    });
    const custGroups=Object.values(custDelivMap).sort((a,b)=>a.name.localeCompare(b.name));
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Full Report — ${co}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;color:#1c1917;padding:32px;max-width:960px;margin:0 auto}
h1{font-size:22px;font-weight:900;color:#92400e;margin-bottom:4px}
.sub{font-size:11px;color:#78716c;margin-bottom:28px}
h2{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#a8a29e;margin:28px 0 10px;padding-bottom:6px;border-bottom:2px solid #e7e5e4}
h3{font-size:12px;font-weight:700;color:#1c1917;margin:18px 0 6px;padding:6px 10px;background:#f5f5f4;border-left:3px solid #f59e0b;border-radius:4px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:8px}
.grid6{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:8px}
.stat{background:#f5f5f4;border-radius:10px;padding:14px}.stat .val{font-size:20px;font-weight:900;color:#1c1917}.stat .lbl{font-size:10px;color:#78716c;text-transform:uppercase;letter-spacing:.5px;margin-top:3px}
table{width:100%;border-collapse:collapse;margin-top:4px}th{font-size:9px;text-transform:uppercase;color:#a8a29e;padding:6px 4px;border-bottom:2px solid #e7e5e4;text-align:left}td{padding:6px 4px;border-bottom:1px solid #f5f5f4;font-size:11px}
.green{color:#059669}.red{color:#dc2626}.amber{color:#d97706}.orange{color:#ea580c}.blue{color:#0369a1}
.badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:9px;font-weight:700}
.bg{background:#d1fae5;color:#065f46}.by{background:#fef3c7;color:#92400e}.bb{background:#dbeafe;color:#1e40af}.bo{background:#ffedd5;color:#9a3412}
.cust-totals{display:flex;gap:16px;flex-wrap:wrap;padding:6px 0 8px;font-size:11px}
.footer{margin-top:36px;text-align:center;font-size:10px;color:#a8a29e;padding-top:16px;border-top:1px solid #e7e5e4}
@media print{@page{margin:1.5cm}}</style></head><body>
<h1>🫓 ${co} — Full Operations Report</h1>
<div class="sub">Exported on ${now} · Period: All time</div>

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

<h2>Deliveries Overview (${deliveries.length} total · ${deliveries.filter(d=>d.status==="Delivered").length} delivered · ${deliveries.filter(d=>d.status==="Pending").length} pending)</h2>
<div class="grid6" style="grid-template-columns:repeat(3,1fr)">
  <div class="stat"><div class="val">₹${totalOrderVal.toLocaleString("en-IN")}</div><div class="lbl">Total Order Value</div></div>
  <div class="stat"><div class="val orange">₹${totalReplAmt.toLocaleString("en-IN")}</div><div class="lbl">Total Replacements Deducted</div></div>
  <div class="stat"><div class="val green">₹${(totalOrderVal-totalReplAmt).toLocaleString("en-IN")}</div><div class="lbl">Net Billed Amount</div></div>
  <div class="stat"><div class="val blue">₹${totalPaidAll.toLocaleString("en-IN")}</div><div class="lbl">Total Paid</div></div>
  <div class="stat"><div class="val ${totalRemAll>0?"red":"green"}">₹${totalRemAll.toLocaleString("en-IN")}</div><div class="lbl">Total Remaining</div></div>
  <div class="stat"><div class="val amber">${delivWithRepl.length}</div><div class="lbl">Deliveries With Replacements</div></div>
</div>
<table><tr><th>Invoice No</th><th>Receipt No</th><th>Customer</th><th>Date</th><th>Status</th><th>Total Order</th><th>Repl Deducted</th><th>Net Amt</th><th>Paid</th><th>Remaining</th><th>By</th></tr>
${deliveries.map(d=>{const tot=lineTotal(d.orderLines);const repl=+d.replacement?.amount||0;const net=tot-repl;const paid=d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0;const rem=Math.max(0,net-paid);const inv=d.invNo||`INV-${(d.date||"").replace(/-/g,"")}-${(d.id||"").slice(-4).toUpperCase()}`;const rcp=`RCP-${inv.replace(/^[A-Z]+-/,"")}`;return`<tr><td style="font-family:monospace;font-size:9px;color:#7c3aed">${inv}</td><td style="font-family:monospace;font-size:9px;color:#0ea5e9">${rcp}</td><td><b>${d.customer}</b></td><td>${d.date}</td><td><span class="badge ${d.status==="Delivered"?"bg":d.status==="In Transit"?"bb":"by"}">${d.status}</span></td><td>₹${tot.toLocaleString("en-IN")}</td><td class="orange">${repl>0?`₹${repl.toLocaleString("en-IN")}`:"—"}</td><td>₹${net.toLocaleString("en-IN")}</td><td class="green">₹${paid.toLocaleString("en-IN")}</td><td class="${rem>0?"red":"green"}">₹${rem.toLocaleString("en-IN")}</td><td>${d.createdBy||"—"}</td></tr>`;}).join("")}
</table>

<h2>Deliveries by Customer</h2>
${custGroups.map(cg=>{
  const cTotOrd=cg.delivs.reduce((s,d)=>s+lineTotal(d.orderLines),0);
  const cTotRepl=cg.delivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
  const cNet=cTotOrd-cTotRepl;
  const cPaid=cg.delivs.reduce((s,d)=>s+(d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0),0);
  const cRem=Math.max(0,cNet-cPaid);
  return `<h3>${cg.name} — ${cg.delivs.length} deliveries</h3>
<div class="cust-totals">
  <span>Total Order: <b>₹${cTotOrd.toLocaleString("en-IN")}</b></span>
  ${cTotRepl>0?`<span class="orange">Repl Deducted: <b>₹${cTotRepl.toLocaleString("en-IN")}</b></span>`:""}
  <span class="green">Paid: <b>₹${cPaid.toLocaleString("en-IN")}</b></span>
  <span class="${cRem>0?"red":"green"}">Remaining: <b>₹${cRem.toLocaleString("en-IN")}</b></span>
</div>
<table><tr><th>Invoice No</th><th>Receipt No</th><th>Date</th><th>Status</th><th>Items</th><th>Total Order</th><th>Repl</th><th>Net</th><th>Paid</th><th>Remaining</th></tr>
${cg.delivs.sort((a,b)=>b.date.localeCompare(a.date)).map(d=>{
  const tot=lineTotal(d.orderLines);
  const repl=+d.replacement?.amount||0;
  const net=tot-repl;
  const paid=d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0;
  const rem=Math.max(0,net-paid);
  const items=Object.values(safeO(d.orderLines)).filter(l=>l.qty>0).map(l=>`${l.qty}×${products.find(p=>p.id===Object.keys(safeO(d.orderLines)).find(k=>safeO(d.orderLines)[k]===l))?.name||"?"}`).join(", ") || Object.values(safeO(d.orderLines)).filter(l=>l.qty>0).map(l=>`${l.qty} items`).join(", ") || "—";
  const inv=d.invNo||`INV-${(d.date||"").replace(/-/g,"")}-${(d.id||"").slice(-4).toUpperCase()}`;
  const rcp=`RCP-${inv.replace(/^[A-Z]+-/,"")}`;
  return`<tr><td style="font-family:monospace;font-size:9px;color:#7c3aed">${inv}</td><td style="font-family:monospace;font-size:9px;color:#0ea5e9">${rcp}</td><td>${d.date}</td><td><span class="badge ${d.status==="Delivered"?"bg":d.status==="In Transit"?"bb":"by"}">${d.status}</span></td><td style="font-size:10px">${d.replacement?.done?`<span class="badge bo">🔄 ${d.replacement.item||"replaced"}</span> `:""}${items}</td><td>₹${tot.toLocaleString("en-IN")}</td><td class="orange">${repl>0?`₹${repl.toLocaleString("en-IN")}`:"—"}</td><td>₹${net.toLocaleString("en-IN")}</td><td class="green">₹${paid.toLocaleString("en-IN")}</td><td class="${rem>0?"red":"green"}">₹${rem.toLocaleString("en-IN")}</td></tr>`;
}).join("")}
</table>`;
}).join("")}

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

<div class="footer">${co} · Full Operations Report · Exported on ${now} · TAS CRM</div>
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

  function importAll(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{try{const d=JSON.parse(ev.target.result);if(!d.customers&&!d.deliveries&&!d.products){notify("Invalid backup file — missing data");return;}ask("⚠️ This will overwrite ALL current data with the backup. This cannot be undone. Are you sure?",()=>{if(d.customers)setCust(d.customers);if(d.deliveries)setDeliv(d.deliveries);if(d.supplies)setSup(d.supplies);if(d.expenses)setExp(d.expenses);if(d.products)setProd(d.products);if(d.users)setUsers(d.users);if(d.wastage)setWaste(d.wastage);addLog("Imported backup","Full restore");notify("Imported ✓");});}catch{notify("Invalid backup file");}};r.readAsText(f);e.target.value="";}

  const TABS=isAdmin?ALL_TABS:ALL_TABS.filter(tb=>userPerms.includes(tb));
  const expCats=settings?.expenseCategories||["Gas","Labour","Transport","Packaging","Utilities","Maintenance","Other"];
  const delivStats=settings?.deliveryStatuses||["Pending","In Transit","Delivered","Cancelled"];
  const supUnits=settings?.supplyUnits||["kg","g","L","mL","pcs","bags","boxes","dozen"];

  // Tab icons for nav
  const TAB_ICONS={"Dashboard":"📊","Customers":"👥","Deliveries":"🚚","Payments":"💳","Supplies":"📦","Expenses":"💸","Wastage":"🗑️","P&L":"📈","Analytics":"🔍","Production":"🏭","GPS":"📍","Settings":"⚙️"};

  if(!dataLoaded) return <div style={{background:dm?"#0c0c10":"#f2f2ed",minHeight:"100svh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}><div style={{width:40,height:40,border:"3px solid #f59e0b",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/><p style={{color:"#f59e0b",fontSize:12,fontWeight:600,letterSpacing:1}}>Loading data…</p><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;

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
          {TABS.map((tb,idx)=>(
            <button key={tb} onClick={()=>{setTab(tb);setSrch("");}}
              style={tab===tb
                ?{background:t.sidebarActiveBg,color:t.sidebarActive,borderLeft:`2px solid ${t.sidebarActive}`,paddingLeft:14,borderRadius:"0 4px 4px 0","--si-delay":`${0.04+idx*0.03}s`}
                :{color:"rgba(232,237,245,0.65)",borderLeft:"2px solid transparent",paddingLeft:14,borderRadius:"0 4px 4px 0","--si-delay":`${0.04+idx*0.03}s`}}
              className="flex items-center gap-2.5 py-2 text-left w-full transition-all rounded-r text-sm crm-sidebar-item crm-list-item">
              <span style={{fontSize:13,width:18,textAlign:"center",flexShrink:0,lineHeight:1}}>{TAB_ICONS[tb]||"•"}</span>
              <span style={{fontSize:12,fontWeight:tab===tb?600:500,letterSpacing:"0.005em"}} className="truncate">{tb}</span>
              {tb==="Dashboard"&&pendingD.length>0&&tab!=="Dashboard"&&<span style={{marginLeft:"auto",fontSize:9,fontWeight:700,background:"#3b82f6",color:"#fff",borderRadius:99,width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} className="crm-notif-badge">{pendingD.length}</span>}
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
            <div style={{width:5,height:5,borderRadius:"50%",background:lastSync?"#10b981":"#3b82f6",flexShrink:0}} className={lastSync?"":"crm-sync-dot"}/>
            <p style={{color:"rgba(232,237,245,0.45)",fontSize:9,letterSpacing:"0.02em"}}>{lastSync?`Synced ${lastSync.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}`:"Connecting…"}</p>
          </div>
        </div>
      </aside>

      {/* ── MOBILE / TABLET MAIN AREA ─────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 lg:pb-0" style={{paddingBottom:"calc(64px + env(safe-area-inset-bottom,0px))"}}>

      {/* HEADER — shown on mobile/tablet only (hidden on lg desktop where sidebar takes over) */}
      <header style={{background:t.card,borderBottom:`1px solid ${t.border}`,boxShadow:"0 1px 8px rgba(0,0,0,0.06)"}} className="sticky top-0 z-30 crm-header-enter crm-header">
        <div style={{paddingTop:"env(safe-area-inset-top,0px)"}} className="px-4 py-3 flex items-center justify-between gap-2 lg:px-6">
          {/* Left: brand logo (mobile only) */}
          <div className="flex items-center gap-2.5 lg:hidden min-w-0">
            <div style={{background:"rgba(217,119,6,0.1)",border:"1px solid rgba(217,119,6,0.2)",width:36,height:36,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,userSelect:"none",flexShrink:0}}>{settings?.appEmoji||"🫓"}</div>
            <div className="min-w-0">
              <p style={{color:t.text,fontSize:15}} className="font-bold leading-tight truncate max-w-[120px] sm:max-w-[160px]">{settings?.appName||"TAS Healthy World"}</p>
              <p style={{color:t.sub,fontSize:11}} className="font-medium capitalize">{sess.role}{subStaff.length>0?` · ${activeStaff}`:""}</p>
            </div>
          </div>
          {/* Center: current tab (shown on all mobile/tablet) */}
          <div className="flex lg:hidden items-center gap-2 ml-auto mr-auto" style={{position:"absolute",left:"50%",transform:"translateX(-50%)"}}>
            <span style={{fontSize:18}}>{TAB_ICONS[tab]||"•"}</span>
            <h1 style={{color:t.text,fontSize:16}} className="font-black tracking-tight hidden sm:block">{tab}</h1>
          </div>
          {/* Desktop: page title */}
          <div className="hidden lg:flex items-center gap-2.5">
            <span className="text-xl">{TAB_ICONS[tab]||"•"}</span>
            <h1 style={{color:t.text}} className="font-black text-xl tracking-tight">{tab}</h1>
          </div>
          {/* Right: actions */}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            {/* Bell */}
            <div className="relative">
              <button onClick={()=>{setNotifOpen(o=>!o);if(unreadNotifs>0)markAllRead();}} style={{background:t.inp,color:t.text,border:`1.5px solid ${t.border}`,width:40,height:40,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0,WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}} className="relative">
                🔔
                {unreadNotifs>0&&<span key={unreadNotifs} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 crm-notif-badge" style={{borderColor:t.card}}>{unreadNotifs>9?"9+":unreadNotifs}</span>}
              </button>
              {notifOpen&&<div style={{background:t.card,border:`1.5px solid ${t.border}`,zIndex:200,boxShadow:"0 20px 40px rgba(0,0,0,0.2)",borderRadius:20,overflow:"hidden"}} className="absolute right-0 top-12 w-[calc(100vw-2rem)] max-w-xs sm:w-80">
                <div className="flex items-center justify-between px-4 py-3.5" style={{borderBottom:`1px solid ${t.border}`}}>
                  <span style={{color:t.text,fontSize:14}} className="font-bold tracking-tight">Notifications</span>
                  <div className="flex gap-3">
                    {notifs.length>0&&<button onClick={()=>setNotifs([])} style={{color:t.sub,fontSize:12,minHeight:32,padding:"0 8px",background:"transparent",border:"none",cursor:"pointer"}} className="font-semibold">Clear all</button>}
                    <button onClick={()=>setNotifOpen(false)} style={{color:t.sub,fontSize:13,minHeight:32,width:32,background:"transparent",border:"none",cursor:"pointer"}} className="font-bold">✕</button>
                  </div>
                </div>
                <div style={{maxHeight:360,overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
                  {notifs.length===0
                    ?<div className="py-8 flex flex-col items-center gap-2"><span className="text-2xl">🔔</span><p style={{color:t.sub,fontSize:13}} className="font-medium">All caught up!</p></div>
                    :notifs.map(n=>(
                    <div key={n.id} style={{background:n.read?t.card:dm?"#1e1a0e":"#fffbeb",borderBottom:`1px solid ${t.border}`}} className="px-4 py-3.5 flex gap-3">
                      <span style={{fontSize:16}} className="mt-0.5 shrink-0">{n.type==="success"?"✅":n.type==="warning"?"⚠️":n.type==="error"?"❌":"ℹ️"}</span>
                      <div className="flex-1 min-w-0">
                        <p style={{color:t.text,fontSize:13}} className="font-semibold">{n.title}</p>
                        <p style={{color:t.sub,fontSize:12}} className="mt-0.5 leading-relaxed">{n.body}</p>
                        <p style={{color:t.sub,fontSize:11}} className="mt-1 font-medium">{n.ts}</p>
                      </div>
                      <button onClick={()=>delNotif(n.id)} style={{color:t.sub,fontSize:14,minHeight:32,width:24,background:"transparent",border:"none",cursor:"pointer",WebkitTapHighlightColor:"transparent"}} className="shrink-0">✕</button>
                    </div>
                  ))}
                </div>
              </div>}
            </div>
            {/* Dark mode toggle - mobile */}
            <button onClick={()=>setDm(d=>!d)} style={{background:t.inp,color:t.text,border:`1.5px solid ${t.border}`,width:40,height:40,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",flexShrink:0}} className="lg:hidden">{dm?"☀️":"🌙"}</button>
            {/* Desktop sign out + dark mode */}
            <button onClick={onLogout} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`}} className="text-[11px] px-3 py-1.5 rounded-xl font-semibold hidden lg:inline-flex hover:opacity-80">↩ Sign out</button>
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

      <div className="w-full max-w-full sm:max-w-3xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 xl:px-10 py-3 sm:py-5 flex flex-col gap-3 crm-tab-content" key={tab}>

        {/* DASHBOARD */}
        {tab==="Dashboard"&&(<>
          {/* ══════════════════════════════════════════
              PHASE 12 — DASHBOARD (Redesigned)
          ══════════════════════════════════════════ */}
          {(()=>{
            const todayStr = today();
            const todayDelivs = deliveries.filter(d => d.date === todayStr);
            const todayDone   = todayDelivs.filter(d => d.status === "Delivered");
            const todayPend   = todayDelivs.filter(d => d.status === "Pending");
            const todayTransit= todayDelivs.filter(d => d.status === "In Transit");
            const todayCancl  = todayDelivs.filter(d => d.status === "Cancelled");
            const todayRev    = todayDone.reduce((s,d) => s + lineTotal(d.orderLines), 0);

            const startOfWeek = (() => { const d=new Date(); d.setDate(d.getDate()-6); return d.toISOString().slice(0,10); })();
            const startOfMonth= (() => { const d=new Date(); d.setDate(1); return d.toISOString().slice(0,10); })();
            const weekDelivs  = deliveries.filter(d => d.date >= startOfWeek && d.status === "Delivered");
            const monthDelivs = deliveries.filter(d => d.date >= startOfMonth && d.status === "Delivered");
            const weekRev     = weekDelivs.reduce((s,d) => s + lineTotal(d.orderLines), 0);
            const monthRev    = monthDelivs.reduce((s,d) => s + lineTotal(d.orderLines), 0);

            const allDue      = customers.filter(c => c.pending > 0);
            const totalDueAmt = allDue.reduce((s,c) => s + (c.pending||0), 0);

            const todayPT     = prodTargets.filter(p => p.date === todayStr);
            const totalTarget = todayPT.reduce((s,p) => s + (p.target||0), 0);
            const totalActual = todayPT.reduce((s,p) => s + (p.actual||0), 0);
            const prodPct     = totalTarget > 0 ? Math.round(totalActual / totalTarget * 100) : null;

            const overdueD    = deliveries.filter(d => d.status === "Pending" && d.date < todayStr);
            const todayWastage= wastage.filter(w => w.date === todayStr);
            const todayWasteCost = todayWastage.reduce((s,w) => s + (w.cost||0), 0);

            const greetHour = new Date().getHours();
            const greeting = greetHour < 12 ? "Good morning" : greetHour < 17 ? "Good afternoon" : "Good evening";
            const greetEmoji = greetHour < 12 ? "🌅" : greetHour < 17 ? "☀️" : "🌙";

            // shared card style helpers
            const card = (extra={}) => ({background:t.card, border:`1px solid ${t.border}`, borderRadius:20, ...extra});
            const sectionLabel = {color:t.sub, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:6};
            const bigNum = (color="#fff") => ({color, fontWeight:900, fontSize:26, lineHeight:1, letterSpacing:"-0.02em"});

            return <>

            {/* ── GREETING HEADER ── */}
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:2,flexWrap:"wrap",gap:10}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:20}}>{greetEmoji}</span>
                  <div>
                    <p style={{color:t.text,fontWeight:800,fontSize:20,lineHeight:1.15,letterSpacing:"-0.02em"}}>
                      {greeting}, {sess.name.split(" ")[0]}
                    </p>
                    <p style={{color:t.sub,fontSize:12,marginTop:2}}>{new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p>
                  </div>
                </div>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                {isAdmin&&<button onClick={()=>{setDsh("add");setDf(blkD());}}
                  style={{background:t.accent,color:t.accentFg,border:"none",borderRadius:14,padding:"10px 18px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6,boxShadow:`0 2px 8px ${t.accent}55`}}>
                  <span style={{fontSize:15}}>＋</span> New Order
                </button>}
              </div>
            </div>

            {/* ── MORNING BRIEFING ── */}
            {can("dash_seeBriefing")&&(briefingPinned||(!briefingDismissed||(briefingDismissed!==todayStr)))&&(()=>{
              const data={pendingCount:todayPend.length+todayTransit.length,todayRev,lowStockCount:lowStockItems.length,overdueCount:overdueD.length,churnCount:churnedCustomers.length,noticeCount:(notices||[]).filter(n=>!(n.readBy||[]).includes(sess.id)).length,churnDays};
              return <MorningBriefing dm={dm} onDismiss={()=>setBriefingDismissed(todayStr)} onUnpin={()=>setBriefingPinned(p=>!p)} pinned={briefingPinned} data={data}/>;
            })()}

            {/* ── TODAY AT A GLANCE — delivery status card ── */}
            <div style={card({padding:"18px 20px"})}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                <div>
                  <p style={sectionLabel}>📦 Today's Deliveries</p>
                  <div style={{display:"flex",alignItems:"baseline",gap:10}}>
                    <p style={{...bigNum(t.text),fontSize:32}}>{todayDelivs.length}</p>
                    <p style={{color:t.sub,fontSize:13}}>orders today</p>
                  </div>
                </div>
                <button onClick={()=>setTab("Deliveries")}
                  style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:12,padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                  View all →
                </button>
              </div>

              {todayDelivs.length > 0 ? (()=>{
                const total = todayDelivs.length;
                const segments = [
                  {label:"Delivered", val:todayDone.length,    color:"#10b981", bg: dm?"#10b98118":"#f0fdf4"},
                  {label:"In Transit",val:todayTransit.length, color:"#3b82f6", bg: dm?"#3b82f618":"#eff6ff"},
                  {label:"Pending",   val:todayPend.length,    color:"#f59e0b", bg: dm?"#f59e0b18":"#fffbeb"},
                  {label:"Cancelled", val:todayCancl.length,   color:"#ef4444", bg: dm?"#ef444418":"#fef2f2"},
                ];
                return <>
                  {/* Segmented progress bar */}
                  <div style={{height:10,borderRadius:10,overflow:"hidden",display:"flex",gap:2,marginBottom:14,background:t.border}}>
                    {segments.map(s => s.val > 0 &&
                      <div key={s.label} style={{width:`${Math.round(s.val/total*100)}%`,background:s.color,transition:"width 0.7s ease",borderRadius:10}}/>
                    )}
                  </div>
                  {/* Status tiles */}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                    {segments.map(({label,val,color,bg})=>(
                      <div key={label} style={{background:bg,borderRadius:14,padding:"10px 8px",textAlign:"center",border:`1px solid ${color}22`}}>
                        <p style={{color,fontWeight:900,fontSize:22,lineHeight:1}}>{val}</p>
                        <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em",marginTop:4,lineHeight:1.3}}>{label}</p>
                      </div>
                    ))}
                  </div>
                </>;
              })() : (
                <div style={{background:t.inp,borderRadius:14,padding:"20px",textAlign:"center"}}>
                  <p style={{fontSize:28,marginBottom:6}}>🗓️</p>
                  <p style={{color:t.sub,fontSize:13}}>No deliveries scheduled for today</p>
                </div>
              )}
            </div>

            {/* ── REVENUE STATS — Today / Week / Month ── */}
            {canSeeFinancials&&<div style={card({padding:"18px 20px"})}>
              <p style={sectionLabel}>💰 Revenue</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:0,marginBottom:16}}>
                {[
                  {label:"Today",     val:todayRev,  sub:`${todayDone.length} orders`,   color:"#10b981", borderR:true},
                  {label:"This Week", val:weekRev,   sub:`${weekDelivs.length} orders`,  color:"#3b82f6", borderR:true},
                  {label:"This Month",val:monthRev,  sub:`${monthDelivs.length} orders`, color:"#8b5cf6", borderR:false},
                ].map(({label,val,sub,color,borderR})=>(
                  <div key={label} style={{textAlign:"center",paddingBottom:4,borderRight:borderR?`1px solid ${t.border}`:"none"}}>
                    <p style={{color,fontWeight:900,fontSize:22,lineHeight:1,letterSpacing:"-0.02em"}}>{inr(val)}</p>
                    <p style={{color:t.text,fontSize:11,fontWeight:700,marginTop:4}}>{label}</p>
                    <p style={{color:t.sub,fontSize:10,marginTop:1}}>{sub}</p>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={chartData} margin={{top:0,right:0,left:-28,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false}/>
                  <XAxis dataKey="date" tick={{fontSize:9,fill:t.sub}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:9,fill:t.sub}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,color:t.text,fontSize:11}} formatter={(v)=>inr(v)}/>
                  <Bar dataKey="Revenue" fill="#10b981" radius={[4,4,0,0]}/>
                  <Bar dataKey="Expenses" fill="#ef4444" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
              <div style={{display:"flex",gap:16,justifyContent:"center",marginTop:6}}>
                {[{c:"#10b981",l:"Revenue"},{c:"#ef4444",l:"Expenses"}].map(({c,l})=>(
                  <span key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:t.sub}}>
                    <span style={{width:8,height:8,borderRadius:2,background:c,display:"inline-block"}}/>{l}
                  </span>
                ))}
              </div>
            </div>}

            {/* ── OUTSTANDING PAYMENTS ── */}
            {canSeeFinancials&&allDue.length>0&&(()=>{
              const totalBilled = customers.reduce((s,c)=>(s+(c.paid||0)+(c.pending||0)),0);
              const collPct = totalBilled>0?Math.round(customers.reduce((s,c)=>s+(c.paid||0),0)/totalBilled*100):100;
              return <div style={{...card(), border:`1.5px solid ${dm?"rgba(239,68,68,0.35)":"rgba(239,68,68,0.2)"}`, padding:"18px 20px"}}>
                {/* Header */}
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
                  <div>
                    <p style={sectionLabel}>💳 Outstanding Payments</p>
                    <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                      <p style={{color:"#ef4444",fontWeight:900,fontSize:26,lineHeight:1,letterSpacing:"-0.02em"}}>{inr(totalDueAmt)}</p>
                      <p style={{color:t.sub,fontSize:12}}>from {allDue.length} customer{allDue.length!==1?"s":""}</p>
                    </div>
                  </div>
                  {isAdmin&&<button onClick={()=>setTab("Payments")}
                    style={{background:"#ef444412",color:"#ef4444",border:"1px solid #ef444430",borderRadius:12,padding:"7px 14px",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0}}>
                    Full Ledger →
                  </button>}
                </div>

                {/* Collection rate bar */}
                <div style={{marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:t.sub,marginBottom:5}}>
                    <span style={{fontWeight:600}}>Collection Rate</span>
                    <span style={{fontWeight:800,color:collPct>=90?"#10b981":collPct>=70?"#f59e0b":"#ef4444"}}>{collPct}%</span>
                  </div>
                  <div style={{height:7,borderRadius:8,overflow:"hidden",background:t.border}}>
                    <div style={{width:`${collPct}%`,background:collPct>=90?"#10b981":collPct>=70?"#f59e0b":"#ef4444",transition:"width 0.7s",height:"100%",borderRadius:8}}/>
                  </div>
                </div>

                {/* Debtor rows */}
                <div style={{display:"flex",flexDirection:"column",gap:0}}>
                  {allDue.sort((a,b)=>b.pending-a.pending).slice(0,5).map((c,i,arr)=>{
                    const billed=(c.paid||0)+(c.pending||0);
                    const pct=billed>0?Math.round((c.paid||0)/billed*100):0;
                    const isLast = i >= Math.min(allDue.length,5)-1;
                    return <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:!isLast?`1px solid ${t.border}`:"none"}}>
                      {/* Rank badge */}
                      <div style={{width:26,height:26,borderRadius:8,background:i===0?"#ef444418":t.inp,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <span style={{color:i===0?"#ef4444":t.sub,fontWeight:800,fontSize:12}}>{i+1}</span>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                          <p style={{color:t.text,fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{c.name}</p>
                          <p style={{color:"#ef4444",fontWeight:800,fontSize:13,flexShrink:0,marginLeft:10}}>{inr(c.pending)}</p>
                        </div>
                        <div style={{height:4,borderRadius:4,overflow:"hidden",background:t.border}}>
                          <div style={{width:`${pct}%`,background:"#10b981",height:"100%",transition:"width 0.5s"}}/>
                        </div>
                      </div>
                      {can("cust_markPaid")&&<button
                        onClick={()=>{if(isAdmin){setPayLedgerCust(c);setPayLedgerAmt(String(c.pending||""));setPayLedgerNote("");setPayLedgerMethod("Cash");setPayLedgerSh(true);}else{setPaySh(c);setPayAmt("");}}}
                        style={{background:"#f59e0b",color:"#000",border:"none",borderRadius:10,padding:"7px 13px",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0}}>
                        Collect
                      </button>}
                    </div>;
                  })}
                </div>
                {allDue.length>5&&<p style={{color:t.sub,fontSize:11,textAlign:"center",paddingTop:8,fontWeight:600}}>+{allDue.length-5} more customers with outstanding dues</p>}
              </div>;
            })()}

            {/* ── TODAY'S DELIVERY LIST (pending/transit) ── */}
            {(todayPend.length>0||todayTransit.length>0)&&<div style={card({overflow:"hidden"})}>
              <div style={{padding:"14px 20px 12px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <p style={sectionLabel}>🚚 Needs Action Today</p>
                  <p style={{color:t.text,fontWeight:700,fontSize:15}}>
                    {todayPend.length+todayTransit.length} order{todayPend.length+todayTransit.length!==1?"s":""} pending
                  </p>
                </div>
                <button onClick={()=>setTab("Deliveries")}
                  style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:10,padding:"6px 13px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                  All →
                </button>
              </div>
              {[...todayTransit,...todayPend].slice(0,8).map((d,i,arr)=>{
                const tot=lineTotal(d.orderLines);
                const items=Object.values(safeO(d.orderLines)).filter(l=>l.qty>0);
                const isTransit=d.status==="In Transit";
                return <div key={d.id} style={{
                  padding:"12px 20px",
                  borderBottom:i<arr.length-1?`1px solid ${t.border}`:"none",
                  display:"flex",alignItems:"center",gap:12,
                  background:isTransit?(dm?"rgba(59,130,246,0.04)":"rgba(59,130,246,0.02)"):"transparent"
                }}>
                  <div style={{width:38,height:38,borderRadius:12,background:isTransit?"#3b82f615":"#f59e0b15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                    {isTransit?"🚚":"⏳"}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                      <p style={{color:t.text,fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.customer}</p>
                      {isTransit&&<span style={{background:"#3b82f615",color:"#3b82f6",borderRadius:5,padding:"1px 6px",fontSize:9,fontWeight:700,flexShrink:0}}>EN ROUTE</span>}
                    </div>
                    <p style={{color:t.sub,fontSize:11}}>
                      {items.slice(0,2).map(l=>`${l.qty}×${l.name||""}`).join(", ")}{items.length>2?` +${items.length-2} more`:""}
                      {canSeePrices&&tot>0?<span style={{color:t.text,fontWeight:600}}> · {inr(tot)}</span>:""}
                    </p>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    {d.address&&<a href={mapU(d.address,d.lat,d.lng)} target="_blank" rel="noopener noreferrer"
                      style={{background:"#0ea5e912",color:"#0ea5e9",borderRadius:9,padding:"7px 11px",fontSize:13,fontWeight:700,textDecoration:"none",lineHeight:1}}>📍</a>}
                    {can("deliv_markDone")&&<button onClick={()=>tglD(d)}
                      style={{background:"#10b981",color:"#fff",border:"none",borderRadius:10,padding:"7px 13px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✓ Done</button>}
                  </div>
                </div>;
              })}
              {todayPend.length+todayTransit.length>8&&<div style={{padding:"10px 20px",textAlign:"center",borderTop:`1px solid ${t.border}`,background:t.inp}}>
                <button onClick={()=>setTab("Deliveries")} style={{color:t.accent,background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:700}}>
                  +{todayPend.length+todayTransit.length-8} more — view all →
                </button>
              </div>}
            </div>}

            {/* ── PRODUCTION STATUS ── */}
            {(isAdmin||isFactory)&&(()=>{
              if(todayPT.length===0) return null;
              const byProduct = products.map(p=>{
                const pts=todayPT.filter(x=>x.product===p.name||x.product===p.id);
                const act=pts.reduce((s,x)=>s+(x.actual||0),0);
                const tgt=pts.reduce((s,x)=>s+(x.target||0),0);
                return {name:p.name,actual:act,target:tgt,pct:tgt>0?Math.round(act/tgt*100):null};
              }).filter(x=>x.actual>0||x.target>0);
              const prodColor = prodPct===null?"#6366f1":prodPct>=100?"#10b981":prodPct>=70?"#f59e0b":"#ef4444";
              return <div style={card({padding:"18px 20px"})}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                  <div>
                    <p style={sectionLabel}>🏭 Today's Production</p>
                    <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                      <p style={{color:t.text,fontWeight:900,fontSize:26,lineHeight:1,letterSpacing:"-0.02em"}}>{totalActual.toLocaleString("en-IN")}</p>
                      {totalTarget>0&&<p style={{color:t.sub,fontSize:13}}>/ {totalTarget.toLocaleString("en-IN")} target</p>}
                    </div>
                  </div>
                  {prodPct!==null&&(
                    <div style={{textAlign:"center"}}>
                      <div style={{width:56,height:56,borderRadius:"50%",background:`${prodColor}18`,border:`3px solid ${prodColor}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <p style={{color:prodColor,fontWeight:900,fontSize:14,lineHeight:1}}>{prodPct}%</p>
                      </div>
                      <p style={{color:t.sub,fontSize:9,fontWeight:700,marginTop:4,textTransform:"uppercase"}}>Efficiency</p>
                    </div>
                  )}
                </div>

                {totalTarget>0&&<div style={{height:8,borderRadius:8,overflow:"hidden",background:t.border,marginBottom:14}}>
                  <div style={{width:`${Math.min(prodPct||0,100)}%`,background:prodColor,transition:"width 0.8s ease",height:"100%",borderRadius:8}}/>
                </div>}

                {byProduct.length>0&&<div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:4}}>
                  {byProduct.map(p=>(
                    <div key={p.name} style={{display:"flex",alignItems:"center",gap:10}}>
                      <p style={{color:t.sub,fontSize:12,minWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</p>
                      <div style={{flex:1,height:6,borderRadius:6,overflow:"hidden",background:t.border}}>
                        <div style={{width:`${Math.min(p.pct||0,100)}%`,background:"#6366f1",height:"100%",transition:"width 0.5s"}}/>
                      </div>
                      <p style={{color:t.text,fontSize:12,fontWeight:700,minWidth:56,textAlign:"right"}}>
                        {p.actual}{p.target>0&&<span style={{color:t.sub,fontWeight:400}}>/{p.target}</span>}
                      </p>
                    </div>
                  ))}
                </div>}

                {todayWastage.length>0&&<div style={{marginTop:10,padding:"9px 14px",background:"#f9731610",border:"1px solid #f9731630",borderRadius:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <p style={{color:"#f97316",fontSize:12,fontWeight:700}}>🗑 Wastage today: {todayWastage.length} record{todayWastage.length!==1?"s":""}</p>
                  {can("waste_seeCost")&&todayWasteCost>0&&<p style={{color:"#ef4444",fontSize:12,fontWeight:800}}>{inr(todayWasteCost)}</p>}
                </div>}

                <button onClick={()=>setTab("Production")}
                  style={{marginTop:12,width:"100%",background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:12,padding:"9px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                  View Production Log →
                </button>
              </div>;
            })()}

            {/* ── OVERDUE DELIVERIES ── */}
            {isAdmin&&overdueD.length>0&&<div style={{...card(),border:`1.5px solid rgba(239,68,68,0.3)`,background:dm?"rgba(239,68,68,0.04)":"#fff8f8",padding:"16px 20px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <div>
                  <p style={{...sectionLabel,color:"#ef4444"}}>🔴 Overdue Deliveries</p>
                  <p style={{color:t.text,fontWeight:700,fontSize:15}}>{overdueD.length} order{overdueD.length!==1?"s":""} past due</p>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {overdueD.slice(0,4).map(d=>{
                  const cust=customers.find(c=>c.id===d.customerId);
                  const daysAgo=Math.round((new Date()-new Date(d.date))/86400000);
                  return <div key={d.id} style={{background:dm?"rgba(239,68,68,0.07)":"rgba(239,68,68,0.05)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:14,padding:"11px 14px",display:"flex",alignItems:"center",gap:10}}>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{color:t.text,fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.customer}</p>
                      <p style={{color:"#ef4444",fontSize:11,fontWeight:600,marginTop:2}}>{daysAgo} day{daysAgo!==1?"s":""} overdue · {d.date}</p>
                    </div>
                    <div style={{display:"flex",gap:6,flexShrink:0}}>
                      {cust?.phone&&<a href={`tel:${cust.phone}`} style={{background:"#10b98115",color:"#10b981",borderRadius:9,padding:"6px 11px",fontSize:12,fontWeight:700,textDecoration:"none"}}>📞</a>}
                      {can("deliv_markDone")&&<button onClick={()=>{setDeliv(p=>p.map(x=>x.id===d.id?{...x,status:"Delivered",deliveryDate:today()}:x));addLog("Marked overdue delivered",d.customer);notify(`${d.customer} ✓`);captureGPS("marked_delivered",d.customer);}}
                        style={{background:"#10b98120",color:"#10b981",border:"none",borderRadius:9,padding:"6px 11px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✓ Done</button>}
                    </div>
                  </div>;
                })}
                {overdueD.length>4&&<div style={{textAlign:"center",paddingTop:2}}>
                  <button onClick={()=>setTab("Deliveries")} style={{color:"#f59e0b",background:"none",border:"none",cursor:"pointer",fontWeight:700,fontSize:11}}>
                    +{overdueD.length-4} more →
                  </button>
                </div>}
              </div>
            </div>}

            {/* ── WEATHER ── */}
            {widgets.includes("weather")&&<WeatherWidget dm={dm} lat={settings?.weatherLat||15.4909} lng={settings?.weatherLng||73.8278} locLabel={settings?.weatherLabel||"Goa"}/>}

            {/* ── TODAY'S WASTAGE (standalone) ── */}
            {widgets.includes("wastageToday")&&can("dash_seeWastage")&&todayWastage.length>0&&!(isAdmin||isFactory)&&<div style={card({padding:"14px 18px"})}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <p style={{color:t.text,fontWeight:700,fontSize:13}}>🗑 Today's Wastage</p>
                <span style={{color:"#f97316",fontWeight:800,fontSize:13}}>{todayWastage.reduce((s,w)=>s+(w.qty||0),0)} units</span>
              </div>
              {todayWastage.slice(0,3).map((w,i)=>(
                <div key={w.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderTop:i>0?`1px solid ${t.border}`:"none"}}>
                  <div><p style={{color:t.text,fontSize:12,fontWeight:600}}>{w.product}</p><p style={{color:t.sub,fontSize:11}}>{w.type} · {w.shift}</p></div>
                  <p style={{color:t.text,fontWeight:700,fontSize:12}}>{w.qty} {w.unit}</p>
                </div>
              ))}
            </div>}

            {/* ── QUICK ACTIONS ── */}
            {widgets.includes("quickActions")&&(settings?.quickActions||[]).length>0&&<div>
              <p style={{...sectionLabel,marginBottom:10}}>⚡ Quick Actions</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}} className="crm-quick-grid">
                {[
                  {key:"newDelivery",icon:"🚚",label:"New Delivery",action:()=>{setDsh("add");setDf(blkD());}},
                  {key:"newCustomer",icon:"👤",label:"New Customer",action:()=>{setCsh("add");setCf(blkC());}},
                  {key:"markDone",icon:"✅",label:"Mark Delivered",action:()=>setTab("Deliveries")},
                  {key:"logWastage",icon:"🗑️",label:"Log Wastage",action:()=>{setWSh("add");setWF(blkW());}},
                  {key:"addExpense",icon:"💸",label:"Add Expense",action:()=>{setEsh("add");setEf(blkE());}},
                  {key:"logSupply",icon:"📦",label:"Log Supply",action:()=>{setSsh("add");setSf(blkS());}},
                  {key:"logProduction",icon:"🏭",label:"Log Production",action:()=>setTab("Production")},
                  {key:"qcCheck",icon:"🔬",label:"QC Check",action:()=>setTab("Production")},
                ].filter(q=>(settings?.quickActions||[]).includes(q.key)).map(q=>(
                  <button key={q.key} onClick={q.action}
                    style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"14px 8px",display:"flex",flexDirection:"column",alignItems:"center",gap:7,cursor:"pointer",transition:"all 0.15s"}}
                    className="crm-quick-action">
                    <span style={{fontSize:24}}>{q.icon}</span>
                    <span style={{color:t.text,fontSize:10,fontWeight:700,textAlign:"center",lineHeight:1.3}}>{q.label}</span>
                  </button>
                ))}
              </div>
            </div>}

            {/* ── NOTICE BOARD ── */}
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
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <p style={{color:t.text,fontWeight:700,fontSize:13}}>📌 Notice Board</p>
                    {unreadNotices.length>0&&<Pill dm={dm} c="sky">{unreadNotices.length} new</Pill>}
                  </div>
                  {can("dash_postNotice")&&<Btn dm={dm} size="sm" onClick={()=>{setNbF({title:"",body:"",pinned:false});setNbSh(true);}}>+ Post</Btn>}
                </div>
                {(notices||[]).length===0&&<div style={{background:t.inp,borderRadius:14,padding:"20px",textAlign:"center"}}><p style={{color:t.sub}} className="text-sm">No notices posted yet.</p></div>}
                {[...(notices||[])].sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)).map(n=>{
                  const isRead=(n.readBy||[]).includes(sess.id);
                  return <div key={n.id} style={{background:n.pinned?(dm?"rgba(245,158,11,0.08)":"rgba(245,158,11,0.06)"):t.card,border:`1.5px solid ${n.pinned?"rgba(245,158,11,0.3)":isRead?t.border:"rgba(14,165,233,0.3)"}`,borderRadius:16,padding:"14px 16px",marginBottom:8}}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:6,gap:8}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3,flexWrap:"wrap"}}>
                          {n.pinned&&<span style={{background:"#f59e0b20",color:"#f59e0b",borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:700}}>📌 Pinned</span>}
                          {!isRead&&<span style={{background:"#0ea5e920",color:"#0ea5e9",borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:700}}>New</span>}
                          <p style={{color:t.text,fontWeight:700,fontSize:13}}>{n.title}</p>
                        </div>
                        <p style={{color:t.sub,fontSize:11}}>by {n.postedBy} · {n.postedAt}</p>
                      </div>
                      <div style={{display:"flex",gap:6,flexShrink:0}}>
                        {!isRead&&<button onClick={()=>markRead(n.id)} style={{background:"#0ea5e920",color:"#0ea5e9",border:"none",borderRadius:8,padding:"4px 9px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Mark read</button>}
                        {can("dash_delNotice")&&<button onClick={()=>setNotices(p=>p.filter(x=>x.id!==n.id))} style={{background:t.inp,color:t.sub,border:"none",borderRadius:8,padding:"4px 9px",fontSize:11,fontWeight:600,cursor:"pointer"}}>Delete</button>}
                      </div>
                    </div>
                    <p style={{color:t.text,lineHeight:1.6,fontSize:13}}>{n.body}</p>
                  </div>;
                })}
                <Sheet dm={dm} open={nbSh} onClose={()=>setNbSh(false)} title="Post Notice">
                  <Inp dm={dm} label="Title *" value={nbF.title} onChange={e=>setNbF({...nbF,title:e.target.value})} placeholder="e.g. Holiday schedule update"/>
                  <div>
                    <label style={{color:T(dm).sub}} className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 ml-0.5">Message *</label>
                    <textarea value={nbF.body} onChange={e=>setNbF({...nbF,body:e.target.value})} placeholder="Write your announcement here…" rows={5}
                      style={{width:"100%",background:T(dm).inp,border:`1.5px solid ${T(dm).inpB}`,color:T(dm).text,borderRadius:14,padding:"10px 14px",fontSize:13,outline:"none",resize:"vertical",fontFamily:"system-ui"}}/>
                  </div>
                  <div style={{background:T(dm).inp,borderRadius:14,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div>
                      <p style={{color:T(dm).text,fontSize:14,fontWeight:600}}>Pin this notice</p>
                      <p style={{color:T(dm).sub,fontSize:11}}>Pinned notices appear at the top</p>
                    </div>
                    <Tog dm={dm} on={nbF.pinned} onChange={()=>setNbF(f=>({...f,pinned:!f.pinned}))}/>
                  </div>
                  <Btn dm={dm} onClick={saveNotice} className="w-full">Post Notice</Btn>
                </Sheet>
              </>);
            })()}
            </>;
          })()}
        </>)}

        {/* CUSTOMERS */}
        {tab==="Customers"&&(<>
          {/* OVERDUE PAYMENT ALERT BANNER */}
          {canSeeFinancials&&(()=>{
            const overdueC=customers.filter(c=>c.pending>0&&c.active);
            const totalOverdue=overdueC.reduce((s,c)=>s+(c.pending||0),0);
            const totalReplDeducted=deliveries.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
            const partialCount=deliveries.filter(d=>d.partialPayment?.enabled&&(+(d.partialPayment?.amount)||0)>0&&Math.max(0,lineTotal(d.orderLines)-(+d.replacement?.amount||0))>(+(d.partialPayment?.amount)||0)).length;
            if(!overdueC.length) return null;
            return <div style={{background:dm?"rgba(239,68,68,0.08)":"#fff1f1",border:"1.5px solid rgba(239,68,68,0.3)",borderRadius:16,padding:"14px 18px"}}>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div>
                  <p className="text-[11px] font-bold text-red-500 uppercase tracking-widest mb-0.5">🔴 Overdue Payments</p>
                  <p style={{color:t.text}} className="font-bold text-sm">{overdueC.length} customer{overdueC.length!==1?"s":""} owe a total of <span className="text-red-500">{inr(totalOverdue)}</span></p>
                  {(totalReplDeducted>0||partialCount>0)&&<div className="flex gap-2 flex-wrap mt-1">
                    {totalReplDeducted>0&&<span style={{background:"#f9731615",color:"#f97316",borderRadius:20,padding:"1px 8px",fontSize:9,fontWeight:700}}>🔄 {inr(totalReplDeducted)} already replaced</span>}
                    {partialCount>0&&<span style={{background:"#f59e0b15",color:"#f59e0b",borderRadius:20,padding:"1px 8px",fontSize:9,fontWeight:700}}>⚡ {partialCount} partial payments</span>}
                  </div>}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <label style={{color:t.sub,fontSize:11}}>Over</label>
                  <select value={overdueAlertDays} onChange={e=>setOverdueAlertDays(+e.target.value)}
                    style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,fontSize:12,borderRadius:8,padding:"4px 8px",outline:"none"}}>
                    {[1,3,7,14,30].map(d=><option key={d} value={d}>{d}d</option>)}
                  </select>
                  <label style={{color:t.sub,fontSize:11}}>days</label>
                  {isAdmin&&<button onClick={()=>{setPaymentsSubTab("outstanding");setTab("Payments");}} style={{background:"#3b82f615",color:"#3b82f6",border:"1px solid #3b82f630",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>Full Ledger →</button>}
                  <Btn dm={dm} v="danger" size="sm" onClick={()=>{
                    const cols=[{label:"Customer",key:"name"},{label:"Phone",key:"phone"},{label:"Pending (₹)",key:"pending",num:true},{label:"Status",val:r=>r.pending>0?"UNPAID":"PAID"}];
                    exportTabPDF("Overdue Payments",overdueC.sort((a,b)=>b.pending-a.pending),cols,settings,`<div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:10px;padding:12px 16px;margin-bottom:20px"><b style="color:#b91c1c">Total Outstanding: ${inr(totalOverdue)}</b> across ${overdueC.length} customers</div>`);
                  }}>PDF</Btn>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 mt-1">
                {overdueC.sort((a,b)=>b.pending-a.pending).slice(0,5).map(c=>{
                  const cRepl=deliveries.filter(d=>d.customerId===c.id).reduce((s,d)=>s+(+d.replacement?.amount||0),0);
                  const cPartial=deliveries.filter(d=>d.customerId===c.id&&d.partialPayment?.enabled&&(+(d.partialPayment?.amount)||0)>0&&Math.max(0,lineTotal(d.orderLines)-(+d.replacement?.amount||0))>(+(d.partialPayment?.amount)||0)).length;
                  return <div key={c.id} className="flex items-center justify-between py-1.5 px-3 rounded-xl" style={{background:dm?"rgba(239,68,68,0.06)":"rgba(239,68,68,0.04)",border:"1px solid rgba(239,68,68,0.15)"}}>
                    <div>
                      <span style={{color:t.text,fontWeight:600,fontSize:13}}>{c.name}</span>
                      {c.phone&&<span style={{color:t.sub,fontSize:11,marginLeft:8}}>📞 {c.phone}</span>}
                      {(cRepl>0||cPartial>0)&&<div className="flex gap-1 mt-0.5">
                        {cRepl>0&&<span style={{color:"#f97316",fontSize:9,fontWeight:600}}>🔄 {inr(cRepl)} replaced</span>}
                        {cPartial>0&&<span style={{color:"#f59e0b",fontSize:9,fontWeight:600,marginLeft:4}}>⚡ partial</span>}
                      </div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span style={{color:"#ef4444",fontWeight:800,fontSize:13}}>{inr(c.pending)}</span>
                      <button onClick={()=>{if(isAdmin){setPayLedgerCust(c);setPayLedgerAmt(String(c.pending||""));setPayLedgerNote("");setPayLedgerMethod("Cash");setPayLedgerSh(true);}else{setPaySh(c);setPayAmt("");}}} className="text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{background:"#f59e0b",color:"#000"}}>💰 Collect</button>
                    </div>
                  </div>;
                })}
                {overdueC.length>5&&<p style={{color:t.sub}} className="text-[11px] text-center mt-1">+{overdueC.length-5} more customers with outstanding payments</p>}
              </div>
            </div>;
          })()}

          {/* CLV DASHBOARD — hidden in Old View */}
          {canSeeFinancials&&clvFilter!=="og"&&(()=>{
            const clvData=customers.map(c=>{
              const cDelivs=deliveries.filter(d=>d.customerId===c.id);
              const cDone=cDelivs.filter(d=>d.status==="Delivered");
              const revenue=cDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
              const orderCount=cDelivs.length;
              const avgOrderVal=cDone.length>0?Math.round(revenue/cDone.length):0;
              const lastD=cDelivs.length>0?[...cDelivs].sort((a,b)=>b.date.localeCompare(a.date))[0]:null;
              const daysSinceLast=lastD?Math.floor((new Date()-new Date(lastD.date))/86400000):999;
              const joinDays=c.joinDate?Math.max(1,Math.floor((new Date()-new Date(c.joinDate))/86400000)):90;
              const ordersPerMonth=orderCount>0?(orderCount/(joinDays/30)).toFixed(1):0;
              const clvScore=Math.round(revenue+(avgOrderVal*+ordersPerMonth*3));
              return {c,revenue,orderCount,avgOrderVal,daysSinceLast,ordersPerMonth,clvScore};
            });
            const sorted=[...clvData].sort((a,b)=>{
              if(clvSort==="clv") return b.clvScore-a.clvScore;
              if(clvSort==="orders") return b.orderCount-a.orderCount;
              if(clvSort==="pending") return (b.c.pending||0)-(a.c.pending||0);
              if(clvSort==="days") return a.daysSinceLast-b.daysSinceLast;
              return 0;
            });
            const totalCLV=clvData.reduce((s,x)=>s+x.clvScore,0);
            const avgCLV=clvData.length>0?Math.round(totalCLV/clvData.length):0;
            // clvFilter: "standard" = normal card view, "clv" = CLV detail view
            return <Card dm={dm} className="overflow-hidden">
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <p style={{color:t.text}} className="font-bold text-sm">💰 Customer Value</p>
                    <p style={{color:t.sub}} className="text-[11px]">Projected 3-month lifetime value</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Two-option toggle */}
                    <div style={{background:t.inp,border:`1px solid ${t.border}`,borderRadius:10,padding:3,display:"flex",gap:2}}>
                      {[["og","📋 Old View"],["standard","Standard"],["clv","CLV View"]].map(([val,lbl])=>(
                        <button key={val} onClick={()=>setClvFilterP(val)}
                          style={clvFilter===val
                            ?{background:dm?"#3b82f6":"#1e3a5f",color:"#fff",borderRadius:7,padding:"4px 12px",fontSize:11,fontWeight:700,transition:"all 0.15s"}
                            :{background:"transparent",color:t.sub,borderRadius:7,padding:"4px 12px",fontSize:11,fontWeight:600,transition:"all 0.15s"}
                          }>{lbl}</button>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <Btn dm={dm} v="outline" size="sm" onClick={()=>{
                        const cols=[{label:"Customer",val:x=>x.c.name},{label:"CLV Score (₹)",key:"clvScore",num:true},{label:"Revenue (₹)",key:"revenue",num:true},{label:"Orders",key:"orderCount",num:true},{label:"Avg Order (₹)",key:"avgOrderVal",num:true},{label:"Days Since Last",key:"daysSinceLast",num:true},{label:"Orders/Month",key:"ordersPerMonth"},{label:"Pending (₹)",val:x=>x.c.pending||0,num:true}];
                        exportTabPDF("Customer Value",sorted,cols,settings,`<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:24px"><div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:12px 14px"><div style="font-size:20px;font-weight:900;color:#92400e">${inr(totalCLV)}</div><div style="font-size:9px;text-transform:uppercase;color:#a8a29e;margin-top:3px">Portfolio CLV</div></div><div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:12px 14px"><div style="font-size:20px;font-weight:900;color:#0369a1">${inr(avgCLV)}</div><div style="font-size:9px;text-transform:uppercase;color:#a8a29e;margin-top:3px">Avg per Customer</div></div></div>`);
                      }}>📄</Btn>
                      <Btn dm={dm} v="outline" size="sm" onClick={()=>{
                        const cols=[{label:"Customer",val:x=>x.c.name},{label:"Phone",val:x=>x.c.phone||""},{label:"CLV Score",key:"clvScore",num:true},{label:"Revenue",key:"revenue",num:true},{label:"Orders",key:"orderCount",num:true},{label:"Avg Order",key:"avgOrderVal",num:true},{label:"Days Since Last",key:"daysSinceLast",num:true},{label:"Orders/Mo",key:"ordersPerMonth"},{label:"Pending",val:x=>x.c.pending||0,num:true}];
                        exportTabExcel("Customer Value",sorted,cols,settings);
                      }}>📊</Btn>
                    </div>
                  </div>
                </div>
                {/* Summary strip */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div style={{background:"#fef3c720",border:"1px solid #fde68a40",borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
                    <p className="font-black text-amber-500 text-sm">{inr(totalCLV)}</p>
                    <p style={{color:t.sub}} className="text-[10px] mt-0.5">Portfolio CLV</p>
                  </div>
                  <div style={{background:t.inp,borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
                    <p style={{color:t.text}} className="font-black text-sm">{inr(avgCLV)}</p>
                    <p style={{color:t.sub}} className="text-[10px] mt-0.5">Avg per Customer</p>
                  </div>
                </div>
                {/* Sort (only shown in CLV view) */}
                {clvFilter==="clv"&&<select value={clvSort} onChange={e=>setClvSort(e.target.value)}
                  style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,fontSize:11,borderRadius:8,padding:"5px 10px",outline:"none",width:"100%"}}>
                  <option value="clv">Sort by CLV Score</option>
                  <option value="orders">Sort by Orders</option>
                  <option value="pending">Sort by Pending</option>
                  <option value="days">Sort by Last Active</option>
                </select>}
              </div>
              <Hr dm={dm}/>
              {clvFilter==="standard"
                /* ── STANDARD VIEW: simple ranked list ── */
                ?sorted.map(({c:cust,revenue,orderCount,daysSinceLast},ci)=>(
                  <div key={cust.id} style={{borderBottom:`1px solid ${t.border}`}} className="px-4 py-3 last:border-0 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span style={{color:t.sub,fontWeight:700,fontSize:12,width:20,textAlign:"right",flexShrink:0}}>{ci+1}</span>
                      <div style={{background:t.inp,width:34,height:34,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:13,color:t.text,flexShrink:0}}>{cust.name.charAt(0).toUpperCase()}</div>
                      <div className="min-w-0">
                        <p style={{color:t.text,fontWeight:700,fontSize:13}} className="truncate">{cust.name}</p>
                        <p style={{color:t.sub,fontSize:10}}>{orderCount} orders · {daysSinceLast===999?"no orders yet":daysSinceLast===0?"today":daysSinceLast+"d ago"}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-emerald-500 text-sm leading-none">{inr(revenue)}</p>
                      <p style={{color:t.sub}} className="text-[10px] mt-0.5">revenue</p>
                    </div>
                  </div>
                ))
                /* ── CLV VIEW: full breakdown with score bar ── */
                :sorted.map(({c:cust,revenue,orderCount,avgOrderVal,daysSinceLast,ordersPerMonth,clvScore},ci)=>{
                  const accent=dm?"#3b82f6":"#1e3a5f";
                  const maxScore=Math.max(...sorted.map(x=>x.clvScore),1);
                  return <div key={cust.id} style={{borderBottom:`1px solid ${t.border}`}} className="px-4 py-3 last:border-0">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div style={{background:`${accent}18`,color:accent,width:32,height:32,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:12,flexShrink:0}}>{ci+1}</div>
                        <div className="min-w-0">
                          <p style={{color:t.text,fontWeight:700,fontSize:13}} className="truncate">{cust.name}</p>
                          {cust.phone&&<span style={{color:t.sub,fontSize:10}}>📞 {cust.phone}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p style={{color:accent}} className="font-black text-base leading-none">{inr(clvScore)}</p>
                        <p style={{color:t.sub}} className="text-[10px] mt-0.5">CLV score</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 mb-2">
                      <div style={{background:t.inp,borderRadius:8,padding:"5px 7px",textAlign:"center"}}>
                        <p style={{color:t.text,fontWeight:700,fontSize:11}} className="leading-none">{inr(revenue)}</p>
                        <p style={{color:t.sub,fontSize:9}} className="mt-0.5">Revenue</p>
                      </div>
                      <div style={{background:t.inp,borderRadius:8,padding:"5px 7px",textAlign:"center"}}>
                        <p style={{color:t.text,fontWeight:700,fontSize:11}} className="leading-none">{orderCount}</p>
                        <p style={{color:t.sub,fontSize:9}} className="mt-0.5">Orders</p>
                      </div>
                      <div style={{background:t.inp,borderRadius:8,padding:"5px 7px",textAlign:"center"}}>
                        <p style={{color:t.text,fontWeight:700,fontSize:11}} className="leading-none">{inr(avgOrderVal)}</p>
                        <p style={{color:t.sub,fontSize:9}} className="mt-0.5">Avg Order</p>
                      </div>
                      <div style={{background:daysSinceLast>14?"#ef444415":t.inp,borderRadius:8,padding:"5px 7px",textAlign:"center"}}>
                        <p style={{color:daysSinceLast>14?"#ef4444":t.text,fontWeight:700,fontSize:11}} className="leading-none">{daysSinceLast===999?"—":daysSinceLast+"d"}</p>
                        <p style={{color:t.sub,fontSize:9}} className="mt-0.5">Last Order</p>
                      </div>
                    </div>
                    <div style={{background:t.border,height:4,borderRadius:4,overflow:"hidden"}}>
                      <div style={{width:`${Math.round(clvScore/maxScore*100)}%`,background:`linear-gradient(90deg,${accent},${accent}88)`,height:"100%",borderRadius:4,transition:"width 0.6s ease"}}/>
                    </div>
                  </div>;
                })
              }
            </Card>;
          })()}

          {/* Summary bar — 4-up on desktop */}
          {canSeeFinancials&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12}}>
            <StatCard dm={dm} label="Active Customers" value={activeC.length} sub={`${customers.filter(c=>!c.active).length} inactive`} accent="#d97706"/>
            <StatCard dm={dm} label="Total Collected" value={inr(customers.reduce((s,c)=>s+(c.paid||0),0))} sub="All time" accent="#10b981"/>
            <StatCard dm={dm} label="Outstanding" value={inr(customers.reduce((s,c)=>s+(c.pending||0),0))} sub={`${customers.filter(c=>c.pending>0).length} unpaid`} accent="#ef4444"/>
            <StatCard dm={dm} label="Total Customers" value={customers.length} sub={`${activeC.length} active`} accent="#8b5cf6"/>
          </div>}
          {/* ── UNIFIED TOOLBAR ── */}
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <div style={{flex:"1 1 220px",minWidth:0}}>
              <Search dm={dm} value={srch} onChange={setSrch} placeholder="Search name, phone, address…" style={{width:"100%"}}/>
            </div>
            <select value={custSortField} onChange={e=>setCustSortField(e.target.value)}
              style={{background:t.inp,color:t.text,border:`1.5px solid ${t.border}`,borderRadius:10,padding:"8px 10px",fontSize:12,fontWeight:600,outline:"none",cursor:"pointer",flexShrink:0,minWidth:130}}>
              <option value="name">Name A–Z</option>
              <option value="lastOrder">Last Order</option>
              <option value="pending">Most Owing</option>
              <option value="orders">Most Orders</option>
              <option value="revenue">Revenue ↓</option>
            </select>
            <div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"wrap"}}>
            <div className="flex gap-2 flex-wrap">
              {can("cust_export")&&<Btn dm={dm} v="outline" size="sm" onClick={()=>{
                const enriched=customers.map(c=>{
                  const cDelivs=deliveries.filter(d=>d.customerId===c.id);
                  const cDone=cDelivs.filter(d=>d.status==="Delivered");
                  const cPending=cDelivs.filter(d=>d.status==="Pending"||d.status==="In Transit");
                  const cReturns=cDelivs.filter(d=>d.status==="Cancelled").length;
                  const cRepl=cDelivs.filter(d=>d.replacement?.done).length;
                  const cReplAmt=cDelivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
                  const netTotal=Math.max(0,lineTotal(c.orderLines)-cReplAmt);
                  const cRev=cDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
                  const avgOrd=cDelivs.length>0?Math.round(cRev/cDelivs.length):0;
                  const lastD=[...cDelivs].sort((a,b)=>b.date.localeCompare(a.date))[0];
                  const lastDays=lastD?Math.floor((new Date()-new Date(lastD.date))/86400000):null;
                  const createdByList=[...new Set(cDelivs.map(d=>d.createdBy).filter(Boolean))].join(", ")||"—";
                  return {...c,_orders:cDelivs.length,_delivered:cDone.length,_pending:cPending.length,_returns:cReturns,_replacements:cRepl,_replAmt:cReplAmt,_netTotal:netTotal,_revenue:cRev,_avgOrd:avgOrd,_lastDate:lastD?.date||"",_lastDays:lastDays,_cDelivs:cDelivs,_createdBy:createdByList};
                });
                const totalColl=customers.reduce((s,c)=>s+(c.paid||0),0);
                const totalOut=customers.reduce((s,c)=>s+(c.pending||0),0);
                const totalReplAll=enriched.reduce((s,c)=>s+c._replAmt,0);
                // Build per-customer delivery breakdown HTML
                const custBreakdownHtml=enriched.map(c=>{
                  if(!c._cDelivs||c._cDelivs.length===0)return "";
                  const sorted=[...c._cDelivs].sort((a,b)=>b.date.localeCompare(a.date));
                  return `<div style="margin-top:28px;page-break-inside:avoid">
  <div style="background:#f1f5f9;border-left:4px solid #f59e0b;padding:8px 14px;border-radius:4px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
    <span style="font-weight:800;font-size:13px">${c.name}</span>
    <span style="font-size:11px;color:#64748b">${c._orders} orders &nbsp;·&nbsp; Paid: ₹${(c.paid||0).toLocaleString("en-IN")} &nbsp;·&nbsp; Due: <span style="color:${c.pending>0?"#dc2626":"#059669"};font-weight:700">₹${(c.pending||0).toLocaleString("en-IN")}</span></span>
  </div>
  <table><thead><tr>
    <th>Invoice No</th><th>Receipt No</th><th>Date</th><th>Status</th><th>Items</th><th class="r">Order Total</th><th class="r">Repl Deducted</th><th class="r">Net Amount</th><th class="r">Paid</th><th class="r">Remaining</th><th>Agent</th>
  </tr></thead><tbody>
  ${sorted.map((d,i)=>{
    const tot=lineTotal(d.orderLines);
    const repl=+d.replacement?.amount||0;
    const net=tot-repl;
    const dpaid=d.paid||0;
    const rem=net-dpaid;
    const items=Object.entries(safeO(d.orderLines)).filter(([,l])=>l.qty>0).map(([pid,l])=>{const p=products.find(x=>x.id===pid);return`${l.qty}×${p?p.name:(l.name||pid)}`;}).join(", ")||"—";
    const sc=d.status==="Delivered"?"#059669":d.status==="In Transit"?"#2563eb":"#d97706";
    const dInvNo=d.invNo||`INV-${(d.date||"").replace(/-/g,"")}-${(d.id||"").slice(-4).toUpperCase()}`;
    const dRcptNo=`RCP-${dInvNo.replace(/^[A-Z]+-/,"")}`;
    return`<tr style="background:${i%2===0?"#fff":"#f8fafc"}">
      <td style="white-space:nowrap;font-family:monospace;font-size:10px;color:#7c3aed;font-weight:700">${dInvNo}</td>
      <td style="white-space:nowrap;font-family:monospace;font-size:10px;color:#0ea5e9;font-weight:700">${dRcptNo}</td>
      <td style="white-space:nowrap">${d.date}</td>
      <td><span style="background:${sc}18;color:${sc};padding:2px 7px;border-radius:20px;font-size:10px;font-weight:700">${d.status}</span></td>
      <td style="font-size:11px;color:#475569">${items}${d.replacement?.done?` <span style="color:#f97316;font-weight:600">[🔄 ${d.replacement.item||"repl"}]</span>`:""}</td>
      <td class="r" style="font-weight:700">₹${tot.toLocaleString("en-IN")}</td>
      <td class="r" style="color:#f97316">${repl>0?"−₹"+repl.toLocaleString("en-IN"):"—"}</td>
      <td class="r" style="font-weight:700">₹${net.toLocaleString("en-IN")}</td>
      <td class="r" style="color:#059669">₹${dpaid.toLocaleString("en-IN")}</td>
      <td class="r" style="color:${rem>0?"#dc2626":"#059669"};font-weight:700">₹${rem.toLocaleString("en-IN")}</td>
      <td style="font-size:11px;color:#64748b">${d.createdBy||"—"}</td>
    </tr>`;
  }).join("")}
  </tbody></table></div>`;
                }).filter(Boolean).join("");
                exportTabPDF("Customers",enriched,[
                  {label:"Name",key:"name"},
                  {label:"Phone",key:"phone"},
                  {label:"Address",key:"address"},
                  {label:"Orders",key:"_orders",num:true},
                  {label:"Delivered",key:"_delivered",num:true},
                  {label:"Pending",key:"_pending",num:true},
                  {label:"Returns",key:"_returns",num:true},
                  {label:"Replacements",key:"_replacements",num:true},
                  {label:"Repl. Deducted (₹)",key:"_replAmt",num:true},
                  {label:"Revenue (₹)",key:"_revenue",num:true},
                  {label:"Avg Order (₹)",key:"_avgOrd",num:true},
                  {label:"Partial Paid (₹)",val:r=>r.partialPay||0,num:true},
                  {label:"Paid (₹)",key:"paid",num:true},
                  {label:"Pending (₹)",key:"pending",num:true},
                  {label:"Last Order",key:"_lastDate"},
                  {label:"Agent / Created By",key:"_createdBy"},
                  {label:"Status",val:r=>r.pending>0?`<span class="badge badge-r">UNPAID</span>`:`<span class="badge badge-g">PAID</span>`},
                  {label:"Since",key:"joinDate"}
                ],settings,`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
  <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 14px"><div style="font-size:20px;font-weight:900;color:#92400e">${activeC.length}</div><div style="font-size:9px;text-transform:uppercase;color:#a8a29e;margin-top:3px">Active Customers</div></div>
  <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:10px;padding:12px 14px"><div style="font-size:20px;font-weight:900;color:#059669">₹${totalColl.toLocaleString("en-IN")}</div><div style="font-size:9px;text-transform:uppercase;color:#a8a29e;margin-top:3px">Total Collected</div></div>
  <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:12px 14px"><div style="font-size:20px;font-weight:900;color:#b91c1c">₹${totalOut.toLocaleString("en-IN")}</div><div style="font-size:9px;text-transform:uppercase;color:#a8a29e;margin-top:3px">Outstanding</div></div>
  <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px 14px"><div style="font-size:20px;font-weight:900;color:#ea580c">₹${totalReplAll.toLocaleString("en-IN")}</div><div style="font-size:9px;text-transform:uppercase;color:#a8a29e;margin-top:3px">Total Replacements</div></div>
</div>
<div style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;margin:28px 0 8px;padding-bottom:6px;border-bottom:2px solid #e2e8f0">Customer Summary Table</div>
${custBreakdownHtml.length>0?`<div style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;margin:36px 0 8px;padding-bottom:6px;border-bottom:2px solid #e2e8f0">Per-Customer Delivery Breakdown</div>${custBreakdownHtml}`:""}
`);
              }}>📄 PDF</Btn>}
              {can("cust_export")&&<Btn dm={dm} v="outline" size="sm" onClick={()=>{
                const enriched=customers.map(c=>{
                  const cDelivs=deliveries.filter(d=>d.customerId===c.id);
                  const cDone=cDelivs.filter(d=>d.status==="Delivered");
                  const cPending=cDelivs.filter(d=>d.status==="Pending"||d.status==="In Transit");
                  const cReturns=cDelivs.filter(d=>d.status==="Cancelled").length;
                  const cRepl=cDelivs.filter(d=>d.replacement?.done).length;
                  const cReplAmt=cDelivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
                  const netTotal=Math.max(0,lineTotal(c.orderLines)-cReplAmt);
                  const cRev=cDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
                  const avgOrd=cDelivs.length>0?Math.round(cRev/cDelivs.length):0;
                  const lastD=[...cDelivs].sort((a,b)=>b.date.localeCompare(a.date))[0];
                  return {...c,_orders:cDelivs.length,_delivered:cDone.length,_pending:cPending.length,_returns:cReturns,_replacements:cRepl,_replAmt:cReplAmt,_netTotal:netTotal,_revenue:cRev,_avgOrd:avgOrd,_lastDate:lastD?.date||""};
                });
                exportTabExcel("Customers",enriched,[
                  {label:"Name",key:"name"},
                  {label:"Phone",key:"phone"},
                  {label:"Address",key:"address"},
                  {label:"Join Date",key:"joinDate"},
                  {label:"Active",val:r=>r.active?"Yes":"No"},
                  {label:"# Orders",key:"_orders",num:true},
                  {label:"# Delivered",key:"_delivered",num:true},
                  {label:"# Pending/Transit",key:"_pending",num:true},
                  {label:"# Returns",key:"_returns",num:true},
                  {label:"# Replacements",key:"_replacements",num:true},
                  {label:"Repl. Deducted (₹)",key:"_replAmt",num:true},
                  {label:"Revenue (₹)",key:"_revenue",num:true},
                  {label:"Avg Order (₹)",key:"_avgOrd",num:true},
                  {label:"Partial Paid (₹)",val:r=>r.partialPay||0,num:true},
                  {label:"Paid (₹)",key:"paid",num:true},
                  {label:"Pending (₹)",key:"pending",num:true},
                  {label:"Net Total (₹)",key:"_netTotal",num:true},
                  {label:"Last Order Date",key:"_lastDate"},
                  {label:"Agent / Created By",key:"_createdBy"},
                  {label:"Status",val:r=>r.pending>0?"UNPAID":"PAID"},
                  {label:"Notes",key:"notes"}
                ],settings);
              }}>📊 XLS</Btn>}
              {can("cust_export")&&<Btn dm={dm} v="outline" size="sm" onClick={()=>{
                const enriched=customers.map(c=>{
                  const cDelivs=deliveries.filter(d=>d.customerId===c.id);
                  const cDone=cDelivs.filter(d=>d.status==="Delivered");
                  const cPending=cDelivs.filter(d=>d.status==="Pending"||d.status==="In Transit");
                  const cReturns=cDelivs.filter(d=>d.status==="Cancelled").length;
                  const cRepl=cDelivs.filter(d=>d.replacement?.done).length;
                  const cReplAmt=cDelivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
                  const netTotal=Math.max(0,lineTotal(c.orderLines)-cReplAmt);
                  const cRev=cDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
                  const avgOrd=cDelivs.length>0?Math.round(cRev/cDelivs.length):0;
                  const lastD=[...cDelivs].sort((a,b)=>b.date.localeCompare(a.date))[0];
                  const createdByList=[...new Set(cDelivs.map(d=>d.createdBy).filter(Boolean))].join(", ")||"—";
                  return {...c,_orders:cDelivs.length,_delivered:cDone.length,_pending:cPending.length,_returns:cReturns,_replacements:cRepl,_replAmt:cReplAmt,_netTotal:netTotal,_revenue:cRev,_avgOrd:avgOrd,_lastDate:lastD?.date||"",_createdBy:createdByList};
                });
                exportCSV(enriched,"customers",[
                  {label:"Name",key:"name"},
                  {label:"Phone",key:"phone"},
                  {label:"Address",key:"address"},
                  {label:"Join Date",key:"joinDate"},
                  {label:"Active",val:r=>r.active?"Yes":"No"},
                  {label:"# Orders",key:"_orders"},
                  {label:"# Delivered",key:"_delivered"},
                  {label:"# Pending/Transit",key:"_pending"},
                  {label:"# Returns",key:"_returns"},
                  {label:"# Replacements",key:"_replacements"},
                  {label:"Repl. Deducted (₹)",key:"_replAmt"},
                  {label:"Revenue (₹)",key:"_revenue"},
                  {label:"Avg Order (₹)",key:"_avgOrd"},
                  {label:"Partial Paid (₹)",val:r=>r.partialPay||0},
                  {label:"Paid (₹)",key:"paid"},
                  {label:"Pending (₹)",key:"pending"},
                  {label:"Net Total (₹)",key:"_netTotal"},
                  {label:"Last Order Date",key:"_lastDate"},
                  {label:"Agent / Created By",key:"_createdBy"},
                  {label:"Status",val:r=>r.pending>0?"UNPAID":"PAID"},
                  {label:"Notes",key:"notes"}
                ]);
              }}>CSV</Btn>}
              <Btn dm={dm} size="sm" onClick={()=>{setCf(blkC());setCsh("add");}}>+ Customer</Btn>
            </div>
            </div>
          </div>
          {/* ── STATUS FILTER PILLS ── */}
          <div className="flex gap-2 overflow-x-auto pb-1" style={{WebkitOverflowScrolling:"touch",scrollbarWidth:"none",msOverflowStyle:"none"}}>
            {[
              {key:"all",    label:`All (${fCust.length})`,         accent:"#6b7280"},
              {key:"active", label:`Active (${fCust.filter(c=>c.active).length})`,   accent:"#10b981"},
              {key:"inactive",label:`Inactive (${fCust.filter(c=>!c.active).length})`,accent:"#6b7280"},
              {key:"owing",  label:`Owing (${fCust.filter(c=>(c.pending||0)>0).length})`, accent:"#ef4444"},
              {key:"clear",  label:`Paid Up (${fCust.filter(c=>!(c.pending||0)).length})`, accent:"#10b981"},
            ].map(({key,label,accent})=>{
              const active=custStatusFilter===key;
              return <button key={key} onClick={()=>setCustStatusFilter(key)}
                style={{flexShrink:0,background:active?`${accent}18`:t.inp,color:active?accent:t.sub,border:`1.5px solid ${active?accent:t.border}`,borderRadius:99,padding:"5px 13px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",transition:"all 0.15s",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>
                {label}
              </button>;
            })}
          </div>

          {clvFilter==="og"&&(()=>{
            // Apply sort + filter on top of existing fCust search filter
            let displayCust=[...fCust];
            if(custStatusFilter==="active") displayCust=displayCust.filter(c=>c.active);
            else if(custStatusFilter==="inactive") displayCust=displayCust.filter(c=>!c.active);
            else if(custStatusFilter==="owing") displayCust=displayCust.filter(c=>(c.pending||0)>0);
            else if(custStatusFilter==="clear") displayCust=displayCust.filter(c=>!(c.pending||0)>0);
            displayCust=displayCust.map(c=>{
              const cDelivs=deliveries.filter(d=>d.customerId===c.id);
              const cDone=cDelivs.filter(d=>d.status==="Delivered");
              const lastDeliv=cDelivs.length>0?[...cDelivs].sort((a,b)=>b.date.localeCompare(a.date))[0]:null;
              const cRev=cDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
              return {...c,_cDelivs:cDelivs,_cDone:cDone,_lastDeliv:lastDeliv,_cRev:cRev};
            });
            if(custSortField==="name") displayCust.sort((a,b)=>a.name.localeCompare(b.name));
            else if(custSortField==="lastOrder") displayCust.sort((a,b)=>(b._lastDeliv?.date||"").localeCompare(a._lastDeliv?.date||""));
            else if(custSortField==="pending") displayCust.sort((a,b)=>(b.pending||0)-(a.pending||0));
            else if(custSortField==="orders") displayCust.sort((a,b)=>b._cDelivs.length-a._cDelivs.length);
            else if(custSortField==="revenue") displayCust.sort((a,b)=>b._cRev-a._cRev);

            return <>
            {displayCust.length>0&&<p style={{color:t.sub,fontSize:11,fontWeight:600,paddingLeft:2}}>{displayCust.length} customer{displayCust.length!==1?"s":""}</p>}
            {displayCust.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-8">No customers found.</p>}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,520px),1fr))",gap:14,alignItems:"start"}}>
            {displayCust.map(c=>{
              const cDelivs=c._cDelivs;
              const cDone=c._cDone;
              const lastDeliv=c._lastDeliv;
              const rows=lineRows(c.orderLines,products);
              const tot=lineTotal(c.orderLines);
              const cReturns=cDelivs.filter(d=>d.status==="Cancelled").length;
              const cReplacements=cDelivs.filter(d=>d.replacement?.done).length;
              const cReplAmt=cDelivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
              const partialPaid=c.partialPay||0;
              const netTot=Math.max(0,tot-cReplAmt);
              const totalBilled=(c.paid||0)+(c.pending||0);
              const payPct=totalBilled>0?Math.round((c.paid||0)/totalBilled*100):100;
              const lastDiffDays=lastDeliv?Math.floor((new Date()-new Date(lastDeliv.date))/(1000*60*60*24)):null;
              const lastLabel=lastDiffDays===null?"Never":lastDiffDays===0?"Today":lastDiffDays===1?"Yesterday":`${lastDiffDays}d ago`;
              const lastCol=lastDiffDays===null?"#6b7280":lastDiffDays>14?"#ef4444":lastDiffDays>7?"#f59e0b":"#10b981";
              const delivRate=cDelivs.length>0?Math.round(cDone.length/cDelivs.length*100):100;
              const isExpanded=expandedCustCard===c.id;

              return (
                <div key={c.id} style={{background:t.card,border:`1.5px solid ${isExpanded?(dm?"#f59e0b":"#f59e0b"):t.border}`,borderRadius:16,overflow:"hidden",boxShadow:dm?"none":isExpanded?"0 6px 24px rgba(245,158,11,0.13)":"0 1px 8px rgba(0,0,0,0.06)",transition:"border-color 0.15s,box-shadow 0.2s"}}>

                  {/* ── TOP STRIPE ── */}
                  <div style={{height:3,background:c.active?(c.pending>0?"linear-gradient(90deg,#10b981,#f59e0b)":"#10b981"):"#6b7280"}}/>

                  {/* ── COLLAPSED HEADER ── */}
                  <div onClick={()=>setExpandedCustCard(isExpanded?null:c.id)}
                    style={{padding:"14px 18px",cursor:"pointer",userSelect:"none",display:"flex",alignItems:"center",gap:14}}>
                    {/* Avatar with recency dot */}
                    <div style={{position:"relative",flexShrink:0}}>
                      <div style={{width:46,height:46,borderRadius:14,background:c.active?"#f59e0b22":"#6b728018",color:c.active?"#f59e0b":t.sub,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:18,letterSpacing:-1}}>
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{position:"absolute",bottom:1,right:1,width:10,height:10,borderRadius:"50%",background:lastCol,border:`2px solid ${t.card}`}}/>
                    </div>
                    {/* Name + meta */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                        <p style={{color:t.text,fontWeight:800,fontSize:14,lineHeight:1.2}}>{c.name}</p>
                        <span style={{background:c.active?(dm?"#10b98122":"#dcfce7"):(dm?"#ffffff10":"#f3f4f6"),color:c.active?"#15803d":"#6b7280",fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:99,letterSpacing:"0.04em"}}>{c.active?"● ACTIVE":"○ INACTIVE"}</span>
                        {c.pending>0&&<span style={{background:dm?"#ef444420":"#fef2f2",color:"#dc2626",fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:99}}>Due {inr(c.pending)}</span>}
                        {!c.pending&&totalBilled>0&&<span style={{background:dm?"#10b98120":"#f0fdf4",color:"#16a34a",fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:99}}>✓ Clear</span>}
                      </div>
                      <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                        {c.phone&&<span style={{color:t.sub,fontSize:11}}>📞 {c.phone}</span>}
                        <span style={{color:lastCol,fontSize:11,fontWeight:600}}>🕐 {lastLabel}</span>
                        <span style={{color:t.sub,fontSize:11}}>{cDelivs.length} order{cDelivs.length!==1?"s":""}</span>
                        {c.address&&<span style={{color:t.sub,fontSize:11,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>📍 {c.address}</span>}
                      </div>
                    </div>
                    {/* Right: financials + chevron */}
                    <div style={{display:"flex",alignItems:"center",gap:16,flexShrink:0}}>
                      {canSeePrices&&<div style={{textAlign:"right"}}>
                        <p style={{color:"#10b981",fontWeight:900,fontSize:14,lineHeight:1}}>{inr(c.paid||0)}</p>
                        <p style={{color:t.sub,fontSize:9,marginTop:2}}>collected</p>
                      </div>}
                      {canSeeFinancials&&c.pending>0&&<div style={{textAlign:"right"}}>
                        <p style={{color:"#ef4444",fontWeight:900,fontSize:14,lineHeight:1}}>{inr(c.pending)}</p>
                        <p style={{color:t.sub,fontSize:9,marginTop:2}}>pending</p>
                      </div>}
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{color:t.sub,transition:"transform 0.2s",transform:isExpanded?"rotate(180deg)":"none",flexShrink:0}}><path d="M4.5 6.75L9 11.25L13.5 6.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  </div>

                  {/* ── EXPANDED BODY — two-column on desktop ── */}
                  {isExpanded&&<div style={{borderTop:`1px solid ${t.border}`,padding:"18px 18px 20px",animation:"custCardExpand 0.18s ease-out"}} ref={el=>{if(el&&!document.getElementById("cust-card-anim-style")){const s=document.createElement("style");s.id="cust-card-anim-style";s.textContent="@keyframes custCardExpand{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}";document.head.appendChild(s);}}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,alignItems:"start"}}>

                      {/* ── LEFT COLUMN ── */}
                      <div style={{display:"flex",flexDirection:"column",gap:14}}>

                        {/* Stats row */}
                        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                          {[
                            {label:"Orders",val:cDelivs.length,color:t.text},
                            {label:"Delivered",val:cDone.length,color:"#10b981"},
                            {label:"Returns",val:cReturns,color:cReturns>0?"#ef4444":t.sub},
                            {label:"Replaced",val:cReplacements,color:cReplacements>0?"#f97316":t.sub},
                          ].map(({label,val,color})=>(
                            <div key={label} style={{background:t.inp,borderRadius:10,padding:"10px 6px",textAlign:"center"}}>
                              <p style={{color,fontWeight:900,fontSize:18,lineHeight:1}}>{val}</p>
                              <p style={{color:t.sub,fontSize:9,marginTop:4,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.04em"}}>{label}</p>
                            </div>
                          ))}
                        </div>

                        {/* Delivery rate bar */}
                        {cDelivs.length>0&&<div>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:t.sub,marginBottom:5}}>
                            <span style={{fontWeight:600}}>Delivery rate</span>
                            <span style={{fontWeight:700,color:delivRate>=90?"#10b981":delivRate>=70?"#f59e0b":"#ef4444"}}>{delivRate}%</span>
                          </div>
                          <div style={{background:t.border,height:5,borderRadius:5,overflow:"hidden"}}>
                            <div style={{width:`${delivRate}%`,height:"100%",borderRadius:5,background:delivRate>=90?"#10b981":delivRate>=70?"#f59e0b":"#ef4444",transition:"width 0.4s"}}/>
                          </div>
                        </div>}

                        {/* Payment status */}
                        {canSeeFinancials&&<div style={{background:t.inp,borderRadius:12,padding:"12px 14px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                            <span style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>Payment Status</span>
                            <span style={{fontSize:12,fontWeight:800,color:c.pending>0?"#ef4444":"#10b981",background:c.pending>0?"#ef444415":"#10b98115",borderRadius:8,padding:"2px 9px"}}>{c.pending>0?`Due ${inr(c.pending)}`:"✓ Fully Paid"}</span>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:8}}>
                            <span style={{color:"#10b981",fontWeight:600}}>Paid: {inr(c.paid||0)}</span>
                            {totalBilled>0&&<span style={{color:t.sub}}>{payPct}% settled</span>}
                          </div>
                          <div style={{background:t.border,height:6,borderRadius:6,overflow:"hidden",marginBottom:8}}>
                            <div style={{width:`${payPct}%`,background:c.pending>0?"#f59e0b":"#10b981",height:"100%",borderRadius:6,transition:"width 0.4s"}}/>
                          </div>
                          {partialPaid>0&&<p style={{color:"#f59e0b",fontSize:11,fontWeight:600}}>💛 Partial on hold: {inr(partialPaid)}</p>}
                          {cReplAmt>0&&<p style={{color:"#f97316",fontSize:11,marginTop:4,fontWeight:600}}>🔄 Replacement deductions: −{inr(cReplAmt)}</p>}
                        </div>}

                        {/* Regular order template */}
                        {rows.length>0&&<div style={{border:`1px solid ${t.border}`,borderRadius:12,padding:"12px 14px"}}>
                          <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Regular Order Template</p>
                          {rows.map(r=>(
                            <div key={r.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,paddingBottom:5,marginBottom:5,borderBottom:`1px solid ${t.border}`}}>
                              <span style={{color:t.sub}}>{r.qty} × {r.name}{canSeePrices?<span style={{color:t.sub,fontSize:11}}> @ {inr(r.priceAmount)}</span>:""}</span>
                              {canSeePrices&&<span style={{color:t.text,fontWeight:600}}>{inr(r.qty*r.priceAmount)}</span>}
                            </div>
                          ))}
                          {canSeePrices&&tot>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:800,marginTop:6,paddingTop:6,borderTop:`2px solid ${t.border}`}}>
                            <span style={{color:t.sub}}>Net Total</span>
                            <span style={{color:"#f59e0b"}}>{inr(cReplAmt>0?netTot:tot)}</span>
                          </div>}
                        </div>}

                        {/* Notes + info */}
                        {(c.notes||c.address||c.joinDate)&&<div style={{background:t.inp,borderRadius:10,padding:"10px 14px",display:"flex",flexDirection:"column",gap:4}}>
                          {c.address&&<p style={{color:t.sub,fontSize:11}}>📍 {c.address}</p>}
                          {c.notes&&<p style={{color:t.sub,fontSize:12,fontStyle:"italic"}}>"{c.notes}"</p>}
                          {c.joinDate&&<p style={{color:t.sub,fontSize:11}}>📅 Customer since {c.joinDate}</p>}
                        </div>}

                        {/* Partial payment widget */}
                        {canSeeFinancials&&can("cust_markPaid")&&<div style={{background:dm?"rgba(245,158,11,0.07)":"#fffbeb",border:`1px solid ${dm?"rgba(245,158,11,0.25)":"#fde68a"}`,borderRadius:12,padding:"12px 14px"}}>
                          <p style={{color:"#d97706",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>💰 Log Partial Payment</p>
                          <div style={{display:"flex",gap:8,alignItems:"center"}}>
                            <input type="number" inputMode="numeric" placeholder="₹ Amount"
                              defaultValue={c.partialPay||""}
                              onBlur={e=>{const v=+e.target.value;if(v>=0){setCust(p=>p.map(x=>x.id===c.id?{...x,partialPay:v}:x));addLog("Partial payment set",`${c.name} — ${inr(v)}`);} }}
                              style={{flex:1,background:t.card,border:`1.5px solid ${dm?"rgba(245,158,11,0.3)":"#fde68a"}`,color:t.text,borderRadius:8,padding:"8px 10px",fontSize:13,outline:"none"}}/>
                            <button onClick={()=>{const v=c.partialPay||0;if(v>0){setCust(p=>p.map(x=>x.id===c.id?{...x,paid:(x.paid||0)+v,pending:Math.max(0,(x.pending||0)-v),partialPay:0}:x));addLog("Partial payment applied",`${c.name} — ${inr(v)}`);notify(`${inr(v)} applied to ${c.name} ✓`);}}}
                              style={{background:"#059669",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0}}>Apply</button>
                          </div>
                        </div>}

                        {/* Action buttons — single row on desktop */}
                        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                          {can("cust_edit")&&<button onClick={()=>{setCf({...c,orderLines:{...safeO(c.orderLines)}});setCsh(c);}}
                            style={{flex:"1 1 80px",background:t.inp,color:t.text,border:`1.5px solid ${t.border}`,height:38,borderRadius:10,fontSize:12,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:4}}>✏️ Edit</button>}
                          <button onClick={()=>exportPDF(c,products,"customer",settings,deliveries)}
                            style={{flex:"1 1 80px",background:"#7c3aed",color:"#fff",border:"none",height:38,borderRadius:10,fontSize:12,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:4}}>📄 PDF</button>
                          {can("cust_export")&&<button onClick={()=>{
                              const cD=deliveries.filter(d=>d.customerId===c.id).sort((a,b)=>b.date.localeCompare(a.date));
                              const enrichedRows=cD.map(d=>{const items=Object.entries(safeO(d.orderLines)).filter(([,l])=>l.qty>0).map(([pid,l])=>{const p=products.find(x=>x.id===pid);return `${l.qty}x ${p?p.name:(l.name||pid)}`;}).join("; ");return {...d,_items:items,_total:lineTotal(d.orderLines),_replItem:d.replacement?.done?(d.replacement.item||""):"",_replQty:d.replacement?.done?(d.replacement.qty||""):"",_replAmt:d.replacement?.done?(+d.replacement.amount||0):0,_replReason:d.replacement?.done?(d.replacement.reason||""):"",_notes:d.notes||""};});
                              exportTabExcel(c.name.replace(/[^a-zA-Z0-9 ]/g," ").slice(0,28)+" Deliveries",enrichedRows,[{label:"Invoice No",val:r=>r.invNo||""},{label:"Receipt No",val:r=>{const inv=r.invNo;return inv?`RCP-${inv.replace(/^[A-Z]+-/,"")}`:""}},{label:"Date",key:"date"},{label:"Status",key:"status"},{label:"Items Ordered",key:"_items"},{label:"Order Total (Rs)",key:"_total",num:true},{label:"Replacement Item",key:"_replItem"},{label:"Repl. Qty",key:"_replQty"},{label:"Repl. Amount (Rs)",key:"_replAmt",num:true},{label:"Repl. Reason",key:"_replReason"},{label:"Created By",key:"createdBy"},{label:"Notes",key:"_notes"}],settings);
                            }}
                            style={{flex:"1 1 80px",background:"#059669",color:"#fff",border:"none",height:38,borderRadius:10,fontSize:12,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:4}}>📊 XLS</button>}
                          {can("cust_markPaid")&&<button onClick={()=>{setPaySh(c);setPayAmt("");}}
                            style={{flex:"1 1 90px",background:"#f59e0b",color:"#000",border:"none",height:38,borderRadius:10,fontSize:12,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:4}}>💰 Collect</button>}
                          {can("cust_deactivate")&&<button onClick={()=>togActive(c)}
                            style={{flex:"1 1 80px",background:"#0ea5e915",color:"#38bdf8",border:"1.5px solid #38bdf830",height:38,borderRadius:10,fontSize:12,fontWeight:600,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:4}}>{c.active?"⏸ Pause":"▶ Activate"}</button>}
                          {c.address&&<a href={mapU(c.address,c.lat,c.lng)} target="_blank" rel="noopener noreferrer"
                            style={{flex:"1 1 80px",background:"#0ea5e9",color:"#fff",height:38,borderRadius:10,fontSize:12,fontWeight:700,display:"inline-flex",alignItems:"center",justifyContent:"center",textDecoration:"none",gap:4}}>📍 Map</a>}
                          {can("cust_delete")&&<button onClick={()=>delC(c)}
                            style={{flex:"1 1 80px",background:"#dc2626",color:"#fff",border:"none",height:38,borderRadius:10,fontSize:12,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:4}}>🗑 Delete</button>}
                        </div>

                      </div>{/* end left column */}

                      {/* ── RIGHT COLUMN — Recent Deliveries ── */}
                      <div style={{display:"flex",flexDirection:"column",gap:10}}>
                        <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>Recent Deliveries {cDelivs.length>0&&<span style={{color:t.sub,fontWeight:500,fontSize:10,textTransform:"none",letterSpacing:0}}>({cDelivs.length} total)</span>}</p>
                        {cDelivs.length===0&&<p style={{color:t.sub,fontSize:12}}>No deliveries yet.</p>}
                        {[...cDelivs].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map((d)=>{
                          const dTot=lineTotal(d.orderLines);
                          const dRepl=+d.replacement?.amount||0;
                          const dNet=Math.max(0,dTot-dRepl);
                          const dCollected=d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0;
                          const dBal=Math.max(0,dNet-dCollected);
                          const dSc=d.status==="Delivered"?"#10b981":d.status==="In Transit"?"#0ea5e9":d.status==="Cancelled"?"#ef4444":"#f59e0b";
                          const invNo=(invRegistry?.issued||{})[d.id]||d.invNo||null;
                          const custRcptNo=invNo?`RCP-${invNo.replace(/^[A-Z]+-/,"")}`:`RCP-${(d.id||"").slice(-6).toUpperCase()}`;
                          const dItems=Object.entries(d.orderLines||{}).filter(([,l])=>l.qty>0);
                          const hasDeductions=dRepl>0||dCollected>0;
                          return <div key={d.id} style={{background:t.inp,borderRadius:12,overflow:"hidden",border:`1px solid ${t.border}`}}>
                            {/* Header */}
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 12px",gap:8}}>
                              <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                                <span style={{color:t.text,fontSize:12,fontWeight:700}}>{d.date}</span>
                                <span style={{background:`${dSc}20`,color:dSc,borderRadius:6,padding:"2px 8px",fontSize:9,fontWeight:800}}>{d.status}</span>
                                {invNo&&<span style={{color:"#8b5cf6",fontSize:9,fontFamily:"monospace",fontWeight:700,background:dm?"rgba(139,92,246,0.15)":"rgba(139,92,246,0.08)",borderRadius:4,padding:"1px 6px"}}>📄 {invNo}</span>}
                                {invNo&&<span style={{color:"#0ea5e9",fontSize:9,fontFamily:"monospace",fontWeight:700,background:dm?"rgba(14,165,233,0.15)":"rgba(14,165,233,0.08)",borderRadius:4,padding:"1px 6px"}}>🧾 {custRcptNo}</span>}
                              </div>
                              {canSeePrices&&<span style={{fontSize:11,fontWeight:800,color:dBal===0?"#10b981":"#ef4444",background:dBal===0?"#10b98115":"#ef444415",borderRadius:8,padding:"3px 9px",flexShrink:0}}>
                                {dBal===0?"✓ Settled":`Due ${inr(dBal)}`}
                              </span>}
                            </div>
                            {/* Items */}
                            {dItems.length>0&&<div style={{padding:"0 12px 8px",borderTop:`1px solid ${t.border}`}}>
                              <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",margin:"7px 0 5px"}}>Items</p>
                              {dItems.map(([pid,l])=>{
                                const prod=products.find(p=>p.id===pid)||{name:l.name||pid};
                                return <div key={pid} style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,paddingBottom:3}}>
                                  <span style={{color:t.sub}}>{l.qty} × {prod.name}</span>
                                  {canSeePrices&&l.priceAmount>0&&<span style={{color:t.text,fontWeight:600}}>{inr(l.qty*l.priceAmount)}</span>}
                                </div>;
                              })}
                            </div>}
                            {/* Bill breakdown */}
                            {canSeePrices&&dTot>0&&<div style={{borderTop:`1px solid ${t.border}`,padding:"8px 12px",display:"flex",flexDirection:"column",gap:4}}>
                              <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
                                <span style={{color:t.sub}}>Order total</span>
                                <span style={{color:t.text,fontWeight:600}}>{inr(dTot)}</span>
                              </div>
                              {dRepl>0&&<>
                                <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
                                  <span style={{color:"#f97316"}}>🔄 Replacement{d.replacement?.item?` (${d.replacement.item}${d.replacement.qty?" ×"+d.replacement.qty:""})`:""}</span>
                                  <span style={{color:"#f97316",fontWeight:700}}>−{inr(dRepl)}</span>
                                </div>
                                <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
                                  <span style={{color:t.sub,fontWeight:600}}>Net payable</span>
                                  <span style={{color:t.text,fontWeight:700}}>{inr(dNet)}</span>
                                </div>
                              </>}
                              {dCollected>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
                                <span style={{color:"#10b981"}}>💰 Collected</span>
                                <span style={{color:"#10b981",fontWeight:700}}>−{inr(dCollected)}</span>
                              </div>}
                              {(hasDeductions||dBal>0)&&<div style={{borderTop:`1.5px solid ${t.border}`,marginTop:2,paddingTop:5,display:"flex",justifyContent:"space-between",fontSize:12}}>
                                <span style={{fontWeight:700,color:dBal===0?"#10b981":"#ef4444"}}>{dBal===0?"✓ Fully settled":"Balance due"}</span>
                                <span style={{fontWeight:800,color:dBal===0?"#10b981":"#ef4444"}}>{dBal===0?"—":inr(dBal)}</span>
                              </div>}
                            </div>}
                          </div>;
                        })}
                        {cDelivs.length>5&&<p style={{color:t.sub,fontSize:10,textAlign:"center"}}>+{cDelivs.length-5} more · <button onClick={()=>{setTab("Deliveries");setExpandedDeliveryCust(c.id);}} style={{color:"#f59e0b",background:"none",border:"none",cursor:"pointer",fontWeight:700,fontSize:10}}>View all →</button></p>}
                      </div>{/* end right column */}

                    </div>{/* end two-col grid */}
                  </div>}{/* end expanded body */}
                </div>
              );
            })}
            </div>
            </>;
          })()}
        </>)}

        {/* DELIVERIES */}
        {tab==="Deliveries"&&(<>
          {/* Top summary pills — now tappable as filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              {key:"all",label:`All (${deliveries.length})`,c:"stone"},
              {key:"Pending",label:`${deliveries.filter(d=>d.status==="Pending").length} Pending`,c:"amber"},
              {key:"In Transit",label:`${deliveries.filter(d=>d.status==="In Transit").length} Transit`,c:"blue"},
              {key:"Delivered",label:`${deliveries.filter(d=>d.status==="Delivered").length} Done`,c:"green"},
            ].map(({key,label,c})=>(
              <button key={key} onClick={()=>setDelivStatusFilter(key)}
                style={{border:`1.5px solid ${delivStatusFilter===key?(c==="amber"?"#f59e0b":c==="blue"?"#3b82f6":c==="green"?"#10b981":"#6b7280"):"transparent"}`,borderRadius:99,padding:"0",background:"transparent",cursor:"pointer",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>
                <Pill dm={dm} c={delivStatusFilter===key?c:"stone"}>{label}</Pill>
              </button>
            ))}
            <div className="ml-auto flex gap-2">
              <Btn dm={dm} size="sm" onClick={()=>{setDf(blkD());setDsh("add");}}>+ Delivery</Btn>
            </div>
          </div>
          {/* Secondary actions row — scrollable on mobile */}
          <div className="flex gap-2 overflow-x-auto pb-1" style={{WebkitOverflowScrolling:"touch",scrollbarWidth:"none",msOverflowStyle:"none"}}>
            <button onClick={()=>{setBulkSelect(v=>{if(v){setBulkSelected(new Set());}return !v;});}} style={{background:bulkSelect?"#f59e0b":t.inp,color:bulkSelect?"#000":t.sub,border:`1.5px solid ${bulkSelect?"#f59e0b":t.border}`,minHeight:40,padding:"0 14px",borderRadius:10,fontSize:13,fontWeight:600,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>{bulkSelect?"✕ Cancel":"☑ Bulk select"}</button>
            <button onClick={()=>setDelivCalendar(v=>!v)} style={{background:delivCalendar?"#f59e0b":t.inp,color:delivCalendar?"#000":t.sub,border:`1.5px solid ${delivCalendar?"#f59e0b":t.border}`,minHeight:40,padding:"0 14px",borderRadius:10,fontSize:13,fontWeight:600,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>{delivCalendar?"📋 List":"📅 Calendar"}</button>
            {can("deliv_add")&&(settings?.bulkOrderEnabled!==false)&&<button onClick={initBulkRows} style={{background:t.inp,color:t.sub,border:`1.5px solid ${t.border}`,minHeight:40,padding:"0 14px",borderRadius:10,fontSize:13,fontWeight:600,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>📋 Bulk order</button>}
            {can("deliv_report")&&<button onClick={exportFullReport} style={{background:"#7c3aed15",color:"#7c3aed",border:"1.5px solid #7c3aed40",minHeight:40,padding:"0 14px",borderRadius:10,fontSize:13,fontWeight:600,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>📊 Report</button>}
            {can("deliv_export")&&<button onClick={()=>exportCSV(deliveries,"deliveries",[{label:"Invoice No",val:r=>(invRegistry?.issued||{})[r.id]||""},{label:"Receipt No",val:r=>{const inv=(invRegistry?.issued||{})[r.id];return inv?`RCP-${inv.replace("TAS-","")}`:""}},{label:"Customer",key:"customer"},{label:"Date",key:"date"},{label:"Deliver By",key:"deliveryDate"},{label:"Status",key:"status"},{label:"Total Order (₹)",val:r=>lineTotal(r.orderLines)},{label:"Repl Amount (₹)",val:r=>r.replacement?.amount||0},{label:"Net Amount (₹)",val:r=>lineTotal(r.orderLines)-(+r.replacement?.amount||0)},{label:"Partial Paid (₹)",val:r=>r.partialPayment?.enabled?(+r.partialPayment?.amount||0):0},{label:"Balance Due (₹)",val:r=>Math.max(0,lineTotal(r.orderLines)-(+r.replacement?.amount||0)-(r.partialPayment?.enabled?(+r.partialPayment?.amount||0):0))},{label:"Amount Remaining (₹)",val:r=>lineTotal(r.orderLines)-(+r.replacement?.amount||0)-(r.paid||0)},{label:"Replacement Done",val:r=>r.replacement?.done?"Yes":"No"},{label:"Replacement Item",val:r=>r.replacement?.item||""},{label:"Replacement Qty",val:r=>r.replacement?.qty||""},{label:"Replacement Reason",val:r=>r.replacement?.reason||""},{label:"Address",key:"address"},{label:"Created By",key:"createdBy"},{label:"Notes",key:"notes"}])} style={{background:t.inp,color:t.sub,border:`1.5px solid ${t.border}`,minHeight:40,padding:"0 14px",borderRadius:10,fontSize:13,fontWeight:600,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>CSV</button>}
            {can("deliv_export")&&<button onClick={()=>{const cols=[{label:"Invoice No",val:r=>(invRegistry?.issued||{})[r.id]||r.invNo||""},{label:"Receipt No",val:r=>{const inv=(invRegistry?.issued||{})[r.id]||r.invNo;return inv?`RCP-${inv.replace(/^[A-Z]+-/,"")}`:"";}},{label:"Customer",key:"customer"},{label:"Date",key:"date"},{label:"Status",key:"status"},{label:"Total Order (₹)",val:r=>lineTotal(r.orderLines),num:true},{label:"Repl (₹)",val:r=>r.replacement?.amount||0,num:true},{label:"Net Amt (₹)",val:r=>lineTotal(r.orderLines)-(+r.replacement?.amount||0),num:true},{label:"Paid (₹)",val:r=>r.partialPayment?.enabled?(+r.partialPayment?.amount||0):0,num:true},{label:"Remaining (₹)",val:r=>Math.max(0,lineTotal(r.orderLines)-(+r.replacement?.amount||0)-(r.partialPayment?.enabled?(+r.partialPayment?.amount||0):0)),num:true},{label:"Repl Item",val:r=>r.replacement?.done?(r.replacement.item||"Done"):"—"},{label:"Repl Qty",val:r=>r.replacement?.qty||""},{label:"Repl Reason",val:r=>r.replacement?.reason||""},{label:"Address",key:"address"},{label:"By",key:"createdBy"}];const totalOrd=deliveries.reduce((s,d)=>s+lineTotal(d.orderLines),0);const totalPaid=deliveries.reduce((s,d)=>s+(d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0),0);const totalRepl=deliveries.reduce((s,d)=>s+(+d.replacement?.amount||0),0);const totalRem=totalOrd-totalRepl-totalPaid;const statsHtml=`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px"><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px"><div style="font-size:20px;font-weight:900;color:#0f172a">${deliveries.length}</div><div style="font-size:10px;color:#94a3b8;text-transform:uppercase;margin-top:4px">Total Orders</div></div><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px"><div style="font-size:20px;font-weight:900;color:#059669">${deliveries.filter(d=>d.status==="Delivered").length}</div><div style="font-size:10px;color:#94a3b8;text-transform:uppercase;margin-top:4px">Delivered</div></div><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px"><div style="font-size:20px;font-weight:900;color:#f59e0b">${deliveries.filter(d=>d.status==="Pending").length}</div><div style="font-size:10px;color:#94a3b8;text-transform:uppercase;margin-top:4px">Pending</div></div><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px"><div style="font-size:20px;font-weight:900;color:#0f172a">₹${totalOrd.toLocaleString("en-IN")}</div><div style="font-size:10px;color:#94a3b8;text-transform:uppercase;margin-top:4px">Total Order Value</div></div><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px"><div style="font-size:20px;font-weight:900;color:#059669">₹${totalPaid.toLocaleString("en-IN")}</div><div style="font-size:10px;color:#94a3b8;text-transform:uppercase;margin-top:4px">Amount Paid</div></div><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px"><div style="font-size:20px;font-weight:900;color:#dc2626">₹${totalRem.toLocaleString("en-IN")}</div><div style="font-size:10px;color:#94a3b8;text-transform:uppercase;margin-top:4px">Remaining</div></div></div>`;exportTabPDF("Deliveries",deliveries,cols,settings,statsHtml);}} style={{background:t.inp,color:t.sub,border:`1.5px solid ${t.border}`,minHeight:40,padding:"0 14px",borderRadius:10,fontSize:13,fontWeight:600,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>PDF</button>}
            {can("deliv_export")&&<button onClick={()=>{const cols=[{label:"Invoice No",val:r=>(invRegistry?.issued||{})[r.id]||""},{label:"Receipt No",val:r=>{const inv=(invRegistry?.issued||{})[r.id];return inv?`RCP-${inv.replace("TAS-","")}`:""}},{label:"Customer",key:"customer"},{label:"Date",key:"date"},{label:"Deliver By",key:"deliveryDate"},{label:"Status",key:"status"},{label:"Total Order",val:r=>lineTotal(r.orderLines),num:true},{label:"Repl Amount",val:r=>r.replacement?.amount||0,num:true},{label:"Net Amount",val:r=>lineTotal(r.orderLines)-(+r.replacement?.amount||0),num:true},{label:"Partial Paid",val:r=>r.partialPayment?.enabled?(+r.partialPayment?.amount||0):0,num:true},{label:"Balance Due",val:r=>Math.max(0,lineTotal(r.orderLines)-(+r.replacement?.amount||0)-(r.partialPayment?.enabled?(+r.partialPayment?.amount||0):0)),num:true},{label:"Repl Item",val:r=>r.replacement?.done?(r.replacement.item||"Done"):"—"},{label:"Repl Qty",val:r=>r.replacement?.qty||""},{label:"Repl Reason",val:r=>r.replacement?.reason||""},{label:"Address",key:"address"},{label:"By",key:"createdBy"},{label:"Notes",key:"notes"}];exportTabExcel("Deliveries",deliveries,cols,settings);}} style={{background:t.inp,color:t.sub,border:`1.5px solid ${t.border}`,minHeight:40,padding:"0 14px",borderRadius:10,fontSize:13,fontWeight:600,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>XLS</button>}
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
          <Search dm={dm} value={srch} onChange={setSrch} placeholder="Search customer, date, status, invoice, receipt, batch…"/>

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
            // Month-level stats
            const mDelivs=deliveries.filter(d=>d.date&&d.date.startsWith(monthStr));
            const mPending=mDelivs.filter(d=>d.status==="Pending").length;
            const mTransit=mDelivs.filter(d=>d.status==="In Transit").length;
            const mDone=mDelivs.filter(d=>d.status==="Delivered").length;
            const mRevenue=mDelivs.filter(d=>d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0);
            const mPaid=mDelivs.reduce((s,d)=>s+(d.paid||0),0);
            const todayStr=today();
            return <Card dm={dm} className="overflow-hidden">
              {/* Header */}
              <div style={{background:dm?"#0f1923":"#1e3a5f",padding:"14px 16px 12px"}}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p style={{color:"#fff",fontWeight:900,fontSize:17,lineHeight:1}}>{mName}</p>
                    <p style={{color:"rgba(255,255,255,0.55)",fontSize:11,marginTop:3}}>{mDelivs.length} deliveries this month</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={()=>setCalOffset(o=>o-1)} style={{background:"rgba(255,255,255,0.12)",color:"#fff",border:"none",borderRadius:8,width:32,height:32,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"}}>‹</button>
                    {calOffset!==0&&<button onClick={()=>setCalOffset(0)} style={{background:"rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.8)",border:"none",borderRadius:8,padding:"0 10px",fontSize:11,fontWeight:600,cursor:"pointer",height:32,WebkitTapHighlightColor:"transparent"}}>Today</button>}
                    <button onClick={()=>setCalOffset(o=>o+1)} style={{background:"rgba(255,255,255,0.12)",color:"#fff",border:"none",borderRadius:8,width:32,height:32,fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"}}>›</button>
                  </div>
                </div>
                {/* Month stats row */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                  {[
                    {label:"Pending",val:mPending,color:"#f59e0b"},
                    {label:"In Transit",val:mTransit,color:"#0ea5e9"},
                    {label:"Delivered",val:mDone,color:"#10b981"},
                    ...(canSeePrices?[{label:"Revenue",val:inr(mRevenue),color:"#a78bfa"}]:[{label:"Paid",val:inr(mPaid),color:"#a78bfa"}]),
                  ].map(({label,val,color})=>(
                    <div key={label} style={{background:"rgba(255,255,255,0.08)",borderRadius:8,padding:"6px 8px",textAlign:"center"}}>
                      <p style={{color,fontWeight:800,fontSize:14,lineHeight:1}}>{val}</p>
                      <p style={{color:"rgba(255,255,255,0.5)",fontSize:9,marginTop:3,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>
              {/* Day-of-week headers */}
              <div style={{padding:"0 8px"}}>
                <div className="grid grid-cols-7" style={{borderBottom:`1px solid ${t.border}`,marginBottom:4,marginTop:8}}>
                  {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>(
                    <div key={d} style={{color:t.sub,textAlign:"center",fontSize:10,fontWeight:700,padding:"4px 0",textTransform:"uppercase",letterSpacing:"0.06em"}}>{d}</div>
                  ))}
                </div>
                {/* Calendar grid */}
                <div style={{display:"flex",flexDirection:"column",gap:3,paddingBottom:10}}>
                  {weeks.map((week,wi)=>(
                    <div key={wi} className="grid grid-cols-7" style={{gap:3}}>
                      {week.map((day,di)=>{
                        if(!day)return <div key={di} style={{minHeight:62}}/>;
                        const dateStr=`${monthStr}-${String(day).padStart(2,"0")}`;
                        const dayDelivs=deliveries.filter(d=>d.date===dateStr&&(!srch||d.customer.toLowerCase().includes(srch.toLowerCase())||d.status.toLowerCase().includes(srch.toLowerCase())));
                        const isToday=dateStr===todayStr;
                        const isExpanded=calExpandedDay===dateStr;
                        const isPast=dateStr<todayStr;
                        const pendCount=dayDelivs.filter(d=>d.status==="Pending").length;
                        const transitCount=dayDelivs.filter(d=>d.status==="In Transit").length;
                        const doneCount=dayDelivs.filter(d=>d.status==="Delivered").length;
                        return <div key={di}
                          style={{
                            background:isToday?(dm?"#1c2a3a":"#eff6ff"):isExpanded?(dm?"#1e1040":"#f5f3ff"):t.card,
                            border:`1.5px solid ${isToday?"#3b82f6":isExpanded?"#7c3aed":dayDelivs.length>0?(dm?"#30363d":"#e2e8f0"):t.border}`,
                            borderRadius:10,
                            minHeight:62,
                            cursor:dayDelivs.length>0?"pointer":"default",
                            transition:"border-color 0.12s,background 0.12s,transform 0.1s",
                            WebkitTapHighlightColor:"transparent",
                            touchAction:"manipulation",
                            position:"relative",
                            overflow:"hidden",
                          }}
                          className={dayDelivs.length>0?"active:scale-[0.96]":""}
                          onClick={()=>dayDelivs.length>0&&setCalExpandedDay(isExpanded?null:dateStr)}>
                          {/* Today accent bar */}
                          {isToday&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"#3b82f6",borderRadius:"8px 8px 0 0"}}/>}
                          <div style={{padding:"6px 5px 4px"}}>
                            <p style={{
                              color:isToday?"#3b82f6":isPast&&dayDelivs.length===0?t.sub:t.text,
                              fontSize:isToday?13:12,
                              fontWeight:isToday?900:600,
                              lineHeight:1,
                              marginBottom:3,
                              opacity:isPast&&dayDelivs.length===0?0.4:1,
                            }}>{day}</p>
                            {/* Status dots row */}
                            {dayDelivs.length>0&&<div style={{display:"flex",flexDirection:"column",gap:2}}>
                              {pendCount>0&&<div style={{background:"#f59e0b",borderRadius:4,padding:"1.5px 5px",display:"flex",alignItems:"center",gap:3}}>
                                <span style={{color:"#fff",fontSize:9,fontWeight:700,lineHeight:1}}>{pendCount}</span>
                                <span style={{color:"rgba(255,255,255,0.8)",fontSize:8,lineHeight:1}}>pending</span>
                              </div>}
                              {transitCount>0&&<div style={{background:"#0ea5e9",borderRadius:4,padding:"1.5px 5px",display:"flex",alignItems:"center",gap:3}}>
                                <span style={{color:"#fff",fontSize:9,fontWeight:700,lineHeight:1}}>{transitCount}</span>
                                <span style={{color:"rgba(255,255,255,0.8)",fontSize:8,lineHeight:1}}>transit</span>
                              </div>}
                              {doneCount>0&&<div style={{background:"#10b981",borderRadius:4,padding:"1.5px 5px",display:"flex",alignItems:"center",gap:3}}>
                                <span style={{color:"#fff",fontSize:9,fontWeight:700,lineHeight:1}}>{doneCount}</span>
                                <span style={{color:"rgba(255,255,255,0.8)",fontSize:8,lineHeight:1}}>done</span>
                              </div>}
                              {dayDelivs.length>3&&<div style={{color:t.sub,fontSize:8,fontWeight:700,textAlign:"center",marginTop:1}}>+{dayDelivs.length-3} more</div>}
                            </div>}
                          </div>
                        </div>;
                      })}
                    </div>
                  ))}
                </div>
                {/* EXPANDED DAY PANEL */}
                {calExpandedDay&&(()=>{
                  const expandedDelivs=deliveries.filter(d=>d.date===calExpandedDay&&(!srch||d.customer.toLowerCase().includes(srch.toLowerCase())||d.status.toLowerCase().includes(srch.toLowerCase())));
                  if(expandedDelivs.length===0)return null;
                  const dayTotAmt=expandedDelivs.reduce((s,d)=>s+lineTotal(d.orderLines),0);
                  const dayTotPaid=expandedDelivs.reduce((s,d)=>s+(d.paid||0),0);
                  const dayTotReplAmt=expandedDelivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
                  const dayLabel=new Date(calExpandedDay+"T00:00:00").toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"});
                  return <div style={{background:dm?"#1a0a2e":"#f5f3ff",border:"1.5px solid #7c3aed40",borderRadius:14,padding:"12px 14px",marginBottom:10}}>
                    <div className="flex items-center justify-between mb-3" style={{gap:8}}>
                      <div>
                        <p style={{color:"#7c3aed",fontWeight:900,fontSize:14,lineHeight:1.2}}>{dayLabel}</p>
                        <p style={{color:t.sub,fontSize:11,marginTop:2}}>{expandedDelivs.length} {expandedDelivs.length===1?"delivery":"deliveries"}</p>
                      </div>
                      <button onClick={()=>setCalExpandedDay(null)} style={{color:t.sub,background:t.inp,border:`1px solid ${t.border}`,borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:32,WebkitTapHighlightColor:"transparent",flexShrink:0}}>✕ Close</button>
                    </div>
                    {canSeePrices&&<div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6,marginBottom:12}}>
                      <div style={{background:dm?"#ffffff0a":t.card,border:`1px solid ${t.border}`,borderRadius:10,padding:"8px 10px"}}>
                        <p style={{color:"#10b981",fontWeight:800,fontSize:14}}>{inr(dayTotAmt)}</p>
                        <p style={{color:t.sub,fontSize:9,marginTop:2,textTransform:"uppercase",letterSpacing:"0.05em"}}>Total Orders</p>
                      </div>
                      {dayTotReplAmt>0&&<div style={{background:dm?"#ffffff0a":t.card,border:`1px solid ${t.border}`,borderRadius:10,padding:"8px 10px"}}>
                        <p style={{color:"#f97316",fontWeight:800,fontSize:14}}>−{inr(dayTotReplAmt)}</p>
                        <p style={{color:t.sub,fontSize:9,marginTop:2,textTransform:"uppercase",letterSpacing:"0.05em"}}>Replacements</p>
                      </div>}
                      <div style={{background:dm?"#ffffff0a":t.card,border:`1px solid ${t.border}`,borderRadius:10,padding:"8px 10px"}}>
                        <p style={{color:"#0ea5e9",fontWeight:800,fontSize:14}}>{inr(dayTotPaid)}</p>
                        <p style={{color:t.sub,fontSize:9,marginTop:2,textTransform:"uppercase",letterSpacing:"0.05em"}}>Collected</p>
                      </div>
                      <div style={{background:dm?"#ffffff0a":t.card,border:`1px solid ${t.border}`,borderRadius:10,padding:"8px 10px"}}>
                        <p style={{color:(dayTotAmt-dayTotReplAmt-dayTotPaid)>0?"#f59e0b":"#10b981",fontWeight:800,fontSize:14}}>{inr(Math.max(0,dayTotAmt-dayTotReplAmt-dayTotPaid))}</p>
                        <p style={{color:t.sub,fontSize:9,marginTop:2,textTransform:"uppercase",letterSpacing:"0.05em"}}>Outstanding</p>
                      </div>
                    </div>}
                    <div className="flex flex-col gap-3">
                      {expandedDelivs.map(d=>{
                        const rows=lineRows(d.orderLines,products);
                        const tot=lineTotal(d.orderLines);
                        const replAmt=+d.replacement?.amount||0;
                        const netAmt=tot-replAmt;
                        const paid=d.paid||0;
                        const remaining=netAmt-paid;
                        const sc=statusColor(d.status);
                        return <div key={d.id} style={{background:dm?"#ffffff08":t.card,border:`1px solid ${sc}40`,borderRadius:12,padding:"10px 12px",borderLeft:`3px solid ${sc}`}}>
                          <div className="flex items-start justify-between mb-2" style={{gap:8}}>
                            <div style={{minWidth:0}}>
                              <p style={{color:t.text,fontWeight:800,fontSize:14,lineHeight:1.2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{d.customer}</p>
                              {d.address&&<p style={{color:t.sub,fontSize:10,marginTop:1}}>📍 {d.address}</p>}
                              {d.notes&&<p style={{color:t.sub,fontSize:10,marginTop:1,fontStyle:"italic"}}>"{d.notes}"</p>}
                            </div>
                            <span style={{background:sc+"20",color:sc,borderRadius:8,padding:"3px 9px",fontSize:10,fontWeight:800,flexShrink:0,whiteSpace:"nowrap",border:`1px solid ${sc}40`}}>{d.status}</span>
                          </div>
                          {rows.length>0&&<div style={{background:t.inp,borderRadius:8,padding:"6px 10px",marginBottom:8}}>
                            {rows.map(r=>(
                              <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"2px 0",fontSize:12}}>
                                <span style={{color:t.sub,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginRight:8}}>{r.qty} × {r.name}{canSeePrices?` @ ${inr(r.priceAmount)}`:""}</span>
                                {canSeePrices&&<span style={{color:t.text,fontWeight:700,flexShrink:0}}>{inr(r.qty*r.priceAmount)}</span>}
                              </div>
                            ))}
                          </div>}
                          {d.replacement?.done&&<div style={{background:"#f9731615",border:"1px solid #f9731630",borderRadius:8,padding:"6px 10px",marginBottom:8}}>
                            <p style={{color:"#f97316",fontSize:11,fontWeight:700}}>🔄 {d.replacement.item||"Replacement"}{d.replacement.qty?` × ${d.replacement.qty}`:""}${replAmt>0?` · −${inr(replAmt)}`:""}</p>
                            {d.replacement.reason&&<p style={{color:t.sub,fontSize:10,marginTop:2}}>{d.replacement.reason}</p>}
                          </div>}
                          {canSeePrices&&<div style={{display:"flex",gap:6,flexWrap:"wrap",fontSize:11,marginBottom:8}}>
                            <span style={{background:t.inp,borderRadius:6,padding:"3px 8px",color:t.text}}>Order: <b>{inr(tot)}</b></span>
                            {replAmt>0&&<span style={{background:"#f9731615",borderRadius:6,padding:"3px 8px",color:"#f97316"}}>Net: <b>{inr(netAmt)}</b></span>}
                            <span style={{background:"#10b98115",borderRadius:6,padding:"3px 8px",color:"#10b981"}}>Paid: <b>{inr(paid)}</b></span>
                            <span style={{background:remaining>0?"#f59e0b15":"#10b98115",borderRadius:6,padding:"3px 8px",color:remaining>0?"#f59e0b":"#10b981"}}>Due: <b>{inr(remaining)}</b></span>
                          </div>}
                          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                            <button onClick={e=>{e.stopPropagation();const _dm=d.date>today()?"future":d.date<today()?"past":"today";setDf({...d,orderLines:{...safeO(d.orderLines)},replacement:d.replacement||{done:false,item:"",reason:"",qty:""},_dateMode:_dm,_futureOrder:_dm==="future"});setDsh(d);}} style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:600,cursor:"pointer",minHeight:36,WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>✏️ Edit</button>
                            <button onClick={e=>{e.stopPropagation();exportPDF(d,products,"delivery",settings);}} style={{background:"#7c3aed",color:"#fff",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:36,WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>📄 PDF</button>
                            {can("deliv_dispatch")&&d.status==="Pending"&&<button onClick={e=>{e.stopPropagation();setDeliv(p=>p.map(x=>x.id===d.id?{...x,status:"In Transit"}:x));addLog("Dispatched",d.customer);notify("Marked In Transit");captureGPS("marked_transit",d.customer);}} style={{background:"#f59e0b",color:"#000",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:36,WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>🚚 Dispatch</button>}
                            {can("deliv_markDone")&&d.status!=="Delivered"&&<button onClick={e=>{e.stopPropagation();setDeliv(p=>p.map(x=>x.id===d.id?{...x,status:"Delivered"}:x));addLog("Status changed",d.customer+" → Delivered");notify("Marked Delivered");}} style={{background:"#10b981",color:"#fff",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer",minHeight:36,WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>✓ Done</button>}
                          </div>
                        </div>;
                      })}
                    </div>
                    {/* Bulk mark today done */}
                    {isAdmin&&can("deliv_markDone")&&calExpandedDay===todayStr&&(()=>{
                      const pendingToday2=expandedDelivs.filter(d=>d.status==="Pending");
                      if(pendingToday2.length===0) return null;
                      return <button onClick={()=>{
                        setDeliv(p=>p.map(d=>d.date===todayStr&&d.status==="Pending"?{...d,status:"Delivered",deliveryDate:todayStr}:d));
                        addLog("Bulk delivered",`All pending on ${todayStr} (${pendingToday2.length})`);
                        notify(`${pendingToday2.length} deliveries marked done ✓`);
                        captureGPS("marked_delivered",`Bulk day (${todayStr})`);
                      }} style={{background:"#10b98120",color:"#10b981",border:"1px solid #10b98140",borderRadius:10,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer",width:"100%",marginTop:10,WebkitTapHighlightColor:"transparent"}}>
                        ✓ Mark all {pendingToday2.length} pending as Delivered
                      </button>;
                    })()}
                  </div>;
                })()}
              </div>
            </Card>;
          })()}

          {fDeliv.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-6">No deliveries found.{delivStatusFilter!=="all"?` (filter: ${delivStatusFilter})`:""}</p>}

          {/* ── CUSTOMER-GROUPED DELIVERY VIEW ── */}
          {!delivCalendar&&(()=>{
            // Group filtered deliveries by customer
            const custMap={};
            [...fDeliv].sort((a,b)=>b.date.localeCompare(a.date)).forEach(d=>{
              const key=d.customerId||d.customer;
              if(!custMap[key]) custMap[key]={name:d.customer,customerId:d.customerId,delivs:[]};
              custMap[key].delivs.push(d);
            });
            const custGroups=Object.values(custMap).sort((a,b)=>a.name.localeCompare(b.name));
            return <div className="flex flex-col gap-3">
              {custGroups.map(group=>{
                const isExpanded=expandedDeliveryCust===group.customerId||expandedDeliveryCust===group.name;
                const totalOrders=group.delivs.length;
                const totalAmt=group.delivs.reduce((s,d)=>s+lineTotal(d.orderLines),0);
                const totalRepl=group.delivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
                const totalCollected=group.delivs.reduce((s,d)=>s+(d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0),0);
                const totalBalance=Math.max(0,totalAmt-totalRepl-totalCollected);
                const pendingCount=group.delivs.filter(d=>d.status==="Pending").length;
                const deliveredCount=group.delivs.filter(d=>d.status==="Delivered").length;
                const replCount=group.delivs.filter(d=>d.replacement?.done).length;
                return <Card key={group.customerId||group.name} dm={dm}>
                  {/* ── CUSTOMER HEADER ROW (always visible) ── */}
                  <div onClick={()=>setExpandedDeliveryCust(isExpanded?null:(group.customerId||group.name))}
                    style={{padding:"14px 16px",cursor:"pointer",userSelect:"none"}}
                    className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div style={{width:40,height:40,borderRadius:12,background:dm?"rgba(245,158,11,0.15)":"rgba(245,158,11,0.1)",color:"#f59e0b",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:16,flexShrink:0}}>
                        {group.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p style={{color:t.text,fontWeight:800,fontSize:15}} className="truncate">{group.name}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          <span style={{color:t.sub,fontSize:11}}>{totalOrders} order{totalOrders!==1?"s":""}</span>
                          {deliveredCount>0&&<span style={{color:"#10b981",fontSize:11,fontWeight:600}}>✓ {deliveredCount} delivered</span>}
                          {pendingCount>0&&<span style={{color:"#f59e0b",fontSize:11,fontWeight:600}}>⏳ {pendingCount} pending</span>}
                          {replCount>0&&<span style={{color:"#f97316",fontSize:11,fontWeight:600}}>🔄 {replCount} replaced</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        {canSeePrices&&<p style={{color:"#f59e0b",fontWeight:900,fontSize:14}}>{inr(totalAmt)}</p>}
                        {canSeePrices&&totalBalance>0&&<p style={{color:"#ef4444",fontSize:10,fontWeight:700}}>Due: {inr(totalBalance)}</p>}
                        {canSeePrices&&totalBalance===0&&totalAmt>0&&<p style={{color:"#10b981",fontSize:10,fontWeight:700}}>✓ All clear</p>}
                      </div>
                      <span style={{color:t.sub,fontSize:18,fontWeight:300,transition:"transform 0.2s",transform:isExpanded?"rotate(180deg)":"none",display:"inline-block"}}>⌃</span>
                    </div>
                  </div>

                  {/* ── EXPANDED: per-delivery list ── */}
                  {isExpanded&&<div style={{borderTop:`1px solid ${t.border}`}}>
                    {/* Customer summary strip */}
                    {canSeePrices&&<div style={{background:dm?"rgba(0,0,0,0.2)":"rgba(245,158,11,0.04)",padding:"10px 16px",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,borderBottom:`1px solid ${t.border}`}}>
                      {[
                        {l:"Total Billed",v:inr(totalAmt),c:"#f59e0b"},
                        {l:"Replacements",v:totalRepl>0?`−${inr(totalRepl)}`:"None",c:totalRepl>0?"#f97316":t.sub},
                        {l:"Collected",v:inr(totalCollected),c:"#10b981"},
                        {l:"Balance Due",v:inr(totalBalance),c:totalBalance>0?"#ef4444":"#10b981"},
                      ].map(x=><div key={x.l} style={{textAlign:"center"}}>
                        <p style={{color:x.c,fontWeight:800,fontSize:13}}>{x.v}</p>
                        <p style={{color:t.sub,fontSize:9,textTransform:"uppercase",letterSpacing:"0.06em",marginTop:2}}>{x.l}</p>
                      </div>)}
                    </div>}

                    {/* Each delivery */}
                    {group.delivs.map((d,di)=>{
                      const rows=lineRows(d.orderLines,products);
                      const tot=lineTotal(d.orderLines);
                      const replAmt=+d.replacement?.amount||0;
                      const netAmt=Math.max(0,tot-replAmt);
                      const collected=d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0;
                      const balanceDue=Math.max(0,netAmt-collected);
                      const sc=d.status==="Delivered"?"#10b981":d.status==="In Transit"?"#0ea5e9":d.status==="Cancelled"?"#ef4444":"#f59e0b";
                      const invNo=(invRegistry?.issued||{})[d.id]||d.invNo||null;
                      const rcptNo=invNo?`RCP-${invNo.replace(/^[A-Z]+-/,"")}`:`RCP-${(d.id||"").slice(-6).toUpperCase()}`;
                      const isBulkChecked=bulkSelected.has(d.id);
                      // Batch info if any production record on same date
                      const batchesOnDate=prodTargets.filter(pt=>pt.date===d.date);
                      return <div key={d.id} style={{
                        borderTop:di>0?`1px solid ${t.border}`:"none",
                        background:isBulkChecked?(dm?"rgba(245,158,11,0.12)":"rgba(245,158,11,0.06)"):undefined,
                        borderLeft:`4px solid ${sc}`,
                        padding:"14px 16px",
                      }}>
                        {/* Delivery header */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-start gap-2 min-w-0">
                            {bulkSelect&&<button onClick={()=>{const s=new Set(bulkSelected);if(s.has(d.id))s.delete(d.id);else s.add(d.id);setBulkSelected(s);}} style={{width:22,height:22,borderRadius:6,border:`2px solid ${isBulkChecked?"#f59e0b":t.inpB}`,background:isBulkChecked?"#f59e0b":t.inp,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2,cursor:"pointer"}}>
                              {isBulkChecked&&<span style={{color:"#000",fontSize:12,fontWeight:900,lineHeight:1}}>✓</span>}
                            </button>}
                            <div>
                              <div className="flex flex-wrap gap-2 items-center mb-1">
                                <span style={{color:t.text,fontWeight:700,fontSize:13}}>📅 {d.date}</span>
                                {d.deliveryDate&&d.deliveryDate!==d.date&&<span style={{color:t.sub,fontSize:11}}>→ deliver by {d.deliveryDate}</span>}
                                <button onClick={()=>tglD(d)} style={{background:`${sc}20`,color:sc,border:`1px solid ${sc}40`,borderRadius:8,padding:"2px 10px",fontSize:10,fontWeight:800,cursor:"pointer"}}>{d.status}</button>
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                <span style={{color:t.sub,fontSize:10}}>👤 {d.createdBy||d.agent||"—"}</span>
                                {invNo&&<span style={{color:"#8b5cf6",fontSize:10,fontWeight:700,fontFamily:"monospace",background:dm?"rgba(139,92,246,0.15)":"rgba(139,92,246,0.08)",borderRadius:4,padding:"1px 6px"}}>📄 {invNo}</span>}
                                {invNo&&<span style={{color:"#0ea5e9",fontSize:10,fontWeight:700,fontFamily:"monospace",background:dm?"rgba(14,165,233,0.15)":"rgba(14,165,233,0.08)",borderRadius:4,padding:"1px 6px"}}>🧾 {rcptNo}</span>}
                                {batchesOnDate.length>0&&<span style={{color:"#7c3aed",fontSize:10,fontWeight:700,background:dm?"rgba(124,58,237,0.12)":"rgba(124,58,237,0.07)",borderRadius:4,padding:"1px 6px"}}>🏭 {batchesOnDate.map(b=>b.batchLabel||"Batch").join(", ")}</span>}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Items ordered */}
                        {rows.length>0&&<div style={{background:t.inp,borderRadius:10,padding:"8px 12px",marginBottom:10}}>
                          <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Items Ordered</p>
                          {rows.map(r=>(
                            <div key={r.id} className="flex justify-between items-center" style={{paddingBottom:4,marginBottom:4,borderBottom:`1px solid ${t.border}`}}>
                              <span style={{color:t.text,fontSize:12}}>{r.qty} × <b>{r.name}</b>{canSeePrices?<span style={{color:t.sub}}> @ {inr(r.priceAmount)}</span>:""}</span>
                              {canSeePrices&&<span style={{color:t.text,fontWeight:700,fontSize:12}}>{inr(r.qty*r.priceAmount)}</span>}
                            </div>
                          ))}
                          {canSeePrices&&tot>0&&<div className="flex justify-between" style={{paddingTop:4,fontWeight:800,fontSize:13}}>
                            <span style={{color:t.sub}}>Order Total</span>
                            <span style={{color:"#f59e0b"}}>{inr(tot)}</span>
                          </div>}
                        </div>}

                        {/* Replacement block */}
                        {d.replacement?.done&&<div style={{background:"#f9731618",border:"1px solid #f9731640",borderRadius:10,padding:"8px 12px",marginBottom:10}}>
                          <p style={{color:"#f97316",fontWeight:800,fontSize:11,marginBottom:4}}>🔄 Replacement Made</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {d.replacement.item&&<span style={{color:t.text,fontSize:11}}>Item: <b>{d.replacement.item}</b></span>}
                            {d.replacement.qty&&<span style={{color:t.text,fontSize:11}}>Qty returned: <b>{d.replacement.qty}</b></span>}
                            {canSeePrices&&replAmt>0&&<span style={{color:"#f97316",fontWeight:700,fontSize:11}}>Deducted: −{inr(replAmt)}</span>}
                            {d.replacement.reason&&<span style={{color:t.sub,fontSize:11,fontStyle:"italic"}}>Reason: {d.replacement.reason}</span>}
                          </div>
                        </div>}

                        {/* Payment summary — proper stacked breakdown */}
                        {canSeePrices&&tot>0&&<div style={{background:t.inp,borderRadius:12,overflow:"hidden",marginBottom:10}}>
                          <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",padding:"8px 12px 0"}}>Payment Summary</p>
                          <div style={{padding:"6px 12px 10px",display:"flex",flexDirection:"column",gap:5}}>
                            {/* Order total row */}
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12}}>
                              <span style={{color:t.sub}}>Order total</span>
                              <span style={{color:t.text,fontWeight:700}}>{inr(tot)}</span>
                            </div>
                            {/* Replacement deduction row */}
                            {replAmt>0&&<>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12}}>
                                <span style={{color:"#f97316"}}>🔄 Replacement deducted{d.replacement?.item?` — ${d.replacement.item}${d.replacement.qty?" ×"+d.replacement.qty:""}`:""}</span>
                                <span style={{color:"#f97316",fontWeight:700}}>−{inr(replAmt)}</span>
                              </div>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12,paddingTop:3,borderTop:`1px dashed ${t.border}`}}>
                                <span style={{color:t.sub,fontWeight:600}}>Net payable</span>
                                <span style={{color:t.text,fontWeight:800}}>{inr(netAmt)}</span>
                              </div>
                            </>}
                            {/* Collected row */}
                            {collected>0&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12}}>
                              <span style={{color:"#10b981"}}>💰 Collected</span>
                              <span style={{color:"#10b981",fontWeight:700}}>−{inr(collected)}</span>
                            </div>}
                            {/* Balance due — always shown */}
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,fontWeight:800,paddingTop:5,marginTop:2,borderTop:`2px solid ${t.border}`}}>
                              <span style={{color:balanceDue===0?"#10b981":"#ef4444"}}>{balanceDue===0?"✓ Fully settled":"Balance due"}</span>
                              <span style={{color:balanceDue===0?"#10b981":"#ef4444",background:balanceDue===0?"#10b98118":"#ef444418",borderRadius:8,padding:"2px 10px"}}>{balanceDue===0?"—":inr(balanceDue)}</span>
                            </div>
                          </div>
                        </div>}

                        {d.notes&&<p style={{color:t.sub,fontSize:11,fontStyle:"italic",marginBottom:8}}>📝 "{d.notes}"</p>}

                        {/* Action buttons */}
                        <div className="flex gap-2 overflow-x-auto pb-0.5" style={{WebkitOverflowScrolling:"touch",scrollbarWidth:"none",msOverflowStyle:"none",flexWrap:"nowrap"}}>
                          {d.address&&<a href={mapU(d.address,d.lat,d.lng)} target="_blank" rel="noopener noreferrer" style={{background:"#0ea5e9",color:"#fff",minHeight:40,padding:"0 12px",borderRadius:10,fontSize:12,fontWeight:700,display:"inline-flex",alignItems:"center",gap:5,WebkitTapHighlightColor:"transparent",textDecoration:"none",flexShrink:0}}>📍 Nav</a>}
                          <button onClick={()=>{const _dm=d.date>today()?"future":d.date<today()?"past":"today";setDf({...d,orderLines:{...safeO(d.orderLines)},replacement:d.replacement||{done:false,item:"",reason:"",qty:""},_dateMode:_dm,_futureOrder:_dm==="future"});setDsh(d);}} style={{background:t.inp,color:t.text,border:`1.5px solid ${t.border}`,minHeight:40,padding:"0 12px",borderRadius:10,fontSize:12,fontWeight:600,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"inline-flex",alignItems:"center",cursor:"pointer",flexShrink:0}}>Edit</button>
                          <button onClick={()=>exportPDF(d,products,"delivery",settings)} style={{background:"#7c3aed",color:"#fff",minHeight:40,padding:"0 12px",borderRadius:10,fontSize:12,fontWeight:700,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"inline-flex",alignItems:"center",cursor:"pointer",flexShrink:0}}>PDF</button>
                          {(isAdmin||(sess?.role==="agent"&&(settings?.receiptVisibleTo||["agent"]).includes("agent"))||(sess?.role==="factory"&&(settings?.receiptVisibleTo||["agent"]).includes("factory")))&&settings?.agentInvoiceEnabled!==false&&<button onClick={()=>setLastReceiptData({delivery:d,amt:d.partialPayment?.amount||0,note:d.partialPayment?.note||"",customer:d.customer,ts:d.partialPayment?.collectedAt||d.date,viewOnly:true})} style={{background:"#0ea5e9",color:"#fff",minHeight:40,padding:"0 12px",borderRadius:10,fontSize:12,fontWeight:700,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"inline-flex",alignItems:"center",gap:5,cursor:"pointer",flexShrink:0}}>🧾 Receipt</button>}
                          {isAdmin&&<button onClick={()=>exportDeliveryInvoice(d,products,settings,getOrCreateInvNo(d.id))} style={{background:"#7c3aed",color:"#fff",minHeight:40,padding:"0 12px",borderRadius:10,fontSize:12,fontWeight:700,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"inline-flex",alignItems:"center",gap:5,cursor:"pointer",flexShrink:0}}>📄 Invoice</button>}
                          <button onClick={()=>shareWhatsApp(d,products,"delivery",settings)} style={{background:"#25D366",color:"#fff",minHeight:40,padding:"0 12px",borderRadius:10,fontSize:12,fontWeight:700,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"inline-flex",alignItems:"center",gap:5,cursor:"pointer",flexShrink:0}}>WA</button>
                          {can("deliv_dispatch")&&d.status==="Pending"&&<button onClick={()=>{setDeliv(p=>p.map(x=>x.id===d.id?{...x,status:"In Transit"}:x));addLog("Dispatched",d.customer);notify("Marked In Transit");captureGPS("marked_transit",d.customer);}} style={{background:"#f59e0b",color:"#000",minHeight:40,padding:"0 12px",borderRadius:10,fontSize:12,fontWeight:700,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"inline-flex",alignItems:"center",gap:5,cursor:"pointer",flexShrink:0}}>🚚 Dispatch</button>}
                          {can("deliv_markDone")&&d.status!=="Delivered"&&<button onClick={()=>{setDeliv(p=>p.map(x=>x.id===d.id?{...x,status:"Delivered"}:x));addLog("Status changed",d.customer+" → Delivered");notify("Marked Delivered");}} style={{background:"#10b981",color:"#fff",minHeight:40,padding:"0 12px",borderRadius:10,fontSize:12,fontWeight:700,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"inline-flex",alignItems:"center",gap:5,cursor:"pointer",flexShrink:0}}>✓ Done</button>}
                          {(can("cust_markPaid")||can("deliv_markDone"))&&(settings?.agentCollectEnabled!==false)&&d.status!=="Cancelled"&&(!d.partialPayment?.enabled||!d.partialPayment?.amount)&&<button onClick={()=>{setCollectSh(d);const _replAmt=+d.replacement?.amount||0;const _net=Math.max(0,lineTotal(d.orderLines)-_replAmt);setCollectAmt(String(_net>0?_net:lineTotal(d.orderLines)));setCollectNote("");}} style={{background:"#10b981",color:"#fff",minHeight:40,padding:"0 12px",borderRadius:10,fontSize:12,fontWeight:700,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"inline-flex",alignItems:"center",gap:5,cursor:"pointer",flexShrink:0}}>💰 Collect</button>}
                          {can("deliv_delete")&&<button onClick={()=>delD(d)} style={{background:"#dc2626",color:"#fff",minHeight:40,padding:"0 12px",borderRadius:10,fontSize:12,fontWeight:700,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"inline-flex",alignItems:"center",cursor:"pointer",flexShrink:0}}>Delete</button>}
                        </div>
                      </div>;
                    })}
                  </div>}
                </Card>;
              })}
            </div>;
          })()}
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
              {can("sup_export")&&<Btn dm={dm} v="outline" size="sm" onClick={()=>exportTabPDF("Supplies",supplies,[{label:"Item",key:"item"},{label:"Qty",key:"qty",num:true},{label:"Unit",key:"unit"},{label:"Supplier",key:"supplier"},{label:"Cost (₹)",key:"cost",num:true},{label:"Date",key:"date"},{label:"Notes",key:"notes"}],settings)}>📄 PDF</Btn>}
              {can("sup_export")&&<Btn dm={dm} v="outline" size="sm" onClick={()=>exportTabExcel("Supplies",supplies,[{label:"Item",key:"item"},{label:"Qty",key:"qty",num:true},{label:"Unit",key:"unit"},{label:"Supplier",key:"supplier"},{label:"Cost",key:"cost",num:true},{label:"Min Stock",key:"minStock"},{label:"Date",key:"date"},{label:"Notes",key:"notes"}],settings)}>📊 XLS</Btn>}
              {can("sup_export")&& <Btn dm={dm} v="outline" size="sm" onClick={()=>exportCSV(supplies,"supplies",[{label:"Item",key:"item"},{label:"Qty",key:"qty"},{label:"Unit",key:"unit"},{label:"Supplier",key:"supplier"},{label:"Cost",key:"cost"},{label:"Date",key:"date"},{label:"Notes",key:"notes"}])}>CSV</Btn>}
              <Btn dm={dm} size="sm" onClick={()=>{setSf(blkS());setSsh("add");}}>+ Supply</Btn>
            </div>
          </div>
          <Search dm={dm} value={srch} onChange={setSrch} placeholder="Search item, supplier, date…"/>
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
                  <div className="flex gap-2 justify-end mt-2">
                    <button onClick={()=>{setSf({...s});setSsh(s);}} style={{background:t.inp,color:t.text,border:`1.5px solid ${t.border}`,minHeight:44,padding:"0 16px",borderRadius:12,fontSize:13,fontWeight:600,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"inline-flex",alignItems:"center",cursor:"pointer"}}>Edit</button>
                    {can("sup_delete")&&<button onClick={()=>delS(s)} style={{background:"#dc2626",color:"#fff",minHeight:44,padding:"0 16px",borderRadius:12,fontSize:13,fontWeight:700,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"inline-flex",alignItems:"center",cursor:"pointer"}}>Delete</button>}
                  </div>
                </div>
              </div>
            </div></Card>
          ))}
        </>)}

        {/* EXPENSES */}
        {tab==="Expenses"&&isAdmin&&(()=>{
          // ── derived filter values ──
          const expCats=(settings?.expenseCategories||["Gas","Labour","Transport","Packaging","Utilities","Maintenance","Other"]);
          const totalWasteCost=(wastage||[]).reduce((a,w)=>a+(w.cost||0),0);
          // date range for expense filters
          const getExpDateRange=()=>{
            const t2=today();
            if(expDateFilter==="today")return{from:t2,to:t2};
            if(expDateFilter==="week"){const d=new Date();d.setDate(d.getDate()-6);return{from:d.toISOString().slice(0,10),to:t2};}
            if(expDateFilter==="month"){return{from:t2.slice(0,7)+"-01",to:t2};}
            if(expDateFilter==="custom")return{from:expCustomFrom||"2000-01-01",to:expCustomTo||t2};
            return{from:"2000-01-01",to:t2};
          };
          const {from:eFr,to:eTo}=getExpDateRange();
          const filteredExp=expenses.filter(e=>{
            const inDate=e.date>=eFr&&e.date<=eTo;
            const inCat=expCatFilter==="all"||e.category===expCatFilter;
            const q=expSearch.toLowerCase();
            const inSearch=!q||(e.category||"").toLowerCase().includes(q)||(e.notes||"").toLowerCase().includes(q)||(e.vendor||"").toLowerCase().includes(q)||(e.receipt||"").toLowerCase().includes(q)||(e.approvedBy||"").toLowerCase().includes(q)||(e.tags||"").toLowerCase().includes(q);
            return inDate&&inCat&&inSearch;
          }).sort((a,b)=>b.date.localeCompare(a.date));
          const filtExpTotal=filteredExp.reduce((s,e)=>s+(e.amount||0),0);

          // ── cat breakdown for filtered ──
          const catBreakdown=expCats.map(cat=>({cat,total:filteredExp.filter(e=>e.category===cat).reduce((s,e)=>s+(e.amount||0),0),count:filteredExp.filter(e=>e.category===cat).length})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
          const maxCatVal=catBreakdown[0]?.total||1;

          // ── vendor breakdown ──
          const vendorMap={};
          filteredExp.forEach(e=>{if(e.vendor){vendorMap[e.vendor]=(vendorMap[e.vendor]||0)+(e.amount||0);}});
          const vendorBreakdown=Object.entries(vendorMap).sort((a,b)=>b[1]-a[1]);

          // ── payment method breakdown ──
          const pmMap={};
          filteredExp.forEach(e=>{const pm=e.paymentMethod||"Cash";pmMap[pm]=(pmMap[pm]||0)+(e.amount||0);});

          // ── revenue drill-down ──
          const delivByMonth={};
          deliveries.filter(d=>d.status==="Delivered").forEach(d=>{const m=d.date?.slice(0,7)||"";delivByMonth[m]=(delivByMonth[m]||0)+lineTotal(d.orderLines);});

          // ── supply cost by category ──
          const supCatMap={};
          supplies.forEach(s=>{const cat=s.category||s.item||"Other";supCatMap[cat]=(supCatMap[cat]||0)+(s.cost||0);});
          const supCatBreak=Object.entries(supCatMap).sort((a,b)=>b[1]-a[1]).slice(0,8);

          // ── daily snapshots from Firebase ──
          const savedSnaps=Object.values(finSnapshots||{}).sort((a,b)=>b.date?.localeCompare(a.date||"")||0);

          const PALETTE=["#ef4444","#f97316","#f59e0b","#10b981","#0ea5e9","#8b5cf6","#ec4899"];

          return(<>
          {/* ── KPI row ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard dm={dm} label="Operating Expenses" value={inr(totalExpOp)} sub={`${expenses.length} entries`} accent="#ef4444"/>
            <StatCard dm={dm} label="Supply Costs" value={inr(totalSupC)} sub="Raw materials" accent="#8b5cf6"/>
            <StatCard dm={dm} label="Total Revenue" value={inr(totalRev)} sub="From delivered orders" accent="#10b981"/>
            <StatCard dm={dm} label="Net Profit" value={inr(netProfit)} sub={netProfit>=0?"Profitable ✓":"In loss ⚠️"} accent={netProfit>=0?"#10b981":"#ef4444"}/>
          </div>

          {/* ── PAPER TRAIL ── */}
          {(()=>{
            const totalWC=(wastage||[]).reduce((s,w)=>s+(w.cost||0),0);
            const totalReplDed=deliveries.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
            const grossRev=deliveries.filter(d=>d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0);
            const totalCost=totalExpOp+totalSupC+totalWC;
            const PT_SECTIONS=[
              {key:"revenue",label:"💰 Revenue",color:"#10b981",value:totalRev},
              {key:"supply",label:"📦 Supply",color:"#8b5cf6",value:totalSupC},
              {key:"expenses",label:"💸 Expenses",color:"#ef4444",value:totalExpOp},
              {key:"wastage",label:"🗑️ Wastage",color:"#f97316",value:totalWC},
              {key:"netprofit",label:"📈 Net P&L",color:netProfit>=0?"#10b981":"#ef4444",value:netProfit},
            ];
            // per-section detail rows
            const revenueRows=deliveries.filter(d=>d.status==="Delivered").sort((a,b)=>b.date.localeCompare(a.date));
            const supplyRows=[...supplies].sort((a,b)=>b.date?.localeCompare(a.date||""));
            const expenseRows=[...expenses].sort((a,b)=>b.date?.localeCompare(a.date||""));
            const wastageRows=[...(wastage||[])].sort((a,b)=>b.date?.localeCompare(a.date||""));
            // monthly breakdown for net profit
            const months=[...new Set([
              ...deliveries.map(d=>d.date?.slice(0,7)),
              ...supplies.map(s=>s.date?.slice(0,7)),
              ...expenses.map(e=>e.date?.slice(0,7)),
            ].filter(Boolean))].sort((a,b)=>b.localeCompare(a));
            return(
            <Card dm={dm}><div className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2" style={{cursor:"pointer"}} onClick={()=>setExpPTOpen(p=>!p)}>
                <div className="flex items-center gap-2">
                  <span style={{color:t.text,fontWeight:800,fontSize:14}}>📋 Financial Paper Trail</span>
                  {!expPTOpen&&<span style={{background:"#3b82f620",color:"#3b82f6",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>tap to expand</span>}
                </div>
                <div className="flex items-center gap-2" onClick={e=>e.stopPropagation()}>
                  {expPTOpen&&<>
                    <button onClick={()=>exportPnLReport({co:settings?.companyName||"Company",periodLabel:"All Time",mData:months.map(m=>({month:m.slice(5)+"/"+m.slice(2,4),monthFull:new Date(m+"-01").toLocaleString("en-IN",{month:"short",year:"numeric"}),revenue:deliveries.filter(d=>d.date?.startsWith(m)&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines)-(+d.replacement?.amount||0),0),supplyCost:supplies.filter(s=>s.date?.startsWith(m)).reduce((s,x)=>s+(x.cost||0),0),expenses:expenses.filter(e=>e.date?.startsWith(m)).reduce((s,e)=>s+(e.amount||0),0),wasteCost:(wastage||[]).filter(w=>w.date?.startsWith(m)).reduce((s,w)=>s+(w.cost||0),0),replDeducted:deliveries.filter(d=>d.date?.startsWith(m)&&d.status==="Delivered").reduce((s,d)=>s+(+d.replacement?.amount||0),0),deliveriesCount:deliveries.filter(d=>d.date?.startsWith(m)&&d.status==="Delivered").length})).map(m=>({...m,totalCost:m.supplyCost+m.expenses+m.wasteCost,profit:m.revenue-m.supplyCost-m.expenses-m.wasteCost,margin:m.revenue>0?Math.round((m.revenue-m.supplyCost-m.expenses-m.wasteCost)/m.revenue*100):0,grossMargin:m.revenue>0?Math.round((m.revenue-m.supplyCost)/m.revenue*100):0})),totRev:totalRev,totSupC:totalSupC,totExpC:totalExpOp,totWasteC:totalWC,totCost:totalCost,totProfit:netProfit,totMargin:totalRev>0?Math.round(netProfit/totalRev*100):0,totReplDeducted:totalReplDed,collectionRate:customers.reduce((s,c)=>s+(c.paid||0),0)+customers.reduce((s,c)=>s+(c.pending||0),0)>0?Math.round(customers.reduce((s,c)=>s+(c.paid||0),0)/(customers.reduce((s,c)=>s+(c.paid||0),0)+customers.reduce((s,c)=>s+(c.pending||0),0))*100):100,totDue:customers.reduce((s,c)=>s+(c.pending||0),0),totCollected:customers.reduce((s,c)=>s+(c.paid||0),0),avgMonthlyRev:0,avgMonthlyProfit:0,burnRate:0,healthScore:0,healthLabel:"",healthColor:"#10b981",insights:[],filtD:deliveries.filter(d=>d.status==="Delivered"),filtS:supplies,filtE:expenses,filtW:wastage||[],customers,deliveries,expenses,supplies,wastage,products,lineTotal,inr,today_fn:today,settings})} style={{background:"#3b82f620",color:"#3b82f6",border:"1.5px solid #3b82f640",borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>📄 Full Report</button>
                    <button onClick={()=>exportPnLCSV({mData:months.map(m=>({month:m.slice(5)+"/"+m.slice(2,4),monthFull:new Date(m+"-01").toLocaleString("en-IN",{month:"short",year:"numeric"}),revenue:deliveries.filter(d=>d.date?.startsWith(m)&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines)-(+d.replacement?.amount||0),0),supplyCost:supplies.filter(s=>s.date?.startsWith(m)).reduce((s,x)=>s+(x.cost||0),0),expenses:expenses.filter(e=>e.date?.startsWith(m)).reduce((s,e)=>s+(e.amount||0),0),wasteCost:(wastage||[]).filter(w=>w.date?.startsWith(m)).reduce((s,w)=>s+(w.cost||0),0),replDeducted:deliveries.filter(d=>d.date?.startsWith(m)&&d.status==="Delivered").reduce((s,d)=>s+(+d.replacement?.amount||0),0),deliveriesCount:deliveries.filter(d=>d.date?.startsWith(m)&&d.status==="Delivered").length})).map(m=>({...m,totalCost:m.supplyCost+m.expenses+m.wasteCost,profit:m.revenue-m.supplyCost-m.expenses-m.wasteCost,margin:m.revenue>0?Math.round((m.revenue-m.supplyCost-m.expenses-m.wasteCost)/m.revenue*100):0})),filtD:deliveries.filter(d=>d.status==="Delivered"),filtE:expenses,filtS:supplies,filtW:wastage||[],customers,deliveries,expenses,supplies,wastage,products,lineTotal,today_fn:today,periodLabel:"All Time"})} style={{background:"#10b98120",color:"#10b981",border:"1.5px solid #10b98140",borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>📊 CSV</button>
                  </>}
                  <span style={{color:t.sub,fontSize:16,transition:"transform 0.2s",display:"inline-block",transform:expPTOpen?"rotate(180deg)":"rotate(0deg)"}}>⌄</span>
                </div>
              </div>

              {/* Summary strip — always visible */}
              <div className="grid grid-cols-5 gap-1.5 mb-0" style={{marginBottom:expPTOpen?12:0}}>
                {PT_SECTIONS.map(s=>(
                  <button key={s.key} onClick={()=>{setExpPTSection(s.key);if(!expPTOpen)setExpPTOpen(true);}} style={{background:expPTOpen&&expPTSection===s.key?s.color+"22":t.inp,border:`1.5px solid ${expPTOpen&&expPTSection===s.key?s.color:t.border}`,borderRadius:10,padding:"8px 4px",textAlign:"center",cursor:"pointer",transition:"all .15s"}}>
                    <p style={{color:s.color,fontSize:11,fontWeight:800,lineHeight:1.2}}>{inr(Math.abs(s.value))}{s.key==="netprofit"&&netProfit<0?"▼":""}  </p>
                    <p style={{color:t.sub,fontSize:9,marginTop:2,fontWeight:600}}>{s.label}</p>
                  </button>
                ))}
              </div>

              {/* Expanded detail panel */}
              {expPTOpen&&<>
                <div style={{height:1,background:t.border,margin:"12px 0"}}/>

                {/* ── REVENUE detail ── */}
                {expPTSection==="revenue"&&<>
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-1">
                    <div>
                      <span style={{color:t.text,fontWeight:700,fontSize:12}}>💰 Revenue Paper Trail — All Delivered Orders</span>
                      <p style={{color:t.sub,fontSize:10,marginTop:2}}>{revenueRows.length} orders · sorted newest first</p>
                    </div>
                    <span style={{color:"#10b981",fontWeight:900,fontSize:14}}>{inr(totalRev)}</span>
                  </div>
                  {/* Summary pills */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {[
                      {l:"GROSS REVENUE",v:inr(grossRev),c:"#10b981",bg:"#10b98118",bc:"#10b98140"},
                      {l:"REPLACEMENTS DEDUCTED",v:`-${inr(totalReplDed)}`,c:"#f97316",bg:"#f9731618",bc:"#f9731640"},
                      {l:"NET REVENUE",v:inr(totalRev),c:"#10b981",bg:"#10b98118",bc:"#10b98140"},
                      {l:"DELIVERED ORDERS",v:revenueRows.length,c:"#3b82f6",bg:"#3b82f618",bc:"#3b82f640"},
                      {l:"AVG PER ORDER",v:inr(revenueRows.length>0?Math.round(totalRev/revenueRows.length):0),c:"#8b5cf6",bg:"#8b5cf618",bc:"#8b5cf640"},
                    ].map(x=>(
                      <div key={x.l} style={{background:x.bg,border:`1px solid ${x.bc}`,borderRadius:8,padding:"6px 10px"}}>
                        <p style={{color:t.sub,fontSize:9,fontWeight:700}}>{x.l}</p>
                        <p style={{color:x.c,fontWeight:900,fontSize:12}}>{x.v}</p>
                      </div>
                    ))}
                  </div>
                  {/* Ledger table */}
                  <div style={{border:`1px solid ${t.border}`,borderRadius:10,overflow:"hidden"}}>
                    <div style={{background:t.inp,padding:"7px 12px",display:"grid",gridTemplateColumns:"28px 1fr 80px 70px 75px 75px",gap:6}}>
                      <span style={{color:t.sub,fontSize:9,fontWeight:700}}>#</span>
                      <span style={{color:t.sub,fontSize:10,fontWeight:700}}>CUSTOMER / DATE / LOGGED BY</span>
                      <span style={{color:t.sub,fontSize:10,fontWeight:700,textAlign:"right"}}>GROSS</span>
                      <span style={{color:t.sub,fontSize:10,fontWeight:700,textAlign:"right"}}>REPL.</span>
                      <span style={{color:t.sub,fontSize:10,fontWeight:700,textAlign:"right"}}>NET</span>
                      <span style={{color:t.sub,fontSize:10,fontWeight:700,textAlign:"right"}}>RUNNING</span>
                    </div>
                    <div style={{maxHeight:360,overflowY:"auto"}}>
                      {(()=>{
                        let running=0;
                        return revenueRows.map((d,i)=>{
                          const gross=lineTotal(d.orderLines);
                          const repl=+d.replacement?.amount||0;
                          const net=gross-repl;
                          running+=net;
                          return(
                          <div key={d.id||i} onClick={()=>setDetailModal({type:"delivery",data:d})} onMouseEnter={ev=>{ev.currentTarget.style.background=dm?"#ffffff08":"#00000006";}} onMouseLeave={ev=>{ev.currentTarget.style.background=i%2===0?"transparent":t.inp+"88";}} style={{padding:"8px 12px",display:"grid",gridTemplateColumns:"28px 1fr 80px 70px 75px 75px",gap:6,borderTop:i>0?`1px solid ${t.border}`:"none",background:i%2===0?"transparent":t.inp+"88",cursor:"pointer",transition:"background .12s"}}>
                            <span style={{color:t.sub,fontSize:9,fontWeight:600,paddingTop:2}}>#{revenueRows.length-i}</span>
                            <div>
                              <p style={{color:t.text,fontSize:12,fontWeight:700,lineHeight:1.2,textDecoration:"underline"}} onClick={ev=>{ev.stopPropagation();const c=customers.find(cx=>cx.id===d.customerId);if(c)setDetailModal({type:"customer",data:c});}}>{d.customer}</p>
                              <p style={{color:t.sub,fontSize:10}}><span style={{textDecoration:"underline",cursor:"pointer"}} onClick={ev=>{ev.stopPropagation();setDetailModal({type:"date",data:{date:d.date}});}}>📅 {d.date}</span>{d.createdBy?<span style={{textDecoration:"underline",cursor:"pointer",marginLeft:4}} onClick={ev=>{ev.stopPropagation();setDetailModal({type:"agent",data:{name:d.createdBy}});}}> · 👤 {d.createdBy}</span>:""}</p>
                              {d.replacement?.reason&&<p style={{color:"#f97316",fontSize:9,fontStyle:"italic",marginTop:1}}>↩ {d.replacement.reason}</p>}
                              {d.orderLines&&Object.values(d.orderLines).filter(l=>l.qty>0).length>0&&(
                                <p style={{color:t.sub,fontSize:9,marginTop:1}}>{Object.values(d.orderLines).filter(l=>l.qty>0).map(l=>`${l.qty}×${l.name||""}`).join(", ")}</p>
                              )}
                            </div>
                            <p style={{color:"#10b981",fontSize:11,fontWeight:700,textAlign:"right"}}>{inr(gross)}</p>
                            <p style={{color:repl>0?"#f97316":t.sub,fontSize:11,fontWeight:repl>0?700:400,textAlign:"right"}}>{repl>0?`-${inr(repl)}`:"—"}</p>
                            <p style={{color:"#10b981",fontSize:12,fontWeight:800,textAlign:"right"}}>{inr(net)}</p>
                            <p style={{color:"#3b82f6",fontSize:11,fontWeight:700,textAlign:"right"}}>{inr(running)}</p>
                          </div>);
                        });
                      })()}
                      {revenueRows.length===0&&<p style={{color:t.sub,fontSize:12,textAlign:"center",padding:16}}>No delivered orders yet.</p>}
                    </div>
                    <div style={{background:t.inp,padding:"8px 12px",display:"grid",gridTemplateColumns:"28px 1fr 80px 70px 75px 75px",gap:6,borderTop:`2px solid ${t.border}`}}>
                      <span/>
                      <span style={{color:t.text,fontSize:12,fontWeight:800}}>TOTAL · {revenueRows.length} orders</span>
                      <span style={{color:"#10b981",fontSize:12,fontWeight:800,textAlign:"right"}}>{inr(grossRev)}</span>
                      <span style={{color:"#f97316",fontSize:12,fontWeight:800,textAlign:"right"}}>{totalReplDed>0?`-${inr(totalReplDed)}`:"—"}</span>
                      <span style={{color:"#10b981",fontSize:13,fontWeight:900,textAlign:"right"}}>{inr(totalRev)}</span>
                      <span style={{color:"#3b82f6",fontSize:13,fontWeight:900,textAlign:"right"}}>{inr(totalRev)}</span>
                    </div>
                  </div>
                </>}

                {/* ── SUPPLY detail ── */}
                {expPTSection==="supply"&&<>
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-1">
                    <div>
                      <span style={{color:t.text,fontWeight:700,fontSize:12}}>📦 Supply Cost Paper Trail</span>
                      <p style={{color:t.sub,fontSize:10,marginTop:2}}>{supplyRows.length} entries · sorted newest first</p>
                    </div>
                    <span style={{color:"#8b5cf6",fontWeight:900,fontSize:14}}>{inr(totalSupC)}</span>
                  </div>
                  {/* By category summary */}
                  {supCatBreak.length>0&&<div className="flex flex-wrap gap-1.5 mb-3">
                    {supCatBreak.map(([cat,val])=>(
                      <div key={cat} style={{background:"#8b5cf618",border:"1px solid #8b5cf640",borderRadius:8,padding:"5px 9px"}}>
                        <p style={{color:t.sub,fontSize:9,fontWeight:700}}>{cat.toUpperCase()}</p>
                        <p style={{color:"#8b5cf6",fontWeight:800,fontSize:11}}>{inr(val)}</p>
                        <p style={{color:t.sub,fontSize:9}}>{totalSupC>0?Math.round(val/totalSupC*100):0}% of total</p>
                      </div>
                    ))}
                  </div>}
                  <div style={{border:`1px solid ${t.border}`,borderRadius:10,overflow:"hidden"}}>
                    <div style={{background:t.inp,padding:"7px 12px",display:"grid",gridTemplateColumns:"28px 1fr 80px 70px 75px",gap:6}}>
                      <span style={{color:t.sub,fontSize:9,fontWeight:700}}>#</span>
                      <span style={{color:t.sub,fontSize:10,fontWeight:700}}>ITEM / SUPPLIER / DATE</span>
                      <span style={{color:t.sub,fontSize:10,fontWeight:700}}>CATEGORY</span>
                      <span style={{color:t.sub,fontSize:10,fontWeight:700,textAlign:"right"}}>COST</span>
                      <span style={{color:t.sub,fontSize:10,fontWeight:700,textAlign:"right"}}>RUNNING</span>
                    </div>
                    <div style={{maxHeight:360,overflowY:"auto"}}>
                      {(()=>{
                        let running=0;
                        return supplyRows.map((s,i)=>{
                          running+=(s.cost||0);
                          return(
                          <div key={s.id||i} style={{padding:"8px 12px",display:"grid",gridTemplateColumns:"28px 1fr 80px 70px 75px",gap:6,borderTop:i>0?`1px solid ${t.border}`:"none",background:i%2===0?"transparent":t.inp+"88"}}>
                            <span style={{color:t.sub,fontSize:9,fontWeight:600,paddingTop:2}}>#{supplyRows.length-i}</span>
                            <div>
                              <p style={{color:t.text,fontSize:12,fontWeight:600,lineHeight:1.2}}>{s.item||s.name||"—"}</p>
                              <p style={{color:t.sub,fontSize:10}}>📅 {s.date}{s.supplier?` · 🏪 ${s.supplier}`:""}</p>
                              {s.qty&&<p style={{color:t.sub,fontSize:10}}>📦 {s.qty} {s.unit||""}</p>}
                              {s.notes&&<p style={{color:t.sub,fontSize:10,fontStyle:"italic",marginTop:1}}>{s.notes}</p>}
                            </div>
                            <span style={{color:t.sub,fontSize:11,paddingTop:2}}>{s.category||"—"}</span>
                            <span style={{color:"#8b5cf6",fontSize:12,fontWeight:800,textAlign:"right"}}>{inr(s.cost||0)}</span>
                            <span style={{color:"#3b82f6",fontSize:11,fontWeight:700,textAlign:"right"}}>{inr(running)}</span>
                          </div>);
                        });
                      })()}
                      {supplyRows.length===0&&<p style={{color:t.sub,fontSize:12,textAlign:"center",padding:16}}>No supply records yet.</p>}
                    </div>
                    <div style={{background:t.inp,padding:"8px 12px",display:"grid",gridTemplateColumns:"28px 1fr 80px 70px 75px",gap:6,borderTop:`2px solid ${t.border}`}}>
                      <span/>
                      <span style={{color:t.text,fontSize:12,fontWeight:800}}>TOTAL · {supplyRows.length} entries</span>
                      <span/>
                      <span style={{color:"#8b5cf6",fontSize:13,fontWeight:900,textAlign:"right"}}>{inr(totalSupC)}</span>
                      <span style={{color:"#3b82f6",fontSize:13,fontWeight:900,textAlign:"right"}}>{inr(totalSupC)}</span>
                    </div>
                  </div>
                </>}

                {/* ── EXPENSES detail ── */}
                {expPTSection==="expenses"&&<>
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-1">
                    <div>
                      <span style={{color:t.text,fontWeight:700,fontSize:12}}>💸 Operating Expenses Paper Trail</span>
                      <p style={{color:t.sub,fontSize:10,marginTop:2}}>{expenseRows.length} entries · sorted newest first</p>
                    </div>
                    <span style={{color:"#ef4444",fontWeight:900,fontSize:14}}>{inr(totalExpOp)}</span>
                  </div>
                  {/* Category summary */}
                  {catBreakdown.length>0&&<div className="flex flex-wrap gap-1.5 mb-3">
                    {catBreakdown.map((c,i)=>(
                      <div key={c.cat} style={{background:"#ef444418",border:"1px solid #ef444440",borderRadius:8,padding:"5px 9px"}}>
                        <p style={{color:t.sub,fontSize:9,fontWeight:700}}>{c.cat.toUpperCase()} · {c.count} entries</p>
                        <p style={{color:"#ef4444",fontWeight:800,fontSize:11}}>{inr(c.total)}</p>
                        <p style={{color:t.sub,fontSize:9}}>{totalExpOp>0?Math.round(c.total/totalExpOp*100):0}% of total</p>
                      </div>
                    ))}
                  </div>}
                  <div style={{border:`1px solid ${t.border}`,borderRadius:10,overflow:"hidden"}}>
                    <div style={{background:t.inp,padding:"7px 12px",display:"grid",gridTemplateColumns:"28px 1fr 70px 70px 75px",gap:6}}>
                      <span style={{color:t.sub,fontSize:9,fontWeight:700}}>#</span>
                      <span style={{color:t.sub,fontSize:10,fontWeight:700}}>CATEGORY / VENDOR / DATE</span>
                      <span style={{color:t.sub,fontSize:10,fontWeight:700}}>PAYMENT</span>
                      <span style={{color:t.sub,fontSize:10,fontWeight:700,textAlign:"right"}}>AMOUNT</span>
                      <span style={{color:t.sub,fontSize:10,fontWeight:700,textAlign:"right"}}>RUNNING</span>
                    </div>
                    <div style={{maxHeight:360,overflowY:"auto"}}>
                      {(()=>{
                        let running=0;
                        return expenseRows.map((e,i)=>{
                          running+=(e.amount||0);
                          return(
                          <div key={e.id||i} onClick={()=>setDetailModal({type:"expense",data:e})} onMouseEnter={ev=>{ev.currentTarget.style.background=dm?"#ffffff08":"#00000006";ev.currentTarget.style.cursor="pointer";}} onMouseLeave={ev=>{ev.currentTarget.style.background=i%2===0?"transparent":t.inp+"88";}} style={{padding:"8px 12px",display:"grid",gridTemplateColumns:"28px 1fr 70px 70px 75px",gap:6,borderTop:i>0?`1px solid ${t.border}`:"none",background:i%2===0?"transparent":t.inp+"88",cursor:"pointer",transition:"background .12s"}}>
                            <span style={{color:t.sub,fontSize:9,fontWeight:600,paddingTop:2}}>#{expenseRows.length-i}</span>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span style={{background:"#ef444420",color:"#ef4444",borderRadius:5,padding:"1px 6px",fontSize:9,fontWeight:700}}>{e.category}</span>
                                {e.tags&&e.tags.split(",").map(tg=>tg.trim()).filter(Boolean).map(tg=><span key={tg} style={{background:"#8b5cf620",color:"#8b5cf6",borderRadius:5,padding:"1px 5px",fontSize:9,fontWeight:600}}>{tg}</span>)}
                                {e.approvedBy&&<span style={{background:"#10b98120",color:"#10b981",borderRadius:5,padding:"1px 5px",fontSize:9,fontWeight:600,cursor:"pointer"}} onClick={ev=>{ev.stopPropagation();setDetailModal({type:"agent",data:{name:e.approvedBy}});}}>✅ {e.approvedBy}</span>}
                              </div>
                              <p style={{color:t.sub,fontSize:10,marginTop:2}} onClick={ev=>{ev.stopPropagation();setDetailModal({type:"date",data:{date:e.date}});}}>📅 <span style={{textDecoration:"underline",cursor:"pointer"}}>{e.date}</span>{e.vendor?` · 🏪 ${e.vendor}`:""}</p>
                              {e.notes&&<p style={{color:t.sub,fontSize:10,fontStyle:"italic",marginTop:1}}>{e.notes}</p>}
                              {e.receipt&&<p style={{color:t.sub,fontSize:9,marginTop:1}}>🧾 {e.receipt}</p>}
                            </div>
                            <span style={{color:t.sub,fontSize:10,alignSelf:"center"}}>{e.paymentMethod||"Cash"}</span>
                            <span style={{color:"#ef4444",fontSize:12,fontWeight:800,textAlign:"right",alignSelf:"center"}}>{inr(e.amount||0)}</span>
                            <span style={{color:"#3b82f6",fontSize:11,fontWeight:700,textAlign:"right",alignSelf:"center"}}>{inr(running)}</span>
                          </div>);
                        });
                      })()}
                      {expenseRows.length===0&&<p style={{color:t.sub,fontSize:12,textAlign:"center",padding:16}}>No expenses recorded yet.</p>}
                    </div>
                    <div style={{background:t.inp,padding:"8px 12px",display:"grid",gridTemplateColumns:"28px 1fr 70px 70px 75px",gap:6,borderTop:`2px solid ${t.border}`}}>
                      <span/>
                      <span style={{color:t.text,fontSize:12,fontWeight:800}}>TOTAL · {expenseRows.length} entries</span>
                      <span/>
                      <span style={{color:"#ef4444",fontSize:13,fontWeight:900,textAlign:"right"}}>{inr(totalExpOp)}</span>
                      <span style={{color:"#3b82f6",fontSize:13,fontWeight:900,textAlign:"right"}}>{inr(totalExpOp)}</span>
                    </div>
                  </div>
                </>}

                {/* ── WASTAGE detail ── */}
                {expPTSection==="wastage"&&<>
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-1">
                    <span style={{color:t.text,fontWeight:700,fontSize:12}}>🗑️ Wastage Loss Breakdown</span>
                    <span style={{color:"#f97316",fontWeight:800,fontSize:13}}>{inr(totalWC)}</span>
                  </div>
                  <div style={{border:`1px solid ${t.border}`,borderRadius:10,overflow:"hidden"}}>
                    <div style={{background:t.inp,padding:"7px 12px",display:"grid",gridTemplateColumns:"1fr 60px 60px 70px",gap:8}}>
                      <span style={{color:t.sub,fontSize:10,fontWeight:700}}>PRODUCT / DATE</span>
                      <span style={{color:t.sub,fontSize:10,fontWeight:700}}>TYPE</span>
                      <span style={{color:t.sub,fontSize:10,fontWeight:700,textAlign:"right"}}>QTY</span>
                      <span style={{color:t.sub,fontSize:10,fontWeight:700,textAlign:"right"}}>COST</span>
                    </div>
                    <div style={{maxHeight:320,overflowY:"auto"}}>
                      {wastageRows.map((w,i)=>(
                        <div key={w.id||i} style={{padding:"8px 12px",display:"grid",gridTemplateColumns:"1fr 60px 60px 70px",gap:8,borderTop:i>0?`1px solid ${t.border}`:"none",background:i%2===0?"transparent":t.inp+"88"}}>
                          <div>
                            <p style={{color:t.text,fontSize:12,fontWeight:600}}>{w.product}</p>
                            <p style={{color:t.sub,fontSize:10}}>📅 {w.date}{w.loggedBy?` · ${w.loggedBy}`:""}</p>
                            {w.reason&&<p style={{color:t.sub,fontSize:10,fontStyle:"italic"}}>{w.reason}</p>}
                          </div>
                          <span style={{color:t.sub,fontSize:11,alignSelf:"center"}}>{w.type||"—"}</span>
                          <span style={{color:"#f97316",fontSize:12,fontWeight:700,textAlign:"right",alignSelf:"center"}}>{w.qty||0} {w.unit||""}</span>
                          <span style={{color:"#f97316",fontSize:12,fontWeight:800,textAlign:"right",alignSelf:"center"}}>{inr(w.cost||0)}</span>
                        </div>
                      ))}
                      {wastageRows.length===0&&<p style={{color:t.sub,fontSize:12,textAlign:"center",padding:16}}>No wastage records yet.</p>}
                    </div>
                    <div style={{background:t.inp,padding:"8px 12px",display:"grid",gridTemplateColumns:"1fr 60px 60px 70px",gap:8,borderTop:`2px solid ${t.border}`}}>
                      <span style={{color:t.text,fontSize:12,fontWeight:800}}>TOTAL · {wastageRows.length} entries</span>
                      <span/><span/>
                      <span style={{color:"#f97316",fontSize:13,fontWeight:900,textAlign:"right"}}>{inr(totalWC)}</span>
                    </div>
                  </div>
                </>}

                {/* ── NET PROFIT monthly drill-down ── */}
                {expPTSection==="netprofit"&&<>
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-1">
                    <span style={{color:t.text,fontWeight:700,fontSize:12}}>📈 Net Profit / Loss — Monthly Ledger</span>
                    <span style={{color:netProfit>=0?"#10b981":"#ef4444",fontWeight:800,fontSize:13}}>{inr(netProfit)}</span>
                  </div>
                  {/* Running total summary */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {[
                      {l:"Total Revenue",v:totalRev,c:"#10b981"},
                      {l:"Supply Costs",v:totalSupC,c:"#8b5cf6"},
                      {l:"Op. Expenses",v:totalExpOp,c:"#ef4444"},
                      {l:"Wastage Loss",v:totalWC,c:"#f97316"},
                      {l:"Total Costs",v:totalCost,c:"#dc2626"},
                      {l:"Net Profit",v:netProfit,c:netProfit>=0?"#10b981":"#ef4444"},
                    ].map(x=>(
                      <div key={x.l} style={{background:x.c+"18",border:`1px solid ${x.c}40`,borderRadius:8,padding:"6px 10px",minWidth:80}}>
                        <p style={{color:t.sub,fontSize:9,fontWeight:700}}>{x.l.toUpperCase()}</p>
                        <p style={{color:x.c,fontWeight:900,fontSize:12}}>{inr(x.v)}</p>
                      </div>
                    ))}
                  </div>
                  {/* Monthly table */}
                  <div style={{border:`1px solid ${t.border}`,borderRadius:10,overflow:"hidden"}}>
                    <div style={{background:t.inp,padding:"7px 12px",display:"grid",gridTemplateColumns:"60px 1fr 70px 70px 70px 70px",gap:6}}>
                      <span style={{color:t.sub,fontSize:10,fontWeight:700}}>MONTH</span>
                      <span style={{color:t.sub,fontSize:10,fontWeight:700}}>REVENUE</span>
                      <span style={{color:t.sub,fontSize:10,fontWeight:700,textAlign:"right"}}>SUPPLY</span>
                      <span style={{color:t.sub,fontSize:10,fontWeight:700,textAlign:"right"}}>EXPENSE</span>
                      <span style={{color:t.sub,fontSize:10,fontWeight:700,textAlign:"right"}}>WASTE</span>
                      <span style={{color:t.sub,fontSize:10,fontWeight:700,textAlign:"right"}}>NET P&L</span>
                    </div>
                    <div style={{maxHeight:360,overflowY:"auto"}}>
                      {(()=>{
                        return months.map((m,i)=>{
                          const mRev=deliveries.filter(d=>d.date?.startsWith(m)&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines)-(+d.replacement?.amount||0),0);
                          const mSup=supplies.filter(s=>s.date?.startsWith(m)).reduce((s,x)=>s+(x.cost||0),0);
                          const mExp=expenses.filter(e=>e.date?.startsWith(m)).reduce((s,e)=>s+(e.amount||0),0);
                          const mWaste=(wastage||[]).filter(w=>w.date?.startsWith(m)).reduce((s,w)=>s+(w.cost||0),0);
                          const mNet=mRev-mSup-mExp-mWaste;
                          const mLabel=new Date(m+"-01").toLocaleString("en-IN",{month:"short",year:"2-digit"});
                          return(
                          <div key={m} style={{padding:"8px 12px",display:"grid",gridTemplateColumns:"60px 1fr 70px 70px 70px 70px",gap:6,borderTop:i>0?`1px solid ${t.border}`:"none",background:i%2===0?"transparent":t.inp+"88"}}>
                            <span style={{color:t.text,fontSize:11,fontWeight:700}}>{mLabel}</span>
                            <span style={{color:"#10b981",fontSize:11,fontWeight:700}}>{inr(mRev)}</span>
                            <span style={{color:"#8b5cf6",fontSize:11,fontWeight:600,textAlign:"right"}}>{inr(mSup)}</span>
                            <span style={{color:"#ef4444",fontSize:11,fontWeight:600,textAlign:"right"}}>{inr(mExp)}</span>
                            <span style={{color:"#f97316",fontSize:11,fontWeight:600,textAlign:"right"}}>{inr(mWaste)}</span>
                            <div style={{textAlign:"right"}}>
                              <p style={{color:mNet>=0?"#10b981":"#ef4444",fontSize:11,fontWeight:900}}>{inr(mNet)}</p>
                              <p style={{color:t.sub,fontSize:9}}>{totalRev>0?Math.round(mNet/totalRev*100):0}%</p>
                            </div>
                          </div>);
                        });
                      })()}
                    </div>
                    <div style={{background:t.inp,padding:"8px 12px",display:"grid",gridTemplateColumns:"60px 1fr 70px 70px 70px 70px",gap:6,borderTop:`2px solid ${t.border}`}}>
                      <span style={{color:t.text,fontSize:11,fontWeight:800}}>ALL</span>
                      <span style={{color:"#10b981",fontSize:11,fontWeight:900}}>{inr(totalRev)}</span>
                      <span style={{color:"#8b5cf6",fontSize:11,fontWeight:800,textAlign:"right"}}>{inr(totalSupC)}</span>
                      <span style={{color:"#ef4444",fontSize:11,fontWeight:800,textAlign:"right"}}>{inr(totalExpOp)}</span>
                      <span style={{color:"#f97316",fontSize:11,fontWeight:800,textAlign:"right"}}>{inr(totalWC)}</span>
                      <span style={{color:netProfit>=0?"#10b981":"#ef4444",fontSize:12,fontWeight:900,textAlign:"right"}}>{inr(netProfit)}</span>
                    </div>
                  </div>
                </>}
              </>}
            </div></Card>
            );
          })()}

          {/* ── Financial Overview section tabs — hover/click to reveal ── */}
          <Card dm={dm}><div className="p-4">
            {/* Section header — click or hover to toggle */}
            <div
              className="flex items-center justify-between flex-wrap gap-2"
              style={{cursor:"pointer",userSelect:"none"}}
              onClick={()=>setFinOvOpen(p=>!p)}
              onMouseEnter={()=>setFinOvHover(true)}
              onMouseLeave={()=>setFinOvHover(false)}
            >
              <div className="flex items-center gap-2">
                <p style={{color:t.text}} className="font-bold text-sm">📊 Financial Overview</p>
                {!finOvOpen&&<span style={{background:"#3b82f620",color:"#3b82f6",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{inr(netProfit)} net · tap to expand</span>}
              </div>
              <div className="flex items-center gap-2">
                {finOvOpen&&<div className="flex gap-1 flex-wrap" onClick={e=>e.stopPropagation()}>
                  {[["overview","All"],["revenue","Revenue"],["supply","Supply"],["ops","Expenses"],["wastage","Wastage"],["daily","Daily"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setFinView(v)} style={{background:finView===v?"#3b82f6":t.inp,color:finView===v?"#fff":t.sub,border:`1.5px solid ${finView===v?"#3b82f6":t.border}`,padding:"4px 10px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer"}}>{l}</button>
                  ))}
                </div>}
                <span style={{color:t.sub,fontSize:16,lineHeight:1,transition:"transform 0.2s",display:"inline-block",transform:finOvOpen?"rotate(180deg)":"rotate(0deg)"}}>⌄</span>
              </div>
            </div>
            {/* Hover preview bar — shows when closed but hovered */}
            {!finOvOpen&&finOvHover&&<div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                {l:"Revenue",v:totalRev,c:"#10b981"},
                {l:"Supply",v:totalSupC,c:"#8b5cf6"},
                {l:"Expenses",v:totalExpOp,c:"#ef4444"},
                {l:"Net Profit",v:netProfit,c:netProfit>=0?"#10b981":"#ef4444"},
              ].map(x=><div key={x.l} style={{background:t.inp,borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
                <p className="font-black text-xs" style={{color:x.c}}>{inr(x.v)}</p>
                <p style={{color:t.sub}} className="text-[9px] mt-0.5">{x.l}</p>
              </div>)}
            </div>}
            {/* Full expanded content */}
            {finOvOpen&&<><div className="mt-4">

            {/* ── ALL OVERVIEW ── */}
            {finView==="overview"&&(()=>{
              const cashCollectedFO=customers.reduce((a,c)=>a+(c.paid||0),0);
              const cashPendingFO=customers.reduce((a,c)=>a+(c.pending||0),0);
              const totalWC2=(wastage||[]).reduce((s,w)=>s+(w.cost||0),0);
              const ovRows=[
                {l:"Total Revenue",v:totalRev,c:"#10b981",icon:"💰",pct:null,tab:"revenue",sub:`${deliveries.filter(d=>d.status==="Delivered").length} delivered orders`},
                {l:"Supply Costs",v:totalSupC,c:"#8b5cf6",icon:"📦",pct:totalRev>0?Math.round(totalSupC/totalRev*100):0,tab:"supply",sub:`${supplies.length} supply entries`},
                {l:"Operating Expenses",v:totalExpOp,c:"#ef4444",icon:"💸",pct:totalRev>0?Math.round(totalExpOp/totalRev*100):0,tab:"ops",sub:`${expenses.length} expense entries`},
                {l:"Wastage Losses",v:totalWC2,c:"#f97316",icon:"🗑️",pct:totalRev>0?Math.round(totalWC2/totalRev*100):0,tab:"wastage",sub:`${(wastage||[]).length} wastage records`},
                {l:"Net Profit / Loss",v:netProfit,c:netProfit>=0?"#10b981":"#ef4444",icon:"📈",pct:totalRev>0?Math.round(netProfit/totalRev*100):0,tab:null,sub:netProfit>=0?"Business profitable ✓":"In loss — review costs ⚠️"},
              ];
              return(<>
              {/* Summary tiles row */}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
                {ovRows.map(x=>(
                  <div key={x.l} onClick={x.tab?()=>setFinView(x.tab):undefined}
                    onMouseEnter={ev=>{if(x.tab)ev.currentTarget.style.transform="scale(1.03)";}}
                    onMouseLeave={ev=>{ev.currentTarget.style.transform="scale(1)";}}
                    style={{background:x.c+"12",border:`1.5px solid ${x.c}30`,borderRadius:14,padding:"10px 10px",textAlign:"center",cursor:x.tab?"pointer":"default",transition:"all .15s"}}>
                    <span style={{fontSize:18}}>{x.icon}</span>
                    <p style={{color:x.c,fontWeight:900,fontSize:13,marginTop:4}}>{inr(Math.abs(x.v))}</p>
                    {x.pct!==null&&<p style={{color:t.sub,fontSize:9}}>{x.pct}%</p>}
                    <p style={{color:t.sub,fontSize:9,marginTop:2,fontWeight:600}}>{x.l}</p>
                    {x.tab&&<p style={{color:x.c,fontSize:8,marginTop:2}}>tap to drill →</p>}
                  </div>
                ))}
              </div>
              {/* Detailed rows */}
              {ovRows.map((x,i)=>(
                <div key={x.l} onClick={x.tab?()=>setFinView(x.tab):undefined}
                  onMouseEnter={ev=>{if(x.tab){ev.currentTarget.style.background=x.c+"08";}}}
                  onMouseLeave={ev=>{ev.currentTarget.style.background="transparent";}}
                  style={{borderBottom:i<ovRows.length-1?`1px solid ${t.border}`:"none",cursor:x.tab?"pointer":"default",borderRadius:8,padding:"4px",transition:"background .15s"}}>
                  <div className="flex justify-between items-center py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{x.icon}</span>
                      <div>
                        <span style={{color:t.text}} className="text-sm font-semibold">{x.l}</span>
                        <p style={{color:t.sub,fontSize:10}}>{x.sub}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {x.pct!==null&&<span style={{color:t.sub,minWidth:30,textAlign:"right"}} className="text-[11px] font-mono">{x.pct}%</span>}
                      <span className="font-black text-sm" style={{color:x.c,minWidth:90,textAlign:"right"}}>{inr(x.v)}</span>
                      {x.tab&&<span style={{color:t.sub,fontSize:11}}>›</span>}
                    </div>
                  </div>
                  {x.pct!==null&&totalRev>0&&<div style={{background:t.border,height:4,borderRadius:4,overflow:"hidden",marginBottom:4}}><div style={{width:`${Math.min(x.pct,100)}%`,background:x.c,height:"100%",borderRadius:4,transition:"width .5s"}}/></div>}
                </div>
              ))}
              {/* Cash flow quick tile */}
              <div style={{borderTop:`1px solid ${t.border}`,marginTop:10,paddingTop:12}}>
                <div className="grid grid-cols-2 gap-2">
                  <div onClick={()=>setFinOvSubModal("cashflow")} onMouseEnter={ev=>{ev.currentTarget.style.transform="scale(1.02)";}} onMouseLeave={ev=>{ev.currentTarget.style.transform="scale(1)";}}
                    style={{background:"#10b98112",border:"1.5px solid #10b98130",borderRadius:12,padding:"10px 14px",cursor:"pointer",transition:"all .15s"}}>
                    <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase"}}>💵 Cash Flow</p>
                    <p style={{color:"#10b981",fontWeight:900,fontSize:14}}>{inr(cashCollectedFO)}</p>
                    <p style={{color:"#ef4444",fontSize:10}}>{inr(cashPendingFO)} pending · tap for detail</p>
                  </div>
                  <div onClick={()=>setFinOvSubModal("burnrate")} onMouseEnter={ev=>{ev.currentTarget.style.transform="scale(1.02)";}} onMouseLeave={ev=>{ev.currentTarget.style.transform="scale(1)";}}
                    style={{background:"#ef444412",border:"1.5px solid #ef444430",borderRadius:12,padding:"10px 14px",cursor:"pointer",transition:"all .15s"}}>
                    <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase"}}>🔥 Burn Rate</p>
                    {(()=>{
                      const mths=[...new Set([...deliveries.map(d=>d.date?.slice(0,7)),...expenses.map(e=>e.date?.slice(0,7)),...supplies.map(s=>s.date?.slice(0,7))].filter(Boolean))];
                      const br=mths.length>0?Math.round((totalExpOp+totalSupC)/mths.length):0;
                      const avgRev=mths.length>0?Math.round(totalRev/mths.length):0;
                      return(<><p style={{color:"#ef4444",fontWeight:900,fontSize:14}}>{inr(br)}/mo</p><p style={{color:t.sub,fontSize:10}}>vs {inr(avgRev)} avg rev · tap for detail</p></>);
                    })()}
                  </div>
                </div>
              </div>
              {/* Sub-modals */}
              {finOvSubModal&&(()=>{
                const cashC=customers.reduce((a,c)=>a+(c.paid||0),0);
                const cashP=customers.reduce((a,c)=>a+(c.pending||0),0);
                const mths2=[...new Set([...deliveries.map(d=>d.date?.slice(0,7)),...expenses.map(e=>e.date?.slice(0,7)),...supplies.map(s=>s.date?.slice(0,7))].filter(Boolean))];
                const br2=mths2.length>0?Math.round((totalExpOp+totalSupC)/mths2.length):0;
                const avgR=mths2.length>0?Math.round(totalRev/mths2.length):0;
                const cashPct=cashC+cashP>0?Math.round(cashC/(cashC+cashP)*100):100;
                return(
                <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:9988,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setFinOvSubModal(null)}>
                  <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:500,maxHeight:"75vh",overflowY:"auto",padding:20}} onClick={e=>e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-4">
                      <p style={{color:t.text,fontWeight:900,fontSize:15}}>{finOvSubModal==="cashflow"?"💵 Cash Flow Details":"🔥 Burn Rate & Efficiency"}</p>
                      <button onClick={()=>setFinOvSubModal(null)} style={{background:t.inp,border:`1px solid ${t.border}`,color:t.text,borderRadius:10,padding:"6px 14px",fontSize:13,fontWeight:700,cursor:"pointer"}}>✕</button>
                    </div>
                    {finOvSubModal==="cashflow"&&<>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        {[{l:"Total Collected",v:inr(cashC),c:"#10b981"},{l:"Total Pending",v:inr(cashP),c:"#ef4444"},{l:"Collection Rate",v:`${cashPct}%`,c:cashPct>=90?"#10b981":cashPct>=70?"#f59e0b":"#ef4444"},{l:"Total Customers",v:customers.length,c:"#3b82f6"}].map(x=>(
                          <div key={x.l} style={{background:t.inp,borderRadius:12,padding:"12px 14px"}}><p style={{color:x.c,fontWeight:900,fontSize:16}}>{x.v}</p><p style={{color:t.sub,fontSize:10,marginTop:2}}>{x.l}</p></div>
                        ))}
                      </div>
                      <div style={{height:10,borderRadius:10,overflow:"hidden",display:"flex",marginBottom:8}}>
                        <div style={{width:`${cashPct}%`,background:"#10b981"}}/>
                        <div style={{width:`${100-cashPct}%`,background:"#ef4444"}}/>
                      </div>
                      <div className="flex justify-between mb-4"><span style={{color:"#10b981",fontSize:11,fontWeight:700}}>{cashPct}% collected</span><span style={{color:"#ef4444",fontSize:11,fontWeight:700}}>{100-cashPct}% outstanding</span></div>
                      <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Top Outstanding</p>
                      {[...customers].filter(c=>c.pending>0).sort((a,b)=>(b.pending||0)-(a.pending||0)).slice(0,5).map(c=>(
                        <div key={c.id} className="flex justify-between items-center py-2" style={{borderBottom:`1px solid ${t.border}`}}>
                          <span style={{color:t.text,fontSize:12,fontWeight:600}}>{c.name}</span>
                          <span style={{color:"#ef4444",fontWeight:700,fontSize:12}}>{inr(c.pending)}</span>
                        </div>
                      ))}
                    </>}
                    {finOvSubModal==="burnrate"&&<>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        {[{l:"Monthly Burn",v:inr(br2),c:br2>avgR?"#ef4444":"#f59e0b"},{l:"Avg Monthly Rev",v:inr(avgR),c:"#10b981"},{l:"Monthly Surplus",v:inr(Math.max(0,avgR-br2)),c:avgR>br2?"#10b981":"#ef4444"},{l:"Net Margin",v:`${totalRev>0?Math.round(netProfit/totalRev*100):0}%`,c:netProfit>=0?"#10b981":"#ef4444"}].map(x=>(
                          <div key={x.l} style={{background:t.inp,borderRadius:12,padding:"12px 14px"}}><p style={{color:x.c,fontWeight:900,fontSize:16}}>{x.v}</p><p style={{color:t.sub,fontSize:10,marginTop:2}}>{x.l}</p></div>
                        ))}
                      </div>
                      <p style={{color:t.sub,fontSize:11,marginBottom:10}}>Burn rate is calculated as (expenses + supply costs) / active months ({mths2.length} months).</p>
                      <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Cost Breakdown</p>
                      {[["Operating Expenses","#ef4444",totalExpOp],["Supply Costs","#8b5cf6",totalSupC],["Wastage"," #f97316",(wastage||[]).reduce((s,w)=>s+(w.cost||0),0)]].map(([l,c,v])=>(
                        <div key={l} className="mb-2">
                          <div className="flex justify-between mb-1"><span style={{color:t.text,fontSize:11}}>{l}</span><span style={{color:c.trim(),fontWeight:700,fontSize:11}}>{inr(v)}</span></div>
                          <div style={{background:t.border,height:5,borderRadius:5,overflow:"hidden"}}><div style={{width:`${(totalExpOp+totalSupC)>0?Math.round(v/(totalExpOp+totalSupC)*100):0}%`,background:c.trim(),height:"100%",borderRadius:5}}/></div>
                        </div>
                      ))}
                    </>}
                  </div>
                </div>);
              })()}
              </>);
            })()}

            {/* ── REVENUE DRILL-DOWN ── */}
            {finView==="revenue"&&(()=>{
              const collected=customers.reduce((a,c)=>a+(c.paid||0),0);
              const allMonthRevs=Object.entries(delivByMonth).sort((a,b)=>b[0].localeCompare(a[0]));
              const maxMonthRev=Math.max(...Object.values(delivByMonth),1);
              const topCusts=[...customers].map(c=>{const cd=deliveries.filter(d=>d.customerId===c.id&&d.status==="Delivered");return{...c,rev:cd.reduce((s,d)=>s+lineTotal(d.orderLines),0),orders:cd.length};}).sort((a,b)=>b.rev-a.rev).slice(0,5);
              return(<>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <button onClick={()=>setFinView("overview")} style={{color:t.sub,fontSize:11,fontWeight:600}}>← Back</button>
                  <span style={{color:t.text}} className="text-sm font-bold">💰 Revenue Breakdown</span>
                </div>
                <span style={{color:"#10b981",fontWeight:900,fontSize:14}}>{inr(totalRev)}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {[
                  {l:"Collected",v:inr(collected),c:"#10b981",sub:"from customers"},
                  {l:"Pending",v:inr(totalDue),c:"#f59e0b",sub:"uncollected"},
                  {l:"Net Revenue",v:inr(totalRev),c:"#3b82f6",sub:"after adjustments"},
                  {l:"Avg/Delivery",v:inr(deliveries.filter(d=>d.status==="Delivered").length>0?Math.round(totalRev/deliveries.filter(d=>d.status==="Delivered").length):0),c:"#8b5cf6",sub:"per order"},
                ].map(x=><div key={x.l} style={{background:t.inp,borderRadius:12,padding:"10px 12px",textAlign:"center"}}>
                  <p className="font-black text-sm" style={{color:x.c}}>{x.v}</p>
                  <p style={{color:t.sub}} className="text-[10px] mt-0.5">{x.l}</p>
                  <p style={{color:t.sub,fontSize:9}}>{x.sub}</p>
                </div>)}
              </div>
              <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-2">Monthly Revenue — click to see deliveries</p>
              {allMonthRevs.slice(0,12).map(([m,v])=>{
                const mDelivs=deliveries.filter(d=>d.date?.startsWith(m)&&d.status==="Delivered");
                const pct=maxMonthRev>0?Math.round(v/maxMonthRev*100):0;
                const isEx=plMonthExpanded===("rev_"+m);
                return(<div key={m}>
                  <div onClick={()=>setPlMonthExpanded(isEx?null:"rev_"+m)}
                    onMouseEnter={ev=>{ev.currentTarget.style.background=t.inp+"88";}}
                    onMouseLeave={ev=>{ev.currentTarget.style.background="transparent";}}
                    style={{cursor:"pointer",borderRadius:8,padding:"8px 6px",transition:"background .15s"}}>
                    <div className="flex justify-between items-center mb-1">
                      <span style={{color:t.text,fontSize:12,fontWeight:600}}>{new Date(m+"-01").toLocaleString("en-IN",{month:"short",year:"2-digit"})}</span>
                      <div className="flex items-center gap-2">
                        <span style={{color:t.sub,fontSize:10}}>{mDelivs.length} orders</span>
                        <span style={{color:"#10b981",fontWeight:700,fontSize:12}}>{inr(v)}</span>
                        <span style={{color:t.sub,fontSize:10}}>{isEx?"▲":"▼"}</span>
                      </div>
                    </div>
                    <div style={{background:t.border,height:5,borderRadius:5,overflow:"hidden"}}><div style={{width:`${pct}%`,background:"#10b981",height:"100%",borderRadius:5}}/></div>
                  </div>
                  {isEx&&<div style={{background:t.inp+"66",borderRadius:10,padding:"10px 12px",marginBottom:4}}>
                    {mDelivs.length===0?<p style={{color:t.sub,fontSize:11}}>No deliveries this month.</p>
                    :mDelivs.sort((a,b)=>b.date.localeCompare(a.date)).map((d,di)=>(
                      <div key={d.id||di} className="flex justify-between items-start py-1.5" style={{borderBottom:di<mDelivs.length-1?`1px solid ${t.border}`:"none",cursor:"pointer"}}
                        onClick={()=>setDetailModal({type:"delivery",data:d})}
                        onMouseEnter={ev=>{ev.currentTarget.style.background=t.inp+"88";}} onMouseLeave={ev=>{ev.currentTarget.style.background="transparent";}}>
                        <div>
                          <p style={{color:t.text,fontSize:11,fontWeight:600,textDecoration:"underline"}}>{d.customer}</p>
                          <p style={{color:t.sub,fontSize:10}}>📅 <span style={{textDecoration:"underline",cursor:"pointer"}} onClick={ev=>{ev.stopPropagation();setDetailModal({type:"date",data:{date:d.date}});}}>{d.date}</span>{d.createdBy?<span style={{textDecoration:"underline",cursor:"pointer",marginLeft:4}} onClick={ev=>{ev.stopPropagation();setDetailModal({type:"agent",data:{name:d.createdBy}});}}> · {d.createdBy}</span>:""}</p>
                        </div>
                        <div className="text-right">
                          <p style={{color:"#10b981",fontWeight:700,fontSize:11}}>{inr(lineTotal(d.orderLines))}</p>
                          {(+d.replacement?.amount||0)>0&&<p style={{color:"#f97316",fontSize:9}}>-{inr(+d.replacement.amount)}</p>}
                        </div>
                      </div>
                    ))}
                  </div>}
                </div>);
              })}
              {allMonthRevs.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-4">No delivered orders yet.</p>}
              {topCusts.length>0&&<>
                <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",margin:"12px 0 8px"}}>Top Revenue Customers</p>
                {topCusts.map((c,ci)=>(
                  <div key={c.id} className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`,cursor:"pointer"}}
                    onClick={()=>setDetailModal({type:"customer",data:c})}
                    onMouseEnter={ev=>{ev.currentTarget.style.background=t.inp+"88";}} onMouseLeave={ev=>{ev.currentTarget.style.background="transparent";}}>
                    <div className="flex items-center gap-2">
                      <span style={{color:t.sub,fontSize:11,fontWeight:700,minWidth:18}}>#{ci+1}</span>
                      <div><p style={{color:t.text,fontSize:12,fontWeight:600,textDecoration:"underline"}}>{c.name}</p><p style={{color:t.sub,fontSize:10}}>{c.orders} deliveries · {inr(c.pending||0)} pending</p></div>
                    </div>
                    <span style={{color:"#10b981",fontWeight:700,fontSize:12}}>{inr(c.rev)}</span>
                  </div>
                ))}
              </>}
              </>);
            })()}

            {/* ── SUPPLY COST DRILL-DOWN ── */}
            {finView==="supply"&&(<>
              <div className="flex items-center gap-2 mb-3">
                <button onClick={()=>setFinView("overview")} style={{color:t.sub,fontSize:11,fontWeight:600}}>← Back</button>
                <span style={{color:t.text}} className="text-sm font-bold">Supply Cost Breakdown</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div style={{background:t.inp,borderRadius:12,padding:"10px 12px",textAlign:"center"}}><p className="font-black text-sm" style={{color:"#8b5cf6"}}>{inr(totalSupC)}</p><p style={{color:t.sub}} className="text-[10px] mt-0.5">Total Supply Cost</p></div>
                <div style={{background:t.inp,borderRadius:12,padding:"10px 12px",textAlign:"center"}}><p className="font-black text-sm" style={{color:"#8b5cf6"}}>{supplies.length}</p><p style={{color:t.sub}} className="text-[10px] mt-0.5">Supply Entries</p></div>
              </div>
              <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-2">By Item / Category</p>
              {supCatBreak.map(([cat,v],i)=>{
                const pct=totalSupC>0?Math.round(v/totalSupC*100):0;
                return(<div key={cat} className="mb-3">
                  <div className="flex justify-between items-center mb-1">
                    <span style={{color:t.text}} className="text-sm font-semibold">{cat}</span>
                    <div className="flex items-center gap-2"><span style={{color:t.sub}} className="text-[11px]">{pct}%</span><span style={{color:"#8b5cf6"}} className="font-bold text-sm">{inr(v)}</span></div>
                  </div>
                  <div style={{background:t.border,height:4,borderRadius:4,overflow:"hidden"}}><div style={{width:`${pct}%`,background:PALETTE[i%7],height:"100%",borderRadius:4}}/></div>
                </div>);
              })}
              {supCatBreak.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-4">No supplies recorded.</p>}
            </>)}

            {/* ── OPS EXPENSES DRILL-DOWN ── */}
            {finView==="ops"&&(<>
              <div className="flex items-center gap-2 mb-3">
                <button onClick={()=>setFinView("overview")} style={{color:t.sub,fontSize:11,fontWeight:600}}>← Back</button>
                <span style={{color:t.text}} className="text-sm font-bold">Operating Expenses Breakdown</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div style={{background:t.inp,borderRadius:12,padding:"10px 12px",textAlign:"center"}}><p className="font-black text-sm" style={{color:"#ef4444"}}>{inr(totalExpOp)}</p><p style={{color:t.sub}} className="text-[10px] mt-0.5">Total</p></div>
                <div style={{background:t.inp,borderRadius:12,padding:"10px 12px",textAlign:"center"}}><p className="font-black text-sm" style={{color:"#ef4444"}}>{expenses.length}</p><p style={{color:t.sub}} className="text-[10px] mt-0.5">Entries</p></div>
                <div style={{background:t.inp,borderRadius:12,padding:"10px 12px",textAlign:"center"}}><p className="font-black text-sm" style={{color:"#ef4444"}}>{totalRev>0?Math.round(totalExpOp/totalRev*100):0}%</p><p style={{color:t.sub}} className="text-[10px] mt-0.5">of Revenue</p></div>
              </div>
              <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-2">By Category</p>
              {expCats.map((cat,i)=>{
                const catTotal=expenses.filter(e=>e.category===cat).reduce((s,e)=>s+(e.amount||0),0);
                const catCount=expenses.filter(e=>e.category===cat).length;
                if(!catTotal)return null;
                const pct=totalExpOp>0?Math.round(catTotal/totalExpOp*100):0;
                return(<div key={cat} className="mb-3" style={{cursor:"pointer"}} onClick={()=>setDetailModal({type:"category",data:{cat,catExpenses:expenses.filter(e=>e.category===cat),catTotal}})}
                  onMouseEnter={ev=>{ev.currentTarget.style.opacity="0.85";}} onMouseLeave={ev=>{ev.currentTarget.style.opacity="1";}}>
                  <div className="flex justify-between items-center mb-1">
                    <span style={{color:t.text}} className="text-sm font-semibold">{cat} <span style={{color:"#3b82f6",fontSize:9,fontWeight:700}}>tap →</span></span>
                    <div className="flex items-center gap-2"><span style={{color:t.sub}} className="text-[11px]">{catCount} entries · {pct}%</span><span style={{color:"#ef4444"}} className="font-bold text-sm">{inr(catTotal)}</span></div>
                  </div>
                  <div style={{background:t.border,height:4,borderRadius:4,overflow:"hidden"}}><div style={{width:`${pct}%`,background:PALETTE[i%7],height:"100%",borderRadius:4}}/></div>
                </div>);
              })}
              {vendorBreakdown.length>0&&<><p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mt-4 mb-2">By Vendor</p>
              {vendorBreakdown.map(([vendor,v])=>(
                <div key={vendor} className="flex justify-between items-center py-2" style={{borderBottom:`1px solid ${t.border}`}}>
                  <span style={{color:t.text}} className="text-sm">{vendor}</span>
                  <span style={{color:"#ef4444"}} className="font-bold text-sm">{inr(v)}</span>
                </div>
              ))}</>}
              {Object.keys(pmMap).length>0&&<><p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mt-4 mb-2">By Payment Method</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(pmMap).map(([pm,v])=>(
                  <div key={pm} style={{background:t.inp,borderRadius:10,padding:"8px 12px"}}>
                    <p style={{color:t.text}} className="text-sm font-bold">{pm}</p>
                    <p style={{color:"#ef4444"}} className="text-xs font-semibold">{inr(v)}</p>
                  </div>
                ))}
              </div></>}
            </>)}

            {/* ── WASTAGE DRILL-DOWN ── */}
            {finView==="wastage"&&(<>
              <div className="flex items-center gap-2 mb-3">
                <button onClick={()=>setFinView("overview")} style={{color:t.sub,fontSize:11,fontWeight:600}}>← Back</button>
                <span style={{color:t.text}} className="text-sm font-bold">Wastage Loss Breakdown</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div style={{background:t.inp,borderRadius:12,padding:"10px 12px",textAlign:"center"}}><p className="font-black text-sm" style={{color:"#f97316"}}>{inr(totalWasteCost)}</p><p style={{color:t.sub}} className="text-[10px] mt-0.5">Total Loss</p></div>
                <div style={{background:t.inp,borderRadius:12,padding:"10px 12px",textAlign:"center"}}><p className="font-black text-sm" style={{color:"#f97316"}}>{(wastage||[]).length}</p><p style={{color:t.sub}} className="text-[10px] mt-0.5">Records</p></div>
              </div>
              <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider mb-2">By Product</p>
              {[...new Set((wastage||[]).map(w=>w.product))].map(p=>{
                const qty=(wastage||[]).filter(w=>w.product===p).reduce((s,w)=>s+(w.qty||0),0);
                const cost=(wastage||[]).filter(w=>w.product===p).reduce((s,w)=>s+(w.cost||0),0);
                return(<div key={p} className="flex justify-between items-center py-2" style={{borderBottom:`1px solid ${t.border}`}}>
                  <div><p style={{color:t.text}} className="text-sm font-semibold">{p}</p><p style={{color:t.sub}} className="text-[11px]">{qty} units wasted</p></div>
                  <span style={{color:"#f97316"}} className="font-bold text-sm">{inr(cost)}</span>
                </div>);
              })}
              {(wastage||[]).length===0&&<p style={{color:t.sub}} className="text-sm text-center py-4">No wastage recorded.</p>}
            </>)}

            {/* ── DAILY SNAPSHOTS ── */}
            {finView==="daily"&&(<>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button onClick={()=>setFinView("overview")} style={{color:t.sub,fontSize:11,fontWeight:600}}>← Back</button>
                  <span style={{color:t.text}} className="text-sm font-bold">Daily Financial Snapshots</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="date" value={finDailyDate} onChange={e=>setFinDailyDate(e.target.value)} style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,borderRadius:8,padding:"4px 8px",fontSize:12}}/>
                  <Btn dm={dm} size="sm" onClick={()=>saveFinSnapshot(finDailyDate)}>📸 Save Snapshot</Btn>
                </div>
              </div>
              <p style={{color:t.sub}} className="text-[11px] mb-3">Save a day-end snapshot to lock in that day's P&amp;L figures for future review. Snapshots are stored in Firebase and accessible from any device.</p>
              {/* Live preview for selected date */}
              {(()=>{
                const dayRev=deliveries.filter(d=>d.date===finDailyDate&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0);
                const daySupply=supplies.filter(s=>s.date===finDailyDate).reduce((s,x)=>s+(x.cost||0),0);
                const dayExp=expenses.filter(e=>e.date===finDailyDate).reduce((s,e)=>s+(e.amount||0),0);
                const dayWaste=(wastage||[]).filter(w=>w.date===finDailyDate).reduce((s,w)=>s+(w.cost||0),0);
                const dayProfit=dayRev-daySupply-dayExp-dayWaste;
                return(<div style={{background:t.inp,borderRadius:12,padding:14,marginBottom:12}}>
                  <p style={{color:t.text}} className="text-xs font-bold mb-2">📅 Live Data for {finDailyDate}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[["Revenue","#10b981",dayRev],["Supply Cost","#8b5cf6",daySupply],["Op. Expenses","#ef4444",dayExp],["Wastage","#f97316",dayWaste]].map(([l,c,v])=>(
                      <div key={l}><p style={{color:t.sub}} className="text-[10px]">{l}</p><p className="font-bold text-sm" style={{color:c}}>{inr(v)}</p></div>
                    ))}
                  </div>
                  <div style={{borderTop:`1px solid ${t.border}`,marginTop:10,paddingTop:8}}>
                    <p style={{color:t.sub}} className="text-[10px]">Net Profit / Loss</p>
                    <p className="font-black text-base" style={{color:dayProfit>=0?"#10b981":"#ef4444"}}>{inr(dayProfit)}</p>
                  </div>
                </div>);
              })()}
              {/* Saved snapshots list */}
              {savedSnaps.length===0?<p style={{color:t.sub}} className="text-sm text-center py-4">No snapshots saved yet. Select a date and tap "Save Snapshot".</p>
              :savedSnaps.map(snap=>{
                const isExp=finExpandedDay===snap.date;
                return(<div key={snap.date} style={{border:`1.5px solid ${isExp?"#3b82f6":t.border}`,borderRadius:12,marginBottom:8,overflow:"hidden"}}>
                  <button onClick={()=>setFinExpandedDay(isExp?null:snap.date)} className="w-full text-left" style={{background:t.inp,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
                    <div className="flex items-center gap-2">
                      <span style={{color:t.text}} className="text-sm font-bold">📅 {snap.date}</span>
                      <span style={{color:t.sub,fontSize:10}}>by {snap.savedBy}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-sm" style={{color:snap.netProfit>=0?"#10b981":"#ef4444"}}>{inr(snap.netProfit)}</span>
                      <span style={{color:t.sub,fontSize:11}}>{isExp?"▲":"▼"}</span>
                    </div>
                  </button>
                  {isExp&&<div style={{background:t.card,padding:"12px 14px"}}>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      {[["💰 Revenue","#10b981",snap.revenue],["📦 Supply Cost","#8b5cf6",snap.supplyCost],["💸 Op. Expenses","#ef4444",snap.opExpenses],["🗑️ Wastage","#f97316",snap.wastageCost]].map(([l,c,v])=>(
                        <div key={l} style={{background:t.inp,borderRadius:10,padding:"10px 12px"}}>
                          <p style={{color:t.sub}} className="text-[10px] mb-0.5">{l}</p>
                          <p className="font-bold text-sm" style={{color:c}}>{inr(v||0)}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{background:netProfit>=0?"#10b98118":"#ef444418",borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{color:t.text}} className="text-sm font-semibold">Net Profit / Loss</span>
                      <span className="font-black text-base" style={{color:snap.netProfit>=0?"#10b981":"#ef4444"}}>{inr(snap.netProfit)}</span>
                    </div>
                    <p style={{color:t.sub}} className="text-[10px] mt-2 text-right">Saved at {snap.savedAt}</p>
                  </div>}
                </div>);
              })}
            </>)}
            </div></>}</div></Card>

          {/* ── Expense Category Bar Chart ── */}
          {expenses.length>0&&catBreakdown.length>0&&<Card dm={dm}><div className="p-4">
            <p style={{color:t.text}} className="font-bold text-sm mb-3">Expenses by Category (filtered view)</p>
            {catBreakdown.map((c,i)=>(
              <div key={c.cat} className="mb-3 last:mb-0">
                <div className="flex items-center justify-between mb-1">
                  <span style={{color:t.text}} className="text-sm font-semibold">{c.cat}</span>
                  <div className="flex items-center gap-2">
                    <span style={{color:t.sub}} className="text-[11px]">{c.count} entries</span>
                    <span className="text-red-500 font-bold text-sm">{inr(c.total)}</span>
                  </div>
                </div>
                <div style={{background:t.border,height:5,borderRadius:5,overflow:"hidden"}}><div style={{width:`${Math.round(c.total/maxCatVal*100)}%`,background:PALETTE[i%7],height:"100%",borderRadius:5,transition:"width .3s"}}/></div>
              </div>
            ))}
          </div></Card>}

          {/* ── Filters + Action bar ── */}
          <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:14,padding:"12px 14px"}}>
            {/* Top row: search + toggle filters + add */}
            <div className="flex gap-2 items-center flex-wrap">
              <input value={expSearch} onChange={e=>setExpSearch(e.target.value)} placeholder="🔍 Search expenses…" style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,borderRadius:10,padding:"7px 12px",fontSize:13,flex:1,minWidth:140,outline:"none"}}/>
              <button onClick={()=>setExpShowFilters(p=>!p)} style={{background:expShowFilters?"#3b82f620":t.inp,border:`1.5px solid ${expShowFilters?"#3b82f6":t.border}`,color:expShowFilters?"#3b82f6":t.text,borderRadius:10,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>⚙ Filters{(expCatFilter!=="all"||expDateFilter!=="all")?` ●`:""}</button>
              <Btn dm={dm} size="sm" onClick={()=>{setEf(blkE());setEsh("add");}}>+ Expense</Btn>
            </div>
            {/* Expanded filter panel */}
            {expShowFilters&&<div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label style={{color:t.sub}} className="block text-[10px] font-bold uppercase tracking-wider mb-1">Category</label>
                <select value={expCatFilter} onChange={e=>setExpCatFilter(e.target.value)} style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,borderRadius:8,padding:"6px 8px",fontSize:12,width:"100%"}}>
                  <option value="all">All Categories</option>
                  {expCats.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{color:t.sub}} className="block text-[10px] font-bold uppercase tracking-wider mb-1">Date Range</label>
                <select value={expDateFilter} onChange={e=>setExpDateFilter(e.target.value)} style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,borderRadius:8,padding:"6px 8px",fontSize:12,width:"100%"}}>
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">This Month</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              {expDateFilter==="custom"&&<>
                <div><label style={{color:t.sub}} className="block text-[10px] font-bold uppercase tracking-wider mb-1">From</label><input type="date" value={expCustomFrom} onChange={e=>setExpCustomFrom(e.target.value)} style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,borderRadius:8,padding:"6px 8px",fontSize:12,width:"100%"}}/></div>
                <div><label style={{color:t.sub}} className="block text-[10px] font-bold uppercase tracking-wider mb-1">To</label><input type="date" value={expCustomTo} onChange={e=>setExpCustomTo(e.target.value)} style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,borderRadius:8,padding:"6px 8px",fontSize:12,width:"100%"}}/></div>
              </>}
              <div className="flex items-end">
                <button onClick={()=>{setExpCatFilter("all");setExpDateFilter("all");setExpSearch("");}} style={{background:t.inp,border:`1px solid ${t.border}`,color:t.sub,borderRadius:8,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer",width:"100%"}}>Clear All</button>
              </div>
            </div>}
            {/* Filter summary */}
            <div className="flex justify-between items-center mt-2">
              <span style={{color:t.sub}} className="text-[11px]">{filteredExp.length} entries · {inr(filtExpTotal)} total</span>
              <div className="flex gap-2">
                <button onClick={()=>exportTabPDF("Expenses",filteredExp,[{label:"Category",key:"category"},{label:"Amount (₹)",key:"amount",num:true},{label:"Date",key:"date"},{label:"Vendor",key:"vendor"},{label:"Notes",key:"notes"}],settings)} style={{color:t.sub,fontSize:11,fontWeight:600,cursor:"pointer"}}>📄 PDF</button>
                <button onClick={()=>exportTabExcel("Expenses",filteredExp,[{label:"Category",key:"category"},{label:"Amount",key:"amount",num:true},{label:"Date",key:"date"},{label:"Vendor",key:"vendor"},{label:"Payment",key:"paymentMethod"},{label:"Approved By",key:"approvedBy"},{label:"Receipt",key:"receipt"},{label:"Tags",key:"tags"},{label:"Notes",key:"notes"}],settings)} style={{color:t.sub,fontSize:11,fontWeight:600,cursor:"pointer"}}>📊 XLS</button>
                <button onClick={()=>exportCSV(filteredExp,"expenses",[{label:"Category",key:"category"},{label:"Amount",key:"amount"},{label:"Date",key:"date"},{label:"Vendor",key:"vendor"},{label:"Payment",key:"paymentMethod"},{label:"Approved By",key:"approvedBy"},{label:"Notes",key:"notes"}])} style={{color:t.sub,fontSize:11,fontWeight:600,cursor:"pointer"}}>CSV</button>
              </div>
            </div>
          </div>

          {/* ── Sort controls ── */}
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{color:t.sub,fontSize:11,fontWeight:600}}>Sort by:</span>
            {[["date","📅 Date"],["amount","💰 Amount"],["category","🏷 Category"],["vendor","🏪 Vendor"]].map(([v,l])=>(
              <button key={v} onClick={()=>setExpSortMode(v)} style={{background:expSortMode===v?"#ef4444":t.inp,color:expSortMode===v?"#fff":t.sub,border:`1.5px solid ${expSortMode===v?"#ef4444":t.border}`,padding:"4px 10px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",transition:"all .15s"}}>{l}</button>
            ))}
          </div>

          {/* ── Category Quick-Filter chips (clickable drilldown) ── */}
          {catBreakdown.length>0&&<div className="flex gap-2 flex-wrap">
            {catBreakdown.map((c,i)=>(
              <button key={c.cat} onClick={()=>setExpCatModal(c.cat)} onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.04)";}} onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";}}
                style={{background:PALETTE[i%7]+"18",border:`1.5px solid ${PALETTE[i%7]}40`,borderRadius:10,padding:"6px 12px",cursor:"pointer",transition:"all .15s",textAlign:"left"}}>
                <p style={{color:PALETTE[i%7],fontSize:10,fontWeight:800}}>{c.cat.toUpperCase()}</p>
                <p style={{color:t.text,fontSize:12,fontWeight:900}}>{inr(c.total)}</p>
                <p style={{color:t.sub,fontSize:9}}>{c.count} entries · tap to drill</p>
              </button>
            ))}
          </div>}

          {/* ── Category Drilldown Modal ── */}
          {expCatModal&&(()=>{
            const catExps=expenses.filter(e=>e.category===expCatModal).sort((a,b)=>b.date.localeCompare(a.date));
            const catTotal=catExps.reduce((s,e)=>s+(e.amount||0),0);
            const catVendors={};catExps.forEach(e=>{if(e.vendor)catVendors[e.vendor]=(catVendors[e.vendor]||0)+(e.amount||0);});
            const catPMs={};catExps.forEach(e=>{const pm=e.paymentMethod||"Cash";catPMs[pm]=(catPMs[pm]||0)+(e.amount||0);});
            const catMonths={};catExps.forEach(e=>{const m=e.date?.slice(0,7);if(m)catMonths[m]=(catMonths[m]||0)+(e.amount||0);});
            return(
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:9990,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setExpCatModal(null)}>
              <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:600,maxHeight:"88vh",overflowY:"auto",padding:20}} onClick={e=>e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p style={{color:t.text,fontWeight:900,fontSize:16}}>🏷 {expCatModal}</p>
                    <p style={{color:t.sub,fontSize:11}}>{catExps.length} entries · all time</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span style={{color:"#ef4444",fontWeight:900,fontSize:18}}>{inr(catTotal)}</span>
                    <button onClick={()=>setExpCatModal(null)} style={{background:t.inp,border:`1px solid ${t.border}`,color:t.text,borderRadius:10,padding:"6px 14px",fontSize:13,fontWeight:700,cursor:"pointer"}}>✕ Close</button>
                  </div>
                </div>
                {/* Category stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    {l:"Total Spent",v:inr(catTotal),c:"#ef4444"},
                    {l:"Entries",v:catExps.length,c:"#3b82f6"},
                    {l:"Avg/Entry",v:inr(catExps.length>0?Math.round(catTotal/catExps.length):0),c:"#f59e0b"},
                  ].map(x=><div key={x.l} style={{background:t.inp,borderRadius:12,padding:"10px 12px",textAlign:"center"}}>
                    <p style={{color:x.c,fontWeight:900,fontSize:14}}>{x.v}</p>
                    <p style={{color:t.sub,fontSize:10}}>{x.l}</p>
                  </div>)}
                </div>
                {/* Vendor breakdown */}
                {Object.keys(catVendors).length>0&&<div className="mb-4">
                  <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>By Vendor</p>
                  {Object.entries(catVendors).sort((a,b)=>b[1]-a[1]).map(([v,amt])=>(
                    <div key={v} className="flex items-center justify-between py-1.5" style={{borderBottom:`1px solid ${t.border}`}}>
                      <button onClick={()=>{setExpCatModal(null);setExpVendorModal(v);}} style={{color:"#3b82f6",fontSize:12,fontWeight:600,background:"none",border:"none",cursor:"pointer",textAlign:"left"}}>{v} →</button>
                      <span style={{color:"#ef4444",fontWeight:700,fontSize:12}}>{inr(amt)}</span>
                    </div>
                  ))}
                </div>}
                {/* Payment method */}
                {Object.keys(catPMs).length>0&&<div className="mb-4">
                  <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>By Payment Method</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(catPMs).map(([pm,amt])=>(
                      <div key={pm} style={{background:"#8b5cf618",border:"1px solid #8b5cf640",borderRadius:8,padding:"5px 10px"}}>
                        <p style={{color:"#8b5cf6",fontWeight:700,fontSize:12}}>{pm}</p>
                        <p style={{color:t.sub,fontSize:10}}>{inr(amt)}</p>
                      </div>
                    ))}
                  </div>
                </div>}
                {/* Monthly trend */}
                {Object.keys(catMonths).length>1&&<div className="mb-4">
                  <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Monthly Trend</p>
                  {Object.entries(catMonths).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,6).map(([m,amt])=>(
                    <div key={m} className="mb-2">
                      <div className="flex justify-between mb-1"><span style={{color:t.text,fontSize:11}}>{m}</span><span style={{color:"#ef4444",fontWeight:700,fontSize:11}}>{inr(amt)}</span></div>
                      <div style={{background:t.border,height:4,borderRadius:4,overflow:"hidden"}}><div style={{width:`${catTotal>0?Math.round(amt/catTotal*100):0}%`,background:"#ef4444",height:"100%",borderRadius:4}}/></div>
                    </div>
                  ))}
                </div>}
                {/* Entries list */}
                <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>All Entries</p>
                <div style={{border:`1px solid ${t.border}`,borderRadius:12,overflow:"hidden"}}>
                  {catExps.map((e,i)=>(
                    <div key={e.id||i} style={{padding:"10px 14px",borderTop:i>0?`1px solid ${t.border}`:"none",background:i%2===0?"transparent":t.inp+"66"}}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span style={{color:t.text,fontSize:12,fontWeight:600}}>{e.vendor||"—"}</span>
                            {e.tags&&e.tags.split(",").filter(Boolean).map(tg=><span key={tg} style={{background:"#8b5cf620",color:"#8b5cf6",borderRadius:4,padding:"1px 5px",fontSize:9,fontWeight:600}}>{tg.trim()}</span>)}
                          </div>
                          <p style={{color:t.sub,fontSize:10}}>📅 {e.date}{e.paymentMethod?` · ${e.paymentMethod}`:""}{e.approvedBy?` · ✅ ${e.approvedBy}`:""}</p>
                          {e.notes&&<p style={{color:t.sub,fontSize:10,fontStyle:"italic"}}>{e.notes}</p>}
                          {e.receipt&&<p style={{color:"#f59e0b",fontSize:9}}>🧾 {e.receipt}</p>}
                        </div>
                        <span style={{color:"#ef4444",fontWeight:900,fontSize:14,whiteSpace:"nowrap",marginLeft:8}}>{inr(e.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>);
          })()}

          {/* ── Vendor Drilldown Modal ── */}
          {expVendorModal&&(()=>{
            const vExps=expenses.filter(e=>e.vendor===expVendorModal).sort((a,b)=>b.date.localeCompare(a.date));
            const vTotal=vExps.reduce((s,e)=>s+(e.amount||0),0);
            const vCats={};vExps.forEach(e=>{const c=e.category||"Other";vCats[c]=(vCats[c]||0)+(e.amount||0);});
            return(
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:9991,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={()=>setExpVendorModal(null)}>
              <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:600,maxHeight:"85vh",overflowY:"auto",padding:20}} onClick={e=>e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p style={{color:t.text,fontWeight:900,fontSize:16}}>🏪 {expVendorModal}</p>
                    <p style={{color:t.sub,fontSize:11}}>{vExps.length} transactions</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span style={{color:"#ef4444",fontWeight:900,fontSize:18}}>{inr(vTotal)}</span>
                    <button onClick={()=>setExpVendorModal(null)} style={{background:t.inp,border:`1px solid ${t.border}`,color:t.text,borderRadius:10,padding:"6px 14px",fontSize:13,fontWeight:700,cursor:"pointer"}}>✕ Close</button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[{l:"Total Paid",v:inr(vTotal),c:"#ef4444"},{l:"Transactions",v:vExps.length,c:"#3b82f6"},{l:"Avg",v:inr(vExps.length>0?Math.round(vTotal/vExps.length):0),c:"#f59e0b"}].map(x=>(
                    <div key={x.l} style={{background:t.inp,borderRadius:12,padding:"10px 12px",textAlign:"center"}}><p style={{color:x.c,fontWeight:900,fontSize:14}}>{x.v}</p><p style={{color:t.sub,fontSize:10}}>{x.l}</p></div>
                  ))}
                </div>
                {Object.keys(vCats).length>0&&<div className="flex flex-wrap gap-2 mb-4">
                  {Object.entries(vCats).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>(
                    <div key={cat} style={{background:"#ef444418",border:"1px solid #ef444440",borderRadius:8,padding:"5px 10px"}}>
                      <p style={{color:"#ef4444",fontWeight:700,fontSize:11}}>{cat}</p><p style={{color:t.sub,fontSize:10}}>{inr(amt)}</p>
                    </div>
                  ))}
                </div>}
                <div style={{border:`1px solid ${t.border}`,borderRadius:12,overflow:"hidden"}}>
                  {vExps.map((e,i)=>(
                    <div key={e.id||i} style={{padding:"10px 14px",borderTop:i>0?`1px solid ${t.border}`:"none",background:i%2===0?"transparent":t.inp+"66"}}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span style={{background:"#ef444420",color:"#ef4444",borderRadius:5,padding:"1px 6px",fontSize:9,fontWeight:700}}>{e.category}</span>
                          <p style={{color:t.sub,fontSize:10,marginTop:2}}>📅 {e.date}{e.paymentMethod?` · ${e.paymentMethod}`:""}</p>
                          {e.notes&&<p style={{color:t.sub,fontSize:10,fontStyle:"italic"}}>{e.notes}</p>}
                        </div>
                        <span style={{color:"#ef4444",fontWeight:900,fontSize:14}}>{inr(e.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>);
          })()}

          {/* ── Expense cards — Interactive ── */}
          {filteredExp.length===0?<p style={{color:t.sub}} className="text-sm text-center py-6">No expenses match the current filters.</p>
          :(()=>{
            const sorted=[...filteredExp].sort((a,b)=>{
              if(expSortMode==="amount") return (b.amount||0)-(a.amount||0);
              if(expSortMode==="category") return (a.category||"").localeCompare(b.category||"");
              if(expSortMode==="vendor") return (a.vendor||"").localeCompare(b.vendor||"");
              return b.date.localeCompare(a.date);
            });
            return sorted.map(e=>{
              const isExp=expCardExpanded===e.id;
              const isHov=expHovered===e.id;
              const catIdx=(settings?.expenseCategories||["Gas","Labour","Transport","Packaging","Utilities","Maintenance","Other"]).indexOf(e.category);
              const catColor=PALETTE[catIdx>=0?catIdx%7:0];
              const catPct=filtExpTotal>0?Math.round((e.amount||0)/filtExpTotal*100):0;
              return(
              <div key={e.id}
                onMouseEnter={()=>setExpHovered(e.id)}
                onMouseLeave={()=>setExpHovered(null)}
                onClick={()=>setExpCardExpanded(isExp?null:e.id)}
                style={{background:t.card,border:`1.5px solid ${isExp?catColor:isHov?t.border+"aa":t.border}`,borderRadius:16,padding:"14px 16px",cursor:"pointer",transition:"all .18s ease",transform:isHov&&!isExp?"translateY(-1px)":"none",boxShadow:isExp?`0 4px 20px ${catColor}22`:isHov?"0 2px 10px rgba(0,0,0,0.1)":"none"}}>
                {/* Main row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <button onClick={ev=>{ev.stopPropagation();setExpCatModal(e.category);}} style={{background:catColor+"22",color:catColor,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700,whiteSpace:"nowrap",border:`1px solid ${catColor}44`,cursor:"pointer"}}>🏷 {e.category}</button>
                      {e.paymentMethod&&<span style={{background:"#3b82f620",color:"#3b82f6",borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:600}}>{e.paymentMethod}</span>}
                      {e.tags&&e.tags.split(",").map(tag=>tag.trim()).filter(Boolean).map(tag=><span key={tag} style={{background:"#8b5cf620",color:"#8b5cf6",borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:600}}>{tag}</span>)}
                      {e.approvedBy&&<span style={{background:"#10b98120",color:"#10b981",borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:600}}>✅ {e.approvedBy}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span style={{color:t.sub}} className="text-xs">📅 {e.date}</span>
                      {e.vendor&&<button onClick={ev=>{ev.stopPropagation();setExpVendorModal(e.vendor);}} style={{color:"#3b82f6",fontSize:12,fontWeight:600,background:"none",border:"none",cursor:"pointer",padding:0}}>🏪 {e.vendor} →</button>}
                    </div>
                    {e.notes&&<p style={{color:t.sub}} className="text-xs mt-1 leading-relaxed">{e.notes}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                    <span style={{color:"#ef4444",fontWeight:900,fontSize:16,lineHeight:1}}>{inr(e.amount)}</span>
                    {catPct>0&&<span style={{color:t.sub,fontSize:9,fontWeight:600}}>{catPct}% of filtered</span>}
                    <span style={{color:t.sub,fontSize:10,marginTop:2}}>{isExp?"▲ less":"▼ more"}</span>
                  </div>
                </div>
                {/* Cost bar indicator */}
                {filtExpTotal>0&&<div style={{marginTop:8,height:3,background:t.border,borderRadius:3,overflow:"hidden"}}><div style={{width:`${catPct}%`,background:catColor,height:"100%",borderRadius:3,transition:"width 0.4s"}}/></div>}
                {/* Expanded detail panel */}
                {isExp&&<div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${t.border}`}} onClick={ev=>ev.stopPropagation()}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    {[
                      {l:"Amount",v:inr(e.amount),c:"#ef4444"},
                      {l:"Category",v:e.category,c:catColor},
                      {l:"Payment",v:e.paymentMethod||"Cash",c:"#3b82f6"},
                      {l:"Date",v:e.date,c:t.text},
                    ].map(x=><div key={x.l} style={{background:t.inp,borderRadius:10,padding:"8px 10px"}}>
                      <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase"}}>{x.l}</p>
                      <p style={{color:x.c,fontWeight:700,fontSize:12}}>{x.v}</p>
                    </div>)}
                  </div>
                  {e.vendor&&<div style={{background:t.inp,borderRadius:10,padding:"8px 12px",marginBottom:8}}>
                    <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:3}}>Vendor</p>
                    <div className="flex items-center justify-between">
                      <p style={{color:t.text,fontSize:13,fontWeight:700}}>{e.vendor}</p>
                      <button onClick={()=>setExpVendorModal(e.vendor)} style={{color:"#3b82f6",fontSize:11,fontWeight:600,background:"none",border:"none",cursor:"pointer"}}>See all vendor expenses →</button>
                    </div>
                  </div>}
                  {e.receipt&&<div style={{background:"#f59e0b18",border:"1px solid #f59e0b40",borderRadius:10,padding:"8px 12px",marginBottom:8}}>
                    <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:2}}>Receipt / Reference</p>
                    <p style={{color:"#f59e0b",fontSize:12,fontWeight:600}}>🧾 {e.receipt}</p>
                  </div>}
                  {e.notes&&<div style={{background:t.inp,borderRadius:10,padding:"8px 12px",marginBottom:8}}>
                    <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:2}}>Notes</p>
                    <p style={{color:t.text,fontSize:12,lineHeight:1.5}}>{e.notes}</p>
                  </div>}
                  {e.tags&&<div className="flex flex-wrap gap-1.5 mb-3">{e.tags.split(",").filter(Boolean).map(tg=><span key={tg} style={{background:"#8b5cf620",color:"#8b5cf6",borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:600}}>#{tg.trim()}</span>)}</div>}
                  {/* % of total category */}
                  {(()=>{
                    const catTotal2=expenses.filter(ex=>ex.category===e.category).reduce((s,ex)=>s+(ex.amount||0),0);
                    const pctOfCat=catTotal2>0?Math.round((e.amount||0)/catTotal2*100):0;
                    return catTotal2>0&&<div style={{background:catColor+"12",border:`1px solid ${catColor}30`,borderRadius:10,padding:"8px 12px",marginBottom:8}}>
                      <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:2}}>Share of {e.category} category</p>
                      <div className="flex items-center gap-3">
                        <p style={{color:catColor,fontWeight:800,fontSize:13}}>{pctOfCat}%</p>
                        <div style={{flex:1,height:5,background:t.border,borderRadius:5,overflow:"hidden"}}><div style={{width:`${pctOfCat}%`,background:catColor,height:"100%",borderRadius:5}}/></div>
                        <p style={{color:t.sub,fontSize:10}}>of {inr(catTotal2)}</p>
                      </div>
                    </div>;
                  })()}
                  {/* Actions */}
                  <div className="flex gap-2">
                    <button onClick={()=>{setEf({...e,amount:String(e.amount),vendor:e.vendor||"",paymentMethod:e.paymentMethod||"Cash",approvedBy:e.approvedBy||"",tags:e.tags||""});setEsh(e);}} style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,padding:"7px 14px",borderRadius:10,fontSize:12,fontWeight:600,cursor:"pointer",flex:1}}>✏️ Edit Expense</button>
                    <button onClick={()=>delE(e)} style={{background:"#dc2626",color:"#fff",padding:"7px 14px",borderRadius:10,fontSize:12,fontWeight:700,cursor:"pointer",flex:1}}>🗑️ Delete</button>
                  </div>
                </div>}
              </div>);
            });
          })()}
        </>);
        })()}

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
                <div className="flex gap-2 flex-wrap">
                  <Btn dm={dm} v="outline" size="sm" onClick={()=>{
                    const cols=[{label:"Date",key:"date"},{label:"Shift",key:"shift"},{label:"Product",key:"product"},{label:"Qty",key:"qty",num:true},{label:"Unit",key:"unit"},{label:"Type",key:"type"},{label:"Reason",key:"reason"},{label:"Cost (₹)",key:"cost",num:true},{label:"Logged By",key:"loggedBy"}];
                    const statsHtml=`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px"><div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px 14px"><div style="font-size:20px;font-weight:900;color:#c2410c">${totalWasteQty}</div><div style="font-size:9px;text-transform:uppercase;color:#a8a29e;margin-top:3px">Total Qty Wasted</div></div><div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:12px 14px"><div style="font-size:20px;font-weight:900;color:#b91c1c">${inr(totalWasteCost)}</div><div style="font-size:9px;text-transform:uppercase;color:#a8a29e;margin-top:3px">Cost Loss</div></div><div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 14px"><div style="font-size:20px;font-weight:900;color:#92400e">${todayWaste.reduce((s,w)=>s+(w.qty||0),0)}</div><div style="font-size:9px;text-transform:uppercase;color:#a8a29e;margin-top:3px">Today's Wastage</div></div></div>`;
                    exportTabPDF("Wastage",wastage,cols,settings,statsHtml);
                    addLog("Exported wastage","PDF report");
                  }}>📄 PDF</Btn>
                  <Btn dm={dm} v="outline" size="sm" onClick={()=>{
                    exportTabExcel("Wastage",wastage,[{label:"Date",key:"date"},{label:"Shift",key:"shift"},{label:"Product",key:"product"},{label:"Qty",key:"qty",num:true},{label:"Unit",key:"unit"},{label:"Type",key:"type"},{label:"Reason",key:"reason"},{label:"Cost",key:"cost",num:true},{label:"Logged By",key:"loggedBy"},{label:"Created At",key:"createdAt"}],settings);
                    addLog("Exported wastage","XLS export");
                  }}>📊 XLS</Btn>
                  <Btn dm={dm} v="outline" size="sm" onClick={()=>{
                    exportCSV(wastage,"wastage",[
                      {label:"Date",key:"date"},{label:"Shift",key:"shift"},{label:"Product",key:"product"},
                      {label:"Qty",key:"qty"},{label:"Unit",key:"unit"},{label:"Type",key:"type"},
                      {label:"Reason",key:"reason"},{label:"Cost (₹)",key:"cost"},{label:"Logged By",key:"loggedBy"},
                      {label:"Time",key:"createdAt"}
                    ]);addLog("Exported wastage","CSV export");}}>CSV</Btn>
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


        {/* ══════════════════════════════════════════════════════════════
            PAYMENTS TAB — Full ledger, outstanding balances, daily summary
            ══════════════════════════════════════════════════════════════ */}
        {tab==="Payments"&&isAdmin&&(()=>{
          const todayStr=today();
          // ── Build comprehensive payment data ──────────────────────────
          // Compute per-delivery payment status
          const delivPayments=deliveries.map(d=>{
            const orderTotal=lineTotal(d.orderLines);
            const replAmt=+(d.replacement?.amount)||0;
            const netPayable=Math.max(0,orderTotal-replAmt);
            const collected=d.partialPayment?.enabled?(+(d.partialPayment?.amount)||0):0;
            const balance=Math.max(0,netPayable-collected);
            const invNo=(invRegistry?.issued||{})[d.id]||d.invNo||null;
            const rcptNo=invNo?`RCP-${invNo.replace("TAS-","")}`:`RCP-${(d.id||"").slice(-6).toUpperCase()}`;
            const payStatus=netPayable===0?"zero":balance===0&&netPayable>0?"settled":collected>0&&balance>0?"partial":"pending";
            return {d,orderTotal,replAmt,netPayable,collected,balance,invNo,rcptNo,payStatus};
          });

          // ── Manual ledger entries ──────────────────────────────────────
          const allLedgerEntries=[
            ...delivPayments.filter(dp=>dp.collected>0).map(dp=>({
              id:`deliv_${dp.d.id}`,type:"delivery",date:dp.d.date,customer:dp.d.customer,customerId:dp.d.customerId,
              amount:dp.collected,balance:dp.balance,invNo:dp.invNo,rcptNo:dp.rcptNo,
              note:dp.d.partialPayment?.note||"",method:"Delivery Collect",by:dp.d.partialPayment?.collectedBy||dp.d.createdBy||"—",
              replAmt:dp.replAmt,orderTotal:dp.orderTotal,netPayable:dp.netPayable,payStatus:dp.payStatus,ts:dp.d.partialPayment?.collectedAt||dp.d.date
            })),
            ...(paymentLedger||[]).map(e=>({
              id:e.id,type:"manual",date:e.date,customer:e.customerName,customerId:e.customerId,
              amount:e.amount,balance:0,invNo:null,rcptNo:null,
              note:e.note||"",method:e.method||"Cash",by:e.recordedBy||"—",
              replAmt:0,orderTotal:0,netPayable:0,payStatus:"manual",ts:e.ts||e.date
            })),
          ].sort((a,b)=>b.date.localeCompare(a.date)||(b.ts||"").localeCompare(a.ts||""));

          // ── Filtered entries ───────────────────────────────────────────
          const q2=paymentsSearch.toLowerCase();
          const filteredEntries=allLedgerEntries.filter(e=>{
            const matchQ=!q2||e.customer.toLowerCase().includes(q2)||(e.invNo||"").toLowerCase().includes(q2)||(e.rcptNo||"").toLowerCase().includes(q2)||e.note.toLowerCase().includes(q2);
            const now2=new Date();
            const matchDate=paymentsDateFilter==="all"?true:
              paymentsDateFilter==="today"?e.date===todayStr:
              paymentsDateFilter==="week"?e.date>=(new Date(now2.getTime()-6*86400000).toISOString().slice(0,10)):
              paymentsDateFilter==="month"?e.date>=(new Date(now2.getFullYear(),now2.getMonth(),1).toISOString().slice(0,10)):true;
            return matchQ&&matchDate;
          });

          // ── Outstanding balances per customer ──────────────────────────
          const custOutstanding=customers.map(c=>{
            const custDelivs=delivPayments.filter(dp=>dp.d.customerId===c.id);
            const totalOrdered=custDelivs.reduce((s,dp)=>s+dp.orderTotal,0);
            const totalRepl=custDelivs.reduce((s,dp)=>s+dp.replAmt,0);
            const totalNet=custDelivs.reduce((s,dp)=>s+dp.netPayable,0);
            const totalCollected=custDelivs.reduce((s,dp)=>s+dp.collected,0);
            const totalBalance=custDelivs.reduce((s,dp)=>s+dp.balance,0);
            const pendingDelivs=custDelivs.filter(dp=>dp.payStatus==="pending");
            const partialDelivs=custDelivs.filter(dp=>dp.payStatus==="partial");
            const settledDelivs=custDelivs.filter(dp=>dp.payStatus==="settled");
            // also count manual ledger payments
            const manualPaid=(paymentLedger||[]).filter(e=>e.customerId===c.id).reduce((s,e)=>s+e.amount,0);
            return {c,totalOrdered,totalRepl,totalNet,totalCollected:totalCollected+manualPaid,totalBalance,pendingDelivs,partialDelivs,settledDelivs,custDelivs};
          }).filter(x=>x.custDelivs.length>0||x.c.pending>0);

          // ── Daily summary data ─────────────────────────────────────────
          const last30Days=Array.from({length:30},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return d.toISOString().slice(0,10);});
          const dailySummary=last30Days.map(date=>{
            const dayDelivs=delivPayments.filter(dp=>dp.d.date===date);
            const dayOrdered=dayDelivs.reduce((s,dp)=>s+dp.orderTotal,0);
            const dayRepl=dayDelivs.reduce((s,dp)=>s+dp.replAmt,0);
            const dayNet=dayDelivs.reduce((s,dp)=>s+dp.netPayable,0);
            const dayCollected=dayDelivs.reduce((s,dp)=>s+dp.collected,0);
            const dayManual=(paymentLedger||[]).filter(e=>e.date===date).reduce((s,e)=>s+e.amount,0);
            const dayPending=dayNet-dayCollected;
            const dayPartial=dayDelivs.filter(dp=>dp.payStatus==="partial").length;
            const daySettled=dayDelivs.filter(dp=>dp.payStatus==="settled").length;
            const dayUnpaid=dayDelivs.filter(dp=>dp.payStatus==="pending").length;
            return {date,dayOrdered,dayRepl,dayNet,dayCollected,dayManual,totalCash:dayCollected+dayManual,dayPending:Math.max(0,dayPending),dayPartial,daySettled,dayUnpaid,delivCount:dayDelivs.length};
          }).filter(d=>d.delivCount>0||d.dayManual>0);

          // ── Totals ────────────────────────────────────────────────────
          const totalCollectedAll=allLedgerEntries.filter(e=>e.type==="delivery").reduce((s,e)=>s+e.amount,0);
          const totalManualAll=(paymentLedger||[]).reduce((s,e)=>s+e.amount,0);
          const totalReplAll=delivPayments.reduce((s,dp)=>s+dp.replAmt,0);
          const totalBalanceAll=delivPayments.reduce((s,dp)=>s+dp.balance,0);
          const partialCustCount=custOutstanding.filter(x=>x.partialDelivs.length>0).length;
          const pendingCustCount=custOutstanding.filter(x=>x.totalBalance>0).length;

          const SUB_TABS=[
            {id:"ledger",label:"📋 Full Ledger"},
            {id:"outstanding",label:"⏳ Outstanding"},
            {id:"daily",label:"📅 Daily Summary"},
          ];

          return <>
            {/* ── KPI strip ── */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
              <div style={{background:dm?"#0a1f12":"#f0fdf4",border:"1.5px solid #10b98130",borderRadius:16,padding:"12px 16px",gridColumn:"1/-1"}}>
                <p style={{color:"#10b981",fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>💰 Payment Overview</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                  {[
                    {label:"Total Collected",val:inr(totalCollectedAll+totalManualAll),color:"#10b981"},
                    {label:"Repl Deducted",val:inr(totalReplAll),color:"#f97316"},
                    {label:"Outstanding",val:inr(totalBalanceAll),color:totalBalanceAll>0?"#ef4444":"#10b981"},
                    {label:"Customers With Dues",val:pendingCustCount,color:pendingCustCount>0?"#f59e0b":"#10b981"},
                  ].map(({label,val,color})=>(
                    <div key={label} style={{background:dm?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.7)",borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
                      <p style={{color,fontWeight:900,fontSize:14,lineHeight:1}}>{val}</p>
                      <p style={{color:t.sub,fontSize:9,marginTop:4,textTransform:"uppercase",letterSpacing:"0.05em",lineHeight:1.3}}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Sub-tab nav ── */}
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {SUB_TABS.map(s=>(
                <button key={s.id} onClick={()=>setPaymentsSubTab(s.id)}
                  style={{background:paymentsSubTab===s.id?(dm?"#3b82f6":"#1e3a5f"):"transparent",color:paymentsSubTab===s.id?"#fff":t.sub,borderRadius:10,padding:"7px 14px",fontSize:12,fontWeight:700,border:`1.5px solid ${paymentsSubTab===s.id?(dm?"#3b82f6":"#1e3a5f"):t.border}`,cursor:"pointer",transition:"all 0.15s",WebkitTapHighlightColor:"transparent"}}>
                  {s.label}
                </button>
              ))}
              <button onClick={()=>{setPayLedgerCust(null);setPayLedgerAmt("");setPayLedgerNote("");setPayLedgerMethod("Cash");setPayLedgerSh(true);}}
                style={{marginLeft:"auto",background:"#10b981",color:"#fff",borderRadius:10,padding:"7px 14px",fontSize:12,fontWeight:700,border:"none",cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
                + Record Payment
              </button>
            </div>

            {/* ── FULL LEDGER sub-tab ── */}
            {paymentsSubTab==="ledger"&&<>
              <div className="flex gap-2 flex-wrap">
                <div style={{flex:1,minWidth:180}}>
                  <Search dm={dm} value={paymentsSearch} onChange={setPaymentsSearch} placeholder="Search customer, invoice, receipt…"/>
                </div>
                <div style={{display:"flex",gap:6}}>
                  {["all","today","week","month"].map(f=>(
                    <button key={f} onClick={()=>setPaymentsDateFilter(f)}
                      style={{background:paymentsDateFilter===f?(dm?"#3b82f6":"#1e3a5f"):t.inp,color:paymentsDateFilter===f?"#fff":t.sub,borderRadius:8,padding:"6px 12px",fontSize:11,fontWeight:700,border:`1px solid ${paymentsDateFilter===f?"transparent":t.border}`,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
                      {f==="all"?"All":f==="today"?"Today":f==="week"?"7d":f==="month"?"This Month":""}
                    </button>
                  ))}
                </div>
              </div>
              {filteredEntries.length===0&&<p style={{color:t.sub,textAlign:"center",padding:"40px 0",fontSize:13}}>No payment records found.</p>}
              {filteredEntries.map((entry,ei)=>{
                const statusColor=entry.payStatus==="settled"?"#10b981":entry.payStatus==="partial"?"#f59e0b":entry.payStatus==="manual"?"#3b82f6":"#ef4444";
                const statusLabel=entry.payStatus==="settled"?"✓ Settled":entry.payStatus==="partial"?"⚡ Partial":entry.payStatus==="manual"?"💳 Manual":"⏳ Pending";
                return <div key={entry.id} style={{background:t.card,border:`1px solid ${statusColor}30`,borderRadius:16,padding:"14px 16px",borderLeft:`3px solid ${statusColor}`}}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p style={{color:t.text,fontWeight:800,fontSize:14,lineHeight:1.2}}>{entry.customer}</p>
                      <div className="flex gap-2 flex-wrap mt-1">
                        <span style={{color:t.sub,fontSize:10}}>📅 {entry.date}</span>
                        {entry.invNo&&<span style={{background:t.inp,color:t.sub,fontSize:9,fontFamily:"monospace",borderRadius:4,padding:"1px 6px"}}>{entry.invNo}</span>}
                        {entry.rcptNo&&<span style={{background:t.inp,color:t.sub,fontSize:9,fontFamily:"monospace",borderRadius:4,padding:"1px 6px"}}>{entry.rcptNo}</span>}
                        <span style={{color:t.sub,fontSize:10}}>via {entry.method}</span>
                        <span style={{color:t.sub,fontSize:10}}>by {entry.by}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p style={{color:"#10b981",fontWeight:900,fontSize:16}}>{inr(entry.amount)}</p>
                      <span style={{background:statusColor+"20",color:statusColor,fontSize:9,fontWeight:700,borderRadius:20,padding:"2px 8px"}}>{statusLabel}</span>
                    </div>
                  </div>
                  {entry.type==="delivery"&&<div style={{display:"flex",gap:6,flexWrap:"wrap",fontSize:11}}>
                    {entry.orderTotal>0&&<span style={{background:t.inp,borderRadius:6,padding:"2px 8px",color:t.sub}}>Order: <b style={{color:t.text}}>{inr(entry.orderTotal)}</b></span>}
                    {entry.replAmt>0&&<span style={{background:"#f9731615",borderRadius:6,padding:"2px 8px",color:"#f97316"}}>🔄 Repl: <b>−{inr(entry.replAmt)}</b></span>}
                    {entry.netPayable>0&&<span style={{background:t.inp,borderRadius:6,padding:"2px 8px",color:t.sub}}>Net: <b style={{color:t.text}}>{inr(entry.netPayable)}</b></span>}
                    {entry.balance>0&&<span style={{background:"#f59e0b15",borderRadius:6,padding:"2px 8px",color:"#f59e0b"}}>Due: <b>{inr(entry.balance)}</b></span>}
                  </div>}
                  {entry.note&&<p style={{color:t.sub,fontSize:11,marginTop:6,fontStyle:"italic"}}>📝 "{entry.note}"</p>}
                </div>;
              })}
            </>}

            {/* ── OUTSTANDING sub-tab ── */}
            {paymentsSubTab==="outstanding"&&<>
              <div style={{background:dm?"#1a0a0a":"#fff7f7",border:"1.5px solid #ef444430",borderRadius:16,padding:"12px 16px"}}>
                <p style={{color:"#ef4444",fontSize:12,fontWeight:700,marginBottom:4}}>⏳ Customers with outstanding balances: {pendingCustCount}</p>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <span style={{background:"#ef444420",color:"#ef4444",borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:700}}>Total Due: {inr(totalBalanceAll)}</span>
                  <span style={{background:"#f59e0b20",color:"#f59e0b",borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:700}}>Partial: {partialCustCount} customers</span>
                  <span style={{background:"#f9731620",color:"#f97316",borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:700}}>Replaced: {inr(totalReplAll)} deducted</span>
                </div>
              </div>
              {custOutstanding.sort((a,b)=>b.totalBalance-a.totalBalance).map(({c,totalOrdered,totalRepl,totalNet,totalCollected:tc,totalBalance,pendingDelivs,partialDelivs,settledDelivs,custDelivs})=>{
                const hasDue=totalBalance>0||(c.pending||0)>0;
                const accentColor=hasDue?"#ef4444":"#10b981";
                return <div key={c.id} style={{background:t.card,border:`1px solid ${accentColor}25`,borderRadius:16,padding:"14px 16px",borderLeft:`3px solid ${accentColor}`}}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p style={{color:t.text,fontWeight:800,fontSize:14}}>{c.name}</p>
                      {c.phone&&<p style={{color:t.sub,fontSize:11}}>📞 {c.phone}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p style={{color:hasDue?"#ef4444":"#10b981",fontWeight:900,fontSize:16}}>{inr(Math.max(totalBalance,c.pending||0))}</p>
                      <p style={{color:t.sub,fontSize:9}}>{hasDue?"outstanding":"fully settled"}</p>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:10}}>
                    {[
                      {label:"Total Ordered",val:inr(totalOrdered),color:t.text},
                      {label:"Repl Deducted",val:inr(totalRepl),color:"#f97316"},
                      {label:"Collected",val:inr(tc),color:"#10b981"},
                      {label:"Balance Due",val:inr(Math.max(totalBalance,c.pending||0)),color:hasDue?"#ef4444":"#10b981"},
                    ].map(({label,val,color})=>(
                      <div key={label} style={{background:t.inp,borderRadius:8,padding:"6px 8px",textAlign:"center"}}>
                        <p style={{color,fontWeight:800,fontSize:11,lineHeight:1}}>{val}</p>
                        <p style={{color:t.sub,fontSize:8,marginTop:3,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                    {settledDelivs.length>0&&<span style={{background:"#10b98115",color:"#10b981",borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>✓ {settledDelivs.length} settled</span>}
                    {partialDelivs.length>0&&<span style={{background:"#f59e0b15",color:"#f59e0b",borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>⚡ {partialDelivs.length} partial</span>}
                    {pendingDelivs.length>0&&<span style={{background:"#ef444415",color:"#ef4444",borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>⏳ {pendingDelivs.length} unpaid</span>}
                    {totalRepl>0&&<span style={{background:"#f9731615",color:"#f97316",borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>🔄 {inr(totalRepl)} replaced</span>}
                  </div>
                  {/* Per-delivery breakdown */}
                  {custDelivs.length>0&&<div style={{background:t.inp,borderRadius:10,padding:"8px 10px"}}>
                    <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Delivery Breakdown</p>
                    {custDelivs.slice(0,5).map(({d,orderTotal:dOt,replAmt:dRa,netPayable:dNet,collected:dColl,balance:dBal,invNo:dInv,payStatus:dSt})=>(
                      <div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderBottom:`1px solid ${t.border}`,fontSize:11}}>
                        <div style={{flex:1,minWidth:0}}>
                          <span style={{color:t.sub}}>{d.date}</span>
                          {dInv&&<span style={{color:t.sub,fontSize:9,marginLeft:6,fontFamily:"monospace"}}>{dInv}</span>}
                          {dRa>0&&<span style={{color:"#f97316",fontSize:9,marginLeft:4}}>🔄−{inr(dRa)}</span>}
                          <span style={{display:"inline-block",marginLeft:6,background:dSt==="settled"?"#10b98120":dSt==="partial"?"#f59e0b20":"#ef444420",color:dSt==="settled"?"#10b981":dSt==="partial"?"#f59e0b":"#ef4444",borderRadius:4,padding:"0px 5px",fontSize:9,fontWeight:700}}>
                            {dSt==="settled"?"✓":dSt==="partial"?"⚡":"⏳"}
                          </span>
                        </div>
                        <div style={{textAlign:"right",shrink:0}}>
                          <span style={{color:t.text,fontWeight:700}}>{inr(dNet)}</span>
                          {dBal>0&&<span style={{color:"#ef4444",marginLeft:6,fontSize:10}}>due {inr(dBal)}</span>}
                        </div>
                      </div>
                    ))}
                    {custDelivs.length>5&&<p style={{color:t.sub,fontSize:10,marginTop:4,textAlign:"center"}}>+{custDelivs.length-5} more deliveries</p>}
                  </div>}
                  <div className="flex gap-2 mt-3">
                    {hasDue&&<button onClick={()=>{setPayLedgerCust(c);setPayLedgerAmt(String(Math.max(totalBalance,c.pending||0)));setPayLedgerNote("");setPayLedgerMethod("Cash");setPayLedgerSh(true);}}
                      style={{flex:1,background:"#10b981",color:"#fff",borderRadius:10,padding:"8px 12px",fontSize:12,fontWeight:700,border:"none",cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
                      💰 Record Payment
                    </button>}
                    <button onClick={()=>{setDetailModal({type:"customer",data:c});}}
                      style={{flex:1,background:t.inp,color:t.text,borderRadius:10,padding:"8px 12px",fontSize:12,fontWeight:600,border:`1px solid ${t.border}`,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
                      👤 View Customer
                    </button>
                  </div>
                </div>;
              })}
              {custOutstanding.length===0&&<p style={{color:t.sub,textAlign:"center",padding:"40px 0",fontSize:13}}>All customers are fully settled! 🎉</p>}
            </>}

            {/* ── DAILY SUMMARY sub-tab ── */}
            {paymentsSubTab==="daily"&&<>
              {dailySummary.length===0&&<p style={{color:t.sub,textAlign:"center",padding:"40px 0",fontSize:13}}>No payment data yet.</p>}
              {dailySummary.map(day=>{
                const isToday=day.date===todayStr;
                return <div key={day.date} style={{background:isToday?(dm?"#0a1f12":"#f0fdf4"):t.card,border:`1px solid ${isToday?"#10b98140":t.border}`,borderRadius:16,padding:"14px 16px"}}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p style={{color:isToday?"#10b981":t.text,fontWeight:800,fontSize:14}}>{isToday?"🌟 Today — ":""}{new Date(day.date+"T00:00:00").toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})}</p>
                      <p style={{color:t.sub,fontSize:11}}>{day.delivCount} deliveries</p>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <p style={{color:"#10b981",fontWeight:900,fontSize:16}}>{inr(day.totalCash)}</p>
                      <p style={{color:t.sub,fontSize:10}}>total collected</p>
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                    {[
                      {label:"Orders",val:inr(day.dayOrdered),color:t.text},
                      {label:"Replaced",val:inr(day.dayRepl),color:"#f97316"},
                      {label:"Collected",val:inr(day.dayCollected),color:"#10b981"},
                      {label:"Still Due",val:inr(day.dayPending),color:day.dayPending>0?"#ef4444":"#10b981"},
                    ].map(({label,val,color})=>(
                      <div key={label} style={{background:t.inp,borderRadius:8,padding:"6px 8px",textAlign:"center"}}>
                        <p style={{color,fontWeight:800,fontSize:11,lineHeight:1}}>{val}</p>
                        <p style={{color:t.sub,fontSize:8,marginTop:3,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</p>
                      </div>
                    ))}
                  </div>
                  {(day.dayPartial>0||day.daySettled>0||day.dayUnpaid>0)&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                    {day.daySettled>0&&<span style={{background:"#10b98115",color:"#10b981",borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>✓ {day.daySettled} settled</span>}
                    {day.dayPartial>0&&<span style={{background:"#f59e0b15",color:"#f59e0b",borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>⚡ {day.dayPartial} partial</span>}
                    {day.dayUnpaid>0&&<span style={{background:"#ef444415",color:"#ef4444",borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>⏳ {day.dayUnpaid} unpaid</span>}
                    {day.dayManual>0&&<span style={{background:"#3b82f615",color:"#3b82f6",borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>💳 {inr(day.dayManual)} manual</span>}
                  </div>}
                </div>;
              })}
            </>}
          </>;
        })()}

        {/* P&L TAB */}
        {tab==="P&L"&&isAdmin&&(()=>{
          // ── Compute date window ──────────────────────────────────────
          const nowD=new Date();
          let dateFrom, dateTo=today();
          if(plPeriod==="1d"){const d=new Date(nowD);d.setDate(d.getDate()-1);dateFrom=d.toISOString().slice(0,10);}
          else if(plPeriod==="1w"){const d=new Date(nowD);d.setDate(d.getDate()-6);dateFrom=d.toISOString().slice(0,10);}
          else if(plPeriod==="1m"){const d=new Date(nowD);d.setMonth(d.getMonth()-1);dateFrom=d.toISOString().slice(0,10);}
          else if(plPeriod==="2m"){const d=new Date(nowD);d.setMonth(d.getMonth()-2);dateFrom=d.toISOString().slice(0,10);}
          else if(plPeriod==="3m"){const d=new Date(nowD);d.setMonth(d.getMonth()-3);dateFrom=d.toISOString().slice(0,10);}
          else if(plPeriod==="6m"){const d=new Date(nowD);d.setMonth(d.getMonth()-6);dateFrom=d.toISOString().slice(0,10);}
          else if(plPeriod==="12m"){const d=new Date(nowD);d.setFullYear(d.getFullYear()-1);dateFrom=d.toISOString().slice(0,10);}
          else if(plPeriod==="custom"){dateFrom=plCustomFrom||today();dateTo=plCustomTo||today();}
          else{const d=new Date(nowD);d.setMonth(d.getMonth()-6);dateFrom=d.toISOString().slice(0,10);}

          // ── Build monthly buckets for charts ────────────────────────
          const months=[];
          const mCur=new Date(dateFrom.slice(0,7)+"-01");
          const mEnd=new Date(dateTo.slice(0,7)+"-01");
          while(mCur<=mEnd){months.push(mCur.toISOString().slice(0,7));mCur.setMonth(mCur.getMonth()+1);}
          if(months.length===0) months.push(today().slice(0,7));

          const mData=months.map(m=>({
            month:m.slice(5)+"/"+m.slice(2,4),
            rawMonth:m,
            monthFull:new Date(m+"-01").toLocaleString("en-IN",{month:"short",year:"numeric"}),
            revenue:deliveries.filter(d=>d.date?.startsWith(m)&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines)-(+d.replacement?.amount||0),0),
            supplyCost:supplies.filter(s=>s.date?.startsWith(m)).reduce((s,x)=>s+(x.cost||0),0),
            expenses:expenses.filter(e=>e.date?.startsWith(m)).reduce((s,e)=>s+(e.amount||0),0),
            wasteCost:(wastage||[]).filter(w=>w.date?.startsWith(m)).reduce((s,w)=>s+(w.cost||0),0),
            replDeducted:deliveries.filter(d=>d.date?.startsWith(m)&&d.status==="Delivered").reduce((s,d)=>s+(+d.replacement?.amount||0),0),
            deliveriesCount:deliveries.filter(d=>d.date?.startsWith(m)&&d.status==="Delivered").length,
            prodActual:(prodTargets||[]).filter(p=>p.date?.startsWith(m)).reduce((s,p)=>s+(+p.actual||0),0),
            prodTarget:(prodTargets||[]).filter(p=>p.date?.startsWith(m)).reduce((s,p)=>s+(+p.target||0),0),
            wastageQty:(wastage||[]).filter(w=>w.date?.startsWith(m)).reduce((s,w)=>s+(w.qty||0),0),
          })).map(m=>({...m,totalCost:m.supplyCost+m.expenses+m.wasteCost,profit:m.revenue-m.supplyCost-m.expenses-m.wasteCost,margin:m.revenue>0?Math.round((m.revenue-m.supplyCost-m.expenses-m.wasteCost)/m.revenue*100):0,grossMargin:m.revenue>0?Math.round((m.revenue-m.supplyCost)/m.revenue*100):0,prodEfficiency:m.prodTarget>0?Math.round(m.prodActual/m.prodTarget*100):0}));

          // ── Period-filtered totals ──────────────────────────────────
          const filtD=deliveries.filter(d=>d.date>=dateFrom&&d.date<=dateTo&&d.status==="Delivered");
          const filtS=supplies.filter(s=>s.date>=dateFrom&&s.date<=dateTo);
          const filtE=expenses.filter(e=>e.date>=dateFrom&&e.date<=dateTo);
          const filtW=(wastage||[]).filter(w=>w.date>=dateFrom&&w.date<=dateTo);
          const totRev=filtD.reduce((s,d)=>s+lineTotal(d.orderLines)-(+d.replacement?.amount||0),0);
          const totReplDeducted=filtD.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
          const totSupC=filtS.reduce((s,x)=>s+(x.cost||0),0);
          const totExpC=filtE.reduce((s,e)=>s+(e.amount||0),0);
          const totWasteC=filtW.reduce((s,w)=>s+(w.cost||0),0);
          const totCost=totSupC+totExpC+totWasteC;
          const totProfit=totRev-totCost;
          const totMargin=totRev>0?Math.round(totProfit/totRev*100):0;
          const totDue=customers.reduce((s,c)=>s+(c.pending||0),0);
          const totCollected=customers.reduce((s,c)=>s+(c.paid||0),0);
          const collectionRate=totCollected+totDue>0?Math.round(totCollected/(totCollected+totDue)*100):100;

          // MoM comparison
          const lastM=mData[mData.length-1]||{revenue:0,profit:0,margin:0};
          const prevM=mData[mData.length-2]||null;
          const momRev=prevM&&prevM.revenue>0?Math.round((lastM.revenue-prevM.revenue)/prevM.revenue*100):null;
          const momProfit=prevM&&prevM.profit!==0?Math.round((lastM.profit-prevM.profit)/Math.abs(prevM.profit)*100):null;

          const activeMonths=mData.filter(m=>m.revenue>0);
          const avgMonthlyRev=activeMonths.length>0?Math.round(totRev/activeMonths.length):0;
          const avgMonthlyProfit=activeMonths.length>0?Math.round(totProfit/activeMonths.length):0;
          const avgMonthlyCost=activeMonths.length>0?Math.round(totCost/activeMonths.length):0;
          const bestMonth=mData.reduce((b,m)=>m.profit>b.profit?m:b,mData[0]||{profit:0,monthFull:"—",month:null,rawMonth:null});
          const worstMonth=mData.reduce((b,m)=>m.profit<b.profit?m:b,mData[0]||{profit:0,monthFull:"—",month:null,rawMonth:null});

          // ── Products sold in period ──────────────────────────────────────
          const periodProdMap={};
          filtD.forEach(d=>{Object.entries(safeO(d.orderLines)).forEach(([pid,l])=>{if(l.qty>0){if(!periodProdMap[pid])periodProdMap[pid]={name:l.name||products.find(p=>p.id===pid)?.name||pid,qty:0,rev:0};periodProdMap[pid].qty+=l.qty;periodProdMap[pid].rev+=(l.qty||0)*(l.priceAmount||0);}});});
          const periodProdArr=Object.values(periodProdMap).sort((a,b)=>b.rev-a.rev);
          const recentHalf=mData.slice(Math.floor(mData.length/2));
          const olderHalf=mData.slice(0,Math.floor(mData.length/2));
          const recentRevAvg=recentHalf.length>0?recentHalf.reduce((s,m)=>s+m.revenue,0)/recentHalf.length:0;
          const olderRevAvg=olderHalf.length>0?olderHalf.reduce((s,m)=>s+m.revenue,0)/olderHalf.length:0;
          const trendUp=recentRevAvg>=olderRevAvg;

          const healthScore=Math.min(100,Math.max(0,
            (totMargin>=30?30:totMargin>=15?20:totMargin>=0?10:0)+
            (collectionRate>=95?25:collectionRate>=80?15:5)+
            (trendUp?20:0)+
            (totWasteC/Math.max(totCost,1)<0.05?15:totWasteC/Math.max(totCost,1)<0.15?10:0)+
            (activeMonths.length>=Math.round(months.length*0.7)?10:5)
          ));
          const healthColor=healthScore>=75?"#10b981":healthScore>=50?"#f59e0b":"#ef4444";
          const healthLabel=healthScore>=75?"Healthy":healthScore>=50?"Moderate":"Needs Attention";

          const insights=[];
          if(totMargin<15&&totRev>0) insights.push({icon:"⚠️",text:`Margin is ${totMargin}% — below the 15% healthy threshold. Review cost structure.`});
          if(totMargin>=30) insights.push({icon:"✅",text:`Strong ${totMargin}% margin. Business is performing well above benchmark.`});
          if(totDue>totRev*0.15) insights.push({icon:"🔴",text:`Outstanding dues (${inr(totDue)}) are ${Math.round(totDue/Math.max(totRev,1)*100)}% of revenue. Prioritise collection.`});
          if(trendUp&&recentRevAvg>olderRevAvg*1.1) insights.push({icon:"📈",text:`Revenue growing — recent avg ${inr(Math.round(recentRevAvg))} vs ${inr(Math.round(olderRevAvg))} prior.`});
          if(!trendUp&&olderRevAvg>recentRevAvg*1.1) insights.push({icon:"📉",text:`Revenue declining — recent avg ${inr(Math.round(recentRevAvg))} vs ${inr(Math.round(olderRevAvg))} prior.`});
          if(totWasteC>totCost*0.1) insights.push({icon:"🗑️",text:`Wastage (${inr(totWasteC)}) is ${Math.round(totWasteC/Math.max(totCost,1)*100)}% of costs — worth reducing.`});

          const cashCollected=customers.reduce((s,c)=>s+(c.paid||0),0);
          const cashPending=customers.reduce((s,c)=>s+(c.pending||0),0);
          const cashFlowPct=cashCollected+cashPending>0?Math.round(cashCollected/(cashCollected+cashPending)*100):100;
          const burnRate=activeMonths.length>0?Math.round(totCost/activeMonths.length):0;
          if(burnRate>0&&avgMonthlyRev<burnRate) insights.push({icon:"🔥",text:`Burn rate (${inr(burnRate)}/mo) exceeds avg revenue (${inr(avgMonthlyRev)}). Spending more than earning.`});
          if(cashPending>cashCollected*0.3) insights.push({icon:"💸",text:`${inr(cashPending)} in uncollected cash. Accelerate collections.`});

          const PL_PERIODS=[["1d","Day"],["1w","Week"],["1m","Month"],["2m","2M"],["3m","3M"],["6m","6M"],["12m","12M"],["custom","Custom ✦"]];
          const periodLabel=plPeriod==="custom"?`${plCustomFrom||"—"} → ${plCustomTo}`:PL_PERIODS.find(p=>p[0]===plPeriod)?.[1]||"";

          return <>
            {/* ── PERIOD SELECTOR + EXPORT ── */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p style={{color:t.text}} className="font-black text-base">Profit & Loss</p>
                <p style={{color:t.sub}} className="text-xs">INR · Accrual · {periodLabel}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div style={{background:t.inp,border:`1px solid ${t.border}`,borderRadius:10,padding:3,display:"flex",gap:2,flexWrap:"wrap"}}>
                  {PL_PERIODS.map(([v,l])=>(
                    <button key={v} onClick={()=>setPlPeriod(v)}
                      style={plPeriod===v
                        ?{background:dm?"#3b82f6":"#1e3a5f",color:"#fff",borderRadius:7,padding:"4px 10px",fontSize:11,fontWeight:700,touchAction:"manipulation",WebkitTapHighlightColor:"transparent"}
                        :{background:"transparent",color:t.sub,borderRadius:7,padding:"4px 10px",fontSize:11,fontWeight:600,touchAction:"manipulation",WebkitTapHighlightColor:"transparent"}}>{l}</button>
                  ))}
                </div>
                <Btn dm={dm} v="outline" size="sm" onClick={()=>exportCSV(mData,"pl_report",[{label:"Month",key:"monthFull"},{label:"Revenue",key:"revenue"},{label:"Supply Cost",key:"supplyCost"},{label:"Expenses",key:"expenses"},{label:"Waste Cost",key:"wasteCost"},{label:"Total Cost",key:"totalCost"},{label:"Profit/Loss",key:"profit"},{label:"Margin %",key:"margin"},{label:"Deliveries",key:"deliveriesCount"}])}>📊 CSV</Btn>
              </div>
            </div>
            {/* ── Custom date inputs ── */}
            {plPeriod==="custom"&&<div style={{background:t.inp,border:`1px solid ${t.border}`,borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
              <span style={{color:t.sub,fontSize:12,fontWeight:600}}>From</span>
              <input type="date" value={plCustomFrom} onChange={e=>setPlCustomFrom(e.target.value)} style={{background:t.card,border:`1px solid ${t.inpB}`,color:t.text,fontSize:13,borderRadius:8,padding:"5px 10px",outline:"none",touchAction:"manipulation"}}/>
              <span style={{color:t.sub,fontSize:12,fontWeight:600}}>To</span>
              <input type="date" value={plCustomTo} max={today()} onChange={e=>setPlCustomTo(e.target.value)} style={{background:t.card,border:`1px solid ${t.inpB}`,color:t.text,fontSize:13,borderRadius:8,padding:"5px 10px",outline:"none",touchAction:"manipulation"}}/>
              {plCustomFrom&&plCustomTo&&<span style={{color:"#10b981",fontSize:11,fontWeight:700}}>✓ {Math.round((new Date(plCustomTo)-new Date(plCustomFrom))/86400000)+1} days</span>}
            </div>}

            {/* ── HERO KPI BANNER ── */}
            <div style={{background:dm?"linear-gradient(135deg,#0a1628,#0d1f12)":"linear-gradient(135deg,#eff6ff,#f0fdf4)",border:dm?"1px solid #1e3a5f":"1px solid #bfdbfe",borderRadius:20,padding:"20px 22px"}}>
              <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{background:healthColor+"20",color:healthColor,borderRadius:8,padding:"2px 10px",fontSize:11,fontWeight:700}}>{healthLabel}</span>
                    <span style={{color:t.sub,fontSize:11}}>Health Score: <strong style={{color:healthColor}}>{healthScore}/100</strong></span>
                  </div>
                  <p style={{color:t.text}} className="font-black text-xl leading-tight">
                    {inr(totProfit)} <span style={{color:totProfit>=0?"#10b981":"#ef4444",fontSize:13}}>{totMargin}% margin</span>
                  </p>
                  <p style={{color:t.sub}} className="text-xs mt-0.5">Net profit over last {plRange} months</p>
                  {momProfit!==null&&<p style={{color:momProfit>=0?"#10b981":"#ef4444",fontSize:11,marginTop:4,fontWeight:700}}>{momProfit>=0?"▲":"▼"} {Math.abs(momProfit)}% profit vs prior month</p>}
                </div>
                <div className="grid grid-cols-2 gap-2 shrink-0">
                  {[
                    {label:"Net Revenue",val:inr(totRev),color:"#10b981",sub:momRev!==null?`${momRev>=0?"▲":"▼"}${Math.abs(momRev)}% MoM`:totReplDeducted>0?`−${inr(totReplDeducted)} replacements`:null},
                    {label:"Total Costs",val:inr(totCost),color:"#ef4444",sub:`avg ${inr(avgMonthlyCost)}/mo`},
                    {label:"Collection Rate",val:`${collectionRate}%`,color:collectionRate>=90?"#10b981":collectionRate>=70?"#f59e0b":"#ef4444",sub:`${inr(totDue)} due`},
                    {label:"Avg Monthly Rev",val:inr(avgMonthlyRev),color:"#f59e0b",sub:`avg profit ${inr(avgMonthlyProfit)}/mo`},
                  ].map(x=><div key={x.label}
                    onMouseEnter={ev=>{ev.currentTarget.style.transform="scale(1.04)";ev.currentTarget.style.boxShadow=`0 4px 16px ${x.color}30`;}}
                    onMouseLeave={ev=>{ev.currentTarget.style.transform="scale(1)";ev.currentTarget.style.boxShadow="none";}}
                    style={{background:dm?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.75)",borderRadius:12,padding:"10px 14px",minWidth:120,cursor:"default",transition:"all .18s ease",border:`1px solid ${x.color}20`}}>
                    <p style={{color:x.color}} className="font-black text-base leading-none">{x.val}</p>
                    <p style={{color:t.sub}} className="text-[10px] font-semibold mt-0.5">{x.label}</p>
                    {x.sub&&<p style={{color:t.sub,fontSize:9,marginTop:2}}>{x.sub}</p>}
                  </div>)}
                </div>
              </div>
              {/* Revenue vs cost stacked bar */}
              {totRev>0&&<div>
                <div className="flex justify-between mb-1"><span style={{color:t.sub,fontSize:10}}>Revenue allocation</span><span style={{color:t.sub,fontSize:10}}>{inr(totRev)} total</span></div>
                <div style={{height:12,borderRadius:12,overflow:"hidden",display:"flex",gap:1}}>
                  <div title="Profit" style={{width:`${Math.max(0,Math.round(totProfit/totRev*100))}%`,background:"#10b981",borderRadius:"12px 0 0 12px",transition:"width 0.6s ease"}}/>
                  <div title="Supply" style={{width:`${Math.round(totSupC/totRev*100)}%`,background:"#8b5cf6"}}/>
                  <div title="Expenses" style={{width:`${Math.round(totExpC/totRev*100)}%`,background:"#ef4444"}}/>
                  <div title="Waste" style={{width:`${Math.round(totWasteC/totRev*100)}%`,background:"#f97316",borderRadius:"0 12px 12px 0"}}/>
                </div>
                <div className="flex gap-3 mt-1.5 flex-wrap">
                  {[["#10b981","Profit",Math.max(0,totMargin)],["#8b5cf6","Supply",Math.round(totSupC/totRev*100)],["#ef4444","Expenses",Math.round(totExpC/totRev*100)],["#f97316","Waste",Math.round(totWasteC/totRev*100)]].map(([c,l,p])=>(
                    <div key={l} className="flex items-center gap-1"><div style={{width:8,height:8,borderRadius:2,background:c}}/><span style={{color:t.sub,fontSize:9}}>{l} {p}%</span></div>
                  ))}
                </div>
              </div>}
            </div>

            {/* ── SMART INSIGHTS — Interactive ── */}
            {insights.length>0&&<div style={{background:t.card,border:`1.5px solid ${plInsightExpanded?"#3b82f6":t.border}`,borderRadius:16,padding:"14px 16px",cursor:"pointer",transition:"border-color .15s"}} onClick={()=>setPlInsightExpanded(p=>!p)}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <p style={{color:t.sub}} className="text-[10px] font-bold uppercase tracking-widest">💡 Smart Insights</p>
                  <span style={{background:"#3b82f620",color:"#3b82f6",borderRadius:6,padding:"1px 7px",fontSize:9,fontWeight:700}}>{insights.length} insights</span>
                </div>
                <span style={{color:t.sub,fontSize:13,transition:"transform .2s",display:"inline-block",transform:plInsightExpanded?"rotate(180deg)":"rotate(0deg)"}}>⌄</span>
              </div>
              {/* Preview — always show first insight */}
              {!plInsightExpanded&&<div className="flex items-start gap-2">
                <span style={{fontSize:14,lineHeight:1.4}}>{insights[0].icon}</span>
                <p style={{color:t.text,fontSize:12,lineHeight:1.5}}>{insights[0].text}</p>
              </div>}
              {!plInsightExpanded&&insights.length>1&&<p style={{color:"#3b82f6",fontSize:10,fontWeight:600,marginTop:6}}>+{insights.length-1} more — tap to expand</p>}
              {/* Full expanded */}
              {plInsightExpanded&&<div className="flex flex-col gap-3" onClick={e=>e.stopPropagation()}>
                {insights.map((ins,i)=>(
                  <div key={i} style={{background:t.inp,borderRadius:10,padding:"10px 12px"}} className="flex items-start gap-2">
                    <span style={{fontSize:16,lineHeight:1.3,flexShrink:0}}>{ins.icon}</span>
                    <div>
                      <p style={{color:t.text,fontSize:12,lineHeight:1.5}}>{ins.text}</p>
                    </div>
                  </div>
                ))}
                {/* Action recommendations */}
                <div style={{background:"#3b82f612",border:"1px solid #3b82f630",borderRadius:10,padding:"10px 12px"}}>
                  <p style={{color:"#3b82f6",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Recommended Actions</p>
                  {netProfit<0&&<p style={{color:t.text,fontSize:11,lineHeight:1.5}}>• Review highest-cost expense categories and identify reduction opportunities.</p>}
                  {totalDue>totalRev*0.1&&<p style={{color:t.text,fontSize:11,lineHeight:1.5}}>• Follow up on outstanding payments — {customers.filter(c=>c.pending>0).length} customers owe {inr(totalDue)}.</p>}
                  {(wastage||[]).length>0&&<p style={{color:t.text,fontSize:11,lineHeight:1.5}}>• Investigate top wastage products to reduce {inr((wastage||[]).reduce((s,w)=>s+(w.cost||0),0))} in losses.</p>}
                </div>
              </div>}
            </div>}

            {/* ── CASH FLOW + BURN RATE ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Cash Flow */}
              <div style={{background:dm?"linear-gradient(135deg,#0a1628,#0a2010)":"linear-gradient(135deg,#f0fdf4,#eff6ff)",border:dm?"1px solid #1e3a5f":"1px solid #bbf7d0",borderRadius:18,padding:"16px 18px"}}>
                <p style={{color:t.sub,fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>💵 Cash Flow Status</p>
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <p style={{color:"#10b981"}} className="font-black text-xl leading-none">{inr(cashCollected)}</p>
                    <p style={{color:t.sub,fontSize:10,marginTop:2}}>Collected from customers</p>
                  </div>
                  <div className="text-right">
                    <p style={{color:cashPending>0?"#ef4444":"#10b981"}} className="font-black text-base leading-none">{inr(cashPending)}</p>
                    <p style={{color:t.sub,fontSize:10,marginTop:2}}>Pending / due</p>
                  </div>
                </div>
                <div style={{height:8,borderRadius:8,overflow:"hidden",display:"flex",background:t.border}}>
                  <div style={{width:`${cashFlowPct}%`,background:"#10b981",borderRadius:"8px 0 0 8px",transition:"width 0.6s"}}/>
                  <div style={{width:`${100-cashFlowPct}%`,background:"#ef4444",borderRadius:"0 8px 8px 0"}}/>
                </div>
                <div className="flex justify-between mt-1.5">
                  <span style={{color:"#10b981",fontSize:10,fontWeight:700}}>{cashFlowPct}% collected</span>
                  <span style={{color:"#ef4444",fontSize:10,fontWeight:700}}>{100-cashFlowPct}% outstanding</span>
                </div>
              </div>
              {/* Burn Rate */}
              <div style={{background:dm?"linear-gradient(135deg,#1a0a0a,#1a100a)":"linear-gradient(135deg,#fff7ed,#fef2f2)",border:dm?"1px solid #3a1a1a":"1px solid #fecaca",borderRadius:18,padding:"16px 18px"}}>
                <p style={{color:t.sub,fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>🔥 Burn Rate & Efficiency</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p style={{color:burnRate>avgMonthlyRev?"#ef4444":"#f59e0b"}} className="font-black text-xl leading-none">{inr(burnRate)}</p>
                    <p style={{color:t.sub,fontSize:10,marginTop:2}}>Avg monthly burn</p>
                  </div>
                  <div>
                    <p style={{color:"#10b981"}} className="font-black text-xl leading-none">{inr(avgMonthlyRev)}</p>
                    <p style={{color:t.sub,fontSize:10,marginTop:2}}>Avg monthly revenue</p>
                  </div>
                  <div>
                    <p style={{color:totMargin>=15?"#10b981":"#ef4444"}} className="font-black text-base leading-none">{totMargin}%</p>
                    <p style={{color:t.sub,fontSize:10,marginTop:2}}>Net margin</p>
                  </div>
                  <div>
                    <p style={{color:"#8b5cf6"}} className="font-black text-base leading-none">{inr(Math.max(0,avgMonthlyRev-burnRate))}</p>
                    <p style={{color:t.sub,fontSize:10,marginTop:2}}>Monthly surplus</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── PAYMENT BREAKDOWN (replacements, partial, pending) ── */}
            {(()=>{
              const delivPB=deliveries.filter(d=>dateFrom<=d.date&&d.date<=dateTo);
              const replCount=delivPB.filter(d=>d.replacement?.done).length;
              const replAmtPB=delivPB.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
              const partialCount=delivPB.filter(d=>d.partialPayment?.enabled&&(+(d.partialPayment?.amount)||0)>0).length;
              const partialAmt=delivPB.reduce((s,d)=>s+(d.partialPayment?.enabled?(+(d.partialPayment?.amount)||0):0),0);
              const fullyPaidCount=delivPB.filter(d=>{const net=lineTotal(d.orderLines)-(+d.replacement?.amount||0);const coll=d.partialPayment?.enabled?(+(d.partialPayment?.amount)||0):0;return net>0&&coll>=net;}).length;
              const unpaidCount=delivPB.filter(d=>!(d.partialPayment?.enabled&&(+(d.partialPayment?.amount)||0)>0)).length;
              const totalPBOrders=delivPB.reduce((s,d)=>s+lineTotal(d.orderLines),0);
              const netAfterRepl=totalPBOrders-replAmtPB;
              const pendingAmt=Math.max(0,netAfterRepl-partialAmt);
              const manualLedgerAmt=(paymentLedger||[]).filter(e=>e.date>=dateFrom&&e.date<=dateTo).reduce((s,e)=>s+e.amount,0);
              return <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"14px 16px"}}>
                <div className="flex items-center justify-between mb-3">
                  <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>💳 Payment Breakdown — {periodLabel}</p>
                  <button onClick={()=>setTab("Payments")} style={{background:"#3b82f615",color:"#3b82f6",border:"none",borderRadius:8,padding:"3px 10px",fontSize:10,fontWeight:700,cursor:"pointer"}}>Full Ledger →</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
                  {[
                    {label:"Total Orders",val:inr(totalPBOrders),color:t.text},
                    {label:"Repl Deducted",val:`−${inr(replAmtPB)}`,color:"#f97316",sub:`${replCount} replacements`},
                    {label:"Net Billed",val:inr(netAfterRepl),color:"#10b981"},
                    {label:"Collected",val:inr(partialAmt+manualLedgerAmt),color:"#10b981",sub:`${partialCount} deliveries`},
                    {label:"Manual Paid",val:inr(manualLedgerAmt),color:"#3b82f6"},
                    {label:"Still Pending",val:inr(pendingAmt),color:pendingAmt>0?"#ef4444":"#10b981"},
                  ].map(({label,val,color,sub})=>(
                    <div key={label} style={{background:t.inp,borderRadius:10,padding:"8px 10px"}}>
                      <p style={{color,fontWeight:800,fontSize:12,lineHeight:1}}>{val}</p>
                      <p style={{color:t.sub,fontSize:9,marginTop:3,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</p>
                      {sub&&<p style={{color:t.sub,fontSize:9,marginTop:1}}>{sub}</p>}
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {fullyPaidCount>0&&<span style={{background:"#10b98115",color:"#10b981",borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:700}}>✓ {fullyPaidCount} fully paid deliveries</span>}
                  {partialCount>0&&<span style={{background:"#f59e0b15",color:"#f59e0b",borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:700}}>⚡ {partialCount} partial payments</span>}
                  {unpaidCount>0&&<span style={{background:"#ef444415",color:"#ef4444",borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:700}}>⏳ {unpaidCount} unpaid deliveries</span>}
                  {replCount>0&&<span style={{background:"#f9731615",color:"#f97316",borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:700}}>🔄 {replCount} replacements · {inr(replAmtPB)} off</span>}
                </div>
              </div>;
            })()}

            {/* ── MONTH HIGHLIGHTS ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {label:"🏆 Best Month",name:bestMonth?.monthFull,val:inr(bestMonth?.profit||0),color:"#10b981",sub:"highest profit",month:bestMonth?.month},
                {label:"📉 Weakest Month",name:worstMonth?.monthFull,val:inr(worstMonth?.profit||0),color:(worstMonth?.profit||0)>=0?"#10b981":"#ef4444",sub:"lowest profit",month:worstMonth?.month},
                {label:"📊 Revenue Trend",name:trendUp?"Growing ▲":"Declining ▼",val:inr(Math.round(recentRevAvg)),color:trendUp?"#10b981":"#ef4444",sub:"recent avg/month",month:null},
              ].map(x=><div key={x.label}
                onMouseEnter={ev=>{ev.currentTarget.style.transform="translateY(-2px)";ev.currentTarget.style.boxShadow=`0 6px 20px ${x.color}25`;ev.currentTarget.style.borderColor=x.color+"60";}}
                onMouseLeave={ev=>{ev.currentTarget.style.transform="translateY(0)";ev.currentTarget.style.boxShadow="none";ev.currentTarget.style.borderColor=t.border;}}
                onClick={x.month?()=>setPlMonthExpanded(plMonthExpanded===x.month?null:x.month):undefined}
                style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,padding:"14px 16px",cursor:x.month?"pointer":"default",transition:"all .18s ease"}}>
                <p style={{color:t.sub}} className="text-[10px] font-bold uppercase tracking-wider mb-1">{x.label}</p>
                <p style={{color:t.text}} className="font-black text-base leading-none">{x.name||"—"}</p>
                <p style={{color:x.color}} className="font-semibold text-sm mt-0.5">{x.val} <span style={{color:t.sub,fontWeight:400,fontSize:10}}>{x.sub}</span></p>
                {x.month&&<p style={{color:x.color,fontSize:9,marginTop:4}}>tap to view month detail →</p>}
              </div>)}
            </div>

            {/* ── STANDALONE MONTH DETAIL PANEL (shown when best/worst card clicked) ── */}
            {plMonthExpanded&&(()=>{
              const selM=mData.find(m=>m.month===plMonthExpanded);
              if(!selM) return null;
              const mKey=selM.rawMonth||selM.month;
              const mDelivs=deliveries.filter(d=>d.date?.startsWith(mKey)&&d.status==="Delivered");
              const mExps=expenses.filter(e=>e.date?.startsWith(mKey));
              const mSups=supplies.filter(s=>s.date?.startsWith(mKey));
              const mWaste=(wastage||[]).filter(w=>w.date?.startsWith(mKey));
              // Check if this month is already visible in the table below
              const isInTable=mData.some(m=>m.month===plMonthExpanded);
              // Only show standalone panel if the month is NOT clickable in the table
              // (i.e., always show here since the table may not be visible / user may have scrolled)
              return <div style={{background:dm?"#0a1f0a":"#f0fff4",border:`2px solid #10b98140`,borderRadius:16,padding:"14px 16px",position:"relative"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <p style={{color:"#10b981",fontWeight:800,fontSize:13}}>📋 {selM.monthFull} — Full Breakdown</p>
                  <button onClick={()=>setPlMonthExpanded(null)} style={{background:"#10b98120",color:"#10b981",border:"none",borderRadius:8,padding:"3px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>✕ Close</button>
                </div>
                {/* Mini KPIs */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[["Revenue","#10b981",inr(selM.revenue),`${selM.deliveriesCount} orders`],["Supply","#8b5cf6",inr(selM.supplyCost),`${mSups.length} entries`],["Expenses","#ef4444",inr(selM.expenses),`${mExps.length} entries`],["Wastage","#f97316",inr(selM.wasteCost),`${mWaste.length} records`]].map(([l,c,v,sub])=>(
                    <div key={l} style={{background:c+"12",border:`1px solid ${c}30`,borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
                      <p style={{color:c,fontWeight:900,fontSize:12}}>{v}</p>
                      <p style={{color:t.sub,fontSize:9}}>{l}</p>
                      <p style={{color:t.sub,fontSize:8}}>{sub}</p>
                    </div>
                  ))}
                </div>
                <div style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:t.sub,fontSize:10}}>Revenue allocation</span><span style={{color:selM.profit>=0?"#10b981":"#ef4444",fontWeight:700,fontSize:10}}>{selM.margin}% margin</span></div>
                  <div style={{height:8,borderRadius:8,overflow:"hidden",display:"flex",background:t.border}}>
                    <div style={{width:`${Math.max(0,selM.margin)}%`,background:"#10b981"}}/>
                    <div style={{width:`${selM.revenue>0?Math.round(selM.supplyCost/selM.revenue*100):0}%`,background:"#8b5cf6"}}/>
                    <div style={{width:`${selM.revenue>0?Math.round(selM.expenses/selM.revenue*100):0}%`,background:"#ef4444"}}/>
                    <div style={{width:`${selM.revenue>0?Math.round(selM.wasteCost/selM.revenue*100):0}%`,background:"#f97316"}}/>
                  </div>
                </div>
                {/* Products sold */}
                {(()=>{
                  const mProdMap={};
                  mDelivs.forEach(d=>{Object.entries(safeO(d.orderLines)).forEach(([pid,l])=>{if(l.qty>0){if(!mProdMap[pid])mProdMap[pid]={name:l.name||products.find(p=>p.id===pid)?.name||pid,qty:0,rev:0};mProdMap[pid].qty+=l.qty;mProdMap[pid].rev+=(l.qty||0)*(l.priceAmount||0);}});});
                  const mProdArr=Object.values(mProdMap).sort((a,b)=>b.rev-a.rev);
                  if(!mProdArr.length) return null;
                  return <div style={{marginBottom:10}}>
                    <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>🛒 Products Sold ({mProdArr.length} SKUs)</p>
                    <div style={{display:"flex",flexDirection:"column",gap:3}}>
                      {mProdArr.map(p=>(<div key={p.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:t.inp,borderRadius:8,padding:"5px 10px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{color:t.text,fontSize:11,fontWeight:600}}>{p.name}</span><span style={{color:t.sub,fontSize:10}}>{p.qty} units</span></div><span style={{color:"#10b981",fontWeight:700,fontSize:11}}>{inr(p.rev)}</span></div>))}
                    </div>
                  </div>;
                })()}
                {/* Deliveries */}
                {mDelivs.length>0&&<div style={{marginBottom:8}}>
                  <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>📦 Deliveries ({mDelivs.length})</p>
                  <div style={{maxHeight:200,overflowY:"auto"}}>
                    {mDelivs.sort((a,b)=>lineTotal(b.orderLines)-lineTotal(a.orderLines)).map((d,di)=>{
                      const plInvNo=(invRegistry?.issued||{})[d.id]||d.invNo||null;
                      const plRcptNo=plInvNo?`RCP-${plInvNo.replace(/^[A-Z]+-/,"")}`:null;
                      const linkedBatches=(prodTargets||[]).filter(pt=>pt.date===d.date&&(pt.linkedInvoices||[]).includes(plInvNo));
                      const batchLabels=linkedBatches.length>0?linkedBatches.map(b=>b.batchLabel||"Batch").join(", "):null;
                      const dItems=Object.entries(safeO(d.orderLines)).filter(([,l])=>l.qty>0).map(([pid,l])=>{const pn=products.find(p=>p.id===pid);return `${l.qty}×${pn?pn.name:(l.name||pid)}`;}).join(", ");
                      return <div key={d.id||di} style={{borderBottom:di<mDelivs.length-1?`1px solid ${t.border+"44"}`:"none",cursor:"pointer",padding:"6px 4px"}} onClick={()=>setDetailModal({type:"delivery",data:d})}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                          <div style={{minWidth:0}}>
                            <span style={{color:t.text,fontSize:11,fontWeight:700}}>{d.customer}</span>
                            <div style={{display:"flex",flexWrap:"wrap",gap:3,marginTop:2}}>
                              {plInvNo&&<span style={{color:"#8b5cf6",fontSize:9,fontFamily:"monospace",background:dm?"rgba(139,92,246,0.12)":"rgba(139,92,246,0.07)",borderRadius:3,padding:"1px 5px"}}>📄 {plInvNo}</span>}
                              {plRcptNo&&<span style={{color:"#0ea5e9",fontSize:9,fontFamily:"monospace",background:dm?"rgba(14,165,233,0.12)":"rgba(14,165,233,0.07)",borderRadius:3,padding:"1px 5px"}}>🧾 {plRcptNo}</span>}
                              {batchLabels&&<span style={{color:"#7c3aed",fontSize:9,background:dm?"rgba(124,58,237,0.12)":"rgba(124,58,237,0.07)",borderRadius:3,padding:"1px 5px"}}>🏭 {batchLabels}</span>}
                            </div>
                            {dItems&&<p style={{color:t.sub,fontSize:9,marginTop:2}}>{dItems}</p>}
                          </div>
                          <span style={{color:"#10b981",fontWeight:700,fontSize:11,flexShrink:0,marginLeft:8}}>{inr(lineTotal(d.orderLines))}</span>
                        </div>
                      </div>;
                    })}
                  </div>
                </div>}
                {/* Supplies */}
                {mSups.length>0&&<div style={{marginBottom:8}}>
                  <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>📦 Supplies ({mSups.length})</p>
                  <div style={{maxHeight:80,overflowY:"auto"}}>
                    {mSups.sort((a,b)=>(b.cost||0)-(a.cost||0)).map((s,si)=>(<div key={s.id||si} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderBottom:si<mSups.length-1?`1px solid ${t.border+"44"}`:"none"}}><span style={{color:t.text,fontSize:11}}>{s.item}{s.supplier?` · ${s.supplier}`:""}</span><span style={{color:"#8b5cf6",fontWeight:700,fontSize:11}}>{inr(s.cost||0)}</span></div>))}
                  </div>
                </div>}
                {/* Expenses */}
                {mExps.length>0&&<div>
                  <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>💸 Expenses ({mExps.length})</p>
                  <div style={{maxHeight:100,overflowY:"auto"}}>
                    {mExps.sort((a,b)=>(b.amount||0)-(a.amount||0)).map((e,ei)=>(<div key={e.id||ei} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderBottom:ei<mExps.length-1?`1px solid ${t.border+"44"}`:"none",cursor:"pointer"}} onClick={()=>setDetailModal({type:"expense",data:e})}><span style={{color:t.text,fontSize:11}}>{e.category}{e.vendor?` · ${e.vendor}`:""}</span><span style={{color:"#ef4444",fontWeight:700,fontSize:11}}>{inr(e.amount)}</span></div>))}
                  </div>
                </div>}
                {isInTable&&<p style={{color:t.sub,fontSize:10,marginTop:10,textAlign:"center"}}>↓ Also visible in the monthly table below</p>}
              </div>;
            })()}

            {/* ── MONTHLY P&L CHART ── */}
            <Card dm={dm} className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p style={{color:t.text}} className="font-bold text-sm">Revenue · Cost · Profit — {plRange} Month View</p>
                  <p style={{color:t.sub}} className="text-[11px]">Stacked monthly breakdown</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={mData} margin={{top:4,right:4,left:-10,bottom:0}} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false}/>
                  <XAxis dataKey="monthFull" tick={{fontSize:10,fill:t.sub}}/>
                  <YAxis tick={{fontSize:10,fill:t.sub}} tickFormatter={v=>v>=1000?`₹${(v/1000).toFixed(0)}k`:`₹${v}`}/>
                  <Tooltip contentStyle={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,color:t.text,fontSize:11}} formatter={(v,n)=>[inr(v),n]}/>
                  <Legend wrapperStyle={{fontSize:11,paddingTop:8}}/>
                  <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4,4,0,0]}/>
                  <Bar dataKey="totalCost" name="Total Cost" fill="#ef4444" radius={[4,4,0,0]}/>
                  <Bar dataKey="profit" name="Profit" fill="#f59e0b" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* ── MARGIN TREND LINE ── */}
            <Card dm={dm} className="p-4">
              <p style={{color:t.text}} className="font-bold text-sm mb-0.5">Profit Margin Trend</p>
              <p style={{color:t.sub}} className="text-[11px] mb-3">Month-by-month · dashed line = 30% healthy target</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={mData} margin={{top:8,right:8,left:-20,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false}/>
                  <XAxis dataKey="monthFull" tick={{fontSize:10,fill:t.sub}}/>
                  <YAxis tick={{fontSize:10,fill:t.sub}} tickFormatter={v=>`${v}%`} domain={['auto','auto']}/>
                  <Tooltip contentStyle={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,color:t.text,fontSize:11}} formatter={(v,n)=>[`${v}%`,n]}/>
                  <Legend wrapperStyle={{fontSize:11,paddingTop:6}}/>
                  <ReferenceLine y={30} stroke="#10b981" strokeDasharray="6 3" strokeWidth={1.5} label={{value:"Target 30%",position:"right",fill:"#10b981",fontSize:9,fontWeight:700}}/>
                  <Line type="monotone" dataKey="margin" name="Net Margin %" stroke="#f59e0b" strokeWidth={2.5} dot={{fill:"#f59e0b",r:4}} activeDot={{r:6}}/>
                  <Line type="monotone" dataKey="grossMargin" name="Gross Margin %" stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="4 2" dot={false}/>
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* ── COST STRUCTURE ── */}
            <Card dm={dm} className="p-4">
              <p style={{color:t.text}} className="font-bold text-sm mb-4">Cost Structure — {plRange}-Month Total</p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  {label:"Supply Costs",val:totSupC,color:"#8b5cf6",pct:totCost>0?Math.round(totSupC/totCost*100):0,sub:"Raw material"},
                  {label:"Operating Expenses",val:totExpC,color:"#ef4444",pct:totCost>0?Math.round(totExpC/totCost*100):0,sub:"Gas, labour, etc."},
                  {label:"Wastage Losses",val:totWasteC,color:"#f97316",pct:totCost>0?Math.round(totWasteC/totCost*100):0,sub:"Avoidable losses"},
                ].map(x=><div key={x.label} style={{background:t.inp,borderRadius:12,padding:"12px 14px",borderTop:`3px solid ${x.color}`}}>
                  <p style={{color:x.color}} className="font-black text-base leading-none">{inr(x.val)}</p>
                  <p style={{color:t.text}} className="text-[11px] font-semibold mt-1">{x.label}</p>
                  <p style={{color:t.sub,fontSize:10}}>{x.sub}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div style={{flex:1,background:t.border,height:3,borderRadius:3,overflow:"hidden",marginRight:6}}><div style={{width:`${x.pct}%`,background:x.color,height:"100%",borderRadius:3}}/></div>
                    <span style={{color:x.color,fontSize:11,fontWeight:800}}>{x.pct}%</span>
                  </div>
                </div>)}
              </div>
              {totCost>0&&<>
                <div style={{height:10,borderRadius:10,overflow:"hidden",display:"flex",gap:1}}>
                  <div style={{width:`${Math.round(totSupC/totCost*100)}%`,background:"#8b5cf6",borderRadius:"10px 0 0 10px"}}/>
                  <div style={{width:`${Math.round(totExpC/totCost*100)}%`,background:"#ef4444"}}/>
                  <div style={{width:`${Math.round(totWasteC/totCost*100)}%`,background:"#f97316",borderRadius:"0 10px 10px 0"}}/>
                </div>
                <p style={{color:t.sub,fontSize:10,marginTop:6,textAlign:"right"}}>Total costs: {inr(totCost)}</p>
              </>}
            </Card>

            {/* ── MONTHLY DETAILED TABLE ── */}
            <Card dm={dm} className="overflow-hidden">
              <div className="p-4 pb-2 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p style={{color:t.text}} className="text-sm font-bold">Monthly Breakdown Table</p>
                  <p style={{color:t.sub}} className="text-[11px]">All figures INR · ▲▼ = change vs prior month</p>
                </div>
                <Btn dm={dm} v="outline" size="sm" onClick={()=>exportCSV(mData,"pl_report",[{label:"Month",key:"monthFull"},{label:"Revenue",key:"revenue"},{label:"Supply Cost",key:"supplyCost"},{label:"Expenses",key:"expenses"},{label:"Waste Cost",key:"wasteCost"},{label:"Total Cost",key:"totalCost"},{label:"Profit/Loss",key:"profit"},{label:"Margin %",key:"margin"},{label:"Deliveries",key:"deliveriesCount"}])}>📊 CSV</Btn>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr style={{borderBottom:`2px solid ${t.border}`,background:dm?"#111":"#f9f9f8"}}>
                    {["Month","Deliveries","Revenue","Supply","Expenses","Waste","Total Cost","Profit / Loss","Margin","Prod Actual","Prod Eff."].map(h=><th key={h} style={{color:t.sub}} className="px-3 py-2.5 text-left font-bold uppercase tracking-wide text-[10px] whitespace-nowrap">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {mData.map((m,i)=>{
                      const prev=mData[i-1];
                      const isRowHov=plMonthHovered===m.month;
                      const isRowEx=plMonthExpanded===m.month;
                      const arrow=(curr,p)=>{if(!p||p===0||curr===p)return null;const up=curr>p;const pct=Math.round(Math.abs(curr-p)/Math.max(Math.abs(p),1)*100);return <span style={{color:up?"#10b981":"#ef4444",fontSize:9,marginLeft:3,fontWeight:700}}>{up?"▲":"▼"}{pct}%</span>;};
                      return [
                      <tr key={m.month}
                        onMouseEnter={()=>setPlMonthHovered(m.month)}
                        onMouseLeave={()=>setPlMonthHovered(null)}
                        onClick={()=>setPlMonthExpanded(isRowEx?null:m.month)}
                        style={{borderBottom:isRowEx?"none":`1px solid ${t.border}`,background:isRowEx?(dm?"#1a2a1a":"#f0fff4"):isRowHov?(dm?"#ffffff06":"#00000005"):"transparent",cursor:"pointer",transition:"background .12s"}}>
                        <td style={{color:isRowEx?"#10b981":t.text}} className="px-3 py-2.5 font-bold whitespace-nowrap">{m.monthFull} {isRowEx?"▲":"▼"}</td>
                        <td style={{color:t.sub}} className="px-3 py-2.5">{m.deliveriesCount}{prev&&arrow(m.deliveriesCount,prev.deliveriesCount)}</td>
                        <td className="px-3 py-2.5 text-emerald-500 font-semibold whitespace-nowrap">{inr(m.revenue)}{prev&&arrow(m.revenue,prev.revenue)}</td>
                        <td className="px-3 py-2.5 text-purple-400 whitespace-nowrap">{inr(m.supplyCost)}</td>
                        <td className="px-3 py-2.5 text-red-400 whitespace-nowrap">{inr(m.expenses)}</td>
                        <td className="px-3 py-2.5 text-orange-400 whitespace-nowrap">{inr(m.wasteCost)}</td>
                        <td className="px-3 py-2.5 text-red-500 font-semibold whitespace-nowrap">{inr(m.totalCost)}{prev&&arrow(m.totalCost,prev.totalCost)}</td>
                        <td className={`px-3 py-2.5 font-bold whitespace-nowrap ${m.profit>=0?"text-emerald-500":"text-red-500"}`}>{inr(m.profit)}{prev&&arrow(m.profit,prev.profit)}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span style={{background:m.margin>=30?"#10b98122":m.margin>=15?"#f59e0b22":"#ef444422",color:m.margin>=30?"#10b981":m.margin>=15?"#f59e0b":"#ef4444",borderRadius:6,padding:"2px 8px",fontWeight:800,fontSize:10}}>{m.margin}%</span>
                        </td>
                        <td style={{color:"#8b5cf6"}} className="px-3 py-2.5 whitespace-nowrap">{m.prodActual>0?m.prodActual:"—"}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {m.prodTarget>0?<span style={{background:m.prodEfficiency>=95?"#10b98122":m.prodEfficiency>=80?"#f59e0b22":"#ef444422",color:m.prodEfficiency>=95?"#10b981":m.prodEfficiency>=80?"#f59e0b":"#ef4444",borderRadius:6,padding:"2px 8px",fontWeight:800,fontSize:10}}>{m.prodEfficiency}%</span>:<span style={{color:t.sub}}>—</span>}
                        </td>
                      </tr>,
                      isRowEx&&<tr key={m.month+"_exp"} style={{background:dm?"#0a1f0a":"#f0fff4",borderBottom:`2px solid #10b98140`}}>
                        <td colSpan={11} style={{padding:"0 0 0 0"}}>
                          {(()=>{
                            const mKey=m.rawMonth||m.month;
                            const mDelivs=deliveries.filter(d=>d.date?.startsWith(mKey)&&d.status==="Delivered");
                            const mExps=expenses.filter(e=>e.date?.startsWith(mKey));
                            const mSups=supplies.filter(s=>s.date?.startsWith(mKey));
                            const mWaste=(wastage||[]).filter(w=>w.date?.startsWith(mKey));
                            return(<div style={{padding:"12px 16px"}}>
                              <p style={{color:"#10b981",fontWeight:800,fontSize:12,marginBottom:10}}>📋 {m.monthFull} — Full Breakdown</p>
                              {/* Mini KPIs */}
                              <div className="grid grid-cols-4 gap-2 mb-3">
                                {[["Revenue","#10b981",inr(m.revenue),`${m.deliveriesCount} orders`],["Supply","#8b5cf6",inr(m.supplyCost),`${mSups.length} entries`],["Expenses","#ef4444",inr(m.expenses),`${mExps.length} entries`],["Wastage","#f97316",inr(m.wasteCost),`${mWaste.length} records`]].map(([l,c,v,sub])=>(
                                  <div key={l} style={{background:c+"12",border:`1px solid ${c}30`,borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
                                    <p style={{color:c,fontWeight:900,fontSize:12}}>{v}</p>
                                    <p style={{color:t.sub,fontSize:9}}>{l}</p>
                                    <p style={{color:t.sub,fontSize:8}}>{sub}</p>
                                  </div>
                                ))}
                              </div>
                              {/* Gross margin bar */}
                              <div className="mb-3">
                                <div className="flex justify-between mb-1"><span style={{color:t.sub,fontSize:10}}>Revenue allocation</span><span style={{color:m.profit>=0?"#10b981":"#ef4444",fontWeight:700,fontSize:10}}>{m.margin}% margin</span></div>
                                <div style={{height:8,borderRadius:8,overflow:"hidden",display:"flex",background:t.border}}>
                                  <div style={{width:`${Math.max(0,m.margin)}%`,background:"#10b981"}}/>
                                  <div style={{width:`${m.revenue>0?Math.round(m.supplyCost/m.revenue*100):0}%`,background:"#8b5cf6"}}/>
                                  <div style={{width:`${m.revenue>0?Math.round(m.expenses/m.revenue*100):0}%`,background:"#ef4444"}}/>
                                  <div style={{width:`${m.revenue>0?Math.round(m.wasteCost/m.revenue*100):0}%`,background:"#f97316"}}/>
                                </div>
                              </div>
                              {/* Products sold this month */}
                              {(()=>{
                                const mProdMap={};
                                mDelivs.forEach(d=>{Object.entries(safeO(d.orderLines)).forEach(([pid,l])=>{if(l.qty>0){if(!mProdMap[pid])mProdMap[pid]={name:l.name||products.find(p=>p.id===pid)?.name||pid,qty:0,rev:0};mProdMap[pid].qty+=l.qty;mProdMap[pid].rev+=(l.qty||0)*(l.priceAmount||0);}});});
                                const mProdArr=Object.values(mProdMap).sort((a,b)=>b.rev-a.rev);
                                if(!mProdArr.length) return null;
                                return <div className="mb-3">
                                  <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>🛒 Products Sold ({mProdArr.length} SKUs)</p>
                                  <div style={{display:"flex",flexDirection:"column",gap:3}}>
                                    {mProdArr.map(p=>(
                                      <div key={p.name} className="flex items-center justify-between" style={{background:t.inp,borderRadius:8,padding:"5px 10px"}}>
                                        <div className="flex items-center gap-2">
                                          <span style={{color:t.text,fontSize:11,fontWeight:600}}>{p.name}</span>
                                          <span style={{color:t.sub,fontSize:10}}>{p.qty} units</span>
                                        </div>
                                        <span style={{color:"#10b981",fontWeight:700,fontSize:11}}>{inr(p.rev)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>;
                              })()}
                              {/* Top deliveries with inv/receipt/batch */}
                              {mDelivs.length>0&&<div className="mb-2">
                                <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>📦 Deliveries ({mDelivs.length})</p>
                                <div style={{maxHeight:180,overflowY:"auto"}}>
                                  {mDelivs.sort((a,b)=>lineTotal(b.orderLines)-lineTotal(a.orderLines)).map((d,di)=>{
                                    const plInvNo=(invRegistry?.issued||{})[d.id]||d.invNo||null;
                                    const plRcptNo=plInvNo?`RCP-${plInvNo.replace(/^[A-Z]+-/,"")}`:`RCP-${(d.id||"").slice(-6).toUpperCase()}`;
                                    const dDate=d.date||"";
                                    const linkedBatches=(prodTargets||[]).filter(pt=>pt.date===dDate&&(pt.linkedInvoices||[]).includes(plInvNo));
                                    const batchLabels=linkedBatches.length>0?linkedBatches.map(b=>b.batchLabel||"Batch").join(", "):null;
                                    const dItems=Object.entries(safeO(d.orderLines)).filter(([,l])=>l.qty>0).map(([pid,l])=>{const pn=products.find(p=>p.id===pid);return `${l.qty}×${pn?pn.name:(l.name||pid)}`;}).join(", ");
                                    return (
                                    <div key={d.id||di} style={{borderBottom:di<mDelivs.length-1?`1px solid ${t.border+"44"}`:"none",cursor:"pointer",padding:"6px 4px",transition:"background .1s"}}
                                      onClick={()=>setDetailModal({type:"delivery",data:d})}
                                      onMouseEnter={ev=>{ev.currentTarget.style.background=t.inp+"88";}} onMouseLeave={ev=>{ev.currentTarget.style.background="transparent";}}>
                                      <div className="flex justify-between items-start">
                                        <div style={{minWidth:0}}>
                                          <span style={{color:t.text,fontSize:11,fontWeight:700}}>{d.customer}</span>
                                          <div className="flex flex-wrap gap-1 mt-0.5">
                                            {plInvNo&&<span style={{color:"#8b5cf6",fontSize:9,fontFamily:"monospace",background:dm?"rgba(139,92,246,0.12)":"rgba(139,92,246,0.07)",borderRadius:3,padding:"1px 5px"}}>📄 {plInvNo}</span>}
                                            {plInvNo&&<span style={{color:"#0ea5e9",fontSize:9,fontFamily:"monospace",background:dm?"rgba(14,165,233,0.12)":"rgba(14,165,233,0.07)",borderRadius:3,padding:"1px 5px"}}>🧾 {plRcptNo}</span>}
                                            {batchLabels&&<span style={{color:"#7c3aed",fontSize:9,background:dm?"rgba(124,58,237,0.12)":"rgba(124,58,237,0.07)",borderRadius:3,padding:"1px 5px"}}>🏭 {batchLabels}</span>}
                                          </div>
                                          {dItems&&<p style={{color:t.sub,fontSize:9,marginTop:2}}>{dItems}</p>}
                                        </div>
                                        <span style={{color:"#10b981",fontWeight:700,fontSize:11,flexShrink:0,marginLeft:8}}>{inr(lineTotal(d.orderLines))}</span>
                                      </div>
                                    </div>
                                    );
                                  })}
                                </div>
                              </div>}
                              {/* Supplies this month */}
                              {mSups.length>0&&<div className="mb-2">
                                <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>📦 Supplies ({mSups.length})</p>
                                <div style={{maxHeight:80,overflowY:"auto"}}>
                                  {mSups.sort((a,b)=>(b.cost||0)-(a.cost||0)).map((s,si)=>(
                                    <div key={s.id||si} className="flex justify-between items-center py-1" style={{borderBottom:si<mSups.length-1?`1px solid ${t.border+"44"}`:"none"}}>
                                      <span style={{color:t.text,fontSize:11}}>{s.item}{s.supplier?` · ${s.supplier}`:""}</span>
                                      <span style={{color:"#8b5cf6",fontWeight:700,fontSize:11}}>{inr(s.cost||0)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>}
                              {/* Top expenses */}
                              {mExps.length>0&&<div>
                                <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>💸 Expenses ({mExps.length})</p>
                                <div style={{maxHeight:100,overflowY:"auto"}}>
                                  {mExps.sort((a,b)=>(b.amount||0)-(a.amount||0)).map((e,ei)=>(
                                    <div key={e.id||ei} className="flex justify-between items-center py-1" style={{borderBottom:ei<mExps.length-1?`1px solid ${t.border+"44"}`:"none",cursor:"pointer"}}
                                      onClick={()=>setDetailModal({type:"expense",data:e})}
                                      onMouseEnter={ev=>{ev.currentTarget.style.background=t.inp+"88";}} onMouseLeave={ev=>{ev.currentTarget.style.background="transparent";}}>
                                      <span style={{color:t.text,fontSize:11,textDecoration:"underline"}}>{e.category}{e.vendor?` · ${e.vendor}`:""}</span>
                                      <span style={{color:"#ef4444",fontWeight:700,fontSize:11}}>{inr(e.amount)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>}
                              {/* Wastage this month */}
                              {mWaste.length>0&&<div className="mt-2">
                                <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>🗑 Wastage ({mWaste.length})</p>
                                <div style={{maxHeight:80,overflowY:"auto"}}>
                                  {mWaste.sort((a,b)=>(b.cost||0)-(a.cost||0)).map((w,wi)=>(
                                    <div key={w.id||wi} className="flex justify-between items-center py-1" style={{borderBottom:wi<mWaste.length-1?`1px solid ${t.border+"44"}`:"none"}}>
                                      <span style={{color:t.text,fontSize:11}}>{w.product} · {w.qty} {w.unit}</span>
                                      <span style={{color:"#f97316",fontWeight:700,fontSize:11}}>{w.cost>0?inr(w.cost):"—"}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>}
                            </div>);
                          })()}
                        </td>
                      </tr>
                      ];
                    })}
                    <tr style={{borderTop:`2px solid ${t.border}`,background:dm?"#1a1a1a":"#fafaf8"}}>
                      <td style={{color:t.text}} className="px-3 py-3 font-black text-[11px] uppercase tracking-wide">Total</td>
                      <td style={{color:t.sub}} className="px-3 py-3 font-bold">{deliveries.filter(d=>d.status==="Delivered").length}</td>
                      <td className="px-3 py-3 text-emerald-500 font-black">{inr(totRev)}</td>
                      <td className="px-3 py-3 text-purple-400 font-bold">{inr(totSupC)}</td>
                      <td className="px-3 py-3 text-red-400 font-bold">{inr(totExpC)}</td>
                      <td className="px-3 py-3 text-orange-400 font-bold">{inr(totWasteC)}</td>
                      <td className="px-3 py-3 text-red-500 font-black">{inr(totCost)}</td>
                      <td className={`px-3 py-3 font-black ${totProfit>=0?"text-emerald-500":"text-red-500"}`}>{inr(totProfit)}</td>
                      <td className="px-3 py-3"><span style={{background:totMargin>=30?"#10b98122":totMargin>=15?"#f59e0b22":"#ef444422",color:totMargin>=30?"#10b981":totMargin>=15?"#f59e0b":"#ef4444",borderRadius:6,padding:"2px 8px",fontWeight:900,fontSize:10}}>{totMargin}%</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>

            {/* ── CUSTOMER-WISE P&L ── */}
            <Card dm={dm} className="overflow-hidden">
              <div className="px-4 pt-4 pb-3 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p style={{color:t.text}} className="text-sm font-bold">Customer Revenue Breakdown</p>
                  <p style={{color:t.sub}} className="text-[11px]">Ranked by revenue · collection health shown</p>
                </div>
                <Btn dm={dm} v="outline" size="sm" onClick={()=>{
                  const custPL=customers.map(c=>{
                    const cd=deliveries.filter(d=>d.customerId===c.id&&d.status==="Delivered");
                    const rev=cd.reduce((s,d)=>s+lineTotal(d.orderLines),0);
                    return {name:c.name,phone:c.phone||"",orders:deliveries.filter(d=>d.customerId===c.id).length,delivered:cd.length,revenue:rev,collected:c.paid||0,pending:c.pending||0,avgOrder:cd.length>0?Math.round(rev/cd.length):0,agents:[...new Set(deliveries.filter(d=>d.customerId===c.id).map(d=>d.createdBy).filter(Boolean))].join(", ")||"—"};
                  }).sort((a,b)=>b.revenue-a.revenue);
                  exportCSV(custPL,"customer_pl",[{label:"Customer",key:"name"},{label:"Phone",key:"phone"},{label:"Total Orders",key:"orders"},{label:"Delivered",key:"delivered"},{label:"Revenue",key:"revenue"},{label:"Collected",key:"collected"},{label:"Pending",key:"pending"},{label:"Avg Order",key:"avgOrder"},{label:"Agent / Created By",key:"agents"}]);
                }}>📊 CSV</Btn>
              </div>
              <Hr dm={dm}/>
              {customers.length===0?<p style={{color:t.sub}} className="text-sm text-center py-5">No customers yet.</p>
              :(()=>{
                const sorted=[...customers].sort((a,b)=>{
                  const ra=deliveries.filter(d=>d.customerId===a.id&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0);
                  const rb=deliveries.filter(d=>d.customerId===b.id&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0);
                  return rb-ra;
                });
                const maxCustRev=Math.max(...sorted.map(cx=>deliveries.filter(d=>d.customerId===cx.id&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0)),1);
                const totalPortfolioRev=sorted.reduce((s,cx)=>s+deliveries.filter(d=>d.customerId===cx.id&&d.status==="Delivered").reduce((ss,d)=>ss+lineTotal(d.orderLines),0),0);
                return sorted.map((c,ci)=>{
                  const cDelivs=deliveries.filter(d=>d.customerId===c.id);
                  const cDelivered=cDelivs.filter(d=>d.status==="Delivered");
                  const cRev=cDelivered.reduce((s,d)=>s+lineTotal(d.orderLines),0);
                  const cPending=c.pending||0;
                  const cPaid=c.paid||0;
                  const avgOrder=cDelivered.length>0?Math.round(cRev/cDelivered.length):0;
                  const lastDeliv=cDelivs.length>0?[...cDelivs].sort((a,b)=>b.date.localeCompare(a.date))[0]:null;
                  const collPct=cPaid+cPending>0?Math.round(cPaid/(cPaid+cPending)*100):100;
                  const revenueSharePct=totalPortfolioRev>0?Math.round(cRev/totalPortfolioRev*100):0;
                  const medalColor=ci===0?"#f59e0b":ci===1?"#9ca3af":ci===2?"#cd7c3f":"#6b7280";
                  const isCustHov=plCustHovered===c.id;
                  const isCustEx=plCustExpanded===c.id;
                  const cProducts=products.map(p=>{const qty=cDelivered.reduce((s,d)=>s+(safeO(d.orderLines)[p.id]?.qty||0),0);const rev=cDelivered.reduce((s,d)=>s+(safeO(d.orderLines)[p.id]?.qty||0)*(safeO(d.orderLines)[p.id]?.priceAmount||0),0);return{...p,qty,rev};}).filter(x=>x.qty>0).sort((a,b)=>b.rev-a.rev);
                  return <div key={c.id}
                    onMouseEnter={()=>setPlCustHovered(c.id)}
                    onMouseLeave={()=>setPlCustHovered(null)}
                    onClick={()=>setPlCustExpanded(isCustEx?null:c.id)}
                    style={{borderBottom:`1px solid ${t.border}`,cursor:"pointer",background:isCustEx?(dm?"#1a1500":"#fffbeb"):isCustHov?(dm?"#ffffff04":"#00000003"):"transparent",transition:"background .15s"}}>
                    <div className="px-4 py-4">
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div style={{background:`${medalColor}22`,color:medalColor,width:30,height:30,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:13,flexShrink:0}}>{ci+1}</div>
                        <div className="min-w-0">
                          <p style={{color:t.text}} className="text-sm font-bold truncate" onClick={ev=>{ev.stopPropagation();setDetailModal({type:"customer",data:c});}}><span style={{textDecoration:"underline",cursor:"pointer"}}>{c.name}</span></p>
                          <p style={{color:t.sub}} className="text-[11px]">{cDelivs.length} orders · {cDelivered.length} delivered{lastDeliv?` · Last `:""}
                            {lastDeliv&&<span style={{textDecoration:"underline",cursor:"pointer"}} onClick={ev=>{ev.stopPropagation();setDetailModal({type:"date",data:{date:lastDeliv.date}});}}>{lastDeliv.date}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-black text-amber-500 text-base leading-none">{inr(cRev)}</p>
                        <p style={{color:t.sub}} className="text-[10px] mt-0.5">{revenueSharePct}% of portfolio</p>
                        <p style={{color:t.sub,fontSize:9}}>{isCustEx?"▲ collapse":"▼ expand"}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {[
                        {label:"Collected",val:inr(cPaid),color:"#10b981",bg:"#10b98112"},
                        {label:"Pending",val:inr(cPending),color:cPending>0?"#ef4444":"#10b981",bg:cPending>0?"#ef444412":"#10b98112"},
                        {label:"Avg Order",val:inr(avgOrder),color:"#f59e0b",bg:"#f59e0b12"},
                        {label:"Coll. Rate",val:`${collPct}%`,color:collPct>=90?"#10b981":collPct>=60?"#f59e0b":"#ef4444",bg:collPct>=90?"#10b98112":collPct>=60?"#f59e0b12":"#ef444412"},
                      ].map(x=><div key={x.label} style={{background:x.bg,borderRadius:10,padding:"7px 8px",textAlign:"center"}}>
                        <p style={{color:x.color}} className="font-bold text-xs leading-none">{x.val}</p>
                        <p style={{color:t.sub}} className="text-[9px] mt-1">{x.label}</p>
                      </div>)}
                    </div>
                    {/* Revenue bar */}
                    <div style={{background:t.border,height:4,borderRadius:4,overflow:"hidden",marginBottom:3}}>
                      <div style={{width:`${Math.round(cRev/maxCustRev*100)}%`,background:`linear-gradient(90deg,${medalColor},${medalColor}99)`,height:"100%",borderRadius:4,transition:"width 0.6s ease"}}/>
                    </div>
                    {/* Collection bar */}
                    {(cPaid+cPending)>0&&<div style={{height:3,borderRadius:3,overflow:"hidden",display:"flex"}}>
                      <div style={{width:`${collPct}%`,background:"#10b981"}}/>
                      <div style={{width:`${100-collPct}%`,background:"#ef4444"}}/>
                    </div>}
                    {/* Expanded detail panel */}
                    {isCustEx&&<div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${t.border}`}} onClick={e=>e.stopPropagation()}>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                        {[
                          {l:"Total Revenue",v:inr(cRev),c:"#f59e0b"},
                          {l:"Total Orders",v:cDelivs.length,c:"#3b82f6"},
                          {l:"Delivered",v:cDelivered.length,c:"#10b981"},
                          {l:"Cancelled",v:cDelivs.filter(d=>d.status==="Cancelled").length,c:"#ef4444"},
                          {l:"Highest Order",v:inr(Math.max(...cDelivered.map(d=>lineTotal(d.orderLines)),0)),c:"#8b5cf6"},
                          {l:"First Order",v:cDelivs.length>0?[...cDelivs].sort((a,b)=>a.date.localeCompare(b.date))[0]?.date:"—",c:t.text},
                        ].map(x=><div key={x.l} style={{background:t.inp,borderRadius:10,padding:"8px 10px"}}>
                          <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase"}}>{x.l}</p>
                          <p style={{color:x.c,fontWeight:700,fontSize:12}}>{x.v}</p>
                        </div>)}
                      </div>
                      {/* Products ordered */}
                      {cProducts.length>0&&<div className="mb-3">
                        <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Products Ordered</p>
                        {cProducts.map(p=>(
                          <div key={p.id} className="flex items-center justify-between py-1.5" style={{borderBottom:`1px solid ${t.border}`}}>
                            <div><p style={{color:t.text,fontSize:11,fontWeight:600}}>{p.name}</p><p style={{color:t.sub,fontSize:10}}>{p.qty} units</p></div>
                            <span style={{color:"#f59e0b",fontWeight:700,fontSize:11}}>{inr(p.rev)}</span>
                          </div>
                        ))}
                      </div>}
                      {/* Recent deliveries */}
                      {cDelivered.length>0&&<div>
                        <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Recent Deliveries</p>
                        <div style={{maxHeight:130,overflowY:"auto"}}>
                          {[...cDelivered].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8).map((d,di)=>(
                            <div key={d.id||di} className="flex justify-between items-center py-1.5" style={{borderBottom:di<Math.min(8,cDelivered.length)-1?`1px solid ${t.border}`:"none",cursor:"pointer"}}
                              onClick={ev=>{ev.stopPropagation();setDetailModal({type:"delivery",data:d});}}
                              onMouseEnter={ev=>{ev.currentTarget.style.background=t.inp+"88";}} onMouseLeave={ev=>{ev.currentTarget.style.background="transparent";}}>
                              <div>
                                <p style={{color:t.sub,fontSize:10,textDecoration:"underline",cursor:"pointer"}} onClick={ev=>{ev.stopPropagation();setDetailModal({type:"date",data:{date:d.date}});}}>📅 {d.date}</p>
                                {d.orderLines&&Object.values(d.orderLines).filter(l=>l.qty>0).length>0&&<p style={{color:t.sub,fontSize:9}}>{Object.values(d.orderLines).filter(l=>l.qty>0).map(l=>`${l.qty}×${l.name||""}`).join(", ")}</p>}
                                {d.createdBy&&<p style={{color:t.sub,fontSize:9,textDecoration:"underline",cursor:"pointer"}} onClick={ev=>{ev.stopPropagation();setDetailModal({type:"agent",data:{name:d.createdBy}});}}>👤 {d.createdBy}</p>}
                              </div>
                              <span style={{color:"#10b981",fontWeight:700,fontSize:11}}>{inr(lineTotal(d.orderLines))}</span>
                            </div>
                          ))}
                        </div>
                      </div>}
                      {c.notes&&<div style={{background:t.inp,borderRadius:10,padding:"8px 12px",marginTop:8}}>
                        <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginBottom:2}}>Notes</p>
                        <p style={{color:t.text,fontSize:11}}>{c.notes}</p>
                      </div>}
                    </div>}
                    </div>
                  </div>;
                });
              })()}
            </Card>

            {/* ── INVOICE AGING REPORT ── */}
            {(()=>{
              const now=new Date();
              const aged=customers.filter(c=>c.pending>0).map(c=>{
                const lastD=deliveries.filter(d=>d.customerId===c.id).sort((a,b)=>b.date.localeCompare(a.date))[0];
                const refDate=lastD?.date||c.joinDate||"2026-01-01";
                const daysDue=Math.floor((now-new Date(refDate))/86400000);
                const bucket=daysDue<=30?"0–30 days":daysDue<=60?"31–60 days":daysDue<=90?"61–90 days":"90+ days";
                const color=daysDue<=30?"#f59e0b":daysDue<=60?"#f97316":daysDue<=90?"#ef4444":"#991b1b";
                return {...c,daysDue,bucket,color};
              }).sort((a,b)=>b.daysDue-a.daysDue);
              if(aged.length===0)return null;
              const agingTotal=aged.reduce((s,c)=>s+c.pending,0);
              return <Card dm={dm} className="overflow-hidden">
                <div className="px-4 pt-4 pb-3 flex items-center justify-between">
                  <div>
                    <p style={{color:t.text}} className="font-bold text-sm">📋 Invoice Aging Report</p>
                    <p style={{color:t.sub}} className="text-[11px]">{aged.length} customers · {inr(agingTotal)} total outstanding</p>
                  </div>
                  <span style={{background:"#ef444420",color:"#ef4444",borderRadius:8,padding:"3px 10px",fontSize:12,fontWeight:800}}>{inr(agingTotal)}</span>
                </div>
                <Hr dm={dm}/>
                {aged.map((c)=>(
                  <div key={c.id} style={{borderBottom:`1px solid ${t.border}`,cursor:"pointer",transition:"background .12s"}} className="px-4 py-3 last:border-0"
                    onClick={()=>setDetailModal({type:"customer",data:c})}
                    onMouseEnter={ev=>{ev.currentTarget.style.background=t.inp+"88";}} onMouseLeave={ev=>{ev.currentTarget.style.background="transparent";}}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p style={{color:t.text}} className="text-sm font-semibold truncate">{c.name}</p>
                        <p style={{color:t.sub}} className="text-xs">{c.daysDue} days since last activity</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span style={{background:c.color+"18",color:c.color,borderRadius:8,padding:"2px 9px",fontSize:10,fontWeight:700}}>{c.bucket}</span>
                        <span style={{color:"#ef4444"}} className="font-black text-sm">{inr(c.pending)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </Card>;
            })()}

            {/* ── PRODUCTION SUMMARY IN P&L ── */}
            {(prodTargets||[]).length>0&&(()=>{
              const filtProdPL=(prodTargets||[]).filter(p=>p.date>=dateFrom&&p.date<=dateTo);
              const plProdActual=filtProdPL.reduce((s,p)=>s+(+p.actual||0),0);
              const plProdTarget=filtProdPL.reduce((s,p)=>s+(+p.target||0),0);
              const plProdEff=plProdTarget>0?Math.round(plProdActual/plProdTarget*100):0;
              const plWasteQty=filtW.reduce((s,w)=>s+(w.qty||0),0);
              const plWasteCost=filtW.reduce((s,w)=>s+(w.cost||0),0);
              const prodByProdPL=[...new Set(filtProdPL.map(p=>p.product).filter(Boolean))].map(prod=>({
                product:prod,
                actual:filtProdPL.filter(p=>p.product===prod).reduce((s,p)=>s+(+p.actual||0),0),
                target:filtProdPL.filter(p=>p.product===prod).reduce((s,p)=>s+(+p.target||0),0),
              })).sort((a,b)=>b.actual-a.actual);
              return <Card dm={dm} className="overflow-hidden">
                <div className="px-4 pt-4 pb-3 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p style={{color:t.text}} className="font-bold text-sm">🏭 Production & Wastage — {periodLabel}</p>
                    <p style={{color:t.sub}} className="text-[11px]">Factory output and loss for the period</p>
                  </div>
                  <button onClick={()=>setTab("Production")} style={{background:"#8b5cf615",color:"#8b5cf6",border:"none",borderRadius:8,padding:"3px 10px",fontSize:10,fontWeight:700,cursor:"pointer"}}>Full Production →</button>
                </div>
                <Hr dm={dm}/>
                <div style={{padding:"12px 16px"}}>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    {[
                      {label:"Units Produced",val:plProdActual,color:"#8b5cf6"},
                      {label:"Production Target",val:plProdTarget,color:"#6b7280"},
                      {label:"Efficiency",val:`${plProdEff}%`,color:plProdEff>=95?"#10b981":plProdEff>=80?"#f59e0b":"#ef4444"},
                      {label:"Wastage Cost",val:inr(plWasteCost),color:"#f97316",sub:`${plWasteQty} units wasted`},
                    ].map(x=><div key={x.label} style={{background:t.inp,borderRadius:12,padding:"10px 12px",borderTop:`2px solid ${x.color}`}}>
                      <p style={{color:x.color}} className="font-black text-base leading-none">{x.val}</p>
                      <p style={{color:t.sub,fontSize:10,marginTop:3}}>{x.label}</p>
                      {x.sub&&<p style={{color:t.sub,fontSize:9,marginTop:1}}>{x.sub}</p>}
                    </div>)}
                  </div>
                  {prodByProdPL.length>0&&<>
                    <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>By Product</p>
                    {prodByProdPL.map(p=>{
                      const eff=p.target>0?Math.round(p.actual/p.target*100):0;
                      return <div key={p.product} className="flex items-center gap-3 py-2" style={{borderBottom:`1px solid ${t.border}`}}>
                        <div style={{flex:1}}>
                          <div className="flex justify-between mb-1"><span style={{color:t.text,fontSize:12,fontWeight:600}}>{p.product}</span><span style={{color:"#8b5cf6",fontWeight:700,fontSize:12}}>{p.actual} units</span></div>
                          <div style={{height:4,background:t.border,borderRadius:4,overflow:"hidden"}}><div style={{width:`${Math.min(100,eff)}%`,background:eff>=95?"#10b981":eff>=80?"#f59e0b":"#ef4444",height:"100%",borderRadius:4}}/></div>
                        </div>
                        <span style={{color:eff>=95?"#10b981":eff>=80?"#f59e0b":"#ef4444",fontWeight:700,fontSize:11,minWidth:36,textAlign:"right"}}>{p.target>0?`${eff}%`:"—"}</span>
                      </div>;
                    })}
                  </>}
                </div>
              </Card>;
            })()}
          </>;
        })()}

        {/* ANALYTICS EXPORT HELPERS */}
        {/* These are defined as inline closures inside JSX scope so they can close over live data */}

        {/* ANALYTICS TAB */}
        {tab==="Analytics"&&isAdmin&&(()=>{
          // ── Analytics date filter ──
          const ANL_PERIODS=[["1d","Daily"],["1w","Weekly"],["1m","Monthly"],["3m","3 Months"],["6m","6 Months"],["12m","12 Months"],["all","All Time"],["custom","Custom Range"],["date","Specific Date"]];
          const nowD=new Date(); nowD.setHours(23,59,59,999);
          let anlFrom=null,anlTo=nowD;
          if(anlPeriod==="1d"){const d=new Date();d.setHours(0,0,0,0);anlFrom=d;}
          else if(anlPeriod==="1w"){const d=new Date();d.setDate(d.getDate()-6);d.setHours(0,0,0,0);anlFrom=d;}
          else if(anlPeriod==="1m"){const d=new Date();d.setMonth(d.getMonth()-1);d.setHours(0,0,0,0);anlFrom=d;}
          else if(anlPeriod==="3m"){const d=new Date();d.setMonth(d.getMonth()-3);d.setHours(0,0,0,0);anlFrom=d;}
          else if(anlPeriod==="6m"){const d=new Date();d.setMonth(d.getMonth()-6);d.setHours(0,0,0,0);anlFrom=d;}
          else if(anlPeriod==="12m"){const d=new Date();d.setFullYear(d.getFullYear()-1);d.setHours(0,0,0,0);anlFrom=d;}
          else if(anlPeriod==="custom"){anlFrom=anlCustomFrom?new Date(anlCustomFrom):null;anlTo=anlCustomTo?new Date(anlCustomTo):nowD;anlTo.setHours(23,59,59,999);}
          else if(anlPeriod==="date"){if(anlSpecificDate){anlFrom=new Date(anlSpecificDate);anlFrom.setHours(0,0,0,0);anlTo=new Date(anlSpecificDate);anlTo.setHours(23,59,59,999);}}
          const inAnlRange=date=>{if(!anlFrom)return true;const d=new Date(date);return d>=anlFrom&&d<=anlTo;};
          const anlLabel=anlPeriod==="custom"?`${anlCustomFrom||"—"} → ${anlCustomTo}`:anlPeriod==="date"?`${anlSpecificDate||"Pick a date"}`:ANL_PERIODS.find(p=>p[0]===anlPeriod)?.[1]||"All Time";

          // ── Core computations ──
          const delivered=deliveries.filter(d=>d.status==="Delivered"&&inAnlRange(d.date));
          const totalDelivered=delivered.length;
          const totalScheduled=deliveries.filter(d=>inAnlRange(d.date)).length;
          const fulfillmentRate=totalScheduled>0?Math.round(totalDelivered/totalScheduled*100):0;
          const replCount=deliveries.filter(d=>d.replacement?.done&&inAnlRange(d.date)).length;
          const replRate=totalDelivered>0?Math.round(replCount/totalDelivered*100):0;
          const avgRevPerDeliv=totalDelivered>0?Math.round(delivered.reduce((s,d)=>s+lineTotal(d.orderLines),0)/totalDelivered):0;
          const cancelCount=deliveries.filter(d=>d.status==="Cancelled"&&inAnlRange(d.date)).length;
          const cancelRate=totalScheduled>0?Math.round(cancelCount/totalScheduled*100):0;

          // ── Product sales ──
          // Note: replacement deductions are spread proportionally across products since
          // replacements are logged as a flat amount not tied to a specific product line.
          // We subtract the full delivery replacement from that delivery's revenue share per product.
          const prodSales=products.map(p=>{
            const qty=delivered.reduce((s,d)=>s+(safeO(d.orderLines)[p.id]?.qty||0),0);
            const grossRev=delivered.reduce((s,d)=>s+(safeO(d.orderLines)[p.id]?.qty||0)*(safeO(d.orderLines)[p.id]?.priceAmount||0),0);
            // Subtract proportional replacement deduction for this product
            const replDeducted=delivered.reduce((s,d)=>{
              const dTotal=lineTotal(d.orderLines);
              const pLineAmt=(safeO(d.orderLines)[p.id]?.qty||0)*(safeO(d.orderLines)[p.id]?.priceAmount||0);
              const replAmt=+(d.replacement?.amount||0);
              if(!replAmt||!dTotal) return s;
              return s+Math.round((pLineAmt/dTotal)*replAmt);
            },0);
            const rev=Math.max(0,grossRev-replDeducted);
            return {...p,totalQty:qty,totalRev:rev,grossRev,replDeducted,deliveryCount:delivered.filter(d=>(safeO(d.orderLines)[p.id]?.qty||0)>0).length};
          }).sort((a,b)=>b.totalRev-a.totalRev);
          const totalProductRev=prodSales.reduce((s,p)=>s+p.totalRev,0);

          // ── Customer revenue ──
          const custRev=customers.map(c=>{
            const cDelivs=deliveries.filter(d=>d.customerId===c.id&&d.status==="Delivered"&&inAnlRange(d.date));
            const grossRev=cDelivs.reduce((s,d)=>s+lineTotal(d.orderLines),0);
            const replDeducted=cDelivs.reduce((s,d)=>s+(+(d.replacement?.amount)||0),0);
            const totalRev=Math.max(0,grossRev-replDeducted);
            const partialCollected=cDelivs.reduce((s,d)=>s+(d.partialPayment?.enabled?(+(d.partialPayment?.amount)||0):0),0);
            const outstandingBalance=Math.max(0,(c.pending||0));
            return {...c,totalOrders:deliveries.filter(d=>d.customerId===c.id&&inAnlRange(d.date)).length,totalRev,grossRev,replDeducted,partialCollected,outstandingBalance};
          }).sort((a,b)=>b.totalRev-a.totalRev);
          const totalPortfolioRev=custRev.reduce((s,c)=>s+c.totalRev,0);
          // Revenue concentration: top 20% of customers
          const top20pct=Math.max(1,Math.ceil(custRev.length*0.2));
          const top20rev=custRev.slice(0,top20pct).reduce((s,c)=>s+c.totalRev,0);
          const top20share=totalPortfolioRev>0?Math.round(top20rev/totalPortfolioRev*100):0;

          // ── 14-day daily trend ──
          const days14=Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return d.toISOString().slice(0,10);}).reverse();
          const dailyData=days14.map(date=>({
            date:date.slice(5),
            scheduled:deliveries.filter(d=>d.date===date).length,
            delivered:deliveries.filter(d=>d.date===date&&d.status==="Delivered").length,
            revenue:deliveries.filter(d=>d.date===date&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0),
            expenses:expenses.filter(e=>e.date===date).reduce((s,e)=>s+(e.amount||0),0),
          }));
          const recentRevTotal=dailyData.reduce((s,d)=>s+d.revenue,0);
          const recentAvgDaily=Math.round(recentRevTotal/14);

          // ── 30-day vs prior 30-day comparison ──
          const last30days=Array.from({length:30},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return d.toISOString().slice(0,10);});
          const prior30days=Array.from({length:30},(_,i)=>{const d=new Date();d.setDate(d.getDate()-30-i);return d.toISOString().slice(0,10);});
          const last30rev=deliveries.filter(d=>last30days.includes(d.date)&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0);
          const prior30rev=deliveries.filter(d=>prior30days.includes(d.date)&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0);
          const revGrowth=prior30rev>0?Math.round((last30rev-prior30rev)/prior30rev*100):null;
          const last30delivCount=deliveries.filter(d=>last30days.includes(d.date)&&d.status==="Delivered").length;
          const prior30delivCount=deliveries.filter(d=>prior30days.includes(d.date)&&d.status==="Delivered").length;
          const delivGrowth=prior30delivCount>0?Math.round((last30delivCount-prior30delivCount)/prior30delivCount*100):null;

          // ── Day of week ──
          const dowData=[0,1,2,3,4,5,6].map(dow=>{
            const label=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dow];
            const filtered=delivered.filter(d=>new Date(d.date).getDay()===dow);
            return {day:label,deliveries:filtered.length,revenue:filtered.reduce((s,d)=>s+lineTotal(d.orderLines),0)};
          });
          const bestDow=dowData.reduce((b,d)=>d.revenue>b.revenue?d:b,dowData[0]);

          // ── Expense categories ──
          const expCatData=(settings?.expenseCategories||["Gas","Labour","Transport","Packaging","Utilities","Maintenance","Other"]).map(cat=>({category:cat,amount:expenses.filter(e=>e.category===cat&&inAnlRange(e.date)).reduce((s,e)=>s+(e.amount||0),0),count:expenses.filter(e=>e.category===cat&&inAnlRange(e.date)).length,})).filter(x=>x.amount>0).sort((a,b)=>b.amount-a.amount);

          const totalExpenses=expCatData.reduce((s,e)=>s+e.amount,0);

          // ── Wastage ──
          const wastageByType=(settings?.wastageTypes||["Other"]).map(type=>({
            type,qty:wastage.filter(w=>w.type===type&&inAnlRange(w.date)).reduce((s,w)=>s+(w.qty||0),0),
            cost:wastage.filter(w=>w.type===type&&inAnlRange(w.date)).reduce((s,w)=>s+(w.cost||0),0),
          })).filter(x=>x.qty>0);
          const totalWasteCost=wastageByType.reduce((s,w)=>s+w.cost,0);

          // ── Production analytics ──
          const filtProd=(prodTargets||[]).filter(p=>inAnlRange(p.date));
          const prodTotalActual=filtProd.reduce((s,p)=>s+(+p.actual||0),0);
          const prodTotalTarget=filtProd.reduce((s,p)=>s+(+p.target||0),0);
          const prodEfficiency=prodTotalTarget>0?Math.round(prodTotalActual/prodTotalTarget*100):0;
          const prodByProduct=[...new Set(filtProd.map(p=>p.product).filter(Boolean))].map(prod=>({
            product:prod,
            actual:filtProd.filter(p=>p.product===prod).reduce((s,p)=>s+(+p.actual||0),0),
            target:filtProd.filter(p=>p.product===prod).reduce((s,p)=>s+(+p.target||0),0),
            batches:filtProd.filter(p=>p.product===prod).length,
          })).sort((a,b)=>b.actual-a.actual);
          const filtQC=(qcLogs||[]).filter(q=>inAnlRange(q.date));
          const qcPassRate=filtQC.length>0?Math.round(filtQC.filter(q=>q.grade!=="F").length/filtQC.length*100):0;
          const qcGradeBreak=["A","B","C","F"].map(g=>({grade:g,count:filtQC.filter(q=>q.grade===g).length})).filter(x=>x.count>0);

          // ── Supply analytics ──
          const filtSup=supplies.filter(s=>inAnlRange(s.date));
          const totalSupplyCost=filtSup.reduce((s,x)=>s+(x.cost||0),0);
          const supByCategory=[...new Set(filtSup.map(s=>s.category||s.item||"Other"))].map(cat=>({
            cat,total:filtSup.filter(s=>(s.category||s.item||"Other")===cat).reduce((s,x)=>s+(x.cost||0),0),count:filtSup.filter(s=>(s.category||s.item||"Other")===cat).length,
          })).sort((a,b)=>b.total-a.total).slice(0,6);

          // ── Replacement analytics ──
          const filtRepl=deliveries.filter(d=>d.replacement?.done&&inAnlRange(d.date));
          const totalReplAmt=filtRepl.reduce((s,d)=>s+(+(d.replacement?.amount)||0),0);
          const replByItem=[...new Set(filtRepl.map(d=>d.replacement?.item).filter(Boolean))].map(item=>({item,count:filtRepl.filter(d=>d.replacement?.item===item).length,amount:filtRepl.filter(d=>d.replacement?.item===item).reduce((s,d)=>s+(+(d.replacement?.amount)||0),0)})).sort((a,b)=>b.count-a.count);

          // ── Customer retention / activity ──
          const now=new Date();
          const activeRecently=customers.filter(c=>{
            const last=deliveries.filter(d=>d.customerId===c.id&&d.status==="Delivered").sort((a,b)=>b.date.localeCompare(a.date))[0];
            if(!last)return false;
            return Math.floor((now-new Date(last.date))/86400000)<=30;
          }).length;
          const retentionRate=customers.filter(c=>c.active).length>0?Math.round(activeRecently/customers.filter(c=>c.active).length*100):0;

          // eslint-disable-next-line no-unused-vars
          const PIE_COLORS=["#f59e0b","#10b981","#8b5cf6","#ef4444","#0ea5e9","#f97316","#ec4899"];
          // ── Invoicing & payment analytics ──
          const issuedInvoices=Object.keys(invRegistry?.issued||{});
          const invoicedDeliveries=delivered.filter(d=>issuedInvoices.includes(d.id));
          const invoicedCount=invoicedDeliveries.length; void invoicedCount;
          const totalPartialCollected=delivered.reduce((s,d)=>s+(d.partialPayment?.enabled?(+(d.partialPayment?.amount)||0):0),0);
          const totalGrossRevenue=delivered.reduce((s,d)=>s+lineTotal(d.orderLines),0);
          const totalReplDeductions=delivered.reduce((s,d)=>s+(+(d.replacement?.amount)||0),0);
          const totalNetRevenue=Math.max(0,totalGrossRevenue-totalReplDeductions);
          const totalOutstanding=customers.reduce((s,c)=>s+(c.pending||0),0);
          const totalCustPaid=customers.reduce((s,c)=>s+(c.paid||0),0);
          const deliveriesWithBalance=delivered.filter(d=>{const repl=+(d.replacement?.amount)||0;const net=Math.max(0,lineTotal(d.orderLines)-repl);const coll=d.partialPayment?.enabled?(+(d.partialPayment?.amount)||0):0;return coll>0&&coll<net;});
          const deliveriesFullySettled=delivered.filter(d=>{const repl=+(d.replacement?.amount)||0;const net=Math.max(0,lineTotal(d.orderLines)-repl);const coll=d.partialPayment?.enabled?(+(d.partialPayment?.amount)||0):0;return net>0&&coll>=net;});

          // ── Smart Analytics Insights ──
          const analyticsInsights=[];
          if(fulfillmentRate<80) analyticsInsights.push({icon:"⚠️",color:"#f59e0b",text:`Fulfillment rate is only ${fulfillmentRate}% — ${totalScheduled-totalDelivered} orders undelivered. Review capacity.`});
          if(cancelRate>10) analyticsInsights.push({icon:"🚫",color:"#ef4444",text:`Cancellation rate of ${cancelRate}% is high (${cancelCount} orders). Investigate root causes.`});
          if(retentionRate<60) analyticsInsights.push({icon:"👤",color:"#ef4444",text:`Only ${retentionRate}% of active customers ordered in the last 30 days. Churn risk is elevated.`});
          if(revGrowth!==null&&revGrowth>=15) analyticsInsights.push({icon:"🚀",color:"#10b981",text:`Revenue grew ${revGrowth}% vs prior 30 days — strong momentum. Keep it up!`});
          if(revGrowth!==null&&revGrowth<=-10) analyticsInsights.push({icon:"📉",color:"#ef4444",text:`Revenue dropped ${Math.abs(revGrowth)}% vs prior 30 days. Investigate customer activity.`});
          if(top20share>=80) analyticsInsights.push({icon:"🎯",color:"#f59e0b",text:`Top ${top20pct} customers drive ${top20share}% of revenue — high concentration risk. Diversify.`});
          if(prodSales.filter(p=>p.totalQty>0).length<products.length*0.5&&products.length>2) analyticsInsights.push({icon:"📦",color:"#8b5cf6",text:`${products.length-prodSales.filter(p=>p.totalQty>0).length} products have zero sales. Consider rationalising catalogue.`});

          return <>
            {/* ── DATE FILTER BAR ── */}
            <div style={{background:t.card,border:`1.5px solid ${t.border}`,borderRadius:14,padding:"12px 16px"}}>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div>
                  <p style={{color:t.text}} className="font-black text-base">Analytics</p>
                  <p style={{color:t.sub}} className="text-xs">{anlLabel}</p>
                </div>
              </div>
              <div style={{background:t.inp,border:`1px solid ${t.border}`,borderRadius:10,padding:3,display:"flex",gap:2,flexWrap:"wrap"}}>
                {ANL_PERIODS.map(([v,l])=>(
                  <button key={v} onClick={()=>setAnlPeriod(v)}
                    style={anlPeriod===v
                      ?{background:dm?"#8b5cf6":"#7c3aed",color:"#fff",borderRadius:7,padding:"4px 10px",fontSize:11,fontWeight:700,border:"none",cursor:"pointer",touchAction:"manipulation",WebkitTapHighlightColor:"transparent"}
                      :{background:"transparent",color:t.sub,borderRadius:7,padding:"4px 10px",fontSize:11,fontWeight:600,border:"none",cursor:"pointer",touchAction:"manipulation",WebkitTapHighlightColor:"transparent"}}>{l}</button>
                ))}
              </div>
              {anlPeriod==="custom"&&<div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",marginTop:10}}>
                <span style={{color:t.sub,fontSize:12,fontWeight:600}}>From</span>
                <input type="date" value={anlCustomFrom} onChange={e=>setAnlCustomFrom(e.target.value)} style={{background:t.card,border:`1px solid ${t.inpB}`,color:t.text,fontSize:13,borderRadius:8,padding:"5px 10px",outline:"none"}}/>
                <span style={{color:t.sub,fontSize:12,fontWeight:600}}>To</span>
                <input type="date" value={anlCustomTo} max={today()} onChange={e=>setAnlCustomTo(e.target.value)} style={{background:t.card,border:`1px solid ${t.inpB}`,color:t.text,fontSize:13,borderRadius:8,padding:"5px 10px",outline:"none"}}/>
                {anlCustomFrom&&anlCustomTo&&<span style={{color:"#10b981",fontSize:11,fontWeight:700}}>✓ {Math.round((new Date(anlCustomTo)-new Date(anlCustomFrom))/86400000)+1} days</span>}
              </div>}
              {anlPeriod==="date"&&<div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",marginTop:10}}>
                <span style={{color:t.sub,fontSize:12,fontWeight:600}}>Date</span>
                <input type="date" value={anlSpecificDate} max={today()} onChange={e=>setAnlSpecificDate(e.target.value)} style={{background:t.card,border:`1px solid ${t.inpB}`,color:t.text,fontSize:13,borderRadius:8,padding:"5px 10px",outline:"none"}}/>
                {anlSpecificDate&&<span style={{color:"#8b5cf6",fontSize:11,fontWeight:700}}>📅 {new Date(anlSpecificDate).toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"short",year:"numeric"})}</span>}
              </div>}
            </div>

            {/* ── SECTION TABS ── */}
            <div style={{background:t.inp,border:`1px solid ${t.border}`,borderRadius:12,padding:4,display:"flex",gap:2,overflowX:"auto"}}>
              {[["overview","📊 Overview"],["customers","👥 Customers"],["products","📦 Products"],["operations","🏭 Operations"],["financials","💰 Financials"]].map(([k,l])=>(
                <button key={k} onClick={()=>setAnlActiveSection(k)}
                  style={anlActiveSection===k
                    ?{background:dm?"#1e1e2e":t.card,color:t.text,borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,border:`1px solid ${t.border}`,cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}
                    :{background:"transparent",color:t.sub,borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:600,border:"none",cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>{l}</button>
              ))}
            </div>

            {/* ── SMART ANALYTICS INSIGHTS ── */}
            {analyticsInsights.length>0&&<div style={{background:dm?"linear-gradient(135deg,#0d1628,#140d1f)":"linear-gradient(135deg,#eff6ff,#faf5ff)",border:dm?"1px solid #1e2a5f":"1px solid #c4b5fd",borderRadius:16,padding:"14px 18px"}}>
              <p style={{color:t.sub,fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>🔍 Analytics Insights</p>
              <div className="flex flex-col gap-2">
                {analyticsInsights.map((ins,i)=>(
                  <div key={i} className="flex items-start gap-2">
                    <span style={{fontSize:14,lineHeight:1.5}}>{ins.icon}</span>
                    <p style={{color:t.text,fontSize:12,lineHeight:1.5}}>{ins.text}</p>
                  </div>
                ))}
              </div>
            </div>}

            {/* ══════════ OVERVIEW SECTION ══════════ */}
            {anlActiveSection==="overview"&&<>
            {/* Export dropdown */}
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,flexWrap:"wrap",marginBottom:4}}>
              <div style={{position:"relative"}}>
                <button onClick={()=>setAnlExportOpen(anlExportOpen==="overview"?null:"overview")} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>⬇ Export ▾</button>
                {anlExportOpen==="overview"&&<div style={{position:"absolute",right:0,top:"110%",background:t.card,border:`1px solid ${t.border}`,borderRadius:10,zIndex:99,minWidth:140,boxShadow:"0 4px 20px rgba(0,0,0,0.15)"}}>
                  {[["CSV",()=>exportCSV([{revenue:totalNetRevenue,deliveries:totalDelivered,fulfillment:`${fulfillmentRate}%`,outstanding:inr(totalOutstanding),avgOrder:inr(avgRevPerDeliv)}],"overview_summary",[{label:"Revenue",key:"revenue"},{label:"Deliveries",key:"deliveries"},{label:"Fulfillment",key:"fulfillment"},{label:"Outstanding",key:"outstanding"},{label:"Avg Order",key:"avgOrder"}])],].map(([lbl,fn])=>
                    <button key={lbl} onClick={()=>{fn();setAnlExportOpen(null);}} style={{display:"block",width:"100%",padding:"9px 14px",fontSize:12,fontWeight:600,color:t.text,textAlign:"left",cursor:"pointer",background:"transparent",border:"none"}}>{lbl}</button>
                  )}
                </div>}
              </div>
              <div style={{display:"flex",gap:4}}>
                {[["revenue","Revenue"],["deliveries","Deliveries"],["fulfillment","Fulfillment"]].map(([v,lbl])=>
                  <button key={v} onClick={()=>setAnlOverviewMetric(v)} style={{background:anlOverviewMetric===v?"#f59e0b":t.inp,color:anlOverviewMetric===v?"#fff":t.sub,border:`1px solid ${anlOverviewMetric===v?"#f59e0b":t.border}`,borderRadius:16,padding:"4px 10px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{lbl}</button>
                )}
              </div>
            </div>
            <div style={{background:dm?"linear-gradient(135deg,#0d1628,#140d1f)":"linear-gradient(135deg,#eff6ff,#faf5ff)",border:dm?"1px solid #1e2a5f":"1px solid #c4b5fd",borderRadius:20,padding:"18px 20px"}}>
              <p style={{color:t.sub,fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>📊 30-Day Performance vs Prior Period</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {label:"Revenue (30d)",val:inr(last30rev),growth:revGrowth,color:"#10b981"},
                  {label:"Deliveries (30d)",val:last30delivCount,growth:delivGrowth,color:"#f59e0b"},
                  {label:"Daily Avg Rev",val:inr(recentAvgDaily),growth:null,color:"#8b5cf6",sub:"last 14 days"},
                  {label:"Avg Order Value",val:inr(avgRevPerDeliv),growth:null,color:"#0ea5e9",sub:"all time"},
                ].map(x=><div key={x.label} style={{background:dm?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.8)",borderRadius:12,padding:"12px 14px"}}>
                  <p style={{color:x.color}} className="font-black text-lg leading-none">{x.val}</p>
                  <p style={{color:t.sub,fontSize:10,marginTop:4}}>{x.label}</p>
                  {x.growth!==null&&x.growth!==undefined?<p style={{color:x.growth>=0?"#10b981":"#ef4444",fontSize:11,fontWeight:700,marginTop:3}}>{x.growth>=0?"▲":"▼"} {Math.abs(x.growth)}% vs prior 30d</p>
                  :x.sub?<p style={{color:t.sub,fontSize:10,marginTop:3}}>{x.sub}</p>:null}
                </div>)}
              </div>
            </div>

            {/* ── CORE KPI GRID ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard dm={dm} label="Fulfillment Rate" value={`${fulfillmentRate}%`} sub={`${totalDelivered}/${totalScheduled} orders`} accent={fulfillmentRate>=90?"#10b981":fulfillmentRate>=70?"#f59e0b":"#ef4444"}/>
              <StatCard dm={dm} label="Cancellation Rate" value={`${cancelRate}%`} sub={`${cancelCount} cancelled`} accent={cancelRate<=5?"#10b981":cancelRate<=15?"#f59e0b":"#ef4444"}/>
              <StatCard dm={dm} label="Replacement Rate" value={`${replRate}%`} sub={`${replCount} replacements`} accent={replRate>10?"#ef4444":replRate>5?"#f59e0b":"#10b981"}/>
              <StatCard dm={dm} label="30d Retention" value={`${retentionRate}%`} sub={`${activeRecently} of ${customers.filter(c=>c.active).length} active`} accent={retentionRate>=80?"#10b981":retentionRate>=50?"#f59e0b":"#ef4444"}/>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard dm={dm} label="Best Seller" value={prodSales[0]?.name||"—"} sub={prodSales[0]?`${inr(prodSales[0].totalRev)} revenue`:"No data"} accent="#f59e0b"/>
              <StatCard dm={dm} label="Top Customer" value={custRev[0]?.name||"—"} sub={custRev[0]?inr(custRev[0].totalRev)+" revenue":"No data"} accent="#10b981"/>
              <StatCard dm={dm} label="Production Efficiency" value={prodEfficiency>0?`${prodEfficiency}%`:"—"} sub={prodTotalActual>0?`${prodTotalActual} units produced`:"No production data"} accent={prodEfficiency>=90?"#10b981":prodEfficiency>=70?"#f59e0b":"#8b5cf6"}/>
              <StatCard dm={dm} label="Wastage Cost" value={inr(totalWasteCost)} sub={`${wastageByType.reduce((s,w)=>s+w.qty,0)} units wasted`} accent={totalWasteCost>0?"#f97316":"#10b981"}/>
            </div>

            {/* ── PAYMENT HEALTH ── */}
            {(()=>{
              const allPH=deliveries;
              const totalOV=allPH.reduce((s,d)=>s+lineTotal(d.orderLines),0);
              const totalReplPH=allPH.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
              const totalNetPH=totalOV-totalReplPH;
              const totalCollPH=allPH.reduce((s,d)=>s+(d.partialPayment?.enabled?(+(d.partialPayment?.amount)||0):0),0);
              const manualTotalPH=(paymentLedger||[]).reduce((s,e)=>s+e.amount,0);
              const totalPaidPH=totalCollPH+manualTotalPH;
              const totalPendingPH=Math.max(0,totalNetPH-totalPaidPH);
              const partialDelivs=allPH.filter(d=>d.partialPayment?.enabled&&(+(d.partialPayment?.amount)||0)>0).length;
              const collPct=totalNetPH>0?Math.round(totalPaidPH/totalNetPH*100):100;
              return <div style={{background:dm?"linear-gradient(135deg,#0a1f12,#0c0c16)":"linear-gradient(135deg,#f0fdf4,#eff6ff)",border:`1.5px solid ${dm?"#10b98130":"#86efac"}`,borderRadius:20,padding:"16px 18px"}}>
                <div className="flex items-center justify-between mb-3">
                  <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>💳 Payment Health — All Time</p>
                  <button onClick={()=>setTab("Payments")} style={{background:"#10b98115",color:"#10b981",border:"none",borderRadius:8,padding:"3px 10px",fontSize:10,fontWeight:700,cursor:"pointer"}}>Full Ledger →</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr) ",gap:8,marginBottom:10}}>
                  <div style={{background:dm?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.8)",borderRadius:12,padding:"10px 14px",gridColumn:"1/-1"}}>
                    <div className="flex justify-between mb-2"><span style={{color:"#10b981",fontSize:12,fontWeight:700}}>{inr(totalPaidPH)} collected ({collPct}%)</span><span style={{color:"#ef4444",fontSize:12,fontWeight:700}}>{inr(totalPendingPH)} pending</span></div>
                    <div style={{height:8,borderRadius:8,overflow:"hidden",display:"flex",background:t.border}}>
                      <div style={{width:`${collPct}%`,background:"linear-gradient(90deg,#10b981,#059669)",borderRadius:"8px 0 0 8px",transition:"width 0.6s"}}/>
                      <div style={{width:`${100-collPct}%`,background:"#ef4444",borderRadius:"0 8px 8px 0"}}/>
                    </div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                  {[
                    {label:"Repl Deducted",val:inr(totalReplPH),color:"#f97316"},
                    {label:"Partial Payments",val:partialDelivs,color:"#f59e0b",suffix:"deliveries"},
                    {label:"Manual Entries",val:(paymentLedger||[]).length,color:"#3b82f6",suffix:"records"},
                    {label:"Customers w/ Dues",val:customers.filter(c=>c.pending>0).length,color:customers.filter(c=>c.pending>0).length>0?"#ef4444":"#10b981"},
                  ].map(({label,val,color,suffix})=>(
                    <div key={label} style={{background:dm?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.8)",borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
                      <p style={{color,fontWeight:800,fontSize:13,lineHeight:1}}>{val}{suffix?" "+suffix:""}</p>
                      <p style={{color:t.sub,fontSize:9,marginTop:3,textTransform:"uppercase",letterSpacing:"0.05em",lineHeight:1.3}}>{label}</p>
                    </div>
                  ))}
                </div>
              </div>;
            })()}

            {/* ── DELIVERY PERFORMANCE ── */}
            {totalScheduled>0&&<Card dm={dm} className="p-4">
              <p style={{color:t.text}} className="font-bold text-sm mb-1">🚚 Delivery Performance</p>
              <p style={{color:t.sub}} className="text-[11px] mb-4">Delivery health for selected period</p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  {label:"On-Time Delivery",val:`${fulfillmentRate}%`,color:fulfillmentRate>=90?"#10b981":fulfillmentRate>=70?"#f59e0b":"#ef4444",sub:`${totalDelivered} of ${totalScheduled}`,bar:fulfillmentRate},
                  {label:"Cancellation Rate",val:`${cancelRate}%`,color:cancelRate<=5?"#10b981":cancelRate<=15?"#f59e0b":"#ef4444",sub:`${cancelCount} cancelled`,bar:cancelRate},
                  {label:"Replacement Rate",val:`${replRate}%`,color:replRate<=5?"#10b981":replRate<=10?"#f59e0b":"#ef4444",sub:`${replCount} replacements`,bar:replRate},
                ].map(x=><div key={x.label} style={{background:t.inp,borderRadius:12,padding:"12px 14px",textAlign:"center"}}>
                  <p style={{color:x.color,fontWeight:900,fontSize:22,lineHeight:1}}>{x.val}</p>
                  <p style={{color:t.text,fontSize:11,fontWeight:600,marginTop:4}}>{x.label}</p>
                  <p style={{color:t.sub,fontSize:9,marginTop:2}}>{x.sub}</p>
                  <div style={{height:4,borderRadius:4,background:t.border,overflow:"hidden",marginTop:8}}>
                    <div style={{height:"100%",width:`${Math.min(100,x.bar)}%`,background:x.color,borderRadius:4,transition:"width 0.5s"}}/>
                  </div>
                </div>)}
              </div>
              <div style={{background:dm?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.02)",borderRadius:10,padding:"10px 14px",border:`1px solid ${t.border}`}}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  {[["#10b981","Delivered",totalDelivered],["#ef4444","Cancelled",cancelCount],["#f59e0b","Pending",deliveries.filter(d=>d.status==="Pending").length],["#8b5cf6","Replacements",replCount]].map(([c,l,v])=>(
                    <div key={l} className="flex items-center gap-2"><div style={{width:10,height:10,borderRadius:2,background:c}}/><span style={{color:t.sub,fontSize:10}}>{l}: {v}</span></div>
                  ))}
                </div>
                <div style={{height:8,borderRadius:8,overflow:"hidden",display:"flex",gap:1,marginTop:10}}>
                  <div style={{flex:totalDelivered,background:"#10b981"}}/>
                  <div style={{flex:cancelCount,background:"#ef4444"}}/>
                  <div style={{flex:deliveries.filter(d=>d.status==="Pending").length,background:"#f59e0b"}}/>
                  <div style={{flex:replCount,background:"#8b5cf6"}}/>
                </div>
              </div>
            </Card>}

            {/* ── 14-DAY TREND CHART ── */}
            <Card dm={dm} className="p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <p style={{color:t.text}} className="font-bold text-sm">Daily Revenue & Delivery Trend — 14 Days</p>
                  <p style={{color:t.sub}} className="text-[11px]">Revenue bars (left axis) · deliveries line (right axis)</p>
                </div>
                <span style={{background:"#10b98120",color:"#10b981",borderRadius:8,padding:"3px 10px",fontSize:11,fontWeight:700}}>{inr(recentRevTotal)} total</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyData} margin={{top:4,right:4,left:-10,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false}/>
                  <XAxis dataKey="date" tick={{fontSize:9,fill:t.sub}}/>
                  <YAxis yAxisId="left" tick={{fontSize:9,fill:t.sub}} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:`${v}`}/>
                  <YAxis yAxisId="right" orientation="right" tick={{fontSize:9,fill:t.sub}}/>
                  <Tooltip contentStyle={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,color:t.text,fontSize:11}} formatter={(v,n)=>n==="Revenue"?[inr(v),n]:[v,n]}/>
                  <Legend wrapperStyle={{fontSize:10,paddingTop:6}}/>
                  <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#10b981" radius={[3,3,0,0]}/>
                  <Bar yAxisId="right" dataKey="delivered" name="Deliveries" fill="#f59e0b" radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* ── DAY OF WEEK ── */}
            <Card dm={dm} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p style={{color:t.text}} className="font-bold text-sm">Revenue by Day of Week</p>
                  <p style={{color:t.sub}} className="text-[11px]">Best day: <strong style={{color:"#f59e0b"}}>{bestDow.day}</strong> · {inr(bestDow.revenue)}</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={dowData} margin={{top:4,right:0,left:-20,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false}/>
                  <XAxis dataKey="day" tick={{fontSize:11,fill:t.sub}}/>
                  <YAxis tick={{fontSize:9,fill:t.sub}} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:`${v}`}/>
                  <Tooltip contentStyle={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,color:t.text,fontSize:11}} formatter={(v,n)=>n==="Revenue"?[inr(v),n]:[v,n]}/>
                  <Bar dataKey="revenue" name="Revenue" radius={[4,4,0,0]}>
                    {dowData.map((entry,index)=><Cell key={index} fill={entry.revenue===Math.max(...dowData.map(d=>d.revenue))?"#f59e0b":dm?"#3a3a44":"#e2e4e8"}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            </>}

            {/* ══════════ CUSTOMERS SECTION ══════════ */}
            {anlActiveSection==="customers"&&(()=>{
              const filtCust2=(()=>{
                let fc=[...custRev];
                if(anlCustSearch){const q=anlCustSearch.toLowerCase();fc=fc.filter(c=>c.name?.toLowerCase().includes(q)||c.phone?.toLowerCase().includes(q));}
                if(anlCustFilter==="owing") fc=fc.filter(c=>(c.outstandingBalance||0)>0);
                else if(anlCustFilter==="clear") fc=fc.filter(c=>!((c.outstandingBalance||0)>0));
                else if(anlCustFilter==="partial") fc=fc.filter(c=>(c.partialCollected||0)>0);
                if(anlCustSort==="revenue") fc.sort((a,b)=>b.totalRev-a.totalRev);
                else if(anlCustSort==="orders") fc.sort((a,b)=>b.totalOrders-a.totalOrders);
                else if(anlCustSort==="outstanding") fc.sort((a,b)=>(b.outstandingBalance||0)-(a.outstandingBalance||0));
                else if(anlCustSort==="name") fc.sort((a,b)=>(a.name||"").localeCompare(b.name||""));
                return fc;
              })();
              return <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard dm={dm} label="Total Revenue" value={inr(totalNetRevenue)} sub={`${totalDelivered} deliveries`} accent="#10b981"/>
                <StatCard dm={dm} label="Outstanding Balance" value={inr(totalOutstanding)} sub={`${customers.filter(c=>(c.pending||0)>0).length} customers owing`} accent="#ef4444"/>
                <StatCard dm={dm} label="Partial Collected" value={inr(totalPartialCollected)} sub={`${deliveriesWithBalance.length} deliveries`} accent="#f59e0b"/>
                <StatCard dm={dm} label="Fully Settled" value={deliveriesFullySettled.length} sub="deliveries paid in full" accent="#8b5cf6"/>
              </div>
              <Card dm={dm} className="overflow-hidden">
                <div className="p-4 pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <div>
                      <p style={{color:t.text}} className="font-bold text-sm">Customer Analytics</p>
                      <p style={{color:t.sub}} className="text-[11px]">Top {top20pct} customers · {top20share}% of revenue{top20share>=80?" — concentration risk":""}</p>
                    </div>
                    <button onClick={()=>exportCSV(filtCust2,"customer_analytics",[{label:"Name",key:"name"},{label:"Phone",key:"phone"},{label:"Total Orders",key:"totalOrders"},{label:"Revenue",key:"totalRev"},{label:"Gross Revenue",key:"grossRev"},{label:"Repl Deducted",key:"replDeducted"},{label:"Partial Collected",key:"partialCollected"},{label:"Outstanding",key:"outstandingBalance"},{label:"Paid",key:"paid"},{label:"Agent / Created By",val:r=>[...new Set((deliveries.filter(d=>d.customerId===r.id).map(d=>d.createdBy).filter(Boolean)))].join(", ")||"—"}])} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ CSV</button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <input value={anlCustSearch} onChange={e=>setAnlCustSearch(e.target.value)} placeholder="Search customer…" style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 10px",fontSize:12,flex:1,minWidth:120,outline:"none"}}/>
                    <select value={anlCustSort} onChange={e=>setAnlCustSort(e.target.value)} style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 8px",fontSize:12,cursor:"pointer"}}>
                      <option value="revenue">Sort: Revenue ↓</option>
                      <option value="orders">Sort: Orders ↓</option>
                      <option value="outstanding">Sort: Outstanding ↓</option>
                      <option value="name">Sort: Name A–Z</option>
                    </select>
                    <select value={anlCustFilter} onChange={e=>setAnlCustFilter(e.target.value)} style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 8px",fontSize:12,cursor:"pointer"}}>
                      <option value="all">All Customers</option>
                      <option value="owing">Owing Only</option>
                      <option value="clear">Clear Only</option>
                      <option value="partial">Has Partial</option>
                    </select>
                  </div>
                  <p style={{color:t.sub,fontSize:11,marginTop:6}}>{filtCust2.length} customers shown</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr style={{borderBottom:`1px solid ${t.border}`,background:dm?"#111":"#f9f9f8"}}>
                      <th style={{color:t.sub}} className="px-3 py-2 text-left font-bold uppercase tracking-wide text-[10px]">#</th>
                      <th style={{color:t.sub,cursor:"pointer"}} className="px-3 py-2 text-left font-bold uppercase tracking-wide text-[10px]" onClick={()=>setAnlCustSort("name")}>Customer{anlCustSort==="name"?" ↑":""}</th>
                      <th style={{color:t.sub,cursor:"pointer"}} className="px-3 py-2 text-left font-bold uppercase tracking-wide text-[10px]" onClick={()=>setAnlCustSort("orders")}>Orders{anlCustSort==="orders"?" ↓":""}</th>
                      <th style={{color:t.sub,cursor:"pointer"}} className="px-3 py-2 text-right font-bold uppercase tracking-wide text-[10px]" onClick={()=>setAnlCustSort("revenue")}>Revenue{anlCustSort==="revenue"?" ↓":""}</th>
                      <th style={{color:t.sub}} className="px-3 py-2 text-right font-bold uppercase tracking-wide text-[10px]">Part.Paid</th>
                      <th style={{color:t.sub,cursor:"pointer"}} className="px-3 py-2 text-right font-bold uppercase tracking-wide text-[10px]" onClick={()=>setAnlCustSort("outstanding")}>Outstanding{anlCustSort==="outstanding"?" ↓":""}</th>
                      <th style={{color:t.sub}} className="px-3 py-2 text-left font-bold uppercase tracking-wide text-[10px]">Status</th>
                    </tr></thead>
                    <tbody>
                      {filtCust2.map((c,i)=>{
                        const share=totalPortfolioRev>0?Math.round(c.totalRev/totalPortfolioRev*100):0;
                        const hasOutstanding=(c.outstandingBalance||0)>0;
                        const hasPartial=(c.partialCollected||0)>0;
                        const isExp=anlCustExpanded===c.id;
                        const custDelivs=delivered.filter(d=>d.customerId===c.id||d.customer===c.name);
                        return <><tr key={c.id} onClick={()=>setAnlCustExpanded(isExp?null:c.id)} style={{borderBottom:`1px solid ${t.border}`,background:isExp?(dm?"rgba(99,102,241,0.08)":"rgba(99,102,241,0.04)"):hasOutstanding?(dm?"rgba(239,68,68,0.04)":"rgba(239,68,68,0.02)"):undefined,cursor:"pointer"}}>
                            <td style={{color:t.sub}} className="px-3 py-2.5 font-black">{i+1}</td>
                            <td className="px-3 py-2.5">
                              <p style={{color:t.text}} className="font-semibold">{c.name}</p>
                              {c.phone&&<p style={{color:t.sub}} className="text-[10px]">{c.phone}</p>}
                            </td>
                            <td style={{color:t.sub}} className="px-3 py-2.5">{c.totalOrders}</td>
                            <td className="px-3 py-2.5 font-bold text-amber-500 text-right">{inr(c.totalRev)}</td>
                            <td className="px-3 py-2.5 text-right">{hasPartial?<span style={{color:"#f59e0b",fontWeight:700}}>{inr(c.partialCollected)}</span>:<span style={{color:t.sub}}>—</span>}</td>
                            <td className="px-3 py-2.5 text-right"><span style={{color:hasOutstanding?"#ef4444":"#10b981",fontWeight:700}}>{hasOutstanding?inr(c.outstandingBalance):"✓ Clear"}</span></td>
                            <td className="px-3 py-2.5">
                              <span style={{background:hasOutstanding?"#ef444420":"#10b98120",color:hasOutstanding?"#ef4444":"#10b981",borderRadius:6,padding:"2px 7px",fontWeight:700,fontSize:10}}>{hasOutstanding?"OWING":"CLEAR"}</span>
                              <span style={{color:t.sub,fontSize:10,marginLeft:4}}>{isExp?"▲":"▼"}</span>
                            </td>
                          </tr>
                          {isExp&&<tr style={{background:dm?"rgba(99,102,241,0.06)":"rgba(99,102,241,0.03)"}}>
                            <td colSpan={7} className="px-4 py-3">
                              <p style={{color:t.sub,fontSize:11,fontWeight:700,marginBottom:6}}>Recent deliveries · {c.name}</p>
                              {custDelivs.length===0?<p style={{color:t.sub,fontSize:11}}>No deliveries in this period.</p>
                              :custDelivs.slice(0,5).map(d=>{
                                const net=Math.max(0,lineTotal(d.orderLines)-(+(d.replacement?.amount)||0));
                                const anlInvNo=(invRegistry?.issued||{})[d.id]||d.invNo||null;
                                return <div key={d.id} style={{background:t.inp,borderRadius:8,padding:"6px 10px",marginBottom:4,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                                  <div>
                                    <p style={{color:t.text,fontSize:11,fontWeight:600}}>{d.date} · <span style={{color:d.status==="Delivered"?"#10b981":"#f59e0b"}}>{d.status}</span></p>
                                    {anlInvNo&&<p style={{color:"#8b5cf6",fontSize:9,fontFamily:"monospace",fontWeight:700,marginTop:2}}>📄 {anlInvNo} · 🧾 RCP-{anlInvNo.replace(/^[A-Z]+-/,"")}</p>}
                                    {d.orderLines&&Object.values(d.orderLines).filter(l=>l.qty>0).map((l,li)=><span key={li} style={{color:t.sub,fontSize:10,marginRight:6}}>{l.name||l.product||""} ×{l.qty}</span>)}
                                  </div>
                                  <p style={{color:"#f59e0b",fontWeight:700,fontSize:12}}>{inr(net)}</p>
                                </div>;
                              })}
                            </td>
                          </tr>}
                        </>;
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
              <Card dm={dm} className="p-4">
                <p style={{color:t.text}} className="font-bold text-sm mb-3">👤 Customer Retention</p>
                <div className="grid grid-cols-3 gap-3">
                  <div style={{background:t.inp,borderRadius:12,padding:"12px 14px",textAlign:"center"}}>
                    <p style={{color:"#10b981",fontWeight:900,fontSize:22}}>{activeRecently}</p>
                    <p style={{color:t.text,fontSize:11,fontWeight:600,marginTop:4}}>Active (30d)</p>
                  </div>
                  <div style={{background:t.inp,borderRadius:12,padding:"12px 14px",textAlign:"center"}}>
                    <p style={{color:"#f59e0b",fontWeight:900,fontSize:22}}>{customers.filter(c=>c.active).length-activeRecently}</p>
                    <p style={{color:t.text,fontSize:11,fontWeight:600,marginTop:4}}>Inactive</p>
                  </div>
                  <div style={{background:t.inp,borderRadius:12,padding:"12px 14px",textAlign:"center"}}>
                    <p style={{color:retentionRate>=80?"#10b981":retentionRate>=50?"#f59e0b":"#ef4444",fontWeight:900,fontSize:22}}>{retentionRate}%</p>
                    <p style={{color:t.text,fontSize:11,fontWeight:600,marginTop:4}}>Retention Rate</p>
                  </div>
                </div>
              </Card>
              </>;
            })()}

            {/* ══════════ PRODUCTS SECTION ══════════ */}
            {anlActiveSection==="products"&&(()=>{
              const sortedProds=(()=>{
                let sp=[...prodSales];
                if(anlProdSort==="qty") sp.sort((a,b)=>b.totalQty-a.totalQty);
                else if(anlProdSort==="deliveries") sp.sort((a,b)=>b.deliveryCount-a.deliveryCount);
                else sp.sort((a,b)=>b.totalRev-a.totalRev);
                return sp;
              })();
              return <>
              <Card dm={dm} className="overflow-hidden">
                <div className="p-4 pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <div>
                      <p style={{color:t.text}} className="font-bold text-sm">Product Performance</p>
                      <p style={{color:t.sub}} className="text-[11px]">Click a product to expand delivery breakdown</p>
                    </div>
                    <div className="flex gap-2 flex-wrap items-center">
                      <select value={anlProdSort} onChange={e=>setAnlProdSort(e.target.value)} style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>
                        <option value="revenue">Sort: Revenue</option>
                        <option value="qty">Sort: Quantity</option>
                        <option value="deliveries">Sort: Deliveries</option>
                      </select>
                      <button onClick={()=>exportCSV(sortedProds,"product_analytics",[{label:"Product",key:"name"},{label:"Unit",key:"unit"},{label:"Total Qty",key:"totalQty"},{label:"Total Revenue",key:"totalRev"},{label:"Gross Revenue",key:"grossRev"},{label:"Repl Deducted",key:"replDeducted"},{label:"Deliveries",key:"deliveryCount"}])} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ CSV</button>
                    </div>
                  </div>
                </div>
                {sortedProds.map((p,i)=>{
                  const revShare=totalProductRev>0?Math.round(p.totalRev/totalProductRev*100):0;
                  const isExp=anlProdExpanded===p.id;
                  const prodDelivs=delivered.filter(d=>d.orderLines&&Object.values(d.orderLines).some(l=>(l.name===p.name||l.product===p.name)&&l.qty>0));
                  return <div key={p.id}>
                    <div onClick={()=>setAnlProdExpanded(isExp?null:p.id)} style={{borderTop:`1px solid ${t.border}`,cursor:"pointer",background:isExp?(dm?"rgba(139,92,246,0.07)":"rgba(139,92,246,0.03)"):undefined}} className="px-4 py-3">
                      <div className="flex items-start justify-between mb-1.5 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span style={{color:t.sub,width:18,textAlign:"center",fontWeight:800,fontSize:11,flexShrink:0}}>{i+1}</span>
                          <div className="min-w-0">
                            <p style={{color:t.text,fontSize:12,fontWeight:600}} className="truncate">{p.name}</p>
                            <p style={{color:t.sub,fontSize:10}}>{p.totalQty} {p.unit} · {p.deliveryCount} deliveries</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 flex items-center gap-2">
                          <div>
                            <p className="font-black text-amber-500 text-sm leading-none">{inr(p.totalRev)}</p>
                            <p style={{color:t.sub,fontSize:9}}>{revShare}% of sales</p>
                          </div>
                          <span style={{color:t.sub,fontSize:10}}>{isExp?"▲":"▼"}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:t.border}}>
                          <div className="h-full rounded-full" style={{width:`${revShare}%`,background:["#f59e0b","#10b981","#8b5cf6","#ef4444","#0ea5e9","#f97316","#ec4899"][i%7],transition:"width 0.5s ease"}}/>
                        </div>
                        <span style={{color:t.sub,fontSize:10,fontWeight:700,minWidth:28,textAlign:"right"}}>{revShare}%</span>
                      </div>
                    </div>
                    {isExp&&<div style={{background:dm?"rgba(139,92,246,0.05)":"rgba(139,92,246,0.02)",borderTop:`1px solid ${t.border}`,padding:"10px 16px"}}>
                      <p style={{color:t.sub,fontSize:11,fontWeight:700,marginBottom:6}}>Recent deliveries with {p.name}</p>
                      {prodDelivs.length===0?<p style={{color:t.sub,fontSize:11}}>No deliveries found.</p>
                      :prodDelivs.slice(0,5).map(d=>{
                        const qty=d.orderLines?Object.values(d.orderLines).find(l=>(l.name===p.name||l.product===p.name))?.qty||0:0;
                        return <div key={d.id} style={{background:t.inp,borderRadius:8,padding:"6px 10px",marginBottom:4,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div>
                            <p style={{color:t.text,fontSize:11,fontWeight:600}}>{d.customer} · {d.date}</p>
                            <p style={{color:t.sub,fontSize:10}}>{qty} {p.unit} · {d.status}</p>
                          </div>
                          <p style={{color:"#8b5cf6",fontWeight:700,fontSize:12}}>{inr(qty*(p.totalRev/Math.max(1,p.totalQty)))}</p>
                        </div>;
                      })}
                    </div>}
                  </div>;
                })}
              </Card>

              {expCatData.length>0?<Card dm={dm} className="overflow-hidden">
                <div className="p-4 pb-2 flex items-center justify-between">
                  <div>
                    <p style={{color:t.text}} className="font-bold text-sm">Expense Breakdown</p>
                    <p style={{color:t.sub}} className="text-[11px]">{inr(totalExpenses)} total · {expCatData.length} categories</p>
                  </div>
                  <button onClick={()=>exportCSV(expCatData,"expense_breakdown",[{label:"Category",key:"category"},{label:"Amount",key:"amount"},{label:"Count",key:"count"}])} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ CSV</button>
                </div>
                {expCatData.map((e,i)=>{
                  const pct=totalExpenses>0?Math.round(e.amount/totalExpenses*100):0;
                  return <div key={e.category} style={{borderTop:`1px solid ${t.border}`}} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div style={{width:8,height:8,borderRadius:2,background:["#f59e0b","#10b981","#8b5cf6","#ef4444","#0ea5e9","#f97316","#ec4899"][i%7],flexShrink:0}}/>
                        <p style={{color:t.text,fontSize:12,fontWeight:600}}>{e.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-red-400">{inr(e.amount)}</p>
                        <p style={{color:t.sub,fontSize:9}}>{pct}% · {e.count} entries</p>
                      </div>
                    </div>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:t.border}}>
                      <div className="h-full rounded-full" style={{width:`${pct}%`,background:["#f59e0b","#10b981","#8b5cf6","#ef4444","#0ea5e9","#f97316","#ec4899"][i%7]}}/>
                    </div>
                  </div>;
                })}
              </Card>:<Card dm={dm} className="p-4 flex items-center justify-center" style={{minHeight:200}}>
                <p style={{color:t.sub,fontSize:13}}>No expense data recorded yet.</p>
              </Card>}

              {filtRepl.length>0&&<Card dm={dm} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p style={{color:t.text}} className="font-bold text-sm">🔄 Replacement Analytics</p>
                    <p style={{color:t.sub}} className="text-[11px]">{filtRepl.length} replacements · {inr(totalReplAmt)} deducted</p>
                  </div>
                  <button onClick={()=>exportCSV(replByItem,"replacements_by_item",[{label:"Item",key:"item"},{label:"Count",key:"count"},{label:"Amount",key:"amount"}])} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ CSV</button>
                </div>
                {replByItem.length>0&&<div className="flex flex-col gap-2">
                  {replByItem.map((r,i)=>(
                    <div key={r.item} style={{background:t.inp,borderRadius:10,padding:"10px 14px"}}>
                      <div className="flex items-center justify-between mb-1">
                        <p style={{color:t.text,fontWeight:600,fontSize:12}}>{r.item}</p>
                        <div className="text-right">
                          <p style={{color:"#f97316",fontWeight:700,fontSize:12}}>{r.count}×</p>
                          {r.amount>0&&<p style={{color:t.sub,fontSize:10}}>−{inr(r.amount)}</p>}
                        </div>
                      </div>
                      <div style={{height:4,borderRadius:4,background:t.border,overflow:"hidden"}}>
                        <div style={{width:`${totalReplAmt>0?Math.round(r.amount/totalReplAmt*100):100}%`,height:"100%",background:"#f97316",borderRadius:4}}/>
                      </div>
                    </div>
                  ))}
                </div>}
              </Card>}

              {wastageByType.length>0&&<Card dm={dm} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p style={{color:t.text}} className="font-bold text-sm">Wastage Analysis</p>
                    <p style={{color:t.sub}} className="text-[11px]">{inr(totalWasteCost)} in losses · {wastageByType.reduce((s,w)=>s+w.qty,0)} units wasted</p>
                  </div>
                  <button onClick={()=>exportCSV(wastageByType,"wastage_analysis",[{label:"Type",key:"type"},{label:"Qty",key:"qty"},{label:"Cost",key:"cost"}])} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ CSV</button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {wastageByType.map((w,i)=>{
                    const pct=totalWasteCost>0?Math.round(w.cost/totalWasteCost*100):0;
                    return <div key={w.type} style={{background:t.inp,borderRadius:12,padding:"12px 14px",borderLeft:`3px solid ${["#f59e0b","#10b981","#8b5cf6","#ef4444","#0ea5e9","#f97316","#ec4899"][i%7]}`}}>
                      <p style={{color:t.text,fontWeight:700,fontSize:13}}>{w.type}</p>
                      <p style={{color:t.sub,fontSize:10,marginTop:2}}>{w.qty} units</p>
                      {w.cost>0&&<>
                        <p className="text-red-400 font-bold text-xs mt-1">{inr(w.cost)}</p>
                        <p style={{color:t.sub,fontSize:9}}>{pct}% of waste losses</p>
                      </>}
                    </div>;
                  })}
                </div>
              </Card>}
              </>;
            })()}

            {/* ══════════ OPERATIONS SECTION ══════════ */}
            {anlActiveSection==="operations"&&(()=>{
              const opsViews=[["production","🏭 Production"],["qc","🔬 QC"],["supply","📦 Supply"],["wastage","🗑️ Wastage"]];
              return <>
              <div className="flex gap-2 flex-wrap mb-1">
                {opsViews.map(([v,label])=><button key={v} onClick={()=>setAnlOpsView(v)} style={{background:anlOpsView===v?"#8b5cf6":t.inp,color:anlOpsView===v?"#fff":t.sub,border:`1px solid ${anlOpsView===v?"#8b5cf6":t.border}`,borderRadius:20,padding:"5px 14px",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all 0.2s"}}>{label}</button>)}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard dm={dm} label="Units Produced" value={prodTotalActual.toLocaleString("en-IN")} sub={`of ${prodTotalTarget} targeted`} accent="#8b5cf6"/>
                <StatCard dm={dm} label="Production Efficiency" value={`${prodEfficiency}%`} sub="actual vs target" accent={prodEfficiency>=90?"#10b981":prodEfficiency>=70?"#f59e0b":"#ef4444"}/>
                <StatCard dm={dm} label="QC Pass Rate" value={`${qcPassRate}%`} sub={`${filtQC.length} checks done`} accent={qcPassRate>=90?"#10b981":qcPassRate>=75?"#f59e0b":"#ef4444"}/>
                <StatCard dm={dm} label="Supply Cost" value={inr(totalSupplyCost)} sub={`${filtSup.length} supply entries`} accent="#6366f1"/>
              </div>

              {anlOpsView==="production"&&<>
              {prodByProduct.length>0&&<Card dm={dm} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p style={{color:t.text}} className="font-bold text-sm">🏭 Production by Product</p>
                  </div>
                  <button onClick={()=>exportCSV(prodByProduct,"production_by_product",[{label:"Product",key:"product"},{label:"Batches",key:"batches"},{label:"Actual",key:"actual"},{label:"Target",key:"target"},{label:"Efficiency %",val:r=>r.target>0?Math.round(r.actual/r.target*100):0}])} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ CSV</button>
                </div>
                <div className="flex flex-col gap-3">
                  {prodByProduct.map((p,i)=>{
                    const eff=p.target>0?Math.round(p.actual/p.target*100):100;
                    return <div key={p.product} style={{background:t.inp,borderRadius:12,padding:"12px 14px"}}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p style={{color:t.text,fontWeight:700,fontSize:13}}>{p.product}</p>
                          <p style={{color:t.sub,fontSize:10}}>{p.batches} batches · {p.actual} units produced</p>
                        </div>
                        <div className="text-right">
                          <p style={{color:eff>=90?"#10b981":eff>=70?"#f59e0b":"#ef4444",fontWeight:800,fontSize:16}}>{eff}%</p>
                          <p style={{color:t.sub,fontSize:9}}>efficiency</p>
                        </div>
                      </div>
                      <div style={{height:6,borderRadius:6,background:t.border,overflow:"hidden"}}>
                        <div style={{width:`${Math.min(100,eff)}%`,height:"100%",background:eff>=90?"#10b981":eff>=70?"#f59e0b":"#ef4444",borderRadius:6,transition:"width 0.5s"}}/>
                      </div>
                    </div>;
                  })}
                </div>
              </Card>}
              </>}

              {anlOpsView==="qc"&&<>
              {qcGradeBreak.length>0&&<Card dm={dm} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p style={{color:t.text}} className="font-bold text-sm">🔬 QC Grade Distribution</p>
                  <button onClick={()=>exportCSV(filtQC,"qc_checks",[{label:"Date",key:"date"},{label:"Product",key:"product"},{label:"Grade",key:"grade"},{label:"Batch",key:"batchLabel"},{label:"Notes",key:"notes"}])} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ CSV</button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[{g:"A",c:"#10b981",l:"Grade A — Pass"},{g:"B",c:"#f59e0b",l:"Grade B — Pass"},{g:"C",c:"#f97316",l:"Grade C — Marginal"},{g:"F",c:"#ef4444",l:"Fail — Reject"}].map(({g,c,l})=>{
                    const cnt=filtQC.filter(q=>q.grade===g).length;
                    const pct=filtQC.length>0?Math.round(cnt/filtQC.length*100):0;
                    return <div key={g} style={{background:t.inp,borderRadius:12,padding:"12px 14px",borderTop:`3px solid ${c}`}}>
                      <p style={{color:c,fontWeight:900,fontSize:22}}>{cnt}</p>
                      <p style={{color:t.text,fontSize:11,fontWeight:600}}>{l}</p>
                      <p style={{color:t.sub,fontSize:10}}>{pct}% of checks</p>
                    </div>;
                  })}
                </div>
              </Card>}
              </>}

              {anlOpsView==="supply"&&<>
              {supByCategory.length>0&&<Card dm={dm} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p style={{color:t.text}} className="font-bold text-sm">📦 Supply Cost by Category</p>
                  <button onClick={()=>exportCSV(supByCategory,"supply_by_category",[{label:"Category",key:"cat"},{label:"Total",key:"total"},{label:"Count",key:"count"}])} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ CSV</button>
                </div>
                <div className="flex flex-col gap-2">
                  {supByCategory.map((s,i)=>{
                    const pct=totalSupplyCost>0?Math.round(s.total/totalSupplyCost*100):0;
                    return <div key={s.cat} style={{background:t.inp,borderRadius:10,padding:"10px 14px"}}>
                      <div className="flex items-center justify-between mb-1">
                        <p style={{color:t.text,fontWeight:600,fontSize:12}}>{s.cat}</p>
                        <div className="text-right">
                          <p style={{color:"#8b5cf6",fontWeight:700,fontSize:12}}>{inr(s.total)}</p>
                          <p style={{color:t.sub,fontSize:10}}>{s.count} entries · {pct}%</p>
                        </div>
                      </div>
                      <div style={{height:4,borderRadius:4,background:t.border,overflow:"hidden"}}>
                        <div style={{width:`${pct}%`,height:"100%",background:["#f59e0b","#10b981","#8b5cf6","#ef4444","#0ea5e9","#f97316","#ec4899"][i%7],borderRadius:4}}/>
                      </div>
                    </div>;
                  })}
                </div>
              </Card>}
              </>}

              {anlOpsView==="wastage"&&<>
              {wastageByType.length>0&&<Card dm={dm} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p style={{color:t.text}} className="font-bold text-sm">🗑️ Wastage by Type</p>
                    <p style={{color:t.sub}} className="text-[11px]">{inr(totalWasteCost)} total loss</p>
                  </div>
                  <button onClick={()=>exportCSV(wastageByType,"wastage_by_type",[{label:"Type",key:"type"},{label:"Qty",key:"qty"},{label:"Cost",key:"cost"}])} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ CSV</button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {wastageByType.map((w,i)=>(
                    <div key={w.type} style={{background:t.inp,borderRadius:12,padding:"12px 14px",borderLeft:`3px solid ${["#f59e0b","#10b981","#8b5cf6","#ef4444","#0ea5e9","#f97316","#ec4899"][i%7]}`}}>
                      <p style={{color:t.text,fontWeight:700,fontSize:13}}>{w.type}</p>
                      <p style={{color:t.sub,fontSize:10,marginTop:2}}>{w.qty} units</p>
                      {w.cost>0&&<p className="text-red-400 font-bold text-xs mt-1">{inr(w.cost)}</p>}
                    </div>
                  ))}
                </div>
              </Card>}
              </>}
              </>;
            })()}

            {/* ══════════ FINANCIALS SECTION ══════════ */}
            {anlActiveSection==="financials"&&(()=>{
              const finViews=[["summary","📊 Summary"],["chart","📈 Chart"],["expenses","💸 Expenses"]];
              return <>
              <div className="flex gap-2 flex-wrap mb-1">
                {finViews.map(([v,label])=><button key={v} onClick={()=>setAnlFinView(v)} style={{background:anlFinView===v?"#10b981":t.inp,color:anlFinView===v?"#fff":t.sub,border:`1px solid ${anlFinView===v?"#10b981":t.border}`,borderRadius:20,padding:"5px 14px",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all 0.2s"}}>{label}</button>)}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard dm={dm} label="Gross Revenue" value={inr(totalGrossRevenue)} sub="before deductions" accent="#10b981"/>
                <StatCard dm={dm} label="Net Revenue" value={inr(totalNetRevenue)} sub={`−${inr(totalReplDeductions)} replacements`} accent="#3b82f6"/>
                <StatCard dm={dm} label="Total Outstanding" value={inr(totalOutstanding)} sub={`${customers.filter(c=>(c.pending||0)>0).length} customers owing`} accent="#ef4444"/>
                <StatCard dm={dm} label="Total Collected" value={inr(totalCustPaid)} sub="all time" accent="#8b5cf6"/>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard dm={dm} label="Supply Cost" value={inr(totalSupplyCost)} sub={`${filtSup.length} entries`} accent="#6366f1"/>
                <StatCard dm={dm} label="Total Expenses" value={inr(totalExpenses)} sub={`${expCatData.length} categories`} accent="#f97316"/>
                <StatCard dm={dm} label="Wastage Loss" value={inr(totalWasteCost)} sub="estimated cost" accent="#f59e0b"/>
                <StatCard dm={dm} label="Partial Collected" value={inr(totalPartialCollected)} sub={`${deliveriesWithBalance.length} pending balance`} accent="#0ea5e9"/>
              </div>

              {anlFinView==="summary"&&<Card dm={dm} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p style={{color:t.text}} className="font-bold text-sm">💰 Financial Summary</p>
                  <button onClick={()=>exportCSV([{gross:totalGrossRevenue,net:totalNetRevenue,outstanding:totalOutstanding,collected:totalCustPaid,supply:totalSupplyCost,expenses:totalExpenses,wastage:totalWasteCost,partial:totalPartialCollected}],"financial_summary",[{label:"Gross Revenue",key:"gross"},{label:"Net Revenue",key:"net"},{label:"Outstanding",key:"outstanding"},{label:"Collected",key:"collected"},{label:"Supply Cost",key:"supply"},{label:"Expenses",key:"expenses"},{label:"Wastage",key:"wastage"},{label:"Partial Collected",key:"partial"}])} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ CSV</button>
                </div>
                <div className="flex flex-col gap-2">
                  {[{label:"Gross Revenue",val:totalGrossRevenue,c:"#10b981"},{label:"Replacement Deductions",val:-totalReplDeductions,c:"#f97316"},{label:"Net Revenue",val:totalNetRevenue,c:"#3b82f6"},{label:"Supply Cost",val:-totalSupplyCost,c:"#8b5cf6"},{label:"Expenses",val:-totalExpenses,c:"#ef4444"},{label:"Wastage Loss",val:-totalWasteCost,c:"#f59e0b"}].map(row=>(
                    <div key={row.label} style={{background:t.inp,borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <p style={{color:t.text,fontSize:12,fontWeight:600}}>{row.label}</p>
                      <p style={{color:row.val>=0?"#10b981":"#ef4444",fontWeight:700,fontSize:13}}>{row.val>=0?"+":""}{inr(Math.abs(row.val))}</p>
                    </div>
                  ))}
                  <div style={{background:"rgba(59,130,246,0.1)",borderRadius:10,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",borderLeft:"3px solid #3b82f6"}}>
                    <p style={{color:t.text,fontSize:13,fontWeight:800}}>Estimated Profit/Loss</p>
                    <p style={{color:totalNetRevenue-totalSupplyCost-totalExpenses-totalWasteCost>=0?"#10b981":"#ef4444",fontWeight:900,fontSize:15}}>{inr(Math.abs(totalNetRevenue-totalSupplyCost-totalExpenses-totalWasteCost))}</p>
                  </div>
                </div>
              </Card>}

              {anlFinView==="chart"&&<Card dm={dm} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p style={{color:t.text}} className="font-bold text-sm">💰 Revenue vs Costs — 14 Days</p>
                  <button onClick={()=>exportCSV(dailyData,"revenue_vs_costs_14d",[{label:"Date",key:"date"},{label:"Revenue",key:"revenue"},{label:"Expenses",key:"expenses"}])} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ CSV</button>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dailyData} margin={{top:4,right:4,left:-10,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.border} vertical={false}/>
                    <XAxis dataKey="date" tick={{fontSize:9,fill:t.sub}}/>
                    <YAxis tick={{fontSize:9,fill:t.sub}} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:`${v}`}/>
                    <Tooltip contentStyle={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,color:t.text,fontSize:11}} formatter={(v)=>[inr(v)]}/>
                    <Legend wrapperStyle={{fontSize:10,paddingTop:6}}/>
                    <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[3,3,0,0]}/>
                    <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[3,3,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </Card>}

              {anlFinView==="expenses"&&expCatData.length>0&&<Card dm={dm} className="overflow-hidden">
                <div className="p-4 pb-2 flex items-center justify-between">
                  <div>
                    <p style={{color:t.text}} className="font-bold text-sm">Expense Breakdown</p>
                    <p style={{color:t.sub}} className="text-[11px]">{inr(totalExpenses)} total</p>
                  </div>
                  <button onClick={()=>exportCSV(expCatData,"expense_categories",[{label:"Category",key:"category"},{label:"Amount",key:"amount"},{label:"Count",key:"count"}])} style={{background:t.inp,color:t.sub,border:`1px solid ${t.border}`,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>⬇ CSV</button>
                </div>
                {expCatData.map((e,i)=>{
                  const pct=totalExpenses>0?Math.round(e.amount/totalExpenses*100):0;
                  return <div key={e.category} style={{borderTop:`1px solid ${t.border}`}} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div style={{width:8,height:8,borderRadius:2,background:["#f59e0b","#10b981","#8b5cf6","#ef4444","#0ea5e9","#f97316","#ec4899"][i%7]}}/>
                        <p style={{color:t.text,fontSize:12,fontWeight:600}}>{e.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-red-400">{inr(e.amount)}</p>
                        <p style={{color:t.sub,fontSize:9}}>{pct}% · {e.count} entries</p>
                      </div>
                    </div>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{background:t.border}}>
                      <div className="h-full rounded-full" style={{width:`${pct}%`,background:["#f59e0b","#10b981","#8b5cf6","#ef4444","#0ea5e9","#f97316","#ec4899"][i%7]}}/>
                    </div>
                  </div>;
                })}
              </Card>}
              </>;
            })()}

            {/* ── ACTIVITY LOG ── always visible ── */}
            <Card dm={dm} className="overflow-hidden">
              <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <p style={{color:t.text}} className="font-bold text-sm">Recent Activity Log</p>
                <span style={{color:t.sub,fontSize:11}}>{actLog.length} entries</span>
              </div>
              <Hr dm={dm}/>
              {actLog.length===0?<p style={{color:t.sub}} className="text-sm text-center py-5">No activity recorded yet.</p>
              :actLog.slice(0,20).map(a=>(
                <div key={a.id} style={{borderBottom:`1px solid ${t.border}`}} className="px-4 py-2.5 flex items-start justify-between gap-3 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p style={{color:t.text,fontSize:12,fontWeight:600}}>{a.action}</p>
                    <p style={{color:t.sub,fontSize:11}} className="truncate">{a.detail}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p style={{color:t.sub,fontSize:10}}>{a.user}</p>
                    <p style={{color:t.sub,fontSize:10}}>{a.ts}</p>
                  </div>
                </div>
              ))}
            </Card>
          </>;
        })()}


        {/* PRODUCTION + QC + WASTAGE (merged) */}
        {tab==="Production"&&(()=>{
          const todayStr=today();
          const yesterdayStr=(()=>{const d=new Date();d.setDate(d.getDate()-1);return d.toISOString().slice(0,10);})();
          const last7=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return d.toISOString().slice(0,10);});
          const last30=Array.from({length:30},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return d.toISOString().slice(0,10);});
          const filterDates=ptDateFilter==="today"?[todayStr]:ptDateFilter==="yesterday"?[yesterdayStr]:ptDateFilter==="week"?last7:ptDateFilter==="month"?last30:ptDateFilter==="custom"&&ptCustomFrom?Array.from({length:Math.min(365,Math.ceil((new Date(ptCustomTo||todayStr)-new Date(ptCustomFrom))/86400000)+1)},(_,i)=>{const d=new Date(ptCustomFrom);d.setDate(d.getDate()+i);return d.toISOString().slice(0,10);}):null;
          const filteredPT=(filterDates?prodTargets.filter(x=>filterDates.includes(x.date)):prodTargets).filter(x=>!ptSearch||x.product?.toLowerCase().includes(ptSearch.toLowerCase())||x.shift?.toLowerCase().includes(ptSearch.toLowerCase())||x.notes?.toLowerCase().includes(ptSearch.toLowerCase())||x.batchLabel?.toLowerCase().includes(ptSearch.toLowerCase())).filter(x=>ptShiftFilter==="all"||(!x.shift&&ptShiftFilter==="none")||(x.shift&&x.shift===ptShiftFilter)).filter(x=>ptProductFilter==="all"||x.product===ptProductFilter).filter(x=>{if(ptHandoverFilter==="all")return true;const hasHV=(handovers||[]).some(h=>h.batchId===x.batchId);return ptHandoverFilter==="with"?hasHV:!hasHV;});
          const todayPT=prodTargets.filter(x=>x.date===todayStr);
          const allQty=prodTargets.reduce((s,x)=>s+(+x.actual||0),0);
          const GRADES=[{g:"A",color:"#10b981",label:"Pass — Grade A"},{g:"B",color:"#f59e0b",label:"Pass — Grade B"},{g:"C",color:"#f97316",label:"Marginal — Grade C"},{g:"F",color:"#ef4444",label:"Fail — Reject"}];
          const gradeColor=g=>GRADES.find(x=>x.g===g)?.color||"#6b7280";
          const uniqueDates=[...new Set(filteredPT.map(x=>x.date))].sort((a,b)=>b.localeCompare(a));
          const filteredWaste=(filterDates?(wastage||[]).filter(w=>filterDates.includes(w.date)):(wastage||[])).filter(w=>!ptSearch||w.product?.toLowerCase().includes(ptSearch.toLowerCase())||w.type?.toLowerCase().includes(ptSearch.toLowerCase())).filter(w=>ptWasteTypeFilter==="all"||w.type===ptWasteTypeFilter).filter(w=>ptShiftFilter==="all"||(!w.shift&&ptShiftFilter==="none")||(w.shift&&w.shift===ptShiftFilter));
          const filteredQC=(filterDates?(qcLogs||[]).filter(q=>filterDates.includes(q.date)):(qcLogs||[])).filter(q=>!ptSearch||q.product?.toLowerCase().includes(ptSearch.toLowerCase())||q.grade?.toLowerCase().includes(ptSearch.toLowerCase())).filter(q=>ptQcGradeFilter==="all"||q.grade===ptQcGradeFilter).filter(q=>ptShiftFilter==="all"||(!q.shift&&ptShiftFilter==="none")||(q.shift&&q.shift===ptShiftFilter));
          return <>
            {/* KPI strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard dm={dm} label="Total Batches" value={[...new Set(prodTargets.filter(x=>x.batchId).map(x=>x.batchId))].length||prodTargets.length} sub={`${todayPT.length} today`} accent="#8b5cf6"/>
              <StatCard dm={dm} label="Units Produced" value={allQty.toLocaleString("en-IN")} sub="All time" accent="#6366f1"/>
              <StatCard dm={dm} label="QC Checks" value={(qcLogs||[]).length} sub={`${Math.round((qcLogs||[]).filter(q=>q.grade!=="F").length/Math.max((qcLogs||[]).length,1)*100)}% pass rate`} accent="#14b8a6"/>
              <StatCard dm={dm} label="Wastage Records" value={(wastage||[]).length} sub={`${inr((wastage||[]).reduce((s,w)=>s+(w.cost||0),0))} total cost`} accent="#f97316"/>
            </div>
            {/* ── Filter Bar ── */}
            <div style={{background:t.card,border:`1.5px solid ${t.inpB}`,borderRadius:14,overflow:"hidden"}}>
              {/* Search row */}
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"0 14px",minHeight:50,borderBottom:ptShowFilters?`1px solid ${t.border}`:"none"}}>
                <span style={{color:t.sub,fontSize:14,flexShrink:0}}>🔍</span>
                <input value={ptSearch} onChange={e=>setPtSearch(e.target.value)} placeholder="Search batch, product, notes…"
                  style={{flex:1,background:"transparent",border:"none",outline:"none",color:t.text,fontSize:14,padding:"10px 0"}}/>
                {ptSearch&&<button onClick={()=>setPtSearch("")} style={{color:t.sub,fontSize:18,background:"none",border:"none",cursor:"pointer",minWidth:28,padding:0}}>×</button>}
                <button onClick={()=>setPtShowFilters(f=>!f)}
                  style={{display:"flex",alignItems:"center",gap:5,background:ptShowFilters?(dm?"#f59e0b":"#1c1917"):t.inp,color:ptShowFilters?(dm?"#000":"#fff"):t.sub,border:"none",borderRadius:9,padding:"6px 13px",fontSize:11,fontWeight:700,cursor:"pointer",transition:"all 0.15s",flexShrink:0,whiteSpace:"nowrap"}}>
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M4 7h6M6 10h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                  Filters{(ptShiftFilter!=="all"||ptDateFilter!=="today"||ptProductFilter!=="all"||ptWasteTypeFilter!=="all"||ptQcGradeFilter!=="all"||ptHandoverFilter!=="all")&&<span style={{background:"#ef4444",color:"#fff",borderRadius:99,width:16,height:16,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,marginLeft:2}}>{[ptShiftFilter!=="all",ptDateFilter!=="today",ptProductFilter!=="all",ptWasteTypeFilter!=="all",ptQcGradeFilter!=="all",ptHandoverFilter!=="all"].filter(Boolean).length}</span>}
                </button>
              </div>
              {/* Expanded filter panel */}
              {ptShowFilters&&<div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
                {/* Date range */}
                <div>
                  <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Date Range</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {[["today","Today"],["yesterday","Yesterday"],["week","7 Days"],["month","30 Days"],["all","All Time"],["custom","Custom"]].map(([val,label])=>(
                      <button key={val} onClick={()=>setPtDateFilter(val)}
                        style={{background:ptDateFilter===val?(dm?"#f59e0b":"#1c1917"):t.inp,color:ptDateFilter===val?(dm?"#000":"#fff"):t.sub,borderRadius:99,padding:"5px 13px",fontSize:11,fontWeight:700,border:"none",cursor:"pointer",transition:"all 0.15s"}}>{label}</button>
                    ))}
                  </div>
                  {ptDateFilter==="custom"&&<div className="flex gap-2 items-center mt-2 flex-wrap">
                    <div style={{background:t.inp,border:`1px solid ${t.inpB}`,borderRadius:9,padding:"5px 11px",display:"flex",alignItems:"center",gap:6}}>
                      <span style={{color:t.sub,fontSize:10,fontWeight:600}}>From</span>
                      <input type="date" value={ptCustomFrom} onChange={e=>setPtCustomFrom(e.target.value)} style={{background:"transparent",border:"none",outline:"none",color:t.text,fontSize:12}}/>
                    </div>
                    <span style={{color:t.sub}}>→</span>
                    <div style={{background:t.inp,border:`1px solid ${t.inpB}`,borderRadius:9,padding:"5px 11px",display:"flex",alignItems:"center",gap:6}}>
                      <span style={{color:t.sub,fontSize:10,fontWeight:600}}>To</span>
                      <input type="date" value={ptCustomTo} onChange={e=>setPtCustomTo(e.target.value)} style={{background:"transparent",border:"none",outline:"none",color:t.text,fontSize:12}}/>
                    </div>
                  </div>}
                </div>
                {/* Shift */}
                <div>
                  <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Shift</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {[["all","All"],["none","No Shift"],...(settings?.shifts||["Morning","Afternoon","Evening","Night"]).map(s=>[s,s])].map(([val,label])=>(
                      <button key={val} onClick={()=>setPtShiftFilter(val)}
                        style={{background:ptShiftFilter===val?"#f59e0b":t.inp,color:ptShiftFilter===val?"#000":t.sub,borderRadius:99,padding:"5px 13px",fontSize:11,fontWeight:700,border:"none",cursor:"pointer",transition:"all 0.15s"}}>{label}</button>
                    ))}
                  </div>
                </div>
                {/* Product */}
                <div>
                  <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Product</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {[["all","All Products"],...products.map(p=>[p.name,p.name])].map(([val,label])=>(
                      <button key={val} onClick={()=>setPtProductFilter(val)}
                        style={{background:ptProductFilter===val?"#8b5cf6":t.inp,color:ptProductFilter===val?"#fff":t.sub,borderRadius:99,padding:"5px 13px",fontSize:11,fontWeight:700,border:"none",cursor:"pointer",transition:"all 0.15s"}}>{label}</button>
                    ))}
                  </div>
                </div>
                {/* Wastage type */}
                <div>
                  <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Wastage Type</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {[["all","All"],...(settings?.wastageTypes||["Burnt","Broken","Expired","Overproduced","Quality Reject","Other"]).map(wt=>[wt,wt])].map(([val,label])=>(
                      <button key={val} onClick={()=>setPtWasteTypeFilter(val)}
                        style={{background:ptWasteTypeFilter===val?"#f97316":t.inp,color:ptWasteTypeFilter===val?"#fff":t.sub,borderRadius:99,padding:"5px 13px",fontSize:11,fontWeight:700,border:"none",cursor:"pointer",transition:"all 0.15s"}}>{label}</button>
                    ))}
                  </div>
                </div>
                {/* QC Grade */}
                <div>
                  <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>QC Grade</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {[["all","All"],["A","A — Pass"],["B","B — Pass"],["C","C — Marginal"],["F","F — Fail"]].map(([val,label])=>(
                      <button key={val} onClick={()=>setPtQcGradeFilter(val)}
                        style={{background:ptQcGradeFilter===val?"#14b8a6":t.inp,color:ptQcGradeFilter===val?"#fff":t.sub,borderRadius:99,padding:"5px 13px",fontSize:11,fontWeight:700,border:"none",cursor:"pointer",transition:"all 0.15s"}}>{label}</button>
                    ))}
                  </div>
                </div>
                {/* Handover */}
                <div>
                  <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Handover</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {[["all","All Batches"],["with","Has Handover 🤝"],["without","No Handover"]].map(([val,label])=>(
                      <button key={val} onClick={()=>setPtHandoverFilter(val)}
                        style={{background:ptHandoverFilter===val?"#6366f1":t.inp,color:ptHandoverFilter===val?"#fff":t.sub,borderRadius:99,padding:"5px 13px",fontSize:11,fontWeight:700,border:"none",cursor:"pointer",transition:"all 0.15s"}}>{label}</button>
                    ))}
                  </div>
                </div>
                {/* Reset */}
                {(ptShiftFilter!=="all"||ptDateFilter!=="today"||ptProductFilter!=="all"||ptWasteTypeFilter!=="all"||ptQcGradeFilter!=="all"||ptHandoverFilter!=="all"||ptSearch)&&
                  <button onClick={()=>{setPtShiftFilter("all");setPtDateFilter("today");setPtProductFilter("all");setPtWasteTypeFilter("all");setPtQcGradeFilter("all");setPtHandoverFilter("all");setPtSearch("");}}
                    style={{background:"#ef444415",color:"#ef4444",border:"1px solid #ef444430",borderRadius:9,padding:"7px 0",fontSize:12,fontWeight:700,cursor:"pointer",width:"100%"}}>✕ Clear All Filters</button>}
              </div>}
            </div>

            {/* ── BATCHES ── */}
            {prodSubTab==="batches"&&<>
              <div className="flex items-center justify-between">
                <Pill dm={dm} c="purple">{filteredPT.length} runs · {filteredPT.reduce((s,x)=>s+(+x.actual||0),0)} units</Pill>
                <div className="flex gap-2">
                  <Btn dm={dm} v="outline" size="sm" onClick={()=>exportTabPDF("Production",filteredPT,[{label:"Date",key:"date"},{label:"Batch",key:"batchLabel"},{label:"Product",key:"product"},{label:"Shift",key:"shift"},{label:"Qty",key:"actual",num:true},{label:"QC",key:"qcGrade"},{label:"Linked Invoices",val:r=>(r.linkedInvoices||[]).join(", ")},{label:"Notes",key:"notes"}],settings)}>PDF</Btn>
                  <Btn dm={dm} v="outline" size="sm" onClick={()=>exportTabExcel("Production",filteredPT,[{label:"Date",key:"date"},{label:"Batch",key:"batchLabel"},{label:"Product",key:"product"},{label:"Shift",key:"shift"},{label:"Qty Produced",key:"actual",num:true},{label:"QC Grade",key:"qcGrade"},{label:"Linked Invoices",val:r=>(r.linkedInvoices||[]).join(", ")},{label:"Notes",key:"notes"}],settings)}>XLS</Btn>
                  <Btn dm={dm} v="outline" size="sm" onClick={()=>exportCSV(filteredPT,"production",[{label:"Date",key:"date"},{label:"Batch",key:"batchLabel"},{label:"Product",key:"product"},{label:"Shift",key:"shift"},{label:"Qty Produced",key:"actual"},{label:"QC Grade",key:"qcGrade"},{label:"Linked Invoices",val:r=>(r.linkedInvoices||[]).join("; ")},{label:"Notes",key:"notes"}])}>CSV</Btn>
                  <Btn dm={dm} size="sm" onClick={()=>{
                    const todayBatches=[...new Set(prodTargets.filter(x=>x.date===todayStr&&x.batchId).map(x=>x.batchId))];
                    const nextNum=todayBatches.length+1;
                    setPtF({date:todayStr,shift:"",product:products[0]?.name||"",actual:"",notes:"",batchId:uid(),batchLabel:`Batch ${nextNum}`,qcGrade:"A",qcNotes:"",embWastage:[],embQC:[],embHandover:[]});
                    setPtSh("add");
                  }}>+ New Batch</Btn>
                </div>
              </div>
              {uniqueDates.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-8">{prodTargets.length===0?"No batches yet. Tap + New Batch to start.":ptSearch?"No matches.":"No records for this period."}</p>}
              {uniqueDates.map(date=>{
                const dayRecs=filteredPT.filter(x=>x.date===date).sort((a,b)=>(a.batchLabel||"").localeCompare(b.batchLabel||""));
                const dayQty=dayRecs.reduce((s,x)=>s+(+x.actual||0),0);
                const dayLabel=date===todayStr?"Today":date===yesterdayStr?"Yesterday":date;
                const dayWaste=(wastage||[]).filter(w=>w.date===date);
                return <Card key={date} dm={dm}><div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p style={{color:t.text,fontWeight:800,fontSize:14}}>{dayLabel}</p>
                      <p style={{color:t.sub,fontSize:11}}>{dayRecs.length} batch{dayRecs.length!==1?"es":""} · {dayQty} units</p>
                    </div>
                    {dayWaste.length>0&&<span style={{background:"#f9731620",color:"#f97316",borderRadius:8,padding:"3px 10px",fontSize:10,fontWeight:700}}>⚠️ {dayWaste.length} wastage</span>}
                  </div>
                  {dayRecs.map((r,ri)=>{
                    const rWaste=(wastage||[]).filter(w=>w.batchId===r.batchId);
                    const rQC=(qcLogs||[]).filter(q=>q.batchId===r.batchId);
                    const rHV=(handovers||[]).filter(h=>h.batchId===r.batchId);
                    const recipeIngrs=(settings?.recipes||{})[products.find(p=>p.name===r.product)?.id||""]?.ingredients||[];
                    return <div key={r.id} style={{borderTop:ri>0?`1px solid ${t.border}`:"none",paddingTop:ri>0?12:0,marginTop:ri>0?12:0}}>
                      <div className="flex items-start justify-between gap-2">
                        <div style={{flex:1}}>
                          {/* Batch number + identity header */}
                          <div style={{background:dm?"rgba(139,92,246,0.15)":"rgba(139,92,246,0.08)",border:`1px solid rgba(139,92,246,0.3)`,borderRadius:10,padding:"6px 10px",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span style={{background:"#8b5cf6",color:"#fff",borderRadius:6,padding:"3px 10px",fontSize:12,fontWeight:900,letterSpacing:"0.01em"}}>{r.batchLabel||"Batch"}</span>
                              <span style={{color:"#8b5cf6",fontWeight:700,fontSize:12}}>{r.product}</span>
                              {(r.linkedInvoices||[]).length>0&&(r.linkedInvoices||[]).map(inv=>(
                                <span key={inv} style={{background:dm?"rgba(139,92,246,0.2)":"rgba(139,92,246,0.1)",color:"#7c3aed",borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:700,fontFamily:"monospace"}}>📄 {inv}</span>
                              ))}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                              {r.shift&&<span style={{background:"#f59e0b20",color:"#f59e0b",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>🕐 {r.shift}</span>}
                              {r.qcGrade&&<span style={{background:gradeColor(r.qcGrade)+"20",color:gradeColor(r.qcGrade),borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>QC:{r.qcGrade}</span>}
                              {rWaste.length>0&&<span style={{background:"#f9731618",color:"#f97316",borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:700}}>🗑️ {rWaste.length}</span>}
                              {rQC.length>0&&<span style={{background:"#14b8a618",color:"#14b8a6",borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:700}}>✅ {rQC.length}</span>}
                              {rHV.length>0&&<span style={{background:"#6366f118",color:"#6366f1",borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:700}}>📋 {rHV.length}</span>}
                            </div>
                          </div>
                          <p style={{color:"#8b5cf6",fontWeight:900,fontSize:22,lineHeight:1,marginBottom:4}}>{r.actual||0}<span style={{color:t.sub,fontSize:12,fontWeight:400}}> units</span></p>
                          {r.notes&&<p style={{color:t.sub,fontSize:11,fontStyle:"italic"}}>"{r.notes}"</p>}
                          {r.deduction&&<div style={{background:"#10b98110",border:"1px solid #10b98130",borderRadius:8,padding:"4px 8px",marginTop:4,display:"inline-flex",alignItems:"center",gap:6}}>
                            <span style={{fontSize:10}}>📦</span>
                            <span style={{color:"#10b981",fontSize:10,fontWeight:700}}>Auto-deducted {r.deduction.deducted} from "{r.deduction.supplyItem}"</span>
                          </div>}
                          {recipeIngrs.length>0&&+r.actual>0&&<div style={{background:t.inp,borderRadius:8,padding:"6px 10px",marginTop:6}}>
                            <p style={{color:t.sub,fontSize:10,fontWeight:700,marginBottom:3}}>🧪 Recipe used ({r.actual} units):</p>
                            {recipeIngrs.map((ing,ii)=><p key={ii} style={{color:t.text,fontSize:11}}>• {(+ing.qtyPerUnit*(+r.actual)).toFixed(2)} {ing.unit} {ing.supply}</p>)}
                          </div>}
                          {rWaste.length>0&&<div className="flex flex-wrap gap-1.5 mt-2">
                            {rWaste.map(w=><span key={w.id} style={{background:"#f9731618",color:"#f97316",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>🗑️ {w.qty} {w.unit} {w.product} — {w.type}</span>)}
                          </div>}
                          {rQC.length>0&&<div className="flex flex-wrap gap-1.5 mt-1">
                            {rQC.map(q=><span key={q.id} style={{background:gradeColor(q.grade)+"18",color:gradeColor(q.grade),borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>✅ QC {q.grade} — {q.product}{q.checker?" by "+q.checker:""}</span>)}
                          </div>}
                          {rHV.length>0&&<div className="flex flex-wrap gap-1.5 mt-1">
                            {rHV.map(h=><span key={h.id} style={{background:"#6366f118",color:"#6366f1",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>📋 {h.shift||"Handover"}{h.nextShift?" → "+h.nextShift:""}</span>)}
                          </div>}
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={()=>{
                            const existingWaste=(wastage||[]).filter(w=>w.batchId===r.batchId);
                            const existingQC=(qcLogs||[]).filter(q=>q.batchId===r.batchId);
                            const existingHV=(handovers||[]).filter(h=>h.batchId===r.batchId);
                            setPtF({...r,actual:String(r.actual),embWastage:existingWaste.map(w=>({...w})),embQC:existingQC.map(q=>({...q})),embHandover:existingHV.map(h=>({...h}))});
                            setPtSh(r);
                          }} style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,minHeight:40,padding:"0 12px",borderRadius:10,fontSize:12,fontWeight:600,cursor:"pointer"}}>Edit</button>
                          {can("prod_delete")&&<button onClick={()=>delPT(r)} style={{background:"#dc2626",color:"#fff",minHeight:40,padding:"0 12px",borderRadius:10,fontSize:12,fontWeight:700,cursor:"pointer",border:"none"}}>Del</button>}
                        </div>
                      </div>
                    </div>;
                  })}
                  {/* Customer paper trail for this date — full detail */}
                  {(()=>{
                    const dayDelivs=deliveries.filter(d=>d.date===date&&d.status==="Delivered");
                    if(dayDelivs.length===0)return null;
                    const totalUnits=dayRecs.reduce((s,x)=>s+(+x.actual||0),0);
                    const exportTrailPDF=()=>{
                      const co=settings?.companyName||"TAS Healthy World";
                      const cosub=settings?.companySubtitle||"Malabar Paratha Factory · Goa, India";
                      const now=new Date().toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
                      const dateLabel=new Date(date+"T00:00:00").toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
                      const totalOrderVal=dayDelivs.reduce((s,d)=>s+lineTotal(d.orderLines),0);
                      const totalReplAmt=dayDelivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
                      const totalNet=totalOrderVal-totalReplAmt;
                      const totalCollected=dayDelivs.reduce((s,d)=>s+(d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0),0);
                      const totalBalance=Math.max(0,totalNet-totalCollected);
                      const batchRows=dayRecs.map(r=>{
                        const recipeIngrs=(settings?.recipes||{})[products.find(p=>p.name===r.product)?.id||""]?.ingredients||[];
                        const ingredientStr=recipeIngrs.length>0&&+r.actual>0?recipeIngrs.map(ing=>`${(+ing.qtyPerUnit*(+r.actual)).toFixed(2)} ${ing.unit} ${ing.supply}`).join(", "):"—";
                        return `<tr><td><b>${r.batchLabel||"Batch"}</b></td><td>${r.product}</td><td>${r.shift||"—"}</td><td style="text-align:right;font-weight:700;color:#7c3aed">${r.actual||0}</td><td style="background:${r.qcGrade==="A"?"#f0fdf4":r.qcGrade==="B"?"#fefce8":r.qcGrade==="F"?"#fef2f2":"#fff7ed"};color:${r.qcGrade==="A"?"#15803d":r.qcGrade==="B"?"#92400e":r.qcGrade==="F"?"#b91c1c":"#9a3412"};font-weight:700;text-align:center">${r.qcGrade||"—"}</td><td style="font-size:10px;color:#64748b">${ingredientStr}</td><td style="font-size:11px;color:#64748b">${r.qcNotes||r.notes||"—"}</td></tr>`;
                      }).join("");
                      const delivRows=dayDelivs.map((d,i)=>{
                        const items=Object.entries(safeO(d.orderLines)).filter(([,l])=>l.qty>0).map(([pid,l])=>{const p=products.find(x=>x.id===pid);return`${l.qty}× ${p?p.name:(l.name||pid)}`;}).join(", ");
                        const tot=lineTotal(d.orderLines);const repl=+d.replacement?.amount||0;const net=tot-repl;const collected=d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0;const bal=Math.max(0,net-collected);
                        const sc=d.status==="Delivered"?"#059669":d.status==="In Transit"?"#2563eb":d.status==="Cancelled"?"#dc2626":"#d97706";
                        const dInvNo=d.invNo||`INV-${(d.date||"").replace(/-/g,"")}-${(d.id||"").slice(-4).toUpperCase()}`;
                        const dRcptNo=`RCP-${dInvNo.replace(/^[A-Z]+-/,"")}`;
                        return `<tr style="background:${i%2===0?"#fff":"#f8fafc"}">
                          <td style="font-family:monospace;font-size:10px;color:#7c3aed;font-weight:700;white-space:nowrap">${dInvNo}</td>
                          <td style="font-family:monospace;font-size:10px;color:#0ea5e9;font-weight:700;white-space:nowrap">${dRcptNo}</td>
                          <td><b>${d.customer}</b>${d.address?`<br><span style="font-size:10px;color:#94a3b8">📍 ${d.address}</span>`:""}${d.agent?`<br><span style="font-size:10px;color:#94a3b8">👤 ${d.agent}</span>`:""}</td>
                          <td style="font-size:11px;color:#475569">${items||"—"}</td>
                          <td style="text-align:right;font-weight:700">₹${tot.toLocaleString("en-IN")}</td>
                          <td>${d.replacement?.done?`<span style="color:#f97316;font-weight:700;font-size:11px">🔄 ${d.replacement.item||"—"}${d.replacement.qty?" ("+d.replacement.qty+")":""}</span>${d.replacement.reason?`<br><span style="font-size:10px;color:#94a3b8">${d.replacement.reason}</span>`:""}${repl>0?`<br><span style="color:#f97316;font-size:11px">−₹${repl.toLocaleString("en-IN")}</span>`:""}`:`<span style="color:#94a3b8">—</span>`}</td>
                          <td style="text-align:right;font-weight:700">₹${net.toLocaleString("en-IN")}</td>
                          <td style="text-align:right;color:#059669;font-weight:700">${collected>0?"₹"+collected.toLocaleString("en-IN"):"—"}</td>
                          <td style="text-align:right;font-weight:800;color:${bal===0?"#059669":"#d97706"}">${bal===0?"✓ Paid":"₹"+bal.toLocaleString("en-IN")}</td>
                          <td><span style="background:${sc}18;color:${sc};padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700">${d.status}</span></td>
                        </tr>`;
                      }).join("");
                      const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Batch Paper Trail — ${dateLabel}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;color:#1c1917;padding:32px;max-width:900px;margin:0 auto}
.cover{background:linear-gradient(135deg,#0f1923 0%,#1e3a5f 100%);color:#fff;padding:28px 32px;border-radius:12px;margin-bottom:24px}
.co-name{font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;opacity:0.6;margin-bottom:8px}
.title{font-size:28px;font-weight:900;letter-spacing:-0.02em;line-height:1.1}
.meta{font-size:11px;opacity:0.5;margin-top:8px}
.section-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin:24px 0 8px;padding-bottom:6px;border-bottom:2px solid #e2e8f0}
.stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:4px}
.stat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px}
.stat-val{font-size:20px;font-weight:900;color:#0f172a;line-height:1}
.stat-lbl{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;color:#94a3b8;margin-top:4px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:4px}
thead tr{background:#f1f5f9}
th{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#64748b;padding:8px 10px;text-align:left;border-bottom:2px solid #e2e8f0}
td{padding:8px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}
.footer{margin-top:32px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}
.print-bar{position:fixed;top:0;left:0;right:0;background:#0f1923;color:#fff;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;z-index:9999;font-family:Arial,sans-serif;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.4);gap:12px}
.print-bar a{background:#3b82f6;color:#fff;padding:7px 16px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;white-space:nowrap}
@media print{@page{size:A4 landscape;margin:1cm}.print-bar{display:none!important}body{padding:0}}
</style></head><body>
<div class="cover">
  <div class="co-name">🫓 ${co} · Production</div>
  <div class="title">Batch Paper Trail</div>
  <div class="title" style="font-size:18px;opacity:0.8;margin-top:4px">${dateLabel}</div>
  <div class="meta">Exported on ${now} · ${dayRecs.length} batch${dayRecs.length!==1?"es":""} · ${totalUnits} units produced · ${dayDelivs.length} customers served</div>
</div>

<div class="section-title">📊 Day Summary</div>
<div class="stats">
  <div class="stat"><div class="stat-val" style="color:#7c3aed">${totalUnits}</div><div class="stat-lbl">Units Produced</div></div>
  <div class="stat"><div class="stat-val">${dayRecs.length}</div><div class="stat-lbl">Batches</div></div>
  <div class="stat"><div class="stat-val">${dayDelivs.length}</div><div class="stat-lbl">Customers Served</div></div>
  <div class="stat"><div class="stat-val" style="color:#059669">₹${totalOrderVal.toLocaleString("en-IN")}</div><div class="stat-lbl">Order Value</div></div>
  ${totalReplAmt>0?`<div class="stat"><div class="stat-val" style="color:#f97316">−₹${totalReplAmt.toLocaleString("en-IN")}</div><div class="stat-lbl">Replacements</div></div>`:""}
  <div class="stat"><div class="stat-val" style="color:#0f172a">₹${totalNet.toLocaleString("en-IN")}</div><div class="stat-lbl">Net Billed</div></div>
  ${totalCollected>0?`<div class="stat"><div class="stat-val" style="color:#059669">₹${totalCollected.toLocaleString("en-IN")}</div><div class="stat-lbl">Collected</div></div>`:""}
  <div class="stat"><div class="stat-val" style="color:${totalBalance===0?"#059669":"#d97706"}">${totalBalance===0?"✓ All Paid":"₹"+totalBalance.toLocaleString("en-IN")}</div><div class="stat-lbl">Balance Due</div></div>
</div>

<div class="section-title">🏭 Batches Produced</div>
<table>
  <thead><tr><th>Batch</th><th>Product</th><th>Shift</th><th style="text-align:right">Qty</th><th style="text-align:center">QC</th><th>Ingredients Used</th><th>Notes</th></tr></thead>
  <tbody>${batchRows}</tbody>
</table>

<div class="section-title" style="margin-top:28px">📦 Customer Delivery Breakdown</div>
<table>
  <thead><tr><th>Invoice No</th><th>Receipt No</th><th>Customer</th><th>Items</th><th style="text-align:right">Order Total</th><th>Replacement</th><th style="text-align:right">Net Payable</th><th style="text-align:right">Collected</th><th style="text-align:right">Balance Due</th><th>Status</th></tr></thead>
  <tbody>${delivRows}</tbody>
  <tr style="background:#f1f5f9;font-weight:800;font-size:13px">
    <td colspan="4">TOTAL (${dayDelivs.length} customers)</td>
    <td style="text-align:right">₹${totalOrderVal.toLocaleString("en-IN")}</td>
    <td style="color:#f97316">${totalReplAmt>0?"−₹"+totalReplAmt.toLocaleString("en-IN"):"—"}</td>
    <td style="text-align:right">₹${totalNet.toLocaleString("en-IN")}</td>
    <td style="text-align:right;color:#059669">${totalCollected>0?"₹"+totalCollected.toLocaleString("en-IN"):"—"}</td>
    <td style="text-align:right;color:${totalBalance===0?"#059669":"#d97706"}">${totalBalance===0?"✓ All Paid":"₹"+totalBalance.toLocaleString("en-IN")}</td>
    <td></td>
  </tr>
</table>

<div class="footer">${co} · ${cosub} · Batch Paper Trail for ${dateLabel} · Exported ${now}</div>
<div class="print-bar"><span>📋 Batch Paper Trail — ${dateLabel}</span><a href="#" onclick="window.print();return false;">🖨 Print / Save PDF</a></div>
<script>window.addEventListener("load",function(){window.print();});</script>
</body></html>`;
                      const blob=new Blob([html],{type:"text/html;charset=utf-8"});
                      const url=URL.createObjectURL(blob);
                      const a=document.createElement("a");a.href=url;a.target="_blank";a.rel="noopener";
                      document.body.appendChild(a);a.click();
                      setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},1000);
                    };
                    const batchLabels=dayRecs.map(r=>r.batchLabel||"Batch").join(", ");
                    const totalDayOrderVal=dayDelivs.reduce((s,d2)=>s+lineTotal(d2.orderLines),0);
                    const totalDayRepl=dayDelivs.reduce((s,d2)=>s+(+d2.replacement?.amount||0),0);
                    const totalDayCollected=dayDelivs.reduce((s,d2)=>s+(d2.partialPayment?.enabled?(+d2.partialPayment?.amount||0):0),0);
                    const totalDayBalance=Math.max(0,totalDayOrderVal-totalDayRepl-totalDayCollected);
                    return <div style={{background:t.inp,borderRadius:12,padding:"12px 14px",marginTop:12,border:`1px solid ${t.border}`}}>
                      {/* Header + summary */}
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,gap:8,flexWrap:"wrap"}}>
                        <div>
                          <p style={{color:t.text,fontSize:12,fontWeight:800}}>📦 {dayDelivs.length} Customer{dayDelivs.length!==1?"s":""} Served</p>
                          <p style={{color:t.sub,fontSize:10}}>Batch{dayRecs.length!==1?"es":""}: {batchLabels}</p>
                        </div>
                        <button onClick={exportTrailPDF} style={{background:"#7c3aed",color:"#fff",border:"none",borderRadius:8,padding:"5px 13px",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0,WebkitTapHighlightColor:"transparent"}}>📄 PDF Trail</button>
                      </div>
                      {canSeePrices&&<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:10}}>
                        {[
                          {l:"Billed",v:inr(totalDayOrderVal),c:"#f59e0b"},
                          {l:"Replaced",v:totalDayRepl>0?`−${inr(totalDayRepl)}`:"None",c:totalDayRepl>0?"#f97316":t.sub},
                          {l:"Collected",v:inr(totalDayCollected),c:"#10b981"},
                          {l:"Balance",v:inr(totalDayBalance),c:totalDayBalance>0?"#ef4444":"#10b981"},
                        ].map(x=><div key={x.l} style={{background:t.card,borderRadius:8,padding:"6px 8px",textAlign:"center"}}>
                          <p style={{color:x.c,fontWeight:800,fontSize:11}}>{x.v}</p>
                          <p style={{color:t.sub,fontSize:9,marginTop:1,textTransform:"uppercase"}}>{x.l}</p>
                        </div>)}
                      </div>}
                      {/* Per-customer delivery cards */}
                      <div className="flex flex-col gap-2">
                        {dayDelivs.map((d,di)=>{
                          const dRows=lineRows(d.orderLines,products);
                          const dTot=lineTotal(d.orderLines);
                          const dRepl=+d.replacement?.amount||0;
                          const dNet=Math.max(0,dTot-dRepl);
                          const dCollected=d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0;
                          const dBalance=Math.max(0,dNet-dCollected);
                          const dInvNo=(invRegistry?.issued||{})[d.id]||null;
                          const dRcptNo=dInvNo?`RCP-${dInvNo.replace("TAS-","")}`:`RCP-${(d.id||"").slice(-6).toUpperCase()}`;
                          return <div key={d.id} style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:10,padding:"10px 12px",borderLeft:"3px solid #7c3aed"}}>
                            {/* Customer name + invoice/receipt */}
                            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:6,marginBottom:6}}>
                              <div>
                                <p style={{color:t.text,fontWeight:800,fontSize:13}}>{d.customer}</p>
                                <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:3}}>
                                  {dInvNo&&<span style={{background:dm?"rgba(139,92,246,0.15)":"rgba(139,92,246,0.08)",color:"#8b5cf6",borderRadius:5,padding:"1px 7px",fontSize:9,fontWeight:700,fontFamily:"monospace"}}>📄 {dInvNo}</span>}
                                  {dInvNo&&<span style={{background:dm?"rgba(14,165,233,0.15)":"rgba(14,165,233,0.08)",color:"#0ea5e9",borderRadius:5,padding:"1px 7px",fontSize:9,fontWeight:700,fontFamily:"monospace"}}>🧾 {dRcptNo}</span>}
                                  <span style={{background:dm?"rgba(124,58,237,0.12)":"rgba(124,58,237,0.06)",color:"#7c3aed",borderRadius:5,padding:"1px 7px",fontSize:9,fontWeight:700}}>🏭 {batchLabels}</span>
                                </div>
                              </div>
                              {canSeePrices&&<div style={{textAlign:"right",flexShrink:0}}>
                                <p style={{color:"#f59e0b",fontWeight:800,fontSize:12}}>{inr(dTot)}</p>
                                {dBalance>0&&<p style={{color:"#ef4444",fontSize:10,fontWeight:700}}>Due: {inr(dBalance)}</p>}
                                {dBalance===0&&dTot>0&&<p style={{color:"#10b981",fontSize:10,fontWeight:700}}>✓ Clear</p>}
                              </div>}
                            </div>
                            {/* Items */}
                            <div style={{marginBottom:6}}>
                              {dRows.map(r=><div key={r.id} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"1px 0"}}>
                                <span style={{color:t.sub}}>{r.qty} × {r.name}{canSeePrices?<span> @ {inr(r.priceAmount)}</span>:""}</span>
                                {canSeePrices&&<span style={{color:t.text,fontWeight:600}}>{inr(r.qty*r.priceAmount)}</span>}
                              </div>)}
                            </div>
                            {/* Replacement */}
                            {d.replacement?.done&&<div style={{background:"#f9731612",border:"1px solid #f9731630",borderRadius:7,padding:"5px 8px",marginBottom:6}}>
                              <p style={{color:"#f97316",fontSize:10,fontWeight:700}}>🔄 {d.replacement.item||"Replacement"}{d.replacement.qty?` ×${d.replacement.qty}`:""}{canSeePrices&&dRepl>0?` · −${inr(dRepl)}`:""}</p>
                              {d.replacement.reason&&<p style={{color:t.sub,fontSize:10}}>{d.replacement.reason}</p>}
                            </div>}
                            {/* Payment summary */}
                            {canSeePrices&&dTot>0&&<div style={{display:"flex",flexWrap:"wrap",gap:6,fontSize:10}}>
                              {dRepl>0&&<span style={{color:t.sub}}>Net: <b style={{color:t.text}}>{inr(dNet)}</b></span>}
                              {dCollected>0&&<span style={{color:"#10b981"}}>Collected: <b>{inr(dCollected)}</b></span>}
                              <span style={{color:dBalance>0?"#ef4444":"#10b981",fontWeight:700}}>{dBalance>0?`Balance: ${inr(dBalance)}`:"✓ Settled"}</span>
                            </div>}
                          </div>;
                        })}
                      </div>
                    </div>;
                  })()}
                </div></Card>;
              })}
            </>}

            {/* ── WASTAGE ── */}
            {prodSubTab==="wastage"&&<>
              <div className="flex items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                  <Pill dm={dm} c="orange">{filteredWaste.length} records</Pill>
                  <Pill dm={dm} c="red">{inr(filteredWaste.reduce((s,w)=>s+(w.cost||0),0))} cost</Pill>
                </div>
                <div className="flex gap-2">
                  <Btn dm={dm} v="outline" size="sm" onClick={()=>exportTabPDF("Wastage",filteredWaste,[{label:"Date",key:"date"},{label:"Product",key:"product"},{label:"Type",key:"type"},{label:"Qty",key:"qty",num:true},{label:"Unit",key:"unit"},{label:"Cost",key:"cost",num:true},{label:"Reason",key:"reason"},{label:"Shift",key:"shift"}],settings)}>PDF</Btn>
                  <Btn dm={dm} size="sm" onClick={()=>{setWSh("add");setWF(blkW());}}>+ Log Wastage</Btn>
                </div>
              </div>
              {filteredWaste.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-8">No wastage records for this period.</p>}
              {filteredWaste.map(w=>(
                <Card key={w.id} dm={dm}><div className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span style={{background:"#f9731620",color:"#f97316",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{w.type}</span>
                        <p style={{color:t.text,fontWeight:700,fontSize:13}}>{w.product}</p>
                        {w.shift&&<span style={{background:"#f59e0b20",color:"#f59e0b",borderRadius:6,padding:"2px 8px",fontSize:10}}>{w.shift}</span>}
                      </div>
                      <p style={{color:t.sub,fontSize:12}}>📅 {w.date} · {w.qty} {w.unit} · by {w.loggedBy}</p>
                      {w.reason&&<p style={{color:t.sub,fontSize:11,marginTop:3,fontStyle:"italic"}}>"{w.reason}"</p>}
                      {w.cost>0&&<p style={{color:"#ef4444",fontSize:12,fontWeight:700,marginTop:4}}>Cost: {inr(w.cost)}</p>}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {can("waste_edit")&&<button onClick={()=>{setWSh(w);setWF({...w});}} style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,minHeight:36,padding:"0 10px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer"}}>Edit</button>}
                      {can("waste_delete")&&<button onClick={()=>delW(w)} style={{background:"#dc2626",color:"#fff",minHeight:36,padding:"0 10px",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer",border:"none"}}>Del</button>}
                    </div>
                  </div>
                </div></Card>
              ))}
            </>}

            {/* ── QC ── */}
            {prodSubTab==="qc"&&<>
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Pill dm={dm} c="teal">{filteredQC.length} checks</Pill>
                  <Pill dm={dm} c={filteredQC.filter(q=>q.grade==="F").length>0?"red":"green"}>{Math.round(filteredQC.filter(q=>q.grade!=="F").length/Math.max(filteredQC.length,1)*100)}% pass</Pill>
                </div>
                <div className="flex gap-2">
                  <Btn dm={dm} v="outline" size="sm" onClick={()=>exportTabPDF("QC Logs",filteredQC,[{label:"Date",key:"date"},{label:"Product",key:"product"},{label:"Shift",key:"shift"},{label:"Grade",key:"grade"},{label:"Checker",key:"checker"},{label:"Notes",key:"notes"}],settings)}>PDF</Btn>
                  <Btn dm={dm} size="sm" onClick={()=>{setQcF({product:"",shift:"",date:today(),grade:"A",notes:"",checker:displayName});setQcSh("add");}}>+ QC Check</Btn>
                </div>
              </div>
              {filteredQC.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-8">No QC records for this period.</p>}
              {filteredQC.map(q=>(
                <Card key={q.id} dm={dm}><div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div style={{background:gradeColor(q.grade)+"20",color:gradeColor(q.grade),width:40,height:40,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:18,flexShrink:0}}>{q.grade}</div>
                      <div>
                        <p style={{color:t.text}} className="font-bold text-sm">{q.product}</p>
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                          <span style={{color:t.sub}} className="text-xs">📅 {q.date}</span>
                          {q.shift&&<span style={{color:t.sub}} className="text-xs">🕐 {q.shift}</span>}
                          {q.checker&&<span style={{color:t.sub}} className="text-xs">👤 {q.checker}</span>}
                        </div>
                        {q.notes&&<p style={{color:t.sub,background:t.inp,borderRadius:8,padding:"6px 10px",marginTop:8}} className="text-xs">"{q.notes}"</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span style={{background:gradeColor(q.grade)+"20",color:gradeColor(q.grade),borderRadius:8,padding:"2px 8px",fontSize:10,fontWeight:700}}>{GRADES.find(x=>x.g===q.grade)?.label||q.grade}</span>
                      {can("qc_delete")&&<button onClick={()=>delQC(q)} className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-red-600 text-white">Del</button>}
                    </div>
                  </div>
                </div></Card>
              ))}
            </>}

            {/* ── HANDOVERS ── */}
            {prodSubTab==="handover"&&(()=>{
              function saveHandover(){
                if(!hvF.note.trim()){notify("Note is required");return;}
                const rec={...hvF,id:uid(),createdAt:ts()};
                setHandovers(p=>[rec,...p.slice(0,99)]);
                addLog("Shift handover logged",`${rec.shift||"—"} → ${rec.nextShift||"next"}`);
                captureGPS("handover_logged",`shift`);
                addNotif("Shift Handover",`Handover by ${rec.loggedBy}`,"info","newentry");
                notify("Handover note saved ✓");
                setHvSh(false);
              }
              const fHV=(handovers||[]).filter(h=>!ptSearch||(h.note.toLowerCase().includes(ptSearch.toLowerCase())||h.shift?.toLowerCase().includes(ptSearch.toLowerCase())||h.loggedBy?.toLowerCase().includes(ptSearch.toLowerCase())));
              return <>
                <div className="flex items-center justify-between">
                  <Pill dm={dm} c="amber">{fHV.length} notes</Pill>
                  <Btn dm={dm} size="sm" onClick={()=>{setHvF({shift:"",date:today(),note:"",nextShift:"",issues:"",loggedBy:displayName});setHvSh(true);}}>+ Handover</Btn>
                </div>
                {fHV.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-8">No handover notes yet.</p>}
                {fHV.slice(0,20).map(h=>(
                  <Card key={h.id} dm={dm}><div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          {h.shift&&<span style={{background:"#f59e0b20",color:"#f59e0b",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{h.shift}</span>}
                          {h.nextShift&&<><span style={{color:t.sub,fontSize:10}}>→</span><span style={{background:t.inp,color:t.sub,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:600}}>{h.nextShift}</span></>}
                        </div>
                        <p style={{color:t.sub}} className="text-xs">📅 {h.date} · by {h.loggedBy}</p>
                      </div>
                      {can("prod_handover")&&<button onClick={()=>setHandovers(p=>p.filter(x=>x.id!==h.id))} style={{background:t.inp,color:t.sub}} className="text-xs px-2.5 py-1.5 rounded-lg font-semibold">Delete</button>}
                    </div>
                    <div style={{background:t.inp,border:`1px solid ${t.inpB}`,borderRadius:12,padding:"10px 14px",color:t.text}} className="text-sm">{h.note}</div>
                    {h.issues&&<div style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:10,padding:"8px 12px",marginTop:8}}>
                      <p style={{color:"#ef4444",fontSize:11,fontWeight:600}}>⚠️ Issues: {h.issues}</p>
                    </div>}
                  </div></Card>
                ))}
                <Sheet dm={dm} open={hvSh} onClose={()=>setHvSh(false)} title="Log Shift Handover">
                  <div className="grid grid-cols-2 gap-3">
                    <Sel dm={dm} label="Current Shift (optional)" value={hvF.shift||""} onChange={e=>setHvF({...hvF,shift:e.target.value})}>
                      <option value="">— None —</option>
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
              </>;
            })()}
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
              <div><h1>📍 GPS Location Report</h1><h2>${settings?.appName||"TAS Healthy World"} · ${settings?.companySubtitle||""} · Exported on ${ts()}</h2></div>
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select value={gpsFilter} onChange={e=>setGpsFilter(e.target.value)}
                  style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:12,padding:"10px 14px",fontSize:14,outline:"none",minHeight:48,WebkitAppearance:"none",appearance:"none"}}>
                  <option value="all">All agents</option>
                  {agentUsers.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <select value={gpsActionFilter} onChange={e=>setGpsActionFilter(e.target.value)}
                  style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:12,padding:"10px 14px",fontSize:14,outline:"none",minHeight:48,WebkitAppearance:"none",appearance:"none"}}>
                  <option value="all">All actions</option>
                  {Object.entries(ACTION_META).map(([k,m])=><option key={k} value={k}>{m.icon} {m.label}</option>)}
                </select>
                <select value={gpsDateFilter} onChange={e=>setGpsDateFilter(e.target.value)}
                  style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:12,padding:"10px 14px",fontSize:14,outline:"none",minHeight:48,WebkitAppearance:"none",appearance:"none"}}>
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">Last 7 days</option>
                  <option value="month">This month</option>
                </select>
              </div>
              {/* stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  {label:"Showing",val:logsWithGps.length+" pins",color:t.text},
                  {label:"Delivered",val:logsWithGps.filter(l=>l.action==="marked_delivered").length,color:"#10b981"},
                  {label:"In Transit",val:logsWithGps.filter(l=>l.action==="marked_transit").length,color:"#0ea5e9"},
                  {label:"Sessions",val:logsWithGps.filter(l=>l.action==="session_start").length,color:"#6366f1"},
                ].map(s=>(
                  <div key={s.label} style={{background:t.inp,border:`1px solid ${t.border}`,borderRadius:12,padding:"10px 14px",textAlign:"center"}}>
                    <p style={{color:s.color}} className="text-base font-black">{s.val}</p>
                    <p style={{color:t.sub}} className="text-[10px] font-semibold mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              {/* map + legend */}
              <Card dm={dm}><div className="p-3 sm:p-4">
                <div className="flex items-center justify-between mb-3 gap-2">
                  <p style={{color:t.text}} className="font-bold text-sm">🗺 GPS Trail Map</p>
                  <div className="flex gap-2 overflow-x-auto" style={{scrollbarWidth:"none"}}>
                    {Object.entries(ACTION_META).filter(([k])=>logsWithGps.some(l=>l.action===k)).map(([k,m])=>(
                      <span key={k} className="flex items-center gap-1 shrink-0" style={{fontSize:10,color:t.sub,fontWeight:600}}>
                        <span style={{width:8,height:8,borderRadius:"50%",background:m.color,display:"inline-block"}}/>
                        {m.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{borderRadius:12,overflow:"hidden",height:"min(420px,60vw)",minHeight:260}}>
                  <GPSMap dm={dm} logs={logsWithGps} actionMeta={ACTION_META} fallbackLat={settings?.weatherLat||15.4909} fallbackLng={settings?.weatherLng||73.8278}/>
                </div>
                {logsWithGps.length===0&&<p style={{color:t.sub,textAlign:"center",paddingTop:12,fontSize:12}}>No GPS data matches current filters</p>}
              </div></Card>
            </>}

            {/* ══ AUDIT LOG ══ */}
            {gpsSection==="timeline"&&isAdmin&&<>
              {/* filters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select value={gpsFilter} onChange={e=>setGpsFilter(e.target.value)}
                  style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:12,padding:"10px 14px",fontSize:14,outline:"none",minHeight:48,WebkitAppearance:"none",appearance:"none"}}>
                  <option value="all">All agents</option>
                  {agentUsers.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <select value={gpsActionFilter} onChange={e=>setGpsActionFilter(e.target.value)}
                  style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:12,padding:"10px 14px",fontSize:14,outline:"none",minHeight:48,WebkitAppearance:"none",appearance:"none"}}>
                  <option value="all">All actions</option>
                  {Object.entries(ACTION_META).map(([k,m])=><option key={k} value={k}>{m.icon} {m.label}</option>)}
                </select>
                <select value={gpsDateFilter} onChange={e=>setGpsDateFilter(e.target.value)}
                  style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:12,padding:"10px 14px",fontSize:14,outline:"none",minHeight:48,WebkitAppearance:"none",appearance:"none"}}>
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
                    <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
                      <a href={mapU("",l.lat,l.lng)} target="_blank" rel="noopener noreferrer"
                        style={{background:"#0ea5e915",color:"#0ea5e9",borderRadius:10,padding:"8px 12px",fontSize:12,fontWeight:700,textDecoration:"none",minHeight:36,display:"flex",alignItems:"center"}}>Maps ↗</a>
                      <button onClick={()=>ask("Delete this entry?",()=>{setGpsLogs(p=>p.filter(x=>x.id!==l.id));notify("Deleted");})}
                        style={{background:"none",border:"none",color:t.sub,fontSize:11,cursor:"pointer",padding:"4px 6px",minHeight:28,WebkitTapHighlightColor:"transparent"}}>✕ remove</button>
                    </div>
                  </div></Card>;
                })
              }
            </>}

            {/* ══ DAILY REPORT ══ */}
            {gpsSection==="report"&&isAdmin&&<>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select value={gpsFilter} onChange={e=>setGpsFilter(e.target.value)}
                  style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:12,padding:"10px 14px",fontSize:14,outline:"none",minHeight:48,WebkitAppearance:"none",appearance:"none"}}>
                  <option value="all">All agents</option>
                  {agentUsers.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <select value={gpsDateFilter} onChange={e=>setGpsDateFilter(e.target.value)}
                  style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,borderRadius:12,padding:"10px 14px",fontSize:14,outline:"none",minHeight:48,WebkitAppearance:"none",appearance:"none"}}>
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">Last 7 days</option>
                  <option value="month">This month</option>
                </select>
                {logsWithGps.length>0&&<button onClick={printReport}
                  style={{background:"#6366f1",color:"#fff",border:"none",borderRadius:12,padding:"10px 16px",fontSize:14,fontWeight:700,cursor:"pointer",minHeight:48,WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>🖨 Print / PDF</button>}
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
            {id:"toggles",icon:"⚡",label:"Features"},
            {id:"invoice",icon:"🧾",label:"Invoice"},
            {id:"account",icon:"👤",label:"Account"},
            {id:"staff",icon:"👥",label:"Staff"},
            {id:"products",icon:"📦",label:"Products"},
            {id:"recipes",icon:"🧪",label:"Recipes"},
            {id:"access",icon:"🔒",label:"Permissions"},
            {id:"app",icon:"🎨",label:"Branding"},
            {id:"alerts",icon:"🔔",label:"Alerts"},
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

          {/* ── FEATURE TOGGLES ── */}
          {settingsSection==="toggles"&&<>
            {/* Orders & Delivery */}
            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text,fontWeight:700,fontSize:14,marginBottom:2}}>📦 Orders & Delivery</p>
              <p style={{color:t.sub,fontSize:11,marginBottom:12}}>Core features for the delivery workflow</p>
              {[
                {key:"bulkOrderEnabled",label:"Bulk Order Entry",desc:"Create orders for multiple customers at once",icon:"📋",defOn:true},
                {key:"featureSmartDeduction",label:"Smart Auto-Deduct",desc:"Auto-reduce supply stock when production is logged",icon:"🤖",defOn:true},
                {key:"featureShiftManagement",label:"Shift Management",desc:"Enable shift-based scheduling and handovers",icon:"🔄",defOn:true},
                {key:"featureOrderDateOverride",label:"Order Date Override",desc:"Allow agents to backdate or forward-date orders",icon:"📅",defOn:false},
                {key:"featureRouteOpt",label:"Route Optimization",desc:"Auto-suggest delivery routes for agents",icon:"🗺",defOn:false},
              ].map(({key,label,desc,icon,defOn})=>(
                <div key={key} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                  <div className="flex-1 min-w-0 pr-4">
                    <p style={{color:t.text}} className="text-sm font-semibold">{icon} {label}</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">{desc}</p>
                  </div>
                  <Tog dm={dm} on={settings?.[key]!==undefined?settings[key]:defOn} onChange={()=>setSettings(s=>({...s,[key]:!(s?.[key]!==undefined?s[key]:defOn)}))}/>
                </div>
              ))}
            </div></Card>

            {/* Finance */}
            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text,fontWeight:700,fontSize:14,marginBottom:2}}>💰 Finance</p>
              <p style={{color:t.sub,fontSize:11,marginBottom:12}}>Financial controls and calculations</p>
              {[
                {key:"featureCreditLimit",label:"Credit Limit Enforcement",desc:"Block orders when customer exceeds their credit limit",icon:"💳",defOn:false},
                {key:"featureTaxCalc",label:"Tax Calculation (GST/VAT)",desc:"Apply tax automatically on invoices",icon:"🧾",defOn:false},
                {key:"featureMultiCurrency",label:"Multi-Currency Support",desc:"Accept orders in different currencies",icon:"💱",defOn:false},
              ].map(({key,label,desc,icon,defOn})=>(
                <div key={key} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                  <div className="flex-1 min-w-0 pr-4">
                    <p style={{color:t.text}} className="text-sm font-semibold">{icon} {label}</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">{desc}</p>
                  </div>
                  <Tog dm={dm} on={settings?.[key]!==undefined?settings[key]:defOn} onChange={()=>setSettings(s=>({...s,[key]:!(s?.[key]!==undefined?s[key]:defOn)}))}/>
                </div>
              ))}
            </div></Card>

            {/* Reports */}
            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text,fontWeight:700,fontSize:14,marginBottom:2}}>📊 Reports & Analytics</p>
              <p style={{color:t.sub,fontSize:11,marginBottom:12}}>Control what appears in reports</p>
              {[
                {key:"invoiceShowOnReports",label:"Invoice Numbers in Reports",desc:"Display invoice ID on all exported and printed reports",icon:"📄",defOn:true},
                {key:"invoiceShowOnPnL",label:"Invoice Numbers in P&L",desc:"Show invoice references on profit & loss statements",icon:"📈",defOn:true},
                {key:"invoiceShowOnAnalytics",label:"Invoice Numbers in Analytics",desc:"Include invoice data in analytics breakdowns",icon:"🔍",defOn:true},
              ].map(({key,label,desc,icon,defOn})=>(
                <div key={key} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                  <div className="flex-1 min-w-0 pr-4">
                    <p style={{color:t.text}} className="text-sm font-semibold">{icon} {label}</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">{desc}</p>
                  </div>
                  <Tog dm={dm} on={settings?.[key]!==undefined?settings[key]:defOn} onChange={()=>setSettings(s=>({...s,[key]:!(s?.[key]!==undefined?s[key]:defOn)}))}/>
                </div>
              ))}
            </div></Card>

            {/* Agent features */}
            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text,fontWeight:700,fontSize:14,marginBottom:2}}>🚚 Delivery Agent Features</p>
              <p style={{color:t.sub,fontSize:11,marginBottom:12}}>Control what agents can see and do</p>
              {[
                {key:"agentCollectEnabled",label:"Agent Cash Collection",desc:"Show the Collect button so agents can record cash on delivery",icon:"💰",defOn:true},
                {key:"agentCollectRequireNote",label:"Require Collection Note",desc:"Agent must enter a note before confirming collection",icon:"📝",defOn:false},
                {key:"agentInvoiceEnabled",label:"Delivery Receipts",desc:"Show Receipt button on delivery cards",icon:"🧾",defOn:true},
                {key:"agentInvoiceShowPrices",label:"Show Prices on Receipt",desc:"Include unit prices and totals on the printed receipt",icon:"💲",defOn:true},
                {key:"agentAutoReceipt",label:"Auto-print After Collection",desc:"Auto-trigger print dialog when agent confirms collection",icon:"🖨",defOn:true},
              ].map(({key,label,desc,icon,defOn})=>(
                <div key={key} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                  <div className="flex-1 min-w-0 pr-4">
                    <p style={{color:t.text}} className="text-sm font-semibold">{icon} {label}</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">{desc}</p>
                  </div>
                  <Tog dm={dm} on={settings?.[key]!==undefined?settings[key]:defOn} onChange={()=>setSettings(s=>({...s,[key]:!(s?.[key]!==undefined?s[key]:defOn)}))}/>
                </div>
              ))}
            </div></Card>
          </>}

          {/* ── INVOICE NUMBERING ── */}
          {settingsSection==="invoice"&&(()=>{
            const prefix = settings?.invoicePrefix||"TAS";
            const startSeq = settings?.invoiceStartSeq||1;
            const yearReset = settings?.invoiceYearReset!==false;
            const currentSeq = invRegistry?.seq||0;
            const year = new Date().getFullYear();
            const previewNo = `${prefix}-${yearReset?year+"-":""}${String(Math.max(currentSeq+1,startSeq)).padStart(4,"0")}`;
            const previewReceipt = `RCP-${yearReset?year+"-":""}${String(Math.max(currentSeq+1,startSeq)).padStart(4,"0")}`;
            const totalIssued = Object.keys(invRegistry?.issued||{}).length;
            return <>
              {/* Stats */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                {[
                  {label:"Invoices Issued",val:totalIssued,color:"#8b5cf6"},
                  {label:"Current Sequence",val:`#${currentSeq}`,color:"#f59e0b"},
                  {label:"Next Number",val:previewNo,color:"#10b981"},
                ].map(({label,val,color})=>(
                  <div key={label} style={{background:t.inp,borderRadius:12,padding:"12px 10px",textAlign:"center"}}>
                    <p style={{color,fontWeight:900,fontSize:15,lineHeight:1,fontFamily:"monospace"}}>{val}</p>
                    <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginTop:5}}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Format config */}
              <Card dm={dm}><div className="p-4 flex flex-col gap-3">
                <p style={{color:t.text}} className="text-sm font-bold">📐 Number Format</p>
                <p style={{color:t.sub}} className="text-[11px]">Defines how invoice numbers look system-wide — applied to all invoices, receipts, reports, P&amp;L, and analytics.</p>
                <div>
                  <label style={{color:t.sub,letterSpacing:"0.05em"}} className="crm-form-label block text-[11px] font-semibold uppercase mb-1.5">Invoice Prefix</label>
                  <input value={settings?.invoicePrefix||"TAS"} onChange={e=>setSettings(s=>({...s,invoicePrefix:e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8)}))} maxLength={8} placeholder="TAS" style={{background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:12,padding:"10px 14px",fontSize:16,width:"100%",outline:"none",fontFamily:"monospace",fontWeight:700,letterSpacing:"0.08em"}}/>
                  <p style={{color:t.sub,fontSize:10,marginTop:4}}>Letters and numbers only. Max 8 chars. e.g. TAS, INV, ORD</p>
                </div>

                <div className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`}}>
                  <div>
                    <p style={{color:t.text}} className="text-sm font-semibold">📅 Year in Number</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">Include the current year: TAS-2026-0001 vs TAS-0001</p>
                  </div>
                  <Tog dm={dm} on={yearReset} onChange={()=>setSettings(s=>({...s,invoiceYearReset:!yearReset}))}/>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p style={{color:t.text}} className="text-sm font-semibold">🔁 Reset Sequence Yearly</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">Restart from 0001 at the start of each year</p>
                  </div>
                  <Tog dm={dm} on={yearReset} onChange={()=>setSettings(s=>({...s,invoiceYearReset:!yearReset}))}/>
                </div>
              </div></Card>

              {/* Live preview */}
              <Card dm={dm}><div className="p-4">
                <p style={{color:t.text}} className="text-sm font-bold mb-3">👁 Live Preview</p>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {[
                    {label:"Invoice",val:previewNo,color:"#8b5cf6"},
                    {label:"Receipt",val:previewReceipt,color:"#0ea5e9"},
                    {label:"Shown in P&L",val:settings?.invoiceShowOnPnL!==false?"✓ Yes":"✗ Hidden",color:settings?.invoiceShowOnPnL!==false?"#10b981":"#ef4444"},
                    {label:"Shown in Analytics",val:settings?.invoiceShowOnAnalytics!==false?"✓ Yes":"✗ Hidden",color:settings?.invoiceShowOnAnalytics!==false?"#10b981":"#ef4444"},
                    {label:"Shown in All Reports",val:settings?.invoiceShowOnReports!==false?"✓ Yes":"✗ Hidden",color:settings?.invoiceShowOnReports!==false?"#10b981":"#ef4444"},
                  ].map(({label,val,color})=>(
                    <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${t.border}`}}>
                      <span style={{color:t.sub,fontSize:12}}>{label}</span>
                      <span style={{color,fontWeight:800,fontSize:13,fontFamily:"monospace"}}>{val}</span>
                    </div>
                  ))}
                </div>
              </div></Card>

              {/* Appearance toggles */}
              <Card dm={dm}><div className="p-4">
                <p style={{color:t.text}} className="text-sm font-bold mb-1">📍 Where invoice numbers appear</p>
                <p style={{color:t.sub}} className="text-[11px] mb-3">System-wide control — applies across all modules</p>
                {[
                  {key:"invoiceShowOnReports",label:"All Printed Reports",desc:"PDF exports, daily sheets, delivery reports"},
                  {key:"invoiceShowOnPnL",label:"Profit & Loss Reports",desc:"P&L monthly and yearly statements"},
                  {key:"invoiceShowOnAnalytics",label:"Analytics Dashboard",desc:"Analytics tab data tables and exports"},
                ].map(({key,label,desc})=>(
                  <div key={key} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                    <div>
                      <p style={{color:t.text}} className="text-sm font-semibold">{label}</p>
                      <p style={{color:t.sub}} className="text-[11px] mt-0.5">{desc}</p>
                    </div>
                    <Tog dm={dm} on={settings?.[key]!==false} onChange={()=>setSettings(s=>({...s,[key]:s?.[key]===false?true:false}))}/>
                  </div>
                ))}
              </div></Card>

              {/* Danger: reset sequence */}
              <Card dm={dm}><div className="p-4">
                <p style={{color:"#ef4444"}} className="text-sm font-bold mb-1">⚠️ Sequence Management</p>
                <p style={{color:t.sub}} className="text-[11px] mb-3">Total issued: <strong>{totalIssued}</strong> invoices. Current counter: <strong>{currentSeq}</strong>.</p>
                <Btn dm={dm} v="danger" size="sm" onClick={()=>ask(`Reset invoice counter to 0? All ${totalIssued} existing invoice numbers will remain linked to their deliveries, but new ones will restart from 0001.`,()=>{setInvRegistry({seq:0,issued:invRegistry?.issued||{}});notify("Invoice counter reset to 0 ✓");})}>Reset Counter (keep existing)</Btn>
              </div></Card>
            </>;
          })()}

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
                  {!isMe&&<Btn dm={dm} v="danger" size="sm" onClick={()=>delU(u)}>Remove</Btn>}
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
                      const icons={"Dashboard":"📊","Customers":"👥","Deliveries":"🚚","Supplies":"📦","Expenses":"💸","Wastage":"🗑️","P&L":"📈","Analytics":"🔍","Production":"🏭",};
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
            {/* Delivery Features — admin-controlled */}
            <Card dm={dm}><div className="p-4 flex flex-col gap-3">
              <p style={{color:t.text}} className="text-sm font-bold">🚚 Delivery Agent Features</p>
              <p style={{color:t.sub}} className="text-[11px]">Control what delivery agents can see and do on their Deliveries tab.</p>

              {/* Bulk Order */}
              <div className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`}}>
                <div>
                  <p style={{color:t.text}} className="text-sm font-semibold">📋 Bulk Order Entry</p>
                  <p style={{color:t.sub}} className="text-[11px] mt-0.5">Allow agents/factory to create orders for multiple customers at once.</p>
                </div>
                <Tog dm={dm} on={settings?.bulkOrderEnabled!==false} onChange={()=>setSettings(s=>({...s,bulkOrderEnabled:s?.bulkOrderEnabled===false?true:false}))}/>
              </div>

              {/* Agent Collect Cash */}
              <div className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`}}>
                <div>
                  <p style={{color:t.text}} className="text-sm font-semibold">💰 Agent Cash Collection</p>
                  <p style={{color:t.sub}} className="text-[11px] mt-0.5">Show the "Collect" button on delivery cards so agents can record cash received on delivery.</p>
                </div>
                <Tog dm={dm} on={settings?.agentCollectEnabled!==false} onChange={()=>setSettings(s=>({...s,agentCollectEnabled:s?.agentCollectEnabled===false?true:false}))}/>
              </div>

              {/* Require note on collect */}
              {settings?.agentCollectEnabled!==false&&<div className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`,paddingLeft:16}}>
                <div>
                  <p style={{color:t.sub}} className="text-sm font-semibold">↳ Require collection note</p>
                  <p style={{color:t.sub}} className="text-[11px] mt-0.5">Agent must enter a note (e.g. cash/UPI ref) before confirming collection.</p>
                </div>
                <Tog dm={dm} on={settings?.agentCollectRequireNote===true} onChange={()=>setSettings(s=>({...s,agentCollectRequireNote:!s?.agentCollectRequireNote}))}/>
              </div>}

              {/* Agent Invoice / Receipt */}
              <div className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`}}>
                <div>
                  <p style={{color:t.text}} className="text-sm font-semibold">🧾 Delivery Receipts</p>
                  <p style={{color:t.sub}} className="text-[11px] mt-0.5">Controls who sees the 🧾 Receipt button on delivery cards. Tapping it opens a full receipt card with a Print option. Admin always has access.</p>
                </div>
                <Tog dm={dm} on={settings?.agentInvoiceEnabled!==false} onChange={()=>setSettings(s=>({...s,agentInvoiceEnabled:s?.agentInvoiceEnabled===false?true:false}))}/>
              </div>

              {/* Per-role receipt visibility + print */}
              {settings?.agentInvoiceEnabled!==false&&<>
                {/* Agents */}
                <div className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`,paddingLeft:16}}>
                  <div>
                    <p style={{color:t.sub}} className="text-sm font-semibold">↳ Show Receipt button to Agents</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">Delivery agents can open the receipt card.</p>
                  </div>
                  <Tog dm={dm} on={(settings?.receiptVisibleTo||["agent"]).includes("agent")} onChange={()=>{const cur=settings?.receiptVisibleTo||["agent"];const next=cur.includes("agent")?cur.filter(r=>r!=="agent"):[...cur,"agent"];setSettings(s=>({...s,receiptVisibleTo:next}));}}/>
                </div>
                {(settings?.receiptVisibleTo||["agent"]).includes("agent")&&<div className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`,paddingLeft:32}}>
                  <div>
                    <p style={{color:t.sub}} className="text-sm font-semibold">↳ ↳ Allow Agents to Print</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">Show the 🖨 Print button on the receipt card for agents. Disable to make it view-only.</p>
                  </div>
                  <Tog dm={dm} on={(settings?.receiptPrintAllowed||["admin","agent"]).includes("agent")} onChange={()=>{const cur=settings?.receiptPrintAllowed||["admin","agent"];const next=cur.includes("agent")?cur.filter(r=>r!=="agent"):[...cur,"agent"];setSettings(s=>({...s,receiptPrintAllowed:next}));}}/>
                </div>}
                {/* Factory */}
                <div className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`,paddingLeft:16}}>
                  <div>
                    <p style={{color:t.sub}} className="text-sm font-semibold">↳ Show Receipt button to Factory</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">Factory staff can open the receipt card.</p>
                  </div>
                  <Tog dm={dm} on={(settings?.receiptVisibleTo||["agent"]).includes("factory")} onChange={()=>{const cur=settings?.receiptVisibleTo||["agent"];const next=cur.includes("factory")?cur.filter(r=>r!=="factory"):[...cur,"factory"];setSettings(s=>({...s,receiptVisibleTo:next}));}}/>
                </div>
                {(settings?.receiptVisibleTo||["agent"]).includes("factory")&&<div className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`,paddingLeft:32}}>
                  <div>
                    <p style={{color:t.sub}} className="text-sm font-semibold">↳ ↳ Allow Factory to Print</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">Show the 🖨 Print button on the receipt card for factory staff.</p>
                  </div>
                  <Tog dm={dm} on={(settings?.receiptPrintAllowed||["admin","agent"]).includes("factory")} onChange={()=>{const cur=settings?.receiptPrintAllowed||["admin","agent"];const next=cur.includes("factory")?cur.filter(r=>r!=="factory"):[...cur,"factory"];setSettings(s=>({...s,receiptPrintAllowed:next}));}}/>
                </div>}
              </>}

              {/* Show prices on receipt */}
              {settings?.agentInvoiceEnabled!==false&&<div className="flex items-center justify-between py-2" style={{borderBottom:`1px solid ${t.border}`,paddingLeft:16}}>
                <div>
                  <p style={{color:t.sub}} className="text-sm font-semibold">↳ Show prices on printed receipt</p>
                  <p style={{color:t.sub}} className="text-[11px] mt-0.5">Include unit prices and totals on the printed receipt. Disable to show items only (no amounts).</p>
                </div>
                <Tog dm={dm} on={settings?.agentInvoiceShowPrices!==false} onChange={()=>setSettings(s=>({...s,agentInvoiceShowPrices:s?.agentInvoiceShowPrices===false?true:false}))}/>
              </div>}

              {/* Auto-open receipt after collect */}
              {settings?.agentInvoiceEnabled!==false&&settings?.agentCollectEnabled!==false&&<div className="flex items-center justify-between py-2" style={{paddingLeft:16}}>
                <div>
                  <p style={{color:t.sub}} className="text-sm font-semibold">↳ Auto-print receipt after collection</p>
                  <p style={{color:t.sub}} className="text-[11px] mt-0.5">Automatically trigger the print dialog when agent confirms a cash collection (in addition to the inline receipt card that always appears).</p>
                </div>
                <Tog dm={dm} on={settings?.agentAutoReceipt!==false} onChange={()=>setSettings(s=>({...s,agentAutoReceipt:s?.agentAutoReceipt===false?true:false}))}/>
              </div>}

            </div></Card>
          </>}

          {/* ── RECIPES ── */}
          {settingsSection==="recipes"&&(()=>{
            const recipes=settings?.recipes||{};
            const autoDeductOn=settings?.autoDeductEnabled!==false;
            return <>\
              {/* Global auto-deduct toggle */}
              <Card dm={dm}><div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p style={{color:t.text,fontWeight:700,fontSize:14}}>🤖 Smart Auto-Deduct</p>
                    <p style={{color:t.sub,fontSize:12,marginTop:2}}>When production is logged, automatically reduce matching supply stock. Factory staff inherit this setting.</p>
                  </div>
                  <Tog dm={dm} on={autoDeductOn} onChange={()=>setSettings(s=>({...s,autoDeductEnabled:!autoDeductOn}))}/>
                </div>
              </div></Card>

              {/* Per-product recipes */}
              <p style={{color:t.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginTop:4}}>Product Recipes</p>
              <p style={{color:t.sub,fontSize:11,marginTop:2,marginBottom:4}}>Define which supply items are consumed per unit produced. Used for the recipe preview in each batch.</p>
              {products.map(prod=>{
                const ingrs=(recipes[prod.id]?.ingredients)||[];
                const open=openRecipe===prod.id;
                return <Card key={prod.id} dm={dm}><div className="p-4">
                  <button onClick={()=>setOpenRecipe(open?null:prod.id)} style={{background:"none",border:"none",cursor:"pointer",width:"100%",textAlign:"left",display:"flex",alignItems:"center",justifyContent:"space-between",padding:0}}>
                    <div>
                      <p style={{color:t.text,fontWeight:700,fontSize:13}}>{prod.name}</p>
                      <p style={{color:t.sub,fontSize:11}}>{ingrs.length>0?`${ingrs.length} ingredient${ingrs.length!==1?"s":""}  defined`:"No recipe yet"}</p>
                    </div>
                    <span style={{color:t.sub,fontSize:16}}>{open?"▲":"▼"}</span>
                  </button>
                  {open&&<>
                    <Hr dm={dm}/>
                    {ingrs.map((ing,ii)=>(
                      <div key={ii} className="flex gap-2 items-center mb-2">
                        <Inp dm={dm} label="Supply item" value={ing.supply} onChange={e=>{const n=[...ingrs];n[ii]={...n[ii],supply:e.target.value};setSettings(s=>({...s,recipes:{...recipes,[prod.id]:{ingredients:n}}}));}} placeholder="e.g. Flour"/>
                        <Inp dm={dm} label="Qty/unit" type="number" value={ing.qtyPerUnit} onChange={e=>{const n=[...ingrs];n[ii]={...n[ii],qtyPerUnit:e.target.value};setSettings(s=>({...s,recipes:{...recipes,[prod.id]:{ingredients:n}}}));}} placeholder="0.5"/>
                        <Inp dm={dm} label="Unit" value={ing.unit} onChange={e=>{const n=[...ingrs];n[ii]={...n[ii],unit:e.target.value};setSettings(s=>({...s,recipes:{...recipes,[prod.id]:{ingredients:n}}}));}} placeholder="kg"/>
                        <button onClick={()=>{const n=ingrs.filter((_,i)=>i!==ii);setSettings(s=>({...s,recipes:{...recipes,[prod.id]:{ingredients:n}}}));}} style={{background:"#dc2626",color:"#fff",border:"none",borderRadius:8,padding:"0 10px",minHeight:36,fontWeight:700,cursor:"pointer",flexShrink:0,marginTop:8}}>×</button>
                      </div>
                    ))}
                    <Btn dm={dm} v="outline" size="sm" onClick={()=>{const n=[...ingrs,{supply:"",qtyPerUnit:"",unit:""}];setSettings(s=>({...s,recipes:{...recipes,[prod.id]:{ingredients:n}}}));}}>+ Add Ingredient</Btn>
                  </>}
                </div></Card>;
              })}
            </>;
          })()}

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
            {/* Live preview strip */}
            <div style={{background:t.accent,borderRadius:16,padding:"16px 20px",display:"flex",alignItems:"center",gap:14}}>
              <span style={{fontSize:36,lineHeight:1}}>{settings?.appEmoji||"🫓"}</span>
              <div>
                <p style={{color:"#fff",fontWeight:900,fontSize:16,lineHeight:1.2}}>{settings?.appName||"TAS Healthy World"}</p>
                <p style={{color:"rgba(255,255,255,0.6)",fontSize:11,marginTop:3}}>{settings?.appSubtitle||"Paratha Factory · Operations"}</p>
                {settings?.brandTagline&&<p style={{color:"rgba(255,255,255,0.5)",fontSize:10,marginTop:3,fontStyle:"italic"}}>"{settings.brandTagline}"</p>}
              </div>
            </div>

            <Card dm={dm}><div className="p-4 flex flex-col gap-3">
              <p style={{color:t.text}} className="text-sm font-bold">🎨 App Identity</p>
              <Inp dm={dm} label="App Name" value={settings?.appName||""} onChange={e=>setSettings(s=>({...s,appName:e.target.value}))} placeholder="TAS Healthy World"/>
              <Inp dm={dm} label="Subtitle" value={settings?.appSubtitle||""} onChange={e=>setSettings(s=>({...s,appSubtitle:e.target.value}))} placeholder="Paratha Factory · Operations"/>
              <Inp dm={dm} label="Tagline (optional)" value={settings?.brandTagline||""} onChange={e=>setSettings(s=>({...s,brandTagline:e.target.value}))} placeholder="Fresh. Local. Delivered."/>
              <div>
                <label style={{color:t.sub,letterSpacing:"0.05em"}} className="crm-form-label block text-[11px] font-semibold uppercase mb-1.5">Emoji / Icon</label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {["🫓","🍽️","🏭","🌿","🥘","🍲","🌾","🚚","⚡","🔥"].map(e=>(
                    <button key={e} onClick={()=>setSettings(s=>({...s,appEmoji:e}))} style={{fontSize:22,background:settings?.appEmoji===e?t.accent+"22":t.inp,border:`2px solid ${settings?.appEmoji===e?t.accent:t.border}`,borderRadius:10,padding:"6px 10px",cursor:"pointer",transition:"all 0.15s"}}>{e}</button>
                  ))}
                </div>
                <Inp dm={dm} label="Custom emoji" value={settings?.appEmoji||""} onChange={e=>setSettings(s=>({...s,appEmoji:e.target.value}))} placeholder="🫓"/>
              </div>
            </div></Card>

            <Card dm={dm}><div className="p-4 flex flex-col gap-3">
              <p style={{color:t.text}} className="text-sm font-bold">🏢 Company Details (used on Invoices & Receipts)</p>
              <Inp dm={dm} label="Company Name" value={settings?.companyName||""} onChange={e=>setSettings(s=>({...s,companyName:e.target.value}))} placeholder="TAS Healthy World"/>
              <Inp dm={dm} label="Company Subtitle" value={settings?.companySubtitle||""} onChange={e=>setSettings(s=>({...s,companySubtitle:e.target.value}))} placeholder="Malabar Paratha Factory · Goa, India"/>
              <Inp dm={dm} label="Address" value={settings?.companyAddress||""} onChange={e=>setSettings(s=>({...s,companyAddress:e.target.value}))} placeholder="123 Factory Road, Goa 403001"/>
              <Inp dm={dm} label="Phone" value={settings?.companyPhone||""} onChange={e=>setSettings(s=>({...s,companyPhone:e.target.value}))} placeholder="+91 98765 43210"/>
              <Inp dm={dm} label="GST Number" value={settings?.companyGST||""} onChange={e=>setSettings(s=>({...s,companyGST:e.target.value}))} placeholder="22AAAAA0000A1Z5"/>
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

          {/* ── ALERTS & NOTIFICATIONS ── */}
          {settingsSection==="alerts"&&<>
            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text,fontWeight:700,fontSize:14,marginBottom:2}}>🔔 Alert Toggles</p>
              <p style={{color:t.sub,fontSize:11,marginBottom:12}}>Control which alerts fire across the system. Browser push + in-app notifications both follow these settings.</p>
              {[
                {key:"alertLowStock",label:"Low Stock Alert",desc:"Alert when a supply item falls below the threshold",icon:"⚠️",defOn:true},
                {key:"alertOverdueDelivery",label:"Overdue Delivery Alert",desc:"Alert when a delivery is past its expected date",icon:"🔴",defOn:true},
                {key:"alertChurnRisk",label:"Churn Risk Alert",desc:"Alert when a customer has been inactive for too long",icon:"💤",defOn:true},
                {key:"alertPaymentReceived",label:"Payment Received",desc:"Alert when a payment is recorded for any customer",icon:"💰",defOn:true},
                {key:"alertNewOrder",label:"New Order Created",desc:"Alert when a new delivery order is saved",icon:"📦",defOn:false},
                {key:"alertDailyReport",label:"Daily Summary",desc:"Morning briefing notification",icon:"☀️",defOn:false},
              ].map(({key,label,desc,icon,defOn})=>(
                <div key={key} className="flex items-center justify-between py-2.5" style={{borderBottom:`1px solid ${t.border}`}}>
                  <div className="flex-1 pr-4">
                    <p style={{color:t.text}} className="text-sm font-semibold">{icon} {label}</p>
                    <p style={{color:t.sub}} className="text-[11px] mt-0.5">{desc}</p>
                  </div>
                  <Tog dm={dm} on={settings?.[key]!==undefined?settings[key]:defOn} onChange={()=>setSettings(s=>({...s,[key]:!(s?.[key]!==undefined?s[key]:defOn)}))}/>
                </div>
              ))}
            </div></Card>

            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text,fontWeight:700,fontSize:14,marginBottom:2}}>📣 Who gets notified</p>
              <p style={{color:t.sub,fontSize:11,marginBottom:12}}>Choose which roles receive each type of notification</p>
              {[
                {key:"payment",label:"Payment events",icon:"💰"},
                {key:"delivery",label:"Delivery events",icon:"📦"},
                {key:"lowstock",label:"Low stock alerts",icon:"⚠️"},
                {key:"newentry",label:"New entries (general)",icon:"📝"},
                {key:"noticeboard",label:"Noticeboard posts",icon:"📌"},
              ].map(({key,label,icon})=>{
                const cur=settings?.notifTargets?.[key]||[];
                return <div key={key} style={{borderBottom:`1px solid ${t.border}`,paddingBottom:12,marginBottom:12}}>
                  <p style={{color:t.text,fontSize:12,fontWeight:700,marginBottom:8}}>{icon} {label}</p>
                  <div className="flex gap-2 flex-wrap">
                    {["admin","factory","agent"].map(role=>{
                      const on=cur.includes(role);
                      return <button key={role} onClick={()=>{const next=on?cur.filter(r=>r!==role):[...cur,role];setSettings(s=>({...s,notifTargets:{...(s.notifTargets||{}),[key]:next}}));}}
                        style={{background:on?t.accent:t.inp,color:on?t.accentFg:t.sub,border:`1.5px solid ${on?t.accent:t.border}`,borderRadius:20,padding:"5px 14px",fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"capitalize",transition:"all 0.15s"}}>{role}</button>;
                    })}
                  </div>
                </div>;
              })}
            </div></Card>

            <Card dm={dm}><div className="p-4">
              <p style={{color:t.text,fontWeight:700,fontSize:14,marginBottom:2}}>⚙️ Alert Thresholds</p>
              <div className="flex flex-col gap-3 mt-2">
                <div>
                  <label style={{color:t.sub,letterSpacing:"0.05em"}} className="crm-form-label block text-[11px] font-semibold uppercase mb-1.5">Low Stock Threshold (units)</label>
                  <input type="number" min={0} value={settings?.lowStockThreshold??5} onChange={e=>setSettings(s=>({...s,lowStockThreshold:+e.target.value}))} style={{background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:12,padding:"10px 14px",fontSize:16,width:"100%",outline:"none"}}/>
                  <p style={{color:t.sub,fontSize:10,marginTop:4}}>Alert fires when any supply item qty ≤ this value</p>
                </div>
                <div>
                  <label style={{color:t.sub,letterSpacing:"0.05em"}} className="crm-form-label block text-[11px] font-semibold uppercase mb-1.5">Churn Alert Days</label>
                  <input type="number" min={1} value={settings?.churnDays??14} onChange={e=>setSettings(s=>({...s,churnDays:+e.target.value}))} style={{background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:12,padding:"10px 14px",fontSize:16,width:"100%",outline:"none"}}/>
                  <p style={{color:t.sub,fontSize:10,marginTop:4}}>Alert fires if a customer has no orders for this many days</p>
                </div>
                <div>
                  <label style={{color:t.sub,letterSpacing:"0.05em"}} className="crm-form-label block text-[11px] font-semibold uppercase mb-1.5">Auto Backup Reminder (days)</label>
                  <input type="number" min={1} value={settings?.autoBackupReminder??7} onChange={e=>setSettings(s=>({...s,autoBackupReminder:+e.target.value}))} style={{background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:12,padding:"10px 14px",fontSize:16,width:"100%",outline:"none"}}/>
                  <p style={{color:t.sub,fontSize:10,marginTop:4}}>Reminder fires if no backup taken in this many days</p>
                </div>
              </div>
            </div></Card>
          </>}

          {/* ── DATA / BACKUP ── */}
          {settingsSection==="data"&&<>
            <Card dm={dm}><div className="p-4 flex flex-col gap-3">
              <p style={{color:t.text}} className="text-sm font-bold">🗄️ Backup & Restore</p>
              {(()=>{
                const daysSince=lastBackupDate?Math.round((Date.now()-new Date(lastBackupDate).getTime())/86400000):null;
                const noBackup=!lastBackupDate;
                const stale=daysSince!==null&&daysSince>=(settings?.autoBackupReminder||7);
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
              <Btn dm={dm} v="purple" className="w-full" onClick={exportFullReport}>📊 Export Full Report (PDF — All Data)</Btn>
              <label style={{border:`1px solid ${t.border}`,color:t.text}} className="w-full text-sm font-semibold rounded-xl px-4 py-2.5 text-center cursor-pointer hover:opacity-80 transition-all">
                ⬆️ Import Backup (JSON)<input type="file" accept=".json" className="hidden" onChange={importAll}/>
              </label>
              <Hr dm={dm}/>
              <p style={{color:t.text}} className="text-sm font-bold">Export as CSV</p>
              <div className="flex gap-2 flex-wrap">
                <Btn dm={dm} v="success" size="sm" onClick={()=>exportCSV(customers,"customers",[{label:"Name",key:"name"},{label:"Phone",key:"phone"},{label:"Address",key:"address"},{label:"Paid",key:"paid"},{label:"Pending",key:"pending"},{label:"Status",val:r=>r.pending>0?"UNPAID":"PAID"},{label:"Join Date",key:"joinDate"},{label:"Notes",key:"notes"}])}>Customers</Btn>
                <Btn dm={dm} v="success" size="sm" onClick={()=>exportCSV(deliveries,"deliveries",[{label:"Customer",key:"customer"},{label:"Date",key:"date"},{label:"Deliver By",key:"deliveryDate"},{label:"Status",key:"status"},{label:"Total",val:r=>lineTotal(r.orderLines)},{label:"Invoice No",val:r=>(invRegistry?.issued||{})[r.id]||""},{label:"Replacement",val:r=>r.replacement?.done?"Yes":"No"},{label:"Repl Amount",val:r=>r.replacement?.amount||""},{label:"Address",key:"address"},{label:"By",key:"createdBy"}])}>Deliveries</Btn>
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
              <Btn dm={dm} v="danger" className="w-full" onClick={()=>ask("Reset ALL data to factory defaults? Cannot be undone.",()=>{setCust(D_CUST);setDeliv(D_DELIV);setSup(D_SUP);setExp(D_EXP);setProd(D_PRODS);setWaste(D_WASTE);const r=[{id:uid(),user:sess.name,role:sess.role,action:"FULL RESET",detail:"All data reset to defaults",ts:ts()}];setAct(r);notify("Reset complete");})}>Reset All Data to Defaults</Btn>
            </div></Card>
          </>}
          </>;
        })()}
      </div>

      {/* ── MOBILE BOTTOM NAV (visible only below lg) ─────────── */}
      {/* More menu overlay */}
      {showMoreNav&&<div className="fixed inset-0 z-40 lg:hidden" onClick={()=>setShowMoreNav(false)}/>}
      <nav style={{background:t.card,borderTop:`1px solid ${t.border}`,paddingBottom:"env(safe-area-inset-bottom,0px)",boxShadow:"0 -2px 20px rgba(0,0,0,0.12)",zIndex:50}} className="fixed bottom-0 left-0 right-0 flex lg:hidden crm-bottom-nav">
        {/* Show first 4 tabs + a "More" button always */}
        {TABS.slice(0,4).map(tb=>(
          <button key={tb} onClick={()=>{setTab(tb);setSrch("");setShowMoreNav(false);}}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 relative"
            style={{color:tab===tb?t.accent:t.sub,minHeight:56,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",transition:"color 0.15s",padding:"6px 2px"}}>
            {tab===tb&&<span style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:36,height:3,background:t.accent,borderRadius:"0 0 6px 6px"}}/>}
            <span style={{fontSize:22,lineHeight:1}}>{TAB_ICONS[tb]||"•"}</span>
            <span style={{fontSize:10,fontWeight:tab===tb?700:500,lineHeight:1,marginTop:3,maxWidth:56,textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tb.length>7?tb.slice(0,6)+"…":tb}</span>
            {tb==="Dashboard"&&pendingD.length>0&&tab!=="Dashboard"&&<span style={{position:"absolute",top:6,right:"calc(50% - 18px)",background:"#ef4444",color:"#fff",fontSize:9,fontWeight:700,borderRadius:99,minWidth:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>{pendingD.length>9?"9+":pendingD.length}</span>}
          </button>
        ))}
        {/* More button — always shown, opens a popup with remaining tabs + sign out */}
        <div className="flex-1 relative">
          <button onClick={()=>setShowMoreNav(v=>!v)}
            style={{color:TABS.slice(4).includes(tab)||showMoreNav?t.accent:t.sub,minHeight:56,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",transition:"color 0.15s",width:"100%",padding:"6px 2px"}}
            className="flex flex-col items-center justify-center gap-0.5 relative">
            {(TABS.slice(4).includes(tab)||showMoreNav)&&<span style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:36,height:3,background:t.accent,borderRadius:"0 0 6px 6px"}}/>}
            <span style={{fontSize:22,lineHeight:1}}>{showMoreNav?"✕":"⋯"}</span>
            <span style={{fontSize:10,fontWeight:600,lineHeight:1,marginTop:3}}>{TABS.slice(4).includes(tab)?tab.slice(0,6):"More"}</span>
          </button>

          {/* More popup — tabs + dark mode + sign out */}
          {showMoreNav&&(
            <div style={{background:t.card,border:`1.5px solid ${t.border}`,bottom:"calc(100% + 10px)",right:4,minWidth:220,boxShadow:"0 -8px 40px rgba(0,0,0,0.25)",borderRadius:20,overflow:"hidden",animation:"scaleIn 0.15s cubic-bezier(.32,1,.6,1) both",transformOrigin:"bottom right"}} className="absolute z-50">
              {/* Remaining tabs */}
              {TABS.slice(4).map(tb=>(
                <button key={tb} onClick={()=>{setTab(tb);setSrch("");setShowMoreNav(false);}}
                  style={{color:tab===tb?t.accent:t.text,background:tab===tb?(dm?"rgba(59,130,246,0.1)":"rgba(30,58,95,0.06)"):"transparent",WebkitTapHighlightColor:"transparent",touchAction:"manipulation",width:"100%",minHeight:52,display:"flex",alignItems:"center",gap:12,padding:"12px 18px",fontSize:14,fontWeight:tab===tb?700:500,borderBottom:`1px solid ${t.border}`}}>
                  <span style={{fontSize:18,width:24,textAlign:"center"}}>{TAB_ICONS[tb]||"•"}</span>{tb}
                </button>
              ))}
              {/* Divider + utility actions */}
              <div style={{borderTop:`1px solid ${t.border}`}}>
                <button onClick={()=>{setDm(d=>!d);setShowMoreNav(false);}}
                  style={{color:t.text,background:"transparent",WebkitTapHighlightColor:"transparent",touchAction:"manipulation",width:"100%",minHeight:52,display:"flex",alignItems:"center",gap:12,padding:"12px 18px",fontSize:14,fontWeight:500,borderBottom:`1px solid ${t.border}`}}>
                  <span style={{fontSize:18,width:24,textAlign:"center"}}>{dm?"☀️":"🌙"}</span>{dm?"Light mode":"Dark mode"}
                </button>
                <button onClick={()=>{onLogout();setShowMoreNav(false);}}
                  style={{color:"#ef4444",background:"transparent",WebkitTapHighlightColor:"transparent",touchAction:"manipulation",width:"100%",minHeight:52,display:"flex",alignItems:"center",gap:12,padding:"12px 18px",fontSize:14,fontWeight:700}}>
                  <span style={{fontSize:18,width:24,textAlign:"center"}}>↩</span>Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      </div>{/* end desktop flex child */}
    </div>{/* end outer flex */}

      {/* ═══════ SHEETS ═══════ */}

      {/* Customer Sheet */}
      <Sheet dm={dm} open={!!cSh} onClose={()=>setCsh(null)} title={cSh==="add"?"New Customer":"Edit Customer"}>
        <Inp dm={dm} label="Name *" value={cF.name} onChange={e=>setCf({...cF,name:e.target.value})} placeholder="Business or customer name"/>
        <Inp dm={dm} label="Phone" value={cF.phone} onChange={e=>setCf({...cF,phone:e.target.value})} placeholder="Mobile number" inputMode="tel" autoComplete="tel"/>
        <Inp dm={dm} label="Address" value={cF.address} onChange={e=>setCf({...cF,address:e.target.value})} placeholder="Full delivery address"/>
        <div className="grid grid-cols-2 gap-3">
          <Inp dm={dm} label="GPS Lat" value={cF.lat} onChange={e=>setCf({...cF,lat:e.target.value})} placeholder="15.4989" inputMode="decimal"/>
          <Inp dm={dm} label="GPS Lng" value={cF.lng} onChange={e=>setCf({...cF,lng:e.target.value})} placeholder="73.8278" inputMode="decimal"/>
        </div>
        <Inp dm={dm} label="Customer Since" type="date" value={cF.joinDate} onChange={e=>setCf({...cF,joinDate:e.target.value})}/>
        <p style={{color:t.sub}} className="text-[11px]">💡 Long-press location in Google Maps → copy coordinates.</p>
        <Hr dm={dm}/>
        <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider">Regular Order</p>
        <OrderEditor dm={dm} products={products} orderLines={cF.orderLines||{}} showPrice={canSeePrices} onChange={ol=>setCf(f=>({...f,orderLines:ol}))}/>
        <Hr dm={dm}/>
        {canSeeFinancials&&<div className="grid grid-cols-2 gap-3">
          <Inp dm={dm} label="Amount Paid (₹)" type="number" inputMode="numeric" value={cF.paid} onChange={e=>setCf({...cF,paid:e.target.value})}/>
          <Inp dm={dm} label="Amount Pending (₹)" type="number" inputMode="numeric" value={cF.pending} onChange={e=>setCf({...cF,pending:e.target.value})}/>
          <Inp dm={dm} label="Partial Payment (₹)" type="number" inputMode="numeric" value={cF.partialPay||""} onChange={e=>setCf({...cF,partialPay:e.target.value})} placeholder="Partial amount received (not yet fully settled)"/>
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
          const cv=cView;
          const rows=lineRows(cv.orderLines,products);
          const tot=lineTotal(cv.orderLines);
          const cDelivs=[...deliveries.filter(d=>d.customerId===cv.id)].sort((a,b)=>b.date.localeCompare(a.date));
          const cDone=cDelivs.filter(d=>d.status==="Delivered");
          const cPending=cDelivs.filter(d=>d.status==="Pending"||d.status==="In Transit");
          const cCancelled=cDelivs.filter(d=>d.status==="Cancelled");
          const cRepls=cDelivs.filter(d=>d.replacement?.done);
          const totalReplAmt=cDelivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
          const totalRevenue=cDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
          const delivRate=cDelivs.length>0?Math.round(cDone.length/cDelivs.length*100):100;
          const lastD=cDelivs[0];
          const lastDays=lastD?Math.floor((new Date()-new Date(lastD.date))/86400000):null;
          const lastLabel=lastDays===null?"Never":lastDays===0?"Today":lastDays===1?"Yesterday":`${lastDays}d ago`;
          const netTot=Math.max(0,tot-totalReplAmt);
          const totalBilled=(cv.paid||0)+(cv.pending||0);
          const payPct=totalBilled>0?Math.round((cv.paid||0)/totalBilled*100):100;
          return (<>
            {/* ── HEADER ── */}
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:4}}>
              <div style={{width:52,height:52,borderRadius:16,background:"#f59e0b22",color:"#f59e0b",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:22,flexShrink:0}}>{cv.name.charAt(0).toUpperCase()}</div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{color:t.text,fontWeight:800,fontSize:17,lineHeight:1.2}}>{cv.name}</p>
                <p style={{color:t.sub,fontSize:12,marginTop:2}}>{cv.phone||"No phone"}</p>
                <span style={{background:cv.active?"#dcfce7":"#f3f4f6",color:cv.active?"#15803d":"#6b7280",fontSize:10,fontWeight:700,padding:"2px 10px",borderRadius:99,display:"inline-block",marginTop:4}}>{cv.active?"● ACTIVE":"○ INACTIVE"}</span>
              </div>
            </div>

            {/* ── CONTACT & INFO ── */}
            <Hr dm={dm}/>
            <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Contact & Info</p>
            {[["📍 Address",cv.address||"—"],["📞 Phone",cv.phone||"—"],["📅 Customer Since",cv.joinDate||"—"],["💬 Notes",cv.notes||"—"]].map(([k,v])=>(
              <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"5px 0",borderBottom:`1px solid ${t.border}`}}>
                <span style={{color:t.sub,fontSize:12,flexShrink:0,marginRight:12}}>{k}</span>
                <span style={{color:t.text,fontWeight:600,fontSize:12,textAlign:"right",wordBreak:"break-word",maxWidth:"60%"}}>{v}</span>
              </div>
            ))}

            {/* ── STATS OVERVIEW ── */}
            <Hr dm={dm}/>
            <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>📊 Overview</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:10}}>
              {[
                {label:"Total Orders",val:cDelivs.length,color:t.text},
                {label:"Delivered",val:cDone.length,color:"#10b981"},
                {label:"Pending",val:cPending.length,color:"#f59e0b"},
                {label:"Cancelled",val:cCancelled.length,color:"#ef4444"},
                {label:"Replacements",val:cRepls.length,color:"#f97316"},
                {label:"Delivery Rate",val:`${delivRate}%`,color:delivRate>=90?"#10b981":delivRate>=70?"#f59e0b":"#ef4444"},
              ].map(({label,val,color})=>(
                <div key={label} style={{background:t.inp,borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
                  <p style={{color,fontWeight:900,fontSize:18,lineHeight:1}}>{val}</p>
                  <p style={{color:t.sub,fontSize:9,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.04em",marginTop:4}}>{label}</p>
                </div>
              ))}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:t.sub,marginBottom:4}}>
              <span>Delivery rate</span>
              <span style={{fontWeight:700,color:delivRate>=90?"#10b981":delivRate>=70?"#f59e0b":"#ef4444"}}>{delivRate}%</span>
            </div>
            <div style={{background:t.border,height:5,borderRadius:5,overflow:"hidden",marginBottom:2}}>
              <div style={{width:`${delivRate}%`,height:"100%",background:delivRate>=90?"#10b981":delivRate>=70?"#f59e0b":"#ef4444",borderRadius:5}}/>
            </div>
            <p style={{color:t.sub,fontSize:11,marginTop:4}}>🕐 Last order: <span style={{fontWeight:700,color:t.text}}>{lastLabel}</span></p>

            {/* ── PAYMENT STATUS ── */}
            {canSeeFinancials&&<>
              <Hr dm={dm}/>
              <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>💳 Payment Status</p>
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                <div style={{flex:1,background:"#10b98115",borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
                  <p style={{color:"#10b981",fontWeight:900,fontSize:15}}>{inr(cv.paid||0)}</p>
                  <p style={{color:t.sub,fontSize:9,fontWeight:600,textTransform:"uppercase",marginTop:3}}>Paid</p>
                </div>
                <div style={{flex:1,background:cv.pending>0?"#ef444415":"#10b98115",borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
                  <p style={{color:cv.pending>0?"#ef4444":"#10b981",fontWeight:900,fontSize:15}}>{inr(cv.pending||0)}</p>
                  <p style={{color:t.sub,fontSize:9,fontWeight:600,textTransform:"uppercase",marginTop:3}}>Outstanding</p>
                </div>
                {canSeePrices&&totalRevenue>0&&<div style={{flex:1,background:t.inp,borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
                  <p style={{color:"#f59e0b",fontWeight:900,fontSize:15}}>{inr(totalRevenue)}</p>
                  <p style={{color:t.sub,fontSize:9,fontWeight:600,textTransform:"uppercase",marginTop:3}}>Total Revenue</p>
                </div>}
              </div>
              {totalBilled>0&&<>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:t.sub,marginBottom:4}}>
                  <span>Payment progress</span><span style={{fontWeight:700,color:cv.pending>0?"#f59e0b":"#10b981"}}>{payPct}% settled</span>
                </div>
                <div style={{background:t.border,height:5,borderRadius:5,overflow:"hidden",marginBottom:6}}>
                  <div style={{width:`${payPct}%`,height:"100%",background:cv.pending>0?"#f59e0b":"#10b981",borderRadius:5}}/>
                </div>
              </>}
              {(cv.partialPay||0)>0&&<p style={{color:"#d97706",fontSize:12,fontWeight:600,marginTop:4}}>💛 Partial on hold: {inr(cv.partialPay)}</p>}
              {totalReplAmt>0&&<p style={{color:"#f97316",fontSize:12,fontWeight:600,marginTop:4}}>🔄 Replacement deductions: −{inr(totalReplAmt)}</p>}
            </>}

            {/* ── REGULAR ORDER TEMPLATE ── */}
            {rows.length>0&&<>
              <Hr dm={dm}/>
              <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>🛒 Regular Order Template</p>
              {rows.map(r=>(
                <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${t.border}`}}>
                  <span style={{color:t.sub,fontSize:13}}>{r.qty} × {r.name}{canSeePrices?` @ ${inr(r.priceAmount)}`:""}</span>
                  {canSeePrices&&<span style={{color:t.text,fontWeight:700,fontSize:13}}>{inr(r.qty*r.priceAmount)}</span>}
                </div>
              ))}
              {canSeePrices&&tot>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",marginTop:2}}>
                <span style={{color:t.sub,fontSize:13,fontWeight:700}}>Template Total</span>
                <span style={{color:"#f59e0b",fontWeight:800,fontSize:14}}>{inr(netTot)}</span>
              </div>}
            </>}

            {/* ── FULL DELIVERY HISTORY ── */}
            <Hr dm={dm}/>
            <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>📦 Delivery History ({cDelivs.length})</p>
            {cDelivs.length===0
              ?<p style={{color:t.sub,fontSize:13,textAlign:"center",padding:"16px 0"}}>No deliveries yet.</p>
              :cDelivs.map((d,i)=>{
                const dItems=Object.entries(safeO(d.orderLines)).filter(([,l])=>l.qty>0).map(([pid,l])=>{const p=products.find(x=>x.id===pid);return `${l.qty}× ${p?p.name:(l.name||pid)}`;}).join(", ");
                const dTot=lineTotal(d.orderLines);
                const statusColor=d.status==="Delivered"?"#10b981":d.status==="In Transit"?"#3b82f6":d.status==="Cancelled"?"#ef4444":"#f59e0b";
                return <div key={d.id} style={{background:t.inp,borderRadius:12,padding:"10px 12px",marginBottom:8,border:`1px solid ${t.border}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:dItems?6:0}}>
                    <div>
                      <p style={{color:t.text,fontWeight:700,fontSize:13}}>{d.date}</p>
                      {d.deliveryDate&&d.deliveryDate!==d.date&&<p style={{color:t.sub,fontSize:11}}>Delivered: {d.deliveryDate}</p>}
                      {d.createdBy&&<p style={{color:t.sub,fontSize:10}}>By: {d.createdBy}</p>}
                    </div>
                    <span style={{background:statusColor+"20",color:statusColor,fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:99}}>{d.status}</span>
                  </div>
                  {dItems&&<p style={{color:t.sub,fontSize:12,marginBottom:4}}>📦 {dItems}</p>}
                  {canSeePrices&&(()=>{
                    const replAmt=+d.replacement?.amount||0;
                    const netAmt=dTot-replAmt;
                    const collected=d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0;
                    const balanceDue=Math.max(0,netAmt-collected);
                    return <>
                      {dTot>0&&<div style={{marginTop:6,borderTop:`1px solid ${t.border}`,paddingTop:6}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:2}}>
                          <span style={{color:t.sub}}>Order Total</span>
                          <span style={{color:t.text,fontWeight:600}}>{inr(dTot)}</span>
                        </div>
                        {d.replacement?.done&&<>
                          <div style={{background:"#f9731615",borderRadius:8,padding:"5px 8px",margin:"4px 0",border:"1px solid #f9731625"}}>
                            <p style={{color:"#f97316",fontSize:11,fontWeight:700}}>🔄 {d.replacement.item||"Replacement"}{d.replacement.qty?` (${d.replacement.qty})`:""}</p>
                            {d.replacement.reason&&<p style={{color:t.sub,fontSize:10}}>{d.replacement.reason}</p>}
                            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginTop:2}}>
                              <span style={{color:"#f97316"}}>− Replacement</span>
                              <span style={{color:"#f97316",fontWeight:700}}>−{inr(replAmt)}</span>
                            </div>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:2}}>
                            <span style={{color:t.sub}}>= Net Payable</span>
                            <span style={{color:t.text,fontWeight:700}}>{inr(netAmt)}</span>
                          </div>
                        </>}
                        {collected>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:2}}>
                          <span style={{color:"#10b981"}}>− Collected</span>
                          <span style={{color:"#10b981",fontWeight:700}}>{inr(collected)}</span>
                        </div>}
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,fontWeight:800,borderTop:`1.5px solid ${t.border}`,paddingTop:4,marginTop:2}}>
                          <span style={{color:balanceDue===0?"#10b981":"#f59e0b"}}>{balanceDue===0?"✓ Settled":"Balance Due"}</span>
                          <span style={{color:balanceDue===0?"#10b981":"#f59e0b"}}>{inr(balanceDue)}</span>
                        </div>
                      </div>}
                    </>;
                  })()}
                  {!canSeePrices&&d.replacement?.done&&<div style={{background:"#f9731615",borderRadius:8,padding:"5px 8px",marginTop:6,border:"1px solid #f9731625"}}>
                    <p style={{color:"#f97316",fontSize:11,fontWeight:700}}>🔄 Replacement: {d.replacement.item||"—"}{d.replacement.qty?` (${d.replacement.qty})`:""}</p>
                    {d.replacement.reason&&<p style={{color:t.sub,fontSize:10}}>{d.replacement.reason}</p>}
                  </div>}
                  {d.notes&&<p style={{color:t.sub,fontSize:11,fontStyle:"italic",marginTop:4}}>"{d.notes}"</p>}
                </div>;
              })
            }

            {/* ── REPLACEMENT LOG ── */}
            {cRepls.length>0&&<>
              <Hr dm={dm}/>
              <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>🔄 Replacement Log ({cRepls.length})</p>
              {cRepls.map(d=>(
                <div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:`1px solid ${t.border}`}}>
                  <div>
                    <p style={{color:t.text,fontSize:12,fontWeight:600}}>{d.date} — {d.replacement?.item||"—"}{d.replacement?.qty?` (${d.replacement.qty})`:""}</p>
                    {d.replacement?.reason&&<p style={{color:t.sub,fontSize:11}}>{d.replacement.reason}</p>}
                  </div>
                  {canSeePrices&&d.replacement?.amount&&<span style={{color:"#f97316",fontWeight:700,fontSize:12}}>−{inr(d.replacement.amount)}</span>}
                </div>
              ))}
              {canSeePrices&&totalReplAmt>0&&<div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",marginTop:2}}>
                <span style={{color:t.sub,fontWeight:700,fontSize:12}}>Total Deducted</span>
                <span style={{color:"#f97316",fontWeight:800,fontSize:13}}>−{inr(totalReplAmt)}</span>
              </div>}
            </>}

            {/* ── ACTION BUTTONS ── */}
            <Hr dm={dm}/>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {cv.address&&<a href={mapU(cv.address,cv.lat,cv.lng)} target="_blank" rel="noopener noreferrer" style={{flex:"1 1 auto",minWidth:80}}>
                <Btn dm={dm} v="outline" className="w-full">📍 Maps</Btn>
              </a>}
              <div style={{flex:"1 1 auto",minWidth:80}}>
                <Btn dm={dm} v="purple" className="w-full" onClick={()=>exportPDF(cv,products,"customer",settings,deliveries)}>📄 PDF</Btn>
              </div>
              <div style={{flex:"1 1 auto",minWidth:80}}>
                <Btn dm={dm} v="sky" className="w-full" onClick={()=>{
                  const cD=deliveries.filter(d=>d.customerId===cv.id).sort((a,b)=>b.date.localeCompare(a.date));
                  const enriched=cD.map(d=>{
                    const items=Object.entries(safeO(d.orderLines)).filter(([,l])=>l.qty>0).map(([pid,l])=>{const p=products.find(x=>x.id===pid);return `${l.qty}x ${p?p.name:(l.name||pid)}`;}).join("; ");
                    return {...d,_items:items,_total:lineTotal(d.orderLines),_replItem:d.replacement?.done?(d.replacement.item||""):"",_replQty:d.replacement?.done?(d.replacement.qty||""):"",_replAmt:d.replacement?.done?(+d.replacement.amount||0):0,_replReason:d.replacement?.done?(d.replacement.reason||""):"",_notes:d.notes||""};
                  });
                  exportTabExcel(cv.name.replace(/[^a-zA-Z0-9 ]/g," ").slice(0,28)+" Deliveries",enriched,[
                    {label:"Date",key:"date"},{label:"Status",key:"status"},{label:"Items Ordered",key:"_items"},{label:"Order Total (Rs)",key:"_total",num:true},
                    {label:"Replacement Item",key:"_replItem"},{label:"Repl. Qty",key:"_replQty"},{label:"Repl. Amount Deducted (Rs)",key:"_replAmt",num:true},{label:"Repl. Reason",key:"_replReason"},
                    {label:"Created By",key:"createdBy"},{label:"Notes",key:"_notes"}
                  ],settings);
                }}>📊 XLS</Btn>
              </div>
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
          <div>
            <div className="flex items-center justify-between mb-1">
              <label style={{color:t.sub}} className="text-[11px] font-bold uppercase tracking-widest ml-0.5">Order Date</label>
              {dSh==="add"&&(()=>{
                // _dateMode: "today" | "past" | "future"
                const mode = dF._dateMode || "today";
                const modes = [
                  {key:"today",  label:"Today",   color:"#10b981"},
                  {key:"past",   label:"📅 Past",  color:"#8b5cf6"},
                  {key:"future", label:"Future",   color:"#f59e0b"},
                ];
                return (
                  <div style={{display:"flex",gap:2,background:t.inp,borderRadius:8,padding:2,border:`1px solid ${t.border}`}}>
                    {modes.map(m=>(
                      <button key={m.key} onClick={()=>{
                        const next = m.key;
                        setDf(f=>({...f,_dateMode:next,_futureOrder:next==="future",date:next==="today"?today():f.date}));
                      }}
                        style={{fontSize:9,fontWeight:700,cursor:"pointer",borderRadius:6,padding:"2px 6px",border:"none",
                          background:mode===m.key?m.color+"22":"transparent",
                          color:mode===m.key?m.color:t.sub,
                          transition:"all 0.15s",WebkitTapHighlightColor:"transparent"}}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
            {(dSh!=="add"||(dF._dateMode==="past"||dF._dateMode==="future"||dF._futureOrder))
              ?<input type="date"
                  value={dF.date}
                  max={dF._dateMode==="past"||(!dF._dateMode&&!dF._futureOrder) ? today() : undefined}
                  onChange={e=>setDf({...dF,date:e.target.value})}
                  style={{background:t.inp,border:`1px solid ${dF._dateMode==="past"?"#8b5cf680":dF._dateMode==="future"||dF._futureOrder?"#f59e0b80":t.inpB}`,color:t.text,borderRadius:12,padding:"10px 14px",fontSize:14,width:"100%",outline:"none"}}/>
              :<div style={{background:t.inp,border:`1px solid ${t.inpB}`,borderRadius:12,padding:"10px 14px",fontSize:13,color:t.sub}}>Today ({today()})</div>
            }
            {dSh==="add"&&dF._dateMode==="past"&&<p style={{color:"#8b5cf6",fontSize:10,marginTop:4,fontWeight:600}}>📅 Logging a past order — pick the actual date it happened</p>}
            {dSh==="add"&&(dF._dateMode==="future"||dF._futureOrder)&&<p style={{color:"#f59e0b",fontSize:10,marginTop:4,fontWeight:600}}>⏳ Future order — will appear as scheduled</p>}
          </div>
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
        <Hr dm={dm}/>
        {/* PARTIAL PAYMENT SECTION */}
        {canSeePrices&&<div style={{background:dF.partialPayment?.enabled?(dm?"rgba(16,185,129,0.08)":"#f0fdf4"):(dm?"rgba(255,255,255,0.03)":"#fafaf8"),border:`1.5px solid ${dF.partialPayment?.enabled?"#10b981":t.border}`,borderRadius:14,padding:"12px 14px"}}>
          <div className="flex items-center justify-between mb-1">
            <div>
              <p style={{color:dF.partialPayment?.enabled?"#10b981":t.text,fontWeight:700,fontSize:13}}>💰 Collect Partial Payment</p>
              <p style={{color:t.sub,fontSize:11,marginTop:1}}>Agent collects cash on delivery — flows into all reports</p>
            </div>
            <button onClick={()=>setDf(f=>({...f,partialPayment:{...f.partialPayment,enabled:!f.partialPayment?.enabled}}))}
              style={{width:40,height:22,borderRadius:99,background:dF.partialPayment?.enabled?"#10b981":t.border,padding:2,display:"flex",alignItems:"center",justifyContent:dF.partialPayment?.enabled?"flex-end":"flex-start",transition:"all 0.2s",flexShrink:0,border:"none",cursor:"pointer"}}>
              <div style={{width:18,height:18,borderRadius:99,background:"#fff",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
            </button>
          </div>
          {dF.partialPayment?.enabled&&<>
            <Inp dm={dm} label="Amount Collected (₹)" type="number" value={dF.partialPayment?.amount||""} onChange={e=>setDf(f=>({...f,partialPayment:{...f.partialPayment,amount:e.target.value}}))} placeholder="e.g. 200"/>
            {(+dF.partialPayment?.amount)>0&&(()=>{
              const tot=lineTotal(dF.orderLines);
              const remaining=tot-(+dF.partialPayment.amount);
              return <div style={{background:"#10b98115",border:"1px solid #10b98130",borderRadius:10,padding:"8px 12px",marginTop:4}}>
                <div className="flex justify-between text-xs"><span style={{color:t.sub}}>Order Total</span><span style={{color:t.text,fontWeight:700}}>{inr(tot)}</span></div>
                <div className="flex justify-between text-xs mt-1"><span style={{color:"#10b981"}}>Collected Now</span><span style={{color:"#10b981",fontWeight:700}}>−{inr(+dF.partialPayment.amount)}</span></div>
                <div className="flex justify-between text-xs mt-1 pt-1" style={{borderTop:`1px solid #10b98130`}}><span style={{color:t.sub,fontWeight:700}}>Still Due</span><span style={{color:remaining>0?"#f59e0b":"#10b981",fontWeight:800}}>{inr(Math.max(0,remaining))}</span></div>
              </div>;
            })()}
          </>}
        </div>}
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
              const icons={"Dashboard":"📊","Customers":"👥","Deliveries":"🚚","Supplies":"📦","Expenses":"💸","Wastage":"🗑️","P&L":"📈","Analytics":"🔍","Production":"🏭",};
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
          <div className="flex gap-2"><Btn dm={dm} v="ghost" className="flex-1" onClick={()=>{setPaySh(null);setPayAmt("");}}>Cancel</Btn><Btn dm={dm} v="success" className="flex-1" onClick={recPay} disabled={!payAmt}>Confirm ₹{payAmt||0}</Btn></div>
        </>}
      </Sheet>

      {/* ── PAYMENT LEDGER MANUAL ENTRY SHEET ── */}
      <Sheet dm={dm} open={payLedgerSh} onClose={()=>{setPayLedgerSh(false);setPayLedgerCust(null);setPayLedgerAmt("");setPayLedgerNote("");setPayLedgerMethod("Cash");}} title="💰 Record Payment">
        <p style={{color:t.sub,fontSize:12}}>Log a manual payment from a customer. This will update their balance and appear in the full payment ledger.</p>
        {/* Customer picker */}
        <Sel dm={dm} label="Customer *" value={payLedgerCust?.id||""} onChange={e=>{const c=customers.find(x=>x.id===e.target.value);setPayLedgerCust(c||null);if(c)setPayLedgerAmt(String(c.pending||""));}}>
          <option value="">— Select customer —</option>
          {customers.filter(c=>c.active).map(c=><option key={c.id} value={c.id}>{c.name}{c.pending>0?` (Due: ${inr(c.pending)})`:""}</option>)}
        </Sel>
        {payLedgerCust&&<div style={{background:t.inp,borderRadius:12,padding:"10px 14px"}}>
          <div className="flex gap-3 flex-wrap">
            <span style={{color:"#10b981",fontSize:12,fontWeight:700}}>✓ Paid: {inr(payLedgerCust.paid||0)}</span>
            <span style={{color:"#ef4444",fontSize:12,fontWeight:700}}>⏳ Due: {inr(payLedgerCust.pending||0)}</span>
          </div>
        </div>}
        {/* Amount + quick select */}
        {payLedgerCust&&(payLedgerCust.pending||0)>0&&<div className="flex gap-2 flex-wrap">
          {[payLedgerCust.pending,500,1000,2000].filter((v,i,a)=>v>0&&a.indexOf(v)===i).slice(0,4).map(q=>(
            <button key={q} onClick={()=>setPayLedgerAmt(String(q))} style={{background:payLedgerAmt===String(q)?"#10b981":t.inp,color:payLedgerAmt===String(q)?"#fff":t.text,border:`1px solid ${payLedgerAmt===String(q)?"#10b981":t.border}`,borderRadius:10,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer",WebkitTapHighlightColor:"transparent"}}>
              {inr(q)}{q===payLedgerCust.pending?" (Full)":""}
            </button>
          ))}
        </div>}
        <Inp dm={dm} label="Amount (₹) *" type="number" value={payLedgerAmt} onChange={e=>setPayLedgerAmt(e.target.value)} placeholder="Enter amount received"/>
        <Sel dm={dm} label="Payment Method" value={payLedgerMethod} onChange={e=>setPayLedgerMethod(e.target.value)}>
          {["Cash","UPI","Bank Transfer","Cheque","Other"].map(m=><option key={m}>{m}</option>)}
        </Sel>
        <Inp dm={dm} label="Note / Reference" value={payLedgerNote} onChange={e=>setPayLedgerNote(e.target.value)} placeholder="e.g. UPI ref #12345, bank transfer, paid in cash…"/>
        <div className="flex gap-2">
          <Btn dm={dm} v="ghost" className="flex-1" onClick={()=>{setPayLedgerSh(false);setPayLedgerCust(null);setPayLedgerAmt("");setPayLedgerNote("");setPayLedgerMethod("Cash");}}>Cancel</Btn>
          <Btn dm={dm} v="success" className="flex-1" onClick={()=>{
            if(!payLedgerCust){notify("Select a customer");return;}
            const amt=+payLedgerAmt;
            if(!amt||amt<=0){notify("Enter a valid amount");return;}
            recordPaymentLedger(payLedgerCust.id,payLedgerCust.name,amt,payLedgerNote,payLedgerMethod);
            setPayLedgerSh(false);setPayLedgerCust(null);setPayLedgerAmt("");setPayLedgerNote("");setPayLedgerMethod("Cash");
          }}>Confirm {payLedgerAmt?inr(+payLedgerAmt):""}</Btn>
        </div>
      </Sheet>


      {/* Production Sheet */}
      <Sheet dm={dm} open={!!ptSh} onClose={()=>setPtSh(null)} title={ptSh==="add"?"Log New Batch":"Edit Batch"}>
        {/* ── Batch Identity Header ── */}
        <div style={{background:dm?"rgba(139,92,246,0.18)":"rgba(139,92,246,0.1)",border:"1.5px solid rgba(139,92,246,0.4)",borderRadius:14,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <div>
            <p style={{color:"#8b5cf6",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Batch ID</p>
            <p style={{color:T(dm).text,fontWeight:900,fontSize:20,lineHeight:1}}>{ptF.batchLabel||"Batch —"}</p>
          </div>
          <div style={{background:"#8b5cf6",color:"#fff",borderRadius:10,padding:"6px 14px",fontSize:13,fontWeight:800,letterSpacing:"0.02em"}}>{ptF.batchLabel||"—"}</div>
        </div>
        <Inp dm={dm} label="Batch Label" value={ptF.batchLabel||""} onChange={e=>setPtF({...ptF,batchLabel:e.target.value})} placeholder="e.g. Batch 1, Morning Run A…"/>
        <Inp dm={dm} label="Date" type="date" value={ptF.date||today()} onChange={e=>setPtF({...ptF,date:e.target.value})}/>
        <Sel dm={dm} label="Product *" value={ptF.product} onChange={e=>setPtF({...ptF,product:e.target.value})}>
          {products.map(p=><option key={p.id}>{p.name}</option>)}
          <option value="__custom__">Other / Custom</option>
        </Sel>
        {ptF.product==="__custom__"&&<Inp dm={dm} label="Custom Product Name" value={ptF.customProduct||""} onChange={e=>setPtF({...ptF,customProduct:e.target.value})} placeholder="e.g. Special Paratha"/>}
        <Sel dm={dm} label="Shift (optional)" value={ptF.shift||""} onChange={e=>setPtF({...ptF,shift:e.target.value})}>
          <option value="">— No Shift —</option>
          {(settings?.shifts||["Morning","Afternoon","Evening","Night"]).map(s=><option key={s}>{s}</option>)}
        </Sel>
        <div className="grid grid-cols-2 gap-3">
          <Inp dm={dm} label="Actual (units)" type="number" value={ptF.actual} onChange={e=>setPtF({...ptF,actual:e.target.value})} placeholder="Fill after shift"/>
          <Sel dm={dm} label="QC Grade" value={ptF.qcGrade||"A"} onChange={e=>setPtF({...ptF,qcGrade:e.target.value})}>
            <option value="A">A — Pass</option>
            <option value="B">B — Pass</option>
            <option value="C">C — Marginal</option>
            <option value="F">F — Fail</option>
          </Sel>
        </div>
        <Inp dm={dm} label="Notes" value={ptF.notes} onChange={e=>setPtF({...ptF,notes:e.target.value})} placeholder="e.g. Machine issue, short staff…"/>
        {ptAutoDeduct&&+ptF.actual>0&&(()=>{
          const pname=(ptF.product==="__custom__"?ptF.customProduct:ptF.product)||"";
          const pn=pname.toLowerCase();
          const scored=supplies.map(s=>{const sn=(s.item||"").toLowerCase();let score=0;if(sn===pn)score=100;else if(sn.includes(pn)||pn.includes(sn))score=60;else{const pW=pn.split(/\s+/);const sW=sn.split(/\s+/);const h=pW.filter(w=>sW.some(sw=>sw.includes(w)||w.includes(sw)));if(h.length>0)score=30+h.length*10;}return{...s,_score:score};}).filter(s=>s._score>0).sort((a,b)=>b._score-a._score);
          const match=scored[0];
          if(!match)return null;
          const afterQty=Math.max(0,(match.qty||0)-+ptF.actual);
          return <div style={{background:"#10b98110",border:"1px solid #10b98130",borderRadius:10,padding:"8px 12px"}}>
            <p style={{color:"#10b981",fontSize:11,fontWeight:700}}>📦 Auto-deduct: {+ptF.actual} from "{match.item}" → {afterQty} {match.unit} remaining</p>
          </div>;
        })()}

        {/* ── Embedded Wastage Section ── */}
        <div style={{borderTop:`1.5px solid ${T(dm).border}`,paddingTop:16,marginTop:4}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div>
              <p style={{color:T(dm).text,fontWeight:800,fontSize:13}}>🗑️ Wastage</p>
              <p style={{color:T(dm).sub,fontSize:10}}>Log wastage for this batch</p>
            </div>
            <button onClick={()=>setPtF(f=>({...f,embWastage:[...(f.embWastage||[]),{id:uid(),product:f.product==="__custom__"?(f.customProduct||""):f.product,qty:"",unit:"pcs",type:(settings?.wastageTypes||["Other"])[0],reason:"",cost:"",shift:f.shift||"",date:f.date||today(),loggedBy:sess?.name||displayName}]}))}
              style={{background:"#f9731620",color:"#f97316",border:"1px solid #f9731640",borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>+ Add</button>
          </div>
          {(ptF.embWastage||[]).length===0&&<p style={{color:T(dm).sub,fontSize:11,textAlign:"center",padding:"8px 0"}}>No wastage entries for this batch.</p>}
          {(ptF.embWastage||[]).map((w,wi)=>(
            <div key={w.id||wi} style={{background:T(dm).inp,border:`1px solid ${T(dm).inpB}`,borderRadius:12,padding:"10px 12px",marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{color:T(dm).sub,fontSize:11,fontWeight:700}}>Entry {wi+1}</span>
                {isAdmin&&<button onClick={()=>setPtF(f=>({...f,embWastage:(f.embWastage||[]).filter((_,i)=>i!==wi)}))} style={{background:"#dc262615",color:"#dc2626",border:"none",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700,cursor:"pointer"}}>Remove</button>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Inp dm={dm} label="Product" value={w.product} onChange={e=>setPtF(f=>({...f,embWastage:(f.embWastage||[]).map((x,i)=>i===wi?{...x,product:e.target.value}:x)}))} placeholder="Product name"/>
                <div className="grid grid-cols-2 gap-1">
                  <Inp dm={dm} label="Qty" type="number" value={w.qty} onChange={e=>setPtF(f=>({...f,embWastage:(f.embWastage||[]).map((x,i)=>i===wi?{...x,qty:e.target.value}:x)}))} placeholder="0"/>
                  <Sel dm={dm} label="Unit" value={w.unit} onChange={e=>setPtF(f=>({...f,embWastage:(f.embWastage||[]).map((x,i)=>i===wi?{...x,unit:e.target.value}:x)}))}>
                    {(settings?.supplyUnits||["pcs","kg","g","L","mL","bags","boxes","dozen"]).map(u=><option key={u}>{u}</option>)}
                  </Sel>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Sel dm={dm} label="Type" value={w.type} onChange={e=>setPtF(f=>({...f,embWastage:(f.embWastage||[]).map((x,i)=>i===wi?{...x,type:e.target.value}:x)}))}>
                  {(settings?.wastageTypes||["Burnt","Broken","Expired","Overproduced","Quality Reject","Other"]).map(t2=><option key={t2}>{t2}</option>)}
                </Sel>
                {can("waste_logCost")&&<Inp dm={dm} label="Cost (₹)" type="number" value={w.cost||""} onChange={e=>setPtF(f=>({...f,embWastage:(f.embWastage||[]).map((x,i)=>i===wi?{...x,cost:e.target.value}:x)}))} placeholder="0"/>}
              </div>
              <Inp dm={dm} label="Reason" value={w.reason||""} onChange={e=>setPtF(f=>({...f,embWastage:(f.embWastage||[]).map((x,i)=>i===wi?{...x,reason:e.target.value}:x)}))} placeholder="e.g. Overcooked, dropped…"/>
            </div>
          ))}
        </div>

        {/* ── Embedded QC Section ── */}
        <div style={{borderTop:`1.5px solid ${T(dm).border}`,paddingTop:16,marginTop:4}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div>
              <p style={{color:T(dm).text,fontWeight:800,fontSize:13}}>✅ QC Checks</p>
              <p style={{color:T(dm).sub,fontSize:10}}>Quality checks for this batch</p>
            </div>
            <button onClick={()=>setPtF(f=>({...f,embQC:[...(f.embQC||[]),{id:uid(),product:f.product==="__custom__"?(f.customProduct||""):f.product,grade:"A",checker:sess?.name||displayName,notes:"",shift:f.shift||"",date:f.date||today()}]}))}
              style={{background:"#14b8a620",color:"#14b8a6",border:"1px solid #14b8a640",borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>+ Add</button>
          </div>
          {(ptF.embQC||[]).length===0&&<p style={{color:T(dm).sub,fontSize:11,textAlign:"center",padding:"8px 0"}}>No QC entries for this batch.</p>}
          {(ptF.embQC||[]).map((q,qi)=>(
            <div key={q.id||qi} style={{background:T(dm).inp,border:`1px solid ${T(dm).inpB}`,borderRadius:12,padding:"10px 12px",marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{color:T(dm).sub,fontSize:11,fontWeight:700}}>QC Check {qi+1}</span>
                {isAdmin&&<button onClick={()=>setPtF(f=>({...f,embQC:(f.embQC||[]).filter((_,i)=>i!==qi)}))} style={{background:"#dc262615",color:"#dc2626",border:"none",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700,cursor:"pointer"}}>Remove</button>}
              </div>
              <Inp dm={dm} label="Product" value={q.product} onChange={e=>setPtF(f=>({...f,embQC:(f.embQC||[]).map((x,i)=>i===qi?{...x,product:e.target.value}:x)}))} placeholder="Product name"/>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {[{g:"A",color:"#10b981"},{g:"B",color:"#f59e0b"},{g:"C",color:"#f97316"},{g:"F",color:"#ef4444"}].map(({g,color})=>(
                  <button key={g} onClick={()=>setPtF(f=>({...f,embQC:(f.embQC||[]).map((x,i)=>i===qi?{...x,grade:g}:x)}))}
                    style={{background:q.grade===g?color+"25":T(dm).card,border:`2px solid ${q.grade===g?color:T(dm).inpB}`,borderRadius:10,padding:"8px 4px",textAlign:"center",cursor:"pointer",transition:"all 0.15s"}}>
                    <p style={{color,fontWeight:900,fontSize:18,lineHeight:1}}>{g}</p>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Inp dm={dm} label="Checker" value={q.checker||""} onChange={e=>setPtF(f=>({...f,embQC:(f.embQC||[]).map((x,i)=>i===qi?{...x,checker:e.target.value}:x)}))} placeholder="Inspector"/>
                <Inp dm={dm} label="Notes" value={q.notes||""} onChange={e=>setPtF(f=>({...f,embQC:(f.embQC||[]).map((x,i)=>i===qi?{...x,notes:e.target.value}:x)}))} placeholder="Observations…"/>
              </div>
            </div>
          ))}
        </div>

        {/* ── Embedded Handover Section ── */}
        <div style={{borderTop:`1.5px solid ${T(dm).border}`,paddingTop:16,marginTop:4}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div>
              <p style={{color:T(dm).text,fontWeight:800,fontSize:13}}>📋 Handovers</p>
              <p style={{color:T(dm).sub,fontSize:10}}>Shift handover notes for this batch</p>
            </div>
            {can("prod_handover")&&<button onClick={()=>setPtF(f=>({...f,embHandover:[...(f.embHandover||[]),{id:uid(),shift:f.shift||"",nextShift:"",note:"",issues:"",loggedBy:sess?.name||displayName,date:f.date||today()}]}))}
              style={{background:"#6366f120",color:"#6366f1",border:"1px solid #6366f140",borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>+ Add</button>}
          </div>
          {(ptF.embHandover||[]).length===0&&<p style={{color:T(dm).sub,fontSize:11,textAlign:"center",padding:"8px 0"}}>No handover notes for this batch.</p>}
          {(ptF.embHandover||[]).map((h,hi)=>(
            <div key={h.id||hi} style={{background:T(dm).inp,border:`1px solid ${T(dm).inpB}`,borderRadius:12,padding:"10px 12px",marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{color:T(dm).sub,fontSize:11,fontWeight:700}}>Handover {hi+1}</span>
                {isAdmin&&<button onClick={()=>setPtF(f=>({...f,embHandover:(f.embHandover||[]).filter((_,i)=>i!==hi)}))} style={{background:"#dc262615",color:"#dc2626",border:"none",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700,cursor:"pointer"}}>Remove</button>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Sel dm={dm} label="Current Shift" value={h.shift||""} onChange={e=>setPtF(f=>({...f,embHandover:(f.embHandover||[]).map((x,i)=>i===hi?{...x,shift:e.target.value}:x)}))}>
                  <option value="">—</option>
                  {(settings?.shifts||["Morning","Afternoon","Evening","Night"]).map(s=><option key={s}>{s}</option>)}
                </Sel>
                <Sel dm={dm} label="Next Shift" value={h.nextShift||""} onChange={e=>setPtF(f=>({...f,embHandover:(f.embHandover||[]).map((x,i)=>i===hi?{...x,nextShift:e.target.value}:x)}))}>
                  <option value="">—</option>
                  {(settings?.shifts||["Morning","Afternoon","Evening","Night"]).map(s=><option key={s}>{s}</option>)}
                </Sel>
              </div>
              <Inp dm={dm} label="Handover Note *" value={h.note||""} onChange={e=>setPtF(f=>({...f,embHandover:(f.embHandover||[]).map((x,i)=>i===hi?{...x,note:e.target.value}:x)}))} placeholder="e.g. Machine needs servicing, batch came out well…"/>
              <Inp dm={dm} label="Issues / Flags" value={h.issues||""} onChange={e=>setPtF(f=>({...f,embHandover:(f.embHandover||[]).map((x,i)=>i===hi?{...x,issues:e.target.value}:x)}))} placeholder="e.g. Low gas, 2 staff absent…"/>
              <Inp dm={dm} label="Logged By" value={h.loggedBy||""} onChange={e=>setPtF(f=>({...f,embHandover:(f.embHandover||[]).map((x,i)=>i===hi?{...x,loggedBy:e.target.value}:x)}))} placeholder="Name"/>
            </div>
          ))}
        </div>

        <Btn dm={dm} onClick={savePT} className="w-full" style={{marginTop:8}}>💾 Save Batch</Btn>
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

      {/* ═══════════════════════════════════════════════════════════════
          BULK ORDER ENTRY SHEET
      ═══════════════════════════════════════════════════════════════ */}
      {/* ══════════════════════════════════════════════════════════════
          PROFESSIONAL COLLECT PAYMENT SHEET
      ══════════════════════════════════════════════════════════════ */}
      <Sheet dm={dm} open={!!collectSh} onClose={()=>{setCollectSh(null);setCollectAmt("");setCollectNote("");}} title="💰 Record Collection">
        {collectSh&&(()=>{
          const d=collectSh;
          const orderTotal=lineTotal(d.orderLines||{});
          const replAmt=+(d.replacement?.amount)||0;
          const netAmt=orderTotal-replAmt;
          const suggestedAmt=netAmt>0?netAmt:orderTotal;
          return <>
            {/* Customer info strip */}
            <div style={{background:t.inp,borderRadius:14,padding:"12px 14px"}}>
              <p style={{color:t.text,fontWeight:800,fontSize:15,lineHeight:1.2}}>{d.customer}</p>
              {d.address&&<p style={{color:t.sub,fontSize:11,marginTop:3}}>📍 {d.address}</p>}
              <div className="flex gap-2 mt-2 flex-wrap">
                <span style={{background:"#f59e0b20",color:"#f59e0b",borderRadius:6,padding:"2px 9px",fontSize:10,fontWeight:700}}>📅 {d.date}</span>
                <span style={{background:d.status==="Delivered"?"#10b98120":d.status==="In Transit"?"#3b82f620":"#f59e0b20",color:d.status==="Delivered"?"#10b981":d.status==="In Transit"?"#3b82f6":"#f59e0b",borderRadius:6,padding:"2px 9px",fontSize:10,fontWeight:700}}>{d.status}</span>
              </div>
            </div>

            {/* Order breakdown */}
            {canSeePrices&&<div style={{background:t.inp,borderRadius:14,padding:"12px 14px"}}>
              <p style={{color:t.sub,fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Order Breakdown</p>
              {lineRows(d.orderLines||{},products).filter(r=>r.qty>0).map(r=>(
                <div key={r.id} className="flex justify-between text-xs py-1" style={{borderBottom:`1px solid ${t.border}`}}>
                  <span style={{color:t.sub,flex:1}}>{r.qty} × {r.name} @ {inr(r.priceAmount)}</span>
                  <span style={{color:t.text,fontWeight:700}}>{inr(r.qty*r.priceAmount)}</span>
                </div>
              ))}
              <div className="flex justify-between mt-2" style={{fontSize:13,fontWeight:700}}>
                <span style={{color:t.sub}}>Order Total</span>
                <span style={{color:"#f59e0b"}}>{inr(orderTotal)}</span>
              </div>
              {replAmt>0&&<>
                <div className="flex justify-between mt-1" style={{fontSize:12,color:"#f97316"}}>
                  <span>🔄 Replacement deduction ({d.replacement?.item||"—"})</span>
                  <span style={{fontWeight:700}}>−{inr(replAmt)}</span>
                </div>
                <div className="flex justify-between mt-1 pt-1" style={{borderTop:`2px solid ${t.border}`,fontSize:13,fontWeight:800}}>
                  <span style={{color:t.text}}>Net Payable</span>
                  <span style={{color:"#10b981"}}>{inr(netAmt)}</span>
                </div>
              </>}
            </div>}

            {/* Quick amount selector */}
            {canSeePrices&&<div>
              <p style={{color:t.sub,fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Quick Select</p>
              <div className="flex gap-2 flex-wrap">
                {[suggestedAmt,...[500,1000,2000].filter(v=>v!==suggestedAmt&&v>0)].filter((v,i,a)=>a.indexOf(v)===i&&v>0).slice(0,4).map(q=>(
                  <button key={q} onClick={()=>setCollectAmt(String(q))}
                    style={{background:collectAmt===String(q)?"#10b981":t.inp,color:collectAmt===String(q)?"#fff":t.text,border:`1.5px solid ${collectAmt===String(q)?"#10b981":t.border}`,borderRadius:10,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",transition:"all 0.15s",WebkitTapHighlightColor:"transparent"}}>
                    {inr(q)}{q===suggestedAmt?" (Full)":""}
                  </button>
                ))}
              </div>
            </div>}

            {/* Amount input */}
            <Inp dm={dm} label="Amount Collected (₹) *" type="number" value={collectAmt} onChange={e=>setCollectAmt(e.target.value)} placeholder="Enter exact amount received"/>

            {/* Live balance preview */}
            {canSeePrices&&collectAmt&&+collectAmt>0&&<div style={{background:+collectAmt>=(netAmt||orderTotal)?"#10b98115":"#f59e0b15",border:`1px solid ${+collectAmt>=(netAmt||orderTotal)?"#10b98140":"#f59e0b40"}`,borderRadius:12,padding:"10px 14px"}}>
              <div className="flex justify-between text-sm"><span style={{color:t.sub}}>Collecting now</span><span style={{color:"#10b981",fontWeight:700}}>{inr(+collectAmt)}</span></div>
              <div className="flex justify-between text-sm mt-1"><span style={{color:t.sub}}>Balance remaining</span><span style={{color:Math.max(0,(netAmt||orderTotal)-+collectAmt)>0?"#f59e0b":"#10b981",fontWeight:700}}>{inr(Math.max(0,(netAmt||orderTotal)-+collectAmt))}</span></div>
              {+collectAmt>=(netAmt||orderTotal)&&<p style={{color:"#10b981",fontSize:11,marginTop:4,fontWeight:600}}>✓ Full amount — account will be settled</p>}
            </div>}

            {/* Note field (admin can make required) */}
            {(settings?.agentCollectRequireNote||true)&&<Inp dm={dm} label={`Collection Note${settings?.agentCollectRequireNote?" *":""}`} value={collectNote} onChange={e=>setCollectNote(e.target.value)} placeholder="e.g. Paid in cash at gate, UPI ref #12345…"/>}

            <div className="flex gap-2">
              <Btn dm={dm} v="ghost" className="flex-1" onClick={()=>{setCollectSh(null);setCollectAmt("");setCollectNote("");}}>Cancel</Btn>
              <Btn dm={dm} v="success" className="flex-1" onClick={()=>{
                const amt=+collectAmt;
                if(!amt||amt<=0){notify("Enter a valid amount");return;}
                if(settings?.agentCollectRequireNote&&!collectNote.trim()){notify("Collection note is required");return;}
                const upd={...d,partialPayment:{enabled:true,amount:amt,note:collectNote,collectedBy:displayName,collectedAt:ts()}};
                setDeliv(p=>p.map(x=>x.id===d.id?upd:x));
                if(d.customerId){setCust(p=>p.map(c=>c.id===d.customerId?{...c,paid:(c.paid||0)+amt,pending:Math.max(0,(c.pending||0)-amt)}:c));}
                addLog("Payment collected on delivery",`${d.customer} — ${inr(amt)}${collectNote?" · "+collectNote:""}`);
                addNotif("Payment Collected",`${inr(amt)} collected from ${d.customer}`,"success","payment");
                notify(`${inr(amt)} collected ✓`);
                // Show inline receipt card on phone
                setLastReceiptData({delivery:upd,amt,note:collectNote,customer:d.customer,ts:ts()});
                // Auto-print receipt only if admin has it enabled
                if(settings?.agentInvoiceEnabled!==false&&settings?.agentAutoReceipt!==false) exportDeliveryReceipt(upd,products,settings,getOrCreateInvNo(upd.id));
                setCollectSh(null);setCollectAmt("");setCollectNote("");
              }}>Confirm Collection</Btn>
            </div>
          </>;
        })()}
      </Sheet>

      {/* ── INLINE RECEIPT CARD — tap 🧾 Receipt button OR shown after collection ── */}
      <Sheet dm={dm} open={!!lastReceiptData} onClose={()=>setLastReceiptData(null)} title={lastReceiptData?.viewOnly?"🧾 Delivery Receipt":"✅ Collection Confirmed"}>
        {lastReceiptData&&(()=>{
          const {delivery:rd,amt,note,customer,ts:rts,viewOnly}=lastReceiptData;
          const orderTotal=lineTotal(rd.orderLines);
          const replAmt=+(rd.replacement?.amount||0);
          const netAmt=Math.max(0,orderTotal-replAmt);
          const collected=viewOnly?(+(rd.partialPayment?.amount||0)):amt;
          const balanceDue=Math.max(0,netAmt-collected);
          const rows=lineRows(rd.orderLines,products).filter(r=>r.qty>0);
          const statusColor=rd.status==="Delivered"?"#10b981":rd.status==="In Transit"?"#3b82f6":rd.status==="Cancelled"?"#ef4444":"#f59e0b";
          const showReceiptPrices=settings?.agentInvoiceShowPrices!==false; // syncs with admin setting
          const rcptInvNo=(invRegistry.issued||{})[rd.id];
          const rcptNo=rcptInvNo?`RCP-${rcptInvNo.replace("TAS-","")}`:`RCP-${(rd.id||"").slice(-8).toUpperCase()}`;
          return <>
            {/* Header banner */}
            {viewOnly
              ?<div style={{background:statusColor+"18",border:`1.5px solid ${statusColor}40`,borderRadius:16,padding:"12px 16px"}}>
                <div className="flex items-center justify-between">
                  <div>
                    <p style={{color:statusColor,fontWeight:900,fontSize:16}}>{rd.customer}</p>
                    <p style={{color:t.sub,fontSize:11,marginTop:3}}>📅 {rd.date}{rd.deliveryDate&&rd.deliveryDate!==rd.date?` · Deliver by: ${rd.deliveryDate}`:""}</p>
                    {rd.agent&&<p style={{color:t.sub,fontSize:11}}>👤 {rd.agent}</p>}
                    <p style={{color:t.sub,fontSize:10,marginTop:2,fontFamily:"monospace"}}>{rcptInvNo?`Invoice: ${rcptInvNo} · `:""}Receipt: {rcptNo}</p>
                  </div>
                  <span style={{background:statusColor+"22",color:statusColor,fontSize:11,fontWeight:700,padding:"4px 12px",borderRadius:99}}>{rd.status}</span>
                </div>
              </div>
              :<div style={{background:"#10b98120",border:"1.5px solid #10b98140",borderRadius:16,padding:"14px 16px",textAlign:"center"}}>
                <p style={{fontSize:32,lineHeight:1,marginBottom:6}}>✅</p>
                <p style={{color:"#10b981",fontWeight:900,fontSize:18}}>{inr(collected)} Collected</p>
                <p style={{color:t.sub,fontSize:12,marginTop:4}}>{customer} · {rts}</p>
              </div>
            }

            {/* Items */}
            {rows.length>0&&<div style={{background:t.inp,borderRadius:14,padding:"12px 14px"}}>
              <p style={{color:t.sub,fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Items Ordered</p>
              {rows.map(r=>(
                <div key={r.id} className="flex justify-between text-sm py-1" style={{borderBottom:`1px solid ${t.border}`}}>
                  <span style={{color:t.sub}}>{r.qty} × {r.name}</span>
                  {showReceiptPrices&&<span style={{color:t.text,fontWeight:600}}>{inr(r.qty*r.priceAmount)}</span>}
                </div>
              ))}
              {showReceiptPrices&&orderTotal>0&&<div className="flex justify-between text-sm mt-2 font-bold">
                <span style={{color:t.sub}}>Order Total</span>
                <span style={{color:t.text}}>{inr(orderTotal)}</span>
              </div>}
            </div>}

            {/* Replacement */}
            {rd.replacement?.done&&<div style={{background:"#f9731615",border:"1px solid #f9731630",borderRadius:12,padding:"10px 12px"}}>
              <p style={{color:"#f97316",fontWeight:700,fontSize:12}}>🔄 Replacement: {rd.replacement.item||"—"}{rd.replacement.qty?` (${rd.replacement.qty})`:""}</p>
              {rd.replacement.reason&&<p style={{color:t.sub,fontSize:11,marginTop:2}}>{rd.replacement.reason}</p>}
              {showReceiptPrices&&replAmt>0&&<p style={{color:"#f97316",fontWeight:700,fontSize:12,marginTop:4}}>Deducted: −{inr(replAmt)}</p>}
            </div>}

            {/* Payment summary */}
            {showReceiptPrices&&<div style={{background:t.inp,borderRadius:14,padding:"12px 14px"}}>
              <p style={{color:t.sub,fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Payment Summary</p>
              {orderTotal>0&&<div className="flex justify-between text-sm py-1"><span style={{color:t.sub}}>Order Total</span><span style={{color:t.text,fontWeight:600}}>{inr(orderTotal)}</span></div>}
              {replAmt>0&&<div className="flex justify-between text-sm py-1"><span style={{color:"#f97316"}}>🔄 Replacement</span><span style={{color:"#f97316",fontWeight:700}}>−{inr(replAmt)}</span></div>}
              {replAmt>0&&<div className="flex justify-between text-sm py-1"><span style={{color:t.sub}}>Net Payable</span><span style={{color:t.text,fontWeight:700}}>{inr(netAmt)}</span></div>}
              {collected>0&&<div className="flex justify-between text-sm py-1"><span style={{color:"#10b981"}}>✓ {viewOnly?"Collected":"Collected now"}</span><span style={{color:"#10b981",fontWeight:700}}>{inr(collected)}</span></div>}
              <div className="flex justify-between text-sm pt-2 font-bold" style={{borderTop:`2px solid ${t.border}`}}>
                <span style={{color:balanceDue===0?"#10b981":"#f59e0b"}}>{balanceDue===0?"✓ Fully Settled":"Balance Due"}</span>
                <span style={{color:balanceDue===0?"#10b981":"#f59e0b"}}>{inr(balanceDue)}</span>
              </div>
            </div>}

            {(note||(viewOnly&&rd.partialPayment?.note))&&<p style={{color:t.sub,fontSize:12,fontStyle:"italic",textAlign:"center"}}>📝 "{note||(rd.partialPayment?.note)}"</p>}

            <div className="flex gap-2 flex-wrap">
              <Btn dm={dm} v="ghost" className="flex-1" onClick={()=>setLastReceiptData(null)}>Close</Btn>
              {(isAdmin||(settings?.receiptPrintAllowed||["admin","agent"]).includes(sess?.role))&&<Btn dm={dm} v="sky" className="flex-1" onClick={()=>exportDeliveryReceipt(rd,products,settings,getOrCreateInvNo(rd.id))}>🧾 Receipt</Btn>}
              {isAdmin&&<Btn dm={dm} v="purple" className="flex-1" onClick={()=>exportDeliveryInvoice(rd,products,settings,getOrCreateInvNo(rd.id))}>📄 Invoice</Btn>}
            </div>
          </>;
        })()}
      </Sheet>

      <Sheet dm={dm} open={bulkOrderSh} onClose={()=>setBulkOrderSh(false)} title="📋 Bulk Order Entry">
        <p style={{color:t.sub}} className="text-xs">Create delivery orders for multiple customers at once. Toggle on the customers you want, optionally adjust quantities, then save all at once.</p>
        <div className="grid grid-cols-2 gap-3">
          <Inp dm={dm} label="Order Date *" type="date" value={bulkOrderDate} onChange={e=>setBulkOrderDate(e.target.value)}/>
          <Sel dm={dm} label="Status" value={bulkOrderStatus} onChange={e=>setBulkOrderStatus(e.target.value)}>
            {(settings?.deliveryStatuses||["Pending","In Transit","Delivered","Cancelled"]).map(s=><option key={s}>{s}</option>)}
          </Sel>
        </div>
        <div className="flex items-center justify-between">
          <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider">{bulkOrderRows.filter(r=>r.include).length} of {bulkOrderRows.length} selected</p>
          <div className="flex gap-2">
            <button onClick={()=>setBulkOrderRows(r=>r.map(x=>({...x,include:true})))} style={{color:"#f59e0b"}} className="text-xs font-semibold">All</button>
            <button onClick={()=>setBulkOrderRows(r=>r.map(x=>({...x,include:false})))} style={{color:t.sub}} className="text-xs font-semibold">None</button>
          </div>
        </div>
        <Hr dm={dm}/>
        <div className="flex flex-col gap-2" style={{maxHeight:360,overflowY:"auto"}}>
          {bulkOrderRows.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-4">No active customers found.</p>}
          {bulkOrderRows.map((row,ri)=>{
            const tot=lineTotal(row.orderLines);
            return <div key={row.customerId} style={{background:row.include?(dm?"rgba(245,158,11,0.08)":"rgba(245,158,11,0.04)"):t.inp,border:`1.5px solid ${row.include?"#f59e0b40":t.border}`,borderRadius:14,padding:"10px 12px",transition:"all 0.15s"}}>
              <div className="flex items-center justify-between mb-1 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Toggle checkbox */}
                  <button onClick={()=>setBulkOrderRows(rows=>rows.map((x,i)=>i===ri?{...x,include:!x.include}:x))}
                    style={{width:20,height:20,borderRadius:6,border:`2px solid ${row.include?"#f59e0b":t.inpB}`,background:row.include?"#f59e0b":t.card,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",transition:"all 0.15s"}}>
                    {row.include&&<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </button>
                  <div className="min-w-0">
                    <p style={{color:t.text,fontWeight:700,fontSize:13}} className="truncate">{row.customer}</p>
                    {row.address&&<p style={{color:t.sub,fontSize:10}} className="truncate">📍 {row.address}</p>}
                  </div>
                </div>
                {canSeePrices&&tot>0&&<span style={{color:"#f59e0b",fontWeight:800,fontSize:12}} className="shrink-0">{inr(tot)}</span>}
              </div>
              {/* Item qty inline editing */}
              {row.include&&<div className="flex flex-col gap-1 mt-2 pt-2" style={{borderTop:`1px solid ${t.border}`}}>
                {products.map(p=>{
                  const ol=safeO(row.orderLines);
                  const qty=(ol[p.id]?.qty)||0;
                  return <div key={p.id} className="flex items-center justify-between gap-2">
                    <span style={{color:t.sub,fontSize:12,flex:1}} className="truncate">{p.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={()=>setBulkOrderRows(rows=>rows.map((x,i)=>i===ri?{...x,orderLines:{...safeO(x.orderLines),[p.id]:{...(safeO(x.orderLines)[p.id]||{}),qty:Math.max(0,(safeO(x.orderLines)[p.id]?.qty||0)-1),priceAmount:safeO(x.orderLines)[p.id]?.priceAmount||(p.prices?.[0]||0)}}}:x))}
                        style={{width:24,height:24,borderRadius:6,background:t.card,border:`1px solid ${t.border}`,color:t.text,fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                      <span style={{color:t.text,fontWeight:700,fontSize:13,minWidth:20,textAlign:"center"}}>{qty}</span>
                      <button onClick={()=>setBulkOrderRows(rows=>rows.map((x,i)=>i===ri?{...x,orderLines:{...safeO(x.orderLines),[p.id]:{...(safeO(x.orderLines)[p.id]||{}),qty:(safeO(x.orderLines)[p.id]?.qty||0)+1,priceAmount:safeO(x.orderLines)[p.id]?.priceAmount||(p.prices?.[0]||0)}}}:x))}
                        style={{width:24,height:24,borderRadius:6,background:t.card,border:`1px solid ${t.border}`,color:t.text,fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                    </div>
                  </div>;
                })}
              </div>}
            </div>;
          })}
        </div>
        <Hr dm={dm}/>
        <div className="flex gap-2">
          <Btn dm={dm} v="ghost" className="flex-1" onClick={()=>setBulkOrderSh(false)}>Cancel</Btn>
          <Btn dm={dm} v="success" className="flex-1" onClick={saveBulkOrders}>
            ✓ Create {bulkOrderRows.filter(r=>r.include).length} Orders
          </Btn>
        </div>
      </Sheet>

      {/* ── UNIVERSAL DETAIL MODAL ── */}
      {detailModal&&<DetailModal
        modal={detailModal}
        invRegistry={invRegistry}
        onClose={closeDetail}
        dm={dm}
        customers={customers}
        deliveries={deliveries}
        expenses={expenses}
        supplies={supplies}
        wastage={wastage}
        products={products}
        settings={settings}
        setDetailModal={setDetailModal}
        setEsh={setEsh} setEf={setEf}
        setDsh={setDsh} setDf={setDf}
        delE={delE} delD={delD}
        setPaySh={setPaySh} setPayAmt={setPayAmt}
        isAdmin={isAdmin} sess={sess}
      />}
    </>
  );
}
