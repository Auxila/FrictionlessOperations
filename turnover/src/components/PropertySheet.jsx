/* ============================================================================
 * PROPERTY ROSTER — switch, rename, duplicate, purge, and see at a glance
 * which units still need a walkthrough.
 * ========================================================================= */

import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, Ellipsis, Pencil, Plus, Search, Trash2 } from 'lucide-react';

import { computeStats, phaseOf, relativeTime } from '../store.js';
import { Modal, btn, input } from '../ui.jsx';

/* ── Property roster ────────────────────────────────────────────────────── */

/* One row per property: name, live progress, deficit count, staleness, and an
 * overflow strip for rename / duplicate / delete. Replaces the native <select>,
 * which could only ever show a name — useless for deciding which of eleven
 * units still needs a walkthrough. */
function PropertyRow({ property, active, expanded, onSelect, onExpand, onRename, onDuplicate, onDelete, rowRef }) {
  const stats = computeStats(property);
  const phase = phaseOf(stats);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(property.name);

  const commitRename = () => {
    const next = draft.trim();
    if (next && next !== property.name) onRename(next);
    setRenaming(false);
  };

  if (renaming) {
    return (
      <li className="border-b border-slate-800 bg-slate-950/60 p-3">
        <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
          Rename property
        </label>
        <div className="flex gap-2">
          <input
            autoFocus
            type="text"
            value={draft}
            maxLength={60}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') { setDraft(property.name); setRenaming(false); }
            }}
            className={input}
          />
          <button
            type="button"
            onClick={commitRename}
            aria-label="Save name"
            className="grid w-12 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-950 hover:bg-white"
          >
            <Check size={18} strokeWidth={3} aria-hidden="true" />
          </button>
        </div>
      </li>
    );
  }

  return (
    <li ref={rowRef} className={`border-b border-slate-800 ${active ? 'bg-slate-800/40' : ''}`}>
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onSelect}
          style={{ '--phase': phase.rgb }}
          aria-label={`Switch to ${property.name} — ${stats.percent}% verified, ${stats.deficit} deficit`}
          aria-current={active ? 'true' : undefined}
          className="min-w-0 flex-1 px-3 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" aria-hidden="true" />}
            <span className={`truncate text-[15px] font-semibold ${active ? 'text-white' : 'text-slate-200'}`}>
              {property.name}
            </span>
            <span className="ml-auto shrink-0 font-mono text-[11px] font-bold tabular-nums text-[rgb(var(--phase))]">
              {stats.percent}%
            </span>
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-[rgb(var(--phase))]" style={{ width: `${stats.percent}%` }} />
          </div>
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
            {stats.verified}/{stats.total} verified
            {stats.deficit > 0 && <span className="text-red-400"> · {stats.deficit} deficit</span>}
            <span className="text-slate-600"> · {relativeTime(property.updatedAt)}</span>
          </p>
        </button>
        <button
          type="button"
          onClick={onExpand}
          aria-expanded={expanded}
          aria-label={`Actions for ${property.name}`}
          className="grid w-11 shrink-0 place-items-center border-l border-slate-800/70 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
        >
          <Ellipsis size={18} aria-hidden="true" />
        </button>
      </div>

      {expanded && (
        <div className="grid grid-cols-3 gap-2 px-3 pb-3">
          {[
            { label: 'Rename', icon: Pencil, onClick: () => { setDraft(property.name); setRenaming(true); } },
            { label: 'Duplicate', icon: Copy, onClick: onDuplicate },
            { label: 'Delete', icon: Trash2, onClick: onDelete, danger: true },
          ].map(({ label, icon: Icon, onClick, danger }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              className={[
                'flex flex-col items-center gap-1 rounded-lg border py-2.5 font-mono text-[10px] uppercase tracking-wider transition-colors',
                danger
                  ? 'border-red-500/40 text-red-400 hover:bg-red-950/40'
                  : 'border-slate-700 text-slate-300 hover:bg-slate-800',
              ].join(' ')}
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

export function PropertySheet({ properties, activeId, onClose, onSelect, onNew, onRename, onDuplicate, onDelete, onExportAll }) {
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const activeRef = useRef(null);

  /* With a portfolio of a dozen units the active one can open below the fold,
   * which reads as "my property is gone". Put it on screen immediately. */
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, []);

  /* Search only earns its space once the roster outgrows a glance. */
  const searchable = properties.length > 5;
  const visible = query.trim()
    ? properties.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    : properties;

  return (
    <Modal title={`Properties · ${properties.length}`} onClose={onClose} flush wide>
      {searchable && (
        <div className="relative border-b border-slate-800 p-3">
          <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter properties…"
            aria-label="Filter properties"
            className={`${input} pl-9`}
          />
        </div>
      )}

      <ul className="max-h-[45dvh] overflow-y-auto">
        {visible.map((p) => (
          <PropertyRow
            key={p.id}
            property={p}
            active={p.id === activeId}
            expanded={expandedId === p.id}
            onSelect={() => onSelect(p.id)}
            onExpand={() => setExpandedId(expandedId === p.id ? null : p.id)}
            onRename={(name) => onRename(p.id, name)}
            onDuplicate={() => onDuplicate(p.id)}
            onDelete={() => onDelete(p.id)}
            rowRef={p.id === activeId ? activeRef : undefined}
          />
        ))}
        {!visible.length && (
          <li className="px-3 py-8 text-center font-mono text-[11px] uppercase tracking-wider text-slate-500">
            No property matches “{query}”
          </li>
        )}
      </ul>

      <div className="flex gap-2 border-t border-slate-800 p-3">
        <button type="button" onClick={onNew} className={`${btn.primary} flex items-center justify-center gap-2`}>
          <Plus size={17} strokeWidth={3} aria-hidden="true" />
          New
        </button>
        <button
          type="button"
          onClick={onExportAll}
          disabled={properties.length < 2}
          aria-label={`Export all ${properties.length} properties to one CSV`}
          className={`${btn.ghost} flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <Download size={16} aria-hidden="true" />
          Export all
        </button>
      </div>
    </Modal>
  );
}
