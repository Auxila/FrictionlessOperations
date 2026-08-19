/* ============================================================================
 * PROPERTY TURNOVER MATRIX
 * Field-audit console for inventorying real-estate units on turnover day.
 * ========================================================================= */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ChevronDown, ClipboardList, Crosshair, Database, Download, Plus, RotateCcw, Search, Undo2, X,
} from 'lucide-react';

import { ALL_ITEMS, SECTORS } from './inventory.js';
import {
  DEFICIT, EMPTY_ITEM, PENDING, VERIFIED, backupFilename, buildBackup,
  cloneProperty, computeStats, csvFilename, defaultState, deficitReport, downloadCSV,
  downloadCSVAll, downloadText, getItem, isBlank, loadState, makeProperty, parseBackup,
  phaseOf, probeStorage, saveState, statusFromCount,
} from './store.js';
import { buildReport } from './report.js';
import { printDocument } from './print.js';
import { ConfirmPhrase, Modal, btn, input } from './ui.jsx';
import { Sector } from './components/Sector.jsx';
import { CopyCountsSheet } from './components/CopyCountsSheet.jsx';
import { PropertySheet } from './components/PropertySheet.jsx';
import { ReportSheet } from './components/ReportSheet.jsx';
import { BackupSheet } from './components/BackupSheet.jsx';

/* Second-pass views. An operative walks the unit once ticking things off, then
 * wants "what's left" and "what's broken" without scrolling 69 rows. */
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'todo', label: 'To do' },
  { key: 'deficit', label: 'Deficits' },
];

