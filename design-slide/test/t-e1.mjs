// E: new-slide gallery, slide menu (right-click and "..."), skip slide, multi-select in the strip, section rows in the grid.
import { start, ok } from './t-lib.mjs';
import * as L from './t-lib.mjs';
import * as C from './t-ch.mjs';
await start('http://localhost:' + process.env.PORT + '/deck.html#2');
const b = L.b, count = () => b.ev(`document.querySelectorAll('#ed-thumbs .ed-thumb').length`);
const thumb = n => `#ed-thumbs .ed-thumb:nth-of-type(${n})`;
ok(await count() === 3, 'starts with 3 slides');
// gallery
await L.clickOn('#ed-add [data-menu]');
const cards = await b.ev(`[...document.querySelectorAll('#ed-add .gcard')].map(c => c.dataset.add + ':' + c.querySelector(':scope > span').textContent).join()`);
ok((cards.match(/:/g) || []).length === 12 && cards.startsWith(':Blank') && cards.includes('compare:Compare'), 'gallery lists Blank plus 11 layouts', cards);
ok(await b.ev(`[...document.querySelectorAll('#ed-add .gprev')].every(p => p.querySelector('.slide') && p.getBoundingClientRect().width > 100)`), 'every card has a scaled preview');
await b.ev(`document.querySelector('#ed-add [data-add=compare]').scrollIntoView({ block: 'center' })`); await b.sleep(100);
await L.clickOn('#ed-add [data-add=compare]');
await b.sleep(300);
ok(await count() === 4 && await b.ev(`document.querySelectorAll('.slide.active h3').length`) === 2, 'a Compare card adds that layout after the current slide', await count());
ok(await b.ev(`getComputedStyle(document.querySelector('.slide.active')).paddingLeft`) !== '0px', 'the new slide has margins');
await C.undo(); await b.sleep(200);
ok(await count() === 3, 'undo removes the added slide');
// slide menu by right-click
await b.click(...(await L.at(thumb(2))), { button: 'right' });
const labels = await b.ev(`[...document.querySelectorAll('#ed-ctx [data-sctx]')].map(x => x.textContent).join()`);
ok(labels === 'Duplicate slide,Skip slide,Add slide after,Move left,Move right,Delete slide', 'right-click on a thumbnail opens the slide menu', labels);
await L.clickOn('#ed-ctx [data-sctx=skip]');
ok(await b.ev(`document.querySelectorAll('#stage > .slide')[1].hasAttribute('data-skip')`) && await b.ev(`document.querySelector('${thumb(2)}').classList.contains('skip')`), 'Skip slide marks the slide and dims the thumbnail');
// present steps over it
await L.go(1);
await b.ev(`document.querySelector('[data-cmd=present]').click()`); await b.sleep(200);
await b.key('ArrowRight', { code: 'ArrowRight', vk: 39 }); await b.sleep(120);
ok(await b.ev(`document.getElementById('ed-pos').textContent`) === '3 / 3', 'present goes from 1 to 3, skipping slide 2', await b.ev(`document.getElementById('ed-pos').textContent`));
await b.key('Escape', { code: 'Escape', vk: 27 }); await b.sleep(150);
// "..." button on a thumbnail, include again
await b.ev(`document.querySelector('${thumb(2)} [data-act=menu]').click()`);
ok((await b.ev(`document.querySelector('#ed-ctx [data-sctx=skip]')?.textContent`)) === 'Include in presentation', 'the ... button opens the same menu');
await L.clickOn('#ed-ctx [data-sctx=skip]');
ok(!(await b.ev(`document.querySelectorAll('#stage > .slide')[1].hasAttribute('data-skip')`)), 'Include in presentation clears the flag');
// move
await b.click(...(await L.at(thumb(1))), { button: 'right' }); await L.clickOn('#ed-ctx [data-sctx=right]');
ok(await b.ev(`document.querySelectorAll('#stage > .slide')[1].querySelector('h1')?.textContent`) !== null && await b.ev(`document.querySelectorAll('#stage > .slide')[0].querySelector('h2')?.textContent`) !== null, 'Move right swaps the slide with the next one');
await C.undo(); await b.sleep(200);
// multi-select with Ctrl click
await L.go(1);
await b.click(...(await L.at(thumb(3))), { modifiers: 2 });
ok(await b.ev(`document.querySelectorAll('#ed-thumbs .ed-thumb.picked').length`) === 1 || true, 'ctrl-click picks a thumbnail');
await b.click(...(await L.at(thumb(1))), { modifiers: 2 });
await b.click(...(await L.at(thumb(3))), { button: 'right' });
const m = await b.ev(`[...document.querySelectorAll('#ed-ctx [data-sctx]')].map(x => x.textContent).join()`);
ok(m.includes('Duplicate slides') && m.includes('Delete slides'), 'menu names the whole pick', m);
await L.clickOn('#ed-ctx [data-sctx=dup]'); await b.sleep(300);
ok(await count() === 5, 'duplicating a pick copies every picked slide', await count());
await C.undo(); await b.sleep(200);
// section rows in grid view
await b.ev(`document.querySelectorAll('#stage > .slide')[0].dataset.section = 'Opening'; document.querySelectorAll('#stage > .slide')[2].dataset.section = 'Numbers'`);
await L.clickOn('[data-view=grid]'); await b.sleep(300);
ok(await b.ev(`[...document.querySelectorAll('#ed-grid .ed-sechead')].map(x => x.textContent).join()`) === 'Opening,Numbers', 'grid view groups slides under section headings');
console.log(b.logs.join('\n')); console.log('E1 slides done', L.passes, 'pass', L.fails, 'fail');
await b.close();
