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
    items,
  };
}

export function makeProperty(name) {
  const now = new Date().toISOString();
  return { id: uid(), name: String(name).trim() || 'Untitled Unit', createdAt: now, updatedAt: now, items: {} };
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
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
  };
  return isBlank(item) ? null : item;
}

/* Drop records that carry no information so saves stay small. */
export function isBlank(item) {
  return (
    item.status === PENDING &&
    !item.note && !item.qty && !item.brand && !item.model && !item.serial && !item.condition
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

/* Offline -> In Progress -> Verified, per the metric-validation spec. */
export function phaseOf(stats) {
  if (stats.verified === 0 && stats.deficit === 0) {
    return { key: 'offline', label: 'Offline', rgb: '100 116 139' };   // slate-500
  }
  if (stats.verified < stats.total) {
    return { key: 'progress', label: 'In Progress', rgb: '245 158 11' }; // amber-500
  }
  return { key: 'verified', label: 'Verified', rgb: '34 197 94' };      // green-500
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
  'Quantity',
  'Brand',
  'Model #',
  'Serial #',
  'Condition',
  'Last Updated',
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
        state.qty,
        state.brand,
        state.model,
        state.serial,
        state.condition,
        state.updatedAt || '',
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
