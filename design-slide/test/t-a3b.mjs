import { start, ok } from './t-lib.mjs';
import * as L from './t-lib.mjs';
const rect = sel => L.b.ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
const near = (a, b, t = 1.5) => Math.abs(a - b) <= t;
await start('http://localhost:' + process.env.PORT + '/tu-test.html#1');
const b = L.b;
const cs = e => b.ev(`(e => { const c = getComputedStyle(e); return [c.fontSize, c.textAlign, c.color, c.fontWeight, c.fontFamily].join('|'); })(document.querySelector('${e}'))`);
const before = await cs('.slide.active h1'), r0 = await rect('.slide.active h1');
await L.clickOn('.slide.active h1');
const [x, y] = await L.at('.slide.active h1');
await b.drag(x, y, x - 60, y + 40);
const after = await cs('.slide.active h1'), r1 = await rect('.slide.active h1');
ok(before === after, 'h1 text styles survive leaving .tu-cover-title', before + ' vs ' + after);
ok(near(r1[0] - r0[0], -60) && near(r1[1] - r0[1], 40) && near(r1[2], r0[2], 2), 'h1 moved, same width', JSON.stringify([r0, r1]));
ok(await b.ev(`document.querySelector('.slide.active h1').parentElement.classList.contains('slide')`), 'h1 child of slide');
// date: class-absolute with right anchor (no width) -> move must not stretch
await L.clickOn('.slide.active .tu-cover-date');
const d0 = await rect('.slide.active .tu-cover-date');
const [dx, dy] = await L.at('.slide.active .tu-cover-date');
await b.drag(dx, dy, dx - 100, dy - 30);
const d1 = await rect('.slide.active .tu-cover-date');
ok(near(d1[0] - d0[0], -100) && near(d1[2], d0[2], 2), 'right-anchored date moves without stretching', JSON.stringify([d0, d1]));
// multi: select h1 + date, resize with union se handle -> both scale
await L.clickOn('.slide.active h1');
await L.clickOn('.slide.active .tu-cover-date', { modifiers: 8 });
const A0 = await rect('.slide.active h1'), B0 = await rect('.slide.active .tu-cover-date');
const hs = await b.ev(`(() => { const hs = [...document.querySelectorAll('.slide.active .ed-sel i[data-h=se]')]; const r = hs[0].getBoundingClientRect(); return [hs.length, r.left + r.width / 2, r.top + r.height / 2]; })()`);
ok(hs[0] === 1, 'one union handle set', JSON.stringify(hs));
await b.drag(hs[1], hs[2], hs[1] + 60, hs[2] + 40);
const A1 = await rect('.slide.active h1'), B1 = await rect('.slide.active .tu-cover-date');
ok(A1[2] > A0[2] + 5 && B1[2] > B0[2], 'union resize scales members', JSON.stringify([A0, A1, B0, B1]));
// Esc clears selection when not editing
await L.esc();
ok((await L.S()).length === 0, 'Esc clears');
console.log(b.logs.join('\n'));
console.log('A3b done', L.passes, 'pass', L.fails, 'fail');
await b.close();
