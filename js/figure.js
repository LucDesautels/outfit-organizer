/* Renders a fit as a simple 2D figure ("paper doll"): a thin body outline with
   each garment painted onto the body zone its type maps to. Used for fits that
   don't have an uploaded worn photo. Returns an <svg> string. */

import { typeById, colorById } from './store.js';
import { slotForType } from './slots.js';

const OUTLINE = '#cfcfcf';
const INK = '#1d1d1d';

/* main colour hex for a piece (first colour; mixmatched/none → neutral) */
function mainHex(it) {
  const c = it && (it.colorIds || []).map(colorById).find(Boolean);
  if (!c) return '#dcdcdc';
  return c.hex === 'mix' ? '#c7c7c7' : (c.hex || '#dcdcdc');
}
function typeName(it) { const t = typeById(it && it.typeId); return t ? t.name : ''; }

/* choose the outermost piece for a slot (so a sweater shows over a tee) */
function pickSlot(items, slot, orderFn) {
  const matches = items.filter(it => slotForType(typeById(it.typeId)) === slot);
  if (!matches.length) return null;
  return matches.sort((a, b) => orderFn(b) - orderFn(a))[0];
}

const r = (x, y, w, h, rad, fill, stroke) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rad}" ${fill ? `fill="${fill}"` : 'fill="none"'} ${stroke ? `stroke="${stroke}" stroke-width="2.4"` : ''}/>`;

/**
 * @param items  array of piece records
 * @param orderFn (item)=>number  layer order (pass typeOrder from views)
 */
export function figureSvg(items, orderFn = () => 0) {
  items = (items || []).filter(Boolean);
  const head = pickSlot(items, 'head', orderFn);
  const neck = pickSlot(items, 'neck', orderFn);
  const top = pickSlot(items, 'top', orderFn);
  const outer = pickSlot(items, 'outer', orderFn);
  const waist = pickSlot(items, 'waist', orderFn);
  const bottom = pickSlot(items, 'bottom', orderFn);
  const socks = pickSlot(items, 'socks', orderFn);
  const feet = pickSlot(items, 'feet', orderFn);
  const wrist = pickSlot(items, 'wrist', orderFn);
  const bag = pickSlot(items, 'bag', orderFn);

  const shorts = bottom && /short/i.test(typeName(bottom));
  const longSleeve = top && !/t-?shirt|tee|tank|polo|vest/i.test(typeName(top));

  const fills = [];   // painted garment shapes (under the outline)
  const overlay = []; // painted shapes drawn above the outline (accessories)

  // ----- legs / bottom -----
  const legTop = 188, legBot = 334, legH = (shorts ? 78 : legBot - legTop);
  if (bottom) {
    const c = mainHex(bottom);
    fills.push(r(70, legTop, 26, legH, 12, c));
    fills.push(r(104, legTop, 26, legH, 12, c));
  }
  // ----- socks -----
  if (socks) {
    const c = mainHex(socks);
    fills.push(r(70, 312, 26, 22, 7, c));
    fills.push(r(104, 312, 26, 22, 7, c));
  }
  // ----- shoes -----
  if (feet) {
    const c = mainHex(feet);
    fills.push(r(60, 330, 38, 18, 8, c));
    fills.push(r(102, 330, 38, 18, 8, c));
  }
  // ----- arms (sleeves) -----
  if (outer || (top && longSleeve)) {
    const c = mainHex(outer || top);
    fills.push(r(38, 84, 20, 94, 10, c));
    fills.push(r(142, 84, 20, 94, 10, c));
  }
  // ----- torso (innermost visible top) -----
  if (top || outer) {
    const c = mainHex(top || outer);
    fills.push(r(60, 78, 80, 106, 22, c));
  }
  // ----- outer coat: open front panels over the torso -----
  if (outer) {
    const c = mainHex(outer);
    fills.push(r(60, 80, 26, 102, 16, c));
    fills.push(r(114, 80, 26, 102, 16, c));
  }
  // ----- belt -----
  if (waist) fills.push(r(60, 170, 80, 13, 4, mainHex(waist)));
  // ----- scarf / neck -----
  if (neck) fills.push(r(84, 64, 32, 26, 8, mainHex(neck)));
  // ----- hat -----
  if (head) {
    const c = mainHex(head);
    fills.push(`<path d="M74 46a26 26 0 0 1 52 0z" fill="${c}"/>`);
    fills.push(r(118, 40, 30, 9, 4, c));
  }
  // ----- watch -----
  if (wrist) overlay.push(r(38, 150, 20, 13, 3, mainHex(wrist), INK));
  // ----- bag -----
  if (bag) {
    const c = mainHex(bag);
    overlay.push(`<path d="M150 150 q20 -26 28 0" fill="none" stroke="${INK}" stroke-width="2.2"/>`);
    overlay.push(r(150, 150, 34, 42, 8, c, INK));
  }

  // body outline (drawn over the fills for crisp edges)
  const outline = `
    <circle cx="100" cy="44" r="26" fill="none" stroke="${OUTLINE}" stroke-width="2.4"/>
    ${r(90, 66, 20, 14, 6, null, OUTLINE)}
    ${r(60, 78, 80, 106, 22, null, OUTLINE)}
    ${r(38, 84, 20, 94, 10, null, OUTLINE)}
    ${r(142, 84, 20, 94, 10, null, OUTLINE)}
    ${r(70, 188, 26, 146, 12, null, OUTLINE)}
    ${r(104, 188, 26, 146, 12, null, OUTLINE)}
    ${r(60, 330, 38, 18, 8, null, OUTLINE)}
    ${r(102, 330, 38, 18, 8, null, OUTLINE)}`;

  return `<svg class="figure" viewBox="0 0 200 360" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    <g stroke-linejoin="round" stroke-linecap="round">${fills.join('')}${outline}${overlay.join('')}</g>
  </svg>`;
}
