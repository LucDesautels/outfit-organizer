/* Generates maskable PNG app icons (no external deps).
   Run: node tools/gen-icons.mjs */
import zlib from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BG = [20, 20, 20];     // #141414
const FG = [255, 255, 255];

function distSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function render(size) {
  const s = size / 512;
  const half = (13 * s) / 2;            // stroke half-width
  const apex = [256 * s, 196 * s];
  const segs = [
    [apex[0], apex[1], 120 * s, 326 * s],     // left shoulder
    [apex[0], apex[1], 392 * s, 326 * s],     // right shoulder
    [120 * s, 326 * s, 392 * s, 326 * s],     // bottom bar
    [256 * s, 182 * s, 256 * s, 196 * s],     // hook stub
  ];
  const hook = { cx: 256 * s, cy: 158 * s, r: 24 * s };

  const px = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let d = Infinity;
      for (const sg of segs) d = Math.min(d, distSeg(x + 0.5, y + 0.5, sg[0], sg[1], sg[2], sg[3]));
      const dr = Math.abs(Math.hypot(x + 0.5 - hook.cx, y + 0.5 - hook.cy) - hook.r);
      d = Math.min(d, dr);
      const cov = Math.max(0, Math.min(1, half + 0.6 - d)); // antialiased coverage
      const i = (y * size + x) * 4;
      px[i] = Math.round(BG[0] * (1 - cov) + FG[0] * cov);
      px[i + 1] = Math.round(BG[1] * (1 - cov) + FG[1] * cov);
      px[i + 2] = Math.round(BG[2] * (1 - cov) + FG[2] * cov);
      px[i + 3] = 255;
    }
  }
  return px;
}

/* ---- minimal PNG encoder ---- */
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function png(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter type 0 (none)
    Buffer.from(rgba.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync(new URL('../icons/', import.meta.url), { recursive: true });
for (const size of [192, 512]) {
  const data = png(size, render(size));
  writeFileSync(new URL(`../icons/icon-${size}.png`, import.meta.url), data);
  console.log(`wrote icons/icon-${size}.png (${data.length} bytes)`);
}
