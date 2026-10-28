import { start, ok, at, clickOn, S, b as _b } from './t-lib.mjs';
import * as L from './t-lib.mjs';
await start('http://localhost:' + process.env.PORT + '/tu-test.html#1');
const b = L.b;
// slide 1: h1 under .tu-cover-title
await L.clickOn('.slide.active h1');
let s = await L.S();
ok(s.length === 1 && s[0].startsWith('text:'), 'click h1 selects text', JSON.stringify(s));
ok(await b.ev(`document.querySelectorAll('[contenteditable]').length`) === 0, 'no contenteditable after first click');
ok(await b.ev(`document.querySelectorAll('.ed-sel').length`) === 1 && await b.ev(`document.querySelectorAll('.ed-sel i').length`) === 4, 'one outline + 4 handles');
await b.type('zzz');
ok(!(await b.ev(`document.querySelector('.slide.active h1').textContent`)).includes('zzz'), 'typing on first click does nothing');
// click empty area -> slide
const sr = await b.ev(`(() => { const r = document.querySelector('.slide.active').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
await b.click(sr[0] + sr[2] * 0.15, sr[1] + sr[3] * 0.15);
s = await L.S();
ok(s.length === 1 && s[0].startsWith('slide:'), 'empty area selects slide', JSON.stringify(s));
ok(await b.ev(`document.querySelectorAll('.ed-sel i').length`) === 0, 'slide selection has no handles');
// second click on selected text -> edit at click point
await L.clickOn('.slide.active h1');
await L.clickOn('.slide.active h1');
ok(await b.ev(`document.querySelectorAll('[contenteditable]').length`) === 1 && await b.ev(`document.activeElement.tagName`) === 'H1', 'click on selected text starts editing only that element');
await b.type('Q');
ok((await b.ev(`document.querySelector('.slide.active h1').textContent`)).includes('Q'), 'typing works while editing');
await b.key('Escape', { code: 'Escape', vk: 27 });
ok(await b.ev(`document.querySelectorAll('[contenteditable]').length`) === 0, 'Esc leaves editing');
s = await L.S(); ok(s.length === 1 && s[0].startsWith('text:'), 'Esc keeps selection', JSON.stringify(s));
await b.key('Escape', { code: 'Escape', vk: 27 });
s = await L.S(); ok(s.length === 0, 'second Esc clears selection', JSON.stringify(s));
// undo restores pre-edit text
await b.key('z', { ctrl: true });
ok(!(await b.ev(`document.querySelector('.slide.active h1').textContent`)).includes('Q'), 'Ctrl+Z after editing restores pre-edit text');
await b.key('z', { ctrl: true, shift: true });
ok((await b.ev(`document.querySelector('.slide.active h1').textContent`)).includes('Q'), 'Ctrl+Shift+Z redoes');
// dblclick on p -> edit with caret
await L.clickOn('.slide.active p');
await L.clickOn('.slide.active p', { clickCount: 2 });
ok(await b.ev(`document.querySelectorAll('[contenteditable]').length`) === 1, 'editing after dblclick/second click');
await b.key('Escape', { code: 'Escape', vk: 27 }); await b.key('Escape', { code: 'Escape', vk: 27 });
// shift click
await L.clickOn('.slide.active h1');
await L.clickOn('.slide.active p', { modifiers: 8 });
s = await L.S(); ok(s.length === 2, 'shift+click adds', JSON.stringify(s));
ok(await b.ev(`document.querySelectorAll('.ed-sel').length`) === 3 && await b.ev(`document.querySelectorAll('.ed-sel i').length`) === 4, 'multi: 2 outlines + union with handles');
await L.clickOn('.slide.active p', { modifiers: 8 });
s = await L.S(); ok(s.length === 1, 'shift+click removes', JSON.stringify(s));
// logs
console.log(b.logs.join('\n'));
console.log('A1 slide1 done', L.passes, 'pass', L.fails, 'fail');
await b.close();
