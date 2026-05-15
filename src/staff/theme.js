// ============================================================
// staff/theme.js — REVAMPED v3 · Premium factory worker design language
// ============================================================

export const ST = (lightMode = false) => {
  if (lightMode) return {
    // ── Backgrounds — warm white base, slight cream tint so it's not clinical
    bg:      "#f7f8fc",   // page background — off-white with a whisper of blue
    bg2:     "#f0f2f9",   // subtle section backgrounds
    bg3:     "#e8ecf5",   // deeper inset areas (table stripes, code blocks)
    card:    "#ffffff",   // pure white cards — clean contrast against bg
    cardHov: "#f5f7ff",   // hover: barely-there blue lift
    cardAlt: "#fafbff",   // alt card (modals inner sections)
    sidebar: "#ffffff",   // sidebar pure white, border separates it
    header:  "#ffffff",   // header pure white
    inp:     "#f0f2f9",   // input fields — same as bg2, clearly inset
    modal:   "#ffffff",

    // ── Borders — enough contrast to see without being heavy
    border:  "#e2e7f3",   // default dividers
    border2: "#cdd5ea",   // stronger separators
    border3: "#b9c4dc",   // heaviest — used sparingly

    // ── Text — real ink, not harsh black
    text:  "#0f172a",     // primary — near-black with a blue undertone
    sub:   "#475569",     // secondary — readable slate
    muted: "#94a3b8",     // placeholder/disabled — clearly muted

    // ── Accents — slightly deeper than dark-mode versions for WCAG contrast on white
    blue:    "#2563eb", blueL:   "rgba(37,99,235,0.08)",   blueG:   "linear-gradient(135deg,#1d4ed8,#3b82f6)",
    green:   "#059669", greenL:  "rgba(5,150,105,0.08)",   greenG:  "linear-gradient(135deg,#047857,#10B981)",
    orange:  "#ea580c", orangeL: "rgba(234,88,12,0.08)",   orangeG: "linear-gradient(135deg,#c2410c,#f97316)",
    yellow:  "#b45309", yellowL: "rgba(180,83,9,0.08)",    yellowG: "linear-gradient(135deg,#92400e,#d97706)",
    purple:  "#6d28d9", purpleL: "rgba(109,40,217,0.08)",  purpleG: "linear-gradient(135deg,#5b21b6,#7c3aed)",
    red:     "#dc2626", redL:    "rgba(220,38,38,0.08)",   redG:    "linear-gradient(135deg,#b91c1c,#ef4444)",
    cyan:    "#0369a1", cyanL:   "rgba(3,105,161,0.08)",   cyanG:   "linear-gradient(135deg,#075985,#0891b2)",
    teal:    "#0f766e", tealL:   "rgba(15,118,110,0.08)",  tealG:   "linear-gradient(135deg,#134e4a,#0d9488)",
    pink:    "#be185d", pinkL:   "rgba(190,24,93,0.08)",   pinkG:   "linear-gradient(135deg,#9d174d,#db2777)",

    // ── Semantic
    success: "#059669",
    warning: "#b45309",
    danger:  "#dc2626",
    info:    "#2563eb",

    // ── Shadows — layered so cards feel elevated, not floating
    shadow:  "0 1px 3px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.08)",
    shadow2: "0 1px 2px rgba(15,23,42,0.04), 0 2px 8px rgba(15,23,42,0.06)",
    glow:    (color) => `0 0 16px ${color}30, 0 0 4px ${color}18`,

    // ── Radii
    r: "16px", r2: "12px", r3: "8px", r4: "6px", rFull: "999px",

    // ── Fonts
    fontMono: "'JetBrains Mono', 'Fira Code', monospace",
  };

  return {
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
  };
};

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

// STATUS_COLOR — pass lightMode=true for light theme variant
// Dark mode: low-opacity tinted backgrounds with bright text (glows on dark)
// Light mode: richer tinted backgrounds with deep text (readable on white)
export const STATUS_COLOR = (status, lightMode = false) => {
  if (lightMode) {
    const map = {
      active:       { bg:"rgba(5,150,105,0.10)",   text:"#065f46", border:"rgba(5,150,105,0.30)"   },
      completed:    { bg:"rgba(37,99,235,0.10)",   text:"#1e3a8a", border:"rgba(37,99,235,0.30)"   },
      pending:      { bg:"rgba(180,83,9,0.10)",    text:"#78350f", border:"rgba(180,83,9,0.30)"    },
      Pending:      { bg:"rgba(180,83,9,0.10)",    text:"#78350f", border:"rgba(180,83,9,0.30)"    },
      dispatched:   { bg:"rgba(5,150,105,0.10)",   text:"#065f46", border:"rgba(5,150,105,0.30)"   },
      Delivered:    { bg:"rgba(5,150,105,0.10)",   text:"#065f46", border:"rgba(5,150,105,0.30)"   },
      "In Transit": { bg:"rgba(109,40,217,0.10)",  text:"#4c1d95", border:"rgba(109,40,217,0.30)"  },
      "in transit": { bg:"rgba(109,40,217,0.10)",  text:"#4c1d95", border:"rgba(109,40,217,0.30)"  },
      Cancelled:    { bg:"rgba(220,38,38,0.10)",   text:"#7f1d1d", border:"rgba(220,38,38,0.30)"   },
      in_progress:  { bg:"rgba(37,99,235,0.10)",   text:"#1e3a8a", border:"rgba(37,99,235,0.30)"   },
      pass:         { bg:"rgba(5,150,105,0.10)",   text:"#065f46", border:"rgba(5,150,105,0.30)"   },
      fail:         { bg:"rgba(220,38,38,0.10)",   text:"#7f1d1d", border:"rgba(220,38,38,0.30)"   },
      low:          { bg:"rgba(180,83,9,0.10)",    text:"#78350f", border:"rgba(180,83,9,0.30)"    },
      ok:           { bg:"rgba(5,150,105,0.10)",   text:"#065f46", border:"rgba(5,150,105,0.30)"   },
      Good:         { bg:"rgba(5,150,105,0.10)",   text:"#065f46", border:"rgba(5,150,105,0.30)"   },
      "Low Stock":  { bg:"rgba(180,83,9,0.10)",    text:"#78350f", border:"rgba(180,83,9,0.30)"    },
      Critical:     { bg:"rgba(220,38,38,0.10)",   text:"#7f1d1d", border:"rgba(220,38,38,0.30)"   },
      present:      { bg:"rgba(5,150,105,0.10)",   text:"#065f46", border:"rgba(5,150,105,0.30)"   },
      absent:       { bg:"rgba(220,38,38,0.10)",   text:"#7f1d1d", border:"rgba(220,38,38,0.30)"   },
      Rejected:     { bg:"rgba(220,38,38,0.10)",   text:"#7f1d1d", border:"rgba(220,38,38,0.30)"   },
      A:            { bg:"rgba(5,150,105,0.10)",   text:"#065f46", border:"rgba(5,150,105,0.30)"   },
      B:            { bg:"rgba(180,83,9,0.10)",    text:"#78350f", border:"rgba(180,83,9,0.30)"    },
      C:            { bg:"rgba(234,88,12,0.10)",   text:"#7c2d12", border:"rgba(234,88,12,0.30)"   },
    };
    return map[status] || { bg:"rgba(15,23,42,0.05)", text:"#475569", border:"rgba(15,23,42,0.15)" };
  }

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
