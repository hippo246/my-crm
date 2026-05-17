/* eslint-disable */
import React from "react";
import { SectionHeader, TabStatCards, Card } from "../components/ui";
import { T } from "../lib/theme";
import { inr } from "../lib/utils";
import { exportTabPDF, exportTabExcel } from "../lib/exports";
import { CRMTable, CRMTablePager, col } from "../components/CRMTable";

export default function SuppliesTab({
  dm, isAdmin, can, canSeeFinancials,
  supplies, settings, srch,
  fSup, totalSupC, lowStockItems,
  setSf, setSsh, blkS, delS,
}) {
  const t = T(dm);

  const supThisMonth     = supplies.filter(s => s.date?.startsWith(new Date().toISOString().slice(0, 7)));
  const supThisMonthCost = supThisMonth.reduce((a, s) => a + (s.cost || 0), 0);
  const uniqueSuppliers  = [...new Set(supplies.map(s => s.supplier).filter(Boolean))];
  const suppByName = uniqueSuppliers
    .map(sup => ({
      name:  sup,
      count: supplies.filter(s => s.supplier === sup).length,
      total: supplies.filter(s => s.supplier === sup).reduce((a, s) => a + (s.cost || 0), 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const maxSup = suppByName[0]?.total || 1;

  const sortedSup = [...fSup].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const columns = [
    col({ key: "item",     label: "Item",     flex: true, type: "text",
      render: (v, row) => {
        const isLow = row.minStock && (+row.qty || 0) <= (+row.minStock);
        return (
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: isLow ? "#ef4444" : "#10b981", flexShrink: 0, display: "inline-block" }} />
            <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
            {isLow && <span style={{ background: "#ef444415", color: "#ef4444", border: "1px solid #ef444430", borderRadius: 5, padding: "1px 5px", fontSize: 9, fontWeight: 700, flexShrink: 0 }}>LOW</span>}
            {row.notes && <span style={{ color: t.sub, fontSize: 10, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.notes}</span>}
          </span>
        );
      },
    }),
    col({ key: "supplier", label: "Supplier", width: 140, type: "text" }),
    col({ key: "date",     label: "Date",     width: 110, type: "date", sortable: true }),
    col({ key: "qty",      label: "Qty",      width: 90,  type: "number", align: "right",
      render: (v, row) => {
        const isLow = row.minStock && (+row.qty || 0) <= (+row.minStock);
        return <span style={{ color: isLow ? "#ef4444" : t.text, fontWeight: 800 }}>{v} <span style={{ color: t.sub, fontSize: 10, fontWeight: 400 }}>{row.unit}</span></span>;
      },
    }),
    ...(can("sup_seeCost") ? [col({ key: "cost", label: "Cost", width: 100, type: "number", align: "right", format: inr, color: () => "#7c3aed" })] : []),
    col({ key: "minStock", label: "Stock",   width: 90,
      render: (v, row) => {
        const isLow = row.minStock && (+row.qty || 0) <= (+row.minStock);
        if (!row.minStock) return <span style={{ color: t.sub, fontSize: 11 }}>—</span>;
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: isLow ? "#ef444415" : "#10b98115", color: isLow ? "#dc2626" : "#059669", border: `1px solid ${isLow ? "#ef444425" : "#10b98125"}`, borderRadius: 99, padding: "2px 8px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>
            {isLow ? "⚠️ Low" : "✓ OK"}
          </span>
        );
      },
    }),
  ];

  const footerRow = can("sup_seeCost") ? {
    item: `${fSup.length} entries`,
    cost: fSup.reduce((a, s) => a + (s.cost || 0), 0),
  } : undefined;

  return (<>
    <SectionHeader dm={dm} title="Supplies" sub="Track inventory and supplier costs" cta={null} />

    {canSeeFinancials && <TabStatCards dm={dm} cards={[
      { icon: "📦", label: "Total Cost",  value: inr(totalSupC),         sub: `${supplies.length} entries`,                                     iconBg: t.statIcon4 },
      { icon: "📅", label: "This Month",  value: inr(supThisMonthCost),  sub: `${supThisMonth.length} entries`,                                 iconBg: t.statIcon3 },
      { icon: "🏪", label: "Suppliers",   value: uniqueSuppliers.length, sub: "unique vendors",                                                 iconBg: t.statIcon1 },
      { icon: "⚠️", label: "Low Stock",   value: lowStockItems.length,   sub: lowStockItems.length === 0 ? "all good" : "need restocking",      iconBg: lowStockItems.length > 0 ? t.statIcon5 : t.statIcon2 },
    ]} />}

    {/* Top Suppliers chart */}
    {canSeeFinancials && suppByName.length > 0 && <Card dm={dm} className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p style={{ color: t.text, fontSize: 14, fontWeight: 700 }}>Top Suppliers by Spend</p>
          <p style={{ color: t.sub, fontSize: 11, marginTop: 2 }}>Showing top {suppByName.length} vendors</p>
        </div>
        <span style={{ background: dm ? "rgba(139,92,246,0.15)" : "rgba(139,92,246,0.1)", color: "#8b5cf6", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(139,92,246,0.3)" }}>📊 Spend</span>
      </div>
      {suppByName.map((s, i) => {
        const pct = Math.round(s.total / maxSup * 100);
        const colors = ["#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#f43f5e"];
        const c = colors[i % colors.length];
        return <div key={s.name} className="mb-3 last:mb-0">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div style={{ width: 8, height: 8, borderRadius: 2, background: c, flexShrink: 0 }} />
              <p style={{ color: t.text, fontSize: 13, fontWeight: 600 }}>{s.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <span style={{ color: c, fontWeight: 700, fontSize: 13 }}>{inr(s.total)}</span>
              <span style={{ color: t.sub, fontSize: 11, background: t.inp, padding: "2px 6px", borderRadius: 6 }}>{s.count}×</span>
            </div>
          </div>
          <div style={{ background: t.border, height: 6, borderRadius: 6, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, background: `linear-gradient(90deg,${c},${c}cc)`, height: "100%", borderRadius: 6, transition: "width 0.4s ease" }} />
          </div>
        </div>;
      })}
    </Card>}

    {/* Toolbar */}
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: "12px 14px" }} className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 flex-wrap">
        <span style={{ color: t.text, fontSize: 13, fontWeight: 700 }}>{fSup.length} {fSup.length === 1 ? "entry" : "entries"}</span>
        {canSeeFinancials && supplies.length > 0 && <span style={{ color: "#8b5cf6", background: dm ? "rgba(139,92,246,0.12)" : "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)", fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 8 }}>{inr(fSup.reduce((a, s) => a + (s.cost || 0), 0))}</span>}
        {lowStockItems.length > 0 && <span style={{ color: "#ef4444", background: dm ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 8 }}>⚠️ {lowStockItems.length} low</span>}
      </div>
      <div className="flex gap-3 items-center">
        {can("sup_export") && <div className="flex gap-2">
          <button onClick={() => exportTabPDF("Supplies", supplies, [{ label: "Item", key: "item" }, { label: "Qty", key: "qty", num: true }, { label: "Unit", key: "unit" }, { label: "Supplier", key: "supplier" }, { label: "Cost (₹)", key: "cost", num: true }, { label: "Date", key: "date" }], settings)}
            style={{ background: t.inp, color: t.sub, border: `1px solid ${t.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>PDF</button>
          <button onClick={() => exportTabExcel("Supplies", supplies, [{ label: "Item", key: "item" }, { label: "Qty", key: "qty", num: true }, { label: "Unit", key: "unit" }, { label: "Supplier", key: "supplier" }, { label: "Cost", key: "cost", num: true }, { label: "Min Stock", key: "minStock" }, { label: "Date", key: "date" }], settings)}
            style={{ background: t.inp, color: t.sub, border: `1px solid ${t.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>XLS</button>
        </div>}
        {can("sup_add") && <button onClick={() => { setSf(blkS()); setSsh("add"); }}
          style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, minHeight: 40, boxShadow: "0 2px 8px rgba(37,99,235,0.35)" }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add Supply
        </button>}
      </div>
    </div>

    {/* Empty state */}
    {fSup.length === 0 && (
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: "40px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
        <p style={{ color: t.text, fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{srch ? "No results found" : "No supplies yet"}</p>
        <p style={{ color: t.sub, fontSize: 13, marginBottom: 16 }}>{srch ? "Try a different search term" : "Log your first supply entry"}</p>
        {!srch && can("sup_add") && <button onClick={() => { setSf(blkS()); setSsh("add"); }} style={{ background: "#8b5cf6", color: "#fff", border: "none", borderRadius: 12, padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>+ Log Supply</button>}
      </div>
    )}

    {/* ── CRMTable ── */}
    {fSup.length > 0 && (
      <CRMTable
        t={t}
        rows={sortedSup}
        columns={columns}
        onDelete={can("sup_delete") ? delS : undefined}
        onRowClick={(row) => { setSf({ ...row }); setSsh(row); }}
        keyField="id"
        emptyText="No supplies found"
        stickyHeader
        zebra
        density="compact"
        defaultSort={{ key: "date", dir: "desc" }}
        footerRow={footerRow}
      />
    )}
  </>);
}
