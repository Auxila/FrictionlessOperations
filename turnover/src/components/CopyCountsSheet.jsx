/* ============================================================================
 * COPY EXPECTED COUNTS
 *
 * Setting par levels across 69 assets is the slow part of standing a property
 * up, and a block of identical units shares them. Set them once, push them to
 * the rest. Only the expected quantities travel — the targets keep their own
 * counts and audit state.
 * ========================================================================= */

import React, { useState } from 'react';
import { Check } from 'lucide-react';

import { ALL_ITEMS } from '../inventory.js';
import { getItem } from '../store.js';
import { Modal, btn } from '../ui.jsx';

export function CopyCountsSheet({ source, properties, onClose, onApply }) {
  const [selected, setSelected] = useState([]);
  const targets = properties.filter((p) => p.id !== source.id);

  const parCount = ALL_ITEMS.filter((item) => getItem(source, item.id).expected).length;
  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Modal title="Copy expected counts" subtitle={`From ${source.name}`} onClose={onClose} wide>
      {parCount === 0 ? (
        <p className="py-6 text-center text-sm leading-relaxed text-slate-400">
          <span className="font-mono font-bold text-slate-100">{source.name}</span> has no expected
          quantities set yet.
          <br />
          <span className="font-mono text-[11px] uppercase tracking-wider text-slate-600">
            Open an asset and set “Expected qty” first
          </span>
        </p>
      ) : targets.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          There is only one property — nowhere to copy to yet.
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm leading-relaxed text-slate-400">
            Copies <span className="font-bold text-slate-200">{parCount}</span> expected quantities
            onto the properties you pick. Their counts and verifications are left untouched.
          </p>

          <ul className="mb-4 max-h-[38dvh] overflow-y-auto rounded-lg border border-slate-800">
            {targets.map((p) => {
              const on = selected.includes(p.id);
              return (
                <li key={p.id} className="border-b border-slate-800 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    role="checkbox"
                    aria-checked={on}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-slate-800/50"
                  >
                    <span
                      className={[
                        'grid h-6 w-6 shrink-0 place-items-center rounded border-2 transition-colors',
                        on ? 'border-green-400 bg-green-400 text-slate-950' : 'border-slate-600',
                      ].join(' ')}
                    >
                      {on && <Check size={15} strokeWidth={3.5} aria-hidden="true" />}
                    </span>
                    <span className="truncate text-[15px] font-medium text-slate-200">{p.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelected(selected.length === targets.length ? [] : targets.map((p) => p.id))}
              className={btn.ghost}
            >
              {selected.length === targets.length ? 'None' : 'All'}
            </button>
            <button
              type="button"
              disabled={!selected.length}
              onClick={() => onApply(source.id, selected)}
              className={btn.primary}
            >
              Copy to {selected.length || ''}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
