/* ============================================================================
 * FINDINGS — every deficit on the property in one screen, with the claim
 * total, the sign-off, and the two exports a manager actually sends.
 * ========================================================================= */

import React, { useState } from 'react';
import { FileDown, PenLine, Send, Table2 } from 'lucide-react';

import { computeStats, deficitReport, formatMoney, verdict } from '../store.js';
import { Modal, btn, input } from '../ui.jsx';

export function ReportSheet({ property, auditor, onClose, onSignOff, onExportCSV, onPrintPDF, onShare, exporting }) {
  const report = deficitReport(property);
  const stats = computeStats(property);
  const v = verdict(property);
  const [name, setName] = useState(property.signedOffBy || auditor || '');

  /* Sign and export in one gesture. The name is handed to the exporter
   * directly — reading it back off `property` would race the state update and
   * ship an unsigned report. */
  const signAndExport = (fn) => {
    const signed = name.trim();
    if (signed) onSignOff(signed);
    fn(signed);
  };

  return (
    <Modal title="Findings" subtitle={property.name} onClose={onClose} flush wide>
      {/* The answer, before any numbers. This is what gets sent, so the
          operative should see exactly what the manager will read. */}
      <div
        style={{ '--v': v.rgb }}
        className="border-b border-slate-800 bg-[rgb(var(--v)/0.1)] px-4 py-3"
      >
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[rgb(var(--v))]">
          {v.label}
        </p>
        <p className="mt-0.5 text-[17px] font-bold leading-tight text-slate-100">{v.headline}</p>
        <p className="mt-0.5 text-[12px] text-slate-400">{v.detail}</p>
      </div>

      <div className={`grid gap-px bg-slate-800 ${report.shortUnits ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {[
          { value: `${stats.percent}%`, label: 'Complete', tone: 'text-slate-100' },
          { value: report.count, label: 'Deficits', tone: report.count ? 'text-red-400' : 'text-slate-100' },
          ...(report.shortUnits
            ? [{ value: report.shortUnits, label: 'Units short', tone: 'text-red-400' }]
            : []),
          {
            value: formatMoney(report.claim),
            label: report.estimated ? 'Est. value' : 'Claim value',
            tone: report.claim ? 'text-amber-400' : 'text-slate-100',
          },
        ].map(({ value, label, tone }) => (
          <div key={label} className="bg-slate-900 px-2 py-3 text-center">
            <p className={`truncate font-mono text-[15px] font-bold tabular-nums ${tone}`}>{value}</p>
            <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {report.count === 0 ? (
        <p className="px-4 py-10 text-center text-sm leading-relaxed text-slate-400">
          No deficits logged.
          <br />
          <span className="font-mono text-[11px] uppercase tracking-wider text-slate-600">
            Every audited asset was present and acceptable
          </span>
        </p>
      ) : (
        <ul className="divide-y divide-slate-800 border-b border-slate-800">
          {report.lines.map((line) => (
            <li key={line.id} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-[15px] font-semibold text-red-200">{line.label}</p>
                {line.cost > 0 && (
                  <p className="shrink-0 font-mono text-[12px] font-bold tabular-nums text-amber-400">
                    {line.estimated && <span className="text-slate-500">est. </span>}
                    {formatMoney(line.cost)}
                  </p>
                )}
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
                {line.sector}
                {line.short > 0 && ` · short ${line.short} of ${line.expected}`}
              </p>
              {/* A shortfall is already the finding — "no note recorded"
                  underneath it reads as though something is missing. */}
              {line.note ? (
                <p className="mt-1.5 text-[13px] leading-snug text-slate-300">{line.note}</p>
              ) : line.short > 0 ? null : (
                <p className="mt-1.5 text-[13px] italic text-slate-600">No note recorded</p>
              )}
              {line.condition && (
                <p className="mt-1 font-mono text-[11px] text-slate-500">{line.condition}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 p-4">
        <label htmlFor="signoff-name" className="block">
          <span className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
            <PenLine size={11} aria-hidden="true" />
            Audited by
          </span>
          <input
            id="signoff-name"
            type="text"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className={input}
          />
          <span className="mt-1.5 block font-mono text-[10px] uppercase tracking-[0.1em] text-slate-600">
            {property.signedOffAt
              ? `Signed ${new Date(property.signedOffAt).toLocaleString()}`
              : 'Stamped onto the exports below'}
          </span>
        </label>

        {/* Nothing to open, nothing to install, readable on a lock screen —
            the shortest path from a finished walkthrough to a manager knowing
            where the unit stands. Works mid-audit too. */}
        <button
          type="button"
          onClick={() => signAndExport(onShare)}
          className={`${btn.primary} flex w-full items-center justify-center gap-2`}
        >
          <Send size={16} aria-hidden="true" />
          Send update
        </button>
        <p className="text-center text-[11px] leading-relaxed text-slate-500">
          A short plain-text rundown, straight into a text or email. He reads it
          without opening anything.
        </p>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => signAndExport(onPrintPDF)}
            disabled={exporting}
            className={`${btn.ghost} flex flex-1 items-center justify-center gap-2`}
          >
            <FileDown size={16} aria-hidden="true" />
            {exporting ? 'Preparing…' : 'PDF'}
          </button>
          <button
            type="button"
            onClick={() => signAndExport(onExportCSV)}
            className={`${btn.ghost} flex flex-1 items-center justify-center gap-2`}
          >
            <Table2 size={16} aria-hidden="true" />
            CSV
          </button>
        </div>
        <p className="text-center text-[11px] leading-relaxed text-slate-500">
          PDF for the formal record · CSV for spreadsheets
        </p>
      </div>
    </Modal>
  );
}
