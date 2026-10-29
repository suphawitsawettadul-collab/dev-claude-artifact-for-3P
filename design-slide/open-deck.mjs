// Opens a deck written in the Claude Slides file format (project/deck.json + project/slides/<id>.html) in Design Slide.
// Usage: node open-deck.mjs <deckRoot> [--ds tu] [--port 4190] [--rebuild] [--no-serve] [--stop]
//   <deckRoot>   folder that holds project/deck.json and project/slides/*.html (the same files Claude Slides takes)
//   --ds tu      load the Thai Union design system (ds-tu.js) so its colours, text styles and layouts show in the editor
//   --rebuild    rebuild deck.html from the slide files, overwriting edits made in the editor (without it an existing
//                deck.html is kept, because the editor saves into it)
//   --no-serve   only build deck.html
//   --static     no local server: copy the editor into <deckRoot>/_ds and open deck.html straight from disk (file://). This is also
//                the automatic fallback when the machine blocks listening on a port. Saving then uses the browser's save dialog.
//   --stop       stop the server this script started for <deckRoot>
// Prints "OPEN: http://localhost:<port>/deck.html" (or "OPEN: file:///.../deck.html" without a server) when the editor is ready.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { canListen, prepareStatic } from '../scripts/static-open.mjs';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = n => args.includes('--' + n);
const opt = n => { const k = args.indexOf('--' + n); return k >= 0 ? args[k + 1] : undefined; };
const root = path.resolve(args.find((a, k) => !a.startsWith('--') && !(k && ['--ds', '--port'].includes(args[k - 1]))) || '.');
const pidFile = path.join(root, '.design-slide.json');
const warn = [];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const getStyle = tag => (tag.match(/\sstyle="([^"]*)"/) || [, ''])[1];
const withStyle = (tag, style) => /\sstyle="/.test(tag) ? tag.replace(/\sstyle="[^"]*"/, ` style="${style}"`) : tag.replace(/>$/, ` style="${style}">`);
const dropProps = (style, names) => style.split(';').filter(d => d.trim() && !names.includes(d.split(':')[0].trim().toLowerCase())).join(';');
const propOf = (style, name) => { const d = style.split(';').find(x => x.split(':')[0].trim().toLowerCase() === name); return d ? d.slice(d.indexOf(':') + 1).trim() : ''; };

const ICONS = (() => { const w = {}; try { vm.runInNewContext(fs.readFileSync(path.join(toolDir, 'icons.js'), 'utf8'), { window: w }); } catch {} return w.DECK_ICONS || {}; })();
const CLIP = {
  diamond: 'polygon(50% 0,100% 50%,50% 100%,0 50%)',
  'arrow-right': 'polygon(0 25%,60% 25%,60% 0,100% 50%,60% 100%,60% 75%,0 75%)',
  'arrow-left': 'polygon(100% 25%,40% 25%,40% 0,0 50%,40% 100%,40% 75%,100% 75%)',
  'arrow-up': 'polygon(25% 100%,25% 40%,0 40%,50% 0,100% 40%,75% 40%,75% 100%)',
  'arrow-down': 'polygon(25% 0,25% 60%,0 60%,50% 100%,100% 60%,75% 60%,75% 0)',
};

