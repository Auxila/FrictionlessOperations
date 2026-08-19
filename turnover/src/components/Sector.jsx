/* ============================================================================
 * SECTOR — a room's worth of assets under a header that stays locked to the
 * top of the scroll area while you work through it.
 * ========================================================================= */

import React from 'react';
import {
  BedDouble, CheckCheck, ChevronDown, ChevronRight, CookingPot, Layers, Refrigerator,
  ShowerHead, Sofa, Soup, Sun, Utensils, UtensilsCrossed, WashingMachine, Waves,
} from 'lucide-react';

import { PENDING, getItem, sectorStats } from '../store.js';
import { AssetRow } from './AssetRow.jsx';

const SECTOR_ICONS = {
  Refrigerator, CookingPot, Soup, UtensilsCrossed, Utensils, Sofa, BedDouble,
  Layers, ShowerHead, WashingMachine, Sun, Waves,
};

export function Sector({
  sector, property, items, collapsed, photosEnabled, busyItemId,
  onPatch, onToggleCollapse, onVerifyAll, onCapture, onRemovePhoto, onOpenPhoto,
}) {
  const stats = sectorStats(property, sector);
  const Icon = SECTOR_ICONS[sector.icon];
  const complete = stats.verified === stats.total;
  const pendingCount = sector.items.filter(
    (i) => getItem(property, i.id).status === PENDING
  ).length;

  return (
    <section style={{ '--accent': sector.accent }} className="mb-3">
      {/* Locked header: the operative always knows which room they are in. */}
      <header className="sticky top-0 z-20 flex items-center gap-2 border-y border-slate-800 bg-slate-900/95 px-2 py-2.5 backdrop-blur-md">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${sector.name}`}
          className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[rgb(var(--accent)/0.14)] text-[rgb(var(--accent))]">
            {Icon && <Icon size={17} strokeWidth={2.2} aria-hidden="true" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              {collapsed ? (
                <ChevronRight size={13} aria-hidden="true" className="shrink-0 text-slate-500" />
              ) : (
                <ChevronDown size={13} aria-hidden="true" className="shrink-0 text-slate-500" />
              )}
              <span className="truncate text-sm font-bold uppercase tracking-[0.1em] text-slate-100">
                {sector.name}
              </span>
            </span>
            <span className="block pl-[19px] font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
              {sector.zone}
            </span>
          </span>
        </button>

        {/* Whole rooms are routinely fine. Nine taps to say so is nine taps
            an operative will skip, and a skipped room is an unaudited one. */}
        {pendingCount > 0 && (
          <button
            type="button"
            onClick={onVerifyAll}
            aria-label={`Verify all ${pendingCount} remaining assets in ${sector.name}`}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-slate-700 text-slate-400 transition-colors hover:border-green-500/50 hover:bg-green-950/30 hover:text-green-400"
          >
            <CheckCheck size={16} aria-hidden="true" />
          </button>
        )}

        {stats.deficit > 0 && (
          <span className="shrink-0 rounded border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-red-400">
            {stats.deficit}
          </span>
        )}
        <span
          className={[
            'shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums',
            complete
              ? 'border-green-500/40 bg-green-500/10 text-green-400'
              : 'border-slate-700 bg-slate-950 text-slate-400',
          ].join(' ')}
        >
          {stats.verified}/{stats.total}
        </span>
      </header>

      {!collapsed && (
        <ul className="border-b border-slate-800 bg-slate-900">
          {items.map((item) => (
            <AssetRow
              key={item.id}
              item={item}
              state={getItem(property, item.id)}
              propertyId={property.id}
              photosEnabled={photosEnabled}
              busyPhotos={busyItemId === item.id}
              onPatch={(patch) => onPatch(item.id, patch)}
              onCapture={onCapture}
              onRemovePhoto={onRemovePhoto}
              onOpenPhoto={onOpenPhoto}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
