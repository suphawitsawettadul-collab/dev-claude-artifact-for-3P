// No local server (node blocked from listening, or --static): the deck opens from file://, saves through the browser's save
// dialog (File System Access API), exports are downloaded, images still export (data URIs), and Ctrl+P prints every slide on its own page.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { start, ok } from './t-lib.mjs';
import * as L from './t-lib.mjs';
const here = fileURLToPath(new URL('.', import.meta.url)), tool = path.resolve(here, '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-static-'));
fs.cpSync(path.join(tool, 'examples', 'slides-format'), dir, { recursive: true });
const r = spawnSync(process.execPath, [path.join(tool, 'open-deck.mjs'), dir, '--ds', 'tu', '--static'], { encoding: 'utf8' });
const url = /OPEN: (file:\/\/\S+)/.exec(r.stdout)?.[1];
ok(!!url && !fs.existsSync(path.join(dir, '.design-slide.json')), '--static prints a file:// address and starts no server', r.stdout + r.stderr);
ok(['editor.js', 'editor.css', 'ds-tu.js', 'lib-html2canvas.js', 'tu-bg-cover.png', 'assets.js'].every(f => fs.existsSync(path.join(dir, '_ds', f))), 'the editor runtime is copied next to the deck');
const html = fs.readFileSync(path.join(dir, 'deck.html'), 'utf8');
ok(html.includes('href="_ds/editor.css"') && html.includes('<script src="_ds/assets.js"></script>\n<script src="_ds/editor.js">'), 'deck.html points at _ds/ and loads the image data');
const b = await start(url + '#1');
try {
  ok(await b.ev(`typeof DeckEditor === 'object' && document.querySelectorAll('#ed-thumbs .ed-thumb').length`) === 3, 'the editor runs from file:// and shows the 3 slides', String(await b.ev('document.title')));
  // save: the browser's save dialog is stubbed, the written bytes are collected
  await b.ev(`window.__w = []; window.showSaveFilePicker = async o => ({ createWritable: async () => ({ write: async d => { window.__w.push(await d.text()); }, close: async () => {} }) }); 0`);
  await L.clickOn('.slide.active h1'); await L.clickOn('.slide.active h1', {}, 200);
  await b.key('End', { code: 'End', vk: 35 }); await b.type(' Static'); await L.esc();
  await b.key('s', { ctrl: true }); await b.sleep(600);
  const saved = await b.ev('window.__w.join("")');
  ok(saved.includes('Static') && saved.includes('<section class="slide"') && !saved.includes('data-chrome') && saved.includes('_ds/editor.js'), 'Ctrl+S writes the deck through the save dialog', saved.slice(0, 120));
  ok((await b.ev(`document.getElementById('ed-status').textContent`)).startsWith('Saved'), 'status says saved');
  // export PDF with the Thai Union background pictures: must not be blocked as a tainted canvas, and arrives as a download
  await b.ev(`window.__dl = []; HTMLAnchorElement.prototype.click = function () { window.__dl.push([this.download, this.href]); }; 0`);
  await b.ev(`document.querySelector('[data-cmd=pdf]').click()`);
  for (let k = 0; k < 120 && !(await b.ev('window.__dl.length')); k++) await b.sleep(500);
  const [name, href] = (await b.ev('window.__dl[0]')) || [];
  ok(name === 'deck.pdf', 'PDF export is offered as a download', String(await b.ev(`document.getElementById('ed-status').textContent`)));
  const head = href ? await b.ev(`fetch(${JSON.stringify(href)}).then(r => r.blob()).then(async b => [b.size, await b.slice(0, 5).text()])`) : [0, ''];
  ok(head[1] === '%PDF-' && head[0] > 20000, 'the PDF is valid', JSON.stringify(head));
  // print: all slides, own page each, no chrome
  await b.send('Emulation.setEmulatedMedia', { media: 'print' });
  const info = await b.ev(`JSON.stringify({ chrome: [...document.querySelectorAll('[data-chrome]')].filter(e => e.tagName !== 'STYLE' && e.tagName !== 'LINK' && e.tagName !== 'SCRIPT' && getComputedStyle(e).display !== 'none').length,
    slides: [...document.querySelectorAll('#stage > .slide')].map(s => [getComputedStyle(s).display, getComputedStyle(s).zoom, s.getBoundingClientRect().width]), page: [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch { return []; } }).filter(r => r.constructor.name === 'CSSPageRule').length })`).then(JSON.parse);
  ok(info.chrome === 0, 'print hides the editor chrome', JSON.stringify(info));
  ok(info.slides.length === 3 && info.slides.every(s => s[0] === 'flex' && s[1] === '1' && s[2] === 1920), 'print lays out every slide at full size', JSON.stringify(info.slides));
  const pdf = await b.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true });
  const bytes = Buffer.from(pdf.result.data, 'base64').toString('latin1');
  ok((bytes.match(/\/Type\s*\/Page[^s]/g) || []).length === 3, 'print gives one page per slide', String((bytes.match(/\/Type\s*\/Page[^s]/g) || []).length));
  ok(/\/MediaBox\s*\[\s*0\s+0\s+1440(\.\d+)?\s+810(\.\d+)?\s*\]/.test(bytes), 'the page is the slide size (16:9)', (bytes.match(/\/MediaBox[^\]]*\]/) || [''])[0]);
} finally { await b.close(); }
console.log('static open done', L.passes, 'pass', L.fails, 'fail');
process.exit(L.fails ? 1 : 0);
