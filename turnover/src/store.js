/* ============================================================================
 * PERSISTENCE + EXTRACTION
 *
 * State shape (localStorage key TURNOVER_KEY):
 *   { v, activeId, properties: [ { id, name, createdAt, updatedAt, items } ] }
 *
 * `items` is SPARSE — only assets an operative actually touched are written.
 * Untouched assets are PENDING by definition, so a fresh property costs a few
 * hundred bytes and the master checklist can grow without migrating saves.
 * ========================================================================= */

import { ALL_ITEMS, TOTAL_ITEMS } from './inventory.js';

export const TURNOVER_KEY = 'fo.turnover.matrix.v1';
export const SCHEMA_VERSION = 1;

export const PENDING = 'pending';
export const VERIFIED = 'verified';
export const DEFICIT = 'deficit';

/* An item record is only meaningful if it holds something worth persisting. */
export const EMPTY_ITEM = {
  status: PENDING,
  note: '',
  qty: '',
  brand: '',
  model: '',
  serial: '',
  condition: '',
  cost: '',      // replacement value, drives the claim total
  expected: '',  // par level — how many this unit is supposed to have
  counted: '',   // what the operative actually found
  updatedAt: null,
};

const uid = () =>
  'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);

/* A duplicate carries its audit data across — the common case is a block of
 * identical units where the second walkthrough starts from the first. */
export function cloneProperty(source, name) {
  const now = new Date().toISOString();
  const items = {};
  for (const [id, item] of Object.entries(source.items)) items[id] = { ...item };
  return {
    id: uid(),
    name: String(name).trim() || `${source.name} (copy)`,
    createdAt: now,
    updatedAt: now,
    /* A copy is a fresh walkthrough: it inherits the findings but not the
     * previous inspector's signature. */
    signedOffBy: '',
    signedOffAt: null,
    items,
  };
}

export function makeProperty(name) {
  const now = new Date().toISOString();
  return {
    id: uid(),
    name: String(name).trim() || 'Untitled Unit',
    createdAt: now,
    updatedAt: now,
    signedOffBy: '',
    signedOffAt: null,
    items: {},
  };
}

export function defaultState() {
  const first = makeProperty('Unit 01');
  return { v: SCHEMA_VERSION, activeId: first.id, properties: [first] };
}

/* --- storage availability -------------------------------------------------
 * Safari private mode and locked-down WebViews throw on setItem. The app must
 * keep working (in memory) rather than white-screen, so every access is
 * guarded and `storageAvailable` drives a banner in the UI. */
