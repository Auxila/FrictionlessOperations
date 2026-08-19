/* ============================================================================
 * EVIDENCE REPORT
 *
 * The CSV is for spreadsheets. This is for people: a self-contained HTML
 * document with the photos embedded, laid out to read on a phone, print to
 * PDF, or attach to an email arguing about a security deposit. It carries no
 * external references, so it survives being forwarded anywhere.
 * ========================================================================= */

import { SECTORS } from './inventory.js';
import { DEFICIT, VERIFIED, computeStats, formatMoney, getItem } from './store.js';

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
};

/* `photoData` maps photoId -> data URL. Built by the caller, because pulling
 * blobs out of IndexedDB is async and this module stays pure. */
export function buildReport(property, report, photoData = {}, options = {}) {
  const stats = computeStats(property);
  const generatedAt = options.generatedAt || new Date();
  const includePhotos = Object.keys(photoData).length > 0;

  const deficitCards = report.lines
    .map((line) => {
      const shots = line.photos
        .map((id) => photoData[id])
        .filter(Boolean)
        .map((src) => `<img src="${src}" alt="Evidence for ${esc(line.label)}">`)
        .join('');
      const meta = [
        line.qty && `Qty ${esc(line.qty)}`,
        line.condition && esc(line.condition),
        line.cost > 0 && formatMoney(line.cost),
      ]
        .filter(Boolean)
        .join(' &middot; ');
      return `
      <article class="finding">
        <header>
          <h3>${esc(line.label)}</h3>
          <span class="sector">${esc(line.sector)}</span>
        </header>
        ${line.note ? `<p class="note">${esc(line.note)}</p>` : '<p class="note muted">No note recorded.</p>'}
        ${meta ? `<p class="meta">${meta}</p>` : ''}
        ${shots ? `<div class="shots">${shots}</div>` : ''}
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
          state.qty && `Qty ${esc(state.qty)}`,
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

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Turnover Report — ${esc(property.name)}</title>
<style>
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
  .shots { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
  .shots img { width:180px; height:135px; object-fit:cover; border-radius:6px; border:1px solid #fca5a5; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  .sector-head th { text-align:left; padding:14px 8px 6px; font-size:10px; text-transform:uppercase;
                    letter-spacing:.12em; color:#0f172a; border-bottom:2px solid #cbd5e1; }
  .sector-head span { color:#94a3b8; margin-left:6px; }
  td { padding:6px 8px; border-bottom:1px solid #f1f5f9; vertical-align:top; }
  td.status { width:112px; white-space:nowrap; font-size:11px; text-transform:uppercase; letter-spacing:.06em;
              font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
  td.detail { color:#64748b; font-size:12px; }
  tr.s-verified td.status { color:#15803d; }
  tr.s-deficit td.status { color:#b91c1c; font-weight:700; }
  tr.s-pending td.status { color:#94a3b8; }
  .signoff { margin-top:32px; padding-top:16px; border-top:1px solid #e2e8f0;
             display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap;
             font-size:12px; color:#475569; }
  .signoff b { display:block; color:#0f172a; font-size:14px; }
  footer { margin-top:20px; font-size:10px; color:#94a3b8; text-align:center;
           font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
           text-transform:uppercase; letter-spacing:.1em; }
  @media print {
    body { background:#fff; padding:0; }
    .sheet { border:0; border-radius:0; padding:0; max-width:none; }
    .finding { break-inside:avoid; }
    tbody { break-inside:avoid; }
  }
</style></head>
<body><div class="sheet">
  <h1>${esc(property.name)}</h1>
  <p class="sub">Turnover inventory report &middot; generated ${esc(generatedAt.toLocaleString())}</p>

  <div class="cards">
    <div class="card ok"><b>${stats.verified}/${stats.total}</b><span>Verified</span></div>
    <div class="card"><b>${stats.percent}%</b><span>Complete</span></div>
    <div class="card"><b>${report.count}</b><span>Deficits</span></div>
    <div class="card claim"><b>${esc(formatMoney(report.claim))}</b><span>Replacement value</span></div>
  </div>

  <h2>Findings${report.count ? ` — ${report.count}` : ''}</h2>
  ${
    report.count
      ? deficitCards
      : '<p class="note muted">No deficits logged. Every audited asset was present and in acceptable condition.</p>'
  }
  ${
    report.photoCount && !includePhotos
      ? `<p class="meta">${report.photoCount} photo(s) were attached but excluded from this export.</p>`
      : ''
  }

  <h2>Full inventory</h2>
  <table>${sectorRows}</table>

  <div class="signoff">
    <div><b>${esc(property.signedOffBy || 'Unsigned')}</b>Audited by</div>
    <div><b>${esc(fmtDate(property.signedOffAt || property.updatedAt))}</b>Completed</div>
    <div><b>${stats.pending}</b>Assets not audited</div>
  </div>

  <footer>Frictionless Operations &middot; Property Turnover Matrix</footer>
</div></body></html>`;
}

export function reportFilename(property, at = new Date()) {
  const slug =
    property.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'property';
  const pad = (n) => String(n).padStart(2, '0');
  return `turnover-report_${slug}_${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}.html`;
}
