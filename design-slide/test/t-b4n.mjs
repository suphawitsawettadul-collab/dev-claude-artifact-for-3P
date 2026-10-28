// B without a design system (deck.html): built-in text styles + palette; top toolbar has no colour menu; light mode.
import { start, ok } from './t-lib.mjs';
import * as L from './t-lib.mjs';
import * as H from './t-bh.mjs';
await start('http://localhost:' + process.env.PORT + '/deck.html#1');
const b = L.b, H1 = '.slide.active h1';
ok(await b.ev(`[...document.querySelectorAll('#ed-tools-l > button, #ed-tools-l > .ed-menu > button')].map(x => x.title).join('|')`) === 'Text box|Image|Table|Shapes', 'top toolbar keeps only T, image, table, shapes');
ok(await b.ev(`document.querySelector('.ed-swatches') === null && document.querySelector('[data-color]') === null`), 'old colour menu is gone');
await L.clickOn(H1);
ok((await b.ev(`document.querySelector('#ed-tb [data-tb=style]').textContent`)).includes('Title'), 'built-in style Title (64/700) recognised');
await H.tbClick('style');
ok(await b.ev(`document.querySelector('#ed-pop .ed-h').textContent`) === 'Default', 'heading without a design system');
const rows = await b.ev(`[...document.querySelectorAll('#ed-pop [data-s]')].map(r => r.querySelector('span').textContent + ' ' + r.querySelector('em').textContent).join('|')`);
ok(rows === 'Title 64|Heading 44|Subheading 32|Body 28|Caption 20', 'built-in styles with sizes', rows);
await H.pClick('[data-s=Caption]');
ok(await H.style(H1, 'fontSize') === '20px' && await H.style(H1, 'fontWeight') === '400' && await b.ev(`document.querySelector('${H1}').dataset.style`) === 'Caption', 'Caption applied');
await H.tbClick('tcolor');
ok(await b.ev(`document.querySelector('#ed-pop .ed-h').textContent`) === 'Built-in' && await b.ev(`document.querySelectorAll('#ed-pop [data-c]').length`) >= 9, 'built-in colour palette', await b.ev(`document.querySelectorAll('#ed-pop [data-c]').length`));
await H.pClick('[data-c="#c0392b"]');
ok(await H.comp(H1, 'color') === 'rgb(192, 57, 43)', 'Red applies');
// save keeps the edits and none of the toolbar chrome
await b.key('s', { ctrl: true }); await b.sleep(600);
const saved = (await import('node:fs')).readFileSync((await import('node:path')).join(process.env.DECK_DIR, 'deck.html'), 'utf8');
ok(saved.includes('data-style="Caption"') && saved.includes('font-size: 20px') && !saved.includes('ed-tb') && !saved.includes('ed-pop') && !saved.includes('contenteditable'), 'saved deck has the style edits and no toolbar / popover markup');
// light mode uses the same tokens
const dark = await b.ev(`getComputedStyle(document.getElementById('ed-tb')).backgroundColor`);
await b.ev(`document.querySelector('[data-cmd=theme]').click()`);
const light = await b.ev(`getComputedStyle(document.getElementById('ed-tb')).backgroundColor`);
ok(dark !== light && light === 'rgb(255, 255, 255)', 'toolbar follows the light theme tokens', dark + ' / ' + light);
console.log(b.logs.join('\n')); console.log('B no-DS done', L.passes, 'pass', L.fails, 'fail');
await b.close();
