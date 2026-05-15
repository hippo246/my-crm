// ============================================================
// staff/theme.js — REVAMPED v3 · Premium factory worker design language
// ============================================================

export const ST = () => ({
  // ── Backgrounds
  bg:      "#060910",
  bg2:     "#090d16",
  bg3:     "#0d1120",
  card:    "#0f1520",
  cardHov: "#141b2a",
  cardAlt: "#0a0e18",
  sidebar: "#080c15",
  header:  "#080c15",
  inp:     "#060910",
  modal:   "#0f1520",

  // ── Borders
  border:  "#181f30",
  border2: "#1e2840",
  border3: "#273350",

  // ── Text
  text:  "#f0f4ff",
  sub:   "#6b748f",
  muted: "#35405a",

  // ── Accents
  blue:    "#3b82f6", blueL:   "rgba(59,130,246,0.12)",  blueG:   "linear-gradient(135deg,#1d4ed8,#3b82f6)",
  green:   "#10B981", greenL:  "rgba(16,185,129,0.12)",  greenG:  "linear-gradient(135deg,#047857,#10B981)",
  orange:  "#f97316", orangeL: "rgba(249,115,22,0.12)",  orangeG: "linear-gradient(135deg,#c2410c,#f97316)",
  yellow:  "#F59E0B", yellowL: "rgba(245,158,11,0.12)",  yellowG: "linear-gradient(135deg,#b45309,#F59E0B)",
  purple:  "#8B5CF6", purpleL: "rgba(139,92,246,0.12)",  purpleG: "linear-gradient(135deg,#6d28d9,#8B5CF6)",
  red:     "#ef4444", redL:    "rgba(239,68,68,0.12)",   redG:    "linear-gradient(135deg,#b91c1c,#ef4444)",
  cyan:    "#06b6d4", cyanL:   "rgba(6,182,212,0.12)",   cyanG:   "linear-gradient(135deg,#0369a1,#06b6d4)",
  teal:    "#14B8A6", tealL:   "rgba(20,184,166,0.12)",  tealG:   "linear-gradient(135deg,#0f766e,#14B8A6)",
  pink:    "#ec4899", pinkL:   "rgba(236,72,153,0.12)",  pinkG:   "linear-gradient(135deg,#be185d,#ec4899)",

  // ── Semantic
  success: "#10B981",
  warning: "#F59E0B",
  danger:  "#ef4444",
  info:    "#3b82f6",

  // ── Shadows
  shadow:  "0 4px 40px rgba(0,0,0,0.7)",
  shadow2: "0 2px 16px rgba(0,0,0,0.5)",
  glow:    (color) => `0 0 30px ${color}35, 0 0 10px ${color}15`,

  // ── Radii
  r: "16px", r2: "12px", r3: "8px", r4: "6px", rFull: "999px",

  // ── Fonts
  fontMono: "'JetBrains Mono', 'Fira Code', monospace",
});

export const TAB_ACCENT = {
  home:      { solid:"#3b82f6", light:"rgba(59,130,246,0.1)",  gradient:"linear-gradient(135deg,#1d4ed8,#3b82f6)",  glow:"0 4px 24px rgba(59,130,246,0.4)"  },
  production:{ solid:"#f97316", light:"rgba(249,115,22,0.1)",  gradient:"linear-gradient(135deg,#c2410c,#f97316)",  glow:"0 4px 24px rgba(249,115,22,0.4)"  },
  packing:   { solid:"#F59E0B", light:"rgba(245,158,11,0.1)",  gradient:"linear-gradient(135deg,#b45309,#F59E0B)",  glow:"0 4px 24px rgba(245,158,11,0.4)"  },
  inventory: { solid:"#10B981", light:"rgba(16,185,129,0.1)",  gradient:"linear-gradient(135deg,#047857,#10B981)",  glow:"0 4px 24px rgba(16,185,129,0.4)"  },
  delivery:  { solid:"#8B5CF6", light:"rgba(139,92,246,0.1)",  gradient:"linear-gradient(135deg,#6d28d9,#8B5CF6)",  glow:"0 4px 24px rgba(139,92,246,0.4)"  },
  qc:        { solid:"#ef4444", light:"rgba(239,68,68,0.1)",   gradient:"linear-gradient(135deg,#b91c1c,#ef4444)",  glow:"0 4px 24px rgba(239,68,68,0.4)"   },
  staff:      { solid:"#06b6d4", light:"rgba(6,182,212,0.1)",   gradient:"linear-gradient(135deg,#0369a1,#06b6d4)",  glow:"0 4px 24px rgba(6,182,212,0.4)"   },
  management: { solid:"#06b6d4", light:"rgba(6,182,212,0.1)",   gradient:"linear-gradient(135deg,#0369a1,#06b6d4)",  glow:"0 4px 24px rgba(6,182,212,0.4)"   },
  reports:    { solid:"#3b82f6", light:"rgba(59,130,246,0.1)",  gradient:"linear-gradient(135deg,#1d4ed8,#3b82f6)",  glow:"0 4px 24px rgba(59,130,246,0.4)"  },
  settings:   { solid:"#8B5CF6", light:"rgba(139,92,246,0.1)",  gradient:"linear-gradient(135deg,#6d28d9,#8B5CF6)",  glow:"0 4px 24px rgba(139,92,246,0.4)"  },
};

