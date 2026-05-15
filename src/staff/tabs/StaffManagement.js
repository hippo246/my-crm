// ============================================================
// staff/tabs/StaffManagement.js — v2 Responsive
// Employee cards · attendance · shift management · roles · activity logs
// NOTE: This is the ADMIN/MANAGER view. StaffTab.js is the worker self-clock-in view.
// ============================================================

import React, { useState, useMemo, useEffect } from "react";
import { TAB_ACCENT } from "../theme.js";
import { SBtn, SSheet, SAvatar, SPill, SSearch } from "../components/ui.js";
import { hasPerm } from "../../lib/roles.js";

const COLOR = TAB_ACCENT.staff.solid;
const GRAD  = TAB_ACCENT.staff.gradient;
const GLOW  = TAB_ACCENT.staff.glow;

const AVATAR_COLORS = ["#2563EB","#10B981","#8B5CF6","#F59E0B","#06b6d4","#EF4444","#14B8A6","#EC4899"];
const DEFAULT_SHIFTS = ["Morning (6AM-2PM)", "Afternoon (2PM-10PM)", "Night (10PM-6AM)"];
const DEFAULT_ROLES  = ["Worker", "Packer", "QC Inspector", "Delivery", "Supervisor", "Manager"];

// ── Responsive hook ──────────────────────────────────────────
function useIsMobile(bp = 600) {
  const [mobile, setMobile] = useState(() => window.innerWidth < bp);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < bp);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [bp]);
  return mobile;
}

// ── Stat tile ───────────────────────────────────────────────
function StatTile({ icon, label, value, color, t }) {
  return (
    <div style={{
      background: t.card, border: `1px solid ${t.border2}`,
      borderTop: `2px solid ${color}`,
      borderRadius: 12, padding: "14px 16px",
      backdropFilter: "blur(20px)",
    }}>
      <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
      <div style={{ color, fontSize: 24, fontWeight: 900, lineHeight: 1 }}>{value}</div>
      <div style={{ color: t.muted, fontSize: 10, fontWeight: 700, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</div>
    </div>
  );
}

// ── Employee card (grid mode) ────────────────────────────────
function EmployeeCard({ member, index, onOpen, t }) {
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const attendancePct = member.daysWorked && member.totalDays
    ? Math.round((member.daysWorked / member.totalDays) * 100) : 0;
  const sc = member.present ? "#10B981" : "#ef4444";

  return (
    <div
      onClick={() => onOpen(member)}
      style={{
        background: t.card, border: `1px solid ${t.border2}`,
        borderRadius: 14, padding: "18px",
        cursor: "pointer", transition: "all 0.18s",
        backdropFilter: "blur(20px)",
        position: "relative", overflow: "hidden",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = t.cardHov; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 32px rgba(0,0,0,0.4)`; }}
      onMouseLeave={e => { e.currentTarget.style.background = t.card; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{
        position: "absolute", top: 0, right: 0,
        width: 60, height: 60,
        background: `radial-gradient(circle, ${sc}15 0%, transparent 70%)`,
        borderRadius: "0 14px 0 0", pointerEvents: "none",
      }} />

      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div style={{ position: "relative" }}>
          <SAvatar name={member.name} size={44} color={color} />
          <div style={{
            position: "absolute", bottom: 0, right: 0,
            width: 10, height: 10, borderRadius: "50%",
            background: sc, border: `2px solid ${t.card}`,
            boxShadow: `0 0 6px ${sc}`,
          }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: t.text, fontWeight: 800, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.name}</div>
          <div style={{ color: t.sub, fontSize: 11, marginTop: 2 }}>{member.role || "Worker"}</div>
        </div>
        <SPill status={member.present ? "present" : "absent"} label={member.present ? "On Shift" : "Absent"} />
      </div>

      <div style={{ display: "flex", gap: 7, marginBottom: 14, flexWrap: "wrap" }}>
        {member.shift && (
          <div style={{
            background: `${color}12`, border: `1px solid ${color}22`,
            borderRadius: 7, padding: "3px 9px",
            color, fontSize: 10, fontWeight: 700,
          }}>⏰ {member.shift.split("(")[0].trim()}</div>
        )}
        {member.id && (
          <div style={{
            background: t.cardAlt, border: `1px solid ${t.border}`,
            borderRadius: 7, padding: "3px 9px",
            color: t.muted, fontSize: 10, fontWeight: 600,
          }}>ID: {member.id?.slice(-6) || "—"}</div>
        )}
      </div>

      {member.daysWorked !== undefined && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ color: t.muted, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Attendance</span>
            <span style={{ color: attendancePct >= 80 ? "#10B981" : attendancePct >= 60 ? "#F59E0B" : "#ef4444", fontSize: 10, fontWeight: 800 }}>{attendancePct}%</span>
          </div>
          <div style={{ height: 4, background: t.border, borderRadius: 999, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${attendancePct}%`,
              background: attendancePct >= 80 ? "#10B981" : attendancePct >= 60 ? "#F59E0B" : "#ef4444",
              borderRadius: 999,
              boxShadow: `0 0 8px ${attendancePct >= 80 ? "#10B981" : "#F59E0B"}50`,
              transition: "width 0.6s ease",
            }} />
          </div>
          <div style={{ color: t.muted, fontSize: 9, marginTop: 4 }}>{member.daysWorked || 0}/{member.totalDays || 26} days</div>
        </div>
      )}

      {member.present && member.clockedIn && (
        <div style={{
          marginTop: 12, padding: "7px 10px",
          background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.18)",
          borderRadius: 8, color: "#10B981", fontSize: 10, fontWeight: 700,
        }}>● Since {member.clockedIn}</div>
      )}
    </div>
  );
}

