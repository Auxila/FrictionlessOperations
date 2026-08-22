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
 * `unitCost` is the median replacement cost of ONE of the thing, in USD. It
 * exists so an operative never has to guess a number in the field: flag a
 * deficit and the cost pre-fills, multiplied by the shortfall where a count is
 * involved (2 forks short -> 2 x $3). It is always editable, and an edited
 * figure is never overwritten.
 *
 * PRICED FOR MEXICO BEACH, FL (Gulf Coast panhandle), Aug 2026:
 *
 *   - Basis is Panama City metro shelf price. There is no big-box retail in
 *     Mexico Beach; the nearest Home Depot is ~32 miles up US-98 in Panama
 *     City, with Lowe's and Walmart alongside it. That is where a replacement
 *     actually gets bought, and it sits inside the free appliance-delivery
 *     radius, so no freight premium is baked in.
 *   - Includes 7% sales tax (6% Florida + 1% county surtax). Mexico Beach
 *     straddles the Bay/Gulf county line and both are 7%, so the split does
 *     not matter. These are what leaves the bank account, not shelf stickers.
 *   - Outdoor assets are priced at SALT-AIR GRADE and run above the national
 *     median: powder-coated aluminum and resin wicker rather than steel,
 *     solution-dyed cushions that survive UV and mildew, stainless on the
 *     grill. Cheap outdoor furniture on the Gulf is a yearly purchase, so the
 *     honest replacement cost is the one that lasts a season.
 *
 * Revisit after any hurricane season that moves demand — panhandle prices for
 * appliances and outdoor furniture spike hard after a storm.
 *
 * These are ESTIMATES for triage, not quotations, and are labelled as such
 * everywhere they surface. This table is the only place they live.
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
      { id: 'k-refrigerator', label: 'Refrigerator', fields: ['brand', 'model', 'serial'], unitCost: 1180 },
      { id: 'k-stove-oven', label: 'Stove / Oven', fields: ['brand', 'model', 'serial'], unitCost: 965 },
      { id: 'k-microwave', label: 'Microwave', fields: ['brand', 'model', 'serial'], unitCost: 140 },
      { id: 'k-dishwasher', label: 'Dishwasher', fields: ['brand', 'model', 'serial'], unitCost: 695 },
      { id: 'k-coffee-maker', label: 'Coffee Maker', hint: 'Regular or Keurig', unitCost: 75 },
      { id: 'k-toaster', label: 'Toaster', unitCost: 38 },
      { id: 'k-blender', label: 'Blender', unitCost: 65 },
    ],
  },
  {
    id: 'kitchen-cookware',
    name: 'Cookware',
    zone: 'Kitchen',
    icon: 'CookingPot',
    accent: '245 158 11',
    items: [
      { id: 'c-pots', label: 'Pots', qty: true, unitCost: 38 },
      { id: 'c-pans', label: 'Pans', qty: true, unitCost: 32 },
      { id: 'c-baking-sheets', label: 'Baking Sheets', unitCost: 16 },
      { id: 'c-mixing-bowls', label: 'Mixing Bowls', unitCost: 20 },
      { id: 'c-measuring', label: 'Measuring Cups / Spoons', unitCost: 16 },
      { id: 'c-colander', label: 'Colander', unitCost: 16 },
    ],
  },
  {
    id: 'kitchen-dinnerware',
    name: 'Dinnerware',
    zone: 'Kitchen',
    icon: 'Soup',
    accent: '251 191 36', // amber-400
    items: [
      { id: 'd-dinner-plates', label: 'Dinner Plates', qty: true, unitCost: 9 },
      { id: 'd-salad-plates', label: 'Salad Plates', qty: true, unitCost: 7 },
      { id: 'd-bowls', label: 'Bowls', qty: true, unitCost: 7 },
      { id: 'd-coffee-mugs', label: 'Coffee Mugs', qty: true, unitCost: 7 },
      { id: 'd-drinking-glasses', label: 'Drinking Glasses', qty: true, unitCost: 6 },
      { id: 'd-wine-glasses', label: 'Wine Glasses', qty: true, unitCost: 8 },
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
      /* The source document says just "Knives" here, sitting two lines above
       * "Knife Set". Unqualified, a reader of the report cannot tell whether
       * a shortfall of 43 means table knives or forty-three chef's knives —
       * so the label states which. Same id, so existing audits are unaffected. */
      { id: 'u-knives', label: 'Butter Knives', qty: true, hint: 'How many?', unitCost: 3 },
      { id: 'u-spoons', label: 'Spoons', qty: true, hint: 'How many?', unitCost: 3 },
      { id: 'u-serving', label: 'Serving Utensils', unitCost: 13 },
      { id: 'u-can-opener', label: 'Can Opener', unitCost: 16 },
      { id: 'u-corkscrew', label: 'Corkscrew', unitCost: 13 },
      { id: 'u-knife-set', label: 'Knife Set', unitCost: 95 },
    ],
  },
  {
    id: 'dining',
    name: 'Dining Area',
    zone: 'Dining',
    icon: 'Utensils',
    accent: '249 115 22', // orange-500
    items: [
      { id: 'dn-table', label: 'Dining Table', unitCost: 480 },
      { id: 'dn-chairs', label: 'Dining Chairs', qty: true, unitCost: 95 },
      { id: 'dn-bar-stools', label: 'Bar Stools', qty: true, unitCost: 95 },
    ],
  },
  {
    id: 'living',
    name: 'Living Room Assets',
    zone: 'Living',
    icon: 'Sofa',
    accent: '167 139 250', // violet-400
    items: [
      { id: 'l-sofa', label: 'Sofa', unitCost: 1070 },
      { id: 'l-loveseat', label: 'Loveseat / Chairs', qty: true, unitCost: 640 },
      { id: 'l-coffee-table', label: 'Coffee Table', unitCost: 215 },
      { id: 'l-end-tables', label: 'End Tables', qty: true, unitCost: 130 },
      { id: 'l-lamps', label: 'Lamps', qty: true, unitCost: 65 },
      { id: 'l-tv', label: 'TV', fields: ['brand', 'model', 'serial'], unitCost: 320 },
      { id: 'l-remotes', label: 'Remote Controls', qty: true, unitCost: 27 },
      { id: 'l-throw-pillows', label: 'Throw Pillows', qty: true, unitCost: 27 },
      { id: 'l-decor', label: 'Decorative Items', unitCost: 32 },
    ],
  },
  {
    id: 'bedrooms',
    name: 'Bedroom Assets',
    zone: 'Bedroom',
    icon: 'BedDouble',
    accent: '96 165 250', // blue-400
    items: [
      { id: 'b-bed-frame', label: 'Bed Frame', unitCost: 320 },
      { id: 'b-mattress', label: 'Mattress', unitCost: 800 },
      { id: 'b-box-spring', label: 'Box Spring / Foundation', unitCost: 215 },
      { id: 'b-headboard', label: 'Headboard', unitCost: 195 },
      { id: 'b-nightstands', label: 'Nightstands', qty: true, unitCost: 140 },
      { id: 'b-lamps', label: 'Lamps', qty: true, unitCost: 60 },
      { id: 'b-dresser', label: 'Dresser', unitCost: 430 },
      { id: 'b-tv', label: 'TV', hint: 'If applicable', unitCost: 270 },
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
      { id: 'ln-mattress-protector', label: 'Mattress Protector', qty: true, unitCost: 38 },
      {
        id: 'ln-pillows',
        label: 'Pillows',
        qty: true,
        hint: '2 twin · 4 full/queen · 4 king · 2 sofa',
        unitCost: 32,
      },
      { id: 'ln-pillow-protectors', label: 'Pillow Protectors', qty: true, unitCost: 13 },
    ],
  },
  {
    id: 'bathrooms',
    name: 'Bathroom Hardware',
    zone: 'Bathroom',
    icon: 'ShowerHead',
    accent: '45 212 191', // teal-400
    items: [
      { id: 'ba-shower', label: 'Shower Curtain / Glass Door', unitCost: 43 },
      { id: 'ba-hair-dryer', label: 'Hair Dryer', unitCost: 38 },
      { id: 'ba-trash-can', label: 'Trash Can', unitCost: 27 },
      { id: 'ba-toilet-brush', label: 'Toilet Brush', unitCost: 13 },
      { id: 'ba-tp-holder', label: 'Toilet Paper Holder', unitCost: 21 },
    ],
  },
  {
    id: 'laundry',
    name: 'Laundry Room',
    zone: 'Laundry',
    icon: 'WashingMachine',
    accent: '34 211 238', // cyan-400
    items: [
      { id: 'ldy-washer', label: 'Washer', fields: ['brand', 'model', 'serial'], unitCost: 965 },
      { id: 'ldy-dryer', label: 'Dryer', fields: ['brand', 'model', 'serial'], unitCost: 855 },
      { id: 'ldy-iron', label: 'Iron', unitCost: 43 },
      { id: 'ldy-ironing-board', label: 'Ironing Board', unitCost: 43 },
      { id: 'ldy-basket', label: 'Laundry Basket', unitCost: 21 },
    ],
  },
  {
    id: 'patio',
    name: 'Patio / Deck',
    zone: 'Outdoor',
    icon: 'Sun',
    accent: '163 230 53', // lime-400
    items: [
      { id: 'p-table', label: 'Patio Table', condition: true, hint: 'Any rust?', unitCost: 430 },
      { id: 'p-chairs', label: 'Patio Chairs', qty: true, condition: true, hint: 'Any rust?', unitCost: 150 },
      { id: 'p-lounge-chairs', label: 'Lounge Chairs', qty: true, condition: true, hint: 'Any rust?', unitCost: 245 },
      { id: 'p-cushions', label: 'Outdoor Cushions', qty: true, condition: true, hint: 'Stained, torn?', unitCost: 80 },
      { id: 'p-grill', label: 'Grill', condition: true, hint: 'Any rust?', unitCost: 515 },
    ],
  },
  {
    id: 'pool',
    name: 'Pool Area',
    zone: 'Outdoor',
    icon: 'Waves',
    accent: '56 189 248', // sky-400
    items: [
      { id: 'pl-furniture', label: 'Pool Furniture', qty: true, unitCost: 270 },
      { id: 'pl-umbrellas', label: 'Umbrellas', qty: true, unitCost: 180 },
      { id: 'pl-toys', label: 'Pool Toys', unitCost: 32 },
      { id: 'pl-equipment', label: 'Pool Equipment', unitCost: 160 },
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
