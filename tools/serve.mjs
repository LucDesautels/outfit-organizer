/* Minimal static file server for local preview. No dependencies. */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const PORT = process.env.PORT || 5050;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    let fp = path.join(ROOT, p);
    if (!fp.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
    try { const s = await stat(fp); if (s.isDirectory()) fp = path.join(fp, 'index.html'); } catch {}
    const data = await readFile(fp);
    res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
  }
});
server.listen(PORT, () => console.log(`serving ${ROOT} at http://localhost:${PORT}`));
