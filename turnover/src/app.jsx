/* ============================================================================
 * PROPERTY TURNOVER MATRIX
 * Field-audit console for inventorying real-estate units on turnover day.
 * ========================================================================= */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertTriangle, BedDouble, Check, ChevronDown, ChevronRight, CookingPot, Download, Layers,
  Plus, Refrigerator, RotateCcw, ShowerHead, Sofa, Soup, Sun, Trash2, Utensils,
  UtensilsCrossed, WashingMachine, Waves, X,
} from 'lucide-react';

import { SECTORS, FIELD_LABELS } from './inventory.js';
import {
  DEFICIT, EMPTY_ITEM, PENDING, VERIFIED, computeStats, defaultState,
  downloadCSV, getItem, isBlank, loadState, makeProperty, phaseOf, probeStorage,
  saveState, sectorStats,
} from './store.js';

const SECTOR_ICONS = {
  Refrigerator, CookingPot, Soup, UtensilsCrossed, Utensils, Sofa, BedDouble,
  Layers, ShowerHead, WashingMachine, Sun, Waves,
};

/* Status advances on a single tap: unengaged -> verified -> deficit -> unengaged.
 * Un-checking a verified asset therefore lands on DEFICIT, which is what
 * reveals the deficit-note field. */
const NEXT_STATUS = { [PENDING]: VERIFIED, [VERIFIED]: DEFICIT, [DEFICIT]: PENDING };

/* ── Primitives ─────────────────────────────────────────────────────────── */

function StatusBox({ status, onClick, label }) {
  const verified = status === VERIFIED;
  const deficit = status === DEFICIT;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={verified ? 'true' : deficit ? 'mixed' : 'false'}
      aria-label={`${label} — ${verified ? 'verified' : deficit ? 'deficit logged' : 'not verified'}. Activate to advance.`}
      onClick={onClick}
      className={[
        // 28px visual box inside a 48px touch target — comfortably past the
        // 24px floor and past the 44px accessible-tap-target guidance.
        'grid h-12 w-12 shrink-0 place-items-center rounded-lg transition-colors',
        'active:scale-95 motion-safe:transition-transform',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70',
      ].join(' ')}
    >
      <span
        className={[
          'grid h-7 w-7 place-items-center rounded-md border-2 transition-all duration-150',
          verified
            ? 'border-green-400 bg-green-400 text-slate-950 shadow-[0_0_0_4px_rgba(74,222,128,0.18)]'
            : deficit
              ? 'border-red-400 bg-red-500 text-white shadow-[0_0_0_4px_rgba(248,113,113,0.18)]'
              : 'border-slate-600 bg-slate-950',
        ].join(' ')}
      >
        {verified && <Check size={18} strokeWidth={3.5} aria-hidden="true" />}
        {deficit && <AlertTriangle size={16} strokeWidth={3} aria-hidden="true" />}
      </span>
    </button>
  );
}

