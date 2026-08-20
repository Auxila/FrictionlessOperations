/* ============================================================================
 * ASSET ROW — one line of the checklist and everything it can capture.
 * ========================================================================= */

import React, { useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronRight, Minus, Plus } from 'lucide-react';

import { FIELD_LABELS } from '../inventory.js';
import { DEFICIT, PENDING, VERIFIED, formatMoney, hasPar, parseCount, shortfall, suggestedCost } from '../store.js';
import { Field } from '../ui.jsx';

/* Status advances on a single tap: unengaged -> verified -> deficit -> unengaged.
 * Un-checking a verified asset therefore lands on DEFICIT, which is what
 * reveals the deficit-note field. */
const NEXT_STATUS = { [PENDING]: VERIFIED, [VERIFIED]: DEFICIT, [DEFICIT]: PENDING };

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

/* The counter gets its own line rather than squeezing into the main row: at
 * 320px a stepper beside the label leaves nothing for the label, and counting
 * is the primary action on these assets, not a secondary one. */
function CountRow({ item, state, onCount }) {
  const expected = parseCount(state.expected) || 0;
  const counted = parseCount(state.counted);
  const short = shortfall(state);
  const step = (delta) => onCount(String(Math.max(0, (counted ?? 0) + delta)));

  return (
    <div className="flex items-center gap-1.5 pb-3 pl-14 pr-3">
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={!counted}
        aria-label={`One fewer ${item.label}`}
        className="grid h-10 w-11 shrink-0 place-items-center rounded-l-lg border border-slate-700 bg-slate-950 text-slate-300 transition-colors hover:bg-slate-800 disabled:text-slate-700"
      >
        <Minus size={17} strokeWidth={2.6} aria-hidden="true" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={state.counted}
        onChange={(e) => onCount(e.target.value.replace(/[^0-9]/g, ''))}
        aria-label={`Counted ${item.label}, expected ${expected}`}
        placeholder="0"
        className="-mx-1.5 h-10 w-14 shrink-0 border-y border-slate-700 bg-slate-950 text-center font-mono text-[15px] font-bold text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-400"
      />
      <button
        type="button"
        onClick={() => step(1)}
        aria-label={`One more ${item.label}`}
        className="grid h-10 w-11 shrink-0 place-items-center rounded-r-lg border border-slate-700 bg-slate-950 text-slate-300 transition-colors hover:bg-slate-800"
      >
        <Plus size={17} strokeWidth={2.6} aria-hidden="true" />
      </button>

      <span className="ml-2 min-w-0 font-mono text-[11px] uppercase tracking-[0.1em]">
        <span className="text-slate-500">of {expected}</span>
        {short === null ? (
          <span className="ml-2 text-slate-600">uncounted</span>
        ) : short > 0 ? (
          <span className="ml-2 font-bold text-red-400">short {short}</span>
        ) : (
          <span className="ml-2 font-bold text-green-400">complete</span>
        )}
      </span>
    </div>
  );
}

export function AssetRow({ item, state, onPatch }) {
  const verified = state.status === VERIFIED;
  const deficit = state.status === DEFICIT;
  const counted = hasPar(state);
  const set = (key) => (value) => onPatch({ [key]: value });

  /* Ticking "present" should cost one tap, so the capture panel only opens by
   * itself where the data is the point: a deficit needs its note, and the
   * appliances exist in the checklist to have their serials read off.
   * Everything else — par levels included — is one chevron away. */
  const autoOpen = deficit || (verified && Boolean(item.fields));
  const [override, setOverride] = useState(null);
  const open = override ?? autoOpen;
  const short = shortfall(state);
  const suggestion = suggestedCost(item, state);

  return (
    <li
      id={`row-${item.id}`}
      className={[
        'scroll-mt-2 border-b border-slate-800/70 last:border-b-0 transition-colors',
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

        {/* Always reachable: the par level is set in here, and you set that
            before the asset has been audited, not after. */}
        <button
          type="button"
          onClick={() => setOverride(!open)}
          aria-expanded={open}
          aria-controls={`${item.id}-capture`}
          aria-label={`${open ? 'Hide' : 'Show'} details for ${item.label}`}
          className="grid h-11 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition-colors hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
        >
          {open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
        </button>

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

      {counted && <CountRow item={item} state={state} onCount={set('counted')} />}

      {/* A collapsed deficit still has to read at a glance during a walkthrough. */}
      {deficit && !open && state.note && (
        <p className="truncate px-3 pb-2.5 pl-14 font-mono text-[11px] text-red-400/80">{state.note}</p>
      )}

      {open && (
        <div id={`${item.id}-capture`} className="grid grid-cols-2 gap-2.5 px-3 pb-3.5 pl-14">
          {/* Par level. Setting it turns the row into a counter, which is what
              makes the checklist modular per unit. */}
          <Field
            id={`${item.id}-expected`}
            label="Expected qty"
            mono
            inputMode="numeric"
            placeholder="—"
            value={state.expected}
            onChange={(v) => set('expected')(v.replace(/[^0-9]/g, ''))}
          />
          {!counted && (
            <Field
              id={`${item.id}-counted`} label="Counted" mono inputMode="numeric" placeholder="—"
              value={state.counted}
              onChange={(v) => set('counted')(v.replace(/[^0-9]/g, ''))}
            />
          )}
          {item.condition && (
            <Field
              id={`${item.id}-condition`} label="Condition" wide={counted}
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
            <>
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
                  placeholder={
                    short > 0
                      ? `Short ${short} already recorded — add detail if useful`
                      : 'e.g. Stove scratched on left burner'
                  }
                  className="w-full resize-y rounded-md border border-red-500/40 bg-red-950/30 px-3 py-2.5 text-sm text-red-50 placeholder:text-red-300/40 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
                />
              </label>
              {/* Replacement value is what turns a list of gripes into a
                  defensible number on a deposit claim. Pre-filled from the
                  checklist median; typing over it makes the figure yours. */}
              <div>
                <Field
                  id={`${item.id}-cost`} label="Replacement $" mono inputMode="decimal"
                  placeholder="0.00"
                  value={state.cost}
                  onChange={(v) => onPatch({ cost: v, costAuto: false })}
                />
                {state.costAuto && suggestion && (
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
                    Est. {suggestion.units > 1 ? `${suggestion.units} × ` : ''}
                    {formatMoney(suggestion.unit)}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </li>
  );
}
