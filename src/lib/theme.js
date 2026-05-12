/* eslint-disable */

//  THEME
// ═══════════════════════════════════════════════════════════════
// ── Phase 5 Design System ─────────────────────────────────────────
// Light: #f8f9fb content bg, white cards, #2563eb primary CTA
// Dark:  #0d1b2a deep navy sidebar, charcoal content
const LT={
  bg:"#f8f9fb",card:"#ffffff",border:"#e8ecf0",
  text:"#0d1b2a",sub:"#64748b",inp:"#f1f5f9",inpB:"#cbd5e1",
  accent:"#2563eb",accentFg:"#ffffff",accentHover:"#1d4ed8",
  accentLight:"rgba(37,99,235,0.06)",accentMid:"rgba(37,99,235,0.12)",
  sidebar:"#0d1b2a",sidebarBorder:"#1e2d3d",
  sidebarText:"#f0f4f8",sidebarSub:"#7ea0be",
  sidebarActive:"#ffffff",sidebarActiveBg:"#2563eb",
  success:"#059669",warning:"#d97706",danger:"#dc2626",
  successBg:"#f0fdf4",warningBg:"#fffbeb",dangerBg:"#fef2f2",
  statIcon1:"#eff6ff",statIcon2:"#f0fdf4",statIcon3:"#fefce8",statIcon4:"#fdf4ff",statIcon5:"#fff7ed",
  tableHeader:"#f8fafc",
  topbar:"#ffffff",topbarBorder:"#e8ecf0",
  pillGreen:"#dcfce7",pillGreenText:"#15803d",
  pillAmber:"#fef9c3",pillAmberText:"#a16207",
  pillRed:"#fee2e2",pillRedText:"#b91c1c",
  pillBlue:"#dbeafe",pillBlueText:"#1d4ed8",
  pillGray:"#f1f5f9",pillGrayText:"#475569",
  pillPurple:"#ede9fe",pillPurpleText:"#6d28d9",
};
const DK={
  bg:"#0f1117",card:"#1a1f2e",border:"#252d3a",
  text:"#e8edf5",sub:"#7ea0be",inp:"#1e2536",inpB:"#2d3748",
  accent:"#2563eb",accentFg:"#ffffff",accentHover:"#1d4ed8",
  accentLight:"rgba(37,99,235,0.1)",accentMid:"rgba(37,99,235,0.18)",
  sidebar:"#0d1b2a",sidebarBorder:"#1e2d3d",
  sidebarText:"#f0f4f8",sidebarSub:"#7ea0be",
  sidebarActive:"#ffffff",sidebarActiveBg:"#2563eb",
  success:"#10b981",warning:"#f59e0b",danger:"#f87171",
  successBg:"rgba(16,185,129,0.08)",warningBg:"rgba(245,158,11,0.08)",dangerBg:"rgba(248,113,113,0.08)",
  statIcon1:"rgba(37,99,235,0.12)",statIcon2:"rgba(16,185,129,0.12)",statIcon3:"rgba(245,158,11,0.12)",statIcon4:"rgba(139,92,246,0.12)",statIcon5:"rgba(249,115,22,0.12)",
  tableHeader:"#1a1f2e",
  topbar:"#141825",topbarBorder:"#252d3a",
  pillGreen:"rgba(16,185,129,0.12)",pillGreenText:"#10b981",
  pillAmber:"rgba(245,158,11,0.12)",pillAmberText:"#f59e0b",
  pillRed:"rgba(239,68,68,0.12)",pillRedText:"#f87171",
  pillBlue:"rgba(37,99,235,0.12)",pillBlueText:"#60a5fa",
  pillGray:"rgba(100,116,139,0.12)",pillGrayText:"#94a3b8",
  pillPurple:"rgba(139,92,246,0.12)",pillPurpleText:"#a78bfa",
};
const T=(dm)=>dm?DK:LT;


export { LT, DK, T };