function App() {
  const [state, setState] = useState(loadState);
  const [modal, setModal] = useState(null); // { type, id? }
  const [newName, setNewName] = useState('');
  const [toast, setToast] = useState(null); // { message, undo? }
  const [storageOK] = useState(probeStorage);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [exporting, setExporting] = useState(false);
  const scrollRef = useRef(null);
  const toastTimer = useRef(0);
  /* Holds the previous state plus any blob cleanup a destructive action
   * deferred, so Undo can put everything back. See runPendingCleanup(). */
  const undoRef = useRef(null);

  /* An earlier build kept photo evidence in IndexedDB. That feature is gone;
   * drop the database so removed users are not left carrying its bytes. */
  useEffect(() => {
    try {
      indexedDB?.deleteDatabase('fo.turnover.photos');
    } catch {
      /* nothing to clean up */
    }
  }, []);

  /* Absolute persistence: every state transition is written through
   * synchronously after paint — no debounce, no unsaved window. */
  useEffect(() => {
    saveState(state);
  }, [state]);

  const property =
    state.properties.find((p) => p.id === state.activeId) || state.properties[0];
  const stats = useMemo(() => computeStats(property), [property]);
  const phase = phaseOf(stats);
  const report = useMemo(() => deficitReport(property), [property]);

  /* --- toast + undo --------------------------------------------------- */
  const runPendingCleanup = useCallback(() => {
    const cleanup = undoRef.current?.cleanup;
    undoRef.current = null;
    if (cleanup) cleanup().catch(() => {});
  }, []);

  const flash = useCallback(
    (message, undoable = null) => {
      runPendingCleanup();
      if (undoable) undoRef.current = undoable;
      setToast({ message, undo: Boolean(undoable) });
      window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => {
        setToast(null);
        runPendingCleanup();
      }, undoable ? 7000 : 2600);
    },
    [runPendingCleanup]
  );

  const undo = useCallback(() => {
    const snapshot = undoRef.current;
    undoRef.current = null; // discard the deferred cleanup: the data lives on
    window.clearTimeout(toastTimer.current);
    setToast(null);
    if (snapshot?.state) setState(snapshot.state);
  }, []);

  /* --- asset edits ------------------------------------------------------- */
  const patchItem = useCallback((itemId, patch) => {
    setState((prev) => {
      const now = new Date().toISOString();
      return {
        ...prev,
        properties: prev.properties.map((p) => {
          if (p.id !== prev.activeId) return p;
          const current = { ...EMPTY_ITEM, ...(p.items[itemId] || {}) };
          const next = { ...current, ...patch };
          /* Counting IS the verification. Once a par level exists, the number
           * decides the status, so nobody has to also remember to tick a box
           * — or to type "missing 2 forks" that the app can already see. */
          if (('counted' in patch || 'expected' in patch) && !('status' in patch)) {
            const derived = statusFromCount(next);
            if (derived) next.status = derived;
          }
          if (next.status !== current.status) next.updatedAt = now;
          const items = { ...p.items };
          /* Prune records that carry nothing so saves stay lean. */
          if (isBlank(next)) delete items[itemId];
          else items[itemId] = next;
          return { ...p, items, updatedAt: now };
        }),
      };
    });
  }, []);

  const verifySector = (sector) => {
    const pending = sector.items.filter((i) => getItem(property, i.id).status === PENDING);
    if (!pending.length) return;
    const snapshot = state;
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      properties: prev.properties.map((p) => {
        if (p.id !== prev.activeId) return p;
        const items = { ...p.items };
        for (const item of pending) {
          items[item.id] = { ...EMPTY_ITEM, ...(items[item.id] || {}), status: VERIFIED, updatedAt: now };
        }
        return { ...p, items, updatedAt: now };
      }),
    }));
    flash(`${pending.length} verified in ${sector.name}`, { state: snapshot });
  };

  /* --- property lifecycle ------------------------------------------------ */
  const toTop = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  const selectProperty = (id) => {
    setState((prev) => ({ ...prev, activeId: id }));
    toTop();
    setModal(null);
  };

  const createProperty = () => {
    const created = makeProperty(newName || `Unit ${String(state.properties.length + 1).padStart(2, '0')}`);
    setState((prev) => ({ ...prev, activeId: created.id, properties: [...prev.properties, created] }));
    toTop();
    setNewName('');
    setModal(null);
    flash(`${created.name} provisioned — ${stats.total} assets unverified`);
  };

  const renameProperty = (id, name) => {
    setState((prev) => ({
      ...prev,
      properties: prev.properties.map((p) => (p.id === id ? { ...p, name } : p)),
    }));
    flash(`Renamed to ${name}`);
  };

  const duplicateProperty = (id) => {
    const source = state.properties.find((p) => p.id === id);
    if (!source) return;
    const copy = cloneProperty(source, `${source.name} (copy)`);
    setState((prev) => {
      const at = prev.properties.findIndex((p) => p.id === id) + 1;
      const properties = [...prev.properties];
      properties.splice(at, 0, copy);
      return { ...prev, activeId: copy.id, properties };
    });
    toTop();
    setModal(null);
    flash('Property duplicated with its audit data');
  };

  /* Par levels are the slow part of setting a property up, and a block of
   * identical units shares them. Copy once, apply to many — counts and audit
   * state on the targets are left alone. */
  const copyExpected = (sourceId, targetIds) => {
    const source = state.properties.find((p) => p.id === sourceId);
    if (!source || !targetIds.length) return;
    const snapshot = state;
    const pars = new Map();
    for (const item of ALL_ITEMS) {
      const expected = getItem(source, item.id).expected;
      if (expected) pars.set(item.id, expected);
    }
    const now = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      properties: prev.properties.map((p) => {
        if (!targetIds.includes(p.id)) return p;
        const items = { ...p.items };
        for (const [itemId, expected] of pars) {
          items[itemId] = { ...EMPTY_ITEM, ...(items[itemId] || {}), expected };
        }
        return { ...p, items, updatedAt: now };
      }),
    }));
    setModal(null);
    flash(
      `${pars.size} counts copied to ${targetIds.length} propert${targetIds.length === 1 ? 'y' : 'ies'}`,
      { state: snapshot }
    );
  };

  const deleteProperty = (id) => {
    const snapshot = state;
    setState((prev) => {
      const remaining = prev.properties.filter((p) => p.id !== id);
      if (!remaining.length) return defaultState();
      /* Only move the operative if the ground moved under them. */
      const activeId = prev.activeId === id ? remaining[0].id : prev.activeId;
      return { ...prev, activeId, properties: remaining };
    });
    setModal(null);
    flash('Property profile purged', { state: snapshot });
  };

  const resetProperty = () => {
    const snapshot = state;
    setState((prev) => ({
      ...prev,
      properties: prev.properties.map((p) =>
        p.id === prev.activeId
          ? { ...p, items: {}, signedOffBy: '', signedOffAt: null, updatedAt: new Date().toISOString() }
          : p
      ),
    }));
    setModal(null);
    flash('Checklist wiped to zero', { state: snapshot });
  };

  const signOff = (name) => {
    setState((prev) => ({
      ...prev,
      auditor: name,
      properties: prev.properties.map((p) =>
        p.id === prev.activeId
          ? { ...p, signedOffBy: name, signedOffAt: new Date().toISOString() }
          : p
      ),
    }));
  };

  /* --- exports ----------------------------------------------------------- */
  /* `signedBy` arrives straight from the sign-off field so the export carries
   * the signature in the same gesture, without waiting for a state round trip. */
  const signedProperty = (signedBy) =>
    signedBy
      ? { ...property, signedOffBy: signedBy, signedOffAt: new Date().toISOString() }
      : property;

  const exportCSV = (signedBy) => {
    const target = signedProperty(signedBy);
    downloadCSV(target);
    flash(`Extracted ${stats.total} rows → ${csvFilename(target)}`);
  };

  const exportAll = () => {
    downloadCSVAll(state.properties);
    setModal(null);
    flash(`Extracted ${state.properties.length} properties → CSV`);
  };

  const printPDF = async (signedBy) => {
    setExporting(true);
    try {
      await printDocument(buildReport(signedProperty(signedBy), report));
      setModal(null);
      flash('Print dialog opened — choose “Save as PDF”');
    } catch {
      flash('Could not open the print dialog');
    } finally {
      setExporting(false);
    }
  };

  const exportBackup = () => {
    downloadText(buildBackup(state), backupFilename());
    flash('Backup downloaded — store it somewhere off this device');
  };

  const applyBackup = (parsed, mode) => {
    const snapshot = state;
    setState((prev) => {
      const properties =
        mode === 'replace' ? parsed.properties : [...prev.properties, ...parsed.properties];
      return { ...prev, activeId: parsed.properties[0].id, properties };
    });
    setModal(null);
    toTop();
    flash(
      `Restored ${parsed.properties.length} propert${parsed.properties.length === 1 ? 'y' : 'ies'}`,
      { state: snapshot }
    );
  };

  /* --- filtering + navigation -------------------------------------------- */
  const q = query.trim().toLowerCase();
  const visibleSectors = useMemo(() => {
    if (filter === 'all' && !q) return SECTORS.map((sector) => ({ sector, items: sector.items }));
    return SECTORS.map((sector) => ({
      sector,
      items: sector.items.filter((item) => {
        if (q && !item.label.toLowerCase().includes(q)) return false;
        const status = getItem(property, item.id).status;
        if (filter === 'todo') return status === PENDING;
        if (filter === 'deficit') return status === DEFICIT;
        return true;
      }),
    })).filter(({ items }) => items.length);
  }, [filter, q, property]);

  const visibleCount = visibleSectors.reduce((n, { items }) => n + items.length, 0);

  /* Resume where the walkthrough stopped instead of hunting for it. */
  const jumpToNext = () => {
    const next = SECTORS.flatMap((s) => s.items).find(
      (item) => getItem(property, item.id).status === PENDING
    );
    if (!next) return flash('Nothing left unaudited');
    setCollapsed((prev) => ({ ...prev, [SECTORS.find((s) => s.items.includes(next)).id]: false }));
    requestAnimationFrame(() => {
      document.getElementById(`row-${next.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  };

  const auditedCount = useMemo(
    () => state.properties.reduce((n, p) => n + Object.keys(p.items).length, 0),
    [state.properties]
  );

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

        {/* Multi-node selector. The roster behind it carries progress, deficit
            counts and per-property actions, so the header only has to name the
            unit the operative is standing in. */}
        <div className="flex items-stretch gap-2 px-3 pt-2.5">
          <button
            type="button"
            onClick={() => setModal({ type: 'properties' })}
            aria-haspopup="dialog"
            aria-label={`Active property: ${property.name}. Switch or manage properties.`}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-3 pr-2.5 text-left transition-colors hover:border-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70"
          >
            <span className="truncate text-sm font-semibold text-slate-100">{property.name}</span>
            {state.properties.length > 1 && (
              <span className="shrink-0 rounded border border-slate-700 px-1 py-px font-mono text-[10px] text-slate-500">
                {state.properties.findIndex((p) => p.id === property.id) + 1}/{state.properties.length}
              </span>
            )}
            <ChevronDown size={16} aria-hidden="true" className="ml-auto shrink-0 text-slate-500" />
          </button>
          <button
            type="button"
            onClick={() => setModal({ type: 'new' })}
            aria-label="Add property profile"
            className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-950 transition-colors hover:bg-white active:scale-95"
          >
            <Plus size={22} strokeWidth={2.8} aria-hidden="true" />
          </button>
        </div>

        {/* Metric validation */}
        <div className="px-3 pb-2.5 pt-2.5">
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

        {/* Second-pass controls */}
        <div className="flex items-center gap-2 px-3 pb-2.5">
          <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-0.5" role="tablist" aria-label="Filter assets">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className={[
                  'inline-flex min-h-[38px] items-center justify-center gap-1 whitespace-nowrap rounded-md px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] transition-colors',
                  filter === key ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300',
                ].join(' ')}
              >
                {label}
                {key === 'deficit' && report.count > 0 && (
                  <span className="ml-1 text-red-400">{report.count}</span>
                )}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchOpen((v) => !v);
              if (searchOpen) setQuery('');
            }}
            aria-label={searchOpen ? 'Close asset search' : 'Search assets'}
            aria-pressed={searchOpen}
            className={[
              'grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition-colors',
              searchOpen ? 'border-slate-500 bg-slate-800 text-slate-100' : 'border-slate-800 text-slate-500 hover:text-slate-300',
            ].join(' ')}
          >
            <Search size={15} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={jumpToNext}
            aria-label="Jump to the next unaudited asset"
            className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-800 text-slate-500 transition-colors hover:border-slate-600 hover:text-slate-300"
          >
            <Crosshair size={15} aria-hidden="true" />
          </button>
        </div>

        {searchOpen && (
          <div className="relative px-3 pb-2.5">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find an asset…"
              aria-label="Search assets by name"
              className={`${input} py-2.5 pr-9`}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-slate-500 hover:text-slate-200"
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </header>

      {/* ── Audit surface ──────────────────────────────────────────────── */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
        {!storageOK && (
          <p className="m-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-300">
            Local storage is blocked by this browser (private mode?). The audit still works,
            but nothing will survive a refresh — export to CSV before you close this tab.
          </p>
        )}

        {visibleSectors.map(({ sector, items }) => (
          <Sector
            key={sector.id}
            sector={sector}
            property={property}
            items={items}
            collapsed={Boolean(collapsed[sector.id])}
            onPatch={patchItem}
            onToggleCollapse={() =>
              setCollapsed((prev) => ({ ...prev, [sector.id]: !prev[sector.id] }))
            }
            onVerifyAll={() => verifySector(sector)}
          />
        ))}

        {visibleCount === 0 && (
          <p className="px-6 py-16 text-center font-mono text-[11px] uppercase leading-relaxed tracking-[0.14em] text-slate-600">
            {q ? `Nothing matches “${query}”` : filter === 'todo' ? 'Every asset audited' : 'No deficits logged'}
          </p>
        )}

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
            onClick={() => setModal({ type: 'report' })}
            className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-100 py-3.5 text-sm font-bold uppercase tracking-[0.1em] text-slate-950 transition-colors hover:bg-white active:scale-[0.98]"
          >
            <ClipboardList size={17} strokeWidth={2.5} aria-hidden="true" />
            <span className="truncate">Findings</span>
            {report.count > 0 && (
              <span className="shrink-0 rounded bg-red-600 px-1.5 py-0.5 font-mono text-[11px] text-white">
                {report.count}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={exportCSV}
            aria-label="Export this property to CSV"
            className="grid w-[48px] shrink-0 place-items-center rounded-lg border border-slate-700 text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-200"
          >
            <Download size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setModal({ type: 'backup' })}
            aria-label="Backup and restore"
            className="grid w-[48px] shrink-0 place-items-center rounded-lg border border-slate-700 text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-200"
          >
            <Database size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setModal({ type: 'reset' })}
            aria-label="Reset this checklist"
            className="grid w-[48px] shrink-0 place-items-center rounded-lg border border-slate-700 text-slate-400 transition-colors hover:border-red-500/50 hover:bg-red-950/40 hover:text-red-400"
          >
            <RotateCcw size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ── Overlays ───────────────────────────────────────────────────── */}
      {toast && (
        <div role="status" className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
          <p className="flex items-center gap-3 rounded-full border border-slate-700 bg-slate-800/95 py-2 pl-4 pr-2 text-center font-mono text-[11px] uppercase tracking-wider text-slate-200 shadow-xl backdrop-blur">
            <span className="min-w-0">{toast.message}</span>
            {toast.undo && (
              <button
                type="button"
                onClick={undo}
                className="flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-950 hover:bg-white"
              >
                <Undo2 size={12} strokeWidth={3} aria-hidden="true" />
                Undo
              </button>
            )}
          </p>
        </div>
      )}

      {modal?.type === 'properties' && (
        <PropertySheet
          properties={state.properties}
          activeId={property.id}
          onClose={() => setModal(null)}
          onSelect={selectProperty}
          onNew={() => setModal({ type: 'new' })}
          onRename={renameProperty}
          onDuplicate={duplicateProperty}
          onDelete={(id) => setModal({ type: 'delete', id })}
          onCopyCounts={(id) => setModal({ type: 'copy-counts', id })}
          onExportAll={exportAll}
        />
      )}

      {modal?.type === 'copy-counts' && (() => {
        const source = state.properties.find((p) => p.id === modal.id);
        return source ? (
          <CopyCountsSheet
            source={source}
            properties={state.properties}
            onClose={() => setModal(null)}
            onApply={copyExpected}
          />
        ) : null;
      })()}

      {modal?.type === 'report' && (
        <ReportSheet
          property={property}
          auditor={state.auditor}
          exporting={exporting}
          onClose={() => setModal(null)}
          onSignOff={signOff}
          onExportCSV={exportCSV}
          onPrintPDF={printPDF}
        />
      )}

      {modal?.type === 'backup' && (
        <BackupSheet
          propertyCount={state.properties.length}
          auditedCount={auditedCount}
          busy={exporting}
          onClose={() => setModal(null)}
          onExport={exportBackup}
          onImport={{
            parse: async (file) => parseBackup(await file.text()),
            apply: applyBackup,
          }}
        />
      )}

      {modal?.type === 'new' && (
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

      {modal?.type === 'reset' && (
        <Modal title="Nuclear Reset" tone="danger" onClose={() => setModal(null)}>
          <ConfirmPhrase
            phrase="RESET"
            action="Wipe checklist"
            onConfirm={resetProperty}
            onClose={() => setModal(null)}
            prompt={
              <>
                <p>
                  This clears every verification, count, serial number and deficit note on{' '}
                  <span className="font-mono font-bold text-slate-100">{property.name}</span>,
                  including its expected quantities.
                </p>
                <p className="text-slate-400">
                  {stats.verified} verified and {stats.deficit} deficit records will be destroyed.
                  Other properties are untouched.
                </p>
              </>
            }
          />
        </Modal>
      )}

      {modal?.type === 'delete' && (() => {
        const target = state.properties.find((p) => p.id === modal.id);
        if (!target) return null;
        const targetStats = computeStats(target);
        const audited = targetStats.verified + targetStats.deficit > 0;
        const tail = (
          <p className="text-slate-400">
            {state.properties.length === 1
              ? 'This is your last profile — a blank one will be provisioned in its place.'
              : `${state.properties.length - 1} other propert${state.properties.length === 2 ? 'y' : 'ies'} will remain.`}
          </p>
        );
        const lead = (
          <p>
            Permanently removes the profile{' '}
            <span className="font-mono font-bold text-slate-100">{target.name}</span>
            {audited ? ' and all of its audit data.' : '. Nothing has been audited on it yet.'}
          </p>
        );

        return (
          <Modal title="Purge Property" tone="danger" onClose={() => setModal(null)}>
            {/* An untouched profile has nothing to lose, so gating it behind a
                typed phrase is friction for its own sake. One that carries a
                real walkthrough gets the full gate. */}
            {audited ? (
              <ConfirmPhrase
                phrase="DELETE"
                action="Purge profile"
                onConfirm={() => deleteProperty(target.id)}
                onClose={() => setModal(null)}
                prompt={
                  <>
                    {lead}
                    <p className="text-slate-400">
                      {targetStats.verified} verified and {targetStats.deficit} deficit records will
                      be destroyed.
                    </p>
                    {tail}
                  </>
                }
              />
            ) : (
              <>
                <div className="mb-4 space-y-2 text-sm leading-relaxed text-slate-300">
                  {lead}
                  {tail}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setModal(null)} className={btn.ghost}>
                    Cancel
                  </button>
                  <button type="button" onClick={() => deleteProperty(target.id)} className={btn.danger}>
                    Purge profile
                  </button>
                </div>
              </>
            )}
          </Modal>
        );
      })()}
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
