import { start, ok } from './t-lib.mjs';
import * as L from './t-lib.mjs';
import fs from 'node:fs';
const near = (a, b, t = 1.5) => Math.abs(a - b) <= t;
fs.copyFileSync(process.env.DECK_DIR + '/deck.html', process.env.DECK_DIR + '/deck-t5.html');
await start('http://localhost:' + process.env.PORT + '/deck-t5.html#3');
const b = L.b;
const h2 = '.slide.active h2';
const st = () => b.ev(`JSON.stringify([...document.querySelector('.slide.active').children].filter(c => !('chrome' in c.dataset)).map(c => c.nodeName + (c.getAttribute('style') ? '*' : '')))`);
const s0 = await st();
// drag then undo -> back in flow, no inline style
let [x, y] = await L.at(h2);
await L.clickOn(h2); await b.drag(x, y, x + 100, y + 50);
ok((await st()) !== s0, 'drag changed the slide');
await b.key('z', { ctrl: true });
ok((await st()) === s0, 'Ctrl+Z undoes move/pin fully', (await st()) + ' vs ' + s0);
ok(await b.ev('location.hash') === '#3', 'slide index kept after undo');
await b.key('z', { ctrl: true, shift: true });
ok((await st()) !== s0, 'redo moves again');
await b.key('y', { ctrl: true }); // nothing to redo; must not crash
// nudge undo as one step
await L.clickOn(h2);
await b.key('ArrowRight', { code: 'ArrowRight', vk: 39 }); await b.key('ArrowRight', { code: 'ArrowRight', vk: 39 }); await b.key('ArrowDown', { code: 'ArrowDown', vk: 40 });
const l1 = await b.ev(`parseFloat(document.querySelector('${h2}').style.left)`);
await b.key('z', { ctrl: true });
const l2 = await b.ev(`parseFloat(document.querySelector('${h2}').style.left)`);
ok(near(l1 - l2, 2, 0.01), 'quick nudges are one undo step', l1 + ' ' + l2);
// typing: one step; Ctrl+Z inside the text is left to the browser
const t0 = await b.ev(`document.querySelector('${h2}').textContent`);
await L.clickOn(h2); await L.clickOn(h2);
ok(await b.ev('document.activeElement.nodeName') === 'H2', 'editing');
await b.type('ABC');
await b.key('z', { ctrl: true });
ok(await b.ev('document.activeElement.nodeName') === 'H2', 'Ctrl+Z while typing keeps the editor (browser handles text undo)');
await b.type('XYZ');
await L.esc(); await L.esc();
const t1 = await b.ev(`document.querySelector('${h2}').textContent`);
await b.key('z', { ctrl: true });
const t2 = await b.ev(`document.querySelector('${h2}').textContent`);
ok(t1 !== t2 && t2 === t0, 'Ctrl+Z after leaving edit restores pre-edit text', JSON.stringify([t0, t1, t2]));
// notes undo
await b.ev(`document.querySelector('[data-cmd=notes]').click()`);
await b.ev(`document.getElementById('ed-notes').focus()`);
await b.type('note1');
ok((await b.ev(`document.querySelector('.slide.active > aside.notes')?.textContent`)) === 'note1', 'notes typed');
await b.ev(`document.getElementById('ed-notes').blur()`);
await b.key('z', { ctrl: true });
ok(!(await b.ev(`document.querySelector('.slide.active > aside.notes')?.textContent`)), 'undo notes');
// insert table / save strips chrome
await b.ev(`document.querySelector('[data-cmd=table]').click()`);
ok((await L.S())[0].startsWith('table:'), 'inserted table is selected');
await b.ev(`document.getElementById('ed-save').click()`); await b.sleep(600);
const saved = fs.readFileSync(process.env.DECK_DIR + '/deck-t5.html', 'utf8');
ok(!/ed-sel|data-chrome|contenteditable|zoom|class="slide active"|ed-ctx/.test(saved), 'saved file has no editor chrome', saved.match(/ed-sel|data-chrome|contenteditable|zoom|slide active|ed-ctx/g)?.join());
ok(/<table[^>]*ed-free/.test(saved), 'inserted table saved');
ok(fs.existsSync(process.env.DECK_DIR + '/deck-t5.html.bak'), '.bak written next to deck');
// thumbnails clean
ok(await b.ev(`document.querySelectorAll('#ed-thumbs .ed-sel, #ed-thumbs [contenteditable]').length`) === 0, 'thumbs clean');
// present: no outlines
await b.ev(`document.querySelector('.slide.active').click()`);
await b.ev(`document.body.classList.contains('presenting')`);
console.log(b.logs.join('\n'));
console.log('A5 done', L.passes, 'pass', L.fails, 'fail');
await b.close();
