// ============================================================
// staff/tabs/Inventory.js — v5 RESPONSIVE + WIRED
// FIXED: all grids collapse on phone/tablet
// FIXED: "Usage Entry" button now opens a working sheet
// FIXED: "+ Receive Material" button now opens a working sheet
// FIXED: table gets horizontal scroll on mobile instead of crushing
// ============================================================

import React, { useState } from "react";
import { TAB_ACCENT } from "../theme.js";
import { SBtn, SSearch, SSheet, SQtyPicker } from "../components/ui.js";
import { hasPerm } from "../../lib/roles.js";
import { onInventoryUsage, onInventoryReceive } from "../../lib/workflowEngine.js";

const COLOR = TAB_ACCENT.inventory.solid;
const GRAD  = TAB_ACCENT.inventory.gradient;
const GLOW  = TAB_ACCENT.inventory.glow;

// ── Responsive helper ─────────────────────────────────────────
function useBreakpoint() {
  const [w, setW] = React.useState(() => (typeof window !== "undefined" ? window.innerWidth : 1024));
  React.useEffect(() => {
    const fn = () => setW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return { isMobile: w < 600, isTablet: w >= 600 && w < 900, w };
}

export function InventoryTab({ t, inventory = [], setInventory, sess, notify = () => {}, settings, setActivityLog }) {
  const { isMobile } = useBreakpoint();

  // ── Staff Portal settings ─────────────────────────────────
  const sp = settings?.staffPortal || {};
  const spOn = (key, def = true) => sp[key] !== undefined ? sp[key] : def;

  // ── Perms (role-based + portal) ───────────────────────────
  const canReceive = hasPerm(sess, "sup_add")      && spOn("inventoryCanAdd",    true);
  const canDeduct  = hasPerm(sess, "sup_edit")     && spOn("inventoryCanEdit",   true);
  const canDelete  = hasPerm(sess, "sup_delete")   && spOn("inventoryCanDelete", false);
  const canSeeCost = hasPerm(sess, "sup_seeCost")  && spOn("inventoryShowValues",false);

  // ── Settings-driven labels ─────────────────────────────────
  const tabTitle    = sp.inventoryTabTitle    || settings?.inventoryTabTitle    || "Raw Materials";
  const tabSubtitle = settings?.inventoryTabSubtitle || "Live stock levels · synced with admin";

  const [search, setSearch]         = useState("");
  const [filter, setFilter]         = useState("all");
  const [selected, setSelected]     = useState(null);
  const [deductQty, setDeductQty]   = useState(0);
  const [deductOpen, setDeductOpen] = useState(false);
  const [viewMode, setViewMode]     = useState(isMobile ? "cards" : "table");

  // ── Usage Entry state ─────────────────────────────────────
  const [usageOpen, setUsageOpen]     = useState(false);
  const [usageItem, setUsageItem]     = useState(null);
  const [usageQty, setUsageQty]       = useState(0);
  const [usageReason, setUsageReason] = useState("");

  // ── Receive Material state ────────────────────────────────
  const [receiveOpen, setReceiveOpen]     = useState(false);
  const [receiveItem, setReceiveItem]     = useState(null);
  const [receiveQty, setReceiveQty]       = useState(0);
  const [receiveSrc, setReceiveSrc]       = useState("");

  const safe = (Array.isArray(inventory) ? inventory : []).filter(i => !i.deleted);

  const withStatus = safe.map(i => {
    const s = typeof i.stock === "number" && typeof i.minStock === "number"
      ? i.stock <= 0 ? "critical"
      : i.stock <= i.minStock ? "low"
      : "ok"
      : "ok";
    return { ...i, _status: s };
  });

  const filtered = withStatus.filter(i => {
    if (!i) return false;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (i.name || "").toLowerCase().includes(q) ||
      (i.category || "").toLowerCase().includes(q) ||
      (i.unit || "").toLowerCase().includes(q);
    if (!matchSearch) return false;
    if (filter === "low")      return i._status === "low";
    if (filter === "critical") return i._status === "critical";
    if (filter === "ok")       return i._status === "ok";
    return true;
  });

  const counts = {
    all:      safe.length,
    ok:       withStatus.filter(i => i._status === "ok").length,
    low:      withStatus.filter(i => i._status === "low").length,
    critical: withStatus.filter(i => i._status === "critical").length,
  };

  // ── Deduct (existing) ─────────────────────────────────────
  const handleDeduct = () => {
    if (!selected) return;
    if (deductQty <= 0) { notify("Enter a valid quantity", "warning"); return; }
    if (deductQty > (selected.stock ?? 0)) { notify("Cannot exceed current stock", "warning"); return; }
    setInventory(prev => (Array.isArray(prev) ? prev : []).map(i =>
      i.id === selected.id ? { ...i, stock:(i.stock ?? 0) - deductQty } : i
    ));
    notify(`${deductQty} ${selected.unit || "units"} deducted — ${selected.name}`, "success");
    setDeductQty(0); setDeductOpen(false); setSelected(null);
  };

  const handleUsage = () => {
    const ok = onInventoryUsage({
      item: usageItem, qty: usageQty, reason: usageReason,
      sess, setInventory, setActivityLog, notify,
    });
    if (ok) { setUsageQty(0); setUsageReason(""); setUsageItem(null); setUsageOpen(false); }
  };

  // ── Receive Material — add to stock ──────────────────────
  const handleReceive = () => {
    const ok = onInventoryReceive({
      item: receiveItem, qty: receiveQty, source: receiveSrc,
      sess, setInventory, setActivityLog, notify,
    });
    if (ok) { setReceiveQty(0); setReceiveSrc(""); setReceiveItem(null); setReceiveOpen(false); }
  };

  const statusColor = s => s === "critical" ? t.red : s === "low" ? t.orange : t.green;
  const statusLabel = s => s === "critical" ? "Critical" : s === "low" ? "Low Stock" : "Good";
  const statusIcon  = s => s === "critical" ? "🚨" : s === "low" ? "⚠️" : "✅";

  const inp = {
    width:"100%", background:t.cardAlt,
    border:`1.5px solid ${t.border}`, color:t.text,
    borderRadius:9, padding:"9px 12px", fontSize:13,
    outline:"none", boxSizing:"border-box", fontFamily:"inherit",
  };

  const statCols = isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)";

  return (
    <div style={{ background:t.bg, minHeight:"100vh", padding: isMobile ? "12px 12px 24px" : "16px", maxWidth:1000, margin:"0 auto", animation:"fadeIn 0.3s ease" }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ marginBottom:18, display:"flex", justifyContent:"space-between", alignItems:"flex-end", flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:`${COLOR}12`, border:`1px solid ${COLOR}28`, borderRadius:7, padding:"4px 10px", marginBottom:10 }}>
            <span style={{ fontSize:10 }}>🏭</span>
            <span style={{ color:COLOR, fontSize:9, fontWeight:800, letterSpacing:"0.14em", textTransform:"uppercase" }}>INVENTORY</span>
          </div>
          <div style={{ color:t.text, fontSize: isMobile ? 20 : 24, fontWeight:900, letterSpacing:"-0.03em", lineHeight:1.1 }}>{tabTitle}</div>
          <div style={{ color:t.sub, fontSize:12, marginTop:4 }}>{tabSubtitle}</div>
        </div>
        <div style={{ display:"flex", gap:9, flexWrap:"wrap" }}>
          {canDeduct && (
          <SBtn v="ghost" color={COLOR} onClick={() => { setUsageItem(safe[0] || null); setUsageQty(0); setUsageReason(""); setUsageOpen(true); }}>
            Usage Entry
          </SBtn>
          )}
          {canReceive && (
          <SBtn v="primary" color={COLOR} onClick={() => { setReceiveItem(safe[0] || null); setReceiveQty(0); setReceiveSrc(""); setReceiveOpen(true); }}>
            + Receive Material
          </SBtn>
          )}
        </div>
      </div>

      {/* ── Stats strip — 2 cols on mobile ─────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:statCols, gap:10, marginBottom:16 }}>
        {[
          { label:"Total Items", value:counts.all,      color:t.blue,   icon:"📋", key:"all"      },
          { label:"In Stock",    value:counts.ok,       color:t.green,  icon:"✅", key:"ok"       },
          { label:"Low Stock",   value:counts.low,      color:t.orange, icon:"⚠️", key:"low"      },
          { label:"Critical",    value:counts.critical, color:t.red,    icon:"🚨", key:"critical" },
        ].map(s => (
          <div key={s.label} onClick={() => setFilter(s.key)} style={{
            background:    filter === s.key ? `${s.color}12` : "rgba(255,255,255,0.025)",
            border:        `1px solid ${filter === s.key ? s.color+"40" : "rgba(255,255,255,0.07)"}`,
            borderTop:     `2.5px solid ${filter === s.key ? s.color : "rgba(255,255,255,0.08)"}`,
            borderRadius:  14, padding: isMobile ? "12px" : "14px 16px", textAlign:"center",
            cursor:"pointer", transition:"all 0.18s", backdropFilter:"blur(20px)",
            boxShadow: filter === s.key ? `0 0 28px ${s.color}18` : "none",
          }}>
            <div style={{ fontSize: isMobile ? 16 : 20, marginBottom:6 }}>{s.icon}</div>
            <div style={{ color:s.color, fontSize: isMobile ? 22 : 26, fontWeight:900, lineHeight:1 }}>{s.value}</div>
            <div style={{ color:t.sub, fontSize: isMobile ? 8 : 9, fontWeight:800, marginTop:4, textTransform:"uppercase", letterSpacing:"0.08em" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Critical alert ─────────────────────────────────── */}
      {counts.critical > 0 && (
        <div style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", borderLeft:"4px solid #ef4444", borderRadius:12, padding:"14px 16px", marginBottom:14, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, boxShadow:"0 0 24px rgba(239,68,68,0.08)", flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontSize:22 }}>🚨</span>
            <div>
              <div style={{ color:"#f87171", fontWeight:800, fontSize:13 }}>{counts.critical} item{counts.critical > 1 ? "s" : ""} at critical level</div>
              <div style={{ color:t.sub, fontSize:11, marginTop:2 }}>Immediate restock required</div>
            </div>
          </div>
          <SBtn v="danger" sm onClick={() => setFilter("critical")}>View Critical</SBtn>
        </div>
      )}

      {/* ── Controls ───────────────────────────────────────── */}
      <SSearch value={search} onChange={setSearch} placeholder="Search materials, category, unit..." t={t} />
      <div style={{ height:10 }} />

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:8 }}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {[
            { k:"all",      l:`All (${counts.all})`              },
            { k:"ok",       l:`✅ OK (${counts.ok})`             },
            { k:"low",      l:`⚠️ Low (${counts.low})`           },
            { k:"critical", l:`🚨 Critical (${counts.critical})`  },
          ].map(f => (
            <button key={f.k} onClick={() => setFilter(f.k)} style={{
              padding:"7px 13px", borderRadius:"999px",
              border: filter !== f.k ? "1px solid rgba(255,255,255,0.08)" : "none",
              cursor:"pointer", fontWeight:700, fontSize:11, transition:"all 0.15s",
              background: filter === f.k ? GRAD : "rgba(255,255,255,0.04)",
              color:      filter === f.k ? "#fff" : t.sub,
              boxShadow:  filter === f.k ? GLOW : "none",
              fontFamily:"inherit",
            }}>{f.l}</button>
          ))}
        </div>
        {/* View toggle — hidden on mobile (defaults to cards) */}
        {!isMobile && (
          <div style={{ display:"flex", gap:4, background:"rgba(255,255,255,0.04)", borderRadius:10, padding:3, border:"1px solid rgba(255,255,255,0.07)" }}>
            {[{ k:"table", l:"☰" }, { k:"cards", l:"⊞" }].map(v => (
              <button key={v.k} onClick={() => setViewMode(v.k)} style={{
                width:32, height:28, borderRadius:7, border:"none",
                background: viewMode === v.k ? "rgba(255,255,255,0.10)" : "transparent",
                color:      viewMode === v.k ? t.text : t.sub,
                cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center",
                transition:"all 0.15s",
                boxShadow:  viewMode === v.k ? "0 2px 8px rgba(0,0,0,0.3)" : "none",
              }}>{v.l}</button>
            ))}
          </div>
        )}
      </div>

      {/* ── TABLE VIEW — horizontal scroll on mobile ────────── */}
      {(viewMode === "table" || isMobile) && !isMobile && (
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
          <div style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:16, overflow:"hidden", backdropFilter:"blur(20px)", boxShadow:"0 4px 32px rgba(0,0,0,0.3)", minWidth:560 }}>
            <div style={{ display:"grid", gridTemplateColumns:`2fr 0.8fr 0.8fr 0.8fr 1fr${canSeeCost ? " 0.6fr" : ""} 90px${canDelete ? " 40px" : ""}`, padding:"10px 18px", borderBottom:`1px solid ${t.border}`, background:t.cardAlt }}>
              {["MATERIAL","STOCK","MIN","UNIT","USAGE",...(canSeeCost?["COST"]:[]),"STATUS",...(canDelete?[""]:[])].map(h => (
                <div key={h} style={{ color:t.sub, fontSize:8, fontWeight:800, letterSpacing:"0.1em" }}>{h}</div>
              ))}
            </div>
            {safe.length === 0 ? (
              <div style={{ padding:"54px", textAlign:"center" }}>
                <div style={{ fontSize:44, marginBottom:12, opacity:0.3 }}>🏭</div>
                <div style={{ color:t.text, fontWeight:700, fontSize:15, marginBottom:4 }}>No inventory items</div>
                <div style={{ color:t.sub, fontSize:13 }}>Items added by admin appear here</div>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding:"24px", textAlign:"center", color:t.sub, fontSize:13 }}>No items match your filter</div>
            ) : (
              filtered.map((item, i) => {
                const sc = statusColor(item._status);
                const stockPct = item.minStock > 0 ? Math.min(100, Math.round((item.stock / (item.minStock * 3)) * 100)) : 100;
                return (
                  <div key={item.id} onClick={() => { setSelected(item); setDeductQty(0); setDeductOpen(true); }}
                    style={{ display:"grid", gridTemplateColumns:`2fr 0.8fr 0.8fr 0.8fr 1fr${canSeeCost ? " 0.6fr" : ""} 90px${canDelete ? " 40px" : ""}`, padding:"13px 18px", borderBottom: i < filtered.length-1 ? `1px solid ${t.border}` : "none", cursor:"pointer", transition:"all 0.15s", alignItems:"center" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.035)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = ""; }}
                  >
                    <div>
                      <div style={{ color:t.text, fontWeight:700, fontSize:13 }}>{item.name || "—"}</div>
                      {item.category && <div style={{ color:t.sub, fontSize:10, marginTop:2 }}>{item.category}</div>}
                    </div>
                    <div style={{ color:sc, fontWeight:900, fontSize:17, fontVariantNumeric:"tabular-nums", textShadow:`0 0 20px ${sc}60` }}>{item.stock ?? "—"}</div>
                    <div style={{ color:t.muted, fontSize:12 }}>{item.minStock ?? "—"}</div>
                    <div style={{ color:t.muted, fontSize:12 }}>{item.unit || "—"}</div>
                    <div>
                      <div style={{ height:5, background:t.cardAlt, borderRadius:"999px", overflow:"hidden", maxWidth:100 }}>
                        <div style={{ height:"100%", width:`${stockPct}%`, background:sc, borderRadius:"999px", boxShadow:`0 0 10px ${sc}60`, transition:"width 0.5s ease" }} />
                      </div>
                      <div style={{ color:t.muted, fontSize:8, marginTop:4, fontWeight:700 }}>{stockPct}%</div>
                    </div>
                    {canSeeCost && (
                      <div style={{ color:t.sub, fontSize:11, fontVariantNumeric:"tabular-nums" }}>
                        {item.costPer != null ? `₹${item.costPer}/${item.unit||"u"}` : "—"}
                      </div>
                    )}
                    <div>
                      <span style={{ background:`${sc}12`, color:sc, border:`1px solid ${sc}28`, borderRadius:"999px", padding:"3px 10px", fontSize:10, fontWeight:700, display:"inline-block", boxShadow:`0 0 12px ${sc}20` }}>{statusLabel(item._status)}</span>
                    </div>
                    {canDelete && (
                      <div style={{ display:"flex", justifyContent:"center", alignItems:"center" }}>
                        <button onClick={e => {
                          e.stopPropagation();
                          if (!window.confirm(`Move "${item.name}" to trash?`)) return;
                          const now = new Date();
                          setInventory(prev => (Array.isArray(prev) ? prev : []).map(x => x.id !== item.id ? x : {
                            ...x,
                            deleted: true,
                            deletedAt: now.getTime(),
                            deletedAtISO: now.toISOString(),
                            deletedBy: sess?.id || "unknown",
                            deletedByName: sess?.name || "Staff",
                            deletedByRole: sess?.role || "staff",
                          }));
                          notify(`"${item.name}" moved to trash`, "warning");
                        }} title="Move to trash"
                          style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,80,80,0.45)", fontSize:15, padding:"4px 6px", lineHeight:1, borderRadius:6, transition:"color 0.15s" }}
                          onMouseEnter={e => e.currentTarget.style.color="#ef4444"}
                          onMouseLeave={e => e.currentTarget.style.color="rgba(255,80,80,0.45)"}>
                          🗑
                        </button>
                      </div>
                    )}
                  </div>
                );              })
            )}
          </div>
        </div>
      )}

      {/* ── CARD VIEW — default on mobile ─────────────────── */}
      {(viewMode === "cards" || isMobile) && (
        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(auto-fill, minmax(195px, 1fr))", gap:10 }}>
          {safe.length === 0 ? (
            <div style={{ gridColumn:"1/-1", background:t.card, border:`1px solid ${t.border}`, borderRadius:16, padding:"54px", textAlign:"center" }}>
              <div style={{ fontSize:44, marginBottom:12, opacity:0.3 }}>🏭</div>
              <div style={{ color:t.text, fontWeight:700, fontSize:15 }}>No inventory items</div>
            </div>
          ) : filtered.map(item => {
            const sc = statusColor(item._status);
            const stockPct = item.minStock > 0 ? Math.min(100, Math.round((item.stock / (item.minStock * 3)) * 100)) : 100;
            return (
              <div key={item.id} onClick={() => { setSelected(item); setDeductQty(0); setDeductOpen(true); }}
                style={{ background:t.card, border:`1px solid ${t.border}`, borderTop:`3px solid ${sc}`, borderRadius:14, padding: isMobile ? "12px" : "16px", cursor:"pointer", transition:"all 0.18s", backdropFilter:"blur(20px)", boxShadow:`0 0 24px ${sc}08` }}
                onMouseEnter={e => { e.currentTarget.style.background = t.cardAlt; }}
                onMouseLeave={e => { e.currentTarget.style.background = t.card; }}
              >
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                  <div>
                    <div style={{ color:t.text, fontWeight:700, fontSize: isMobile ? 11 : 12, lineHeight:1.3 }}>{item.name}</div>
                    <div style={{ color:t.sub, fontSize:10, marginTop:2 }}>{item.category}</div>
                  </div>
                  <span style={{ fontSize:14 }}>{statusIcon(item._status)}</span>
                </div>
                <div style={{ color:sc, fontSize: isMobile ? 24 : 30, fontWeight:900, lineHeight:1, marginBottom:3, textShadow:`0 0 24px ${sc}50` }}>{item.stock}</div>
                <div style={{ color:t.muted, fontSize:10, marginBottom:10 }}>{item.unit} in stock</div>
                <div style={{ height:5, background:t.cardAlt, borderRadius:"999px", overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${stockPct}%`, background:sc, borderRadius:"999px", boxShadow:`0 0 10px ${sc}60`, transition:"width 0.5s ease" }} />
                </div>
                <div style={{ color:t.muted, fontSize:9, marginTop:5, fontWeight:600 }}>Min: {item.minStock} {item.unit}</div>
              </div>
            );
          })}
        </div>
      )}

      {safe.length > 0 && filtered.length < safe.length && (
        <div style={{ textAlign:"center", marginTop:16 }}>
          <SBtn v="ghost" color={COLOR} onClick={() => setFilter("all")}>View All {safe.length} Items</SBtn>
        </div>
      )}

      {/* ── Deduct sheet ─────────────────────────────────────── */}
      <SSheet open={deductOpen} onClose={() => setDeductOpen(false)} title="📦 Deduct Stock" t={t}>
        {selected && (
          <>
            <div style={{ background:t.cardAlt, border:`1px solid ${COLOR}22`, borderRadius:14, padding:"15px 16px", marginBottom:20, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ color:t.text, fontWeight:800, fontSize:16 }}>{selected.name}</div>
                <div style={{ color:t.sub, fontSize:12, marginTop:3 }}>{selected.category || ""} · {selected.unit}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ color:COLOR, fontWeight:900, fontSize:32, fontVariantNumeric:"tabular-nums", textShadow:`0 0 24px ${COLOR}60` }}>{selected.stock}</div>
                <div style={{ color:t.sub, fontSize:11, marginTop:2 }}>{selected.unit} in stock</div>
              </div>
            </div>
            <div style={{ color:t.sub, fontSize:9, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12 }}>DEDUCT QUANTITY</div>
            <div style={{ display:"flex", justifyContent:"center", marginBottom:22 }}>
              <SQtyPicker value={deductQty} onChange={setDeductQty} min={0} max={selected.stock} t={t} color={COLOR} />
            </div>
            <SBtn v="primary" color={COLOR} onClick={handleDeduct} full style={{ padding:"14px 0", borderRadius:12, fontSize:14 }}>
              Deduct {deductQty > 0 ? deductQty : ""} {selected.unit || "units"} from Stock
            </SBtn>
          </>
        )}
      </SSheet>

      {/* ── Usage Entry sheet ─────────────────────────────────── */}
      <SSheet open={usageOpen} onClose={() => setUsageOpen(false)} title="📋 Log Usage Entry" t={t}>
        <div style={{ marginBottom:16 }}>
          <div style={{ color:t.sub, fontSize:9, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>SELECT MATERIAL</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:200, overflowY:"auto" }}>
            {safe.map(item => (
              <div key={item.id} onClick={() => setUsageItem(item)}
                style={{ padding:"10px 14px", borderRadius:10, cursor:"pointer", transition:"all 0.15s", border:`1.5px solid ${usageItem?.id === item.id ? COLOR+"60" : t.border}`, background: usageItem?.id === item.id ? `${COLOR}12` : t.cardAlt }}
              >
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ color:t.text, fontWeight:700, fontSize:13 }}>{item.name}</span>
                  <span style={{ color:statusColor(item._status || "ok"), fontSize:11, fontWeight:700 }}>{item.stock} {item.unit}</span>
                </div>
              </div>
            ))}
            {safe.length === 0 && <div style={{ color:t.muted, fontSize:12, textAlign:"center", padding:"16px 0" }}>No inventory items</div>}
          </div>
        </div>

        {usageItem && (
          <>
            <div style={{ color:t.sub, fontSize:9, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>QUANTITY USED</div>
            <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}>
              <SQtyPicker value={usageQty} onChange={setUsageQty} min={0} max={usageItem.stock} t={t} color={COLOR} />
            </div>
            <div style={{ marginBottom:16 }}>
              <div style={{ color:t.sub, fontSize:9, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>REASON (OPTIONAL)</div>
              <input
                value={usageReason}
                onChange={e => setUsageReason(e.target.value)}
                placeholder="e.g. Production batch #42, machine maintenance..."
                style={{ ...inp }}
              />
            </div>
            <SBtn v="primary" color={COLOR} onClick={handleUsage} full style={{ padding:"14px 0", borderRadius:12, fontSize:14 }}>
              ✅ Log {usageQty > 0 ? usageQty : ""} {usageItem.unit || "units"} Used
            </SBtn>
          </>
        )}
      </SSheet>

      {/* ── Receive Material sheet ────────────────────────────── */}
      <SSheet open={receiveOpen} onClose={() => setReceiveOpen(false)} title="📥 Receive Material" t={t}>
        <div style={{ marginBottom:16 }}>
          <div style={{ color:t.sub, fontSize:9, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>SELECT MATERIAL</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:200, overflowY:"auto" }}>
            {safe.map(item => (
              <div key={item.id} onClick={() => setReceiveItem(item)}
                style={{ padding:"10px 14px", borderRadius:10, cursor:"pointer", transition:"all 0.15s", border:`1.5px solid ${receiveItem?.id === item.id ? COLOR+"60" : t.border}`, background: receiveItem?.id === item.id ? `${COLOR}12` : t.cardAlt }}
              >
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ color:t.text, fontWeight:700, fontSize:13 }}>{item.name}</span>
                  <span style={{ color:t.sub, fontSize:11 }}>Current: {item.stock} {item.unit}</span>
                </div>
              </div>
            ))}
            {safe.length === 0 && <div style={{ color:t.muted, fontSize:12, textAlign:"center", padding:"16px 0" }}>No inventory items</div>}
          </div>
        </div>

        {receiveItem && (
          <>
            <div style={{ color:t.sub, fontSize:9, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>QUANTITY RECEIVED</div>
            <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}>
              <SQtyPicker value={receiveQty} onChange={setReceiveQty} min={0} t={t} color={COLOR} />
            </div>
            <div style={{ marginBottom:16 }}>
              <div style={{ color:t.sub, fontSize:9, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>SUPPLIER / SOURCE (OPTIONAL)</div>
              <input
                value={receiveSrc}
                onChange={e => setReceiveSrc(e.target.value)}
                placeholder="e.g. Ravi Supplies, local market..."
                style={{ ...inp }}
              />
            </div>
            <SBtn v="primary" color={COLOR} onClick={handleReceive} full style={{ padding:"14px 0", borderRadius:12, fontSize:14 }}>
              ✅ Add {receiveQty > 0 ? receiveQty : ""} {receiveItem.unit || "units"} to Stock
            </SBtn>
          </>
        )}
      </SSheet>
    </div>
  );
}