export function probeStorage() {
  try {
    const k = '__fo_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function sanitizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const status = [VERIFIED, DEFICIT, PENDING].includes(raw.status) ? raw.status : PENDING;
  const str = (v) => (typeof v === 'string' ? v : '');
  const item = {
    status,
    note: str(raw.note),
    qty: str(raw.qty),
    brand: str(raw.brand),
    model: str(raw.model),
    serial: str(raw.serial),
    condition: str(raw.condition),
    cost: str(raw.cost),
    expected: str(raw.expected),
    /* `qty` was the pre-par-level field name; carry old saves across. */
    counted: str(raw.counted) || str(raw.qty),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
  };
  return isBlank(item) ? null : item;
}

/* Drop records that carry no information so saves stay small. */
export function isBlank(item) {
  return (
    item.status === PENDING &&
    !item.note && !item.brand && !item.model && !item.serial &&
    !item.condition && !item.cost && !item.expected && !item.counted
  );
}

const KNOWN_IDS = new Set(ALL_ITEMS.map((i) => i.id));

function sanitizeProperty(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null;
  const items = {};
  if (raw.items && typeof raw.items === 'object') {
    for (const [id, value] of Object.entries(raw.items)) {
      if (!KNOWN_IDS.has(id)) continue; // checklist changed under an old save
      const clean = sanitizeItem(value);
      if (clean) items[id] = clean;
    }
  }
  return {
    id: raw.id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'Untitled Unit',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    signedOffBy: typeof raw.signedOffBy === 'string' ? raw.signedOffBy : '',
    signedOffAt: typeof raw.signedOffAt === 'string' ? raw.signedOffAt : null,
    items,
  };
}

export function loadState() {
  try {
    const raw = window.localStorage.getItem(TURNOVER_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const properties = Array.isArray(parsed?.properties)
      ? parsed.properties.map(sanitizeProperty).filter(Boolean)
      : [];
    if (!properties.length) return defaultState();
    const activeId = properties.some((p) => p.id === parsed.activeId)
      ? parsed.activeId
      : properties[0].id;
    return { v: SCHEMA_VERSION, activeId, properties };
  } catch {
    /* Corrupt or unreadable payload: start clean rather than trap the operative
     * on a broken screen. The bad value is left in place for forensics. */
    return defaultState();
  }
}

export function saveState(state) {
  try {
    window.localStorage.setItem(TURNOVER_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/* --- derived --------------------------------------------------------------- */

export function getItem(property, id) {
  return property?.items?.[id] ? { ...EMPTY_ITEM, ...property.items[id] } : EMPTY_ITEM;
}

export function computeStats(property) {
  let verified = 0;
  let deficit = 0;
  for (const id of KNOWN_IDS) {
    const status = property?.items?.[id]?.status;
    if (status === VERIFIED) verified += 1;
    else if (status === DEFICIT) deficit += 1;
  }
  const total = TOTAL_ITEMS;
  return {
    verified,
    deficit,
    total,
    pending: total - verified - deficit,
    percent: total ? Math.round((verified / total) * 100) : 0,
  };
}

export function sectorStats(property, sector) {
  let verified = 0;
  let deficit = 0;
  for (const item of sector.items) {
    const status = property?.items?.[item.id]?.status;
    if (status === VERIFIED) verified += 1;
    else if (status === DEFICIT) deficit += 1;
  }
  return { verified, deficit, total: sector.items.length };
}

/* Every finding on a property, in checklist order, with its evidence and
 * replacement value. This is what the report view and the HTML export render,
 * and what a manager actually acts on after a walkthrough. */
export function deficitReport(property) {
  const lines = [];
  let claim = 0;
  let shortUnits = 0;
  for (const item of ALL_ITEMS) {
    const state = getItem(property, item.id);
    if (state.status !== DEFICIT) continue;
    const cost = parseMoney(state.cost);
    claim += cost;
    const short = shortfall(state);
    if (short) shortUnits += short;
    lines.push({
      id: item.id,
      label: item.label,
      sector: item.sectorName,
      note: state.note,
      expected: state.expected,
      counted: state.counted,
      short,
      condition: state.condition,
      cost,
      costRaw: state.cost,
      updatedAt: state.updatedAt,
    });
  }
  return { lines, claim, shortUnits, count: lines.length };
}

/* --- counts ----------------------------------------------------------------
 * A rental unit is not a list of yes/no objects: it is supposed to hold twelve
 * forks and six pans. `expected` is that par level, set per property; `counted`
 * is what the walkthrough actually found. The gap between them is the finding,
 * which means the operative never has to write "missing 2 forks" by hand. */

export function parseCount(value) {
  if (value === '' || value == null) return null;
  const n = parseInt(String(value).replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

export const hasPar = (state) => parseCount(state.expected) > 0;

/* How many are missing. 0 when complete, null when not yet counted. */
export function shortfall(state) {
  const expected = parseCount(state.expected);
  const counted = parseCount(state.counted);
  if (!expected || counted === null) return null;
  return Math.max(0, expected - counted);
}

/* Counting is itself the verification: the number decides the status, so an
 * operative who enters a count never has to also remember to tick the box. */
export function statusFromCount(state) {
  const short = shortfall(state);
  if (short === null) return null;
  return short > 0 ? DEFICIT : VERIFIED;
}

/* Operatives type "45", "$45", "45.00" and "1,250" — all of them mean money. */
export function parseMoney(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const n = parseFloat(String(value || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export const formatMoney = (n) =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

/* --- verdict ----------------------------------------------------------------
 * The one thing a manager actually wants: can I put a guest in this unit? He
 * should not have to add up tiles or read a table to find out, so the answer is
 * computed once and stated in words at the top of everything we send.
 *
 * Incomplete outranks issues: an unfinished walkthrough cannot promise the unit
 * is fine, and saying "2 issues" about a half-audited unit would imply it can. */
export function verdict(property) {
  const stats = computeStats(property);
  const report = deficitReport(property);
  const money = report.claim > 0 ? ` · ${formatMoney(report.claim)} to resolve` : '';

  if (stats.pending === stats.total) {
    return {
      key: 'notstarted',
      label: 'Not started',
      headline: 'Walkthrough not started',
      detail: `${stats.total} assets to check`,
      rgb: '100 116 139', // slate-500
      hex: '#475569',
      tint: '#f8fafc',
      edge: '#cbd5e1',
    };
  }
  if (stats.pending > 0) {
    return {
      key: 'incomplete',
      label: 'In progress',
      headline: `${stats.pending} asset${stats.pending === 1 ? '' : 's'} not yet checked`,
      detail: report.count
        ? `${stats.verified} verified · ${report.count} issue${report.count === 1 ? '' : 's'} so far${money}`
        : `${stats.verified} of ${stats.total} verified`,
      rgb: '245 158 11', // amber-500
      hex: '#b45309',
      tint: '#fffbeb',
      edge: '#fcd34d',
    };
  }
  if (report.count > 0) {
    return {
      key: 'issues',
      label: 'Issues found',
      headline: `${report.count} issue${report.count === 1 ? '' : 's'} to resolve`,
      detail: `All ${stats.total} assets checked${money}`,
      rgb: '239 68 68', // red-500
      hex: '#b91c1c',
      tint: '#fef2f2',
      edge: '#fca5a5',
    };
  }
  return {
    key: 'ready',
    label: 'Ready',
    headline: 'Ready for guests',
    detail: `All ${stats.total} assets checked, nothing missing or damaged`,
    rgb: '34 197 94', // green-500
    hex: '#15803d',
    tint: '#f0fdf4',
    edge: '#86efac',
  };
}

/* Compact "how stale is this audit" readout for the property list. */
export function relativeTime(iso) {
  if (!iso) return 'never';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 'never';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
}

/* --- CSV extraction engine ------------------------------------------------- */

const STATUS_LABEL = { [VERIFIED]: 'Verified', [DEFICIT]: 'Deficit', [PENDING]: 'Pending' };

/* RFC 4180: quote every field, double any embedded quote. Leading =,+,-,@ are
 * prefixed with a quote-tab so spreadsheets treat them as text, not formulas. */
function csvCell(value) {
  const raw = value == null ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
}

export const CSV_COLUMNS = [
  'Property Name',
  'Timestamp',
  'Category',
  'Asset',
  'Status',
  'Deficit Notes',
  'Expected Qty',
  'Counted Qty',
  'Short',
  'Brand',
  'Model #',
  'Serial #',
  'Condition',
  'Replacement Cost',
  'Last Updated',
  'Audited By',
];

function csvRows(property, stamp) {
  const rows = [];
  for (const item of ALL_ITEMS) {
    const state = getItem(property, item.id);
    rows.push(
      [
        property.name,
        stamp,
        item.sectorName,
        item.label,
        STATUS_LABEL[state.status] || 'Pending',
        state.note,
        state.expected,
        state.counted,
        shortfall(state) || '',
        state.brand,
        state.model,
        state.serial,
        state.condition,
        state.cost ? parseMoney(state.cost).toFixed(2) : '',
        state.updatedAt || '',
        property.signedOffBy || '',
      ]
        .map(csvCell)
        .join(',')
    );
  }
  return rows;
}

export function buildCSV(property, exportedAt = new Date()) {
  return [CSV_COLUMNS.map(csvCell).join(','), ...csvRows(property, exportedAt.toISOString())]
    .join('\r\n');
}

/* Every property in one sheet — the Property Name column is what separates
 * them, so a manager can pivot the whole portfolio in one pass. */
export function buildCSVAll(properties, exportedAt = new Date()) {
  const stamp = exportedAt.toISOString();
  return [
    CSV_COLUMNS.map(csvCell).join(','),
    ...properties.flatMap((property) => csvRows(property, stamp)),
  ].join('\r\n');
}

export function csvFilename(property, exportedAt = new Date()) {
  const slug =
    property.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'property';
  const t = exportedAt;
  const pad = (n) => String(n).padStart(2, '0');
  const ts = `${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}`;
  return `turnover_${slug}_${ts}.csv`;
}

function triggerDownload(text, filename) {
  /* BOM keeps Excel from mangling UTF-8 in operative-typed deficit notes. */
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* --- backup / restore ------------------------------------------------------
 * localStorage is one browser profile on one device. Clearing site data, a
 * dead phone, or an OS reinstall takes every audit with it, and an operative
 * has no way to hand a walkthrough to a colleague. A backup file is the escape
 * hatch: the full portfolio in one portable JSON. */

export const BACKUP_FORMAT = 'fo.turnover.backup';

export function buildBackup(state) {
  return JSON.stringify({
    format: BACKUP_FORMAT,
    v: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    propertyCount: state.properties.length,
    state,
  });
}

/* Rejects anything that is not one of our backups rather than half-importing
 * a stranger's JSON and corrupting a live portfolio. */
export function parseBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (parsed?.format !== BACKUP_FORMAT) {
    throw new Error('That file is not a Turnover Matrix backup.');
  }
  const properties = Array.isArray(parsed?.state?.properties)
    ? parsed.state.properties.map(sanitizeProperty).filter(Boolean)
    : [];
  if (!properties.length) throw new Error('The backup contains no properties.');
  return {
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null,
    properties,
  };
}

export function backupFilename(exportedAt = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const t = exportedAt;
  return `turnover-backup_${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}.json`;
}

export function downloadText(text, filename, type = 'application/json') {
  const blob = new Blob([text], { type: `${type};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCSV(property) {
  const now = new Date();
  triggerDownload(buildCSV(property, now), csvFilename(property, now));
}

export function downloadCSVAll(properties) {
  const now = new Date();
  triggerDownload(
    buildCSVAll(properties, now),
    csvFilename({ name: `all-${properties.length}-properties` }, now)
  );
}
