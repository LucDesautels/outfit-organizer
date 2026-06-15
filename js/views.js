/* All screens + editors. Reads from `state`, mutates via store, navigates
   via `nav`. DOM is built with template strings + direct event binding;
   [data-go="view:id"] is handled by a delegated listener in app.js. */

import {
  state, itemById, ecoById, fitById, typeById, colorById, styleById, formalityById,
  ecosystemsWithItem, fitsWithItem,
  saveItem, deleteItem, saveEcosystem, deleteEcosystem, saveFit, deleteFit,
  addTax, updateTax, removeTax, reorderTax, setSetting, exportData, importData,
} from './store.js';
import {
  toast, openSheet, confirmDialog, promptDialog, pickFile, cropImage, swatchHtml, phHtml,
} from './ui.js';
import { icon, esc, node } from './util.js';
import { processFile, cropToDataUrl } from './image.js';
import { nav } from './nav.js';
import { mountWeb } from './web.js';

/* ===== shared helpers ==================================================== */
function setTopbar({ title, subtitle, leading, actions = [] }) {
  const tb = document.getElementById('topbar');
  tb.innerHTML = '';
  if (leading) tb.appendChild(leading);
  tb.appendChild(node(`<div class="tb-title">${esc(title || '')}${subtitle ? `<small>${esc(subtitle)}</small>` : ''}</div>`));
  const acts = node(`<div class="tb-actions"></div>`);
  actions.forEach(a => a && acts.appendChild(a));
  tb.appendChild(acts);
}
function setContent(el) {
  const v = document.getElementById('view');
  v.innerHTML = '';
  v.appendChild(el);
  v.scrollTop = 0;
}
function iconBtn(name, onClick, label) {
  const b = node(`<button class="iconbtn" aria-label="${esc(label || name)}">${icon(name)}</button>`);
  b.onclick = onClick;
  return b;
}
const backBtn = () => iconBtn('back', () => nav.back(), 'Back');
const gearBtn = () => iconBtn('settings', () => nav.go({ view: 'settings' }), 'Settings');

function field(label, innerHtml) { return node(`<div class="field"><label>${esc(label)}</label>${innerHtml}</div>`); }
function fieldEl(label, el) { const f = node(`<div class="field"><label>${esc(label)}</label></div>`); f.appendChild(el); return f; }
function sectionHead(title, count, actionEl) {
  const h = node(`<div class="section-head"><h2>${esc(title)}</h2>${count != null ? `<span class="count">${count}</span>` : ''}</div>`);
  if (actionEl) { h.querySelector('.count')?.remove(); h.appendChild(actionEl); }
  return h;
}
function emptyState({ glyph = 'hanger', title, text, ctaLabel, onCta }) {
  const el = node(`<div class="empty">
    <div class="glyph">${icon(glyph)}</div>
    <h3>${esc(title)}</h3><p>${esc(text)}</p>
    ${ctaLabel ? `<button class="btn" data-a="cta">${esc(ctaLabel)}</button>` : ''}
  </div>`);
  if (ctaLabel) el.querySelector('[data-a=cta]').onclick = onCta;
  return el;
}

function typeOrder(it) {
  const i = state.tax.types.findIndex(t => t.id === it.typeId);
  return i < 0 ? 999 : i;
}
function sortItemsByType(items) {
  return items.slice().sort((a, b) => typeOrder(a) - typeOrder(b));
}
function itemsOf(ids) { return (ids || []).map(itemById).filter(Boolean); }

function collageHtml(items) {
  const list = sortItemsByType(items).slice(0, 9);
  if (!list.length) return `<div class="collage n1"><div class="cell">${phHtml()}</div></div>`;
  const n = list.length;
  return `<div class="collage n${n}">${list.map(it =>
    `<div class="cell">${it.image ? `<img src="${it.image}" alt="">` : phHtml()}</div>`).join('')}</div>`;
}

/* token multi/single selector backed by a taxonomy */
function tokenGroup({ kind, selected = [], multi = true }) {
  const el = node(`<div class="tokens"></div>`);
  const sel = new Set(selected);
  function render() {
    el.innerHTML = '';
    for (const t of state.tax[kind]) {
      const active = sel.has(t.id);
      const sw = kind === 'colors' ? swatchHtml(t) : '';
      const b = node(`<button type="button" class="token ${active ? 'active' : ''}">${sw}<span>${esc(t.name)}</span></button>`);
      b.onclick = () => {
        if (multi) { active ? sel.delete(t.id) : sel.add(t.id); }
        else { const had = sel.has(t.id); sel.clear(); if (!had) sel.add(t.id); }
        render();
      };
      el.appendChild(b);
    }
    const add = node(`<button type="button" class="token add">${icon('plus')}<span>New</span></button>`);
    add.onclick = async () => { const rec = await openTaxEditor(kind); if (rec) { if (!multi) sel.clear(); sel.add(rec.id); render(); } };
    el.appendChild(add);
  }
  render();
  el.getSelected = () => [...sel];
  return el;
}

function segmented(values, current, labels) {
  const el = node(`<div class="toolbar" style="margin:0 0 0"></div>`);
  let val = current;
  values.forEach((v, i) => {
    const c = node(`<button type="button" class="chip ${v === val ? 'active' : ''}">${esc(labels[i])}</button>`);
    c.onclick = () => { val = v; [...el.children].forEach((ch, j) => ch.classList.toggle('active', values[j] === val)); };
    el.appendChild(c);
  });
  el.getValue = () => val;
  return el;
}

/* image field (camera / gallery / crop / replace), used by editors */
function imageField(initial, { onChange } = {}) {
  let val = initial || null;
  const wrap = node(`<div></div>`);
  const set = v => { val = v; onChange && onChange(v); render(); };
  async function take(camera) {
    const f = await pickFile({ camera });
    if (!f) return;
    const t = toast('Processing photo…', 4000);
    try { const url = await processFile(f); set(url); } catch { toast('Could not read image'); }
  }
  async function doCrop() {
    if (!val) return;
    const rect = await cropImage(val);
    if (rect) { const url = await cropToDataUrl(val, rect); set(url); }
  }
  function render() {
    wrap.innerHTML = '';
    if (!val) {
      const row = node(`<div class="pick-row">
        <button type="button" class="pick" data-a="cam">${icon('camera')}<span>Take photo</span></button>
        <button type="button" class="pick" data-a="lib">${icon('image')}<span>Choose image</span></button>
      </div>`);
      row.querySelector('[data-a=cam]').onclick = () => take(true);
      row.querySelector('[data-a=lib]').onclick = () => take(false);
      wrap.appendChild(row);
    } else {
      const pv = node(`<div class="imgpreview"><img src="${val}" alt=""><button type="button" class="clear">${icon('close')}</button></div>`);
      pv.querySelector('.clear').onclick = () => set(null);
      wrap.appendChild(pv);
      const tools = node(`<div class="pick-row" style="margin-top:10px">
        <button type="button" class="btn ghost sm" data-a="crop">${icon('crop')} Crop</button>
        <button type="button" class="btn ghost sm" data-a="rep">${icon('image')} Replace</button>
      </div>`);
      tools.querySelector('[data-a=crop]').onclick = doCrop;
      tools.querySelector('[data-a=rep]').onclick = () => take(false);
      wrap.appendChild(tools);
    }
  }
  render();
  wrap.getValue = () => val;
  return wrap;
}

