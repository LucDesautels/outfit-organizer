/* Reusable UI primitives: toasts, bottom sheets, confirm dialog,
   image picker (camera / gallery) and a touch-friendly cropper. */

import { node, icon, esc, clamp } from './util.js';
import { dataUrlToImage } from './image.js';

const overlayRoot = () => document.getElementById('overlay');
let openCount = 0;
function pushOverlay() { openCount++; overlayRoot().style.pointerEvents = 'auto'; }
function popOverlay() { openCount = Math.max(0, openCount - 1); if (!openCount) overlayRoot().style.pointerEvents = 'none'; }

/* Track open overlays so the hardware back button can dismiss the topmost. */
const overlayStack = [];
export function hasOverlay() { return overlayStack.length > 0; }
export function closeTopOverlay() {
  const top = overlayStack[overlayStack.length - 1];
  if (top) top.requestClose();
}
function registerOverlay(reg) { overlayStack.push(reg); }
function unregisterOverlay(reg) { const i = overlayStack.indexOf(reg); if (i >= 0) overlayStack.splice(i, 1); }

/* ---- toast -------------------------------------------------------------- */
export function toast(msg, ms = 1900) {
  const root = document.getElementById('toast');
  const t = node(`<div class="toast">${esc(msg)}</div>`);
  root.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, ms);
}

/* ---- bottom sheet ------------------------------------------------------- */
export function openSheet({ title, bodyEl, footEl }) {
  pushOverlay();
  const root = overlayRoot();
  const scrim = node(`<div class="scrim"></div>`);
  const sheet = node(`<div class="sheet" role="dialog" aria-modal="true">
    <div class="grab"></div>
    <div class="sheet-head"><h2>${esc(title || '')}</h2>
      <button class="iconbtn close-x" aria-label="Close">${icon('close')}</button></div>
    <div class="sheet-body"></div>
  </div>`);
  const body = sheet.querySelector('.sheet-body');
  if (bodyEl) body.appendChild(bodyEl);
  if (footEl) {
    const foot = node(`<div class="sheet-foot"></div>`);
    foot.appendChild(footEl);
    sheet.appendChild(foot);
  }
  root.appendChild(scrim);
  root.appendChild(sheet);
  requestAnimationFrame(() => { scrim.classList.add('show'); sheet.classList.add('show'); });

  const ctrl = { onDismiss: null, el: sheet, body };
  const reg = { requestClose: () => close(true) };
  registerOverlay(reg);
  let closed = false;
  function close(fromUser) {
    if (closed) return; closed = true;
    unregisterOverlay(reg);
    scrim.classList.remove('show'); sheet.classList.remove('show');
    setTimeout(() => { scrim.remove(); sheet.remove(); popOverlay(); }, 280);
    if (fromUser && ctrl.onDismiss) ctrl.onDismiss();
  }
  ctrl.close = () => close(false);
  scrim.addEventListener('click', () => close(true));
  sheet.querySelector('.close-x').addEventListener('click', () => close(true));
  return ctrl;
}

/* ---- confirm ------------------------------------------------------------ */
export function confirmDialog({ title = 'Are you sure?', message = '', okLabel = 'Delete', danger = true }) {
  return new Promise(resolve => {
    const body = node(`<p style="font-size:14.5px;color:var(--ink-2);line-height:1.5;margin:2px 0 4px">${esc(message)}</p>`);
    const foot = node(`<div style="display:flex;gap:10px;width:100%">
      <button class="btn ghost" data-act="cancel" style="flex:1">Cancel</button>
      <button class="btn ${danger ? 'danger' : ''}" data-act="ok" style="flex:1">${esc(okLabel)}</button>
    </div>`);
    const ctrl = openSheet({ title, bodyEl: body, footEl: foot });
    let answered = false;
    foot.querySelector('[data-act=cancel]').onclick = () => { answered = true; ctrl.close(); resolve(false); };
    foot.querySelector('[data-act=ok]').onclick = () => { answered = true; ctrl.close(); resolve(true); };
    ctrl.onDismiss = () => { if (!answered) resolve(false); };
  });
}

