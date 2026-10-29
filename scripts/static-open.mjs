// Opening a deck / doc without a local server (corporate machines often block node from listening on a port).
// The editor files are copied into <root>/_ds/ and the html is pointed at them, so the page works from file://.
// Saving then goes through the browser's save dialog and exports are downloaded (see post() in design-slide/editor.js
// and putFile() in design-doc/editor.js).
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { pathToFileURL } from 'node:url';

export const RUNTIME = /^(editor\.(js|css)|ds-[\w-]+\.js|lib-[\w.-]+\.js|tu-bg-[\w-]+\.(png|jpe?g))$/;
const IMAGE_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };

// Can this machine listen on a localhost port at all?
export const canListen = () => new Promise(res => {
  const s = net.createServer();
  s.once('error', () => res(false));
  s.listen(0, '127.0.0.1', () => s.close(() => res(true)));
});

// Copies the runtime into <root>/_ds and points <root>/<htmlName> at it. withAssets also writes _ds/assets.js (images as data URIs,
// because a browser will not let a page read the pixels of file:// images, which PDF / PNG / PPTX export needs).
export function prepareStatic({ root, toolDir, htmlName, withAssets }) {
  const ds = path.join(root, '_ds');
  fs.mkdirSync(ds, { recursive: true });
  const copied = fs.readdirSync(toolDir).filter(f => RUNTIME.test(f));
  for (const f of copied) fs.copyFileSync(path.join(toolDir, f), path.join(ds, f));

  const file = path.join(root, htmlName);
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  html = html.replace(/\b(href|src)="((?:editor\.(?:css|js)|ds-[\w-]+\.js|tu-bg-[\w-]+\.(?:png|jpe?g)))"/g, '$1="_ds/$2"');
  if (withAssets) {
    const map = {};
    const add = key => {
      if (map[key] || /^([a-z]+:|#|\/\/)/i.test(key)) return;
      const ext = path.extname(key).slice(1).toLowerCase();
      const abs = path.join(root, key);
      if (IMAGE_TYPES[ext] && fs.existsSync(abs) && fs.statSync(abs).isFile() && fs.statSync(abs).size < 8e6)
        map[key] = `data:${IMAGE_TYPES[ext]};base64,${fs.readFileSync(abs).toString('base64')}`;
    };
    for (const f of copied) if (/\.(png|jpe?g)$/.test(f)) add('_ds/' + f);
    for (const m of html.matchAll(/\bsrc="([^"]+)"/g)) add(m[1]);
    fs.writeFileSync(path.join(ds, 'assets.js'), `window.DECK_ASSETS = ${JSON.stringify(map)};\n`);
    if (!html.includes('_ds/assets.js')) html = html.replace(/<script src="_ds\/editor\.js"><\/script>/, '<script src="_ds/assets.js"></script>\n$&');
  }
  if (html !== before) fs.writeFileSync(file, html);
  return pathToFileURL(file).href;
}