/* ===== WARDROBE ========================================================= */
const wf = { status: 'all', typeId: null, colorId: null, styleId: null, formalityId: null, sort: 'recent' };

function activeFilterCount() {
  return ['typeId', 'colorId', 'styleId', 'formalityId'].filter(k => wf[k]).length + (wf.sort !== 'recent' ? 1 : 0);
}
function filteredItems() {
  let arr = state.items.slice();
  if (wf.status !== 'all') arr = arr.filter(i => (i.status || 'owned') === wf.status);
  if (wf.typeId) arr = arr.filter(i => i.typeId === wf.typeId);
  if (wf.colorId) arr = arr.filter(i => (i.colorIds || []).includes(wf.colorId));
  if (wf.styleId) arr = arr.filter(i => (i.styleIds || []).includes(wf.styleId));
  if (wf.formalityId) arr = arr.filter(i => i.formalityId === wf.formalityId);
  if (wf.sort === 'name') arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  else if (wf.sort === 'type') arr.sort((a, b) => typeOrder(a) - typeOrder(b) || (a.name || '').localeCompare(b.name || ''));
  else arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return arr;
}

function itemCardHtml(it) {
  const type = typeById(it.typeId);
  const colors = (it.colorIds || []).map(colorById).filter(Boolean);
  return `<button class="card" data-go="item:${it.id}">
    <div class="thumb">
      ${it.image ? `<img src="${it.image}" alt="${esc(it.name)}">` : phHtml()}
      ${(it.status === 'wishlist') ? `<span class="badge-wish">Wishlist</span>` : ''}
      ${colors.length ? `<span class="swatch-row">${colors.slice(0, 4).map(c => swatchHtml(c)).join('')}</span>` : ''}
    </div>
    <div class="cap"><div class="nm">${esc(it.name || 'Untitled')}</div>
      <div class="meta">${esc(type ? type.name : '—')}</div></div>
  </button>`;
}

function viewWardrobe() {
  setTopbar({
    title: 'Wardrobe',
    subtitle: `${state.items.length} piece${state.items.length === 1 ? '' : 's'}`,
    actions: [gearBtn(), iconBtn('plus', () => openItemEditor(), 'Add piece')],
  });
  const root = node(`<div></div>`);

  if (!state.items.length) {
    setContent(emptyState({
      glyph: 'hanger', title: 'Your wardrobe is empty',
      text: 'Add the pieces you own (and wishlist finds) with a name, type and photo.',
      ctaLabel: 'Add your first piece', onCta: () => openItemEditor(),
    }));
    return;
  }

  // toolbar: status + filters
  const bar = node(`<div class="toolbar"></div>`);
  [['all', 'All'], ['owned', 'Owned'], ['wishlist', 'Wishlist']].forEach(([v, l]) => {
    const c = node(`<button class="chip ${wf.status === v ? 'active' : ''}">${l}</button>`);
    c.onclick = () => { wf.status = v; nav.rerender(); };
    bar.appendChild(c);
  });
  const fc = activeFilterCount();
  const fbtn = node(`<button class="chip ${fc ? 'active' : ''}">${icon('search')}<span style="margin-left:2px">Filter${fc ? ` · ${fc}` : ''}</span></button>`);
  fbtn.onclick = openWardrobeFilter;
  bar.appendChild(fbtn);
  root.appendChild(bar);

  const items = filteredItems();
  if (!items.length) {
    root.appendChild(node(`<div class="empty"><p>No pieces match these filters.</p></div>`));
    setContent(root);
    return;
  }

  if (wf.sort === 'type') {
    // grouped by type with section headers
    const byType = new Map();
    for (const it of items) {
      const k = it.typeId || '_';
      if (!byType.has(k)) byType.set(k, []);
      byType.get(k).push(it);
    }
    for (const t of state.tax.types) {
      const list = byType.get(t.id);
      if (!list) continue;
      root.appendChild(sectionHead(t.name, list.length));
      root.appendChild(node(`<div class="grid">${list.map(itemCardHtml).join('')}</div>`));
    }
    if (byType.get('_')) {
      root.appendChild(sectionHead('Untyped', byType.get('_').length));
      root.appendChild(node(`<div class="grid">${byType.get('_').map(itemCardHtml).join('')}</div>`));
    }
  } else {
    root.appendChild(node(`<div class="grid">${items.map(itemCardHtml).join('')}</div>`));
  }
  setContent(root);
}

function openWardrobeFilter() {
  const body = node(`<div></div>`);
  function pickerRow(label, kind, key, withSwatch) {
    const wrapEl = fieldEl(label, node(`<div class="tokens"></div>`));
    const tk = wrapEl.querySelector('.tokens');
    const draw = () => {
      tk.innerHTML = '';
      const none = node(`<button type="button" class="token ${!wf[key] ? 'active' : ''}">Any</button>`);
      none.onclick = () => { wf[key] = null; draw(); nav.rerender(); };
      tk.appendChild(none);
      for (const t of state.tax[kind]) {
        const b = node(`<button type="button" class="token ${wf[key] === t.id ? 'active' : ''}">${withSwatch ? swatchHtml(t) : ''}<span>${esc(t.name)}</span></button>`);
        b.onclick = () => { wf[key] = wf[key] === t.id ? null : t.id; draw(); nav.rerender(); };
        tk.appendChild(b);
      }
    };
    draw();
    return wrapEl;
  }
  body.appendChild(pickerRow('Type', 'types', 'typeId', false));
  body.appendChild(pickerRow('Colour', 'colors', 'colorId', true));
  body.appendChild(pickerRow('Style', 'styles', 'styleId', false));
  body.appendChild(pickerRow('Formality', 'formality', 'formalityId', false));
  // sort
  const sortEl = node(`<div class="tokens"></div>`);
  [['recent', 'Recent'], ['name', 'Name'], ['type', 'By type']].forEach(([v, l]) => {
    const b = node(`<button type="button" class="token ${wf.sort === v ? 'active' : ''}">${l}</button>`);
    b.onclick = () => { wf.sort = v; [...sortEl.children].forEach((c, i) => c.classList.toggle('active', ['recent', 'name', 'type'][i] === v)); nav.rerender(); };
    sortEl.appendChild(b);
  });
  body.appendChild(fieldEl('Sort', sortEl));

  const foot = node(`<div style="display:flex;gap:10px;width:100%">
    <button class="btn ghost" data-a="clear" style="flex:1">Clear all</button>
    <button class="btn" data-a="done" style="flex:1">Done</button></div>`);
  const ctrl = openSheet({ title: 'Filter & sort', bodyEl: body, footEl: foot });
  foot.querySelector('[data-a=clear]').onclick = () => {
    wf.typeId = wf.colorId = wf.styleId = wf.formalityId = null; wf.sort = 'recent';
    ctrl.close(); nav.rerender();
  };
  foot.querySelector('[data-a=done]').onclick = () => ctrl.close();
}

