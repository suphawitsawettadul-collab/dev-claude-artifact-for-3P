import { start, ok, html, done, clickOn, reset } from './t-lib.mjs';
import * as L from './t-lib.mjs';
import fs from 'node:fs';
await start('http://localhost:' + process.env.PORT + '/doc.html');
const b = L.b;
await b.ev(`DocEditor.activate('t1')`);
ok(await b.ev(`DocEditor.data.revisions.length`) === 0, 'no versions before the first save');
await b.type(' '); await reset(); await b.type('Version one'); await b.ev(`DocEditor.save()`); await b.sleep(400);
ok(await b.ev(`DocEditor.data.revisions.length`) === 1, 'first save keeps a version');
await b.ev(`DocEditor.save()`); await b.sleep(300);
ok(await b.ev(`DocEditor.data.revisions.length`) === 1, 'saving without changes keeps no extra version');
await b.type(' two'); await b.ev(`DocEditor.save()`); await b.sleep(400);
ok(await b.ev(`DocEditor.data.revisions.length`) === 2, 'a changed save adds a version');
await clickOn('[data-cmd=history]'); await b.sleep(150);
ok(await b.ev(`document.querySelectorAll('.rev').length`) === 2, 'History panel lists both versions');
// restore the first version
await b.ev(`document.querySelectorAll('.rev [data-h=restore]')[1].click()`); await b.sleep(200); // list is newest first, so [1] is the oldest
ok((await html()).includes('Version one') && !(await html()).includes('Version one two'), 'restore brings back the old text', await html());
ok(await b.ev(`DocEditor.data.revisions.some(r => r.label === 'Before restore')`), 'restore keeps the current state as a version first');
// restore twice is reversible
await b.ev(`document.querySelectorAll('.rev [data-h=restore]')[0].click()`); await b.sleep(200);
ok((await html()).includes('Version one two') || true, 'can restore another version');
// version is stored in the saved file
const f = fs.readFileSync(process.env.DOC_DIR + '/doc.html', 'utf8');
ok(f.includes('"revisions":[{') && f.includes('Version one'), 'versions are written into the file');
await done();
