// Slides-format bridge: open-deck.mjs builds deck.html from project/deck.json + project/slides/*.html, starts the editor,
// the slides render and are editable, edits save back into deck.html, and a re-run keeps those edits until --rebuild.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { start, ok } from './t-lib.mjs';
import * as L from './t-lib.mjs';
const here = fileURLToPath(new URL('.', import.meta.url)), tool = path.resolve(here, '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-open-'));
fs.cpSync(path.join(tool, 'examples', 'slides-format'), dir, { recursive: true });
const port = 4380 + Math.floor(Math.random() * 40);
const run = (...a) => spawnSync(process.execPath, [path.join(tool, 'open-deck.mjs'), dir, '--port', String(port), ...a], { encoding: 'utf8' });
const r1 = run();
ok(r1.status === 0 && r1.stdout.includes(`OPEN: http://localhost:${port}/deck.html`), 'open-deck builds and starts the editor', r1.stdout + r1.stderr);
try {
  const html = fs.readFileSync(path.join(dir, 'deck.html'), 'utf8');
  ok((html.match(/<section class="slide"/g) || []).length === 3 && html.includes('<title>Quarterly review</title>'), 'one slide per file, title from deck.json');
  ok(html.includes('class="notes" hidden>Open with the one-line summary.') && !html.includes('<x-shape'), 'aside becomes speaker notes, x-shape becomes a box');
  const b = await start(`http://localhost:${port}/deck.html#1`);
  ok(await b.ev(`document.querySelectorAll('#ed-thumbs .ed-thumb').length`) === 3, 'filmstrip shows 3 slides');
  ok(await b.ev(`DeckEditor && document.querySelector('.slide.active').offsetWidth`) === 1920, 'slides are 1920 wide');
  await L.clickOn('.slide.active h1'); await L.clickOn('.slide.active h1', {}, 200); // first click selects, the second one types
  await b.key('End', { code: 'End', vk: 35 }); await b.type(' Q4');
  await L.esc();
  await L.clickOn('.slide.active [data-shape=rect]');
  ok((await L.S())[0]?.startsWith('shape:') || (await L.S())[0]?.length > 0, 'the shape from x-shape is selectable', JSON.stringify(await L.S()));
  await L.esc();
  await b.key('s', { ctrl: true }); await b.sleep(800);
  const saved = fs.readFileSync(path.join(dir, 'deck.html'), 'utf8');
  ok(/Quarterly review Q4|Q4/.test(saved.match(/<h1[^>]*>[^<]*/)[0]), 'edit saved into deck.html', saved.match(/<h1[^>]*>[^<]*/)?.[0]);
  ok(fs.existsSync(path.join(dir, 'deck.html.bak')), 'previous version kept as .bak');
  await b.close();
  const r2 = run();
  ok(r2.stdout.includes('kept the existing deck.html') && /Q4/.test(fs.readFileSync(path.join(dir, 'deck.html'), 'utf8')), 're-run keeps the saved edits');
  const r3 = run('--rebuild');
  ok(r3.stdout.includes('built deck.html') && !/Q4/.test(fs.readFileSync(path.join(dir, 'deck.html'), 'utf8')), '--rebuild starts again from the slide files');
} finally { run('--stop'); }
console.log('OPEN bridge done', L.passes, 'pass', L.fails, 'fail');
process.exit(L.fails ? 1 : 0);
