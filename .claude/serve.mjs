// Minimal static file server for local preview of the site.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = normalize(join(fileURLToPath(import.meta.url), '..', '..'));
const port = Number(process.argv[2] ?? 8642);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

async function serveFile(file, res) {
  const body = await readFile(file);
  res.writeHead(200, { 'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream' });
  res.end(body);
}

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = join(root, path === '/' ? 'index.html' : path);
  if (!file.startsWith(root)) { res.writeHead(403).end('Forbidden'); return; }
  try {
    await serveFile(file, res);
  } catch {
    // GitHub Pages serves <dir>/index.html for a request to <dir>/ (or <dir>, without the
    // trailing slash) — the site has directory-per-page URLs (/services/, /about/, ...), so
    // this fallback keeps local preview matching what visitors actually hit in production.
    try {
      await serveFile(join(file, 'index.html'), res);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    }
  }
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
