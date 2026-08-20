/* ============================================================================
 * SHARED PRIMITIVES
 * Modal shells, button/input recipes, and the labelled text field every
 * capture panel is built from.
 * ========================================================================= */

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export const btn = {
  primary:
    'flex-1 rounded-lg bg-slate-100 px-4 py-3 text-sm font-bold uppercase tracking-wider text-slate-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500',
  danger:
    'flex-1 rounded-lg bg-red-600 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500',
  ghost:
    'rounded-lg border border-slate-700 px-4 py-3 text-sm font-bold uppercase tracking-wider text-slate-300 transition-colors hover:bg-slate-800',
};

export const input =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-base text-slate-100 placeholder:text-slate-600 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400';

export function Modal({ title, subtitle, tone = 'slate', onClose, children, flush = false, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={[
          'flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border bg-slate-900 shadow-2xl sm:rounded-2xl',
          wide ? 'max-w-lg' : 'max-w-md',
          tone === 'danger' ? 'border-red-500/40' : 'border-slate-700',
        ].join(' ')}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div
          className={`flex shrink-0 items-start justify-between gap-3 ${
            flush ? 'border-b border-slate-800 px-4 py-3.5' : 'px-5 pb-4 pt-5'
          }`}
        >
          <div className="min-w-0">
            <h2
              className={[
                'text-base font-bold uppercase tracking-[0.1em]',
                tone === 'danger' ? 'text-red-400' : 'text-slate-100',
              ].join(' ')}
            >
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-slate-800 hover:text-slate-200"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto ${flush ? '' : 'px-5 pb-5'}`}>{children}</div>
      </div>
    </div>
  );
}

export function Field({ id, label, value, onChange, mono = false, placeholder = '', wide = false, inputMode }) {
  return (
    <label htmlFor={id} className={wide ? 'col-span-2 block' : 'block'}>
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <input
        id={id}
        type="text"
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={[
          'w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100',
          'placeholder:text-slate-600 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500',
          mono ? 'font-mono tracking-wide' : '',
        ].join(' ')}
      />
    </label>
  );
}

/* A destructive action is only unlocked by typing the exact keyword. */
export function ConfirmPhrase({ phrase, prompt, action, onConfirm, onClose }) {
  const [typed, setTyped] = useState('');
  const armed = typed.trim().toUpperCase() === phrase;
  return (
    <>
      <div className="mb-4 space-y-2 text-sm leading-relaxed text-slate-300">{prompt}</div>
      <label className="mb-4 block">
        <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
          Type <span className="font-bold text-red-400">{phrase}</span> to authorize
        </span>
        <input
          autoFocus
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && armed && onConfirm()}
          placeholder={phrase}
          spellCheck={false}
          autoCapitalize="characters"
          className={`${input} font-mono tracking-[0.2em]`}
        />
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className={btn.ghost}>
          Cancel
        </button>
        <button type="button" disabled={!armed} onClick={onConfirm} className={btn.danger}>
          {action}
        </button>
      </div>
    </>
  );
}
