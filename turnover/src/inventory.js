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
      { id: 'k-refrigerator', label: 'Refrigerator', fields: ['brand', 'model', 'serial'] },
      { id: 'k-stove-oven', label: 'Stove / Oven', fields: ['brand', 'model', 'serial'] },
      { id: 'k-microwave', label: 'Microwave', fields: ['brand', 'model', 'serial'] },
      { id: 'k-dishwasher', label: 'Dishwasher', fields: ['brand', 'model', 'serial'] },
      { id: 'k-coffee-maker', label: 'Coffee Maker', hint: 'Regular or Keurig' },
      { id: 'k-toaster', label: 'Toaster' },
      { id: 'k-blender', label: 'Blender' },
    ],
  },
  {
    id: 'kitchen-cookware',
    name: 'Cookware',
    zone: 'Kitchen',
    icon: 'CookingPot',
    accent: '245 158 11',
    items: [
      { id: 'c-pots', label: 'Pots', qty: true },
      { id: 'c-pans', label: 'Pans', qty: true },
      { id: 'c-baking-sheets', label: 'Baking Sheets' },
      { id: 'c-mixing-bowls', label: 'Mixing Bowls' },
      { id: 'c-measuring', label: 'Measuring Cups / Spoons' },
      { id: 'c-colander', label: 'Colander' },
    ],
  },
  {
    id: 'kitchen-dinnerware',
    name: 'Dinnerware',
    zone: 'Kitchen',
    icon: 'Soup',
    accent: '251 191 36', // amber-400
    items: [
      { id: 'd-dinner-plates', label: 'Dinner Plates', qty: true },
      { id: 'd-salad-plates', label: 'Salad Plates', qty: true },
      { id: 'd-bowls', label: 'Bowls', qty: true },
      { id: 'd-coffee-mugs', label: 'Coffee Mugs', qty: true },
      { id: 'd-drinking-glasses', label: 'Drinking Glasses', qty: true },
      { id: 'd-wine-glasses', label: 'Wine Glasses', qty: true },
    ],
  },
  {
    id: 'kitchen-utensils',
    name: 'Utensils',
    zone: 'Kitchen',
    icon: 'UtensilsCrossed',
    accent: '251 191 36',
    items: [
      { id: 'u-forks', label: 'Forks', qty: true, hint: 'How many?' },
      { id: 'u-knives', label: 'Knives', qty: true, hint: 'How many?' },
      { id: 'u-spoons', label: 'Spoons', qty: true, hint: 'How many?' },
      { id: 'u-serving', label: 'Serving Utensils' },
      { id: 'u-can-opener', label: 'Can Opener' },
      { id: 'u-corkscrew', label: 'Corkscrew' },
      { id: 'u-knife-set', label: 'Knife Set' },
    ],
  },
  {
    id: 'dining',
    name: 'Dining Area',
    zone: 'Dining',
    icon: 'Utensils',
    accent: '249 115 22', // orange-500
    items: [
      { id: 'dn-table', label: 'Dining Table' },
      { id: 'dn-chairs', label: 'Dining Chairs', qty: true },
      { id: 'dn-bar-stools', label: 'Bar Stools', qty: true },
    ],
  },
  {
    id: 'living',
    name: 'Living Room Assets',
    zone: 'Living',
    icon: 'Sofa',
    accent: '167 139 250', // violet-400
    items: [
      { id: 'l-sofa', label: 'Sofa' },
      { id: 'l-loveseat', label: 'Loveseat / Chairs', qty: true },
      { id: 'l-coffee-table', label: 'Coffee Table' },
      { id: 'l-end-tables', label: 'End Tables', qty: true },
      { id: 'l-lamps', label: 'Lamps', qty: true },
      { id: 'l-tv', label: 'TV', fields: ['brand', 'model', 'serial'] },
      { id: 'l-remotes', label: 'Remote Controls', qty: true },
      { id: 'l-throw-pillows', label: 'Throw Pillows', qty: true },
      { id: 'l-decor', label: 'Decorative Items' },
    ],
  },
  {
    id: 'bedrooms',
    name: 'Bedroom Assets',
    zone: 'Bedroom',
    icon: 'BedDouble',
    accent: '96 165 250', // blue-400
    items: [
      { id: 'b-bed-frame', label: 'Bed Frame' },
      { id: 'b-mattress', label: 'Mattress' },
      { id: 'b-box-spring', label: 'Box Spring / Foundation' },
      { id: 'b-headboard', label: 'Headboard' },
      { id: 'b-nightstands', label: 'Nightstands', qty: true },
      { id: 'b-lamps', label: 'Lamps', qty: true },
      { id: 'b-dresser', label: 'Dresser' },
      { id: 'b-tv', label: 'TV', hint: 'If applicable' },
      { id: 'b-hangers', label: 'Hangers', qty: true, hint: '10 per closet' },
    ],
  },
  {
    id: 'linens',
    name: 'Linens',
    zone: 'Bedroom',
    icon: 'Layers',
    accent: '129 140 248', // indigo-400
    items: [
      { id: 'ln-mattress-protector', label: 'Mattress Protector', qty: true },
      {
        id: 'ln-pillows',
        label: 'Pillows',
        qty: true,
        hint: '2 twin · 4 full/queen · 4 king · 2 sofa',
      },
      { id: 'ln-pillow-protectors', label: 'Pillow Protectors', qty: true },
    ],
  },
  {
    id: 'bathrooms',
    name: 'Bathroom Hardware',
    zone: 'Bathroom',
    icon: 'ShowerHead',
    accent: '45 212 191', // teal-400
    items: [
      { id: 'ba-shower', label: 'Shower Curtain / Glass Door' },
      { id: 'ba-hair-dryer', label: 'Hair Dryer' },
      { id: 'ba-trash-can', label: 'Trash Can' },
      { id: 'ba-toilet-brush', label: 'Toilet Brush' },
      { id: 'ba-tp-holder', label: 'Toilet Paper Holder' },
    ],
  },
  {
    id: 'laundry',
    name: 'Laundry Room',
    zone: 'Laundry',
    icon: 'WashingMachine',
    accent: '34 211 238', // cyan-400
    items: [
      { id: 'ldy-washer', label: 'Washer', fields: ['brand', 'model', 'serial'] },
      { id: 'ldy-dryer', label: 'Dryer', fields: ['brand', 'model', 'serial'] },
      { id: 'ldy-iron', label: 'Iron' },
      { id: 'ldy-ironing-board', label: 'Ironing Board' },
      { id: 'ldy-basket', label: 'Laundry Basket' },
    ],
  },
  {
    id: 'patio',
    name: 'Patio / Deck',
    zone: 'Outdoor',
    icon: 'Sun',
    accent: '163 230 53', // lime-400
    items: [
      { id: 'p-table', label: 'Patio Table', condition: true, hint: 'Any rust?' },
      { id: 'p-chairs', label: 'Patio Chairs', qty: true, condition: true, hint: 'Any rust?' },
      { id: 'p-lounge-chairs', label: 'Lounge Chairs', qty: true, condition: true, hint: 'Any rust?' },
      { id: 'p-cushions', label: 'Outdoor Cushions', qty: true, condition: true, hint: 'Stained, torn?' },
      { id: 'p-grill', label: 'Grill', condition: true, hint: 'Any rust?' },
    ],
  },
  {
    id: 'pool',
    name: 'Pool Area',
    zone: 'Outdoor',
    icon: 'Waves',
    accent: '56 189 248', // sky-400
    items: [
      { id: 'pl-furniture', label: 'Pool Furniture', qty: true },
      { id: 'pl-umbrellas', label: 'Umbrellas', qty: true },
      { id: 'pl-toys', label: 'Pool Toys' },
      { id: 'pl-equipment', label: 'Pool Equipment' },
    ],
  },
];

/* Flat index used by progress maths and the CSV writer, built once. */
export const ALL_ITEMS = SECTORS.flatMap((sector) =>
  sector.items.map((item) => ({ ...item, sectorId: sector.id, sectorName: sector.name }))
);

export const TOTAL_ITEMS = ALL_ITEMS.length;

export const FIELD_LABELS = { brand: 'Brand', model: 'Model #', serial: 'Serial #' };
