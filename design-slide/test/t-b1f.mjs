// B1 text toolbar actions: B / I / U (range and whole element), link, bullet list, align, more.
import { start, ok } from './t-lib.mjs';
import * as L from './t-lib.mjs';
import * as H from './t-bh.mjs';
await start('http://localhost:' + process.env.PORT + '/tu-test.html#4');
const b = L.b, SUB = '.slide.active .tu-sub';
await b.ev(`document.querySelector('${SUB}').textContent = 'Hello brave new world'`); // plain ASCII: a Thai combining mark would widen a link range
const on = id => b.ev(`document.querySelector('#ed-tb [data-tb=${id}]').classList.contains('on')`);
// whole element
await L.clickOn(SUB);
ok(!(await on('bold')), 'bold off for a 400 weight');
await H.tbClick('bold');
ok(await H.style(SUB, 'fontWeight') === '700' && await on('bold'), 'B on the whole element writes font-weight 700 + shows active');
await H.tbClick('bold');
ok(await H.style(SUB, 'fontWeight') === '400' && !(await on('bold')), 'B again writes 400');
await H.tbClick('italic'); ok(await H.style(SUB, 'fontStyle') === 'italic' && await on('italic'), 'I writes font-style italic');
await H.tbClick('underline'); ok((await H.style(SUB, 'textDecoration')).includes('underline') && await on('underline'), 'U writes text-decoration underline');
await H.undo(); ok(!(await H.style(SUB, 'textDecoration')).includes('underline'), 'Ctrl+Z undoes U'); await H.undo(); await H.undo(); await H.undo();
// range while editing
await H.edit(SUB);
ok(await b.ev(`document.querySelectorAll('[contenteditable]').length`) === 1, 'editing');
const word = await H.selectText(SUB, 0, 4);
await H.tbClick('bold');
ok(await b.ev(`!!document.querySelector('${SUB} b') && document.querySelector('${SUB} b').textContent`) === word && await H.style(SUB, 'fontWeight') === '', 'B on a range wraps it in <b> only', await H.html(SUB));
ok(await b.ev(`document.querySelectorAll('[contenteditable]').length`) === 1 && await on('bold'), 'still editing; B shows active on the range');
await H.tbClick('italic'); await H.tbClick('underline');
ok(await b.ev(`!!document.querySelector('${SUB} i') && !!document.querySelector('${SUB} u')`), 'I and U wrap the range', await H.html(SUB));
await H.tbClick('bold');
ok(await b.ev(`!document.querySelector('${SUB} b') || document.querySelector('${SUB} b').textContent === ''`), 'B again unwraps the range');
await H.esc(); await H.undo(); await H.undo(); await H.undo(); await H.undo();
ok(!(await H.html(SUB)).includes('<'), 'undo steps back through the range edits', await H.html(SUB));
// link on a range
await L.clickOn(SUB); await H.edit(SUB);
const w2 = await H.selectText(SUB, 0, 5);
await H.tbClick('link');
ok(await H.popOpen() && await b.ev(`!!document.querySelector('#ed-pop .ed-url')`), 'link popover with a URL input');
await L.clickOn('#ed-pop .ed-url'); await b.type('javascript:alert(1)'); await H.pClick('[data-lk=apply]');
ok(!(await H.html(SUB)).includes('<a') && (await b.ev(`document.querySelector('#ed-pop .ed-err').textContent`)).includes('https://'), 'a non-http(s)/mailto link is refused with a message');
await b.ev(`document.querySelector('#ed-pop .ed-url').value = ''`); await L.clickOn('#ed-pop .ed-url'); await b.type('https://example.com');
await H.pClick('[data-lk=apply]');
ok(await b.ev(`(a => !!a && a.getAttribute('href') + '|' + a.textContent)(document.querySelector('${SUB} a'))`) === 'https://example.com|' + w2, 'https link wraps the range', await H.html(SUB));
ok(await b.ev(`document.querySelectorAll('[contenteditable]').length`) === 1, 'still editing after the popover input took focus');
await H.esc(); await L.clickOn(SUB);
ok(await on('link'), 'link button active on an element with a link');
await H.tbClick('link'); await H.pClick('[data-lk=remove]');
ok(!(await H.html(SUB)).includes('<a'), 'Remove unwraps the link');
await H.undo(); await H.undo();
// link on the whole text
await L.clickOn(SUB); await H.tbClick('link'); await L.clickOn('#ed-pop .ed-url'); await b.type('mailto:a@b.co'); await b.key('Enter', { code: 'Enter', vk: 13 });
ok(await b.ev(`document.querySelector('${SUB} a')?.getAttribute('href')`) === 'mailto:a@b.co', 'no range: wraps the whole text (Enter applies)', await H.html(SUB));
await H.undo(); await L.clickOn(SUB);
// bullet list
const tag = () => b.ev(`document.querySelector('.slide.active .tu-sub, .slide.active ul.tu-sub, .slide.active p.tu-sub')?.nodeName`);
await b.ev(`DeckEditor.change(() => { document.querySelector('${SUB}').innerHTML = 'one<br>two<br>three'; document.querySelector('${SUB}').style.fontSize = '30px'; })`);
await H.tbClick('list');
ok(await b.ev(`(e => e.nodeName + e.children.length + e.style.fontSize + e.className)(document.querySelector('.slide.active .tu-sub'))`) === 'UL330pxtu-sub', 'list: each line becomes an <li>, inline styles kept');
ok((await L.S())[0].startsWith('text:') && await on('list'), 'new list stays selected, button active');
await H.tbClick('list');
ok(await b.ev(`document.querySelector('.slide.active .tu-sub').nodeName`) === 'DIV' && (await H.html(SUB)) === 'one<br>two<br>three' && await H.style(SUB, 'fontSize') === '30px', 'second press back to a paragraph (original tag)', await H.html(SUB));
await H.undo(); ok(await b.ev(`document.querySelector('.slide.active .tu-sub').nodeName`) === 'UL', 'Ctrl+Z restores the list');
await H.undo();
// align
await L.clickOn(SUB);
await H.tbClick('align');
ok(await b.ev(`document.querySelectorAll('#ed-pop [data-a]').length`) === 4 && await b.ev(`document.querySelector('#ed-pop [data-a=left]').classList.contains('on')`), 'align popover: 4 buttons, current highlighted');
await H.pClick('[data-a=center]');
ok(await H.style(SUB, 'textAlign') === 'center', 'centre applies');
await H.tbClick('align'); ok(await b.ev(`document.querySelector('#ed-pop [data-a=center]').classList.contains('on')`), 'current one highlighted');
await H.pClick('[data-a=justify]'); ok(await H.style(SUB, 'textAlign') === 'justify', 'justify applies');
await H.undo(); await L.clickOn(SUB); ok(await H.style(SUB, 'textAlign') === 'center', 'undo steps back one align');
// more
await b.ev(`window.__p = 0; DeckEditor.openPanel = () => { window.__p++; }`);
await H.tbClick('more'); ok(await b.ev('window.__p') === 1, 'the dots button calls DeckEditor.openPanel');
console.log(b.logs.join('\n')); console.log('B1 actions done', L.passes, 'pass', L.fails, 'fail');
await b.close();
