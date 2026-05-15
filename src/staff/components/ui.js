// ============================================================
// staff/components/ui.js — REVAMPED v3 · Premium component library
// Glassmorphism · Neon glows · Rich charts · Touch-optimized
// ============================================================

import React, { useState, useEffect, useRef } from "react";
import { STATUS_COLOR } from "../theme.js";

export const TR = "all 0.18s cubic-bezier(0.4,0,0.2,1)";

// ── BUTTON ───────────────────────────────────────────────────
export function SBtn({ children, onClick, v = "primary", color, disabled, style = {}, sm, full, icon }) {
  const c = color || "#3b82f6";
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    fontWeight: 700, borderRadius: sm ? 8 : 10, border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: TR, fontSize: sm ? 11 : 13,
    padding: sm ? "7px 13px" : "11px 20px",
    width: full ? "100%" : undefined,
    opacity: disabled ? 0.38 : 1,
    letterSpacing: "0.01em", position: "relative", overflow: "hidden",
    fontFamily: "inherit",
    ...style,
  };
  const variants = {
    primary: { background: `linear-gradient(135deg,${c},${c}cc)`, color: "#fff", boxShadow: `0 4px 20px ${c}40, inset 0 1px 0 rgba(255,255,255,0.18)` },
    success: { background: "linear-gradient(135deg,#047857,#10B981)", color: "#fff", boxShadow: "0 4px 20px rgba(16,185,129,0.4), inset 0 1px 0 rgba(255,255,255,0.18)" },
    warning: { background: "linear-gradient(135deg,#b45309,#F59E0B)", color: "#fff", boxShadow: "0 4px 20px rgba(245,158,11,0.4), inset 0 1px 0 rgba(255,255,255,0.18)" },
    danger:  { background: "linear-gradient(135deg,#b91c1c,#ef4444)", color: "#fff", boxShadow: "0 4px 20px rgba(239,68,68,0.4), inset 0 1px 0 rgba(255,255,255,0.18)" },
    ghost:   { background: `${c}14`, color: c, border: `1.5px solid ${c}30` },
    soft:    { background: `${c}18`, color: c, border: `1px solid ${c}28` },
    dark:    { background: "#141b2a", color: "#f0f4ff", border: "1px solid #1e2840" },
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{ ...base, ...variants[v] }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.filter = "brightness(1.14)"; e.currentTarget.style.transform = "translateY(-1px)"; }}}
      onMouseLeave={e => { e.currentTarget.style.filter = ""; e.currentTarget.style.transform = ""; }}
    >
      {icon && <span style={{ fontSize: sm ? 12 : 14 }}>{icon}</span>}
      {children}
    </button>
  );
}