/* ----- item editor ----- */
function openItemEditor(id) {
  const ex = id ? itemById(id) : null;
  let imgVal = ex ? ex.image : null;
  const body = node(`<div></div>`);

  const imgF = imageField(imgVal, { onChange: v => { imgVal = v; } });
  body.appendChild(fieldEl('Photo', imgF));
  body.appendChild(field('Name', `<input class="input" id="f-name" value="${esc(ex?.name || '')}" placeholder="e.g. Black linen overcoat">`));

  const typeSel = tokenGroup({ kind: 'types', selected: ex?.typeId ? [ex.typeId] : [], multi: false });
  body.appendChild(fieldEl('Type', typeSel));
  const colorSel = tokenGroup({ kind: 'colors', selected: ex?.colorIds || [], multi: true });
  body.appendChild(fieldEl('Colour(s)', colorSel));
  const styleSel = tokenGroup({ kind: 'styles', selected: ex?.styleIds || [], multi: true });
  body.appendChild(fieldEl('Style', styleSel));
  const formSel = tokenGroup({ kind: 'formality', selected: ex?.formalityId ? [ex.formalityId] : [], multi: false });
  body.appendChild(fieldEl('Formality', formSel));
  const statusEl = segmented(['owned', 'wishlist'], ex?.status || 'owned', ['Owned', 'Wishlist']);
  body.appendChild(fieldEl('Status', statusEl));
  body.appendChild(field('Notes', `<textarea class="textarea" id="f-notes" placeholder="Optional notes">${esc(ex?.notes || '')}</textarea>`));

  const foot = node(`<div style="display:flex;gap:10px;width:100%">
    ${ex ? `<button class="btn danger" data-a="del">${icon('trash')}</button>` : ''}
    <button class="btn" data-a="save" style="flex:1">${ex ? 'Save' : 'Add piece'}</button></div>`);
  const ctrl = openSheet({ title: ex ? 'Edit piece' : 'New piece', bodyEl: body, footEl: foot });

  foot.querySelector('[data-a=save]').onclick = async () => {
    const data = {
      id: ex?.id,
      name: body.querySelector('#f-name').value.trim(),
      image: imgVal,
      typeId: typeSel.getSelected()[0] || null,
      colorIds: colorSel.getSelected(),
      styleIds: styleSel.getSelected(),
      formalityId: formSel.getSelected()[0] || null,
      status: statusEl.getValue(),
      notes: body.querySelector('#f-notes').value.trim(),
    };
    await saveItem(data);
    ctrl.close(); toast(ex ? 'Saved' : 'Piece added'); nav.rerender();
  };
  if (ex) foot.querySelector('[data-a=del]').onclick = async () => {
    const ok = await confirmDialog({ title: 'Delete piece', message: `Delete “${ex.name || 'this piece'}”? It will also be removed from any fits and ecosystems.` });
    if (!ok) return;
    await deleteItem(ex.id); ctrl.close(); toast('Deleted');
    if (nav.current().view === 'item') nav.back(); else nav.rerender();
  };
}

/* ----- item detail ----- */
function viewItem(id) {
  const it = itemById(id);
  if (!it) { nav.replace({ view: 'wardrobe' }); return; }
  setTopbar({
    title: it.name || 'Untitled', leading: backBtn(),
    actions: [iconBtn('edit', () => openItemEditor(it.id), 'Edit')],
  });
  const type = typeById(it.typeId);
  const colors = (it.colorIds || []).map(colorById).filter(Boolean);
  const styles = (it.styleIds || []).map(styleById).filter(Boolean);
  const form = formalityById(it.formalityId);
  const ecos = ecosystemsWithItem(it.id);
  const fits = fitsWithItem(it.id);

  const root = node(`<div>
    <div class="detail-hero">${it.image ? `<img src="${it.image}" alt="">` : phHtml()}</div>
    <div class="metalist">
      <div class="metarow"><div class="k">Type</div><div class="v">${type ? `<span class="tag">${esc(type.name)}</span>` : '<span class="muted">—</span>'}</div></div>
      <div class="metarow"><div class="k">Colour</div><div class="v">${colors.length ? colors.map(c => `<span class="tag">${swatchHtml(c)}${esc(c.name)}</span>`).join('') : '<span class="muted">—</span>'}</div></div>
      <div class="metarow"><div class="k">Style</div><div class="v">${styles.length ? styles.map(s => `<span class="tag">${esc(s.name)}</span>`).join('') : '<span class="muted">—</span>'}</div></div>
      <div class="metarow"><div class="k">Formality</div><div class="v">${form ? `<span class="tag">${esc(form.name)}</span>` : '<span class="muted">—</span>'}</div></div>
      <div class="metarow"><div class="k">Status</div><div class="v"><span class="tag">${it.status === 'wishlist' ? 'Wishlist' : 'Owned'}</span></div></div>
      ${it.notes ? `<div class="metarow"><div class="k">Notes</div><div class="v" style="display:block">${esc(it.notes)}</div></div>` : ''}
    </div>
  </div>`);

  const build = node(`<button class="btn block" style="margin-top:18px" data-a="build">${icon('outfit')} Build a fit with this</button>`);
  build.onclick = () => openFitBuilderWith([it.id]);
  root.appendChild(build);

  if (ecos.length) {
    root.appendChild(sectionHead('In ecosystems', ecos.length));
    root.appendChild(stripOf(ecos.map(e => ({ go: `ecosystem:${e.id}`, name: e.name, items: itemsOf(e.itemIds) }))));
  }
  if (fits.length) {
    root.appendChild(sectionHead('In fits', fits.length));
    root.appendChild(node(`<div class="grid">${fits.map(fitCardHtml).join('')}</div>`));
  }

  root.appendChild(node(`<hr class="divider">`));
  const del = node(`<button class="linklike danger-text">Delete this piece</button>`);
  del.onclick = async () => {
    const ok = await confirmDialog({ title: 'Delete piece', message: `Delete “${it.name || 'this piece'}”?` });
    if (ok) { await deleteItem(it.id); toast('Deleted'); nav.back(); }
  };
  root.appendChild(del);
  setContent(root);
}

/* a horizontal strip of mini-collage cards (used for ecosystems on item page) */
function stripOf(entries) {
  const el = node(`<div class="member-strip"></div>`);
  for (const e of entries) {
    const m = node(`<button class="member" data-go="${e.go}">
      <div class="mthumb">${collageMini(e.items)}</div>
      <div class="mname">${esc(e.name || 'Untitled')}</div></button>`);
    el.appendChild(m);
  }
  return el;
}
function collageMini(items) {
  const list = sortItemsByType(items).slice(0, 4);
  if (!list.length) return phHtml();
  return `<div class="collage n${list.length}" style="width:100%;height:100%">${list.map(it => `<div class="cell">${it.image ? `<img src="${it.image}">` : phHtml()}</div>`).join('')}</div>`;
}

