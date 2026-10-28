// Shared helpers for the toolbar suites (t-b1 .. t-b4).
import * as L from './t-lib.mjs';
export const ev = e => L.b.ev(e);
export const J = s => JSON.stringify(s);
export const tb = () => ev(`(() => { const t = document.getElementById('ed-tb'), r = t.getBoundingClientRect(); return { on: t.style.display === 'flex', l: r.left, t: r.top, w: r.width, h: r.height, ids: [...t.querySelectorAll('[data-tb]')].map(b => b.dataset.tb), titles: [...t.querySelectorAll('button')].every(b => b.title) }; })()`);
export const rect = sel => ev(`(() => { const r = document.querySelector(${J(sel)}).getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; })()`);
export const tbClick = id => L.clickOn(`#ed-tb [data-tb=${id}]`);
export const popOpen = () => ev(`getComputedStyle(document.getElementById('ed-pop')).display !== 'none'`);
// click something inside the popover (scrolls it into view of the popover's own scroll area first)
export const pClick = async (sel, dx = 0, dy = 0) => { await ev(`document.querySelector(${J('#ed-pop ' + sel)}).scrollIntoView({ block: 'center' })`); await L.b.sleep(40); await L.clickOn('#ed-pop ' + sel, {}, dx, dy); };
export const undo = () => L.b.key('z', { ctrl: true });
export const redo = () => L.b.key('z', { ctrl: true, shift: true });
export const style = (sel, prop) => ev(`document.querySelector(${J(sel)}).style[${J(prop)}]`);
export const comp = (sel, prop) => ev(`getComputedStyle(document.querySelector(${J(sel)}))[${J(prop)}]`);
export const html = sel => ev(`document.querySelector(${J(sel)}).innerHTML`);
// select characters [from, to) of the element's text (offsets count across child nodes; the element must be in edit mode)
export const selectText = (sel, from, to) => ev(`(() => { const el = document.querySelector(${J(sel)}); const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const r = document.createRange(); let pos = 0, n, a = 0, z = 0; while ((n = w.nextNode())) { const len = n.textContent.length; if (!a && ${from} < pos + len) { r.setStart(n, ${from} - pos); a = 1; } if (a && ${to} <= pos + len) { r.setEnd(n, ${to} - pos); z = 1; break; } pos += len; } const s = getSelection(); s.removeAllRanges(); s.addRange(r); return r.toString(); })()`);
// select the element, then click it again so it enters edit mode (real mouse)
export const edit = async (sel, dx = 0) => { await L.clickOn(sel, {}, dx); await L.clickOn(sel, {}, dx); };
export const esc = L.esc;
