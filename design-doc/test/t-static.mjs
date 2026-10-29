// No local server (node blocked from listening, or --static): the doc opens from file://, saves through the browser's save dialog
// (File System Access API).
import { start, ok, done, reset } from './t-lib.mjs';
import * as L from './t-lib.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const tool = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-static-'));
fs.writeFileSync(path.join(root, 'doc.md'), '# Plan\n\nHello\n');
const r = spawnSync(process.execPath, [path.join(tool, 'open-doc.mjs'), root, '--ds', 'tu', '--static'], { encoding: 'utf8' });
const url = /OPEN: (file:\/\/\S+)/.exec(r.stdout)?.[1];
ok(!!url && !fs.existsSync(path.join(root, '.design-doc.json')), '--static prints a file:// address and starts no server', r.stdout + r.stderr);
ok(['editor.js', 'editor.css', 'ds-tu.js'].every(f => fs.existsSync(path.join(root, '_ds', f))), 'the editor runtime is copied next to the doc');
const html = fs.readFileSync(path.join(root, 'doc.html'), 'utf8');
ok(html.includes('href="_ds/editor.css"') && html.includes('<script src="_ds/editor.js">'), 'doc.html points at _ds/');
await start(url);
const b = L.b;
await b.ev(`window.__w = []; window.showSaveFilePicker = async () => ({ createWritable: async () => ({ write: async d => { window.__w.push(await d.text()); }, close: async () => {} }) }); 0`);
await b.ev(`DocEditor.activate('t1')`); await reset(); await b.type('Offline text');
await b.key('s', { ctrl: true }); await b.sleep(600);
const saved = await b.ev('window.__w.join("")');
ok(saved.includes('Offline text') && !saved.includes('data-chrome') && saved.includes('_ds/editor.js'), 'Ctrl+S writes the doc through the save dialog', saved.slice(0, 100));
ok((await b.ev(`document.querySelector('#ed-status').textContent`)).startsWith('Saved') && !await b.ev('DocEditor.dirty'), 'status says saved, dirty flag cleared');
await done();
