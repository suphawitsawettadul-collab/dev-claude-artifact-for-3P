// B2 box toolbar on a slide (background), a table and a group.
import { start, ok } from './t-lib.mjs';
import * as L from './t-lib.mjs';
import * as H from './t-bh.mjs';
await start('http://localhost:' + process.env.PORT + '/tu-test.html#4');
const b = L.b, SL = '.slide.active';
// slide background
const [x, y, w, h] = await L.sc();
await b.click(x + w * 0.15, y + h * 0.75);
ok((await L.S())[0].startsWith('slide:'), 'empty area selects the slide');
let t = await H.tb();
ok(t.on && t.ids.join() === 'fill,radius,spacing,more', 'slide toolbar: fill | radius spacing | more', t.ids.join());
const st = await H.rect('#stage');
ok(t.t >= st.t && t.t + t.h <= st.b && t.l >= st.l, 'slide toolbar stays inside the stage', JSON.stringify([t, st]));
await H.tbClick('fill'); await H.pClick('[data-c="#f7912f"]');
ok(await H.style(SL, 'background') !== '' && await H.comp(SL, 'backgroundColor') === 'rgb(247, 145, 47)', 'fill sets the slide background');
ok(await b.ev(`getComputedStyle(document.querySelector('${SL} > img.tu-bg')).display`) === 'none', 'the full-bleed picture steps aside so the fill shows');
await H.pClick('[data-c=none]');
ok(await H.style(SL, 'background') === '' && await b.ev(`getComputedStyle(document.querySelector('${SL} > img.tu-bg')).display`) !== 'none', 'None gives the slide its own look back (picture shown)');
await H.undo(); await b.click(x + w * 0.15, y + h * 0.75);
ok(await H.comp(SL, 'backgroundColor') === 'rgb(247, 145, 47)', 'Ctrl+Z steps back to the orange fill');
await H.undo();
ok(await H.style(SL, 'background') === '' && await b.ev(`getComputedStyle(document.querySelector('${SL} > img.tu-bg')).display`) !== 'none', 'and back to the start');
// group
await L.clickOn(`${SL} .tu-title`); await L.clickOn(`${SL} .tu-sub`, { modifiers: 8 }, 300, 0); await b.key('g', { ctrl: true });
t = await H.tb();
ok((await L.S())[0].startsWith('group:') && t.ids.join() === 'fill,radius,spacing,more', 'group toolbar', t.ids.join());
await H.tbClick('fill'); await H.pClick('[data-c="#c7dbf0"]');
ok(await H.comp(`${SL} [data-group]`, 'backgroundColor') === 'rgb(199, 219, 240)', 'group fill applies');
await H.undo(); await H.undo();
// table (drag a cell to select the table)
await L.go(6);
const [cx, cy] = await L.at(`${SL} td`);
await b.drag(cx, cy, cx + 20, cy + 10);
ok((await L.S())[0].startsWith('table:'), 'table selected');
t = await H.tb();
ok(t.on && t.ids.join() === 'fill,radius,spacing,more', 'table toolbar', t.ids.join());
await H.tbClick('fill'); await H.pClick('[data-c="#edf0f5"]');
ok(await H.comp(`${SL} table`, 'backgroundColor') === 'rgb(237, 240, 245)', 'table fill applies');
await H.tbClick('radius'); await L.clickOn('#ed-pop #ed-rad');
const r = parseFloat(await H.style(`${SL} table`, 'borderRadius'));
ok(r > 40 && await H.style(`${SL} table`, 'borderCollapse') === 'separate', 'table radius needs separate borders', await H.style(`${SL} table`, 'borderRadius'));
await H.undo(); await H.undo(); await b.ev(`document.activeElement.blur()`);
console.log(b.logs.join('\n')); console.log('B2 slide/table/group done', L.passes, 'pass', L.fails, 'fail');
await b.close();