/* ===== ECOSYSTEMS ======================================================= */
function viewEcosystems() {
  setTopbar({
    title: 'Ecosystems', subtitle: `${state.ecosystems.length} group${state.ecosystems.length === 1 ? '' : 's'}`,
    actions: [gearBtn(), iconBtn('plus', () => openEcosystemEditor(), 'New ecosystem')],
  });
  if (!state.ecosystems.length) {
    setContent(emptyState({
      glyph: 'layers', title: 'No ecosystems yet',
      text: 'Group pieces that all work together interchangeably — e.g. an all-black capsule.',
      ctaLabel: 'Create an ecosystem', onCta: () => openEcosystemEditor(),
    }));
    return;
  }
  const root = node(`<div class="grid"></div>`);
  for (const e of state.ecosystems) {
    const items = itemsOf(e.itemIds);
    const card = node(`<button class="fit-card" data-go="ecosystem:${e.id}">
      <div class="frame" style="border-top:3px solid ${esc(e.accent || '#141414')}">${collageHtml(items)}</div>
      <div class="cap"><div class="nm">${esc(e.name || 'Untitled')}</div>
        <div class="meta">${items.length} piece${items.length === 1 ? '' : 's'}</div></div>
    </button>`);
    root.appendChild(card);
  }
  setContent(root);
}

function viewEcosystem(id) {
  const e = ecoById(id);
  if (!e) { nav.replace({ view: 'ecosystems' }); return; }
  setTopbar({ title: e.name || 'Untitled', leading: backBtn(), actions: [iconBtn('edit', () => openEcosystemEditor(e.id), 'Edit')] });
  const items = sortItemsByType(itemsOf(e.itemIds));
  const root = node(`<div>
    <div class="detail-hero" style="aspect-ratio:4/3;max-height:42vh;border-top:4px solid ${esc(e.accent || '#141414')}">${collageHtml(items)}</div>
    ${e.description ? `<p class="note" style="font-size:14px;color:var(--ink-2);margin:0 2px 6px">${esc(e.description)}</p>` : ''}
  </div>`);

  const cf = node(`<button class="btn block" style="margin:14px 0 4px" data-a="fit">${icon('outfit')} Create a fit from this</button>`);
  cf.onclick = () => openFitBuilderWith(e.itemIds.slice());
  root.appendChild(cf);

  root.appendChild(sectionHead('Pieces', items.length));
  if (items.length) root.appendChild(node(`<div class="grid">${items.map(itemCardHtml).join('')}</div>`));
  else root.appendChild(node(`<p class="note">No pieces yet — tap edit to add some.</p>`));

  root.appendChild(node(`<hr class="divider">`));
  const del = node(`<button class="linklike danger-text">Delete this ecosystem</button>`);
  del.onclick = async () => {
    const ok = await confirmDialog({ title: 'Delete ecosystem', message: `Delete “${e.name || 'this ecosystem'}”? The pieces themselves are kept.` });
    if (ok) { await deleteEcosystem(e.id); toast('Deleted'); nav.back(); }
  };
  root.appendChild(del);
  setContent(root);
}

function openEcosystemEditor(id) {
  const ex = id ? ecoById(id) : null;
  let chosen = ex ? (ex.itemIds || []).slice() : [];
  let accent = ex ? (ex.accent || '#141414') : '#141414';
  const body = node(`<div></div>`);
  body.appendChild(field('Name', `<input class="input" id="e-name" value="${esc(ex?.name || '')}" placeholder="e.g. All-black capsule">`));
  body.appendChild(field('Description', `<textarea class="textarea" id="e-desc" placeholder="Optional">${esc(ex?.description || '')}</textarea>`));
  body.appendChild(field('Accent colour', `<input type="color" id="e-accent" value="${esc(accent)}" style="width:54px;height:40px;border:0;background:none;padding:0">`));
  body.querySelector('#e-accent').oninput = ev => { accent = ev.target.value; };

  const piecesWrap = fieldEl('Pieces', node(`<div></div>`));
  const piecesBox = piecesWrap.querySelector('div');
  function renderPieces() {
    piecesBox.innerHTML = '';
    const strip = node(`<div class="member-strip"></div>`);
    for (const it of itemsOf(chosen)) {
      const m = node(`<div class="member"><div class="mthumb">${it.image ? `<img src="${it.image}">` : phHtml()}
        <button class="mrm" title="Remove">${icon('close')}</button></div>
        <div class="mname">${esc(it.name || 'Untitled')}</div></div>`);
      m.querySelector('.mrm').onclick = () => { chosen = chosen.filter(x => x !== it.id); renderPieces(); };
      strip.appendChild(m);
    }
    if (chosen.length) piecesBox.appendChild(strip);
    const add = node(`<button type="button" class="btn ghost block" style="margin-top:8px">${icon('plus')} ${chosen.length ? 'Edit pieces' : 'Choose pieces'}</button>`);
    add.onclick = () => openItemPicker({ title: 'Choose pieces', preselected: chosen, onConfirm: ids => { chosen = ids; renderPieces(); } });
    piecesBox.appendChild(add);
  }
  renderPieces();
  body.appendChild(piecesWrap);

  const foot = node(`<div style="display:flex;gap:10px;width:100%">
    ${ex ? `<button class="btn danger" data-a="del">${icon('trash')}</button>` : ''}
    <button class="btn" data-a="save" style="flex:1">${ex ? 'Save' : 'Create'}</button></div>`);
  const ctrl = openSheet({ title: ex ? 'Edit ecosystem' : 'New ecosystem', bodyEl: body, footEl: foot });
  foot.querySelector('[data-a=save]').onclick = async () => {
    await saveEcosystem({ id: ex?.id, name: body.querySelector('#e-name').value.trim(), description: body.querySelector('#e-desc').value.trim(), accent, itemIds: chosen });
    ctrl.close(); toast(ex ? 'Saved' : 'Created'); nav.rerender();
  };
  if (ex) foot.querySelector('[data-a=del]').onclick = async () => {
    const ok = await confirmDialog({ title: 'Delete ecosystem', message: `Delete “${ex.name || 'this ecosystem'}”?` });
    if (!ok) return;
    await deleteEcosystem(ex.id); ctrl.close(); toast('Deleted');
    if (nav.current().view === 'ecosystem') nav.back(); else nav.rerender();
  };
}

