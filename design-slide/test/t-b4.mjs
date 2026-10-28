// B4 colour popover: Theme tab (search, In this slide, DS palette, check), Custom tab (SV / hue / opacity / hex / gradient).
import { start, ok } from './t-lib.mjs';
import * as L from './t-lib.mjs';
import * as H from './t-bh.mjs';
await start('http://localhost:' + process.env.PORT + '/tu-test.html#4');
const b = L.b, SUB = '.slide.active .tu-sub';
const names = sel => b.ev(`[...document.querySelectorAll('#ed-pop ${sel}')].map(n => n.textContent).join('|')`);
await L.clickOn(SUB); await H.tbClick('tcolor');
ok(await b.ev(`[...document.querySelectorAll('#ed-pop .ed-tabs button')].map(x => x.textContent).join('|')`) === 'Theme|Custom', 'tabs Theme | Custom');
ok(await b.ev(`!!document.querySelector('#ed-pop input.ed-q')`), 'search box');
const lbls = await names('.ed-lbl');
ok(lbls === 'In this slide|Palette', 'sections: In this slide, then the DS palette', lbls);
ok(await names('.ed-h') === 'Thai Union 01', 'DS name as a heading');
const used = await b.ev(`[...document.querySelectorAll('#ed-pop .ed-list > .ed-row')].slice(0, 6).map(n => n.textContent).join('|')`);
ok(used.includes('Navy') && used.includes('Sky') && used.includes('White'), 'In this slide: colours of the slide named by DS token', used);
ok(await b.ev(`document.querySelectorAll('#ed-pop [data-c]').length`) >= 13, 'all palette tokens listed');
ok(await b.ev(`[...document.querySelectorAll('#ed-pop [data-c]')].filter(r => r.dataset.c === '#4aabe0' && r.classList.contains('on') && r.querySelector('svg')).length`) === 2, 'check mark on the current colour (In this slide and Palette)');
ok(await b.ev(`document.querySelector('#ed-pop [data-c=none]') === null`), 'no None option for text colour');
await L.clickOn('#ed-pop input.ed-q'); await b.type('roy');
ok(await b.ev(`[...document.querySelectorAll('#ed-pop [data-c]')].map(r => r.textContent).join('|')`) === 'Royal', 'search filters by name');
await H.pClick('[data-c="#21409a"]');
ok(await H.comp(SUB, 'color') === 'rgb(33, 64, 154)', 'Royal applies to the text');
ok(await b.ev(`document.querySelector('#ed-tb [data-tb=tcolor] i').style.background`).then(c => c.includes('33, 64, 154')), 'toolbar swatch follows');
await b.ev(`document.activeElement.blur()`); await H.undo(); await L.clickOn(SUB); // (Ctrl+Z inside the search box would undo its text)
ok(await H.comp(SUB, 'color') === 'rgb(74, 171, 224)', 'Ctrl+Z restores the colour');
// custom tab
await H.tbClick('tcolor'); await L.clickOn('#ed-pop [data-tab=custom]');
ok(await b.ev(`!!document.querySelector('#ed-pop .cp-sv') && !!document.querySelector('#ed-pop .cp-hue') && !!document.querySelector('#ed-pop .cp-al') && !!document.querySelector('#ed-pop .cp-hex') && !!document.querySelector('#ed-pop .cp-op')`), 'SV square, hue, opacity slider, hex, opacity %');
ok(await b.ev(`!!document.querySelector('#ed-pop .cp-eye')`) === await b.ev(`'EyeDropper' in window`), 'eyedropper button only where the browser has EyeDropper');
ok(await b.ev(`document.querySelector('#ed-pop .cp-hex').value`) === '#4aabe0', 'hex shows the current colour');
const hex = () => b.ev(`document.querySelector('#ed-pop .cp-hex').value`);
let r = await H.rect('#ed-pop .cp-sv');
await b.click(r.r - 12, r.t + 12); // near the top-right corner (the corner itself is rounded): high saturation + value
const h1 = await hex(); ok(await H.comp(SUB, 'color') !== 'rgb(74, 171, 224)' && h1.length === 7, 'SV square applies live', h1);
r = await H.rect('#ed-pop .cp-hue'); await b.click(r.l + 1, r.t + r.h / 2);
const rgb = (await hex()).slice(1).match(/../g).map(x => parseInt(x, 16));
ok(rgb[0] > 200 && rgb[1] < 60 && rgb[2] < 60 && await H.comp(SUB, 'color') === `rgb(${rgb.join(', ')})`, 'hue slider at the left = red, applied', await hex());
await L.clickOn('#ed-pop .cp-hex'); await b.key('a', { ctrl: true }); await b.type('#00aa55');
ok(await H.comp(SUB, 'color') === 'rgb(0, 170, 85)', 'hex input applies', await H.comp(SUB, 'color'));
await L.clickOn('#ed-pop .cp-op'); await b.key('a', { ctrl: true }); await b.type('50');
ok(await H.comp(SUB, 'color') === 'rgba(0, 170, 85, 0.5)', 'opacity % input applies rgba', await H.comp(SUB, 'color'));
r = await H.rect('#ed-pop .cp-al'); await b.click(r.r - 2, r.t + r.h / 2);
ok(parseFloat(await b.ev(`document.querySelector('#ed-pop .cp-op').value`)) >= 95, 'opacity slider at the right = about 100%', await b.ev(`document.querySelector('#ed-pop .cp-op').value`));
ok(await b.ev(`!document.querySelector('#ed-pop [data-m]')`), 'text colour: no Gradient control (a gradient cannot colour text)');
await b.ev(`document.activeElement.blur()`); await H.undo(); await L.clickOn(SUB);
ok(await H.comp(SUB, 'color') === 'rgb(74, 171, 224)', 'one Ctrl+Z reverts the whole custom session (ticks merged)', await H.comp(SUB, 'color'));
console.log(b.logs.join('\n')); console.log('B4 theme/custom done', L.passes, 'pass', L.fails, 'fail');
await b.close();
