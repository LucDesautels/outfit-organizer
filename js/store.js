/* Central state + persistence. All taxonomies are editable and live in `meta`.
   Records live in their own object stores. The rest of the app reads from
   `state` and calls these mutators (which persist + notify). */

import * as db from './db.js';
import { uid } from './util.js';

export const state = {
  items: [],
  ecosystems: [],
  fits: [],
  tax: { types: [], colors: [], styles: [], formality: [], manufacturers: [] },
  settings: { webGroupBy: 'ecosystem' },
};

/* ---- default, fully-editable taxonomies -------------------------------- */
function defTypes() {
  // Ordered roughly by layer / body position (order matters for collages).
  const names = [
    'Hat', 'Base layer', 'T-shirt', 'Shirt', 'Overshirt', 'Sweater',
    'Overcoat', 'Jacket', 'Rain jacket', 'Coat', 'Winter coat',
    'Shorts', 'Pants', 'Jeans', 'Socks', 'Shoes', 'Accessory', 'Bag',
  ];
  return names.map((name, i) => ({ id: uid(), name, order: i }));
}
function defColors() {
  const list = [
    ['Black', '#141414'], ['Off-white', '#efe9dd'], ['White', '#ffffff'],
    ['Grey', '#9a9a9a'], ['Charcoal', '#3a3a3a'], ['Navy', '#22304a'],
    ['Olive green', '#5b6236'], ['Brown', '#6b4f3a'], ['Tan', '#c9b48f'],
    ['Beige', '#d8cbb2'], ['Cream', '#f3ead6'], ['Pink', '#e6b7c4'],
    ['Red', '#9b3b34'], ['Blue', '#3a5a86'], ['Green', '#3f6b4a'],
    ['Yellow', '#d9b44a'], ['Purple', '#5b4a78'], ['Mixmatched', 'mix'],
  ];
  return list.map(([name, hex], i) => ({ id: uid(), name, hex, order: i }));
}
function defStyles() {
  const names = ['Old money', 'Streetwear', 'Techwear', 'Minimal', 'Workwear',
    'Gorpcore', 'Vintage', 'Smart casual', 'Avant-garde'];
  return names.map((name, i) => ({ id: uid(), name, order: i }));
}
function defFormality() {
  // Ordered scale from least to most formal.
  const names = ['Pajamas', 'Not caring', 'Casual', 'In public', 'Golf',
    'Semi-formal', 'Formal'];
  return names.map((name, i) => ({ id: uid(), name, order: i }));
}
function defManufacturers() {
  return []; // brands are user-defined; starts empty
}

/* ---- load + seed -------------------------------------------------------- */
export async function loadAll() {
  await db.openDB();
  state.items = sortByCreated(await db.getAll('items'));
  state.ecosystems = sortByCreated(await db.getAll('ecosystems'));
  state.fits = sortByCreated(await db.getAll('fits'));

  state.tax.types = await seedMeta('tax.types', defTypes);
  state.tax.colors = await seedMeta('tax.colors', defColors);
  state.tax.styles = await seedMeta('tax.styles', defStyles);
  state.tax.formality = await seedMeta('tax.formality', defFormality);
  state.tax.manufacturers = await seedMeta('tax.manufacturers', defManufacturers);
  state.settings = await db.metaGet('settings', state.settings);

  resort();
}
function sortByCreated(arr) {
  return (arr || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}
async function seedMeta(key, factory) {
  let v = await db.metaGet(key, null);
  if (!v || !Array.isArray(v) || v.length === 0) {
    v = factory();
    await db.metaSet(key, v);
  }
  return v;
}
function resort() {
  for (const k of ['types', 'colors', 'styles', 'formality', 'manufacturers']) {
    if (Array.isArray(state.tax[k])) state.tax[k].sort((a, b) => (a.order || 0) - (b.order || 0));
  }
}

/* ---- change notification ------------------------------------------------ */
const listeners = new Set();
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach(fn => fn()); }

/* ---- lookups ------------------------------------------------------------ */
export const itemById = id => state.items.find(x => x.id === id);
export const ecoById = id => state.ecosystems.find(x => x.id === id);
export const fitById = id => state.fits.find(x => x.id === id);
export const typeById = id => state.tax.types.find(x => x.id === id);
export const colorById = id => state.tax.colors.find(x => x.id === id);
export const styleById = id => state.tax.styles.find(x => x.id === id);
export const formalityById = id => state.tax.formality.find(x => x.id === id);
export const manufacturerById = id => state.tax.manufacturers.find(x => x.id === id);

export const ecosystemsWithItem = id => state.ecosystems.filter(e => (e.itemIds || []).includes(id));
export const fitsWithItem = id => state.fits.filter(f => (f.itemIds || []).includes(id));

/* ---- items -------------------------------------------------------------- */
export async function saveItem(data) {
  const now = Date.now();
  let rec;
  if (data.id) {
    rec = { ...itemById(data.id), ...data, updatedAt: now };
    const i = state.items.findIndex(x => x.id === data.id);
    state.items[i] = rec;
  } else {
    rec = {
      id: uid(), createdAt: now, updatedAt: now,
      name: '', typeId: null, image: null,
      colorIds: [], styleIds: [], formalityId: null, manufacturerId: null,
      status: 'owned', notes: '',
      ...data,
    };
    state.items.unshift(rec);
  }
  await db.put('items', rec);
  emit();
  return rec;
}
export async function deleteItem(id) {
  await db.del('items', id);
  state.items = state.items.filter(x => x.id !== id);
  // scrub references
  for (const e of state.ecosystems) {
    if ((e.itemIds || []).includes(id)) {
      e.itemIds = e.itemIds.filter(x => x !== id);
      await db.put('ecosystems', e);
    }
  }
  for (const f of state.fits) {
    if ((f.itemIds || []).includes(id)) {
      f.itemIds = f.itemIds.filter(x => x !== id);
      await db.put('fits', f);
    }
  }
  emit();
}

