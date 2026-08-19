/* ============================================================================
 * ASSET ROW — one line of the checklist and everything it can capture.
 * ========================================================================= */

import React, { useState } from 'react';
import { AlertTriangle, Camera, Check, ChevronDown, ChevronRight } from 'lucide-react';

import { FIELD_LABELS } from '../inventory.js';
import { DEFICIT, PENDING, VERIFIED } from '../store.js';
import { Field } from '../ui.jsx';
import { PhotoStrip } from './PhotoStrip.jsx';

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

export function AssetRow({
  item, state, propertyId, photosEnabled, busyPhotos,
  onPatch, onCapture, onRemovePhoto, onOpenPhoto,
}) {
  const verified = state.status === VERIFIED;
  const deficit = state.status === DEFICIT;
  const engaged = state.status !== PENDING;
  const set = (key) => (value) => onPatch({ [key]: value });

  const capturable = Boolean(item.qty || item.condition || item.fields || photosEnabled);
  /* Ticking "present" should cost one tap, so the capture panel only opens by
   * itself where the data is the point: a deficit needs its note and evidence,
   * and the appliances exist in the checklist to have their serials read off.
   * Anything else is one chevron away. A manual toggle wins over the default. */
  const autoOpen = deficit || (verified && Boolean(item.fields));
  const [override, setOverride] = useState(null);
  const open = engaged && (override ?? autoOpen);

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

        {!open && (
          <span className="flex shrink-0 items-center gap-1">
            {state.qty ? (
              <span className="rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 font-mono text-[11px] text-slate-400">
                ×{state.qty}
              </span>
            ) : null}
            {state.photos.length > 0 && (
              <span
                aria-label={`${state.photos.length} photo${state.photos.length > 1 ? 's' : ''} attached`}
                className="flex items-center gap-0.5 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 font-mono text-[11px] text-slate-400"
              >
                <Camera size={10} strokeWidth={2.4} aria-hidden="true" />
                {state.photos.length}
              </span>
            )}
          </span>
        )}

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
        <p className="truncate px-3 pb-2.5 pl-14 font-mono text-[11px] text-red-400/80">{state.note}</p>
      )}

      {/* Capture panel. The deficit note is gated on DEFICIT specifically —
          that is the "hidden field" reveal. */}
      {open && (
        <div id={`${item.id}-capture`} className="grid grid-cols-2 gap-2.5 px-3 pb-3.5 pl-14">
          {item.qty && (
            <Field
              id={`${item.id}-qty`} label="Quantity" mono inputMode="numeric" placeholder="0"
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
                  placeholder="e.g. Missing 2 forks / Stove scratched on left burner"
                  className="w-full resize-y rounded-md border border-red-500/40 bg-red-950/30 px-3 py-2.5 text-sm text-red-50 placeholder:text-red-300/40 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
                />
              </label>
              {/* Replacement value is what turns a list of gripes into a
                  defensible number on a deposit claim. */}
              <Field
                id={`${item.id}-cost`} label="Replacement $" mono inputMode="decimal"
                placeholder="0.00" value={state.cost} onChange={set('cost')}
              />
            </>
          )}

          {photosEnabled && (
            <PhotoStrip
              propertyId={propertyId}
              itemId={item.id}
              label={item.label}
              photoIds={state.photos}
              busy={busyPhotos}
              onCapture={(files) => onCapture(item.id, files)}
              onRemove={(photoId) => onRemovePhoto(item.id, photoId)}
              onOpen={(index) => onOpenPhoto(item.id, item.label, state.photos, index)}
            />
          )}
        </div>
      )}
    </li>
  );
}
