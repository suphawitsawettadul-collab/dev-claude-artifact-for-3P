// B2 box toolbar: shape, image (crop), slide background, table, group; fill / crop / radius / spacing, undo.
import { start, ok } from './t-lib.mjs';
import * as L from './t-lib.mjs';
import * as H from './t-bh.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const png = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../tu-bg-agenda.png');
await start('http://localhost:' + process.env.PORT + '/tu-test.html#4');
const b = L.b, FREE = '.slide.active .ed-free';
const swatch = () => b.ev(`document.querySelector('#ed-tb [data-tb=fill] i').style.background`);
// shape
await b.ev(`document.querySelector('[data-cmd=rect]').click()`);
let t = await H.tb();
ok(t.ids.join() === 'fill,radius,spacing,more' && t.titles, 'shape toolbar: fill | radius spacing | more, tooltips', t.ids.join());
ok((await swatch()).includes('199, 219, 240') || (await swatch()).includes('c7dbf0'), 'fill swatch shows the current fill', await swatch());
await H.tbClick('fill');
ok(await b.ev(`document.querySelector('#ed-pop [data-c=none]').textContent`) === 'None', 'colour popover has a None option');
await H.pClick('[data-c=none]');
ok(await H.style(FREE, 'background') === 'none' && await H.comp(FREE, 'backgroundColor') === 'rgba(0, 0, 0, 0)', 'None clears the fill');
ok(await b.ev(`document.querySelector('#ed-tb [data-tb=fill] i').classList.contains('none')`), 'swatch shows the hatched None');
await H.pClick('[data-c="#21409a"]');
ok(await H.comp(FREE, 'backgroundColor') === 'rgb(33, 64, 154)', 'Royal applies');
await H.undo(); await L.clickOn(FREE);
ok(await H.comp(FREE, 'backgroundColor') === 'rgba(0, 0, 0, 0)', 'Ctrl+Z steps back to None');
await H.undo(); await L.clickOn(FREE);
ok(await H.comp(FREE, 'backgroundColor') === 'rgb(199, 219, 240)', 'Ctrl+Z steps back to the original fill');
// radius slider: a drag is one undo step
await H.tbClick('radius');
ok(await b.ev(`document.querySelector('#ed-pop #ed-rad').max`) === '200' && await b.ev(`!!document.querySelector('#ed-pop [data-pill]')`), 'radius popover: 0-200 slider + Pill');
const r0 = await H.style(FREE, 'borderRadius');
const [rx, ry] = await L.at('#ed-pop #ed-rad');
for (const dx of [-40, -10, 30]) await b.click(rx + dx, ry); // three quick ticks = one drag
const rv = parseFloat(await H.style(FREE, 'borderRadius'));
ok(rv > 100 && rv < 200 && (await b.ev(`document.querySelector('#ed-pop #ed-rad').nextElementSibling.textContent`)) === Math.round(rv) + 'px', 'slider sets border-radius and shows it', String(rv));
await H.pClick('[data-pill]');
ok(await H.style(FREE, 'borderRadius') === '999px', 'Pill = 999px');
await b.ev(`document.activeElement.blur()`); await H.undo(); await L.clickOn(FREE);
ok(parseFloat(await H.style(FREE, 'borderRadius')) === rv, 'undo steps back from Pill to the slider value', await H.style(FREE, 'borderRadius'));
await H.undo(); await L.clickOn(FREE);
ok(await H.style(FREE, 'borderRadius') === r0, 'one more undo reverts the whole slider drag', await H.style(FREE, 'borderRadius') + ' vs ' + r0);
// spacing
await H.tbClick('spacing');
ok(await b.ev(`document.querySelector('#ed-pop #ed-pad').max`) === '256', 'spacing popover: 0-256 slider');
const [sx, sy] = await L.at('#ed-pop #ed-pad');
for (const dx of [-50, 0, 40]) await b.click(sx + dx, sy);
const pv = parseFloat(await H.style(FREE, 'padding'));
ok(pv > 130 && pv < 256, 'slider sets padding', String(pv));
await b.ev(`document.activeElement.blur()`); await H.undo(); await L.clickOn(FREE);
ok(!parseFloat(await H.style(FREE, 'padding') || 0), 'one Ctrl+Z reverts the drag', await H.style(FREE, 'padding'));
await b.key('Delete', { code: 'Delete', vk: 46 });
// image: crop
const doc = await b.send('DOM.getDocument');
const inp = await b.send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '#ed-file' });
await b.send('DOM.setFileInputFiles', { files: [png], nodeId: inp.result.nodeId }); await b.sleep(800);
t = await H.tb();
ok(t.ids.join() === 'fill,crop,radius,spacing,more', 'image toolbar adds crop', t.ids.join());
await H.tbClick('crop');
ok(await b.ev(`document.querySelector('#ed-pop [data-fit=contain]').textContent`) === 'Fit' && await b.ev(`document.querySelector('#ed-pop [data-fit=cover]').textContent`) === 'Fill', 'crop popover: Fill / Fit');
await H.pClick('[data-fit=cover]');
ok(await H.style('.slide.active img.ed-free', 'objectFit') === 'cover' && await b.ev(`document.querySelector('.slide.active img.ed-free').dataset.crop`) === '1 50% 50%', 'Fill: object-fit cover, data-crop "1 50% 50%"');
const [cx, cy] = await L.at('#ed-pop #ed-cx'); await b.click(cx - 40, cy);
ok((await b.ev(`document.querySelector('.slide.active img.ed-free').dataset.crop`)).startsWith('1 ') && !(await b.ev(`document.querySelector('.slide.active img.ed-free').dataset.crop`)).startsWith('1 50%') && (await H.style('.slide.active img.ed-free', 'objectPosition')).includes('%'), 'X slider moves object-position + data-crop', await b.ev(`document.querySelector('.slide.active img.ed-free').dataset.crop`));
await H.pClick('[data-fit=contain]');
ok(await H.style('.slide.active img.ed-free', 'objectFit') === 'contain', 'Fit: object-fit contain');
await b.ev(`document.activeElement.blur()`); await H.undo(); await H.undo(); await H.undo();
console.log(b.logs.join('\n')); console.log('B2 shape+img done', L.passes, 'pass', L.fails, 'fail');
await b.close();
