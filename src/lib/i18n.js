/* eslint-disable */

// ═══════════════════════════════════════════════════════════════
//  MULTI-LANGUAGE SYSTEM  (per-account, stored on Firebase user)
//  Usage: t18n("key") anywhere; language set in Settings → Firebase
// ═══════════════════════════════════════════════════════════════
const I18N_LANGS = {
  en: {
    Dashboard:"Dashboard", Customers:"Customers", Deliveries:"Deliveries",
    Payments:"Payments", Supplies:"Supplies", Expenses:"Expenses",
    "P&L":"P&L", Analytics:"Analytics", Production:"Production",
    Ingredients:"Ingredients", Staff:"Staff", Machines:"Machines",
    Vehicles:"Vehicles", GPS:"GPS", Settings:"Settings",
    Active:"Active", Inactive:"Inactive", Pending:"Pending",
    Delivered:"Delivered", "In Transit":"In Transit", Cancelled:"Cancelled",
    Approved:"Approved", "Add Customer":"Add Customer", "Add Delivery":"Add Delivery",
    "Add Expense":"Add Expense", "Add Supply":"Add Supply",
  },
  hi: {
    Dashboard:"डैशबोर्ड", Customers:"ग्राहक", Deliveries:"डिलीवरी",
    Payments:"भुगतान", Supplies:"आपूर्ति", Expenses:"खर्च",
    "P&L":"लाभ-हानि", Analytics:"विश्लेषण", Production:"उत्पादन",
    Ingredients:"सामग्री", Staff:"स्टाफ", Machines:"मशीनें",
    Vehicles:"वाहन", GPS:"जीपीएस", Settings:"सेटिंग्स",
    Active:"सक्रिय", Inactive:"निष्क्रिय", Pending:"लंबित",
    Delivered:"वितरित", "In Transit":"रास्ते में", Cancelled:"रद्द",
    Approved:"स्वीकृत",
  },
  ml: {
    Dashboard:"ഡാഷ്ബോർഡ്", Customers:"ഉപഭോക്താക്കൾ", Deliveries:"ഡെലിവറി",
    Payments:"പേയ്മെന്റ്", Supplies:"സാധനങ്ങൾ", Expenses:"ചെലവ്",
    "P&L":"ലാഭ-നഷ്ടം", Analytics:"വിശകലനം", Production:"ഉൽപ്പാദനം",
    Ingredients:"ചേരുവകൾ", Staff:"ജീവനക്കാർ", Machines:"യന്ത്രങ്ങൾ",
    Vehicles:"വാഹനങ്ങൾ", GPS:"ജിപിഎസ്", Settings:"ക്രമീകരണം",
    Active:"സജീവം", Inactive:"നിഷ്‌ക്രിയം", Pending:"തീർപ്പാകാത്ത",
    Delivered:"ഡെലിവർ ചെയ്തു", "In Transit":"വഴിയിൽ", Cancelled:"റദ്ദ്",
    Approved:"അംഗീകൃതം",
  },
};
// Global lang ref — updated when settings load
let _currentLang = "en";
function t18n(key){ return (I18N_LANGS[_currentLang]||I18N_LANGS.en)[key] || I18N_LANGS.en[key] || key; }
function setAppLang(lang){ _currentLang = I18N_LANGS[lang] ? lang : "en"; }
// ═══════════════════════════════════════════════════════════════

export { I18N_LANGS, t18n, setAppLang };