/* ---- prompt (single text field) ---------------------------------------- */
export function promptDialog({ title = 'Add', label = 'Name', value = '', okLabel = 'Save', extra = null }) {
  return new Promise(resolve => {
    const body = node(`<div>
      <div class="field"><label>${esc(label)}</label>
        <input class="input" type="text" value="${esc(value)}" placeholder="${esc(label)}" /></div>
      <div class="extra"></div>
    </div>`);
    if (extra) body.querySelector('.extra').appendChild(extra);
    const input = body.querySelector('input');
    const foot = node(`<div style="display:flex;gap:10px;width:100%">
      <button class="btn ghost" data-act="cancel" style="flex:1">Cancel</button>
      <button class="btn" data-act="ok" style="flex:1">${esc(okLabel)}</button>
    </div>`);
    const ctrl = openSheet({ title, bodyEl: body, footEl: foot });
    setTimeout(() => input.focus(), 120);
    let answered = false;
    const done = ok => { answered = true; ctrl.close(); resolve(ok ? input.value.trim() : null); };
    foot.querySelector('[data-act=cancel]').onclick = () => done(false);
    foot.querySelector('[data-act=ok]').onclick = () => done(true);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') done(true); });
    ctrl.onDismiss = () => { if (!answered) resolve(null); };
  });
}

/* ---- image picker (camera / gallery) ----------------------------------- */
export function pickFile({ camera = false } = {}) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (camera) input.capture = 'environment';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    let done = false;
    const cleanup = () => { try { input.remove(); } catch {} };
    input.addEventListener('change', () => {
      done = true;
      const f = input.files && input.files[0];
      cleanup();
      resolve(f || null);
    });
    // Fallback: if user cancels the native picker, resolve null on refocus.
    const onFocus = () => setTimeout(() => {
      if (!done) { cleanup(); resolve(null); }
      window.removeEventListener('focus', onFocus);
    }, 800);
    window.addEventListener('focus', onFocus);
    input.click();
  });
}

