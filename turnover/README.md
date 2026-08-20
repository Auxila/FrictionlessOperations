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
| `src/store.js` | Persistence, counts, derived metrics, CSV, backup format |
| `src/report.js` | The printable report (its stylesheet is CSP-hashed by the build) |
| `src/print.js` | Renders the report into an off-screen iframe and prints it |
| `src/share.js` | Native share sheet, with clipboard fallbacks beneath it |
| `src/passcode.js` | The passcode gate — read its header before trusting it |
| `src/sha256.js` | SHA-256 (FIPS 180-4), verified against NIST vectors in the suite |
| `src/app.jsx` | App shell, state, exports |
| `src/ui.jsx` | Modal / button / field primitives |
| `src/components/` | AssetRow, Sector, and the four sheets |
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

## Counts, not just ticks

A rental unit is not a list of yes/no objects. It is supposed to hold twelve
forks and six pans, and the job is finding out whether it still does.

Every asset can carry an **expected quantity** — a par level, set per property
in the row's detail panel. Setting one turns that row into a counter:

```
[✓] Forks
    [ − ]  10  [ + ]     of 12   short 2
```

**Counting is the verification.** Reach par and the asset marks itself
verified; come up short and it flags itself a deficit and states the shortfall.
Nobody types "missing 2 forks" — the app already knows, and `Short 2 of 12`
carries through to the findings screen, the CSV and the report on its own. The
deficit note is still there for the things a number cannot say ("left burner
scratched").

Par levels are per property, because Unit A has eight forks and Unit B has
twelve. Assets with no par set stay simple present/absent ticks, so the
checklist does not force a count where a count is meaningless — you do not
count the dishwasher.

**Copy counts** (property roster → `⋯`) pushes one property's par levels onto
any set of others. Setting pars across 69 assets is the slow part of standing a
unit up, and a block of identical units shares them: set once, push to the rest.
Only the expected quantities travel — targets keep their own counts and audit
state.

**Findings** (bottom bar) is the deliverable end: every deficit in one screen,
the units short, the summed replacement value, a sign-off field, and the two
exports. Signing puts your name on both.

## What to send, and why

Everything the manager receives leads with the same computed **verdict** —
*Ready for guests*, *2 issues to resolve*, *12 assets not yet checked* — stated
in words before any number. He should never have to add up tiles or read a
table to learn whether he can put a guest in the unit. The app's own header
shows the same verdict, so the operative sees exactly what is being sent.

Incomplete outranks issues: a half-finished walkthrough cannot promise a unit
is fine, and reporting "2 issues" on one would imply it can.

**Send update is the fastest path, during or after.** It puts a short plain-text
rundown into the native share sheet — Messages, WhatsApp, Mail, whatever he
uses. No attachment, no app, no zooming; he reads it where it lands, on a lock
screen if that is all he opens. It works mid-walkthrough too, so "kitchen's
done, two things missing" costs two taps. Where there is no share sheet
(desktop, or plain http on a LAN) it copies to the clipboard instead and says
so, with an `execCommand` fallback beneath the async clipboard for insecure
contexts.

```
Seaside Villa 4B — 4 issues to resolve

Turnover Aug 20, 2026 · J. Rivera
65 of 69 verified

MISSING
- Wine Glasses (Kitchen): 3 of 8 missing, est. $21
- Forks (Kitchen): 2 of 12 missing, est. $6

DAMAGED / FAULTY
- Mattress (Bedroom): Large stain, needs replacing, $850
- Grill (Outdoor): Firebox rusted through, est. $400

Estimated replacement value: $1,277
(estimates use standard replacement costs)
```

Line one carries the property and the verdict together, because that is what a
lock-screen preview shows. **Missing and damaged are split** — one is a reorder,
the other a repair — so a manager is not left triaging one undifferentiated
list, and each line names its room so work can be handed straight to someone.
It is deliberately plain: no markdown, no emoji, nothing that arrives as literal
punctuation in somebody's SMS client. Findings cap at ten with an "…and N more"
tail so a message never becomes a wall.

## Pricing

Nobody should have to invent a number standing in a kitchen. Every asset in
`src/inventory.js` carries a **`unitCost`** — the median replacement cost of one
of the thing, US mid-market / rental grade. Flagging a deficit prices it
automatically, multiplied by the shortfall where a count applies:

> Forks, 2 short at $3 each → **est. $6**

The estimate follows the count as it changes, and the row shows its own basis
(`Est. 2 × $3.00`) so the figure is never a black box. **Typing over it makes it
yours** and it is never recomputed — and everything downstream tracks the
difference: a table price prints as `Est. $400`, a typed one prints as `$400`,
and the total is labelled "Estimated replacement value" only while it still
contains estimates. Clearing a deficit drops the estimate rather than leaving a
price on an asset that is no longer a finding.

### Priced for Mexico Beach, FL

The table is tuned to the Gulf Coast panhandle, not a national average:

- **Basis is Panama City metro shelf price.** There is no big-box retail in
  Mexico Beach — the nearest Home Depot is ~32 miles up US-98 in Panama City,
  with Lowe's and Walmart alongside. That is where a replacement actually gets
  bought, and it sits inside the free appliance-delivery radius, so no freight
  premium is baked in.
- **Includes 7% sales tax** (6% Florida + 1% county surtax). Mexico Beach
  straddles the Bay/Gulf county line and both are 7%, so the split does not
  matter. These figures are what leaves the bank account, not shelf stickers.
- **Outdoor assets are priced at salt-air grade** and run well above the
  national median — powder-coated aluminum and resin wicker rather than steel,
  solution-dyed cushions that survive UV and mildew, stainless on the grill.
  Cheap outdoor furniture on the Gulf is a yearly purchase, so the honest
  replacement cost is the one that lasts a season. Patio chairs $110 → $150,
  cushions $55 → $80, grill $400 → $515, umbrellas $130 → $180.

Big-ticket figures are anchored to 2026 replacement-cost guides — refrigerator
$600–2,300, range $600–1,300, washer $700–1,300, mid-range sofa $800–2,000,
queen mattress ~$600–800 market average, 55" 4K TV $199–299, 2–3 burner gas
grill $250–450 — with the median taken, then tax applied; housewares are
commodity mid-market.

**Revisit after any hurricane season that moves demand.** Panhandle prices for
appliances and outdoor furniture spike hard after a storm.

**They are estimates for triage, not quotations**, and the report says so.
`unitCost` in `src/inventory.js` is the only place they live, and the browser
suite derives its expectations from that table rather than hard-coding dollar
figures — so retuning prices never breaks a test.

**PDF is the formal record.** Save as PDF opens the print dialog with
the report already laid out; pick “Save as PDF” and attach the result. It opens
identically on any phone or desktop with nothing installed, cannot be nudged
out of shape by whoever opens it, and reads top-down: the verdict banner, the
totals, what needs action in plain English, then the full inventory as a
clearly-labelled appendix he can ignore.

**CSV is for machines and spreadsheets, not for readers.** Sending one to a
non-technical person invites a specific set of failures: Excel silently rewrites
values that look like dates, drops leading zeros from serial numbers, and on any
locale that uses the comma as a decimal separator it ignores the delimiter and
dumps all sixteen columns into column A. On a phone many mail clients will not
preview it at all. It is the right format for importing into another system and
the wrong one for a manager's inbox.

### How printing works

No PDF library is bundled — one would cost ~400 KB and produce worse typography
than the platform gives away free. `src/print.js` renders the report into an
off-screen, same-origin iframe and calls the browser's own print engine. Every
target can save that to PDF: Windows ships “Microsoft Print to PDF”, macOS and
iOS have PDF in the print sheet, Android Chrome has “Save as PDF”.

The iframe is off-screen rather than `display:none`, because an unlaid-out
document prints blank. It uses `srcdoc`, which **inherits this page's CSP** —
so the build hashes the report's stylesheet into `style-src` alongside the app's
own. Without that hash the stylesheet is refused silently and the PDF comes out
as unstyled text while the app still reports success; there is a test asserting
the preview's computed styles, not merely its content.

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
- **Undo** — bulk verify, checklist reset, property purge, count-copy and
  restore all leave a 7-second Undo in the toast.

## The passcode gate — what it is and is not

The console asks for a passcode before it opens. **Be clear about what that
buys**, because it is easy to mistake for security it does not provide.

**This is a door, not a safe.** The console is a static page on a public host.
Every byte of it — this check included — is downloaded by anyone who asks for
the URL. A determined person can read the source, step past the gate in
devtools, or fetch the raw file. Nothing that runs in a browser can prevent
that, and no amount of work on this gate will change it.

What it genuinely does:

- stops someone who stumbles onto the URL from wandering into a working tool
- lets an operative lock the screen before handing their phone to anybody

What it does **not** do:

- **protect audit data already on the device.** That lives in localStorage in
  the clear. Anyone holding the unlocked phone with devtools open can read it.
- keep out anyone motivated. Treat it as a "staff only" sign on an unlocked
  door.

The passcode is stored salted and stretched (20,000 SHA-256 iterations, ~250 ms
per attempt) rather than in plain sight, so it is not sitting in view-source and
a stock rainbow table does not resolve it. That raises the cost of guessing; it
does not make guessing impossible, and a short dictionary word is the limiting
factor regardless of the iteration count.

```bash
npm run set-passcode -- "some longer phrase"   # then: npm run build
npm run set-passcode -- ""                     # removes the gate entirely
```

The plaintext is never written to the repository — only the salt and the hash.

**If you need actual protection, the gate has to live in front of the server**:
Cloudflare Access, a host with built-in password protection, or simply not
publishing the console at a public URL.

### What is actually exposed

Worth stating plainly, because it is smaller than it looks:

- **The app makes zero network calls.** `connect-src 'self'`, no fetch, no
  beacons, no analytics. Serial numbers and audit data never leave the device
  they were typed on unless somebody exports them deliberately.
- **There is no shared database.** Every browser holds its own audits. A
  stranger who opens the URL and guesses the passcode gets an empty checklist —
  not yours.
- **Nobody can alter the app** without push access to the GitHub repository.

So the realistic threat is not someone on the internet. It is someone picking up
an unlocked phone that has the console installed — which is what the Lock button
is for, and why device-level screen lock matters more here than this gate does.

## Backup & restore

Everything lives in one browser profile on one device: clearing site data, a
dead phone, or an OS reinstall takes every audit with it, and there is no server
to fall back on. The database button in the action bar writes one JSON file
carrying every property, its par levels and every audit.

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
banner telling the operative to export before closing the tab.

**Destructive actions are phrase-gated.** *Nuclear Reset* (wipes the active
property's checklist) requires typing `RESET`; purging a property profile
requires typing `DELETE`. Both name what will be destroyed first.

**CSV columns.** `Property Name, Timestamp, Category, Asset, Status,
Deficit Notes, Expected Qty, Counted Qty, Short, Brand, Model #, Serial #,
Condition, Replacement Cost, Last Updated, Audited By`.
Written RFC 4180-quoted with a UTF-8 BOM for Excel; cells opening with
`= + - @` are prefixed so a spreadsheet treats a deficit note as text rather
than a formula.

## Changing the checklist

Edit `src/inventory.js`, then run `npm run verify && npm run build`.

Give every new item a **stable, unique `id`** — that string is the persistence
key and the thing that keeps existing audits intact. Per-item options:
`fields: ['brand','model','serial']`, `condition: true`, and a `hint` string.

`qty: true` marks the assets the source document asks for a count on. Since par
levels are available on every asset it no longer gates any UI, but
`npm run verify` asserts the flag still matches the document, so the record of
what the client asked for stays honest.

`npm run verify` holds the client's source document transcribed section by
section and fails if an asset goes missing, lands in the wrong room, or loses a
capture field the document asked for. It also prints the capture fields that go
**beyond** the source — quantity boxes on dinnerware, serial capture on the TV,
washer and dryer — so those additions stay visible instead of drifting in
unnoticed. Update the `SOURCE` constant only when the client's document itself
changes.
