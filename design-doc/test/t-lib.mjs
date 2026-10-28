import { launch } from './cdp.mjs';
export let b, fails = 0, passes = 0;
export const ok = (cond, msg, extra = '') => { if (cond) { passes++; if (process.env.T_VERBOSE) console.log('ok  ', msg); } else { fails++; console.log('FAIL', msg, extra); } };
export async function start(url) { b = await launch(url); await b.sleep(1200); return b; }
export const at = async (sel, dx = 0, dy = 0) => b.ev(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [r.left + r.width / 2 + ${dx}, r.top + r.height / 2 + ${dy}]; })()`);
export const clickOn = async (sel, o = {}, dx = 0, dy = 0) => { const [x, y] = await at(sel, dx, dy); await b.click(x, y, o); };
export const enter = () => b.key('Enter', { code: 'Enter', vk: 13, text: '\r' });
export const html = () => b.ev(`DocEditor.active.innerHTML`);
export const text = () => b.ev(`DocEditor.active.innerText`);
// put the caret at the end of the nth block (0-based) of the open tab
export const caretEnd = n => b.ev(`(() => { const e = DocEditor.active.children[${n}]; e.focus?.(); DocEditor.active.focus(); const r = document.createRange(); r.selectNodeContents(e); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); })()`);
export const selectText = (n, from, to) => b.ev(`(() => { DocEditor.active.focus(); const t = document.createTreeWalker(DocEditor.active.children[${n}], NodeFilter.SHOW_TEXT).nextNode(); const r = document.createRange(); r.setStart(t, ${from}); r.setEnd(t, ${to}); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new Event('selectionchange')); })()`);
// empty doc used by most tests: one tab with an h1 and an empty paragraph
export const reset = () => b.ev(`(() => { const a = DocEditor.active; a.innerHTML = '<h1>Title</h1><p><br></p>'; a.focus(); const p = a.children[1]; const r = document.createRange(); r.setStart(p, 0); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); })()`);
export const done = async () => { console.log(`${passes} passed, ${fails} failed`); const logs = b.logs.filter(l => l.startsWith('EXC')); logs.forEach(l => { fails++; console.log('FAIL exception', l); }); await b.close(); process.exit(fails ? 1 : 0); };
