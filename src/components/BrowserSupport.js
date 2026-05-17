/**
 * BrowserSupport.js
 *
 * Cross-browser compatibility layer for the CRM.
 * Handles:
 *   1. Feature detection + unsupported browser banner
 *   2. CSS custom property fallbacks (IE/old Edge)
 *   3. Optional chaining + nullish coalescing polyfill check
 *   4. Clipboard API fallback (document.execCommand)
 *   5. structuredClone fallback (Safari < 15.4, Firefox < 94)
 *   6. ResizeObserver fallback (IE11)
 *   7. IntersectionObserver polyfill warning
 *   8. iOS safe-area env() fallback
 *   9. scroll-behavior: smooth fallback
 *  10. useBrowserInfo hook — gives components browser/OS/feature info
 *  11. <BrowserBanner /> — shown once if browser is unsupported
 *  12. <SafeAreaProvider /> — provides safe-area values as JS for non-CSS env() support
 *
 * Wiring into CRM (index.js or App.js):
 *   import { initBrowserSupport, BrowserBanner } from "./components/BrowserSupport";
 *   // Call once at app startup (before React renders):
 *   initBrowserSupport();
 *   // In your root App component:
 *   <BrowserBanner dm={dm} />
 *
 * Optional — in CRM.js body:
 *   import { useBrowserInfo } from "./components/BrowserSupport";
 *   const browser = useBrowserInfo();
 *   // browser.isIOS, browser.isSafari, browser.isFirefox, browser.isChrome
 *   // browser.supportsWebP, browser.supportsHover, browser.isTouchDevice
 */

import React, { useState, useEffect, useCallback } from "react";

// ── 1. FEATURE DETECTION ──────────────────────────────────────

export function detectBrowser() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS        = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isAndroid    = /Android/.test(ua);
  const isSafari     = /^((?!chrome|android).)*safari/i.test(ua);
  const isChrome     = /Chrome/.test(ua) && /Google Inc/.test(navigator.vendor || "");
  const isFirefox    = /Firefox/.test(ua);
  const isEdge       = /Edg\//.test(ua);
  const isSamsung    = /SamsungBrowser/.test(ua);
  const isUCBrowser  = /UCBrowser/.test(ua);
  const isOpera      = /OPR\//.test(ua);
  const isMobile     = /Mobi|Android|iPhone|iPad/i.test(ua);
  const isTablet     = /iPad/.test(ua) || (isAndroid && !/Mobile/.test(ua));
  const isTouchDevice= typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
  const supportsHover= typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;

  // iOS Safari version (for safe-area, dvh, etc.)
  let iosMajor = 0;
  const iosMatch = ua.match(/OS (\d+)_/);
  if (iosMatch) iosMajor = parseInt(iosMatch[1], 10);

  // Chrome version
  let chromeMajor = 0;
  const chromeMatch = ua.match(/Chrome\/(\d+)/);
  if (chromeMatch) chromeMajor = parseInt(chromeMatch[1], 10);

  // Firefox version
  let ffMajor = 0;
  const ffMatch = ua.match(/Firefox\/(\d+)/);
  if (ffMatch) ffMajor = parseInt(ffMatch[1], 10);

  // Feature support
  const supportsWebP = (() => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      return canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0;
    } catch { return false; }
  })();

  const supportsCSSVars     = typeof window !== "undefined" && window.CSS && window.CSS.supports && window.CSS.supports("color", "var(--test)");
  const supportsGrid        = typeof window !== "undefined" && window.CSS && window.CSS.supports && window.CSS.supports("display", "grid");
  const supportsFlexGap     = typeof window !== "undefined" && checkFlexGap();
  const supportsBackdropFilter = typeof window !== "undefined" && (
    window.CSS?.supports?.("backdrop-filter", "blur(1px)") ||
    window.CSS?.supports?.("-webkit-backdrop-filter", "blur(1px)")
  );
  const supportsStructuredClone = typeof structuredClone === "function";
  const supportsClipboard   = typeof navigator !== "undefined" && !!navigator.clipboard;
  const supportsResizeObserver = typeof ResizeObserver !== "undefined";
  const supportsIntersectionObserver = typeof IntersectionObserver !== "undefined";
  const supportsDVH         = typeof window !== "undefined" && window.CSS?.supports?.("height", "1dvh");

  // Minimum supported: Chrome 90+, Firefox 90+, Safari 14+, Edge 90+
  const isUnsupported = (
    (isChrome && chromeMajor > 0 && chromeMajor < 90) ||
    (isFirefox && ffMajor > 0 && ffMajor < 90) ||
    (isIOS && iosMajor > 0 && iosMajor < 14) ||
    isUCBrowser
  );

  return {
    ua, isIOS, isAndroid, isSafari, isChrome, isFirefox, isEdge,
    isSamsung, isOpera, isMobile, isTablet, isTouchDevice, supportsHover,
    iosMajor, chromeMajor, ffMajor,
    supportsWebP, supportsCSSVars, supportsGrid, supportsFlexGap,
    supportsBackdropFilter, supportsStructuredClone, supportsClipboard,
    supportsResizeObserver, supportsIntersectionObserver, supportsDVH,
    isUnsupported,
  };
}

