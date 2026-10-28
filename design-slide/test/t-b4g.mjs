// B4: gradient fills, and colours that must not steal the text caret (range colour while editing).
import { start, ok } from './t-lib.mjs';
import * as L from './t-lib.mjs';
import * as H from './t-bh.mjs';
await start('http://localhost:' + process.env.PORT + '/tu-test.html#4');
const b = L.b, FREE = '.slide.active .ed-free', SUB = '.slide.active .tu-sub';
// gradient on a shape
await b.ev(`document.querySelector('[data-cmd=rect]').click()`);
await H.tbClick('fill'); await L.clickOn('#ed-pop [data-tab=custom]');
ok(await b.ev(`[...document.querySelectorAll('#ed-pop [data-m]')].map(x => x.textContent).join('|')`) === 'Solid|Gradient', 'fill: Solid | Gradient control');
ok(await b.ev(`document.querySelector('#ed-pop .cp-g').style.display`) === 'none', 'gradient controls hidden in Solid mode');
await L.clickOn('#ed-pop [data-m=grad]');
let bg = await H.style(FREE, 'background');
ok(bg.includes('linear-gradient(135deg') , 'Gradient writes linear-gradient(135deg, a, b)', bg);
ok(await b.ev(`document.querySelectorAll('#ed-pop [data-st]').length`) === 2 && await b.ev(`document.querySelector('#ed-pop #cp-ang').max`) === '360', 'two colour stops + angle slider');
const [ax, ay] = await L.at('#ed-pop #cp-ang'); await b.click(ax - 30, ay);
bg = await H.style(FREE, 'background');
ok(/linear-gradient[(](9[0-9]|1[0-2][0-9])deg/.test(bg), 'angle slider changes the angle', bg);
await L.clickOn('#ed-pop [data-st="1"]'); await L.clickOn('#ed-pop .cp-hex'); await b.key('a', { ctrl: true }); await b.type('#ff0000');
ok((await H.comp(FREE, 'backgroundImage')).includes('rgb(255, 0, 0)'), 'second stop edited', await H.comp(FREE, 'backgroundImage'));
ok(await b.ev(`document.querySelector('#ed-tb [data-tb=fill] i').style.background.includes('gradient')`), 'toolbar swatch shows the gradient');
await L.clickOn('#ed-pop [data-m=solid]');
ok(!(await H.style(FREE, 'background')).includes('gradient'), 'back to Solid drops the gradient');
await b.ev(`document.activeElement.blur()`); await H.undo(); await L.clickOn(FREE);
ok(await H.comp(FREE, 'backgroundColor') === 'rgb(199, 219, 240)' && (await H.comp(FREE, 'backgroundImage')) === 'none', 'one Ctrl+Z reverts the whole gradient session', await H.style(FREE, 'background'));
await b.key('Delete', { code: 'Delete', vk: 46 });
// the caret stays: colour a selected range while editing
await b.ev(`document.querySelector('${SUB}').textContent = 'Hello brave new world'`);
await H.edit(SUB);
await H.selectText(SUB, 0, 5);
await H.tbClick('tcolor');
ok(await b.ev(`document.querySelectorAll('[contenteditable]').length`) === 1, 'opening the colour popover keeps the text in edit mode');
await H.pClick('[data-c="#21409a"]');
ok(await b.ev(`(s => !!s && s.textContent + '|' + getComputedStyle(s).color)(document.querySelector('${SUB} span'))`) === 'Hello|rgb(33, 64, 154)', 'theme colour wraps only the selected range', await H.html(SUB));
ok(await H.style(SUB, 'color') === '' && await b.ev(`document.querySelectorAll('[contenteditable]').length`) === 1, 'element colour untouched, still editing');
await L.clickOn('#ed-pop [data-tab=custom]'); await L.clickOn('#ed-pop .cp-hex'); await b.key('a', { ctrl: true }); await b.type('#ff0000');
ok(await b.ev(`[...document.querySelectorAll('${SUB} span')].map(s => s.textContent + ':' + getComputedStyle(s).color).join(',')`).then(s => s.includes('Hello:rgb(255, 0, 0)')), 'hex typed in the popover still reaches the range', await H.html(SUB));
ok(await b.ev(`document.querySelectorAll('[contenteditable]').length`) === 1, 'edit mode survives the popover input taking focus');
await b.key('Escape', { code: 'Escape', vk: 27 });
ok(!(await H.popOpen()) && await b.ev(`document.querySelectorAll('[contenteditable]').length`) === 1, 'Esc closes the popover only');
await L.clickOn('.slide.active .tu-title'); // leave editing
await H.undo(); await H.undo(); await H.undo();
ok(!(await H.html(SUB)).includes('<'), 'Ctrl+Z steps back through the range colour edits', await H.html(SUB));
console.log(b.logs.join('\n')); console.log('B4 gradient/caret done', L.passes, 'pass', L.fails, 'fail');
await b.close();
