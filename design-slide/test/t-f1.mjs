// F: zoom menu and keys, slide transitions, rename, export as web page and as PNG.
import fs from 'node:fs';
import path from 'node:path';
import { start, ok } from './t-lib.mjs';
import * as L from './t-lib.mjs';
import * as C from './t-ch.mjs';
const dir = process.env.DECK_DIR, port = process.env.PORT;
const b = await start(`http://localhost:${port}/deck.html#2`);
const zoomText = () => b.ev(`document.getElementById('ed-zoom').firstChild.textContent`);
const wait = async f => { for (let k = 0; k < 60 && !fs.existsSync(f); k++) await b.sleep(500); return fs.existsSync(f); };
// zoom
await b.ev(`document.getElementById('ed-zoom').click()`);
const zi = await b.ev(`[...document.querySelectorAll('#ed-tools-r .items button')].filter(x => x.dataset.zoom || x.dataset.zoomstep).map(x => x.dataset.zoom || ('step' + x.dataset.zoomstep)).join()`);
ok(zi === 'step1,step-1,fit,0.25,0.5,0.75,1,1.5,2', 'zoom menu: in, out, fit, 25 to 200%', zi);
await b.ev(`document.querySelector('[data-zoom="1"]').click()`);
ok(await zoomText() === '100%', 'menu sets 100%');
await b.key('=', { ctrl: true, code: 'Equal', vk: 187 });
ok(await zoomText() === '150%', 'Ctrl+= zooms in to 150%', await zoomText());
await b.key('=', { ctrl: true, code: 'Equal', vk: 187 });
ok(await zoomText() === '200%', 'and to 200%', await zoomText());
await b.key('-', { ctrl: true, code: 'Minus', vk: 189 });
ok(await zoomText() === '150%', 'Ctrl+- zooms out', await zoomText());
await b.ev(`document.querySelector('[data-zoom="fit"]').click()`);
// transitions
await C.openPanel();
await L.esc();
ok(await C.has('[data-pp=tr]'), 'slide properties have a Transition select');
await C.psel('tr', 'fade');
ok(await b.ev(`document.querySelector('#stage > .slide.active').dataset.transition`) === 'fade', 'choosing Fade writes data-transition on the slide');
await b.ev(`document.querySelector('[data-cmd=present]').click()`); await b.sleep(150);
ok(await b.ev(`getComputedStyle(document.querySelector('#stage > .slide.active')).animationName`) === 'tr-fade', 'presenting plays the fade');
await b.key('Escape', { code: 'Escape', vk: 27 }); await b.sleep(150);
await C.psel('tr', 'none');
ok(!(await b.ev(`document.querySelector('#stage > .slide.active').hasAttribute('data-transition')`)), 'None removes it');
await C.openPanel(); // close the panel again
// rename
await b.ev(`document.querySelector('[data-cmd=rename]').click()`); await b.sleep(100);
ok(await b.ev(`!!document.querySelector('#ed-head .ed-rename')`), 'Rename shows an input');
await b.ev(`document.querySelector('.ed-rename').select()`); await b.type('Renamed deck'); await b.key('Enter', { code: 'Enter', vk: 13 }); await b.sleep(100);
ok(await b.ev(`document.title`) === 'Renamed deck' && await b.ev(`document.querySelector('.ed-title span').textContent`) === 'Renamed deck' && await b.ev(`document.getElementById('ed-save').classList.contains('dirty')`), 'Enter renames the deck and marks it unsaved');
// skip one slide, then export as a web page
await b.click(...(await L.at('#ed-thumbs .ed-thumb:nth-of-type(3)')), { button: 'right' }); await L.clickOn('#ed-ctx [data-sctx=skip]');
await b.ev(`document.querySelector('[data-cmd=html]').click()`);
const web = path.join(dir, 'deck-web.html');
ok(await wait(web), 'web page written');
if (fs.existsSync(web)) {
  const h = fs.readFileSync(web, 'utf8');
  ok((h.match(/class="slide[ "]/g) || []).length === 2 && !h.includes('<script src="editor.js"') && !h.includes('data-chrome=') && h.includes('<title>Renamed deck</title>'), 'web page holds the 2 slides that are not skipped, no editor', String((h.match(/class="slide"/g) || []).length));
  const w = await (async () => { await b.ev(`location.href = 'http://localhost:${port}/deck-web.html#1'`); await b.sleep(1200); return b; })();
  ok(await b.ev(`document.querySelectorAll('.slide.on').length`) === 1 && await b.ev(`location.hash`) === '#1', 'the web page opens on slide 1');
  await b.key('ArrowRight', { code: 'ArrowRight', vk: 39 }); await b.sleep(100);
  ok(await b.ev(`location.hash`) === '#2', 'arrow key pages through it');
  ok(await b.ev(`document.getElementById('vw').getBoundingClientRect().width`) > 300, 'and it is scaled to the window');
}
// PNG of the current slide
await b.ev(`location.href = 'http://localhost:${port}/deck.html#2'`); await b.sleep(1800);
await b.ev(`document.querySelector('[data-cmd=png]').click()`);
const png = path.join(dir, 'deck-slide-2.png');
ok(await wait(png), 'png written');
if (fs.existsSync(png)) {
  const buf = fs.readFileSync(png);
  ok(buf.subarray(1, 4).toString() === 'PNG' && buf.readUInt32BE(16) === 2560 && buf.readUInt32BE(20) === 1440, 'a real PNG at 2560 x 1440', buf.readUInt32BE(16) + 'x' + buf.readUInt32BE(20));
}
console.log(b.logs.join('\n')); console.log('F1 view and export done', L.passes, 'pass', L.fails, 'fail');
await b.close();
