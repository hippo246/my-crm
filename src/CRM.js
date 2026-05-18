/* eslint-disable react-hooks/exhaustive-deps, no-unused-vars, no-undef, react/jsx-no-undef, import/first, no-use-before-define */
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, Cell, ReferenceLine } from "recharts";
import { ProductionTab } from "./tabs/Production";
import DeliveriesTab from "./tabs/Deliveries";
import PaymentsTab from "./tabs/Payments";
import GPSTab from "./tabs/GPS";
import SettingsTab from "./tabs/Settings";
import SuppliesTab from "./tabs/Supplies";
import ExpensesTab from "./tabs/Expenses";
import WastageTab from "./tabs/Wastage";
import AnalyticsTab from "./tabs/Analytics";
import { IngredientsTab } from "./tabs/Ingredient";
import { StaffTab } from "./tabs/Staff";
import { MachinesTab } from "./tabs/Machines";
import { VehiclesTab } from "./tabs/Vehicles";

// ── lib imports ──────────────────────────────────────────────────────────────
import { CRMContext } from "./lib/CRMContext";
import { useStore, fbWrite, atomicInvoiceSeq, _syncListeners } from "./lib/store";
import { uid, today, ts, inr, cx, safeO, safeArr, mapU, lineTotal, lineTotalWithTax, lineRows, prodNamesMatch } from "./lib/utils";
import { hashPw, checkPw, SESSION_TTL, getDeviceInfo, DEVICE_ID } from "./lib/auth";
import { t18n, setAppLang } from "./lib/i18n";
import { ALL_TABS, ROLE_DEF, FINE_PERM_DEFS, defaultFinePerms, hasPerm } from "./lib/roles";
import { D_PRODS, D_CUST, D_DELIV, D_SUP, D_EXP, D_USERS, D_SETTINGS, D_WASTE, D_PROD_TARGETS, D_PROD_ITEMS } from "./lib/constants";
import { T } from "./lib/theme";
import { appendLedger, LEDGER_TYPES } from "./lib/ledger";
import { guardedExport } from "./lib/exportGuard";
import { exportPDF, exportAgentReceipt, useT, exportDeliveryLabel, exportDeliveryInvoice, exportDeliveryReceipt, shareWhatsApp, exportCSV, exportWord, exportTabPDF, exportPnLReport, exportPnLCSV, exportTabExcel } from "./lib/exports";

// ── component imports ─────────────────────────────────────────────────────────
import { Btn, Inp, Sel, Card, Sheet, Toast, Confirm, Search, StatCard, Pill, Hr, Tog, ProdRow, OrderEditor, SectionHeader, TabStatCards, DataTable, FilterBar, StatusPill, AvatarCircle, Pagination, BottomNav } from "./components/ui";
import { DetailModal } from "./components/DetailModal";
import { SmartDashboard } from "./components/SmartDashboard";
import { AnimatedCounter, Skeleton, FadeIn, SlidePanel, PulseIndicator, useToast, ToastContainer } from "./components/microinteractions";
import { CustomerIntelPanel, CustomerHealthBadge, useCustomerIntel } from "./components/CustomerIntelligence";
import { SystemHealthBar, SystemHealthDot } from "./components/SystemHealthBar";
import { GPSMap } from "./components/GPSMap";
import { WeatherWidget } from "./components/WeatherWidget";
import { PasskeyManager, SecuritySessions, FailedLoginAttempts } from "./components/SecurityPanels";
import { sendBrowserNotif } from "./components/ui";
import PnLTab from "./tabs/PnL";
import { onBatchComplete } from "./lib/workflowEngine";
import { CommandPalette, CommandPaletteButton } from "./components/CommandPalette";
import { usePresence, PresenceBar, PresenceDot, EditingIndicator } from "./components/CollaborationPresence";
import { usePredictions, PredictivePanel, PredictiveSummaryBadges, StockOutAlert, ChurnRiskTable } from "./components/PredictiveAnalytics";
import { useConfirm, ConfirmModal, useUndoAction, UndoToast, requestApproval } from "./components/ApprovalFlow";
import { TrashButton, TrashPanel } from "./components/TrashPanel";
import { withoutDeleted, onlyDeleted } from "./lib/softDelete";
import { QuickEntryFAB, QuickEntryBar } from "./components/QuickEntry";
import { PermissionMatrix, TabAccessEditor, RoleBadge,
         RoleTemplateSelector, useRoleManager } from "./components/RoleManager";
import { initBrowserSupport, BrowserBanner, injectBrowserCSS } from "./components/BrowserSupport";
import { ActivityTimelineButton, ActivityTimeline } from "./components/ActivityTimeline";
import { useKeyboardNav, KeyboardHelpModal } from "./components/KeyboardNav";
import { useDraggableWidgets, DraggableWidget, WidgetCustomizer, WidgetCustomizerButton } from "./components/DraggableWidgets";
import { KanbanBoard, KanbanButton } from "./components/KanbanBoard";
import { AuditLogButton, AuditLogPanel, useAuditLog } from "./components/AuditLog";

function CRM({sess,onLogout,onSessUpdate,dm,setDm,users,setUsers,settings,setSettings}){
  const isAdmin=sess.role==="admin";
  const isFactory=sess.role==="factory";
  const userPerms=sess.permissions||ROLE_DEF[sess.role]||ROLE_DEF.agent;
  const t=T(dm);
  // Apply language setting on every render (settings may change)
  if(settings?.language) setAppLang(settings.language);

  // Fine-grained permission helper — use this everywhere instead of isAdmin/isAgent/isFactory checks
  const can = (key) => hasPerm(sess, key);

  // Backward-compat derived flags (now driven by finePerms)
  const canSeePrices    = isAdmin || can("cust_seePrices")  || can("deliv_seePrices");
  const canSeeFinancials= isAdmin || can("cust_seeFinance");

  const [rawCustomers, setCust,  custLoaded]    =useStore("tas9_cust", D_CUST);
  const [deliveries,setDeliv, delivLoaded]   =useStore("tas9_deliv",D_DELIV);
  const [supplies,  setSup,   supLoaded]     =useStore("tas9_sup",  D_SUP);
  const [expenses,  setExp,   expLoaded]     =useStore("tas9_exp",  D_EXP);
  const [products,  setProd,  prodLoaded]    =useStore("tas9_prod", D_PRODS);
  const [actLog,    setAct,   actLoaded]     =useStore("tas9_act",  []);
  const [wastage,   setWaste, wastageLoaded] =useStore("tas9_waste", D_WASTE);
  const [prodTargets, setProdTargets, ptLoaded]=useStore("tas9_prodtargets", D_PROD_TARGETS);
  const [staffBatches] = useStore("tas9_batches", []);           // written by StaffUI
  // staffActivityLog removed — StaffUI now writes directly to tas9_act (unified)
  // Merge admin prodTargets + staff batches into one list for all tabs.
  // Staff batches are keyed by batch.id; prodTargets by pt.batchId or pt.id.
  // Deduplicate: if a staff batch already exists as a prodTarget (same batchId), prefer the staff version.
  const allBatches = React.useMemo(() => {
    const safe = Array.isArray(staffBatches) ? staffBatches : [];
    const safePT = Array.isArray(prodTargets) ? prodTargets : [];
    const staffIds = new Set(safe.map(b => b.id));
    // Keep admin prodTargets that don't already have a matching staff batch
    const adminOnly = safePT.filter(pt => !staffIds.has(pt.batchId) && !staffIds.has(pt.id));
    return [...safe, ...adminOnly];
  }, [staffBatches, prodTargets]);
  const [, setPackingTasks]=useStore("tas9_pack", []);
  const [prodItems, setProdItems]=useStore("tas9_prod_items", D_PROD_ITEMS);
  const dataLoaded = custLoaded && delivLoaded && supLoaded && expLoaded && prodLoaded && wastageLoaded && actLoaded && ptLoaded;
  // Agent live locations — kept in memory only, NOT stored in Firebase/cloud
  // Uses Ably free-tier WebSockets for cross-device real-time relay
  const [notifs, setNotifs]=useStore("tas9_notifs",[]);
  const [finSnapshots, setFinSnapshots]=useStore("tas9_fin_snaps",{});
  // eslint-disable-next-line no-unused-vars
  const [qcLogs,    setQcLogs]   = useStore("tas9_qclogs", []);
  const [handovers, setHandovers]= useStore("tas9_handovers", []);
  const [notices,   setNotices]  = useStore("tas9_notices", []);
  // ── PHASE 2 STORES ────────────────────────────────────────────
  const [ingLogs,   setIngLogs]  = useStore("tas9_ing_logs", []);   // ingredient consumption
  const [ingItems,  setIngItems] = useStore("tas9_ing_items", []);   // ingredient master list
  const [staffLogs, setStaffLogs]= useStore("tas9_staff_logs", []); // attendance/shift
  const [staffList, setStaffList]= useStore("tas9_staff_list", []); // staff master list
  const [machineLogs,setMachineLogs]=useStore("tas9_machine_logs",[]); // maintenance log
  const [machineList,setMachineList]=useStore("tas9_machine_list",[]); // machine master list
  const [vehLogs,   setVehLogs]  = useStore("tas9_veh_logs",  []);  // vehicle trip/maintenance log
  const [vehList,   setVehList]  = useStore("tas9_veh_list",  []);  // vehicle list
  const [briefingDismissed, setBriefingDismissed] = useStore("tas_pref_briefing_dismissed_"+sess.id,"");
  const [briefingPinned, setBriefingPinned] = useStore("tas_pref_briefing_pinned_"+sess.id, true);
  // ── PER-USER DASHBOARD WIDGET PREFS (featureCustomDashboard) ──
  // Stored per user-id so each role/person can customise their own view.
  // Falls back to the global dashWidgets setting when the feature is off.
  const [userDashWidgets, setUserDashWidgets] = useStore("tas_pref_dashwidgets_"+sess.id, null);
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
  // ── PAYMENT PROCESSING FLAG — prevents double-tap from firing twice ──────
  const _payProcessing = useRef(false);

  function recordPaymentLedger(customerId, customerName, amount, note, method){
    // Guard: if a payment is already being processed, ignore the second tap
    if (_payProcessing.current) { notify("Payment already being recorded…"); return; }
    _payProcessing.current = true;
    setTimeout(() => { _payProcessing.current = false; }, 3000); // reset after 3s safety net

    const entry = {id:uid(), customerId, customerName, amount:+amount, note:note||"", method:method||"Cash", recordedBy:displayName, date:today(), ts:ts()};

    // Write ledger entry first, then customer paid — both use functional updaters
    // so each reads the latest committed state, not a stale closure snapshot.
    setPaymentLedger(p=>[entry,...safeArr(p)]);
    appendLedger(LEDGER_TYPES.PAYMENT_RECEIVED,{customer:customerName,customerId,amount:+amount,method:method||"Cash",note:note||"",recordedBy:displayName},sess);

    // Use functional updater: reads the latest c.paid even if another write
    // landed between the user tapping and this line executing.
    setCust(p=>safeArr(p).map(c=>c.id===customerId?{...c,paid:(c.paid||0)+(+amount)}:c));

    addLog("Manual payment recorded",`${customerName} — ${inr(amount)}${note?" · "+note:""}`);
    addNotif("Payment Recorded",`${inr(amount)} from ${customerName}`,"success","payment");
    notify(`${inr(amount)} recorded ✓`);
  }
  function delPayment(entry){ask(`Move this payment record to trash?`,()=>{
    setPaymentLedger(p=>safeArr(p).map(x=>x.id===entry.id?{...x,deleted:true,deletedAt:ts(),deletedAtISO:new Date().toISOString(),deletedBy:sess.id,deletedByName:displayName,deletedByRole:sess.role}:x));
    // Reverse the customer.paid amount so balances stay correct
    setCust(p=>safeArr(p).map(c=>c.id===entry.customerId?{...c,paid:Math.max(0,(c.paid||0)-(entry.amount||0))}:c));
    addLog("Soft-deleted payment",`${entry.customerName||entry.customer} — ${inr(entry.amount)}`);
    notify("Moved to trash");
  });}
  // Fix #10: use functional updater form so seq always reads from prev (latest committed)
  // state, not the stale closure value. Prevents double-click from generating duplicate
  // invoice numbers when two rapid calls both read invRegistry.seq before either write resolves.
  function getOrCreateInvNo(deliveryId) {
    const existing = (invRegistry.issued||{})[deliveryId];
    if(existing) return existing;
    const prefix = settings?.invoicePrefix||"TAS";
    const yearReset = settings?.invoiceYearReset!==false;
    const year = new Date().getFullYear();
    let generatedInvNo = "";
    setInvRegistry(prev => {
      // Re-check inside updater — another call may have already issued this id
      if((prev.issued||{})[deliveryId]) { generatedInvNo=(prev.issued||{})[deliveryId]; return prev; }
      const newSeq = (prev.seq||0) + 1;
      generatedInvNo = yearReset
        ? `${prefix}-${year}-${String(newSeq).padStart(4,"0")}`
        : `${prefix}-${String(newSeq).padStart(4,"0")}`;
      return { seq: newSeq, issued: {...(prev.issued||{}), [deliveryId]: generatedInvNo} };
    });
    // Return a synchronous best-guess (the functional update is async in React)
    // For display purposes this is fine; the registry write is always correct.
    if(!generatedInvNo){
      const seq = (invRegistry.seq||0) + 1;
      generatedInvNo = yearReset
        ? `${prefix}-${year}-${String(seq).padStart(4,"0")}`
        : `${prefix}-${String(seq).padStart(4,"0")}`;
    }
    return generatedInvNo;
  }
  // eslint-disable-next-line no-unused-vars
  function getReceiptNo(deliveryId) {
    const invNo = (invRegistry.issued||{})[deliveryId];
    const prefix = settings?.invoicePrefix||"TAS";
    if(invNo) return `RCP-${invNo.replace(prefix+"-","")}`;
    return `RCP-${(deliveryId||"").slice(-8).toUpperCase()}`;
  }
  const [kanbanOpen, setKanbanOpen] = useState(false);
  const [auditOpen,  setAuditOpen]  = useState(false);
  const [fabDockVisible, setFabDockVisible] = useState(true);
  // Hide the fab dock on any tap/click, show it again after 4s of inactivity
  const fabDockTimerRef = React.useRef(null);
  const hideFabDock = React.useCallback(() => {
    setFabDockVisible(false);
    clearTimeout(fabDockTimerRef.current);
    fabDockTimerRef.current = setTimeout(() => setFabDockVisible(true), 4000);
  }, []);
  const [notifOpen, setNotifOpen]=useState(false);
  const [avatarOpen, setAvatarOpen]=useState(false);
  const unreadNotifs=notifs.filter(n=>!n.read).length;
  const [trashOpen, setTrashOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const trashedItems = React.useMemo(() => [
    ...onlyDeleted(supplies).map(r    => ({ ...r, _collection: "supplies",    _label: r.item        || r.id })),
    ...onlyDeleted(expenses).map(r    => ({ ...r, _collection: "expenses",    _label: r.category    || r.id })),
    ...onlyDeleted(wastage).map(r     => ({ ...r, _collection: "wastage",     _label: r.product     || r.id })),
    ...onlyDeleted(ingLogs).map(r     => ({ ...r, _collection: "ingredients", _label: r.ingredient  || r.id })),
    ...onlyDeleted(staffLogs).map(r   => ({ ...r, _collection: "staff",       _label: r.staffName   || r.id })),
    ...onlyDeleted(machineLogs).map(r => ({ ...r, _collection: "machines",    _label: r.machineName || r.id })),
    ...onlyDeleted(vehLogs).map(r     => ({ ...r, _collection: "vehicles",    _label: r.vehicleName || r.id })),
    ...onlyDeleted(prodTargets).map(r => ({ ...r, _collection: "production",  _label: `${r.product||""} ${r.date||""}`.trim() || r.id })),
    ...onlyDeleted(deliveries).map(r  => ({ ...r, _collection: "deliveries",  _label: r.customer    || r.id })),
    ...onlyDeleted(paymentLedger).map(r=>({ ...r, _collection: "payments",   _label: `${r.customerName||r.customer||"Payment"} — ${inr(r.amount||0)}` })),
    ...onlyDeleted(qcLogs).map(r     => ({ ...r, _collection: "qclogs",      _label: `QC: ${r.product||r.batch||r.id}${r.deletedByName?" (by "+r.deletedByName+")":""}` })),
    ...onlyDeleted(staffList).map(r  => ({ ...r, _collection: "stafflist",   _label: `${r.name||r.id}${r.deletedByName?" (by "+r.deletedByName+")":""}` })),
    ...onlyDeleted(ingItems).map(r   => ({ ...r, _collection: "ingitems",    _label: `${r.name||r.id}${r.deletedByName?" (by "+r.deletedByName+")":""}` })),
  ], [supplies, expenses, wastage, ingLogs, staffLogs, machineLogs, vehLogs, prodTargets, deliveries, paymentLedger, qcLogs, staffList, ingItems]);
  function addNotif(title,body,type="info",notifType="newentry"){
    const n={id:uid(),title,body,type,ts:ts(),read:false};
    setNotifs(p=>[n,...p.slice(0,49)]);
    const targets=(settings?.notifTargets||{})[notifType]||["admin"];
    if(targets.includes(sess.role)) sendBrowserNotif(title,body);
  }
  function markAllRead(){setNotifs(p=>safeArr(p).map(n=>({...n,read:true})));}
  function delNotif(id){setNotifs(p=>safeArr(p).filter(n=>n.id!==id));}

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
  // Tab guard: if active tab becomes unavailable (settings load async, permissions change),
  // ── Browser support: polyfills + CSS fixes (runs once on mount) ──
  useEffect(()=>{ initBrowserSupport(); injectBrowserCSS(); },[]);

  // auto-correct to first available tab so the UI never shows a blank screen
  useEffect(()=>{
    setTabRaw(cur=>{
      const allowed=(isAdmin?ALL_TABS:ALL_TABS.filter(tb=>userPerms.includes(tb)));
      const gated=[
        ...(settings?.featureVanManagement?[]:["Vehicles"]),
        ...(settings?.featureMachineMaintenance?[]:["Machines"]),
        ...(settings?.featureStaffAttendance?[]:["Staff"]),
      ];
      const visible=allowed.filter(tb=>!gated.includes(tb));
      if(visible.length>0&&!visible.includes(cur)){
        const fallback=visible[0]||"Dashboard";
        try{sessionStorage.setItem("tas_active_tab",fallback);}catch{}
        return fallback;
      }
      return cur;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[settings?.featureVanManagement,settings?.featureMachineMaintenance,settings?.featureStaffAttendance,userPerms,isAdmin]);
  const [srch,setSrch]=useState("");
  const [toast,setToast]=useState(null);
  const [conf,setConf]=useState(null);
  const notify=m=>setToast(m);
  const ask=(msg,yes)=>setConf({msg,yes});

  // ── Chaos Protection hooks ───────────────────────────────────────────────
  const { confirmState, requestConfirm, resolveConfirm } = useConfirm();
  const { undoState, scheduleWithUndo, cancelUndo } = useUndoAction();

  // Dual-approval gate: non-admins get queued; admins bypass immediately
  function dualApprovalGate(actionKey, label, fn) {
    const requireList = settings?.chaosProtection?.requireDualApprovalFor || [];
    if (!requireList.includes(actionKey) || isAdmin) { fn(); return; }
    requestApproval({ action: actionKey, label, requestedBy: displayName, sess, settings, notify, fn });
  }

  // ── Export Guard wrapper — checks quota, injects watermark on PDFs, logs ──
  const gExport = (type, fn, label) => guardedExport({ type, label, sess, settings, fn, notify, addLog });

  // Sub-staff: moved up before addLog so displayName is defined when addLog captures it
  // Also supports displayOverride from staff picker mode
  const subStaff=sess.subStaff||[];
  const [activeStaff,setActiveStaff]=useState(()=>sess.displayOverride||( subStaff.length>0?subStaff[0]:sess.name));
  const displayName=useMemo(()=>sess.displayOverride||(subStaff.length>0?activeStaff:sess.name)||"Admin",[sess.displayOverride,sess.name,subStaff.length,activeStaff]);

  // ── #18 Command Palette open state (lifted so header button can trigger it) ──
  const [cmdOpen, setCmdOpen] = useState(false);

  // Fix: useCallback so addLog is a stable reference — prevents cascading re-renders
  // in any child component that receives it as a prop
  const addLog=useCallback((action,detail)=>{
    const dev=getDeviceInfo();
    const e={id:uid(),user:displayName,role:sess.role,action,detail,ts:ts(),
      browser:dev.browser,os:dev.os,deviceType:dev.deviceType,deviceId:DEVICE_ID};
    setAct(p=>[e,...p.slice(0,999)]);
  },[displayName,sess.role]);

  const { logEdit } = useAuditLog({ addLog, displayName, sess });

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

  // Fix: keep a ref to sess so async GPS callbacks always read the current session,
  // not whatever sess was when captureGPS was defined (stale closure)
  const sessRef = useRef(sess);
  useEffect(()=>{ sessRef.current = sess; }, [sess]);

  // Silent one-shot location capture — called on delivery actions
  // action = "session_start" | "delivery_saved" | "marked_transit" | "marked_delivered"
  // customer = customer name string (or "" for session start)
  function captureGPS(action, customer=""){
    if(!navigator.geolocation) return;
    const currentSess = sessRef.current;
    if(currentSess.role!=="agent") return; // delivery agents only — admins/factory never tracked
    if(!hasPerm(currentSess,"gps_track")) return;
    let bestPos=null; let attempts=0; let committed=false;
    function commit(pos){
      if(committed) return;
      committed=true;
      const log={
        id:uid(), agentId:currentSess.id, agentName:currentSess.name, agentRole:currentSess.role, action, customer,
        lat:pos.coords.latitude, lng:pos.coords.longitude,
        acc:Math.round(pos.coords.accuracy),
        speed:pos.coords.speed!=null?Math.round(pos.coords.speed*3.6):null,
        heading:pos.coords.heading!=null?Math.round(pos.coords.heading):null,
        ts:Date.now(),
        tsDisplay:new Date().toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}),
      };
      setGpsLogs(prev=>[log,...(Array.isArray(prev)?prev:[]).slice(0,499)]);
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
  const [isOffline,setIsOffline]=useState(!navigator.onLine);

  // Offline detection: combine navigator.onLine events with Firebase error flag.
  // Previously used a 3s polling loop that never reset when reconnecting.
  useEffect(()=>{
    const goOffline=()=>setIsOffline(true);
    const goOnline=()=>{ setIsOffline(false); window.__fbOffline=false; };
    window.addEventListener("offline",goOffline);
    window.addEventListener("online",goOnline);
    // Also poll for Firebase-specific errors (e.g. auth/rules failures while "online")
    const interval=setInterval(()=>{
      if(window.__fbOffline){ setIsOffline(true); window.__fbOffline=false; }
      else if(navigator.onLine){ setIsOffline(false); }
    },5000);
    return()=>{ window.removeEventListener("offline",goOffline); window.removeEventListener("online",goOnline); clearInterval(interval); };
  },[]);
  // Fix #1 & #4: All these were running on every single render with no memoization.
  // Also fix #4: totalRev now computed purely from deliveries (single source of truth)
  // instead of mixing customers.paid (ledger) with delivery-level replacement deductions.
  // ── COMPUTED PENDING: derive pending from deliveries, never trust stored value ──
  // For each customer, pending = sum of all non-cancelled delivery order totals
  //   minus replacements deducted minus partial payments collected.
  // This makes the customers tab self-healing: even if stored pending drifts,
  // the displayed and used value is always correct.
  const taxRtGlobal=settings?.featureTaxCalc?(+(settings?.taxRate||0)):0;
  const computedPendingMap=useMemo(()=>{
    const map={};
    safeArr(rawCustomers).forEach(c=>{ map[c.id]=0; });
    // Add order amounts from deliveries
    safeArr(deliveries).forEach(d=>{
      // Only count Delivered orders as money owed — Pending/In Transit haven't been received yet
      if(!d.customerId||d.status!=="Delivered") return;
      if(!(d.customerId in map)) map[d.customerId]=0; // seed missing customer IDs
      const orderAmt=lineTotalWithTax(d.orderLines||{},taxRtGlobal);
      const repl=+d.replacement?.amount||0;
      const partial=d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0;
      map[d.customerId]=(map[d.customerId]||0)+orderAmt-repl-partial;
    });
    // Subtract manual payments recorded via paymentLedger ("Record Payment" button)
    // Without this, every recorded payment is ignored and all customers look permanently overdue
    safeArr(paymentLedger).forEach(e=>{
      if(!e.customerId) return;
      map[e.customerId]=(map[e.customerId]||0)-(+e.amount||0);
    });
    Object.keys(map).forEach(k=>{ map[k]=Math.max(0,map[k]); });
    return map;
  },[rawCustomers,deliveries,paymentLedger,taxRtGlobal]);

  // Enrich customers with computed pending — all c.pending reads get the live value
  const customers=useMemo(()=>safeArr(rawCustomers).filter(c=>!c.deleted).map(c=>({
    ...c,
    pending: computedPendingMap[c.id]??c.pending??0,
  })),[rawCustomers,computedPendingMap]);

  const activeC=useMemo(()=>safeArr(customers).filter(c=>c.active),[customers]);
  const totalReplDeductions=useMemo(()=>safeArr(deliveries).reduce((a,d)=>a+(+d.replacement?.amount||0),0),[deliveries]);
  const totalRev=useMemo(()=>safeArr(deliveries).filter(d=>d.status==="Delivered").reduce((a,d)=>a+lineTotalWithTax(d.orderLines,taxRtGlobal),0)-totalReplDeductions,[deliveries,totalReplDeductions,taxRtGlobal]);
  const totalDue=useMemo(()=>safeArr(customers).reduce((a,c)=>a+(c.pending||0),0),[customers]);
  const totalExpOp=useMemo(()=>withoutDeleted(safeArr(expenses)).reduce((a,e)=>a+(e.amount||0),0),[expenses]);
  const totalSupC=useMemo(()=>withoutDeleted(safeArr(supplies)).reduce((a,s)=>a+(s.cost||0),0),[supplies]);
  const netProfit=useMemo(()=>totalRev-totalExpOp-totalSupC,[totalRev,totalExpOp,totalSupC]);
  const pendingD=useMemo(()=>safeArr(deliveries).filter(d=>d.status==="Pending"),[deliveries]);

  // ── PUSH PERMISSION ──────────────────────────────────────────
  // ── PUSH PERMISSION ──────────────────────────────────────────
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // ── LOW STOCK ALERTS ─────────────────────────────────────────
  const lowStockThreshold = settings?.lowStockThreshold ?? 5;
  const lowStockItems = useMemo(()=>withoutDeleted(safeArr(supplies)).filter(s => (s.qty || 0) <= lowStockThreshold && s.item),[supplies,lowStockThreshold]);
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
    const churnMs = churnDays * 86400000;
    const lastDelivByCustomer = {};
    for (const d of safeArr(deliveries)) {
      if (!d.customerId) continue;
      if (!lastDelivByCustomer[d.customerId] || d.date > lastDelivByCustomer[d.customerId]) {
        lastDelivByCustomer[d.customerId] = d.date;
      }
    }
    return safeArr(customers).filter(c => {
      if (!c.active) return false;
      const lastDate = lastDelivByCustomer[c.id];
      if (!lastDate) return c.joinDate && (now - new Date(c.joinDate)) > churnMs;
      return (now - new Date(lastDate)) > churnMs;
    });
  }, [customers, deliveries, churnDays]);


  // ── DASHBOARD STATS MEMO ─────────────────────────────────────────────────────
  const dashStats = useMemo(() => {
    const tStr = today();
    const startOfWeek  = (() => { const d=new Date(tStr); d.setDate(d.getDate()-6); return d.toISOString().slice(0,10); })();
    const startOfMonth = (() => { const d=new Date(tStr); d.setDate(1); return d.toISOString().slice(0,10); })();
    const safeD = safeArr(deliveries);
    const safeC = safeArr(customers);
    const safePT = safeArr(allBatches);
    const safeW = safeArr(wastage);
    const todayDelivs  = safeD.filter(d => d.date === tStr);
    const todayDone    = todayDelivs.filter(d => d.status === "Delivered");
    const todayPend    = todayDelivs.filter(d => d.status === "Pending");
    const todayTransit = todayDelivs.filter(d => d.status === "In Transit");
    const todayCancl   = todayDelivs.filter(d => d.status === "Cancelled");
    const todayRev     = todayDone.reduce((s,d) => s + lineTotal(d.orderLines), 0);
    const weekDelivs   = safeD.filter(d => d.date >= startOfWeek && d.status === "Delivered");
    const monthDelivs  = safeD.filter(d => d.date >= startOfMonth && d.status === "Delivered");
    const weekRev      = weekDelivs.reduce((s,d) => s + lineTotal(d.orderLines), 0);
    const monthRev     = monthDelivs.reduce((s,d) => s + lineTotal(d.orderLines), 0);
    const allDue       = safeC.filter(c => c.pending > 0);
    const totalDueAmt  = allDue.reduce((s,c) => s + (c.pending||0), 0);
    const todayPT      = safePT.filter(p => p.date === tStr);
    const totalTarget  = todayPT.reduce((s,p) => s + (p.target||0), 0);
    const totalActual  = todayPT.reduce((s,p) => s + (p.actual||0), 0);
    const prodPct      = totalTarget > 0 ? Math.round(totalActual / totalTarget * 100) : null;
    const overdueD     = safeD.filter(d => d.status === "Pending" && d.date < tStr);
    const todayWastage = safeW.filter(w => w.date === tStr);
    const todayWasteCost = todayWastage.reduce((s,w) => s + (w.cost||0), 0);
    return {todayDelivs,todayDone,todayPend,todayTransit,todayCancl,todayRev,
            weekDelivs,monthDelivs,weekRev,monthRev,allDue,totalDueAmt,
            todayPT,totalTarget,totalActual,prodPct,overdueD,todayWastage,todayWasteCost};
  }, [deliveries, customers, allBatches, wastage]);

  const dashReplacementCount = useMemo(()=>safeArr(deliveries).filter(d=>d.replacement?.done).length,[deliveries]);
  const dashPartialCount = useMemo(()=>safeArr(deliveries).filter(d=>d.partialPayment?.enabled&&(+(d.partialPayment?.amount)||0)>0).length,[deliveries]);
  const dashPartialTotal = useMemo(()=>safeArr(deliveries).reduce((s,d)=>s+(d.partialPayment?.enabled?(+(d.partialPayment?.amount)||0):0),0),[deliveries]);
  const dashTotalCollected = useMemo(()=>safeArr(customers).reduce((s,c)=>s+(c.paid||0),0),[customers]);
  // Delivery status counts for filter pills — one pass over deliveries, not 3 separate filters
  const delivStatusCounts = useMemo(()=>{
    const counts={"Pending":0,"In Transit":0,"Delivered":0,"Cancelled":0};
    for(const d of deliveries) if(counts[d.status]!==undefined) counts[d.status]++;
    return counts;
  },[deliveries]);


  // Previously new Date() was called inside the memo with no date dependency —
  // if the app stayed open past midnight the chart would silently show wrong dates.
  const todayStr = today();
  const chartData=useMemo(()=>{
    const days=Array.from({length:7},(_,i)=>{const d=new Date(todayStr);d.setDate(d.getDate()-i);return d.toISOString().slice(0,10);}).reverse();
    return days.map(date=>({date:date.slice(5),Revenue:deliveries.filter(d=>d.date===date&&d.status==="Delivered").reduce((s,d)=>s+lineTotal(d.orderLines),0),Expenses:expenses.filter(e=>e.date===date).reduce((s,e)=>s+(e.amount||0),0)}));
  },[deliveries,expenses,todayStr]);

  // When featureCustomDashboard is on, each user's personal widget list takes precedence
  const widgets = settings?.featureCustomDashboard && userDashWidgets!=null
    ? userDashWidgets
    : (settings?.dashWidgets||["stats","chart","pendingDeliveries","outstanding"]);
  const q=srch.toLowerCase();
  const [delivStatusFilter,setDelivStatusFilter]=useState("all");
  const [delivPage,setDelivPage]=useState(1);
  const [custPage,setCustPage]=useState(1);
  const PAGE_SIZE=20;
  const [delivDateFilter,setDelivDateFilter]=useState("all"); // "all"|"today"|"yesterday"|"week"|"custom"
  const [delivDateFrom,setDelivDateFrom]=useState("");
  const [delivDateTo,setDelivDateTo]=useState("");
  const [delivBatchFilter,setDelivBatchFilter]=useState("all"); // "all"|batchId
  const fCust=useMemo(()=>customers.filter(c=>!q||c.name.toLowerCase().includes(q)||c.phone?.includes(q)||c.address?.toLowerCase().includes(q)),[customers,q]);
  const fDeliv=useMemo(()=>{
    const tStr=today();
    const yStr=(()=>{const d=new Date(tStr);d.setDate(d.getDate()-1);return d.toISOString().slice(0,10);})();
    const wStr=(()=>{const d=new Date(tStr);d.setDate(d.getDate()-6);return d.toISOString().slice(0,10);})();
    return deliveries.filter(d=>!d.deleted).filter(d=>{
      const invNo=(invRegistry?.issued||{})[d.id]||d.invNo||"";
      const rcptNo=invNo?`RCP-${invNo.replace(/^[A-Z]+-/,"")}`:`RCP-${(d.id||"").slice(-6).toUpperCase()}`;
      const batchLabels=(allBatches||[]).filter(pt=>pt.date===d.date).map(b=>b.batchLabel||"Batch").join(" ");
      const productNames=Object.values(safeO(d.orderLines)).filter(l=>l.qty>0).map(l=>l.name||"").join(" ");
      const matchSearch=!q||(d.customer||"").toLowerCase().includes(q)||(d.date||"").includes(q)||(d.status||"").toLowerCase().includes(q)||invNo.toLowerCase().includes(q)||rcptNo.toLowerCase().includes(q)||batchLabels.toLowerCase().includes(q)||productNames.toLowerCase().includes(q)||(d.notes||"").toLowerCase().includes(q);
      const matchStatus=delivStatusFilter==="all"||d.status===delivStatusFilter;
      const matchDate=delivDateFilter==="all"||(delivDateFilter==="today"&&d.date===tStr)||(delivDateFilter==="yesterday"&&d.date===yStr)||(delivDateFilter==="week"&&d.date>=wStr&&d.date<=tStr)||(delivDateFilter==="custom"&&delivDateFrom&&delivDateTo&&d.date>=delivDateFrom&&d.date<=delivDateTo);
      const matchBatch=delivBatchFilter==="all"||(d.batchId===delivBatchFilter);
      // Agents only see their own deliveries (assigned or created by them)
      const matchAgent=sess.role!=="agent"||(d.agentId===sess.id||d.agent===sess.name||d.createdBy===sess.name||d.agent===displayName||d.createdBy===displayName);
      return matchSearch&&matchStatus&&matchDate&&matchBatch&&matchAgent;
    });
  },[deliveries,invRegistry,prodTargets,q,delivStatusFilter,delivDateFilter,delivDateFrom,delivDateTo,delivBatchFilter,sess.role,sess.id,sess.name,displayName]);
  const fSup=useMemo(()=>withoutDeleted(supplies).filter(s=>!q||s.item.toLowerCase().includes(q)||s.supplier?.toLowerCase().includes(q)||s.date?.includes(q)||(s.notes||"").toLowerCase().includes(q)),[supplies,q]);

  const blkOL=()=>products.reduce((a,p)=>({...a,[p.id]:{qty:0,priceAmount:p.prices?.[0]||0}}),{});
  const blkC=()=>({name:"",phone:"",address:"",lat:"",lng:"",orderLines:blkOL(),paid:0,pending:0,partialPay:0,notes:"",active:true,joinDate:today(),creditLimit:0});
  const blkD=()=>({customer:"",customerId:null,orderLines:blkOL(),date:today(),deliveryDate:"",status:"Pending",notes:"",address:"",lat:0,lng:0,createdBy:sess.name,createdAt:ts(),replacement:{done:false,item:"",reason:"",qty:""},partialPayment:{enabled:false,amount:""},batchId:""});
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
  const [expDateFilter,setExpDateFilter]=useState("month");
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
  const [piSh,setPiSh]=useState(null); const [piF,setPiF]=useState({id:"",name:""});
  const [uSh,setUsh]=useState(null); const [uF,setUf]=useState(blkU());
  const [paySh,setPaySh]=useState(null); const [payAmt,setPayAmt]=useState("");
  const [wSh,setWSh]=useState(null); const [wF,setWF]=useState(blkW());

  // ── Keyboard shortcuts ───────────────────────────────────────
  const { helpOpen, setHelpOpen } = useKeyboardNav({
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
    isAdmin, can,
  });

  // ── Draggable widgets ────────────────────────────────────────
  const { dragHandlers, customizerOpen, setCustOpen, reorderWidgets } = useDraggableWidgets({
    userDashWidgets,
    setUserDashWidgets,
    settings,
    featureOn: !!settings?.featureCustomDashboard,
    isAdmin,
  });

  // ── #18 Presence — track what record the current user has open ───────────────
  // Must be after all sheet states (dSh, cSh, sSh, eSh, wSh) are declared
  const editingRecord =
    dSh  ? { type:"delivery", id:dF?.id||"new", label:dF?.customer||"New Delivery" } :
    cSh  ? { type:"customer", id:cF?.id||"new", label:cF?.name||"New Customer" } :
    sSh  ? { type:"supply",   id:sF?.id||"new", label:sF?.item||"New Supply" } :
    eSh  ? { type:"expense",  id:eF?.id||"new", label:eF?.category||"New Expense" } :
    wSh  ? { type:"wastage",  id:wF?.id||"new", label:wF?.product||"New Wastage" } :
    null;
  const { peers } = usePresence(sess, tab, editingRecord);

  // ── #19 Predictive analytics — client-side ML from existing data ─────────────
  const predictions = usePredictions({
    deliveries, customers, supplies, expenses,
    wastage, products, paymentLedger, settings,
  });
  const [delivCalendar,setDelivCalendar]=useState(false);
  const [delivView,setDelivView]=useState("expanded"); // "expanded" | "compact"
  const [calOffset,setCalOffset]=useState(0);
  const [calExpandedDay,setCalExpandedDay]=useState(null);
  const [lastSync,setLastSync]=useState(null);
  useEffect(()=>{const fn=ts=>{setLastSync(ts);};_syncListeners.add(fn);return()=>_syncListeners.delete(fn);},[]);

  // ── PWA: manifest + service worker (featurePWA) ──
  useEffect(()=>{
    if(!settings?.featurePWA) return;
    const appName=settings?.appName||"TAS Healthy World";
    const manifestData={name:appName,short_name:appName.split(" ")[0],start_url:"/",display:"standalone",background_color:"#0f1923",theme_color:"#1e3a5f",description:settings?.appSubtitle||"Operations CRM",icons:[{src:"/logo192.png",sizes:"192x192",type:"image/png"},{src:"/logo512.png",sizes:"512x512",type:"image/png"}]};
    const blob=new Blob([JSON.stringify(manifestData)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    let link=document.getElementById("__pwa_manifest__");
    if(!link){link=document.createElement("link");link.id="__pwa_manifest__";link.rel="manifest";document.head.appendChild(link);}
    link.href=url;
    [["apple-mobile-web-app-capable","yes"],["apple-mobile-web-app-status-bar-style","black-translucent"],["apple-mobile-web-app-title",appName],["mobile-web-app-capable","yes"]].forEach(([name,content])=>{let m=document.querySelector(`meta[name="${name}"]`);if(!m){m=document.createElement("meta");m.name=name;document.head.appendChild(m);}m.content=content;});
    if("serviceWorker" in navigator){
      // Cache version changes daily so stale builds don't get served forever.
      // For even tighter cache busting, set REACT_APP_BUILD_ID in your Vercel env vars.
      const swVer=(typeof process!=="undefined"&&process.env?.REACT_APP_BUILD_ID)||("tas-v-"+Math.floor(Date.now()/86400000));
      const swCode=`
        const CACHE_NAME="${swVer}";
        self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(['/'])));self.skipWaiting();});
        self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>clients.claim()));});
        self.addEventListener('fetch',e=>{if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('/')));}});
      `;
      try{
        const swBlob=new Blob([swCode],{type:"text/javascript"});
        const swUrl=URL.createObjectURL(swBlob);
        navigator.serviceWorker.register(swUrl).catch(()=>{});
      }catch(e){console.warn("SW registration failed:",e);}
    }
    return()=>{URL.revokeObjectURL(url);};
  },[settings?.featurePWA,settings?.appName,settings?.appSubtitle]);

  const [ptSh,setPtSh]=useState(null);
  const [ptF,setPtF]=useState(()=>({date:today(),shift:"",product:"",actual:0,notes:"",batchId:"",batchLabel:"Batch 1",qcGrade:"A",qcNotes:"",embWastage:[],embQC:[],embHandover:[]}));
  const [ptDateFilter,setPtDateFilter]=useState("all");
  const [nbSh,setNbSh]=useState(false);
  const [nbF,setNbF]=useState({title:"",body:"",pinned:false});
  const [hvSh,setHvSh]=useState(false);
  const [prodSubTab,setProdSubTab]=useState("batches");
  const [openRecipe,setOpenRecipe]=useState(null);
  const [hvF,setHvF]=useState({shift:"Morning",date:today(),note:"",nextShift:"",issues:"",loggedBy:""});
  const [bulkSelect,setBulkSelect]=useState(false);
  const [bulkSelected,setBulkSelected]=useState(new Set());
  const [expandedDeliveryCust,setExpandedDeliveryCust]=useState(null);
  const [expandedCustCard,setExpandedCustCard]=useState(null);
  const [custSortField,setCustSortField]=useState("lastOrder");
  const [custStatusFilter,setCustStatusFilter]=useState("all");
  const [custView,setCustView]=useState("expanded"); // "expanded" | "compact"
  const [kpiHover,setKpiHover]=useState(null); // dashboard KPI hover drill-down
  const [custMobileFilterOpen,setCustMobileFilterOpen]=useState(false);
  const [selectedCustomer,setSelectedCustomer]=useState(null); // for inline split-panel
  const [custDetailDelivFilter,setCustDetailDelivFilter]=useState("all"); // "all"|"today"|"yesterday"|"week"
  const [custDetailPartialAmt,setCustDetailPartialAmt]=useState("");
  const [auditUserFilter,setAuditUserFilter]=useState("all");
  // Reset pagination when search or filters change — placed here so all deps are defined
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{setDelivPage(1);},[q,delivStatusFilter,delivDateFilter]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{setCustPage(1);},[q,custSortField,custStatusFilter]);
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
  const [overdueAlertExpanded,setOverdueAlertExpanded]=useState(false);
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
  const [pdfExporting,setPdfExporting]=useState(false);
  const [pdfDone,setPdfDone]=useState(false);
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
  const [anlChartType,setAnlChartType]=useState("bar"); // "bar" | "line"
  const [anlTrendMetric,setAnlTrendMetric]=useState("revenue"); // "revenue" | "deliveries" | "expenses"
  const [anlShowInsights,setAnlShowInsights]=useState(true);
  // Deliveries date range export
  const [delivExportFrom,setDelivExportFrom]=useState("");
  const [delivExportTo,setDelivExportTo]=useState("");
  const [delivExportOpen,setDelivExportOpen]=useState(false);
  const delivExportBtnRef=useRef(null);
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
  const [plInsightExpanded,setPlInsightExpanded]=useState(false);
  const [expSortMode,setExpSortMode]=useState("date");
  // ── DEEP INTERACTIVE MODALS ──────────────────────────────────
  const [detailModal,setDetailModal]=useState(null); // {type:"expense"|"delivery"|"customer"|"date"|"agent"|"supply", data:...}
  const closeDetail=()=>setDetailModal(null);

  // ── PHASE 2 STATE ────────────────────────────────────────────
  const [ingSh,setIngSh]=useState(null); const [ingF,setIngF]=useState({ingredient:"",qty:"",unit:"kg",date:today(),batchId:"",notes:"",loggedBy:""});
  const [ingItemSh,setIngItemSh]=useState(null); const [ingItemF,setIngItemF]=useState({name:"",unit:"kg",stock:""});
  const [ingSearch,setIngSearch]=useState(""); const [ingDateFilter,setIngDateFilter]=useState("all");
  const [staffSh,setStaffSh]=useState(null); const [staffF,setStaffF]=useState({staffId:"",staffName:"",date:today(),shift:"Morning",status:"Present",inTime:"",outTime:"",breakMins:"",department:"",task:"",overtimeReason:"",notes:"",temperature:"",loggedBy:""});
  const [staffMemberSh,setStaffMemberSh]=useState(null); const [staffMemberF,setStaffMemberF]=useState({name:"",role:"",phone:"",department:"",employmentType:"Full-time",joinDate:"",emergencyContact:"",emergencyPhone:""});
  const [staffSearch,setStaffSearch]=useState(""); const [staffDateFilter,setStaffDateFilter]=useState("all"); const [staffSubTab,setStaffSubTab]=useState("log");
  const [machSh,setMachSh]=useState(null); const [machF,setMachF]=useState({machineId:"",machineName:"",date:today(),type:"Servicing",severity:"Medium",issue:"",action:"",technician:"",partsReplaced:"",partsCost:"",laborCost:"",cost:"",downtimeHrs:"",nextDue:"",loggedBy:"",status:"Operational"});
  const [machItemSh,setMachItemSh]=useState(null); const [machItemF,setMachItemF]=useState({name:"",category:"",location:"",serialNo:"",purchaseCost:"",purchaseDate:"",warrantyExpiry:"",notes:""});
  const [machSearch,setMachSearch]=useState(""); const [machSubTab,setMachSubTab]=useState("log");
  const [vehSh,setVehSh]=useState(null); const [vehF,setVehF]=useState({vehicleId:"",vehicleName:"",date:today(),type:"Trip",kms:"",odometerStart:"",odometerEnd:"",driver:"",destination:"",routeStops:"",fuelCost:"",fuelLiters:"",fuelType:"",tollCost:"",maintenanceCost:"",nextServiceDue:"",priority:"Normal",notes:"",status:"OK"});
  const [vehItemSh,setVehItemSh]=useState(null); const [vehItemF,setVehItemF]=useState({name:"",regNo:"",type:"Van",color:"",year:"",assignedDriver:"",capacity:"",insuranceExpiry:"",fitnessExpiry:"",notes:""});
  const [vehSearch,setVehSearch]=useState(""); const [vehSubTab,setVehSubTab]=useState("log");

  // INGREDIENT CONSUMPTION
  function saveIng(){
    if(!ingF.ingredient.trim()||!ingF.qty){notify("Ingredient and quantity required");return;}
    const rec={...ingF,qty:+ingF.qty||0,loggedBy:displayName,id:uid(),createdAt:ts()};
    if(ingSh==="add"){
      setIngLogs(p=>[rec,...p]);
      // Auto-deduct from supplies if matching item found
      const match=supplies.find(s=>(s.item||"").toLowerCase().includes(ingF.ingredient.toLowerCase())||ingF.ingredient.toLowerCase().includes((s.item||"").toLowerCase()));
      if(match){setSup(p=>safeArr(p).map(s=>s.id===match.id?{...s,qty:Math.max(0,(s.qty||0)-(+ingF.qty||0))}:s));addLog("Ingredient consumed (auto-deducted)",`${ingF.ingredient} ×${ingF.qty} from "${match.item}"`);}
      else{addLog("Ingredient consumed",`${ingF.ingredient} ×${ingF.qty}`);}
      notify("Consumption logged ✓");
    } else {
      setIngLogs(p=>safeArr(p).map(x=>x.id===ingSh.id?{...rec,id:x.id,createdAt:x.createdAt}:x));
      addLog("Edited ingredient log",ingF.ingredient);notify("Updated ✓");
    }
    setIngSh(null);
  }
  function delIng(r){ask(`Move ingredient record to trash?`,()=>{setIngLogs(p=>safeArr(p).map(x=>x.id===r.id?{...x,deleted:true,deletedAt:ts(),deletedAtISO:new Date().toISOString(),deletedBy:sess.id,deletedByName:displayName,deletedByRole:sess.role}:x));addLog("Soft-deleted ingredient log",r.ingredient);notify("Moved to trash");});}
  function saveIngItem(){
    if(!ingItemF.name.trim()){notify("Name required");return;}
    const rec={...ingItemF,id:ingItemSh==="add"?uid():ingItemSh.id,stock:+ingItemF.stock||0};
    if(ingItemSh==="add"){setIngItems(p=>[...safeArr(p),rec]);addLog("Added ingredient",rec.name);notify("Added ✓");}
    else{setIngItems(p=>safeArr(p).map(x=>x.id===rec.id?rec:x));addLog("Edited ingredient",rec.name);notify("Updated ✓");}
    setIngItemSh(null);
  }

  // STAFF ATTENDANCE
  function saveStaff(){
    if(!staffF.staffName.trim()||!staffF.date){notify("Staff name and date required");return;}
    const rec={...staffF,loggedBy:displayName,id:uid(),createdAt:ts()};
    if(staffSh==="add"){setStaffLogs(p=>[rec,...p]);addLog("Staff attendance logged",`${staffF.staffName} — ${staffF.status}`);notify("Logged ✓");}
    else{setStaffLogs(p=>safeArr(p).map(x=>x.id===staffSh.id?{...rec,id:x.id,createdAt:x.createdAt}:x));addLog("Edited staff log",staffF.staffName);notify("Updated ✓");}
    setStaffSh(null);
  }
  function delStaff(r){ask(`Move staff record to trash?`,()=>{setStaffLogs(p=>safeArr(p).map(x=>x.id===r.id?{...x,deleted:true,deletedAt:ts(),deletedAtISO:new Date().toISOString(),deletedBy:sess.id,deletedByName:displayName,deletedByRole:sess.role}:x));addLog("Soft-deleted staff log",r.staffName);notify("Moved to trash");});}
  function saveStaffMember(){
    if(!staffMemberF.name.trim()){notify("Name required");return;}
    const rec={...staffMemberF,id:staffMemberSh==="add"?uid():staffMemberSh.id};
    if(staffMemberSh==="add"){setStaffList(p=>[...safeArr(p),rec]);addLog("Added staff member",rec.name);notify("Added ✓");}
    else{setStaffList(p=>safeArr(p).map(x=>x.id===rec.id?rec:x));addLog("Edited staff member",rec.name);notify("Updated ✓");}
    setStaffMemberSh(null);
  }

  // MACHINE MAINTENANCE
  function saveMach(){
    if(!machF.machineName.trim()||!machF.date){notify("Machine and date required");return;}
    const totalCost=(+machF.partsCost||0)+(+machF.laborCost||0)+(+machF.cost||0);
    const rec={...machF,cost:totalCost,partsCost:+machF.partsCost||0,laborCost:+machF.laborCost||0,downtimeHrs:+machF.downtimeHrs||0,loggedBy:displayName,id:uid(),createdAt:ts()};
    if(machSh==="add"){setMachineLogs(p=>[rec,...p]);addLog("Maintenance logged",`${machF.machineName} — ${machF.type}`);notify("Logged ✓");}
    else{setMachineLogs(p=>safeArr(p).map(x=>x.id===machSh.id?{...rec,id:x.id,createdAt:x.createdAt}:x));addLog("Edited maintenance log",machF.machineName);notify("Updated ✓");}
    setMachSh(null);
  }
  function delMach(r){ask(`Move machine record to trash?`,()=>{setMachineLogs(p=>safeArr(p).map(x=>x.id===r.id?{...x,deleted:true,deletedAt:ts(),deletedAtISO:new Date().toISOString(),deletedBy:sess.id,deletedByName:displayName,deletedByRole:sess.role}:x));addLog("Soft-deleted machine log",r.machineName);notify("Moved to trash");});}
  function saveMachItem(){
    if(!machItemF.name.trim()){notify("Name required");return;}
    const rec={...machItemF,id:machItemSh==="add"?uid():machItemSh.id};
    if(machItemSh==="add"){setMachineList(p=>[...safeArr(p),rec]);addLog("Added machine",rec.name);notify("Added ✓");}
    else{setMachineList(p=>safeArr(p).map(x=>x.id===rec.id?rec:x));addLog("Edited machine",rec.name);notify("Updated ✓");}
    setMachItemSh(null);
  }

  // VEHICLE MANAGEMENT
  function saveVehFixed(){
    if(!vehF.vehicleName.trim()||!vehF.date){notify("Vehicle and date required");return;}
    const kms=vehF.odometerEnd&&vehF.odometerStart?(+vehF.odometerEnd-(+vehF.odometerStart||0)):+vehF.kms||0;
    const rec={...vehF,fuelCost:+vehF.fuelCost||0,fuelLiters:+vehF.fuelLiters||0,tollCost:+vehF.tollCost||0,maintenanceCost:+vehF.maintenanceCost||0,kms,odometerStart:+vehF.odometerStart||0,odometerEnd:+vehF.odometerEnd||0,loggedBy:displayName,id:vehSh==="add"?uid():vehSh.id,createdAt:ts()};
    if(vehSh==="add"){setVehLogs(p=>[rec,...p]);addLog("Vehicle log added",`${vehF.vehicleName} — ${vehF.type}`);notify("Logged ✓");}
    else{setVehLogs(p=>safeArr(p).map(x=>x.id===vehSh.id?{...rec,id:x.id,createdAt:x.createdAt}:x));addLog("Edited vehicle log",vehF.vehicleName);notify("Updated ✓");}
    setVehSh(null);
  }
  function delVeh(r){ask(`Move vehicle record to trash?`,()=>{setVehLogs(p=>safeArr(p).map(x=>x.id===r.id?{...x,deleted:true,deletedAt:ts(),deletedAtISO:new Date().toISOString(),deletedBy:sess.id,deletedByName:displayName,deletedByRole:sess.role}:x));addLog("Soft-deleted vehicle log",r.vehicleName);notify("Moved to trash");});}
  function saveVehItem(){
    if(!vehItemF.name.trim()){notify("Name required");return;}
    const rec={...vehItemF,id:vehItemSh==="add"?uid():vehItemSh.id};
    if(vehItemSh==="add"){setVehList(p=>[...safeArr(p),rec]);addLog("Added vehicle",rec.name);notify("Added ✓");}
    else{setVehList(p=>safeArr(p).map(x=>x.id===rec.id?rec:x));addLog("Edited vehicle",rec.name);notify("Updated ✓");}
    setVehItemSh(null);
  }

  // CUSTOMERS
  function saveC(){if(!cF.name.trim()){notify("Name required");return;}if(cSh==="add"){const rec={...cF,paid:+cF.paid||0,pending:0,partialPay:+cF.partialPay||0};setCust(p=>[...safeArr(p),{...rec,id:uid()}]);addLog("Added customer",rec.name);notify("Customer added ✓");addNotif("Customer Added",`${rec.name} has been added`,"success");}else{// Never overwrite computed pending on edit
const rec={...cF,paid:+cF.paid||0,partialPay:+cF.partialPay||0};delete rec.pending;setCust(p=>safeArr(p).map(c=>c.id===cSh.id?{...rec,id:c.id,pending:c.pending}:c));addLog("Edited customer",rec.name);notify("Updated ✓");}setCsh(null);}
  function delC(c){ask(`Delete "${c.name}"?`,()=>{setCust(p=>safeArr(p).filter(x=>x.id!==c.id));addLog("Deleted customer",c.name);notify("Deleted");});}
  function togActive(c){setCust(p=>safeArr(p).map(x=>x.id===c.id?{...x,active:!x.active}:x));addLog(`${c.active?"Deactivated":"Activated"} customer`,c.name);notify("Updated");}
  function recPay(){const a=+payAmt;if(!a||a<=0||!paySh){notify("Enter a valid amount");return;}if(a>paySh.pending*2&&paySh.pending>0){notify(`Amount ${inr(a)} seems too high — pending is only ${inr(paySh.pending)}. Please check.`);return;}recordPaymentLedger(paySh.id,paySh.name,a,"","Cash");// recordPaymentLedger already fires addLog+addNotif+notify
setPaySh(null);setPayAmt("");}

  // DELIVERIES
  function pickCust(id){const c=customers.find(x=>x.id===id);setDf(f=>({...f,customer:c?.name||"",customerId:c?.id||null,address:c?.address||"",lat:c?.lat||0,lng:c?.lng||0,orderLines:c?.orderLines?{...c.orderLines}:blkOL()}));}
  // ── DELIVERY SAVE GUARD — prevents double-tap creating two deliveries ────────
  const _delivSaving = useRef(false);

  async function saveD(){
    if(!dF.customer){notify("Select a customer");return;}

    // Guard: block a second save while the first is still in-flight
    if(_delivSaving.current){notify("Saving…");return;}
    _delivSaving.current=true;

    try{
      const taxRt=settings?.featureTaxCalc?(+(settings?.taxRate||0)):0;
      const newOrderTotal=lineTotalWithTax(dF.orderLines||{},taxRt);
      // Credit limit check
      if(settings?.featureCreditLimit){
        const custRec=customers.find(c=>c.id===dF.customerId);
        const limit=+(custRec?.creditLimit||0);
        if(limit>0){
          const currentPending=+(custRec?.pending||0);
          const oldTotal=dSh!=="add"?lineTotalWithTax(dSh.orderLines||{},taxRt):0;
          if((currentPending-oldTotal)+newOrderTotal>limit){
            notify(`⚠️ Credit limit exceeded! Pending: ₹${currentPending.toLocaleString("en-IN")} + this order: ₹${newOrderTotal.toLocaleString("en-IN")} > limit: ₹${limit.toLocaleString("en-IN")}`);
            return;
          }
        }
      }
      const replAmt = +dF.replacement?.amount||0;
      const partialAmt = dF.partialPayment?.enabled ? (+dF.partialPayment?.amount||0) : 0;

      if(dSh==="add"){
        // ── NEW DELIVERY ────────────────────────────────────────────────────────
        if(dF.customerId){
          if(partialAmt>0){
            setCust(p=>safeArr(p).map(c=>{
              if(c.id!==dF.customerId) return c;
              return {...c,paid:(c.paid||0)+partialAmt};
            }));
          }
          if(replAmt>0) addLog("Replacement deduction",`${dF.customer} — ${inr(replAmt)} off pending`);
          if(partialAmt>0) addLog("Partial payment on delivery",`${dF.customer} — ${inr(partialAmt)} collected`);
        }
        const newId=uid();

        // ── ATOMIC invoice number via Firebase runTransaction ──────────────────
        // This is the ONLY safe way to get unique seq numbers across concurrent devices.
        // The old setInvRegistry functional updater only protected against local double-taps;
        // two different devices would both read the same seq and produce duplicate invoice numbers.
        const prefix=settings?.invoicePrefix||"TAS";
        const yearReset=settings?.invoiceYearReset!==false;
        const year=new Date().getFullYear();
        let newSeq=0;
        try{
          newSeq=await atomicInvoiceSeq();
          // Also update the local invRegistry state so other reads stay consistent
          setInvRegistry(prev=>({...prev,seq:newSeq,issued:{...(prev.issued||{}),[newId]:(yearReset?`${prefix}-${year}-${String(newSeq).padStart(4,"0")}`:`${prefix}-${String(newSeq).padStart(4,"0")}`)}}));
        }catch(e){
          // Fallback to local seq if Firebase transaction fails (offline)
          console.warn("atomicInvoiceSeq failed, using local fallback:",e.message);
          newSeq=(invRegistry.seq||0)+1;
          setInvRegistry(prev=>{const s=(prev.seq||0)+1;return{...prev,seq:s,issued:{...(prev.issued||{}),[newId]:(yearReset?`${prefix}-${year}-${String(s).padStart(4,"0")}`:`${prefix}-${String(s).padStart(4,"0")}`)}};});
        }
        const newInvNo=yearReset?`${prefix}-${year}-${String(newSeq).padStart(4,"0")}`:`${prefix}-${String(newSeq).padStart(4,"0")}`;

        // ── Link invoice to any production batch for the same date+product ──
        const delivDate=dF.date||today();
        const delivItems=Object.values(safeO(dF.orderLines)).filter(l=>(l.qty||0)>0).map(l=>l.name||"");
        if(delivItems.length>0){
          setProdTargets(prev=>safeArr(prev).map(pt=>{
            if(pt.date!==delivDate) return pt;
            const matches=delivItems.some(item=>pt.product&&prodNamesMatch(item,pt.product));
            if(!matches) return pt;
            const existing=pt.linkedInvoices||[];
            if(existing.includes(newInvNo)) return pt;
            return {...pt,linkedInvoices:[...existing,newInvNo]};
          }));
        }
        // ── Auto-stamp batchId onto this new delivery if a same-date matching batch exists ──
        let autoBatchId = "";
        if(settings?.prodAutoLinkDeliveries!==false){
          const todayBatches=allBatches.filter(pt=>pt.date===delivDate);
          const matchedBatch=todayBatches.find(pt=>
            delivItems.some(item=>prodNamesMatch(item,pt.product||""))
          );
          if(matchedBatch) autoBatchId=matchedBatch.batchId||"";
        }
        setDeliv(p=>[...safeArr(p),{...dF,id:newId,invNo:newInvNo,batchId:autoBatchId||dF.batchId||"",partialPayment:{...dF.partialPayment,amount:partialAmt}}]);
        appendLedger(LEDGER_TYPES.DELIVERY_BILLED,{invoiceNo:newInvNo,customer:dF.customer,customerId:dF.customerId,amount:newOrderTotal,recordedBy:displayName},sess);
        addLog("Added delivery",`${dF.customer} [${newInvNo}]`);
        notify(`Delivery added · ${newInvNo} ✓`);
        addNotif("Delivery Added",`${dF.customer} — ${newInvNo}`,"success");
        captureGPS("delivery_saved",dF.customer);
      }
      else{
        // ── EDIT DELIVERY ───────────────────────────────────────────────────────
        if(dF.customerId){
          const oldD=deliveries.find(d=>d.id===dSh.id)||dSh;
          const oldPartialAmt=oldD.partialPayment?.enabled?(+oldD.partialPayment?.amount||0):0;
          const custIdChanged=dF.customerId!==oldD.customerId;
          if(custIdChanged && oldD.customerId){
            setCust(p=>safeArr(p).map(c=>{
              if(c.id===oldD.customerId) return {...c,paid:Math.max(0,(c.paid||0)-oldPartialAmt)};
              if(c.id===dF.customerId)   return {...c,paid:(c.paid||0)+partialAmt};
              return c;
            }));
          } else {
            const partialDelta=partialAmt-oldPartialAmt;
            if(partialDelta!==0){
              setCust(p=>safeArr(p).map(c=>{
                if(c.id!==dF.customerId) return c;
                return {...c,paid:Math.max(0,(c.paid||0)+partialDelta)};
              }));
            }
          }
          if(replAmt!==+(oldD.replacement?.amount||0)&&replAmt>0) addLog("Replacement deduction (edit)",`${dF.customer} — ${inr(replAmt)} off pending`);
          if(partialAmt!==oldPartialAmt&&partialAmt>0) addLog("Partial payment updated (edit)",`${dF.customer} — ${inr(partialAmt)} collected`);
        }
        setDeliv(p=>safeArr(p).map(d=>d.id===dSh.id?{...dF,id:d.id}:d));
        addLog("Edited delivery",dF.customer);notify("Updated ✓");captureGPS("delivery_saved",dF.customer);
      }
      setDsh(null);
    }catch(err){
      try{ const {monitor:mon}=require("./lib/monitor"); mon?.fnFailed("saveD",err.message,{uid:sess.id,role:sess.role}); }catch{}
      throw err;
    }finally{
      // Always release the guard, even if something throws
      setTimeout(()=>{ _delivSaving.current=false; },1000);
    }
  }

  // ── STATUS TOGGLE GUARD — prevents double-tap flipping status twice ─────────
  const _tglProcessing = useRef(new Set());
  function tglD(d){
    if(_tglProcessing.current.has(d.id)){return;}
    _tglProcessing.current.add(d.id);
    setTimeout(()=>_tglProcessing.current.delete(d.id),2000);
    const ns=(d.status==="Pending"||d.status==="In Transit")?"Delivered":"Pending";
    setDeliv(p=>safeArr(p).map(x=>x.id===d.id?{...x,status:ns}:x));
    addLog("Status changed",`${d.customer} → ${ns}`);
    notify("Updated");
    if(ns==="Delivered"){addNotif("Delivery Completed",`${d.customer} marked as Delivered`,"success");captureGPS("marked_delivered",d.customer);}
  }
  function delD(d){
    dualApprovalGate("delete_delivery",`Delete delivery for ${d.customer}`,()=>{
      scheduleWithUndo(
        `Delivery for "${d.customer}" moved to trash`,
        ()=>{
          if(d.customerId){
            const partialAmt=d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0;
            if(partialAmt>0){
              setCust(p=>safeArr(p).map(c=>{
                if(c.id!==d.customerId) return c;
                return {...c,paid:Math.max(0,(c.paid||0)-partialAmt)};
              }));
            }
          }
          setDeliv(p=>safeArr(p).map(x=>x.id===d.id?{...x,deleted:true,deletedAt:ts(),deletedAtISO:new Date().toISOString(),deletedBy:sess.id,deletedByName:displayName,deletedByRole:sess.role}:x));
          appendLedger(LEDGER_TYPES.INVOICE_VOIDED,{customer:d.customer,customerId:d.customerId,invoiceNo:d.invNo||d.id,amount:lineTotalWithTax(d.orderLines||{},taxRtGlobal),voidedBy:displayName},sess);
          addLog("Soft-deleted delivery",d.customer);notify("Moved to trash");
        },
        5000,
        ()=>{
          setDeliv(p=>safeArr(p).map(x=>x.id===d.id?{...x,deleted:false}:x));
          if(d.customerId){
            const partialAmt=d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0;
            if(partialAmt>0) setCust(p=>safeArr(p).map(c=>c.id===d.customerId?{...c,paid:(c.paid||0)+partialAmt}:c));
          }
          notify("Delivery restored ✓");
        }
      );
    });
  }

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
    // Pre-assign IDs so we can build deliveries and update invRegistry in one atomic pass
    const newIds=toAdd.map(()=>uid());
    let newDelivs=[];
    // Functional updater reads the latest seq — prevents duplicate invoice numbers
    // if two staff members submit bulk orders at nearly the same time.
    setInvRegistry(prev=>{
      let seq=prev.seq||0;
      const newIssuedMap={...(prev.issued||{})};
      newDelivs=toAdd.map(({include,...r},i)=>{
        seq+=1;
        const invNo=yearReset?`${prefix}-${year}-${String(seq).padStart(4,"0")}`:`${prefix}-${String(seq).padStart(4,"0")}`;
        newIssuedMap[newIds[i]]=invNo;
        return {...r,id:newIds[i],invNo,date:bulkOrderDate,deliveryDate:"",status:bulkOrderStatus,notes:"",createdBy:displayName,createdAt:ts(),partialPayment:{enabled:false,amount:""}};
      });
      return {seq,issued:newIssuedMap};
    });
    setDeliv(p=>[...safeArr(p),...newDelivs]);
    // computedPendingMap derives pending automatically from deliveries — no manual setCust update needed
    addLog("Bulk orders created",`${newDelivs.length} orders for ${bulkOrderDate} · ${newDelivs[0]?.invNo}…`);
    notify(`${newDelivs.length} orders created ✓`);
    setBulkOrderSh(false);
  }
  // SUPPLIES
  function saveS(){
    if(!sF.item.trim()){notify("Item required");return;}
    const rec={...sF,qty:+sF.qty||0,cost:+sF.cost||0,minStock:sF.minStock?+sF.minStock:""};
    if(sSh==="add"){setSup(p=>[...safeArr(p),{...rec,id:uid()}]);appendLedger(LEDGER_TYPES.SUPPLY_PURCHASE,{item:sF.item,qty:+sF.qty||0,unit:sF.unit,cost:+sF.cost||0,supplier:sF.supplier||"",recordedBy:displayName},sess);addLog("Added supply",sF.item);notify("Supply logged ✓");captureGPS("supply_logged",sF.item);}
    else{setSup(p=>safeArr(p).map(s=>s.id===sSh.id?{...rec,id:s.id}:s));addLog("Edited supply",sF.item);notify("Updated ✓");captureGPS("supply_logged",sF.item);}
    // Low stock push notification on save
    const threshold=+sF.minStock;
    if(threshold>0&&(+sF.qty||0)<=threshold){
      sendBrowserNotif(`⚠️ Low Stock: ${sF.item}`,`Only ${sF.qty} ${sF.unit} left — below threshold of ${threshold}`);
      addNotif(`⚠️ Low Stock: ${sF.item}`,`Only ${sF.qty} ${sF.unit} remaining`,"warning","lowstock");
    }
    setSsh(null);
  }
  function delS(s){
    scheduleWithUndo(`"${s.item}" moved to trash`,()=>{
      setSup(p=>safeArr(p).map(x=>x.id===s.id?{...x,deleted:true,deletedAt:ts(),deletedAtISO:new Date().toISOString(),deletedBy:sess.id,deletedByName:displayName,deletedByRole:sess.role}:x));
      addLog("Soft-deleted supply",s.item);notify("Moved to trash");
    },5000,()=>{setSup(p=>safeArr(p).map(x=>x.id===s.id?{...x,deleted:false}:x));notify("Supply restored ✓");});
  }

  // EXPENSES
  function saveE(){if(!eF.amount){notify("Amount required");return;}
    if(eSh==="add"){setExp(p=>[...safeArr(p),{...eF,id:uid(),amount:+eF.amount}]);appendLedger(LEDGER_TYPES.EXPENSE_RECORDED,{category:eF.category,amount:+eF.amount,vendor:eF.vendor||"",notes:eF.notes||"",recordedBy:displayName},sess);addLog("Added expense",`${eF.category} ${inr(eF.amount)}`);notify("Expense logged ✓");captureGPS("expense_logged",eF.category);}
    else{setExp(p=>safeArr(p).map(x=>x.id===eSh.id?{...eF,id:x.id,amount:+eF.amount}:x));addLog("Edited expense",`${eF.category} ${inr(eF.amount)}`);notify("Updated ✓");captureGPS("expense_logged",eF.category);}
    setEsh(null);}
  function delE(e){
    scheduleWithUndo(`"${e.category}" expense moved to trash`,()=>{
      setExp(p=>safeArr(p).map(x=>x.id===e.id?{...x,deleted:true,deletedAt:ts(),deletedAtISO:new Date().toISOString(),deletedBy:sess.id,deletedByName:displayName,deletedByRole:sess.role}:x));
      addLog("Soft-deleted expense",`${e.category} ${inr(e.amount)}`);notify("Moved to trash");
    },5000,()=>{setExp(p=>safeArr(p).map(x=>x.id===e.id?{...x,deleted:false}:x));notify("Expense restored ✓");});
  }
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
    else{setWaste(p=>safeArr(p).map(x=>x.id===wSh.id?{...rec,id:x.id,createdAt:x.createdAt}:x));addLog("Edited wastage",`${rec.product} ${rec.qty} ${rec.unit}`);notify("Updated ✓");captureGPS("wastage_logged",rec.product);}
    setWSh(null);
  }
  function delW(w){ask(`Move "${w.product}" to trash?`,()=>{setWaste(p=>safeArr(p).map(x=>x.id===w.id?{...x,deleted:true,deletedAt:ts(),deletedAtISO:new Date().toISOString(),deletedBy:sess.id,deletedByName:displayName,deletedByRole:sess.role}:x));addLog("Soft-deleted wastage",`${w.product} ${w.qty} ${w.unit}`);notify("Moved to trash");});}

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
  function delQC(q){ask(`Delete QC record for "${q.product}"?`,()=>{setQcLogs(p=>safeArr(p).filter(x=>x.id!==q.id));addLog("Deleted QC log",q.product);notify("Deleted");});}
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
    setSup(p=>safeArr(p).map(s=>s.id===best.id?{...s,qty:Math.max(0,(s.qty||0)-deductQty)}:s));
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
      // ── Link same-date deliveries that contain this exact product to this batch ──
      const autoLink=settings?.prodAutoLinkDeliveries!==false;
      const matchingDelivs=deliveries
        .filter(d=>d.date===rec.date&&d.status!=="Cancelled")
        .filter(d=>Object.entries(safeO(d.orderLines)).some(([pid,l])=>{
          if(!(l.qty>0))return false;
          const p=products.find(x=>x.id===pid);
          return prodNamesMatch(p?.name||l.name||"",productName);
        }));
      const matchingInvNos=matchingDelivs.map(d=>(invRegistry?.issued||{})[d.id]||d.invNo).filter(Boolean);
      // Stamp batchId onto matching deliveries if auto-link enabled & they have no batchId yet
      if(autoLink&&matchingDelivs.length>0){
        setDeliv(prev=>safeArr(prev).map(d=>{
          const isMatch=matchingDelivs.some(m=>m.id===d.id);
          if(!isMatch)return d;
          if(d.batchId)return d; // don't overwrite manual assignments
          return {...d,batchId:batchIdFinal};
        }));
      }
      const savedRec={...rec,id:uid(),createdAt:ts(),deduction:deduction||null,linkedInvoices:[...new Set(matchingInvNos)]};
      setProdTargets(p=>[savedRec,...p]);
      // Workflow: auto-create packing task when batch has actual qty
      if(savedRec.actual>0){
        onBatchComplete(savedRec,{name:sess?.name||"Admin",role:"admin"},setPackingTasks,notify);
      }
      // Save embedded records linked to this batch
      if(embW.length>0) setWaste(p=>[...embW.map(w=>({...w,date:rec.date,batchId:batchIdFinal,id:w.id||uid(),createdAt:w.createdAt||ts()})),...p]);
      if(embQ.length>0) setQcLogs(p=>[...embQ.map(q=>({...q,date:rec.date,batchId:batchIdFinal,id:q.id||uid(),createdAt:q.createdAt||ts()})),...p]);
      if(embH.length>0) setHandovers(p=>[...embH.map(h=>({...h,date:rec.date,batchId:batchIdFinal,id:h.id||uid(),createdAt:h.createdAt||ts()})),...p]);
      addLog("Production logged",`${rec.batchLabel} — ${rec.product} — ${rec.actual} units${rec.shift?" ("+rec.shift+")":""}${embW.length>0?` · ${embW.length} wastage`:""}${embQ.length>0?` · ${embQ.length} QC`:""}${embH.length>0?` · handover`:""}`);
      captureGPS("production_logged",rec.product);
      if(!ptAutoDeduct) notify("Batch saved ✓");
    } else {
      const prev=prodTargets.find(x=>x.id===ptSh.id);
      const deduction=runAutoDeduct(productName,rec.actual,prev?.actual);
      const mergedDeduction=deduction||(prev?.deduction||null);
      setProdTargets(p=>safeArr(p).map(x=>x.id===ptSh.id?{...rec,id:x.id,createdAt:x.createdAt,deduction:mergedDeduction}:x));
      // Workflow: if actual qty newly added on edit, create packing task
      const prevActual=prev?.actual||0;
      if(rec.actual>0&&prevActual===0){
        onBatchComplete({...rec,id:ptSh.id},{name:sess?.name||"Admin",role:"admin"},setPackingTasks,notify);
      }
      // On edit: remove old linked records and re-add from embedded
      setWaste(p=>{const withoutOld=p.filter(w=>w.batchId!==batchIdFinal||!w._embLinked);return embW.length>0?[...embW.map(w=>({...w,date:rec.date,batchId:batchIdFinal,_embLinked:true,id:w.id||uid(),createdAt:w.createdAt||ts()})),...withoutOld]:withoutOld;});
      setQcLogs(p=>{const withoutOld=p.filter(q=>q.batchId!==batchIdFinal||!q._embLinked);return embQ.length>0?[...embQ.map(q=>({...q,date:rec.date,batchId:batchIdFinal,_embLinked:true,id:q.id||uid(),createdAt:q.createdAt||ts()})),...withoutOld]:withoutOld;});
      setHandovers(p=>{const withoutOld=p.filter(h=>h.batchId!==batchIdFinal||!h._embLinked);return embH.length>0?[...embH.map(h=>({...h,date:rec.date,batchId:batchIdFinal,_embLinked:true,id:h.id||uid(),createdAt:h.createdAt||ts()})),...withoutOld]:withoutOld;});
      addLog("Production updated",`${rec.batchLabel} — ${rec.product} — ${rec.actual} units`);
      captureGPS("production_logged",rec.product);
      if(!ptAutoDeduct) notify("Updated ✓");
    }
    setPtSh(null);
  }
  function delPT(pt){ask(`Move production record to trash?`,()=>{setProdTargets(p=>safeArr(p).map(x=>x.id===pt.id?{...x,deleted:true,deletedAt:ts(),deletedAtISO:new Date().toISOString(),deletedBy:sess.id,deletedByName:displayName,deletedByRole:sess.role}:x));addLog("Soft-deleted production record",`${pt.product} ${pt.date}`);notify("Moved to trash");});}

  // PRODUCTS
  function saveP(){if(!pF.name.trim()||!pF.id.trim()){notify("Name and ID required");return;}const rec={...pF,id:pF.id.toLowerCase().replace(/\s+/g,""),prices:pF.prices.map(x=>+x||0).filter(x=>x>0)};if(!rec.prices.length){notify("Add at least one price");return;}if(pSh==="add"){if(products.find(p=>p.id===rec.id)){notify("ID exists");return;}setProd(p=>[...safeArr(p),rec]);addLog("Added product",rec.name);notify("Product added ✓");}else{setProd(p=>safeArr(p).map(x=>x.id===pSh.id?rec:x));addLog("Edited product",rec.name);notify("Updated ✓");}setPsh(null);}
  function delP(p){ask(`Delete product "${p.name}"?`,()=>{setProd(prev=>safeArr(prev).filter(x=>x.id!==p.id));addLog("Deleted product",p.name);notify("Deleted");});}
  function saveProdItem(){
    if(!piF.name.trim()){notify("Name required");return;}
    const id=piF.id||piF.name.toLowerCase().replace(/\s+/g,"_").replace(/[^a-z0-9_]/g,"");
    const rec={id,name:piF.name.trim()};
    if(piSh==="add"){if((prodItems||[]).find(x=>x.id===id)){notify("ID already exists");return;}setProdItems(p=>[...(p||[]),rec]);addLog("Added production item",rec.name);notify("Production item added ✓");}
    else{setProdItems(p=>(p||[]).map(x=>x.id===piSh.id?{...rec,id:x.id}:x));addLog("Edited production item",rec.name);notify("Updated ✓");}
    setPiSh(null);setPiF({id:"",name:""});
  }
  function delProdItem(item){ask(`Delete production item "${item.name}"?`,()=>{setProdItems(p=>(p||[]).filter(x=>x.id!==item.id));addLog("Deleted production item",item.name);notify("Deleted");});}

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
    if(uSh==="add"){if(users.find(x=>x.username===rec.username)){notify("Username exists");return;}setUsers(p=>[...safeArr(p),{...rec,id:uid(),createdAt:today()}]);addLog("Created user",`@${rec.username} (${rec.role})`);notify("User created ✓");}
    else{setUsers(p=>safeArr(p).map(x=>x.id===uSh.id?{...rec,id:x.id}:x));addLog("Edited user",`@${rec.username}`);notify("Updated ✓");}
    setUsh(null);
  }
  function delU(u){if(u.id===sess.id){notify("Cannot delete your own account");return;}if(u.role==="admin"&&users.filter(x=>x.role==="admin"&&x.active).length<=1){notify("Cannot remove last admin");return;}ask(`Delete user "@${u.username}"?`,()=>{setUsers(p=>safeArr(p).filter(x=>x.id!==u.id));addLog("Deleted user",`@${u.username}`);notify("Deleted");});}

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
${cg.delivs.sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map(d=>{
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

  const featureGatedTabs = [
    ...(settings?.featureVanManagement ? [] : ["Vehicles"]),
    ...(settings?.featureMachineMaintenance ? [] : ["Machines"]),
    ...(settings?.featureStaffAttendance ? [] : ["Staff"]),
  ];
  const TABS=(isAdmin?ALL_TABS:ALL_TABS.filter(tb=>userPerms.includes(tb))).filter(tb=>!featureGatedTabs.includes(tb));
  const expCats=settings?.expenseCategories||["Gas","Labour","Transport","Packaging","Utilities","Maintenance","Other"];
  const delivStats=settings?.deliveryStatuses||["Pending","In Transit","Delivered","Cancelled"];
  const supUnits=settings?.supplyUnits||["kg","g","L","mL","pcs","bags","boxes","dozen"];

  // Tab icons for nav
  const TAB_ICONS={"Dashboard":"📊","Customers":"👥","Deliveries":"🚚","Payments":"💳","Supplies":"📦","Expenses":"💸","Wastage":"🗑️","P&L":"📈","Analytics":"🔍","Production":"🏭","Ingredients":"🧂","Staff":"🧑‍🍳","Machines":"⚙️","Vehicles":"🚐","GPS":"📍","Settings":"⚙️"};
  // i18n — translate nav labels and key UI strings when featureMultiLanguage is on
  // Use this user's saved language preference (stored on user object in Firebase)
  const t18n = useT(settings, sess?.lang);
  const TAB_LABELS = {"Dashboard":t18n("dashboard"),"Customers":t18n("customers"),"Deliveries":t18n("deliveries"),"Payments":t18n("payments"),"Supplies":t18n("supplies"),"Expenses":t18n("expenses"),"P&L":t18n("pandl"),"Analytics":t18n("analytics"),"Production":t18n("production"),"Ingredients":t18n("ingredients"),"Staff":t18n("staff"),"Machines":t18n("machines"),"Vehicles":t18n("vehicles"),"GPS":t18n("gps"),"Settings":t18n("settings"),"Wastage":t18n("wastage")};

  // ── PER-CUSTOMER PDF REPORT ─────────────────────────────────────────────────
  // Generates one professional A4 page per customer with:
  //   full profile · all deliveries + batch info · financials · activity log
  function exportCustomerReports(customerIds = null) {
    const co = settings?.companyName || "TAS Healthy World";
    const now = new Date().toLocaleString("en-IN");
    const prefix = settings?.invoicePrefix || "TAS";

    // Filter to requested customers (or all active if none specified)
    const targetCustomers = customers.filter(c =>
      !c.deleted && (customerIds ? customerIds.includes(c.id) : true)
    );

    if (!targetCustomers.length) { notify("No customers to export"); return; }

    const custPages = targetCustomers.map(c => {
      const cDelivs = deliveries
        .filter(d => !d.deleted && (d.customerId === c.id || d.customer === c.name))
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

      const cDelivered = cDelivs.filter(d => d.status === "Delivered");
      const cPending   = cDelivs.filter(d => d.status === "Pending");
      const cTransit   = cDelivs.filter(d => d.status === "In Transit");
      const cCancelled = cDelivs.filter(d => d.status === "Cancelled");

      const cGrossRev  = cDelivered.reduce((s, d) => s + lineTotal(d.orderLines), 0);
      const cReplTotal = cDelivs.reduce((s, d) => s + (+d.replacement?.amount || 0), 0);
      const cNetRev    = Math.max(0, cGrossRev - cReplTotal);
      const cCollected = c.paid || 0;
      const cDue       = c.pending || 0;
      const collPct    = cCollected + cDue > 0
        ? Math.round(cCollected / (cCollected + cDue) * 100) : 100;

      // Product breakdown
      const prodBreakdown = products.map(p => {
        const qty = cDelivered.reduce((s, d) => s + (safeO(d.orderLines)[p.id]?.qty || 0), 0);
        const rev = cDelivered.reduce((s, d) => {
          const l = safeO(d.orderLines)[p.id];
          return s + ((l?.qty || 0) * (l?.priceAmount || 0));
        }, 0);
        return { name: p.name, qty, rev };
      }).filter(x => x.qty > 0).sort((a, b) => b.rev - a.rev);

      // Activity log for this customer — match by customer name or id
      const custActLog = safeArr(actLog)
        .filter(e =>
          (e.detail && (e.detail.includes(c.name) || e.detail.includes(c.id))) ||
          (e.entityId && e.entityId === c.id)
        )
        .sort((a, b) => (b.ts || "").localeCompare(a.ts || ""))
        .slice(0, 60); // cap at 60 entries per customer

      // Batch info helper
      function getBatchInfo(d) {
        if (!d.batchId) return null;
        const batch = allBatches.find(b => b.id === d.batchId || b.batchId === d.batchId);
        if (!batch) return d.batchId;
        return `${batch.batchLabel || "Batch"} · ${batch.product || ""} · ${batch.date || ""}${batch.shift ? " · " + batch.shift : ""}${batch.actual ? " · " + batch.actual + " units" : ""}${batch.qcGrade ? " · QC:" + batch.qcGrade : ""}`.replace(/\s·\s+$/,"").trim();
      }

      const invIssued = invRegistry?.issued || {};

      return `
<!-- ══════════════════════════════════════════════════════ CUSTOMER PAGE -->
<div class="page" id="cust-${c.id}">

  <!-- Header bar -->
  <div class="page-header">
    <div class="header-left">
      <div class="company-badge">${settings?.appEmoji || "🫓"}</div>
      <div>
        <div class="company-name">${co}</div>
        <div class="report-label">Customer Intelligence Report</div>
      </div>
    </div>
    <div class="header-right">
      <div class="report-date">Generated ${now}</div>
      <div class="confidential-badge">CONFIDENTIAL</div>
    </div>
  </div>

  <!-- Customer identity block -->
  <div class="identity-block">
    <div class="avatar">${(c.name || "?")[0].toUpperCase()}</div>
    <div class="identity-info">
      <div class="cust-name">${c.name}</div>
      <div class="cust-meta">
        ${c.phone ? `📞 ${c.phone}` : ""}
        ${c.phone && c.address ? " &nbsp;·&nbsp; " : ""}
        ${c.address ? `📍 ${c.address}` : ""}
        ${c.joinDate ? ` &nbsp;·&nbsp; Customer since ${c.joinDate}` : ""}
      </div>
      ${c.notes ? `<div class="cust-notes">${c.notes}</div>` : ""}
    </div>
    <div class="identity-status">
      <span class="status-pill ${c.active ? "active" : "inactive"}">${c.active ? "● Active" : "○ Inactive"}</span>
      <div class="coll-rate-label">Collection Rate</div>
      <div class="coll-rate-val" style="color:${collPct>=90?"#059669":collPct>=60?"#d97706":"#dc2626"}">${collPct}%</div>
    </div>
  </div>

  <!-- KPI strip -->
  <div class="kpi-strip">
    <div class="kpi"><div class="kpi-val green">₹${cNetRev.toLocaleString("en-IN")}</div><div class="kpi-lbl">Net Revenue</div></div>
    <div class="kpi"><div class="kpi-val green">₹${cCollected.toLocaleString("en-IN")}</div><div class="kpi-lbl">Collected</div></div>
    <div class="kpi"><div class="kpi-val ${cDue > 0 ? "red" : "green"}">₹${cDue.toLocaleString("en-IN")}</div><div class="kpi-lbl">Outstanding</div></div>
    <div class="kpi"><div class="kpi-val blue">${cDelivs.length}</div><div class="kpi-lbl">Total Orders</div></div>
    <div class="kpi"><div class="kpi-val green">${cDelivered.length}</div><div class="kpi-lbl">Delivered</div></div>
    <div class="kpi"><div class="kpi-val amber">${cPending.length + cTransit.length}</div><div class="kpi-lbl">In Progress</div></div>
    ${cReplTotal > 0 ? `<div class="kpi"><div class="kpi-val orange">₹${cReplTotal.toLocaleString("en-IN")}</div><div class="kpi-lbl">Replacements</div></div>` : ""}
    <div class="kpi"><div class="kpi-val ${cDue > 0 ? "red" : "green"}">${collPct}%</div><div class="kpi-lbl">Coll. Rate</div></div>
  </div>

  <!-- Collection progress bar -->
  ${(cCollected + cDue) > 0 ? `
  <div class="coll-bar-wrap">
    <div class="coll-bar-labels">
      <span class="green">Collected ₹${cCollected.toLocaleString("en-IN")}</span>
      <span class="${cDue > 0 ? "red" : "green"}">Due ₹${cDue.toLocaleString("en-IN")}</span>
    </div>
    <div class="coll-bar">
      <div class="coll-bar-fill" style="width:${collPct}%"></div>
    </div>
  </div>` : ""}

  <!-- Product breakdown -->
  ${prodBreakdown.length > 0 ? `
  <div class="section-title">Products Ordered</div>
  <table>
    <thead><tr><th>Product</th><th class="num">Units Ordered</th><th class="num">Revenue</th></tr></thead>
    <tbody>
      ${prodBreakdown.map(p => `
      <tr>
        <td><b>${p.name}</b></td>
        <td class="num">${p.qty.toLocaleString("en-IN")}</td>
        <td class="num green">₹${p.rev.toLocaleString("en-IN")}</td>
      </tr>`).join("")}
    </tbody>
  </table>` : ""}

  <!-- Delivery history — full detail including batch -->
  ${cDelivs.length > 0 ? `
  <div class="section-title">Complete Delivery History (${cDelivs.length} orders)</div>
  <table>
    <thead>
      <tr>
        <th>Invoice / Receipt</th>
        <th>Date</th>
        <th>Status</th>
        <th>Items</th>
        <th>Batch Info</th>
        <th class="num">Order Total</th>
        <th class="num">Replacement</th>
        <th class="num">Net</th>
        <th class="num">Collected</th>
        <th class="num">Balance Due</th>
        <th>Created By</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
      ${cDelivs.map(d => {
        const invNo = invIssued[d.id] || d.invNo || `${prefix}-${(d.date||"").replace(/-/g,"")}-${(d.id||"").slice(-4).toUpperCase()}`;
        const rcptNo = `RCP-${invNo.replace(/^[A-Z]+-/, "")}`;
        const tot  = lineTotal(d.orderLines);
        const repl = +d.replacement?.amount || 0;
        const net  = Math.max(0, tot - repl);
        const paid = d.partialPayment?.enabled ? (+d.partialPayment?.amount || 0) : 0;
        const bal  = Math.max(0, net - paid);
        const stCls = d.status === "Delivered" ? "bg" : d.status === "In Transit" ? "bb" : d.status === "Cancelled" ? "bred" : "by";
        const items = Object.entries(safeO(d.orderLines))
          .filter(([, l]) => l.qty > 0)
          .map(([pid, l]) => {
            const p = products.find(p => p.id === pid);
            return `${l.qty}× ${p?.name || l.name || pid}`;
          }).join(", ") || "—";
        const batchInfo = getBatchInfo(d);
        return `
        <tr>
          <td style="font-family:monospace;font-size:8px">
            <span class="inv-no">${invNo}</span><br>
            <span class="rcpt-no">${rcptNo}</span>
          </td>
          <td class="nowrap">${d.date || "—"}</td>
          <td><span class="badge ${stCls}">${d.status}</span></td>
          <td style="font-size:9px">${items}${d.replacement?.done ? `<br><span class="badge bo">🔄 ${d.replacement.item || "repl"} ${d.replacement.qty ? "×" + d.replacement.qty : ""}</span>` : ""}</td>
          <td style="font-size:9px;color:#7c3aed">${batchInfo || "—"}</td>
          <td class="num">₹${tot.toLocaleString("en-IN")}</td>
          <td class="num orange">${repl > 0 ? "−₹" + repl.toLocaleString("en-IN") : "—"}</td>
          <td class="num">₹${net.toLocaleString("en-IN")}</td>
          <td class="num green">${paid > 0 ? "₹" + paid.toLocaleString("en-IN") : "—"}</td>
          <td class="num ${bal > 0 ? "red" : "green"}">${bal > 0 ? "₹" + bal.toLocaleString("en-IN") : "✓ Settled"}</td>
          <td style="font-size:9px">${d.createdBy || "—"}</td>
          <td style="font-size:9px;color:#78716c;font-style:italic">${d.notes ? d.notes.slice(0, 60) + (d.notes.length > 60 ? "…" : "") : "—"}</td>
        </tr>
        ${d.replacement?.done && d.replacement?.reason ? `
        <tr class="repl-row">
          <td colspan="12" style="font-size:9px;color:#ea580c;padding:4px 8px">
            🔄 Replacement reason: ${d.replacement.reason}
          </td>
        </tr>` : ""}
        ${d.partialPayment?.enabled && d.partialPayment?.note ? `
        <tr class="repl-row">
          <td colspan="12" style="font-size:9px;color:#059669;padding:4px 8px">
            💬 Payment note: ${d.partialPayment.note}
          </td>
        </tr>` : ""}`;
      }).join("")}
    </tbody>
    <tfoot>
      <tr class="totals-row">
        <td colspan="5"><b>Customer Totals</b></td>
        <td class="num"><b>₹${cGrossRev.toLocaleString("en-IN")}</b></td>
        <td class="num orange"><b>${cReplTotal > 0 ? "−₹" + cReplTotal.toLocaleString("en-IN") : "—"}</b></td>
        <td class="num"><b>₹${cNetRev.toLocaleString("en-IN")}</b></td>
        <td class="num green"><b>₹${cCollected.toLocaleString("en-IN")}</b></td>
        <td class="num ${cDue > 0 ? "red" : "green"}"><b>${cDue > 0 ? "₹" + cDue.toLocaleString("en-IN") : "✓ Settled"}</b></td>
        <td colspan="2"></td>
      </tr>
    </tfoot>
  </table>` : `<div class="empty-state">No delivery records found for this customer.</div>`}

  <!-- Activity Log -->
  ${custActLog.length > 0 ? `
  <div class="section-title">Activity Log (${custActLog.length} events)</div>
  <table>
    <thead>
      <tr><th>Timestamp</th><th>Action</th><th>Detail</th><th>User</th><th>Role</th><th>Device</th></tr>
    </thead>
    <tbody>
      ${custActLog.map(e => `
      <tr>
        <td class="nowrap" style="font-family:monospace;font-size:8px">${e.ts ? new Date(e.ts).toLocaleString("en-IN") : "—"}</td>
        <td style="font-size:9px;font-weight:600">${e.action || "—"}</td>
        <td style="font-size:9px;color:#57534e">${e.detail || "—"}</td>
        <td style="font-size:9px">${e.user || "—"}</td>
        <td style="font-size:9px;color:#7c3aed">${e.role || "—"}</td>
        <td style="font-size:8px;color:#a8a29e">${[e.deviceType, e.browser, e.os].filter(Boolean).join(" · ") || "—"}</td>
      </tr>`).join("")}
    </tbody>
  </table>` : ""}

  <!-- Page footer -->
  <div class="page-footer">
    <span>${co} · Customer Report · ${c.name}</span>
    <span>Exported ${now} · CONFIDENTIAL</span>
  </div>
</div>`;
    }).join('<div class="page-break"></div>');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Customer Reports — ${co}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
    font-size: 11px;
    color: #1c1917;
    background: #f5f5f4;
    padding: 20px;
  }
  @media print {
    body { background: #fff; padding: 0; }
    .page-break { page-break-after: always; }
    @page { margin: 1.5cm 1.2cm; size: A4 portrait; }
  }
  .page {
    background: #fff;
    max-width: 960px;
    margin: 0 auto 40px;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 12px rgba(0,0,0,0.1);
    padding-bottom: 24px;
  }
  @media print { .page { box-shadow: none; margin: 0; border-radius: 0; max-width: 100%; } }

  /* Header */
  .page-header {
    background: linear-gradient(135deg, #1e3a5f 0%, #0f2744 100%);
    color: #fff;
    padding: 20px 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .header-left { display: flex; align-items: center; gap: 14px; }
  .company-badge {
    width: 44px; height: 44px; border-radius: 12px;
    background: rgba(255,255,255,0.15);
    border: 1.5px solid rgba(255,255,255,0.25);
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; flex-shrink: 0;
  }
  .company-name { font-size: 15px; font-weight: 800; letter-spacing: -0.02em; }
  .report-label { font-size: 10px; opacity: 0.7; margin-top: 2px; letter-spacing: 0.05em; text-transform: uppercase; }
  .header-right { text-align: right; flex-shrink: 0; }
  .report-date { font-size: 10px; opacity: 0.7; }
  .confidential-badge {
    margin-top: 4px;
    display: inline-block;
    font-size: 9px; font-weight: 800; letter-spacing: 0.1em;
    background: rgba(239,68,68,0.25); color: #fca5a5;
    border: 1px solid rgba(239,68,68,0.4);
    border-radius: 4px; padding: 2px 8px;
  }

  /* Identity block */
  .identity-block {
    display: flex; align-items: flex-start; gap: 18px;
    padding: 22px 28px 18px;
    border-bottom: 2px solid #f5f5f4;
  }
  .avatar {
    width: 52px; height: 52px; border-radius: 14px;
    background: #fef3c7; color: #92400e;
    font-size: 24px; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .identity-info { flex: 1; min-width: 0; }
  .cust-name { font-size: 18px; font-weight: 900; color: #1c1917; line-height: 1.2; }
  .cust-meta { font-size: 11px; color: #78716c; margin-top: 4px; line-height: 1.6; }
  .cust-notes {
    font-size: 10px; color: #57534e; font-style: italic; margin-top: 6px;
    background: #fafaf9; border-left: 3px solid #e7e5e4; padding: 4px 10px; border-radius: 0 6px 6px 0;
  }
  .identity-status { text-align: right; flex-shrink: 0; }
  .status-pill {
    display: inline-block; font-size: 10px; font-weight: 700;
    border-radius: 99px; padding: 3px 10px;
  }
  .status-pill.active  { background: #d1fae5; color: #065f46; }
  .status-pill.inactive{ background: #f5f5f4; color: #78716c; }
  .coll-rate-label { font-size: 9px; color: #a8a29e; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.06em; }
  .coll-rate-val { font-size: 22px; font-weight: 900; line-height: 1.1; }

  /* KPI strip */
  .kpi-strip {
    display: flex; flex-wrap: wrap; gap: 0;
    border-bottom: 1px solid #f5f5f4;
  }
  .kpi {
    flex: 1; min-width: 100px;
    padding: 14px 16px;
    border-right: 1px solid #f5f5f4;
    text-align: center;
  }
  .kpi:last-child { border-right: none; }
  .kpi-val { font-size: 15px; font-weight: 900; line-height: 1; }
  .kpi-lbl { font-size: 9px; color: #78716c; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.06em; }

  /* Collection bar */
  .coll-bar-wrap { padding: 10px 28px 6px; }
  .coll-bar-labels { display: flex; justify-content: space-between; font-size: 10px; font-weight: 700; margin-bottom: 4px; }
  .coll-bar { height: 8px; background: #fecaca; border-radius: 99px; overflow: hidden; }
  .coll-bar-fill { height: 100%; background: #059669; border-radius: 99px; }

  /* Sections */
  .section-title {
    font-size: 9px; font-weight: 800; letter-spacing: 0.08em;
    text-transform: uppercase; color: #a8a29e;
    padding: 18px 28px 8px;
    border-top: 1px solid #f5f5f4;
    margin-top: 6px;
  }

  /* Tables */
  table { width: 100%; border-collapse: collapse; margin: 0 0 0; font-size: 10px; }
  thead th {
    font-size: 8px; font-weight: 800; text-transform: uppercase;
    letter-spacing: 0.06em; color: #a8a29e;
    padding: 7px 6px 7px 8px;
    border-bottom: 2px solid #e7e5e4;
    text-align: left; background: #fafaf9;
  }
  thead th.num { text-align: right; }
  tbody td {
    padding: 7px 6px 7px 8px;
    border-bottom: 1px solid #f5f5f4;
    vertical-align: top;
  }
  tbody tr:hover { background: #fafaf9; }
  .num { text-align: right; }
  tfoot .totals-row td {
    padding: 8px 6px 8px 8px;
    font-size: 10px;
    background: #f5f5f4;
    border-top: 2px solid #e7e5e4;
  }
  .repl-row td { background: #fff7ed; border-bottom: 1px solid #fed7aa; }

  /* Badges */
  .badge { display: inline-block; padding: 2px 7px; border-radius: 99px; font-size: 8px; font-weight: 800; white-space: nowrap; }
  .bg  { background: #d1fae5; color: #065f46; }
  .bb  { background: #dbeafe; color: #1e40af; }
  .by  { background: #fef3c7; color: #92400e; }
  .bred{ background: #fee2e2; color: #991b1b; }
  .bo  { background: #ffedd5; color: #9a3412; }

  /* Colours */
  .green  { color: #059669; }
  .red    { color: #dc2626; }
  .amber  { color: #d97706; }
  .orange { color: #ea580c; }
  .blue   { color: #0369a1; }

  /* Invoice/receipt codes */
  .inv-no  { color: #7c3aed; font-family: monospace; }
  .rcpt-no { color: #0ea5e9; font-family: monospace; }
  .nowrap { white-space: nowrap; }

  /* Footer */
  .page-footer {
    margin: 20px 28px 0;
    padding-top: 10px;
    border-top: 1px solid #e7e5e4;
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: #a8a29e;
  }

  /* Empty state */
  .empty-state {
    text-align: center; color: #a8a29e; font-size: 11px; padding: 24px 28px;
    font-style: italic;
  }
  .page-break { display: none; }
  @media print { .page-break { display: block; } }
</style>
</head>
<body>
${custPages}
<script>window.addEventListener("load", function(){ window.print(); });</script>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    addLog("Exported customer reports", `${targetCustomers.length} customer PDF${targetCustomers.length > 1 ? "s" : ""}`);
    notify(`📄 ${targetCustomers.length} customer report${targetCustomers.length > 1 ? "s" : ""} opening…`);
  }

  // ── PER-CUSTOMER PDF REPORT ─────────────────────────────────────────────────

  if(!dataLoaded) return <div style={{background:dm?"#0c0c10":"#f2f2ed",height:"100svh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}><div style={{width:40,height:40,border:"3px solid #f59e0b",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/><p style={{color:"#f59e0b",fontSize:12,fontWeight:600,letterSpacing:1}}>Loading data…</p><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>;

  // ─────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════
  return (
    <>
    <style>{`
      /* ── RESPONSIVE GLOBAL LAYOUT ── */
      html,body{-webkit-text-size-adjust:100%;text-size-adjust:100%;}
      *{box-sizing:border-box;}

      /* ── Grid utilities — fully responsive with auto-fit ── */
      .crm-grid-2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:12px;}
      .crm-grid-3{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr));gap:10px;}
      .crm-grid-4{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(160px,100%),1fr));gap:10px;}
      @media(min-width:640px){
        .crm-grid-2{grid-template-columns:repeat(2,1fr);}
        .crm-grid-3{grid-template-columns:repeat(3,1fr);}
        .crm-grid-4{grid-template-columns:repeat(4,1fr);}
      }
      @media(max-width:360px){
        .crm-grid-2,.crm-grid-3,.crm-grid-4{grid-template-columns:1fr!important;}
      }
      /* ── Toolbar rows — flex-wrap with proper gap ── */
      .crm-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;}
      .crm-toolbar-split{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;}
      .crm-action-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
      .crm-btn-group{display:flex;flex-wrap:wrap;gap:6px;align-items:center;}
      /* ── Filter pill rows ── */
      .crm-filter-pills{display:flex;flex-wrap:wrap;gap:6px;align-items:center;}
      @media(max-width:600px){
        .crm-filter-pills{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:3px;}
        .crm-filter-pills::-webkit-scrollbar{display:none;}
      }
      /* ── Two-column responsive panels ── */
      .crm-two-col{display:grid;grid-template-columns:1fr;gap:14px;}
      @media(min-width:768px){.crm-two-col{grid-template-columns:repeat(2,1fr);}}
      /* ── Flex overflow prevention ── */
      .crm-flex-child{min-width:0;overflow:hidden;}
      .crm-truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .crm-flex-row{display:flex;flex-wrap:wrap;gap:8px;min-width:0;}
      .crm-flex-row>*{min-width:0;}
      /* ── Section spacing ── */
      .crm-section-gap{display:flex;flex-direction:column;gap:14px;}
      @media(min-width:1024px){.crm-section-gap{gap:18px;}}
      /* ── List rows ── */
      .crm-list-row{display:flex;align-items:center;gap:10px;padding:12px 14px;min-width:0;}
      .crm-list-row>*{min-width:0;}
      /* ── Pagination ── */
      .crm-pagination{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:12px 18px;}

      /* Bottom nav only on small screens */
      .crm-nav-bottom{display:none;}
      @media(max-width:1023px){
        .crm-nav-bottom{display:flex!important;position:fixed;bottom:0;left:0;right:0;z-index:100;background:#0d1b2a;border-top:1px solid #1e2d3d;padding-bottom:env(safe-area-inset-bottom,0px);}
      }

      /* Main content area safe-area + bottom nav + FAB dock clearance */
      @media(max-width:639px){
        /* mobile: bottom nav (~64px) + FAB dock (~48px) + gap */
        .crm-main-content{padding-bottom:calc(78px + 56px + env(safe-area-inset-bottom,0px))!important;}
      }
      @media(min-width:640px) and (max-width:1023px){
        /* tablet: FAB dock at bottom:24px + its height (~48px) + breathing room */
        .crm-main-content{padding-bottom:calc(24px + 56px + 16px + env(safe-area-inset-bottom,0px))!important;}
      }

      /* Mobile-first content padding */
      .crm-tab-content{padding:12px 12px 0;}
      @media(min-width:640px){.crm-tab-content{padding:16px 16px 0;}}
      @media(min-width:1024px){.crm-tab-content{padding:22px 24px 0;}}
      @media(min-width:1280px){.crm-tab-content{padding:28px 32px 0;}}

      /* Sheets — full bottom sheet on mobile, centered modal on sm+ */
      .crm-sheet-panel-mobile{border-radius:20px 20px 0 0;}
      @media(min-width:640px){
        .crm-sheet-panel-desktop{border-radius:18px!important;max-width:520px;margin:auto;}
      }
      @media(min-width:1024px){
        .crm-sheet-panel-desktop{max-width:580px;}
      }

      /* Touch-friendly tap targets */
      @media(max-width:1023px){
        button{min-height:40px;}
      }
      @media(max-width:640px){
        button{min-height:44px;}
      }

      /* Overflow tables on small screens */
      .crm-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;}
      .crm-table-wrap table{min-width:600px;}

      /* Typography scaling */
      @media(max-width:640px){
        .crm-stat-val{font-size:20px!important;}
      }

      /* Desktop sidebar — wider on large displays */
      @media(min-width:1440px){
        .crm-sidebar{width:240px!important;}
      }

      /* Scrollbar styling — desktop */
      @media(min-width:1024px){
        ::-webkit-scrollbar{width:6px;height:6px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(128,128,128,0.3);border-radius:99px;}
        ::-webkit-scrollbar-thumb:hover{background:rgba(128,128,128,0.5);}
      }

      /* Hide scrollbar utility */
      .no-scrollbar::-webkit-scrollbar{display:none;}
      .no-scrollbar{-ms-overflow-style:none;scrollbar-width:none;}

      /* Animations */
      @keyframes fadeSlideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      .crm-fade-in{animation:fadeSlideUp 0.22s ease both;}

      /* Card hover — desktop only */
      @media(min-width:1024px){
        .crm-hover-card{transition:box-shadow 0.18s,transform 0.18s;}
        .crm-hover-card:hover{box-shadow:0 4px 20px rgba(0,0,0,0.12)!important;transform:translateY(-1px);}
      }

      /* Tablet layout adjustments */
      @media(min-width:640px) and (max-width:1023px){
        .crm-tab-content{padding:16px 20px 0;}
      }
    `}</style>
    <div style={{background:t.bg,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',Helvetica,Arial,sans-serif",minHeight:"100svh"}} className="flex flex-col lg:flex-row">
      <BrowserBanner dm={dm} />
      <aside style={{background:"#0d1b2a",borderRight:"1px solid #1e2d3d",width:220,minHeight:"100svh"}} className="crm-sidebar hidden lg:flex flex-col shrink-0 lg:sticky lg:top-0 lg:max-h-screen lg:overflow-y-auto">
        {/* Logo */}
        <div style={{borderBottom:"1px solid #1e2d3d",padding:"22px 18px 20px"}} className="flex items-center gap-3">
          <div style={{background:"rgba(37,99,235,0.18)",border:"1.5px solid rgba(37,99,235,0.3)",borderRadius:12,width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,userSelect:"none",flexShrink:0,boxShadow:"0 2px 8px rgba(37,99,235,0.25)"}}>{settings?.appEmoji||"🫓"}</div>
          <div className="min-w-0">
            <p style={{color:"#f0f4f8",fontWeight:800,fontSize:14,letterSpacing:"-0.02em",lineHeight:1.2}} className="truncate">{settings?.appName||"TAS Healthy World"}</p>
            <p style={{color:"#7ea0be",fontSize:11,letterSpacing:"0.01em",marginTop:2}} className="truncate">{settings?.appSubtitle||"Business CRM"}</p>
          </div>
        </div>
        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          {TABS.map((tb,idx)=>{
            const isActive=tab===tb;
            return(
            <button key={tb} onClick={()=>{setTab(tb);setSrch("");}}
              style={{
                background:isActive?"#2563eb":"transparent",
                color:isActive?"#ffffff":"rgba(240,244,248,0.6)",
                borderRadius:10,
                padding:"10px 12px",
                boxShadow:isActive?"0 2px 8px rgba(37,99,235,0.35)":"none",
                transition:"all 0.12s",
                minHeight:44,
              }}
              onMouseEnter={e=>{if(!isActive){e.currentTarget.style.background="rgba(255,255,255,0.06)";e.currentTarget.style.color="rgba(240,244,248,0.9)";}}}
              onMouseLeave={e=>{if(!isActive){e.currentTarget.style.background="transparent";e.currentTarget.style.color="rgba(240,244,248,0.6)";}}}
              className="flex items-center gap-3 text-left w-full">
              <span style={{fontSize:17,width:24,textAlign:"center",flexShrink:0,lineHeight:1,opacity:isActive?1:0.8}}>{TAB_ICONS[tb]||"•"}</span>
              <span style={{fontSize:13,fontWeight:isActive?700:500,letterSpacing:"0.005em"}} className="truncate">{TAB_LABELS[tb]||tb}</span>
              {tb==="Dashboard"&&pendingD.length>0&&!isActive&&<span style={{marginLeft:"auto",fontSize:9,fontWeight:800,background:"#2563eb",color:"#fff",borderRadius:99,minWidth:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px",flexShrink:0}}>{pendingD.length}</span>}
            </button>
          );})}
        </nav>
        {/* Sidebar footer */}
        <div style={{borderTop:"1px solid #1e2d3d",padding:"14px 14px"}} className="flex flex-col gap-3">
          {/* Staff picker dropdown in sidebar */}
          {subStaff.length>0&&(
            <select value={activeStaff} onChange={e=>setActiveStaff(e.target.value)}
              style={{background:"rgba(255,255,255,0.06)",border:`1px solid ${t.sidebarBorder}`,color:t.sidebarText,fontSize:12,width:"100%",borderRadius:8,padding:"9px 10px",outline:"none",WebkitAppearance:"none",appearance:"none"}}>
              {subStaff.map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          )}
          {/* User info */}
          <div style={{background:"rgba(255,255,255,0.05)",borderRadius:12,padding:"11px 12px",border:`1px solid ${t.sidebarBorder}`}} className="flex items-center gap-3">
            <div style={{background:"#2563eb",borderRadius:10,width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:13,flexShrink:0,letterSpacing:"-0.01em",userSelect:"none"}}>{displayName.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}</div>
            <div className="flex-1 min-w-0">
              <p style={{color:t.sidebarText,fontSize:13,fontWeight:700,lineHeight:1.2}} className="truncate">{displayName}</p>
              <p style={{color:t.sidebarSub,fontSize:11,textTransform:"capitalize",marginTop:1}} className="truncate">{sess.role}</p>
            </div>
            <button onClick={onLogout} title="Sign out" style={{background:"rgba(239,68,68,0.12)",color:"#f87171",border:"1px solid rgba(239,68,68,0.25)",borderRadius:9,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,cursor:"pointer",flexShrink:0}}>↩</button>
          </div>
          <button onClick={()=>setDm(d=>!d)} style={{background:"rgba(255,255,255,0.07)",color:"rgba(232,237,245,0.75)",border:`1px solid ${t.sidebarBorder}`,width:"100%",borderRadius:10,padding:"10px",fontSize:12,fontWeight:600,cursor:"pointer",WebkitTapHighlightColor:"transparent",minHeight:42}}>{dm?"☀ Light":"⬡ Dark"}</button>
          {/* #18 Presence — who else is online */}
          <PresenceBar peers={peers} dm={dm} t={{...t, border:t.sidebarBorder, sub:t.sidebarSub, text:t.sidebarText, inp:"rgba(255,255,255,0.06)"}} />
          <div className="flex items-center gap-2 px-0.5">
            <SystemHealthDot dm={dm} _syncListeners={_syncListeners} />
            <p style={{color:"rgba(232,237,245,0.4)",fontSize:10,letterSpacing:"0.02em"}}>{lastSync?`Synced ${lastSync.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}`:"Connecting\u2026"}</p>
          </div>
        </div>
      </aside>

      {/* ── MOBILE / TABLET MAIN AREA ─────────────────────────── */}
      <div className="crm-main-content" style={{flex:1,minWidth:0,paddingBottom:"calc(68px + env(safe-area-inset-bottom,0px))"}} onClick={hideFabDock} onTouchStart={hideFabDock}>
      {/* HEADER — full topbar, sticky, white/card bg */}
      <header style={{background:t.topbar,borderBottom:`1px solid ${t.topbarBorder}`,boxShadow:dm?"0 1px 0 rgba(255,255,255,0.03)":"0 1px 3px rgba(0,0,0,0.05)"}} className="sticky top-0 z-30">
        <div className="px-3 sm:px-4 lg:px-6 flex items-center gap-2 sm:gap-3" style={{height:56,paddingTop:"env(safe-area-inset-top,0px)"}}>

          {/* LEFT — brand (mobile) / page title (desktop) */}
          <div className="flex items-center shrink-0">
            {/* Mobile: app logo only on tiny screens, logo+name on sm+ */}
            <div className="flex lg:hidden items-center gap-2 min-w-0">
              <div style={{background:"rgba(37,99,235,0.1)",border:"1.5px solid rgba(37,99,235,0.2)",width:34,height:34,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,userSelect:"none",flexShrink:0}}>{settings?.appEmoji||"🫓"}</div>
              <p style={{color:t.text,fontSize:14,fontWeight:800,lineHeight:1,letterSpacing:"-0.02em"}} className="truncate hidden xs:block sm:block max-w-[100px]">{settings?.appName||"TAS"}</p>
            </div>
            {/* Desktop: current tab title */}
            <div className="hidden lg:flex items-center gap-3">
              <span style={{fontSize:22,lineHeight:1}}>{TAB_ICONS[tab]||"•"}</span>
              <h1 style={{color:t.text,fontWeight:800,fontSize:20,letterSpacing:"-0.02em",lineHeight:1}}>{TAB_LABELS[tab]||tab}</h1>
            </div>
          </div>

          {/* CENTER — search bar: grows to fill available space */}
          <div className="flex flex-1 min-w-0 relative" style={{marginLeft:4,maxWidth:320}}>
            <svg style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",flexShrink:0}} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              value={srch}
              onChange={e=>setSrch(e.target.value)}
              placeholder={tab==="Customers"?"Search…":tab==="Deliveries"?"Search…":tab==="Supplies"?"Search…":tab==="Expenses"?"Search…":tab==="Payments"?"Search…":"Search…"}
              style={{background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:11,padding:"7px 28px 7px 30px",fontSize:13,outline:"none",width:"100%",minWidth:0,transition:"border-color 0.15s,box-shadow 0.15s"}}
              onFocus={e=>{e.target.style.borderColor="#2563eb";e.target.style.boxShadow="0 0 0 3px rgba(37,99,235,0.12)";}}
              onBlur={e=>{e.target.style.borderColor=t.inpB;e.target.style.boxShadow="none";}}
            />
            {srch&&<button onClick={()=>setSrch("")} style={{position:"absolute",right:7,top:"50%",transform:"translateY(-50%)",background:t.inpB,color:t.sub,width:17,height:17,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,border:"none",cursor:"pointer"}}>✕</button>}
          </div>

          {/* RIGHT — notifications + avatar + dark mode */}
          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto shrink-0">

            {/* Kanban + Audit — desktop only; FAB dock handles mobile/tablet */}
            <div className="hidden lg:flex items-center gap-1.5">
              <KanbanButton dm={dm} t={t} onClick={() => setKanbanOpen(true)} />
              {isAdmin && (
                <AuditLogButton dm={dm} t={t} onClick={() => setAuditOpen(true)} />
              )}
            </div>

            {/* #18 Search / Command Palette button */}
            {isAdmin && (
              <CommandPaletteButton dm={dm} t={t} onClick={() => setCmdOpen(true)} />
            )}

            {/* #18 Presence dot — who else is online */}
            <PresenceDot peers={peers} dm={dm} t={t} />

            {/* Trash */}
            {isAdmin && (
              <TrashButton count={trashedItems.length} dm={dm} t={t} onClick={() => setTrashOpen(true)} />
            )}

            {/* Activity Timeline */}
            <ActivityTimelineButton dm={dm} t={t} onClick={() => setTimelineOpen(true)} />

            {/* Widget Customizer (only on Dashboard when featureCustomDashboard is on) */}
            {tab === "Dashboard" && settings?.featureCustomDashboard && (
              <WidgetCustomizerButton dm={dm} t={t} onClick={() => setCustOpen(true)} />
            )}

            {/* Bell */}
            <div className="relative">
              <button onClick={()=>{setNotifOpen(o=>!o);if(unreadNotifs>0)markAllRead();}} style={{background:t.inp,color:t.text,border:`1.5px solid ${t.border}`,width:34,height:34,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",position:"relative"}}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                {unreadNotifs>0&&<span key={unreadNotifs} style={{position:"absolute",top:-4,right:-4,background:"#ef4444",color:"#fff",fontSize:9,fontWeight:800,borderRadius:99,minWidth:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px",border:`2px solid ${t.card}`}} className="crm-notif-badge">{unreadNotifs>9?"9+":unreadNotifs}</span>}
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

            {/* Dark mode toggle — always visible */}
            <button onClick={()=>setDm(d=>!d)} style={{background:t.inp,color:t.text,border:`1px solid ${t.border}`,width:34,height:34,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",cursor:"pointer"}} className="select-none">{dm?"☀️":"🌙"}</button>

            {/* Avatar pill — click = dropdown with sign out */}
            <div className="hidden lg:flex items-center gap-2 pl-1 relative">
              <button onClick={()=>setAvatarOpen(o=>!o)}
                style={{display:"flex",alignItems:"center",gap:8,background:t.inp,border:`1px solid ${t.border}`,borderRadius:11,padding:"5px 12px 5px 5px",cursor:"pointer",userSelect:"none"}}>
                <div style={{width:28,height:28,borderRadius:8,background:"#2563eb",color:"#fff",fontWeight:800,fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {displayName.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                </div>
                <div className="text-left" style={{maxWidth:110}}>
                  <p style={{color:t.text,fontWeight:700,fontSize:12,lineHeight:1.2}} className="truncate">{displayName}</p>
                  <p style={{color:t.sub,fontSize:10,textTransform:"capitalize"}}>{sess.role}</p>
                </div>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {avatarOpen&&<>
                <div onClick={()=>setAvatarOpen(false)} style={{position:"fixed",inset:0,zIndex:199}}/>
                <div style={{position:"absolute",top:"calc(100% + 8px)",right:0,background:t.card,border:`1px solid ${t.border}`,borderRadius:12,padding:8,minWidth:160,boxShadow:"0 8px 24px rgba(0,0,0,0.12)",zIndex:200}}>
                  <div style={{padding:"8px 10px 10px",borderBottom:`1px solid ${t.border}`,marginBottom:6}}>
                    <p style={{color:t.text,fontWeight:700,fontSize:13}}>{displayName}</p>
                    <p style={{color:t.sub,fontSize:11,textTransform:"capitalize",marginTop:2}}>{sess.role}</p>
                  </div>
                  <button onClick={()=>{setDm(d=>!d);setAvatarOpen(false);}} style={{width:"100%",textAlign:"left",background:"transparent",border:"none",padding:"8px 10px",borderRadius:8,color:t.text,fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
                    {dm?"☀️ Light mode":"🌙 Dark mode"}
                  </button>
                  <button onClick={onLogout} style={{width:"100%",textAlign:"left",background:"rgba(239,68,68,0.07)",border:"none",padding:"8px 10px",borderRadius:8,color:"#ef4444",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:8,marginTop:2}}>
                    ↩ Sign out
                  </button>
                </div>
              </>}
            </div>

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
                <p className="text-xs font-semibold text-red-400">You're offline — changes may not save until reconnected</p>
                <p className="text-[11px] text-red-400/70">Data will sync automatically when connection is restored</p>
              </div>
            </div>
            <button onClick={()=>setIsOffline(false)} className="text-xs text-red-400/60 hover:text-red-400 shrink-0">✕</button>
          </div>
        </div>
      )}

      <div className="w-full max-w-full sm:max-w-3xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-5 lg:px-8 xl:px-10 py-5 sm:py-6 flex flex-col gap-0 crm-tab-content" key={tab}>

        {/* DASHBOARD */}
        {tab==="Dashboard"&&(<>
          <SmartDashboard
            sess={sess} settings={settings} dm={dm} t={t}
            isAdmin={isAdmin} can={can}
            canSeeFinancials={canSeeFinancials} canSeePrices={canSeePrices}
            customers={customers} deliveries={deliveries}
            expenses={expenses} supplies={supplies} wastage={wastage}
            products={products} actLog={actLog}
            paymentLedger={paymentLedger}
            dashStats={dashStats} chartData={chartData}
            lowStockItems={lowStockItems} churnedCustomers={churnedCustomers}
            churnDays={churnDays} allBatches={allBatches}
            notices={notices} setNotices={setNotices}
            setTab={setTab} setDetailModal={setDetailModal}
            setDsh={setDsh} setDf={setDf} blkD={blkD}
            setCsh={setCsh} setCf={setCf} blkC={blkC}
            setEsh={setEsh} setEf={setEf} blkE={blkE}
            setSsh={setSsh} setSf={setSf} blkS={blkS}
            setWSh={setWSh} setWF={setWF} blkW={blkW}
            setPaySh={setPaySh}
            inr={inr} lineTotal={lineTotal} today={today}
            userDashWidgets={userDashWidgets}
            setUserDashWidgets={setUserDashWidgets}
            _syncListeners={_syncListeners}
            dragHandlers={dragHandlers}
            featureCustomDashboard={!!settings?.featureCustomDashboard}
          />
          {/* #19 Predictive summary badges */}
          {isAdmin && (
            <div style={{marginTop:16}}>
              <PredictiveSummaryBadges
                predictions={predictions} dm={dm} t={t}
                onSectionClick={() => setTab("Analytics")}
              />
            </div>
          )}
        </>)}

        {/* CUSTOMERS */}
        {tab==="Customers"&&(()=>{
          const isMobile=typeof window!=="undefined"&&window.innerWidth<768;
          return (<>
          <SectionHeader dm={dm} title="Customers" sub="Manage all your customers in one place"
            cta={can("cust_add")&&<button onClick={()=>{setCsh("add");setCf(blkC());}}
              style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:12,padding:"11px 20px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:7,boxShadow:"0 2px 8px rgba(37,99,235,0.3)"}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Customer
            </button>}/>
          {canSeeFinancials&&<TabStatCards dm={dm} cards={[
            {icon:"👥",label:"Active Customers",value:activeC.length,sub:`${customers.length} total`,iconBg:t.statIcon1},
            {icon:"💰",label:"Total Collected",value:inr(dashTotalCollected),sub:"All time",iconBg:t.statIcon2},
            {icon:"⚠️",label:"Outstanding",value:inr(totalDue),sub:`${dashStats.allDue.length} unpaid`,iconBg:t.statIcon5},
            {icon:"🔄",label:"Replacements",value:dashReplacementCount,sub:inr(totalReplDeductions)+" deducted",iconBg:t.statIcon3},
            {icon:"⚡",label:"Partial Payments",value:dashPartialCount,sub:inr(dashPartialTotal)+" collected",iconBg:t.statIcon4},
          ]}/>}

          {/* #19 Churn risk — show high-risk customers at the top */}
          {isAdmin && predictions?.highRisk?.length > 0 && (
            <ChurnRiskTable
              predictions={predictions} dm={dm} t={t} limit={4}
              onSelectCustomer={c => {
                const full = customers.find(x => x.id === c.id);
                if (full) setDetailModal({ type:"customer", data:full });
              }}
            />
          )}

          {/* OVERDUE PAYMENT ALERT BANNER */}
          {canSeeFinancials&&(()=>{
            const overdueC=customers.filter(c=>c.pending>0&&c.active);
            const totalOverdue=overdueC.reduce((s,c)=>s+(c.pending||0),0);
            const totalReplDeducted=deliveries.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
            const partialCount=deliveries.filter(d=>d.partialPayment?.enabled&&(+(d.partialPayment?.amount)||0)>0&&Math.max(0,lineTotal(d.orderLines)-(+d.replacement?.amount||0))>(+(d.partialPayment?.amount)||0)).length;
            if(!overdueC.length) return null;
            return <div style={{background:dm?"rgba(239,68,68,0.07)":"#fff5f5",border:`1.5px solid ${dm?"rgba(239,68,68,0.25)":"rgba(239,68,68,0.25)"}`,borderRadius:18,overflow:"hidden"}}>
              {/* Header stripe */}
              <div style={{background:dm?"rgba(239,68,68,0.12)":"rgba(239,68,68,0.08)",borderBottom:isMobile?(overdueAlertExpanded?`1px solid ${dm?"rgba(239,68,68,0.2)":"rgba(239,68,68,0.15)"}`:"none"):`1px solid ${dm?"rgba(239,68,68,0.2)":"rgba(239,68,68,0.15)"}`,padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:isMobile?"nowrap":"wrap",gap:10,cursor:isMobile?"pointer":"default"}}
                onClick={isMobile?()=>setOverdueAlertExpanded&&setOverdueAlertExpanded(v=>!v):undefined}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:32,height:32,borderRadius:10,background:"#ef444420",border:"1.5px solid #ef444430",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🔴</div>
                  <div>
                    <p style={{color:"#dc2626",fontWeight:800,fontSize:13,lineHeight:1.2}}>{overdueC.length} customer{overdueC.length!==1?"s":""} with overdue payments</p>
                    <p style={{color:dm?"#fca5a5":"#b91c1c",fontSize:11,fontWeight:600,marginTop:2}}>Total outstanding: <span style={{fontWeight:800}}>{inr(totalOverdue)}</span></p>
                  </div>
                </div>
                {isMobile
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" style={{flexShrink:0,transform:overdueAlertExpanded?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}><polyline points="6 9 12 15 18 9"/></svg>
                  : <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    {totalReplDeducted>0&&<span style={{background:"#f9731612",color:"#f97316",border:"1px solid #f9731625",borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:700}}>🔄 {inr(totalReplDeducted)} replaced</span>}
                    {partialCount>0&&<span style={{background:"#f59e0b12",color:"#f59e0b",border:"1px solid #f59e0b25",borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:700}}>⚡ {partialCount} partial</span>}
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <label style={{color:t.sub,fontSize:11}}>Over</label>
                      <select value={overdueAlertDays} onChange={e=>setOverdueAlertDays(+e.target.value)} style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,fontSize:12,borderRadius:8,padding:"4px 8px",outline:"none"}}>
                        {[1,3,7,14,30].map(d=><option key={d} value={d}>{d}d</option>)}
                      </select>
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"nowrap",alignItems:"center",flexShrink:0}}>
                    {isAdmin&&<button onClick={()=>{setPaymentsSubTab("outstanding");setTab("Payments");}} style={{background:"#3b82f615",color:"#3b82f6",border:"1px solid #3b82f630",borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>Full Ledger →</button>}
                    <Btn dm={dm} v="danger" size="sm" onClick={()=>{
                      const cols=[{label:"Customer",key:"name"},{label:"Phone",key:"phone"},{label:"Pending (₹)",key:"pending",num:true},{label:"Status",val:r=>r.pending>0?"UNPAID":"PAID"}];
                      gExport("pdf",()=>exportTabPDF("Overdue Payments",[...overdueC].sort((a,b)=>b.pending-a.pending),cols,settings,`<div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:10px;padding:12px 16px;margin-bottom:20px"><b style="color:#b91c1c">Total Outstanding: ${inr(totalOverdue)}</b> across ${overdueC.length} customers</div>`),"Overdue Payments PDF");
                    }}>PDF</Btn>
                    </div>
                  </div>
                }
              </div>
              {/* Customer rows — always visible on desktop, toggle on mobile */}
              {(!isMobile||overdueAlertExpanded)&&<div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:6}}>
                {isMobile&&<div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",paddingBottom:8,borderBottom:`1px solid rgba(239,68,68,0.15)`,marginBottom:4}}>
                  {totalReplDeducted>0&&<span style={{background:"#f9731612",color:"#f97316",border:"1px solid #f9731625",borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:700}}>🔄 {inr(totalReplDeducted)} replaced</span>}
                  {partialCount>0&&<span style={{background:"#f59e0b12",color:"#f59e0b",border:"1px solid #f59e0b25",borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:700}}>⚡ {partialCount} partial</span>}
                  <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:"auto"}}>
                    <label style={{color:t.sub,fontSize:11}}>Over</label>
                    <select value={overdueAlertDays} onChange={e=>setOverdueAlertDays(+e.target.value)} onClick={e=>e.stopPropagation()} style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,fontSize:12,borderRadius:8,padding:"4px 8px",outline:"none"}}>
                      {[1,3,7,14,30].map(d=><option key={d} value={d}>{d}d</option>)}
                    </select>
                  </div>
                </div>}
                {[...overdueC].sort((a,b)=>b.pending-a.pending).slice(0,5).map((c,idx)=>{
                  const cRepl=deliveries.filter(d=>d.customerId===c.id).reduce((s,d)=>s+(+d.replacement?.amount||0),0);
                  const cPartial=deliveries.filter(d=>d.customerId===c.id&&d.partialPayment?.enabled&&(+(d.partialPayment?.amount)||0)>0&&Math.max(0,lineTotal(d.orderLines)-(+d.replacement?.amount||0))>(+(d.partialPayment?.amount)||0)).length;
                  const intensity=Math.min(1,c.pending/Math.max(1,totalOverdue/overdueC.length));
                  return <div key={c.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderRadius:12,background:dm?"rgba(239,68,68,0.06)":"rgba(239,68,68,0.04)",border:"1px solid rgba(239,68,68,0.12)",gap:12,transition:"background 0.15s"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
                      <div style={{width:24,height:24,borderRadius:7,background:idx===0?"#ef444420":"transparent",border:`1px solid ${idx===0?"#ef4444":"rgba(239,68,68,0.2)"}`,color:idx===0?"#dc2626":"#ef4444",fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{idx+1}</div>
                      <div style={{minWidth:0}}>
                        <span style={{color:t.text,fontWeight:700,fontSize:13}}>{c.name}</span>
                        {c.phone&&<span style={{color:t.sub,fontSize:11,marginLeft:8}}>📞 {c.phone}</span>}
                        {(cRepl>0||cPartial>0)&&<div style={{display:"flex",gap:6,marginTop:2}}>
                          {cRepl>0&&<span style={{color:"#f97316",fontSize:9,fontWeight:600}}>🔄 {inr(cRepl)} replaced</span>}
                          {cPartial>0&&<span style={{color:"#f59e0b",fontSize:9,fontWeight:600,marginLeft:2}}>⚡ partial</span>}
                        </div>}
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                      {!isMobile&&<div style={{width:60,height:4,borderRadius:4,background:dm?"rgba(239,68,68,0.15)":"rgba(239,68,68,0.12)",overflow:"hidden"}}>
                        <div style={{width:`${Math.round(intensity*100)}%`,height:"100%",background:"#ef4444",borderRadius:4}}/>
                      </div>}
                      <span style={{color:"#ef4444",fontWeight:800,fontSize:13,minWidth:isMobile?undefined:60,textAlign:"right"}}>{inr(c.pending)}</span>
                      <button onClick={()=>{if(isAdmin){setPayLedgerCust(c);setPayLedgerAmt(String(c.pending||""));setPayLedgerNote("");setPayLedgerMethod("Cash");setPayLedgerSh(true);}else{setPaySh(c);setPayAmt("");}}}
                        style={{background:"#f59e0b",color:"#000",border:"none",borderRadius:9,padding:"6px 13px",fontSize:11,fontWeight:800,cursor:"pointer",whiteSpace:"nowrap"}}>💰 Collect</button>
                    </div>
                  </div>;
                })}
                {overdueC.length>5&&<p style={{color:t.sub,fontSize:11,textAlign:"center",marginTop:4}}>+{overdueC.length-5} more customers with outstanding payments</p>}
                {isMobile&&isAdmin&&<button onClick={()=>{setPaymentsSubTab("outstanding");setTab("Payments");}} style={{background:"#3b82f615",color:"#3b82f6",border:"1px solid #3b82f630",borderRadius:10,padding:"9px 14px",fontSize:12,fontWeight:700,cursor:"pointer",width:"100%",marginTop:4}}>View Full Ledger →</button>}
              </div>}
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
              const lastD=cDelivs.length>0?[...cDelivs].sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0]:null;
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
                        gExport("pdf",()=>exportTabPDF("Customer Value",sorted,cols,settings,`<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:24px"><div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:12px 14px"><div style="font-size:20px;font-weight:900;color:#92400e">${inr(totalCLV)}</div><div style="font-size:9px;text-transform:uppercase;color:#a8a29e;margin-top:3px">Portfolio CLV</div></div><div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:12px 14px"><div style="font-size:20px;font-weight:900;color:#0369a1">${inr(avgCLV)}</div><div style="font-size:9px;text-transform:uppercase;color:#a8a29e;margin-top:3px">Avg per Customer</div></div></div>`),"Customer Value PDF");
                      }}>📄</Btn>
                      <Btn dm={dm} v="outline" size="sm" onClick={()=>{
                        const cols=[{label:"Customer",val:x=>x.c.name},{label:"Phone",val:x=>x.c.phone||""},{label:"CLV Score",key:"clvScore",num:true},{label:"Revenue",key:"revenue",num:true},{label:"Orders",key:"orderCount",num:true},{label:"Avg Order",key:"avgOrderVal",num:true},{label:"Days Since Last",key:"daysSinceLast",num:true},{label:"Orders/Mo",key:"ordersPerMonth"},{label:"Pending",val:x=>x.c.pending||0,num:true}];
                        gExport("excel",()=>exportTabExcel("Customer Value",sorted,cols,settings),"Customer Value Excel");
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

          {/* ── UNIFIED TOOLBAR ── */}
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:4,justifyContent:"space-between"}}>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"nowrap",flexShrink:0}}>
            {/* Sort select — always visible */}
            <select value={custSortField} onChange={e=>setCustSortField(e.target.value)}
              style={{background:t.inp,color:t.text,border:`1.5px solid ${t.border}`,borderRadius:10,padding:"8px 10px",fontSize:12,fontWeight:600,outline:"none",cursor:"pointer",flexShrink:0,minWidth:isMobile?110:130}}>
              <option value="lastOrder">Last Order</option>
              <option value="name">Name A–Z</option>
              <option value="pending">Most Owing</option>
              <option value="orders">Most Orders</option>
              {!isMobile&&<option value="revenue">Revenue ↓</option>}
            </select>
            <div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"nowrap",alignItems:"center"}}>
            {/* Mobile toolbar: Filter button + Export icon + Add Customer */}
            {isMobile&&<>
              <button onClick={()=>setCustMobileFilterOpen(v=>!v)}
                style={{display:"flex",alignItems:"center",gap:6,background:t.inp,border:`1.5px solid ${t.border}`,color:t.text,borderRadius:10,padding:"8px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                Filter
              </button>
              {/* View toggle: expanded ↔ compact — replaces the accidental PDF export */}
              <button
                onClick={()=>setCustView(v=>v==="expanded"?"compact":"expanded")}
                title={custView==="expanded"?"Switch to compact view":"Switch to card view"}
                style={{width:38,height:38,borderRadius:10,background:custView==="compact"?"#2563eb18":t.inp,border:`1.5px solid ${custView==="compact"?"#2563eb55":t.border}`,color:custView==="compact"?"#2563eb":t.sub,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>
                {custView==="compact"
                  ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                }
              </button>
              {can("cust_export")&&<button
                onClick={()=>{
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
                    const lastD=[...cDelivs].sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
                    const lastDays=lastD?Math.floor((new Date()-new Date(lastD.date))/86400000):null;
                    const createdByList=[...new Set(cDelivs.map(d=>d.createdBy).filter(Boolean))].join(", ")||"—";
                    return {...c,_orders:cDelivs.length,_delivered:cDone.length,_pending:cPending.length,_returns:cReturns,_replacements:cRepl,_replAmt:cReplAmt,_netTotal:netTotal,_revenue:cRev,_avgOrd:avgOrd,_lastDate:lastD?.date||"",_lastDays:lastDays,_cDelivs:cDelivs,_createdBy:createdByList};
                  });
                  const totalColl=customers.reduce((s,c)=>s+(c.paid||0),0);
                  const totalOut=customers.reduce((s,c)=>s+(c.pending||0),0);
                  const totalReplAll=enriched.reduce((s,c)=>s+c._replAmt,0);
                  const custBreakdownHtml=enriched.map(c=>{
                    if(!c._cDelivs||c._cDelivs.length===0)return "";
                    const sorted=[...c._cDelivs].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
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
    const dpaid=d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0;
    const rem=Math.max(0,net-dpaid);
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
                  gExport("pdf",()=>exportTabPDF("Customers",enriched,[
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
${custBreakdownHtml.length>0?`<div style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;margin:36px 0 8px;padding-bottom:6px;border-bottom:2px solid #e2e8f0">Per-Customer Delivery Breakdown</div>${custBreakdownHtml}`:""}`),"Customers PDF");
                }}
                title="Export PDF"
                style={{width:38,height:38,borderRadius:10,background:t.inp,border:`1.5px solid ${t.border}`,color:t.sub,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </button>}
              {/* ── Customer Reports: one professional page per customer ── */}
              {can("cust_export")&&<button
                onClick={()=>exportCustomerReports()}
                title="Customer Reports — full per-customer PDF with batches & activity log"
                style={{width:38,height:38,borderRadius:10,background:"#7c3aed18",border:"1.5px solid #7c3aed50",color:"#7c3aed",cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </button>}
              {can("cust_add")&&<button onClick={()=>{setCsh("add");setCf(blkC());}}
                style={{display:"flex",alignItems:"center",gap:6,background:"#2563eb",color:"#fff",border:"none",borderRadius:10,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Customer
              </button>}
            </>}
            {/* Desktop toolbar: full export buttons */}
            {!isMobile&&<div className="crm-btn-group">
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
                  const lastD=[...cDelivs].sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
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
                  const sorted=[...c._cDelivs].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
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
    const dpaid=d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0;
    const rem=Math.max(0,net-dpaid);
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
                gExport("pdf",()=>exportTabPDF("Customers",enriched,[
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
`),"Customers PDF");
              }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:4,verticalAlign:"middle"}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>PDF</Btn>}
              {/* ── Reports: professional per-customer PDF ── */}
              {can("cust_export")&&<Btn dm={dm} v="outline" size="sm"
                onClick={()=>exportCustomerReports()}
                title="One full-detail page per customer — batches, items, activity log"
                style={{borderColor:"#7c3aed60",color:"#7c3aed",background:"#7c3aed0d"}}
              ><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:4,verticalAlign:"middle"}}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Reports</Btn>}
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
                  const lastD=[...cDelivs].sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
                  return {...c,_orders:cDelivs.length,_delivered:cDone.length,_pending:cPending.length,_returns:cReturns,_replacements:cRepl,_replAmt:cReplAmt,_netTotal:netTotal,_revenue:cRev,_avgOrd:avgOrd,_lastDate:lastD?.date||""};
                });
                gExport("excel",()=>exportTabExcel("Customers",enriched,[
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
                ],settings),"Customers Excel");
              }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:4,verticalAlign:"middle"}}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>XLS</Btn>}
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
                  const lastD=[...cDelivs].sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0];
                  const createdByList=[...new Set(cDelivs.map(d=>d.createdBy).filter(Boolean))].join(", ")||"—";
                  return {...c,_orders:cDelivs.length,_delivered:cDone.length,_pending:cPending.length,_returns:cReturns,_replacements:cRepl,_replAmt:cReplAmt,_netTotal:netTotal,_revenue:cRev,_avgOrd:avgOrd,_lastDate:lastD?.date||"",_createdBy:createdByList};
                });
                gExport("csv",()=>exportCSV(enriched,"customers",[
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
                ]),"Customers CSV");
              }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:4,verticalAlign:"middle"}}><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>CSV</Btn>}
              <Btn dm={dm} size="sm" onClick={()=>{setCf(blkC());setCsh("add");}}>+ Customer</Btn>
            </div>}
            </div>
            </div>
          </div>
          {/* ── STATUS FILTER PILLS + VIEW TOGGLE (same row) ── */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:4}}>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{WebkitOverflowScrolling:"touch",scrollbarWidth:"none",msOverflowStyle:"none",minWidth:0}}>
              {[
                {key:"all",    label:`All (${fCust.length})`,         accent:"#2563eb"},
                {key:"active", label:`Active (${fCust.filter(c=>c.active).length})`,   accent:"#10b981"},
                {key:"inactive",label:`Inactive (${fCust.filter(c=>!c.active).length})`,accent:"#6b7280"},
                {key:"owing",  label:`Owing (${fCust.filter(c=>(c.pending||0)>0).length})`, accent:"#ef4444"},
                {key:"clear",  label:`Paid Up (${fCust.filter(c=>!(c.pending||0)).length})`, accent:"#10b981"},
              ].map(({key,label,accent})=>{
                const active=custStatusFilter===key;
                return <button key={key} onClick={()=>setCustStatusFilter(key)}
                  style={{flexShrink:0,background:active?accent:t.inp,color:active?"#fff":t.sub,border:`1.5px solid ${active?accent:t.border}`,borderRadius:99,padding:"6px 16px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",transition:"all 0.15s",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>
                  {label}
                </button>;
              })}
            </div>
            {/* Right: view mode toggle — desktop only */}
            {!isMobile&&<div style={{display:"flex",gap:4,alignItems:"center",flexShrink:0}}>
              {[
                {v:"recent",lbl:"Recent",icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>},
                {v:"expanded",lbl:"Table",icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>},
                {v:"compact",lbl:"Compact",icon:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>},
              ].map(({v,lbl,icon})=>{
                const active=custView===v||(v==="recent"&&custSortField==="lastOrder"&&custView==="expanded");
                return <button key={v} onClick={()=>{if(v==="recent"){setCustView("expanded");setCustSortField("lastOrder");}else{setCustView(v);setSelectedCustomer(null);}}}
                  style={{display:"flex",alignItems:"center",gap:5,padding:"7px 13px",borderRadius:9,border:`1px solid ${active?"#2563eb":t.border}`,background:active?"#2563eb":t.inp,color:active?"#fff":t.sub,fontSize:12,fontWeight:700,cursor:"pointer",transition:"all 0.15s"}}>
                  {icon}{lbl}
                </button>;
              })}
            </div>}
          </div>

          {/* ── MOBILE FILTER SHEET ── */}
          {isMobile&&<Sheet dm={dm} open={custMobileFilterOpen} onClose={()=>setCustMobileFilterOpen(false)} title="Filter Customers">
            <div style={{padding:"8px 0 16px"}}>
              <div style={{fontSize:12,fontWeight:700,color:t.sub,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.05em"}}>Status</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {[
                  {key:"all",    label:"All Customers",     accent:"#2563eb"},
                  {key:"active", label:"Active",            accent:"#10b981"},
                  {key:"inactive",label:"Inactive",         accent:"#6b7280"},
                  {key:"owing",  label:"Owing (Unpaid)",    accent:"#ef4444"},
                  {key:"clear",  label:"Paid Up",           accent:"#10b981"},
                ].map(({key,label,accent})=>{
                  const active=custStatusFilter===key;
                  return <button key={key} onClick={()=>{setCustStatusFilter(key);setCustMobileFilterOpen(false);}}
                    style={{display:"flex",alignItems:"center",gap:10,background:active?accent+"18":t.inp,color:active?accent:t.text,border:`1.5px solid ${active?accent:t.border}`,borderRadius:10,padding:"12px 16px",fontSize:13,fontWeight:700,cursor:"pointer",textAlign:"left",transition:"all 0.15s"}}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:active?accent:t.border,flexShrink:0}}/>
                    {label}
                    {active&&<svg style={{marginLeft:"auto"}} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </button>;
                })}
              </div>
              <div style={{fontSize:12,fontWeight:700,color:t.sub,margin:"20px 0 10px",textTransform:"uppercase",letterSpacing:"0.05em"}}>Sort By</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {[
                  {key:"lastOrder",label:"Last Order"},
                  {key:"name",     label:"Name A–Z"},
                  {key:"pending",  label:"Most Owing"},
                  {key:"orders",   label:"Most Orders"},
                ].map(({key,label})=>{
                  const active=custSortField===key;
                  return <button key={key} onClick={()=>{setCustSortField(key);setCustMobileFilterOpen(false);}}
                    style={{display:"flex",alignItems:"center",gap:10,background:active?"#2563eb18":t.inp,color:active?"#2563eb":t.text,border:`1.5px solid ${active?"#2563eb":t.border}`,borderRadius:10,padding:"12px 16px",fontSize:13,fontWeight:700,cursor:"pointer",textAlign:"left",transition:"all 0.15s"}}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:active?"#2563eb":t.border,flexShrink:0}}/>
                    {label}
                    {active&&<svg style={{marginLeft:"auto"}} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </button>;
                })}
              </div>
              <div style={{fontSize:12,fontWeight:700,color:t.sub,margin:"20px 0 10px",textTransform:"uppercase",letterSpacing:"0.05em"}}>View</div>
              <div style={{display:"flex",gap:8}}>
                {[
                  {v:"expanded",lbl:"Expanded"},
                  {v:"compact", lbl:"Compact"},
                ].map(({v,lbl})=>{
                  const active=custView===v;
                  return <button key={v} onClick={()=>{setCustView(v);setCustMobileFilterOpen(false);}}
                    style={{flex:1,padding:"12px",borderRadius:10,border:`1.5px solid ${active?"#2563eb":t.border}`,background:active?"#2563eb":t.inp,color:active?"#fff":t.text,fontSize:13,fontWeight:700,cursor:"pointer",transition:"all 0.15s"}}>
                    {lbl}
                  </button>;
                })}
              </div>
            </div>
          </Sheet>}

          {/* ── MOBILE CUSTOMER CARD LIST ── */}
          {isMobile&&clvFilter==="og"&&(()=>{
            let displayCust=[...fCust];
            if(custStatusFilter==="active") displayCust=displayCust.filter(c=>c.active);
            else if(custStatusFilter==="inactive") displayCust=displayCust.filter(c=>!c.active);
            else if(custStatusFilter==="owing") displayCust=displayCust.filter(c=>(c.pending||0)>0);
            else if(custStatusFilter==="clear") displayCust=displayCust.filter(c=>(c.pending||0)===0);
            displayCust=displayCust.map(c=>{
              const cDelivs=deliveries.filter(d=>d.customerId===c.id);
              const cDone=cDelivs.filter(d=>d.status==="Delivered");
              const lastDeliv=cDelivs.length>0?[...cDelivs].sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0]:null;
              const cRev=cDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
              const cReplAmt=cDelivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
              return {...c,_cDelivs:cDelivs,_cDone:cDone,_lastDeliv:lastDeliv,_cRev:cRev,_cReplAmt:cReplAmt};
            });
            if(custSortField==="name") displayCust.sort((a,b)=>a.name.localeCompare(b.name));
            else if(custSortField==="lastOrder") displayCust.sort((a,b)=>(b._lastDeliv?.date||"").localeCompare(a._lastDeliv?.date||""));
            else if(custSortField==="pending") displayCust.sort((a,b)=>(b.pending||0)-(a.pending||0));
            else if(custSortField==="orders") displayCust.sort((a,b)=>b._cDelivs.length-a._cDelivs.length);
            else if(custSortField==="revenue") displayCust.sort((a,b)=>b._cRev-a._cRev);
            if(displayCust.length===0) return <p style={{color:t.sub,textAlign:"center",padding:"40px 0",fontSize:13}}>No customers found.</p>;
            return <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {displayCust.map((c)=>{
                const isExpanded=selectedCustomer?.id===c.id;
                const lastDiffDays=c._lastDeliv?Math.floor((new Date()-new Date(c._lastDeliv.date))/(1000*60*60*24)):null;
                const lastLabel=lastDiffDays===null?"Never":lastDiffDays===0?"Today":lastDiffDays===1?"Yesterday":`${lastDiffDays}d ago`;
                const lastCol=lastDiffDays===null?"#94a3b8":lastDiffDays>14?"#ef4444":lastDiffDays>7?"#f59e0b":"#10b981";
                const avatarPalette=[["#f59e0b","#fffbeb"],["#10b981","#ecfdf5"],["#8b5cf6","#f5f3ff"],["#3b82f6","#eff6ff"],["#ef4444","#fef2f2"],["#f97316","#fff7ed"],["#06b6d4","#ecfeff"],["#ec4899","#fdf2f8"]];
                const [fg,bg]=c.active?avatarPalette[c.name.charCodeAt(0)%avatarPalette.length]:["#9ca3af","rgba(107,114,128,0.1)"];
                return <div key={c.id} style={{background:t.card,border:`1.5px solid ${isExpanded?"#2563eb":t.border}`,borderRadius:16,overflow:"hidden",boxShadow:isExpanded?"0 4px 16px rgba(37,99,235,0.13)":"0 1px 3px rgba(0,0,0,0.06)",transition:"all 0.18s"}}>
                  {/* Card main row */}
                  <div style={{padding:"13px 14px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",background:isExpanded?(dm?"rgba(37,99,235,0.1)":"rgba(37,99,235,0.04)"):"transparent",WebkitTapHighlightColor:"transparent"}}
                    onClick={()=>{setSelectedCustomer(isExpanded?null:c);setCustDetailDelivFilter("all");setCustDetailPartialAmt("");}}>
                    {/* Avatar */}
                    <div style={{width:44,height:44,borderRadius:14,background:bg,color:fg,fontWeight:900,fontSize:17,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,position:"relative",border:`1.5px solid ${fg}30`}}>
                      {c.name.charAt(0).toUpperCase()}
                      <span style={{position:"absolute",bottom:-2,right:-2,width:11,height:11,borderRadius:"50%",background:c.active?"#10b981":"#94a3b8",border:`2px solid ${t.card}`}}/>
                    </div>
                    {/* Name + meta */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                        <p style={{color:t.text,fontWeight:800,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</p>
                        {(c.pending||0)>0&&<span style={{background:"#ef444415",color:"#dc2626",border:"1px solid #ef444425",borderRadius:99,padding:"1px 7px",fontSize:9,fontWeight:800,flexShrink:0,whiteSpace:"nowrap"}}>DUE</span>}
                      </div>
                      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"nowrap"}}>
                        <span style={{color:t.sub,fontSize:11,display:"flex",alignItems:"center",gap:3}}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
                          {c._cDelivs.length} orders
                        </span>
                        <span style={{color:lastCol,fontSize:11,fontWeight:600}}>{lastLabel}</span>
                        {c.phone&&<span style={{color:t.sub,fontSize:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>📞 {c.phone}</span>}
                      </div>
                    </div>
                    {/* Right: amount + chevron */}
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                      {canSeeFinancials&&<span style={{color:(c.pending||0)>0?"#dc2626":"#10b981",fontWeight:900,fontSize:14,lineHeight:1}}>
                        {(c.pending||0)>0?inr(c.pending):"✓ Clear"}
                      </span>}
                      {canSeePrices&&(c.pending||0)===0&&<span style={{color:"#10b981",fontSize:10,fontWeight:600}}>{inr(c.paid||0)} paid</span>}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2.5" strokeLinecap="round" style={{transform:isExpanded?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s",marginTop:2}}><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                  </div>
                  {/* Progress bar */}
                  {c._cDelivs.length>0&&<div style={{height:3,background:t.border,display:"flex",overflow:"hidden"}}>
                    {[{v:c._cDone.length,col:"#10b981"},{v:c._cDelivs.filter(d=>d.status==="In Transit").length,col:"#3b82f6"},{v:c._cDelivs.filter(d=>d.status==="Pending").length,col:"#f59e0b"},{v:c._cDelivs.filter(d=>d.status==="Cancelled").length,col:"#ef4444"}].map(({v,col},i)=>
                      v>0&&<div key={i} style={{width:`${Math.round(v/c._cDelivs.length*100)}%`,background:col}}/>
                    )}
                  </div>}
                  {/* ── EXPANDED DETAIL — full mobile customer detail panel ── */}
                  {isExpanded&&(()=>{
                    const cFull=customers.find(x=>x.id===c.id)||c;
                    const cDue=cFull.pending||0;
                    const cPaid=cFull.paid||0;
                    const allCDelivs=[...deliveries.filter(d=>d.customerId===c.id)].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
                    const cDone=allCDelivs.filter(d=>d.status==="Delivered");
                    const cTransit=allCDelivs.filter(d=>d.status==="In Transit");
                    const cPend=allCDelivs.filter(d=>d.status==="Pending");
                    const cCancelled=allCDelivs.filter(d=>d.status==="Cancelled");
                    const cRepl=allCDelivs.filter(d=>d.replacement?.done);
                    const cReplAmt=allCDelivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
                    const cRev=cDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
                    const delivRate=allCDelivs.length>0?Math.round(cDone.length/allCDelivs.length*100):100;
                    const collPct=(cPaid+cDue)>0?Math.round(cPaid/(cPaid+cDue)*100):100;
                    const tStr=today();
                    const yStr=(()=>{const d=new Date(tStr);d.setDate(d.getDate()-1);return d.toISOString().slice(0,10);})();
                    const wStr=(()=>{const d=new Date(tStr);d.setDate(d.getDate()-6);return d.toISOString().slice(0,10);})();
                    const filtDelivs=allCDelivs.filter(d=>{
                      if(custDetailDelivFilter==="today") return d.date===tStr;
                      if(custDetailDelivFilter==="yesterday") return d.date===yStr;
                      if(custDetailDelivFilter==="week") return d.date>=wStr;
                      return true;
                    });
                    return <div style={{borderTop:`1px solid ${t.border}`}}>

                      {/* ══ SECTION 1: PROFILE / FINANCIALS / ORDER STATS ══ */}
                      <div style={{padding:"14px 14px 10px",display:"grid",gridTemplateColumns:"1fr",gap:10,borderBottom:`1px solid ${t.border}`}}>

                        {/* PROFILE */}
                        <div>
                          <p style={{color:t.sub,fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Profile</p>
                          <div style={{display:"flex",flexDirection:"column",gap:6}}>
                            {[
                              {icon:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>, val:cFull.name, bold:true},
                              {icon:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2.2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12"/></svg>, val:cFull.phone||"—", phone:true},
                              {icon:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>, val:cFull.address||"—"},
                              {icon:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, val:cFull.joinDate?`Since ${cFull.joinDate}`:"—"},
                              {icon:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2.2" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/></svg>, val:cFull.id?`ID: ${cFull.id.slice(-8).toUpperCase()}`:"—"},
                            ].map(({icon,val,bold,phone},ii)=>(
                              <div key={ii} style={{display:"flex",gap:8,alignItems:"center"}}>
                                <span style={{flexShrink:0,width:16,display:"flex",alignItems:"center",justifyContent:"center"}}>{icon}</span>
                                {phone&&cFull.phone
                                  ?<a href={`tel:${cFull.phone}`} style={{color:"#2563eb",fontSize:12,fontWeight:600,textDecoration:"none"}}>{val}</a>
                                  :<span style={{color:bold?t.text:t.sub,fontSize:12,fontWeight:bold?700:400,lineHeight:1.4}}>{val}</span>}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* FINANCIALS */}
                        {canSeePrices&&<div>
                          <p style={{color:t.sub,fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Financials</p>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
                            {[
                              {label:"TOTAL PAID",val:inr(cPaid),color:"#10b981"},
                              {label:"PENDING DUE",val:cDue>0?inr(cDue):"✓ Clear",color:cDue>0?"#ef4444":"#10b981"},
                              {label:"TOTAL BILLED",val:inr(cRev),color:"#3b82f6"},
                              {label:"REPLACEMENTS",val:cReplAmt>0?inr(cReplAmt):"None",color:"#f97316"},
                            ].map(({label,val,color})=>(
                              <div key={label} style={{background:t.inp,borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
                                <p style={{color,fontWeight:900,fontSize:15,lineHeight:1}}>{val}</p>
                                <p style={{color:t.sub,fontSize:8,fontWeight:700,textTransform:"uppercase",marginTop:3}}>{label}</p>
                              </div>
                            ))}
                          </div>
                          <div style={{marginBottom:4}}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                              <span style={{color:t.sub,fontSize:10,fontWeight:700}}>Collection</span>
                              <span style={{color:collPct>=80?"#10b981":collPct>=50?"#f59e0b":"#ef4444",fontWeight:700,fontSize:10}}>{collPct}%</span>
                            </div>
                            <div style={{height:5,borderRadius:5,background:t.border,overflow:"hidden"}}>
                              <div style={{width:`${collPct}%`,height:"100%",background:collPct>=80?"#10b981":collPct>=50?"#f59e0b":"#ef4444",borderRadius:5}}/>
                            </div>
                          </div>
                        </div>}

                        {/* ORDER STATS */}
                        <div>
                          <p style={{color:t.sub,fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Order Stats</p>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:8}}>
                            {[
                              {label:"TOTAL",val:allCDelivs.length,color:"#6366f1"},
                              {label:"DELIVERED",val:cDone.length,color:"#10b981"},
                              {label:"IN TRANSIT",val:cTransit.length,color:"#3b82f6"},
                              {label:"PENDING",val:cPend.length,color:"#f59e0b"},
                              {label:"CANCELLED",val:cCancelled.length,color:"#ef4444"},
                              {label:"REPLACED",val:cRepl.length,color:"#f97316"},
                            ].map(({label,val,color})=>(
                              <div key={label} style={{background:t.inp,borderRadius:10,padding:"8px 4px",textAlign:"center"}}>
                                <p style={{color,fontWeight:900,fontSize:16,lineHeight:1}}>{val}</p>
                                <p style={{color:t.sub,fontSize:8,fontWeight:700,textTransform:"uppercase",marginTop:2}}>{label}</p>
                              </div>
                            ))}
                          </div>
                          <div>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                              <span style={{color:t.sub,fontSize:10,fontWeight:700}}>Delivery Rate</span>
                              <span style={{color:delivRate>=90?"#10b981":delivRate>=70?"#f59e0b":"#ef4444",fontWeight:700,fontSize:10}}>{delivRate}%</span>
                            </div>
                            <div style={{height:5,borderRadius:5,background:t.border,overflow:"hidden"}}>
                              <div style={{width:`${delivRate}%`,height:"100%",background:delivRate>=90?"#10b981":delivRate>=70?"#f59e0b":"#ef4444",borderRadius:5}}/>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ══ SECTION 2: ACTIONS ══ */}
                      <div style={{padding:"12px 14px",borderBottom:`1px solid ${t.border}`}}>
                        <p style={{color:t.sub,fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Actions</p>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                          {can("cust_edit")&&<button onClick={()=>{setCsh(cFull);setCf(cFull);setSelectedCustomer(null);}}
                            style={{background:t.inp,border:`1px solid ${t.border}`,color:t.text,borderRadius:10,padding:"9px 14px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Edit
                          </button>}
                          {can("cust_export")&&<button onClick={()=>gExport("pdf",()=>exportPDF(cFull,products,"customer",settings,deliveries),"Customer PDF")}
                            style={{background:"#7c3aed",color:"#fff",border:"none",borderRadius:10,padding:"9px 14px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            PDF
                          </button>}
                          {can("cust_export")&&<button onClick={()=>exportCustomerReports([cFull.id])}
                            title="Full customer report — batches, items, activity log"
                            style={{background:"#7c3aed15",color:"#7c3aed",border:"1px solid #7c3aed40",borderRadius:10,padding:"9px 14px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                            Report
                          </button>}
                          {can("cust_export")&&<button onClick={()=>{gExport("excel",()=>exportTabExcel("Customer",[{...cFull}],[{label:"Name",key:"name"},{label:"Phone",key:"phone"},{label:"Address",key:"address"},{label:"Paid",key:"paid",num:true},{label:"Pending",key:"pending",num:true}],settings),"Customer Excel");}}
                            style={{background:"#059669",color:"#fff",border:"none",borderRadius:10,padding:"9px 14px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
                            Excel
                          </button>}
                          {can("cust_deactivate")&&<button onClick={()=>{togActive(cFull);setSelectedCustomer(null);}}
                            style={{background:t.inp,border:`1px solid ${t.border}`,color:t.sub,borderRadius:10,padding:"9px 14px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                            {cFull.active
                              ?<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                              :<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
                            {cFull.active?"Pause":"Activate"}
                          </button>}
                          <button onClick={()=>setDetailModal({type:"customer",data:cFull})}
                            style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:10,padding:"9px 14px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5,marginLeft:"auto"}}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            Full Profile
                          </button>
                          {can("cust_delete")&&<button onClick={()=>delC(cFull)}
                            style={{background:"#ef444415",border:"1px solid #ef444430",color:"#ef4444",borderRadius:10,padding:"9px 14px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                            Delete
                          </button>}
                        </div>
                      </div>

                      {/* ══ SECTION 3: PARTIAL PAYMENT ══ */}
                      {isAdmin&&cDue>0&&<div style={{padding:"12px 14px",borderBottom:`1px solid ${t.border}`,background:dm?"rgba(245,158,11,0.06)":"rgba(245,158,11,0.04)"}}>
                        <p style={{color:"#f59e0b",fontWeight:700,fontSize:11,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                          LOG PARTIAL PAYMENT
                        </p>
                        <div style={{display:"flex",gap:8}}>
                          <input type="number" placeholder="₹ Amount" value={custDetailPartialAmt} onChange={e=>setCustDetailPartialAmt(e.target.value)}
                            style={{flex:1,background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:10,padding:"10px 12px",fontSize:13,outline:"none"}}
                            onFocus={e=>{e.target.style.borderColor="#f59e0b";}} onBlur={e=>{e.target.style.borderColor=t.inpB;}}/>
                          <button onClick={()=>{const amt=+custDetailPartialAmt;if(!amt||amt<=0){notify("Enter a valid amount");return;}recordPaymentLedger(cFull.id,cFull.name,amt,"","Cash");setCustDetailPartialAmt("");setSelectedCustomer(null);}}
                            style={{background:"#f59e0b",color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",fontSize:13,fontWeight:700,cursor:"pointer"}}>Apply</button>
                        </div>
                      </div>}

                      {/* ══ SECTION 4: DELIVERIES ══ */}
                      <div style={{padding:"14px 14px"}}>
                        {/* Header + filter pills */}
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                          <p style={{color:t.text,fontWeight:800,fontSize:13}}>DELIVERIES <span style={{color:t.sub,fontWeight:600}}>({allCDelivs.length})</span></p>
                          <div style={{display:"flex",gap:5}}>
                            {[["all","All"],["today","Today"],["yesterday","Yesterday"],["week","This Week"]].map(([k,l])=>(
                              <button key={k} onClick={()=>setCustDetailDelivFilter(k)}
                                style={{background:custDetailDelivFilter===k?"#2563eb":t.inp,color:custDetailDelivFilter===k?"#fff":t.sub,border:`1px solid ${custDetailDelivFilter===k?"#2563eb":t.border}`,borderRadius:99,padding:"4px 10px",fontSize:10,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>{l}</button>
                            ))}
                          </div>
                        </div>

                        {filtDelivs.length===0&&<p style={{color:t.sub,fontSize:12,textAlign:"center",padding:"20px 0"}}>No deliveries match this filter.</p>}

                        <div style={{display:"flex",flexDirection:"column",gap:10}}>
                          {filtDelivs.map((d,di)=>{
                            const tot=lineTotal(d.orderLines);
                            const dRepl=+d.replacement?.amount||0;
                            const dNet=Math.max(0,tot-dRepl);
                            const isPaid=d.status==="Delivered"&&dNet>0&&(d.partialPayment?.enabled?(+(d.partialPayment?.amount)||0)>=dNet:true);
                            const sc=d.status==="Delivered"?"#10b981":d.status==="Cancelled"?"#ef4444":"#f59e0b";
                            const invNo=(invRegistry?.issued||{})[d.id]||d.invNo||`TAS-${(d.date||"").replace(/-/g,"").slice(2)}-${(d.id||"").slice(-4).toUpperCase()}`;
                            const rows=Object.entries(safeO(d.orderLines)).filter(([,l])=>l.qty>0);
                            const totalQty=rows.reduce((s,[,l])=>s+(+l.qty||0),0);
                            const pricePerUnit=rows.length>0?(+rows[0][1]?.priceAmount||+rows[0][1]?.price||0):0;
                            const deliveredAt=d.deliveredAt||d.completedAt||"";
                            // parse date for block display
                            const dateObj=d.date?new Date(d.date):null;
                            const dayNum=dateObj?String(dateObj.getDate()).padStart(2,"0"):"??";
                            const monthStr=dateObj?dateObj.toLocaleString("en",{month:"short"}).toUpperCase():"???";
                            const yearStr=dateObj?dateObj.getFullYear():"";
                            const paymentStatus=d.partialPayment?.enabled
                              ?(+(d.partialPayment?.amount)||0)>=dNet?"Paid":"Pending"
                              :d.status==="Delivered"?"Paid":"Pending";
                            return <div key={d.id||di} style={{background:t.card,borderRadius:14,border:`1px solid ${t.border}`,overflow:"hidden",cursor:"pointer"}}
                              onClick={()=>setDetailModal({type:"delivery",data:d})}>
                              {/* Top row: date block + main info + TAS no */}
                              <div style={{display:"flex",gap:12,padding:"12px 14px",alignItems:"flex-start"}}>
                                {/* Date block */}
                                <div style={{background:dm?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)",borderRadius:10,padding:"8px 10px",textAlign:"center",flexShrink:0,minWidth:44}}>
                                  <p style={{color:t.text,fontWeight:900,fontSize:18,lineHeight:1}}>{dayNum}</p>
                                  <p style={{color:"#3b82f6",fontWeight:700,fontSize:9,textTransform:"uppercase",marginTop:1}}>{monthStr}</p>
                                  <p style={{color:t.sub,fontWeight:600,fontSize:9}}>{yearStr}</p>
                                </div>
                                {/* Middle: status + product summary + notes */}
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
                                    <span style={{background:`${sc}18`,color:sc,borderRadius:99,padding:"2px 9px",fontSize:10,fontWeight:700}}>{d.status}</span>
                                    {d.replacement?.done&&<span style={{background:"#f9731615",color:"#f97316",borderRadius:99,padding:"2px 7px",fontSize:9,fontWeight:700}}>🔄 Replaced</span>}
                                  </div>
                                  {rows.length>0&&<p style={{color:t.sub,fontSize:12,marginBottom:3}}>
                                    {rows.map(([pid,l])=>{const prod=products.find(p=>p.id===pid);return`${prod?.name||l.name||pid}: ${l.qty}`;}).join(", ")}
                                  </p>}
                                  {d.notes&&<p style={{color:"#f59e0b",fontSize:10,display:"flex",alignItems:"center",gap:4}}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                    {d.notes}
                                  </p>}
                                </div>
                                {/* Right: amount + replaced + TAS */}
                                <div style={{flexShrink:0,textAlign:"right",display:"flex",flexDirection:"column",gap:3}}>
                                  {canSeePrices&&<>
                                    <div>
                                      <p style={{color:t.sub,fontSize:9}}>Amount</p>
                                      <p style={{color:"#10b981",fontWeight:900,fontSize:14,lineHeight:1}}>{inr(tot)}</p>
                                    </div>
                                    {dRepl>0&&<div>
                                      <p style={{color:t.sub,fontSize:9}}>Replaced</p>
                                      <p style={{color:"#f97316",fontWeight:700,fontSize:12}}>+{inr(dRepl)}</p>
                                    </div>}
                                  </>}
                                  <div>
                                    <p style={{color:t.sub,fontSize:9}}>TAS No.</p>
                                    <p style={{color:"#6366f1",fontWeight:700,fontSize:10,fontFamily:"monospace"}}>{invNo}</p>
                                  </div>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2" strokeLinecap="round" style={{alignSelf:"flex-end",marginTop:2}}><polyline points="9 18 15 12 9 6"/></svg>
                                </div>
                              </div>
                              {/* Bottom row: items / qty / price / total / payment / delivery boy / time */}
                              <div style={{borderTop:`1px solid ${t.border}`,background:dm?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.015)",padding:"8px 14px",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>
                                {[
                                  {label:"Items",val:`${rows.length} items`},
                                  {label:"Qty",val:totalQty},
                                  canSeePrices&&{label:"Price/Unit",val:pricePerUnit>0?`₹${pricePerUnit}`:"—"},
                                  canSeePrices&&{label:"Total Amount",val:inr(tot)},
                                  {label:"Payment",val:paymentStatus,color:paymentStatus==="Paid"?"#10b981":"#f59e0b"},
                                  d.deliveryBoy&&{label:"Delivery Boy",val:d.deliveryBoy},
                                  deliveredAt&&{label:"Delivered At",val:deliveredAt},
                                ].filter(Boolean).map(({label,val,color})=>(
                                  <div key={label}>
                                    <p style={{color:t.sub,fontSize:9,fontWeight:600,marginBottom:1}}>{label}</p>
                                    <p style={{color:color||t.text,fontWeight:700,fontSize:11}}>{val}</p>
                                  </div>
                                ))}
                              </div>
                            </div>;
                          })}
                        </div>
                        <p style={{color:t.sub,fontSize:10,textAlign:"center",marginTop:12,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          Click any delivery to open full detail
                        </p>
                      </div>
                    </div>;
                  })()}
                </div>;
              })}
            </div>;
          })()}

          {/* ── DESKTOP VIEWS (compact & expanded) ── */}
          {clvFilter==="og"&&custView==="compact"&&!isMobile&&(()=>{
            // ── COMPACT CUSTOMER CARDS VIEW ──
            let displayCust=[...fCust];
            if(custStatusFilter==="active") displayCust=displayCust.filter(c=>c.active);
            else if(custStatusFilter==="inactive") displayCust=displayCust.filter(c=>!c.active);
            else if(custStatusFilter==="owing") displayCust=displayCust.filter(c=>(c.pending||0)>0);
            else if(custStatusFilter==="clear") displayCust=displayCust.filter(c=>(c.pending||0)===0);
            displayCust=displayCust.map(c=>{
              const cDelivs=deliveries.filter(d=>d.customerId===c.id);
              const cDone=cDelivs.filter(d=>d.status==="Delivered");
              const cTransit=cDelivs.filter(d=>d.status==="In Transit");
              const cPend=cDelivs.filter(d=>d.status==="Pending");
              const cCancelled=cDelivs.filter(d=>d.status==="Cancelled");
              const cRepl=cDelivs.filter(d=>d.replacement?.done);
              const cReplAmt=cDelivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
              const lastDeliv=cDelivs.length>0?[...cDelivs].sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0]:null;
              const cRev=cDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
              const delivRate=cDelivs.length>0?Math.round(cDone.length/cDelivs.length*100):100;
              const collPct=(c.paid||0)+(c.pending||0)>0?Math.round((c.paid||0)/((c.paid||0)+(c.pending||0))*100):100;
              return {...c,_cDelivs:cDelivs,_cDone:cDone,_cTransit:cTransit,_cPend:cPend,_cCancelled:cCancelled,_cRepl:cRepl,_cReplAmt:cReplAmt,_lastDeliv:lastDeliv,_cRev:cRev,_delivRate:delivRate,_collPct:collPct};
            });
            if(custSortField==="name") displayCust.sort((a,b)=>a.name.localeCompare(b.name));
            else if(custSortField==="lastOrder") displayCust.sort((a,b)=>(b._lastDeliv?.date||"").localeCompare(a._lastDeliv?.date||""));
            else if(custSortField==="pending") displayCust.sort((a,b)=>(b.pending||0)-(a.pending||0));
            else if(custSortField==="orders") displayCust.sort((a,b)=>b._cDelivs.length-a._cDelivs.length);
            else if(custSortField==="revenue") displayCust.sort((a,b)=>b._cRev-a._cRev);
            const CPAGE=200; // show all in compact mode — cards are small enough
            const totalCustRows=displayCust.length;
            const pagedCust=displayCust.slice((custPage-1)*CPAGE,custPage*CPAGE);
            const totalPages=Math.ceil(totalCustRows/CPAGE);
            if(displayCust.length===0) return <p style={{color:t.sub,textAlign:"center",padding:"40px 0",fontSize:13}}>{t18n("noCustomers")}</p>;
            return <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {pagedCust.map((c)=>{
                const isExpanded=selectedCustomer?.id===c.id;
                const lastDiffDays=c._lastDeliv?Math.floor((new Date()-new Date(c._lastDeliv.date))/(1000*60*60*24)):null;
                const lastLabel=lastDiffDays===null?"Never":lastDiffDays===0?"Today":lastDiffDays===1?"Yesterday":`${lastDiffDays}d ago`;
                const lastCol=lastDiffDays===null?"#94a3b8":lastDiffDays>14?"#ef4444":lastDiffDays>7?"#f59e0b":"#10b981";
                const accentColor=c._cDelivs.length===0?"#6b7280":c.active?"#f59e0b":"#94a3b8";
                // Get recent deliveries for expanded view
                const recentDelivs=[...c._cDelivs].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,5);
                return <div key={c.id} style={{background:t.card,border:`1.5px solid ${isExpanded?"#2563eb40":t.border}`,borderRadius:18,overflow:"hidden",boxShadow:isExpanded?"0 4px 20px rgba(37,99,235,0.12)":"0 1px 4px rgba(0,0,0,0.05)",transition:"all 0.2s"}}>
                  {/* ── COMPACT ROW (always visible) ── */}
                  <div style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",background:isExpanded?(dm?"rgba(37,99,235,0.1)":"rgba(37,99,235,0.04)"):"transparent"}}
                    onClick={()=>{setSelectedCustomer(isExpanded?null:c);setCustDetailDelivFilter("all");setCustDetailPartialAmt("");}}>
                    {/* Avatar */}
                    <div style={{width:42,height:42,borderRadius:13,background:`${accentColor}20`,color:accentColor,fontWeight:900,fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,position:"relative"}}>
                      {c.name.charAt(0).toUpperCase()}
                      <span style={{position:"absolute",bottom:-2,right:-2,width:10,height:10,borderRadius:"50%",background:c.active?"#10b981":"#94a3b8",border:`2px solid ${t.card}`}}/>
                    </div>
                    {/* Name + sub info */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <p style={{color:t.text,fontWeight:800,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</p>
                        <span style={{background:c.active?"#10b98115":"#6b728015",color:c.active?"#059669":"#6b7280",border:`1px solid ${c.active?"#10b98125":"#6b728025"}`,borderRadius:99,padding:"2px 8px",fontSize:9,fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>
                          {c.active?t18n("active").toUpperCase():t18n("inactive").toUpperCase()}
                        </span>
                        {(c.pending||0)>0&&<span style={{background:"#ef444415",color:"#dc2626",border:"1px solid #ef444425",borderRadius:99,padding:"2px 8px",fontSize:9,fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>DUE</span>}
                      </div>
                      <div style={{display:"flex",gap:10,marginTop:3,flexWrap:"wrap",alignItems:"center"}}>
                        {c.phone&&<span style={{color:t.sub,fontSize:11}}>📞 {c.phone}</span>}
                        {c.address&&<span style={{color:t.sub,fontSize:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:130}}>📍 {c.address}</span>}
                      </div>
                    </div>
                    {/* Stats strip */}
                    <div style={{display:"flex",gap:16,alignItems:"center",flexShrink:0}}>
                      <div style={{textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center"}}>
                        <span style={{color:"#3b82f6",fontWeight:800,fontSize:15,lineHeight:1}}>{c._cDelivs.length}</span>
                        <span style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginTop:2}}>{t18n("orders")}</span>
                      </div>
                      <div style={{textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center"}}>
                        <span style={{color:lastCol,fontWeight:700,fontSize:12,lineHeight:1}}>{lastLabel}</span>
                        <span style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginTop:2}}>{t18n("last")}</span>
                      </div>
                      {canSeePrices&&<div style={{textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center"}}>
                        <span style={{color:"#10b981",fontWeight:800,fontSize:13,lineHeight:1}}>{inr(c.paid||0)}</span>
                        <span style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginTop:2}}>{t18n("paid")}</span>
                      </div>}
                      {canSeeFinancials&&<div style={{textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center"}}>
                        <span style={{color:(c.pending||0)>0?"#ef4444":"#10b981",fontWeight:800,fontSize:13,lineHeight:1}}>{(c.pending||0)>0?inr(c.pending):"✓"}</span>
                        <span style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginTop:2}}>{t18n("due")}</span>
                      </div>}
                      {/* Expand chevron */}
                      <div style={{width:28,height:28,borderRadius:8,background:t.inp,border:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,color:t.sub,fontSize:13,fontWeight:700,transform:isExpanded?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>
                        ∨
                      </div>
                    </div>
                  </div>

                  {/* ── PROGRESS BAR (always visible under row) ── */}
                  {c._cDelivs.length>0&&<div style={{height:3,background:t.border,display:"flex",gap:1,overflow:"hidden"}}>
                    {[{v:c._cDone.length,col:"#10b981"},{v:c._cTransit.length,col:"#3b82f6"},{v:c._cPend.length,col:"#f59e0b"},{v:c._cCancelled.length,col:"#ef4444"}].map(({v,col},i)=>
                      v>0&&<div key={i} style={{width:`${Math.round(v/c._cDelivs.length*100)}%`,background:col,transition:"width 0.5s"}}/>
                    )}
                  </div>}

                  {/* ── EXPANDED DETAIL PANEL ── */}
                  {isExpanded&&(()=>{
                    const cFull=customers.find(x=>x.id===c.id)||c;
                    const allCDelivs=[...deliveries.filter(d=>d.customerId===c.id)].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
                    const cDue=cFull.pending||0;
                    const cPaid=cFull.paid||0;
                    const tStr=today();
                    const yStr=(()=>{const d=new Date(tStr);d.setDate(d.getDate()-1);return d.toISOString().slice(0,10);})();
                    const wStr=(()=>{const d=new Date(tStr);d.setDate(d.getDate()-6);return d.toISOString().slice(0,10);})();
                    const filtDelivs=allCDelivs.filter(d=>{
                      if(custDetailDelivFilter==="today") return d.date===tStr;
                      if(custDetailDelivFilter==="yesterday") return d.date===yStr;
                      if(custDetailDelivFilter==="week") return d.date>=wStr;
                      return true;
                    });
                    return <div style={{borderTop:`1px solid ${t.border}`,background:dm?"rgba(255,255,255,0.01)":"rgba(0,0,0,0.008)"}}>
                      {/* ── TOP: full info grid ── */}
                      <div style={{padding:"16px 18px",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,borderBottom:`1px solid ${t.border}`}}>
                        {/* Profile block */}
                        <div style={{background:t.inp,borderRadius:14,padding:"14px",display:"flex",flexDirection:"column",gap:8}}>
                          <p style={{color:t.sub,fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:2}}>Profile</p>
                          {[
                            {icon:"👤",val:cFull.name,bold:true},
                            {icon:"📞",val:cFull.phone||"—"},
                            {icon:"📍",val:cFull.address||"—"},
                            {icon:"📅",val:cFull.joinDate?`Since ${cFull.joinDate}`:"—"},
                            {icon:"🆔",val:cFull.id?`ID: ${cFull.id.slice(-8).toUpperCase()}`:"—"},
                          ].map(({icon,val,bold})=>
                            <div key={icon} style={{display:"flex",gap:7,alignItems:"flex-start"}}>
                              <span style={{fontSize:12,flexShrink:0,lineHeight:1.5}}>{icon}</span>
                              <span style={{color:bold?t.text:t.sub,fontSize:12,fontWeight:bold?700:400,lineHeight:1.4,wordBreak:"break-word"}}>{val}</span>
                            </div>
                          )}
                        </div>
                        {/* Financial block */}
                        {canSeePrices&&<div style={{background:t.inp,borderRadius:14,padding:"14px"}}>
                          <p style={{color:t.sub,fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Financials</p>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
                            {[
                              {label:"TOTAL PAID",val:inr(cPaid),color:"#10b981"},
                              {label:"PENDING DUE",val:cDue>0?inr(cDue):"✓ Clear",color:cDue>0?"#ef4444":"#10b981"},
                              {label:"TOTAL BILLED",val:inr(c._cRev),color:"#3b82f6"},
                              {label:"REPLACEMENTS",val:c._cReplAmt>0?inr(c._cReplAmt):"None",color:"#f97316"},
                            ].map(({label,val,color})=>(
                              <div key={label} style={{textAlign:"center",background:t.card,borderRadius:10,padding:"10px 6px"}}>
                                <p style={{color,fontWeight:900,fontSize:15,lineHeight:1}}>{val}</p>
                                <p style={{color:t.sub,fontSize:8,fontWeight:700,textTransform:"uppercase",marginTop:3}}>{label}</p>
                              </div>
                            ))}
                          </div>
                          {/* Payment bar */}
                          <div style={{marginTop:10}}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                              <span style={{color:t.sub,fontSize:9,fontWeight:700}}>Collection</span>
                              <span style={{color:c._collPct>=80?"#10b981":c._collPct>=50?"#f59e0b":"#ef4444",fontWeight:700,fontSize:9}}>{c._collPct}%</span>
                            </div>
                            <div style={{height:6,borderRadius:6,background:t.border,overflow:"hidden"}}>
                              <div style={{width:`${c._collPct}%`,height:"100%",background:c._collPct>=80?"#10b981":c._collPct>=50?"#f59e0b":"#ef4444",borderRadius:6,transition:"width 0.5s"}}/>
                            </div>
                          </div>
                        </div>}
                        {/* Delivery stats block */}
                        <div style={{background:t.inp,borderRadius:14,padding:"14px"}}>
                          <p style={{color:t.sub,fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Order Stats</p>
                          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(140px,100%),1fr))",gap:8,marginBottom:10}}>
                            {[
                              {label:"TOTAL",val:c._cDelivs.length,color:"#6366f1"},
                              {label:"DELIVERED",val:c._cDone.length,color:"#10b981"},
                              {label:"IN TRANSIT",val:c._cTransit.length,color:"#3b82f6"},
                              {label:"PENDING",val:c._cPend.length,color:"#f59e0b"},
                              {label:"CANCELLED",val:c._cCancelled.length,color:"#ef4444"},
                              {label:"REPLACED",val:c._cRepl.length,color:"#f97316"},
                            ].map(({label,val,color})=>(
                              <div key={label} style={{textAlign:"center",background:t.card,borderRadius:10,padding:"8px 4px"}}>
                                <p style={{color,fontWeight:900,fontSize:16,lineHeight:1}}>{val}</p>
                                <p style={{color:t.sub,fontSize:8,fontWeight:700,textTransform:"uppercase",marginTop:2}}>{label}</p>
                              </div>
                            ))}
                          </div>
                          {/* Delivery rate bar */}
                          <div>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                              <span style={{color:t.sub,fontSize:9,fontWeight:700}}>Delivery Rate</span>
                              <span style={{color:c._delivRate>=90?"#10b981":c._delivRate>=70?"#f59e0b":"#ef4444",fontWeight:700,fontSize:9}}>{c._delivRate}%</span>
                            </div>
                            <div style={{height:6,borderRadius:6,background:t.border,overflow:"hidden"}}>
                              <div style={{width:`${c._delivRate}%`,height:"100%",background:c._delivRate>=90?"#10b981":c._delivRate>=70?"#f59e0b":"#ef4444",borderRadius:6,transition:"width 0.5s"}}/>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* ── ACTIONS ROW ── */}
                      <div style={{padding:"12px 18px",borderBottom:`1px solid ${t.border}`,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                        <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",marginRight:4,flexShrink:0}}>Actions:</p>
                        {can("cust_edit")&&<button onClick={()=>{setCsh(cFull);setCf(cFull);setSelectedCustomer(null);}} style={{background:t.inp,border:`1px solid ${t.border}`,color:t.text,borderRadius:9,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>✏️ Edit</button>}
                        {can("cust_export")&&<button onClick={()=>gExport("pdf",()=>exportPDF(cFull,products,"customer",settings,deliveries),"Customer PDF")} style={{background:"#7c3aed",color:"#fff",border:"none",borderRadius:9,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>📄 PDF</button>}
                        {can("cust_export")&&<button onClick={()=>exportCustomerReports([cFull.id])} title="Full customer report — all deliveries, batches & activity log" style={{background:"#7c3aed15",color:"#7c3aed",border:"1px solid #7c3aed40",borderRadius:9,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>📋 Report</button>}
                        {can("cust_export")&&<button onClick={()=>{const rows=[{...cFull}];gExport("excel",()=>exportTabExcel("Customer",rows,[{label:"Name",key:"name"},{label:"Phone",key:"phone"},{label:"Address",key:"address"},{label:"Paid",key:"paid",num:true},{label:"Pending",key:"pending",num:true}],settings),"Customer Excel");}} style={{background:"#059669",color:"#fff",border:"none",borderRadius:9,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>📊 Excel</button>}
                        {isAdmin&&cDue>0&&<button onClick={()=>{setPaySh(cFull);setPayAmt(String(cDue));setSelectedCustomer(null);}} style={{background:"#f59e0b",color:"#fff",border:"none",borderRadius:9,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>💰 Collect</button>}
                        {can("cust_deactivate")&&<button onClick={()=>{togActive(cFull);setSelectedCustomer(null);}} style={{background:t.inp,border:`1px solid ${t.border}`,color:t.sub,borderRadius:9,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>{cFull.active?"⏸ Pause":"▶ Activate"}</button>}
                        {cFull.phone&&<a href={`https://wa.me/${cFull.phone.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" style={{background:"#25D366",color:"#fff",borderRadius:9,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer",textDecoration:"none"}}>💬 WhatsApp</a>}
                        <button onClick={()=>setDetailModal({type:"customer",data:cFull})} style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:9,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer",marginLeft:"auto"}}>🔍 Full Profile</button>
                        {can("cust_delete")&&<button onClick={()=>delC(cFull)} style={{background:"#ef444415",border:"1px solid #ef444430",color:"#ef4444",borderRadius:9,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>🗑 Delete</button>}
                      </div>

                      {/* ── PARTIAL PAYMENT INLINE ── */}
                      {isAdmin&&cDue>0&&<div style={{padding:"12px 18px",borderBottom:`1px solid ${t.border}`,background:"#f59e0b08"}}>
                        <p style={{color:"#f59e0b",fontWeight:700,fontSize:11,marginBottom:8}}>💰 LOG PARTIAL PAYMENT</p>
                        <div style={{display:"flex",gap:8}}>
                          <input type="number" placeholder="₹ Amount" value={custDetailPartialAmt} onChange={e=>setCustDetailPartialAmt(e.target.value)}
                            style={{flex:1,maxWidth:200,background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:9,padding:"9px 12px",fontSize:13,outline:"none"}}
                            onFocus={e=>{e.target.style.borderColor="#f59e0b";}} onBlur={e=>{e.target.style.borderColor=t.inpB;}}/>
                          <button onClick={()=>{
                            const amt=+custDetailPartialAmt;
                            if(!amt||amt<=0){notify("Enter a valid amount");return;}
                            recordPaymentLedger(cFull.id,cFull.name,amt,"","Cash");
                            setCustDetailPartialAmt("");setSelectedCustomer(null);
                          }} style={{background:"#f59e0b",color:"#fff",border:"none",borderRadius:9,padding:"9px 18px",fontSize:13,fontWeight:700,cursor:"pointer"}}>Apply</button>
                        </div>
                      </div>}

                      {/* ── DELIVERIES LIST ── */}
                      <div style={{padding:"14px 18px"}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:10}}>
                          <p style={{color:t.text,fontWeight:700,fontSize:12}}>DELIVERIES ({allCDelivs.length})</p>
                          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                            {[["all","All"],["today","Today"],["yesterday","Yesterday"],["week","This Week"]].map(([k,l])=>(
                              <button key={k} onClick={()=>setCustDetailDelivFilter(k)}
                                style={{background:custDetailDelivFilter===k?"#2563eb":t.inp,color:custDetailDelivFilter===k?"#fff":t.sub,border:`1px solid ${custDetailDelivFilter===k?"#2563eb":t.border}`,borderRadius:99,padding:"4px 10px",fontSize:10,fontWeight:700,cursor:"pointer"}}>
                                {l}
                              </button>
                            ))}
                          </div>
                        </div>
                        {filtDelivs.length===0&&<p style={{color:t.sub,fontSize:12,textAlign:"center",padding:"16px 0"}}>No deliveries match this filter.</p>}
                        <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:320,overflowY:"auto"}}>
                          {filtDelivs.map((d,di)=>{
                            const tot=lineTotal(d.orderLines);
                            const dRepl=+d.replacement?.amount||0;
                            const dNet=Math.max(0,tot-dRepl);
                            const sc=d.status==="Delivered"?"#10b981":d.status==="Cancelled"?"#ef4444":"#f59e0b";
                            const invNo=(invRegistry?.issued||{})[d.id]||d.invNo||`TAS-${(d.date||"").replace(/-/g,"").slice(2)}-${(d.id||"").slice(-4).toUpperCase()}`;
                            const rows=Object.entries(safeO(d.orderLines)).filter(([,l])=>l.qty>0);
                            return <div key={d.id||di} style={{background:t.inp,borderRadius:12,padding:"10px 12px",border:`1px solid ${t.border}`,cursor:"pointer"}}
                              onClick={()=>setDetailModal({type:"delivery",data:d})}>
                              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                                <span style={{color:t.text,fontWeight:700,fontSize:12}}>{d.date}</span>
                                <span style={{display:"inline-flex",alignItems:"center",gap:3,background:`${sc}18`,color:sc,border:`1px solid ${sc}30`,borderRadius:99,padding:"2px 8px",fontSize:10,fontWeight:700}}>{d.status}</span>
                                {canSeePrices&&<span style={{color:"#10b981",fontWeight:800,fontSize:12,marginLeft:"auto"}}>{inr(tot)}</span>}
                                {dRepl>0&&<span style={{color:"#f97316",fontSize:10,fontWeight:700}}>-{inr(dRepl)} repl</span>}
                                <span style={{color:"#6366f1",fontSize:9,fontFamily:"monospace"}}>{invNo}</span>
                              </div>
                              {rows.length>0&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                                {rows.map(([pid,l])=>{const prod=products.find(p=>p.id===pid);return<span key={pid} style={{background:t.card,borderRadius:6,padding:"2px 8px",fontSize:10,color:t.sub,border:`1px solid ${t.border}`}}>
                                  {prod?.name||l.name||pid}: {l.qty} {canSeePrices&&l.priceAmount?`× ${inr(l.priceAmount)}`:""}
                                </span>;})}
                              </div>}
                              {d.notes&&<p style={{color:t.sub,fontSize:10,marginTop:4}}>📝 {d.notes}</p>}
                            </div>;
                          })}
                        </div>
                        {filtDelivs.length>0&&<p style={{color:t.sub,fontSize:10,textAlign:"right",marginTop:8}}>Click any delivery to open full detail</p>}
                      </div>
                    </div>;
                  })()}
                </div>;
              })}
              {/* Pagination */}
              {totalPages>1&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 4px"}}>
                <span style={{color:t.sub,fontSize:11}}>Showing {Math.min((custPage-1)*CPAGE+1,totalCustRows)}–{Math.min(custPage*CPAGE,totalCustRows)} of {totalCustRows}</span>
                <div style={{display:"flex",gap:4}}>
                  <button onClick={()=>{if(custPage>1){setCustPage(custPage-1);window.scrollTo({top:0,behavior:"smooth"});setSelectedCustomer(null);}}} disabled={custPage===1}
                    style={{background:t.inp,border:`1px solid ${t.border}`,color:custPage===1?t.sub:t.text,borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:custPage===1?"default":"pointer",opacity:custPage===1?0.5:1}}>← Prev</button>
                  <button onClick={()=>{if(custPage<totalPages){setCustPage(custPage+1);window.scrollTo({top:0,behavior:"smooth"});setSelectedCustomer(null);}}} disabled={custPage>=totalPages}
                    style={{background:t.inp,border:`1px solid ${t.border}`,color:custPage>=totalPages?t.sub:t.text,borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:custPage>=totalPages?"default":"pointer",opacity:custPage>=totalPages?0.5:1}}>Next →</button>
                </div>
              </div>}
            </div>;
          })()}
          {clvFilter==="og"&&custView==="expanded"&&!isMobile&&(()=>{
            // Apply sort + filter on top of existing fCust search filter
            let displayCust=[...fCust];
            if(custStatusFilter==="active") displayCust=displayCust.filter(c=>c.active);
            else if(custStatusFilter==="inactive") displayCust=displayCust.filter(c=>!c.active);
            else if(custStatusFilter==="owing") displayCust=displayCust.filter(c=>(c.pending||0)>0);
            else if(custStatusFilter==="clear") displayCust=displayCust.filter(c=>(c.pending||0)===0);
            displayCust=displayCust.map(c=>{
              const cDelivs=deliveries.filter(d=>d.customerId===c.id);
              const cDone=cDelivs.filter(d=>d.status==="Delivered");
              const lastDeliv=cDelivs.length>0?[...cDelivs].sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0]:null;
              const cRev=cDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
              return {...c,_cDelivs:cDelivs,_cDone:cDone,_lastDeliv:lastDeliv,_cRev:cRev};
            });
            if(custSortField==="name") displayCust.sort((a,b)=>a.name.localeCompare(b.name));
            else if(custSortField==="lastOrder") displayCust.sort((a,b)=>(b._lastDeliv?.date||"").localeCompare(a._lastDeliv?.date||""));
            else if(custSortField==="pending") displayCust.sort((a,b)=>(b.pending||0)-(a.pending||0));
            else if(custSortField==="orders") displayCust.sort((a,b)=>b._cDelivs.length-a._cDelivs.length);
            else if(custSortField==="revenue") displayCust.sort((a,b)=>b._cRev-a._cRev);

            return <>
            {displayCust.length===0&&<p style={{color:t.sub}} className="text-sm text-center py-8">No customers found.</p>}
            {/* ── CUSTOMERS DATA TABLE ── */}
            {displayCust.length>0&&(()=>{
              const CUST_PAGE_SIZE=50;
              const totalCustRows=displayCust.length;
              const pagedCust=displayCust.slice((custPage-1)*CUST_PAGE_SIZE,custPage*CUST_PAGE_SIZE);
              return <div style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:16,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
                <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",borderRadius:"16px 16px 0 0"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",minWidth:900}}>
                    <thead>
                      <tr style={{background:dm?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.025)",borderBottom:`1.5px solid ${t.border}`}}>
                        <th style={{padding:"11px 8px 11px 16px",width:32}}>
                          <input type="checkbox" style={{width:14,height:14,borderRadius:3,accentColor:"#2563eb",cursor:"pointer"}} onClick={e=>e.stopPropagation()}/>
                        </th>
                        <th style={{padding:"11px 0px",width:16}}/>
                        <th style={{padding:"11px 10px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Customer</th>
                        <th style={{padding:"11px 10px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Contact</th>
                        <th style={{padding:"11px 10px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Orders</th>
                        <th style={{padding:"11px 10px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Last Order</th>
                        <th style={{padding:"11px 10px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Status</th>
                        {canSeePrices&&<th style={{padding:"11px 10px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Paid</th>}
                        {canSeeFinancials&&<th style={{padding:"11px 10px",textAlign:"left",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Pending</th>}
                        <th style={{padding:"11px 12px 11px 10px",textAlign:"right",color:t.sub,fontSize:10,fontWeight:800,letterSpacing:"0.07em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedCust.map((c,ci)=>{
                        const cDelivs=c._cDelivs||[];
                        const lastDeliv=c._lastDeliv||null;
                        const lastDiffDays=lastDeliv?Math.floor((new Date()-new Date(lastDeliv.date))/(1000*60*60*24)):null;
                        const lastLabel=lastDiffDays===null?"Never":lastDiffDays===0?"Today":lastDiffDays===1?"Yesterday":`${lastDiffDays}d ago`;
                        const lastCol=lastDiffDays===null?"#94a3b8":lastDiffDays>14?"#ef4444":lastDiffDays>7?"#f59e0b":"#10b981";
                        const isEven=ci%2===0;
                        return <tr key={c.id}
                          style={{borderBottom:`1px solid ${t.border}`,background:selectedCustomer?.id===c.id?(dm?"rgba(37,99,235,0.15)":"rgba(37,99,235,0.06)"):isEven?(dm?"rgba(255,255,255,0.01)":"rgba(0,0,0,0.007)"):"transparent",transition:"background 0.12s",cursor:"pointer"}}
                          onClick={()=>{setSelectedCustomer(selectedCustomer?.id===c.id?null:c);setCustDetailDelivFilter("all");setCustDetailPartialAmt("");}}
                          onMouseEnter={e=>{e.currentTarget.style.background=dm?"rgba(255,255,255,0.04)":"rgba(37,99,235,0.04)";}}
                          onMouseLeave={e=>{e.currentTarget.style.background=selectedCustomer?.id===c.id?(dm?"rgba(37,99,235,0.15)":"rgba(37,99,235,0.06)"):isEven?(dm?"rgba(255,255,255,0.01)":"rgba(0,0,0,0.007)"):"transparent";}}>
                          {/* Checkbox */}
                          <td style={{padding:"12px 4px 12px 16px",verticalAlign:"middle",width:32}} onClick={e=>e.stopPropagation()}>
                            <input type="checkbox" style={{width:14,height:14,borderRadius:3,accentColor:"#2563eb",cursor:"pointer",display:"block"}} onClick={e=>e.stopPropagation()}/>
                          </td>
                          {/* Active dot — own column */}
                          <td style={{padding:"12px 0px",verticalAlign:"middle",width:16}}>
                            <span style={{display:"block",width:8,height:8,borderRadius:"50%",background:c.active?"#10b981":"#94a3b8"}}/>
                          </td>
                          {/* Customer name + join date stacked */}
                          <td style={{padding:"12px 10px",verticalAlign:"middle",maxWidth:150}}>
                            <div style={{display:"flex",alignItems:"center",gap:10}}>
                              {(()=>{
                                const avatarPalette=[["#f59e0b","#fffbeb"],["#10b981","#ecfdf5"],["#8b5cf6","#f5f3ff"],["#3b82f6","#eff6ff"],["#ef4444","#fef2f2"],["#f97316","#fff7ed"],["#06b6d4","#ecfeff"],["#ec4899","#fdf2f8"],["#84cc16","#f7fee7"],["#a855f7","#faf5ff"]];
                                const idx=c.name.charCodeAt(0)%avatarPalette.length;
                                const [fg,bg]=c.active?avatarPalette[idx]:["#9ca3af","rgba(107,114,128,0.1)"];
                                return <div style={{width:36,height:36,borderRadius:"50%",background:bg,color:fg,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:15,flexShrink:0,border:`1.5px solid ${fg}30`}}>
                                  {c.name.charAt(0).toUpperCase()}
                                </div>;
                              })()}
                              <div style={{minWidth:0}}>
                                <p style={{color:t.text,fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:2}}>{c.name}</p>
                                {c.joinDate&&<p style={{color:t.sub,fontSize:10}}>Since {c.joinDate}</p>}
                              </div>
                            </div>
                          </td>
                          {/* Contact */}
                          <td style={{padding:"12px 10px",verticalAlign:"middle",maxWidth:130}}>
                            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                              <span style={{color:t.text,fontSize:12}}>{c.address||"—"}</span>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:5}}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={t.sub} strokeWidth="2.5" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.72a16 16 0 0 0 5.38 5.38l1.52-1.34a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.01z"/></svg>
                              <span style={{color:t.sub,fontSize:12}}>{c.phone||"—"}</span>
                            </div>
                          </td>
                          {/* Orders count */}
                          <td style={{padding:"12px 10px",verticalAlign:"middle",whiteSpace:"nowrap"}}>
                            <p style={{color:t.text,fontWeight:700,fontSize:13,marginBottom:2}}>{cDelivs.length}</p>
                            <p style={{color:t.sub,fontSize:10}}>{(c._cDone||[]).length} delivered</p>
                          </td>
                          {/* Last Order */}
                          <td style={{padding:"12px 10px",verticalAlign:"middle",whiteSpace:"nowrap"}}>
                            <p style={{color:lastCol,fontWeight:700,fontSize:13,marginBottom:2}}>{lastLabel}</p>
                            {lastDeliv&&<p style={{color:t.sub,fontSize:10}}>{lastDeliv.date}</p>}
                          </td>
                          {/* Status pill */}
                          <td style={{padding:"12px 10px",verticalAlign:"middle"}}>
                            <span style={{display:"inline-flex",alignItems:"center",gap:5,background:c.active?"#10b98115":"#6b728015",color:c.active?"#059669":"#6b7280",border:`1px solid ${c.active?"#10b98125":"#6b728025"}`,borderRadius:99,padding:"3px 10px",fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>
                              <span style={{width:6,height:6,borderRadius:"50%",background:c.active?"#10b981":"#6b7280",display:"inline-block"}}/>
                              {c.active?"Active":"Inactive"}
                            </span>
                          </td>
                          {/* Paid */}
                          {canSeePrices&&<td style={{padding:"12px 10px",verticalAlign:"middle",textAlign:"left",whiteSpace:"nowrap"}}>
                            <span style={{color:"#059669",fontWeight:800,fontSize:13}}>{inr(c.paid||0)}</span>
                          </td>}
                          {/* Pending */}
                          {canSeeFinancials&&<td style={{padding:"12px 10px",verticalAlign:"middle",textAlign:"left",whiteSpace:"nowrap"}}>
                            {(c.pending||0)>0
                              ? <span style={{color:"#dc2626",fontWeight:800,fontSize:13}}>{inr(c.pending)}</span>
                              : <span style={{display:"inline-flex",alignItems:"center",gap:4,color:"#10b981",fontWeight:700,fontSize:13}}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                  Clear
                                </span>
                            }
                          </td>}
                          {/* Actions */}
                          <td style={{padding:"12px 12px 12px 10px",verticalAlign:"middle",textAlign:"right",whiteSpace:"nowrap"}}>
                            <div style={{display:"inline-flex",alignItems:"center",gap:6}}>
                              <button onClick={e=>{e.stopPropagation();setDetailModal({type:"customer",data:c});}}
                                title="View customer profile"
                                style={{width:32,height:32,borderRadius:8,background:dm?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)",border:`1px solid ${t.border}`,color:t.sub,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",transition:"all 0.12s"}}
                                onMouseEnter={e=>{e.currentTarget.style.background="#2563eb";e.currentTarget.style.color="#fff";e.currentTarget.style.borderColor="#2563eb";}}
                                onMouseLeave={e=>{e.currentTarget.style.background=dm?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)";e.currentTarget.style.color=t.sub;e.currentTarget.style.borderColor=t.border;}}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              </button>
                              <div style={{position:"relative"}}>
                                <button onClick={e=>{e.stopPropagation();const el=document.getElementById(`c3dot_${c.id}`);if(el){el.style.display=el.style.display==="block"?"none":"block";}}}
                                  style={{width:32,height:32,borderRadius:8,background:dm?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)",border:`1px solid ${t.border}`,color:t.sub,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",transition:"all 0.12s"}}
                                  onMouseEnter={e=>{e.currentTarget.style.background=dm?"rgba(255,255,255,0.12)":"rgba(0,0,0,0.09)";}}
                                  onMouseLeave={e=>{e.currentTarget.style.background=dm?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)";}}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                                </button>
                                <div id={`c3dot_${c.id}`} style={{display:"none",position:"absolute",right:0,top:"calc(100% + 6px)",background:t.card,border:`1px solid ${t.border}`,borderRadius:12,boxShadow:"0 8px 32px rgba(0,0,0,0.18)",zIndex:100,minWidth:180,overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
                                  {[
                                    can("cust_edit")&&{label:"✏️  Edit",action:()=>{setCsh(c);setCf(c);(()=>{const _el=document.getElementById(`c3dot_${c.id}`);if(_el)_el.style.display="none";})() ;}},
                                    can("cust_seePrices")&&{label:"🚚  View Deliveries",action:()=>{setTab("Deliveries");setDelivStatusFilter("all");(()=>{const _el=document.getElementById(`c3dot_${c.id}`);if(_el)_el.style.display="none";})() ;}},
                                    can("cust_markPaid")&&c.pending>0&&{label:"💰  Mark Paid",action:()=>{setPaySh(c);setPayAmt(String(c.pending||0));(()=>{const _el=document.getElementById(`c3dot_${c.id}`);if(_el)_el.style.display="none";})() ;}},
                                    can("cust_deactivate")&&{label:c.active?"🔒  Deactivate":"🔓  Activate",action:()=>{setCust(p=>safeArr(p).map(x=>x.id===c.id?{...x,active:!x.active}:x));addLog(c.active?"Deactivated":"Activated",c.name);(()=>{const _el=document.getElementById(`c3dot_${c.id}`);if(_el)_el.style.display="none";})() ;}},
                                    can("cust_delete")&&{label:"🗑️  Delete",color:"#ef4444",action:()=>{(()=>{const _el=document.getElementById(`c3dot_${c.id}`);if(_el)_el.style.display="none";})() ;ask(`Delete "${c.name}"?`,()=>{setCust(p=>safeArr(p).filter(x=>x.id!==c.id));addLog("Deleted customer",c.name);});}},
                                  ].filter(Boolean).map((item,ii)=>(
                                    <button key={ii} onClick={item.action}
                                      style={{display:"block",width:"100%",textAlign:"left",background:"none",border:"none",padding:"10px 16px",fontSize:13,fontWeight:600,color:item.color||t.text,cursor:"pointer",transition:"background 0.1s",borderBottom:`1px solid ${t.border}`}}
                                      onMouseEnter={e=>{e.currentTarget.style.background=dm?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)";}}
                                      onMouseLeave={e=>{e.currentTarget.style.background="none";}}>
                                      {item.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Table Pagination Footer */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 18px",borderTop:`1px solid ${t.border}`,flexWrap:"wrap",gap:10,background:dm?"rgba(255,255,255,0.02)":"rgba(0,0,0,0.015)"}}>
                  <p style={{color:t.sub,fontSize:12,fontWeight:500,flexShrink:0}}>
                    Showing <b style={{color:t.text}}>{Math.min((custPage-1)*CUST_PAGE_SIZE+1,totalCustRows)}</b> to <b style={{color:t.text}}>{Math.min(custPage*CUST_PAGE_SIZE,totalCustRows)}</b> of <b style={{color:t.text}}>{totalCustRows}</b> customers
                  </p>
                  {totalCustRows>CUST_PAGE_SIZE&&(()=>{
                    const totalPages=Math.ceil(totalCustRows/CUST_PAGE_SIZE);
                    const pages=[];
                    for(let p=1;p<=totalPages;p++){if(p===1||p===totalPages||Math.abs(p-custPage)<=1)pages.push(p);else if(pages[pages.length-1]!=="…")pages.push("…");}
                    return <div style={{display:"flex",gap:4,alignItems:"center"}}>
                      <button onClick={()=>{if(custPage>1){setCustPage(custPage-1);window.scrollTo({top:0,behavior:"smooth"});}}} disabled={custPage===1}
                        style={{width:32,height:32,borderRadius:8,background:t.inp,border:`1px solid ${t.border}`,color:custPage===1?t.sub:t.text,cursor:custPage===1?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",opacity:custPage===1?0.4:1}}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                      </button>
                      {pages.map((p,pi)=>p==="…"?<span key={`e${pi}`} style={{color:t.sub,fontSize:12,padding:"0 4px"}}>…</span>:
                        <button key={p} onClick={()=>{setCustPage(p);window.scrollTo({top:0,behavior:"smooth"});}}
                          style={{width:32,height:32,borderRadius:8,background:custPage===p?"#2563eb":t.inp,border:`1px solid ${custPage===p?"#2563eb":t.border}`,color:custPage===p?"#fff":t.text,fontWeight:custPage===p?800:500,fontSize:12,cursor:"pointer",transition:"all 0.12s"}}>{p}</button>
                      )}
                      <button onClick={()=>{const tp=Math.ceil(totalCustRows/CUST_PAGE_SIZE);if(custPage<tp){setCustPage(custPage+1);window.scrollTo({top:0,behavior:"smooth"});}}} disabled={custPage===Math.ceil(totalCustRows/CUST_PAGE_SIZE)}
                        style={{width:32,height:32,borderRadius:8,background:t.inp,border:`1px solid ${t.border}`,color:custPage===Math.ceil(totalCustRows/CUST_PAGE_SIZE)?t.sub:t.text,cursor:custPage===Math.ceil(totalCustRows/CUST_PAGE_SIZE)?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",opacity:custPage===Math.ceil(totalCustRows/CUST_PAGE_SIZE)?0.4:1}}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    </div>;
                  })()}
                  <span style={{color:t.sub,fontSize:11,flexShrink:0}}>{totalCustRows} total</span>
                </div>
              </div>;
            })()}

            {/* ── INLINE CUSTOMER DETAIL PANEL (opens below table on row click) ── */}
            {selectedCustomer&&(()=>{
              const c=customers.find(x=>x.id===selectedCustomer.id)||selectedCustomer;
              const allCDelivs=[...deliveries.filter(d=>d.customerId===c.id)].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
              const cDone=allCDelivs.filter(d=>d.status==="Delivered");
              const cPend=allCDelivs.filter(d=>d.status==="Pending"||d.status==="In Transit");
              const cReturns=allCDelivs.filter(d=>d.status==="Cancelled");
              const cRepl=allCDelivs.filter(d=>d.replacement?.done);
              const cReplAmt=allCDelivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
              const cPartialPaid=c.partialPay||0;
              const cPaid=c.paid||0;
              const cDue=c.pending||0;
              const cRev=cDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
              const cNetRev=Math.max(0,cRev-cReplAmt);
              const delivRate=allCDelivs.length>0?Math.round(cDone.length/allCDelivs.length*100):100;
              const collPct=(cPaid+cDue)>0?Math.round(cPaid/(cPaid+cDue)*100):100;
              const lastD=allCDelivs[0]||null;
              // Delivery filter
              const tStr=today();
              const yStr=(()=>{const d=new Date(tStr);d.setDate(d.getDate()-1);return d.toISOString().slice(0,10);})();
              const wStr=(()=>{const d=new Date(tStr);d.setDate(d.getDate()-6);return d.toISOString().slice(0,10);})();
              const filtDelivs=allCDelivs.filter(d=>{
                if(custDetailDelivFilter==="today") return d.date===tStr;
                if(custDetailDelivFilter==="yesterday") return d.date===yStr;
                if(custDetailDelivFilter==="week") return d.date>=wStr;
                return true;
              });
              // Merge deliveries to customer account
              const mergeEnabled=settings?.featureMergeDelivToCustomer!==false;
              return <div style={{background:t.card,border:`1.5px solid #2563eb40`,borderRadius:20,overflow:"hidden",boxShadow:dm?"0 8px 40px rgba(0,0,0,0.4)":"0 8px 32px rgba(37,99,235,0.1)",marginTop:8}}>
                {/* Header */}
                <div style={{padding:"16px 20px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:dm?"rgba(37,99,235,0.08)":"rgba(37,99,235,0.04)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:46,height:46,borderRadius:14,background:c.active?"#f59e0b20":"#6b728015",color:c.active?"#f59e0b":"#9ca3af",fontWeight:900,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,position:"relative"}}>
                      {c.name.charAt(0).toUpperCase()}
                      <span style={{position:"absolute",bottom:-2,right:-2,width:10,height:10,borderRadius:"50%",background:c.active?"#10b981":"#94a3b8",border:`2px solid ${t.card}`}}/>
                    </div>
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <p style={{color:t.text,fontWeight:800,fontSize:16,lineHeight:1.2}}>{c.name}</p>
                        <span style={{background:c.active?"#10b98115":"#6b728015",color:c.active?"#059669":"#6b7280",border:`1px solid ${c.active?"#10b98125":"#6b728025"}`,borderRadius:99,padding:"2px 10px",fontSize:10,fontWeight:700}}>● {c.active?"ACTIVE":"INACTIVE"}</span>
                        <span style={{background:cDue>0?"#ef444415":"#10b98115",color:cDue>0?"#dc2626":"#059669",border:`1px solid ${cDue>0?"#ef444425":"#10b98125"}`,borderRadius:99,padding:"2px 10px",fontSize:10,fontWeight:700}}>{cDue>0?"DUE":"✓ Clear"}</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:12,marginTop:4,flexWrap:"wrap"}}>
                        {c.phone&&<span style={{color:t.sub,fontSize:11}}>📞 {c.phone}</span>}
                        {lastD&&<span style={{color:t.sub,fontSize:11}}>🕒 {lastD.date}</span>}
                        {c.address&&<span style={{color:t.sub,fontSize:11}}>📍 {c.address}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    {canSeePrices&&<div style={{textAlign:"right"}}>
                      <p style={{color:"#10b981",fontWeight:900,fontSize:20,lineHeight:1}}>{inr(cPaid)}</p>
                      <p style={{color:t.sub,fontSize:10}}>collected</p>
                    </div>}
                    <button onClick={()=>setSelectedCustomer(null)} style={{width:32,height:32,borderRadius:9,background:t.inp,border:`1px solid ${t.border}`,color:t.sub,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700}}>∧</button>
                  </div>
                </div>

                {/* Body: two-col on desktop */}
                <div style={{display:"flex",flexDirection:"row",gap:0,flexWrap:"wrap"}}>

                  {/* LEFT COLUMN — stats + actions */}
                  <div style={{flex:"0 0 auto",width:"min(320px,100%)",borderRight:`1px solid ${t.border}`,padding:"16px 18px",display:"flex",flexDirection:"column",gap:12}}>
                    {/* Stat boxes */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                      {[
                        {label:"ORDERS",val:allCDelivs.length,color:"#3b82f6"},
                        {label:"DELIVERED",val:cDone.length,color:"#10b981"},
                        {label:"RETURNS",val:cReturns.length,color:"#ef4444"},
                      ].map(({label,val,color})=>(
                        <div key={label} style={{background:t.inp,borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
                          <p style={{color,fontWeight:900,fontSize:18,lineHeight:1}}>{val}</p>
                          <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginTop:4,letterSpacing:"0.05em"}}>{label}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                      {[
                        {label:"REPLACED",val:cRepl.length,color:"#f97316"},
                        {label:"REPL. DEDUCTED",val:inr(cReplAmt),color:"#f97316"},
                        {label:"PARTIAL PAID",val:inr(cPartialPaid),color:"#d97706"},
                      ].map(({label,val,color})=>(
                        <div key={label} style={{background:t.inp,borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
                          <p style={{color,fontWeight:800,fontSize:13,lineHeight:1}}>{val}</p>
                          <p style={{color:t.sub,fontSize:8,fontWeight:700,textTransform:"uppercase",marginTop:4,letterSpacing:"0.04em"}}>{label}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr",gap:8}}>
                      <div style={{background:t.inp,borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
                        <p style={{color:cDue>0?"#ef4444":"#10b981",fontWeight:800,fontSize:13,lineHeight:1}}>{inr(cDue)}</p>
                        <p style={{color:t.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",marginTop:4}}>PENDING</p>
                      </div>
                    </div>

                    {/* Delivery rate bar */}
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase"}}>Delivery Rate</span>
                        <span style={{color:delivRate>=90?"#10b981":delivRate>=70?"#f59e0b":"#ef4444",fontWeight:700,fontSize:10}}>{delivRate}%</span>
                      </div>
                      <div style={{height:7,borderRadius:7,background:t.border,overflow:"hidden"}}>
                        <div style={{width:`${delivRate}%`,height:"100%",background:delivRate>=90?"#10b981":delivRate>=70?"#f59e0b":"#ef4444",borderRadius:7,transition:"width 0.5s"}}/>
                      </div>
                    </div>

                    {/* Payment status box */}
                    {canSeePrices&&<div style={{background:t.inp,borderRadius:12,padding:"12px 14px",border:`1px solid ${t.border}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                        <span style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase"}}>Payment Status</span>
                        <span style={{color:cDue>0?"#f59e0b":"#10b981",fontWeight:700,fontSize:10}}>{cDue>0?"Partial":"✓ Fully Paid"}</span>
                      </div>
                      <div style={{height:6,borderRadius:6,background:t.border,overflow:"hidden",marginBottom:6}}>
                        <div style={{width:`${collPct}%`,height:"100%",background:"#10b981",borderRadius:6}}/>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between"}}>
                        <span style={{color:"#10b981",fontSize:11,fontWeight:700}}>Paid: {inr(cPaid)}</span>
                        <span style={{color:cDue>0?"#ef4444":"#10b981",fontSize:11,fontWeight:700}}>Due: {inr(cDue)}</span>
                      </div>
                    </div>}

                    {/* Location + join date */}
                    <div style={{display:"flex",flexDirection:"column",gap:4}}>
                      {c.address&&<p style={{color:t.sub,fontSize:11}}>📍 {c.address}</p>}
                      {c.joinDate&&<p style={{color:t.sub,fontSize:11}}>📅 Customer since {c.joinDate}</p>}
                    </div>

                    {/* Log Partial Payment */}
                    {isAdmin&&cDue>0&&<div style={{background:"#f59e0b10",border:"1px solid #f59e0b30",borderRadius:12,padding:"12px 14px"}}>
                      <p style={{color:"#f59e0b",fontWeight:700,fontSize:12,marginBottom:8}}>💰 LOG PARTIAL PAYMENT</p>
                      <div style={{display:"flex",gap:8}}>
                        <input type="number" placeholder="₹ Amount" value={custDetailPartialAmt} onChange={e=>setCustDetailPartialAmt(e.target.value)}
                          style={{flex:1,background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:10,padding:"10px 12px",fontSize:14,outline:"none"}}
                          onFocus={e=>{e.target.style.borderColor="#f59e0b";}} onBlur={e=>{e.target.style.borderColor=t.inpB;}}/>
                        <button onClick={()=>{
                          const amt=+custDetailPartialAmt;
                          if(!amt||amt<=0){notify("Enter a valid amount");return;}
                          recordPaymentLedger(c.id,c.name,amt,"Partial payment","Cash");
                          addLog("Partial payment logged",`${c.name} — ${inr(amt)}`);
                          setCustDetailPartialAmt("");
                          setSelectedCustomer(null);
                        }} style={{background:"#f59e0b",color:"#fff",border:"none",borderRadius:10,padding:"10px 16px",fontSize:14,fontWeight:700,cursor:"pointer"}}>Apply</button>
                      </div>
                    </div>}

                    {/* Action buttons */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                      {can("cust_edit")&&<button onClick={()=>{setCsh(c);setCf(c);setSelectedCustomer(null);}} style={{background:t.inp,border:`1px solid ${t.border}`,color:t.text,borderRadius:10,padding:"10px 8px",fontSize:12,fontWeight:700,cursor:"pointer",textAlign:"center"}}>✏️ Edit</button>}
                      {can("cust_export")&&<button onClick={()=>gExport("pdf",()=>exportPDF(c,products,"customer",settings,deliveries),"Customer PDF")} style={{background:"#7c3aed",color:"#fff",border:"none",borderRadius:10,padding:"10px 8px",fontSize:12,fontWeight:700,cursor:"pointer",textAlign:"center"}}>📄 PDF</button>}
                      {can("cust_export")&&<button onClick={()=>{const rows=[{...c}];gExport("excel",()=>exportTabExcel("Customer",rows,[{label:"Name",key:"name"},{label:"Phone",key:"phone"},{label:"Address",key:"address"},{label:"Paid",key:"paid",num:true},{label:"Pending",key:"pending",num:true}],settings),"Customer Excel");}} style={{background:"#059669",color:"#fff",border:"none",borderRadius:10,padding:"10px 8px",fontSize:12,fontWeight:700,cursor:"pointer",textAlign:"center"}}>📊 XLS</button>}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                      {isAdmin&&cDue>0&&<button onClick={()=>{setPaySh(c);setPayAmt(String(cDue));setSelectedCustomer(null);}} style={{background:"#f59e0b",color:"#fff",border:"none",borderRadius:10,padding:"10px 8px",fontSize:12,fontWeight:700,cursor:"pointer",textAlign:"center"}}>💰 Collect</button>}
                      {can("cust_deactivate")&&<button onClick={()=>{togActive(c);setSelectedCustomer(null);}} style={{background:t.inp,border:`1px solid ${t.border}`,color:t.sub,borderRadius:10,padding:"10px 8px",fontSize:12,fontWeight:700,cursor:"pointer",textAlign:"center"}}>{c.active?"⏸ Pause":"▶ Activate"}</button>}
                      {c.phone&&<a href={`https://wa.me/${c.phone.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" style={{background:"#25D366",color:"#fff",borderRadius:10,padding:"10px 8px",fontSize:12,fontWeight:700,cursor:"pointer",textAlign:"center",textDecoration:"none",display:"block"}}>📍 Map</a>}
                    </div>
                    {can("deliv_add")&&<button onClick={()=>{setDf({...blkD(),customer:c.name,customerId:c.id,address:c.address||"",lat:c.lat||0,lng:c.lng||0,orderLines:c.orderLines?{...c.orderLines}:blkOL()});setDsh("add");setSelectedCustomer(null);}} style={{background:"#2563eb",color:"#fff",border:"none",borderRadius:10,padding:"10px",fontSize:13,fontWeight:700,cursor:"pointer",width:"100%",marginBottom:4}}>+ Add Delivery</button>}
                    {can("cust_delete")&&<button onClick={()=>delC(c)} style={{background:"#ef444415",border:"1px solid #ef444430",color:"#ef4444",borderRadius:10,padding:"10px",fontSize:13,fontWeight:700,cursor:"pointer",width:"100%"}}>🗑 Delete</button>}
                  </div>

                  {/* RIGHT COLUMN — deliveries list */}
                  <div style={{flex:1,minWidth:280,padding:"16px 18px",display:"flex",flexDirection:"column",gap:14}}>
                    <div className="crm-toolbar-split" style={{gap:8}}>
                      <p style={{color:t.text,fontWeight:700,fontSize:13}}>DELIVERIES ({allCDelivs.length} total)</p>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        {[["all","All"],["today","Today"],["yesterday","Yesterday"],["week","This Week"]].map(([k,l])=>(
                          <button key={k} onClick={()=>setCustDetailDelivFilter(k)}
                            style={{background:custDetailDelivFilter===k?"#2563eb":t.inp,color:custDetailDelivFilter===k?"#fff":t.sub,border:`1px solid ${custDetailDelivFilter===k?"#2563eb":t.border}`,borderRadius:99,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>

                    {filtDelivs.length===0&&<p style={{color:t.sub,fontSize:13,textAlign:"center",padding:"24px 0"}}>No deliveries in this period.</p>}
                    <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:520,overflowY:"auto"}}>
                      {filtDelivs.map(d=>{
                        const dInvNo=(invRegistry?.issued||{})[d.id]||d.invNo||`TAS-${(d.date||"").replace(/-/g,"")}-${(d.id||"").slice(-4).toUpperCase()}`;
                        const dRcptNo=`RCP-${dInvNo.replace(/^[A-Z]+-/,"")}`;
                        const dTot=lineTotal(d.orderLines);
                        const dRepl=+d.replacement?.amount||0;
                        const dNet=Math.max(0,dTot-dRepl);
                        const dCollected=d.partialPayment?.enabled?(+(d.partialPayment?.amount)||0):0;
                        const dBal=Math.max(0,dNet-dCollected);
                        const sc=d.status==="Delivered"?"#10b981":d.status==="Cancelled"?"#ef4444":"#f59e0b";
                        const settled=dBal===0&&dTot>0;
                        const items=Object.entries(safeO(d.orderLines)).filter(([,l])=>l.qty>0);
                        // Auto-merge: if setting on, computed balance contributes to customer paid/pending
                        return <div key={d.id} style={{background:t.inp,borderRadius:14,padding:"12px 14px",border:`1px solid ${settled?"#10b98130":t.border}`}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                              <span style={{color:t.sub,fontSize:11,fontWeight:700}}>{d.date}</span>
                              <span style={{background:sc+"20",color:sc,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{d.status}</span>
                            </div>
                            <div style={{textAlign:"right",flexShrink:0}}>
                              {settled?<span style={{background:"#10b98115",color:"#10b981",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>✓ Settled</span>
                               :<span style={{background:"#f59e0b15",color:"#d97706",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>Due {inr(dBal)}</span>}
                            </div>
                          </div>
                          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:6}}>
                            <span style={{fontFamily:"monospace",fontSize:9,color:"#7c3aed",background:"#7c3aed10",borderRadius:5,padding:"2px 7px",fontWeight:700}}>{dInvNo}</span>
                            <span style={{fontFamily:"monospace",fontSize:9,color:"#0ea5e9",background:"#0ea5e910",borderRadius:5,padding:"2px 7px",fontWeight:700}}>{dRcptNo}</span>
                          </div>
                          {/* Items */}
                          {items.length>0&&<div style={{marginBottom:6}}>
                            {items.map(([pid,l],ii)=>{
                              const prod=products.find(p=>p.id===pid);
                              return <div key={pid} style={{display:"flex",justifyContent:"space-between",padding:"2px 0",fontSize:12}}>
                                <span style={{color:t.sub}}>{l.qty} × {prod?.name||l.name||pid}</span>
                                {canSeePrices&&<span style={{color:t.text,fontWeight:600}}>{inr(l.qty*(l.priceAmount||0))}</span>}
                              </div>;
                            })}
                          </div>}
                          {canSeePrices&&<div style={{borderTop:`1px solid ${t.border}`,paddingTop:6,display:"flex",flexDirection:"column",gap:2}}>
                            <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                              <span style={{color:t.sub}}>Order total</span>
                              <span style={{color:t.text,fontWeight:700}}>{inr(dTot)}</span>
                            </div>
                            {dRepl>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
                              <span style={{color:"#f97316"}}>🔄 Replacement</span>
                              <span style={{color:"#f97316",fontWeight:600}}>−{inr(dRepl)}</span>
                            </div>}
                            {dCollected>0&&<div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
                              <span style={{color:"#10b981"}}>💰 Collected</span>
                              <span style={{color:"#10b981",fontWeight:600}}>−{inr(dCollected)}</span>
                            </div>}
                          </div>}
                          {/* Merge button if setting enabled and delivery not yet merged */}
                          {mergeEnabled&&isAdmin&&d.status==="Delivered"&&!d._mergedToCustomer&&dTot>0&&(
                            <button onClick={e=>{
                              e.stopPropagation();
                              const net=Math.max(0,dTot-dRepl);
                              setDeliv(p=>safeArr(p).map(x=>x.id===d.id?{...x,_mergedToCustomer:true}:x));
                              recordPaymentLedger(c.id,c.name,net,"Delivery merged","Cash");
                              addLog("Delivery merged to account",`${c.name} — ${inr(net)}`);
                              notify(`${inr(net)} merged to ${c.name}'s account ✓`);
                            }} style={{marginTop:8,width:"100%",background:"#2563eb",color:"#fff",border:"none",borderRadius:8,padding:"7px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                              ↕ Merge to Account
                            </button>
                          )}
                          {d._mergedToCustomer&&<p style={{marginTop:6,color:"#10b981",fontSize:10,fontWeight:700,textAlign:"center"}}>✓ Merged to account</p>}
                        </div>;
                      })}
                    </div>
                  </div>
                </div>
              </div>;
            })()}
            </>;
          })()}
        </>);})()}

        {/* DELIVERIES */}
        {tab==="Deliveries"&&<DeliveriesTab dm={dm} t={t} isAdmin={isAdmin} sess={sess} can={can} canSeePrices={canSeePrices} settings={settings} notify={notify} addLog={addLog} today={today} inr={inr} ts={ts} safeArr={safeArr} safeO={safeO} lineTotal={lineTotal} exportCSV={exportCSV} exportTabPDF={exportTabPDF} exportTabExcel={exportTabExcel} exportPDF={exportPDF} exportDeliveryLabel={exportDeliveryLabel} exportDeliveryInvoice={exportDeliveryInvoice} shareWhatsApp={shareWhatsApp} deliveries={deliveries} setDeliv={setDeliv} setDf={setDf} setDsh={setDsh} blkD={blkD} delD={delD} delivStatusFilter={delivStatusFilter} setDelivStatusFilter={setDelivStatusFilter} delivDateFilter={delivDateFilter} setDelivDateFilter={setDelivDateFilter} delivDateFrom={delivDateFrom} setDelivDateFrom={setDelivDateFrom} delivDateTo={delivDateTo} setDelivDateTo={setDelivDateTo} delivView={delivView} setDelivView={setDelivView} delivCalendar={delivCalendar} setDelivCalendar={setDelivCalendar} calOffset={calOffset} setCalOffset={setCalOffset} calExpandedDay={calExpandedDay} setCalExpandedDay={setCalExpandedDay} delivPage={delivPage} setDelivPage={setDelivPage} delivBatchFilter={delivBatchFilter} setDelivBatchFilter={setDelivBatchFilter} delivExportOpen={delivExportOpen} setDelivExportOpen={setDelivExportOpen} customers={customers} products={products} prodTargets={allBatches} setDetailModal={setDetailModal} bulkSelect={bulkSelect} setBulkSelect={setBulkSelect} bulkSelected={bulkSelected} setBulkSelected={setBulkSelected} invRegistry={invRegistry} expandedDeliveryCust={expandedDeliveryCust} setExpandedDeliveryCust={setExpandedDeliveryCust} setLastReceiptData={setLastReceiptData}/>}
            {/* LEGACY_REMOVE_START */}
            {false&&<div className="flex flex-col gap-3">
              <div/>
              {pagedGroups.map(group=>{
                const isExpanded=expandedDeliveryCust===group.customerId||expandedDeliveryCust===group.name;
                const totalOrders=group.delivs.length;
                const totalAmt=group.delivs.reduce((s,d)=>s+lineTotal(d.orderLines),0);
                const totalRepl=group.delivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
                const totalCollected=group.delivs.reduce((s,d)=>s+(d.partialPayment?.enabled?(+d.partialPayment?.amount||0):0),0);
                // Use customer.pending as the source of truth for outstanding balance
                const groupCust=customers.find(c=>c.id===group.customerId);
                const totalBalance=groupCust?(groupCust.pending||0):Math.max(0,totalAmt-totalRepl-totalCollected);
                const totalPaid=groupCust?(groupCust.paid||0):totalCollected;
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
                    {canSeePrices&&<div className="crm-grid-4" style={{background:dm?"rgba(0,0,0,0.2)":"rgba(245,158,11,0.04)",padding:"10px 16px",gap:8,borderBottom:`1px solid ${t.border}`}}>
                      {[
                        {l:"Total Billed",v:inr(totalAmt),c:"#f59e0b"},
                        {l:"Replacements",v:totalRepl>0?`−${inr(totalRepl)}`:"None",c:totalRepl>0?"#f97316":t.sub},
                        {l:"Total Paid",v:inr(totalPaid),c:"#10b981"},
                        {l:totalBalance>0?"Balance Due":"✓ All Clear",v:totalBalance>0?inr(totalBalance):"—",c:totalBalance>0?"#ef4444":"#10b981"},
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
                      // Balance due: use delivery-level partial payment. If customer has zero pending overall, treat as settled.
                      const delivCust=customers.find(c=>c.id===d.customerId);
                      const custFullyPaid=(delivCust?.pending||0)===0&&(delivCust?.paid||0)>0;
                      const balanceDue=custFullyPaid?0:Math.max(0,netAmt-collected);
                      const sc=d.status==="Delivered"?"#10b981":d.status==="In Transit"?"#0ea5e9":d.status==="Cancelled"?"#ef4444":"#f59e0b";
                      const invNo=(invRegistry?.issued||{})[d.id]||d.invNo||null;
                      const rcptNo=invNo?`RCP-${invNo.replace(/^[A-Z]+-/,"")}`:`RCP-${(d.id||"").slice(-6).toUpperCase()}`;
                      const isBulkChecked=bulkSelected.has(d.id);
                      // Batch info if any production record on same date
                      // Only show batches whose product strictly matches at least one product ordered in this delivery
                      // Show specific assigned batch if batchId is set; otherwise fall back to product+date match
                      const batchesOnDate=d.batchId?(allBatches||[]).filter(pt=>pt.batchId===d.batchId):(allBatches||[]).filter(pt=>pt.date===d.date&&pt.product&&Object.entries(safeO(d.orderLines)).some(([pid,l])=>{if(!(l.qty>0))return false;const p=products.find(x=>x.id===pid);return prodNamesMatch(p?.name||l.name||"",pt.product);}));
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
                                {batchesOnDate.length>0&&<span style={{color:"#7c3aed",fontSize:10,fontWeight:700,background:dm?"rgba(124,58,237,0.12)":"rgba(124,58,237,0.07)",borderRadius:4,padding:"1px 6px"}}>{d.batchId?"🏭":"⚡"} {batchesOnDate.map(b=>b.batchLabel||"Batch").join(", ")}{!d.batchId&&" (auto)"}</span>}
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
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                            <p style={{color:"#f97316",fontWeight:800,fontSize:11}}>🔄 Replacement Made</p>
                            {d.replacement?.type&&<span style={{background:"#f9731622",color:"#f97316",fontSize:9,fontWeight:700,padding:"1px 7px",borderRadius:99,border:"1px solid #f9731640"}}>{d.replacement.type}</span>}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {d.replacement.item&&<span style={{color:t.text,fontSize:11}}>Item: <b>{d.replacement.item}</b></span>}
                            {d.replacement.qty&&<span style={{color:t.text,fontSize:11}}>Qty: <b>{d.replacement.qty}</b></span>}
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
                        <div className="flex gap-2 overflow-x-auto pb-0.5" style={{WebkitOverflowScrolling:"touch",scrollbarWidth:"none",msOverflowStyle:"none",minWidth:0,flexWrap:"nowrap"}}>
                          {d.address&&<a href={mapU(d.address,d.lat,d.lng)} target="_blank" rel="noopener noreferrer" style={{background:"#0ea5e9",color:"#fff",minHeight:40,padding:"0 12px",borderRadius:10,fontSize:12,fontWeight:700,display:"inline-flex",alignItems:"center",gap:5,WebkitTapHighlightColor:"transparent",textDecoration:"none",flexShrink:0}}>📍 Nav</a>}
                          <button onClick={()=>{setDf({...d,orderLines:{...safeO(d.orderLines)},replacement:d.replacement||{done:false,item:"",reason:"",qty:""}});setDsh(d);}} style={{background:t.inp,color:t.text,border:`1.5px solid ${t.border}`,minHeight:40,padding:"0 12px",borderRadius:10,fontSize:12,fontWeight:600,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"inline-flex",alignItems:"center",cursor:"pointer",flexShrink:0}}>Edit</button>
                          <button onClick={()=>gExport("pdf",()=>exportPDF(d,products,"delivery",settings),"Delivery PDF")} style={{background:"#7c3aed",color:"#fff",minHeight:40,padding:"0 12px",borderRadius:10,fontSize:12,fontWeight:700,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"inline-flex",alignItems:"center",cursor:"pointer",flexShrink:0}}>PDF</button>
                          {(isAdmin||(sess?.role==="agent"&&(settings?.receiptVisibleTo||["agent"]).includes("agent"))||(sess?.role==="factory"&&(settings?.receiptVisibleTo||["agent"]).includes("factory")))&&settings?.agentInvoiceEnabled!==false&&<button onClick={()=>setLastReceiptData({delivery:d,amt:d.partialPayment?.amount||0,note:d.partialPayment?.note||"",customer:d.customer,ts:d.partialPayment?.collectedAt||d.date,viewOnly:true})} style={{background:"#0ea5e9",color:"#fff",minHeight:40,padding:"0 12px",borderRadius:10,fontSize:12,fontWeight:700,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"inline-flex",alignItems:"center",gap:5,cursor:"pointer",flexShrink:0}}>🧾 Receipt</button>}
                          {isAdmin&&<button onClick={()=>exportDeliveryInvoice(d,products,settings,getOrCreateInvNo(d.id))} style={{background:"#7c3aed",color:"#fff",minHeight:40,padding:"0 12px",borderRadius:10,fontSize:12,fontWeight:700,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"inline-flex",alignItems:"center",gap:5,cursor:"pointer",flexShrink:0}}>📄 Invoice</button>}
                          {settings?.featurePrintLabels&&<button onClick={()=>exportDeliveryLabel(d,settings)} style={{background:"#0891b2",color:"#fff",minHeight:40,padding:"0 12px",borderRadius:10,fontSize:12,fontWeight:700,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"inline-flex",alignItems:"center",gap:5,cursor:"pointer",flexShrink:0}}>🏷️ Label</button>}
                          <button onClick={()=>shareWhatsApp(d,products,"delivery",settings)} style={{background:"#25D366",color:"#fff",minHeight:40,padding:"0 12px",borderRadius:10,fontSize:12,fontWeight:700,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"inline-flex",alignItems:"center",gap:5,cursor:"pointer",flexShrink:0}}>WA</button>
                          {can("deliv_dispatch")&&d.status==="Pending"&&<button onClick={()=>{setDeliv(p=>safeArr(p).map(x=>x.id===d.id?{...x,status:"In Transit"}:x));addLog("Dispatched",d.customer);notify("Marked In Transit");captureGPS("marked_transit",d.customer);}} style={{background:"#f59e0b",color:"#000",minHeight:40,padding:"0 12px",borderRadius:10,fontSize:12,fontWeight:700,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"inline-flex",alignItems:"center",gap:5,cursor:"pointer",flexShrink:0}}>🚚 Dispatch</button>}
                          {can("deliv_markDone")&&(settings?.featureTickRedesign!==false?(
  <button onClick={()=>{setDeliv(p=>safeArr(p).map(x=>x.id===d.id?{...x,status:d.status==="Delivered"?"Pending":"Delivered",deliveryDate:d.status!=="Delivered"?today():""}:x));addLog("Status changed",d.customer+" → "+(d.status==="Delivered"?"Pending":"Delivered"));notify(d.status==="Delivered"?"Marked Pending":"✓ Delivered");}}
    style={{minHeight:44,padding:"0 16px",borderRadius:12,fontSize:13,fontWeight:800,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"inline-flex",alignItems:"center",gap:8,cursor:"pointer",flexShrink:0,transition:"all 0.15s",
      background:d.status==="Delivered"?"#10b98122":"#10b981",
      color:d.status==="Delivered"?"#10b981":"#fff",
      border:`2px solid ${d.status==="Delivered"?"#10b98155":"#10b981"}`,
      boxShadow:d.status!=="Delivered"?"0 2px 8px #10b98144":"none"}}>
    <span style={{width:20,height:20,borderRadius:6,border:`2px solid ${d.status==="Delivered"?"#10b981":"#fff"}`,background:d.status==="Delivered"?"#10b981":"transparent",display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>
      {d.status==="Delivered"&&<svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4.5l3 3 6-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    </span>
    {d.status==="Delivered"?"Delivered":"Mark Done"}
  </button>
):(
  d.status!=="Delivered"&&<button onClick={()=>{setDeliv(p=>safeArr(p).map(x=>x.id===d.id?{...x,status:"Delivered"}:x));addLog("Status changed",d.customer+" → Delivered");notify("Marked Delivered");}} style={{background:"#10b981",color:"#fff",minHeight:40,padding:"0 12px",borderRadius:10,fontSize:12,fontWeight:700,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"inline-flex",alignItems:"center",gap:5,cursor:"pointer",flexShrink:0}}>✓ Done</button>
))}
                          {(can("cust_markPaid")||can("deliv_markDone"))&&(settings?.agentCollectEnabled!==false)&&d.status!=="Cancelled"&&(!d.partialPayment?.enabled||!d.partialPayment?.amount)&&<button onClick={()=>{setCollectSh(d);const _replAmt=+d.replacement?.amount||0;const _net=Math.max(0,lineTotal(d.orderLines)-_replAmt);setCollectAmt(String(_net>0?_net:lineTotal(d.orderLines)));setCollectNote("");}} style={{background:"#10b981",color:"#fff",minHeight:40,padding:"0 12px",borderRadius:10,fontSize:12,fontWeight:700,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"inline-flex",alignItems:"center",gap:5,cursor:"pointer",flexShrink:0}}>💰 Collect</button>}
                          {can("deliv_delete")&&<button onClick={()=>delD(d)} style={{background:"#dc2626",color:"#fff",minHeight:40,padding:"0 12px",borderRadius:10,fontSize:12,fontWeight:700,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",display:"inline-flex",alignItems:"center",cursor:"pointer",flexShrink:0}}>Delete</button>}
                        </div>
                      </div>;
                    })}
                  </div>}
                </Card>;
              })}
            </div>}

        {/* SUPPLIES */}

        {/* SUPPLIES */}
        {tab==="Supplies"&&<>
          {/* #19 Stock depletion alert */}
          {isAdmin && predictions?.summary?.criticalStockCount > 0 && (
            <StockOutAlert predictions={predictions} dm={dm} t={t} />
          )}
          <SuppliesTab dm={dm} isAdmin={isAdmin} can={can} canSeeFinancials={canSeeFinancials} supplies={supplies} settings={settings} srch={srch} fSup={fSup} totalSupC={totalSupC} lowStockItems={lowStockItems} setSf={setSf} setSsh={setSsh} blkS={blkS} delS={delS}/>
        </>}

        {/* EXPENSES */}
        {tab==="Expenses"&&<ExpensesTab dm={dm} expenses={expenses} wastage={wastage} supplies={supplies} deliveries={deliveries} settings={settings} totalExpOp={totalExpOp} totalSupC={totalSupC} totalRev={totalRev} netProfit={netProfit} expDateFilter={expDateFilter} setExpDateFilter={setExpDateFilter} expCatFilter={expCatFilter} setExpCatFilter={setExpCatFilter} expCustomFrom={expCustomFrom} setExpCustomFrom={setExpCustomFrom} expCustomTo={expCustomTo} setExpCustomTo={setExpCustomTo} expSearch={expSearch} setExpSearch={setExpSearch} setEsh={setEsh} setEf={setEf} blkE={blkE} setDetailModal={setDetailModal}/>}


        {/* WASTAGE */}
        {tab==="Wastage"&&<WastageTab dm={dm} sess={sess} isAdmin={isAdmin} can={can} wastage={wastage} settings={settings} srch={srch} setWSh={setWSh} setWF={setWF} blkW={blkW} delW={delW} addLog={addLog}/>}


        {/* ══════════════════════════════════════════════════════════════
            PAYMENTS TAB — Full ledger, outstanding balances, daily summary
            ══════════════════════════════════════════════════════════════ */}
        {tab==="Payments"&&<PaymentsTab dm={dm} t={t} isAdmin={isAdmin} today={today} inr={inr} ts={ts} lineTotalWithTax={lineTotalWithTax} deliveries={deliveries} customers={customers} setDetailModal={setDetailModal} taxRtGlobal={taxRtGlobal} invRegistry={invRegistry} paymentLedger={paymentLedger} setPayLedgerSh={setPayLedgerSh} setPayLedgerCust={setPayLedgerCust} setPayLedgerAmt={setPayLedgerAmt} setPayLedgerNote={setPayLedgerNote} setPayLedgerMethod={setPayLedgerMethod} paymentsSubTab={paymentsSubTab} setPaymentsSubTab={setPaymentsSubTab} paymentsSearch={paymentsSearch} setPaymentsSearch={setPaymentsSearch} paymentsDateFilter={paymentsDateFilter} setPaymentsDateFilter={setPaymentsDateFilter} delPayment={delPayment}/> }

        {/* P&L TAB */}
        {tab==="P&L" && <PnLTab deliveries={deliveries} supplies={supplies} expenses={expenses} wastage={wastage} customers={customers} products={products} prodTargets={allBatches} t={t} dm={dm} isAdmin={isAdmin} can={can} paymentLedger={paymentLedger} exportCSV={exportCSV} setDetailModal={setDetailModal} setTab={setTab} invRegistry={invRegistry} />}

                {/* ANALYTICS EXPORT HELPERS */}
        {/* These are defined as inline closures inside JSX scope so they can close over live data */}

        {/* ANALYTICS TAB */}
        {tab==="Analytics"&&<>
          <AnalyticsTab dm={dm} isAdmin={isAdmin} canSeePrices={canSeePrices} deliveries={deliveries} expenses={expenses} supplies={supplies} wastage={wastage} customers={customers} products={products} prodTargets={allBatches} qcLogs={qcLogs} actLog={actLog} settings={settings} paymentLedger={paymentLedger} invRegistry={invRegistry} totalRev={totalRev} totalExpOp={totalExpOp} totalSupC={totalSupC} netProfit={netProfit} anlPeriod={anlPeriod} setAnlPeriod={setAnlPeriod} anlCustomFrom={anlCustomFrom} setAnlCustomFrom={setAnlCustomFrom} anlCustomTo={anlCustomTo} setAnlCustomTo={setAnlCustomTo} anlSpecificDate={anlSpecificDate} setAnlSpecificDate={setAnlSpecificDate} anlActiveSection={anlActiveSection} setAnlActiveSection={setAnlActiveSection} anlCustSearch={anlCustSearch} setAnlCustSearch={setAnlCustSearch} anlCustSort={anlCustSort} setAnlCustSort={setAnlCustSort} anlCustFilter={anlCustFilter} setAnlCustFilter={setAnlCustFilter} anlCustExpanded={anlCustExpanded} setAnlCustExpanded={setAnlCustExpanded} anlProdSort={anlProdSort} setAnlProdSort={setAnlProdSort} anlProdExpanded={anlProdExpanded} setAnlProdExpanded={setAnlProdExpanded} anlOpsView={anlOpsView} setAnlOpsView={setAnlOpsView} anlFinView={anlFinView} setAnlFinView={setAnlFinView} anlOverviewMetric={anlOverviewMetric} setAnlOverviewMetric={setAnlOverviewMetric} anlExportOpen={anlExportOpen} setAnlExportOpen={setAnlExportOpen} anlChartType={anlChartType} setAnlChartType={setAnlChartType} anlTrendMetric={anlTrendMetric} setAnlTrendMetric={setAnlTrendMetric} anlShowInsights={anlShowInsights} setAnlShowInsights={setAnlShowInsights} setTab={setTab}/>
          {/* #19 Predictive Intelligence section */}
          {isAdmin && (
            <div style={{marginTop:24}}>
              <p style={{color:t.sub,fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>🔮 Predictive Intelligence</p>
              <PredictivePanel
                predictions={predictions} dm={dm} t={t}
                products={products} customers={customers} supplies={supplies} settings={settings}
                onSelectCustomer={c => {
                  const full = customers.find(x => x.id === c.id);
                  if (full) setDetailModal({ type:"customer", data:full });
                }}
              />
            </div>
          )}
        </>}


        {/* PRODUCTION + QC + WASTAGE (merged) — see Production.js */}
        {tab==="Production"&&<ProductionTab dm={dm} t={t} today={today} ts={ts} uid={uid} inr={inr} notify={notify} ask={ask} addLog={addLog} addNotif={addNotif} captureGPS={captureGPS} can={can} canSeePrices={canSeePrices} canSeeFinancials={canSeeFinancials} isAdmin={isAdmin} isFactory={isFactory} sess={sess} displayName={displayName} settings={settings} products={products} prodItems={prodItems} prodTargets={allBatches} setProdTargets={setProdTargets} wastage={wastage} setWaste={setWaste} qcLogs={qcLogs} setQcLogs={setQcLogs} handovers={handovers} setHandovers={setHandovers} deliveries={deliveries} customers={customers} invRegistry={invRegistry} safeO={safeO} safeArr={safeArr} lineTotal={lineTotal} prodNamesMatch={prodNamesMatch} exportTabPDF={exportTabPDF} blkW={blkW} ptSh={ptSh} setPtSh={setPtSh} ptF={ptF} setPtF={setPtF} ptDateFilter={ptDateFilter} setPtDateFilter={setPtDateFilter} ptSearch={ptSearch} setPtSearch={setPtSearch} ptShiftFilter={ptShiftFilter} setPtShiftFilter={setPtShiftFilter} ptCustomFrom={ptCustomFrom} setPtCustomFrom={setPtCustomFrom} ptCustomTo={ptCustomTo} setPtCustomTo={setPtCustomTo} ptProductFilter={ptProductFilter} setPtProductFilter={setPtProductFilter} ptWasteTypeFilter={ptWasteTypeFilter} setPtWasteTypeFilter={setPtWasteTypeFilter} ptQcGradeFilter={ptQcGradeFilter} setPtQcGradeFilter={setPtQcGradeFilter} ptHandoverFilter={ptHandoverFilter} setPtHandoverFilter={setPtHandoverFilter} ptShowFilters={ptShowFilters} setPtShowFilters={setPtShowFilters} prodSubTab={prodSubTab} setProdSubTab={setProdSubTab} wSh={wSh} setWSh={setWSh} wF={wF} setWF={setWF} hvSh={hvSh} setHvSh={setHvSh} hvF={hvF} setHvF={setHvF} qcSh={qcSh} setQcSh={setQcSh} qcF={qcF} setQcF={setQcF} T={T} SectionHeader={SectionHeader} StatCard={StatCard} Card={Card} Btn={Btn} Inp={Inp} Sel={Sel} Pill={Pill} Sheet={Sheet} Tog={Tog}/>}

        {/* GPS TAB */}
        {/* ═══════════════════════════════════════════════════════
            INGREDIENTS — Consumption Tracking
        ═══════════════════════════════════════════════════════ */}
        {tab==="Ingredients"&&<IngredientsTab dm={dm} t={t} isAdmin={isAdmin} settings={settings} displayName={displayName} ingLogs={ingLogs} ingItems={ingItems} setIngItems={setIngItems} ingSearch={ingSearch} setIngSearch={setIngSearch} ingDateFilter={ingDateFilter} setIngDateFilter={setIngDateFilter} ingSh={ingSh} setIngSh={setIngSh} ingF={ingF} setIngF={setIngF} ingItemSh={ingItemSh} setIngItemSh={setIngItemSh} ingItemF={ingItemF} setIngItemF={setIngItemF} saveIng={saveIng} saveIngItem={saveIngItem} delIng={delIng} ask={ask} notify={notify} safeArr={safeArr}/>}

        {/* ═══════════════════════════════════════════════════════
            STAFF — Attendance & Shift Log
        ═══════════════════════════════════════════════════════ */}
        {tab==="Staff"&&<StaffTab dm={dm} t={t} isAdmin={isAdmin} isFactory={isFactory} settings={settings} displayName={displayName} staffLogs={staffLogs} staffList={staffList} setStaffList={setStaffList} staffSearch={staffSearch} setStaffSearch={setStaffSearch} staffDateFilter={staffDateFilter} setStaffDateFilter={setStaffDateFilter} staffSubTab={staffSubTab} setStaffSubTab={setStaffSubTab} staffSh={staffSh} setStaffSh={setStaffSh} staffF={staffF} setStaffF={setStaffF} staffMemberSh={staffMemberSh} setStaffMemberSh={setStaffMemberSh} staffMemberF={staffMemberF} setStaffMemberF={setStaffMemberF} saveStaff={saveStaff} saveStaffMember={saveStaffMember} delStaff={delStaff} ask={ask} notify={notify} safeArr={safeArr}/>}

        {/* ═══════════════════════════════════════════════════════
            MACHINES — Maintenance Log
        ═══════════════════════════════════════════════════════ */}
        {tab==="Machines"&&<MachinesTab dm={dm} t={t} isAdmin={isAdmin} isFactory={isFactory} settings={settings} displayName={displayName} inr={inr} machineLogs={machineLogs} machineList={machineList} setMachineList={setMachineList} machSearch={machSearch} setMachSearch={setMachSearch} machSubTab={machSubTab} setMachSubTab={setMachSubTab} machSh={machSh} setMachSh={setMachSh} machF={machF} setMachF={setMachF} machItemSh={machItemSh} setMachItemSh={setMachItemSh} machItemF={machItemF} setMachItemF={setMachItemF} saveMach={saveMach} saveMachItem={saveMachItem} delMach={delMach} ask={ask} notify={notify} safeArr={safeArr}/>}

        {/* ═══════════════════════════════════════════════════════
            VEHICLES — Van / Fleet Management
        ═══════════════════════════════════════════════════════ */}
        {tab==="Vehicles"&&<VehiclesTab dm={dm} t={t} isAdmin={isAdmin} isFactory={isFactory} settings={settings} inr={inr} vehLogs={vehLogs} vehList={vehList} setVehList={setVehList} vehSearch={vehSearch} setVehSearch={setVehSearch} vehSubTab={vehSubTab} setVehSubTab={setVehSubTab} vehSh={vehSh} setVehSh={setVehSh} vehF={vehF} setVehF={setVehF} vehItemSh={vehItemSh} setVehItemSh={setVehItemSh} vehItemF={vehItemF} setVehItemF={setVehItemF} saveVehFixed={saveVehFixed} saveVehItem={saveVehItem} delVeh={delVeh} ask={ask} notify={notify} safeArr={safeArr}/>}

        {/* GPS */}
        {tab==="GPS"&&<GPSTab dm={dm} t={t} isAdmin={isAdmin} can={can} settings={settings} notify={notify} ask={ask} today={today} ts={ts} safeArr={safeArr} deliveries={deliveries} gpsLogs={gpsLogs} setGpsLogs={setGpsLogs} gpsFilter={gpsFilter} setGpsFilter={setGpsFilter} gpsSubSection={gpsSubSection} setGpsSubSection={setGpsSubSection} gpsDateFilter={gpsDateFilter} setGpsDateFilter={setGpsDateFilter} gpsActionFilter={gpsActionFilter} setGpsActionFilter={setGpsActionFilter}/>}

        {/* SETTINGS */}
        {tab==="Settings"&&<SettingsTab dm={dm} t={t} isAdmin={isAdmin} sess={sess} can={can} canSeePrices={canSeePrices} canSeeFinancials={canSeeFinancials} settings={settings} setSettings={setSettings} displayName={displayName} notify={notify} ask={ask} addLog={addLog} today={today} inr={inr} uid={uid} ts={ts} safeArr={safeArr} safeO={safeO} lineTotal={lineTotal} lineTotalWithTax={lineTotalWithTax} exportCSV={exportCSV} exportTabExcel={exportTabExcel} exportPDF={exportPDF} deliveries={deliveries} setDeliv={setDeliv} dF={dF} setDf={setDf} dSh={dSh} setDsh={setDsh} saveD={saveD} customers={customers} products={products} users={users} setUsers={setUsers} onLogout={onLogout} onSessUpdate={onSessUpdate} exportAll={exportAll} importAll={importAll} bulkOrderSh={bulkOrderSh} setBulkOrderSh={setBulkOrderSh} bulkOrderRows={bulkOrderRows} setBulkOrderRows={setBulkOrderRows} bulkOrderDate={bulkOrderDate} setBulkOrderDate={setBulkOrderDate} bulkOrderStatus={bulkOrderStatus} setBulkOrderStatus={setBulkOrderStatus} invRegistry={invRegistry} setInvRegistry={setInvRegistry} lastReceiptData={lastReceiptData} setLastReceiptData={setLastReceiptData} payLedgerSh={payLedgerSh} setPayLedgerSh={setPayLedgerSh} payLedgerCust={payLedgerCust} setPayLedgerCust={setPayLedgerCust} payLedgerAmt={payLedgerAmt} setPayLedgerAmt={setPayLedgerAmt} payLedgerNote={payLedgerNote} setPayLedgerNote={setPayLedgerNote} payLedgerMethod={payLedgerMethod} setPayLedgerMethod={setPayLedgerMethod} recordPaymentLedger={recordPaymentLedger} settingsSection={settingsSection} setSettingsSection={setSettingsSection} changePwF={changePwF} setChangePwF={setChangePwF} changePwSh={changePwSh} setChangePwSh={setChangePwSh} uF={uF} setUf={setUf} uSh={uSh} setUsh={setUsh} blkU={blkU} pF={pF} setPf={setPf} pSh={pSh} setPsh={setPsh} blkP={blkP} piF={piF} setPiF={setPiF} piSh={piSh} setPiSh={setPiSh} lastBackupDate={lastBackupDate}/>}
      </div>

      {/* ── MOBILE BOTTOM NAV — clean FAB-style bar ──────── */}
      {(()=>{
        const BN_PRIMARY=["Dashboard","Customers","Deliveries","Payments"];
        const bnTabs=BN_PRIMARY.filter(tb=>TABS.includes(tb));
        const moreTabs=TABS.filter(tb=>!BN_PRIMARY.includes(tb));
        const isMoreActive=moreTabs.includes(tab);

        // Which tabs have a meaningful FAB action
        const FAB_TABS=["Customers","Deliveries","Payments","Supplies","Expenses","Wastage","Ingredients","Staff","Machines","Vehicles"];
        const fabActive=FAB_TABS.includes(tab);

        const FAB_LABELS={
          "Customers":"New Customer",
          "Deliveries":"New Delivery",
          "Payments":"Record Payment",
          "Supplies":"Log Supply",
          "Expenses":"Add Expense",
          "Wastage":"Log Wastage",
          "Ingredients":"Log Consumption",
          "Staff":"Log Attendance",
          "Machines":"Log Maintenance",
          "Vehicles":"Log Trip",
        };

        function handleFab(){
          setShowMoreNav(false);
          if(tab==="Customers")    { setCsh("add"); setCf(blkC()); }
          else if(tab==="Deliveries")   { setDf(blkD()); setDsh("add"); }
          else if(tab==="Payments")     { setPayLedgerCust(null); setPayLedgerAmt(""); setPayLedgerNote(""); setPayLedgerMethod("Cash"); setPayLedgerSh(true); }
          else if(tab==="Supplies")     { setSf(blkS()); setSsh("add"); }
          else if(tab==="Expenses")     { setEf(blkE()); setEsh("add"); }
          else if(tab==="Wastage")      { setWF(blkW()); setWSh("add"); }
          else if(tab==="Ingredients")  { setIngF({ingredient:"",qty:"",unit:(settings?.supplyUnits||["kg"])[0]||"kg",date:today(),notes:"",loggedBy:displayName}); setIngSh("add"); }
          else if(tab==="Staff")        { setStaffF({staffId:"",staffName:"",date:today(),shift:settings?.staffDefaultShift||(settings?.staffShifts||["Morning"])[0]||"Morning",status:(settings?.staffStatuses||["Present"])[0],inTime:"",outTime:"",breakMins:"",department:"",task:"",overtimeReason:"",notes:"",temperature:"",loggedBy:displayName}); setStaffSh("add"); }
          else if(tab==="Machines")     { setMachF({machineId:"",machineName:"",date:today(),type:(settings?.machineLogTypes||["Servicing"])[0],severity:"Medium",issue:"",action:"",technician:"",partsReplaced:"",partsCost:"",laborCost:"",cost:"",downtimeHrs:"",nextDue:"",loggedBy:displayName,status:(settings?.machineStatuses||["Operational"])[0]}); setMachSh("add"); }
          else if(tab==="Vehicles")     { setVehF({vehicleId:"",vehicleName:"",date:today(),type:(settings?.vehicleLogTypes||["Trip"])[0],kms:"",odometerStart:"",odometerEnd:"",driver:"",destination:"",routeStops:"",fuelCost:"",fuelLiters:"",fuelType:(settings?.vehicleFuelTypes||["Petrol"])[0],tollCost:"",maintenanceCost:"",nextServiceDue:"",priority:"Normal",notes:"",status:(settings?.vehicleStatuses||["OK"])[0]}); setVehSh("add"); }
        }

        return <BottomNav
          tabs={bnTabs}
          activeTab={tab}
          onTab={tb=>{setTab(tb);setSrch("");setShowMoreNav(false);}}
          onFab={null}
          fabLabel={null}
          moreOpen={showMoreNav}
          onMore={()=>setShowMoreNav(o=>!o)}
          onMoreClose={()=>setShowMoreNav(false)}
          moreTabs={moreTabs}
          isMoreActive={isMoreActive}
          icons={TAB_ICONS}
          labels={TAB_LABELS}
          dm={dm}
          pendingCount={pendingD.length}
          onLogout={onLogout}
          onDm={()=>setDm(d=>!d)}
        />;
      })()}
      </div>{/* end desktop flex child */}
    </div>{/* end outer flex */}

      {/* ── FLOATING KANBAN + AUDIT FAB DOCK — mobile/tablet only (<1024px) ── */}
      {(!cSh && !dSh && !eSh && !sSh && !wSh && !paySh && !payLedgerSh && !bulkOrderSh && !qcSh && !changePwSh && !kanbanOpen && !auditOpen && !showMoreNav) && <>
      <style>{`
        @keyframes fabDockEnter {
          from { opacity:0; transform:translateX(-50%) translateY(6px) scale(0.96); }
          to   { opacity:1; transform:translateX(-50%) translateY(0)   scale(1);   }
        }
        .fab-dock {
          display:flex;
          position:fixed;
          left:50%;
          transform:translateX(-50%);
          z-index:1150;
          align-items:center;
          gap:4px;
          border-radius:999px;
          padding:5px 7px;
          pointer-events:auto;
          -webkit-tap-highlight-color:transparent;
          animation:fabDockEnter 0.28s cubic-bezier(0.25,0.46,0.45,0.94) 0.05s both;
          bottom:calc(78px + env(safe-area-inset-bottom, 0px));
        }
        @media (min-width:640px) and (max-width:1023px) {
          .fab-dock { bottom:24px; }
        }
        @media (min-width:1024px) {
          .fab-dock { display:none !important; }
        }
        .fab-btn {
          display:flex; align-items:center; gap:6px;
          border-radius:999px; padding:7px 13px;
          font-size:12px; font-weight:700; cursor:pointer;
          white-space:nowrap; min-height:36px;
          touch-action:manipulation;
          transition:background 0.15s, transform 0.12s, box-shadow 0.12s;
          -webkit-tap-highlight-color:transparent;
        }
        .fab-btn:hover  { transform:scale(1.04); }
        .fab-btn:active { transform:scale(0.96); }
        .fab-kbd { font-size:9px; font-weight:800; border-radius:4px; padding:1px 5px; letter-spacing:0.05em; }
      `}</style>

      <div
        className="fab-dock lg:hidden"
        style={{
          background: dm ? "rgba(30,41,59,0.85)" : "rgba(255,255,255,0.88)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: `1.5px solid ${dm ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.6)"}`,
          boxShadow: dm
            ? "0 8px 32px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)"
            : "0 8px 32px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
          opacity: (fabDockVisible && !cSh && !dSh && !eSh && !sSh && !wSh && !paySh && !payLedgerSh && !bulkOrderSh && !qcSh && !changePwSh) ? 1 : 0,
          pointerEvents: (fabDockVisible && !cSh && !dSh && !eSh && !sSh && !wSh && !paySh && !payLedgerSh && !bulkOrderSh && !qcSh && !changePwSh) ? "auto" : "none",
          transform: `translateX(-50%) translateY(${(fabDockVisible && !cSh && !dSh && !eSh && !sSh && !wSh && !paySh && !payLedgerSh && !bulkOrderSh && !qcSh && !changePwSh) ? "0" : "10px"})`,
          transition: "opacity 0.22s, transform 0.22s",
        }}
      >
        {/* Kanban */}
        <button
          onClick={()=>{ setKanbanOpen(true); setFabDockVisible(true); clearTimeout(fabDockTimerRef.current); }}
          title="Kanban Board (Shift+B)"
          className="fab-btn"
          style={{
            background: kanbanOpen ? "#6366f120" : (dm ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
            border: `1px solid ${kanbanOpen ? "#6366f160" : (dm ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)")}`,
            color: kanbanOpen ? "#6366f1" : t.sub,
            boxShadow: kanbanOpen ? "0 0 0 2px #6366f140" : "none",
          }}
          onMouseEnter={e=>{ e.currentTarget.style.background = kanbanOpen ? "#6366f128" : (dm?"rgba(255,255,255,0.12)":"rgba(0,0,0,0.07)"); }}
          onMouseLeave={e=>{ e.currentTarget.style.background = kanbanOpen ? "#6366f120" : (dm?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)"); }}
        >
          <span style={{fontSize:14}}>📌</span>
          <span>Kanban</span>
          <span className="fab-kbd hidden sm:inline" style={{background:"#6366f118",color:"#6366f1"}}>⇧B</span>
        </button>

        <div style={{width:1, background: dm ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)", height:20, flexShrink:0}}/>

        {/* Audit — admin only */}
        {isAdmin&&(
          <button
            onClick={()=>{ setAuditOpen(true); setFabDockVisible(true); clearTimeout(fabDockTimerRef.current); }}
            title="Audit Log (Shift+L)"
            className="fab-btn"
            style={{
              background: auditOpen ? "#10b98120" : (dm ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"),
              border: `1px solid ${auditOpen ? "#10b98160" : (dm ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)")}`,
              color: auditOpen ? "#10b981" : t.sub,
              boxShadow: auditOpen ? "0 0 0 2px #10b98140" : "none",
            }}
            onMouseEnter={e=>{ e.currentTarget.style.background = auditOpen ? "#10b98128" : (dm?"rgba(255,255,255,0.12)":"rgba(0,0,0,0.07)"); }}
            onMouseLeave={e=>{ e.currentTarget.style.background = auditOpen ? "#10b98120" : (dm?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)"); }}
          >
            <span style={{fontSize:14}}>🔍</span>
            <span>Audit</span>
            <span className="fab-kbd hidden sm:inline" style={{background:"#10b98118",color:"#10b981"}}>⇧L</span>
          </button>
        )}
      </div>
      </>}

      {/* ── KANBAN BOARD ── */}
      <KanbanBoard
        open={kanbanOpen}
        onClose={()=>setKanbanOpen(false)}
        deliveries={deliveries}
        setDeliv={setDeliv}
        customers={customers}
        products={products}
        settings={settings}
        addLog={addLog}
        notify={notify}
        inr={inr}
        lineTotal={lineTotal}
        canSeePrices={canSeePrices}
        isAdmin={isAdmin}
        can={can}
        dm={dm}
        t={t}
        setDsh={setDsh}
        setDf={setDf}
        ts={ts}
      />

      {/* ── AUDIT LOG PANEL ── */}
      <AuditLogPanel
        open={auditOpen}
        onClose={()=>setAuditOpen(false)}
        actLog={actLog}
        dm={dm}
        t={t}
        isAdmin={isAdmin}
        currentUser={displayName}
      />

      {/* ═══════ SHEETS ═══════ */}

      {/* Customer Sheet */}
      <Sheet dm={dm} open={!!cSh} onClose={()=>setCsh(null)} title={cSh==="add"?"👤 New Customer":"✏️ Edit Customer"}>
        {/* #18 Editing indicator — shown if another user has this record open */}
        <EditingIndicator peers={peers} recordType="customer" recordId={cF?.id} dm={dm} t={t} />
        {/* ── IDENTITY SECTION ── */}
        <div style={{background:dm?"rgba(245,158,11,0.06)":"rgba(245,158,11,0.04)",border:`1px solid ${dm?"rgba(245,158,11,0.2)":"rgba(245,158,11,0.15)"}`,borderRadius:16,padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:2}}>
            <div style={{width:36,height:36,borderRadius:10,background:"#f59e0b22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>👤</div>
            <div>
              <p style={{color:t.text,fontWeight:700,fontSize:13,lineHeight:1.2}}>Customer Identity</p>
              <p style={{color:t.sub,fontSize:11}}>Name, contact, and basic info</p>
            </div>
          </div>
          <Inp dm={dm} label="Customer / Business Name *" value={cF.name} onChange={e=>setCf({...cF,name:e.target.value})} placeholder="e.g. Hotel Saffron, Ravi Kumar"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:10}}>
            <Inp dm={dm} label="Phone" value={cF.phone} onChange={e=>setCf({...cF,phone:e.target.value})} placeholder="Mobile number" inputMode="tel" autoComplete="tel"/>
            <Inp dm={dm} label="Customer Since" type="date" value={cF.joinDate} onChange={e=>setCf({...cF,joinDate:e.target.value})}/>
          </div>
          {/* Status toggle inline */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:t.card,borderRadius:12,padding:"10px 14px",border:`1px solid ${t.border}`}}>
            <div>
              <p style={{color:t.text,fontSize:13,fontWeight:600}}>Account Status</p>
              <p style={{color:t.sub,fontSize:11,marginTop:1}}>{cF.active?"This customer is active and will appear in orders":"Inactive — won't appear in new order dropdowns"}</p>
            </div>
            <div style={{display:"flex",gap:4,background:t.inp,borderRadius:10,padding:3,border:`1px solid ${t.border}`}}>
              {[["active","● Active","#10b981"],["inactive","○ Inactive","#6b7280"]].map(([val,lbl,col])=>(
                <button key={val} onClick={()=>setCf({...cF,active:val==="active"})}
                  style={{background:(cF.active?"active":"inactive")===val?col+"22":"transparent",color:(cF.active?"active":"inactive")===val?col:t.sub,border:(cF.active?"active":"inactive")===val?`1.5px solid ${col}40`:"1.5px solid transparent",borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer",transition:"all 0.15s"}}>{lbl}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ── DELIVERY LOCATION ── */}
        <div style={{background:dm?"rgba(14,165,233,0.06)":"rgba(14,165,233,0.04)",border:`1px solid ${dm?"rgba(14,165,233,0.2)":"rgba(14,165,233,0.15)"}`,borderRadius:16,padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:2}}>
            <div style={{width:36,height:36,borderRadius:10,background:"#0ea5e922",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>📍</div>
            <div>
              <p style={{color:t.text,fontWeight:700,fontSize:13,lineHeight:1.2}}>Delivery Location</p>
              <p style={{color:t.sub,fontSize:11}}>Address and GPS coordinates</p>
            </div>
          </div>
          <Inp dm={dm} label="Full Delivery Address" value={cF.address} onChange={e=>setCf({...cF,address:e.target.value})} placeholder="e.g. Shop 4, MG Road, Panaji, Goa"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:10}}>
            <Inp dm={dm} label="GPS Latitude" value={cF.lat} onChange={e=>setCf({...cF,lat:e.target.value})} placeholder="15.4989" inputMode="decimal"/>
            <Inp dm={dm} label="GPS Longitude" value={cF.lng} onChange={e=>setCf({...cF,lng:e.target.value})} placeholder="73.8278" inputMode="decimal"/>
          </div>
          <p style={{color:t.sub,fontSize:11}}>💡 Long-press a location in Google Maps → Share → Copy coordinates to get lat/lng.</p>
          {cF.lat&&cF.lng&&<a href={mapU(cF.address,cF.lat,cF.lng)} target="_blank" rel="noopener noreferrer" style={{background:"#0ea5e915",color:"#0ea5e9",border:"1px solid #0ea5e930",borderRadius:10,padding:"8px 14px",fontSize:12,fontWeight:700,textDecoration:"none",display:"flex",alignItems:"center",gap:6,justifyContent:"center"}}>📍 Preview on Google Maps ↗</a>}
        </div>

        {/* ── REGULAR ORDER TEMPLATE ── */}
        <div style={{background:dm?"rgba(139,92,246,0.06)":"rgba(139,92,246,0.04)",border:`1px solid ${dm?"rgba(139,92,246,0.2)":"rgba(139,92,246,0.15)"}`,borderRadius:16,padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:2}}>
            <div style={{width:36,height:36,borderRadius:10,background:"#8b5cf622",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>📦</div>
            <div>
              <p style={{color:t.text,fontWeight:700,fontSize:13,lineHeight:1.2}}>Regular Order Template</p>
              <p style={{color:t.sub,fontSize:11}}>Default items and quantities for this customer</p>
            </div>
          </div>
          <OrderEditor dm={dm} products={products} orderLines={cF.orderLines||{}} showPrice={canSeePrices} onChange={ol=>setCf(f=>({...f,orderLines:ol}))}/>
        </div>

        {/* ── FINANCIALS ── */}
        {canSeeFinancials&&<div style={{background:dm?"rgba(16,185,129,0.06)":"rgba(16,185,129,0.04)",border:`1px solid ${dm?"rgba(16,185,129,0.2)":"rgba(16,185,129,0.15)"}`,borderRadius:16,padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:2}}>
            <div style={{width:36,height:36,borderRadius:10,background:"#10b98122",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>💰</div>
            <div>
              <p style={{color:t.text,fontWeight:700,fontSize:13,lineHeight:1.2}}>Financial Balances</p>
              <p style={{color:t.sub,fontSize:11}}>Manually set opening balances if needed</p>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:10}}>
            <Inp dm={dm} label="Amount Paid (₹)" type="number" inputMode="numeric" value={cF.paid} onChange={e=>setCf({...cF,paid:e.target.value})}/>
            <Inp dm={dm} label="Amount Pending (₹)" type="number" inputMode="numeric" value={cF.pending} onChange={e=>setCf({...cF,pending:e.target.value})}/>
          </div>
          <Inp dm={dm} label="Partial Payment On Hold (₹)" type="number" inputMode="numeric" value={cF.partialPay||""} onChange={e=>setCf({...cF,partialPay:e.target.value})} placeholder="Amount received but not yet fully applied"/>
          {settings?.featureCreditLimit&&<Inp dm={dm} label="Credit Limit (₹)" type="number" inputMode="numeric" value={cF.creditLimit||""} onChange={e=>setCf({...cF,creditLimit:e.target.value})} placeholder="0 = no limit"/>}
          {(+cF.paid>0||+cF.pending>0)&&<div style={{background:t.card,borderRadius:12,padding:"10px 14px",border:`1px solid ${t.border}`}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
              <span style={{color:"#10b981",fontWeight:600}}>Paid: {inr(+cF.paid||0)}</span>
              <span style={{color:+cF.pending>0?"#ef4444":"#10b981",fontWeight:600}}>{+cF.pending>0?`Pending: ${inr(+cF.pending)}`:"✓ Fully paid"}</span>
            </div>
            {(+cF.paid>0||+cF.pending>0)&&<div style={{height:5,borderRadius:5,overflow:"hidden",background:t.border}}>
              <div style={{width:`${(+cF.paid||0)+( +cF.pending||0)>0?Math.round((+cF.paid||0)/((+cF.paid||0)+(+cF.pending||0))*100):100}%`,height:"100%",background:+cF.pending>0?"#f59e0b":"#10b981",borderRadius:5}}/>
            </div>}
          </div>}
        </div>}

        {/* ── NOTES ── */}
        <div>
          <label style={{color:t.sub,display:"block",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>📝 Notes & Special Instructions</label>
          <textarea value={cF.notes} onChange={e=>setCf({...cF,notes:e.target.value})} placeholder="e.g. Prefers crispy, deliver before 9am, call before arriving…" rows={3}
            style={{width:"100%",background:t.inp,border:`1.5px solid ${t.inpB}`,color:t.text,borderRadius:14,padding:"10px 14px",fontSize:13,outline:"none",resize:"vertical",fontFamily:"system-ui"}}/>
        </div>

        <Btn dm={dm} onClick={saveC} className="w-full" style={{minHeight:52,fontSize:15,fontWeight:800}}>
          {cSh==="add"?"✓ Add Customer":"✓ Save Changes"}
        </Btn>
      </Sheet>

      {/* Customer View */}
      <Sheet dm={dm} open={!!cView} onClose={()=>setCView(null)} title="Customer Profile">
        {cView&&(()=>{
          const cv=cView;
          const rows=lineRows(cv.orderLines,products);
          const tot=lineTotal(cv.orderLines);
          const cDelivs=[...deliveries.filter(d=>d.customerId===cv.id)].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
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
            <div className="crm-grid-3" style={{gap:8,marginBottom:10}}>
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
                <Btn dm={dm} v="purple" className="w-full" onClick={()=>gExport("pdf",()=>exportPDF(cv,products,"customer",settings,deliveries),"Customer PDF")}>📄 PDF</Btn>
              </div>
              <div style={{flex:"1 1 auto",minWidth:80}}>
                <Btn dm={dm} v="sky" className="w-full" onClick={()=>{
                  const cD=deliveries.filter(d=>d.customerId===cv.id).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
                  const enriched=cD.map(d=>{
                    const items=Object.entries(safeO(d.orderLines)).filter(([,l])=>l.qty>0).map(([pid,l])=>{const p=products.find(x=>x.id===pid);return `${l.qty}x ${p?p.name:(l.name||pid)}`;}).join("; ");
                    return {...d,_items:items,_total:lineTotal(d.orderLines),_replItem:d.replacement?.done?(d.replacement.item||""):"",_replQty:d.replacement?.done?(d.replacement.qty||""):"",_replAmt:d.replacement?.done?(+d.replacement.amount||0):0,_replReason:d.replacement?.done?(d.replacement.reason||""):"",_notes:d.notes||""};
                  });
                  gExport("excel",()=>exportTabExcel(cv.name.replace(/[^a-zA-Z0-9 ]/g," ").slice(0,28)+" Deliveries",enriched,[
                    {label:"Date",key:"date"},{label:"Status",key:"status"},{label:"Items Ordered",key:"_items"},{label:"Order Total (Rs)",key:"_total",num:true},
                    {label:"Replacement Item",key:"_replItem"},{label:"Repl. Qty",key:"_replQty"},{label:"Repl. Amount Deducted (Rs)",key:"_replAmt",num:true},{label:"Repl. Reason",key:"_replReason"},
                    {label:"Created By",key:"createdBy"},{label:"Notes",key:"_notes"}
                  ],settings),"Customer Deliveries Excel");
                }}>📊 XLS</Btn>
              </div>
            </div>
          </>);
        })()}
      </Sheet>

      {/* Delivery Sheet */}
      <Sheet dm={dm} open={!!dSh} onClose={()=>setDsh(null)} title={dSh==="add"?"New Delivery":"Edit Delivery"}>
        {/* #18 Editing indicator */}
        <EditingIndicator peers={peers} recordType="delivery" recordId={dF?.id} dm={dm} t={t} />
        <Sel dm={dm} label="Customer *" value={dF.customerId||""} onChange={e=>pickCust(e.target.value)}>
          <option value="">— Select customer —</option>
          {customers.filter(c=>c.active).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </Sel>
        {dF.address&&<div style={{background:"#0ea5e915",border:"1px solid #0ea5e940"}} className="rounded-xl px-3.5 py-2.5 text-xs text-sky-400 flex items-center justify-between"><span>📍 {dF.address}</span><a href={mapU(dF.address,dF.lat,dF.lng)} target="_blank" rel="noopener noreferrer" className="underline font-semibold ml-2 shrink-0">Maps</a></div>}
        {/* ── Credit limit live warning banner ── */}
        {settings?.featureCreditLimit&&dF.customerId&&(()=>{
          const custRec=customers.find(c=>c.id===dF.customerId);
          const limit=+(custRec?.creditLimit||0);
          if(limit<=0) return null;
          const orderAmt=lineTotal(dF.orderLines||{});
          const pending=+(custRec?.pending||0);
          const total=pending+orderAmt;
          const pct=Math.min(100,Math.round((total/limit)*100));
          const exceeded=total>limit;
          const warning=!exceeded&&pct>=80;
          if(!exceeded&&!warning) return null;
          const bg=exceeded?"#ef444418":"#f59e0b18";
          const border=exceeded?"#ef444440":"#f59e0b40";
          const color=exceeded?"#ef4444":"#f59e0b";
          return <div style={{background:bg,border:`1px solid ${border}`,borderRadius:12,padding:"10px 14px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
              <p style={{color,fontWeight:700,fontSize:12}}>{exceeded?"🚫 Credit Limit Exceeded":"⚠️ Approaching Credit Limit"}</p>
              <span style={{color,fontWeight:800,fontSize:12}}>{pct}%</span>
            </div>
            <div style={{background:exceeded?"#ef444430":"#f59e0b30",borderRadius:99,height:5,overflow:"hidden",marginBottom:6}}>
              <div style={{width:`${pct}%`,height:"100%",background:color,borderRadius:99,transition:"width 0.3s"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
              <span style={{color:dm?"#9ca3af":"#6b7280"}}>Pending {inr(pending)} + Order {inr(orderAmt)}</span>
              <span style={{color,fontWeight:700}}>Limit {inr(limit)}</span>
            </div>
          </div>;
        })()}
        <Hr dm={dm}/>
        <p style={{color:t.sub}} className="text-[11px] font-semibold uppercase tracking-wider">Items{canSeePrices?" — Tap price to select":""}</p>
        <OrderEditor dm={dm} products={products} orderLines={dF.orderLines||{}} showPrice={canSeePrices} onChange={ol=>setDf(f=>({...f,orderLines:ol}))}/>
        <Hr dm={dm}/>
        <div className="crm-grid-2" style={{gap:3*4}}>
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
        {(()=>{
          // Batch assignment — always shown so user can assign manually
          const delivDate=dF.date||today();
          const delivProductIds=Object.entries(safeO(dF.orderLines)).filter(([,l])=>(l.qty||0)>0).map(([pid])=>pid);
          const allBatchesOnDate=(allBatches||[]).filter(pt=>pt.date===delivDate);
          const matchingBatches=allBatchesOnDate.filter(pt=>pt.product&&delivProductIds.some(pid=>{const p=products.find(x=>x.id===pid);return prodNamesMatch(p?.name||"",pt.product);}));
          const batchList=matchingBatches.length>0?matchingBatches:allBatchesOnDate;
          return <div>
            <label style={{color:t.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4,display:"block"}}>🏭 Batch</label>
            {batchList.length===0
              ? <div style={{background:dm?"rgba(124,58,237,0.07)":"rgba(124,58,237,0.04)",border:"1.5px solid rgba(124,58,237,0.2)",borderRadius:12,padding:"10px 14px"}}>
                  <p style={{color:t.sub,fontSize:12}}>No batches logged for this date yet — save without assigning or log a production batch first.</p>
                </div>
              : <>
                  <select value={dF.batchId||""} onChange={e=>setDf(f=>({...f,batchId:e.target.value}))}
                    style={{width:"100%",background:t.inp,border:`1.5px solid ${dF.batchId?"#7c3aed60":t.inpB}`,color:dF.batchId?"#8b5cf6":t.text,borderRadius:12,padding:"10px 14px",fontSize:13,outline:"none",appearance:"none",WebkitAppearance:"none",cursor:"pointer"}}>
                    <option value="">— No Batch / Unassigned —</option>
                    {batchList.map(b=><option key={b.batchId||b.id} value={b.batchId||b.id}>{b.batchLabel||"Batch"} · {b.product} · {b.actual||0} units</option>)}
                  </select>
                  {dF.batchId
                    ? <p style={{color:"#8b5cf6",fontSize:10,marginTop:4,fontWeight:600}}>📦 Assigned to {batchList.find(b=>(b.batchId||b.id)===dF.batchId)?.batchLabel||"batch"} — <span style={{cursor:"pointer",textDecoration:"underline"}} onClick={()=>setDf(f=>({...f,batchId:""}))}>Clear</span></p>
                    : <p style={{color:t.sub,fontSize:10,marginTop:4}}>Select a batch or leave unassigned</p>
                  }
                </>
            }
          </div>;
        })()}
        <Inp dm={dm} label="Notes" value={dF.notes} onChange={e=>setDf({...dF,notes:e.target.value})} placeholder="e.g. Leave at gate, call before"/>
        <Hr dm={dm}/>
        {/* ── REPLACEMENT SECTION — Redesigned ── */}
        <div style={{background:dF.replacement?.done?(dm?"rgba(249,115,22,0.08)":"rgba(249,115,22,0.05)"):(dm?"rgba(255,255,255,0.03)":"#fafaf8"),border:`1.5px solid ${dF.replacement?.done?"#f9731650":t.border}`,borderRadius:16,padding:"14px 16px",transition:"all 0.2s"}}>
          {/* Header row */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:dF.replacement?.done?14:0}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:34,height:34,borderRadius:10,background:dF.replacement?.done?"#f9731625":"#f9731612",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,transition:"background 0.2s"}}>🔄</div>
              <div>
                <p style={{color:dF.replacement?.done?"#f97316":t.text,fontWeight:700,fontSize:13,lineHeight:1.2}}>Replacement / Return</p>
                <p style={{color:t.sub,fontSize:11}}>Record items returned or swapped</p>
              </div>
            </div>
            {/* Big toggle button */}
            <button onClick={()=>setDf(f=>({...f,replacement:{...(f.replacement||{}),done:!(f.replacement?.done)}}))}
              style={{background:dF.replacement?.done?"#f97316":"transparent",color:dF.replacement?.done?"#fff":"#f97316",border:`2px solid #f97316`,borderRadius:12,padding:"7px 16px",fontSize:12,fontWeight:800,cursor:"pointer",transition:"all 0.2s",flexShrink:0,WebkitTapHighlightColor:"transparent",touchAction:"manipulation",minHeight:40}}>
              {dF.replacement?.done?"✓ Replacement Logged":"+ Log Replacement"}
            </button>
          </div>
          {dF.replacement?.done&&(
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {/* Replacement type pills */}
              <div>
                <p style={{color:t.sub,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Type</p>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {[["swap","🔄 Swap / Exchange"],["return","↩ Return / Refund"],["damaged","⚠️ Damaged"],["wrong","❌ Wrong Item"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setDf(f=>({...f,replacement:{...(f.replacement||{}),type:v}}))}
                      style={{background:dF.replacement?.type===v?"#f9731622":"transparent",color:dF.replacement?.type===v?"#f97316":t.sub,border:`1.5px solid ${dF.replacement?.type===v?"#f97316":t.border}`,borderRadius:99,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer",transition:"all 0.15s",WebkitTapHighlightColor:"transparent"}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {/* Item name */}
              <Inp dm={dm} label="Item Being Replaced / Returned *" value={dF.replacement?.item||""} onChange={e=>setDf(f=>({...f,replacement:{...(f.replacement||{}),item:e.target.value}}))} placeholder="e.g. Roti Pack, Paratha x10…"/>
              {/* Qty + Amount row */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:10}}>
                <Inp dm={dm} label="Quantity" value={dF.replacement?.qty||""} onChange={e=>setDf(f=>({...f,replacement:{...(f.replacement||{}),qty:e.target.value}}))} placeholder="e.g. 10 pcs"/>
                <Inp dm={dm} label="Amount to Deduct (₹)" type="number" value={dF.replacement?.amount||""} onChange={e=>setDf(f=>({...f,replacement:{...(f.replacement||{}),amount:e.target.value}}))} placeholder="0"/>
              </div>
              {/* Deduction preview */}
              {(+dF.replacement?.amount)>0&&<div style={{background:"#f9731618",border:"1px solid #f9731640",borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <p style={{color:"#f97316",fontWeight:700,fontSize:12}}>💡 Deduction preview</p>
                  <p style={{color:t.sub,fontSize:11,marginTop:2}}>{inr(+dF.replacement.amount)} will be deducted from this order's payable amount</p>
                </div>
                <span style={{color:"#f97316",fontWeight:900,fontSize:18}}>−{inr(+dF.replacement.amount)}</span>
              </div>}
              {/* Reason */}
              <Inp dm={dm} label="Reason / Notes" value={dF.replacement?.reason||""} onChange={e=>setDf(f=>({...f,replacement:{...(f.replacement||{}),reason:e.target.value}}))} placeholder="e.g. Customer complained quality, item expired, wrong order…"/>
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
              const taxRt=settings?.featureTaxCalc?(+(settings?.taxRate||0)):0;
              const tot=lineTotalWithTax(dF.orderLines,taxRt);
              const remaining=tot-(+dF.partialPayment.amount);
              return <div style={{background:"#10b98115",border:"1px solid #10b98130",borderRadius:10,padding:"8px 12px",marginTop:4}}>
                <div className="flex justify-between text-xs"><span style={{color:t.sub}}>Order Total{taxRt>0?` (incl. ${taxRt}% tax)`:""}</span><span style={{color:t.text,fontWeight:700}}>{inr(tot)}</span></div>
                <div className="flex justify-between text-xs mt-1"><span style={{color:"#10b981"}}>Collected Now</span><span style={{color:"#10b981",fontWeight:700}}>−{inr(+dF.partialPayment.amount)}</span></div>
                <div className="flex justify-between text-xs mt-1 pt-1" style={{borderTop:`1px solid #10b98130`}}><span style={{color:t.sub,fontWeight:700}}>Still Due</span><span style={{color:remaining>0?"#f59e0b":"#10b981",fontWeight:800}}>{inr(Math.max(0,remaining))}</span></div>
              </div>;
            })()}
          </>}
        </div>}
        <div className="flex gap-2">
          {dSh!=="add"&&can("deliv_report")&&<Btn dm={dm} v="outline" onClick={()=>gExport("pdf",()=>exportPDF(dSh,products,"delivery",settings),"Delivery Invoice PDF")} className="flex-1">🧾 Invoice</Btn>}
          <Btn dm={dm} onClick={saveD} className="flex-1">Save Delivery</Btn>
        </div>
      </Sheet>

      {/* Supply Sheet */}
      <Sheet dm={dm} open={!!sSh} onClose={()=>setSsh(null)} title={sSh==="add"?"Log Supply":"Edit Supply"}>
        <Inp dm={dm} label="Item *" value={sF.item} onChange={e=>setSf({...sF,item:e.target.value})} placeholder="e.g. Wheat Flour"/>
        <div className="crm-grid-2" style={{gap:3*4}}>
          <Inp dm={dm} label="Quantity" type="number" value={sF.qty} onChange={e=>setSf({...sF,qty:e.target.value})}/>
          <Sel dm={dm} label="Unit" value={sF.unit} onChange={e=>setSf({...sF,unit:e.target.value})}>
            {supUnits.map(u=><option key={u}>{u}</option>)}
          </Sel>
        </div>
        <Inp dm={dm} label="Supplier" value={sF.supplier} onChange={e=>setSf({...sF,supplier:e.target.value})}/>
        <div className="crm-grid-2" style={{gap:3*4}}>
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
      <Sheet dm={dm} open={!!eSh} onClose={()=>setEsh(null)} title={eSh==="add"?"💸 Log Expense":"✏️ Edit Expense"}>
        {/* Category + Amount — most important, top row */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:10}}>
          <Sel dm={dm} label="Category *" value={eF.category} onChange={e=>setEf({...eF,category:e.target.value})}>
            {expCats.map(c=><option key={c}>{c}</option>)}
          </Sel>
          <Inp dm={dm} label="Amount (₹) *" type="number" value={eF.amount} onChange={e=>setEf({...eF,amount:e.target.value})} placeholder="0"/>
        </div>
        {/* Date + Payment Method */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:10}}>
          <Inp dm={dm} label="Date *" type="date" value={eF.date} onChange={e=>setEf({...eF,date:e.target.value})}/>
          <Sel dm={dm} label="Payment Method" value={eF.paymentMethod||"Cash"} onChange={e=>setEf({...eF,paymentMethod:e.target.value})}>
            {["Cash","UPI","Card","Bank Transfer","Credit","Cheque","Other"].map(m=><option key={m}>{m}</option>)}
          </Sel>
        </div>
        {/* Vendor */}
        <Inp dm={dm} label="Vendor / Supplier" value={eF.vendor||""} onChange={e=>setEf({...eF,vendor:e.target.value})} placeholder="e.g. Ramesh Traders, Shell Gas Station…"/>
        {/* Notes */}
        <Inp dm={dm} label="Notes" value={eF.notes||""} onChange={e=>setEf({...eF,notes:e.target.value})} placeholder="Brief description of this expense…"/>
        {/* Receipt / Reference */}
        <div>
          <label style={{color:t.sub,display:"block",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>Receipt / Bill Reference</label>
          <input value={eF.receipt||""} onChange={e=>setEf({...eF,receipt:e.target.value})}
            placeholder="Bill no., invoice ref, or short description…"
            style={{background:t.inp,border:`1px solid ${t.inpB}`,color:t.text,width:"100%",borderRadius:12,padding:"10px 14px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
        </div>
        {/* Approved By + Tags in one row */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:10}}>
          <Inp dm={dm} label="Approved By" value={eF.approvedBy||""} onChange={e=>setEf({...eF,approvedBy:e.target.value})} placeholder="Name or role…"/>
          <Inp dm={dm} label="Tags" value={eF.tags||""} onChange={e=>setEf({...eF,tags:e.target.value})} placeholder="e.g. urgent, recurring…"/>
        </div>
        {/* Amount preview chip */}
        {eF.amount&&+eF.amount>0&&(
          <div style={{background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{color:t.sub,fontSize:12}}>You're logging</span>
            <span style={{color:"#ef4444",fontWeight:900,fontSize:18}}>{inr(+eF.amount)}</span>
          </div>
        )}
        <Btn dm={dm} onClick={saveE} className="w-full" style={{background:"#ef4444",color:"#fff"}}>
          {eSh==="add"?"✓ Save Expense":"✓ Update Expense"}
        </Btn>
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

      {/* Production Item Sheet */}
      <Sheet dm={dm} open={!!piSh} onClose={()=>{setPiSh(null);setPiF({id:"",name:""});}} title={piSh==="add"?"Add Production Item":"Edit Production Item"}>
        <p style={{color:T(dm).sub,fontSize:12,marginBottom:4}}>Production items are only used in the Production tab (Log Batch). They are completely separate from your delivery products.</p>
        <Inp dm={dm} label="Item Name *" value={piF.name} onChange={e=>setPiF(f=>({...f,name:e.target.value}))} placeholder="e.g. Paratha, Roti, Special Paratha"/>
        <Btn dm={dm} onClick={saveProdItem} className="w-full" style={{background:"#8b5cf6",color:"#fff",border:"none"}}>Save Item</Btn>
      </Sheet>
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
          setUsers(p=>safeArr(p).map(u=>u.id===sess.id?{...u,password:hashPw(changePwF.next)}:u));
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
          return <div style={{display:"flex",flexDirection:"column",gap:14}}>
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
                    style={{fontSize:10,fontWeight:700,color:allOn?color:t.sub,background:allOn?color+"18":"transparent",border:`1px solid ${allOn?color+"44":t.border}`,borderRadius:6,padding:"5px 10px",cursor:"pointer"}}>
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
        <div className="crm-grid-2" style={{gap:3*4}}>
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
        <div className="crm-grid-2" style={{gap:3*4}}>
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
          <div className="crm-btn-group">{[paySh.pending,500,1000,2000].filter((v,i,a)=>v>0&&a.indexOf(v)===i).map(q=><button key={q} onClick={()=>setPayAmt(String(q))} style={payAmt===String(q)?{background:"#f59e0b",color:"#000"}:{background:t.inp,color:t.text}} className="text-xs font-semibold px-3 py-2 rounded-lg min-h-[36px]">₹{q.toLocaleString("en-IN")}</button>)}</div>
          <Inp dm={dm} label="Amount (₹)" type="number" value={payAmt} onChange={e=>setPayAmt(e.target.value)} placeholder="Enter amount"/>
          <div className="flex gap-2"><Btn dm={dm} v="ghost" className="flex-1" onClick={()=>{setPaySh(null);setPayAmt("");}}>Cancel</Btn><Btn dm={dm} v="success" className="flex-1" onClick={recPay} disabled={!payAmt}>Confirm ₹{payAmt||0}</Btn></div>
        </>}
      </Sheet>

      {/* ── PAYMENT LEDGER MANUAL ENTRY SHEET ── */}
      <Sheet dm={dm} open={payLedgerSh} onClose={()=>{setPayLedgerSh(false);setPayLedgerCust(null);setPayLedgerAmt("");setPayLedgerNote("");setPayLedgerMethod("Cash");}} title="💰 Record Payment">
        {/* Customer picker */}
        <Sel dm={dm} label="Customer *" value={payLedgerCust?.id||""} onChange={e=>{const c=customers.find(x=>x.id===e.target.value);setPayLedgerCust(c||null);if(c)setPayLedgerAmt(String(c.pending||""));}}>
          <option value="">— Select customer —</option>
          {customers.filter(c=>c.active).sort((a,b)=>(b.pending||0)-(a.pending||0)).map(c=><option key={c.id} value={c.id}>{c.name}{c.pending>0?` · ₹${c.pending} due`:""}</option>)}
        </Sel>
        {/* Customer status card */}
        {payLedgerCust&&<div style={{background:dm?"rgba(16,185,129,0.08)":"#f0fdf9",border:"1px solid #10b98130",borderRadius:14,padding:"12px 16px"}}>
          <p style={{color:t.text,fontWeight:800,fontSize:14,marginBottom:8}}>{payLedgerCust.name}</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
            <div style={{background:dm?"rgba(16,185,129,0.1)":"#fff",borderRadius:10,padding:"8px 12px",textAlign:"center"}}>
              <p style={{color:"#10b981",fontWeight:800,fontSize:15}}>{inr(payLedgerCust.paid||0)}</p>
              <p style={{color:t.sub,fontSize:9,marginTop:2,textTransform:"uppercase",letterSpacing:"0.06em"}}>Total Paid</p>
            </div>
            <div style={{background:dm?"rgba(239,68,68,0.1)":"#fff",borderRadius:10,padding:"8px 12px",textAlign:"center"}}>
              <p style={{color:(payLedgerCust.pending||0)>0?"#ef4444":"#10b981",fontWeight:800,fontSize:15}}>{inr(payLedgerCust.pending||0)}</p>
              <p style={{color:t.sub,fontSize:9,marginTop:2,textTransform:"uppercase",letterSpacing:"0.06em"}}>Outstanding</p>
            </div>
          </div>
        </div>}
        {/* Quick amount buttons */}
        {payLedgerCust&&(payLedgerCust.pending||0)>0&&(()=>{
          const quickAmts=[payLedgerCust.pending,500,1000,2000].filter((v,i,a)=>v>0&&a.indexOf(v)===i).slice(0,4);
          return <div>
            <p style={{color:t.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Quick Select</p>
            <div style={{display:"grid",gridTemplateColumns:`repeat(${quickAmts.length},1fr)`,gap:6}}>
              {quickAmts.map(q=>{
                const isSelected=payLedgerAmt===String(q);
                const isFull=q===payLedgerCust.pending;
                return <button key={q} onClick={()=>setPayLedgerAmt(String(q))}
                  style={{background:isSelected?"#10b981":t.inp,color:isSelected?"#fff":t.text,
                    border:`1.5px solid ${isSelected?"#10b981":isFull?"#10b98150":t.border}`,
                    borderRadius:10,padding:"8px 4px",fontSize:11,fontWeight:700,cursor:"pointer",
                    WebkitTapHighlightColor:"transparent",textAlign:"center",lineHeight:1.3}}>
                  {inr(q)}{isFull&&<><br/><span style={{fontSize:9,opacity:0.8}}>Full</span></>}
                </button>;
              })}
            </div>
          </div>;
        })()}
        {/* Amount input */}
        <Inp dm={dm} label="Amount Received (₹) *" type="number" value={payLedgerAmt} onChange={e=>setPayLedgerAmt(e.target.value)} placeholder="0"/>
        {/* Payment method — icon grid */}
        <div>
          <p style={{color:t.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>Payment Method</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6}}>
            {[["Cash","💵"],["UPI","📲"],["Bank Transfer","🏦"],["Cheque","📋"],["Other","💼"]].map(([m,icon])=>(
              <button key={m} onClick={()=>setPayLedgerMethod(m)}
                style={{background:payLedgerMethod===m?"#3b82f6":t.inp,
                  color:payLedgerMethod===m?"#fff":t.sub,
                  border:`1.5px solid ${payLedgerMethod===m?"#3b82f6":t.border}`,
                  borderRadius:10,padding:"8px 4px",fontSize:10,fontWeight:700,cursor:"pointer",
                  WebkitTapHighlightColor:"transparent",textAlign:"center",lineHeight:1.4}}>
                <div style={{fontSize:18,lineHeight:1,marginBottom:2}}>{icon}</div>
                {m.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>
        <Inp dm={dm} label="Note / Reference (optional)" value={payLedgerNote} onChange={e=>setPayLedgerNote(e.target.value)} placeholder="UPI ref, transaction ID, receipt no…"/>
        {/* Confirm strip */}
        {payLedgerAmt&&+payLedgerAmt>0&&<div style={{background:dm?"rgba(16,185,129,0.1)":"#f0fdf9",border:"1px solid #10b98130",borderRadius:12,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <p style={{color:t.sub,fontSize:10}}>Recording payment via {payLedgerMethod}</p>
            {payLedgerCust&&(payLedgerCust.pending||0)>0&&<p style={{color:t.sub,fontSize:10}}>
              Balance after: {inr(Math.max(0,(payLedgerCust.pending||0)-(+payLedgerAmt||0)))}
            </p>}
          </div>
          <p style={{color:"#10b981",fontWeight:900,fontSize:18}}>{inr(+payLedgerAmt)}</p>
        </div>}
        <div className="flex gap-2">
          <Btn dm={dm} v="ghost" className="flex-1" onClick={()=>{setPayLedgerSh(false);setPayLedgerCust(null);setPayLedgerAmt("");setPayLedgerNote("");setPayLedgerMethod("Cash");}}>Cancel</Btn>
          <Btn dm={dm} v="success" className="flex-1" onClick={()=>{
            if(!payLedgerCust){notify("Select a customer");return;}
            const amt=+payLedgerAmt;
            if(!amt||amt<=0){notify("Enter a valid amount");return;}
            recordPaymentLedger(payLedgerCust.id,payLedgerCust.name,amt,payLedgerNote,payLedgerMethod);
            setPayLedgerSh(false);setPayLedgerCust(null);setPayLedgerAmt("");setPayLedgerNote("");setPayLedgerMethod("Cash");
          }}>✓ Confirm {payLedgerAmt&&+payLedgerAmt>0?inr(+payLedgerAmt):""}</Btn>
        </div>
      </Sheet>


      {/* Production Sheet — Redesigned Log New Batch */}
      <Sheet dm={dm} open={!!ptSh} onClose={()=>setPtSh(null)} title={ptSh==="add"?"🏭 Log New Batch":"✏️ Edit Batch"}>
        {(()=>{
          const tS=T(dm);
          // ── SECTION 1: Batch Identity ──────────────────────────────
          return <>
          {/* Batch Identity Banner */}
          <div style={{background:`linear-gradient(135deg,${dm?"#2d1f5e":"#ede9fe"},${dm?"#1e3a5f":"#dbeafe"})`,borderRadius:16,padding:"14px 16px",marginBottom:4}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:0}}>
                <p style={{color:dm?"#c4b5fd":"#7c3aed",fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>🏭 Batch Identity</p>
                <p style={{color:dm?"#e2d9f3":"#1e1b4b",fontWeight:900,fontSize:22,lineHeight:1,marginBottom:2}}>{ptF.batchLabel||"New Batch"}</p>
                <p style={{color:dm?"#a5b4fc":"#6366f1",fontSize:11,fontWeight:600}}>{ptF.product||"No product selected"}{ptF.shift?` · ${ptF.shift} Shift`:""}</p>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{background:dm?"rgba(139,92,246,0.3)":"rgba(139,92,246,0.15)",border:`2px solid ${dm?"#7c3aed":"#8b5cf6"}`,borderRadius:12,padding:"8px 14px",marginBottom:4}}>
                  <p style={{color:dm?"#c4b5fd":"#7c3aed",fontSize:10,fontWeight:700,textTransform:"uppercase"}}>Units</p>
                  <p style={{color:dm?"#fff":"#1e1b4b",fontWeight:900,fontSize:26,lineHeight:1}}>{ptF.actual||"—"}</p>
                </div>
                <div style={{display:"flex",gap:4,justifyContent:"flex-end"}}>
                  {["A","B","C","F"].map(g=><span key={g} style={{background:ptF.qcGrade===g?({A:"#10b981",B:"#f59e0b",C:"#f97316",F:"#ef4444"}[g]||"#8b5cf6")+"22":"transparent",color:{A:"#10b981",B:"#f59e0b",C:"#f97316",F:"#ef4444"}[g]||"#8b5cf6",border:`1.5px solid ${ptF.qcGrade===g?({A:"#10b981",B:"#f59e0b",C:"#f97316",F:"#ef4444"}[g]||"#8b5cf6"):"transparent"}`,borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:800}}>{g}</span>)}
                </div>
              </div>
            </div>
          </div>

          {/* ── SECTION 1: Core Details ── */}
          <div style={{borderRadius:14,border:`1.5px solid ${tS.border}`,overflow:"visible",marginBottom:4}}>
            <div style={{background:dm?"rgba(139,92,246,0.1)":"rgba(139,92,246,0.05)",padding:"10px 14px",borderBottom:`1px solid ${tS.border}`}}>
              <p style={{color:"#8b5cf6",fontWeight:800,fontSize:12}}>① Batch Details</p>
              <p style={{color:tS.sub,fontSize:10}}>What was produced, when, and by which shift</p>
            </div>
            <div style={{padding:"14px 14px",display:"flex",flexDirection:"column",gap:12}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:10}}>
                <Inp dm={dm} label="Batch Label *" value={ptF.batchLabel||""} onChange={e=>{const v=e.target.value;setPtF(f=>({...f,batchLabel:v}));}} placeholder="e.g. Batch 1, Morning Run A"/>
                <Inp dm={dm} label="Date *" type="date" value={ptF.date||today()} onChange={e=>{const v=e.target.value;setPtF(f=>({...f,date:v}));}}/>
              </div>
              <Sel dm={dm} label="Product *" value={ptF.product} onChange={e=>{const v=e.target.value;setPtF(f=>({...f,product:v}));}}>
                <option value="">— Select product —</option>
                {(prodItems||[]).map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
                <option value="__custom__">Other / Custom</option>
              </Sel>
              {ptF.product==="__custom__"&&<Inp dm={dm} label="Custom Product Name *" value={ptF.customProduct||""} onChange={e=>{const v=e.target.value;setPtF(f=>({...f,customProduct:v}));}} placeholder="e.g. Special Paratha"/>}
              {/* Shift pills */}
              <div>
                <p style={{color:tS.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Shift</p>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {[{v:"",l:"No Shift"},...(settings?.shifts||["Morning","Afternoon","Evening","Night"]).map(s=>({v:s,l:s}))].map(({v,l})=>(
                    <button key={v} onClick={()=>setPtF(f=>({...f,shift:v}))}
                      style={{background:ptF.shift===v?"#8b5cf6":tS.inp,color:ptF.shift===v?"#fff":tS.sub,border:`1.5px solid ${ptF.shift===v?"#8b5cf6":tS.border}`,borderRadius:99,padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer",transition:"all 0.15s",WebkitTapHighlightColor:"transparent"}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── SECTION 2: Output & QC ── */}
          <div style={{borderRadius:14,border:`1.5px solid ${tS.border}`,overflow:"visible",marginBottom:4}}>
            <div style={{background:dm?"rgba(16,185,129,0.1)":"rgba(16,185,129,0.05)",padding:"10px 14px",borderBottom:`1px solid ${tS.border}`}}>
              <p style={{color:"#10b981",fontWeight:800,fontSize:12}}>② Output & Quality</p>
              <p style={{color:tS.sub,fontSize:10}}>Units produced and quality grade for recall traceability</p>
            </div>
            <div style={{padding:"14px 14px",display:"flex",flexDirection:"column",gap:12}}>
              {/* Big unit counter */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:10,alignItems:"end"}}>
                <div>
                  <p style={{color:tS.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Units Produced *</p>
                  <div style={{display:"flex",alignItems:"center",gap:8,background:tS.inp,border:`1.5px solid ${tS.inpB}`,borderRadius:12,padding:"8px 12px"}}>
                    <button onClick={()=>setPtF(f=>({...f,actual:String(Math.max(0,(+f.actual||0)-1))}))}
                      style={{width:32,height:32,borderRadius:8,background:tS.card,border:`1px solid ${tS.border}`,color:tS.text,fontWeight:900,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>−</button>
                    <input type="number" value={ptF.actual} onChange={e=>{const v=e.target.value;setPtF(f=>({...f,actual:v}));}} placeholder="0"
                      style={{flex:1,background:"transparent",border:"none",outline:"none",color:tS.text,fontWeight:900,fontSize:24,textAlign:"center",minWidth:0}}/>
                    <button onClick={()=>setPtF(f=>({...f,actual:String((+f.actual||0)+1)}))}
                      style={{width:32,height:32,borderRadius:8,background:"#8b5cf6",border:"none",color:"#fff",fontWeight:900,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>+</button>
                  </div>
                  {/* Quick presets */}
                  <div style={{display:"flex",gap:4,marginTop:6,flexWrap:"wrap"}}>
                    {(settings?.batchUnitPresets||[50,100,150,200,250,300]).map(n=>(
                      <button key={n} onClick={()=>setPtF(f=>({...f,actual:String(n)}))}
                        style={{background:+ptF.actual===n?"#8b5cf6":tS.inp,color:+ptF.actual===n?"#fff":tS.sub,border:`1px solid ${+ptF.actual===n?"#8b5cf6":tS.border}`,borderRadius:6,padding:"5px 10px",fontSize:10,fontWeight:700,cursor:"pointer",transition:"all 0.1s"}}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                {/* QC Grade visual picker */}
                <div>
                  <p style={{color:tS.sub,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>QC Grade *</p>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:6}}>
                    {[{g:"A",color:"#10b981",label:"Pass"},{g:"B",color:"#f59e0b",label:"Pass"},{g:"C",color:"#f97316",label:"Marginal"},{g:"F",color:"#ef4444",label:"Fail"}].map(({g,color,label})=>(
                      <button key={g} onClick={()=>setPtF(f=>({...f,qcGrade:g}))}
                        style={{background:ptF.qcGrade===g?color+"25":tS.card,border:`2px solid ${ptF.qcGrade===g?color:tS.inpB}`,borderRadius:10,padding:"8px 4px",textAlign:"center",cursor:"pointer",transition:"all 0.15s",WebkitTapHighlightColor:"transparent"}}>
                        <p style={{color,fontWeight:900,fontSize:20,lineHeight:1}}>{g}</p>
                        <p style={{color:ptF.qcGrade===g?color:tS.sub,fontSize:9,fontWeight:600,marginTop:2}}>{label}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {/* Auto-deduct preview */}
              {ptAutoDeduct&&+ptF.actual>0&&(()=>{
                const pname=(ptF.product==="__custom__"?ptF.customProduct:ptF.product)||"";
                const pn=pname.toLowerCase();
                const scored=supplies.map(s=>{const sn=(s.item||"").toLowerCase();let score=0;if(sn===pn)score=100;else if(sn.includes(pn)||pn.includes(sn))score=60;else{const pW=pn.split(/\s+/);const sW=sn.split(/\s+/);const h=pW.filter(w=>sW.some(sw=>sw.includes(w)||w.includes(sw)));if(h.length>0)score=30+h.length*10;}return{...s,_score:score};}).filter(s=>s._score>0).sort((a,b)=>b._score-a._score);
                const match=scored[0];
                if(!match)return null;
                const afterQty=Math.max(0,(match.qty||0)-+ptF.actual);
                return <div style={{background:"#10b98110",border:"1px solid #10b98130",borderRadius:10,padding:"10px 12px",display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:16}}>📦</span>
                  <div style={{flex:1}}>
                    <p style={{color:"#10b981",fontSize:11,fontWeight:700}}>Auto-deduct preview</p>
                    <p style={{color:tS.sub,fontSize:10}}>Saves "{match.item}": {match.qty} → {afterQty} {match.unit} after this batch</p>
                  </div>
                </div>;
              })()}
              <Inp dm={dm} label="Batch Notes" value={ptF.notes} onChange={e=>{const v=e.target.value;setPtF(f=>({...f,notes:v}));}} placeholder="e.g. Machine issue, short staff, quality remarks…"/>
            </div>
          </div>

          {/* ── SECTION 3: Customer Traceability ── */}
          {(()=>{
            const batchDate=ptF.date||today();
            const sameDateDelivs=deliveries.filter(d=>d.date===batchDate&&d.status!=="Cancelled");
            const productName=(ptF.product==="__custom__"?ptF.customProduct:ptF.product)||"";
            // Find deliveries that include this product
            const matchingDelivs=productName?sameDateDelivs.filter(d=>Object.entries(safeO(d.orderLines)).some(([pid,l])=>{if(!(l.qty>0))return false;const p=products.find(x=>x.id===pid);const pName=p?.name||l.name||"";return pName===productName||pName.toLowerCase().includes(productName.toLowerCase())||productName.toLowerCase().includes(pName.toLowerCase());})):sameDateDelivs;
            const totalUnitsOrdered=matchingDelivs.reduce((s,d)=>Object.entries(safeO(d.orderLines)).reduce((s2,[pid,l])=>{if(!(l.qty>0))return s2;const p=products.find(x=>x.id===pid);const pName=p?.name||l.name||"";if(!productName||pName===productName||pName.toLowerCase().includes(productName.toLowerCase())||productName.toLowerCase().includes(pName.toLowerCase()))return s2+(+l.qty||0);return s2;},s),0);
            return <div style={{borderRadius:14,border:`1.5px solid ${tS.border}`,overflow:"visible",marginBottom:4}}>
              <div style={{background:dm?"rgba(124,58,237,0.12)":"rgba(124,58,237,0.06)",padding:"10px 14px",borderBottom:`1px solid ${tS.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <p style={{color:"#7c3aed",fontWeight:800,fontSize:12}}>③ Customer Traceability</p>
                  <p style={{color:tS.sub,fontSize:10}}>Who receives products from this batch — for recall tracking</p>
                </div>
                <span style={{background:"#7c3aed22",color:"#7c3aed",borderRadius:8,padding:"3px 10px",fontSize:11,fontWeight:800}}>{matchingDelivs.length} orders</span>
              </div>
              <div style={{padding:"14px 14px"}}>
                {matchingDelivs.length===0
                  ?<div style={{textAlign:"center",padding:"12px 0"}}>
                    <p style={{fontSize:20,marginBottom:6}}>📭</p>
                    <p style={{color:tS.sub,fontSize:12,fontWeight:600}}>No deliveries found for {batchDate}</p>
                    <p style={{color:tS.sub,fontSize:10,marginTop:3}}>{productName?"for "+productName+" — ":""}Deliveries added for this date will appear here automatically</p>
                  </div>
                  :<>
                    {/* Summary row */}
                    <div className="crm-grid-3" style={{gap:8,marginBottom:12}}>
                      {[
                        {l:"Customers",v:matchingDelivs.length,c:"#7c3aed"},
                        {l:"Units Ordered",v:totalUnitsOrdered,c:"#8b5cf6"},
                        {l:"Surplus/Deficit",v:(+ptF.actual||0)-totalUnitsOrdered,c:(+ptF.actual||0)>=totalUnitsOrdered?"#10b981":"#ef4444"},
                      ].map(x=><div key={x.l} style={{background:tS.inp,borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
                        <p style={{color:x.c,fontWeight:900,fontSize:16,lineHeight:1}}>{x.v>=0&&x.l==="Surplus/Deficit"&&x.v>0?"+":""}{x.v}</p>
                        <p style={{color:tS.sub,fontSize:9,marginTop:3,fontWeight:600,textTransform:"uppercase"}}>{x.l}</p>
                      </div>)}
                    </div>
                    {/* Customer list */}
                    <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:200,overflowY:"auto"}}>
                      {matchingDelivs.map((d,di)=>{
                        const dInvNo=(invRegistry?.issued||{})[d.id]||d.invNo||null;
                        const prodQty=Object.entries(safeO(d.orderLines)).filter(([pid,l])=>{if(!(l.qty>0))return false;const p=products.find(x=>x.id===pid);const pName=p?.name||l.name||"";return !productName||pName===productName||pName.toLowerCase().includes(productName.toLowerCase())||productName.toLowerCase().includes(pName.toLowerCase());}).reduce((s,[,l])=>s+(+l.qty||0),0);
                        const statusColor=d.status==="Delivered"?"#10b981":d.status==="In Transit"?"#3b82f6":d.status==="Cancelled"?"#ef4444":"#f59e0b";
                        return <div key={d.id} style={{background:tS.card,border:`1px solid ${tS.border}`,borderRadius:10,padding:"8px 12px",display:"flex",alignItems:"center",gap:10,borderLeft:`3px solid ${statusColor}`}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:2}}>
                              <p style={{color:tS.text,fontWeight:700,fontSize:12}}>{d.customer}</p>
                              <span style={{background:statusColor+"15",color:statusColor,borderRadius:5,padding:"1px 6px",fontSize:9,fontWeight:700}}>{d.status}</span>
                              {dInvNo&&<span style={{background:dm?"rgba(139,92,246,0.15)":"rgba(139,92,246,0.08)",color:"#8b5cf6",borderRadius:5,padding:"1px 6px",fontSize:9,fontWeight:700,fontFamily:"monospace"}}>📄 {dInvNo}</span>}
                            </div>
                            {d.address&&<p style={{color:tS.sub,fontSize:10}}>📍 {d.address}</p>}
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <p style={{color:"#8b5cf6",fontWeight:800,fontSize:14,lineHeight:1}}>{prodQty}</p>
                            <p style={{color:tS.sub,fontSize:9}}>units</p>
                          </div>
                        </div>;
                      })}
                    </div>
                    {matchingDelivs.length>0&&<p style={{color:tS.sub,fontSize:10,marginTop:8,textAlign:"center"}}>💡 This links batch to customers automatically — critical for product recall</p>}
                  </>
                }
              </div>
            </div>;
          })()}

          {/* ── SECTION 4: Wastage ── */}
          <div style={{borderRadius:14,border:`1.5px solid ${tS.border}`,overflow:"visible",marginBottom:4}}>
            <div style={{background:dm?"rgba(249,115,22,0.1)":"rgba(249,115,22,0.05)",padding:"10px 14px",borderBottom:(ptF.embWastage||[]).length>0?`1px solid ${tS.border}`:"none",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <p style={{color:"#f97316",fontWeight:800,fontSize:12}}>④ Wastage <span style={{fontWeight:400,fontSize:10,color:tS.sub}}>(optional)</span></p>
                <p style={{color:tS.sub,fontSize:10}}>Log any wasted or rejected units from this batch</p>
              </div>
              <button onClick={()=>setPtF(f=>({...f,embWastage:[...(f.embWastage||[]),{id:uid(),product:f.product==="__custom__"?(f.customProduct||""):f.product,qty:"",unit:"pcs",type:(settings?.wastageTypes||["Other"])[0],reason:"",cost:"",shift:f.shift||"",date:f.date||today(),loggedBy:sess?.name||displayName}]}))}
                style={{background:"#f9731620",color:"#f97316",border:"1px solid #f9731640",borderRadius:8,padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:14}}>+</span> Add Wastage
              </button>
            </div>
            {(ptF.embWastage||[]).length>0&&<div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:8}}>
              {(ptF.embWastage||[]).map((w,wi)=>(
                <div key={w.id||wi} style={{background:tS.inp,border:`1px solid ${tS.inpB}`,borderRadius:12,padding:"10px 12px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{background:"#f9731620",color:"#f97316",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>🗑️ Entry {wi+1}</span>
                    </div>
                    {isAdmin&&<button onClick={()=>setPtF(f=>({...f,embWastage:(f.embWastage||[]).filter((_,i)=>i!==wi)}))} style={{background:"#dc262615",color:"#dc2626",border:"none",borderRadius:6,padding:"3px 10px",fontSize:10,fontWeight:700,cursor:"pointer"}}>Remove</button>}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr",gap:8}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 80px 80px",gap:8}}>
                      <Inp dm={dm} label="Product" value={w.product} onChange={e=>setPtF(f=>({...f,embWastage:(f.embWastage||[]).map((x,i)=>i===wi?{...x,product:e.target.value}:x)}))} placeholder="Product name"/>
                      <Inp dm={dm} label="Qty" type="number" value={w.qty} onChange={e=>setPtF(f=>({...f,embWastage:(f.embWastage||[]).map((x,i)=>i===wi?{...x,qty:e.target.value}:x)}))} placeholder="0"/>
                      <Sel dm={dm} label="Unit" value={w.unit} onChange={e=>setPtF(f=>({...f,embWastage:(f.embWastage||[]).map((x,i)=>i===wi?{...x,unit:e.target.value}:x)}))}>
                        {(settings?.supplyUnits||["pcs","kg","g","L","mL","bags","boxes","dozen"]).map(u=><option key={u}>{u}</option>)}
                      </Sel>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
                      <Sel dm={dm} label="Type" value={w.type} onChange={e=>setPtF(f=>({...f,embWastage:(f.embWastage||[]).map((x,i)=>i===wi?{...x,type:e.target.value}:x)}))}>
                        {(settings?.wastageTypes||["Burnt","Broken","Expired","Overproduced","Quality Reject","Other"]).map(t2=><option key={t2}>{t2}</option>)}
                      </Sel>
                      {can("waste_logCost")&&<Inp dm={dm} label="Cost (₹)" type="number" value={w.cost||""} onChange={e=>setPtF(f=>({...f,embWastage:(f.embWastage||[]).map((x,i)=>i===wi?{...x,cost:e.target.value}:x)}))} placeholder="0"/>}
                    </div>
                    <Inp dm={dm} label="Reason" value={w.reason||""} onChange={e=>setPtF(f=>({...f,embWastage:(f.embWastage||[]).map((x,i)=>i===wi?{...x,reason:e.target.value}:x)}))} placeholder="e.g. Overcooked, dropped, equipment failure…"/>
                  </div>
                </div>
              ))}
            </div>}
          </div>

          {/* ── SECTION 5: QC Checks ── */}
          <div style={{borderRadius:14,border:`1.5px solid ${tS.border}`,overflow:"visible",marginBottom:4}}>
            <div style={{background:dm?"rgba(20,184,166,0.1)":"rgba(20,184,166,0.05)",padding:"10px 14px",borderBottom:(ptF.embQC||[]).length>0?`1px solid ${tS.border}`:"none",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <p style={{color:"#14b8a6",fontWeight:800,fontSize:12}}>⑤ QC Checks <span style={{fontWeight:400,fontSize:10,color:tS.sub}}>(optional)</span></p>
                <p style={{color:tS.sub,fontSize:10}}>Detailed quality inspection records for this batch</p>
              </div>
              <button onClick={()=>setPtF(f=>({...f,embQC:[...(f.embQC||[]),{id:uid(),product:f.product==="__custom__"?(f.customProduct||""):f.product,grade:"A",checker:sess?.name||displayName,notes:"",shift:f.shift||"",date:f.date||today()}]}))}
                style={{background:"#14b8a620",color:"#14b8a6",border:"1px solid #14b8a640",borderRadius:8,padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:14}}>+</span> Add Check
              </button>
            </div>
            {(ptF.embQC||[]).length>0&&<div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:8}}>
              {(ptF.embQC||[]).map((q,qi)=>(
                <div key={q.id||qi} style={{background:tS.inp,border:`1px solid ${tS.inpB}`,borderRadius:12,padding:"10px 12px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <span style={{background:"#14b8a620",color:"#14b8a6",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>✅ Check {qi+1}</span>
                    {isAdmin&&<button onClick={()=>setPtF(f=>({...f,embQC:(f.embQC||[]).filter((_,i)=>i!==qi)}))} style={{background:"#dc262615",color:"#dc2626",border:"none",borderRadius:6,padding:"3px 10px",fontSize:10,fontWeight:700,cursor:"pointer"}}>Remove</button>}
                  </div>
                  <Inp dm={dm} label="Product Inspected" value={q.product} onChange={e=>setPtF(f=>({...f,embQC:(f.embQC||[]).map((x,i)=>i===qi?{...x,product:e.target.value}:x)}))} placeholder="Product name"/>
                  <div className="crm-grid-4" style={{gap:6,marginTop:8}}>
                    {[{g:"A",color:"#10b981",label:"Pass"},{g:"B",color:"#f59e0b",label:"Pass"},{g:"C",color:"#f97316",label:"Marginal"},{g:"F",color:"#ef4444",label:"Fail"}].map(({g,color,label})=>(
                      <button key={g} onClick={()=>setPtF(f=>({...f,embQC:(f.embQC||[]).map((x,i)=>i===qi?{...x,grade:g}:x)}))}
                        style={{background:q.grade===g?color+"25":tS.card,border:`2px solid ${q.grade===g?color:tS.inpB}`,borderRadius:10,padding:"8px 4px",textAlign:"center",cursor:"pointer",transition:"all 0.15s"}}>
                        <p style={{color,fontWeight:900,fontSize:18,lineHeight:1}}>{g}</p>
                        <p style={{color:q.grade===g?color:tS.sub,fontSize:9,fontWeight:600}}>{label}</p>
                      </button>
                    ))}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8,marginTop:8}}>
                    <Inp dm={dm} label="Inspector Name" value={q.checker||""} onChange={e=>setPtF(f=>({...f,embQC:(f.embQC||[]).map((x,i)=>i===qi?{...x,checker:e.target.value}:x)}))} placeholder="Inspector"/>
                    <Inp dm={dm} label="Observations" value={q.notes||""} onChange={e=>setPtF(f=>({...f,embQC:(f.embQC||[]).map((x,i)=>i===qi?{...x,notes:e.target.value}:x)}))} placeholder="e.g. Colour good, texture ok…"/>
                  </div>
                </div>
              ))}
            </div>}
          </div>

          {/* ── SECTION 6: Handovers ── */}
          <div style={{borderRadius:14,border:`1.5px solid ${tS.border}`,overflow:"visible",marginBottom:4}}>
            <div style={{background:dm?"rgba(99,102,241,0.1)":"rgba(99,102,241,0.05)",padding:"10px 14px",borderBottom:(ptF.embHandover||[]).length>0?`1px solid ${tS.border}`:"none",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <p style={{color:"#6366f1",fontWeight:800,fontSize:12}}>⑥ Shift Handover <span style={{fontWeight:400,fontSize:10,color:tS.sub}}>(optional)</span></p>
                <p style={{color:tS.sub,fontSize:10}}>Notes passed to the next shift</p>
              </div>
              {can("prod_handover")&&<button onClick={()=>setPtF(f=>({...f,embHandover:[...(f.embHandover||[]),{id:uid(),shift:f.shift||"",nextShift:"",note:"",issues:"",loggedBy:sess?.name||displayName,date:f.date||today()}]}))}
                style={{background:"#6366f120",color:"#6366f1",border:"1px solid #6366f140",borderRadius:8,padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:14}}>+</span> Add Note
              </button>}
            </div>
            {(ptF.embHandover||[]).length>0&&<div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:8}}>
              {(ptF.embHandover||[]).map((h,hi)=>(
                <div key={h.id||hi} style={{background:tS.inp,border:`1px solid ${tS.inpB}`,borderRadius:12,padding:"10px 12px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <span style={{background:"#6366f120",color:"#6366f1",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>📋 Handover {hi+1}</span>
                    {isAdmin&&<button onClick={()=>setPtF(f=>({...f,embHandover:(f.embHandover||[]).filter((_,i)=>i!==hi)}))} style={{background:"#dc262615",color:"#dc2626",border:"none",borderRadius:6,padding:"3px 10px",fontSize:10,fontWeight:700,cursor:"pointer"}}>Remove</button>}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(160px,100%),1fr))",gap:8}}>
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
            </div>}
          </div>

          {/* ── Save Summary & Button ── */}
          <div style={{background:dm?"rgba(139,92,246,0.1)":"rgba(139,92,246,0.06)",border:`1.5px solid rgba(139,92,246,0.3)`,borderRadius:14,padding:"14px 16px",marginTop:4}}>
            <p style={{color:"#8b5cf6",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Batch Summary</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(140px,100%),1fr))",gap:6,marginBottom:12}}>
              {[
                {l:"Product",v:ptF.product==="__custom__"?(ptF.customProduct||"—"):(ptF.product||"—"),c:tS.text},
                {l:"Units",v:ptF.actual||"0",c:"#8b5cf6"},
                {l:"Date",v:ptF.date||today(),c:tS.text},
                {l:"QC Grade",v:ptF.qcGrade||"A",c:{A:"#10b981",B:"#f59e0b",C:"#f97316",F:"#ef4444"}[ptF.qcGrade]||"#10b981"},
                {l:"Wastage Entries",v:(ptF.embWastage||[]).filter(w=>w.product&&w.qty).length,c:"#f97316"},
                {l:"QC Checks",v:(ptF.embQC||[]).filter(q=>q.product&&q.grade).length,c:"#14b8a6"},
              ].map(x=><div key={x.l} style={{background:tS.card,borderRadius:8,padding:"7px 10px"}}>
                <p style={{color:tS.sub,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>{x.l}</p>
                <p style={{color:x.c,fontWeight:700,fontSize:12,marginTop:2}}>{x.v}</p>
              </div>)}
            </div>
            <Btn dm={dm} onClick={savePT} className="w-full" style={{background:"linear-gradient(135deg,#7c3aed,#6366f1)",color:"#fff",border:"none",fontSize:15,padding:"14px",fontWeight:800,letterSpacing:"0.02em"}}>
              {ptSh==="add"?"🏭 Save Batch":"✓ Update Batch"}
            </Btn>
          </div>
          </>;
        })()}
      </Sheet>

      {/* QC Sheet */}
      <Sheet dm={dm} open={!!qcSh} onClose={()=>setQcSh(null)} title="Log QC Check">
        <Sel dm={dm} label="Product *" value={qcF.product} onChange={e=>setQcF({...qcF,product:e.target.value})}>
          <option value="">— Select product —</option>
          {products.map(p=><option key={p.id}>{p.name}</option>)}
          <option value="__custom__">Other / Custom</option>
        </Sel>
        {qcF.product==="__custom__"&&<Inp dm={dm} label="Custom Product" value={qcF.customProduct||""} onChange={e=>setQcF({...qcF,customProduct:e.target.value})} placeholder="e.g. Special Paratha"/>}
        <div className="crm-grid-2" style={{gap:3*4}}>
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
      <ConfirmModal state={confirmState} onResolve={resolveConfirm} dm={dm} t={t}/>
      <UndoToast state={undoState} onCancel={cancelUndo} dm={dm} t={t}/>
      <TrashPanel
        open={trashOpen}
        onClose={() => setTrashOpen(false)}
        trashedItems={trashedItems}
        isAdmin={isAdmin}
        dm={dm}
        t={t}
        onRestore={(item) => {
          const setterMap = {
            supplies:    setSup,
            expenses:    setExp,
            wastage:     setWaste,
            ingredients: setIngLogs,
            staff:       setStaffLogs,
            machines:    setMachineLogs,
            vehicles:    setVehLogs,
            production:  setProdTargets,
            deliveries:  setDeliv,
            payments:    setPaymentLedger,
            qclogs:      setQcLogs,
            stafflist:   setStaffList,
            ingitems:    setIngItems,
          };
          const setter = setterMap[item._collection];
          if (!setter) return;
          setter(p => safeArr(p).map(x => x.id === item.id
            ? { ...x, deleted: false, deletedAt: null, deletedAtISO: null, deletedBy: null, deletedByName: null, deletedByRole: null, restoredAt: ts(), restoredBy: sess.id, restoredByName: displayName }
            : x
          ));
          // If restoring a payment, re-apply the amount to customer.paid
          if (item._collection === "payments") {
            setCust(p=>safeArr(p).map(c=>c.id===item.customerId?{...c,paid:(c.paid||0)+(item.amount||0)}:c));
          }
          addLog("Restored from trash", item._label || item.id);
          notify("Restored ✓");
        }}
        onHardDelete={(item) => {
          const setterMap = {
            supplies:    setSup,
            expenses:    setExp,
            wastage:     setWaste,
            ingredients: setIngLogs,
            staff:       setStaffLogs,
            machines:    setMachineLogs,
            vehicles:    setVehLogs,
            production:  setProdTargets,
            deliveries:  setDeliv,
            payments:    setPaymentLedger,
            qclogs:      setQcLogs,
            stafflist:   setStaffList,
            ingitems:    setIngItems,
          };
          const setter = setterMap[item._collection];
          if (!setter) return;
          setter(p => safeArr(p).filter(x => x.id !== item.id));
          addLog("Permanently deleted", item._label || item.id);
          notify("Permanently deleted");
        }}
      />

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
              <div className="crm-btn-group">
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

            {/* Note field (shown always, required only if setting is on) */}
            <Inp dm={dm} label={`Collection Note${settings?.agentCollectRequireNote?" *":""}`} value={collectNote} onChange={e=>setCollectNote(e.target.value)} placeholder="e.g. Paid in cash at gate, UPI ref #12345…"/>

            <div className="flex gap-2">
              <Btn dm={dm} v="ghost" className="flex-1" onClick={()=>{setCollectSh(null);setCollectAmt("");setCollectNote("");}}>Cancel</Btn>
              <Btn dm={dm} v="success" className="flex-1" onClick={(()=>{
                // ── per-delivery collect guard — prevents double-tap recording payment twice ──
                let _collectBusy=false;
                return ()=>{
                  if(_collectBusy){notify("Recording…");return;}
                  _collectBusy=true;
                  setTimeout(()=>{_collectBusy=false;},3000);
                  const amt=+collectAmt;
                  if(!amt||amt<=0){notify("Enter a valid amount");_collectBusy=false;return;}
                  if(settings?.agentCollectRequireNote&&!collectNote.trim()){notify("Collection note is required");_collectBusy=false;return;}
                  const upd={...d,partialPayment:{enabled:true,amount:amt,note:collectNote,collectedBy:displayName,collectedAt:ts()}};
                  setDeliv(p=>safeArr(p).map(x=>x.id===d.id?upd:x));
                  // Only update c.paid — computedPendingMap will re-derive pending from the updated delivery
                  if(d.customerId){setCust(p=>safeArr(p).map(c=>c.id===d.customerId?{...c,paid:(c.paid||0)+amt}:c));}
                  addLog("Payment collected on delivery",`${d.customer} — ${inr(amt)}${collectNote?" · "+collectNote:""}`);
                  addNotif("Payment Collected",`${inr(amt)} collected from ${d.customer}`,"success","payment");
                  notify(`${inr(amt)} collected ✓`);
                  // Show inline receipt card on phone
                  setLastReceiptData({delivery:upd,amt,note:collectNote,customer:d.customer,ts:ts()});
                  // Auto-print receipt only if admin has it enabled
                  if(settings?.agentInvoiceEnabled!==false&&settings?.agentAutoReceipt!==false) exportDeliveryReceipt(upd,products,settings,getOrCreateInvNo(upd.id));
                  setCollectSh(null);setCollectAmt("");setCollectNote("");
                };
              })()}>Confirm Collection</Btn>
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
          const rcptNo=rcptInvNo?`RCP-${rcptInvNo.replace(/^[A-Z0-9]+-/,"")}`:`RCP-${(rd.id||"").slice(-8).toUpperCase()}`;
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

            <div className="crm-btn-group">
              <Btn dm={dm} v="ghost" className="flex-1" onClick={()=>setLastReceiptData(null)}>Close</Btn>
              {(isAdmin||(settings?.receiptPrintAllowed||["admin","agent"]).includes(sess?.role))&&<Btn dm={dm} v="sky" className="flex-1" onClick={()=>exportDeliveryReceipt(rd,products,settings,getOrCreateInvNo(rd.id))}>🧾 Receipt</Btn>}
              {isAdmin&&<Btn dm={dm} v="purple" className="flex-1" onClick={()=>exportDeliveryInvoice(rd,products,settings,getOrCreateInvNo(rd.id))}>📄 Invoice</Btn>}
            </div>
          </>;
        })()}
      </Sheet>

      <Sheet dm={dm} open={bulkOrderSh} onClose={()=>setBulkOrderSh(false)} title="📋 Bulk Order Entry">
        <p style={{color:t.sub}} className="text-xs">Create delivery orders for multiple customers at once. Toggle on the customers you want, optionally adjust quantities, then save all at once.</p>
        <div className="crm-grid-2" style={{gap:3*4}}>
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

      {/* ── DATE EXPORT DROPDOWN — anchored below the button ── */}
      {delivExportOpen&&can("deliv_export")&&(<>
        <div onClick={()=>setDelivExportOpen(false)} style={{position:"fixed",inset:0,zIndex:998,WebkitTapHighlightColor:"transparent"}}/>
        <div style={{position:"fixed",top:(()=>{const r=delivExportBtnRef.current?.getBoundingClientRect();return r?`${Math.min(r.bottom+6,window.innerHeight-320)}px`:"60px"})(),left:(()=>{const r=delivExportBtnRef.current?.getBoundingClientRect();if(!r)return"50%";const w=Math.min(300,window.innerWidth-16);const left=Math.min(r.left,window.innerWidth-w-8);return`${Math.max(8,left)}px`})(),background:t.card,border:`1px solid ${t.border}`,borderRadius:14,zIndex:999,padding:"16px",boxShadow:"0 8px 40px rgba(0,0,0,0.28)",width:"min(300px, calc(100vw - 16px))"}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <p style={{color:t.sub,fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.07em",margin:0}}>📅 Export by Date Range</p>
            <button onClick={()=>setDelivExportOpen(false)} style={{background:"none",border:"none",color:t.sub,fontSize:18,cursor:"pointer",lineHeight:1,padding:"0 2px"}}>×</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{color:t.sub,fontSize:12,minWidth:32}}>From</span>
              <input type="date" value={delivExportFrom} onChange={e=>setDelivExportFrom(e.target.value)} style={{flex:1,background:t.inp,border:`1.5px solid ${delivExportFrom?t.border:"#ef444480"}`,color:t.text,borderRadius:10,padding:"8px 10px",fontSize:13,outline:"none"}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{color:t.sub,fontSize:12,minWidth:32}}>To</span>
              <input type="date" value={delivExportTo} onChange={e=>setDelivExportTo(e.target.value)} style={{flex:1,background:t.inp,border:`1.5px solid ${delivExportTo?t.border:"#ef444480"}`,color:t.text,borderRadius:10,padding:"8px 10px",fontSize:13,outline:"none"}}/>
            </div>
            {delivExportFrom&&delivExportTo&&delivExportFrom<=delivExportTo&&(()=>{const cnt=deliveries.filter(d=>d.date>=delivExportFrom&&d.date<=delivExportTo).length;return <p style={{color:"#3b82f6",fontSize:11,fontWeight:600,textAlign:"center",margin:0}}>✓ {Math.round((new Date(delivExportTo)-new Date(delivExportFrom))/86400000)+1} days · {cnt} deliveri{cnt===1?"y":"es"} found</p>;})()}
            {delivExportFrom&&delivExportTo&&delivExportFrom>delivExportTo&&<p style={{color:"#ef4444",fontSize:11,fontWeight:600,textAlign:"center",margin:0}}>⚠️ "From" date must be before "To" date</p>}
            {(!delivExportFrom||!delivExportTo)&&<p style={{color:t.sub,fontSize:11,textAlign:"center",margin:0}}>Select both dates to export</p>}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {[
              ["📊 CSV",()=>{const dr=deliveries.filter(d=>d.date>=delivExportFrom&&d.date<=delivExportTo);gExport("csv",()=>exportCSV(dr,`deliveries_${delivExportFrom}_to_${delivExportTo}`,[{label:"Customer",key:"customer"},{label:"Date",key:"date"},{label:"Status",key:"status"},{label:"Order Total (₹)",val:r=>lineTotal(r.orderLines)},{label:"Repl Deducted (₹)",val:r=>r.replacement?.amount||0},{label:"Net (₹)",val:r=>lineTotal(r.orderLines)-(+r.replacement?.amount||0)},{label:"Collected (₹)",val:r=>r.partialPayment?.enabled?(+r.partialPayment?.amount||0):0},{label:"Balance Due (₹)",val:r=>Math.max(0,lineTotal(r.orderLines)-(+r.replacement?.amount||0)-(r.partialPayment?.enabled?(+r.partialPayment?.amount||0):0))},{label:"Repl Item",val:r=>r.replacement?.done?(r.replacement.item||""):"—"},{label:"Repl Type",val:r=>r.replacement?.type||""},{label:"Created By",key:"createdBy"}]),"Deliveries CSV");}],
              ["📋 XLS",()=>{const dr=deliveries.filter(d=>d.date>=delivExportFrom&&d.date<=delivExportTo);gExport("excel",()=>exportTabExcel(`Deliveries ${delivExportFrom} to ${delivExportTo}`,dr,[{label:"Customer",key:"customer"},{label:"Date",key:"date"},{label:"Status",key:"status"},{label:"Order Total",val:r=>lineTotal(r.orderLines),num:true},{label:"Repl Deducted",val:r=>r.replacement?.amount||0,num:true},{label:"Net Amount",val:r=>lineTotal(r.orderLines)-(+r.replacement?.amount||0),num:true},{label:"Collected",val:r=>r.partialPayment?.enabled?(+r.partialPayment?.amount||0):0,num:true},{label:"Balance Due",val:r=>Math.max(0,lineTotal(r.orderLines)-(+r.replacement?.amount||0)-(r.partialPayment?.enabled?(+r.partialPayment?.amount||0):0)),num:true},{label:"Repl Item",val:r=>r.replacement?.done?(r.replacement.item||""):"—"},{label:"Repl Type",val:r=>r.replacement?.type||""},{label:"Created By",key:"createdBy"}],settings),"Deliveries Excel");}],
            ].map(([lbl,fn])=>(
              <button key={lbl} onClick={()=>{if(!delivExportFrom||!delivExportTo){notify("Please select both From and To dates");return;}if(delivExportFrom>delivExportTo){notify("'From' date must be before 'To' date");return;}const cnt=deliveries.filter(d=>d.date>=delivExportFrom&&d.date<=delivExportTo).length;if(cnt===0){notify("No deliveries found in this date range");return;}fn();setDelivExportOpen(false);}} style={{background:(!delivExportFrom||!delivExportTo||delivExportFrom>delivExportTo)?t.inp+"80":t.inp,border:`1.5px solid ${t.border}`,color:(!delivExportFrom||!delivExportTo||delivExportFrom>delivExportTo)?t.sub:t.text,borderRadius:10,padding:"10px 12px",fontSize:13,fontWeight:700,cursor:(!delivExportFrom||!delivExportTo||delivExportFrom>delivExportTo)?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:6}}>{lbl}{delivExportFrom&&delivExportTo&&delivExportFrom<=delivExportTo?` (${deliveries.filter(d=>d.date>=delivExportFrom&&d.date<=delivExportTo).length} orders)`:""}</button>
            ))}
          </div>
        </div>
      </>)}

      {/* ── UNIVERSAL DETAIL MODAL — wrapped in CRMContext.Provider ── */}
      {detailModal && (
        <CRMContext.Provider value={{
          t, dm, isAdmin, sess,
          customers, deliveries, expenses, supplies, wastage, products, settings,
          actLog,
          invRegistry,
          setDetailModal,
          setEsh, setEf,
          setDsh, setDf,
          delE, delD,
          setPaySh, setPayAmt,
        }}>
          <DetailModal
            modal={detailModal}
            onClose={closeDetail}
          />
        </CRMContext.Provider>
      )}

      {/* ── ACTIVITY TIMELINE ── */}
      <ActivityTimeline
        open={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        actLog={actLog}
        currentUser={displayName}
        isAdmin={isAdmin}
        sess={sess}
        dm={dm}
        t={t}
      />

      {/* ── WIDGET CUSTOMIZER ── */}
      {settings?.featureCustomDashboard && (
        <WidgetCustomizer
          open={customizerOpen}
          onClose={() => setCustOpen(false)}
          widgets={userDashWidgets || settings?.dashWidgets || ["stats","chart","pendingDeliveries","outstanding"]}
          onSave={reorderWidgets}
          dm={dm}
          t={t}
          isAdmin={isAdmin}
        />
      )}

      {/* ── KEYBOARD HELP MODAL ── */}
      <KeyboardHelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        dm={dm}
        t={t}
        isAdmin={isAdmin}
        can={can}
      />

      {isAdmin && (
        <CommandPalette
          open={cmdOpen}
          setOpen={setCmdOpen}
          customers={customers}
          deliveries={deliveries}
          expenses={expenses}
          supplies={supplies}
          wastage={wastage}
          products={products}
          staffList={staffList}
          machineList={machineList}
          vehList={vehList}
          ingItems={ingItems}
          dm={dm}
          isAdmin={isAdmin}
          onNavigate={(tabId) => setTab(tabId)}
          onOpenDetail={(modal) => setDetailModal(modal)}
          onQuickAction={(actionId, tab) => {
            if (tab) setTab(tab);
            if (actionId === "qa_new_delivery") { setDsh("add"); setDf(blkD()); }
            if (actionId === "qa_new_customer") { setCsh("add"); setCf(blkC()); }
            if (actionId === "qa_new_expense")  { setEsh("new"); setEf(blkE()); }
            if (actionId === "qa_new_supply")   { setSsh("new"); setSf(blkS()); }
            if (actionId === "qa_new_payment")  { setPaySh(true); }
            if (actionId === "qa_new_wastage")  { setWSh("new"); setWF(blkW()); }
            if (actionId === "qa_open_kanban")  { setKanbanOpen(true); }
            if (actionId === "qa_open_audit")   { setAuditOpen(true); }
          }}
        />
      )}
      {/* ── QUICK ENTRY FAB (mobile) ── */}
      {!showMoreNav && <QuickEntryFAB
        dm={dm} t={t} tab={tab} sess={sess} can={can} isAdmin={isAdmin}
        customers={customers} products={products} settings={settings}
        today={today}
        onNewDelivery={() => { setDf(blkD()); setDsh("add"); setTab("Deliveries"); }}
        onNewCustomer={() => { setCf(blkC()); setCsh("add"); setTab("Customers"); }}
        onNewExpense={()  => { setEf(blkE()); setEsh("add"); setTab("Expenses"); }}
        onNewSupply={()   => { setSf(blkS()); setSsh("add"); setTab("Supplies"); }}
        onNewWastage={() => { setWF(blkW()); setWSh("add"); setTab("Wastage"); }}
        onRecordPayment={() => { setPayLedgerSh(true); }}
        onOpenChange={(isOpen) => { setFabDockVisible(!isOpen); clearTimeout(fabDockTimerRef.current); }}
      />}

      <SystemHealthBar
        dm={dm} t={t}
        _syncListeners={_syncListeners}
        dataLoaded={dataLoaded}
        position="inline"
      />
    </>
  );
}

export { CRM };
