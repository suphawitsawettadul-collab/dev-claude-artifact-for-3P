// Runs every UI + unit check against a temp copy of the sample doc. Needs Edge or Chromium (headless, driven over the DevTools protocol by cdp.mjs).
// Usage: node run-all.mjs        (exits 1 if anything fails)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
const tool = path.resolve(here, '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-test-'));
fs.copyFileSync(path.join(tool, 'doc.html'), path.join(dir, 'doc.html'));
const env = { ...process.env, PORT: '4198', DOC_DIR: dir };
const srv = spawn(process.execPath, [path.join(tool, 'serve.mjs'), dir], { env, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
let bad = 0;
const tests = fs.readdirSync(here).filter(f => /^(selfcheck|t)-.*\.mjs$/.test(f) && f !== 't-lib.mjs').map(f => f.replace('.mjs', '')).sort();
for (const t of tests) {
  const r = spawnSync(process.execPath, [path.join(here, t + '.mjs')], { env, encoding: 'utf8', timeout: 90000 });
  const out = (r.stdout + r.stderr).trim().split('\n');
  const fails = out.filter(l => l.startsWith('FAIL'));
  if (r.status !== 0 || fails.length) bad++;
  console.log(`${r.status === 0 && !fails.length ? 'PASS' : 'FAIL'}  ${t}  ${out.at(-1)}`);
  fails.forEach(l => console.log('      ' + l));
  if (r.status !== 0 && !fails.length) console.log(out.slice(-6).join('\n'));
}
srv.kill(); fs.rmSync(dir, { recursive: true, force: true });
process.exit(bad ? 1 : 0);