/* shared multi-select piece picker */
function openItemPicker({ title = 'Choose pieces', preselected = [], onConfirm }) {
  const sel = new Set(preselected);
  let q = '', typeId = null, status = 'all';
  const body = node(`<div>
    <div class="field" style="margin-bottom:10px"><input class="input" id="pk-q" placeholder="Search pieces…"></div>
    <div class="toolbar" id="pk-status"></div>
    <div class="toolbar" id="pk-types"></div>
    <div class="pick-list" id="pk-list"></div>
  </div>`);
  const listEl = body.querySelector('#pk-list');
  const statusBar = body.querySelector('#pk-status');
  [['all', 'All'], ['owned', 'Owned'], ['wishlist', 'Wishlist']].forEach(([v, l]) => {
    const c = node(`<button class="chip ${status === v ? 'active' : ''}">${l}</button>`);
    c.onclick = () => { status = v; [...statusBar.children].forEach((ch, i) => ch.classList.toggle('active', ['all', 'owned', 'wishlist'][i] === v)); renderList(); };
    statusBar.appendChild(c);
  });
  const typesBar = body.querySelector('#pk-types');
  const allChip = node(`<button class="chip active">All types</button>`);
  allChip.onclick = () => { typeId = null; markTypes(); renderList(); };
  typesBar.appendChild(allChip);
  for (const t of state.tax.types) {
    const c = node(`<button class="chip" data-t="${t.id}">${esc(t.name)}</button>`);
    c.onclick = () => { typeId = t.id; markTypes(); renderList(); };
    typesBar.appendChild(c);
  }
  function markTypes() { [...typesBar.children].forEach(ch => ch.classList.toggle('active', (ch.dataset.t || null) === typeId)); }
  body.querySelector('#pk-q').oninput = ev => { q = ev.target.value.trim().toLowerCase(); renderList(); };

  function renderList() {
    const items = state.items.filter(it => {
      if (status !== 'all' && (it.status || 'owned') !== status) return false;
      if (typeId && it.typeId !== typeId) return false;
      if (q && !(it.name || '').toLowerCase().includes(q)) return false;
      return true;
    });
    if (!items.length) { listEl.innerHTML = `<p class="note" style="grid-column:1/-1">No matching pieces.</p>`; return; }
    listEl.innerHTML = items.map(it => {
      const type = typeById(it.typeId);
      return `<button class="pick-item ${sel.has(it.id) ? 'selected' : ''}" data-id="${it.id}">
        <div class="pthumb">${it.image ? `<img src="${it.image}">` : phHtml()}${it.status === 'wishlist' ? `<span class="badge-wish">Wish</span>` : ''}</div>
        <div class="pcap"><div class="t">${esc(type ? type.name : '—')}</div>${esc(it.name || 'Untitled')}</div>
        <span class="check">${icon('check')}</span></button>`;
    }).join('');
    listEl.querySelectorAll('.pick-item').forEach(b => {
      b.onclick = () => { const id = b.dataset.id; sel.has(id) ? sel.delete(id) : sel.add(id); b.classList.toggle('selected'); updateCount(); };
    });
  }
  renderList();

  const foot = node(`<div style="display:flex;gap:10px;width:100%">
    <button class="btn ghost" data-a="new" style="flex:0 0 auto">${icon('plus')}</button>
    <button class="btn" data-a="done" style="flex:1"><span data-count>Done</span></button></div>`);
  function updateCount() { foot.querySelector('[data-count]').textContent = sel.size ? `Done · ${sel.size}` : 'Done'; }
  updateCount();
  const ctrl = openSheet({ title, bodyEl: body, footEl: foot });
  foot.querySelector('[data-a=new]').onclick = () => openItemEditor();
  foot.querySelector('[data-a=done]').onclick = () => { onConfirm([...sel]); ctrl.close(); };
}

/* ===== FITS ============================================================= */
const ff = { colorId: null, styleId: null, formalityId: null, minRating: 0, sort: 'recent' };

function fitCardHtml(f) {
  const items = itemsOf(f.itemIds);
  const style = styleById(f.styleId);
  const form = formalityById(f.formalityId);
  const meta = [style?.name, form?.name].filter(Boolean).join(' · ') || `${items.length} piece${items.length === 1 ? '' : 's'}`;
  const inner = f.photo ? `<img class="worn" src="${f.photo}" alt="">` : collageHtml(items);
  return `<button class="fit-card" data-go="fit:${f.id}">
    <div class="frame">${inner}${(f.rating != null) ? `<span class="rating-pill">${fmtRating(f.rating)}<small>/10</small></span>` : ''}</div>
    <div class="cap"><div class="nm">${esc(f.name || 'Untitled fit')}</div><div class="meta">${esc(meta)}</div></div>
  </button>`;
}
function fmtRating(r) { return (Math.round(r * 10) / 10).toString(); }

function viewFits() {
  setTopbar({
    title: 'Fits', subtitle: `${state.fits.length} outfit${state.fits.length === 1 ? '' : 's'}`,
    actions: [gearBtn(), iconBtn('plus', () => openFitBuilderWith([]), 'New fit')],
  });
  if (!state.fits.length) {
    setContent(emptyState({
      glyph: 'outfit', title: 'No fits yet',
      text: 'Combine pieces into an outfit, rate it, and add a worn photo.',
      ctaLabel: 'Build a fit', onCta: () => openFitBuilderWith([]),
    }));
    return;
  }
  const root = node(`<div></div>`);
  const fc = (ff.colorId || ff.styleId || ff.formalityId || ff.minRating > 0 ? 1 : 0);
  const bar = node(`<div class="toolbar"></div>`);
  const fbtn = node(`<button class="chip ${fc ? 'active' : ''}">${icon('search')}<span style="margin-left:2px">Filter & sort</span></button>`);
  fbtn.onclick = openFitFilter;
  bar.appendChild(fbtn);
  root.appendChild(bar);

  let arr = state.fits.slice();
  if (ff.colorId) arr = arr.filter(f => f.colorId === ff.colorId);
  if (ff.styleId) arr = arr.filter(f => f.styleId === ff.styleId);
  if (ff.formalityId) arr = arr.filter(f => f.formalityId === ff.formalityId);
  if (ff.minRating > 0) arr = arr.filter(f => (f.rating || 0) >= ff.minRating);
  if (ff.sort === 'rating') arr.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  else if (ff.sort === 'name') arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  else arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (!arr.length) root.appendChild(node(`<div class="empty"><p>No fits match these filters.</p></div>`));
  else root.appendChild(node(`<div class="grid">${arr.map(fitCardHtml).join('')}</div>`));
  setContent(root);
}

function openFitFilter() {
  const body = node(`<div></div>`);
  function row(label, kind, key, withSwatch) {
    const wrapEl = fieldEl(label, node(`<div class="tokens"></div>`));
    const tk = wrapEl.querySelector('.tokens');
    const draw = () => {
      tk.innerHTML = '';
      const any = node(`<button type="button" class="token ${!ff[key] ? 'active' : ''}">Any</button>`);
      any.onclick = () => { ff[key] = null; draw(); nav.rerender(); };
      tk.appendChild(any);
      for (const t of state.tax[kind]) {
        const b = node(`<button type="button" class="token ${ff[key] === t.id ? 'active' : ''}">${withSwatch ? swatchHtml(t) : ''}<span>${esc(t.name)}</span></button>`);
        b.onclick = () => { ff[key] = ff[key] === t.id ? null : t.id; draw(); nav.rerender(); };
        tk.appendChild(b);
      }
    };
    draw(); return wrapEl;
  }
  body.appendChild(row('Colour', 'colors', 'colorId', true));
  body.appendChild(row('Style', 'styles', 'styleId', false));
  body.appendChild(row('Formality', 'formality', 'formalityId', false));
  // min rating
  const rr = node(`<div class="rating-row"><div class="rating-track"><input type="range" min="0" max="10" step="1" value="${ff.minRating}"></div><div class="rating-val">${ff.minRating || 0}<small>+</small></div></div>`);
  rr.querySelector('input').oninput = ev => { ff.minRating = +ev.target.value; rr.querySelector('.rating-val').innerHTML = `${ff.minRating}<small>+</small>`; nav.rerender(); };
  body.appendChild(fieldEl('Minimum rating', rr));
  // sort
  const sortEl = node(`<div class="tokens"></div>`);
  [['recent', 'Recent'], ['rating', 'Top rated'], ['name', 'Name']].forEach(([v, l]) => {
    const b = node(`<button type="button" class="token ${ff.sort === v ? 'active' : ''}">${l}</button>`);
    b.onclick = () => { ff.sort = v; [...sortEl.children].forEach((c, i) => c.classList.toggle('active', ['recent', 'rating', 'name'][i] === v)); nav.rerender(); };
    sortEl.appendChild(b);
  });
  body.appendChild(fieldEl('Sort', sortEl));

  const foot = node(`<div style="display:flex;gap:10px;width:100%">
    <button class="btn ghost" data-a="clear" style="flex:1">Clear</button>
    <button class="btn" data-a="done" style="flex:1">Done</button></div>`);
  const ctrl = openSheet({ title: 'Filter & sort fits', bodyEl: body, footEl: foot });
  foot.querySelector('[data-a=clear]').onclick = () => { ff.colorId = ff.styleId = ff.formalityId = null; ff.minRating = 0; ff.sort = 'recent'; ctrl.close(); nav.rerender(); };
  foot.querySelector('[data-a=done]').onclick = () => ctrl.close();
}

