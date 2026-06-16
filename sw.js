/* Service worker: offline app shell. Data lives in IndexedDB (not here).

   Strategy: NETWORK-FIRST for same-origin requests so a freshly deployed
   version is always picked up when online; fall back to the cache only when
   the network is unavailable (offline launch). */
const CACHE = 'wardrobe-v2';
const ASSETS = [
  'index.html',
  'css/styles.css',
  'js/app.js', 'js/views.js', 'js/store.js', 'js/db.js',
  'js/ui.js', 'js/util.js', 'js/image.js', 'js/web.js', 'js/nav.js',
  'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(ASSETS.map(a => cache.add(new Request(a, { cache: 'reload' }))));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  e.respondWith((async () => {
    try {
      const resp = await fetch(req);
      // Refresh the cache with the latest copy for offline use.
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return resp;
    } catch {
      // Offline: serve cached asset, or fall back to the app shell.
      const cached = await caches.match(req);
      if (cached) return cached;
      if (req.mode === 'navigate') return caches.match('index.html');
      throw new Error('offline and not cached');
    }
  })());
});
