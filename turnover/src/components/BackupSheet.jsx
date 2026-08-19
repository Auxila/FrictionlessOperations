/* ============================================================================
 * BACKUP & RESTORE
 *
 * Everything this console knows lives in one browser profile on one device.
 * Clearing site data, losing the phone, or switching to a laptop wipes it, and
 * there is no server to fall back on. This is the escape hatch — and the only
 * way to hand a walkthrough to a colleague.
 * ========================================================================= */

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Database, Download, Upload } from 'lucide-react';

import { Modal, btn } from '../ui.jsx';

export function BackupSheet({ propertyCount, auditedCount, onClose, onExport, onImport, busy }) {
  const fileRef = useRef(null);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(null); // parsed backup awaiting a choice

  useEffect(() => {
    setError(null);
  }, [pending]);

  const pick = async (file) => {
    setError(null);
    try {
      setPending(await onImport.parse(file));
    } catch (err) {
      setError(err.message || 'That file could not be read.');
    }
  };

  return (
    <Modal title="Backup & Restore" onClose={onClose} wide>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {[
          [propertyCount, 'Properties'],
          [auditedCount, 'Assets audited'],
        ].map(([value, label]) => (
          <div key={label} className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-2.5 text-center">
            <p className="truncate font-mono text-[14px] font-bold text-slate-100">{value}</p>
            <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {!pending ? (
        <>
          <p className="mb-4 text-sm leading-relaxed text-slate-400">
            This console stores everything in this browser on this device. A backup file carries
            every property, its expected counts and every audit — keep one after each turnover, and use it to move work
            to another phone or hand it to a colleague.
          </p>

          <div className="space-y-2">
            <button
              type="button"
              onClick={onExport}
              disabled={busy}
              className={`${btn.primary} flex w-full items-center justify-center gap-2`}
            >
              <Download size={16} aria-hidden="true" />
              {busy ? 'Packing…' : 'Download backup'}
            </button>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={`${btn.ghost} flex w-full items-center justify-center gap-2`}
            >
              <Upload size={16} aria-hidden="true" />
              Restore from file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              aria-label="Choose a backup file to restore"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) pick(file);
              }}
            />
          </div>

          {error && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-950/40 p-3 text-xs leading-relaxed text-red-300">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
        </>
      ) : (
        <>
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-slate-700 bg-slate-950 p-3">
            <Database size={15} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
            <div className="min-w-0 text-sm text-slate-300">
              <p className="font-semibold text-slate-100">
                {pending.properties.length} propert{pending.properties.length === 1 ? 'y' : 'ies'}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
                {pending.exportedAt
                  ? `Backed up ${new Date(pending.exportedAt).toLocaleString()}`
                  : 'Date unknown'}
              </p>
            </div>
          </div>

          {/* Merge is the safe default; replace is offered because restoring
              onto a fresh device should not leave a stub "Unit 01" behind. */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => onImport.apply(pending, 'merge')}
              className={`${btn.primary} w-full`}
            >
              Add to this device
            </button>
            <button
              type="button"
              onClick={() => onImport.apply(pending, 'replace')}
              className={`${btn.danger} w-full`}
            >
              Replace everything
            </button>
            <button type="button" onClick={() => setPending(null)} className={`${btn.ghost} w-full`}>
              Cancel
            </button>
          </div>
          <p className="mt-3 text-center font-mono text-[10px] uppercase leading-relaxed tracking-[0.1em] text-slate-600">
            “Add” keeps your current properties and appends the backup’s
          </p>
        </>
      )}
    </Modal>
  );
}