function viewFit(id) {
  const f = fitById(id);
  if (!f) { nav.replace({ view: 'fits' }); return; }
  setTopbar({ title: f.name || 'Untitled fit', leading: backBtn(), actions: [iconBtn('edit', () => nav.go({ view: 'fitbuilder', id: f.id }), 'Edit')] });
  const items = sortItemsByType(itemsOf(f.itemIds));
  const color = colorById(f.colorId), style = styleById(f.styleId), form = formalityById(f.formalityId);
  const root = node(`<div>
    <div class="detail-hero">${f.photo ? `<img src="${f.photo}" alt="">` : collageHtml(items)}</div>
    <div class="row" style="margin:0 2px 4px">
      <div style="flex:1">
        ${(f.rating != null) ? `<div style="font-size:34px;font-weight:300;line-height:1">${fmtRating(f.rating)}<span class="muted" style="font-size:16px"> / 10</span></div>` : `<div class="muted">Not rated</div>`}
      </div>
    </div>
    <div class="metalist">
      <div class="metarow"><div class="k">Colour</div><div class="v">${color ? `<span class="tag">${swatchHtml(color)}${esc(color.name)}</span>` : '<span class="muted">—</span>'}</div></div>
      <div class="metarow"><div class="k">Style</div><div class="v">${style ? `<span class="tag">${esc(style.name)}</span>` : '<span class="muted">—</span>'}</div></div>
      <div class="metarow"><div class="k">Formality</div><div class="v">${form ? `<span class="tag">${esc(form.name)}</span>` : '<span class="muted">—</span>'}</div></div>
      ${f.notes ? `<div class="metarow"><div class="k">Notes</div><div class="v" style="display:block">${esc(f.notes)}</div></div>` : ''}
    </div>
  </div>`);

  root.appendChild(sectionHead('Pieces', items.length));
  if (items.length) {
    const strip = node(`<div class="member-strip"></div>`);
    for (const it of items) {
      const m = node(`<button class="member" data-go="item:${it.id}"><div class="mthumb">${it.image ? `<img src="${it.image}">` : phHtml()}</div><div class="mname">${esc(it.name || 'Untitled')}</div></button>`);
      strip.appendChild(m);
    }
    root.appendChild(strip);
  }

  const photoBtn = node(`<button class="btn ghost block" style="margin-top:16px">${icon('camera')} ${f.photo ? 'Replace worn photo' : 'Add a worn photo'}</button>`);
  photoBtn.onclick = async () => {
    const choice = await chooseSource();
    if (!choice) return;
    const file = await pickFile({ camera: choice === 'cam' });
    if (!file) return;
    toast('Processing photo…', 4000);
    let url = await processFile(file);
    const rect = await cropImage(url);
    if (rect) url = await cropToDataUrl(url, rect);
    await saveFit({ id: f.id, photo: url });
    toast('Photo added'); nav.rerender();
  };
  root.appendChild(photoBtn);
  if (f.photo) {
    const rm = node(`<button class="linklike">Remove worn photo</button>`);
    rm.onclick = async () => { await saveFit({ id: f.id, photo: null }); toast('Removed'); nav.rerender(); };
    root.appendChild(rm);
  }

  root.appendChild(node(`<hr class="divider">`));
  const del = node(`<button class="linklike danger-text">Delete this fit</button>`);
  del.onclick = async () => { const ok = await confirmDialog({ title: 'Delete fit', message: `Delete “${f.name || 'this fit'}”? The pieces are kept.` }); if (ok) { await deleteFit(f.id); toast('Deleted'); nav.back(); } };
  root.appendChild(del);
  setContent(root);
}

function chooseSource() {
  return new Promise(resolve => {
    const body = node(`<div class="pick-row">
      <button type="button" class="pick" data-a="cam">${icon('camera')}<span>Take photo</span></button>
      <button type="button" class="pick" data-a="lib">${icon('image')}<span>Choose image</span></button></div>`);
    const ctrl = openSheet({ title: 'Add photo', bodyEl: body });
    let done = false;
    body.querySelector('[data-a=cam]').onclick = () => { done = true; ctrl.close(); resolve('cam'); };
    body.querySelector('[data-a=lib]').onclick = () => { done = true; ctrl.close(); resolve('lib'); };
    ctrl.onDismiss = () => { if (!done) resolve(null); };
  });
}

/* ----- fit builder (full screen route) ----- */
function openFitBuilderWith(itemIds) {
  nav.go({ view: 'fitbuilder', id: null, seed: itemIds });
}

