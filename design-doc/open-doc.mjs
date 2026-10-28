// Opens a doc in Design Doc: builds doc.html from Markdown (if given), starts the local server and prints the address.
// Usage: node open-doc.mjs <docRoot> [--md file.md] [--title "Name"] [--byline "Name"] [--ds tu] [--port 4191] [--rebuild] [--no-serve] [--stop]
//   <docRoot>   folder that holds (or will hold) doc.html
//   --md        Markdown source (default <docRoot>/doc.md when doc.html does not exist yet); see md2doc.mjs for tabs, charts, diagrams
//   --ds tu     load the Thai Union design system (default for Thai Union work)
//   --rebuild   rebuild doc.html from the Markdown, overwriting edits made in the editor (without it an existing doc.html is kept)
//   --stop      stop the server this script started for <docRoot>
// Prints "OPEN: http://localhost:<port>/doc.html" when the editor is ready.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { docHtml } from './md2doc.mjs';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = n => args.includes('--' + n);
const opt = n => { const k = args.indexOf('--' + n); return k >= 0 ? args[k + 1] : undefined; };
const valued = ['--md', '--title', '--byline', '--ds', '--port'];
const root = path.resolve(args.find((a, k) => !a.startsWith('--') && !(k && valued.includes(args[k - 1]))) || '.');
const pidFile = path.join(root, '.design-doc.json');
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const ping = port => new Promise(r => { const q = http.get({ host: '127.0.0.1', port, path: '/stamp?file=doc.html', timeout: 800 }, res => { res.resume(); r(res.statusCode); }); q.on('error', () => r(0)); q.on('timeout', () => { q.destroy(); r(0); }); });

if (flag('stop')) {
  const info = fs.existsSync(pidFile) ? JSON.parse(fs.readFileSync(pidFile, 'utf8')) : null;
  if (info && alive(info.pid)) { process.kill(info.pid); console.log('stopped server on port ' + info.port); } else console.log('no server running for this doc');
  fs.rmSync(pidFile, { force: true }); process.exit(0);
}
fs.mkdirSync(root, { recursive: true });
const docFile = path.join(root, 'doc.html');
const mdFile = opt('md') ? path.resolve(opt('md')) : path.join(root, 'doc.md');
if (fs.existsSync(mdFile) && (!fs.existsSync(docFile) || flag('rebuild'))) {
  const md = fs.readFileSync(mdFile, 'utf8');
  const title = opt('title') || (/^#\s+(.*)$/m.exec(md)?.[1]) || path.basename(root);
  fs.writeFileSync(docFile, docHtml({ title, byline: opt('byline') || '', date: new Date().toISOString().slice(0, 10), md, ds: opt('ds') }));
  console.log('built ' + docFile);
} else if (!fs.existsSync(docFile)) { console.error(`no doc.html or Markdown under ${root} (give --md file.md)`); process.exit(1); }
if (flag('no-serve')) process.exit(0);

let info = fs.existsSync(pidFile) ? JSON.parse(fs.readFileSync(pidFile, 'utf8')) : null;
if (info && alive(info.pid) && await ping(info.port) === 200) { console.log(`OPEN: http://localhost:${info.port}/doc.html  (server already running)`); process.exit(0); }
let port = Number(opt('port') || 4191);
while (await ping(port) === 200) port++; // something else is on this port
const child = spawn(process.execPath, [path.join(toolDir, 'serve.mjs'), root], { env: { ...process.env, PORT: String(port) }, detached: true, stdio: 'ignore' });
child.unref();
fs.writeFileSync(pidFile, JSON.stringify({ pid: child.pid, port }));
for (let k = 0; k < 40 && await ping(port) !== 200; k++) await new Promise(r => setTimeout(r, 150));
console.log(`OPEN: http://localhost:${port}/doc.html`);
