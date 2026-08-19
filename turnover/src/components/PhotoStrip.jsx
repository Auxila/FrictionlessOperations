/* ============================================================================
 * PHOTO EVIDENCE STRIP
 * Thumbnails under an asset, plus the capture button. Object URLs are minted
 * per mount and revoked on unmount — a walkthrough scrolls past dozens of
 * assets, and leaked blob URLs are how a phone tab gets killed mid-audit.
 * ========================================================================= */

import React, { useEffect, useState } from 'react';
import { Camera, Loader, Trash2 } from 'lucide-react';
import { getPhoto, photoKey } from '../photos.js';

export function PhotoStrip({ propertyId, itemId, label, photoIds, busy, onCapture, onOpen, onRemove }) {
  const [thumbs, setThumbs] = useState({});

  useEffect(() => {
    let cancelled = false;
    const urls = [];
    (async () => {
      const next = {};
      for (const id of photoIds) {
        try {
          const rec = await getPhoto(photoKey(propertyId, itemId, id));
          if (rec?.thumb) {
            const url = URL.createObjectURL(rec.thumb);
            urls.push(url);
            next[id] = url;
          }
        } catch {
          /* A missing blob is survivable — the manifest entry just renders
           * as an empty frame rather than taking the row down. */
        }
      }
      if (cancelled) urls.forEach(URL.revokeObjectURL);
      else setThumbs(next);
    })();
    return () => {
      cancelled = true;
      urls.forEach(URL.revokeObjectURL);
    };
  }, [propertyId, itemId, photoIds.join(',')]);

  const atLimit = photoIds.length >= 6;

  return (
    <div className="col-span-2">
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
        Photo evidence {photoIds.length > 0 && `· ${photoIds.length}`}
      </span>
      <div className="flex flex-wrap gap-2">
        {photoIds.map((id, i) => (
          <div key={id} className="group relative">
            <button
              type="button"
              onClick={() => onOpen(i)}
              aria-label={`View photo ${i + 1} of ${photoIds.length} for ${label}`}
              className="block h-16 w-16 overflow-hidden rounded-md border border-slate-700 bg-slate-950"
            >
              {thumbs[id] ? (
                <img src={thumbs[id]} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center font-mono text-[9px] text-slate-600">
                  …
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => onRemove(id)}
              aria-label={`Delete photo ${i + 1} for ${label}`}
              className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full border border-slate-700 bg-slate-900 text-slate-400 hover:border-red-500/60 hover:text-red-400"
            >
              <Trash2 size={11} aria-hidden="true" />
            </button>
          </div>
        ))}

        {!atLimit && (
          <label
            className={[
              'grid h-16 w-16 cursor-pointer place-items-center rounded-md border border-dashed transition-colors',
              busy
                ? 'border-slate-700 text-slate-600'
                : 'border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200',
            ].join(' ')}
          >
            {busy ? (
              <Loader size={18} aria-hidden="true" className="animate-spin" />
            ) : (
              <Camera size={18} aria-hidden="true" />
            )}
            <span className="sr-only">Add photo evidence for {label}</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              disabled={busy}
              aria-label={`Add photo evidence for ${label}`}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                e.target.value = ''; // let the same file be picked twice
                if (files.length) onCapture(files);
              }}
              className="sr-only"
            />
          </label>
        )}
      </div>
    </div>
  );
}

/* Full-bleed viewer. Kept deliberately plain: an operative opens this to check
 * that the shot is in focus, not to edit it. */
export function Lightbox({ propertyId, itemId, label, photoIds, index, onIndex, onClose }) {
  const [url, setUrl] = useState(null);
  const photoId = photoIds[index];

  useEffect(() => {
    let cancelled = false;
    let objectUrl;
    (async () => {
      try {
        const rec = await getPhoto(photoKey(propertyId, itemId, photoId));
        if (rec?.full && !cancelled) {
          objectUrl = URL.createObjectURL(rec.full);
          setUrl(objectUrl);
        }
      } catch {
        /* leave the frame empty */
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [propertyId, itemId, photoId]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndex((index + 1) % photoIds.length);
      if (e.key === 'ArrowLeft') onIndex((index - 1 + photoIds.length) % photoIds.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, photoIds.length, onIndex, onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-slate-950/95 backdrop-blur"
      role="dialog"
      aria-modal="true"
      aria-label={`Photo evidence for ${label}`}
      onClick={onClose}
    >
      <div className="flex shrink-0 items-center justify-between px-4 py-3">
        <p className="truncate font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400">
          {label} · {index + 1}/{photoIds.length}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo"
          className="rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-slate-300 hover:bg-slate-800"
        >
          Close
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        {url ? (
          <img src={url} alt={`Evidence for ${label}`} className="max-h-full max-w-full rounded-lg object-contain" />
        ) : (
          <p className="font-mono text-xs uppercase tracking-wider text-slate-600">Loading…</p>
        )}
      </div>
      {photoIds.length > 1 && (
        <div className="flex shrink-0 justify-center gap-2 pb-6" onClick={(e) => e.stopPropagation()}>
          {photoIds.map((id, i) => (
            <button
              key={id}
              type="button"
              onClick={() => onIndex(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === index}
              className={`h-2 w-2 rounded-full ${i === index ? 'bg-slate-200' : 'bg-slate-700'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
