// Editor chrome for an HTML deck (Claude Slides style): filmstrip + grid view, slide management, inline text editing,
// insert text / image / table / shapes, click-to-select any element with move + resize, right-click menu, undo / redo,
// speaker notes under the slide, properties panel, shrink-to-fit text, present, zoom, save, export PDF / PPTX.
// Optional design system: a deck that loads a ds-*.js before this file (window.DECK_DS) gets its css, fonts, layouts and colours.
// The deck file holds only its slides; everything this script adds is marked data-chrome and stripped on save.
(() => {
  const LIBS = {
    html2canvas: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    pptx: 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js',
  };
  const DS = window.DECK_DS || null;
  const BASIC_COLORS = { Black: '#1d2433', Grey: '#6b7280', Light: '#f3f4f6', Blue: '#0057a8', Sky: '#4a90e2', Green: '#1e8e5a', Orange: '#f59e0b', Red: '#c0392b', White: '#ffffff' };
  const COLORS = DS?.colors || BASIC_COLORS;
  const DEF = DS?.defaults || { fill: '#dbe7f5', line: '#0057a8', text: '#1d2433' };
  const BLANK = '<h2 data-edit="">New slide title</h2><p data-edit="">Type your text here</p>';

  // Design system styles and fonts are injected each load (marked data-chrome, so a save never copies them into the deck).
  if (DS) {
    (DS.fonts || []).forEach(href => document.head.insertAdjacentHTML('beforeend', `<link rel="stylesheet" href="${href}" data-chrome>`));
    document.head.insertAdjacentHTML('beforeend', `<style data-chrome>.slide{width:${DS.width}px;height:${DS.height}px}${DS.css || ''}</style>`);
  }

  const stage = document.getElementById('stage');
  const slides = () => [...stage.querySelectorAll(':scope > .slide')];
  const sizeOf = el => [parseFloat(getComputedStyle(el).width) || 1280, parseFloat(getComputedStyle(el).height) || 720];
  const [W, H] = DS ? [DS.width, DS.height] : sizeOf(slides()[0]);
  const PX = W / 13.333, PT = 960 / W; // css px per inch / per point on a 13.333 x 7.5 in slide
  const U = W / 1280; // default sizes are written for a 1280-wide slide
  const file = decodeURIComponent(location.pathname.split('/').pop()) || 'deck.html';
  const base = file.replace(/\.html$/i, '');
  let i = Math.min(Math.max(parseInt(location.hash.slice(1)) - 1 || 0, 0), slides().length - 1);
  let dirty = false, zoom = 'fit', scale = 1, sel = [], editing = null;

  // --- pure helpers (no DOM; checked by scratch/bi-developer-deep/selfcheck.mjs, which cuts them out between the pure markers) ---
  // <pure>
  function makeHistory(cap) {
    const undo = [], redo = [];
    return {
      undo, redo,
      push(s) { undo.push(s); if (undo.length > cap) undo.shift(); redo.length = 0; }, // a new action ends the redo branch
      // Pops the newest snapshot that differs from cur; no-op steps (editing started, nothing typed) are skipped.
      back(cur) { while (undo.length && undo.at(-1).html === cur.html) undo.pop(); if (!undo.length) return null; redo.push(cur); return undo.pop(); },
      fwd(cur) { while (redo.length && redo.at(-1).html === cur.html) redo.pop(); if (!redo.length) return null; undo.push(cur); return redo.pop(); },
    };
  }
  const px = n => Math.round(n * 100) / 100 + 'px';
  const union = gs => {
    const l = Math.min(...gs.map(g => g.l)), t = Math.min(...gs.map(g => g.t));
    return { l, t, w: Math.max(...gs.map(g => g.l + g.w)) - l, h: Math.max(...gs.map(g => g.t + g.h)) - t };
  };
  // Box u after dragging handle `mode` (nw/ne/sw/se) or 'move' by dx, dy; width stops at 8, height at 4.
  function dragBox(u, mode, dx, dy) {
    const n = { ...u };
    if (mode === 'move') { n.l += dx; n.t += dy; return n; }
    if (mode.includes('e')) n.w = Math.max(8, u.w + dx);
    if (mode.includes('w')) { n.w = Math.max(8, u.w - dx); n.l = u.l + u.w - n.w; }
    if (mode.includes('s')) n.h = Math.max(4, u.h + dy);
    if (mode.includes('n')) { n.h = Math.max(4, u.h - dy); n.t = u.t + u.h - n.h; }
    return n;
  }
  // Where box g lands when the union box u becomes n (every member scales with the union).
  const scaleIn = (g, u, n) => {
    const sx = n.w / Math.max(u.w, 1), sy = n.h / Math.max(u.h, 1);
    return { l: n.l + (g.l - u.l) * sx, t: n.t + (g.t - u.t) * sy, w: g.w * sx, h: g.h * sy };
  };
  // Colour maths and checks for the toolbars. h 0-360, s / v / a 0-1, r g b 0-255.
  function hsv2rgb(h, s, v) {
    const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return [f(5), f(3), f(1)].map(x => Math.round(x * 255));
  }
  function rgb2hsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
    const h = d === 0 ? 0 : mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, mx === 0 ? 0 : d / mx, mx];
  }
  const hex2 = n => Math.round(n).toString(16).padStart(2, '0');
  const toHex = (r, g, b) => '#' + hex2(r) + hex2(g) + hex2(b); // lower case
  // '#abc', 'aabbcc', '#AABBCC' -> [r, g, b], else null
  function parseHex(s) {
    let m = String(s).trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(m)) m = m.split('').map(c => c + c).join('');
    return /^[0-9a-f]{6}$/i.test(m) ? [0, 2, 4].map(k => parseInt(m.slice(k, k + 2), 16)) : null;
  }
  // A computed colour ('rgb(0, 38, 84)' / 'rgba(0, 38, 84, 0.5)') -> [r, g, b, a], else null
  function parseCss(c) {
    const m = String(c).match(/[0-9.]+/g);
    return /^rgb/.test(c) && m && m.length >= 3 ? [+m[0], +m[1], +m[2], m.length > 3 ? +m[3] : 1] : null;
  }
  const rgbCss = (r, g, b, a) => a >= 0.995 ? toHex(r, g, b) : `rgba(${r}, ${g}, ${b}, ${Math.round(a * 100) / 100})`;
  // First colour of a computed gradient: 'linear-gradient(135deg, rgb(0, 38, 84), rgb(1, 2, 3))' -> 'rgb(0, 38, 84)'
  const gradFirst = bi => (bi && bi.includes('gradient') && (bi.match(/rgba?[(][^)]*[)]/) || [''])[0]) || '';
  // Only these link schemes are accepted.
  const isUrl = s => /^(https?:[/][/]|mailto:)[^ ]+$/i.test(String(s).trim());
  // The text style an element shows: its data-style when it names a known style, else the style with the same size and weight
  // (when several match, the one with the same colour first).
  function matchStyle(styles, name, size, weight, color) {
    const same = styles.filter(s => Math.round(s.size) === Math.round(size) && +s.weight === +weight);
    return styles.find(s => s.name === name) || same.find(s => color && s.color && s.color.toLowerCase() === color) || same[0] || null;
  }
  // </pure>
  const hist = makeHistory(100);

  // --- chrome ---
  const P = {
    chevron: '<path d="m6 9 6 6 6-6"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    table: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    shapes: '<rect x="3" y="10" width="11" height="11" rx="1"/><circle cx="16.5" cy="7.5" r="4.5"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M5 21h14"/>',
    play: '<path d="M7 4v16l13-8z"/>',
    panel: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    notes: '<path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2zM22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z"/>',
    single: '<rect x="5" y="5" width="14" height="14" rx="3"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16V5a2 2 0 0 1 2-2h11"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
    left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
    strip: '<rect x="2" y="4" width="20" height="12" rx="2"/><path d="M7 20h10"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>', lineh: '<path d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4"/>', letter: '<path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/>',
  };
  // Per-viewer UI preferences (theme, filmstrip size); the page works without them.
  const pref = (k, v) => { try { if (v === undefined) return localStorage.getItem('deck-ed:' + k); localStorage.setItem('deck-ed:' + k, v); } catch { return null; } };
  const root = document.documentElement;
  if (pref('theme') === 'light') root.dataset.theme = 'light';
  if (pref('strip-h')) root.style.setProperty('--strip-h', pref('strip-h') + 'px');
  const ic = (n, s = 18) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[n]}</svg>`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const layouts = DS?.layouts ? Object.entries(DS.layouts) : [];
  const addItems = layouts.length
    ? `<div class="lbl">${esc(DS.name)}</div>` + layouts.map(([k, l]) => `<button data-add="${k}">${esc(l.name)}</button>`).join('') + '<button data-add="">Blank</button>'
    : '<button data-add="">Blank slide</button>';

  document.body.insertAdjacentHTML('afterbegin', `
    <header id="ed-head" data-chrome>
      <div class="ed-menu"><button class="ed-title" data-menu><span>${esc(document.title)}</span>${ic('chevron', 16)}</button>
        <div class="items">
          <button data-cmd="save">Save <kbd>Ctrl+S</kbd></button>
          <button data-cmd="pdf">Export PDF</button>
          <button data-cmd="pptx">Export PowerPoint</button>
          <button data-cmd="present">Present <kbd>F5</kbd></button>
        </div></div>
      ${DS ? `<span class="ed-ds" title="Design system">${esc(DS.name)}</span>` : ''}
      <span class="grow"></span>
      <span id="ed-status"></span>
      <button class="ed-ib" data-cmd="theme" title="Light / dark mode"><span class="ed-sun">${ic('sun')}</span><span class="ed-moon">${ic('moon')}</span></button>
      <button id="ed-save" data-cmd="save">Save</button>
    </header>
    <div id="ed-tools-l" class="ed-group" data-chrome>
      <button data-cmd="text" title="Text box"><span class="ed-txt">T</span></button>
      <button data-cmd="image" title="Image">${ic('image')}</button>
      <button data-cmd="table" title="Table">${ic('table')}</button>
      <div class="ed-menu"><button data-menu title="Shapes">${ic('shapes')}${ic('chevron', 14)}</button>
        <div class="items">
          <button data-cmd="rect">Rectangle</button><button data-cmd="round">Rounded rectangle</button>
          <button data-cmd="ellipse">Ellipse</button><button data-cmd="line">Line</button>
        </div></div>
    </div>
    <div id="ed-tools-r" class="ed-group" data-chrome>
      <div class="ed-menu"><button data-menu id="ed-dl" title="Download">${ic('download')}</button>
        <div class="items right"><button data-cmd="pdf">PDF (.pdf)</button><button data-cmd="pptx">PowerPoint (.pptx)</button></div></div>
      <button data-cmd="present" title="Present (F5)">${ic('play')}</button>
      <button data-cmd="panel" id="ed-pp" title="Show properties">${ic('panel')}</button>
      <div class="ed-menu"><button data-menu id="ed-zoom">100%${ic('chevron', 14)}</button>
        <div class="items right"><button data-zoom="fit">Fit</button><button data-zoom="0.25">25%</button><button data-zoom="0.5">50%</button><button data-zoom="0.75">75%</button><button data-zoom="1">100%</button></div></div>
    </div>
    <aside id="ed-panel" data-chrome><div class="pp-head"><b id="pp-title">Slide</b><button class="pp-x" data-cmd="panel" title="Close">${ic('x', 16)}</button></div><div id="pp-body"></div></aside><div id="ed-notesbox" data-chrome><div id="ed-nresize" title="Drag to resize"></div><textarea id="ed-notes" placeholder="Speaker notes"></textarea></div>
    <div id="ed-grid" data-chrome></div>
    <div id="ed-pill" data-chrome>
      <button data-cmd="prev" title="Previous">${ic('left', 16)}</button><span id="ed-pos"></span><button data-cmd="next" title="Next">${ic('right', 16)}</button>
      <span class="ed-sep"></span>
      <button data-cmd="notes" title="Show speaker notes">${ic('notes', 16)}</button>
      <button data-cmd="strip" title="Show filmstrip">${ic('strip', 16)}</button>
    </div>
    <footer id="ed-strip" data-chrome>
      <div id="ed-resize" title="Drag to resize"></div>
      <div class="bar">
        <div class="ed-menu"><button data-menu title="New slide">${ic('plus')}</button><div class="items up">${addItems}</div></div>
        <button data-cmd="notes" title="Show speaker notes">${ic('notes')}</button>
        <span class="grow"></span>
        <div class="ed-seg"><button data-view="single" title="Single slide">${ic('single', 16)}</button><button data-view="grid" title="Grid view">${ic('grid', 16)}</button></div>
        <button data-cmd="strip" title="Hide filmstrip">${ic('chevron')}</button>
      </div>
      <div id="ed-thumbs"></div>
    </footer>
    <div id="ed-ctx" data-chrome></div>
    <div id="ed-tb" data-chrome></div><div id="ed-pop" data-chrome></div>
    <input type="file" id="ed-file" accept="image/*" hidden data-chrome>`.trim().replace(/>\s+</g, '><')); // no stray text nodes left behind on save
  const $ = id => document.getElementById(id);
  const status = t => { $('ed-status').textContent = t; };
  const markDirty = () => { dirty = true; $('ed-save').classList.add('dirty'); status('Unsaved changes'); };
  const presenting = () => document.body.classList.contains('presenting');

  // --- view ---
  function fit() {
    const r = stage.getBoundingClientRect();
    const pad = presenting() ? 0 : 48;
    const f = Math.min((r.width - pad) / W, (r.height - pad / 2) / H);
    scale = zoom === 'fit' || presenting() ? f : +zoom;
    slides().forEach(el => el.style.zoom = scale);
    $('ed-zoom').firstChild.textContent = Math.round(scale * 100) + '%';
    drawSel();
  }
  function show(n) {
    const all = slides();
    i = Math.min(Math.max(n, 0), all.length - 1);
    all.forEach((el, k) => el.classList.toggle('active', k === i));
    if (!presenting()) history.replaceState(null, '', '#' + (i + 1));
    $('ed-pos').textContent = `${i + 1} / ${all.length}`;
    [$('ed-thumbs'), $('ed-grid')].forEach(box => [...box.children].forEach((t, k) => t.classList.toggle('active', k === i)));
    $('ed-thumbs').children[i]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    $('ed-notes').value = all[i]?.querySelector(':scope > aside.notes')?.textContent || '';
    select(null);
  }
  function setView(v) {
    document.body.classList.toggle('view-grid', v === 'grid');
    document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === v));
    buildThumbs(); tbPlace();
  }

  // A copy of a slide with no editor state, for thumbnails and export.
  function cleanClone(s, keep) {
    const c = s.cloneNode(true);
    c.querySelectorAll('[data-chrome]').forEach(n => n.remove());
    c.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
    c.style.removeProperty('zoom');
    c.classList.remove('active');
    if (!keep) unfitIn(c); // the snapshot / saved / exported copy keeps the authored sizes
    if (!c.getAttribute('style')) c.removeAttribute('style');
    return c;
  }

  // Thumbnails (filmstrip, and grid view when open) are scaled clones of the live slides, rebuilt after edits.
  let dragFrom = -1;
  function thumbsInto(box, tw) {
    box.innerHTML = '';
    slides().forEach((s, k) => {
      const t = document.createElement('div');
      t.className = 'ed-thumb' + (k === i ? ' active' : '');
      t.style.width = tw + 4 + 'px'; t.style.height = tw * H / W + 4 + 'px';
      t.draggable = true;
      t.innerHTML = `<span class="num">${k + 1}</span><div class="tools"><button data-act="dup" title="Duplicate (Ctrl+D)">${ic('copy', 13)}</button><button data-act="del" title="Delete">${ic('trash', 13)}</button></div>`;
      const c = cleanClone(s, true); // thumbnails keep the shrunk look of the live slide
      c.style.zoom = tw / W;
      t.appendChild(c);
      t.onclick = e => { const act = e.target.closest('[data-act]')?.dataset.act; if (act) return manage(act, k); show(k); if (box.id === 'ed-grid') setView('single'); };
      t.ondragstart = () => { dragFrom = k; t.classList.add('dragging'); };
      t.ondragend = () => t.classList.remove('dragging');
      t.ondragover = e => { e.preventDefault(); t.classList.add('drop'); };
      t.ondragleave = () => t.classList.remove('drop');
      t.ondrop = e => { e.preventDefault(); t.classList.remove('drop'); if (dragFrom >= 0 && dragFrom !== k) move(dragFrom, k); dragFrom = -1; };
      box.appendChild(t);
    });
  }
  function buildThumbs() {
    // Filmstrip thumbnails follow the strip height (strip minus its bar and padding).
    const h = $('ed-strip').clientHeight - 44 - 18;
    if (h > 0) thumbsInto($('ed-thumbs'), Math.max(80, Math.round(h * W / H)));
    if (document.body.classList.contains('view-grid')) thumbsInto($('ed-grid'), 280);
  }
  let thumbTimer;
  const refreshThumbs = () => { clearTimeout(thumbTimer); thumbTimer = setTimeout(buildThumbs, 400); };

  function numberPages() {
    slides().forEach((s, k) => s.querySelectorAll('[data-page-number]').forEach(el => { el.textContent = k + 1; }));
  }

  // --- slide management ---
  function afterChange(next) {
    numberPages(); fitAll(); markDirty(); buildThumbs(); fit(); show(next);
  }
  function move(from, to) {
    const all = slides();
    if (to < 0 || to >= all.length || from === to) return;
    record();
    all[to].insertAdjacentElement(from < to ? 'afterend' : 'beforebegin', all[from]);
    afterChange(to);
  }
  function manage(act, k) {
    const all = slides(), s = all[k];
    if (act === 'dup') { record(); const c = cleanClone(s); s.after(c); afterChange(k + 1); }
    else if (act === 'del') {
      if (all.length === 1) return status('A deck needs at least one slide');
      record();
      s.remove(); afterChange(Math.min(k, all.length - 2));
      status(`Slide ${k + 1} deleted (not saved yet)`);
    }
  }
  function addSlide(layout) {
    record();
    const s = document.createElement('section');
    s.className = 'slide';
    s.innerHTML = layout ? DS.layouts[layout].html.trim() : BLANK;
    if (layout) s.dataset.layout = layout;
    (slides()[i] || stage.lastElementChild).after(s);
    afterChange(i + 1);
  }

  // --- insert, select, move, resize ---
  function insert(kind) {
    const sl = slides()[i];
    if (!sl) return;
    record();
    const box = (w, h) => `position:absolute;left:${Math.round((W - w) / 2)}px;top:${Math.round((H - h) / 2)}px;width:${Math.round(w)}px;${h ? `height:${Math.round(h)}px;` : ''}`;
    let el;
    if (kind === 'text') {
      el = document.createElement('div');
      el.setAttribute('style', box(480 * U, 0) + `font-size:${28 * U}px;line-height:1.3;color:${DEF.text};`);
      el.dataset.edit = ''; el.textContent = 'Type something';
    } else if (kind === 'table') {
      el = document.createElement('table');
      el.setAttribute('style', box(640 * U, 0) + `border-collapse:collapse;font-size:${20 * U}px;color:${DEF.text};`);
      const cell = (tag, txt, head) => `<${tag} data-edit="" style="padding:${10 * U}px ${14 * U}px;text-align:left;border-bottom:1px solid #c3cbd8;${head ? `background:${DEF.text};color:#fff;font-weight:700;` : ''}">${txt}</${tag}>`;
      el.innerHTML = '<tbody>' + [0, 1, 2].map(r => '<tr>' + [1, 2, 3].map(c => cell(r ? 'td' : 'th', r ? '' : 'Header ' + c, !r)).join('') + '</tr>').join('') + '</tbody>';
    } else if (kind === 'line') {
      el = document.createElement('div');
      el.setAttribute('style', box(320 * U, 4 * U) + `background:${DEF.line};`);
    } else {
      el = document.createElement('div');
      const radius = kind === 'round' ? `${16 * U}px` : kind === 'ellipse' ? '50%' : '0';
      el.setAttribute('style', box(kind === 'ellipse' ? 200 * U : 280 * U, 200 * U) + `background:${DEF.fill};border-radius:${radius};`);
    }
    el.classList.add('ed-free');
    sl.appendChild(el);
    afterInsert(el);
  }
  function insertImage(src) {
    const img = new Image();
    img.onload = () => {
      const w = Math.min(560 * U, img.naturalWidth), h = w * img.naturalHeight / img.naturalWidth;
      img.className = 'ed-free'; img.alt = '';
      img.setAttribute('style', `position:absolute;left:${Math.round((W - w) / 2)}px;top:${Math.round((H - h) / 2)}px;width:${Math.round(w)}px;height:${Math.round(h)}px;object-fit:contain;`);
      record();
      slides()[i].appendChild(img);
      afterInsert(img);
    };
    img.src = src;
  }
  function afterInsert(el) { markDirty(); select(el); refreshThumbs(); }

  // --- selection model ---
  // sel = array of selected elements: one slide, or one or more leaves of the current slide. Other code reads it through
  // window.DeckEditor.selection and subscribes with DeckEditor.onSelectionChange.push(fn).
  const TEXT = 'h1, h2, h3, h4, h5, h6, p, ul, ol, [data-edit]';
  const PICK = TEXT + ', img, svg, canvas, td, th, table';
  const PAINT_TAGS = 'div, section, article, figure, aside, header, footer, main, nav';
  const TEXT_PROPS = ['font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'color', 'text-align', 'text-transform'];
  const LIST_PROPS = ['display', 'flex-direction', 'row-gap', 'padding-left', 'list-style-type']; // class rules a list loses when it leaves its parent
  const listeners = [];
  const slideOf = el => el.closest('.slide');
  const kindOf = el => el.classList.contains('slide') ? 'slide' : el.matches('[data-group]') ? 'group' : el.matches('img, svg, canvas') ? 'img'
    : el.matches('td, th') ? 'cell' : el.nodeName === 'TABLE' ? 'table' : el.matches(TEXT) ? 'text' : 'shape';
  const editable = el => ['text', 'cell'].includes(kindOf(el));
  const movable = el => !['slide', 'cell'].includes(kindOf(el)) && !el.parentElement.closest('[data-group]');
  // A full-bleed background picture (e.g. .tu-bg) is never picked; a click on it selects the slide.
  const bleed = el => el.matches('img') && el.offsetWidth >= slideOf(el).offsetWidth * 0.98 && el.offsetHeight >= slideOf(el).offsetHeight * 0.98;
  function painted(el) {
    const cs = getComputedStyle(el);
    const edge = ['Top', 'Right', 'Bottom', 'Left'].some(s => parseFloat(cs['border' + s + 'Width']) > 0 && cs['border' + s + 'Style'] !== 'none');
    return !clear(cs.backgroundColor) || cs.backgroundImage !== 'none' || cs.boxShadow !== 'none' || edge;
  }
  // The leaf under the pointer: innermost text / image / cell / painted box, or the outermost [data-group] above it (unless deep), else the slide.
  function pick(t, deep) {
    const s = t.closest('.slide');
    if (!s) return null;
    let leaf = null, group = null;
    for (let el = t; el && el !== s; el = el.parentElement) {
      if (el.matches('[data-group]')) group = el;
      if (!leaf && (el.matches(PICK) || (el.matches(PAINT_TAGS) && painted(el))) && !bleed(el)) leaf = el;
    }
    return (!deep && group) || leaf || s;
  }
  // Box of el in unscaled slide pixels; the slide carries a CSS zoom, so rects are divided by the zoom measured on the slide itself.
  function geom(el) {
    const s = slideOf(el), o = s.getBoundingClientRect(), r = el.getBoundingClientRect(), k = o.width / s.offsetWidth || 1;
    return { l: (r.left - o.left) / k, t: (r.top - o.top) / k, w: r.width / k, h: r.height / k };
  }
  function setSel(list) {
    if (editing && (list.length !== 1 || list[0] !== editing)) stopEdit(); // editing belongs to a lone selected element
    if (list.length !== sel.length || list.some((el, k) => el !== sel[k])) { closePop(); lastKey = ''; }
    sel = list; drawSel();
    listeners.forEach(fn => fn(sel.map(el => ({ el, kind: kindOf(el) }))));
  }
  const select = el => setSel(el ? [].concat(el) : []);

  // Outline per selected element; the handles sit on the single movable element, or on the union box of several.
  function drawSel() {
    stage.querySelectorAll('.ed-sel').forEach(n => n.remove());
    sel = sel.filter(el => el.isConnected);
    fitSlide(slides()[i]); ppRefresh();
    if (!sel.length || presenting()) return tbPlace();
    const host = slideOf(sel[0]), mv = sel.filter(movable);
    const frame = (g, handles) => {
      const o = document.createElement('div');
      o.className = 'ed-sel'; o.dataset.chrome = '';
      o.style.cssText = `left:${g.l}px;top:${g.t}px;width:${g.w}px;height:${g.h}px;--h:${10 / scale}px;border-width:${2 / scale}px`;
      if (handles) o.innerHTML = ['nw', 'ne', 'sw', 'se'].map(d => `<i data-h="${d}"></i>`).join('');
      host.appendChild(o);
    };
    sel.forEach(el => frame(kindOf(el) === 'slide' ? { l: 0, t: 0, w: host.offsetWidth, h: host.offsetHeight } : geom(el), mv.length === 1 && el === mv[0]));
    if (mv.length > 1) frame(union(mv.map(geom)), true);
    tbPlace();
  }

  // --- text editing: only one element is contenteditable at a time ---
  function caretAt(el, x, y) {
    let r = document.caretRangeFromPoint?.(x, y);
    if (!r && document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); if (p) { r = document.createRange(); r.setStart(p.offsetNode, p.offset); } }
    if (!r || !el.contains(r.startContainer)) { r = document.createRange(); r.selectNodeContents(el); r.collapse(false); } // click missed the text: caret at the end
    r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function startEdit(el, x, y) {
    if (editing === el || !editable(el)) return;
    stopEdit(); record(); // one undo step per editing session
    editing = el;
    el.setAttribute('contenteditable', 'true'); el.focus({ preventScroll: true });
    caretAt(el, x, y);
  }
  function stopEdit() {
    const el = editing;
    if (!el) return;
    editing = null; // first, so the focusout this triggers does nothing
    el.removeAttribute('contenteditable'); el.blur(); getSelection().removeAllRanges();
  }

  // --- pin, move, resize ---
  // Class rules that style text may not follow the element to a new parent, so the computed values are written inline first.
  function freezeText(el) {
    unfitText(); // freeze the authored sizes, not the shrunk ones
    const cs = getComputedStyle(el);
    [...TEXT_PROPS, ...(el.matches('ul, ol') ? LIST_PROPS : [])].forEach(p => el.style.setProperty(p, cs.getPropertyValue(p)));
  }
  // Freezes box g (pixels relative to host) onto el as position:absolute and moves el into host (before ref, else at the end).
  function place(el, g, host, hasH, ref = null) {
    const flow = el.isConnected && getComputedStyle(el).position !== 'absolute'; // a flow element is pinned to the end of the host even when it already sits in it
    if (flow || el.parentElement !== host) { if (el.isConnected) freezeText(el); host.insertBefore(el, ref); }
    Object.assign(el.style, { position: 'absolute', left: px(g.l), top: px(g.t), width: px(g.w), right: 'auto', bottom: 'auto', margin: '0', boxSizing: 'border-box' });
    if (hasH) el.style.height = px(g.h); // text keeps an automatic height so it can grow
  }
  const isPinned = el => el.parentElement === slideOf(el) && el.style.position === 'absolute' && !!el.style.left && !!el.style.top && !!el.style.width;
  // Pins every element of the list from boxes read BEFORE the first one moves (pinning reflows the siblings).
  function pinAll(list) {
    const gs = list.map(geom);
    list.forEach((el, k) => isPinned(el) || place(el, gs[k], slideOf(el), kindOf(el) !== 'text'));
    return gs;
  }
  // via = the table to move when the press was on a cell (cells are not movable themselves, and a table is mostly cells).
  function startDrag(e, mode, editEl, via) {
    const x0 = e.clientX, y0 = e.clientY;
    let els = sel.filter(movable);
    let moved = false, gs, u;
    const mv = ev => {
      if (!moved) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 3) return;
        if (via) { setSel([via]); els = [via]; }
        if (!els.length) return;
        moved = true; stopEdit(); record(); // snapshot of the state before the first pixel moves
        tbBusy = true; tbPlace(); // the toolbar hides while an element moves or resizes
        gs = pinAll(els); u = union(gs);
      }
      const n = dragBox(u, mode, (ev.clientX - x0) / scale, (ev.clientY - y0) / scale);
      els.forEach((el, k) => {
        const g = scaleIn(gs[k], u, n);
        el.style.left = px(g.l); el.style.top = px(g.t);
        if (mode !== 'move') { el.style.width = px(g.w); el.style.height = px(g.h); }
      });
      drawSel();
    };
    const up = ev => {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      if (moved) { tbBusy = false; markDirty(); refreshThumbs(); drawSel(); }
      else if (editEl && ev.type === 'pointerup') startEdit(editEl, ev.clientX, ev.clientY); // click on an already selected text edits it
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }
  let lastNudge = 0;
  function nudge(els, dx, dy) {
    if (Date.now() - lastNudge > 800) record(); // a held arrow key is one undo step
    lastNudge = Date.now();
    pinAll(els.filter(el => !isPinned(el)));
    els.forEach(el => { el.style.left = px(parseFloat(el.style.left) + dx); el.style.top = px(parseFloat(el.style.top) + dy); });
    drawSel(); markDirty(); refreshThumbs();
  }
  stage.addEventListener('pointerdown', e => {
    if (presenting() || e.button === 1) return;
    const h = e.target.closest('.ed-sel i');
    if (h && sel.length) { e.preventDefault(); stopEdit(); return startDrag(e, h.dataset.h); }
    if (editing && editing.contains(e.target)) return; // caret and text selection inside the text being edited
    const t = pick(e.target);
    if (!t) return setSel([]); // grey area around the slide
    if (e.shiftKey && e.button === 0) { // add / remove; a slide never joins a multi-selection
      e.preventDefault();
      const rest = sel.filter(x => x !== t && kindOf(x) !== 'slide');
      return setSel(sel.includes(t) || kindOf(t) === 'slide' ? rest : [...rest, t]);
    }
    const was = sel.length === 1 && sel[0] === t;
    if (!sel.includes(t)) setSel([t]); // pressing a member keeps a multi-selection so it can be dragged together
    if (e.button !== 0) return; // right button: the context menu follows
    e.preventDefault(); document.activeElement?.blur?.();
    startDrag(e, 'move', was ? t : null, kindOf(t) === 'cell' ? t.closest('table') : null);
  });
  stage.addEventListener('dblclick', e => {
    const t = !presenting() && pick(e.target, true); // deep: text inside a group can be edited too
    if (t && editable(t)) { setSel([t]); startEdit(t, e.clientX, e.clientY); }
  });
  stage.addEventListener('dragstart', e => e.preventDefault()); // a picture must move with the pointer, not start a native drag
  stage.addEventListener('focusout', e => { if (e.target === editing && !e.relatedTarget?.closest?.('#ed-pop, #ed-tb')) stopEdit(); }); // a popover input may take focus while the text stays in edit mode

  // --- undo / redo: snapshots of the cleaned slides (same cleaning as save) + the slide index ---
  const stageHtml = () => slides().map(s => cleanClone(s).outerHTML).join('');
  const snap = () => ({ html: stageHtml(), i });
  function record() { hist.push(snap()); } // call BEFORE a mutation
  function restore(s) {
    setSel([]); stage.innerHTML = s.html;
    afterChange(s.i);
  }
  function undo() { const s = hist.back(snap()); s ? restore(s) : status('Nothing to undo'); }
  function redo() { const s = hist.fwd(snap()); s ? restore(s) : status('Nothing to redo'); }

  // --- clipboard, order, group, delete ---
  let clip = null; // internal clipboard { items: [{ html, g, k }], n }; html is a cleaned copy with its text styles frozen
  const ops = () => sel.filter(el => !['slide', 'cell'].includes(kindOf(el))); // elements the edit actions work on
  const byDom = (a, b) => a.compareDocumentPosition(b) & 4 ? -1 : 1;
  function copyOf(el) {
    const c = el.cloneNode(true), cs = getComputedStyle(el);
    c.querySelectorAll('[data-chrome]').forEach(n => n.remove());
    [c, ...c.querySelectorAll('[contenteditable]')].forEach(n => n.removeAttribute('contenteditable'));
    TEXT_PROPS.forEach(p => c.style.setProperty(p, cs.getPropertyValue(p)));
    return { html: c.outerHTML, g: geom(el), k: kindOf(el) };
  }
  function paste(items, n) { // pinned copies land n x 24px down-right of where they were copied from
    const sl = slides()[i];
    if (!sl || !items.length) return;
    record();
    const made = items.map(it => {
      const t = document.createElement('template');
      t.innerHTML = it.html.trim();
      const el = t.content.firstElementChild;
      place(el, { ...it.g, l: it.g.l + 24 * n, t: it.g.t + 24 * n }, sl, it.k !== 'text');
      return el;
    });
    markDirty(); select(made); refreshThumbs();
  }
  function del() { record(); ops().forEach(el => el.remove()); setSel([]); markDirty(); refreshThumbs(); }
  function reorder(front) {
    const els = ops().sort(byDom);
    record();
    els.forEach(el => {
      const p = el.parentElement;
      const ref = front ? null : [...p.children].find(c => !els.includes(c) && !c.matches('[data-chrome]') && !bleed(c)); // back = first child after any full-bleed picture
      p.insertBefore(el, ref || null);
    });
    markDirty(); drawSel(); refreshThumbs();
  }
  const canGroup = () => ops().length > 1 && ops().every(el => el.parentElement === slideOf(el) && getComputedStyle(el).position === 'absolute');
  function group() {
    const els = ops().sort(byDom), gs = els.map(geom), u = union(gs);
    record();
    const g = document.createElement('div');
    g.dataset.group = '';
    g.setAttribute('style', `position:absolute;left:${px(u.l)};top:${px(u.t)};width:${px(u.w)};height:${px(u.h)};`);
    els.at(-1).after(g); // the group takes the z-order of its top member
    els.forEach((el, k) => place(el, { l: gs[k].l - u.l, t: gs[k].t - u.t, w: gs[k].w, h: gs[k].h }, g, kindOf(el) !== 'text'));
    markDirty(); select(g); refreshThumbs();
  }
  function ungroup() {
    const groups = sel.filter(el => el.matches('[data-group]')), out = [];
    record();
    groups.forEach(g => {
      const kids = [...g.children].filter(c => !c.matches('[data-chrome]')), gs = kids.map(geom);
      kids.forEach((k, j) => place(k, gs[j], slideOf(g), kindOf(k) !== 'text', g));
      out.push(...kids); g.remove();
    });
    markDirty(); select(out); refreshThumbs();
  }
  async function copyLink() {
    const url = location.href.split('#')[0] + '#' + (i + 1);
    try { await navigator.clipboard.writeText(url); }
    catch { // no clipboard permission in some hosts: fall back to a temporary textarea
      const t = Object.assign(document.createElement('textarea'), { value: url });
      t.dataset.chrome = ''; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
    status('Link copied: ' + url);
  }
  // Every action: on() says whether it applies to the current selection, run() does it. Menu and shortcuts share this table.
  const copies = () => asAuthored(() => ops().map(copyOf));
  const copy = () => { clip = { items: copies(), n: 0 }; status(`Copied ${clip.items.length} element(s)`); };
  const ACT = {
    cut: { on: () => ops().length, run: () => { copy(); del(); } },
    copy: { on: () => ops().length, run: copy },
    link: { on: () => true, run: copyLink },
    paste: { on: () => clip, run: () => paste(clip.items, ++clip.n) },
    dup: { on: () => ops().length, run: () => paste(copies(), 1) },
    front: { on: () => ops().length, run: () => reorder(true) },
    back: { on: () => ops().length, run: () => reorder(false) },
    group: { on: canGroup, run: group },
    ungroup: { on: () => sel.some(el => el.matches('[data-group]')), run: ungroup },
    del: { on: () => ops().length, run: del },
  };
  const exec = id => { if (!ACT[id].on()) return false; ACT[id].run(); return true; };

  // --- context menu ---
  const MENU = [['cut', 'Cut', 'Ctrl+X'], ['copy', 'Copy', 'Ctrl+C'], ['link', 'Copy link to slide', 'Ctrl+Alt+L'], ['paste', 'Paste', 'Ctrl+V'], ['dup', 'Duplicate', 'Ctrl+D'], null,
    ['front', 'Bring to front', ']'], ['back', 'Send to back', '['], ['group', 'Group', 'Ctrl+G'], ['ungroup', 'Ungroup', 'Ctrl+Shift+G'], null, ['del', 'Delete', 'Del']];
  const menuOpen = () => $('ed-ctx').style.display === 'block';
  const closeMenu = () => { $('ed-ctx').style.display = 'none'; };
  function openMenu(x, y) {
    const m = $('ed-ctx');
    m.innerHTML = MENU.map(r => r ? `<button data-ctx="${r[0]}"${ACT[r[0]].on() ? '' : ' disabled'}><span>${r[1]}</span><kbd>${r[2]}</kbd></button>` : '<hr>').join('');
    m.style.display = 'block';
    m.style.left = Math.max(4, Math.min(x, innerWidth - m.offsetWidth - 4)) + 'px'; // keep the menu on screen
    m.style.top = Math.max(4, Math.min(y, innerHeight - m.offsetHeight - 4)) + 'px';
  }
  stage.addEventListener('contextmenu', e => {
    if (presenting() || (editing && editing.contains(e.target))) return; // the browser menu stays while typing
    e.preventDefault();
    const t = pick(e.target);
    if (!t) return closeMenu();
    if (!sel.includes(t)) setSel([t]);
    openMenu(e.clientX, e.clientY);
  });
  document.addEventListener('pointerdown', e => { if (!e.target.closest('#ed-ctx')) closeMenu(); }, true);
  $('ed-ctx').addEventListener('click', e => {
    const b = e.target.closest('[data-ctx]');
    if (b && !b.disabled) { closeMenu(); exec(b.dataset.ctx); }
  });
  window.addEventListener('blur', closeMenu);
  stage.addEventListener('click', e => { if (presenting()) show(i + (e.clientX < innerWidth / 4 ? -1 : 1)); });

  // --- floating toolbars ---
  // One toolbar floats above the primary (last) selected element: text, box or table-cell tools. Popovers open under it (#ed-pop).
  // Every edit goes through change(); a slider or colour drag passes a key so its ticks merge into one undo step.
  Object.assign(P, {
    bold: '<path d="M7 4h6a4 4 0 0 1 0 8H7zM7 12h7a4 4 0 0 1 0 8H7z"/>', italic: '<path d="M19 4h-9M14 20H5M15 4 9 20"/>',
    underline: '<path d="M6 4v7a6 6 0 0 0 12 0V4M4 21h16"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    list: '<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    aleft: '<path d="M3 6h18M3 12h12M3 18h16"/>', acenter: '<path d="M3 6h18M6 12h12M4 18h16"/>', aright: '<path d="M3 6h18M9 12h12M5 18h16"/>', ajustify: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14"/>', radius: '<path d="M4 20V10a6 6 0 0 1 6-6h10"/>',
    spacing: '<rect x="3" y="3" width="18" height="18" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>', check: '<path d="m5 12 5 5 9-10"/>',
    eye: '<path d="m2 22 1-1h3l9-9M3 21v-3l9-9M15 6l3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3z"/>',
  });
  const DOT = String.fromCharCode(183);
  const BOX_KINDS = ['shape', 'group', 'img', 'slide', 'table'];
  const FMT = { bold: ['bold', 'fontWeight', '700', '400'], italic: ['italic', 'fontStyle', 'italic', 'normal'], underline: ['underline', 'textDecoration', 'underline', 'none'] };
  let tbBusy = false, tbLast = '', pop = null, savedRange = null, lastKey = '', lastAt = 0;
  const primary = () => sel.at(-1);
  const csOf = el => getComputedStyle(el);
  const targetsOf = kinds => sel.filter(el => kinds.includes(kindOf(el)));
  function change(fn, key) {
    const merge = key && key === lastKey && Date.now() - lastAt < 800;
    lastKey = key || ''; lastAt = Date.now();
    if (!merge) record(); unfitText();
    fn(); markDirty(); drawSel(); refreshThumbs();
  }
  const hexOf = c => { const p = parseCss(c || ''); return p && p[3] > 0 ? toHex(p[0], p[1], p[2]) : ''; };
  const fillOf = el => { const cs = csOf(el); return cs.backgroundImage.includes('gradient') ? cs.backgroundImage : clear(cs.backgroundColor) ? '' : cs.backgroundColor; };
  const bleedImg = s => [...s.children].find(c => c.matches('img') && (bleed(c) || c.dataset.bgOff !== undefined));
  const alignOf = el => ({ start: 'left', end: 'right' }[csOf(el).textAlign] || csOf(el).textAlign);
  const alignIcon = el => 'a' + (['center', 'right', 'justify'].includes(alignOf(el)) ? alignOf(el) : 'left');

  // text styles: the design system's, else five built-ins scaled to the slide width
  const TS_GROUPS = DS?.textStyles || [{ group: 'Text', items: [['Title', 64, 700], ['Heading', 44, 600], ['Subheading', 32, 600], ['Body', 28, 400], ['Caption', 20, 400]].map(([name, size, weight]) => ({ name, size: Math.round(size * U), weight })) }];
  const TS = TS_GROUPS.flatMap(g => g.items);
  const dsFonts = (DS?.fonts || []).map(h => (/family=([^:&]+)/.exec(h) || [])[1]).filter(Boolean).map(f => f.replace(/[+]/g, ' '));
  const FONTS = [...dsFonts.map(f => [f, `'${f}', 'Leelawadee UI', Arial, sans-serif`]), ['Sans-serif', 'Arial, sans-serif'], ['Serif', 'Georgia, serif'], ['Monospace', 'Consolas, monospace']];
  const WEIGHTS = [[300, 'Light'], [400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold'], [800, 'Extra bold']];
  const famOf = el => csOf(el).fontFamily.split(',')[0].replace(/["']/g, '').trim();
  const styleOf = el => asAuthored(() => styleRaw(el)); // styleRaw: see the panel section

  // selected text range while editing (live, or the one saved when a popover took focus)
  function rangeNow() {
    if (!editing) return null;
    const s = getSelection();
    if (s.rangeCount && !s.isCollapsed && editing.contains(s.anchorNode) && editing.contains(s.focusNode)) return s.getRangeAt(0);
    return savedRange && !savedRange.collapsed && editing.contains(savedRange.commonAncestorContainer) ? savedRange : null;
  }
  function withRange(fn) {
    const r = rangeNow(), s = getSelection(), ae = document.activeElement, away = ae?.closest?.('#ed-pop'); // away: a popover input has the focus and keeps it
    if (!away) editing.focus({ preventScroll: true });
    s.removeAllRanges(); s.addRange(r);
    fn();
    if (s.rangeCount) savedRange = s.getRangeAt(0).cloneRange();
    if (away) ae.focus({ preventScroll: true });
  }
  const isOn = (el, id) => {
    if (rangeNow()) return document.queryCommandState(FMT[id][0]);
    const cs = csOf(el);
    return id === 'bold' ? +cs.fontWeight >= 600 : id === 'italic' ? cs.fontStyle === 'italic' : cs.textDecorationLine.includes('underline');
  };
  const linkAt = el => {
    const n = editing === el && getSelection().anchorNode;
    return (n && (n.nodeType === 1 ? n : n.parentElement).closest('a[href]')) || el.querySelector('a[href]');
  };

  // --- toolbar markup ---
  const SEP = '<span class="ed-sep"></span>';
  const TT = '<span class="ed-tt">T<small>T</small></span>';
  const tbBtn = (id, icon, title, on) => `<button data-tb="${id}" title="${esc(title)}"${on ? ' class="on"' : ''}>${icon}</button>`;
  const swBtn = (id, title, css) => `<button data-tb="${id}" title="${esc(title)}"><i class="ed-sw${css ? '' : ' none'}" style="background:${esc(css || '')}"></i></button>`;
  const moreBtn = tbBtn('more', ic('more', 16), 'More options');
  const alignBtn = (el, title) => tbBtn('align', ic(alignIcon(el), 16) + ic('chevron', 12), title);
  function tbHtml(el) {
    const k = kindOf(el), cs = csOf(el);
    if (k === 'text') {
      const { s, size } = styleOf(el);
      return `<button class="ed-tbs" data-tb="style" title="Text style">${TT}<span>${esc(s ? s.name : 'Custom ' + DOT + ' ' + size)}</span>${ic('chevron', 14)}</button>` + SEP
        + swBtn('tcolor', 'Text colour', cs.color) + tbBtn('bold', ic('bold', 16), 'Bold (Ctrl+B)', isOn(el, 'bold')) + tbBtn('italic', ic('italic', 16), 'Italic (Ctrl+I)', isOn(el, 'italic'))
        + tbBtn('underline', ic('underline', 16), 'Underline (Ctrl+U)', isOn(el, 'underline')) + tbBtn('link', ic('link', 16), 'Link', !!linkAt(el)) + SEP
        + tbBtn('list', ic('list', 16), 'Bullet list', el.matches('ul, ol')) + alignBtn(el, 'Align') + SEP + moreBtn;
    }
    if (k === 'cell') {
      const t = el.closest('table');
      return `<button class="ed-tbs" data-tb="font" title="Font and size">${TT}<span>${esc(famOf(t) + ' ' + DOT + ' ' + Math.round(parseFloat(csOf(t).fontSize)))}</span>${ic('chevron', 14)}</button>` + SEP
        + swBtn('tcolor', 'Text colour', cs.color) + swBtn('rowfill', 'Row fill', fillOf(el)) + alignBtn(el, 'Align column') + SEP
        + tbBtn('radius', ic('radius', 16), 'Corner radius') + tbBtn('spacing', ic('spacing', 16), 'Spacing (padding)') + SEP + moreBtn;
    }
    return swBtn('fill', 'Fill', fillOf(el)) + SEP + (k === 'img' ? tbBtn('crop', ic('crop', 16), 'Crop') : '')
      + tbBtn('radius', ic('radius', 16), 'Corner radius') + tbBtn('spacing', ic('spacing', 16), 'Spacing (padding)') + SEP + moreBtn;
  }

  // --- placement: centred above the primary selection, 12px gap; flips below; stays inside the stage ---
  function tbPlace() {
    const tb = $('ed-tb'), el = primary();
    if (!el || !el.isConnected || presenting() || document.body.classList.contains('view-grid') || tbBusy) { tb.style.display = 'none'; closePop(); return; }
    const html = tbHtml(el);
    if (html !== tbLast) { tb.innerHTML = html; tbLast = html; }
    tb.style.display = 'flex';
    const r = el.getBoundingClientRect(), s = stage.getBoundingClientRect(), w = tb.offsetWidth, h = tb.offsetHeight, m = 4;
    const sr = s.right - (stage.offsetWidth - stage.clientWidth), sb = s.bottom - (stage.offsetHeight - stage.clientHeight);
    if (r.bottom < s.top || r.top > sb || r.right < s.left || r.left > sr) { tb.style.display = 'none'; closePop(); return; } // scrolled out of view
    let top = r.top - 12 - h;
    if (top < s.top + m) top = r.bottom + 12; // no room above: below
    if (top + h > sb - m) top = s.top + m; // no room either side (a slide filling the stage): inside, at the top
    tb.style.left = Math.max(s.left + m, Math.min(r.left + r.width / 2 - w / 2, sr - w - m)) + 'px';
    tb.style.top = top + 'px';
  }
  function popAt() {
    const p = $('ed-pop'), b = document.querySelector(`#ed-tb [data-tb="${pop}"], #ed-panel [data-tb="${pop}"]`);
    if (!b) return closePop();
    p.style.display = 'block';
    const r = b.getBoundingClientRect(), inPane = !!b.closest('#ed-panel'), t = $('ed-tb').getBoundingClientRect();
    let top = inPane ? r.top : t.bottom + 8; // from the panel the popover opens to its left
    if (top + p.offsetHeight > innerHeight - 8) top = inPane ? innerHeight - 8 - p.offsetHeight : t.top - 8 - p.offsetHeight;
    p.style.top = Math.max(8, top) + 'px';
    p.style.left = (inPane ? Math.max(8, $('ed-panel').getBoundingClientRect().left - p.offsetWidth - 8) : Math.max(8, Math.min(r.left, innerWidth - p.offsetWidth - 8))) + 'px';
  }
  function closePop() {
    if (!pop) return;
    pop = null; savedRange = null; $('ed-pop').style.display = 'none'; $('ed-pop').innerHTML = '';
  }
  // Opens the popover of toolbar button b (a second press on the same button closes it). build(host) fills it.
  function openPop(b, build) {
    const id = b.dataset.tb, same = pop === id, r = rangeNow()?.cloneRange() || null;
    closePop();
    if (same) return;
    savedRange = r;
    const p = $('ed-pop');
    p.className = 'pop-' + id;
    pop = id; build(p); popAt();
  }
  const tabs = (names, on) => `<div class="ed-tabs">${names.map(([k, t]) => `<button data-tab="${k}"${k === on ? ' class="on"' : ''}>${t}</button>`).join('')}</div>`;
  const row = (attrs, inner, on) => `<button class="ed-row${on ? ' on' : ''}" ${attrs}>${inner}${on ? ic('check', 16) : ''}</button>`;
  const slider = (id, label, min, max, val, unit) => `<div class="ed-sl"><label>${label}</label><input type="range" id="${id}" min="${min}" max="${max}" value="${val}"><output>${val}${unit}</output></div>`;
  // Wires a range input: fn(value) on every tick, output text follows.
  const bindSlider = (h, id, unit, fn) => { const i = h.querySelector('#' + id); i.oninput = () => { i.nextElementSibling.textContent = i.value + unit; fn(+i.value, true); }; }; // fn(value, drag)
  stage.addEventListener('scroll', () => { closePop(); tbPlace(); });
  document.addEventListener('selectionchange', () => { if (editing) tbPlace(); });
  $('ed-tb').addEventListener('mousedown', e => e.preventDefault()); // a press on the toolbar must not take focus (the text caret stays)
  $('ed-pop').addEventListener('mousedown', e => { if (!e.target.closest('input, select, textarea')) e.preventDefault(); });
  document.addEventListener('pointerdown', e => { if (pop && !e.target.closest('#ed-pop, #ed-tb, #ed-panel [data-tb]')) closePop(); }, true);

  // --- B1: text style popover (Theme | Custom) ---
  function applyStyle(s, kinds = ['text']) {
    change(() => targetsOf(kinds).forEach(el => {
      el.style.fontSize = s.size + 'px'; el.style.fontWeight = s.weight; if (s.color) el.style.color = s.color;
      el.dataset.style = s.name;
    }));
  }
  const fontOpts = cur => (FONTS.some(f => f[0] === cur) ? FONTS : [[cur, `'${cur}', sans-serif`], ...FONTS]).map(f => `<option value="${esc(f[1])}"${f[0] === cur ? ' selected' : ''}>${esc(f[0])}</option>`).join('');
  // Family + size (+ weight) form; onApply(props) gets the changed css properties.
  function fontForm(h, el, weight, onApply) {
    const cs = asAuthored(() => ({ fontSize: csOf(el).fontSize, fontWeight: csOf(el).fontWeight })), cur = famOf(el);
    h.innerHTML = `<div class="ed-lbl">Font</div><select id="ed-f-fam">${fontOpts(cur)}</select>`
      + `<div class="ed-lbl">Size</div><input type="number" id="ed-f-size" min="6" max="400" value="${Math.round(parseFloat(cs.fontSize))}">`
      + (weight ? `<div class="ed-lbl">Weight</div><select id="ed-f-w">${WEIGHTS.map(([v, n]) => `<option value="${v}"${Math.round(+cs.fontWeight / 100) * 100 === v ? ' selected' : ''}>${n}</option>`).join('')}</select>` : '');
    const go = () => onApply({ fontFamily: h.querySelector('#ed-f-fam').value, fontSize: (+h.querySelector('#ed-f-size').value || 1) + 'px', ...(weight ? { fontWeight: h.querySelector('#ed-f-w').value } : {}) });
    h.querySelectorAll('select, input').forEach(i => { i.oninput = go; i.onchange = go; });
  }
  function popStyle(h, kinds = ['text']) {
    const el = primary(), cur = styleOf(el).s?.name;
    let tab = 'theme', q = '';
    const list = () => {
      const f = s => !q || s.name.toLowerCase().includes(q);
      return `<div class="ed-h">${esc(DS?.name || 'Default')}</div>` + TS_GROUPS.map(g => {
        const items = g.items.filter(f);
        return items.length ? `<div class="ed-lbl">${esc(g.group)}</div>` + items.map(s => row(`data-s="${esc(s.name)}" style="font-weight:${s.weight}"`, `<span>${esc(s.name)}</span><em>${s.size}</em>`, s.name === cur)).join('') : '';
      }).join('');
    };
    const draw = () => {
      h.innerHTML = tabs([['theme', 'Theme'], ['custom', 'Custom']], tab) + '<div class="ed-body"></div>';
      const body = h.querySelector('.ed-body');
      if (tab === 'theme') {
        body.innerHTML = `<input class="ed-q" placeholder="Search styles" value="${esc(q)}"><div class="ed-list">${list()}</div>`;
        body.querySelector('.ed-q').oninput = e => { q = e.target.value.toLowerCase(); body.querySelector('.ed-list').innerHTML = list(); };
        body.querySelector('.ed-list').onclick = e => { const b = e.target.closest('[data-s]'); if (b) { applyStyle(TS.find(s => s.name === b.dataset.s), kinds); closePop(); } };
      } else {
        fontForm(body, el, true, props => change(() => targetsOf(kinds).forEach(t => { Object.assign(t.style, props); delete t.dataset.style; }), 'tstyle'));
      }
      h.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); popAt(); });
    };
    draw();
  }

  // --- B4: colour popover (shared by text colour, fills, row fill) ---
  // o = { cur(): css now, img(): background-image now, none: offer None, grad: offer Gradient, apply(css | null) }
  const tokenName = hex => Object.entries(COLORS).find(([, c]) => c.toLowerCase() === hex)?.[0];
  function slideColors() { // distinct colours used on the active slide, in document order
    const out = new Set(), s = slides()[i];
    [s, ...(s ? s.querySelectorAll('*') : [])].forEach(el => {
      if (!el || el.closest('[data-chrome]')) return;
      const cs = csOf(el), own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      [own ? cs.color : '', cs.backgroundColor, parseFloat(cs.borderTopWidth) > 0 ? cs.borderTopColor : ''].forEach(c => { const x = hexOf(c); if (x) out.add(x); });
    });
    return [...out].slice(0, 16);
  }
  // Pointer drag over el; fn(x, y) gets 0-1 positions inside it.
  function dragPos(el, fn) {
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); el.setPointerCapture(e.pointerId);
      const at = ev => { const r = el.getBoundingClientRect(); fn(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height))); };
      const up = () => { el.removeEventListener('pointermove', at); el.removeEventListener('pointerup', up); };
      at(e); el.addEventListener('pointermove', at); el.addEventListener('pointerup', up);
    });
  }
  const hsvOf = (r, g, b, a) => { const [h, s, v] = rgb2hsv(r, g, b); return { h, s, v, a }; };
  const hsvCss = c => rgbCss(...hsv2rgb(c.h, c.s, c.v), c.a);
  function popColor(h, o) {
    const c0 = parseCss(o.cur() || ''), rgb0 = c0 && c0[3] > 0 ? c0 : [0, 38, 84, 1];
    const img = o.grad ? o.img() : '', gc = (img.match(/rgba?[(][^)]*[)]/g) || []).map(parseCss).filter(Boolean), ga = /linear-gradient[(]([0-9.]+)deg/.exec(img);
    const hsv = hsvOf(...rgb0), g = { ang: ga ? +ga[1] : img.includes('gradient') ? 180 : 135, // a computed gradient omits its default 180deg
       stop: 0, c: [gc[0] ? hsvOf(...gc[0]) : { ...hsv }, gc[1] ? hsvOf(...gc[1]) : hsvOf(255, 255, 255, 1)] };
    let tab = 'theme', mode = img.includes('gradient') ? 'grad' : 'solid', q = '', picked = null;
    const ac = () => mode === 'grad' ? g.c[g.stop] : hsv;
    const out = () => mode === 'grad' ? `linear-gradient(${g.ang}deg, ${hsvCss(g.c[0])}, ${hsvCss(g.c[1])})` : hsvCss(hsv);
    const curHex = () => picked ?? hexOf(o.cur());
    const f = ([n, c]) => !q || n.toLowerCase().includes(q) || c.includes(q);
    const rows = list => list.map(([n, c]) => row(`data-c="${c}" title="${c}"`, `<i class="ed-sw" style="background:${c}"></i><span>${esc(n)}</span>`, c === curHex())).join('');
    const themeHtml = () => {
      const used = slideColors().map(c => [tokenName(c) || c.toUpperCase(), c]).filter(f), pal = Object.entries(COLORS).map(([n, c]) => [n, c.toLowerCase()]).filter(f);
      return (o.none && (!q || 'none'.includes(q)) ? row('data-c="none"', '<i class="ed-sw none"></i><span>None</span>', !curHex()) : '')
        + (used.length ? '<div class="ed-lbl">In this slide</div>' + rows(used) : '')
        + (pal.length ? `<div class="ed-h">${esc(DS?.name || 'Built-in')}</div><div class="ed-lbl">Palette</div>` + rows(pal) : '');
    };
    function theme(body) {
      body.innerHTML = `<input class="ed-q" placeholder="Search colours" value="${esc(q)}"><div class="ed-list">${themeHtml()}</div>`;
      const list = body.querySelector('.ed-list');
      body.querySelector('.ed-q').oninput = e => { q = e.target.value.toLowerCase(); list.innerHTML = themeHtml(); };
      list.onclick = e => {
        const b = e.target.closest('[data-c]');
        if (!b) return;
        if (b.dataset.c === 'none') { picked = ''; o.apply(null); } else { picked = b.dataset.c; Object.assign(hsv, hsvOf(...parseHex(picked), 1)); mode = 'solid'; o.apply(picked); }
        list.innerHTML = themeHtml();
      };
    }
    function custom(body) {
      body.innerHTML = (o.grad ? '<div class="ed-seg2"><button data-m="solid">Solid</button><button data-m="grad">Gradient</button></div>' : '') + '<div class="cp-g"></div>'
        + '<div class="cp-sv"><i></i></div><div class="cp-bars"><div class="cp-hue"><i></i></div><div class="cp-al"><b></b><i></i></div>'
        + (window.EyeDropper ? `<button class="cp-eye" title="Pick a colour from the screen">${ic('eye', 16)}</button>` : '') + '</div>'
        + '<div class="cp-in"><input class="cp-hex" maxlength="9" spellcheck="false" title="Hex"><input class="cp-op" type="number" min="0" max="100" title="Opacity"><span>%</span></div>';
      const $q = s => body.querySelector(s), sv = $q('.cp-sv'), hue = $q('.cp-hue'), al = $q('.cp-al'), hexIn = $q('.cp-hex'), opIn = $q('.cp-op'), gbox = $q('.cp-g');
      const emit = () => { picked = null; o.apply(out(), true); };
      const sync = skip => {
        const c = ac(), [r, gg, b] = hsv2rgb(c.h, c.s, c.v);
        sv.style.background = `linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,hsl(${c.h},100%,50%))`;
        sv.firstChild.style.cssText = `left:${c.s * 100}%;top:${(1 - c.v) * 100}%`;
        hue.firstChild.style.left = c.h / 3.6 + '%'; al.firstChild.style.background = `linear-gradient(to right,transparent,rgb(${r},${gg},${b}))`; al.lastChild.style.left = c.a * 100 + '%';
        if (skip !== 'hex') hexIn.value = toHex(r, gg, b);
        if (skip !== 'op') opIn.value = Math.round(c.a * 100);
        body.querySelectorAll('[data-m]').forEach(b2 => b2.classList.toggle('on', b2.dataset.m === mode));
        gbox.style.display = mode === 'grad' ? 'block' : 'none';
        gbox.querySelectorAll('[data-st]').forEach(b2 => { b2.classList.toggle('on', +b2.dataset.st === g.stop); b2.firstChild.style.background = hsvCss(g.c[+b2.dataset.st]); });
      };
      gbox.innerHTML = '<div class="cp-st"><button data-st="0"><i class="ed-sw"></i>Stop 1</button><button data-st="1"><i class="ed-sw"></i>Stop 2</button></div>' + slider('cp-ang', 'Angle', 0, 360, g.ang, 'deg');
      gbox.querySelectorAll('[data-st]').forEach(b2 => b2.onclick = () => { g.stop = +b2.dataset.st; sync(); });
      bindSlider(gbox, 'cp-ang', 'deg', v => { g.ang = v; emit(); });
      body.querySelectorAll('[data-m]').forEach(b2 => b2.onclick = () => { mode = b2.dataset.m; sync(); emit(); });
      dragPos(sv, (x, y) => { const c = ac(); c.s = x; c.v = 1 - y; sync(); emit(); });
      dragPos(hue, x => { ac().h = x * 360; sync(); emit(); });
      dragPos(al, x => { ac().a = Math.round(x * 100) / 100; sync(); emit(); });
      const setRgb = (rgb, skip) => { const c = ac(), n = hsvOf(...rgb, c.a); c.h = n.s ? n.h : c.h; c.s = n.s; c.v = n.v; sync(skip); emit(); };
      hexIn.oninput = () => { const p = parseHex(hexIn.value); if (p) setRgb(p, 'hex'); };
      opIn.oninput = () => { const v = +opIn.value; if (opIn.value !== '' && v >= 0 && v <= 100) { ac().a = v / 100; sync('op'); emit(); } };
      $q('.cp-eye')?.addEventListener('click', () => new window.EyeDropper().open().then(r => setRgb(parseHex(r.sRGBHex))).catch(() => {}));
      sync();
    }
    const draw = () => {
      h.innerHTML = tabs([['theme', 'Theme'], ['custom', 'Custom']], tab) + '<div class="ed-body"></div>';
      (tab === 'theme' ? theme : custom)(h.querySelector('.ed-body'));
      h.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); popAt(); });
    };
    draw();
  }

  // --- what the toolbar buttons do ---
  function applyText(css, drag) { // drag: a custom-picker tick, merged with the previous ticks into one undo step // colour of the selected text range while editing, else of the whole element(s)
    if (rangeNow()) return change(() => withRange(() => { document.execCommand('styleWithCSS', false, true); document.execCommand('foreColor', false, css); }), drag && 'tcolor');
    change(() => targetsOf(['text', 'cell']).forEach(el => { el.style.color = css; }), drag && 'tcolor');
  }
  function setBg(el, css) { // css or null (None)
      if (kindOf(el) === 'slide') { // a slide's background sits under its full-bleed picture, so the picture steps aside while a fill is set
        const im = bleedImg(el);
        if (css) el.style.background = css; else el.style.removeProperty('background');
        if (im) { im.style.display = css ? 'none' : ''; if (css) im.dataset.bgOff = ''; else { delete im.dataset.bgOff; if (!im.getAttribute('style')) im.removeAttribute('style'); } }
      } else el.style.background = css || 'none';
  }
  function applyFill(css, drag) {
    change(() => targetsOf(BOX_KINDS).forEach(el => setBg(el, css)), drag && 'fill');
  }
  function applyRow(css, drag) { // the row's <tr> and its cells (a class like .tu-table td paints over the row alone)
    const tr = primary().closest('tr');
    change(() => [tr, ...tr.cells].forEach(n => css ? n.style.setProperty('background', css) : n.style.removeProperty('background')), drag && 'rowfill');
  }
  function fmt(id) {
    const [cmd, prop, on, off] = FMT[id], el = primary();
    if (rangeNow()) return change(() => withRange(() => document.execCommand(cmd)));
    const turnOn = !isOn(el, id);
    change(() => targetsOf(['text']).forEach(t => { t.style[prop] = turnOn ? on : off; }));
  }
  function swapTag(el, tag, html) {
    const n = document.createElement(tag);
    [...el.attributes].forEach(a => n.setAttribute(a.name, a.value));
    n.innerHTML = html; el.replaceWith(n); return n;
  }
  function toggleList() {
    stopEdit();
    change(() => { sel = sel.map(el => {
      if (kindOf(el) !== 'text') return el; // a mixed selection keeps its other members
      if (el.matches('ul, ol')) {
        const n = swapTag(el, el.dataset.was || 'p', [...el.children].map(li => li.innerHTML).join('<br>'));
        [...LIST_PROPS, 'margin-block'].forEach(p => n.style.removeProperty(p)); delete n.dataset.was;
        return n;
      }
      const lines = el.innerHTML.split(/<br[^>]*>/i).map(s => s.trim()).filter(Boolean);
      const n = swapTag(el, 'ul', (lines.length ? lines : ['']).map(l => `<li>${l}</li>`).join(''));
      n.dataset.was = el.localName; n.style.marginBlock = '0'; n.style.paddingLeft = '1.2em';
      return n;
    }); });
  }
  function setAlign(v) {
    const el = primary();
    if (kindOf(el) === 'cell') { const t = el.closest('table'), k = el.cellIndex; change(() => t.querySelectorAll('tr').forEach(tr => { if (tr.cells[k]) tr.cells[k].style.textAlign = v; })); }
    else change(() => targetsOf(['text']).forEach(t => { t.style.textAlign = v; }));
  }
  function setLink(url) { // url '' removes
    const wrap = t => (t.matches('ul, ol') ? [...t.children] : [t]).forEach(c => {
      const n = document.createElement('a'); n.setAttribute('href', url); n.target = '_blank'; n.rel = 'noopener';
      n.append(...c.childNodes); c.append(n);
    });
    const unwrap = t => t.querySelectorAll('a[href]').forEach(a => a.replaceWith(...a.childNodes));
    if (rangeNow()) {
      change(() => { withRange(() => document.execCommand(url ? 'createLink' : 'unlink', false, url)); if (url) editing.querySelectorAll('a[href]').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; }); });
    } else change(() => targetsOf(['text']).forEach(t => { unwrap(t); if (url) wrap(t); })); // unwrap first: no nested links
  }
  const cellsOf = t => [...t.querySelectorAll('td, th')];
  function setRadius(px, drag) {
    const el = primary(), t = kindOf(el) === 'cell' ? el.closest('table') : el;
    change(() => {
      t.style.borderRadius = px + 'px';
      if (t.nodeName === 'TABLE') Object.assign(t.style, px ? { borderCollapse: 'separate', borderSpacing: '0', overflow: 'hidden' } : { borderCollapse: 'collapse', overflow: '' }); // radius needs separate borders
    }, drag && 'radius');
  }
  function setPad(px, drag) {
    const el = primary();
    change(() => (kindOf(el) === 'cell' ? cellsOf(el.closest('table')) : targetsOf(BOX_KINDS)).forEach(n => { n.style.padding = px + 'px'; }), drag && 'pad');
  }
  function setCrop(fit, x, y, drag) {
    change(() => targetsOf(['img']).forEach(im => { im.style.objectFit = fit; im.style.objectPosition = `${x}% ${y}%`; im.dataset.crop = `1 ${x}% ${y}%`; }), drag && 'crop');
  }

  // --- popovers ---
  function popAlign(h) {
    const cur = alignOf(primary());
    h.innerHTML = '<div class="ed-icons">' + ['left', 'center', 'right', 'justify'].map(v => `<button data-a="${v}" title="Align ${v}"${v === cur ? ' class="on"' : ''}>${ic('a' + v, 18)}</button>`).join('') + '</div>';
    h.onclick = e => { const b = e.target.closest('[data-a]'); if (b) { setAlign(b.dataset.a); closePop(); } };
  }
  function popLink(h) {
    const a = linkAt(primary());
    h.innerHTML = `<div class="ed-lbl">Link</div><input class="ed-url" placeholder="https://" value="${esc(a?.getAttribute('href') || '')}"><div class="ed-err"></div>`
      + '<div class="ed-btns"><button data-lk="remove">Remove</button><button data-lk="apply" class="pri">Apply</button></div>';
    const inp = h.querySelector('.ed-url'), err = h.querySelector('.ed-err');
    const go = () => {
      if (!isUrl(inp.value)) return void (err.textContent = 'Use a link that starts with https://, http:// or mailto:');
      setLink(inp.value.trim()); closePop();
    };
    h.querySelector('[data-lk=apply]').onclick = go;
    h.querySelector('[data-lk=remove]').onclick = () => { setLink(''); closePop(); };
    inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
  }
  function popFont(h) { // cell toolbar: family and size of the whole table
    const t = primary().closest('table');
    fontForm(h, t, false, props => change(() => Object.assign(t.style, props), 'tfont'));
  }
  function popRadius(h) {
    const el = primary(), t = kindOf(el) === 'cell' ? el.closest('table') : el, raw = csOf(t).borderTopLeftRadius; // an ellipse has 50%: shown as pixels
    const v = Math.round(raw.includes('%') ? parseFloat(raw) / 100 * Math.min(t.offsetWidth, t.offsetHeight) : parseFloat(raw) || 0);
    h.innerHTML = slider('ed-rad', 'Radius', 0, 200, Math.min(v, 200), 'px') + '<div class="ed-btns"><button data-pill>Pill</button></div>';
    bindSlider(h, 'ed-rad', 'px', setRadius);
    h.querySelector('[data-pill]').onclick = () => { setRadius(999); h.querySelector('output').textContent = '999px'; h.querySelector('#ed-rad').value = 200; };
  }
  function popSpacing(h) {
    const v = Math.round(parseFloat(csOf(primary()).paddingTop) || 0);
    h.innerHTML = slider('ed-pad', 'Padding', 0, 256, Math.min(v, 256), 'px');
    bindSlider(h, 'ed-pad', 'px', setPad);
  }
  function popCrop(h) {
    const im = primary(), cs = csOf(im), pos = cs.objectPosition.split(' ').map(p => p.endsWith('%') ? parseFloat(p) : 50);
    let fit = cs.objectFit === 'contain' ? 'contain' : 'cover';
    h.innerHTML = '<div class="ed-lbl">Fit</div><div class="ed-seg2"><button data-fit="cover">Fill</button><button data-fit="contain">Fit</button></div>'
      + slider('ed-cx', 'X', 0, 100, Math.round(pos[0]), '%') + slider('ed-cy', 'Y', 0, 100, Math.round(pos[1] ?? 50), '%');
    const go = drag => setCrop(fit, h.querySelector('#ed-cx').value, h.querySelector('#ed-cy').value, drag);
    const mark = () => h.querySelectorAll('[data-fit]').forEach(b => b.classList.toggle('on', b.dataset.fit === fit));
    h.querySelectorAll('[data-fit]').forEach(b => b.onclick = () => { fit = b.dataset.fit; mark(); go(false); });
    bindSlider(h, 'ed-cx', '%', (v, d) => go(d)); bindSlider(h, 'ed-cy', '%', (v, d) => go(d)); mark();
  }
  const TB = {
    bold: () => fmt('bold'), italic: () => fmt('italic'), underline: () => fmt('underline'), list: toggleList,
    style: b => openPop(b, popStyle), font: b => openPop(b, popFont), link: b => openPop(b, popLink), align: b => openPop(b, popAlign),
    radius: b => openPop(b, popRadius), spacing: b => openPop(b, popSpacing), crop: b => openPop(b, popCrop),
    tcolor: b => openPop(b, h => popColor(h, { cur: () => csOf(primary()).color, img: () => '', apply: applyText })),
    fill: b => openPop(b, h => popColor(h, { cur: () => fillOf(primary()).includes('gradient') ? '' : fillOf(primary()), img: () => csOf(primary()).backgroundImage, none: true, grad: true, apply: applyFill })),
    rowfill: b => openPop(b, h => popColor(h, { cur: () => fillOf(primary()), img: () => '', none: true, apply: applyRow })),
    more: () => { closePop(); window.DeckEditor.openPanel?.(); },
  };
  $('ed-tb').addEventListener('click', e => { const b = e.target.closest('[data-tb]'); if (b) TB[b.dataset.tb]?.(b); });

  // --- C: shrink text to fit (render-time only) ---
  // A text box whose content overflows it (a fixed height, or a squeezed column) gets smaller type in steps, down to 60% of the
  // authored size and never under 8px. The authored inline sizes wait in data-fitted and are put back before every edit, copy and save.
  // Tolerance: a tight line-height makes the last line's box poke out by a few px; under 15% of a line is not an overflow.
  const over = a => a.scrollHeight > a.clientHeight + Math.max(1, 0.15 * parseFloat(csOf(a).fontSize)) || a.scrollWidth > a.clientWidth + 1;
  function unfitIn(root) {
    root.querySelectorAll('[data-fitted]').forEach(n => {
      let a = ['', ''];
      try { a = JSON.parse(n.dataset.fitted); } catch { /* a damaged marker: drop it, keep the blanks */ }
      if (a[0]) n.style.fontSize = a[0]; else n.style.removeProperty('font-size');
      if (a[1]) n.style.lineHeight = a[1]; else n.style.removeProperty('line-height');
      n.removeAttribute('data-fitted');
      if (!n.getAttribute('style')) n.removeAttribute('style');
    });
  }
  const unfitText = () => unfitIn(slides()[i] || stage);
  const asAuthored = fn => { unfitText(); try { return fn(); } finally { fitSlide(slides()[i]); } };

  // --- C: size modes. Fixed = px. Fill = the container's width / height (flex:1 along a flex row / column; a pinned element
  // stretches to the content box of the slide or group it sits in). Hug = fit-content (width) / auto (height). ---
  const absPos = el => csOf(el).position === 'absolute';
  const sizeNow = (el, ax) => ax === 'width' ? el.offsetWidth : el.offsetHeight;
  const flexMain = el => { const cs = csOf(el.parentElement); return cs.display.includes('flex') ? (cs.flexDirection.startsWith('column') ? 'height' : 'width') : ''; };
  const roomOf = (el, ax) => { // [start, length] of the container's content box
    const p = absPos(el) ? (el.offsetParent || slideOf(el)) : el.parentElement, cs = csOf(p), W = ax === 'width';
    const pad = (W ? ['Left', 'Right'] : ['Top', 'Bottom']).map(s => parseFloat(cs['padding' + s]) || 0);
    return [pad[0], (W ? p.clientWidth : p.clientHeight) - pad[0] - pad[1]];
  };
  function sizeMode(el, ax) {
    const st = el.style, s = st[ax], W = ax === 'width';
    if (s === '100%' || (flexMain(el) === ax && parseFloat(st.flexGrow) > 0)) return 'fill';
    if (s === 'fit-content' || (!W && s === 'auto')) return 'hug';
    const now = sizeNow(el, ax), [a, len] = roomOf(el, ax), at = W ? el.offsetLeft : el.offsetTop;
    if (/px$/.test(s)) return absPos(el) && Math.abs(now - len) < 1.5 && Math.abs(at - a) < 1.5 ? 'fill' : 'fixed';
    st[ax] = W ? 'fit-content' : 'auto'; // probe: what would it be if it hugged?
    const hug = sizeNow(el, ax);
    if (s) st[ax] = s; else st.removeProperty(ax);
    if (Math.abs(hug - now) < 1.5) return 'hug';
    return !absPos(el) && Math.abs(now - len) < 1.5 ? 'fill' : 'fixed';
  }
  function setMode(el, ax, m) {
    const st = el.style, W = ax === 'width', now = sizeNow(el, ax);
    if (flexMain(el) === ax) st.flex = '';
    if (m === 'fixed') st[ax] = now + 'px';
    else if (m === 'hug') st[ax] = W ? 'fit-content' : 'auto';
    else if (absPos(el)) { const [a, len] = roomOf(el, ax); st[W ? 'left' : 'top'] = a + 'px'; st[W ? 'right' : 'bottom'] = 'auto'; st[ax] = len + 'px'; }
    else if (flexMain(el) === ax) { st.flex = '1 1 0%'; st[ax] = 'auto'; }
    else st[ax] = '100%';
  }
  function setPx(el, ax, v) { if (flexMain(el) === ax) el.style.flex = ''; el.style[ax] = v + 'px'; }

  // Text with the "Shrink text to fit" resize mode (the default for a box with a fixed height, or inside one).
  const hFixed = n => !!n && !n.classList.contains('slide') && sizeMode(n, 'height') === 'fixed';
  const fitMode = el => el.dataset.fit || (hFixed(el) || hFixed(el.parentElement) ? 'shrink' : 'grow');
  function shrinkUnit(u) {
    const nodes = [u, ...u.querySelectorAll('*')].filter(n => !n.closest('[data-fit=none], [data-fit=grow], [data-chrome]')).map(n => {
      const cs = csOf(n);
      return { n, fs: parseFloat(cs.fontSize), lh: parseFloat(cs.lineHeight) || 0, a: [n.style.fontSize, n.style.lineHeight] };
    });
    nodes.forEach(o => { o.n.dataset.fitted = JSON.stringify(o.a); });
    let f = 1;
    while (over(u) && f > 0.6) {
      f = Math.max(0.6, f - 0.02);
      nodes.forEach(o => { o.n.style.fontSize = Math.max(o.fs * f, Math.min(o.fs, 8)) + 'px'; if (o.lh) o.n.style.lineHeight = o.lh * f + 'px'; });
    }
  }
  function fitSlide(s) {
    if (!s || !s.isConnected) return;
    unfitIn(s);
    const hid = getComputedStyle(s).display === 'none', z = s.style.zoom, sl = stage.scrollLeft, st = stage.scrollTop;
    if (hid) s.classList.add('active');
    s.style.zoom = 1; // measured at 100% so the result does not depend on the view zoom
    let units = [];
    s.querySelectorAll(TEXT).forEach(el => {
      if (el.closest('[data-chrome]') || units.some(u => u.contains(el))) return;
      let u = el;
      if (!over(el)) { // not itself full: a squeezed column overflows through its parent
        const p = el.parentElement;
        if (p === s || !over(p)) return;
        u = p;
        while (u.parentElement !== s && over(u.parentElement) && !u.parentElement.matches('[data-group]')) u = u.parentElement;
      }
      if (fitMode(el) === 'shrink') units.push(u);
    });
    units = units.filter(u => !units.some(v => v !== u && v.contains(u)));
    [...new Set(units)].forEach(shrinkUnit);
    s.style.zoom = z;
    if (hid) s.classList.remove('active');
    stage.scrollLeft = sl; stage.scrollTop = st;
  }
  const fitAll = () => slides().forEach(fitSlide);

  // --- C: properties panel (docked right of the stage; every edit goes through change()) ---
  // Fields are built by f* helpers that register get(el) / set(el, v) under an id. The panel is rebuilt only when its signature
  // changes (selection, which rows apply); otherwise ppSync() just writes the current values into the controls.
  const pp = { sig: '', ids: '', fields: {}, map: new WeakMap(), n: 0, sidesPad: false, sidesRad: false, adv: false, textMore: false, fxMenu: false };
  const MIX = {};
  const ppEls = () => sel.length ? sel : [slides()[i]].filter(Boolean);
  const same = (a, b) => typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 0.005 : a === b;
  const mixed = vs => vs.every(v => same(v, vs[0])) ? vs[0] : MIX;
  const r2 = n => Math.round(n * 100) / 100;
  const panelOpen = () => document.body.classList.contains('panel-open');
  const fNum = (id, o) => { pp.fields[id] = { t: 'num', ...o }; return `<input class="pp-in" type="number" data-pp="${id}" min="${o.min ?? ''}" max="${o.max ?? ''}" step="${o.step ?? 1}"${o.title ? ` title="${o.title}"` : ''}>`; };
  const fRange = id => { const o = pp.fields[id]; return `<input type="range" data-pp="${id}" min="${o.min}" max="${o.max}" step="${o.step}">`; };
  const fSel = (id, o) => { pp.fields[id] = { t: 'sel', ...o }; return `<select class="pp-in" data-pp="${id}">${o.opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}<option value="--mixed--" hidden disabled>Mixed</option></select>`; };
  const fSeg = (id, o) => { pp.fields[id] = { t: 'seg', ...o }; return `<div class="pp-seg" data-pp="${id}">${o.opts.map(([v, l, t]) => `<button data-v="${esc(v)}" title="${esc(t || l)}">${l}</button>`).join('')}</div>`; };
  const fCol = (id, o) => { pp.fields[id] = { t: 'col', ...o }; return `<button class="pp-sw" data-tb="pp-${id}" data-pp="${id}"><i class="ed-sw"></i><span></span></button>`; };
  const fTxt = (id, o) => { pp.fields[id] = { t: 'txt', ...o }; return `<input class="pp-in" type="text" data-pp="${id}" spellcheck="false">`; };
  const fLab = (id, o) => { pp.fields[id] = { t: 'lab', ...o }; return `<button class="pp-sw" data-tb="pp-${id}" data-pp="${id}"><span></span>${ic('chevron', 14)}</button>`; };
  const pbtn = (act, icon, title, on, d = '') => `<button class="pp-ic${on ? ' on' : ''}" data-act="${act}" ${d} title="${esc(title)}">${icon}</button>`;
  const prow = (label, ...ctl) => `<div class="pp-row"><label>${label}</label><div class="pp-ctl">${ctl.join('')}</div></div>`;
  const psec = (title, body, tail = '') => `<section class="pp-sec"><div class="pp-st"><span>${title}</span>${tail}</div>${body}</section>`;
  const mini = (cap, inner) => `<label class="pp-mini"><span>${cap}</span>${inner}</label>`;
  const colName = css => { if (!css) return 'None'; if (css.includes('gradient')) return 'Gradient'; const h = hexOf(css); return h ? (tokenName(h) || h.toUpperCase()) : 'None'; };

  function ppSync() {
    const els = ppEls();
    for (const [id, f] of Object.entries(pp.fields)) {
      const v = mixed(els.map(el => f.get(el)));
      document.querySelectorAll(`#pp-body [data-pp="${id}"]`).forEach(c => {
        if (c.type === 'range') { if (document.activeElement !== c) c.value = v === MIX ? f.min : v; }
        else if (f.t === 'num' || f.t === 'txt') { if (document.activeElement !== c) c.value = v === MIX ? '' : f.t === 'num' ? r2(v) : v; c.placeholder = v === MIX ? 'Mixed' : ''; }
        else if (f.t === 'sel') c.value = v === MIX ? '--mixed--' : String(v);
        else if (f.t === 'seg') c.querySelectorAll('button').forEach(b => b.classList.toggle('on', v !== MIX && b.dataset.v === v));
        else if (f.t === 'col') { const sw = c.querySelector('i'); sw.style.background = v === MIX ? '' : v; sw.classList.toggle('none', v === MIX || !v); c.lastChild.textContent = v === MIX ? 'Mixed' : colName(v); }
        else if (f.t === 'lab') c.firstChild.textContent = v === MIX ? 'Mixed' : v;
      });
    }
  }

  const pane = $('ed-panel');
  const ppSet = (f, v, key) => change(() => ppEls().forEach(el => f.set(el, v)), key);
  pane.addEventListener('input', e => {
    const c = e.target, f = pp.fields[c.dataset?.pp];
    if (!f || f.t !== 'num' || c.value === '') return;
    let v = parseFloat(c.value);
    if (isNaN(v)) return;
    if (f.min !== undefined) v = Math.max(f.min, v);
    if (f.max !== undefined) v = Math.min(f.max, v);
    ppSet(f, v, 'pp:' + c.dataset.pp); // one undo step per field edit (the key merges the keystrokes)
  });
  pane.addEventListener('change', e => { const c = e.target, f = pp.fields[c.dataset?.pp]; if (f && (f.t === 'sel' || f.t === 'txt')) ppSet(f, c.value); });
  pane.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input')) e.target.blur(); });
  pane.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const id = b.dataset.pp || b.parentElement.dataset?.pp, f = pp.fields[id];
    if (f?.t === 'seg' && b.dataset.v !== undefined) return ppSet(f, b.dataset.v);
    if (b.dataset.act) return PACT[b.dataset.act]?.(b);
    if (f?.t === 'lab') return openPop(b, h => f.pop(h));
    if (f?.t === 'col') openPop(b, h => popColor(h, { cur: () => { const c = f.get(ppEls().at(-1)); return c.includes('gradient') ? '' : c; }, img: () => f.img?.(ppEls().at(-1)) || '', none: f.none, grad: f.grad, apply: (css, drag) => ppSet(f, css, drag && 'pp:' + id) }));
  });
  const PACT = {
    sidesPad: () => { pp.sidesPad = !pp.sidesPad; ppRefresh(); }, sidesRad: () => { pp.sidesRad = !pp.sidesRad; ppRefresh(); },
    adv: () => { pp.adv = !pp.adv; ppRefresh(); }, textMore: () => { pp.textMore = !pp.textMore; ppRefresh(); }, fxMenu: () => { pp.fxMenu = !pp.fxMenu; ppRefresh(); },
    fxadd: b => { const t = b.dataset.t; pp.fxMenu = false; change(() => ppEls().forEach(el => { const fx = getFx(el); fx[t].push(t === 'sh' ? { x: 0, y: Math.round(4 * U), blur: Math.round(12 * U), spread: 0, color: 'rgba(0, 0, 0, 0.25)', inset: false } : { blur: Math.round(8 * U) }); setFx(el, fx, t); })); },
    fxdel: b => change(() => ppEls().forEach(el => { const fx = getFx(el), t = b.dataset.t; fx[t].splice(+b.dataset.n, 1); setFx(el, fx, t); })),
    pin: () => change(() => pinAll(ppEls().filter(el => !absPos(el) && movable(el)))),
  };

  // --- C: sections ---
  const kidsOf = el => [...el.children].filter(c => !c.matches('[data-chrome]'));
  const container = el => kindOf(el) === 'slide' || (kindOf(el) === 'shape' && kidsOf(el).length > 0);
  const textual = el => ['text', 'cell'].includes(kindOf(el)) || (kindOf(el) === 'shape' && !!el.querySelector(TEXT));
  const TKINDS = ['text', 'cell', 'shape'];
  const SIDES = ['Top', 'Right', 'Bottom', 'Left'];
  const SIZE_MODES = [['fixed', 'Fixed'], ['fill', 'Fill'], ['hug', 'Hug']];
  const AI = [['flex-start', 'Start'], ['center', 'Center'], ['flex-end', 'End'], ['stretch', 'Stretch']];
  const JC = [['flex-start', 'Start'], ['center', 'Center'], ['flex-end', 'End'], ['space-between', 'Between'], ['space-around', 'Around']];
  const fixEdge = v => ({ start: 'flex-start', end: 'flex-end' }[v] || v);
  const dirOf = el => { const cs = csOf(el); return cs.display.includes('grid') ? 'grid' : cs.display.includes('flex') && cs.flexDirection.startsWith('row') ? 'row' : 'column'; };
  const gapOf = el => { const cs = csOf(el); return Math.max(parseFloat(cs.rowGap) || 0, parseFloat(cs.columnGap) || 0); };
  const aiOf = el => { const v = csOf(el).alignItems; return v === 'normal' ? 'stretch' : fixEdge(v); };
  const jcOf = el => { const v = csOf(el).justifyContent; return v === 'normal' ? 'flex-start' : fixEdge(v); };
  const padN = (el, s) => r2(parseFloat(csOf(el)['padding' + s]) || 0);
  const padAll = el => { const v = SIDES.map(s => padN(el, s)); return v.every(x => x === v[0]) ? v[0] : NaN; };
  function ensureFlex(el) { // gap / align / justify only act on a flex or grid box; a plain block stacks like a column
    if (kindOf(el) !== 'slide' && !/flex|grid/.test(csOf(el).display)) { el.style.display = 'flex'; el.style.flexDirection = 'column'; }
  }
  function setDir(el, d) {
    const st = el.style;
    if (d === 'grid') { st.display = 'grid'; st.gridTemplateColumns = `repeat(${Math.min(Math.max(kidsOf(el).length, 1), 4)}, 1fr)`; return; }
    if (kindOf(el) !== 'slide') st.display = 'flex'; // a slide is already a flex column while it is shown
    st.flexDirection = d; st.removeProperty('grid-template-columns');
  }
  function containerRows(slide) {
    const dirs = [['column', 'Column'], ['row', 'Row'], ...(slide ? [] : [['grid', 'Grid']])];
    return prow('Direction', fSel('dir', { opts: dirs, get: dirOf, set: setDir }))
      + prow('Gap', fNum('gap', { min: 0, max: 999, get: gapOf, set: (el, v) => { ensureFlex(el); el.style.gap = v + 'px'; } }))
      + prow('Align', fSel('ai', { opts: AI, get: aiOf, set: (el, v) => { ensureFlex(el); el.style.alignItems = v; } }))
      + prow('Justify', fSel('jc', { opts: JC, get: jcOf, set: (el, v) => { ensureFlex(el); el.style.justifyContent = v; } }));
  }
  function secLayout(els, cont) {
    const sides = pp.sidesPad;
    let h = prow('Padding', sides ? '<span class="pp-fill"></span>' : fNum('pad', { min: 0, max: 999, get: padAll, set: (el, v) => { el.style.padding = v + 'px'; } }), pbtn('sidesPad', ic('spacing', 16), 'Edit each side', sides));
    if (sides) h += `<div class="pp-sides">${SIDES.map(s => mini(s[0], fNum('pad' + s, { min: 0, max: 999, title: s, get: el => padN(el, s), set: (el, v) => { el.style['padding' + s] = v + 'px'; } }))).join('')}</div>`;
    if (cont) h += containerRows(els.every(el => kindOf(el) === 'slide'));
    return psec('Layout', h);
  }
  const secSize = () => psec('Size',
    prow('Width', fNum('w', { min: 1, max: 9999, get: el => sizeNow(el, 'width'), set: (el, v) => setPx(el, 'width', v) }), fSel('wm', { opts: SIZE_MODES, get: el => sizeMode(el, 'width'), set: (el, m) => setMode(el, 'width', m) }))
    + prow('Height', fNum('h', { min: 1, max: 9999, get: el => sizeNow(el, 'height'), set: (el, v) => setPx(el, 'height', v) }), fSel('hm', { opts: SIZE_MODES, get: el => sizeMode(el, 'height'), set: (el, m) => setMode(el, 'height', m) })));

  // Text
  const NAMED_W = [[100, 'Thin'], [200, 'Extra light'], [300, 'Light'], [400, 'Regular'], [500, 'Medium'], [600, 'Semi bold'], [700, 'Bold'], [800, 'Extra bold'], [900, 'Black']];
  const styleRaw = el => { const cs = csOf(el), size = Math.round(parseFloat(cs.fontSize)); return { s: matchStyle(TS, el.dataset.style, size, cs.fontWeight, hexOf(cs.color)), size }; };
  const famVal = el => { const n = famOf(el); return (FONTS.find(f => f[0] === n) || [n, `'${n}', sans-serif`])[1]; };
  const tset = (el, prop, v) => { el.style[prop] = v; if (kindOf(el) === 'text') delete el.dataset.style; };
  const lhOf = el => { const cs = csOf(el), fs = parseFloat(cs.fontSize); return r2((parseFloat(cs.lineHeight) || fs * 1.2) / fs); };
  const lsOf = el => r2(parseFloat(csOf(el).letterSpacing) || 0);
  function setFit(el, m) {
    const was = fitMode(el), hm = sizeMode(el, 'height');
    el.dataset.fit = m;
    if (m === 'grow' && hm !== 'hug') el.style.height = 'auto'; // the box follows its text
    else if (m !== 'grow' && was === 'grow') el.style.height = el.offsetHeight + 'px'; // the box keeps today's size, the text may shrink in it
  }
  function secText(els) {
    const cur = famOf(els.at(-1)), fonts = (FONTS.some(f => f[0] === cur) ? FONTS : [[cur, `'${cur}', sans-serif`], ...FONTS]).map(f => [f[1], f[0]]);
    let h = prow('Style', fLab('ts', { get: el => { const r = styleRaw(el); return r.s ? r.s.name : 'Custom ' + DOT + ' ' + r.size; }, pop: hh => popStyle(hh, TKINDS) }))
      + prow('Font', fSel('ff', { opts: fonts, get: famVal, set: (el, v) => tset(el, 'fontFamily', v) }))
      + prow('Weight', fSel('fw', { opts: NAMED_W.map(([v, n]) => [String(v), n]), get: el => String(Math.min(900, Math.max(100, Math.round(+csOf(el).fontWeight / 100) * 100))), set: (el, v) => tset(el, 'fontWeight', v) }))
      + prow('Size', fNum('fs', { min: 6, max: 400, get: el => parseFloat(csOf(el).fontSize), set: (el, v) => tset(el, 'fontSize', v + 'px') }))
      + prow('Spacing', mini(ic('lineh', 14), fNum('lh', { min: 0.5, max: 5, step: 0.05, title: 'Line height', get: lhOf, set: (el, v) => { el.style.lineHeight = String(v); } })), mini(ic('letter', 14), fNum('ls', { min: -20, max: 100, step: 0.5, title: 'Letter spacing (px)', get: lsOf, set: (el, v) => { el.style.letterSpacing = v + 'px'; } })))
      + prow('Color', fCol('tc', { get: el => csOf(el).color, set: (el, c) => { el.style.color = c; } }))
      + prow('Align', fSeg('ta', { opts: ['left', 'center', 'right', 'justify'].map(v => [v, ic('a' + v, 16), 'Align ' + v]), get: alignOf, set: (el, v) => { el.style.textAlign = v; } }));
    if (els.every(el => kindOf(el) === 'text')) h += prow('Resize', fSel('fit', { opts: [['shrink', 'Shrink text to fit'], ['none', 'Keep size'], ['grow', 'Grow box']], get: fitMode, set: setFit }));
    if (pp.textMore) h += prow('Case', fSel('tt', { opts: [['none', 'None'], ['uppercase', 'Uppercase'], ['lowercase', 'Lowercase'], ['capitalize', 'Capitalize']], get: el => csOf(el).textTransform, set: (el, v) => { el.style.textTransform = v; } }))
      + prow('Line', fSel('td', { opts: [['none', 'None'], ['underline', 'Underline'], ['line-through', 'Strikethrough']], get: el => { const l = csOf(el).textDecorationLine; return l.includes('line-through') ? 'line-through' : l.includes('underline') ? 'underline' : 'none'; }, set: (el, v) => { el.style.textDecoration = v; } }));
    return psec('Text', h, pbtn('textMore', ic('plus', 16), 'More text options', pp.textMore));
  }

  // Appearance
  const CORN = ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'];
  const radPx = (el, c) => { const raw = csOf(el)['border' + CORN[c] + 'Radius'], v = parseFloat(raw) || 0; return Math.round(raw.includes('%') ? v / 100 * Math.min(el.offsetWidth, el.offsetHeight) : v); };
  function setRad(el, c, v) { // c: corner 0-3, or -1 for all four
    if (c < 0) el.style.borderRadius = v + 'px'; else el.style['border' + CORN[c] + 'Radius'] = v + 'px';
    if (el.nodeName === 'TABLE') Object.assign(el.style, CORN.some((n, k) => radPx(el, k) > 0) ? { borderCollapse: 'separate', borderSpacing: '0', overflow: 'hidden' } : { borderCollapse: 'collapse', overflow: '' }); // radius needs separate borders
  }
  const bsOf = el => { const cs = csOf(el), s = cs.borderTopStyle; return parseFloat(cs.borderTopWidth) > 0 && s !== 'none' && s !== 'hidden' ? (s === 'dashed' || s === 'dotted' ? s : 'solid') : 'none'; };
  function setBs(el, v) {
    const w = parseFloat(csOf(el).borderTopWidth) || 0, hadColor = !!el.style.borderColor;
    el.style.borderStyle = v;
    if (v === 'none') return;
    el.style.borderWidth = (w > 0 ? w : Math.max(1, Math.round(2 * U))) + 'px';
    if (!hadColor) el.style.borderColor = DEF.line;
  }
  const bgField = () => fCol('bg', { none: true, grad: true, get: fillOf, img: el => csOf(el).backgroundImage, set: (el, c) => setBg(el, c) });
  function secAppear(els) {
    const sides = pp.sidesRad;
    let h = prow('Background', bgField())
      + prow('Opacity', fNum('op', { min: 0, max: 1, step: 0.05, get: el => r2(+csOf(el).opacity), set: (el, v) => { if (v >= 1) el.style.removeProperty('opacity'); else el.style.opacity = v; } }), fRange('op'))
      + prow('Radius', sides ? '<span class="pp-fill"></span>' : fNum('rad', { min: 0, max: 999, get: el => { const v = CORN.map((n, c) => radPx(el, c)); return v.every(x => x === v[0]) ? v[0] : NaN; }, set: (el, v) => setRad(el, -1, v) }), pbtn('sidesRad', ic('radius', 16), 'Edit each corner', sides));
    if (sides) h += `<div class="pp-sides">${CORN.map((n, c) => mini(['TL', 'TR', 'BR', 'BL'][c], fNum('rad' + c, { min: 0, max: 999, title: n, get: el => radPx(el, c), set: (el, v) => setRad(el, c, v) }))).join('')}</div>`;
    h += prow('Border', fSeg('bs', { opts: [['none', 'None'], ['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']], get: bsOf, set: setBs }));
    if (els.some(el => bsOf(el) !== 'none')) h += prow('Width', fNum('bw', { min: 0, max: 99, get: el => r2(parseFloat(csOf(el).borderTopWidth) || 0), set: (el, v) => { el.style.borderWidth = v + 'px'; } }))
      + prow('Color', fCol('bc', { get: el => csOf(el).borderTopColor, set: (el, c) => { el.style.borderColor = c; } }));
    return psec('Appearance', h);
  }

  // Effects: box-shadow rows and layer blur (filter: blur) rows
  const splitTop = s => { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; };
  function getFx(el) {
    const cs = csOf(el), parts = cs.filter === 'none' ? [] : (cs.filter.match(/[a-z-]+[(][^)]*[)]/g) || []);
    return {
      sh: cs.boxShadow === 'none' ? [] : splitTop(cs.boxShadow).map(s => {
        const col = (s.match(/rgba?[(][^)]*[)]/) || ['rgb(0, 0, 0)'])[0], n = (s.replace(col, '').match(/-?[0-9.]+/g) || []).map(Number);
        return { x: n[0] || 0, y: n[1] || 0, blur: n[2] || 0, spread: n[3] || 0, color: col, inset: s.includes('inset') };
      }),
      bl: parts.filter(p => p.startsWith('blur(')).map(p => ({ blur: parseFloat(p.slice(5)) || 0 })),
      other: parts.filter(p => !p.startsWith('blur(')).join(' '),
    };
  }
  function setFx(el, fx, which) {
    if (which === 'sh') el.style.boxShadow = fx.sh.length ? fx.sh.map(s => `${s.inset ? 'inset ' : ''}${s.color} ${s.x}px ${s.y}px ${s.blur}px ${s.spread}px`).join(', ') : 'none';
    else el.style.filter = [...fx.bl.map(b => `blur(${b.blur}px)`), fx.other].filter(Boolean).join(' ') || 'none';
  }
  const fxF = (t, n, key, extra = {}) => fNum(`fx-${t}-${n}-${key}`, { step: 1, ...extra, get: el => getFx(el)[t][n]?.[key] ?? 0, set: (el, v) => { const fx = getFx(el); if (fx[t][n]) { fx[t][n][key] = v; setFx(el, fx, t); } } });
  const fxRow = (t, n, title, inner) => `<div class="pp-fx"><div class="pp-fxh"><b>${title}</b>${pbtn('fxdel', ic('x', 14), 'Remove effect', false, `data-t="${t}" data-n="${n}"`)}</div>${inner}</div>`;
  const fxUniform = els => { const a = JSON.stringify(getFx(els[0])); return els.every(el => JSON.stringify(getFx(el)) === a); };
  function secFx(els) {
    let h = pp.fxMenu ? '<div class="pp-menu"><button data-act="fxadd" data-t="sh">Shadow</button><button data-act="fxadd" data-t="bl">Blur</button></div>' : '';
    if (!fxUniform(els)) h += '<div class="pp-muted">Mixed</div>';
    else {
      const fx = getFx(els[0]);
      fx.sh.forEach((s, n) => { h += fxRow('sh', n, 'Shadow', `<div class="pp-sides">${mini('X', fxF('sh', n, 'x'))}${mini('Y', fxF('sh', n, 'y'))}${mini('B', fxF('sh', n, 'blur', { min: 0 }))}${mini('S', fxF('sh', n, 'spread'))}</div>`
        + prow('Color', fCol(`fx-sh-${n}-color`, { get: el => getFx(el).sh[n]?.color ?? '', set: (el, c) => { const f2 = getFx(el); if (f2.sh[n]) { f2.sh[n].color = c; setFx(el, f2, 'sh'); } } }))); });
      fx.bl.forEach((b, n) => { h += fxRow('bl', n, 'Blur', prow('Blur', fxF('bl', n, 'blur', { min: 0, max: 200 }))); });
    }
    return psec('Effects', h, pbtn('fxMenu', ic('plus', 16), 'Add effect', pp.fxMenu));
  }

  // Advanced
  const xOf = el => el.style.left ? parseFloat(el.style.left) : el.offsetLeft;
  const yOf = el => el.style.top ? parseFloat(el.style.top) : el.offsetTop;
  const rotOf = el => { const m = csOf(el).transform; if (m === 'none') return 0; const v = m.match(/-?[0-9.e-]+/g).map(Number); return Math.round(Math.atan2(v[1], v[0]) * 18000 / Math.PI) / 100; };
  const altAttr = el => el.nodeName === 'IMG' ? 'alt' : 'aria-label';
  function setId(el, v) {
    const id = v.trim().split(' ').join('-'), other = id && document.getElementById(id);
    if (other && other !== el) return status('That id is already used');
    if (id) el.id = id; else el.removeAttribute('id');
  }
  function secAdv(els) {
    let h = '';
    if (pp.adv) {
      if (els.every(movable)) h += els.every(absPos)
        ? prow('Position', mini('X', fNum('px', { min: -9999, max: 9999, get: xOf, set: (el, v) => { el.style.left = px(v); el.style.right = 'auto'; } })), mini('Y', fNum('py', { min: -9999, max: 9999, get: yOf, set: (el, v) => { el.style.top = px(v); el.style.bottom = 'auto'; } })))
        : prow('Position', '<button class="pp-btn" data-act="pin" title="Pin to its spot so it can be placed with X and Y">Pin</button>');
      if (els.every(el => kindOf(el) !== 'cell')) h += prow('Rotation', fNum('rot', { min: -360, max: 360, get: rotOf, set: (el, v) => { el.style.transform = v ? `rotate(${v}deg)` : ''; } }));
      if (els.length === 1) h += prow('ID', fTxt('id', { get: el => el.id, set: setId }));
      if (els.every(el => kindOf(el) === 'img')) h += prow('Alt text', fTxt('alt', { get: el => el.getAttribute(altAttr(el)) || '', set: (el, v) => el.setAttribute(altAttr(el), v) }));
    }
    return psec('Advanced', h, pbtn('adv', ic('right', 16), pp.adv ? 'Hide advanced' : 'Show advanced', pp.adv));
  }
  const KIND_NAMES = { slide: 'Slide', text: 'Text', cell: 'Table cell', table: 'Table', img: 'Image', group: 'Group', shape: 'Box' };
  const LAYOUT_KINDS = ['text', 'cell', 'shape', 'slide'];

  function ppRender(sg) {
    const els = ppEls(), body = $('pp-body'), top = body.scrollTop, all = p => els.every(p);
    pp.fields = {};
    let h = '';
    if (els.length === 1 && kindOf(els[0]) === 'slide') {
      h = psec('Slide', prow('Background', bgField())) + secLayout(els, true)
        + psec('Transition', prow('Transition', '<select class="pp-in" disabled title="Transitions come with the present options"><option>None</option></select>'));
    } else {
      h = secSize();
      if (all(el => LAYOUT_KINDS.includes(kindOf(el)))) h += secLayout(els, all(container));
      if (all(textual)) h += secText(els);
      h += secAppear(els);
      if (all(el => kindOf(el) !== 'cell')) h += secFx(els);
      h += secAdv(els);
    }
    body.innerHTML = h; body.scrollTop = top; pp.sig = sg;
  }
  function ppSig(els) {
    const ids = els.map(el => { if (!pp.map.has(el)) pp.map.set(el, ++pp.n); return pp.map.get(el); }).join('.');
    if (ids !== pp.ids) { // a new selection opens the per-side rows when its sides differ
      pp.ids = ids; pp.sidesPad = els.some(el => isNaN(padAll(el)));
      pp.sidesRad = els.some(el => { const v = CORN.map((n, c) => radPx(el, c)); return v.some(x => x !== v[0]); });
    }
    const fx = fxUniform(els) ? getFx(els[0]) : null;
    return [ids, els.map(kindOf).join(','), pp.sidesPad, pp.sidesRad, pp.adv, pp.textMore, pp.fxMenu, els.some(el => bsOf(el) !== 'none'), els.map(el => absPos(el) ? 'a' : 'f').join(''),
      els.every(container), els.every(textual), fx ? fx.sh.length + ':' + fx.bl.length : 'x'].join('|');
  }
  function ppRefresh() {
    if (!panelOpen() || presenting()) return;
    const els = ppEls();
    if (!els.length) return;
    unfitText(); // read the authored sizes, not the shrunk ones
    try {
      const sg = ppSig(els);
      if (sg !== pp.sig) ppRender(sg);
      ppSync();
      $('pp-title').textContent = els.length > 1 ? `${els.length} selected` : KIND_NAMES[kindOf(els[0])];
    } finally { fitSlide(slides()[i]); }
  }
  function syncChrome() { // titles and pressed state of the panel and notes buttons follow the body classes
    const pn = panelOpen(), nt = document.body.classList.contains('notes-open');
    $('ed-pp').title = pn ? 'Hide properties' : 'Show properties'; $('ed-pp').classList.toggle('on', pn);
    document.querySelectorAll('[data-cmd=notes]').forEach(b => { b.title = nt ? 'Hide speaker notes' : 'Show speaker notes'; b.classList.toggle('on', nt); });
  }
  // The panel button and the toolbar's dots toggle the panel (open / closed is remembered per viewer); on = true / false forces it.
  function togglePanel(on) {
    const open = document.body.classList.toggle('panel-open', on);
    pref('panel', open ? '1' : '');
    if (!open) { closePop(); pp.sig = ''; }
    syncChrome(); fit();
  }
  // Speaker notes open under the slide, between the stage and the filmstrip.
  function toggleNotes(on) {
    const open = document.body.classList.toggle('notes-open', on);
    pref('notes', open ? '1' : '');
    syncChrome(); fit();
  }

  function setNotes(text) {
    const s = slides()[i];
    let n = s.querySelector(':scope > aside.notes');
    if (!n) { n = document.createElement('aside'); n.className = 'notes'; n.hidden = true; s.appendChild(n); }
    n.textContent = text;
    if (!text.trim()) n.remove();
    markDirty();
  }

  function present(on) {
    document.body.classList.toggle('presenting', on);
    if (on) { select(null); document.activeElement?.blur?.(); document.documentElement.requestFullscreen?.().catch(() => {}); }
    else if (document.fullscreenElement) document.exitFullscreen();
    fit();
  }
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && presenting()) present(false); });

  async function post(name, body) {
    const r = await fetch('/save?file=' + encodeURIComponent(name), { method: 'POST', body });
    if (!r.ok) throw new Error(await r.text());
  }

  async function save() {
    const doc = document.documentElement.cloneNode(true);
    doc.querySelectorAll('[data-chrome]').forEach(el => el.remove());
    unfitIn(doc); // the file keeps the authored font sizes
    delete doc.dataset.theme; doc.style.removeProperty('--strip-h'); doc.style.removeProperty('--nh');
    if (!doc.getAttribute('style')) doc.removeAttribute('style');
    const body = doc.querySelector('body');
    body.classList.remove('panel-open', 'notes-open', 'strip-closed', 'view-grid', 'presenting');
    if (!body.className) body.removeAttribute('class');
    doc.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
    doc.querySelectorAll('.slide').forEach(el => { el.style.removeProperty('zoom'); el.classList.remove('active'); if (!el.getAttribute('style')) el.removeAttribute('style'); });
    try {
      await post(file, '<!doctype html>\n' + doc.outerHTML);
      dirty = false; $('ed-save').classList.remove('dirty'); status('Saved ' + new Date().toLocaleTimeString());
    } catch (e) { status('Save failed: ' + e.message); }
  }

  // --- export ---
  const loaded = {};
  const load = src => loaded[src] ??= new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = src; s.dataset.chrome = ''; // stripped on save
    s.onload = ok;
    s.onerror = () => { s.remove(); delete loaded[src]; fail(new Error('Could not load ' + src)); };
    document.head.appendChild(s);
  });

  // Lays each slide out unscaled off screen, then hands it to fn(clone, k).
  async function eachSlideOffscreen(fn) {
    await document.fonts.ready;
    const host = document.createElement('div');
    host.style.cssText = `position:fixed;left:-${W * 2}px;top:0;width:${W}px;height:${H}px;`;
    document.body.appendChild(host);
    try {
      for (const [k, s] of slides().entries()) {
        status(`Exporting ${k + 1}/${slides().length}`);
        const c = cleanClone(s);
        c.classList.add('active');
        c.style.margin = '0'; c.style.boxShadow = 'none';
        host.replaceChildren(c);
        await Promise.all([...c.querySelectorAll('img')].map(im => im.decode().catch(() => {})));
        await fn(c, k);
      }
    } finally { host.remove(); }
  }

  // PDF: one picture per slide (text not selectable).
  async function toPdf() {
    await Promise.all([load(LIBS.html2canvas), load(LIBS.jspdf)]);
    const pdf = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'px', format: [W, H], hotfixes: ['px_scaling'], compress: true });
    await eachSlideOffscreen(async (c, k) => {
      fitSlide(c); // the picture shows the shrunk text like the screen
      const canvas = await html2canvas(c, { scale: 2560 / W, width: W, height: H, backgroundColor: '#ffffff', logging: false, useCORS: true });
      if (k) pdf.addPage([W, H], 'landscape');
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, W, H); // JPEG keeps the PDF small
    });
    return pdf.output('blob');
  }

  // PPTX: native, editable objects read from the laid-out HTML — boxes with a fill/border become shapes,
  // text becomes text boxes (runs keep bold/italic/colour/size), lists become bullets, img/svg/canvas become pictures,
  // aside.notes becomes speaker notes.
  const clear = c => !c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);
  const hex = c => (c.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(n => Math.round(+n).toString(16).padStart(2, '0')).join('').toUpperCase();
  const alpha = c => { const m = c.match(/rgba\([^)]*,\s*([\d.]+)\)/); return m ? Math.round((1 - +m[1]) * 100) : 0; };
  const THAI = /[฀-๿]/;
  const fontMap = DS?.pptxFonts || {};
  const face = (cs, text) => {
    if (THAI.test(text)) return 'Leelawadee UI';
    const f = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    return fontMap[f] || f;
  };
  const pt = px => Math.round(parseFloat(px) * PT * 10) / 10;
  const isBlock = el => /^(block|flex|grid|list-item|table)/.test(getComputedStyle(el).display);
  const dataUrl = src => fetch(src).then(r => r.blob()).then(b => new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b); }));

  // PPTX helpers for what the panel writes: opacity, border style, shadow, rotation, letter spacing, case, strike.
  const DASH = { dashed: 'dash', dotted: 'sysDot' };
  const trans = (pct, o) => Math.round(100 - (100 - pct) * o); // pptx transparency from a colour's own transparency and the element's opacity
  const opacityOf = el => { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return isNaN(o) ? 1 : o; };
  const caseOf = (t, cs) => cs.textTransform === 'uppercase' ? t.toUpperCase() : cs.textTransform === 'lowercase' ? t.toLowerCase()
    : cs.textTransform === 'capitalize' ? t.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : t;
  const extraRun = (cs, el) => {
    const o = opacityOf(el), ls = parseFloat(cs.letterSpacing);
    return { ...(o < 1 ? { transparency: trans(0, o) } : {}), ...(ls ? { charSpacing: pt(ls) } : {}), ...(cs.textDecorationLine.includes('line-through') ? { strike: 'sngStrike' } : {}) };
  };
  const imgExtra = el => { const o = opacityOf(el), r = rotOf(el); return { ...(o < 1 ? { transparency: trans(0, o) } : {}), ...(r ? { rotate: r } : {}) }; };
  function shapeExtra(el) { // rotation and the first outer shadow
    const r = rotOf(el), s = getFx(el).sh.find(x => !x.inset), c = s && parseCss(s.color);
    return { ...(r ? { rotate: r } : {}), ...(s ? { shadow: { type: 'outer', color: toHex(c[0], c[1], c[2]).slice(1).toUpperCase(), opacity: c[3], blur: Math.round(s.blur * PT * 10) / 10, offset: Math.round(Math.hypot(s.x, s.y) * PT * 10) / 10, angle: Math.round((Math.atan2(s.y, s.x) * 180 / Math.PI + 360) % 360) } } : {}) };
  }

  function runsOf(block) {
    const runs = [];
    const walk = node => {
      for (const n of node.childNodes) {
        if (n.nodeType === 3) {
          const t = n.textContent.replace(/\s+/g, ' ');
          if (!t.trim() && !runs.length) continue;
          const cs = getComputedStyle(n.parentElement), link = n.parentElement.closest('a[href]');
          runs.push({ text: caseOf(t, cs), options: { bold: +cs.fontWeight >= 600, italic: cs.fontStyle === 'italic', underline: cs.textDecorationLine.includes('underline') ? { style: 'sng' } : undefined, color: hex(cs.color), fontSize: pt(cs.fontSize), fontFace: face(cs, t), ...extraRun(cs, n.parentElement), ...(link ? { hyperlink: { url: link.getAttribute('href') } } : {}) } });
        } else if (n.nodeName === 'BR' || (n.nodeType === 1 && isBlock(n) && runs.length)) {
          if (runs.length) runs[runs.length - 1].options.breakLine = true;
          if (n.nodeType === 1 && n.nodeName !== 'BR') walk(n);
        } else if (n.nodeType === 1) walk(n);
      }
    };
    walk(block);
    if (runs.length) {
      runs[0].text = runs[0].text.replace(/^\s+/, '');
      runs.forEach(r => { if (r.options.breakLine) r.text = r.text.replace(/\s+$/, ''); });
      runs[runs.length - 1].text = runs[runs.length - 1].text.replace(/\s+$/, '');
    }
    return runs.filter(r => r.text || r.options.breakLine);
  }

  function textOpts(el, b) {
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight);
    const align = { start: 'left', left: 'left', center: 'center', right: 'right', end: 'right', justify: 'justify' }[cs.textAlign] || 'left';
    const pad = ['Left', 'Right', 'Bottom', 'Top'].map(s => pt(cs['padding' + s])); // pptxgenjs margin order: L, R, B, T
    const valign = cs.display.includes('flex') && cs.flexDirection.startsWith('column') && cs.justifyContent === 'flex-end' ? 'bottom' : cs.display.includes('flex') && cs.alignItems === 'center' ? 'middle' : 'top';
    // PowerPoint sets text slightly wider than the browser, so tight boxes get extra room on the side text grows into.
    const extra = b.w * 0.04;
    const x = align === 'right' ? b.x - extra : align === 'center' ? b.x - extra / 2 : b.x;
    return { ...b, x, w: b.w + extra, margin: pad, valign, wrap: true, fit: fitMode(el) === 'shrink' ? 'shrink' : 'none', ...(rotOf(el) ? { rotate: rotOf(el) } : {}), align, ...(lh ? { lineSpacing: pt(lh) } : {}) };
  }

  async function slideToPptx(p, c) {
    const o = c.getBoundingClientRect();
    const box = el => { const r = el.getBoundingClientRect(), rot = rotOf(el), w = rot ? el.offsetWidth : r.width, h = rot ? el.offsetHeight : r.height; return { x: (r.left + (r.width - w) / 2 - o.left) / PX, y: (r.top + (r.height - h) / 2 - o.top) / PX, w: w / PX, h: h / PX }; }; // a rotated box is placed by its centre
    const ps = p.addSlide();
    const scs = getComputedStyle(c);
    const sbg = clear(scs.backgroundColor) ? gradFirst(scs.backgroundImage) : scs.backgroundColor; // a gradient exports as its first colour
    ps.background = { color: clear(sbg) ? 'FFFFFF' : hex(sbg) };
    const notes = c.querySelector(':scope > aside.notes')?.textContent.trim();
    if (notes) ps.addNotes(notes);
    const done = new Set();
    const skipInside = el => el.querySelectorAll('*').forEach(d => done.add(d));
    for (const el of c.querySelectorAll('*')) {
      if (done.has(el)) continue;
      const cs = getComputedStyle(el);
      const b = box(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || b.w <= 0 || b.h <= 0) { skipInside(el); continue; }
      if (el.nodeName === 'IMG') {
        ps.addImage({ data: await dataUrl(el.currentSrc || el.src), ...b, ...imgExtra(el), ...(cs.objectFit === 'cover' ? { sizing: { type: 'cover', w: b.w, h: b.h } } : {}) });
        continue;
      }
      if (el.matches('svg, canvas')) {
        skipInside(el);
        const canvas = await html2canvas(el, { scale: 2, backgroundColor: null, logging: false });
        ps.addImage({ data: canvas.toDataURL('image/png'), ...b, ...imgExtra(el) });
        continue;
      }
      const bw = parseFloat(cs.borderTopWidth), bbw = parseFloat(cs.borderBottomWidth);
      const border = bw > 0 && cs.borderTopStyle !== 'none' && !clear(cs.borderTopColor);
      const bg = clear(cs.backgroundColor) ? gradFirst(cs.backgroundImage) : cs.backgroundColor;
      if (!clear(bg) || border) {
        const r = parseFloat(cs.borderTopLeftRadius) || 0;
        const ellipse = cs.borderTopLeftRadius.includes('%') && r >= 50;
        const rr = Math.min(r / PX, b.w / 2, b.h / 2);
        ps.addShape(ellipse ? 'ellipse' : r ? 'roundRect' : 'rect', {
          ...b, ...(!ellipse && r ? { rectRadius: rr } : {}),
          fill: clear(bg) ? { type: 'none' } : { color: hex(bg), transparency: trans(alpha(bg), opacityOf(el)) },
          line: border ? { color: hex(cs.borderTopColor), width: pt(bw), transparency: trans(alpha(cs.borderTopColor), opacityOf(el)), ...(DASH[cs.borderTopStyle] ? { dashType: DASH[cs.borderTopStyle] } : {}) } : { type: 'none' },
          ...shapeExtra(el),
        });
      }
      if (!border && bbw > 0 && cs.borderBottomStyle !== 'none' && !clear(cs.borderBottomColor)) {
        ps.addShape('line', { x: b.x, y: b.y + b.h, w: b.w, h: 0, line: { color: hex(cs.borderBottomColor), width: pt(bbw), transparency: alpha(cs.borderBottomColor) } });
      }
      if (el.matches('ul, ol')) {
        skipInside(el);
        const gap = parseFloat(cs.rowGap) || 0;
        const items = [...el.children].filter(li => li.nodeName === 'LI');
        const runs = items.flatMap((li, k) => {
          const r = runsOf(li);
          if (!r.length) return [];
          r[0].options = { ...r[0].options, bullet: el.nodeName === 'OL' ? { type: 'number' } : true, paraSpaceAfter: k < items.length - 1 ? pt(gap) : 0 };
          r[r.length - 1].options.breakLine = k < items.length - 1;
          return r;
        });
        if (runs.length) ps.addText(runs, textOpts(el, b));
        continue;
      }
      if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) {
        skipInside(el);
        const runs = runsOf(el);
        if (runs.length) ps.addText(runs, textOpts(el, b));
      }
    }
  }

  async function toPptx() {
    await Promise.all([load(LIBS.html2canvas), load(LIBS.pptx)]);
    const p = new window.PptxGenJS();
    p.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 in
    p.title = document.title;
    await eachSlideOffscreen(c => slideToPptx(p, c));
    return p.write({ outputType: 'blob' });
  }

  async function exportAs(fmt) {
    $('ed-dl').disabled = true;
    try {
      select(null); document.activeElement?.blur?.();
      const blob = fmt === 'pdf' ? await toPdf() : await toPptx();
      const name = `${base}.${fmt}`;
      await post(name, blob);
      // Also offer a browser download where the host allows it.
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      status(`Exported ${name}`);
    } catch (e) { status('Export failed: ' + e.message); }
    finally { $('ed-dl').disabled = false; }
  }

  // --- commands + events ---
  const COMMANDS = {
    save, pdf: () => exportAs('pdf'), pptx: () => exportAs('pptx'), present: () => present(true),
    panel: () => togglePanel(), notes: () => toggleNotes(),
    strip: () => { const c = document.body.classList.toggle('strip-closed'); pref('strip-closed', c ? '1' : ''); fit(); if (!c) buildThumbs(); },
    theme: () => { const light = root.dataset.theme !== 'light'; light ? root.dataset.theme = 'light' : delete root.dataset.theme; pref('theme', light ? 'light' : 'dark'); },
    prev: () => show(i - 1), next: () => show(i + 1),
    image: () => $('ed-file').click(),
    text: () => insert('text'), table: () => insert('table'), rect: () => insert('rect'), round: () => insert('round'), ellipse: () => insert('ellipse'), line: () => insert('line'),
  };
  document.addEventListener('pointerdown', e => {
    // Keep the text caret when a menu is opened.
    if (e.target.closest('[data-menu]')) e.preventDefault();
  });
  document.addEventListener('click', e => {
    const menuBtn = e.target.closest('[data-menu]');
    const keep = menuBtn?.parentElement;
    document.querySelectorAll('.ed-menu.open').forEach(m => { if (m !== keep) m.classList.remove('open'); });
    if (menuBtn) return keep.classList.toggle('open');
    // Only editor chrome carries commands; slide content may use the same attribute names (e.g. data-layout).
    const t = e.target.closest('[data-chrome] :is([data-cmd], [data-zoom], [data-view], [data-add])');
    if (!t) return;
    t.closest('.ed-menu')?.classList.remove('open');
    if (t.dataset.cmd) COMMANDS[t.dataset.cmd]?.();
    else if (t.dataset.zoom) { zoom = t.dataset.zoom; fit(); }
    else if (t.dataset.view) setView(t.dataset.view);
    else if (t.dataset.add !== undefined) addSlide(t.dataset.add);
  });
  $('ed-file').onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    // shortcut: the picture is stored inside the deck as a data URL, which makes the .html big; upload to the folder when decks get heavy.
    const fr = new FileReader(); fr.onload = () => insertImage(fr.result); fr.readAsDataURL(f);
    e.target.value = '';
  };
  $('ed-notes').addEventListener('focus', record); // one undo step per visit to the notes box
  $('ed-notes').addEventListener('input', e => setNotes(e.target.value));
  $('ed-resize').addEventListener('pointerdown', e => {
    e.preventDefault();
    const bar = e.target; bar.classList.add('on');
    let t;
    const mv = ev => {
      const h = Math.round(Math.min(Math.max(innerHeight - ev.clientY, 110), innerHeight * 0.6));
      root.style.setProperty('--strip-h', h + 'px'); pref('strip-h', h);
      fit(); clearTimeout(t); t = setTimeout(buildThumbs, 60);
    };
    const up = () => { bar.classList.remove('on'); removeEventListener('pointermove', mv); removeEventListener('pointerup', up); buildThumbs(); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  });
  $('ed-nresize').addEventListener('pointerdown', e => {
    e.preventDefault();
    const bar = e.target; bar.classList.add('on');
    const mv = ev => {
      const h = Math.round(Math.min(Math.max($('ed-notesbox').getBoundingClientRect().bottom - ev.clientY, 60), innerHeight * 0.5));
      root.style.setProperty('--nh', h + 'px'); pref('notes-h', h); fit();
    };
    const up = () => { bar.classList.remove('on'); removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  });
  stage.addEventListener('input', () => { markDirty(); refreshThumbs(); drawSel(); });
  document.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 's') { e.preventDefault(); save(); return; }
    if (presenting()) {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) show(i + 1);
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) show(i - 1);
      else if (e.key === 'Escape') present(false);
      return;
    }
    if (e.key === 'Escape' && pop) return closePop();
    if (e.key === 'Escape' && menuOpen()) return closeMenu();
    if (e.target.isContentEditable) { if (e.key === 'Escape') { e.preventDefault(); stopEdit(); } return; } // while typing the browser keeps its own text undo / copy / paste
    if (e.target.closest?.('textarea, input, select')) { if (e.key === 'Escape') e.target.blur(); return; }
    if (e.key === 'F5') { e.preventDefault(); present(true); return; }
    if (mod && !e.altKey && (k === 'z' || k === 'y')) { e.preventDefault(); k === 'y' || e.shiftKey ? redo() : undo(); return; }
    const act = mod && { x: 'cut', c: 'copy', v: 'paste', d: 'dup', g: e.shiftKey ? 'ungroup' : 'group', l: e.altKey && 'link' }[k];
    if (act) { e.preventDefault(); if (!exec(act) && act === 'dup') manage('dup', i); return; } // Ctrl+D with nothing selected copies the slide
    if (!mod && !e.altKey && (e.key === ']' || e.key === '[') && sel.length) { e.preventDefault(); exec(e.key === ']' ? 'front' : 'back'); return; }
    if (sel.length) {
      const step = e.shiftKey ? 10 : 1, d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key], mv = sel.filter(movable);
      if (d && mv.length) { e.preventDefault(); nudge(mv, d[0], d[1]); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); exec('del'); return; }
      if (e.key === 'Escape') return setSel([]);
    }
    if (['ArrowRight', 'ArrowDown', 'PageDown'].includes(e.key)) { e.preventDefault(); show(i + 1); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); show(i - 1); }
  });
  window.addEventListener('beforeunload', e => { if (dirty) e.preventDefault(); });
  window.addEventListener('resize', fit);

  if (pref('strip-closed') === '1') document.body.classList.add('strip-closed');
  if (pref('notes-h')) root.style.setProperty('--nh', pref('notes-h') + 'px');
  if (pref('panel') === '1') document.body.classList.add('panel-open');
  if (pref('notes') === '1') document.body.classList.add('notes-open');
  syncChrome();
  // Hooks for the floating toolbars and the properties panel (later tasks): read the selection, listen to changes, run an edit with undo.
  window.DeckEditor = {
    get selection() { return sel.map(el => ({ el, kind: kindOf(el) })); },
    onSelectionChange: listeners, // push a fn(selection); called on every selection change
    get slide() { return slides()[i]; },
    kindOf, geom, exec,
    openPanel: togglePanel, closePanel: () => togglePanel(false), get panelOpen() { return panelOpen(); }, // openPanel() toggles; openPanel(true) only opens
    change, // change(fn, key?): one undoable edit; calls with the same key within 0.8 s (a slider drag) share one undo step
  };

  numberPages(); fitAll(); setView('single'); fit(); show(i);
  document.fonts.ready.then(() => { fitAll(); fit(); buildThumbs(); });
})();
