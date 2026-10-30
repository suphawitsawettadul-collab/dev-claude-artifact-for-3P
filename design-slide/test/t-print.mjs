// Print (Ctrl+P / Save as PDF) keeps the layer order of overlapping boxes: the slide is laid out like on screen, not under editor chrome.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { start, ok } from './t-lib.mjs';
import * as L from './t-lib.mjs';
const here = fileURLToPath(new URL('.', import.meta.url)), tool = path.resolve(here, '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-print-'));
fs.mkdirSync(path.join(dir, 'project', 'slides'), { recursive: true });
fs.writeFileSync(path.join(dir, 'project', 'deck.json'), JSON.stringify({ title: 'Layers', order: ['a', 'b'] }));
fs.writeFileSync(path.join(dir, 'project', 'slides', 'a.html'), `<section style="background:#fff;padding:80px">
<h1 style="font-size:80px">Heading</h1>
<x-shape kind="rect" id="r1" style="left:100px;top:100px;width:700px;height:400px;background:#2a6fdb"></x-shape>
<div id="r2" style="position:absolute;left:300px;top:200px;width:700px;height:400px;background:#e33;z-index:2">z2</div>
<div id="r3" style="position:absolute;left:200px;top:300px;width:500px;height:400px;background:#2b2;z-index:1;transform:rotate(5deg)">z1</div>
<div id="r4" style="position:absolute;left:500px;top:500px;width:600px;height:300px;background:#fa0;box-shadow:0 10px 40px rgba(0,0,0,.5)">later, no z-index</div>
</section>`);
fs.writeFileSync(path.join(dir, 'project', 'slides', 'b.html'), '<section style="background:#fff" data-skip="1"><h1>Skipped</h1></section>');
const r = spawnSync(process.execPath, [path.join(tool, 'open-deck.mjs'), dir, '--static'], { encoding: 'utf8' });
const url = /OPEN: (file:\/\/\S+)/.exec(r.stdout)?.[1];
const b = await start(url + '#1');
try {
  // topmost element at points of the overlaps, relative to the slide, on screen and in print
  const pts = [[350, 250], [500, 350], [650, 450], [650, 650], [900, 700], [150, 150]];
  const top = () => b.ev(`(() => { const s = document.querySelector('#stage > .slide'), r = s.getBoundingClientRect(), z = r.width / s.offsetWidth;
    return ${JSON.stringify(pts)}.map(([x, y]) => { const e = document.elementsFromPoint(r.left + x * z, r.top + y * z).find(e => e.parentElement === s && !e.matches('[data-chrome]')); return e ? e.id || e.dataset.shape : '-'; }); })()`);
  const screen = await top();
  ok(screen.join() === 'r2,r2,r2,r3,r4,rect', 'on screen: later and higher z-index boxes are on top', screen.join());
  await b.send('Emulation.setEmulatedMedia', { media: 'print' });
  const printed = await top();
  ok(printed.join() === screen.join(), 'in print the boxes stack the same way', printed.join());
  ok(await b.ev(`(() => { const s = document.querySelector('#stage > .slide'), r = s.getBoundingClientRect(); return [[10, 10], [400, 300], [800, 500]].every(([x, y]) => s.contains(document.elementFromPoint(r.left + x, r.top + y))); })()`), 'in print nothing of the editor covers the slide');
  const pdf = await b.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true });
  const bytes = Buffer.from(pdf.result.data, 'base64').toString('latin1');
  ok((bytes.match(/\/Type\s*\/Page[^s]/g) || []).length === 1, 'a skipped slide is not printed');
} finally { await b.close(); }
console.log('print done', L.passes, 'pass', L.fails, 'fail');
process.exit(L.fails ? 1 : 0);