// Flex gap support check (not supported in Safari < 14.1)
function checkFlexGap() {
  try {
    const flex = document.createElement("div");
    flex.style.cssText = "display:flex;flex-direction:column;row-gap:1px;position:absolute;visibility:hidden;";
    flex.appendChild(document.createElement("div"));
    flex.appendChild(document.createElement("div"));
    document.body.appendChild(flex);
    const supported = flex.scrollHeight === 1;
    document.body.removeChild(flex);
    return supported;
  } catch { return true; }
}

// ── 2. GLOBAL POLYFILLS ───────────────────────────────────────

export function initBrowserSupport() {
  if (typeof window === "undefined") return;

  // structuredClone polyfill (Safari < 15.4, Firefox < 94)
  if (typeof structuredClone === "undefined") {
    window.structuredClone = function(obj) {
      return JSON.parse(JSON.stringify(obj));
    };
  }

  // ResizeObserver stub (prevents crash, doesn't provide functionality)
  if (typeof ResizeObserver === "undefined") {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  // IntersectionObserver stub
  if (typeof IntersectionObserver === "undefined") {
    window.IntersectionObserver = class IntersectionObserver {
      constructor(cb) { this._cb = cb; }
      observe(el) { this._cb([{ target: el, isIntersecting: true }]); }
      unobserve() {}
      disconnect() {}
    };
  }

  // requestIdleCallback (Safari < 15.2)
  if (typeof window.requestIdleCallback === "undefined") {
    window.requestIdleCallback = function(cb, opts) {
      return setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 16 }), opts?.timeout || 16);
    };
    window.cancelIdleCallback = (id) => clearTimeout(id);
  }

  // Object.hasOwn (Node < 16.9, older browsers)
  if (!Object.hasOwn) {
    Object.hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  }

  // Array.at (Safari < 15.4)
  if (!Array.prototype.at) {
    // eslint-disable-next-line no-extend-native
    Array.prototype.at = function(index) {
      return index >= 0 ? this[index] : this[this.length + index];
    };
  }

  // String.at
  if (!String.prototype.at) {
    // eslint-disable-next-line no-extend-native
    String.prototype.at = function(index) {
      return index >= 0 ? this[index] : this[this.length + index];
    };
  }

  // CSS env() safe-area fallback for browsers that don't support it
  applySafeAreaFallback();

  // Smooth scroll polyfill for Safari < 15.4
  applySmoothScrollFallback();

  // Flex gap fallback — add body class for CSS targeting
  if (!checkFlexGap()) {
    document.body.classList.add("no-flex-gap");
  }

  // Backdrop-filter fallback class
  if (!window.CSS?.supports?.("backdrop-filter", "blur(1px)") &&
      !window.CSS?.supports?.("-webkit-backdrop-filter", "blur(1px)")) {
    document.body.classList.add("no-backdrop-filter");
  }

  console.log("[BrowserSupport] Polyfills applied.");
}

