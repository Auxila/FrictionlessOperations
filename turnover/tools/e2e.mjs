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
const forks = page.locator('li:has(#u-forks-qty), li:has-text("Forks")').first();
await page.getByLabel('Flag deficit on Forks').click();
check('flag button marks deficit', (await page.locator('#u-forks-note').count()) === 1);
await page.fill('#u-forks-note', 'Missing 2 forks');
await page.fill('#u-forks-qty', '6');
check('deficit counter in header', (await page.getByText('2 deficit').count()) === 1);

await page.screenshot({ path: SHOTS + '/01-audit.png' });

/* ── disclosure: a plain tick must not unfurl an empty form ───────────── */
const mugs = page.locator('li:has-text("Coffee Mugs")').first();
await mugs.locator('[role=checkbox]').click();
check('verified qty-only row stays collapsed', (await page.locator('#d-coffee-mugs-qty').count()) === 0);
await page.getByLabel('Show capture fields for Coffee Mugs').click();
check('chevron opens capture fields', (await page.locator('#d-coffee-mugs-qty').count()) === 1);
await page.fill('#d-coffee-mugs-qty', '8');
await page.getByLabel('Hide capture fields for Coffee Mugs').click();
check('chevron closes capture fields', (await page.locator('#d-coffee-mugs-qty').count()) === 0);
check('collapsed qty shown as badge', (await mugs.getByText('×8').count()) === 1);
check('collapsed deficit note previews',
      (await page.locator('li:has-text("Forks")').first().getByText('Missing 2 forks').count()) >= 1);

/* ── persistence across reload ────────────────────────────────────────── */
await page.reload({ waitUntil: 'networkidle' });
check('note survives reload', (await page.inputValue('#k-refrigerator-note')) === 'Door seal torn; ice maker dead');
check('serial survives reload', (await page.inputValue('#k-refrigerator-serial')) === '904KRZP1J742');
check('qty survives reload', (await page.inputValue('#u-forks-qty')) === '6');
check('collapsed qty survives reload',
      (await page.locator('li:has-text("Coffee Mugs")').first().getByText('×8').count()) === 1);
check('deficit status survives reload',
      (await page.locator('#k-refrigerator-note').count()) === 1);

/* ── sticky headers ───────────────────────────────────────────────────── */
await page.locator('main').evaluate((el) => { el.scrollTop = 1200; });
await page.waitForTimeout(120);
const stuck = await page.locator('main section > header').evaluateAll((hs) => {
  const main = document.querySelector('main').getBoundingClientRect();
  return hs.filter((h) => Math.abs(h.getBoundingClientRect().top - main.top) < 2).length;
});
check('a sector header is locked to the top', stuck >= 1, `${stuck} stuck`);
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
  page.getByRole('button', { name: 'Export CSV' }).click(),
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

  const tiny = await p.evaluate(() =>
    [...document.querySelectorAll('button, select, input, textarea')]
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