function viewFitBuilder(route) {
  const ex = route.id ? fitById(route.id) : null;
  const draft = ex
    ? { ...ex, itemIds: (ex.itemIds || []).slice() }
    : { id: null, name: '', itemIds: (route.seed || []).slice(), rating: null, photo: null, colorId: null, styleId: null, formalityId: null, notes: '' };

  const saveAct = node(`<button class="btn sm" style="padding:8px 16px">${ex ? 'Save' : 'Create'}</button>`);
  setTopbar({ title: ex ? 'Edit fit' : 'New fit', leading: backBtn(), actions: [saveAct] });
  saveAct.onclick = async () => {
    draft.name = root.querySelector('#fb-name')?.value.trim() || draft.name;
    draft.notes = root.querySelector('#fb-notes')?.value.trim() || '';
    const saved = await saveFit(draft);
    toast(ex ? 'Saved' : 'Fit created');
    nav.replace({ view: 'fit', id: saved.id });
  };

  const root = node(`<div></div>`);
  function rebuild() {
    // preserve typed text
    const nameVal = root.querySelector('#fb-name')?.value;
    const notesVal = root.querySelector('#fb-notes')?.value;
    if (nameVal != null) draft.name = nameVal;
    if (notesVal != null) draft.notes = notesVal;
    build();
  }
  function build() {
    root.innerHTML = '';
    const items = itemsOf(draft.itemIds);
    // preview
    root.appendChild(node(`<div class="detail-hero" style="aspect-ratio:3/4;max-height:46vh">${draft.photo ? `<img src="${draft.photo}">` : collageHtml(items)}</div>`));

    root.appendChild(field('Name', `<input class="input" id="fb-name" value="${esc(draft.name || '')}" placeholder="Name this fit">`));

    // pieces
    const ph = sectionHead('Pieces', items.length);
    root.appendChild(ph);
    const strip = node(`<div class="member-strip"></div>`);
    for (const it of items) {
      const m = node(`<div class="member"><div class="mthumb">${it.image ? `<img src="${it.image}">` : phHtml()}<button class="mrm">${icon('close')}</button></div><div class="mname">${esc(it.name || 'Untitled')}</div></div>`);
      m.querySelector('.mrm').onclick = () => { draft.itemIds = draft.itemIds.filter(x => x !== it.id); rebuild(); };
      strip.appendChild(m);
    }
    if (items.length) root.appendChild(strip);
    const addBtn = node(`<button class="btn ghost block" style="margin-top:8px">${icon('plus')} ${items.length ? 'Edit pieces' : 'Add pieces'}</button>`);
    addBtn.onclick = () => openItemPicker({ title: 'Add pieces', preselected: draft.itemIds, onConfirm: ids => { draft.itemIds = ids; rebuild(); } });
    root.appendChild(addBtn);

    // rating
    const rv = draft.rating == null ? '—' : fmtRating(draft.rating);
    const ratingEl = node(`<div class="rating-row">
      <div class="rating-track"><input type="range" min="0" max="10" step="1" value="${draft.rating == null ? 0 : draft.rating}"></div>
      <div class="rating-val">${rv}<small>/10</small></div></div>`);
    const slider = ratingEl.querySelector('input');
    const valEl = ratingEl.querySelector('.rating-val');
    slider.oninput = () => { draft.rating = +slider.value; valEl.innerHTML = `${fmtRating(draft.rating)}<small>/10</small>`; };
    const ratingWrap = fieldEl('Rating', ratingEl);
    const clr = node(`<button class="linklike" style="padding:2px">Mark unrated</button>`);
    clr.onclick = () => { draft.rating = null; rebuild(); };
    ratingWrap.appendChild(clr);
    root.appendChild(ratingWrap);

    // attributes
    const colorSel = tokenGroup({ kind: 'colors', selected: draft.colorId ? [draft.colorId] : [], multi: false });
    colorSel.addEventListener('click', () => { draft.colorId = colorSel.getSelected()[0] || null; });
    root.appendChild(fieldEl('Main colour', colorSel));
    const styleSel = tokenGroup({ kind: 'styles', selected: draft.styleId ? [draft.styleId] : [], multi: false });
    styleSel.addEventListener('click', () => { draft.styleId = styleSel.getSelected()[0] || null; });
    root.appendChild(fieldEl('Style', styleSel));
    const formSel = tokenGroup({ kind: 'formality', selected: draft.formalityId ? [draft.formalityId] : [], multi: false });
    formSel.addEventListener('click', () => { draft.formalityId = formSel.getSelected()[0] || null; });
    root.appendChild(fieldEl('Formality', formSel));

    // worn photo
    const imgF = imageField(draft.photo, { onChange: v => { draft.photo = v; } });
    root.appendChild(fieldEl('Worn photo (optional)', imgF));

    root.appendChild(field('Notes', `<textarea class="textarea" id="fb-notes" placeholder="Optional">${esc(draft.notes || '')}</textarea>`));

    if (ex) {
      const del = node(`<button class="linklike danger-text" style="margin-top:6px">Delete this fit</button>`);
      del.onclick = async () => { const ok = await confirmDialog({ title: 'Delete fit', message: 'Delete this fit?' }); if (ok) { await deleteFit(ex.id); toast('Deleted'); nav.go({ view: 'fits' }); } };
      root.appendChild(del);
    }
  }
  build();
  setContent(root);
}

/* ===== WEB ============================================================== */
let webHandle = null;
export function teardownWeb() { if (webHandle) { webHandle.destroy(); webHandle = null; } }

function viewWeb() {
  setTopbar({ title: 'Web', subtitle: 'visual map', actions: [gearBtn()] });
  const groupBy = state.settings.webGroupBy || 'ecosystem';
  const groups = groupBy === 'fit' ? state.fits : state.ecosystems;

  const root = node(`<div></div>`);
  const cont = node(`<div style="position:fixed;left:50%;transform:translateX(-50%);top:calc(var(--header-h) + var(--safe-top));bottom:calc(var(--tab-h) + var(--safe-bottom));width:100%;max-width:var(--maxw);background:#0d0d0d;overflow:hidden;z-index:20"></div>`);
  root.appendChild(cont);

  // top controls
  const top = node(`<div style="position:absolute;top:12px;left:12px;right:12px;display:flex;justify-content:center;z-index:2">
    <div class="web-toggle">
      <button data-g="ecosystem" class="${groupBy === 'ecosystem' ? 'active' : ''}">Ecosystems</button>
      <button data-g="fit" class="${groupBy === 'fit' ? 'active' : ''}">Fits</button>
    </div></div>`);
  top.querySelectorAll('button').forEach(b => b.onclick = async () => { await setSetting('webGroupBy', b.dataset.g); nav.rerender(); });
  cont.appendChild(top);

  if (!state.items.length) {
    cont.appendChild(node(`<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#888;text-align:center;padding:24px">Add some pieces to see your wardrobe web.</div>`));
    setContent(root); return;
  }

  const stage = node(`<div style="position:absolute;inset:0"></div>`);
  cont.appendChild(stage);

  // legend
  if (groups.length) {
    const PALETTE = ['#b8893b', '#5b6236', '#3a5a86', '#9b3b34', '#5b4a78', '#3f6b4a', '#a85c7a', '#7a6a4f', '#456b6e', '#8a5a3c'];
    const legend = node(`<div class="web-legend"></div>`);
    groups.forEach((g, i) => {
      const color = (groupBy === 'ecosystem' && g.accent) ? g.accent : PALETTE[i % PALETTE.length];
      legend.appendChild(node(`<span class="lg"><span class="dot" style="background:${esc(color)}"></span>${esc(g.name || 'Untitled')}</span>`));
    });
    cont.appendChild(legend);
  } else {
    cont.appendChild(node(`<div style="position:absolute;top:60px;left:0;right:0;text-align:center;color:#888;font-size:13px">No ${groupBy === 'fit' ? 'fits' : 'ecosystems'} yet — pieces shown floating.</div>`));
  }

  setContent(root);
  // mount after layout
  requestAnimationFrame(() => {
    teardownWeb();
    webHandle = mountWeb(stage, {
      groupBy,
      onSelect: (kind, ref) => {
        if (kind === 'item') nav.go({ view: 'item', id: ref.id });
        else if (groupBy === 'fit') nav.go({ view: 'fit', id: ref.id });
        else nav.go({ view: 'ecosystem', id: ref.id });
      },
    });
  });
}

