// Runs every UI + unit check against a temp copy of the sample decks. Needs Microsoft Edge (headless, driven over the DevTools protocol by cdp.mjs).
// Usage: node run-all.mjs        (about a minute; exits 1 if anything fails)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
const tool = path.resolve(here, '..');
const deck = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-test-'));
for (const f of ['tu-test.html', 'deck.html']) fs.copyFileSync(path.join(tool, f), path.join(deck, f));
const env = { ...process.env, PORT: '4196', DECK_DIR: deck };
const srv = spawn(process.execPath, [path.join(tool, 'serve.mjs'), deck], { env, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
let bad = 0;
for (const t of ['selfcheck-pure', 'selfcheck-server', 't-a1', 't-a1b', 't-a3', 't-a3b', 't-a4', 't-a4b', 't-a5', 't-cell', 't-img', 't-misc', 't-b1', 't-b1s', 't-b1f', 't-b2', 't-b2s', 't-b3', 't-b4', 't-b4g', 't-b4n', 't-bx']) {
  const r = spawnSync(process.execPath, [path.join(here, t + '.mjs')], { env, encoding: 'utf8' });
  const out = (r.stdout + r.stderr).trim().split(String.fromCharCode(10));
  const fails = out.filter(l => l.startsWith('FAIL'));
  if (r.status !== 0 || fails.length) bad++;
  console.log(`${r.status === 0 && !fails.length ? 'PASS' : 'FAIL'}  ${t}  ${out.at(-1)}`);
  fails.forEach(l => console.log('      ' + l));
  if (r.status !== 0) console.log(out.slice(-6).join(String.fromCharCode(10)));
}
srv.kill(); fs.rmSync(deck, { recursive: true, force: true });
process.exit(bad ? 1 : 0);
