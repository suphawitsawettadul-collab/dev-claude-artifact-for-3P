// Self-check for serve.mjs [deckDir]: lookup order, save target, path guard. Run: node selfcheck-server.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
const tool = path.resolve(here, '..');
let n = 0; const ta = async (name, fn) => { await fn(); n++; console.log('ok  ', name); };
const call = (port, p, method = 'GET', body) => new Promise(ok => {
  const q = http.request({ port, host: '127.0.0.1', path: p, method }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => ok({ code: r.statusCode, body: b })); });
  q.end(body);
});
const deck = fs.mkdtempSync(path.join(os.tmpdir(), 'deckdir-'));
fs.writeFileSync(path.join(deck, 'my.html'), '<p>mine</p>');
fs.writeFileSync(path.join(deck, 'ds-tu.js'), '// deck copy wins');
const port = 4198;
const srv = spawn(process.execPath, [path.join(tool, 'serve.mjs'), deck], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
try {
  await ta('GET deck file from deckDir', async () => { const r = await call(port, '/my.html'); assert.equal(r.code, 200); assert.equal(r.body, '<p>mine</p>'); });
  await ta('GET falls back to the tool folder (editor.js)', async () => { const r = await call(port, '/editor.js'); assert.equal(r.code, 200); assert.ok(r.body.includes('DeckEditor')); });
  await ta('GET png from the tool folder', async () => assert.equal((await call(port, '/tu-bg-cover.png')).code, 200));
  await ta('deckDir file shadows the tool copy', async () => assert.equal((await call(port, '/ds-tu.js')).body, '// deck copy wins'));
  await ta('GET missing file is 404', async () => assert.equal((await call(port, '/nope.html')).code, 404));
  await ta('GET ../ and encoded ../ are rejected', async () => {
    for (const p of ['/..%2Fserve.mjs', '/%2e%2e%2fserve.mjs', '/..%5Cserve.mjs', '/sub%2Fx.html', '/..', '/%2e%2e']) {
      const r = await call(port, p); assert.ok(r.code === 400 || r.code === 404 || p.endsWith('..') || p.endsWith('%2e%2e'), p + ' -> ' + r.code); // a bare /.. is folded to / by URL parsing (serves the default deck) assert.ok(!r.body.includes('createServer'), p + ' leaked');
    }
  });
  await ta('GET bad percent-encoding is 400, server stays up', async () => { assert.equal((await call(port, '/%E0%A4%A')).code, 400); assert.equal((await call(port, '/my.html')).code, 200); });
  await ta('POST /save writes into deckDir (not the tool folder) and keeps a .bak', async () => {
    let r = await call(port, '/save?file=new.html', 'POST', '<p>v1</p>'); assert.equal(r.code, 200);
    assert.equal(fs.readFileSync(path.join(deck, 'new.html'), 'utf8'), '<p>v1</p>'); assert.ok(!fs.existsSync(path.join(tool, 'new.html')));
    r = await call(port, '/save?file=new.html', 'POST', '<p>v2</p>'); assert.equal(r.code, 200);
    assert.equal(fs.readFileSync(path.join(deck, 'new.html.bak'), 'utf8'), '<p>v1</p>');
    r = await call(port, '/save?file=out.pdf', 'POST', 'PDF'); assert.equal(r.code, 200); assert.ok(fs.existsSync(path.join(deck, 'out.pdf')));
  });
  await ta('POST /save rejects ../, subfolders, bad extension', async () => {
    for (const f of ['..%2Fevil.html', '%2e%2e%2fevil.html', 'a%2Fb.html', '..%5Cevil.html', 'x.js', 'x.html.exe', '', '..']) {
      const r = await call(port, '/save?file=' + f, 'POST', 'x'); assert.equal(r.code, 400, f + ' -> ' + r.code);
    }
    assert.ok(!fs.existsSync(path.join(path.dirname(deck), 'evil.html')));
  });
} finally { srv.kill(); }
await ta('missing deckDir exits with an error', async () => {
  const r = spawnSync(process.execPath, [path.join(tool, 'serve.mjs'), path.join(deck, 'nope')], { encoding: 'utf8', env: { ...process.env, PORT: '4197' } });
  assert.equal(r.status, 1); assert.match(r.stderr, /not found/);
});
fs.rmSync(deck, { recursive: true, force: true });
console.log(`\nserver: ${n} checks passed`);
