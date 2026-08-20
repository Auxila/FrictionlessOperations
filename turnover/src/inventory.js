/* ============================================================================
 * MASTER CHECKLIST — parsed from the raw "Vacation Rental Property Inventory"
 * payload and grouped into spatial sectors.
 *
 * Every item carries a STABLE `id`. Property state is stored sparsely against
 * these ids, so adding/removing items here never corrupts saved audits:
 * unknown ids are ignored on load, new ids simply default to PENDING.
 *
 * Optional per-item capture, driven by the source document:
 *   fields: ['brand','model','serial']  -> the four appliances that had
 *                                          Brand/Serial#/Model# blanks
 *   qty: true                           -> the source had "(quantity: ___)"
 *   condition: true                     -> the source had "Condition ei. Rust?"
 *   hint                                -> verbatim guidance from the source
 *
 * `unitCost` is the median replacement cost of ONE of the thing, in USD, at
 * US mid-market / rental grade as of Aug 2026. It exists so an operative never
 * has to guess a number in the field: flag a deficit and the cost pre-fills,
 * multiplied by the shortfall where a count is involved (2 forks short -> 2 x
 * $3). It is always editable, and an edited figure is never overwritten.
 *
 * These are ESTIMATES and are labelled as such everywhere they surface. Big-
 * ticket figures are anchored to 2026 replacement-cost guides (refrigerator
 * $600-2,300; range $600-1,300; washer $700-1,300; mid-range sofa $800-2,000;
 * queen mattress ~$600-800 market average; 55" 4K TV $199-299; 2-3 burner gas
 * grill $250-450) with the median taken; housewares are commodity mid-market.
 * Tune them to your own market and suppliers — this table is the only place
 * they live.
 * ========================================================================= */

/* Accent is an unpacked RGB triplet so components can drive every shade from
 * a single `--accent` custom property (see app.jsx). Keeping the value in CSS
 * rather than in class names means Tailwind only ever sees static utilities. */
