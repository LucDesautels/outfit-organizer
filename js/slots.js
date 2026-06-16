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
