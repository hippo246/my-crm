// ============================================================
// staff/tabs/StaffTab.js — v2 ENHANCED
// Dark glassmorphism revamp · enterprise MES styling
// FIX: removed dm === "dark" string comparison (t passed in from StaffUI)
// FIX: stale selected — lookup current member by id before clock actions
// FIX: clock bar bottom moved to avoid overlap with BottomNav on mobile
// FIX: ST(dm) called once, not repeatedly in render
// ENHANCED: glass stat cards · richer staff rows · premium clock bar
//           frosted detail sheet · glow avatars · animated status
// All logic, state, handlers 100% unchanged
// ============================================================

import React, { useState } from "react";
import { TAB_ACCENT } from "../theme.js";
import { SBtn, SSearch, SSheet, SAvatar, SPill } from "../components/ui.js";

const COLOR = TAB_ACCENT.staff.solid;
const GRAD  = TAB_ACCENT.staff.gradient;
const GLOW  = TAB_ACCENT.staff.glow;

const AVATAR_COLORS = ["#2563EB","#10B981","#8B5CF6","#F59E0B","#06b6d4","#EF4444","#14B8A6","#EC4899"];

export function StaffTab({ t, staffList = [], setStaffList, sess, notify = () => {} }) {
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState("all");
  const [selected, setSelected] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const safe = Array.isArray(staffList) ? staffList : [];

  const filtered = safe.filter(s => {
    if (!s) return false;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (s.name  || "").toLowerCase().includes(q) ||
      (s.role  || "").toLowerCase().includes(q) ||
      (s.shift || "").toLowerCase().includes(q);
    if (!matchSearch) return false;
    if (filter === "present") return !!s.present;
    if (filter === "absent")  return !s.present;
    return true;
  });

  const counts = {
    all:     safe.length,
    present: safe.filter(s => s.present).length,
    absent:  safe.filter(s => !s.present).length,
  };

  // FIX: always resolve latest state of member by id — avoids stale closure
  const getCurrentMember = (id) => safe.find(s => s.id === id);

  const clockIn = (memberId, e) => {
    e?.stopPropagation();
    const member = getCurrentMember(memberId);
    if (!member) return;
    const now = new Date().toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" });
    setStaffList(prev => (Array.isArray(prev) ? prev : []).map(s =>
      s.id === memberId ? { ...s, present:true, clockedIn:now } : s
    ));
    notify(`${member.name} clocked in at ${now}`, "success");
    setSheetOpen(false);
  };

  const clockOut = (memberId, e) => {
    e?.stopPropagation();
    const member = getCurrentMember(memberId);
    if (!member) return;
    setStaffList(prev => (Array.isArray(prev) ? prev : []).map(s =>
      s.id === memberId ? { ...s, present:false, clockedOut: new Date().toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}) } : s
    ));
    notify(`${member.name} clocked out`, "warning");
    setSheetOpen(false);
  };

  // My own record
  const myRecord = safe.find(s =>
    sess?.name && (s.name||"").toLowerCase() === (sess.name||"").toLowerCase()
  );

  return (
    <div style={{ background: t.bg, minHeight: "100vh", padding: "16px", maxWidth: 900, margin: "0 auto", paddingBottom: 110, animation: "fadeIn 0.3s ease" }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: `${COLOR}12`, border: `1px solid ${COLOR}28`,
          borderRadius: 7, padding: "4px 10px", marginBottom: 10,
        }}>
          <span style={{ fontSize: 10 }}>👥</span>
          <span style={{ color: COLOR, fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>STAFF</span>
        </div>
        <div style={{ color: t.text, fontSize: 24, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.1 }}>Team Management</div>
        <div style={{ color: t.sub, fontSize: 12, marginTop: 4 }}>Attendance & shift overview</div>
      </div>

      {/* ── Stats strip ────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Total Staff", value: counts.all,     color: t.blue,  icon: "👥", key: "all"     },
          { label: "On Shift",    value: counts.present, color: t.green, icon: "✅", key: "present" },
          { label: "Absent",      value: counts.absent,  color: t.red,   icon: "❌", key: "absent"  },
        ].map(s => (
          <div
            key={s.label}
            onClick={() => setFilter(s.key)}
            style={{
              background:    filter === s.key ? `${s.color}12` : "rgba(255,255,255,0.025)",
              border:        `1px solid ${filter === s.key ? s.color + "40" : "rgba(255,255,255,0.07)"}`,
              borderTop:     `2.5px solid ${s.color}`,
              borderRadius:  14, padding: "16px 16px 14px",
              backdropFilter: "blur(20px)",
              cursor:        "pointer", transition: "all 0.18s",
              boxShadow:     filter === s.key ? `0 0 28px ${s.color}18` : "none",
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ color: s.color, fontSize: 26, fontWeight: 900, lineHeight: 1 }}>{s.value}</div>
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: 700, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.07em" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <SSearch value={search} onChange={setSearch} placeholder="Search name, role, shift..." t={t} />
      <div style={{ height: 10 }} />

      {/* ── Filter pills ───────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 7, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { k: "all",     l: `All (${counts.all})`              },
          { k: "present", l: `✅ On Shift (${counts.present})`  },
          { k: "absent",  l: `❌ Absent (${counts.absent})`     },
        ].map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)} style={{
            padding:    "7px 14px", borderRadius: "999px",
            border:     filter !== f.k ? "1px solid rgba(255,255,255,0.08)" : "none",
            cursor:     "pointer", fontWeight: 600, fontSize: 12, transition: "all 0.15s",
            background: filter === f.k ? GRAD : "rgba(255,255,255,0.04)",
            color:      filter === f.k ? "#fff" : t.sub,
            boxShadow:  filter === f.k ? GLOW : "none",
            fontFamily: "inherit",
          }}>{f.l}</button>
        ))}
      </div>

      {/* ── Staff list ─────────────────────────────────────────── */}
      {safe.length === 0 ? (
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border:     "1px solid rgba(255,255,255,0.06)",
          borderRadius: 18, padding: "54px", textAlign: "center",
          backdropFilter: "blur(20px)",
        }}>
          <div style={{ fontSize: 44, marginBottom: 12, opacity: 0.3 }}>👥</div>
          <div style={{ color: t.text, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>No staff added yet</div>
          <div style={{ color: t.sub, fontSize: 13 }}>Staff members added by admin appear here</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border:     "1px solid rgba(255,255,255,0.06)",
          borderRadius: 14, padding: "22px", textAlign: "center", color: t.sub, fontSize: 13,
        }}>No staff match your filter</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {filtered.map((member, i) => {
            const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
            const statusColor = member.present ? t.green : t.red;
            return (
              <div
                key={member.id}
                onClick={() => { setSelected(member); setSheetOpen(true); }}
                style={{
                  background:    "rgba(255,255,255,0.025)",
                  border:        `1px solid rgba(255,255,255,0.07)`,
                  borderLeft:    `3px solid ${statusColor}`,
                  borderRadius:  14, padding: "14px 16px",
                  cursor:        "pointer", backdropFilter: "blur(20px)",
                  display:       "flex", alignItems: "center", gap: 14,
                  transition:    "all 0.15s",
                  boxShadow:     member.present ? `0 0 20px ${t.green}08` : "none",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.045)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.025)"; }}
              >
                {/* Avatar with glow ring for present staff */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <SAvatar name={member.name} size={44} color={avatarColor} />
                  {member.present && (
                    <div style={{
                      position: "absolute", bottom: 1, right: 1,
                      width: 10, height: 10, borderRadius: "50%",
                      background: t.green,
                      border: "2px solid rgba(10,14,28,1)",
                      boxShadow: `0 0 8px ${t.green}`,
                    }} />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: t.text, fontWeight: 800, fontSize: 15, marginBottom: 3 }}>{member.name}</div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
                    {member.role  && <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{member.role}</span>}
                    {member.shift && <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>· {member.shift}</span>}
                  </div>
                  {member.present && member.clockedIn && (
                    <div style={{ color: t.green, fontSize: 11, marginTop: 4, fontWeight: 700 }}>
                      ● Since {member.clockedIn}
                    </div>
                  )}
                  {!member.present && member.clockedOut && (
                    <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, marginTop: 4 }}>
                      Clocked out {member.clockedOut}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <SPill status={member.present ? "present" : "absent"} label={member.present ? "Present" : "Absent"} />
                  {member.present ? (
                    <SBtn v="ghost" color={t.red} onClick={e => clockOut(member.id, e)} sm>Clock Out</SBtn>
                  ) : (
                    <SBtn v="ghost" color={t.green} onClick={e => clockIn(member.id, e)} sm>Clock In</SBtn>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Detail sheet ───────────────────────────────────────── */}
      <SSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Staff Details" t={t}>
        {selected && (() => {
          // FIX: always read from current safe list, not stale selected snapshot
          const current = getCurrentMember(selected.id) || selected;
          const avatarColor = AVATAR_COLORS[safe.indexOf(current) % AVATAR_COLORS.length] || COLOR;
          return (
            <>
              {/* Profile header */}
              <div style={{
                background:   "rgba(255,255,255,0.04)",
                border:       `1px solid rgba(255,255,255,0.08)`,
                borderRadius: 14, padding: "18px 16px", marginBottom: 18,
                display:      "flex", alignItems: "center", gap: 16,
              }}>
                <div style={{ position: "relative" }}>
                  <SAvatar name={current.name} size={56} color={avatarColor} />
                  {current.present && (
                    <div style={{
                      position: "absolute", bottom: 2, right: 2,
                      width: 12, height: 12, borderRadius: "50%",
                      background: t.green, border: "2px solid rgba(10,14,28,1)",
                      boxShadow: `0 0 10px ${t.green}`,
                    }} />
                  )}
                </div>
                <div>
                  <div style={{ color: t.text, fontWeight: 900, fontSize: 19 }}>{current.name}</div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 3 }}>
                    {current.role || "—"} · {current.shift || "—"}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span style={{
                      background:   current.present ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                      border:       `1px solid ${current.present ? "rgba(16,185,129,0.28)" : "rgba(239,68,68,0.28)"}`,
                      color:        current.present ? "#34d399" : "#f87171",
                      borderRadius: 7, padding: "3px 10px", fontSize: 11, fontWeight: 700,
                    }}>{current.present ? "● On Shift" : "○ Absent"}</span>
                  </div>
                </div>
              </div>

              {/* Detail rows */}
              <div style={{
                background:   "rgba(255,255,255,0.03)",
                border:       "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12, padding: "4px 16px", marginBottom: 18,
              }}>
                {[
                  { label: "Status",      value: current.present ? "On Shift" : "Absent", color: current.present ? t.green : t.red },
                  { label: "Clocked In",  value: current.clockedIn  || "—", color: t.text },
                  { label: "Clocked Out", value: current.clockedOut || "—", color: t.text },
                  { label: "Shift",       value: current.shift      || "—", color: t.text },
                  { label: "Role",        value: current.role       || "—", color: t.text },
                ].map((row, idx, arr) => (
                  <div key={row.label} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "12px 0",
                    borderBottom: idx < arr.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                  }}>
                    <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>{row.label}</span>
                    <span style={{ color: row.color, fontSize: 13, fontWeight: 700 }}>{row.value}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                {current.present ? (
                  <SBtn v="danger" onClick={() => clockOut(current.id)} full>Clock Out</SBtn>
                ) : (
                  <SBtn v="success" onClick={() => clockIn(current.id)} full>Clock In</SBtn>
                )}
              </div>
            </>
          );
        })()}
      </SSheet>

      {/* ── My clock-in bar ────────────────────────────────────── */}
      {/* FIX: bottom:80px on mobile so it doesn't clash with BottomNav */}
      {myRecord && (
        <div style={{
          position:      "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          background:    "rgba(6,11,22,0.92)",
          border:        `1px solid ${myRecord.present ? "rgba(16,185,129,0.30)" : "rgba(239,68,68,0.28)"}`,
          borderRadius:  16, padding: "12px 20px",
          display:       "flex", alignItems: "center", gap: 16,
          boxShadow:     `0 8px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.05)`,
          backdropFilter: "blur(28px)",
          zIndex:        150, whiteSpace: "nowrap",
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
            background: myRecord.present ? t.green : t.red,
            boxShadow:  `0 0 10px ${myRecord.present ? t.green : t.red}`,
          }} />
          <div>
            <div style={{ color: myRecord.present ? "#34d399" : "#f87171", fontWeight: 700, fontSize: 12 }}>
              {myRecord.present ? `On shift since ${myRecord.clockedIn || "—"}` : "Not clocked in"}
            </div>
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 1 }}>
              {myRecord.role} · {myRecord.shift}
            </div>
          </div>
          <SBtn
            v={myRecord.present ? "danger" : "success"}
            onClick={() => myRecord.present ? clockOut(myRecord.id) : clockIn(myRecord.id)}
            sm
          >{myRecord.present ? "Clock Out" : "Clock In"}</SBtn>
        </div>
      )}
    </div>
  );
}
