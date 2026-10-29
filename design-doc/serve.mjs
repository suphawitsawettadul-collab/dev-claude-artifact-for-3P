// Tiny local server for editable HTML docs. Usage: node serve.mjs [docDir]
// Files (and _ds/<file>) are looked up in docDir first, then in this folder (editor.js, editor.css, ds-*.js), so a doc can live anywhere.
// POST /save?file=x.html|pdf|docx|md writes into docDir (default: this folder). GET /stamp?file=x.html gives its mtime (live reload).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const docDir = path.resolve(process.argv[2] || toolDir);
const port = Number(process.env.PORT || 4191);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.woff2': 'font/woff2' };

if (!fs.existsSync(docDir) || !fs.statSync(docDir).isDirectory()) { console.error('doc folder not found: ' + docDir); process.exit(1); }

// Only plain file names; blocks ../ and subfolders.
const plain = name => !!name && name !== '.' && name !== '..' && name === path.basename(name) && !name.includes('\0') && !name.includes('\\');
const isFile = f => fs.existsSync(f) && fs.statSync(f).isFile();

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && url.pathname === '/save') {
    const name = url.searchParams.get('file');
    if (!plain(name) || !/[.](html|pdf|docx|md|png)$/.test(name)) { res.writeHead(400); return res.end('bad file'); }
    const file = path.join(docDir, name);
    const chunks = []; let size = 0;
    req.on('data', c => { chunks.push(c); size += c.length; if (size > 100e6) req.destroy(); });
    req.on('end', () => {
      if (file.endsWith('.html') && fs.existsSync(file)) fs.copyFileSync(file, file + '.bak'); // one-step undo
      fs.writeFileSync(file, Buffer.concat(chunks));
      res.writeHead(200); res.end('saved');
    });
    return;
  }
  if (url.pathname === '/stamp') {
    const name = url.searchParams.get('file'); const f = plain(name) && path.join(docDir, name);
    res.writeHead(200, { 'Cache-Control': 'no-store' });
    return res.end(f && isFile(f) ? String(fs.statSync(f).mtimeMs) : '0');
  }
  let name;
  try { name = decodeURIComponent(url.pathname.slice(1)) || 'doc.html'; } catch { res.writeHead(400); return res.end('bad url'); }
  const own = name.startsWith('_ds/'); // runtime files of a deck that may also be opened from disk: _ds/<name> is served from the tool folder first (so an updated tool wins over a copy made for file:// use)
  if (!plain(own ? name.slice(4) : name)) { res.writeHead(400); return res.end('bad file'); }
  const file = (own ? [path.join(toolDir, name.slice(4)), path.join(docDir, name)] : [docDir, toolDir].map(d => path.join(d, name))).find(isFile);
  if (!file) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`design-doc on http://localhost:${port}  (doc folder: ${docDir})`)); // localhost only: /save writes files
