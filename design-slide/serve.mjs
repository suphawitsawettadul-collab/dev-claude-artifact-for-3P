// Tiny local server for editable HTML decks. Usage: node serve.mjs [deckDir]
// Files (and _ds/<file>) are looked up in deckDir first, then in this folder (editor.js, editor.css, ds-*.js, tu-bg-*.png), so a deck can live anywhere.
// POST /save?file=x.html|pdf|pptx writes into deckDir (default: this folder).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const deckDir = path.resolve(process.argv[2] || toolDir);
const port = Number(process.env.PORT || 4190);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.woff2': 'font/woff2' };

if (!fs.existsSync(deckDir) || !fs.statSync(deckDir).isDirectory()) { console.error('deck folder not found: ' + deckDir); process.exit(1); }

// Only plain file names; blocks ../ and subfolders.
const plain = name => !!name && name !== '.' && name !== '..' && name === path.basename(name) && !name.includes('\0') && !name.includes('\\');
const isFile = f => fs.existsSync(f) && fs.statSync(f).isFile();

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && url.pathname === '/save') {
    const name = url.searchParams.get('file');
    if (!plain(name) || !/[.](html|pdf|pptx|png)$/.test(name)) { res.writeHead(400); return res.end('bad file'); }
    const file = path.join(deckDir, name);
    const chunks = []; let size = 0;
    req.on('data', c => { chunks.push(c); size += c.length; if (size > 100e6) req.destroy(); });
    req.on('end', () => {
      if (file.endsWith('.html') && fs.existsSync(file)) fs.copyFileSync(file, file + '.bak'); // one-step undo
      fs.writeFileSync(file, Buffer.concat(chunks));
      res.writeHead(200); res.end('saved');
    });
    return;
  }
  let name;
  try { name = decodeURIComponent(url.pathname.slice(1)) || 'deck.html'; } catch { res.writeHead(400); return res.end('bad url'); }
  const own = name.startsWith('_ds/'); // runtime files of a deck that may also be opened from disk: _ds/<name> is served from the tool folder first (so an updated tool wins over a copy made for file:// use)
  if (!plain(own ? name.slice(4) : name)) { res.writeHead(400); return res.end('bad file'); }
  const file = (own ? [path.join(toolDir, name.slice(4)), path.join(deckDir, name)] : [deckDir, toolDir].map(d => path.join(d, name))).find(isFile);
  if (!file) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`design-slide on http://localhost:${port}  (deck folder: ${deckDir})`)); // localhost only: /save writes files
