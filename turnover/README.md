# Property Turnover Matrix

A field-audit console for inventorying rental units on turnover day. Built
mobile-first for operatives working one-handed in a property with poor signal.

**Live path:** `/turnover/`

---

## What ships

`index.html` is the entire application — React, the Lucide icon paths and the
compiled Tailwind stylesheet are all inlined at build time. The served page
makes **zero third-party requests**: no CDN, no webfont, no analytics. Combined
with the service worker, the console boots and runs with the network fully down.

| File | Role |
| --- | --- |
| `index.html` | Built artifact — self-contained SPA (generated, do not hand-edit) |
| `sw.js` | Offline shell cache (generated; cache name tracks the shell hash) |
| `manifest.webmanifest` | PWA install metadata (generated) |
| `icon-*.png` | Icon set (generated from an inline SVG by `npm run icons`) |
| `src/inventory.js` | The master checklist — 69 assets across 12 spatial sectors |
| `src/store.js` | Persistence, derived metrics, CSV extraction |
| `src/app.jsx` | UI |
| `src/styles.css` | Tailwind entry + base layer |
| `src/shell.html` | HTML skeleton the build injects CSS/JS into |

## Build

```bash
npm install
npm run build     # -> index.html, sw.js, manifest.webmanifest
npm run serve     # build, then preview on http://localhost:8080
npm run icons     # regenerate the PNG icon set (only if the mark changes)
```

The build also computes SHA-256 hashes of the inlined script and style and
writes them into a strict `Content-Security-Policy` meta tag, so the page
carries no `unsafe-inline`.

## Behaviour worth knowing

**Three-state assets.** Each row cycles `unverified → verified → deficit` on
tap. Landing on *deficit* — whether by tapping past *verified* (i.e. unchecking
it) or by hitting the flag button directly — reveals the deficit note field.
That is the only way the note appears, and it is what the CSV's *Deficit Notes*
column reports.

**Capture fields open where the data is the point.** Verifying an appliance
unfurls its Brand / Model # / Serial # inputs, because that is why those assets
are in the source checklist. Everything else keeps a one-tap tick and hides its
quantity/condition inputs behind a chevron, so a clean walkthrough stays a
walkthrough. Collapsed rows still surface a `×N` quantity badge and a truncated
deficit note.

**Storage is sparse.** Only assets an operative has touched are written, keyed
by stable ids from `inventory.js`. Editing the master checklist therefore never
corrupts a saved audit: ids that vanish are ignored on load, and new ids simply
default to unverified. Every state transition writes through immediately —
there is no debounce and no unsaved window.

**Storage can fail.** Safari private mode and locked-down WebViews throw on
`setItem`. The app detects this at boot, keeps working in memory, and shows a
banner telling the operative to export before closing the tab.

**Destructive actions are phrase-gated.** *Nuclear Reset* (wipes the active
property's checklist) requires typing `RESET`; purging a property profile
requires typing `DELETE`. Both name what will be destroyed first.

**CSV columns.** `Property Name, Timestamp, Category, Asset, Status,
Deficit Notes, Quantity, Brand, Model #, Serial #, Condition, Last Updated`.
Written RFC 4180-quoted with a UTF-8 BOM for Excel; cells opening with
`= + - @` are prefixed so a spreadsheet treats a deficit note as text rather
than a formula.

## Changing the checklist

Edit `src/inventory.js` and rebuild. Give every new item a **stable, unique
`id`** — that string is the persistence key and the thing that keeps existing
audits intact. Per-item options: `fields: ['brand','model','serial']`,
`qty: true`, `condition: true`, and a `hint` string.