// ── 3. SAFE-AREA FALLBACK ─────────────────────────────────────

function applySafeAreaFallback() {
  // Check if env() is supported
  const supported = window.CSS?.supports?.("padding-top", "env(safe-area-inset-top)");
  if (supported) return;
  // Inject CSS fallback — zero safe areas for non-iOS
  const style = document.createElement("style");
  style.id = "safe-area-fallback";
  style.textContent = `
    :root {
      --safe-area-inset-top: 0px;
      --safe-area-inset-bottom: 0px;
      --safe-area-inset-left: 0px;
      --safe-area-inset-right: 0px;
    }
  `;
  document.head.appendChild(style);
}

// ── 4. SMOOTH SCROLL FALLBACK ─────────────────────────────────

function applySmoothScrollFallback() {
  if ("scrollBehavior" in document.documentElement.style) return;
  // Polyfill window.scrollTo for smooth behavior
  const _scrollTo = window.scrollTo.bind(window);
  window.scrollTo = function(xOrOpts, y) {
    if (typeof xOrOpts === "object" && xOrOpts.behavior === "smooth") {
      const target = xOrOpts.top || 0;
      const duration = 400;
      const start = window.scrollY;
      const diff = target - start;
      let startTime = null;
      function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
        window.scrollY !== undefined
          ? _scrollTo(0, start + diff * ease)
          : _scrollTo(0, start + diff * ease);
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    } else {
      _scrollTo(xOrOpts, y);
    }
  };
}

// ── 5. CLIPBOARD HELPER ───────────────────────────────────────

/**
 * Cross-browser clipboard copy.
 * Falls back to document.execCommand for browsers without Clipboard API.
 */
export async function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch { /* fall through */ }
  }
  // Fallback
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch { return false; }
}

// ── 6. useBrowserInfo HOOK ────────────────────────────────────

let _cachedBrowserInfo = null;

export function useBrowserInfo() {
  const [info, setInfo] = useState(() => {
    if (typeof window === "undefined") return {};
    if (!_cachedBrowserInfo) _cachedBrowserInfo = detectBrowser();
    return _cachedBrowserInfo;
  });

  useEffect(() => {
    if (!_cachedBrowserInfo) {
      _cachedBrowserInfo = detectBrowser();
      setInfo(_cachedBrowserInfo);
    }
  }, []);

  return info;
}

// ── 7. BrowserBanner COMPONENT ───────────────────────────────

const DISMISSED_KEY = "crm_browser_banner_dismissed";

export function BrowserBanner({ dm }) {
  const [visible, setVisible] = useState(false);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = sessionStorage.getItem(DISMISSED_KEY);
    if (dismissed) return;
    const detected = detectBrowser();
    if (detected.isUnsupported) {
      setInfo(detected);
      setVisible(true);
    }
  }, []);

  const dismiss = useCallback(() => {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }, []);

  if (!visible || !info) return null;

  const bg     = dm ? "#1e1a00" : "#fffbeb";
  const border = dm ? "#92400e" : "#f59e0b";
  const text   = dm ? "#fcd34d" : "#92400e";
  const sub    = dm ? "#d97706" : "#b45309";

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 99999,
      background: bg, borderBottom: `2px solid ${border}`,
      padding: "12px 16px",
      display: "flex", alignItems: "center", gap: 12,
      boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
      <div style={{ flex: 1 }}>
        <p style={{ color: text, fontWeight: 700, fontSize: 13 }}>
          Your browser may not be fully supported
        </p>
        <p style={{ color: sub, fontSize: 11, marginTop: 2 }}>
          For the best experience, use Chrome 90+, Firefox 90+, Safari 14+, or Edge 90+.
        </p>
      </div>
      <button onClick={dismiss} style={{
        background: "transparent", border: `1px solid ${border}`,
        color: text, borderRadius: 8, padding: "6px 14px",
        fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0,
        WebkitTapHighlightColor: "transparent",
      }}>
        Got it
      </button>
    </div>
  );
}

// ── 8. SafeAreaProvider ───────────────────────────────────────

