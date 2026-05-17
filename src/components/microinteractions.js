/* eslint-disable react-hooks/exhaustive-deps */
// ============================================================
// components/microinteractions.js
// ─────────────────────────────────────────────────────────────
// #9 — UX Microinteractions
//
// Exports:
//   AnimatedCounter    — number that counts up/down smoothly
//   Skeleton           — shimmer loading placeholder
//   useOptimistic      — optimistic update hook with rollback
//   SlidePanel         — animated slide-up/down panel wrapper
//   FadeIn             — fade + translate-up entry animation
//   HoverCard          — card with lift + shadow on hover
//   InlineEdit         — click-to-edit text field
//   PulseIndicator     — live dot with pulse ring
//   ProgressBar        — smooth animated fill bar
//   Confetti           — lightweight success burst
//   useKeyboardNav     — keyboard navigation for lists
//   Toast              — animated toast notification
// ============================================================

import React, {
  useState, useEffect, useRef, useCallback,
  useMemo,
} from "react";

// ── Easing ──────────────────────────────────────────────────
function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

// ══════════════════════════════════════════════════════════════
// AnimatedCounter
// Smoothly counts from previous value to new value.
//
// Usage:
//   <AnimatedCounter value={1234} prefix="₹" duration={600} style={{...}} />
// ══════════════════════════════════════════════════════════════
export function AnimatedCounter({
  value = 0,
  prefix = "",
  suffix = "",
  duration = 700,
  format,
  style = {},
  decimals = 0,
}) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const rafRef = useRef(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;
    if (from === to) return;

    const startTime = performance.now();
    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutExpo(progress);
      const current = from + (to - from) * eased;
      setDisplay(current);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  const formatted = useMemo(() => {
    if (format) return format(display);
    return display.toFixed(decimals);
  }, [display, format, decimals]);

  return (
    <span style={{ display: "inline-block", tabularNums: "yes", fontVariantNumeric: "tabular-nums", ...style }}>
      {prefix}{formatted}{suffix}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════
// Skeleton — shimmer loading placeholders
//
// Usage:
//   <Skeleton width="60%" height={12} />
//   <Skeleton circle size={40} />
//   <Skeleton count={3} height={14} gap={8} />
// ══════════════════════════════════════════════════════════════
const SHIMMER_CSS = `
  @keyframes skeletonShimmer {
    0% { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
`;

let shimmerInjected = false;
function ensureShimmer() {
  if (shimmerInjected || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.textContent = SHIMMER_CSS;
  document.head.appendChild(style);
  shimmerInjected = true;
}

export function Skeleton({
  width = "100%",
  height = 12,
  borderRadius = 6,
  circle = false,
  size,
  count = 1,
  gap = 8,
  dm = true,
  style = {},
}) {
  ensureShimmer();

  const base = dm
    ? "rgba(255,255,255,0.06)"
    : "rgba(0,0,0,0.06)";
  const shimmer = dm
    ? "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0) 100%)"
    : "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.06) 50%, rgba(0,0,0,0) 100%)";

  const baseStyle = {
    background: base,
    backgroundImage: shimmer,
    backgroundSize: "800px 100%",
    backgroundRepeat: "no-repeat",
    animation: "skeletonShimmer 1.4s infinite ease-in-out",
    display: "block",
    ...style,
  };

  if (circle && size) {
    baseStyle.width = size;
    baseStyle.height = size;
    baseStyle.borderRadius = "50%";
  } else {
    baseStyle.width = width;
    baseStyle.height = height;
    baseStyle.borderRadius = borderRadius;
  }

  if (count === 1) return <span style={baseStyle} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} style={{ ...baseStyle, width: i === count - 1 && count > 1 ? "70%" : width }} />
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// useOptimistic — optimistic update hook with auto-rollback
//
// Usage:
//   const [items, updateOptimistic] = useOptimistic(deliveries);
//   // On action:
//   const rollback = updateOptimistic(id, { status: "Delivered" });
//   try { await saveToFirebase(...); }
//   catch { rollback(); notify("Save failed"); }
// ══════════════════════════════════════════════════════════════
export function useOptimistic(source) {
  const [items, setItems] = useState(source);

  // Sync when source changes from outside
  useEffect(() => { setItems(source); }, [source]);

  const updateOptimistic = useCallback((idOrFn, patchOrUndefined) => {
    const prev = items;

    if (typeof idOrFn === "function") {
      // Functional update: updateOptimistic(items => items.map(...))
      setItems(idOrFn);
    } else {
      // Patch by id: updateOptimistic(id, { field: newVal })
      setItems(arr =>
        Array.isArray(arr)
          ? arr.map(item => item.id === idOrFn ? { ...item, ...patchOrUndefined } : item)
          : arr
      );
    }

    // Return rollback function
    return () => setItems(prev);
  }, [items]);

  return [items, updateOptimistic];
}

// ══════════════════════════════════════════════════════════════
// SlidePanel — animated slide-up drawer
//
// Usage:
//   <SlidePanel open={sheetOpen} onClose={() => setSheetOpen(false)} title="Edit">
//     {children}
//   </SlidePanel>
// ══════════════════════════════════════════════════════════════
export function SlidePanel({
  open,
  onClose,
  title,
  children,
  t,
  maxWidth = 560,
  footer,
}) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 320);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!mounted) return null;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: visible ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0)",
        backdropFilter: visible ? "blur(8px)" : "none",
        WebkitBackdropFilter: visible ? "blur(8px)" : "none",
        transition: "background 0.25s, backdrop-filter 0.25s",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div style={{
        background: t?.card || "#1a2332",
        border: `1px solid ${t?.border || "rgba(255,255,255,0.08)"}`,
        borderRadius: "24px 24px 0 0",
        width: "100%",
        maxWidth,
        maxHeight: "92dvh",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 -8px 60px rgba(0,0,0,0.5)",
        transform: visible ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)",
        paddingBottom: "env(safe-area-inset-bottom, 12px)",
      }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
          <div style={{ width: 36, height: 4, borderRadius: 3, background: t?.border || "rgba(255,255,255,0.15)" }} />
        </div>

        {/* Header */}
        {title && (
          <div style={{
            padding: "14px 22px 12px",
            borderBottom: `1px solid ${t?.border || "rgba(255,255,255,0.08)"}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <p style={{ color: t?.text || "#f9fafb", fontWeight: 800, fontSize: 15 }}>{title}</p>
            <button onClick={onClose} style={{
              background: t?.inp || "rgba(255,255,255,0.06)", border: `1px solid ${t?.border || "rgba(255,255,255,0.08)"}`,
              color: t?.sub || "#9ca3af", width: 32, height: 32, borderRadius: 9,
              fontSize: 14, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>✕</button>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 22px 16px", minHeight: 0 }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            padding: "12px 22px",
            borderTop: `1px solid ${t?.border || "rgba(255,255,255,0.08)"}`,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// FadeIn — fade + slide-up on mount
//
// Usage:
//   <FadeIn delay={100}><MyComponent /></FadeIn>
// ══════════════════════════════════════════════════════════════
export function FadeIn({ children, delay = 0, duration = 300, distance = 12, style = {} }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : `translateY(${distance}px)`,
      transition: `opacity ${duration}ms ease, transform ${duration}ms ease`,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// HoverCard — card that lifts on hover
//
// Usage:
//   <HoverCard t={t} onClick={...}>{content}</HoverCard>
// ══════════════════════════════════════════════════════════════
export function HoverCard({
  children, t, onClick, style = {},
  liftY = 3, liftShadow = "0 8px 24px rgba(0,0,0,0.25)",
  borderRadius = 16,
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: t?.card || "#1a2332",
        border: `1px solid ${t?.border || "rgba(255,255,255,0.08)"}`,
        borderRadius,
        cursor: onClick ? "pointer" : "default",
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
        transform: hovered ? `translateY(-${liftY}px)` : "translateY(0)",
        boxShadow: hovered ? liftShadow : "0 1px 4px rgba(0,0,0,0.1)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// InlineEdit — click text to edit inline
//
// Usage:
//   <InlineEdit value={c.name} onSave={name => save(name)} t={t} />
// ══════════════════════════════════════════════════════════════
export function InlineEdit({
  value, onSave, t,
  placeholder = "Click to edit",
  textStyle = {},
  validate,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    if (validate && !validate(draft)) return;
    onSave?.(draft);
    setEditing(false);
  };

  if (!editing) {
    return (
      <span
        onClick={() => { setDraft(value); setEditing(true); }}
        title="Click to edit"
        style={{
          color: t?.text || "#f9fafb",
          cursor: "pointer",
          borderBottom: `1px dashed ${t?.border || "rgba(255,255,255,0.2)"}`,
          paddingBottom: 1,
          transition: "border-color 0.15s",
          ...textStyle,
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = (t?.sub || "#9ca3af")}
        onMouseLeave={e => e.currentTarget.style.borderColor = (t?.border || "rgba(255,255,255,0.2)")}
      >
        {value || <span style={{ color: t?.sub || "#6b7280" }}>{placeholder}</span>}
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setEditing(false); setDraft(value); } }}
        onBlur={commit}
        style={{
          background: t?.inp || "rgba(255,255,255,0.06)",
          border: `1.5px solid ${t?.border || "rgba(255,255,255,0.15)"}`,
          borderRadius: 6, color: t?.text || "#f9fafb",
          padding: "2px 7px", fontSize: "inherit",
          outline: "none", minWidth: 60,
          ...textStyle,
        }}
      />
    </span>
  );
}

// ══════════════════════════════════════════════════════════════
// PulseIndicator — live status dot
//
// Usage:
//   <PulseIndicator color="#10b981" label="Live" />
// ══════════════════════════════════════════════════════════════
const PULSE_CSS = `
  @keyframes micPulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.3); }
  }
`;
let pulseInjected = false;
function ensurePulse() {
  if (pulseInjected || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.textContent = PULSE_CSS;
  document.head.appendChild(style);
  pulseInjected = true;
}

export function PulseIndicator({ color = "#10b981", label, size = 8, style = {} }) {
  ensurePulse();
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, ...style }}>
      <span style={{
        width: size, height: size, borderRadius: "50%", background: color,
        boxShadow: `0 0 0 ${size / 2}px ${color}30`,
        animation: "micPulse 2s ease-in-out infinite",
        display: "inline-block", flexShrink: 0,
      }} />
      {label && <span style={{ color, fontSize: 10, fontWeight: 700 }}>{label}</span>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ProgressBar — smooth animated fill
//
// Usage:
//   <ProgressBar value={72} color="#10b981" t={t} label="Collection rate" />
// ══════════════════════════════════════════════════════════════
export function ProgressBar({
  value = 0,     // 0–100
  color = "#3b82f6",
  height = 6,
  t,
  label,
  showValue = false,
  animate = true,
  style = {},
}) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setWidth(Math.min(100, Math.max(0, value))), 80);
    return () => clearTimeout(id);
  }, [value]);

  return (
    <div style={style}>
      {(label || showValue) && (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          {label && <span style={{ color: t?.sub || "#9ca3af", fontSize: 10, fontWeight: 600 }}>{label}</span>}
          {showValue && <span style={{ color: color, fontSize: 10, fontWeight: 800 }}>{Math.round(value)}%</span>}
        </div>
      )}
      <div style={{ height, borderRadius: height, background: t?.border || "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: animate ? `${width}%` : `${value}%`,
          background: color,
          borderRadius: height,
          transition: animate ? "width 0.7s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
          backgroundImage: `linear-gradient(90deg, ${color}, ${color}cc)`,
        }} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Confetti — lightweight canvas burst on success
//
// Usage:
//   const { fire, ConfettiCanvas } = useConfetti();
//   fire();   // call this on success
//   <ConfettiCanvas />   // render anywhere near top level
// ══════════════════════════════════════════════════════════════
export function useConfetti() {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const rafRef = useRef(null);

  const fire = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.width = window.innerWidth;
    const H = canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d");

    const colors = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444", "#0ea5e9"];
    particlesRef.current = Array.from({ length: 80 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * 200,
      y: H * 0.4,
      vx: (Math.random() - 0.5) * 12,
      vy: -(Math.random() * 8 + 4),
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 6 + 3,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 8,
      life: 1,
    }));

    const animate = () => {
      ctx.clearRect(0, 0, W, H);
      particlesRef.current = particlesRef.current.filter(p => p.life > 0.01);
      particlesRef.current.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.35; p.rotation += p.rotSpeed; p.life *= 0.96;
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
        ctx.restore();
      });
      if (particlesRef.current.length > 0) rafRef.current = requestAnimationFrame(animate);
    };

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  const ConfettiCanvas = useCallback(() => (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999 }}
    />
  ), []);

  return { fire, ConfettiCanvas };
}

// ══════════════════════════════════════════════════════════════
// useKeyboardNav — arrow key navigation for a list
//
// Usage:
//   const { selectedIdx, onKeyDown, refs } = useKeyboardNav({ count: items.length, onSelect: i => open(items[i]) });
//   <div tabIndex={0} onKeyDown={onKeyDown}>
//     {items.map((item, i) => <div key={i} ref={refs[i]}>{item}</div>)}
//   </div>
// ══════════════════════════════════════════════════════════════
export function useKeyboardNav({ count, onSelect, loop = true }) {
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const refs = useRef([]);

  const onKeyDown = useCallback(e => {
    if (count === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx(i => {
        const next = i < count - 1 ? i + 1 : loop ? 0 : i;
        refs.current[next]?.scrollIntoView?.({ block: "nearest" });
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx(i => {
        const next = i > 0 ? i - 1 : loop ? count - 1 : i;
        refs.current[next]?.scrollIntoView?.({ block: "nearest" });
        return next;
      });
    } else if ((e.key === "Enter" || e.key === " ") && selectedIdx >= 0) {
      e.preventDefault();
      onSelect?.(selectedIdx);
    } else if (e.key === "Escape") {
      setSelectedIdx(-1);
    }
  }, [count, selectedIdx, onSelect, loop]);

  const setRef = useCallback(i => el => { refs.current[i] = el; }, []);

  return { selectedIdx, setSelectedIdx, onKeyDown, setRef };
}

// ══════════════════════════════════════════════════════════════
// AnimatedToast — toast notification with slide + auto-dismiss
//
// Usage:
//   const { toasts, showToast } = useToast();
//   showToast("Saved ✓", "success");
//   <ToastContainer toasts={toasts} />
// ══════════════════════════════════════════════════════════════
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const showToast = useCallback((message, type = "info", duration = 3000) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, message, type, visible: true }]);
    setTimeout(() => {
      setToasts(t => t.map(toast => toast.id === id ? { ...toast, visible: false } : toast));
      setTimeout(() => setToasts(t => t.filter(toast => toast.id !== id)), 320);
    }, duration);
  }, []);
  return { toasts, showToast };
}

const TOAST_COLORS = {
  success: { bg: "#10b981", icon: "✓" },
  error:   { bg: "#ef4444", icon: "✕" },
  info:    { bg: "#3b82f6", icon: "ℹ" },
  warning: { bg: "#f59e0b", icon: "⚠" },
};

export function ToastContainer({ toasts = [] }) {
  return (
    <div style={{
      position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
      display: "flex", flexDirection: "column", gap: 8, zIndex: 9998,
      pointerEvents: "none", alignItems: "center",
    }}>
      {toasts.map(toast => {
        const { bg, icon } = TOAST_COLORS[toast.type] || TOAST_COLORS.info;
        return (
          <div key={toast.id} style={{
            background: bg, color: "#fff",
            borderRadius: 12, padding: "10px 18px",
            fontSize: 13, fontWeight: 700,
            display: "flex", alignItems: "center", gap: 8,
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            transform: toast.visible ? "translateY(0) scale(1)" : "translateY(16px) scale(0.95)",
            opacity: toast.visible ? 1 : 0,
            transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
            whiteSpace: "nowrap",
          }}>
            <span style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, flexShrink: 0 }}>{icon}</span>
            {toast.message}
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// LoadingState — full skeleton dashboard placeholder
//
// Usage: if (!dataLoaded) return <LoadingState t={t} dm={dm} />;
// ══════════════════════════════════════════════════════════════
export function LoadingState({ t, dm }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(300px,100%),1fr))", gap: 14 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <FadeIn key={i} delay={i * 60}>
          <div style={{
            background: t?.card || "#1a2332",
            border: `1px solid ${t?.border || "rgba(255,255,255,0.08)"}`,
            borderRadius: 20, padding: 18, overflow: "hidden",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Skeleton circle size={28} dm={dm} />
              <Skeleton width="45%" height={10} dm={dm} />
            </div>
            <Skeleton width="100%" height={10} dm={dm} style={{ marginBottom: 8 }} />
            <Skeleton width="80%" height={10} dm={dm} style={{ marginBottom: 8 }} />
            <Skeleton width="60%" height={10} dm={dm} />
          </div>
        </FadeIn>
      ))}
    </div>
  );
}
