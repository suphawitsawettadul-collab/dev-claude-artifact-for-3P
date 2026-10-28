// Shared helpers for the properties-panel suites (t-c1 .. t-c9).
import * as L from './t-lib.mjs';
export const P = id => `#pp-body [data-pp="${id}"]`;
export const J = JSON.stringify;
export const pv = id => L.b.ev(`document.querySelector(${J(P(id))}).value`);
export const ptext = id => L.b.ev(`document.querySelector(${J(P(id))}).textContent`);
export const has = sel => L.b.ev(`!!document.querySelector(${J('#pp-body ' + sel)})`);
export const secs = () => L.b.ev(`[...document.querySelectorAll('#pp-body .pp-st > span')].map(s => s.textContent)`);
export const title = () => L.b.ev(`document.getElementById('pp-title').textContent`);
export const openPanel = async () => { if (!(await L.b.ev('DeckEditor.panelOpen'))) await L.clickOn('#ed-pp'); await L.b.sleep(120); };
// real click into a number / text field, then real key presses
export const pnum = async (id, v) => {
  await L.clickOn(P(id));
  await L.b.ev(`document.querySelector(${J(P(id))}).select()`);
  await L.b.type(String(v));
  await L.b.ev('document.activeElement.blur()'); await L.b.sleep(60);
};
// the native drop-down list cannot be driven headless: set the value and fire change, as picking an option does
export const psel = async (id, v) => { await L.b.ev(`(() => { const s = document.querySelector(${J(P(id))}); s.value = ${J(v)}; s.dispatchEvent(new Event('change', { bubbles: true })); })()`); await L.b.sleep(60); };
export const pseg = (id, v) => L.clickOn(`${P(id)} [data-v="${v}"]`);
export const pclick = sel => L.clickOn('#pp-body ' + sel);
export const popOpen = () => L.b.ev(`getComputedStyle(document.getElementById('ed-pop')).display !== 'none'`);
export const popPick = async c => { await L.b.ev(`document.querySelector('#ed-pop [data-c="${c}"]').scrollIntoView({ block: 'center' })`); await L.b.sleep(40); await L.clickOn(`#ed-pop [data-c="${c}"]`); };
export const undo = async () => { await L.b.ev('document.activeElement.blur()'); await L.b.key('z', { ctrl: true }); await L.b.sleep(80); };
export const style = (sel, p) => L.b.ev(`document.querySelector(${J(sel)}).style[${J(p)}]`);
export const comp = (sel, p) => L.b.ev(`getComputedStyle(document.querySelector(${J(sel)}))[${J(p)}]`);
export const rect = sel => L.b.ev(`(() => { const r = document.querySelector(${J(sel)}).getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; })()`);
export const near = (a, b, t = 1.5) => Math.abs(a - b) <= t;
