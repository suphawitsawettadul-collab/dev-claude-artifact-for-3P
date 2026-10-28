import { start, ok } from './t-lib.mjs';
import * as L from './t-lib.mjs';
const rect = sel => L.b.ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
const near = (a, b, t = 1.5) => Math.abs(a - b) <= t;
await start('http://localhost:' + process.env.PORT + '/deck.html#3');
const b = L.b;
const h2 = '.slide.active h2', p = '.slide.active p', cards = '.slide.active .cards';
await b.ev(`document.querySelectorAll('.slide.active .card').forEach((c, k) => c.dataset.t = 'c' + (k + 1))`);
const h0 = await rect(h2), p0 = await rect(p), fs0 = await b.ev(`getComputedStyle(document.querySelector('${h2}')).fontSize`);
let [x, y] = await L.at(h2);
await b.click(x, y); // select
await b.drag(x, y, x + 120, y + 80);
const h1 = await rect(h2), p1 = await rect(p);
ok(near(h1[0] - h0[0], 120) && near(h1[1] - h0[1], 80), 'h2 moved with pointer', JSON.stringify([h0, h1]));
ok(await b.ev(`document.querySelector('${h2}').parentElement.classList.contains('slide')`), 'h2 now child of slide');
const st = await b.ev(`(e => [e.style.position, e.style.left, e.style.top, e.style.width, e.style.height, e.style.fontSize, e.style.color, e.style.lineHeight].join('|'))(document.querySelector('${h2}'))`);
ok(st.startsWith('absolute|') && st.split('|')[3] !== '' && st.split('|')[4] === '', 'pinned inline: abs,l,t,w, no h', st);
ok(await b.ev(`getComputedStyle(document.querySelector('${h2}')).fontSize`) === fs0, 'font-size unchanged');
ok(p1[1] < p0[1] - 5, 'sibling reflowed up', JSON.stringify([p0, p1]));
// selection overlay follows
const o = await rect('.slide.active .ed-sel'); ok(near(o[0], h1[0]) && near(o[1], h1[1]) && near(o[2], h1[2]), 'outline matches pinned element', JSON.stringify([o, h1]));
// resize se handle on the card (shape) -> height frozen too
[x, y] = await L.at('[data-t=c1]', 100, 45);
await b.click(x, y);
const c0 = await rect('[data-t=c1]');
const hs = await rect('.slide.active .ed-sel i[data-h=se]');
await b.drag(hs[0] + hs[2] / 2, hs[1] + hs[3] / 2, hs[0] + hs[2] / 2 + 40, hs[1] + hs[3] / 2 + 30);
const c1 = await rect('[data-t=c1]');
ok(near(c1[2] - c0[2], 40, 2) && near(c1[3] - c0[3], 30, 2) && near(c1[0], c0[0]), 'se handle resizes card', JSON.stringify([c0, c1]));
ok(await b.ev(`document.querySelector('[data-t=c1]').parentElement.classList.contains('slide')`), 'card pinned to slide');
// nw handle
const hn = await rect('.slide.active .ed-sel i[data-h=nw]');
await b.drag(hn[0] + hn[2] / 2, hn[1] + hn[3] / 2, hn[0] + hn[2] / 2 + 20, hn[1] + hn[3] / 2 + 10);
const c2 = await rect('[data-t=c1]');
ok(near(c2[0] - c1[0], 20, 2) && near(c2[2] - c1[2], -20, 2) && near(c2[1] - c1[1], 10, 2), 'nw handle', JSON.stringify([c1, c2]));
// arrow nudge (1 px local = scale px on screen) moves selected card
await L.esc(); // clears selection? (not editing -> clears sel)
await L.clickOn('[data-t=c1]', {}, 100, 45);
const n0 = await b.ev(`parseFloat(document.querySelector('[data-t=c1]').style.left)`);
await b.key('ArrowRight', { code: 'ArrowRight', vk: 39 }); await b.key('ArrowRight', { shift: true, code: 'ArrowRight', vk: 39 });
const n1 = await b.ev(`parseFloat(document.querySelector('[data-t=c1]').style.left)`);
ok(near(n1 - n0, 11, 0.1), 'nudge 1 + 10 px', n0 + ' ' + n1);
// multi drag: select h2 and a second card together
await L.clickOn('.slide.active h2');
await L.clickOn(p, { modifiers: 8 }, 100, 0);
const m = await L.S(); ok(m.length === 2, 'two selected', JSON.stringify(m));
const a0 = await rect(h2), c20 = await rect(p);
[x, y] = await L.at(p, 100, 0);
await b.drag(x, y, x + 30, y + 20);
const a1 = await rect(h2), c21 = await rect(p);
ok(near(a1[0] - a0[0], 30) && near(a1[1] - a0[1], 20) && near(c21[0] - c20[0], 30) && near(c21[1] - c20[1], 20), 'multi-drag moves both by same delta', JSON.stringify([a0, a1, c20, c21]));
// union handle scales both
const uh = await rect('.slide.active .ed-sel:last-of-type i[data-h=se]');
console.log(b.logs.join('\n'));
await b.close();
console.log('A3 slide done', L.passes, 'pass', L.fails, 'fail');
