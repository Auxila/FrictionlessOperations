/* ============================================================================
 * PHOTO EVIDENCE STORE
 *
 * A deficit note saying "stove scratched" is worth very little in a deposit
 * dispute; a dated photo of the scratch is worth a great deal. This module is
 * the bytes half of that: localStorage keeps a manifest of photo ids on each
 * asset (so the UI can render counts synchronously), IndexedDB holds the
 * actual image data.
 *
 * Splitting it this way matters — localStorage tops out around 5 MB and is
 * synchronous, so a handful of photos would evict an entire portfolio's audit
 * data. IndexedDB stores Blobs natively, with no base64 inflation.
 * ========================================================================= */

const DB_NAME = 'fo.turnover.photos';
const STORE = 'photos';
const DB_VERSION = 1;

/* Key layout lets us wipe a whole property or asset with a range delete. */
export const photoKey = (propertyId, itemId, photoId) => `${propertyId}|${itemId}|${photoId}`;
const prefixRange = (prefix) => IDBKeyRange.bound(prefix, prefix + '￿');

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch((err) => {
    dbPromise = null; // let a later attempt retry rather than caching the failure
    throw err;
  });
  return dbPromise;
}

/* Safari in private mode exposes indexedDB but throws on use, so the probe has
 * to actually open the database rather than sniff for the global. */
export async function photosAvailable() {
  try {
    await openDB();
    return true;
  } catch {
    return false;
  }
}

function tx(mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        let result;
        try {
          result = fn(store);
        } catch (err) {
          reject(err);
          return;
        }
        t.oncomplete = () => resolve(result?.__req ? result.__req.result : result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

const wrap = (req) => ({ __req: req });

export const putPhoto = (key, record) => tx('readwrite', (s) => wrap(s.put(record, key)));
export const getPhoto = (key) => tx('readonly', (s) => wrap(s.get(key)));
export const deletePhoto = (key) => tx('readwrite', (s) => wrap(s.delete(key)));

/* Used when an asset is cleared, a checklist is reset, or a property is purged
 * — orphaned image blobs would otherwise sit in the database forever. */
export const deletePhotosByPrefix = (prefix) =>
  tx('readwrite', (s) => wrap(s.delete(prefixRange(prefix))));

export const getPhotosByPrefix = (prefix) =>
  tx('readonly', (s) => wrap(s.getAll(prefixRange(prefix))));

export const getKeysByPrefix = (prefix) =>
  tx('readonly', (s) => wrap(s.getAllKeys(prefixRange(prefix))));

export const allEntries = async () => {
  const keys = await tx('readonly', (s) => wrap(s.getAllKeys()));
  const values = await tx('readonly', (s) => wrap(s.getAll()));
  return keys.map((key, i) => [key, values[i]]);
};

export const clearPhotos = () => tx('readwrite', (s) => wrap(s.clear()));

/* --- capture pipeline ------------------------------------------------------
 * Phone cameras hand back 4–12 MP JPEGs. Storing those would exhaust the
 * origin's quota in a couple of units and make the evidence report unusable as
 * an email attachment, so every capture is downscaled twice: a long-edge-1400
 * "full" for the report, and a 220px thumbnail for the audit list. */

const FULL_EDGE = 1400;
const THUMB_EDGE = 220;
const QUALITY = 0.72;

async function decode(file) {
  /* imageOrientation honours the EXIF rotation phones set when shooting in
   * portrait; without it, half the evidence arrives sideways. */
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* Some engines reject the options bag — fall through to the plain form. */
      try {
        return await createImageBitmap(file);
      } catch {
        /* fall through to <img> */
      }
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('decode failed'));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function scaleTo(source, maxEdge) {
  const w = source.width || source.naturalWidth;
  const h = source.height || source.naturalHeight;
  const ratio = Math.min(1, maxEdge / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * ratio));
  canvas.height = Math.max(1, Math.round(h * ratio));
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

const toBlob = (canvas) =>
  new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', QUALITY)
  );

export async function processCapture(file) {
  const source = await decode(file);
  const fullCanvas = scaleTo(source, FULL_EDGE);
  const thumbCanvas = scaleTo(source, THUMB_EDGE);
  const [full, thumb] = await Promise.all([toBlob(fullCanvas), toBlob(thumbCanvas)]);
  source.close?.();
  return {
    full,
    thumb,
    width: fullCanvas.width,
    height: fullCanvas.height,
    bytes: full.size,
    createdAt: new Date().toISOString(),
  };
}

export const blobToDataURL = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/* Decoded by hand rather than via fetch(dataURL): the page ships a strict
 * `connect-src 'self'` policy, which blocks fetching a data: URL, and the
 * failure surfaces as a rejected promise long after the restore looks fine. */
export function dataURLToBlob(dataURL) {
  const comma = dataURL.indexOf(',');
  const meta = dataURL.slice(0, comma);
  const mime = /:(.*?)[;,]/.exec(meta)?.[1] || 'image/jpeg';
  const binary = atob(dataURL.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export const newPhotoId = () =>
  'ph_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);

/* Rough on-disk footprint, for the storage readout in Backup & Restore. */
export async function photoBytes() {
  const entries = await allEntries();
  return entries.reduce((sum, [, rec]) => sum + (rec?.full?.size || 0) + (rec?.thumb?.size || 0), 0);
}

export const formatBytes = (n) => {
  if (!n) return '0 KB';
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};
