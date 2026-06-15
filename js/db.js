/* Minimal IndexedDB wrapper.
   Stores: items, ecosystems, fits (keyPath "id"), and meta (key/value)
   used for the editable taxonomies + app settings. Images live inline on
   records as compressed data URLs — simplest reliable local storage. */

const DB_NAME = 'wardrobe';
const DB_VER = 1;
const STORES = ['items', 'ecosystems', 'fits', 'meta'];

let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('items')) db.createObjectStore('items', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('ecosystems')) db.createObjectStore('ecosystems', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('fits')) db.createObjectStore('fits', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta'); // key/value
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode = 'readonly') {
  return openDB().then(db => db.transaction(store, mode).objectStore(store));
}
function wrap(request) {
  return new Promise((res, rej) => {
    request.onsuccess = () => res(request.result);
    request.onerror = () => rej(request.error);
  });
}

export async function getAll(store) { return wrap((await tx(store)).getAll()); }
export async function get(store, key) { return wrap((await tx(store)).get(key)); }
export async function put(store, value, key) {
  const s = await tx(store, 'readwrite');
  return wrap(key === undefined ? s.put(value) : s.put(value, key));
}
export async function del(store, key) {
  const s = await tx(store, 'readwrite');
  return wrap(s.delete(key));
}
export async function clear(store) {
  const s = await tx(store, 'readwrite');
  return wrap(s.clear());
}

/* meta helpers (taxonomies / settings) */
export async function metaGet(key, fallback) {
  const v = await get('meta', key);
  return v === undefined ? fallback : v;
}
export async function metaSet(key, value) { return put('meta', value, key); }

export const STORE_NAMES = STORES;
