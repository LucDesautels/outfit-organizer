/* Renders a fit as a simple 2D figure ("paper doll"): a thin body outline with
   each garment drawn as its silhouette, filled with the piece's cropped texture
   (it.cutout) when available, otherwise its main colour. Used for fits without
   an uploaded worn photo. Returns an <svg> string. */

import { typeById, colorById } from './store.js';
import { slotForType, garmentFor } from './slots.js';

const OUTLINE = '#cfcfcf';
const INK = '#1d1d1d';

function mainHex(it) {
  const c = it && (it.colorIds || []).map(colorById).find(Boolean);
  if (!c) return '#dcdcdc';
  return c.hex === 'mix' ? '#c7c7c7' : (c.hex || '#dcdcdc');
}
function typeName(it) { const t = typeById(it && it.typeId); return t ? t.name : ''; }

function pickSlot(items, slot, orderFn) {
  const matches = items.filter(it => slotForType(typeById(it.typeId)) === slot);
  if (!matches.length) return null;
  return matches.sort((a, b) => orderFn(b) - orderFn(a))[0];
}

const r = (x, y, w, h, rad, fill, stroke) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rad}" ${fill ? `fill="${fill}"` : 'fill="none"'} ${stroke ? `stroke="${stroke}" stroke-width="2.4"` : ''}/>`;

/* one garment: its silhouette filled with texture (cutout) or solid colour */
function garment(slot, it, uid) {
  const g = garmentFor(slot);
  if (!g || !it) return '';
  const { box: b, path } = g;
  const T = `translate(${b.x} ${b.y})`;
  const outline = `<g transform="${T}"><path d="${path}" fill="none" stroke="${INK}" stroke-width="2" vector-effect="non-scaling-stroke"/></g>`;
  if (it.cutout) {
    const cid = `cp-${slot}-${uid}`;
    return `<clipPath id="${cid}" transform="${T}"><path d="${path}"/></clipPath>`
      + `<image href="${it.cutout}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${cid})"/>`
      + outline;
  }
  return `<g transform="${T}"><path d="${path}" fill="${mainHex(it)}"/></g>` + outline;
}

/**
 * @param items   array of piece records
 * @param orderFn (item)=>number  layer order (pass typeOrder from views)
 */
export function figureSvg(items, orderFn = () => 0) {
  items = (items || []).filter(Boolean);
  const uid = Math.random().toString(36).slice(2, 8);
  const get = slot => pickSlot(items, slot, orderFn);
  const head = get('head'), neck = get('neck'), top = get('top'), outer = get('outer');
  const waist = get('waist'), bottom = get('bottom'), socks = get('socks');
  const feet = get('feet'), wrist = get('wrist'), bag = get('bag');

  // body outline (person) — drawn first so garments sit on top
  const body = `<g fill="none" stroke="${OUTLINE}" stroke-width="2.4" stroke-linejoin="round">
    <circle cx="100" cy="44" r="26"/>
    ${r(90, 66, 20, 14, 6)}
    ${r(60, 78, 80, 106, 22)}
    ${r(38, 84, 20, 94, 10)}
    ${r(142, 84, 20, 94, 10)}
    ${r(70, 188, 26, 146, 12)}
    ${r(104, 188, 26, 146, 12)}
    ${r(60, 330, 38, 18, 8)}
    ${r(102, 330, 38, 18, 8)}
  </g>`;

  // simple coloured accessories (no texture)
  const socksSvg = socks ? r(70, 312, 26, 20, 6, mainHex(socks), INK) + r(104, 312, 26, 20, 6, mainHex(socks), INK) : '';
  const waistSvg = waist ? r(58, 170, 84, 13, 4, mainHex(waist), INK) : '';
  const neckSvg = neck ? r(84, 64, 32, 24, 8, mainHex(neck), INK) : '';
  const wristSvg = wrist ? r(38, 150, 20, 13, 3, mainHex(wrist), INK) : '';
  const bagSvg = bag ? `<path d="M150 150 q20 -26 28 0" fill="none" stroke="${INK}" stroke-width="2.2"/>` + r(150, 150, 34, 42, 8, mainHex(bag), INK) : '';

  // draw order: legs/shoes, waist, top, coat, then head/extras on top
  const layers = [
    garment('bottom', bottom, uid), socksSvg, garment('feet', feet, uid), waistSvg,
    garment('top', top, uid), garment('outer', outer, uid), neckSvg,
    garment('head', head, uid), wristSvg, bagSvg,
  ].join('');

  return `<svg class="figure" viewBox="0 0 200 360" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    <g stroke-linejoin="round" stroke-linecap="round">${body}${layers}</g>
  </svg>`;
}
