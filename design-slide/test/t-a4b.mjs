import { start, ok } from './t-lib.mjs';
import * as L from './t-lib.mjs';
const rect = sel => L.b.ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
const near = (a, b, t = 1.5) => Math.abs(a - b) <= t;
await start('http://localhost:' + process.env.PORT + '/tu-test.html#4');
const b = L.b;
const kids = () => b.ev(`JSON.stringify([...document.querySelector('.slide.active').children].filter(c => !('chrome' in c.dataset)).map(c => (c.className || c.nodeName).split(' ')[0]))`).then(JSON.parse);
// z-order
await L.clickOn('.slide.active .tu-title');
await b.key(']');
let k = await kids(); ok(k.at(-1) === 'tu-title', '] brings to front', k.join(','));
await b.key('[');
k = await kids(); ok(k[0] === 'tu-bg' && k[1] === 'tu-title', '[ sends to back after the full-bleed picture', k.join(','));
// group two
const t0 = await rect('.slide.active .tu-title'), s0 = await rect('.slide.active .tu-sub');
await L.clickOn('.slide.active .tu-title');
await L.clickOn('.slide.active .tu-sub', { modifiers: 8 }, 300, 0); // off-centre: the toolbar of the selected title floats below it, over the middle of the subtitle
await b.key('g', { ctrl: true });
ok(await b.ev(`document.querySelectorAll('.slide.active [data-group]').length`) === 1, 'Ctrl+G makes a group');
const sel = await L.S(); ok(sel.length === 1 && sel[0].startsWith('group:'), 'group selected', JSON.stringify(sel));
ok(await b.ev(`document.querySelector('.slide.active [data-group]').children.length`) === 2, 'group has 2 kids');
const t1 = await rect('.slide.active .tu-title'), s1 = await rect('.slide.active .tu-sub');
ok(near(t0[0], t1[0]) && near(t0[1], t1[1]) && near(s0[0], s1[0]) && near(s0[1], s1[1]) && near(t0[2], t1[2], 2), 'children stay in place when grouped', JSON.stringify([t0, t1, s0, s1]));
// click on a child selects group, not child
await L.clickOn('.slide.active .tu-sub');
const g = await L.S(); ok(g.length === 1 && g[0].startsWith('group:'), 'click on child picks group', JSON.stringify(g));
// move the group
const [gx, gy] = await L.at('.slide.active .tu-sub');
await b.drag(gx, gy, gx + 50, gy + 30);
const t2 = await rect('.slide.active .tu-title');
ok(near(t2[0] - t1[0], 50) && near(t2[1] - t1[1], 30), 'group moves with its children', JSON.stringify([t1, t2]));
// double-click text in group edits it
const sb = await rect('.slide.active .tu-sub'); // near the top left of the text, clear of boxes that overlap its lower part on other fonts
await b.click(sb[0] + 24, sb[1] + 3, { clickCount: 2 });
ok(await b.ev(`document.activeElement.className`) === 'tu-sub', 'dblclick edits a text inside a group', await b.ev(`document.activeElement.className`));
await L.esc(); await L.esc();
// ungroup
await L.clickOn('.slide.active .tu-title');
await b.key('g', { ctrl: true, shift: true });
ok(await b.ev(`document.querySelectorAll('.slide.active [data-group]').length`) === 0, 'Ctrl+Shift+G ungroups');
const t3 = await rect('.slide.active .tu-title'); ok(near(t3[0], t2[0]) && near(t3[1], t2[1]), 'ungroup keeps place', JSON.stringify([t2, t3]));
const sel2 = await L.S(); ok(sel2.length === 2, 'ungrouped kids selected', JSON.stringify(sel2));
// undo chain
await b.key('z', { ctrl: true });
ok(await b.ev(`document.querySelectorAll('.slide.active [data-group]').length`) === 1, 'undo ungroup');
// link
await b.ev(`window.__link = ''; navigator.clipboard.writeText = async t => { window.__link = t; }`);
await b.key('l', { ctrl: true, alt: true });
await b.sleep(100);
ok((await b.ev('window.__link')).endsWith('#4'), 'Ctrl+Alt+L copies link with #4', await b.ev('window.__link'));
// insert text -> selection, undo removes
const cnt = await b.ev(`document.querySelectorAll('.slide.active .ed-free').length`);
await b.ev(`document.querySelector('[data-cmd=text]').click()`);
ok(await b.ev(`document.querySelectorAll('.slide.active .ed-free').length`) === cnt + 1 && (await L.S())[0].startsWith('text:'), 'inserted text becomes selection');
await b.key('z', { ctrl: true });
ok(await b.ev(`document.querySelectorAll('.slide.active .ed-free').length`) === cnt, 'undo insert');
// shape + fill from the floating toolbar's colour popover
await b.ev(`document.querySelector('[data-cmd=rect]').click()`);
await L.clickOn('[data-tb=fill]');
await b.ev(`document.querySelector('#ed-pop [data-c="#f7912f"]').scrollIntoView({ block: 'center' })`);
await L.clickOn('#ed-pop [data-c="#f7912f"]');
ok((await b.ev(`DeckEditor.selection[0].el.style.background`)).includes('247, 145, 47') || (await b.ev(`DeckEditor.selection[0].el.style.background`)).includes('f7912f'), 'colour applies to selection', await b.ev(`DeckEditor.selection[0].el.style.background`));
await b.key('z', { ctrl: true });
ok(!(await b.ev(`document.querySelector('.slide.active .ed-free')?.style.background || ''`)).includes('247'), 'undo colour', await b.ev(`document.querySelector('.slide.active .ed-free')?.style.background`));
// slide add / delete undo
const sc = await b.ev(`document.querySelectorAll('#stage > .slide').length`);
await b.ev(`document.querySelector('#ed-add [data-menu]').click()`); // the gallery is built when the menu opens
await b.ev(`document.querySelector('[data-add=content]').click()`);
ok(await b.ev(`document.querySelectorAll('#stage > .slide').length`) === sc + 1, 'slide added');
await b.key('z', { ctrl: true });
ok(await b.ev(`document.querySelectorAll('#stage > .slide').length`) === sc, 'undo add slide');
ok(await b.ev(`document.querySelector('.slide.active').dataset.layout`) !== undefined, 'active slide kept');
await b.key('z', { ctrl: true, shift: true });
ok(await b.ev(`document.querySelectorAll('#stage > .slide').length`) === sc + 1, 'redo add slide');
// move undo
console.log(b.logs.join('\n'));
console.log('A4b done', L.passes, 'pass', L.fails, 'fail');
await b.close();
