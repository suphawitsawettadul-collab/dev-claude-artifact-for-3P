// Editor chrome for an HTML doc (Claude Docs style): tab tray, in-place editing, floating text toolbar, "/" menu with Markdown shortcuts,
// tables, lists and checklists, images, charts and flow diagrams, chips (date, mention, tab link), comment threads (with @Claude),
// find and replace, version history, own undo / redo, live reload when the file changes on disk, export to Word / PDF / Markdown / HTML.
// Optional design system: a doc that loads a ds-*.js before this file (window.DOC_DS) gets its css, fonts, colours and chart palette.
// The doc file holds only the content (sections of blocks) and one JSON block with comments and versions; everything this script adds is
// marked data-chrome (or is re-rendered on load) and stripped on save.
(() => {
  const DS = window.DOC_DS || null;
  const COLORS = DS?.colors || { Black: '#1d2433', Grey: '#6b7280', Blue: '#0057a8', Sky: '#4a90e2', Green: '#1e8e5a', Orange: '#f59e0b', Red: '#c0392b' };
  const PALETTE = DS?.chart || ['#0057a8', '#4a90e2', '#f59e0b', '#1e8e5a', '#c0392b', '#6b7280'];
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const uid = () => Math.random().toString(36).slice(2, 10);
  const FILE = decodeURIComponent(location.pathname.split('/').pop() || 'doc.html');
  const DOC = $('#doc');
  if (!DOC) return;
  let DATA = {};
  try { DATA = JSON.parse($('#doc-data')?.textContent || '{}'); } catch {}
  DATA.comments ||= []; DATA.revisions ||= [];
  document.execCommand('defaultParagraphSeparator', false, 'p');

  // ---------- chrome ----------
  const css = el => { el.dataset.chrome = ''; return el; };
  (DS?.fonts || []).forEach(f => document.head.append(css(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: f }))));
  if (DS?.css) document.head.append(css(Object.assign(document.createElement('style'), { textContent: DS.css })));
  try { document.documentElement.dataset.theme = localStorage.getItem('dd-theme') || 'light'; } catch { document.documentElement.dataset.theme = 'light'; }
  DOC.classList.add('doc-body');
  const root = css(document.createElement('div')); root.id = 'ed-root';
  root.innerHTML = `
    <header id="ed-head">
      <button class="ed-ib" data-cmd="tray" title="Tabs" aria-label="Tabs">☰</button>
      <div class="ed-name"><input id="ed-title" aria-label="Document name" spellcheck="false"><button class="ed-ib" data-cmd="namemenu" title="Document menu" aria-label="Document menu">▾</button></div>
      <span class="grow"></span><span id="ed-status"></span>
      <button class="ed-ib" data-cmd="find" title="Find (Ctrl+F)" aria-label="Find">🔍</button>
      <button class="ed-ib" data-cmd="theme" title="Light / dark" aria-label="Theme">🌓</button>
      <button class="ed-btn" data-cmd="comments">Comments <b id="ed-ccount"></b></button>
      <button class="ed-btn" data-cmd="history">History</button>
      <button class="ed-btn" data-cmd="export">Export ▾</button>
      <button id="ed-save" class="ed-btn" data-cmd="save">Save</button>
    </header>
    <nav id="ed-tray" aria-label="Tabs"></nav>
    <div id="ed-find" hidden><input id="ed-fq" placeholder="Find" aria-label="Find"><input id="ed-fr" placeholder="Replace with" aria-label="Replace with"><span id="ed-fn"></span>
      <button class="ed-btn" data-cmd="fnext">Next</button><button class="ed-btn" data-cmd="freplace">Replace</button><button class="ed-btn" data-cmd="freplall">All</button><button class="ed-ib" data-cmd="fclose" aria-label="Close">×</button></div>
    <div id="ed-byline"></div>
    <aside id="ed-side" hidden></aside>
    <div id="ed-tb" hidden></div>
    <div id="ed-pop" hidden></div>
    <input type="file" id="ed-file" accept="image/*" hidden>`;
  document.body.append(root);
  const tb = $('#ed-tb'), pop = $('#ed-pop'), tray = $('#ed-tray'), side = $('#ed-side');
  const sections = () => $$('#doc > section[data-tab]');
  const secById = id => sections().find(s => s.dataset.tab === id);
  let active = null, dirty = false, lastStamp = '0';
  const status = t => { $('#ed-status').textContent = t; };
  const markDirty = () => { if (!dirty) { dirty = true; $('#ed-save').classList.add('dirty'); status('Unsaved changes'); } };

  // ---------- tabs ----------
  const kids = pid => sections().filter(s => (s.dataset.subtabOf || '') === (pid || '')).sort((a, b) => (a.dataset.order || 'z').localeCompare(b.dataset.order || 'z'));
  const order = () => kids('').flatMap(s => [s, ...kids(s.dataset.tab)]);
  const renum = pid => kids(pid).forEach((s, i) => { s.dataset.order = 'a' + String(i).padStart(2, '0'); });
  function renderTray() {
    tray.innerHTML = '';
    for (const s of order()) {
      const sub = !!s.dataset.subtabOf;
      const row = document.createElement('div');
      row.className = 'ed-tab' + (s === active ? ' on' : '') + (sub ? ' sub' : '');
      row.dataset.id = s.dataset.tab;
      row.innerHTML = `<span class="nm"></span><button class="ed-ib" data-menu="${s.dataset.tab}" title="Tab options" aria-label="Tab options">⋯</button>`;
      $('.nm', row).textContent = s.dataset.name || 'Untitled';
      tray.append(row);
    }
    tray.insertAdjacentHTML('beforeend', '<button class="ed-btn" data-cmd="addtab">+ Add tab</button>');
  }
  function activate(id, keepHash) {
    const s = secById(id) || order()[0];
    if (!s) return;
    if (active) { active.removeAttribute('contenteditable'); active.classList.remove('active'); }
    active = s; s.classList.add('active'); s.contentEditable = 'true'; s.spellcheck = false;
    if (!keepHash) history.replaceState(null, '', '#' + s.dataset.tab);
    renderFigures(s); renderTray(); renderByline(); refreshSide();
    hist.reset(); hideTb();
  }
  function renderByline() {
    const first = order()[0] === active, d = DOC.dataset;
    $('#ed-byline').textContent = first && (d.byline || d.date) ? [d.byline, d.date && new Date(d.date + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })].filter(Boolean).join(' · ') : '';
  }
  function addTab(name = 'Untitled tab', sub) {
    const id = 't' + uid();
    const s = document.createElement('section'); s.dataset.tab = id; s.dataset.name = name;
    if (sub) s.dataset.subtabOf = sub;
    s.innerHTML = '<h1>' + esc(name) + '</h1><p><br></p>';
    DOC.append(s); renum(sub || ''); markDirty(); activate(id);
    const p = $('p', s); placeCaret(p, 0);
    return s;
  }
  function tabMenu(id, anchor) {
    const s = secById(id), sib = kids(s.dataset.subtabOf || ''), i = sib.indexOf(s);
    const items = [['rename', 'Rename'], i > 0 && ['up', 'Move up'], i < sib.length - 1 && ['down', 'Move down'],
      !s.dataset.subtabOf && sib.indexOf(s) > 0 && ['nest', 'Make sub-tab of the one above'], s.dataset.subtabOf && ['unnest', 'Move to top level'],
      ['addsub', 'Add sub-tab'], ['copylink', 'Insert link chip to this tab'], sections().length > 1 && ['delete', 'Delete tab']].filter(Boolean);
    menu(anchor, items.map(([k, t]) => [t, () => tabAct(k, s, sib, i)]));
  }
  function tabAct(k, s, sib, i) {
    const pid = s.dataset.subtabOf || '';
    if (k === 'rename') { const n = prompt2('Tab name', s.dataset.name); n.then(v => { if (v) { s.dataset.name = v; renderTray(); markDirty(); } }); return; }
    if (k === 'up' || k === 'down') { const o = sib[i + (k === 'up' ? -1 : 1)]; [s.dataset.order, o.dataset.order] = [o.dataset.order, s.dataset.order]; }
    if (k === 'nest') { s.dataset.subtabOf = sib[i - 1].dataset.tab; renum(pid); renum(s.dataset.subtabOf); }
    if (k === 'unnest') { delete s.dataset.subtabOf; s.dataset.order = 'z' + s.dataset.order; renum(''); renum(pid); }
    if (k === 'addsub') { addTab('Untitled sub-tab', s.dataset.tab); return; }
    if (k === 'copylink') { insertChip('tab', s.dataset.name, s.dataset.tab); return; }
    if (k === 'delete') {
      if (sections().length < 2) return;
      kids(s.dataset.tab).forEach(c => { delete c.dataset.subtabOf; c.dataset.order = 'z' + c.dataset.order; });
      const next = order().find(x => x !== s && x.dataset.subtabOf !== s.dataset.tab) ; s.remove(); renum('');
      DATA.comments = DATA.comments.filter(c => c.tab !== s.dataset.tab);
      activate((next || order()[0]).dataset.tab); markDirty(); return;
    }
    markDirty(); renderTray();
  }

  // ---------- small ui helpers ----------
  function place(box, anchor, below = true) {
    const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : anchor;
    box.hidden = false;
    const w = box.offsetWidth, h = box.offsetHeight;
    box.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left)) + 'px';
    box.style.top = Math.max(8, Math.min(innerHeight - h - 8, below ? r.bottom + 6 : r.top - h - 6)) + 'px';
  }
  function menu(anchor, items, opts = {}) {
    pop.innerHTML = ''; pop.className = 'menu';
    for (const it of items) {
      if (!it) { pop.insertAdjacentHTML('beforeend', '<hr>'); continue; }
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mi'; b.innerHTML = `<span>${esc(it[0])}</span>${it[2] ? `<kbd>${esc(it[2])}</kbd>` : ''}`;
      b.onmousedown = e => e.preventDefault();
      b.onclick = () => { closePop(); it[1](); };
      pop.append(b);
    }
    place(pop, anchor, opts.below !== false);
  }
  const closePop = () => { pop.hidden = true; pop.innerHTML = ''; slashOpen = false; };
  function prompt2(label, value = '') { // small inline input instead of window.prompt (which blocks the browser pane)
    return new Promise(res => {
      const saved = savedSel();
      pop.className = 'form'; pop.innerHTML = `<label>${esc(label)}<input value="${esc(value)}"></label><div><button class="ed-btn" data-ok>OK</button><button class="ed-btn" data-no>Cancel</button></div>`;
      place(pop, saved?.rect || $('#ed-head'));
      const inp = $('input', pop); inp.focus(); inp.select();
      const done = v => { closePop(); restoreSel(saved); res(v); };
      inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); done(inp.value.trim()); } if (e.key === 'Escape') done(null); };
      $('[data-ok]', pop).onclick = () => done(inp.value.trim()); $('[data-no]', pop).onclick = () => done(null);
    });
  }
  function savedSel() {
    const s = getSelection(); if (!s.rangeCount) return null;
    const r = s.getRangeAt(0); return { range: r.cloneRange(), rect: r.getBoundingClientRect() };
  }
  function restoreSel(sv) { if (!sv) return; active?.focus({ preventScroll: true }); const s = getSelection(); s.removeAllRanges(); s.addRange(sv.range); }

  // ---------- caret + blocks ----------
  function placeCaret(node, off = 0, end = false) {
    const r = document.createRange(), s = getSelection();
    if (end) { r.selectNodeContents(node); r.collapse(false); } else { r.setStart(node, off); r.collapse(true); }
    s.removeAllRanges(); s.addRange(r);
  }
  const inActive = n => !!active && !!n && active.contains(n.nodeType === 3 ? n.parentNode : n);
  function blockOf(n) { // direct child of the active section that holds n
    if (!inActive(n)) return null;
    while (n && n.parentNode !== active) n = n.parentNode;
    return n;
  }
  const curBlock = () => { const s = getSelection(); return s.rangeCount ? blockOf(s.anchorNode) : null; };
  const textPos = () => { // caret as [char offset in section] for undo
    const s = getSelection(); if (!s.rangeCount || !inActive(s.anchorNode)) return null;
    const r = document.createRange(); r.selectNodeContents(active); r.setEnd(s.anchorNode, s.anchorOffset); return r.toString().length;
  };
  function setTextPos(n) {
    if (n == null) return;
    const w = document.createTreeWalker(active, NodeFilter.SHOW_TEXT); let t, left = n, last = null;
    while ((t = w.nextNode())) { last = t; if (left <= t.length) { placeCaret(t, left); return; } left -= t.length; }
    if (last) placeCaret(last, last.length, false);
  }

  // ---------- undo / redo (own stack of section snapshots) ----------
  const hist = {
    stack: [], at: -1, timer: 0,
    clean: () => { const c = active.cloneNode(true); $$('[data-chrome]', c).forEach(n => n.remove()); $$('figure.chart,figure.diagram', c).forEach(f => f.innerHTML = ''); return c.innerHTML; },
    reset() { this.stack = [{ html: this.clean(), pos: null }]; this.at = 0; clearTimeout(this.timer); },
    snap() {
      clearTimeout(this.timer); if (!active) return;
      const html = this.clean(); if (html === this.stack[this.at]?.html) return;
      this.stack.length = this.at + 1; this.stack.push({ html, pos: textPos() }); if (this.stack.length > 200) this.stack.shift(); this.at = this.stack.length - 1;
    },
    later() { clearTimeout(this.timer); this.timer = setTimeout(() => this.snap(), 450); },
    go(d) {
      this.snap(); const n = this.at + d; if (n < 0 || n >= this.stack.length) return;
      const from = this.stack[this.at]; this.at = n; const to = this.stack[n];
      active.innerHTML = to.html; renderFigures(active); markDirty(); refreshSide();
      active.focus({ preventScroll: true }); setTextPos(d < 0 ? from.pos : to.pos);
    },
  };

  // ---------- floating toolbar ----------
  const BLOCKS = [['p', 'Normal text'], ['h1', 'Heading 1'], ['h2', 'Heading 2'], ['h3', 'Heading 3'], ['blockquote', 'Quote'], ['pre', 'Code block']];
  const ico = (cmd, label, html) => `<button type="button" data-t="${cmd}" title="${label}" aria-label="${label}">${html}</button>`;
  function buildTb() {
    tb.innerHTML = `<button type="button" data-t="style" class="wide" title="Text style"><span id="ed-style">Normal text</span> ▾</button><i></i>` +
      ico('bold', 'Bold (Ctrl+B)', '<b>B</b>') + ico('italic', 'Italic (Ctrl+I)', '<i>I</i>') + ico('underline', 'Underline (Ctrl+U)', '<u>U</u>') + ico('strike', 'Strikethrough', '<s>S</s>') +
      ico('code', 'Inline code', '&lt;/&gt;') + ico('link', 'Link (Ctrl+K)', '🔗') + ico('color', 'Text colour', '<span class="a">A</span>') + '<i></i>' +
      ico('ul', 'Bulleted list', '•≡') + ico('ol', 'Numbered list', '1≡') + ico('check', 'Checklist', '☑') + ico('left', 'Align left', '⇤') + ico('center', 'Align centre', '↔') + ico('right', 'Align right', '⇥') + '<i></i>' +
      ico('comment', 'Comment', '💬') + ico('clear', 'Clear formatting', '⌫');
  }
  buildTb();
  tb.onmousedown = e => e.preventDefault();
  const blockName = n => (n?.nodeName || 'P').toLowerCase();
  function updateTb() {
    const s = getSelection();
    if (!s.rangeCount || s.isCollapsed || !inActive(s.anchorNode) || !inActive(s.focusNode)) return hideTb();
    const r = s.getRangeAt(0).getBoundingClientRect();
    if (!r.width && !r.height) return hideTb();
    const b = curBlock(); const nm = blockName(b);
    $('#ed-style').textContent = (BLOCKS.find(x => x[0] === nm) || ['', nm === 'ul' || nm === 'ol' ? 'List' : 'Normal text'])[1];
    ['bold', 'italic', 'underline', 'strike'].forEach(c => $(`[data-t=${c}]`, tb).classList.toggle('on', document.queryCommandState(c === 'strike' ? 'strikeThrough' : c)));
    $('[data-t=ul]', tb).classList.toggle('on', nm === 'ul' && !b.classList.contains('check'));
    $('[data-t=ol]', tb).classList.toggle('on', nm === 'ol');
    $('[data-t=check]', tb).classList.toggle('on', nm === 'ul' && b.classList.contains('check'));
    tb.hidden = false; place(tb, r, false);
    if (tb.getBoundingClientRect().top < 60) place(tb, r, true);
  }
  const hideTb = () => { tb.hidden = true; };
  document.addEventListener('selectionchange', () => { if (!pop.matches('.form') || pop.hidden) updateTb(); });
  tb.addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b) return; const c = b.dataset.t;
    if (c === 'style') return menu(b, BLOCKS.map(([t, n]) => [n, () => setBlock(t)]));
    if (c === 'color') return menu(b, [['Default', () => fmt('foreColor', DS ? '#002654' : '#1d2433')], ...Object.entries(COLORS).map(([n, v]) => [n, () => fmt('foreColor', v)])]);
    if (c === 'link') return doLink();
    if (c === 'comment') return startComment();
    if (c === 'code') return toggleCode();
    if (c === 'ul' || c === 'ol' || c === 'check') return setList(c);
    const map = { bold: 'bold', italic: 'italic', underline: 'underline', strike: 'strikeThrough', left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight', clear: 'removeFormat' };
    fmt(map[c]);
  });
  function fmt(cmd, val) { hist.snap(); active.focus({ preventScroll: true }); document.execCommand(cmd, false, val); hist.snap(); markDirty(); updateTb(); }
  function setBlock(t) {
    hist.snap(); active.focus({ preventScroll: true });
    const b = curBlock();
    if (b && /^(UL|OL)$/.test(b.nodeName)) document.execCommand(b.nodeName === 'UL' ? 'insertUnorderedList' : 'insertOrderedList');
    document.execCommand('formatBlock', false, t === 'p' ? 'p' : t);
    hist.snap(); markDirty(); updateTb();
  }
  // List conversion is done by hand: execCommand("insertUnorderedList") nests the list inside an empty <p> in Chromium.
  function setList(kind) {
    hist.snap(); active.focus({ preventScroll: true });
    const b = curBlock(); if (!b) return;
    const want = kind === 'ol' ? 'OL' : 'UL', chk = kind === 'check', pos = textPos(); let nb;
    if (/^(UL|OL)$/.test(b.nodeName)) {
      const same = b.nodeName === want && (b.classList.contains('check') === chk || want === 'OL');
      if (same) { // back to paragraphs
        const ps = [...b.children].map(li => { const p = document.createElement('p'); p.innerHTML = li.innerHTML.replace(/<(ul|ol)[\s\S]*$/i, '') || '<br>'; return p; }); b.replaceWith(...ps); nb = ps[0];
      } else { const n = document.createElement(want.toLowerCase()); n.innerHTML = b.innerHTML; n.classList.toggle('check', chk); b.replaceWith(n); nb = n; }
    } else if (/^(P|H[1-3]|BLOCKQUOTE)$/.test(b.nodeName)) {
      const n = document.createElement(want.toLowerCase()), li = document.createElement('li'); li.innerHTML = b.innerHTML || '<br>'; n.append(li); n.classList.toggle('check', chk); b.replaceWith(n); nb = n;
    } else return;
    if (b.textContent) setTextPos(pos); else placeCaret(nb.lastElementChild || nb, 0, true); hist.snap(); markDirty(); updateTb();
  }
  function toggleCode() {
    const s = getSelection(); if (!s.rangeCount) return; hist.snap();
    const anc = s.anchorNode.nodeType === 3 ? s.anchorNode.parentElement : s.anchorNode, c = anc.closest('code');
    if (c && !c.closest('pre')) c.replaceWith(...c.childNodes);
    else document.execCommand('insertHTML', false, `<code>${esc(s.toString())}</code>`);
    hist.snap(); markDirty();
  }
  async function doLink() {
    const a = getSelection().anchorNode, cur = (a?.nodeType === 3 ? a.parentElement : a)?.closest?.('a');
    const url = await prompt2('Link address', cur?.getAttribute('href') || 'https://');
    if (url === null) return;
    hist.snap();
    if (!url || url === 'https://') document.execCommand('unlink'); else document.execCommand('createLink', false, /^(https?:|mailto:|#)/.test(url) ? url : 'https://' + url);
    hist.snap(); markDirty();
  }

  // ---------- inserting blocks: "/" menu ----------
  let slashOpen = false;
  function insertBlock(node, { replaceEmpty = true } = {}) {
    hist.snap();
    const b = curBlock();
    if (!b) active.append(node);
    else if (replaceEmpty && b.nodeName === 'P' && !b.textContent.trim() && !b.querySelector('img,figure')) b.replaceWith(node);
    else b.after(node);
    if (node.nodeName === 'FIGURE' || node.nodeName === 'HR') { renderFigures(active); let n = node.nextElementSibling; if (!n) { n = document.createElement('p'); n.innerHTML = '<br>'; node.after(n); } placeCaret(n, 0); }
    else placeCaret(node.querySelector('li,td,th') || node, 0);
    hist.snap(); markDirty();
  }
  const mk = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const SLASH = [
    ['Text', 'p', () => setBlockAt('p')], ['Heading 1', 'h1 #', () => setBlockAt('h1')], ['Heading 2', 'h2 ##', () => setBlockAt('h2')], ['Heading 3', 'h3 ###', () => setBlockAt('h3')],
    ['Bulleted list', 'ul bullet -', () => listAt('ul')], ['Numbered list', 'ol number 1.', () => listAt('ol')], ['Checklist', 'todo check []', () => listAt('check')],
    ['Quote', 'blockquote >', () => setBlockAt('blockquote')], ['Code block', 'pre code ```', () => setBlockAt('pre')],
    ['Table', 'table grid', () => insertBlock(mk('<table><tr><th><br></th><th><br></th><th><br></th></tr><tr><td><br></td><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td><td><br></td></tr></table>'))],
    ['Divider', 'hr line ---', () => insertBlock(mk('<hr>'))], ['Image', 'picture upload', () => pickImage()],
    ['Chart', 'bar line pie graph', () => insertBlock(mk(`<figure class="chart" data-chart='${JSON.stringify({ type: 'bar', title: 'Chart title', rows: [['A', 4], ['B', 7], ['C', 5]] })}'></figure>`))],
    ['Diagram', 'flow steps process', () => insertBlock(mk(`<figure class="diagram" data-diagram='${JSON.stringify({ title: 'Flow', steps: ['Start', 'Middle', 'End'] })}'></figure>`))],
    ['Date', 'today chip', () => insertChip('date', new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }))],
    ['Mention', '@ person', async () => { const n = await prompt2('Mention who?'); if (n) insertChip('mention', '@' + n.replace(/^@/, '')); }],
    ['Link to tab', 'tab chip', () => menu($('#ed-head'), order().filter(s => s !== active).map(s => [s.dataset.name, () => insertChip('tab', s.dataset.name, s.dataset.tab)]))],
    ['Pending block', 'placeholder to be filled', () => insertBlock(mk('<div class="pending" data-intent="Describe what will go here"></div>'))],
  ];
  function setBlockAt(t) { hist.snap(); document.execCommand('formatBlock', false, t); hist.snap(); markDirty(); }
  const listAt = kind => setList(kind);
  function showSlash() {
    const b = curBlock(); const q = (b?.textContent || '').replace(/^\//, '').toLowerCase();
    const list = SLASH.filter(s => !q || (s[0] + ' ' + s[1]).toLowerCase().includes(q));
    if (!list.length) return closePop();
    slashOpen = true; pop.className = 'menu slash'; pop.innerHTML = '';
    list.forEach(([n, , fn], i) => {
      const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'mi' + (i ? '' : ' on'); bt.textContent = n; bt.onmousedown = e => e.preventDefault();
      bt.onclick = () => pick(fn); pop.append(bt);
    });
    place(pop, getSelection().getRangeAt(0).getBoundingClientRect().height ? getSelection().getRangeAt(0).getBoundingClientRect() : b.getBoundingClientRect());
  }
  function pick(fn) { const b = curBlock(); closePop(); if (b && b.textContent.startsWith('/')) { b.innerHTML = '<br>'; placeCaret(b, 0); } fn(); }
  function slashKey(e) {
    const items = $$('.mi', pop), k = items.findIndex(x => x.classList.contains('on'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); items[k]?.classList.remove('on'); const n = items[(k + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]; n.classList.add('on'); n.scrollIntoView({ block: 'nearest' }); return true; }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); items[k]?.click(); return true; }
    if (e.key === 'Escape') { e.preventDefault(); closePop(); return true; }
    return false;
  }
  function insertChip(kind, text, ref) {
    active.focus({ preventScroll: true }); hist.snap();
    const sel = getSelection(), chip = document.createElement('span'), gap = document.createTextNode('\u00a0');
    chip.className = 'chip ' + kind; chip.contentEditable = 'false'; chip.dataset.kind = kind; if (ref) chip.dataset.ref = ref; chip.textContent = text;
    if (!sel.rangeCount || !inActive(sel.anchorNode)) placeCaret(active.lastElementChild || active, 0, true);
    const r = getSelection().getRangeAt(0); r.deleteContents(); r.insertNode(gap); r.insertNode(chip);
    placeCaret(gap, 1); hist.snap(); markDirty();
  }
  function pickImage() { const f = $('#ed-file'); f.value = ''; f.onchange = () => f.files[0] && addImage(f.files[0]); f.click(); }
  function addImage(file) {
    const rd = new FileReader();
    rd.onload = () => { const alt = file.name?.replace(/\.[^.]+$/, '') || 'image'; insertBlock(mk(`<figure class="img" contenteditable="false"><img src="${rd.result}" alt="${esc(alt)}"></figure>`)); };
    rd.readAsDataURL(file);
  }

  // ---------- keyboard: markdown shortcuts, tables, lists, move block ----------
  const MD = { '#': 'h1', '##': 'h2', '###': 'h3', '-': 'ul', '*': 'ul', '1.': 'ol', '[]': 'check', '>': 'blockquote', '```': 'pre' };
  function mdShortcut(e) {
    const s = getSelection(); if (!s.isCollapsed) return false;
    const b = curBlock(); if (!b || b.nodeName !== 'P') return false;
    const pre = document.createRange(); pre.selectNodeContents(b); pre.setEnd(s.anchorNode, s.anchorOffset);
    const t = pre.toString(); const kind = MD[t]; if (!kind || b.textContent !== t) return false;
    e.preventDefault(); hist.snap(); b.innerHTML = '<br>'; placeCaret(b, 0);
    if (/^h\d$|blockquote|pre/.test(kind)) document.execCommand('formatBlock', false, kind); else listAt(kind);
    hist.snap(); markDirty(); return true;
  }
  const cellOf = n => (n?.nodeType === 3 ? n.parentElement : n)?.closest?.('td,th');
  function tableKey(e) {
    const c = cellOf(getSelection().anchorNode); if (!c || e.key !== 'Tab') return false;
    e.preventDefault(); const cells = $$('td,th', c.closest('table')), i = cells.indexOf(c) + (e.shiftKey ? -1 : 1);
    if (i >= cells.length) { tableOp('rowbelow', c); return true; }
    if (i >= 0) placeCaret(cells[i], 0, true); return true;
  }
  function tableOp(op, c) {
    const t = c.closest('table'), tr = c.parentElement, rows = [...t.rows], ci = c.cellIndex; hist.snap();
    const cell = (tag = 'td') => mk(`<${tag}><br></${tag}>`);
    if (op === 'rowabove' || op === 'rowbelow') { const n = tr.cloneNode(false); [...tr.cells].forEach(() => n.append(cell('td'))); op === 'rowabove' ? tr.before(n) : tr.after(n); placeCaret(n.cells[ci], 0); }
    if (op === 'colleft' || op === 'colright') rows.forEach(r => { const ref = r.cells[ci], n = cell(ref.nodeName.toLowerCase()); op === 'colleft' ? ref.before(n) : ref.after(n); });
    if (op === 'delrow') { if (rows.length > 1) { const nx = tr.nextElementSibling || tr.previousElementSibling; tr.remove(); placeCaret(nx.cells[Math.min(ci, nx.cells.length - 1)], 0); } else t.remove(); }
    if (op === 'delcol') { if (tr.cells.length > 1) rows.forEach(r => r.cells[ci].remove()); else t.remove(); }
    if (op === 'deltable') t.remove();
    hist.snap(); markDirty();
  }
  function tableMenu(c, x, y) {
    menu({ left: x, right: x, top: y, bottom: y, width: 0, height: 0 }, [['Insert row above', () => tableOp('rowabove', c)], ['Insert row below', () => tableOp('rowbelow', c)], ['Insert column left', () => tableOp('colleft', c)],
      ['Insert column right', () => tableOp('colright', c)], null, ['Delete row', () => tableOp('delrow', c)], ['Delete column', () => tableOp('delcol', c)], ['Delete table', () => tableOp('deltable', c)]]);
  }
  function moveBlock(dir) {
    const b = curBlock(); if (!b) return; const o = dir < 0 ? b.previousElementSibling : b.nextElementSibling; if (!o) return;
    hist.snap(); const pos = textPos(); dir < 0 ? o.before(b) : o.after(b); renderFigures(active); setTextPos(pos); hist.snap(); markDirty();
  }
  document.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 's') { e.preventDefault(); save(); return; }
    if (mod && k === 'f') { e.preventDefault(); openFind(); return; }
    if (!inActive(e.target)) return;
    if (slashOpen && slashKey(e)) return;
    if (mod && !e.altKey && (k === 'z' || k === 'y')) { e.preventDefault(); hist.go(k === 'y' || e.shiftKey ? 1 : -1); return; }
    if (mod && k === 'k') { e.preventDefault(); doLink(); return; }
    if (mod && e.shiftKey && k === 'c') { e.preventDefault(); startComment(); return; }
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); moveBlock(e.key === 'ArrowUp' ? -1 : 1); return; }
    if (e.key === ' ' && mdShortcut(e)) return;
    if (tableKey(e)) return;
    if (e.key === 'Tab' && curBlock()?.matches('ul,ol')) { e.preventDefault(); hist.snap(); document.execCommand(e.shiftKey ? 'outdent' : 'indent'); hist.snap(); markDirty(); return; }
    if (e.key === 'Enter' && !e.shiftKey) { const b = curBlock(); if (b?.nodeName === 'PRE') { e.preventDefault(); preNewline(); } }
    if ((e.key === 'Backspace' || e.key === 'Delete')) { const f = $('figure.sel', active); if (f) { e.preventDefault(); hist.snap(); f.remove(); hist.snap(); markDirty(); } }
  }, true);
  active_input();
  function active_input() {
    document.addEventListener('beforeinput', e => {
      if (!inActive(e.target)) return;
      if (e.inputType === 'historyUndo') { e.preventDefault(); hist.go(-1); }
      else if (e.inputType === 'historyRedo') { e.preventDefault(); hist.go(1); }
      else if (e.inputType === 'insertParagraph') queueMicrotask(() => { const li = curBlock() && (getSelection().anchorNode.nodeType === 3 ? getSelection().anchorNode.parentElement : getSelection().anchorNode).closest('li'); if (li) li.removeAttribute('data-done'); });
    }, true);
    document.addEventListener('input', e => {
      if (!inActive(e.target)) return;
      markDirty(); hist.later(); refreshSide(true);
      const b = curBlock();
      if (b?.nodeName === 'P' && /^\/[\w ]*$/.test(b.textContent) && !b.querySelector('*:not(br)')) showSlash(); else if (slashOpen) closePop();
    });
  }

  function preNewline() { // execCommand would insert <br>; a code block keeps real newlines
    hist.snap(); const r = getSelection().getRangeAt(0); r.deleteContents();
    const nl = document.createTextNode('\n'); r.insertNode(nl);
    let n = nl.nextSibling; while (n && n.nodeType === 3 && !n.length) { const x = n.nextSibling; n.remove(); n = x; }
    if (!n || n.nodeName === 'BR') nl.after(document.createTextNode('\n')); // a lone trailing newline is not drawn, so keep a second one for the caret
    placeCaret(nl, 1); hist.snap(); markDirty();
  }
  const preText = pre => { const c = pre.cloneNode(true); $$('br', c).forEach(x => x.replaceWith('\n')); return c.textContent; };

  // ---------- clicks: checklists, chips, figures, table menu ----------
  document.addEventListener('click', e => {
    const t = e.target; if (!t.isConnected) return; // a menu item that was replaced by the next menu
    if (!pop.contains(t) && !t.closest('[data-menu],[data-cmd],#ed-tb')) { if (!pop.matches('.form') ) closePop(); }
    if (!inActive(t)) { $$('figure.sel', active || document).forEach(f => f.classList.remove('sel')); return; }
    const li = t.closest('ul.check > li');
    if (li && e.offsetX < 26 && t === li) { hist.snap(); li.dataset.done ? li.removeAttribute('data-done') : li.dataset.done = '1'; hist.snap(); markDirty(); return; }
    const chip = t.closest('.chip.tab'); if (chip && secById(chip.dataset.ref)) { activate(chip.dataset.ref); return; }
    const cm = t.closest('.cm'); if (cm) { openSide('comments'); focusThread(cm.dataset.cid); }
    $$('figure.sel', active).forEach(f => f.classList.remove('sel'));
    const fig = t.closest('figure'); if (fig) { fig.classList.add('sel'); if (fig.matches('.chart,.diagram')) editFigure(fig); }
  });
  document.addEventListener('contextmenu', e => {
    const c = inActive(e.target) && cellOf(e.target); if (!c) return;
    e.preventDefault(); placeCaret(c, 0, true); tableMenu(c, e.clientX, e.clientY);
  });
  document.addEventListener('dblclick', e => { const li = e.target.closest?.('ul.check > li'); if (li && e.offsetX < 26) e.preventDefault(); });

  // ---------- paste ----------
  const OK = new Set('P H1 H2 H3 UL OL LI B STRONG I EM U S A CODE PRE BLOCKQUOTE TABLE TBODY THEAD TR TD TH BR HR IMG'.split(' '));
  function clean(node, out) {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) { out.append(n.textContent); continue; }
      if (n.nodeType !== 1) continue;
      const nm = n.nodeName;
      if (!OK.has(nm)) { if (!/^(SCRIPT|STYLE|META|HEAD)$/.test(nm)) clean(n, out); if (/^(DIV|SECTION|ARTICLE)$/.test(nm) && out.lastChild && out.lastChild.nodeName !== 'P') out.append(document.createElement('br')); continue; }
      const c = document.createElement(nm.toLowerCase());
      if (nm === 'A' && /^(https?:|mailto:)/.test(n.getAttribute('href') || '')) c.setAttribute('href', n.getAttribute('href'));
      if (nm === 'IMG' && /^(data:image|https?:)/.test(n.getAttribute('src') || '')) { c.setAttribute('src', n.getAttribute('src')); c.alt = n.alt || ''; }
      clean(n, c); out.append(c);
    }
    return out;
  }
  document.addEventListener('paste', e => {
    if (!inActive(e.target)) return;
    const cd = e.clipboardData, img = [...cd.files].find(f => f.type.startsWith('image/'));
    e.preventDefault(); hist.snap();
    if (img) return addImage(img);
    const html = cd.getData('text/html');
    if (html) { const d = new DOMParser().parseFromString(html, 'text/html'); document.execCommand('insertHTML', false, clean(d.body, document.createElement('div')).innerHTML); }
    else document.execCommand('insertText', false, cd.getData('text/plain'));
    hist.snap(); markDirty();
  }, true);

  // ---------- charts and diagrams (drawn as SVG from the data kept on the figure) ----------
  const parse = (el, k, d) => { try { return JSON.parse(el.getAttribute(k)); } catch { return d; } };
  const num = v => Number(v) || 0;
  function chartSvg(d) {
    const rows = (d.rows || []).map(r => [String(r[0]), num(r[1])]), W = 640, H = 300, L = 48, B = 56, T = d.title ? 44 : 16, raw = Math.max(1, ...rows.map(r => r[1]));
    const mag = 10 ** Math.floor(Math.log10(raw)), max = [1, 2, 2.5, 5, 10].map(m => m * mag).find(m => m >= raw);
    const title = d.title ? `<text x="${W / 2}" y="26" text-anchor="middle" class="ct">${esc(d.title)}</text>` : '';
    let body = '';
    if (d.type === 'pie') {
      const tot = rows.reduce((a, r) => a + r[1], 0) || 1, cx = 200, cy = 160, R = 100; let a0 = -Math.PI / 2;
      rows.forEach(([n, v], i) => {
        const a1 = a0 + v / tot * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0, p = a => `${cx + R * Math.cos(a)} ${cy + R * Math.sin(a)}`;
        body += `<path data-mark="${i}" d="M${cx} ${cy} L${p(a0)} A${R} ${R} 0 ${big} 1 ${p(a1)} Z" fill="${PALETTE[i % PALETTE.length]}"><title>${esc(n)}: ${v}</title></path>`;
        body += `<rect x="360" y="${90 + i * 26}" width="14" height="14" rx="3" fill="${PALETTE[i % PALETTE.length]}"/><text x="382" y="${102 + i * 26}" class="cl">${esc(n)} · ${v} (${Math.round(v / tot * 100)}%)</text>`; a0 = a1;
      });
    } else {
      const ph = H - T - B, bw = (W - L - 16) / Math.max(1, rows.length);
      for (let g = 0; g <= 4; g++) { const y = T + ph - ph * g / 4; body += `<line x1="${L}" x2="${W - 8}" y1="${y}" y2="${y}" class="cg"/><text x="${L - 8}" y="${y + 4}" text-anchor="end" class="cl">${Math.round(max * g / 4 * 100) / 100}</text>`; }
      const pts = rows.map(([, v], i) => [L + bw * i + bw / 2, T + ph - ph * v / max]);
      if (d.type === 'line') body += `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${PALETTE[0]}" stroke-width="3"/>`;
      rows.forEach(([n, v], i) => {
        const [x, y] = pts[i];
        body += d.type === 'line' ? `<circle data-mark="${i}" cx="${x}" cy="${y}" r="5" fill="${PALETTE[0]}"><title>${esc(n)}: ${v}</title></circle>` : `<rect data-mark="${i}" x="${x - bw * .3}" y="${y}" width="${bw * .6}" height="${T + ph - y}" rx="3" fill="${PALETTE[i % PALETTE.length]}"><title>${esc(n)}: ${v}</title></rect>`;
        body += `<text x="${x}" y="${y - 6}" text-anchor="middle" class="cl">${v}</text><text x="${x}" y="${H - B + 20}" text-anchor="middle" class="cl">${esc(n.length > 14 ? n.slice(0, 13) + '…' : n)}</text>`;
      });
    }
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(d.title || 'Chart')}" xmlns="http://www.w3.org/2000/svg">${title}${body}</svg>`;
  }
  function diagramSvg(d) {
    const st = (d.steps || []).map(String), bw = 150, gap = 44, h = 56, W = Math.max(1, st.length) * (bw + gap) - gap + 16, T = d.title ? 40 : 12;
    const out = st.map((s, i) => `<g data-mark="${i}"><rect x="${8 + i * (bw + gap)}" y="${T}" width="${bw}" height="${h}" rx="12" fill="${PALETTE[i % PALETTE.length]}"/><text x="${8 + i * (bw + gap) + bw / 2}" y="${T + h / 2 + 5}" text-anchor="middle" class="dl">${esc(s.length > 18 ? s.slice(0, 17) + '…' : s)}</text></g>` +
      (i < st.length - 1 ? `<path d="M${8 + i * (bw + gap) + bw + 6} ${T + h / 2} H${8 + (i + 1) * (bw + gap) - 8}" stroke="currentColor" stroke-width="2.5" fill="none"/><path d="M${8 + (i + 1) * (bw + gap) - 8} ${T + h / 2 - 6} l8 6 l-8 6z" fill="currentColor"/>` : '')).join('');
    return `<svg viewBox="0 0 ${W} ${T + h + 16}" role="img" aria-label="${esc(d.title || 'Diagram')}" xmlns="http://www.w3.org/2000/svg">${d.title ? `<text x="${W / 2}" y="24" text-anchor="middle" class="ct">${esc(d.title)}</text>` : ''}${out}</svg>`;
  }
  function renderFigures(r) {
    $$('figure.chart', r).forEach(f => { f.contentEditable = 'false'; f.innerHTML = chartSvg(parse(f, 'data-chart', {})); });
    $$('figure.diagram', r).forEach(f => { f.contentEditable = 'false'; f.innerHTML = diagramSvg(parse(f, 'data-diagram', {})); });
  }
  function editFigure(fig) {
    const isChart = fig.matches('.chart'), d = isChart ? parse(fig, 'data-chart', {}) : parse(fig, 'data-diagram', {});
    pop.className = 'form wide';
    pop.innerHTML = `<label>Title<input data-f="title" value="${esc(d.title || '')}"></label>` +
      (isChart ? `<label>Type<select data-f="type">${['bar', 'line', 'pie'].map(t => `<option ${d.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label>Data (label,value per line)<textarea data-f="rows" rows="6">${esc((d.rows || []).map(r => r.join(',')).join('\n'))}</textarea></label>`
        : `<label>Steps (one per line)<textarea data-f="steps" rows="6">${esc((d.steps || []).join('\n'))}</textarea></label>`) +
      `<div><button class="ed-btn" data-ok>Apply</button><button class="ed-btn" data-no>Cancel</button></div>`;
    place(pop, fig.getBoundingClientRect());
    $('[data-no]', pop).onclick = closePop;
    $('[data-ok]', pop).onclick = () => {
      const g = k => $(`[data-f=${k}]`, pop)?.value;
      hist.snap();
      if (isChart) { const rows = g('rows').split('\n').map(l => l.trim()).filter(Boolean).map(l => { const i = l.lastIndexOf(','); return i < 0 ? [l, 0] : [l.slice(0, i).trim(), num(l.slice(i + 1))]; }); fig.setAttribute('data-chart', JSON.stringify({ type: g('type'), title: g('title'), rows })); }
      else fig.setAttribute('data-diagram', JSON.stringify({ title: g('title'), steps: g('steps').split('\n').map(l => l.trim()).filter(Boolean) }));
      renderFigures(active); closePop(); hist.snap(); markDirty();
    };
  }

  // ---------- comments ----------
  let pending = null; // {range, quote}
  const me = () => DOC.dataset.byline || 'You';
  const spansOf = cid => $$(`.cm[data-cid="${cid}"]`, DOC);
  function startComment() {
    const s = getSelection(); if (!s.rangeCount || s.isCollapsed || !inActive(s.anchorNode)) return;
    pending = { range: s.getRangeAt(0).cloneRange(), quote: s.toString().slice(0, 200) };
    openSide('comments'); const ta = $('#ed-newc textarea', side); ta?.focus();
  }
  function wrapRange(range, cid) {
    const nodes = []; const w = document.createTreeWalker(range.commonAncestorContainer.nodeType === 3 ? range.commonAncestorContainer.parentNode : range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
    let t; while ((t = w.nextNode())) if (range.intersectsNode(t) && t.length) nodes.push(t);
    for (let n of nodes) {
      let a = 0, b = n.length;
      if (n === range.startContainer) a = range.startOffset; if (n === range.endContainer) b = range.endOffset;
      if (b <= a || !n.data.slice(a, b).trim() && b - a < 1) continue;
      if (b < n.length) n.splitText(b); const mid = a > 0 ? n.splitText(a) : n;
      const sp = document.createElement('span'); sp.className = 'cm'; sp.dataset.cid = cid; mid.replaceWith(sp); sp.append(mid);
    }
  }
  function submitComment(text) {
    if (!pending || !text.trim()) return;
    hist.snap();
    const cid = 'c' + uid(); wrapRange(pending.range, cid);
    DATA.comments.push({ id: cid, tab: active.dataset.tab, quote: pending.quote, by: me(), ts: Date.now(), text: text.trim(), replies: [], resolved: false, to: /@claude/i.test(text) ? 'claude' : undefined, answered: false });
    pending = null; hist.snap(); markDirty(); refreshSide(); getSelection().removeAllRanges(); hideTb();
  }
  const threadsHere = () => {
    const ids = [...new Set($$('.cm', active).map(x => x.dataset.cid))];
    return ids.map(id => DATA.comments.find(c => c.id === id)).filter(Boolean);
  };
  const ago = ts => { const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? 'now' : m < 60 ? m + ' min' : m < 1440 ? Math.round(m / 60) + ' h' : Math.round(m / 1440) + ' d'; };
  function threadsHtml() {
    const list = threadsHere(); const open = list.filter(c => !c.resolved), done = list.filter(c => c.resolved);
    const card = c => `<div class="thread${c.resolved ? ' resolved' : ''}" data-tid="${c.id}"><div class="q">${esc(c.quote)}</div>` +
      [{ by: c.by, ts: c.ts, text: c.text }, ...c.replies].map(r => `<div class="cmsg"><b>${esc(r.by)}</b> <small>${ago(r.ts)}</small><p>${esc(r.text).replace(/@claude/gi, '<span class="at">@Claude</span>')}</p></div>`).join('') +
      (c.to === 'claude' && !c.answered ? '<div class="badge">Waiting for Claude</div>' : '') +
      `<div class="acts"><input placeholder="Reply" aria-label="Reply"><button class="ed-btn" data-c="reply">Reply</button><button class="ed-btn" data-c="resolve">${c.resolved ? 'Reopen' : 'Resolve'}</button><button class="ed-ib" data-c="del" title="Delete thread" aria-label="Delete thread">🗑</button></div></div>`;
    return (open.map(card).join('') || '<p class="empty">No open comments. Select text and press the comment button.</p>') + (done.length ? `<h4>Resolved</h4>${done.map(card).join('')}` : '');
  }
  function focusThread(id) { const t = $(`.thread[data-tid="${id}"]`, side); if (t) { t.scrollIntoView({ block: 'nearest' }); t.classList.add('flash'); setTimeout(() => t.classList.remove('flash'), 900); } }
  side.addEventListener('click', e => {
    const b = e.target.closest('[data-c],[data-h],[data-sd]'); if (!b) return;
    if (b.dataset.sd) return openSide(b.dataset.sd);
    if (b.dataset.h) return histAct(b.dataset.h, b.dataset.id);
    const th = b.closest('.thread'), c = DATA.comments.find(x => x.id === th.dataset.tid), k = b.dataset.c;
    if (k === 'reply') { const i = $('input', th), v = i.value.trim(); if (!v) return; c.replies.push({ by: me(), ts: Date.now(), text: v }); if (/@claude/i.test(v)) { c.to = 'claude'; c.answered = false; } markDirty(); refreshSide(); }
    if (k === 'resolve') { c.resolved = !c.resolved; spansOf(c.id).forEach(s => s.classList.toggle('done', c.resolved)); markDirty(); refreshSide(); }
    if (k === 'del') { hist.snap(); spansOf(c.id).forEach(s => s.replaceWith(...s.childNodes)); active.normalize(); DATA.comments = DATA.comments.filter(x => x !== c); hist.snap(); markDirty(); refreshSide(); }
    if (k === 'new') submitComment($('#ed-newc textarea', side).value);
    if (k === 'cancel') { pending = null; refreshSide(); }
  });
  side.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && e.target.matches('.thread input')) { e.preventDefault(); $('[data-c=reply]', e.target.closest('.thread')).click(); } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.matches('#ed-newc textarea')) $('[data-c=new]', side).click(); });
  side.addEventListener('click', e => { const th = e.target.closest('.thread'); if (th && !e.target.closest('button,input')) { const s = spansOf(th.dataset.tid)[0]; s?.scrollIntoView({ block: 'center', behavior: 'smooth' }); } });

  // ---------- side panel: comments / version history ----------
  let sideMode = null;
  function openSide(mode) { sideMode = mode; side.hidden = false; document.body.classList.add('side-open'); renderSide(); }
  function closeSide() { sideMode = null; side.hidden = true; document.body.classList.remove('side-open'); }
  function refreshSide(light) {
    const open = threadsHere().filter(c => !c.resolved).length; $('#ed-ccount').textContent = open || '';
    if (!sideMode) return;
    if (light && sideMode === 'comments') { const box = $('#ed-threads', side); if (box && !box.contains(document.activeElement)) box.innerHTML = threadsHtml(); return; }
    renderSide();
  }
  function renderSide() {
    const tabs = `<div class="sd-tabs"><button data-sd="comments" class="${sideMode === 'comments' ? 'on' : ''}">Comments</button><button data-sd="history" class="${sideMode === 'history' ? 'on' : ''}">History</button><button class="ed-ib" data-cmd="closeside" aria-label="Close panel">×</button></div>`;
    if (sideMode === 'comments') {
      side.innerHTML = tabs + (pending ? `<div id="ed-newc"><div class="q">${esc(pending.quote)}</div><textarea rows="3" placeholder="Add a comment. @Claude asks Claude." aria-label="New comment"></textarea><div><button class="ed-btn pri" data-c="new">Comment</button><button class="ed-btn" data-c="cancel">Cancel</button></div></div>` : '') + `<div id="ed-threads">${threadsHtml()}</div>`;
    } else {
      const revs = [...DATA.revisions].reverse();
      side.innerHTML = tabs + `<div class="hist-top"><button class="ed-btn" data-h="snap">Save version now</button></div>` + (revs.map(r => `<div class="rev"><div><b>${esc(r.label || 'Version')}</b><small>${new Date(r.ts).toLocaleString('en-GB')} · ${r.tabs.length} tab${r.tabs.length > 1 ? 's' : ''} · ${r.words} words</small></div><button class="ed-btn" data-h="restore" data-id="${r.id}">Restore</button></div>`).join('') || '<p class="empty">No versions yet. A version is kept each time you save a changed doc.</p>');
    }
    $('[data-cmd=closeside]', side)?.addEventListener('click', closeSide);
  }
  const tabsState = () => sections().map(s => { const c = s.cloneNode(true); $$('figure.chart,figure.diagram', c).forEach(f => f.innerHTML = ''); c.classList.remove('active'); c.removeAttribute('contenteditable'); c.removeAttribute('spellcheck'); return { id: s.dataset.tab, name: s.dataset.name, order: s.dataset.order, sub: s.dataset.subtabOf || '', html: c.innerHTML }; });
  const words = tabs => tabs.reduce((n, t) => n + (t.html.replace(/<[^>]+>/g, ' ').match(/\S+/g) || []).length, 0);
  function addRevision(label) {
    const tabs = tabsState(), last = DATA.revisions.at(-1);
    if (!label && last && JSON.stringify(last.tabs) === JSON.stringify(tabs)) return false;
    DATA.revisions.push({ id: 'r' + uid(), ts: Date.now(), label: label || 'Saved', tabs, words: words(tabs) });
    while (DATA.revisions.length > 40) DATA.revisions.shift();
    return true;
  }
  function histAct(k, id) {
    if (k === 'snap') { prompt2('Version name', 'Version').then(n => { if (n === null) return; addRevision(n || 'Version'); markDirty(); renderSide(); }); return; }
    if (k === 'restore') {
      const r = DATA.revisions.find(x => x.id === id); if (!r) return;
      addRevision('Before restore'); const keep = active?.dataset.tab;
      $$('#doc > section[data-tab]').forEach(s => s.remove());
      r.tabs.forEach(t => { const s = document.createElement('section'); s.dataset.tab = t.id; s.dataset.name = t.name; s.dataset.order = t.order; if (t.sub) s.dataset.subtabOf = t.sub; s.innerHTML = t.html; DOC.append(s); });
      active = null; activate(secById(keep) ? keep : order()[0].dataset.tab); markDirty(); renderSide(); status('Restored “' + r.label + '”');
    }
  }

  // ---------- find and replace ----------
  function openFind() { $('#ed-find').hidden = false; const q = $('#ed-fq'); const sel = getSelection().toString(); if (sel && !sel.includes('\n')) q.value = sel; q.focus(); q.select(); countFind(); }
  function countFind() { const q = $('#ed-fq').value.toLowerCase(); $('#ed-fn').textContent = q ? ((active.textContent.toLowerCase().split(q).length - 1) + ' found') : ''; }
  function findNext() {
    const q = $('#ed-fq').value; if (!q) return false;
    const s = getSelection(); if (!inActive(s.anchorNode)) { active.focus({ preventScroll: true }); placeCaret(active, 0); }
    let hit = window.find(q, false, false, true, false, false, false);
    if (hit && !inActive(getSelection().anchorNode)) hit = false;
    return hit;
  }
  function replaceOne() {
    const q = $('#ed-fq').value, r = $('#ed-fr').value, s = getSelection();
    if (inActive(s.anchorNode) && s.toString().toLowerCase() === q.toLowerCase() && q) { hist.snap(); document.execCommand('insertText', false, r); hist.snap(); markDirty(); }
    findNext(); countFind();
  }
  function replaceAll() {
    const q = $('#ed-fq').value, r = $('#ed-fr').value; if (!q) return; hist.snap(); active.focus({ preventScroll: true }); placeCaret(active, 0);
    for (let i = 0; i < 1000 && findNext(); i++) document.execCommand('insertText', false, r);
    hist.snap(); markDirty(); countFind();
  }
  $('#ed-fq').addEventListener('input', countFind);
  $('#ed-fq').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); findNext(); } if (e.key === 'Escape') $('#ed-find').hidden = true; });

  // ---------- save ----------
  function serialize() {
    hist.snap();
    const html = document.documentElement.cloneNode(true);
    $$('[data-chrome]', html).forEach(n => n.remove());
    html.removeAttribute('data-theme');
    const d = $('#doc', html); d.classList.remove('doc-body'); if (!d.getAttribute('class')) d.removeAttribute('class');
    $$('section[data-tab]', d).forEach(s => { s.classList.remove('active'); s.removeAttribute('contenteditable'); s.removeAttribute('spellcheck'); if (!s.getAttribute('class')) s.removeAttribute('class'); });
    $$('figure.chart,figure.diagram', d).forEach(f => { f.innerHTML = ''; f.removeAttribute('contenteditable'); });
    $$('figure.sel', d).forEach(f => f.classList.remove('sel'));
    const j = $('#doc-data', html); if (j) j.textContent = JSON.stringify(DATA);
    return '<!doctype html>\n' + html.outerHTML;
  }
  const slug = () => ((DOC.dataset.title || 'document').replace(/[\\/:*?"<>|\0]+/g, '').trim() || 'document');
  async function putFile(name, body, type) {
    try { const r = await fetch('/save?file=' + encodeURIComponent(name), { method: 'POST', body }); if (r.ok) return true; } catch {}
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); return false;
  }
  async function save() {
    addRevision();
    const ok = await putFile(FILE, serialize(), 'text/html');
    dirty = false; $('#ed-save').classList.remove('dirty');
    status((ok ? 'Saved ' : 'Downloaded ') + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
    lastStamp = await stamp(); refreshSide();
  }
  async function stamp() { try { return await (await fetch('/stamp?file=' + encodeURIComponent(FILE), { cache: 'no-store' })).text(); } catch { return '0'; } }
  // live reload: Claude (or anything) rewrites the file on disk -> show it, unless there are unsaved edits here
  let warned = false;
  async function poll() {
    const st = await stamp(); if (st === '0') return;
    if (lastStamp === '0') { lastStamp = st; return; }
    if (st === lastStamp) return;
    if (dirty) { if (!warned) { status('File changed on disk. Saving here will overwrite it.'); warned = true; } return; }
    lastStamp = st; warned = false;
    const d = new DOMParser().parseFromString(await (await fetch(FILE, { cache: 'no-store' })).text(), 'text/html'), nd = $('#doc', d); if (!nd) return;
    try { DATA = JSON.parse($('#doc-data', d)?.textContent || '{}'); } catch { DATA = {}; } DATA.comments ||= []; DATA.revisions ||= [];
    const keep = active?.dataset.tab; DOC.innerHTML = nd.innerHTML; for (const a of ['data-title', 'data-byline', 'data-date']) nd.hasAttribute(a) ? DOC.setAttribute(a, nd.getAttribute(a)) : DOC.removeAttribute(a);
    $('#ed-title').value = DOC.dataset.title || ''; active = null; activate(secById(keep) ? keep : order()[0].dataset.tab, true); status('Updated from file');
  }

  // ---------- export ----------
  const inlineMd = n => [...n.childNodes].map(c => {
    if (c.nodeType === 3) return c.textContent.replace(/\s+/g, ' ');
    if (c.nodeType !== 1) return '';
    const t = c.nodeName, inner = inlineMd(c);
    if (t === 'B' || t === 'STRONG') return inner.trim() ? `**${inner.trim()}**` : inner;
    if (t === 'I' || t === 'EM') return inner.trim() ? `*${inner.trim()}*` : inner;
    if (t === 'S' || t === 'STRIKE') return `~~${inner}~~`;
    if (t === 'CODE') return '`' + c.textContent + '`';
    if (t === 'A') return `[${inner}](${c.getAttribute('href') || ''})`;
    if (t === 'BR') return '  \n';
    if (t === 'IMG') return `![${c.alt || ''}](${c.getAttribute('src')})`;
    return inner;
  }).join('');
  function listMd(l, depth = 0) {
    return [...l.children].filter(x => x.nodeName === 'LI').map((li, i) => {
      const sub = [...li.children].filter(x => /^(UL|OL)$/.test(x.nodeName)), clone = li.cloneNode(true); $$('ul,ol', clone).forEach(x => x.remove());
      const mark = l.nodeName === 'OL' ? (i + 1) + '.' : l.classList.contains('check') ? (li.dataset.done ? '- [x]' : '- [ ]') : '-';
      return '  '.repeat(depth) + mark + ' ' + inlineMd(clone).trim() + sub.map(s => '\n' + listMd(s, depth + 1)).join('');
    }).join('\n');
  }
  function toMarkdown(sec) {
    return [...sec.children].map(b => {
      const t = b.nodeName;
      if (/^H[1-3]$/.test(t)) return '#'.repeat(+t[1]) + ' ' + inlineMd(b).trim();
      if (t === 'P') return inlineMd(b).trim();
      if (t === 'UL' || t === 'OL') return listMd(b);
      if (t === 'BLOCKQUOTE') return inlineMd(b).trim().split('\n').map(l => '> ' + l).join('\n');
      if (t === 'PRE') return '```\n' + preText(b).replace(/\n$/, '') + '\n```';
      if (t === 'HR') return '---';
      if (t === 'TABLE') { const rows = [...b.rows].map(r => '| ' + [...r.cells].map(c => inlineMd(c).trim().replace(/\|/g, '\\|')).join(' | ') + ' |'); const n = b.rows[0].cells.length; rows.splice(1, 0, '|' + ' --- |'.repeat(n)); return rows.join('\n'); }
      if (t === 'FIGURE' && b.classList.contains('chart')) { const d = parse(b, 'data-chart', {}); return (d.title ? `**${d.title}**\n\n` : '') + '| Label | Value |\n| --- | --- |\n' + (d.rows || []).map(r => `| ${r[0]} | ${r[1]} |`).join('\n'); }
      if (t === 'FIGURE' && b.classList.contains('diagram')) { const d = parse(b, 'data-diagram', {}); return (d.title ? `**${d.title}**\n\n` : '') + (d.steps || []).join(' → '); }
      if (t === 'FIGURE') return inlineMd(b);
      if (b.classList.contains('pending')) return `> (pending: ${b.dataset.intent || ''})`;
      return inlineMd(b).trim();
    }).filter(Boolean).join('\n\n') + '\n';
  }
  function exportHtml(sec) {
    const c = sec.cloneNode(true); c.className = 'doc-body'; renderFigures(c); [c, ...$$('[contenteditable]', c)].forEach(n => n.removeAttribute('contenteditable'));
    return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${esc(DOC.dataset.title || '')}</title>${(DS?.fonts || []).map(f => `<link rel="stylesheet" href="${f}">`).join('')}<style>body{max-width:760px;margin:40px auto;padding:0 24px;font:16px/1.65 "Segoe UI","Leelawadee UI",sans-serif;color:#1d2433}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccd;padding:6px 10px}pre{background:#f1f1ef;padding:12px;border-radius:8px;overflow:auto}blockquote{border-left:4px solid #ccd;margin:1em 0;padding:0 1em}img,svg{max-width:100%;height:auto}ul.check{list-style:none;padding-left:0}ul.check>li::before{content:"☐ "}ul.check>li[data-done]::before{content:"☑ "}.chip{background:#e6edf7;border-radius:999px;padding:0 8px}.pending{border:1px dashed #99a;padding:8px;color:#667}.pending::before{content:attr(data-intent)}${DS?.css || ''}</style></head><body class="doc-body">${c.outerHTML.replace(/^<section[^>]*>|<\/section>$/g, '')}</body></html>`;
  }
  // --- minimal docx writer (stored zip) ---
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u => { let c = ~0; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return ~c >>> 0; };
  function zip(files) { // files: [[name, Uint8Array]]
    const enc = new TextEncoder(), parts = [], central = []; let off = 0;
    for (const [name, data] of files) {
      const nm = enc.encode(name), crc = crc32(data), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nm.length, true);
      parts.push(new Uint8Array(h.buffer), nm, data);
      const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), nm); off += 30 + nm.length + data.length;
    }
    const cs = central.reduce((n, p) => n + p.length, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }
  const X = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  async function toDocx(sec) {
    const media = []; let rel = 100;
    const img = async (src, wpx, hpx) => {
      const m = /^data:image\/(png|jpe?g|gif);base64,(.*)$/.exec(src); if (!m) return '';
      const bytes = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0)), id = 'rId' + rel++, ext = m[1] === 'jpeg' ? 'jpg' : m[1], name = `image${media.length + 1}.${ext}`;
      media.push({ id, name, bytes }); const w = Math.min(wpx, 600) * 9525, h = Math.round(hpx * (Math.min(wpx, 600) / wpx)) * 9525, n = media.length;
      return `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${w}" cy="${h}"/><wp:docPr id="${n}" name="Picture ${n}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
    };
    const svgPng = svg => new Promise(res => {
      const im = new Image(), vb = svg.viewBox.baseVal, W = 1280, H = Math.round(W * vb.height / vb.width);
      const css = 'text{font-family:Arial,sans-serif;font-size:12px;fill:#1d2433}.ct{font-size:16px;font-weight:700}.dl{fill:#fff;font-weight:600;font-size:14px}.cg{stroke:#d9d9d6}';
      const src = new XMLSerializer().serializeToString(svg).replace('>', `><style>${css}</style>`);
      im.onload = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(im, 0, 0, W, H); res(c.toDataURL('image/png')); };
      im.onerror = () => res(''); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
    });
    const run = (text, f) => `<w:r><w:rPr>${f.code ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>' : ''}${f.b ? '<w:b/>' : ''}${f.i ? '<w:i/>' : ''}${f.s ? '<w:strike/>' : ''}${f.color ? `<w:color w:val="${f.color}"/>` : ''}${f.u ? '<w:u w:val="single"/>' : ''}</w:rPr><w:t xml:space="preserve">${X(text)}</w:t></w:r>`;
    const runs = (n, f = {}) => [...n.childNodes].map(c => {
      if (c.nodeType === 3) return c.textContent ? run(c.textContent.replace(/\s+/g, ' '), f) : '';
      if (c.nodeType !== 1) return '';
      const t = c.nodeName, g = { ...f };
      if (t === 'B' || t === 'STRONG') g.b = 1; if (t === 'I' || t === 'EM') g.i = 1; if (t === 'U') g.u = 1; if (t === 'S' || t === 'STRIKE') g.s = 1; if (t === 'CODE') g.code = 1;
      if (t === 'A') { g.u = 1; g.color = '21409A'; } if (t === 'FONT' && c.color) { const m = /^#?([0-9a-f]{6})$/i.exec(c.getAttribute('color') || '') || /rgb\((\d+), (\d+), (\d+)\)/.exec(c.getAttribute('color') || ''); }
      if (c.style?.color) { const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(c.style.color); if (m) g.color = [1, 2, 3].map(k => (+m[k]).toString(16).padStart(2, '0')).join(''); }
      if (t === 'FONT' && c.getAttribute('color')) g.color = c.getAttribute('color').replace('#', '');
      if (t === 'BR') return '<w:r><w:br/></w:r>';
      return runs(c, g);
    }).join('');
    const para = (inner, o = {}) => `<w:p><w:pPr>${o.style ? `<w:pStyle w:val="${o.style}"/>` : ''}${o.shade ? '<w:shd w:val="clear" w:color="auto" w:fill="F1F1EF"/>' : ''}${o.border ? '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="999999"/></w:pBdr>' : ''}${o.ind ? `<w:ind w:left="${o.ind}"${o.hang ? ` w:hanging="${o.hang}"` : ''}/>` : ''}${o.jc ? `<w:jc w:val="${o.jc}"/>` : ''}</w:pPr>${inner}</w:p>`;
    const jcOf = b => ({ center: 'center', right: 'right', justify: 'both' })[b.style?.textAlign] || '';
    async function block(b, depth = 0) {
      const t = b.nodeName;
      if (/^H[1-3]$/.test(t)) return para(runs(b), { style: 'Heading' + t[1], jc: jcOf(b) });
      if (t === 'P') return para(runs(b), { jc: jcOf(b) });
      if (t === 'BLOCKQUOTE') return para(runs(b, { i: 1 }), { ind: 720 });
      if (t === 'PRE') return preText(b).replace(/\n$/, '').split('\n').map(l => para(run(l, { code: 1 }), { shade: 1 })).join('');
      if (t === 'HR') return para('', { border: 1 });
      if (t === 'UL' || t === 'OL') {
        let out = ''; let i = 0;
        for (const li of b.children) {
          if (li.nodeName !== 'LI') continue; i++; const c = li.cloneNode(true); $$('ul,ol', c).forEach(x => x.remove());
          const mark = t === 'OL' ? i + '. ' : b.classList.contains('check') ? (li.dataset.done ? '☑ ' : '☐ ') : '• ';
          out += para(run(mark, {}) + runs(c), { ind: 720 + depth * 360, hang: 360 });
          for (const sub of li.children) if (/^(UL|OL)$/.test(sub.nodeName)) out += await block(sub, depth + 1);
        }
        return out;
      }
      if (t === 'TABLE') {
        const cell = (c, head) => `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/>${head ? '<w:shd w:val="clear" w:color="auto" w:fill="E6EDF7"/>' : ''}</w:tcPr>${para(runs(c, head ? { b: 1 } : {}))}</w:tc>`;
        const bd = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(k => `<w:${k} w:val="single" w:sz="4" w:color="AAB2C0"/>`).join('');
        return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${bd}</w:tblBorders></w:tblPr>${[...b.rows].map(r => `<w:tr>${[...r.cells].map(c => cell(c, c.nodeName === 'TH')).join('')}</w:tr>`).join('')}</w:tbl>` + para('');
      }
      if (t === 'FIGURE') {
        if (b.classList.contains('img')) { const im = $('img', b); if (!im) return ''; return await img(im.getAttribute('src'), im.naturalWidth || 480, im.naturalHeight || 320); }
        const svg = $('svg', b); if (!svg) return ''; const url = await svgPng(svg); const vb = svg.viewBox.baseVal; return url ? await img(url, 600, Math.round(600 * vb.height / vb.width)) : '';
      }
      if (b.classList?.contains('pending')) return para(run(`(pending: ${b.dataset.intent || ''})`, { i: 1 }));
      return para(runs(b));
    }
    renderFigures(sec);
    let body = ''; for (const b of sec.children) body += await block(b);
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"';
    const hs = [[1, 40, '002654'], [2, 32, '002654'], [3, 26, '21409A']].map(([n, sz, col]) => `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="100"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:b/><w:color w:val="${col}"/><w:sz w:val="${sz}"/></w:rPr></w:style>`).join('');
    const enc = new TextEncoder(), f = (n, s) => [n, enc.encode(s)];
    const files = [
      f('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'),
      f('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
      f('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${media.map(m => `<Relationship Id="${m.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.name}"/>`).join('')}</Relationships>`),
      f('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:cs="Leelawadee UI" w:eastAsia="Aptos"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${hs}</w:styles>`),
      f('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`),
      ...media.map(m => ['word/media/' + m.name, m.bytes]),
    ];
    return zip(files);
  }
  async function doExport(kind) {
    hist.snap(); const base = slug() + (order().length > 1 ? ' - ' + (active.dataset.name || '') : ''); status('Exporting…');
    let ok;
    if (kind === 'md') ok = await putFile(base + '.md', toMarkdown(active), 'text/markdown');
    else if (kind === 'html') ok = await putFile(base + '.export.html', exportHtml(active), 'text/html');
    else if (kind === 'docx') ok = await putFile(base + '.docx', await toDocx(active), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    else if (kind === 'pdf') { document.body.classList.add('printing'); setTimeout(() => { window.print(); document.body.classList.remove('printing'); }, 50); status('Choose “Save as PDF” in the print dialog'); return; }
    status((ok ? 'Exported ' : 'Downloaded ') + base + '.' + kind);
  }
  window.DocEditor = { toMarkdown: () => toMarkdown(active), toDocx: () => toDocx(active), exportHtml: () => exportHtml(active), serialize, get data() { return DATA; }, get active() { return active; }, save, addTab, undo: () => hist.go(-1), redo: () => hist.go(1), get dirty() { return dirty; }, tabs: () => order().map(s => ({ id: s.dataset.tab, name: s.dataset.name, sub: s.dataset.subtabOf || '' })), activate };

  // ---------- commands + init ----------
  document.addEventListener('click', e => {
    const m = e.target.closest('[data-menu]'); if (m) return tabMenu(m.dataset.menu, m);
    const row = e.target.closest('.ed-tab'); if (row) return activate(row.dataset.id);
    const c = e.target.closest('[data-cmd]')?.dataset.cmd, a = e.target.closest('[data-cmd]'); if (!c) return;
    if (c === 'tray') document.body.classList.toggle('tray-closed');
    if (c === 'addtab') addTab();
    if (c === 'save') save();
    if (c === 'theme') { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; try { localStorage.setItem('dd-theme', t); } catch {} }
    if (c === 'comments') sideMode === 'comments' ? closeSide() : openSide('comments');
    if (c === 'history') sideMode === 'history' ? closeSide() : openSide('history');
    if (c === 'find') openFind();
    if (c === 'fclose') $('#ed-find').hidden = true;
    if (c === 'fnext') findNext();
    if (c === 'freplace') replaceOne();
    if (c === 'freplall') replaceAll();
    if (c === 'export') menu(a, [['Word (.docx)', () => doExport('docx')], ['PDF', () => doExport('pdf')], ['Markdown (.md)', () => doExport('md')], ['HTML', () => doExport('html')]]);
    if (c === 'namemenu') menu(a, [['Rename', () => { $('#ed-title').focus(); $('#ed-title').select(); }], ['Version history', () => openSide('history')], ['Save version…', () => histAct('snap')], null, ['Export as Word', () => doExport('docx')], ['Export as Markdown', () => doExport('md')]]);
  });
  tray.addEventListener('dblclick', e => { const row = e.target.closest('.ed-tab'); if (row) tabAct('rename', secById(row.dataset.id), [], 0); });
  $('#ed-title').addEventListener('input', e => { DOC.dataset.title = e.target.value; document.title = 'Design Doc: ' + (e.target.value || 'Untitled'); markDirty(); });
  window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  $('#ed-title').value = DOC.dataset.title || document.title.replace(/^Design Doc:\s*/, '');
  if (!sections().length) { const s = document.createElement('section'); s.dataset.tab = 't1'; s.dataset.name = 'Tab 1'; s.dataset.order = 'a00'; s.innerHTML = '<h1>Untitled</h1><p><br></p>'; DOC.append(s); }
  activate(location.hash.slice(1), true);
  window.addEventListener('hashchange', () => secById(location.hash.slice(1)) && secById(location.hash.slice(1)) !== active && activate(location.hash.slice(1), true));
  stamp().then(s => { lastStamp = s; setInterval(poll, 1500); });
})();
