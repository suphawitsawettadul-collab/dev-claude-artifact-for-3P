import { start, ok } from './t-lib.mjs';
import * as L from './t-lib.mjs';
await start('http://localhost:' + process.env.PORT + '/tu-test.html#2');
const b = L.b;
// present and exit
await L.clickOn('.slide.active .tu-agenda-h');
await b.ev(`document.querySelector('[data-cmd=present]').click()`);
ok(await b.ev(`document.body.classList.contains('presenting')`) && await b.ev(`document.querySelectorAll('.ed-sel').length`) === 0, 'present clears outlines');
await b.key('Escape', { code: 'Escape', vk: 27 });
ok(!(await b.ev(`document.body.classList.contains('presenting')`)), 'Esc leaves present');
// grid view
await b.ev(`document.querySelector('[data-view=grid]').click()`); await b.sleep(300);
ok(await b.ev(`document.querySelectorAll('#ed-grid .ed-thumb').length`) === 7, 'grid shows 7');
await b.ev(`document.querySelector('[data-view=single]').click()`);
// theme + zoom keep working; selection handles follow zoom
await L.clickOn('.slide.active .tu-agenda-h');
const h0 = await b.ev(`document.querySelector('.slide.active .ed-sel i').getBoundingClientRect().width`);
await b.ev(`document.querySelector('[data-zoom="0.5"]').click()`);
const h1 = await b.ev(`document.querySelector('.slide.active .ed-sel i').getBoundingClientRect().width`);
ok(Math.abs(h0 - 10) < 0.6 && Math.abs(h1 - 10) < 0.6, 'handle stays 10px at any zoom', h0 + ' ' + h1);
await b.ev(`document.querySelector('[data-cmd=theme]').click()`);
// onSelectionChange hook
await b.ev(`window.__sc = []; DeckEditor.onSelectionChange.push(s => __sc.push(s.map(x => x.kind).join()))`);
await L.clickOn('.slide.active .tu-agenda-item b');
await L.esc();
const ev = await b.ev('__sc.join("|")');
ok(ev.includes('shape') && ev.endsWith('|'), 'selection listeners fire', ev);
// thumb dup/del via manage still works and record
const n0 = await b.ev(`document.querySelectorAll('#stage > .slide').length`);
await b.ev(`document.querySelector('#ed-thumbs .ed-thumb [data-act=dup]').click()`);
await b.key('z', { ctrl: true });
ok(await b.ev(`document.querySelectorAll('#stage > .slide').length`) === n0, 'thumb dup + undo');
await b.ev(`document.querySelectorAll('#ed-thumbs .ed-thumb')[1].querySelector('[data-act=del]').click()`);
ok(await b.ev(`document.querySelectorAll('#stage > .slide').length`) === n0 - 1, 'thumb delete');
await b.key('z', { ctrl: true });
ok(await b.ev(`document.querySelectorAll('#stage > .slide').length`) === n0, 'undo thumb delete');
ok(await b.ev(`document.querySelectorAll('.tu-page')[0].textContent`) === '4', 'page numbers intact after undo');
console.log(b.logs.join('\n'));
console.log('misc done', L.passes, 'pass', L.fails, 'fail');
await b.close();
