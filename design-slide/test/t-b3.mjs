// B3 cell toolbar: font + size (whole table), text colour, row fill, column align, radius, spacing; undo.
import { start, ok } from './t-lib.mjs';
import * as L from './t-lib.mjs';
import * as H from './t-bh.mjs';
await start('http://localhost:' + process.env.PORT + '/tu-test.html#6');
const b = L.b, SL = '.slide.active', TD = `${SL} tr:nth-child(2) td`;
await L.clickOn(TD);
let t = await H.tb();
ok((await L.S())[0].startsWith('cell:') && t.on && t.ids.join() === 'font,tcolor,rowfill,align,radius,spacing,more' && t.titles, 'cell toolbar buttons + tooltips', t.ids.join());
const lbl = () => b.ev(`document.querySelector('#ed-tb [data-tb=font]').textContent`);
ok((await lbl()).includes('Figtree') && (await lbl()).includes('26'), 'font label: family + size', await lbl());
// font + size apply to the whole table
await H.tbClick('font');
await b.ev(`(s => { s.selectedIndex = 2; s.dispatchEvent(new Event('change', { bubbles: true })); })(document.querySelector('#ed-pop #ed-f-fam'))`);
await L.clickOn('#ed-pop #ed-f-size'); await b.key('a', { ctrl: true }); await b.type('30');
ok((await H.style(`${SL} table`, 'fontFamily')).includes('Georgia') && await H.style(`${SL} table`, 'fontSize') === '30px', 'family + size are written on the table', await H.style(`${SL} table`, 'fontSize'));
ok((await lbl()).includes('Georgia') && (await lbl()).includes('30'), 'label follows', await lbl());
await b.ev(`document.activeElement.blur()`); await H.undo(); await H.undo(); await L.clickOn(TD);
ok(await H.style(`${SL} table`, 'fontSize') === '', 'undo returns the table font', await H.style(`${SL} table`, 'fontSize'));
// text colour
await H.tbClick('tcolor'); await H.pClick('[data-c="#f7912f"]');
ok(await H.comp(TD, 'color') === 'rgb(247, 145, 47)', 'text colour applies to the cell');
await H.undo(); await L.clickOn(TD);
ok(await H.comp(TD, 'color') !== 'rgb(247, 145, 47)', 'undo');
// row fill: the <tr> and its cells
await H.tbClick('rowfill');
ok(await b.ev(`document.querySelector('#ed-pop [data-c=none]').textContent`) === 'None', 'row fill popover has None');
await H.pClick('[data-c="#ffca35"]');
ok(await H.style(`${SL} tr:nth-child(2)`, 'background') !== '' && await b.ev(`[...document.querySelectorAll('${SL} tr:nth-child(2) td')].every(c => getComputedStyle(c).backgroundColor === 'rgb(255, 202, 53)')`), 'row fill: background on the <tr> and visible on every cell', await H.style(`${SL} tr:nth-child(2)`, 'background'));
ok(await H.comp(`${SL} tr:nth-child(3) td`, 'backgroundColor') !== 'rgb(255, 202, 53)', 'other rows untouched');
await H.pClick('[data-c=none]');
ok(await H.style(`${SL} tr:nth-child(2)`, 'background') === '', 'None removes the row fill');
await H.undo(); await H.undo(); await L.clickOn(TD);
// align column
await H.tbClick('align'); await H.pClick('[data-a=right]');
ok(await b.ev(`[...document.querySelectorAll('${SL} tr')].every(tr => tr.cells[0].style.textAlign === 'right' && tr.cells[1].style.textAlign !== 'right')`), 'align applies to the whole column only');
await H.undo(); await L.clickOn(TD);
// radius on the table, spacing on every cell (a slider drag = one undo step)
await H.tbClick('radius');
const [rx, ry] = await L.at('#ed-pop #ed-rad'); for (const dx of [-30, 0, 30]) await b.click(rx + dx, ry);
const rv = parseFloat(await H.style(`${SL} table`, 'borderRadius'));
ok(rv > 60 && await H.style(`${SL} table`, 'overflow') === 'hidden', 'radius lands on the table', String(rv));
await b.ev(`document.activeElement.blur()`); await H.tbClick('spacing');
const [sx, sy] = await L.at('#ed-pop #ed-pad'); for (const dx of [-30, 0, 30]) await b.click(sx + dx, sy);
const pv = parseFloat(await H.style(TD, 'padding'));
ok(pv > 100 && await b.ev(`[...document.querySelectorAll('${SL} td, ${SL} th')].every(c => c.style.padding === '${pv}px')`), 'spacing = padding on every cell', String(pv));
await b.ev(`document.activeElement.blur()`); await H.undo(); await L.clickOn(TD);
ok(!(await H.style(TD, 'padding')) && parseFloat(await H.style(`${SL} table`, 'borderRadius')) === rv, 'one undo reverts the spacing drag only', await H.style(TD, 'padding'));
console.log(b.logs.join('\n')); console.log('B3 done', L.passes, 'pass', L.fails, 'fail');
await b.close();
