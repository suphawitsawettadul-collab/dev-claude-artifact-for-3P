import { start, ok, html, done, reset } from './t-lib.mjs';
import * as L from './t-lib.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
await start('http://localhost:' + process.env.PORT + '/doc.html');
const b = L.b;
await b.ev(`DocEditor.activate('t1')`);
const md = await b.ev(`DocEditor.toMarkdown()`);
ok(md.startsWith('# ภาพรวมโครงการ\n\nDesign Doc คือ'), 'markdown starts with the heading', md.slice(0, 60));
ok(md.includes('**Claude Docs**') && md.includes('## สิ่งที่ทำได้') && md.includes('- เมนู `/` และ Markdown shortcut'), 'markdown: bold, h2, list, inline code');
ok(md.includes('| งาน | ผู้รับผิดชอบ | สถานะ |\n| --- | --- | --- |\n| สเปก | Suphawit | เสร็จ |'), 'markdown: table', md);
ok(md.includes('**ชั่วโมงทำงานต่อสัปดาห์**') && md.includes('| สัปดาห์ 2 | 18 |'), 'markdown: chart as a table');
ok(md.includes('> (pending: สรุปความเสี่ยง'), 'markdown: pending block');
await b.ev(`DocEditor.activate('t2')`);
ok((await b.ev(`DocEditor.toMarkdown()`)).includes('1. คู่มือ Claude Docs') && (await b.ev(`DocEditor.toMarkdown()`)).includes('เขียนสเปก → สร้าง editor → ทดสอบ → ส่งมอบ'), 'markdown: numbered list and diagram');
await b.ev(`DocEditor.activate('t1')`);
const h = await b.ev(`DocEditor.exportHtml()`);
ok(h.includes('<svg') && h.includes('<table>') && !h.includes('contenteditable'), 'html export has drawn chart, table, no editing attributes');
// docx: build in the page, check it is a valid package with python's zipfile + xml parser
const b64 = await b.ev(`DocEditor.toDocx().then(bl => bl.arrayBuffer()).then(buf => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192)); return btoa(s); })`);
const file = path.join(os.tmpdir(), 'dd-export-' + process.pid + '.docx'); fs.writeFileSync(file, Buffer.from(b64, 'base64'));
const py = `
import zipfile, sys, xml.dom.minidom as m
z = zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None
names = z.namelist(); print(names)
for n in names:
    if n.endswith('.xml') or n.endswith('.rels'): m.parseString(z.read(n))
d = z.read('word/document.xml').decode()
for need in ['Heading1', 'ภาพรวมโครงการ', '<w:tbl>', '<w:b/>', 'ชั่วโมงทำงานต่อสัปดาห์' if False else 'w:drawing', 'Consolas']:
    print(need, need in d)
print('media', [n for n in names if n.startswith('word/media/')])
`;
const r = spawnSync('python3', ['-I', '-c', py, file], { encoding: 'utf8' });
ok(r.status === 0, 'docx is a valid zip and every XML part parses', r.stderr);
ok(/Heading1 True/.test(r.stdout) && /ภาพรวมโครงการ True/.test(r.stdout) && /<w:tbl> True/.test(r.stdout) && /<w:b\/> True/.test(r.stdout), 'docx has heading, thai text, table and bold', r.stdout);
ok(/media \['word\/media\/image1\.png'\]/.test(r.stdout) && /w:drawing True/.test(r.stdout), 'docx embeds the chart as a picture', r.stdout);
fs.rmSync(file, { force: true });
// export menu writes files through the server
await b.ev(`document.querySelector('[data-cmd=export]').click()`); await b.sleep(80);
await b.ev(`[...document.querySelectorAll('#ed-pop .mi')].find(x => x.textContent.startsWith('Markdown')).click()`); await b.sleep(500);
const out = fs.readdirSync(process.env.DOC_DIR).filter(f => f.endsWith('.md') && f.includes('ภาพรวม'));
ok(out.length === 1, 'Export > Markdown writes the open tab next to the doc', fs.readdirSync(process.env.DOC_DIR).join());
await b.ev(`document.querySelector('[data-cmd=export]').click()`); await b.sleep(80);
await b.ev(`[...document.querySelectorAll('#ed-pop .mi')].find(x => x.textContent.startsWith('Word')).click()`); await b.sleep(900);
ok(fs.readdirSync(process.env.DOC_DIR).some(f => f.endsWith('.docx')), 'Export > Word writes a .docx');
await done();
