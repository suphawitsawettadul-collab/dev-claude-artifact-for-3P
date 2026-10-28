import { start, ok, html, done, clickOn, enter, reset } from './t-lib.mjs';
import * as L from './t-lib.mjs';
await start('http://localhost:' + process.env.PORT + '/doc.html');
const b = L.b;
await b.ev(`DocEditor.activate('t1')`);
// table ops via right-click menu
await reset(); await b.type('/table'); await enter();
const cells = () => b.ev(`DocEditor.active.querySelectorAll('td,th').length`);
const rows = () => b.ev(`DocEditor.active.querySelector('table').rows.length`);
ok(await rows() === 3, 'table has 3 rows');
const [x, y] = await b.ev(`(() => { const r = document.querySelectorAll('#doc td')[0].getBoundingClientRect(); return [r.left + 10, r.top + 10]; })()`);
const pickMenu = async t => b.ev(`[...document.querySelectorAll('#ed-pop .mi')].find(x => x.textContent.startsWith(${JSON.stringify(t)})).click()`);
await b.click(x, y, { button: 'right' }); await b.sleep(100);
ok(await b.ev(`document.querySelectorAll('#ed-pop .mi').length`) === 7, 'right-click on a cell opens the table menu');
await pickMenu('Insert row below'); ok(await rows() === 4, 'insert row below');
await b.click(x, y, { button: 'right' }); await pickMenu('Insert column right'); ok(await cells() === 4 * 4, 'insert column right', String(await cells()));
await b.click(x, y, { button: 'right' }); await pickMenu('Delete column'); ok(await cells() === 4 * 3, 'delete column');
await b.click(x, y, { button: 'right' }); await pickMenu('Delete row'); ok(await rows() === 3, 'delete row');
// Tab moves between cells and adds a row at the end
await b.ev(`(() => { const c = document.querySelectorAll('#doc td'); const last = c[c.length - 1]; const r = document.createRange(); r.selectNodeContents(last); r.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(r); })()`);
await b.key('Tab', { code: 'Tab', vk: 9 }); ok(await rows() === 4, 'Tab in the last cell adds a row');
await b.click(x, y, { button: 'right' }); await pickMenu('Delete table'); ok(!(await html()).includes('<table'), 'delete table');
// chart: insert, edit data, type
await reset(); await b.type('/chart'); await enter();
ok(await b.ev(`DocEditor.active.querySelectorAll('figure.chart svg rect[data-mark]').length`) === 3, '/chart draws 3 bars');
await clickOn('figure.chart');
ok(await b.ev(`!!document.querySelector('#ed-pop textarea')`), 'clicking a chart opens its data form');
await b.ev(`document.querySelector('#ed-pop [data-f=rows]').value = 'Q1,10\\nQ2,30\\nQ3,20\\nQ4,5'; document.querySelector('#ed-pop [data-f=type]').value = 'line'; document.querySelector('#ed-pop [data-ok]').click()`);
ok(await b.ev(`DocEditor.active.querySelectorAll('figure.chart svg circle[data-mark]').length`) === 4, 'edited data redraws as a 4-point line chart');
ok(JSON.parse(await b.ev(`DocEditor.active.querySelector('figure.chart').dataset.chart`)).rows.length === 4, 'data kept on the figure');
await b.ev(`document.querySelector('figure.chart').click()`); await b.ev(`document.querySelector('#ed-pop [data-f=type]').value = 'pie'; document.querySelector('#ed-pop [data-ok]').click()`);
ok(await b.ev(`DocEditor.active.querySelectorAll('figure.chart svg path[data-mark]').length`) === 4, 'pie chart draws slices');
// diagram
await reset(); await b.type('/diagram'); await enter();
ok(await b.ev(`DocEditor.active.querySelectorAll('figure.diagram svg g[data-mark]').length`) === 3, '/diagram draws 3 steps');
await clickOn('figure.diagram'); await b.ev(`document.querySelector('#ed-pop [data-f=steps]').value = 'A\\nB\\nC\\nD'; document.querySelector('#ed-pop [data-ok]').click()`);
ok(await b.ev(`DocEditor.active.querySelectorAll('figure.diagram svg g[data-mark]').length`) === 4, 'edited steps redraw');
// image: insert via paste of a file
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
await reset();
await b.ev(`(() => { const f = new File([Uint8Array.from(atob('${png}'), c => c.charCodeAt(0))], 'dot.png', { type: 'image/png' }); const dt = new DataTransfer(); dt.items.add(f); DocEditor.active.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); })()`);
await b.sleep(300);
ok((await html()).includes('<figure class="img"') && (await html()).includes('data:image/png'), 'pasted image becomes a figure');
// chips
await reset(); await b.type('/date'); await enter();
ok(await b.ev(`!!DocEditor.active.querySelector('.chip.date')`), '/date inserts a date chip');
await enter(); await b.type('/mention'); await enter(); await b.sleep(100); await b.ev(`document.querySelector('#ed-pop input').value = 'Suphawit'`); await b.key('Enter', { code: 'Enter', vk: 13 }); await b.sleep(100);
ok(await b.ev(`DocEditor.active.querySelector('.chip.mention')?.textContent`) === '@Suphawit', '/mention inserts @Suphawit chip');
await enter(); await b.type('/link to tab'); await enter(); await b.sleep(100);
await b.ev(`document.querySelectorAll('#ed-pop .mi')[0].click()`); await b.sleep(100);
ok(await b.ev(`!!DocEditor.active.querySelector('.chip.tab[data-ref]')`), 'tab link chip inserted');
await b.ev(`DocEditor.active.querySelector('.chip.tab').click()`); await b.sleep(100);
ok(await b.ev(`DocEditor.active.dataset.tab`) === 't2', 'clicking a tab chip opens that tab');
// pending block + code block
await b.ev(`DocEditor.activate('t1')`); await reset(); await b.type('/pending'); await enter();
ok(await b.ev(`!!DocEditor.active.querySelector('.pending[data-intent]')`), '/pending inserts a pending block');
await reset(); await b.type('``` '); await b.type('code'); await enter(); await b.type('more');
ok((await html()).replace('\n\n', '\n').includes('<pre>code\nmore') , 'code block keeps newlines on Enter', await html());
await done();