/* ===== SETTINGS ========================================================= */
function openTaxEditor(kind, rec) {
  return new Promise(resolve => {
    const isColor = kind === 'colors';
    const labelMap = { types: 'Type', colors: 'Colour', styles: 'Style', formality: 'Formality level' };
    const body = node(`<div>
      <div class="field"><label>Name</label><input class="input" id="t-name" value="${esc(rec?.name || '')}" placeholder="${labelMap[kind]}"></div>
      ${isColor ? `<div class="field"><label>Swatch</label><input type="color" id="t-color" value="${esc(rec && rec.hex !== 'mix' ? rec.hex : '#888888')}" style="width:54px;height:40px;border:0;background:none;padding:0"></div>` : ''}
    </div>`);
    const foot = node(`<div style="display:flex;gap:10px;width:100%">
      <button class="btn ghost" data-a="cancel" style="flex:1">Cancel</button>
      <button class="btn" data-a="ok" style="flex:1">${rec ? 'Save' : 'Add'}</button></div>`);
    const ctrl = openSheet({ title: rec ? `Edit ${labelMap[kind].toLowerCase()}` : `New ${labelMap[kind].toLowerCase()}`, bodyEl: body, footEl: foot });
    let answered = false;
    foot.querySelector('[data-a=cancel]').onclick = () => { answered = true; ctrl.close(); resolve(null); };
    foot.querySelector('[data-a=ok]').onclick = async () => {
      const name = body.querySelector('#t-name').value.trim();
      if (!name) { toast('Enter a name'); return; }
      const fields = { name };
      if (isColor) fields.hex = body.querySelector('#t-color').value;
      answered = true;
      let out;
      if (rec) { await updateTax(kind, rec.id, fields); out = { ...rec, ...fields }; }
      else { out = await addTax(kind, fields); }
      ctrl.close(); resolve(out); nav.rerender();
    };
    ctrl.onDismiss = () => { if (!answered) resolve(null); };
  });
}

function viewSettings() {
  setTopbar({ title: 'Settings', leading: backBtn() });
  const root = node(`<div></div>`);
  const groups = [
    ['types', 'Types', 'Clothing categories. Order ≈ layering.', false, true],
    ['formality', 'Formality', 'From pajamas to formal — order matters.', false, true],
    ['colors', 'Colours', 'Palette used to tag pieces and fits.', true, false],
    ['styles', 'Styles', 'Aesthetics like old money or techwear.', false, false],
  ];
  for (const [kind, title, desc, withSwatch, sortable] of groups) {
    const sec = node(`<div class="tax-group"></div>`);
    sec.appendChild(node(`<div class="section-head" style="margin-top:8px"><h2>${title}</h2></div>`));
    sec.appendChild(node(`<p class="note" style="margin:-6px 2px 8px">${esc(desc)}</p>`));
    const list = node(`<div class="tax-list"></div>`);
    for (const t of state.tax[kind]) {
      const row = node(`<div class="tax-row" data-id="${t.id}">
        ${sortable ? `<span class="drag ed" style="cursor:grab">${icon('drag')}</span>` : ''}
        ${withSwatch ? swatchHtml(t) : ''}
        <span class="nm">${esc(t.name)}</span>
        <button class="iconbtn ed" data-a="edit">${icon('edit')}</button>
        <button class="iconbtn ed" data-a="del">${icon('trash')}</button>
      </div>`);
      row.querySelector('[data-a=edit]').onclick = () => openTaxEditor(kind, t);
      row.querySelector('[data-a=del]').onclick = async () => {
        const ok = await confirmDialog({ title: `Delete “${t.name}”`, message: 'This removes it from any pieces/fits that use it.' });
        if (ok) { await removeTax(kind, t.id); toast('Deleted'); nav.rerender(); }
      };
      list.appendChild(row);
    }
    sec.appendChild(list);
    if (sortable) makeSortable(list, ids => reorderTax(kind, ids));
    const add = node(`<button class="btn ghost block" style="margin-top:10px">${icon('plus')} Add ${title.toLowerCase().replace(/s$/, '')}</button>`);
    add.onclick = () => openTaxEditor(kind);
    sec.appendChild(add);
    root.appendChild(sec);
  }

  // data management
  root.appendChild(node(`<hr class="divider">`));
  root.appendChild(node(`<div class="section-head" style="margin-top:0"><h2>Your data</h2></div>`));
  root.appendChild(node(`<p class="note" style="margin:-6px 2px 12px">Everything is stored only on this device. Back it up as a file you can re-import later.</p>`));
  const exp = node(`<button class="btn ghost block" style="margin-bottom:10px">${icon('download')} Export backup (.json)</button>`);
  exp.onclick = async () => {
    const data = await exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `wardrobe-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  root.appendChild(exp);
  const imp = node(`<button class="btn ghost block" style="margin-bottom:10px">${icon('copy')} Import backup</button>`);
  imp.onclick = async () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files[0]; if (!file) return;
      const ok = await confirmDialog({ title: 'Import backup', message: 'This replaces everything currently in the app. Continue?', okLabel: 'Replace', danger: true });
      if (!ok) return;
      try { const text = await file.text(); await importData(text); toast('Imported'); nav.go({ view: 'wardrobe' }); }
      catch { toast('Could not read that file'); }
    };
    input.click();
  };
  root.appendChild(imp);
  const reset = node(`<button class="btn danger block">${icon('trash')} Reset all data</button>`);
  reset.onclick = async () => {
    const ok = await confirmDialog({ title: 'Reset everything', message: 'Delete all pieces, ecosystems, fits and custom categories on this device? This cannot be undone.', okLabel: 'Delete all' });
    if (!ok) return;
    await importData({ items: [], ecosystems: [], fits: [], tax: state.tax, settings: state.settings });
    // also clear taxonomies back to defaults by wiping meta
    location.reload();
  };
  root.appendChild(reset);

  root.appendChild(node(`<p class="note center" style="margin-top:26px">Wardrobe · stored locally · no account</p>`));
  setContent(root);
}

/* simple pointer-based vertical reordering */
function makeSortable(list, onEnd) {
  let drag = null;
  list.querySelectorAll('[data-id]').forEach(row => {
    const h = row.querySelector('.drag');
    if (!h) return;
    h.style.touchAction = 'none';
    h.addEventListener('pointerdown', e => { drag = row; row.style.opacity = '.5'; h.setPointerCapture(e.pointerId); e.preventDefault(); });
    h.addEventListener('pointermove', e => {
      if (!drag) return;
      const y = e.clientY;
      const sibs = [...list.querySelectorAll('[data-id]')].filter(r => r !== drag);
      let placed = false;
      for (const s of sibs) { const r = s.getBoundingClientRect(); if (y < r.top + r.height / 2) { list.insertBefore(drag, s); placed = true; break; } }
      if (!placed) list.appendChild(drag);
    });
    const up = () => { if (!drag) return; drag.style.opacity = ''; const ids = [...list.querySelectorAll('[data-id]')].map(r => r.dataset.id); drag = null; onEnd(ids); };
    h.addEventListener('pointerup', up);
    h.addEventListener('pointercancel', up);
  });
}

/* ===== dispatcher ======================================================= */
export function mountView(route) {
  teardownWeb();
  switch (route.view) {
    case 'wardrobe': return viewWardrobe();
    case 'item': return viewItem(route.id);
    case 'ecosystems': return viewEcosystems();
    case 'ecosystem': return viewEcosystem(route.id);
    case 'fits': return viewFits();
    case 'fit': return viewFit(route.id);
    case 'fitbuilder': return viewFitBuilder(route);
    case 'web': return viewWeb();
    case 'settings': return viewSettings();
    default: return viewWardrobe();
  }
}