export const SECTORS = [
  {
    id: 'kitchen-appliances',
    name: 'Kitchen Infrastructure',
    zone: 'Kitchen',
    icon: 'Refrigerator',
    accent: '245 158 11', // amber-500
    items: [
      { id: 'k-refrigerator', label: 'Refrigerator', fields: ['brand', 'model', 'serial'], unitCost: 1100 },
      { id: 'k-stove-oven', label: 'Stove / Oven', fields: ['brand', 'model', 'serial'], unitCost: 900 },
      { id: 'k-microwave', label: 'Microwave', fields: ['brand', 'model', 'serial'], unitCost: 130 },
      { id: 'k-dishwasher', label: 'Dishwasher', fields: ['brand', 'model', 'serial'], unitCost: 650 },
      { id: 'k-coffee-maker', label: 'Coffee Maker', hint: 'Regular or Keurig', unitCost: 70 },
      { id: 'k-toaster', label: 'Toaster', unitCost: 35 },
      { id: 'k-blender', label: 'Blender', unitCost: 60 },
    ],
  },
  {
    id: 'kitchen-cookware',
    name: 'Cookware',
    zone: 'Kitchen',
    icon: 'CookingPot',
    accent: '245 158 11',
    items: [
      { id: 'c-pots', label: 'Pots', qty: true, unitCost: 35 },
      { id: 'c-pans', label: 'Pans', qty: true, unitCost: 30 },
      { id: 'c-baking-sheets', label: 'Baking Sheets', unitCost: 15 },
      { id: 'c-mixing-bowls', label: 'Mixing Bowls', unitCost: 18 },
      { id: 'c-measuring', label: 'Measuring Cups / Spoons', unitCost: 15 },
      { id: 'c-colander', label: 'Colander', unitCost: 15 },
    ],
  },
  {
    id: 'kitchen-dinnerware',
    name: 'Dinnerware',
    zone: 'Kitchen',
    icon: 'Soup',
    accent: '251 191 36', // amber-400
    items: [
      { id: 'd-dinner-plates', label: 'Dinner Plates', qty: true, unitCost: 8 },
      { id: 'd-salad-plates', label: 'Salad Plates', qty: true, unitCost: 6 },
      { id: 'd-bowls', label: 'Bowls', qty: true, unitCost: 6 },
      { id: 'd-coffee-mugs', label: 'Coffee Mugs', qty: true, unitCost: 6 },
      { id: 'd-drinking-glasses', label: 'Drinking Glasses', qty: true, unitCost: 5 },
      { id: 'd-wine-glasses', label: 'Wine Glasses', qty: true, unitCost: 7 },
    ],
  },
  {
    id: 'kitchen-utensils',
    name: 'Utensils',
    zone: 'Kitchen',
    icon: 'UtensilsCrossed',
    accent: '251 191 36',
    items: [
      { id: 'u-forks', label: 'Forks', qty: true, hint: 'How many?', unitCost: 3 },
      { id: 'u-knives', label: 'Knives', qty: true, hint: 'How many?', unitCost: 3 },
      { id: 'u-spoons', label: 'Spoons', qty: true, hint: 'How many?', unitCost: 3 },
      { id: 'u-serving', label: 'Serving Utensils', unitCost: 12 },
      { id: 'u-can-opener', label: 'Can Opener', unitCost: 15 },
      { id: 'u-corkscrew', label: 'Corkscrew', unitCost: 12 },
      { id: 'u-knife-set', label: 'Knife Set', unitCost: 90 },
    ],
  },
  {
    id: 'dining',
    name: 'Dining Area',
    zone: 'Dining',
    icon: 'Utensils',
    accent: '249 115 22', // orange-500
    items: [
      { id: 'dn-table', label: 'Dining Table', unitCost: 450 },
      { id: 'dn-chairs', label: 'Dining Chairs', qty: true, unitCost: 90 },
      { id: 'dn-bar-stools', label: 'Bar Stools', qty: true, unitCost: 90 },
    ],
  },
  {
    id: 'living',
    name: 'Living Room Assets',
    zone: 'Living',
    icon: 'Sofa',
    accent: '167 139 250', // violet-400
    items: [
      { id: 'l-sofa', label: 'Sofa', unitCost: 1000 },
      { id: 'l-loveseat', label: 'Loveseat / Chairs', qty: true, unitCost: 600 },
      { id: 'l-coffee-table', label: 'Coffee Table', unitCost: 200 },
      { id: 'l-end-tables', label: 'End Tables', qty: true, unitCost: 120 },
      { id: 'l-lamps', label: 'Lamps', qty: true, unitCost: 60 },
      { id: 'l-tv', label: 'TV', fields: ['brand', 'model', 'serial'], unitCost: 300 },
      { id: 'l-remotes', label: 'Remote Controls', qty: true, unitCost: 25 },
      { id: 'l-throw-pillows', label: 'Throw Pillows', qty: true, unitCost: 25 },
      { id: 'l-decor', label: 'Decorative Items', unitCost: 30 },
    ],
  },
  {
    id: 'bedrooms',
    name: 'Bedroom Assets',
    zone: 'Bedroom',
    icon: 'BedDouble',
    accent: '96 165 250', // blue-400
    items: [
      { id: 'b-bed-frame', label: 'Bed Frame', unitCost: 300 },
      { id: 'b-mattress', label: 'Mattress', unitCost: 750 },
      { id: 'b-box-spring', label: 'Box Spring / Foundation', unitCost: 200 },
      { id: 'b-headboard', label: 'Headboard', unitCost: 180 },
      { id: 'b-nightstands', label: 'Nightstands', qty: true, unitCost: 130 },
      { id: 'b-lamps', label: 'Lamps', qty: true, unitCost: 55 },
      { id: 'b-dresser', label: 'Dresser', unitCost: 400 },
      { id: 'b-tv', label: 'TV', hint: 'If applicable', unitCost: 250 },
      { id: 'b-hangers', label: 'Hangers', qty: true, hint: '10 per closet', unitCost: 2 },
    ],
  },
  {
    id: 'linens',
    name: 'Linens',
    zone: 'Bedroom',
    icon: 'Layers',
    accent: '129 140 248', // indigo-400
    items: [
      { id: 'ln-mattress-protector', label: 'Mattress Protector', qty: true, unitCost: 35 },
      {
        id: 'ln-pillows',
        label: 'Pillows',
        qty: true,
        hint: '2 twin · 4 full/queen · 4 king · 2 sofa',
        unitCost: 30,
      },
      { id: 'ln-pillow-protectors', label: 'Pillow Protectors', qty: true, unitCost: 12 },
    ],
  },
  {
    id: 'bathrooms',
    name: 'Bathroom Hardware',
    zone: 'Bathroom',
    icon: 'ShowerHead',
    accent: '45 212 191', // teal-400
    items: [
      { id: 'ba-shower', label: 'Shower Curtain / Glass Door', unitCost: 40 },
      { id: 'ba-hair-dryer', label: 'Hair Dryer', unitCost: 35 },
      { id: 'ba-trash-can', label: 'Trash Can', unitCost: 25 },
      { id: 'ba-toilet-brush', label: 'Toilet Brush', unitCost: 12 },
      { id: 'ba-tp-holder', label: 'Toilet Paper Holder', unitCost: 20 },
    ],
  },
  {
    id: 'laundry',
    name: 'Laundry Room',
    zone: 'Laundry',
    icon: 'WashingMachine',
    accent: '34 211 238', // cyan-400
    items: [
      { id: 'ldy-washer', label: 'Washer', fields: ['brand', 'model', 'serial'], unitCost: 900 },
      { id: 'ldy-dryer', label: 'Dryer', fields: ['brand', 'model', 'serial'], unitCost: 800 },
      { id: 'ldy-iron', label: 'Iron', unitCost: 40 },
      { id: 'ldy-ironing-board', label: 'Ironing Board', unitCost: 40 },
      { id: 'ldy-basket', label: 'Laundry Basket', unitCost: 20 },
    ],
  },
  {
    id: 'patio',
    name: 'Patio / Deck',
    zone: 'Outdoor',
    icon: 'Sun',
    accent: '163 230 53', // lime-400
    items: [
      { id: 'p-table', label: 'Patio Table', condition: true, hint: 'Any rust?', unitCost: 300 },
      { id: 'p-chairs', label: 'Patio Chairs', qty: true, condition: true, hint: 'Any rust?', unitCost: 110 },
      { id: 'p-lounge-chairs', label: 'Lounge Chairs', qty: true, condition: true, hint: 'Any rust?', unitCost: 180 },
      { id: 'p-cushions', label: 'Outdoor Cushions', qty: true, condition: true, hint: 'Stained, torn?', unitCost: 55 },
      { id: 'p-grill', label: 'Grill', condition: true, hint: 'Any rust?', unitCost: 400 },
    ],
  },
  {
    id: 'pool',
    name: 'Pool Area',
    zone: 'Outdoor',
    icon: 'Waves',
    accent: '56 189 248', // sky-400
    items: [
      { id: 'pl-furniture', label: 'Pool Furniture', qty: true, unitCost: 200 },
      { id: 'pl-umbrellas', label: 'Umbrellas', qty: true, unitCost: 130 },
      { id: 'pl-toys', label: 'Pool Toys', unitCost: 30 },
      { id: 'pl-equipment', label: 'Pool Equipment', unitCost: 150 },
    ],
  },
];

/* Flat index used by progress maths and the CSV writer, built once. */
export const ALL_ITEMS = SECTORS.flatMap((sector) =>
  sector.items.map((item) => ({
    ...item,
    sectorId: sector.id,
    sectorName: sector.name,
    zone: sector.zone,
  }))
);

export const TOTAL_ITEMS = ALL_ITEMS.length;

export const FIELD_LABELS = { brand: 'Brand', model: 'Model #', serial: 'Serial #' };
