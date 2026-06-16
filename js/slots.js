/* Body slots: where each clothing type sits on the figure, plus a small filled
   glyph per slot (used on the web graph). Pure data — no imports, so both the
   store and the figure/web renderers can use it without circular deps. */

export const SLOTS = [
  { id: 'head',   label: 'Head / hat' },
  { id: 'neck',   label: 'Neck / scarf' },
  { id: 'top',    label: 'Top (shirt, tee, sweater)' },
  { id: 'outer',  label: 'Outer layer (jacket, coat)' },
  { id: 'waist',  label: 'Belt / waist' },
  { id: 'bottom', label: 'Bottom (pants, shorts)' },
  { id: 'socks',  label: 'Socks' },
  { id: 'feet',   label: 'Shoes' },
  { id: 'wrist',  label: 'Watch / wrist' },
  { id: 'bag',    label: 'Bag' },
  { id: 'none',   label: 'Accessory (off-figure)' },
];
export const SLOT_LABEL = Object.fromEntries(SLOTS.map(s => [s.id, s.label]));

/* Guess a slot from a (possibly custom) type name. */
const NAME_SLOT = [
  [/hat|cap|beanie|toque/i, 'head'],
  [/scarf|tie|necklace|neck/i, 'neck'],
  [/base ?layer|t-?shirt|tee|shirt|overshirt|sweater|hoodie|polo|knit|top|tank|vest/i, 'top'],
  [/overcoat|trench|parka|jacket|rain|coat|blazer|anorak/i, 'outer'],
  [/belt/i, 'waist'],
  [/short/i, 'bottom'],
  [/pant|jean|trouser|chino|legging|cargo|bottom|slack/i, 'bottom'],
  [/sock/i, 'socks'],
  [/shoe|boot|sneaker|loafer|sandal|footwear|trainer/i, 'feet'],
  [/watch|bracelet|wrist/i, 'wrist'],
  [/bag|backpack|tote|satchel|purse/i, 'bag'],
];
export function inferSlot(name) {
  for (const [re, slot] of NAME_SLOT) if (re.test(name || '')) return slot;
  return 'none';
}
/* Resolve a type record's slot (explicit, else inferred from its name). */
export function slotForType(type) { return (type && type.slot) || inferSlot(type && type.name); }

/* Filled silhouette glyphs (24×24) per slot — drawn coloured on the web graph. */
export const SLOT_GLYPH = {
  head:   'M12 5a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z M4 12h17v2H4z',
  neck:   'M9 3h6l-1 9-2 8-2-8z',
  top:    'M9 3 4 6l2 4 2-1v9h8v-9l2 1 2-4-5-3-1.4 1.6a2.2 2.2 0 0 1-3.2 0z',
  outer:  'M8 3 5 5l1 15h4l1-8 1 8h4l1-15-3-2-2 2a3 3 0 0 1-4 0z',
  waist:  'M3 10h18v5H3z M10 10h4v5h-4z',
  bottom: 'M8 3h8l1 17h-4l-1-10-1 10H7z',
  socks:  'M8 3h5v9l4 4-3 3-6-6V3z',
  feet:   'M3 12c3 0 4 1 7 2l9 2c1 .3 2 .8 2 2H3z',
  wrist:  'M8 3h8v4H8z M8 17h8v4H8z M6 7h12v10H6z',
  bag:    'M7 8V7a5 5 0 0 1 10 0v1h3l1 13H3L4 8z M9 8V7a3 3 0 0 1 6 0v1',
  none:   'M11 3h3l7 7-8 8-7-7v-3l5-5z M9 8h.01',
};
export function slotGlyph(slot) { return SLOT_GLYPH[slot] || SLOT_GLYPH.none; }

/* Garment silhouettes for the figure: a path in its own local box, plus where
   that box sits on the 200×360 figure. Used both as the crop guide and as the
   shape the piece's texture/colour fills in the mockup. Only "paintable" slots
   appear here; others render as simple coloured marks. (local box == figure box
   so the path just needs translating, never scaling.) */
export const GARMENT = {
  head:   { w: 72,  h: 40,  box: { x: 64, y: 20,  w: 72,  h: 40 },
    path: 'M4 36 Q4 6 36 6 Q68 6 68 36 Z M36 30 H72 V38 H36 Z' },
  top:    { w: 116, h: 124, box: { x: 42, y: 70,  w: 116, h: 124 },
    path: 'M30 6 Q58 22 86 6 L116 22 L100 50 L88 42 L88 120 L28 120 L28 42 L16 50 L0 22 Z' },
  outer:  { w: 132, h: 156, box: { x: 34, y: 68,  w: 132, h: 156 },
    path: 'M34 6 Q66 20 98 6 L132 26 L116 64 L104 56 L104 150 L28 150 L28 56 L16 64 L0 26 Z' },
  bottom: { w: 72,  h: 158, box: { x: 64, y: 178, w: 72,  h: 158 },
    path: 'M2 4 H70 L66 156 L42 156 L36 70 L30 156 L6 156 Z' },
  feet:   { w: 84,  h: 24,  box: { x: 58, y: 326, w: 84,  h: 24 },
    path: 'M2 22 Q2 6 18 6 L34 6 L40 16 L40 22 Z M44 22 L44 16 L50 6 L66 6 Q82 6 82 22 Z' },
};
export function garmentFor(slot) { return GARMENT[slot] || null; }

