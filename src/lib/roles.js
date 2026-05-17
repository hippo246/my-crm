/* eslint-disable */

// ═══════════════════════════════════════════════════════════════
//  ROLE SYSTEM
// ═══════════════════════════════════════════════════════════════
const ALL_TABS = ["Dashboard","Customers","Deliveries","Payments","Supplies","Expenses","P&L","Analytics","Production","Ingredients","Staff","Machines","Vehicles","GPS","Settings"];
const ROLE_DEF = {
  admin:   ALL_TABS,
  factory: ["Dashboard","Customers","Deliveries","Supplies","Production","Ingredients","Staff","Machines"],
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

// Lazy monitor import — keeps roles.js side-effect free at module load time
let _monitor = null;
function _getMonitor(){ if(!_monitor) try{ _monitor = require("./monitor"); }catch{} return _monitor; }

function hasPerm(sess, key){
  if(!sess) return false;
  if(sess.role==="admin") return true;
  const fp = sess.finePerms || defaultFinePerms(sess.role);
  const allowed = fp[key] === true;
  if(!allowed){
    try{ _getMonitor()?.monitor?.permDenied(key,{uid:sess.id,role:sess.role,name:sess.name}); }catch{}
  }
  return allowed;
}

// ═══════════════════════════════════════════════════════════════
//  DEFAULT DATA

export { ALL_TABS, ROLE_DEF, FINE_PERM_DEFS, defaultFinePerms, hasPerm };
