/* eslint-disable */
import { hashPw } from "./auth";
import { ALL_TABS } from "./roles";

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
  creditLimitDefault: 0,
  featureTaxCalc: false,
  taxRate: 0,
  featureRouteOpt: false,
  featureMultiCurrency: false,
  // ── Phase 1 ──
  featurePWA: false,
  featureTickRedesign: true,
  // ── Phase 2 ──
  featureIngredientTracking: false,
  featureStaffAttendance: false,
  featureMachineMaintenance: false,
  featureVanManagement: false,
  // ── Phase 3 ──
  featureGST: false,
  gstCompanyGSTIN: "",
  gstDefaultHSN: "",
  gstCGSTPct: 9,
  gstSGSTPct: 9,
  featureCustomDashboard: false,
  featureGoogleSheets: false,
  googleSheetsId: "",
  googleSheetsApiKey: "",
  googleSheetsWebAppUrl: "",
  featurePrintLabels: false,
  featureMultiLanguage: false,
  defaultLanguage: "en",
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
  // ── Vehicle / Van Management Settings ──
  vehicleTypes: ["Van","Car","Bike","Truck","Auto","Other"],
  vehicleLogTypes: ["Trip","Maintenance","Breakdown","Fuel Fill","Insurance","Other"],
  vehicleStatuses: ["OK","Needs Service","Offline","Under Repair"],
  vehicleFuelTypes: ["Petrol","Diesel","CNG","Electric","LPG"],
  vehicleRequireDriver: false,
  vehicleRequireKms: false,
  vehicleShowFuelCost: true,
  vehicleShowMaintCost: true,
  vehicleShowOdometer: true,
  vehicleShowFuelLiters: true,
  vehicleShowFuelType: true,
  vehicleShowNextService: true,
  vehicleShowPriority: false,
  vehicleShowRouteStops: false,
  vehicleShowTollCost: false,
  // ── Machine Maintenance Settings ──
  machineCategories: ["Mixer","Oven","Sealer","Generator","Conveyor","Other"],
  machineLogTypes: ["Servicing","Breakdown","Repair","Inspection","Oil Change","Other"],
  machineStatuses: ["Operational","Needs Service","Under Repair","Retired"],
  machineSeverityLevels: ["Low","Medium","High","Critical"],
  machineDefaultIntervalDays: 30,
  machineAlertBeforeDays: 3,
  machineRequireNextDue: true,
  machineShowTechnician: true,
  machineShowPartsReplaced: true,
  machineShowPartsCost: true,
  machineShowLaborCost: true,
  machineShowDowntime: true,
  machineShowSeverity: true,
  machineShowWarrantyInfo: false,
  // ── Staff Attendance Settings ──
  staffStatuses: ["Present","Absent","Half Day","Late","On Leave"],
  staffDepartments: ["Production","Delivery","Packaging","Cleaning","Admin","Other"],
  staffEmploymentTypes: ["Full-time","Part-time","Contract","Daily Wage"],
  staffDefaultShift: "Morning",
  staffRequireInOutTime: false,
  staffAllowCustomName: true,
  staffOvertimeThresholdHrs: 9,
  staffShowDepartment: true,
  staffShowBreakDuration: false,
  staffShowOvertimeReason: false,
  staffShowTask: false,
  staffShowTemperature: false,
};

// Default wastage data
const D_WASTE = [];

// Default production targets
const D_PROD_TARGETS = [];
// Production-only items (separate from delivery products)
const D_PROD_ITEMS = [
  {id:"prod_paratha", name:"Paratha"},
  {id:"prod_roti",    name:"Roti"},
];
// shifts stored in settings already

// ═══════════════════════════════════════════════════════════════
//  EXPORTS

export { D_PRODS, D_CUST, D_DELIV, D_SUP, D_EXP, D_USERS, D_SETTINGS, D_WASTE, D_PROD_TARGETS, D_PROD_ITEMS };
