import { start, ok, enter, html, text, caretEnd, selectText, reset, done, clickOn, at } from './t-lib.mjs';
import * as L from './t-lib.mjs';
await start('http://localhost:' + process.env.PORT + '/doc.html');
const b = L.b;
ok(await b.ev(`DocEditor.tabs().length`) === 2, 'sample doc has two tabs');
await b.ev(`DocEditor.activate('t1')`);
await reset();
// typing + Enter makes new <p>
await b.type('Hello world'); await enter(); await b.type('Second');
ok((await html()).includes('<p>Hello world</p><p>Second</p>'), 'typing and Enter give paragraphs', await html());
ok(await b.ev('DocEditor.dirty'), 'typing marks the doc unsaved');
// markdown shortcuts
await enter(); await b.type('## '); await b.type('Head two');
ok((await html()).includes('<h2>Head two</h2>'), '"## " becomes heading 2', await html());
await enter(); await b.type('- '); await b.type('one'); await enter(); await b.type('two');
ok((await html()).includes('<ul><li>one</li><li>two</li></ul>'), '"- " starts a bullet list', await html());
await enter(); await enter(); // empty li + Enter exits the list
await b.type('1. '); await b.type('first');
ok((await html()).includes('<ol><li>first</li></ol>'), '"1. " starts a numbered list', await html());
await enter(); await enter(); await b.type('[] '); await b.type('todo');
ok((await html()).includes('<ul class="check"><li>todo</li></ul>'), '"[] " starts a checklist', await html());
// checklist toggle by clicking the box
const [x, y] = await at('ul.check li'); const r = await b.ev(`(() => { const r = document.querySelector('ul.check li').getBoundingClientRect(); return [r.left + 8, r.top + 12]; })()`);
await b.click(r[0], r[1]);
ok((await html()).includes('data-done="1"'), 'clicking the box ticks the item', await html());
await b.click(r[0], r[1]);
ok(!(await html()).includes('data-done'), 'clicking again unticks it');
// undo / redo
const before = await html();
await enter(); await enter(); await b.type('Undo me'); await b.sleep(700);
ok((await html()).includes('Undo me'), 'typed text present');
await b.key('z', { ctrl: true });
ok(!(await html()).includes('Undo me'), 'Ctrl+Z removes the typing', await html());
await b.key('z', { ctrl: true, shift: true });
ok((await html()).includes('Undo me'), 'Ctrl+Shift+Z brings it back');
await b.key('z', { ctrl: true }); await b.key('z', { ctrl: true });
// slash menu
await reset(); await b.type('/');
ok(await b.ev(`!document.querySelector('#ed-pop').hidden && document.querySelectorAll('#ed-pop .mi').length > 10`), 'typing / opens the block menu');
await b.type('head');
ok(await b.ev(`[...document.querySelectorAll('#ed-pop .mi')].map(x => x.textContent).join()`) === 'Heading 1,Heading 2,Heading 3', 'menu filters as you type');
await b.key('ArrowDown', { code: 'ArrowDown', vk: 40 }); await enter();
ok((await html()).includes('<h2><br></h2>') || (await html()).includes('<h2></h2>'), '/ menu + arrow + Enter makes heading 2', await html());
await reset(); await b.type('/table'); await enter();
ok((await html()).includes('<table>') && await b.ev(`DocEditor.active.querySelectorAll('td,th').length`) === 9, '/table inserts a 3x3 table');
await reset(); await b.type('/divider'); await enter();
ok((await html()).includes('<hr>'), '/divider inserts a rule');
await reset(); await b.type('/'); await b.key('Escape', { code: 'Escape', vk: 27 });
ok(await b.ev(`document.querySelector('#ed-pop').hidden`), 'Esc closes the menu');
// floating toolbar + bold + style
await reset(); await b.type('Bold this please');
await selectText(1, 0, 4); await b.sleep(150);
ok(await b.ev(`!document.querySelector('#ed-tb').hidden`), 'floating toolbar shows on selection');
await clickOn('#ed-tb [data-t=bold]');
ok((await html()).includes('<b>Bold</b> this please'), 'toolbar Bold wraps the selection', await html());
await selectText(1, 0, 4);
await clickOn('#ed-tb [data-t=style]'); await clickOn('#ed-pop .mi:nth-child(3)');
ok((await html()).includes('<h2>'), 'style dropdown sets Heading 2', await html());
// alt+arrow moves block
await b.ev(`DocEditor.active.innerHTML = '<p>A</p><p>B</p>'`); await caretEnd(1); await b.key('ArrowUp', { code: 'ArrowUp', vk: 38, alt: true });
ok((await html()) === '<p>B</p><p>A</p>', 'Alt+Up moves the block up', await html());
// paste sanitises
await b.ev(`(() => { DocEditor.active.innerHTML = '<p><br></p>'; DocEditor.active.focus(); const dt = new DataTransfer(); dt.setData('text/html', '<div style="color:red"><b>bold</b><span class="x"> plain</span><script>alert(1)</script></div>'); dt.setData('text/plain', 'bold plain'); DocEditor.active.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); })()`);
const ph = await html();
ok(ph.includes('<b>bold</b>') && !ph.includes('style=') && !ph.includes('class="x"') && !ph.includes('<script'), 'paste keeps bold, drops styles and scripts', ph);
await done();