// ── Employee row (table mode) ────────────────────────────────
function EmployeeRow({ member, index, onOpen, onClock, t }) {
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  return (
    <div
      onClick={() => onOpen(member)}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "12px 16px",
        background: t.card, border: `1px solid ${t.border2}`,
        borderLeft: `3px solid ${member.present ? "#10B981" : "#ef4444"}`,
        borderRadius: 11, cursor: "pointer", transition: "all 0.15s",
      }}
      onMouseEnter={e => e.currentTarget.style.background = t.cardHov}
      onMouseLeave={e => e.currentTarget.style.background = t.card}
    >
      <SAvatar name={member.name} size={38} color={color} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: t.text, fontWeight: 700, fontSize: 13 }}>{member.name}</div>
        <div style={{ color: t.sub, fontSize: 11 }}>{member.role} · {member.shift?.split("(")[0].trim() || "—"}</div>
      </div>
      <SPill status={member.present ? "present" : "absent"} label={member.present ? "Present" : "Absent"} />
      <div style={{ color: t.muted, fontSize: 11, width: 70, textAlign: "right" }}>
        {member.present ? member.clockedIn || "—" : member.clockedOut || "—"}
      </div>
      <SBtn
        v="ghost"
        color={member.present ? "#ef4444" : "#10B981"}
        sm
        onClick={e => { e.stopPropagation(); onClock(member); }}
      >{member.present ? "Clock Out" : "Clock In"}</SBtn>
    </div>
  );
}

