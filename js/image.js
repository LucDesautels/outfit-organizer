/* Image helpers: load, downscale, crop. Everything stays on-device. */

const MAX_DIM = 1280;      // longest edge after import
const QUALITY = 0.82;

/** Read a File/Blob into an HTMLImageElement. */
export function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve(img); /* keep url until caller draws */ img._objectUrl = url; };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

export function dataUrlToImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function pickMime() {
  // Prefer webp (smaller) where supported, else jpeg.
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const webp = c.toDataURL('image/webp');
  return webp.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
}
const MIME = pickMime();

/** Downscale an image element to a compressed data URL. */
export function imageToDataUrl(img, maxDim = MAX_DIM) {
  let { naturalWidth: w, naturalHeight: h } = img;
  if (!w || !h) { w = img.width; h = img.height; }
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const cw = Math.round(w * scale), ch = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, cw, ch);
  return canvas.toDataURL(MIME, QUALITY);
}

/** Full pipeline: File -> compressed data URL. */
export async function processFile(file) {
  const img = await fileToImage(file);
  const url = imageToDataUrl(img);
  if (img._objectUrl) URL.revokeObjectURL(img._objectUrl);
  return url;
}

/**
 * Crop a source image (data URL) to a rectangle expressed in *natural*
 * source pixels, returning a compressed data URL.
 */
export async function cropToDataUrl(srcDataUrl, rect, maxDim = MAX_DIM) {
  const img = await dataUrlToImage(srcDataUrl);
  const sx = Math.max(0, Math.round(rect.x));
  const sy = Math.max(0, Math.round(rect.y));
  const sw = Math.max(1, Math.round(rect.w));
  const sh = Math.max(1, Math.round(rect.h));
  const scale = Math.min(1, maxDim / Math.max(sw, sh));
  const cw = Math.round(sw * scale), ch = Math.round(sh * scale);
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
  return canvas.toDataURL(MIME, QUALITY);
}
