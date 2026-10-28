// Self-check for the pure helpers in editor.js (cut out between the pure markers). Run: node selfcheck-pure.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
const tool = path.resolve(here, '..');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ', name); };
const js = fs.readFileSync(path.join(tool, 'editor.js'), 'utf8');
const src = js.slice(js.indexOf('// <pure>'), js.indexOf('// </pure>'));
const { makeHistory, px, union, dragBox, scaleIn, hsv2rgb, rgb2hsv, toHex, parseHex, parseCss, rgbCss, gradFirst, isUrl, matchStyle } = new Function(src + '; return { makeHistory, px, union, dragBox, scaleIn, hsv2rgb, rgb2hsv, toHex, parseHex, parseCss, rgbCss, gradFirst, isUrl, matchStyle };')();
const S = html => ({ html, i: 0 });
t('history: push / back / fwd', () => {
  const h = makeHistory(100);
  h.push(S('a')); h.push(S('b'));            // a and b were current before two actions; now c
  let s = h.back(S('c')); assert.equal(s.html, 'b');
  s = h.back(S('b')); assert.equal(s.html, 'a');
  assert.equal(h.back(S('a')), null);        // nothing older
  s = h.fwd(S('a')); assert.equal(s.html, 'b');
  s = h.fwd(S('b')); assert.equal(s.html, 'c');
  assert.equal(h.fwd(S('c')), null);
});
t('history: a new action clears redo', () => {
  const h = makeHistory(100); h.push(S('a')); h.back(S('b')); assert.equal(h.redo.length, 1);
  h.push(S('x')); assert.equal(h.redo.length, 0);
});
t('history: cap 100 drops the oldest', () => {
  const h = makeHistory(100);
  for (let k = 0; k < 150; k++) h.push(S('s' + k));
  assert.equal(h.undo.length, 100); assert.equal(h.undo[0].html, 's50'); assert.equal(h.undo.at(-1).html, 's149');
});
t('history: no-op steps (edit started, nothing typed) are skipped', () => {
  const h = makeHistory(100); h.push(S('a')); h.push(S('b')); h.push(S('b')); // last push = edit start on unchanged b
  const s = h.back(S('b')); assert.equal(s.html, 'a');
  assert.equal(h.redo.at(-1).html, 'b');
});
t('px rounds to 2 decimals', () => { assert.equal(px(10.456), '10.46px'); assert.equal(px(3), '3px'); });
t('union of boxes', () => assert.deepEqual(union([{ l: 10, t: 20, w: 30, h: 40 }, { l: 50, t: 10, w: 10, h: 10 }]), { l: 10, t: 10, w: 50, h: 50 }));
t('dragBox move / se / nw / ne / clamp', () => {
  const u = { l: 100, t: 100, w: 200, h: 100 };
  assert.deepEqual(dragBox(u, 'move', 5, -7), { l: 105, t: 93, w: 200, h: 100 });
  assert.deepEqual(dragBox(u, 'se', 40, 30), { l: 100, t: 100, w: 240, h: 130 });
  assert.deepEqual(dragBox(u, 'nw', 20, 10), { l: 120, t: 110, w: 180, h: 90 });
  const c = dragBox(u, 'nw', 500, 500); // box never flips; the far edge stays put
  assert.equal(c.w, 8); assert.equal(c.h, 4); assert.equal(c.l, 292); assert.equal(c.t, 196);
  assert.deepEqual(dragBox(u, 'ne', 10, -10), { l: 100, t: 90, w: 210, h: 110 });
});
t('scaleIn keeps members in proportion', () => {
  const u = { l: 0, t: 0, w: 100, h: 100 }, g = { l: 50, t: 20, w: 50, h: 40 };
  assert.deepEqual(scaleIn(g, u, u), g);
  assert.deepEqual(scaleIn(g, u, { l: 10, t: 10, w: 200, h: 50 }), { l: 110, t: 20, w: 100, h: 20 });
});
t('colour maths: hsv <-> rgb round trip, hex parse', () => {
  assert.deepEqual(hsv2rgb(0, 1, 1), [255, 0, 0]); assert.deepEqual(hsv2rgb(120, 1, 1), [0, 255, 0]); assert.deepEqual(hsv2rgb(240, 1, 0.5), [0, 0, 128]);
  assert.deepEqual(rgb2hsv(0, 38, 84).map((x, k) => k ? Math.round(x * 100) / 100 : Math.round(x)), [213, 1, 0.33]);
  for (const c of [[0, 38, 84], [74, 171, 224], [247, 145, 47], [255, 255, 255], [0, 0, 0], [33, 64, 154]]) assert.deepEqual(hsv2rgb(...rgb2hsv(...c)), c);
  assert.equal(toHex(0, 38, 84), '#002654'); assert.deepEqual(parseHex('#0F2'), [0, 255, 34]); assert.deepEqual(parseHex('002654'), [0, 38, 84]);
  assert.equal(parseHex('#12'), null); assert.equal(parseHex('zzzzzz'), null);
});
t('css colour: computed rgb / rgba, opacity output', () => {
  assert.deepEqual(parseCss('rgb(0, 38, 84)'), [0, 38, 84, 1]); assert.deepEqual(parseCss('rgba(1, 2, 3, 0.5)'), [1, 2, 3, 0.5]);
  assert.equal(parseCss('transparent'), null);
  assert.equal(rgbCss(0, 38, 84, 1), '#002654'); assert.equal(rgbCss(0, 38, 84, 0.5), 'rgba(0, 38, 84, 0.5)');
});
t('gradient first stop', () => {
  assert.equal(gradFirst('linear-gradient(135deg, rgb(0, 38, 84), rgb(255, 255, 255))'), 'rgb(0, 38, 84)');
  assert.equal(gradFirst('none'), ''); assert.equal(gradFirst(''), '');
});
t('link check accepts https / http / mailto only', () => {
  for (const u of ['https://a.com/x?y=1', 'http://a.com', 'mailto:a@b.co']) assert.ok(isUrl(u), u);
  for (const u of ['javascript:alert(1)', 'ftp://a.com', 'a.com', 'https://', 'https://a b', '']) assert.ok(!isUrl(u), u);
});
t('matchStyle: data-style first, else size + weight', () => {
  const st = [{ name: 'title', size: 56, weight: 700 }, { name: 'body', size: 28, weight: 400 }, { name: 'page', size: 24, weight: 400 }];
  assert.equal(matchStyle(st, 'page', 56, 700).name, 'page'); assert.equal(matchStyle(st, undefined, 28, '400').name, 'body');
  assert.equal(matchStyle(st, 'nope', 56, 700).name, 'title'); assert.equal(matchStyle(st, undefined, 28, 700), null);
  const two = [{ name: 'cover-subtitle', size: 36, weight: 400, color: '#21409A' }, { name: 'subtitle', size: 36, weight: 400, color: '#4AABE0' }];
  assert.equal(matchStyle(two, undefined, 36, 400, '#4aabe0').name, 'subtitle'); assert.equal(matchStyle(two, undefined, 36, 400, '#000000').name, 'cover-subtitle');
});
console.log(`\npure helpers: ${n} checks passed`);
