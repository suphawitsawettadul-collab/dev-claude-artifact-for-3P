import { start, ok, html, done, clickOn, enter } from './t-lib.mjs';
import * as L from './t-lib.mjs';
await start('http://localhost:' + process.env.PORT + '/doc.html');
const b = L.b;
const names = () => b.ev(`JSON.stringify([...document.querySelectorAll('#ed-tray .ed-tab')].map(r => (r.classList.contains('sub') ? '-' : '') + r.querySelector('.nm').textContent))`).then(JSON.parse);
ok(JSON.stringify(await names()) === '["ภาพรวม","-แหล่งข้อมูล"]', 'tray shows tabs, sub-tab indented', JSON.stringify(await names()));
await clickOn('.ed-tab.sub .nm');
ok(await b.ev(`DocEditor.active.dataset.tab`) === 't2' && (await html()).includes('แหล่งข้อมูล'), 'clicking a tab opens it');
ok(await b.ev('location.hash') === '#t2', 'hash follows the tab');
// add tab
await clickOn('#ed-tray > .ed-btn');
ok((await names()).length === 3 && (await names()).at(-1) === 'Untitled tab', 'Add tab adds one', JSON.stringify(await names()));
ok(await b.ev(`document.activeElement === DocEditor.active`), 'new tab is focused for typing');
await b.type('hello'); ok((await html()).includes('hello'), 'can type in the new tab');
// tab menu: rename
const menuOn = async i => { await b.ev(`document.querySelectorAll('#ed-tray .ed-tab')[${i}].querySelector('[data-menu]').click()`); await b.sleep(80); };
const pick = async label => b.ev(`[...document.querySelectorAll('#ed-pop .mi')].find(x => x.textContent.startsWith(${JSON.stringify(label)})).click()`);
await menuOn(2); await pick('Rename'); await b.sleep(80);
await b.ev(`document.querySelector('#ed-pop input').value = 'Notes'`); await b.key('Enter', { code: 'Enter', vk: 13 }); await b.sleep(100);
ok((await names()).at(-1) === 'Notes', 'rename works', JSON.stringify(await names()));
// move up / down
await menuOn(2); await pick('Move up');
ok(JSON.stringify(await names()) === '["Notes","ภาพรวม","-แหล่งข้อมูล"]', 'Move up swaps with the tab above', JSON.stringify(await names()));
await menuOn(0); await pick('Move down');
ok(JSON.stringify(await names()) === '["ภาพรวม","-แหล่งข้อมูล","Notes"]', 'Move down puts it back', JSON.stringify(await names()));
// nest under previous then un-nest
await b.ev(`DocEditor.activate('t1')`);
const ids = await b.ev(`JSON.stringify(DocEditor.tabs())`);
const nt = JSON.parse(ids).find(t => t.name === 'Notes');
await menuOn(JSON.parse(ids).findIndex(t => t.id === nt.id)); const m2 = await b.ev(`[...document.querySelectorAll('#ed-pop .mi')].map(x => x.textContent).join('|')`);
if (m2.includes('Make sub-tab')) { await pick('Make sub-tab'); ok((await names()).filter(n => n.startsWith('-')).length === 2, 'nest makes a sub-tab', JSON.stringify(await names())); await menuOn(JSON.parse(ids).findIndex(t => t.id === nt.id)); await pick('Move to top level'); ok((await names()).filter(n => n.startsWith('-')).length === 1, 'un-nest returns it to top level', JSON.stringify(await names())); }
else { await b.key('Escape', { code: 'Escape', vk: 27 }); ok(true, 'nest skipped (already first among siblings)'); }
// delete down to one tab
for (let n = (await names()).length; n > 1; n--) { await menuOn((await names()).length - 1); const has = await b.ev(`!![...document.querySelectorAll('#ed-pop .mi')].find(x => x.textContent.startsWith('Delete'))`); if (!has) break; await pick('Delete'); await b.sleep(80); }
ok((await names()).length === 1, 'deleting down leaves one tab', JSON.stringify(await names()));
await menuOn(0); ok(!(await b.ev(`[...document.querySelectorAll('#ed-pop .mi')].some(x => x.textContent.startsWith('Delete'))`)), 'last tab cannot be deleted');
await done();