/**
 * Provides safe-area inset values as a JS context for components
 * that need them as numbers (e.g. for canvas or absolute positioning).
 * Not needed if you use CSS env() directly.
 */
export const SafeAreaContext = React.createContext({
  top: 0, bottom: 0, left: 0, right: 0,
});

export function SafeAreaProvider({ children }) {
  const [insets, setInsets] = useState({ top: 0, bottom: 0, left: 0, right: 0 });

  useEffect(() => {
    // Read CSS env() values via a temporary element
    try {
      const el = document.createElement("div");
      el.style.cssText = [
        "position:fixed", "top:0", "left:0", "width:1px", "height:1px",
        "padding-top:env(safe-area-inset-top,0px)",
        "padding-bottom:env(safe-area-inset-bottom,0px)",
        "padding-left:env(safe-area-inset-left,0px)",
        "padding-right:env(safe-area-inset-right,0px)",
        "visibility:hidden", "pointer-events:none",
      ].join(";");
      document.body.appendChild(el);
      const cs = getComputedStyle(el);
      setInsets({
        top:    parseFloat(cs.paddingTop)    || 0,
        bottom: parseFloat(cs.paddingBottom) || 0,
        left:   parseFloat(cs.paddingLeft)   || 0,
        right:  parseFloat(cs.paddingRight)  || 0,
      });
      document.body.removeChild(el);
    } catch { /* ignore */ }
  }, []);

  return (
    <SafeAreaContext.Provider value={insets}>
      {children}
    </SafeAreaContext.Provider>
  );
}

// ── 9. CSS INJECTION for browser-specific fixes ───────────────

export function injectBrowserCSS() {
  if (typeof document === "undefined") return;
  const id = "crm-browser-css";
  if (document.getElementById(id)) return;

  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    /* Flex gap fallback for Safari < 14.1 */
    .no-flex-gap .flex-gap-2 > * + * { margin-left: 8px; }
    .no-flex-gap .flex-gap-3 > * + * { margin-left: 12px; }
    .no-flex-gap .flex-gap-4 > * + * { margin-left: 16px; }

    /* Backdrop filter fallback — solid bg instead of blur */
    .no-backdrop-filter [style*="backdrop-filter"],
    .no-backdrop-filter [style*="-webkit-backdrop-filter"] {
      background: rgba(15, 23, 42, 0.95) !important;
    }

    /* iOS tap highlight removal globally */
    * { -webkit-tap-highlight-color: transparent; }

    /* Prevent font size inflation on iOS */
    html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }

    /* Smooth font rendering on macOS/iOS */
    body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }

    /* Better scrolling on iOS */
    .scroll-touch { -webkit-overflow-scrolling: touch; }

    /* Fix position:fixed inside transforms (Chrome/Firefox bug) */
    .no-transform-fixed { transform: none !important; }

    /* Prevent overscroll bounce on iOS body */
    html, body { overscroll-behavior: none; }

    /* Safe-area padding helpers */
    .pb-safe { padding-bottom: env(safe-area-inset-bottom, 0px); }
    .pt-safe { padding-top: env(safe-area-inset-top, 0px); }
    .mb-safe { margin-bottom: env(safe-area-inset-bottom, 0px); }

    /* Hide scrollbar cross-browser */
    .hide-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
    .hide-scrollbar::-webkit-scrollbar { display: none; }

    /* Firefox button normalization */
    button::-moz-focus-inner { border: 0; padding: 0; }

    /* IE/Edge input[type=number] spinner removal */
    input[type=number]::-webkit-inner-spin-button,
    input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    input[type=number] { -moz-appearance: textfield; }

    /* Date input appearance normalization */
    input[type=date]::-webkit-calendar-picker-indicator { opacity: 0.5; cursor: pointer; }

    /* Select appearance normalization */
    select { -webkit-appearance: none; -moz-appearance: none; appearance: none; }

    /* Focus visible for keyboard nav */
    :focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
    :focus:not(:focus-visible) { outline: none; }
  `;
  document.head.appendChild(style);
}

export default BrowserBanner;
