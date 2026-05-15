// ============================================================
// staff/tabs/Delivery.js — v7  Responsive + mobile-ready
// ============================================================

import React, { useState, useEffect } from "react";
import { TAB_ACCENT } from "../theme.js";
import { useStore } from "../../lib/store.js";
import {
  dispatchDelivery,
  advanceDeliveryStatus,
  cancelDelivery,
} from "../../lib/deliveryEngine.js";

const COLOR = TAB_ACCENT.delivery.solid;
const GRAD  = TAB_ACCENT.delivery.gradient;
const GLOW  = TAB_ACCENT.delivery.glow;

const STATUS_COLORS = { Pending: "#F59E0B", "In Transit": COLOR, Delivered: "#10B981", Cancelled: "#ef4444" };
const STATUS_ICONS  = { Pending: "🕐", "In Transit": "🚚", Delivered: "✅", Cancelled: "❌" };

function uid() { return "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function today() { return new Date().toISOString().slice(0, 10); }

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

export function DeliveryTab({ t, deliveries = [], setDeliveries, sess, notify, settings }) {
  const [rawCustomers] = useStore("tas9_cust", []);
  const [vehList]      = useStore("tas9_veh_list", []);
  const [staffList]    = useStore("tas9_staff_list", []);
  const [products]     = useStore("tas9_prod", []);

  const [logOpen, setLogOpen]           = useState(false);
  const [custSearch, setCustSearch]     = useState("");
  const [custDropOpen, setCustDropOpen] = useState(false);
  const [filter, setFilter]             = useState("all");
  const [search, setSearch]             = useState("");

  const isMobile = useIsMobile();

  const blankEntry = () => ({
    customer: "", customerId: "", address: "", phone: "",
    items: [{ name: "", qty: 1, price: "" }],
    driver: "", vehicle: "", date: today(), time: "", notes: "",
  });
  const [entry, setEntry] = useState(blankEntry);

  const safe      = Array.isArray(deliveries) ? deliveries : [];
  const customers = Array.isArray(rawCustomers) ? rawCustomers.filter(c => c && c.active !== false) : [];
  const vehicles  = Array.isArray(vehList) ? vehList : [];
  const drivers   = Array.isArray(staffList) ? staffList.filter(s => s?.driver || s?.role === "driver") : [];

  const settingsDrivers  = settings?.drivers  ?? [];
  const settingsVehicles = settings?.vehicles ?? [];
  const driverOptions    = drivers.length > 0
    ? drivers.map(d => d.name || d.id)
    : settingsDrivers.map(d => typeof d === "string" ? d : d.name);
  const vehicleOptions   = vehicles.length > 0
    ? vehicles.map(v => v.regNo || v.label || v.id)
    : settingsVehicles.map(v => typeof v === "string" ? v : v.label);

  const counts = {
    Pending:      safe.filter(d => d?.status === "Pending").length,
    "In Transit": safe.filter(d => d?.status === "In Transit").length,
    Delivered:    safe.filter(d => d?.status === "Delivered").length,
    Cancelled:    safe.filter(d => d?.status === "Cancelled").length,
  };

  const filtered = safe.filter(d => {
    if (!d) return false;
    const q = search.toLowerCase();
    const match = !q || (d.customer||"").toLowerCase().includes(q) || (d.address||"").toLowerCase().includes(q);
    return filter === "all" ? match : match && d.status === filter;
  });

  const filteredCusts = customers.filter(c =>
    !custSearch || (c.name||"").toLowerCase().includes(custSearch.toLowerCase()) || (c.phone||"").includes(custSearch)
  ).slice(0, 12);

  const setField  = (k, v) => setEntry(e => ({ ...e, [k]: v }));
  const setItem   = (i, k, v) => setEntry(e => { const it = [...e.items]; it[i] = { ...it[i], [k]: v }; return { ...e, items: it }; });
  const addItem   = () => setEntry(e => ({ ...e, items: [...e.items, { name: "", qty: 1, price: "" }] }));
  const removeItem = i => setEntry(e => ({ ...e, items: e.items.filter((_, idx) => idx !== i) }));

  const openLog = () => { setEntry(blankEntry()); setCustSearch(""); setLogOpen(true); };

  const handleSave = (status = "Pending") => {
    if (!entry.customer) { notify("Select a customer", "warning"); return; }
    const validItems = entry.items.filter(it => it.name);
    if (!validItems.length) { notify("Add at least one item", "warning"); return; }
    const newDel = {
      id: uid(),
      customer: entry.customer, customerId: entry.customerId,
      address: entry.address, phone: entry.phone,
      orderLines: validItems.reduce((acc, it, i) => {
        // Key by productId (or name-slug) so CRM's lineTotal loop works correctly
        const key = it.productId || it.name.toLowerCase().replace(/\s+/g, "_") || `item_${i}`;
        acc[key] = { name: it.name, qty: Number(it.qty)||1, priceAmount: Number(it.price)||0 };
        return acc;
      }, {}),
      // CRM required fields — staff portal doesn't capture these so we default them
      lat: null, lng: null,
      batchId: null,
      replacement: null,
      partialPayment: null,
      agent: entry.driver||"", vehicle: entry.vehicle||"",
      date: entry.date, time: entry.time, notes: entry.notes,
      status, createdAt: new Date().toISOString(), createdBy: sess?.name||"Staff",
    };
    setDeliveries(prev => [newDel, ...(Array.isArray(prev) ? prev : [])]);
    notify(`✅ Delivery logged for ${entry.customer}`, "success");
    setLogOpen(false);
  };

  const actor = { name: sess?.name || "Staff", role: "staff", uid: sess?.uid || null };

  const advanceStatus = del => {
    if (del.status === "Pending") {
      dispatchDelivery(del, actor, setDeliveries, notify);
    } else {
      advanceDeliveryStatus(del, actor, setDeliveries, notify);
    }
  };

  const cancelDel = del => {
    cancelDelivery(del, actor, setDeliveries, notify);
  };

  const glass = {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16, padding: 18, backdropFilter: "blur(20px)",
  };
  const inp = {
    width: "100%", background: "rgba(255,255,255,0.05)",
    border: "1.5px solid rgba(255,255,255,0.1)", color: t.text,
    borderRadius: 9, padding: "9px 12px", fontSize: 13,
    outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  };
  const lbl = {
    color: t.muted, fontSize: 10, fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.07em",
    marginBottom: 6, display: "block",
  };

  if (!t) return null;

  return (
    <div style={{ background: t.bg, minHeight: "100vh", padding: isMobile ? 14 : 20, animation: "fadeIn 0.3s ease" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: GRAD, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: "#fff", boxShadow: GLOW }}>3</div>
          <div>
            <div style={{ color: t.text, fontSize: isMobile ? 17 : 20, fontWeight: 900 }}>Delivery / Dispatch</div>
            <div style={{ color: t.sub, fontSize: 12, marginTop: 2 }}>Log and manage deliveries</div>
          </div>
        </div>
        <button onClick={openLog} style={{
          padding: "12px 20px", borderRadius: 12, border: "none",
          background: GRAD, color: "#fff", fontWeight: 800, fontSize: 14,
          cursor: "pointer", fontFamily: "inherit", boxShadow: GLOW,
          display: "flex", alignItems: "center", gap: 8,
        }}
          onMouseEnter={e => e.currentTarget.style.filter = "brightness(1.15)"}
          onMouseLeave={e => e.currentTarget.style.filter = ""}
        >🚚 Log Entry</button>
      </div>

      {/* Stats — 2 cols on mobile, 4 on desktop */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)",
        gap: 10, marginBottom: 16,
      }}>
        {[
          { label: "Pending",    value: counts.Pending,      color: "#F59E0B", icon: "🕐", key: "Pending" },
          { label: "In Transit", value: counts["In Transit"], color: COLOR,     icon: "🚚", key: "In Transit" },
          { label: "Delivered",  value: counts.Delivered,    color: "#10B981", icon: "✅", key: "Delivered" },
          { label: "Cancelled",  value: counts.Cancelled,    color: "#ef4444", icon: "❌", key: "Cancelled" },
        ].map(s => (
          <div key={s.key} onClick={() => setFilter(filter === s.key ? "all" : s.key)} style={{
            background: filter === s.key ? `${s.color}14` : "rgba(255,255,255,0.03)",
            border: `1px solid ${filter === s.key ? s.color+"40" : "rgba(255,255,255,0.07)"}`,
            borderRadius: 14, padding: "14px 16px", textAlign: "center", cursor: "pointer", transition: "all 0.18s",
          }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ color: s.color, fontSize: 24, fontWeight: 900, lineHeight: 1 }}>{s.value}</div>
            <div style={{ color: t.muted, fontSize: 10, fontWeight: 700, marginTop: 3, textTransform: "uppercase", letterSpacing: "0.07em" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: t.muted, fontSize: 12, pointerEvents: "none" }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search deliveries..." style={{ ...inp, paddingLeft: 30 }} />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["all","Pending","In Transit","Delivered","Cancelled"].map(k => (
            <button key={k} onClick={() => setFilter(k)} style={{
              padding: "8px 12px", borderRadius: 9, border: "none",
              background: filter === k ? GRAD : "rgba(255,255,255,0.05)",
              color: filter === k ? "#fff" : t.sub,
              fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              minHeight: 36,
            }}>{k === "all" ? `All (${safe.length})` : k}</button>
          ))}
        </div>
      </div>

      {/* List */}
      {safe.length === 0 ? (
        <div style={{ ...glass, padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 12, opacity: 0.2 }}>🚚</div>
          <div style={{ color: t.text, fontWeight: 800, fontSize: 16, marginBottom: 6 }}>No deliveries yet</div>
          <div style={{ color: t.sub, fontSize: 13, marginBottom: 20 }}>Tap Log Entry to create your first delivery</div>
          <button onClick={openLog} style={{ padding: "12px 24px", borderRadius: 11, border: "none", background: GRAD, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit", boxShadow: GLOW }}>🚚 Log Entry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ ...glass, padding: 28, textAlign: "center" }}>
          <div style={{ color: t.muted, fontSize: 13 }}>No deliveries match your filter</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(del => {
            const sc = STATUS_COLORS[del.status] || t.sub;
            const steps = ["Pending", "In Transit", "Delivered"];
            const canAdvance = steps.indexOf(del.status) < steps.length - 1 && del.status !== "Cancelled";
            const items = del.orderLines ? Object.values(del.orderLines).filter(l => l?.qty > 0) : [];
            const totalQty = items.reduce((s, l) => s + (l.qty||0), 0);
            return (
              <div key={del.id} style={{
                ...glass,
                borderLeft: `4px solid ${sc}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 16,
                flexWrap: "wrap",
              }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ color: t.text, fontWeight: 800, fontSize: 15 }}>{del.customer}</span>
                    <span style={{ background: `${sc}15`, color: sc, border: `1px solid ${sc}30`, borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                      {STATUS_ICONS[del.status]} {del.status}
                    </span>
                  </div>
                  <div style={{ color: t.sub, fontSize: 11, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {del.address && <span>📍 {del.address}</span>}
                    {del.date    && <span>📅 {del.date}</span>}
                    {del.agent   && <span>🚗 {del.agent}</span>}
                    {del.vehicle && <span>🚛 {del.vehicle}</span>}
                    {totalQty > 0 && <span>📦 {totalQty} pcs</span>}
                  </div>
                  {del.notes && <div style={{ color: t.muted, fontSize: 11, marginTop: 5, fontStyle: "italic" }}>"{del.notes}"</div>}
                </div>
                <div style={{ display: "flex", gap: 7, flexShrink: 0, alignItems: "center", flexWrap: "wrap" }}>
                  {canAdvance && (
                    <button onClick={() => advanceStatus(del)} style={{
                      padding: "9px 14px", borderRadius: 9, border: "none",
                      background: GRAD, color: "#fff", fontWeight: 700, fontSize: 12,
                      cursor: "pointer", fontFamily: "inherit", boxShadow: GLOW,
                      minHeight: 38,
                    }}>
                      {del.status === "Pending" ? "🚚 Dispatch" : "✅ Delivered"}
                    </button>
                  )}
                  {del.status !== "Delivered" && del.status !== "Cancelled" && (
                    <button onClick={() => cancelDel(del)} style={{
                      padding: "9px 12px", borderRadius: 9,
                      border: "1px solid rgba(239,68,68,0.25)",
                      background: "rgba(239,68,68,0.08)", color: "#ef4444",
                      fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                      minHeight: 38, minWidth: 38,
                    }}>✕</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ LOG ENTRY SHEET ═══════════════════════════════════ */}
      {logOpen && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(4px)", zIndex: 300,
          display: "flex", alignItems: "flex-end", justifyContent: "center",
        }}
          onClick={() => setLogOpen(false)}>
          <div style={{
            background: t.card||"#111827", borderRadius: "22px 22px 0 0",
            padding: isMobile ? "20px 16px 28px" : "24px 24px 32px",
            width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto",
            border: "1px solid rgba(255,255,255,0.1)", borderBottom: "none",
          }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <div>
                <div style={{ color: t.text, fontSize: 18, fontWeight: 900 }}>🚚 Log Delivery Entry</div>
                <div style={{ color: t.sub, fontSize: 12, marginTop: 2 }}>Fill in the details and save</div>
              </div>
              <button onClick={() => setLogOpen(false)} style={{
                background: "rgba(255,255,255,0.07)", border: "none", color: t.sub,
                borderRadius: 8, width: 40, height: 40, cursor: "pointer", fontSize: 16,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>✕</button>
            </div>

            {/* Customer picker */}
            <div style={{ marginBottom: 16, position: "relative" }}>
              <span style={lbl}>Customer *</span>
              <div style={{ position: "relative" }}>
                <input
                  value={entry.customerId ? entry.customer : custSearch}
                  onChange={e => { setCustSearch(e.target.value); setField("customer", e.target.value); setField("customerId", ""); setCustDropOpen(true); }}
                  onFocus={() => setCustDropOpen(true)}
                  placeholder="Search customer name or phone..."
                  style={{ ...inp, paddingRight: 36 }}
                />
                <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: t.muted, fontSize: 12, pointerEvents: "none" }}>▾</span>
              </div>
              {custDropOpen && filteredCusts.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, background: t.card||"#1a1f36", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, marginTop: 4, maxHeight: 220, overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>
                  {filteredCusts.map(c => (
                    <div key={c.id} onClick={() => { setField("customer", c.name||""); setField("customerId", c.id||""); setField("address", c.address||c.area||""); setField("phone", c.phone||""); setCustSearch(""); setCustDropOpen(false); }}
                      style={{ padding: "11px 14px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <div style={{ color: t.text, fontWeight: 700, fontSize: 13 }}>{c.name}</div>
                      <div style={{ color: t.sub, fontSize: 11, marginTop: 2 }}>{c.phone && `📞 ${c.phone}`}{(c.address||c.area) && ` · 📍 ${c.address||c.area}`}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Address */}
            <div style={{ marginBottom: 16 }}>
              <span style={lbl}>Delivery Address</span>
              <input value={entry.address} onChange={e => setField("address", e.target.value)} placeholder="Address / area" style={inp} />
            </div>

            {/* Items */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={lbl}>Items</span>
                <button onClick={addItem} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: `${COLOR}18`, color: COLOR, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Add Item</button>
              </div>

              {/* Column headers — hide on mobile (labels shown per-field instead) */}
              {!isMobile && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 80px 40px", gap: 6, marginBottom: 6 }}>
                  <span style={{ ...lbl, marginBottom: 0 }}>Item Name</span>
                  <span style={{ ...lbl, marginBottom: 0 }}>Qty</span>
                  <span style={{ ...lbl, marginBottom: 0 }}>₹ Price</span>
                  <span />
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 14 : 8 }}>
                {entry.items.map((item, i) => (
                  isMobile ? (
                    /* Mobile: stacked layout per item */
                    <div key={i} style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 10, padding: "10px 12px",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ ...lbl, marginBottom: 0 }}>Item {i + 1}</span>
                        {entry.items.length > 1 && (
                          <button onClick={() => removeItem(i)} style={{
                            background: "rgba(239,68,68,0.1)", border: "none", color: "#ef4444",
                            borderRadius: 7, width: 32, height: 32, cursor: "pointer", fontSize: 14,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>✕</button>
                        )}
                      </div>
                      <input value={item.name} onChange={e => setItem(i, "name", e.target.value)} placeholder="Item name (e.g. Malabar Paratha)" style={{ ...inp, marginBottom: 8 }} list={`pl-${i}`} />
                      <datalist id={`pl-${i}`}>{Array.isArray(products) && products.map(p => <option key={p.id} value={p.name||p.id} />)}</datalist>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div>
                          <span style={{ ...lbl }}>Qty</span>
                          <input type="number" min="1" value={item.qty} onChange={e => setItem(i, "qty", e.target.value)} style={inp} />
                        </div>
                        <div>
                          <span style={{ ...lbl }}>₹ Price</span>
                          <input type="number" min="0" value={item.price} onChange={e => setItem(i, "price", e.target.value)} placeholder="0" style={inp} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Desktop: single-row grid */
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 70px 80px 40px", gap: 7, alignItems: "center" }}>
                      <input value={item.name} onChange={e => setItem(i, "name", e.target.value)} placeholder="e.g. Malabar Paratha" style={inp} list={`pl-${i}`} />
                      <datalist id={`pl-${i}`}>{Array.isArray(products) && products.map(p => <option key={p.id} value={p.name||p.id} />)}</datalist>
                      <input type="number" min="1" value={item.qty} onChange={e => setItem(i, "qty", e.target.value)} style={inp} />
                      <input type="number" min="0" value={item.price} onChange={e => setItem(i, "price", e.target.value)} placeholder="0" style={inp} />
                      <button onClick={() => removeItem(i)} style={{
                        background: "rgba(239,68,68,0.1)", border: "none", color: "#ef4444",
                        borderRadius: 7, width: 40, height: 40, cursor: "pointer", fontSize: 14,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>✕</button>
                    </div>
                  )
                ))}
              </div>
            </div>

            {/* Driver + Vehicle */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <span style={lbl}>Driver (optional)</span>
                <select value={entry.driver} onChange={e => setField("driver", e.target.value)} style={{ ...inp }}>
                  <option value="">— No driver —</option>
                  {driverOptions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <span style={lbl}>Vehicle (optional)</span>
                <select value={entry.vehicle} onChange={e => setField("vehicle", e.target.value)} style={{ ...inp }}>
                  <option value="">— No vehicle —</option>
                  {vehicleOptions.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>

            {/* Date + Time */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <span style={lbl}>Delivery Date</span>
                <input type="date" value={entry.date} onChange={e => setField("date", e.target.value)} style={inp} />
              </div>
              <div>
                <span style={lbl}>Time (optional)</span>
                <input type="time" value={entry.time} onChange={e => setField("time", e.target.value)} style={inp} />
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 22 }}>
              <span style={lbl}>Notes (optional)</span>
              <textarea value={entry.notes} onChange={e => setField("notes", e.target.value)} placeholder="e.g. Handle with care, call before delivery..." rows={2} style={{ ...inp, resize: "vertical", minHeight: 60 }} />
            </div>

            {/* Save buttons */}
            <div style={{ display: "flex", gap: 10, flexWrap: isMobile ? "wrap" : "nowrap" }}>
              <button onClick={() => handleSave("Pending")} style={{
                flex: 1, minWidth: isMobile ? "100%" : "auto",
                padding: "13px 0", borderRadius: 11,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)", color: t.text,
                fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
              }}>💾 Save as Pending</button>
              <button onClick={() => handleSave("In Transit")} style={{
                flex: 1, minWidth: isMobile ? "100%" : "auto",
                padding: "13px 0", borderRadius: 11, border: "none",
                background: GRAD, color: "#fff", fontWeight: 800,
                fontSize: 14, cursor: "pointer", fontFamily: "inherit", boxShadow: GLOW,
              }}>🚀 Dispatch Now</button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
