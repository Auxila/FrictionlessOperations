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
| `tools/verify-checklist.mjs` | Asserts the checklist still matches the source document |
| `src/store.js` | Persistence, derived metrics, CSV, backup format |
| `src/photos.js` | IndexedDB photo store + capture/downscale pipeline |
| `src/report.js` | Self-contained printable evidence report |
| `src/app.jsx` | App shell, state, exports |
| `src/ui.jsx` | Modal / button / field primitives |
| `src/components/` | AssetRow, Sector, PhotoStrip, and the three sheets |
| `src/styles.css` | Tailwind entry + base layer |
| `src/shell.html` | HTML skeleton the build injects CSS/JS into |

## Build

```bash
npm install
npm run build     # -> index.html, sw.js, manifest.webmanifest
npm run serve     # build, then preview on http://localhost:8080
npm run icons     # regenerate the PNG icon set (only if the mark changes)
npm run verify    # check the checklist against the source document
npm test          # drive the built page through the browser suite
```

The build also computes SHA-256 hashes of the inlined script and style and
writes them into a strict `Content-Security-Policy` meta tag, so the page
carries no `unsafe-inline`.

## Evidence, not just ticks

A note reading “stove scratched” is worth very little when a guest disputes a
deposit; a dated photo of the scratch is worth a great deal. Deficits therefore
carry **photos** and a **replacement value**.

Photos are captured straight from the phone camera, rotated per EXIF, and
downscaled twice on the way in — a long-edge-1400 copy for the report and a
220px thumbnail for the audit list. A 12 MP capture lands at roughly 100–250 KB.

**The bytes live in IndexedDB; localStorage only holds a manifest of photo ids.**
This split is load-bearing: localStorage tops out near 5 MB and is synchronous,
so a handful of full-size images would evict an entire portfolio's audit data.
There is a test asserting image bytes never reach localStorage.

**Findings** (header, right) is the deliverable end of the app: every deficit in
one screen, the summed claim value, a sign-off field, and two exports.

- **Report** — a self-contained HTML page with the photos embedded as data URIs.
  It opens anywhere, prints to PDF, and survives being forwarded, because it
  references nothing external. This is what you send an owner.
- **CSV** — the spreadsheet form, now including Replacement Cost, Photos and
  Audited By.

Signing puts your name on both in the same gesture.

## Working through 69 assets

- **Filters** — All / To do / Deficits. The second pass is “what's left” and
  “what's broken”, not another scroll through everything.
- **Search** — narrow to one asset by name.
- **Jump** (crosshair) — scrolls the next unaudited asset into view, so an
  interrupted walkthrough resumes where it stopped.
- **Verify-all** (per sector header) — whole rooms are routinely fine, and nine
  taps to say so is nine taps an operative will skip. A skipped room is an
  unaudited one.
- **Collapse** — tap a sector header to fold a room away.
- **Undo** — bulk verify, checklist reset, property purge and restore all leave
  a 7-second Undo in the toast. Destructive actions defer their photo deletes
  until that window shuts, so undoing a reset brings the evidence back too, not
  a hollow shell.

## Backup & restore

Everything lives in one browser profile on one device: clearing site data, a
dead phone, or an OS reinstall takes every audit with it, and there is no server
to fall back on. The database button in the action bar writes one JSON file
carrying every property, every audit and every photo.

Restoring offers **Add** (append to what's here) or **Replace everything**.
Take a backup after each turnover, and use it to move work between devices or
hand a walkthrough to a colleague.

## The property roster

The header names the unit you are standing in; tapping it opens the roster,
which is where property management lives. Each row carries live progress, a
deficit count and how stale the audit is, so you can see which of eleven units
still needs a walkthrough without opening any of them. The active property is
scrolled into view on open, and a filter box appears past five properties.

Per-property actions sit behind the `⋯` on each row:

- **Rename** — inline, no separate dialog.
- **Duplicate** — copies the audit data too, and lands the copy directly beneath
  its original. Built for a block of identical units where the second
  walkthrough starts from the first; the copy is a deep clone, so editing it
  never touches the original.
- **Delete** — an untouched profile goes on a single confirm; one carrying a
  real walkthrough requires typing `DELETE`, and the dialog says exactly how
  many verified and deficit records die with it.

The roster footer also exports **every** property into one CSV — same columns,
with the Property Name column separating them, so a portfolio pivots in one
pass. It stays disabled until there are at least two properties.

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
banner telling the operative to export before closing the tab. IndexedDB is
probed the same way — if it is unavailable, photo capture simply does not
appear rather than failing at the moment of use.

**Destructive actions are phrase-gated.** *Nuclear Reset* (wipes the active
property's checklist) requires typing `RESET`; purging a property profile
requires typing `DELETE`. Both name what will be destroyed first.

**CSV columns.** `Property Name, Timestamp, Category, Asset, Status,
Deficit Notes, Quantity, Brand, Model #, Serial #, Condition, Replacement Cost,
Photos, Last Updated, Audited By`.
Written RFC 4180-quoted with a UTF-8 BOM for Excel; cells opening with
`= + - @` are prefixed so a spreadsheet treats a deficit note as text rather
than a formula.

## Changing the checklist

Edit `src/inventory.js`, then run `npm run verify && npm run build`.

Give every new item a **stable, unique `id`** — that string is the persistence
key and the thing that keeps existing audits intact. Per-item options:
`fields: ['brand','model','serial']`, `qty: true`, `condition: true`, and a
`hint` string.

`npm run verify` holds the client's source document transcribed section by
section and fails if an asset goes missing, lands in the wrong room, or loses a
capture field the document asked for. It also prints the capture fields that go
**beyond** the source — quantity boxes on dinnerware, serial capture on the TV,
washer and dryer — so those additions stay visible instead of drifting in
unnoticed. Update the `SOURCE` constant only when the client's document itself
changes.
