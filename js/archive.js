/* Wayback Machine helpers — turn a product link into a preserved snapshot so
   it still works after the product page changes or disappears.

   All client-side: the availability API is CORS-enabled (read), and "Save Page
   Now" is nudged best-effort (no-cors, fire-and-forget). Everything degrades
   gracefully — a failure just means we keep using the live link. */

const AVAIL = 'https://archive.org/wayback/available?url=';
const SAVE = 'https://web.archive.org/save/';

/** Build the Save-Page-Now URL (opening this in a tab reliably triggers a capture). */
export function savePageUrl(url) { return SAVE + url; }

/** Return the closest existing snapshot URL (https), or null. */
export async function findSnapshot(url) {
  try {
    const res = await fetch(AVAIL + encodeURIComponent(url), { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    const snap = data && data.archived_snapshots && data.archived_snapshots.closest;
    if (snap && snap.available && snap.url) return snap.url.replace(/^http:/, 'https:');
    return null;
  } catch { return null; }
}

/** Best-effort nudge to capture a fresh snapshot (can't read the result via fetch). */
export function requestSave(url) {
  try { fetch(SAVE + url, { mode: 'no-cors', cache: 'no-store' }).catch(() => {}); } catch { /* ignore */ }
}

/**
 * Resolve an archived URL for `url`:
 *  1. use an existing snapshot if there is one,
 *  2. otherwise ask the Wayback Machine to save it and poll for the result.
 * Returns the snapshot URL or null.
 */
export async function archiveUrl(url) {
  let snap = await findSnapshot(url);
  if (snap) return snap;
  requestSave(url);
  for (let i = 0; i < 6; i++) {
    await new Promise(r => setTimeout(r, 4000));
    snap = await findSnapshot(url);
    if (snap) return snap;
  }
  return null;
}
