// Headless Edge driver over the DevTools protocol, for scratch UI checks (real mouse / key events).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const BROWSERS = [process.env.BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/google-chrome'];
const EDGE = BROWSERS.find(b => b && fs.existsSync(b));
const extra = process.platform === 'win32' ? [] : ['--no-sandbox'];
export async function launch(url, port = 9300 + Math.floor(Math.random() * 90), size = '1600,950') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-'));
  const p = spawn(EDGE, ['--headless=new', '--disable-gpu', ...extra, '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, `--window-size=${size}`, url], { stdio: 'ignore' });
  let tabs;
  for (let k = 0; k < 50; k++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.some(t => t.type === 'page' && /^(https?|file):/.test(t.url))) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
  const tab = tabs.find(t => t.type === 'page' && /^(https?|file):/.test(t.url));
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let id = 0; const wait = new Map(); const logs = [];
  ws.addEventListener('message', m => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); } else if (d.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true }); else if (d.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text)); else if (d.method === 'Runtime.consoleAPICalled') logs.push(d.params.type + ' ' + d.params.args.map(a => a.value ?? a.description).join(' ')); });
  const send = (method, params = {}) => new Promise(r => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const api = {
    logs, sleep, send,
    async ev(expr) { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails)); return r.result.result.value; },
    async mouse(type, x, y, o = {}) { await send('Input.dispatchMouseEvent', { type, x, y, button: o.button || 'none', buttons: o.buttons ?? 0, clickCount: o.clickCount || 0, modifiers: o.modifiers || 0 }); },
    async click(x, y, o = {}) { const b = o.button || 'left', bs = b === 'right' ? 2 : 1; await api.mouse('mouseMoved', x, y); await api.mouse('mousePressed', x, y, { button: b, buttons: bs, clickCount: o.clickCount || 1, modifiers: o.modifiers }); await api.mouse('mouseReleased', x, y, { button: b, clickCount: o.clickCount || 1, modifiers: o.modifiers }); await sleep(60); },
    async drag(x, y, x2, y2, o = {}) { await api.mouse('mouseMoved', x, y); await api.mouse('mousePressed', x, y, { button: 'left', buttons: 1, clickCount: 1, modifiers: o.modifiers }); for (let k = 1; k <= 6; k++) await api.mouse('mouseMoved', x + (x2 - x) * k / 6, y + (y2 - y) * k / 6, { buttons: 1 }); await api.mouse('mouseReleased', x2, y2, { button: 'left', clickCount: 1 }); await sleep(60); },
    async key(key, o = {}) { // o: ctrl, shift, alt; text for printable
      const modifiers = (o.alt ? 1 : 0) | (o.ctrl ? 2 : 0) | (o.shift ? 8 : 0);
      const code = o.code || (key.length === 1 ? (/[a-z]/i.test(key) ? 'Key' + key.toUpperCase() : '') : key);
      const vk = o.vk || (key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0);
      const base = { key, code, modifiers, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk };
      await send('Input.dispatchKeyEvent', { type: o.text ? 'keyDown' : 'rawKeyDown', ...base, ...(o.text ? { text: o.text } : {}) });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base }); await sleep(40);
    },
    async type(text) { for (const ch of text) { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch }); } await sleep(40); },
    async close() { try { ws.close(); } catch {} try { if (process.platform === 'win32') spawn('taskkill', ['/PID', String(p.pid), '/T', '/F'], { stdio: 'ignore' }); else p.kill('SIGKILL'); } catch {} await sleep(300); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} },
  };
  return api;
}
