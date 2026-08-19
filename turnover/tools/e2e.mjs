/* ============================================================================
 * END-TO-END SUITE — drives the built `index.html` in a real browser.
 *
 *   npm test                       (uses Playwright's own Chromium)
 *   CHROMIUM_PATH=/path/to/chrome npm test
 *
 * Run `npm run build` first: this exercises the shipped artifact, not the
 * sources, so it also catches build-pipeline regressions (missing Tailwind
 * utilities, a CSP that blocks the CSV download, a stale service worker).
 * ========================================================================= */
import { spawn } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 8099;
const BASE = `http://localhost:${PORT}/`;
const SHOTS = process.env.SHOTS || mkdtempSync(join(tmpdir(), 'turnover-shots-'));

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? '  ok  ' : ' FAIL '} ${name}${detail ? '  — ' + detail : ''}`);
};

const server = spawn(process.execPath, ['tools/serve.mjs', String(PORT)], { stdio: 'ignore' });
const shutdown = () => server.kill();
process.on('exit', shutdown);
await new Promise((r) => setTimeout(r, 600));

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);

/* ══ 1. Field console on a phone ═══════════════════════════════════════ */
console.log('\nfield console (390×844, touch)');
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },      // iPhone 14-class
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  acceptDownloads: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(BASE, { waitUntil: 'networkidle' });

/* ── boot ─────────────────────────────────────────────────────────────── */
check('app mounts', (await page.locator('#root > div').count()) === 1);
check('no page errors on boot', errors.length === 0, errors.join(' / '));

const rows = page.locator('li:has([role=checkbox])');
check('69 assets rendered', (await rows.count()) === 69, String(await rows.count()));
check('12 sector headers', (await page.locator('main section > header').count()) === 12);

/* ── offline phase ────────────────────────────────────────────────────── */
check('phase starts Offline', (await page.getByText('Offline', { exact: true }).count()) === 1);
const bar = page.locator('[role=progressbar] > div');
check('progress bar at 0%', (await bar.evaluate((el) => el.style.width)) === '0%');

/* ── checkbox sizing (spec: minimum 24px) ─────────────────────────────── */
const box = rows.first().locator('[role=checkbox]');
const bb = await box.boundingBox();
const inner = await rows.first().locator('[role=checkbox] > span').boundingBox();
check('tap target >= 44px', bb.width >= 44 && bb.height >= 44, `${bb.width}x${bb.height}`);
check('visual box >= 24px', inner.width >= 24 && inner.height >= 24, `${inner.width}x${inner.height}`);

/* ── verify cycle ─────────────────────────────────────────────────────── */
await box.click();
check('tap 1 -> verified', (await box.getAttribute('aria-checked')) === 'true');
check('progress advances', (await bar.evaluate((el) => el.style.width)) === '1%',
      await bar.evaluate((el) => el.style.width));
check('phase -> In Progress', (await page.getByText('In Progress', { exact: true }).count()) === 1);

/* spec fields appear for the refrigerator */
check('spec fields revealed', (await page.locator('#k-refrigerator-serial').count()) === 1);
await page.fill('#k-refrigerator-brand', 'LG');
await page.fill('#k-refrigerator-model', 'LRFVS3006S');
await page.fill('#k-refrigerator-serial', '904KRZP1J742');

/* ── deficit reveal (the "uncheck reveals note" contract) ─────────────── */
check('note hidden while verified', (await page.locator('#k-refrigerator-note').count()) === 0);
await box.click();
check('tap 2 -> deficit', (await box.getAttribute('aria-checked')) === 'mixed');
check('deficit note revealed on uncheck', (await page.locator('#k-refrigerator-note').count()) === 1);
await page.fill('#k-refrigerator-note', 'Door seal torn; ice maker dead');

/* flag button as the direct path */
await page.getByLabel('Flag deficit on Forks').click();
check('flag button marks deficit', (await page.locator('#u-forks-note').count()) === 1);
await page.fill('#u-forks-note', 'Missing 2 forks');
check('deficit counter in header', (await page.getByText('2 deficit').count()) === 1);

await page.screenshot({ path: SHOTS + '/01-audit.png' });

/* ── disclosure: a plain tick must not unfurl a form ──────────────────── */
await page.locator('#row-d-coffee-mugs [role=checkbox]').click();
check('a plain tick leaves the row collapsed',
      (await page.locator('#d-coffee-mugs-expected').count()) === 0);
await page.getByLabel('Show details for Coffee Mugs').click();
check('chevron opens the detail panel',
      (await page.locator('#d-coffee-mugs-expected').count()) === 1);
await page.getByLabel('Hide details for Coffee Mugs').click();
check('chevron closes the detail panel',
      (await page.locator('#d-coffee-mugs-expected').count()) === 0);
check('collapsed deficit note previews',
      (await page.locator('#row-u-forks').getByText('Missing 2 forks').count()) >= 1);

/* ── persistence across reload ────────────────────────────────────────── */
await page.reload({ waitUntil: 'networkidle' });
check('note survives reload', (await page.inputValue('#k-refrigerator-note')) === 'Door seal torn; ice maker dead');
check('serial survives reload', (await page.inputValue('#k-refrigerator-serial')) === '904KRZP1J742');
check('deficit status survives reload',
      (await page.locator('#k-refrigerator-note').count()) === 1);

/* ── sticky headers ───────────────────────────────────────────────────── */
/* Scroll a known asset deep inside a sector into view, then assert THAT
   sector's own header is the one pinned — a fixed scroll offset can land in
   the gap between sections and prove nothing. */
await page.locator('#row-u-corkscrew').scrollIntoViewIfNeeded();
await page.waitForTimeout(150);
const pinned = await page.evaluate(() => {
  const row = document.getElementById('row-u-corkscrew');
  const header = row.closest('section').querySelector('header');
  const mainTop = document.querySelector('main').getBoundingClientRect().top;
  return {
    name: header.textContent.trim().slice(0, 20),
    delta: +(header.getBoundingClientRect().top - mainTop).toFixed(1),
    position: getComputedStyle(header).position,
  };
});
check('the sector header locks to the top while you scroll its assets',
      pinned.position === 'sticky' && Math.abs(pinned.delta) < 2,
      `${pinned.name} @ ${pinned.delta}px`);
await page.screenshot({ path: SHOTS + '/02-scrolled.png' });

/* ── multi-node: add a property ───────────────────────────────────────── */
const openRoster = () => page.getByLabel(/^Active property:/).click();
const rosterRows = () => page.locator('[role=dialog] li');

await page.getByLabel('Add property profile').click();
await page.fill('input[placeholder="Unit 02"]', 'Seaside Villa 4B');
await page.getByRole('button', { name: 'Provision' }).click();
await page.waitForTimeout(150);
await openRoster();
check('property count = 2', (await rosterRows().count()) === 2);
await page.getByLabel('Close').click();
check('new property is active', (await page.getByLabel(/^Active property: Seaside Villa 4B/).count()) === 1);
check('new property is unverified', (await page.getByText('Offline', { exact: true }).count()) === 1);
check('new property has no carried-over notes',
      (await page.locator('#k-refrigerator-note').count()) === 0);
await openRoster();
await page.screenshot({ path: SHOTS + '/03-property-roster.png' });
check('roster shows per-property progress',
      (await page.getByLabel(/^Switch to Unit 01 — \d+% verified/).count()) === 1);
await page.getByLabel('Close').click();

/* ── switching back restores the first audit ──────────────────────────── */
await openRoster();
await page.getByLabel(/^Switch to Unit 01/).click();
await page.waitForTimeout(150);
check('switching back restores data',
      (await page.inputValue('#k-refrigerator-note')) === 'Door seal torn; ice maker dead');

/* ── rename ──────────────────────────────────────────────────────────── */
await openRoster();
await page.getByLabel('Actions for Unit 01').click();
await page.getByRole('button', { name: 'Rename' }).click();
await page.locator('[role=dialog] input').first().fill('Harbor Loft 12');
await page.getByLabel('Save name').click();
await page.waitForTimeout(150);
check('rename updates the roster', (await page.getByLabel(/^Switch to Harbor Loft 12/).count()) === 1);
await page.getByLabel('Close').click();
check('rename updates the header', (await page.getByLabel(/^Active property: Harbor Loft 12/).count()) === 1);
await page.reload({ waitUntil: 'networkidle' });
check('rename persists', (await page.getByLabel(/^Active property: Harbor Loft 12/).count()) === 1);

/* ── duplicate carries the audit data across ─────────────────────────── */
await openRoster();
await page.getByLabel('Actions for Harbor Loft 12').click();
await page.getByRole('button', { name: 'Duplicate' }).click();
await page.waitForTimeout(200);
check('duplicate becomes active',
      (await page.getByLabel(/^Active property: Harbor Loft 12 \(copy\)/).count()) === 1);
check('duplicate carries the deficit note',
      (await page.inputValue('#k-refrigerator-note')) === 'Door seal torn; ice maker dead');
await page.fill('#k-refrigerator-note', 'copy diverged');
await openRoster();
await page.getByLabel(/^Switch to Harbor Loft 12 —/).click();
await page.waitForTimeout(150);
check('original is untouched by edits to the copy',
      (await page.inputValue('#k-refrigerator-note')) === 'Door seal torn; ice maker dead');

/* ── export every property in one sheet ──────────────────────────────── */
await openRoster();
const allDl = await Promise.all([
  page.waitForEvent('download', { timeout: 8000 }),
  page.getByLabel(/^Export all 3 properties/).click(),
]).then((r) => r[0]).catch(() => null);
check('export-all downloads', !!allDl, allDl ? await allDl.suggestedFilename() : 'no download');
if (allDl) {
  const rows = readFileSync(await allDl.path(), 'utf8').replace(/^\ufeff/, '').trim().split('\r\n');
  check('export-all has 3 × 69 rows', rows.length === 3 * 69 + 1, String(rows.length - 1));
  check('export-all names every property',
        ['Harbor Loft 12', 'Harbor Loft 12 (copy)', 'Seaside Villa 4B']
          .every((n) => rows.some((r) => r.startsWith(`"${n}"`))));
}

/* ── purge the copy: an audited profile needs the typed phrase ────────── */
await openRoster();
await page.getByLabel('Actions for Harbor Loft 12 (copy)').click();
await page.getByRole('button', { name: 'Delete' }).click();
const purge = page.getByRole('button', { name: 'Purge profile' });
check('purge locked before phrase', await purge.isDisabled());
await page.fill('input[placeholder="DELETE"]', 'DELETE');
await purge.click();
await page.waitForTimeout(200);
await openRoster();
check('copy purged', (await rosterRows().count()) === 2);
await page.getByLabel('Close').click();
/* The purged copy was the active profile, so the app must land somewhere
   sensible rather than on a dangling id. */
check('purging the active profile lands on a real one',
      (await page.getByLabel(/^Active property: Harbor Loft 12$|^Active property: Harbor Loft 12\./).count()) === 1);

/* ── verified phase: check everything ─────────────────────────────────── */
await page.evaluate(() => {
  const key = 'fo.turnover.matrix.v1';
  const s = JSON.parse(localStorage.getItem(key));
  const p = s.properties.find((x) => x.id === s.activeId);
  const ids = [...document.querySelectorAll('[role=checkbox]')].length;
  return ids;
});
for (const b of await page.locator('[role=checkbox]').all()) {
  const st = await b.getAttribute('aria-checked');
  if (st === 'false') await b.click();
  else if (st === 'mixed') { await b.click(); await b.click(); }
}
await page.waitForTimeout(200);
check('100% -> Verified phase', (await page.getByText('Verified', { exact: true }).count()) >= 1);
check('progress bar full', (await bar.evaluate((el) => el.style.width)) === '100%');
await page.screenshot({ path: SHOTS + '/04-verified.png' });

/* ── CSV export (real download, real CSP) ─────────────────────────────── */
const dl = await Promise.all([
  page.waitForEvent('download', { timeout: 8000 }),
  page.getByLabel('Export this property to CSV').click(),
]).then((r) => r[0]).catch((e) => null);
check('CSV download fires', !!dl, dl ? await dl.suggestedFilename() : 'no download event');
if (dl) {
  const path = await dl.path();
  const csv = readFileSync(path, 'utf8').replace(/^﻿/, '');
  const lines = csv.trim().split('\r\n');
  check('CSV has 69 data rows', lines.length === 70, String(lines.length - 1));
  check('CSV carries the deficit note',
        csv.includes('"Missing 2 forks"'), '');
  check('CSV carries the serial number',
        csv.includes('"904KRZP1J742"'), '');
  check('CSV header matches spec',
        lines[0].startsWith('"Property Name","Timestamp","Category","Asset","Status","Deficit Notes"'),
        lines[0].slice(0, 90));
  check('CSV filename slugged', /^turnover_.+_\d{8}-\d{4}\.csv$/.test(await dl.suggestedFilename()),
        await dl.suggestedFilename());
}

/* ── nuclear reset requires the exact phrase ──────────────────────────── */
await page.getByLabel('Reset this checklist').click();
const wipe = page.getByRole('button', { name: 'Wipe checklist' });
check('reset locked before phrase', await wipe.isDisabled());
await page.fill('input[placeholder="RESET"]', 'reset please');
check('reset stays locked on wrong phrase', await wipe.isDisabled());
await page.fill('input[placeholder="RESET"]', 'reset');
check('reset arms on exact phrase (case-insensitive)', await wipe.isEnabled());
await page.screenshot({ path: SHOTS + '/05-reset-modal.png' });
await wipe.click();
await page.waitForTimeout(200);
check('reset returns to Offline', (await page.getByText('Offline', { exact: true }).count()) === 1);
check('reset cleared notes', (await page.locator('#k-refrigerator-note').count()) === 0);
await page.reload({ waitUntil: 'networkidle' });
check('reset persisted', (await page.getByText('Offline', { exact: true }).count()) === 1);
await openRoster();
check('other property survived reset', (await rosterRows().count()) === 2);
await page.getByLabel('Close').click();

/* ── offline boot via service worker ──────────────────────────────────── */
await page.evaluate(() => navigator.serviceWorker.ready);
await ctx.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(400);
check('boots with the network down', (await page.locator('#root > div').count()) === 1);
await ctx.setOffline(false);

check('no page errors overall', errors.length === 0, errors.slice(0, 3).join(' / '));


/* ══ 1b. Par levels, counting, and audit ergonomics ════════════════════ */
console.log('\npar levels + audit ergonomics');
{
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true });
  /* Stub print() in every frame so the suite can assert the dialog was reached
     without a real one blocking the run. */
  await c.addInitScript(() => {
    window.__printed = 0;
    window.print = () => { window.__printed += 1; };
  });
  const pg = await c.newPage();
  const errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  pg.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await pg.goto(BASE, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(300);

  /* --- a par level turns a tick-box row into a counter --- */
  check('no counter before a par is set',
        (await pg.locator('#row-u-forks input[aria-label^="Counted"]').count()) === 0);
  await pg.getByLabel('Show details for Forks').click();
  await pg.fill('#u-forks-expected', '12');
  await pg.waitForTimeout(200);
  const counter = pg.locator('#row-u-forks input[aria-label^="Counted"]');
  check('setting a par reveals the counter', (await counter.count()) === 1);
  check('setting a par alone does not mark the asset audited',
        (await pg.locator('#row-u-forks [role=checkbox][aria-checked=false]').count()) === 1);

  /* --- counting short auto-flags the deficit, no typing --- */
  for (let i = 0; i < 10; i += 1) await pg.getByLabel('One more Forks').click();
  await pg.waitForTimeout(250);
  check('stepper counts up', (await counter.inputValue()) === '10');
  check('short count auto-flags a deficit',
        (await pg.locator('#row-u-forks [role=checkbox][aria-checked=mixed]').count()) === 1);
  check('shortfall is stated for the operative',
        (await pg.locator('#row-u-forks').getByText('short 2').count()) === 1);

  /* --- reaching par auto-verifies --- */
  await pg.getByLabel('One more Forks').click();
  await pg.getByLabel('One more Forks').click();
  await pg.waitForTimeout(250);
  check('reaching par auto-verifies',
        (await pg.locator('#row-u-forks [role=checkbox][aria-checked=true]').count()) === 1);
  check('complete is stated', (await pg.locator('#row-u-forks').getByText('complete').count()) === 1);

  /* --- direct entry for large counts --- */
  await pg.getByLabel('Show details for Hangers').click();
  await pg.fill('#b-hangers-expected', '30');
  await pg.waitForTimeout(150);
  await pg.locator('#row-b-hangers input[aria-label^="Counted"]').fill('24');
  await pg.waitForTimeout(250);
  check('typing a count works for large numbers',
        (await pg.locator('#row-b-hangers').getByText('short 6').count()) === 1);
  check('minus steps back down', await (async () => {
    await pg.getByLabel('One fewer Hangers').click();
    await pg.waitForTimeout(200);
    return (await pg.locator('#row-b-hangers input[aria-label^="Counted"]').inputValue()) === '23';
  })());

  await pg.screenshot({ path: SHOTS + '/12-counting.png' });

  /* --- counts survive a reload --- */
  await pg.reload({ waitUntil: 'networkidle' });
  await pg.waitForTimeout(400);
  check('par and count survive a reload',
        (await pg.locator('#row-u-forks input[aria-label^="Counted"]').inputValue()) === '12');

  /* --- bulk verify a whole room, then undo it --- */
  await pg.getByLabel(/^Verify all 5 remaining assets in Bathroom Hardware/).click();
  await pg.waitForTimeout(200);
  check('bulk verify ticks the whole sector',
        (await pg.locator('#row-ba-hair-dryer [role=checkbox][aria-checked=true]').count()) === 1);
  await pg.getByRole('button', { name: 'Undo' }).click();
  await pg.waitForTimeout(200);
  check('undo restores the sector',
        (await pg.locator('#row-ba-hair-dryer [role=checkbox][aria-checked=false]').count()) === 1);

  /* --- filters --- */
  await pg.getByLabel('Flag deficit on Grill').click();
  await pg.fill('#p-grill-note', 'Firebox rusted through');
  await pg.fill('#p-grill-cost', '240');
  await pg.getByRole('tab', { name: /Deficits/ }).click();
  await pg.waitForTimeout(250);
  check('deficit filter shows only findings',
        (await pg.locator('li[id^=row-]').count()) === 2,
        String(await pg.locator('li[id^=row-]').count()));
  await pg.getByRole('tab', { name: 'To do' }).click();
  await pg.waitForTimeout(200);
  check('to-do filter hides audited assets', (await pg.locator('#row-p-grill').count()) === 0);
  await pg.getByRole('tab', { name: 'All' }).click();

  /* --- asset search --- */
  await pg.getByLabel('Search assets').click();
  await pg.fill('input[aria-label="Search assets by name"]', 'corkscrew');
  await pg.waitForTimeout(200);
  check('search narrows to one asset', (await pg.locator('li[id^=row-]').count()) === 1);
  await pg.getByLabel('Clear search').click();
  await pg.getByLabel('Close asset search').click();

  /* --- jump to next unaudited --- */
  await pg.getByLabel('Jump to the next unaudited asset').click();
  await pg.waitForTimeout(600);
  check('jump scrolls the next unaudited asset into view', await pg.evaluate(() => {
    const el = document.getElementById('row-k-refrigerator');
    const main = document.querySelector('main').getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return r.top > main.top - 10 && r.bottom < main.bottom + 10;
  }));

  /* --- findings, sign-off, report --- */
  await pg.getByRole('button', { name: /^Findings/ }).click();
  await pg.waitForTimeout(200);
  check('findings sheet totals the claim', (await pg.getByText('$240.00').count()) >= 1);
  check('findings sheet counts units short', (await pg.getByText('Units short').count()) === 1);
  await pg.fill('#signoff-name', 'J. Rivera');
  await pg.screenshot({ path: SHOTS + '/13-findings.png' });

  /* The report prints from a same-origin iframe, which INHERITS this page's
     CSP. Assert it is actually styled, not merely present — an unhashed
     stylesheet is refused silently and the PDF comes out as naked text. */
  await pg.getByRole('button', { name: /Save as PDF/ }).click();
  await pg.waitForTimeout(1200);
  const frame = pg.frames()[1];
  check('print preview is created', Boolean(frame));
  if (frame) {
    check('preview titles itself for the Save-as-PDF filename',
          /^Turnover Report - /.test(await frame.title()), await frame.title());
    check('print() was reached', (await frame.evaluate(() => window.__printed)) === 1);
    const body = await frame.evaluate(() => document.body.innerText);
    check('report states the shortfall without anyone typing it',
          body.includes('Short 7') && body.includes('counted 23 of 30'),
          (/Short \d+ — counted \d+ of \d+/.exec(body) || ['not found'])[0]);
    check('report carries the typed finding and the claim',
          body.includes('Firebox rusted through') && body.includes('$240.00'));
    check('report is signed', body.includes('J. Rivera'));
    const styles = await frame.evaluate(() => ({
      h1: getComputedStyle(document.querySelector('h1')).fontSize,
      finding: getComputedStyle(document.querySelector('.finding')).backgroundColor,
      sheet: getComputedStyle(document.querySelector('.sheet')).backgroundColor,
    }));
    check('report stylesheet survives the page CSP',
          styles.h1 === '22px' && styles.finding === 'rgb(254, 242, 242)',
          JSON.stringify(styles));
    check('report references nothing external',
          await frame.evaluate(() =>
            !document.querySelector('script, link[rel=stylesheet], iframe, img')));
  }
  check('print reports success to the operative',
        (await pg.locator('[role=status]').innerText()).includes('SAVE AS PDF'));

  /* --- CSV carries the count columns --- */
  const csvDl = await Promise.all([
    pg.waitForEvent('download', { timeout: 8000 }),
    pg.getByRole('button', { name: /^CSV/ }).click(),
  ]).then((r) => r[0]).catch(() => null);
  if (csvDl) {
    const rows = readFileSync(await csvDl.path(), 'utf8').replace(/^\ufeff/, '').trim().split('\r\n');
    check('CSV header carries Expected/Counted/Short',
          rows[0].includes('"Expected Qty","Counted Qty","Short"'));
    const hangers = rows.find((r) => r.includes('"Hangers"'));
    check('CSV reports the shortfall', hangers.includes('"30","23","7"'), hangers?.slice(40, 90));
  }

  /* --- backup round trip (no photo store any more) --- */
  await pg.getByLabel('Backup and restore').click();
  await pg.waitForTimeout(200);
  const bk = await Promise.all([
    pg.waitForEvent('download', { timeout: 10000 }),
    pg.getByRole('button', { name: /Download backup/ }).click(),
  ]).then((r) => r[0]).catch(() => null);
  check('backup downloads', !!bk, bk ? await bk.suggestedFilename() : 'no download');
  if (bk) {
    const backupPath = await bk.path();
    await pg.evaluate(() => localStorage.clear());
    await pg.reload({ waitUntil: 'networkidle' });
    await pg.waitForTimeout(300);
    check('device really was wiped',
          (await pg.locator('#row-u-forks input[aria-label^="Counted"]').count()) === 0);
    await pg.getByLabel('Backup and restore').click();
    await pg.setInputFiles('input[aria-label="Choose a backup file to restore"]', backupPath);
    await pg.waitForTimeout(300);
    await pg.getByRole('button', { name: 'Replace everything' }).click();
    await pg.waitForTimeout(500);
    check('restore brings par levels and counts back',
          (await pg.locator('#row-u-forks input[aria-label^="Counted"]').inputValue()) === '12');
  }

  /* --- copy par levels across a portfolio --- */
  await pg.getByLabel('Add property profile').click();
  await pg.locator('input[maxlength="60"]').fill('Unit 02');
  await pg.getByRole('button', { name: 'Provision' }).click();
  await pg.waitForTimeout(200);
  check('a new property starts with no par levels',
        (await pg.locator('#row-u-forks input[aria-label^="Counted"]').count()) === 0);

  await pg.getByLabel(/^Active property:/).click();
  await pg.getByLabel(/^Actions for Unit 01/).click();
  await pg.getByRole('button', { name: 'Copy counts' }).click();
  await pg.waitForTimeout(200);
  await pg.getByRole('checkbox', { name: 'Unit 02' }).click();
  await pg.getByRole('button', { name: /^Copy to/ }).click();
  await pg.waitForTimeout(400);
  check('copied par levels arrive on the target',
        (await pg.locator('#row-u-forks input[aria-label^="Counted"]').count()) === 1);
  check('copying pars does not copy the counts',
        (await pg.locator('#row-u-forks input[aria-label^="Counted"]').inputValue()) === '');
  check('copying pars leaves the target unaudited',
        (await pg.getByText('Offline', { exact: true }).count()) === 1);
  await pg.screenshot({ path: SHOTS + '/14-copy-counts.png' });

  check('no page errors across the counting flow', errs.length === 0, errs.slice(0, 2).join(' / '));
  await c.close();
}

/* ══ 2. Layout across device classes ═══════════════════════════════════ */
console.log('\nlayout across device classes');
for (const [label, w, h] of [['iPhone SE 320', 320, 568], ['iPhone 14 390', 390, 844], ['iPad 768', 768, 1024]]) {
  const c = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 700, hasTouch: true });
  const p = await c.newPage();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  /* Engage the row with the widest capture panel (brand + model + serial). */
  await p.locator('li:has-text("Refrigerator") [role=checkbox]').first().click();
  await p.waitForTimeout(100);

  const over = await p.evaluate(() => ({
    doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    main: document.querySelector('main').scrollWidth - document.querySelector('main').clientWidth,
  }));
  check(`${label}: no horizontal overflow`, over.doc <= 0 && over.main <= 0, JSON.stringify(over));

  const fit = await p.evaluate(() => ({
    h: Math.round(document.querySelector('#root > div').getBoundingClientRect().height),
    vh: window.innerHeight,
  }));
  check(`${label}: 100dvh shell fills the viewport`, Math.abs(fit.h - fit.vh) <= 1, JSON.stringify(fit));

  /* Flex children shrink rather than overflow the document, so a toolbar that
     does not fit reads as "everything squeezed" instead of a scrollbar — the
     horizontal-overflow check above cannot see it. Measure intrinsic width. */
  const crowded = await p.evaluate(() => {
    const rows = [
      document.querySelector('[role=tablist]')?.parentElement,
      document.querySelector('main').parentElement.lastElementChild.firstElementChild,
    ].filter(Boolean);
    return rows
      .map((row) => {
        const style = getComputedStyle(row);
        const gaps = (parseFloat(style.columnGap) || 0) * (row.children.length - 1);
        const pad = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        const needed =
          [...row.children].reduce((n, el) => n + el.getBoundingClientRect().width, 0) + gaps + pad;
        return { needed: Math.round(needed), have: Math.round(row.getBoundingClientRect().width) };
      })
      .filter((r) => r.needed > r.have + 1);
  });
  check(`${label}: control rows fit without squeezing`, crowded.length === 0,
        crowded.map((r) => `${r.needed}>${r.have}`).join(', '));

  const tiny = await p.evaluate(() =>
    [...document.querySelectorAll('button, select, input, textarea')]
      /* Screen-reader-only inputs (the file picker behind the camera tile)
         are 1×1 by design; the visible label wrapping them is the target. */
      .filter((el) => !el.classList.contains('sr-only'))
      .map((el) => ({ id: el.getAttribute('aria-label') || el.tagName, ...el.getBoundingClientRect().toJSON() }))
      .filter((b) => b.width > 0 && (b.height < 36 || b.width < 24))
      .map((b) => `${b.id} ${Math.round(b.width)}×${Math.round(b.height)}`));
  check(`${label}: every control stays thumb-sized`, tiny.length === 0, tiny.slice(0, 4).join(', '));
  await c.close();
}

/* ══ 3. Corrupt / hostile localStorage ═════════════════════════════════ */
console.log('\nstorage resilience');
{
  const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await c.newPage();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  const junk = [
    'not json at all',
    '{"properties":"nope"}',
    '{"properties":[{"id":1}]}',
    'null',
    '{"properties":[{"id":"x","items":{"deleted-item-id":{"status":"verified"}}}]}',
  ];
  for (const value of junk) {
    await p.evaluate((v) => localStorage.setItem('fo.turnover.matrix.v1', v), value);
    const errs = [];
    p.once('pageerror', (e) => errs.push(e.message));
    await p.reload({ waitUntil: 'networkidle' });
    check(
      `boots over corrupt state: ${value.slice(0, 38)}`,
      (await p.locator('#root > div').count()) === 1 && errs.length === 0,
      errs.join('')
    );
  }
  await c.close();
}

/* Desktop reference shot. */
{
  const c = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const p = await c.newPage();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.screenshot({ path: SHOTS + '/06-desktop.png' });
  await c.close();
}

await browser.close();
server.kill();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
console.log(`screenshots: ${SHOTS}`);
process.exit(failed.length ? 1 : 0);
