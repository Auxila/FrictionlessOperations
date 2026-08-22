/* ============================================================================
 * PORTFOLIO REPORT
 *
 *   node tools/portfolio-report.mjs <backup.json> [out.html]
 *
 * Compiles one printable document from a whole-portfolio backup: an at-a-glance
 * index, the consolidated restock order, outstanding appliance records, and a
 * per-property detail card. Written to be read on paper or as a PDF by someone
 * who was not on the walkthrough.
 *
 * Properties that were never walked (no items touched) are omitted. A
 * placeholder row in a report is noise that invites the wrong question.
 * ========================================================================= */

import { readFileSync, writeFileSync } from 'node:fs';
import { ALL_ITEMS } from '../src/inventory.js';
import { computeStats, deficitReport, getItem, parseBackup, verdict } from '../src/store.js';

const [, , src, out = 'portfolio-report.html'] = process.argv;
if (!src) {
  console.error('usage: node tools/portfolio-report.mjs <backup.json> [out.html]');
  process.exit(1);
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const SPEC = ALL_ITEMS.filter((i) => i.fields);

/* Nameplate values are typed by thumb on a phone in a utility closet, so they
 * arrive with stray whitespace. Trim at the boundary: a value that is only
 * spaces is a value nobody captured, and it must not read as one that was. */
const val = (x) => String(x ?? '').trim();
const anyField = (st) => Boolean(val(st.brand) || val(st.model) || val(st.serial));
const allFields = (st) => Boolean(val(st.brand) && val(st.model) && val(st.serial));
const cell = (x) => (val(x) ? esc(val(x)) : '<span class="absent">not located</span>');

const { properties: all } = parseBackup(readFileSync(src, 'utf8'));
const properties = all
  .filter((p) => Object.keys(p.items).length > 0)
  .sort((a, b) => a.name.localeCompare(b.name));
const omitted = all.length - properties.length;

/* --- aggregate ------------------------------------------------------------ */
const rows = properties.map((p) => ({ p, r: deficitReport(p), s: computeStats(p), v: verdict(p) }));
const buy = new Map();
const outstanding = [];
let claim = 0, deficits = 0, units = 0, audited = 0, serials = 0;

for (const { p, r, s } of rows) {
  claim += r.claim; deficits += r.count; audited += s.verified + s.deficit;
  for (const l of r.lines) {
    const e = buy.get(l.label) || { qty: 0, unit: l.unitCost, where: [] };
    e.qty += l.short || 0;
    units += l.short || 0;
    e.where.push(`${p.name} (${l.short})`);
    buy.set(l.label, e);
  }
  for (const it of SPEC) {
    const st = getItem(p, it.id);
    const has = anyField(st);
    if (allFields(st)) { serials += 1; continue; }
    if (!has && !it.id.startsWith('k-')) continue;   // only the kitchen four are expected everywhere
    outstanding.push({
      prop: p.name, asset: it.label,
      what: has
        ? [!val(st.brand) && 'brand', !val(st.model) && 'model', !val(st.serial) && 'serial']
            .filter(Boolean).join(' and ') + ' not located'
        : 'plate not located',
    });
  }
}
const buyList = [...buy].sort((a, b) => b[1].qty * b[1].unit - a[1].qty * a[1].unit);
const clean = rows.filter((x) => !x.r.count).length;
const verified = rows.reduce((n, { s }) => n + s.verified, 0);
const expected = rows.reduce((n, { s }) => n + s.total, 0);
const generated = new Date();

/* --- markup --------------------------------------------------------------- */
const indexRows = rows.map(({ p, r, s }) => `
  <tr class="${r.count ? 'has-issues' : ''}">
    <td class="name">${esc(p.name)}</td>
    <td class="num">${s.verified}/${s.total}</td>
    <td class="chip">${r.count
      ? `<span class="pill pill-red">${r.count} issue${r.count > 1 ? 's' : ''}</span>`
      : '<span class="pill pill-green">clear</span>'}</td>
    <td class="num money">${r.count ? esc(money(r.claim)) : ''}</td>
  </tr>`).join('');

const cards = rows.map(({ p, r, s, v }) => {
  const appliances = SPEC.map((it) => {
    const st = getItem(p, it.id);
    if (!anyField(st)) return '';
    return `<tr>
      <th>${esc(it.label)}</th>
      <td>${cell(st.brand)}</td>
      <td class="mono">${cell(st.model)}</td>
      <td class="mono">${cell(st.serial)}</td>
    </tr>`;
  }).join('');

  const missing = r.lines.map((l) => `<tr>
      <td class="qty">${l.short}</td>
      <td>${esc(l.label)}<span class="zone">${esc(l.zone)}</span></td>
      <td class="present">${esc(l.counted)} of ${esc(l.expected)} present</td>
      <td class="num">${esc(money(l.unitCost))} ea</td>
      <td class="num money">${esc(money(l.cost))}</td>
    </tr>`).join('');

  return `<section class="card">
    <header>
      <h3>${esc(p.name)}</h3>
      <span class="pill ${r.count ? 'pill-red' : 'pill-green'}">${
        r.count ? `${r.count} issue${r.count > 1 ? 's' : ''} · ${esc(money(r.claim))}` : 'nothing missing'}</span>
    </header>
    <p class="meta">${s.verified} of ${s.total} verified${
      p.signedOffBy ? ` &middot; signed off by ${esc(p.signedOffBy)}` : ''}</p>

    ${appliances ? `<h4>Appliances</h4>
    <table class="appliances">
      <thead><tr><th>Appliance</th><th>Brand</th><th>Model</th><th>Serial</th></tr></thead>
      <tbody>${appliances}</tbody>
    </table>` : ''}

    ${missing ? `<h4>Missing</h4>
    <table class="missing"><tbody>${missing}</tbody></table>` : ''}
  </section>`;
}).join('');

/* Every appliance in the portfolio in one table. The detail cards above answer
 * "what is in this property"; this answers "where is that serial number", which
 * is the question someone actually has when a warranty form is open in front of
 * them. One <tbody> per property so a unit's rows never split across a page. */
const indexGroups = rows.map(({ p }) => {
  const list = SPEC.map((it) => ({ it, st: getItem(p, it.id) }))
    .filter(({ it, st }) => anyField(st) || it.id.startsWith('k-'));
  if (!list.length) return '';
  return `<tbody>${list.map(({ it, st }, i) => `<tr>
      <td class="prop">${i === 0 ? esc(p.name) : ''}</td>
      <td class="asset">${esc(it.label)}</td>
      <td>${cell(st.brand)}</td>
      <td class="mono">${cell(st.model)}</td>
      <td class="mono">${cell(st.serial)}</td>
    </tr>`).join('')}</tbody>`;
}).join('');
const indexRowCount = rows.reduce((n, { p }) =>
  n + SPEC.filter((it) => anyField(getItem(p, it.id)) || it.id.startsWith('k-')).length, 0);
const indexComplete = rows.reduce((n, { p }) =>
  n + SPEC.filter((it) => allFields(getItem(p, it.id))).length, 0);

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Portfolio Turnover Report, ${generated.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</title>
<style>
  :root{ color-scheme:light;
    --ink:#0f172a; --mid:#475569; --dim:#94a3b8; --line:#e2e8f0; --rule:#cbd5e1;
    --red:#b91c1c; --redbg:#fef2f2; --redline:#fecaca;
    --green:#15803d; --greenbg:#f0fdf4; --greenline:#bbf7d0;
    --amber:#b45309; --amberbg:#fffbeb; --amberline:#fde68a;
    --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace; }
  *{box-sizing:border-box}
  body{margin:0;padding:28px 20px;background:#f1f5f9;color:var(--ink);
       font:15px/1.55 var(--sans);-webkit-font-smoothing:antialiased}
  .sheet{max-width:860px;margin:0 auto;background:#fff;border:1px solid var(--rule);
         border-radius:12px;padding:44px 48px}

  h1{margin:0;font-size:27px;letter-spacing:-.02em}
  .sub{margin:6px 0 0;color:var(--mid);font:12px/1.5 var(--mono);
       text-transform:uppercase;letter-spacing:.12em}
  h2{margin:44px 0 14px;padding-bottom:8px;border-bottom:2px solid var(--ink);
     font-size:12px;text-transform:uppercase;letter-spacing:.16em}
  h4{margin:18px 0 7px;font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:var(--dim)}

  /* headline figures */
  .figures{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;margin-top:26px;
           background:var(--line);border:1px solid var(--line);border-radius:10px;overflow:hidden}
  .fig{background:#fff;padding:16px 18px}
  .fig b{display:block;font-size:26px;line-height:1.05;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
  .fig > span{display:block;margin-top:5px;font:9px/1.4 var(--mono);text-transform:uppercase;
            letter-spacing:.13em;color:var(--mid)}
  .fig b .of{font-size:15px;color:var(--dim);font-weight:600}
  .fig.cost b{color:var(--red)}
  .fig.ok b{color:var(--green)}

  .pill{display:inline-block;padding:3px 9px;border-radius:999px;border:1px solid;
        font:9px/1.5 var(--mono);text-transform:uppercase;letter-spacing:.1em;white-space:nowrap}
  .pill-red{color:var(--red);background:var(--redbg);border-color:var(--redline)}
  .pill-green{color:var(--green);background:var(--greenbg);border-color:var(--greenline)}

  table{width:100%;border-collapse:collapse}
  .index td,.index th{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left}
  .index thead th{font:9px/1.4 var(--mono);text-transform:uppercase;letter-spacing:.13em;
                  color:var(--dim);border-bottom:1px solid var(--rule)}
  .index .name{font-weight:600}
  .index .num{text-align:right;font-family:var(--mono);font-size:12px;font-variant-numeric:tabular-nums}
  .index .money{font-weight:700}
  .index .chip{width:96px}
  .index tr.has-issues .money{color:var(--red)}
  .index tbody tr:last-child td{border-bottom:0}
  .index tfoot td{padding:11px 10px 0;border-top:2px solid var(--ink);font-weight:700}
  .index tfoot .money{font-size:15px;color:var(--red)}

  .buy thead th{padding:0 10px 6px;text-align:left;font:9px/1.4 var(--mono);
                text-transform:uppercase;letter-spacing:.13em;color:var(--dim);
                border-bottom:1px solid var(--rule)}
  .buy thead .num{text-align:right}
  .buy td{padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}
  .buy tbody tr:last-child td{border-bottom:0}
  .buy .q{width:52px;text-align:right;font:700 16px var(--mono);font-variant-numeric:tabular-nums}
  .buy .item{font-weight:600}
  .buy .where{display:block;margin-top:3px;font-size:11px;color:var(--dim);line-height:1.45}
  .buy .num{text-align:right;font-family:var(--mono);font-size:12px;white-space:nowrap;
            font-variant-numeric:tabular-nums}
  .buy .line{font-weight:700}
  .buy tfoot td{padding:11px 10px 0;font-weight:700;border-top:2px solid var(--ink)}
  .buy tfoot .num{font-size:17px;color:var(--red)}

  .callout{margin:14px 0 0;padding:14px 16px;border-left:3px solid var(--amberline);
           background:var(--amberbg);border-radius:0 8px 8px 0;font-size:13.5px;line-height:1.6;color:#78350f}
  .outstanding{margin-top:14px}
  .outstanding td{padding:6px 10px;border-bottom:1px solid var(--line);font-size:13px}
  .outstanding .prop{font-weight:600}
  .outstanding .what{color:var(--mid);font-family:var(--mono);font-size:11px}

  .card{margin-top:22px;padding-top:20px;border-top:1px solid var(--line)}
  .card:first-of-type{border-top:0}
  .card header{display:flex;align-items:baseline;justify-content:space-between;
               gap:6px 14px;flex-wrap:wrap}
  .card h3{margin:0;font-size:18px;letter-spacing:-.01em}
  .card .meta{margin:4px 0 0;font:10px/1.5 var(--mono);text-transform:uppercase;
              letter-spacing:.1em;color:var(--dim)}

  .appliances th,.appliances td{padding:5px 9px;border-bottom:1px solid var(--line);
                                text-align:left;font-size:12.5px;vertical-align:top}
  .appliances thead th{font:9px/1.4 var(--mono);text-transform:uppercase;letter-spacing:.12em;
                       color:var(--dim);border-bottom:1px solid var(--rule)}
  .appliances tbody th{font-weight:600;width:118px}
  .mono{font-family:var(--mono);font-size:11.5px;letter-spacing:.01em}
  .absent{color:var(--amber);font-style:italic;font-family:var(--sans);font-size:11.5px}

  .missing td{padding:6px 9px;border-bottom:1px solid var(--redline);font-size:13px;
              background:var(--redbg)}
  .missing .qty{width:40px;text-align:right;font:700 15px var(--mono);color:var(--red)}
  .missing .zone{display:block;font:9px/1.4 var(--mono);text-transform:uppercase;
                 letter-spacing:.1em;color:var(--dim);margin-top:1px}
  .missing .present{color:var(--mid);font-size:12px}
  .missing .num{text-align:right;font-family:var(--mono);font-size:12px;white-space:nowrap}
  .missing .money{font-weight:700;color:var(--red)}

  .indexnote{margin:0 0 12px;font-size:13px;color:var(--mid);line-height:1.6}
  .applindex{font-size:12.5px}
  .applindex thead th{padding:6px 9px;text-align:left;font:9px/1.4 var(--mono);
                      text-transform:uppercase;letter-spacing:.13em;color:var(--dim);
                      border-bottom:1px solid var(--rule)}
  .applindex td{padding:5px 9px;border-bottom:1px solid var(--line);vertical-align:top}
  .applindex tbody{border-top:1px solid var(--line)}
  .applindex tbody:first-of-type{border-top:0}
  .applindex .prop{font-weight:700;width:158px;line-height:1.35}
  .applindex .asset{width:104px;color:var(--mid)}

  footer{margin-top:38px;padding-top:14px;border-top:1px solid var(--line);
         color:var(--dim);display:flex;align-items:baseline;justify-content:space-between;
         gap:6px 24px;flex-wrap:wrap}
  footer .mark{font:9px/1.6 var(--mono);text-transform:uppercase;letter-spacing:.12em;
               white-space:nowrap}
  footer .basis{font-size:11px;line-height:1.6}

  @page{margin:14mm 12mm}
  @media print{
    body{background:#fff;padding:0;font-size:10.5pt;orphans:3;widows:3}
    .sheet{border:0;border-radius:0;padding:0;max-width:none}
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .card,.fig,.callout{break-inside:avoid}
    .applindex tbody{break-inside:avoid}
    h2{break-after:avoid}
    tr{break-inside:avoid}
    thead{display:table-header-group}
    .detail-start{break-before:page}
  }
  @media screen and (max-width:600px){
    body{padding:10px}
    .sheet{padding:20px 14px;border-radius:8px}
    h1{font-size:21px}
    h2{margin:32px 0 12px}
    .figures{grid-template-columns:repeat(2,1fr)}
    .fig b{font-size:22px}
    /* Four columns will not fit a phone. Verified count is the least urgent
       and repeats in the detail card below, so the whole column steps aside,
       heading included; status and cost are what the page is for. */
    .index tr > :nth-child(2){display:none}
    .index td,.index th{padding:7px 4px}
    .index .name{font-size:13.5px;overflow-wrap:anywhere}
    .index .chip{width:auto}
    .index .money{font-size:12px}
    .index tfoot td{padding:9px 4px 0}
    .pill{padding:2px 7px;font-size:8.5px}
    .buy thead th,.buy tfoot td{padding-left:4px;padding-right:4px}
    .buy td{padding:8px 4px}
    .buy .q{width:34px;font-size:14px}
    .buy .where{font-size:10px}
    .buy .num{font-size:11px}
    .appliances th,.appliances td{padding:4px 5px;font-size:11.5px}
    .appliances tbody th{width:auto}
    .mono{font-size:10.5px;overflow-wrap:anywhere}
    .missing td{padding:5px 5px;font-size:12px}
    .missing .present{font-size:11px}
    .outstanding td{padding:5px 4px;font-size:12px}
    /* Five columns will not fit a phone: the appliance index drops Brand,
       which is the one value that is guessable from the model number. */
    .applindex td:nth-child(3),.applindex thead th:nth-child(3){display:none}
    .applindex td{padding:4px 4px;font-size:11px}
    .applindex .prop{width:auto;overflow-wrap:anywhere}
    .applindex .asset{width:auto}
  }
</style></head>
<body><div class="sheet">

  <h1>Portfolio Turnover Report</h1>
  <p class="sub">${properties.length} properties &middot; ${generated.toLocaleDateString('en-US',
    { day: 'numeric', month: 'long', year: 'numeric' })}</p>

  <div class="figures">
    <div class="fig ok"><b>${audited.toLocaleString()}</b><span>Checks completed</span></div>
    <div class="fig"><b>${clean}<span class="of">/${properties.length}</span></b><span>Properties clear</span></div>
    <div class="fig"><b>${units}</b><span>Units to replace</span></div>
    <div class="fig cost"><b>${esc(money(claim))}</b><span>To restock</span></div>
  </div>

  <h2>At a glance</h2>
  <table class="index">
    <thead><tr><th>Property</th><th class="num">Verified</th><th>Status</th><th class="num">Cost</th></tr></thead>
    <tbody>${indexRows}</tbody>
    <tfoot><tr>
      <td>${properties.length} properties</td>
      <td class="num">${verified.toLocaleString()}/${expected.toLocaleString()}</td>
      <td></td>
      <td class="num money">${esc(money(claim))}</td>
    </tr></tfoot>
  </table>

  <h2>What to order</h2>
  <table class="buy">
    <thead><tr><th class="q">Qty</th><th>Item</th><th class="num">Each</th><th class="num">Cost</th></tr></thead>
    <tbody>${buyList.map(([item, e]) => `<tr>
      <td class="q">${e.qty}</td>
      <td><span class="item">${esc(item)}</span><span class="where">${esc(e.where.join(', '))}</span></td>
      <td class="num">${esc(money(e.unit))} ea</td>
      <td class="num line">${esc(money(e.qty * e.unit))}</td>
    </tr>`).join('')}</tbody>
    <tfoot><tr>
      <td class="q">${units}</td>
      <td>Total across ${deficits} line${deficits > 1 ? 's' : ''}</td>
      <td></td>
      <td class="num">${esc(money(claim))}</td>
    </tr></tfoot>
  </table>

  ${outstanding.length ? `<h2>Appliance records outstanding</h2>
  <p class="callout">I had difficulty locating the model and serial plates on the appliances
  listed below. On several of them the plate sits behind or underneath the unit and was not
  readable during the walkthrough. I will check each one again, more thoroughly, on my next visit
  to the property, and record the details then.</p>
  <table class="outstanding"><tbody>${outstanding.map((g) => `<tr>
      <td class="prop">${esc(g.prop)}</td><td>${esc(g.asset)}</td>
      <td class="what">${esc(g.what)}</td></tr>`).join('')}</tbody></table>` : ''}

  <h2 class="detail-start">Property detail</h2>
  ${cards}

  <h2 class="detail-start">Appliance index</h2>
  <p class="indexnote">All ${indexRowCount} appliances across ${properties.length} properties,
  ${indexComplete} of them fully recorded and ${indexRowCount - indexComplete} still to capture.
  Look up a model or serial here rather than paging back through the property detail.</p>
  <table class="applindex">
    <thead><tr><th>Property</th><th>Appliance</th><th>Brand</th><th>Model</th><th>Serial</th></tr></thead>
    ${indexGroups}
  </table>

  <footer>
    <span class="mark">Frictionless Operations &middot; Turnover Matrix</span>
    <span class="basis">Replacement costs are median Panama City retail, including 7% Florida sales tax.</span>
  </footer>
</div></body></html>`;

writeFileSync(out, html);
console.log(`${out}
  ${properties.length} properties${omitted ? ` (${omitted} un-walked placeholder omitted)` : ''}
  ${audited} checks completed · ${units} units short over ${deficits} lines · ${money(claim)}
  ${serials} complete appliance records · ${outstanding.length} outstanding`);
