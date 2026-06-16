/* Force-directed "web" of pieces, grouped by ecosystem or fit.
   Self-contained canvas renderer with pan / pinch-zoom / tap. */

import { state, colorById, typeById } from './store.js';
import { slotForType, slotGlyph } from './slots.js';

const glyphCache = {};
function glyphPath(slot) { return glyphCache[slot] || (glyphCache[slot] = new Path2D(slotGlyph(slot))); }

const PALETTE = ['#b8893b', '#5b6236', '#3a5a86', '#9b3b34', '#5b4a78',
  '#3f6b4a', '#a85c7a', '#7a6a4f', '#456b6e', '#8a5a3c'];

export function mountWeb(container, { groupBy = 'ecosystem', onSelect } = {}) {
  const canvas = document.createElement('canvas');
  canvas.id = 'graph-canvas';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let DPR = Math.min(2, window.devicePixelRatio || 1);
  let W = 0, H = 0;

  // ---- build graph ------------------------------------------------------
  const nodes = [];
  const edges = [];

  const groups = groupBy === 'fit' ? state.fits : state.ecosystems;
  const groupNodes = new Map();
  groups.forEach((g, i) => {
    const color = (groupBy === 'ecosystem' && g.accent) ? g.accent : PALETTE[i % PALETTE.length];
    const n = {
      id: 'g:' + g.id, kind: 'group', ref: g, color,
      label: g.name || (groupBy === 'fit' ? 'Untitled fit' : 'Untitled'),
      x: rnd(160), y: rnd(160), vx: 0, vy: 0, r: 13, pinned: false,
    };
    nodes.push(n); groupNodes.set(g.id, n);
  });

  const itemNodes = new Map();
  state.items.forEach(it => {
    const col = colorById((it.colorIds || [])[0]);
    const hex = col && col.hex !== 'mix' ? col.hex : '#cfcfcf';
    const n = {
      id: 'i:' + it.id, kind: 'item', ref: it, color: hex,
      x: rnd(220), y: rnd(220), vx: 0, vy: 0, r: 16, pinned: false,
      slot: slotForType(typeById(it.typeId)),
    };
    nodes.push(n); itemNodes.set(it.id, n);
  });

  // edges + degree (for sizing)
  const degree = new Map();
  groups.forEach(g => {
    (g.itemIds || []).forEach(iid => {
      const a = groupNodes.get(g.id), b = itemNodes.get(iid);
      if (a && b) {
        edges.push({ a, b, color: a.color });
        degree.set(a.id, (degree.get(a.id) || 0) + 1);
      }
    });
  });
  nodes.forEach(n => { if (n.kind === 'group') n.r = 12 + Math.min(10, (degree.get(n.id) || 0) * 1.4); });

  function rnd(s) { return (Math.random() - 0.5) * s; }

  // ---- view transform ---------------------------------------------------
  const view = { x: 0, y: 0, k: 0.9 };
  function resize() {
    const rect = container.getBoundingClientRect();
    W = rect.width; H = rect.height;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  view.x = W / 2; view.y = H / 2;
  const toScreen = p => ({ x: p.x * view.k + view.x, y: p.y * view.k + view.y });
  const toWorld = (sx, sy) => ({ x: (sx - view.x) / view.k, y: (sy - view.y) / view.k });

  // ---- physics ----------------------------------------------------------
  let alpha = 1;
  function step() {
    if (alpha < 0.005) return;
    const REP = 1400, SPRING = 0.015, REST = 90, GRAV = 0.02, DAMP = 0.86;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy || 0.01;
        const f = REP / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
    }
    for (const e of edges) {
      let dx = e.b.x - e.a.x, dy = e.b.y - e.a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = (d - REST) * SPRING;
      const fx = (dx / d) * f, fy = (dy / d) * f;
      e.a.vx += fx; e.a.vy += fy; e.b.vx -= fx; e.b.vy -= fy;
    }
    for (const n of nodes) {
      n.vx -= n.x * GRAV; n.vy -= n.y * GRAV;
      if (n.pinned) { n.vx = 0; n.vy = 0; continue; }
      n.vx *= DAMP; n.vy *= DAMP;
      n.x += n.vx * alpha; n.y += n.vy * alpha;
    }
    alpha *= 0.992;
  }
  function reheat() { alpha = Math.max(alpha, 0.4); }

  // ---- draw -------------------------------------------------------------
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0d0d0d'; ctx.fillRect(0, 0, W, H);
    // edges
    ctx.lineWidth = 1;
    for (const e of edges) {
      const pa = toScreen(e.a), pb = toScreen(e.b);
      ctx.strokeStyle = hexA(e.color, 0.32);
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
    }
    // nodes
    for (const n of nodes) {
      const p = toScreen(n);
      const r = n.r * view.k;
      if (n.kind === 'item') {
        // coloured clothing-type glyph (e.g. a beige overcoat = coat icon, beige)
        const size = r * 2.3;
        ctx.fillStyle = 'rgba(255,255,255,.05)';
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.save();
        ctx.translate(p.x - size / 2, p.y - size / 2);
        ctx.scale(size / 24, size / 24);
        const path = glyphPath(n.slot);
        ctx.fillStyle = n.color;
        ctx.fill(path);
        ctx.lineWidth = 1.5 * (24 / size);
        ctx.strokeStyle = 'rgba(255,255,255,.6)';
        ctx.stroke(path);
        ctx.restore();
      } else {
        // group hub
        ctx.fillStyle = n.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke();
        if (view.k > 0.5) {
          ctx.fillStyle = 'rgba(255,255,255,.92)';
          ctx.font = `${Math.round(12)}px ui-sans-serif, system-ui, sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.fillText(trunc(n.label, 18), p.x, p.y + r + 4);
        }
      }
    }
  }

  let raf;
  function frame() { step(); draw(); raf = requestAnimationFrame(frame); }
  frame();

  // ---- interaction ------------------------------------------------------
  const pointers = new Map();
  let dragNode = null, panning = false, last = null, downAt = 0, downPos = null, pinchDist = 0;

  function hit(sx, sy) {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i], p = toScreen(n);
      const r = Math.max(14, n.r * view.k);
      if ((sx - p.x) ** 2 + (sy - p.y) ** 2 <= r * r) return n;
    }
    return null;
  }
  const rectOf = () => canvas.getBoundingClientRect();

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    const rect = rectOf();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    pointers.set(e.pointerId, { sx, sy });
    if (pointers.size === 1) {
      downAt = Date.now(); downPos = { sx, sy };
      const n = hit(sx, sy);
      if (n) { dragNode = n; n.pinned = true; }
      else { panning = true; }
      last = { sx, sy };
    } else if (pointers.size === 2) {
      panning = false; dragNode && (dragNode.pinned = false); dragNode = null;
      const pts = [...pointers.values()];
      pinchDist = Math.hypot(pts[0].sx - pts[1].sx, pts[0].sy - pts[1].sy);
    }
  });

  canvas.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    const rect = rectOf();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    pointers.set(e.pointerId, { sx, sy });

    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      const dist = Math.hypot(pts[0].sx - pts[1].sx, pts[0].sy - pts[1].sy);
      const mid = { x: (pts[0].sx + pts[1].sx) / 2, y: (pts[0].sy + pts[1].sy) / 2 };
      if (pinchDist > 0) {
        const factor = dist / pinchDist;
        const w = toWorld(mid.x, mid.y);
        view.k = Math.max(0.2, Math.min(4, view.k * factor));
        const s2 = toScreen(w);
        view.x += mid.x - s2.x; view.y += mid.y - s2.y;
      }
      pinchDist = dist;
      return;
    }
    if (dragNode) {
      const w = toWorld(sx, sy);
      dragNode.x = w.x; dragNode.y = w.y; dragNode.vx = dragNode.vy = 0;
      reheat();
    } else if (panning && last) {
      view.x += sx - last.sx; view.y += sy - last.sy;
    }
    last = { sx, sy };
  });

  function endPointer(e) {
    const rect = rectOf();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const wasTap = downPos && (Date.now() - downAt < 280) &&
      Math.hypot(sx - downPos.sx, sy - downPos.sy) < 8;
    if (wasTap && pointers.size === 1) {
      const n = hit(sx, sy);
      if (n && onSelect) onSelect(n.kind, n.ref);
    }
    pointers.delete(e.pointerId);
    if (dragNode) { dragNode.pinned = false; dragNode = null; reheat(); }
    if (pointers.size === 0) { panning = false; last = null; }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); dragNode && (dragNode.pinned = false); dragNode = null; panning = false; });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = rectOf();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const w = toWorld(mx, my);
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    view.k = Math.max(0.2, Math.min(4, view.k * factor));
    const s2 = toScreen(w);
    view.x += mx - s2.x; view.y += my - s2.y;
  }, { passive: false });

  const onResize = () => resize();
  window.addEventListener('resize', onResize);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      canvas.remove();
    },
  };
}

function trunc(s, n) { s = s || ''; return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function hexA(hex, a) {
  const c = (hex || '#888').replace('#', '');
  if (c.length < 6) return `rgba(136,136,136,${a})`;
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
