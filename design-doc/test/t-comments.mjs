import { start, ok, html, done, clickOn, enter, reset, selectText } from './t-lib.mjs';
import * as L from './t-lib.mjs';
await start('http://localhost:' + process.env.PORT + '/doc.html');
const b = L.b;
await b.ev(`DocEditor.activate('t1')`); await reset(); await b.type('Is Sep 29 firm?');
await selectText(1, 3, 9); await b.sleep(120);
await clickOn('#ed-tb [data-t=comment]'); await b.sleep(120);
ok(await b.ev(`!!document.querySelector('#ed-newc textarea')`), 'comment button opens the composer in the side panel');
ok(await b.ev(`document.querySelector('#ed-newc .q').textContent`) === 'Sep 29', 'composer quotes the selection');
await b.ev(`document.querySelector('#ed-newc textarea').value = 'Please confirm with ops'`); await clickOn('[data-c=new]'); await b.sleep(120);
ok((await html()).includes('<span class="cm" data-cid="'), 'selected words are highlighted');
ok(await b.ev(`document.querySelectorAll('.thread').length`) === 1 && await b.ev(`document.querySelector('.thread .cmsg p').textContent`) === 'Please confirm with ops', 'thread listed with its text');
ok(await b.ev(`document.querySelector('#ed-ccount').textContent`) === '1', 'header counts open threads');
// reply, @Claude
await b.ev(`document.querySelector('.thread .acts input').value = '@Claude can you check?'`); await clickOn('[data-c=reply]'); await b.sleep(100);
ok(await b.ev(`document.querySelectorAll('.thread .cmsg').length`) === 2, 'reply added');
ok(await b.ev(`document.querySelector('.thread .badge')?.textContent`) === 'Waiting for Claude', '@Claude reply is flagged as waiting');
ok(await b.ev(`DocEditor.data.comments[0].to`) === 'claude', 'thread stored with to: claude');
// resolve / reopen
await clickOn('[data-c=resolve]'); await b.sleep(100);
ok(await b.ev(`document.querySelector('.thread.resolved') !== null && document.querySelector('.cm').classList.contains('done')`), 'resolve greys the highlight');
ok(await b.ev(`document.querySelector('#ed-ccount').textContent`) === '', 'resolved threads leave the count');
await clickOn('[data-c=resolve]'); await b.sleep(100);
ok(await b.ev(`!document.querySelector('.cm').classList.contains('done')`), 'reopen restores highlight');
// click highlight focuses thread; typing inside keeps it
await clickOn('.cm'); ok(await b.ev(`!!document.querySelector('.thread.flash')`), 'clicking the highlight flashes its thread');
// undo removes the highlight? (comment is part of the doc state): delete thread unwraps text
await clickOn('[data-c=del]'); await b.sleep(100);
ok(!(await html()).includes('class="cm"') && (await html()).includes('Is Sep 29 firm?'), 'deleting a thread unwraps the text, text intact', await html());
ok(await b.ev(`DocEditor.data.comments.length`) === 0, 'thread removed from data');
// two tabs: threads are per tab
await selectText(1, 0, 2); await b.sleep(100); await b.ev(`document.querySelector('#ed-tb [data-t=comment]').click()`); await b.ev(`document.querySelector('#ed-newc textarea').value = 'x'`); await clickOn('[data-c=new]');
await b.ev(`DocEditor.activate('t2')`); await b.sleep(100);
ok(await b.ev(`document.querySelectorAll('.thread').length`) === 0, 'other tab shows none of them');
await done();