/* ---- ecosystems --------------------------------------------------------- */
export async function saveEcosystem(data) {
  const now = Date.now();
  let rec;
  if (data.id) {
    rec = { ...ecoById(data.id), ...data, updatedAt: now };
    const i = state.ecosystems.findIndex(x => x.id === data.id);
    state.ecosystems[i] = rec;
  } else {
    rec = { id: uid(), createdAt: now, updatedAt: now, name: '', description: '', itemIds: [], accent: '#141414', ...data };
    state.ecosystems.unshift(rec);
  }
  await db.put('ecosystems', rec);
  emit();
  return rec;
}
export async function deleteEcosystem(id) {
  await db.del('ecosystems', id);
  state.ecosystems = state.ecosystems.filter(x => x.id !== id);
  emit();
}

/* ---- fits --------------------------------------------------------------- */
export async function saveFit(data) {
  const now = Date.now();
  let rec;
  if (data.id) {
    rec = { ...fitById(data.id), ...data, updatedAt: now };
    const i = state.fits.findIndex(x => x.id === data.id);
    state.fits[i] = rec;
  } else {
    rec = {
      id: uid(), createdAt: now, updatedAt: now,
      name: '', itemIds: [], rating: null, photo: null,
      colorId: null, styleId: null, formalityId: null, notes: '',
      ...data,
    };
    state.fits.unshift(rec);
  }
  await db.put('fits', rec);
  emit();
  return rec;
}
export async function deleteFit(id) {
  await db.del('fits', id);
  state.fits = state.fits.filter(x => x.id !== id);
  emit();
}

/* ---- taxonomy mutators -------------------------------------------------- */
const TAX_KEY = { types: 'tax.types', colors: 'tax.colors', styles: 'tax.styles', formality: 'tax.formality', manufacturers: 'tax.manufacturers' };

export async function addTax(kind, fields) {
  const arr = state.tax[kind];
  const rec = { id: uid(), order: arr.length, ...fields };
  arr.push(rec);
  resort();
  await db.metaSet(TAX_KEY[kind], state.tax[kind]);
  emit();
  return rec;
}
export async function updateTax(kind, id, fields) {
  const arr = state.tax[kind];
  const i = arr.findIndex(x => x.id === id);
  if (i < 0) return;
  arr[i] = { ...arr[i], ...fields };
  resort();
  await db.metaSet(TAX_KEY[kind], state.tax[kind]);
  emit();
}
export async function removeTax(kind, id) {
  state.tax[kind] = state.tax[kind].filter(x => x.id !== id);
  // scrub references on items / fits
  const single = { types: 'typeId', formality: 'formalityId' };
  const multi = { colors: 'colorIds', styles: 'styleIds' };
  for (const it of state.items) {
    let dirty = false;
    if (kind === 'types' && it.typeId === id) { it.typeId = null; dirty = true; }
    if (kind === 'formality' && it.formalityId === id) { it.formalityId = null; dirty = true; }
    if (kind === 'manufacturers' && it.manufacturerId === id) { it.manufacturerId = null; dirty = true; }
    if (multi[kind] && (it[multi[kind]] || []).includes(id)) {
      it[multi[kind]] = it[multi[kind]].filter(x => x !== id); dirty = true;
    }
    if (dirty) await db.put('items', it);
  }
  for (const f of state.fits) {
    let dirty = false;
    if (kind === 'colors' && f.colorId === id) { f.colorId = null; dirty = true; }
    if (kind === 'styles' && f.styleId === id) { f.styleId = null; dirty = true; }
    if (kind === 'formality' && f.formalityId === id) { f.formalityId = null; dirty = true; }
    if (dirty) await db.put('fits', f);
  }
  await db.metaSet(TAX_KEY[kind], state.tax[kind]);
  emit();
}
export async function reorderTax(kind, orderedIds) {
  const map = new Map(state.tax[kind].map(x => [x.id, x]));
  state.tax[kind] = orderedIds.map((id, i) => ({ ...map.get(id), order: i }));
  await db.metaSet(TAX_KEY[kind], state.tax[kind]);
  emit();
}

/* ---- settings ----------------------------------------------------------- */
export async function setSetting(key, value) {
  state.settings = { ...state.settings, [key]: value };
  await db.metaSet('settings', state.settings);
  emit();
}

/* ---- data export / import (backup) -------------------------------------- */
export async function exportData() {
  return JSON.stringify({
    version: 1, exportedAt: Date.now(),
    items: state.items, ecosystems: state.ecosystems, fits: state.fits,
    tax: state.tax, settings: state.settings,
  });
}
export async function importData(json, { replace = true } = {}) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (replace) {
    await Promise.all(db.STORE_NAMES.map(s => db.clear(s)));
  }
  state.items = data.items || [];
  state.ecosystems = data.ecosystems || [];
  state.fits = data.fits || [];
  state.tax = data.tax || state.tax;
  // tolerate older backups that predate a taxonomy (e.g. manufacturers)
  for (const k of ['types', 'colors', 'styles', 'formality', 'manufacturers'])
    if (!Array.isArray(state.tax[k])) state.tax[k] = [];
  state.settings = data.settings || state.settings;
  for (const it of state.items) await db.put('items', it);
  for (const e of state.ecosystems) await db.put('ecosystems', e);
  for (const f of state.fits) await db.put('fits', f);
  for (const k of ['types', 'colors', 'styles', 'formality', 'manufacturers'])
    await db.metaSet(TAX_KEY[k], state.tax[k]);
  await db.metaSet('settings', state.settings);
  resort();
  emit();
}

export { emit as notify };