// Claude Slides elements the editor does not know become plain divs / spans it can select and move.
function convertElements(html, id) {
  html = html.replace(/<x-shape\b([^>]*)>(?:\s*<\/x-shape>)?/g, (m, attrs) => {
    const kind = (attrs.match(/kind="([^"]*)"/) || [, 'rect'])[1];
    let style = getStyle(`<x ${attrs}>`);
    if (!/position\s*:/.test(style)) style = 'position:absolute;' + style;
    if (kind === 'rounded' && !/border-radius/.test(style)) style += ';border-radius:16px';
    if (kind === 'ellipse') style += ';border-radius:50%';
    if (CLIP[kind]) style += `;clip-path:${CLIP[kind]}`;
    if (kind === 'line') {
      const col = propOf(style, 'color') || propOf(style, 'background') || propOf(style, 'background-color') || '#888888';
      style = dropProps(style, ['background', 'background-color', 'height']) + `;height:4px;background:${col}`;
    }
    return `<div data-shape="${esc(kind)}" style="${style.replace(/^;/, '')}"></div>`;
  });
  html = html.replace(/<x-icon\b([^>]*?)\/?>(?:\s*<\/x-icon>)?/g, (m, attrs) => {
    const name = (attrs.match(/name="([^"]*)"/) || [, 'icon'])[1];
    let style = getStyle(`<x ${attrs}>`);
    if (!ICONS[name]) { warn.push(`${id}: <x-icon name="${name}"> is not in the icon set, shown as a dot`); return `<span data-icon="${esc(name)}" style="display:inline-block;width:1em;height:1em;border-radius:50%;background:currentColor;vertical-align:middle"></span>`; }
    if (!/width\s*:/.test(style)) style += ';width:96px;height:96px';
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-icon="${esc(name)}" aria-label="${esc(name)}" style="${style.replace(/^;/, '')}">${ICONS[name]}</svg>`;
  });
  html = html.replace(/<x-(connector|embed)\b[\s\S]*?(<\/x-\1>|\/>|>)/g, (m, t) => { warn.push(`${id}: <x-${t}> is not supported and was left out`); return ''; });
  return html;
}

function convertSection(raw, id, section) {
  const open = raw.match(/<section\b[^>]*>/);
  const end = raw.lastIndexOf('</section>');
  if (!open || end < 0) throw new Error(`slides/${id}.html has no <section>`);
  let inner = raw.slice(open.index + open[0].length, end);
  let tag = open[0];
  // the editor shows / hides slides with display, so the section's own layout is kept without it (a slide is a flex column)
  const style = getStyle(tag), disp = propOf(style, 'display');
  let kept = dropProps(style, ['display']);
  let notes = '';
  inner = inner.replace(/<aside\b[^>]*>([\s\S]*?)<\/aside>/, (m, t) => { notes = t.trim(); return ''; });
  inner = convertElements(inner, id);
  if (disp.includes('grid')) { // a grid slide: its flow children sit in one grid wrapper, pinned ones stay on the slide
    const grid = ['grid-template-columns', 'grid-template-rows', 'gap', 'row-gap', 'column-gap', 'align-items', 'justify-content', 'align-content', 'place-items']
      .filter(p => propOf(style, p)).map(p => `${p}:${propOf(style, p)}`).join(';');
    kept = dropProps(kept, ['grid-template-columns', 'grid-template-rows', 'gap', 'row-gap', 'column-gap', 'align-items', 'justify-content', 'align-content', 'place-items']);
    inner = `<div style="display:grid;flex:1;${grid}">${inner}</div>`;
  }
  const cls = 'slide';
  const attrs = [`class="${cls}"`, `id="${esc(id)}"`, ...(section !== undefined ? [`data-section="${esc(section)}"`] : []), ...[...tag.matchAll(/\s(data-[a-z-]+)="([^"]*)"/g)].map(m => `${m[1]}="${esc(m[2])}"`), `style="${kept}"`];
  if (!/position\s*:/.test(kept)) { /* editor.css sets position:relative on .slide */ }
  return `<section ${attrs.join(' ')}>${inner.trim()}${notes ? `<aside class="notes" hidden>${notes}</aside>` : ''}</section>`;
}

function readDeck() {
  const proj = path.join(root, 'project'), idx = path.join(proj, 'deck.json');
  if (!fs.existsSync(idx)) throw new Error(`no project/deck.json under ${root}`);
  const deck = JSON.parse(fs.readFileSync(idx, 'utf8'));
  const dir = path.join(proj, 'slides');
  const files = new Set(fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.html')).map(f => f.slice(0, -5)) : []);
  const order = [...(deck.order || []).filter(i => files.has(i)), ...[...files].filter(i => !(deck.order || []).includes(i))];
  if (!order.length) throw new Error('the deck has no slides');
  return { deck, order, dir };
}

function build() {
  const { deck, order, dir } = readDeck();
  const ds = opt('ds');
  const faces = Object.values(deck.faces || {}).filter(f => f.href).map(f => `<link rel="stylesheet" href="${esc(f.href)}">`).join('\n');
  const starts = Object.fromEntries(Object.values(deck.sections || {}).filter(x => x.start).map(x => [x.start, x.description || '']));
  const slides = order.map(id => convertSection(fs.readFileSync(path.join(dir, id + '.html'), 'utf8'), id, starts[id]));
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(deck.title || 'Untitled deck')}</title>
<link rel="stylesheet" href="_ds/editor.css">
${faces}
${ds ? `<script src="_ds/ds-${esc(ds)}.js"></script>` : '<style>.slide { width: 1920px; height: 1080px; }</style>'}
<style>.slide h1, .slide h2, .slide h3, .slide p, .slide ul, .slide ol { margin: 0; } .slide ul, .slide ol { padding-left: 1.2em; }</style>
</head>
<body>
<div id="stage">
${slides.join('\n')}
</div>
<script src="_ds/editor.js"></script>
</body></html>
`;
  fs.writeFileSync(path.join(root, 'deck.html'), html);
  return order.length;
}

const ping = port => new Promise(res => { const r = http.get({ host: '127.0.0.1', port, path: '/deck.html', timeout: 800 }, x => { x.resume(); res(x.statusCode); }); r.on('error', () => res(0)); r.on('timeout', () => { r.destroy(); res(0); }); });
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };

if (flag('stop')) {
  const info = fs.existsSync(pidFile) ? JSON.parse(fs.readFileSync(pidFile, 'utf8')) : null;
  if (info && alive(info.pid)) { process.kill(info.pid); console.log('stopped server on port ' + info.port); } else console.log('no server running for this deck');
  fs.rmSync(pidFile, { force: true });
  process.exit(0);
}

const deckFile = path.join(root, 'deck.html');
if (flag('rebuild') || !fs.existsSync(deckFile)) { const n = build(); console.log(`built deck.html with ${n} slides`); warn.forEach(w => console.log('NOTE: ' + w)); }
else console.log('kept the existing deck.html (edits made in the editor are saved there); use --rebuild to rebuild it from project/slides');
if (flag('no-serve')) process.exit(0);

const openStatic = why => {
  if (why) console.log('NOTE: ' + why);
  console.log('OPEN: ' + prepareStatic({ root, toolDir, htmlName: 'deck.html', withAssets: true }) + '  (no server: Save opens the browser save dialog, exports are downloaded)');
  process.exit(0);
};
if (flag('static') || process.env.DESIGN_TOOLS_STATIC) openStatic();
if (!await canListen()) openStatic('this machine does not allow listening on a local port, so the deck opens straight from disk');

let info = fs.existsSync(pidFile) ? JSON.parse(fs.readFileSync(pidFile, 'utf8')) : null;
if (info && alive(info.pid) && await ping(info.port) === 200) { console.log(`OPEN: http://localhost:${info.port}/deck.html  (server already running)`); process.exit(0); }
let port = Number(opt('port') || 4190);
while (await ping(port)) port++; // something already answers there: take the next port
const child = spawn(process.execPath, [path.join(toolDir, 'serve.mjs'), root], { env: { ...process.env, PORT: String(port) }, detached: true, stdio: 'ignore' });
child.unref();
fs.writeFileSync(pidFile, JSON.stringify({ pid: child.pid, port }));
for (let k = 0; k < 30 && await ping(port) !== 200; k++) await new Promise(r => setTimeout(r, 150));
if (await ping(port) !== 200) openStatic('the local server did not start (blocked by policy or a firewall?), so the deck opens straight from disk');
console.log(`OPEN: http://localhost:${port}/deck.html`);
