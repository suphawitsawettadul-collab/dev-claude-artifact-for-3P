// D: shape keys (R, Shift+R, O, D, L, Shift+L), arrows and diamond from the menu, connector with a head, icon picker.
import { start, ok } from './t-lib.mjs';
import * as L from './t-lib.mjs';
import * as C from './t-ch.mjs';
await start('http://localhost:' + process.env.PORT + '/deck.html#2');
const b = L.b;
const free = () => b.ev(`document.querySelectorAll('#stage > .slide.active .ed-free').length`);
const last = () => b.ev(`(() => { const e = [...document.querySelectorAll('#stage > .slide.active .ed-free')].at(-1); return JSON.stringify({ tag: e.tagName, shape: e.dataset.shape || '', radius: e.style.borderRadius, clip: e.style.clipPath, icon: e.dataset.icon || '' }); })()`).then(JSON.parse);
const key = async (k, o = {}) => { await b.key(k, { code: o.shift ? 'Key' + k.toUpperCase() : 'Key' + k.toUpperCase(), shift: o.shift, vk: k.toUpperCase().charCodeAt(0) }); await b.sleep(80); };
ok(await free() === 0, 'slide 2 has no inserted shapes');
await key('r'); let s = await last();
ok(await free() === 1 && s.tag === 'DIV' && s.radius === '0px', 'R inserts a rectangle', JSON.stringify(s));
await L.esc(); await key('r', { shift: true }); s = await last();
ok(await free() === 2 && s.radius.endsWith('px') && s.radius !== '0px', 'Shift+R inserts a rounded rectangle', JSON.stringify(s));
await L.esc(); await key('o'); s = await last();
ok(await free() === 3 && s.radius === '50%', 'O inserts an ellipse', JSON.stringify(s));
await L.esc(); await key('d'); s = await last();
ok(await free() === 4 && s.shape === 'diamond' && s.clip.includes('polygon'), 'D inserts a diamond', JSON.stringify(s));
await L.esc(); await key('l'); s = await last();
ok(await free() === 5 && s.shape === '', 'L inserts a line', JSON.stringify(s));
await L.esc(); await key('l', { shift: true }); s = await last();
ok(await free() === 6 && s.shape === 'connector', 'Shift+L inserts a connector', JSON.stringify(s));
ok(await b.ev(`getComputedStyle([...document.querySelectorAll('#stage > .slide.active .ed-free')].at(-1), '::after').content`) === '""', 'the connector has an arrow head');
ok((await L.S())[0]?.startsWith('shape:'), 'the new shape is selected', JSON.stringify(await L.S()));
// menu entries
await L.esc();
await b.ev(`document.querySelector('#ed-tools-l .ed-menu [data-menu]').click()`);
const labels = await b.ev(`[...document.querySelectorAll('#ed-tools-l .ed-menu:first-of-type .items button, #ed-tools-l .ed-menu .items button')].filter(x => x.dataset.cmd).map(x => x.dataset.cmd).join()`);
ok(['rect', 'round', 'ellipse', 'diamond', 'arrow-right', 'arrow-left', 'arrow-up', 'arrow-down', 'line', 'connector'].every(k => labels.includes(k)), 'shapes menu lists 10 shapes', labels);
await b.ev(`document.querySelector('[data-cmd=arrow-up]').click()`); await b.sleep(100); s = await last();
ok(s.shape === 'arrow-up' && await free() === 7, 'Arrow up from the menu', JSON.stringify(s));
await b.ev(`document.querySelector('[data-cmd=arrow-right]').click()`); await b.sleep(100);
ok((await last()).shape === 'arrow-right', 'Arrow right from the menu');
// typing a letter in a text box does not insert a shape
await L.esc(); const n = await free();
await L.clickOn('#stage > .slide.active h2'); await L.clickOn('#stage > .slide.active h2', {}, 150); await b.type('rod');
ok(await free() === n, 'letters typed in text do not insert shapes');
await L.esc();
// icons
await b.ev(`document.querySelector('#ed-icons-menu [data-menu]').click()`); await b.sleep(400);
const icons = await b.ev(`document.querySelectorAll('#ed-icons-menu .icon-grid button').length`);
ok(icons === 30, 'icon picker shows 30 icons', icons);
await L.clickOn('#ed-icons-menu [data-icon=star]'); await b.sleep(120); s = await last();
ok(s.tag === 'svg' && s.icon === 'star' && (await L.S())[0]?.startsWith('img:'), 'picking an icon inserts a selected svg', JSON.stringify(s) + JSON.stringify(await L.S()));
const cnt = await free(); await C.undo(); await b.sleep(150);
ok(await free() === cnt - 1, 'undo removes the icon');
console.log(b.logs.join('\n')); console.log('D1 shapes done', L.passes, 'pass', L.fails, 'fail');
await b.close();
