/* eslint-disable */

// ═══════════════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════════════

function today() { return new Date().toISOString().slice(0, 10); }

// ── Util helpers (mirrors lib/utils.js — kept local so exports.js has zero imports) ──
function inr(n) {
  const num = Number(n) || 0;
  return "₹" + num.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function lineTotal(orderLines) {
  if (!orderLines || typeof orderLines !== "object") return 0;
  return Object.values(orderLines).reduce((s, l) => {
    if (!l || !l.qty || !l.price) return s;
    return s + (Number(l.qty) || 0) * (Number(l.price) || 0);
  }, 0);
}
function lineRows(orderLines, products) {
  if (!orderLines || typeof orderLines !== "object") return [];
  return Object.entries(orderLines)
    .map(([prodId, l]) => {
      if (!l || !l.qty || Number(l.qty) === 0) return null;
      const prod = (products || []).find(p => p.id === prodId);
      return {
        prodId,
        name: prod?.name || l.name || prodId,
        unit: prod?.unit || l.unit || "",
        qty: Number(l.qty) || 0,
        price: Number(l.price) || 0,
        priceAmount: Number(l.price) || 0,
        total: (Number(l.qty) || 0) * (Number(l.price) || 0),
      };
    })
    .filter(Boolean);
}
function exportPDF(record, products, type, settings, deliveries) {
  const rows   = lineRows(record.orderLines||record.orders||{}, products);
  const total  = lineTotal(record.orderLines||record.orders||{});
  const name   = record.name || record.customer || "—";
  const co     = settings?.companyName    || "TAS Healthy World";
  const cosub  = settings?.companySubtitle|| "Malabar Paratha Factory · Goa, India";
  const gst    = settings?.companyGST     || "";
  const coPhone= settings?.companyPhone   || "";
  const coLogo = settings?.companyLogo    || "";
  const invoiceNo=record.invNo||`INV-${(record.date||today()).replace(/-/g,"")}-${(record.id||uid()).slice(-4).toUpperCase()}`;

  // ── Customer delivery history (only for customer type) ──
  let historyHtml = "";
  if(type==="customer" && Array.isArray(deliveries)) {
    const cDelivs = [...deliveries.filter(d=>d.customerId===record.id)].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
    const cDone   = cDelivs.filter(d=>d.status==="Delivered");
    const cPend   = cDelivs.filter(d=>d.status==="Pending"||d.status==="In Transit");
    const cCanc   = cDelivs.filter(d=>d.status==="Cancelled");
    const cRepl   = cDelivs.filter(d=>d.replacement?.done);
    const totalRev= cDone.reduce((s,d)=>s+lineTotal(d.orderLines),0);
    const totalReplAmt=cDelivs.reduce((s,d)=>s+(+d.replacement?.amount||0),0);
    const delivRate=cDelivs.length>0?Math.round(cDone.length/cDelivs.length*100):100;
    const lastD   = cDelivs[0];
    const lastDays= lastD?Math.floor((new Date()-new Date(lastD.date))/86400000):null;
    const joinDays= record.joinDate?Math.max(1,Math.floor((new Date()-new Date(record.joinDate))/86400000)):90;
    const ordersPerMonth= cDelivs.length>0?(cDelivs.length/(joinDays/30)).toFixed(1):0;

    historyHtml = `
    <div class="section-title">📊 Customer Summary</div>
    <div class="stat-grid">
      <div class="stat-box"><div class="stat-val">${cDelivs.length}</div><div class="stat-lbl">Total Orders</div></div>
      <div class="stat-box green-box"><div class="stat-val" style="color:#059669">${cDone.length}</div><div class="stat-lbl">Delivered</div></div>
      <div class="stat-box"><div class="stat-val" style="color:#f59e0b">${cPend.length}</div><div class="stat-lbl">Pending / Transit</div></div>
      <div class="stat-box red-box"><div class="stat-val" style="color:#dc2626">${cCanc.length}</div><div class="stat-lbl">Cancelled / Returned</div></div>
      <div class="stat-box"><div class="stat-val" style="color:#f97316">${cRepl.length}</div><div class="stat-lbl">Replacements</div></div>
      <div class="stat-box"><div class="stat-val">${delivRate}%</div><div class="stat-lbl">Delivery Rate</div></div>
      <div class="stat-box"><div class="stat-val">₹${totalRev.toLocaleString("en-IN")}</div><div class="stat-lbl">Total Revenue</div></div>
      <div class="stat-box"><div class="stat-val">${ordersPerMonth}/mo</div><div class="stat-lbl">Order Frequency</div></div>
    </div>

    <div class="section-title" style="margin-top:24px">💳 Payment Overview</div>
    <div class="stat-grid">
      <div class="stat-box green-box"><div class="stat-val" style="color:#059669">₹${(record.paid||0).toLocaleString("en-IN")}</div><div class="stat-lbl">Amount Paid</div></div>
      <div class="stat-box red-box"><div class="stat-val" style="color:#dc2626">₹${(record.pending||0).toLocaleString("en-IN")}</div><div class="stat-lbl">Amount Pending</div></div>
      ${(record.partialPay||0)>0?`<div class="stat-box"><div class="stat-val" style="color:#d97706">₹${(record.partialPay||0).toLocaleString("en-IN")}</div><div class="stat-lbl">Partial On Hold</div></div>`:""}
      ${totalReplAmt>0?`<div class="stat-box"><div class="stat-val" style="color:#f97316">−₹${totalReplAmt.toLocaleString("en-IN")}</div><div class="stat-lbl">Replacement Deducted</div></div>`:""}
      <div class="stat-box"><div class="stat-val">${lastDays===null?"Never":lastDays===0?"Today":lastDays===1?"Yesterday":lastDays+"d ago"}</div><div class="stat-lbl">Last Order</div></div>
    </div>

    ${cDelivs.length>0?`
    <div class="section-title" style="margin-top:24px">📦 Delivery History (${cDelivs.length} orders)</div>
    <table>
      <thead><tr>
        <th>Invoice No</th><th>Receipt No</th><th>Date</th><th>Status</th><th>Items</th><th>Order Total</th><th>Replacement</th><th>Repl. Amount</th><th>Net Payable</th><th>Collected</th><th>Balance Due</th><th>Notes</th>
      </tr></thead>
      <tbody>
        ${cDelivs.map((d,i)=>{
          const dTotal=lineTotal(d.orderLines);
          const dLineEntries=Object.entries(d.orderLines||{}).filter(([,l])=>l.qty>0);
          const itemsStr=dLineEntries.map(([pid,l])=>{const p=products.find(x=>x.id===pid);return `${l.qty}×${p?p.name:(l.name||pid)}`;}).join(", ");
          const statusColor=d.status==="Delivered"?"#059669":d.status==="In Transit"?"#2563eb":d.status==="Cancelled"?"#dc2626":"#d97706";
          const dReplAmt=+(d.replacement?.amount)||0;
          const dNetAmt=dTotal-dReplAmt;
          const dCollected=d.partialPayment?.enabled?(+(d.partialPayment?.amount)||0):0;
          const dBalance=Math.max(0,dNetAmt-dCollected);
          const dInvNo=d.invNo||`INV-${(d.date||"").replace(/-/g,"")}-${(d.id||"").slice(-4).toUpperCase()}`;
          const dRcptNo=`RCP-${dInvNo.replace(/^[A-Z]+-/,"")}`;
          return `<tr style="background:${i%2===0?"#fff":"#f8fafc"}">
            <td style="white-space:nowrap;font-family:monospace;font-size:10px;color:#7c3aed;font-weight:700">${dInvNo}</td>
            <td style="white-space:nowrap;font-family:monospace;font-size:10px;color:#0ea5e9;font-weight:700">${dRcptNo}</td>
            <td style="white-space:nowrap">${d.date||"—"}</td>
            <td><span style="background:${statusColor}18;color:${statusColor};padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700">${d.status||"Pending"}</span></td>
            <td style="font-size:11px;color:#475569">${itemsStr||"—"}</td>
            <td class="r" style="font-weight:700">₹${dTotal.toLocaleString("en-IN")}</td>
            <td style="font-size:11px">${d.replacement?.done?`<span style="color:#f97316;font-weight:600">🔄 ${d.replacement.item||"Done"}${d.replacement.qty?" ("+d.replacement.qty+")":""}</span>`:"—"}</td>
            <td class="r" style="color:#f97316;font-weight:700">${d.replacement?.done&&dReplAmt?"−₹"+dReplAmt.toLocaleString("en-IN"):"—"}</td>
            <td class="r" style="font-weight:700;color:#0f172a">₹${dNetAmt.toLocaleString("en-IN")}</td>
            <td class="r" style="color:#059669;font-weight:700">${dCollected>0?"₹"+dCollected.toLocaleString("en-IN"):"—"}</td>
            <td class="r" style="color:${dBalance===0?"#059669":"#d97706"};font-weight:800">${dBalance===0?"✓ Paid":"₹"+dBalance.toLocaleString("en-IN")}</td>
            <td style="font-size:11px;color:#94a3b8">${d.notes||"—"}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`:""
    }

    ${cRepl.length>0?`
    <div class="section-title" style="margin-top:28px">🔄 Replacement Log (${cRepl.length})</div>
    <table>
      <thead><tr><th>Date</th><th>Item Replaced</th><th>Qty</th><th>Reason</th><th>Amount Deducted</th></tr></thead>
      <tbody>
        ${cRepl.map((d,i)=>`<tr style="background:${i%2===0?"#fff":"#fef9f0"}">
          <td>${d.date||"—"}</td>
          <td>${d.replacement?.item||"—"}</td>
          <td>${d.replacement?.qty||"—"}</td>
          <td style="font-size:11px;color:#78716c">${d.replacement?.reason||"—"}</td>
          <td class="r" style="color:#f97316;font-weight:700">${d.replacement?.amount?"−₹"+Number(d.replacement.amount).toLocaleString("en-IN"):"—"}</td>
        </tr>`).join("")}
        <tr style="background:#fff7ed;font-weight:800">
          <td colspan="4">Total Deducted</td>
          <td class="r" style="color:#ea580c">−₹${totalReplAmt.toLocaleString("en-IN")}</td>
        </tr>
      </tbody>
    </table>`:""
    }
    `;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${type==="customer"?"Customer Report":"Invoice"} — ${name}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;color:#1c1917;padding:32px;max-width:860px;margin:0 auto}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #e7e5e4}
.brand{font-size:19px;font-weight:900;color:#92400e}.bsub{font-size:11px;color:#78716c;margin-top:3px}
.ititle{font-size:26px;font-weight:900;text-align:right}.imeta{font-size:11px;color:#78716c;text-align:right;margin-top:3px}
.slabel{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#a8a29e;margin:18px 0 5px}
.bname{font-size:15px;font-weight:700}.bsub2{font-size:11px;color:#78716c;margin-top:2px}
.badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700;margin-top:5px}
.bg{background:#d1fae5;color:#065f46}.by{background:#fef3c7;color:#92400e}.bb{background:#dbeafe;color:#1e40af}
.section-title{font-size:13px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:0.06em;margin:20px 0 10px;padding-bottom:6px;border-bottom:2px solid #e2e8f0}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:6px}
.stat-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px}
.green-box{background:#f0fdf4;border-color:#bbf7d0}.red-box{background:#fef2f2;border-color:#fecaca}
.stat-val{font-size:18px;font-weight:900;line-height:1;color:#0f172a}
.stat-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#94a3b8;margin-top:5px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:4px}
th{font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:#64748b;padding:8px 10px;border-bottom:2px solid #e2e8f0;text-align:left;background:#f1f5f9}
td{padding:8px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}
.r{text-align:right}.c{text-align:center}
.trow td{font-weight:800;font-size:14px;border:none;border-top:2px solid #1c1917;padding-top:11px}
.sumbox{display:flex;gap:20px;margin-top:20px;padding:14px;background:#f5f5f4;border-radius:8px;flex-wrap:wrap}
.sv{font-size:17px;font-weight:900;margin-top:2px}.sl{font-size:10px;color:#78716c}
.footer{margin-top:36px;text-align:center;font-size:10px;color:#a8a29e;padding-top:18px;border-top:1px solid #e7e5e4}
@media print{@page{size:A4;margin:1cm}body{padding:0}.no-print{display:none!important}}.print-bar{position:fixed;top:0;left:0;right:0;background:#1e3a5f;color:#fff;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;z-index:9999;font-family:Arial,sans-serif;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.3);gap:12px}.print-bar a{background:#3b82f6;color:#fff;padding:7px 16px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;white-space:nowrap}.print-bar a.dl{background:#059669}
</style></head><body>
<div class="hdr">
  <div><div class="brand">${coLogo?`<img src="${coLogo}" alt="logo" style="max-height:48px;max-width:120px;object-fit:contain;margin-bottom:4px;display:block"/>`:`<span>${settings?.appEmoji||"🫓"} </span>`}<span>${coLogo?"":""} ${co}</span></div><div class="bsub">${cosub}</div>${coPhone?`<div class="bsub">📞 ${coPhone}</div>`:""}${gst?`<div class="bsub">GST: ${gst}</div>`:""}</div>
  <div><div class="ititle">${type==="customer"?"CUSTOMER REPORT":"INVOICE"}</div>
  <div class="imeta">${invoiceNo}</div>
  <div class="imeta">Date: ${record.date||today()}</div>
  <div class="imeta">Ref: #${(record.id||"").slice(-8)}</div>
  ${record.deliveryDate?`<div class="imeta">Deliver by: ${record.deliveryDate}</div>`:""}
  </div>
</div>
<div class="slabel">Customer</div>
<div class="bname">${name}</div>
${record.phone?`<div class="bsub2">📞 ${record.phone}</div>`:""}
${record.address?`<div class="bsub2">📍 ${record.address}</div>`:""}
${record.joinDate?`<div class="bsub2">📅 Customer since: ${record.joinDate}</div>`:""}
${record.notes?`<div class="bsub2" style="margin-top:4px;font-style:italic;color:#a8a29e">"${record.notes}"</div>`:""}

${historyHtml}

${rows.length>0?`<div class="section-title" style="margin-top:24px">🛒 Regular Order Template</div>
<table><tr><th>Product</th><th>Unit</th><th>Qty</th><th>Unit Price</th><th class="r">Amount</th></tr>
${rows.map(r=>`<tr><td>${r.name}</td><td>${r.unit||"—"}</td><td>${r.qty}</td><td>₹${r.priceAmount.toLocaleString("en-IN")}</td><td class="r">₹${(r.qty*r.priceAmount).toLocaleString("en-IN")}</td></tr>`).join("")}
<tr class="trow"><td colspan="4">Template Total</td><td class="r">₹${total.toLocaleString("en-IN")}</td></tr></table>`:""}

<div class="footer">Exported on ${new Date().toLocaleString("en-IN")} · ${co} · Confidential</div>
<div class="print-bar no-print"><span>📄 ${type==="customer"?"Customer Report":"Invoice"} — ${name}</span><div style="display:flex;gap:8px"><a href="#" onclick="window.print();return false;">🖨 Print / Save PDF</a><a class="dl" href="#" onclick="var b=document.documentElement.outerHTML;var bl=new Blob([b],{type:'text/html'});var u=URL.createObjectURL(bl);var a=document.createElement('a');a.href=u;a.download='${(name+'_'+(type==="customer"?"report":"invoice")+'_'+(record.date||today())).replace(/[^a-zA-Z0-9_-]/g,'_')}.html';document.body.appendChild(a);a.click();URL.revokeObjectURL(u);return false;">⬇ Download</a></div></div>
<script>window.addEventListener("load",function(){window.print();});</script>
</body></html>`;
  const blob = new Blob([html], {type:"text/html;charset=utf-8"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.target = "_blank"; a.rel = "noopener";
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
//  exportAgentReceipt — kept for backwards compatibility
// eslint-disable-next-line no-unused-vars
function exportAgentReceipt(d, products, settings, invNo) {
  const showPrices = settings?.agentInvoiceShowPrices !== false;
  const co     = settings?.companyName     || "TAS Healthy World";
  const cosub  = settings?.companySubtitle || "Malabar Paratha Factory · Goa, India";
  const gst    = settings?.companyGST      || "";
  const coPhone= settings?.companyPhone    || "";
  const coLogo = settings?.companyLogo     || "";
  const rows   = lineRows(d.orderLines||{}, products).filter(r=>r.qty>0);
  const orderTotal = lineTotal(d.orderLines||{});
  const replAmt    = +(d.replacement?.amount)||0;
  const netAmt     = orderTotal - replAmt;
  const collected  = d.partialPayment?.enabled ? +(d.partialPayment?.amount)||0 : 0;
  const balanceDue = Math.max(0, netAmt - collected);
  const receiptNo  = invNo ? `RCP-${invNo.replace(/^[A-Z0-9]+-/,"")}` : `RCP-${(d.date||"").replace(/-/g,"")}-${(d.id||"").slice(-5).toUpperCase()}`;
  const now        = new Date().toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
  const statusColor= d.status==="Delivered"?"#059669":d.status==="In Transit"?"#2563eb":"#d97706";

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Delivery Receipt — ${d.customer}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;color:#1c1917;background:#fff;padding:0;max-width:420px;margin:0 auto}
.wrap{padding:24px 20px}
.brand-bar{background:#1e3a5f;color:#fff;padding:14px 20px;text-align:center}
.brand-name{font-size:17px;font-weight:900;letter-spacing:0.02em}
.brand-sub{font-size:10px;opacity:0.75;margin-top:2px}
.receipt-title{text-align:center;padding:14px 20px 0;border-bottom:2px dashed #e5e5e5;padding-bottom:14px;margin-bottom:0}
.receipt-no{font-size:11px;color:#6b7280;font-weight:700;letter-spacing:0.08em;text-transform:uppercase}
.receipt-date{font-size:10px;color:#9ca3af;margin-top:2px}
.section{padding:12px 20px;border-bottom:1px solid #f3f4f6}
.section-label{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;margin-bottom:8px}
.cust-name{font-size:16px;font-weight:800;color:#111827}
.cust-detail{font-size:11px;color:#6b7280;margin-top:3px;line-height:1.5}
.status-badge{display:inline-block;padding:3px 12px;border-radius:20px;font-size:10px;font-weight:800;margin-top:6px}
.line-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f9fafb;font-size:12px}
.line-name{color:#374151;flex:1}
.line-qty{color:#6b7280;width:32px;text-align:center;font-weight:600}
.line-price{color:#6b7280;width:60px;text-align:right;font-size:11px}
.line-amt{color:#111827;width:64px;text-align:right;font-weight:700}
.total-row{display:flex;justify-content:space-between;padding:7px 0;font-size:13px}
.repl-box{background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:10px 12px;margin:0 20px 0}
.repl-title{font-size:11px;font-weight:800;color:#92400e;margin-bottom:6px}
.repl-detail{font-size:11px;color:#78716c;line-height:1.6}
.pay-section{padding:12px 20px}
.pay-row{display:flex;justify-content:space-between;font-size:13px;padding:4px 0}
.balance-box{background:#111827;color:#fff;margin:0 20px;border-radius:10px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center}
.balance-label{font-size:11px;opacity:0.7;font-weight:700;text-transform:uppercase;letter-spacing:0.06em}
.balance-amt{font-size:22px;font-weight:900}
.balance-paid{background:#059669}
.collected-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 14px;margin:8px 20px;display:flex;justify-content:space-between;align-items:center}
.trail{font-size:9.5px;color:#9ca3af;line-height:1.8;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;font-family:monospace}
.footer{text-align:center;font-size:9px;color:#d1d5db;padding:16px 20px 24px;line-height:1.8}
.print-bar{position:fixed;top:0;left:0;right:0;background:#1e3a5f;color:#fff;padding:8px 16px;display:flex;align-items:center;justify-content:space-between;z-index:9999;font-family:Arial,sans-serif;font-size:12px;gap:10px}
.print-bar a{background:#3b82f6;color:#fff;padding:6px 14px;border-radius:7px;text-decoration:none;font-weight:700;font-size:12px;white-space:nowrap}
@media print{@page{size:80mm auto;margin:0}body{max-width:100%}.print-bar{display:none!important}body{padding-top:0}}
</style></head><body>
<div class="brand-bar">
  ${coLogo?`<img src="${coLogo}" alt="logo" style="max-height:44px;max-width:110px;object-fit:contain;display:block;margin:0 auto 6px"/>`:``}
  <div class="brand-name">${coLogo?"":co.includes("TAS")?"🫓 ":""} ${co}</div>
  <div class="brand-sub">${cosub}</div>
  ${coPhone?`<div class="brand-sub">📞 ${coPhone}</div>`:""}
  ${gst?`<div class="brand-sub">GST: ${gst}</div>`:""}
</div>
<div class="receipt-title">
  <div class="receipt-no">Delivery Receipt · ${receiptNo}</div>
  <div class="receipt-date">Issued: ${now}</div>
</div>
<div class="section">
  <div class="section-label">Customer</div>
  <div class="cust-name">${d.customer||"—"}</div>
  ${d.phone?`<div class="cust-detail">📞 ${d.phone}</div>`:""}
  ${d.address?`<div class="cust-detail">📍 ${d.address}</div>`:""}
  <span class="status-badge" style="background:${statusColor}20;color:${statusColor}">${d.status||"Pending"}</span>
  <div class="cust-detail" style="margin-top:6px">Order date: <b>${d.date||"—"}</b>${d.deliveryDate&&d.deliveryDate!==d.date?` · Deliver by: <b>${d.deliveryDate}</b>`:""}</div>
  <div class="cust-detail">Handled by: <b>${d.agent||d.createdBy||"—"}</b> · Ref: #${(d.id||"").slice(-8)}</div>
</div>
<div class="section">
  <div class="section-label">Items Ordered</div>
  ${rows.length===0?'<div style="font-size:12px;color:#9ca3af">No items</div>':rows.map(r=>`
  <div class="line-row">
    <span class="line-name">${r.name}</span>
    <span class="line-qty">${r.qty}×</span>
    ${showPrices?`<span class="line-price">₹${r.priceAmount.toLocaleString("en-IN")}</span><span class="line-amt">₹${(r.qty*r.priceAmount).toLocaleString("en-IN")}</span>`:`<span class="line-price"></span><span class="line-amt" style="color:#9ca3af">${r.qty} ${r.unit||"pcs"}</span>`}
  </div>`).join("")}
  ${showPrices&&orderTotal>0?`<div class="total-row" style="border-top:2px solid #111827;margin-top:6px;font-weight:700"><span style="color:#374151">Order Total</span><span style="color:#111827">₹${orderTotal.toLocaleString("en-IN")}</span></div>`:""}
</div>
${d.replacement?.done?`
<div style="padding:10px 20px 0">
<div class="repl-box">
  <div class="repl-title">🔄 Replacement Made</div>
  <div class="repl-detail">
    ${d.replacement.item?`<b>Item:</b> ${d.replacement.item}<br>`:""}
    ${d.replacement.qty?`<b>Quantity:</b> ${d.replacement.qty}<br>`:""}
    ${d.replacement.reason?`<b>Reason:</b> ${d.replacement.reason}<br>`:""}
    ${showPrices&&replAmt>0?`<b style="color:#ea580c">Amount deducted: −₹${replAmt.toLocaleString("en-IN")}</b>`:""}
  </div>
</div>
</div>`:""}
${showPrices?`
<div class="pay-section">
  <div class="section-label">Payment Summary</div>
  ${orderTotal>0?`<div class="pay-row"><span style="color:#6b7280">Order Total</span><span style="font-weight:600">₹${orderTotal.toLocaleString("en-IN")}</span></div>`:""}
  ${replAmt>0?`<div class="pay-row"><span style="color:#ea580c">Replacement Deduction</span><span style="color:#ea580c;font-weight:700">−₹${replAmt.toLocaleString("en-IN")}</span></div>`:""}
  ${replAmt>0?`<div class="pay-row" style="border-top:1px solid #e5e7eb;padding-top:6px;font-weight:700"><span>Net Payable</span><span>₹${netAmt.toLocaleString("en-IN")}</span></div>`:""}
</div>
${collected>0?`<div class="collected-box"><div><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#059669">✓ Amount Collected</div><div style="font-size:9px;color:#6b7280;margin-top:1px">Received at time of delivery</div></div><div style="font-size:18px;font-weight:900;color:#059669">₹${collected.toLocaleString("en-IN")}</div></div>`:""}
<div style="padding:8px 20px 12px">
<div class="balance-box ${balanceDue===0?"balance-paid":""}">
  <div>
    <div class="balance-label">${balanceDue===0?"✓ Fully Paid":"Balance Due"}</div>
    ${balanceDue===0?'<div style="font-size:10px;opacity:0.7;margin-top:2px">No amount outstanding</div>':collected>0?`<div style="font-size:9px;opacity:0.6;margin-top:2px">After ₹${collected.toLocaleString("en-IN")} collected</div>`:""}
  </div>
  <div class="balance-amt">₹${balanceDue.toLocaleString("en-IN")}</div>
</div>
</div>`:""}
<div style="padding:8px 20px 0">
<div class="trail">
  <b>PAPER TRAIL</b><br>
  Receipt No:      ${receiptNo}<br>
  Invoice No:      ${invNo||"—"}<br>
  Delivery ID:     ${(d.id||"").slice(-12)}<br>
  Order Date:      ${d.date||"—"}<br>
  Status:          ${d.status||"—"}<br>
  Created by:      ${d.createdBy||"—"}<br>
  ${d.agent?`Agent:           ${d.agent}<br>`:""}
  Issued at:       ${now}<br>
  ${d.replacement?.done?`Replacement:     YES — ${d.replacement.item||"item"} × ${d.replacement.qty||"?"}<br>`:""}
  ${replAmt>0?`Repl. Deducted:  ₹${replAmt.toLocaleString("en-IN")}<br>`:""}
  ${collected>0?`Collected:       ₹${collected.toLocaleString("en-IN")}<br>`:""}
  ${balanceDue>0?`Balance Due:     ₹${balanceDue.toLocaleString("en-IN")}<br>`:"Balance:         SETTLED<br>"}
</div>
</div>
<div class="footer">
  ${co} · ${cosub}<br>
  This is a computer-generated delivery receipt and serves as an official record.<br>
  For queries contact: ${coPhone||"your account manager"}
</div>
<div class="print-bar"><span>🧾 Receipt ${receiptNo} — ${d.customer}</span><div style="display:flex;gap:8px"><a href="#" onclick="window.print();return false;">🖨 Print</a><a style="background:#059669" href="#" onclick="var b=document.documentElement.outerHTML;var bl=new Blob([b],{type:'text/html'});var u=URL.createObjectURL(bl);var a=document.createElement('a');a.href=u;a.download='receipt_${receiptNo}.html';document.body.appendChild(a);a.click();URL.revokeObjectURL(u);return false;">⬇ Save</a></div></div>
<script>window.addEventListener("load",function(){window.print();});</script>
</body></html>`;
  const blob = new Blob([html], {type:"text/html;charset=utf-8"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.target = "_blank"; a.rel = "noopener";
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}

// ═══════════════════════════════════════════════════════════════
//  MULTI-LANGUAGE — i18n translation dictionary + useT() hook
//  Supports: English (en), Hindi (hi), Malayalam (ml), Kannada (kn)
// ═══════════════════════════════════════════════════════════════
const TRANSLATIONS = {
  en: {
    // Nav tabs
    dashboard:"Dashboard", customers:"Customers", deliveries:"Deliveries",
    payments:"Payments", supplies:"Supplies", expenses:"Expenses",
    production:"Production", ingredients:"Ingredients", staff:"Staff",
    machines:"Machines", vehicles:"Vehicles", gps:"GPS", settings:"Settings",
    analytics:"Analytics", wastage:"Wastage", pandl:"P&L",
    // Time
    today:"Today", thisWeek:"This Week", thisMonth:"This Month", yesterday:"Yesterday",
    // Greetings
    goodMorning:"Good morning", goodAfternoon:"Good afternoon", goodEvening:"Good evening",
    // Status words
    pending:"Pending", delivered:"Delivered", inTransit:"In Transit", cancelled:"Cancelled",
    active:"Active", inactive:"Inactive", approved:"Approved",
    paid:"Paid", due:"Due", collected:"Collected", balance:"Balance",
    settled:"Settled", partial:"Partial", overdue:"Overdue", low:"Low",
    // Finance
    revenue:"Revenue", totalDue:"Total Due", totalPaid:"Total Paid",
    netProfit:"Net Profit", grossRevenue:"Gross Revenue", expenses2:"Expenses",
    supplyCost:"Supply Cost", profit:"Profit", loss:"Loss", margin:"Margin",
    orderTotal:"Order Total", netPayable:"Net Payable", replacement:"Replacement",
    amountCollected:"Amount Collected", balanceDue:"Balance Due",
    // Actions
    save:"Save", cancel:"Cancel", delete:"Delete", edit:"Edit", add:"Add", close:"Close",
    search:"Search", filter:"Filter", export:"Export", print:"Print",
    viewAll:"View all", configure:"Configure", confirm:"Confirm", yes:"Yes", no:"No",
    markDone:"Mark Done", dispatch:"Dispatch", collect:"Collect", record:"Record",
    addCustomer:"Add Customer", addDelivery:"Add Delivery",
    addExpense:"Add Expense", addSupply:"Add Supply",
    newOrder:"New Order", bulkOrder:"Bulk Order",
    // Fields
    customer:"Customer", phone:"Phone", address:"Address", notes:"Notes",
    date:"Date", status:"Status", amount:"Amount", quantity:"Quantity",
    invoice:"Invoice", receipt:"Receipt", label:"Label",
    item:"Item", product:"Product", category:"Category", supplier:"Supplier",
    name:"Name", role:"Role", username:"Username", password:"Password",
    description:"Description", reason:"Reason", shift:"Shift",
    // Messages
    noDeliveries:"No deliveries scheduled for today",
    noCustomers:"No customers found",
    noExpenses:"No expenses found",
    noSupplies:"No supplies found",
    deleteConfirm:"Are you sure you want to delete this?",
    savedSuccess:"Saved successfully",
    deletedSuccess:"Deleted successfully",
    // Dashboard
    todaysBriefing:"Today's Briefing", pendingDeliveries:"Pending Deliveries",
    overdueDeliveries:"Overdue Deliveries", lowStock:"Low Stock",
    outstandingBalance:"Outstanding Balance", todayRevenue:"Today's Revenue",
    // Customers
    allCustomers:"All Customers", activeCustomers:"Active Customers",
    inactiveCustomers:"Inactive Customers", owing:"Owing",
    creditLimit:"Credit Limit", joinDate:"Join Date", lastOrder:"Last Order",
    orderHistory:"Order History", paymentHistory:"Payment History",
    // Deliveries
    allDeliveries:"All Deliveries", createDelivery:"Create Delivery",
    deliveryDate:"Delivery Date", orderDate:"Order Date",
    markDelivered:"Mark Delivered", markPending:"Mark Pending",
    // Payments
    recordPayment:"Record Payment", paymentMethod:"Payment Method",
    cash:"Cash", upi:"UPI", bank:"Bank Transfer", cheque:"Cheque",
    paymentLedger:"Payment Ledger", outstandingPayments:"Outstanding Payments",
    dailySummary:"Daily Summary",
    // Settings
    account:"Account", security:"Security", notifications:"Notifications",
    language:"Language", theme:"Theme", backup:"Backup",
    lightMode:"Light Mode", darkMode:"Dark Mode",
    // Misc
    loading:"Loading", connecting:"Connecting", offline:"Offline",
    signIn:"Sign In", signOut:"Sign Out", welcome:"Welcome back",
    more:"More", expand:"Expand", collapse:"Collapse",
    noData:"No data", total:"Total", average:"Average", count:"Count",
    // Customer tab UI
    tableView:"Table", compactView:"Compact", profile:"Profile",
    financials:"Financials", orderStats:"Order Stats", actions:"Actions",
    logPartialPayment:"Log Partial Payment", apply:"Apply",
    deliveries2:"Deliveries", all:"All", thisWeek2:"This Week",
    noDeliveriesFilter:"No deliveries match this filter.",
    clickToExpand:"Click any row to expand", clickDelivery:"Click any delivery to open full detail",
    fullProfile:"Full Profile", whatsapp:"WhatsApp", activate:"Activate",
    pause:"Pause", paidUp:"Paid Up", sortBy:"Sort by",
    nameAZ:"Name A–Z", mostOwing:"Most Owing", mostOrders:"Most Orders",
    revenueDesc:"Revenue ↓",
    // Stats labels
    orders:"Orders", last:"Last", totalBilled:"Total Billed",
    replacements:"Replacements", deliveryRate:"Delivery Rate",
    collection:"Collection", collectionPct:"Collection %",
    // Table headers
    contact:"Contact", ordersCount:"Orders", lastOrderH:"Last Order",
    // Delivery tab
    createNew:"Create New", allDelivery:"All", pendingH:"Pending",
    inTransitH:"In Transit", deliveredH:"Delivered", cancelledH:"Cancelled",
    invoiceNo:"Invoice No", customer2:"Customer", items:"Items",
    netAmt:"Net Amt", agent:"Agent", expanded:"Expanded", compact:"Compact",
    markDeliveredBtn:"Mark Delivered", dispatchBtn:"Dispatch",
    collectPayment:"Collect Payment", viewDetails:"View Details",
    replacement2:"Replacement", noOrdersToday:"No deliveries for today",
    // Expenses / Supplies
    addEntry:"Add Entry", vendor:"Vendor", totalExpenses:"Total Expenses",
    thisMonthExp:"This Month", netCost:"Net Cost",
    // Production
    logProduction:"Log Production", target:"Target", actual:"Actual",
    handover:"Handover", qcCheck:"QC Check",
    // Staff / Machines / Vehicles
    addStaff:"Add Staff", addMachine:"Add Machine", addVehicle:"Add Vehicle",
    maintenance:"Maintenance", service:"Service", operational:"Operational",
    // Settings sections
    appBranding:"App Branding", companyDetails:"Company Details",
    usersRoles:"Users & Roles", featureFlags:"Features",
    invoiceNum:"Invoice Numbering", dataBackup:"Data & Backup",
    // Misc UI
    showing:"Showing", of:"of", to:"to",
    signedInAs:"Signed in as", lightDark:"Light / Dark",
    syncedAt:"Synced at", connecting2:"Connecting…",
    noData2:"No data available", lastSeen:"Last seen",
    never:"Never", daysAgo:"d ago", hoursAgo:"h ago",
    today2:"Today", yesterday2:"Yesterday",
    // Confirmation
    areYouSure:"Are you sure?", cannotUndo:"This cannot be undone.",
    // Passkey
    registerPasskey:"Register Passkey", removePasskey:"Remove Passkey",
    passkeyRegistered:"Passkey registered on this device",
    noPasskey:"No passkey on this device",
    // GPS
    liveLocation:"Live Location", shareLocation:"Share Location",
    agentLocations:"Agent Locations",
    // P&L
    grossRevPL:"Gross Revenue", totalExpPL:"Total Expenses",
    netProfitPL:"Net Profit", supplyCostPL:"Supply Cost",
    // Notices
    postNotice:"Post Notice", deleteNotice:"Delete Notice",
    noNotices:"No notices posted yet",
  },
  hi: {
    // Nav tabs
    dashboard:"डैशबोर्ड", customers:"ग्राहक", deliveries:"डिलीवरी",
    payments:"भुगतान", supplies:"आपूर्ति", expenses:"खर्च",
    production:"उत्पादन", ingredients:"सामग्री", staff:"स्टाफ",
    machines:"मशीनें", vehicles:"वाहन", gps:"जीपीएस", settings:"सेटिंग्स",
    analytics:"विश्लेषण", wastage:"बर्बादी", pandl:"लाभ-हानि",
    // Time
    today:"आज", thisWeek:"इस सप्ताह", thisMonth:"इस महीने", yesterday:"कल",
    // Greetings
    goodMorning:"सुप्रभात", goodAfternoon:"नमस्कार", goodEvening:"शुभ संध्या",
    // Status words
    pending:"लंबित", delivered:"डिलीवर", inTransit:"रास्ते में", cancelled:"रद्द",
    active:"सक्रिय", inactive:"निष्क्रिय", approved:"स्वीकृत",
    paid:"भुगतान हुआ", due:"बकाया", collected:"एकत्रित", balance:"शेष",
    settled:"निपटाया", partial:"आंशिक", overdue:"अतिदेय", low:"कम",
    // Finance
    revenue:"राजस्व", totalDue:"कुल बकाया", totalPaid:"कुल भुगतान",
    netProfit:"शुद्ध लाभ", grossRevenue:"कुल राजस्व", expenses2:"खर्चे",
    supplyCost:"आपूर्ति लागत", profit:"लाभ", loss:"हानि", margin:"मार्जिन",
    orderTotal:"ऑर्डर कुल", netPayable:"शुद्ध देय", replacement:"प्रतिस्थापन",
    amountCollected:"एकत्रित राशि", balanceDue:"बकाया राशि",
    // Actions
    save:"सहेजें", cancel:"रद्द करें", delete:"हटाएं", edit:"संपादित करें",
    add:"जोड़ें", close:"बंद करें", search:"खोजें", filter:"फ़िल्टर",
    export:"निर्यात", print:"प्रिंट", viewAll:"सब देखें",
    configure:"कॉन्फ़िगर करें", confirm:"पुष्टि करें", yes:"हाँ", no:"नहीं",
    markDone:"पूर्ण करें", dispatch:"भेजें", collect:"एकत्र करें", record:"दर्ज करें",
    addCustomer:"ग्राहक जोड़ें", addDelivery:"डिलीवरी जोड़ें",
    addExpense:"खर्च जोड़ें", addSupply:"आपूर्ति जोड़ें",
    newOrder:"नया ऑर्डर", bulkOrder:"बल्क ऑर्डर",
    // Fields
    customer:"ग्राहक", phone:"फ़ोन", address:"पता", notes:"नोट्स",
    date:"तारीख", status:"स्थिति", amount:"राशि", quantity:"मात्रा",
    invoice:"चालान", receipt:"रसीद", label:"लेबल",
    item:"वस्तु", product:"उत्पाद", category:"श्रेणी", supplier:"आपूर्तिकर्ता",
    name:"नाम", role:"भूमिका", username:"उपयोगकर्ता नाम", password:"पासवर्ड",
    description:"विवरण", reason:"कारण", shift:"पाली",
    // Messages
    noDeliveries:"आज कोई डिलीवरी निर्धारित नहीं है",
    noCustomers:"कोई ग्राहक नहीं मिला",
    noExpenses:"कोई खर्च नहीं मिला",
    noSupplies:"कोई आपूर्ति नहीं मिली",
    deleteConfirm:"क्या आप वाकई इसे हटाना चाहते हैं?",
    savedSuccess:"सफलतापूर्वक सहेजा गया",
    deletedSuccess:"सफलतापूर्वक हटाया गया",
    // Dashboard
    todaysBriefing:"आज की जानकारी", pendingDeliveries:"लंबित डिलीवरी",
    overdueDeliveries:"अतिदेय डिलीवरी", lowStock:"कम स्टॉक",
    outstandingBalance:"बकाया राशि", todayRevenue:"आज का राजस्व",
    // Customers
    allCustomers:"सभी ग्राहक", activeCustomers:"सक्रिय ग्राहक",
    inactiveCustomers:"निष्क्रिय ग्राहक", owing:"बकायेदार",
    creditLimit:"क्रेडिट सीमा", joinDate:"शामिल तारीख", lastOrder:"अंतिम ऑर्डर",
    orderHistory:"ऑर्डर इतिहास", paymentHistory:"भुगतान इतिहास",
    // Deliveries
    allDeliveries:"सभी डिलीवरी", createDelivery:"डिलीवरी बनाएं",
    deliveryDate:"डिलीवरी तारीख", orderDate:"ऑर्डर तारीख",
    markDelivered:"डिलीवर किया", markPending:"लंबित करें",
    // Payments
    recordPayment:"भुगतान दर्ज करें", paymentMethod:"भुगतान विधि",
    cash:"नकद", upi:"UPI", bank:"बैंक ट्रांसफर", cheque:"चेक",
    paymentLedger:"भुगतान बही", outstandingPayments:"बकाया भुगतान",
    dailySummary:"दैनिक सारांश",
    // Settings
    account:"खाता", security:"सुरक्षा", notifications:"सूचनाएं",
    language:"भाषा", theme:"थीम", backup:"बैकअप",
    lightMode:"लाइट मोड", darkMode:"डार्क मोड",
    // Misc
    loading:"लोड हो रहा है", connecting:"कनेक्ट हो रहा है", offline:"ऑफ़लाइन",
    signIn:"साइन इन", signOut:"साइन आउट", welcome:"वापस स्वागत है",
    more:"अधिक", expand:"विस्तार करें", collapse:"संकुचित करें",
    noData:"कोई डेटा नहीं", total:"कुल", average:"औसत", count:"संख्या",
    // Customer tab UI
    tableView:"तालिका", compactView:"संक्षिप्त", profile:"प्रोफ़ाइल",
    financials:"वित्तीय", orderStats:"ऑर्डर आँकड़े", actions:"कार्य",
    logPartialPayment:"आंशिक भुगतान दर्ज करें", apply:"लागू करें",
    deliveries2:"डिलीवरी", all:"सभी", thisWeek2:"इस सप्ताह",
    noDeliveriesFilter:"कोई डिलीवरी नहीं मिली।",
    clickToExpand:"विस्तार के लिए क्लिक करें", clickDelivery:"पूरी जानकारी देखने के लिए क्लिक करें",
    fullProfile:"पूरी प्रोफ़ाइल", whatsapp:"व्हाट्सएप", activate:"सक्रिय करें",
    pause:"रोकें", paidUp:"भुगतान हो गया", sortBy:"क्रमबद्ध करें",
    nameAZ:"नाम A–Z", mostOwing:"सबसे अधिक बकाया", mostOrders:"सबसे अधिक ऑर्डर",
    revenueDesc:"राजस्व ↓",
    // Stats labels
    orders:"ऑर्डर", last:"अंतिम", totalBilled:"कुल बिल", 
    replacements:"प्रतिस्थापन", deliveryRate:"डिलीवरी दर",
    collection:"संग्रह", collectionPct:"संग्रह %",
    // Table headers
    contact:"संपर्क", ordersCount:"ऑर्डर", lastOrderH:"अंतिम ऑर्डर",
    // Delivery tab
    createNew:"नया बनाएं", allDelivery:"सभी", pendingH:"लंबित",
    inTransitH:"रास्ते में", deliveredH:"डिलीवर", cancelledH:"रद्द",
    invoiceNo:"चालान नं.", customer2:"ग्राहक", items:"वस्तुएं",
    netAmt:"शुद्ध राशि", agent:"एजेंट", expanded:"विस्तृत", compact:"संक्षिप्त",
    markDeliveredBtn:"डिलीवर किया", dispatchBtn:"भेजें",
    collectPayment:"भुगतान लें", viewDetails:"विवरण देखें",
    replacement2:"बदलाव", noOrdersToday:"आज कोई डिलीवरी नहीं",
    // Expenses / Supplies
    addEntry:"प्रविष्टि जोड़ें", vendor:"विक्रेता", totalExpenses:"कुल खर्च",
    thisMonthExp:"इस महीने", netCost:"शुद्ध लागत",
    // Production
    logProduction:"उत्पादन दर्ज करें", target:"लक्ष्य", actual:"वास्तविक",
    handover:"हस्तांतरण", qcCheck:"गुणवत्ता जांच",
    // Staff / Machines / Vehicles
    addStaff:"स्टाफ जोड़ें", addMachine:"मशीन जोड़ें", addVehicle:"वाहन जोड़ें",
    maintenance:"रखरखाव", service:"सेवा", operational:"चालू",
    // Settings sections
    appBranding:"ऐप पहचान", companyDetails:"कंपनी विवरण",
    usersRoles:"उपयोगकर्ता और भूमिकाएं", featureFlags:"सुविधाएं",
    invoiceNum:"चालान क्रमांक", dataBackup:"डेटा और बैकअप",
    // Misc UI
    showing:"दिखा रहा है", of:"में से", to:"तक",
    signedInAs:"साइन इन किया", lightDark:"लाइट / डार्क",
    syncedAt:"सिंक हुआ", connecting2:"कनेक्ट हो रहा है…",
    noData2:"कोई डेटा उपलब्ध नहीं", lastSeen:"अंतिम बार देखा",
    never:"कभी नहीं", daysAgo:"दिन पहले", hoursAgo:"घंटे पहले",
    today2:"आज", yesterday2:"कल",
    // Confirmation
    areYouSure:"क्या आप निश्चित हैं?", cannotUndo:"यह पूर्ववत नहीं किया जा सकता।",
    // Passkey
    registerPasskey:"पासकी पंजीकृत करें", removePasskey:"पासकी हटाएं",
    passkeyRegistered:"इस डिवाइस पर पासकी पंजीकृत है",
    noPasskey:"इस डिवाइस पर कोई पासकी नहीं",
    // GPS
    liveLocation:"लाइव स्थान", shareLocation:"स्थान शेयर करें",
    agentLocations:"एजेंट स्थान",
    // P&L
    grossRevPL:"कुल राजस्व", totalExpPL:"कुल खर्च",
    netProfitPL:"शुद्ध लाभ", supplyCostPL:"आपूर्ति लागत",
    // Notices
    postNotice:"नोटिस पोस्ट करें", deleteNotice:"नोटिस हटाएं",
    noNotices:"अभी तक कोई नोटिस नहीं",
  },
  mr: {
    dashboard:"डॅशबोर्ड", customers:"ग्राहक", deliveries:"डिलिव्हरी",
    payments:"पेमेंट", supplies:"पुरवठा", expenses:"खर्च",
    production:"उत्पादन", ingredients:"घटक", staff:"कर्मचारी",
    machines:"यंत्रे", vehicles:"वाहने", gps:"जीपीएस", settings:"सेटिंग्ज",
    analytics:"विश्लेषण", wastage:"नुकसान", pandl:"नफा-तोटा",
    today:"आज", thisWeek:"या आठवड्यात", thisMonth:"या महिन्यात", yesterday:"काल",
    goodMorning:"सुप्रभात", goodAfternoon:"नमस्कार", goodEvening:"शुभ संध्याकाळ",
    pending:"प्रलंबित", delivered:"डिलिव्हर झाले", inTransit:"रस्त्यात", cancelled:"रद्द",
    active:"सक्रिय", inactive:"निष्क्रिय", approved:"मंजूर",
    paid:"भरले", due:"थकबाकी", collected:"गोळा केले", balance:"शिल्लक",
    settled:"निपटारा", partial:"आंशिक", overdue:"थकीत", low:"कमी",
    revenue:"उत्पन्न", totalDue:"एकूण थकबाकी", totalPaid:"एकूण भरले",
    netProfit:"निव्वळ नफा", profit:"नफा", loss:"तोटा", margin:"मार्जिन",
    orderTotal:"ऑर्डर एकूण", netPayable:"निव्वळ देय", replacement:"बदली",
    amountCollected:"एकत्रित रक्कम", balanceDue:"थकीत रक्कम",
    save:"जतन करा", cancel:"रद्द करा", delete:"हटवा", edit:"संपादित करा",
    add:"जोडा", close:"बंद करा", search:"शोधा", filter:"फिल्टर",
    export:"निर्यात", print:"प्रिंट", viewAll:"सर्व पहा",
    configure:"सेट करा", confirm:"पुष्टी करा", yes:"होय", no:"नाही",
    markDone:"पूर्ण करा", dispatch:"पाठवा", collect:"गोळा करा", record:"नोंदवा",
    addCustomer:"ग्राहक जोडा", addDelivery:"डिलिव्हरी जोडा",
    addExpense:"खर्च जोडा", addSupply:"पुरवठा जोडा",
    newOrder:"नवीन ऑर्डर", bulkOrder:"बल्क ऑर्डर",
    customer:"ग्राहक", phone:"फोन", address:"पत्ता", notes:"नोट्स",
    date:"तारीख", status:"स्थिती", amount:"रक्कम", quantity:"प्रमाण",
    invoice:"इनव्हॉइस", receipt:"पावती", label:"लेबल",
    item:"वस्तू", product:"उत्पादन", category:"श्रेणी", supplier:"पुरवठादार",
    name:"नाव", role:"भूमिका", username:"वापरकर्ता नाव", password:"पासवर्ड",
    description:"वर्णन", reason:"कारण", shift:"पाळी",
    noDeliveries:"आज कोणतीही डिलिव्हरी नाही",
    noCustomers:"कोणताही ग्राहक सापडला नाही",
    deleteConfirm:"तुम्हाला हे हटवायचे आहे का?",
    savedSuccess:"यशस्वीरित्या जतन केले",
    deletedSuccess:"यशस्वीरित्या हटवले",
    todaysBriefing:"आजची माहिती", pendingDeliveries:"प्रलंबित डिलिव्हरी",
    overdueDeliveries:"थकीत डिलिव्हरी", lowStock:"कमी स्टॉक",
    outstandingBalance:"थकबाकी रक्कम", todayRevenue:"आजचे उत्पन्न",
    allCustomers:"सर्व ग्राहक", activeCustomers:"सक्रिय ग्राहक",
    inactiveCustomers:"निष्क्रिय ग्राहक", owing:"थकबाकीदार",
    recordPayment:"पेमेंट नोंदवा", paymentMethod:"पेमेंट पद्धत",
    cash:"रोख", upi:"UPI", bank:"बँक ट्रान्सफर", cheque:"चेक",
    paymentLedger:"पेमेंट खतावणी", dailySummary:"दैनिक सारांश",
    account:"खाते", security:"सुरक्षा", notifications:"सूचना",
    language:"भाषा", theme:"थीम", backup:"बॅकअप",
    lightMode:"लाइट मोड", darkMode:"डार्क मोड",
    loading:"लोड होत आहे", connecting:"कनेक्ट होत आहे", offline:"ऑफलाइन",
    signIn:"साइन इन", signOut:"साइन आउट", welcome:"पुन्हा स्वागत आहे",
    more:"अधिक", noData:"डेटा नाही", total:"एकूण", average:"सरासरी", count:"संख्या",
    tableView:"तक्ता", compactView:"संक्षिप्त", profile:"प्रोफाइल",
    financials:"आर्थिक", orderStats:"ऑर्डर आकडे", actions:"कृती",
    logPartialPayment:"आंशिक पेमेंट नोंदवा", apply:"लागू करा",
    deliveries2:"डिलिव्हरी", all:"सर्व", thisWeek2:"या आठवड्यात",
    noDeliveriesFilter:"कोणतीही डिलिव्हरी आढळली नाही.",
    fullProfile:"पूर्ण प्रोफाइल", whatsapp:"व्हॉट्सअॅप", activate:"सक्रिय करा",
    pause:"थांबवा", paidUp:"भरले", sortBy:"क्रमवारी",
    nameAZ:"नाव A–Z", mostOwing:"सर्वाधिक थकबाकी", mostOrders:"सर्वाधिक ऑर्डर",
    revenueDesc:"उत्पन्न ↓", orders:"ऑर्डर", last:"शेवटचे",
    totalBilled:"एकूण बिल", replacements:"बदल्या", deliveryRate:"डिलिव्हरी दर",
    collection:"संकलन", showing:"दाखवत आहे", of:"पैकी", to:"पर्यंत",
    never:"कधीच नाही", today2:"आज", yesterday2:"काल",
    noNotices:"अजून कोणतेही नोटीस नाही",
  },
  ml: {
    dashboard:"ഡാഷ്ബോർഡ്", customers:"ഉപഭോക്താക്കൾ", deliveries:"ഡെലിവറി",
    payments:"പേയ്മെന്റ്", supplies:"സാധനങ്ങൾ", expenses:"ചെലവ്",
    production:"ഉൽപ്പാദനം", ingredients:"ചേരുവകൾ", staff:"ജീവനക്കാർ",
    machines:"യന്ത്രങ്ങൾ", vehicles:"വാഹനങ്ങൾ", gps:"ജിപിഎസ്", settings:"ക്രമീകരണം",
    analytics:"വിശകലനം", wastage:"പാഴ്‌വസ്തു", pandl:"ലാഭ-നഷ്ടം",
    today:"ഇന്ന്", thisWeek:"ഈ ആഴ്ച", thisMonth:"ഈ മാസം", yesterday:"ഇന്നലെ",
    goodMorning:"സുപ്രഭാതം", goodAfternoon:"ശുഭ ഉച്ചയ്ക്ക്", goodEvening:"ശുഭ സന്ധ്യ",
    pending:"തീർപ്പാകാത്ത", delivered:"ഡെലിവർ ചെയ്തു", inTransit:"വഴിയിൽ", cancelled:"റദ്ദ്",
    active:"സജീവം", inactive:"നിഷ്‌ക്രിയം", approved:"അംഗീകൃതം",
    paid:"അടച്ചു", due:"കുടിശ്ശിക", collected:"ശേഖരിച്ചു", balance:"ബാലൻസ്",
    settled:"തീർന്നു", partial:"ഭാഗിക", overdue:"കാലഹരണപ്പെട്ട", low:"കുറവ്",
    revenue:"വരുമാനം", totalDue:"ആകെ കുടിശ്ശിക", totalPaid:"ആകെ അടച്ചത്",
    netProfit:"അറ്റ ലാഭം", profit:"ലാഭം", loss:"നഷ്ടം", margin:"മാർജിൻ",
    orderTotal:"ഓർഡർ ആകെ", netPayable:"അടയ്‌ക്കേണ്ടത്", replacement:"മാറ്റിവയ്ക്കൽ",
    amountCollected:"ശേഖരിച്ച തുക", balanceDue:"ബാക്കി തുക",
    save:"സേവ് ചെയ്യുക", cancel:"റദ്ദ് ചെയ്യുക", delete:"ഇല്ലാതാക്കുക",
    edit:"എഡിറ്റ് ചെയ്യുക", add:"ചേർക്കുക", close:"അടയ്ക്കുക",
    search:"തിരയുക", filter:"ഫിൽറ്റർ", export:"എക്സ്പോർട്ട്", print:"പ്രിന്റ്",
    viewAll:"എല്ലാം കാണുക", configure:"ക്രമീകരിക്കുക",
    confirm:"സ്ഥിരീകരിക്കുക", yes:"അതെ", no:"ഇല്ല",
    markDone:"പൂർത്തിയായി", dispatch:"അയയ്ക്കുക", collect:"ശേഖരിക്കുക", record:"രേഖപ്പെടുത്തുക",
    addCustomer:"ഉപഭോക്താവിനെ ചേർക്കുക", addDelivery:"ഡെലിവറി ചേർക്കുക",
    addExpense:"ചെലവ് ചേർക്കുക", addSupply:"സാധനം ചേർക്കുക",
    newOrder:"പുതിയ ഓർഡർ", bulkOrder:"ബൾക്ക് ഓർഡർ",
    customer:"ഉപഭോക്താവ്", phone:"ഫോൺ", address:"വിലാസം", notes:"കുറിപ്പുകൾ",
    date:"തീയതി", status:"സ്ഥിതി", amount:"തുക", quantity:"അളവ്",
    invoice:"ഇൻവോയ്‌സ്", receipt:"രസീത്", label:"ലേബൽ",
    item:"ഇനം", product:"ഉൽപ്പന്നം", category:"വിഭാഗം", supplier:"വിതരണക്കാരൻ",
    name:"പേര്", role:"റോൾ", username:"ഉപയോക്തൃ നാമം", password:"പാസ്‌വേഡ്",
    description:"വിവരണം", reason:"കാരണം", shift:"ഷിഫ്റ്റ്",
    noDeliveries:"ഇന്ന് ഡെലിവറി ഇല്ല",
    noCustomers:"ഉപഭോക്താക്കളെ കണ്ടെത്തിയില്ല",
    deleteConfirm:"ഇത് ഇല്ലാതാക്കണോ?",
    savedSuccess:"വിജയകരമായി സേവ് ചെയ്തു",
    deletedSuccess:"വിജയകരമായി ഇല്ലാതാക്കി",
    todaysBriefing:"ഇന്നത്തെ വിവരം", pendingDeliveries:"തീർപ്പാകാത്ത ഡെലിവറി",
    overdueDeliveries:"കാലഹരണ ഡെലിവറി", lowStock:"കുറഞ്ഞ സ്റ്റോക്ക്",
    outstandingBalance:"കുടിശ്ശിക ബാലൻസ്", todayRevenue:"ഇന്നത്തെ വരുമാനം",
    allCustomers:"എല്ലാ ഉപഭോക്താക്കളും", activeCustomers:"സജീവ ഉപഭോക്താക്കൾ",
    inactiveCustomers:"നിഷ്‌ക്രിയ ഉപഭോക്താക്കൾ", owing:"കുടിശ്ശിക",
    recordPayment:"പേയ്മെന്റ് രേഖപ്പെടുത്തുക", paymentMethod:"പേയ്മെന്റ് രീതി",
    cash:"നണ്ടൻ", upi:"UPI", bank:"ബാങ്ക് ട്രാൻസ്ഫർ", cheque:"ചെക്ക്",
    paymentLedger:"പേയ്മെന്റ് ലെഡ്ജർ", dailySummary:"ദൈനിക സംഗ്രഹം",
    account:"അക്കൗണ്ട്", security:"സുരക്ഷ", notifications:"അറിയിപ്പുകൾ",
    language:"ഭാഷ", theme:"തീം", backup:"ബാക്കപ്പ്",
    lightMode:"ലൈറ്റ് മോഡ്", darkMode:"ഡാർക്ക് മോഡ്",
    loading:"ലോഡ് ചെയ്യുന്നു", connecting:"കണക്ട് ചെയ്യുന്നു", offline:"ഓഫ്‌ലൈൻ",
    signIn:"സൈൻ ഇൻ", signOut:"സൈൻ ഔട്ട്", welcome:"തിരിച്ചു സ്വാഗതം",
    more:"കൂടുതൽ", noData:"ഡേറ്റ ഇല്ല", total:"ആകെ", average:"ശരാശരി", count:"എണ്ണം",
    tableView:"പട്ടിക", compactView:"ചുരുക്കം", profile:"പ്രൊഫൈൽ",
    financials:"സാമ്പത്തിക", orderStats:"ഓർഡർ കണക്ക്", actions:"നടപടികൾ",
    logPartialPayment:"ഭാഗിക പേയ്മെന്റ് രേഖപ്പെടുത്തുക", apply:"പ്രയോഗിക്കുക",
    deliveries2:"ഡെലിവറി", all:"എല്ലാം", thisWeek2:"ഈ ആഴ്ച",
    noDeliveriesFilter:"ഡെലിവറി ഒന്നും കണ്ടെത്തിയില്ല.",
    fullProfile:"പൂർണ്ണ പ്രൊഫൈൽ", whatsapp:"വാട്ട്‌സ്ആപ്പ്", activate:"സജീവമാക്കുക",
    pause:"നിർത്തുക", paidUp:"അടച്ചു", sortBy:"ക്രമീകരിക്കുക",
    nameAZ:"പേര് A–Z", mostOwing:"ഏറ്റവും കൂടുതൽ കുടിശ്ശിക", mostOrders:"ഏറ്റവും കൂടുതൽ ഓർഡർ",
    revenueDesc:"വരുമാനം ↓", orders:"ഓർഡർ", last:"അവസാനം",
    totalBilled:"ആകെ ബിൽ", replacements:"മാറ്റിവയ്ക്കലുകൾ", deliveryRate:"ഡെലിവറി നിരക്ക്",
    collection:"ശേഖരണം", showing:"കാണിക്കുന്നു", of:"ൽ നിന്ന്", to:"വരെ",
    never:"ഒരിക്കലും ഇല്ല", today2:"ഇന്ന്", yesterday2:"ഇന്നലെ",
    noNotices:"ഇതുവരെ അറിയിപ്പുകൾ ഒന്നുമില്ല",
  },
};
// useT(settings, userLang?) → t(key) translation function
// userLang (from user object in Firebase) always wins over global settings default.
// Translation is ALWAYS active — not gated by featureMultiLanguage flag.
function useT(settings, userLang) {
  const lang = userLang || settings?.defaultLanguage || settings?.language || "en";
  const resolved = TRANSLATIONS[lang] ? lang : "en";
  return (key) => TRANSLATIONS[resolved]?.[key] ?? TRANSLATIONS["en"]?.[key] ?? key;
}

// ═══════════════════════════════════════════════════════════════
//  EXPORT DELIVERY LABEL — name, address, QR code (data URI)
//  Uses qrcodejs via CDN (loaded inline in the popup window).
// ═══════════════════════════════════════════════════════════════
function exportDeliveryLabel(d, settings) {
  const co      = settings?.companyName    || "TAS Healthy World";
  const cosub   = settings?.companySubtitle|| "Malabar Paratha Factory · Goa, India";
  const coPhone = settings?.companyPhone   || "";
  const delivId = (d.id||"").slice(-10).toUpperCase();
  const qrData  = encodeURIComponent(JSON.stringify({id:delivId,customer:d.customer,phone:d.phone||"",address:d.address||"",date:d.date||""}));

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Label — ${d.customer}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;background:#f3f4f6;display:flex;justify-content:center;align-items:flex-start;padding:24px;min-height:100vh}
.label{background:#fff;border:2.5px solid #111827;border-radius:16px;width:380px;padding:20px 22px;box-shadow:0 4px 24px rgba(0,0,0,0.10)}
.header{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #111827;padding-bottom:12px;margin-bottom:14px}
.brand{font-size:15px;font-weight:900;color:#111827;letter-spacing:-0.02em}
.brand-sub{font-size:9px;color:#6b7280;margin-top:2px}
.badge{background:#111827;color:#fff;font-size:9px;font-weight:700;padding:3px 9px;border-radius:20px;letter-spacing:0.07em;text-transform:uppercase}
.to-label{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;margin-bottom:5px}
.cust-name{font-size:22px;font-weight:900;color:#111827;letter-spacing:-0.02em;line-height:1.1}
.phone{font-size:13px;color:#374151;margin-top:5px;font-weight:600}
.address{font-size:12px;color:#6b7280;margin-top:5px;line-height:1.6}
.divider{border:none;border-top:1.5px dashed #e5e7eb;margin:14px 0}
.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
.meta-item{font-size:10px;color:#9ca3af}
.meta-val{font-weight:700;color:#111827;font-size:11px;margin-top:1px}
.qr-wrap{display:flex;justify-content:center;margin-bottom:12px}
#qr canvas,#qr img{border-radius:8px;border:1.5px solid #e5e7eb}
.footer{font-size:9px;color:#9ca3af;text-align:center;line-height:1.7}
.print-bar{position:fixed;top:0;left:0;right:0;background:#111827;color:#fff;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;z-index:9999;font-size:13px;gap:10px}
.print-bar button{padding:7px 18px;border-radius:8px;border:none;font-weight:700;font-size:12px;cursor:pointer;color:#fff}
.pbp{background:#2563eb}.pbc{background:#6b7280}
@media print{.print-bar{display:none!important}body{background:#fff;padding:0}
  .label{box-shadow:none;border-radius:0;width:100%}}
</style></head><body>
<div class="print-bar">
  <span style="font-weight:700">🏷️ Label — ${d.customer||"—"}</span>
  <div style="display:flex;gap:8px">
    <button class="pbp" onclick="window.print()">🖨 Print</button>
    <button class="pbc" onclick="window.close()">✕ Close</button>
  </div>
</div>
<div class="label">
  <div class="header">
    <div>
      <div class="brand">${co}</div>
      <div class="brand-sub">${cosub}</div>
    </div>
    <div class="badge">Delivery Label</div>
  </div>
  <div class="to-label">Deliver To</div>
  <div class="cust-name">${d.customer||"—"}</div>
  ${d.phone?`<div class="phone">📞 ${d.phone}</div>`:""}
  ${d.address?`<div class="address">📍 ${d.address}</div>`:""}
  <hr class="divider"/>
  <div class="meta-grid">
    <div class="meta-item">Order ID<div class="meta-val">#${delivId}</div></div>
    <div class="meta-item">Date<div class="meta-val">${d.date||"—"}</div></div>
    <div class="meta-item">Status<div class="meta-val">${d.status||"Pending"}</div></div>
    <div class="meta-item">Agent<div class="meta-val">${d.agent||d.createdBy||"—"}</div></div>
  </div>
  <div class="qr-wrap"><div id="qr"></div></div>
  <hr class="divider"/>
  <div class="footer">
    Scan QR to view delivery details · ${co}${coPhone?" · "+coPhone:""}<br>
    Computer-generated label · Do not discard
  </div>
</div>
<script>
  window.addEventListener("load", function(){
    try {
      new QRCode(document.getElementById("qr"), {
        text: decodeURIComponent("${qrData}"),
        width: 120, height: 120,
        colorDark: "#111827", colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch(e) {
      document.getElementById("qr").innerHTML = '<div style="font-size:10px;color:#9ca3af;padding:10px">QR unavailable offline</div>';
    }
    setTimeout(()=>window.print(), 1200);
  });
</script>
</body></html>`;

  const blob = new Blob([html], {type:"text/html;charset=utf-8"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.target = "_blank"; a.rel = "noopener";
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}

// ═══════════════════════════════════════════════════════════════
//  PUSH TO GOOGLE SHEETS — append rows via Sheets API v4
//  Requires: Google Sheet ID + an API key with Sheets write scope
//  OR: Apps Script Web App URL (simpler, no OAuth needed)
//  This implementation uses Apps Script Web App URL approach:
//    Deploy a bound Apps Script as Web App (Execute as: Me, Access: Anyone)
//    and paste the /exec URL in settings.googleSheetsWebAppUrl
// ═══════════════════════════════════════════════════════════════
async function pushToGoogleSheets(sheetName, rows, settings) {
  const webAppUrl = settings?.googleSheetsWebAppUrl || "";
  const sheetId   = settings?.googleSheetsId || "";

  if (!webAppUrl && !sheetId) {
    alert("Google Sheets not configured.\nGo to Settings → Advanced & Integrations → Google Sheets to set it up.");
    return { ok: false, error: "not_configured" };
  }

  // Prefer Apps Script Web App URL (no CORS/auth issues)
  if (webAppUrl) {
    try {
      const payload = { sheet: sheetName, rows };
      const res = await fetch(webAppUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain" }, // avoid CORS preflight
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      if (text.toLowerCase().includes("error")) throw new Error(text);
      return { ok: true };
    } catch (e) {
      console.error("Google Sheets push failed:", e);
      alert(`Google Sheets push failed: ${e.message}\nCheck your Apps Script Web App URL.`);
      return { ok: false, error: e.message };
    }
  }

  alert("Configure a Google Apps Script Web App URL in Settings for direct push.\nSee the help text in Settings → Google Sheets.");
  return { ok: false, error: "no_webapp_url" };
}

// ─────────────────────────────────────────────────────────────────────────────
//  exportDeliveryInvoice — Full A4 printable invoice for a single delivery.
//  Shows: invoice number, bill-to, itemised order, replacement deduction,
//  net payable, partial payment collected, balance due, paper trail footer.
// ─────────────────────────────────────────────────────────────────────────────
function exportDeliveryInvoice(d, products, settings, invNo) {
  const co      = settings?.companyName     || "TAS Healthy World";
  const cosub   = settings?.companySubtitle || "Malabar Paratha Factory · Goa, India";
  const gst     = settings?.companyGST      || "";
  const coPhone = settings?.companyPhone    || "";
  const coAddr  = settings?.companyAddress  || "";
  const coLogo  = settings?.companyLogo     || "";
  // ── GST ──────────────────────────────────────────────────────
  const gstEnabled = !!settings?.featureGST;
  const gstin      = settings?.gstCompanyGSTIN || "";
  const hsnCode    = settings?.gstDefaultHSN   || "";
  const cgstPct    = gstEnabled ? +(settings?.gstCGSTPct??9)  : 0;
  const sgstPct    = gstEnabled ? +(settings?.gstSGSTPct??9)  : 0;
  const rows    = lineRows(d.orderLines||{}, products).filter(r=>r.qty>0);
  const gross   = lineTotal(d.orderLines||{});
  const taxRate = +(settings?.taxRate||0);
  const taxAmt  = taxRate>0 ? Math.round(gross*(taxRate/100)*100)/100 : 0;
  // GST amounts (applied on taxable value = gross)
  const cgstAmt = gstEnabled ? Math.round(gross*(cgstPct/100)*100)/100 : 0;
  const sgstAmt = gstEnabled ? Math.round(gross*(sgstPct/100)*100)/100 : 0;
  const gstTotal= cgstAmt + sgstAmt;
  const replAmt = +(d.replacement?.amount)||0;
  const net     = Math.max(0, gross + (gstEnabled ? gstTotal : taxAmt) - replAmt);
  const partial = d.partialPayment?.enabled ? +(d.partialPayment?.amount)||0 : 0;
  const balance = Math.max(0, net - partial);
  const now     = new Date().toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
  const sc      = d.status==="Delivered"?"#059669":d.status==="In Transit"?"#2563eb":d.status==="Cancelled"?"#dc2626":"#d97706";
  const delivId = (d.id||"").slice(-10).toUpperCase();

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Invoice ${invNo} — ${d.customer}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
body{font-family:'Inter',Arial,sans-serif;color:#111827;background:#fff;font-size:13px;line-height:1.5}
.page{max-width:820px;margin:0 auto;padding:48px 56px}
/* Header */
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px;padding-bottom:28px;border-bottom:3px solid #111827}
.brand-name{font-size:22px;font-weight:900;color:#111827;letter-spacing:-0.03em}
.brand-sub{font-size:11px;color:#6b7280;margin-top:4px;line-height:1.6}
.inv-block{text-align:right}
.inv-title{font-size:36px;font-weight:900;color:#111827;letter-spacing:-0.04em;line-height:1}
.inv-num{font-size:14px;font-weight:700;color:#2563eb;margin-top:8px;letter-spacing:0.02em}
.inv-meta{font-size:11px;color:#6b7280;margin-top:3px}
.status-pill{display:inline-block;padding:3px 12px;border-radius:20px;font-size:10px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;margin-top:8px}
/* Addresses */
.addresses{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:32px}
.addr-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;margin-bottom:8px}
.addr-name{font-size:16px;font-weight:700;color:#111827}
.addr-detail{font-size:12px;color:#6b7280;margin-top:3px;line-height:1.6}
/* Items table */
.items-table{width:100%;border-collapse:collapse;margin-bottom:0}
.items-table thead tr{background:#f1f5f9;border-bottom:2px solid #e2e8f0}
.items-table th{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;padding:10px 14px;text-align:left}
.items-table th.r{text-align:right}
.items-table td{padding:11px 14px;border-bottom:1px solid #f1f5f9;color:#111827;font-size:13px;vertical-align:middle}
.items-table td.r{text-align:right;font-variant-numeric:tabular-nums}
.items-table tbody tr:last-child td{border-bottom:2px solid #111827}
.item-name{font-weight:600}
.item-sku{font-size:10px;color:#9ca3af;margin-top:1px}
/* Totals */
.totals-wrap{display:flex;justify-content:flex-end;margin-bottom:28px}
.totals-box{width:320px}
.tot-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px solid #f1f5f9}
.tot-row.gross{color:#374151}
.tot-row.repl{color:#ea580c}
.tot-row.net{font-weight:700;color:#111827;border-bottom:2px solid #111827}
.tot-row.collected{color:#059669;font-weight:600}
.tot-row.balance-due{font-weight:800;font-size:15px;border-bottom:none;padding-top:10px;color:#dc2626}
.tot-row.balance-paid{font-weight:800;font-size:15px;border-bottom:none;padding-top:10px;color:#059669}
/* Replacement box */
.repl-section{background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px 20px;margin-bottom:20px}
.repl-heading{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#92400e;margin-bottom:10px}
.repl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
.repl-field{font-size:11px;color:#78350f}
.repl-val{font-weight:700;color:#111827;font-size:12px;margin-top:2px}
/* Partial pay banner */
.partial-banner{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px 20px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}
.partial-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#059669}
.partial-detail{font-size:11px;color:#6b7280;margin-top:2px}
.partial-amt{font-size:22px;font-weight:900;color:#059669}
/* Balance box */
.balance-banner{border-radius:12px;padding:16px 22px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:center}
.balance-banner.due{background:#111827;color:#fff}
.balance-banner.paid{background:#059669;color:#fff}
.bal-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;opacity:0.7}
.bal-sub{font-size:10px;opacity:0.55;margin-top:3px}
.bal-amt{font-size:28px;font-weight:900;letter-spacing:-0.02em}
/* Paper trail */
.trail-section{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin-bottom:28px}
.trail-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;margin-bottom:10px}
.trail-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px 24px}
.trail-item{font-size:10px;color:#6b7280;font-family:monospace;line-height:1.7}
.trail-item b{color:#374151}
/* Footer */
.footer{border-top:1px solid #e5e7eb;padding-top:16px;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#9ca3af}
.footer-brand{font-weight:700;color:#374151}
/* Print */
.print-bar{position:fixed;top:0;left:0;right:0;background:#111827;color:#fff;padding:10px 24px;display:flex;align-items:center;justify-content:space-between;z-index:9999;font-family:Inter,Arial,sans-serif;font-size:13px;gap:12px;box-shadow:0 2px 12px rgba(0,0,0,0.4)}
.print-bar a{padding:7px 18px;border-radius:8px;text-decoration:none;font-weight:700;font-size:12px;white-space:nowrap;color:#fff}
.print-bar a.print{background:#2563eb}
.print-bar a.save{background:#059669}
.print-bar a.inv{background:#7c3aed}
@media print{
  @page{size:A4;margin:1.2cm 1.4cm}
  body{font-size:12px}
  .print-bar{display:none!important}
  .page{padding:0;max-width:100%}
  .items-table th,.items-table td{padding:8px 10px}
}
</style></head><body>
<div class="page">

<!-- HEADER -->
<div class="header">
  <div>
    ${coLogo?`<img src="${coLogo}" alt="logo" style="max-height:52px;max-width:130px;object-fit:contain;margin-bottom:6px;display:block"/>`:""}
    <div class="brand-name">${coLogo?"":settings?.appEmoji||"🫓"} ${co}</div>
    <div class="brand-sub">
      ${cosub}<br>
      ${coAddr?coAddr+"<br>":""}
      ${coPhone?`📞 ${coPhone}<br>`:""}
      ${gst?`GST: ${gst}<br>`:""}
      ${gstEnabled&&gstin?`<b>GSTIN: ${gstin}</b>`:""}
    </div>
  </div>
  <div class="inv-block">
    <div class="inv-title">INVOICE</div>
    <div class="inv-num">${invNo}</div>
    <div class="inv-meta">Date: ${d.date||today()}</div>
    ${d.deliveryDate&&d.deliveryDate!==d.date?`<div class="inv-meta">Deliver by: ${d.deliveryDate}</div>`:""}
    <div class="inv-meta">Issued: ${now}</div>
    <span class="status-pill" style="background:${sc}20;color:${sc}">${d.status||"Pending"}</span>
  </div>
</div>

<!-- BILL TO / FROM -->
<div class="addresses">
  <div>
    <div class="addr-label">Bill To</div>
    <div class="addr-name">${d.customer||"—"}</div>
    ${d.phone?`<div class="addr-detail">📞 ${d.phone}</div>`:""}
    ${d.address?`<div class="addr-detail">📍 ${d.address}</div>`:""}
  </div>
  <div>
    <div class="addr-label">Order Details</div>
    <div class="addr-detail"><b>Order ID:</b> #${delivId}</div>
    <div class="addr-detail"><b>Agent:</b> ${d.agent||d.createdBy||"—"}</div>
    ${d.notes?`<div class="addr-detail"><b>Notes:</b> ${d.notes}</div>`:""}
  </div>
</div>

<!-- ITEMS TABLE -->
<table class="items-table">
  <thead>
    <tr>
      <th style="width:40px">#</th>
      <th>Product</th>
      ${gstEnabled&&hsnCode?`<th>HSN</th>`:""}
      <th>Unit</th>
      <th class="r">Qty</th>
      <th class="r">Unit Price</th>
      <th class="r">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${rows.map((r,i)=>`
    <tr>
      <td style="color:#9ca3af;font-size:11px">${i+1}</td>
      <td><div class="item-name">${r.name}</div><div class="item-sku">${r.unit}</div></td>
      ${gstEnabled&&hsnCode?`<td style="color:#6b7280;font-size:11px">${hsnCode}</td>`:""}
      <td style="color:#6b7280">${r.unit}</td>
      <td class="r">${r.qty}</td>
      <td class="r">₹${r.priceAmount.toLocaleString("en-IN")}</td>
      <td class="r" style="font-weight:700">₹${(r.qty*r.priceAmount).toLocaleString("en-IN")}</td>
    </tr>`).join("")}
    ${rows.length===0?`<tr><td colspan="${gstEnabled&&hsnCode?7:6}" style="color:#9ca3af;text-align:center;padding:20px">No items recorded</td></tr>`:""}
  </tbody>
</table>

<!-- TOTALS -->
<div class="totals-wrap">
  <div class="totals-box">
    <div class="tot-row gross"><span>Subtotal</span><span>₹${gross.toLocaleString("en-IN")}</span></div>
    ${gstEnabled
      ? `<div class="tot-row" style="color:#6b7280"><span>CGST @${cgstPct}%${hsnCode?" (HSN "+hsnCode+")":""}</span><span>+₹${cgstAmt.toLocaleString("en-IN")}</span></div>
         <div class="tot-row" style="color:#6b7280"><span>SGST @${sgstPct}%</span><span>+₹${sgstAmt.toLocaleString("en-IN")}</span></div>
         <div class="tot-row" style="color:#374151;font-weight:600"><span>Total GST</span><span>+₹${gstTotal.toLocaleString("en-IN")}</span></div>`
      : taxRate>0?`<div class="tot-row" style="color:#6b7280"><span>Tax (${taxRate}%)</span><span>+₹${taxAmt.toLocaleString("en-IN")}</span></div>`:""}
    ${replAmt>0?`<div class="tot-row repl"><span>🔄 Replacement Deduction</span><span>−₹${replAmt.toLocaleString("en-IN")}</span></div>`:""}
    <div class="tot-row net"><span>Net Payable</span><span>₹${net.toLocaleString("en-IN")}</span></div>
    ${partial>0?`<div class="tot-row collected"><span>✓ Amount Collected</span><span>₹${partial.toLocaleString("en-IN")}</span></div>`:""}
  </div>
</div>

${d.replacement?.done?`
<!-- REPLACEMENT DETAILS -->
<div class="repl-section">
  <div class="repl-heading">🔄 Replacement Details</div>
  <div class="repl-grid">
    ${d.replacement.item?`<div><div class="repl-field">Item Replaced</div><div class="repl-val">${d.replacement.item}</div></div>`:""}
    ${d.replacement.qty?`<div><div class="repl-field">Quantity</div><div class="repl-val">${d.replacement.qty}</div></div>`:""}
    ${d.replacement.reason?`<div style="grid-column:1/-1"><div class="repl-field">Reason</div><div class="repl-val">${d.replacement.reason}</div></div>`:""}
    ${replAmt>0?`<div><div class="repl-field">Amount Deducted from Invoice</div><div class="repl-val" style="color:#ea580c">−₹${replAmt.toLocaleString("en-IN")}</div></div>`:""}
  </div>
</div>`:""}

${partial>0?`
<!-- PARTIAL PAYMENT -->
<div class="partial-banner">
  <div>
    <div class="partial-label">✓ Partial Payment Collected</div>
    <div class="partial-detail">Collected at time of delivery${d.partialPayment?.collectedAt?" on "+d.partialPayment.collectedAt:""}</div>
    ${d.partialPayment?.note?`<div class="partial-detail">Note: ${d.partialPayment.note}</div>`:""}
  </div>
  <div class="partial-amt">₹${partial.toLocaleString("en-IN")}</div>
</div>`:""}

<!-- BALANCE BANNER -->
<div class="balance-banner ${balance===0?"paid":"due"}">
  <div>
    <div class="bal-label">${balance===0?"✓ Invoice Fully Settled":"Balance Due"}</div>
    ${balance===0?`<div class="bal-sub">No outstanding amount · Thank you!</div>`
    :partial>0?`<div class="bal-sub">After ₹${partial.toLocaleString("en-IN")} collected · Remaining balance</div>`
    :`<div class="bal-sub">Full amount outstanding · Please arrange payment</div>`}
  </div>
  <div class="bal-amt">₹${balance.toLocaleString("en-IN")}</div>
</div>

<!-- PAPER TRAIL -->
<div class="trail-section">
  <div class="trail-title">📋 Paper Trail</div>
  <div class="trail-grid">
    <div class="trail-item"><b>Invoice No:</b> ${invNo}</div>
    <div class="trail-item"><b>Delivery ID:</b> #${delivId}</div>
    <div class="trail-item"><b>Order Date:</b> ${d.date||"—"}</div>
    <div class="trail-item"><b>Status:</b> ${d.status||"—"}</div>
    <div class="trail-item"><b>Created by:</b> ${d.createdBy||"—"}</div>
    ${d.agent?`<div class="trail-item"><b>Agent:</b> ${d.agent}</div>`:""}
    <div class="trail-item"><b>Gross Amount:</b> ₹${gross.toLocaleString("en-IN")}</div>
    ${replAmt>0?`<div class="trail-item"><b>Replacement Deducted:</b> −₹${replAmt.toLocaleString("en-IN")}</div>`:""}
    <div class="trail-item"><b>Net Payable:</b> ₹${net.toLocaleString("en-IN")}</div>
    ${partial>0?`<div class="trail-item"><b>Collected:</b> ₹${partial.toLocaleString("en-IN")}</div>`:""}
    <div class="trail-item"><b>Balance:</b> ${balance===0?"SETTLED":"₹"+balance.toLocaleString("en-IN")}</div>
    <div class="trail-item"><b>Issued at:</b> ${now}</div>
  </div>
</div>

<!-- FOOTER -->
<div class="footer">
  <div>
    <div class="footer-brand">🫓 ${co}</div>
    <div>${cosub}${coPhone?" · 📞 "+coPhone:""}</div>
    ${gst?`<div>GST: ${gst}</div>`:""}
  </div>
  <div style="text-align:right">
    <div>This is a computer-generated invoice.</div>
    <div>For disputes contact: ${coPhone||"your account manager"}</div>
  </div>
</div>

</div><!-- .page -->
<div class="print-bar">
  <span style="font-weight:700">📄 Invoice ${invNo} — ${d.customer||"—"}</span>
  <div style="display:flex;gap:8px">
    <a class="print" href="#" onclick="window.print();return false;">🖨 Print / PDF</a>
    <a class="save" href="#" onclick="var b=document.documentElement.outerHTML;var bl=new Blob([b],{type:'text/html'});var u=URL.createObjectURL(bl);var a=document.createElement('a');a.href=u;a.download='Invoice_${invNo}_${(d.customer||"").replace(/[^a-zA-Z0-9]/g,"_")}.html';document.body.appendChild(a);a.click();URL.revokeObjectURL(u);return false;">⬇ Save</a>
  </div>
</div>
<script>window.addEventListener("load",function(){window.print();});</script>
</body></html>`;

  const blob = new Blob([html], {type:"text/html;charset=utf-8"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.target = "_blank"; a.rel = "noopener";
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}

// ─── exportDeliveryReceipt — compact thermal-style delivery receipt ───
function exportDeliveryReceipt(d, products, settings, invNo) {
  const showPrices = settings?.agentInvoiceShowPrices !== false;
  const co      = settings?.companyName     || "TAS Healthy World";
  const cosub   = settings?.companySubtitle || "Malabar Paratha Factory · Goa, India";
  const gst     = settings?.companyGST      || "";
  const coPhone = settings?.companyPhone    || "";
  const coLogo  = settings?.companyLogo     || "";
  const rows    = lineRows(d.orderLines||{}, products).filter(r=>r.qty>0);
  const orderTotal = lineTotal(d.orderLines||{});
  const replAmt    = +(d.replacement?.amount)||0;
  const netAmt     = orderTotal - replAmt;
  const collected  = d.partialPayment?.enabled ? +(d.partialPayment?.amount)||0 : 0;
  const balanceDue = Math.max(0, netAmt - collected);
  const receiptNo  = invNo ? `RCP-${invNo.replace(/^[A-Z0-9]+-/,"")}` : `RCP-${(d.date||"").replace(/-/g,"")}-${(d.id||"").slice(-5).toUpperCase()}`;
  const now        = new Date().toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
  const statusColor= d.status==="Delivered"?"#059669":d.status==="In Transit"?"#2563eb":"#d97706";

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Delivery Receipt — ${d.customer}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;color:#1c1917;background:#fff;padding:0;max-width:420px;margin:0 auto}
.wrap{padding:24px 20px}
.brand-bar{background:#1e3a5f;color:#fff;padding:14px 20px;text-align:center}
.brand-name{font-size:17px;font-weight:900;letter-spacing:0.02em}
.brand-sub{font-size:10px;opacity:0.75;margin-top:2px}
.receipt-title{text-align:center;padding:14px 20px 0;border-bottom:2px dashed #e5e5e5;padding-bottom:14px;margin-bottom:0}
.receipt-no{font-size:11px;color:#6b7280;font-weight:700;letter-spacing:0.08em;text-transform:uppercase}
.receipt-date{font-size:10px;color:#9ca3af;margin-top:2px}
.section{padding:12px 20px;border-bottom:1px solid #f3f4f6}
.section-label{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;margin-bottom:8px}
.cust-name{font-size:16px;font-weight:800;color:#111827}
.cust-detail{font-size:11px;color:#6b7280;margin-top:3px;line-height:1.5}
.status-badge{display:inline-block;padding:3px 12px;border-radius:20px;font-size:10px;font-weight:800;margin-top:6px}
.line-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #f9fafb;font-size:12px}
.line-name{color:#374151;flex:1}
.line-qty{color:#6b7280;width:32px;text-align:center;font-weight:600}
.line-price{color:#6b7280;width:60px;text-align:right;font-size:11px}
.line-amt{color:#111827;width:64px;text-align:right;font-weight:700}
.total-row{display:flex;justify-content:space-between;padding:7px 0;font-size:13px}
.repl-box{background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:10px 12px;margin:0 20px 0}
.repl-title{font-size:11px;font-weight:800;color:#92400e;margin-bottom:6px}
.repl-detail{font-size:11px;color:#78716c;line-height:1.6}
.pay-section{padding:12px 20px}
.pay-row{display:flex;justify-content:space-between;font-size:13px;padding:4px 0}
.balance-box{background:#111827;color:#fff;margin:0 20px;border-radius:10px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center}
.balance-label{font-size:11px;opacity:0.7;font-weight:700;text-transform:uppercase;letter-spacing:0.06em}
.balance-amt{font-size:22px;font-weight:900}
.balance-paid{background:#059669}
.collected-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 14px;margin:8px 20px;display:flex;justify-content:space-between;align-items:center}
.trail{background:#f8fafc;margin:0 20px;border-radius:8px;padding:10px 12px;font-size:9px;color:#9ca3af;line-height:1.8;border:1px solid #e2e8f0}
.trail b{color:#6b7280}
.footer{text-align:center;padding:14px 20px 20px;font-size:10px;color:#9ca3af;line-height:1.7}
.print-bar{position:fixed;top:0;left:0;right:0;background:#1e3a5f;color:#fff;padding:8px 16px;display:flex;align-items:center;justify-content:space-between;z-index:9999;font-family:Arial,sans-serif;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,0.3);gap:10px}
.print-bar a{background:#3b82f6;color:#fff;padding:5px 14px;border-radius:7px;text-decoration:none;font-weight:700;font-size:12px;white-space:nowrap}
@media print{@page{size:80mm auto;margin:0}.print-bar{display:none!important}body{padding:0;max-width:100%}}
</style></head><body>
<div class="brand-bar">
  ${coLogo?`<img src="${coLogo}" alt="logo" style="max-height:40px;max-width:100px;object-fit:contain;margin-bottom:4px;display:block"/>`:""}
  <div class="brand-name">${co}</div>
  <div class="brand-sub">${cosub}${coPhone?` · ${coPhone}`:""}${gst?` · GST: ${gst}`:""}</div>
</div>

<div class="receipt-title">
  <div class="receipt-no">Delivery Receipt · ${receiptNo}</div>
  <div class="receipt-date">Issued: ${now}</div>
</div>

<!-- Customer -->
<div class="section">
  <div class="section-label">Deliver To</div>
  <div class="cust-name">${d.customer||"—"}</div>
  ${d.address?`<div class="cust-detail">📍 ${d.address}</div>`:""}
  ${d.notes?`<div class="cust-detail" style="font-style:italic;color:#9ca3af">"${d.notes}"</div>`:""}
  <div><span class="status-badge" style="background:${statusColor}18;color:${statusColor};border:1px solid ${statusColor}40">${d.status||"Pending"}</span></div>
  <div class="cust-detail" style="margin-top:6px">Order date: <b>${d.date||"—"}</b>${d.deliveryDate&&d.deliveryDate!==d.date?` · Deliver by: <b>${d.deliveryDate}</b>`:""}</div>
  <div class="cust-detail">Handled by: <b>${d.agent||d.createdBy||"—"}</b> · Ref: #${(d.id||"").slice(-8)}</div>
</div>

<!-- Items -->
<div class="section">
  <div class="section-label">Items Ordered</div>
  ${rows.length===0?'<div style="font-size:12px;color:#9ca3af">No items</div>':rows.map(r=>`
  <div class="line-row">
    <span class="line-name">${r.name}</span>
    <span class="line-qty">${r.qty}×</span>
    ${showPrices?`<span class="line-price">₹${r.priceAmount.toLocaleString("en-IN")}</span><span class="line-amt">₹${(r.qty*r.priceAmount).toLocaleString("en-IN")}</span>`:`<span class="line-price"></span><span class="line-amt" style="color:#9ca3af">${r.qty} ${r.unit||"pcs"}</span>`}
  </div>`).join("")}
  ${showPrices&&orderTotal>0?`<div class="total-row" style="border-top:2px solid #111827;margin-top:6px;font-weight:700"><span style="color:#374151">Order Total</span><span style="color:#111827">₹${orderTotal.toLocaleString("en-IN")}</span></div>`:""}
</div>

<!-- Replacement (if any) -->
${d.replacement?.done?`
<div style="padding:10px 20px 0">
<div class="repl-box">
  <div class="repl-title">🔄 Replacement Made</div>
  <div class="repl-detail">
    ${d.replacement.item?`<b>Item:</b> ${d.replacement.item}<br>`:""}
    ${d.replacement.qty?`<b>Quantity:</b> ${d.replacement.qty}<br>`:""}
    ${d.replacement.reason?`<b>Reason:</b> ${d.replacement.reason}<br>`:""}
    ${showPrices&&replAmt>0?`<b style="color:#ea580c">Amount deducted: −₹${replAmt.toLocaleString("en-IN")}</b>`:""}
  </div>
</div>
</div>`:""}

<!-- Payment Summary -->
${showPrices?`
<div class="pay-section">
  <div class="section-label">Payment Summary</div>
  ${orderTotal>0?`<div class="pay-row"><span style="color:#6b7280">Order Total</span><span style="font-weight:600">₹${orderTotal.toLocaleString("en-IN")}</span></div>`:""}
  ${replAmt>0?`<div class="pay-row"><span style="color:#ea580c">Replacement Deduction</span><span style="color:#ea580c;font-weight:700">−₹${replAmt.toLocaleString("en-IN")}</span></div>`:""}
  ${replAmt>0?`<div class="pay-row" style="border-top:1px solid #e5e7eb;padding-top:6px;font-weight:700"><span>Net Payable</span><span>₹${netAmt.toLocaleString("en-IN")}</span></div>`:""}
</div>
${collected>0?`<div class="collected-box"><div><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#059669">✓ Amount Collected</div><div style="font-size:9px;color:#6b7280;margin-top:1px">Received at time of delivery</div></div><div style="font-size:18px;font-weight:900;color:#059669">₹${collected.toLocaleString("en-IN")}</div></div>`:""}
<div style="padding:8px 20px 12px">
<div class="balance-box ${balanceDue===0?"balance-paid":""}">
  <div>
    <div class="balance-label">${balanceDue===0?"✓ Fully Paid":"Balance Due"}</div>
    ${balanceDue===0?'<div style="font-size:10px;opacity:0.7;margin-top:2px">No amount outstanding</div>':""}
  </div>
  <div class="balance-amt">₹${balanceDue.toLocaleString("en-IN")}</div>
</div>
</div>`:""}

<!-- Paper Trail -->
<div style="padding:8px 20px 0">
<div class="trail">
  <b>Paper Trail</b><br>
  Receipt No: ${receiptNo}<br>
  Delivery ID: ${(d.id||"").slice(-12)}<br>
  Delivery Date: ${d.date||"—"}<br>
  Status: ${d.status||"—"}<br>
  Created by: ${d.createdBy||"—"}<br>
  ${d.agent?`Assigned Agent: ${d.agent}<br>`:""}
  Issued at: ${now}<br>
  ${d.replacement?.done?`Replacement logged: YES — ${d.replacement.item||"—"}<br>`:""}
  ${collected>0?`Payment collected: ₹${collected.toLocaleString("en-IN")}<br>`:""}
</div>
</div>

<div class="footer">
  ${co} · ${cosub}<br>
  This is a computer-generated delivery receipt and serves as an official record.<br>
  For queries contact: ${coPhone||"your account manager"}
</div>

<div class="print-bar"><span>🧾 Delivery Receipt — ${d.customer}</span><div style="display:flex;gap:8px"><a href="#" onclick="window.print();return false;">🖨 Print</a></div></div>
<script>window.addEventListener("load",function(){window.print();});</script>
</body></html>`;

  const blob = new Blob([html], {type:"text/html;charset=utf-8"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.target = "_blank"; a.rel = "noopener";
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}


function shareWhatsApp(record, products, type, settings) {
  const rows   = lineRows(record.orderLines||record.orders||{}, products);
  const total  = lineTotal(record.orderLines||record.orders||{});
  const name   = record.name || record.customer || "—";
  const co     = settings?.companyName || "TAS Healthy World";
  const phone  = record.phone ? record.phone.replace(/\D/g,"") : "";
  let msg = `🫓 *${co}*\n`;
  if(type==="delivery") msg += `📦 *Delivery Order*\n📅 Date: ${record.date||""}${record.deliveryDate?" → "+record.deliveryDate:""}\nStatus: ${record.status||"Pending"}\n`;
  else msg += `🧾 *Invoice*\n📅 ${record.date||""}\n`;
  msg += `\n*Customer:* ${name}`;
  if(record.address) msg += `\n📍 ${record.address}`;
  msg += `\n\n*Items:*\n`;
  rows.forEach(r=>{msg+=`• ${r.qty} × ${r.name} @ ₹${r.priceAmount} = ₹${r.qty*r.priceAmount}\n`;});
  msg += `\n*Total: ₹${total.toLocaleString("en-IN")}*`;
  if(type==="delivery") {
    const replAmt = +(record.replacement?.amount||0);
    const collected = record.partialPayment?.enabled ? +(record.partialPayment?.amount||0) : 0;
    const net = Math.max(0, total - replAmt);
    const balance = Math.max(0, net - collected);
    if(replAmt>0) msg += `\n🔄 Replacement deducted: −₹${replAmt.toLocaleString("en-IN")}\n*Net Payable: ₹${net.toLocaleString("en-IN")}*`;
    if(collected>0) msg += `\n✅ Collected: ₹${collected.toLocaleString("en-IN")}`;
    if(balance>0) msg += `\n⚠️ *Balance Due: ₹${balance.toLocaleString("en-IN")}*`;
    else if(collected>0) msg += `\n✓ Fully settled`;
  }
  if(type==="customer"&&record.pending>0) msg+=`\n⚠️ Pending: ₹${(record.pending||0).toLocaleString("en-IN")}`;
  msg += `\n\n_${co}_`;
  const encoded = encodeURIComponent(msg);
  // Use phone as-is; strip non-digits and let WhatsApp handle routing.
  // If number starts with 0, drop the leading 0 (local format) and prepend nothing —
  // WhatsApp resolves it from the user's own country. For fully international numbers
  // stored with +, pass them directly.
  let waPhone = phone.replace(/\D/g,"");
  if(waPhone.startsWith("0")) waPhone=waPhone.slice(1);
  const url = waPhone ? `https://wa.me/${waPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
  window.open(url,"_blank","noopener");
}

function exportCSV(data, fname, cols, settings) {
  const esc = v => { const s=String(v==null?"":v); return s.includes(",")||s.includes('"')||s.includes("\n")?`"${s.replace(/"/g,'""')}"`:`${s}`; };
  const co = settings?.companyName||"TAS Healthy World";
  const cosub = settings?.companySubtitle||"";
  const now = new Date().toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
  const getVal = (row, c) => typeof c.val==="function" ? c.val(row) : (row[c.key]??(""));
  const toNum = v => { const n=Number(String(v).replace(/[₹,]/g,"")); return isNaN(n)?0:n; };
  const sumOf = (col) => col ? data.reduce((s,r)=>s+toNum(getVal(r,col)),0) : null;
  const paidCol   = cols.find(c=>c.key==="paid"||String(c.label).toLowerCase().includes("paid (₹)"));
  const pendCol   = cols.find(c=>c.key==="pending"||String(c.label).toLowerCase().includes("pending (₹)"));
  const revCol    = cols.find(c=>c.key==="_revenue"||c.key==="revenue"||String(c.label).toLowerCase().includes("revenue"));
  const ordersCol = cols.find(c=>c.key==="_orders"||c.key==="orderCount"||String(c.label).toLowerCase()==="# orders");
  const totalPaid    = sumOf(paidCol);
  const totalPending = sumOf(pendCol);
  const totalRev     = sumOf(revCol);
  const totalOrders  = sumOf(ordersCol);
  const collRate     = (totalPaid!=null&&totalPending!=null&&(totalPaid+totalPending)>0)?Math.round(totalPaid/(totalPaid+totalPending)*100):null;
  const summaryLines = [
    `"=== ${co.toUpperCase()} — ${fname.replace(/_/g," ").toUpperCase()} EXPORT ==="`,
    `"Exported:","${now}"`,
    `"Records:","${data.length}"`,
    ...(cosub?[`"","${cosub}"`]:[]),
    `""`,
    `"── SUMMARY ──"`,
    ...(totalRev!=null?[`"Total Revenue (Rs)","${totalRev.toLocaleString("en-IN")}"`]:[]),
    ...(totalPaid!=null?[`"Total Collected (Rs)","${totalPaid.toLocaleString("en-IN")}"`]:[]),
    ...(totalPending!=null?[`"Total Outstanding (Rs)","${totalPending.toLocaleString("en-IN")}"`]:[]),
    ...(collRate!=null?[`"Collection Rate","${collRate}%"`]:[]),
    ...(totalOrders!=null?[`"Total Orders","${totalOrders}"`]:[]),
    `"Active Customers","${data.filter(r=>r.active===true||r.active==="Yes").length}"`,
    `"Unpaid Customers","${data.filter(r=>{const p=pendCol?toNum(getVal(r,pendCol)):0;return p>0;}).length}"`,
    `""`,
    `"── DATA ──"`,
  ];
  const totalsRow = cols.map((c,ci)=>{
    const t=sumOf(c);
    if(t!==null&&t!==0&&c.num!==false) return esc(`TOTAL: ${t.toLocaleString("en-IN")}`);
    return ci===0?esc(`TOTAL (${data.length} records)`):"";
  }).join(",");
  const csv = [
    ...summaryLines,
    cols.map(c=>esc(c.label)).join(","),
    ...data.map(r=>cols.map(c=>esc(getVal(r,c)??(""))).join(",")),
    totalsRow,
  ].join("\n");
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"}));
  a.download=`${fname}_${today()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// --- CUSTOMERS CSV - flattens to individual delivery/order rows ---
// Call this instead of exportCSV when you want one row per delivery, not per customer.
// Params: customers[], deliveries[], products[], settings
// eslint-disable-next-line no-unused-vars
function exportCustomersCSV(customers, deliveries, products, settings) {
  const esc = v => { const s=String(v==null?"":v); return s.includes(",")||s.includes('"')||s.includes("\n")?`"${s.replace(/"/g,'""')}"`:`${s}`; };
  const co  = settings?.companyName||"TAS Healthy World";
  const now = new Date().toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
  const rows = [];
  // Header block
  rows.push(`"=== ${co.toUpperCase()} — CUSTOMERS EXPORT (PER ORDER) ==="`);
  rows.push(`"Exported:","${now}"`);
  rows.push(`"Customers:","${customers.length}"`);
  rows.push(`"Total Deliveries:","${deliveries.length}"`);
  rows.push(`""`);
  rows.push(`"── ORDER DATA ──"`);
  rows.push([
    "Customer","Phone","Address","Agent/Created By",
    "Invoice No","Receipt No","Date","Status",
    "Items","Order Total","Repl Item","Repl Amount","Net Payable",
    "Collected","Balance Due","Payment Status","Notes"
  ].map(esc).join(","));

  // One row per delivery, enriched with customer data
  const custMap = Object.fromEntries(customers.map(c=>[c.id,c]));
  [...deliveries].sort((a,b)=>(a.date||"").localeCompare(b.date||"")).forEach(d=>{
    const cust = custMap[d.customerId]||{};
    const invNo = d.invNo||`INV-${(d.date||"").replace(/-/g,"")}-${(d.id||"").slice(-4).toUpperCase()}`;
    const rcptNo = `RCP-${invNo.replace(/^[A-Z]+-/,"")}`;
    // Build items string
    const itemsStr = Object.entries(d.orderLines||{})
      .filter(([,l])=>l.qty>0)
      .map(([pid,l])=>{const p=products.find(x=>x.id===pid);return `${l.qty}×${p?p.name:(l.name||pid)}`;})
      .join("; ");
    const orderTotal = Object.entries(d.orderLines||{}).reduce((s,[,l])=>s+(l.qty||0)*(l.priceAmount||0),0);
    const replAmt   = +(d.replacement?.amount)||0;
    const netAmt    = Math.max(0, orderTotal - replAmt);
    const collected = d.partialPayment?.enabled ? (+(d.partialPayment?.amount)||0) : 0;
    const balance   = Math.max(0, netAmt - collected);
    const payStatus = balance===0?"PAID":"UNPAID";
    rows.push([
      cust.name||d.customer||"—",
      cust.phone||"—",
      cust.address||"—",
      d.createdBy||d._createdBy||"—",
      invNo, rcptNo, d.date||"—", d.status||"Pending",
      itemsStr||"—",
      orderTotal, d.replacement?.done?(d.replacement.item||""):"—",
      replAmt||"—", netAmt,
      collected||"—", balance||"—", payStatus,
      d.notes||"—"
    ].map(esc).join(","));
  });

  // Summary totals at bottom
  const totalRev     = deliveries.filter(d=>d.status==="Delivered").reduce((s,d)=>s+Object.entries(d.orderLines||{}).reduce((ss,[,l])=>ss+(l.qty||0)*(l.priceAmount||0),0),0);
  const totalPaid    = customers.reduce((s,c)=>s+(c.paid||0),0);
  const totalPending = customers.reduce((s,c)=>s+(c.pending||0),0);
  rows.push(`""`);
  rows.push(`"── SUMMARY ──"`);
  rows.push(`"Total Revenue (Delivered Orders, Rs)","${totalRev.toLocaleString("en-IN")}"`);
  rows.push(`"Total Collected (Rs)","${totalPaid.toLocaleString("en-IN")}"`);
  rows.push(`"Total Outstanding (Rs)","${totalPending.toLocaleString("en-IN")}"`);
  if(totalPaid+totalPending>0) rows.push(`"Collection Rate","${Math.round(totalPaid/(totalPaid+totalPending)*100)}%"`);

  const csv = rows.join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"}));
  a.download = `Customers_orders_${today()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// eslint-disable-next-line no-unused-vars
function exportWord(record, products, type, settings) {
  const rows = lineRows(record.orderLines||{}, products);
  const total= lineTotal(record.orderLines||{});
  const name = record.name||record.customer||"—";
  const co   = settings?.companyName||"TAS Healthy World";
  const cosub= settings?.companySubtitle||"Malabar Paratha Factory · Goa, India";
  const gst  = settings?.companyGST||"";
  const coPhone=settings?.companyPhone||"";
  const invoiceNo=record.invNo||`INV-${(record.date||today()).replace(/-/g,"")}-${(record.id||uid()).slice(-4).toUpperCase()}`;
  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
<head><meta charset='utf-8'><title>Invoice — ${name}</title>
<style>
  @page{size:A4;margin:2cm 2.2cm}
  body{font-family:'Calibri',Arial,sans-serif;font-size:11pt;color:#1c1917;line-height:1.5}
  .header-table{width:100%;border-collapse:collapse;margin-bottom:20pt}
  .brand{font-size:18pt;font-weight:700;color:#78350f;letter-spacing:-0.3pt}
  .brand-sub{font-size:9pt;color:#78716c;margin-top:2pt}
  .inv-title{font-size:28pt;font-weight:700;color:#1c1917;text-align:right;letter-spacing:-1pt}
  .inv-meta{font-size:9pt;color:#78716c;text-align:right;margin-top:2pt}
  .divider{border:none;border-top:2pt solid #e7e5e4;margin:14pt 0}
  .section-label{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5pt;color:#a8a29e;margin:14pt 0 6pt 0}
  .bill-name{font-size:14pt;font-weight:700;color:#1c1917}
  .bill-detail{font-size:10pt;color:#78716c;margin-top:2pt}
  table.items{width:100%;border-collapse:collapse;margin-top:6pt}
  table.items th{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:0.8pt;color:#a8a29e;padding:7pt 8pt;border-bottom:2pt solid #e7e5e4;text-align:left}
  table.items th.r{text-align:right}
  table.items td{padding:8pt 8pt;border-bottom:1pt solid #f5f5f4;font-size:11pt;color:#1c1917}
  table.items td.r{text-align:right}
  table.items tr.total-row td{font-weight:700;font-size:13pt;border-bottom:none;border-top:2pt solid #1c1917;padding-top:10pt}
  .summary-box{background:#f9f7f5;border:1pt solid #e7e5e4;border-radius:6pt;padding:12pt 16pt;margin-top:16pt}
  .summary-label{font-size:9pt;color:#78716c;text-transform:uppercase;letter-spacing:0.5pt}
  .summary-value{font-size:15pt;font-weight:700;color:#1c1917;margin-top:2pt}
  .paid-val{color:#059669}
  .due-val{color:#dc2626}
  .footer{margin-top:36pt;text-align:center;font-size:8.5pt;color:#a8a29e;border-top:1pt solid #e7e5e4;padding-top:14pt}
</style></head><body>
<table class="header-table"><tr>
  <td style="vertical-align:top;width:55%">
    <div class="brand">🫓 ${co}</div>
    <div class="brand-sub">${cosub}</div>
    ${coPhone?`<div class="brand-sub">📞 ${coPhone}</div>`:""}
    ${gst?`<div class="brand-sub">GST: ${gst}</div>`:""}
  </td>
  <td style="vertical-align:top;width:45%">
    <div class="inv-title">INVOICE</div>
    <div class="inv-meta">${invoiceNo}</div>
    <div class="inv-meta">Date: ${record.date||today()}</div>
    ${record.deliveryDate?`<div class="inv-meta">Deliver by: ${record.deliveryDate}</div>`:""}
    <div class="inv-meta">Ref: #${(record.id||"").slice(-8)}</div>
  </td>
</tr></table>
<hr class="divider"/>
<div class="section-label">Bill To</div>
<div class="bill-name">${name}</div>
${record.phone?`<div class="bill-detail">📞 ${record.phone}</div>`:""}
${record.address?`<div class="bill-detail">📍 ${record.address}</div>`:""}
${record.joinDate?`<div class="bill-detail">Customer since: ${record.joinDate}</div>`:""}
${record.status?`<div class="bill-detail" style="margin-top:6pt"><b>Status:</b> ${record.status}</div>`:""}
<div class="section-label" style="margin-top:18pt">Items</div>
<table class="items">
  <tr><th>Product</th><th>Unit</th><th class="r">Qty</th><th class="r">Unit Price</th><th class="r">Amount</th></tr>
  ${rows.map(r=>`<tr><td><b>${r.name}</b></td><td>${r.unit}</td><td class="r">${r.qty}</td><td class="r">${inr(r.priceAmount)}</td><td class="r">${inr(r.qty*r.priceAmount)}</td></tr>`).join("")}
  <tr class="total-row"><td colspan="4"><b>Total</b></td><td class="r"><b>${inr(total)}</b></td></tr>
</table>
${type==="customer"?`
<div class="section-label" style="margin-top:18pt">Payment Summary</div>
<div class="summary-box">
  <table style="width:100%;border-collapse:collapse">
    <tr>
      <td style="width:33%;text-align:center">
        <div class="summary-label">Paid</div>
        <div class="summary-value paid-val">${inr(record.paid||0)}</div>
      </td>
      <td style="width:33%;text-align:center;border-left:1pt solid #e7e5e4">
        <div class="summary-label">Outstanding</div>
        <div class="summary-value ${(record.pending||0)>0?"due-val":"paid-val"}">${inr(record.pending||0)}</div>
      </td>
      <td style="width:33%;text-align:center;border-left:1pt solid #e7e5e4">
        <div class="summary-label">Status</div>
        <div class="summary-value ${(record.pending||0)>0?"due-val":"paid-val"}">${(record.pending||0)>0?"UNPAID":"✓ PAID"}</div>
      </td>
    </tr>
  </table>
</div>`:``}
<div class="footer">Thank you for your business · ${co} · ${new Date().toLocaleString("en-IN")}</div>
</body></html>`;
  const blob2=new Blob(["\ufeff"+html],{type:"application/msword"});
  const a2=document.createElement("a"); a2.href=URL.createObjectURL(blob2); a2.download=`invoice_${name.replace(/\s+/g,"_")}_${today()}.doc`;
  document.body.appendChild(a2); a2.click(); setTimeout(()=>{document.body.removeChild(a2);URL.revokeObjectURL(a2.href);},1000);
}

// ─── HIGH-QUALITY TAB EXPORT — PDF ──────────────────────────────────────────
function exportTabPDF(tabName, data, columns, settings, extraHtml, options) {
  extraHtml = extraHtml || "";
  options   = options   || {};
  const co      = settings?.companyName||"TAS Healthy World";
  const cosub   = settings?.companySubtitle||"";
  const gst     = settings?.companyGST||"";
  const coPhone = settings?.companyPhone||"";
  const coLogo  = settings?.companyLogo||"";
  const appEmoji= settings?.appEmoji||"🫓";
  const now = new Date().toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
  const dateStr = today();

  // ── Compute summary stats ──
  const getVal = (row,c)=>typeof c.val==="function"?c.val(row):(row[c.key]??(""));
  const toNum  = v=>{ const n=Number(String(v==null?"":v).replace(/[₹,<>a-zA-Z\s]/g,"")); return isNaN(n)?0:n; };
  const sumCol = (col)=>data.reduce((s,r)=>s+toNum(getVal(r,col)),0);
  const labelMatch = (c, ...terms) => { const l=String(c.label||c.key||"").toLowerCase().replace(/[₹()#\s]/g,""); return terms.some(t=>l.includes(t.toLowerCase().replace(/[₹()#\s]/g,""))); };
  const paidCol   = columns.find(c=>c.key==="paid"||labelMatch(c,"paid₹","paid(₹)","totalcollected"));
  const pendCol   = columns.find(c=>c.key==="pending"||labelMatch(c,"pending₹","pending(₹)","outstanding"));
  const revCol    = columns.find(c=>c.key==="_revenue"||c.key==="revenue"||labelMatch(c,"revenue₹","revenue(₹)"));
  const ordersCol = columns.find(c=>c.key==="_orders"||labelMatch(c,"#orders","orders") && !labelMatch(c,"avg","net","partial"));
  const replCol   = columns.find(c=>c.key==="_replAmt"||labelMatch(c,"repldeducted","repl.deducted"));
  const totalPaid    = paidCol   ? sumCol(paidCol)   : null;
  const totalPending = pendCol   ? sumCol(pendCol)   : null;
  const totalRev     = revCol    ? sumCol(revCol)    : null;
  const totalOrders  = ordersCol ? sumCol(ordersCol) : null;
  const totalRepl    = replCol   ? sumCol(replCol)   : null;
  const collRate = (totalPaid!=null&&totalPending!=null&&(totalPaid+totalPending)>0)?Math.round(totalPaid/(totalPaid+totalPending)*100):null;
  const activeCount  = data.filter(r=>r.active===true||r.active==="Yes").length;
  const unpaidCount  = data.filter(r=>toNum(pendCol?getVal(r,pendCol):0)>0).length;
  const inrF = v=>v==null?"—":"₹"+Number(v).toLocaleString("en-IN",{minimumFractionDigits:0,maximumFractionDigits:2});

  // ── Auto stat cards (only non-null ones) ──
  const statCards=[
    {label:"Total Records",value:data.length,color:"#3b82f6"},
    {label:"Active",value:activeCount,color:"#10b981"},
    ...(totalOrders!=null?[{label:"Total Orders",value:totalOrders,color:"#6366f1"}]:[]),
    ...(totalRev!=null?[{label:"Total Revenue",value:inrF(totalRev),color:"#f59e0b"}]:[]),
    ...(totalPaid!=null?[{label:"Collected",value:inrF(totalPaid),color:"#10b981"}]:[]),
    ...(totalPending!=null&&totalPending>0?[{label:"Outstanding",value:inrF(totalPending),color:"#ef4444"}]:[]),
    ...(collRate!=null?[{label:"Collection Rate",value:collRate+"%",color:collRate>=90?"#10b981":collRate>=70?"#f59e0b":"#ef4444"}]:[]),
    ...(unpaidCount>0?[{label:"Unpaid Customers",value:unpaidCount,color:"#ef4444"}]:[]),
    ...(totalRepl!=null&&totalRepl>0?[{label:"Replacements Deducted",value:inrF(totalRepl),color:"#f97316"}]:[]),
  ];

  // ── Table rows with smart formatting ──
  const tableRows=data.map((row,ri)=>{
    const cells=columns.map(c=>{
      const v=String(getVal(row,c)==null?"":getVal(row,c));
      // Already-formatted HTML (badges etc.) — pass through
      if(v.startsWith("<")) return `<td>${v}</td>`;
      // Status
      const vu=v.toUpperCase();
      if(vu==="PAID")   return `<td><span class="badge badge-g">PAID</span></td>`;
      if(vu==="UNPAID") return `<td><span class="badge badge-r">UNPAID</span></td>`;
      if(vu==="DELIVERED") return `<td><span class="badge badge-g">Delivered</span></td>`;
      if(vu==="CANCELLED") return `<td><span class="badge badge-r">Cancelled</span></td>`;
      if(vu==="IN TRANSIT") return `<td><span class="badge badge-b">In Transit</span></td>`;
      if(vu==="YES"||vu==="ACTIVE") return `<td><span class="badge badge-g">Active</span></td>`;
      if(vu==="NO"||vu==="INACTIVE") return `<td><span class="badge" style="background:#f1f5f9;color:#64748b">Inactive</span></td>`;
      return `<td class="${c.cls||""}">${v}</td>`;
    }).join("");
    return `<tr class="${ri%2===0?"":"alt"}">${cells}</tr>`;
  }).join("");

  // ── Totals footer row ──
  const totalsFooter=`<tr class="totals-row">${columns.map((c,ci)=>{
    const t=sumCol(c);
    if(c.num!==false&&t!==0) return `<td class="r"><strong>${inrF(t)}</strong></td>`;
    return `<td>${ci===0?`<strong>TOTAL — ${data.length} records</strong>`:"—"}</td>`;
  }).join("")}</tr>`;

  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${tabName} Report — ${co}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',Arial,sans-serif;color:#0f172a;background:#f8fafc;padding:0}

/* ── Cover ── */
.cover{background:linear-gradient(135deg,#0f1923 0%,#1e3a5f 60%,#0a2240 100%);color:#fff;padding:44px 52px 40px;position:relative;overflow:hidden;page-break-after:avoid}
.cover::before{content:'${tabName.charAt(0)}';position:absolute;right:-10px;top:-20px;font-size:220px;font-weight:900;opacity:0.04;color:#fff;line-height:1;pointer-events:none}
.cover::after{content:'';position:absolute;bottom:-80px;right:80px;width:260px;height:260px;border-radius:50%;background:rgba(59,130,246,0.08);pointer-events:none}
.cover-top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.brand{display:flex;flex-direction:column;gap:4px}
.brand-name{font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;opacity:0.55}
.brand-sub{font-size:11px;opacity:0.38;margin-top:1px}
.cover-meta{text-align:right;opacity:0.4;font-size:10px;line-height:1.8}
.report-badge{display:inline-block;background:rgba(59,130,246,0.25);border:1px solid rgba(59,130,246,0.4);border-radius:6px;padding:3px 10px;font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:12px;margin-top:20px}
.report-title{font-size:38px;font-weight:900;letter-spacing:-0.03em;line-height:1.1;margin-bottom:4px}
.report-date{font-size:12px;opacity:0.4;margin-top:10px}

/* ── Stat cards ── */
.content{padding:36px 48px;background:#fff;min-height:100vh}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px;margin-bottom:32px}
.stat-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:16px 18px;position:relative;overflow:hidden}
.stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--accent)}
.stat-val{font-size:20px;font-weight:900;color:#0f172a;line-height:1.1;margin-bottom:4px;margin-top:2px}
.stat-lbl{font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8}

/* ── Table ── */
.section-title{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;color:#94a3b8;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #f1f5f9}
table{width:100%;border-collapse:collapse;font-size:12px}
thead tr{background:#f1f5f9;border-bottom:2px solid #e2e8f0}
th{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#64748b;padding:10px 13px;text-align:left;white-space:nowrap}
td{padding:9px 13px;border-bottom:1px solid #f1f5f9;color:#1e293b;vertical-align:middle;font-size:12px}
tr.alt td{background:#fafcff}
tr:hover td{background:#f0f9ff}
tr.totals-row td{background:#dbeafe;font-size:12px;border-top:2px solid #1e3a5f;border-bottom:none}
.r{text-align:right}
.c{text-align:center}
.green{color:#059669;font-weight:700}
.red{color:#dc2626;font-weight:700}
.amber{color:#d97706;font-weight:700}
.badge{display:inline-block;padding:2px 9px;border-radius:20px;font-size:9px;font-weight:700;letter-spacing:0.03em}
.badge-g{background:#dcfce7;color:#15803d}
.badge-r{background:#fee2e2;color:#b91c1c}
.badge-y{background:#fef9c3;color:#92400e}
.badge-b{background:#dbeafe;color:#1e40af}

/* ── Footer ── */
.footer{padding:20px 48px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94a3b8;margin-top:32px;background:#fff}
.confidential{background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;border-radius:4px;padding:1px 7px;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em}

/* ── Print bar ── */
.print-bar{position:fixed;top:0;left:0;right:0;background:#0f1923;color:#fff;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;z-index:9999;font-family:Inter,Arial,sans-serif;font-size:13px;box-shadow:0 2px 12px rgba(0,0,0,0.5);gap:12px}
.print-bar a{padding:7px 18px;border-radius:8px;text-decoration:none;font-weight:700;font-size:12px;white-space:nowrap;transition:opacity 0.15s}
.print-bar a:hover{opacity:0.85}

@media print{
  @page{size:A4 landscape;margin:12mm 10mm}
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#fff}
  .cover{padding:24px 32px}
  .content{padding:20px 32px}
  .print-bar{display:none!important}
  .footer{padding:14px 32px}
  .report-title{font-size:28px}
  tr:hover td{background:inherit}
}
</style></head><body>

<div class="print-bar no-print">
  <span style="font-weight:700">📊 ${tabName} Report — ${co}</span>
  <div style="display:flex;gap:8px">
    <a href="#" onclick="window.print();return false;" style="background:#3b82f6;color:#fff">🖨 Print / Save PDF</a>
    <a href="#" onclick="var b=document.documentElement.outerHTML;var bl=new Blob([b],{type:'text/html'});var u=URL.createObjectURL(bl);var a=document.createElement('a');a.href=u;a.download='${tabName.replace(/\s+/g,'_')}_${dateStr}.html';document.body.appendChild(a);a.click();URL.revokeObjectURL(u);return false;" style="background:#059669;color:#fff">⬇ Download</a>
  </div>
</div>

<div class="cover">
  <div class="cover-top">
    <div class="brand">
      ${coLogo?`<img src="${coLogo}" alt="logo" style="max-height:44px;max-width:120px;object-fit:contain;margin-bottom:8px;background:rgba(255,255,255,0.1);border-radius:6px;padding:4px"/>`:``}
      <div class="brand-name">${coLogo?"":appEmoji+" "}${co}</div>
      ${cosub?`<div class="brand-sub">${cosub}</div>`:""}
      ${gst?`<div class="brand-sub">GST: ${gst}</div>`:""}
      ${coPhone?`<div class="brand-sub">📞 ${coPhone}</div>`:""}
    </div>
    <div class="cover-meta">
      <div>Exported: ${now}</div>
      <div>${data.length} records</div>
      <div style="margin-top:4px;opacity:0.6">CONFIDENTIAL</div>
    </div>
  </div>
  <div class="report-badge">Report</div>
  <div class="report-title">${tabName}</div>
  <div class="report-date">${dateStr}</div>
</div>

<div class="content">
  ${statCards.length>0?`
  <div class="stat-grid">
    ${statCards.map(s=>`<div class="stat-card" style="--accent:${s.color}">
      <div class="stat-lbl">${s.label}</div>
      <div class="stat-val" style="color:${s.color}">${s.value}</div>
    </div>`).join("")}
  </div>`:""}

  ${extraHtml}

  <div class="section-title">${options.mainTableTitle||tabName+" Data — "+data.length+" records"}</div>
  <table>
    <thead><tr>${columns.map(c=>`<th class="${c.cls||""}">${c.label}</th>`).join("")}</tr></thead>
    <tbody>${tableRows}${totalsFooter}</tbody>
  </table>
</div>

<div class="footer">
  <div style="display:flex;align-items:center;gap:10px">
    <span>${co}${gst?` &nbsp;·&nbsp; GST: ${gst}`:""}${coPhone?` &nbsp;·&nbsp; ${coPhone}`:""}</span>
    <span class="confidential">Confidential</span>
  </div>
  <span>${tabName} Report &nbsp;·&nbsp; ${dateStr}</span>
</div>
</body></html>`;

  const blob=new Blob([html],{type:"text/html;charset=utf-8"});
  const burl=URL.createObjectURL(blob);
  const a2=document.createElement("a");
  a2.href=burl;a2.target="_blank";a2.rel="noopener";
  document.body.appendChild(a2);a2.click();
  setTimeout(()=>{document.body.removeChild(a2);URL.revokeObjectURL(burl);},1000);
}

// ─── P&L FULL REPORT EXPORT ──────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
function exportPnLReport({co,periodLabel,mData,totRev,totSupC,totExpC,totWasteC,totCost,totProfit,totMargin,totReplDeducted,collectionRate,totDue,totCollected,avgMonthlyRev,avgMonthlyProfit,burnRate,healthScore,healthLabel,healthColor,insights,filtD,filtS,filtE,filtW,customers,deliveries,expenses,supplies,wastage,products,lineTotal,inr,today_fn,settings}){
  const now=new Date().toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
  const pct=(a,b)=>b>0?Math.round(a/b*100):0;
  const expCatBreak=(settings?.expenseCategories||["Gas","Labour","Transport","Packaging","Utilities","Maintenance","Other"]).map(cat=>({cat,total:filtE.filter(e=>e.category===cat).reduce((s,e)=>s+(e.amount||0),0),count:filtE.filter(e=>e.category===cat).length})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
  const supCatBreak=(()=>{const m={};filtS.forEach(s=>{const c=s.category||s.item||"Other";m[c]=(m[c]||0)+(s.cost||0);});return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,10);})();
  const vendorBreak=(()=>{const m={};filtE.forEach(e=>{if(e.vendor)m[e.vendor]=(m[e.vendor]||0)+(e.amount||0);});return Object.entries(m).sort((a,b)=>b[1]-a[1]);})();
  const pmBreak=(()=>{const m={};filtE.forEach(e=>{const p=e.paymentMethod||"Cash";m[p]=(m[p]||0)+(e.amount||0);});return Object.entries(m);})();
  const wasteByProd=(()=>{const m={};filtW.forEach(w=>{if(!m[w.product])m[w.product]={qty:0,cost:0};m[w.product].qty+=(w.qty||0);m[w.product].cost+=(w.cost||0);});return Object.entries(m).sort((a,b)=>b[1].cost-a[1].cost);})();
  const custRows=[...customers].map(c=>{const cd=deliveries.filter(d=>d.customerId===c.id&&d.status==="Delivered");const rev=cd.reduce((s,d)=>s+lineTotal(d.orderLines),0);const repl=cd.reduce((s,d)=>s+(+d.replacement?.amount||0),0);return{name:c.name,orders:deliveries.filter(d=>d.customerId===c.id).length,delivered:cd.length,revenue:Math.max(0,rev-repl),collected:c.paid||0,pending:c.pending||0,avgOrder:cd.length>0?Math.round((rev-repl)/cd.length):0};}).sort((a,b)=>b.revenue-a.revenue);
  const topProd=(()=>{return products.map(p=>{const qty=filtD.reduce((s,d)=>s+(d.orderLines?.[p.id]?.qty||0),0);const rev=filtD.reduce((s,d)=>s+(d.orderLines?.[p.id]?.qty||0)*(d.orderLines?.[p.id]?.priceAmount||0),0);return{name:p.name||p.id,qty,rev};}).filter(x=>x.qty>0).sort((a,b)=>b.rev-a.rev);})();
  const statCard=(label,val,color="#0f172a")=>`<div class="sc"><div class="sv" style="color:${color}">${val}</div><div class="sl">${label}</div></div>`;
  const barRow=(label,val,pct2,color,sub="")=>`<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px"><span style="font-weight:600;font-size:12px">${label}</span><div style="text-align:right"><span style="font-weight:800;color:${color};font-size:13px">${val}</span>${sub?`<span style="color:#94a3b8;font-size:10px;margin-left:6px">${sub}</span>`:""}</div></div><div style="height:5px;background:#e2e8f0;border-radius:5px;overflow:hidden"><div style="width:${Math.min(pct2,100)}%;height:100%;background:${color};border-radius:5px"></div></div></div>`;
  const section=(title,content)=>`<div class="sect"><div class="sh">${title}</div>${content}</div>`;
  const tableHtml=(headers,rows2)=>`<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows2}</tbody></table>`;
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>P&L Report — ${co}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;background:#fff;font-size:13px}
.cover{background:linear-gradient(135deg,#0f1923 0%,#1a3a5f 60%,#0a2a1a 100%);color:#fff;padding:44px 52px 40px;position:relative;overflow:hidden}
.cover::before{content:'P&L';position:absolute;right:-20px;top:-40px;font-size:200px;font-weight:900;opacity:0.04;letter-spacing:-10px;color:#fff}
.co{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.5;margin-bottom:12px}
.title{font-size:38px;font-weight:900;letter-spacing:-.03em;line-height:1.1;margin-bottom:8px}
.meta{font-size:11px;opacity:.45;margin-top:8px}
.hero{display:flex;gap:14px;margin-top:22px;flex-wrap:wrap}
.hk{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:14px 18px;min-width:140px}
.hkv{font-size:24px;font-weight:900;line-height:1}
.hkl{font-size:9px;text-transform:uppercase;letter-spacing:.08em;opacity:.5;margin-top:4px}
.content{padding:36px 52px}
.sect{margin-bottom:32px}
.sh{font-size:9px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;color:#94a3b8;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #f1f5f9}
.stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:24px}
.sc{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px}
.sv{font-size:20px;font-weight:900;line-height:1}
.sl{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-top:5px}
table{width:100%;border-collapse:collapse;font-size:11.5px;margin-top:8px}
thead tr{background:#f1f5f9}
th{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:#64748b;padding:9px 12px;text-align:left;border-bottom:2px solid #e2e8f0;white-space:nowrap}
td{padding:9px 12px;border-bottom:1px solid #f1f5f9;color:#1e293b;vertical-align:top}
tr:last-child td{border-bottom:none}
tbody tr:nth-child(even) td{background:#f8fafc}
.r{text-align:right}.c{text-align:center}
.g{color:#059669;font-weight:700}.r2{color:#dc2626;font-weight:700}.a{color:#d97706;font-weight:700}.p{color:#7c3aed;font-weight:700}
.badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:9px;font-weight:800}
.bg{background:#dcfce7;color:#15803d}.br{background:#fee2e2;color:#b91c1c}.by{background:#fef9c3;color:#92400e}.bb{background:#dbeafe;color:#1e40af}
.insight{display:flex;gap:10px;padding:10px 14px;background:#f8fafc;border-left:3px solid #3b82f6;border-radius:0 10px 10px 0;margin-bottom:8px}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:18px 20px}
.footer{padding:20px 52px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94a3b8;margin-top:40px}
.no-print{position:fixed;top:0;left:0;right:0;background:#0f1923;color:#fff;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;z-index:9999;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,.4);gap:12px}
@media print{@page{size:A4;margin:16mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none!important}.cover{padding:32px 40px}.content{padding:24px 40px}}
</style></head><body>
<div class="no-print"><span style="font-weight:700">📈 P&L Report — ${co} · ${periodLabel}</span><div style="display:flex;gap:8px"><a href="#" onclick="window.print();return false;" style="background:#3b82f6;color:#fff;padding:7px 16px;border-radius:8px;text-decoration:none;font-weight:700;font-size:12px">🖨 Print / Save PDF</a><a href="#" onclick="var b=document.documentElement.outerHTML;var bl=new Blob([b],{type:'text/html'});var u=URL.createObjectURL(bl);var a=document.createElement('a');a.href=u;a.download='PnL_${today_fn().replace(/-/g,'')}.html';document.body.appendChild(a);a.click();URL.revokeObjectURL(u);return false;" style="background:#059669;color:#fff;padding:7px 16px;border-radius:8px;text-decoration:none;font-weight:700;font-size:12px">⬇ Download</a></div></div>
<div class="cover">
  <div class="co">🫓 ${co}</div>
  <div class="title">Profit &amp; Loss<br>Report</div>
  <div class="meta">Period: ${periodLabel} &nbsp;·&nbsp; Exported ${now}</div>
  <div class="hero">
    <div class="hk"><div class="hkv" style="color:#10b981">${inr(totRev)}</div><div class="hkl">Net Revenue</div></div>
    <div class="hk"><div class="hkv" style="color:#ef4444">${inr(totCost)}</div><div class="hkl">Total Costs</div></div>
    <div class="hk"><div class="hkv" style="color:${totProfit>=0?"#10b981":"#ef4444"}">${inr(totProfit)}</div><div class="hkl">Net Profit / Loss</div></div>
    <div class="hk"><div class="hkv" style="color:${healthColor}">${healthScore}/100</div><div class="hkl">Health Score · ${healthLabel}</div></div>
    <div class="hk"><div class="hkv">${totMargin}%</div><div class="hkl">Net Margin</div></div>
    <div class="hk"><div class="hkv">${collectionRate}%</div><div class="hkl">Collection Rate</div></div>
  </div>
</div>
<div class="content">

${section("Executive Summary",`
<div class="stats">
  ${statCard("Total Revenue",inr(totRev),"#059669")}
  ${statCard("Supply Costs",inr(totSupC),"#7c3aed")}
  ${statCard("Operating Expenses",inr(totExpC),"#dc2626")}
  ${statCard("Wastage Losses",inr(totWasteC),"#ea580c")}
  ${statCard("Total Costs",inr(totCost),"#dc2626")}
  ${statCard("Net Profit",inr(totProfit),totProfit>=0?"#059669":"#dc2626")}
  ${statCard("Net Margin",totMargin+"%",totMargin>=30?"#059669":totMargin>=15?"#d97706":"#dc2626")}
  ${statCard("Replacement Deductions",inr(totReplDeducted),"#94a3b8")}
  ${statCard("Cash Collected",inr(totCollected),"#059669")}
  ${statCard("Cash Pending",inr(totDue),totDue>0?"#dc2626":"#059669")}
  ${statCard("Avg Monthly Revenue",inr(avgMonthlyRev),"#0ea5e9")}
  ${statCard("Avg Monthly Profit",inr(avgMonthlyProfit),avgMonthlyProfit>=0?"#059669":"#dc2626")}
  ${statCard("Avg Monthly Burn",inr(burnRate),"#f97316")}
</div>`)}

${insights.length>0?section("Smart Insights",insights.map(i=>`<div class="insight"><span style="font-size:16px">${i.icon}</span><p style="font-size:12px;line-height:1.6">${i.text}</p></div>`).join("")):""}

${section("Revenue Breakdown",`
<div class="two-col">
  <div class="card">
    <div class="sh" style="margin-bottom:10px">By Month</div>
    ${mData.map(m=>barRow(m.monthFull,inr(m.revenue),pct(m.revenue,Math.max(...mData.map(x=>x.revenue),1)),"#059669",`${m.deliveriesCount} deliveries`)).join("")}
  </div>
  <div class="card">
    <div class="sh" style="margin-bottom:10px">Top Customers</div>
    ${custRows.slice(0,8).map((c,i)=>barRow(`${i+1}. ${c.name}`,inr(c.revenue),pct(c.revenue,custRows[0]?.revenue||1),"#f59e0b",`${c.delivered} orders · ${Math.round(pct(c.revenue,custRows.reduce((s,x)=>s+x.revenue,0)))}% share`)).join("")}
  </div>
</div>`)}

${section("Cost Structure",`
<div class="two-col">
  <div class="card">
    <div class="sh" style="margin-bottom:10px">Supply Costs — By Item / Category</div>
    ${supCatBreak.map(([cat,v])=>barRow(cat,inr(v),pct(v,totSupC),"#7c3aed")).join("")||"<p style='color:#94a3b8;font-size:12px'>No supplies in period</p>"}
  </div>
  <div class="card">
    <div class="sh" style="margin-bottom:10px">Operating Expenses — By Category</div>
    ${expCatBreak.map(c=>barRow(c.cat,inr(c.total),pct(c.total,totExpC),"#dc2626",`${c.count} entries`)).join("")||"<p style='color:#94a3b8;font-size:12px'>No expenses in period</p>"}
  </div>
</div>
${vendorBreak.length>0?`<div class="two-col" style="margin-top:16px">
  <div class="card">
    <div class="sh" style="margin-bottom:10px">Expenses by Vendor</div>
    ${vendorBreak.map(([vendor,v])=>barRow(vendor,inr(v),pct(v,totExpC),"#ef4444")).join("")}
  </div>
  <div class="card">
    <div class="sh" style="margin-bottom:10px">Expenses by Payment Method</div>
    ${pmBreak.map(([pm,v])=>barRow(pm,inr(v),pct(v,totExpC),"#8b5cf6")).join("")}
  </div>
</div>`:""}
${wasteByProd.length>0?`<div class="card" style="margin-top:16px">
  <div class="sh" style="margin-bottom:10px">Wastage by Product</div>
  ${tableHtml(["Product","Qty Wasted","Cost"],wasteByProd.map(([p,d])=>`<tr><td>${p}</td><td>${d.qty} units</td><td class="r2">${inr(d.cost)}</td></tr>`).join(""))}
</div>`:""}`)}

${section("Monthly P&L Breakdown",tableHtml(
  ["Month","Deliveries","Revenue","Supply","Expenses","Waste","Replacements","Total Cost","Profit / Loss","Margin","Gross Margin"],
  mData.map(m=>`<tr>
    <td style="font-weight:700">${m.monthFull}</td>
    <td class="c">${m.deliveriesCount}</td>
    <td class="g">${inr(m.revenue)}</td>
    <td class="p">${inr(m.supplyCost)}</td>
    <td class="r2">${inr(m.expenses)}</td>
    <td style="color:#ea580c;font-weight:600">${inr(m.wasteCost)}</td>
    <td style="color:#94a3b8">${inr(m.replDeducted||0)}</td>
    <td class="r2">${inr(m.totalCost)}</td>
    <td class="${m.profit>=0?"g":"r2"}">${inr(m.profit)}</td>
    <td class="c"><span class="badge ${m.margin>=30?"bg":m.margin>=15?"by":"br"}">${m.margin}%</span></td>
    <td class="c"><span class="badge bb">${m.grossMargin||0}%</span></td>
  </tr>`).join("")+`
  <tr style="background:#f1f5f9;font-weight:900;border-top:2px solid #e2e8f0">
    <td>TOTAL</td><td class="c">${filtD.length}</td>
    <td class="g">${inr(totRev)}</td><td class="p">${inr(totSupC)}</td>
    <td class="r2">${inr(totExpC)}</td><td style="color:#ea580c;font-weight:700">${inr(totWasteC)}</td>
    <td style="color:#94a3b8">${inr(totReplDeducted)}</td>
    <td class="r2">${inr(totCost)}</td>
    <td class="${totProfit>=0?"g":"r2"}">${inr(totProfit)}</td>
    <td class="c"><span class="badge ${totMargin>=30?"bg":totMargin>=15?"by":"br"}">${totMargin}%</span></td>
    <td></td>
  </tr>`))}

${section("Customer Revenue & Collection", tableHtml(
  ["#","Customer","Orders","Delivered","Revenue","Collected","Pending","Avg Order","Coll. Rate"],
  custRows.map((c,i)=>`<tr>
    <td class="c" style="color:#94a3b8;font-weight:700">${i+1}</td>
    <td style="font-weight:600">${c.name}</td>
    <td class="c">${c.orders}</td><td class="c">${c.delivered}</td>
    <td class="g">${inr(c.revenue)}</td>
    <td class="g">${inr(c.collected)}</td>
    <td class="${c.pending>0?"r2":"g"}">${inr(c.pending)}</td>
    <td>${inr(c.avgOrder)}</td>
    <td class="c"><span class="badge ${(c.collected+c.pending>0?Math.round(c.collected/(c.collected+c.pending)*100):100)>=90?"bg":(c.collected+c.pending>0?Math.round(c.collected/(c.collected+c.pending)*100):100)>=60?"by":"br"}">${c.collected+c.pending>0?Math.round(c.collected/(c.collected+c.pending)*100):100}%</span></td>
  </tr>`).join("")))}

${topProd.length>0?section("Product Sales (Period)", tableHtml(
  ["Product","Qty Sold","Revenue"],
  topProd.map(p=>`<tr><td style="font-weight:600">${p.name}</td><td class="c">${p.qty}</td><td class="g">${inr(p.rev)}</td></tr>`).join(""))):""}

${filtE.length>0?section("Expense Paper Trail — All Entries", tableHtml(
  ["Date","Category","Amount","Vendor","Payment","Approved By","Receipt","Tags","Notes"],
  [...filtE].sort((a,b)=>(a.date||"").localeCompare(b.date||"")).map(e=>`<tr>
    <td style="white-space:nowrap">${e.date}</td>
    <td><span class="badge br">${e.category}</span></td>
    <td class="r2">${inr(e.amount)}</td>
    <td>${e.vendor||"—"}</td>
    <td>${e.paymentMethod||"Cash"}</td>
    <td>${e.approvedBy||"—"}</td>
    <td>${e.receipt||"—"}</td>
    <td>${e.tags||"—"}</td>
    <td style="color:#64748b">${e.notes||"—"}</td>
  </tr>`).join(""))):""}

${filtS.length>0?section("Supply Paper Trail — All Entries", tableHtml(
  ["Date","Item","Category","Qty","Unit","Cost","Supplier","Notes"],
  [...filtS].sort((a,b)=>(a.date||"").localeCompare(b.date||"")).map(s=>`<tr>
    <td style="white-space:nowrap">${s.date}</td>
    <td style="font-weight:600">${s.item||"—"}</td>
    <td>${s.category||"—"}</td>
    <td class="c">${s.qty||"—"}</td>
    <td>${s.unit||"—"}</td>
    <td class="p">${inr(s.cost)}</td>
    <td>${s.supplier||"—"}</td>
    <td style="color:#64748b">${s.notes||"—"}</td>
  </tr>`).join(""))):""}

</div>
<div class="footer"><span>${co} &mdash; Confidential. P&L Report.</span><span>Generated ${now} &nbsp;·&nbsp; Period: ${periodLabel}</span></div>
</body></html>`;
  const blob=new Blob([html],{type:"text/html;charset=utf-8"});
  const burl=URL.createObjectURL(blob);
  const a2=document.createElement("a");
  a2.href=burl;a2.target="_blank";a2.rel="noopener";
  document.body.appendChild(a2);a2.click();
  setTimeout(()=>{document.body.removeChild(a2);URL.revokeObjectURL(burl);},1000);
}

// eslint-disable-next-line no-unused-vars
function exportPnLCSV({mData,filtD,filtE,filtS,filtW,customers,deliveries,expenses,supplies,wastage,products,lineTotal,today_fn,periodLabel}){
  const rows=[];
  const esc=v=>typeof v==="string"&&(v.includes(",")||v.includes('"')||v.includes("\n"))?`"${v.replace(/"/g,'""')}"`:(v??"-");
  const row=arr=>arr.map(esc).join(",");
  // Section: Monthly Summary
  rows.push(row(["=== MONTHLY P&L SUMMARY ===","Period: "+periodLabel]));
  rows.push(row(["Month","Deliveries","Revenue","Supply Cost","Op Expenses","Waste Cost","Replacements","Total Cost","Profit/Loss","Net Margin %","Gross Margin %"]));
  mData.forEach(m=>rows.push(row([m.monthFull,m.deliveriesCount,m.revenue,m.supplyCost,m.expenses,m.wasteCost,m.replDeducted||0,m.totalCost,m.profit,m.margin,m.grossMargin||0])));
  const totRevC=mData.reduce((s,m)=>s+m.revenue,0);
  const totSupCC=mData.reduce((s,m)=>s+m.supplyCost,0);
  const totExpCC=mData.reduce((s,m)=>s+m.expenses,0);
  const totWasteCC=mData.reduce((s,m)=>s+m.wasteCost,0);
  const totReplC=mData.reduce((s,m)=>s+(m.replDeducted||0),0);
  const totCostC=mData.reduce((s,m)=>s+m.totalCost,0);
  const totProfC=mData.reduce((s,m)=>s+m.profit,0);
  const totMarC=totRevC>0?Math.round(totProfC/totRevC*100):0;
  rows.push(row(["TOTAL",filtD.length,totRevC,totSupCC,totExpCC,totWasteCC,totReplC,totCostC,totProfC,totMarC,""]));
  rows.push([""]);
  // Section: Customer Revenue
  rows.push(row(["=== CUSTOMER REVENUE & COLLECTION ==="]));
  rows.push(row(["Customer","Total Orders","Delivered","Revenue","Collected","Pending","Avg Order Value","Collection Rate %"]));
  [...customers].map(c=>{const cd=deliveries.filter(d=>d.customerId===c.id&&d.status==="Delivered");const rev=cd.reduce((s,d)=>s+lineTotal(d.orderLines)-(+d.replacement?.amount||0),0);return{name:c.name,orders:deliveries.filter(d=>d.customerId===c.id).length,delivered:cd.length,revenue:Math.max(0,rev),collected:c.paid||0,pending:c.pending||0,avg:cd.length>0?Math.round(Math.max(0,rev)/cd.length):0,rate:c.paid+c.pending>0?Math.round(c.paid/(c.paid+c.pending)*100):100};}).sort((a,b)=>b.revenue-a.revenue).forEach(c=>rows.push(row([c.name,c.orders,c.delivered,c.revenue,c.collected,c.pending,c.avg,c.rate+"%"])));
  rows.push([""]);
  // Section: Delivery paper trail
  rows.push(row(["=== DELIVERY PAPER TRAIL ==="]));
  rows.push(row(["Invoice No","Receipt No","Date","Customer","Status","Order Total","Repl Amount","Net Amount","Collected","Balance Due","Replacement Item","Notes"]));
  [...filtD].sort((a,b)=>(a.date||"").localeCompare(b.date||"")).forEach(d=>{const inv=d.invNo||`INV-${(d.date||"").replace(/-/g,"")}-${(d.id||"").slice(-4).toUpperCase()}`;const rcp=`RCP-${inv.replace(/^[A-Z]+-/,"")}`;const tot=lineTotal(d.orderLines);const repl=+(d.replacement?.amount)||0;const net=Math.max(0,tot-repl);const coll=d.partialPayment?.enabled?(+(d.partialPayment?.amount)||0):0;const bal=Math.max(0,net-coll);rows.push(row([inv,rcp,d.date,d.customer,d.status,tot,repl,net,coll,bal,d.replacement?.done?(d.replacement.item||""):"",d.notes||""]));});
  rows.push([""]);
  // Section: Expenses paper trail
  rows.push(row(["=== EXPENSE PAPER TRAIL ==="]));
  rows.push(row(["Date","Category","Amount","Vendor","Payment Method","Approved By","Receipt","Tags","Notes","Created At"]));
  [...filtE].sort((a,b)=>(a.date||"").localeCompare(b.date||"")).forEach(e=>rows.push(row([e.date,e.category,e.amount,e.vendor||"",e.paymentMethod||"Cash",e.approvedBy||"",e.receipt||"",e.tags||"",e.notes||"",e.createdAt||""])));
  rows.push([""]);
  // Section: Supply paper trail
  rows.push(row(["=== SUPPLY PAPER TRAIL ==="]));
  rows.push(row(["Date","Item","Category","Qty","Unit","Cost","Supplier","Notes"]));
  [...filtS].sort((a,b)=>(a.date||"").localeCompare(b.date||"")).forEach(s=>rows.push(row([s.date,s.item||"",s.category||"",s.qty||"",s.unit||"",s.cost||0,s.supplier||"",s.notes||""])));
  rows.push([""]);
  // Section: Wastage paper trail
  rows.push(row(["=== WASTAGE PAPER TRAIL ==="]));
  rows.push(row(["Date","Product","Qty","Unit","Type","Reason","Cost","Logged By"]));
  [...filtW].sort((a,b)=>(a.date||"").localeCompare(b.date||"")).forEach(w=>rows.push(row([w.date,w.product||"",w.qty||"",w.unit||"",w.type||"",w.reason||"",w.cost||0,w.loggedBy||""])));
  const csv=rows.map(r=>Array.isArray(r)?r.join(""):r).join("\n");
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
  const burl=URL.createObjectURL(blob);
  const a2=document.createElement("a");
  a2.href=burl;a2.download=`PnL_full_${today_fn().replace(/-/g,"")}.csv`;
  document.body.appendChild(a2);a2.click();
  setTimeout(()=>{document.body.removeChild(a2);URL.revokeObjectURL(burl);},1000);
}

// ─── HIGH-QUALITY TAB EXPORT — EXCEL (XLSX-compatible) ──────────────────────
function exportTabExcel(tabName, data, columns, settings) {
  const co       = settings?.companyName||"TAS Healthy World";
  const cosub    = settings?.companySubtitle||"";
  const gst      = settings?.companyGST||"";
  const coPhone  = settings?.companyPhone||"";
  const appEmoji = settings?.appEmoji||"🫓";
  const now = new Date().toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});

  const esc    = v=>String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const isNum  = v=>v!==null&&v!==undefined&&v!==""&&!isNaN(Number(String(v).replace(/[₹,]/g,"")));
  const numVal = v=>Number(String(v).replace(/[₹,]/g,""));
  const getVal = (row,c)=>typeof c.val==="function"?c.val(row):(row[c.key]??(""));
  const sumCol = (col)=>data.reduce((s,row)=>{ const v=String(getVal(row,col)==null?"":getVal(row,col)); return s+(isNum(v)?numVal(v):0); },0);

  // ── Computed summary stats ──
  const xlsLabelMatch = (c,...terms)=>{const l=String(c.label||c.key||"").toLowerCase().replace(/[₹()\s#]/g,"");return terms.some(t=>l.includes(t.toLowerCase().replace(/[₹()\s#]/g,"")));};
  const paidCol   = columns.find(c=>c.key==="paid"||xlsLabelMatch(c,"paid₹","paid(₹)","totalcollected","amountpaid"));
  const pendCol   = columns.find(c=>c.key==="pending"||xlsLabelMatch(c,"pending₹","pending(₹)","outstanding","amountpending"));
  const revCol    = columns.find(c=>c.key==="_revenue"||c.key==="revenue"||xlsLabelMatch(c,"revenue₹","revenue(₹)","totalrevenue"));
  const ordersCol = columns.find(c=>c.key==="_orders"||xlsLabelMatch(c,"#orders","orders")&&!xlsLabelMatch(c,"avg","net","partial"));
  const replCol   = columns.find(c=>c.key==="_replAmt"||xlsLabelMatch(c,"repldeducted","repl.deducted","replacement"));
  const totalPaid    = paidCol   ? sumCol(paidCol)   : null;
  const totalPending = pendCol   ? sumCol(pendCol)   : null;
  const totalRev     = revCol    ? sumCol(revCol)    : null;
  const totalOrders  = ordersCol ? sumCol(ordersCol) : null;
  const totalRepl    = replCol   ? sumCol(replCol)   : null;
  const collRate = (totalPaid!=null&&totalPending!=null&&(totalPaid+totalPending)>0)?Math.round(totalPaid/(totalPaid+totalPending)*100):null;
  const activeCount  = data.filter(r=>r.active===true||r.active==="Yes").length;
  const unpaidCount  = data.filter(r=>{ const p=pendCol?numVal(String(getVal(r,pendCol))):0; return p>0; }).length;

  // ── Styles ──
  const styles=`<Styles>
  <Style ss:ID="title"><Font ss:Bold="1" ss:Size="16" ss:Color="#0F172A"/><Alignment ss:Horizontal="Left"/></Style>
  <Style ss:ID="subtitle"><Font ss:Italic="1" ss:Size="9" ss:Color="#64748B"/><Alignment ss:Horizontal="Left"/></Style>
  <Style ss:ID="hdr"><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="10"/><Interior ss:Color="#0F1923" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center" ss:WrapText="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#3B82F6"/></Borders></Style>
  <Style ss:ID="d0"><Alignment ss:Horizontal="Left" ss:WrapText="1"/><Font ss:Size="10"/></Style>
  <Style ss:ID="d1"><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/><Alignment ss:Horizontal="Left" ss:WrapText="1"/><Font ss:Size="10"/></Style>
  <Style ss:ID="num0"><Alignment ss:Horizontal="Right"/><Font ss:Size="10"/><NumberFormat ss:Format="#,##0.##"/></Style>
  <Style ss:ID="num1"><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/><Alignment ss:Horizontal="Right"/><Font ss:Size="10"/><NumberFormat ss:Format="#,##0.##"/></Style>
  <Style ss:ID="tot"><Font ss:Bold="1" ss:Size="10" ss:Color="#0F172A"/><Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#1E3A5F"/></Borders><Alignment ss:Horizontal="Left" ss:WrapText="1"/></Style>
  <Style ss:ID="totNum"><Font ss:Bold="1" ss:Size="10" ss:Color="#0F172A"/><Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#1E3A5F"/></Borders><Alignment ss:Horizontal="Right"/><NumberFormat ss:Format="#,##0.##"/></Style>
  <Style ss:ID="paid"><Font ss:Bold="1" ss:Color="#15803D" ss:Size="10"/><Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>
  <Style ss:ID="unpaid"><Font ss:Bold="1" ss:Color="#B91C1C" ss:Size="10"/><Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>
  <Style ss:ID="active"><Font ss:Bold="1" ss:Color="#065F46" ss:Size="10"/><Interior ss:Color="#D1FAE5" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>
  <Style ss:ID="inactive"><Font ss:Color="#6B7280" ss:Size="10"/><Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style>
  <Style ss:ID="smHdr"><Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="11"/><Interior ss:Color="#1E3A5F" ss:Pattern="Solid"/><Alignment ss:Horizontal="Left"/></Style>
  <Style ss:ID="smLbl"><Font ss:Bold="1" ss:Size="10" ss:Color="#475569"/><Alignment ss:Horizontal="Left"/></Style>
  <Style ss:ID="smVal"><Font ss:Bold="1" ss:Size="13" ss:Color="#0F172A"/><Alignment ss:Horizontal="Left"/><NumberFormat ss:Format="#,##0.##"/></Style>
  <Style ss:ID="smValGreen"><Font ss:Bold="1" ss:Size="13" ss:Color="#059669"/><Alignment ss:Horizontal="Left"/><NumberFormat ss:Format="#,##0.##"/></Style>
  <Style ss:ID="smValRed"><Font ss:Bold="1" ss:Size="13" ss:Color="#DC2626"/><Alignment ss:Horizontal="Left"/><NumberFormat ss:Format="#,##0.##"/></Style>
  <Style ss:ID="blank"><Alignment ss:Horizontal="Left"/></Style>
</Styles>`;

  // ── Data rows with smart cell styling ──
  const headerRow=`<Row ss:StyleID="hdr">
    ${columns.map(c=>`<Cell><Data ss:Type="String">${esc(c.label)}</Data></Cell>`).join("")}
  </Row>`;

  const dataRows=data.map((row,ri)=>{
    const base=ri%2===0?"0":"1";
    const cells=columns.map(c=>{
      const raw=getVal(row,c);
      const v=String(raw==null?"":raw);
      // Status column — colour coded
      if(c.key==="status"||c.label==="Status"||String(v).toUpperCase()==="PAID"||String(v).toUpperCase()==="UNPAID"){
        const sty=v.toUpperCase()==="PAID"?"paid":v.toUpperCase()==="UNPAID"?"unpaid":base==="0"?"d0":"d1";
        return `<Cell ss:StyleID="${sty}"><Data ss:Type="String">${esc(v)}</Data></Cell>`;
      }
      // Active column
      if(c.key==="active"||c.label==="Active"){
        const sty=v==="Yes"?"active":"inactive";
        return `<Cell ss:StyleID="${sty}"><Data ss:Type="String">${esc(v)}</Data></Cell>`;
      }
      // Numeric
      if(isNum(v)&&c.num!==false){
        return `<Cell ss:StyleID="num${base}"><Data ss:Type="Number">${numVal(v)}</Data></Cell>`;
      }
      return `<Cell ss:StyleID="d${base}"><Data ss:Type="String">${esc(v)}</Data></Cell>`;
    });
    return `<Row>${cells.join("")}</Row>`;
  }).join("\n");

  // ── Totals row ──
  const totalsRow=`<Row ss:StyleID="tot">
    ${columns.map((c,ci)=>{
      const t=sumCol(c);
      if(c.num!==false&&t!==0){return `<Cell ss:StyleID="totNum"><Data ss:Type="Number">${t}</Data></Cell>`;}
      return `<Cell ss:StyleID="tot"><Data ss:Type="String">${esc(ci===0?"TOTAL ("+data.length+" records)":"—")}</Data></Cell>`;
    }).join("")}
  </Row>`;

  // ── Summary sheet ──
  const smRow=(label,val,style="smVal")=>`<Row>
    <Cell ss:StyleID="smLbl"><Data ss:Type="String">${esc(label)}</Data></Cell>
    <Cell ss:StyleID="${style}"><Data ss:Type="${typeof val==="number"?"Number":"String"}">${typeof val==="number"?val:esc(String(val))}</Data></Cell>
  </Row>`;
  const smBlank=`<Row><Cell ss:StyleID="blank"><Data ss:Type="String"></Data></Cell></Row>`;

  const summarySheet=`<Worksheet ss:Name="Summary">
<Table ss:DefaultColumnWidth="180">
  <Column ss:Width="200"/><Column ss:Width="160"/>
  <Row ss:StyleID="smHdr">
    <Cell ss:MergeAcross="1"><Data ss:Type="String">${esc(appEmoji+" "+co)} — ${esc(tabName)} Summary</Data></Cell>
  </Row>
  <Row ss:StyleID="subtitle">
    <Cell ss:MergeAcross="1"><Data ss:Type="String">Exported: ${esc(now)}${cosub?" · "+cosub:""}${gst?" · GST: "+gst:""}${coPhone?" · "+coPhone:""}</Data></Cell>
  </Row>
  ${smBlank}
  ${smRow("Total Records",data.length)}
  ${smRow("Active Customers",activeCount)}
  ${smRow("Inactive Customers",data.length-activeCount)}
  ${smRow("Unpaid Customers",unpaidCount)}
  ${smRow("Fully Paid Customers",data.length-unpaidCount,"smValGreen")}
  ${smBlank}
  ${totalRev!=null?smRow("Total Revenue (Rs)",totalRev):""}
  ${totalPaid!=null?smRow("Total Collected (Rs)",totalPaid,"smValGreen"):""}
  ${totalPending!=null?smRow("Total Outstanding (Rs)",totalPending,totalPending>0?"smValRed":"smValGreen"):""}
  ${collRate!=null?smRow("Collection Rate",collRate+"%"):""}
  ${totalOrders!=null?smRow("Total Orders",totalOrders):""}
  ${totalRepl!=null&&totalRepl>0?smRow("Total Replacements Deducted (Rs)",totalRepl,"smValRed"):""}
  ${smBlank}
  <Row ss:StyleID="subtitle">
    <Cell ss:MergeAcross="1"><Data ss:Type="String">See the '${esc(tabName)}' sheet for full data →</Data></Cell>
  </Row>
</Table>
</Worksheet>`;

  const xml=`<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:x="urn:schemas-microsoft-com:office:excel">
<DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>${esc(tabName)} — ${esc(co)}</Title>
  <Author>${esc(co)}</Author>
  <Created>${new Date().toISOString()}</Created>
</DocumentProperties>
${styles}
${summarySheet}
<Worksheet ss:Name="${esc(tabName)}">
<Table>
  <Row ss:StyleID="title">
    <Cell ss:MergeAcross="${columns.length-1}"><Data ss:Type="String">${esc(appEmoji+" "+co)} — ${esc(tabName)} Report</Data></Cell>
  </Row>
  <Row ss:StyleID="subtitle">
    <Cell ss:MergeAcross="${columns.length-1}"><Data ss:Type="String">Exported: ${esc(now)} · ${data.length} records${cosub?" · "+cosub:""}${gst?" · GST: "+gst:""}${coPhone?" · "+coPhone:""}</Data></Cell>
  </Row>
  ${headerRow}
  ${dataRows}
  ${totalsRow}
</Table>
<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
  <FreezePanes/><FrozenNoSplit/><SplitHorizontal>3</SplitHorizontal><TopRowBottomPane>3</TopRowBottomPane>
</WorksheetOptions>
</Worksheet>
</Workbook>`;

  const blob=new Blob([xml],{type:"application/vnd.ms-excel;charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`${tabName.replace(/\s+/g,"_")}_${today()}.xls`;
  document.body.appendChild(a);a.click();
  setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(a.href);},1000);
}

// ═══════════════════════════════════════════════════════════════

export { exportPDF, exportAgentReceipt, useT, exportDeliveryLabel, exportDeliveryInvoice, exportDeliveryReceipt, shareWhatsApp, exportCSV, exportCustomersCSV, exportWord, exportTabPDF, exportPnLReport, exportPnLCSV, exportTabExcel };
