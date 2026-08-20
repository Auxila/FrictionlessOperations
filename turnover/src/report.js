/* ============================================================================
 * EVIDENCE REPORT
 *
 * The CSV is for spreadsheets. This is for people: a self-contained HTML
 * document laid out to read on a phone, print to PDF, or attach to an email
 * arguing about a security deposit. It carries no external references, so it
 * survives being forwarded anywhere.
 * ========================================================================= */

import { SECTORS } from './inventory.js';
import { DEFICIT, VERIFIED, computeStats, formatMoney, formatMoneyShort, getItem, verdict } from './store.js';

/* Exported so build.mjs can hash it into the page's `style-src`. The print
 * preview runs in a same-origin iframe, which inherits this page's CSP — an
 * unhashed <style> there is silently refused and the PDF prints unstyled. */
export const REPORT_STYLES = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin:0; padding:24px; background:#f1f5f9; color:#0f172a;
         font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
  .sheet { max-width:820px; margin:0 auto; background:#fff; border:1px solid #cbd5e1;
           border-radius:10px; padding:32px; }
  h1 { margin:0 0 4px; font-size:22px; letter-spacing:-0.01em; }
  .sub { margin:0 0 24px; color:#64748b; font-size:13px;
         font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
         text-transform:uppercase; letter-spacing:.09em; }
  .verdict { border:2px solid; border-radius:10px; padding:16px 18px; margin-bottom:22px; }
  .v-label { margin:0; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.16em;
             font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
  .v-headline { margin:4px 0 0; font-size:24px; font-weight:700; letter-spacing:-0.01em; color:#0f172a; }
  .v-detail { margin:4px 0 0; font-size:13px; color:#475569; }
  .v-ready { border-color:#86efac; background:#f0fdf4; }
  .v-ready .v-label { color:#15803d; }
  .v-issues { border-color:#fca5a5; background:#fef2f2; }
  .v-issues .v-label { color:#b91c1c; }
  .v-incomplete { border-color:#fcd34d; background:#fffbeb; }
  .v-incomplete .v-label { color:#b45309; }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:10px; margin-bottom:28px; }
  .card { border:1px solid #e2e8f0; border-radius:8px; padding:12px 14px; background:#f8fafc; }
  .card b { display:block; font-size:22px; line-height:1.1; }
  .card span { font-size:10px; text-transform:uppercase; letter-spacing:.1em; color:#64748b;
               font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
  .card.claim b { color:#b91c1c; }
  .card.ok b { color:#15803d; }
  h2 { font-size:12px; text-transform:uppercase; letter-spacing:.14em; color:#475569;
       border-bottom:1px solid #e2e8f0; padding-bottom:7px; margin:32px 0 16px; }
  .finding { border:1px solid #fecaca; background:#fef2f2; border-radius:8px; padding:14px 16px; margin-bottom:12px; }
  .finding header { display:flex; align-items:baseline; justify-content:space-between; gap:12px; }
  .finding h3 { margin:0; font-size:16px; }
  .sector { font-size:10px; text-transform:uppercase; letter-spacing:.1em; color:#9f1239;
            font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; white-space:nowrap; }
  .note { margin:8px 0 0; }
  .note.muted { color:#94a3b8; font-style:italic; }
  .meta, .stamp { margin:8px 0 0; font-size:12px; color:#64748b;
                  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
  .stamp { font-size:10px; text-transform:uppercase; letter-spacing:.08em; color:#94a3b8; }
  .shortfall { margin:8px 0 0; font-weight:700; color:#b91c1c; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  .sector-head th { text-align:left; padding:11px 8px 5px; font-size:10px; text-transform:uppercase;
                    letter-spacing:.12em; color:#0f172a; border-bottom:2px solid #cbd5e1; }
  .sector-head span { color:#94a3b8; margin-left:6px; }
  td { padding:4px 8px; border-bottom:1px solid #f1f5f9; vertical-align:top; line-height:1.35; }
  td.status { width:112px; white-space:nowrap; font-size:11px; text-transform:uppercase; letter-spacing:.06em;
              font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
  td.detail { color:#64748b; font-size:12px; }
  .col-head th { text-align:left; padding:4px 8px; font-size:9px; text-transform:uppercase;
                 letter-spacing:.12em; color:#94a3b8; border-bottom:1px solid #e2e8f0; }
  tr.s-verified td.status { color:#15803d; }
  tr.s-deficit td.status { color:#b91c1c; font-weight:700; }
  tr.s-pending td.status { color:#94a3b8; }
  .estnote { margin:18px 0 0; padding:10px 12px; border-left:3px solid #e2e8f0; background:#f8fafc;
             font-size:11px; line-height:1.5; color:#64748b; }
  .signoff { margin-top:32px; padding-top:16px; border-top:1px solid #e2e8f0;
             display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap;
             font-size:12px; color:#475569; }
  .signoff b { display:block; color:#0f172a; font-size:14px; }
  footer { margin-top:20px; font-size:10px; color:#94a3b8; text-align:center;
           font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
           text-transform:uppercase; letter-spacing:.1em; }
  @page { margin: 14mm 12mm; }
  @media print {
    body { background:#fff; padding:0; font-size:11pt; }
    .sheet { border:0; border-radius:0; padding:0; max-width:none; }
    /* Status colours and the red finding panels carry meaning, so keep the
       browser from helpfully stripping them out of the PDF. */
    * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .finding, .card { break-inside:avoid; }
    h2 { break-after:avoid; }
    tbody { break-inside:auto; }
    tr { break-inside:avoid; }
    .sector-head th { break-after:avoid; }
    /* Repeat the column meanings at the top of every printed page. */
    thead { display:table-header-group; }
    .signoff { break-inside:avoid; }
    .screen-only { display:none !important; }
  }
`;

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

/* Written for a reader, not a log parser: "19 Aug 2026, 11:53 PM". */
const HUMAN = { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' };
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, HUMAN);
};

/* ---------------------------------------------------------------------------
 * SHARE SUMMARY
 *
 * The lowest-friction thing a manager can receive: no attachment, no app, no
 * zooming. It arrives as the body of a text or email and is read where it
 * lands. Deliberately plain — no markdown, no emoji, nothing that renders as
 * literal punctuation in somebody's SMS client.
 * ------------------------------------------------------------------------- */

const MAX_LISTED = 10;

export function buildSummaryText(property, report, at = new Date()) {
  const v = verdict(property);
  const stats = computeStats(property);
  const when = at.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  /* Missing and damaged are different jobs — one is a reorder, the other a
   * repair or a replacement — so they are split rather than run together in
   * one list a manager has to triage himself. */
  const missing = report.lines.filter((l) => l.short > 0);
  const damaged = report.lines.filter((l) => !(l.short > 0));
  const split = missing.length > 0 && damaged.length > 0;

  /* The first line is what shows in a lock-screen preview, so it carries the
   * property and the verdict on its own. */
  const lines = [
    `${property.name} — ${v.headline}`,
    '',
    `Turnover ${when}${property.signedOffBy ? ` · ${property.signedOffBy}` : ''}`,
    `${stats.verified} of ${stats.total} verified`,
  ];

  let listed = 0;
  const section = (title, group) => {
    if (!group.length) return;
    lines.push('');
    if (split) lines.push(title);
    for (const line of group) {
      if (listed >= MAX_LISTED) return;
      listed += 1;
      const what =
        line.short > 0
          ? `${line.short} of ${line.expected} missing`
          : line.note || line.condition || 'flagged';
      const price = line.cost > 0 ? `, ${line.estimated ? 'est. ' : ''}${formatMoneyShort(line.cost)}` : '';
      lines.push(`- ${line.label} (${line.zone}): ${what}${price}`);
    }
  };

  section('MISSING', missing);
  section('DAMAGED / FAULTY', damaged);

  if (report.count > listed) lines.push(`- ...and ${report.count - listed} more`);

  if (report.claim > 0) {
    lines.push(
      '',
      `${report.estimated ? 'Estimated replacement' : 'Replacement'} value: ${formatMoneyShort(report.claim)}`
    );
    if (report.estimated) {
      lines.push('(estimates use median local replacement costs)');
    }
  }

  return lines.join('\n');
}

export const summarySubject = (property) => `Turnover — ${property.name}`;

/* Becomes the PDF's default filename when the reader hits "Save as PDF", so
 * it is written the way a person would name the file. */
export function reportTitle(property, at = new Date()) {
  return `Turnover Report - ${property.name} - ${at.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;
}

export function buildReport(property, report, options = {}) {
  const stats = computeStats(property);
  const v = verdict(property);
  const generatedAt = options.generatedAt || new Date();

  const deficitCards = report.lines
    .map((line) => {
      /* A shortfall states itself — "short 2 of 12" is the finding, and the
       * operative never had to write it. */
      const headline =
        line.short > 0
          ? `Short ${line.short} — counted ${esc(line.counted)} of ${esc(line.expected)}`
          : null;
      const price =
        line.cost > 0
          ? line.estimated
            ? `Est. ${line.short > 1 ? `${line.short} &times; ${formatMoney(line.unitCost)} = ` : ''}${formatMoney(line.cost)}`
            : formatMoney(line.cost)
          : null;
      const meta = [line.condition && esc(line.condition), price].filter(Boolean).join(' &middot; ');
      return `
      <article class="finding">
        <header>
          <h3>${esc(line.label)}</h3>
          <span class="sector">${esc(line.sector)}</span>
        </header>
        ${headline ? `<p class="shortfall">${headline}</p>` : ''}
        ${
          line.note
            ? `<p class="note">${esc(line.note)}</p>`
            : headline
              ? ''
              : '<p class="note muted">No note recorded.</p>'
        }
        ${meta ? `<p class="meta">${meta}</p>` : ''}
        <p class="stamp">Logged ${esc(fmtDate(line.updatedAt))}</p>
      </article>`;
    })
    .join('');

  const sectorRows = SECTORS.map((sector) => {
    const rows = sector.items
      .map((item) => {
        const state = getItem(property, item.id);
        const label =
          state.status === VERIFIED ? 'Verified' : state.status === DEFICIT ? 'Deficit' : 'Not audited';
        const detail = [
          state.expected && `${esc(state.counted || '—')} of ${esc(state.expected)}`,
          state.brand && esc(state.brand),
          state.model && `Model ${esc(state.model)}`,
          state.serial && `S/N ${esc(state.serial)}`,
          state.condition && esc(state.condition),
        ]
          .filter(Boolean)
          .join(' &middot; ');
        return `<tr class="s-${state.status}">
          <td>${esc(item.label)}</td>
          <td class="status">${label}</td>
          <td class="detail">${detail || ''}</td>
        </tr>`;
      })
      .join('');
    return `<tbody><tr class="sector-head"><th colspan="3">${esc(sector.name)} <span>${esc(sector.zone)}</span></th></tr>${rows}</tbody>`;
  }).join('');

  const tableHead =
    '<thead><tr class="col-head"><th>Asset</th><th>Status</th><th>Detail</th></tr></thead>';

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(reportTitle(property, generatedAt))}</title>
<style>${REPORT_STYLES}</style></head>
<body><div class="sheet">
  <h1>${esc(property.name)}</h1>
  <p class="sub">Turnover inventory report &middot; generated ${esc(generatedAt.toLocaleString(undefined, HUMAN))}</p>

  <section class="verdict v-${v.key}">
    <p class="v-label">${esc(v.label)}</p>
    <p class="v-headline">${esc(v.headline)}</p>
    <p class="v-detail">${esc(v.detail)}</p>
  </section>

  <div class="cards">
    <div class="card ok"><b>${stats.verified}/${stats.total}</b><span>Verified</span></div>
    <div class="card"><b>${stats.percent}%</b><span>Complete</span></div>
    <div class="card"><b>${report.count}</b><span>Deficits</span></div>
    <div class="card${report.claim > 0 ? ' claim' : ''}"><b>${esc(formatMoney(report.claim))}</b><span>${report.estimated ? 'Est. replacement' : 'Replacement'} value</span></div>
    ${report.shortUnits ? `<div class="card claim"><b>${report.shortUnits}</b><span>Units short</span></div>` : ''}
  </div>

  <h2>What needs action${report.count ? ` &mdash; ${report.count}` : ''}</h2>
  ${
    report.count
      ? deficitCards
      : '<p class="note muted">No deficits logged. Every audited asset was present and in acceptable condition.</p>'
  }

  <h2>Appendix &mdash; full inventory</h2>
  <table>${tableHead}${sectorRows}</table>

  ${
    report.estimated
      ? '<p class="estnote">Figures marked “Est.” use median replacement costs for the item at Panama City retail including 7% Florida sales tax, with outdoor assets priced at salt-air grade, multiplied by the shortfall where a count applies. They are estimates for triage, not quotations.</p>'
      : ''
  }

  <div class="signoff">
    <div><b>${esc(property.signedOffBy || 'Unsigned')}</b>Audited by</div>
    <div><b>${esc(fmtDate(property.signedOffAt || property.updatedAt))}</b>Completed</div>
    <div><b>${stats.pending}</b>Assets not audited</div>
  </div>

  <footer>Frictionless Operations &middot; Property Turnover Matrix</footer>
</div></body></html>`;
}