export function StaffManagementTab({ t, staffList = [], setStaffList, sess, notify = () => {}, settings = {} }) {
  const SHIFTS = (settings.shifts?.length ? settings.shifts : DEFAULT_SHIFTS);
  const ROLES  = (settings.staffRoles?.length ? settings.staffRoles : DEFAULT_ROLES);

  // ── Perms ─────────────────────────────────────────────────
  const canAddStaff    = hasPerm(sess, "prod_add") || sess?.role === "admin";
  const canClockStaff  = true; // all roles can clock in/out
  const canRemoveStaff = sess?.role === "admin";
  const [search, setSearch]         = useState("");
  const [filter, setFilter]         = useState("all");
  const [view, setView]             = useState("grid");
  const [selected, setSelected]     = useState(null);
  const [sheetOpen, setSheetOpen]   = useState(false);
  const [addOpen, setAddOpen]       = useState(false);
  const [activeTab, setActiveTab]   = useState("employees");

  const [newName,  setNewName]  = useState("");
  const [newRole,  setNewRole]  = useState(() => ROLES[0]);
  const [newShift, setNewShift] = useState(() => SHIFTS[0]);

  const isMobile = useIsMobile();

  const rolesKey  = ROLES.join(",");
  const shiftsKey = SHIFTS.join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { setNewRole(r  => ROLES.includes(r)  ? r : ROLES[0]);  }, [rolesKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { setNewShift(s => SHIFTS.includes(s) ? s : SHIFTS[0]); }, [shiftsKey]);

  const safe = useMemo(() => Array.isArray(staffList) ? staffList : [], [staffList]);

  const filtered = useMemo(() => safe.filter(s => {
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
  }), [safe, search, filter]);

  const counts = {
    total:     safe.length,
    present:   safe.filter(s => s.present).length,
    absent:    safe.filter(s => !s.present).length,
    morning:   safe.filter(s => (s.shift || "").toLowerCase().includes("morning")).length,
    afternoon: safe.filter(s => (s.shift || "").toLowerCase().includes("afternoon")).length,
    night:     safe.filter(s => (s.shift || "").toLowerCase().includes("night")).length,
  };

  const handleClock = (member) => {
    const now = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    if (member.present) {
      setStaffList(prev => (Array.isArray(prev) ? prev : []).map(s =>
        s.id === member.id ? { ...s, present: false, clockedOut: now } : s
      ));
      notify(`${member.name} clocked out at ${now}`, "warning");
    } else {
      setStaffList(prev => (Array.isArray(prev) ? prev : []).map(s =>
        s.id === member.id ? { ...s, present: true, clockedIn: now } : s
      ));
      notify(`${member.name} clocked in at ${now}`, "success");
    }
    setSheetOpen(false);
  };

  const handleAdd = () => {
    if (!newName.trim()) { notify("Enter a name", "warning"); return; }
    const newMember = {
      id: `staff_${Date.now()}`,
      name: newName.trim(),
      role: newRole,
      shift: newShift,
      present: false,
      daysWorked: 0,
      totalDays: 26,
    };
    setStaffList(prev => [...(Array.isArray(prev) ? prev : []), newMember]);
    notify(`${newName} added to team`, "success");
    setNewName(""); setNewRole(ROLES[0]); setNewShift(SHIFTS[0]);
    setAddOpen(false);
  };

  const handleRemove = (id, name) => {
    setStaffList(prev => (Array.isArray(prev) ? prev : []).filter(s => s.id !== id));
    notify(`${name} removed`, "warning");
    setSheetOpen(false);
  };

  const activityLog = useMemo(() => {
    const logs = [];
    safe.forEach(s => {
      if (s.clockedIn)  logs.push({ name: s.name, action: "Clocked In",  time: s.clockedIn,  color: "#10B981", icon: "✅" });
      if (s.clockedOut) logs.push({ name: s.name, action: "Clocked Out", time: s.clockedOut, color: "#ef4444", icon: "🚪" });
    });
    return logs.sort(() => Math.random() - 0.5).slice(0, 20);
  }, [safe]);

  const currentMember = selected ? safe.find(s => s.id === selected.id) || selected : null;
  const selectedIndex = selected ? safe.findIndex(s => s.id === selected.id) : 0;

  return (
    <div style={{ background: t.bg, minHeight: "100vh", padding: isMobile ? "14px 14px 48px" : "18px 18px 48px", animation: "fadeIn 0.3s ease" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ color: COLOR, fontSize: 9, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 4 }}>👥 WORKFORCE</div>
          <div style={{ color: t.text, fontSize: isMobile ? 19 : 22, fontWeight: 900, letterSpacing: "-0.03em" }}>Staff Management</div>
          <div style={{ color: t.sub, fontSize: 12, marginTop: 2 }}>Attendance · shifts · roles · activity</div>
        </div>
        {canAddStaff && <SBtn v="primary" color={COLOR} onClick={() => setAddOpen(true)} icon="+" style={{ boxShadow: GLOW }}>Add Employee</SBtn>}
      </div>

      {/* Stat tiles — 2 cols on mobile, 4 on desktop */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)",
        gap: 10, marginBottom: 18,
      }}>
        <StatTile icon="👥" label="Total Staff"  value={counts.total}   color={COLOR}      t={t} />
        <StatTile icon="✅" label="On Shift"     value={counts.present} color="#10B981"    t={t} />
        <StatTile icon="❌" label="Absent Today" value={counts.absent}  color="#ef4444"    t={t} />
        <StatTile icon="📊" label="Attendance"   value={counts.total > 0 ? `${Math.round((counts.present / counts.total) * 100)}%` : "—"} color="#F59E0B" t={t} />
      </div>

      {/* Shift distribution */}
      <div style={{
        background: t.card, border: `1px solid ${t.border2}`,
        borderRadius: 14, padding: "14px 18px", marginBottom: 16,
        display: "flex", gap: 24, flexWrap: "wrap",
      }}>
        <div style={{ color: t.muted, fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", alignSelf: "center", textTransform: "uppercase" }}>SHIFT SPLIT</div>
        {[
          { label: "Morning",   value: counts.morning,   color: "#F59E0B", icon: "🌅" },
          { label: "Afternoon", value: counts.afternoon, color: "#3b82f6", icon: "☀️" },
          { label: "Night",     value: counts.night,     color: "#8B5CF6", icon: "🌙" },
        ].map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>{s.icon}</span>
            <div>
              <div style={{ color: s.color, fontWeight: 900, fontSize: 18, lineHeight: 1 }}>{s.value}</div>
              <div style={{ color: t.muted, fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>{s.label}</div>
            </div>
          </div>
        ))}
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, minWidth: 120 }}>
          {counts.total > 0 && (() => {
            const segs = [
              { v: counts.morning,   c: "#F59E0B" },
              { v: counts.afternoon, c: "#3b82f6" },
              { v: counts.night,     c: "#8B5CF6" },
            ];
            return (
              <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", flex: 1, gap: 2 }}>
                {segs.map((seg, i) => (
                  seg.v > 0 ? <div key={i} style={{
                    flex: seg.v, background: seg.c, borderRadius: 999,
                    boxShadow: `0 0 8px ${seg.c}50`,
                  }} /> : null
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Inner tab switch */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { id: "employees", l: "👷 Employees" },
          { id: "activity",  l: "📋 Activity Log" },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: "7px 16px", borderRadius: 999, cursor: "pointer",
            fontWeight: 700, fontSize: 11, transition: "all 0.15s", fontFamily: "inherit",
            background: activeTab === tab.id ? GRAD : t.card,
            color: activeTab === tab.id ? "#fff" : t.sub,
            boxShadow: activeTab === tab.id ? GLOW : "none",
            border: activeTab !== tab.id ? `1px solid ${t.border2}` : "none",
          }}>{tab.l}</button>
        ))}
        <div style={{ flex: 1 }} />
        {activeTab === "employees" && (
          <div style={{ display: "flex", gap: 4 }}>
            {["grid", "list"].map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                width: 36, height: 36, borderRadius: 8, cursor: "pointer",
                background: view === v ? `${COLOR}18` : t.card,
                color: view === v ? COLOR : t.sub,
                border: `1px solid ${view === v ? `${COLOR}30` : t.border2}`,
                fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "inherit",
              }}>{v === "grid" ? "⊞" : "☰"}</button>
            ))}
          </div>
        )}
      </div>

      {/* ── EMPLOYEES TAB ── */}
      {activeTab === "employees" && (
        <>
          <SSearch value={search} onChange={setSearch} placeholder="Search name, role, shift..." t={t} />
          <div style={{ height: 10 }} />
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {[
              { k: "all",     l: `All (${counts.total})`             },
              { k: "present", l: `✅ Present (${counts.present})`    },
              { k: "absent",  l: `❌ Absent (${counts.absent})`      },
            ].map(f => (
              <button key={f.k} onClick={() => setFilter(f.k)} style={{
                padding: "6px 13px", borderRadius: 999, cursor: "pointer",
                fontWeight: 700, fontSize: 11, transition: "all 0.15s", fontFamily: "inherit",
                background: filter === f.k ? GRAD : t.card,
                color: filter === f.k ? "#fff" : t.sub,
                boxShadow: filter === f.k ? GLOW : "none",
                border: filter !== f.k ? `1px solid ${t.border2}` : "none",
                minHeight: 34,
              }}>{f.l}</button>
            ))}
          </div>

          {safe.length === 0 ? (
            <div style={{
              background: t.card, border: `1px solid ${t.border2}`, borderRadius: 14, padding: "48px", textAlign: "center",
            }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>👥</div>
              <div style={{ color: t.text, fontWeight: 700, fontSize: 15, marginBottom: 6 }}>No employees added yet</div>
              <div style={{ color: t.sub, fontSize: 13, marginBottom: 18 }}>Add your first team member to get started</div>
              {canAddStaff && <SBtn v="primary" color={COLOR} onClick={() => setAddOpen(true)}>+ Add First Employee</SBtn>}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ background: t.card, border: `1px solid ${t.border2}`, borderRadius: 11, padding: "20px", textAlign: "center", color: t.sub, fontSize: 13 }}>
              No employees match your filter
            </div>
          ) : view === "grid" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
              {filtered.map((m, i) => (
                <EmployeeCard key={m.id} member={m} index={i} onOpen={s => { setSelected(s); setSheetOpen(true); }} t={t} />
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map((m, i) => (
                <EmployeeRow key={m.id} member={m} index={i} onOpen={s => { setSelected(s); setSheetOpen(true); }} onClock={handleClock} t={t} />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── ACTIVITY LOG TAB ── */}
      {activeTab === "activity" && (
        <div style={{ background: t.card, border: `1px solid ${t.border2}`, borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${t.border}` }}>
            <div style={{ color: t.text, fontWeight: 800, fontSize: 13 }}>Worker Activity Log</div>
            <div style={{ color: t.sub, fontSize: 11, marginTop: 2 }}>Clock-in/out events and system actions</div>
          </div>
          {activityLog.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: t.muted, fontSize: 13 }}>No activity yet</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {activityLog.map((log, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "12px 18px",
                  borderBottom: i < activityLog.length - 1 ? `1px solid ${t.border}` : "none",
                  transition: "background 0.15s",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = t.cardHov}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: `${log.color}15`, border: `1px solid ${log.color}25`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, flexShrink: 0,
                  }}>{log.icon}</div>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: t.text, fontWeight: 700, fontSize: 13 }}>{log.name}</span>
                    <span style={{ color: t.sub, fontSize: 12 }}> · {log.action}</span>
                  </div>
                  <div style={{
                    background: `${log.color}12`, border: `1px solid ${log.color}20`,
                    borderRadius: 7, padding: "3px 9px",
                    color: log.color, fontSize: 10, fontWeight: 700,
                  }}>{log.time}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Employee detail sheet ── */}
      <SSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Employee Details" t={t}>
        {currentMember && (() => {
          const avatarColor = AVATAR_COLORS[selectedIndex % AVATAR_COLORS.length];
          const attendancePct = currentMember.daysWorked && currentMember.totalDays
            ? Math.round((currentMember.daysWorked / currentMember.totalDays) * 100) : 0;
          return (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                <div style={{ position: "relative" }}>
                  <SAvatar name={currentMember.name} size={56} color={avatarColor} />
                  <div style={{
                    position: "absolute", bottom: 0, right: 0,
                    width: 12, height: 12, borderRadius: "50%",
                    background: currentMember.present ? "#10B981" : "#ef4444",
                    border: `2px solid ${t.card}`, boxShadow: `0 0 8px ${currentMember.present ? "#10B981" : "#ef4444"}`,
                  }} />
                </div>
                <div>
                  <div style={{ color: t.text, fontWeight: 900, fontSize: 18 }}>{currentMember.name}</div>
                  <div style={{ color: t.sub, fontSize: 12, marginTop: 2 }}>{currentMember.role || "Worker"} · {currentMember.shift || "—"}</div>
                </div>
              </div>

              <div style={{ background: t.cardAlt, border: `1px solid ${t.border}`, borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
                {[
                  { label: "Status",     value: currentMember.present ? "On Shift" : "Absent",        color: currentMember.present ? "#10B981" : "#ef4444" },
                  { label: "Clocked In",  value: currentMember.clockedIn  || "—",                     color: t.text },
                  { label: "Clocked Out", value: currentMember.clockedOut || "—",                     color: t.text },
                  { label: "Role",        value: currentMember.role       || "—",                     color: t.text },
                  { label: "Shift",       value: currentMember.shift      || "—",                     color: t.text },
                ].map(row => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${t.border}` }}>
                    <span style={{ color: t.sub, fontSize: 12 }}>{row.label}</span>
                    <span style={{ color: row.color, fontSize: 12, fontWeight: 700 }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {currentMember.daysWorked !== undefined && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ color: t.sub, fontSize: 12 }}>Attendance Rate</span>
                    <span style={{ color: attendancePct >= 80 ? "#10B981" : "#F59E0B", fontWeight: 800, fontSize: 12 }}>{attendancePct}%</span>
                  </div>
                  <div style={{ height: 6, background: t.border, borderRadius: 999, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${attendancePct}%`,
                      background: attendancePct >= 80 ? "#10B981" : attendancePct >= 60 ? "#F59E0B" : "#ef4444",
                      borderRadius: 999, transition: "width 0.5s ease",
                    }} />
                  </div>
                  <div style={{ color: t.muted, fontSize: 10, marginTop: 4 }}>{currentMember.daysWorked || 0} of {currentMember.totalDays || 26} days this month</div>
                </div>
              )}

              <div style={{ display: "flex", gap: 9, marginBottom: 10 }}>
                <SBtn
                  v={currentMember.present ? "danger" : "success"}
                  onClick={() => handleClock(currentMember)}
                  full
                >{currentMember.present ? "Clock Out" : "Clock In"}</SBtn>
              </div>
              {canRemoveStaff && (
                <SBtn v="ghost" color={t.red} full onClick={() => handleRemove(currentMember.id, currentMember.name)}>
                  Remove Employee
                </SBtn>
              )}
            </>
          );
        })()}
      </SSheet>

      {/* ── Add employee sheet ── */}
      {canAddStaff && (
        <SSheet open={addOpen} onClose={() => setAddOpen(false)} title="Add Employee" t={t}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ color: t.sub, fontSize: 11, fontWeight: 700, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.07em" }}>Full Name</div>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Ravi Kumar"
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10,
                background: t.inp, border: `1px solid ${t.border2}`,
                color: t.text, fontSize: 13, outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <div style={{ color: t.sub, fontSize: 11, fontWeight: 700, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.07em" }}>Role</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {ROLES.map(r => (
                <button key={r} onClick={() => setNewRole(r)} style={{
                  padding: "6px 13px", borderRadius: 8, cursor: "pointer",
                  fontWeight: 700, fontSize: 11, transition: "all 0.15s", fontFamily: "inherit",
                  background: newRole === r ? `${COLOR}20` : t.cardAlt,
                  color: newRole === r ? COLOR : t.sub,
                  border: `1px solid ${newRole === r ? `${COLOR}40` : t.border}`,
                }}>{r}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ color: t.sub, fontSize: 11, fontWeight: 700, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.07em" }}>Shift</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {SHIFTS.map(s => (
                <button key={s} onClick={() => setNewShift(s)} style={{
                  padding: "9px 14px", borderRadius: 9, cursor: "pointer",
                  fontWeight: 600, fontSize: 12, textAlign: "left", transition: "all 0.15s", fontFamily: "inherit",
                  background: newShift === s ? `${COLOR}15` : t.cardAlt,
                  color: newShift === s ? COLOR : t.sub,
                  border: `1px solid ${newShift === s ? `${COLOR}35` : t.border}`,
                }}>{s}</button>
              ))}
            </div>
          </div>

          <SBtn v="primary" color={COLOR} full onClick={handleAdd} style={{ marginTop: 4, boxShadow: GLOW }}>
            Add Employee
          </SBtn>
        </div>
      </SSheet>
      )}

    </div>
  );
}