function Field({ id, label, value, onChange, mono = false, placeholder = '', wide = false }) {
  return (
    <label htmlFor={id} className={wide ? 'col-span-2 block' : 'block'}>
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <input
        id={id}
        type="text"
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

/* ── Asset row ──────────────────────────────────────────────────────────── */

function AssetRow({ item, state, onPatch }) {
  const verified = state.status === VERIFIED;
  const deficit = state.status === DEFICIT;
  const engaged = state.status !== PENDING;
  const set = (key) => (value) => onPatch({ [key]: value });

  const capturable = Boolean(item.qty || item.condition || item.fields);
  /* Ticking "present" should cost one tap, so the capture panel only opens by
   * itself where the data is the point: a deficit needs its note, and the
   * appliances exist in the checklist to have their serials read off. Anything
   * else is one chevron away. A manual toggle wins over the default. */
  const autoOpen = deficit || (verified && Boolean(item.fields));
  const [override, setOverride] = useState(null);
  const open = engaged && (override ?? autoOpen);

  return (
    <li
      className={[
        'border-b border-slate-800/70 last:border-b-0 transition-colors',
        deficit ? 'bg-red-950/25' : verified ? 'bg-green-950/10' : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-1 pl-1 pr-2">
        <StatusBox
          status={state.status}
          label={item.label}
          onClick={() => onPatch({ status: NEXT_STATUS[state.status] })}
        />
        {/* The label is part of the tap target: thumbs miss small boxes. */}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => onPatch({ status: NEXT_STATUS[state.status] })}
          className="flex min-w-0 flex-1 flex-col items-start py-3 pr-1 text-left"
        >
          <span
            className={[
              'text-[15px] font-medium leading-tight',
              verified ? 'text-slate-300' : deficit ? 'text-red-200' : 'text-slate-200',
            ].join(' ')}
          >
            {item.label}
          </span>
          {item.hint && (
            <span className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
              {item.hint}
            </span>
          )}
        </button>

        {state.qty && !open ? (
          <span className="shrink-0 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 font-mono text-[11px] text-slate-400">
            ×{state.qty}
          </span>
        ) : null}

        {engaged && capturable && (
          <button
            type="button"
            onClick={() => setOverride(!open)}
            aria-expanded={open}
            aria-controls={`${item.id}-capture`}
            aria-label={`${open ? 'Hide' : 'Show'} capture fields for ${item.label}`}
            className="grid h-11 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition-colors hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
          >
            {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
          </button>
        )}

        <button
          type="button"
          onClick={() => onPatch({ status: deficit ? PENDING : DEFICIT })}
          aria-label={deficit ? `Clear deficit on ${item.label}` : `Flag deficit on ${item.label}`}
          aria-pressed={deficit}
          className={[
            'grid h-11 w-9 shrink-0 place-items-center rounded-md transition-colors',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70',
            deficit ? 'text-red-400' : 'text-slate-600 hover:text-red-400',
          ].join(' ')}
        >
          <AlertTriangle size={17} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>

      {/* A collapsed deficit still has to read at a glance during a walkthrough. */}
      {deficit && !open && state.note && (
        <p className="truncate px-3 pb-2.5 pl-14 font-mono text-[11px] text-red-400/80">
          {state.note}
        </p>
      )}

      {/* Capture panel. The deficit note is gated on DEFICIT specifically —
          that is the "hidden field" reveal. */}
      {open && (
        <div id={`${item.id}-capture`} className="grid grid-cols-2 gap-2.5 px-3 pb-3.5 pl-14">
          {item.qty && (
            <Field
              id={`${item.id}-qty`} label="Quantity" mono placeholder="0"
              value={state.qty} onChange={set('qty')}
            />
          )}
          {item.condition && (
            <Field
              id={`${item.id}-condition`} label="Condition" wide={!item.qty}
              placeholder="Rust, stains, wear…"
              value={state.condition} onChange={set('condition')}
            />
          )}
          {item.fields?.map((f) => (
            <Field
              key={f}
              id={`${item.id}-${f}`}
              label={FIELD_LABELS[f]}
              mono={f !== 'brand'}
              wide={f === 'serial'}
              placeholder={f === 'brand' ? 'Manufacturer' : '—'}
              value={state[f]}
              onChange={set(f)}
            />
          ))}
          {deficit && (
            <label htmlFor={`${item.id}-note`} className="col-span-2 block">
              <span className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-red-400">
                <AlertTriangle size={11} strokeWidth={2.5} aria-hidden="true" />
                Deficit Log
              </span>
              <textarea
                id={`${item.id}-note`}
                rows={2}
                value={state.note}
                onChange={(e) => onPatch({ note: e.target.value })}
                placeholder="e.g. Missing 2 forks / Stove scratched on left burner"
                className="w-full resize-y rounded-md border border-red-500/40 bg-red-950/30 px-3 py-2.5 text-sm text-red-50 placeholder:text-red-300/40 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
              />
            </label>
          )}
        </div>
      )}
    </li>
  );
}

/* ── Sector ─────────────────────────────────────────────────────────────── */

function Sector({ sector, property, onPatch }) {
  const stats = sectorStats(property, sector);
  const Icon = SECTOR_ICONS[sector.icon];
  const complete = stats.verified === stats.total;

  return (
    <section style={{ '--accent': sector.accent }} className="mb-3">
      {/* Locked header: the operative always knows which room they are in. */}
      <header className="sticky top-0 z-20 flex items-center gap-2.5 border-y border-slate-800 bg-slate-900/95 px-3 py-2.5 backdrop-blur-md">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[rgb(var(--accent)/0.14)] text-[rgb(var(--accent))]">
          {Icon && <Icon size={17} strokeWidth={2.2} aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold uppercase tracking-[0.1em] text-slate-100">
            {sector.name}
          </h2>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
            {sector.zone}
          </p>
        </div>
        {stats.deficit > 0 && (
          <span className="rounded border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-red-400">
            {stats.deficit} DEF
          </span>
        )}
        <span
          className={[
            'rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums',
            complete
              ? 'border-green-500/40 bg-green-500/10 text-green-400'
              : 'border-slate-700 bg-slate-950 text-slate-400',
          ].join(' ')}
        >
          {stats.verified}/{stats.total}
        </span>
      </header>

      <ul className="border-b border-slate-800 bg-slate-900">
        {sector.items.map((item) => (
          <AssetRow
            key={item.id}
            item={item}
            state={getItem(property, item.id)}
            onPatch={(patch) => onPatch(item.id, patch)}
          />
        ))}
      </ul>
    </section>
  );
}

/* ── Modal ──────────────────────────────────────────────────────────────── */

function Modal({ title, tone = 'slate', onClose, children }) {
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
          'w-full max-w-md rounded-t-2xl border bg-slate-900 p-5 shadow-2xl sm:rounded-2xl',
          tone === 'danger' ? 'border-red-500/40' : 'border-slate-700',
        ].join(' ')}
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2
            className={[
              'text-base font-bold uppercase tracking-[0.1em]',
              tone === 'danger' ? 'text-red-400' : 'text-slate-100',
            ].join(' ')}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-slate-800 hover:text-slate-200"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const btn = {
  primary:
    'flex-1 rounded-lg bg-slate-100 px-4 py-3 text-sm font-bold uppercase tracking-wider text-slate-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500',
  danger:
    'flex-1 rounded-lg bg-red-600 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500',
  ghost:
    'rounded-lg border border-slate-700 px-4 py-3 text-sm font-bold uppercase tracking-wider text-slate-300 transition-colors hover:bg-slate-800',
};

const input =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-base text-slate-100 placeholder:text-slate-600 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400';

/* A destructive action is only unlocked by typing the exact keyword. */
function ConfirmPhrase({ phrase, prompt, action, onConfirm, onClose }) {
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

/* ── App ────────────────────────────────────────────────────────────────── */

function App() {
  const [state, setState] = useState(loadState);
  const [modal, setModal] = useState(null);
  const [newName, setNewName] = useState('');
  const [toast, setToast] = useState(null);
  const [storageOK] = useState(probeStorage);
  const scrollRef = useRef(null);

  /* Absolute persistence: every state transition is written through
   * synchronously after paint — no debounce, no unsaved window. */
  useEffect(() => {
    saveState(state);
  }, [state]);

  const property =
    state.properties.find((p) => p.id === state.activeId) || state.properties[0];
  const stats = useMemo(() => computeStats(property), [property]);
  const phase = phaseOf(stats);

  const toastTimer = useRef(0);
  const flash = useCallback((message) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const patchItem = useCallback((itemId, patch) => {
    setState((prev) => {
      const now = new Date().toISOString();
      return {
        ...prev,
        properties: prev.properties.map((p) => {
          if (p.id !== prev.activeId) return p;
          const current = { ...EMPTY_ITEM, ...(p.items[itemId] || {}) };
          const next = { ...current, ...patch };
          if ('status' in patch && patch.status !== current.status) next.updatedAt = now;
          const items = { ...p.items };
          /* Prune records that carry nothing so saves stay lean. */
          if (isBlank(next)) delete items[itemId];
          else items[itemId] = next;
          return { ...p, items, updatedAt: now };
        }),
      };
    });
  }, []);

  const selectProperty = (id) => {
    setState((prev) => ({ ...prev, activeId: id }));
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  const createProperty = () => {
    const created = makeProperty(newName || `Unit ${String(state.properties.length + 1).padStart(2, '0')}`);
    setState((prev) => ({ ...prev, activeId: created.id, properties: [...prev.properties, created] }));
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setNewName('');
    setModal(null);
    flash(`${created.name} provisioned — ${stats.total} assets unverified`);
  };

  const resetProperty = () => {
    setState((prev) => ({
      ...prev,
      properties: prev.properties.map((p) =>
        p.id === prev.activeId ? { ...p, items: {}, updatedAt: new Date().toISOString() } : p
      ),
    }));
    setModal(null);
    flash('Checklist wiped to zero');
  };

  const deleteProperty = () => {
    setState((prev) => {
      const remaining = prev.properties.filter((p) => p.id !== prev.activeId);
      if (!remaining.length) return defaultState();
      return { ...prev, activeId: remaining[0].id, properties: remaining };
    });
    setModal(null);
    flash('Property profile purged');
  };

  const exportCSV = () => {
    downloadCSV(property);
    flash(`Extracted ${stats.total} rows → CSV`);
  };

  /* Mobile-first, but capped so the console reads as a device panel on a
   * tablet or desktop instead of a 2000px-wide row of stranded checkboxes. */
  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-xl flex-col overflow-hidden border-slate-800 bg-slate-950 text-slate-200 sm:border-x">
      {/* ── Command header ─────────────────────────────────────────────── */}
      <header
        style={{ '--phase': phase.rgb }}
        className="z-30 shrink-0 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md"
      >
        <div style={{ paddingTop: 'env(safe-area-inset-top)' }} />
        <div className="flex items-center justify-between gap-3 px-3 pt-2.5">
          <div className="min-w-0">
            <h1 className="truncate text-[13px] font-bold uppercase tracking-[0.22em] text-slate-100">
              Turnover Matrix
            </h1>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-500">
              Frictionless Operations
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-[rgb(var(--phase)/0.4)] bg-[rgb(var(--phase)/0.12)] px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--phase))]" aria-hidden="true" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[rgb(var(--phase))]">
              {phase.label}
            </span>
          </span>
        </div>

        {/* Multi-node selector */}
        <div className="flex items-stretch gap-2 px-3 pt-2.5">
          <div className="relative min-w-0 flex-1">
            <select
              aria-label="Active property"
              value={property.id}
              onChange={(e) => selectProperty(e.target.value)}
              className="w-full appearance-none truncate rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-3 pr-9 text-sm font-semibold text-slate-100 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
            >
              {state.properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
          </div>
          <button
            type="button"
            onClick={() => setModal('new')}
            aria-label="Add property profile"
            className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-950 transition-colors hover:bg-white active:scale-95"
          >
            <Plus size={22} strokeWidth={2.8} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setModal('delete')}
            aria-label="Delete active property profile"
            className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-lg border border-slate-700 text-slate-500 transition-colors hover:border-red-500/50 hover:text-red-400"
          >
            <Trash2 size={17} aria-hidden="true" />
          </button>
        </div>

        {/* Metric validation */}
        <div className="px-3 pb-3 pt-2.5">
          <div className="mb-1.5 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.14em]">
            <span className="text-slate-500">
              <span className="font-bold text-slate-200">{stats.verified}</span>
              <span className="text-slate-600"> / {stats.total} verified</span>
              {stats.deficit > 0 && (
                <span className="ml-2 font-bold text-red-400">{stats.deficit} deficit</span>
              )}
            </span>
            <span className="text-[13px] font-bold tabular-nums text-[rgb(var(--phase))]">
              {stats.percent}%
            </span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-slate-800"
            role="progressbar"
            aria-valuenow={stats.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Verification progress"
          >
            <div
              className="h-full rounded-full bg-[rgb(var(--phase))] transition-[width,background-color] duration-300 ease-out"
              style={{ width: `${stats.percent}%` }}
            />
          </div>
        </div>
      </header>

      {/* ── Audit surface ──────────────────────────────────────────────── */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
        {!storageOK && (
          <p className="m-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-300">
            Local storage is blocked by this browser (private mode?). The audit still works,
            but nothing will survive a refresh — export to CSV before you close this tab.
          </p>
        )}

        {SECTORS.map((sector) => (
          <Sector key={sector.id} sector={sector} property={property} onPatch={patchItem} />
        ))}

        <p className="px-4 pb-6 pt-1 text-center font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-slate-600">
          {stats.total} assets · {stats.pending} unaudited
          <br />
          Saved locally on this device
        </p>
      </main>

      {/* ── Action bar ─────────────────────────────────────────────────── */}
      <div
        className="z-30 shrink-0 border-t border-slate-800 bg-slate-900 px-3 pt-2.5"
        style={{ paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportCSV}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-100 py-3.5 text-sm font-bold uppercase tracking-[0.1em] text-slate-950 transition-colors hover:bg-white active:scale-[0.98]"
          >
            <Download size={17} strokeWidth={2.5} aria-hidden="true" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setModal('reset')}
            aria-label="Reset this checklist"
            className="grid w-[52px] shrink-0 place-items-center rounded-lg border border-slate-700 text-slate-400 transition-colors hover:border-red-500/50 hover:bg-red-950/40 hover:text-red-400"
          >
            <RotateCcw size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ── Overlays ───────────────────────────────────────────────────── */}
      {toast && (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4"
        >
          <p className="rounded-full border border-slate-700 bg-slate-800/95 px-4 py-2 text-center font-mono text-[11px] uppercase tracking-wider text-slate-200 shadow-xl backdrop-blur">
            {toast}
          </p>
        </div>
      )}

      {modal === 'new' && (
        <Modal title="New Property Node" onClose={() => setModal(null)}>
          <p className="mb-4 text-sm leading-relaxed text-slate-400">
            Clones the master checklist — {stats.total} assets across {SECTORS.length} sectors —
            into a fresh, fully unverified profile.
          </p>
          <label className="mb-4 block">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
              Property identifier
            </span>
            <input
              autoFocus
              type="text"
              value={newName}
              maxLength={60}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createProperty()}
              placeholder={`Unit ${String(state.properties.length + 1).padStart(2, '0')}`}
              className={input}
            />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setModal(null)} className={btn.ghost}>
              Cancel
            </button>
            <button type="button" onClick={createProperty} className={btn.primary}>
              Provision
            </button>
          </div>
        </Modal>
      )}

      {modal === 'reset' && (
        <Modal title="Nuclear Reset" tone="danger" onClose={() => setModal(null)}>
          <ConfirmPhrase
            phrase="RESET"
            action="Wipe checklist"
            onConfirm={resetProperty}
            onClose={() => setModal(null)}
            prompt={
              <>
                <p>
                  This clears every verification, quantity, serial number and deficit note on{' '}
                  <span className="font-mono font-bold text-slate-100">{property.name}</span>.
                </p>
                <p className="text-slate-400">
                  {stats.verified} verified and {stats.deficit} deficit records will be destroyed.
                  Other properties are untouched. This cannot be undone.
                </p>
              </>
            }
          />
        </Modal>
      )}

      {modal === 'delete' && (
        <Modal title="Purge Property" tone="danger" onClose={() => setModal(null)}>
          <ConfirmPhrase
            phrase="DELETE"
            action="Purge profile"
            onConfirm={deleteProperty}
            onClose={() => setModal(null)}
            prompt={
              <>
                <p>
                  Permanently removes the profile{' '}
                  <span className="font-mono font-bold text-slate-100">{property.name}</span> and
                  all of its audit data.
                </p>
                <p className="text-slate-400">
                  {state.properties.length === 1
                    ? 'This is your last profile — a blank one will be provisioned in its place.'
                    : `${state.properties.length - 1} other propert${state.properties.length === 2 ? 'y' : 'ies'} will remain.`}
                </p>
              </>
            }
          />
        </Modal>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);

/* Offline shell — a field operative in a basement with no signal still needs
 * the console to boot. Registration is best-effort and never blocks the app. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
