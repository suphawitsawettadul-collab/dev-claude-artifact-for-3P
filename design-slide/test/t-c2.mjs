// C2: the panel's sections edit the selection for real (size, padding, text, appearance, effects, advanced), each edit is
// one undo step, and the speaker notes open under the slide and are saved with the deck.
import { start, ok } from './t-lib.mjs';
import * as L from './t-lib.mjs';
import * as C from './t-ch.mjs';
await start('http://localhost:' + process.env.PORT + '/tu-test.html#4');
const b = L.b, TITLE = '.slide.active .tu-title', SUB = '.slide.active .tu-sub';
await C.openPanel();
await L.clickOn(TITLE);
// Size
await C.pnum('w', 900);
ok(Math.abs(await b.ev(`document.querySelector('${TITLE}').offsetWidth`) - 900) < 2 || (await C.style(TITLE, 'width')) === '900px', 'Width field sets the width', await C.style(TITLE, 'width'));
await C.undo();
ok((await C.style(TITLE, 'width')) !== '900px', 'undo removes the width edit', await C.style(TITLE, 'width'));
// Text
await L.clickOn(TITLE);
await C.pnum('fs', 44);
ok(await C.style(TITLE, 'fontSize') === '44px', 'Size field sets font size', await C.style(TITLE, 'fontSize'));
await C.psel('fw', '700');
ok(await C.style(TITLE, 'fontWeight') === '700', 'Weight select sets font weight', await C.style(TITLE, 'fontWeight'));
await C.pseg('ta', 'center');
ok(await C.style(TITLE, 'textAlign') === 'center', 'Align segment sets text-align', await C.style(TITLE, 'textAlign'));
await C.pnum('lh', 1.5);
ok(await C.style(TITLE, 'lineHeight') === '1.5', 'Line height', await C.style(TITLE, 'lineHeight'));
await C.pclick('[data-act=textMore]');
ok(await C.has('[data-pp=tt]'), '+ in Text opens the extra rows (case, line)');
await C.psel('tt', 'uppercase');
ok(await C.style(TITLE, 'textTransform') === 'uppercase', 'Case select sets text-transform');
// Appearance
await C.pnum('op', 0.5);
ok(await C.style(TITLE, 'opacity') === '0.5', 'Opacity', await C.style(TITLE, 'opacity'));
await C.pnum('rad', 12);
ok(await C.style(TITLE, 'borderRadius') === '12px', 'Radius', await C.style(TITLE, 'borderRadius'));
await C.pseg('bs', 'dashed');
ok(await C.style(TITLE, 'borderStyle') === 'dashed' && parseFloat(await C.style(TITLE, 'borderWidth')) > 0, 'Border dashed gets a width', await C.style(TITLE, 'borderWidth'));
ok(await C.has('[data-pp=bw]'), 'border width + colour rows appear once a border is set');
await C.pseg('bs', 'none');
ok(!(await C.has('[data-pp=bw]')), 'and go away for None');
// Layout: padding
await C.pnum('pad', 20);
ok(await C.style(TITLE, 'padding') === '20px', 'Padding', await C.style(TITLE, 'padding'));
// Effects
await C.pclick('[data-act=fxMenu]');
await C.pclick('[data-act=fxadd][data-t=sh]');
ok((await C.style(TITLE, 'boxShadow')).includes('rgb'), '+ Shadow adds a box-shadow', await C.style(TITLE, 'boxShadow'));
await C.pnum('fx-sh-0-blur', 30);
ok((await C.style(TITLE, 'boxShadow')).includes('30px'), 'shadow blur field', await C.style(TITLE, 'boxShadow'));
await C.pclick('[data-act=fxdel]');
ok((await C.style(TITLE, 'boxShadow')) === 'none', 'shadow removed');
// Advanced
await C.pclick('[data-act=adv]');
await C.pnum('rot', 10);
ok((await C.style(TITLE, 'transform')).includes('rotate(10deg)'), 'Rotation', await C.style(TITLE, 'transform'));
// whole sequence undoes step by step
const before = await b.ev(`document.querySelector('${TITLE}').getAttribute('style')`);
await C.undo();
ok((await b.ev(`document.querySelector('${TITLE}').getAttribute('style')`)) !== before, 'undo steps back one edit at a time');
// Multi-select shows Mixed
await b.ev('DeckEditor.select && 0');
await L.clickOn(TITLE); await L.clickOn(SUB, { modifiers: 8 }, 330);
ok((await C.title()) === '2 selected', 'shift-click two: header counts them', await C.title());
await L.esc();
// Notes under the slide
await b.ev(`document.querySelector('#ed-bar [data-cmd=notes], [data-cmd=notes]').click()`);
await b.sleep(150);
ok(await b.ev(`document.body.classList.contains('notes-open')`), 'notes button opens notes');
const st = await C.rect('.slide.active'), nb = await C.rect('#ed-notesbox');
ok(nb.t >= st.b - 2 && nb.w > 300, 'notes box sits under the slide', JSON.stringify([st, nb]));
await L.clickOn('#ed-notes'); await b.type('Hello notes');
ok((await b.ev(`document.querySelector('.slide.active > aside.notes').textContent`)).includes('Hello notes'), 'typing writes aside.notes in the slide');
await b.ev(`document.querySelector('[data-cmd=notes]').click()`);
ok(!(await b.ev(`document.body.classList.contains('notes-open')`)), 'notes button closes notes');
console.log(b.logs.join('\n')); console.log('C2 sections done', L.passes, 'pass', L.fails, 'fail');
await b.close();
