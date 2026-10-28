import { launch } from './cdp.mjs';
export let b, fails = 0, passes = 0;
export const ok = (cond, msg, extra = '') => { if (cond) { passes++; if (process.env.T_VERBOSE) console.log('ok  ', msg); } else { fails++; console.log('FAIL', msg, extra); } };
export async function start(url) { b = await launch(url); await b.sleep(1500); return b; }
// centre of an element in viewport px
export const at = async (sel, dx = 0, dy = 0) => b.ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [r.left + r.width / 2 + ${dx}, r.top + r.height / 2 + ${dy}]; })()`);
export const clickOn = async (sel, o = {}, dx = 0, dy = 0) => { const [x, y] = await at(sel, dx, dy); await b.click(x, y, o); };
export const S = () => b.ev(`JSON.stringify(DeckEditor.selection.map(s => s.kind + ':' + (s.el.className || s.el.nodeName) ))`).then(JSON.parse);
export const goto = async n => { await b.ev(`document.querySelector('[data-cmd=next]') && 0`); await b.ev(`(() => { location.hash = '#${n}'; })()`); await b.ev('location.reload()'); await b.sleep(1500); };
export const cur = sel => `document.querySelector('.slide.active ${sel}')`;
export const go = async n => { await b.ev(`document.querySelectorAll('#ed-thumbs .ed-thumb')[${n - 1}].click()`); await b.sleep(150); };
export const esc = async () => b.key('Escape', { code: 'Escape', vk: 27 });
export const sc = async () => b.ev(`(() => { const r = document.querySelector('.slide.active').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