// ── KPI CARD ─────────────────────────────────────────────────
export function SKpiCard({ label, value, sub, color, icon, progress, t, trend, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: `linear-gradient(145deg, ${color}f0, ${color}b0)`,
      borderRadius: t.r, padding: "18px 20px",
      position: "relative", overflow: "hidden", color: "#fff",
      boxShadow: `0 8px 32px ${color}50, inset 0 1px 0 rgba(255,255,255,0.18)`,
      cursor: onClick ? "pointer" : "default",
      transition: TR,
    }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.filter = "brightness(1.08)"; e.currentTarget.style.transform = "translateY(-2px)"; }}}
      onMouseLeave={e => { e.currentTarget.style.filter = ""; e.currentTarget.style.transform = ""; }}
    >
      <div style={{ position:"absolute", right:-20, top:-20, width:110, height:110, borderRadius:"50%", background:"rgba(255,255,255,0.12)", pointerEvents:"none" }} />
      <div style={{ position:"absolute", right:-5, bottom:-15, width:70, height:70, borderRadius:"50%", background:"rgba(255,255,255,0.06)", pointerEvents:"none" }} />
      <div style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", fontSize:46, opacity:0.18, pointerEvents:"none" }}>{icon}</div>
      <div style={{ position:"relative" }}>
        <div style={{ fontSize:9, fontWeight:800, opacity:0.88, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:7 }}>{label}</div>
        <div style={{ fontSize:30, fontWeight:900, lineHeight:1, letterSpacing:"-0.03em" }}>{value}</div>
        {sub && <div style={{ fontSize:10, opacity:0.82, marginTop:6 }}>{sub}</div>}
        {trend && <div style={{ fontSize:10, opacity:0.9, marginTop:4, fontWeight:700 }}>{trend}</div>}
        {progress !== undefined && (
          <div style={{ marginTop:12 }}>
            <div style={{ height:3, background:"rgba(255,255,255,0.2)", borderRadius:"999px", overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${progress}%`, background:"rgba(255,255,255,0.9)", borderRadius:"999px", boxShadow:"0 0 8px rgba(255,255,255,0.6)" }} />
            </div>
            <div style={{ fontSize:10, opacity:0.85, marginTop:5, fontWeight:700 }}>{progress}% of target</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── STAT CARD ────────────────────────────────────────────────
export function SStatCard({ label, value, icon, color, t, sub }) {
  return (
    <div style={{
      background: t.card, borderRadius: t.r2, border: `1px solid ${t.border2}`,
      padding: "16px 18px", display:"flex", alignItems:"center", gap:14, transition: TR,
      position: "relative", overflow: "hidden",
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}35`; e.currentTarget.style.boxShadow = `0 0 24px ${color}12`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.boxShadow = ""; }}
    >
      <div style={{ position:"absolute", inset:0, background:`radial-gradient(circle at top right, ${color}07, transparent 60%)`, pointerEvents:"none" }} />
      <div style={{
        width:44, height:44, borderRadius:12, flexShrink:0,
        background:`${color}14`, border:`1px solid ${color}25`,
        display:"flex", alignItems:"center", justifyContent:"center", fontSize:20,
        boxShadow:`0 0 20px ${color}18`,
      }}>{icon}</div>
      <div style={{ minWidth:0, position:"relative" }}>
        <div style={{ color:t.sub, fontSize:9, fontWeight:700, marginBottom:3, textTransform:"uppercase", letterSpacing:"0.08em" }}>{label}</div>
        <div style={{ color:t.text, fontSize:24, fontWeight:900, lineHeight:1 }}>{value}</div>
        {sub && <div style={{ color:t.sub, fontSize:11, marginTop:3 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── GRADIENT ACTION CARD ──────────────────────────────────────
export function SGradCard({ icon, label, sub, gradient, onClick, glow, badge }) {
  return (
    <div onClick={onClick} style={{
      background: gradient, borderRadius: 14,
      padding: "16px 12px", cursor: "pointer", color: "#fff",
      display:"flex", flexDirection:"column", alignItems:"center",
      gap:8, textAlign:"center", transition: TR,
      position:"relative", overflow:"hidden",
      boxShadow: glow || `0 4px 24px rgba(0,0,0,0.35)`,
    }}
      onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.14)"; e.currentTarget.style.transform = "translateY(-3px) scale(1.02)"; }}
      onMouseLeave={e => { e.currentTarget.style.filter = ""; e.currentTarget.style.transform = ""; }}
    >
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(135deg,rgba(255,255,255,0.14) 0%,transparent 55%)", pointerEvents:"none" }} />
      <div style={{ position:"absolute", bottom:-15, right:-10, width:60, height:60, borderRadius:"50%", background:"rgba(255,255,255,0.09)", pointerEvents:"none" }} />
      {badge && (
        <div style={{ position:"absolute", top:8, right:8, background:"rgba(239,68,68,0.9)", color:"#fff", borderRadius:"999px", fontSize:9, fontWeight:800, padding:"2px 6px", minWidth:16, textAlign:"center" }}>{badge}</div>
      )}
      <div style={{ fontSize:26, lineHeight:1, position:"relative" }}>{icon}</div>
      <div style={{ position:"relative" }}>
        <div style={{ fontWeight:800, fontSize:12, lineHeight:1.2, letterSpacing:"0.01em" }}>{label}</div>
        {sub && <div style={{ fontSize:10, opacity:0.82, marginTop:2 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── STATUS PILL ───────────────────────────────────────────────
export function SPill({ status, label, size = "sm" }) {
  const c = STATUS_COLOR(status);
  return (
    <span style={{
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      borderRadius: 6, padding: size === "sm" ? "3px 9px" : "5px 13px",
      fontSize: size === "sm" ? 10 : 12, fontWeight: 700,
      display:"inline-block", whiteSpace:"nowrap",
      letterSpacing:"0.03em",
    }}>
      {label || status}
    </span>
  );
}

// ── ACTIVITY TAG ──────────────────────────────────────────────
export function STag({ label, color }) {
  return (
    <span style={{
      background:`${color}14`, color, borderRadius:6,
      padding:"3px 9px", fontSize:10, fontWeight:700,
      display:"inline-block", whiteSpace:"nowrap",
      border:`1px solid ${color}25`, letterSpacing:"0.03em",
    }}>{label}</span>
  );
}

// ── PROGRESS BAR ──────────────────────────────────────────────
export function SProgress({ value, max, color = "#3b82f6", t, showLabel = true }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div style={{ height:5, background:t.border, borderRadius:"999px", overflow:"hidden" }}>
        <div style={{
          height:"100%", width:`${pct}%`,
          background:`linear-gradient(90deg,${color},${color}cc)`,
          borderRadius:"999px", transition:"width 0.6s cubic-bezier(0.4,0,0.2,1)",
          boxShadow:`0 0 10px ${color}55`,
        }} />
      </div>
      {showLabel && (
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
          <span style={{ color:t.sub, fontSize:10 }}>{value.toLocaleString("en-IN")} / {max.toLocaleString("en-IN")}</span>
          <span style={{ color, fontSize:10, fontWeight:700 }}>{pct}%</span>
        </div>
      )}
    </div>
  );
}

// ── BOTTOM SHEET ──────────────────────────────────────────────
export function SSheet({ open, onClose, title, children, t }) {
  if (!open) return null;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:400, display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(6px)" }} />
      <div style={{
        position:"relative", background:t.modal, border:`1px solid ${t.border2}`,
        borderRadius:"20px 20px 0 0", padding:"20px 20px 36px",
        maxHeight:"88vh", overflowY:"auto",
        boxShadow:"0 -8px 48px rgba(0,0,0,0.7)",
        animation:"slideUp 0.25s cubic-bezier(0.4,0,0.2,1)",
      }}>
        {/* Handle */}
        <div style={{ width:40, height:4, background:t.border3, borderRadius:"999px", margin:"0 auto 18px" }} />
        {title && (
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
            <div style={{ color:t.text, fontWeight:800, fontSize:16 }}>{title}</div>
            <button onClick={onClose} style={{ background:"none", border:"none", color:t.sub, cursor:"pointer", fontSize:18, lineHeight:1, padding:"4px 8px" }}>✕</button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// ── QTY PICKER ────────────────────────────────────────────────
export function SQtyPicker({ value, onChange, min = 0, max, t, color = "#3b82f6" }) {
  const dec = () => { if (value > min) onChange(value - 1); };
  const inc = () => { if (max === undefined || value < max) onChange(value + 1); };
  return (
    <div style={{ display:"flex", alignItems:"center", gap:0, background:t.card, border:`1.5px solid ${t.border2}`, borderRadius:14, overflow:"hidden" }}>
      <button onClick={dec} style={{
        width:56, height:56, background:"none", border:"none", cursor:"pointer",
        color: value <= min ? t.muted : color, fontSize:24, fontWeight:800,
        transition:TR, display:"flex", alignItems:"center", justifyContent:"center",
      }}
        onMouseEnter={e => { if (value > min) e.currentTarget.style.background = `${color}15`; }}
        onMouseLeave={e => e.currentTarget.style.background = ""}
      >−</button>
      <div style={{
        minWidth:90, textAlign:"center",
        color: value > 0 ? t.text : t.muted, fontWeight:900,
        fontSize:28, letterSpacing:"-0.02em",
        borderLeft:`1px solid ${t.border}`, borderRight:`1px solid ${t.border}`,
        padding:"10px 0",
        fontVariantNumeric:"tabular-nums",
      }}>{value}</div>
      <button onClick={inc} style={{
        width:56, height:56, background:"none", border:"none", cursor:"pointer",
        color: (max !== undefined && value >= max) ? t.muted : color, fontSize:24, fontWeight:800,
        transition:TR, display:"flex", alignItems:"center", justifyContent:"center",
      }}
        onMouseEnter={e => { const atMax = max !== undefined && value >= max; if (!atMax) e.currentTarget.style.background = `${color}15`; }}
        onMouseLeave={e => e.currentTarget.style.background = ""}
      >+</button>
    </div>
  );
}

// ── QTY PRESETS ───────────────────────────────────────────────
export function SQtyPresets({ presets = [50, 100, 200, 500], onSelect, color = "#3b82f6", t }) {
  return (
    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
      {presets.map(p => (
        <button key={p} onClick={() => onSelect(p)} style={{
          padding:"8px 18px", borderRadius:9,
          border:`1.5px solid ${t.border2}`,
          background:t.card, color:t.text,
          fontWeight:700, fontSize:13, cursor:"pointer", transition:TR,
          fontFamily:"inherit",
        }}
          onMouseEnter={e => { e.currentTarget.style.background = `${color}18`; e.currentTarget.style.color = color; e.currentTarget.style.borderColor = `${color}40`; e.currentTarget.style.boxShadow = `0 0 16px ${color}30`; }}
          onMouseLeave={e => { e.currentTarget.style.background = t.card; e.currentTarget.style.color = t.text; e.currentTarget.style.borderColor = t.border2; e.currentTarget.style.boxShadow = ""; }}
        >+{p}</button>
      ))}
    </div>
  );
}

// ── SEARCH BAR ────────────────────────────────────────────────
export function SSearch({ value, onChange, placeholder = "Search...", t }) {
  return (
    <div style={{ position:"relative" }}>
      <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:13, color:t.muted, pointerEvents:"none" }}>🔍</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{
          width:"100%", background:t.inp, border:`1.5px solid ${t.border2}`,
          color:t.text, borderRadius:t.r3, padding:"10px 14px 10px 40px",
          fontSize:13, outline:"none", boxSizing:"border-box", transition:TR,
          fontFamily:"inherit",
        }}
        onFocus={e => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.12)"; }}
        onBlur={e => { e.target.style.borderColor = t.border2; e.target.style.boxShadow = ""; }}
      />
    </div>
  );
}

// ── DIVIDER ───────────────────────────────────────────────────
export function SHr({ t, margin = "14px 0" }) {
  return <div style={{ height:1, background:t.border, margin }} />;
}

// ── CARD ──────────────────────────────────────────────────────
export function SCard({ children, t, style = {}, onClick, accent, padding = "18px" }) {
  return (
    <div onClick={onClick} style={{
      background:t.card, borderRadius:t.r, border:`1px solid ${t.border2}`,
      padding, cursor:onClick ? "pointer" : undefined,
      borderLeft:accent ? `3px solid ${accent}` : undefined,
      transition:TR, ...style,
    }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.background = t.cardHov; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.background = t.card; }}
    >
      {children}
    </div>
  );
}

// ── SECTION HEADER ────────────────────────────────────────────
export function SSectionHeader({ title, t, accent, action }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
      <div style={{ display:"flex", alignItems:"center", gap:9 }}>
        {accent && <div style={{ width:3, height:16, background:accent, borderRadius:"999px" }} />}
        <div style={{ color:t.text, fontWeight:800, fontSize:13, letterSpacing:"-0.01em" }}>{title}</div>
      </div>
      {action}
    </div>
  );
}

// ── MINI SPARKLINE CHART ──────────────────────────────────────
export function SSparkline({ data = [], color = "#3b82f6", width = 80, height = 32 }) {
  if (!data.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  const areaBottom = `${width},${height} 0,${height}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow:"visible" }}>
      <defs>
        <linearGradient id={`sg-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${pts} ${areaBottom}`} fill={`url(#sg-${color.replace("#","")})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── DONUT CHART ───────────────────────────────────────────────
export function SDonut({ value, max, color, size = 64, strokeWidth = 7, label, t }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const dash = pct * circ;
  return (
    <div style={{ position:"relative", width:size, height:size, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <svg width={size} height={size} style={{ position:"absolute", inset:0 }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`${color}20`} strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={circ / 4}
          strokeLinecap="round" style={{ filter:`drop-shadow(0 0 8px ${color}90)` }}
        />
      </svg>
      {label && <span style={{ color: t?.text || "#fff", fontSize:size * 0.19, fontWeight:900 }}>{label}</span>}
    </div>
  );
}

// ── BAR CHART ─────────────────────────────────────────────────
export function SBarChart({ data = [], color = "#3b82f6", height = 60, t }) {
  const max = Math.max(...data.map(d => d.value)) || 1;
  return (
    <div style={{ display:"flex", gap:5, alignItems:"flex-end", height }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
          <div style={{
            width:"100%", borderRadius:"5px 5px 0 0",
            background:`linear-gradient(180deg, ${color}, ${color}77)`,
            height:`${Math.max(4, (d.value / max) * (height - 20))}px`,
            boxShadow:`0 0 10px ${color}45`,
            transition:"height 0.6s cubic-bezier(0.4,0,0.2,1)",
          }} />
          <div style={{ color:t?.sub || "#6b748f", fontSize:9, fontWeight:600, textAlign:"center" }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── LIVE BADGE ────────────────────────────────────────────────
export function SLiveBadge({ t }) {
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:5,
      background:"rgba(16,185,129,0.1)", border:"1px solid rgba(16,185,129,0.25)",
      borderRadius:"999px", padding:"3px 9px",
      color:"#10B981", fontSize:9, fontWeight:800, letterSpacing:"0.06em",
    }}>
      <span style={{
        width:5, height:5, borderRadius:"50%", background:"#10B981",
        boxShadow:"0 0 8px #10B981",
        animation:"pulse 2s infinite",
        display:"inline-block",
      }} />
      LIVE
    </span>
  );
}

// ── GLASS PANEL ───────────────────────────────────────────────
export function SGlass({ children, t, style = {}, glow }) {
  return (
    <div style={{
      background: "rgba(15,21,32,0.8)",
      backdropFilter: "blur(28px)",
      border:`1px solid rgba(255,255,255,0.05)`,
      borderRadius:16,
      boxShadow: glow ? `0 0 36px ${glow}18, 0 8px 40px rgba(0,0,0,0.5)` : "0 8px 40px rgba(0,0,0,0.5)",
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── AVATAR ────────────────────────────────────────────────────
export function SAvatar({ name = "?", size = 40, color = "#3b82f6" }) {
  const initials = (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{
      width:size, height:size, borderRadius:"50%", flexShrink:0,
      background:`${color}18`, border:`1.5px solid ${color}30`,
      color, display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:size * 0.34, fontWeight:800,
      boxShadow:`0 0 16px ${color}20`,
    }}>{initials}</div>
  );
}

// ── SELECT ────────────────────────────────────────────────────
export function SSel({ value, onChange, options = [], t, placeholder }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      width:"100%", background:t.inp, border:`1.5px solid ${t.border2}`,
      color: value ? t.text : t.muted,
      borderRadius:t.r3, padding:"10px 14px",
      fontSize:13, outline:"none",
      cursor:"pointer", fontFamily:"inherit",
      transition:TR,
    }}
      onFocus={e => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.12)"; }}
      onBlur={e => { e.target.style.borderColor = t.border2; e.target.style.boxShadow = ""; }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => (
        <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
      ))}
    </select>
  );
}

// ── TOAST ─────────────────────────────────────────────────────
export function SToast({ msg, type = "success", visible }) {
  const colors = {
    success: { bg:"rgba(16,185,129,0.12)", border:"rgba(16,185,129,0.3)", text:"#10B981", icon:"✅" },
    warning: { bg:"rgba(245,158,11,0.12)", border:"rgba(245,158,11,0.3)", text:"#F59E0B", icon:"⚠️" },
    error:   { bg:"rgba(239,68,68,0.12)",  border:"rgba(239,68,68,0.3)",  text:"#ef4444", icon:"❌" },
    info:    { bg:"rgba(59,130,246,0.12)", border:"rgba(59,130,246,0.3)", text:"#3b82f6", icon:"ℹ️" },
  };
  const c = colors[type] || colors.success;
  return (
    <div style={{
      position:"fixed", bottom:100, left:"50%", transform:`translateX(-50%) translateY(${visible ? 0 : 20}px)`,
      opacity: visible ? 1 : 0, pointerEvents:"none",
      background:"rgba(9,13,22,0.96)", border:`1px solid ${c.border}`,
      borderRadius:12, padding:"12px 20px",
      display:"flex", alignItems:"center", gap:10,
      boxShadow:"0 8px 40px rgba(0,0,0,0.6)",
      backdropFilter:"blur(24px)",
      zIndex:600, whiteSpace:"nowrap",
      transition:"all 0.25s cubic-bezier(0.4,0,0.2,1)",
      maxWidth:"90vw",
    }}>
      <span style={{ fontSize:16 }}>{c.icon}</span>
      <span style={{ color:c.text, fontWeight:700, fontSize:13 }}>{msg}</span>
    </div>
  );
}
