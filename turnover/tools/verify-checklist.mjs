/* ============================================================================
 * SOURCE-DOCUMENT FIDELITY CHECK
 *
 * SOURCE below is the client's inventory checklist transcribed verbatim,
 * section by section, exactly as the assets appear in the document. This
 * script asserts that `src/inventory.js` still covers it: nothing dropped,
 * nothing invented, nothing silently reordered into the wrong room.
 *
 * Run it after ANY edit to the master checklist:  npm run verify
 * ========================================================================= */
import { SECTORS } from '../src/inventory.js';

/* Keys are sector ids from inventory.js; values are the raw lines from the
 * source document, in document order. Parenthetical capture hints are kept
 * verbatim so the diff is auditable against a printed copy. */
const SOURCE = {
  'kitchen-appliances': [
    'Refrigerator', 'Stove/Oven', 'Microwave', 'Dishwasher',
    'Coffee Maker', 'Toaster', 'Blender',
  ],
  'kitchen-cookware': [
    'Pots (quantity: _____)', 'Pans (quantity: _____)', 'Baking Sheets',
    'Mixing Bowls', 'Measuring Cups/Spoons', 'Colander',
  ],
  'kitchen-dinnerware': [
    'Dinner Plates', 'Salad Plates', 'Bowls', 'Coffee Mugs',
    'Drinking Glasses', 'Wine Glasses',
  ],
  'kitchen-utensils': [
    'Forks', 'Knives', 'Spoons', 'Serving Utensils',
    'Can Opener', 'Corkscrew', 'Knife Set',
  ],
  dining: ['Dining Table', 'Dining Chairs (Qty: _____)', 'Bar Stools (Qty: _____)'],
  living: [
    'Sofa', 'Loveseat/Chairs', 'Coffee Table', 'End Tables', 'Lamps', 'TV',
    'Remote Controls', 'Throw Pillows', 'Decorative Items',
  ],
  bedrooms: [
    'Bed Frame', 'Mattress', 'Box Spring/Foundation', 'Headboard', 'Nightstands',
    'Lamps', 'Dresser', 'TV (if applicable)', 'Hangers (10 per closet)',
  ],
  linens: [
    'Mattress Protector',
    'Pillows (2 for twin, 4 for full/queen, 4 for king, 2 for sofa)',
    'Pillow Protectors',
  ],
  bathrooms: [
    'Shower Curtain/Glass Door', 'Hair Dryer', 'Trash Can',
    'Toilet Brush', 'Toilet Paper Holder',
  ],
  laundry: ['Washer', 'Dryer', 'Iron', 'Ironing Board', 'Laundry Basket'],
  patio: ['Patio Table', 'Patio Chairs', 'Lounge Chairs', 'Outdoor Cushions', 'Grill'],
  pool: ['Pool Furniture', 'Umbrellas', 'Pool Toys', 'Pool Equipment'],
};

/* Assets whose Brand/Serial#/Model# blanks appear in the source document.
 * Anything else carrying `fields` is a deliberate extension — listed so the
 * additions stay visible rather than drifting in unnoticed. */
const SOURCE_SPEC_ASSETS = ['Refrigerator', 'Stove / Oven', 'Microwave', 'Dishwasher'];
const SOURCE_QTY_ASSETS = [
  'Pots', 'Pans', 'Forks', 'Butter Knives', 'Spoons', 'Dining Chairs', 'Bar Stools',
  'Hangers', 'Pillows',
];
const SOURCE_CONDITION_ASSETS = [
  'Patio Table', 'Patio Chairs', 'Lounge Chairs', 'Outdoor Cushions', 'Grill',
];

/* Deliberate clarifications: where the source document's wording is ambiguous
 * in a report, the checklist says which thing is meant. The mapping is recorded
 * here so the source line is still accounted for and the deviation stays
 * visible rather than looking like drift. */
const CLARIFIED = {
  'butter knives': 'knives', // doc says "Knives"; "Knife Set" is the separate line
};

/* Strip the document's fill-in blanks and spacing quirks so "Stove/Oven" and
 * "Stove / Oven" compare equal, but a genuinely different asset does not. */
const norm = (s) =>
  s.toLowerCase()
    .replace(/\([^)]*\)/g, '')      // (quantity: ___), (if applicable), (Qty: ___)
    .replace(/_+/g, '')
    .replace(/\s*\/\s*/g, '/')
    .replace(/[^a-z0-9/ ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const canon = (s) => CLARIFIED[norm(s)] || norm(s);

let failures = 0;
const fail = (msg) => { failures++; console.log('  MISSING/DRIFT  ' + msg); };

const bySector = Object.fromEntries(SECTORS.map((s) => [s.id, s]));

for (const [sectorId, sourceLabels] of Object.entries(SOURCE)) {
  const sector = bySector[sectorId];
  if (!sector) { fail(`sector "${sectorId}" no longer exists in inventory.js`); continue; }

  const have = sector.items.map((i) => canon(i.label));
  const want = sourceLabels.map(norm);

  for (const [i, label] of want.entries()) {
    if (!have.includes(label)) fail(`${sectorId}: source asset "${sourceLabels[i]}" is not in the checklist`);
  }
  for (const [i, label] of have.entries()) {
    if (!want.includes(label)) console.log(`  ADDED          ${sectorId}: "${sector.items[i].label}" (not in the source document)`);
  }
  if (have.length === want.length && want.every((l, i) => l === have[i])) {
    console.log(`  ok  ${sectorId.padEnd(20)} ${want.length} assets, in document order`);
  } else if (!failures) {
    console.log(`  ok  ${sectorId.padEnd(20)} ${want.length} assets (order differs)`);
  }
}

const sourceTotal = Object.values(SOURCE).flat().length;
const haveTotal = SECTORS.flatMap((s) => s.items).length;
console.log(`\n  source document: ${sourceTotal} assets`);
console.log(`  master checklist: ${haveTotal} assets`);
if (sourceTotal !== haveTotal) fail(`count mismatch (${haveTotal} vs ${sourceTotal})`);

/* Report capture-field extensions explicitly. */
const all = SECTORS.flatMap((s) => s.items);
const extraSpec = all.filter((i) => i.fields && !SOURCE_SPEC_ASSETS.includes(i.label));
const extraQty = all.filter((i) => i.qty && !SOURCE_QTY_ASSETS.includes(i.label));
const extraCond = all.filter((i) => i.condition && !SOURCE_CONDITION_ASSETS.includes(i.label));
const missSpec = SOURCE_SPEC_ASSETS.filter((l) => !all.some((i) => i.label === l && i.fields));
const missQty = SOURCE_QTY_ASSETS.filter((l) => !all.some((i) => i.label === l && i.qty));
const missCond = SOURCE_CONDITION_ASSETS.filter((l) => !all.some((i) => i.label === l && i.condition));

for (const l of missSpec) fail(`"${l}" lost its Brand/Model/Serial fields (the source has those blanks)`);
for (const l of missQty) fail(`"${l}" lost its quantity field (the source asks for a count)`);
for (const l of missCond) fail(`"${l}" lost its condition field (the source asks about rust/stains)`);

console.log(`\n  capture fields beyond the source (optional, collapsed by default):`);
console.log(`    brand/model/serial: ${extraSpec.map((i) => i.label).join(', ') || 'none'}`);
console.log(`    quantity:           ${extraQty.map((i) => i.label).join(', ') || 'none'}`);
console.log(`    condition:          ${extraCond.map((i) => i.label).join(', ') || 'none'}`);

console.log(failures ? `\n${failures} problem(s)` : '\nChecklist matches the source document.');
process.exit(failures ? 1 : 0);
