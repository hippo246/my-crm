/* eslint-disable react-hooks/exhaustive-deps */
/**
 * CRMTable.js — src/components/CRMTable.js
 * ─────────────────────────────────────────────────────────────────────────────
 * A dense, keyboard-navigable, inline-editable table for every tab.
 *
 * USAGE EXAMPLE (Expenses tab):
 * ─────────────────────────────
 * import { CRMTable } from "../components/CRMTable";
 *
 * <CRMTable
 *   t={t}
 *   rows={filteredExpenses}
 *   columns={[
 *     { key: "date",          label: "Date",    width: 110, type: "date",   editable: true },
 *     { key: "category",      label: "Category",width: 140, type: "select", editable: true, options: EXPENSE_CATS },
 *     { key: "amount",        label: "Amount",  width: 100, type: "number", editable: true, format: inr },
 *     { key: "paymentMethod", label: "Method",  width: 100, type: "select", editable: true, options: ["Cash","UPI","Card"] },
 *     { key: "vendor",        label: "Vendor",  width: 140, type: "text",   editable: true },
 *     { key: "notes",         label: "Notes",   flex: true, type: "text",   editable: true },
 *   ]}
 *   onSave={(row) => saveE(row)}        // called with the full updated row
 *   onDelete={(row) => delE(row)}       // optional delete handler
 *   onRowClick={(row) => setDetailModal({ type:"expense", data:row })}
 *   keyField="id"                       // unique row identifier (default "id")
 *   emptyText="No expenses yet"
 *   stickyHeader                        // pin header on scroll
 *   zebra                               // alternate row shading
 *   density="compact"                   // "compact" | "normal" | "relaxed"
 * />
 *
 * KEYBOARD SHORTCUTS (when a cell is focused / editing):
 *   Enter / Tab      → commit edit, move to next editable cell right
 *   Shift+Tab        → commit, move left
 *   ArrowDown/Up     → commit, move down/up same column
 *   Escape           → discard edit
 *   F2 / Space       → enter edit mode on focused cell
 *   Delete           → clear the focused cell value
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
const DENSITY = {
  compact: { rowH: 36,  fontSize: 12, cellPad: "0 10px" },
  normal:  { rowH: 44,  fontSize: 13, cellPad: "0 12px" },
  relaxed: { rowH: 52,  fontSize: 14, cellPad: "0 14px" },
};

// ── Tiny helpers ─────────────────────────────────────────────────────────────
function coerce(value, type) {
  if (type === "number") return value === "" ? "" : Number(value);
  return value ?? "";
}

function displayVal(col, value) {
  if (value === null || value === undefined || value === "") return "—";
  if (col.format) return col.format(value);
  return String(value);
}

// ── Cell editor ──────────────────────────────────────────────────────────────
function CellEditor({ col, value, onCommit, onCancel, t, rowH }) {
  const [draft, setDraft] = useState(value ?? "");
  const ref = useRef(null);

  useEffect(() => { ref.current?.focus(); ref.current?.select?.(); }, []);

  const commit = () => onCommit(coerce(draft, col.type));
  const cancel = () => onCancel();

  const style = {
    width: "100%", height: rowH - 2, background: t.inp,
    border: `2px solid #2563eb`, borderRadius: 6, outline: "none",
    color: t.text, fontSize: 12, padding: "0 8px", fontFamily: "inherit",
  };

  const handleKey = (e) => {
    if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); commit(); }
    else if (e.key === "Escape") { e.preventDefault(); cancel(); }
  };

  if (col.type === "select" && col.options?.length) {
    return (
      <select ref={ref} value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKey}
        style={{ ...style, cursor: "pointer" }}>
        {col.options.map(o => {
          const v = typeof o === "object" ? o.value : o;
          const l = typeof o === "object" ? o.label : o;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    );
  }

  if (col.type === "date") {
    return (
      <input ref={ref} type="date" value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKey}
        style={{ ...style, cursor: "pointer" }} />
    );
  }

  return (
    <input ref={ref}
      type={col.type === "number" ? "number" : "text"}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKey}
      style={style} />
  );
}

// ── Sort indicator ───────────────────────────────────────────────────────────
function SortIcon({ direction }) {
  if (!direction) return <span style={{ opacity: 0.25, fontSize: 10 }}>⇅</span>;
  return <span style={{ fontSize: 10 }}>{direction === "asc" ? "↑" : "↓"}</span>;
}

// ── Main CRMTable ─────────────────────────────────────────────────────────────
export function CRMTable({
  t,
  rows = [],
  columns = [],
  onSave,
  onDelete,
  onRowClick,
  keyField = "id",
  emptyText = "No data",
  stickyHeader = false,
  zebra = true,
  density = "normal",
  defaultSort,           // { key, dir: "asc"|"desc" }
  showRowNumbers = false,
  selectable = false,    // checkbox column on left
  onSelectionChange,
  maxHeight,             // e.g. "60vh" — wraps in scrollable container
  footerRow,             // object with same keys as columns for a totals row
}) {
  const den = DENSITY[density] || DENSITY.normal;

  // ── Sort state ─────────────────────────────────────────────────────────────
  const [sort, setSort] = useState(defaultSort || null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find(c => c.key === sort.key);
    return [...rows].sort((a, b) => {
      let va = a[sort.key], vb = b[sort.key];
      if (col?.type === "number") { va = +va || 0; vb = +vb || 0; }
      else { va = String(va ?? ""); vb = String(vb ?? ""); }
      return sort.dir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }, [rows, sort]);

  const toggleSort = useCallback((key) => {
    setSort(prev =>
      prev?.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }, []);

  // ── Selection state ────────────────────────────────────────────────────────
  const [selected, setSelected] = useState(new Set());

  const toggleRow = useCallback((id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      onSelectionChange?.(Array.from(next));
      return next;
    });
  }, [onSelectionChange]);

  const toggleAll = useCallback(() => {
    setSelected(prev => {
      const allIds = sorted.map(r => r[keyField]);
      const next = prev.size === allIds.length ? new Set() : new Set(allIds);
      onSelectionChange?.(Array.from(next));
      return next;
    });
  }, [sorted, keyField, onSelectionChange]);

  // ── Inline edit state ──────────────────────────────────────────────────────
  // editCell: { rowId, colKey } | null
  const [editCell, setEditCell] = useState(null);
  // pendingEdits: { [rowId]: { ...changedFields } }
  const [pendingEdits, setPendingEdits] = useState({});
  // focusCell: { rowIdx, colIdx } for keyboard nav
  const [focusCell, setFocusCell] = useState(null);

  // eslint-disable-next-line no-unused-vars
  const editableCols = useMemo(() => columns.filter(c => c.editable !== false && c.editable !== undefined ? c.editable : false), [columns]);
  // eslint-disable-next-line no-unused-vars
  const colKeys      = useMemo(() => columns.map(c => c.key), [columns]);

  const getRowVal = useCallback((row, key) => {
    const edits = pendingEdits[row[keyField]];
    return edits && key in edits ? edits[key] : row[key];
  }, [pendingEdits, keyField]);

  const startEdit = useCallback((rowId, colKey) => {
    const col = columns.find(c => c.key === colKey);
    if (!col?.editable || !onSave) return;
    setEditCell({ rowId, colKey });
  }, [columns, onSave]);

  const commitEdit = useCallback((rowId, colKey, newVal) => {
    setEditCell(null);
    setPendingEdits(prev => {
      const rowEdits = { ...(prev[rowId] || {}), [colKey]: newVal };
      return { ...prev, [rowId]: rowEdits };
    });
    // Fire onSave with merged row
    const row  = sorted.find(r => r[keyField] === rowId);
    if (!row) return;
    const edits = { ...(pendingEdits[rowId] || {}), [colKey]: newVal };
    onSave?.({ ...row, ...edits });
  }, [sorted, keyField, pendingEdits, onSave]);

  const cancelEdit = useCallback(() => setEditCell(null), []);

  // ── Keyboard nav on the table container ───────────────────────────────────
  const tableRef = useRef(null);

  const navToCell = useCallback((rIdx, cIdx) => {
    if (rIdx < 0 || rIdx >= sorted.length) return;
    if (cIdx < 0 || cIdx >= columns.length) return;
    setFocusCell({ rowIdx: rIdx, colIdx: cIdx });
    setEditCell(null);
  }, [sorted.length, columns.length]);

  const handleTableKey = useCallback((e) => {
    if (editCell) return; // editor handles its own keys
    if (!focusCell) return;

    const { rowIdx, colIdx } = focusCell;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        navToCell(rowIdx + 1, colIdx);
        break;
      case "ArrowUp":
        e.preventDefault();
        navToCell(rowIdx - 1, colIdx);
        break;
      case "ArrowRight":
        e.preventDefault();
        navToCell(rowIdx, colIdx + 1);
        break;
      case "ArrowLeft":
        e.preventDefault();
        navToCell(rowIdx, colIdx - 1);
        break;
      case "Tab":
        e.preventDefault();
        if (e.shiftKey) navToCell(rowIdx, colIdx - 1);
        else if (colIdx < columns.length - 1) navToCell(rowIdx, colIdx + 1);
        else navToCell(rowIdx + 1, 0);
        break;
      case "Enter":
      case "F2": {
        e.preventDefault();
        const col = columns[colIdx];
        const row = sorted[rowIdx];
        if (col?.editable && onSave) startEdit(row[keyField], col.key);
        break;
      }
      case " ": {
        // Space = enter edit OR toggle checkbox
        e.preventDefault();
        if (selectable && colIdx === 0) {
          toggleRow(sorted[rowIdx][keyField]);
        } else {
          const col = columns[colIdx];
          const row = sorted[rowIdx];
          if (col?.editable && onSave) startEdit(row[keyField], col.key);
        }
        break;
      }
      case "Delete":
      case "Backspace": {
        e.preventDefault();
        const col = columns[colIdx];
        const row = sorted[rowIdx];
        if (col?.editable && onSave) commitEdit(row[keyField], col.key, "");
        break;
      }
      default:
        break;
    }
  }, [editCell, focusCell, navToCell, columns, sorted, keyField, startEdit, commitEdit, selectable, toggleRow]);

  // ── Scroll focused cell into view ─────────────────────────────────────────
  useEffect(() => {
    if (!focusCell) return;
    const el = tableRef.current?.querySelector(`[data-cell="${focusCell.rowIdx}-${focusCell.colIdx}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
    el?.focus();
  }, [focusCell]);

  // ── Styles ────────────────────────────────────────────────────────────────
  const headerStyle = {
    background: t.card,
    borderBottom: `2px solid ${t.border}`,
    position: stickyHeader ? "sticky" : "static",
    top: 0,
    zIndex: 10,
  };

  const thStyle = (col, i) => ({
    padding: den.cellPad,
    height: 36,
    textAlign: col.align || (col.type === "number" ? "right" : "left"),
    fontSize: 10,
    fontWeight: 700,
    color: t.sub,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    userSelect: "none",
    cursor: col.sortable !== false ? "pointer" : "default",
    whiteSpace: "nowrap",
    width: col.flex ? undefined : (col.width || 120),
    minWidth: col.minWidth || (col.flex ? 80 : undefined),
    borderRight: i < columns.length - 1 ? `1px solid ${t.border}` : "none",
  });

  const tdStyle = (col, rowIdx, colIdx, isFocused) => ({
    padding: editCell?.colKey === col.key ? "1px 1px" : den.cellPad,
    height: den.rowH,
    fontSize: den.fontSize,
    color: t.text,
    verticalAlign: "middle",
    textAlign: col.align || (col.type === "number" ? "right" : "left"),
    whiteSpace: col.wrap ? "normal" : "nowrap",
    overflow: col.wrap ? "visible" : "hidden",
    textOverflow: "ellipsis",
    maxWidth: col.flex ? undefined : (col.width || 120),
    width: col.flex ? undefined : (col.width || 120),
    borderRight: colIdx < columns.length - 1 ? `1px solid ${t.border}` : "none",
    outline: isFocused ? `2px solid #2563eb` : "none",
    outlineOffset: -2,
    cursor: col.editable && onSave ? "text" : onRowClick ? "pointer" : "default",
    transition: "background 0.1s",
    position: "relative",
  });

  const rowStyle = (rowIdx, isSelected) => ({
    background: isSelected
      ? "#2563eb18"
      : zebra && rowIdx % 2 === 1
        ? (t.inp + "88")
        : "transparent",
    borderBottom: `1px solid ${t.border}`,
    transition: "background 0.1s",
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  const tableWrap = {
    overflowX: "auto",
    overflowY: maxHeight ? "auto" : "visible",
    maxHeight: maxHeight || undefined,
    WebkitOverflowScrolling: "touch",
    borderRadius: 12,
    border: `1px solid ${t.border}`,
  };

  const allSelected = sorted.length > 0 && selected.size === sorted.length;

  return (
    <div style={tableWrap}
      ref={tableRef}
      tabIndex={-1}
      onKeyDown={handleTableKey}
      onBlur={() => { /* keep focusCell — only clear on outside click */ }}>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <thead style={headerStyle}>
          <tr>
            {/* Row numbers */}
            {showRowNumbers && (
              <th style={{ ...thStyle({ width: 36 }, -1), width: 36, textAlign: "center", cursor: "default" }}>#</th>
            )}
            {/* Select all checkbox */}
            {selectable && (
              <th style={{ ...thStyle({ width: 40 }, -1), width: 40, textAlign: "center", cursor: "pointer" }}
                onClick={toggleAll}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll}
                  style={{ cursor: "pointer", width: 14, height: 14 }} />
              </th>
            )}
            {/* Column headers */}
            {columns.map((col, i) => (
              <th key={col.key}
                style={thStyle(col, i)}
                onClick={() => col.sortable !== false && toggleSort(col.key)}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {col.label}
                  {col.sortable !== false && <SortIcon direction={sort?.key === col.key ? sort.dir : null} />}
                </span>
              </th>
            ))}
            {/* Delete column */}
            {onDelete && (
              <th style={{ ...thStyle({ width: 40 }, columns.length), width: 40, cursor: "default" }} />
            )}
          </tr>
        </thead>

        {/* ── BODY ─────────────────────────────────────────────────────────── */}
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (showRowNumbers ? 1 : 0) + (selectable ? 1 : 0) + (onDelete ? 1 : 0)}
                style={{ textAlign: "center", padding: "32px 16px", color: t.sub, fontSize: 13 }}>
                {emptyText}
              </td>
            </tr>
          ) : sorted.map((row, rowIdx) => {
            const rowId     = row[keyField];
            const isSelected = selected.has(rowId);

            return (
              <tr key={rowId || rowIdx}
                style={rowStyle(rowIdx, isSelected)}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = t.inp + "cc"; }}
                onMouseLeave={e => { e.currentTarget.style.background = isSelected ? "#2563eb18" : zebra && rowIdx % 2 === 1 ? (t.inp + "88") : "transparent"; }}>

                {showRowNumbers && (
                  <td style={{ padding: den.cellPad, height: den.rowH, fontSize: 11, color: t.sub, textAlign: "center", borderRight: `1px solid ${t.border}` }}>
                    {rowIdx + 1}
                  </td>
                )}

                {selectable && (
                  <td style={{ padding: den.cellPad, height: den.rowH, textAlign: "center", borderRight: `1px solid ${t.border}` }}
                    onClick={e => { e.stopPropagation(); toggleRow(rowId); }}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleRow(rowId)}
                      style={{ cursor: "pointer", width: 14, height: 14 }} />
                  </td>
                )}

                {columns.map((col, colIdx) => {
                  const isFocused  = focusCell?.rowIdx === rowIdx && focusCell?.colIdx === colIdx;
                  const isEditing  = editCell?.rowId === rowId && editCell?.colKey === col.key;
                  const val        = getRowVal(row, col.key);
                  const isDirty    = pendingEdits[rowId] && col.key in pendingEdits[rowId];

                  return (
                    <td key={col.key}
                      data-cell={`${rowIdx}-${colIdx}`}
                      tabIndex={0}
                      style={tdStyle(col, rowIdx, colIdx, isFocused)}
                      onFocus={() => setFocusCell({ rowIdx, colIdx })}
                      onClick={(e) => {
                        setFocusCell({ rowIdx, colIdx });
                        if (col.editable && onSave) {
                          e.stopPropagation();
                          startEdit(rowId, col.key);
                        } else if (onRowClick) {
                          onRowClick(row);
                        }
                      }}
                      onDoubleClick={(e) => {
                        if (col.editable && onSave) {
                          e.stopPropagation();
                          startEdit(rowId, col.key);
                        }
                      }}>

                      {isEditing ? (
                        <CellEditor
                          col={col}
                          value={val}
                          onCommit={(v) => commitEdit(rowId, col.key, v)}
                          onCancel={cancelEdit}
                          t={t}
                          rowH={den.rowH}
                        />
                      ) : (
                        <span style={{
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          color: col.color?.(val, row) || (isDirty ? "#f59e0b" : (col.valueColor?.[val] || t.text)),
                          fontWeight: col.bold?.(val, row) ? 700 : undefined,
                        }}>
                          {col.render ? col.render(val, row) : displayVal(col, val)}
                          {isDirty && <span style={{ marginLeft: 4, fontSize: 9, color: "#f59e0b" }}>●</span>}
                        </span>
                      )}
                    </td>
                  );
                })}

                {/* Delete cell */}
                {onDelete && (
                  <td style={{ textAlign: "center", padding: "0 4px", height: den.rowH, borderLeft: `1px solid ${t.border}` }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(row); }}
                      title="Delete"
                      style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14, padding: "4px 6px", borderRadius: 6, opacity: 0.5, transition: "opacity 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = "#ef444415"; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = "0.5"; e.currentTarget.style.background = "transparent"; }}>
                      ✕
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>

        {/* ── FOOTER (totals row) ───────────────────────────────────────────── */}
        {footerRow && (
          <tfoot>
            <tr style={{ background: t.inp, borderTop: `2px solid ${t.border}` }}>
              {showRowNumbers && <td style={{ height: den.rowH, borderRight: `1px solid ${t.border}` }} />}
              {selectable      && <td style={{ height: den.rowH, borderRight: `1px solid ${t.border}` }} />}
              {columns.map((col, i) => {
                const val = footerRow[col.key];
                return (
                  <td key={col.key} style={{
                    padding: den.cellPad, height: den.rowH,
                    fontSize: den.fontSize, fontWeight: 800,
                    textAlign: col.align || (col.type === "number" ? "right" : "left"),
                    color: t.text,
                    borderRight: i < columns.length - 1 ? `1px solid ${t.border}` : "none",
                  }}>
                    {val !== undefined ? (col.format ? col.format(val) : val) : ""}
                  </td>
                );
              })}
              {onDelete && <td />}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ── Convenience: Pagination bar ───────────────────────────────────────────────
export function CRMTablePager({ page, total, pageSize = 50, onChange, t }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <div className="crm-pagination">
      <span style={{ color: t.sub, fontSize: 12 }}>
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => onChange(1)}        disabled={page === 1}          style={pagerBtn(t, page === 1)}>«</button>
        <button onClick={() => onChange(page - 1)} disabled={page === 1}          style={pagerBtn(t, page === 1)}>‹</button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
          return (
            <button key={p} onClick={() => onChange(p)}
              style={pagerBtn(t, false, p === page)}>
              {p}
            </button>
          );
        })}
        <button onClick={() => onChange(page + 1)} disabled={page === totalPages} style={pagerBtn(t, page === totalPages)}>›</button>
        <button onClick={() => onChange(totalPages)} disabled={page === totalPages} style={pagerBtn(t, page === totalPages)}>»</button>
      </div>
    </div>
  );
}

function pagerBtn(t, disabled, active = false) {
  return {
    background: active ? "#2563eb" : t.inp,
    color: active ? "#fff" : disabled ? t.sub : t.text,
    border: `1px solid ${active ? "#2563eb" : t.border}`,
    borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1,
    minHeight: 32, minWidth: 32,
  };
}

// ── Convenience: Column builder helper ───────────────────────────────────────
/**
 * col({ key, label, ...rest }) — tiny factory for clean column definitions
 * Defaults: sortable=true, editable=false
 */
export function col(def) {
  return { sortable: true, editable: false, ...def };
}
