# TAS CRM — Split File Structure

Original: 1 file, 16,606 lines
Split:    35 files across lib/, components/, tabs/

## Folder Structure

```
src/
├── App.js                    ← Entry point (25 lines)
├── CRM.js                    ← Main shell: state + tab switcher
├── lib/
│   ├── auth.js               ← hashPw, checkPw, SESSION_TTL, device fingerprinting
│   ├── store.js              ← useStore, fbWrite, atomicInvoiceSeq
│   ├── utils.js              ← uid, today, inr, safeArr, cx, mapU, lineTotal, etc.
│   ├── i18n.js               ← I18N_LANGS, t18n, setAppLang
│   ├── roles.js              ← ALL_TABS, ROLE_DEF, FINE_PERM_DEFS, hasPerm, defaultFinePerms
│   ├── constants.js          ← D_PRODS, D_CUST, D_DELIV, D_SETTINGS, D_WASTE etc.
│   ├── theme.js              ← LT, DK, T(dm)
│   ├── exports.js            ← exportPDF, exportCSV, exportTabPDF, exportPnLReport, etc.
│   └── CRMContext.js         ← React Context: CRMContext, useCRM()
├── components/
│   ├── ui.js                 ← Btn, Inp, Sel, Card, Sheet, Toast, Confirm, StatCard,
│   │                            Pagination, ProdRow, OrderEditor, StatusPill, etc.
│   ├── DetailModal.js        ← Universal detail/view modal
│   ├── MorningBriefing.js    ← Daily briefing widget
│   ├── Login.js              ← Login screen
│   ├── RootInner.js          ← AppErrorBoundary + RootInner (login gate)
│   ├── GPSMap.js             ← Leaflet GPS map component
│   ├── WeatherWidget.js      ← Weather widget
│   └── SecurityPanels.js     ← PasskeyManager, SecuritySessions, FailedLoginAttempts
└── tabs/
    ├── Dashboard.js          ← 451 lines
    ├── Customers.js          ← 1,143 lines
    ├── Deliveries.js         ← 874 lines
    ├── Supplies.js           ← 210 lines
    ├── Expenses.js           ← 379 lines
    ├── Wastage.js            ← 109 lines
    ├── Payments.js           ← 390 lines
    ├── PnL.js                ← 902 lines
    ├── Analytics.js          ← 1,111 lines
    ├── Production.js         ← 694 lines
    ├── Ingredients.js        ← 141 lines
    ├── Staff.js              ← 254 lines
    ├── Machines.js           ← 228 lines
    ├── Vehicles.js           ← 253 lines
    ├── GPS.js                ← 450 lines
    └── Settings.js           ← 3,110 lines
```

## Current Status: Phase 1 — Files Separated

✅ All code extracted into logical files
✅ No functionality changed — everything still works as before
⚠️  CRM.js still imports/uses tab JSX inline (Phase 2 work below)

## Phase 2 — Convert tabs to proper React components (optional, do later)

Each tab file contains raw JSX. To make them proper importable components:

1. Wrap each tab file's JSX in a function that uses `useCRM()` hook
2. Import CRMContext in each tab
3. Replace inline JSX in CRM.js with `<DashboardTab />`, `<CustomersTab />` etc.
4. Add React.lazy() + Suspense for code splitting (this is where the real perf gains are)

Example for Dashboard.js:
```jsx
import { useCRM } from "../lib/CRMContext";
export default function DashboardTab() {
  const { t, dm, sess, isAdmin, can, deliveries, customers, ...rest } = useCRM();
  return (
    <>
      {/* paste the dashboard JSX block here */}
    </>
  );
}
```

Then in CRM.js:
```jsx
import { lazy, Suspense } from "react";
const DashboardTab = lazy(() => import("./tabs/Dashboard"));
// ...
{tab === "Dashboard" && <Suspense fallback={<Spinner />}><DashboardTab /></Suspense>}
```

This is where lazy loading kicks in — users only download tab code when they open it.

## How to use these files

Drop the `src/` folder into your existing project, replacing the current App.js.
Make sure firebase.js is at src/firebase.js (unchanged).

The file split alone won't break anything — all code is the same, just organised.
