// PPTX export keeps what the toolbars write: colour, bold / italic / underline runs, hyperlink, gradient fill (first stop).
import { start, ok } from './t-lib.mjs';
import * as L from './t-lib.mjs';
import * as H from './t-bh.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
await start('http://localhost:' + process.env.PORT + '/tu-test.html#4');
const b = L.b, SUB = '.slide.active .tu-sub';
const net = await b.ev(`fetch('https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js', { method: 'HEAD' }).then(r => r.ok, () => false)`);
if (!net) { console.log('SKIP no network for the pptx library'); console.log('B pptx done', L.passes, 'pass', L.fails, 'fail'); await b.close(); process.exit(0); }
await b.ev(`document.querySelector('${SUB}').textContent = 'Hello brave new world'`);
await H.edit(SUB);
await H.selectText(SUB, 0, 5); await H.tbClick('bold');
await H.selectText(SUB, 6, 11); await H.tbClick('tcolor'); await H.pClick(`[data-c="#f7912f"]`);
await H.selectText(SUB, 12, 15); await H.tbClick('link'); await L.clickOn('#ed-pop .ed-url'); await b.type('https://example.com'); await H.pClick('[data-lk=apply]');
await b.key('Escape', { code: 'Escape', vk: 27 }); await L.clickOn('.slide.active .tu-title');
await b.ev(`document.querySelector('[data-cmd=rect]').click()`);
await H.tbClick('fill'); await L.clickOn('#ed-pop [data-tab=custom]'); await L.clickOn('#ed-pop [data-m=grad]');
await b.ev(`document.querySelector('#ed-tb') && document.querySelector('[data-cmd=pptx]').click()`);
const file = path.join(process.env.DECK_DIR, 'tu-test.pptx');
for (let k = 0; k < 120 && !fs.existsSync(file); k++) await b.sleep(500);
ok(fs.existsSync(file), 'pptx written');
if (fs.existsSync(file)) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pptx-'));
  const r = spawnSync('C:/Windows/System32/tar.exe', ['-xf', file, '-C', dir]) // Windows bsdtar reads zip (a Git-bash GNU tar does not);
  if (r.status !== 0) console.log('tar:', r.status, String(r.stderr), String(r.error), fs.readdirSync(dir).join());
  const xml = fs.readFileSync(path.join(dir, 'ppt/slides/slide4.xml'), 'utf8'), rels = fs.readFileSync(path.join(dir, 'ppt/slides/_rels/slide4.xml.rels'), 'utf8');
  ok(r.status === 0 && /b="1"/.test(xml), 'bold run exported', String(r.status));
  ok(rels.includes('https://example.com') && xml.includes('hlinkClick'), 'hyperlink exported on the run');
  ok(/srgbClr val="F7912F"/.test(xml), 'run colour exported');
  ok((xml.match(/<p:sp>/g) || []).length > 3 && /<a:solidFill><a:srgbClr val="[0-9A-F]{6}"\/><\/a:solidFill><a:ln/.test(xml), 'shape with a gradient fill exported as a solid first-stop fill');
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(b.logs.join('\n')); console.log('B pptx done', L.passes, 'pass', L.fails, 'fail');
await b.close();
