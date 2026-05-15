// ============================================================
// staff/tabs/Settings.js — v2 ENHANCED
// STAFF VIEW (Read-Only) · Simple profile view only
// All editing done by admin — NO edit buttons, NO toggles, NO forms
// ENHANCED: glassmorphism profile card · premium avatar glow
//           frosted info rows · enterprise logout button
// All logic, props 100% unchanged
// ============================================================

import React from "react";
import { TAB_ACCENT } from "../theme.js";
import { SAvatar, SPill } from "../components/ui.js";

const COLOR = TAB_ACCENT.settings.solid;

function InfoRow({ label, value, color, t }) {
  return (
    <div style={{
      display:      "flex",
      justifyContent: "space-between",
      alignItems:   "center",
      padding:      "13px 0",
      borderBottom: `1px solid rgba(255,255,255,0.06)`,
    }}>
      <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>{label}</span>
      <span style={{ color: color || t.text, fontSize: 13, fontWeight: 700 }}>{value || "—"}</span>
    </div>
  );
}

export function SettingsTab({ t, sess, onLogout }) {
  return (
    <div style={{
      background: t.bg, minHeight: "100vh",
      padding:    "24px 18px 60px",
      maxWidth:   480, margin: "0 auto",
      animation:  "fadeIn 0.3s ease",
    }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: `${COLOR}12`, border: `1px solid ${COLOR}28`,
          borderRadius: 7, padding: "4px 10px", marginBottom: 10,
        }}>
          <span style={{ fontSize: 10 }}>⚙️</span>
          <span style={{ color: COLOR, fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>ACCOUNT</span>
        </div>
        <div style={{ color: t.text, fontSize: 24, fontWeight: 900, letterSpacing: "-0.03em" }}>My Profile</div>
        <div style={{ color: t.sub, fontSize: 12, marginTop: 4 }}>Your details are managed by admin</div>
      </div>

      {/* ── Avatar + name card ─────────────────────────────────── */}
      <div style={{
        background:    "rgba(255,255,255,0.03)",
        border:        "1px solid rgba(255,255,255,0.08)",
        borderRadius:  18, padding: "26px 22px",
        display:       "flex", alignItems: "center", gap: 20,
        marginBottom:  14,
        backdropFilter: "blur(24px)",
        boxShadow:     `0 0 48px ${COLOR}0c, inset 0 1px 0 rgba(255,255,255,0.05)`,
        position:      "relative", overflow: "hidden",
      }}>
        {/* Ambient glow */}
        <div style={{
          position: "absolute", right: -40, top: -40,
          width: 180, height: 180, borderRadius: "50%",
          background: `radial-gradient(circle,${COLOR}12 0%,transparent 65%)`,
          pointerEvents: "none",
        }} />

        <div style={{
          flexShrink: 0,
          boxShadow:  `0 0 28px ${COLOR}40`,
          borderRadius: "50%",
        }}>
          <SAvatar name={sess?.name || "?"} size={64} color={COLOR} />
        </div>

        <div style={{ position: "relative" }}>
          <div style={{ color: t.text, fontWeight: 900, fontSize: 21, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            {sess?.name || "Staff"}
          </div>
          <div style={{ marginTop: 9, display: "flex", gap: 7, flexWrap: "wrap" }}>
            <SPill status="active" label={sess?.role || "Worker"} />
            {sess?.shift && (
              <div style={{
                background:   "rgba(16,185,129,0.10)",
                border:       "1px solid rgba(16,185,129,0.22)",
                borderRadius: 7, padding: "3px 10px",
                color: "#34d399", fontSize: 11, fontWeight: 700,
              }}>{sess.shift}</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Details card ───────────────────────────────────────── */}
      <div style={{
        background:    "rgba(255,255,255,0.025)",
        border:        "1px solid rgba(255,255,255,0.07)",
        borderRadius:  16, padding: "4px 18px",
        marginBottom:  14,
        backdropFilter: "blur(20px)",
        boxShadow:     "0 4px 24px rgba(0,0,0,0.25)",
      }}>
        <InfoRow label="Full Name"   value={sess?.name}       t={t} />
        <InfoRow label="Role"        value={sess?.role}       t={t} color={COLOR} />
        <InfoRow label="Shift"       value={sess?.shift}      t={t} color="#34d399" />
        <InfoRow label="Department"  value={sess?.department} t={t} />
        <InfoRow label="Employee ID" value={sess?.id}         t={t} />
      </div>

      {/* ── Info notice ────────────────────────────────────────── */}
      <div style={{
        background:   "rgba(139,92,246,0.07)",
        border:       "1px solid rgba(139,92,246,0.20)",
        borderRadius: 12, padding: "13px 16px", marginBottom: 26,
        display:      "flex", alignItems: "flex-start", gap: 11,
      }}>
        <span style={{ fontSize: 16, marginTop: 1, flexShrink: 0 }}>ℹ️</span>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, lineHeight: 1.6 }}>
          To update your profile, role, or shift, contact your admin or manager.
        </div>
      </div>

      {/* ── Logout ─────────────────────────────────────────────── */}
      <button
        onClick={onLogout}
        style={{
          width:      "100%", padding: "15px", borderRadius: 13, border: "none",
          background: "rgba(239,68,68,0.08)",
          color:      "#ef4444",
          cursor:     "pointer", fontWeight: 800, fontSize: 14,
          fontFamily: "inherit", letterSpacing: "0.02em",
          transition: "all 0.18s",
          boxShadow:  "inset 0 1px 0 rgba(255,255,255,0.04)",
          outline:    "1px solid rgba(239,68,68,0.18)",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.16)"; e.currentTarget.style.boxShadow = "0 0 24px rgba(239,68,68,0.20), inset 0 1px 0 rgba(255,255,255,0.04)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.04)"; }}
      >
        ← Log Out
      </button>

    </div>
  );
}