export const STATUS_COLOR = (status) => {
  const map = {
    active:       { bg:"rgba(16,185,129,0.1)",  text:"#10B981", border:"rgba(16,185,129,0.25)"  },
    completed:    { bg:"rgba(59,130,246,0.1)",  text:"#3b82f6", border:"rgba(59,130,246,0.25)"  },
    pending:      { bg:"rgba(245,158,11,0.1)",  text:"#F59E0B", border:"rgba(245,158,11,0.25)"  },
    Pending:      { bg:"rgba(245,158,11,0.1)",  text:"#F59E0B", border:"rgba(245,158,11,0.25)"  },
    dispatched:   { bg:"rgba(16,185,129,0.1)",  text:"#10B981", border:"rgba(16,185,129,0.25)"  },
    Delivered:    { bg:"rgba(16,185,129,0.1)",  text:"#10B981", border:"rgba(16,185,129,0.25)"  },
    "In Transit": { bg:"rgba(139,92,246,0.1)",  text:"#8B5CF6", border:"rgba(139,92,246,0.25)"  },
    "in transit": { bg:"rgba(139,92,246,0.1)",  text:"#8B5CF6", border:"rgba(139,92,246,0.25)"  },
    Cancelled:    { bg:"rgba(239,68,68,0.1)",   text:"#ef4444", border:"rgba(239,68,68,0.25)"   },
    in_progress:  { bg:"rgba(59,130,246,0.1)",  text:"#3b82f6", border:"rgba(59,130,246,0.25)"  },
    pass:         { bg:"rgba(16,185,129,0.1)",  text:"#10B981", border:"rgba(16,185,129,0.25)"  },
    fail:         { bg:"rgba(239,68,68,0.1)",   text:"#ef4444", border:"rgba(239,68,68,0.25)"   },
    low:          { bg:"rgba(245,158,11,0.1)",  text:"#F59E0B", border:"rgba(245,158,11,0.25)"  },
    ok:           { bg:"rgba(16,185,129,0.1)",  text:"#10B981", border:"rgba(16,185,129,0.25)"  },
    Good:         { bg:"rgba(16,185,129,0.1)",  text:"#10B981", border:"rgba(16,185,129,0.25)"  },
    "Low Stock":  { bg:"rgba(245,158,11,0.1)",  text:"#F59E0B", border:"rgba(245,158,11,0.25)"  },
    Critical:     { bg:"rgba(239,68,68,0.1)",   text:"#ef4444", border:"rgba(239,68,68,0.25)"   },
    present:      { bg:"rgba(16,185,129,0.1)",  text:"#10B981", border:"rgba(16,185,129,0.25)"  },
    absent:       { bg:"rgba(239,68,68,0.1)",   text:"#ef4444", border:"rgba(239,68,68,0.25)"   },
    Rejected:     { bg:"rgba(239,68,68,0.1)",   text:"#ef4444", border:"rgba(239,68,68,0.25)"   },
    A:            { bg:"rgba(16,185,129,0.1)",  text:"#10B981", border:"rgba(16,185,129,0.25)"  },
    B:            { bg:"rgba(245,158,11,0.1)",  text:"#F59E0B", border:"rgba(245,158,11,0.25)"  },
    C:            { bg:"rgba(249,115,22,0.1)",  text:"#f97316", border:"rgba(249,115,22,0.25)"  },
  };
  return map[status] || { bg:"rgba(255,255,255,0.06)", text:"#6b748f", border:"rgba(255,255,255,0.1)" };
};
