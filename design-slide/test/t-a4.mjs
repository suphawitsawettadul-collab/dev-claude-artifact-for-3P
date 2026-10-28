import { start, ok } from './t-lib.mjs';
import * as L from './t-lib.mjs';
const rect = sel => L.b.ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
const near = (a, b, t = 1.5) => Math.abs(a - b) <= t;
await start('http://localhost:' + process.env.PORT + '/tu-test.html#4');
const b = L.b;
const menu = () => b.ev(`JSON.stringify([...document.querySelectorAll('#ed-ctx button')].map(x => x.dataset.ctx + (x.disabled ? '-' : '+')))`).then(JSON.parse);
const n = sel => b.ev(`document.querySelectorAll('.slide.active ${sel}').length`);
const nk = () => b.ev(`document.querySelector('.slide.active').children.length`);
const kids = () => b.ev(`JSON.stringify([...document.querySelector('.slide.active').children].filter(c => !c.dataset.hasOwnProperty('chrome')).map(c => c.className || c.nodeName))`).then(JSON.parse);
// right click on the title
const [x, y] = await L.at('.slide.active .tu-title');
await b.click(x, y, { button: 'right' });
ok(await b.ev(`getComputedStyle(document.getElementById('ed-ctx')).display`) === 'block', 'menu opens');
let m = await menu(); console.log(m.join(' '));
ok(m.join(' ') === 'cut+ copy+ link+ paste- dup+ front+ back+ group- ungroup- del+', 'menu states on one text', m.join(' '));
ok((await L.S())[0].startsWith('text:'), 'right-click selected the element');
// Copy via menu, then Paste via menu
await b.ev(`document.querySelector('#ed-ctx [data-ctx=copy]').click()`);
ok(await b.ev(`getComputedStyle(document.getElementById('ed-ctx')).display`) === 'none', 'menu closes after action');
const l0 = await b.ev(`parseFloat(getComputedStyle(document.querySelector('.slide.active .tu-title')).left)`);
await b.click(x, y, { button: 'right' });
m = await menu(); ok(m.includes('paste+'), 'paste enabled after copy', m.join(' '));
await b.ev(`document.querySelector('#ed-ctx [data-ctx=paste]').click()`);
ok(await n('.tu-title') === 2, 'paste adds a copy');
const sels = await L.S(); ok(sels.length === 1, 'pasted copy selected', JSON.stringify(sels));
const pl = await b.ev(`(() => { const e = DeckEditor.selection[0].el; return [e.style.position, parseFloat(e.style.left), parseFloat(e.style.top), e.parentElement.classList.contains('slide'), e.style.fontSize].join('|'); })()`);
ok(pl.startsWith('absolute|' + (l0 + 24)), 'pasted copy pinned +24px', pl + ' vs ' + l0);
// Duplicate Ctrl+D
await b.key('d', { ctrl: true });
ok(await n('.tu-title') === 3, 'Ctrl+D duplicates the element');
// Delete (Delete key) removes selection
await b.key('Delete', { code: 'Delete', vk: 46 });
ok(await n('.tu-title') === 2, 'Delete removes');
// Ctrl+X, other slide, Ctrl+V
await b.key('z', { ctrl: true });
ok(await n('.tu-title') === 3, 'undo delete');
await b.key('z', { ctrl: true, shift: true });
ok(await n('.tu-title') === 2, 'redo delete');
// Backspace with new selection
await L.clickOn('.slide.active .tu-sub');
await b.key('x', { ctrl: true });
ok(await n('.tu-sub') === 0, 'Ctrl+X cuts');
await L.go(5);
await b.key('v', { ctrl: true });
ok(await n('.tu-sub') === 2, 'Ctrl+V pastes on another slide');
await L.go(4);
// slide dup via Ctrl+D with nothing selected
{ const [a, c, w, h] = await L.sc(); await b.click(a + w * 0.9, c + h * 0.9); }
ok((await L.S())[0]?.startsWith('slide:'), 'bg click = slide');
const sc0 = await b.ev(`document.querySelectorAll('#stage > .slide').length`);
await b.key('d', { ctrl: true });
ok(await b.ev(`document.querySelectorAll('#stage > .slide').length`) === sc0 + 1, 'Ctrl+D with slide selected duplicates the slide');
await b.key('z', { ctrl: true });
ok(await b.ev(`document.querySelectorAll('#stage > .slide').length`) === sc0, 'undo slide duplicate');
// right-click bg
const [sx, sy, sw, sh] = await L.sc();
await b.click(sx + sw * 0.9, sy + sh * 0.9, { button: 'right' });
m = await menu(); ok(m.join(' ') === 'cut- copy- link+ paste+ dup- front- back- group- ungroup- del-', 'bg menu: element items disabled', m.join(' '));
await b.key('Escape', { code: 'Escape', vk: 27 });
ok(await b.ev(`getComputedStyle(document.getElementById('ed-ctx')).display`) === 'none', 'Esc closes menu');
console.log(b.logs.join('\n'));
console.log('A4a done', L.passes, 'pass', L.fails, 'fail');
await b.close();