/* ---- cropper (full screen, touch) -------------------------------------- */
export function cropImage(srcDataUrl) {
  return new Promise(async resolve => {
    pushOverlay();
    const img = await dataUrlToImage(srcDataUrl);
    const fs = node(`<div class="fs">
      <div class="fs-head">
        <button class="x">Cancel</button>
        <div class="t">Crop</div>
        <button class="ok">Use</button>
      </div>
      <div class="fs-stage"></div>
    </div>`);
    const stage = fs.querySelector('.fs-stage');
    overlayRoot().appendChild(fs);
    const reg = { requestClose: () => finish(false) };
    registerOverlay(reg);
    requestAnimationFrame(() => fs.classList.add('show'));

    let imgEl, box, disp;
    // Build after layout so stage has size.
    requestAnimationFrame(() => requestAnimationFrame(build));

    function build() {
      const sw = stage.clientWidth, sh = stage.clientHeight;
      const natW = img.naturalWidth, natH = img.naturalHeight;
      const scale = Math.min(sw / natW, sh / natH);
      const dw = natW * scale, dh = natH * scale;
      const ox = (sw - dw) / 2, oy = (sh - dh) / 2;
      disp = { ox, oy, dw, dh, scale };

      imgEl = node(`<img alt="" style="position:absolute;left:${ox}px;top:${oy}px;width:${dw}px;height:${dh}px;user-select:none;pointer-events:none;-webkit-user-drag:none" />`);
      imgEl.src = srcDataUrl;
      stage.appendChild(imgEl);

      const inset = 0.08;
      const cb = { l: ox + dw * inset, t: oy + dh * inset, w: dw * (1 - inset * 2), h: dh * (1 - inset * 2) };
      box = node(`<div class="cropbox" style="position:absolute;box-shadow:0 0 0 9999px rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.95);touch-action:none">
        ${['tl', 'tr', 'bl', 'br'].map(h => `<span class="h ${h}" data-h="${h}"></span>`).join('')}
        <span class="g" style="position:absolute;inset:0;border:1px solid rgba(255,255,255,.35)"></span>
      </div>`);
      stage.appendChild(box);
      styleHandles(box);
      place(cb);
      bindDrag(cb);
    }

    function styleHandles(boxEl) {
      boxEl.querySelectorAll('.h').forEach(h => {
        Object.assign(h.style, {
          position: 'absolute', width: '26px', height: '26px',
          background: 'transparent', zIndex: '2',
        });
        const corner = h.dataset.h;
        const dot = document.createElement('span');
        Object.assign(dot.style, {
          position: 'absolute', width: '14px', height: '14px',
          border: '2px solid #fff', borderRadius: '2px',
          [corner[0] === 't' ? 'top' : 'bottom']: '-2px',
          [corner[1] === 'l' ? 'left' : 'right']: '-2px',
        });
        h.appendChild(dot);
        h.style[corner[0] === 't' ? 'top' : 'bottom'] = '-13px';
        h.style[corner[1] === 'l' ? 'left' : 'right'] = '-13px';
      });
    }

    let cur;
    function place(cb) {
      cur = cb;
      box.style.left = cb.l + 'px'; box.style.top = cb.t + 'px';
      box.style.width = cb.w + 'px'; box.style.height = cb.h + 'px';
    }
    function bounds() { return { l: disp.ox, t: disp.oy, r: disp.ox + disp.dw, b: disp.oy + disp.dh }; }

    function bindDrag(cb) {
      const MIN = 44;
      let mode = null, startX = 0, startY = 0, start = null;
      const onDown = e => {
        const handle = e.target.closest('.h');
        mode = handle ? handle.dataset.h : 'move';
        startX = e.clientX; startY = e.clientY; start = { ...cur };
        box.setPointerCapture(e.pointerId);
        e.preventDefault();
      };
      const onMove = e => {
        if (!mode) return;
        const dx = e.clientX - startX, dy = e.clientY - startY;
        const bb = bounds();
        let { l, t, w, h } = start;
        if (mode === 'move') {
          l = clamp(start.l + dx, bb.l, bb.r - w);
          t = clamp(start.t + dy, bb.t, bb.b - h);
        } else {
          let r = start.l + start.w, bot = start.t + start.h;
          if (mode.includes('l')) l = clamp(start.l + dx, bb.l, r - MIN);
          if (mode.includes('r')) r = clamp(start.l + start.w + dx, l + MIN, bb.r);
          if (mode.includes('t')) t = clamp(start.t + dy, bb.t, bot - MIN);
          if (mode.includes('b')) bot = clamp(start.t + start.h + dy, t + MIN, bb.b);
          w = r - l; h = bot - t;
        }
        place({ l, t, w, h });
        e.preventDefault();
      };
      const onUp = e => { mode = null; try { box.releasePointerCapture(e.pointerId); } catch {} };
      box.addEventListener('pointerdown', onDown);
      box.addEventListener('pointermove', onMove);
      box.addEventListener('pointerup', onUp);
      box.addEventListener('pointercancel', onUp);
    }

    let finished = false;
    function finish(ok) {
      if (finished) return; finished = true;
      unregisterOverlay(reg);
      fs.classList.remove('show');
      setTimeout(() => { fs.remove(); popOverlay(); }, 200);
      if (!ok) return resolve(null);
      const rect = {
        x: (cur.l - disp.ox) / disp.scale,
        y: (cur.t - disp.oy) / disp.scale,
        w: cur.w / disp.scale,
        h: cur.h / disp.scale,
      };
      resolve(rect);
    }
    fs.querySelector('.x').onclick = () => finish(false);
    fs.querySelector('.ok').onclick = () => finish(true);
  });
}

/* ---- shared render fragments ------------------------------------------- */
export function swatchHtml(color, cls = 'swatch') {
  if (!color) return '';
  const bg = color.hex === 'mix'
    ? 'background:conic-gradient(from 0deg,#e6b7c4,#d9b44a,#3f6b4a,#3a5a86,#5b4a78,#9b3b34,#e6b7c4)'
    : `background:${esc(color.hex)}`;
  return `<span class="${cls}" style="${bg}"></span>`;
}
export function phHtml() { return `<span class="ph">${icon('hanger')}</span>`; }
